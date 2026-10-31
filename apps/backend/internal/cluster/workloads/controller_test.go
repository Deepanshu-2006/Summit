package workloads

import (
	"context"
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8sfake "k8s.io/client-go/kubernetes/fake"
)

func TestControllerReconcileOnce(t *testing.T) {
	gvr := SchemeGroupVersion.WithResource("summitservices")
	cr := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": SchemeGroupVersion.String(),
		"kind":       KindSummitService,
		"metadata": map[string]any{
			"name":       "api",
			"namespace":  "tenant-test",
			"generation": int64(1),
		},
		"spec": map[string]any{
			"image":    "ghcr.io/example/api@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			"tenantId": "tenant-test",
			"port":     int64(8080),
		},
	}}
	dynamicClient := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), map[schema.GroupVersionResource]string{
		gvr: "SummitServiceList",
	}, cr)
	kubeClient := k8sfake.NewSimpleClientset()
	reconciler := NewReconciler(kubeClient, WithStatusClient(dynamicClient))
	controller, err := NewController(dynamicClient, reconciler, 0, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := controller.ReconcileOnce(context.Background()); err != nil {
		t.Fatalf("reconcile once failed: %v", err)
	}
	if _, err := kubeClient.AppsV1().Deployments("tenant-test").Get(context.Background(), "api", metav1.GetOptions{}); err != nil {
		t.Fatalf("expected backend deployment created: %v", err)
	}
	service, err := dynamicClient.Resource(gvr).Namespace("tenant-test").Get(context.Background(), "api", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("reading SummitService status: %v", err)
	}
	phase, found, err := unstructured.NestedString(service.Object, "status", "phase")
	if err != nil || !found || phase != string(PhaseProgressing) {
		t.Fatalf("expected persisted Progressing phase, got %q, found=%t, err=%v", phase, found, err)
	}
}

func TestControllerRunStopsOnCancellation(t *testing.T) {
	gvr := SchemeGroupVersion.WithResource("summitservices")
	dynamicClient := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), map[schema.GroupVersionResource]string{
		gvr: "SummitServiceList",
	})
	controller, err := NewController(dynamicClient, NewReconciler(k8sfake.NewSimpleClientset()), time.Millisecond, nil)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()
	if err := controller.Run(ctx); err != nil {
		t.Fatalf("controller should stop cleanly on cancellation: %v", err)
	}
}
