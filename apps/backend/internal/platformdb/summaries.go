package platformdb

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// This file holds the batched, user-scoped read helpers behind the dashboard
// list endpoints. Each takes a set of ids and issues exactly one query, so
// list handlers stay free of N+1 lookups.

// ServiceSourceInfo is the display view of a service's GitHub source.
type ServiceSourceInfo struct {
	ServiceID          uuid.UUID
	RepositoryFullName string
	Branch             string
	RootDirectory      string
	SourceStatus       string // active | disconnected | blocked
	AutoDeploy         bool
}

// GetProjectForUser returns the user's non-deleted project by id.
func (s *Store) GetProjectForUser(ctx context.Context, userID, projectID uuid.UUID) (*Project, error) {
	p, err := scanProject(s.db.QueryRow(ctx, `
		SELECT `+projectCols+` FROM projects p
		WHERE p.id = $1 AND p.user_id = $2 AND p.deleted_at IS NULL`, projectID, userID))
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}
	return p, nil
}

// CountServicesByProject returns the number of live services per project for
// the given projects owned by userID. Projects with no services (or not
// visible to the user) are absent from the map.
func (s *Store) CountServicesByProject(ctx context.Context, userID uuid.UUID, projectIDs []uuid.UUID) (map[uuid.UUID]int, error) {
	out := make(map[uuid.UUID]int, len(projectIDs))
	if len(projectIDs) == 0 {
		return out, nil
	}
	rows, err := s.db.Query(ctx, `
		SELECT e.project_id, count(*)
		FROM services sv
		JOIN environments e ON e.id = sv.environment_id
		JOIN projects p ON p.id = e.project_id
		WHERE e.project_id = ANY($1::uuid[]) AND p.user_id = $2
		  AND sv.deleted_at IS NULL AND e.deleted_at IS NULL AND p.deleted_at IS NULL
		GROUP BY e.project_id`, projectIDs, userID)
	if err != nil {
		return nil, fmt.Errorf("platformdb: count services: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var id uuid.UUID
		var n int
		if err := rows.Scan(&id, &n); err != nil {
			return nil, fmt.Errorf("platformdb: scan service count: %w", err)
		}
		out[id] = n
	}
	return out, rows.Err()
}

// LatestDeploymentsByProject returns the most recent deployment (by
// created_at, id) of each given project owned by userID. Projects without
// deployments are absent from the map.
func (s *Store) LatestDeploymentsByProject(ctx context.Context, userID uuid.UUID, projectIDs []uuid.UUID) (map[uuid.UUID]Deployment, error) {
	out := make(map[uuid.UUID]Deployment, len(projectIDs))
	if len(projectIDs) == 0 {
		return out, nil
	}
	rows, err := s.db.Query(ctx, `
		SELECT DISTINCT ON (d.project_id) `+deploymentCols+`
		FROM deployments d
		JOIN projects p ON p.id = d.project_id
		WHERE d.project_id = ANY($1::uuid[]) AND p.user_id = $2 AND p.deleted_at IS NULL
		ORDER BY d.project_id, d.created_at DESC, d.id DESC`, projectIDs, userID)
	if err != nil {
		return nil, fmt.Errorf("platformdb: latest deployments by project: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		d, err := scanDeployment(rows)
		if err != nil {
			return nil, fmt.Errorf("platformdb: scan deployment: %w", err)
		}
		out[d.ProjectID] = *d
	}
	return out, rows.Err()
}

// LatestDeploymentsByService returns the most recent deployment of each given
// service owned by userID. Services without deployments are absent.
func (s *Store) LatestDeploymentsByService(ctx context.Context, userID uuid.UUID, serviceIDs []uuid.UUID) (map[uuid.UUID]Deployment, error) {
	out := make(map[uuid.UUID]Deployment, len(serviceIDs))
	if len(serviceIDs) == 0 {
		return out, nil
	}
	rows, err := s.db.Query(ctx, `
		SELECT DISTINCT ON (d.service_id) `+deploymentCols+`
		FROM deployments d
		JOIN projects p ON p.id = d.project_id
		WHERE d.service_id = ANY($1::uuid[]) AND p.user_id = $2 AND p.deleted_at IS NULL
		ORDER BY d.service_id, d.created_at DESC, d.id DESC`, serviceIDs, userID)
	if err != nil {
		return nil, fmt.Errorf("platformdb: latest deployments by service: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		d, err := scanDeployment(rows)
		if err != nil {
			return nil, fmt.Errorf("platformdb: scan deployment: %w", err)
		}
		if d.ServiceID != nil {
			out[*d.ServiceID] = *d
		}
	}
	return out, rows.Err()
}

// ServiceSourcesByService returns the GitHub source (if any) of each given
// service owned by userID. Services without a source row are absent.
func (s *Store) ServiceSourcesByService(ctx context.Context, userID uuid.UUID, serviceIDs []uuid.UUID) (map[uuid.UUID]ServiceSourceInfo, error) {
	out := make(map[uuid.UUID]ServiceSourceInfo, len(serviceIDs))
	if len(serviceIDs) == 0 {
		return out, nil
	}
	rows, err := s.db.Query(ctx, `
		SELECT ss.service_id, r.full_name, ss.branch, ss.root_directory, ss.source_status, ss.auto_deploy
		FROM service_sources ss
		JOIN github_repositories r ON r.id = ss.repository_id
		JOIN services sv ON sv.id = ss.service_id
		JOIN environments e ON e.id = sv.environment_id
		JOIN projects p ON p.id = e.project_id
		WHERE ss.service_id = ANY($1::uuid[]) AND p.user_id = $2
		  AND sv.deleted_at IS NULL AND e.deleted_at IS NULL AND p.deleted_at IS NULL`, serviceIDs, userID)
	if err != nil {
		return nil, fmt.Errorf("platformdb: service sources: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var si ServiceSourceInfo
		if err := rows.Scan(&si.ServiceID, &si.RepositoryFullName, &si.Branch, &si.RootDirectory, &si.SourceStatus, &si.AutoDeploy); err != nil {
			return nil, fmt.Errorf("platformdb: scan service source: %w", err)
		}
		out[si.ServiceID] = si
	}
	return out, rows.Err()
}
