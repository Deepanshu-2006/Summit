package cluster

import (
	"errors"
	"fmt"
	"time"
)

// TargetType identifies the Kubernetes cluster environment type.
type TargetType string

const (
	// TargetKind targets a local Kind cluster (the immediate development & testing target).
	TargetKind TargetType = "kind"

	// TargetInCluster targets a pod running inside a Kubernetes cluster using service account credentials.
	TargetInCluster TargetType = "in-cluster"

	// TargetKubeconfig targets a remote or local cluster specified via a kubeconfig file.
	TargetKubeconfig TargetType = "kubeconfig"

	// TargetMock targets an in-memory mock cluster client for unit testing.
	TargetMock TargetType = "mock"
)

// DefaultProbeTimeout is the maximum duration to wait for the read-only cluster version/discovery check.
const DefaultProbeTimeout = 5 * time.Second

var (
	// ErrInvalidTarget indicates an unsupported cluster target type.
	ErrInvalidTarget = errors.New("cluster: invalid target type")

	// ErrInvalidProbeTimeout indicates a non-positive timeout duration.
	ErrInvalidProbeTimeout = errors.New("cluster: probe timeout must be greater than zero")
)

// Config defines connection and operational parameters for the target cluster.
// In Phase 0, it is scoped strictly to parameters consumed by the read-only API discovery probe.
type Config struct {
	// Target specifies how the cluster is reached (kind, in-cluster, kubeconfig, mock).
	Target TargetType

	// KubeconfigPath optionally points to a specific kubeconfig file.
	KubeconfigPath string

	// ContextName optionally selects a specific kubeconfig context.
	ContextName string

	// ProbeTimeout limits the duration of the initial reachability check.
	ProbeTimeout time.Duration
}

// NewDefaultConfig returns the standard configuration for local testing against Kind.
func NewDefaultConfig() Config {
	return Config{
		Target:       TargetKind,
		ProbeTimeout: DefaultProbeTimeout,
	}
}

// Validate checks whether the cluster configuration has valid attributes.
func (c Config) Validate() error {
	switch c.Target {
	case TargetKind, TargetInCluster, TargetKubeconfig, TargetMock:
	case "":
		return fmt.Errorf("%w: target type must be specified", ErrInvalidTarget)
	default:
		return fmt.Errorf("%w: unknown target %q", ErrInvalidTarget, c.Target)
	}

	if c.ProbeTimeout <= 0 {
		return ErrInvalidProbeTimeout
	}

	return nil
}
