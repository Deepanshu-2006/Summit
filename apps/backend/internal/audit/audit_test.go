package audit

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

type mockDBExecutor struct {
	lastQuery string
	lastArgs  []any
}

func (m *mockDBExecutor) Exec(_ context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	m.lastQuery = sql
	m.lastArgs = args
	return pgconn.NewCommandTag("INSERT 0 1"), nil
}

func TestSanitizeMetadata(t *testing.T) {
	input := map[string]any{
		"installation_id": int64(12345),
		"github_token":    "ghs_secrettoken12345",
		"webhook_secret":  "whsec_abcdef",
		"private_key":     "-----BEGIN RSA PRIVATE KEY-----",
		"normal_field":    "safe_value",
		"nested": map[string]any{
			"api_key":     "key-12345",
			"nested_safe": "ok",
			"deep_list":   []any{"val1", map[string]any{"password": "pw"}},
		},
	}

	sanitized := SanitizeMetadata(input)

	if sanitized["github_token"] != "[REDACTED]" {
		t.Errorf("expected github_token to be redacted, got %v", sanitized["github_token"])
	}
	if sanitized["webhook_secret"] != "[REDACTED]" {
		t.Errorf("expected webhook_secret to be redacted, got %v", sanitized["webhook_secret"])
	}
	if sanitized["private_key"] != "[REDACTED]" {
		t.Errorf("expected private_key to be redacted, got %v", sanitized["private_key"])
	}
	if sanitized["normal_field"] != "safe_value" {
		t.Errorf("expected normal_field to be safe_value, got %v", sanitized["normal_field"])
	}

	nested, ok := sanitized["nested"].(map[string]any)
	if !ok {
		t.Fatalf("expected nested map")
	}
	if nested["api_key"] != "[REDACTED]" {
		t.Errorf("expected api_key to be redacted, got %v", nested["api_key"])
	}
	if nested["nested_safe"] != "ok" {
		t.Errorf("expected nested_safe to be ok, got %v", nested["nested_safe"])
	}

	deepSlice, ok := nested["deep_list"].([]any)
	if !ok || len(deepSlice) != 2 {
		t.Fatalf("expected deep_list slice of len 2")
	}
	deepMap, ok := deepSlice[1].(map[string]any)
	if !ok {
		t.Fatalf("expected deep map")
	}
	if deepMap["password"] != "[REDACTED]" {
		t.Errorf("expected nested password to be redacted, got %v", deepMap["password"])
	}
}

func TestPgxWriter_Write(t *testing.T) {
	mockDB := &mockDBExecutor{}
	writer := NewPgxWriter(mockDB)

	userID := uuid.New()
	entityID := uuid.New()

	event := Event{
		UserID:      userID,
		ActorUserID: &userID,
		Action:      ActionSourceConnected,
		EntityType:  "service_source",
		EntityID:    entityID,
		Metadata: map[string]any{
			"branch":       "main",
			"access_token": "secret-token",
		},
		IPAddress: "192.168.1.1",
		UserAgent: "Mozilla/5.0",
		RequestID: "req-123",
		CreatedAt: time.Now().UTC(),
	}

	err := writer.Write(context.Background(), event)
	if err != nil {
		t.Fatalf("unexpected error writing audit log: %v", err)
	}

	if mockDB.lastQuery == "" {
		t.Fatal("expected query to be executed")
	}

	// Verify arguments
	args := mockDB.lastArgs
	if len(args) != 10 {
		t.Fatalf("expected 10 args, got %d", len(args))
	}

	if args[0] != userID {
		t.Errorf("expected userID %v, got %v", userID, args[0])
	}
	if args[1].(*uuid.UUID) == nil || *args[1].(*uuid.UUID) != userID {
		t.Errorf("expected userID %v, got %v", userID, args[1])
	}
	if args[2] != ActionSourceConnected {
		t.Errorf("expected action %s, got %v", ActionSourceConnected, args[2])
	}
	if args[3] != "service_source" {
		t.Errorf("expected entity_type service_source, got %v", args[3])
	}
	if args[4] != entityID {
		t.Errorf("expected entityID %v, got %v", entityID, args[4])
	}

	// Metadata JSON check
	metaJSON, ok := args[5].([]byte)
	if !ok {
		t.Fatalf("expected byte slice for metadata JSON, got %T", args[5])
	}
	var meta map[string]any
	if err := json.Unmarshal(metaJSON, &meta); err != nil {
		t.Fatalf("unmarshaling metadata: %v", err)
	}
	if meta["access_token"] != "[REDACTED]" {
		t.Errorf("expected access_token to be redacted, got %v", meta["access_token"])
	}
	if meta["branch"] != "main" {
		t.Errorf("expected branch to be main, got %v", meta["branch"])
	}

	if args[6] != "192.168.1.1" {
		t.Errorf("expected ip 192.168.1.1, got %v", args[6])
	}
}

func TestPgxWriter_EmptyIPBecomesNil(t *testing.T) {
	mockDB := &mockDBExecutor{}
	writer := NewPgxWriter(mockDB)

	event := Event{
		UserID:      uuid.New(),
		ActorUserID: nil, // system event
		Action:      ActionDeploymentWebhookCreated,
		EntityType:  "deployment",
		EntityID:    uuid.New(),
		IPAddress:   "  ", // whitespace only
	}

	err := writer.Write(context.Background(), event)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if mockDB.lastArgs[6] != nil {
		t.Errorf("expected empty IP to become nil, got %v", mockDB.lastArgs[6])
	}
	if actorPtr, ok := mockDB.lastArgs[1].(*uuid.UUID); !ok || actorPtr != nil {
		t.Errorf("expected nil actor pointer for system event, got %v", mockDB.lastArgs[1])
	}
}
