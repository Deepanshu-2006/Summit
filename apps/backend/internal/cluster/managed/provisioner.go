package managed

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	appsv1 "k8s.io/api/apps/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// Result is one successful provision.
type Result struct {
	Name      string
	Namespace string
	Image     string
	// CreatedSecret is true only when this call generated a new password.
	CreatedSecret bool
}

// Provisioner applies addon objects with a typed client.
type Provisioner struct {
	client  kubernetes.Interface
	catalog Catalog
}

// NewProvisioner returns a provisioner. A nil catalog uses DefaultCatalog.
func NewProvisioner(client kubernetes.Interface, catalog Catalog) *Provisioner {
	if catalog == nil {
		catalog = DefaultCatalog()
	}
	return &Provisioner{client: client, catalog: catalog}
}

func newPassword() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("managed: generate password: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// Provision creates or updates the Secret, headless Service, and StatefulSet.
// An existing Secret keeps its password. An existing StatefulSet keeps its
// volumeClaimTemplates, so the PVC and its data stay in place.
func (p *Provisioner) Provision(ctx context.Context, req Request) (Result, error) {
	if p == nil || p.client == nil {
		return Result{}, errors.New("managed: kubernetes client is required")
	}
	addon, err := lookup(p.catalog, req.Engine)
	if err != nil {
		return Result{}, err
	}
	name, err := ObjectName(req.ServiceID)
	if err != nil {
		return Result{}, err
	}
	if strings.TrimSpace(req.Namespace) == "" {
		return Result{}, errors.New("managed: namespace is required")
	}

	createdSecret, err := p.ensureSecret(ctx, req, addon, name)
	if err != nil {
		return Result{}, err
	}
	if err := p.ensureService(ctx, req, addon); err != nil {
		return Result{}, err
	}
	if err := p.ensureStatefulSet(ctx, req, addon); err != nil {
		return Result{}, err
	}
	return Result{Name: name, Namespace: req.Namespace, Image: addon.Image, CreatedSecret: createdSecret}, nil
}

func (p *Provisioner) ensureSecret(ctx context.Context, req Request, addon Addon, name string) (bool, error) {
	existing, getErr := p.client.CoreV1().Secrets(req.Namespace).Get(ctx, name, metav1.GetOptions{})
	if getErr != nil && !apierrors.IsNotFound(getErr) {
		return false, fmt.Errorf("managed: get secret %s: %w", name, getErr)
	}
	// `found` is decided once, before err is reused below (clients may return a
	// non-nil empty object together with a NotFound error).
	found := getErr == nil && existing != nil
	password := ""
	created := false
	if found {
		password = string(existing.Data["password"])
	}
	if password == "" {
		var err error
		password, err = newPassword()
		if err != nil {
			return false, err
		}
		created = true
	}
	desired, err := BuildSecret(req, password, addon)
	if err != nil {
		return false, err
	}
	if !found {
		if _, createErr := p.client.CoreV1().Secrets(req.Namespace).Create(ctx, desired, metav1.CreateOptions{}); createErr != nil {
			if !apierrors.IsAlreadyExists(createErr) {
				return false, fmt.Errorf("managed: create secret %s: %w", name, createErr)
			}
			return p.ensureSecret(ctx, req, addon, name)
		}
		return created, nil
	}
	desired.ResourceVersion = existing.ResourceVersion
	if _, err := p.client.CoreV1().Secrets(req.Namespace).Update(ctx, desired, metav1.UpdateOptions{}); err != nil {
		return false, fmt.Errorf("managed: update secret %s: %w", name, err)
	}
	return false, nil
}

func (p *Provisioner) ensureService(ctx context.Context, req Request, addon Addon) error {
	desired, err := BuildService(req, addon)
	if err != nil {
		return err
	}
	existing, err := p.client.CoreV1().Services(req.Namespace).Get(ctx, desired.Name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		if _, createErr := p.client.CoreV1().Services(req.Namespace).Create(ctx, desired, metav1.CreateOptions{}); createErr != nil && !apierrors.IsAlreadyExists(createErr) {
			return fmt.Errorf("managed: create service %s: %w", desired.Name, createErr)
		}
		return nil
	}
	if err != nil {
		return fmt.Errorf("managed: get service %s: %w", desired.Name, err)
	}
	desired.ResourceVersion = existing.ResourceVersion
	desired.Spec.ClusterIP = existing.Spec.ClusterIP
	if _, err := p.client.CoreV1().Services(req.Namespace).Update(ctx, desired, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("managed: update service %s: %w", desired.Name, err)
	}
	return nil
}

func (p *Provisioner) ensureStatefulSet(ctx context.Context, req Request, addon Addon) error {
	desired, err := BuildStatefulSet(req, addon)
	if err != nil {
		return err
	}
	existing, err := p.client.AppsV1().StatefulSets(req.Namespace).Get(ctx, desired.Name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		if _, createErr := p.client.AppsV1().StatefulSets(req.Namespace).Create(ctx, desired, metav1.CreateOptions{}); createErr != nil && !apierrors.IsAlreadyExists(createErr) {
			return fmt.Errorf("managed: create statefulset %s: %w", desired.Name, createErr)
		}
		return nil
	}
	if err != nil {
		return fmt.Errorf("managed: get statefulset %s: %w", desired.Name, err)
	}
	// volumeClaimTemplates are immutable. Keep the volume that already holds data.
	desired.ResourceVersion = existing.ResourceVersion
	desired.Spec.VolumeClaimTemplates = existing.Spec.VolumeClaimTemplates
	if _, err := p.client.AppsV1().StatefulSets(req.Namespace).Update(ctx, desired, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("managed: update statefulset %s: %w", desired.Name, err)
	}
	return nil
}

// Ready reports whether the addon StatefulSet exists and its single replica is ready.
func (p *Provisioner) Ready(ctx context.Context, namespace, serviceID string) (exists bool, ready bool, err error) {
	if p == nil || p.client == nil {
		return false, false, errors.New("managed: kubernetes client is required")
	}
	name, err := ObjectName(serviceID)
	if err != nil {
		return false, false, err
	}
	sts, err := p.client.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return false, false, nil
	}
	if err != nil {
		return false, false, fmt.Errorf("managed: get statefulset %s: %w", name, err)
	}
	return true, statefulSetReady(sts), nil
}

func statefulSetReady(sts *appsv1.StatefulSet) bool {
	if sts == nil {
		return false
	}
	want := int32(1)
	if sts.Spec.Replicas != nil {
		want = *sts.Spec.Replicas
	}
	if want < 1 {
		want = 1
	}
	return sts.Status.ReadyReplicas >= want && sts.Status.UpdatedReplicas >= want && sts.Status.CurrentReplicas >= want
}
