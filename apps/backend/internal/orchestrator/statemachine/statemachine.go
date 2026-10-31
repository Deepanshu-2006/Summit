// Package statemachine defines the deployment lifecycle state machine shared by
// the orchestrator loops. It is pure Go: it validates transitions and exposes
// the "from" sets used for compare-and-set updates in the database. It performs
// no I/O.
package statemachine

import (
	"errors"
	"fmt"
)

// State is a deployment lifecycle state. Values are identical to the Postgres
// deployment_status enum labels.
type State string

const (
	Queued         State = "queued"
	Building       State = "building"
	ImageReady     State = "image_ready"
	Deploying      State = "deploying"
	HealthChecking State = "health_checking"
	Running        State = "running"
	Failed         State = "failed"
	Cancelled      State = "cancelled"
	Superseded     State = "superseded"

	// LegacyPending and LegacyActive remain in the Postgres enum for
	// compatibility. They are recognised as states but are never valid targets.
	LegacyPending State = "pending"
	LegacyActive  State = "active"
)

// ErrInvalidTransition is matched (errors.Is) by every *TransitionError.
var ErrInvalidTransition = errors.New("statemachine: invalid transition")

// TransitionError describes a rejected transition.
type TransitionError struct {
	From   State
	To     State
	Reason string
}

func (e *TransitionError) Error() string {
	return fmt.Sprintf("statemachine: invalid transition %q -> %q: %s", e.From, e.To, e.Reason)
}

// Is makes errors.Is(err, ErrInvalidTransition) true for any TransitionError.
func (e *TransitionError) Is(target error) bool { return target == ErrInvalidTransition }

// happyPath lists the forward-only success lifecycle in order.
var happyPath = []State{Queued, Building, ImageReady, Deploying, HealthChecking, Running}

// allStates lists every recognised state (including legacy ones).
var allStates = []State{
	Queued, Building, ImageReady, Deploying, HealthChecking, Running,
	Failed, Cancelled, Superseded, LegacyPending, LegacyActive,
}

// targets are the states new code may write.
var targets = []State{
	Queued, Building, ImageReady, Deploying, HealthChecking, Running,
	Failed, Cancelled, Superseded,
}

// All returns every recognised state, including legacy ones.
func All() []State { return append([]State(nil), allStates...) }

// Known reports whether s is a recognised state (including legacy ones).
func Known(s State) bool {
	for _, k := range allStates {
		if k == s {
			return true
		}
	}
	return false
}

// IsLegacy reports whether s is a legacy enum value that new code must not write.
func IsLegacy(s State) bool { return s == LegacyPending || s == LegacyActive }

// IsTerminal reports whether no further transition is possible out of s.
// Unknown states are not terminal (they have no outgoing transitions either,
// but callers should validate with Known first).
func IsTerminal(s State) bool {
	return s == Failed || s == Cancelled || s == Superseded
}

// IsActive reports whether s is a non-terminal, non-legacy lifecycle state in
// which orchestrator work may still be in progress (running counts: it can
// still fail, be cancelled or be superseded).
func IsActive(s State) bool {
	for _, p := range happyPath {
		if p == s {
			return true
		}
	}
	return false
}

// Next returns the next state on the happy path. ok is false for running,
// terminal, legacy and unknown states.
func Next(s State) (State, bool) {
	for i, p := range happyPath {
		if p == s && i+1 < len(happyPath) {
			return happyPath[i+1], true
		}
	}
	return "", false
}

// CanTransition reports whether from -> to is allowed.
//
// Allowed:
//   - the forward happy path (queued -> building -> image_ready -> deploying
//     -> health_checking -> running), one step at a time;
//   - any non-terminal lifecycle state (queued..running) -> failed;
//   - any non-terminal lifecycle state (queued..running) -> cancelled;
//   - running -> superseded.
//
// Everything else is invalid: skipping or going backwards, self-transitions,
// anything out of a terminal state, and anything involving legacy states.
func CanTransition(from, to State) bool {
	return Validate(from, to) == nil
}

// Validate returns nil when from -> to is allowed, otherwise a *TransitionError.
func Validate(from, to State) error {
	if !Known(from) {
		return &TransitionError{From: from, To: to, Reason: "unknown source state"}
	}
	if !Known(to) {
		return &TransitionError{From: from, To: to, Reason: "unknown target state"}
	}
	if IsLegacy(to) {
		return &TransitionError{From: from, To: to, Reason: "legacy state cannot be a target"}
	}
	if IsTerminal(from) {
		return &TransitionError{From: from, To: to, Reason: "source state is terminal"}
	}
	if !IsActive(from) {
		return &TransitionError{From: from, To: to, Reason: "legacy source state has no transitions"}
	}
	switch to {
	case Failed, Cancelled:
		return nil
	case Superseded:
		if from == Running {
			return nil
		}
		return &TransitionError{From: from, To: to, Reason: "only a running deployment can be superseded"}
	}
	if next, ok := Next(from); ok && next == to {
		return nil
	}
	return &TransitionError{From: from, To: to, Reason: "not a forward happy-path step"}
}

// AllowedFrom returns the states from which a transition to `to` is valid, in
// lifecycle order. The orchestrator passes this set as the CAS "from" list
// (UPDATE ... WHERE status = ANY($from)). It is empty for queued, legacy and
// unknown targets.
func AllowedFrom(to State) []State {
	var out []State
	for _, from := range allStates {
		if CanTransition(from, to) {
			out = append(out, from)
		}
	}
	return out
}

// Targets returns the states new code may write.
func Targets() []State { return append([]State(nil), targets...) }
