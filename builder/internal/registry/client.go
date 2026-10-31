package registry

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

// manifestAccept lists every manifest media type the verification may encounter. A
// multi-platform push yields an index / manifest list; a single-platform push yields a
// manifest. The digest of whichever the tag points at is what BuildKit pushed.
const manifestAccept = "application/vnd.oci.image.index.v1+json, " +
	"application/vnd.oci.image.manifest.v1+json, " +
	"application/vnd.docker.distribution.manifest.list.v2+json, " +
	"application/vnd.docker.distribution.manifest.v2+json"

var digestRegex = regexp.MustCompile(`^sha256:[0-9a-f]{64}$`)

// ArtifactMetadata contains verified immutable OCI image metadata.
type ArtifactMetadata struct {
	Repository string
	Tag        string
	Digest     string
	Platforms  []string
	SizeBytes  int64
}

// Client interacts with the OCI Distribution API v2.
type Client struct {
	httpClient *http.Client
	insecure   map[string]bool
	config     *DockerConfig
}

// Option customises a Client.
type Option func(*Client)

// WithDockerConfig supplies registry credentials (parsed docker config.json) used for the
// Bearer-token / Basic challenge flow.
func WithDockerConfig(cfg *DockerConfig) Option {
	return func(c *Client) { c.config = cfg }
}

// WithInsecureRegistries marks registry hosts (host[:port]) as reachable over plain HTTP.
// Loopback hosts are always allowed.
func WithInsecureRegistries(hosts ...string) Option {
	return func(c *Client) {
		for _, h := range hosts {
			c.insecure[strings.ToLower(strings.TrimSpace(h))] = true
		}
	}
}

// NewClient constructs a new registry Client.
func NewClient(httpClient *http.Client, opts ...Option) *Client {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 30 * time.Second}
	}
	c := &Client{httpClient: httpClient, insecure: map[string]bool{}}
	for _, o := range opts {
		o(c)
	}
	return c
}

// IsInsecure reports whether registryHost may be contacted over plain HTTP: it is a
// loopback address or was explicitly configured with WithInsecureRegistries.
func (c *Client) IsInsecure(registryHost string) bool {
	h := strings.ToLower(strings.TrimSpace(registryHost))
	if c.insecure[h] {
		return true
	}
	return IsLoopbackHost(h)
}

// IsLoopbackHost reports whether host[:port] is localhost, 127.0.0.0/8 or ::1.
func IsLoopbackHost(hostport string) bool {
	host := hostport
	if h, _, err := net.SplitHostPort(hostport); err == nil {
		host = h
	}
	host = strings.Trim(host, "[]")
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func (c *Client) scheme(registryHost string) string {
	if c.IsInsecure(registryHost) {
		return "http"
	}
	return "https"
}

// VerifyDigest queries the registry manifest endpoint for repository:tag and returns the
// manifest digest. It performs the standard OCI token-auth flow: on 401 it parses
// WWW-Authenticate, obtains a pull token from the realm (with basic credentials from the
// configured docker config when available) and retries. The digest is taken from the
// Docker-Content-Digest header, or computed over the body when the header is absent.
func (c *Client) VerifyDigest(ctx context.Context, registryHost, repository, tag string) (*ArtifactMetadata, error) {
	if registryHost == "" {
		return nil, fmt.Errorf("registryHost cannot be empty")
	}
	if repository == "" {
		return nil, fmt.Errorf("repository cannot be empty")
	}
	if tag == "" {
		return nil, fmt.Errorf("tag cannot be empty")
	}

	manifestURL := fmt.Sprintf("%s://%s/v2/%s/manifests/%s", c.scheme(registryHost), registryHost, repository, tag)

	resp, err := c.getManifest(ctx, manifestURL, "")
	if err != nil {
		return nil, err
	}
	if resp.StatusCode == http.StatusUnauthorized {
		challenge := resp.Header.Get("Www-Authenticate")
		_ = resp.Body.Close()
		authz, err := c.authorize(ctx, registryHost, repository, challenge)
		if err != nil {
			return nil, err
		}
		resp, err = c.getManifest(ctx, manifestURL, authz)
		if err != nil {
			return nil, err
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("registry returned status %d for manifest %s: %s",
			resp.StatusCode, manifestURL, strings.TrimSpace(string(body)))
	}

	manifestBytes, err := io.ReadAll(io.LimitReader(resp.Body, 4*1024*1024))
	if err != nil {
		return nil, fmt.Errorf("reading manifest body: %w", err)
	}

	digest := strings.TrimSpace(resp.Header.Get("Docker-Content-Digest"))
	if digest == "" {
		sum := sha256.Sum256(manifestBytes)
		digest = "sha256:" + hex.EncodeToString(sum[:])
	}
	if !digestRegex.MatchString(digest) {
		return nil, fmt.Errorf("registry returned unsupported digest %q", digest)
	}

	return &ArtifactMetadata{
		Repository: fmt.Sprintf("%s/%s", registryHost, repository),
		Tag:        tag,
		Digest:     digest,
		SizeBytes:  int64(len(manifestBytes)),
		Platforms:  []string{"linux/amd64"},
	}, nil
}

func (c *Client) getManifest(ctx context.Context, manifestURL, authorization string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, manifestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("creating manifest request: %w", err)
	}
	req.Header.Set("Accept", manifestAccept)
	if authorization != "" {
		req.Header.Set("Authorization", authorization)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching registry manifest from %s: %w", manifestURL, unwrapURLError(err))
	}
	return resp, nil
}

// authorize turns a WWW-Authenticate challenge into an Authorization header value.
func (c *Client) authorize(ctx context.Context, registryHost, repository, challenge string) (string, error) {
	scheme, params := parseChallenge(challenge)
	creds, hasCreds := c.config.CredentialsFor(registryHost)

	switch strings.ToLower(scheme) {
	case "bearer":
		realm := params["realm"]
		if realm == "" {
			return "", errors.New("registry Bearer challenge has no realm")
		}
		scope := params["scope"]
		if scope == "" {
			scope = fmt.Sprintf("repository:%s:pull", repository)
		}
		token, err := c.fetchToken(ctx, realm, params["service"], scope, creds, hasCreds)
		if err != nil {
			return "", err
		}
		return "Bearer " + token, nil
	case "basic":
		if !hasCreds {
			return "", fmt.Errorf("registry %s requires basic auth but no credentials are configured", registryHost)
		}
		return "Basic " + basicAuth(creds), nil
	default:
		return "", fmt.Errorf("registry returned 401 with unsupported auth challenge %q", scheme)
	}
}

func (c *Client) fetchToken(ctx context.Context, realm, service, scope string, creds Credentials, hasCreds bool) (string, error) {
	u, err := url.Parse(realm)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
		return "", errors.New("registry Bearer challenge has an invalid realm")
	}
	// A registry reached over https must not downgrade the credential exchange to http,
	// except for explicitly insecure/loopback token services.
	if u.Scheme == "http" && !c.IsInsecure(u.Host) {
		return "", errors.New("registry token realm uses plain http for a non-insecure registry")
	}
	q := u.Query()
	if service != "" {
		q.Set("service", service)
	}
	q.Set("scope", scope)
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return "", fmt.Errorf("creating token request: %w", err)
	}
	if hasCreds {
		req.SetBasicAuth(creds.Username, creds.Password)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("requesting registry token: %w", unwrapURLError(err))
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("registry token endpoint returned status %d", resp.StatusCode)
	}
	var body struct {
		Token       string `json:"token"`
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64*1024)).Decode(&body); err != nil {
		return "", errors.New("registry token endpoint returned malformed JSON")
	}
	token := body.Token
	if token == "" {
		token = body.AccessToken
	}
	if token == "" {
		return "", errors.New("registry token endpoint returned no token")
	}
	return token, nil
}

func basicAuth(c Credentials) string {
	return base64Std(c.Username + ":" + c.Password)
}

// paramRegex matches key="value" (quoted) or key=value pairs of an auth challenge.
var paramRegex = regexp.MustCompile(`([A-Za-z_][A-Za-z0-9_-]*)=(?:"([^"]*)"|([^\s,]*))`)

// parseChallenge splits `Bearer realm="...",service="...",scope="..."` into scheme and params.
func parseChallenge(h string) (string, map[string]string) {
	h = strings.TrimSpace(h)
	scheme, rest, _ := strings.Cut(h, " ")
	params := map[string]string{}
	for _, m := range paramRegex.FindAllStringSubmatch(rest, -1) {
		val := m[2]
		if val == "" {
			val = m[3]
		}
		params[strings.ToLower(m[1])] = val
	}
	return scheme, params
}

func unwrapURLError(err error) error {
	var ue *url.Error
	if errors.As(err, &ue) {
		return ue.Err
	}
	return err
}

func base64Std(s string) string { return base64.StdEncoding.EncodeToString([]byte(s)) }
