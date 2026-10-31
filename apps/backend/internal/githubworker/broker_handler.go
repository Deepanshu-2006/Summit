package githubworker

import (
	"crypto/subtle"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/summit/backend/internal/audit"
	"github.com/summit/backend/internal/httpx"
	"github.com/summit/backend/internal/secrets"
)

// BrokerHandler implements the Worker Credential Broker endpoint:
// POST /internal/v1/build-requests/{build_request_id}/source-token
// It authenticates worker requests using WORKER_JWT_SECRET, validates the build request
// eligibility, confirms installation status is active, and mints a short-lived repository-scoped
// installation token for build checkout.
// The minted token is NEVER logged, stored in DB, or leaked in errors.
type BrokerHandler struct {
	pool        *pgxpool.Pool
	ghClient    GitHubClient
	secrets     secrets.Provider
	auditWriter audit.Writer
	logger      *slog.Logger
}

// NewBrokerHandler constructs a new BrokerHandler.
func NewBrokerHandler(pool *pgxpool.Pool, ghClient GitHubClient, secProvider secrets.Provider, auditWriter audit.Writer, logger *slog.Logger) *BrokerHandler {
	if logger == nil {
		logger = slog.Default()
	}
	return &BrokerHandler{
		pool:        pool,
		ghClient:    ghClient,
		secrets:     secProvider,
		auditWriter: auditWriter,
		logger:      logger,
	}
}

// SourceTokenResponse defines the JSON schema returned to the build worker.
type SourceTokenResponse struct {
	Token      string          `json:"token"`
	ExpiresAt  time.Time       `json:"expires_at"`
	Repository SourceTokenRepo `json:"repository"`
}

// SourceTokenRepo contains repository metadata required for worker checkout.
type SourceTokenRepo struct {
	CloneURL  string `json:"clone_url"`
	CommitSHA string `json:"commit_sha"`
}

func (h *BrokerHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httpx.WriteError(w, r, http.StatusMethodNotAllowed, httpx.CodeBadRequest, "method not allowed")
		return
	}

	// 1. Extract and parse build_request_id (which corresponds to build_jobs.id)
	buildRequestIDStr := r.PathValue("build_request_id")
	if buildRequestIDStr == "" {
		// Fallback for custom routing: extract from URL path
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		for i, p := range parts {
			if (p == "build-requests" || p == "build_requests") && i+1 < len(parts) {
				buildRequestIDStr = parts[i+1]
				break
			}
		}
	}

	buildJobID, err := uuid.Parse(buildRequestIDStr)
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "invalid build_request_id")
		return
	}

	// 2. Authenticate worker using bearer token / WORKER_JWT_SECRET and verify job scope
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "missing or malformed authorization header")
		return
	}
	bearerToken := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	if bearerToken == "" {
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "empty bearer token")
		return
	}

	if h.secrets == nil {
		h.logger.Error("secrets provider is nil in credential broker")
		httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, "worker secrets not configured")
		return
	}

	workerSecret, err := h.secrets.Get(r.Context(), secrets.PathWorkerJWTSecret)
	if err != nil {
		h.logger.Error("failed to retrieve worker secret", "error", err)
		httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, "worker secret not configured")
		return
	}

	if !authenticateWorkerToken(bearerToken, workerSecret, buildJobID) {
		h.logger.Warn("worker authentication failed", "remote_addr", r.RemoteAddr, "build_job_id", buildJobID)
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "invalid worker credentials")
		return
	}

	if h.pool == nil {
		h.logger.Error("database pool is nil in credential broker")
		httpx.WriteError(w, r, http.StatusServiceUnavailable, httpx.CodeInternalError, "database unavailable")
		return
	}

	// 3. Lookup build job joined with service_source, github_repositories, and github_installations
	lookupQuery := `
		SELECT
			bj.id,
			COALESCE(bj.commit_sha, ''),
			bj.status,
			gr.github_repository_id,
			gr.full_name,
			COALESCE(gr.html_url, ''),
			gr.removed_at,
			gi.github_installation_id,
			gi.status AS inst_status,
			gi.organization_id
		FROM build_jobs bj
		JOIN service_sources ss ON bj.service_source_id = ss.id
		JOIN github_repositories gr ON ss.repository_id = gr.id
		JOIN github_installations gi ON gr.installation_id = gi.id
		WHERE bj.id = $1;
	`

	var (
		jobID                uuid.UUID
		commitSHA            string
		jobStatus            string
		githubRepoID         int64
		repoFullName         string
		htmlURL              string
		removedAt            *time.Time
		githubInstallationID int64
		instStatus           string
		orgID                uuid.UUID
	)

	err = h.pool.QueryRow(r.Context(), lookupQuery, buildJobID).Scan(
		&jobID,
		&commitSHA,
		&jobStatus,
		&githubRepoID,
		&repoFullName,
		&htmlURL,
		&removedAt,
		&githubInstallationID,
		&instStatus,
		&orgID,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.WriteError(w, r, http.StatusNotFound, httpx.CodeNotFound, "build request not found")
		return
	} else if err != nil {
		h.logger.Error("database query failed looking up build request", "error", err)
		httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, "database error")
		return
	}

	// 4. Verify build request eligibility
	if jobStatus != "queued" && jobStatus != "dispatched" && jobStatus != "running" {
		httpx.WriteError(w, r, http.StatusConflict, httpx.CodeConflict, fmt.Sprintf("build request is not in an eligible state: %s", jobStatus))
		return
	}

	// 5. Verify installation is active (not suspended, revoked, disconnected, error)
	if instStatus != "active" {
		httpx.WriteError(w, r, http.StatusForbidden, httpx.CodeForbidden, fmt.Sprintf("github installation is %s", instStatus))
		return
	}

	// 6. Verify repository is not removed
	if removedAt != nil {
		httpx.WriteError(w, r, http.StatusForbidden, httpx.CodeForbidden, "github repository has been removed from installation")
		return
	}

	if commitSHA == "" {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "build request does not specify a commit sha")
		return
	}

	if h.ghClient == nil {
		h.logger.Error("github client is nil in credential broker")
		httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, "github client not configured")
		return
	}

	// 7. Mint scoped short-lived token via GitHub App client (read-only contents permission)
	tokenObj, err := h.ghClient.CreateInstallationToken(
		r.Context(),
		githubInstallationID,
		[]int64{githubRepoID},
		map[string]string{"contents": "read"},
	)
	if err != nil {
		// Securely log failure without leaking credentials
		h.logger.Error("failed to mint scoped installation token for worker",
			"build_job_id", buildJobID,
			"installation_id", githubInstallationID,
			"repository_id", githubRepoID,
			"error", err,
		)
		httpx.WriteError(w, r, http.StatusBadGateway, httpx.CodeGitHubAPIUnavailable, "failed to mint installation token from GitHub")
		return
	}

	// 8. Compute clone URL
	cloneURL := htmlURL
	if cloneURL == "" {
		cloneURL = fmt.Sprintf("https://github.com/%s", repoFullName)
	}
	if !strings.HasSuffix(cloneURL, ".git") {
		cloneURL += ".git"
	}

	// 9. Audit token issuance (Token itself is NEVER logged or stored)
	if h.auditWriter != nil {
		_ = h.auditWriter.Write(r.Context(), audit.Event{
			OrganizationID: orgID,
			ActorUserID:    nil, // machine worker actor
			Action:         audit.ActionWorkerTokenIssued,
			EntityType:     "build_job",
			EntityID:       buildJobID,
			Metadata: map[string]any{
				"github_repository_id":   githubRepoID,
				"github_installation_id": githubInstallationID,
				"commit_sha":             commitSHA,
			},
			CreatedAt: time.Now().UTC(),
		})
	}

	// 10. Return token and checkout metadata to worker
	httpx.WriteJSON(w, http.StatusOK, SourceTokenResponse{
		Token:     tokenObj.Token,
		ExpiresAt: tokenObj.ExpiresAt,
		Repository: SourceTokenRepo{
			CloneURL:  cloneURL,
			CommitSHA: commitSHA,
		},
	})
}

// authenticateWorkerToken validates a bearer token against WORKER_JWT_SECRET.
// Supports both direct shared secret comparison and scoped HS256-signed JWT tokens.
// If a JWT token specifies a subject or job_id claim, it MUST match expectedJobID.
func authenticateWorkerToken(token string, secret []byte, expectedJobID uuid.UUID) bool {
	if len(token) == 0 || len(secret) == 0 {
		return false
	}

	// 1. Check if token is a valid HS256 JWT signed with secret
	parsedToken, err := jwt.Parse(token, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing algorithm: %v", t.Header["alg"])
		}
		return secret, nil
	}, jwt.WithExpirationRequired())

	if err == nil && parsedToken.Valid {
		if claims, ok := parsedToken.Claims.(jwt.MapClaims); ok {
			// Enforce job scoping if specified in token claims
			if sub, err := claims.GetSubject(); err == nil && sub != "" {
				if parsedSub, err := uuid.Parse(sub); err == nil {
					if parsedSub != expectedJobID {
						return false // Token is scoped to another job!
					}
				}
			}
			if jobClaim, ok := claims["job_id"].(string); ok && jobClaim != "" {
				if parsedJob, err := uuid.Parse(jobClaim); err == nil {
					if parsedJob != expectedJobID {
						return false // Token is scoped to another job!
					}
				}
			}
			return true
		}
	}

	// 2. Fallback check for direct shared secret match
	return subtle.ConstantTimeCompare([]byte(token), secret) == 1
}
