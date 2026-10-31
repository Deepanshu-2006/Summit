package addons

import (
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

const (
	KindSecretStore    = "SecretStore"
	KindExternalSecret = "ExternalSecret"

	// DefaultTargetSecretName is the Kubernetes Secret ESO materialises (consumed via envFrom).
	DefaultTargetSecretName = "app-env-secret"
	// DefaultExternalSecretName is the ExternalSecret object name.
	DefaultExternalSecretName = "app-env-secrets"
	// DefaultEnvironment is used when no environment is given.
	DefaultEnvironment = "production"
)

// SecretStore builds an ESO SecretStore using the Vault provider (OpenBao is API-compatible)
// with Kubernetes ServiceAccount authentication.
func SecretStore(namespace string, e ESOConfig, owner Owner) (*unstructured.Unstructured, error) {
	switch {
	case namespace == "":
		return nil, fmt.Errorf("addons: secret store requires a namespace")
	case strings.TrimSpace(e.ServerURL) == "":
		return nil, fmt.Errorf("addons: secret store requires a server URL")
	case strings.TrimSpace(e.Role) == "":
		return nil, fmt.Errorf("addons: secret store requires a Kubernetes auth role")
	case strings.TrimSpace(e.ServiceAccount) == "":
		return nil, fmt.Errorf("addons: secret store requires a service account")
	}
	u := newUnstructured(esoAPIVersion(e), KindSecretStore, namespace, storeName(e))
	u.Object["spec"] = map[string]any{
		"provider": map[string]any{
			"vault": map[string]any{
				"server":  e.ServerURL,
				"path":    orDefault(e.KVPath, DefaultOpenBaoKVPath),
				"version": orDefault(e.KVVersion, DefaultOpenBaoKVVersion),
				"auth": map[string]any{
					"kubernetes": map[string]any{
						"mountPath":         orDefault(e.AuthMountPath, DefaultOpenBaoAuthMount),
						"role":              e.Role,
						"serviceAccountRef": map[string]any{"name": e.ServiceAccount},
					},
				},
			},
		},
	}
	owner.Stamp(u)
	return u, nil
}

// ExternalSecretParams describes the secret sync for one project environment.
type ExternalSecretParams struct {
	Namespace   string
	UserID      string
	ProjectID   string
	Environment string
	// Name of the ExternalSecret and of the target Secret; defaults are used when empty.
	Name       string
	TargetName string
	Owner      Owner
}

// SecretPath returns the OpenBao key path "tenants/<user_id>/projects/<project_id>/<environment>".
func SecretPath(userID, projectID, environment string) string {
	return fmt.Sprintf("tenants/%s/projects/%s/%s", userID, projectID, orDefault(environment, DefaultEnvironment))
}

// ExternalSecret builds an ESO ExternalSecret that extracts every key at the environment path
// into the target Secret.
func ExternalSecret(p ExternalSecretParams, e ESOConfig) (*unstructured.Unstructured, error) {
	if p.Namespace == "" || p.UserID == "" || p.ProjectID == "" {
		return nil, fmt.Errorf("addons: external secret requires namespace, user id and project id")
	}
	for _, seg := range []string{p.UserID, p.ProjectID, p.Environment} {
		if strings.ContainsAny(seg, "/\\") || seg == ".." {
			return nil, fmt.Errorf("addons: invalid secret path segment %q", seg)
		}
	}
	u := newUnstructured(esoAPIVersion(e), KindExternalSecret, p.Namespace, orDefault(p.Name, DefaultExternalSecretName))
	u.Object["spec"] = map[string]any{
		"refreshInterval": orDefault(e.RefreshInterval, "1h"),
		"secretStoreRef":  map[string]any{"name": storeName(e), "kind": KindSecretStore},
		"target": map[string]any{
			"name":           orDefault(p.TargetName, DefaultTargetSecretName),
			"creationPolicy": "Owner",
		},
		"dataFrom": []any{map[string]any{
			"extract": map[string]any{"key": SecretPath(p.UserID, p.ProjectID, p.Environment)},
		}},
	}
	p.Owner.Stamp(u)
	return u, nil
}

func esoAPIVersion(e ESOConfig) string { return orDefault(e.APIVersion, DefaultESOAPIVersion) }
func storeName(e ESOConfig) string     { return orDefault(e.StoreName, "openbao-store") }

func orDefault(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return v
}
