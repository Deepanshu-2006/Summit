import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeServiceNodes, serviceNodeId, serviceToNodeData } from "./service-nodes.ts";
import { pickEnvironmentId, servicesInEnvironment } from "./environments.ts";

function service(id, overrides = {}) {
  return {
    id,
    project_id: "proj-1",
    environment_id: "env-1",
    environment_name: "production",
    name: `svc-${id}`,
    type: "web",
    source: null,
    image: null,
    addon: null,
    port: null,
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
  it("renders real services and drops stale local drawings", () => {
    const decorative = {
      ...uiNode("note", 40, 40),
      data: { label: "note", serviceType: "application", subType: "Note", decorative: true },
    };
    const nodes = mergeServiceNodes(
      [uiNode("pg", 180, 160), decorative],
      [service("a"), service("b")],
    );
    assert.deepEqual(nodes.map((node) => node.id), ["note", serviceNodeId("a"), serviceNodeId("b")]);
    assert.ok(nodes.slice(1).every((node) => node.deletable === false));
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
    assert.equal(data.publicUrl, undefined);
  });

  it("maps image, postgres and redis services and hides non-http urls", () => {
    const image = serviceToNodeData(service("img", {
      type: "image",
      name: "nginx",
      port: 80,
      image: { image: "nginx:1.27", resolved_image: "nginx@sha256:abc" },
      latest_deployment: { status: "running", public_url: "http://nginx-app.localtest.me" },
    }));
    assert.equal(image.platformType, "image");
    assert.equal(image.subType, "Docker Image");
    assert.equal(image.imageRef, "nginx:1.27");
    assert.equal(image.resolvedImage, "nginx@sha256:abc");
    assert.equal(image.publicUrl, "http://nginx-app.localtest.me/");
    assert.equal(image.detailText, "nginx:1.27");

    const postgres = serviceToNodeData(service("pg", {
      type: "postgres",
      addon: { engine: "postgres", version: "16", storage_mb: 1024, url_env: "DATABASE_URL" },
      latest_deployment: { status: "running", public_url: "http://db.example" },
    }));
    assert.equal(postgres.serviceType, "database");
    assert.equal(postgres.urlEnv, "DATABASE_URL");
    assert.equal(postgres.publicUrl, undefined);
    assert.equal(postgres.statusText, "Running");

    const redis = serviceToNodeData(service("redis", { type: "redis" }));
    assert.equal(redis.serviceType, "cache");
    assert.equal(redis.urlEnv, "REDIS_URL");
    assert.equal(redis.statusText, "Not provisioned yet");

    const worker = serviceToNodeData(service("job", {
      type: "worker",
      latest_deployment: { status: "running", public_url: "http://job.example" },
    }));
    assert.equal(worker.publicUrl, undefined);

    const unsafe = serviceToNodeData(service("web", {
      latest_deployment: { status: "running", public_url: "javascript:alert(1)" },
    }));
    assert.equal(unsafe.publicUrl, undefined);
  });
});

describe("environment selection", () => {
  const environments = [
    { id: "env-prod", name: "production", type: "production" },
    { id: "env-stage", name: "staging", type: "staging" },
  ];

  it("prefers the requested id or name, otherwise production", () => {
    assert.equal(pickEnvironmentId(environments, "env-stage"), "env-stage");
    assert.equal(pickEnvironmentId(environments, "staging"), "env-stage");
    assert.equal(pickEnvironmentId(environments, "missing"), "env-prod");
    assert.equal(pickEnvironmentId(environments, null), "env-prod");
    assert.equal(pickEnvironmentId([], "env-prod"), null);
  });

  it("filters services to the selected environment", () => {
    const services = [
      { id: "a", environment_id: "env-prod" },
      { id: "b", environment_id: "env-stage" },
    ];
    assert.deepEqual(servicesInEnvironment(services, "env-stage").map((service) => service.id), ["b"]);
    assert.equal(servicesInEnvironment(services, null).length, 2);
  });
});
