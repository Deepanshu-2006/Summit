package db

import (
	"context"
	"os"
	"testing"
	"time"
)

func TestDB_Open_And_Migrate_And_Status(t *testing.T) {
	testDBURL := os.Getenv("TEST_DATABASE_URL")
	if testDBURL == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping db test")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := Open(ctx, testDBURL)
	if err != nil {
		t.Fatalf("failed to open database pool: %v", err)
	}
	defer pool.Close()

	// Run migration
	if err := Migrate(ctx, pool); err != nil {
		t.Fatalf("failed to run migrations: %v", err)
	}

	// Check status
	statuses, err := Status(ctx, pool)
	if err != nil {
		t.Fatalf("failed to retrieve migration status: %v", err)
	}

	if len(statuses) < 4 {
		t.Fatalf("expected at least 4 migrations, got %d", len(statuses))
	}

	for _, s := range statuses {
		if !s.Applied {
			t.Errorf("expected migration %s to be applied", s.Version)
		}
		if s.AppliedAt == nil {
			t.Errorf("expected migration %s to have an applied timestamp", s.Version)
		}
	}
}

func TestDB_Open_EmptyURL(t *testing.T) {
	ctx := context.Background()
	_, err := Open(ctx, "")
	if err == nil {
		t.Error("expected error when opening with empty URL, got nil")
	}
}

func TestPing(t *testing.T) {
	if err := Ping(context.Background(), nil, time.Second); err == nil {
		t.Error("expected error for nil pool")
	}

	testDBURL := os.Getenv("TEST_DATABASE_URL")
	if testDBURL == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping db ping test")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := Open(ctx, testDBURL)
	if err != nil {
		t.Fatalf("failed to open database pool: %v", err)
	}
	defer pool.Close()

	if err := Ping(ctx, pool, time.Second); err != nil {
		t.Errorf("Ping: %v", err)
	}
	// non-positive timeout falls back to the default
	if err := Ping(ctx, pool, 0); err != nil {
		t.Errorf("Ping with default timeout: %v", err)
	}
	// an already-cancelled context must surface as an error
	cancelled, cancelNow := context.WithCancel(ctx)
	cancelNow()
	if err := Ping(cancelled, pool, time.Second); err == nil {
		t.Error("expected error for cancelled context")
	}
}
