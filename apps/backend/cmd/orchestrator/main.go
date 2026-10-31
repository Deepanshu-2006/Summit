package main

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/summit/backend/internal/orchestrator"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx, logger); err != nil {
		logger.Error("orchestrator terminated with error", "error", err)
		os.Exit(1)
	}

	logger.Info("summit orchestrator stopped gracefully")
}

func run(ctx context.Context, logger *slog.Logger) error {
	cfg := orchestrator.LoadConfig()
	if err := cfg.Validate(); err != nil {
		return err
	}

	app, err := orchestrator.New(orchestrator.Dependencies{
		Config: cfg,
		Logger: logger,
	})
	if err != nil {
		return err
	}

	if err := app.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
		return err
	}

	return nil
}
