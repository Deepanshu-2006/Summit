package githubwebhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"strings"
)

// VerifySignature verifies that the provided body matches the signatureHeader using HMAC-SHA256 with the secret.
// It requires the 'sha256=' prefix on the signature, decodes the hex digest, computes the HMAC-SHA256
// over the exact raw body bytes, and compares using crypto/subtle constant-time comparison to prevent timing attacks.
// An empty secret or missing/malformed signature header produces a typed error.
func VerifySignature(secret, body []byte, signatureHeader string) error {
	if len(secret) == 0 {
		return ErrEmptySecret
	}

	sig := strings.TrimSpace(signatureHeader)
	if sig == "" {
		return ErrMissingSignature
	}

	if !strings.HasPrefix(sig, "sha256=") {
		return ErrInvalidSignaturePrefix
	}

	sigHex := strings.TrimPrefix(sig, "sha256=")
	if len(sigHex) != 64 {
		return ErrMalformedSignature
	}

	expectedMAC, err := hex.DecodeString(sigHex)
	if err != nil {
		return ErrMalformedSignature
	}

	mac := hmac.New(sha256.New, secret)
	mac.Write(body)
	computedMAC := mac.Sum(nil)

	if subtle.ConstantTimeCompare(expectedMAC, computedMAC) != 1 {
		return ErrInvalidSignature
	}

	return nil
}
