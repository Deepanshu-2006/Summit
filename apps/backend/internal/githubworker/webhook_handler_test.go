package githubworker

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/githubwebhook"
	"github.com/summit/backend/internal/secrets"
	"github.com/summit/backend/internal/testutil"
)

type mockSecretsProvider struct {
	secrets map[string][]byte
}

func (m *mockSecretsProvider) Get(_ context.Context, path string) ([]byte, error) {
	if val, ok := m.secrets[path]; ok {
		return val, nil
	}
	return nil, secrets.ErrSecretNotFound
}

func computeHMAC(secret, body []byte) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func TestWebhookHandler_HeaderAndSignatureValidation(t *testing.T) {
	secret := []byte("test-webhook-secret-12345")
	secProvider := &mockSecretsProvider{
		secrets: map[string][]byte{
			secrets.PathGitHubWebhookSecret: secret,
		},
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := NewWebhookHandler(nil, secProvider, 1024*1024, logger)

	t.Run("rejects non-POST methods", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/webhooks/github", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusMethodNotAllowed {
			t.Errorf("expected status 405, got %d", rec.Code)
		}
	})

	t.Run("missing signature header returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/v1/webhooks/github", bytes.NewReader([]byte("{}")))
		req.Header.Set(githubwebhook.HeaderDelivery, "deliv-123")
		req.Header.Set(githubwebhook.HeaderEvent, "push")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", rec.Code)
		}
	})

	t.Run("malformed signature format returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/v1/webhooks/github", bytes.NewReader([]byte("{}")))
		req.Header.Set(githubwebhook.HeaderSignature, "invalid-sig")
		req.Header.Set(githubwebhook.HeaderDelivery, "deliv-123")
		req.Header.Set(githubwebhook.HeaderEvent, "push")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", rec.Code)
		}
	})

	t.Run("missing delivery header returns 400", func(t *testing.T) {
		body := []byte(`{"ref":"refs/heads/main"}`)
		sig := computeHMAC(secret, body)
		req := httptest.NewRequest(http.MethodPost, "/v1/webhooks/github", bytes.NewReader(body))
		req.Header.Set(githubwebhook.HeaderSignature, sig)
		req.Header.Set(githubwebhook.HeaderEvent, "push")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rec.Code)
		}
	})

	t.Run("missing event header returns 400", func(t *testing.T) {
		body := []byte(`{"ref":"refs/heads/main"}`)
		sig := computeHMAC(secret, body)
		req := httptest.NewRequest(http.MethodPost, "/v1/webhooks/github", bytes.NewReader(body))
		req.Header.Set(githubwebhook.HeaderSignature, sig)
		req.Header.Set(githubwebhook.HeaderDelivery, "deliv-123")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rec.Code)
		}
	})

	t.Run("invalid HMAC signature digest returns 401", func(t *testing.T) {
		body := []byte(`{"ref":"refs/heads/main"}`)
		wrongSecret := []byte("wrong-secret-99999")
		wrongSig := computeHMAC(wrongSecret, body)

		req := httptest.NewRequest(http.MethodPost, "/v1/webhooks/github", bytes.NewReader(body))
		req.Header.Set(githubwebhook.HeaderSignature, wrongSig)
		req.Header.Set(githubwebhook.HeaderDelivery, "deliv-123")
		req.Header.Set(githubwebhook.HeaderEvent, "push")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", rec.Code)
		}
	})

	t.Run("body exceeding maximum size returns 413", func(t *testing.T) {
		smallLimitHandler := NewWebhookHandler(nil, secProvider, 50, logger)
		largeBody := make([]byte, 100)
		for i := range largeBody {
			largeBody[i] = 'a'
		}
		sig := computeHMAC(secret, largeBody)

		req := httptest.NewRequest(http.MethodPost, "/v1/webhooks/github", bytes.NewReader(largeBody))
		req.Header.Set(githubwebhook.HeaderSignature, sig)
		req.Header.Set(githubwebhook.HeaderDelivery, "deliv-large")
		req.Header.Set(githubwebhook.HeaderEvent, "push")
		rec := httptest.NewRecorder()
		smallLimitHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusRequestEntityTooLarge {
			t.Errorf("expected status 413, got %d", rec.Code)
		}
	})
}

func TestWebhookHandler_DurableIngestionAndDeduplication(t *testing.T) {
	pool := testutil.NewDB(t)

	secret := []byte("test-webhook-secret-12345")
	secProvider := &mockSecretsProvider{
		secrets: map[string][]byte{
			secrets.PathGitHubWebhookSecret: secret,
		},
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := NewWebhookHandler(pool, secProvider, 1024*1024, logger)

	deliveryID := uuid.New().String()
	payload := map[string]any{
		"ref":    "refs/heads/main",
		"before": "0000000000000000000000000000000000000000",
		"after":  "1111111111111111111111111111111111111111",
		"repository": map[string]any{
			"id":        int64(98765),
			"full_name": "acme/webapp",
			"name":      "webapp",
		},
		"installation": map[string]any{
			"id": int64(123456),
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshaling payload: %v", err)
	}
	sig := computeHMAC(secret, body)

	// 1. First delivery -> accepted (202)
	req1 := httptest.NewRequest(http.MethodPost, "/v1/webhooks/github", bytes.NewReader(body))
	req1.Header.Set(githubwebhook.HeaderSignature, sig)
	req1.Header.Set(githubwebhook.HeaderDelivery, deliveryID)
	req1.Header.Set(githubwebhook.HeaderEvent, "push")
	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusAccepted {
		t.Fatalf("expected status 202, got %d (body: %s)", rec1.Code, rec1.Body.String())
	}

	var resp1 map[string]any
	if err := json.NewDecoder(rec1.Body).Decode(&resp1); err != nil {
		t.Fatalf("decoding response 1: %v", err)
	}
	if resp1["status"] != "received" {
		t.Errorf("expected status received, got %v", resp1["status"])
	}
	if resp1["delivery_id"] != deliveryID {
		t.Errorf("expected delivery_id %s, got %v", deliveryID, resp1["delivery_id"])
	}

	// Verify row in database
	var count int
	var status string
	var instID int64
	var repoID int64
	err = pool.QueryRow(context.Background(),
		"SELECT count(*), processing_status, github_installation_id, github_repository_id FROM github_webhook_events WHERE github_delivery_id = $1 GROUP BY processing_status, github_installation_id, github_repository_id",
		deliveryID,
	).Scan(&count, &status, &instID, &repoID)
	if err != nil {
		t.Fatalf("querying ingested event: %v", err)
	}
	if count != 1 || status != "received" {
		t.Errorf("expected 1 received event, got count=%d, status=%s", count, status)
	}
	if instID != 123456 || repoID != 98765 {
		t.Errorf("expected instID=123456, repoID=98765, got instID=%d, repoID=%d", instID, repoID)
	}

	// 2. Duplicate delivery with same delivery ID -> HTTP 200 without duplicate insertion
	req2 := httptest.NewRequest(http.MethodPost, "/v1/webhooks/github", bytes.NewReader(body))
	req2.Header.Set(githubwebhook.HeaderSignature, sig)
	req2.Header.Set(githubwebhook.HeaderDelivery, deliveryID)
	req2.Header.Set(githubwebhook.HeaderEvent, "push")
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected status 200 for duplicate delivery, got %d", rec2.Code)
	}

	var resp2 map[string]any
	if err := json.NewDecoder(rec2.Body).Decode(&resp2); err != nil {
		t.Fatalf("decoding response 2: %v", err)
	}
	if resp2["duplicate"] != true {
		t.Errorf("expected duplicate: true in response 2, got %v", resp2["duplicate"])
	}

	// Verify only 1 row remains in database
	var totalRows int
	err = pool.QueryRow(context.Background(),
		"SELECT count(*) FROM github_webhook_events WHERE github_delivery_id = $1",
		deliveryID,
	).Scan(&totalRows)
	if err != nil {
		t.Fatalf("counting rows: %v", err)
	}
	if totalRows != 1 {
		t.Errorf("expected exactly 1 row, got %d", totalRows)
	}
}

func TestWebhookHandler_UnsupportedEventIngestedAsIgnored(t *testing.T) {
	pool := testutil.NewDB(t)

	secret := []byte("test-webhook-secret-12345")
	secProvider := &mockSecretsProvider{
		secrets: map[string][]byte{
			secrets.PathGitHubWebhookSecret: secret,
		},
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := NewWebhookHandler(pool, secProvider, 1024*1024, logger)

	deliveryID := uuid.New().String()
	body := []byte(`{"action":"starred"}`)
	sig := computeHMAC(secret, body)

	req := httptest.NewRequest(http.MethodPost, "/v1/webhooks/github", bytes.NewReader(body))
	req.Header.Set(githubwebhook.HeaderSignature, sig)
	req.Header.Set(githubwebhook.HeaderDelivery, deliveryID)
	req.Header.Set(githubwebhook.HeaderEvent, "watch")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected status 202, got %d (body: %s)", rec.Code, rec.Body.String())
	}

	var status string
	err := pool.QueryRow(context.Background(),
		"SELECT processing_status FROM github_webhook_events WHERE github_delivery_id = $1",
		deliveryID,
	).Scan(&status)
	if err != nil {
		t.Fatalf("querying ingested unsupported event: %v", err)
	}
	if status != "ignored" {
		t.Errorf("expected status 'ignored' for unsupported event, got %s", status)
	}
}
