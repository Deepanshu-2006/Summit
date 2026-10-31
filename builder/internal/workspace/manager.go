package workspace

import (
	"fmt"
	"os"
)

// Manager manages attempt-specific workspace creation and permissions.
type Manager struct {
	baseDir string
}

// NewManager constructs a new workspace Manager.
func NewManager(baseDir string) *Manager {
	if baseDir == "" {
		baseDir = "/workspace"
	}
	return &Manager{baseDir: baseDir}
}

// Initialize creates the attempt-specific directories.
func (m *Manager) Initialize(buildID, attemptID string) (*Paths, error) {
	paths, err := NewPaths(m.baseDir, buildID, attemptID)
	if err != nil {
		return nil, fmt.Errorf("resolving workspace paths: %w", err)
	}

	dirs := []string{
		paths.BaseDir,
		paths.SourceDir,
		paths.MetadataDir,
		paths.RailpackDir,
		paths.TemporaryDir,
		paths.LogsDir,
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0700); err != nil {
			return nil, fmt.Errorf("creating workspace directory %s: %w", dir, err)
		}
	}

	return paths, nil
}
