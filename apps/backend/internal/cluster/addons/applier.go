package addons

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"

	"github.com/summit/backend/internal/cluster/workloads"
)

// FieldManager is the server-side apply field manager name.
const FieldManager = "summit-orchestrator"

// ErrAddonUnavailable is returned (wrapped) when the API server does not serve the resource
// (typically the CRD is not installed). Callers log and skip feature-flagged add-ons.
var ErrAddonUnavailable = errors.New("addons: resource type not available in cluster")

// ObjectApplier applies a desired unstructured object idempotently. It is the seam used by
// TenantProvisioner so tests can record applied objects.
type ObjectApplier interface {
	Apply(ctx context.Context, obj *unstructured.Unstructured) error
}

// Applier applies objects with server-side apply through a dynamic client.
type Applier struct {
	dyn    dynamic.Interface
	mapper meta.RESTMapper
}

var _ ObjectApplier = (*Applier)(nil)

// NewApplier creates an Applier. The mapper resolves GroupVersionKind to resource; use
// NewDiscoveryMapper for a live cluster.
func NewApplier(dyn dynamic.Interface, mapper meta.RESTMapper) *Applier {
	return &Applier{dyn: dyn, mapper: mapper}
}

// NewDiscoveryMapper returns a lazily refreshing RESTMapper backed by discovery, so CRDs
// installed after process start are picked up.
func NewDiscoveryMapper(disc discovery.DiscoveryInterface) meta.RESTMapper {
	return restmapper.NewDeferredDiscoveryRESTMapper(memory.NewMemCacheClient(disc))
}

// NewApplierFromConfig builds an Applier from a REST config.
func NewApplierFromConfig(cfg *rest.Config) (*Applier, error) {
	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("addons: dynamic client: %w", err)
	}
	disc, err := discovery.NewDiscoveryClientForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("addons: discovery client: %w", err)
	}
	return NewApplier(dyn, NewDiscoveryMapper(disc)), nil
}

// Apply server-side-applies obj with force and the summit-orchestrator field manager. The
// summit.dev/managed-by label is always set. If the resource type is not served, the returned
// error wraps ErrAddonUnavailable.
func (a *Applier) Apply(ctx context.Context, obj *unstructured.Unstructured) error {
	if obj == nil || obj.GetName() == "" || obj.GetKind() == "" {
		return fmt.Errorf("addons: object must have kind and name")
	}
	obj = obj.DeepCopy()
	ensureManaged(obj)

	gvk := obj.GroupVersionKind()
	mapping, err := a.mapper.RESTMapping(gvk.GroupKind(), gvk.Version)
	if err != nil {
		if meta.IsNoMatchError(err) {
			return fmt.Errorf("%w: %s: %v", ErrAddonUnavailable, gvk.String(), err)
		}
		return fmt.Errorf("addons: map %s: %w", gvk.String(), err)
	}

	var ri dynamic.ResourceInterface
	if mapping.Scope.Name() == meta.RESTScopeNameNamespace {
		if obj.GetNamespace() == "" {
			return fmt.Errorf("addons: %s %q requires a namespace", gvk.Kind, obj.GetName())
		}
		ri = a.dyn.Resource(mapping.Resource).Namespace(obj.GetNamespace())
	} else {
		ri = a.dyn.Resource(mapping.Resource)
	}

	data, err := json.Marshal(obj.Object)
	if err != nil {
		return fmt.Errorf("addons: encode %s %q: %w", gvk.Kind, obj.GetName(), err)
	}
	force := true
	_, err = ri.Patch(ctx, obj.GetName(), types.ApplyPatchType, data, metav1.PatchOptions{
		FieldManager: FieldManager,
		Force:        &force,
	})
	if err != nil {
		if isResourceMissing(err) {
			return fmt.Errorf("%w: %s: %v", ErrAddonUnavailable, gvk.String(), err)
		}
		return fmt.Errorf("addons: apply %s %q: %w", gvk.Kind, obj.GetName(), err)
	}
	return nil
}

// ApplyTyped converts a built-in typed object and applies it.
func (a *Applier) ApplyTyped(ctx context.Context, obj runtime.Object) error {
	return ApplyTyped(ctx, a, obj)
}

// ApplyTyped converts a built-in typed object and applies it through any ObjectApplier.
func ApplyTyped(ctx context.Context, ap ObjectApplier, obj runtime.Object) error {
	u, err := ToUnstructured(obj)
	if err != nil {
		return err
	}
	return ap.Apply(ctx, u)
}

// isResourceMissing reports a 404 that refers to the resource type rather than a missing
// namespace (a patch into a nonexistent namespace also returns NotFound).
func isResourceMissing(err error) bool {
	var status apierrors.APIStatus
	if !errors.As(err, &status) || !apierrors.IsNotFound(err) {
		return false
	}
	d := status.Status().Details
	return d == nil || d.Kind != "namespaces"
}

func ensureManaged(obj *unstructured.Unstructured) {
	labels := obj.GetLabels()
	if labels == nil {
		labels = map[string]string{}
	}
	labels[workloads.LabelManagedBy] = workloads.ValueManagedBy
	obj.SetLabels(labels)
}
