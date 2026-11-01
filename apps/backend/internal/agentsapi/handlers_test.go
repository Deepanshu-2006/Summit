package agentsapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/summit/backend/internal/agentsapi"
	"github.com/summit/backend/internal/auth"
	"github.com/summit/backend/internal/platformdb"
	"github.com/summit/backend/internal/testutil"
)

type staticVerifier struct{ principals map[string]auth.Principal }

func (v *staticVerifier) Verify(_ context.Context, token string) (auth.Principal, error) {
	p, ok := v.principals[token]
	if !ok {
		return auth.Principal{}, fmt.Errorf("invalid token")
	}
	return p, nil
}

type httpFixture struct {
	pool  *pgxpool.Pool
	store *platformdb.Store
	mux   *http.ServeMux
	uA    testutil.User
	uB    testutil.User
	pA    testutil.Project
	eA    testutil.Environment
}

const (
	tokenA = "user-a-token"
	tokenB = "user-b-token"
)

func setupHTTP(t *testing.T) *httpFixture {
	t.Helper()
	pool := testutil.NewDB(t)
	uA := testutil.SeedUser(t, pool, "http-a@example.com", "HTTP User A")
	uB := testutil.SeedUser(t, pool, "http-b@example.com", "HTTP User B")

	pA := testutil.SeedProject(t, pool, uA.ID, "HTTP Proj A", "http-proj-a")
	eA := testutil.SeedEnvironment(t, pool, pA.ID, "production", "production")

	verifier := &staticVerifier{principals: map[string]auth.Principal{
		tokenA: {UserID: uA.ID, Email: uA.Email, Name: uA.Name},
		tokenB: {UserID: uB.ID, Email: uB.Email, Name: uB.Name},
	}}

	store := platformdb.New(pool)
	mux := http.NewServeMux()
	handler := agentsapi.NewHandler(agentsapi.NewService(store), verifier, pool, nil)
	handler.RegisterRoutes(mux)

	return &httpFixture{
		pool:  pool,
		store: store,
		mux:   mux,
		uA:    uA,
		uB:    uB,
		pA:    pA,
		eA:    eA,
	}
}

func (f *httpFixture) request(t *testing.T, method, path, token string, headers map[string]string, body any) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	var rd *bytes.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		rd = bytes.NewReader(raw)
	} else {
		rd = bytes.NewReader(nil)
	}

	req := httptest.NewRequest(method, path, rd)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	rec := httptest.NewRecorder()
	f.mux.ServeHTTP(rec, req)

	var out map[string]any
	if rec.Body.Len() > 0 {
		_ = json.Unmarshal(rec.Body.Bytes(), &out)
	}
	return rec, out
}

func TestHandlers_LifecycleAndIdempotency(t *testing.T) {
	f := setupHTTP(t)

	// 1. Unauthenticated request -> 401
	rec, _ := f.request(t, "POST", "/api/v1/projects/http-proj-a/agents", "", nil, nil)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized without token, got %d", rec.Code)
	}

	// 2. Missing Idempotency-Key header -> 400
	rec, _ = f.request(t, "POST", "/api/v1/projects/http-proj-a/agents", tokenA, nil, agentsapi.CreateAgentRequest{
		Name:         "MyAgent",
		Model:        "gpt-4o",
		Instructions: "Assist",
	})
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request for missing Idempotency-Key, got %d", rec.Code)
	}

	// 3. Create Agent -> 201 Created
	headers := map[string]string{"Idempotency-Key": "key-http-agent-1"}
	createReq := agentsapi.CreateAgentRequest{
		Name:         "MyAgent",
		Description:  nil,
		Model:        "gpt-4o",
		Instructions: "You are an agent",
		Tools:        []string{"read_file"},
	}
	rec, body := f.request(t, "POST", "/api/v1/projects/http-proj-a/agents", tokenA, headers, createReq)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d (body: %s)", rec.Code, rec.Body.String())
	}
	agentIDStr, ok := body["id"].(string)
	if !ok || agentIDStr == "" {
		t.Fatalf("missing agent id in response: %+v", body)
	}
	agentID := uuid.MustParse(agentIDStr)

	// 4. Idempotent Replay -> 200 OK
	rec, bodyReplay := f.request(t, "POST", "/api/v1/projects/http-proj-a/agents", tokenA, headers, createReq)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 OK on replay, got %d", rec.Code)
	}
	if bodyReplay["id"] != agentIDStr {
		t.Errorf("expected same agent ID on replay")
	}

	// 5. Conflict with different payload -> 409 Conflict
	diffReq := createReq
	diffReq.Name = "MyAgentChanged"
	rec, _ = f.request(t, "POST", "/api/v1/projects/http-proj-a/agents", tokenA, headers, diffReq)
	if rec.Code != http.StatusConflict {
		t.Errorf("expected 409 Conflict on changed payload, got %d", rec.Code)
	}

	// 6. List Agents -> 200 OK
	rec, listBody := f.request(t, "GET", "/api/v1/projects/http-proj-a/agents", tokenA, nil, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on list agents, got %d", rec.Code)
	}
	data, ok := listBody["data"].([]any)
	if !ok || len(data) == 0 {
		t.Fatalf("expected non-empty data in list agents response, got %+v", listBody)
	}

	// 7. Get Agent -> 200 OK
	rec, getBody := f.request(t, "GET", "/api/v1/agents/"+agentID.String(), tokenA, nil, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on get agent, got %d", rec.Code)
	}
	if getBody["id"] != agentIDStr {
		t.Errorf("expected agent ID %s, got %+v", agentIDStr, getBody["id"])
	}
	if rev, ok := getBody["current_revision"].(map[string]any); ok {
		for _, internal := range []string{"idempotency_key", "request_hash", "created_by_user_id"} {
			if _, exists := rev[internal]; exists {
				t.Errorf("public revision response leaked internal field %q", internal)
			}
		}
	}

	// 8. Create Revision -> 201 Created
	revHeaders := map[string]string{"Idempotency-Key": "key-http-rev-1"}
	revReq := agentsapi.CreateRevisionRequest{
		Model:        "gpt-4o-mini",
		Instructions: "Updated instructions",
	}
	rec, revBody := f.request(t, "POST", "/api/v1/agents/"+agentID.String()+"/revisions", tokenA, revHeaders, revReq)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created on revision, got %d (body: %s)", rec.Code, rec.Body.String())
	}
	revIDStr := revBody["id"].(string)
	revID := uuid.MustParse(revIDStr)

	// 9. List Revisions -> 200 OK
	rec, revListBody := f.request(t, "GET", "/api/v1/agents/"+agentID.String()+"/revisions", tokenA, nil, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on list revisions, got %d", rec.Code)
	}
	revs, ok := revListBody["data"].([]any)
	if !ok || len(revs) != 2 {
		t.Fatalf("expected 2 revisions, got %+v", revListBody)
	}

	// 10. Create Deployment -> 202 Accepted + Location header
	depHeaders := map[string]string{"Idempotency-Key": "key-http-dep-1"}
	depReq := agentsapi.CreateDeploymentRequest{
		EnvironmentID:   f.eA.ID,
		AgentRevisionID: revID,
	}
	rec, depBody := f.request(t, "POST", "/api/v1/agents/"+agentID.String()+"/deployments", tokenA, depHeaders, depReq)
	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected 202 Accepted on deployment, got %d (body: %s)", rec.Code, rec.Body.String())
	}
	depIDStr := depBody["id"].(string)
	depID := uuid.MustParse(depIDStr)
	expectedLoc := "/api/v1/agent-deployments/" + depID.String()
	if rec.Header().Get("Location") != expectedLoc {
		t.Errorf("expected Location %q, got %q", expectedLoc, rec.Header().Get("Location"))
	}
	if depBody["status"] != "provisioning" {
		t.Errorf("expected status provisioning, got %v", depBody["status"])
	}
	for _, internal := range []string{"idempotency_key", "request_hash", "delete_requested_at", "purge_after"} {
		if _, exists := depBody[internal]; exists {
			t.Errorf("public deployment response leaked internal field %q", internal)
		}
	}

	// Deployment listing returns one public row and omits internal request keys.
	rec, listDepBody := f.request(t, "GET", "/api/v1/agents/"+agentID.String()+"/deployments", tokenA, nil, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on list deployments, got %d", rec.Code)
	}
	deployments, ok := listDepBody["data"].([]any)
	if !ok || len(deployments) != 1 {
		t.Fatalf("expected one deployment in list response, got %+v", listDepBody)
	}
	listedDeployment := deployments[0].(map[string]any)
	if _, exists := listedDeployment["idempotency_key"]; exists {
		t.Error("deployment list response exposed idempotency_key")
	}

	// 11. Get Deployment -> 200 OK
	rec, getDepBody := f.request(t, "GET", "/api/v1/agent-deployments/"+depID.String(), tokenA, nil, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on get deployment, got %d", rec.Code)
	}
	if getDepBody["id"] != depIDStr {
		t.Errorf("expected deployment ID %s, got %v", depIDStr, getDepBody["id"])
	}

	// 12. Create Session -> 202 Accepted + Location header
	sessHeaders := map[string]string{"Idempotency-Key": "key-http-sess-1"}
	sessReq := agentsapi.CreateSessionRequest{}
	rec, sessBody := f.request(t, "POST", "/api/v1/agent-deployments/"+depID.String()+"/sessions", tokenA, sessHeaders, sessReq)
	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected 202 Accepted on session, got %d (body: %s)", rec.Code, rec.Body.String())
	}
	sessIDStr := sessBody["id"].(string)
	sessID := uuid.MustParse(sessIDStr)
	expectedSessLoc := "/api/v1/agent-sessions/" + sessID.String()
	if rec.Header().Get("Location") != expectedSessLoc {
		t.Errorf("expected Location %q, got %q", expectedSessLoc, rec.Header().Get("Location"))
	}
	if sessBody["status"] != "provisioning" {
		t.Errorf("expected session status provisioning, got %v", sessBody["status"])
	}
	if _, exists := sessBody["pi_conversation_id"]; exists {
		t.Error("session creation must not return a Pi conversation ID before runtime assignment")
	}
	for _, internal := range []string{"idempotency_key", "request_hash", "created_by_user_id", "delete_requested_at", "purge_after"} {
		if _, exists := sessBody[internal]; exists {
			t.Errorf("public session response leaked internal field %q", internal)
		}
	}

	// 13. Get Session -> 200 OK
	rec, getSessBody := f.request(t, "GET", "/api/v1/agent-sessions/"+sessID.String(), tokenA, nil, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on get session, got %d", rec.Code)
	}
	if getSessBody["id"] != sessIDStr {
		t.Errorf("expected session ID %s, got %v", sessIDStr, getSessBody["id"])
	}

	// 14. List Sessions -> 200 OK
	rec, sessListBody := f.request(t, "GET", "/api/v1/agent-deployments/"+depID.String()+"/sessions", tokenA, nil, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on list sessions, got %d", rec.Code)
	}
	sessions, ok := sessListBody["data"].([]any)
	if !ok || len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %+v", sessListBody)
	}

	// 15. Cross-user isolation: User B gets 404 on User A's resources
	rec, _ = f.request(t, "GET", "/api/v1/agents/"+agentID.String(), tokenB, nil, nil)
	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404 Not Found for User B accessing User A agent, got %d", rec.Code)
	}
	rec, _ = f.request(t, "GET", "/api/v1/agent-deployments/"+depID.String(), tokenB, nil, nil)
	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404 Not Found for User B accessing User A deployment, got %d", rec.Code)
	}
	rec, _ = f.request(t, "GET", "/api/v1/agent-sessions/"+sessID.String(), tokenB, nil, nil)
	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404 Not Found for User B accessing User A session, got %d", rec.Code)
	}

	// 16. Route alias check: /v1/... paths work identically
	rec, aliasBody := f.request(t, "GET", "/v1/agents/"+agentID.String(), tokenA, nil, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on /v1/agents alias, got %d", rec.Code)
	}
	if aliasBody["id"] != agentIDStr {
		t.Errorf("expected matching agent ID on alias route")
	}
}
