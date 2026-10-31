package registry

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
)

// Credentials are basic-auth credentials for a registry.
type Credentials struct {
	Username string
	Password string
}

// IsZero reports whether no credentials are set.
func (c Credentials) IsZero() bool { return c.Username == "" && c.Password == "" }

// dockerConfig is the subset of ~/.docker/config.json (or a kubernetes.io/dockerconfigjson
// secret) that the builder needs.
type dockerConfig struct {
	Auths map[string]dockerAuthEntry `json:"auths"`
}

type dockerAuthEntry struct {
	Auth     string `json:"auth"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// DockerConfig holds parsed registry credentials.
type DockerConfig struct {
	auths map[string]dockerAuthEntry
}

// LoadDockerConfig reads and parses a docker config.json file. Errors never include file
// content.
func LoadDockerConfig(path string) (*DockerConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		var pe *os.PathError
		if errors.As(err, &pe) {
			err = pe.Err
		}
		return nil, fmt.Errorf("reading registry credential file: %w", err)
	}
	return ParseDockerConfig(data)
}

// ParseDockerConfig parses docker config.json content.
func ParseDockerConfig(data []byte) (*DockerConfig, error) {
	var raw dockerConfig
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, errors.New("registry credential file is not valid docker config JSON")
	}
	return &DockerConfig{auths: raw.Auths}, nil
}

// CredentialsFor returns the credentials configured for registryHost (for example
// "ghcr.io"). Keys may be a bare host or an URL such as "https://ghcr.io/v1/".
func (d *DockerConfig) CredentialsFor(registryHost string) (Credentials, bool) {
	if d == nil {
		return Credentials{}, false
	}
	want := strings.ToLower(strings.TrimSpace(registryHost))
	for key, entry := range d.auths {
		if normalizeAuthKey(key) != want {
			continue
		}
		if c, ok := entry.credentials(); ok {
			return c, true
		}
	}
	return Credentials{}, false
}

func (e dockerAuthEntry) credentials() (Credentials, bool) {
	if e.Auth != "" {
		decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(e.Auth))
		if err == nil {
			if user, pass, ok := strings.Cut(string(decoded), ":"); ok {
				return Credentials{Username: user, Password: pass}, true
			}
		}
	}
	if e.Username != "" || e.Password != "" {
		return Credentials{Username: e.Username, Password: e.Password}, true
	}
	return Credentials{}, false
}

func normalizeAuthKey(key string) string {
	k := strings.ToLower(strings.TrimSpace(key))
	k = strings.TrimPrefix(k, "https://")
	k = strings.TrimPrefix(k, "http://")
	if i := strings.Index(k, "/"); i >= 0 {
		k = k[:i]
	}
	return k
}
