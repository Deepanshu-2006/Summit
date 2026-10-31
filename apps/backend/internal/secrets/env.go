package secrets

import (
	"context"
	"fmt"
	"os"
)

// EnvProvider resolves secrets from environment variables.
// It is intended for local development only.
//
// The path is treated as an environment variable name.
// For example, Get(ctx, "GITHUB_APP_PRIVATE_KEY") reads os.Getenv("GITHUB_APP_PRIVATE_KEY").
type EnvProvider struct{}

// NewEnvProvider creates a new EnvProvider.
func NewEnvProvider() *EnvProvider {
	return &EnvProvider{}
}

// Get reads the secret value from the environment variable named by path.
func (p *EnvProvider) Get(_ context.Context, path string) ([]byte, error) {
	val := os.Getenv(path)
	if val == "" {
		return nil, fmt.Errorf("%w: environment variable %q is empty or not set", ErrSecretNotFound, path)
	}
	return []byte(val), nil
}
