package githubapp

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log/slog"
	"math"
	"math/rand/v2"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	defaultAPIVersion       = "2022-11-28"
	defaultMaxRetries       = 3
	defaultMaxResponseBytes = 10 * 1024 * 1024 // 10 MiB
	defaultPerPage          = 100
	maxPerPage              = 100
	tokenExpiryMargin       = 60 * time.Second
)

// Client is a GitHub App API client. It is safe for concurrent use.
type Client struct {
	cfg          Config
	privateKey   *rsa.PrivateKey
	httpClient   *http.Client
	clock        func() time.Time
	sleeper      func(time.Duration)
	logger       *slog.Logger
	maxRetries   int
	maxRespBytes int64
	baseURL      string
	apiVersion   string
	userAgent    string

	jwt jwtCache

	// tokenCache stores installation access tokens keyed by a
	// canonical string derived from installation ID, repository IDs,
	// and permissions.
	tokenMu    sync.Mutex
	tokenCache map[string]*tokenEntry
}

// tokenEntry holds a cached installation token and an in-flight
// coordination mechanism to prevent token storms.
type tokenEntry struct {
	mu      sync.Mutex
	token   *InstallationToken
	expires time.Time
}

// New creates a new GitHub App API client from the given configuration.
// It parses and validates the RSA private key (PKCS1 or PKCS8 PEM).
// Returns ErrNotConfigured if essential configuration is missing or invalid.
func New(cfg Config) (*Client, error) {
	if cfg.AppID == 0 {
		return nil, fmt.Errorf("%w: AppID is required", ErrNotConfigured)
	}
	if len(cfg.PrivateKeyPEM) == 0 {
		return nil, fmt.Errorf("%w: PrivateKeyPEM is required", ErrNotConfigured)
	}
	if cfg.BaseURL == "" {
		return nil, fmt.Errorf("%w: BaseURL is required", ErrNotConfigured)
	}

	// Parse the PEM-encoded RSA private key.
	key, err := parsePrivateKey(cfg.PrivateKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrNotConfigured, err)
	}

	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = http.DefaultClient
	}

	clockFn := cfg.Clock
	if clockFn == nil {
		clockFn = time.Now
	}

	sleeperFn := cfg.Sleeper
	if sleeperFn == nil {
		sleeperFn = time.Sleep
	}

	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}

	maxRetries := cfg.MaxRetries
	if maxRetries <= 0 {
		maxRetries = defaultMaxRetries
	}

	maxRespBytes := cfg.MaxResponseBytes
	if maxRespBytes <= 0 {
		maxRespBytes = defaultMaxResponseBytes
	}

	apiVersion := cfg.APIVersion
	if apiVersion == "" {
		apiVersion = defaultAPIVersion
	}

	baseURL := strings.TrimRight(cfg.BaseURL, "/")

	c := &Client{
		cfg:          cfg,
		privateKey:   key,
		httpClient:   httpClient,
		clock:        clockFn,
		sleeper:      sleeperFn,
		logger:       logger,
		maxRetries:   maxRetries,
		maxRespBytes: maxRespBytes,
		baseURL:      baseURL,
		apiVersion:   apiVersion,
		userAgent:    cfg.UserAgent,
		tokenCache:   make(map[string]*tokenEntry),
	}

	return c, nil
}

// parsePrivateKey decodes PEM data and parses either PKCS1 or PKCS8
// RSA private keys.
func parsePrivateKey(pemData []byte) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode(pemData)
	if block == nil {
		return nil, fmt.Errorf("invalid PEM data")
	}

	// Try PKCS1 first.
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}

	// Try PKCS8.
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key (tried PKCS1 and PKCS8): %w", err)
	}

	key, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("private key is not RSA")
	}

	return key, nil
}

// doRequest executes an HTTP request with retries, rate-limit handling,
// response-size limits, and context cancellation. The authHeader is the
// value of the Authorization header. Returns the decoded JSON response.
func (c *Client) doRequest(ctx context.Context, method, path, authHeader string, body io.Reader, result interface{}) error {
	var lastErr error

	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		if err := ctx.Err(); err != nil {
			return err
		}

		reqURL := c.baseURL + path
		req, err := http.NewRequestWithContext(ctx, method, reqURL, body)
		if err != nil {
			return fmt.Errorf("githubapp: create request: %w", err)
		}

		req.Header.Set("Accept", "application/vnd.github+json")
		req.Header.Set("X-GitHub-Api-Version", c.apiVersion)
		if c.userAgent != "" {
			req.Header.Set("User-Agent", c.userAgent)
		}
		if authHeader != "" {
			req.Header.Set("Authorization", authHeader)
		}
		if body != nil {
			req.Header.Set("Content-Type", "application/json")
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			if attempt < c.maxRetries && !isContextError(err) {
				c.backoff(ctx, attempt, 0)
				continue
			}
			return fmt.Errorf("githubapp: request failed: %w", err)
		}

		respBody, err := readLimitedBody(resp.Body, c.maxRespBytes)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("githubapp: read response: %w", err)
			if attempt < c.maxRetries {
				c.backoff(ctx, attempt, 0)
				continue
			}
			return lastErr
		}

		requestID := resp.Header.Get("X-GitHub-Request-Id")

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			if result != nil && len(respBody) > 0 {
				if err := json.Unmarshal(respBody, result); err != nil {
					return fmt.Errorf("githubapp: decode response: %w", err)
				}
			}
			return nil
		}

		apiErr := parseAPIError(resp, respBody, requestID)

		// Determine if we should retry.
		if shouldRetry(resp.StatusCode, apiErr) && attempt < c.maxRetries {
			retryAfter := apiErr.RetryAfter
			if retryAfter <= 0 {
				retryAfter = 0
			}
			lastErr = apiErr
			c.backoff(ctx, attempt, retryAfter)
			continue
		}

		// Map specific status codes to sentinel errors via Unwrap.
		return apiErr
	}

	if lastErr != nil {
		return lastErr
	}
	return fmt.Errorf("githubapp: request failed after retries")
}

// readLimitedBody reads up to limit bytes from an io.Reader.
func readLimitedBody(r io.ReadCloser, limit int64) ([]byte, error) {
	lr := io.LimitReader(r, limit+1)
	data, err := io.ReadAll(lr)
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > limit {
		return nil, fmt.Errorf("response body exceeds %d bytes", limit)
	}
	return data, nil
}

// parseAPIError constructs an APIError from the HTTP response.
func parseAPIError(resp *http.Response, body []byte, requestID string) *APIError {
	apiErr := &APIError{
		Status:    resp.StatusCode,
		RequestID: requestID,
	}

	// Try to parse GitHub error response.
	var ghErr struct {
		Message string `json:"message"`
		Errors  []struct {
			Code string `json:"code"`
		} `json:"errors"`
	}
	if json.Unmarshal(body, &ghErr) == nil {
		apiErr.Message = redactTokens(ghErr.Message)
		if len(ghErr.Errors) > 0 {
			apiErr.Code = ghErr.Errors[0].Code
		}
	}

	// Parse retry-after.
	if ra := resp.Header.Get("Retry-After"); ra != "" {
		if secs, err := strconv.Atoi(ra); err == nil {
			apiErr.RetryAfter = time.Duration(secs) * time.Second
		}
	}

	// Fall back to X-RateLimit-Reset if no Retry-After.
	if apiErr.RetryAfter <= 0 {
		if reset := resp.Header.Get("X-RateLimit-Reset"); reset != "" {
			if epoch, err := strconv.ParseInt(reset, 10, 64); err == nil {
				resetTime := time.Unix(epoch, 0)
				now := time.Now()
				if resetTime.After(now) {
					apiErr.RetryAfter = resetTime.Sub(now)
				}
			}
		}
	}

	return apiErr
}

// tokenPattern matches Bearer/token auth values for redaction.
// Handles both "Bearer xyz" (with space) and "ghs_xyz" (concatenated) forms.
var tokenPattern = regexp.MustCompile(`(?i)(bearer\s+\S+|token\s+\S+|ghs_\S+|ghp_\S+|github_pat_\S+)`)

// redactTokens removes any token-like strings from error messages.
func redactTokens(s string) string {
	return tokenPattern.ReplaceAllString(s, "[REDACTED]")
}

// shouldRetry determines if the request should be retried based on status code.
func shouldRetry(statusCode int, apiErr *APIError) bool {
	switch {
	case statusCode >= 500:
		return true
	case statusCode == 429:
		return true
	case statusCode == 403 && apiErr.RetryAfter > 0:
		// Secondary rate limit.
		return true
	default:
		return false
	}
}

// backoff sleeps for an exponential duration with jitter, honoring
// any Retry-After hint and context cancellation.
func (c *Client) backoff(ctx context.Context, attempt int, retryAfter time.Duration) {
	base := time.Duration(math.Pow(2, float64(attempt))) * 500 * time.Millisecond
	jitter := time.Duration(rand.Int64N(int64(base/2) + 1))
	wait := base + jitter

	if retryAfter > wait {
		wait = retryAfter
	}

	// Cap at 30 seconds.
	if wait > 30*time.Second {
		wait = 30 * time.Second
	}

	select {
	case <-ctx.Done():
		return
	default:
		c.sleeper(wait)
	}
}

// isContextError checks whether an error is due to context cancellation.
func isContextError(err error) bool {
	return err == context.Canceled || err == context.DeadlineExceeded
}

// tokenCacheKey builds a canonical cache key for installation tokens.
func tokenCacheKey(installationID int64, repoIDs []int64, permissions map[string]string) string {
	var b strings.Builder
	b.WriteString(strconv.FormatInt(installationID, 10))

	// Sort repo IDs.
	sorted := make([]int64, len(repoIDs))
	copy(sorted, repoIDs)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })
	for _, id := range sorted {
		b.WriteByte(':')
		b.WriteString(strconv.FormatInt(id, 10))
	}

	// Sort permissions.
	keys := make([]string, 0, len(permissions))
	for k := range permissions {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	b.WriteByte('|')
	for _, k := range keys {
		b.WriteString(k)
		b.WriteByte('=')
		b.WriteString(permissions[k])
		b.WriteByte(',')
	}

	return b.String()
}

// GetInstallation retrieves metadata for a GitHub App installation.
// Uses App JWT authentication.
func (c *Client) GetInstallation(ctx context.Context, installationID int64) (Installation, error) {
	jwt, err := c.GenerateAppJWT()
	if err != nil {
		return Installation{}, err
	}

	path := fmt.Sprintf("/app/installations/%d", installationID)
	var raw installationResponse
	if err := c.doRequest(ctx, http.MethodGet, path, "Bearer "+jwt, nil, &raw); err != nil {
		return Installation{}, err
	}

	inst := raw.toInstallation()

	// Check suspension.
	if inst.SuspendedAt != nil {
		return inst, ErrInstallationSuspended
	}

	return inst, nil
}

// CreateInstallationToken creates a new installation access token,
// optionally scoped to specific repositories and permissions.
// Tokens are cached in memory and concurrent callers for the same
// key coordinate through per-key locking to prevent token storms.
func (c *Client) CreateInstallationToken(ctx context.Context, installationID int64, repositoryIDs []int64, permissions map[string]string) (InstallationToken, error) {
	key := tokenCacheKey(installationID, repositoryIDs, permissions)

	// Get or create the cache entry with per-key locking.
	c.tokenMu.Lock()
	entry, ok := c.tokenCache[key]
	if !ok {
		entry = &tokenEntry{}
		c.tokenCache[key] = entry
	}
	c.tokenMu.Unlock()

	// Per-key lock to serialize concurrent requests.
	entry.mu.Lock()
	defer entry.mu.Unlock()

	now := c.clock()

	// Return cached token if still valid (with safety margin).
	if entry.token != nil && now.Before(entry.expires) {
		return *entry.token, nil
	}

	// Mint a new token.
	jwt, err := c.GenerateAppJWT()
	if err != nil {
		return InstallationToken{}, err
	}

	reqBody := installationTokenRequest{}
	if len(repositoryIDs) > 0 {
		reqBody.RepositoryIDs = repositoryIDs
	}
	if len(permissions) > 0 {
		reqBody.Permissions = permissions
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return InstallationToken{}, fmt.Errorf("githubapp: marshal token request: %w", err)
	}

	path := fmt.Sprintf("/app/installations/%d/access_tokens", installationID)
	var raw installationTokenResponse
	if err := c.doRequest(ctx, http.MethodPost, path, "Bearer "+jwt, strings.NewReader(string(bodyBytes)), &raw); err != nil {
		return InstallationToken{}, err
	}

	token := InstallationToken{
		Token:               raw.Token,
		ExpiresAt:           raw.ExpiresAt,
		Permissions:         raw.Permissions,
		RepositorySelection: raw.RepositorySelection,
	}

	// Cache with safety margin.
	entry.token = &token
	entry.expires = token.ExpiresAt.Add(-tokenExpiryMargin)

	return token, nil
}

// InvalidateInstallationTokens invalidates any cached tokens for the specified installation ID.
func (c *Client) InvalidateInstallationTokens(installationID int64) {
	prefix := strconv.FormatInt(installationID, 10) + ":"
	exact := strconv.FormatInt(installationID, 10)
	c.tokenMu.Lock()
	defer c.tokenMu.Unlock()
	for k := range c.tokenCache {
		if k == exact || strings.HasPrefix(k, prefix) {
			delete(c.tokenCache, k)
		}
	}
}

// InvalidateAllTokens clears all cached installation tokens.
func (c *Client) InvalidateAllTokens() {
	c.tokenMu.Lock()
	defer c.tokenMu.Unlock()
	c.tokenCache = make(map[string]*tokenEntry)
}

// ListInstallationRepositories lists repositories accessible to an installation.
// Uses an installation access token. page starts at 1; perPage defaults to 100.
func (c *Client) ListInstallationRepositories(ctx context.Context, installationID int64, page, perPage int) (RepositoryPage, error) {
	if perPage <= 0 {
		perPage = defaultPerPage
	}
	if perPage > maxPerPage {
		perPage = maxPerPage
	}
	if page <= 0 {
		page = 1
	}

	tok, err := c.CreateInstallationToken(ctx, installationID, nil, nil)
	if err != nil {
		return RepositoryPage{}, err
	}

	path := fmt.Sprintf("/installation/repositories?page=%d&per_page=%d", page, perPage)
	var raw repositoryListResponse
	if err := c.doRequestWithLinkHeader(ctx, http.MethodGet, path, "token "+tok.Token, nil, &raw); err != nil {
		return RepositoryPage{}, err
	}

	repos := make([]Repository, len(raw.Repositories))
	for i, r := range raw.Repositories {
		repos[i] = r.toRepository()
	}

	return RepositoryPage{
		Repositories: repos,
		TotalCount:   raw.TotalCount,
		Page:         page,
		PerPage:      perPage,
		HasNext:      raw.hasNext,
	}, nil
}

// GetRepository retrieves a single repository by owner and name.
// Uses an installation access token.
func (c *Client) GetRepository(ctx context.Context, installationID int64, owner, repo string) (Repository, error) {
	tok, err := c.CreateInstallationToken(ctx, installationID, nil, nil)
	if err != nil {
		return Repository{}, err
	}

	path := fmt.Sprintf("/repos/%s/%s", url.PathEscape(owner), url.PathEscape(repo))
	var raw repositoryResponse
	if err := c.doRequest(ctx, http.MethodGet, path, "token "+tok.Token, nil, &raw); err != nil {
		return Repository{}, err
	}

	return raw.toRepository(), nil
}

// GetCommit resolves a branch name, tag, or SHA to an exact commit.
// Accepts refs like "main", "refs/heads/main", "v1.0", or a full/short SHA.
func (c *Client) GetCommit(ctx context.Context, installationID int64, owner, repo, ref string) (Commit, error) {
	tok, err := c.CreateInstallationToken(ctx, installationID, nil, nil)
	if err != nil {
		return Commit{}, err
	}

	// URL-encode the ref to handle slashes in branch names like "refs/heads/main".
	encodedRef := url.PathEscape(ref)
	path := fmt.Sprintf("/repos/%s/%s/commits/%s", url.PathEscape(owner), url.PathEscape(repo), encodedRef)
	var raw commitResponse
	if err := c.doRequest(ctx, http.MethodGet, path, "token "+tok.Token, nil, &raw); err != nil {
		return Commit{}, err
	}

	return raw.toCommit(ref), nil
}

// doRequestWithLinkHeader is like doRequest but also parses the Link header
// for pagination and sets hasNext on the result.
func (c *Client) doRequestWithLinkHeader(ctx context.Context, method, path, authHeader string, body io.Reader, result *repositoryListResponse) error {
	var lastErr error

	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		if err := ctx.Err(); err != nil {
			return err
		}

		reqURL := c.baseURL + path
		req, err := http.NewRequestWithContext(ctx, method, reqURL, body)
		if err != nil {
			return fmt.Errorf("githubapp: create request: %w", err)
		}

		req.Header.Set("Accept", "application/vnd.github+json")
		req.Header.Set("X-GitHub-Api-Version", c.apiVersion)
		if c.userAgent != "" {
			req.Header.Set("User-Agent", c.userAgent)
		}
		if authHeader != "" {
			req.Header.Set("Authorization", authHeader)
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			if attempt < c.maxRetries && !isContextError(err) {
				c.backoff(ctx, attempt, 0)
				continue
			}
			return fmt.Errorf("githubapp: request failed: %w", err)
		}

		respBody, err := readLimitedBody(resp.Body, c.maxRespBytes)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("githubapp: read response: %w", err)
			if attempt < c.maxRetries {
				c.backoff(ctx, attempt, 0)
				continue
			}
			return lastErr
		}

		requestID := resp.Header.Get("X-GitHub-Request-Id")

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			if err := json.Unmarshal(respBody, result); err != nil {
				return fmt.Errorf("githubapp: decode response: %w", err)
			}

			// Parse Link header for pagination.
			result.hasNext = parseLinkHeaderHasNext(resp.Header.Get("Link"))
			return nil
		}

		apiErr := parseAPIError(resp, respBody, requestID)
		if shouldRetry(resp.StatusCode, apiErr) && attempt < c.maxRetries {
			retryAfter := apiErr.RetryAfter
			if retryAfter <= 0 {
				retryAfter = 0
			}
			lastErr = apiErr
			c.backoff(ctx, attempt, retryAfter)
			continue
		}

		return apiErr
	}

	if lastErr != nil {
		return lastErr
	}
	return fmt.Errorf("githubapp: request failed after retries")
}

// parseLinkHeaderHasNext returns true if the Link header contains a rel="next" link.
func parseLinkHeaderHasNext(linkHeader string) bool {
	if linkHeader == "" {
		return false
	}
	// Link header format: <url>; rel="next", <url>; rel="last"
	parts := strings.Split(linkHeader, ",")
	for _, part := range parts {
		if strings.Contains(part, `rel="next"`) {
			return true
		}
	}
	return false
}
