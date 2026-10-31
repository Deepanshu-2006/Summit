package validation

import (
	"testing"

	"github.com/summit/builder/internal/protocol"
)

func validSpec() *protocol.BuildExecutionSpec {
	return &protocol.BuildExecutionSpec{
		SchemaVersion: 1,
		Build: protocol.BuildMetadata{
			ID:            "a5d09f7b-6c41-477e-8c31-1e967a5b3a4f",
			AttemptID:     "f8c3e210-9b44-42f1-8f52-47d3412019aa",
			AttemptNumber: 1,
		},
		Source: protocol.SourceSpec{
			Provider:      "github",
			Repository:    "summit/sample-app",
			CloneURL:      "https://github.com/summit/sample-app.git",
			Branch:        "main",
			CommitSHA:     "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1f",
			RootDirectory: "/",
		},
		BuildConfig: protocol.BuildConfig{
			Builder: "railpack",
		},
		Credentials: protocol.CredentialsSpec{
			SourceCredentialRef:   "secret-source",
			RegistryCredentialRef: "secret-registry",
		},
		Output: protocol.OutputSpec{
			Registry:   "registry.internal:5000",
			Repository: "tenant/app",
			Tag:        "build-1",
			Platforms:  []string{"linux/amd64"},
		},
		Resources: protocol.ResourceLimits{
			CPUMillicores:       2000,
			MemoryMiB:           4096,
			EphemeralStorageMiB: 8192,
		},
		TimeoutSeconds: 1200,
		Reporting: protocol.ReportingSpec{
			Endpoint: "http://reporter.internal/api/v1/builds",
			TokenRef: "reporter-token",
		},
	}
}

func TestValidator_Valid(t *testing.T) {
	v := NewValidator()
	spec := validSpec()
	if err := v.Validate(spec); err != nil {
		t.Fatalf("expected valid spec to pass, got: %v", err)
	}
}

func TestValidator_InvalidSchemaVersion(t *testing.T) {
	v := NewValidator()
	spec := validSpec()
	spec.SchemaVersion = 2
	err := v.Validate(spec)
	if err == nil {
		t.Fatal("expected error for unsupported schema version, got nil")
	}
}

func TestValidator_InvalidCommitSHA(t *testing.T) {
	v := NewValidator()
	spec := validSpec()
	spec.Source.CommitSHA = "not-a-valid-sha"
	err := v.Validate(spec)
	if err == nil {
		t.Fatal("expected error for invalid commit sha, got nil")
	}
}

func TestValidator_PathTraversalRootDirectory(t *testing.T) {
	v := NewValidator()
	spec := validSpec()
	spec.Source.RootDirectory = "../../../etc/passwd"
	err := v.Validate(spec)
	if err == nil {
		t.Fatal("expected error for path traversal in root directory, got nil")
	}
}

func TestValidator_EmptyCredentials(t *testing.T) {
	v := NewValidator()
	spec := validSpec()
	spec.Credentials.SourceCredentialRef = ""
	err := v.Validate(spec)
	if err == nil {
		t.Fatal("expected error for empty source credential ref, got nil")
	}
}

func TestValidator_NilSpec(t *testing.T) {
	v := NewValidator()
	if err := v.Validate(nil); err == nil {
		t.Fatal("expected error for nil spec, got nil")
	}
}
