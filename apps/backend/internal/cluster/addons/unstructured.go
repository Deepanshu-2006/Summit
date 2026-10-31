package addons

import (
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/scheme"
)

// newUnstructured builds an empty object with the given identity.
func newUnstructured(apiVersion, kind, namespace, name string) *unstructured.Unstructured {
	u := &unstructured.Unstructured{Object: map[string]any{}}
	u.SetAPIVersion(apiVersion)
	u.SetKind(kind)
	u.SetName(name)
	if namespace != "" {
		u.SetNamespace(namespace)
	}
	return u
}

// ToUnstructured converts a typed built-in object (resolved through client-go's scheme) to an
// unstructured object with apiVersion/kind set and server-owned fields (status,
// creationTimestamp) removed so it is suitable for server-side apply.
func ToUnstructured(obj runtime.Object) (*unstructured.Unstructured, error) {
	gvks, _, err := scheme.Scheme.ObjectKinds(obj)
	if err != nil || len(gvks) == 0 {
		return nil, fmt.Errorf("addons: cannot resolve kind of %T: %v", obj, err)
	}
	content, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	if err != nil {
		return nil, fmt.Errorf("addons: convert %T to unstructured: %w", obj, err)
	}
	u := &unstructured.Unstructured{Object: content}
	u.SetGroupVersionKind(gvks[0])
	unstructured.RemoveNestedField(u.Object, "metadata", "creationTimestamp")
	unstructured.RemoveNestedField(u.Object, "status")
	return u, nil
}

// strSlice converts []string to []any (required for unstructured content).
func strSlice(in []string) []any {
	out := make([]any, len(in))
	for i, s := range in {
		out[i] = s
	}
	return out
}

// strMap converts map[string]string to map[string]any.
func strMap(in map[string]string) map[string]any {
	out := make(map[string]any, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

func portEntry(port int32, proto string) map[string]any {
	return map[string]any{"port": fmt.Sprintf("%d", port), "protocol": proto}
}
