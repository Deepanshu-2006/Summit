package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync/atomic"
	"time"

	"github.com/summit/builder/internal/buildkit"
	"github.com/summit/builder/internal/process"
	"github.com/summit/builder/internal/protocol"
	"github.com/summit/builder/internal/railpack"
	"github.com/summit/builder/internal/registry"
	"github.com/summit/builder/internal/reporter"
	"github.com/summit/builder/internal/source"
	"github.com/summit/builder/internal/validation"
	"github.com/summit/builder/internal/workspace"
)

// Coordinator orchestrates the complete execution stages of a single build attempt.
type Coordinator struct {
	validator  *validation.Validator
	wsManager  *workspace.Manager
	sourceMgr  *source.Manager
	railpack   railpack.RailpackAdapter
	buildkit   buildkit.BuildKitManager
	registry   *registry.Client
	reporter   reporter.Reporter
	supervisor *process.Supervisor
	seqCounter atomic.Int64

	// registryDockerConfigDir is exported as DOCKER_CONFIG to buildctl only.
	registryDockerConfigDir string
}

// Default tool versions recorded in the result metadata. The builder image sets
// SUMMIT_RAILPACK_VERSION / SUMMIT_BUILDKIT_VERSION to the versions it actually ships.
const (
	defaultRailpackVersion = "v0.43.0"
	defaultBuildkitVersion = "v0.34.1"
)

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// SetRegistryDockerConfigDir sets the directory containing the registry config.json that
// buildctl uses to authenticate the image push (exported as DOCKER_CONFIG for buildctl only).
func (c *Coordinator) SetRegistryDockerConfigDir(dir string) {
	c.registryDockerConfigDir = dir
}

// NewCoordinator constructs a new execution Coordinator.
func NewCoordinator(
	validator *validation.Validator,
	wsManager *workspace.Manager,
	sourceMgr *source.Manager,
	railpackAdapter railpack.RailpackAdapter,
	buildkitMgr buildkit.BuildKitManager,
	registryClient *registry.Client,
	rep reporter.Reporter,
	supervisor *process.Supervisor,
) *Coordinator {
	if validator == nil {
		validator = validation.NewValidator()
	}
	if wsManager == nil {
		wsManager = workspace.NewManager("")
	}
	if registryClient == nil {
		registryClient = registry.NewClient(nil)
	}
	if rep == nil {
		rep = reporter.NewMemoryReporter()
	}
	if supervisor == nil {
		supervisor = process.NewSupervisor(0, 0)
	}
	return &Coordinator{
		validator:  validator,
		wsManager:  wsManager,
		sourceMgr:  sourceMgr,
		railpack:   railpackAdapter,
		buildkit:   buildkitMgr,
		registry:   registryClient,
		reporter:   rep,
		supervisor: supervisor,
	}
}

// Run executes the full build lifecycle according to the provided BuildExecutionSpec.
func (c *Coordinator) Run(ctx context.Context, spec *protocol.BuildExecutionSpec) (*protocol.BuildExecutionResult, error) {
	startedAt := time.Now().UTC()

	// Handle overall execution timeout
	if spec != nil && spec.TimeoutSeconds > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, time.Duration(spec.TimeoutSeconds)*time.Second)
		defer cancel()
	}

	buildID := "unknown"
	attemptID := "unknown"
	if spec != nil {
		buildID = spec.Build.ID
		attemptID = spec.Build.AttemptID
	}

	report := func(stage protocol.Stage, status protocol.StageStatus, msg string) {
		seq := int(c.seqCounter.Add(1))
		_ = c.reporter.ReportStatus(ctx, protocol.NewStatusUpdate(buildID, attemptID, seq, stage, status, msg))
	}

	failResult := func(code string, stage protocol.Stage, msg, details string) (*protocol.BuildExecutionResult, error) {
		completedAt := time.Now().UTC()
		resStatus := protocol.StatusFailed
		if ctx.Err() != nil {
			resStatus = protocol.StatusCancelled
			if ctx.Err() == context.DeadlineExceeded {
				code = protocol.ErrCodeTimeout
			} else {
				code = protocol.ErrCodeCancelled
			}
			msg = fmt.Sprintf("execution stopped due to context: %v", ctx.Err())
		}

		res := &protocol.BuildExecutionResult{
			SchemaVersion: protocol.CurrentSchemaVersion,
			BuildID:       buildID,
			AttemptID:     attemptID,
			Status:        resStatus,
			Metadata: protocol.ResultMetadata{
				Builder:   "railpack",
				CommitSHA: "",
			},
			Error: &protocol.ExecutionError{
				Code:    code,
				Stage:   string(stage),
				Message: msg,
				Details: details,
			},
			Timestamps: protocol.ResultTimestamps{
				StartedAt:   startedAt,
				CompletedAt: completedAt,
				DurationMS:  completedAt.Sub(startedAt).Milliseconds(),
			},
		}
		if spec != nil {
			res.Metadata.CommitSHA = spec.Source.CommitSHA
			if spec.BuildConfig.Builder != "" {
				res.Metadata.Builder = spec.BuildConfig.Builder
			}
		}
		_ = c.reporter.ReportResult(context.Background(), *res)
		return res, fmt.Errorf("[%s] %s: %s", code, stage, msg)
	}

	// 1. Initializing & Validating Spec
	report(protocol.StageInitializing, protocol.StageStatusRunning, "Worker execution started")
	report(protocol.StageValidatingSpec, protocol.StageStatusRunning, "Validating execution specification")

	if err := c.validator.Validate(spec); err != nil {
		return failResult(protocol.ErrCodeSpecInvalid, protocol.StageValidatingSpec, "Spec validation failed", err.Error())
	}
	report(protocol.StageValidatingSpec, protocol.StageStatusSucceeded, "Specification validated")

	// 2. Preparing Workspace
	report(protocol.StagePreparingWorkspace, protocol.StageStatusRunning, "Initializing attempt workspace")
	paths, err := c.wsManager.Initialize(spec.Build.ID, spec.Build.AttemptID)
	if err != nil {
		return failResult(protocol.ErrCodeWorkspaceInitFailed, protocol.StagePreparingWorkspace, "Workspace initialization failed", err.Error())
	}
	defer func() {
		_ = workspace.CleanupAttempt(paths)
	}()
	report(protocol.StagePreparingWorkspace, protocol.StageStatusSucceeded, "Workspace prepared")

	// Start BuildKit daemon if not already running
	if c.buildkit != nil {
		_ = c.buildkit.Start(ctx)
		defer func() {
			stopCtx, stopCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer stopCancel()
			_ = c.buildkit.Stop(stopCtx)
		}()
		waitCtx, waitCancel := context.WithTimeout(ctx, 30*time.Second)
		readyErr := c.buildkit.WaitReady(waitCtx)
		waitCancel()
		if readyErr != nil {
			return failResult(protocol.ErrCodeBuildFailed, protocol.StageImageBuild, "BuildKit daemon did not start", source.SanitizeGitOutput(readyErr.Error()))
		}
	}

	// 3. Source Checkout & Verification
	report(protocol.StageSourceCheckout, protocol.StageStatusRunning, "Cloning repository and checking out pinned revision")
	checkoutRes, err := c.sourceMgr.PrepareSource(ctx, spec, paths)
	if err != nil {
		return failResult(protocol.ErrCodeSourceCloneFailed, protocol.StageSourceCheckout, fmt.Sprintf("Source checkout failed: %v", err), err.Error())
	}
	report(protocol.StageSourceValidation, protocol.StageStatusSucceeded, fmt.Sprintf("Verified pinned commit %s", checkoutRes.CommitSHA))

	// 4. Application Detection & Build Plan Generation
	var detectedRuntime string
	var planPath string

	if spec.BuildConfig.Builder == "dockerfile" {
		report(protocol.StageApplicationDetection, protocol.StageStatusSucceeded, "Using Dockerfile builder strategy (bypassing Railpack)")
		report(protocol.StageBuildPlanGeneration, protocol.StageStatusSucceeded, "Using direct Dockerfile")
		detectedRuntime = "dockerfile"
	} else {
		report(protocol.StageApplicationDetection, protocol.StageStatusRunning, "Detecting application runtime via Railpack")
		planPath = paths.RailpackPlanFilePath()
		prepareRes, err := c.railpack.Prepare(ctx, railpack.PrepareInput{
			AppDir:      checkoutRes.AppDir,
			PlanPath:    planPath,
			BuildConfig: spec.BuildConfig,
		})
		if err != nil {
			return failResult(protocol.ErrCodeBuildPlanFailed, protocol.StageBuildPlanGeneration, "Railpack build plan generation failed", err.Error())
		}
		detectedRuntime = prepareRes.DetectedRuntime
		planPath = prepareRes.PlanPath
		report(protocol.StageBuildPlanGeneration, protocol.StageStatusSucceeded, fmt.Sprintf("Generated build plan for runtime %s", detectedRuntime))
	}

	// 5. Image Build (BuildKit)
	report(protocol.StageImageBuild, protocol.StageStatusRunning, "Building OCI container image")
	streamLog := func(stream, line string) {
		seq := int(c.seqCounter.Add(1))
		logStream := protocol.StreamStdout
		if stream == "stderr" {
			logStream = protocol.StreamStderr
		}
		_ = c.reporter.ReportLog(ctx, protocol.NewLogEvent(buildID, attemptID, seq, logStream, string(protocol.StageImageBuild), protocol.SeverityInfo, line))
	}

	targetRef := spec.Output.FullTargetRef()
	dfPath := ""
	if spec.BuildConfig.DockerfilePath != nil {
		dfPath = *spec.BuildConfig.DockerfilePath
	}

	// Plain HTTP only for loopback or explicitly configured registries; the registry
	// client is the single source of truth for that decision.
	insecure := c.registry.IsInsecure(spec.Output.Registry)

	_, err = c.buildkit.Build(ctx, buildkit.BuildKitBuildSpec{
		AppDir:         checkoutRes.AppDir,
		PlanPath:       planPath,
		DockerfilePath: dfPath,
		Tag:            targetRef,
		Platforms:      spec.Output.Platforms,
		EnvVars:        spec.BuildConfig.EnvVars,
		PushToRegistry: true,
		Insecure:       insecure,

		DockerConfigDir: c.registryDockerConfigDir,
	}, streamLog)
	if err != nil {
		return failResult(protocol.ErrCodeBuildFailed, protocol.StageImageBuild, "BuildKit compilation or push failed", err.Error())
	}
	report(protocol.StageImageBuild, protocol.StageStatusSucceeded, "OCI image build and push completed")

	// 6. Image Verification
	report(protocol.StageImageVerification, protocol.StageStatusRunning, "Verifying OCI manifest digest from registry")
	artMetadata, err := c.registry.VerifyDigest(ctx, spec.Output.Registry, spec.Output.Repository, spec.Output.Tag)
	if err != nil {
		return failResult(protocol.ErrCodeDigestVerifyFailed, protocol.StageImageVerification, "Registry digest verification failed", err.Error())
	}
	report(protocol.StageImageVerification, protocol.StageStatusSucceeded, fmt.Sprintf("Verified immutable digest %s", artMetadata.Digest))

	// 7. Finalizing and Submitting Result
	report(protocol.StageFinalizing, protocol.StageStatusRunning, "Assembling execution result")
	completedAt := time.Now().UTC()
	finalResult := &protocol.BuildExecutionResult{
		SchemaVersion: protocol.CurrentSchemaVersion,
		BuildID:       buildID,
		AttemptID:     attemptID,
		Status:        protocol.StatusSucceeded,
		Artifact: &protocol.ArtifactDetails{
			Repository: artMetadata.Repository,
			Digest:     artMetadata.Digest,
			Tag:        artMetadata.Tag,
			Platforms:  spec.Output.Platforms,
			SizeBytes:  artMetadata.SizeBytes,
		},
		Metadata: protocol.ResultMetadata{
			Builder:         spec.BuildConfig.Builder,
			RailpackVersion: envOrDefault("SUMMIT_RAILPACK_VERSION", defaultRailpackVersion),
			BuildkitVersion: envOrDefault("SUMMIT_BUILDKIT_VERSION", defaultBuildkitVersion),
			CommitSHA:       checkoutRes.CommitSHA,
			DetectedRuntime: detectedRuntime,
		},
		Timestamps: protocol.ResultTimestamps{
			StartedAt:   startedAt,
			CompletedAt: completedAt,
			DurationMS:  completedAt.Sub(startedAt).Milliseconds(),
		},
	}

	// Persist local result file to workspace metadata
	resultBytes, _ := json.MarshalIndent(finalResult, "", "  ")
	_ = os.WriteFile(paths.ResultFilePath(), resultBytes, 0600)

	report(protocol.StageResultSubmission, protocol.StageStatusRunning, "Reporting final result to control plane")
	_ = c.reporter.ReportResult(context.Background(), *finalResult)
	report(protocol.StageResultSubmission, protocol.StageStatusSucceeded, "Execution completed successfully")

	return finalResult, nil
}
