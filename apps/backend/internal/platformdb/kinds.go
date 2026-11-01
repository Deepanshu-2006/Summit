package platformdb

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/summit/backend/internal/registry"
)

// DefaultAddonStorageMB is the volume size written for a new postgres or redis service.
const DefaultAddonStorageMB = 1024

// Pinned image refs stored on build-less deployments: repo@sha256:<64 hex>.
var pinnedImageRef = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}@sha256:[a-fA-F0-9]{64}$`)

// ServiceImageSource is the user-supplied image reference for an image service.
type ServiceImageSource struct {
	ServiceID uuid.UUID
	Image     string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// ServiceAddon is the managed-engine spec for a postgres or redis service.
type ServiceAddon struct {
	ServiceID uuid.UUID
	Engine    string
	Version   string
	StorageMB int
	CreatedAt time.Time
	UpdatedAt time.Time
}

// EnvironmentAddon is one live postgres or redis service in an environment.
// The orchestrator uses it to inject connection environment variables.
type EnvironmentAddon struct {
	ServiceID   uuid.UUID
	ServiceName string
	Engine      string
	Version     string
	Port        int32
}

// ServiceCreate is the input to CreateTypedService.
type ServiceCreate struct {
	Name         string
	Type         string
	Image        string // required for image
	Port         *int   // web and image only; 1-65535
	AddonEngine  string // postgres | redis, must match Type
	AddonVersion string
	StorageMB    int // defaults to DefaultAddonStorageMB
}

// CreateEnvironment adds a staging or preview environment to a project owned
// by userID. The name is a DNS label and unique per project (ErrConflict).
// Preview environments are ephemeral; staging environments are not.
// Production is created with the project and is rejected here.
func (s *Store) CreateEnvironment(ctx context.Context, userID, projectID uuid.UUID, name, envType string) (*Environment, error) {
	name = strings.TrimSpace(name)
	if !slugRe.MatchString(name) {
		return nil, invalidArg("environment name must be 1-63 chars of a-z, 0-9 and '-', not starting or ending with '-'")
	}
	ephemeral := false
	switch envType {
	case EnvTypeStaging:
	case EnvTypePreview:
		ephemeral = true
	default:
		return nil, invalidArg("environment type must be staging or preview")
	}
	var env *Environment
	err := s.WithTx(ctx, func(tx *Store) error {
		if err := tx.requireProject(ctx, userID, projectID); err != nil {
			return err
		}
		var err error
		env, err = scanEnvironment(tx.db.QueryRow(ctx, `
			INSERT INTO environments AS e (project_id, name, type, is_ephemeral)
			VALUES ($1, $2, $3, $4)
			RETURNING `+environmentCols, projectID, name, envType, ephemeral))
		if err != nil {
			if isUniqueViolation(err) {
				return fmt.Errorf("%w: environment %q already exists", ErrConflict, name)
			}
			if isFKViolation(err) {
				return fmt.Errorf("%w: project", ErrNotFound)
			}
			return fmt.Errorf("platformdb: insert environment: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return env, nil
}

// CreateTypedService creates a service of any supported kind, plus its
// resource row and, for image / postgres / redis, the image or addon row.
// web and worker default to port 8080. postgres is 5432 and redis is 6379.
func (s *Store) CreateTypedService(ctx context.Context, userID, environmentID uuid.UUID, spec ServiceCreate) (*Service, error) {
	spec.Name = strings.TrimSpace(spec.Name)
	spec.Image = strings.TrimSpace(spec.Image)
	spec.Type = strings.TrimSpace(spec.Type)
	spec.AddonEngine = strings.TrimSpace(spec.AddonEngine)
	spec.AddonVersion = strings.TrimSpace(spec.AddonVersion)
	if !slugRe.MatchString(spec.Name) {
		return nil, invalidArg("service name must be 1-63 chars of a-z, 0-9 and '-', not starting or ending with '-'")
	}
	port, err := spec.resolvePort()
	if err != nil {
		return nil, err
	}
	if err := spec.validateKind(); err != nil {
		return nil, err
	}

	var out *Service
	err = s.WithTx(ctx, func(tx *Store) error {
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
			environmentID, spec.Name, spec.Type).Scan(&id); err != nil {
			if isUniqueViolation(err) {
				return fmt.Errorf("%w: service %q already exists in environment", ErrConflict, spec.Name)
			}
			return fmt.Errorf("platformdb: insert service: %w", err)
		}
		if _, err := tx.db.Exec(ctx, `INSERT INTO service_resources (service_id, port) VALUES ($1, $2)`, id, port); err != nil {
			return fmt.Errorf("platformdb: insert service resources: %w", err)
		}
		switch spec.Type {
		case ServiceTypeImage:
			if _, err := tx.db.Exec(ctx, `
				INSERT INTO service_image_sources (service_id, image) VALUES ($1, $2)`, id, spec.Image); err != nil {
				return fmt.Errorf("platformdb: insert image source: %w", err)
			}
		case ServiceTypePostgres, ServiceTypeRedis:
			if _, err := tx.db.Exec(ctx, `
				INSERT INTO service_addons (service_id, engine, version, storage_mb) VALUES ($1, $2, $3, $4)`,
				id, spec.AddonEngine, spec.AddonVersion, spec.StorageMB); err != nil {
				return fmt.Errorf("platformdb: insert addon: %w", err)
			}
		}
		out, err = scanService(tx.db.QueryRow(ctx, `SELECT `+serviceCols+` FROM `+serviceFrom+` WHERE sv.id = $1`, id))
		return err
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (spec *ServiceCreate) validateKind() error {
	switch spec.Type {
	case ServiceTypeWeb, ServiceTypeWorker, ServiceTypeCron:
		if spec.Image != "" {
			return invalidArg("image is only valid for image services")
		}
		if spec.AddonEngine != "" {
			return invalidArg("addon is only valid for postgres and redis services")
		}
	case ServiceTypeImage:
		if spec.Image == "" {
			return invalidArg("image is required for type image")
		}
		if err := registry.ValidateRef(spec.Image); err != nil {
			return invalidArg("invalid image reference")
		}
		if spec.AddonEngine != "" {
			return invalidArg("addon is only valid for postgres and redis services")
		}
	case ServiceTypePostgres, ServiceTypeRedis:
		if spec.Image != "" {
			return invalidArg("image is only valid for image services")
		}
		if spec.AddonEngine != spec.Type {
			return invalidArg("addon engine must match the service type")
		}
		if spec.AddonVersion == "" {
			return invalidArg("addon version is required")
		}
		if spec.StorageMB == 0 {
			spec.StorageMB = DefaultAddonStorageMB
		}
		if spec.StorageMB < 1 {
			return invalidArg("storage_mb must be positive")
		}
	default:
		return invalidArg("service type must be web, worker, cron, image, postgres or redis")
	}
	return nil
}

func (spec ServiceCreate) resolvePort() (int, error) {
	switch spec.Type {
	case ServiceTypePostgres:
		if spec.Port != nil {
			return 0, invalidArg("port is only valid for web and image services")
		}
		return 5432, nil
	case ServiceTypeRedis:
		if spec.Port != nil {
			return 0, invalidArg("port is only valid for web and image services")
		}
		return 6379, nil
	case ServiceTypeWeb, ServiceTypeImage:
		if spec.Port == nil {
			return 8080, nil
		}
		if *spec.Port < 1 || *spec.Port > 65535 {
			return 0, invalidArg("port must be 1-65535")
		}
		return *spec.Port, nil
	case ServiceTypeWorker, ServiceTypeCron:
		if spec.Port != nil {
			return 0, invalidArg("port is only valid for web and image services")
		}
		return 8080, nil
	default:
		if spec.Port != nil && (*spec.Port < 1 || *spec.Port > 65535) {
			return 0, invalidArg("port must be 1-65535")
		}
		return 8080, nil
	}
}

// GetServiceImageSource returns the image reference of a service owned by userID.
func (s *Store) GetServiceImageSource(ctx context.Context, userID, serviceID uuid.UUID) (*ServiceImageSource, error) {
	row, err := scanImageSource(s.db.QueryRow(ctx, `
		SELECT sis.service_id, sis.image, sis.created_at, sis.updated_at
		FROM service_image_sources sis
		JOIN services sv ON sv.id = sis.service_id
		JOIN environments e ON e.id = sv.environment_id
		JOIN projects p ON p.id = e.project_id
		WHERE sis.service_id = $1 AND p.user_id = $2
		  AND sv.deleted_at IS NULL AND e.deleted_at IS NULL AND p.deleted_at IS NULL`, serviceID, userID))
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}
	return row, nil
}

// UpsertServiceImageSource sets the image reference of an image service owned by userID.
func (s *Store) UpsertServiceImageSource(ctx context.Context, userID, serviceID uuid.UUID, image string) (*ServiceImageSource, error) {
	image = strings.TrimSpace(image)
	if err := registry.ValidateRef(image); err != nil {
		return nil, invalidArg("invalid image reference")
	}
	sv, err := s.GetServiceForUser(ctx, userID, serviceID)
	if err != nil {
		return nil, err
	}
	if sv.Type != ServiceTypeImage {
		return nil, invalidArg("image source is only valid for image services")
	}
	row, err := scanImageSource(s.db.QueryRow(ctx, `
		INSERT INTO service_image_sources AS sis (service_id, image) VALUES ($1, $2)
		ON CONFLICT (service_id) DO UPDATE SET image = EXCLUDED.image
		RETURNING sis.service_id, sis.image, sis.created_at, sis.updated_at`, serviceID, image))
	if err != nil {
		return nil, fmt.Errorf("platformdb: upsert image source: %w", err)
	}
	return row, nil
}

// GetServiceAddon returns the addon row of a service owned by userID.
func (s *Store) GetServiceAddon(ctx context.Context, userID, serviceID uuid.UUID) (*ServiceAddon, error) {
	row, err := scanAddon(s.db.QueryRow(ctx, `
		SELECT a.service_id, a.engine, a.version, a.storage_mb, a.created_at, a.updated_at
		FROM service_addons a
		JOIN services sv ON sv.id = a.service_id
		JOIN environments e ON e.id = sv.environment_id
		JOIN projects p ON p.id = e.project_id
		WHERE a.service_id = $1 AND p.user_id = $2
		  AND sv.deleted_at IS NULL AND e.deleted_at IS NULL AND p.deleted_at IS NULL`, serviceID, userID))
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}
	return row, nil
}

// UpsertServiceAddon sets the addon spec of a postgres or redis service owned by userID.
func (s *Store) UpsertServiceAddon(ctx context.Context, userID, serviceID uuid.UUID, addon ServiceAddon) (*ServiceAddon, error) {
	sv, err := s.GetServiceForUser(ctx, userID, serviceID)
	if err != nil {
		return nil, err
	}
	if sv.Type != ServiceTypePostgres && sv.Type != ServiceTypeRedis {
		return nil, invalidArg("addon is only valid for postgres and redis services")
	}
	if addon.Engine != sv.Type {
		return nil, invalidArg("addon engine must match the service type")
	}
	addon.Version = strings.TrimSpace(addon.Version)
	if addon.Version == "" {
		return nil, invalidArg("addon version is required")
	}
	if addon.StorageMB == 0 {
		addon.StorageMB = DefaultAddonStorageMB
	}
	if addon.StorageMB < 1 {
		return nil, invalidArg("storage_mb must be positive")
	}
	row, err := scanAddon(s.db.QueryRow(ctx, `
		INSERT INTO service_addons AS a (service_id, engine, version, storage_mb)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (service_id) DO UPDATE SET
			engine = EXCLUDED.engine, version = EXCLUDED.version, storage_mb = EXCLUDED.storage_mb
		RETURNING a.service_id, a.engine, a.version, a.storage_mb, a.created_at, a.updated_at`,
		serviceID, addon.Engine, addon.Version, addon.StorageMB))
	if err != nil {
		return nil, fmt.Errorf("platformdb: upsert addon: %w", err)
	}
	return row, nil
}

func scanImageSource(row pgx.Row) (*ServiceImageSource, error) {
	var s ServiceImageSource
	if err := row.Scan(&s.ServiceID, &s.Image, &s.CreatedAt, &s.UpdatedAt); err != nil {
		return nil, err
	}
	return &s, nil
}

func scanAddon(row pgx.Row) (*ServiceAddon, error) {
	var a ServiceAddon
	if err := row.Scan(&a.ServiceID, &a.Engine, &a.Version, &a.StorageMB, &a.CreatedAt, &a.UpdatedAt); err != nil {
		return nil, err
	}
	return &a, nil
}

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

type serviceDeleteInfo struct {
	ServiceID       uuid.UUID
	ServiceName     string
	ServiceType     string
	EnvironmentID   uuid.UUID
	EnvironmentName string
	ProjectID       uuid.UUID
	ProjectSlug     string
	UserID          uuid.UUID
}

// SoftDeleteService marks the service deleted, disconnects its GitHub source,
// requests cancellation of in-flight deployments, and inserts one
// service.deleted outbox event. A missing or foreign service is ErrNotFound.
func (s *Store) SoftDeleteService(ctx context.Context, userID, serviceID uuid.UUID) (*Service, error) {
	var out *Service
	err := s.WithTx(ctx, func(tx *Store) error {
		info, err := tx.lockLiveService(ctx, userID, serviceID)
		if err != nil {
			return err
		}
		if _, err := tx.applyServiceDeletion(ctx, info); err != nil {
			return err
		}
		out, err = scanService(tx.db.QueryRow(ctx, `SELECT `+serviceCols+` FROM `+serviceFrom+` WHERE sv.id = $1`, serviceID))
		return err
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

// deleteLiveProjectServices emits service.deleted for every live service of
// projectID and soft-deletes them. The project row may already be deleted.
func (s *Store) deleteLiveProjectServices(ctx context.Context, projectID uuid.UUID) error {
	rows, err := s.db.Query(ctx, `
		SELECT sv.id, sv.name, sv.type, e.id, e.name, p.id, p.slug, p.user_id
		FROM services sv
		JOIN environments e ON e.id = sv.environment_id
		JOIN projects p ON p.id = e.project_id
		WHERE p.id = $1 AND sv.deleted_at IS NULL
		FOR UPDATE OF sv`, projectID)
	if err != nil {
		return fmt.Errorf("platformdb: list services to delete: %w", err)
	}
	var infos []serviceDeleteInfo
	for rows.Next() {
		var info serviceDeleteInfo
		if err := rows.Scan(&info.ServiceID, &info.ServiceName, &info.ServiceType, &info.EnvironmentID, &info.EnvironmentName, &info.ProjectID, &info.ProjectSlug, &info.UserID); err != nil {
			rows.Close()
			return fmt.Errorf("platformdb: scan service to delete: %w", err)
		}
		infos = append(infos, info)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()
	for _, info := range infos {
		if _, err := s.applyServiceDeletion(ctx, info); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) lockLiveService(ctx context.Context, userID, serviceID uuid.UUID) (serviceDeleteInfo, error) {
	var info serviceDeleteInfo
	err := s.db.QueryRow(ctx, `
		SELECT sv.id, sv.name, sv.type, e.id, e.name, p.id, p.slug, p.user_id
		FROM services sv
		JOIN environments e ON e.id = sv.environment_id
		JOIN projects p ON p.id = e.project_id
		WHERE sv.id = $1 AND p.user_id = $2
		  AND sv.deleted_at IS NULL AND e.deleted_at IS NULL AND p.deleted_at IS NULL
		FOR UPDATE OF sv`, serviceID, userID).Scan(
		&info.ServiceID, &info.ServiceName, &info.ServiceType, &info.EnvironmentID, &info.EnvironmentName,
		&info.ProjectID, &info.ProjectSlug, &info.UserID)
	if err != nil {
		return serviceDeleteInfo{}, notFoundIfNoRows(err)
	}
	return info, nil
}

// applyServiceDeletion soft-deletes one live service and writes the outbox
// event. applied is false when the row was already deleted.
func (s *Store) applyServiceDeletion(ctx context.Context, info serviceDeleteInfo) (bool, error) {
	tag, err := s.db.Exec(ctx, `
		UPDATE services SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, info.ServiceID)
	if err != nil {
		return false, fmt.Errorf("platformdb: soft delete service: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return false, nil
	}
	if _, err := s.db.Exec(ctx, `
		UPDATE service_sources
		SET source_status = 'disconnected', disconnect_reason = 'service_deleted'
		WHERE service_id = $1`, info.ServiceID); err != nil {
		return false, fmt.Errorf("platformdb: disconnect service source: %w", err)
	}
	if _, err := s.db.Exec(ctx, `
		UPDATE deployments
		SET cancel_requested_at = COALESCE(cancel_requested_at, now())
		WHERE service_id = $1 AND status = ANY($2::text[]::deployment_status[])`,
		info.ServiceID, statusStrings(InFlightStatuses)); err != nil {
		return false, fmt.Errorf("platformdb: cancel service deployments: %w", err)
	}
	payload, err := json.Marshal(ServiceDeletedEvent{
		EventID:         uuid.NewString(),
		ServiceID:       info.ServiceID.String(),
		ServiceName:     info.ServiceName,
		ServiceType:     info.ServiceType,
		UserID:          info.UserID.String(),
		ProjectID:       info.ProjectID.String(),
		ProjectSlug:     info.ProjectSlug,
		EnvironmentID:   info.EnvironmentID.String(),
		EnvironmentName: info.EnvironmentName,
	})
	if err != nil {
		return false, fmt.Errorf("platformdb: marshal service.deleted: %w", err)
	}
	if _, err := s.db.Exec(ctx, `
		INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
		VALUES ($1, $2, $3, $4, 'pending')`,
		OutboxAggregateService, info.ServiceID, OutboxEventServiceDeleted, payload); err != nil {
		return false, fmt.Errorf("platformdb: insert service.deleted: %w", err)
	}
	return true, nil
}

// ---------------------------------------------------------------------------
// Build-less deployments
// ---------------------------------------------------------------------------

// CreateImageDeploymentParams is the input to CreateImageDeployment.
type CreateImageDeploymentParams struct {
	UserID            uuid.UUID
	ServiceID         uuid.UUID
	IdempotencyKey    string
	TriggeredByUserID *uuid.UUID
	ImageRef          string // repo@sha256:<digest>
}

// CreateAddonDeploymentParams is the input to CreateAddonDeployment.
type CreateAddonDeploymentParams struct {
	UserID            uuid.UUID
	ServiceID         uuid.UUID
	IdempotencyKey    string
	TriggeredByUserID *uuid.UUID
	ImageRef          string // catalog pin, repo@sha256:<digest>
}

// CreateImageDeployment inserts a deployment in status image_ready for an
// image service. There is no build job and no build outbox event. Idempotent
// on (project_id, IdempotencyKey), same as CreateDeploymentWithOutbox.
func (s *Store) CreateImageDeployment(ctx context.Context, p CreateImageDeploymentParams) (*CreateDeploymentResult, error) {
	return s.createBuildlessDeployment(ctx, buildlessParams{
		UserID: p.UserID, ServiceID: p.ServiceID, IdempotencyKey: p.IdempotencyKey,
		TriggeredByUserID: p.TriggeredByUserID, ImageRef: p.ImageRef,
		Kind: "image", Expect: ServiceTypeImage,
	})
}

// CreateAddonDeployment inserts a deployment in status image_ready for a
// postgres or redis service, using the catalog image the caller resolved.
func (s *Store) CreateAddonDeployment(ctx context.Context, p CreateAddonDeploymentParams) (*CreateDeploymentResult, error) {
	return s.createBuildlessDeployment(ctx, buildlessParams{
		UserID: p.UserID, ServiceID: p.ServiceID, IdempotencyKey: p.IdempotencyKey,
		TriggeredByUserID: p.TriggeredByUserID, ImageRef: p.ImageRef,
		Kind: "addon", Expect: ServiceTypePostgres, ExpectAlso: ServiceTypeRedis,
	})
}

type buildlessParams struct {
	UserID            uuid.UUID
	ServiceID         uuid.UUID
	IdempotencyKey    string
	TriggeredByUserID *uuid.UUID
	ImageRef          string
	Kind              string
	Expect            string
	ExpectAlso        string
}

func (s *Store) createBuildlessDeployment(ctx context.Context, p buildlessParams) (*CreateDeploymentResult, error) {
	p.ImageRef = strings.TrimSpace(p.ImageRef)
	if !pinnedImageRef.MatchString(p.ImageRef) {
		return nil, invalidArg("image_ref must be repo@sha256:<64 hex>")
	}
	if p.IdempotencyKey == "" {
		p.IdempotencyKey = uuid.NewString()
	}
	if len(p.IdempotencyKey) > 128 {
		return nil, invalidArg("idempotency key too long (max 128 chars)")
	}
	triggered := p.TriggeredByUserID
	if triggered == nil {
		triggered = &p.UserID
	}

	var res *CreateDeploymentResult
	err := s.WithTx(ctx, func(tx *Store) error {
		var scope struct {
			ServiceID     uuid.UUID
			ServiceType   string
			EnvironmentID uuid.UUID
			ProjectID     uuid.UUID
		}
		err := tx.db.QueryRow(ctx, `
			SELECT sv.id, sv.type, e.id, p.id
			FROM services sv
			JOIN environments e ON e.id = sv.environment_id
			JOIN projects p ON p.id = e.project_id
			WHERE sv.id = $1 AND p.user_id = $2
			  AND sv.deleted_at IS NULL AND e.deleted_at IS NULL AND p.deleted_at IS NULL`,
			p.ServiceID, p.UserID).Scan(&scope.ServiceID, &scope.ServiceType, &scope.EnvironmentID, &scope.ProjectID)
		if err != nil {
			return notFoundIfNoRows(err)
		}
		if scope.ServiceType != p.Expect && (p.ExpectAlso == "" || scope.ServiceType != p.ExpectAlso) {
			return invalidArg("service type %s cannot take a %s deployment", scope.ServiceType, p.Kind)
		}
		if p.Kind == "image" {
			var one int
			if err := tx.db.QueryRow(ctx, `SELECT 1 FROM service_image_sources WHERE service_id = $1`, scope.ServiceID).Scan(&one); err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					return invalidArg("image source is not configured")
				}
				return fmt.Errorf("platformdb: load image source: %w", err)
			}
		} else {
			var one int
			if err := tx.db.QueryRow(ctx, `SELECT 1 FROM service_addons WHERE service_id = $1`, scope.ServiceID).Scan(&one); err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					return invalidArg("addon is not configured")
				}
				return fmt.Errorf("platformdb: load addon: %w", err)
			}
		}

		existing, err := tx.findDeploymentByKey(ctx, scope.ProjectID, p.IdempotencyKey, p.ServiceID)
		if err != nil {
			return err
		}
		if existing != nil {
			res = existing
			return nil
		}

		snapshot, err := json.Marshal(map[string]string{"kind": p.Kind, "image_ref": p.ImageRef})
		if err != nil {
			return err
		}
		var depID uuid.UUID
		err = tx.db.QueryRow(ctx, `
			INSERT INTO deployments (project_id, environment_id, service_id, git_commit_sha, git_branch,
				status, trigger_type, source_snapshot, triggered_by_user_id, idempotency_key, image_ref, started_at)
			VALUES ($1, $2, $3, NULL, NULL, 'image_ready', 'manual', $4, $5, $6, $7, now())
			ON CONFLICT ON CONSTRAINT uq_project_idempotency DO NOTHING
			RETURNING id`,
			scope.ProjectID, scope.EnvironmentID, scope.ServiceID, snapshot, triggered, p.IdempotencyKey, p.ImageRef).Scan(&depID)
		if errors.Is(err, pgx.ErrNoRows) {
			existing, ferr := tx.findDeploymentByKey(ctx, scope.ProjectID, p.IdempotencyKey, p.ServiceID)
			if ferr != nil {
				return ferr
			}
			if existing == nil {
				return fmt.Errorf("platformdb: deployment insert conflicted but no existing row found")
			}
			res = existing
			return nil
		}
		if err != nil {
			return fmt.Errorf("platformdb: insert image deployment: %w", err)
		}
		if _, err := tx.db.Exec(ctx, `
			INSERT INTO deployment_events (deployment_id, from_status, to_status, reason)
			VALUES ($1, NULL, 'image_ready', $2)`, depID, p.Kind+" deployment created"); err != nil {
			return fmt.Errorf("platformdb: insert deployment event: %w", err)
		}
		dep, err := scanDeployment(tx.db.QueryRow(ctx, `SELECT `+deploymentCols+` FROM deployments d WHERE d.id = $1`, depID))
		if err != nil {
			return fmt.Errorf("platformdb: reload deployment: %w", err)
		}
		res = &CreateDeploymentResult{Deployment: *dep, Created: true}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// findDeploymentByKey returns an existing deployment for the idempotency key.
// A key used by another service is ErrConflict. A missing key is (nil, nil).
// The build job is loaded when one exists; build-less deployments leave it zero.
func (s *Store) findDeploymentByKey(ctx context.Context, projectID uuid.UUID, key string, serviceID uuid.UUID) (*CreateDeploymentResult, error) {
	dep, err := scanDeployment(s.db.QueryRow(ctx, `
		SELECT `+deploymentCols+` FROM deployments d
		WHERE d.project_id = $1 AND d.idempotency_key = $2`, projectID, key))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("platformdb: lookup existing deployment: %w", err)
	}
	if dep.ServiceID == nil || *dep.ServiceID != serviceID {
		return nil, fmt.Errorf("%w: idempotency key already used for a different service", ErrConflict)
	}
	res := &CreateDeploymentResult{Deployment: *dep, Created: false}
	job, err := scanBuildJob(s.db.QueryRow(ctx, `SELECT `+buildJobCols+` FROM build_jobs b WHERE b.deployment_id = $1`, dep.ID))
	if err == nil {
		res.BuildJob = *job
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("platformdb: lookup existing build job: %w", err)
	}
	return res, nil
}

// ListEnvironmentAddons returns non-deleted postgres and redis services in the
// environment. It is not user-scoped; only the orchestrator should call it.
func (s *Store) ListEnvironmentAddons(ctx context.Context, environmentID uuid.UUID) ([]EnvironmentAddon, error) {
	rows, err := s.db.Query(ctx, `
		SELECT sv.id, sv.name, a.engine, a.version,
		       COALESCE(sr.port, CASE a.engine WHEN 'postgres' THEN 5432 WHEN 'redis' THEN 6379 ELSE 0 END)::int
		FROM service_addons a
		JOIN services sv ON sv.id = a.service_id
		LEFT JOIN service_resources sr ON sr.service_id = sv.id
		WHERE sv.environment_id = $1
		  AND sv.deleted_at IS NULL
		  AND sv.type IN ('postgres', 'redis')
		ORDER BY sv.name, sv.id`, environmentID)
	if err != nil {
		return nil, fmt.Errorf("platformdb: list environment addons: %w", err)
	}
	defer rows.Close()
	var out []EnvironmentAddon
	for rows.Next() {
		var a EnvironmentAddon
		var port int32
		if err := rows.Scan(&a.ServiceID, &a.ServiceName, &a.Engine, &a.Version, &port); err != nil {
			return nil, fmt.Errorf("platformdb: scan environment addon: %w", err)
		}
		a.Port = port
		out = append(out, a)
	}
	return out, rows.Err()
}
