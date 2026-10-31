package build

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func validSpec() BuildExecutionSpec {
	return BuildExecutionSpec{
		SchemaVersion: 1,
		Build: BuildMetadata{
			ID:            "a0000000-0000-0000-0000-000000000001",
			AttemptID:     "b0000000-0000-0000-0000-000000000002",
			AttemptNumber: 1,
			CorrelationID: "c0000000-0000-0000-0000-000000000003",
		},
		Source: SourceSpec{
			Provider:      "github",
			Repository:    "summit-paas/test-repo",
			CloneURL:      "https://github.com/summit-paas/test-repo.git",
			Branch:        "main",
			CommitSHA:     "0123456789abcdef0123456789abcdef01234567",
			RootDirectory: "/",
		},
		BuildConfig: BuildConfig{
			Builder: "railpack",
			EnvVars: map[string]string{
				"NODE_ENV": "production",
			},
		},
		Credentials: CredentialsSpec{
			SourceCredentialRef:   "secret:summit-builds/git-token",
			RegistryCredentialRef: "secret:summit-builds/ghcr-push-token",
		},
		Output: OutputSpec{
			Registry:   "ghcr.io",
			Repository: "summit-paas/test-repo",
			Tag:        "sha-0123456",
			Platforms:  []string{"linux/amd64"},
		},
		Resources: ResourceLimits{
			CPUMillicores:       1000,
			MemoryMiB:           2048,
			EphemeralStorageMiB: 4096,
		},
		TimeoutSeconds: 600,
		Reporting: ReportingSpec{
			Endpoint: "https://api.summit.internal/v1/build-reports",
			TokenRef: "token:build-worker-jwt",
		},
	}
}

func TestBuildExecutionSpec_Validate_Valid(t *testing.T) {
	spec := validSpec()
	if err := spec.Validate(); err != nil {
		t.Fatalf("expected valid spec to pass, got: %v", err)
	}
}

func TestBuildExecutionSpec_Validate_SchemaVersion(t *testing.T) {
	spec := validSpec()
	spec.SchemaVersion = 2

	err := spec.Validate()
	if err == nil {
		t.Fatalf("expected error for schema_version 2, got nil")
	}
	if !errors.Is(err, ErrUnsupportedSchemaVersion) {
		t.Errorf("expected ErrUnsupportedSchemaVersion, got %v", err)
	}

	spec.SchemaVersion = 0
	if err := spec.Validate(); !errors.Is(err, ErrUnsupportedSchemaVersion) {
		t.Errorf("expected ErrUnsupportedSchemaVersion for 0, got %v", err)
	}
}

func TestBuildExecutionSpec_Validate_MissingRequiredFields(t *testing.T) {
	tests := []struct {
		name      string
		mutate    func(*BuildExecutionSpec)
		errSubstr string
	}{
		{
			name: "missing build.id",
			mutate: func(s *BuildExecutionSpec) {
				s.Build.ID = ""
			},
			errSubstr: "build.id",
		},
		{
			name: "invalid build.id format",
			mutate: func(s *BuildExecutionSpec) {
				s.Build.ID = "invalid-uuid"
			},
			errSubstr: "must be a valid UUID",
		},
		{
			name: "missing build.attempt_id",
			mutate: func(s *BuildExecutionSpec) {
				s.Build.AttemptID = ""
			},
			errSubstr: "build.attempt_id",
		},
		{
			name: "invalid build.attempt_number",
			mutate: func(s *BuildExecutionSpec) {
				s.Build.AttemptNumber = 0
			},
			errSubstr: "build.attempt_number",
		},
		{
			name: "missing source.provider",
			mutate: func(s *BuildExecutionSpec) {
				s.Source.Provider = ""
			},
			errSubstr: "source.provider",
		},
		{
			name: "invalid source.clone_url",
			mutate: func(s *BuildExecutionSpec) {
				s.Source.CloneURL = "not-a-url"
			},
			errSubstr: "must be a valid URI",
		},
		{
			name: "invalid commit sha",
			mutate: func(s *BuildExecutionSpec) {
				s.Source.CommitSHA = "badsha"
			},
			errSubstr: "must be a 40 or 64 char hex string",
		},
		{
			name: "missing credentials.source_credential_ref",
			mutate: func(s *BuildExecutionSpec) {
				s.Credentials.SourceCredentialRef = ""
			},
			errSubstr: "credentials.source_credential_ref",
		},
		{
			name: "missing credentials.registry_credential_ref",
			mutate: func(s *BuildExecutionSpec) {
				s.Credentials.RegistryCredentialRef = ""
			},
			errSubstr: "credentials.registry_credential_ref",
		},
		{
			name: "missing output.registry",
			mutate: func(s *BuildExecutionSpec) {
				s.Output.Registry = ""
			},
			errSubstr: "output.registry",
		},
		{
			name: "missing output.platforms",
			mutate: func(s *BuildExecutionSpec) {
				s.Output.Platforms = nil
			},
			errSubstr: "output.platforms",
		},
		{
			name: "too low cpu millicores",
			mutate: func(s *BuildExecutionSpec) {
				s.Resources.CPUMillicores = 50
			},
			errSubstr: "cpu_millicores must be at least 100",
		},
		{
			name: "too low memory mib",
			mutate: func(s *BuildExecutionSpec) {
				s.Resources.MemoryMiB = 64
			},
			errSubstr: "memory_mib must be at least 128",
		},
		{
			name: "too low ephemeral storage mib",
			mutate: func(s *BuildExecutionSpec) {
				s.Resources.EphemeralStorageMiB = 256
			},
			errSubstr: "ephemeral_storage_mib must be at least 512",
		},
		{
			name: "timeout too low",
			mutate: func(s *BuildExecutionSpec) {
				s.TimeoutSeconds = 5
			},
			errSubstr: "timeout_seconds must be at least 10",
		},
		{
			name: "missing reporting endpoint",
			mutate: func(s *BuildExecutionSpec) {
				s.Reporting.Endpoint = ""
			},
			errSubstr: "reporting.endpoint",
		},
		{
			name: "missing reporting token_ref",
			mutate: func(s *BuildExecutionSpec) {
				s.Reporting.TokenRef = ""
			},
			errSubstr: "reporting.token_ref",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			spec := validSpec()
			tc.mutate(&spec)
			err := spec.Validate()
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", tc.errSubstr)
			}
			if !strings.Contains(err.Error(), tc.errSubstr) {
				t.Errorf("error %q does not contain %q", err.Error(), tc.errSubstr)
			}
		})
	}
}

func TestBuildExecutionSpec_JSONRoundtrip(t *testing.T) {
	spec := validSpec()
	data, err := spec.ToJSON()
	if err != nil {
		t.Fatalf("failed to marshal to JSON: %v", err)
	}

	parsed, err := ParseBuildExecutionSpec(data)
	if err != nil {
		t.Fatalf("failed to parse JSON: %v", err)
	}

	if parsed.Build.ID != spec.Build.ID {
		t.Errorf("expected build.id %s, got %s", spec.Build.ID, parsed.Build.ID)
	}
	if parsed.Output.FullTargetRef() != "ghcr.io/summit-paas/test-repo:sha-0123456" {
		t.Errorf("unexpected target ref: %s", parsed.Output.FullTargetRef())
	}
}

func TestBuildExecutionSpec_AltBuildConfigUnmarshal(t *testing.T) {
	rawJSON := `{
		"schema_version": 1,
		"build": {
			"id": "a0000000-0000-0000-0000-000000000001",
			"attempt_id": "b0000000-0000-0000-0000-000000000002",
			"attempt_number": 1
		},
		"source": {
			"provider": "github",
			"repository": "summit-paas/test-repo",
			"clone_url": "https://github.com/summit-paas/test-repo.git",
			"commit_sha": "0123456789abcdef0123456789abcdef01234567"
		},
		"build_config_spec": {
			"builder": "dockerfile"
		},
		"credentials": {
			"source_credential_ref": "git-token",
			"registry_credential_ref": "registry-token"
		},
		"output": {
			"registry": "ghcr.io",
			"repository": "summit-paas/test-repo",
			"tag": "v1",
			"platforms": ["linux/amd64"]
		},
		"resources": {
			"cpu_millicores": 500,
			"memory_mib": 1024,
			"ephemeral_storage_mib": 2048
		},
		"timeout_seconds": 300,
		"reporting": {
			"endpoint": "https://api.summit.internal/v1/build-reports",
			"token_ref": "jwt-token"
		}
	}`

	var spec BuildExecutionSpec
	if err := json.Unmarshal([]byte(rawJSON), &spec); err != nil {
		t.Fatalf("unexpected unmarshal error: %v", err)
	}

	if spec.BuildConfig.Builder != "dockerfile" {
		t.Errorf("expected builder 'dockerfile', got %q", spec.BuildConfig.Builder)
	}
	if spec.Source.RootDirectory != "/" {
		t.Errorf("expected default root_directory '/', got %q", spec.Source.RootDirectory)
	}
}
