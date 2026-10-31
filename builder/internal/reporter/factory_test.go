package reporter

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/summit/builder/internal/protocol"
)

func discardLogger() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

func TestNew_UsesTrimmedTokenFileAsBearer(t *testing.T) {
	const jwt = "aaa.bbb.ccc"
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	tokenFile := filepath.Join(t.TempDir(), "token")
	if err := os.WriteFile(tokenFile, []byte(jwt+"\n"), 0o400); err != nil {
		t.Fatal(err)
	}

	rep, err := New(srv.URL+"/internal/v1/builds", tokenFile, srv.Client(), discardLogger())
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := rep.(*HTTPReporter); !ok {
		t.Fatalf("expected HTTPReporter, got %T", rep)
	}
	upd := protocol.NewStatusUpdate("b1", "a1", 1, protocol.StageInitializing, protocol.StageStatusRunning, "x")
	if err := rep.ReportStatus(context.Background(), upd); err != nil {
		t.Fatal(err)
	}
	if gotAuth != "Bearer "+jwt {
		t.Errorf("Authorization = %q, want Bearer %s (not the spec token_ref)", gotAuth, jwt)
	}
}

func TestNew_EmptyEndpointFallsBackToMemory(t *testing.T) {
	rep, err := New("", "", nil, discardLogger())
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := rep.(*MemoryReporter); !ok {
		t.Fatalf("expected MemoryReporter, got %T", rep)
	}
}

func TestNew_TokenFileErrors(t *testing.T) {
	dir := t.TempDir()
	if _, err := New("http://x", filepath.Join(dir, "missing"), nil, discardLogger()); err == nil {
		t.Error("expected error for missing token file")
	}
	empty := filepath.Join(dir, "empty")
	_ = os.WriteFile(empty, []byte(" \n"), 0o400)
	if _, err := New("http://x", empty, nil, discardLogger()); err == nil {
		t.Error("expected error for empty token file")
	}
}

func TestHTTPReporter_RetryResendsBody(t *testing.T) {
	var calls int32
	var lastBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		lastBody = string(b)
		if atomic.AddInt32(&calls, 1) == 1 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	rep := NewHTTPReporter(srv.URL, "t", srv.Client())
	upd := protocol.NewStatusUpdate("b1", "a1", 7, protocol.StageImageBuild, protocol.StageStatusRunning, "building")
	if err := rep.ReportStatus(context.Background(), upd); err != nil {
		t.Fatal(err)
	}
	if calls != 2 || !strings.Contains(lastBody, `"build_id":"b1"`) {
		t.Errorf("calls=%d lastBody=%q (retry must resend the body)", calls, lastBody)
	}
}
