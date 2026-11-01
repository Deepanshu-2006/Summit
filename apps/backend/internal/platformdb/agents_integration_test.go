package platformdb_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/summit/backend/internal/platformdb"
	"github.com/summit/backend/internal/testutil"
)

type agentsFixture struct {
	pool  *pgxpool.Pool
	store *platformdb.Store
	ctx   context.Context
	userA testutil.User
	userB testutil.User
	projA testutil.Project
	projB testutil.Project
	envA1 testutil.Environment
	envA2 testutil.Environment
	envB  testutil.Environment
}

func setupAgentsFixture(t *testing.T) *agentsFixture {
	t.Helper()
	pool := testutil.NewDB(t)
	store := platformdb.New(pool)
	ctx := context.Background()

	uA := testutil.SeedUser(t, pool, "user-a@example.com", "User A")
	uB := testutil.SeedUser(t, pool, "user-b@example.com", "User B")

	pA := testutil.SeedProject(t, pool, uA.ID, "Project A", "project-a")
	pB := testutil.SeedProject(t, pool, uB.ID, "Project B", "project-b")

	eA1 := testutil.SeedEnvironment(t, pool, pA.ID, "production", "production")
	eA2 := testutil.SeedEnvironment(t, pool, pA.ID, "staging", "staging")
	eB := testutil.SeedEnvironment(t, pool, pB.ID, "production", "production")

	return &agentsFixture{
		pool:  pool,
		store: store,
		ctx:   ctx,
		userA: uA,
		userB: uB,
		projA: pA,
		projB: pB,
		envA1: eA1,
		envA2: eA2,
		envB:  eB,
	}
}

func TestAgents_CreateAndIdempotentReplay(t *testing.T) {
	f := setupAgentsFixture(t)

	cfg := platformdb.AgentConfig{
		Model:        "gpt-4o",
		Instructions: "You are a helpful coding assistant.",
		Tools:        []string{"read_file", "search"},
	}

	key := "agent-create-key-1"
	hash := "hash-1111111111111111111111111111111111111111111111111111111111111111"

	// 1. Initial creation
	res1, err := f.store.CreateAgentWithInitialRevision(f.ctx, platformdb.CreateAgentParams{
		UserID:         f.userA.ID,
		ProjectID:      f.projA.ID,
		Name:           "Dev Agent",
		IdempotencyKey: key,
		RequestHash:    hash,
		Config:         cfg,
		ConfigHash:     "config-hash-1",
	})
	if err != nil {
		t.Fatalf("CreateAgentWithInitialRevision failed: %v", err)
	}
	if !res1.Created {
		t.Fatal("expected res1.Created to be true")
	}
	if res1.Agent.Name != "Dev Agent" {
		t.Errorf("expected name 'Dev Agent', got %q", res1.Agent.Name)
	}
	if res1.Agent.CurrentRevisionID == nil || *res1.Agent.CurrentRevisionID != res1.Revision.ID {
		t.Errorf("expected current_revision_id to match initial revision %s", res1.Revision.ID)
	}
	if res1.Revision.RevisionNumber != 1 {
		t.Errorf("expected revision_number 1, got %d", res1.Revision.RevisionNumber)
	}

	// 2. Idempotent replay: same key + same hash -> returns existing with Created=false
	res2, err := f.store.CreateAgentWithInitialRevision(f.ctx, platformdb.CreateAgentParams{
		UserID:         f.userA.ID,
		ProjectID:      f.projA.ID,
		Name:           "Dev Agent",
		IdempotencyKey: key,
		RequestHash:    hash,
		Config:         cfg,
		ConfigHash:     "config-hash-1",
	})
	if err != nil {
		t.Fatalf("replay with same key and hash failed: %v", err)
	}
	if res2.Created {
		t.Fatal("expected res2.Created to be false on replay")
	}
	if res2.Agent.ID != res1.Agent.ID {
		t.Errorf("expected agent ID %s, got %s", res1.Agent.ID, res2.Agent.ID)
	}
	if res2.Revision.ID != res1.Revision.ID {
		t.Errorf("expected revision ID %s, got %s", res1.Revision.ID, res2.Revision.ID)
	}

	// 3. Changed-payload conflict: same key + DIFFERENT hash -> returns ErrConflict
	diffHash := "hash-2222222222222222222222222222222222222222222222222222222222222222"
	_, err = f.store.CreateAgentWithInitialRevision(f.ctx, platformdb.CreateAgentParams{
		UserID:         f.userA.ID,
		ProjectID:      f.projA.ID,
		Name:           "Dev Agent Modified",
		IdempotencyKey: key,
		RequestHash:    diffHash,
		Config:         cfg,
		ConfigHash:     "config-hash-1",
	})
	if !errors.Is(err, platformdb.ErrConflict) {
		t.Fatalf("expected ErrConflict on changed payload, got %v", err)
	}

	// 4. Duplicate name conflict in same project
	_, err = f.store.CreateAgentWithInitialRevision(f.ctx, platformdb.CreateAgentParams{
		UserID:         f.userA.ID,
		ProjectID:      f.projA.ID,
		Name:           "Dev Agent",
		IdempotencyKey: "different-key",
		RequestHash:    "some-other-hash",
		Config:         cfg,
		ConfigHash:     "config-hash-1",
	})
	if !errors.Is(err, platformdb.ErrConflict) {
		t.Fatalf("expected ErrConflict on duplicate name in same project, got %v", err)
	}

	// 5. Same name in different project succeeds
	resOtherProj, err := f.store.CreateAgentWithInitialRevision(f.ctx, platformdb.CreateAgentParams{
		UserID:         f.userB.ID,
		ProjectID:      f.projB.ID,
		Name:           "Dev Agent",
		IdempotencyKey: "different-key",
		RequestHash:    "some-other-hash",
		Config:         cfg,
		ConfigHash:     "config-hash-1",
	})
	if err != nil {
		t.Fatalf("expected create in different project to succeed, got %v", err)
	}
	if !resOtherProj.Created {
		t.Fatal("expected resOtherProj.Created to be true")
	}
}

func TestAgents_OwnershipIsolation(t *testing.T) {
	f := setupAgentsFixture(t)

	cfg := platformdb.AgentConfig{
		Model:        "gemini-1.5-pro",
		Instructions: "User A agent",
	}

	// User A creates agent
	resA, err := f.store.CreateAgentWithInitialRevision(f.ctx, platformdb.CreateAgentParams{
		UserID:         f.userA.ID,
		ProjectID:      f.projA.ID,
		Name:           "Agent A",
		IdempotencyKey: "key-a",
		RequestHash:    "hash-a",
		Config:         cfg,
		ConfigHash:     "cfghash-a",
	})
	if err != nil {
		t.Fatalf("creating agent A: %v", err)
	}

	// User A deploys agent
	depA, created, err := f.store.CreateAgentDeployment(f.ctx, platformdb.CreateAgentDeploymentParams{
		UserID:          f.userA.ID,
		AgentID:         resA.Agent.ID,
		EnvironmentID:   f.envA1.ID,
		AgentRevisionID: resA.Revision.ID,
		RuntimeVersion:  "v1",
		IdempotencyKey:  "dep-key-a",
		RequestHash:     "dep-hash-a",
	})
	if err != nil || !created {
		t.Fatalf("creating deployment A: %v", err)
	}

	// User A creates session
	sessA, created, err := f.store.CreateAgentSession(f.ctx, platformdb.CreateAgentSessionParams{
		UserID:         f.userA.ID,
		DeploymentID:   depA.ID,
		IdempotencyKey: "sess-key-a",
		RequestHash:    "sess-hash-a",
	})
	if err != nil || !created {
		t.Fatalf("creating session A: %v", err)
	}

	// --- Cross-user access by User B MUST return ErrNotFound ---

	// User B tries to GET User A's agent
	if _, err := f.store.GetAgentForUser(f.ctx, f.userB.ID, resA.Agent.ID); !errors.Is(err, platformdb.ErrNotFound) {
		t.Errorf("GetAgentForUser by other user: expected ErrNotFound, got %v", err)
	}

	// User B tries to LIST agents in User A's project
	if _, err := f.store.ListAgentsForProject(f.ctx, f.userB.ID, f.projA.ID, platformdb.ListParams{}); !errors.Is(err, platformdb.ErrNotFound) {
		t.Errorf("ListAgentsForProject in other user's project: expected ErrNotFound, got %v", err)
	}

	// User B tries to create revision on User A's agent
	if _, _, err := f.store.CreateAgentRevision(f.ctx, platformdb.CreateRevisionParams{
		UserID:         f.userB.ID,
		AgentID:        resA.Agent.ID,
		IdempotencyKey: "rev-hack",
		RequestHash:    "hash-hack",
		Config:         cfg,
		ConfigHash:     "cfghash-hack",
	}); !errors.Is(err, platformdb.ErrNotFound) {
		t.Errorf("CreateAgentRevision on other user's agent: expected ErrNotFound, got %v", err)
	}

	// User B tries to create deployment on User A's agent
	if _, _, err := f.store.CreateAgentDeployment(f.ctx, platformdb.CreateAgentDeploymentParams{
		UserID:          f.userB.ID,
		AgentID:         resA.Agent.ID,
		EnvironmentID:   f.envB.ID,
		AgentRevisionID: resA.Revision.ID,
		RuntimeVersion:  "v1",
		IdempotencyKey:  "dep-hack",
		RequestHash:     "hash-hack",
	}); !errors.Is(err, platformdb.ErrNotFound) {
		t.Errorf("CreateAgentDeployment on other user's agent: expected ErrNotFound, got %v", err)
	}

	// User B tries to GET User A's deployment
	if _, err := f.store.GetAgentDeploymentForUser(f.ctx, f.userB.ID, depA.ID); !errors.Is(err, platformdb.ErrNotFound) {
		t.Errorf("GetAgentDeploymentForUser on other user's deployment: expected ErrNotFound, got %v", err)
	}

	// User B tries to create session on User A's deployment
	if _, _, err := f.store.CreateAgentSession(f.ctx, platformdb.CreateAgentSessionParams{
		UserID:         f.userB.ID,
		DeploymentID:   depA.ID,
		IdempotencyKey: "sess-hack",
		RequestHash:    "hash-hack",
	}); !errors.Is(err, platformdb.ErrNotFound) {
		t.Errorf("CreateAgentSession on other user's deployment: expected ErrNotFound, got %v", err)
	}

	// User B tries to GET User A's session
	if _, err := f.store.GetAgentSessionForUser(f.ctx, f.userB.ID, sessA.ID); !errors.Is(err, platformdb.ErrNotFound) {
		t.Errorf("GetAgentSessionForUser on other user's session: expected ErrNotFound, got %v", err)
	}
}

func TestAgents_ImmutableRevisionPinning(t *testing.T) {
	f := setupAgentsFixture(t)

	cfg1 := platformdb.AgentConfig{
		Model:        "gpt-4o",
		Instructions: "Revision 1 instructions",
	}

	res, err := f.store.CreateAgentWithInitialRevision(f.ctx, platformdb.CreateAgentParams{
		UserID:         f.userA.ID,
		ProjectID:      f.projA.ID,
		Name:           "Pinned Agent",
		IdempotencyKey: "pinned-create-key",
		RequestHash:    "hash-rev1",
		Config:         cfg1,
		ConfigHash:     "cfghash-1",
	})
	if err != nil {
		t.Fatalf("creating agent: %v", err)
	}

	rev1 := res.Revision

	// Deploy revision 1
	dep, created, err := f.store.CreateAgentDeployment(f.ctx, platformdb.CreateAgentDeploymentParams{
		UserID:          f.userA.ID,
		AgentID:         res.Agent.ID,
		EnvironmentID:   f.envA1.ID,
		AgentRevisionID: rev1.ID,
		RuntimeVersion:  "v1",
		IdempotencyKey:  "pinned-dep-key",
		RequestHash:     "dep-hash-1",
	})
	if err != nil || !created {
		t.Fatalf("creating deployment: %v", err)
	}
	if dep.AgentRevisionID != rev1.ID {
		t.Fatalf("expected deployment pinned to rev1 %s, got %s", rev1.ID, dep.AgentRevisionID)
	}

	// Create revision 2
	cfg2 := platformdb.AgentConfig{
		Model:        "gpt-4o-mini",
		Instructions: "Revision 2 updated instructions",
	}
	rev2Key := "rev2-key"
	rev2Hash := "rev2-hash"
	rev2, created, err := f.store.CreateAgentRevision(f.ctx, platformdb.CreateRevisionParams{
		UserID:         f.userA.ID,
		AgentID:        res.Agent.ID,
		IdempotencyKey: rev2Key,
		RequestHash:    rev2Hash,
		Config:         cfg2,
		ConfigHash:     "cfghash-2",
	})
	if err != nil || !created {
		t.Fatalf("creating revision 2: %v", err)
	}
	if rev2.RevisionNumber != 2 {
		t.Errorf("expected revision number 2, got %d", rev2.RevisionNumber)
	}

	// Idempotent replay of revision 2
	rev2Replay, created, err := f.store.CreateAgentRevision(f.ctx, platformdb.CreateRevisionParams{
		UserID:         f.userA.ID,
		AgentID:        res.Agent.ID,
		IdempotencyKey: rev2Key,
		RequestHash:    rev2Hash,
		Config:         cfg2,
		ConfigHash:     "cfghash-2",
	})
	if err != nil {
		t.Fatalf("replaying revision 2: %v", err)
	}
	if created {
		t.Fatal("expected created=false on replay")
	}
	if rev2Replay.ID != rev2.ID {
		t.Errorf("expected same revision ID on replay")
	}

	// Revision conflict on changed hash
	_, _, err = f.store.CreateAgentRevision(f.ctx, platformdb.CreateRevisionParams{
		UserID:         f.userA.ID,
		AgentID:        res.Agent.ID,
		IdempotencyKey: rev2Key,
		RequestHash:    "rev2-diff-hash",
		Config:         cfg2,
		ConfigHash:     "cfghash-2",
	})
	if !errors.Is(err, platformdb.ErrConflict) {
		t.Fatalf("expected ErrConflict on revision changed hash, got %v", err)
	}

	// CRITICAL PINNING CHECK: Fetch deployment 1 again. It MUST still be pinned to revision 1!
	depCheck, err := f.store.GetAgentDeploymentForUser(f.ctx, f.userA.ID, dep.ID)
	if err != nil {
		t.Fatalf("fetching deployment: %v", err)
	}
	if depCheck.AgentRevisionID != rev1.ID {
		t.Fatalf("IMMUTABILITY VIOLATION: deployment revision changed from %s to %s", rev1.ID, depCheck.AgentRevisionID)
	}

	// List revisions check: returns both revisions newest first
	revList, err := f.store.ListAgentRevisions(f.ctx, f.userA.ID, res.Agent.ID)
	if err != nil {
		t.Fatalf("listing revisions: %v", err)
	}
	if len(revList) != 2 {
		t.Fatalf("expected 2 revisions, got %d", len(revList))
	}
	if revList[0].RevisionNumber != 2 || revList[1].RevisionNumber != 1 {
		t.Errorf("expected revisions [2, 1], got [%d, %d]", revList[0].RevisionNumber, revList[1].RevisionNumber)
	}
}

func TestAgents_InvalidEnvironmentAndRevisionRelationships(t *testing.T) {
	f := setupAgentsFixture(t)

	cfg := platformdb.AgentConfig{Model: "gpt-4o", Instructions: "test"}

	// Project A Agent
	resA, err := f.store.CreateAgentWithInitialRevision(f.ctx, platformdb.CreateAgentParams{
		UserID:         f.userA.ID,
		ProjectID:      f.projA.ID,
		Name:           "Agent Project A",
		IdempotencyKey: "key-a-rel",
		RequestHash:    "hash-a-rel",
		Config:         cfg,
		ConfigHash:     "cfghash-a-rel",
	})
	if err != nil {
		t.Fatalf("create agent A: %v", err)
	}

	// Project B Agent
	resB, err := f.store.CreateAgentWithInitialRevision(f.ctx, platformdb.CreateAgentParams{
		UserID:         f.userB.ID,
		ProjectID:      f.projB.ID,
		Name:           "Agent Project B",
		IdempotencyKey: "key-b-rel",
		RequestHash:    "hash-b-rel",
		Config:         cfg,
		ConfigHash:     "cfghash-b-rel",
	})
	if err != nil {
		t.Fatalf("create agent B: %v", err)
	}

	// Case 1: Deploy Agent A to Environment B (belongs to Project B, not Project A)
	_, _, err = f.store.CreateAgentDeployment(f.ctx, platformdb.CreateAgentDeploymentParams{
		UserID:          f.userA.ID,
		AgentID:         resA.Agent.ID,
		EnvironmentID:   f.envB.ID, // WRONG PROJECT ENVIRONMENT
		AgentRevisionID: resA.Revision.ID,
		RuntimeVersion:  "v1",
		IdempotencyKey:  "dep-inv-env",
		RequestHash:     "hash-inv-env",
	})
	if !errors.Is(err, platformdb.ErrInvalidArgument) && !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("expected ErrInvalidArgument or ErrNotFound for cross-project environment, got %v", err)
	}

	// Case 2: Deploy Agent A with Revision B (belongs to Agent B, not Agent A)
	_, _, err = f.store.CreateAgentDeployment(f.ctx, platformdb.CreateAgentDeploymentParams{
		UserID:          f.userA.ID,
		AgentID:         resA.Agent.ID,
		EnvironmentID:   f.envA1.ID,
		AgentRevisionID: resB.Revision.ID, // WRONG AGENT REVISION
		RuntimeVersion:  "v1",
		IdempotencyKey:  "dep-inv-rev",
		RequestHash:     "hash-inv-rev",
	})
	if !errors.Is(err, platformdb.ErrInvalidArgument) && !errors.Is(err, platformdb.ErrNotFound) {
		t.Fatalf("expected ErrInvalidArgument or ErrNotFound for cross-agent revision, got %v", err)
	}
}

func TestAgents_TransactionalOutboxCreation(t *testing.T) {
	f := setupAgentsFixture(t)

	cfg := platformdb.AgentConfig{
		Model:        "claude-3-5-sonnet",
		Instructions: "Write safe code.",
		Tools:        []string{"bash", "editor"},
		CredentialReferences: []platformdb.CredentialRefSummary{
			{Name: "MY_API_KEY", SecretReferenceID: uuid.New(), Purpose: "api access"},
		},
	}

	res, err := f.store.CreateAgentWithInitialRevision(f.ctx, platformdb.CreateAgentParams{
		UserID:         f.userA.ID,
		ProjectID:      f.projA.ID,
		Name:           "Outbox Test Agent",
		IdempotencyKey: "outbox-agent-key",
		RequestHash:    "outbox-agent-hash",
		Config:         cfg,
		ConfigHash:     "outbox-cfg-hash",
	})
	if err != nil {
		t.Fatalf("create agent: %v", err)
	}

	// 1. Create deployment -> verify outbox event
	dep, created, err := f.store.CreateAgentDeployment(f.ctx, platformdb.CreateAgentDeploymentParams{
		UserID:          f.userA.ID,
		AgentID:         res.Agent.ID,
		EnvironmentID:   f.envA1.ID,
		AgentRevisionID: res.Revision.ID,
		RuntimeVersion:  "v1",
		IdempotencyKey:  "outbox-dep-key",
		RequestHash:     "outbox-dep-hash",
	})
	if err != nil || !created {
		t.Fatalf("create deployment: %v", err)
	}

	// Query outbox_events for deployment event
	var depAggType, depEventType, depStatus string
	var depPayloadBytes []byte
	err = f.pool.QueryRow(f.ctx, `
		SELECT aggregate_type, event_type, status, payload
		FROM outbox_events
		WHERE aggregate_type = 'agent_deployment' AND aggregate_id = $1`, dep.ID).
		Scan(&depAggType, &depEventType, &depStatus, &depPayloadBytes)
	if err != nil {
		t.Fatalf("failed to find outbox event for deployment: %v", err)
	}
	if depEventType != "agent.deployment.provision.requested" {
		t.Errorf("expected event_type agent.deployment.provision.requested, got %s", depEventType)
	}
	if depStatus != "pending" {
		t.Errorf("expected outbox status pending, got %s", depStatus)
	}

	var depPayloadMap map[string]any
	if err := json.Unmarshal(depPayloadBytes, &depPayloadMap); err != nil {
		t.Fatalf("unmarshal deployment outbox payload: %v", err)
	}
	if depPayloadMap["deployment_id"] != dep.ID.String() {
		t.Errorf("expected deployment_id %s in outbox payload", dep.ID)
	}

	// 2. Create session -> verify outbox event
	sess, created, err := f.store.CreateAgentSession(f.ctx, platformdb.CreateAgentSessionParams{
		UserID:         f.userA.ID,
		DeploymentID:   dep.ID,
		IdempotencyKey: "outbox-sess-key",
		RequestHash:    "outbox-sess-hash",
	})
	if err != nil || !created {
		t.Fatalf("create session: %v", err)
	}

	// Query outbox_events for session event
	var sessAggType, sessEventType, sessStatus string
	var sessPayloadBytes []byte
	err = f.pool.QueryRow(f.ctx, `
		SELECT aggregate_type, event_type, status, payload
		FROM outbox_events
		WHERE aggregate_type = 'agent_session' AND aggregate_id = $1`, sess.ID).
		Scan(&sessAggType, &sessEventType, &sessStatus, &sessPayloadBytes)
	if err != nil {
		t.Fatalf("failed to find outbox event for session: %v", err)
	}
	if sessEventType != "agent.session.ensure.requested" {
		t.Errorf("expected event_type agent.session.ensure.requested, got %s", sessEventType)
	}
	if sessStatus != "pending" {
		t.Errorf("expected outbox status pending, got %s", sessStatus)
	}

	var sessPayloadMap map[string]any
	if err := json.Unmarshal(sessPayloadBytes, &sessPayloadMap); err != nil {
		t.Fatalf("unmarshal session outbox payload: %v", err)
	}
	if sessPayloadMap["session_id"] != sess.ID.String() {
		t.Errorf("expected session_id %s in outbox payload", sess.ID)
	}
	if _, exists := sessPayloadMap["pi_conversation_id"]; exists {
		t.Fatal("session outbox must not invent a runtime-owned Pi conversation ID")
	}
	rawActorKey, ok := sessPayloadMap["actor_key"].([]any)
	if !ok || len(rawActorKey) != 4 {
		t.Fatalf("expected 4-element actor_key in session payload, got %+v", sessPayloadMap["actor_key"])
	}
	if rawActorKey[0] != "summit-agent-v1" || rawActorKey[1] != f.projA.ID.String() ||
		rawActorKey[2] != dep.ID.String() || rawActorKey[3] != sess.ID.String() {
		t.Errorf("unexpected actor key tuple: %+v", rawActorKey)
	}

	// Idempotent session replay
	sessReplay, created, err := f.store.CreateAgentSession(f.ctx, platformdb.CreateAgentSessionParams{
		UserID:         f.userA.ID,
		DeploymentID:   dep.ID,
		IdempotencyKey: "outbox-sess-key",
		RequestHash:    "outbox-sess-hash",
	})
	if err != nil {
		t.Fatalf("replaying session: %v", err)
	}
	if created {
		t.Fatal("expected created=false on session replay")
	}
	if sessReplay.ID != sess.ID {
		t.Errorf("expected same session ID on replay")
	}

	// Session conflict on changed hash
	_, _, err = f.store.CreateAgentSession(f.ctx, platformdb.CreateAgentSessionParams{
		UserID:         f.userA.ID,
		DeploymentID:   dep.ID,
		IdempotencyKey: "outbox-sess-key",
		RequestHash:    "outbox-sess-diff-hash",
	})
	if !errors.Is(err, platformdb.ErrConflict) {
		t.Fatalf("expected ErrConflict on session changed hash, got %v", err)
	}
}

func TestAgents_ConcurrentRevisionAndDeploymentNumbers(t *testing.T) {
	f := setupAgentsFixture(t)
	res, err := f.store.CreateAgentWithInitialRevision(f.ctx, platformdb.CreateAgentParams{
		UserID: f.userA.ID, ProjectID: f.projA.ID, Name: "Concurrent Agent",
		IdempotencyKey: "concurrent-agent", RequestHash: "concurrent-agent-hash",
		Config: platformdb.AgentConfig{Model: "test-model"}, ConfigHash: "config-hash",
	})
	if err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	errCh := make(chan error, 4)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, _, err := f.store.CreateAgentRevision(f.ctx, platformdb.CreateRevisionParams{
				UserID: f.userA.ID, AgentID: res.Agent.ID, IdempotencyKey: fmt.Sprintf("rev-%d", i),
				RequestHash: fmt.Sprintf("rev-hash-%d", i), Config: platformdb.AgentConfig{Model: "test-model"},
				ConfigHash: fmt.Sprintf("config-%d", i),
			})
			errCh <- err
		}(i)
	}
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, _, err := f.store.CreateAgentDeployment(f.ctx, platformdb.CreateAgentDeploymentParams{
				UserID: f.userA.ID, AgentID: res.Agent.ID, EnvironmentID: f.envA1.ID,
				AgentRevisionID: res.Revision.ID, RuntimeVersion: "v1",
				IdempotencyKey: fmt.Sprintf("dep-%d", i), RequestHash: fmt.Sprintf("dep-hash-%d", i),
			})
			errCh <- err
		}(i)
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		if err != nil {
			t.Fatalf("concurrent create failed: %v", err)
		}
	}

	var revisionCount, deploymentCount int
	if err := f.pool.QueryRow(f.ctx, `SELECT count(DISTINCT revision_number) FROM agent_revisions WHERE agent_id = $1`, res.Agent.ID).Scan(&revisionCount); err != nil {
		t.Fatal(err)
	}
	if revisionCount != 3 {
		t.Fatalf("expected unique initial and concurrent revision numbers, got %d", revisionCount)
	}
	if err := f.pool.QueryRow(f.ctx, `SELECT count(DISTINCT deployment_number) FROM agent_deployments WHERE agent_id = $1 AND environment_id = $2`, res.Agent.ID, f.envA1.ID).Scan(&deploymentCount); err != nil {
		t.Fatal(err)
	}
	if deploymentCount != 2 {
		t.Fatalf("expected unique concurrent deployment numbers, got %d", deploymentCount)
	}
}

func TestAgents_ListAcrossEnvironmentsDoesNotDuplicateAgent(t *testing.T) {
	f := setupAgentsFixture(t)
	res, err := f.store.CreateAgentWithInitialRevision(f.ctx, platformdb.CreateAgentParams{
		UserID: f.userA.ID, ProjectID: f.projA.ID, Name: "Multi Environment Agent",
		IdempotencyKey: "multi-env-agent", RequestHash: "multi-env-agent-hash",
		Config: platformdb.AgentConfig{Model: "test-model"}, ConfigHash: "config-hash",
	})
	if err != nil {
		t.Fatal(err)
	}
	for i, envID := range []uuid.UUID{f.envA1.ID, f.envA2.ID} {
		dep, _, err := f.store.CreateAgentDeployment(f.ctx, platformdb.CreateAgentDeploymentParams{
			UserID: f.userA.ID, AgentID: res.Agent.ID, EnvironmentID: envID,
			AgentRevisionID: res.Revision.ID, RuntimeVersion: "v1",
			IdempotencyKey: fmt.Sprintf("env-dep-%d", i), RequestHash: fmt.Sprintf("env-dep-hash-%d", i),
		})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := f.pool.Exec(f.ctx, `UPDATE agent_deployments SET status = 'active' WHERE id = $1`, dep.ID); err != nil {
			t.Fatal(err)
		}
	}
	page, err := f.store.ListAgentsForProject(f.ctx, f.userA.ID, f.projA.ID, platformdb.ListParams{})
	if err != nil {
		t.Fatal(err)
	}
	count := 0
	for _, item := range page.Items {
		if item.ID == res.Agent.ID {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("expected agent once in project listing with active deployments in two environments, got %d", count)
	}
}

func TestOutboxPayloadShapes_NoPlaintextSecretsOrPrompts(t *testing.T) {
	// Verify that AgentDeploymentProvisionPayload and AgentSessionEnsurePayload
	// have the exact required fields and never include prompts or secrets.
	agentID := uuid.New()
	depID := uuid.New()
	projID := uuid.New()
	envID := uuid.New()
	revID := uuid.New()
	sessID := uuid.New()

	depPayload := platformdb.AgentDeploymentProvisionPayload{
		AgentID:         agentID,
		DeploymentID:    depID,
		ProjectID:       projID,
		EnvironmentID:   envID,
		AgentRevisionID: revID,
		RuntimeVersion:  "v1",
		Status:          platformdb.AgentDeploymentProvisioning,
	}

	depBytes, err := platformdb.NewAgentDeploymentProvisionPayload(depPayload)
	if err != nil {
		t.Fatalf("marshaling deployment payload: %v", err)
	}

	var depMap map[string]any
	if err := json.Unmarshal(depBytes, &depMap); err != nil {
		t.Fatalf("unmarshaling deployment payload: %v", err)
	}

	for _, forbidden := range []string{"secret", "prompt", "password", "key_value", "input"} {
		if _, exists := depMap[forbidden]; exists {
			t.Errorf("SECURITY LEAK: deployment payload contains forbidden key %q", forbidden)
		}
	}

	actorKey := []string{"summit-agent-v1", projID.String(), depID.String(), sessID.String()}
	sessPayload := platformdb.AgentSessionEnsurePayload{
		ProjectID:    projID,
		DeploymentID: depID,
		SessionID:    sessID,
		ActorKey:     actorKey,
		Status:       platformdb.AgentSessionProvisioning,
	}

	sessBytes, err := platformdb.NewAgentSessionEnsurePayload(sessPayload)
	if err != nil {
		t.Fatalf("marshaling session payload: %v", err)
	}

	var sessMap map[string]any
	if err := json.Unmarshal(sessBytes, &sessMap); err != nil {
		t.Fatalf("unmarshaling session payload: %v", err)
	}

	for _, forbidden := range []string{"secret", "prompt", "password", "key_value", "input"} {
		if _, exists := sessMap[forbidden]; exists {
			t.Errorf("SECURITY LEAK: session payload contains forbidden key %q", forbidden)
		}
	}
	if _, exists := sessMap["pi_conversation_id"]; exists {
		t.Fatal("session ensure payload must omit the Pi conversation ID until assigned by runtime")
	}

	// Verify actor key structure
	rawActorKey, ok := sessMap["actor_key"].([]any)
	if !ok || len(rawActorKey) != 4 {
		t.Fatalf("expected 4-element actor_key array, got %+v", sessMap["actor_key"])
	}
	if rawActorKey[0] != "summit-agent-v1" || rawActorKey[1] != projID.String() ||
		rawActorKey[2] != depID.String() || rawActorKey[3] != sessID.String() {
		t.Errorf("actor_key tuple mismatch: %+v", rawActorKey)
	}
}
