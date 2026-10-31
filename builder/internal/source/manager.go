package source

import (
	"context"
	"fmt"
	"os"

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
		resolved, err := m.resolver.ResolveSourceToken(ctx, spec.Credentials.SourceCredentialRef)
		if err != nil {
			return nil, fmt.Errorf("resolving source token (%s): %w", spec.Credentials.SourceCredentialRef, err)
		}
		token = resolved
	}

	// 2. Inject credentials into clone URL
	cloneURL, err := InjectGitCredentials(spec.Source.CloneURL, token)
	if err != nil {
		return nil, fmt.Errorf("injecting git credentials: %w", err)
	}

	// 3. Ensure target source directory exists
	if err := os.MkdirAll(paths.SourceDir, 0700); err != nil {
		return nil, fmt.Errorf("creating source directory %s: %w", paths.SourceDir, err)
	}

	// 4. Git clone without checkout
	if err := m.git.Clone(ctx, cloneURL, paths.SourceDir); err != nil {
		return nil, fmt.Errorf("cloning repository: %w", err)
	}

	// 5. Fetch pinned commit SHA explicitly
	if err := m.git.FetchCommit(ctx, paths.SourceDir, spec.Source.CommitSHA); err != nil {
		return nil, fmt.Errorf("fetching pinned commit: %w", err)
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
