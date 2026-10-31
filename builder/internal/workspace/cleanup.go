package workspace

import (
	"fmt"
	"os"
)

// Cleanup removes an entire attempt-specific workspace.
func Cleanup(paths *Paths) error {
	if paths == nil || paths.BaseDir == "" {
		return nil
	}
	// Safety check: Never delete root or standard directories directly
	if paths.BaseDir == "/" || paths.BaseDir == "/workspace" || paths.BaseDir == "/home" || paths.BaseDir == "/tmp" {
		return fmt.Errorf("refusing to delete dangerous base directory: %s", paths.BaseDir)
	}

	if err := os.RemoveAll(paths.BaseDir); err != nil {
		return fmt.Errorf("cleaning up workspace %s: %w", paths.BaseDir, err)
	}
	return nil
}

// CleanupAttempt cleans up source, temporary, and railpack directories, preserving metadata for inspection.
func CleanupAttempt(paths *Paths) error {
	if paths == nil || paths.BaseDir == "" {
		return nil
	}
	_ = os.RemoveAll(paths.SourceDir)
	_ = os.RemoveAll(paths.TemporaryDir)
	_ = os.RemoveAll(paths.RailpackDir)
	return nil
}
