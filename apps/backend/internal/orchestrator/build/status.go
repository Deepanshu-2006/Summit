package build

import (
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/watch"
)

// PodStatusEvent captures a transition or update during build pod observation.
type PodStatusEvent struct {
	Type       watch.EventType
	Pod        *corev1.Pod
	Phase      corev1.PodPhase
	Ready      bool
	ExitCode   *int32
	Reason     string
	Message    string
	StartedAt  *time.Time
	FinishedAt *time.Time
	Error      error
}

// BuildPodStatus is a clean summary of the builder pod state.
type BuildPodStatus struct {
	BuildID    string          `json:"build_id"`
	AttemptID  string          `json:"attempt_id"`
	PodName    string          `json:"pod_name"`
	Namespace  string          `json:"namespace"`
	Phase      corev1.PodPhase `json:"phase"`
	Ready      bool            `json:"ready"`
	ExitCode   *int32          `json:"exit_code,omitempty"`
	Reason     string          `json:"reason,omitempty"`
	Message    string          `json:"message,omitempty"`
	StartedAt  *time.Time      `json:"started_at,omitempty"`
	FinishedAt *time.Time      `json:"finished_at,omitempty"`
}

// IsTerminal returns true if the pod has reached a terminal execution state (Succeeded or Failed).
func (s BuildPodStatus) IsTerminal() bool {
	return s.Phase == corev1.PodSucceeded || s.Phase == corev1.PodFailed
}

// ExtractPodStatus extracts a typed summary from a Kubernetes Pod object.
func ExtractPodStatus(pod *corev1.Pod) BuildPodStatus {
	status := BuildPodStatus{
		PodName:   pod.Name,
		Namespace: pod.Namespace,
		Phase:     pod.Status.Phase,
	}

	if pod.Labels != nil {
		status.BuildID = pod.Labels[LabelBuildID]
		status.AttemptID = pod.Labels[LabelAttemptID]
	}

	// Check container statuses for the builder container
	for _, cs := range pod.Status.ContainerStatuses {
		if cs.Name == "builder" {
			status.Ready = cs.Ready

			if cs.State.Waiting != nil {
				status.Reason = cs.State.Waiting.Reason
				status.Message = cs.State.Waiting.Message
			} else if cs.State.Running != nil {
				started := cs.State.Running.StartedAt.Time
				status.StartedAt = &started
			} else if cs.State.Terminated != nil {
				exitCode := cs.State.Terminated.ExitCode
				status.ExitCode = &exitCode
				status.Reason = cs.State.Terminated.Reason
				status.Message = cs.State.Terminated.Message
				started := cs.State.Terminated.StartedAt.Time
				status.StartedAt = &started
				finished := cs.State.Terminated.FinishedAt.Time
				status.FinishedAt = &finished
			}
			break
		}
	}

	// Fallback to pod-level reason/message if container didn't supply them
	if status.Reason == "" && pod.Status.Reason != "" {
		status.Reason = pod.Status.Reason
	}
	if status.Message == "" && pod.Status.Message != "" {
		status.Message = pod.Status.Message
	}

	return status
}
