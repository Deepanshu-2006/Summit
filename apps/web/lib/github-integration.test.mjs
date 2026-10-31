import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  connectServiceRepository,
  listInstallationRepositories,
  syncInstallationRepositories,
} from "./github-integration.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("GitHub backend integration client", () => {
  it("loads every page of repositories persisted by backend sync", async () => {
    const calls = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/sync")) {
        return Response.json({ sync_id: "sync-1", status: "completed", repositories_synced: 2 });
      }

      const query = new URL(url, "http://localhost").searchParams;
      if (query.get("cursor") === "next-page") {
        return Response.json({ data: [{ id: "repo-2", github_repository_id: 22, full_name: "acme/two" }] });
      }
      return Response.json({
        data: [{ id: "repo-1", github_repository_id: 11, full_name: "acme/one" }],
        next_cursor: "next-page",
      });
    };

    const result = await syncInstallationRepositories("supabase-jwt", "installation-1");

    assert.equal(result.repositories_synced, 2);
    assert.deepEqual(result.repositories.map((repo) => repo.id), ["repo-1", "repo-2"]);
    assert.equal(calls.length, 3);
    assert.ok(calls.every((url) => url.startsWith("/api/platform/v1/")));
  });

  it("connects a database repository to the selected service with branch and build settings", async () => {
    const calls = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ url, method, body });
      if (method === "PUT") return Response.json({ id: "source-1" });
      return Response.json({
        id: "source-1",
        service_id: "service-1",
        repository: { id: "repo-1", full_name: "acme/app" },
        branch: "release/2026",
        root_directory: "apps/web",
        dockerfile_path: "apps/web/Dockerfile",
        build_configuration: { build_command: "pnpm build" },
        auto_deploy: false,
        source_status: "active",
        last_seen_commit_sha: null,
      });
    };

    const source = await connectServiceRepository("supabase-jwt", "service-1", {
      repositoryId: "repo-1",
      branch: "release/2026",
      rootDirectory: "apps/web",
      dockerfilePath: "apps/web/Dockerfile",
      buildConfiguration: { build_command: "pnpm build" },
      autoDeploy: false,
    });

    assert.equal(source.service_id, "service-1");
    assert.equal(source.repository.id, "repo-1");
    assert.deepEqual(calls.map((call) => call.method), ["PUT", "GET"]);
    assert.equal(calls[0].url, "/api/platform/v1/services/service-1/source");
    assert.deepEqual(calls[0].body, {
      repository_id: "repo-1",
      branch: "release/2026",
      root_directory: "apps/web",
      dockerfile_path: "apps/web/Dockerfile",
      build_configuration: { build_command: "pnpm build" },
      auto_deploy: false,
    });
  });

  it("encodes service and installation path identifiers", async () => {
    const calls = [];
    globalThis.fetch = async (input) => {
      calls.push(String(input));
      return Response.json({ data: [], next_cursor: null });
    };

    await listInstallationRepositories("supabase-jwt", "team/id");

    assert.equal(
      calls[0],
      "/api/platform/v1/github/installations/team%2Fid/repositories?limit=100",
    );
  });
});
