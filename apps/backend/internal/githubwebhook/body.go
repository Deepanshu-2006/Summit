package githubwebhook

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
)

// ReadBody reads up to maxBytes from the HTTP request body.
// If maxBytes is <= 0, MaxBodyBytesDefault is used.
// If the body exceeds maxBytes (either signaled by ContentLength or by actual stream length),
// it returns ErrBodyTooLarge and nil bytes to prevent partial trust of oversized payloads.
func ReadBody(r *http.Request, maxBytes int64) ([]byte, error) {
	if r == nil || r.Body == nil {
		return nil, ErrNilRequestBody
	}

	if maxBytes <= 0 {
		maxBytes = MaxBodyBytesDefault
	}

	if r.ContentLength > maxBytes {
		return nil, ErrBodyTooLarge
	}

	// Read up to maxBytes + 1 so we can detect if stream exceeds maxBytes.
	lr := io.LimitReader(r.Body, maxBytes+1)
	body, err := io.ReadAll(lr)
	if err != nil {
		return nil, err
	}

	if int64(len(body)) > maxBytes {
		return nil, ErrBodyTooLarge
	}

	return body, nil
}

// PayloadSHA256 returns the hex-encoded SHA256 checksum of the body.
func PayloadSHA256(body []byte) string {
	h := sha256.Sum256(body)
	return hex.EncodeToString(h[:])
}
