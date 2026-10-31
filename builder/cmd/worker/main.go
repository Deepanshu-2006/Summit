package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/summit/builder/internal/buildkit"
	"github.com/summit/builder/internal/config"
	"github.com/summit/builder/internal/process"
	"github.com/summit/builder/internal/protocol"
	"github.com/summit/builder/internal/railpack"
	"github.com/summit/builder/internal/registry"
	"github.com/summit/builder/internal/reporter"
	"github.com/summit/builder/internal/source"
	"github.com/summit/builder/internal/validation"
	"github.com/summit/builder/internal/worker"
	"github.com/summit/builder/internal/workspace"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		logger.Error("configuration loading failed", "error", err)
		os.Exit(1)
	}

	logger.Info("starting summit builder worker",
		"worker_id", cfg.WorkerID,
		"spec_path", cfg.ExecutionSpecPath,
	)

	// Read and parse input execution spec
	specBytes, err := os.ReadFile(cfg.ExecutionSpecPath)
	if err != nil {
		logger.Error("failed to read execution spec file", "path", cfg.ExecutionSpecPath, "error", err)
		os.Exit(1)
	}

	var spec protocol.BuildExecutionSpec
	if err := json.Unmarshal(specBytes, &spec); err != nil {
		logger.Error("malformed execution spec json", "error", err)
		os.Exit(1)
	}

	// Setup graceful signal context
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// Initialize subsystems
	sup := process.NewSupervisor(0, 0)
	val := validation.NewValidator()
	wsMgr := workspace.NewManager(cfg.WorkspaceBaseDir)
	gitClient := source.NewGitClient(sup)
	resolver := source.NewStaticCredentialResolver(nil)
	sourceMgr := source.NewManager(resolver, gitClient)
	rpAdapter := railpack.NewCLIAdapter(sup, "")
	bkMgr := buildkit.NewManager(sup, "", "", "")
	regClient := registry.NewClient(nil)
	httpReporter := reporter.NewHTTPReporter(spec.Reporting.Endpoint, spec.Reporting.TokenRef, nil)

	coord := worker.NewCoordinator(val, wsMgr, sourceMgr, rpAdapter, bkMgr, regClient, httpReporter, sup)

	result, err := coord.Run(ctx, &spec)
	if err != nil {
		logger.Error("build execution failed",
			"error", err,
			"status", result.Status,
		)
		os.Exit(1)
	}

	logger.Info("build execution completed successfully",
		"build_id", result.BuildID,
		"digest", result.Artifact.Digest,
		"tag", result.Artifact.Tag,
	)
}
