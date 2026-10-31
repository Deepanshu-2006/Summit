package build

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	corev1 "k8s.io/api/core/v1"
)

const (
	SourceCredentialFile   = "/var/run/secrets/summit/source/token"
	RegistryCredentialFile = "/var/run/secrets/summit/registry/config.json"
	ReportingTokenFile     = "/var/run/secrets/summit/reporting/token"
)

var (
	// ErrInvalidSecretRef is returned when an opaque secret reference cannot be parsed or resolved.
	ErrInvalidSecretRef = errors.New("invalid secret reference")

	// ErrSecretMountViolation is returned if a secret mount configuration attempts non-read-only access.
	ErrSecretMountViolation = errors.New("secret mount violation: secret mounts must always be strictly read-only")

	k8sNamePattern = regexp.MustCompile(`^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$`)
	invalidChars   = regexp.MustCompile(`[^a-z0-9.-]+`)
	multiHyphens   = regexp.MustCompile(`-+`)
)

// SecretMount defines a volume and container mount configuration for a resolved secret reference.
//
// SECURITY MANDATE: SecretMount references Kubernetes Secret resources by metadata name only.
// Secret values MUST NEVER be fetched into memory, inspected, logged, or serialized into Pod manifests.
type SecretMount struct {
	// VolumeName is the Kubernetes Pod volume name.
	VolumeName string

	// SecretName is the name of the Kubernetes Secret resource to mount.
	SecretName string

	// MountPath is the absolute directory path where secrets are mounted inside the container.
	MountPath string

	// ReadOnly must always be true.
	ReadOnly bool

	// DefaultMode specifies file permission bits (e.g. 0440 for UID 1000 with fsGroup 1000).
	DefaultMode *int32

	// Items optionally projects specific keys from the secret.
	Items []corev1.KeyToPath
}

// Validate checks that the SecretMount is secure and satisfies Kubernetes conventions.
func (sm SecretMount) Validate() error {
	if !sm.ReadOnly {
		return fmt.Errorf("%w: volume %q must be read-only", ErrSecretMountViolation, sm.VolumeName)
	}
	if strings.TrimSpace(sm.VolumeName) == "" {
		return fmt.Errorf("%w: volume_name cannot be empty", ErrInvalidSecretRef)
	}
	if strings.TrimSpace(sm.SecretName) == "" {
		return fmt.Errorf("%w: secret_name cannot be empty", ErrInvalidSecretRef)
	}
	if strings.TrimSpace(sm.MountPath) == "" || !strings.HasPrefix(sm.MountPath, "/") {
		return fmt.Errorf("%w: mount_path must be an absolute path, got %q", ErrInvalidSecretRef, sm.MountPath)
	}
	return nil
}

// SecretResolver is an injectable interface that resolves opaque secret references
// (such as credentials.source_credential_ref and credentials.registry_credential_ref)
// into Kubernetes Secret volume mounts without retrieving or exposing secret values.
type SecretResolver interface {
	ResolveSecretMounts(ctx context.Context, namespace string, creds CredentialsSpec, reporting ReportingSpec) ([]SecretMount, error)
}

// DefaultSecretResolver resolves standard opaque secret references to Kubernetes Secret volume mounts.
// It supports prefixed references (e.g. "secret:my-token", "k8s:my-token", "vault:my-token") or raw secret names.
type DefaultSecretResolver struct {
	SourceMountPath    string
	RegistryMountPath  string
	ReportingMountPath string
}

// NewDefaultSecretResolver returns a DefaultSecretResolver with standard secure mount paths.
func NewDefaultSecretResolver() *DefaultSecretResolver {
	return &DefaultSecretResolver{
		SourceMountPath:    "/var/run/secrets/summit/source",
		RegistryMountPath:  "/var/run/secrets/summit/registry",
		ReportingMountPath: "/var/run/secrets/summit/reporting",
	}
}

// ResolveSecretMounts maps CredentialsSpec references to read-only Kubernetes Secret mounts.
func (r *DefaultSecretResolver) ResolveSecretMounts(_ context.Context, _ string, creds CredentialsSpec, reporting ReportingSpec) ([]SecretMount, error) {
	var mounts []SecretMount
	// Secret volumes are root-owned. The pod runs as UID/GID 1000 with fsGroup 1000,
	// so group-readable 0440 is required for the unprivileged builder to read them.
	defaultMode := int32(0440)

	if ref := strings.TrimSpace(creds.SourceCredentialRef); ref != "" {
		secretName, err := parseSecretRef(ref)
		if err != nil {
			return nil, fmt.Errorf("source_credential_ref: %w", err)
		}

		mount := SecretMount{
			VolumeName:  "source-creds",
			SecretName:  secretName,
			MountPath:   r.SourceMountPath,
			ReadOnly:    true,
			DefaultMode: &defaultMode,
			Items:       []corev1.KeyToPath{{Key: "token", Path: "token"}},
		}
		if err := mount.Validate(); err != nil {
			return nil, err
		}
		mounts = append(mounts, mount)
	}

	if ref := strings.TrimSpace(creds.RegistryCredentialRef); ref != "" {
		secretName, err := parseSecretRef(ref)
		if err != nil {
			return nil, fmt.Errorf("registry_credential_ref: %w", err)
		}

		mount := SecretMount{
			VolumeName:  "registry-creds",
			SecretName:  secretName,
			MountPath:   r.RegistryMountPath,
			ReadOnly:    true,
			DefaultMode: &defaultMode,
			Items:       []corev1.KeyToPath{{Key: ".dockerconfigjson", Path: "config.json"}},
		}
		if err := mount.Validate(); err != nil {
			return nil, err
		}
		mounts = append(mounts, mount)
	}

	if ref := strings.TrimSpace(reporting.TokenRef); ref != "" {
		secretName, err := parseSecretRef(ref)
		if err != nil {
			return nil, fmt.Errorf("reporting.token_ref: %w", err)
		}
		mount := SecretMount{
			VolumeName:  "reporting-creds",
			SecretName:  secretName,
			MountPath:   r.ReportingMountPath,
			ReadOnly:    true,
			DefaultMode: &defaultMode,
			Items:       []corev1.KeyToPath{{Key: "token", Path: "token"}},
		}
		if err := mount.Validate(); err != nil {
			return nil, err
		}
		mounts = append(mounts, mount)
	}

	return mounts, nil
}

// parseSecretRef sanitizes and parses an opaque reference string into a valid Kubernetes secret name.
func parseSecretRef(ref string) (string, error) {
	// Strip known scheme prefixes (e.g. "secret:", "k8s:", "eso:", "vault:")
	clean := ref
	for _, prefix := range []string{"secret:", "k8s:", "eso:", "vault:", "token:"} {
		if strings.HasPrefix(strings.ToLower(clean), prefix) {
			clean = clean[len(prefix):]
			break
		}
	}
	clean = strings.TrimSpace(clean)

	// If the ref includes path segments (e.g. "summit-builds/git-token" or "app/token"), take the basename
	parts := strings.Split(clean, "/")
	clean = parts[len(parts)-1]

	// Normalize to lowercase DNS-1123 compliant format
	clean = strings.ToLower(clean)
	// Replace invalid characters with hyphens
	clean = invalidChars.ReplaceAllString(clean, "-")
	// Collapse consecutive hyphens
	clean = multiHyphens.ReplaceAllString(clean, "-")
	clean = strings.Trim(clean, "-.")

	if clean == "" {
		return "", fmt.Errorf("%w: reference %q cannot be resolved to a valid resource name", ErrInvalidSecretRef, ref)
	}

	if len(clean) > 253 {
		clean = clean[:253]
		clean = strings.Trim(clean, "-.")
	}

	if !k8sNamePattern.MatchString(clean) {
		return "", fmt.Errorf("%w: resolved secret name %q is not a valid DNS-1123 subdomain", ErrInvalidSecretRef, clean)
	}

	return clean, nil
}

// FuncSecretResolver allows custom or mock resolution logic via a function.
type FuncSecretResolver func(ctx context.Context, namespace string, creds CredentialsSpec, reporting ReportingSpec) ([]SecretMount, error)

// ResolveSecretMounts delegates to the wrapped function.
func (f FuncSecretResolver) ResolveSecretMounts(ctx context.Context, namespace string, creds CredentialsSpec, reporting ReportingSpec) ([]SecretMount, error) {
	return f(ctx, namespace, creds, reporting)
}
