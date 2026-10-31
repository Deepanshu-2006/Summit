package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

const (
	// EnvExecutionSpec specifies the path to the mounted JSON execution spec.
	EnvExecutionSpec = "SUMMIT_EXECUTION_SPEC"
	// EnvWorkerID specifies an optional identifier for the worker container.
	EnvWorkerID = "SUMMIT_WORKER_ID"
	// EnvLogLevel specifies the logging level (debug, info, warn, error).
	EnvLogLevel = "SUMMIT_LOG_LEVEL"
	// EnvDefaultTimeoutSeconds specifies the fallback execution timeout if unspecified.
	EnvDefaultTimeoutSeconds = "SUMMIT_DEFAULT_TIMEOUT_SECONDS"
	// EnvWorkspaceBaseDir specifies the root directory for attempt workspaces.
	EnvWorkspaceBaseDir = "SUMMIT_WORKSPACE_BASE_DIR"
)

// Config holds runtime configuration for the builder worker process.
type Config struct {
	ExecutionSpecPath     string
	WorkerID              string
	LogLevel              string
	DefaultTimeoutSeconds int
	WorkspaceBaseDir      string
}

// Load loads configuration from environment variables with safe defaults.
func Load() (*Config, error) {
	specPath := os.Getenv(EnvExecutionSpec)
	if specPath == "" {
		return nil, fmt.Errorf("missing required environment variable: %s", EnvExecutionSpec)
	}

	workerID := os.Getenv(EnvWorkerID)
	if workerID == "" {
		hostname, err := os.Hostname()
		if err != nil {
			workerID = "builder-worker-unknown"
		} else {
			workerID = hostname
		}
	}

	logLevel := os.Getenv(EnvLogLevel)
	if logLevel == "" {
		logLevel = "info"
	}

	timeoutSec := 1200
	if rawTimeout := os.Getenv(EnvDefaultTimeoutSeconds); rawTimeout != "" {
		parsed, err := strconv.Atoi(rawTimeout)
		if err != nil || parsed <= 0 {
			return nil, fmt.Errorf("invalid %s: %s (must be positive integer)", EnvDefaultTimeoutSeconds, rawTimeout)
		}
		timeoutSec = parsed
	}

	workspaceBase := os.Getenv(EnvWorkspaceBaseDir)
	if workspaceBase == "" {
		workspaceBase = "/workspace"
	}

	return &Config{
		ExecutionSpecPath:     specPath,
		WorkerID:              workerID,
		LogLevel:              logLevel,
		DefaultTimeoutSeconds: timeoutSec,
		WorkspaceBaseDir:      workspaceBase,
	}, nil
}

// TimeoutDuration returns the configured default timeout as a time.Duration.
func (c *Config) TimeoutDuration() time.Duration {
	return time.Duration(c.DefaultTimeoutSeconds) * time.Second
}
