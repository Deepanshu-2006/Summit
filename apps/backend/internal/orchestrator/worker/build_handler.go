package worker

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	orchestrator "github.com/summit/backend/internal/orchestrator"
	"github.com/summit/backend/internal/orchestrator/build"
	"github.com/summit/backend/internal/orchestrator/queue"
	corev1 "k8s.io/api/core/v1"
)

// BuildSpecResolver is the Priyanshu/Arpit integration seam that enriches a
// webhook outbox event with credentials, GHCR coordinates, quotas, and callback data.
type BuildSpecResolver interface {
	ResolveBuildSpec(ctx context.Context, event *orchestrator.BuildRequestedPayload, record *queue.EventRecord) (build.BuildExecutionSpec, error)
}

type BuildSpecResolverFunc func(ctx context.Context, event *orchestrator.BuildRequestedPayload, record *queue.EventRecord) (build.BuildExecutionSpec, error)

func (f BuildSpecResolverFunc) ResolveBuildSpec(ctx context.Context, event *orchestrator.BuildRequestedPayload, record *queue.EventRecord) (build.BuildExecutionSpec, error) {
	return f(ctx, event, record)
}

// BuildPodCreator is the Rudra-owned portion required by the dispatcher.
type BuildPodCreator interface {
	CreateBuildPod(ctx context.Context, spec build.BuildExecutionSpec) (*corev1.Pod, error)
}

// BuildHandler validates the shared event/spec handoff, idempotently creates the
// ephemeral builder Pod, then atomically marks the outbox/build job as dispatched.
// The resolver must use a stable attempt_id for one outbox build_run_id so replay
// after a worker crash finds the existing Pod instead of creating another build.
type BuildHandler struct {
	DB       queue.DBTX
	Adapter  BuildPodCreator
	Resolver BuildSpecResolver
}

func (h *BuildHandler) Handle(ctx context.Context, record *queue.EventRecord) error {
	if h == nil || h.DB == nil || h.Adapter == nil || h.Resolver == nil {
		return fmt.Errorf("orchestrator worker: build handler dependencies are incomplete")
	}
	if record == nil {
		return fmt.Errorf("orchestrator worker: outbox event is nil")
	}
	if record.EventType != orchestrator.EventTypeDeploymentBuildRequested {
		return fmt.Errorf("orchestrator worker: unsupported event type %q", record.EventType)
	}
	if record.AggregateType != orchestrator.AggregateTypeDeployment {
		return fmt.Errorf("orchestrator worker: unsupported aggregate type %q", record.AggregateType)
	}
	if record.LockedBy == nil || strings.TrimSpace(*record.LockedBy) == "" {
		return queue.ErrLeaseLost
	}

	event, err := orchestrator.DecodeBuildRequestedPayload(record.Payload)
	if err != nil {
		return fmt.Errorf("orchestrator worker: invalid build request payload: %w", err)
	}
	deploymentID, err := uuid.Parse(event.DeploymentID)
	if err != nil || deploymentID != record.AggregateID {
		return fmt.Errorf("orchestrator worker: event deployment_id does not match outbox aggregate")
	}
	buildID, err := uuid.Parse(event.BuildRunID)
	if err != nil {
		return fmt.Errorf("orchestrator worker: invalid build_run_id: %w", err)
	}
	repositoryOwner, _, ok := strings.Cut(event.Repository.FullName, "/")
	if !ok || strings.TrimSpace(repositoryOwner) == "" {
		return fmt.Errorf("orchestrator worker: invalid repository full_name")
	}

	spec, err := h.Resolver.ResolveBuildSpec(ctx, event, record)
	if err != nil {
		return fmt.Errorf("orchestrator worker: resolving build execution spec: %w", err)
	}
	if err := spec.Validate(); err != nil {
		return fmt.Errorf("orchestrator worker: resolved build spec is invalid: %w", err)
	}
	if spec.Build.ID != buildID.String() || spec.Build.AttemptID != spec.Build.ID || spec.Build.AttemptNumber != 1 ||
		spec.Source.Repository != event.Repository.FullName ||
		!strings.EqualFold(spec.Source.CommitSHA, event.Source.CommitSHA) || spec.Source.Branch != event.Source.Branch ||
		!strings.EqualFold(spec.Output.Registry, "ghcr.io") ||
		!strings.EqualFold(spec.Output.Repository, strings.ToLower(repositoryOwner)+"/summit-app-"+strings.ToLower(event.ServiceID)) ||
		!strings.EqualFold(spec.Output.Tag, "sha-"+strings.ToLower(event.Source.CommitSHA)) {
		return fmt.Errorf("orchestrator worker: resolved build spec does not match MVP identity, source revision, or GHCR destination")
	}
	if _, err := h.Adapter.CreateBuildPod(ctx, spec); err != nil {
		return fmt.Errorf("orchestrator worker: creating builder Pod: %w", err)
	}
	if err := queue.CompleteDeploymentJob(ctx, h.DB, record.ID, *record.LockedBy, deploymentID, queue.BuildJobStatusDispatched); err != nil {
		return fmt.Errorf("orchestrator worker: recording dispatched build: %w", err)
	}
	return nil
}
