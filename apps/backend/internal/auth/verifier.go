package auth

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// SupabaseVerifier validates JWT tokens from Supabase Auth using JWKS or HS256 secret.
type SupabaseVerifier struct {
	jwksURL     string
	issuer      string
	audience    string
	hs256Secret []byte
	httpClient  *http.Client

	mu          sync.RWMutex
	keys        map[string]crypto.PublicKey
	lastFetched time.Time
	cacheTTL    time.Duration
}

// VerifierConfig configures the SupabaseVerifier.
type VerifierConfig struct {
	JWKSURL     string
	Issuer      string
	Audience    string
	HS256Secret string // Optional; for local testing only
	HTTPClient  *http.Client
	CacheTTL    time.Duration
}

// NewSupabaseVerifier creates a new SupabaseVerifier.
func NewSupabaseVerifier(cfg VerifierConfig) *SupabaseVerifier {
	client := cfg.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	ttl := cfg.CacheTTL
	if ttl <= 0 {
		ttl = 15 * time.Minute
	}

	var hsSecret []byte
	if cfg.HS256Secret != "" {
		hsSecret = []byte(cfg.HS256Secret)
	}

	return &SupabaseVerifier{
		jwksURL:     cfg.JWKSURL,
		issuer:      cfg.Issuer,
		audience:    cfg.Audience,
		hs256Secret: hsSecret,
		httpClient:  client,
		keys:        make(map[string]crypto.PublicKey),
		cacheTTL:    ttl,
	}
}

type jwksResponse struct {
	Keys []jwkKey `json:"keys"`
}

type jwkKey struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Use string `json:"use"`
	Alg string `json:"alg"`
	N   string `json:"n"`
	E   string `json:"e"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

// Verify validates the token string and returns the Principal.
func (v *SupabaseVerifier) Verify(ctx context.Context, tokenStr string) (Principal, error) {
	if tokenStr == "" {
		return Principal{}, errors.New("empty token")
	}

	parserOptions := []jwt.ParserOption{
		jwt.WithExpirationRequired(),
	}
	if v.issuer != "" {
		parserOptions = append(parserOptions, jwt.WithIssuer(v.issuer))
	}
	if v.audience != "" {
		parserOptions = append(parserOptions, jwt.WithAudience(v.audience))
	}

	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		alg := t.Method.Alg()
		switch alg {
		case "HS256":
			if len(v.hs256Secret) == 0 {
				return nil, errors.New("HS256 tokens not accepted when SUPABASE_JWT_SECRET is not configured")
			}
			return v.hs256Secret, nil

		case "RS256", "ES256":
			kid, _ := t.Header["kid"].(string)
			return v.getKey(ctx, kid)

		default:
			return nil, fmt.Errorf("unsupported signing algorithm: %s", alg)
		}
	}, parserOptions...)

	if err != nil {
		return Principal{}, fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return Principal{}, errors.New("invalid token claims")
	}

	// Validate subject claim as valid UUID
	sub, err := claims.GetSubject()
	if err != nil || sub == "" {
		return Principal{}, errors.New("missing subject claim in token")
	}
	userID, err := uuid.Parse(sub)
	if err != nil {
		return Principal{}, fmt.Errorf("invalid subject UUID in token: %w", err)
	}

	// Extract email
	email, _ := claims["email"].(string)

	// Extract name
	name, _ := claims["name"].(string)
	if name == "" {
		if meta, ok := claims["user_metadata"].(map[string]any); ok {
			if n, ok := meta["name"].(string); ok && n != "" {
				name = n
			} else if n, ok := meta["full_name"].(string); ok && n != "" {
				name = n
			}
		}
	}

	return Principal{
		UserID:   userID,
		Email:    email,
		Name:     name,
		Claims:   claims,
		RawToken: tokenStr,
	}, nil
}

func (v *SupabaseVerifier) getKey(ctx context.Context, kid string) (crypto.PublicKey, error) {
	v.mu.RLock()
	key, ok := v.keys[kid]
	fresh := time.Since(v.lastFetched) < v.cacheTTL
	v.mu.RUnlock()

	if ok && fresh {
		return key, nil
	}

	// Fetch or refresh JWKS
	if err := v.refreshJWKS(ctx); err != nil {
		// If refresh failed but we have a cached key, return it
		if ok {
			return key, nil
		}
		return nil, fmt.Errorf("fetching JWKS: %w", err)
	}

	v.mu.RLock()
	defer v.mu.RUnlock()
	key, ok = v.keys[kid]
	if !ok {
		// If kid is empty and there's only 1 key, use it
		if kid == "" && len(v.keys) == 1 {
			for _, k := range v.keys {
				return k, nil
			}
		}
		return nil, fmt.Errorf("key with kid %q not found in JWKS", kid)
	}
	return key, nil
}

func (v *SupabaseVerifier) refreshJWKS(ctx context.Context) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if v.jwksURL == "" {
		return errors.New("JWKS URL not configured")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksURL, nil)
	if err != nil {
		return err
	}

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status %d from JWKS endpoint", resp.StatusCode)
	}

	var jwks jwksResponse
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return fmt.Errorf("decoding JWKS response: %w", err)
	}

	newKeys := make(map[string]crypto.PublicKey)
	for _, k := range jwks.Keys {
		pubKey, err := parseJWKKey(k)
		if err != nil {
			continue
		}
		newKeys[k.Kid] = pubKey
	}

	if len(newKeys) == 0 {
		return errors.New("no valid public keys found in JWKS")
	}

	v.keys = newKeys
	v.lastFetched = time.Now()
	return nil
}

func parseJWKKey(k jwkKey) (crypto.PublicKey, error) {
	switch k.Kty {
	case "RSA":
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil {
			return nil, fmt.Errorf("decoding RSA modulus: %w", err)
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil {
			return nil, fmt.Errorf("decoding RSA exponent: %w", err)
		}
		eInt := 0
		for _, b := range eBytes {
			eInt = (eInt << 8) | int(b)
		}
		return &rsa.PublicKey{
			N: new(big.Int).SetBytes(nBytes),
			E: eInt,
		}, nil

	case "EC":
		xBytes, err := base64.RawURLEncoding.DecodeString(k.X)
		if err != nil {
			return nil, fmt.Errorf("decoding EC X coordinate: %w", err)
		}
		yBytes, err := base64.RawURLEncoding.DecodeString(k.Y)
		if err != nil {
			return nil, fmt.Errorf("decoding EC Y coordinate: %w", err)
		}
		var curve elliptic.Curve
		switch k.Crv {
		case "P-256":
			curve = elliptic.P256()
		case "P-384":
			curve = elliptic.P384()
		case "P-521":
			curve = elliptic.P521()
		default:
			return nil, fmt.Errorf("unsupported EC curve: %s", k.Crv)
		}
		return &ecdsa.PublicKey{
			Curve: curve,
			X:     new(big.Int).SetBytes(xBytes),
			Y:     new(big.Int).SetBytes(yBytes),
		}, nil

	default:
		return nil, fmt.Errorf("unsupported key type: %s", k.Kty)
	}
}
