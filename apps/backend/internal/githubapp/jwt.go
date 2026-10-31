package githubapp

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strconv"
	"sync"
	"time"
)

// jwtCache holds a cached JWT and its expiration time.
type jwtCache struct {
	mu     sync.Mutex
	token  string
	expiry time.Time
}

// jwtHeader is the fixed RS256 JWT header.
var jwtHeaderEncoded string

func init() {
	h, _ := json.Marshal(map[string]string{
		"alg": "RS256",
		"typ": "JWT",
	})
	jwtHeaderEncoded = base64URLEncode(h)
}

// base64URLEncode encodes data using base64url without padding, per RFC 7515.
func base64URLEncode(data []byte) string {
	return base64.RawURLEncoding.EncodeToString(data)
}

// generateJWT creates an RS256-signed JWT for the GitHub App.
// iss = AppID (as string), iat = now - 60s (clock skew), exp = now + 9m.
func generateJWT(key *rsa.PrivateKey, appID int64, now time.Time) (string, error) {
	iat := now.Add(-60 * time.Second)
	exp := now.Add(9 * time.Minute)

	claims := map[string]interface{}{
		"iss": strconv.FormatInt(appID, 10),
		"iat": iat.Unix(),
		"exp": exp.Unix(),
	}
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("githubapp: marshal jwt claims: %w", err)
	}

	payload := jwtHeaderEncoded + "." + base64URLEncode(claimsJSON)

	hash := sha256.Sum256([]byte(payload))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hash[:])
	if err != nil {
		return "", fmt.Errorf("githubapp: sign jwt: %w", err)
	}

	return payload + "." + base64URLEncode(sig), nil
}

// GenerateAppJWT returns a cached or freshly generated RS256 JWT for the
// GitHub App. The JWT is cached until 1 minute before its expiration.
// Concurrent callers share the same cached token via a mutex.
func (c *Client) GenerateAppJWT() (string, error) {
	now := c.clock()

	c.jwt.mu.Lock()
	defer c.jwt.mu.Unlock()

	// Return cached token if it's still valid (with 1-minute safety margin).
	if c.jwt.token != "" && now.Before(c.jwt.expiry.Add(-1*time.Minute)) {
		return c.jwt.token, nil
	}

	token, err := generateJWT(c.privateKey, c.cfg.AppID, now)
	if err != nil {
		return "", err
	}

	// Cache with expiry = now + 9min (the JWT exp).
	c.jwt.token = token
	c.jwt.expiry = now.Add(9 * time.Minute)

	return token, nil
}
