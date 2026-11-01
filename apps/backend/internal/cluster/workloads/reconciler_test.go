package workloads

import (
	"context"
	"errors"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	apierr "k8s.io/apimachinery/pkg/api/errors"
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
			Image:     "ghcr.io/org/cat@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
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

	// Manually set an allocated ClusterIP on the Service to simulate k8s apiserver behavior
	existingSvc, err := client.CoreV1().Services("tenant-store").Get(ctx, "catalog-service", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("failed fetching created service: %v", err)
	}
	existingSvc.Spec.ClusterIP = "10.96.12.34"
	_, err = client.CoreV1().Services("tenant-store").Update(ctx, existingSvc, metav1.UpdateOptions{})
	if err != nil {
		t.Fatalf("failed updating clusterIP: %v", err)
	}

	// Update service spec: new image, new port, replicas 3
	replicas2 := int32(3)
	svc.Spec.Image = "ghcr.io/org/cat@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	svc.Spec.Replicas = &replicas2
	svc.Spec.Port = 9090

	res, err := reconciler.Reconcile(ctx, svc)
	if err != nil {
		t.Fatalf("second reconcile failed: %v", err)
	}

	if !res.DeploymentUpdated {
		t.Errorf("expected DeploymentUpdated=true")
	}
	if !res.ServiceUpdated {
		t.Errorf("expected ServiceUpdated=true")
	}

	// Check updated deployment
	dep, err := client.AppsV1().Deployments("tenant-store").Get(ctx, "catalog-service", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("failed fetching updated deployment: %v", err)
	}
	if *dep.Spec.Replicas != 3 {
		t.Errorf("expected 3 replicas, got %d", *dep.Spec.Replicas)
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
	if !apierr.IsNotFound(err) {
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

func TestReconciler_Postgres_CreateAll_Success(t *testing.T) {
	client := fake.NewSimpleClientset()
	reconciler := NewReconciler(client)

	ctx := context.Background()

	// Create Secret in target namespace
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "db-secret",
			Namespace: "tenant-tenant123",
		},
		Data: map[string][]byte{
			"password": []byte("secure-pg-pass-123!"),
		},
	}
	if _, err := client.CoreV1().Secrets("tenant-tenant123").Create(ctx, secret, metav1.CreateOptions{}); err != nil {
		t.Fatalf("failed creating test secret: %v", err)
	}

	svc := validTestPostgresSummitService()

	result, err := reconciler.Reconcile(ctx, svc)
	if err != nil {
		t.Fatalf("unexpected reconcile error: %v", err)
	}

	if !result.NamespaceCreated {
		t.Errorf("expected NamespaceCreated=true")
	}
	if !result.HeadlessCreated {
		t.Errorf("expected HeadlessCreated=true")
	}
	if !result.StatefulSetCreated {
		t.Errorf("expected StatefulSetCreated=true")
	}
	if !result.ServiceCreated {
		t.Errorf("expected ServiceCreated=true")
	}
	if result.DeploymentCreated {
		t.Errorf("expected DeploymentCreated=false for postgres workload")
	}

	// Verify Headless Service in fake client
	hlSvc, err := client.CoreV1().Services("tenant-tenant123").Get(ctx, "test-db-headless", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("expected headless service test-db-headless to exist: %v", err)
	}
	if hlSvc.Spec.ClusterIP != corev1.ClusterIPNone {
		t.Errorf("expected ClusterIP None, got %s", hlSvc.Spec.ClusterIP)
	}
	if !hlSvc.Spec.PublishNotReadyAddresses {
		t.Errorf("expected PublishNotReadyAddresses=true on headless service")
	}

	// Verify Client Service in fake client
	clientSvc, err := client.CoreV1().Services("tenant-tenant123").Get(ctx, "test-db", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("expected client service test-db to exist: %v", err)
	}
	if clientSvc.Spec.Type != corev1.ServiceTypeClusterIP {
		t.Errorf("expected ClusterIP on client service, got %s", clientSvc.Spec.Type)
	}
	if clientSvc.Spec.Ports[0].Port != 5432 {
		t.Errorf("expected port 5432, got %d", clientSvc.Spec.Ports[0].Port)
	}

	// Verify StatefulSet in fake client
	sts, err := client.AppsV1().StatefulSets("tenant-tenant123").Get(ctx, "test-db", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("expected statefulset test-db to exist: %v", err)
	}
	if *sts.Spec.Replicas != 1 {
		t.Errorf("expected 1 replica, got %d", *sts.Spec.Replicas)
	}
	if sts.Spec.ServiceName != "test-db-headless" {
		t.Errorf("expected governing service test-db-headless, got %s", sts.Spec.ServiceName)
	}
	if len(sts.Spec.VolumeClaimTemplates) != 1 {
		t.Fatalf("expected 1 VolumeClaimTemplate, got %d", len(sts.Spec.VolumeClaimTemplates))
	}

	// Verify Status
	if svc.Status.StatefulSetName != "test-db" {
		t.Errorf("expected StatefulSetName test-db, got %s", svc.Status.StatefulSetName)
	}
	if svc.Status.ServiceName != "test-db" {
		t.Errorf("expected ServiceName test-db, got %s", svc.Status.ServiceName)
	}
	if svc.Status.Phase != PhaseProgressing {
		t.Errorf("expected Phase Progressing while pods are scheduling, got %s", svc.Status.Phase)
	}
}

func TestReconciler_Postgres_Idempotent(t *testing.T) {
	client := fake.NewSimpleClientset()
	reconciler := NewReconciler(client)

	ctx := context.Background()

	// Create Secret
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "db-secret",
			Namespace: "tenant-tenant123",
		},
		Data: map[string][]byte{"password": []byte("p@ssword")},
	}
	if _, err := client.CoreV1().Secrets("tenant-tenant123").Create(ctx, secret, metav1.CreateOptions{}); err != nil {
		t.Fatalf("failed creating secret: %v", err)
	}

	svc := validTestPostgresSummitService()

	// 1st run
	res1, err := reconciler.Reconcile(ctx, svc)
	if err != nil {
		t.Fatalf("1st reconcile failed: %v", err)
	}
	if !res1.StatefulSetCreated || !res1.HeadlessCreated || !res1.ServiceCreated || !res1.NetworkPolicyCreated {
		t.Fatalf("expected create flags on 1st run, got %+v", res1)
	}
	if _, err := client.NetworkingV1().NetworkPolicies("tenant-tenant123").Get(ctx, "test-db", metav1.GetOptions{}); err != nil {
		t.Fatalf("expected postgres NetworkPolicy to exist: %v", err)
	}

	// 2nd run
	res2, err := reconciler.Reconcile(ctx, svc)
	if err != nil {
		t.Fatalf("2nd reconcile failed: %v", err)
	}
	if res2.NamespaceCreated || res2.StatefulSetCreated || res2.StatefulSetUpdated ||
		res2.HeadlessCreated || res2.HeadlessUpdated || res2.ServiceCreated || res2.ServiceUpdated || res2.NetworkPolicyCreated || res2.NetworkPolicyUpdated {
		t.Errorf("expected strictly idempotent no-op on 2nd run, got %+v", res2)
	}
}

func TestReconciler_Postgres_DoesNotNeedSecretReadPermission(t *testing.T) {
	client := fake.NewSimpleClientset()
	reconciler := NewReconciler(client)

	ctx := context.Background()
	svc := validTestPostgresSummitService()
	result, err := reconciler.Reconcile(ctx, svc)
	if err != nil {
		t.Fatalf("reconcile should only reference tenant Secret and not require secret read permission: %v", err)
	}
	if !result.StatefulSetCreated {
		t.Fatal("expected StatefulSet to be created without controller reading tenant Secret contents")
	}
}

func TestReconciler_Postgres_ImmutableFieldErrors_NeverRecreatesState(t *testing.T) {
	client := fake.NewSimpleClientset()
	reconciler := NewReconciler(client)

	ctx := context.Background()

	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "db-secret",
			Namespace: "tenant-tenant123",
		},
		Data: map[string][]byte{"password": []byte("initial-pw")},
	}
	if _, err := client.CoreV1().Secrets("tenant-tenant123").Create(ctx, secret, metav1.CreateOptions{}); err != nil {
		t.Fatalf("failed creating secret: %v", err)
	}

	svc := validTestPostgresSummitService()
	if _, err := reconciler.Reconcile(ctx, svc); err != nil {
		t.Fatalf("initial reconcile failed: %v", err)
	}

	// 1. Attempting to change StorageClassName must be rejected with ErrImmutableStorageClass
	svcModSC := validTestPostgresSummitService()
	svcModSC.Spec.Postgres.Storage.StorageClassName = "fast-csi-nvme"

	_, err := reconciler.Reconcile(ctx, svcModSC)
	if !errors.Is(err, ErrImmutableStorageClass) {
		t.Errorf("expected ErrImmutableStorageClass, got %v", err)
	}
	if svcModSC.Status.Phase != PhaseFailed {
		t.Errorf("expected PhaseFailed on immutable storageClass change, got %s", svcModSC.Status.Phase)
	}

	// Verify StatefulSet still exists and was NOT deleted or modified
	sts, err := client.AppsV1().StatefulSets("tenant-tenant123").Get(ctx, "test-db", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("StatefulSet must NOT be deleted on immutable rejection: %v", err)
	}
	if *sts.Spec.VolumeClaimTemplates[0].Spec.StorageClassName != "standard" {
		t.Errorf("StorageClassName must be unchanged on StatefulSet")
	}

	// 2. Attempting to change VolumeClaimTemplate size on existing StatefulSet must be rejected
	svcModSize := validTestPostgresSummitService()
	svcModSize.Spec.Postgres.Storage.Size = "50Gi"

	_, err = reconciler.Reconcile(ctx, svcModSize)
	if !errors.Is(err, ErrImmutableVolumeClaim) {
		t.Errorf("expected ErrImmutableVolumeClaim for storage size modification, got %v", err)
	}
	if svcModSize.Status.Phase != PhaseFailed {
		t.Errorf("expected PhaseFailed on immutable storage size change, got %s", svcModSize.Status.Phase)
	}
}

func TestReconciler_Postgres_MutableUpdates(t *testing.T) {
	client := fake.NewSimpleClientset()
	reconciler := NewReconciler(client)

	ctx := context.Background()

	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "db-secret",
			Namespace: "tenant-tenant123",
		},
		Data: map[string][]byte{"password": []byte("initial-pw")},
	}
	if _, err := client.CoreV1().Secrets("tenant-tenant123").Create(ctx, secret, metav1.CreateOptions{}); err != nil {
		t.Fatalf("failed creating secret: %v", err)
	}

	svc := validTestPostgresSummitService()
	if _, err := reconciler.Reconcile(ctx, svc); err != nil {
		t.Fatalf("initial reconcile failed: %v", err)
	}

	// Update mutable field: image digest override.
	updatedImage := "postgres:16.8-alpine@sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"
	svc.Spec.Image = updatedImage
	svc.Spec.Postgres.Image = updatedImage

	res, err := reconciler.Reconcile(ctx, svc)
	if err != nil {
		t.Fatalf("mutable update reconcile failed: %v", err)
	}
	if !res.StatefulSetUpdated {
		t.Errorf("expected StatefulSetUpdated=true on image change")
	}

	sts, err := client.AppsV1().StatefulSets("tenant-tenant123").Get(ctx, "test-db", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("failed fetching updated statefulset: %v", err)
	}
	if sts.Spec.Template.Spec.Containers[0].Image != updatedImage {
		t.Errorf("expected updated image %s, got %s", updatedImage, sts.Spec.Template.Spec.Containers[0].Image)
	}
}

func TestReconciler_Postgres_PhaseAvailableWhenReady(t *testing.T) {
	client := fake.NewSimpleClientset()
	reconciler := NewReconciler(client)

	ctx := context.Background()

	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "db-secret",
			Namespace: "tenant-tenant123",
		},
		Data: map[string][]byte{"password": []byte("initial-pw")},
	}
	if _, err := client.CoreV1().Secrets("tenant-tenant123").Create(ctx, secret, metav1.CreateOptions{}); err != nil {
		t.Fatalf("failed creating secret: %v", err)
	}

	svc := validTestPostgresSummitService()
	if _, err := reconciler.Reconcile(ctx, svc); err != nil {
		t.Fatalf("initial reconcile failed: %v", err)
	}

	// Simulate pod becoming ready in the cluster
	sts, err := client.AppsV1().StatefulSets("tenant-tenant123").Get(ctx, "test-db", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("failed fetching statefulset: %v", err)
	}
	sts.Status.ReadyReplicas = 1
	if _, err := client.AppsV1().StatefulSets("tenant-tenant123").UpdateStatus(ctx, sts, metav1.UpdateOptions{}); err != nil {
		t.Fatalf("failed updating sts status: %v", err)
	}

	// Reconcile again to observe live replica status
	res, err := reconciler.Reconcile(ctx, svc)
	if err != nil {
		t.Fatalf("second reconcile failed: %v", err)
	}
	if res.Phase != PhaseAvailable {
		t.Errorf("expected Phase Available when readyReplicas=1, got %s", res.Phase)
	}
	if svc.Status.Phase != PhaseAvailable {
		t.Errorf("expected svc.Status.Phase Available, got %s", svc.Status.Phase)
	}
	if svc.Status.ReadyReplicas != 1 {
		t.Errorf("expected svc.Status.ReadyReplicas=1, got %d", svc.Status.ReadyReplicas)
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
