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

	// Source credentials: the mounted worker JWT is exchanged at the broker for a
	// short-lived installation token (contract C5). Without a credential file the static
	// resolver only supports explicit test references.
	var resolver source.CredentialResolver = source.NewStaticCredentialResolver(nil)
	if cfg.SourceCredentialFile != "" {
		resolver = source.NewBrokerResolver(cfg.SourceBrokerURL, cfg.SourceCredentialFile)
	} else {
		logger.Warn("no source credential file configured", "env", config.EnvSourceCredentialFile)
	}
	sourceMgr := source.NewManager(resolver, gitClient)

	rpAdapter := railpack.NewCLIAdapter(sup, "")
	bkMgr := buildkit.NewManager(sup, "", "", "")

	// Registry client: GHCR token auth uses the same docker config buildctl pushes with.
	regOpts := []registry.Option{registry.WithInsecureRegistries(cfg.InsecureRegistries...)}
	if cfg.RegistryCredentialFile != "" {
		dockerCfg, err := registry.LoadDockerConfig(cfg.RegistryCredentialFile)
		if err != nil {
			logger.Error("failed to load registry credentials", "error", err)
			os.Exit(1)
		}
		regOpts = append(regOpts, registry.WithDockerConfig(dockerCfg))
	} else {
		logger.Warn("no registry credential file configured; image push and digest verification will be anonymous",
			"env", config.EnvRegistryCredentialFile)
	}
	regClient := registry.NewClient(nil, regOpts...)

	// Reporter bearer token = trimmed contents of the mounted token file (NOT spec token_ref,
	// which is only a reference).
	rep, err := reporter.New(spec.Reporting.Endpoint, cfg.ReportingTokenFile, nil, logger)
	if err != nil {
		logger.Error("failed to initialise build reporter", "error", err)
		os.Exit(1)
	}

	coord := worker.NewCoordinator(val, wsMgr, sourceMgr, rpAdapter, bkMgr, regClient, rep, sup)
	coord.SetRegistryDockerConfigDir(cfg.RegistryDockerConfigDir())

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
