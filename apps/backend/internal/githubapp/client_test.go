package githubapp

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// generateTestKey creates a throwaway RSA key pair for tests.
func generateTestKey(t *testing.T) (*rsa.PrivateKey, []byte) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate RSA key: %v", err)
	}

	pemBlock := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	})

	return key, pemBlock
}

// generateTestKeyPKCS8 creates a throwaway RSA key pair in PKCS8 format.
func generateTestKeyPKCS8(t *testing.T) (*rsa.PrivateKey, []byte) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate RSA key: %v", err)
	}

	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatalf("marshal PKCS8: %v", err)
	}

	pemBlock := pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: der,
	})

	return key, pemBlock
}

// fixedClock returns a clock function that always returns the given time.
func fixedClock(t time.Time) func() time.Time {
	return func() time.Time { return t }
}

// noopSleeper is a sleeper that returns immediately.
func noopSleeper(_ time.Duration) {}

// newTestClient creates a client configured to talk to the given test server.
func newTestClient(t *testing.T, srv *httptest.Server, keyPEM []byte) *Client {
	t.Helper()
	c, err := New(Config{
		AppID:         12345,
		PrivateKeyPEM: keyPEM,
		BaseURL:       srv.URL,
		APIVersion:    "2022-11-28",
		UserAgent:     "summit-test",
		HTTPClient:    srv.Client(),
		Clock:         fixedClock(time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC)),
		Sleeper:       noopSleeper,
		MaxRetries:    3,
	})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	return c
}

// --- Constructor tests ---

func TestNew_ValidPKCS1(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	c, err := New(Config{
		AppID:         1,
		PrivateKeyPEM: keyPEM,
		BaseURL:       "https://api.github.com",
		Sleeper:       noopSleeper,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c == nil {
		t.Fatal("client is nil")
	}
}

func TestNew_ValidPKCS8(t *testing.T) {
	_, keyPEM := generateTestKeyPKCS8(t)
	c, err := New(Config{
		AppID:         1,
		PrivateKeyPEM: keyPEM,
		BaseURL:       "https://api.github.com",
		Sleeper:       noopSleeper,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c == nil {
		t.Fatal("client is nil")
	}
}

func TestNew_MissingAppID(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	_, err := New(Config{
		PrivateKeyPEM: keyPEM,
		BaseURL:       "https://api.github.com",
	})
	if !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("expected ErrNotConfigured, got %v", err)
	}
}

func TestNew_MissingKey(t *testing.T) {
	_, err := New(Config{
		AppID:   1,
		BaseURL: "https://api.github.com",
	})
	if !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("expected ErrNotConfigured, got %v", err)
	}
}

func TestNew_InvalidPEM(t *testing.T) {
	_, err := New(Config{
		AppID:         1,
		PrivateKeyPEM: []byte("not a valid PEM"),
		BaseURL:       "https://api.github.com",
	})
	if !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("expected ErrNotConfigured, got %v", err)
	}
}

func TestNew_MissingBaseURL(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	_, err := New(Config{
		AppID:         1,
		PrivateKeyPEM: keyPEM,
	})
	if !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("expected ErrNotConfigured, got %v", err)
	}
}

// --- JWT tests ---

func TestGenerateAppJWT_Header(t *testing.T) {
	key, keyPEM := generateTestKey(t)
	now := time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC)

	srv := httptest.NewServer(http.NotFoundHandler())
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)
	c.clock = fixedClock(now)

	jwt, err := c.GenerateAppJWT()
	if err != nil {
		t.Fatalf("GenerateAppJWT: %v", err)
	}

	parts := strings.Split(jwt, ".")
	if len(parts) != 3 {
		t.Fatalf("JWT should have 3 parts, got %d", len(parts))
	}

	// Decode and verify header.
	headerJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		t.Fatalf("decode header: %v", err)
	}
	var header map[string]string
	if err := json.Unmarshal(headerJSON, &header); err != nil {
		t.Fatalf("unmarshal header: %v", err)
	}
	if header["alg"] != "RS256" {
		t.Errorf("header alg = %q, want RS256", header["alg"])
	}
	if header["typ"] != "JWT" {
		t.Errorf("header typ = %q, want JWT", header["typ"])
	}

	// Decode and verify claims.
	claimsJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatalf("decode claims: %v", err)
	}
	var claims map[string]interface{}
	if err := json.Unmarshal(claimsJSON, &claims); err != nil {
		t.Fatalf("unmarshal claims: %v", err)
	}

	// iss should be AppID as string.
	if iss, ok := claims["iss"].(string); !ok || iss != "12345" {
		t.Errorf("iss = %v, want '12345'", claims["iss"])
	}

	// iat should be now - 60s.
	expectedIAT := float64(now.Add(-60 * time.Second).Unix())
	if iat, ok := claims["iat"].(float64); !ok || iat != expectedIAT {
		t.Errorf("iat = %v, want %v", claims["iat"], expectedIAT)
	}

	// exp should be now + 9m.
	expectedEXP := float64(now.Add(9 * time.Minute).Unix())
	if exp, ok := claims["exp"].(float64); !ok || exp != expectedEXP {
		t.Errorf("exp = %v, want %v", claims["exp"], expectedEXP)
	}

	// Verify signature.
	sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		t.Fatalf("decode signature: %v", err)
	}
	payload := parts[0] + "." + parts[1]
	hash := sha256.Sum256([]byte(payload))
	if err := rsa.VerifyPKCS1v15(&key.PublicKey, crypto.SHA256, hash[:], sigBytes); err != nil {
		t.Fatalf("signature verification failed: %v", err)
	}
}

func TestGenerateAppJWT_Caching(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	srv := httptest.NewServer(http.NotFoundHandler())
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)

	jwt1, err := c.GenerateAppJWT()
	if err != nil {
		t.Fatalf("first call: %v", err)
	}

	jwt2, err := c.GenerateAppJWT()
	if err != nil {
		t.Fatalf("second call: %v", err)
	}

	if jwt1 != jwt2 {
		t.Error("expected cached JWT, got different tokens")
	}

	// Advance time past cache expiry (9 minutes - 1 minute margin = 8 minutes).
	c.clock = fixedClock(time.Date(2024, 1, 15, 12, 8, 1, 0, time.UTC))

	jwt3, err := c.GenerateAppJWT()
	if err != nil {
		t.Fatalf("third call: %v", err)
	}

	if jwt1 == jwt3 {
		t.Error("expected new JWT after expiry, got same token")
	}
}

// --- GetInstallation tests ---

func TestGetInstallation(t *testing.T) {
	_, keyPEM := generateTestKey(t)

	created := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	updated := time.Date(2024, 1, 10, 0, 0, 0, 0, time.UTC)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assertHeaders(t, r)

		if r.URL.Path != "/app/installations/42" {
			t.Errorf("unexpected path: %s", r.URL.Path)
			http.NotFound(w, r)
			return
		}

		w.Header().Set("X-GitHub-Request-Id", "req-123")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id": 42,
			"account": map[string]interface{}{
				"id":    100,
				"login": "test-org",
				"type":  "Organization",
			},
			"repository_selection": "selected",
			"permissions": map[string]string{
				"metadata": "read",
				"contents": "read",
			},
			"suspended_at": nil,
			"created_at":   created.Format(time.RFC3339),
			"updated_at":   updated.Format(time.RFC3339),
			"html_url":     "https://github.com/organizations/test-org/settings/installations/42",
		})
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)

	inst, err := c.GetInstallation(context.Background(), 42)
	if err != nil {
		t.Fatalf("GetInstallation: %v", err)
	}

	if inst.ID != 42 {
		t.Errorf("ID = %d, want 42", inst.ID)
	}
	if inst.AccountLogin != "test-org" {
		t.Errorf("AccountLogin = %q, want 'test-org'", inst.AccountLogin)
	}
	if inst.AccountType != "Organization" {
		t.Errorf("AccountType = %q, want 'Organization'", inst.AccountType)
	}
	if inst.RepositorySelection != "selected" {
		t.Errorf("RepositorySelection = %q, want 'selected'", inst.RepositorySelection)
	}
	if inst.SuspendedAt != nil {
		t.Error("expected SuspendedAt to be nil")
	}
}

func TestGetInstallation_Suspended(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	suspendedAt := time.Date(2024, 1, 5, 0, 0, 0, 0, time.UTC)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id": 42,
			"account": map[string]interface{}{
				"id":    100,
				"login": "test-org",
				"type":  "Organization",
			},
			"repository_selection": "all",
			"permissions":          map[string]string{},
			"suspended_at":         suspendedAt.Format(time.RFC3339),
			"created_at":           time.Now().Format(time.RFC3339),
			"updated_at":           time.Now().Format(time.RFC3339),
			"html_url":             "https://github.com",
		})
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)

	_, err := c.GetInstallation(context.Background(), 42)
	if !errors.Is(err, ErrInstallationSuspended) {
		t.Fatalf("expected ErrInstallationSuspended, got %v", err)
	}
}

// --- CreateInstallationToken tests ---

func TestCreateInstallationToken(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	now := time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(1 * time.Hour)

	var callCount atomic.Int32

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/app/installations/42/access_tokens" {
			t.Errorf("unexpected path: %s", r.URL.Path)
			http.NotFound(w, r)
			return
		}

		callCount.Add(1)

		// Verify request body.
		var reqBody installationTokenRequest
		if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
			t.Errorf("decode request body: %v", err)
		}

		if len(reqBody.RepositoryIDs) != 2 {
			t.Errorf("expected 2 repository IDs, got %d", len(reqBody.RepositoryIDs))
		}

		if reqBody.Permissions["contents"] != "read" {
			t.Errorf("expected contents=read permission")
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"token":                "ghs_test_token_123",
			"expires_at":           expiresAt.Format(time.RFC3339),
			"permissions":          map[string]string{"contents": "read"},
			"repository_selection": "selected",
		})
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)

	tok, err := c.CreateInstallationToken(context.Background(), 42,
		[]int64{200, 100},
		map[string]string{"contents": "read"},
	)
	if err != nil {
		t.Fatalf("CreateInstallationToken: %v", err)
	}

	if tok.Token != "ghs_test_token_123" {
		t.Errorf("Token = %q, want 'ghs_test_token_123'", tok.Token)
	}
	if tok.RepositorySelection != "selected" {
		t.Errorf("RepositorySelection = %q", tok.RepositorySelection)
	}
}

func TestCreateInstallationToken_CacheReuse(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	now := time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(1 * time.Hour)

	var callCount atomic.Int32

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/access_tokens") {
			callCount.Add(1)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"token":                "ghs_cached_token",
				"expires_at":           expiresAt.Format(time.RFC3339),
				"permissions":          map[string]string{"contents": "read"},
				"repository_selection": "all",
			})
		}
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)

	// First call.
	tok1, err := c.CreateInstallationToken(context.Background(), 42, nil, nil)
	if err != nil {
		t.Fatalf("first call: %v", err)
	}

	// Second call with same parameters should use cache.
	tok2, err := c.CreateInstallationToken(context.Background(), 42, nil, nil)
	if err != nil {
		t.Fatalf("second call: %v", err)
	}

	if tok1.Token != tok2.Token {
		t.Error("expected same cached token")
	}

	count := callCount.Load()
	if count != 1 {
		t.Errorf("expected 1 upstream call, got %d", count)
	}
}

func TestCreateInstallationToken_ConcurrentMinting(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	now := time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(1 * time.Hour)

	var callCount atomic.Int32

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/access_tokens") {
			callCount.Add(1)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"token":                "ghs_concurrent_token",
				"expires_at":           expiresAt.Format(time.RFC3339),
				"permissions":          map[string]string{},
				"repository_selection": "all",
			})
		}
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)

	// Launch many goroutines all requesting the same token.
	const concurrency = 20
	var wg sync.WaitGroup
	errs := make([]error, concurrency)
	tokens := make([]string, concurrency)

	wg.Add(concurrency)
	for i := 0; i < concurrency; i++ {
		go func(idx int) {
			defer wg.Done()
			tok, err := c.CreateInstallationToken(context.Background(), 42, nil, nil)
			errs[idx] = err
			tokens[idx] = tok.Token
		}(i)
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Errorf("goroutine %d error: %v", i, err)
		}
	}

	// All should have the same token.
	for i, tok := range tokens {
		if tok != "ghs_concurrent_token" {
			t.Errorf("goroutine %d: token = %q, want 'ghs_concurrent_token'", i, tok)
		}
	}

	// Should have made exactly 1 upstream call.
	count := callCount.Load()
	if count != 1 {
		t.Errorf("expected 1 upstream call, got %d (token storm!)", count)
	}
}

func TestCreateInstallationToken_ExpiryRefresh(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	now := time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC)
	// Token expires just 30 seconds from now (within 60s margin).
	expiresAt := now.Add(30 * time.Second)

	var callCount atomic.Int32

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/access_tokens") {
			count := callCount.Add(1)
			token := fmt.Sprintf("ghs_token_%d", count)
			// Second call returns a longer-lived token.
			exp := expiresAt
			if count > 1 {
				exp = now.Add(1 * time.Hour)
			}
			json.NewEncoder(w).Encode(map[string]interface{}{
				"token":                token,
				"expires_at":           exp.Format(time.RFC3339),
				"permissions":          map[string]string{},
				"repository_selection": "all",
			})
		}
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)

	// First call gets a short-lived token. Because expiresAt - 60s < now,
	// the next call should refresh.
	tok1, err := c.CreateInstallationToken(context.Background(), 42, nil, nil)
	if err != nil {
		t.Fatalf("first call: %v", err)
	}

	tok2, err := c.CreateInstallationToken(context.Background(), 42, nil, nil)
	if err != nil {
		t.Fatalf("second call: %v", err)
	}

	if tok1.Token == tok2.Token {
		t.Error("expected new token after near-expiry, got same")
	}

	count := callCount.Load()
	if count != 2 {
		t.Errorf("expected 2 upstream calls, got %d", count)
	}
}

// --- ListInstallationRepositories tests ---

func TestListInstallationRepositories(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	now := time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(1 * time.Hour)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/access_tokens") {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"token":                "ghs_repo_token",
				"expires_at":           expiresAt.Format(time.RFC3339),
				"permissions":          map[string]string{},
				"repository_selection": "all",
			})
			return
		}

		if r.URL.Path == "/installation/repositories" {
			page := r.URL.Query().Get("page")
			if page == "1" || page == "" {
				w.Header().Set("Link", `<`+"/installation/repositories?page=2"+`>; rel="next"`)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"total_count": 3,
					"repositories": []map[string]interface{}{
						{
							"id":             1,
							"owner":          map[string]string{"login": "org1"},
							"name":           "repo-a",
							"full_name":      "org1/repo-a",
							"default_branch": "main",
							"private":        true,
							"archived":       false,
							"disabled":       false,
							"html_url":       "https://github.com/org1/repo-a",
							"updated_at":     now.Format(time.RFC3339),
						},
						{
							"id":             2,
							"owner":          map[string]string{"login": "org1"},
							"name":           "repo-b",
							"full_name":      "org1/repo-b",
							"default_branch": "develop",
							"private":        false,
							"archived":       false,
							"disabled":       false,
							"html_url":       "https://github.com/org1/repo-b",
							"updated_at":     now.Format(time.RFC3339),
						},
					},
				})
			} else if page == "2" {
				// No Link header = last page.
				json.NewEncoder(w).Encode(map[string]interface{}{
					"total_count": 3,
					"repositories": []map[string]interface{}{
						{
							"id":             3,
							"owner":          map[string]string{"login": "org1"},
							"name":           "repo-c",
							"full_name":      "org1/repo-c",
							"default_branch": "main",
							"private":        false,
							"archived":       true,
							"disabled":       false,
							"html_url":       "https://github.com/org1/repo-c",
							"updated_at":     now.Format(time.RFC3339),
						},
					},
				})
			}
			return
		}

		http.NotFound(w, r)
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)

	// Page 1.
	page1, err := c.ListInstallationRepositories(context.Background(), 42, 1, 2)
	if err != nil {
		t.Fatalf("page 1: %v", err)
	}

	if page1.TotalCount != 3 {
		t.Errorf("TotalCount = %d, want 3", page1.TotalCount)
	}
	if len(page1.Repositories) != 2 {
		t.Fatalf("page 1 repos = %d, want 2", len(page1.Repositories))
	}
	if !page1.HasNext {
		t.Error("page 1 should have HasNext=true")
	}
	if page1.Repositories[0].Name != "repo-a" {
		t.Errorf("first repo = %q, want 'repo-a'", page1.Repositories[0].Name)
	}
	if !page1.Repositories[0].Private {
		t.Error("repo-a should be private")
	}

	// Page 2.
	page2, err := c.ListInstallationRepositories(context.Background(), 42, 2, 2)
	if err != nil {
		t.Fatalf("page 2: %v", err)
	}

	if len(page2.Repositories) != 1 {
		t.Fatalf("page 2 repos = %d, want 1", len(page2.Repositories))
	}
	if page2.HasNext {
		t.Error("page 2 should have HasNext=false")
	}
	if page2.Repositories[0].Name != "repo-c" {
		t.Errorf("third repo = %q, want 'repo-c'", page2.Repositories[0].Name)
	}
	if !page2.Repositories[0].Archived {
		t.Error("repo-c should be archived")
	}
}

// --- GetRepository tests ---

func TestGetRepository(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	now := time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(1 * time.Hour)
	pushed := time.Date(2024, 1, 14, 10, 0, 0, 0, time.UTC)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/access_tokens") {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"token":                "ghs_repo_token",
				"expires_at":           expiresAt.Format(time.RFC3339),
				"permissions":          map[string]string{},
				"repository_selection": "all",
			})
			return
		}

		if r.URL.Path == "/repos/test-org/my-repo" {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"id":             500,
				"owner":          map[string]string{"login": "test-org"},
				"name":           "my-repo",
				"full_name":      "test-org/my-repo",
				"default_branch": "main",
				"private":        true,
				"archived":       false,
				"disabled":       false,
				"html_url":       "https://github.com/test-org/my-repo",
				"pushed_at":      pushed.Format(time.RFC3339),
				"updated_at":     now.Format(time.RFC3339),
			})
			return
		}

		http.NotFound(w, r)
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)

	repo, err := c.GetRepository(context.Background(), 42, "test-org", "my-repo")
	if err != nil {
		t.Fatalf("GetRepository: %v", err)
	}

	if repo.ID != 500 {
		t.Errorf("ID = %d, want 500", repo.ID)
	}
	if repo.FullName != "test-org/my-repo" {
		t.Errorf("FullName = %q", repo.FullName)
	}
	if repo.DefaultBranch != "main" {
		t.Errorf("DefaultBranch = %q", repo.DefaultBranch)
	}
	if !repo.Private {
		t.Error("expected private=true")
	}
	if repo.PushedAt == nil {
		t.Fatal("expected PushedAt to be set")
	}
}

// --- GetCommit tests ---

func TestGetCommit(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	now := time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(1 * time.Hour)
	commitDate := time.Date(2024, 1, 14, 15, 30, 0, 0, time.UTC)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/access_tokens") {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"token":                "ghs_commit_token",
				"expires_at":           expiresAt.Format(time.RFC3339),
				"permissions":          map[string]string{},
				"repository_selection": "all",
			})
			return
		}

		// Accept refs/heads/main URL-encoded as refs%2Fheads%2Fmain.
		expectedPaths := []string{
			"/repos/test-org/my-repo/commits/refs%2Fheads%2Fmain",
			"/repos/test-org/my-repo/commits/refs/heads/main",
		}
		matched := false
		for _, ep := range expectedPaths {
			if r.URL.RawPath == ep || r.URL.Path == "/repos/test-org/my-repo/commits/refs/heads/main" {
				matched = true
				break
			}
		}
		if matched {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"sha": "abc123def456",
				"commit": map[string]interface{}{
					"message": "feat: add feature",
					"author": map[string]interface{}{
						"date": commitDate.Format(time.RFC3339),
					},
				},
				"author": map[string]interface{}{
					"login": "dev-user",
				},
			})
			return
		}

		t.Logf("unexpected path: %s (raw: %s)", r.URL.Path, r.URL.RawPath)
		http.NotFound(w, r)
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)

	commit, err := c.GetCommit(context.Background(), 42, "test-org", "my-repo", "refs/heads/main")
	if err != nil {
		t.Fatalf("GetCommit: %v", err)
	}

	if commit.SHA != "abc123def456" {
		t.Errorf("SHA = %q, want 'abc123def456'", commit.SHA)
	}
	if commit.Ref != "refs/heads/main" {
		t.Errorf("Ref = %q", commit.Ref)
	}
	if commit.Message != "feat: add feature" {
		t.Errorf("Message = %q", commit.Message)
	}
	if commit.AuthorLogin != "dev-user" {
		t.Errorf("AuthorLogin = %q", commit.AuthorLogin)
	}
}

func TestGetCommit_BranchName(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	now := time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(1 * time.Hour)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/access_tokens") {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"token":                "ghs_commit_token",
				"expires_at":           expiresAt.Format(time.RFC3339),
				"permissions":          map[string]string{},
				"repository_selection": "all",
			})
			return
		}

		if r.URL.Path == "/repos/org/repo/commits/main" {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"sha": "deadbeef",
				"commit": map[string]interface{}{
					"message": "test",
					"author":  map[string]interface{}{"date": now.Format(time.RFC3339)},
				},
				"author": map[string]interface{}{"login": "user"},
			})
			return
		}

		http.NotFound(w, r)
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)

	commit, err := c.GetCommit(context.Background(), 42, "org", "repo", "main")
	if err != nil {
		t.Fatalf("GetCommit: %v", err)
	}

	if commit.SHA != "deadbeef" {
		t.Errorf("SHA = %q, want 'deadbeef'", commit.SHA)
	}
}

// --- Retry tests ---

func TestRetry_500ThenSuccess(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	now := time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(1 * time.Hour)

	var callCount atomic.Int32

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/access_tokens") {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"token":                "ghs_token",
				"expires_at":           expiresAt.Format(time.RFC3339),
				"permissions":          map[string]string{},
				"repository_selection": "all",
			})
			return
		}

		if r.URL.Path == "/repos/org/repo" {
			count := callCount.Add(1)
			if count <= 2 {
				w.WriteHeader(500)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"message": "Internal Server Error",
				})
				return
			}
			json.NewEncoder(w).Encode(map[string]interface{}{
				"id":             1,
				"owner":          map[string]string{"login": "org"},
				"name":           "repo",
				"full_name":      "org/repo",
				"default_branch": "main",
				"private":        false,
				"archived":       false,
				"disabled":       false,
				"html_url":       "https://github.com/org/repo",
				"updated_at":     now.Format(time.RFC3339),
			})
			return
		}

		http.NotFound(w, r)
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)

	repo, err := c.GetRepository(context.Background(), 42, "org", "repo")
	if err != nil {
		t.Fatalf("expected success after retries, got %v", err)
	}

	if repo.FullName != "org/repo" {
		t.Errorf("FullName = %q", repo.FullName)
	}

	count := callCount.Load()
	if count != 3 {
		t.Errorf("expected 3 calls (2 failures + 1 success), got %d", count)
	}
}

func TestRetry_429WithRetryAfter(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	now := time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(1 * time.Hour)

	var callCount atomic.Int32
	var sleepDurations []time.Duration
	var sleepMu sync.Mutex

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/access_tokens") {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"token":                "ghs_token",
				"expires_at":           expiresAt.Format(time.RFC3339),
				"permissions":          map[string]string{},
				"repository_selection": "all",
			})
			return
		}

		if r.URL.Path == "/repos/org/repo" {
			count := callCount.Add(1)
			if count == 1 {
				w.Header().Set("Retry-After", "5")
				w.WriteHeader(429)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"message": "API rate limit exceeded",
				})
				return
			}
			json.NewEncoder(w).Encode(map[string]interface{}{
				"id":             1,
				"owner":          map[string]string{"login": "org"},
				"name":           "repo",
				"full_name":      "org/repo",
				"default_branch": "main",
				"private":        false,
				"archived":       false,
				"disabled":       false,
				"html_url":       "https://github.com/org/repo",
				"updated_at":     now.Format(time.RFC3339),
			})
			return
		}

		http.NotFound(w, r)
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)
	c.sleeper = func(d time.Duration) {
		sleepMu.Lock()
		sleepDurations = append(sleepDurations, d)
		sleepMu.Unlock()
	}

	repo, err := c.GetRepository(context.Background(), 42, "org", "repo")
	if err != nil {
		t.Fatalf("expected success after 429 retry, got %v", err)
	}

	if repo.FullName != "org/repo" {
		t.Errorf("FullName = %q", repo.FullName)
	}

	// Verify Retry-After was honored (sleep >= 5 seconds).
	sleepMu.Lock()
	defer sleepMu.Unlock()
	if len(sleepDurations) == 0 {
		t.Fatal("expected at least one sleep call")
	}
	if sleepDurations[0] < 5*time.Second {
		t.Errorf("sleep duration = %v, want >= 5s (Retry-After)", sleepDurations[0])
	}
}

func TestNoRetry_401(t *testing.T) {
	_, keyPEM := generateTestKey(t)

	var callCount atomic.Int32

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount.Add(1)
		w.Header().Set("X-GitHub-Request-Id", "req-401")
		w.WriteHeader(401)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Bad credentials",
		})
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)

	_, err := c.GetInstallation(context.Background(), 42)
	if err == nil {
		t.Fatal("expected error on 401")
	}

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected APIError, got %T: %v", err, err)
	}
	if apiErr.Status != 401 {
		t.Errorf("status = %d, want 401", apiErr.Status)
	}

	// Should NOT have retried.
	count := callCount.Load()
	if count != 1 {
		t.Errorf("expected 1 call (no retry on 401), got %d", count)
	}
}

func TestRetry_RateLimited403(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	now := time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC)

	var callCount atomic.Int32

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := callCount.Add(1)
		if count <= 2 {
			w.Header().Set("Retry-After", "1")
			w.Header().Set("X-GitHub-Request-Id", "req-rl")
			w.WriteHeader(403)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"message": "API rate limit exceeded for installation",
			})
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id": 42,
			"account": map[string]interface{}{
				"id":    100,
				"login": "org",
				"type":  "Organization",
			},
			"repository_selection": "all",
			"permissions":          map[string]string{},
			"created_at":           now.Format(time.RFC3339),
			"updated_at":           now.Format(time.RFC3339),
			"html_url":             "https://github.com",
		})
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)

	inst, err := c.GetInstallation(context.Background(), 42)
	if err != nil {
		t.Fatalf("expected success after rate-limit retries, got %v", err)
	}

	if inst.ID != 42 {
		t.Errorf("ID = %d, want 42", inst.ID)
	}

	count := callCount.Load()
	if count != 3 {
		t.Errorf("expected 3 calls, got %d", count)
	}
}

// --- Context cancellation tests ---

func TestContextCancellation(t *testing.T) {
	_, keyPEM := generateTestKey(t)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Slow response, but context will be cancelled.
		time.Sleep(5 * time.Second)
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)
	// Use real sleeper so context cancellation fires before sleep finishes.
	c.sleeper = func(d time.Duration) { time.Sleep(d) }

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately.

	_, err := c.GetInstallation(ctx, 42)
	if err == nil {
		t.Fatal("expected error on cancelled context")
	}
	if !errors.Is(err, context.Canceled) {
		t.Logf("error: %v", err)
		// The error might wrap context.Canceled inside an http error.
		if !strings.Contains(err.Error(), "cancel") && !strings.Contains(err.Error(), "context") {
			t.Errorf("expected context cancellation error, got: %v", err)
		}
	}
}

// --- Redaction tests ---

func TestRedaction_ErrorsDoNotContainTokens(t *testing.T) {
	_, keyPEM := generateTestKey(t)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-GitHub-Request-Id", "req-redact")
		w.WriteHeader(401)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Bad credentials for token ghs_abc123xyz and Bearer eyJhbGciOiJS",
		})
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)

	_, err := c.GetInstallation(context.Background(), 42)
	if err == nil {
		t.Fatal("expected error")
	}

	errStr := err.Error()
	if strings.Contains(errStr, "ghs_abc123xyz") {
		t.Errorf("error contains unredacted token: %s", errStr)
	}
	if strings.Contains(errStr, "eyJhbGciOiJS") {
		t.Errorf("error contains unredacted JWT: %s", errStr)
	}
}

func TestRedaction_APIErrorMessageRedacted(t *testing.T) {
	msg := "Bad credentials for token ghs_secrettoken"
	redacted := redactTokens(msg)
	if strings.Contains(redacted, "ghs_secrettoken") {
		t.Errorf("token not redacted: %s", redacted)
	}
	if !strings.Contains(redacted, "[REDACTED]") {
		t.Errorf("expected [REDACTED] in output: %s", redacted)
	}
}

// --- Error type tests ---

func TestAPIError_NotFound(t *testing.T) {
	apiErr := &APIError{Status: 404, Message: "Not Found"}
	if !errors.Is(apiErr, ErrNotFound) {
		t.Error("expected APIError(404) to unwrap to ErrNotFound")
	}
}

func TestAPIError_RateLimited429(t *testing.T) {
	apiErr := &APIError{Status: 429, Message: "Rate limited"}
	if !errors.Is(apiErr, ErrRateLimited) {
		t.Error("expected APIError(429) to unwrap to ErrRateLimited")
	}
}

func TestAPIError_RateLimited403(t *testing.T) {
	apiErr := &APIError{Status: 403, Message: "Rate limited", RetryAfter: 10 * time.Second}
	if !errors.Is(apiErr, ErrRateLimited) {
		t.Error("expected APIError(403+RetryAfter) to unwrap to ErrRateLimited")
	}
}

func TestAPIError_PermissionDenied(t *testing.T) {
	apiErr := &APIError{Status: 403, Message: "Permission denied"}
	if !errors.Is(apiErr, ErrPermissionDenied) {
		t.Error("expected APIError(403) to unwrap to ErrPermissionDenied")
	}
}

// --- Header assertion helpers ---

func assertHeaders(t *testing.T, r *http.Request) {
	t.Helper()

	if got := r.Header.Get("Accept"); got != "application/vnd.github+json" {
		t.Errorf("Accept = %q, want 'application/vnd.github+json'", got)
	}
	if got := r.Header.Get("X-GitHub-Api-Version"); got != "2022-11-28" {
		t.Errorf("X-GitHub-Api-Version = %q, want '2022-11-28'", got)
	}
	if got := r.Header.Get("User-Agent"); got != "summit-test" {
		t.Errorf("User-Agent = %q, want 'summit-test'", got)
	}
	if got := r.Header.Get("Authorization"); got == "" {
		t.Error("Authorization header is empty")
	}
}

// --- Token cache key tests ---

func TestTokenCacheKey(t *testing.T) {
	k1 := tokenCacheKey(42, []int64{200, 100}, map[string]string{"contents": "read", "metadata": "read"})
	k2 := tokenCacheKey(42, []int64{100, 200}, map[string]string{"metadata": "read", "contents": "read"})

	if k1 != k2 {
		t.Errorf("cache keys should be equal for same params in different order:\n  %s\n  %s", k1, k2)
	}

	k3 := tokenCacheKey(43, []int64{100, 200}, map[string]string{"metadata": "read", "contents": "read"})
	if k1 == k3 {
		t.Error("cache keys should differ for different installation IDs")
	}
}

// --- Response size limit test ---

func TestResponseSizeLimit(t *testing.T) {
	_, keyPEM := generateTestKey(t)

	// Generate a response larger than our limit.
	bigPayload := strings.Repeat("x", 1024)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(bigPayload))
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)
	c.maxRespBytes = 100 // Set very low limit.

	_, err := c.GetInstallation(context.Background(), 42)
	if err == nil {
		t.Fatal("expected error for oversized response")
	}
	if !strings.Contains(err.Error(), "exceeds") {
		t.Errorf("expected size limit error, got: %v", err)
	}
}

// --- Defaults test ---

func TestNew_Defaults(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	c, err := New(Config{
		AppID:         1,
		PrivateKeyPEM: keyPEM,
		BaseURL:       "https://api.github.com",
		Sleeper:       noopSleeper,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if c.apiVersion != "2022-11-28" {
		t.Errorf("apiVersion = %q, want '2022-11-28'", c.apiVersion)
	}
	if c.maxRetries != 3 {
		t.Errorf("maxRetries = %d, want 3", c.maxRetries)
	}
	if c.maxRespBytes != 10*1024*1024 {
		t.Errorf("maxRespBytes = %d, want 10MiB", c.maxRespBytes)
	}
}

// --- NotFound test ---

func TestGetRepository_NotFound(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	now := time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(1 * time.Hour)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/access_tokens") {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"token":                "ghs_token",
				"expires_at":           expiresAt.Format(time.RFC3339),
				"permissions":          map[string]string{},
				"repository_selection": "all",
			})
			return
		}

		w.Header().Set("X-GitHub-Request-Id", "req-404")
		w.WriteHeader(404)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Not Found",
		})
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)

	_, err := c.GetRepository(context.Background(), 42, "org", "nonexistent")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

// --- Verify JWT iat/exp bounds ---

func TestGenerateAppJWT_TimeBounds(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	now := time.Date(2024, 6, 1, 12, 0, 0, 0, time.UTC)

	srv := httptest.NewServer(http.NotFoundHandler())
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)
	c.clock = fixedClock(now)
	// Clear cached JWT so we get a fresh one.
	c.jwt.token = ""

	jwt, err := c.GenerateAppJWT()
	if err != nil {
		t.Fatalf("GenerateAppJWT: %v", err)
	}

	parts := strings.Split(jwt, ".")
	claimsJSON, _ := base64.RawURLEncoding.DecodeString(parts[1])
	var claims struct {
		IAT *big.Int `json:"iat"`
		EXP *big.Int `json:"exp"`
	}
	json.Unmarshal(claimsJSON, &claims)

	iat := claims.IAT.Int64()
	exp := claims.EXP.Int64()

	expectedIAT := now.Add(-60 * time.Second).Unix()
	expectedEXP := now.Add(9 * time.Minute).Unix()

	if iat != expectedIAT {
		t.Errorf("iat = %d, want %d", iat, expectedIAT)
	}
	if exp != expectedEXP {
		t.Errorf("exp = %d, want %d", exp, expectedEXP)
	}

	// Verify exp - iat <= 10 minutes (within GitHub's limits).
	diff := exp - iat
	if diff > 600 {
		t.Errorf("JWT lifetime = %ds, exceeds GitHub's 10 minute limit", diff)
	}
}

// --- PerPage capping ---

func TestListInstallationRepositories_PerPageCap(t *testing.T) {
	_, keyPEM := generateTestKey(t)
	now := time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(1 * time.Hour)

	var capturedPerPage string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/access_tokens") {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"token":                "ghs_token",
				"expires_at":           expiresAt.Format(time.RFC3339),
				"permissions":          map[string]string{},
				"repository_selection": "all",
			})
			return
		}

		if r.URL.Path == "/installation/repositories" {
			capturedPerPage = r.URL.Query().Get("per_page")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"total_count":  0,
				"repositories": []interface{}{},
			})
			return
		}
		http.NotFound(w, r)
	}))
	defer srv.Close()

	c := newTestClient(t, srv, keyPEM)

	// Request 200 per page, should be capped to 100.
	_, err := c.ListInstallationRepositories(context.Background(), 42, 1, 200)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if capturedPerPage != "100" {
		t.Errorf("per_page = %q, want '100'", capturedPerPage)
	}
}
