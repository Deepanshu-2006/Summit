import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  draftFromChooser,
  orderForDeployAll,
  parseImageReference,
  parseServicePort,
  serviceNameFromImage,
} from "./service-draft.ts";

describe("image references", () => {
  it("accepts common image refs and rejects empty or unsafe values", () => {
    assert.equal(parseImageReference("nginx:1.27"), "nginx:1.27");
    assert.equal(parseImageReference(" NGINX:Alpine "), "nginx:alpine");
    assert.equal(parseImageReference("ghcr.io/org/app:tag"), "ghcr.io/org/app:tag");
    assert.equal(parseImageReference("localhost:5000/myapp:latest"), "localhost:5000/myapp:latest");
    assert.equal(parseImageReference(""), null);
    assert.equal(parseImageReference("nginx:1.27 extra"), null);
    assert.equal(parseImageReference("http://nginx"), null);
    assert.equal(parseServicePort(""), 80);
    assert.equal(parseServicePort("8080"), 8080);
    assert.equal(parseServicePort("0"), null);
    assert.equal(parseServicePort("70000"), null);
    assert.equal(serviceNameFromImage("ghcr.io/org/app:tag"), "app");
  });
});

describe("chooser drafts", () => {
  it("maps docker, worker, postgres and redis onto real service types", () => {
    const image = draftFromChooser("docker", { label: "edge", image: "nginx:1.27", port: 80 });
    assert.equal(image.ok, true);
    assert.deepEqual(image.draft, {
      name: "edge",
      type: "image",
      image: "nginx:1.27",
      port: 80,
      connectRepository: false,
    });

    const worker = draftFromChooser("worker", { label: "jobs" });
    assert.equal(worker.draft.type, "worker");
    assert.equal(worker.draft.connectRepository, true);

    assert.equal(draftFromChooser("database", { label: "main", databaseEngine: "postgresql" }).draft.type, "postgres");
    assert.equal(draftFromChooser("cache", { label: "cache" }).draft.type, "redis");
    assert.equal(draftFromChooser("database", { databaseEngine: "redis", label: "cache" }).draft.type, "redis");
    assert.equal(draftFromChooser("github"), null);

    const mongo = draftFromChooser("database", { databaseEngine: "mongodb", label: "docs" });
    assert.equal(mongo.ok, false);
    assert.equal(mongo.reason, "unsupported");

    const missing = draftFromChooser("docker", { image: "" });
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, "invalid");
  });

  it("deploys databases before other services", () => {
    const ordered = orderForDeployAll([
      { id: "web", type: "web" },
      { id: "pg", type: "postgres" },
      { id: "img", type: "image" },
      { id: "redis", type: "redis" },
    ]);
    assert.deepEqual(ordered.map((service) => service.id), ["pg", "redis", "web", "img"]);
  });
});
