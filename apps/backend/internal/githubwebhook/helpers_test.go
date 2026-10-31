package githubwebhook

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestRefHelpers(t *testing.T) {
	cases := []struct {
		ref        string
		wantBranch string
		isBranch   bool
		isTag      bool
	}{
		{"refs/heads/main", "main", true, false},
		{"refs/heads/feature/x", "feature/x", true, false},
		{"refs/heads/deep/nested/feature-branch", "deep/nested/feature-branch", true, false},
		{"refs/heads/", "", false, false},
		{"refs/tags/v1.0.0", "", false, true},
		{"refs/tags/release/2026.1", "", false, true},
		{"refs/tags/", "", false, false},
		{"refs/pull/42/head", "", false, false},
		{"main", "", false, false},
		{"", "", false, false},
	}

	for _, tc := range cases {
		branch, ok := BranchFromRef(tc.ref)
		if branch != tc.wantBranch || ok != tc.isBranch {
			t.Errorf("BranchFromRef(%q) = (%q, %v); want (%q, %v)", tc.ref, branch, ok, tc.wantBranch, tc.isBranch)
		}
		if got := IsBranchRef(tc.ref); got != tc.isBranch {
			t.Errorf("IsBranchRef(%q) = %v; want %v", tc.ref, got, tc.isBranch)
		}
		if got := IsTagRef(tc.ref); got != tc.isTag {
			t.Errorf("IsTagRef(%q) = %v; want %v", tc.ref, got, tc.isTag)
		}
	}
}

func TestIsZeroSHA(t *testing.T) {
	zero40 := strings.Repeat("0", 40)
	zero64 := strings.Repeat("0", 64)

	if !IsZeroSHA(zero40) {
		t.Errorf("expected 40 zeros to be zero SHA")
	}
	if !IsZeroSHA(zero64) {
		t.Errorf("expected 64 zeros to be zero SHA")
	}

	// Non-zeros
	oneIn40 := strings.Repeat("0", 39) + "1"
	if IsZeroSHA(oneIn40) {
		t.Errorf("expected 40 chars with a '1' to NOT be zero SHA")
	}

	oneIn64 := "a" + strings.Repeat("0", 63)
	if IsZeroSHA(oneIn64) {
		t.Errorf("expected 64 chars with an 'a' to NOT be zero SHA")
	}

	// Wrong lengths
	if IsZeroSHA("") {
		t.Errorf("empty string should NOT be zero SHA")
	}
	if IsZeroSHA(strings.Repeat("0", 39)) {
		t.Errorf("39 zeros should NOT be zero SHA")
	}
	if IsZeroSHA(strings.Repeat("0", 41)) {
		t.Errorf("41 zeros should NOT be zero SHA")
	}
	if IsZeroSHA(strings.Repeat("0", 63)) {
		t.Errorf("63 zeros should NOT be zero SHA")
	}
	if IsZeroSHA(strings.Repeat("0", 65)) {
		t.Errorf("65 zeros should NOT be zero SHA")
	}
}

func TestMinimalPayload(t *testing.T) {
	t.Run("nil event", func(t *testing.T) {
		_, err := MinimalPayload(nil)
		if err == nil {
			t.Fatal("expected error for nil event, got nil")
		}
	})

	t.Run("push event contains required fields and excludes sensitive fields", func(t *testing.T) {
		ev := &Event{
			Kind:           KindPush,
			EventType:      "push",
			DeliveryID:     "deliv-12345",
			InstallationID: 101,
			RepositoryID:   202,
			Push: &Push{
				Ref:           "refs/heads/feature/oauth",
				Branch:        "feature/oauth",
				Before:        "0123456789abcdef0123456789abcdef01234567",
				After:         "fedcba9876543210fedcba9876543210fedcba98",
				HeadCommitSHA: "fedcba9876543210fedcba9876543210fedcba98",
				Deleted:       false,
				Created:       false,
				Forced:        false,
				CommitCount:   2,
				Repository: Repository{
					ID:            202,
					OwnerLogin:    "summit-org",
					Name:          "api-gateway",
					FullName:      "summit-org/api-gateway",
					DefaultBranch: "main",
					Private:       true,
				},
				Sender: Sender{
					ID:    303,
					Login: "deploy-bot",
					Type:  "User",
				},
			},
		}

		raw, err := MinimalPayload(ev)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		rawStr := string(raw)

		// Assert exclusion of sensitive sender fields (no email)
		if strings.Contains(strings.ToLower(rawStr), "email") {
			t.Fatalf("MinimalPayload must NOT contain any email fields: %s", rawStr)
		}

		// Assert exclusion of raw payload
		if strings.Contains(strings.ToLower(rawStr), "raw_payload") {
			t.Fatalf("MinimalPayload must NOT contain raw_payload: %s", rawStr)
		}

		// Assert it parses as valid JSON
		var unmarshaled map[string]interface{}
		if err := json.Unmarshal(raw, &unmarshaled); err != nil {
			t.Fatalf("expected valid JSON: %v", err)
		}

		// Assert required IDs, branch, and SHA are present
		if int64(unmarshaled["installation_id"].(float64)) != 101 {
			t.Errorf("expected installation_id 101, got %v", unmarshaled["installation_id"])
		}
		if int64(unmarshaled["repository_id"].(float64)) != 202 {
			t.Errorf("expected repository_id 202, got %v", unmarshaled["repository_id"])
		}

		pushMap, ok := unmarshaled["push"].(map[string]interface{})
		if !ok {
			t.Fatalf("expected push object in minimal payload")
		}

		if pushMap["branch"] != "feature/oauth" {
			t.Errorf("expected branch feature/oauth, got %v", pushMap["branch"])
		}
		if pushMap["head_commit_sha"] != "fedcba9876543210fedcba9876543210fedcba98" {
			t.Errorf("expected head_commit_sha, got %v", pushMap["head_commit_sha"])
		}
		if pushMap["after"] != "fedcba9876543210fedcba9876543210fedcba98" {
			t.Errorf("expected after SHA, got %v", pushMap["after"])
		}
	})

	t.Run("populates missing top-level IDs from nested push repository and installation", func(t *testing.T) {
		ev := &Event{
			Kind:      KindPush,
			EventType: "push",
			Push: &Push{
				Repository: Repository{
					ID: 999,
				},
			},
			Installation: &InstallationChange{
				InstallationID: 888,
			},
		}

		raw, err := MinimalPayload(ev)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var m map[string]interface{}
		if err := json.Unmarshal(raw, &m); err != nil {
			t.Fatalf("json unmarshal failed: %v", err)
		}

		if int64(m["repository_id"].(float64)) != 999 {
			t.Errorf("expected repository_id 999, got %v", m["repository_id"])
		}
		if int64(m["installation_id"].(float64)) != 888 {
			t.Errorf("expected installation_id 888, got %v", m["installation_id"])
		}
	})

	t.Run("populates missing top-level IDs from RepositoriesChange", func(t *testing.T) {
		ev := &Event{
			Kind:      KindInstallationRepositories,
			EventType: "installation_repositories",
			Repositories: &RepositoriesChange{
				InstallationID: 777,
			},
		}

		raw, err := MinimalPayload(ev)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var m map[string]interface{}
		if err := json.Unmarshal(raw, &m); err != nil {
			t.Fatalf("json unmarshal failed: %v", err)
		}

		if int64(m["installation_id"].(float64)) != 777 {
			t.Errorf("expected installation_id 777, got %v", m["installation_id"])
		}
	})
}

func TestUnsupportedError_Error(t *testing.T) {
	errWithReason := &UnsupportedError{
		EventType: "gollum",
		Reason:    "wiki events not supported",
	}
	if !strings.Contains(errWithReason.Error(), "wiki events not supported") {
		t.Errorf("unexpected error string: %s", errWithReason.Error())
	}

	errNoReason := &UnsupportedError{
		EventType: "gollum",
	}
	if !strings.Contains(errNoReason.Error(), `unsupported event "gollum"`) {
		t.Errorf("unexpected error string: %s", errNoReason.Error())
	}
}
