package worker

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
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
	"github.com/summit/builder/internal/workspace"
)

type mockBuildKitManager struct {
	started bool
	stopped bool
	last    buildkit.BuildKitBuildSpec
}

func (m *mockBuildKitManager) Start(_ context.Context) error {
	m.started = true
	return nil
}

func (m *mockBuildKitManager) WaitReady(_ context.Context) error {
	return nil
}

func (m *mockBuildKitManager) Build(_ context.Context, spec buildkit.BuildKitBuildSpec, callback process.StreamCallback) (*buildkit.BuildKitResult, error) {
	m.last = spec
	if callback != nil {
		callback("stdout", "=> mock build finished")
	}
	return &buildkit.BuildKitResult{
		ImageRef: "mock-image:tag",
		Duration: 100 * time.Millisecond,
		Stdout:   "=> mock build finished",
	}, nil
}

func (m *mockBuildKitManager) Stop(_ context.Context) error {
	m.stopped = true
	return nil
}

func TestCoordinator_EndToEndWorkflow(t *testing.T) {
	// 1. Setup local mock git repo
	originDir, err := os.MkdirTemp("", "summit-e2e-repo-*")
	if err != nil {
		t.Fatalf("creating repo dir: %v", err)
	}
	defer os.RemoveAll(originDir)

	runGit := func(args ...string) string {
		cmd := exec.Command("git", args...)
		cmd.Dir = originDir
		cmd.Env = []string{
			"GIT_AUTHOR_NAME=Test",
			"GIT_AUTHOR_EMAIL=test@example.com",
			"GIT_COMMITTER_NAME=Test",
			"GIT_COMMITTER_EMAIL=test@example.com",
		}
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("git %v failed: %s (%v)", args, string(out), err)
		}
		return strings.TrimSpace(string(out))
	}

	runGit("init")
	if err := os.WriteFile(filepath.Join(originDir, "index.js"), []byte("console.log('hello');"), 0644); err != nil {
		t.Fatalf("writing app file: %v", err)
	}
	runGit("add", "index.js")
	runGit("commit", "-m", "Initial commit")
	commitSHA := runGit("rev-parse", "HEAD")

	// 2. Mock OCI registry
	expectedDigest := "sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"
	regServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Docker-Content-Digest", expectedDigest)
		w.Header().Set("Content-Type", "application/vnd.oci.image.manifest.v1+json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"schemaVersion": 2}`))
	}))
	defer regServer.Close()
	regURL, _ := url.Parse(regServer.URL)

	// 3. Mock Railpack & Buildctl Scripts
	mockBinDir, err := os.MkdirTemp("", "summit-mock-bin-*")
	if err != nil {
		t.Fatalf("creating mock bin dir: %v", err)
	}
	defer os.RemoveAll(mockBinDir)

	mockRailpack := filepath.Join(mockBinDir, "railpack")
	railpackScript := `#!/bin/sh
if [ "$1" = "prepare" ]; then
	output_path="$4"
	echo '{"provider":"node","runtime":{"language":"nodejs","version":"20"},"start_command":"node index.js"}' > "$output_path"
	exit 0
fi
exit 0
`
	_ = os.WriteFile(mockRailpack, []byte(railpackScript), 0755)

	mockBuildctl := filepath.Join(mockBinDir, "buildctl")
	buildctlScript := `#!/bin/sh
echo "=> build step 1: solved"
exit 0
`
	_ = os.WriteFile(mockBuildctl, []byte(buildctlScript), 0755)

	// 4. Instantiate modules
	sup := process.NewSupervisor(0, 0)
	val := validation.NewValidator()

	wsDir, _ := os.MkdirTemp("", "summit-ws-*")
	defer os.RemoveAll(wsDir)
	wsMgr := workspace.NewManager(wsDir)

	gitClient := source.NewGitClient(sup)
	resolver := source.NewStaticCredentialResolver(map[string]string{
		"ref-source": "mock-token",
		"ref-reg":    "mock-reg-token",
	})
	sourceMgr := source.NewManager(resolver, gitClient)

	rpAdapter := railpack.NewCLIAdapter(sup, mockRailpack)
	mockBk := &mockBuildKitManager{}
	regClient := registry.NewClient(regServer.Client())
	memReporter := reporter.NewMemoryReporter()

	coord := NewCoordinator(val, wsMgr, sourceMgr, rpAdapter, mockBk, regClient, memReporter, sup)
	coord.SetRegistryDockerConfigDir("/var/run/secrets/summit/registry")

	spec := &protocol.BuildExecutionSpec{
		SchemaVersion: 1,
		Build: protocol.BuildMetadata{
			ID:            "a5d09f7b-6c41-477e-8c31-1e967a5b3a4f",
			AttemptID:     "f8c3e210-9b44-42f1-8f52-47d3412019aa",
			AttemptNumber: 1,
		},
		Source: protocol.SourceSpec{
			Provider:      "generic",
			Repository:    "summit/app",
			CloneURL:      originDir,
			CommitSHA:     commitSHA,
			RootDirectory: "/",
		},
		BuildConfig: protocol.BuildConfig{
			Builder: "railpack",
		},
		Credentials: protocol.CredentialsSpec{
			SourceCredentialRef:   "ref-source",
			RegistryCredentialRef: "ref-reg",
		},
		Output: protocol.OutputSpec{
			Registry:   regURL.Host,
			Repository: "tenant/app",
			Tag:        "build-1",
			Platforms:  []string{"linux/amd64"},
		},
		Resources: protocol.ResourceLimits{
			CPUMillicores:       2000,
			MemoryMiB:           4096,
			EphemeralStorageMiB: 8192,
		},
		TimeoutSeconds: 30,
		Reporting: protocol.ReportingSpec{
			Endpoint: "http://dummy/api",
			TokenRef: "token",
		},
	}

	result, err := coord.Run(context.Background(), spec)
	if err != nil {
		t.Fatalf("coordinator run failed: %v", err)
	}

	if result.Status != protocol.StatusSucceeded {
		t.Fatalf("expected status succeeded, got %s", result.Status)
	}
	if result.Artifact == nil || result.Artifact.Digest != expectedDigest {
		t.Errorf("expected digest %s, got %v", expectedDigest, result.Artifact)
	}
	if result.Metadata.CommitSHA != commitSHA {
		t.Errorf("expected commit SHA %s, got %s", commitSHA, result.Metadata.CommitSHA)
	}

	// buildctl gets the credential dir; the loopback test registry is the only reason for insecure.
	if mockBk.last.DockerConfigDir != "/var/run/secrets/summit/registry" {
		t.Errorf("DockerConfigDir not propagated to BuildKit: %q", mockBk.last.DockerConfigDir)
	}
	if !mockBk.last.Insecure {
		t.Error("loopback registry should be built with insecure=true")
	}

	// Verify reporter captured updates and final result
	if memReporter.FinalResult == nil || memReporter.FinalResult.Status != protocol.StatusSucceeded {
		t.Fatal("reporter missing final succeeded result")
	}
	if len(memReporter.Statuses) < 5 {
		t.Errorf("expected at least 5 status updates, got %d", len(memReporter.Statuses))
	}
}
