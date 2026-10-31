package orchestrator

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/summit/backend/internal/cluster"
)

// Config holds runtime configuration for the Summit orchestrator service.
// In Phase 0, it is scoped strictly to parameters consumed by the application skeleton
// and the read-only cluster API reachability probe.
type Config struct {
	// Environment indicates deployment environment (development, staging, production).
	Environment string

	// Cluster holds the Kubernetes cluster target configuration for the read-only probe.
	Cluster cluster.Config

	// LogLevel configures the logger verbosity (debug, info, warn, error).
	LogLevel string
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

	return Config{
		Environment: env,
		Cluster: cluster.Config{
			Target:         target,
			KubeconfigPath: kubeconfigPath,
			ContextName:    contextName,
			ProbeTimeout:   time.Duration(probeSeconds) * time.Second,
		},
		LogLevel: logLevel,
	}
}

// Validate checks configuration sanity for Phase 0.
func (c Config) Validate() error {
	if strings.TrimSpace(c.Environment) == "" {
		return fmt.Errorf("orchestrator: environment must not be empty")
	}

	if err := c.Cluster.Validate(); err != nil {
		return fmt.Errorf("orchestrator cluster config error: %w", err)
	}

	return nil
}

// IsDevelopment returns true if running in development mode.
func (c Config) IsDevelopment() bool {
	return strings.EqualFold(c.Environment, "development") || strings.EqualFold(c.Environment, "local")
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); strings.TrimSpace(val) != "" {
		return val
	}
	return defaultVal
}
