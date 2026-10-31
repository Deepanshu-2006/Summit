package protocol

import (
	"encoding/json"
	"testing"
	"time"
)

func TestBuildExecutionSpec_Unmarshal(t *testing.T) {
	rawJSON := `{
		"schema_version": 1,
		"build": {
			"id": "11111111-1111-1111-1111-111111111111",
			"attempt_id": "22222222-2222-2222-2222-222222222222",
			"attempt_number": 1,
			"correlation_id": "corr-123"
		},
		"source": {
			"provider": "github",
			"repository": "org/repo",
			"clone_url": "https://github.com/org/repo.git",
			"branch": "main",
			"commit_sha": "0123456789abcdef0123456789abcdef01234567",
			"root_directory": "/app"
		},
		"build_config": {
			"builder": "railpack",
			"env_vars": {"NODE_ENV": "production"}
		},
		"credentials": {
			"source_credential_ref": "secret-source",
			"registry_credential_ref": "secret-registry"
		},
		"output": {
			"registry": "ghcr.io",
			"repository": "tenant/app",
			"tag": "build-1",
			"platforms": ["linux/amd64"]
		},
		"resources": {
			"cpu_millicores": 2000,
			"memory_mib": 4096,
			"ephemeral_storage_mib": 8192
		},
		"timeout_seconds": 1200,
		"reporting": {
			"endpoint": "http://reporter.internal/api/v1/builds",
			"token_ref": "reporter-token"
		}
	}`

	var spec BuildExecutionSpec
	if err := json.Unmarshal([]byte(rawJSON), &spec); err != nil {
		t.Fatalf("unexpected unmarshal error: %v", err)
	}

	if spec.SchemaVersion != 1 {
		t.Errorf("expected schema version 1, got %d", spec.SchemaVersion)
	}
	if spec.Build.ID != "11111111-1111-1111-1111-111111111111" {
		t.Errorf("unexpected build id: %s", spec.Build.ID)
	}
	if spec.Source.RootDirectory != "/app" {
		t.Errorf("unexpected root directory: %s", spec.Source.RootDirectory)
	}
	if spec.BuildConfig.Builder != "railpack" {
		t.Errorf("unexpected builder: %s", spec.BuildConfig.Builder)
	}
	if spec.Output.FullTargetImage() != "ghcr.io/tenant/app" {
		t.Errorf("unexpected full image: %s", spec.Output.FullTargetImage())
	}
	if spec.Output.FullTargetRef() != "ghcr.io/tenant/app:build-1" {
		t.Errorf("unexpected full ref: %s", spec.Output.FullTargetRef())
	}
}

func TestBuildExecutionResult_Marshal(t *testing.T) {
	now := time.Now().UTC()
	res := BuildExecutionResult{
		SchemaVersion: CurrentSchemaVersion,
		BuildID:       "11111111-1111-1111-1111-111111111111",
		AttemptID:     "22222222-2222-2222-2222-222222222222",
		Status:        StatusSucceeded,
		Artifact: &ArtifactDetails{
			Repository: "ghcr.io/tenant/app",
			Digest:     "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			Tag:        "build-1",
			Platforms:  []string{"linux/amd64"},
			SizeBytes:  1048576,
		},
		Metadata: ResultMetadata{
			Builder:         "railpack",
			RailpackVersion: "0.1.0",
			BuildkitVersion: "0.13.0",
			CommitSHA:       "0123456789abcdef0123456789abcdef01234567",
			DetectedRuntime: "nodejs",
		},
		Timestamps: ResultTimestamps{
			StartedAt:   now.Add(-10 * time.Second),
			CompletedAt: now,
			DurationMS:  10000,
		},
	}

	data, err := json.Marshal(res)
	if err != nil {
		t.Fatalf("failed to marshal result: %v", err)
	}

	var decoded BuildExecutionResult
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal result: %v", err)
	}
	if decoded.Status != StatusSucceeded {
		t.Errorf("expected succeeded, got %s", decoded.Status)
	}
	if decoded.Artifact == nil || decoded.Artifact.Digest == "" {
		t.Errorf("expected valid artifact digest")
	}
}

func TestStatusUpdate_Validation(t *testing.T) {
	update := NewStatusUpdate("b-1", "a-1", 1, StageInitializing, StageStatusRunning, "Initializing workspace")
	if !update.Stage.IsValid() {
		t.Errorf("expected StageInitializing to be valid")
	}
	if !update.Status.IsValid() {
		t.Errorf("expected StageStatusRunning to be valid")
	}

	invalidStage := Stage("unknown_stage")
	if invalidStage.IsValid() {
		t.Errorf("expected unknown stage to be invalid")
	}

	invalidStatus := StageStatus("unknown_status")
	if invalidStatus.IsValid() {
		t.Errorf("expected unknown status to be invalid")
	}

	stages := AllStages()
	if len(stages) != 13 {
		t.Errorf("expected 13 stages, got %d", len(stages))
	}
}

func TestLogEvent_Validation(t *testing.T) {
	log := NewLogEvent("b-1", "a-1", 1, StreamStdout, "image_build", SeverityInfo, "Building image")
	if !log.Stream.IsValid() {
		t.Errorf("expected stdout to be valid")
	}
	if !log.Severity.IsValid() {
		t.Errorf("expected info severity to be valid")
	}

	invalidStream := LogStream("system")
	if invalidStream.IsValid() {
		t.Errorf("expected invalid stream to be rejected")
	}

	invalidSeverity := LogSeverity("fatal")
	if invalidSeverity.IsValid() {
		t.Errorf("expected invalid severity to be rejected")
	}
}
