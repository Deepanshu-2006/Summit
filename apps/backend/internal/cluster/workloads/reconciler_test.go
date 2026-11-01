package workloads

import (
	"context"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes/fake"
)

func TestReconciler_CreateAll_Success(t *testing.T) {
	client := fake.NewSimpleClientset(&corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "platform-pull-secret", Namespace: "tenant-ecommerce"},
	})
	reconciler := NewReconciler(client, WithDefaultPullSecret("platform-pull-secret"))

	replicas := int32(2)
	svc := &SummitService{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "orders-service",
			Namespace: "tenant-ecommerce",
			UID:       types.UID("crd-orders-001"),
		},
		Spec: SummitServiceSpec{
			Image:     "ghcr.io/org/orders@sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
			Replicas:  &replicas,
			Port:      8080,
			TenantID:  "ecommerce",
			ServiceID: "orders",
		},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := reconciler.Reconcile(ctx, svc)
	if err != nil {
		t.Fatalf("unexpected Reconcile error: %v", err)
	}

	if !result.NamespaceCreated {
		t.Errorf("expected NamespaceCreated=true")
	}
	if !result.DeploymentCreated {
		t.Errorf("expected DeploymentCreated=true")
	}
	if !result.ServiceCreated {
		t.Errorf("expected ServiceCreated=true")
	}
	if result.DeploymentUpdated || result.ServiceUpdated {
		t.Errorf("expected no updates on fresh creation")
	}

	// Verify Namespace in fake client
	ns, err := client.CoreV1().Namespaces().Get(ctx, "tenant-ecommerce", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("expected namespace tenant-ecommerce to exist: %v", err)
	}
	if ns.Labels[LabelTenant] != "ecommerce" {
		t.Errorf("expected tenant label ecommerce on namespace, got %v", ns.Labels)
	}

	// Verify Deployment in fake client
	dep, err := client.AppsV1().Deployments("tenant-ecommerce").Get(ctx, "orders-service", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("expected deployment orders-service to exist: %v", err)
	}
	if dep.Spec.Template.Spec.Containers[0].Image != svc.Spec.Image {
		t.Errorf("expected deployment image %s, got %s", svc.Spec.Image, dep.Spec.Template.Spec.Containers[0].Image)
	}
	if len(dep.Spec.Template.Spec.ImagePullSecrets) != 1 || dep.Spec.Template.Spec.ImagePullSecrets[0].Name != "platform-pull-secret" {
		t.Errorf("expected default pull secret platform-pull-secret, got %+v", dep.Spec.Template.Spec.ImagePullSecrets)
	}

	// Verify ClusterIP Service in fake client
	k8sSvc, err := client.CoreV1().Services("tenant-ecommerce").Get(ctx, "orders-service", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("expected service orders-service to exist: %v", err)
	}
	if k8sSvc.Spec.Type != corev1.ServiceTypeClusterIP {
		t.Errorf("expected ClusterIP service, got %s", k8sSvc.Spec.Type)
	}
	if k8sSvc.Spec.Ports[0].Port != 8080 {
		t.Errorf("expected port 8080, got %d", k8sSvc.Spec.Ports[0].Port)
	}

	// Verify Status updates
	if svc.Status.DeploymentName != "orders-service" || svc.Status.ServiceName != "orders-service" {
		t.Errorf("expected status names populated, got dep=%s, svc=%s", svc.Status.DeploymentName, svc.Status.ServiceName)
	}
	if len(svc.Status.Conditions) == 0 {
		t.Errorf("expected status conditions populated")
	}
}

func TestReconciler_Idempotent(t *testing.T) {
	client := fake.NewSimpleClientset()
	reconciler := NewReconciler(client)

	replicas := int32(1)
	svc := &SummitService{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "auth-service",
			Namespace: "tenant-auth",
			UID:       types.UID("crd-auth-002"),
		},
		Spec: SummitServiceSpec{
			Image:     "ghcr.io/org/auth@sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
			Replicas:  &replicas,
			Port:      8080,
			TenantID:  "auth",
			ServiceID: "auth",
		},
	}

	ctx := context.Background()

	// Initial reconciliation
	res1, err := reconciler.Reconcile(ctx, svc)
	if err != nil {
		t.Fatalf("initial reconcile failed: %v", err)
	}
	if !res1.DeploymentCreated || !res1.ServiceCreated || !res1.NamespaceCreated {
		t.Fatalf("expected initial create flags, got %+v", res1)
	}

	// Second reconciliation with same desired state
	res2, err := reconciler.Reconcile(ctx, svc)
	if err != nil {
		t.Fatalf("subsequent reconcile failed: %v", err)
	}
	if res2.NamespaceCreated || res2.DeploymentCreated || res2.DeploymentUpdated || res2.ServiceCreated || res2.ServiceUpdated {
		t.Errorf("expected strictly idempotent no-op, got %+v", res2)
	}
}

func TestReconciler_UpdateDeploymentAndPreserveClusterIP(t *testing.T) {
	client := fake.NewSimpleClientset()
	reconciler := NewReconciler(client)

	replicas1 := int32(1)
	svc := &SummitService{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "catalog-service",
			Namespace: "tenant-store",
			UID:       types.UID("crd-cat-003"),
		},
		Spec: SummitServiceSpec{
			Image:     "ghcr.io/org/catalog@sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
			Replicas:  &replicas1,
			Port:      8080,
			TenantID:  "store",
			ServiceID: "catalog",
		},
	}

	ctx := context.Background()
	_, err := reconciler.Reconcile(ctx, svc)
	if err != nil {
		t.Fatalf("initial reconcile failed: %v", err)
	}

	// Simulate Kubernetes assigning a ClusterIP to the created service
	existingSvc, err := client.CoreV1().Services("tenant-store").Get(ctx, "catalog-service", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("failed fetching created service: %v", err)
	}
	existingSvc.Spec.ClusterIP = "10.96.12.34"
	_, err = client.CoreV1().Services("tenant-store").Update(ctx, existingSvc, metav1.UpdateOptions{})
	if err != nil {
		t.Fatalf("failed updating mock cluster ip: %v", err)
	}

	// Update desired state: bump replicas, change digest, change port
	replicas2 := int32(4)
	svc.Spec.Replicas = &replicas2
	svc.Spec.Image = "ghcr.io/org/catalog@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	svc.Spec.Port = 9090

	resUpdate, err := reconciler.Reconcile(ctx, svc)
	if err != nil {
		t.Fatalf("update reconcile failed: %v", err)
	}
	if !resUpdate.DeploymentUpdated {
		t.Errorf("expected DeploymentUpdated=true")
	}
	if !resUpdate.ServiceUpdated {
		t.Errorf("expected ServiceUpdated=true")
	}

	// Check updated deployment in fake client
	dep, err := client.AppsV1().Deployments("tenant-store").Get(ctx, "catalog-service", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("failed fetching updated deployment: %v", err)
	}
	if *dep.Spec.Replicas != 4 {
		t.Errorf("expected 4 replicas, got %d", *dep.Spec.Replicas)
	}
	if dep.Spec.Template.Spec.Containers[0].Image != svc.Spec.Image {
		t.Errorf("expected updated image %s, got %s", svc.Spec.Image, dep.Spec.Template.Spec.Containers[0].Image)
	}

	// Check updated service: port should be updated, ClusterIP preserved
	updatedSvc, err := client.CoreV1().Services("tenant-store").Get(ctx, "catalog-service", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("failed fetching updated service: %v", err)
	}
	if updatedSvc.Spec.Ports[0].Port != 9090 {
		t.Errorf("expected port 9090, got %d", updatedSvc.Spec.Ports[0].Port)
	}
	if updatedSvc.Spec.ClusterIP != "10.96.12.34" {
		t.Errorf("expected ClusterIP 10.96.12.34 to be preserved, got %s", updatedSvc.Spec.ClusterIP)
	}
}

func TestReconciler_AutoNamespaceDisabled(t *testing.T) {
	client := fake.NewSimpleClientset()
	reconciler := NewReconciler(client, WithAutoNamespace(false))

	svc := &SummitService{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "no-ns-service",
			Namespace: "missing-ns",
		},
		Spec: SummitServiceSpec{
			Image: "ghcr.io/org/app@sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
		},
	}

	ctx := context.Background()
	_, err := reconciler.Reconcile(ctx, svc)
	if err != nil {
		t.Fatalf("reconcile failed: %v", err)
	}

	// Namespace should NOT have been created
	_, err = client.CoreV1().Namespaces().Get(ctx, "missing-ns", metav1.GetOptions{})
	if !apierrors.IsNotFound(err) {
		t.Errorf("expected namespace not found when autoNamespace=false, got err: %v", err)
	}
}

func TestReconciler_ContextCancelled(t *testing.T) {
	client := fake.NewSimpleClientset()
	reconciler := NewReconciler(client)

	svc := &SummitService{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test",
			Namespace: "test",
		},
		Spec: SummitServiceSpec{
			Image: "ghcr.io/org/app@sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
		},
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := reconciler.Reconcile(ctx, svc)
	if err == nil {
		t.Fatalf("expected context canceled error, got nil")
	}
}

func TestReconciler_ValidationError(t *testing.T) {
	client := fake.NewSimpleClientset()
	reconciler := NewReconciler(client)

	svc := &SummitService{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test",
			Namespace: "test",
		},
		Spec: SummitServiceSpec{
			Image: "invalid-mutable-tag:latest",
		},
	}

	ctx := context.Background()
	_, err := reconciler.Reconcile(ctx, svc)
	if err == nil {
		t.Fatalf("expected validation error, got nil")
	}
	if svc.Status.Phase != PhaseFailed {
		t.Errorf("expected phase Failed, got %s", svc.Status.Phase)
	}
}

func TestReconciler_OmitsMissingPullSecret(t *testing.T) {
	client := fake.NewSimpleClientset()
	reconciler := NewReconciler(client, WithDefaultPullSecret("ghcr-pull"))
	replicas := int32(1)
	svc := &SummitService{
		ObjectMeta: metav1.ObjectMeta{Name: "public-api", Namespace: "tenant-pub", UID: types.UID("crd-pub")},
		Spec: SummitServiceSpec{
			Image:          "ghcr.io/org/public@sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
			Replicas:       &replicas,
			Port:           8080,
			PullSecretName: "ghcr-pull",
		},
	}
	if _, err := reconciler.Reconcile(context.Background(), svc); err != nil {
		t.Fatal(err)
	}
	dep, err := client.AppsV1().Deployments("tenant-pub").Get(context.Background(), "public-api", metav1.GetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if len(dep.Spec.Template.Spec.ImagePullSecrets) != 0 {
		t.Fatalf("missing ghcr-pull must not be referenced, got %+v", dep.Spec.Template.Spec.ImagePullSecrets)
	}
	k8sSvc, err := client.CoreV1().Services("tenant-pub").Get(context.Background(), "public-api", metav1.GetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if k8sSvc.Spec.Type != corev1.ServiceTypeClusterIP || len(k8sSvc.Spec.Ports) != 1 {
		t.Fatalf("expected ClusterIP with a port, got %#v", k8sSvc.Spec)
	}
}
