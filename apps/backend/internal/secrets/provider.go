// Package secrets defines an interface for retrieving secret values from
// external providers such as OpenBao/Vault or environment variables.
//
// Secret resolution precedence:
//  1. OpenBao path (production): if an OpenBao path is configured for a given
//     symbolic path, the secret is fetched from OpenBao/Vault via HTTP API.
//  2. Environment variable fallback (development/test only): if the environment
//     is development or test AND no OpenBao path is configured, the direct
//     environment variable value is used as a fallback.
//
// This ensures production deployments always use OpenBao while allowing
// local development without a running Vault instance.
package secrets

import (
	"context"
	"errors"
)

// Provider retrieves secret values by path.
type Provider interface {
	// Get returns the secret value at the given path.
	// The path may be an OpenBao mount/key path or a symbolic name
	// depending on the provider implementation.
	Get(ctx context.Context, path string) ([]byte, error)
}

// ErrSecretNotFound is returned when a secret path cannot be resolved.
var ErrSecretNotFound = errors.New("secret not found")
