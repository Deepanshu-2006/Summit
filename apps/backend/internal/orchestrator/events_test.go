package orchestrator

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func validPayloadJSON() string {
	return `{
		"event_id": "a0000000-0000-0000-0000-000000000001",
		"deployment_id": "d0000000-0000-0000-0000-000000000002",
		"build_run_id": "b0000000-0000-0000-0000-000000000003",
		"service_id": "s0000000-0000-0000-0000-000000000004",
		"service_source_id": "c0000000-0000-0000-0000-000000000005",
		"user_id": "u0000000-0000-0000-0000-000000000006",
		"project_id": "p0000000-0000-0000-0000-000000000007",
		"environment_id": "e0000000-0000-0000-0000-000000000008",
		"repository": {
			"platform_repository_id": "r0000000-0000-0000-0000-000000000009",
			"github_repository_id": 987654321,
			"full_name": "acme/web-app"
		},
		"source": {
			"branch": "main",
			"ref": "refs/heads/main",
			"commit_sha": "0123456789abcdef0123456789abcdef01234567",
			"root_directory": "/frontend",
			"dockerfile_path": "Dockerfile.custom"
		},
		"build_configuration": {
			"builder": "dockerfile",
			"node_version": "20"
		},
		"trigger": {
			"type": "github_push",
			"webhook_event_id": "w0000000-0000-0000-0000-000000000010"
		}
	}`
}

func TestDecodeBuildRequestedPayload_Success(t *testing.T) {
	data := []byte(validPayloadJSON())

	payload, err := DecodeBuildRequestedPayload(data)
	if err != nil {
		t.Fatalf("unexpected error decoding payload: %v", err)
	}

	if payload.EventID != "a0000000-0000-0000-0000-000000000001" {
		t.Errorf("unexpected event_id: %s", payload.EventID)
	}
	if payload.DeploymentID != "d0000000-0000-0000-0000-000000000002" {
		t.Errorf("unexpected deployment_id: %s", payload.DeploymentID)
	}
	if payload.BuildRunID != "b0000000-0000-0000-0000-000000000003" {
		t.Errorf("unexpected build_run_id: %s", payload.BuildRunID)
	}
	if payload.ServiceID != "s0000000-0000-0000-0000-000000000004" {
		t.Errorf("unexpected service_id: %s", payload.ServiceID)
	}
	if payload.ServiceSourceID != "c0000000-0000-0000-0000-000000000005" {
		t.Errorf("unexpected service_source_id: %s", payload.ServiceSourceID)
	}
	if payload.UserID != "u0000000-0000-0000-0000-000000000006" {
		t.Errorf("unexpected user_id: %s", payload.UserID)
	}
	if payload.ProjectID != "p0000000-0000-0000-0000-000000000007" {
		t.Errorf("unexpected project_id: %s", payload.ProjectID)
	}
	if payload.EnvironmentID != "e0000000-0000-0000-0000-000000000008" {
		t.Errorf("unexpected environment_id: %s", payload.EnvironmentID)
	}

	// Repository verification
	if payload.Repository.PlatformRepositoryID != "r0000000-0000-0000-0000-000000000009" {
		t.Errorf("unexpected platform_repo_id: %s", payload.Repository.PlatformRepositoryID)
	}
	if payload.Repository.GitHubRepositoryID != 987654321 {
		t.Errorf("unexpected github_repo_id: %d", payload.Repository.GitHubRepositoryID)
	}
	if payload.Repository.FullName != "acme/web-app" {
		t.Errorf("unexpected repo full_name: %s", payload.Repository.FullName)
	}

	// Source verification
	if payload.Source.Branch != "main" {
		t.Errorf("unexpected branch: %s", payload.Source.Branch)
	}
	if payload.Source.Ref != "refs/heads/main" {
		t.Errorf("unexpected ref: %s", payload.Source.Ref)
	}
	if payload.Source.CommitSHA != "0123456789abcdef0123456789abcdef01234567" {
		t.Errorf("unexpected commit_sha: %s", payload.Source.CommitSHA)
	}
	if payload.Source.RootDirectory != "/frontend" {
		t.Errorf("unexpected root_directory: %s", payload.Source.RootDirectory)
	}
	if payload.Source.DockerfilePath == nil || *payload.Source.DockerfilePath != "Dockerfile.custom" {
		t.Errorf("unexpected dockerfile_path: %v", payload.Source.DockerfilePath)
	}

	// Build configuration verification
	var buildConfigMap map[string]string
	if err := json.Unmarshal(payload.BuildConfiguration, &buildConfigMap); err != nil {
		t.Fatalf("failed to unmarshal build_configuration: %v", err)
	}
	if buildConfigMap["builder"] != "dockerfile" || buildConfigMap["node_version"] != "20" {
		t.Errorf("unexpected build_configuration content: %v", buildConfigMap)
	}

	// Trigger verification
	if payload.Trigger.Type != "github_push" {
		t.Errorf("unexpected trigger type: %s", payload.Trigger.Type)
	}
	if payload.Trigger.WebhookEventID != "w0000000-0000-0000-0000-000000000010" {
		t.Errorf("unexpected trigger webhook_event_id: %s", payload.Trigger.WebhookEventID)
	}
}

func TestDecodeBuildRequestedPayload_NilOrEmpty(t *testing.T) {
	_, err := DecodeBuildRequestedPayload(nil)
	if !errors.Is(err, ErrNilPayload) {
		t.Fatalf("expected ErrNilPayload for nil slice, got %v", err)
	}

	_, err = DecodeBuildRequestedPayload([]byte("   \n\t "))
	if !errors.Is(err, ErrNilPayload) {
		t.Fatalf("expected ErrNilPayload for whitespace-only slice, got %v", err)
	}
}

func TestDecodeBuildRequestedPayload_InvalidJSON(t *testing.T) {
	_, err := DecodeBuildRequestedPayload([]byte("{not a valid json"))
	if !errors.Is(err, ErrInvalidJSON) {
		t.Fatalf("expected ErrInvalidJSON for malformed payload, got %v", err)
	}
}

func TestDecodeBuildRequestedPayload_MissingFields(t *testing.T) {
	baseMap := map[string]any{
		"event_id":          "a0000000-0000-0000-0000-000000000001",
		"deployment_id":     "d0000000-0000-0000-0000-000000000002",
		"build_run_id":      "b0000000-0000-0000-0000-000000000003",
		"service_id":        "s0000000-0000-0000-0000-000000000004",
		"service_source_id": "c0000000-0000-0000-0000-000000000005",
		"user_id":           "u0000000-0000-0000-0000-000000000006",
		"project_id":        "p0000000-0000-0000-0000-000000000007",
		"environment_id":    "e0000000-0000-0000-0000-000000000008",
		"repository": map[string]any{
			"platform_repository_id": "r0000000-0000-0000-0000-000000000009",
			"github_repository_id":   12345,
			"full_name":              "org/repo",
		},
		"source": map[string]any{
			"branch":     "main",
			"ref":        "refs/heads/main",
			"commit_sha": "abc1234",
		},
		"trigger": map[string]any{
			"type": "github_push",
		},
	}

	testCases := []struct {
		name          string
		mutate        func(m map[string]any)
		expectedField string
	}{
		{
			name: "missing event_id",
			mutate: func(m map[string]any) {
				delete(m, "event_id")
			},
			expectedField: "event_id",
		},
		{
			name: "missing deployment_id",
			mutate: func(m map[string]any) {
				delete(m, "deployment_id")
			},
			expectedField: "deployment_id",
		},
		{
			name: "missing build_run_id",
			mutate: func(m map[string]any) {
				delete(m, "build_run_id")
			},
			expectedField: "build_run_id",
		},
		{
			name: "missing service_id",
			mutate: func(m map[string]any) {
				delete(m, "service_id")
			},
			expectedField: "service_id",
		},
		{
			name: "missing service_source_id",
			mutate: func(m map[string]any) {
				delete(m, "service_source_id")
			},
			expectedField: "service_source_id",
		},
		{
			name: "missing user_id",
			mutate: func(m map[string]any) {
				delete(m, "user_id")
			},
			expectedField: "user_id",
		},
		{
			name: "missing project_id",
			mutate: func(m map[string]any) {
				delete(m, "project_id")
			},
			expectedField: "project_id",
		},
		{
			name: "missing environment_id",
			mutate: func(m map[string]any) {
				delete(m, "environment_id")
			},
			expectedField: "environment_id",
		},
		{
			name: "missing repository platform_repository_id",
			mutate: func(m map[string]any) {
				repo := m["repository"].(map[string]any)
				delete(repo, "platform_repository_id")
			},
			expectedField: "repository.platform_repository_id",
		},
		{
			name: "missing repository github_repository_id",
			mutate: func(m map[string]any) {
				repo := m["repository"].(map[string]any)
				repo["github_repository_id"] = 0
			},
			expectedField: "repository.github_repository_id",
		},
		{
			name: "missing repository full_name",
			mutate: func(m map[string]any) {
				repo := m["repository"].(map[string]any)
				delete(repo, "full_name")
			},
			expectedField: "repository.full_name",
		},
		{
			name: "missing source branch",
			mutate: func(m map[string]any) {
				src := m["source"].(map[string]any)
				delete(src, "branch")
			},
			expectedField: "source.branch",
		},
		{
			name: "missing source ref",
			mutate: func(m map[string]any) {
				src := m["source"].(map[string]any)
				delete(src, "ref")
			},
			expectedField: "source.ref",
		},
		{
			name: "missing source commit_sha",
			mutate: func(m map[string]any) {
				src := m["source"].(map[string]any)
				delete(src, "commit_sha")
			},
			expectedField: "source.commit_sha",
		},
		{
			name: "missing trigger type",
			mutate: func(m map[string]any) {
				trig := m["trigger"].(map[string]any)
				delete(trig, "type")
			},
			expectedField: "trigger.type",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Deep copy base map
			raw, _ := json.Marshal(baseMap)
			var cloned map[string]any
			_ = json.Unmarshal(raw, &cloned)

			tc.mutate(cloned)
			modifiedJSON, _ := json.Marshal(cloned)

			_, err := DecodeBuildRequestedPayload(modifiedJSON)
			if err == nil {
				t.Fatalf("expected validation error, got nil")
			}
			if !errors.Is(err, ErrValidation) {
				t.Fatalf("expected ErrValidation, got %v", err)
			}
			if !strings.Contains(err.Error(), tc.expectedField) {
				t.Errorf("expected error message to mention %q, got: %v", tc.expectedField, err)
			}
		})
	}
}

func TestMissingEnrichmentInputs_Completeness(t *testing.T) {
	fields := MissingEnrichmentInputs()
	if len(fields) == 0 {
		t.Fatalf("expected documented missing enrichment fields, got empty slice")
	}

	categoriesFound := make(map[string]bool)
	for _, f := range fields {
		if f.Category == "" || f.Field == "" || f.Description == "" {
			t.Errorf("incomplete missing enrichment definition: %+v", f)
		}
		categoriesFound[f.Category] = true
	}

	requiredCategories := []string{
		"BuildMetadata",
		"SourceSpec",
		"CredentialsSpec",
		"OutputSpec",
		"ResourceLimits",
		"TimeoutSeconds",
		"ReportingSpec",
		"BuildConfig",
	}

	for _, cat := range requiredCategories {
		if !categoriesFound[cat] {
			t.Errorf("missing coverage for enrichment category: %s", cat)
		}
	}
}
