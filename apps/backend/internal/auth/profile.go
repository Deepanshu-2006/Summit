package auth

import (
	"net/http"

	"github.com/summit/backend/internal/httpx"
)

// ProfileSyncHandler authenticates the request and upserts its user profile
// before returning success. The upsert itself is performed by RequireUser.
func ProfileSyncHandler(verifier Verifier, db DBExecutor) http.Handler {
	if verifier == nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			httpx.WriteError(w, r, http.StatusServiceUnavailable, httpx.CodeInternalError, "authentication is not configured")
		})
	}
	if db == nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			httpx.WriteError(w, r, http.StatusServiceUnavailable, httpx.CodeInternalError, "profile storage is unavailable")
		})
	}

	return RequireUser(verifier, db)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
}
