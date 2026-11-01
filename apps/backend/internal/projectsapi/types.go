// Package projectsapi serves the dashboard-facing project, service and
// deployment routes under /v1. It is a thin, tenant-scoped HTTP layer over
// platformdb: every query is filtered by the authenticated user's id, and a
// row owned by someone else is indistinguishable from a missing one (404).
package projectsapi

import (
	"time"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/catalog"
	"github.com/summit/backend/internal/platformdb"
)

// ServiceSource is the GitHub source summary embedded in ServiceSummary.
type ServiceSource struct {
	RepositoryFullName string `json:"repository_full_name"`
	Branch             string `json:"branch"`
	RootDirectory      string `json:"root_directory"`
	SourceStatus       string `json:"source_status"`
	AutoDeploy         bool   `json:"auto_deploy"`
}

// DeploymentSummary is the list/embedded view of a deployment.
type DeploymentSummary struct {
	ID                uuid.UUID  `json:"id"`
	ProjectID         uuid.UUID  `json:"project_id"`
	EnvironmentID     uuid.UUID  `json:"environment_id"`
	ServiceID         *uuid.UUID `json:"service_id"`
	Status            string     `json:"status"`
	CommitSHA         string     `json:"commit_sha"`
	Branch            string     `json:"branch"`
	TriggerType       string     `json:"trigger_type"`
	ErrorMessage      *string    `json:"error_message"`
	StatusReason      *string    `json:"status_reason"`
	ImageRef          *string    `json:"image_ref"`
	PublicURL         *string    `json:"public_url"`
	CancelRequestedAt *time.Time `json:"cancel_requested_at"`
	CreatedAt         time.Time  `json:"created_at"`
	StartedAt         *time.Time `json:"started_at"`
	FinishedAt        *time.Time `json:"finished_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

// BuildSummary is the build job embedded in DeploymentDetail.
type BuildSummary struct {
	ID              uuid.UUID  `json:"id"`
	Status          string     `json:"status"`
	CurrentStage    *string    `json:"current_stage"`
	ImageRepository *string    `json:"image_repository"`
	ImageTag        *string    `json:"image_tag"`
	ImageDigest     *string    `json:"image_digest"`
	ErrorMessage    *string    `json:"error_message"`
	RequestedAt     time.Time  `json:"requested_at"`
	StartedAt       *time.Time `json:"started_at"`
	CompletedAt     *time.Time `json:"completed_at"`
}

// DeploymentEventView is one status transition of a deployment.
type DeploymentEventView struct {
	FromStatus *string   `json:"from_status"`
	ToStatus   string    `json:"to_status"`
	Reason     *string   `json:"reason"`
	CreatedAt  time.Time `json:"created_at"`
}

// DeploymentDetail is DeploymentSummary plus build job and transition history.
type DeploymentDetail struct {
	DeploymentSummary
	Build  *BuildSummary         `json:"build"`
	Events []DeploymentEventView `json:"events"`
}

// ServiceImage is the user-supplied image ref and the digest from the latest deployment.
type ServiceImage struct {
	Image         string  `json:"image"`
	ResolvedImage *string `json:"resolved_image"`
}

// ServiceAddon is a managed postgres or redis service. url_env comes from the catalog.
type ServiceAddon struct {
	Engine    string `json:"engine"`
	Version   string `json:"version"`
	StorageMB int    `json:"storage_mb"`
	URLEnv    string `json:"url_env"`
}

// ServiceSummary is a service with its source and latest deployment.
type ServiceSummary struct {
	ID               uuid.UUID          `json:"id"`
	ProjectID        uuid.UUID          `json:"project_id"`
	EnvironmentID    uuid.UUID          `json:"environment_id"`
	EnvironmentName  string             `json:"environment_name"`
	Name             string             `json:"name"`
	Type             string             `json:"type"`
	Source           *ServiceSource     `json:"source"`
	LatestDeployment *DeploymentSummary `json:"latest_deployment"`
	Image            *ServiceImage      `json:"image"`
	Addon            *ServiceAddon      `json:"addon"`
	Port             *int               `json:"port"`
	CreatedAt        time.Time          `json:"created_at"`
	UpdatedAt        time.Time          `json:"updated_at"`
}

// ProjectSummary is the list view of a project.
type ProjectSummary struct {
	ID               uuid.UUID          `json:"id"`
	Slug             string             `json:"slug"`
	Name             string             `json:"name"`
	GitRepositoryURL *string            `json:"git_repository_url"`
	DefaultBranch    string             `json:"default_branch"`
	ServicesCount    int                `json:"services_count"`
	LatestDeployment *DeploymentSummary `json:"latest_deployment"`
	CreatedAt        time.Time          `json:"created_at"`
	UpdatedAt        time.Time          `json:"updated_at"`
}

// EnvironmentView is an environment of a project.
type EnvironmentView struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	IsEphemeral bool      `json:"is_ephemeral"`
}

// ProjectDetail is ProjectSummary plus environments and services.
type ProjectDetail struct {
	ProjectSummary
	Environments []EnvironmentView `json:"environments"`
	Services     []ServiceSummary  `json:"services"`
}

// ProjectList is the paginated response of GET /v1/projects.
type ProjectList struct {
	Data       []ProjectSummary `json:"data"`
	NextCursor *string          `json:"next_cursor"`
}

// DeploymentList is the paginated response of GET /v1/projects/{id}/deployments.
type DeploymentList struct {
	Data       []DeploymentSummary `json:"data"`
	NextCursor *string             `json:"next_cursor"`
}

// LogLine is one build log line.
type LogLine struct {
	ID        int64     `json:"id"`
	Timestamp time.Time `json:"timestamp"`
	Stream    string    `json:"stream"`
	Level     string    `json:"level"`
	Stage     *string   `json:"stage"`
	Message   string    `json:"message"`
}

// LogList is the response of GET /v1/deployments/{id}/logs. NextAfter is the
// id of the last returned line (pass it as ?after= to continue) and null when
// the page is empty.
type LogList struct {
	Data      []LogLine `json:"data"`
	NextAfter *int64    `json:"next_after"`
}

// CreateProjectRequest is the body of POST /v1/projects.
type CreateProjectRequest struct {
	Name string  `json:"name"`
	Slug *string `json:"slug"`
}

// UpdateProjectRequest is the body of PATCH /v1/projects/{project_id}.
type UpdateProjectRequest struct {
	Name *string `json:"name"`
}

// CreateServiceRequest is the body of POST /v1/projects/{project_id}/services.
type CreateServiceRequest struct {
	Name          string     `json:"name"`
	Type          string     `json:"type"`
	EnvironmentID *uuid.UUID `json:"environment_id"`
	Image         string     `json:"image"`
	Port          *int       `json:"port"`
}

// CreateEnvironmentRequest is the body of POST /v1/projects/{project_id}/environments.
type CreateEnvironmentRequest struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

func toDeploymentSummary(d platformdb.Deployment) DeploymentSummary {
	return DeploymentSummary{
		ID:                d.ID,
		ProjectID:         d.ProjectID,
		EnvironmentID:     d.EnvironmentID,
		ServiceID:         d.ServiceID,
		Status:            string(d.Status),
		CommitSHA:         d.CommitSHA,
		Branch:            d.Branch,
		TriggerType:       d.TriggerType,
		ErrorMessage:      d.ErrorMessage,
		StatusReason:      d.StatusReason,
		ImageRef:          d.ImageRef,
		PublicURL:         d.PublicURL,
		CancelRequestedAt: utcPtr(d.CancelRequestedAt),
		CreatedAt:         d.CreatedAt.UTC(),
		StartedAt:         utcPtr(d.StartedAt),
		FinishedAt:        utcPtr(d.FinishedAt),
		UpdatedAt:         d.UpdatedAt.UTC(),
	}
}

func optDeployment(d *platformdb.Deployment) *DeploymentSummary {
	if d == nil {
		return nil
	}
	s := toDeploymentSummary(*d)
	return &s
}

func toDeploymentDetail(d *platformdb.DeploymentDetail) DeploymentDetail {
	out := DeploymentDetail{
		DeploymentSummary: toDeploymentSummary(d.Deployment),
		Events:            make([]DeploymentEventView, 0, len(d.Events)),
	}
	if b := d.BuildJob; b != nil {
		out.Build = &BuildSummary{
			ID:              b.ID,
			Status:          string(b.Status),
			CurrentStage:    b.CurrentStage,
			ImageRepository: b.ImageRepository,
			ImageTag:        b.ImageTag,
			ImageDigest:     b.ImageDigest,
			ErrorMessage:    b.ErrorMessage,
			RequestedAt:     b.RequestedAt.UTC(),
			StartedAt:       utcPtr(b.StartedAt),
			CompletedAt:     utcPtr(b.CompletedAt),
		}
	}
	for _, ev := range d.Events {
		v := DeploymentEventView{ToStatus: string(ev.ToStatus), Reason: ev.Reason, CreatedAt: ev.CreatedAt.UTC()}
		if ev.FromStatus != nil {
			f := string(*ev.FromStatus)
			v.FromStatus = &f
		}
		out.Events = append(out.Events, v)
	}
	return out
}

func toProjectSummary(p platformdb.Project, count int, latest *platformdb.Deployment) ProjectSummary {
	return ProjectSummary{
		ID:               p.ID,
		Slug:             p.Slug,
		Name:             p.Name,
		GitRepositoryURL: p.GitRepositoryURL,
		DefaultBranch:    p.DefaultBranch,
		ServicesCount:    count,
		LatestDeployment: optDeployment(latest),
		CreatedAt:        p.CreatedAt.UTC(),
		UpdatedAt:        p.UpdatedAt.UTC(),
	}
}

func toServiceSummary(sv platformdb.Service, src *platformdb.ServiceSourceInfo, latest *platformdb.Deployment, image *platformdb.ServiceImageSource, addon *platformdb.ServiceAddon, port *int) ServiceSummary {
	out := ServiceSummary{
		ID:               sv.ID,
		ProjectID:        sv.ProjectID,
		EnvironmentID:    sv.EnvironmentID,
		EnvironmentName:  sv.EnvironmentName,
		Name:             sv.Name,
		Type:             sv.Type,
		LatestDeployment: optDeployment(latest),
		Port:             port,
		CreatedAt:        sv.CreatedAt.UTC(),
		UpdatedAt:        sv.UpdatedAt.UTC(),
	}
	if src != nil {
		out.Source = &ServiceSource{
			RepositoryFullName: src.RepositoryFullName,
			Branch:             src.Branch,
			RootDirectory:      src.RootDirectory,
			SourceStatus:       src.SourceStatus,
			AutoDeploy:         src.AutoDeploy,
		}
	}
	if image != nil {
		view := &ServiceImage{Image: image.Image}
		if latest != nil && latest.ImageRef != nil && *latest.ImageRef != "" {
			view.ResolvedImage = latest.ImageRef
		}
		out.Image = view
	}
	if addon != nil {
		view := &ServiceAddon{Engine: addon.Engine, Version: addon.Version, StorageMB: addon.StorageMB}
		if cat, ok := catalog.AddonFor(addon.Engine); ok {
			view.URLEnv = cat.URLEnv
		}
		out.Addon = view
	}
	return out
}

func utcPtr(t *time.Time) *time.Time {
	if t == nil {
		return nil
	}
	u := t.UTC()
	return &u
}
