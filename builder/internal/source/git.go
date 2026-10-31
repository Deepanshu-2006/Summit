package source

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/summit/builder/internal/process"
)

// GitClient executes git commands using the shared process supervisor.
type GitClient struct {
	supervisor *process.Supervisor
}

// NewGitClient constructs a new GitClient.
func NewGitClient(supervisor *process.Supervisor) *GitClient {
	if supervisor == nil {
		supervisor = process.NewSupervisor(0, 0)
	}
	return &GitClient{supervisor: supervisor}
}

func gitEnv() []string {
	return append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
}

// Clone initializes and clones a git repository into targetDir.
// It uses shallow depth 1 if full history is not required, but fetches the exact commit.
func (g *GitClient) Clone(ctx context.Context, cloneURL, targetDir string) error {
	spec := process.CommandSpec{
		Command: "git",
		Args:    []string{"clone", "--no-checkout", cloneURL, targetDir},
		Env:     gitEnv(),
	}

	res, err := g.supervisor.Execute(ctx, spec, nil)
	if err != nil {
		stderr := ""
		if res != nil {
			stderr = strings.TrimSpace(res.Stderr)
		}
		return fmt.Errorf("git clone failed (%s): %w: %s", RedactGitURL(cloneURL), err, stderr)
	}
	return nil
}

// FetchCommit fetches a specific commit SHA into targetDir.
func (g *GitClient) FetchCommit(ctx context.Context, targetDir, commitSHA string) error {
	spec := process.CommandSpec{
		Command: "git",
		Args:    []string{"fetch", "--depth=1", "origin", commitSHA},
		Cwd:     targetDir,
		Env:     gitEnv(),
	}

	res, err := g.supervisor.Execute(ctx, spec, nil)
	if err != nil {
		stderr := ""
		if res != nil {
			stderr = strings.TrimSpace(res.Stderr)
		}
		return fmt.Errorf("git fetch commit %s failed: %w: %s", commitSHA, err, stderr)
	}
	return nil
}

// CheckoutDetached checks out a specific commit as a detached HEAD.
func (g *GitClient) CheckoutDetached(ctx context.Context, targetDir, commitSHA string) error {
	spec := process.CommandSpec{
		Command: "git",
		Args:    []string{"checkout", "--detach", commitSHA},
		Cwd:     targetDir,
		Env:     gitEnv(),
	}

	res, err := g.supervisor.Execute(ctx, spec, nil)
	if err != nil {
		stderr := ""
		if res != nil {
			stderr = strings.TrimSpace(res.Stderr)
		}
		return fmt.Errorf("git checkout detached HEAD %s failed: %w: %s", commitSHA, err, stderr)
	}
	return nil
}

// RevParseHEAD queries the commit hash of the current checked-out HEAD.
func (g *GitClient) RevParseHEAD(ctx context.Context, targetDir string) (string, error) {
	spec := process.CommandSpec{
		Command: "git",
		Args:    []string{"rev-parse", "HEAD"},
		Cwd:     targetDir,
		Env:     gitEnv(),
	}

	res, err := g.supervisor.Execute(ctx, spec, nil)
	if err != nil {
		stderr := ""
		if res != nil {
			stderr = strings.TrimSpace(res.Stderr)
		}
		return "", fmt.Errorf("git rev-parse HEAD failed: %w: %s", err, stderr)
	}
	return strings.TrimSpace(res.Stdout), nil
}
