package cluster

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	apimachineryversion "k8s.io/apimachinery/pkg/version"
	discoveryfake "k8s.io/client-go/discovery/fake"
	testingk8s "k8s.io/client-go/testing"
)

func TestClient_ProbeReachability_Success(t *testing.T) {
	fakeDisc := &discoveryfake.FakeDiscovery{
		Fake: &testingk8s.Fake{},
		FakedServerVersion: &apimachineryversion.Info{
			Major:      "1",
			Minor:      "37",
			GitVersion: "v1.37.0",
			Platform:   "linux/amd64",
		},
	}

	client := NewClientWithDiscovery(fakeDisc, TargetKind)

	if client.Target() != TargetKind {
		t.Errorf("expected TargetKind, got %s", client.Target())
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	info, err := client.ProbeReachability(ctx)
	if err != nil {
		t.Fatalf("unexpected probe error: %v", err)
	}

	if info.GitVersion != "v1.37.0" {
		t.Errorf("expected GitVersion v1.37.0, got %s", info.GitVersion)
	}
	if info.Major != "1" || info.Minor != "37" {
		t.Errorf("expected 1.37, got %s.%s", info.Major, info.Minor)
	}
	if info.Platform != "linux/amd64" {
		t.Errorf("expected platform linux/amd64, got %s", info.Platform)
	}
}

func TestClient_ProbeReachability_ContextDeadline(t *testing.T) {
	fakeDisc := &discoveryfake.FakeDiscovery{
		Fake: &testingk8s.Fake{},
		FakedServerVersion: &apimachineryversion.Info{
			GitVersion: "v1.37.0",
		},
	}

	client := NewClientWithDiscovery(fakeDisc, TargetKind)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	_, err := client.ProbeReachability(ctx)
	if err == nil {
		t.Fatalf("expected error on cancelled context, got nil")
	}
	if !errors.Is(err, context.Canceled) {
		t.Errorf("expected context.Canceled, got %v", err)
	}
}

func TestMockClient(t *testing.T) {
	mock := &MockClient{
		TargetType: TargetMock,
		VersionInfo: &ServerVersionInfo{
			GitVersion: "v1.37.0",
		},
	}

	if mock.Target() != TargetMock {
		t.Errorf("expected TargetMock, got %s", mock.Target())
	}

	info, err := mock.ProbeReachability(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.GitVersion != "v1.37.0" {
		t.Errorf("expected v1.37.0, got %s", info.GitVersion)
	}

	// Test mock error injection
	injectedErr := errors.New("cluster unreachable")
	mock.ProbeErr = injectedErr
	_, err = mock.ProbeReachability(context.Background())
	if !errors.Is(err, injectedErr) {
		t.Fatalf("expected injected error, got %v", err)
	}
}

func TestResolveKubeconfigPath(t *testing.T) {
	// 1. Explicit path takes precedence
	explicit := "/custom/path/kubeconfig"
	if got := resolveKubeconfigPath(explicit); got != explicit {
		t.Errorf("expected %s, got %s", explicit, got)
	}

	// 2. KUBECONFIG env var
	t.Setenv("KUBECONFIG", "/env/path/kubeconfig")
	if got := resolveKubeconfigPath(""); got != "/env/path/kubeconfig" {
		t.Errorf("expected /env/path/kubeconfig, got %s", got)
	}

	// 3. Fallback to ~/.kube/config
	t.Setenv("KUBECONFIG", "")
	home, _ := os.UserHomeDir()
	expectedDefault := filepath.Join(home, ".kube", "config")
	if got := resolveKubeconfigPath(""); got != expectedDefault {
		t.Errorf("expected default %s, got %s", expectedDefault, got)
	}
}

func TestBuildRESTConfig_SetsTimeoutAndContext(t *testing.T) {
	tempKubeconfig := filepath.Join(t.TempDir(), "kubeconfig")
	kubeconfigContent := `apiVersion: v1
clusters:
- cluster:
    server: https://127.0.0.1:6443
  name: local-cluster
contexts:
- context:
    cluster: local-cluster
    user: test-user
  name: local-context
current-context: local-context
kind: Config
preferences: {}
users:
- name: test-user
  user:
    token: test-token
`
	if err := os.WriteFile(tempKubeconfig, []byte(kubeconfigContent), 0600); err != nil {
		t.Fatalf("failed to write temp kubeconfig: %v", err)
	}

	timeout := 3500 * time.Millisecond
	cfg := Config{
		Target:         TargetKubeconfig,
		KubeconfigPath: tempKubeconfig,
		ContextName:    "local-context",
		ProbeTimeout:   timeout,
	}

	restCfg, err := buildRESTConfig(cfg)
	if err != nil {
		t.Fatalf("unexpected error building rest config: %v", err)
	}

	if restCfg.Timeout != timeout {
		t.Errorf("expected rest.Config.Timeout to be %v, got %v", timeout, restCfg.Timeout)
	}
	if restCfg.Host != "https://127.0.0.1:6443" {
		t.Errorf("expected host https://127.0.0.1:6443, got %s", restCfg.Host)
	}
}

func TestBuildRESTConfig_NonExistentFile(t *testing.T) {
	cfg := Config{
		Target:         TargetKubeconfig,
		KubeconfigPath: "/tmp/non-existent-kubeconfig-file-12345",
		ProbeTimeout:   5 * time.Second,
	}

	_, err := buildRESTConfig(cfg)
	if err == nil {
		t.Fatalf("expected error for non-existent kubeconfig, got nil")
	}
	if !errors.Is(err, ErrKubeconfigNotFound) {
		t.Fatalf("expected ErrKubeconfigNotFound, got %v", err)
	}
}

func TestSanitizeError(t *testing.T) {
	secretErr := errors.New("request failed with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret")
	sanitized := sanitizeError(secretErr)

	if sanitized != "request failed with Bearer [REDACTED]" {
		t.Errorf("sensitive token was not sanitized: %s", sanitized)
	}
}
