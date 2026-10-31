package integration_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/summit/builder/internal/buildkit"
	"github.com/summit/builder/internal/process"
	"github.com/summit/builder/internal/protocol"
	"github.com/summit/builder/internal/railpack"
	"github.com/summit/builder/internal/registry"
	"github.com/summit/builder/internal/reporter"
	"github.com/summit/builder/internal/source"
	"github.com/summit/builder/internal/validation"
	"github.com/summit/builder/internal/worker"
	"github.com/summit/builder/internal/workspace"
)

// recordedTelemetry stores payloads captured by the mock HTTP reporting server.
type recordedTelemetry struct {
	mu           sync.Mutex
	statusEvents []protocol.StatusUpdate
	logEvents    []protocol.LogEvent
	finalResult  *protocol.BuildExecutionResult
	tokensUsed   []string
}

func setupMockReportingServer(t *testing.T, telemetry *recordedTelemetry) *httptest.Server {
	t.Helper()

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		token := strings.TrimPrefix(authHeader, "Bearer ")

		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "reading body failed", http.StatusBadRequest)
			return
		}
		defer r.Body.Close()

		telemetry.mu.Lock()
		defer telemetry.mu.Unlock()
		telemetry.tokensUsed = append(telemetry.tokensUsed, token)

		path := r.URL.Path
		switch {
		case strings.HasSuffix(path, "/status"):
			var update protocol.StatusUpdate
			if err := json.Unmarshal(body, &update); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			telemetry.statusEvents = append(telemetry.statusEvents, update)
			w.WriteHeader(http.StatusOK)

		case strings.HasSuffix(path, "/logs"):
			var logs []protocol.LogEvent
			if err := json.Unmarshal(body, &logs); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			telemetry.logEvents = append(telemetry.logEvents, logs...)
			w.WriteHeader(http.StatusOK)

		case strings.HasSuffix(path, "/result"):
			var res protocol.BuildExecutionResult
			if err := json.Unmarshal(body, &res); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			telemetry.finalResult = &res
			w.WriteHeader(http.StatusOK)

		default:
			http.NotFound(w, r)
		}
	})

	return httptest.NewServer(handler)
}

func setupMockOCIRegistry(t *testing.T, expectedDigest string) *httptest.Server {
	t.Helper()

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Docker-Content-Digest", expectedDigest)
		w.Header().Set("Content-Type", "application/vnd.oci.image.manifest.v1+json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"schemaVersion": 2,
			"mediaType": "application/vnd.oci.image.manifest.v1+json",
			"config": {"mediaType": "application/vnd.oci.image.config.v1+json", "digest": "` + expectedDigest + `", "size": 123},
			"layers": []
		}`))
	})

	return httptest.NewServer(handler)
}

func initGitRepoFromDir(t *testing.T, srcDir string) (string, string) {
	t.Helper()

	repoDir, err := os.MkdirTemp("", "summit-test-git-*")
	if err != nil {
		t.Fatalf("failed to create temp git dir: %v", err)
	}

	runGit := func(args ...string) string {
		cmd := exec.Command("git", args...)
		cmd.Dir = repoDir
		cmd.Env = []string{
			"GIT_AUTHOR_NAME=Summit Builder Integration",
			"GIT_AUTHOR_EMAIL=builder@summit.local",
			"GIT_COMMITTER_NAME=Summit Builder Integration",
			"GIT_COMMITTER_EMAIL=builder@summit.local",
		}
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("git command %v failed in %s: %s (%v)", args, repoDir, string(out), err)
		}
		return strings.TrimSpace(string(out))
	}

	runGit("init")
	runGit("config", "user.name", "Summit Builder Integration")
	runGit("config", "user.email", "builder@summit.local")

	// Copy all files from srcDir into repoDir
	err = filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		target := filepath.Join(repoDir, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0755)
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, info.Mode())
	})
	if err != nil {
		t.Fatalf("copying fixture app files failed: %v", err)
	}

	runGit("add", "-A")
	runGit("commit", "-m", "Initial commit from sample app fixture")
	commitSHA := runGit("rev-parse", "HEAD")

	return repoDir, commitSHA
}

func createMockBinaries(t *testing.T) (binDir string, railpackBin string, buildctlBin string) {
	t.Helper()

	binDir, err := os.MkdirTemp("", "summit-mock-bins-*")
	if err != nil {
		t.Fatalf("creating mock bin dir: %v", err)
	}

	railpackBin = filepath.Join(binDir, "railpack")
	railpackContent := `#!/bin/sh
if [ "$1" = "--version" ]; then
	echo "railpack 0.3.2"
	exit 0
fi
if [ "$1" = "prepare" ]; then
	output_path="$4"
	echo '{"provider":"node","runtime":{"language":"nodejs","version":"20"},"start_command":"node server.js"}' > "$output_path"
	exit 0
fi
exit 0
`
	if err := os.WriteFile(railpackBin, []byte(railpackContent), 0755); err != nil {
		t.Fatalf("writing mock railpack: %v", err)
	}

	buildctlBin = filepath.Join(binDir, "buildctl")
	buildctlContent := `#!/bin/sh
echo "=> [internal] load build definition from Dockerfile"
echo "=> => transferring dockerfile: 120B done"
echo "=> [internal] load metadata for docker.io/library/node:20-alpine"
echo "=> [1/3] WORKDIR /app"
echo "=> exporting to image"
echo "=> => exporting layers"
echo "=> => writing image sha256:mock"
echo "=> => naming to destination"
exit 0
`
	if err := os.WriteFile(buildctlBin, []byte(buildctlContent), 0755); err != nil {
		t.Fatalf("writing mock buildctl: %v", err)
	}

	return binDir, railpackBin, buildctlBin
}

// TestWorkerIntegration_RailpackFlow verifies full end-to-end execution of a Node.js Express sample app
// using the Coordinator and HTTP reporter communicating with a real HTTP reporting server.
func TestWorkerIntegration_RailpackFlow(t *testing.T) {
	sampleAppDir := filepath.Join("..", "sample-apps", "node-express")
	repoDir, commitSHA := initGitRepoFromDir(t, sampleAppDir)
	defer os.RemoveAll(repoDir)

	expectedDigest := "sha256:d8985a73e6a6a2ef74a58b29ff5e4d8e788bc5f67a2134440076a51d953fb38f"
	mockReg := setupMockOCIRegistry(t, expectedDigest)
	defer mockReg.Close()
	regURL, _ := url.Parse(mockReg.URL)

	telemetry := &recordedTelemetry{}
	reporterServer := setupMockReportingServer(t, telemetry)
	defer reporterServer.Close()

	binDir, mockRailpack, _ := createMockBinaries(t)
	defer os.RemoveAll(binDir)

	wsDir, err := os.MkdirTemp("", "summit-integration-ws-*")
	if err != nil {
		t.Fatalf("creating ws dir: %v", err)
	}
	defer os.RemoveAll(wsDir)

	// Assembly of worker subsystems
	sup := process.NewSupervisor(0, 0)
	val := validation.NewValidator()
	wsMgr := workspace.NewManager(wsDir)
	gitClient := source.NewGitClient(sup)
	resolver := source.NewStaticCredentialResolver(map[string]string{
		"token:github": "mock-source-token",
		"token:reg":    "mock-registry-token",
	})
	sourceMgr := source.NewManager(resolver, gitClient)
	rpAdapter := railpack.NewCLIAdapter(sup, mockRailpack)

	// Mock BuildKit manager that emits logs and returns success
	mockBk := &testBuildKitManager{}
	regClient := registry.NewClient(mockReg.Client())
	httpRep := reporter.NewHTTPReporter(reporterServer.URL, "secret-bearer-token", reporterServer.Client())

	coord := worker.NewCoordinator(val, wsMgr, sourceMgr, rpAdapter, mockBk, regClient, httpRep, sup)

	spec := &protocol.BuildExecutionSpec{
		SchemaVersion: 1,
		Build: protocol.BuildMetadata{
			ID:            "11111111-2222-3333-4444-555555555555",
			AttemptID:     "66666666-7777-8888-9999-aaaaaaaaaaaa",
			AttemptNumber: 1,
			CorrelationID: "corr-integ-test-01",
		},
		Source: protocol.SourceSpec{
			Provider:      "generic",
			Repository:    "summit/node-express",
			CloneURL:      repoDir,
			CommitSHA:     commitSHA,
			RootDirectory: "/",
		},
		BuildConfig: protocol.BuildConfig{
			Builder: "railpack",
			EnvVars: map[string]string{"NODE_ENV": "production"},
		},
		Credentials: protocol.CredentialsSpec{
			SourceCredentialRef:   "token:github",
			RegistryCredentialRef: "token:reg",
		},
		Output: protocol.OutputSpec{
			Registry:   regURL.Host,
			Repository: "apps/node-express",
			Tag:        "v1.0.0",
			Platforms:  []string{"linux/amd64"},
		},
		Resources: protocol.ResourceLimits{
			CPUMillicores:       2000,
			MemoryMiB:           4096,
			EphemeralStorageMiB: 8192,
		},
		TimeoutSeconds: 30,
		Reporting: protocol.ReportingSpec{
			Endpoint: reporterServer.URL,
			TokenRef: "secret-bearer-token",
		},
	}

	result, err := coord.Run(context.Background(), spec)
	if err != nil {
		t.Fatalf("coordinator run failed: %v", err)
	}

	// 1. Verify returned result
	if result.Status != protocol.StatusSucceeded {
		t.Fatalf("expected status succeeded, got %s", result.Status)
	}
	if result.Artifact == nil || result.Artifact.Digest != expectedDigest {
		t.Fatalf("expected digest %s, got %v", expectedDigest, result.Artifact)
	}
	if result.Metadata.CommitSHA != commitSHA {
		t.Errorf("expected commit SHA %s, got %s", commitSHA, result.Metadata.CommitSHA)
	}

	// 2. Verify telemetry delivered over HTTP to mock reporter
	telemetry.mu.Lock()
	defer telemetry.mu.Unlock()

	if telemetry.finalResult == nil {
		t.Fatal("mock reporting server did not receive final result")
	}
	if telemetry.finalResult.Status != protocol.StatusSucceeded {
		t.Errorf("reported final status mismatch: %s", telemetry.finalResult.Status)
	}
	if len(telemetry.statusEvents) < 5 {
		t.Errorf("expected at least 5 status transitions over HTTP, got %d", len(telemetry.statusEvents))
	}

	// Verify Bearer token authorization header was passed
	for _, tok := range telemetry.tokensUsed {
		if tok != "secret-bearer-token" {
			t.Errorf("unexpected token in request header: '%s'", tok)
		}
	}
}

// TestWorkerIntegration_DockerfileFlow verifies building an app that already provides a Dockerfile.
func TestWorkerIntegration_DockerfileFlow(t *testing.T) {
	sampleAppDir := filepath.Join("..", "sample-apps", "dockerfile-node")
	repoDir, commitSHA := initGitRepoFromDir(t, sampleAppDir)
	defer os.RemoveAll(repoDir)

	expectedDigest := "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	mockReg := setupMockOCIRegistry(t, expectedDigest)
	defer mockReg.Close()
	regURL, _ := url.Parse(mockReg.URL)

	telemetry := &recordedTelemetry{}
	reporterServer := setupMockReportingServer(t, telemetry)
	defer reporterServer.Close()

	wsDir, err := os.MkdirTemp("", "summit-dockerfile-ws-*")
	if err != nil {
		t.Fatalf("creating ws dir: %v", err)
	}
	defer os.RemoveAll(wsDir)

	sup := process.NewSupervisor(0, 0)
	val := validation.NewValidator()
	wsMgr := workspace.NewManager(wsDir)
	gitClient := source.NewGitClient(sup)
	resolver := source.NewStaticCredentialResolver(nil)
	sourceMgr := source.NewManager(resolver, gitClient)

	// Ensure Railpack adapter is NOT invoked for Dockerfile strategy
	rpAdapter := &strictNoopRailpackAdapter{t: t}
	mockBk := &testBuildKitManager{}
	regClient := registry.NewClient(mockReg.Client())
	httpRep := reporter.NewHTTPReporter(reporterServer.URL, "dockerfile-token", reporterServer.Client())

	coord := worker.NewCoordinator(val, wsMgr, sourceMgr, rpAdapter, mockBk, regClient, httpRep, sup)

	dfPath := "Dockerfile"
	spec := &protocol.BuildExecutionSpec{
		SchemaVersion: 1,
		Build: protocol.BuildMetadata{
			ID:            "22222222-3333-4444-5555-666666666666",
			AttemptID:     "77777777-8888-9999-aaaa-bbbbbbbbbbbb",
			AttemptNumber: 1,
		},
		Source: protocol.SourceSpec{
			Provider:      "generic",
			Repository:    "summit/dockerfile-node",
			CloneURL:      repoDir,
			CommitSHA:     commitSHA,
			RootDirectory: "/",
		},
		BuildConfig: protocol.BuildConfig{
			Builder:        "dockerfile",
			DockerfilePath: &dfPath,
		},
		Credentials: protocol.CredentialsSpec{
			SourceCredentialRef:   "token:public",
			RegistryCredentialRef: "token:reg",
		},
		Output: protocol.OutputSpec{
			Registry:   regURL.Host,
			Repository: "apps/dockerfile-app",
			Tag:        "v1.0.0",
			Platforms:  []string{"linux/amd64"},
		},
		Resources: protocol.ResourceLimits{
			CPUMillicores:       1000,
			MemoryMiB:           2048,
			EphemeralStorageMiB: 4096,
		},
		TimeoutSeconds: 30,
		Reporting: protocol.ReportingSpec{
			Endpoint: reporterServer.URL,
			TokenRef: "dockerfile-token",
		},
	}

	result, err := coord.Run(context.Background(), spec)
	if err != nil {
		t.Fatalf("dockerfile build failed: %v", err)
	}

	if result.Status != protocol.StatusSucceeded {
		t.Fatalf("expected status succeeded, got %s", result.Status)
	}
	if result.Metadata.Builder != "dockerfile" {
		t.Errorf("expected builder metadata to be 'dockerfile', got %s", result.Metadata.Builder)
	}

	telemetry.mu.Lock()
	defer telemetry.mu.Unlock()
	if telemetry.finalResult == nil || telemetry.finalResult.Status != protocol.StatusSucceeded {
		t.Fatal("mock reporter did not receive succeeded status for dockerfile build")
	}
}

// TestWorkerIntegration_FailureFlow verifies that execution errors (e.g. invalid git commit)
// are accurately captured, formatted into protocol.ExecutionError, and reported over HTTP.
func TestWorkerIntegration_FailureFlow(t *testing.T) {
	telemetry := &recordedTelemetry{}
	reporterServer := setupMockReportingServer(t, telemetry)
	defer reporterServer.Close()

	wsDir, err := os.MkdirTemp("", "summit-fail-ws-*")
	if err != nil {
		t.Fatalf("creating ws dir: %v", err)
	}
	defer os.RemoveAll(wsDir)

	sup := process.NewSupervisor(0, 0)
	val := validation.NewValidator()
	wsMgr := workspace.NewManager(wsDir)
	gitClient := source.NewGitClient(sup)
	resolver := source.NewStaticCredentialResolver(nil)
	sourceMgr := source.NewManager(resolver, gitClient)
	rpAdapter := railpack.NewCLIAdapter(sup, "")
	mockBk := &testBuildKitManager{}
	regClient := registry.NewClient(nil)
	httpRep := reporter.NewHTTPReporter(reporterServer.URL, "fail-token", reporterServer.Client())

	coord := worker.NewCoordinator(val, wsMgr, sourceMgr, rpAdapter, mockBk, regClient, httpRep, sup)

	spec := &protocol.BuildExecutionSpec{
		SchemaVersion: 1,
		Build: protocol.BuildMetadata{
			ID:            "33333333-4444-5555-6666-777777777777",
			AttemptID:     "88888888-9999-aaaa-bbbb-cccccccccccc",
			AttemptNumber: 1,
		},
		Source: protocol.SourceSpec{
			Provider:      "generic",
			Repository:    "summit/missing-repo",
			CloneURL:      "https://invalid-host-unreachable-9999.local/repo.git",
			CommitSHA:     "1234567890123456789012345678901234567890",
			RootDirectory: "/",
		},
		BuildConfig: protocol.BuildConfig{
			Builder: "railpack",
		},
		Credentials: protocol.CredentialsSpec{
			SourceCredentialRef:   "token:mock",
			RegistryCredentialRef: "token:mock",
		},
		Output: protocol.OutputSpec{
			Registry:   "registry.example.internal",
			Repository: "tenant/app",
			Tag:        "v1",
			Platforms:  []string{"linux/amd64"},
		},
		Resources: protocol.ResourceLimits{
			CPUMillicores:       1000,
			MemoryMiB:           2048,
			EphemeralStorageMiB: 4096,
		},
		TimeoutSeconds: 15,
		Reporting: protocol.ReportingSpec{
			Endpoint: reporterServer.URL,
			TokenRef: "fail-token",
		},
	}

	result, err := coord.Run(context.Background(), spec)
	if err == nil {
		t.Fatal("expected coordinator to return error on clone failure, got nil")
	}

	if result.Status != protocol.StatusFailed {
		t.Errorf("expected status failed, got %s", result.Status)
	}
	if result.Error == nil {
		t.Fatal("expected result.Error to be populated")
	}
	if result.Error.Code != protocol.ErrCodeSourceCloneFailed {
		t.Errorf("expected error code %s, got %s", protocol.ErrCodeSourceCloneFailed, result.Error.Code)
	}

	// Verify HTTP reporter received the failure result
	telemetry.mu.Lock()
	defer telemetry.mu.Unlock()
	if telemetry.finalResult == nil {
		t.Fatal("mock reporter did not receive failure result")
	}
	if telemetry.finalResult.Status != protocol.StatusFailed {
		t.Errorf("expected reported status failed, got %s", telemetry.finalResult.Status)
	}
}

// TestWorkerBinary_SubprocessExecution verifies compiling cmd/worker and executing it as an
// independent OS subprocess using environment variables, filesystem spec input, and HTTP reporting.
func TestWorkerBinary_SubprocessExecution(t *testing.T) {
	// 1. Build the worker binary into a temporary location
	tempBinDir, err := os.MkdirTemp("", "summit-bin-build-*")
	if err != nil {
		t.Fatalf("creating temp bin dir: %v", err)
	}
	defer os.RemoveAll(tempBinDir)

	workerBinary := filepath.Join(tempBinDir, "worker")
	buildCmd := exec.Command("go", "build", "-o", workerBinary, "../../cmd/worker")
	if out, err := buildCmd.CombinedOutput(); err != nil {
		t.Fatalf("failed to compile worker binary: %s (%v)", string(out), err)
	}

	// 2. Setup mock git repo with Go HTTP sample app
	sampleAppDir := filepath.Join("..", "sample-apps", "go-http")
	repoDir, commitSHA := initGitRepoFromDir(t, sampleAppDir)
	defer os.RemoveAll(repoDir)

	expectedDigest := "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	mockReg := setupMockOCIRegistry(t, expectedDigest)
	defer mockReg.Close()
	regURL, _ := url.Parse(mockReg.URL)

	telemetry := &recordedTelemetry{}
	reporterServer := setupMockReportingServer(t, telemetry)
	defer reporterServer.Close()

	// 3. Create mock helper scripts for railpack and buildctl
	binDir, mockRailpack, mockBuildctl := createMockBinaries(t)
	defer os.RemoveAll(binDir)

	// Create mock socket listener for buildkitd
	socketDir, err := os.MkdirTemp("", "summit-bk-sock-*")
	if err != nil {
		t.Fatalf("creating socket dir: %v", err)
	}
	defer os.RemoveAll(socketDir)

	mockSocketPath := filepath.Join(socketDir, "buildkitd.sock")
	listener, err := net.Listen("unix", mockSocketPath)
	if err != nil {
		t.Fatalf("creating unix socket listener: %v", err)
	}
	defer listener.Close()

	// Accept connections on unix socket to satisfy WaitReady check
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			_ = conn.Close()
		}
	}()

	// Mock buildkitd daemon script that simply sleeps/idles
	mockBuildkitd := filepath.Join(binDir, "buildkitd")
	bkScript := `#!/bin/sh
while true; do
	sleep 1
done
`
	if err := os.WriteFile(mockBuildkitd, []byte(bkScript), 0755); err != nil {
		t.Fatalf("writing mock buildkitd: %v", err)
	}

	// 4. Generate JSON execution spec
	wsBaseDir, err := os.MkdirTemp("", "summit-proc-ws-*")
	if err != nil {
		t.Fatalf("creating ws dir: %v", err)
	}
	defer os.RemoveAll(wsBaseDir)

	spec := protocol.BuildExecutionSpec{
		SchemaVersion: 1,
		Build: protocol.BuildMetadata{
			ID:            "44444444-5555-6666-7777-888888888888",
			AttemptID:     "99999999-aaaa-bbbb-cccc-dddddddddddd",
			AttemptNumber: 1,
			CorrelationID: "corr-cli-test-01",
		},
		Source: protocol.SourceSpec{
			Provider:      "generic",
			Repository:    "summit/go-http",
			CloneURL:      repoDir,
			CommitSHA:     commitSHA,
			RootDirectory: "/",
		},
		BuildConfig: protocol.BuildConfig{
			Builder: "railpack",
		},
		Credentials: protocol.CredentialsSpec{
			SourceCredentialRef:   "token:local",
			RegistryCredentialRef: "token:reg",
		},
		Output: protocol.OutputSpec{
			Registry:   regURL.Host,
			Repository: "apps/go-http-app",
			Tag:        "v1.0.0",
			Platforms:  []string{"linux/amd64"},
		},
		Resources: protocol.ResourceLimits{
			CPUMillicores:       1000,
			MemoryMiB:           2048,
			EphemeralStorageMiB: 4096,
		},
		TimeoutSeconds: 30,
		Reporting: protocol.ReportingSpec{
			Endpoint: reporterServer.URL,
			TokenRef: "subprocess-token",
		},
	}

	specBytes, err := json.Marshal(spec)
	if err != nil {
		t.Fatalf("marshaling spec: %v", err)
	}

	specPath := filepath.Join(wsBaseDir, "execution.json")
	if err := os.WriteFile(specPath, specBytes, 0600); err != nil {
		t.Fatalf("writing spec file: %v", err)
	}

	// 5. Execute worker binary as a subprocess
	workerCmd := exec.Command(workerBinary)
	workerCmd.Env = append(os.Environ(),
		"SUMMIT_EXECUTION_SPEC="+specPath,
		"SUMMIT_WORKSPACE_BASE_DIR="+wsBaseDir,
		"SUMMIT_LOG_LEVEL=debug",
		"SUMMIT_WORKER_ID=worker-subprocess-test",
		"SUMMIT_RAILPACK_BIN="+mockRailpack,
		"SUMMIT_BUILDKIT_SOCKET="+mockSocketPath,
		"SUMMIT_BUILDKITD_BIN="+mockBuildkitd,
		"SUMMIT_BUILDCTL_BIN="+mockBuildctl,
	)

	out, err := workerCmd.CombinedOutput()
	if err != nil {
		t.Fatalf("worker subprocess failed with error: %v, output: %s", err, string(out))
	}

	// 6. Verify HTTP reporting captured status updates and final success
	telemetry.mu.Lock()
	defer telemetry.mu.Unlock()

	if telemetry.finalResult == nil {
		t.Fatalf("subprocess did not report final result. Subprocess output: %s", string(out))
	}
	if telemetry.finalResult.Status != protocol.StatusSucceeded {
		t.Errorf("expected final status succeeded, got %s", telemetry.finalResult.Status)
	}
	if telemetry.finalResult.Artifact == nil || telemetry.finalResult.Artifact.Digest != expectedDigest {
		t.Errorf("expected artifact digest %s, got %v", expectedDigest, telemetry.finalResult.Artifact)
	}
}

// Helpers

type testBuildKitManager struct {
	started bool
	stopped bool
}

func (m *testBuildKitManager) Start(_ context.Context) error {
	m.started = true
	return nil
}

func (m *testBuildKitManager) WaitReady(_ context.Context) error {
	return nil
}

func (m *testBuildKitManager) Build(_ context.Context, _ buildkit.BuildKitBuildSpec, callback process.StreamCallback) (*buildkit.BuildKitResult, error) {
	if callback != nil {
		callback("stdout", "=> mock build step finished")
	}
	return &buildkit.BuildKitResult{
		ImageRef: "mock-image:tag",
		Duration: 50 * time.Millisecond,
		Stdout:   "=> mock build step finished",
	}, nil
}

func (m *testBuildKitManager) Stop(_ context.Context) error {
	m.stopped = true
	return nil
}

type strictNoopRailpackAdapter struct {
	t *testing.T
}

func (s *strictNoopRailpackAdapter) Version(_ context.Context) (string, error) {
	return "0.3.2", nil
}

func (s *strictNoopRailpackAdapter) Prepare(_ context.Context, _ railpack.PrepareInput) (*railpack.PrepareResult, error) {
	s.t.Fatalf("Prepare should not be invoked when builder strategy is dockerfile")
	return nil, fmt.Errorf("unexpected Prepare invocation")
}

func (s *strictNoopRailpackAdapter) ValidatePlan(_ context.Context, _ string) error {
	return nil
}
