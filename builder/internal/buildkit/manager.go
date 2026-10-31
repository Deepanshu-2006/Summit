package buildkit

import (
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/summit/builder/internal/process"
)

// BuildKitBuildSpec specifies parameters for building an image using buildctl.
type BuildKitBuildSpec struct {
	AppDir        string
	PlanPath      string
	Tag           string
	Platforms     []string
	EnvVars       map[string]string
	PushToRegistry bool
	Insecure      bool
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
	clientBin     string
	daemonCancel  context.CancelFunc
	daemonStopped chan struct{}
}

// NewManager constructs a new BuildKit Manager.
func NewManager(supervisor *process.Supervisor, socketPath, daemonBin, clientBin string) *Manager {
	if supervisor == nil {
		supervisor = process.NewSupervisor(0, 0)
	}
	if socketPath == "" {
		socketPath = "/run/buildkit/buildkitd.sock"
	}
	if daemonBin == "" {
		daemonBin = "buildkitd"
	}
	if clientBin == "" {
		clientBin = "buildctl"
	}
	return &Manager{
		supervisor: supervisor,
		socketPath: socketPath,
		daemonBin:  daemonBin,
		clientBin:  clientBin,
	}
}

// SocketPath returns the configured daemon unix domain socket path.
func (m *Manager) SocketPath() string {
	return m.socketPath
}

// Start launches the rootless buildkitd daemon in the background.
func (m *Manager) Start(ctx context.Context) error {
	// Ensure socket directory exists
	if err := os.MkdirAll(filepath.Dir(m.socketPath), 0700); err != nil {
		return fmt.Errorf("creating buildkit socket dir: %w", err)
	}

	// Clean stale socket if it exists
	_ = os.Remove(m.socketPath)

	daemonCtx, cancel := context.WithCancel(context.Background())
	m.daemonCancel = cancel
	m.daemonStopped = make(chan struct{})

	spec := process.CommandSpec{
		Command: m.daemonBin,
		Args:    []string{"--addr", fmt.Sprintf("unix://%s", m.socketPath), "--oci-worker=true"},
	}

	go func() {
		defer close(m.daemonStopped)
		_, _ = m.supervisor.Execute(daemonCtx, spec, nil)
	}()

	return nil
}

// WaitReady polls the unix domain socket until buildkitd is accepting connections or timeout.
func (m *Manager) WaitReady(ctx context.Context) error {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("timed out waiting for buildkitd socket %s: %w", m.socketPath, ctx.Err())
		case <-ticker.C:
			conn, err := net.Dial("unix", m.socketPath)
			if err == nil {
				_ = conn.Close()
				return nil
			}
		}
	}
}

// Build runs buildctl against the running daemon using the Railpack frontend or Dockerfile.
func (m *Manager) Build(ctx context.Context, spec BuildKitBuildSpec, callback process.StreamCallback) (*BuildKitResult, error) {
	args := []string{
		fmt.Sprintf("--addr=unix://%s", m.socketPath),
		"build",
		"--frontend=gateway.v0",
		"--opt", "source=ghcr.io/railwayapp/railpack-frontend:v0.3.2",
		"--local", fmt.Sprintf("context=%s", spec.AppDir),
	}

	if spec.PlanPath != "" {
		args = append(args, "--local", fmt.Sprintf("railpack=%s", filepath.Dir(spec.PlanPath)))
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
	if m.daemonCancel != nil {
		m.daemonCancel()
	}

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
