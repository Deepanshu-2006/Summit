package source

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/http/cgi"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/summit/builder/internal/process"
)

// TestGitClone_TokenSentAsHeaderAndNotPersisted serves a real repository through
// git-http-backend, demands the Authorization header produced by GitAuthEnv, and then
// checks the token appears nowhere under the clone's .git directory.
func TestGitClone_TokenSentAsHeaderAndNotPersisted(t *testing.T) {
	backend := "/usr/lib/git-core/git-http-backend"
	if _, err := os.Stat(backend); err != nil {
		if p, lerr := exec.LookPath("git-http-backend"); lerr == nil {
			backend = p
		} else {
			t.Skip("git-http-backend not available")
		}
	}

	root := t.TempDir()
	bare := filepath.Join(root, "repo.git")
	run := func(dir string, args ...string) string {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		cmd.Env = append(os.Environ(),
			"GIT_AUTHOR_NAME=t", "GIT_AUTHOR_EMAIL=t@example.com",
			"GIT_COMMITTER_NAME=t", "GIT_COMMITTER_EMAIL=t@example.com")
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("git %v: %s (%v)", args, out, err)
		}
		return strings.TrimSpace(string(out))
	}
	work := filepath.Join(root, "work")
	_ = os.MkdirAll(work, 0o755)
	run(work, "init", "-q")
	_ = os.WriteFile(filepath.Join(work, "a.txt"), []byte("hi"), 0o644)
	run(work, "add", "a.txt")
	run(work, "commit", "-q", "-m", "init")
	sha := run(work, "rev-parse", "HEAD")
	run(root, "clone", "-q", "--bare", work, bare)
	run(bare, "config", "http.uploadpack", "true")

	const token = "ghs_super_secret_installation_token"
	wantAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte("x-access-token:"+token))

	h := &cgi.Handler{
		Path: backend,
		Env:  []string{"GIT_PROJECT_ROOT=" + root, "GIT_HTTP_EXPORT_ALL=1"},
	}
	var sawAuthed bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != wantAuth {
			w.Header().Set("WWW-Authenticate", `Basic realm="git"`)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		sawAuthed = true
		h.ServeHTTP(w, r)
	}))
	defer srv.Close()

	cloneURL := srv.URL + "/repo.git"
	target := filepath.Join(t.TempDir(), "src")
	client := NewGitClient(process.NewSupervisor(0, 0))
	ctx := context.Background()

	// Without the token the clone must fail (and the error must not leak anything).
	if err := client.Clone(ctx, cloneURL, filepath.Join(t.TempDir(), "noauth"), ""); err == nil {
		t.Fatal("clone without token unexpectedly succeeded")
	}

	if err := client.Clone(ctx, cloneURL, target, token); err != nil {
		t.Fatalf("clone with token failed: %v", err)
	}
	if err := client.FetchCommit(ctx, cloneURL, target, sha, token); err != nil {
		t.Fatalf("fetch with token failed: %v", err)
	}
	if err := client.CheckoutDetached(ctx, target, sha); err != nil {
		t.Fatalf("checkout failed: %v", err)
	}
	if !sawAuthed {
		t.Fatal("server never saw the Authorization header")
	}

	b64 := base64.StdEncoding.EncodeToString([]byte("x-access-token:" + token))
	_ = filepath.WalkDir(filepath.Join(target, ".git"), func(p string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		data, _ := os.ReadFile(p)
		if strings.Contains(string(data), token) || strings.Contains(string(data), b64) {
			t.Errorf("credential persisted in %s", p)
		}
		return nil
	})
	cfg, _ := os.ReadFile(filepath.Join(target, ".git", "config"))
	if !strings.Contains(string(cfg), srv.URL+"/repo.git") {
		t.Errorf("unexpected .git/config: %s", cfg)
	}
}
