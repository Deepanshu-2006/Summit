package registry

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	acceptManifests = "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json"
	resolveTimeout  = 30 * time.Second
)

var (
	// ErrNotFound means the registry has no such repository or tag.
	ErrNotFound = errors.New("registry: image not found")
	// ErrUnauthorized means the image is private or the anonymous token was refused.
	ErrUnauthorized = errors.New("registry: image is private or unauthorized")
	// ErrInvalidRef means the reference is not a valid image name.
	ErrInvalidRef = errors.New("registry: invalid image reference")
)

// ResolveDigest normalizes ref and returns <registry>/<repository>@sha256:<digest>.
// `nginx` becomes a Docker Hub library image at tag latest. A reference that
// already contains @sha256: is returned unchanged and is not looked up.
func ResolveDigest(ctx context.Context, ref string) (string, error) {
	return resolveDigest(ctx, http.DefaultClient, ref)
}

func resolveDigest(ctx context.Context, client *http.Client, ref string) (string, error) {
	if client == nil {
		client = http.DefaultClient
	}
	parsed, err := parseRef(ref)
	if err != nil {
		return "", err
	}
	if parsed.digest != "" {
		return parsed.raw, nil
	}
	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, resolveTimeout)
		defer cancel()
	}
	digest, err := fetchDigest(ctx, client, parsed)
	if err != nil {
		return "", err
	}
	return parsed.canonical + "@" + digest, nil
}

func fetchDigest(ctx context.Context, client *http.Client, parsed parsedRef) (string, error) {
	manifestURL := "https://" + parsed.registryHost + "/v2/" + parsed.repository + "/manifests/" + parsed.tag
	status, hdr, err := doManifest(ctx, client, manifestURL, "")
	if err != nil {
		return "", err
	}
	if status == http.StatusUnauthorized {
		token, terr := anonymousToken(ctx, client, hdr.Get("WWW-Authenticate"))
		if terr != nil {
			return "", fmt.Errorf("%w: %s", ErrUnauthorized, parsed.raw)
		}
		status, hdr, err = doManifest(ctx, client, manifestURL, token)
		if err != nil {
			return "", err
		}
	}
	switch status {
	case http.StatusOK:
		digest := strings.TrimSpace(hdr.Get("Docker-Content-Digest"))
		if !digestRe.MatchString(digest) {
			return "", fmt.Errorf("registry: manifest for %s did not include a Docker-Content-Digest", parsed.raw)
		}
		return digest, nil
	case http.StatusNotFound:
		return "", fmt.Errorf("%w: %s", ErrNotFound, parsed.raw)
	case http.StatusUnauthorized, http.StatusForbidden:
		return "", fmt.Errorf("%w: %s", ErrUnauthorized, parsed.raw)
	default:
		return "", fmt.Errorf("registry: manifest for %s returned HTTP %d", parsed.raw, status)
	}
}

func doManifest(ctx context.Context, client *http.Client, manifestURL, token string) (int, http.Header, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, manifestURL, nil)
	if err != nil {
		return 0, nil, fmt.Errorf("registry: build manifest request: %w", err)
	}
	req.Header.Set("Accept", acceptManifests)
	req.Header.Set("User-Agent", "summit-registry")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := client.Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("registry: manifest request: %w", err)
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 1<<20))
	return res.StatusCode, res.Header.Clone(), nil
}

func anonymousToken(ctx context.Context, client *http.Client, wwwAuthenticate string) (string, error) {
	realm, service, scope, err := parseBearerChallenge(wwwAuthenticate)
	if err != nil {
		return "", err
	}
	u, err := url.Parse(realm)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return "", fmt.Errorf("registry: bad token realm")
	}
	q := u.Query()
	if service != "" {
		q.Set("service", service)
	}
	if scope != "" {
		q.Set("scope", scope)
	}
	u.RawQuery = q.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "summit-registry")
	res, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("registry: token request: %w", err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return "", err
	}
	if res.StatusCode == http.StatusUnauthorized || res.StatusCode == http.StatusForbidden {
		return "", ErrUnauthorized
	}
	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("registry: token endpoint returned HTTP %d", res.StatusCode)
	}
	var payload struct {
		Token       string `json:"token"`
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return "", fmt.Errorf("registry: token response: %w", err)
	}
	if payload.Token == "" {
		payload.Token = payload.AccessToken
	}
	if payload.Token == "" {
		return "", ErrUnauthorized
	}
	return payload.Token, nil
}

func parseBearerChallenge(header string) (realm, service, scope string, err error) {
	header = strings.TrimSpace(header)
	if len(header) < 6 || !strings.EqualFold(header[:6], "bearer") {
		return "", "", "", fmt.Errorf("registry: WWW-Authenticate is not Bearer")
	}
	rest := strings.TrimSpace(header[6:])
	params := map[string]string{}
	for rest != "" {
		rest = strings.TrimLeft(rest, " ,")
		if rest == "" {
			break
		}
		eq := strings.IndexByte(rest, '=')
		if eq <= 0 {
			return "", "", "", fmt.Errorf("registry: malformed WWW-Authenticate")
		}
		key := strings.ToLower(strings.TrimSpace(rest[:eq]))
		rest = strings.TrimLeft(rest[eq+1:], " ")
		if rest == "" {
			return "", "", "", fmt.Errorf("registry: malformed WWW-Authenticate")
		}
		if rest[0] != '"' {
			end := strings.IndexByte(rest, ',')
			if end < 0 {
				params[key] = strings.TrimSpace(rest)
				break
			}
			params[key] = strings.TrimSpace(rest[:end])
			rest = rest[end:]
			continue
		}
		var b strings.Builder
		closed := false
		for i := 1; i < len(rest); i++ {
			if rest[i] == '\\' && i+1 < len(rest) {
				b.WriteByte(rest[i+1])
				i++
				continue
			}
			if rest[i] == '"' {
				params[key] = b.String()
				rest = rest[i+1:]
				closed = true
				break
			}
			b.WriteByte(rest[i])
		}
		if !closed {
			return "", "", "", fmt.Errorf("registry: unterminated WWW-Authenticate quoted string")
		}
	}
	if params["realm"] == "" {
		return "", "", "", fmt.Errorf("registry: bearer challenge has no realm")
	}
	return params["realm"], params["service"], params["scope"], nil
}
