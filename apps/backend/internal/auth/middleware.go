package auth

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/summit/backend/internal/httpx"
)

// RequireUser returns HTTP middleware that validates the Supabase Bearer token,
// ensures the user record exists via UpsertUser, and attaches the Principal to the request context.
func RequireUser(verifier Verifier, db DBExecutor) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "missing authorization header")
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || strings.TrimSpace(parts[1]) == "" {
				httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "invalid authorization header format")
				return
			}

			tokenStr := strings.TrimSpace(parts[1])
			principal, err := verifier.Verify(r.Context(), tokenStr)
			if err != nil {
				httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "invalid authentication token: "+err.Error())
				return
			}

			if db != nil {
				if err := UpsertUser(r.Context(), db, principal); err != nil {
					slog.ErrorContext(r.Context(), "failed to upsert user profile from claims",
						"user_id", principal.UserID.String(),
						"error", err,
					)
					httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, "failed to initialize authenticated user")
					return
				}
			}

			ctx := WithPrincipal(r.Context(), principal)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
