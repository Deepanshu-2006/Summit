package build

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
)

// CurrentSchemaVersion defines the supported BuildExecutionSpec schema version.
const CurrentSchemaVersion = 1

// DefaultExecutionSpecMountPath is the container path where execution.json is mounted.
const DefaultExecutionSpecMountPath = "/run/summit/execution.json"

// ExecutionSpecEnvVar is the environment variable holding the execution spec mount path.
const ExecutionSpecEnvVar = "SUMMIT_EXECUTION_SPEC"

var (
	// ErrUnsupportedSchemaVersion is returned when a spec schema_version is not 1.
	ErrUnsupportedSchemaVersion = errors.New("unsupported build execution spec schema_version (expected 1)")

	// ErrValidation indicates a required field is missing or invalid according to the wire contract.
	ErrValidation = errors.New("build execution spec validation failed")

	uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	shaPattern  = regexp.MustCompile(`^([0-9a-fA-F]{40}|[0-9a-fA-F]{64})$`)
)

// BuildExecutionSpec is the wire contract for builder execution, matching schema_version 1.
type BuildExecutionSpec struct {
	SchemaVersion  int             `json:"schema_version"`
	Build          BuildMetadata   `json:"build"`
	Source         SourceSpec      `json:"source"`
	BuildConfig    BuildConfig     `json:"build_config"`
	Credentials    CredentialsSpec `json:"credentials"`
	Output         OutputSpec      `json:"output"`
	Resources      ResourceLimits  `json:"resources"`
	TimeoutSeconds int             `json:"timeout_seconds"`
	Reporting      ReportingSpec   `json:"reporting"`
}

// BuildMetadata contains identifiers and tracking for the build execution attempt.
type BuildMetadata struct {
	ID            string `json:"id"`
	AttemptID     string `json:"attempt_id"`
	AttemptNumber int    `json:"attempt_number"`
	CorrelationID string `json:"correlation_id,omitempty"`
}

// SourceSpec defines the source repository location and exact commit revision.
type SourceSpec struct {
	Provider      string `json:"provider"`
	Repository    string `json:"repository"`
	CloneURL      string `json:"clone_url"`
	Branch        string `json:"branch,omitempty"`
	CommitSHA     string `json:"commit_sha"`
	RootDirectory string `json:"root_directory"`
}

// BuildConfig defines compilation, dependency, and containerization instructions.
type BuildConfig struct {
	Builder        string            `json:"builder"`
	BuildCommand   *string           `json:"build_command,omitempty"`
	InstallCommand *string           `json:"install_command,omitempty"`
	StartCommand   *string           `json:"start_command,omitempty"`
	DockerfilePath *string           `json:"dockerfile_path,omitempty"`
	EnvVars        map[string]string `json:"env_vars,omitempty"`
}

// CredentialsSpec contains opaque references for fetching secrets at runtime.
// Secret values MUST NEVER be included in this struct or serialized into manifests.
type CredentialsSpec struct {
	SourceCredentialRef   string `json:"source_credential_ref"`
	RegistryCredentialRef string `json:"registry_credential_ref"`
}

// OutputSpec defines the destination OCI image coordinates.
type OutputSpec struct {
	Registry   string   `json:"registry"`
	Repository string   `json:"repository"`
	Tag        string   `json:"tag"`
	Platforms  []string `json:"platforms"`
}

// FullTargetImage returns the fully qualified target image reference without tag.
func (o OutputSpec) FullTargetImage() string {
	if o.Registry == "" {
		return o.Repository
	}
	return fmt.Sprintf("%s/%s", o.Registry, o.Repository)
}

// FullTargetRef returns the fully qualified target image reference including tag.
func (o OutputSpec) FullTargetRef() string {
	return fmt.Sprintf("%s:%s", o.FullTargetImage(), o.Tag)
}

// ResourceLimits specifies resource boundaries for the build process.
type ResourceLimits struct {
	CPUMillicores       int `json:"cpu_millicores"`
	MemoryMiB           int `json:"memory_mib"`
	EphemeralStorageMiB int `json:"ephemeral_storage_mib"`
}

// ReportingSpec defines how the builder container sends status and logs back to the control plane.
type ReportingSpec struct {
	Endpoint string `json:"endpoint"`
	TokenRef string `json:"token_ref"`
}

// rawExecutionSpec supports unmarshaling specs with alias handling.
type rawExecutionSpec struct {
	SchemaVersion  int             `json:"schema_version"`
	Build          BuildMetadata   `json:"build"`
	Source         SourceSpec      `json:"source"`
	BuildConfig    *BuildConfig    `json:"build_config"`
	AltBuildConfig *BuildConfig    `json:"build_config_spec"`
	Credentials    CredentialsSpec `json:"credentials"`
	Output         OutputSpec      `json:"output"`
	Resources      ResourceLimits  `json:"resources"`
	TimeoutSeconds int             `json:"timeout_seconds"`
	Reporting      ReportingSpec   `json:"reporting"`
}

// UnmarshalJSON unmarshals a BuildExecutionSpec, supporting field defaults and aliases.
func (s *BuildExecutionSpec) UnmarshalJSON(data []byte) error {
	var raw rawExecutionSpec
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	s.SchemaVersion = raw.SchemaVersion
	s.Build = raw.Build
	s.Source = raw.Source
	s.Credentials = raw.Credentials
	s.Output = raw.Output
	s.Resources = raw.Resources
	s.TimeoutSeconds = raw.TimeoutSeconds
	s.Reporting = raw.Reporting

	if raw.BuildConfig != nil {
		s.BuildConfig = *raw.BuildConfig
	} else if raw.AltBuildConfig != nil {
		s.BuildConfig = *raw.AltBuildConfig
	}

	if s.Source.RootDirectory == "" {
		s.Source.RootDirectory = "/"
	}

	return nil
}

// ToJSON serializes the spec into pretty JSON bytes.
func (s *BuildExecutionSpec) ToJSON() ([]byte, error) {
	return json.MarshalIndent(s, "", "  ")
}

// ParseBuildExecutionSpec unmarshals and validates JSON into a BuildExecutionSpec.
func ParseBuildExecutionSpec(data []byte) (*BuildExecutionSpec, error) {
	var spec BuildExecutionSpec
	if err := json.Unmarshal(data, &spec); err != nil {
		return nil, fmt.Errorf("%w: invalid JSON: %v", ErrValidation, err)
	}

	if err := spec.Validate(); err != nil {
		return nil, err
	}

	return &spec, nil
}

// Validate checks that the spec strictly satisfies schema_version 1 requirements.
func (s *BuildExecutionSpec) Validate() error {
	if s.SchemaVersion != CurrentSchemaVersion {
		return fmt.Errorf("%w: received %d", ErrUnsupportedSchemaVersion, s.SchemaVersion)
	}

	var missing []string

	// Build metadata
	if strings.TrimSpace(s.Build.ID) == "" {
		missing = append(missing, "build.id")
	} else if !uuidPattern.MatchString(s.Build.ID) {
		return fmt.Errorf("%w: build.id must be a valid UUID, got %q", ErrValidation, s.Build.ID)
	}

	if strings.TrimSpace(s.Build.AttemptID) == "" {
		missing = append(missing, "build.attempt_id")
	} else if !uuidPattern.MatchString(s.Build.AttemptID) {
		return fmt.Errorf("%w: build.attempt_id must be a valid UUID, got %q", ErrValidation, s.Build.AttemptID)
	}

	if s.Build.AttemptNumber < 1 {
		missing = append(missing, "build.attempt_number (must be >= 1)")
	}

	// Source spec
	if strings.TrimSpace(s.Source.Provider) == "" {
		missing = append(missing, "source.provider")
	}
	if strings.TrimSpace(s.Source.Repository) == "" {
		missing = append(missing, "source.repository")
	}
	if strings.TrimSpace(s.Source.CloneURL) == "" {
		missing = append(missing, "source.clone_url")
	} else if _, err := url.ParseRequestURI(s.Source.CloneURL); err != nil {
		return fmt.Errorf("%w: source.clone_url must be a valid URI: %v", ErrValidation, err)
	}
	if strings.TrimSpace(s.Source.CommitSHA) == "" {
		missing = append(missing, "source.commit_sha")
	} else if !shaPattern.MatchString(s.Source.CommitSHA) {
		return fmt.Errorf("%w: source.commit_sha must be a 40 or 64 char hex string, got %q", ErrValidation, s.Source.CommitSHA)
	}

	// Build config
	if strings.TrimSpace(s.BuildConfig.Builder) == "" {
		missing = append(missing, "build_config.builder")
	}

	// Credentials spec
	if strings.TrimSpace(s.Credentials.SourceCredentialRef) == "" {
		missing = append(missing, "credentials.source_credential_ref")
	}
	if strings.TrimSpace(s.Credentials.RegistryCredentialRef) == "" {
		missing = append(missing, "credentials.registry_credential_ref")
	}

	// Output spec
	if strings.TrimSpace(s.Output.Registry) == "" {
		missing = append(missing, "output.registry")
	}
	if strings.TrimSpace(s.Output.Repository) == "" {
		missing = append(missing, "output.repository")
	}
	if strings.TrimSpace(s.Output.Tag) == "" {
		missing = append(missing, "output.tag")
	}
	if len(s.Output.Platforms) == 0 {
		missing = append(missing, "output.platforms")
	}

	// Resources
	if s.Resources.CPUMillicores > 0 && s.Resources.CPUMillicores < 100 {
		return fmt.Errorf("%w: resources.cpu_millicores must be at least 100", ErrValidation)
	}
	if s.Resources.MemoryMiB > 0 && s.Resources.MemoryMiB < 128 {
		return fmt.Errorf("%w: resources.memory_mib must be at least 128", ErrValidation)
	}
	if s.Resources.EphemeralStorageMiB > 0 && s.Resources.EphemeralStorageMiB < 512 {
		return fmt.Errorf("%w: resources.ephemeral_storage_mib must be at least 512", ErrValidation)
	}

	// Timeout
	if s.TimeoutSeconds > 0 && s.TimeoutSeconds < 10 {
		return fmt.Errorf("%w: timeout_seconds must be at least 10", ErrValidation)
	}

	// Reporting
	if strings.TrimSpace(s.Reporting.Endpoint) == "" {
		missing = append(missing, "reporting.endpoint")
	} else if _, err := url.ParseRequestURI(s.Reporting.Endpoint); err != nil {
		return fmt.Errorf("%w: reporting.endpoint must be a valid URI: %v", ErrValidation, err)
	}
	if strings.TrimSpace(s.Reporting.TokenRef) == "" {
		missing = append(missing, "reporting.token_ref")
	}

	if len(missing) > 0 {
		return fmt.Errorf("%w: missing required fields [%s]", ErrValidation, strings.Join(missing, ", "))
	}

	return nil
}
