package buildkit

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/summit/builder/internal/process"
)

// BuildKitBuildSpec specifies parameters for building an image using buildctl.
type BuildKitBuildSpec struct {
	AppDir         string
	PlanPath       string
	DockerfilePath string
	Tag            string
	Platforms      []string
	EnvVars        map[string]string
	PushToRegistry bool
	// Insecure adds registry.insecure=true to the image exporter. Set it only for registries
	// explicitly configured as insecure (loopback or SUMMIT_INSECURE_REGISTRIES).
	Insecure bool
	// DockerConfigDir, when set, is exported as DOCKER_CONFIG in the environment of the
	// buildctl process only, so buildctl can authenticate the push. It is never set for
	// buildkitd, and BuildKit does not expose client credentials to RUN steps.
	DockerConfigDir string
}

// BuildKitResult holds build execution metrics and output.
type BuildKitResult struct {
	ImageRef string
	Duration time.Duration
	Stdout   string
	Stderr   string
}

// BuildKitManager defines the interface for managing daemon lifecycle and image builds.
type BuildKitManager interface {
	Start(ctx context.Context) error
	WaitReady(ctx context.Context) error
	Build(ctx context.Context, spec BuildKitBuildSpec, callback process.StreamCallback) (*BuildKitResult, error)
	Stop(ctx context.Context) error
}

// Manager controls the rootless buildkitd daemon and issues buildctl commands.
type Manager struct {
	supervisor    *process.Supervisor
	socketPath    string
	daemonBin     string
	daemonArgs    []string
	clientBin     string
	daemonCancel  context.CancelFunc
	daemonStopped chan struct{}

	logMu     sync.Mutex
	daemonLog []string // last daemonLogLines lines of buildkitd output
}

const daemonLogLines = 60

func (m *Manager) recordDaemonLine(stream, line string) {
	slog.Info("buildkitd", "stream", stream, "line", line)
	m.logMu.Lock()
	defer m.logMu.Unlock()
	m.daemonLog = append(m.daemonLog, line)
	if len(m.daemonLog) > daemonLogLines {
		m.daemonLog = m.daemonLog[len(m.daemonLog)-daemonLogLines:]
	}
}

// DaemonOutput returns the most recent buildkitd output lines (for diagnostics).
func (m *Manager) DaemonOutput() string {
	m.logMu.Lock()
	defer m.logMu.Unlock()
	return strings.Join(m.daemonLog, "\n")
}

// NewManager constructs a new BuildKit Manager.
func NewManager(supervisor *process.Supervisor, socketPath, daemonBin, clientBin string) *Manager {
	if supervisor == nil {
		supervisor = process.NewSupervisor(0, 0)
	}
	if socketPath == "" {
		if envSocket := os.Getenv("SUMMIT_BUILDKIT_SOCKET"); envSocket != "" {
			socketPath = envSocket
		} else {
			socketPath = "/run/buildkit/buildkitd.sock"
		}
	}
	if daemonBin == "" {
		if envDaemon := os.Getenv("SUMMIT_BUILDKITD_BIN"); envDaemon != "" {
			daemonBin = envDaemon
		} else {
			daemonBin = "buildkitd"
		}
	}
	// SUMMIT_BUILDKITD_BIN may be a short command line such as "rootlesskit buildkitd",
	// which is how the rootless BuildKit image starts the daemon.
	var daemonPrefix []string
	if fields := strings.Fields(daemonBin); len(fields) > 1 {
		daemonBin = fields[0]
		daemonPrefix = fields[1:]
	}
	if clientBin == "" {
		if envClient := os.Getenv("SUMMIT_BUILDCTL_BIN"); envClient != "" {
			clientBin = envClient
		} else {
			clientBin = "buildctl"
		}
	}
	return &Manager{
		supervisor: supervisor,
		socketPath: socketPath,
		daemonBin:  daemonBin,
		daemonArgs: daemonPrefix,
		clientBin:  clientBin,
	}
}

// SocketPath returns the configured daemon unix domain socket path.
func (m *Manager) SocketPath() string {
	return m.socketPath
}

// Start launches the rootless buildkitd daemon in the background.
func (m *Manager) Start(ctx context.Context) error {
	// If daemon is already running and reachable on socket, reuse existing daemon
	if conn, err := net.Dial("unix", m.socketPath); err == nil {
		_ = conn.Close()
		return nil
	}

	// Ensure socket directory exists
	if err := os.MkdirAll(filepath.Dir(m.socketPath), 0700); err != nil {
		return fmt.Errorf("creating buildkit socket dir: %w", err)
	}

	// Clean stale socket if it exists
	_ = os.Remove(m.socketPath)

	daemonCtx, cancel := context.WithCancel(context.Background())
	m.daemonCancel = cancel
	m.daemonStopped = make(chan struct{})

	spec := m.daemonCommandSpec()

	go func() {
		defer close(m.daemonStopped)
		_, _ = m.supervisor.Execute(daemonCtx, spec, m.recordDaemonLine)
	}()

	return nil
}

// daemonCommandSpec builds the buildkitd command. Extra daemon flags come from
// BUILDKITD_FLAGS (same variable the upstream buildctl-daemonless.sh uses), for example
// "--oci-worker-no-process-sandbox" when user/PID namespaces are restricted. The config
// file at SUMMIT_BUILDKITD_CONFIG (default /etc/buildkit/buildkitd.toml) is used if present.
//
// The daemon environment deliberately excludes DOCKER_CONFIG: registry credentials go
// only to buildctl.
func (m *Manager) daemonCommandSpec() process.CommandSpec {
	args := append([]string{}, m.daemonArgs...)
	args = append(args, "--addr", fmt.Sprintf("unix://%s", m.socketPath), "--oci-worker=true")

	configPath := os.Getenv("SUMMIT_BUILDKITD_CONFIG")
	if configPath == "" {
		configPath = "/etc/buildkit/buildkitd.toml"
	}
	if st, err := os.Stat(configPath); err == nil && !st.IsDir() {
		args = append(args, "--config", configPath)
	}
	args = append(args, strings.Fields(os.Getenv("BUILDKITD_FLAGS"))...)

	return process.CommandSpec{
		Command: m.daemonBin,
		Args:    args,
		Env:     withoutEnv(os.Environ(), "DOCKER_CONFIG"),
	}
}

// withoutEnv returns env without entries for the given variable names.
func withoutEnv(env []string, names ...string) []string {
	out := make([]string, 0, len(env))
	for _, kv := range env {
		drop := false
		for _, n := range names {
			if strings.HasPrefix(kv, n+"=") {
				drop = true
				break
			}
		}
		if !drop {
			out = append(out, kv)
		}
	}
	return out
}

// WaitReady polls the unix domain socket until buildkitd is accepting connections or timeout.
func (m *Manager) WaitReady(ctx context.Context) error {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("timed out waiting for buildkitd socket %s: %w%s", m.socketPath, ctx.Err(), m.daemonOutputSuffix())
		case <-m.daemonExited():
			return fmt.Errorf("buildkitd exited before its socket %s became ready%s", m.socketPath, m.daemonOutputSuffix())
		case <-ticker.C:
			conn, err := net.Dial("unix", m.socketPath)
			if err == nil {
				_ = conn.Close()
				return nil
			}
		}
	}
}

// daemonExited returns a channel closed when the daemon started by Start has exited; for a
// daemon this manager did not start it never fires.
func (m *Manager) daemonExited() <-chan struct{} {
	if m.daemonStopped == nil {
		return nil
	}
	return m.daemonStopped
}

func (m *Manager) daemonOutputSuffix() string {
	if out := m.DaemonOutput(); out != "" {
		return "; buildkitd output:\n" + out
	}
	return ""
}

// buildCommandSpec builds the buildctl command for spec. When spec.DockerConfigDir is set
// it is exported as DOCKER_CONFIG for this process only.
func (m *Manager) buildCommandSpec(spec BuildKitBuildSpec) process.CommandSpec {
	var args []string
	if spec.PlanPath != "" {
		frontendImage := "ghcr.io/railwayapp/railpack-frontend:v0.43.0"
		if envImg := os.Getenv("SUMMIT_RAILPACK_FRONTEND_IMAGE"); envImg != "" {
			frontendImage = envImg
		}
		args = []string{
			fmt.Sprintf("--addr=unix://%s", m.socketPath),
			"build",
			"--frontend=gateway.v0",
			fmt.Sprintf("--opt=source=%s", frontendImage),
			"--local", fmt.Sprintf("context=%s", spec.AppDir),
			"--local", fmt.Sprintf("dockerfile=%s", filepath.Dir(spec.PlanPath)),
		}
	} else {
		dfName := "Dockerfile"
		if spec.DockerfilePath != "" {
			dfName = spec.DockerfilePath
		}
		args = []string{
			fmt.Sprintf("--addr=unix://%s", m.socketPath),
			"build",
			"--frontend=dockerfile.v0",
			"--local", fmt.Sprintf("context=%s", spec.AppDir),
			"--local", fmt.Sprintf("dockerfile=%s", spec.AppDir),
			"--opt", fmt.Sprintf("filename=%s", dfName),
		}
	}

	// Output exporter config
	outputOpts := []string{"type=image", fmt.Sprintf("name=%s", spec.Tag)}
	if spec.PushToRegistry {
		outputOpts = append(outputOpts, "push=true")
	}
	if spec.Insecure {
		outputOpts = append(outputOpts, "registry.insecure=true")
	}
	args = append(args, "--output", strings.Join(outputOpts, ","))

	cmdSpec := process.CommandSpec{
		Command: m.clientBin,
		Args:    args,
		Cwd:     spec.AppDir,
	}
	if spec.DockerConfigDir != "" {
		cmdSpec.Env = append(withoutEnv(os.Environ(), "DOCKER_CONFIG"), "DOCKER_CONFIG="+spec.DockerConfigDir)
	}
	return cmdSpec
}

// Build runs buildctl against the running daemon using the Railpack frontend or Dockerfile.
func (m *Manager) Build(ctx context.Context, spec BuildKitBuildSpec, callback process.StreamCallback) (*BuildKitResult, error) {
	cmdSpec := m.buildCommandSpec(spec)

	res, err := m.supervisor.Execute(ctx, cmdSpec, callback)
	if err != nil {
		return nil, fmt.Errorf("buildctl build failed: %w", err)
	}

	return &BuildKitResult{
		ImageRef: spec.Tag,
		Duration: res.Duration,
		Stdout:   res.Stdout,
		Stderr:   res.Stderr,
	}, nil
}

// Stop terminates the buildkitd daemon and cleans up the socket.
func (m *Manager) Stop(ctx context.Context) error {
	if m.daemonCancel == nil {
		return nil
	}
	m.daemonCancel()

	if m.daemonStopped != nil {
		select {
		case <-m.daemonStopped:
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(5 * time.Second):
		}
	}

	_ = os.Remove(m.socketPath)
	return nil
}
