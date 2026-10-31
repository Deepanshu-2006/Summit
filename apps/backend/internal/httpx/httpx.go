// Package httpx provides HTTP helper utilities including error envelopes,
// JSON encoding/decoding, middleware, and context helpers.
package httpx

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

// MaxRequestBodySize is the default maximum request body size (1MB).
const MaxRequestBodySize = 1 << 20

// Error envelope per spec section 14.
type ErrorEnvelope struct {
	Error ErrorBody `json:"error"`
}

type ErrorBody struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	RequestID string `json:"request_id"`
}

// APIError is a structured error with HTTP status code and machine-readable code.
type APIError struct {
	Status  int    // HTTP status code
	Code    string // machine-readable error code
	Message string // human-readable message
	Err     error  // wrapped error (not exposed to clients)
}

func (e *APIError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *APIError) Unwrap() error {
	return e.Err
}

// NewAPIError creates a new APIError.
func NewAPIError(status int, code, message string, err error) *APIError {
	return &APIError{
		Status:  status,
		Code:    code,
		Message: message,
		Err:     err,
	}
}

// Error code constants from spec section 14.
const (
	CodeInternalError                   = "INTERNAL_ERROR"
	CodeBadRequest                      = "BAD_REQUEST"
	CodeUnauthorized                    = "UNAUTHORIZED"
	CodeForbidden                       = "FORBIDDEN"
	CodeNotFound                        = "NOT_FOUND"
	CodeConflict                        = "CONFLICT"
	CodeValidationFailed                = "VALIDATION_FAILED"
	CodeGitHubAppNotConfigured          = "GITHUB_APP_NOT_CONFIGURED"
	CodeGitHubInstallationStateExpired  = "GITHUB_INSTALLATION_STATE_EXPIRED"
	CodeGitHubInstallationStateInvalid  = "GITHUB_INSTALLATION_STATE_INVALID"
	CodeGitHubInstallationNotFound      = "GITHUB_INSTALLATION_NOT_FOUND"
	CodeGitHubInstallationNotActive     = "GITHUB_INSTALLATION_NOT_ACTIVE"
	CodeGitHubInstallationAlreadyLinked = "GITHUB_INSTALLATION_ALREADY_LINKED"
	CodeGitHubInstallationPermMissing   = "GITHUB_INSTALLATION_PERMISSION_MISSING"
	CodeGitHubRepositoryNotFound        = "GITHUB_REPOSITORY_NOT_FOUND"
	CodeGitHubRepositoryNotAccessible   = "GITHUB_REPOSITORY_NOT_ACCESSIBLE"
	CodeGitHubRepositoryRemoved         = "GITHUB_REPOSITORY_REMOVED"
	CodeGitHubSourceAlreadyConfigured   = "GITHUB_SOURCE_ALREADY_CONFIGURED"
	CodeGitHubSourceInvalidBranch       = "GITHUB_SOURCE_INVALID_BRANCH"
	CodeGitHubWebhookSignatureInvalid   = "GITHUB_WEBHOOK_SIGNATURE_INVALID"
	CodeGitHubWebhookDeliveryDuplicate  = "GITHUB_WEBHOOK_DELIVERY_DUPLICATE"
	CodeGitHubAPIRateLimited            = "GITHUB_API_RATE_LIMITED"
	CodeGitHubAPIUnavailable            = "GITHUB_API_UNAVAILABLE"
	CodeServiceSourceNotFound           = "SERVICE_SOURCE_NOT_FOUND"
	CodeServiceSourceInvalidPath        = "SERVICE_SOURCE_INVALID_PATH"
	CodeBuildRequestNotFound            = "BUILD_REQUEST_NOT_FOUND"
	CodeBuildRequestNotAuthorized       = "BUILD_REQUEST_NOT_AUTHORIZED"
)

// WriteJSON writes a JSON response with the given status code.
func WriteJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		if err := json.NewEncoder(w).Encode(data); err != nil {
			// Best effort; headers already sent
			slog.Error("failed to encode JSON response", "error", err)
		}
	}
}

// WriteError writes a JSON error response using the error envelope format.
func WriteError(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	reqID := GetRequestID(r.Context())
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(ErrorEnvelope{
		Error: ErrorBody{
			Code:      code,
			Message:   message,
			RequestID: reqID,
		},
	})
}

// WriteAPIError writes an APIError as a JSON error response.
func WriteAPIError(w http.ResponseWriter, r *http.Request, apiErr *APIError) {
	WriteError(w, r, apiErr.Status, apiErr.Code, apiErr.Message)
}

// DecodeJSON decodes JSON from the request body with a 1MB size limit
// and rejects trailing data.
func DecodeJSON(r *http.Request, dst interface{}) error {
	return DecodeJSONWithLimit(r, dst, MaxRequestBodySize)
}

// DecodeJSONWithLimit decodes JSON with a custom size limit.
func DecodeJSONWithLimit(r *http.Request, dst interface{}, maxBytes int64) error {
	body := http.MaxBytesReader(nil, r.Body, maxBytes)
	defer body.Close()

	decoder := json.NewDecoder(body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(dst); err != nil {
		return fmt.Errorf("decoding JSON: %w", err)
	}

	// Reject trailing data
	if decoder.More() {
		return fmt.Errorf("request body contains trailing data")
	}

	return nil
}

// Context keys
type contextKey string

const (
	contextKeyRequestID contextKey = "request_id"
	contextKeyPrincipal contextKey = "principal"
)

// GetRequestID returns the request ID from the context.
func GetRequestID(ctx context.Context) string {
	if id, ok := ctx.Value(contextKeyRequestID).(string); ok {
		return id
	}
	return ""
}

// WithRequestID returns a new context with the given request ID.
func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, contextKeyRequestID, id)
}

// RequestIDMiddleware assigns a unique request ID to each request.
// It honors the X-Request-ID header if it contains a sane value (UUID-like,
// max 128 chars, no control characters). Otherwise, it generates a new UUID.
// The request ID is set in the X-Request-ID response header.
func RequestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if !isSaneRequestID(id) {
			id = uuid.New().String()
		}
		w.Header().Set("X-Request-ID", id)
		ctx := WithRequestID(r.Context(), id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RecoverMiddleware recovers from panics in handlers.
// It logs the panic but does not expose stack traces to clients.
func RecoverMiddleware(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					reqID := GetRequestID(r.Context())
					logger.Error("panic recovered",
						"panic", fmt.Sprintf("%v", rec),
						"method", r.Method,
						"path", r.URL.Path,
						"request_id", reqID,
					)
					WriteError(w, r, http.StatusInternalServerError, CodeInternalError, "internal server error")
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// AccessLogMiddleware logs HTTP requests, redacting Authorization, Cookie headers
// and query parameters that might contain secrets.
func AccessLogMiddleware(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}

			next.ServeHTTP(sw, r)

			// Redact sensitive query parameters
			query := r.URL.RawQuery
			if query != "" {
				query = redactQuery(query)
			}

			logger.Info("http request",
				"method", r.Method,
				"path", r.URL.Path,
				"query", query,
				"status", sw.status,
				"duration_ms", time.Since(start).Milliseconds(),
				"remote_addr", r.RemoteAddr,
				"request_id", GetRequestID(r.Context()),
				"user_agent", r.UserAgent(),
			)
		})
	}
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func isSaneRequestID(id string) bool {
	if id == "" || len(id) > 128 {
		return false
	}
	for _, c := range id {
		if c < 0x20 || c > 0x7e {
			return false
		}
	}
	return true
}

// redactQuery redacts known sensitive query parameter values.
func redactQuery(query string) string {
	sensitive := []string{"token", "secret", "key", "password", "state"}
	parts := strings.Split(query, "&")
	for i, part := range parts {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) == 2 {
			lower := strings.ToLower(kv[0])
			for _, s := range sensitive {
				if strings.Contains(lower, s) {
					parts[i] = kv[0] + "=REDACTED"
					break
				}
			}
		}
	}
	return strings.Join(parts, "&")
}

// ReadBody reads the request body up to maxBytes.
func ReadBody(r *http.Request, maxBytes int64) ([]byte, error) {
	body := io.LimitReader(r.Body, maxBytes+1)
	data, err := io.ReadAll(body)
	if err != nil {
		return nil, fmt.Errorf("reading body: %w", err)
	}
	if int64(len(data)) > maxBytes {
		return nil, fmt.Errorf("request body exceeds maximum size of %d bytes", maxBytes)
	}
	return data, nil
}
