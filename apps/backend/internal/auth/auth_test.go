package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestSupabaseVerifier_RS256(t *testing.T) {
	// Generate RSA key
	rsaPriv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generating RSA key: %v", err)
	}
	rsaPub := &rsaPriv.PublicKey

	kid := "test-rsa-kid"
	nStr := base64.RawURLEncoding.EncodeToString(rsaPub.N.Bytes())
	eBytes := []byte{byte(rsaPub.E >> 16), byte(rsaPub.E >> 8), byte(rsaPub.E)}
	if rsaPub.E == 65537 {
		eBytes = []byte{1, 0, 1}
	}
	eStr := base64.RawURLEncoding.EncodeToString(eBytes)

	jwksSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(jwksResponse{
			Keys: []jwkKey{
				{
					Kty: "RSA",
					Kid: kid,
					Alg: "RS256",
					Use: "sig",
					N:   nStr,
					E:   eStr,
				},
			},
		})
	}))
	defer jwksSrv.Close()

	verifier := NewSupabaseVerifier(VerifierConfig{
		JWKSURL:  jwksSrv.URL,
		Issuer:   "https://test.supabase.co/auth/v1",
		Audience: "authenticated",
	})

	userID := uuid.New()

	// 1. Valid token
	claims := jwt.MapClaims{
		"sub":   userID.String(),
		"iss":   "https://test.supabase.co/auth/v1",
		"aud":   "authenticated",
		"exp":   time.Now().Add(time.Hour).Unix(),
		"nbf":   time.Now().Add(-time.Minute).Unix(),
		"email": "user@example.com",
		"user_metadata": map[string]any{
			"name": "Test User",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = kid
	tokenStr, err := token.SignedString(rsaPriv)
	if err != nil {
		t.Fatalf("signing token: %v", err)
	}

	principal, err := verifier.Verify(context.Background(), tokenStr)
	if err != nil {
		t.Fatalf("expected successful verification, got: %v", err)
	}
	if principal.UserID != userID {
		t.Errorf("expected UserID %s, got %s", userID, principal.UserID)
	}
	if principal.Email != "user@example.com" {
		t.Errorf("expected email user@example.com, got %s", principal.Email)
	}
	if principal.Name != "Test User" {
		t.Errorf("expected name Test User, got %s", principal.Name)
	}

	// 2. Expired token
	expiredClaims := jwt.MapClaims{
		"sub": userID.String(),
		"iss": "https://test.supabase.co/auth/v1",
		"aud": "authenticated",
		"exp": time.Now().Add(-time.Hour).Unix(),
	}
	expiredToken := jwt.NewWithClaims(jwt.SigningMethodRS256, expiredClaims)
	expiredToken.Header["kid"] = kid
	expiredStr, _ := expiredToken.SignedString(rsaPriv)
	if _, err := verifier.Verify(context.Background(), expiredStr); err == nil {
		t.Error("expected error for expired token, got nil")
	}

	// 3. Wrong issuer
	wrongIssClaims := jwt.MapClaims{
		"sub": userID.String(),
		"iss": "https://wrong-issuer.com",
		"aud": "authenticated",
		"exp": time.Now().Add(time.Hour).Unix(),
	}
	wrongIssToken := jwt.NewWithClaims(jwt.SigningMethodRS256, wrongIssClaims)
	wrongIssToken.Header["kid"] = kid
	wrongIssStr, _ := wrongIssToken.SignedString(rsaPriv)
	if _, err := verifier.Verify(context.Background(), wrongIssStr); err == nil {
		t.Error("expected error for wrong issuer, got nil")
	}

	// 4. Wrong audience
	wrongAudClaims := jwt.MapClaims{
		"sub": userID.String(),
		"iss": "https://test.supabase.co/auth/v1",
		"aud": "wrong-audience",
		"exp": time.Now().Add(time.Hour).Unix(),
	}
	wrongAudToken := jwt.NewWithClaims(jwt.SigningMethodRS256, wrongAudClaims)
	wrongAudToken.Header["kid"] = kid
	wrongAudStr, _ := wrongAudToken.SignedString(rsaPriv)
	if _, err := verifier.Verify(context.Background(), wrongAudStr); err == nil {
		t.Error("expected error for wrong audience, got nil")
	}
}

func TestSupabaseVerifier_ES256(t *testing.T) {
	ecPriv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generating EC key: %v", err)
	}
	ecPub := &ecPriv.PublicKey

	kid := "test-ec-kid"
	xStr := base64.RawURLEncoding.EncodeToString(ecPub.X.Bytes())
	yStr := base64.RawURLEncoding.EncodeToString(ecPub.Y.Bytes())

	jwksSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(jwksResponse{
			Keys: []jwkKey{
				{
					Kty: "EC",
					Kid: kid,
					Alg: "ES256",
					Crv: "P-256",
					Use: "sig",
					X:   xStr,
					Y:   yStr,
				},
			},
		})
	}))
	defer jwksSrv.Close()

	verifier := NewSupabaseVerifier(VerifierConfig{
		JWKSURL: jwksSrv.URL,
	})

	userID := uuid.New()
	claims := jwt.MapClaims{
		"sub":   userID.String(),
		"exp":   time.Now().Add(time.Hour).Unix(),
		"email": "ec@example.com",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodES256, claims)
	token.Header["kid"] = kid
	tokenStr, err := token.SignedString(ecPriv)
	if err != nil {
		t.Fatalf("signing token: %v", err)
	}

	principal, err := verifier.Verify(context.Background(), tokenStr)
	if err != nil {
		t.Fatalf("expected successful EC verification, got: %v", err)
	}
	if principal.UserID != userID {
		t.Errorf("expected UserID %s, got %s", userID, principal.UserID)
	}
}

func TestSupabaseVerifier_HS256(t *testing.T) {
	secret := "my-secret-key-that-is-at-least-32-bytes-long"
	userID := uuid.New()

	// 1. When secret IS configured
	verifierWithSecret := NewSupabaseVerifier(VerifierConfig{
		HS256Secret: secret,
	})

	claims := jwt.MapClaims{
		"sub":   userID.String(),
		"exp":   time.Now().Add(time.Hour).Unix(),
		"email": "hs@example.com",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("signing HS256: %v", err)
	}

	principal, err := verifierWithSecret.Verify(context.Background(), tokenStr)
	if err != nil {
		t.Fatalf("expected successful HS256 verification: %v", err)
	}
	if principal.UserID != userID {
		t.Errorf("expected UserID %s, got %s", userID, principal.UserID)
	}

	// 2. When secret is NOT configured, HS256 must be rejected
	verifierNoSecret := NewSupabaseVerifier(VerifierConfig{})
	_, err = verifierNoSecret.Verify(context.Background(), tokenStr)
	if err == nil {
		t.Error("expected error when verifying HS256 without configured secret, got nil")
	}
}

type mockDBExecutor struct {
	lastQuery string
	lastArgs  []any
}

func (m *mockDBExecutor) Exec(_ context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	m.lastQuery = sql
	m.lastArgs = args
	return pgconn.NewCommandTag("INSERT 0 1"), nil
}

func TestRequireUser_Middleware(t *testing.T) {
	secret := "secret-for-middleware-tests-which-is-long"
	verifier := NewSupabaseVerifier(VerifierConfig{
		HS256Secret: secret,
	})
	mockDB := &mockDBExecutor{}

	handlerCalled := false
	var capturedPrincipal Principal
	handler := RequireUser(verifier, mockDB)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		p, ok := GetPrincipal(r.Context())
		if !ok {
			t.Error("expected principal in context")
		}
		capturedPrincipal = p
		w.WriteHeader(http.StatusOK)
	}))

	userID := uuid.New()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   userID.String(),
		"exp":   time.Now().Add(time.Hour).Unix(),
		"email": "middleware@example.com",
		"name":  "Middleware User",
	})
	validTokenStr, _ := token.SignedString([]byte(secret))

	// Case 1: Missing auth header
	req1 := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for missing header, got %d", rec1.Code)
	}

	// Case 2: Invalid bearer format
	req2 := httptest.NewRequest(http.MethodGet, "/test", nil)
	req2.Header.Set("Authorization", "Basic 12345")
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for invalid header format, got %d", rec2.Code)
	}

	// Case 3: Invalid token
	req3 := httptest.NewRequest(http.MethodGet, "/test", nil)
	req3.Header.Set("Authorization", "Bearer invalid.token.value")
	rec3 := httptest.NewRecorder()
	handler.ServeHTTP(rec3, req3)
	if rec3.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for invalid token, got %d", rec3.Code)
	}

	// Case 4: Valid token
	req4 := httptest.NewRequest(http.MethodGet, "/test", nil)
	req4.Header.Set("Authorization", "Bearer "+validTokenStr)
	rec4 := httptest.NewRecorder()
	handler.ServeHTTP(rec4, req4)
	if rec4.Code != http.StatusOK {
		t.Errorf("expected 200 for valid token, got %d", rec4.Code)
	}
	if !handlerCalled {
		t.Error("expected inner handler to be called")
	}
	if capturedPrincipal.UserID != userID {
		t.Errorf("expected captured user ID %s, got %s", userID, capturedPrincipal.UserID)
	}
	if mockDB.lastQuery == "" {
		t.Error("expected UpsertUser to have executed on mockDB")
	}
}
