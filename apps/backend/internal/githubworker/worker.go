package githubworker

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/summit/backend/internal/audit"
)

// Worker runs the background event processing loop that consumes
// events from github_webhook_events.
type Worker struct {
	pool         *pgxpool.Pool
	ghClient     GitHubClient
	auditWriter  audit.Writer
	logger       *slog.Logger
	pollInterval time.Duration
}

// NewWorker constructs a new background Worker.
func NewWorker(pool *pgxpool.Pool, ghClient GitHubClient, auditWriter audit.Writer, logger *slog.Logger, pollInterval time.Duration) *Worker {
	if logger == nil {
		logger = slog.Default()
	}
	if pollInterval <= 0 {
		pollInterval = 1 * time.Second
	}
	return &Worker{
		pool:         pool,
		ghClient:     ghClient,
		auditWriter:  auditWriter,
		logger:       logger,
		pollInterval: pollInterval,
	}
}

// Run executes the worker loop until the provided context is canceled.
func (w *Worker) Run(ctx context.Context) error {
	w.logger.Info("starting github webhook event worker", "poll_interval", w.pollInterval.String())

	ticker := time.NewTicker(w.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			w.logger.Info("stopping github webhook event worker")
			return ctx.Err()
		default:
		}

		processed, err := ProcessNextEvent(ctx, w.pool, w.ghClient, w.auditWriter)
		if err != nil {
			w.logger.Error("error processing webhook event", "error", err)
		}

		if processed {
			// If work was found, immediately attempt to drain remaining queue without waiting for next tick
			continue
		}

		// Wait for next poll interval or context cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

// ProcessAllRemaining continuously calls ProcessNextEvent until the queue is empty.
// Helpful for testing and synchronous draining.
func ProcessAllRemaining(ctx context.Context, pool *pgxpool.Pool, ghClient GitHubClient, auditWriter audit.Writer, maxEvents int) (int, error) {
	count := 0
	for count < maxEvents {
		processed, err := ProcessNextEvent(ctx, pool, ghClient, auditWriter)
		if err != nil {
			return count, fmt.Errorf("process next event: %w", err)
		}
		if !processed {
			break
		}
		count++
	}
	return count, nil
}
