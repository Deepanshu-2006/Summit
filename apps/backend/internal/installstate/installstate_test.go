package installstate

import (
	"encoding/base64"
	"encoding/hex"
	"errors"
	"testing"
	"time"
)

func TestGenerate_EntropyAndFormat(t *testing.T) {
	raw, hash, err := Generate()
	if err != nil {
		t.Fatalf("unexpected error generating state: %v", err)
	}

	// 32 bytes encoded with raw base64url is exactly 43 characters
	if len(raw) != 43 {
		t.Fatalf("expected raw state length 43, got %d (raw: %q)", len(raw), raw)
	}

	// Must be valid unpadded URL-safe base64
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		t.Fatalf("failed to decode raw base64url: %v", err)
	}
	if len(decoded) != 32 {
		t.Fatalf("expected 32 decoded bytes, got %d", len(decoded))
	}

	// Hash must be 64-character hex string (SHA-256)
	if len(hash) != 64 {
		t.Fatalf("expected 64 hex characters for hash, got %d (%s)", len(hash), hash)
	}
	if _, err := hex.DecodeString(hash); err != nil {
		t.Fatalf("expected valid hex string for hash: %v", err)
	}

	// Hash must match Hash(raw)
	if hash != Hash(raw) {
		t.Fatalf("hash mismatch: got %s, expected %s", hash, Hash(raw))
	}
}

func TestGenerate_Uniqueness(t *testing.T) {
	const iterations = 5000
	seenRaw := make(map[string]struct{}, iterations)
	seenHash := make(map[string]struct{}, iterations)

	for i := 0; i < iterations; i++ {
		raw, hash, err := Generate()
		if err != nil {
			t.Fatalf("iteration %d: failed to generate: %v", i, err)
		}

		if _, exists := seenRaw[raw]; exists {
			t.Fatalf("collision detected in raw state at iteration %d", i)
		}
		seenRaw[raw] = struct{}{}

		if _, exists := seenHash[hash]; exists {
			t.Fatalf("collision detected in hash at iteration %d", i)
		}
		seenHash[hash] = struct{}{}
	}
}

func TestHash_StabilityAndFormat(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		},
		{
			name:     "sample state",
			input:    "dGVzdC1zdGF0ZS12YWx1ZS0xMjM0NQ",
			expected: "105fbf30c6d945f846aa03e733bc3b79392d14fe1e5c826a9b7fbfe2e5303af0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Hash(tt.input)
			if got != tt.expected {
				t.Errorf("Hash(%q) = %q, want %q", tt.input, got, tt.expected)
			}
			if len(got) != 64 {
				t.Errorf("expected 64 characters, got %d", len(got))
			}
		})
	}
}

func TestValidate_ExpiryBoundary(t *testing.T) {
	baseTime := time.Date(2026, 10, 31, 12, 0, 0, 0, time.UTC)
	expiresAt := baseTime.Add(10 * time.Minute)

	tests := []struct {
		name        string
		expiresAt   time.Time
		consumedAt  *time.Time
		now         time.Time
		expectedErr error
	}{
		{
			name:        "active before expiration",
			expiresAt:   expiresAt,
			consumedAt:  nil,
			now:         expiresAt.Add(-1 * time.Second),
			expectedErr: nil,
		},
		{
			name:        "active 1 nanosecond before expiration",
			expiresAt:   expiresAt,
			consumedAt:  nil,
			now:         expiresAt.Add(-1 * time.Nanosecond),
			expectedErr: nil,
		},
		{
			name:        "expired exactly at expiration boundary",
			expiresAt:   expiresAt,
			consumedAt:  nil,
			now:         expiresAt,
			expectedErr: ErrExpired,
		},
		{
			name:        "expired 1 nanosecond after expiration",
			expiresAt:   expiresAt,
			consumedAt:  nil,
			now:         expiresAt.Add(1 * time.Nanosecond),
			expectedErr: ErrExpired,
		},
		{
			name:        "expired far after expiration",
			expiresAt:   expiresAt,
			consumedAt:  nil,
			now:         expiresAt.Add(1 * time.Hour),
			expectedErr: ErrExpired,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := Validate(tt.expiresAt, tt.consumedAt, tt.now)
			if !errors.Is(err, tt.expectedErr) {
				t.Errorf("Validate() err = %v, want %v", err, tt.expectedErr)
			}
		})
	}
}

func TestValidate_Consumed(t *testing.T) {
	baseTime := time.Date(2026, 10, 31, 12, 0, 0, 0, time.UTC)
	expiresAt := baseTime.Add(10 * time.Minute)
	consumedTime := baseTime.Add(2 * time.Minute)

	t.Run("consumed before expiration", func(t *testing.T) {
		err := Validate(expiresAt, &consumedTime, baseTime.Add(3*time.Minute))
		if !errors.Is(err, ErrConsumed) {
			t.Errorf("Validate() err = %v, want %v", err, ErrConsumed)
		}
	})

	t.Run("consumed and also expired", func(t *testing.T) {
		err := Validate(expiresAt, &consumedTime, baseTime.Add(15*time.Minute))
		if !errors.Is(err, ErrConsumed) {
			t.Errorf("Validate() err = %v, want %v", err, ErrConsumed)
		}
	})
}

func TestValidate_InvalidInputs(t *testing.T) {
	validTime := time.Date(2026, 10, 31, 12, 0, 0, 0, time.UTC)

	t.Run("zero expiresAt", func(t *testing.T) {
		err := Validate(time.Time{}, nil, validTime)
		if !errors.Is(err, ErrInvalid) {
			t.Errorf("Validate() err = %v, want %v", err, ErrInvalid)
		}
	})

	t.Run("zero now", func(t *testing.T) {
		err := Validate(validTime.Add(10*time.Minute), nil, time.Time{})
		if !errors.Is(err, ErrInvalid) {
			t.Errorf("Validate() err = %v, want %v", err, ErrInvalid)
		}
	})
}

func TestGenerateState_TTLDefaultAndCustom(t *testing.T) {
	baseTime := time.Date(2026, 10, 31, 12, 0, 0, 0, time.UTC)

	t.Run("uses DefaultTTL when ttl <= 0", func(t *testing.T) {
		state, err := GenerateState(baseTime, 0)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		expectedExpiry := baseTime.Add(DefaultTTL)
		if !state.ExpiresAt.Equal(expectedExpiry) {
			t.Errorf("ExpiresAt = %v, want %v", state.ExpiresAt, expectedExpiry)
		}
		if DefaultTTL != 10*time.Minute {
			t.Errorf("DefaultTTL = %v, want 10m", DefaultTTL)
		}
		if len(state.Raw) != 43 {
			t.Errorf("Raw len = %d, want 43", len(state.Raw))
		}
		if state.Hash != Hash(state.Raw) {
			t.Errorf("Hash does not match Hash(Raw)")
		}
	})

	t.Run("uses custom TTL", func(t *testing.T) {
		customTTL := 5 * time.Minute
		state, err := GenerateState(baseTime, customTTL)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		expectedExpiry := baseTime.Add(customTTL)
		if !state.ExpiresAt.Equal(expectedExpiry) {
			t.Errorf("ExpiresAt = %v, want %v", state.ExpiresAt, expectedExpiry)
		}

		// State.Validate helper method
		if err := state.Validate(nil, baseTime.Add(1*time.Minute)); err != nil {
			t.Errorf("state.Validate failed: %v", err)
		}
	})
}

func TestNewRecord(t *testing.T) {
	raw := "mock-raw-state-token-1234567890"
	expiry := time.Date(2026, 10, 31, 13, 0, 0, 0, time.UTC)

	rec := NewRecord(raw, expiry)
	if rec.Raw != raw {
		t.Errorf("Raw = %q, want %q", rec.Raw, raw)
	}
	if rec.Hash != Hash(raw) {
		t.Errorf("Hash = %q, want %q", rec.Hash, Hash(raw))
	}
	if !rec.ExpiresAt.Equal(expiry) {
		t.Errorf("ExpiresAt = %v, want %v", rec.ExpiresAt, expiry)
	}
}

func TestEqualHash(t *testing.T) {
	hashA := Hash("state-a")
	hashB := Hash("state-b")
	hashACopy := Hash("state-a")

	if !EqualHash(hashA, hashACopy) {
		t.Errorf("EqualHash should return true for identical hashes")
	}
	if EqualHash(hashA, hashB) {
		t.Errorf("EqualHash should return false for different hashes")
	}
	if EqualHash(hashA, "") {
		t.Errorf("EqualHash should return false for different lengths")
	}
	if EqualHash("", "") {
		if !EqualHash("", "") {
			t.Errorf("EqualHash should return true for empty strings")
		}
	}
}
