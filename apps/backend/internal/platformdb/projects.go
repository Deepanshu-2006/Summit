package platformdb

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	// slugRe: DNS-label style, 1-63 chars (projects.slug is VARCHAR(63) and feeds hostnames).
	slugRe = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`)
	// branchRe: conservative git branch charset.
	branchRe = regexp.MustCompile(`^[A-Za-z0-9._/\-]{1,128}$`)
)

// DefaultEnvironmentName is the environment created together with every project.
const DefaultEnvironmentName = "production"

// CreateProjectParams is the input to CreateProject.
type CreateProjectParams struct {
	Slug             string  // required, lowercase DNS label, unique per user
	Name             string  // required, <= 255 chars
	DefaultBranch    string  // optional, defaults to "main"
	GitRepositoryURL *string // optional
}

const projectCols = `p.id, p.user_id, p.slug, p.name, p.git_repository_url, COALESCE(p.git_default_branch, 'main'), p.created_at, p.updated_at`

func scanProject(row pgx.Row) (*Project, error) {
	var p Project
	if err := row.Scan(&p.ID, &p.UserID, &p.Slug, &p.Name, &p.GitRepositoryURL, &p.DefaultBranch, &p.CreatedAt, &p.UpdatedAt); err != nil {
		return nil, err
	}
	return &p, nil
}

const environmentCols = `e.id, e.project_id, e.name, e.type, e.is_ephemeral, e.created_at, e.updated_at`

func scanEnvironment(row pgx.Row) (*Environment, error) {
	var e Environment
	if err := row.Scan(&e.ID, &e.ProjectID, &e.Name, &e.Type, &e.IsEphemeral, &e.CreatedAt, &e.UpdatedAt); err != nil {
		return nil, err
	}
	return &e, nil
}

// CreateProject creates a project owned by userID together with its default
// "production" environment, atomically. A duplicate (userID, slug) returns
// ErrConflict.
func (s *Store) CreateProject(ctx context.Context, userID uuid.UUID, p CreateProjectParams) (*Project, *Environment, error) {
	p.Slug = strings.TrimSpace(p.Slug)
	p.Name = strings.TrimSpace(p.Name)
	if !slugRe.MatchString(p.Slug) {
		return nil, nil, invalidArg("slug must be 1-63 chars of a-z, 0-9 and '-', not starting or ending with '-'")
	}
	if p.Name == "" || len(p.Name) > 255 {
		return nil, nil, invalidArg("name must be 1-255 characters")
	}
	branch := p.DefaultBranch
	if branch == "" {
		branch = "main"
	}
	if !branchRe.MatchString(branch) {
		return nil, nil, invalidArg("invalid default branch")
	}
	if p.GitRepositoryURL != nil && len(*p.GitRepositoryURL) > 512 {
		return nil, nil, invalidArg("git repository url too long")
	}

	var project *Project
	var env *Environment
	err := s.WithTx(ctx, func(tx *Store) error {
		var err error
		project, err = scanProject(tx.db.QueryRow(ctx, `
			INSERT INTO projects AS p (user_id, slug, name, git_default_branch, git_repository_url)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING `+projectCols, userID, p.Slug, p.Name, branch, p.GitRepositoryURL))
		if err != nil {
			if isUniqueViolation(err) {
				return fmt.Errorf("%w: project slug %q already exists", ErrConflict, p.Slug)
			}
			if isFKViolation(err) {
				return fmt.Errorf("%w: user", ErrNotFound)
			}
			return fmt.Errorf("platformdb: insert project: %w", err)
		}
		env, err = scanEnvironment(tx.db.QueryRow(ctx, `
			INSERT INTO environments AS e (project_id, name, type)
			VALUES ($1, $2, 'production')
			RETURNING `+environmentCols, project.ID, DefaultEnvironmentName))
		if err != nil {
			return fmt.Errorf("platformdb: insert default environment: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, nil, err
	}
	return project, env, nil
}

// ListProjects returns the user's non-deleted projects, newest first, using
// keyset pagination on (created_at, id).
func (s *Store) ListProjects(ctx context.Context, userID uuid.UUID, lp ListParams) (Page[Project], error) {
	limit := lp.limit()
	curT, curID, err := decodeOptionalCursor(lp.Cursor)
	if err != nil {
		return Page[Project]{}, err
	}
	rows, err := s.db.Query(ctx, `
		SELECT `+projectCols+`
		FROM projects p
		WHERE p.user_id = $1 AND p.deleted_at IS NULL
		  AND ($2::timestamptz IS NULL OR (p.created_at, p.id) < ($2, $3::uuid))
		ORDER BY p.created_at DESC, p.id DESC
		LIMIT $4`, userID, curT, curID, limit+1)
	if err != nil {
		return Page[Project]{}, fmt.Errorf("platformdb: list projects: %w", err)
	}
	defer rows.Close()
	var items []Project
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			return Page[Project]{}, fmt.Errorf("platformdb: scan project: %w", err)
		}
		items = append(items, *p)
	}
	if err := rows.Err(); err != nil {
		return Page[Project]{}, fmt.Errorf("platformdb: list projects: %w", err)
	}
	return pageOf(items, limit, func(p Project) (time.Time, uuid.UUID) { return p.CreatedAt, p.ID }), nil
}

// GetProjectBySlug returns the user's non-deleted project with the given slug.
func (s *Store) GetProjectBySlug(ctx context.Context, userID uuid.UUID, slug string) (*Project, error) {
	p, err := scanProject(s.db.QueryRow(ctx, `
		SELECT `+projectCols+` FROM projects p
		WHERE p.user_id = $1 AND p.slug = $2 AND p.deleted_at IS NULL`, userID, slug))
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}
	return p, nil
}

// UpdateProjectParams selects the fields to change; nil fields are left alone.
type UpdateProjectParams struct {
	Name          *string
	DefaultBranch *string
}

// UpdateProject changes a project's name and/or default branch.
func (s *Store) UpdateProject(ctx context.Context, userID, projectID uuid.UUID, u UpdateProjectParams) (*Project, error) {
	if u.Name != nil {
		n := strings.TrimSpace(*u.Name)
		if n == "" || len(n) > 255 {
			return nil, invalidArg("name must be 1-255 characters")
		}
		u.Name = &n
	}
	if u.DefaultBranch != nil && !branchRe.MatchString(*u.DefaultBranch) {
		return nil, invalidArg("invalid default branch")
	}
	p, err := scanProject(s.db.QueryRow(ctx, `
		UPDATE projects p
		SET name = COALESCE($3, p.name),
		    git_default_branch = COALESCE($4, p.git_default_branch)
		WHERE p.id = $1 AND p.user_id = $2 AND p.deleted_at IS NULL
		RETURNING `+projectCols, projectID, userID, u.Name, u.DefaultBranch))
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}
	return p, nil
}

// SoftDeleteProject marks the project and all of its environments and services
// deleted. Rows are kept (deployments reference them); the slug stays reserved.
func (s *Store) SoftDeleteProject(ctx context.Context, userID, projectID uuid.UUID) error {
	return s.WithTx(ctx, func(tx *Store) error {
		tag, err := tx.db.Exec(ctx, `
			UPDATE projects SET deleted_at = now()
			WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, projectID, userID)
		if err != nil {
			return fmt.Errorf("platformdb: soft delete project: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		if _, err := tx.db.Exec(ctx, `
			UPDATE services SET deleted_at = now()
			WHERE deleted_at IS NULL
			  AND environment_id IN (SELECT id FROM environments WHERE project_id = $1)`, projectID); err != nil {
			return fmt.Errorf("platformdb: soft delete services: %w", err)
		}
		if _, err := tx.db.Exec(ctx, `
			UPDATE environments SET deleted_at = now()
			WHERE project_id = $1 AND deleted_at IS NULL`, projectID); err != nil {
			return fmt.Errorf("platformdb: soft delete environments: %w", err)
		}
		return nil
	})
}

// ListEnvironments returns the non-deleted environments of a project owned by
// userID, oldest first. An unowned or deleted project yields ErrNotFound.
func (s *Store) ListEnvironments(ctx context.Context, userID, projectID uuid.UUID) ([]Environment, error) {
	if err := s.requireProject(ctx, userID, projectID); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `
		SELECT `+environmentCols+` FROM environments e
		WHERE e.project_id = $1 AND e.deleted_at IS NULL
		ORDER BY e.created_at, e.id`, projectID)
	if err != nil {
		return nil, fmt.Errorf("platformdb: list environments: %w", err)
	}
	defer rows.Close()
	var out []Environment
	for rows.Next() {
		e, err := scanEnvironment(rows)
		if err != nil {
			return nil, fmt.Errorf("platformdb: scan environment: %w", err)
		}
		out = append(out, *e)
	}
	return out, rows.Err()
}

func (s *Store) requireProject(ctx context.Context, userID, projectID uuid.UUID) error {
	var one int
	err := s.db.QueryRow(ctx, `SELECT 1 FROM projects WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
		projectID, userID).Scan(&one)
	return notFoundIfNoRows(err)
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

const serviceCols = `sv.id, sv.environment_id, e.name, e.project_id, sv.name, sv.type, sv.created_at, sv.updated_at`
const serviceFrom = `services sv
	JOIN environments e ON e.id = sv.environment_id
	JOIN projects p ON p.id = e.project_id`

func scanService(row pgx.Row) (*Service, error) {
	var sv Service
	if err := row.Scan(&sv.ID, &sv.EnvironmentID, &sv.EnvironmentName, &sv.ProjectID, &sv.Name, &sv.Type, &sv.CreatedAt, &sv.UpdatedAt); err != nil {
		return nil, err
	}
	return &sv, nil
}

// CreateService creates a service (web|worker|cron) in an environment owned by
// userID, plus its default service_resources row. A duplicate name within the
// environment returns ErrConflict.
func (s *Store) CreateService(ctx context.Context, userID, environmentID uuid.UUID, name, serviceType string) (*Service, error) {
	name = strings.TrimSpace(name)
	if !slugRe.MatchString(name) {
		return nil, invalidArg("service name must be 1-63 chars of a-z, 0-9 and '-', not starting or ending with '-'")
	}
	switch serviceType {
	case ServiceTypeWeb, ServiceTypeWorker, ServiceTypeCron:
	default:
		return nil, invalidArg("service type must be web, worker or cron")
	}
	var out *Service
	err := s.WithTx(ctx, func(tx *Store) error {
		// Lock + verify the environment is owned and live.
		var envID uuid.UUID
		err := tx.db.QueryRow(ctx, `
			SELECT e.id FROM environments e JOIN projects p ON p.id = e.project_id
			WHERE e.id = $1 AND p.user_id = $2 AND e.deleted_at IS NULL AND p.deleted_at IS NULL
			FOR SHARE OF e`, environmentID, userID).Scan(&envID)
		if err != nil {
			return notFoundIfNoRows(err)
		}
		var id uuid.UUID
		if err := tx.db.QueryRow(ctx, `
			INSERT INTO services (environment_id, name, type) VALUES ($1, $2, $3) RETURNING id`,
			environmentID, name, serviceType).Scan(&id); err != nil {
			if isUniqueViolation(err) {
				return fmt.Errorf("%w: service %q already exists in environment", ErrConflict, name)
			}
			return fmt.Errorf("platformdb: insert service: %w", err)
		}
		if _, err := tx.db.Exec(ctx, `INSERT INTO service_resources (service_id) VALUES ($1)`, id); err != nil {
			return fmt.Errorf("platformdb: insert service resources: %w", err)
		}
		out, err = scanService(tx.db.QueryRow(ctx, `SELECT `+serviceCols+` FROM `+serviceFrom+` WHERE sv.id = $1`, id))
		return err
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

// ListServicesByProject returns the non-deleted services across all live
// environments of a project owned by userID.
func (s *Store) ListServicesByProject(ctx context.Context, userID, projectID uuid.UUID) ([]Service, error) {
	if err := s.requireProject(ctx, userID, projectID); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `
		SELECT `+serviceCols+` FROM `+serviceFrom+`
		WHERE e.project_id = $1 AND p.user_id = $2
		  AND sv.deleted_at IS NULL AND e.deleted_at IS NULL AND p.deleted_at IS NULL
		ORDER BY e.created_at, sv.created_at, sv.id`, projectID, userID)
	if err != nil {
		return nil, fmt.Errorf("platformdb: list services: %w", err)
	}
	defer rows.Close()
	var out []Service
	for rows.Next() {
		sv, err := scanService(rows)
		if err != nil {
			return nil, fmt.Errorf("platformdb: scan service: %w", err)
		}
		out = append(out, *sv)
	}
	return out, rows.Err()
}

// GetServiceForUser returns a live service if it belongs to userID.
func (s *Store) GetServiceForUser(ctx context.Context, userID, serviceID uuid.UUID) (*Service, error) {
	sv, err := scanService(s.db.QueryRow(ctx, `
		SELECT `+serviceCols+` FROM `+serviceFrom+`
		WHERE sv.id = $1 AND p.user_id = $2
		  AND sv.deleted_at IS NULL AND e.deleted_at IS NULL AND p.deleted_at IS NULL`, serviceID, userID))
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}
	return sv, nil
}

// ---------------------------------------------------------------------------
// Service resources
// ---------------------------------------------------------------------------

const resourceCols = `sr.service_id, sr.cpu_request_millicores, sr.cpu_limit_millicores, sr.memory_request_mb,
	sr.memory_limit_mb, sr.min_replicas, sr.max_replicas, COALESCE(sr.port, 8080), sr.updated_at`

func scanResources(row pgx.Row) (*ServiceResources, error) {
	var r ServiceResources
	if err := row.Scan(&r.ServiceID, &r.CPURequestMillicores, &r.CPULimitMillicores, &r.MemoryRequestMB,
		&r.MemoryLimitMB, &r.MinReplicas, &r.MaxReplicas, &r.Port, &r.UpdatedAt); err != nil {
		return nil, err
	}
	return &r, nil
}

// GetServiceResources returns the resource spec of a service owned by userID.
func (s *Store) GetServiceResources(ctx context.Context, userID, serviceID uuid.UUID) (*ServiceResources, error) {
	r, err := scanResources(s.db.QueryRow(ctx, `
		SELECT `+resourceCols+` FROM service_resources sr
		JOIN services sv ON sv.id = sr.service_id
		JOIN environments e ON e.id = sv.environment_id
		JOIN projects p ON p.id = e.project_id
		WHERE sr.service_id = $1 AND p.user_id = $2
		  AND sv.deleted_at IS NULL AND e.deleted_at IS NULL AND p.deleted_at IS NULL`, serviceID, userID))
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}
	return r, nil
}

// Validate checks internal consistency of a resource spec.
func (r ServiceResources) Validate() error {
	switch {
	case r.CPURequestMillicores <= 0 || r.CPULimitMillicores < r.CPURequestMillicores:
		return invalidArg("cpu millicores must satisfy 0 < request <= limit")
	case r.MemoryRequestMB <= 0 || r.MemoryLimitMB < r.MemoryRequestMB:
		return invalidArg("memory MB must satisfy 0 < request <= limit")
	case r.MinReplicas < 0 || r.MaxReplicas < r.MinReplicas || r.MaxReplicas == 0:
		return invalidArg("replicas must satisfy 0 <= min <= max and max >= 1")
	case r.Port < 1 || r.Port > 65535:
		return invalidArg("port must be 1-65535")
	}
	return nil
}

// UpsertServiceResources replaces the resource spec of a service owned by
// userID. The ServiceID field of res is ignored in favour of serviceID.
func (s *Store) UpsertServiceResources(ctx context.Context, userID, serviceID uuid.UUID, res ServiceResources) (*ServiceResources, error) {
	if err := res.Validate(); err != nil {
		return nil, err
	}
	if _, err := s.GetServiceForUser(ctx, userID, serviceID); err != nil {
		return nil, err
	}
	out, err := scanResources(s.db.QueryRow(ctx, `
		INSERT INTO service_resources AS sr (service_id, cpu_request_millicores, cpu_limit_millicores,
			memory_request_mb, memory_limit_mb, min_replicas, max_replicas, port)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (service_id) DO UPDATE SET
			cpu_request_millicores = EXCLUDED.cpu_request_millicores,
			cpu_limit_millicores = EXCLUDED.cpu_limit_millicores,
			memory_request_mb = EXCLUDED.memory_request_mb,
			memory_limit_mb = EXCLUDED.memory_limit_mb,
			min_replicas = EXCLUDED.min_replicas,
			max_replicas = EXCLUDED.max_replicas,
			port = EXCLUDED.port
		RETURNING `+resourceCols,
		serviceID, res.CPURequestMillicores, res.CPULimitMillicores, res.MemoryRequestMB,
		res.MemoryLimitMB, res.MinReplicas, res.MaxReplicas, res.Port))
	if err != nil {
		return nil, fmt.Errorf("platformdb: upsert service resources: %w", err)
	}
	return out, nil
}
