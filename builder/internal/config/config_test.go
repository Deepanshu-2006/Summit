package config

import (
	"os"
	"testing"
)

func TestLoad_Success(t *testing.T) {
	t.Setenv(EnvExecutionSpec, "/tmp/spec.json")
	t.Setenv(EnvWorkerID, "worker-42")
	t.Setenv(EnvLogLevel, "debug")
	t.Setenv(EnvDefaultTimeoutSeconds, "600")
	t.Setenv(EnvWorkspaceBaseDir, "/tmp/custom-workspace")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error loading config: %v", err)
	}

	if cfg.ExecutionSpecPath != "/tmp/spec.json" {
		t.Errorf("expected spec path /tmp/spec.json, got %s", cfg.ExecutionSpecPath)
	}
	if cfg.WorkerID != "worker-42" {
		t.Errorf("expected workerID worker-42, got %s", cfg.WorkerID)
	}
	if cfg.LogLevel != "debug" {
		t.Errorf("expected log level debug, got %s", cfg.LogLevel)
	}
	if cfg.DefaultTimeoutSeconds != 600 {
		t.Errorf("expected timeout 600, got %d", cfg.DefaultTimeoutSeconds)
	}
	if cfg.WorkspaceBaseDir != "/tmp/custom-workspace" {
		t.Errorf("expected workspace base /tmp/custom-workspace, got %s", cfg.WorkspaceBaseDir)
	}
}

func TestLoad_MissingSpecPath(t *testing.T) {
	os.Unsetenv(EnvExecutionSpec)
	_, err := Load()
	if err == nil {
		t.Fatal("expected error when SUMMIT_EXECUTION_SPEC is missing, got nil")
	}
}

func TestLoad_InvalidTimeout(t *testing.T) {
	t.Setenv(EnvExecutionSpec, "/tmp/spec.json")
	t.Setenv(EnvDefaultTimeoutSeconds, "not-a-number")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error for invalid timeout string, got nil")
	}
}

func TestLoad_CredentialSettingsDefaultToEmpty(t *testing.T) {
	t.Setenv(EnvExecutionSpec, "/tmp/spec.json")
	for _, k := range []string{EnvSourceCredentialFile, EnvRegistryCredentialFile, EnvReportingTokenFile, EnvSourceBrokerURL, EnvInsecureRegistries} {
		t.Setenv(k, "")
	}
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.SourceCredentialFile != "" || cfg.RegistryCredentialFile != "" || cfg.ReportingTokenFile != "" ||
		cfg.SourceBrokerURL != "" || len(cfg.InsecureRegistries) != 0 {
		t.Errorf("expected all optional settings empty, got %+v", cfg)
	}
	if cfg.RegistryDockerConfigDir() != "" {
		t.Error("RegistryDockerConfigDir must be empty without a registry credential file")
	}
}

func TestLoad_CredentialSettings(t *testing.T) {
	t.Setenv(EnvExecutionSpec, "/tmp/spec.json")
	t.Setenv(EnvSourceCredentialFile, "/var/run/secrets/summit/source/token")
	t.Setenv(EnvRegistryCredentialFile, "/var/run/secrets/summit/registry/config.json")
	t.Setenv(EnvReportingTokenFile, "/var/run/secrets/summit/reporting/token")
	t.Setenv(EnvSourceBrokerURL, "http://api.summit.svc:8080/internal/v1/build-requests/")
	t.Setenv(EnvInsecureRegistries, "Registry.Local:5000, , other:80")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.SourceCredentialFile != "/var/run/secrets/summit/source/token" ||
		cfg.RegistryCredentialFile != "/var/run/secrets/summit/registry/config.json" ||
		cfg.ReportingTokenFile != "/var/run/secrets/summit/reporting/token" {
		t.Errorf("unexpected file paths: %+v", cfg)
	}
	if cfg.SourceBrokerURL != "http://api.summit.svc:8080/internal/v1/build-requests" {
		t.Errorf("broker URL should be trimmed of trailing slash, got %q", cfg.SourceBrokerURL)
	}
	if cfg.RegistryDockerConfigDir() != "/var/run/secrets/summit/registry" {
		t.Errorf("docker config dir = %q", cfg.RegistryDockerConfigDir())
	}
	if len(cfg.InsecureRegistries) != 2 || cfg.InsecureRegistries[0] != "registry.local:5000" || cfg.InsecureRegistries[1] != "other:80" {
		t.Errorf("insecure registries = %v", cfg.InsecureRegistries)
	}
}

func TestLoad_InvalidCredentialSettings(t *testing.T) {
	cases := map[string]map[string]string{
		"relative source file":     {EnvSourceCredentialFile: "token"},
		"relative reporting file":  {EnvReportingTokenFile: "./token"},
		"registry file not named":  {EnvRegistryCredentialFile: "/var/run/secrets/registry/auth.json"},
		"broker not http":          {EnvSourceBrokerURL: "ftp://broker"},
		"broker with credentials":  {EnvSourceBrokerURL: "http://user:pw@broker"},
		"broker without host":      {EnvSourceBrokerURL: "http://"},
		"insecure registry w/ url": {EnvInsecureRegistries: "https://reg:5000"},
	}
	for name, env := range cases {
		t.Run(name, func(t *testing.T) {
			t.Setenv(EnvExecutionSpec, "/tmp/spec.json")
			for k, v := range env {
				t.Setenv(k, v)
			}
			if _, err := Load(); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}
