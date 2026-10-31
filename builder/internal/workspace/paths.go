package workspace

import (
	"fmt"
	"path/filepath"
	"strings"
)

// Paths holds the directory layout for a single execution attempt workspace.
type Paths struct {
	BaseDir      string
	SourceDir    string
	MetadataDir  string
	RailpackDir  string
	TemporaryDir string
	LogsDir      string
}

// NewPaths constructs the workspace layout for a given attempt.
func NewPaths(baseDir, buildID, attemptID string) (*Paths, error) {
	if strings.Contains(buildID, "..") || strings.Contains(buildID, "/") || strings.Contains(buildID, "\\") {
		return nil, fmt.Errorf("invalid characters in buildID: %s", buildID)
	}
	if strings.Contains(attemptID, "..") || strings.Contains(attemptID, "/") || strings.Contains(attemptID, "\\") {
		return nil, fmt.Errorf("invalid characters in attemptID: %s", attemptID)
	}

	attemptBase := filepath.Join(baseDir, fmt.Sprintf("%s-%s", buildID, attemptID))

	return &Paths{
		BaseDir:      attemptBase,
		SourceDir:    filepath.Join(attemptBase, "source", "repository"),
		MetadataDir:  filepath.Join(attemptBase, "metadata"),
		RailpackDir:  filepath.Join(attemptBase, "railpack"),
		TemporaryDir: filepath.Join(attemptBase, "temporary"),
		LogsDir:      filepath.Join(attemptBase, "logs"),
	}, nil
}

// ResultFilePath returns the path to the terminal metadata result file.
func (p *Paths) ResultFilePath() string {
	return filepath.Join(p.MetadataDir, "execution-result.json")
}

// SpecFilePath returns the path where the input execution spec is stored.
func (p *Paths) SpecFilePath() string {
	return filepath.Join(p.MetadataDir, "execution-spec.json")
}

// RailpackPlanFilePath returns the path to the generated Railpack plan JSON file.
func (p *Paths) RailpackPlanFilePath() string {
	return filepath.Join(p.RailpackDir, "railpack-plan.json")
}

// ResolveAppSourceDir safely resolves the application source directory given a relative root directory.
func (p *Paths) ResolveAppSourceDir(rootDirectory string) (string, error) {
	cleanRel := filepath.Clean(strings.TrimPrefix(rootDirectory, "/"))
	if strings.HasPrefix(cleanRel, "..") {
		return "", fmt.Errorf("root directory escapes source tree: %s", rootDirectory)
	}
	appDir := filepath.Join(p.SourceDir, cleanRel)
	// Ensure appDir is strictly within or equal to SourceDir
	rel, err := filepath.Rel(p.SourceDir, appDir)
	if err != nil || strings.HasPrefix(rel, "..") {
		return "", fmt.Errorf("resolved app directory escapes repository boundary: %s", appDir)
	}
	return appDir, nil
}
