package registry

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestRegistryClient_VerifyDigest(t *testing.T) {
	manifestPayload := `{"schemaVersion": 2, "mediaType": "application/vnd.oci.image.manifest.v1+json"}`
	expectedDigest := "sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v2/tenant/app/manifests/build-1" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Docker-Content-Digest", expectedDigest)
		w.Header().Set("Content-Type", "application/vnd.oci.image.manifest.v1+json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(manifestPayload))
	}))
	defer server.Close()

	u, err := url.Parse(server.URL)
	if err != nil {
		t.Fatalf("parsing test server URL: %v", err)
	}

	client := NewClient(server.Client())
	art, err := client.VerifyDigest(context.Background(), u.Host, "tenant/app", "build-1", "test-token")
	if err != nil {
		t.Fatalf("unexpected error verifying digest: %v", err)
	}

	if art.Digest != expectedDigest {
		t.Errorf("expected digest %s, got %s", expectedDigest, art.Digest)
	}
	if art.Tag != "build-1" {
		t.Errorf("expected tag build-1, got %s", art.Tag)
	}
}

func TestRegistryClient_NotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer server.Close()

	u, _ := url.Parse(server.URL)
	client := NewClient(server.Client())
	_, err := client.VerifyDigest(context.Background(), u.Host, "missing/app", "build-1", "")
	if err == nil {
		t.Fatal("expected error on 404, got nil")
	}
}
