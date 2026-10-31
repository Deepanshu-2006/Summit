package source

import (
	"fmt"
	"strings"
)

// VerifyCommitSHA verifies that the checked out git revision exactly matches the expected commit SHA.
// It performs case-insensitive comparison to handle hex variations.
func VerifyCommitSHA(actualSHA, expectedSHA string) error {
	actual := strings.ToLower(strings.TrimSpace(actualSHA))
	expected := strings.ToLower(strings.TrimSpace(expectedSHA))

	if actual == "" {
		return fmt.Errorf("actual checked-out commit SHA is empty")
	}
	if expected == "" {
		return fmt.Errorf("expected commit SHA is empty")
	}

	if actual != expected {
		return fmt.Errorf("commit SHA mismatch: repository checked out at %s, but spec demanded exact pinned commit %s", actual, expected)
	}

	return nil
}
