package authz

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	ErrNotOwner        = errors.New("user does not own this resource")
	ErrServiceNotFound = errors.New("service not found")
)

// DBQuerier executes a single row query.
type DBQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// ServiceUser resolves the personal user that owns a service through its
// environment and project hierarchy.
func ServiceUser(ctx context.Context, q DBQuerier, serviceID uuid.UUID) (uuid.UUID, error) {
	if q == nil {
		return uuid.Nil, errors.New("nil database querier")
	}

	const query = `
		SELECT p.user_id
		FROM services s
		JOIN environments e ON e.id = s.environment_id
		JOIN projects p ON p.id = e.project_id
		WHERE s.id = $1
		  AND s.deleted_at IS NULL
		  AND e.deleted_at IS NULL
		  AND p.deleted_at IS NULL
	`
	var userID uuid.UUID
	err := q.QueryRow(ctx, query, serviceID).Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, ErrServiceNotFound
		}
		return uuid.Nil, fmt.Errorf("resolving owner for service %s: %w", serviceID, err)
	}
	return userID, nil
}
