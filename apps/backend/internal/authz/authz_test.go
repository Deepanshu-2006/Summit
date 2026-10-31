package authz

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

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

func TestServiceUser(t *testing.T) {
	serviceID := uuid.New()
	expectedUserID := uuid.New()
	querier := &mockDBQuerier{
		queryRowFunc: func(_ context.Context, _ string, args ...any) pgx.Row {
			if args[0] != serviceID {
				t.Fatalf("service ID arg = %v, want %v", args[0], serviceID)
			}
			return &mockRow{scanFunc: func(dest ...any) error {
				*dest[0].(*uuid.UUID) = expectedUserID
				return nil
			}}
		},
	}

	userID, err := ServiceUser(context.Background(), querier, serviceID)
	if err != nil {
		t.Fatalf("ServiceUser returned error: %v", err)
	}
	if userID != expectedUserID {
		t.Fatalf("ServiceUser = %s, want %s", userID, expectedUserID)
	}
}

func TestServiceUserNotFound(t *testing.T) {
	querier := &mockDBQuerier{
		queryRowFunc: func(_ context.Context, _ string, _ ...any) pgx.Row {
			return &mockRow{scanFunc: func(_ ...any) error { return pgx.ErrNoRows }}
		},
	}
	if _, err := ServiceUser(context.Background(), querier, uuid.New()); err != ErrServiceNotFound {
		t.Fatalf("ServiceUser error = %v, want %v", err, ErrServiceNotFound)
	}
}
