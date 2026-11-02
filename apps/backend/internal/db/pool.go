// Package db provides database connection pooling and embedded SQL migration
// support using pgxpool.
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Open creates a new pgxpool.Pool with sane defaults.
// It pings the database to verify connectivity.
func Open(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("database URL is required")
	}

	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parsing database URL: %w", err)
	}

	// Sane pool defaults
	config.MaxConns = 25
	config.MinConns = 2
	config.MaxConnLifetime = 30 * time.Minute
	config.MaxConnIdleTime = 5 * time.Minute
	config.HealthCheckPeriod = 30 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("creating connection pool: %w", err)
	}

	// Verify connectivity
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("pinging database: %w", err)
	}

	return pool, nil
}

// OpenWithRetry calls Open until it succeeds, ctx is cancelled, or maxWait elapses. Each
// attempt gets attemptTimeout; the delay between attempts doubles from 1s up to 10s. It is for
// process startup, where a slow or waking database should not be treated as permanently down.
// onRetry (optional) is called after each failed attempt with the attempt number and error.
func OpenWithRetry(ctx context.Context, databaseURL string, maxWait, attemptTimeout time.Duration, onRetry func(attempt int, err error)) (*pgxpool.Pool, error) {
	if _, err := pgxpool.ParseConfig(databaseURL); err != nil || databaseURL == "" {
		return Open(ctx, databaseURL) // invalid config never succeeds; fail fast with Open's error
	}
	deadline := time.Now().Add(maxWait)
	delay := time.Second
	for attempt := 1; ; attempt++ {
		attemptCtx, cancel := context.WithTimeout(ctx, attemptTimeout)
		pool, err := Open(attemptCtx, databaseURL)
		cancel()
		if err == nil {
			return pool, nil
		}
		if onRetry != nil {
			onRetry(attempt, err)
		}
		if time.Now().Add(delay).After(deadline) {
			return nil, fmt.Errorf("database unreachable after %d attempts over %s: %w", attempt, maxWait, err)
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(delay):
		}
		delay = min(delay*2, 10*time.Second)
	}
}

// DefaultPingTimeout is used by Ping when the caller passes a non-positive timeout.
const DefaultPingTimeout = 2 * time.Second

// Ping verifies the pool can reach the database within timeout. It is intended
// for readiness probes (e.g. GET /api/v1/health deep checks). A non-positive
// timeout falls back to DefaultPingTimeout.
func Ping(ctx context.Context, pool *pgxpool.Pool, timeout time.Duration) error {
	if pool == nil {
		return fmt.Errorf("database pool is nil")
	}
	if timeout <= 0 {
		timeout = DefaultPingTimeout
	}
	pingCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		return fmt.Errorf("pinging database: %w", err)
	}
	return nil
}
