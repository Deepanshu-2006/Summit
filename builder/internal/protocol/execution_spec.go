package protocol

import (
	"encoding/json"
	"fmt"
)

// CurrentSchemaVersion defines the supported BuildExecutionSpec schema version.
const CurrentSchemaVersion = 1

// BuildExecutionSpec is the complete execution specification passed to the builder worker.
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

// BuildMetadata contains identifiers and tracking for the build attempt.
type BuildMetadata struct {
	ID            string `json:"id"`
	AttemptID     string `json:"attempt_id"`
	AttemptNumber int    `json:"attempt_number"`
	CorrelationID string `json:"correlation_id,omitempty"`
}

// SourceSpec defines the source repository location and exact revision.
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

// ReportingSpec defines how the worker sends status and logs back to the control plane.
type ReportingSpec struct {
	Endpoint string `json:"endpoint"`
	TokenRef string `json:"token_ref"`
}

// rawExecutionSpec is a helper type for unmarshaling specs that may have
// either "build_config" or alternative aliases.
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

// UnmarshalJSON unmarshals BuildExecutionSpec with support for field defaults and aliases.
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

	// Default root_directory to "/" if empty
	if s.Source.RootDirectory == "" {
		s.Source.RootDirectory = "/"
	}

	return nil
}
