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

// gitEnv builds the environment for one git invocation. authEnv (see GitAuthEnv) is
// appended last so it overrides any inherited GIT_CONFIG_* settings; the token therefore
// lives only in the environment of that single git process.
func gitEnv(authEnv []string) []string {
	base := os.Environ()
	env := make([]string, 0, len(base)+len(authEnv)+1)
	for _, kv := range base {
		if strings.HasPrefix(kv, "GIT_CONFIG_COUNT=") ||
			strings.HasPrefix(kv, "GIT_CONFIG_KEY_") ||
			strings.HasPrefix(kv, "GIT_CONFIG_VALUE_") {
			continue
		}
		env = append(env, kv)
	}
	env = append(env, "GIT_TERMINAL_PROMPT=0")
	return append(env, authEnv...)
}

// Clone initializes and clones a git repository into targetDir.
// It uses shallow depth 1 if full history is not required, but fetches the exact commit.
//
// token (optional) is sent as an HTTP Authorization header for this process only; it is
// never embedded in the remote URL, so it is not persisted in targetDir/.git/config.
func (g *GitClient) Clone(ctx context.Context, cloneURL, targetDir, token string) error {
	spec := process.CommandSpec{
		Command: "git",
		Args:    []string{"clone", "--no-checkout", cloneURL, targetDir},
		Env:     gitEnv(GitAuthEnv(cloneURL, token)),
	}

	res, err := g.supervisor.Execute(ctx, spec, nil)
	if err != nil {
		stderr := ""
		if res != nil {
			stderr = SanitizeGitOutput(strings.TrimSpace(res.Stderr))
		}
		return fmt.Errorf("git clone failed (%s): %w: %s", RedactGitURL(cloneURL), err, stderr)
	}
	return nil
}

// FetchCommit fetches a specific commit SHA into targetDir.
// cloneURL and token are used only to scope the transient auth header (see Clone).
func (g *GitClient) FetchCommit(ctx context.Context, cloneURL, targetDir, commitSHA, token string) error {
	spec := process.CommandSpec{
		Command: "git",
		Args:    []string{"fetch", "--depth=1", "origin", commitSHA},
		Cwd:     targetDir,
		Env:     gitEnv(GitAuthEnv(cloneURL, token)),
	}

	res, err := g.supervisor.Execute(ctx, spec, nil)
	if err != nil {
		stderr := ""
		if res != nil {
			stderr = SanitizeGitOutput(strings.TrimSpace(res.Stderr))
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
		Env:     gitEnv(nil),
	}

	res, err := g.supervisor.Execute(ctx, spec, nil)
	if err != nil {
		stderr := ""
		if res != nil {
			stderr = SanitizeGitOutput(strings.TrimSpace(res.Stderr))
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
		Env:     gitEnv(nil),
	}

	res, err := g.supervisor.Execute(ctx, spec, nil)
	if err != nil {
		stderr := ""
		if res != nil {
			stderr = SanitizeGitOutput(strings.TrimSpace(res.Stderr))
		}
		return "", fmt.Errorf("git rev-parse HEAD failed: %w: %s", err, stderr)
	}
	return strings.TrimSpace(res.Stdout), nil
}
