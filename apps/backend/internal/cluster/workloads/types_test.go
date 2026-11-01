package workloads

import (
	"errors"
	"strings"
	"testing"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

func validTestSummitService() *SummitService {
	replicas := int32(2)
	return &SummitService{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-service",
			Namespace: "tenant-tenant123",
			UID:       types.UID("svc-uid-456"),
		},
		Spec: SummitServiceSpec{
			Image:          "ghcr.io/summit/test-app@sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
			Replicas:       &replicas,
			Port:           8080,
			PullSecretName: "custom-ghcr-secret",
			TenantID:       "tenant123",
			ProjectID:      "proj456",
			ServiceID:      "srv789",
			ReleaseID:      "rel012",
			Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceCPU:    resource.MustParse("100m"),
					corev1.ResourceMemory: resource.MustParse("128Mi"),
				},
				Limits: corev1.ResourceList{
					corev1.ResourceCPU:    resource.MustParse("500m"),
					corev1.ResourceMemory: resource.MustParse("512Mi"),
				},
			},
		},
	}
}

func validTestPostgresSummitService() *SummitService {
	replicas := int32(1)
	return &SummitService{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-db",
			Namespace: "tenant-tenant123",
			UID:       types.UID("pg-uid-789"),
		},
		Spec: SummitServiceSpec{
			Type:     WorkloadTypePostgres,
			Image:    DefaultPostgresImage,
			Replicas: &replicas,
			Port:     5432,
			TenantID: "tenant123",
			Postgres: &PostgresSpec{
				Version:      "16",
				DatabaseName: "summit",
				Username:     "postgres",
				Storage: PostgresStorageSpec{
					StorageClassName: "standard",
					Size:             "10Gi",
				},
				Auth: PostgresAuthSpec{
					SecretRef: PostgresSecretRef{
						Name: "db-secret",
						Key:  "password",
					},
				},
			},
		},
	}
}

func TestSummitService_Validate_Success(t *testing.T) {
	svc := validTestSummitService()
	if err := svc.Validate(); err != nil {
		t.Fatalf("expected valid service, got error: %v", err)
	}
}

func TestSummitService_Validate_InvalidDigest(t *testing.T) {
	tests := []struct {
		name  string
		image string
	}{
		{"empty image", ""},
		{"tag only without digest", "ghcr.io/summit/test-app:latest"},
		{"tag with commit sha tag but no digest", "ghcr.io/summit/test-app:sha-abcdef"},
		{"digest too short", "ghcr.io/summit/test-app@sha256:abcd"},
		{"digest non-hex", "ghcr.io/summit/test-app@sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d90zz"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := validTestSummitService()
			svc.Spec.Image = tt.image
			err := svc.Validate()
			if err == nil {
				t.Fatalf("expected error for invalid image %q, got nil", tt.image)
			}
		})
	}
}

func TestSummitService_Validate_InvalidPort(t *testing.T) {
	tests := []struct {
		name string
		port int32
	}{
		{"negative port", -1},
		{"port exceeds max", 65536},
		{"large invalid port", 90000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := validTestSummitService()
			svc.Spec.Port = tt.port
			if err := svc.Validate(); err == nil {
				t.Fatalf("expected port validation error for %d, got nil", tt.port)
			}
		})
	}
}

func TestSummitService_Validate_NegativeReplicas(t *testing.T) {
	svc := validTestSummitService()
	neg := int32(-1)
	svc.Spec.Replicas = &neg
	if err := svc.Validate(); err == nil {
		t.Fatalf("expected error for negative replicas, got nil")
	}
}

func TestSummitService_Validate_MissingNameOrNamespace(t *testing.T) {
	svc := validTestSummitService()
	svc.Name = ""
	if err := svc.Validate(); err == nil {
		t.Fatalf("expected error for missing name, got nil")
	}

	svc = validTestSummitService()
	svc.Namespace = ""
	if err := svc.Validate(); err == nil {
		t.Fatalf("expected error for missing namespace, got nil")
	}
}

func TestSummitService_Validate_ResourceBounds(t *testing.T) {
	svc := validTestSummitService()
	// Request CPU higher than limit
	svc.Spec.Resources.Requests[corev1.ResourceCPU] = resource.MustParse("2000m")
	svc.Spec.Resources.Limits[corev1.ResourceCPU] = resource.MustParse("1000m")

	if err := svc.Validate(); err == nil {
		t.Fatalf("expected error when cpu request exceeds limit, got nil")
	}

	// Reset CPU, make memory request exceed limit
	svc = validTestSummitService()
	svc.Spec.Resources.Requests[corev1.ResourceMemory] = resource.MustParse("1Gi")
	svc.Spec.Resources.Limits[corev1.ResourceMemory] = resource.MustParse("512Mi")

	if err := svc.Validate(); err == nil {
		t.Fatalf("expected error when memory request exceeds limit, got nil")
	}
}

func TestSummitService_SetDefaults(t *testing.T) {
	svc := &SummitService{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "simple-app",
			Namespace: "tenant-demo",
		},
		Spec: SummitServiceSpec{
			Image: "ghcr.io/demo/app@sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
		},
	}

	svc.SetDefaults()

	if svc.Spec.Port != DefaultPort {
		t.Errorf("expected default port %d, got %d", DefaultPort, svc.Spec.Port)
	}
	if svc.Spec.Replicas == nil || *svc.Spec.Replicas != DefaultReplicas {
		t.Errorf("expected default replicas %d, got %v", DefaultReplicas, svc.Spec.Replicas)
	}
	if svc.Spec.PullSecretName != DefaultPullSecretName {
		t.Errorf("expected default pull secret %s, got %s", DefaultPullSecretName, svc.Spec.PullSecretName)
	}
	if svc.TypeMeta.APIVersion != "summit.dev/v1alpha1" {
		t.Errorf("expected APIVersion summit.dev/v1alpha1, got %s", svc.TypeMeta.APIVersion)
	}
	if svc.TypeMeta.Kind != KindSummitService {
		t.Errorf("expected Kind SummitService, got %s", svc.TypeMeta.Kind)
	}
}

func TestSummitService_SafeLabelsAndSelectors(t *testing.T) {
	svc := validTestSummitService()
	labels := svc.SafeLabels()

	if labels[LabelTenant] != "tenant123" {
		t.Errorf("expected tenant label tenant123, got %s", labels[LabelTenant])
	}
	if labels[LabelProject] != "proj456" {
		t.Errorf("expected project label proj456, got %s", labels[LabelProject])
	}
	if labels[LabelService] != "srv789" {
		t.Errorf("expected service label srv789, got %s", labels[LabelService])
	}
	if labels[LabelRelease] != "rel012" {
		t.Errorf("expected release label rel012, got %s", labels[LabelRelease])
	}
	if labels[LabelManagedBy] != ValueManagedBy {
		t.Errorf("expected managed-by label %s, got %s", ValueManagedBy, labels[LabelManagedBy])
	}
	if labels[LabelAppComponent] != ValueComponentBackend {
		t.Errorf("expected component label %s, got %s", ValueComponentBackend, labels[LabelAppComponent])
	}

	sel := svc.SelectorLabels()
	if sel[LabelAppName] != "test-service" {
		t.Errorf("expected selector app.kubernetes.io/name to be test-service, got %s", sel[LabelAppName])
	}
	if sel[LabelService] != "srv789" {
		t.Errorf("expected selector summit.dev/service to be srv789, got %s", sel[LabelService])
	}
}

func TestSummitService_MakeOwnerReference(t *testing.T) {
	svc := validTestSummitService()
	ownerRef := svc.MakeOwnerReference()

	if ownerRef.Kind != KindSummitService {
		t.Errorf("expected kind %s, got %s", KindSummitService, ownerRef.Kind)
	}
	if ownerRef.Name != svc.Name {
		t.Errorf("expected name %s, got %s", svc.Name, ownerRef.Name)
	}
	if ownerRef.UID != svc.UID {
		t.Errorf("expected uid %s, got %s", svc.UID, ownerRef.UID)
	}
	if ownerRef.Controller == nil || !*ownerRef.Controller {
		t.Errorf("expected controller to be true")
	}
	if ownerRef.BlockOwnerDeletion == nil || !*ownerRef.BlockOwnerDeletion {
		t.Errorf("expected blockOwnerDeletion to be true")
	}
}

func TestSummitService_Postgres_Validate_Success(t *testing.T) {
	svc := validTestPostgresSummitService()
	if err := svc.Validate(); err != nil {
		t.Fatalf("expected valid postgres service, got error: %v", err)
	}
}

func TestSummitService_Postgres_Validate_Storage(t *testing.T) {
	// Missing StorageClass
	svc := validTestPostgresSummitService()
	svc.Spec.Postgres.Storage.StorageClassName = ""
	if err := svc.Validate(); !errors.Is(err, ErrMissingStorageClass) {
		t.Errorf("expected ErrMissingStorageClass, got %v", err)
	}

	// Missing Size
	svc = validTestPostgresSummitService()
	svc.Spec.Postgres.Storage.Size = ""
	if err := svc.Validate(); !errors.Is(err, ErrMissingStorageSize) {
		t.Errorf("expected ErrMissingStorageSize, got %v", err)
	}

	// Invalid Size
	svc = validTestPostgresSummitService()
	svc.Spec.Postgres.Storage.Size = "invalid-size"
	if err := svc.Validate(); !errors.Is(err, ErrInvalidStorageSize) {
		t.Errorf("expected ErrInvalidStorageSize, got %v", err)
	}

	// Zero or Negative Size
	svc = validTestPostgresSummitService()
	svc.Spec.Postgres.Storage.Size = "0Gi"
	if err := svc.Validate(); !errors.Is(err, ErrInvalidStorageSize) {
		t.Errorf("expected ErrInvalidStorageSize for 0Gi, got %v", err)
	}
}

func TestSummitService_Postgres_Validate_Auth(t *testing.T) {
	// Missing secretRef name
	svc := validTestPostgresSummitService()
	svc.Spec.Postgres.Auth.SecretRef.Name = ""
	if err := svc.Validate(); !errors.Is(err, ErrMissingSecretRefName) {
		t.Errorf("expected ErrMissingSecretRefName, got %v", err)
	}

	// Missing secretRef key
	svc = validTestPostgresSummitService()
	svc.Spec.Postgres.Auth.SecretRef.Key = ""
	if err := svc.Validate(); !errors.Is(err, ErrMissingSecretRefKey) {
		t.Errorf("expected ErrMissingSecretRefKey, got %v", err)
	}

	// Plaintext POSTGRES_PASSWORD in Env is strictly forbidden
	svc = validTestPostgresSummitService()
	svc.Spec.Env = []corev1.EnvVar{
		{Name: "POSTGRES_PASSWORD", Value: "plaintext-secret"},
	}
	if err := svc.Validate(); !errors.Is(err, ErrPlaintextPasswordForbidden) {
		t.Errorf("expected ErrPlaintextPasswordForbidden, got %v", err)
	}

	// Arbitrary environment variables could disable password authentication.
	svc = validTestPostgresSummitService()
	svc.Spec.Env = []corev1.EnvVar{{Name: "POSTGRES_HOST_AUTH_METHOD", Value: "trust"}}
	if err := svc.Validate(); !errors.Is(err, ErrPostgresEnvUnsupported) {
		t.Errorf("expected ErrPostgresEnvUnsupported for auth-bypass environment variable, got %v", err)
	}

	// Password must never be exposed through PGPASSWORD either.
	svc = validTestPostgresSummitService()
	svc.Spec.Env = []corev1.EnvVar{{Name: "PGPASSWORD", Value: "plaintext-secret"}}
	if err := svc.Validate(); !errors.Is(err, ErrPlaintextPasswordForbidden) {
		t.Errorf("expected ErrPlaintextPasswordForbidden for PGPASSWORD, got %v", err)
	}
}

func TestSummitService_Postgres_Validate_IdentifierAndPort(t *testing.T) {
	svc := validTestPostgresSummitService()
	svc.Spec.Postgres.DatabaseName = "Bad-Name"
	if err := svc.Validate(); !errors.Is(err, ErrInvalidPostgresIdentifier) {
		t.Errorf("expected ErrInvalidPostgresIdentifier, got %v", err)
	}

	svc = validTestPostgresSummitService()
	svc.Spec.Postgres.Username = strings.Repeat("a", 64)
	if err := svc.Validate(); !errors.Is(err, ErrInvalidPostgresIdentifier) {
		t.Errorf("expected ErrInvalidPostgresIdentifier for overlong username, got %v", err)
	}

	svc = validTestPostgresSummitService()
	svc.Spec.Port = 5433
	if err := svc.Validate(); !errors.Is(err, ErrInvalidPostgresPort) {
		t.Errorf("expected ErrInvalidPostgresPort, got %v", err)
	}
}

func TestSummitService_Postgres_Validate_VersionAndReplicas(t *testing.T) {
	// Unsupported major version
	svc := validTestPostgresSummitService()
	svc.Spec.Postgres.Version = "15"
	if err := svc.Validate(); !errors.Is(err, ErrUnsupportedPostgresVersion) {
		t.Errorf("expected ErrUnsupportedPostgresVersion, got %v", err)
	}

	// Replicas != 1
	svc = validTestPostgresSummitService()
	two := int32(2)
	svc.Spec.Replicas = &two
	if err := svc.Validate(); !errors.Is(err, ErrInvalidPostgresReplicas) {
		t.Errorf("expected ErrInvalidPostgresReplicas, got %v", err)
	}

	zero := int32(0)
	svc = validTestPostgresSummitService()
	svc.Spec.Replicas = &zero
	if err := svc.Validate(); !errors.Is(err, ErrInvalidPostgresReplicas) {
		t.Errorf("expected ErrInvalidPostgresReplicas for 0 replicas, got %v", err)
	}
}

func TestSummitService_Postgres_Validate_ConflictingWorkloadType(t *testing.T) {
	svc := validTestSummitService()
	svc.Spec.Type = WorkloadTypeBackend
	svc.Spec.Postgres = &PostgresSpec{
		Storage: PostgresStorageSpec{StorageClassName: "standard", Size: "10Gi"},
		Auth:    PostgresAuthSpec{SecretRef: PostgresSecretRef{Name: "sec", Key: "k"}},
	}
	if err := svc.Validate(); !errors.Is(err, ErrConflictingWorkloadType) {
		t.Errorf("expected ErrConflictingWorkloadType, got %v", err)
	}
}

func TestSummitService_Postgres_Validate_ConflictingImages(t *testing.T) {
	svc := validTestPostgresSummitService()
	svc.Spec.Image = "postgres:16.8-alpine@sha256:4b13ee42a59f518e9d9e489c6ec7a8dbf5bdfd313d4bfaea102606558e8e7cbe"
	svc.Spec.Postgres.Image = "postgres:16.8-alpine@sha256:1111111111111111111111111111111111111111111111111111111111111111"
	if err := svc.Validate(); err == nil {
		t.Errorf("expected error for conflicting images, got nil")
	}
}

func TestSummitService_Postgres_SetDefaults(t *testing.T) {
	svc := &SummitService{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "default-pg",
			Namespace: "tenant-demo",
		},
		Spec: SummitServiceSpec{
			Type: WorkloadTypePostgres,
			Postgres: &PostgresSpec{
				Storage: PostgresStorageSpec{
					StorageClassName: "fast-csi",
					Size:             "20Gi",
				},
				Auth: PostgresAuthSpec{
					SecretRef: PostgresSecretRef{Name: "sec", Key: "pwd"},
				},
			},
		},
	}

	svc.SetDefaults()

	if svc.Spec.Port != DefaultPostgresPort {
		t.Errorf("expected default postgres port %d, got %d", DefaultPostgresPort, svc.Spec.Port)
	}
	if svc.Spec.Replicas == nil || *svc.Spec.Replicas != 1 {
		t.Errorf("expected default postgres replicas 1, got %v", svc.Spec.Replicas)
	}
	if svc.Spec.Postgres.Version != DefaultPostgresMajorVersion {
		t.Errorf("expected default postgres version %s, got %s", DefaultPostgresMajorVersion, svc.Spec.Postgres.Version)
	}
	if svc.Spec.Postgres.DatabaseName != DefaultPostgresDatabase {
		t.Errorf("expected default database name %s, got %s", DefaultPostgresDatabase, svc.Spec.Postgres.DatabaseName)
	}
	if svc.Spec.Postgres.Username != DefaultPostgresUser {
		t.Errorf("expected default username %s, got %s", DefaultPostgresUser, svc.Spec.Postgres.Username)
	}
	if svc.Spec.Image != DefaultPostgresImage {
		t.Errorf("expected default postgres image %s, got %s", DefaultPostgresImage, svc.Spec.Image)
	}
}

func TestSummitService_Postgres_SafeLabelsAndSelectors(t *testing.T) {
	svc := validTestPostgresSummitService()
	labels := svc.SafeLabels()

	if labels[LabelAppComponent] != ValueComponentDatabase {
		t.Errorf("expected component label %s for postgres, got %s", ValueComponentDatabase, labels[LabelAppComponent])
	}
	if labels[LabelManagedBy] != ValueManagedBy {
		t.Errorf("expected managed-by label %s, got %s", ValueManagedBy, labels[LabelManagedBy])
	}

	sel := svc.SelectorLabels()
	if sel[LabelAppComponent] != ValueComponentDatabase {
		t.Errorf("expected selector component %s for postgres, got %s", ValueComponentDatabase, sel[LabelAppComponent])
	}
}
