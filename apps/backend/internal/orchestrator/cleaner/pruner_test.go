package cleaner

import (
	"context"
	"io"
	"log/slog"
	"reflect"
	"sort"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"

	"github.com/summit/backend/internal/orchestrator/build"
)

var t0 = time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)

func quiet() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

func ago(d time.Duration) metav1.Time { return metav1.NewTime(t0.Add(-d)) }

func pod(name, build string, phase corev1.PodPhase, age time.Duration) *corev1.Pod {
	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name: name, Namespace: DefaultNamespace, CreationTimestamp: ago(age),
			Labels: map[string]string{LabelBuildID: build, LabelAttemptID: build, LabelComponent: ComponentBuilder},
		},
		Status: corev1.PodStatus{Phase: phase},
	}
}

func secret(name, build string, age time.Duration) *corev1.Secret {
	labels := map[string]string{}
	if build != "" {
		labels[LabelBuildID] = build
	}
	return &corev1.Secret{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: DefaultNamespace, CreationTimestamp: ago(age), Labels: labels}}
}

func cm(name, build string, age time.Duration) *corev1.ConfigMap {
	return &corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{
		Name: name, Namespace: DefaultNamespace, CreationTimestamp: ago(age),
		Labels: map[string]string{LabelBuildID: build, LabelAttemptID: build, LabelComponent: ComponentBuilderSpec},
	}}
}

func newPruner(t *testing.T, objs ...interface{}) (*Pruner, *fake.Clientset) {
	t.Helper()
	cs := fake.NewSimpleClientset()
	for _, o := range objs {
		var err error
		switch v := o.(type) {
		case *corev1.Pod:
			_, err = cs.CoreV1().Pods(v.Namespace).Create(context.Background(), v, metav1.CreateOptions{})
		case *corev1.Secret:
			_, err = cs.CoreV1().Secrets(v.Namespace).Create(context.Background(), v, metav1.CreateOptions{})
		case *corev1.ConfigMap:
			_, err = cs.CoreV1().ConfigMaps(v.Namespace).Create(context.Background(), v, metav1.CreateOptions{})
		}
		if err != nil {
			t.Fatal(err)
		}
	}
	p, err := New(cs, quiet(), DefaultConfig(), WithClock(func() time.Time { return t0 }))
	if err != nil {
		t.Fatal(err)
	}
	return p, cs
}

func sorted(s []string) []string { sort.Strings(s); return s }

func TestLabelsMatchBuildPackage(t *testing.T) {
	if LabelBuildID != build.LabelBuildID || LabelAttemptID != build.LabelAttemptID || LabelComponent != build.LabelComponent {
		t.Fatal("cleaner label constants drifted from build package")
	}
	if build.BuildPodName("abc") != SecretNamePrefix+"abc" {
		t.Fatalf("pod/secret naming drifted: %s", build.BuildPodName("abc"))
	}
}

func TestPodsTTL(t *testing.T) {
	running := pod("summit-build-run", "run", corev1.PodRunning, 3*time.Hour)
	pending := pod("summit-build-pend", "pend", corev1.PodPending, 3*time.Hour)
	freshDone := pod("summit-build-fresh", "fresh", corev1.PodSucceeded, 5*time.Minute)
	oldDone := pod("summit-build-old", "old", corev1.PodSucceeded, 45*time.Minute)
	oldFailed := pod("summit-build-oldf", "oldf", corev1.PodFailed, 45*time.Minute)
	// Created long ago but only just finished: must be kept.
	longRunFinishedNow := pod("summit-build-late", "late", corev1.PodSucceeded, 2*time.Hour)
	longRunFinishedNow.Status.ContainerStatuses = []corev1.ContainerStatus{{
		State: corev1.ContainerState{Terminated: &corev1.ContainerStateTerminated{FinishedAt: ago(time.Minute)}},
	}}
	unlabeled := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "other", Namespace: DefaultNamespace, CreationTimestamp: ago(5 * time.Hour)},
		Status:     corev1.PodStatus{Phase: corev1.PodSucceeded},
	}
	notBuilder := pod("summit-build-x", "x", corev1.PodSucceeded, 5*time.Hour)
	notBuilder.Labels[LabelComponent] = "other"

	p, cs := newPruner(t, running, pending, freshDone, oldDone, oldFailed, longRunFinishedNow, unlabeled, notBuilder)
	rep, err := p.RunOnce(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"summit-build-old", "summit-build-oldf"}
	if got := sorted(rep.PodsDeleted); !reflect.DeepEqual(got, want) {
		t.Errorf("pods deleted %v want %v", got, want)
	}
	left, _ := cs.CoreV1().Pods(DefaultNamespace).List(context.Background(), metav1.ListOptions{})
	if len(left.Items) != 6 {
		t.Errorf("remaining pods %d want 6", len(left.Items))
	}
}

func TestOrphanSecretsAndConfigMaps(t *testing.T) {
	objs := []interface{}{
		// live pod keeps its secret and spec regardless of age
		pod("summit-build-live", "live", corev1.PodRunning, 2*time.Hour),
		secret("summit-build-live", "live", 2*time.Hour),
		cm("summit-build-spec-live", "live", 2*time.Hour),
		// orphan, old enough
		secret("summit-build-gone", "gone", 20*time.Minute),
		cm("summit-build-spec-gone", "gone", 20*time.Minute),
		// orphan but young: orchestrator may be between secret and pod creation
		secret("summit-build-young", "young", 2*time.Minute),
		cm("summit-build-spec-young", "young", 2*time.Minute),
		// never touched: no build label / wrong prefix
		secret("ghcr-push", "", 24*time.Hour),
		secret("summit-build-nolabel", "", 24*time.Hour),
		secret("custom-name", "gone", 24*time.Hour),
		&corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "unrelated", Namespace: DefaultNamespace, CreationTimestamp: ago(24 * time.Hour)}},
	}
	p, cs := newPruner(t, objs...)
	rep, err := p.RunOnce(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"summit-build-gone"}; !reflect.DeepEqual(rep.SecretsDeleted, want) {
		t.Errorf("secrets deleted %v want %v", rep.SecretsDeleted, want)
	}
	if want := []string{"summit-build-spec-gone"}; !reflect.DeepEqual(rep.ConfigMapsDeleted, want) {
		t.Errorf("configmaps deleted %v want %v", rep.ConfigMapsDeleted, want)
	}
	for _, name := range []string{"ghcr-push", "summit-build-nolabel", "custom-name", "summit-build-live", "summit-build-young"} {
		if _, err := cs.CoreV1().Secrets(DefaultNamespace).Get(context.Background(), name, metav1.GetOptions{}); err != nil {
			t.Errorf("secret %s should remain: %v", name, err)
		}
	}
	if _, err := cs.CoreV1().ConfigMaps(DefaultNamespace).Get(context.Background(), "unrelated", metav1.GetOptions{}); err != nil {
		t.Errorf("unrelated configmap deleted: %v", err)
	}
}

func TestSpecAndSecretOfPrunedPodAreCleanedSameRun(t *testing.T) {
	p, cs := newPruner(t,
		pod("summit-build-b1", "b1", corev1.PodSucceeded, time.Hour),
		secret("summit-build-b1", "b1", time.Hour),
		cm("summit-build-spec-b1", "b1", time.Hour),
	)
	rep, err := p.RunOnce(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(rep.PodsDeleted) != 1 || len(rep.SecretsDeleted) != 1 || len(rep.ConfigMapsDeleted) != 1 {
		t.Fatalf("unexpected report %+v", rep)
	}
	if _, err := cs.CoreV1().Secrets(DefaultNamespace).Get(context.Background(), "summit-build-b1", metav1.GetOptions{}); !apierrors.IsNotFound(err) {
		t.Errorf("secret should be gone, err=%v", err)
	}
}

func TestOtherNamespaceUntouched(t *testing.T) {
	other := pod("summit-build-o", "o", corev1.PodSucceeded, 5*time.Hour)
	other.Namespace = "tenant-x"
	p, cs := newPruner(t, other)
	if _, err := p.RunOnce(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := cs.CoreV1().Pods("tenant-x").Get(context.Background(), "summit-build-o", metav1.GetOptions{}); err != nil {
		t.Errorf("pod in other namespace must remain: %v", err)
	}
}

func TestRunStopsOnContextCancel(t *testing.T) {
	cs := fake.NewSimpleClientset(pod("summit-build-old", "old", corev1.PodFailed, time.Hour))
	cfg := DefaultConfig()
	cfg.Interval = 10 * time.Millisecond
	p, err := New(cs, quiet(), cfg, WithClock(func() time.Time { return t0 }))
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 80*time.Millisecond)
	defer cancel()
	if err := p.Run(ctx); err == nil {
		t.Fatal("expected context error")
	}
	left, _ := cs.CoreV1().Pods(DefaultNamespace).List(context.Background(), metav1.ListOptions{})
	if len(left.Items) != 0 {
		t.Errorf("Run did not sweep before exiting")
	}
}

func TestConfigValidation(t *testing.T) {
	if _, err := New(nil, nil, DefaultConfig()); err == nil {
		t.Error("nil client accepted")
	}
	for _, mut := range []func(*Config){
		func(c *Config) { c.Namespace = " " },
		func(c *Config) { c.TerminalPodTTL = 0 },
		func(c *Config) { c.OrphanTTL = 0 },
		func(c *Config) { c.Interval = 0 },
	} {
		c := DefaultConfig()
		mut(&c)
		if _, err := New(fake.NewSimpleClientset(), nil, c); err == nil {
			t.Errorf("invalid config accepted: %+v", c)
		}
	}
}
