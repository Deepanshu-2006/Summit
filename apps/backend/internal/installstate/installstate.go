package installstate

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"
)

// DefaultTTL is the recommended lifetime of an installation state (10 minutes).
const DefaultTTL = 10 * time.Minute

var (
	// ErrExpired indicates the installation state has passed its expiration time.
	ErrExpired = errors.New("installation state has expired")

	// ErrConsumed indicates the installation state has already been consumed and cannot be reused.
	ErrConsumed = errors.New("installation state has already been consumed")

	// ErrInvalid indicates the state or timestamp parameters are malformed or invalid.
	ErrInvalid = errors.New("installation state is invalid")
)

// State represents an opaque installation state used to secure the GitHub App installation flow.
//
// Security note:
// The Raw value is the unguessable secret sent to GitHub in the installation URL.
// The Raw value MUST NEVER be persisted in the database.
// Only Hash (SHA-256 hex digest) should be stored in github_installation_states.
type State struct {
	Raw       string
	Hash      string
	ExpiresAt time.Time
}

// Generate creates a cryptographically secure 32-byte random state value encoded
// using unpadded URL-safe base64, along with its SHA-256 hexadecimal hash.
//
// Never store the raw value in persistent storage.
func Generate() (raw string, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", fmt.Errorf("failed to read random bytes: %w", err)
	}

	raw = base64.RawURLEncoding.EncodeToString(b)
	hash = Hash(raw)
	return raw, hash, nil
}

// Hash returns the lower-case hexadecimal SHA-256 digest of the given raw state string.
func Hash(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

// Validate checks whether an installation state is valid, not expired, and not consumed.
// It returns:
//   - ErrInvalid if expiresAt or now is zero.
//   - ErrConsumed if consumedAt is non-nil (the state was already used).
//   - ErrExpired if now is at or after expiresAt.
//   - nil if the state is active and valid.
func Validate(expiresAt time.Time, consumedAt *time.Time, now time.Time) error {
	if expiresAt.IsZero() || now.IsZero() {
		return ErrInvalid
	}
	if consumedAt != nil {
		return ErrConsumed
	}
	if !now.Before(expiresAt) {
		return ErrExpired
	}
	return nil
}

// NewRecord creates a pure State struct from an existing raw string and expiration time.
// The Hash field is derived automatically via Hash(raw).
func NewRecord(raw string, expiresAt time.Time) State {
	return State{
		Raw:       raw,
		Hash:      Hash(raw),
		ExpiresAt: expiresAt,
	}
}

// GenerateState generates a new cryptographically random State record.
// If ttl <= 0, DefaultTTL (10 minutes) is used.
// If now is zero, time.Now() is used as the base timestamp.
func GenerateState(now time.Time, ttl time.Duration) (State, error) {
	if ttl <= 0 {
		ttl = DefaultTTL
	}
	if now.IsZero() {
		now = time.Now()
	}

	raw, hash, err := Generate()
	if err != nil {
		return State{}, err
	}

	return State{
		Raw:       raw,
		Hash:      hash,
		ExpiresAt: now.Add(ttl),
	}, nil
}

// Validate checks the state against consumedAt and now.
func (s State) Validate(consumedAt *time.Time, now time.Time) error {
	return Validate(s.ExpiresAt, consumedAt, now)
}

// EqualHash performs a constant-time comparison of two hash strings.
// This prevents timing side-channel attacks during callback validation.
func EqualHash(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
