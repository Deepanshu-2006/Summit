package config

import (
	"os"
	"testing"
	"time"
)

func TestLoad_Defaults(t *testing.T) {
	// Clear any env vars that could interfere
	envVars := []string{"HOST", "PORT", "ENVIRONMENT", "ENV", "DATABASE_URL", "GITHUB_APP_ID"}
	saved := make(map[string]string)
	for _, k := range envVars {
		if v, ok := os.LookupEnv(k); ok {
			saved[k] = v
			os.Unsetenv(k)
		}
	}
	defer func() {
		for k, v := range saved {
			os.Setenv(k, v)
		}
	}()

	cfg := Load()

	if cfg.Port != "4000" {
		t.Errorf("expected default port 4000, got %s", cfg.Port)
	}
	if cfg.Environment != "development" {
		t.Errorf("expected default environment development, got %s", cfg.Environment)
	}
	if cfg.GitHubAPIBaseURL != "https://api.github.com" {
		t.Errorf("expected default GitHub API base URL, got %s", cfg.GitHubAPIBaseURL)
	}
	if cfg.GitHubAPIVersion != "2022-11-28" {
		t.Errorf("expected default GitHub API version, got %s", cfg.GitHubAPIVersion)
	}
	if cfg.GitHubWebhookMaxBodyBytes != 5242880 {
		t.Errorf("expected default max body bytes 5242880, got %d", cfg.GitHubWebhookMaxBodyBytes)
	}
	if cfg.GitHubSyncInterval != 15*time.Minute {
		t.Errorf("expected default sync interval 15m, got %v", cfg.GitHubSyncInterval)
	}
	if cfg.GitHubStateTTL != 10*time.Minute {
		t.Errorf("expected default state TTL 10m, got %v", cfg.GitHubStateTTL)
	}
	if cfg.GitHubFrontendReturnPath != "/settings/integrations/github" {
		t.Errorf("expected default frontend return path, got %s", cfg.GitHubFrontendReturnPath)
	}
}

func TestLoad_FromEnv(t *testing.T) {
	os.Setenv("ENVIRONMENT", "production")
	os.Setenv("GITHUB_APP_ID", "12345")
	os.Setenv("GITHUB_SYNC_INTERVAL", "30m")
	os.Setenv("DATABASE_URL", "postgres://localhost/test")
	defer func() {
		os.Unsetenv("ENVIRONMENT")
		os.Unsetenv("GITHUB_APP_ID")
		os.Unsetenv("GITHUB_SYNC_INTERVAL")
		os.Unsetenv("DATABASE_URL")
	}()

	cfg := Load()

	if cfg.Environment != "production" {
		t.Errorf("expected production, got %s", cfg.Environment)
	}
	if cfg.GitHubAppID != 12345 {
		t.Errorf("expected GitHub App ID 12345, got %d", cfg.GitHubAppID)
	}
	if cfg.GitHubSyncInterval != 30*time.Minute {
		t.Errorf("expected sync interval 30m, got %v", cfg.GitHubSyncInterval)
	}
	if cfg.DatabaseURL != "postgres://localhost/test" {
		t.Errorf("expected DATABASE_URL, got %s", cfg.DatabaseURL)
	}
}

func TestLoad_ENVFallback(t *testing.T) {
	os.Unsetenv("ENVIRONMENT")
	os.Setenv("ENV", "staging")
	defer os.Unsetenv("ENV")

	cfg := Load()
	if cfg.Environment != "staging" {
		t.Errorf("expected staging from ENV fallback, got %s", cfg.Environment)
	}
}

func TestValidate_Development(t *testing.T) {
	cfg := Load()
	cfg.Environment = "development"
	if err := cfg.Validate(); err != nil {
		t.Errorf("development config should validate without required fields: %v", err)
	}
}

func TestValidate_Production_Missing(t *testing.T) {
	cfg := &Config{
		Environment:               "production",
		Port:                      "4000",
		GitHubWebhookMaxBodyBytes: 5242880,
	}
	err := cfg.Validate()
	if err == nil {
		t.Error("expected validation error for production with missing fields")
	}
}

func TestValidate_InvalidPort(t *testing.T) {
	cfg := &Config{
		Environment:               "development",
		Port:                      "not-a-number",
		GitHubWebhookMaxBodyBytes: 5242880,
	}
	err := cfg.Validate()
	if err == nil {
		t.Error("expected validation error for invalid port")
	}
}

func TestAddress(t *testing.T) {
	cfg := &Config{Port: "4000"}
	if got := cfg.Address(); got != ":4000" {
		t.Errorf("expected :4000, got %s", got)
	}

	cfg.Host = "127.0.0.1"
	if got := cfg.Address(); got != "127.0.0.1:4000" {
		t.Errorf("expected 127.0.0.1:4000, got %s", got)
	}
}

func TestIsDevelopment(t *testing.T) {
	tests := []struct {
		env  string
		want bool
	}{
		{"development", true},
		{"test", true},
		{"", true},
		{"production", false},
		{"staging", false},
	}
	for _, tt := range tests {
		cfg := &Config{Environment: tt.env}
		if got := cfg.IsDevelopment(); got != tt.want {
			t.Errorf("IsDevelopment(%q) = %v, want %v", tt.env, got, tt.want)
		}
	}
}

func TestParseDuration(t *testing.T) {
	if d := parseDuration("5m", time.Minute); d != 5*time.Minute {
		t.Errorf("expected 5m, got %v", d)
	}
	if d := parseDuration("invalid", time.Hour); d != time.Hour {
		t.Errorf("expected fallback 1h, got %v", d)
	}
}

func TestLoad_OpenBaoAliases(t *testing.T) {
	os.Setenv("OPENBAO_GITHUB_PRIVATE_KEY_PATH", "secret/data/github-key")
	os.Setenv("OPENBAO_GITHUB_WEBHOOK_SECRET_PATH", "secret/data/webhook-sec")
	defer func() {
		os.Unsetenv("OPENBAO_GITHUB_PRIVATE_KEY_PATH")
		os.Unsetenv("OPENBAO_GITHUB_WEBHOOK_SECRET_PATH")
	}()

	cfg := Load()
	if cfg.GitHubAppPrivateKeyOpenBaoPath != "secret/data/github-key" {
		t.Errorf("expected alias fallback for GitHubAppPrivateKeyOpenBaoPath, got %s", cfg.GitHubAppPrivateKeyOpenBaoPath)
	}
	if cfg.GitHubWebhookSecretOpenBaoPath != "secret/data/webhook-sec" {
		t.Errorf("expected alias fallback for GitHubWebhookSecretOpenBaoPath, got %s", cfg.GitHubWebhookSecretOpenBaoPath)
	}
}
