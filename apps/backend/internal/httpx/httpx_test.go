package httpx

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWriteJSON(t *testing.T) {
	w := httptest.NewRecorder()
	data := map[string]string{"hello": "world"}
	WriteJSON(w, http.StatusOK, data)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected application/json, got %s", ct)
	}

	var result map[string]string
	if err := json.NewDecoder(w.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if result["hello"] != "world" {
		t.Errorf("unexpected response: %v", result)
	}
}

func TestWriteError(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/test", nil)
	r = r.WithContext(WithRequestID(r.Context(), "req-123"))

	WriteError(w, r, http.StatusBadRequest, CodeBadRequest, "bad request")

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}

	var env ErrorEnvelope
	if err := json.NewDecoder(w.Body).Decode(&env); err != nil {
		t.Fatalf("failed to decode error: %v", err)
	}
	if env.Error.Code != CodeBadRequest {
		t.Errorf("expected code %s, got %s", CodeBadRequest, env.Error.Code)
	}
	if env.Error.RequestID != "req-123" {
		t.Errorf("expected request_id req-123, got %s", env.Error.RequestID)
	}
}

func TestDecodeJSON(t *testing.T) {
	body := `{"name":"test"}`
	r := httptest.NewRequest("POST", "/test", strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")

	var dst struct {
		Name string `json:"name"`
	}
	if err := DecodeJSON(r, &dst); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dst.Name != "test" {
		t.Errorf("expected name test, got %s", dst.Name)
	}
}

func TestDecodeJSON_TrailingData(t *testing.T) {
	body := `{"name":"test"}{"extra":"data"}`
	r := httptest.NewRequest("POST", "/test", strings.NewReader(body))

	var dst struct {
		Name string `json:"name"`
	}
	err := DecodeJSON(r, &dst)
	if err == nil {
		t.Error("expected error for trailing data")
	}
}

func TestDecodeJSON_Oversized(t *testing.T) {
	// Create a body larger than 1MB
	big := bytes.Repeat([]byte("a"), MaxRequestBodySize+100)
	body := `{"name":"` + string(big) + `"}`
	r := httptest.NewRequest("POST", "/test", strings.NewReader(body))

	var dst struct {
		Name string `json:"name"`
	}
	err := DecodeJSON(r, &dst)
	if err == nil {
		t.Error("expected error for oversized body")
	}
}

func TestRequestIDMiddleware(t *testing.T) {
	handler := RequestIDMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := GetRequestID(r.Context())
		w.Write([]byte(id))
	}))

	// Test with no X-Request-ID
	r := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	id := w.Header().Get("X-Request-ID")
	if id == "" {
		t.Error("expected X-Request-ID to be set")
	}
	if w.Body.String() != id {
		t.Errorf("expected body to match header, got body=%s header=%s", w.Body.String(), id)
	}

	// Test with valid X-Request-ID
	r = httptest.NewRequest("GET", "/", nil)
	r.Header.Set("X-Request-ID", "custom-id-123")
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	if got := w.Header().Get("X-Request-ID"); got != "custom-id-123" {
		t.Errorf("expected custom-id-123, got %s", got)
	}
}

func TestRecoverMiddleware(t *testing.T) {
	logger := slog.New(slog.NewJSONHandler(&bytes.Buffer{}, nil))
	handler := RecoverMiddleware(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("test panic")
	}))

	r := httptest.NewRequest("GET", "/", nil)
	r = r.WithContext(WithRequestID(r.Context(), "test-req"))
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, r)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}

	var env ErrorEnvelope
	if err := json.NewDecoder(w.Body).Decode(&env); err != nil {
		t.Fatalf("failed to decode error: %v", err)
	}
	if env.Error.Code != CodeInternalError {
		t.Errorf("expected INTERNAL_ERROR, got %s", env.Error.Code)
	}
}

func TestAPIError(t *testing.T) {
	err := NewAPIError(http.StatusNotFound, CodeNotFound, "not found", nil)
	if err.Error() != "NOT_FOUND: not found" {
		t.Errorf("unexpected error string: %s", err.Error())
	}

	wrapped := NewAPIError(http.StatusInternalServerError, CodeInternalError, "failed", err)
	if wrapped.Unwrap() != err {
		t.Error("expected Unwrap to return wrapped error")
	}
}

func TestIsSaneRequestID(t *testing.T) {
	tests := []struct {
		id   string
		want bool
	}{
		{"", false},
		{"valid-id-123", true},
		{"a\x00b", false},
		{strings.Repeat("a", 129), false},
		{"uuid-with-dashes-ok", true},
	}
	for _, tt := range tests {
		if got := isSaneRequestID(tt.id); got != tt.want {
			t.Errorf("isSaneRequestID(%q) = %v, want %v", tt.id, got, tt.want)
		}
	}
}

func TestRedactQuery(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"foo=bar&token=abc123", "foo=bar&token=REDACTED"},
		{"secret=mysecret&name=test", "secret=REDACTED&name=test"},
		{"key=abc&password=xyz", "key=REDACTED&password=REDACTED"},
		{"page=1&limit=10", "page=1&limit=10"},
	}
	for _, tt := range tests {
		got := redactQuery(tt.input)
		if got != tt.want {
			t.Errorf("redactQuery(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestGetRequestID_Empty(t *testing.T) {
	ctx := context.Background()
	if id := GetRequestID(ctx); id != "" {
		t.Errorf("expected empty request ID, got %s", id)
	}
}
