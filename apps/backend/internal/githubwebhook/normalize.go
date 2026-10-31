package githubwebhook

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// Normalize parses and normalizes a verified GitHub webhook payload according to its eventType.
// actionHint is used as a fallback if the payload JSON does not contain an explicit "action" field.
// For unsupported event types, it returns an Event with KindUnsupported and a typed UnsupportedError.
// For push events, it always returns KindPush, with Branch set when ref is a branch ref, or empty when a tag/other ref.
// Installation events require a non-empty action (from payload or actionHint), returning ErrMissingAction otherwise.
// Unknown JSON fields are tolerated and numeric IDs are parsed as int64.
func Normalize(eventType, actionHint string, payload []byte) (*Event, error) {
	if len(payload) == 0 || !json.Valid(payload) {
		return nil, ErrMalformedJSON
	}

	eventType = strings.TrimSpace(eventType)

	switch eventType {
	case string(KindPush):
		return normalizePush(eventType, actionHint, payload)
	case string(KindInstallation):
		return normalizeInstallation(eventType, actionHint, payload)
	case string(KindInstallationRepositories):
		return normalizeInstallationRepositories(eventType, actionHint, payload)
	default:
		ev := &Event{
			Kind:      KindUnsupported,
			EventType: eventType,
			Action:    actionHint,
		}
		return ev, &UnsupportedError{
			EventType: eventType,
			Reason:    fmt.Sprintf("unsupported event type %q", eventType),
		}
	}
}

// Wire structures for decoding GitHub payloads without coupling public types to GitHub wire quirks.

type rawPush struct {
	Ref          string      `json:"ref"`
	Before       string      `json:"before"`
	After        string      `json:"after"`
	Created      bool        `json:"created"`
	Deleted      bool        `json:"deleted"`
	Forced       bool        `json:"forced"`
	HeadCommit   *rawCommit  `json:"head_commit"`
	Commits      []rawCommit `json:"commits"`
	Repository   *rawRepo    `json:"repository"`
	Installation *rawInstRef `json:"installation"`
	Sender       *rawSender  `json:"sender"`
	Action       string      `json:"action"`
}

type rawCommit struct {
	ID string `json:"id"`
}

type rawInstRef struct {
	ID int64 `json:"id"`
}

type rawRepo struct {
	ID            int64           `json:"id"`
	Name          string          `json:"name"`
	FullName      string          `json:"full_name"`
	Owner         json.RawMessage `json:"owner"`
	DefaultBranch string          `json:"default_branch"`
	HTMLURL       string          `json:"html_url"`
	Private       bool            `json:"private"`
	Archived      bool            `json:"archived"`
	Disabled      bool            `json:"disabled"`
	PushedAt      json.RawMessage `json:"pushed_at"`
}

type rawSender struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	Type      string `json:"type"`
	AvatarURL string `json:"avatar_url"`
	HTMLURL   string `json:"html_url"`
}

type rawAccount struct {
	ID    int64  `json:"id"`
	Login string `json:"login"`
	Type  string `json:"type"`
}

type rawInstallationFull struct {
	ID                  int64             `json:"id"`
	Account             rawAccount        `json:"account"`
	RepositorySelection string            `json:"repository_selection"`
	Permissions         map[string]string `json:"permissions"`
	SuspendedAt         *time.Time        `json:"suspended_at"`
}

type rawInstallationEvent struct {
	Action       string               `json:"action"`
	Installation *rawInstallationFull `json:"installation"`
	Repositories []rawRepo            `json:"repositories"`
	Sender       *rawSender           `json:"sender"`
}

type rawInstallationRepositoriesEvent struct {
	Action              string               `json:"action"`
	Installation        *rawInstallationFull `json:"installation"`
	RepositorySelection string               `json:"repository_selection"`
	RepositoriesAdded   []rawRepo            `json:"repositories_added"`
	RepositoriesRemoved []rawRepo            `json:"repositories_removed"`
	Sender              *rawSender           `json:"sender"`
}

func normalizePush(eventType, actionHint string, payload []byte) (*Event, error) {
	var raw rawPush
	if err := json.Unmarshal(payload, &raw); err != nil {
		return nil, ErrMalformedJSON
	}

	action := strings.TrimSpace(raw.Action)
	if action == "" {
		action = strings.TrimSpace(actionHint)
	}

	branch, _ := BranchFromRef(raw.Ref)

	headSHA := ""
	if raw.HeadCommit != nil && raw.HeadCommit.ID != "" {
		headSHA = raw.HeadCommit.ID
	} else if raw.After != "" {
		headSHA = raw.After
	}

	var repo Repository
	if raw.Repository != nil {
		repo = parseRawRepo(*raw.Repository)
	}

	var sender Sender
	if raw.Sender != nil {
		sender = Sender{
			ID:        raw.Sender.ID,
			Login:     raw.Sender.Login,
			Type:      raw.Sender.Type,
			AvatarURL: raw.Sender.AvatarURL,
			HTMLURL:   raw.Sender.HTMLURL,
		}
	}

	var instID int64
	if raw.Installation != nil {
		instID = raw.Installation.ID
	}

	push := &Push{
		Ref:           raw.Ref,
		Branch:        branch,
		Before:        raw.Before,
		After:         raw.After,
		Deleted:       raw.Deleted,
		Created:       raw.Created,
		Forced:        raw.Forced,
		Repository:    repo,
		Sender:        sender,
		HeadCommitSHA: headSHA,
		CommitCount:   len(raw.Commits),
	}

	ev := &Event{
		Kind:           KindPush,
		EventType:      eventType,
		Action:         action,
		InstallationID: instID,
		RepositoryID:   repo.ID,
		Push:           push,
	}

	return ev, nil
}

func normalizeInstallation(eventType, actionHint string, payload []byte) (*Event, error) {
	var raw rawInstallationEvent
	if err := json.Unmarshal(payload, &raw); err != nil {
		return nil, ErrMalformedJSON
	}

	action := strings.TrimSpace(raw.Action)
	if action == "" {
		action = strings.TrimSpace(actionHint)
	}
	if action == "" {
		return nil, ErrMissingAction
	}

	change := &InstallationChange{
		Action:       action,
		Repositories: make([]Repository, 0, len(raw.Repositories)),
	}

	var instID int64
	if raw.Installation != nil {
		instID = raw.Installation.ID
		change.InstallationID = raw.Installation.ID
		change.AccountID = raw.Installation.Account.ID
		change.AccountLogin = raw.Installation.Account.Login
		change.AccountType = raw.Installation.Account.Type
		change.RepositorySelection = raw.Installation.RepositorySelection
		change.Permissions = raw.Installation.Permissions
		change.SuspendedAt = raw.Installation.SuspendedAt
	}

	for _, r := range raw.Repositories {
		change.Repositories = append(change.Repositories, parseRawRepo(r))
	}

	ev := &Event{
		Kind:           KindInstallation,
		EventType:      eventType,
		Action:         action,
		InstallationID: instID,
		Installation:   change,
	}

	return ev, nil
}

func normalizeInstallationRepositories(eventType, actionHint string, payload []byte) (*Event, error) {
	var raw rawInstallationRepositoriesEvent
	if err := json.Unmarshal(payload, &raw); err != nil {
		return nil, ErrMalformedJSON
	}

	action := strings.TrimSpace(raw.Action)
	if action == "" {
		action = strings.TrimSpace(actionHint)
	}
	if action == "" {
		return nil, ErrMissingAction
	}

	change := &RepositoriesChange{
		Action:  action,
		Added:   make([]Repository, 0, len(raw.RepositoriesAdded)),
		Removed: make([]Repository, 0, len(raw.RepositoriesRemoved)),
	}

	var instID int64
	if raw.Installation != nil {
		instID = raw.Installation.ID
		change.InstallationID = raw.Installation.ID
	}

	for _, r := range raw.RepositoriesAdded {
		change.Added = append(change.Added, parseRawRepo(r))
	}
	for _, r := range raw.RepositoriesRemoved {
		change.Removed = append(change.Removed, parseRawRepo(r))
	}

	ev := &Event{
		Kind:           KindInstallationRepositories,
		EventType:      eventType,
		Action:         action,
		InstallationID: instID,
		Repositories:   change,
	}

	return ev, nil
}

func parseRawRepo(raw rawRepo) Repository {
	repo := Repository{
		ID:            raw.ID,
		Name:          raw.Name,
		FullName:      raw.FullName,
		DefaultBranch: raw.DefaultBranch,
		HTMLURL:       raw.HTMLURL,
		Private:       raw.Private,
		Archived:      raw.Archived,
		Disabled:      raw.Disabled,
	}

	if len(raw.Owner) > 0 && string(raw.Owner) != "null" {
		var ownerObj struct {
			Login string `json:"login"`
			Name  string `json:"name"`
		}
		if err := json.Unmarshal(raw.Owner, &ownerObj); err == nil && ownerObj.Login != "" {
			repo.OwnerLogin = ownerObj.Login
		} else if ownerObj.Name != "" {
			repo.OwnerLogin = ownerObj.Name
		} else {
			var ownerStr string
			if err := json.Unmarshal(raw.Owner, &ownerStr); err == nil {
				repo.OwnerLogin = ownerStr
			}
		}
	}

	if repo.OwnerLogin == "" && strings.Contains(repo.FullName, "/") {
		parts := strings.Split(repo.FullName, "/")
		if len(parts) > 0 {
			repo.OwnerLogin = parts[0]
		}
	}

	if len(raw.PushedAt) > 0 && string(raw.PushedAt) != "null" {
		var unixNum int64
		if err := json.Unmarshal(raw.PushedAt, &unixNum); err == nil {
			var t time.Time
			if unixNum > 1e11 {
				t = time.UnixMilli(unixNum).UTC()
			} else {
				t = time.Unix(unixNum, 0).UTC()
			}
			repo.PushedAt = &t
		} else {
			var timeStr string
			if err := json.Unmarshal(raw.PushedAt, &timeStr); err == nil && timeStr != "" {
				if t, err := time.Parse(time.RFC3339, timeStr); err == nil {
					tUTC := t.UTC()
					repo.PushedAt = &tUTC
				}
			}
		}
	}

	return repo
}
