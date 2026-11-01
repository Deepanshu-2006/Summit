package managed

import (
	"context"
	"strings"
	"testing"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"

	"github.com/summit/backend/internal/cluster/workloads"
)

const (
	testNS  = "tenant-user"
	testSvc = "11111111-1111-1111-1111-111111111111"
)

func testRequest(engine string, storageMB int) Request {
	return Request{
		Namespace:            testNS,
		TenantID:             "user",
		ProjectID:            "proj",
		ServiceID:            testSvc,
		Engine:               engine,
		StorageMB:            storageMB,
		CPURequestMillicores: 100,
		CPULimitMillicores:   500,
		MemoryRequestMB:      256,
		MemoryLimitMB:        512,
	}
}

func TestManifests_PostgresProbesAndPVC(t *testing.T) {
	addon, ok := DefaultCatalog().AddonFor(EnginePostgres)
	if !ok || addon.Image != "postgres:16-alpine" || addon.Port != 5432 || addon.URLEnv != "DATABASE_URL" {
		t.Fatalf("catalog postgres: %+v ok=%v", addon, ok)
	}
	req := testRequest(EnginePostgres, 2048)
	sts, err := BuildStatefulSet(req, addon)
	if err != nil {
		t.Fatal(err)
	}
	if sts.Spec.Replicas == nil || *sts.Spec.Replicas != 1 {
		t.Fatalf("replicas %+v", sts.Spec.Replicas)
	}
	if sts.Spec.ServiceName != "addon-"+testSvc {
		t.Fatalf("serviceName %s", sts.Spec.ServiceName)
	}
	if len(sts.Spec.VolumeClaimTemplates) != 1 {
		t.Fatalf("claims %+v", sts.Spec.VolumeClaimTemplates)
	}
	got := sts.Spec.VolumeClaimTemplates[0].Spec.Resources.Requests[corev1.ResourceStorage]
	if got.Cmp(resource.MustParse("2048Mi")) != 0 {
		t.Fatalf("storage %s", got.String())
	}
	if sts.Spec.VolumeClaimTemplates[0].Spec.StorageClassName != nil {
		t.Fatal("storage class must be empty so the cluster default is used")
	}
	c := sts.Spec.Template.Spec.Containers[0]
	if c.ReadinessProbe == nil || !strings.Contains(strings.Join(c.ReadinessProbe.Exec.Command, " "), "pg_isready") {
		t.Fatalf("readiness %#v", c.ReadinessProbe)
	}
	if c.LivenessProbe == nil || !strings.Contains(strings.Join(c.LivenessProbe.Exec.Command, " "), "pg_isready") {
		t.Fatalf("liveness %#v", c.LivenessProbe)
	}
	if sts.Spec.Template.Spec.SecurityContext == nil || sts.Spec.Template.Spec.SecurityContext.RunAsNonRoot == nil || !*sts.Spec.Template.Spec.SecurityContext.RunAsNonRoot {
		t.Fatal("expected non-root pod security context")
	}
	if sts.Labels[workloads.LabelService] != testSvc || sts.Labels[workloads.LabelTenant] != "user" {
		t.Fatalf("labels %v", sts.Labels)
	}
}

func TestManifests_RedisRequirePassAndDefaultStorage(t *testing.T) {
	addon, ok := DefaultCatalog().AddonFor(EngineRedis)
	if !ok || addon.Image != "redis:7-alpine" || addon.URLEnv != "REDIS_URL" {
		t.Fatalf("catalog redis: %+v", addon)
	}
	sts, err := BuildStatefulSet(testRequest(EngineRedis, 0), addon)
	if err != nil {
		t.Fatal(err)
	}
	got := sts.Spec.VolumeClaimTemplates[0].Spec.Resources.Requests[corev1.ResourceStorage]
	if got.Cmp(resource.MustParse("1Gi")) != 0 {
		t.Fatalf("default storage %s", got.String())
	}
	c := sts.Spec.Template.Spec.Containers[0]
	joined := strings.Join(c.Args, " ")
	if !strings.Contains(joined, "--requirepass") || !strings.Contains(joined, "$(REDIS_PASSWORD)") {
		t.Fatalf("args %v", c.Args)
	}
	if c.ReadinessProbe == nil || strings.Join(c.ReadinessProbe.Exec.Command, " ") != "redis-cli ping" {
		t.Fatalf("probe %#v", c.ReadinessProbe)
	}
	var passFromSecret bool
	for _, env := range c.Env {
		if env.Name == "REDIS_PASSWORD" && env.ValueFrom != nil && env.ValueFrom.SecretKeyRef != nil &&
			env.ValueFrom.SecretKeyRef.Name == "addon-"+testSvc && env.ValueFrom.SecretKeyRef.Key == "password" {
			passFromSecret = true
		}
		if env.Value != "" && strings.Contains(env.Value, "pass") {
			t.Fatalf("password must not be inlined: %s", env.Name)
		}
	}
	if !passFromSecret {
		t.Fatal("REDIS_PASSWORD secret ref missing")
	}
}

func TestProvision_SecretNotRegeneratedAndPVCKept(t *testing.T) {
	ctx := context.Background()
	client := fake.NewSimpleClientset()
	p := NewProvisioner(client, DefaultCatalog())
	req := testRequest(EnginePostgres, 2048)

	first, err := p.Provision(ctx, req)
	if err != nil {
		t.Fatal(err)
	}
	if !first.CreatedSecret || first.Image != "postgres:16-alpine" {
		t.Fatalf("first result %+v", first)
	}
	sec, err := client.CoreV1().Secrets(testNS).Get(ctx, first.Name, metav1.GetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	password := string(sec.Data["password"])
	if len(password) < 16 {
		t.Fatalf("password too short: %d", len(password))
	}
	if string(sec.Data["database"]) != "postgres" {
		t.Fatalf("database %q", sec.Data["database"])
	}
	if !strings.Contains(string(sec.Data["url"]), password) || !strings.Contains(string(sec.Data["url"]), "sslmode=disable") {
		t.Fatal("url missing password or sslmode")
	}
	if !strings.Contains(string(sec.Data["host"]), first.Name+"."+testNS+".svc.cluster.local") {
		t.Fatalf("host %s", sec.Data["host"])
	}
	svc, err := client.CoreV1().Services(testNS).Get(ctx, first.Name, metav1.GetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if svc.Spec.ClusterIP != corev1.ClusterIPNone {
		t.Fatalf("expected headless service, got %s", svc.Spec.ClusterIP)
	}

	req.StorageMB = 8192
	second, err := p.Provision(ctx, req)
	if err != nil {
		t.Fatal(err)
	}
	if second.CreatedSecret {
		t.Fatal("redeploy regenerated the secret")
	}
	sec2, err := client.CoreV1().Secrets(testNS).Get(ctx, first.Name, metav1.GetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if string(sec2.Data["password"]) != password {
		t.Fatal("password rotated on redeploy")
	}
	sts, err := client.AppsV1().StatefulSets(testNS).Get(ctx, first.Name, metav1.GetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if sts.Spec.Replicas == nil || *sts.Spec.Replicas != 1 {
		t.Fatalf("replicas changed: %+v", sts.Spec.Replicas)
	}
	kept := sts.Spec.VolumeClaimTemplates[0].Spec.Resources.Requests[corev1.ResourceStorage]
	if kept.Cmp(resource.MustParse("2048Mi")) != 0 {
		t.Fatalf("volume claim was replaced: %s", kept.String())
	}
	list, err := client.AppsV1().StatefulSets(testNS).List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if len(list.Items) != 1 {
		t.Fatalf("expected one statefulset, got %d", len(list.Items))
	}
}

func TestProvision_RedisURLHasNoDatabaseKey(t *testing.T) {
	ctx := context.Background()
	client := fake.NewSimpleClientset()
	p := NewProvisioner(client, DefaultCatalog())
	res, err := p.Provision(ctx, testRequest(EngineRedis, 0))
	if err != nil {
		t.Fatal(err)
	}
	sec, err := client.CoreV1().Secrets(testNS).Get(ctx, res.Name, metav1.GetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := sec.Data["database"]; ok {
		t.Fatal("redis secret should not carry a database key")
	}
	if string(sec.Data["username"]) != "default" {
		t.Fatalf("username %s", sec.Data["username"])
	}
	if !strings.HasPrefix(string(sec.Data["url"]), "redis://") || !strings.Contains(string(sec.Data["url"]), "/0") {
		t.Fatalf("url %s", sec.Data["url"])
	}
}

func TestDelete_RemovesPVCAndIsIdempotent(t *testing.T) {
	ctx := context.Background()
	client := fake.NewSimpleClientset()
	p := NewProvisioner(client, DefaultCatalog())
	res, err := p.Provision(ctx, testRequest(EnginePostgres, 1024))
	if err != nil {
		t.Fatal(err)
	}
	pvcName, err := DataPVCName(testSvc)
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.CoreV1().PersistentVolumeClaims(testNS).Create(ctx, &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:      pvcName,
			Namespace: testNS,
			Labels:    map[string]string{workloads.LabelService: testSvc},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if err := Delete(ctx, client, testNS, testSvc); err != nil {
		t.Fatal(err)
	}
	if _, err := client.AppsV1().StatefulSets(testNS).Get(ctx, res.Name, metav1.GetOptions{}); err == nil {
		t.Fatal("statefulset still present")
	}
	if _, err := client.CoreV1().Secrets(testNS).Get(ctx, res.Name, metav1.GetOptions{}); err == nil {
		t.Fatal("secret still present")
	}
	if _, err := client.CoreV1().Services(testNS).Get(ctx, res.Name, metav1.GetOptions{}); err == nil {
		t.Fatal("service still present")
	}
	if _, err := client.CoreV1().PersistentVolumeClaims(testNS).Get(ctx, pvcName, metav1.GetOptions{}); err == nil {
		t.Fatal("pvc still present")
	}
	if err := Delete(ctx, client, testNS, testSvc); err != nil {
		t.Fatalf("second delete: %v", err)
	}
}
