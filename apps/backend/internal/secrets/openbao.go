package secrets

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// OpenBaoProvider retrieves secrets from an OpenBao/Vault HTTP API.
// It supports token auth and AppRole login (role_id/secret_id from env).
// It reads KV v2 secrets, handling the mount/path split and "data" envelope.
type OpenBaoProvider struct {
	addr       string
	token      string
	httpClient *http.Client
}

// NewOpenBaoProvider creates a new OpenBaoProvider.
// addr is the OpenBao/Vault address (e.g. http://127.0.0.1:8200).
// token is used for direct token auth. If empty, AppRole login is attempted
// using OPENBAO_ROLE_ID and OPENBAO_SECRET_ID environment variables.
func NewOpenBaoProvider(addr, token, authRole string) (*OpenBaoProvider, error) {
	if addr == "" {
		return nil, fmt.Errorf("OpenBao address is required")
	}

	p := &OpenBaoProvider{
		addr: strings.TrimRight(addr, "/"),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}

	if token != "" {
		p.token = token
	} else {
		// Try AppRole login
		roleID := os.Getenv("OPENBAO_ROLE_ID")
		secretID := os.Getenv("OPENBAO_SECRET_ID")
		if roleID != "" && secretID != "" {
			t, err := p.appRoleLogin(roleID, secretID, authRole)
			if err != nil {
				return nil, fmt.Errorf("OpenBao AppRole login failed: %w", err)
			}
			p.token = t
		} else {
			return nil, fmt.Errorf("OpenBao token or AppRole credentials (OPENBAO_ROLE_ID, OPENBAO_SECRET_ID) required")
		}
	}

	return p, nil
}

// appRoleLogin authenticates using AppRole and returns a client token.
func (p *OpenBaoProvider) appRoleLogin(roleID, secretID, authRole string) (string, error) {
	mountPath := "approle"
	if authRole != "" {
		mountPath = authRole
	}

	body := fmt.Sprintf(`{"role_id":%q,"secret_id":%q}`, roleID, secretID)
	url := fmt.Sprintf("%s/v1/auth/%s/login", p.addr, mountPath)

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, url, strings.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("creating login request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("login request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return "", fmt.Errorf("login returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Auth struct {
			ClientToken string `json:"client_token"`
		} `json:"auth"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&result); err != nil {
		return "", fmt.Errorf("decoding login response: %w", err)
	}
	if result.Auth.ClientToken == "" {
		return "", fmt.Errorf("no client_token in login response")
	}
	return result.Auth.ClientToken, nil
}

// Get reads a KV v2 secret at the given path.
// The path should be in the form "mount/path/to/secret" or "mount/data/path/to/secret".
// For KV v2, the provider inserts "/data/" after the mount point if not already present.
// It returns the value of the "value" field within the data envelope, or the
// entire data payload if no "value" field exists.
func (p *OpenBaoProvider) Get(ctx context.Context, path string) ([]byte, error) {
	apiPath := normalizeKV2Path(path)
	url := fmt.Sprintf("%s/v1/%s", p.addr, apiPath)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("X-Vault-Token", p.token)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request to OpenBao: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("%w: path %q", ErrSecretNotFound, path)
	}
	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("OpenBao returned status %d for path %q: %s", resp.StatusCode, path, string(respBody))
	}

	var result struct {
		Data struct {
			Data map[string]interface{} `json:"data"`
		} `json:"data"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&result); err != nil {
		return nil, fmt.Errorf("decoding response: %w", err)
	}

	if result.Data.Data == nil {
		return nil, fmt.Errorf("%w: no data at path %q", ErrSecretNotFound, path)
	}

	// If there is a "value" key, return it directly
	if val, ok := result.Data.Data["value"]; ok {
		return []byte(fmt.Sprintf("%v", val)), nil
	}

	// Otherwise return the full data as JSON
	encoded, err := json.Marshal(result.Data.Data)
	if err != nil {
		return nil, fmt.Errorf("encoding data: %w", err)
	}
	return encoded, nil
}

// normalizeKV2Path ensures the path includes "/data/" after the mount point
// for KV v2 API compatibility.
// Input:  "secret/my-app/github-key" -> "secret/data/my-app/github-key"
// Input:  "secret/data/my-app/github-key" -> "secret/data/my-app/github-key" (unchanged)
func normalizeKV2Path(path string) string {
	path = strings.TrimPrefix(path, "/")
	parts := strings.SplitN(path, "/", 2)
	if len(parts) < 2 {
		return path
	}
	mount := parts[0]
	rest := parts[1]

	// Already has /data/ prefix
	if strings.HasPrefix(rest, "data/") || rest == "data" {
		return path
	}
	return mount + "/data/" + rest
}
