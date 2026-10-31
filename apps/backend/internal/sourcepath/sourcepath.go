package sourcepath

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"path"
	"strings"
)

const (
	// MaxPathLength is the maximum allowed length for root directory and dockerfile paths.
	MaxPathLength = 1024

	// MaxBranchLength is the maximum allowed length for a git branch name.
	MaxBranchLength = 255

	// MaxOwnerLength is the maximum allowed length for a GitHub owner/organization name.
	MaxOwnerLength = 39

	// MaxRepoNameLength is the maximum allowed length for a GitHub repository name.
	MaxRepoNameLength = 100
)

var (
	// ErrPathTooLong indicates the provided file or directory path exceeds 1024 characters.
	ErrPathTooLong = errors.New("path exceeds maximum length of 1024 characters")

	// ErrAbsolutePath indicates an absolute path was supplied where a relative path is required.
	ErrAbsolutePath = errors.New("absolute path is not allowed")

	// ErrPathTraversal indicates directory traversal attempts (such as ../) were detected.
	ErrPathTraversal = errors.New("path traversal is not allowed")

	// ErrDriveLetter indicates a Windows drive letter prefix (e.g. C:) was detected.
	ErrDriveLetter = errors.New("Windows drive letters are not allowed")

	// ErrUNCPath indicates a Universal Naming Convention (UNC) network path was detected.
	ErrUNCPath = errors.New("UNC paths are not allowed")

	// ErrInvalidControlChar indicates the path contains control characters or NUL bytes.
	ErrInvalidControlChar = errors.New("path contains control characters")

	// ErrTrailingSlash indicates a trailing slash was supplied for a file path.
	ErrTrailingSlash = errors.New("trailing slash is not allowed for file path")

	// ErrInvalidDockerfilePath indicates the dockerfile path is invalid or references a directory.
	ErrInvalidDockerfilePath = errors.New("invalid dockerfile path")

	// ErrEmptyBranch indicates the branch name is empty.
	ErrEmptyBranch = errors.New("branch name cannot be empty")

	// ErrBranchTooLong indicates the branch name exceeds 255 characters.
	ErrBranchTooLong = errors.New("branch name exceeds maximum length of 255 characters")

	// ErrInvalidBranch indicates the branch name violates git reference format rules.
	ErrInvalidBranch = errors.New("invalid branch name")

	// ErrInvalidBranchChar indicates the branch name contains illegal characters or whitespace.
	ErrInvalidBranchChar = errors.New("branch name contains illegal characters or whitespace")

	// ErrRefsNotAllowed indicates a full git reference (refs/...) was supplied instead of a branch name.
	ErrRefsNotAllowed = errors.New("full reference path (refs/...) is not allowed; specify branch name only")

	// ErrInvalidRepoFullName indicates repository full name is not formatted as owner/repo.
	ErrInvalidRepoFullName = errors.New("invalid repository full name; expected owner/repo format")

	// ErrInvalidRepoCharset indicates repository full name contains characters outside [A-Za-z0-9._-].
	ErrInvalidRepoCharset = errors.New("repository owner and name must contain only characters [A-Za-z0-9._-]")

	// ErrOwnerTooLong indicates the repository owner exceeds 39 characters.
	ErrOwnerTooLong = errors.New("repository owner exceeds maximum length of 39 characters")

	// ErrRepoNameTooLong indicates the repository name exceeds 100 characters.
	ErrRepoNameTooLong = errors.New("repository name exceeds maximum length of 100 characters")

	// ErrInvalidCommitSHA indicates the commit SHA is not 40 or 64 hex characters.
	ErrInvalidCommitSHA = errors.New("commit SHA must be 40 or 64 hexadecimal characters")

	// ErrEmptyID indicates either delivery ID or service ID is empty.
	ErrEmptyID = errors.New("delivery ID and service ID must not be empty")
)

// NormalizeRootDirectory cleans and normalizes a repository root directory path.
//
// Rules enforced:
//   - Surrounding whitespace is trimmed.
//   - An empty path (or whitespace only) defaults to "." (repository root).
//   - Backslashes are converted to forward slashes.
//   - Drive letters (e.g. C:) and UNC paths (e.g. //server or \\server) are rejected.
//   - Absolute paths (leading /) are rejected.
//   - Control characters (ASCII < 32 and ASCII 127) including NUL are rejected.
//   - Paths resolving to parent directories via traversal (.. or starting with ../) are rejected.
//   - Path length must not exceed 1024 characters.
//   - Returns a clean, slash-separated relative path without leading "./".
//   - "." is permitted and returned as ".".
func NormalizeRootDirectory(rawPath string) (string, error) {
	if len(rawPath) > MaxPathLength {
		return "", ErrPathTooLong
	}

	p := strings.TrimSpace(rawPath)
	if p == "" {
		return ".", nil
	}

	// Reject control characters and NUL bytes
	if err := checkControlChars(p); err != nil {
		return "", err
	}

	// Reject Windows drive letters (e.g. C: or c:/)
	if isDriveLetter(p) {
		return "", ErrDriveLetter
	}

	// Reject UNC paths before and after slash conversion
	if strings.HasPrefix(p, `\\`) || strings.HasPrefix(p, "//") {
		return "", ErrUNCPath
	}

	// Reject absolute paths
	if strings.HasPrefix(p, "/") || strings.HasPrefix(p, `\`) {
		return "", ErrAbsolutePath
	}

	// Convert backslashes to forward slashes
	p = strings.ReplaceAll(p, `\`, `/`)

	if strings.HasPrefix(p, "//") {
		return "", ErrUNCPath
	}
	if strings.HasPrefix(p, "/") {
		return "", ErrAbsolutePath
	}

	cleaned := path.Clean(p)

	if cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", ErrPathTraversal
	}
	if strings.HasPrefix(cleaned, "/") {
		return "", ErrAbsolutePath
	}
	if len(cleaned) > MaxPathLength {
		return "", ErrPathTooLong
	}

	if cleaned == "." {
		return ".", nil
	}

	cleaned = strings.TrimPrefix(cleaned, "./")
	if cleaned == "" {
		return ".", nil
	}

	return cleaned, nil
}

// ValidateDockerfilePath validates and normalizes a relative Dockerfile path.
//
// Rules enforced:
//   - Surrounding whitespace is trimmed.
//   - An empty path (or whitespace only) returns "" (not configured).
//   - Trailing slashes are rejected (a Dockerfile is a file, not a directory).
//   - Backslashes are converted to forward slashes.
//   - Drive letters, UNC paths, and absolute paths are rejected.
//   - Control characters and NUL bytes are rejected.
//   - Directory traversal (.. or starting with ../) is rejected.
//   - Paths resolving to "." or empty are rejected (must name a file).
//   - Path length must not exceed 1024 characters.
//   - Returns a clean, slash-separated relative path without leading "./".
func ValidateDockerfilePath(rawPath string) (string, error) {
	if len(rawPath) > MaxPathLength {
		return "", ErrPathTooLong
	}

	p := strings.TrimSpace(rawPath)
	if p == "" {
		return "", nil
	}

	// Reject trailing slash
	if strings.HasSuffix(p, "/") || strings.HasSuffix(p, `\`) {
		return "", ErrTrailingSlash
	}

	// Reject control characters and NUL bytes
	if err := checkControlChars(p); err != nil {
		return "", err
	}

	// Reject Windows drive letters
	if isDriveLetter(p) {
		return "", ErrDriveLetter
	}

	// Reject UNC paths
	if strings.HasPrefix(p, `\\`) || strings.HasPrefix(p, "//") {
		return "", ErrUNCPath
	}

	// Reject absolute paths
	if strings.HasPrefix(p, "/") || strings.HasPrefix(p, `\`) {
		return "", ErrAbsolutePath
	}

	// Convert backslashes to forward slashes
	p = strings.ReplaceAll(p, `\`, `/`)

	if strings.HasPrefix(p, "//") {
		return "", ErrUNCPath
	}
	if strings.HasPrefix(p, "/") {
		return "", ErrAbsolutePath
	}

	cleaned := path.Clean(p)

	if cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", ErrPathTraversal
	}
	if strings.HasPrefix(cleaned, "/") {
		return "", ErrAbsolutePath
	}
	if cleaned == "." {
		return "", ErrInvalidDockerfilePath
	}
	if len(cleaned) > MaxPathLength {
		return "", ErrPathTooLong
	}

	cleaned = strings.TrimPrefix(cleaned, "./")
	if cleaned == "" || cleaned == "." {
		return "", ErrInvalidDockerfilePath
	}

	return cleaned, nil
}

// ValidateBranch validates a git branch name against git reference constraints.
//
// Note:
// This function expects a branch name only (e.g. "main", "feat/user-auth", "release-1.0").
// Full reference paths such as "refs/heads/main" or "refs/pull/1/head" are explicitly
// rejected with ErrRefsNotAllowed to enforce clean platform data modeling.
//
// Rules enforced:
//   - Non-empty, maximum length 255 characters.
//   - No ASCII control characters (<= 32 or 127) or spaces.
//   - No ".." (parent directory traversal).
//   - No leading or trailing "/" or ".".
//   - No consecutive slashes ("//").
//   - No sequence "@{".
//   - No illegal characters: '~', '^', ':', '?', '*', '[', '\'.
//   - No ".lock" suffix.
func ValidateBranch(branch string) error {
	if branch == "" {
		return ErrEmptyBranch
	}
	if len(branch) > MaxBranchLength {
		return ErrBranchTooLong
	}

	// Reject full refs (e.g. refs/heads/main)
	if strings.HasPrefix(branch, "refs/") || branch == "refs" {
		return ErrRefsNotAllowed
	}

	// Reject leading or trailing slash or dot
	if strings.HasPrefix(branch, "/") || strings.HasSuffix(branch, "/") {
		return ErrInvalidBranch
	}
	if strings.HasPrefix(branch, ".") || strings.HasSuffix(branch, ".") {
		return ErrInvalidBranch
	}

	// Reject consecutive slashes, .., @{, and .lock suffix
	if strings.Contains(branch, "//") {
		return ErrInvalidBranch
	}
	if strings.Contains(branch, "..") {
		return ErrInvalidBranch
	}
	if strings.Contains(branch, "@{") {
		return ErrInvalidBranch
	}
	if strings.HasSuffix(branch, ".lock") {
		return ErrInvalidBranch
	}

	// Reject control characters, spaces, and git-forbidden characters (~^:?*[\\)
	for i := 0; i < len(branch); i++ {
		c := branch[i]
		if c <= 32 || c == 127 {
			return ErrInvalidBranchChar
		}
	}

	if strings.ContainsAny(branch, "~^:?*[\\") {
		return ErrInvalidBranchChar
	}

	return nil
}

// ValidateRepositoryFullName validates a GitHub "owner/repo" full name string.
//
// Rules enforced:
//   - Exactly one forward slash separating owner and repository name.
//   - Both owner and name must be non-empty.
//   - Owner maximum length is 39 characters.
//   - Repository name maximum length is 100 characters.
//   - Characters must be strictly within GitHub's allowed charset: [A-Za-z0-9._-].
//   - Neither owner nor repository name may be "." or "..".
func ValidateRepositoryFullName(full string) (owner, name string, err error) {
	parts := strings.Split(full, "/")
	if len(parts) != 2 {
		return "", "", ErrInvalidRepoFullName
	}

	owner = parts[0]
	name = parts[1]

	if owner == "" || name == "" {
		return "", "", ErrInvalidRepoFullName
	}
	if len(owner) > MaxOwnerLength {
		return "", "", ErrOwnerTooLong
	}
	if len(name) > MaxRepoNameLength {
		return "", "", ErrRepoNameTooLong
	}
	if owner == "." || owner == ".." || name == "." || name == ".." {
		return "", "", ErrInvalidRepoFullName
	}

	if !isGitHubCharset(owner) || !isGitHubCharset(name) {
		return "", "", ErrInvalidRepoCharset
	}

	return owner, name, nil
}

// ValidateCommitSHA validates whether a string is a valid 40-character (SHA-1)
// or 64-character (SHA-256) hexadecimal git commit hash. Both lower-case and
// upper-case hexadecimal strings are accepted.
func ValidateCommitSHA(sha string) error {
	if len(sha) != 40 && len(sha) != 64 {
		return ErrInvalidCommitSHA
	}

	for i := 0; i < len(sha); i++ {
		c := sha[i]
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return ErrInvalidCommitSHA
		}
	}

	return nil
}

// DeriveDeploymentKey generates a stable SHA-256 hex idempotency key for deployment triggers
// derived from the webhook delivery ID and the platform service ID.
//
// In accordance with spec section 17.1 / 13.4, this ensures that a webhook push event triggering
// multiple services has deterministic, per-service deduplication keys.
// If either deliveryID or serviceID is empty (or whitespace only), it returns an empty string.
func DeriveDeploymentKey(deliveryID, serviceID string) string {
	deliveryID = strings.TrimSpace(deliveryID)
	serviceID = strings.TrimSpace(serviceID)
	if deliveryID == "" || serviceID == "" {
		return ""
	}

	h := sha256.Sum256([]byte(deliveryID + ":" + serviceID))
	return hex.EncodeToString(h[:])
}

// DeriveDeploymentKeyWithErr returns the deployment idempotency key, or ErrEmptyID
// if either deliveryID or serviceID is empty or whitespace only.
func DeriveDeploymentKeyWithErr(deliveryID, serviceID string) (string, error) {
	key := DeriveDeploymentKey(deliveryID, serviceID)
	if key == "" {
		return "", ErrEmptyID
	}
	return key, nil
}

func checkControlChars(s string) error {
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c < 32 || c == 127 {
			return fmt.Errorf("%w: byte 0x%02x at index %d", ErrInvalidControlChar, c, i)
		}
	}
	return nil
}

func isDriveLetter(p string) bool {
	return len(p) >= 2 && ((p[0] >= 'a' && p[0] <= 'z') || (p[0] >= 'A' && p[0] <= 'Z')) && p[1] == ':'
}

func isGitHubCharset(s string) bool {
	for i := 0; i < len(s); i++ {
		c := s[i]
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '.' || c == '_' || c == '-') {
			return false
		}
	}
	return true
}
