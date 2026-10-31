package build

import (
	"context"
	"errors"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes/fake"
	k8stesting "k8s.io/client-go/testing"
)

func setupTestAdapter(t *testing.T, objects ...runtime.Object) (*Adapter, *fake.Clientset) {
	client := fake.NewClientset(objects...)
	cfg := DefaultConfig()
	cfg.BuilderImage = "ghcr.io/summit/test-builder:latest"
	cfg.RuntimeClassName = "gvisor"
	cfg.Namespace = "summit-builds"

	resolver := NewDefaultSecretResolver()
	adapter := NewAdapter(client, cfg, resolver, nil)
	return adapter, client
}

func TestAdapter_CreateBuildPod_Success(t *testing.T) {
	adapter, client := setupTestAdapter(t)
	spec := validSpec()

	ctx := context.Background()
	pod, err := adapter.CreateBuildPod(ctx, spec)
	if err != nil {
		t.Fatalf("unexpected error creating build pod: %v", err)
	}

	if pod == nil {
		t.Fatalf("expected non-nil pod")
	}

	// Verify Pod exists in fake clientset
	podName := BuildPodName(spec.Build.AttemptID)
	k8sPod, err := client.CoreV1().Pods(adapter.cfg.Namespace).Get(ctx, podName, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("failed to retrieve pod from fake client: %v", err)
	}
	if k8sPod.Name != podName {
		t.Errorf("pod name mismatch: expected %s, got %s", podName, k8sPod.Name)
	}
	if *k8sPod.Spec.RuntimeClassName != "gvisor" {
		t.Errorf("expected runtimeClassName 'gvisor', got %s", *k8sPod.Spec.RuntimeClassName)
	}

	// Verify ConfigMap exists in fake clientset
	cmName := BuildConfigMapName(spec.Build.AttemptID)
	cm, err := client.CoreV1().ConfigMaps(adapter.cfg.Namespace).Get(ctx, cmName, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("failed to retrieve configmap from fake client: %v", err)
	}
	if _, ok := cm.Data["execution.json"]; !ok {
		t.Errorf("execution.json key missing from configmap data")
	}
}

func TestAdapter_CreateBuildPod_RollbackOnPodCreationFailure(t *testing.T) {
	adapter, client := setupTestAdapter(t)
	spec := validSpec()

	// Inject error on pod creation
	client.PrependReactor("create", "pods", func(action k8stesting.Action) (handled bool, ret runtime.Object, err error) {
		return true, nil, errors.New("admission webhook denied pod creation")
	})

	ctx := context.Background()
	pod, err := adapter.CreateBuildPod(ctx, spec)
	if err == nil {
		t.Fatalf("expected error creating build pod, got nil")
	}
	if pod != nil {
		t.Fatalf("expected nil pod on failure")
	}

	// Verify ConfigMap was deleted during rollback
	cmName := BuildConfigMapName(spec.Build.AttemptID)
	_, cmErr := client.CoreV1().ConfigMaps(adapter.cfg.Namespace).Get(ctx, cmName, metav1.GetOptions{})
	if cmErr == nil {
		t.Fatalf("expected configmap to be deleted in rollback, but it still exists")
	}
}

func TestAdapter_GetBuildPod(t *testing.T) {
	adapter, _ := setupTestAdapter(t)
	spec := validSpec()
	ctx := context.Background()

	// 1. Not found
	_, err := adapter.GetBuildPod(ctx, spec.Build.ID, spec.Build.AttemptID)
	if !errors.Is(err, ErrPodNotFound) {
		t.Fatalf("expected ErrPodNotFound, got %v", err)
	}

	// 2. Create pod
	created, err := adapter.CreateBuildPod(ctx, spec)
	if err != nil {
		t.Fatalf("unexpected error creating pod: %v", err)
	}

	// 3. Find by attemptID
	found, err := adapter.GetBuildPod(ctx, "", spec.Build.AttemptID)
	if err != nil {
		t.Fatalf("unexpected error getting pod by attemptID: %v", err)
	}
	if found.Name != created.Name {
		t.Errorf("expected pod %s, got %s", created.Name, found.Name)
	}

	// 4. Find by fallback buildID
	foundByBuildID, err := adapter.GetBuildPod(ctx, spec.Build.ID, "")
	if err != nil {
		t.Fatalf("unexpected error getting pod by buildID: %v", err)
	}
	if foundByBuildID.Name != created.Name {
		t.Errorf("expected pod %s, got %s", created.Name, foundByBuildID.Name)
	}
}

func TestAdapter_GetBuildPodStatus(t *testing.T) {
	adapter, client := setupTestAdapter(t)
	spec := validSpec()
	ctx := context.Background()

	pod, err := adapter.CreateBuildPod(ctx, spec)
	if err != nil {
		t.Fatalf("failed to create pod: %v", err)
	}

	// Initial status should be empty/pending
	st, err := adapter.GetBuildPodStatus(ctx, spec.Build.ID, spec.Build.AttemptID)
	if err != nil {
		t.Fatalf("unexpected error getting status: %v", err)
	}
	if st.PodName != pod.Name {
		t.Errorf("expected podName %s, got %s", pod.Name, st.PodName)
	}

	// Update pod status to running
	now := metav1.Now()
	pod.Status.Phase = corev1.PodRunning
	pod.Status.ContainerStatuses = []corev1.ContainerStatus{
		{
			Name:  "builder",
			Ready: true,
			State: corev1.ContainerState{
				Running: &corev1.ContainerStateRunning{
					StartedAt: now,
				},
			},
		},
	}
	if _, err := client.CoreV1().Pods(adapter.cfg.Namespace).UpdateStatus(ctx, pod, metav1.UpdateOptions{}); err != nil {
		t.Fatalf("failed to update status: %v", err)
	}

	st, err = adapter.GetBuildPodStatus(ctx, spec.Build.ID, spec.Build.AttemptID)
	if err != nil {
		t.Fatalf("unexpected error getting status: %v", err)
	}
	if st.Phase != corev1.PodRunning {
		t.Errorf("expected phase Running, got %s", st.Phase)
	}
	if !st.Ready {
		t.Errorf("expected container ready true")
	}
	if st.StartedAt == nil {
		t.Errorf("expected non-nil startedAt")
	}

	// Update pod status to succeeded
	exitCode := int32(0)
	pod.Status.Phase = corev1.PodSucceeded
	pod.Status.ContainerStatuses = []corev1.ContainerStatus{
		{
			Name:  "builder",
			Ready: false,
			State: corev1.ContainerState{
				Terminated: &corev1.ContainerStateTerminated{
					ExitCode:   exitCode,
					Reason:     "Completed",
					Message:    "Build completed successfully",
					StartedAt:  now,
					FinishedAt: now,
				},
			},
		},
	}
	if _, err := client.CoreV1().Pods(adapter.cfg.Namespace).UpdateStatus(ctx, pod, metav1.UpdateOptions{}); err != nil {
		t.Fatalf("failed to update status: %v", err)
	}

	st, err = adapter.GetBuildPodStatus(ctx, spec.Build.ID, spec.Build.AttemptID)
	if err != nil {
		t.Fatalf("unexpected error getting status: %v", err)
	}
	if st.Phase != corev1.PodSucceeded {
		t.Errorf("expected phase Succeeded, got %s", st.Phase)
	}
	if !st.IsTerminal() {
		t.Errorf("expected Succeeded to be terminal")
	}
	if st.ExitCode == nil || *st.ExitCode != 0 {
		t.Errorf("expected exit code 0, got %v", st.ExitCode)
	}
}

func TestAdapter_WatchBuildPod_Lifecycle(t *testing.T) {
	adapter, client := setupTestAdapter(t)
	spec := validSpec()

	fakeWatch := watch.NewFake()
	client.PrependWatchReactor("pods", k8stesting.DefaultWatchReactor(fakeWatch, nil))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	events, err := adapter.WatchBuildPod(ctx, spec.Build.ID, spec.Build.AttemptID)
	if err != nil {
		t.Fatalf("unexpected error starting watch: %v", err)
	}

	// 1. Emit Added (Pending)
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      BuildPodName(spec.Build.AttemptID),
			Namespace: adapter.cfg.Namespace,
			Labels: map[string]string{
				LabelBuildID:   spec.Build.ID,
				LabelAttemptID: spec.Build.AttemptID,
			},
		},
		Status: corev1.PodStatus{
			Phase: corev1.PodPending,
		},
	}
	fakeWatch.Add(pod)

	ev1 := <-events
	if ev1.Phase != corev1.PodPending {
		t.Errorf("expected phase Pending, got %s", ev1.Phase)
	}

	// 2. Emit Modified (Running)
	podRunning := pod.DeepCopy()
	podRunning.Status.Phase = corev1.PodRunning
	podRunning.Status.ContainerStatuses = []corev1.ContainerStatus{
		{
			Name:  "builder",
			Ready: true,
			State: corev1.ContainerState{
				Running: &corev1.ContainerStateRunning{
					StartedAt: metav1.Now(),
				},
			},
		},
	}
	fakeWatch.Modify(podRunning)

	ev2 := <-events
	if ev2.Phase != corev1.PodRunning {
		t.Errorf("expected phase Running, got %s", ev2.Phase)
	}

	// 3. Emit Modified (Succeeded - Terminal)
	podSucceeded := pod.DeepCopy()
	exitCode := int32(0)
	podSucceeded.Status.Phase = corev1.PodSucceeded
	podSucceeded.Status.ContainerStatuses = []corev1.ContainerStatus{
		{
			Name:  "builder",
			Ready: false,
			State: corev1.ContainerState{
				Terminated: &corev1.ContainerStateTerminated{
					ExitCode: exitCode,
					Reason:   "Completed",
				},
			},
		},
	}
	fakeWatch.Modify(podSucceeded)

	ev3 := <-events
	if ev3.Phase != corev1.PodSucceeded {
		t.Errorf("expected phase Succeeded, got %s", ev3.Phase)
	}

	// Channel should close automatically because Succeeded is terminal
	select {
	case _, ok := <-events:
		if ok {
			t.Errorf("expected events channel to be closed after terminal state")
		}
	case <-time.After(1 * time.Second):
		t.Errorf("timed out waiting for events channel to close")
	}
}

func TestAdapter_DeleteAndCleanup(t *testing.T) {
	adapter, client := setupTestAdapter(t)
	spec := validSpec()
	ctx := context.Background()

	// 1. Create pod and configmap
	_, err := adapter.CreateBuildPod(ctx, spec)
	if err != nil {
		t.Fatalf("failed to create build pod: %v", err)
	}

	podName := BuildPodName(spec.Build.AttemptID)
	cmName := BuildConfigMapName(spec.Build.AttemptID)

	// 2. Delete build pod only
	if err := adapter.DeleteBuildPod(ctx, spec.Build.ID, spec.Build.AttemptID); err != nil {
		t.Fatalf("unexpected error deleting pod: %v", err)
	}

	_, err = client.CoreV1().Pods(adapter.cfg.Namespace).Get(ctx, podName, metav1.GetOptions{})
	if err == nil {
		t.Errorf("expected pod to be deleted")
	}

	// Configmap should still exist
	_, err = client.CoreV1().ConfigMaps(adapter.cfg.Namespace).Get(ctx, cmName, metav1.GetOptions{})
	if err != nil {
		t.Errorf("expected configmap to still exist after DeleteBuildPod")
	}

	// 3. Full cleanup
	if err := adapter.CleanupBuild(ctx, spec.Build.ID, spec.Build.AttemptID); err != nil {
		t.Fatalf("unexpected error during cleanup: %v", err)
	}

	_, err = client.CoreV1().ConfigMaps(adapter.cfg.Namespace).Get(ctx, cmName, metav1.GetOptions{})
	if err == nil {
		t.Errorf("expected configmap to be deleted after CleanupBuild")
	}

	// 4. Idempotency test: calling Cleanup again returns no error
	if err := adapter.CleanupBuild(ctx, spec.Build.ID, spec.Build.AttemptID); err != nil {
		t.Errorf("expected idempotent CleanupBuild to succeed, got %v", err)
	}
}
