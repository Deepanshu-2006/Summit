package server

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/summit/backend/internal/config"
	"github.com/summit/backend/internal/health"
)

func TestServer_HealthRoutes(t *testing.T) {
	cfg := &config.Config{
		Port:           "0",
		ServiceName:    "test-service",
		ServiceVersion: "1.0.0",
		Region:         "test-region",
		EdgeRouting:    "anycast",
		Environment:    "test",
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	srv := New(Dependencies{
		Config: cfg,
		Logger: logger,
	})

	if srv == nil {
		t.Fatal("expected server to be created")
	}

	routes := []string{"/health", "/api/v1/health"}
	for _, route := range routes {
		req := httptest.NewRequest(http.MethodGet, route, nil)
		rec := httptest.NewRecorder()
		srv.httpServer.Handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("route %s returned status %d, want 200", route, rec.Code)
		}

		var resp health.Response
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("route %s returned invalid json: %v", route, err)
		}
		if resp.Status != "healthy" {
			t.Errorf("route %s expected status healthy, got %s", route, resp.Status)
		}
		if resp.Service != "test-service" {
			t.Errorf("route %s expected service test-service, got %s", route, resp.Service)
		}
	}
}
