package monitor

import (
	"bytes"
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// pullSecretManagedLabel marks tenant pull secrets the orchestrator copies and keeps in sync.
const pullSecretManagedLabel = "summit.dev/managed-by"

// ensurePullSecret copies the registry pull secret from cfg.PullSecretSourceNamespace into the
// tenant namespace and keeps it in sync (token rotation in the source propagates on the next
// rollout). A missing source is logged, not fatal: public images still pull without it, and an
// operator may have created the tenant copy by hand.
func (m *Monitor) ensurePullSecret(ctx context.Context, namespace, name string) error {
	srcNS := m.cfg.PullSecretSourceNamespace
	if m.kubeClient == nil || srcNS == "" || name == "" || srcNS == namespace {
		return nil
	}
	secrets := m.kubeClient.CoreV1().Secrets
	src, err := secrets(srcNS).Get(ctx, name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		m.logger.Warn("pull secret source missing; tenant images from private registries will fail to pull",
			"source", srcNS+"/"+name, "namespace", namespace)
		return nil
	}
	if err != nil {
		return fmt.Errorf("get pull secret source %s/%s: %w", srcNS, name, err)
	}

	desired := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels:    map[string]string{pullSecretManagedLabel: "summit-orchestrator"},
		},
		Type: src.Type,
		Data: src.Data,
	}

	cur, err := secrets(namespace).Get(ctx, name, metav1.GetOptions{})
	switch {
	case apierrors.IsNotFound(err):
		if _, err := secrets(namespace).Create(ctx, desired, metav1.CreateOptions{}); err != nil && !apierrors.IsAlreadyExists(err) {
			return fmt.Errorf("create pull secret %s/%s: %w", namespace, name, err)
		}
		m.logger.Info("copied pull secret into tenant namespace", "secret", name, "namespace", namespace)
		return nil
	case err != nil:
		return fmt.Errorf("get pull secret %s/%s: %w", namespace, name, err)
	}

	if cur.Type == src.Type && secretDataEqual(cur.Data, src.Data) {
		return nil
	}
	if cur.Type != src.Type {
		// Secret type is immutable; replace the object.
		if err := secrets(namespace).Delete(ctx, name, metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
			return fmt.Errorf("replace pull secret %s/%s: %w", namespace, name, err)
		}
		if _, err := secrets(namespace).Create(ctx, desired, metav1.CreateOptions{}); err != nil {
			return fmt.Errorf("replace pull secret %s/%s: %w", namespace, name, err)
		}
	} else {
		cur.Data = src.Data
		if cur.Labels == nil {
			cur.Labels = map[string]string{}
		}
		cur.Labels[pullSecretManagedLabel] = "summit-orchestrator"
		if _, err := secrets(namespace).Update(ctx, cur, metav1.UpdateOptions{}); err != nil {
			return fmt.Errorf("update pull secret %s/%s: %w", namespace, name, err)
		}
	}
	m.logger.Info("synced pull secret into tenant namespace", "secret", name, "namespace", namespace)
	return nil
}

func secretDataEqual(a, b map[string][]byte) bool {
	if len(a) != len(b) {
		return false
	}
	for k, v := range a {
		if w, ok := b[k]; !ok || !bytes.Equal(v, w) {
			return false
		}
	}
	return true
}
