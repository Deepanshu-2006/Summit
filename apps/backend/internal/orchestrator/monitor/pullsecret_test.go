package monitor

import (
	"context"
	"log/slog"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func pullSecretMonitor(kc *fake.Clientset, srcNS string) *Monitor {
	return &Monitor{kubeClient: kc, cfg: Config{PullSecretSourceNamespace: srcNS}, logger: slog.Default()}
}

func dockerSecret(ns, data string) *corev1.Secret {
	return &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "ghcr-pull", Namespace: ns},
		Type:       corev1.SecretTypeDockerConfigJson,
		Data:       map[string][]byte{corev1.DockerConfigJsonKey: []byte(data)},
	}
}

func TestEnsurePullSecretCopiesIntoTenant(t *testing.T) {
	ctx := context.Background()
	kc := fake.NewClientset(dockerSecret("summit-system", `{"auths":{"ghcr.io":{}}}`))
	if err := pullSecretMonitor(kc, "summit-system").ensurePullSecret(ctx, "tenant-a", "ghcr-pull"); err != nil {
		t.Fatal(err)
	}
	got, err := kc.CoreV1().Secrets("tenant-a").Get(ctx, "ghcr-pull", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("secret not copied: %v", err)
	}
	if got.Type != corev1.SecretTypeDockerConfigJson || string(got.Data[corev1.DockerConfigJsonKey]) != `{"auths":{"ghcr.io":{}}}` {
		t.Fatalf("wrong copy: %+v", got)
	}
	if got.Labels[pullSecretManagedLabel] != "summit-orchestrator" {
		t.Fatalf("missing managed label: %v", got.Labels)
	}
}

func TestEnsurePullSecretSyncsRotatedSource(t *testing.T) {
	ctx := context.Background()
	kc := fake.NewClientset(dockerSecret("summit-system", "new"), dockerSecret("tenant-a", "old"))
	if err := pullSecretMonitor(kc, "summit-system").ensurePullSecret(ctx, "tenant-a", "ghcr-pull"); err != nil {
		t.Fatal(err)
	}
	got, _ := kc.CoreV1().Secrets("tenant-a").Get(ctx, "ghcr-pull", metav1.GetOptions{})
	if string(got.Data[corev1.DockerConfigJsonKey]) != "new" {
		t.Fatalf("tenant copy not updated: %q", got.Data[corev1.DockerConfigJsonKey])
	}
}

func TestEnsurePullSecretReplacesWrongType(t *testing.T) {
	ctx := context.Background()
	opaque := dockerSecret("tenant-a", "x")
	opaque.Type = corev1.SecretTypeOpaque
	kc := fake.NewClientset(dockerSecret("summit-system", "x"), opaque)
	if err := pullSecretMonitor(kc, "summit-system").ensurePullSecret(ctx, "tenant-a", "ghcr-pull"); err != nil {
		t.Fatal(err)
	}
	got, _ := kc.CoreV1().Secrets("tenant-a").Get(ctx, "ghcr-pull", metav1.GetOptions{})
	if got.Type != corev1.SecretTypeDockerConfigJson {
		t.Fatalf("type not replaced: %s", got.Type)
	}
}

func TestEnsurePullSecretMissingSourceIsNotFatal(t *testing.T) {
	ctx := context.Background()
	kc := fake.NewClientset()
	if err := pullSecretMonitor(kc, "summit-system").ensurePullSecret(ctx, "tenant-a", "ghcr-pull"); err != nil {
		t.Fatalf("missing source must not block rollout: %v", err)
	}
	if _, err := kc.CoreV1().Secrets("tenant-a").Get(ctx, "ghcr-pull", metav1.GetOptions{}); err == nil {
		t.Fatal("no secret should be created without a source")
	}
}

func TestEnsurePullSecretDisabled(t *testing.T) {
	kc := fake.NewClientset(dockerSecret("summit-system", "x"))
	if err := pullSecretMonitor(kc, "").ensurePullSecret(context.Background(), "tenant-a", "ghcr-pull"); err != nil {
		t.Fatal(err)
	}
	if len(kc.Actions()) != 0 {
		t.Fatalf("disabled sync must not touch the API, got %d actions", len(kc.Actions()))
	}
}
