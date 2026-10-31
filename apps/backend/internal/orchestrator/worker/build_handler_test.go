package worker

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	orchestrator "github.com/summit/backend/internal/orchestrator"
	"github.com/summit/backend/internal/orchestrator/build"
	"github.com/summit/backend/internal/orchestrator/queue"
	corev1 "k8s.io/api/core/v1"
)

type handlerDB struct {
	query string
	args  []any
	id    uuid.UUID
}

func (db *handlerDB) Exec(context.Context, string, ...any) (pgconn.CommandTag, error) {
	return pgconn.NewCommandTag("UPDATE 0"), nil
}
func (db *handlerDB) Query(context.Context, string, ...any) (pgx.Rows, error) { return nil, nil }
func (db *handlerDB) QueryRow(_ context.Context, query string, args ...any) pgx.Row {
	db.query, db.args = query, args
	return handlerRow{id: db.id}
}

type handlerRow struct{ id uuid.UUID }

func (r handlerRow) Scan(dest ...any) error {
	if len(dest) != 1 {
		return errors.New("unexpected scan shape")
	}
	value, ok := dest[0].(*uuid.UUID)
	if !ok {
		return errors.New("unexpected scan target")
	}
	*value = r.id
	return nil
}

type handlerAdapter struct {
	called bool
	spec   build.BuildExecutionSpec
}

func (a *handlerAdapter) CreateBuildPod(_ context.Context, spec build.BuildExecutionSpec) (*corev1.Pod, error) {
	a.called, a.spec = true, spec
	return &corev1.Pod{}, nil
}

func TestBuildHandlerDispatchesValidatedSpec(t *testing.T) {
	ctx := context.Background()
	outboxID, deploymentID, buildID := uuid.New(), uuid.New(), uuid.New()
	workerID := "worker-1"
	payload := []byte(`{"event_id":"webhook-event","deployment_id":"` + deploymentID.String() + `","build_run_id":"` + buildID.String() + `","service_id":"service","service_source_id":"source","user_id":"user","project_id":"project","environment_id":"environment","repository":{"platform_repository_id":"repo","github_repository_id":123,"full_name":"owner/repo"},"source":{"branch":"main","ref":"refs/heads/main","commit_sha":"0123456789abcdef0123456789abcdef01234567","root_directory":"/"},"trigger":{"type":"push","webhook_event_id":"delivery"}}`)
	record := &queue.EventRecord{ID: outboxID, AggregateType: orchestrator.AggregateTypeDeployment, AggregateID: deploymentID, EventType: orchestrator.EventTypeDeploymentBuildRequested, Payload: payload, Status: queue.StatusClaimed, LockedBy: &workerID}
	spec := validBuildSpec(buildID.String())
	db := &handlerDB{id: outboxID}
	adapter := &handlerAdapter{}
	handler := BuildHandler{
		DB:      db,
		Adapter: adapter,
		Resolver: BuildSpecResolverFunc(func(context.Context, *orchestrator.BuildRequestedPayload, *queue.EventRecord) (build.BuildExecutionSpec, error) {
			return spec, nil
		}),
	}
	if err := handler.Handle(ctx, record); err != nil {
		t.Fatalf("Handle failed: %v", err)
	}
	if !adapter.called || adapter.spec.Build.ID != buildID.String() {
		t.Fatal("expected the validated build to be sent to the Pod adapter")
	}
	if !strings.Contains(db.query, "WITH completed_event AS") || len(db.args) != 4 || db.args[2] != queue.BuildJobStatusDispatched || db.args[3] != deploymentID {
		t.Fatalf("expected atomic outbox/build job dispatch transition, query=%q args=%v", db.query, db.args)
	}
}

func TestBuildHandlerRejectsResolverSourceMismatch(t *testing.T) {
	deploymentID, buildID := uuid.New(), uuid.New()
	workerID := "worker-1"
	record := &queue.EventRecord{
		ID: uuid.New(), AggregateType: orchestrator.AggregateTypeDeployment,
		AggregateID: deploymentID, EventType: orchestrator.EventTypeDeploymentBuildRequested,
		Payload: []byte(`{"event_id":"webhook-event","deployment_id":"` + deploymentID.String() + `","build_run_id":"` + buildID.String() + `","service_id":"service","service_source_id":"source","user_id":"user","project_id":"project","environment_id":"environment","repository":{"platform_repository_id":"repo","github_repository_id":123,"full_name":"owner/repo"},"source":{"branch":"main","ref":"refs/heads/main","commit_sha":"0123456789abcdef0123456789abcdef01234567","root_directory":"/"},"trigger":{"type":"push","webhook_event_id":"delivery"}}`),
		Status:  queue.StatusClaimed, LockedBy: &workerID,
	}
	spec := validBuildSpec(buildID.String())
	spec.Source.Repository = "attacker/other-repo"
	adapter := &handlerAdapter{}
	db := &handlerDB{id: record.ID}
	handler := BuildHandler{DB: db, Adapter: adapter, Resolver: BuildSpecResolverFunc(func(context.Context, *orchestrator.BuildRequestedPayload, *queue.EventRecord) (build.BuildExecutionSpec, error) {
		return spec, nil
	})}
	if err := handler.Handle(context.Background(), record); err == nil {
		t.Fatal("expected source mismatch rejection")
	}
	if adapter.called || db.query != "" {
		t.Fatal("mismatched source must not schedule a pod or complete the event")
	}
}

func validBuildSpec(buildID string) build.BuildExecutionSpec {
	return build.BuildExecutionSpec{
		SchemaVersion:  1,
		Build:          build.BuildMetadata{ID: buildID, AttemptID: buildID, AttemptNumber: 1},
		Source:         build.SourceSpec{Provider: "github", Repository: "owner/repo", CloneURL: "https://github.com/owner/repo.git", Branch: "main", CommitSHA: "0123456789abcdef0123456789abcdef01234567", RootDirectory: "/"},
		BuildConfig:    build.BuildConfig{Builder: "railpack"},
		Credentials:    build.CredentialsSpec{SourceCredentialRef: "k8s:source-token", RegistryCredentialRef: "k8s:registry-secret"},
		Output:         build.OutputSpec{Registry: "ghcr.io", Repository: "owner/summit-app-service", Tag: "sha-0123456789abcdef0123456789abcdef01234567", Platforms: []string{"linux/amd64"}},
		Resources:      build.ResourceLimits{CPUMillicores: 1000, MemoryMiB: 1024, EphemeralStorageMiB: 2048},
		TimeoutSeconds: 600,
		Reporting:      build.ReportingSpec{Endpoint: "https://api.example.com/builds", TokenRef: "k8s:reporting-token"},
	}
}
