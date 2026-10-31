package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/summit/backend/internal/secrets"
	"github.com/summit/backend/internal/testutil"
	"github.com/summit/backend/internal/workertoken"
)

type mockSecretsProvider struct {
	secrets map[string][]byte
}

func (m *mockSecretsProvider) Get(_ context.Context, path string) ([]byte, error) {
	if val, ok := m.secrets[path]; ok {
		return val, nil
	}
	return nil, fmt.Errorf("secret not found: %s", path)
}

func TestBuildCallback_Authentication(t *testing.T) {
	workerSecret := []byte("super-secret-worker-jwt-key-minimum-32-bytes!!")
	secProvider := &mockSecretsProvider{
		secrets: map[string][]byte{
			secrets.PathWorkerJWTSecret: workerSecret,
		},
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := NewBuildCallbackHandler(nil, secProvider, logger)
	jobID := uuid.New()

	t.Run("missing authorization header returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/internal/v1/builds/"+jobID.String()+"/status", bytes.NewReader([]byte("{}")))
		rec := httptest.NewRecorder()
		handler.HandleStatus(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("malformed authorization header returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/internal/v1/builds/"+jobID.String()+"/status", bytes.NewReader([]byte("{}")))
		req.Header.Set("Authorization", "Basic dXNlcjpwYXNz")
		rec := httptest.NewRecorder()
		handler.HandleStatus(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("invalid token returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/internal/v1/builds/"+jobID.String()+"/status", bytes.NewReader([]byte("{}")))
		req.Header.Set("Authorization", "Bearer invalid-token-string")
		rec := httptest.NewRecorder()
		handler.HandleStatus(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("token scoped to different job returns 401", func(t *testing.T) {
		otherJobID := uuid.New()
		token, err := workertoken.Mint(workerSecret, otherJobID, time.Hour)
		if err != nil {
			t.Fatalf("minting worker token: %v", err)
		}

		req := httptest.NewRequest(http.MethodPost, "/internal/v1/builds/"+jobID.String()+"/status", bytes.NewReader([]byte("{}")))
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		handler.HandleStatus(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("valid minted workertoken passes auth and reaches db check", func(t *testing.T) {
		token, err := workertoken.Mint(workerSecret, jobID, time.Hour)
		if err != nil {
			t.Fatalf("minting worker token: %v", err)
		}

		req := httptest.NewRequest(http.MethodPost, "/internal/v1/builds/"+jobID.String()+"/status", bytes.NewReader([]byte("{}")))
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		handler.HandleStatus(rec, req)
		// Database pool is nil -> expected 503 Service Unavailable, proving auth passed
		if rec.Code != http.StatusServiceUnavailable {
			t.Errorf("expected 503 (database unavailable), got %d", rec.Code)
		}
	})
}

func setupTestBuildJob(t *testing.T, pool *pgxpool.Pool) (userID uuid.UUID, buildJobID uuid.UUID) {
	t.Helper()
	u := testutil.SeedUser(t, pool, "", "")
	p := testutil.SeedProject(t, pool, u.ID, "", "")
	e := testutil.SeedEnvironment(t, pool, p.ID, "", "")
	s := testutil.SeedService(t, pool, e.ID, "", "")
	d := testutil.SeedDeployment(t, pool, p.ID, e.ID, s.ID, "queued")
	b := testutil.SeedBuildJob(t, pool, d.ID, "queued")
	return u.ID, b.ID
}

func TestBuildCallback_ValidationAndLiveDatabaseFlows(t *testing.T) {
	pool := testutil.NewDB(t)
	if pool == nil {
		return
	}

	workerSecret := []byte("super-secret-worker-jwt-key-minimum-32-bytes!!")
	secProvider := &mockSecretsProvider{
		secrets: map[string][]byte{
			secrets.PathWorkerJWTSecret: workerSecret,
		},
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := NewBuildCallbackHandler(pool, secProvider, logger)

	t.Run("invalid build_id in URL returns 400", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/internal/v1/builds/not-a-uuid/status", nil)
		rec := httptest.NewRecorder()
		handler.HandleStatus(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", rec.Code)
		}
	})

	t.Run("result rejects schema_version != 1", func(t *testing.T) {
		_, buildJobID := setupTestBuildJob(t, pool)
		token, _ := workertoken.Mint(workerSecret, buildJobID, time.Hour)
		payload := BuildExecutionResultPayload{
			SchemaVersion: 2,
			BuildID:       buildJobID.String(),
			Status:        "succeeded",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/internal/v1/builds/"+buildJobID.String()+"/result", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		handler.HandleResult(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", rec.Code)
		}
	})

	t.Run("result rejects invalid status", func(t *testing.T) {
		_, buildJobID := setupTestBuildJob(t, pool)
		token, _ := workertoken.Mint(workerSecret, buildJobID, time.Hour)
		payload := BuildExecutionResultPayload{
			SchemaVersion: 1,
			BuildID:       buildJobID.String(),
			Status:        "invalid_status",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/internal/v1/builds/"+buildJobID.String()+"/result", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		handler.HandleResult(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", rec.Code)
		}
	})

	t.Run("result succeeded rejects missing artifact digest", func(t *testing.T) {
		_, buildJobID := setupTestBuildJob(t, pool)
		token, _ := workertoken.Mint(workerSecret, buildJobID, time.Hour)
		payload := BuildExecutionResultPayload{
			SchemaVersion: 1,
			BuildID:       buildJobID.String(),
			Status:        "succeeded",
			Artifact: &ArtifactDetailsPayload{
				Repository: "ghcr.io/owner/repo",
				Digest:     "",
			},
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/internal/v1/builds/"+buildJobID.String()+"/result", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		handler.HandleResult(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", rec.Code)
		}
	})

	t.Run("result succeeded rejects non-sha256 digest", func(t *testing.T) {
		_, buildJobID := setupTestBuildJob(t, pool)
		token, _ := workertoken.Mint(workerSecret, buildJobID, time.Hour)
		payload := BuildExecutionResultPayload{
			SchemaVersion: 1,
			BuildID:       buildJobID.String(),
			Status:        "succeeded",
			Artifact: &ArtifactDetailsPayload{
				Repository: "ghcr.io/owner/repo",
				Digest:     "sha1:1234567890abcdef",
			},
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/internal/v1/builds/"+buildJobID.String()+"/result", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		handler.HandleResult(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", rec.Code)
		}
	})

	t.Run("status update creates event and updates build_jobs", func(t *testing.T) {
		_, buildJobID := setupTestBuildJob(t, pool)
		token, err := workertoken.Mint(workerSecret, buildJobID, time.Hour)
		if err != nil {
			t.Fatalf("minting worker token: %v", err)
		}

		attemptID := uuid.New().String()
		update := StatusUpdatePayload{
			BuildID:   buildJobID.String(),
			AttemptID: attemptID,
			Sequence:  1,
			Stage:     "image_build",
			Status:    "running",
			Timestamp: time.Now().UTC(),
			Message:   "Compiling image via BuildKit",
		}
		body, _ := json.Marshal(update)

		req := httptest.NewRequest(http.MethodPost, "/internal/v1/builds/"+buildJobID.String()+"/status", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		handler.HandleStatus(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}

		// Verify event persisted in build_job_events
		var count int
		var stage, status string
		err = pool.QueryRow(context.Background(),
			"SELECT stage, status FROM build_job_events WHERE build_job_id = $1 AND sequence = 1",
			buildJobID,
		).Scan(&stage, &status)
		if err != nil {
			t.Fatalf("querying build_job_events: %v", err)
		}
		if stage != "image_build" || status != "running" {
			t.Errorf("unexpected event: stage=%s, status=%s", stage, status)
		}

		// Verify build_jobs row updated
		var jobStatus, currentStage string
		err = pool.QueryRow(context.Background(),
			"SELECT status, current_stage FROM build_jobs WHERE id = $1",
			buildJobID,
		).Scan(&jobStatus, &currentStage)
		if err != nil {
			t.Fatalf("querying build_jobs: %v", err)
		}
		if jobStatus != "running" || currentStage != "image_build" {
			t.Errorf("unexpected build_jobs state: status=%s, stage=%s", jobStatus, currentStage)
		}

		// Test idempotency: re-sending sequence 1 does not fail
		rec2 := httptest.NewRecorder()
		req2 := httptest.NewRequest(http.MethodPost, "/internal/v1/builds/"+buildJobID.String()+"/status", bytes.NewReader(body))
		req2.Header.Set("Authorization", "Bearer "+token)
		handler.HandleStatus(rec2, req2)
		if rec2.Code != http.StatusOK {
			t.Errorf("expected idempotent 200, got %d", rec2.Code)
		}

		err = pool.QueryRow(context.Background(),
			"SELECT COUNT(*) FROM build_job_events WHERE build_job_id = $1 AND sequence = 1",
			buildJobID,
		).Scan(&count)
		if err != nil || count != 1 {
			t.Errorf("expected exactly 1 event for sequence 1, got count=%d, err=%v", count, err)
		}
	})

	t.Run("logs callback batches entries into build_job_logs", func(t *testing.T) {
		_, buildJobID := setupTestBuildJob(t, pool)
		token, err := workertoken.Mint(workerSecret, buildJobID, time.Hour)
		if err != nil {
			t.Fatalf("minting worker token: %v", err)
		}

		logs := []LogEventPayload{
			{
				BuildID:   buildJobID.String(),
				Sequence:  1,
				Timestamp: time.Now().UTC(),
				Stream:    "stdout",
				Stage:     "image_build",
				Severity:  "info",
				Message:   "#1 [internal] load build definition from Dockerfile",
			},
			{
				BuildID:   buildJobID.String(),
				Sequence:  2,
				Timestamp: time.Now().UTC(),
				Stream:    "stdout",
				Stage:     "image_build",
				Severity:  "info",
				Message:   "#2 [internal] load .dockerignore",
			},
		}
		body, _ := json.Marshal(logs)

		req := httptest.NewRequest(http.MethodPost, "/internal/v1/builds/"+buildJobID.String()+"/logs", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		handler.HandleLogs(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}

		var count int
		err = pool.QueryRow(context.Background(),
			"SELECT COUNT(*) FROM build_job_logs WHERE build_job_id = $1",
			buildJobID,
		).Scan(&count)
		if err != nil || count != 2 {
			t.Errorf("expected 2 log entries, got count=%d, err=%v", count, err)
		}
	})

	t.Run("result succeeded updates build_jobs with immutable digest and repository", func(t *testing.T) {
		_, buildJobID := setupTestBuildJob(t, pool)
		token, err := workertoken.Mint(workerSecret, buildJobID, time.Hour)
		if err != nil {
			t.Fatalf("minting worker token: %v", err)
		}

		expectedDigest := "sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"
		expectedRepo := "ghcr.io/summit-org/summit-app-api"
		expectedTag := "sha-8f3a21c"

		result := BuildExecutionResultPayload{
			SchemaVersion: 1,
			BuildID:       buildJobID.String(),
			Status:        "succeeded",
			Artifact: &ArtifactDetailsPayload{
				Repository: expectedRepo,
				Digest:     expectedDigest,
				Tag:        expectedTag,
				Platforms:  []string{"linux/amd64"},
				SizeBytes:  1048576,
			},
			Metadata: ResultMetadataPayload{
				Builder:         "summit-builder",
				RailpackVersion: "v0.43.0",
				BuildkitVersion: "v0.34.1",
				CommitSHA:       "8f3a21c",
			},
			Timestamps: ResultTimestampsPayload{
				StartedAt:   time.Now().Add(-time.Minute).UTC(),
				CompletedAt: time.Now().UTC(),
				DurationMS:  60000,
			},
		}
		body, _ := json.Marshal(result)

		req := httptest.NewRequest(http.MethodPost, "/internal/v1/builds/"+buildJobID.String()+"/result", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		handler.HandleResult(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}

		// Verify build_jobs row
		var jobStatus, digest, repo, tag, stage string
		err = pool.QueryRow(context.Background(),
			"SELECT status, oci_image_digest, image_repository, image_tag, COALESCE(current_stage, '') FROM build_jobs WHERE id = $1",
			buildJobID,
		).Scan(&jobStatus, &digest, &repo, &tag, &stage)
		if err != nil {
			t.Fatalf("querying build_jobs: %v", err)
		}
		if jobStatus != "succeeded" {
			t.Errorf("expected status succeeded, got %s", jobStatus)
		}
		if digest != expectedDigest {
			t.Errorf("expected digest %s, got %s", expectedDigest, digest)
		}
		if repo != expectedRepo {
			t.Errorf("expected repo %s, got %s", expectedRepo, repo)
		}
		if tag != expectedTag {
			t.Errorf("expected tag %s, got %s", expectedTag, tag)
		}

		// Verify duplicate result submission is idempotent
		recDup := httptest.NewRecorder()
		reqDup := httptest.NewRequest(http.MethodPost, "/internal/v1/builds/"+buildJobID.String()+"/result", bytes.NewReader(body))
		reqDup.Header.Set("Authorization", "Bearer "+token)
		handler.HandleResult(recDup, reqDup)
		if recDup.Code != http.StatusOK {
			t.Errorf("expected 200 on duplicate result, got %d", recDup.Code)
		}
	})

	t.Run("result failed persists structured error details", func(t *testing.T) {
		_, buildJobID := setupTestBuildJob(t, pool)
		token, err := workertoken.Mint(workerSecret, buildJobID, time.Hour)
		if err != nil {
			t.Fatalf("minting worker token: %v", err)
		}

		result := BuildExecutionResultPayload{
			SchemaVersion: 1,
			BuildID:       buildJobID.String(),
			Status:        "failed",
			Error: &ExecutionErrorPayload{
				Code:    "IMAGE_BUILD_FAILED",
				Stage:   "image_build",
				Message: "buildctl exit status 1",
				Details: "failed to solve: process returned error",
			},
			Timestamps: ResultTimestampsPayload{
				StartedAt:   time.Now().Add(-time.Minute).UTC(),
				CompletedAt: time.Now().UTC(),
				DurationMS:  60000,
			},
		}
		body, _ := json.Marshal(result)

		req := httptest.NewRequest(http.MethodPost, "/internal/v1/builds/"+buildJobID.String()+"/result", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		handler.HandleResult(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}

		var jobStatus, errorMsg, stage string
		err = pool.QueryRow(context.Background(),
			"SELECT status, error_message, COALESCE(current_stage, '') FROM build_jobs WHERE id = $1",
			buildJobID,
		).Scan(&jobStatus, &errorMsg, &stage)
		if err != nil {
			t.Fatalf("querying build_jobs: %v", err)
		}
		if jobStatus != "failed" {
			t.Errorf("expected status failed, got %s", jobStatus)
		}
		if errorMsg == "" {
			t.Errorf("expected non-empty error_message")
		}
	})
}
