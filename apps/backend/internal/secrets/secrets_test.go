package secrets

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestEnvProvider_Get(t *testing.T) {
	os.Setenv("TEST_SECRET_VALUE", "my-secret-123")
	defer os.Unsetenv("TEST_SECRET_VALUE")

	p := NewEnvProvider()
	val, err := p.Get(context.Background(), "TEST_SECRET_VALUE")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(val) != "my-secret-123" {
		t.Errorf("expected my-secret-123, got %s", string(val))
	}
}

func TestEnvProvider_Get_Missing(t *testing.T) {
	os.Unsetenv("NONEXISTENT_SECRET_VAR")
	p := NewEnvProvider()
	_, err := p.Get(context.Background(), "NONEXISTENT_SECRET_VAR")
	if err == nil {
		t.Error("expected error for missing env var")
	}
}

func TestNormalizeKV2Path(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"secret/my-app/github-key", "secret/data/my-app/github-key"},
		{"secret/data/my-app/github-key", "secret/data/my-app/github-key"},
		{"/secret/my-app/key", "secret/data/my-app/key"},
		{"secret/data", "secret/data"},
		{"single", "single"},
	}
	for _, tt := range tests {
		got := normalizeKV2Path(tt.input)
		if got != tt.want {
			t.Errorf("normalizeKV2Path(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestOpenBaoProvider_Get(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Vault-Token") != "test-token" {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		if r.URL.Path == "/v1/secret/data/my-app/private-key" {
			resp := map[string]interface{}{
				"data": map[string]interface{}{
					"data": map[string]interface{}{
						"value": "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----",
					},
				},
			}
			json.NewEncoder(w).Encode(resp)
			return
		}
		if r.URL.Path == "/v1/secret/data/my-app/multi-field" {
			resp := map[string]interface{}{
				"data": map[string]interface{}{
					"data": map[string]interface{}{
						"key1": "val1",
						"key2": "val2",
					},
				},
			}
			json.NewEncoder(w).Encode(resp)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	p := &OpenBaoProvider{
		addr:       server.URL,
		token:      "test-token",
		httpClient: server.Client(),
	}

	// Test single value field
	val, err := p.Get(context.Background(), "secret/my-app/private-key")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----"
	if string(val) != expected {
		t.Errorf("expected private key, got %s", string(val))
	}

	// Test multi-field (no "value" key) returns JSON
	val, err = p.Get(context.Background(), "secret/my-app/multi-field")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	var data map[string]string
	if err := json.Unmarshal(val, &data); err != nil {
		t.Fatalf("expected JSON output: %v", err)
	}
	if data["key1"] != "val1" || data["key2"] != "val2" {
		t.Errorf("unexpected data: %v", data)
	}

	// Test not found
	_, err = p.Get(context.Background(), "secret/nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent path")
	}
}

func TestOpenBaoProvider_AppRoleLogin(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/auth/approle/login" && r.Method == http.MethodPost {
			resp := map[string]interface{}{
				"auth": map[string]interface{}{
					"client_token": "new-token-from-approle",
				},
			}
			json.NewEncoder(w).Encode(resp)
			return
		}
		if r.URL.Path == "/v1/secret/data/test" {
			if r.Header.Get("X-Vault-Token") == "new-token-from-approle" {
				resp := map[string]interface{}{
					"data": map[string]interface{}{
						"data": map[string]interface{}{
							"value": "secret-via-approle",
						},
					},
				}
				json.NewEncoder(w).Encode(resp)
				return
			}
			w.WriteHeader(http.StatusForbidden)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	os.Setenv("OPENBAO_ROLE_ID", "test-role-id")
	os.Setenv("OPENBAO_SECRET_ID", "test-secret-id")
	defer func() {
		os.Unsetenv("OPENBAO_ROLE_ID")
		os.Unsetenv("OPENBAO_SECRET_ID")
	}()

	p, err := NewOpenBaoProvider(server.URL, "", "")
	if err != nil {
		t.Fatalf("unexpected error creating provider: %v", err)
	}

	val, err := p.Get(context.Background(), "secret/test")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(val) != "secret-via-approle" {
		t.Errorf("expected secret-via-approle, got %s", string(val))
	}
}

func TestRouter_EnvFallback(t *testing.T) {
	os.Setenv("GITHUB_APP_PRIVATE_KEY", "test-private-key")
	os.Setenv("GITHUB_WEBHOOK_SECRET", "test-webhook-secret")
	defer func() {
		os.Unsetenv("GITHUB_APP_PRIVATE_KEY")
		os.Unsetenv("GITHUB_WEBHOOK_SECRET")
	}()

	r := NewRouter(RouterConfig{
		Env:              NewEnvProvider(),
		AllowEnvFallback: true,
	})

	val, err := r.Get(context.Background(), PathGitHubAppPrivateKey)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(val) != "test-private-key" {
		t.Errorf("expected test-private-key, got %s", string(val))
	}

	val, err = r.Get(context.Background(), PathGitHubWebhookSecret)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(val) != "test-webhook-secret" {
		t.Errorf("expected test-webhook-secret, got %s", string(val))
	}
}

func TestRouter_OpenBaoPreferred(t *testing.T) {
	// Create a mock OpenBao server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"data": map[string]interface{}{
				"data": map[string]interface{}{
					"value": "openbao-secret-value",
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	obProvider := &OpenBaoProvider{
		addr:       server.URL,
		token:      "test-token",
		httpClient: server.Client(),
	}

	// Set env var too - should be ignored because OpenBao is preferred
	os.Setenv("GITHUB_APP_PRIVATE_KEY", "env-value-should-not-be-used")
	defer os.Unsetenv("GITHUB_APP_PRIVATE_KEY")

	r := NewRouter(RouterConfig{
		OpenBao:                     obProvider,
		Env:                         NewEnvProvider(),
		AllowEnvFallback:            true,
		GitHubPrivateKeyOpenBaoPath: "secret/github/private-key",
	})

	val, err := r.Get(context.Background(), PathGitHubAppPrivateKey)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(val) != "openbao-secret-value" {
		t.Errorf("expected openbao-secret-value, got %s", string(val))
	}
}

func TestRouter_NoRoute(t *testing.T) {
	r := NewRouter(RouterConfig{
		AllowEnvFallback: false,
	})

	_, err := r.Get(context.Background(), "unknown/path")
	if err == nil {
		t.Error("expected error for unknown path")
	}
	_ = fmt.Sprintf("%v", err) // ensure error is printable
}
