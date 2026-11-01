import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeServiceNodes, serviceNodeId, serviceToNodeData } from "./service-nodes.ts";

function service(id, overrides = {}) {
  return {
    id,
    project_id: "proj-1",
    environment_id: "env-1",
    environment_name: "production",
    name: `svc-${id}`,
    type: "web",
    source: null,
    latest_deployment: null,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
    ...overrides,
  };
}

function uiNode(id, x, y) {
  return { id, type: "summitNode", position: { x, y }, data: { label: id, serviceType: "database", subType: "PostgreSQL" } };
}

describe("canvas service nodes", () => {
  it("renders real services and keeps UI-only nodes", () => {
    const nodes = mergeServiceNodes([uiNode("pg", 180, 160)], [service("a"), service("b")]);
    assert.equal(nodes.length, 3);
    assert.equal(nodes[0].id, "pg");
    assert.deepEqual(nodes.slice(1).map((node) => node.id), [serviceNodeId("a"), serviceNodeId("b")]);
    assert.ok(nodes.slice(1).every((node) => node.deletable === false));
    // New services never overlap an existing node.
    assert.notDeepEqual(nodes[1].position, nodes[0].position);
  });

  it("reuses stored positions and drops stored nodes for deleted services", () => {
    const stored = [
      { ...uiNode(serviceNodeId("a"), 900, 700), data: { ...uiNode("x").data, serviceId: "a" } },
      { ...uiNode(serviceNodeId("gone"), 10, 10), data: { ...uiNode("x").data, serviceId: "gone" } },
    ];
    const nodes = mergeServiceNodes(stored, [service("a", { name: "renamed" })]);
    assert.equal(nodes.length, 1);
    assert.deepEqual(nodes[0].position, { x: 900, y: 700 });
    assert.equal(nodes[0].data.label, "renamed");
  });

  it("derives status and source details from the backend", () => {
    assert.equal(serviceToNodeData(service("a")).statusText, "No repository connected");

    const connected = service("a", {
      source: { repository_full_name: "acme/app", branch: "main", root_directory: ".", source_status: "active", auto_deploy: true },
    });
    assert.equal(serviceToNodeData(connected).statusText, "Not deployed yet");
    assert.equal(serviceToNodeData(connected).repoUrl, "https://github.com/acme/app");

    const deployed = {
      ...connected,
      latest_deployment: { status: "building", commit_sha: "abcdef0123", public_url: null },
    };
    const data = serviceToNodeData(deployed);
    assert.equal(data.statusText, "Deployment building");
    assert.equal(data.statusTone, "progress");
    assert.equal(data.commitSha, "abcdef0123");
  });
});
