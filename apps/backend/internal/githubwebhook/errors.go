package githubwebhook

import (
	"errors"
	"fmt"
)

var (
	// ErrMissingSignature is returned when X-Hub-Signature-256 is absent or empty.
	ErrMissingSignature = errors.New("githubwebhook: missing X-Hub-Signature-256 header")

	// ErrInvalidSignaturePrefix is returned when signature does not start with sha256=.
	ErrInvalidSignaturePrefix = errors.New("githubwebhook: signature header must start with 'sha256='")

	// ErrMalformedSignature is returned when the signature hex string is invalid or not 64 hex characters (32 bytes).
	ErrMalformedSignature = errors.New("githubwebhook: malformed signature header")

	// ErrInvalidSignature is returned when signature verification fails against the HMAC-SHA256 digest.
	ErrInvalidSignature = errors.New("githubwebhook: signature verification failed")

	// ErrEmptySecret is returned when the webhook signing secret is empty.
	ErrEmptySecret = errors.New("githubwebhook: webhook secret must not be empty")

	// ErrMissingDeliveryID is returned when X-GitHub-Delivery is absent or empty.
	ErrMissingDeliveryID = errors.New("githubwebhook: missing X-GitHub-Delivery header")

	// ErrMalformedDeliveryID is returned when X-GitHub-Delivery contains invalid characters.
	ErrMalformedDeliveryID = errors.New("githubwebhook: malformed X-GitHub-Delivery header")

	// ErrMissingEventType is returned when X-GitHub-Event is absent or empty.
	ErrMissingEventType = errors.New("githubwebhook: missing X-GitHub-Event header")

	// ErrMalformedEventType is returned when X-GitHub-Event contains invalid characters.
	ErrMalformedEventType = errors.New("githubwebhook: malformed X-GitHub-Event header")

	// ErrBodyTooLarge is returned when the request body exceeds the configured maximum byte limit.
	ErrBodyTooLarge = errors.New("githubwebhook: request body exceeds maximum allowed size")

	// ErrNilRequestBody is returned when http.Request or Body is nil.
	ErrNilRequestBody = errors.New("githubwebhook: request or request body is nil")

	// ErrMalformedJSON is returned when the webhook payload is not valid JSON.
	ErrMalformedJSON = errors.New("githubwebhook: malformed JSON payload")

	// ErrMissingAction is returned when an event type requiring an action (such as installation) lacks an action.
	ErrMissingAction = errors.New("githubwebhook: missing required action in event")
)

// UnsupportedError represents an unsupported GitHub event type.
type UnsupportedError struct {
	EventType string
	Reason    string
}

func (e *UnsupportedError) Error() string {
	if e.Reason != "" {
		return fmt.Sprintf("githubwebhook: unsupported event %q: %s", e.EventType, e.Reason)
	}
	return fmt.Sprintf("githubwebhook: unsupported event %q", e.EventType)
}

// IsUnsupported returns true if the error is an UnsupportedError.
func IsUnsupported(err error) bool {
	var target *UnsupportedError
	return errors.As(err, &target)
}
