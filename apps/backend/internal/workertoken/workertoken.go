// Package workertoken mints and verifies job-scoped HS256 JWTs that ephemeral
// builder pods present to the control plane (source-token broker and build
// callback receivers). Tokens are always bound to exactly one build job ID.
//
// The orchestrator mints a token per build attempt using WORKER_JWT_SECRET and
// projects it into the build pod via a short-lived Kubernetes Secret; the API
// verifies it on every internal builder request.
package workertoken

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Audience is the fixed JWT audience for builder worker tokens.
const Audience = "summit-builder"

// MinSecretLength is the minimum accepted HMAC secret length in bytes.
const MinSecretLength = 32

var (
	// ErrInvalidToken is returned for any token that fails verification.
	ErrInvalidToken = errors.New("workertoken: invalid worker token")
	// ErrWeakSecret is returned when the signing secret is too short.
	ErrWeakSecret = errors.New("workertoken: secret must be at least 32 bytes")
)

// Claims are the registered and custom claims carried by a worker token.
type Claims struct {
	JobID string `json:"job_id"`
	jwt.RegisteredClaims
}

// Mint creates a token scoped to buildJobID that expires after ttl.
func Mint(secret []byte, buildJobID uuid.UUID, ttl time.Duration) (string, error) {
	if len(secret) < MinSecretLength {
		return "", ErrWeakSecret
	}
	if buildJobID == uuid.Nil {
		return "", fmt.Errorf("workertoken: build job id must not be nil")
	}
	if ttl <= 0 {
		return "", fmt.Errorf("workertoken: ttl must be positive")
	}
	now := time.Now()
	claims := Claims{
		JobID: buildJobID.String(),
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   buildJobID.String(),
			Audience:  jwt.ClaimStrings{Audience},
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now.Add(-30 * time.Second)),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			ID:        uuid.NewString(),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}

// Verify checks signature, expiry, audience, and that both the subject and
// job_id claims equal buildJobID. Unscoped tokens are rejected.
func Verify(token string, secret []byte, buildJobID uuid.UUID) error {
	if token == "" || len(secret) == 0 || buildJobID == uuid.Nil {
		return ErrInvalidToken
	}
	var claims Claims
	parsed, err := jwt.ParseWithClaims(token, &claims, func(t *jwt.Token) (any, error) {
		return secret, nil
	},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithExpirationRequired(),
		jwt.WithAudience(Audience),
		jwt.WithLeeway(30*time.Second),
	)
	if err != nil || !parsed.Valid {
		return ErrInvalidToken
	}
	want := buildJobID.String()
	if claims.Subject != want || claims.JobID != want {
		return ErrInvalidToken
	}
	return nil
}
