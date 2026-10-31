package registry

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
)

func newDockerConfig(t *testing.T, host, user, pass string) *DockerConfig {
	t.Helper()
	auth := base64.StdEncoding.EncodeToString([]byte(user + ":" + pass))
	cfg, err := ParseDockerConfig([]byte(`{"auths":{"` + host + `":{"auth":"` + auth + `"}}}`))
	if err != nil {
		t.Fatalf("parse docker config: %v", err)
	}
	return cfg
}

func TestRegistryClient_VerifyDigest(t *testing.T) {
	manifestPayload := `{"schemaVersion": 2, "mediaType": "application/vnd.oci.image.manifest.v1+json"}`
	expectedDigest := "sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"

	var gotAccept string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v2/tenant/app/manifests/build-1" {
			http.NotFound(w, r)
			return
		}
		gotAccept = r.Header.Get("Accept")
		w.Header().Set("Docker-Content-Digest", expectedDigest)
		w.Header().Set("Content-Type", "application/vnd.oci.image.manifest.v1+json")
		_, _ = w.Write([]byte(manifestPayload))
	}))
	defer server.Close()

	u, _ := url.Parse(server.URL)
	client := NewClient(server.Client())
	art, err := client.VerifyDigest(context.Background(), u.Host, "tenant/app", "build-1")
	if err != nil {
		t.Fatalf("unexpected error verifying digest: %v", err)
	}
	if art.Digest != expectedDigest {
		t.Errorf("expected digest %s, got %s", expectedDigest, art.Digest)
	}
	if art.Tag != "build-1" || art.Repository != u.Host+"/tenant/app" {
		t.Errorf("unexpected artifact coordinates: %+v", art)
	}
	for _, mt := range []string{
		"application/vnd.oci.image.index.v1+json",
		"application/vnd.oci.image.manifest.v1+json",
		"application/vnd.docker.distribution.manifest.list.v2+json",
		"application/vnd.docker.distribution.manifest.v2+json",
	} {
		if !strings.Contains(gotAccept, mt) {
			t.Errorf("Accept header %q is missing %s", gotAccept, mt)
		}
	}
}

func TestRegistryClient_DigestComputedWhenHeaderAbsent(t *testing.T) {
	body := `{"schemaVersion":2,"manifests":[]}`
	sum := sha256.Sum256([]byte(body))
	want := "sha256:" + hex.EncodeToString(sum[:])

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/vnd.oci.image.index.v1+json")
		_, _ = w.Write([]byte(body))
	}))
	defer server.Close()
	u, _ := url.Parse(server.URL)

	art, err := NewClient(server.Client()).VerifyDigest(context.Background(), u.Host, "o/r", "sha-abc")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if art.Digest != want {
		t.Errorf("expected computed digest %s, got %s", want, art.Digest)
	}
}

// TestRegistryClient_BearerTokenFlow models GHCR: anonymous manifest request -> 401 with
// a Bearer challenge -> token from the realm using basic auth from docker config -> retry.
func TestRegistryClient_BearerTokenFlow(t *testing.T) {
	const wantDigest = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	const bearer = "registry-bearer-token"

	var mu sync.Mutex
	var manifestCalls, tokenCalls int
	var tokenQuery url.Values
	var tokenBasicUser, tokenBasicPass string

	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		switch r.URL.Path {
		case "/token":
			tokenCalls++
			tokenQuery = r.URL.Query()
			tokenBasicUser, tokenBasicPass, _ = r.BasicAuth()
			_, _ = w.Write([]byte(`{"token":"` + bearer + `"}`))
		case "/v2/owner/summit-app-svc/manifests/sha-abc":
			manifestCalls++
			if r.Header.Get("Authorization") != "Bearer "+bearer {
				w.Header().Set("Www-Authenticate", `Bearer realm="`+server.URL+`/token",service="ghcr.io",scope="repository:owner/summit-app-svc:pull"`)
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Header().Set("Docker-Content-Digest", wantDigest)
			w.Header().Set("Content-Type", "application/vnd.oci.image.index.v1+json")
			_, _ = w.Write([]byte(`{"schemaVersion":2,"mediaType":"application/vnd.oci.image.index.v1+json","manifests":[]}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	u, _ := url.Parse(server.URL)

	client := NewClient(server.Client(), WithDockerConfig(newDockerConfig(t, u.Host, "robot", "s3cret")))
	art, err := client.VerifyDigest(context.Background(), u.Host, "owner/summit-app-svc", "sha-abc")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if art.Digest != wantDigest {
		t.Errorf("digest = %s, want %s", art.Digest, wantDigest)
	}
	if manifestCalls != 2 || tokenCalls != 1 {
		t.Errorf("manifestCalls=%d tokenCalls=%d, want 2 and 1", manifestCalls, tokenCalls)
	}
	if tokenBasicUser != "robot" || tokenBasicPass != "s3cret" {
		t.Errorf("token request basic auth = %q/%q", tokenBasicUser, tokenBasicPass)
	}
	if tokenQuery.Get("service") != "ghcr.io" || tokenQuery.Get("scope") != "repository:owner/summit-app-svc:pull" {
		t.Errorf("token query = %v", tokenQuery)
	}
}

func TestRegistryClient_BearerAnonymousWithoutCredentials(t *testing.T) {
	var sawBasic bool
	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			_, _, sawBasic = r.BasicAuth()
			_, _ = w.Write([]byte(`{"access_token":"anon"}`))
		default:
			if r.Header.Get("Authorization") != "Bearer anon" {
				w.Header().Set("Www-Authenticate", `Bearer realm="`+server.URL+`/token",service="x"`)
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Header().Set("Docker-Content-Digest", "sha256:"+strings.Repeat("b", 64))
			_, _ = w.Write([]byte("{}"))
		}
	}))
	defer server.Close()
	u, _ := url.Parse(server.URL)

	art, err := NewClient(server.Client()).VerifyDigest(context.Background(), u.Host, "o/r", "t")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sawBasic {
		t.Error("token request carried basic auth although no credentials are configured")
	}
	if art.Digest != "sha256:"+strings.Repeat("b", 64) {
		t.Errorf("unexpected digest %s", art.Digest)
	}
}

func TestRegistryClient_TokenEndpointRejectsCredentials(t *testing.T) {
	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/token" {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		w.Header().Set("Www-Authenticate", `Bearer realm="`+server.URL+`/token"`)
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()
	u, _ := url.Parse(server.URL)

	client := NewClient(server.Client(), WithDockerConfig(newDockerConfig(t, u.Host, "robot", "pw-should-not-leak")))
	_, err := client.VerifyDigest(context.Background(), u.Host, "o/r", "t")
	if err == nil {
		t.Fatal("expected error when token endpoint rejects credentials")
	}
	if strings.Contains(err.Error(), "pw-should-not-leak") {
		t.Errorf("error leaks password: %v", err)
	}
}

func TestRegistryClient_NotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer server.Close()

	u, _ := url.Parse(server.URL)
	if _, err := NewClient(server.Client()).VerifyDigest(context.Background(), u.Host, "missing/app", "build-1"); err == nil {
		t.Fatal("expected error on 404, got nil")
	}
}

func TestRegistryClient_SchemeSelection(t *testing.T) {
	c := NewClient(nil, WithInsecureRegistries("Registry.Test:5000"))
	cases := map[string]bool{
		"ghcr.io":                   false,
		"registry.example.internal": false, // the old ".internal" heuristic is gone
		"registry.test:5000":        true,
		"localhost:5000":            true,
		"127.0.0.1:5000":            true,
		"[::1]:5000":                true,
		"localhost.evil.com":        false,
	}
	for host, wantInsecure := range cases {
		if got := c.IsInsecure(host); got != wantInsecure {
			t.Errorf("IsInsecure(%q) = %v, want %v", host, got, wantInsecure)
		}
		wantScheme := "https"
		if wantInsecure {
			wantScheme = "http"
		}
		if got := c.scheme(host); got != wantScheme {
			t.Errorf("scheme(%q) = %s, want %s", host, got, wantScheme)
		}
	}
}

func TestDockerConfig_CredentialsFor(t *testing.T) {
	cfg, err := ParseDockerConfig([]byte(`{"auths":{
		"https://ghcr.io/v1/":{"auth":"` + base64.StdEncoding.EncodeToString([]byte("u1:p:with:colons")) + `"},
		"other.io":{"username":"u2","password":"p2"}
	}}`))
	if err != nil {
		t.Fatal(err)
	}
	if c, ok := cfg.CredentialsFor("ghcr.io"); !ok || c.Username != "u1" || c.Password != "p:with:colons" {
		t.Errorf("ghcr.io creds = %+v ok=%v", c, ok)
	}
	if c, ok := cfg.CredentialsFor("other.io"); !ok || c.Username != "u2" || c.Password != "p2" {
		t.Errorf("other.io creds = %+v ok=%v", c, ok)
	}
	if _, ok := cfg.CredentialsFor("missing.io"); ok {
		t.Error("expected no creds for missing.io")
	}
	if _, err := ParseDockerConfig([]byte("not json")); err == nil {
		t.Error("expected parse error")
	}
}

func TestParseChallenge(t *testing.T) {
	scheme, p := parseChallenge(`Bearer realm="https://ghcr.io/token",service="ghcr.io",scope="repository:o/r:pull"`)
	if scheme != "Bearer" || p["realm"] != "https://ghcr.io/token" || p["service"] != "ghcr.io" || p["scope"] != "repository:o/r:pull" {
		t.Errorf("scheme=%q params=%v", scheme, p)
	}
}
