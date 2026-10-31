package buildkit

import (
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/summit/builder/internal/process"
)

func TestBuildKit_WaitReadySuccess(t *testing.T) {
	sockPath := fmt.Sprintf("/tmp/bk-test-%d.sock", time.Now().UnixNano())
	defer os.Remove(sockPath)
	mgr := NewManager(process.NewSupervisor(0, 0), sockPath, "mock-daemon", "mock-client")

	l, err := net.Listen("unix", sockPath)
	if err != nil {
		t.Fatalf("failed to listen on socket %s: %v", sockPath, err)
	}
	defer l.Close()

	readyDone := make(chan struct{})
	go func() {
		for {
			select {
			case <-readyDone:
				return
			default:
				_ = l.(*net.UnixListener).SetDeadline(time.Now().Add(100 * time.Millisecond))
				conn, err := l.Accept()
				if err == nil {
					_ = conn.Close()
				}
			}
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	defer close(readyDone)

	if err := mgr.WaitReady(ctx); err != nil {
		t.Fatalf("expected WaitReady to succeed, got: %v", err)
	}
}

func TestBuildKit_WaitReadyTimeout(t *testing.T) {
	sockPath := filepath.Join(os.TempDir(), fmt.Sprintf("non-existent-%d.sock", time.Now().UnixNano()))
	mgr := NewManager(process.NewSupervisor(0, 0), sockPath, "mock-daemon", "mock-client")

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	if err := mgr.WaitReady(ctx); err == nil {
		t.Fatal("expected error on WaitReady timeout, got nil")
	}
}

func envValue(env []string, key string) (string, bool) {
	for _, kv := range env {
		if len(kv) > len(key) && kv[:len(key)+1] == key+"=" {
			return kv[len(key)+1:], true
		}
	}
	return "", false
}

func TestBuildCommand_DockerConfigScopedToBuildctl(t *testing.T) {
	t.Setenv("DOCKER_CONFIG", "/should/be/replaced")
	mgr := NewManager(process.NewSupervisor(0, 0), "/tmp/x.sock", "buildkitd", "buildctl")

	spec := BuildKitBuildSpec{
		AppDir:          "/workspace/app",
		DockerfilePath:  "Dockerfile",
		Tag:             "ghcr.io/o/summit-app-s:sha-abc",
		PushToRegistry:  true,
		DockerConfigDir: "/var/run/secrets/summit/registry",
	}
	cmd := mgr.buildCommandSpec(spec)
	if got, ok := envValue(cmd.Env, "DOCKER_CONFIG"); !ok || got != "/var/run/secrets/summit/registry" {
		t.Errorf("buildctl DOCKER_CONFIG = %q (set=%v)", got, ok)
	}
	count := 0
	for _, kv := range cmd.Env {
		if len(kv) >= 14 && kv[:14] == "DOCKER_CONFIG=" {
			count++
		}
	}
	if count != 1 {
		t.Errorf("expected exactly one DOCKER_CONFIG entry, got %d", count)
	}

	// The daemon never receives DOCKER_CONFIG, even if the parent environment has it.
	daemon := mgr.daemonCommandSpec()
	if _, ok := envValue(daemon.Env, "DOCKER_CONFIG"); ok {
		t.Error("buildkitd must not receive DOCKER_CONFIG")
	}
	if daemon.Env == nil {
		t.Error("daemon env must be explicit so DOCKER_CONFIG is stripped")
	}

	// Without a configured credential dir buildctl keeps the inherited environment untouched.
	spec.DockerConfigDir = ""
	if plain := mgr.buildCommandSpec(spec); plain.Env != nil {
		t.Errorf("expected nil Env (inherit) without DockerConfigDir, got %d entries", len(plain.Env))
	}
	// The process-wide environment is never modified.
	if os.Getenv("DOCKER_CONFIG") != "/should/be/replaced" {
		t.Error("process environment was modified")
	}
}

func TestBuildCommand_InsecureOnlyWhenRequested(t *testing.T) {
	mgr := NewManager(process.NewSupervisor(0, 0), "/tmp/x.sock", "buildkitd", "buildctl")
	base := BuildKitBuildSpec{AppDir: "/a", DockerfilePath: "Dockerfile", Tag: "ghcr.io/o/r:t", PushToRegistry: true}

	hasInsecure := func(spec BuildKitBuildSpec) bool {
		for _, a := range mgr.buildCommandSpec(spec).Args {
			if a == "type=image,name=ghcr.io/o/r:t,push=true,registry.insecure=true" {
				return true
			}
		}
		return false
	}
	if hasInsecure(base) {
		t.Error("registry.insecure must not be set by default")
	}
	base.Insecure = true
	if !hasInsecure(base) {
		t.Error("registry.insecure expected when Insecure=true")
	}
}

func TestDaemonCommand_RootlessCommandLineAndFlags(t *testing.T) {
	t.Setenv("BUILDKITD_FLAGS", "--oci-worker-no-process-sandbox --debug")
	t.Setenv("SUMMIT_BUILDKITD_CONFIG", "/nonexistent/buildkitd.toml")
	mgr := NewManager(process.NewSupervisor(0, 0), "/run/user/1000/buildkit/buildkitd.sock", "rootlesskit buildkitd", "buildctl")
	d := mgr.daemonCommandSpec()
	if d.Command != "rootlesskit" {
		t.Fatalf("command = %q", d.Command)
	}
	want := []string{"buildkitd", "--addr", "unix:///run/user/1000/buildkit/buildkitd.sock", "--oci-worker=true",
		"--oci-worker-no-process-sandbox", "--debug"}
	if len(d.Args) != len(want) {
		t.Fatalf("args = %v, want %v", d.Args, want)
	}
	for i := range want {
		if d.Args[i] != want[i] {
			t.Errorf("args[%d] = %q, want %q", i, d.Args[i], want[i])
		}
	}
}
