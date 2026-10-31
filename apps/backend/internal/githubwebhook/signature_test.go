package githubwebhook

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"testing"
)

func computeHMAC(secret, body []byte) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func TestVerifySignature(t *testing.T) {
	secret := []byte("super-secure-webhook-secret-42")
	body := []byte(`{"ref":"refs/heads/main","after":"abc123"}`)
	validSig := computeHMAC(secret, body)

	t.Run("valid signature", func(t *testing.T) {
		err := VerifySignature(secret, body, validSig)
		if err != nil {
			t.Fatalf("expected valid signature to pass, got: %v", err)
		}
	})

	t.Run("invalid signature digest", func(t *testing.T) {
		wrongDigest := "sha256=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
		err := VerifySignature(secret, body, wrongDigest)
		if !errors.Is(err, ErrInvalidSignature) {
			t.Errorf("expected ErrInvalidSignature, got %v", err)
		}
	})

	t.Run("wrong secret", func(t *testing.T) {
		wrongSecret := []byte("wrong-secret")
		err := VerifySignature(wrongSecret, body, validSig)
		if !errors.Is(err, ErrInvalidSignature) {
			t.Errorf("expected ErrInvalidSignature with wrong secret, got %v", err)
		}
	})

	t.Run("empty secret", func(t *testing.T) {
		err := VerifySignature(nil, body, validSig)
		if !errors.Is(err, ErrEmptySecret) {
			t.Errorf("expected ErrEmptySecret, got %v", err)
		}

		err = VerifySignature([]byte(""), body, validSig)
		if !errors.Is(err, ErrEmptySecret) {
			t.Errorf("expected ErrEmptySecret, got %v", err)
		}
	})

	t.Run("missing signature header", func(t *testing.T) {
		err := VerifySignature(secret, body, "")
		if !errors.Is(err, ErrMissingSignature) {
			t.Errorf("expected ErrMissingSignature, got %v", err)
		}

		err = VerifySignature(secret, body, "   ")
		if !errors.Is(err, ErrMissingSignature) {
			t.Errorf("expected ErrMissingSignature, got %v", err)
		}
	})

	t.Run("signature missing prefix", func(t *testing.T) {
		noPrefix := validSig[7:]
		err := VerifySignature(secret, body, noPrefix)
		if !errors.Is(err, ErrInvalidSignaturePrefix) {
			t.Errorf("expected ErrInvalidSignaturePrefix, got %v", err)
		}
	})

	t.Run("malformed signature length or hex", func(t *testing.T) {
		err := VerifySignature(secret, body, "sha256=12345")
		if !errors.Is(err, ErrMalformedSignature) {
			t.Errorf("expected ErrMalformedSignature for short hex, got %v", err)
		}

		err = VerifySignature(secret, body, "sha256=zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz")
		if !errors.Is(err, ErrMalformedSignature) {
			t.Errorf("expected ErrMalformedSignature for invalid hex, got %v", err)
		}
	})

	t.Run("raw bytes sensitivity - pretty printed vs re-encoded", func(t *testing.T) {
		// Create a pretty-printed JSON payload
		prettyJSON := []byte("{\n  \"ref\": \"refs/heads/main\",\n  \"after\": \"abc123\"\n}\n")
		prettySig := computeHMAC(secret, prettyJSON)

		// 1. Exact raw pretty-printed bytes with its signature MUST pass
		if err := VerifySignature(secret, prettyJSON, prettySig); err != nil {
			t.Fatalf("expected raw pretty-printed bytes to verify: %v", err)
		}

		// 2. Decode and re-encode to compact JSON
		var rawMap map[string]interface{}
		if err := json.Unmarshal(prettyJSON, &rawMap); err != nil {
			t.Fatalf("failed unmarshaling: %v", err)
		}
		reEncodedCompact, err := json.Marshal(rawMap)
		if err != nil {
			t.Fatalf("failed marshaling: %v", err)
		}

		// Ensure the bytes actually differ
		if bytes.Equal(prettyJSON, reEncodedCompact) {
			t.Fatal("expected prettyJSON and reEncodedCompact to differ in bytes")
		}

		// 3. Verifying the re-encoded bytes against the original signature MUST fail
		err = VerifySignature(secret, reEncodedCompact, prettySig)
		if !errors.Is(err, ErrInvalidSignature) {
			t.Fatalf("expected ErrInvalidSignature when verifying re-encoded JSON, got %v", err)
		}
	})
}
