package orchestrator

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/summit/backend/internal/cluster"
	"github.com/summit/backend/internal/cluster/addons"
	"github.com/summit/backend/internal/workertoken"
)

// Default fallback secret used exclusively in development mode when WORKER_JWT_SECRET is unset.
const DevDefaultWorkerJWTSecret = "development-worker-jwt-secret-at-least-32-bytes!"

// Config holds runtime configuration for the Summit orchestrator service.
type Config struct {
	// Environment indicates deployment environment (development, staging, production).
	Environment string

	// Cluster holds the Kubernetes cluster target configuration.
	Cluster cluster.Config

	// LogLevel configures the logger verbosity (debug, info, warn, error).
	LogLevel string

	// DatabaseURL holds the connection string for the platform database.
	DatabaseURL string

	// WorkerJWTSecret is the HMAC secret (>= 32 bytes) used to mint and verify worker JWTs.
	WorkerJWTSecret string

	// APIInternalURL is the cluster-internal HTTP endpoint for the API service (contract C4/C6).
	APIInternalURL string

	// BuildNamespace is the Kubernetes namespace where ephemeral builder pods run (default: summit-builds).
	BuildNamespace string

	// BuilderImage is the container image for rootless BuildKit + Railpack (default: summit-builder:dev).
	BuilderImage string

	// BuilderRuntimeClass is the Kubernetes RuntimeClass for gVisor (default: gvisor).
	BuilderRuntimeClass string

	// GHCRPushSecret is the name of the Docker config secret for pushing to GHCR (default: ghcr-push).
	GHCRPushSecret string

	// WorkloadPullSecret is the fallback secret name for tenant image pulling (default: ghcr-pull).
	WorkloadPullSecret string

	// AppsDomain is the base domain for tenant routes (e.g. localtest.me).
	AppsDomain string

	// WorkerConcurrency is the number of outbox worker goroutines (default: 4).
	WorkerConcurrency int

	// Loop intervals
	OutboxPollInterval  time.Duration
	MonitorPollInterval time.Duration
	ReconcilerInterval  time.Duration
	PrunerInterval      time.Duration

	// Optional add-on feature flags (contract C8)
	EnableTenantQuotas  bool
	EnableNetworkPolicy bool
	NetworkPolicyMode   addons.NetworkPolicyMode
	EnableIngress       bool
	EnableESO           bool
}

// LoadConfig creates a Config populated from environment variables with safe defaults.
func LoadConfig() Config {
	env := getEnv("ORCHESTRATOR_ENV", getEnv("ENVIRONMENT", "development"))

	target := cluster.TargetType(getEnv("ORCHESTRATOR_CLUSTER_TARGET", string(cluster.TargetKind)))
	kubeconfigPath := getEnv("KUBECONFIG", "")
	contextName := getEnv("ORCHESTRATOR_KUBE_CONTEXT", "")

	probeSeconds, _ := strconv.Atoi(getEnv("ORCHESTRATOR_PROBE_TIMEOUT_SECONDS", "5"))
	if probeSeconds <= 0 {
		probeSeconds = 5
	}

	logLevel := strings.ToLower(getEnv("ORCHESTRATOR_LOG_LEVEL", "info"))

	databaseURL := getEnv("DATABASE_URL", "")
	workerJWTSecret := getEnv("WORKER_JWT_SECRET", "")
	if workerJWTSecret == "" && (strings.EqualFold(env, "development") || strings.EqualFold(env, "local") || strings.EqualFold(env, "test")) {
		workerJWTSecret = DevDefaultWorkerJWTSecret
	}

	apiInternalURL := getEnv("ORCHESTRATOR_API_INTERNAL_URL", "http://summit-api.summit-system.svc.cluster.local:4000")
	buildNamespace := getEnv("SUMMIT_BUILD_NAMESPACE", "summit-builds")
	builderImage := getEnv("SUMMIT_BUILDER_IMAGE", "summit-builder:dev")
	builderRuntimeClass := getEnv("SUMMIT_BUILDER_RUNTIME_CLASS", "gvisor")
	ghcrPushSecret := getEnv("ORCHESTRATOR_GHCR_PUSH_SECRET", "ghcr-push")
	workloadPullSecret := getEnv("ORCHESTRATOR_WORKLOAD_PULL_SECRET", "ghcr-pull")
	appsDomain := getEnv("ORCHESTRATOR_APPS_DOMAIN", "localtest.me")

	workers, _ := strconv.Atoi(getEnv("ORCHESTRATOR_WORKERS", "4"))
	if workers <= 0 {
		workers = 4
	}

	enableQuotas := parseBool(getEnv("ORCHESTRATOR_ENABLE_TENANT_QUOTAS", "true"), true)
	enableNetPol := parseBool(getEnv("ORCHESTRATOR_ENABLE_NETWORK_POLICY", "false"), false)
	netPolMode := addons.NetworkPolicyMode(getEnv("ORCHESTRATOR_NETWORK_POLICY_MODE", string(addons.NetworkPolicyNative)))
	enableIngress := parseBool(getEnv("ORCHESTRATOR_ENABLE_INGRESS", "false"), false)
	enableESO := parseBool(getEnv("ORCHESTRATOR_ENABLE_ESO", "false"), false)

	return Config{
		Environment: env,
		Cluster: cluster.Config{
			Target:         target,
			KubeconfigPath: kubeconfigPath,
			ContextName:    contextName,
			ProbeTimeout:   time.Duration(probeSeconds) * time.Second,
		},
		LogLevel:            logLevel,
		DatabaseURL:         databaseURL,
		WorkerJWTSecret:     workerJWTSecret,
		APIInternalURL:      apiInternalURL,
		BuildNamespace:      buildNamespace,
		BuilderImage:        builderImage,
		BuilderRuntimeClass: builderRuntimeClass,
		GHCRPushSecret:      ghcrPushSecret,
		WorkloadPullSecret:  workloadPullSecret,
		AppsDomain:          appsDomain,
		WorkerConcurrency:   workers,
		OutboxPollInterval:  1 * time.Second,
		MonitorPollInterval: 3 * time.Second,
		ReconcilerInterval:  5 * time.Second,
		PrunerInterval:      10 * time.Minute,
		EnableTenantQuotas:  enableQuotas,
		EnableNetworkPolicy: enableNetPol,
		NetworkPolicyMode:   netPolMode,
		EnableIngress:       enableIngress,
		EnableESO:           enableESO,
	}
}

// Validate checks configuration sanity.
func (c Config) Validate() error {
	if strings.TrimSpace(c.Environment) == "" {
		return fmt.Errorf("orchestrator: environment must not be empty")
	}

	if err := c.Cluster.Validate(); err != nil {
		return fmt.Errorf("orchestrator cluster config error: %w", err)
	}

	if !c.IsDevelopment() {
		if c.WorkerJWTSecret != "" && len(c.WorkerJWTSecret) < workertoken.MinSecretLength {
			return fmt.Errorf("orchestrator: WORKER_JWT_SECRET must be at least %d bytes in non-development environment", workertoken.MinSecretLength)
		}
	}

	return nil
}

// IsDevelopment returns true if running in development mode.
func (c Config) IsDevelopment() bool {
	return strings.EqualFold(c.Environment, "development") || strings.EqualFold(c.Environment, "local") || strings.EqualFold(c.Environment, "test")
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); strings.TrimSpace(val) != "" {
		return val
	}
	return defaultVal
}

func parseBool(val string, defaultVal bool) bool {
	if strings.TrimSpace(val) == "" {
		return defaultVal
	}
	b, err := strconv.ParseBool(strings.TrimSpace(val))
	if err != nil {
		return defaultVal
	}
	return b
}
