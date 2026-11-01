package build

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/api/resource"
)

// Default runtime configuration values.
const (
	// Builder image is owned and published by Priyanshu; require deployment config to name it.
	DefaultBuilderImage       = ""
	DefaultRuntimeClassName   = "gvisor"
	DefaultNamespace          = "summit-builds"
	DefaultServiceAccountName = "summit-builder"
	DefaultTimeoutSeconds     = 1800 // 30 minutes
	DefaultCPURequest         = "500m"
	DefaultCPULimit           = "2000m"
	DefaultMemoryRequest      = "1Gi"
	DefaultMemoryLimit        = "4Gi"
	DefaultStorageRequest     = "2Gi"
	DefaultStorageLimit       = "10Gi"
)

var (
	// ErrInvalidConfig indicates invalid builder adapter configuration.
	ErrInvalidConfig = errors.New("invalid builder adapter configuration")
)

// Config holds runtime parameters for the builder pod scheduling adapter.
type Config struct {
	// BuilderImage is the configurable Priyanshu-owned container image.
	BuilderImage string

	// SourceBrokerURL is the API's internal endpoint used by the builder to obtain a
	// short-lived GitHub installation token for this build.
	SourceBrokerURL string

	// BuilderImagePullSecret is an optional imagePullSecret already present in the build namespace.
	BuilderImagePullSecret string

	// RuntimeClassName references the existing configured gVisor runtimeClass on the cluster.
	// NOTE: Must reference the existing configured gVisor runtimeClass only.
	RuntimeClassName string

	// Namespace is the dedicated builds namespace where ephemeral pods are scheduled.
	Namespace string

	// ServiceAccountName is the ServiceAccount assigned to ephemeral build pods.
	ServiceAccountName string

	// SpecMountPath is the container path where execution.json is mounted.
	SpecMountPath string

	// DefaultTimeoutSeconds defines the fallback deadline if not specified in BuildExecutionSpec.
	DefaultTimeoutSeconds int

	// Finite request and limit defaults for container isolation.
	DefaultCPURequest     string
	DefaultCPULimit       string
	DefaultMemoryRequest  string
	DefaultMemoryLimit    string
	DefaultStorageRequest string
	DefaultStorageLimit   string
}

// DefaultConfig returns safe, production-grade defaults for the build adapter.
func DefaultConfig() Config {
	return Config{
		BuilderImage:           DefaultBuilderImage,
		SourceBrokerURL:        "http://summit-api.summit-system.svc.cluster.local:4000/internal/v1/build-requests",
		BuilderImagePullSecret: "",
		RuntimeClassName:       DefaultRuntimeClassName,
		Namespace:              DefaultNamespace,
		ServiceAccountName:     DefaultServiceAccountName,
		SpecMountPath:          DefaultExecutionSpecMountPath,
		DefaultTimeoutSeconds:  DefaultTimeoutSeconds,
		DefaultCPURequest:      DefaultCPURequest,
		DefaultCPULimit:        DefaultCPULimit,
		DefaultMemoryRequest:   DefaultMemoryRequest,
		DefaultMemoryLimit:     DefaultMemoryLimit,
		DefaultStorageRequest:  DefaultStorageRequest,
		DefaultStorageLimit:    DefaultStorageLimit,
	}
}

// LoadConfigFromEnv populates Config from environment variables, falling back to safe defaults.
func LoadConfigFromEnv() Config {
	cfg := DefaultConfig()

	if val := os.Getenv("SUMMIT_BUILDER_IMAGE"); strings.TrimSpace(val) != "" {
		cfg.BuilderImage = strings.TrimSpace(val)
	}
	if val := os.Getenv("SUMMIT_SOURCE_BROKER_URL"); strings.TrimSpace(val) != "" {
		cfg.SourceBrokerURL = strings.TrimRight(strings.TrimSpace(val), "/")
	}
	if val := os.Getenv("SUMMIT_BUILDER_IMAGE_PULL_SECRET"); strings.TrimSpace(val) != "" {
		cfg.BuilderImagePullSecret = strings.TrimSpace(val)
	}
	if val := os.Getenv("SUMMIT_BUILDER_RUNTIME_CLASS"); strings.TrimSpace(val) != "" {
		cfg.RuntimeClassName = strings.TrimSpace(val)
	}
	if val := os.Getenv("SUMMIT_BUILD_NAMESPACE"); strings.TrimSpace(val) != "" {
		cfg.Namespace = strings.TrimSpace(val)
	}
	if val := os.Getenv("SUMMIT_BUILDER_SERVICE_ACCOUNT"); strings.TrimSpace(val) != "" {
		cfg.ServiceAccountName = strings.TrimSpace(val)
	}
	if val := os.Getenv("SUMMIT_BUILDER_SPEC_PATH"); strings.TrimSpace(val) != "" {
		cfg.SpecMountPath = strings.TrimSpace(val)
	}
	if val := os.Getenv("SUMMIT_BUILD_TIMEOUT_SECONDS"); strings.TrimSpace(val) != "" {
		if timeout, err := strconv.Atoi(val); err == nil && timeout > 0 {
			cfg.DefaultTimeoutSeconds = timeout
		}
	}
	if val := os.Getenv("SUMMIT_BUILD_DEFAULT_CPU_REQUEST"); strings.TrimSpace(val) != "" {
		cfg.DefaultCPURequest = strings.TrimSpace(val)
	}
	if val := os.Getenv("SUMMIT_BUILD_DEFAULT_CPU_LIMIT"); strings.TrimSpace(val) != "" {
		cfg.DefaultCPULimit = strings.TrimSpace(val)
	}
	if val := os.Getenv("SUMMIT_BUILD_DEFAULT_MEMORY_REQUEST"); strings.TrimSpace(val) != "" {
		cfg.DefaultMemoryRequest = strings.TrimSpace(val)
	}
	if val := os.Getenv("SUMMIT_BUILD_DEFAULT_MEMORY_LIMIT"); strings.TrimSpace(val) != "" {
		cfg.DefaultMemoryLimit = strings.TrimSpace(val)
	}
	if val := os.Getenv("SUMMIT_BUILD_DEFAULT_STORAGE_REQUEST"); strings.TrimSpace(val) != "" {
		cfg.DefaultStorageRequest = strings.TrimSpace(val)
	}
	if val := os.Getenv("SUMMIT_BUILD_DEFAULT_STORAGE_LIMIT"); strings.TrimSpace(val) != "" {
		cfg.DefaultStorageLimit = strings.TrimSpace(val)
	}

	return cfg
}

// Validate ensures all configuration parameters are non-empty and syntactically valid.
func (c Config) Validate() error {
	if strings.TrimSpace(c.BuilderImage) == "" {
		return fmt.Errorf("%w: builder_image must not be empty", ErrInvalidConfig)
	}
	if strings.TrimSpace(c.RuntimeClassName) == "" {
		return fmt.Errorf("%w: runtime_class_name must not be empty", ErrInvalidConfig)
	}
	if strings.TrimSpace(c.Namespace) == "" {
		return fmt.Errorf("%w: namespace must not be empty", ErrInvalidConfig)
	}
	if strings.TrimSpace(c.SpecMountPath) == "" || !strings.HasPrefix(c.SpecMountPath, "/") {
		return fmt.Errorf("%w: spec_mount_path must be an absolute path", ErrInvalidConfig)
	}
	if c.DefaultTimeoutSeconds < 10 {
		return fmt.Errorf("%w: default_timeout_seconds must be at least 10", ErrInvalidConfig)
	}

	// Validate resource quantities
	for name, val := range map[string]string{
		"default_cpu_request":     c.DefaultCPURequest,
		"default_cpu_limit":       c.DefaultCPULimit,
		"default_memory_request":  c.DefaultMemoryRequest,
		"default_memory_limit":    c.DefaultMemoryLimit,
		"default_storage_request": c.DefaultStorageRequest,
		"default_storage_limit":   c.DefaultStorageLimit,
	} {
		if _, err := resource.ParseQuantity(val); err != nil {
			return fmt.Errorf("%w: invalid %s quantity %q: %v", ErrInvalidConfig, name, val, err)
		}
	}

	return nil
}
