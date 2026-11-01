package workloads

import (
	"strings"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
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

func TestBuildPostgresStatefulSet(t *testing.T) {
	svc := validTestPostgresSummitService()

	sts, err := BuildPostgresStatefulSet(svc)
	if err != nil {
		t.Fatalf("unexpected BuildPostgresStatefulSet error: %v", err)
	}

	// 1. Metadata & Labels
	if sts.Name != "test-db" || sts.Namespace != "tenant-tenant123" {
		t.Fatalf("unexpected name/namespace: %s/%s", sts.Namespace, sts.Name)
	}
	if sts.Labels[LabelAppComponent] != ValueComponentDatabase {
		t.Errorf("expected component label %s, got %s", ValueComponentDatabase, sts.Labels[LabelAppComponent])
	}
	if len(sts.OwnerReferences) != 1 || sts.OwnerReferences[0].Name != "test-db" {
		t.Errorf("expected owner reference on statefulset, got %+v", sts.OwnerReferences)
	}

	// 2. Replicas and Headless Service
	if sts.Spec.Replicas == nil || *sts.Spec.Replicas != 1 {
		t.Fatalf("expected exactly 1 replica for postgres StatefulSet")
	}
	if sts.Spec.ServiceName != "test-db-headless" {
		t.Errorf("expected governing service name test-db-headless, got %s", sts.Spec.ServiceName)
	}
	if sts.Spec.PodManagementPolicy != appsv1.OrderedReadyPodManagement {
		t.Errorf("expected OrderedReadyPodManagement, got %s", sts.Spec.PodManagementPolicy)
	}
	if sts.Spec.UpdateStrategy.Type != appsv1.RollingUpdateStatefulSetStrategyType {
		t.Errorf("expected RollingUpdate strategy, got %s", sts.Spec.UpdateStrategy.Type)
	}

	// 3. PVC Retention Policy
	if sts.Spec.PersistentVolumeClaimRetentionPolicy == nil {
		t.Fatalf("expected PersistentVolumeClaimRetentionPolicy to be set")
	}
	if sts.Spec.PersistentVolumeClaimRetentionPolicy.WhenDeleted != appsv1.RetainPersistentVolumeClaimRetentionPolicyType {
		t.Errorf("expected WhenDeleted=Retain, got %s", sts.Spec.PersistentVolumeClaimRetentionPolicy.WhenDeleted)
	}
	if sts.Spec.PersistentVolumeClaimRetentionPolicy.WhenScaled != appsv1.RetainPersistentVolumeClaimRetentionPolicyType {
		t.Errorf("expected WhenScaled=Retain, got %s", sts.Spec.PersistentVolumeClaimRetentionPolicy.WhenScaled)
	}

	// 4. VolumeClaimTemplates: Verify explicit StorageClass and size, and lack of OwnerReferences
	if len(sts.Spec.VolumeClaimTemplates) != 1 {
		t.Fatalf("expected 1 VolumeClaimTemplate, got %d", len(sts.Spec.VolumeClaimTemplates))
	}
	pvc := sts.Spec.VolumeClaimTemplates[0]
	if pvc.Name != "postgres-data" {
		t.Errorf("expected PVC template name postgres-data, got %s", pvc.Name)
	}
	if len(pvc.OwnerReferences) != 0 {
		t.Errorf("expected NO owner references on VolumeClaimTemplates so PVC survives CR deletion, got %+v", pvc.OwnerReferences)
	}
	if pvc.Spec.StorageClassName == nil || *pvc.Spec.StorageClassName != "standard" {
		t.Errorf("expected StorageClassName standard, got %v", pvc.Spec.StorageClassName)
	}
	if pvc.Spec.Resources.Requests.Storage().String() != "10Gi" {
		t.Errorf("expected storage request 10Gi, got %s", pvc.Spec.Resources.Requests.Storage().String())
	}
	if len(pvc.Spec.AccessModes) != 1 || pvc.Spec.AccessModes[0] != corev1.ReadWriteOnce {
		t.Errorf("expected ReadWriteOnce access mode, got %v", pvc.Spec.AccessModes)
	}

	// 5. Pod Security Context: Hardened non-root (UID 70) and Seccomp RuntimeDefault
	podSec := sts.Spec.Template.Spec.SecurityContext
	if podSec == nil {
		t.Fatalf("expected pod security context")
	}
	if podSec.RunAsNonRoot == nil || !*podSec.RunAsNonRoot {
		t.Errorf("expected RunAsNonRoot true")
	}
	if podSec.RunAsUser == nil || *podSec.RunAsUser != 70 {
		t.Errorf("expected RunAsUser 70 (postgres), got %v", podSec.RunAsUser)
	}
	if podSec.RunAsGroup == nil || *podSec.RunAsGroup != 70 {
		t.Errorf("expected RunAsGroup 70, got %v", podSec.RunAsGroup)
	}
	if podSec.FSGroup == nil || *podSec.FSGroup != 70 {
		t.Errorf("expected FSGroup 70, got %v", podSec.FSGroup)
	}
	if podSec.SeccompProfile == nil || podSec.SeccompProfile.Type != corev1.SeccompProfileTypeRuntimeDefault {
		t.Errorf("expected SeccompProfile RuntimeDefault")
	}

	// 6. Container Security & Mounts
	if len(sts.Spec.Template.Spec.Containers) != 1 {
		t.Fatalf("expected 1 container, got %d", len(sts.Spec.Template.Spec.Containers))
	}
	c := sts.Spec.Template.Spec.Containers[0]
	if c.SecurityContext == nil {
		t.Fatalf("expected container security context")
	}
	if c.SecurityContext.ReadOnlyRootFilesystem == nil || !*c.SecurityContext.ReadOnlyRootFilesystem {
		t.Errorf("expected ReadOnlyRootFilesystem true")
	}
	if c.SecurityContext.AllowPrivilegeEscalation == nil || *c.SecurityContext.AllowPrivilegeEscalation {
		t.Errorf("expected AllowPrivilegeEscalation false")
	}
	if c.SecurityContext.Capabilities == nil || len(c.SecurityContext.Capabilities.Drop) != 1 || c.SecurityContext.Capabilities.Drop[0] != "ALL" {
		t.Errorf("expected drop ALL capabilities")
	}

	// Verify mounts: data, tmp, run
	mountMap := make(map[string]corev1.VolumeMount)
	for _, m := range c.VolumeMounts {
		mountMap[m.Name] = m
	}
	if dataMount, ok := mountMap["postgres-data"]; !ok || dataMount.MountPath != "/var/lib/postgresql/data" || dataMount.SubPath != "pgdata" {
		t.Errorf("expected postgres-data mount at /var/lib/postgresql/data with SubPath pgdata, got %+v", dataMount)
	}
	if tmpMount, ok := mountMap["tmp"]; !ok || tmpMount.MountPath != "/tmp" {
		t.Errorf("expected tmp mount at /tmp, got %+v", tmpMount)
	}
	if runMount, ok := mountMap["run"]; !ok || runMount.MountPath != "/var/run/postgresql" {
		t.Errorf("expected run mount at /var/run/postgresql, got %+v", runMount)
	}

	// 7. Password mounted from a read-only Secret file and probes
	foundPasswordFile := false
	for _, env := range c.Env {
		if env.Name == "POSTGRES_PASSWORD_FILE" && env.Value == "/run/secrets/postgres/password" {
			foundPasswordFile = true
		}
	}
	if !foundPasswordFile {
		t.Errorf("expected POSTGRES_PASSWORD_FILE to reference mounted password file")
	}
	foundAuthVolume := false
	for _, v := range sts.Spec.Template.Spec.Volumes {
		if v.Name == "postgres-auth" && v.Secret != nil {
			foundAuthVolume = v.Secret.SecretName == "db-secret" && len(v.Secret.Items) == 1 && v.Secret.Items[0].Key == "password" && v.Secret.Items[0].Path == "password"
		}
	}
	if !foundAuthVolume {
		t.Errorf("expected db-secret/password to be projected as a Secret volume")
	}
	if authMount, ok := mountMap["postgres-auth"]; !ok || authMount.MountPath != "/run/secrets/postgres" || !authMount.ReadOnly {
		t.Errorf("expected read-only postgres auth mount, got %+v", authMount)
	}

	if c.StartupProbe == nil || c.ReadinessProbe == nil || c.LivenessProbe == nil {
		t.Fatalf("expected startup, readiness, and liveness probes all configured")
	}
	if !strings.Contains(strings.Join(c.StartupProbe.Exec.Command, " "), "pg_isready") {
		t.Errorf("expected startup probe to use pg_isready")
	}
	if !strings.Contains(strings.Join(c.ReadinessProbe.Exec.Command, " "), "pg_isready") {
		t.Errorf("expected readiness probe to use pg_isready")
	}
	if !strings.Contains(strings.Join(c.LivenessProbe.Exec.Command, " "), "pg_isready") {
		t.Errorf("expected liveness probe to use pg_isready")
	}
}

func TestBuildDeployment_Postgres_ReturnsError(t *testing.T) {
	svc := validTestPostgresSummitService()
	_, err := BuildDeployment(svc)
	if err == nil {
		t.Fatalf("expected error building Deployment for postgres workload, got nil")
	}
}

func TestBuildPostgresHeadlessService(t *testing.T) {
	svc := validTestPostgresSummitService()
	svc.Spec.Port = 5432

	hl, err := BuildPostgresHeadlessService(svc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if hl.Name != "test-db-headless" {
		t.Errorf("expected test-db-headless, got %s", hl.Name)
	}
	if hl.Spec.ClusterIP != corev1.ClusterIPNone {
		t.Errorf("expected ClusterIP None, got %s", hl.Spec.ClusterIP)
	}
	if !hl.Spec.PublishNotReadyAddresses {
		t.Errorf("expected PublishNotReadyAddresses true")
	}
	if hl.Spec.Ports[0].Port != 5432 {
		t.Errorf("expected port 5432, got %d", hl.Spec.Ports[0].Port)
	}
}

func TestBuildPostgresClientService(t *testing.T) {
	svc := validTestPostgresSummitService()
	svc.Spec.Port = 5432

	clientSvc, err := BuildPostgresClientService(svc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if clientSvc.Name != "test-db" {
		t.Errorf("expected test-db, got %s", clientSvc.Name)
	}
	if clientSvc.Spec.Type != corev1.ServiceTypeClusterIP {
		t.Errorf("expected ClusterIP, got %s", clientSvc.Spec.Type)
	}
	if clientSvc.Spec.Ports[0].Port != 5432 {
		t.Errorf("expected port 5432, got %d", clientSvc.Spec.Ports[0].Port)
	}

	// BuildService delegates to BuildPostgresClientService
	genericSvc, err := BuildService(svc)
	if err != nil {
		t.Fatalf("unexpected BuildService error: %v", err)
	}
	if genericSvc.Name != clientSvc.Name {
		t.Errorf("expected BuildService to return client service %s, got %s", clientSvc.Name, genericSvc.Name)
	}
}

func TestBuildPostgresNetworkPolicy(t *testing.T) {
	svc := validTestPostgresSummitService()
	policy, err := BuildPostgresNetworkPolicy(svc)
	if err != nil {
		t.Fatalf("BuildPostgresNetworkPolicy returned error: %v", err)
	}
	if policy.Namespace != svc.Namespace || policy.Name != svc.Name {
		t.Fatalf("unexpected NetworkPolicy identity: %s/%s", policy.Namespace, policy.Name)
	}
	if len(policy.Spec.PolicyTypes) != 2 || policy.Spec.PolicyTypes[0] != networkingv1.PolicyTypeIngress || policy.Spec.PolicyTypes[1] != networkingv1.PolicyTypeEgress {
		t.Fatalf("expected ingress and egress isolation, got %v", policy.Spec.PolicyTypes)
	}
	if len(policy.Spec.Ingress) != 1 || len(policy.Spec.Ingress[0].Ports) != 1 || policy.Spec.Ingress[0].Ports[0].Port.IntVal != 5432 {
		t.Fatalf("expected only postgres TCP ingress on 5432, got %+v", policy.Spec.Ingress)
	}
	if len(policy.Spec.Ingress[0].From) != 1 || policy.Spec.Ingress[0].From[0].PodSelector.MatchLabels[LabelManagedBy] != ValueManagedBy {
		t.Fatalf("expected ingress only from Summit-managed pods in same namespace, got %+v", policy.Spec.Ingress[0].From)
	}
	if len(policy.Spec.Egress) != 0 {
		t.Fatalf("expected egress denied, got %+v", policy.Spec.Egress)
	}
}

func TestWithPortEnv(t *testing.T) {
	got := withPortEnv([]corev1.EnvVar{{Name: "NODE_ENV", Value: "production"}}, 8080)
	if len(got) != 2 || got[1].Name != "PORT" || got[1].Value != "8080" {
		t.Fatalf("PORT not injected: %+v", got)
	}
	user := []corev1.EnvVar{{Name: "PORT", Value: "3000"}}
	if got := withPortEnv(user, 8080); len(got) != 1 || got[0].Value != "3000" {
		t.Fatalf("user PORT overridden: %+v", got)
	}
	if got := withPortEnv(nil, 9000); len(got) != 1 || got[0].Value != "9000" {
		t.Fatalf("PORT not injected into empty env: %+v", got)
	}
}
