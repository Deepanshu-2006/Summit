package cluster

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"k8s.io/client-go/discovery"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

var (
	// ErrKubeconfigNotFound indicates that no kubeconfig file could be found at the specified or default locations.
	ErrKubeconfigNotFound = errors.New("cluster: kubeconfig file not found")

	// ErrProbeFailed indicates that the API discovery/version reachability check failed.
	ErrProbeFailed = errors.New("cluster: server reachability probe failed")
)

// ServerVersionInfo captures the sanitized Kubernetes server version details
// obtained from the read-only discovery endpoint.
type ServerVersionInfo struct {
	Major      string `json:"major"`
	Minor      string `json:"minor"`
	GitVersion string `json:"git_version"`
	Platform   string `json:"platform"`
}

// Client defines the interface for read-only cluster inspection in Phase 0.
// It avoids any mutating methods or resource creations.
type Client interface {
	// ProbeReachability performs a read-only server version check against the Kubernetes API.
	ProbeReachability(ctx context.Context) (*ServerVersionInfo, error)

	// Target returns the target type of this cluster client.
	Target() TargetType
}

// realClient implements Client by querying the Kubernetes discovery API.
type realClient struct {
	target    TargetType
	discovery discovery.DiscoveryInterface
}

// Target returns the configured cluster target.
func (c *realClient) Target() TargetType {
	return c.target
}

// ProbeReachability executes a read-only ServerVersion call against the discovery endpoint.
// Request timeouts are strictly bounded at the transport layer via rest.Config.Timeout,
// and caller context cancellation is verified prior to execution.
func (c *realClient) ProbeReachability(ctx context.Context) (*ServerVersionInfo, error) {
	if c.discovery == nil {
		return nil, fmt.Errorf("%w: discovery interface is nil", ErrProbeFailed)
	}

	if err := ctx.Err(); err != nil {
		return nil, err
	}

	rawVersion, err := c.discovery.ServerVersion()
	if err != nil {
		// Sanitize error to avoid leaking any sensitive URL parameters or token info
		return nil, fmt.Errorf("%w: %s", ErrProbeFailed, sanitizeError(err))
	}

	if rawVersion == nil {
		return nil, fmt.Errorf("%w: received nil version info from API server", ErrProbeFailed)
	}

	return &ServerVersionInfo{
		Major:      rawVersion.Major,
		Minor:      rawVersion.Minor,
		GitVersion: rawVersion.GitVersion,
		Platform:   rawVersion.Platform,
	}, nil
}

// NewClient constructs a Client based on the provided cluster configuration.
// It supports local kubeconfig (Kind/kubeconfig) now and in-cluster credentials later.
func NewClient(cfg Config) (Client, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	if cfg.Target == TargetMock {
		return &MockClient{
			TargetType:  TargetMock,
			VersionInfo: &ServerVersionInfo{Major: "1", Minor: "37", GitVersion: "v1.37.0", Platform: "linux/amd64"},
		}, nil
	}

	restCfg, err := buildRESTConfig(cfg)
	if err != nil {
		return nil, err
	}

	discClient, err := discovery.NewDiscoveryClientForConfig(restCfg)
	if err != nil {
		return nil, fmt.Errorf("cluster: failed to create discovery client: %s", sanitizeError(err))
	}

	return &realClient{
		target:    cfg.Target,
		discovery: discClient,
	}, nil
}

// NewClientWithDiscovery creates a Client wrapping an explicit discovery.DiscoveryInterface.
// Primarily used for unit testing with fake or mock discovery implementations.
func NewClientWithDiscovery(disc discovery.DiscoveryInterface, target TargetType) Client {
	return &realClient{
		target:    target,
		discovery: disc,
	}
}

// buildRESTConfig constructs a Kubernetes *rest.Config from kubeconfig or in-cluster credentials.
// It enforces the configured ProbeTimeout directly on rest.Config.Timeout to guarantee bounded requests.
func buildRESTConfig(cfg Config) (*rest.Config, error) {
	var restCfg *rest.Config

	switch cfg.Target {
	case TargetInCluster:
		inClusterCfg, err := rest.InClusterConfig()
		if err != nil {
			return nil, fmt.Errorf("cluster: failed to load in-cluster configuration: %s", sanitizeError(err))
		}
		restCfg = inClusterCfg

	case TargetKind, TargetKubeconfig:
		kubeconfigPath := resolveKubeconfigPath(cfg.KubeconfigPath)
		if kubeconfigPath == "" {
			return nil, ErrKubeconfigNotFound
		}

		if _, err := os.Stat(kubeconfigPath); err != nil {
			return nil, fmt.Errorf("%w at path: %s", ErrKubeconfigNotFound, kubeconfigPath)
		}

		loadingRules := &clientcmd.ClientConfigLoadingRules{ExplicitPath: kubeconfigPath}
		configOverrides := &clientcmd.ConfigOverrides{}
		if cfg.ContextName != "" {
			configOverrides.CurrentContext = cfg.ContextName
		}

		clientConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, configOverrides)
		loadedCfg, err := clientConfig.ClientConfig()
		if err != nil {
			return nil, fmt.Errorf("cluster: failed to build REST config from kubeconfig: %s", sanitizeError(err))
		}
		restCfg = loadedCfg

	default:
		return nil, fmt.Errorf("%w: %s", ErrInvalidTarget, cfg.Target)
	}

	// Bound HTTP request durations via transport timeout
	if cfg.ProbeTimeout > 0 {
		restCfg.Timeout = cfg.ProbeTimeout
	}

	return restCfg, nil
}

// resolveKubeconfigPath determines the active kubeconfig path following standard precedence:
// 1. Explicitly configured path
// 2. KUBECONFIG environment variable
// 3. ~/.kube/config default location
func resolveKubeconfigPath(configuredPath string) string {
	if strings.TrimSpace(configuredPath) != "" {
		return strings.TrimSpace(configuredPath)
	}

	if envPath := strings.TrimSpace(os.Getenv("KUBECONFIG")); envPath != "" {
		paths := filepath.SplitList(envPath)
		if len(paths) > 0 && paths[0] != "" {
			return paths[0]
		}
	}

	home, err := os.UserHomeDir()
	if err == nil && home != "" {
		defaultPath := filepath.Join(home, ".kube", "config")
		return defaultPath
	}

	return ""
}

// sanitizeError strips potential sensitive token, key, or credential data from error strings.
func sanitizeError(err error) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	// Strip any Bearer token traces if present
	if idx := strings.Index(msg, "Bearer "); idx != -1 {
		msg = msg[:idx] + "Bearer [REDACTED]"
	}
	return msg
}

// MockClient is a mock implementation of Client for unit testing without a live cluster.
type MockClient struct {
	TargetType  TargetType
	VersionInfo *ServerVersionInfo
	ProbeErr    error
}

// Target returns the mock target type.
func (m *MockClient) Target() TargetType {
	if m.TargetType == "" {
		return TargetMock
	}
	return m.TargetType
}

// ProbeReachability returns the mocked version info or error.
func (m *MockClient) ProbeReachability(ctx context.Context) (*ServerVersionInfo, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if m.ProbeErr != nil {
		return nil, m.ProbeErr
	}
	return m.VersionInfo, nil
}
