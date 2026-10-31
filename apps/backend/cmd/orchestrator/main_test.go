package main

import (
	"context"
	"io"
	"log/slog"
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
