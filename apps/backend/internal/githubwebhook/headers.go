package githubwebhook

import (
	"encoding/hex"
	"net/http"
	"strings"
)

const (
	// HeaderSignature is the GitHub HMAC-SHA256 signature header name.
	HeaderSignature = "X-Hub-Signature-256"
	// HeaderDelivery is the unique delivery GUID header name.
	HeaderDelivery = "X-GitHub-Delivery"
	// HeaderEvent is the event name header name.
	HeaderEvent = "X-GitHub-Event"
	// HeaderContentType is the standard HTTP Content-Type header name.
	HeaderContentType = "Content-Type"
)

// ParseHeaders extracts and validates required GitHub webhook headers from an incoming HTTP request header map.
// It returns typed errors when any required header is missing or malformed.
func ParseHeaders(h http.Header) (Headers, error) {
	if h == nil {
		return Headers{}, ErrMissingSignature
	}

	sig := strings.TrimSpace(h.Get(HeaderSignature))
	if sig == "" {
		return Headers{}, ErrMissingSignature
	}
	if !strings.HasPrefix(sig, "sha256=") {
		return Headers{}, ErrInvalidSignaturePrefix
	}
	sigHex := strings.TrimPrefix(sig, "sha256=")
	if len(sigHex) != 64 {
		return Headers{}, ErrMalformedSignature
	}
	if _, err := hex.DecodeString(sigHex); err != nil {
		return Headers{}, ErrMalformedSignature
	}

	delivery := strings.TrimSpace(h.Get(HeaderDelivery))
	if delivery == "" {
		return Headers{}, ErrMissingDeliveryID
	}
	for i := 0; i < len(delivery); i++ {
		c := delivery[i]
		if c < 32 || c > 126 {
			return Headers{}, ErrMalformedDeliveryID
		}
	}

	event := strings.TrimSpace(h.Get(HeaderEvent))
	if event == "" {
		return Headers{}, ErrMissingEventType
	}
	for i := 0; i < len(event); i++ {
		c := event[i]
		isValid := (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '-'
		if !isValid {
			return Headers{}, ErrMalformedEventType
		}
	}

	contentType := strings.TrimSpace(h.Get(HeaderContentType))

	return Headers{
		Signature:   sig,
		DeliveryID:  delivery,
		EventType:   event,
		ContentType: contentType,
	}, nil
}
