import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  PlatformApiError,
  cancelDeployment,
  createEnvironment,
  createProject,
  createService,
  deleteService,
  deployService,
  describeApiError,
  getDeploymentLogs,
  isInFlightStatus,
  isSettledStatus,
  isTerminalStatus,
  listAllProjects,
  listProjectDeployments,
  platformRequest,
  projectStatusFromDeployment,
  repositoryLabel,
  safeHttpUrl,
  toDashboardProject,
  toServiceName,
} from "./platform-api.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const NOW = Date.parse("2026-11-01T12:00:00Z");

function deployment(overrides = {}) {
  return {
    id: "dep-1",
    project_id: "proj-1",
    environment_id: "env-1",
    service_id: "svc-1",
    status: "running",
    commit_sha: "0123456789abcdef",
    branch: "main",
    trigger_type: "manual",
    error_message: null,
    status_reason: null,
    image_ref: null,
    public_url: null,
    created_at: "2026-11-01T11:00:00Z",
    started_at: null,
    finished_at: null,
    updated_at: "2026-11-01T11:00:00Z",
    ...overrides,
  };
}

function project(overrides = {}) {
  return {
    id: "proj-1",
    slug: "my-app",
    name: "my-app",
    git_repository_url: "https://github.com/acme/my-app.git",
    default_branch: "main",
    services_count: 2,
    latest_deployment: deployment(),
    created_at: "2026-10-30T12:00:00Z",
    updated_at: "2026-11-01T11:30:00Z",
    ...overrides,
  };
}

describe("platform request helper", () => {
  it("sends the bearer token and surfaces the Go backend error envelope", async () => {
    let seen;
    globalThis.fetch = async (input, init) => {
      seen = { url: String(input), headers: init.headers };
      return Response.json(
        { error: { code: "service_source_not_found", message: "no source", request_id: "req-1" } },
        { status: 404 },
      );
    };

    await assert.rejects(
      () => platformRequest("/v1/services/x/deployments", "jwt"),
      (error) => {
        assert.ok(error instanceof PlatformApiError);
        assert.equal(error.status, 404);
        assert.equal(error.code, "service_source_not_found");
        assert.equal(error.requestId, "req-1");
        assert.equal(error.message, "no source");
        return true;
      },
    );
    assert.equal(seen.url, "/api/platform/v1/services/x/deployments");
    assert.equal(seen.headers.Authorization, "Bearer jwt");
  });

  it("reads proxy string errors and tolerates empty 204 bodies", async () => {
    globalThis.fetch = async () => Response.json({ error: "Backend API is unavailable" }, { status: 503 });
    await assert.rejects(() => platformRequest("/v1/projects", "jwt"), /Backend API is unavailable/);

    globalThis.fetch = async () => new Response(null, { status: 204 });
    assert.equal(await platformRequest("/v1/projects/p", "jwt", { method: "DELETE" }), null);
  });

  it("explains unavailable backends and missing sources", () => {
    const unavailable = new PlatformApiError("Backend API is unavailable", 503);
    assert.match(describeApiError(unavailable), /backend is unavailable/i);
    const noSource = new PlatformApiError("x", 404, "service_source_not_found");
    assert.match(describeApiError(noSource), /Connect a repository/);
    // The Go backend actually sends the upper-case form.
    const realNoSource = new PlatformApiError("x", 404, "SERVICE_SOURCE_NOT_FOUND");
    assert.match(describeApiError(realNoSource), /Connect a repository/);
    assert.equal(describeApiError("weird", "fallback"), "fallback");
  });
});

describe("platform endpoints", () => {
  it("follows next_cursor when listing every project", async () => {
    const calls = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      const cursor = new URL(url, "http://localhost").searchParams.get("cursor");
      return cursor
        ? Response.json({ data: [project({ id: "proj-2" })], next_cursor: null })
        : Response.json({ data: [project()], next_cursor: "c2" });
    };

    const projects = await listAllProjects("jwt");
    assert.deepEqual(projects.map((p) => p.id), ["proj-1", "proj-2"]);
    assert.equal(calls.length, 2);
    assert.ok(calls[0].startsWith("/api/platform/v1/projects?limit=100"));
  });

  it("creates projects and services with the contract bodies", async () => {
    const calls = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ url: String(input), method: init.method, body: JSON.parse(init.body) });
      return Response.json({ id: "new" }, { status: 201 });
    };

    await createProject("jwt", { name: "demo" });
    await createService("jwt", "proj/1", { name: "web-app" });
    await createService("jwt", "proj-1", { name: "w", type: "worker", environmentId: "env-9" });

    assert.deepEqual(calls[0], { url: "/api/platform/v1/projects", method: "POST", body: { name: "demo" } });
    assert.equal(calls[1].url, "/api/platform/v1/projects/proj%2F1/services");
    assert.deepEqual(calls[1].body, { name: "web-app", type: "web" });
    assert.deepEqual(calls[2].body, { name: "w", type: "worker", environment_id: "env-9" });
  });

  it("creates image and database services, environments, and deletes a service", async () => {
    const calls = [];
    globalThis.fetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: init.method,
        body: init.body ? JSON.parse(init.body) : null,
      });
      return init.method === "DELETE"
        ? new Response(null, { status: 204 })
        : Response.json({ id: "created" }, { status: 201 });
    };

    await createService("jwt", "proj-1", { name: "Nginx", type: "image", image: "nginx:1.27", port: 80, environmentId: "env-1" });
    await createService("jwt", "proj-1", { name: "main db", type: "postgres", environmentId: "env-1" });
    await assert.rejects(
      () => createService("jwt", "proj-1", { name: "edge", type: "image" }),
      /image reference is required/i,
    );
    await createEnvironment("jwt", "proj-1", { name: "Staging Two", type: "staging" });
    await assert.rejects(
      () => createEnvironment("jwt", "proj-1", { name: "---", type: "preview" }),
      /DNS label/,
    );
    await deleteService("jwt", "svc/1");

    assert.deepEqual(calls[0].body, {
      name: "nginx",
      type: "image",
      image: "nginx:1.27",
      port: 80,
      environment_id: "env-1",
    });
    assert.deepEqual(calls[1].body, { name: "main-db", type: "postgres", environment_id: "env-1" });
    assert.deepEqual(calls[2].body, { name: "staging-two", type: "staging" });
    assert.equal(calls[2].url, "/api/platform/v1/projects/proj-1/environments");
    assert.deepEqual(calls[3], { url: "/api/platform/v1/services/svc%2F1", method: "DELETE", body: null });
  });

  it("starts deployments with a fresh Idempotency-Key per call", async () => {
    const keys = [];
    globalThis.fetch = async (_input, init) => {
      keys.push(init.headers["Idempotency-Key"]);
      assert.deepEqual(JSON.parse(init.body), { source: {} });
      return Response.json({ id: "dep-1", service_id: "svc-1", status: "queued" }, { status: 201 });
    };

    await deployService("jwt", "svc-1");
    await deployService("jwt", "svc-1");
    assert.equal(keys.length, 2);
    assert.ok(keys.every(Boolean));
    assert.notEqual(keys[0], keys[1]);
  });

  it("builds log, cancel and deployment-list requests", async () => {
    const calls = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ url: String(input), method: init?.method ?? "GET" });
      return Response.json({ data: [], next_after: null, next_cursor: null });
    };

    await getDeploymentLogs("jwt", "dep-1", { after: 41, limit: 500 });
    await getDeploymentLogs("jwt", "dep-1", { after: null });
    await cancelDeployment("jwt", "dep-1");
    await listProjectDeployments("jwt", "proj-1", { limit: 10 });

    assert.equal(calls[0].url, "/api/platform/v1/deployments/dep-1/logs?after=41&limit=500");
    assert.equal(calls[1].url, "/api/platform/v1/deployments/dep-1/logs");
    assert.deepEqual(calls[2], { url: "/api/platform/v1/deployments/dep-1/cancel", method: "POST" });
    assert.equal(calls[3].url, "/api/platform/v1/projects/proj-1/deployments?limit=10");
  });
});

describe("deployment status helpers", () => {
  it("classifies statuses like the backend lifecycle", () => {
    for (const status of ["failed", "cancelled", "superseded"]) {
      assert.ok(isTerminalStatus(status), status);
      assert.ok(isSettledStatus(status), status);
      assert.ok(!isInFlightStatus(status), status);
    }
    for (const status of ["queued", "building", "image_ready", "deploying", "health_checking"]) {
      assert.ok(isInFlightStatus(status), status);
      assert.ok(!isSettledStatus(status), status);
    }
    assert.ok(isSettledStatus("running"));
    assert.ok(!isTerminalStatus("running"));
  });
});

describe("dashboard mapping", () => {
  it("derives card fields from the latest deployment", () => {
    const mapped = toDashboardProject(project(), NOW);
    assert.equal(mapped.repository, "acme/my-app");
    assert.equal(mapped.branch, "main");
    assert.equal(mapped.commitSha, "0123456");
    assert.equal(mapped.status, "running");
    assert.equal(mapped.statusLabel, "running");
    assert.equal(mapped.lastDeployedLabel, "1h ago");
    assert.equal(mapped.updatedLabel, "30m ago");
    assert.equal(mapped.servicesCount, 2);
  });

  it("shows honest placeholders for projects without deployments or repositories", () => {
    const mapped = toDashboardProject(
      project({ latest_deployment: null, git_repository_url: null, default_branch: null }),
      NOW,
    );
    assert.equal(mapped.repository, null);
    assert.equal(mapped.branch, null);
    assert.equal(mapped.commitSha, null);
    assert.equal(mapped.lastDeployedLabel, null);
    assert.equal(mapped.status, "idle");
    assert.equal(mapped.statusLabel, "no deployments");
  });

  it("maps deployment statuses to project states", () => {
    assert.equal(projectStatusFromDeployment(deployment({ status: "health_checking" })), "building");
    assert.equal(projectStatusFromDeployment(deployment({ status: "failed" })), "failed");
    assert.equal(projectStatusFromDeployment(deployment({ status: "cancelled" })), "stopped");
    assert.equal(projectStatusFromDeployment(null), "idle");
  });

  it("parses repository labels and only allows http(s) public urls", () => {
    assert.equal(repositoryLabel("git@github.com:acme/app.git"), "acme/app");
    assert.equal(repositoryLabel(null), null);
    assert.equal(safeHttpUrl("https://app.example.com"), "https://app.example.com/");
    assert.equal(safeHttpUrl("javascript:alert(1)"), null);
    assert.equal(safeHttpUrl("not a url"), null);
  });
});

describe("toServiceName", () => {
  it("normalises repo names into backend DNS-label service names", () => {
    assert.equal(toServiceName("Summit"), "summit");
    assert.equal(toServiceName("My_App.Web"), "my-app-web");
    assert.equal(toServiceName("--weird--"), "weird");
    assert.equal(toServiceName("___"), "web");
    const long = toServiceName("a".repeat(62) + "_b");
    assert.ok(long.length <= 63 && !long.endsWith("-"));
  });
});
