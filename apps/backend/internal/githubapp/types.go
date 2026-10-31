// Package githubapp provides a self-contained GitHub App API client
// using only the Go standard library. It handles App JWT generation,
// installation token minting with caching, and REST API calls to
// GitHub's v3 API with retry, rate-limit handling, pagination, and
// response-size limits.
package githubapp

import (
	"log/slog"
	"net/http"
	"time"
)

// Config holds the configuration for a GitHub App API client.
type Config struct {
	// AppID is the numeric GitHub App ID, used as the JWT issuer.
	AppID int64

	// PrivateKeyPEM is the PEM-encoded RSA private key for JWT signing.
	// Accepts both PKCS1 and PKCS8 formats.
	PrivateKeyPEM []byte

	// BaseURL is the GitHub API base URL, e.g. "https://api.github.com".
	// Must not have a trailing slash.
	BaseURL string

	// APIVersion is the GitHub REST API version header value.
	// Defaults to "2022-11-28" if empty.
	APIVersion string

	// UserAgent is sent in the User-Agent header on all requests.
	UserAgent string

	// HTTPClient is the HTTP client to use for requests.
	// If nil, http.DefaultClient is used.
	HTTPClient *http.Client

	// Clock returns the current time. If nil, time.Now is used.
	// Injected for testing.
	Clock func() time.Time

	// Sleeper pauses for the given duration. If nil, time.Sleep is used.
	// Injected for testing to avoid real delays.
	Sleeper func(time.Duration)

	// Logger is the structured logger. If nil, slog.Default() is used.
	Logger *slog.Logger

	// MaxRetries is the maximum number of retry attempts for transient
	// errors. Defaults to 3 if zero.
	MaxRetries int

	// MaxResponseBytes is the maximum response body size in bytes.
	// Defaults to 10 MiB if zero.
	MaxResponseBytes int64
}

// Installation represents a GitHub App installation.
type Installation struct {
	ID                  int64
	AccountID           int64
	AccountLogin        string
	AccountType         string
	RepositorySelection string
	Permissions         map[string]string
	SuspendedAt         *time.Time
	CreatedAt           time.Time
	UpdatedAt           time.Time
	HTMLURL             string
}

// Repository represents a GitHub repository accessible through an installation.
type Repository struct {
	ID            int64
	OwnerLogin    string
	Name          string
	FullName      string
	DefaultBranch string
	Private       bool
	Archived      bool
	Disabled      bool
	HTMLURL       string
	PushedAt      *time.Time
	UpdatedAt     time.Time
}

// RepositoryPage is a page of repositories returned by ListInstallationRepositories.
type RepositoryPage struct {
	Repositories []Repository
	TotalCount   int
	Page         int
	PerPage      int
	HasNext      bool
}

// InstallationToken is an access token scoped to an installation,
// optionally restricted to specific repositories and permissions.
type InstallationToken struct {
	Token               string
	ExpiresAt           time.Time
	Permissions         map[string]string
	RepositorySelection string
}

// Commit represents a resolved Git commit from the GitHub API.
type Commit struct {
	SHA         string
	Ref         string
	Message     string
	AuthorLogin string
	CommitDate  time.Time
}
