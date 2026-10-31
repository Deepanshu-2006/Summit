package worker

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/orchestrator/events"
	"github.com/summit/backend/internal/orchestrator/queue"
	"github.com/summit/backend/internal/platformdb"
	"github.com/summit/backend/internal/workertoken"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

type mockBuildContextStore struct {
	bCtx *platformdb.BuildContext
	err  error
}

func (m *mockBuildContextStore) GetBuildContext(ctx context.Context, buildJobID uuid.UUID) (*platformdb.BuildContext, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.bCtx, nil
}

func TestProductionResolver_Success(t *testing.T) {
	ctx := context.Background()
	secret := []byte("32-byte-secret-for-testing-purpose!")
	buildID := uuid.New()
	deploymentID := uuid.New()
	serviceID := uuid.New()
	timeout := 600

	bCtx := &platformdb.BuildContext{
		BuildJobID:     buildID,
		DeploymentID:   deploymentID,
		ServiceID:      serviceID,
		TimeoutSeconds: &timeout,
		RepoFullName:   "myorg/myapp",
		CloneURL:       "https://github.com/myorg/myapp.git",
		Branch:         "main",
		CommitSHA:      "0123456789abcdef0123456789abcdef01234567",
		RootDirectory:  "/",
		Resources: platformdb.ServiceResources{
			CPULimitMillicores: 1000,
			MemoryLimitMB:      1024,
		},
	}

	kubeClient := fake.NewClientset()
	resolver := NewProductionResolver(
		&mockBuildContextStore{bCtx: bCtx},
		kubeClient,
		ResolverConfig{
			WorkerJWTSecret: secret,
			APIInternalURL:  "http://summit-api.summit-system.svc.cluster.local:4000",
			BuildNamespace:  "summit-builds",
			GHCRPushSecret:  "ghcr-push",
		},
		nil,
	)

	payload := &events.BuildRequestedPayload{
		EventID:      "event-1",
		DeploymentID: deploymentID.String(),
		BuildRunID:   buildID.String(),
		ServiceID:    serviceID.String(),
		Repository: events.RepositoryPayload{
			FullName: "myorg/myapp",
		},
		Source: events.SourcePayload{
			Branch:    "main",
			CommitSHA: "0123456789abcdef0123456789abcdef01234567",
		},
	}
	record := &queue.EventRecord{
		ID:            uuid.New(),
		AggregateID:   deploymentID,
		AggregateType: events.AggregateTypeDeployment,
		EventType:     events.EventTypeDeploymentBuildRequested,
	}

	spec, err := resolver.ResolveBuildSpec(ctx, payload, record)
	if err != nil {
		t.Fatalf("ResolveBuildSpec failed: %v", err)
	}

	if spec.Build.ID != buildID.String() {
		t.Errorf("expected spec.Build.ID %s, got %s", buildID, spec.Build.ID)
	}
	if spec.Output.Registry != "ghcr.io" {
		t.Errorf("expected output registry ghcr.io, got %s", spec.Output.Registry)
	}
	expectedRepo := "myorg/summit-app-" + strings.ToLower(serviceID.String())
	if spec.Output.Repository != expectedRepo {
		t.Errorf("expected output repo %s, got %s", expectedRepo, spec.Output.Repository)
	}
	expectedTag := "sha-0123456789abcdef0123456789abcdef01234567"
	if spec.Output.Tag != expectedTag {
		t.Errorf("expected output tag %s, got %s", expectedTag, spec.Output.Tag)
	}

	// Verify Kubernetes secret was created with valid token
	secretName := "summit-build-" + strings.ToLower(buildID.String())
	sec, err := kubeClient.CoreV1().Secrets("summit-builds").Get(ctx, secretName, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("expected build secret to exist: %v", err)
	}
	tokenBytes, ok := sec.Data["token"]
	if !ok || len(tokenBytes) == 0 {
		t.Fatalf("expected token key in secret data")
	}
	// Verify token is valid worker JWT
	if err := workertoken.Verify(string(tokenBytes), secret, buildID); err != nil {
		t.Errorf("worker token verification failed: %v", err)
	}
}

func TestProductionResolver_MissingContext(t *testing.T) {
	ctx := context.Background()
	resolver := NewProductionResolver(
		&mockBuildContextStore{err: platformdb.ErrNotFound},
		fake.NewClientset(),
		ResolverConfig{
			WorkerJWTSecret: []byte("32-byte-secret-for-testing-purpose!"),
		},
		nil,
	)

	payload := &events.BuildRequestedPayload{
		BuildRunID: uuid.New().String(),
	}
	_, err := resolver.ResolveBuildSpec(ctx, payload, &queue.EventRecord{})
	if err == nil {
		t.Fatal("expected error on missing build context, got nil")
	}
}
