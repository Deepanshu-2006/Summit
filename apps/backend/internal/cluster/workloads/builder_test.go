package workloads

import (
	"testing"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

func TestBuildNamespace(t *testing.T) {
	ns := BuildNamespace("tenant-abc", "tenant-12345")
	if ns.Name != "tenant-abc" {
		t.Errorf("expected namespace name tenant-abc, got %s", ns.Name)
	}
	if ns.Labels[LabelTenant] != "tenant-12345" {
		t.Errorf("expected tenant label tenant-12345, got %s", ns.Labels[LabelTenant])
	}
	if ns.Labels[LabelManagedBy] != ValueManagedBy {
		t.Errorf("expected managed-by label %s, got %s", ValueManagedBy, ns.Labels[LabelManagedBy])
	}
}

func TestBuildDeployment_HardenedSecurityAndDigest(t *testing.T) {
	replicas := int32(3)
	svc := &SummitService{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "web-api",
			Namespace: "tenant-demo",
			UID:       types.UID("svc-uuid-001"),
		},
		Spec: SummitServiceSpec{
			Image:          "ghcr.io/owner/repo@sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
			Replicas:       &replicas,
			Port:           9000,
			PullSecretName: "custom-pull-secret",
			TenantID:       "tenant-demo",
			ProjectID:      "proj-1",
			ServiceID:      "srv-web",
			ReleaseID:      "rel-1",
			Env: []corev1.EnvVar{
				{Name: "PORT", Value: "9000"},
				{Name: "NODE_ENV", Value: "production"},
			},
			Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceCPU:    resource.MustParse("200m"),
					corev1.ResourceMemory: resource.MustParse("256Mi"),
				},
				Limits: corev1.ResourceList{
					corev1.ResourceCPU:    resource.MustParse("1000m"),
					corev1.ResourceMemory: resource.MustParse("1Gi"),
				},
			},
		},
	}

	dep, err := BuildDeployment(svc)
	if err != nil {
		t.Fatalf("unexpected BuildDeployment error: %v", err)
	}

	// 1. Metadata & Labels
	if dep.Name != "web-api" || dep.Namespace != "tenant-demo" {
		t.Fatalf("unexpected name/namespace: %s/%s", dep.Namespace, dep.Name)
	}
	if dep.Labels[LabelTenant] != "tenant-demo" {
		t.Errorf("expected tenant label, got %v", dep.Labels)
	}
	if len(dep.OwnerReferences) != 1 || dep.OwnerReferences[0].Name != "web-api" {
		t.Errorf("expected owner reference to web-api, got %+v", dep.OwnerReferences)
	}

	// 2. Spec, Replicas, Strategy
	if *dep.Spec.Replicas != 3 {
		t.Errorf("expected 3 replicas, got %d", *dep.Spec.Replicas)
	}
	if dep.Spec.Strategy.RollingUpdate == nil {
		t.Fatalf("expected rolling update strategy")
	}

	// 3. Pod Template Security Context
	podSec := dep.Spec.Template.Spec.SecurityContext
	if podSec == nil {
		t.Fatalf("expected pod security context to be configured")
	}
	if podSec.RunAsNonRoot == nil || !*podSec.RunAsNonRoot {
		t.Errorf("expected RunAsNonRoot true")
	}
	if podSec.RunAsUser == nil || *podSec.RunAsUser != 1000 {
		t.Errorf("expected RunAsUser 1000")
	}
	if podSec.SeccompProfile == nil || podSec.SeccompProfile.Type != corev1.SeccompProfileTypeRuntimeDefault {
		t.Errorf("expected RuntimeDefault seccomp profile")
	}

	// 4. Image Pull Secrets
	if len(dep.Spec.Template.Spec.ImagePullSecrets) != 1 || dep.Spec.Template.Spec.ImagePullSecrets[0].Name != "custom-pull-secret" {
		t.Errorf("expected custom-pull-secret, got %+v", dep.Spec.Template.Spec.ImagePullSecrets)
	}

	// 5. Container Hardening & Immutable Digest
	if len(dep.Spec.Template.Spec.Containers) != 1 {
		t.Fatalf("expected 1 container, got %d", len(dep.Spec.Template.Spec.Containers))
	}
	c := dep.Spec.Template.Spec.Containers[0]
	if c.Image != svc.Spec.Image {
		t.Errorf("expected image digest preserved exactly, got %s", c.Image)
	}
	if c.SecurityContext == nil || c.SecurityContext.AllowPrivilegeEscalation == nil || *c.SecurityContext.AllowPrivilegeEscalation {
		t.Errorf("expected AllowPrivilegeEscalation false")
	}
	if c.SecurityContext.Capabilities == nil || len(c.SecurityContext.Capabilities.Drop) != 1 || c.SecurityContext.Capabilities.Drop[0] != "ALL" {
		t.Errorf("expected capabilities drop ALL")
	}

	// 6. Ports, Probes, Resources
	if len(c.Ports) != 1 || c.Ports[0].ContainerPort != 9000 {
		t.Errorf("expected container port 9000, got %+v", c.Ports)
	}
	if c.LivenessProbe == nil || c.LivenessProbe.TCPSocket.Port.IntVal != 9000 {
		t.Errorf("expected liveness probe on port 9000")
	}
	if c.ReadinessProbe == nil || c.ReadinessProbe.TCPSocket.Port.IntVal != 9000 {
		t.Errorf("expected readiness probe on port 9000")
	}
	if c.Resources.Requests.Cpu().String() != "200m" {
		t.Errorf("expected requested cpu 200m, got %s", c.Resources.Requests.Cpu().String())
	}
	if c.Resources.Limits.Memory().String() != "1Gi" {
		t.Errorf("expected memory limit 1Gi, got %s", c.Resources.Limits.Memory().String())
	}
}

func TestBuildService_ClusterIP(t *testing.T) {
	svc := &SummitService{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "web-api",
			Namespace: "tenant-demo",
			UID:       types.UID("svc-uuid-001"),
		},
		Spec: SummitServiceSpec{
			Image:     "ghcr.io/owner/repo@sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
			Port:      8080,
			TenantID:  "tenant-demo",
			ServiceID: "srv-web",
		},
	}

	k8sSvc, err := BuildService(svc)
	if err != nil {
		t.Fatalf("unexpected BuildService error: %v", err)
	}

	if k8sSvc.Spec.Type != corev1.ServiceTypeClusterIP {
		t.Errorf("expected ClusterIP service type, got %s", k8sSvc.Spec.Type)
	}
	if len(k8sSvc.Spec.Ports) != 1 || k8sSvc.Spec.Ports[0].Port != 8080 || k8sSvc.Spec.Ports[0].TargetPort.IntVal != 8080 {
		t.Errorf("expected port 8080 targeting 8080, got %+v", k8sSvc.Spec.Ports)
	}
	if k8sSvc.Spec.Selector[LabelAppName] != "web-api" || k8sSvc.Spec.Selector[LabelService] != "srv-web" {
		t.Errorf("expected matching selectors, got %+v", k8sSvc.Spec.Selector)
	}
	if len(k8sSvc.OwnerReferences) != 1 || k8sSvc.OwnerReferences[0].Name != "web-api" {
		t.Errorf("expected owner reference on service")
	}
}
