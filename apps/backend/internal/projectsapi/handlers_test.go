package projectsapi_test

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
	"github.com/summit/backend/internal/auth"
	"github.com/summit/backend/internal/platformdb"
	"github.com/summit/backend/internal/projectsapi"
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

type fixture struct {
	pool  *pgxpool.Pool
	store *platformdb.Store
	mux   *http.ServeMux
	a, b  testutil.User
}

const (
	tokA = "token-a"
	tokB = "token-b"
)

func setup(t *testing.T) *fixture {
	t.Helper()
	pool := testutil.NewDB(t)
	a := testutil.SeedUser(t, pool, "a@example.com", "A")
	b := testutil.SeedUser(t, pool, "b@example.com", "B")
	verifier := &staticVerifier{principals: map[string]auth.Principal{
		tokA: {UserID: a.ID, Email: a.Email, Name: a.Name},
		tokB: {UserID: b.ID, Email: b.Email, Name: b.Name},
	}}
	store := platformdb.New(pool)
	mux := http.NewServeMux()
	projectsapi.NewHandler(projectsapi.NewService(store), verifier, pool, nil).RegisterRoutes(mux)
	return &fixture{pool: pool, store: store, mux: mux, a: a, b: b}
}

func (f *fixture) do(t *testing.T, method, path, token string, body any) (int, map[string]any) {
	t.Helper()
	var rd *bytes.Reader
	switch v := body.(type) {
	case nil:
		rd = bytes.NewReader(nil)
	case string:
		rd = bytes.NewReader([]byte(v))
	default:
		raw, err := json.Marshal(v)
		if err != nil {
			t.Fatal(err)
		}
		rd = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, rd)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	f.mux.ServeHTTP(rec, req)
	var out map[string]any
	if rec.Body.Len() > 0 {
		if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
			t.Fatalf("%s %s: non-JSON body %q: %v", method, path, rec.Body.String(), err)
		}
	}
	return rec.Code, out
}

func (f *fixture) mustDo(t *testing.T, want int, method, path, token string, body any) map[string]any {
	t.Helper()
	code, out := f.do(t, method, path, token, body)
	if code != want {
		t.Fatalf("%s %s = %d, want %d: %v", method, path, code, want, out)
	}
	return out
}

func str(t *testing.T, m map[string]any, key string) string {
	t.Helper()
	s, ok := m[key].(string)
	if !ok {
		t.Fatalf("field %q is not a string in %v", key, m)
	}
	return s
}

func errCode(m map[string]any) string {
	e, _ := m["error"].(map[string]any)
	c, _ := e["code"].(string)
	return c
}

func TestAuthRequired(t *testing.T) {
	f := setup(t)
	id := uuid.NewString()
	for _, r := range [][2]string{
		{"GET", "/v1/projects"}, {"POST", "/v1/projects"}, {"GET", "/v1/projects/" + id},
		{"PATCH", "/v1/projects/" + id}, {"DELETE", "/v1/projects/" + id},
		{"POST", "/v1/projects/" + id + "/services"}, {"POST", "/v1/projects/" + id + "/environments"},
		{"DELETE", "/v1/services/" + id},
		{"GET", "/v1/projects/" + id + "/deployments"},
		{"GET", "/v1/deployments/" + id}, {"POST", "/v1/deployments/" + id + "/cancel"}, {"GET", "/v1/deployments/" + id + "/logs"},
	} {
		if code, _ := f.do(t, r[0], r[1], "", nil); code != http.StatusUnauthorized {
			t.Errorf("%s %s without token = %d, want 401", r[0], r[1], code)
		}
		if code, _ := f.do(t, r[0], r[1], "bogus", nil); code != http.StatusUnauthorized {
			t.Errorf("%s %s with bad token = %d, want 401", r[0], r[1], code)
		}
	}
}

func TestProjectLifecycle(t *testing.T) {
	f := setup(t)

	// Derived slug + collision suffixes.
	p1 := f.mustDo(t, 201, "POST", "/v1/projects", tokA, map[string]any{"name": "My App"})
	if str(t, p1, "slug") != "my-app" || p1["services_count"].(float64) != 0 || p1["latest_deployment"] != nil ||
		p1["git_repository_url"] != nil || str(t, p1, "default_branch") != "main" {
		t.Fatalf("unexpected create response: %v", p1)
	}
	p2 := f.mustDo(t, 201, "POST", "/v1/projects", tokA, map[string]any{"name": "My App"})
	if str(t, p2, "slug") != "my-app-2" {
		t.Fatalf("second slug = %v", p2["slug"])
	}
	// Different tenants may reuse the same slug.
	pb := f.mustDo(t, 201, "POST", "/v1/projects", tokB, map[string]any{"name": "My App"})
	if str(t, pb, "slug") != "my-app" {
		t.Fatalf("tenant B slug = %v", pb["slug"])
	}

	// Explicit slug: honoured, conflict -> 409, invalid -> 400.
	p3 := f.mustDo(t, 201, "POST", "/v1/projects", tokA, map[string]any{"name": "Third", "slug": "custom"})
	if str(t, p3, "slug") != "custom" {
		t.Fatalf("explicit slug = %v", p3["slug"])
	}
	if out := f.mustDo(t, 409, "POST", "/v1/projects", tokA, map[string]any{"name": "Other", "slug": "custom"}); errCode(out) != "CONFLICT" {
		t.Fatalf("conflict code = %v", out)
	}
	if out := f.mustDo(t, 400, "POST", "/v1/projects", tokA, map[string]any{"name": "Bad", "slug": "Not Valid!"}); errCode(out) != "VALIDATION_FAILED" {
		t.Fatalf("invalid slug code = %v", out)
	}
	f.mustDo(t, 400, "POST", "/v1/projects", tokA, map[string]any{"name": "  "})
	f.mustDo(t, 400, "POST", "/v1/projects", tokA, `{"name":"x","bogus":1}`)
	f.mustDo(t, 400, "POST", "/v1/projects", tokA, `not json`)

	// List: newest first, paginated with an opaque cursor, only own projects.
	page1 := f.mustDo(t, 200, "GET", "/v1/projects?limit=2", tokA, nil)
	data1 := page1["data"].([]any)
	if len(data1) != 2 || str(t, data1[0].(map[string]any), "slug") != "custom" || page1["next_cursor"] == nil {
		t.Fatalf("page1 = %v", page1)
	}
	page2 := f.mustDo(t, 200, "GET", "/v1/projects?limit=2&cursor="+page1["next_cursor"].(string), tokA, nil)
	data2 := page2["data"].([]any)
	if len(data2) != 1 || page2["next_cursor"] != nil || str(t, data2[0].(map[string]any), "slug") != "my-app" {
		t.Fatalf("page2 = %v", page2)
	}
	f.mustDo(t, 400, "GET", "/v1/projects?cursor=garbage", tokA, nil)
	f.mustDo(t, 400, "GET", "/v1/projects?limit=abc", tokA, nil)
	listB := f.mustDo(t, 200, "GET", "/v1/projects", tokB, nil)
	if got := listB["data"].([]any); len(got) != 1 {
		t.Fatalf("tenant B sees %d projects, want 1", len(got))
	}
	// Empty list serialises as [] not null.
	if _, raw := f.do(t, "GET", "/v1/projects", "token-b", nil); raw["data"] == nil {
		t.Fatal("data must not be null")
	}

	// Patch.
	pid := str(t, p1, "id")
	up := f.mustDo(t, 200, "PATCH", "/v1/projects/"+pid, tokA, map[string]any{"name": "Renamed"})
	if str(t, up, "name") != "Renamed" || str(t, up, "slug") != "my-app" {
		t.Fatalf("patch = %v", up)
	}
	f.mustDo(t, 400, "PATCH", "/v1/projects/"+pid, tokA, map[string]any{"name": ""})
	f.mustDo(t, 400, "PATCH", "/v1/projects/"+pid, tokA, `{"slug":"nope"}`)

	// Delete is soft, idempotent-404 afterwards, and hides it from list/detail.
	f.mustDo(t, 400, "GET", "/v1/projects/not-a-uuid", tokA, nil)
	if code, _ := f.do(t, "DELETE", "/v1/projects/"+pid, tokA, nil); code != 204 {
		t.Fatalf("delete = %d", code)
	}
	f.mustDo(t, 404, "GET", "/v1/projects/"+pid, tokA, nil)
	f.mustDo(t, 404, "DELETE", "/v1/projects/"+pid, tokA, nil)
	if got := f.mustDo(t, 200, "GET", "/v1/projects", tokA, nil)["data"].([]any); len(got) != 2 {
		t.Fatalf("after delete list has %d, want 2", len(got))
	}
}

func TestServicesAndDeployments(t *testing.T) {
	f := setup(t)
	ctx := context.Background()

	proj := f.mustDo(t, 201, "POST", "/v1/projects", tokA, map[string]any{"name": "Shop"})
	pid := str(t, proj, "id")

	// Services: default web in production; worker; bad type; duplicate name.
	web := f.mustDo(t, 201, "POST", "/v1/projects/"+pid+"/services", tokA, map[string]any{"name": "web"})
	if str(t, web, "type") != "web" || str(t, web, "environment_name") != "production" || str(t, web, "project_id") != pid ||
		web["source"] != nil || web["latest_deployment"] != nil {
		t.Fatalf("service = %v", web)
	}
	wk := f.mustDo(t, 201, "POST", "/v1/projects/"+pid+"/services", tokA, map[string]any{"name": "jobs", "type": "worker"})
	if str(t, wk, "type") != "worker" {
		t.Fatalf("worker = %v", wk)
	}
	f.mustDo(t, 409, "POST", "/v1/projects/"+pid+"/services", tokA, map[string]any{"name": "web"})
	f.mustDo(t, 400, "POST", "/v1/projects/"+pid+"/services", tokA, map[string]any{"name": "x", "type": "cron"})
	f.mustDo(t, 400, "POST", "/v1/projects/"+pid+"/services", tokA, map[string]any{"name": "Bad Name"})
	f.mustDo(t, 400, "POST", "/v1/projects/"+pid+"/services", tokA, map[string]any{"name": "x", "environment_id": "nope"})

	// Explicit environment must belong to this project.
	other := f.mustDo(t, 201, "POST", "/v1/projects", tokA, map[string]any{"name": "Other"})
	otherDetail := f.mustDo(t, 200, "GET", "/v1/projects/"+str(t, other, "id"), tokA, nil)
	otherEnv := otherDetail["environments"].([]any)[0].(map[string]any)["id"].(string)
	f.mustDo(t, 404, "POST", "/v1/projects/"+pid+"/services", tokA, map[string]any{"name": "sneaky", "environment_id": otherEnv})

	var stagingID uuid.UUID
	if err := f.pool.QueryRow(ctx, `INSERT INTO environments (project_id, name, type) VALUES ($1, 'staging', 'staging') RETURNING id`, pid).Scan(&stagingID); err != nil {
		t.Fatal(err)
	}
	st := f.mustDo(t, 201, "POST", "/v1/projects/"+pid+"/services", tokA, map[string]any{"name": "api", "environment_id": stagingID.String()})
	if str(t, st, "environment_name") != "staging" {
		t.Fatalf("staging service = %v", st)
	}

	// Source + deployments for the web service.
	webID := uuid.MustParse(str(t, web, "id"))
	envID := uuid.MustParse(str(t, web, "environment_id"))
	inst := testutil.SeedGitHubInstallation(t, f.pool, f.a.ID, "octo")
	repo := testutil.SeedGitHubRepository(t, f.pool, inst.ID, "octo/shop")
	testutil.SeedServiceSource(t, f.pool, webID, repo.ID, "release")
	pidU := uuid.MustParse(pid)
	old := testutil.SeedDeployment(t, f.pool, pidU, envID, webID, "running")
	newest := testutil.SeedDeployment(t, f.pool, pidU, envID, webID, "building")
	job := testutil.SeedBuildJob(t, f.pool, newest.ID, "running")
	if _, err := f.pool.Exec(ctx, `INSERT INTO deployment_events (deployment_id, from_status, to_status, reason) VALUES ($1, NULL, 'queued', 'created'), ($1, 'queued', 'building', NULL)`, newest.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.store.AppendBuildLogs(ctx, job.ID, []platformdb.LogLine{
		{Stream: "stdout", Message: "one", Stage: "clone"}, {Stream: "stderr", Level: "error", Message: "two"}, {Message: "three"},
	}); err != nil {
		t.Fatal(err)
	}

	// Project detail.
	d := f.mustDo(t, 200, "GET", "/v1/projects/"+pid, tokA, nil)
	if d["services_count"].(float64) != 3 || len(d["services"].([]any)) != 3 {
		t.Fatalf("detail services = %v", d["services"])
	}
	envs := d["environments"].([]any)
	if len(envs) != 2 || envs[0].(map[string]any)["name"] != "production" || envs[0].(map[string]any)["is_ephemeral"] != false {
		t.Fatalf("environments = %v", envs)
	}
	if ld := d["latest_deployment"].(map[string]any); ld["id"] != newest.ID.String() || ld["status"] != "building" {
		t.Fatalf("project latest_deployment = %v", ld)
	}
	var webSvc map[string]any
	for _, s := range d["services"].([]any) {
		if m := s.(map[string]any); m["id"] == webID.String() {
			webSvc = m
		}
	}
	src, _ := webSvc["source"].(map[string]any)
	if src["repository_full_name"] != "octo/shop" || src["branch"] != "release" || src["root_directory"] != "." ||
		src["source_status"] != "active" || src["auto_deploy"] != true {
		t.Fatalf("web source = %v", webSvc["source"])
	}
	if webSvc["latest_deployment"].(map[string]any)["id"] != newest.ID.String() {
		t.Fatalf("service latest_deployment = %v", webSvc["latest_deployment"])
	}

	// Summary list agrees.
	lst := f.mustDo(t, 200, "GET", "/v1/projects", tokA, nil)["data"].([]any)
	for _, x := range lst {
		m := x.(map[string]any)
		if m["id"] == pid && (m["services_count"].(float64) != 3 || m["latest_deployment"] == nil) {
			t.Fatalf("list summary = %v", m)
		}
	}

	// Deployments list: newest first, paginated.
	dl := f.mustDo(t, 200, "GET", "/v1/projects/"+pid+"/deployments?limit=1", tokA, nil)
	items := dl["data"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["id"] != newest.ID.String() || dl["next_cursor"] == nil {
		t.Fatalf("deployments page1 = %v", dl)
	}
	dl2 := f.mustDo(t, 200, "GET", "/v1/projects/"+pid+"/deployments?limit=1&cursor="+dl["next_cursor"].(string), tokA, nil)
	if got := dl2["data"].([]any); len(got) != 1 || got[0].(map[string]any)["id"] != old.ID.String() || dl2["next_cursor"] != nil {
		t.Fatalf("deployments page2 = %v", dl2)
	}

	// Deployment detail.
	dd := f.mustDo(t, 200, "GET", "/v1/deployments/"+newest.ID.String(), tokA, nil)
	build, _ := dd["build"].(map[string]any)
	if build["id"] != job.ID.String() || build["status"] != "running" || build["current_stage"] != nil || build["requested_at"] == nil {
		t.Fatalf("build = %v", dd["build"])
	}
	evs := dd["events"].([]any)
	if len(evs) != 2 || evs[0].(map[string]any)["from_status"] != nil || evs[1].(map[string]any)["from_status"] != "queued" ||
		evs[1].(map[string]any)["to_status"] != "building" || evs[1].(map[string]any)["reason"] != nil {
		t.Fatalf("events = %v", evs)
	}
	nobuild := f.mustDo(t, 200, "GET", "/v1/deployments/"+old.ID.String(), tokA, nil)
	if nobuild["build"] != nil || len(nobuild["events"].([]any)) != 0 {
		t.Fatalf("deployment without build/events = %v", nobuild)
	}

	// Logs: cursor paging.
	lg := f.mustDo(t, 200, "GET", "/v1/deployments/"+newest.ID.String()+"/logs?limit=2", tokA, nil)
	lines := lg["data"].([]any)
	if len(lines) != 2 || lines[0].(map[string]any)["message"] != "one" || lines[0].(map[string]any)["stream"] != "stdout" ||
		lines[1].(map[string]any)["stream"] != "stderr" || lines[0].(map[string]any)["timestamp"] == nil || lg["next_after"] == nil {
		t.Fatalf("logs page1 = %v", lg)
	}
	lg2 := f.mustDo(t, 200, "GET", fmt.Sprintf("/v1/deployments/%s/logs?after=%d", newest.ID, int64(lg["next_after"].(float64))), tokA, nil)
	if got := lg2["data"].([]any); len(got) != 1 || got[0].(map[string]any)["message"] != "three" {
		t.Fatalf("logs page2 = %v", lg2)
	}
	empty := f.mustDo(t, 200, "GET", fmt.Sprintf("/v1/deployments/%s/logs?after=%d", newest.ID, int64(lg2["next_after"].(float64))), tokA, nil)
	if len(empty["data"].([]any)) != 0 || empty["next_after"] != nil {
		t.Fatalf("drained logs = %v", empty)
	}
	f.mustDo(t, 400, "GET", "/v1/deployments/"+newest.ID.String()+"/logs?after=-1", tokA, nil)
	f.mustDo(t, 400, "GET", "/v1/deployments/"+newest.ID.String()+"/logs?limit=x", tokA, nil)

	// Cancel: in-flight -> 200 with cancel_requested_at; running -> 409.
	c := f.mustDo(t, 200, "POST", "/v1/deployments/"+newest.ID.String()+"/cancel", tokA, nil)
	if c["id"] != newest.ID.String() || c["cancel_requested_at"] == nil {
		t.Fatalf("cancel = %v", c)
	}
	f.mustDo(t, 200, "POST", "/v1/deployments/"+newest.ID.String()+"/cancel", tokA, nil) // idempotent
	if out := f.mustDo(t, 409, "POST", "/v1/deployments/"+old.ID.String()+"/cancel", tokA, nil); errCode(out) != "CONFLICT" {
		t.Fatalf("cancel running = %v", out)
	}
}

func TestTenantIsolation(t *testing.T) {
	f := setup(t)
	ctx := context.Background()

	proj := f.mustDo(t, 201, "POST", "/v1/projects", tokA, map[string]any{"name": "Secret"})
	pid := str(t, proj, "id")
	svc := f.mustDo(t, 201, "POST", "/v1/projects/"+pid+"/services", tokA, map[string]any{"name": "web"})
	pidU, envU, svcU := uuid.MustParse(pid), uuid.MustParse(str(t, svc, "environment_id")), uuid.MustParse(str(t, svc, "id"))
	dep := testutil.SeedDeployment(t, f.pool, pidU, envU, svcU, "queued")
	job := testutil.SeedBuildJob(t, f.pool, dep.ID, "queued")
	if _, err := f.store.AppendBuildLogs(ctx, job.ID, []platformdb.LogLine{{Message: "secret log"}}); err != nil {
		t.Fatal(err)
	}
	did := dep.ID.String()

	// B must get 404 everywhere — identical to a random unknown id.
	unknown := uuid.NewString()
	for _, r := range []struct {
		method, path string
		body         any
	}{
		{"GET", "/v1/projects/%s", nil},
		{"PATCH", "/v1/projects/%s", map[string]any{"name": "pwned"}},
		{"DELETE", "/v1/projects/%s", nil},
		{"POST", "/v1/projects/%s/services", map[string]any{"name": "intruder"}},
		{"GET", "/v1/projects/%s/deployments", nil},
	} {
		cb, ba := f.do(t, r.method, fmt.Sprintf(r.path, pid), tokB, r.body)
		cu, bu := f.do(t, r.method, fmt.Sprintf(r.path, unknown), tokB, r.body)
		if cb != 404 || cu != 404 || errCode(ba) != "NOT_FOUND" || errCode(bu) != "NOT_FOUND" {
			t.Errorf("%s %s: foreign=%d unknown=%d (%v / %v), want identical 404", r.method, r.path, cb, cu, ba, bu)
		}
	}
	for _, r := range [][2]string{
		{"GET", "/v1/deployments/%s"}, {"POST", "/v1/deployments/%s/cancel"}, {"GET", "/v1/deployments/%s/logs"},
	} {
		cb, _ := f.do(t, r[0], fmt.Sprintf(r[1], did), tokB, nil)
		cu, _ := f.do(t, r[0], fmt.Sprintf(r[1], unknown), tokB, nil)
		if cb != 404 || cu != 404 {
			t.Errorf("%s %s: foreign=%d unknown=%d, want 404", r[0], r[1], cb, cu)
		}
	}
	// B cannot attach a service to its own project using A's environment id.
	pb := f.mustDo(t, 201, "POST", "/v1/projects", tokB, map[string]any{"name": "Mine"})
	f.mustDo(t, 404, "POST", "/v1/projects/"+str(t, pb, "id")+"/services", tokB, map[string]any{"name": "x", "environment_id": envU.String()})

	// Nothing leaked into B's list and A's data is untouched.
	if got := f.mustDo(t, 200, "GET", "/v1/projects", tokB, nil)["data"].([]any); len(got) != 1 {
		t.Fatalf("B lists %d projects, want 1 (its own)", len(got))
	}
	after := f.mustDo(t, 200, "GET", "/v1/projects/"+pid, tokA, nil)
	if str(t, after, "name") != "Secret" || len(after["services"].([]any)) != 1 {
		t.Fatalf("A's project was modified: %v", after)
	}
	if d := f.mustDo(t, 200, "GET", "/v1/deployments/"+did, tokA, nil); d["cancel_requested_at"] != nil {
		t.Fatalf("B's cancel took effect: %v", d)
	}
}
