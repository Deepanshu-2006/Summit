package protocol

import "time"

// Stage identifies a lifecycle execution stage.
type Stage string

const (
	StageInitializing           Stage = "initializing"
	StageValidatingSpec         Stage = "validating_spec"
	StagePreparingWorkspace     Stage = "preparing_workspace"
	StageSourceCheckout         Stage = "source_checkout"
	StageSourceValidation       Stage = "source_validation"
	StageApplicationDetection   Stage = "application_detection"
	StageBuildPlanGeneration    Stage = "build_plan_generation"
	StageDependencyInstallation Stage = "dependency_installation"
	StageImageBuild             Stage = "image_build"
	StageImagePush              Stage = "image_push"
	StageImageVerification      Stage = "image_verification"
	StageFinalizing             Stage = "finalizing"
	StageResultSubmission       Stage = "result_submission"
)

// AllStages returns all defined lifecycle stages in order of execution.
func AllStages() []Stage {
	return []Stage{
		StageInitializing,
		StageValidatingSpec,
		StagePreparingWorkspace,
		StageSourceCheckout,
		StageSourceValidation,
		StageApplicationDetection,
		StageBuildPlanGeneration,
		StageDependencyInstallation,
		StageImageBuild,
		StageImagePush,
		StageImageVerification,
		StageFinalizing,
		StageResultSubmission,
	}
}

// IsValid checks if the stage is one of the standard defined stages.
func (s Stage) IsValid() bool {
	switch s {
	case StageInitializing,
		StageValidatingSpec,
		StagePreparingWorkspace,
		StageSourceCheckout,
		StageSourceValidation,
		StageApplicationDetection,
		StageBuildPlanGeneration,
		StageDependencyInstallation,
		StageImageBuild,
		StageImagePush,
		StageImageVerification,
		StageFinalizing,
		StageResultSubmission:
		return true
	default:
		return false
	}
}

// StageStatus represents the state of a stage during execution.
type StageStatus string

const (
	StageStatusPending   StageStatus = "pending"
	StageStatusRunning   StageStatus = "running"
	StageStatusSucceeded StageStatus = "succeeded"
	StageStatusFailed    StageStatus = "failed"
	StageStatusSkipped   StageStatus = "skipped"
)

// IsValid checks if the stage status is recognized.
func (ss StageStatus) IsValid() bool {
	switch ss {
	case StageStatusPending,
		StageStatusRunning,
		StageStatusSucceeded,
		StageStatusFailed,
		StageStatusSkipped:
		return true
	default:
		return false
	}
}

// StatusUpdate represents a progress update emitted during build execution.
type StatusUpdate struct {
	BuildID   string      `json:"build_id"`
	AttemptID string      `json:"attempt_id"`
	Sequence  int         `json:"sequence"`
	Stage     Stage       `json:"stage"`
	Status    StageStatus `json:"status"`
	Timestamp time.Time   `json:"timestamp"`
	Message   string      `json:"message,omitempty"`
}

// NewStatusUpdate creates a new StatusUpdate with current timestamp.
func NewStatusUpdate(buildID, attemptID string, sequence int, stage Stage, status StageStatus, message string) StatusUpdate {
	return StatusUpdate{
		BuildID:   buildID,
		AttemptID: attemptID,
		Sequence:  sequence,
		Stage:     stage,
		Status:    status,
		Timestamp: time.Now().UTC(),
		Message:   message,
	}
}
