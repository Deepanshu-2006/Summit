package githubapp

import (
	"errors"
	"fmt"
	"time"
)

// Sentinel errors returned by the client.
var (
	// ErrNotConfigured is returned when the client cannot be constructed
	// due to missing or invalid configuration (e.g. no private key, no AppID).
	ErrNotConfigured = errors.New("githubapp: client not configured")

	// ErrRateLimited is returned when GitHub returns a 429 or a 403
	// with rate-limit headers, after all retries are exhausted.
	ErrRateLimited = errors.New("githubapp: rate limited")

	// ErrNotFound is returned when GitHub returns 404.
	ErrNotFound = errors.New("githubapp: not found")

	// ErrInstallationSuspended is returned when the target installation
	// is suspended on GitHub.
	ErrInstallationSuspended = errors.New("githubapp: installation suspended")

	// ErrPermissionDenied is returned when GitHub returns 403 without
	// rate-limit indicators.
	ErrPermissionDenied = errors.New("githubapp: permission denied")
)

// APIError carries structured error information from a GitHub API response.
type APIError struct {
	// Status is the HTTP status code.
	Status int

	// Code is a machine-readable error code from GitHub, if present.
	Code string

	// Message is the human-readable error message from GitHub.
	// Authorization headers and tokens are redacted.
	Message string

	// RequestID is the value of the X-GitHub-Request-Id response header.
	RequestID string

	// RetryAfter is set when GitHub indicates a retry delay via the
	// Retry-After header or X-RateLimit-Reset.
	RetryAfter time.Duration
}

// Error implements the error interface. It never includes tokens or JWTs.
func (e *APIError) Error() string {
	s := fmt.Sprintf("githubapp: api error status=%d", e.Status)
	if e.Code != "" {
		s += fmt.Sprintf(" code=%s", e.Code)
	}
	if e.Message != "" {
		s += fmt.Sprintf(" message=%q", e.Message)
	}
	if e.RequestID != "" {
		s += fmt.Sprintf(" request_id=%s", e.RequestID)
	}
	return s
}

// Unwrap allows errors.Is to match sentinel errors wrapped by APIError.
func (e *APIError) Unwrap() error {
	switch {
	case e.Status == 404:
		return ErrNotFound
	case e.Status == 429:
		return ErrRateLimited
	case e.Status == 403 && e.RetryAfter > 0:
		return ErrRateLimited
	case e.Status == 403:
		return ErrPermissionDenied
	default:
		return nil
	}
}
