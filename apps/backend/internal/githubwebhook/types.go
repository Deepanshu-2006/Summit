package githubwebhook

import "time"

// MaxBodyBytesDefault is the default maximum webhook body size (5 MiB).
const MaxBodyBytesDefault = 5 << 20

// Kind represents the normalized category of GitHub event.
type Kind string

const (
	// KindPush identifies code push events.
	KindPush Kind = "push"
	// KindInstallation identifies GitHub App installation lifecycle events.
	KindInstallation Kind = "installation"
	// KindInstallationRepositories identifies repository addition/removal from an installation.
	KindInstallationRepositories Kind = "installation_repositories"
	// KindUnsupported identifies event types that are not processed by the platform.
	KindUnsupported Kind = "unsupported"
)

// Headers represents normalized GitHub webhook request headers.
type Headers struct {
	Signature   string `json:"signature"`
	DeliveryID  string `json:"delivery_id"`
	EventType   string `json:"event_type"`
	ContentType string `json:"content_type"`
}

// Sender represents the GitHub user/actor who triggered the event.
// Note: Email addresses are intentionally excluded for privacy and minimization.
type Sender struct {
	ID        int64  `json:"id,omitempty"`
	Login     string `json:"login,omitempty"`
	Type      string `json:"type,omitempty"`
	AvatarURL string `json:"avatar_url,omitempty"`
	HTMLURL   string `json:"html_url,omitempty"`
}

// Repository represents normalized repository metadata.
type Repository struct {
	ID            int64      `json:"id"`
	OwnerLogin    string     `json:"owner_login,omitempty"`
	Name          string     `json:"name"`
	FullName      string     `json:"full_name"`
	DefaultBranch string     `json:"default_branch,omitempty"`
	HTMLURL       string     `json:"html_url,omitempty"`
	Private       bool       `json:"private"`
	Archived      bool       `json:"archived"`
	Disabled      bool       `json:"disabled"`
	PushedAt      *time.Time `json:"pushed_at,omitempty"`
}

// Push represents normalized metadata for a push event.
type Push struct {
	Ref           string     `json:"ref"`
	Branch        string     `json:"branch,omitempty"`
	Before        string     `json:"before"`
	After         string     `json:"after"`
	Deleted       bool       `json:"deleted"`
	Created       bool       `json:"created"`
	Forced        bool       `json:"forced"`
	Repository    Repository `json:"repository"`
	Sender        Sender     `json:"sender"`
	HeadCommitSHA string     `json:"head_commit_sha,omitempty"`
	CommitCount   int        `json:"commit_count"`
}

// InstallationChange represents normalized metadata for an installation lifecycle event.
type InstallationChange struct {
	Action              string            `json:"action"`
	InstallationID      int64             `json:"installation_id"`
	AccountID           int64             `json:"account_id,omitempty"`
	AccountLogin        string            `json:"account_login,omitempty"`
	AccountType         string            `json:"account_type,omitempty"`
	RepositorySelection string            `json:"repository_selection,omitempty"`
	Permissions         map[string]string `json:"permissions,omitempty"`
	SuspendedAt         *time.Time        `json:"suspended_at,omitempty"`
	Repositories        []Repository      `json:"repositories,omitempty"`
}

// RepositoriesChange represents repository additions or removals from an installation.
type RepositoriesChange struct {
	Action         string       `json:"action"`
	InstallationID int64        `json:"installation_id"`
	Added          []Repository `json:"added,omitempty"`
	Removed        []Repository `json:"removed,omitempty"`
}

// Event represents a normalized, tenant-agnostic GitHub webhook event.
type Event struct {
	Kind           Kind                `json:"kind"`
	EventType      string              `json:"event_type"`
	Action         string              `json:"action,omitempty"`
	DeliveryID     string              `json:"delivery_id,omitempty"`
	InstallationID int64               `json:"installation_id,omitempty"`
	RepositoryID   int64               `json:"repository_id,omitempty"`
	Push           *Push               `json:"push,omitempty"`
	Installation   *InstallationChange `json:"installation,omitempty"`
	Repositories   *RepositoriesChange `json:"repositories,omitempty"`
}
