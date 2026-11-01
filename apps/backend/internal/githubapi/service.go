package githubapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/summit/backend/internal/audit"
	"github.com/summit/backend/internal/authz"
	"github.com/summit/backend/internal/catalog"
	"github.com/summit/backend/internal/config"
	"github.com/summit/backend/internal/githubrepo"
	"github.com/summit/backend/internal/httpx"
	"github.com/summit/backend/internal/installstate"
	"github.com/summit/backend/internal/platformdb"
	"github.com/summit/backend/internal/registry"
	"github.com/summit/backend/internal/sourcepath"
)

// Service encapsulates the business logic for GitHub integration operations.
type Service struct {
	pool            Pool
	ghClient        GitHubClient
	cfg             *config.Config
	audit           audit.Writer
	logger          *slog.Logger
	platformStore   buildlessServiceStore
	deploymentStore buildlessDeploymentStore
	resolveImage    func(context.Context, string) (string, error)
}

type buildlessServiceStore interface {
	GetServiceForUser(ctx context.Context, userID, serviceID uuid.UUID) (*platformdb.Service, error)
	GetServiceImageSource(ctx context.Context, userID, serviceID uuid.UUID) (*platformdb.ServiceImageSource, error)
	GetServiceAddon(ctx context.Context, userID, serviceID uuid.UUID) (*platformdb.ServiceAddon, error)
}

type buildlessDeploymentStore interface {
	CreateImageDeployment(ctx context.Context, p platformdb.CreateImageDeploymentParams) (*platformdb.CreateDeploymentResult, error)
	CreateAddonDeployment(ctx context.Context, p platformdb.CreateAddonDeploymentParams) (*platformdb.CreateDeploymentResult, error)
}

// Config holds dependencies required to construct a Service.
type Config struct {
	Pool            Pool
	GHClient        GitHubClient
	AppCfg          *config.Config
	Audit           audit.Writer
	Logger          *slog.Logger
	PlatformStore   buildlessServiceStore
	DeploymentStore buildlessDeploymentStore
	ResolveImage    func(context.Context, string) (string, error)
}

// NewService creates a new Service instance.
func NewService(c Config) *Service {
	logger := c.Logger
	if logger == nil {
		logger = slog.Default()
	}
	appCfg := c.AppCfg
	if appCfg == nil {
		appCfg = config.Load()
	}
	auditWriter := c.Audit
	if auditWriter == nil && c.Pool != nil {
		auditWriter = audit.NewPgxWriter(c.Pool)
	}
	return &Service{
		pool:            c.Pool,
		ghClient:        c.GHClient,
		cfg:             appCfg,
		audit:           auditWriter,
		logger:          logger,
		platformStore:   c.PlatformStore,
		deploymentStore: c.DeploymentStore,
		resolveImage:    c.ResolveImage,
	}
}

// StartInstallation initiates the GitHub App installation flow for the authenticated user.
// It generates a secure single-use state, persists its hash, and formats the installation URL.
func (s *Service) StartInstallation(ctx context.Context, userID uuid.UUID, ip, userAgent, reqID string) (*StartInstallationResponse, error) {
	if s.pool == nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "database pool unavailable", nil)
	}

	appSlug := s.cfg.GitHubAppSlug
	if appSlug == "" {
		return nil, httpx.NewAPIError(503, httpx.CodeGitHubAppNotConfigured, "GITHUB_APP_SLUG is not configured", nil)
	}

	rawState, stateHash, err := installstate.Generate()
	if err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to generate installation state", err)
	}

	ttl := s.cfg.GitHubStateTTL
	if ttl <= 0 {
		ttl = installstate.DefaultTTL
	}
	expiresAt := time.Now().UTC().Add(ttl)

	stateID := uuid.New()
	insertQuery := `
		INSERT INTO github_installation_states (id, state_hash, user_id, expires_at)
		VALUES ($1, $2, $3, $4)
	`
	if _, err := s.pool.Exec(ctx, insertQuery, stateID, stateHash, userID, expiresAt); err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to persist installation state", err)
	}

	if s.audit != nil {
		_ = s.audit.Write(ctx, audit.Event{
			UserID:      userID,
			ActorUserID: &userID,
			Action:      audit.ActionInstallationInitiated,
			EntityType:  "github_installation_state",
			EntityID:    stateID,
			Metadata: map[string]any{
				"user_id":    userID.String(),
				"expires_at": expiresAt.Format(time.RFC3339),
			},
			IPAddress: ip,
			UserAgent: userAgent,
			RequestID: reqID,
		})
	}

	installationURL := fmt.Sprintf("https://github.com/apps/%s/installations/new?state=%s", appSlug, url.QueryEscape(rawState))

	return &StartInstallationResponse{
		InstallationURL: installationURL,
		StateExpiresAt:  expiresAt.Format(time.RFC3339),
	}, nil
}

// HandleCallback processes the browser redirect callback from GitHub after installation.
// It validates the state, fetches installation and repository metadata from GitHub,
// persists records into the database, records an audit event, and returns the frontend redirect URL.
func (s *Service) HandleCallback(ctx context.Context, rawInstallationID, rawState, setupAction, ip, userAgent, reqID string) (string, error) {
	frontendBase := s.cfg.PlatformFrontendBaseURL
	if frontendBase == "" {
		frontendBase = "http://localhost:3000"
	}
	frontendBase = strings.TrimRight(frontendBase, "/")
	callbackPath := "/settings/github/callback"

	buildRedirect := func(status, errorCode, platformInstID string) string {
		vals := url.Values{}
		vals.Set("status", status)
		if errorCode != "" {
			vals.Set("error_code", errorCode)
		}
		if platformInstID != "" {
			vals.Set("installation_id", platformInstID)
		}
		return fmt.Sprintf("%s%s?%s", frontendBase, callbackPath, vals.Encode())
	}

	if rawState == "" {
		return buildRedirect("error", httpx.CodeGitHubInstallationStateInvalid, ""), nil
	}

	if rawInstallationID == "" {
		return buildRedirect("error", httpx.CodeGitHubInstallationNotFound, ""), nil
	}
	installationID, err := strconv.ParseInt(rawInstallationID, 10, 64)
	if err != nil || installationID <= 0 {
		return buildRedirect("error", httpx.CodeGitHubInstallationNotFound, ""), nil
	}

	if s.pool == nil {
		return buildRedirect("error", httpx.CodeInternalError, ""), nil
	}

	stateHash := installstate.Hash(rawState)
	var stateRecord struct {
		ID         uuid.UUID
		UserID     uuid.UUID
		ExpiresAt  time.Time
		ConsumedAt *time.Time
	}

	selectStateQuery := `
		SELECT id, user_id, expires_at, consumed_at
		FROM github_installation_states
		WHERE state_hash = $1
	`
	err = s.pool.QueryRow(ctx, selectStateQuery, stateHash).Scan(
		&stateRecord.ID,
		&stateRecord.UserID,
		&stateRecord.ExpiresAt,
		&stateRecord.ConsumedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return buildRedirect("error", httpx.CodeGitHubInstallationStateInvalid, ""), nil
		}
		s.logger.Error("failed to query installation state", "error", err)
		return buildRedirect("error", httpx.CodeInternalError, ""), nil
	}

	now := time.Now().UTC()
	if err := installstate.Validate(stateRecord.ExpiresAt, stateRecord.ConsumedAt, now); err != nil {
		if errors.Is(err, installstate.ErrExpired) {
			return buildRedirect("error", httpx.CodeGitHubInstallationStateExpired, ""), nil
		}
		return buildRedirect("error", httpx.CodeGitHubInstallationStateInvalid, ""), nil
	}

	// Atomically consume state
	consumeQuery := `
		UPDATE github_installation_states
		SET consumed_at = now()
		WHERE id = $1 AND consumed_at IS NULL
	`
	tag, err := s.pool.Exec(ctx, consumeQuery, stateRecord.ID)
	if err != nil || tag.RowsAffected() == 0 {
		return buildRedirect("error", httpx.CodeGitHubInstallationStateInvalid, ""), nil
	}

	if s.ghClient == nil {
		return buildRedirect("error", httpx.CodeGitHubAppNotConfigured, ""), nil
	}

	inst, err := s.ghClient.GetInstallation(ctx, installationID)
	if err != nil {
		s.logger.WarnContext(ctx, "failed to get installation from github", "installation_id", installationID, "error", err)
		return buildRedirect("error", httpx.CodeGitHubAPIUnavailable, ""), nil
	}

	if inst.SuspendedAt != nil {
		return buildRedirect("error", httpx.CodeGitHubInstallationNotActive, ""), nil
	}

	// A GitHub installation is linked to one Summit personal account.
	var existingUserID uuid.UUID
	checkOwnerQuery := `SELECT user_id FROM github_installations WHERE github_installation_id = $1`
	err = s.pool.QueryRow(ctx, checkOwnerQuery, installationID).Scan(&existingUserID)
	if err == nil && existingUserID != stateRecord.UserID {
		return buildRedirect("error", httpx.CodeGitHubInstallationAlreadyLinked, ""), nil
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		s.logger.Error("failed to check github installation owner", "error", err)
		return buildRedirect("error", httpx.CodeInternalError, ""), nil
	}

	permissionsJSON, err := json.Marshal(inst.Permissions)
	if err != nil {
		permissionsJSON = []byte("{}")
	}

	var platformInstID uuid.UUID
	upsertInstQuery := `
		INSERT INTO github_installations (
			user_id, github_installation_id, account_id, account_login,
			account_type, status, repository_selection, permissions, installed_at, last_synced_at
		) VALUES (
			$1, $2, $3, $4, $5, 'active', $6, $7, now(), now()
		)
		ON CONFLICT (github_installation_id) DO UPDATE SET
			account_id = EXCLUDED.account_id,
			account_login = EXCLUDED.account_login,
			account_type = EXCLUDED.account_type,
			status = 'active',
			repository_selection = EXCLUDED.repository_selection,
			permissions = EXCLUDED.permissions,
			installed_at = COALESCE(github_installations.installed_at, now()),
			last_synced_at = now(),
			updated_at = now()
		WHERE github_installations.user_id = EXCLUDED.user_id
		RETURNING id
	`
	err = s.pool.QueryRow(ctx, upsertInstQuery,
		stateRecord.UserID,
		installationID,
		inst.AccountID,
		inst.AccountLogin,
		inst.AccountType,
		inst.RepositorySelection,
		permissionsJSON,
	).Scan(&platformInstID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return buildRedirect("error", httpx.CodeGitHubInstallationAlreadyLinked, ""), nil
		}
		s.logger.Error("failed to upsert github installation", "error", err)
		return buildRedirect("error", httpx.CodeInternalError, ""), nil
	}

	// Synchronize repositories
	if _, err := s.syncRepositories(ctx, platformInstID, installationID); err != nil {
		s.logger.ErrorContext(ctx, "failed to synchronize repositories after GitHub installation", "user_id", stateRecord.UserID, "installation_id", installationID, "error", err)
	}

	// Record audit event
	action := audit.ActionInstallationLinked
	if setupAction == "update" {
		action = audit.ActionInstallationUpdated
	}
	if s.audit != nil {
		_ = s.audit.Write(ctx, audit.Event{
			UserID:      stateRecord.UserID,
			ActorUserID: &stateRecord.UserID,
			Action:      action,
			EntityType:  "github_installation",
			EntityID:    platformInstID,
			Metadata: map[string]any{
				"github_installation_id": installationID,
				"account_login":          inst.AccountLogin,
				"account_type":           inst.AccountType,
				"setup_action":           setupAction,
			},
			IPAddress: ip,
			UserAgent: userAgent,
			RequestID: reqID,
		})
	}

	return buildRedirect("success", "", platformInstID.String()), nil
}

// syncRepositories fetches repositories from GitHub and upserts them.
func (s *Service) syncRepositories(ctx context.Context, platformInstID uuid.UUID, ghInstID int64) (int, error) {
	if s.ghClient == nil {
		return 0, fmt.Errorf("GitHub client is unavailable")
	}
	counts, err := githubrepo.SyncInstallation(ctx, s.pool, s.ghClient, platformInstID, ghInstID)
	return counts.Fetched, err
}

type AllUsersSyncResult struct {
	UsersProcessed      int
	RepositoriesFetched int
	RepositoriesCreated int
	RepositoriesUpdated int
	FailedUsers         int
}

// SyncAllUserRepositories synchronizes active GitHub installations for every database user.
// A user's failure is recorded and does not prevent processing subsequent users.
func (s *Service) SyncAllUserRepositories(ctx context.Context) (AllUsersSyncResult, error) {
	var result AllUsersSyncResult
	if s.pool == nil || s.ghClient == nil {
		return result, fmt.Errorf("repository sync requires database and GitHub clients")
	}
	users, err := s.pool.Query(ctx, "SELECT id FROM users ORDER BY id")
	if err != nil {
		return result, fmt.Errorf("querying users for repository sync: %w", err)
	}
	var userIDs []uuid.UUID
	for users.Next() {
		var userID uuid.UUID
		if err := users.Scan(&userID); err != nil {
			users.Close()
			return result, fmt.Errorf("reading users for repository sync: %w", err)
		}
		userIDs = append(userIDs, userID)
	}
	if err := users.Err(); err != nil {
		users.Close()
		return result, fmt.Errorf("iterating users for repository sync: %w", err)
	}
	users.Close()

	for _, userID := range userIDs {
		result.UsersProcessed++
		rows, err := s.pool.Query(ctx, `SELECT id, github_installation_id FROM github_installations WHERE user_id=$1 AND status='active' ORDER BY id`, userID)
		if err != nil {
			result.FailedUsers++
			s.logger.ErrorContext(ctx, "failed to list user's GitHub installations during repository sync", "user_id", userID, "error", err)
			continue
		}
		type installation struct {
			id       uuid.UUID
			githubID int64
		}
		var installations []installation
		for rows.Next() {
			var inst installation
			if err := rows.Scan(&inst.id, &inst.githubID); err != nil {
				rows.Close()
				result.FailedUsers++
				s.logger.ErrorContext(ctx, "failed to read user's GitHub installations during repository sync", "user_id", userID, "error", err)
				installations = nil
				break
			}
			installations = append(installations, inst)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			result.FailedUsers++
			s.logger.ErrorContext(ctx, "failed to iterate user's GitHub installations during repository sync", "user_id", userID, "error", err)
			continue
		}
		rows.Close()
		failed := false
		for _, inst := range installations {
			counts, err := githubrepo.SyncInstallation(ctx, s.pool, s.ghClient, inst.id, inst.githubID)
			if err != nil {
				failed = true
				s.logger.ErrorContext(ctx, "failed to sync user's GitHub repositories", "user_id", userID, "installation_id", inst.githubID, "error", err)
				continue
			}
			result.RepositoriesFetched += counts.Fetched
			result.RepositoriesCreated += counts.Created
			result.RepositoriesUpdated += counts.Updated
		}
		if failed {
			result.FailedUsers++
		}
	}
	s.logger.InfoContext(ctx, "completed all-user GitHub repository sync",
		"users_processed", result.UsersProcessed,
		"repositories_fetched", result.RepositoriesFetched,
		"repositories_created", result.RepositoriesCreated,
		"repositories_updated", result.RepositoriesUpdated,
		"failed_users", result.FailedUsers,
	)
	return result, nil
}

// ListInstallations lists installations owned by a personal user.
func (s *Service) ListInstallations(ctx context.Context, userID uuid.UUID) (*ListInstallationsResponse, error) {
	if s.pool == nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "database pool unavailable", nil)
	}

	query := `
		SELECT i.id, i.github_installation_id, i.account_login, i.account_type,
		       i.status, COALESCE(i.repository_selection, ''),
		       COUNT(r.id) FILTER (WHERE r.removed_at IS NULL) as repo_count,
		       i.last_synced_at, i.installed_at, i.created_at, i.updated_at
		FROM github_installations i
		LEFT JOIN github_repositories r ON r.installation_id = i.id
		WHERE i.user_id = $1 AND i.status != 'disconnected'
		GROUP BY i.id
		ORDER BY i.created_at DESC
	`
	rows, err := s.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to query installations", err)
	}
	defer rows.Close()

	items := make([]InstallationSummary, 0)
	for rows.Next() {
		var item InstallationSummary
		var login, accType string
		err := rows.Scan(
			&item.ID,
			&item.GitHubInstallationID,
			&login,
			&accType,
			&item.Status,
			&item.RepositorySelection,
			&item.RepositoryCount,
			&item.LastSyncedAt,
			&item.InstalledAt,
			&item.CreatedAt,
			&item.UpdatedAt,
		)
		if err != nil {
			return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to scan installation row", err)
		}
		item.GitHubAccount = InstallationAccount{
			Login: login,
			Type:  accType,
		}
		items = append(items, item)
	}

	return &ListInstallationsResponse{
		Data:       items,
		NextCursor: nil,
	}, nil
}

// ListServices returns the authenticated user's web and worker services that can use a GitHub source.
func (s *Service) ListServices(ctx context.Context, userID uuid.UUID) (*ListServicesResponse, error) {
	if s.pool == nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "database pool unavailable", nil)
	}
	rows, err := s.pool.Query(ctx, `
		SELECT s.id, s.name, s.type, p.id, p.name, e.id, e.name
		FROM services s
		JOIN environments e ON e.id = s.environment_id
		JOIN projects p ON p.id = e.project_id
		WHERE p.user_id = $1
		  AND s.type IN ('web', 'worker')
		  AND s.deleted_at IS NULL
		  AND e.deleted_at IS NULL
		  AND p.deleted_at IS NULL
		ORDER BY p.name, e.name, s.name`, userID)
	if err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to query services", err)
	}
	defer rows.Close()

	response := &ListServicesResponse{Data: make([]ServiceSummary, 0)}
	for rows.Next() {
		var service ServiceSummary
		if err := rows.Scan(&service.ID, &service.Name, &service.Type, &service.ProjectID, &service.ProjectName, &service.EnvironmentID, &service.EnvironmentName); err != nil {
			return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to scan service row", err)
		}
		response.Data = append(response.Data, service)
	}
	if err := rows.Err(); err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to iterate service rows", err)
	}
	return response, nil
}

// GetInstallation returns detailed metadata for an installation.
func (s *Service) GetInstallation(ctx context.Context, userID uuid.UUID, installationIDStr string) (*InstallationDetailResponse, error) {
	if s.pool == nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "database pool unavailable", nil)
	}

	instUUID, uuidErr := uuid.Parse(installationIDStr)
	var ghInstID int64
	if uuidErr != nil {
		var err error
		ghInstID, err = strconv.ParseInt(installationIDStr, 10, 64)
		if err != nil {
			return nil, httpx.NewAPIError(400, httpx.CodeBadRequest, "invalid installation ID format", nil)
		}
	}

	query := `
		SELECT i.id, i.github_installation_id, i.account_id,
		       i.account_login, i.account_type, i.status, COALESCE(i.repository_selection, ''),
		       i.permissions,
		       COUNT(r.id) FILTER (WHERE r.removed_at IS NULL) as repo_count,
		       i.suspended_at, i.suspended_by_github,
		       i.installed_at, i.last_synced_at, i.created_at, i.updated_at
		FROM github_installations i
		LEFT JOIN github_repositories r ON r.installation_id = i.id
		WHERE (i.id = $1 OR ($2 > 0 AND i.github_installation_id = $2))
		  AND i.user_id = $3
		GROUP BY i.id
	`
	var res InstallationDetailResponse
	var login, accType string
	var permissionsBytes []byte

	err := s.pool.QueryRow(ctx, query, instUUID, ghInstID, userID).Scan(
		&res.ID,
		&res.GitHubInstallationID,
		&res.AccountID,
		&login,
		&accType,
		&res.Status,
		&res.RepositorySelection,
		&permissionsBytes,
		&res.RepositoryCount,
		&res.SuspendedAt,
		&res.SuspendedByGitHub,
		&res.InstalledAt,
		&res.LastSyncedAt,
		&res.CreatedAt,
		&res.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, httpx.NewAPIError(404, httpx.CodeGitHubInstallationNotFound, "installation not found", nil)
		}
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to query installation", err)
	}

	res.GitHubAccount = InstallationAccount{
		Login: login,
		Type:  accType,
	}
	res.Permissions = make(map[string]string)
	if len(permissionsBytes) > 0 {
		_ = json.Unmarshal(permissionsBytes, &res.Permissions)
	}

	return &res, nil
}

// DisconnectInstallation disconnects a user's installation and its dependent sources.
func (s *Service) DisconnectInstallation(ctx context.Context, userID uuid.UUID, installationIDStr string, ip, userAgent, reqID string) (*DisconnectInstallationResponse, error) {
	if s.pool == nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "database pool unavailable", nil)
	}

	instUUID, uuidErr := uuid.Parse(installationIDStr)
	var ghInstID int64
	if uuidErr != nil {
		var err error
		ghInstID, err = strconv.ParseInt(installationIDStr, 10, 64)
		if err != nil {
			return nil, httpx.NewAPIError(400, httpx.CodeBadRequest, "invalid installation ID format", nil)
		}
	}

	// Verify installation belongs to this personal user.
	var platformID uuid.UUID
	var actualGhInstID int64
	checkQuery := `
		SELECT id, github_installation_id FROM github_installations
		WHERE (id = $1 OR ($2 > 0 AND github_installation_id = $2))
		  AND user_id = $3
	`
	err := s.pool.QueryRow(ctx, checkQuery, instUUID, ghInstID, userID).Scan(&platformID, &actualGhInstID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, httpx.NewAPIError(404, httpx.CodeGitHubInstallationNotFound, "installation not found", nil)
		}
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to find installation", err)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to start transaction", err)
	}
	defer tx.Rollback(ctx)

	// Mark installation disconnected
	updateInstQuery := `
		UPDATE github_installations
		SET status = 'disconnected', updated_at = now()
		WHERE id = $1
	`
	if _, err := tx.Exec(ctx, updateInstQuery, platformID); err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to disconnect installation", err)
	}

	// Mark dependent service sources disconnected per spec 7.12
	updateSourcesQuery := `
		UPDATE service_sources
		SET source_status = 'disconnected', disconnect_reason = 'installation_disconnected', updated_at = now()
		WHERE repository_id IN (SELECT id FROM github_repositories WHERE installation_id = $1)
		  AND source_status != 'disconnected'
	`
	if _, err := tx.Exec(ctx, updateSourcesQuery, platformID); err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to disconnect dependent service sources", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to commit disconnect", err)
	}

	// Invalidate local token cache per spec 7.12
	if s.ghClient != nil && actualGhInstID > 0 {
		s.ghClient.InvalidateInstallationTokens(actualGhInstID)
	}

	if s.audit != nil {
		_ = s.audit.Write(ctx, audit.Event{
			UserID:      userID,
			ActorUserID: &userID,
			Action:      audit.ActionInstallationRevoked,
			EntityType:  "github_installation",
			EntityID:    platformID,
			Metadata: map[string]any{
				"status": "disconnected",
			},
			IPAddress: ip,
			UserAgent: userAgent,
			RequestID: reqID,
		})
	}

	return &DisconnectInstallationResponse{
		ID:     platformID,
		Status: "disconnected",
	}, nil
}

// ListRepositories returns repositories accessible through an installation with cursor pagination.
func (s *Service) ListRepositories(ctx context.Context, userID uuid.UUID, installationIDStr, cursor string, limit int) (*ListRepositoriesResponse, error) {
	if s.pool == nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "database pool unavailable", nil)
	}

	instUUID, uuidErr := uuid.Parse(installationIDStr)
	var ghInstID int64
	if uuidErr != nil {
		var err error
		ghInstID, err = strconv.ParseInt(installationIDStr, 10, 64)
		if err != nil {
			return nil, httpx.NewAPIError(400, httpx.CodeBadRequest, "invalid installation ID format", nil)
		}
	}

	var platformID uuid.UUID
	checkQuery := `
		SELECT id FROM github_installations
		WHERE (id = $1 OR ($2 > 0 AND github_installation_id = $2))
		  AND user_id = $3
	`
	err := s.pool.QueryRow(ctx, checkQuery, instUUID, ghInstID, userID).Scan(&platformID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, httpx.NewAPIError(404, httpx.CodeGitHubInstallationNotFound, "installation not found", nil)
		}
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to find installation", err)
	}

	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	query := `
		SELECT id, github_repository_id, owner_login, name, full_name,
		       COALESCE(default_branch, ''), private, archived, COALESCE(html_url, '')
		FROM github_repositories
		WHERE installation_id = $1
		  AND removed_at IS NULL
		  AND ($2 = '' OR full_name > $2)
		ORDER BY full_name ASC
		LIMIT $3
	`
	fetchLimit := limit + 1
	rows, err := s.pool.Query(ctx, query, platformID, cursor, fetchLimit)
	if err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to query repositories", err)
	}
	defer rows.Close()

	items := make([]RepositorySummary, 0)
	for rows.Next() {
		var repo RepositorySummary
		err := rows.Scan(
			&repo.ID,
			&repo.GitHubRepositoryID,
			&repo.Owner,
			&repo.Name,
			&repo.FullName,
			&repo.DefaultBranch,
			&repo.Private,
			&repo.Archived,
			&repo.HTMLURL,
		)
		if err != nil {
			return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to scan repository row", err)
		}
		items = append(items, repo)
	}

	var nextCursor *string
	if len(items) > limit {
		next := items[limit-1].FullName
		nextCursor = &next
		items = items[:limit]
	}

	return &ListRepositoriesResponse{
		Data:       items,
		NextCursor: nextCursor,
	}, nil
}

// SyncInstallation manually triggers repository synchronization for an installation.
func (s *Service) SyncInstallation(ctx context.Context, userID uuid.UUID, installationIDStr string, ip, userAgent, reqID string) (*SyncResponse, error) {
	if s.pool == nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "database pool unavailable", nil)
	}

	instUUID, uuidErr := uuid.Parse(installationIDStr)
	var ghInstID int64
	if uuidErr != nil {
		var err error
		ghInstID, err = strconv.ParseInt(installationIDStr, 10, 64)
		if err != nil {
			return nil, httpx.NewAPIError(400, httpx.CodeBadRequest, "invalid installation ID format", nil)
		}
	}

	var platformID uuid.UUID
	var actualGhInstID int64
	var status string
	checkQuery := `
		SELECT id, github_installation_id, status FROM github_installations
		WHERE (id = $1 OR ($2 > 0 AND github_installation_id = $2))
		  AND user_id = $3
	`
	err := s.pool.QueryRow(ctx, checkQuery, instUUID, ghInstID, userID).Scan(&platformID, &actualGhInstID, &status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, httpx.NewAPIError(404, httpx.CodeGitHubInstallationNotFound, "installation not found", nil)
		}
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to find installation", err)
	}

	if status != "active" {
		return nil, httpx.NewAPIError(400, httpx.CodeGitHubInstallationNotActive, "installation is not active", nil)
	}

	syncedCount, err := s.syncRepositories(ctx, platformID, actualGhInstID)
	if err != nil {
		return nil, httpx.NewAPIError(502, httpx.CodeGitHubAPIUnavailable, "failed to synchronize repositories with GitHub", err)
	}

	syncID := uuid.New()
	if s.audit != nil {
		_ = s.audit.Write(ctx, audit.Event{
			UserID:      userID,
			ActorUserID: &userID,
			Action:      audit.ActionRepositorySynced,
			EntityType:  "github_installation",
			EntityID:    platformID,
			Metadata: map[string]any{
				"sync_id":             syncID.String(),
				"repositories_synced": syncedCount,
			},
			IPAddress: ip,
			UserAgent: userAgent,
			RequestID: reqID,
		})
	}

	return &SyncResponse{
		SyncID:             syncID,
		Status:             "completed",
		RepositoriesSynced: syncedCount,
	}, nil
}

// PutServiceSource connects or updates a repository branch and build configuration for a service.
func (s *Service) PutServiceSource(ctx context.Context, serviceID, actorUserID uuid.UUID, req PutServiceSourceRequest, ip, userAgent, reqID string) (*ServiceSourceResponse, error) {
	if s.pool == nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "database pool unavailable", nil)
	}

	serviceUserID, err := authz.ServiceUser(ctx, s.pool, serviceID)
	if err != nil {
		if errors.Is(err, authz.ErrServiceNotFound) {
			return nil, httpx.NewAPIError(404, httpx.CodeNotFound, "service not found", err)
		}
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to resolve service owner", err)
	}
	if serviceUserID != actorUserID {
		return nil, httpx.NewAPIError(404, httpx.CodeNotFound, "service not found", nil)
	}

	// Validate service type per spec 7.7 (only application/worker services support source builds)
	var srvType string
	err = s.pool.QueryRow(ctx, "SELECT type FROM services WHERE id = $1 AND deleted_at IS NULL", serviceID).Scan(&srvType)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, httpx.NewAPIError(404, httpx.CodeNotFound, "service not found", err)
		}
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to query service type", err)
	}
	if srvType != "web" && srvType != "worker" {
		return nil, httpx.NewAPIError(400, httpx.CodeBadRequest, fmt.Sprintf("service type %q does not support source builds (must be web or worker)", srvType), nil)
	}

	// Verify repository belongs to an active installation owned by the same user.
	var repoInfo struct {
		ID         uuid.UUID
		FullName   string
		UserID     uuid.UUID
		InstStatus string
	}
	repoQuery := `
		SELECT r.id, r.full_name, i.user_id, i.status
		FROM github_repositories r
		JOIN github_installations i ON i.id = r.installation_id
		WHERE r.id = $1 AND r.removed_at IS NULL
	`
	err = s.pool.QueryRow(ctx, repoQuery, req.RepositoryID).Scan(
		&repoInfo.ID,
		&repoInfo.FullName,
		&repoInfo.UserID,
		&repoInfo.InstStatus,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, httpx.NewAPIError(404, httpx.CodeGitHubRepositoryNotFound, "repository not found or removed", nil)
		}
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to query repository", err)
	}

	if repoInfo.InstStatus != "active" {
		return nil, httpx.NewAPIError(400, httpx.CodeGitHubInstallationNotActive, "github installation is not active", nil)
	}

	if repoInfo.UserID != serviceUserID {
		return nil, httpx.NewAPIError(403, httpx.CodeGitHubRepositoryNotAccessible, "repository belongs to a different user", nil)
	}

	// Validate branch name
	if err := sourcepath.ValidateBranch(req.Branch); err != nil {
		return nil, httpx.NewAPIError(400, httpx.CodeGitHubSourceInvalidBranch, err.Error(), err)
	}

	// Validate root directory
	rootDir, err := sourcepath.NormalizeRootDirectory(req.RootDirectory)
	if err != nil {
		return nil, httpx.NewAPIError(400, httpx.CodeServiceSourceInvalidPath, "invalid root_directory: "+err.Error(), err)
	}

	// Validate dockerfile path
	var rawDockerfilePath string
	if req.DockerfilePath != nil {
		rawDockerfilePath = *req.DockerfilePath
	}
	dockerfilePath, err := sourcepath.ValidateDockerfilePath(rawDockerfilePath)
	if err != nil {
		return nil, httpx.NewAPIError(400, httpx.CodeServiceSourceInvalidPath, "invalid dockerfile_path: "+err.Error(), err)
	}
	var dockerfilePtr *string
	if dockerfilePath != "" {
		dockerfilePtr = &dockerfilePath
	}

	autoDeploy := true
	if req.AutoDeploy != nil {
		autoDeploy = *req.AutoDeploy
	}

	buildConfig := req.BuildConfiguration
	if buildConfig == nil {
		buildConfig = map[string]any{}
	}
	buildConfigJSON, err := json.Marshal(buildConfig)
	if err != nil {
		return nil, httpx.NewAPIError(400, httpx.CodeBadRequest, "invalid build_configuration JSON", err)
	}

	upsertQuery := `
		INSERT INTO service_sources (
			service_id, repository_id, branch, root_directory, dockerfile_path,
			build_configuration, auto_deploy, source_status, disconnect_reason, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, 'active', NULL, now()
		)
		ON CONFLICT (service_id) DO UPDATE SET
			repository_id = EXCLUDED.repository_id,
			branch = EXCLUDED.branch,
			root_directory = EXCLUDED.root_directory,
			dockerfile_path = EXCLUDED.dockerfile_path,
			build_configuration = EXCLUDED.build_configuration,
			auto_deploy = EXCLUDED.auto_deploy,
			source_status = 'active',
			disconnect_reason = NULL,
			updated_at = now()
		RETURNING id, service_id, repository_id, branch, root_directory, dockerfile_path,
		          build_configuration, auto_deploy, source_status, disconnect_reason,
		          last_seen_commit_sha, last_deployment_id
	`
	var res ServiceSourceResponse
	var buildConfigBytes []byte

	err = s.pool.QueryRow(ctx, upsertQuery,
		serviceID,
		req.RepositoryID,
		req.Branch,
		rootDir,
		dockerfilePtr,
		buildConfigJSON,
		autoDeploy,
	).Scan(
		&res.ID,
		&res.ServiceID,
		&res.Repository.ID,
		&res.Branch,
		&res.RootDirectory,
		&res.DockerfilePath,
		&buildConfigBytes,
		&res.AutoDeploy,
		&res.SourceStatus,
		&res.DisconnectReason,
		&res.LastSeenCommitSHA,
		&res.LastDeploymentID,
	)
	if err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to persist service source", err)
	}
	res.Repository.FullName = repoInfo.FullName
	res.BuildConfiguration = make(map[string]any)
	if len(buildConfigBytes) > 0 {
		_ = json.Unmarshal(buildConfigBytes, &res.BuildConfiguration)
	}

	if s.audit != nil {
		_ = s.audit.Write(ctx, audit.Event{
			UserID:      serviceUserID,
			ActorUserID: &actorUserID,
			Action:      audit.ActionSourceConnected,
			EntityType:  "service_source",
			EntityID:    res.ID,
			Metadata: map[string]any{
				"service_id":    serviceID.String(),
				"repository_id": req.RepositoryID.String(),
				"branch":        req.Branch,
			},
			IPAddress: ip,
			UserAgent: userAgent,
			RequestID: reqID,
		})
	}

	return &res, nil
}

// GetServiceSource retrieves the connected source configuration for a service.
func (s *Service) GetServiceSource(ctx context.Context, serviceID uuid.UUID) (*ServiceSourceResponse, error) {
	if s.pool == nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "database pool unavailable", nil)
	}

	query := `
		SELECT ss.id, ss.service_id, ss.repository_id, ss.branch, ss.root_directory,
		       ss.dockerfile_path, ss.build_configuration, ss.auto_deploy, ss.source_status,
		       ss.disconnect_reason, ss.last_seen_commit_sha, ss.last_deployment_id,
		       r.full_name
		FROM service_sources ss
		JOIN github_repositories r ON r.id = ss.repository_id
		WHERE ss.service_id = $1
	`
	var res ServiceSourceResponse
	var buildConfigBytes []byte

	err := s.pool.QueryRow(ctx, query, serviceID).Scan(
		&res.ID,
		&res.ServiceID,
		&res.Repository.ID,
		&res.Branch,
		&res.RootDirectory,
		&res.DockerfilePath,
		&buildConfigBytes,
		&res.AutoDeploy,
		&res.SourceStatus,
		&res.DisconnectReason,
		&res.LastSeenCommitSHA,
		&res.LastDeploymentID,
		&res.Repository.FullName,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, httpx.NewAPIError(404, httpx.CodeServiceSourceNotFound, "service source not found", nil)
		}
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to query service source", err)
	}

	res.BuildConfiguration = make(map[string]any)
	if len(buildConfigBytes) > 0 {
		_ = json.Unmarshal(buildConfigBytes, &res.BuildConfiguration)
	}

	return &res, nil
}

// PatchServiceSource partially updates a service's source configuration.
func (s *Service) PatchServiceSource(ctx context.Context, serviceID, actorUserID uuid.UUID, req PatchServiceSourceRequest, ip, userAgent, reqID string) (*ServiceSourceResponse, error) {
	if s.pool == nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "database pool unavailable", nil)
	}
	serviceUserID, err := authz.ServiceUser(ctx, s.pool, serviceID)
	if err != nil {
		if errors.Is(err, authz.ErrServiceNotFound) {
			return nil, httpx.NewAPIError(404, httpx.CodeNotFound, "service not found", nil)
		}
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to resolve service owner", err)
	}
	if serviceUserID != actorUserID {
		return nil, httpx.NewAPIError(404, httpx.CodeNotFound, "service not found", nil)
	}

	current, err := s.GetServiceSource(ctx, serviceID)
	if err != nil {
		return nil, err
	}

	branch := current.Branch
	if req.Branch != nil {
		if err := sourcepath.ValidateBranch(*req.Branch); err != nil {
			return nil, httpx.NewAPIError(400, httpx.CodeGitHubSourceInvalidBranch, err.Error(), err)
		}
		branch = *req.Branch
	}

	rootDir := current.RootDirectory
	if req.RootDirectory != nil {
		normalized, err := sourcepath.NormalizeRootDirectory(*req.RootDirectory)
		if err != nil {
			return nil, httpx.NewAPIError(400, httpx.CodeServiceSourceInvalidPath, "invalid root_directory: "+err.Error(), err)
		}
		rootDir = normalized
	}

	dockerfilePath := current.DockerfilePath
	if req.DockerfilePath != nil {
		normalized, err := sourcepath.ValidateDockerfilePath(*req.DockerfilePath)
		if err != nil {
			return nil, httpx.NewAPIError(400, httpx.CodeServiceSourceInvalidPath, "invalid dockerfile_path: "+err.Error(), err)
		}
		if normalized == "" {
			dockerfilePath = nil
		} else {
			dockerfilePath = &normalized
		}
	}

	buildConfig := current.BuildConfiguration
	if req.BuildConfiguration != nil {
		buildConfig = req.BuildConfiguration
	}
	buildConfigJSON, err := json.Marshal(buildConfig)
	if err != nil {
		return nil, httpx.NewAPIError(400, httpx.CodeBadRequest, "invalid build_configuration JSON", err)
	}

	autoDeploy := current.AutoDeploy
	if req.AutoDeploy != nil {
		autoDeploy = *req.AutoDeploy
	}

	updateQuery := `
		UPDATE service_sources
		SET branch = $2,
		    root_directory = $3,
		    dockerfile_path = $4,
		    build_configuration = $5,
		    auto_deploy = $6,
		    updated_at = now()
		WHERE service_id = $1
		RETURNING id, service_id, repository_id, branch, root_directory, dockerfile_path,
		          build_configuration, auto_deploy, source_status, disconnect_reason,
		          last_seen_commit_sha, last_deployment_id
	`
	var res ServiceSourceResponse
	var buildConfigBytes []byte

	err = s.pool.QueryRow(ctx, updateQuery,
		serviceID,
		branch,
		rootDir,
		dockerfilePath,
		buildConfigJSON,
		autoDeploy,
	).Scan(
		&res.ID,
		&res.ServiceID,
		&res.Repository.ID,
		&res.Branch,
		&res.RootDirectory,
		&res.DockerfilePath,
		&buildConfigBytes,
		&res.AutoDeploy,
		&res.SourceStatus,
		&res.DisconnectReason,
		&res.LastSeenCommitSHA,
		&res.LastDeploymentID,
	)
	if err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to update service source", err)
	}
	res.Repository.FullName = current.Repository.FullName
	res.BuildConfiguration = make(map[string]any)
	if len(buildConfigBytes) > 0 {
		_ = json.Unmarshal(buildConfigBytes, &res.BuildConfiguration)
	}

	if s.audit != nil {
		_ = s.audit.Write(ctx, audit.Event{
			UserID:      serviceUserID,
			ActorUserID: &actorUserID,
			Action:      audit.ActionSourceUpdated,
			EntityType:  "service_source",
			EntityID:    res.ID,
			Metadata: map[string]any{
				"service_id": serviceID.String(),
				"branch":     branch,
			},
			IPAddress: ip,
			UserAgent: userAgent,
			RequestID: reqID,
		})
	}

	return &res, nil
}

// DisconnectServiceSource marks a service's source as disconnected.
func (s *Service) DisconnectServiceSource(ctx context.Context, serviceID, actorUserID uuid.UUID, ip, userAgent, reqID string) (*DisconnectSourceResponse, error) {
	if s.pool == nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "database pool unavailable", nil)
	}
	serviceUserID, err := authz.ServiceUser(ctx, s.pool, serviceID)
	if err != nil {
		if errors.Is(err, authz.ErrServiceNotFound) {
			return nil, httpx.NewAPIError(404, httpx.CodeNotFound, "service not found", nil)
		}
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to resolve service owner", err)
	}
	if serviceUserID != actorUserID {
		return nil, httpx.NewAPIError(404, httpx.CodeNotFound, "service not found", nil)
	}

	updateQuery := `
		UPDATE service_sources
		SET source_status = 'disconnected', disconnect_reason = 'user_disconnected', updated_at = now()
		WHERE service_id = $1
		RETURNING id, service_id, source_status, disconnect_reason
	`
	var res DisconnectSourceResponse
	var discReason *string

	err = s.pool.QueryRow(ctx, updateQuery, serviceID).Scan(
		&res.ID,
		&res.ServiceID,
		&res.SourceStatus,
		&discReason,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, httpx.NewAPIError(404, httpx.CodeServiceSourceNotFound, "service source not found", nil)
		}
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to disconnect service source", err)
	}
	if discReason != nil {
		res.DisconnectReason = *discReason
	}

	if s.audit != nil {
		_ = s.audit.Write(ctx, audit.Event{
			UserID:      serviceUserID,
			ActorUserID: &actorUserID,
			Action:      audit.ActionSourceDisconnected,
			EntityType:  "service_source",
			EntityID:    res.ID,
			Metadata: map[string]any{
				"service_id": serviceID.String(),
				"reason":     "user_disconnected",
			},
			IPAddress: ip,
			UserAgent: userAgent,
			RequestID: reqID,
		})
	}

	return &res, nil
}

// CreateManualDeployment creates a manual deployment from the connected source.
// It resolves the ref to an exact commit SHA via the GitHub App API,
// creates deployments, build_jobs, and outbox_events records atomically in a transaction.
func (s *Service) CreateManualDeployment(ctx context.Context, serviceID, actorUserID uuid.UUID, idempotencyKey string, req ManualDeploymentRequest, ip, userAgent, reqID string) (*ManualDeploymentResponse, error) {
	if s.pool == nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "database pool unavailable", nil)
	}

	// 1. Resolve hierarchy: service -> environment -> project -> personal user.
	var hierarchy struct {
		ServiceID     uuid.UUID
		EnvironmentID uuid.UUID
		ProjectID     uuid.UUID
		UserID        uuid.UUID
	}
	hierarchyQuery := `
		SELECT s.id, s.environment_id, e.project_id, p.user_id
		FROM services s
		JOIN environments e ON e.id = s.environment_id
		JOIN projects p ON p.id = e.project_id
		WHERE s.id = $1 AND s.deleted_at IS NULL AND e.deleted_at IS NULL AND p.deleted_at IS NULL
	`
	err := s.pool.QueryRow(ctx, hierarchyQuery, serviceID).Scan(
		&hierarchy.ServiceID,
		&hierarchy.EnvironmentID,
		&hierarchy.ProjectID,
		&hierarchy.UserID,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, httpx.NewAPIError(404, httpx.CodeNotFound, "service not found", nil)
		}
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to query service hierarchy", err)
	}
	if hierarchy.UserID != actorUserID {
		return nil, httpx.NewAPIError(404, httpx.CodeNotFound, "service not found", nil)
	}

	// Image and managed addon services do not have a GitHub source or build job.
	// They enter the same rollout queue at image_ready with an immutable image ref.
	if s.platformStore != nil && s.deploymentStore != nil {
		service, err := s.platformStore.GetServiceForUser(ctx, actorUserID, serviceID)
		if err != nil {
			return nil, platformStoreAPIError(err)
		}
		if service.Type == platformdb.ServiceTypeImage || service.Type == platformdb.ServiceTypePostgres || service.Type == platformdb.ServiceTypeRedis {
			return s.createBuildlessDeployment(ctx, service.Type, serviceID, actorUserID, idempotencyKey)
		}
	}

	// 2. Load connected active service source
	var sourceInfo struct {
		SourceID           uuid.UUID
		RepositoryID       uuid.UUID
		Branch             string
		RootDirectory      string
		DockerfilePath     *string
		BuildConfiguration []byte
		SourceStatus       string
		GitHubRepoID       int64
		OwnerLogin         string
		RepoName           string
		FullName           string
		GitHubInstID       int64
		InstStatus         string
	}
	sourceQuery := `
		SELECT ss.id, ss.repository_id, ss.branch, ss.root_directory, ss.dockerfile_path,
		       ss.build_configuration, ss.source_status,
		       r.github_repository_id, r.owner_login, r.name, r.full_name,
		       i.github_installation_id, i.status
		FROM service_sources ss
		JOIN github_repositories r ON r.id = ss.repository_id
		JOIN github_installations i ON i.id = r.installation_id
		WHERE ss.service_id = $1
	`
	err = s.pool.QueryRow(ctx, sourceQuery, serviceID).Scan(
		&sourceInfo.SourceID,
		&sourceInfo.RepositoryID,
		&sourceInfo.Branch,
		&sourceInfo.RootDirectory,
		&sourceInfo.DockerfilePath,
		&sourceInfo.BuildConfiguration,
		&sourceInfo.SourceStatus,
		&sourceInfo.GitHubRepoID,
		&sourceInfo.OwnerLogin,
		&sourceInfo.RepoName,
		&sourceInfo.FullName,
		&sourceInfo.GitHubInstID,
		&sourceInfo.InstStatus,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, httpx.NewAPIError(404, httpx.CodeServiceSourceNotFound, "service source not configured", nil)
		}
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to query service source", err)
	}

	if sourceInfo.SourceStatus != "active" {
		return nil, httpx.NewAPIError(409, httpx.CodeConflict, "service source is not active", nil)
	}

	if sourceInfo.InstStatus != "active" {
		return nil, httpx.NewAPIError(400, httpx.CodeGitHubInstallationNotActive, "github installation is not active", nil)
	}

	// 3. Resolve commit SHA via GitHub API
	refToResolve := strings.TrimSpace(req.Source.Ref)
	if refToResolve == "" {
		refToResolve = sourceInfo.Branch
	}
	branchName := refToResolve
	if strings.HasPrefix(refToResolve, "refs/heads/") {
		branchName = strings.TrimPrefix(refToResolve, "refs/heads/")
	}

	if s.ghClient == nil {
		return nil, httpx.NewAPIError(503, httpx.CodeGitHubAppNotConfigured, "GitHub client is not configured", nil)
	}

	commit, err := s.ghClient.GetCommit(ctx, sourceInfo.GitHubInstID, sourceInfo.OwnerLogin, sourceInfo.RepoName, refToResolve)
	if err != nil {
		s.logger.WarnContext(ctx, "failed to resolve commit ref from GitHub",
			"repo", sourceInfo.FullName, "ref", refToResolve, "error", err)
		return nil, httpx.NewAPIError(400, httpx.CodeGitHubSourceInvalidBranch, fmt.Sprintf("unable to resolve ref %q: %v", refToResolve, err), err)
	}

	commitSHA := strings.TrimSpace(commit.SHA)

	// 4. Idempotency handling
	if idempotencyKey == "" {
		idempotencyKey = uuid.New().String()
	}

	var existingDeployment struct {
		ID        uuid.UUID
		Status    string
		CommitSHA string
	}
	checkIdempQuery := `
		SELECT id, status, git_commit_sha
		FROM deployments
		WHERE project_id = $1 AND idempotency_key = $2
	`
	err = s.pool.QueryRow(ctx, checkIdempQuery, hierarchy.ProjectID, idempotencyKey).Scan(
		&existingDeployment.ID,
		&existingDeployment.Status,
		&existingDeployment.CommitSHA,
	)
	if err == nil {
		// Existing deployment found with same idempotency key - return idempotently
		var buildJobID uuid.UUID
		_ = s.pool.QueryRow(ctx, `SELECT id FROM build_jobs WHERE deployment_id = $1`, existingDeployment.ID).Scan(&buildJobID)
		response := &ManualDeploymentResponse{
			ID:        existingDeployment.ID,
			ServiceID: serviceID,
			Status:    existingDeployment.Status,
			CommitSHA: existingDeployment.CommitSHA,
		}
		if buildJobID != uuid.Nil {
			response.BuildJobID = &buildJobID
		}
		return response, nil
	}

	// 5. Transactional insert: deployments + build_jobs + outbox_events + service_sources update
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to begin transaction", err)
	}
	defer tx.Rollback(ctx)

	var buildConfigMap map[string]any
	if len(sourceInfo.BuildConfiguration) > 0 {
		_ = json.Unmarshal(sourceInfo.BuildConfiguration, &buildConfigMap)
	}
	if buildConfigMap == nil {
		buildConfigMap = map[string]any{}
	}

	sourceSnapshot := map[string]any{
		"platform_repository_id": sourceInfo.RepositoryID.String(),
		"github_repository_id":   sourceInfo.GitHubRepoID,
		"full_name":              sourceInfo.FullName,
		"branch":                 branchName,
		"ref":                    refToResolve,
		"commit_sha":             commit.SHA,
		"root_directory":         sourceInfo.RootDirectory,
		"dockerfile_path":        sourceInfo.DockerfilePath,
		"build_configuration":    buildConfigMap,
	}
	snapshotBytes, err := json.Marshal(sourceSnapshot)
	if err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to marshal source snapshot", err)
	}

	// Insert into deployments
	var deploymentID uuid.UUID
	insertDepQuery := `
		INSERT INTO deployments (
			project_id, environment_id, service_id, service_source_id,
			git_commit_sha, git_branch, status, trigger_type, ref,
			source_snapshot, triggered_by_user_id, idempotency_key
		) VALUES (
			$1, $2, $3, $4,
			$5, $6, 'queued', 'manual', $7,
			$8, $9, $10
		) RETURNING id
	`
	err = tx.QueryRow(ctx, insertDepQuery,
		hierarchy.ProjectID,
		hierarchy.EnvironmentID,
		serviceID,
		sourceInfo.SourceID,
		commitSHA,
		branchName,
		refToResolve,
		snapshotBytes,
		actorUserID,
		idempotencyKey,
	).Scan(&deploymentID)
	if err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to insert deployment", err)
	}

	// Insert into build_jobs (spec 6.7 deviation: build_jobs is the durable build request)
	var buildJobID uuid.UUID
	insertBuildQuery := `
		INSERT INTO build_jobs (
			deployment_id, service_source_id, repository_id, commit_sha, ref,
			status, requested_at
		) VALUES (
			$1, $2, $3, $4, $5,
			'queued', now()
		) RETURNING id
	`
	err = tx.QueryRow(ctx, insertBuildQuery,
		deploymentID,
		sourceInfo.SourceID,
		sourceInfo.RepositoryID,
		commit.SHA,
		refToResolve,
	).Scan(&buildJobID)
	if err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to insert build job", err)
	}

	// Insert outbox event per spec 9.3
	outboxEventID := uuid.New()
	outboxPayload := map[string]any{
		"event_id":          outboxEventID.String(),
		"deployment_id":     deploymentID.String(),
		"build_run_id":      buildJobID.String(),
		"service_id":        serviceID.String(),
		"service_source_id": sourceInfo.SourceID.String(),
		"user_id":           hierarchy.UserID.String(),
		"project_id":        hierarchy.ProjectID.String(),
		"environment_id":    hierarchy.EnvironmentID.String(),
		"repository": map[string]any{
			"platform_repository_id": sourceInfo.RepositoryID.String(),
			"github_repository_id":   sourceInfo.GitHubRepoID,
			"full_name":              sourceInfo.FullName,
		},
		"source": map[string]any{
			"branch":          branchName,
			"ref":             refToResolve,
			"commit_sha":      commit.SHA,
			"root_directory":  sourceInfo.RootDirectory,
			"dockerfile_path": sourceInfo.DockerfilePath,
		},
		"build_configuration": buildConfigMap,
		"trigger": map[string]any{
			"type": "manual",
		},
	}
	outboxBytes, err := json.Marshal(outboxPayload)
	if err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to marshal outbox event", err)
	}

	insertOutboxQuery := `
		INSERT INTO outbox_events (
			aggregate_type, aggregate_id, event_type, payload, status
		) VALUES (
			'deployment', $1, 'deployment.build.requested', $2, 'pending'
		)
	`
	if _, err := tx.Exec(ctx, insertOutboxQuery, deploymentID, outboxBytes); err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to insert outbox event", err)
	}

	// Update service source with last seen commit and deployment ID
	updateSourceQuery := `
		UPDATE service_sources
		SET last_seen_commit_sha = $1, last_deployment_id = $2, updated_at = now()
		WHERE id = $3
	`
	if _, err := tx.Exec(ctx, updateSourceQuery, commit.SHA, deploymentID, sourceInfo.SourceID); err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to update service source tracking", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "failed to commit deployment transaction", err)
	}

	if s.audit != nil {
		_ = s.audit.Write(ctx, audit.Event{
			UserID:      hierarchy.UserID,
			ActorUserID: &actorUserID,
			Action:      audit.ActionDeploymentManualRequested,
			EntityType:  "deployment",
			EntityID:    deploymentID,
			Metadata: map[string]any{
				"service_id":   serviceID.String(),
				"commit_sha":   commit.SHA,
				"build_job_id": buildJobID.String(),
				"ref":          refToResolve,
			},
			IPAddress: ip,
			UserAgent: userAgent,
			RequestID: reqID,
		})
	}

	return &ManualDeploymentResponse{
		ID:         deploymentID,
		ServiceID:  serviceID,
		Status:     "queued",
		CommitSHA:  commit.SHA,
		BuildJobID: &buildJobID,
	}, nil
}

func (s *Service) createBuildlessDeployment(ctx context.Context, serviceType string, serviceID, userID uuid.UUID, idempotencyKey string) (*ManualDeploymentResponse, error) {
	var result *platformdb.CreateDeploymentResult
	var err error
	switch serviceType {
	case platformdb.ServiceTypeImage:
		image, getErr := s.platformStore.GetServiceImageSource(ctx, userID, serviceID)
		if getErr != nil {
			return nil, platformStoreAPIError(getErr)
		}
		resolve := s.resolveImage
		if resolve == nil {
			resolve = registry.ResolveDigest
		}
		imageRef, resolveErr := resolve(ctx, image.Image)
		if resolveErr != nil {
			s.logger.WarnContext(ctx, "failed to resolve image reference", "service_id", serviceID, "error", resolveErr)
			return nil, httpx.NewAPIError(422, httpx.CodeImageResolveFailed, "could not resolve image to an immutable digest", resolveErr)
		}
		result, err = s.deploymentStore.CreateImageDeployment(ctx, platformdb.CreateImageDeploymentParams{
			UserID: userID, ServiceID: serviceID, IdempotencyKey: idempotencyKey,
			TriggeredByUserID: &userID, ImageRef: imageRef,
		})
	case platformdb.ServiceTypePostgres, platformdb.ServiceTypeRedis:
		addon, getErr := s.platformStore.GetServiceAddon(ctx, userID, serviceID)
		if getErr != nil {
			return nil, platformStoreAPIError(getErr)
		}
		pinned, ok := catalog.AddonFor(addon.Engine)
		if !ok || pinned.Version != addon.Version {
			return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "managed addon image is not available", nil)
		}
		result, err = s.deploymentStore.CreateAddonDeployment(ctx, platformdb.CreateAddonDeploymentParams{
			UserID: userID, ServiceID: serviceID, IdempotencyKey: idempotencyKey,
			TriggeredByUserID: &userID, ImageRef: pinned.Image,
		})
	default:
		return nil, httpx.NewAPIError(400, httpx.CodeValidationFailed, "service type does not support buildless deployment", nil)
	}
	if err != nil {
		return nil, platformStoreAPIError(err)
	}
	if result == nil {
		return nil, httpx.NewAPIError(500, httpx.CodeInternalError, "deployment store returned no deployment", nil)
	}
	response := &ManualDeploymentResponse{
		ID: result.Deployment.ID, ServiceID: serviceID, Status: string(result.Deployment.Status),
		CommitSHA: "",
	}
	if result.BuildJob.ID != uuid.Nil {
		id := result.BuildJob.ID
		response.BuildJobID = &id
	}
	return response, nil
}

func platformStoreAPIError(err error) error {
	switch {
	case errors.Is(err, platformdb.ErrNotFound):
		return httpx.NewAPIError(404, httpx.CodeNotFound, "service not found", err)
	case errors.Is(err, platformdb.ErrInvalidArgument):
		return httpx.NewAPIError(400, httpx.CodeValidationFailed, "invalid deployment request", err)
	case errors.Is(err, platformdb.ErrConflict):
		return httpx.NewAPIError(409, httpx.CodeConflict, "deployment conflicts with an existing request", err)
	default:
		return httpx.NewAPIError(500, httpx.CodeInternalError, "failed to create deployment", err)
	}
}
