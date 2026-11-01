package monitor

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/cluster/addons"
	"github.com/summit/backend/internal/cluster/managed"
	"github.com/summit/backend/internal/cluster/workloads"
	"github.com/summit/backend/internal/platformdb"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	dynfake "k8s.io/client-go/dynamic/fake"
)

type fakeExposure struct {
	calls []addons.ExposureParams
	host  string
}

func (f *fakeExposure) EnsureTenant(context.Context, string) (addons.Result, error) {
	return addons.Result{}, nil
}

func (f *fakeExposure) EnsureServiceExposure(_ context.Context, params addons.ExposureParams) (addons.Result, error) {
	f.calls = append(f.calls, params)
	if params.SkipIngress {
		return addons.Result{}, nil
	}
	return addons.Result{Host: f.host}, nil
}

type fakeManaged struct {
	reqs  []managed.Request
	ready bool
	image string
}

func (f *fakeManaged) Provision(_ context.Context, req managed.Request) (managed.Result, error) {
	f.reqs = append(f.reqs, req)
	image := f.image
	if image == "" {
		if addon, ok := managed.DefaultCatalog().AddonFor(req.Engine); ok {
			image = addon.Image
		}
	}
	return managed.Result{Name: "addon-" + req.ServiceID, Namespace: req.Namespace, Image: image, CreatedSecret: true}, nil
}

func (f *fakeManaged) Ready(context.Context, string, string) (bool, bool, error) {
	return true, f.ready, nil
}

type fakeAddons struct {
	rows []EnvironmentAddon
}

func (f fakeAddons) ListEnvironmentAddons(context.Context, uuid.UUID) ([]EnvironmentAddon, error) {
	return f.rows, nil
}

func digestRef() string {
	return "ghcr.io/myorg/app@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
}

func TestMonitor_ImageReadyWithoutBuildJob(t *testing.T) {
	ctx := context.Background()
	userID, serviceID, envID := uuid.New(), uuid.New(), uuid.New()
	imageRef := digestRef()
	pg := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	active := platformdb.ActiveDeployment{
		Deployment:      platformdb.Deployment{ID: uuid.New(), Status: platformdb.DeploymentImageReady, ImageRef: &imageRef},
		UserID:          userID,
		ProjectID:       uuid.New(),
		ProjectSlug:     "shop",
		EnvironmentID:   envID,
		EnvironmentName: "production",
		ServiceID:       serviceID,
		ServiceName:     "api",
		ServiceType:     "image",
		Resources: platformdb.ServiceResources{
			Port: 3000, MinReplicas: 1,
			CPURequestMillicores: 50, CPULimitMillicores: 200,
			MemoryRequestMB: 64, MemoryLimitMB: 128,
		},
	}
	rollout := &mockRolloutStore{activeDeployments: []platformdb.ActiveDeployment{active}}
	buildStore := &mockBuildStore{}
	exposure := &fakeExposure{host: "api-shop.localtest.me"}
	lister := fakeAddons{rows: []EnvironmentAddon{{ServiceID: pg, ServiceName: "db", Engine: "postgres", Port: 5432}}}
	cfg := DefaultConfig()
	cfg.PublicURLScheme = "http"
	cfg.PublicURLPort = "8080"
	m, err := New(rollout, buildStore, nil, dynfake.NewSimpleDynamicClient(runtime.NewScheme()), nil, exposure, cfg, nil, WithAddonLister(lister))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := m.Step(ctx); err != nil {
		t.Fatal(err)
	}
	if len(buildStore.terminalJobs) != 0 {
		t.Fatal("image deployment must not touch a build job")
	}
	if len(rollout.transitions) != 1 || rollout.transitions[0].to != platformdb.DeploymentDeploying {
		t.Fatalf("transition %+v", rollout.transitions)
	}
	if rollout.transitions[0].imageRef != imageRef {
		t.Fatalf("image ref %q", rollout.transitions[0].imageRef)
	}
	if rollout.transitions[0].publicURL != "http://api-shop.localtest.me:8080" {
		t.Fatalf("public url %q", rollout.transitions[0].publicURL)
	}
	if len(exposure.calls) != 1 || exposure.calls[0].SkipIngress || exposure.calls[0].HostLabel != "api" {
		t.Fatalf("exposure %+v", exposure.calls)
	}
	gvr := workloads.SchemeGroupVersion.WithResource("summitservices")
	obj, err := m.dynClient.Resource(gvr).Namespace("tenant-"+userID.String()).Get(ctx, "svc-"+serviceID.String(), metav1.GetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	env, found, err := unstructured.NestedSlice(obj.Object, "spec", "env")
	if err != nil || !found {
		t.Fatalf("env missing: found=%v err=%v spec=%v", found, err, obj.Object["spec"])
	}
	var sawDB bool
	for _, item := range env {
		row, _ := item.(map[string]any)
		if row["name"] == "DATABASE_URL" {
			sawDB = true
		}
	}
	if !sawDB {
		t.Fatalf("DATABASE_URL missing from spec: %v", obj.Object["spec"])
	}
}

func TestMonitor_WorkerSkipsIngress(t *testing.T) {
	ctx := context.Background()
	userID, serviceID := uuid.New(), uuid.New()
	imageRef := digestRef()
	active := platformdb.ActiveDeployment{
		Deployment:      platformdb.Deployment{ID: uuid.New(), Status: platformdb.DeploymentImageReady, ImageRef: &imageRef},
		UserID:          userID,
		ProjectSlug:     "shop",
		EnvironmentName: "staging",
		ServiceID:       serviceID,
		ServiceName:     "jobs",
		ServiceType:     "worker",
		Resources: platformdb.ServiceResources{
			Port: 8080, MinReplicas: 1,
			CPURequestMillicores: 50, CPULimitMillicores: 200,
			MemoryRequestMB: 64, MemoryLimitMB: 128,
		},
	}
	rollout := &mockRolloutStore{activeDeployments: []platformdb.ActiveDeployment{active}}
	exposure := &fakeExposure{host: "should-not-be-used.localtest.me"}
	m, err := New(rollout, &mockBuildStore{}, nil, dynfake.NewSimpleDynamicClient(runtime.NewScheme()), nil, exposure, DefaultConfig(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := m.Step(ctx); err != nil {
		t.Fatal(err)
	}
	if len(exposure.calls) != 1 || !exposure.calls[0].SkipIngress {
		t.Fatalf("worker must skip ingress: %+v", exposure.calls)
	}
	if exposure.calls[0].Environment != "staging" || exposure.calls[0].HostLabel != "jobs" {
		t.Fatalf("host inputs %+v", exposure.calls[0])
	}
	if rollout.transitions[0].publicURL != "" {
		t.Fatalf("worker public url %q", rollout.transitions[0].publicURL)
	}
	if rollout.transitions[0].to != platformdb.DeploymentDeploying {
		t.Fatalf("transition %+v", rollout.transitions)
	}
}

func TestMonitor_AddonImageReadyHasNoIngress(t *testing.T) {
	ctx := context.Background()
	userID, serviceID := uuid.New(), uuid.New()
	active := platformdb.ActiveDeployment{
		Deployment:  platformdb.Deployment{ID: uuid.New(), Status: platformdb.DeploymentImageReady},
		UserID:      userID,
		ProjectID:   uuid.New(),
		ServiceID:   serviceID,
		ServiceType: "postgres",
		Resources:   platformdb.ServiceResources{CPURequestMillicores: 100, CPULimitMillicores: 500, MemoryRequestMB: 256, MemoryLimitMB: 512},
	}
	rollout := &mockRolloutStore{activeDeployments: []platformdb.ActiveDeployment{active}}
	exposure := &fakeExposure{host: "nope.localtest.me"}
	prov := &fakeManaged{}
	sizer := volumeSizerFunc(func(uuid.UUID) (int, error) { return 2048, nil })
	m, err := New(rollout, &mockBuildStore{}, nil, nil, nil, exposure, DefaultConfig(), nil, WithManagedAddon(prov), WithVolumeSizer(sizer))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := m.Step(ctx); err != nil {
		t.Fatal(err)
	}
	if len(exposure.calls) != 0 {
		t.Fatalf("addon must not be exposed: %+v", exposure.calls)
	}
	if len(prov.reqs) != 1 || prov.reqs[0].Engine != "postgres" || prov.reqs[0].StorageMB != 2048 || prov.reqs[0].Namespace != "tenant-"+userID.String() {
		t.Fatalf("provision %+v", prov.reqs)
	}
	if rollout.transitions[0].to != platformdb.DeploymentDeploying || rollout.transitions[0].imageRef != "postgres:16-alpine" || rollout.transitions[0].publicURL != "" {
		t.Fatalf("transition %+v", rollout.transitions[0])
	}
}

func TestMonitor_AddonBecomesRunningWhenStatefulSetReady(t *testing.T) {
	ctx := context.Background()
	depID := uuid.New()
	active := platformdb.ActiveDeployment{
		Deployment:  platformdb.Deployment{ID: depID, Status: platformdb.DeploymentHealthChecking},
		UserID:      uuid.New(),
		ServiceID:   uuid.New(),
		ServiceType: "redis",
	}
	rollout := &mockRolloutStore{activeDeployments: []platformdb.ActiveDeployment{active}}
	m, err := New(rollout, &mockBuildStore{}, nil, nil, nil, nil, DefaultConfig(), nil, WithManagedAddon(&fakeManaged{ready: true}))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := m.Step(ctx); err != nil {
		t.Fatal(err)
	}
	if rollout.transitions[0].to != platformdb.DeploymentRunning {
		t.Fatalf("transition %+v", rollout.transitions)
	}
	if len(rollout.promoted) != 1 {
		t.Fatal("expected promote")
	}
}

type volumeSizerFunc func(uuid.UUID) (int, error)

func (f volumeSizerFunc) AddonStorageMB(_ context.Context, id uuid.UUID) (int, error) {
	return f(id)
}
