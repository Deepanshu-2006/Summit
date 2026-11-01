package projectsapi

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

// Handler exposes the projects/deployments routes.
type Handler struct {
	svc      *Service
	verifier auth.Verifier
	db       auth.DBExecutor
	logger   *slog.Logger
}

// NewHandler builds a Handler. db is used by the auth middleware to upsert the
// caller's user row and may be nil.
func NewHandler(svc *Service, verifier auth.Verifier, db auth.DBExecutor, logger *slog.Logger) *Handler {
	if logger == nil {
		logger = slog.Default()
	}
	return &Handler{svc: svc, verifier: verifier, db: db, logger: logger}
}

// RegisterRoutes registers all routes onto mux. Every route requires a valid
// Supabase bearer token.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	requireAuth := func(next http.HandlerFunc) http.Handler {
		if h.verifier == nil {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "auth verifier not configured")
			})
		}
		return auth.RequireUser(h.verifier, h.db)(next)
	}

	mux.Handle("GET /v1/projects", requireAuth(h.listProjects))
	mux.Handle("POST /v1/projects", requireAuth(h.createProject))
	mux.Handle("GET /v1/projects/{project_id}", requireAuth(h.getProject))
	mux.Handle("PATCH /v1/projects/{project_id}", requireAuth(h.updateProject))
	mux.Handle("DELETE /v1/projects/{project_id}", requireAuth(h.deleteProject))
	mux.Handle("POST /v1/projects/{project_id}/services", requireAuth(h.createService))
	mux.Handle("POST /v1/projects/{project_id}/environments", requireAuth(h.createEnvironment))
	mux.Handle("DELETE /v1/services/{service_id}", requireAuth(h.deleteService))
	mux.Handle("GET /v1/projects/{project_id}/deployments", requireAuth(h.listDeployments))
	mux.Handle("GET /v1/deployments/{deployment_id}", requireAuth(h.getDeployment))
	mux.Handle("POST /v1/deployments/{deployment_id}/cancel", requireAuth(h.cancelDeployment))
	mux.Handle("GET /v1/deployments/{deployment_id}/logs", requireAuth(h.listLogs))
}

func (h *Handler) listProjects(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	lp, ok := listParams(w, r)
	if !ok {
		return
	}
	res, err := h.svc.ListProjects(r.Context(), userID, lp)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) createProject(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	var req CreateProjectRequest
	if !decodeBody(w, r, &req) {
		return
	}
	res, err := h.svc.CreateProject(r.Context(), userID, req)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, res)
}

func (h *Handler) getProject(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	id, ok := pathUUID(w, r, "project_id")
	if !ok {
		return
	}
	res, err := h.svc.GetProject(r.Context(), userID, id)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) updateProject(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	id, ok := pathUUID(w, r, "project_id")
	if !ok {
		return
	}
	var req UpdateProjectRequest
	if !decodeBody(w, r, &req) {
		return
	}
	res, err := h.svc.UpdateProject(r.Context(), userID, id, req)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) deleteProject(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	id, ok := pathUUID(w, r, "project_id")
	if !ok {
		return
	}
	if err := h.svc.DeleteProject(r.Context(), userID, id); err != nil {
		h.writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) createService(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	id, ok := pathUUID(w, r, "project_id")
	if !ok {
		return
	}
	var req CreateServiceRequest
	if !decodeBody(w, r, &req) {
		return
	}
	res, err := h.svc.CreateService(r.Context(), userID, id, req)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, res)
}

func (h *Handler) createEnvironment(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	id, ok := pathUUID(w, r, "project_id")
	if !ok {
		return
	}
	var req CreateEnvironmentRequest
	if !decodeBody(w, r, &req) {
		return
	}
	res, err := h.svc.CreateEnvironment(r.Context(), userID, id, req)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, res)
}

func (h *Handler) deleteService(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	id, ok := pathUUID(w, r, "service_id")
	if !ok {
		return
	}
	if err := h.svc.DeleteService(r.Context(), userID, id); err != nil {
		h.writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) listDeployments(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	id, ok := pathUUID(w, r, "project_id")
	if !ok {
		return
	}
	lp, ok := listParams(w, r)
	if !ok {
		return
	}
	res, err := h.svc.ListDeployments(r.Context(), userID, id, lp)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) getDeployment(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	id, ok := pathUUID(w, r, "deployment_id")
	if !ok {
		return
	}
	res, err := h.svc.GetDeployment(r.Context(), userID, id)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) cancelDeployment(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	id, ok := pathUUID(w, r, "deployment_id")
	if !ok {
		return
	}
	res, err := h.svc.CancelDeployment(r.Context(), userID, id)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) listLogs(w http.ResponseWriter, r *http.Request) {
	userID, ok := principalID(w, r)
	if !ok {
		return
	}
	id, ok := pathUUID(w, r, "deployment_id")
	if !ok {
		return
	}
	q := r.URL.Query()
	var after int64
	if v := q.Get("after"); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil || n < 0 {
			httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "after must be a non-negative integer")
			return
		}
		after = n
	}
	limit, ok := queryLimit(w, r)
	if !ok {
		return
	}
	res, err := h.svc.ListLogs(r.Context(), userID, id, after, limit)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

// ---------------------------------------------------------------------------
// helpers
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

// writeError maps store errors to the standard envelope. Unknown errors are
// logged and reported as an opaque 500.
func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, platformdb.ErrNotFound):
		httpx.WriteError(w, r, http.StatusNotFound, httpx.CodeNotFound, "resource not found")
	case errors.Is(err, platformdb.ErrInvalidArgument):
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeValidationFailed, cleanMessage(err, "platformdb: invalid argument: "))
	case errors.Is(err, platformdb.ErrConflict):
		httpx.WriteError(w, r, http.StatusConflict, httpx.CodeConflict, cleanMessage(err, "platformdb: conflict: "))
	case errors.Is(err, platformdb.ErrInvalidTransition):
		httpx.WriteError(w, r, http.StatusConflict, httpx.CodeConflict, "deployment is not in a state that allows this action")
	default:
		h.logger.ErrorContext(r.Context(), "projectsapi request failed",
			"method", r.Method, "path", r.URL.Path, "request_id", httpx.GetRequestID(r.Context()), "error", err)
		httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, "internal server error")
	}
}

func cleanMessage(err error, prefix string) string {
	return strings.TrimPrefix(err.Error(), prefix)
}
