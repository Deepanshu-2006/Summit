package githubapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/summit/backend/internal/audit"
	"github.com/summit/backend/internal/auth"
	"github.com/summit/backend/internal/config"
	"github.com/summit/backend/internal/githubapi"
	"github.com/summit/backend/internal/githubapp"
	"github.com/summit/backend/internal/installstate"
	"github.com/summit/backend/internal/testutil"
)

type staticVerifier struct {
	principals map[string]auth.Principal
}

func (v *staticVerifier) Verify(ctx context.Context, token string) (auth.Principal, error) {
	p, ok := v.principals[token]
	if !ok {
		return auth.Principal{}, fmt.Errorf("invalid token: %s", token)
	}
	return p, nil
}

type handlerFixture struct {
	pool     *pgxpool.Pool
	mux      *http.ServeMux
	verifier *staticVerifier
	owner    testutil.User
	foreign  testutil.User
	project  testutil.Project
	env      testutil.Environment
	service  testutil.Service
	instUUID uuid.UUID
	repoUUID uuid.UUID
	tokens   map[uuid.UUID]string
	ghClient *mockGitHubClient
}

func setupHandlerFixture(t *testing.T) *handlerFixture {
	pool := testutil.NewDB(t)

	owner := testutil.SeedUser(t, pool, "owner@example.com", "Owner")
	foreign := testutil.SeedUser(t, pool, "foreign@example.com", "Foreign")

	proj := testutil.SeedProject(t, pool, owner.ID, "Handler Proj", "handler-proj")
	env := testutil.SeedEnvironment(t, pool, proj.ID, "production", "production")
	service := testutil.SeedService(t, pool, env.ID, "handler-service", "web")

	// Pre-seed an installation & repository
	var instUUID, repoUUID uuid.UUID
	_ = pool.QueryRow(context.Background(), `
		INSERT INTO github_installations (
			user_id, github_installation_id, account_id, account_login, account_type, status
		) VALUES ($1, 12345, 999, 'test-org', 'Organization', 'active')
		RETURNING id
	`, owner.ID).Scan(&instUUID)

	_ = pool.QueryRow(context.Background(), `
		INSERT INTO github_repositories (
			installation_id, github_repository_id, owner_login, name, full_name, default_branch, private
		) VALUES ($1, 101, 'test-org', 'repo-1', 'test-org/repo-1', 'main', true)
		RETURNING id
	`, instUUID).Scan(&repoUUID)

	tokens := map[uuid.UUID]string{
		owner.ID:   "token-owner",
		foreign.ID: "token-foreign",
	}

	verifier := &staticVerifier{
		principals: map[string]auth.Principal{
			"token-owner":   {UserID: owner.ID, Email: owner.Email, Name: owner.Name},
			"token-foreign": {UserID: foreign.ID, Email: foreign.Email, Name: foreign.Name},
		},
	}

	mockGH := &mockGitHubClient{
		getCommitFunc: func(ctx context.Context, installationID int64, owner, repo, ref string) (githubapp.Commit, error) {
			return githubapp.Commit{
				SHA: "abcdef0123456789abcdef0123456789abcdef01",
				Ref: ref,
			}, nil
		},
	}

	cfg := &config.Config{
		GitHubAppSlug:           "summit-app",
		GitHubStateTTL:          10 * time.Minute,
		PlatformFrontendBaseURL: "http://localhost:3000",
	}

	svc := githubapi.NewService(githubapi.Config{
		Pool:     pool,
		GHClient: mockGH,
		AppCfg:   cfg,
		Audit:    audit.NewPgxWriter(pool),
	})

	handler := githubapi.NewHandler(svc, verifier, pool)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	return &handlerFixture{
		pool:     pool,
		mux:      mux,
		verifier: verifier,
		owner:    owner,
		foreign:  foreign,
		project:  proj,
		env:      env,
		service:  service,
		instUUID: instUUID,
		repoUUID: repoUUID,
		tokens:   tokens,
		ghClient: mockGH,
	}
}

func doRequest(mux *http.ServeMux, method, path, token string, body []byte) *httptest.ResponseRecorder {
	var bodyReader *bytes.Reader
	if body != nil {
		bodyReader = bytes.NewReader(body)
	} else {
		bodyReader = bytes.NewReader([]byte{})
	}
	req := httptest.NewRequest(method, path, bodyReader)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	return rec
}

func TestHandler_StartInstallation(t *testing.T) {
	f := setupHandlerFixture(t)
	path := "/v1/github/installations"

	// 1. Owner can start installation -> 201 Created
	rec := doRequest(f.mux, http.MethodPost, path, f.tokens[f.owner.ID], []byte("{}"))
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for owner, got %d: %s", rec.Code, rec.Body.String())
	}
	var res githubapi.StartInstallationResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &res)
	if res.InstallationURL == "" {
		t.Fatal("expected installation_url")
	}

	// A different personal user can start their own installation flow.
	recForeign := doRequest(f.mux, http.MethodPost, path, f.tokens[f.foreign.ID], []byte("{}"))
	if recForeign.Code != http.StatusCreated {
		t.Fatalf("expected 201 for another personal user, got %d: %s", recForeign.Code, recForeign.Body.String())
	}

	// 5. Unauthenticated -> 401 Unauthorized
	recUnauth := doRequest(f.mux, http.MethodPost, path, "", []byte("{}"))
	if recUnauth.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauth, got %d: %s", recUnauth.Code, recUnauth.Body.String())
	}
}

func TestHandler_Callback(t *testing.T) {
	f := setupHandlerFixture(t)

	// Pre-seed an installation state
	rawState, stateHash, _ := installstate.Generate()
	_, _ = f.pool.Exec(context.Background(),
		"INSERT INTO github_installation_states (id, state_hash, user_id, expires_at) VALUES (gen_random_uuid(), $1, $2, $3)",
		stateHash, f.owner.ID, time.Now().Add(10*time.Minute),
	)

	// Valid callback -> 302 redirect with status=success
	callbackPath := fmt.Sprintf("/v1/integrations/github/callback?installation_id=12345&state=%s&setup_action=install", rawState)
	rec := doRequest(f.mux, http.MethodGet, callbackPath, "", nil)
	if rec.Code != http.StatusFound {
		t.Fatalf("expected 302 Found, got %d: %s", rec.Code, rec.Body.String())
	}
	loc := rec.Header().Get("Location")
	if !containsStr(loc, "status=success") {
		t.Fatalf("expected success redirect location, got %s", loc)
	}

	// Invalid callback (empty state) -> 302 redirect with status=error
	recErr := doRequest(f.mux, http.MethodGet, "/v1/integrations/github/callback?installation_id=12345", "", nil)
	if recErr.Code != http.StatusFound {
		t.Fatalf("expected 302 Found for error redirect, got %d", recErr.Code)
	}
	locErr := recErr.Header().Get("Location")
	if !containsStr(locErr, "status=error") {
		t.Fatalf("expected error redirect location, got %s", locErr)
	}
}

func TestHandler_ListAndGetInstallations(t *testing.T) {
	f := setupHandlerFixture(t)

	listPath := "/v1/github/installations"

	// Owner sees their installation.
	recList := doRequest(f.mux, http.MethodGet, listPath, f.tokens[f.owner.ID], nil)
	if recList.Code != http.StatusOK {
		t.Fatalf("expected 200 for owner, got %d: %s", recList.Code, recList.Body.String())
	}
	var listRes githubapi.ListInstallationsResponse
	_ = json.Unmarshal(recList.Body.Bytes(), &listRes)
	if len(listRes.Data) != 1 {
		t.Fatalf("expected 1 installation, got %d", len(listRes.Data))
	}

	// Another personal user sees only their own empty list.
	recForeign := doRequest(f.mux, http.MethodGet, listPath, f.tokens[f.foreign.ID], nil)
	if recForeign.Code != http.StatusOK {
		t.Fatalf("expected 200 for foreign user's list, got %d", recForeign.Code)
	}
	var foreignList githubapi.ListInstallationsResponse
	_ = json.Unmarshal(recForeign.Body.Bytes(), &foreignList)
	if len(foreignList.Data) != 0 {
		t.Fatalf("expected empty installation list for foreign user, got %d", len(foreignList.Data))
	}

	// Get detail by UUID
	getPath := fmt.Sprintf("/v1/github/installations/%s", f.instUUID)
	recGet := doRequest(f.mux, http.MethodGet, getPath, f.tokens[f.owner.ID], nil)
	if recGet.Code != http.StatusOK {
		t.Fatalf("expected 200 for owner, got %d: %s", recGet.Code, recGet.Body.String())
	}
	var detailRes githubapi.InstallationDetailResponse
	_ = json.Unmarshal(recGet.Body.Bytes(), &detailRes)
	if detailRes.GitHubInstallationID != 12345 {
		t.Fatalf("expected gh id 12345, got %d", detailRes.GitHubInstallationID)
	}
	recForeignGet := doRequest(f.mux, http.MethodGet, getPath, f.tokens[f.foreign.ID], nil)
	if recForeignGet.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for another user's installation, got %d", recForeignGet.Code)
	}
}

func TestHandler_ListServicesIsScopedToAuthenticatedUser(t *testing.T) {
	f := setupHandlerFixture(t)
	recOwner := doRequest(f.mux, http.MethodGet, "/v1/services", f.tokens[f.owner.ID], nil)
	if recOwner.Code != http.StatusOK {
		t.Fatalf("expected 200 for service owner, got %d: %s", recOwner.Code, recOwner.Body.String())
	}
	var ownerResponse githubapi.ListServicesResponse
	if err := json.Unmarshal(recOwner.Body.Bytes(), &ownerResponse); err != nil {
		t.Fatalf("decoding owner service response: %v", err)
	}
	if len(ownerResponse.Data) != 1 || ownerResponse.Data[0].ID != f.service.ID {
		t.Fatalf("expected the owner's web service, got %+v", ownerResponse.Data)
	}

	recForeign := doRequest(f.mux, http.MethodGet, "/v1/services", f.tokens[f.foreign.ID], nil)
	if recForeign.Code != http.StatusOK {
		t.Fatalf("expected 200 for another user, got %d: %s", recForeign.Code, recForeign.Body.String())
	}
	var foreignResponse githubapi.ListServicesResponse
	if err := json.Unmarshal(recForeign.Body.Bytes(), &foreignResponse); err != nil {
		t.Fatalf("decoding foreign service response: %v", err)
	}
	if len(foreignResponse.Data) != 0 {
		t.Fatalf("expected no services belonging to another user, got %+v", foreignResponse.Data)
	}
}

func TestHandler_DisconnectInstallation(t *testing.T) {
	f := setupHandlerFixture(t)
	discPath := fmt.Sprintf("/v1/github/installations/%s", f.instUUID)

	// Another user cannot disconnect the owner's installation.
	recForeign := doRequest(f.mux, http.MethodDelete, discPath, f.tokens[f.foreign.ID], nil)
	if recForeign.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for another user, got %d: %s", recForeign.Code, recForeign.Body.String())
	}

	// Owner can disconnect installation -> 200 OK
	recOwner := doRequest(f.mux, http.MethodDelete, discPath, f.tokens[f.owner.ID], nil)
	if recOwner.Code != http.StatusOK {
		t.Fatalf("expected 200 for owner, got %d: %s", recOwner.Code, recOwner.Body.String())
	}
}

func TestHandler_ListAndSyncRepositories(t *testing.T) {
	f := setupHandlerFixture(t)

	reposPath := fmt.Sprintf("/v1/github/installations/%s/repositories", f.instUUID)
	recRepos := doRequest(f.mux, http.MethodGet, reposPath, f.tokens[f.owner.ID], nil)
	if recRepos.Code != http.StatusOK {
		t.Fatalf("expected 200 for owner listing repos, got %d: %s", recRepos.Code, recRepos.Body.String())
	}
	var reposRes githubapi.ListRepositoriesResponse
	_ = json.Unmarshal(recRepos.Body.Bytes(), &reposRes)
	if len(reposRes.Data) != 1 {
		t.Fatalf("expected 1 repo, got %d", len(reposRes.Data))
	}

	// Another user cannot trigger sync for this installation.
	syncPath := fmt.Sprintf("/v1/github/installations/%s/sync", f.instUUID)
	recForeignSync := doRequest(f.mux, http.MethodPost, syncPath, f.tokens[f.foreign.ID], nil)
	if recForeignSync.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for another user, got %d", recForeignSync.Code)
	}

	// The installation owner can trigger sync.
	recOwnerSync := doRequest(f.mux, http.MethodPost, syncPath, f.tokens[f.owner.ID], nil)
	if recOwnerSync.Code != http.StatusOK {
		t.Fatalf("expected 200 for owner, got %d: %s", recOwnerSync.Code, recOwnerSync.Body.String())
	}
}

func TestHandler_ServiceSourceEndpoints(t *testing.T) {
	f := setupHandlerFixture(t)

	sourcePath := fmt.Sprintf("/v1/services/%s/source", f.service.ID)

	// Another personal user cannot connect a source to the owner's service.
	putPayload := githubapi.PutServiceSourceRequest{
		RepositoryID:  f.repoUUID,
		Branch:        "main",
		RootDirectory: ".",
	}
	body, _ := json.Marshal(putPayload)
	recForeign := doRequest(f.mux, http.MethodPut, sourcePath, f.tokens[f.foreign.ID], body)
	if recForeign.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for another user, got %d: %s", recForeign.Code, recForeign.Body.String())
	}

	// Owner can connect source -> 200 OK.
	recOwner := doRequest(f.mux, http.MethodPut, sourcePath, f.tokens[f.owner.ID], body)
	if recOwner.Code != http.StatusOK {
		t.Fatalf("expected 200 for owner, got %d: %s", recOwner.Code, recOwner.Body.String())
	}

	// 3. Invalid branch path traversal -> 400 Bad Request
	badBranchPayload := githubapi.PutServiceSourceRequest{
		RepositoryID:  f.repoUUID,
		Branch:        "../invalid",
		RootDirectory: ".",
	}
	badBody, _ := json.Marshal(badBranchPayload)
	recBadBranch := doRequest(f.mux, http.MethodPut, sourcePath, f.tokens[f.owner.ID], badBody)
	if recBadBranch.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for bad branch, got %d: %s", recBadBranch.Code, recBadBranch.Body.String())
	}

	// 4. Invalid root_directory path traversal -> 400 Bad Request
	badPathPayload := githubapi.PutServiceSourceRequest{
		RepositoryID:  f.repoUUID,
		Branch:        "main",
		RootDirectory: "../../../etc",
	}
	badPathBody, _ := json.Marshal(badPathPayload)
	recBadPath := doRequest(f.mux, http.MethodPut, sourcePath, f.tokens[f.owner.ID], badPathBody)
	if recBadPath.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for bad root directory, got %d: %s", recBadPath.Code, recBadPath.Body.String())
	}

	// 5. Owner can view source config.
	recForeignGet := doRequest(f.mux, http.MethodGet, sourcePath, f.tokens[f.foreign.ID], nil)
	if recForeignGet.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for another user's source, got %d: %s", recForeignGet.Code, recForeignGet.Body.String())
	}
	recGet := doRequest(f.mux, http.MethodGet, sourcePath, f.tokens[f.owner.ID], nil)
	if recGet.Code != http.StatusOK {
		t.Fatalf("expected 200 for owner GET source, got %d: %s", recGet.Code, recGet.Body.String())
	}

	// 6. PATCH source config -> 200 OK
	newBranch := "feat/login"
	patchPayload := githubapi.PatchServiceSourceRequest{
		Branch: &newBranch,
	}
	patchBody, _ := json.Marshal(patchPayload)
	recPatch := doRequest(f.mux, http.MethodPatch, sourcePath, f.tokens[f.owner.ID], patchBody)
	if recPatch.Code != http.StatusOK {
		t.Fatalf("expected 200 for member PATCH, got %d: %s", recPatch.Code, recPatch.Body.String())
	}

	// 7. Manual Deployment -> 201 Created
	deployPath := fmt.Sprintf("/v1/services/%s/deployments", f.service.ID)
	deployPayload := githubapi.ManualDeploymentRequest{
		Source: githubapi.DeploymentSourceRef{Ref: "refs/heads/feat/login"},
		Reason: "testing manual deployment",
	}
	deployBody, _ := json.Marshal(deployPayload)
	recDeploy := doRequest(f.mux, http.MethodPost, deployPath, f.tokens[f.owner.ID], deployBody)
	if recDeploy.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for deployment, got %d: %s", recDeploy.Code, recDeploy.Body.String())
	}
	var depRes githubapi.ManualDeploymentResponse
	_ = json.Unmarshal(recDeploy.Body.Bytes(), &depRes)
	if depRes.Status != "queued" || depRes.CommitSHA == "" {
		t.Fatalf("unexpected deployment response: %+v", depRes)
	}

	// 8. DELETE source -> 200 OK
	recDel := doRequest(f.mux, http.MethodDelete, sourcePath, f.tokens[f.owner.ID], nil)
	if recDel.Code != http.StatusOK {
		t.Fatalf("expected 200 for DELETE source, got %d: %s", recDel.Code, recDel.Body.String())
	}
}
