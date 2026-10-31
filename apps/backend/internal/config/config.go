package config

import (
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds runtime configuration for the backend service.
type Config struct {
	// Core service settings (existing)
	Host           string
	Port           string
	ServiceName    string
	ServiceVersion string
	Region         string
	EdgeRouting    string
	Environment    string

	// Database
	DatabaseURL string

	// Supabase Auth
	SupabaseURL         string
	SupabaseJWKSURL     string
	SupabaseJWTIssuer   string
	SupabaseJWTAudience string
	SupabaseJWTSecret   string // Local HS256 testing only

	// GitHub App
	GitHubAppID                    int64
	GitHubAppSlug                  string
	GitHubAppPrivateKeyOpenBaoPath string
	GitHubWebhookSecretOpenBaoPath string
	GitHubInstallationCallbackURL  string
	GitHubWebhookURL               string
	GitHubAPIBaseURL               string
	GitHubAPIVersion               string
	GitHubWebhookMaxBodyBytes      int64
	GitHubFrontendReturnPath       string
	GitHubAppPrivateKey            string // Local-dev fallback only; OpenBao path takes precedence
	GitHubWebhookSecret            string // Local-dev fallback only; OpenBao path takes precedence
	GitHubSyncInterval             time.Duration
	GitHubStateTTL                 time.Duration

	// Platform URLs
	PlatformFrontendBaseURL  string
	PlatformPublicAPIBaseURL string

	// OpenBao / Vault
	OpenBaoAddr                    string
	OpenBaoAuthRole                string
	OpenBaoToken                   string // Local dev only
	OpenBaoGitHubPrivateKeyPath    string
	OpenBaoGitHubWebhookSecretPath string

	// Worker JWT (machine-to-machine)
	WorkerJWTIssuer            string
	WorkerJWTAudience          string
	WorkerJWTSecret            string
	WorkerJWTSecretOpenBaoPath string
}

// Load loads configuration from environment variables with safe defaults.
func Load() *Config {
	env := getEnv("ENVIRONMENT", "")
	if env == "" {
		env = getEnv("ENV", "development")
	}

	ghAppID, _ := strconv.ParseInt(getEnv("GITHUB_APP_ID", "0"), 10, 64)
	whMaxBody, _ := strconv.ParseInt(getEnv("GITHUB_WEBHOOK_MAX_BODY_BYTES", "5242880"), 10, 64)
	if whMaxBody <= 0 {
		whMaxBody = 5242880
	}

	syncInterval := parseDuration(getEnv("GITHUB_SYNC_INTERVAL", "15m"), 15*time.Minute)
	stateTTL := parseDuration(getEnv("GITHUB_STATE_TTL", "10m"), 10*time.Minute)

	ghPrivKeyPath := getEnv("GITHUB_APP_PRIVATE_KEY_OPENBAO_PATH", "")
	if ghPrivKeyPath == "" {
		ghPrivKeyPath = getEnv("OPENBAO_GITHUB_PRIVATE_KEY_PATH", "")
	}
	ghWebhookSecretPath := getEnv("GITHUB_WEBHOOK_SECRET_OPENBAO_PATH", "")
	if ghWebhookSecretPath == "" {
		ghWebhookSecretPath = getEnv("OPENBAO_GITHUB_WEBHOOK_SECRET_PATH", "")
	}

	return &Config{
		// Core (preserved from original)
		Host:           getEnv("HOST", ""),
		Port:           getEnv("PORT", "4000"),
		ServiceName:    getEnv("SERVICE_NAME", "meridian-api"),
		ServiceVersion: getEnv("SERVICE_VERSION", "1.0.0"),
		Region:         getEnv("REGION", "cdg-1 (Paris)"),
		EdgeRouting:    getEnv("EDGE_ROUTING", "anycast"),
		Environment:    env,

		// Database
		DatabaseURL: getEnv("DATABASE_URL", ""),

		// Supabase Auth
		SupabaseURL:         getEnv("SUPABASE_URL", ""),
		SupabaseJWKSURL:     getEnv("SUPABASE_JWKS_URL", ""),
		SupabaseJWTIssuer:   getEnv("SUPABASE_JWT_ISSUER", ""),
		SupabaseJWTAudience: getEnv("SUPABASE_JWT_AUDIENCE", ""),
		SupabaseJWTSecret:   getEnv("SUPABASE_JWT_SECRET", ""),

		// GitHub App
		GitHubAppID:                    ghAppID,
		GitHubAppSlug:                  getEnv("GITHUB_APP_SLUG", ""),
		GitHubAppPrivateKeyOpenBaoPath: ghPrivKeyPath,
		GitHubWebhookSecretOpenBaoPath: ghWebhookSecretPath,
		GitHubInstallationCallbackURL:  getEnv("GITHUB_INSTALLATION_CALLBACK_URL", ""),
		GitHubWebhookURL:               getEnv("GITHUB_WEBHOOK_URL", ""),
		GitHubAPIBaseURL:               getEnv("GITHUB_API_BASE_URL", "https://api.github.com"),
		GitHubAPIVersion:               getEnv("GITHUB_API_VERSION", "2022-11-28"),
		GitHubWebhookMaxBodyBytes:      whMaxBody,
		GitHubFrontendReturnPath:       getEnv("GITHUB_FRONTEND_RETURN_PATH", "/settings/integrations/github"),
		GitHubAppPrivateKey:            getEnv("GITHUB_APP_PRIVATE_KEY", ""),
		GitHubWebhookSecret:            getEnv("GITHUB_WEBHOOK_SECRET", ""),
		GitHubSyncInterval:             syncInterval,
		GitHubStateTTL:                 stateTTL,

		// Platform URLs
		PlatformFrontendBaseURL:  getEnv("PLATFORM_FRONTEND_BASE_URL", ""),
		PlatformPublicAPIBaseURL: getEnv("PLATFORM_PUBLIC_API_BASE_URL", ""),

		// OpenBao / Vault
		OpenBaoAddr:                    getEnv("OPENBAO_ADDR", ""),
		OpenBaoAuthRole:                getEnv("OPENBAO_AUTH_ROLE", ""),
		OpenBaoToken:                   getEnv("OPENBAO_TOKEN", ""),
		OpenBaoGitHubPrivateKeyPath:    ghPrivKeyPath,
		OpenBaoGitHubWebhookSecretPath: ghWebhookSecretPath,

		// Worker JWT
		WorkerJWTIssuer:            getEnv("WORKER_JWT_ISSUER", ""),
		WorkerJWTAudience:          getEnv("WORKER_JWT_AUDIENCE", ""),
		WorkerJWTSecret:            getEnv("WORKER_JWT_SECRET", ""),
		WorkerJWTSecretOpenBaoPath: getEnv("WORKER_JWT_SECRET_OPENBAO_PATH", ""),
	}
}

// Validate checks required production configuration values.
// In development/test environments, validation is relaxed.
func (c *Config) Validate() error {
	var errs []string

	if c.Environment == "production" || c.Environment == "staging" {
		if c.DatabaseURL == "" {
			errs = append(errs, "DATABASE_URL is required in production/staging")
		}
		if c.SupabaseJWKSURL == "" {
			errs = append(errs, "SUPABASE_JWKS_URL is required in production/staging")
		}
		if c.SupabaseJWTIssuer == "" {
			errs = append(errs, "SUPABASE_JWT_ISSUER is required in production/staging")
		}
		if c.GitHubAppID == 0 {
			errs = append(errs, "GITHUB_APP_ID is required in production/staging")
		}
		if c.GitHubAppSlug == "" {
			errs = append(errs, "GITHUB_APP_SLUG is required in production/staging")
		}
		if c.GitHubAppPrivateKeyOpenBaoPath == "" && c.OpenBaoGitHubPrivateKeyPath == "" {
			errs = append(errs, "GITHUB_APP_PRIVATE_KEY_OPENBAO_PATH is required in production/staging")
		}
		if c.GitHubWebhookSecretOpenBaoPath == "" && c.OpenBaoGitHubWebhookSecretPath == "" {
			errs = append(errs, "GITHUB_WEBHOOK_SECRET_OPENBAO_PATH is required in production/staging")
		}
		if c.PlatformFrontendBaseURL == "" {
			errs = append(errs, "PLATFORM_FRONTEND_BASE_URL is required in production/staging")
		}
		if c.OpenBaoAddr == "" {
			errs = append(errs, "OPENBAO_ADDR is required in production/staging")
		}
	}

	if c.Port != "" {
		if _, err := strconv.Atoi(c.Port); err != nil {
			errs = append(errs, fmt.Sprintf("PORT must be a valid integer: %s", c.Port))
		}
	}

	if c.GitHubWebhookMaxBodyBytes <= 0 {
		errs = append(errs, "GITHUB_WEBHOOK_MAX_BODY_BYTES must be positive")
	}

	if len(errs) > 0 {
		return fmt.Errorf("configuration validation failed:\n  - %s", strings.Join(errs, "\n  - "))
	}
	return nil
}

// Address returns the listen address for the HTTP server.
func (c *Config) Address() string {
	if c.Host != "" {
		return net.JoinHostPort(c.Host, c.Port)
	}
	return ":" + c.Port
}

// IsDevelopment returns true if the environment is development or test.
func (c *Config) IsDevelopment() bool {
	return c.Environment == "development" || c.Environment == "test" || c.Environment == ""
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}

func parseDuration(s string, fallback time.Duration) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		return fallback
	}
	return d
}
