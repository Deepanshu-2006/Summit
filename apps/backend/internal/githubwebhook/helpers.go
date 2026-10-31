package githubwebhook

import (
	"encoding/json"
	"errors"
	"strings"
)

// BranchFromRef extracts the branch name from a Git ref if it starts with refs/heads/.
// It returns (branchName, true) if valid, or ("", false) if not a branch ref or empty branch.
func BranchFromRef(ref string) (string, bool) {
	const prefix = "refs/heads/"
	if strings.HasPrefix(ref, prefix) {
		branch := strings.TrimPrefix(ref, prefix)
		if branch != "" {
			return branch, true
		}
	}
	return "", false
}

// IsBranchRef returns true if the ref represents a branch (i.e. starts with refs/heads/<name>).
func IsBranchRef(ref string) bool {
	_, ok := BranchFromRef(ref)
	return ok
}

// IsTagRef returns true if the ref represents a Git tag (starts with refs/tags/<name>).
func IsTagRef(ref string) bool {
	const prefix = "refs/tags/"
	if strings.HasPrefix(ref, prefix) {
		tag := strings.TrimPrefix(ref, prefix)
		return tag != ""
	}
	return false
}

// IsZeroSHA returns true if sha is a Git null commit SHA composed entirely of '0' characters
// with length 40 (SHA-1) or 64 (SHA-256).
func IsZeroSHA(sha string) bool {
	if len(sha) != 40 && len(sha) != 64 {
		return false
	}
	for i := 0; i < len(sha); i++ {
		if sha[i] != '0' {
			return false
		}
	}
	return true
}

// MinimalPayload returns a compact JSON representation containing only the fields
// required for asynchronous processing and persistence.
// It excludes raw webhook payloads and sensitive sender fields such as email.
func MinimalPayload(ev *Event) ([]byte, error) {
	if ev == nil {
		return nil, errors.New("githubwebhook: event is nil")
	}

	// Ensure top-level IDs are set from sub-objects if omitted.
	copyEv := *ev
	if copyEv.RepositoryID == 0 && copyEv.Push != nil {
		copyEv.RepositoryID = copyEv.Push.Repository.ID
	}
	if copyEv.InstallationID == 0 {
		if copyEv.Installation != nil {
			copyEv.InstallationID = copyEv.Installation.InstallationID
		} else if copyEv.Repositories != nil {
			copyEv.InstallationID = copyEv.Repositories.InstallationID
		}
	}

	return json.Marshal(&copyEv)
}
