package config

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
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
	// EnvSourceCredentialFile is the mounted file holding the worker JWT (or, for local
	// runs without a broker, a raw git token) used to obtain source credentials.
	EnvSourceCredentialFile = "SUMMIT_SOURCE_CREDENTIAL_FILE"
	// EnvRegistryCredentialFile is the mounted docker config.json used to push the image
	// and to authenticate the post-push digest lookup.
	EnvRegistryCredentialFile = "SUMMIT_REGISTRY_CREDENTIAL_FILE"
	// EnvReportingTokenFile is the mounted file holding the bearer token for build callbacks.
	EnvReportingTokenFile = "SUMMIT_REPORTING_TOKEN_FILE"
	// EnvSourceBrokerURL is the credential broker base URL; the builder POSTs to
	// {url}/{build_id}/source-token.
	EnvSourceBrokerURL = "SUMMIT_SOURCE_BROKER_URL"
	// EnvInsecureRegistries is a comma-separated list of registry hosts (host[:port]) that
	// may be reached over plain HTTP. Loopback registries are always treated as insecure.
	EnvInsecureRegistries = "SUMMIT_INSECURE_REGISTRIES"
)

// Config holds runtime configuration for the builder worker process.
type Config struct {
	ExecutionSpecPath     string
	WorkerID              string
	LogLevel              string
	DefaultTimeoutSeconds int
	WorkspaceBaseDir      string

	// SourceCredentialFile, RegistryCredentialFile, ReportingTokenFile and SourceBrokerURL
	// are all optional; empty means "not configured".
	SourceCredentialFile   string
	RegistryCredentialFile string
	ReportingTokenFile     string
	SourceBrokerURL        string
	// InsecureRegistries lists registry hosts explicitly allowed over plain HTTP.
	InsecureRegistries []string
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

	cfg := &Config{
		ExecutionSpecPath:      specPath,
		WorkerID:               workerID,
		LogLevel:               logLevel,
		DefaultTimeoutSeconds:  timeoutSec,
		WorkspaceBaseDir:       workspaceBase,
		SourceCredentialFile:   strings.TrimSpace(os.Getenv(EnvSourceCredentialFile)),
		RegistryCredentialFile: strings.TrimSpace(os.Getenv(EnvRegistryCredentialFile)),
		ReportingTokenFile:     strings.TrimSpace(os.Getenv(EnvReportingTokenFile)),
		SourceBrokerURL:        strings.TrimRight(strings.TrimSpace(os.Getenv(EnvSourceBrokerURL)), "/"),
	}

	for _, f := range []struct{ env, path string }{
		{EnvSourceCredentialFile, cfg.SourceCredentialFile},
		{EnvRegistryCredentialFile, cfg.RegistryCredentialFile},
		{EnvReportingTokenFile, cfg.ReportingTokenFile},
	} {
		if f.path != "" && !filepath.IsAbs(f.path) {
			return nil, fmt.Errorf("invalid %s: %q (must be an absolute path)", f.env, f.path)
		}
	}

	if cfg.RegistryCredentialFile != "" && filepath.Base(cfg.RegistryCredentialFile) != "config.json" {
		return nil, fmt.Errorf("invalid %s: file must be named config.json (buildctl reads $DOCKER_CONFIG/config.json)", EnvRegistryCredentialFile)
	}

	if cfg.SourceBrokerURL != "" {
		u, err := url.Parse(cfg.SourceBrokerURL)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			return nil, fmt.Errorf("invalid %s: must be an http(s) URL", EnvSourceBrokerURL)
		}
		if u.User != nil {
			return nil, fmt.Errorf("invalid %s: must not contain credentials", EnvSourceBrokerURL)
		}
	}

	for _, h := range strings.Split(os.Getenv(EnvInsecureRegistries), ",") {
		h = strings.TrimSpace(h)
		if h == "" {
			continue
		}
		if strings.ContainsAny(h, "/@ ") {
			return nil, fmt.Errorf("invalid %s entry %q: expected host[:port]", EnvInsecureRegistries, h)
		}
		cfg.InsecureRegistries = append(cfg.InsecureRegistries, strings.ToLower(h))
	}

	return cfg, nil
}

// RegistryDockerConfigDir returns the directory that must be exported as DOCKER_CONFIG
// for buildctl (the parent directory of the registry credential file), or "" if unset.
func (c *Config) RegistryDockerConfigDir() string {
	if c.RegistryCredentialFile == "" {
		return ""
	}
	return filepath.Dir(c.RegistryCredentialFile)
}

// TimeoutDuration returns the configured default timeout as a time.Duration.
func (c *Config) TimeoutDuration() time.Duration {
	return time.Duration(c.DefaultTimeoutSeconds) * time.Second
}
