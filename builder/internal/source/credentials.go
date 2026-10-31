package source

import (
	"context"
	"fmt"
	"net/url"
	"regexp"
	"strings"
)

// CredentialResolver resolves short-lived git source credentials from an opaque reference token.
type CredentialResolver interface {
	ResolveSourceToken(ctx context.Context, credentialRef string) (string, error)
}

// StaticCredentialResolver is a static or test resolver.
type StaticCredentialResolver struct {
	tokens map[string]string
}

// NewStaticCredentialResolver constructs a StaticCredentialResolver.
func NewStaticCredentialResolver(tokens map[string]string) *StaticCredentialResolver {
	return &StaticCredentialResolver{tokens: tokens}
}

// ResolveSourceToken returns the token associated with credentialRef.
func (s *StaticCredentialResolver) ResolveSourceToken(_ context.Context, credentialRef string) (string, error) {
	if s.tokens != nil {
		if token, ok := s.tokens[credentialRef]; ok {
			return token, nil
		}
	}
	// Fallback: If credentialRef itself looks like a direct token or secret string in standalone tests
	if strings.HasPrefix(credentialRef, "ghs_") || strings.HasPrefix(credentialRef, "token:") {
		return strings.TrimPrefix(credentialRef, "token:"), nil
	}
	return "", fmt.Errorf("credential reference not found: %s", credentialRef)
}

// InjectGitCredentials formats a Git clone URL with username and password/token.
// For GitHub installation tokens, the format is https://x-access-token:<token>@github.com/org/repo.git
func InjectGitCredentials(rawURL, token string) (string, error) {
	if token == "" {
		return rawURL, nil
	}
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "", fmt.Errorf("parsing git url: %w", err)
	}

	if token != "" && parsed.Host != "" {
		parsed.User = url.UserPassword("x-access-token", token)
	}
	return parsed.String(), nil
}

// RedactGitURL removes userinfo from a Git URL for safe logging.
func RedactGitURL(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "[malformed-git-url]"
	}
	if parsed.User != nil {
		parsed.User = url.User("redacted")
	}
	return parsed.String()
}

var gitCredentialsRegex = regexp.MustCompile(`(https?://)[^:@\s]+(?::[^@\s]+)?@`)

// SanitizeGitOutput scrubs embedded URL user credentials and tokens from command outputs/error messages.
func SanitizeGitOutput(output string) string {
	if output == "" {
		return ""
	}
	return gitCredentialsRegex.ReplaceAllString(output, "${1}redacted@")
}
