package testutil

import (
	"os"
	"testing"
)

func TestNewDB_SkippedWhenUnset(t *testing.T) {
	orig := os.Getenv("TEST_DATABASE_URL")
	os.Unsetenv("TEST_DATABASE_URL")
	defer func() {
		if orig != "" {
			os.Setenv("TEST_DATABASE_URL", orig)
		}
	}()

	pool := NewDB(t)
	if pool != nil {
		t.Error("expected nil pool when skipped")
	}
}
