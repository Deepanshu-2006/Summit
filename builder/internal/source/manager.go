package source

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/summit/builder/internal/protocol"
	"github.com/summit/builder/internal/workspace"
)

// CheckoutResult contains metadata from a completed source checkout.
type CheckoutResult struct {
	SourceDir string
	AppDir    string
	CommitSHA string
}

// Manager coordinates source credential resolution, repository clone, checkout, and verification.
type Manager struct {
	resolver CredentialResolver
	git      *GitClient
}

// NewManager constructs a new Source Manager.
func NewManager(resolver CredentialResolver, git *GitClient) *Manager {
	return &Manager{
		resolver: resolver,
		git:      git,
	}
}

// scrubToken removes any occurrence of token from err's message (defence in depth; git
// output is already sanitised).
func scrubToken(err error, token string) error {
	if err == nil || token == "" {
		return err
	}
	msg := err.Error()
	if !strings.Contains(msg, token) {
		return err
	}
	return errors.New(strings.ReplaceAll(msg, token, "[REDACTED]"))
}

// PrepareSource executes the complete source acquisition workflow.
func (m *Manager) PrepareSource(ctx context.Context, spec *protocol.BuildExecutionSpec, paths *workspace.Paths) (*CheckoutResult, error) {
	if spec == nil {
		return nil, fmt.Errorf("spec cannot be nil")
	}
	if paths == nil {
		return nil, fmt.Errorf("workspace paths cannot be nil")
	}

	// 1. Resolve source credentials
	token := ""
	if m.resolver != nil && spec.Credentials.SourceCredentialRef != "" {
		resolved, err := m.resolver.ResolveSourceToken(ctx, SourceTokenRequest{
			CredentialRef: spec.Credentials.SourceCredentialRef,
			BuildID:       spec.Build.ID,
			CloneURL:      spec.Source.CloneURL,
			CommitSHA:     spec.Source.CommitSHA,
		})
		if err != nil {
			return nil, fmt.Errorf("resolving source token (%s): %w", spec.Credentials.SourceCredentialRef, err)
		}
		token = resolved
	}

	// 2. The token is passed to git per-process as an HTTP header (see GitAuthEnv); it is
	// never embedded in the clone URL, so it cannot end up in .git/config.
	cloneURL := spec.Source.CloneURL

	// 3. Ensure target source directory exists
	if err := os.MkdirAll(paths.SourceDir, 0700); err != nil {
		return nil, fmt.Errorf("creating source directory %s: %w", paths.SourceDir, err)
	}

	// 4. Git clone without checkout
	if err := m.git.Clone(ctx, cloneURL, paths.SourceDir, token); err != nil {
		return nil, scrubToken(fmt.Errorf("cloning repository: %w", err), token)
	}

	// 5. Fetch pinned commit SHA explicitly
	if err := m.git.FetchCommit(ctx, cloneURL, paths.SourceDir, spec.Source.CommitSHA, token); err != nil {
		return nil, scrubToken(fmt.Errorf("fetching pinned commit: %w", err), token)
	}

	// 6. Checkout detached HEAD
	if err := m.git.CheckoutDetached(ctx, paths.SourceDir, spec.Source.CommitSHA); err != nil {
		return nil, fmt.Errorf("checking out detached commit: %w", err)
	}

	// 7. Verify commit SHA
	actualSHA, err := m.git.RevParseHEAD(ctx, paths.SourceDir)
	if err != nil {
		return nil, fmt.Errorf("querying checked out HEAD: %w", err)
	}

	if err := VerifyCommitSHA(actualSHA, spec.Source.CommitSHA); err != nil {
		return nil, fmt.Errorf("verifying commit SHA: %w", err)
	}

	// 8. Resolve application directory
	appDir, err := paths.ResolveAppSourceDir(spec.Source.RootDirectory)
	if err != nil {
		return nil, fmt.Errorf("resolving application root directory: %w", err)
	}

	return &CheckoutResult{
		SourceDir: paths.SourceDir,
		AppDir:    appDir,
		CommitSHA: actualSHA,
	}, nil
}
