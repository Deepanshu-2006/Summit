package githubworker

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/summit/backend/internal/audit"
	"github.com/summit/backend/internal/secrets"
	"github.com/summit/backend/internal/testutil"
)

func seedBuildJob(t *testing.T, pool *pgxpool.Pool, depID, sourceID, repoID uuid.UUID, commitSHA, status string) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := pool.QueryRow(context.Background(), `
		INSERT INTO build_jobs (
			deployment_id, service_source_id, repository_id, commit_sha, ref, status, builder_type
		) VALUES ($1, $2, $3, $4, 'refs/heads/main', $5, 'gvisor_rootless_buildkit')
		RETURNING id;
	`, depID, sourceID, repoID, commitSHA, status).Scan(&id)
	if err != nil {
		t.Fatalf("seeding build job: %v", err)
	}
	return id
}

func seedDeployment(t *testing.T, pool *pgxpool.Pool, projID, envID, svcID, sourceID uuid.UUID, commitSHA string) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	idempKey := "seed-dep-" + uuid.New().String()
	err := pool.QueryRow(context.Background(), `
		INSERT INTO deployments (
			project_id, environment_id, service_id, service_source_id, git_commit_sha, git_branch, status, trigger_type, idempotency_key
		) VALUES ($1, $2, $3, $4, $5, 'main', 'queued', 'github_push', $6)
		RETURNING id;
	`, projID, envID, svcID, sourceID, commitSHA, idempKey).Scan(&id)
	if err != nil {
		t.Fatalf("seeding deployment: %v", err)
	}
	return id
}

func TestBrokerHandler_Authentication(t *testing.T) {
	workerSecret := []byte("super-secret-worker-key-12345")
	secProvider := &mockSecretsProvider{
		secrets: map[string][]byte{
			secrets.PathWorkerJWTSecret: workerSecret,
		},
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := NewBrokerHandler(nil, nil, secProvider, nil, logger)

	t.Run("missing authorization header returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/internal/v1/build-requests/"+uuid.New().String()+"/source-token", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("malformed authorization scheme returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/internal/v1/build-requests/"+uuid.New().String()+"/source-token", nil)
		req.Header.Set("Authorization", "Basic dXNlcjpwYXNz")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("wrong bearer token returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/internal/v1/build-requests/"+uuid.New().String()+"/source-token", nil)
		req.Header.Set("Authorization", "Bearer invalid-token-value")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("valid direct shared secret passes auth", func(t *testing.T) {
		// Handler will fail at DB check (pool is nil) with 503, confirming auth succeeded
		req := httptest.NewRequest(http.MethodPost, "/internal/v1/build-requests/"+uuid.New().String()+"/source-token", nil)
		req.Header.Set("Authorization", "Bearer "+string(workerSecret))
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusServiceUnavailable {
			t.Errorf("expected 503 (database unavailable after auth pass), got %d", rec.Code)
		}
	})

	t.Run("valid HS256-signed JWT passes auth", func(t *testing.T) {
		jobID := uuid.New()
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": jobID.String(),
			"exp": time.Now().Add(10 * time.Minute).Unix(),
		})
		tokenString, err := token.SignedString(workerSecret)
		if err != nil {
			t.Fatalf("signing token: %v", err)
		}

		req := httptest.NewRequest(http.MethodPost, "/internal/v1/build-requests/"+jobID.String()+"/source-token", nil)
		req.Header.Set("Authorization", "Bearer "+tokenString)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusServiceUnavailable {
			t.Errorf("expected 503 (database unavailable after auth pass), got %d", rec.Code)
		}
	})

	t.Run("HS256-signed JWT scoped to another job returns 401", func(t *testing.T) {
		jobID := uuid.New()
		differentJobID := uuid.New()
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": differentJobID.String(),
			"exp": time.Now().Add(10 * time.Minute).Unix(),
		})
		tokenString, err := token.SignedString(workerSecret)
		if err != nil {
			t.Fatalf("signing token: %v", err)
		}

		req := httptest.NewRequest(http.MethodPost, "/internal/v1/build-requests/"+jobID.String()+"/source-token", nil)
		req.Header.Set("Authorization", "Bearer "+tokenString)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 for mismatched job scope, got %d", rec.Code)
		}
	})
}

func TestBrokerHandler_TokenMintingFlow(t *testing.T) {
	pool := testutil.NewDB(t)
	workerSecret := []byte("worker-secret-pass-789")
	secProvider := &mockSecretsProvider{
		secrets: map[string][]byte{
			secrets.PathWorkerJWTSecret: workerSecret,
		},
	}
	ghClient := newMockGitHubClient()
	auditWriter := &mockAuditWriter{}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	handler := NewBrokerHandler(pool, ghClient, secProvider, auditWriter, logger)

	owner := testutil.SeedUser(t, pool, "", "Broker Owner")
	instID := seedInstallation(t, pool, owner.ID, 8881, "active")
	repoID := seedRepository(t, pool, instID, 9991, "core-app", "acme/core-app")
	proj := testutil.SeedProject(t, pool, owner.ID, "Core Project", "")
	env := testutil.SeedEnvironment(t, pool, proj.ID, "prod", "production")
	svc := testutil.SeedService(t, pool, env.ID, "core-svc", "web")
	sourceID := seedServiceSource(t, pool, svc.ID, repoID, "main", ".", true, "active")

	commitSHA := "1234567890abcdef1234567890abcdef12345678"
	depID := seedDeployment(t, pool, proj.ID, env.ID, svc.ID, sourceID, commitSHA)
	buildJobID := seedBuildJob(t, pool, depID, sourceID, repoID, commitSHA, "queued")

	t.Run("successfully mints short-lived scoped token", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/internal/v1/build-requests/"+buildJobID.String()+"/source-token", nil)
		req.SetPathValue("build_request_id", buildJobID.String())
		req.Header.Set("Authorization", "Bearer "+string(workerSecret))
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d (body: %s)", rec.Code, rec.Body.String())
		}

		var resp SourceTokenResponse
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("decoding response: %v", err)
		}

		if resp.Token != "ghs_mock_token_for_inst_8881" {
			t.Errorf("expected token for inst 8881, got %s", resp.Token)
		}
		if resp.Repository.CloneURL != "https://github.com/acme/core-app.git" {
			t.Errorf("expected clone_url with .git suffix, got %s", resp.Repository.CloneURL)
		}
		if resp.Repository.CommitSHA != commitSHA {
			t.Errorf("expected commit_sha=%s, got %s", commitSHA, resp.Repository.CommitSHA)
		}
		if resp.ExpiresAt.IsZero() {
			t.Errorf("expected non-zero expires_at")
		}

		// Verify audit log
		events := auditWriter.Events()
		foundAudit := false
		for _, e := range events {
			if e.Action == audit.ActionWorkerTokenIssued && e.EntityID == buildJobID {
				foundAudit = true
				if e.UserID != owner.ID {
					t.Errorf("expected audit userID=%s, got %s", owner.ID, e.UserID)
				}
				// Verify token was not in audit metadata
				for k, v := range e.Metadata {
					if k == "token" || fmt.Sprintf("%v", v) == resp.Token {
						t.Errorf("SECURITY LEAK: token found in audit metadata!")
					}
				}
			}
		}
		if !foundAudit {
			t.Errorf("expected ActionWorkerTokenIssued audit event")
		}
	})

	t.Run("non-existent build request returns 404", func(t *testing.T) {
		randomUUID := uuid.New()
		req := httptest.NewRequest(http.MethodPost, "/internal/v1/build-requests/"+randomUUID.String()+"/source-token", nil)
		req.SetPathValue("build_request_id", randomUUID.String())
		req.Header.Set("Authorization", "Bearer "+string(workerSecret))
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d", rec.Code)
		}
	})

	t.Run("ineligible build job status returns 409", func(t *testing.T) {
		completedDepID := seedDeployment(t, pool, proj.ID, env.ID, svc.ID, sourceID, commitSHA)
		completedJobID := seedBuildJob(t, pool, completedDepID, sourceID, repoID, commitSHA, "succeeded")
		req := httptest.NewRequest(http.MethodPost, "/internal/v1/build-requests/"+completedJobID.String()+"/source-token", nil)
		req.SetPathValue("build_request_id", completedJobID.String())
		req.Header.Set("Authorization", "Bearer "+string(workerSecret))
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusConflict {
			t.Errorf("expected 409 Conflict for succeeded build, got %d", rec.Code)
		}
	})

	t.Run("suspended installation blocks token minting with 403", func(t *testing.T) {
		suspInstID := seedInstallation(t, pool, owner.ID, 8882, "suspended")
		suspRepoID := seedRepository(t, pool, suspInstID, 9992, "susp-app", "acme/susp-app")
		suspSvc := testutil.SeedService(t, pool, env.ID, "susp-svc", "web")
		suspSourceID := seedServiceSource(t, pool, suspSvc.ID, suspRepoID, "main", ".", true, "active")
		suspDepID := seedDeployment(t, pool, proj.ID, env.ID, suspSvc.ID, suspSourceID, commitSHA)
		suspJobID := seedBuildJob(t, pool, suspDepID, suspSourceID, suspRepoID, commitSHA, "queued")

		req := httptest.NewRequest(http.MethodPost, "/internal/v1/build-requests/"+suspJobID.String()+"/source-token", nil)
		req.SetPathValue("build_request_id", suspJobID.String())
		req.Header.Set("Authorization", "Bearer "+string(workerSecret))
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusForbidden {
			t.Errorf("expected 403 Forbidden for suspended installation, got %d", rec.Code)
		}
	})

	t.Run("removed repository blocks token minting with 403", func(t *testing.T) {
		remRepoID := seedRepository(t, pool, instID, 9993, "rem-app", "acme/rem-app")
		_, _ = pool.Exec(context.Background(), "UPDATE github_repositories SET removed_at = now() WHERE id = $1", remRepoID)

		remSvc := testutil.SeedService(t, pool, env.ID, "rem-svc", "web")
		remSourceID := seedServiceSource(t, pool, remSvc.ID, remRepoID, "main", ".", true, "active")
		remDepID := seedDeployment(t, pool, proj.ID, env.ID, remSvc.ID, remSourceID, commitSHA)
		remJobID := seedBuildJob(t, pool, remDepID, remSourceID, remRepoID, commitSHA, "queued")

		req := httptest.NewRequest(http.MethodPost, "/internal/v1/build-requests/"+remJobID.String()+"/source-token", nil)
		req.SetPathValue("build_request_id", remJobID.String())
		req.Header.Set("Authorization", "Bearer "+string(workerSecret))
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusForbidden {
			t.Errorf("expected 403 Forbidden for removed repository, got %d", rec.Code)
		}
	})
}
