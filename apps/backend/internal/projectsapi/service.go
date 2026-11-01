package projectsapi

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/catalog"
	"github.com/summit/backend/internal/platformdb"
	"github.com/summit/backend/internal/registry"
)

// Store is the slice of platformdb the service depends on. *platformdb.Store
// satisfies it; unit tests fake it.
type Store interface {
	CreateProject(ctx context.Context, userID uuid.UUID, p platformdb.CreateProjectParams) (*platformdb.Project, *platformdb.Environment, error)
	ListProjects(ctx context.Context, userID uuid.UUID, lp platformdb.ListParams) (platformdb.Page[platformdb.Project], error)
	GetProjectForUser(ctx context.Context, userID, projectID uuid.UUID) (*platformdb.Project, error)
	UpdateProject(ctx context.Context, userID, projectID uuid.UUID, u platformdb.UpdateProjectParams) (*platformdb.Project, error)
	SoftDeleteProject(ctx context.Context, userID, projectID uuid.UUID) error
	ListEnvironments(ctx context.Context, userID, projectID uuid.UUID) ([]platformdb.Environment, error)
	CreateEnvironment(ctx context.Context, userID, projectID uuid.UUID, name, envType string) (*platformdb.Environment, error)
	CreateService(ctx context.Context, userID, environmentID uuid.UUID, name, serviceType string) (*platformdb.Service, error)
	CreateTypedService(ctx context.Context, userID, environmentID uuid.UUID, spec platformdb.ServiceCreate) (*platformdb.Service, error)
	ListServicesByProject(ctx context.Context, userID, projectID uuid.UUID) ([]platformdb.Service, error)
	SoftDeleteService(ctx context.Context, userID, serviceID uuid.UUID) (*platformdb.Service, error)

	CountServicesByProject(ctx context.Context, userID uuid.UUID, projectIDs []uuid.UUID) (map[uuid.UUID]int, error)
	LatestDeploymentsByProject(ctx context.Context, userID uuid.UUID, projectIDs []uuid.UUID) (map[uuid.UUID]platformdb.Deployment, error)
	LatestDeploymentsByService(ctx context.Context, userID uuid.UUID, serviceIDs []uuid.UUID) (map[uuid.UUID]platformdb.Deployment, error)
	ServiceSourcesByService(ctx context.Context, userID uuid.UUID, serviceIDs []uuid.UUID) (map[uuid.UUID]platformdb.ServiceSourceInfo, error)
	ServiceImageSourcesByService(ctx context.Context, userID uuid.UUID, serviceIDs []uuid.UUID) (map[uuid.UUID]platformdb.ServiceImageSource, error)
	ServiceAddonsByService(ctx context.Context, userID uuid.UUID, serviceIDs []uuid.UUID) (map[uuid.UUID]platformdb.ServiceAddon, error)
	ServicePortsByService(ctx context.Context, userID uuid.UUID, serviceIDs []uuid.UUID) (map[uuid.UUID]int, error)

	ListDeploymentsForProject(ctx context.Context, userID, projectID uuid.UUID, lp platformdb.ListParams) (platformdb.Page[platformdb.Deployment], error)
	GetDeploymentForUser(ctx context.Context, userID, deploymentID uuid.UUID) (*platformdb.DeploymentDetail, error)
	RequestCancel(ctx context.Context, userID, deploymentID uuid.UUID) (*platformdb.Deployment, error)
	ListDeploymentLogsForUser(ctx context.Context, userID, deploymentID uuid.UUID, afterID int64, limit int) ([]platformdb.BuildLogLine, error)
}

var _ Store = (*platformdb.Store)(nil)

// maxDerivedSlugAttempts bounds the "-2", "-3", ... retries when a slug was
// derived from the project name and collides with an existing project.
const maxDerivedSlugAttempts = 10

// Service implements the project/deployment use cases.
type Service struct {
	store Store
}

// NewService returns a Service over store.
func NewService(store Store) *Service { return &Service{store: store} }

func invalid(format string, a ...any) error {
	return fmt.Errorf("%w: %s", platformdb.ErrInvalidArgument, fmt.Sprintf(format, a...))
}

// ListProjects returns one page of the user's projects with service counts and
// latest deployments, using two batched queries regardless of page size.
func (s *Service) ListProjects(ctx context.Context, userID uuid.UUID, lp platformdb.ListParams) (*ProjectList, error) {
	page, err := s.store.ListProjects(ctx, userID, lp)
	if err != nil {
		return nil, err
	}
	summaries, err := s.summarize(ctx, userID, page.Items)
	if err != nil {
		return nil, err
	}
	out := &ProjectList{Data: summaries}
	if page.NextCursor != "" {
		c := page.NextCursor
		out.NextCursor = &c
	}
	return out, nil
}

// summarize builds ProjectSummary values for projects with batched lookups.
func (s *Service) summarize(ctx context.Context, userID uuid.UUID, projects []platformdb.Project) ([]ProjectSummary, error) {
	out := make([]ProjectSummary, 0, len(projects))
	if len(projects) == 0 {
		return out, nil
	}
	ids := make([]uuid.UUID, len(projects))
	for i, p := range projects {
		ids[i] = p.ID
	}
	counts, err := s.store.CountServicesByProject(ctx, userID, ids)
	if err != nil {
		return nil, err
	}
	latest, err := s.store.LatestDeploymentsByProject(ctx, userID, ids)
	if err != nil {
		return nil, err
	}
	for _, p := range projects {
		var ld *platformdb.Deployment
		if d, ok := latest[p.ID]; ok {
			d := d
			ld = &d
		}
		out = append(out, toProjectSummary(p, counts[p.ID], ld))
	}
	return out, nil
}

// CreateProject creates a project (and its production environment). When no
// slug is supplied one is derived from the name and, on collision, retried
// with -2, -3, ... suffixes. An explicit slug that collides yields ErrConflict.
func (s *Service) CreateProject(ctx context.Context, userID uuid.UUID, req CreateProjectRequest) (*ProjectSummary, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" || len(name) > 255 {
		return nil, invalid("name must be 1-255 characters")
	}

	if req.Slug != nil && strings.TrimSpace(*req.Slug) != "" {
		p, _, err := s.store.CreateProject(ctx, userID, platformdb.CreateProjectParams{Slug: strings.TrimSpace(*req.Slug), Name: name})
		if err != nil {
			return nil, err
		}
		sum := toProjectSummary(*p, 0, nil)
		return &sum, nil
	}

	base := DeriveSlug(name)
	for attempt := 1; attempt <= maxDerivedSlugAttempts; attempt++ {
		slug := base
		if attempt > 1 {
			slug = slugWithSuffix(base, attempt)
		}
		p, _, err := s.store.CreateProject(ctx, userID, platformdb.CreateProjectParams{Slug: slug, Name: name})
		if errors.Is(err, platformdb.ErrConflict) {
			continue
		}
		if err != nil {
			return nil, err
		}
		sum := toProjectSummary(*p, 0, nil)
		return &sum, nil
	}
	return nil, fmt.Errorf("%w: could not find a free slug for %q; provide one explicitly", platformdb.ErrConflict, name)
}

// GetProject returns a project with its environments and services.
func (s *Service) GetProject(ctx context.Context, userID, projectID uuid.UUID) (*ProjectDetail, error) {
	p, err := s.store.GetProjectForUser(ctx, userID, projectID)
	if err != nil {
		return nil, err
	}
	envs, err := s.store.ListEnvironments(ctx, userID, projectID)
	if err != nil {
		return nil, err
	}
	svcs, err := s.store.ListServicesByProject(ctx, userID, projectID)
	if err != nil {
		return nil, err
	}
	latestProject, err := s.store.LatestDeploymentsByProject(ctx, userID, []uuid.UUID{projectID})
	if err != nil {
		return nil, err
	}
	services, err := s.summarizeServices(ctx, userID, svcs)
	if err != nil {
		return nil, err
	}

	var ld *platformdb.Deployment
	if d, ok := latestProject[projectID]; ok {
		ld = &d
	}
	detail := &ProjectDetail{
		ProjectSummary: toProjectSummary(*p, len(svcs), ld),
		Environments:   make([]EnvironmentView, 0, len(envs)),
		Services:       services,
	}
	for _, e := range envs {
		detail.Environments = append(detail.Environments, EnvironmentView{ID: e.ID, Name: e.Name, Type: e.Type, IsEphemeral: e.IsEphemeral})
	}
	return detail, nil
}

func (s *Service) summarizeServices(ctx context.Context, userID uuid.UUID, svcs []platformdb.Service) ([]ServiceSummary, error) {
	out := make([]ServiceSummary, 0, len(svcs))
	if len(svcs) == 0 {
		return out, nil
	}
	ids := make([]uuid.UUID, len(svcs))
	for i, sv := range svcs {
		ids[i] = sv.ID
	}
	latest, err := s.store.LatestDeploymentsByService(ctx, userID, ids)
	if err != nil {
		return nil, err
	}
	sources, err := s.store.ServiceSourcesByService(ctx, userID, ids)
	if err != nil {
		return nil, err
	}
	images, err := s.store.ServiceImageSourcesByService(ctx, userID, ids)
	if err != nil {
		return nil, err
	}
	addons, err := s.store.ServiceAddonsByService(ctx, userID, ids)
	if err != nil {
		return nil, err
	}
	ports, err := s.store.ServicePortsByService(ctx, userID, ids)
	if err != nil {
		return nil, err
	}
	for _, sv := range svcs {
		var ld *platformdb.Deployment
		if d, ok := latest[sv.ID]; ok {
			d := d
			ld = &d
		}
		var src *platformdb.ServiceSourceInfo
		if si, ok := sources[sv.ID]; ok {
			si := si
			src = &si
		}
		var image *platformdb.ServiceImageSource
		if im, ok := images[sv.ID]; ok {
			im := im
			image = &im
		}
		var addon *platformdb.ServiceAddon
		if ad, ok := addons[sv.ID]; ok {
			ad := ad
			addon = &ad
		}
		var port *int
		if p, ok := ports[sv.ID]; ok {
			p := p
			port = &p
		}
		out = append(out, toServiceSummary(sv, src, ld, image, addon, port))
	}
	return out, nil
}

// UpdateProject renames a project.
func (s *Service) UpdateProject(ctx context.Context, userID, projectID uuid.UUID, req UpdateProjectRequest) (*ProjectSummary, error) {
	p, err := s.store.UpdateProject(ctx, userID, projectID, platformdb.UpdateProjectParams{Name: req.Name})
	if err != nil {
		return nil, err
	}
	sums, err := s.summarize(ctx, userID, []platformdb.Project{*p})
	if err != nil {
		return nil, err
	}
	return &sums[0], nil
}

// DeleteProject soft-deletes a project.
func (s *Service) DeleteProject(ctx context.Context, userID, projectID uuid.UUID) error {
	return s.store.SoftDeleteProject(ctx, userID, projectID)
}

// DeleteService soft-deletes one service owned by userID.
func (s *Service) DeleteService(ctx context.Context, userID, serviceID uuid.UUID) error {
	_, err := s.store.SoftDeleteService(ctx, userID, serviceID)
	return err
}

// CreateEnvironment adds a staging or preview environment to a project.
func (s *Service) CreateEnvironment(ctx context.Context, userID, projectID uuid.UUID, req CreateEnvironmentRequest) (*EnvironmentView, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, invalid("name is required")
	}
	env, err := s.store.CreateEnvironment(ctx, userID, projectID, name, strings.TrimSpace(req.Type))
	if err != nil {
		return nil, err
	}
	return &EnvironmentView{ID: env.ID, Name: env.Name, Type: env.Type, IsEphemeral: env.IsEphemeral}, nil
}

// CreateService creates a web, worker, image, postgres, or redis service.
// The environment defaults to production. environment_id must belong to this project.
func (s *Service) CreateService(ctx context.Context, userID, projectID uuid.UUID, req CreateServiceRequest) (*ServiceSummary, error) {
	svcType := strings.TrimSpace(req.Type)
	if svcType == "" {
		svcType = platformdb.ServiceTypeWeb
	}
	switch svcType {
	case platformdb.ServiceTypeWeb, platformdb.ServiceTypeWorker, platformdb.ServiceTypeImage, platformdb.ServiceTypePostgres, platformdb.ServiceTypeRedis:
	default:
		return nil, invalid("type must be web, worker, image, postgres or redis")
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, invalid("name is required")
	}
	image := strings.TrimSpace(req.Image)
	if svcType == platformdb.ServiceTypeImage {
		if image == "" {
			return nil, invalid("image is required for type image")
		}
		if err := registry.ValidateRef(image); err != nil {
			return nil, invalid("invalid image reference")
		}
	} else if image != "" {
		return nil, invalid("image is only valid for image services")
	}
	if req.Port != nil && svcType != platformdb.ServiceTypeWeb && svcType != platformdb.ServiceTypeImage {
		return nil, invalid("port is only valid for web and image services")
	}
	if req.Port != nil && (*req.Port < 1 || *req.Port > 65535) {
		return nil, invalid("port must be 1-65535")
	}

	envs, err := s.store.ListEnvironments(ctx, userID, projectID)
	if err != nil {
		return nil, err // ErrNotFound for foreign/unknown/deleted project
	}
	var envID uuid.UUID
	if req.EnvironmentID != nil {
		// The environment must belong to *this* project, not merely to the user.
		found := false
		for _, e := range envs {
			if e.ID == *req.EnvironmentID {
				found = true
				break
			}
		}
		if !found {
			return nil, platformdb.ErrNotFound
		}
		envID = *req.EnvironmentID
	} else {
		id, ok := productionEnvironment(envs)
		if !ok {
			return nil, invalid("project has no production environment; pass environment_id")
		}
		envID = id
	}

	spec := platformdb.ServiceCreate{Name: name, Type: svcType, Image: image, Port: req.Port}
	if svcType == platformdb.ServiceTypePostgres || svcType == platformdb.ServiceTypeRedis {
		addon, ok := catalog.AddonFor(svcType)
		if !ok {
			return nil, invalid("unknown addon engine")
		}
		spec.AddonEngine = addon.Engine
		spec.AddonVersion = addon.Version
		spec.StorageMB = catalog.DefaultStorageMB
	}
	sv, err := s.store.CreateTypedService(ctx, userID, envID, spec)
	if err != nil {
		return nil, err
	}
	sums, err := s.summarizeServices(ctx, userID, []platformdb.Service{*sv})
	if err != nil {
		return nil, err
	}
	return &sums[0], nil
}

func productionEnvironment(envs []platformdb.Environment) (uuid.UUID, bool) {
	for _, e := range envs {
		if e.Type == "production" && !e.IsEphemeral {
			return e.ID, true
		}
	}
	for _, e := range envs {
		if e.Name == platformdb.DefaultEnvironmentName {
			return e.ID, true
		}
	}
	return uuid.Nil, false
}

// ListDeployments returns a page of the project's deployments, newest first.
func (s *Service) ListDeployments(ctx context.Context, userID, projectID uuid.UUID, lp platformdb.ListParams) (*DeploymentList, error) {
	page, err := s.store.ListDeploymentsForProject(ctx, userID, projectID, lp)
	if err != nil {
		return nil, err
	}
	out := &DeploymentList{Data: make([]DeploymentSummary, 0, len(page.Items))}
	for _, d := range page.Items {
		out.Data = append(out.Data, toDeploymentSummary(d))
	}
	if page.NextCursor != "" {
		c := page.NextCursor
		out.NextCursor = &c
	}
	return out, nil
}

// GetDeployment returns a deployment with its build job and events.
func (s *Service) GetDeployment(ctx context.Context, userID, deploymentID uuid.UUID) (*DeploymentDetail, error) {
	d, err := s.store.GetDeploymentForUser(ctx, userID, deploymentID)
	if err != nil {
		return nil, err
	}
	out := toDeploymentDetail(d)
	return &out, nil
}

// CancelDeployment records a cancel request on an in-flight deployment. The
// orchestrator performs the actual transition, so the returned status may
// still be the in-flight one; cancel_requested_at is set.
func (s *Service) CancelDeployment(ctx context.Context, userID, deploymentID uuid.UUID) (*DeploymentSummary, error) {
	d, err := s.store.RequestCancel(ctx, userID, deploymentID)
	if err != nil {
		return nil, err
	}
	out := toDeploymentSummary(*d)
	return &out, nil
}

// ListLogs returns build log lines with id > after.
func (s *Service) ListLogs(ctx context.Context, userID, deploymentID uuid.UUID, after int64, limit int) (*LogList, error) {
	lines, err := s.store.ListDeploymentLogsForUser(ctx, userID, deploymentID, after, limit)
	if err != nil {
		return nil, err
	}
	out := &LogList{Data: make([]LogLine, 0, len(lines))}
	for _, l := range lines {
		out.Data = append(out.Data, LogLine{
			ID:        l.ID,
			Timestamp: l.LoggedAt.UTC(),
			Stream:    l.Stream,
			Level:     l.Level,
			Stage:     l.Stage,
			Message:   l.Message,
		})
	}
	if n := len(lines); n > 0 {
		last := lines[n-1].ID
		out.NextAfter = &last
	}
	return out, nil
}
