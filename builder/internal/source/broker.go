package source

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"
)

const (
	brokerRequestTimeout = 10 * time.Second
	brokerRetryDelay     = 500 * time.Millisecond
	brokerMaxBody        = 64 * 1024
)

// jwtShape matches three dot-separated base64url segments (header.payload.signature).
var jwtShape = regexp.MustCompile(`^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$`)

// LooksLikeJWT reports whether s has the compact JWT shape. It does not verify anything.
func LooksLikeJWT(s string) bool {
	return jwtShape.MatchString(strings.TrimSpace(s))
}

// brokerResponse mirrors the credential broker's JSON body
// (apps/backend/internal/githubworker.SourceTokenResponse).
type brokerResponse struct {
	Token      string    `json:"token"`
	ExpiresAt  time.Time `json:"expires_at"`
	Repository struct {
		CloneURL  string `json:"clone_url"`
		CommitSHA string `json:"commit_sha"`
	} `json:"repository"`
}

// BrokerResolver implements CredentialResolver against the orchestrator's credential
// broker. The file at TokenFile holds the per-build worker JWT.
//
// If BrokerURL is empty (local runs without a broker) and the file content is not a JWT,
// the content is used directly as the git token. A JWT without a broker URL is an error,
// because a worker JWT is not a git credential.
type BrokerResolver struct {
	BrokerURL  string
	TokenFile  string
	HTTPClient *http.Client
	// RetryDelay is the pause before the single retry; defaults to 500ms.
	RetryDelay time.Duration
}

// NewBrokerResolver constructs a BrokerResolver with the production 10s request timeout.
func NewBrokerResolver(brokerURL, tokenFile string) *BrokerResolver {
	return &BrokerResolver{
		BrokerURL:  strings.TrimRight(brokerURL, "/"),
		TokenFile:  tokenFile,
		HTTPClient: &http.Client{Timeout: brokerRequestTimeout},
		RetryDelay: brokerRetryDelay,
	}
}

// ResolveSourceToken implements CredentialResolver. Errors never contain the worker JWT
// or the returned installation token.
func (b *BrokerResolver) ResolveSourceToken(ctx context.Context, req SourceTokenRequest) (string, error) {
	raw, err := os.ReadFile(b.TokenFile)
	if err != nil {
		return "", fmt.Errorf("reading source credential file: %w", sanitizePathError(err))
	}
	credential := strings.TrimSpace(string(raw))
	if credential == "" {
		return "", errors.New("source credential file is empty")
	}

	if b.BrokerURL == "" {
		if LooksLikeJWT(credential) {
			return "", errors.New("source credential is a worker JWT but no source broker URL is configured (SUMMIT_SOURCE_BROKER_URL)")
		}
		return credential, nil
	}

	if req.BuildID == "" {
		return "", errors.New("build id is required to request a source token from the broker")
	}

	endpoint := fmt.Sprintf("%s/%s/source-token", b.BrokerURL, url.PathEscape(req.BuildID))

	var resp *brokerResponse
	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		if attempt > 0 {
			delay := b.RetryDelay
			if delay <= 0 {
				delay = brokerRetryDelay
			}
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(delay):
			}
		}
		var retryable bool
		resp, retryable, lastErr = b.requestOnce(ctx, endpoint, credential)
		if lastErr == nil {
			break
		}
		if !retryable {
			return "", lastErr
		}
	}
	if lastErr != nil {
		return "", lastErr
	}

	if resp.Token == "" {
		return "", errors.New("source broker returned an empty token")
	}
	if !resp.ExpiresAt.IsZero() && time.Now().After(resp.ExpiresAt) {
		return "", errors.New("source broker returned an already-expired token")
	}
	if !strings.EqualFold(strings.TrimSpace(resp.Repository.CommitSHA), strings.TrimSpace(req.CommitSHA)) {
		return "", fmt.Errorf("source broker commit_sha %q does not match spec commit_sha %q",
			resp.Repository.CommitSHA, req.CommitSHA)
	}
	if normalizeCloneURL(resp.Repository.CloneURL) != normalizeCloneURL(req.CloneURL) {
		return "", fmt.Errorf("source broker clone_url %q does not match spec clone_url %q",
			RedactGitURL(resp.Repository.CloneURL), RedactGitURL(req.CloneURL))
	}
	return resp.Token, nil
}

// requestOnce performs one broker call. retryable is true for network errors and 5xx.
func (b *BrokerResolver) requestOnce(ctx context.Context, endpoint, bearer string) (*brokerResponse, bool, error) {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(nil))
	if err != nil {
		return nil, false, fmt.Errorf("creating source broker request: %w", sanitizeURLError(err))
	}
	httpReq.Header.Set("Authorization", "Bearer "+bearer)
	httpReq.Header.Set("Accept", "application/json")

	client := b.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: brokerRequestTimeout}
	}
	// Enforce the per-request timeout even when a caller-supplied client has none.
	reqCtx, cancel := context.WithTimeout(ctx, brokerRequestTimeout)
	defer cancel()
	httpReq = httpReq.WithContext(reqCtx)

	httpResp, err := client.Do(httpReq)
	if err != nil {
		if ctx.Err() != nil {
			return nil, false, ctx.Err()
		}
		return nil, true, fmt.Errorf("source broker request failed: %w", sanitizeURLError(err))
	}
	defer httpResp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(httpResp.Body, brokerMaxBody))
	if err != nil {
		return nil, true, fmt.Errorf("reading source broker response: %w", err)
	}

	switch {
	case httpResp.StatusCode == http.StatusOK:
		var out brokerResponse
		if err := json.Unmarshal(body, &out); err != nil {
			return nil, false, errors.New("source broker returned malformed JSON")
		}
		return &out, false, nil
	case httpResp.StatusCode >= 500:
		return nil, true, fmt.Errorf("source broker returned status %d", httpResp.StatusCode)
	default:
		// 4xx: do not echo the body; it could reflect request data.
		return nil, false, fmt.Errorf("source broker rejected the request with status %d", httpResp.StatusCode)
	}
}

// normalizeCloneURL canonicalises a clone URL for comparison: no userinfo, lower-case,
// no trailing slash or ".git" suffix.
func normalizeCloneURL(raw string) string {
	raw = strings.TrimSpace(raw)
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return strings.ToLower(strings.TrimSuffix(strings.TrimRight(raw, "/"), ".git"))
	}
	path := strings.TrimSuffix(strings.TrimRight(u.Path, "/"), ".git")
	return strings.ToLower(u.Scheme + "://" + u.Host + path)
}

// sanitizeURLError strips the URL from *url.Error so request URLs are not repeated in logs.
func sanitizeURLError(err error) error {
	var ue *url.Error
	if errors.As(err, &ue) {
		return ue.Err
	}
	return err
}

// sanitizePathError keeps only the underlying errno-style reason of a file error.
func sanitizePathError(err error) error {
	var pe *os.PathError
	if errors.As(err, &pe) {
		return pe.Err
	}
	return err
}
