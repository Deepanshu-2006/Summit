package main

import (
	"context"
	"io"
	"log/slog"
	"strings"
	"testing"
	"time"
)

func TestRun_GracefulShutdown(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	ctx, cancel := context.WithCancel(context.Background())

	errCh := make(chan error, 1)
	go func() {
		errCh <- run(ctx, logger)
	}()

	// Signal graceful cancellation
	time.Sleep(30 * time.Millisecond)
	cancel()

	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("expected run to exit cleanly on cancel, got: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for run to exit")
	}
}

func TestRun_ProductionValidation_MissingDB(t *testing.T) {
	t.Setenv("ENVIRONMENT", "production")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("WORKER_JWT_SECRET", strings.Repeat("s", 32))

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	err := run(context.Background(), logger)
	if err == nil {
		t.Fatalf("expected error in production when DATABASE_URL is missing, got nil")
	}
	if !strings.Contains(err.Error(), "DATABASE_URL is required") {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestRun_ProductionValidation_ShortJWTSecret(t *testing.T) {
	t.Setenv("ENVIRONMENT", "production")
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/summit?sslmode=disable")
	t.Setenv("WORKER_JWT_SECRET", "too-short")

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	err := run(context.Background(), logger)
	if err == nil {
		t.Fatalf("expected error in production when WORKER_JWT_SECRET is short, got nil")
	}
	if !strings.Contains(err.Error(), "WORKER_JWT_SECRET") {
		t.Fatalf("unexpected error message: %v", err)
	}
}

func TestRun_MockClusterTarget(t *testing.T) {
	t.Setenv("ENVIRONMENT", "test")
	t.Setenv("ORCHESTRATOR_CLUSTER_TARGET", "mock")

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	ctx, cancel := context.WithCancel(context.Background())

	errCh := make(chan error, 1)
	go func() {
		errCh <- run(ctx, logger)
	}()

	time.Sleep(30 * time.Millisecond)
	cancel()

	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("expected clean shutdown in mock mode, got: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for run to exit")
	}
}
