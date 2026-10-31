package protocol

import (
	"time"
)

// ResultStatus indicates the terminal state of a build execution attempt.
type ResultStatus string

const (
	StatusSucceeded ResultStatus = "succeeded"
	StatusFailed    ResultStatus = "failed"
	StatusCancelled ResultStatus = "cancelled"
)

// IsValid checks if the result status is recognized.
func (s ResultStatus) IsValid() bool {
	switch s {
	case StatusSucceeded, StatusFailed, StatusCancelled:
		return true
	default:
		return false
	}
}

// Standard machine-readable error codes.
const (
	ErrCodeSpecInvalid         = "SPEC_INVALID"
	ErrCodeWorkspaceInitFailed = "WORKSPACE_INIT_FAILED"
	ErrCodeSourceAuthFailed    = "SOURCE_AUTH_FAILED"
	ErrCodeSourceCloneFailed   = "SOURCE_CLONE_FAILED"
	ErrCodeCommitMismatch      = "COMMIT_MISMATCH"
	ErrCodeDetectionFailed     = "APPLICATION_DETECTION_FAILED"
	ErrCodeBuildPlanFailed     = "BUILD_PLAN_GENERATION_FAILED"
	ErrCodeDependencyInstall   = "DEPENDENCY_INSTALLATION_FAILED"
	ErrCodeBuildFailed         = "IMAGE_BUILD_FAILED"
	ErrCodeRegistryAuthFailed  = "REGISTRY_AUTH_FAILED"
	ErrCodePushFailed          = "IMAGE_PUSH_FAILED"
	ErrCodeDigestVerifyFailed  = "DIGEST_VERIFICATION_FAILED"
	ErrCodeTimeout             = "TIMEOUT"
	ErrCodeCancelled           = "CANCELLED"
	ErrCodeInternal            = "INTERNAL_ERROR"
)

// BuildExecutionResult is the final output document reported upon completion.
type BuildExecutionResult struct {
	SchemaVersion int              `json:"schema_version"`
	BuildID       string           `json:"build_id"`
	AttemptID     string           `json:"attempt_id"`
	Status        ResultStatus     `json:"status"`
	Artifact      *ArtifactDetails `json:"artifact,omitempty"`
	Metadata      ResultMetadata   `json:"metadata"`
	Error         *ExecutionError  `json:"error,omitempty"`
	Timestamps    ResultTimestamps `json:"timestamps"`
}

// ArtifactDetails represents the OCI container image produced by a successful build.
type ArtifactDetails struct {
	Repository string   `json:"repository"`
	Digest     string   `json:"digest"`
	Tag        string   `json:"tag"`
	Platforms  []string `json:"platforms"`
	SizeBytes  int64    `json:"size_bytes,omitempty"`
}

// ResultMetadata captures contextual information and component versions.
type ResultMetadata struct {
	Builder         string `json:"builder"`
	RailpackVersion string `json:"railpack_version"`
	BuildkitVersion string `json:"buildkit_version"`
	CommitSHA       string `json:"commit_sha"`
	DetectedRuntime string `json:"detected_runtime,omitempty"`
}

// ExecutionError contains structured error details when status is failed or cancelled.
type ExecutionError struct {
	Code    string `json:"code"`
	Stage   string `json:"stage"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// ResultTimestamps records timing information for the execution attempt.
type ResultTimestamps struct {
	StartedAt   time.Time `json:"started_at"`
	CompletedAt time.Time `json:"completed_at"`
	DurationMS  int64     `json:"duration_ms"`
}
