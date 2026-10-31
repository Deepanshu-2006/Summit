package githubapi_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/auth"
	"github.com/summit/backend/internal/config"
	"github.com/summit/backend/internal/githubapi"
)

type dummyPool struct {
	githubapi.Pool
}

func TestUnit_RoutesRegistered(t *testing.T) {
	mux := http.NewServeMux()
	cfg := &config.Config{
		GitHubAppSlug:           "test-app",
		GitHubStateTTL:          10 * time.Minute,
		PlatformFrontendBaseURL: "http://localhost:3000",
	}
	svc := githubapi.NewService(githubapi.Config{
		AppCfg: cfg,
	})

	verifier := &staticVerifier{
		principals: map[string]auth.Principal{
			"valid-token": {UserID: uuid.New(), Email: "user@example.com"},
		},
	}

	handler := githubapi.NewHandler(svc, verifier, nil)
	handler.RegisterRoutes(mux)

	// Callback route is publicly available without Bearer token
	req := httptest.NewRequest(http.MethodGet, "/v1/integrations/github/callback?installation_id=123", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	// Expect redirect (302) even without DB because state is empty/invalid
	if rec.Code != http.StatusFound {
		t.Fatalf("expected callback to redirect with 302, got %d", rec.Code)
	}

	loc := rec.Header().Get("Location")
	if loc == "" {
		t.Fatal("expected non-empty Location header")
	}

	// Protected routes require Authorization header
	protectedReq := httptest.NewRequest(http.MethodPost, "/v1/github/installations", nil)
	recProtected := httptest.NewRecorder()
	mux.ServeHTTP(recProtected, protectedReq)

	if recProtected.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for unauthenticated request, got %d", recProtected.Code)
	}
}

func TestUnit_CallbackInvalidRedirect(t *testing.T) {
	cfg := &config.Config{
		PlatformFrontendBaseURL: "https://console.summit.example.com",
	}
	svc := githubapi.NewService(githubapi.Config{
		AppCfg: cfg,
	})

	// Missing state parameter
	redirectURL, err := svc.HandleCallback(context.Background(), "123", "", "install", "127.0.0.1", "test-agent", "req-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expectedPrefix := "https://console.summit.example.com/settings/github/callback?error_code=GITHUB_INSTALLATION_STATE_INVALID&status=error"
	if redirectURL != expectedPrefix {
		t.Fatalf("expected %s, got %s", expectedPrefix, redirectURL)
	}
}
