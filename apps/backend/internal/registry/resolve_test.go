package registry

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestValidateRef(t *testing.T) {
	ok := []string{"nginx", "nginx:1.27", "library/nginx", "ghcr.io/org/app:tag", "docker.io/library/postgres:16-alpine", "localhost:5000/app:latest"}
	for _, ref := range ok {
		if err := ValidateRef(ref); err != nil {
			t.Errorf("%s: %v", ref, err)
		}
	}
	bad := []string{"", " ", "http://nginx", "nginx:bad tag", "Nginx", "ghcr.io/Org/app", "not a ref"}
	for _, ref := range bad {
		if err := ValidateRef(ref); err == nil {
			t.Errorf("%q: want invalid", ref)
		}
	}
}

func TestResolveDigestAlreadyPinned(t *testing.T) {
	pinned := "nginx@sha256:" + strings.Repeat("ab", 32)
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		t.Fatal("pinned ref must not hit the network")
		return nil, nil
	})}
	got, err := resolveDigest(context.Background(), client, "  "+pinned+"  ")
	if err != nil || got != pinned {
		t.Fatalf("got %q err %v", got, err)
	}
}

func TestResolveDigestAnonymousBearer(t *testing.T) {
	digest := "sha256:" + strings.Repeat("cd", 32)
	var sawNginx bool
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/token":
			if r.URL.Query().Get("scope") == "" {
				t.Errorf("token query = %s", r.URL.RawQuery)
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"token":"tok"}`)
		case strings.HasPrefix(r.URL.Path, "/v2/") && r.Header.Get("Authorization") == "":
			if !strings.Contains(r.Header.Get("Accept"), "application/vnd.oci.image.index.v1+json") {
				t.Errorf("accept = %s", r.Header.Get("Accept"))
			}
			realm := "http://" + r.Host + "/token"
			w.Header().Set("WWW-Authenticate", `Bearer realm="`+realm+`",service="registry.docker.io",scope="repository:library/nginx:pull"`)
			w.WriteHeader(http.StatusUnauthorized)
		case strings.HasPrefix(r.URL.Path, "/v2/") && r.Header.Get("Authorization") == "Bearer tok":
			if r.URL.Path == "/v2/library/nginx/manifests/1.27" {
				sawNginx = true
			}
			w.Header().Set("Docker-Content-Digest", digest)
			w.WriteHeader(http.StatusOK)
		default:
			t.Errorf("unexpected %s %s auth=%q", r.Method, r.URL.Path, r.Header.Get("Authorization"))
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	client := &http.Client{Transport: rewriteHosts(srv, "registry-1.docker.io", "ghcr.io")}
	got, err := resolveDigest(context.Background(), client, "nginx:1.27")
	if err != nil {
		t.Fatal(err)
	}
	want := "docker.io/library/nginx@" + digest
	if got != want || !sawNginx {
		t.Fatalf("got %s want %s sawNginx=%v", got, want, sawNginx)
	}

	got, err = resolveDigest(context.Background(), client, "ghcr.io/acme/app:1.2.3")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(got, "ghcr.io/acme/app@sha256:") {
		t.Fatalf("ghcr got %s", got)
	}
}

func TestResolveDigestNotFoundAndPrivate(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/token" {
			_, _ = io.WriteString(w, `{"access_token":"tok"}`)
			return
		}
		if r.Header.Get("Authorization") == "" {
			realm := "http://" + r.Host + "/token"
			w.Header().Set("WWW-Authenticate", `Bearer realm="`+realm+`",service="ghcr.io",scope="repository:acme/missing:pull"`)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if strings.Contains(r.URL.Path, "missing") {
			http.NotFound(w, r)
			return
		}
		w.WriteHeader(http.StatusForbidden)
	}))
	defer srv.Close()
	client := &http.Client{Transport: rewriteHosts(srv, "ghcr.io", "registry-1.docker.io")}

	_, err := resolveDigest(context.Background(), client, "ghcr.io/acme/missing:latest")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("not found err = %v", err)
	}
	_, err = resolveDigest(context.Background(), client, "ghcr.io/acme/private:latest")
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("private err = %v", err)
	}
	_, err = resolveDigest(context.Background(), client, "NOPE")
	if !errors.Is(err, ErrInvalidRef) {
		t.Fatalf("invalid err = %v", err)
	}
}

func TestResolveDigestLive(t *testing.T) {
	if os.Getenv("SUMMIT_REGISTRY_LIVE") == "" {
		t.Skip("SUMMIT_REGISTRY_LIVE not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), resolveTimeout)
	defer cancel()
	got, err := ResolveDigest(ctx, "docker.io/library/alpine:3.20")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(got, "docker.io/library/alpine@sha256:") {
		t.Fatalf("got %s", got)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func rewriteHosts(srv *httptest.Server, hosts ...string) http.RoundTripper {
	allow := map[string]bool{}
	for _, h := range hosts {
		allow[h] = true
	}
	return roundTripFunc(func(r *http.Request) (*http.Response, error) {
		clone := r.Clone(r.Context())
		if allow[clone.URL.Host] {
			clone.URL.Scheme = "http"
			clone.URL.Host = srv.Listener.Addr().String()
		}
		return http.DefaultTransport.RoundTrip(clone)
	})
}
