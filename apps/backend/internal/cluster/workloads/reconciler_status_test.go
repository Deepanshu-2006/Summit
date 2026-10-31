package workloads

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic/fake"
	k8sfake "k8s.io/client-go/kubernetes/fake"
)

func TestManagedContainersEqualIgnoresAPIServerDefaults(t *testing.T) {
	svc := validTestSummitService()
	desired, err := BuildDeployment(svc)
	if err != nil {
		t.Fatal(err)
	}
	existing := desired.Spec.Template.Spec.Containers[0].DeepCopy()
	existing.TerminationMessagePath = "/dev/termination-log"
	existing.TerminationMessagePolicy = "File"
	existing.LivenessProbe.SuccessThreshold = 1
	existing.ReadinessProbe.SuccessThreshold = 1
	if !managedContainersEqual([]corev1.Container{*existing}, desired.Spec.Template.Spec.Containers) {
		t.Fatal("API-server defaulted fields should not trigger a Deployment update")
	}
	existing.Image = "ghcr.io/example/old@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if managedContainersEqual([]corev1.Container{*existing}, desired.Spec.Template.Spec.Containers) {
		t.Fatal("managed image changes must trigger a Deployment update")
	}
}

func TestReconcilePersistsSummitServiceStatus(t *testing.T) {
	svc := validTestSummitService()
	svc.Generation = 3
	object := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": SchemeGroupVersion.String(),
		"kind":       KindSummitService,
		"metadata": map[string]any{
			"name":       svc.Name,
			"namespace":  svc.Namespace,
			"generation": int64(3),
		},
		"spec": map[string]any{
			"image": svc.Spec.Image,
		},
	}}
	gvr := SchemeGroupVersion.WithResource("summitservices")
	statusClient := fake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), map[schema.GroupVersionResource]string{
		gvr: "SummitServiceList",
	}, object)
	reconciler := NewReconciler(k8sfake.NewSimpleClientset(), WithStatusClient(statusClient))

	if _, err := reconciler.Reconcile(context.Background(), svc); err != nil {
		t.Fatalf("reconcile failed: %v", err)
	}
	updated, err := statusClient.Resource(gvr).Namespace(svc.Namespace).Get(context.Background(), svc.Name, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("reading SummitService after status update: %v", err)
	}
	phase, found, err := unstructured.NestedString(updated.Object, "status", "phase")
	if err != nil || !found || phase != string(PhaseProgressing) {
		t.Fatalf("expected persisted Progressing status, got phase=%q found=%t err=%v", phase, found, err)
	}
	generation, found, err := unstructured.NestedInt64(updated.Object, "status", "observedGeneration")
	if err != nil || !found || generation != 3 {
		t.Fatalf("expected observedGeneration=3, got generation=%d found=%t err=%v", generation, found, err)
	}
}
