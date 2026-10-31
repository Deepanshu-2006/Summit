package authz

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/summit/backend/internal/auth"
)

func TestRole_HasPermission(t *testing.T) {
	matrix := []struct {
		role Role
		perm Permission
		want bool
	}{
		// Owner
		{RoleOwner, PermInstallApp, true},
		{RoleOwner, PermListRepos, true},
		{RoleOwner, PermConnectSource, true},
		{RoleOwner, PermDisconnectSource, true},

		// Admin
		{RoleAdmin, PermInstallApp, true},
		{RoleAdmin, PermListRepos, true},
		{RoleAdmin, PermConnectSource, true},
		{RoleAdmin, PermDisconnectSource, true},

		// Member
		{RoleMember, PermInstallApp, false},
		{RoleMember, PermListRepos, true},
		{RoleMember, PermConnectSource, true},
		{RoleMember, PermDisconnectSource, true},

		// Viewer
		{RoleViewer, PermInstallApp, false},
		{RoleViewer, PermListRepos, true},
		{RoleViewer, PermConnectSource, false},
		{RoleViewer, PermDisconnectSource, false},

		// Unknown
		{Role("unknown"), PermListRepos, false},
	}

	for _, tc := range matrix {
		got := tc.role.HasPermission(tc.perm)
		if got != tc.want {
			t.Errorf("role %s.HasPermission(%s) = %v, want %v", tc.role, tc.perm, got, tc.want)
		}
	}
}

type mockRow struct {
	scanFunc func(dest ...any) error
}

func (m *mockRow) Scan(dest ...any) error {
	return m.scanFunc(dest...)
}

type mockDBQuerier struct {
	queryRowFunc func(ctx context.Context, sql string, args ...any) pgx.Row
}

func (m *mockDBQuerier) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return m.queryRowFunc(ctx, sql, args...)
}

func TestMembershipFor(t *testing.T) {
	orgID := uuid.New()
	userID := uuid.New()
	memID := uuid.New()
	now := time.Now()

	// 1. Found
	qFound := &mockDBQuerier{
		queryRowFunc: func(_ context.Context, _ string, _ ...any) pgx.Row {
			return &mockRow{
				scanFunc: func(dest ...any) error {
					*dest[0].(*uuid.UUID) = memID
					*dest[1].(*uuid.UUID) = orgID
					*dest[2].(*uuid.UUID) = userID
					*dest[3].(*string) = "admin"
					*dest[4].(*time.Time) = now
					*dest[5].(*time.Time) = now
					return nil
				},
			}
		},
	}

	mem, err := MembershipFor(context.Background(), qFound, orgID, userID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if mem.Role != RoleAdmin {
		t.Errorf("expected role admin, got %s", mem.Role)
	}

	// 2. Not found
	qNotFound := &mockDBQuerier{
		queryRowFunc: func(_ context.Context, _ string, _ ...any) pgx.Row {
			return &mockRow{
				scanFunc: func(_ ...any) error {
					return pgx.ErrNoRows
				},
			}
		},
	}

	_, err = MembershipFor(context.Background(), qNotFound, orgID, userID)
	if err != ErrNotMember {
		t.Errorf("expected ErrNotMember, got %v", err)
	}
}

func TestServiceOrganization(t *testing.T) {
	serviceID := uuid.New()
	expectedOrgID := uuid.New()

	q := &mockDBQuerier{
		queryRowFunc: func(_ context.Context, _ string, args ...any) pgx.Row {
			return &mockRow{
				scanFunc: func(dest ...any) error {
					if args[0] == serviceID {
						*dest[0].(*uuid.UUID) = expectedOrgID
						return nil
					}
					return pgx.ErrNoRows
				},
			}
		},
	}

	orgID, err := ServiceOrganization(context.Background(), q, serviceID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if orgID != expectedOrgID {
		t.Errorf("expected %s, got %s", expectedOrgID, orgID)
	}

	_, err = ServiceOrganization(context.Background(), q, uuid.New())
	if err != ErrServiceNotFound {
		t.Errorf("expected ErrServiceNotFound, got %v", err)
	}
}

func TestRequireOrgPermission_Middleware(t *testing.T) {
	orgID := uuid.New()
	userID := uuid.New()
	memID := uuid.New()
	now := time.Now()

	createQuerier := func(role Role, exists bool) *mockDBQuerier {
		return &mockDBQuerier{
			queryRowFunc: func(_ context.Context, _ string, _ ...any) pgx.Row {
				return &mockRow{
					scanFunc: func(dest ...any) error {
						if !exists {
							return pgx.ErrNoRows
						}
						*dest[0].(*uuid.UUID) = memID
						*dest[1].(*uuid.UUID) = orgID
						*dest[2].(*uuid.UUID) = userID
						*dest[3].(*string) = string(role)
						*dest[4].(*time.Time) = now
						*dest[5].(*time.Time) = now
						return nil
					},
				}
			},
		}
	}

	tests := []struct {
		name          string
		authenticated bool
		pathParamVal  string
		role          Role
		exists        bool
		perm          Permission
		wantStatus    int
	}{
		{
			name:          "Unauthenticated",
			authenticated: false,
			pathParamVal:  orgID.String(),
			wantStatus:    http.StatusUnauthorized,
		},
		{
			name:          "Missing path param",
			authenticated: true,
			pathParamVal:  "",
			wantStatus:    http.StatusBadRequest,
		},
		{
			name:          "Invalid UUID",
			authenticated: true,
			pathParamVal:  "not-a-uuid",
			wantStatus:    http.StatusBadRequest,
		},
		{
			name:          "User not a member",
			authenticated: true,
			pathParamVal:  orgID.String(),
			exists:        false,
			wantStatus:    http.StatusForbidden,
		},
		{
			name:          "Member lacks install_app",
			authenticated: true,
			pathParamVal:  orgID.String(),
			role:          RoleMember,
			exists:        true,
			perm:          PermInstallApp,
			wantStatus:    http.StatusForbidden,
		},
		{
			name:          "Member has connect_source",
			authenticated: true,
			pathParamVal:  orgID.String(),
			role:          RoleMember,
			exists:        true,
			perm:          PermConnectSource,
			wantStatus:    http.StatusOK,
		},
		{
			name:          "Owner has install_app",
			authenticated: true,
			pathParamVal:  orgID.String(),
			role:          RoleOwner,
			exists:        true,
			perm:          PermInstallApp,
			wantStatus:    http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := createQuerier(tt.role, tt.exists)
			mw := RequireOrgPermission("orgId", tt.perm, q)

			called := false
			handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				called = true
				mem, ok := GetMembership(r.Context())
				if !ok || mem.Role != tt.role {
					t.Errorf("unexpected membership in context: %+v", mem)
				}
				w.WriteHeader(http.StatusOK)
			}))

			req := httptest.NewRequest(http.MethodGet, "/organizations/"+tt.pathParamVal, nil)
			if tt.pathParamVal != "" {
				req.SetPathValue("orgId", tt.pathParamVal)
			}
			if tt.authenticated {
				req = req.WithContext(auth.WithPrincipal(req.Context(), auth.Principal{
					UserID: userID,
					Email:  "user@example.com",
				}))
			}

			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", rec.Code, tt.wantStatus)
			}
			if tt.wantStatus == http.StatusOK && !called {
				t.Error("expected inner handler to be called")
			}
		})
	}
}
