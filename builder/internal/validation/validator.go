package validation

import (
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/summit/builder/internal/protocol"
)

var (
	uuidRegex   = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	commitRegex = regexp.MustCompile(`^([0-9a-fA-F]{40}|[0-9a-fA-F]{64})$`)
	repoRegex   = regexp.MustCompile(`^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$`)
	tagRegex    = regexp.MustCompile(`^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$`)
)

// ValidationError represents one or more schema or business rule contract violations.
type ValidationError struct {
	Issues []string
}

func (v *ValidationError) Error() string {
	return fmt.Sprintf("spec validation failed (%d issues): %s", len(v.Issues), strings.Join(v.Issues, "; "))
}

// Validator validates BuildExecutionSpec according to platform contracts.
type Validator struct{}

// NewValidator returns a new Validator instance.
func NewValidator() *Validator {
	return &Validator{}
}

// Validate performs strict validation on a BuildExecutionSpec.
func (v *Validator) Validate(spec *protocol.BuildExecutionSpec) error {
	if spec == nil {
		return errors.New("execution spec cannot be nil")
	}

	var issues []string

	// 1. Schema version
	if spec.SchemaVersion != protocol.CurrentSchemaVersion {
		issues = append(issues, fmt.Sprintf("unsupported schema_version: %d (expected %d)", spec.SchemaVersion, protocol.CurrentSchemaVersion))
	}

	// 2. Build metadata
	if !uuidRegex.MatchString(spec.Build.ID) {
		issues = append(issues, fmt.Sprintf("invalid build.id: '%s' must be valid UUID", spec.Build.ID))
	}
	if !uuidRegex.MatchString(spec.Build.AttemptID) {
		issues = append(issues, fmt.Sprintf("invalid build.attempt_id: '%s' must be valid UUID", spec.Build.AttemptID))
	}
	if spec.Build.AttemptNumber < 1 {
		issues = append(issues, fmt.Sprintf("invalid build.attempt_number: %d (must be >= 1)", spec.Build.AttemptNumber))
	}

	// 3. Source specification
	switch spec.Source.Provider {
	case "github", "gitlab", "bitbucket", "generic":
	default:
		issues = append(issues, fmt.Sprintf("invalid source.provider: '%s'", spec.Source.Provider))
	}

	if !repoRegex.MatchString(spec.Source.Repository) {
		issues = append(issues, fmt.Sprintf("invalid source.repository: '%s' must match 'org/repo'", spec.Source.Repository))
	}

	if parsedURL, err := url.ParseRequestURI(spec.Source.CloneURL); err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https" && parsedURL.Scheme != "ssh" && parsedURL.Scheme != "file" && !filepath.IsAbs(spec.Source.CloneURL)) {
		if !filepath.IsAbs(spec.Source.CloneURL) {
			issues = append(issues, fmt.Sprintf("invalid source.clone_url: '%s'", spec.Source.CloneURL))
		}
	}

	if !commitRegex.MatchString(spec.Source.CommitSHA) {
		issues = append(issues, fmt.Sprintf("invalid source.commit_sha: '%s' must be full 40-char (SHA-1) or 64-char (SHA-256) hex string", spec.Source.CommitSHA))
	}

	// Prevent path traversal in root directory
	cleanRoot := filepath.Clean(spec.Source.RootDirectory)
	if strings.HasPrefix(cleanRoot, "..") || strings.Contains(spec.Source.RootDirectory, "\x00") {
		issues = append(issues, fmt.Sprintf("path traversal detected in source.root_directory: '%s'", spec.Source.RootDirectory))
	}

	// 4. Build configuration
	switch spec.BuildConfig.Builder {
	case "railpack", "dockerfile", "auto":
	default:
		issues = append(issues, fmt.Sprintf("invalid build_config.builder: '%s'", spec.BuildConfig.Builder))
	}

	if spec.BuildConfig.DockerfilePath != nil {
		cleanDF := filepath.Clean(*spec.BuildConfig.DockerfilePath)
		if strings.HasPrefix(cleanDF, "..") || filepath.IsAbs(*spec.BuildConfig.DockerfilePath) {
			issues = append(issues, fmt.Sprintf("path traversal detected in build_config.dockerfile_path: '%s'", *spec.BuildConfig.DockerfilePath))
		}
	}

	// 5. Credentials specification
	if strings.TrimSpace(spec.Credentials.SourceCredentialRef) == "" {
		issues = append(issues, "credentials.source_credential_ref cannot be empty")
	}
	if strings.TrimSpace(spec.Credentials.RegistryCredentialRef) == "" {
		issues = append(issues, "credentials.registry_credential_ref cannot be empty")
	}

	// 6. Output specification
	if strings.TrimSpace(spec.Output.Registry) == "" {
		issues = append(issues, "output.registry cannot be empty")
	}
	if strings.TrimSpace(spec.Output.Repository) == "" {
		issues = append(issues, "output.repository cannot be empty")
	}
	if !tagRegex.MatchString(spec.Output.Tag) {
		issues = append(issues, fmt.Sprintf("invalid output.tag: '%s'", spec.Output.Tag))
	}
	if len(spec.Output.Platforms) == 0 {
		issues = append(issues, "output.platforms must contain at least one target platform")
	}

	// 7. Resource limits
	if spec.Resources.CPUMillicores < 100 {
		issues = append(issues, fmt.Sprintf("invalid resources.cpu_millicores: %d (must be >= 100)", spec.Resources.CPUMillicores))
	}
	if spec.Resources.MemoryMiB < 128 {
		issues = append(issues, fmt.Sprintf("invalid resources.memory_mib: %d (must be >= 128)", spec.Resources.MemoryMiB))
	}
	if spec.Resources.EphemeralStorageMiB < 512 {
		issues = append(issues, fmt.Sprintf("invalid resources.ephemeral_storage_mib: %d (must be >= 512)", spec.Resources.EphemeralStorageMiB))
	}

	// 8. Timeout
	if spec.TimeoutSeconds < 10 || spec.TimeoutSeconds > 86400 {
		issues = append(issues, fmt.Sprintf("invalid timeout_seconds: %d (must be between 10 and 86400)", spec.TimeoutSeconds))
	}

	// 9. Reporting
	if parsedEndpoint, err := url.ParseRequestURI(spec.Reporting.Endpoint); err != nil || (parsedEndpoint.Scheme != "http" && parsedEndpoint.Scheme != "https") {
		issues = append(issues, fmt.Sprintf("invalid reporting.endpoint: '%s'", spec.Reporting.Endpoint))
	}
	if strings.TrimSpace(spec.Reporting.TokenRef) == "" {
		issues = append(issues, "reporting.token_ref cannot be empty")
	}

	if len(issues) > 0 {
		return &ValidationError{Issues: issues}
	}
	return nil
}
