package source

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/url"
	"regexp"
	"strings"
)

// SourceTokenRequest carries everything a resolver may need to obtain a git credential
// for one build.
type SourceTokenRequest struct {
	// CredentialRef is the opaque spec.credentials.source_credential_ref.
	CredentialRef string
	// BuildID is spec.build.id (the broker's build_request_id).
	BuildID string
	// CloneURL and CommitSHA are the values from the spec; a broker response must match them.
	CloneURL  string
	CommitSHA string
}

// CredentialResolver resolves a short-lived git source token. Implementations must never
// log the token or include it in returned errors.
type CredentialResolver interface {
	ResolveSourceToken(ctx context.Context, req SourceTokenRequest) (string, error)
}

// StaticCredentialResolver is a static or test resolver.
type StaticCredentialResolver struct {
	tokens map[string]string
}

// NewStaticCredentialResolver constructs a StaticCredentialResolver.
func NewStaticCredentialResolver(tokens map[string]string) *StaticCredentialResolver {
	return &StaticCredentialResolver{tokens: tokens}
}

// ResolveSourceToken returns the token associated with req.CredentialRef.
func (s *StaticCredentialResolver) ResolveSourceToken(_ context.Context, req SourceTokenRequest) (string, error) {
	credentialRef := req.CredentialRef
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

// gitAuthHeader returns the HTTP Authorization header value git should send for a GitHub
// installation token (basic auth, user "x-access-token").
func gitAuthHeader(token string) string {
	creds := base64.StdEncoding.EncodeToString([]byte("x-access-token:" + token))
	return "Authorization: Basic " + creds
}

// GitAuthEnv returns environment entries that make a single git process send token as an
// HTTP Authorization header for cloneURL's origin, using git's GIT_CONFIG_COUNT mechanism.
//
// Unlike embedding credentials in the URL, nothing is written to .git/config, the remote
// URL, or process arguments. It returns nil when no token is given or the URL is not
// http(s) (for example a local path used in tests).
func GitAuthEnv(cloneURL, token string) []string {
	if token == "" {
		return nil
	}
	parsed, err := url.Parse(cloneURL)
	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" {
		return nil
	}
	scope := fmt.Sprintf("%s://%s/", parsed.Scheme, parsed.Host)
	return []string{
		"GIT_CONFIG_COUNT=1",
		"GIT_CONFIG_KEY_0=http." + scope + ".extraHeader",
		"GIT_CONFIG_VALUE_0=" + gitAuthHeader(token),
	}
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

var (
	gitCredentialsRegex = regexp.MustCompile(`(https?://)[^:@\s]+(?::[^@\s]+)?@`)
	authHeaderRegex     = regexp.MustCompile(`(?i)(authorization:\s*(?:basic|bearer)\s+)\S+`)
)

// SanitizeGitOutput scrubs embedded URL user credentials and Authorization headers from
// command outputs/error messages.
func SanitizeGitOutput(output string) string {
	if output == "" {
		return ""
	}
	output = gitCredentialsRegex.ReplaceAllString(output, "${1}redacted@")
	return authHeaderRegex.ReplaceAllString(output, "${1}redacted")
}
