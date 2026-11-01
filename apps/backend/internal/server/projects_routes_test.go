package server

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/summit/backend/internal/auth"
	"github.com/summit/backend/internal/config"
	"github.com/summit/backend/internal/testutil"
)

type fakeVerifier struct{ p auth.Principal }

func (v fakeVerifier) Verify(_ context.Context, token string) (auth.Principal, error) {
	if token != "good" {
		return auth.Principal{}, fmt.Errorf("bad token")
	}
	return v.p, nil
}

// Without a database the project routes are not registered at all (404).
func TestServer_ProjectRoutesNeedPool(t *testing.T) {
	srv := New(Dependencies{Config: &config.Config{Port: "0"}, Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	rec := httptest.NewRecorder()
	srv.httpServer.Handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/projects", nil))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("GET /v1/projects without pool = %d, want 404", rec.Code)
	}
}

// With a pool the routes are wired behind auth.
func TestServer_ProjectRoutesRegistered(t *testing.T) {
	pool := testutil.NewDB(t)
	u := testutil.SeedUser(t, pool, "", "")
	srv := New(Dependencies{
		Config:   &config.Config{Port: "0"},
		Logger:   slog.New(slog.NewTextHandler(io.Discard, nil)),
		Pool:     pool,
		Verifier: fakeVerifier{p: auth.Principal{UserID: u.ID, Email: u.Email, Name: u.Name}},
	})
	for _, route := range []struct{ method, path string }{
		{"GET", "/v1/projects"}, {"POST", "/v1/projects"}, {"GET", "/v1/deployments/00000000-0000-0000-0000-000000000000"},
	} {
		rec := httptest.NewRecorder()
		srv.httpServer.Handler.ServeHTTP(rec, httptest.NewRequest(route.method, route.path, nil))
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s %s without token = %d, want 401", route.method, route.path, rec.Code)
		}
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/projects", nil)
	req.Header.Set("Authorization", "Bearer good")
	rec := httptest.NewRecorder()
	srv.httpServer.Handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /v1/projects with token = %d: %s", rec.Code, rec.Body.String())
	}
}
