// Package auth provides authentication primitives for the Summit backend.
// It implements Supabase JWT verification and user principal extraction.
package auth

import (
	"context"

	"github.com/google/uuid"
)

// Principal represents an authenticated user extracted from a verified JWT.
type Principal struct {
	UserID uuid.UUID
	Email  string
	Name   string
	Claims map[string]interface{}
	// RawToken is stored for internal use but must never be logged.
	RawToken string
}

// Verifier validates a JWT token and returns the authenticated Principal.
type Verifier interface {
	Verify(ctx context.Context, token string) (Principal, error)
}

// Context key for storing the principal.
type contextKey string

const principalKey contextKey = "auth_principal"

// WithPrincipal returns a new context with the given Principal attached.
func WithPrincipal(ctx context.Context, p Principal) context.Context {
	return context.WithValue(ctx, principalKey, p)
}

// GetPrincipal returns the Principal from the context, if present.
func GetPrincipal(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(principalKey).(Principal)
	return p, ok
}
