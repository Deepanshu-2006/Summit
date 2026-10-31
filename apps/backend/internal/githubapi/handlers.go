package githubapi

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/auth"
	"github.com/summit/backend/internal/authz"
	"github.com/summit/backend/internal/httpx"
)

// ServiceAPI defines the business service operations consumed by Handler.
type ServiceAPI interface {
	StartInstallation(ctx context.Context, userID uuid.UUID, ip, userAgent, reqID string) (*StartInstallationResponse, error)
	HandleCallback(ctx context.Context, rawInstallationID, rawState, setupAction, ip, userAgent, reqID string) (string, error)
	ListInstallations(ctx context.Context, userID uuid.UUID) (*ListInstallationsResponse, error)
	GetInstallation(ctx context.Context, userID uuid.UUID, installationIDStr string) (*InstallationDetailResponse, error)
	DisconnectInstallation(ctx context.Context, userID uuid.UUID, installationIDStr string, ip, userAgent, reqID string) (*DisconnectInstallationResponse, error)
	ListRepositories(ctx context.Context, userID uuid.UUID, installationIDStr, cursor string, limit int) (*ListRepositoriesResponse, error)
	SyncInstallation(ctx context.Context, userID uuid.UUID, installationIDStr string, ip, userAgent, reqID string) (*SyncResponse, error)
	PutServiceSource(ctx context.Context, serviceID, actorUserID uuid.UUID, req PutServiceSourceRequest, ip, userAgent, reqID string) (*ServiceSourceResponse, error)
	GetServiceSource(ctx context.Context, serviceID uuid.UUID) (*ServiceSourceResponse, error)
	PatchServiceSource(ctx context.Context, serviceID, actorUserID uuid.UUID, req PatchServiceSourceRequest, ip, userAgent, reqID string) (*ServiceSourceResponse, error)
	DisconnectServiceSource(ctx context.Context, serviceID, actorUserID uuid.UUID, ip, userAgent, reqID string) (*DisconnectSourceResponse, error)
	CreateManualDeployment(ctx context.Context, serviceID, actorUserID uuid.UUID, idempotencyKey string, req ManualDeploymentRequest, ip, userAgent, reqID string) (*ManualDeploymentResponse, error)
}

// Handler handles HTTP requests for GitHub integration.
type Handler struct {
	svc      ServiceAPI
	verifier auth.Verifier
	pool     Pool
}

// NewHandler creates a new Handler instance.
func NewHandler(svc ServiceAPI, verifier auth.Verifier, pool Pool) *Handler {
	return &Handler{
		svc:      svc,
		verifier: verifier,
		pool:     pool,
	}
}

// RegisterRoutes registers all GitHub integration routes onto an http.ServeMux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	requireAuth := func(next http.HandlerFunc) http.Handler {
		if h.verifier == nil {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "auth verifier not configured")
			})
		}
		var dbExec auth.DBExecutor
		if h.pool != nil {
			dbExec = h.pool
		}
		return auth.RequireUser(h.verifier, dbExec)(next)
	}

	// 1. POST /v1/github/installations
	mux.Handle("POST /v1/github/installations",
		requireAuth(h.handleStartInstallation))

	// 2. GET /v1/integrations/github/callback (Browser redirect, unauthenticated at HTTP bearer layer)
	mux.HandleFunc("GET /v1/integrations/github/callback", h.handleCallback)

	// 3. GET /v1/github/installations
	mux.Handle("GET /v1/github/installations",
		requireAuth(h.handleListInstallations))

	// 4. GET /v1/github/installations/{installation_id}
	mux.Handle("GET /v1/github/installations/{installation_id}",
		requireAuth(h.handleGetInstallation))

	// 5. DELETE /v1/github/installations/{installation_id}
	mux.Handle("DELETE /v1/github/installations/{installation_id}",
		requireAuth(h.handleDisconnectInstallation))

	// 6. GET /v1/github/installations/{installation_id}/repositories
	mux.Handle("GET /v1/github/installations/{installation_id}/repositories",
		requireAuth(h.handleListRepositories))

	// 7. POST /v1/github/installations/{installation_id}/sync
	mux.Handle("POST /v1/github/installations/{installation_id}/sync",
		requireAuth(h.handleSyncInstallation))

	// 8. Service Source endpoints:
	// PUT /v1/services/{service_id}/source
	mux.Handle("PUT /v1/services/{service_id}/source",
		requireAuth(h.handlePutServiceSource))

	// GET /v1/services/{service_id}/source
	mux.Handle("GET /v1/services/{service_id}/source",
		requireAuth(h.handleGetServiceSource))

	// PATCH /v1/services/{service_id}/source
	mux.Handle("PATCH /v1/services/{service_id}/source",
		requireAuth(h.handlePatchServiceSource))

	// DELETE /v1/services/{service_id}/source
	mux.Handle("DELETE /v1/services/{service_id}/source",
		requireAuth(h.handleDisconnectServiceSource))

	// POST /v1/services/{service_id}/deployments
	mux.Handle("POST /v1/services/{service_id}/deployments",
		requireAuth(h.handleManualDeployment))
}

// 1. POST /v1/github/installations
func (h *Handler) handleStartInstallation(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.GetPrincipal(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "unauthenticated")
		return
	}

	ip := extractClientIP(r.RemoteAddr)
	res, err := h.svc.StartInstallation(r.Context(), principal.UserID, ip, r.UserAgent(), httpx.GetRequestID(r.Context()))
	if err != nil {
		handleError(w, r, err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, res)
}

// 2. GET /v1/integrations/github/callback
func (h *Handler) handleCallback(w http.ResponseWriter, r *http.Request) {
	installationID := r.URL.Query().Get("installation_id")
	state := r.URL.Query().Get("state")
	setupAction := r.URL.Query().Get("setup_action")

	ip := extractClientIP(r.RemoteAddr)
	redirectURL, err := h.svc.HandleCallback(r.Context(), installationID, state, setupAction, ip, r.UserAgent(), httpx.GetRequestID(r.Context()))
	if err != nil {
		handleError(w, r, err)
		return
	}

	http.Redirect(w, r, redirectURL, http.StatusFound)
}

// 3. GET /v1/github/installations
func (h *Handler) handleListInstallations(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.GetPrincipal(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "unauthenticated")
		return
	}

	res, err := h.svc.ListInstallations(r.Context(), principal.UserID)
	if err != nil {
		handleError(w, r, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

// 4. GET /v1/github/installations/{installation_id}
func (h *Handler) handleGetInstallation(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.GetPrincipal(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "unauthenticated")
		return
	}

	instIDStr := r.PathValue("installation_id")
	if instIDStr == "" {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "missing installation_id parameter")
		return
	}

	res, err := h.svc.GetInstallation(r.Context(), principal.UserID, instIDStr)
	if err != nil {
		handleError(w, r, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

// 5. DELETE /v1/github/installations/{installation_id}
func (h *Handler) handleDisconnectInstallation(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.GetPrincipal(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "unauthenticated")
		return
	}

	instIDStr := r.PathValue("installation_id")
	if instIDStr == "" {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "missing installation_id parameter")
		return
	}

	ip := extractClientIP(r.RemoteAddr)
	res, err := h.svc.DisconnectInstallation(r.Context(), principal.UserID, instIDStr, ip, r.UserAgent(), httpx.GetRequestID(r.Context()))
	if err != nil {
		handleError(w, r, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

// 6. GET /v1/github/installations/{installation_id}/repositories
func (h *Handler) handleListRepositories(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.GetPrincipal(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "unauthenticated")
		return
	}

	instIDStr := r.PathValue("installation_id")
	if instIDStr == "" {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "missing installation_id parameter")
		return
	}

	cursor := r.URL.Query().Get("cursor")
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	res, err := h.svc.ListRepositories(r.Context(), principal.UserID, instIDStr, cursor, limit)
	if err != nil {
		handleError(w, r, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

// 7. POST /v1/github/installations/{installation_id}/sync
func (h *Handler) handleSyncInstallation(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.GetPrincipal(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "unauthenticated")
		return
	}

	instIDStr := r.PathValue("installation_id")
	if instIDStr == "" {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "missing installation_id parameter")
		return
	}

	ip := extractClientIP(r.RemoteAddr)
	res, err := h.svc.SyncInstallation(r.Context(), principal.UserID, instIDStr, ip, r.UserAgent(), httpx.GetRequestID(r.Context()))
	if err != nil {
		handleError(w, r, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

// 8a. PUT /v1/services/{service_id}/source
func (h *Handler) handlePutServiceSource(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.GetPrincipal(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "unauthenticated")
		return
	}

	serviceID, err := parseUUIDParam(r, "service_id")
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "invalid service UUID")
		return
	}

	if err := h.checkServiceOwnership(r, serviceID, principal.UserID); err != nil {
		handleAuthzError(w, r, err)
		return
	}

	var req PutServiceSourceRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "invalid request body: "+err.Error())
		return
	}

	ip := extractClientIP(r.RemoteAddr)
	res, err := h.svc.PutServiceSource(r.Context(), serviceID, principal.UserID, req, ip, r.UserAgent(), httpx.GetRequestID(r.Context()))
	if err != nil {
		handleError(w, r, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

// 8b. GET /v1/services/{service_id}/source
func (h *Handler) handleGetServiceSource(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.GetPrincipal(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "unauthenticated")
		return
	}

	serviceID, err := parseUUIDParam(r, "service_id")
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "invalid service UUID")
		return
	}

	// Reading source configuration requires ownership of the service.
	if err := h.checkServiceOwnership(r, serviceID, principal.UserID); err != nil {
		handleAuthzError(w, r, err)
		return
	}

	res, err := h.svc.GetServiceSource(r.Context(), serviceID)
	if err != nil {
		handleError(w, r, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

// 8c. PATCH /v1/services/{service_id}/source
func (h *Handler) handlePatchServiceSource(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.GetPrincipal(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "unauthenticated")
		return
	}

	serviceID, err := parseUUIDParam(r, "service_id")
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "invalid service UUID")
		return
	}

	if err := h.checkServiceOwnership(r, serviceID, principal.UserID); err != nil {
		handleAuthzError(w, r, err)
		return
	}

	var req PatchServiceSourceRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "invalid request body: "+err.Error())
		return
	}

	ip := extractClientIP(r.RemoteAddr)
	res, err := h.svc.PatchServiceSource(r.Context(), serviceID, principal.UserID, req, ip, r.UserAgent(), httpx.GetRequestID(r.Context()))
	if err != nil {
		handleError(w, r, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

// 8d. DELETE /v1/services/{service_id}/source
func (h *Handler) handleDisconnectServiceSource(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.GetPrincipal(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "unauthenticated")
		return
	}

	serviceID, err := parseUUIDParam(r, "service_id")
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "invalid service UUID")
		return
	}

	if err := h.checkServiceOwnership(r, serviceID, principal.UserID); err != nil {
		handleAuthzError(w, r, err)
		return
	}

	ip := extractClientIP(r.RemoteAddr)
	res, err := h.svc.DisconnectServiceSource(r.Context(), serviceID, principal.UserID, ip, r.UserAgent(), httpx.GetRequestID(r.Context()))
	if err != nil {
		handleError(w, r, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

// 8e. POST /v1/services/{service_id}/deployments
func (h *Handler) handleManualDeployment(w http.ResponseWriter, r *http.Request) {
	principal, ok := auth.GetPrincipal(r.Context())
	if !ok {
		httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "unauthenticated")
		return
	}

	serviceID, err := parseUUIDParam(r, "service_id")
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "invalid service UUID")
		return
	}

	if err := h.checkServiceOwnership(r, serviceID, principal.UserID); err != nil {
		handleAuthzError(w, r, err)
		return
	}

	var req ManualDeploymentRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "invalid request body: "+err.Error())
		return
	}

	idempotencyKey := r.Header.Get("Idempotency-Key")

	ip := extractClientIP(r.RemoteAddr)
	res, err := h.svc.CreateManualDeployment(r.Context(), serviceID, principal.UserID, idempotencyKey, req, ip, r.UserAgent(), httpx.GetRequestID(r.Context()))
	if err != nil {
		handleError(w, r, err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, res)
}

func (h *Handler) checkServiceOwnership(r *http.Request, serviceID, userID uuid.UUID) error {
	ownerID, err := authz.ServiceUser(r.Context(), h.pool, serviceID)
	if err != nil {
		return err
	}
	if ownerID != userID {
		return authz.ErrNotOwner
	}
	return nil
}

func parseUUIDParam(r *http.Request, param string) (uuid.UUID, error) {
	str := r.PathValue(param)
	if str == "" {
		str = r.URL.Query().Get(param)
	}
	if str == "" {
		return uuid.Nil, fmt.Errorf("missing parameter %q", param)
	}
	return uuid.Parse(str)
}

func extractClientIP(remoteAddr string) string {
	if host, _, err := net.SplitHostPort(remoteAddr); err == nil {
		return host
	}
	return remoteAddr
}

func handleAuthzError(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(err, authz.ErrNotOwner) || errors.Is(err, authz.ErrServiceNotFound) {
		httpx.WriteError(w, r, http.StatusNotFound, httpx.CodeNotFound, "resource not found")
		return
	}
	httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, "failed to verify resource ownership: "+err.Error())
}

func handleError(w http.ResponseWriter, r *http.Request, err error) {
	var apiErr *httpx.APIError
	if errors.As(err, &apiErr) {
		httpx.WriteAPIError(w, r, apiErr)
		return
	}
	httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, err.Error())
}
