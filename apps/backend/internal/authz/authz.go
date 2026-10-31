package authz

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/summit/backend/internal/auth"
	"github.com/summit/backend/internal/httpx"
)

// Role represents an organization membership role.
type Role string

const (
	RoleOwner  Role = "owner"
	RoleAdmin  Role = "admin"
	RoleMember Role = "member"
	RoleViewer Role = "viewer"
)

// Permission represents an action permitted within an organization.
type Permission string

const (
	PermInstallApp       Permission = "install_app"       // Install GitHub App / link installation
	PermListRepos        Permission = "list_repos"        // List repositories
	PermConnectSource    Permission = "connect_source"    // Connect / update source
	PermDisconnectSource Permission = "disconnect_source" // Disconnect source
)

// HasPermission checks if the role possesses the given permission per spec section 3.3.
func (r Role) HasPermission(p Permission) bool {
	switch r {
	case RoleOwner, RoleAdmin:
		return true

	case RoleMember:
		switch p {
		case PermListRepos, PermConnectSource, PermDisconnectSource:
			return true
		default:
			return false
		}

	case RoleViewer:
		return p == PermListRepos

	default:
		return false
	}
}

// Membership represents an organization membership record.
type Membership struct {
	ID             uuid.UUID `json:"id"`
	OrganizationID uuid.UUID `json:"organization_id"`
	UserID         uuid.UUID `json:"user_id"`
	Role           Role      `json:"role"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// Errors
var (
	ErrNotMember       = errors.New("user is not a member of this organization")
	ErrServiceNotFound = errors.New("service not found")
)

// DBQuerier executes a single row query.
type DBQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// Context keys
type contextKey string

const membershipKey contextKey = "authz_membership"

// WithMembership returns a new context with the given Membership attached.
func WithMembership(ctx context.Context, m *Membership) context.Context {
	return context.WithValue(ctx, membershipKey, m)
}

// GetMembership returns the Membership from the context, if present.
func GetMembership(ctx context.Context) (*Membership, bool) {
	m, ok := ctx.Value(membershipKey).(*Membership)
	return m, ok
}

// MembershipFor resolves the user's membership and role in an organization.
func MembershipFor(ctx context.Context, q DBQuerier, orgID, userID uuid.UUID) (*Membership, error) {
	if q == nil {
		return nil, errors.New("nil database querier")
	}

	query := `
		SELECT id, organization_id, user_id, role, created_at, updated_at
		FROM organization_memberships
		WHERE organization_id = $1 AND user_id = $2
	`
	var m Membership
	var roleStr string
	err := q.QueryRow(ctx, query, orgID, userID).Scan(
		&m.ID,
		&m.OrganizationID,
		&m.UserID,
		&roleStr,
		&m.CreatedAt,
		&m.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotMember
		}
		return nil, fmt.Errorf("querying membership for org %s, user %s: %w", orgID, userID, err)
	}
	m.Role = Role(roleStr)
	return &m, nil
}

// ServiceOrganization resolves the organization ID that owns a service hierarchy.
// Hierarchy: service -> environment -> project -> organization.
func ServiceOrganization(ctx context.Context, q DBQuerier, serviceID uuid.UUID) (uuid.UUID, error) {
	if q == nil {
		return uuid.Nil, errors.New("nil database querier")
	}

	query := `
		SELECT p.organization_id
		FROM services s
		JOIN environments e ON e.id = s.environment_id
		JOIN projects p ON p.id = e.project_id
		WHERE s.id = $1
		  AND s.deleted_at IS NULL
		  AND e.deleted_at IS NULL
		  AND p.deleted_at IS NULL
	`
	var orgID uuid.UUID
	err := q.QueryRow(ctx, query, serviceID).Scan(&orgID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, ErrServiceNotFound
		}
		return uuid.Nil, fmt.Errorf("resolving organization for service %s: %w", serviceID, err)
	}
	return orgID, nil
}

// RequireOrgPermission returns middleware that extracts the organization ID from the URL path parameter,
// verifies the authenticated user's membership and role against the required permission.
func RequireOrgPermission(pathParam string, permission Permission, q DBQuerier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			principal, ok := auth.GetPrincipal(r.Context())
			if !ok {
				httpx.WriteError(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "unauthenticated")
				return
			}

			orgIDStr := r.PathValue(pathParam)
			if orgIDStr == "" {
				orgIDStr = r.URL.Query().Get(pathParam)
			}
			if orgIDStr == "" {
				httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, fmt.Sprintf("missing path parameter %q", pathParam))
				return
			}

			orgID, err := uuid.Parse(orgIDStr)
			if err != nil {
				httpx.WriteError(w, r, http.StatusBadRequest, httpx.CodeBadRequest, "invalid organization UUID")
				return
			}

			membership, err := MembershipFor(r.Context(), q, orgID, principal.UserID)
			if err != nil {
				if errors.Is(err, ErrNotMember) {
					httpx.WriteError(w, r, http.StatusForbidden, httpx.CodeForbidden, "user is not a member of this organization")
					return
				}
				httpx.WriteError(w, r, http.StatusInternalServerError, httpx.CodeInternalError, "failed to verify organization membership")
				return
			}

			if !membership.Role.HasPermission(permission) {
				httpx.WriteError(w, r, http.StatusForbidden, httpx.CodeForbidden, fmt.Sprintf("insufficient permissions: role %q lacks permission %q", membership.Role, permission))
				return
			}

			ctx := WithMembership(r.Context(), membership)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
