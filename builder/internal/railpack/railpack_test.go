package railpack

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/summit/builder/internal/process"
	"github.com/summit/builder/internal/protocol"
)

func TestRailpack_ValidatePlan(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "summit-plan-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	validPlanPath := filepath.Join(tempDir, "plan.json")
	validJSON := `{
		"schema_version": 1,
		"provider": "node",
		"runtime": {
			"language": "nodejs",
			"version": "20.11.0",
			"package_manager": "pnpm"
		},
		"start_command": "pnpm start"
	}`
	if err := os.WriteFile(validPlanPath, []byte(validJSON), 0644); err != nil {
		t.Fatalf("writing plan: %v", err)
	}

	adapter := NewCLIAdapter(process.NewSupervisor(0, 0), "mock-railpack")
	if err := adapter.ValidatePlan(context.Background(), validPlanPath); err != nil {
		t.Errorf("expected plan to be valid, got: %v", err)
	}

	invalidPlanPath := filepath.Join(tempDir, "invalid.json")
	if err := os.WriteFile(invalidPlanPath, []byte("not valid json"), 0644); err != nil {
		t.Fatalf("writing invalid plan: %v", err)
	}
	if err := adapter.ValidatePlan(context.Background(), invalidPlanPath); err == nil {
		t.Fatal("expected error for invalid plan JSON, got nil")
	}
}

func TestRailpack_MockPrepare(t *testing.T) {
	// Create mock app directory and mock prepare script
	tempDir, err := os.MkdirTemp("", "summit-railpack-exec-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	appDir := filepath.Join(tempDir, "app")
	if err := os.MkdirAll(appDir, 0700); err != nil {
		t.Fatalf("failed to create app dir: %v", err)
	}

	mockScript := filepath.Join(tempDir, "mock-railpack.sh")
	scriptContent := `#!/bin/sh
if [ "$1" = "--version" ]; then
	echo "railpack 0.3.2"
	exit 0
fi
if [ "$1" = "prepare" ]; then
	# output path is passed via --output
	output_path="$4"
	echo '{"provider":"node","runtime":{"language":"nodejs","version":"20"},"start_command":"npm start"}' > "$output_path"
	exit 0
fi
exit 1
`
	if err := os.WriteFile(mockScript, []byte(scriptContent), 0755); err != nil {
		t.Fatalf("writing mock script: %v", err)
	}

	sup := process.NewSupervisor(0, 0)
	adapter := NewCLIAdapter(sup, mockScript)

	ver, err := adapter.Version(context.Background())
	if err != nil {
		t.Fatalf("checking version: %v", err)
	}
	if ver != "railpack 0.3.2" {
		t.Errorf("expected 'railpack 0.3.2', got '%s'", ver)
	}

	planPath := filepath.Join(tempDir, "railpack", "plan.json")
	res, err := adapter.Prepare(context.Background(), PrepareInput{
		AppDir:      appDir,
		PlanPath:    planPath,
		BuildConfig: protocol.BuildConfig{Builder: "railpack"},
	})
	if err != nil {
		t.Fatalf("unexpected prepare error: %v", err)
	}

	if res.DetectedRuntime != "nodejs" {
		t.Errorf("expected runtime nodejs, got %s", res.DetectedRuntime)
	}
	if res.StartCommand != "npm start" {
		t.Errorf("expected start command 'npm start', got '%s'", res.StartCommand)
	}
}
