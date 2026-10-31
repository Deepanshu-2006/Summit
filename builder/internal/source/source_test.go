package source

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/summit/builder/internal/process"
	"github.com/summit/builder/internal/protocol"
	"github.com/summit/builder/internal/workspace"
)

func TestVerifyCommitSHA(t *testing.T) {
	sha1 := "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1f"
	sha2 := "7F83B1657FF1FC53B92DC18148A1D65DFC2D4B1F"
	diff := "0000000000000000000000000000000000000000"

	if err := VerifyCommitSHA(sha1, sha2); err != nil {
		t.Errorf("expected case-insensitive match, got: %v", err)
	}

	if err := VerifyCommitSHA(sha1, diff); err == nil {
		t.Fatal("expected error on different commit SHAs, got nil")
	}
}

func TestCredentialsAndRedaction(t *testing.T) {
	rawURL := "https://github.com/summit/test-repo.git"
	injected, err := InjectGitCredentials(rawURL, "secret-token")
	if err != nil {
		t.Fatalf("unexpected error injecting creds: %v", err)
	}

	if !strings.Contains(injected, "x-access-token:secret-token@github.com") {
		t.Errorf("unexpected injected URL: %s", injected)
	}

	redacted := RedactGitURL(injected)
	if strings.Contains(redacted, "secret-token") {
		t.Errorf("secret token leaked in redacted URL: %s", redacted)
	}
	if !strings.Contains(redacted, "redacted@github.com") {
		t.Errorf("expected redacted userinfo: %s", redacted)
	}
}

func TestSourceManager_LocalGitRepo(t *testing.T) {
	// 1. Create a temporary local git repository to serve as remote origin
	originDir, err := os.MkdirTemp("", "summit-origin-repo-*")
	if err != nil {
		t.Fatalf("failed to create origin dir: %v", err)
	}
	defer os.RemoveAll(originDir)

	runGit := func(dir string, args ...string) string {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		cmd.Env = []string{
			"GIT_AUTHOR_NAME=Test",
			"GIT_AUTHOR_EMAIL=test@example.com",
			"GIT_COMMITTER_NAME=Test",
			"GIT_COMMITTER_EMAIL=test@example.com",
		}
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("git %v failed in %s: %s (%v)", args, dir, string(out), err)
		}
		return strings.TrimSpace(string(out))
	}

	runGit(originDir, "init")
	testFile := filepath.Join(originDir, "README.md")
	if err := os.WriteFile(testFile, []byte("# Hello Summit"), 0644); err != nil {
		t.Fatalf("writing file: %v", err)
	}
	runGit(originDir, "add", "README.md")
	runGit(originDir, "commit", "-m", "Initial commit")
	commitSHA := runGit(originDir, "rev-parse", "HEAD")

	// 2. Setup workspace
	wsBase, err := os.MkdirTemp("", "summit-ws-*")
	if err != nil {
		t.Fatalf("failed to create ws dir: %v", err)
	}
	defer os.RemoveAll(wsBase)

	wsMgr := workspace.NewManager(wsBase)
	paths, err := wsMgr.Initialize("build-1", "attempt-1")
	if err != nil {
		t.Fatalf("initializing workspace: %v", err)
	}

	// 3. Prepare Source
	spec := &protocol.BuildExecutionSpec{
		SchemaVersion: 1,
		Source: protocol.SourceSpec{
			Provider:      "generic",
			Repository:    "local/repo",
			CloneURL:      originDir,
			CommitSHA:     commitSHA,
			RootDirectory: "/",
		},
		Credentials: protocol.CredentialsSpec{},
	}

	sup := process.NewSupervisor(0, 0)
	gitClient := NewGitClient(sup)
	resolver := NewStaticCredentialResolver(nil)
	mgr := NewManager(resolver, gitClient)

	res, err := mgr.PrepareSource(context.Background(), spec, paths)
	if err != nil {
		t.Fatalf("unexpected error in PrepareSource: %v", err)
	}

	if res.CommitSHA != commitSHA {
		t.Errorf("expected commit SHA %s, got %s", commitSHA, res.CommitSHA)
	}

	content, err := os.ReadFile(filepath.Join(res.AppDir, "README.md"))
	if err != nil {
		t.Fatalf("failed to read cloned file: %v", err)
	}
	if string(content) != "# Hello Summit" {
		t.Errorf("unexpected content: %s", string(content))
	}
}
