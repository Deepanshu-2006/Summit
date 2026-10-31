package githubwebhook

import (
	"errors"
	"net/http"
	"testing"
)

func TestParseHeaders(t *testing.T) {
	validSig := "sha256=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	validDelivery := "72d3162e-cc78-11e3-81ab-4c9367dc0958"
	validEvent := "push"

	t.Run("valid headers", func(t *testing.T) {
		h := http.Header{}
		h.Set(HeaderSignature, validSig)
		h.Set(HeaderDelivery, validDelivery)
		h.Set(HeaderEvent, validEvent)
		h.Set(HeaderContentType, "application/json")

		parsed, err := ParseHeaders(h)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if parsed.Signature != validSig {
			t.Errorf("expected signature %q, got %q", validSig, parsed.Signature)
		}
		if parsed.DeliveryID != validDelivery {
			t.Errorf("expected delivery %q, got %q", validDelivery, parsed.DeliveryID)
		}
		if parsed.EventType != validEvent {
			t.Errorf("expected event %q, got %q", validEvent, parsed.EventType)
		}
		if parsed.ContentType != "application/json" {
			t.Errorf("expected content-type 'application/json', got %q", parsed.ContentType)
		}
	})

	t.Run("nil header map", func(t *testing.T) {
		_, err := ParseHeaders(nil)
		if !errors.Is(err, ErrMissingSignature) {
			t.Errorf("expected ErrMissingSignature, got %v", err)
		}
	})

	t.Run("missing signature", func(t *testing.T) {
		h := http.Header{}
		h.Set(HeaderDelivery, validDelivery)
		h.Set(HeaderEvent, validEvent)

		_, err := ParseHeaders(h)
		if !errors.Is(err, ErrMissingSignature) {
			t.Errorf("expected ErrMissingSignature, got %v", err)
		}
	})

	t.Run("signature missing sha256 prefix", func(t *testing.T) {
		h := http.Header{}
		h.Set(HeaderSignature, "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
		h.Set(HeaderDelivery, validDelivery)
		h.Set(HeaderEvent, validEvent)

		_, err := ParseHeaders(h)
		if !errors.Is(err, ErrInvalidSignaturePrefix) {
			t.Errorf("expected ErrInvalidSignaturePrefix, got %v", err)
		}
	})

	t.Run("signature invalid length", func(t *testing.T) {
		h := http.Header{}
		h.Set(HeaderSignature, "sha256=123456")
		h.Set(HeaderDelivery, validDelivery)
		h.Set(HeaderEvent, validEvent)

		_, err := ParseHeaders(h)
		if !errors.Is(err, ErrMalformedSignature) {
			t.Errorf("expected ErrMalformedSignature, got %v", err)
		}
	})

	t.Run("signature invalid hex", func(t *testing.T) {
		h := http.Header{}
		h.Set(HeaderSignature, "sha256=zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz")
		h.Set(HeaderDelivery, validDelivery)
		h.Set(HeaderEvent, validEvent)

		_, err := ParseHeaders(h)
		if !errors.Is(err, ErrMalformedSignature) {
			t.Errorf("expected ErrMalformedSignature, got %v", err)
		}
	})

	t.Run("missing delivery ID", func(t *testing.T) {
		h := http.Header{}
		h.Set(HeaderSignature, validSig)
		h.Set(HeaderEvent, validEvent)

		_, err := ParseHeaders(h)
		if !errors.Is(err, ErrMissingDeliveryID) {
			t.Errorf("expected ErrMissingDeliveryID, got %v", err)
		}
	})

	t.Run("malformed delivery ID with control characters", func(t *testing.T) {
		h := http.Header{}
		h.Set(HeaderSignature, validSig)
		h.Set(HeaderDelivery, "delivery\x00id")
		h.Set(HeaderEvent, validEvent)

		_, err := ParseHeaders(h)
		if !errors.Is(err, ErrMalformedDeliveryID) {
			t.Errorf("expected ErrMalformedDeliveryID, got %v", err)
		}
	})

	t.Run("missing event type", func(t *testing.T) {
		h := http.Header{}
		h.Set(HeaderSignature, validSig)
		h.Set(HeaderDelivery, validDelivery)

		_, err := ParseHeaders(h)
		if !errors.Is(err, ErrMissingEventType) {
			t.Errorf("expected ErrMissingEventType, got %v", err)
		}
	})

	t.Run("malformed event type with invalid chars", func(t *testing.T) {
		h := http.Header{}
		h.Set(HeaderSignature, validSig)
		h.Set(HeaderDelivery, validDelivery)
		h.Set(HeaderEvent, "push event!")

		_, err := ParseHeaders(h)
		if !errors.Is(err, ErrMalformedEventType) {
			t.Errorf("expected ErrMalformedEventType, got %v", err)
		}
	})
}
