package workloads

import (
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
