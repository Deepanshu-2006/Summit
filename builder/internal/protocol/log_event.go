package protocol

import "time"

// LogStream specifies the origin stream of the log message.
type LogStream string

const (
	StreamStdout LogStream = "stdout"
	StreamStderr LogStream = "stderr"
)

// IsValid checks if the stream is stdout or stderr.
func (ls LogStream) IsValid() bool {
	return ls == StreamStdout || ls == StreamStderr
}

// LogSeverity defines the severity level of a log event.
type LogSeverity string

const (
	SeverityDebug LogSeverity = "debug"
	SeverityInfo  LogSeverity = "info"
	SeverityWarn  LogSeverity = "warn"
	SeverityError LogSeverity = "error"
)

// IsValid checks if the severity is recognized.
func (s LogSeverity) IsValid() bool {
	switch s {
	case SeverityDebug, SeverityInfo, SeverityWarn, SeverityError:
		return true
	default:
		return false
	}
}

// LogEvent represents a single structured log line captured during execution.
type LogEvent struct {
	BuildID   string      `json:"build_id"`
	AttemptID string      `json:"attempt_id"`
	Sequence  int         `json:"sequence"`
	Timestamp time.Time   `json:"timestamp"`
	Stream    LogStream   `json:"stream"`
	Stage     string      `json:"stage"`
	Severity  LogSeverity `json:"severity"`
	Message   string      `json:"message"`
}

// NewLogEvent constructs a new LogEvent with the current timestamp in UTC.
func NewLogEvent(buildID, attemptID string, sequence int, stream LogStream, stage string, severity LogSeverity, message string) LogEvent {
	return LogEvent{
		BuildID:   buildID,
		AttemptID: attemptID,
		Sequence:  sequence,
		Timestamp: time.Now().UTC(),
		Stream:    stream,
		Stage:     stage,
		Severity:  severity,
		Message:   message,
	}
}
