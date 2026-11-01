package worker

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/orchestrator/queue"
	"github.com/summit/backend/internal/platformdb"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	"k8s.io/client-go/kubernetes/fake"
)

func deletedRecord(t *testing.T, userID, serviceID uuid.UUID, serviceType string) *queue.EventRecord {
	t.Helper()
	payload, err := json.Marshal(platformdb.ServiceDeletedEvent{
		EventID: uuid.NewString(), ServiceID: serviceID.String(), ServiceName: "web",
		ServiceType: serviceType, UserID: userID.String(), ProjectID: uuid.NewString(),
	})
	if err != nil {
		t.Fatal(err)
	}
	return &queue.EventRecord{ID: uuid.New(), EventType: EventTypeServiceDeleted, Payload: payload}
}

func newDyn(objs ...runtime.Object) *dynamicfake.FakeDynamicClient {
	return dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), map[schema.GroupVersionResource]string{
		summitServiceGVR: "SummitServiceList",
		ingressRouteGVR:  "IngressRouteList",
		middlewareGVR:    "MiddlewareList",
	}, objs...)
}

func unstr(gvr schema.GroupVersionResource, kind, ns, name string) *unstructured.Unstructured {
	u := &unstructured.Unstructured{}
	u.SetAPIVersion(gvr.GroupVersion().String())
	u.SetKind(kind)
	u.SetNamespace(ns)
	u.SetName(name)
	return u
}

func TestServiceDeleted_RemovesWorkloadObjectsAndIsIdempotent(t *testing.T) {
	userID, serviceID := uuid.New(), uuid.New()
	ns := "tenant-" + userID.String()
	name := "svc-" + serviceID.String()
	kube := fake.NewSimpleClientset(
		&appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns}},
		&corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns}},
	)
	dyn := newDyn(
		unstr(summitServiceGVR, "SummitService", ns, name),
		unstr(ingressRouteGVR, "IngressRoute", ns, name),
		unstr(middlewareGVR, "Middleware", ns, name+"-security-headers"),
	)
	h := &ServiceDeletedHandler{Kube: kube, Dyn: dyn}
	rec := deletedRecord(t, userID, serviceID, "image")

	for i := 0; i < 2; i++ { // second run proves idempotency
		if err := h.Handle(context.Background(), rec); err != nil {
			t.Fatalf("run %d: %v", i, err)
		}
	}
	ctx := context.Background()
	if _, err := kube.AppsV1().Deployments(ns).Get(ctx, name, metav1.GetOptions{}); !apierrors.IsNotFound(err) {
		t.Fatalf("deployment still present: %v", err)
	}
	if _, err := kube.CoreV1().Services(ns).Get(ctx, name, metav1.GetOptions{}); !apierrors.IsNotFound(err) {
		t.Fatalf("service still present: %v", err)
	}
	for _, gvr := range []schema.GroupVersionResource{summitServiceGVR, ingressRouteGVR} {
		if _, err := dyn.Resource(gvr).Namespace(ns).Get(ctx, name, metav1.GetOptions{}); !apierrors.IsNotFound(err) {
			t.Fatalf("%s still present: %v", gvr.Resource, err)
		}
	}
}

func TestServiceDeleted_AddonDeletesPVC(t *testing.T) {
	userID, serviceID := uuid.New(), uuid.New()
	ns := "tenant-" + userID.String()
	name := "addon-" + serviceID.String()
	kube := fake.NewSimpleClientset(
		&appsv1.StatefulSet{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns}},
		&corev1.Secret{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns}},
		&corev1.PersistentVolumeClaim{ObjectMeta: metav1.ObjectMeta{
			Name: "data-" + name + "-0", Namespace: ns,
			Labels: map[string]string{"summit.dev/service": serviceID.String()},
		}},
	)
	h := &ServiceDeletedHandler{Kube: kube, Dyn: newDyn()}
	if err := h.Handle(context.Background(), deletedRecord(t, userID, serviceID, "postgres")); err != nil {
		t.Fatal(err)
	}
	pvcs, _ := kube.CoreV1().PersistentVolumeClaims(ns).List(context.Background(), metav1.ListOptions{})
	if len(pvcs.Items) != 0 {
		t.Fatalf("expected PVC deleted, got %d", len(pvcs.Items))
	}
	if _, err := kube.AppsV1().StatefulSets(ns).Get(context.Background(), name, metav1.GetOptions{}); !apierrors.IsNotFound(err) {
		t.Fatalf("statefulset still present: %v", err)
	}
}

func TestDispatcher_RoutesByTypeAndRejectsUnknown(t *testing.T) {
	called := ""
	d := Dispatcher(map[string]queue.Handler{
		"a": func(context.Context, *queue.EventRecord) error { called = "a"; return nil },
		"b": func(context.Context, *queue.EventRecord) error { return errors.New("boom") },
	})
	if err := d(context.Background(), &queue.EventRecord{EventType: "a"}); err != nil || called != "a" {
		t.Fatalf("dispatch a: err=%v called=%q", err, called)
	}
	if err := d(context.Background(), &queue.EventRecord{EventType: "b"}); err == nil {
		t.Fatal("expected handler error to propagate")
	}
	if err := d(context.Background(), &queue.EventRecord{EventType: "zzz"}); err == nil {
		t.Fatal("expected error for unknown event type")
	}
}
