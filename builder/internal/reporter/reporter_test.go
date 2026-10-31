package reporter

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/summit/builder/internal/protocol"
)

func TestHTTPReporter_ReportStatusAndResult(t *testing.T) {
	var statusCalls int32
	var resultCalls int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/api/v1/builds/build-1/status":
			atomic.AddInt32(&statusCalls, 1)
			w.WriteHeader(http.StatusOK)
		case r.URL.Path == "/api/v1/builds/build-1/result":
			atomic.AddInt32(&resultCalls, 1)
			w.WriteHeader(http.StatusOK)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	reporter := NewHTTPReporter(server.URL+"/api/v1/builds", "test-token", server.Client())
	ctx := context.Background()

	update := protocol.NewStatusUpdate("build-1", "attempt-1", 1, protocol.StageInitializing, protocol.StageStatusRunning, "started")
	if err := reporter.ReportStatus(ctx, update); err != nil {
		t.Fatalf("reporting status: %v", err)
	}

	result := protocol.BuildExecutionResult{
		SchemaVersion: 1,
		BuildID:       "build-1",
		AttemptID:     "attempt-1",
		Status:        protocol.StatusSucceeded,
		Metadata: protocol.ResultMetadata{
			Builder:   "railpack",
			CommitSHA: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1f",
		},
		Timestamps: protocol.ResultTimestamps{
			StartedAt:   time.Now().Add(-10 * time.Second),
			CompletedAt: time.Now(),
			DurationMS:  10000,
		},
	}

	if err := reporter.ReportResult(ctx, result); err != nil {
		t.Fatalf("reporting result: %v", err)
	}

	if atomic.LoadInt32(&statusCalls) != 1 {
		t.Errorf("expected 1 status call, got %d", statusCalls)
	}
	if atomic.LoadInt32(&resultCalls) != 1 {
		t.Errorf("expected 1 result call, got %d", resultCalls)
	}
}

func TestHTTPReporter_LogBatching(t *testing.T) {
	var receivedLogs []protocol.LogEvent

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/builds/build-1/logs" {
			_ = json.NewDecoder(r.Body).Decode(&receivedLogs)
			w.WriteHeader(http.StatusOK)
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	reporter := NewHTTPReporter(server.URL+"/api/v1/builds", "test-token", server.Client())
	ctx := context.Background()

	ev1 := protocol.NewLogEvent("build-1", "attempt-1", 1, protocol.StreamStdout, "image_build", protocol.SeverityInfo, "step 1")
	ev2 := protocol.NewLogEvent("build-1", "attempt-1", 2, protocol.StreamStdout, "image_build", protocol.SeverityInfo, "step 2")

	_ = reporter.ReportLog(ctx, ev1)
	_ = reporter.ReportLog(ctx, ev2)

	if err := reporter.Flush(ctx); err != nil {
		t.Fatalf("flush error: %v", err)
	}

	if len(receivedLogs) != 2 {
		t.Errorf("expected 2 received logs, got %d", len(receivedLogs))
	}
}
