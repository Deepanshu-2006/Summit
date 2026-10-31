package source

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

const (
	testJWT      = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJidWlsZCJ9.c2lnbmF0dXJl"
	testBuildID  = "a5d09f7b-6c41-477e-8c31-1e967a5b3a4f"
	testSHA      = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4"
	testCloneURL = "https://github.com/summit-org/sample-service.git"
)

func writeCredFile(t *testing.T, content string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "token")
	if err := os.WriteFile(p, []byte(content), 0o400); err != nil {
		t.Fatal(err)
	}
	return p
}

func brokerBody(token, cloneURL, sha string) string {
	b, _ := json.Marshal(map[string]any{
		"token":      token,
		"expires_at": time.Now().Add(time.Hour).UTC().Format(time.RFC3339),
		"repository": map[string]string{"clone_url": cloneURL, "commit_sha": sha},
	})
	return string(b)
}

func newResolver(t *testing.T, srvURL, fileContent string) *BrokerResolver {
	t.Helper()
	r := NewBrokerResolver(srvURL, writeCredFile(t, fileContent))
	r.RetryDelay = time.Millisecond
	return r
}

func req() SourceTokenRequest {
	return SourceTokenRequest{
		CredentialRef: "secret:summit-build-x",
		BuildID:       testBuildID,
		CloneURL:      testCloneURL,
		CommitSHA:     testSHA,
	}
}

func TestBrokerResolver_Success(t *testing.T) {
	var gotAuth, gotPath, gotMethod string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth, gotPath, gotMethod = r.Header.Get("Authorization"), r.URL.Path, r.Method
		_, _ = w.Write([]byte(brokerBody("ghs_installation", testCloneURL, strings.ToUpper(testSHA))))
	}))
	defer srv.Close()

	// Trailing newline in the file and trailing slash on the URL are both tolerated.
	r := newResolver(t, srv.URL+"/internal/v1/build-requests/", testJWT+"\n")
	tok, err := r.ResolveSourceToken(context.Background(), req())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tok != "ghs_installation" {
		t.Errorf("token = %q", tok)
	}
	if gotMethod != http.MethodPost || gotPath != "/internal/v1/build-requests/"+testBuildID+"/source-token" {
		t.Errorf("request = %s %s", gotMethod, gotPath)
	}
	if gotAuth != "Bearer "+testJWT {
		t.Errorf("Authorization = %q", gotAuth)
	}
}

func TestBrokerResolver_CloneURLNormalisation(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(brokerBody("ghs_x", "https://github.com/Summit-Org/Sample-Service.git", testSHA)))
	}))
	defer srv.Close()
	rq := req()
	rq.CloneURL = "https://github.com/summit-org/sample-service"
	if _, err := newResolver(t, srv.URL, testJWT).ResolveSourceToken(context.Background(), rq); err != nil {
		t.Fatalf("equivalent clone URLs must match: %v", err)
	}
}

func TestBrokerResolver_SHAMismatch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(brokerBody("ghs_must_not_leak", testCloneURL, "0000000000000000000000000000000000000000")))
	}))
	defer srv.Close()
	_, err := newResolver(t, srv.URL, testJWT).ResolveSourceToken(context.Background(), req())
	if err == nil || !strings.Contains(err.Error(), "commit_sha") {
		t.Fatalf("expected commit_sha mismatch error, got %v", err)
	}
	if strings.Contains(err.Error(), "ghs_must_not_leak") {
		t.Errorf("error leaks token: %v", err)
	}
}

func TestBrokerResolver_CloneURLMismatch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(brokerBody("ghs_x", "https://github.com/other/repo.git", testSHA)))
	}))
	defer srv.Close()
	_, err := newResolver(t, srv.URL, testJWT).ResolveSourceToken(context.Background(), req())
	if err == nil || !strings.Contains(err.Error(), "clone_url") {
		t.Fatalf("expected clone_url mismatch error, got %v", err)
	}
}

func TestBrokerResolver_Unauthorized(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		atomic.AddInt32(&calls, 1)
		http.Error(w, "echo of "+testJWT, http.StatusUnauthorized)
	}))
	defer srv.Close()
	_, err := newResolver(t, srv.URL, testJWT).ResolveSourceToken(context.Background(), req())
	if err == nil || !strings.Contains(err.Error(), "401") {
		t.Fatalf("expected 401 error, got %v", err)
	}
	if strings.Contains(err.Error(), testJWT) {
		t.Errorf("error leaks worker JWT: %v", err)
	}
	if atomic.LoadInt32(&calls) != 1 {
		t.Errorf("4xx must not be retried, calls=%d", calls)
	}
}

func TestBrokerResolver_RetriesOnceOn5xx(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if atomic.AddInt32(&calls, 1) == 1 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		_, _ = w.Write([]byte(brokerBody("ghs_after_retry", testCloneURL, testSHA)))
	}))
	defer srv.Close()
	tok, err := newResolver(t, srv.URL, testJWT).ResolveSourceToken(context.Background(), req())
	if err != nil || tok != "ghs_after_retry" {
		t.Fatalf("tok=%q err=%v", tok, err)
	}
	if calls != 2 {
		t.Errorf("calls = %d, want 2", calls)
	}
}

func TestBrokerResolver_GivesUpAfterOneRetry(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer srv.Close()
	if _, err := newResolver(t, srv.URL, testJWT).ResolveSourceToken(context.Background(), req()); err == nil {
		t.Fatal("expected error")
	}
	if calls != 2 {
		t.Errorf("calls = %d, want 2 (one retry)", calls)
	}
}

func TestBrokerResolver_RetriesOnNetworkError(t *testing.T) {
	srv := httptest.NewServer(http.NotFoundHandler())
	url := srv.URL
	srv.Close() // connection refused
	_, err := newResolver(t, url, testJWT).ResolveSourceToken(context.Background(), req())
	if err == nil {
		t.Fatal("expected network error")
	}
	if strings.Contains(err.Error(), url) {
		t.Errorf("error should not repeat the request URL: %v", err)
	}
}

func TestBrokerResolver_RawTokenFallbackWithoutBroker(t *testing.T) {
	r := NewBrokerResolver("", writeCredFile(t, "ghp_plain_token\n"))
	tok, err := r.ResolveSourceToken(context.Background(), req())
	if err != nil || tok != "ghp_plain_token" {
		t.Fatalf("tok=%q err=%v", tok, err)
	}
}

func TestBrokerResolver_JWTWithoutBrokerIsAnError(t *testing.T) {
	r := NewBrokerResolver("", writeCredFile(t, testJWT))
	_, err := r.ResolveSourceToken(context.Background(), req())
	if err == nil {
		t.Fatal("a worker JWT must not be used as a git token")
	}
	if strings.Contains(err.Error(), testJWT) {
		t.Errorf("error leaks worker JWT: %v", err)
	}
}

func TestBrokerResolver_MissingOrEmptyFile(t *testing.T) {
	if _, err := NewBrokerResolver("http://x", filepath.Join(t.TempDir(), "nope")).ResolveSourceToken(context.Background(), req()); err == nil {
		t.Error("expected error for missing file")
	}
	if _, err := NewBrokerResolver("http://x", writeCredFile(t, "  \n")).ResolveSourceToken(context.Background(), req()); err == nil {
		t.Error("expected error for empty file")
	}
}

func TestLooksLikeJWT(t *testing.T) {
	for in, want := range map[string]bool{
		testJWT:              true,
		"ghs_abc123":         false,
		"a.b":                false,
		"github_pat_11AAA":   false,
		"a.b.c.d":            false,
		"has space.b.c":      false,
		"x-access-token:a.b": false,
	} {
		if got := LooksLikeJWT(in); got != want {
			t.Errorf("LooksLikeJWT(%q) = %v, want %v", in, got, want)
		}
	}
}
