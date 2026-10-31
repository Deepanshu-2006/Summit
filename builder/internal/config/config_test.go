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
