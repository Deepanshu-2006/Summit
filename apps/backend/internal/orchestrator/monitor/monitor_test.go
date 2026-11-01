package monitor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/cluster/workloads"
	"github.com/summit/backend/internal/orchestrator/build"
	"github.com/summit/backend/internal/platformdb"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	dynfake "k8s.io/client-go/dynamic/fake"
	"k8s.io/client-go/kubernetes/fake"
)

type mockRolloutStore struct {
	activeDeployments []platformdb.ActiveDeployment
	transitions       []transitionRecord
	promoted          []uuid.UUID
	err               error
}

type transitionRecord struct {
	id        uuid.UUID
	from      []platformdb.DeploymentStatus
	to        platformdb.DeploymentStatus
	reason    string
	imageRef  string
	publicURL string
}

func (m *mockRolloutStore) ListActiveDeployments(ctx context.Context, limit int) ([]platformdb.ActiveDeployment, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.activeDeployments, nil
}

func (m *mockRolloutStore) GetDeployment(ctx context.Context, id uuid.UUID) (*platformdb.Deployment, error) {
	return nil, errors.New("not implemented")
}

func readTransitionOpts(opts []platformdb.TransitionOption) (imageRef, publicURL string) {
	if len(opts) == 0 {
		return "", ""
	}
	optType := reflect.TypeOf(opts[0])
	if optType.Kind() != reflect.Func || optType.NumIn() != 1 {
		return "", ""
	}
	ptr := reflect.New(optType.In(0).Elem())
	for _, opt := range opts {
		reflect.ValueOf(opt).Call([]reflect.Value{ptr})
	}
	v := ptr.Elem()
	read := func(name string) string {
		f := v.FieldByName(name)
		if !f.IsValid() || f.Kind() != reflect.Pointer || f.IsNil() {
			return ""
		}
		return f.Elem().String()
	}
	return read("imageRef"), read("publicURL")
}

func (m *mockRolloutStore) TransitionDeployment(ctx context.Context, id uuid.UUID, from []platformdb.DeploymentStatus, to platformdb.DeploymentStatus, reason string, opts ...platformdb.TransitionOption) (*platformdb.Deployment, error) {
	imageRef, publicURL := readTransitionOpts(opts)
	m.transitions = append(m.transitions, transitionRecord{id: id, from: from, to: to, reason: reason, imageRef: imageRef, publicURL: publicURL})
	for i := range m.activeDeployments {
		if m.activeDeployments[i].Deployment.ID == id {
			m.activeDeployments[i].Deployment.Status = to
		}
	}
	return &platformdb.Deployment{ID: id, Status: to}, nil
}

func (m *mockRolloutStore) PromoteRelease(ctx context.Context, deploymentID uuid.UUID, configSnapshot json.RawMessage) (*platformdb.PromoteResult, error) {
	m.promoted = append(m.promoted, deploymentID)
	return &platformdb.PromoteResult{
		Release: platformdb.Release{
			ID:            uuid.New(),
			DeploymentID:  deploymentID,
			ReleaseNumber: 1,
			IsActive:      true,
		},
		Created: true,
	}, nil
}

type mockBuildStore struct {
	terminalJobs map[uuid.UUID]platformdb.BuildJobStatus
}

func (m *mockBuildStore) GetBuildJob(ctx context.Context, id uuid.UUID) (*platformdb.BuildJob, error) {
	return nil, nil
}
func (m *mockBuildStore) GetBuildContext(ctx context.Context, buildJobID uuid.UUID) (*platformdb.BuildContext, error) {
	return nil, nil
}
func (m *mockBuildStore) MarkBuildDispatched(ctx context.Context, buildJobID, attemptID uuid.UUID, podName string, timeoutSeconds int) (*platformdb.BuildJob, error) {
	return nil, nil
}
func (m *mockBuildStore) RecordBuildStatus(ctx context.Context, buildJobID uuid.UUID, ev platformdb.BuildStatusEvent) (bool, error) {
	return true, nil
}
func (m *mockBuildStore) AppendBuildLogs(ctx context.Context, buildJobID uuid.UUID, lines []platformdb.LogLine) (int, error) {
	return len(lines), nil
}
func (m *mockBuildStore) RecordBuildResult(ctx context.Context, buildJobID uuid.UUID, r platformdb.BuildResult) (*platformdb.BuildJob, bool, error) {
	return nil, true, nil
}
func (m *mockBuildStore) ListBuildLogs(ctx context.Context, buildJobID uuid.UUID, afterID int64, limit int) ([]platformdb.BuildLogLine, error) {
	return nil, nil
}
func (m *mockBuildStore) MarkBuildJobTerminal(ctx context.Context, buildJobID uuid.UUID, status platformdb.BuildJobStatus, errorMessage string) (*platformdb.BuildJob, bool, error) {
	if m.terminalJobs == nil {
		m.terminalJobs = make(map[uuid.UUID]platformdb.BuildJobStatus)
	}
	m.terminalJobs[buildJobID] = status
	return nil, true, nil
}

type mockAdapter struct {
	deletedBuilds []string
	podStatus     *build.BuildPodStatus
}

func (m *mockAdapter) CreateBuildPod(ctx context.Context, spec build.BuildExecutionSpec) (*corev1.Pod, error) {
	return nil, nil
}
func (m *mockAdapter) GetBuildPod(ctx context.Context, buildID, attemptID string) (*corev1.Pod, error) {
	return nil, nil
}
func (m *mockAdapter) GetBuildPodStatus(ctx context.Context, buildID, attemptID string) (*build.BuildPodStatus, error) {
	return m.podStatus, nil
}
func (m *mockAdapter) WatchBuildPod(ctx context.Context, buildID, attemptID string) (<-chan build.PodStatusEvent, error) {
	return nil, nil
}
func (m *mockAdapter) DeleteBuildPod(ctx context.Context, buildID, attemptID string) error {
	m.deletedBuilds = append(m.deletedBuilds, attemptID)
	return nil
}
func (m *mockAdapter) CleanupBuild(ctx context.Context, buildID, attemptID string) error {
	return nil
}

func TestMonitor_QueuedToBuilding(t *testing.T) {
	ctx := context.Background()
	depID := uuid.New()
	buildID := uuid.New()

	active := platformdb.ActiveDeployment{
		Deployment: platformdb.Deployment{ID: depID, Status: platformdb.DeploymentQueued},
		BuildJob:   platformdb.BuildJob{ID: buildID, Status: platformdb.BuildDispatched},
	}
	rolloutStore := &mockRolloutStore{activeDeployments: []platformdb.ActiveDeployment{active}}
	buildStore := &mockBuildStore{}
	m, err := New(rolloutStore, buildStore, nil, nil, nil, nil, DefaultConfig(), nil)
	if err != nil {
		t.Fatalf("failed creating monitor: %v", err)
	}

	count, err := m.Step(ctx)
	if err != nil {
		t.Fatalf("step failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 processed, got %d", count)
	}
	if len(rolloutStore.transitions) != 1 || rolloutStore.transitions[0].to != platformdb.DeploymentBuilding {
		t.Fatalf("expected transition to building, got: %+v", rolloutStore.transitions)
	}
}

func TestMonitor_BuildingToImageReady(t *testing.T) {
	ctx := context.Background()
	depID := uuid.New()
	buildID := uuid.New()
	repo := "ghcr.io/myorg/summit-app-service"
	digest := "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

	active := platformdb.ActiveDeployment{
		Deployment: platformdb.Deployment{ID: depID, Status: platformdb.DeploymentBuilding},
		BuildJob: platformdb.BuildJob{
			ID:              buildID,
			Status:          platformdb.BuildSucceeded,
			ImageRepository: &repo,
			ImageDigest:     &digest,
		},
	}
	rolloutStore := &mockRolloutStore{activeDeployments: []platformdb.ActiveDeployment{active}}
	m, _ := New(rolloutStore, &mockBuildStore{}, nil, nil, nil, nil, DefaultConfig(), nil)

	count, err := m.Step(ctx)
	if err != nil {
		t.Fatalf("step failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 processed, got %d", count)
	}
	if len(rolloutStore.transitions) != 1 || rolloutStore.transitions[0].to != platformdb.DeploymentImageReady {
		t.Fatalf("expected transition to image_ready, got: %+v", rolloutStore.transitions)
	}
}

func TestMonitor_BuildingToFailed(t *testing.T) {
	ctx := context.Background()
	depID := uuid.New()
	errMsg := "compile error on line 42"

	active := platformdb.ActiveDeployment{
		Deployment: platformdb.Deployment{ID: depID, Status: platformdb.DeploymentBuilding},
		BuildJob: platformdb.BuildJob{
			ID:           uuid.New(),
			Status:       platformdb.BuildFailed,
			ErrorMessage: &errMsg,
		},
	}
	rolloutStore := &mockRolloutStore{activeDeployments: []platformdb.ActiveDeployment{active}}
	m, _ := New(rolloutStore, &mockBuildStore{}, nil, nil, nil, nil, DefaultConfig(), nil)

	count, err := m.Step(ctx)
	if err != nil {
		t.Fatalf("step failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 processed, got %d", count)
	}
	if len(rolloutStore.transitions) != 1 || rolloutStore.transitions[0].to != platformdb.DeploymentFailed {
		t.Fatalf("expected transition to failed, got: %+v", rolloutStore.transitions)
	}
}

func TestMonitor_ImageReadyToDeploying(t *testing.T) {
	ctx := context.Background()
	depID := uuid.New()
	userID := uuid.New()
	serviceID := uuid.New()
	imageRef := "ghcr.io/myorg/summit-app-service@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

	active := platformdb.ActiveDeployment{
		Deployment: platformdb.Deployment{ID: depID, Status: platformdb.DeploymentImageReady, ImageRef: &imageRef},
		UserID:     userID,
		ServiceID:  serviceID,
		Resources: platformdb.ServiceResources{
			Port:                 8080,
			MinReplicas:          1,
			CPURequestMillicores: 100,
			CPULimitMillicores:   500,
			MemoryRequestMB:      128,
			MemoryLimitMB:        512,
		},
	}
	rolloutStore := &mockRolloutStore{activeDeployments: []platformdb.ActiveDeployment{active}}
	scheme := runtime.NewScheme()
	dynClient := dynfake.NewSimpleDynamicClient(scheme)

	m, _ := New(rolloutStore, &mockBuildStore{}, nil, dynClient, nil, nil, DefaultConfig(), nil)

	count, err := m.Step(ctx)
	if err != nil {
		t.Fatalf("step failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 processed, got %d", count)
	}
	if len(rolloutStore.transitions) != 1 || rolloutStore.transitions[0].to != platformdb.DeploymentDeploying {
		t.Fatalf("expected transition to deploying, got: %+v", rolloutStore.transitions)
	}

	// Verify SummitService resource was created in tenant namespace
	gvr := workloads.SchemeGroupVersion.WithResource("summitservices")
	ns := fmt.Sprintf("tenant-%s", userID.String())
	svcName := fmt.Sprintf("svc-%s", serviceID.String())
	obj, err := dynClient.Resource(gvr).Namespace(ns).Get(ctx, svcName, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("expected SummitService to be created: %v", err)
	}
	if obj.GetName() != svcName {
		t.Errorf("expected SummitService name %s, got %s", svcName, obj.GetName())
	}
}

func TestMonitor_DeployingToHealthChecking(t *testing.T) {
	ctx := context.Background()
	depID := uuid.New()
	userID := uuid.New()
	serviceID := uuid.New()

	active := platformdb.ActiveDeployment{
		Deployment: platformdb.Deployment{ID: depID, Status: platformdb.DeploymentDeploying},
		UserID:     userID,
		ServiceID:  serviceID,
	}
	rolloutStore := &mockRolloutStore{activeDeployments: []platformdb.ActiveDeployment{active}}

	ns := fmt.Sprintf("tenant-%s", userID.String())
	svcName := fmt.Sprintf("svc-%s", serviceID.String())
	dep := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: svcName, Namespace: ns},
	}
	kubeClient := fake.NewClientset(dep)

	m, _ := New(rolloutStore, &mockBuildStore{}, kubeClient, nil, nil, nil, DefaultConfig(), nil)

	count, err := m.Step(ctx)
	if err != nil {
		t.Fatalf("step failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 processed, got %d", count)
	}
	if len(rolloutStore.transitions) != 1 || rolloutStore.transitions[0].to != platformdb.DeploymentHealthChecking {
		t.Fatalf("expected transition to health_checking, got: %+v", rolloutStore.transitions)
	}
}

func TestMonitor_HealthCheckingToRunningAndPromote(t *testing.T) {
	ctx := context.Background()
	depID := uuid.New()
	userID := uuid.New()
	serviceID := uuid.New()

	active := platformdb.ActiveDeployment{
		Deployment: platformdb.Deployment{ID: depID, Status: platformdb.DeploymentHealthChecking},
		UserID:     userID,
		ServiceID:  serviceID,
	}
	rolloutStore := &mockRolloutStore{activeDeployments: []platformdb.ActiveDeployment{active}}

	replicas := int32(1)
	ns := fmt.Sprintf("tenant-%s", userID.String())
	svcName := fmt.Sprintf("svc-%s", serviceID.String())
	dep := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: svcName, Namespace: ns},
		Spec:       appsv1.DeploymentSpec{Replicas: &replicas},
		Status: appsv1.DeploymentStatus{
			AvailableReplicas: 1,
			UpdatedReplicas:   1,
		},
	}
	kubeClient := fake.NewClientset(dep)

	m, _ := New(rolloutStore, &mockBuildStore{}, kubeClient, nil, nil, nil, DefaultConfig(), nil)

	count, err := m.Step(ctx)
	if err != nil {
		t.Fatalf("step failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 processed, got %d", count)
	}
	if len(rolloutStore.transitions) != 1 || rolloutStore.transitions[0].to != platformdb.DeploymentRunning {
		t.Fatalf("expected transition to running, got: %+v", rolloutStore.transitions)
	}
	if len(rolloutStore.promoted) != 1 || rolloutStore.promoted[0] != depID {
		t.Fatalf("expected release promotion for %s, got %+v", depID, rolloutStore.promoted)
	}
}

func TestMonitor_UserCancellation(t *testing.T) {
	ctx := context.Background()
	depID := uuid.New()
	buildID := uuid.New()
	attemptID := uuid.New()
	cancelTime := time.Now()

	active := platformdb.ActiveDeployment{
		Deployment: platformdb.Deployment{
			ID:                depID,
			Status:            platformdb.DeploymentBuilding,
			CancelRequestedAt: &cancelTime,
		},
		BuildJob: platformdb.BuildJob{
			ID:        buildID,
			AttemptID: &attemptID,
			Status:    platformdb.BuildRunning,
		},
	}
	rolloutStore := &mockRolloutStore{activeDeployments: []platformdb.ActiveDeployment{active}}
	buildStore := &mockBuildStore{}
	adapter := &mockAdapter{}

	m, _ := New(rolloutStore, buildStore, nil, nil, adapter, nil, DefaultConfig(), nil)

	count, err := m.Step(ctx)
	if err != nil {
		t.Fatalf("step failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 processed, got %d", count)
	}
	if len(rolloutStore.transitions) != 1 || rolloutStore.transitions[0].to != platformdb.DeploymentCancelled {
		t.Fatalf("expected transition to cancelled, got: %+v", rolloutStore.transitions)
	}
	if len(adapter.deletedBuilds) != 1 || adapter.deletedBuilds[0] != attemptID.String() {
		t.Fatalf("expected build pod deletion for attempt %s, got: %+v", attemptID, adapter.deletedBuilds)
	}
	if buildStore.terminalJobs[buildID] != platformdb.BuildCancelled {
		t.Fatalf("expected build job marked cancelled, got: %v", buildStore.terminalJobs[buildID])
	}
}
