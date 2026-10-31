package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/summit/backend/internal/httpx"
	"github.com/summit/backend/internal/platformdb"
	"github.com/summit/backend/internal/secrets"
	"github.com/summit/backend/internal/workertoken"
)

var sha256DigestRegex = regexp.MustCompile(`^sha256:[0-9a-fA-F]{64}$`)

// StatusUpdatePayload represents builder status updates received via callback.
type StatusUpdatePayload struct {
	BuildID   string    `json:"build_id"`
	AttemptID string    `json:"attempt_id"`
	Sequence  int       `json:"sequence"`
	Stage     string    `json:"stage"`
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
	Message   string    `json:"message,omitempty"`
}

// LogEventPayload represents a single structured log line sent by the builder.
type LogEventPayload struct {
	BuildID   string    `json:"build_id"`
	AttemptID string    `json:"attempt_id"`
	Sequence  int       `json:"sequence"`
	Timestamp time.Time `json:"timestamp"`
	Stream    string    `json:"stream"`
	Stage     string    `json:"stage"`
	Severity  string    `json:"severity"`
	Message   string    `json:"message"`
}

// ArtifactDetailsPayload represents image artifact details in the result.
type ArtifactDetailsPayload struct {
	Repository string   `json:"repository"`
	Digest     string   `json:"digest"`
	Tag        string   `json:"tag"`
	Platforms  []string `json:"platforms"`
	SizeBytes  int64    `json:"size_bytes,omitempty"`
}

// ResultMetadataPayload contains execution metadata from the builder.
type ResultMetadataPayload struct {
	Builder         string `json:"builder"`
	RailpackVersion string `json:"railpack_version"`
	BuildkitVersion string `json:"buildkit_version"`
	CommitSHA       string `json:"commit_sha"`
	DetectedRuntime string `json:"detected_runtime,omitempty"`
}

// ResultTimestampsPayload records timing info for the build execution.
type ResultTimestampsPayload struct {
	StartedAt   time.Time `json:"started_at"`
	CompletedAt time.Time `json:"completed_at"`
	DurationMS  int64     `json:"duration_ms"`
}

// ExecutionErrorPayload contains structured error details for failed/cancelled builds.
type ExecutionErrorPayload struct {
	Code    string `json:"code"`
	Stage   string `json:"stage"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// BuildExecutionResultPayload represents the final execution outcome.
type BuildExecutionResultPayload struct {
	SchemaVersion int                     `json:"schema_version"`
	BuildID       string                  `json:"build_id"`
	AttemptID     string                  `json:"attempt_id"`
	Status        string                  `json:"status"` // succeeded | failed | cancelled
	Artifact      *ArtifactDetailsPayload `json:"artifact,omitempty"`
	Metadata      ResultMetadataPayload   `json:"metadata"`
	Error         *ExecutionErrorPayload  `json:"error,omitempty"`
	Timestamps    ResultTimestampsPayload `json:"timestamps"`
}

// BuildCallbackHandler handles status, log, and terminal result callbacks from builder workers (contract C6).
type BuildCallbackHandler struct {
	pool    *pgxpool.Pool
	secrets secrets.Provider
	logger  *slog.Logger
}

// NewBuildCallbackHandler constructs a new callback handler.
func NewBuildCallbackHandler(pool *pgxpool.Pool, secretsProvider secrets.Provider, logger *slog.Logger) *BuildCallbackHandler {
	if logger == nil {
		logger = slog.Default()
	}
	return &BuildCallbackHandler{
		pool:    pool,
		secrets: secretsProvider,
		logger:  logger,
	}
}

// RegisterBuildCallbackRoutes mounts the builder callback routes onto the provided mux.
func RegisterBuildCallbackRoutes(mux *http.ServeMux, deps Dependencies) {
	if mux == nil {
		return
	}
	handler := NewBuildCallbackHandler(deps.Pool, deps.Secrets, deps.Logger)
	handler.RegisterRoutes(mux)
}

// RegisterRoutes registers the builder callback routes on the mux.
func (h *BuildCallbackHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /internal/v1/builds/{build_id}/status", h.HandleStatus)
	mux.HandleFunc("POST /internal/v1/builds/{build_id}/logs", h.HandleLogs)
	mux.HandleFunc("POST /internal/v1/builds/{build_id}/result", h.HandleResult)
}

func extractBuildID(r *http.Request) (uuid.UUID, error) {
	buildIDStr := r.PathValue("build_id")
	if buildIDStr == "" {
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) >= 4 && parts[0] == "internal" && parts[1] == "v1" && parts[2] == "builds" {
			buildIDStr = parts[3]
		}
	}
	if buildIDStr == "" {
		return uuid.Nil, errors.New("missing build_id")
	}
	id, err := uuid.Parse(buildIDStr)
	if err != nil || id == uuid.Nil {
		return uuid.Nil, fmt.Errorf("invalid build_id %q: %w", buildIDStr, err)
	}
	return id, nil
}

func (h *BuildCallbackHandler) authenticate(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	buildID, err := extractBuildID(r)
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "invalid build_id path parameter")
		return uuid.Nil, false
	}

	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "missing or malformed authorization header")
		return uuid.Nil, false
	}
	token := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	if token == "" {
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "empty bearer token")
		return uuid.Nil, false
	}

	if h.secrets == nil {
		h.logger.Error("secrets provider is nil in build callback handler")
		httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, "secrets provider unavailable")
		return uuid.Nil, false
	}

	workerSecret, err := h.secrets.Get(r.Context(), secrets.PathWorkerJWTSecret)
	if err != nil {
		h.logger.Error("failed to retrieve worker jwt secret", "error", err)
		httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, "worker secret unavailable")
		return uuid.Nil, false
	}

	if err := workertoken.Verify(token, workerSecret, buildID); err != nil {
		h.logger.Warn("worker token verification failed", "error", err, "build_id", buildID, "remote_addr", r.RemoteAddr)
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "invalid worker token")
		return uuid.Nil, false
	}

	if h.pool == nil {
		h.logger.Error("database pool is nil in build callback handler")
		httpx.WriteError(w, r, http.StatusServiceUnavailable, httpx.CodeInternalError, "database unavailable")
		return uuid.Nil, false
	}

	return buildID, true
}

// HandleStatus processes status update events from the builder.
func (h *BuildCallbackHandler) HandleStatus(w http.ResponseWriter, r *http.Request) {
	buildID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	var body StatusUpdatePayload
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "invalid json payload")
		return
	}

	event := platformdb.BuildStatusEvent{
		Sequence:   body.Sequence,
		Stage:      body.Stage,
		Status:     body.Status,
		Message:    body.Message,
		ReportedAt: body.Timestamp,
	}

	store := platformdb.New(h.pool)
	applied, err := store.RecordBuildStatus(r.Context(), buildID, event)
	if err != nil {
		if errors.Is(err, platformdb.ErrNotFound) {
			httpx.WriteError(w, r, http.StatusNotFound, httpx.CodeNotFound, "build job not found")
			return
		}
		if errors.Is(err, platformdb.ErrInvalidArgument) {
			httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, err.Error())
			return
		}
		h.logger.Error("failed to record build status", "build_id", buildID, "error", err)
		httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, "failed to record build status")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"applied":  applied,
		"build_id": buildID,
		"sequence": body.Sequence,
	})
}

// HandleLogs processes batches of log events from the builder.
func (h *BuildCallbackHandler) HandleLogs(w http.ResponseWriter, r *http.Request) {
	buildID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	var batch []LogEventPayload
	if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "invalid json payload")
		return
	}

	if len(batch) == 0 {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"inserted": 0})
		return
	}

	lines := make([]platformdb.LogLine, len(batch))
	for i, item := range batch {
		lines[i] = platformdb.LogLine{
			Sequence: int64(item.Sequence),
			Stream:   item.Stream,
			Level:    item.Severity,
			Stage:    item.Stage,
			Message:  item.Message,
			LoggedAt: item.Timestamp,
		}
	}

	store := platformdb.New(h.pool)
	inserted, err := store.AppendBuildLogs(r.Context(), buildID, lines)
	if err != nil {
		if errors.Is(err, platformdb.ErrNotFound) {
			httpx.WriteError(w, r, http.StatusNotFound, httpx.CodeNotFound, "build job not found")
			return
		}
		if errors.Is(err, platformdb.ErrInvalidArgument) {
			httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, err.Error())
			return
		}
		h.logger.Error("failed to append build logs", "build_id", buildID, "error", err)
		httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, "failed to append build logs")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"inserted": inserted,
		"build_id": buildID,
	})
}

// HandleResult processes the terminal build result reported by the builder.
func (h *BuildCallbackHandler) HandleResult(w http.ResponseWriter, r *http.Request) {
	buildID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	var body BuildExecutionResultPayload
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "invalid json payload")
		return
	}

	if body.SchemaVersion != 1 {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "schema_version must be 1")
		return
	}

	var res platformdb.BuildResult
	switch strings.ToLower(body.Status) {
	case string(platformdb.BuildSucceeded):
		res.Status = platformdb.BuildSucceeded
		if body.Artifact == nil || strings.TrimSpace(body.Artifact.Digest) == "" {
			httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "succeeded build requires artifact digest")
			return
		}
		if !sha256DigestRegex.MatchString(body.Artifact.Digest) {
			httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "digest must be sha256:<64 hex>")
			return
		}
		if strings.TrimSpace(body.Artifact.Repository) == "" {
			httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "succeeded build requires artifact repository")
			return
		}
		res.ImageRepository = body.Artifact.Repository
		res.ImageTag = body.Artifact.Tag
		res.Digest = body.Artifact.Digest
	case string(platformdb.BuildFailed):
		res.Status = platformdb.BuildFailed
		if body.Error != nil {
			if body.Error.Message != "" {
				res.ErrorMessage = body.Error.Message
			} else {
				res.ErrorMessage = body.Error.Code
			}
		}
	case string(platformdb.BuildCancelled):
		res.Status = platformdb.BuildCancelled
		if body.Error != nil {
			res.ErrorMessage = body.Error.Message
		}
	default:
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "unsupported result status")
		return
	}

	store := platformdb.New(h.pool)
	job, applied, err := store.RecordBuildResult(r.Context(), buildID, res)
	if err != nil {
		if errors.Is(err, platformdb.ErrNotFound) {
			httpx.WriteError(w, r, http.StatusNotFound, httpx.CodeNotFound, "build job not found")
			return
		}
		if errors.Is(err, platformdb.ErrConflict) {
			httpx.WriteError(w, r, http.StatusConflict, httpx.CodeConflict, err.Error())
			return
		}
		if errors.Is(err, platformdb.ErrInvalidArgument) {
			httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, err.Error())
			return
		}
		h.logger.Error("failed to record build result", "build_id", buildID, "error", err)
		httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, "failed to record build result")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"applied":  applied,
		"build_id": buildID,
		"status":   job.Status,
	})
}
