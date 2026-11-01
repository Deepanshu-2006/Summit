package agentsapi

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/auth"
	"github.com/summit/backend/internal/httpx"
	"github.com/summit/backend/internal/platformdb"
)

// Handler exposes the managed agents HTTP routes.
type Handler struct {
	svc      *Service
	verifier auth.Verifier
	db       auth.DBExecutor
	logger   *slog.Logger
}

// NewHandler creates a new Handler.
func NewHandler(svc *Service, verifier auth.Verifier, db auth.DBExecutor, logger *slog.Logger) *Handler {
	if logger == nil {
		logger = slog.Default()
	}
	return &Handler{svc: svc, verifier: verifier, db: db, logger: logger}
}

// RegisterRoutes registers all managed agent routes on mux.
// Routes are registered under both /api/v1/... (spec paths) and /v1/... (repo proxy paths).
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	requireAuth := func(next http.HandlerFunc) http.Handler {
		if h.verifier == nil {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "auth verifier not configured")
			})
		}
		return auth.RequireUser(h.verifier, h.db)(next)
	}

	routes := []struct {
		pattern string
		handler http.HandlerFunc
	}{
		{"POST /api/v1/projects/{slug}/agents", h.createAgent},
		{"GET /api/v1/projects/{slug}/agents", h.listAgents},
		{"GET /api/v1/agents/{agent_id}", h.getAgent},
		{"GET /api/v1/agents/{agent_id}/revisions", h.listRevisions},
		{"POST /api/v1/agents/{agent_id}/revisions", h.createRevision},
		{"POST /api/v1/agents/{agent_id}/deployments", h.createDeployment},
		{"GET /api/v1/agents/{agent_id}/deployments", h.listDeployments},
		{"GET /api/v1/agent-deployments/{deployment_id}", h.getDeployment},
		{"GET /api/v1/agent-deployments/{deployment_id}/sessions", h.listSessions},
		{"POST /api/v1/agent-deployments/{deployment_id}/sessions", h.createSession},
		{"GET /api/v1/agent-sessions/{session_id}", h.getSession},
	}

	for _, rt := range routes {
		mux.Handle(rt.pattern, requireAuth(rt.handler))
		// Register /v1 alias by stripping "/api"
		alias := strings.Replace(rt.pattern, "/api/v1/", "/v1/", 1)
		mux.Handle(alias, requireAuth(rt.handler))
	}
}

func (h *Handler) createAgent(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	slug := r.PathValue("slug")
	if strings.TrimSpace(slug) == "" {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "missing project slug")
		return
	}
	idempotencyKey := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if idempotencyKey == "" {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeValidationFailed, "Idempotency-Key header is required")
		return
	}
	var req CreateAgentRequest
	if !decodeBody(w, r, &req) {
		return
	}
	res, created, err := h.svc.CreateAgent(r.Context(), userID, slug, idempotencyKey, req)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	if created {
		httpx.WriteJSON(w, http.StatusCreated, res)
	} else {
		httpx.WriteJSON(w, http.StatusOK, res)
	}
}

func (h *Handler) listAgents(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	slug := r.PathValue("slug")
	if strings.TrimSpace(slug) == "" {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "missing project slug")
		return
	}
	lp, ok := listParams(w, r)
	if !ok {
		return
	}
	res, err := h.svc.ListAgents(r.Context(), userID, slug, lp)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) getAgent(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	agentID, ok := pathUUID(w, r, "agent_id")
	if !ok {
		return
	}
	res, err := h.svc.GetAgent(r.Context(), userID, agentID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) listRevisions(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	agentID, ok := pathUUID(w, r, "agent_id")
	if !ok {
		return
	}
	res, err := h.svc.ListRevisions(r.Context(), userID, agentID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) createRevision(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	agentID, ok := pathUUID(w, r, "agent_id")
	if !ok {
		return
	}
	idempotencyKey := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if idempotencyKey == "" {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeValidationFailed, "Idempotency-Key header is required")
		return
	}
	var req CreateRevisionRequest
	if !decodeBody(w, r, &req) {
		return
	}
	res, created, err := h.svc.CreateRevision(r.Context(), userID, agentID, idempotencyKey, req)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	if created {
		httpx.WriteJSON(w, http.StatusCreated, res)
	} else {
		httpx.WriteJSON(w, http.StatusOK, res)
	}
}

func (h *Handler) createDeployment(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	agentID, ok := pathUUID(w, r, "agent_id")
	if !ok {
		return
	}
	idempotencyKey := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if idempotencyKey == "" {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeValidationFailed, "Idempotency-Key header is required")
		return
	}
	var req CreateDeploymentRequest
	if !decodeBody(w, r, &req) {
		return
	}
	res, created, err := h.svc.CreateDeployment(r.Context(), userID, agentID, idempotencyKey, req)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	w.Header().Set("Location", "/api/v1/agent-deployments/"+res.ID.String())
	if created {
		httpx.WriteJSON(w, http.StatusAccepted, res)
	} else {
		httpx.WriteJSON(w, http.StatusOK, res)
	}
}

func (h *Handler) getDeployment(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	depID, ok := pathUUID(w, r, "deployment_id")
	if !ok {
		return
	}
	res, err := h.svc.GetDeployment(r.Context(), userID, depID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) listDeployments(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	agentID, ok := pathUUID(w, r, "agent_id")
	if !ok {
		return
	}
	res, err := h.svc.ListDeployments(r.Context(), userID, agentID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) listSessions(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	depID, ok := pathUUID(w, r, "deployment_id")
	if !ok {
		return
	}
	res, err := h.svc.ListSessions(r.Context(), userID, depID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) createSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	depID, ok := pathUUID(w, r, "deployment_id")
	if !ok {
		return
	}
	idempotencyKey := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if idempotencyKey == "" {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeValidationFailed, "Idempotency-Key header is required")
		return
	}
	var req CreateSessionRequest
	if r.ContentLength > 0 {
		if !decodeBody(w, r, &req) {
			return
		}
	}
	res, created, err := h.svc.CreateSession(r.Context(), userID, depID, idempotencyKey, req)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	w.Header().Set("Location", "/api/v1/agent-sessions/"+res.ID.String())
	if created {
		httpx.WriteJSON(w, http.StatusAccepted, res)
	} else {
		httpx.WriteJSON(w, http.StatusOK, res)
	}
}

func (h *Handler) getSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	sessionID, ok := pathUUID(w, r, "session_id")
	if !ok {
		return
	}
	res, err := h.svc.GetSession(r.Context(), userID, sessionID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func principalID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	p, ok := auth.GetPrincipal(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "unauthenticated")
		return uuid.Nil, false
	}
	return p.UserID, true
}

func pathUUID(w http.ResponseWriter, r *http.Request, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(r.PathValue(name))
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "invalid "+name)
		return uuid.Nil, false
	}
	return id, true
}

func decodeBody(w http.ResponseWriter, r *http.Request, dst any) bool {
	if err := httpx.DecodeJSON(r, dst); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "invalid request body: "+err.Error())
		return false
	}
	return true
}

func queryLimit(w http.ResponseWriter, r *http.Request) (int, bool) {
	v := r.URL.Query().Get("limit")
	if v == "" {
		return 0, true
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 0 {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "limit must be a non-negative integer")
		return 0, false
	}
	return n, true
}

func listParams(w http.ResponseWriter, r *http.Request) (platformdb.ListParams, bool) {
	limit, ok := queryLimit(w, r)
	if !ok {
		return platformdb.ListParams{}, false
	}
	return platformdb.ListParams{Limit: limit, Cursor: r.URL.Query().Get("cursor")}, true
}

func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, platformdb.ErrNotFound):
		httpx.WriteError(w, r, http.StatusNotFound, httpx.CodeNotFound, "resource not found")
	case errors.Is(err, platformdb.ErrInvalidArgument):
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeValidationFailed, cleanMessage(err, "platformdb: invalid argument: "))
	case errors.Is(err, platformdb.ErrConflict):
		httpx.WriteError(w, r, http.StatusConflict, httpx.CodeConflict, cleanMessage(err, "platformdb: conflict: "))
	default:
		h.logger.ErrorContext(r.Context(), "agentsapi request failed",
			"method", r.Method, "path", r.URL.Path, "request_id", httpx.GetRequestID(r.Context()), "error", err)
		httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, "internal server error")
	}
}

func cleanMessage(err error, prefix string) string {
	msg := err.Error()
	if idx := strings.Index(msg, prefix); idx >= 0 {
		return msg[idx+len(prefix):]
	}
	return msg
}
