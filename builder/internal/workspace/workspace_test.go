package workspace

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWorkspace_InitializeAndCleanup(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "summit-workspace-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	mgr := NewManager(tempDir)
	buildID := "11111111-1111-1111-1111-111111111111"
	attemptID := "22222222-2222-2222-2222-222222222222"

	paths, err := mgr.Initialize(buildID, attemptID)
	if err != nil {
		t.Fatalf("unexpected initialization error: %v", err)
	}

	// Verify all subdirectories were created
	subdirs := []string{
		paths.SourceDir,
		paths.MetadataDir,
		paths.RailpackDir,
		paths.TemporaryDir,
		paths.LogsDir,
	}
	for _, d := range subdirs {
		info, err := os.Stat(d)
		if err != nil || !info.IsDir() {
			t.Errorf("expected directory %s to exist", d)
		}
	}

	// Test ResolveAppSourceDir
	appDir, err := paths.ResolveAppSourceDir("/frontend")
	if err != nil {
		t.Fatalf("unexpected error resolving app dir: %v", err)
	}
	expectedAppDir := filepath.Join(paths.SourceDir, "frontend")
	if appDir != expectedAppDir {
		t.Errorf("expected %s, got %s", expectedAppDir, appDir)
	}

	// Test ResolveAppSourceDir traversal rejection
	_, err = paths.ResolveAppSourceDir("../../etc")
	if err == nil {
		t.Fatal("expected traversal error, got nil")
	}

	// Test Cleanup
	if err := Cleanup(paths); err != nil {
		t.Fatalf("unexpected error during cleanup: %v", err)
	}
	if _, err := os.Stat(paths.BaseDir); !os.IsNotExist(err) {
		t.Errorf("expected base directory %s to be deleted", paths.BaseDir)
	}
}

func TestWorkspace_RefusesDangerousDelete(t *testing.T) {
	paths := &Paths{BaseDir: "/tmp"}
	if err := Cleanup(paths); err == nil {
		t.Fatal("expected error when attempting to clean /tmp, got nil")
	}
}
