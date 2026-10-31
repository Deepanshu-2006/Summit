package workertoken

import (
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var testSecret = []byte(strings.Repeat("s", 32))

func TestMintVerifyRoundTrip(t *testing.T) {
	job := uuid.New()
	tok, err := Mint(testSecret, job, time.Minute)
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	if err := Verify(tok, testSecret, job); err != nil {
		t.Fatalf("verify: %v", err)
	}
}

func TestVerifyRejects(t *testing.T) {
	job := uuid.New()
	tok, _ := Mint(testSecret, job, time.Minute)
	expired, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, Claims{
		JobID: job.String(),
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   job.String(),
			Audience:  jwt.ClaimStrings{Audience},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Hour)),
		},
	}).SignedString(testSecret)

	unscoped, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Audience:  jwt.ClaimStrings{Audience},
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
	}).SignedString(testSecret)

	cases := map[string]struct {
		token  string
		secret []byte
		job    uuid.UUID
	}{
		"other job":    {tok, testSecret, uuid.New()},
		"wrong secret": {tok, []byte(strings.Repeat("x", 32)), job},
		"unscoped":     {unscoped, testSecret, job},
		"raw secret":   {string(testSecret), testSecret, job},
		"empty":        {"", testSecret, job},
		"nil job":      {tok, testSecret, uuid.Nil},
		"expired":      {expired, testSecret, job},
	}
	for name, tc := range cases {
		if err := Verify(tc.token, tc.secret, tc.job); err == nil {
			t.Errorf("%s: expected rejection", name)
		}
	}
}

func TestMintValidation(t *testing.T) {
	if _, err := Mint([]byte("short"), uuid.New(), time.Minute); err == nil {
		t.Fatal("expected weak secret error")
	}
	if _, err := Mint(testSecret, uuid.Nil, time.Minute); err == nil {
		t.Fatal("expected nil job error")
	}
	if _, err := Mint(testSecret, uuid.New(), 0); err == nil {
		t.Fatal("expected ttl error")
	}
}
