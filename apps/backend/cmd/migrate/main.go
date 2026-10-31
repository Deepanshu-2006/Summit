// Package main implements the migration CLI tool.
// Usage:
//
//	migrate up      - Apply all pending migrations (default)
//	migrate status  - Show migration status
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/summit/backend/internal/config"
	"github.com/summit/backend/internal/db"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	config.LoadDevelopmentEnv(logger)

	subcommand := "up"
	if len(os.Args) > 1 {
		subcommand = os.Args[1]
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		logger.Error("DATABASE_URL environment variable is required")
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	pool, err := db.Open(ctx, databaseURL)
	if err != nil {
		logger.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	switch subcommand {
	case "up":
		logger.Info("running migrations")
		if err := db.MigrateWithLogger(ctx, pool, logger); err != nil {
			logger.Error("migration failed", "error", err)
			os.Exit(1)
		}
		logger.Info("migrations completed successfully")

	case "status":
		statuses, err := db.Status(ctx, pool)
		if err != nil {
			logger.Error("failed to get migration status", "error", err)
			os.Exit(1)
		}
		fmt.Println("Migration Status:")
		fmt.Println("---")
		for _, s := range statuses {
			status := "PENDING"
			appliedAt := ""
			if s.Applied {
				status = "APPLIED"
				if s.AppliedAt != nil {
					appliedAt = s.AppliedAt.Format(time.RFC3339)
				}
			}
			fmt.Printf("  %-40s %s  %s\n", s.Version, status, appliedAt)
		}

	default:
		logger.Error("unknown subcommand", "subcommand", subcommand, "valid", "up, status")
		os.Exit(1)
	}
}
