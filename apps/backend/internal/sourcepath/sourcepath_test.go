package sourcepath

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"testing"
)

func TestNormalizeRootDirectory(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expected    string
		expectError bool
		errorTarget error
	}{
		// Valid cases
		{name: "empty string defaults to dot", input: "", expected: "."},
		{name: "whitespace defaults to dot", input: "   \t  ", expected: "."},
		{name: "single dot", input: ".", expected: "."},
		{name: "dot slash", input: "./", expected: "."},
		{name: "dot slash dot", input: "./.", expected: "."},
		{name: "dot slash src", input: "./src", expected: "src"},
		{name: "src slash dot", input: "src/.", expected: "src"},
		{name: "src with trailing slash", input: "src/", expected: "src"},
		{name: "nested directories", input: "apps/backend/cmd", expected: "apps/backend/cmd"},
		{name: "leading and trailing whitespace", input: "   apps/backend   ", expected: "apps/backend"},
		{name: "multiple consecutive slashes", input: "apps///backend//cmd", expected: "apps/backend/cmd"},
		{name: "valid internal relative back-and-forth", input: "apps/web/../backend", expected: "apps/backend"},
		{name: "relative traversal resolving to root", input: "apps/backend/../..", expected: "."},
		{name: "windows backslashes converted", input: `apps\backend\cmd`, expected: "apps/backend/cmd"},
		{name: "windows dot slash backslashes", input: `.\apps\backend`, expected: "apps/backend"},
		{name: "exactly 1024 chars", input: strings.Repeat("a/", 511) + "aa", expected: strings.Repeat("a/", 511) + "aa"},

		// Traversal rejections
		{name: "parent dir ..", input: "..", expectError: true, errorTarget: ErrPathTraversal},
		{name: "parent dir ../", input: "../", expectError: true, errorTarget: ErrPathTraversal},
		{name: "parent dir ../x", input: "../x", expectError: true, errorTarget: ErrPathTraversal},
		{name: "deep traversal beyond root", input: "a/../../b", expectError: true, errorTarget: ErrPathTraversal},
		{name: "internal traversal to parent", input: "foo/bar/../../..", expectError: true, errorTarget: ErrPathTraversal},
		{name: "windows traversal backslashes", input: `..\foo`, expectError: true, errorTarget: ErrPathTraversal},

		// Absolute path rejections
		{name: "root slash", input: "/", expectError: true, errorTarget: ErrAbsolutePath},
		{name: "absolute path /etc/passwd", input: "/etc/passwd", expectError: true, errorTarget: ErrAbsolutePath},
		{name: "absolute path /src", input: "/src", expectError: true, errorTarget: ErrAbsolutePath},
		{name: "backslash absolute", input: `\apps\backend`, expectError: true, errorTarget: ErrAbsolutePath},

		// Windows drive letter rejections
		{name: "drive letter C:", input: "C:", expectError: true, errorTarget: ErrDriveLetter},
		{name: "drive letter c:/", input: "c:/app", expectError: true, errorTarget: ErrDriveLetter},
		{name: "drive letter with backslash", input: `D:\apps\backend`, expectError: true, errorTarget: ErrDriveLetter},
		{name: "drive letter without slash", input: "Z:data", expectError: true, errorTarget: ErrDriveLetter},

		// UNC path rejections
		{name: "UNC backslash path", input: `\\server\share`, expectError: true, errorTarget: ErrUNCPath},
		{name: "UNC forward slash path", input: "//server/share", expectError: true, errorTarget: ErrUNCPath},

		// Control character rejections
		{name: "NUL byte", input: "src\x00/app", expectError: true, errorTarget: ErrInvalidControlChar},
		{name: "newline in path", input: "src\n/app", expectError: true, errorTarget: ErrInvalidControlChar},
		{name: "carriage return in path", input: "src\r/app", expectError: true, errorTarget: ErrInvalidControlChar},
		{name: "tab in path", input: "src\t/app", expectError: true, errorTarget: ErrInvalidControlChar},
		{name: "DEL char (127)", input: "src\x7f/app", expectError: true, errorTarget: ErrInvalidControlChar},

		// Length exceeded
		{name: "path exceeds 1024 characters", input: strings.Repeat("a", 1025), expectError: true, errorTarget: ErrPathTooLong},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NormalizeRootDirectory(tt.input)
			if tt.expectError {
				if err == nil {
					t.Fatalf("NormalizeRootDirectory(%q) expected error, got result %q", tt.input, got)
				}
				if tt.errorTarget != nil && !errors.Is(err, tt.errorTarget) {
					t.Fatalf("NormalizeRootDirectory(%q) expected error %v, got %v", tt.input, tt.errorTarget, err)
				}
			} else {
				if err != nil {
					t.Fatalf("NormalizeRootDirectory(%q) unexpected error: %v", tt.input, err)
				}
				if got != tt.expected {
					t.Fatalf("NormalizeRootDirectory(%q) = %q, want %q", tt.input, got, tt.expected)
				}
			}
		})
	}
}

func TestValidateDockerfilePath(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expected    string
		expectError bool
		errorTarget error
	}{
		// Valid cases
		{name: "empty string returns empty", input: "", expected: ""},
		{name: "whitespace returns empty", input: "   ", expected: ""},
		{name: "standard Dockerfile", input: "Dockerfile", expected: "Dockerfile"},
		{name: "prefixed with ./", input: "./Dockerfile", expected: "Dockerfile"},
		{name: "nested Dockerfile", input: "docker/Dockerfile.prod", expected: "docker/Dockerfile.prod"},
		{name: "deep nested Dockerfile", input: "build/ci/Dockerfile", expected: "build/ci/Dockerfile"},
		{name: "windows backslashes converted", input: `docker\Dockerfile`, expected: "docker/Dockerfile"},
		{name: "windows prefixed with .\\", input: `.\docker\Dockerfile`, expected: "docker/Dockerfile"},
		{name: "internal clean path", input: "build/dummy/../Dockerfile", expected: "build/Dockerfile"},

		// Trailing slash rejections
		{name: "trailing slash rejected", input: "Dockerfile/", expectError: true, errorTarget: ErrTrailingSlash},
		{name: "trailing backslash rejected", input: `docker/Dockerfile\`, expectError: true, errorTarget: ErrTrailingSlash},
		{name: "directory path with slash rejected", input: "build/", expectError: true, errorTarget: ErrTrailingSlash},

		// Dot / Directory rejections
		{name: "single dot rejected", input: ".", expectError: true, errorTarget: ErrInvalidDockerfilePath},
		{name: "dot slash rejected", input: "./", expectError: true, errorTarget: ErrTrailingSlash},

		// Traversal rejections
		{name: "traversal ..", input: "../Dockerfile", expectError: true, errorTarget: ErrPathTraversal},
		{name: "deep traversal", input: "a/../../Dockerfile", expectError: true, errorTarget: ErrPathTraversal},

		// Absolute path rejections
		{name: "absolute path", input: "/Dockerfile", expectError: true, errorTarget: ErrAbsolutePath},
		{name: "absolute nested", input: "/etc/Dockerfile", expectError: true, errorTarget: ErrAbsolutePath},

		// Windows drive letter & UNC
		{name: "drive letter", input: "C:/Dockerfile", expectError: true, errorTarget: ErrDriveLetter},
		{name: "UNC path", input: `\\server\share\Dockerfile`, expectError: true, errorTarget: ErrUNCPath},

		// Control characters
		{name: "NUL byte", input: "Dockerfile\x00", expectError: true, errorTarget: ErrInvalidControlChar},

		// Length limit
		{name: "path exceeds 1024 characters", input: strings.Repeat("a", 1020) + "/Dockerfile", expectError: true, errorTarget: ErrPathTooLong},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ValidateDockerfilePath(tt.input)
			if tt.expectError {
				if err == nil {
					t.Fatalf("ValidateDockerfilePath(%q) expected error, got %q", tt.input, got)
				}
				if tt.errorTarget != nil && !errors.Is(err, tt.errorTarget) {
					t.Fatalf("ValidateDockerfilePath(%q) expected error %v, got %v", tt.input, tt.errorTarget, err)
				}
			} else {
				if err != nil {
					t.Fatalf("ValidateDockerfilePath(%q) unexpected error: %v", tt.input, err)
				}
				if got != tt.expected {
					t.Fatalf("ValidateDockerfilePath(%q) = %q, want %q", tt.input, got, tt.expected)
				}
			}
		})
	}
}

func TestValidateBranch(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectError bool
		errorTarget error
	}{
		// Valid branches
		{name: "main", input: "main"},
		{name: "master", input: "master"},
		{name: "feature with slash", input: "feature/login-form"},
		{name: "multi-level feature", input: "team/john/feature-1"},
		{name: "release branch", input: "release/v1.0.0"},
		{name: "branch with dots, hyphens, underscores", input: "bugfix-1.2_patch.3"},
		{name: "short branch", input: "v1"},
		{name: "branch with max 255 chars", input: strings.Repeat("a", 255)},

		// Empty and length
		{name: "empty branch", input: "", expectError: true, errorTarget: ErrEmptyBranch},
		{name: "branch exceeds 255 chars", input: strings.Repeat("a", 256), expectError: true, errorTarget: ErrBranchTooLong},

		// Full ref rejected
		{name: "refs/heads/main rejected", input: "refs/heads/main", expectError: true, errorTarget: ErrRefsNotAllowed},
		{name: "refs/pull/1/head rejected", input: "refs/pull/1/head", expectError: true, errorTarget: ErrRefsNotAllowed},
		{name: "bare refs rejected", input: "refs", expectError: true, errorTarget: ErrRefsNotAllowed},

		// Traversal and slashes
		{name: "double dot ..", input: "feat..branch", expectError: true, errorTarget: ErrInvalidBranch},
		{name: "leading slash", input: "/main", expectError: true, errorTarget: ErrInvalidBranch},
		{name: "trailing slash", input: "main/", expectError: true, errorTarget: ErrInvalidBranch},
		{name: "consecutive slashes", input: "feature//branch", expectError: true, errorTarget: ErrInvalidBranch},
		{name: "leading dot", input: ".main", expectError: true, errorTarget: ErrInvalidBranch},
		{name: "trailing dot", input: "main.", expectError: true, errorTarget: ErrInvalidBranch},

		// Sequences and suffixes
		{name: "sequence @{", input: "main@{1}", expectError: true, errorTarget: ErrInvalidBranch},
		{name: "suffix .lock", input: "main.lock", expectError: true, errorTarget: ErrInvalidBranch},
		{name: "suffix .lock in subpath", input: "feature/test.lock", expectError: true, errorTarget: ErrInvalidBranch},

		// Illegal characters (~^:?*[\) and whitespace/control
		{name: "tilde ~", input: "main~1", expectError: true, errorTarget: ErrInvalidBranchChar},
		{name: "caret ^", input: "main^2", expectError: true, errorTarget: ErrInvalidBranchChar},
		{name: "colon :", input: "main:test", expectError: true, errorTarget: ErrInvalidBranchChar},
		{name: "question mark ?", input: "main?test", expectError: true, errorTarget: ErrInvalidBranchChar},
		{name: "asterisk *", input: "main*test", expectError: true, errorTarget: ErrInvalidBranchChar},
		{name: "bracket [", input: "main[test", expectError: true, errorTarget: ErrInvalidBranchChar},
		{name: "backslash \\", input: `main\test`, expectError: true, errorTarget: ErrInvalidBranchChar},
		{name: "space", input: "main branch", expectError: true, errorTarget: ErrInvalidBranchChar},
		{name: "tab", input: "main\tbranch", expectError: true, errorTarget: ErrInvalidBranchChar},
		{name: "newline", input: "main\nbranch", expectError: true, errorTarget: ErrInvalidBranchChar},
		{name: "NUL byte", input: "main\x00branch", expectError: true, errorTarget: ErrInvalidBranchChar},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateBranch(tt.input)
			if tt.expectError {
				if err == nil {
					t.Fatalf("ValidateBranch(%q) expected error, got nil", tt.input)
				}
				if tt.errorTarget != nil && !errors.Is(err, tt.errorTarget) {
					t.Fatalf("ValidateBranch(%q) expected error %v, got %v", tt.input, tt.errorTarget, err)
				}
			} else {
				if err != nil {
					t.Fatalf("ValidateBranch(%q) unexpected error: %v", tt.input, err)
				}
			}
		})
	}
}

func TestValidateRepositoryFullName(t *testing.T) {
	tests := []struct {
		name          string
		input         string
		expectedOwner string
		expectedRepo  string
		expectError   bool
		errorTarget   error
	}{
		// Valid cases
		{name: "simple repo", input: "owner/repo", expectedOwner: "owner", expectedRepo: "repo"},
		{name: "hyphenated owner and repo", input: "summit-cloud/platform-backend", expectedOwner: "summit-cloud", expectedRepo: "platform-backend"},
		{name: "dots and underscores", input: "user_1/my.repo_v2", expectedOwner: "user_1", expectedRepo: "my.repo_v2"},
		{name: "single char owner and repo", input: "a/b", expectedOwner: "a", expectedRepo: "b"},
		{name: "max length owner (39) and repo (100)",
			input:         strings.Repeat("o", 39) + "/" + strings.Repeat("r", 100),
			expectedOwner: strings.Repeat("o", 39),
			expectedRepo:  strings.Repeat("r", 100),
		},

		// Slash counts
		{name: "missing slash", input: "single-name", expectError: true, errorTarget: ErrInvalidRepoFullName},
		{name: "multiple slashes", input: "owner/repo/extra", expectError: true, errorTarget: ErrInvalidRepoFullName},
		{name: "double slash", input: "owner//repo", expectError: true, errorTarget: ErrInvalidRepoFullName},
		{name: "leading slash", input: "/repo", expectError: true, errorTarget: ErrInvalidRepoFullName},
		{name: "trailing slash", input: "owner/", expectError: true, errorTarget: ErrInvalidRepoFullName},

		// Length limits
		{name: "owner exceeds 39 chars", input: strings.Repeat("o", 40) + "/repo", expectError: true, errorTarget: ErrOwnerTooLong},
		{name: "repo exceeds 100 chars", input: "owner/" + strings.Repeat("r", 101), expectError: true, errorTarget: ErrRepoNameTooLong},

		// Invalid characters
		{name: "space in owner", input: "owner name/repo", expectError: true, errorTarget: ErrInvalidRepoCharset},
		{name: "space in repo", input: "owner/repo name", expectError: true, errorTarget: ErrInvalidRepoCharset},
		{name: "at sign in repo", input: "owner/repo@1", expectError: true, errorTarget: ErrInvalidRepoCharset},
		{name: "dollar sign", input: "owner$/repo", expectError: true, errorTarget: ErrInvalidRepoCharset},

		// Dot / DotDot reserved names
		{name: "dot repo", input: "owner/.", expectError: true, errorTarget: ErrInvalidRepoFullName},
		{name: "dotdot repo", input: "owner/..", expectError: true, errorTarget: ErrInvalidRepoFullName},
		{name: "dot owner", input: "./repo", expectError: true, errorTarget: ErrInvalidRepoFullName},
		{name: "dotdot owner", input: "../repo", expectError: true, errorTarget: ErrInvalidRepoFullName},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			owner, repo, err := ValidateRepositoryFullName(tt.input)
			if tt.expectError {
				if err == nil {
					t.Fatalf("ValidateRepositoryFullName(%q) expected error, got owner=%q repo=%q", tt.input, owner, repo)
				}
				if tt.errorTarget != nil && !errors.Is(err, tt.errorTarget) {
					t.Fatalf("ValidateRepositoryFullName(%q) expected error %v, got %v", tt.input, tt.errorTarget, err)
				}
			} else {
				if err != nil {
					t.Fatalf("ValidateRepositoryFullName(%q) unexpected error: %v", tt.input, err)
				}
				if owner != tt.expectedOwner || repo != tt.expectedRepo {
					t.Fatalf("ValidateRepositoryFullName(%q) = (%q, %q), want (%q, %q)", tt.input, owner, repo, tt.expectedOwner, tt.expectedRepo)
				}
			}
		})
	}
}

func TestValidateCommitSHA(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectError bool
	}{
		// Valid 40-char SHA-1
		{name: "lowercase 40 hex", input: "da39a3ee5e6b4b0d3255bfef95601890afd80709", expectError: false},
		{name: "uppercase 40 hex", input: "DA39A3EE5E6B4B0D3255BFEF95601890AFD80709", expectError: false},
		{name: "mixed case 40 hex", input: "Da39A3ee5e6b4b0d3255bfef95601890afd80709", expectError: false},

		// Valid 64-char SHA-256
		{name: "lowercase 64 hex", input: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", expectError: false},
		{name: "uppercase 64 hex", input: "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855", expectError: false},
		{name: "mixed case 64 hex", input: "E3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", expectError: false},

		// Invalid lengths
		{name: "empty string", input: "", expectError: true},
		{name: "short 39 chars", input: strings.Repeat("a", 39), expectError: true},
		{name: "long 41 chars", input: strings.Repeat("a", 41), expectError: true},
		{name: "short 63 chars", input: strings.Repeat("a", 63), expectError: true},
		{name: "long 65 chars", input: strings.Repeat("a", 65), expectError: true},

		// Invalid characters
		{name: "non-hex char 'g'", input: "ga39a3ee5e6b4b0d3255bfef95601890afd80709", expectError: true},
		{name: "non-hex char 'z'", input: strings.Repeat("0", 63) + "z", expectError: true},
		{name: "contains space", input: "da39a3ee5e6b4b0d3255bfef95601890afd8070 ", expectError: true},
		{name: "contains symbol", input: "da39a3ee5e6b4b0d3255bfef95601890afd8070-", expectError: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateCommitSHA(tt.input)
			if tt.expectError && err == nil {
				t.Fatalf("ValidateCommitSHA(%q) expected error, got nil", tt.input)
			}
			if !tt.expectError && err != nil {
				t.Fatalf("ValidateCommitSHA(%q) unexpected error: %v", tt.input, err)
			}
		})
	}
}

func TestDeriveDeploymentKey(t *testing.T) {
	deliveryID := "d4e5f6-gh-delivery-uuid"
	serviceID := "s1a2b3-service-uuid"

	// Expected hash
	expectedRaw := deliveryID + ":" + serviceID
	expectedSum := sha256.Sum256([]byte(expectedRaw))
	expectedHex := hex.EncodeToString(expectedSum[:])

	// Stability / Idempotency
	key1 := DeriveDeploymentKey(deliveryID, serviceID)
	key2 := DeriveDeploymentKey(deliveryID, serviceID)
	if key1 != key2 {
		t.Fatalf("DeriveDeploymentKey is not deterministic: %q != %q", key1, key2)
	}
	if key1 != expectedHex {
		t.Fatalf("DeriveDeploymentKey = %q, want %q", key1, expectedHex)
	}

	// Uniqueness across different delivery or service IDs
	otherDelivery := DeriveDeploymentKey("different-delivery", serviceID)
	if otherDelivery == key1 {
		t.Fatalf("expected different key for different delivery ID, got collision: %q", otherDelivery)
	}

	otherService := DeriveDeploymentKey(deliveryID, "different-service")
	if otherService == key1 {
		t.Fatalf("expected different key for different service ID, got collision: %q", otherService)
	}

	// Empty input handling
	t.Run("empty inputs return empty string", func(t *testing.T) {
		if k := DeriveDeploymentKey("", serviceID); k != "" {
			t.Errorf("expected empty string for empty deliveryID, got %q", k)
		}
		if k := DeriveDeploymentKey(deliveryID, ""); k != "" {
			t.Errorf("expected empty string for empty serviceID, got %q", k)
		}
		if k := DeriveDeploymentKey("   ", serviceID); k != "" {
			t.Errorf("expected empty string for whitespace deliveryID, got %q", k)
		}
		if k := DeriveDeploymentKey(deliveryID, "   "); k != "" {
			t.Errorf("expected empty string for whitespace serviceID, got %q", k)
		}
	})

	t.Run("DeriveDeploymentKeyWithErr", func(t *testing.T) {
		k, err := DeriveDeploymentKeyWithErr(deliveryID, serviceID)
		if err != nil || k != expectedHex {
			t.Fatalf("unexpected err=%v, key=%q", err, k)
		}

		_, err = DeriveDeploymentKeyWithErr("", serviceID)
		if !errors.Is(err, ErrEmptyID) {
			t.Errorf("expected ErrEmptyID, got %v", err)
		}
	})
}
