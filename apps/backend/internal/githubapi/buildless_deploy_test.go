package githubapi

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/catalog"
	"github.com/summit/backend/internal/platformdb"
)

type buildlessStoreStub struct {
	service *platformdb.Service
	image   *platformdb.ServiceImageSource
	addon   *platformdb.ServiceAddon
}

func (s buildlessStoreStub) GetServiceForUser(context.Context, uuid.UUID, uuid.UUID) (*platformdb.Service, error) {
	return s.service, nil
}
func (s buildlessStoreStub) GetServiceImageSource(context.Context, uuid.UUID, uuid.UUID) (*platformdb.ServiceImageSource, error) {
	return s.image, nil
}
func (s buildlessStoreStub) GetServiceAddon(context.Context, uuid.UUID, uuid.UUID) (*platformdb.ServiceAddon, error) {
	return s.addon, nil
}

type buildlessDeployStub struct {
	imageParams platformdb.CreateImageDeploymentParams
	addonParams platformdb.CreateAddonDeploymentParams
	result      *platformdb.CreateDeploymentResult
}

func (s *buildlessDeployStub) CreateImageDeployment(_ context.Context, p platformdb.CreateImageDeploymentParams) (*platformdb.CreateDeploymentResult, error) {
	s.imageParams = p
	return s.result, nil
}
func (s *buildlessDeployStub) CreateAddonDeployment(_ context.Context, p platformdb.CreateAddonDeploymentParams) (*platformdb.CreateDeploymentResult, error) {
	s.addonParams = p
	return s.result, nil
}

func TestCreateBuildlessDeploymentResolvesImageAndQueuesIt(t *testing.T) {
	userID, serviceID, deploymentID := uuid.New(), uuid.New(), uuid.New()
	deployments := &buildlessDeployStub{result: &platformdb.CreateDeploymentResult{
		Deployment: platformdb.Deployment{ID: deploymentID, Status: platformdb.DeploymentImageReady},
	}}
	var resolvedInput string
	svc := &Service{
		platformStore:   buildlessStoreStub{image: &platformdb.ServiceImageSource{Image: "nginx:1.27"}},
		deploymentStore: deployments,
		resolveImage: func(_ context.Context, ref string) (string, error) {
			resolvedInput = ref
			return "docker.io/library/nginx@sha256:" + strings.Repeat("a", 64), nil
		},
	}

	got, err := svc.createBuildlessDeployment(context.Background(), platformdb.ServiceTypeImage, serviceID, userID, "image-key")
	if err != nil {
		t.Fatal(err)
	}
	if resolvedInput != "nginx:1.27" || deployments.imageParams.ImageRef != "docker.io/library/nginx@sha256:"+strings.Repeat("a", 64) {
		t.Fatalf("image was not resolved and pinned: input=%q params=%+v", resolvedInput, deployments.imageParams)
	}
	if deployments.imageParams.UserID != userID || deployments.imageParams.ServiceID != serviceID || deployments.imageParams.IdempotencyKey != "image-key" {
		t.Fatalf("deployment scope/idempotency not forwarded: %+v", deployments.imageParams)
	}
	if got.ID != deploymentID || got.Status != string(platformdb.DeploymentImageReady) || got.BuildJobID != nil {
		t.Fatalf("unexpected buildless response: %+v", got)
	}
}

func TestCreateBuildlessDeploymentUsesPinnedAddonCatalogImage(t *testing.T) {
	userID, serviceID, deploymentID := uuid.New(), uuid.New(), uuid.New()
	deployments := &buildlessDeployStub{result: &platformdb.CreateDeploymentResult{
		Deployment: platformdb.Deployment{ID: deploymentID, Status: platformdb.DeploymentImageReady},
	}}
	svc := &Service{
		platformStore:   buildlessStoreStub{addon: &platformdb.ServiceAddon{Engine: "postgres", Version: "16-alpine"}},
		deploymentStore: deployments,
	}

	got, err := svc.createBuildlessDeployment(context.Background(), platformdb.ServiceTypePostgres, serviceID, userID, "pg-key")
	if err != nil {
		t.Fatal(err)
	}
	pinned, ok := catalog.AddonFor("postgres")
	if !ok || deployments.addonParams.ImageRef != pinned.Image {
		t.Fatalf("expected catalog's pinned image %q, got %+v", pinned.Image, deployments.addonParams)
	}
	if deployments.addonParams.IdempotencyKey != "pg-key" || got.BuildJobID != nil {
		t.Fatalf("unexpected addon deployment result: params=%+v response=%+v", deployments.addonParams, got)
	}
}

func TestCreateBuildlessDeploymentRejectsImageResolutionFailure(t *testing.T) {
	svc := &Service{
		platformStore:   buildlessStoreStub{image: &platformdb.ServiceImageSource{Image: "private/image:tag"}},
		deploymentStore: &buildlessDeployStub{},
		resolveImage:    func(context.Context, string) (string, error) { return "", errors.New("unauthorized") },
		logger:          slog.Default(),
	}
	_, err := svc.createBuildlessDeployment(context.Background(), platformdb.ServiceTypeImage, uuid.New(), uuid.New(), "key")
	var apiErr interface{ Error() string }
	if !errors.As(err, &apiErr) || !strings.Contains(apiErr.Error(), "could not resolve image") {
		t.Fatalf("expected a clear image resolution error, got %v", err)
	}
}
