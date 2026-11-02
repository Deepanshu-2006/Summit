package db

import (
	"context"
	"testing"
	"time"
)

// An unreachable database must be retried, then reported as an error (never a nil pool).
func TestOpenWithRetryGivesUpOnUnreachableDB(t *testing.T) {
	// Port 1 on localhost refuses connections immediately.
	url := "postgres://u:p@127.0.0.1:1/db?sslmode=disable&connect_timeout=1"
	attempts := 0
	start := time.Now()
	pool, err := OpenWithRetry(context.Background(), url, 2500*time.Millisecond, time.Second, func(int, error) { attempts++ })
	if err == nil || pool != nil {
		t.Fatalf("want error and nil pool, got pool=%v err=%v", pool, err)
	}
	if attempts < 2 {
		t.Fatalf("want at least 2 attempts, got %d", attempts)
	}
	if elapsed := time.Since(start); elapsed > 6*time.Second {
		t.Fatalf("retry overran maxWait: %s", elapsed)
	}
}

func TestOpenWithRetryFailsFastOnInvalidURL(t *testing.T) {
	attempts := 0
	if _, err := OpenWithRetry(context.Background(), "", time.Minute, time.Second, func(int, error) { attempts++ }); err == nil {
		t.Fatal("want error for empty URL")
	}
	if attempts != 0 {
		t.Fatalf("invalid URL must not retry, got %d attempts", attempts)
	}
}

func TestOpenWithRetryStopsOnCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	url := "postgres://u:p@127.0.0.1:1/db?sslmode=disable&connect_timeout=1"
	if _, err := OpenWithRetry(ctx, url, time.Minute, time.Second, nil); err == nil {
		t.Fatal("want error when context is cancelled")
	}
}
