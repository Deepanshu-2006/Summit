import Fastify from "fastify";
import cors from "@fastify/cors";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  HealthResponse,
  Project,
  ResourceItem,
  CreateResourceRequest,
  ReleaseItem,
  CreateReleaseRequest,
  MetricsResponse,
  LogEntry,
} from "@summit/api-spec";

const server = Fastify({
  logger: true,
});

await server.register(cors, {
  origin: true,
  credentials: true,
});

// Seed data based on Jetway PaaS topology and docs/system_architechture.png
const projects: Project[] = [
  {
    id: "proj_meridian_01hn8y7",
    name: "Meridian Studio",
    slug: "meridian",
    status: "active",
    framework: "nextjs-ssr",
    version: "2.4.0",
    region: "cdg-1 (Paris)",
    edge_routing: "anycast",
    environments: [
      { name: "production", url: "https://meridian.jetway.app", live: true },
      { name: "staging", url: "https://staging-meridian.jetway.app", live: true },
      { name: "preview", url: "https://pr-42-meridian.jetway.app", live: false },
    ],
    services: {
      web: { status: "running", instances: 3, edge_response_ms: 12 },
      api: { status: "healthy", latency_ms: 18.4, auth: "mTLS" },
      database: { engine: "postgresql-16", pool: "active", connections: 12 },
      worker: { status: "active", queue_size: 0, active_jobs: 1 },
    },
    updated_at: new Date().toISOString(),
  },
];

const resources: ResourceItem[] = [
  {
    id: "res_db_primary",
    name: "Primary Postgres Cluster",
    type: "database",
    status: "available",
    tier: "dedicated-4cpu",
    region: "cdg-1 (Paris)",
    created_at: "2026-10-28T12:00:00Z",
  },
  {
    id: "res_redis_queue",
    name: "Job Broker Cache",
    type: "key-value",
    status: "available",
    tier: "standard-1gb",
    region: "cdg-1 (Paris)",
    created_at: "2026-10-28T14:30:00Z",
  },
  {
    id: "res_bucket_media",
    name: "Studio Architectural Assets",
    type: "storage",
    status: "available",
    tier: "multi-region-nvme",
    region: "global-edge",
    created_at: "2026-10-28T15:15:00Z",
  },
  {
    id: "res_cert_ssl",
    name: "meridian.jetway.app mTLS",
    type: "certificate",
    status: "active",
    tier: "anycast-ssl",
    region: "global-edge",
    created_at: "2026-10-28T18:00:00Z",
  },
];

const releases: ReleaseItem[] = [
  {
    id: "rel_01hn8y7p412a9",
    version: "2.4.0",
    branch: "main",
    commit: "8f3a21c",
    status: "published",
    deployed_to: "production",
    deployed_at: "2026-10-28T22:30:14Z",
    author: "Elena Rostova <elena@meridian.io>",
  },
];

// Health Check
server.get("/health", async (): Promise<HealthResponse> => {
  return {
    status: "healthy",
    service: "summit-control-plane-backend",
    version: "1.0.0",
    region: "cdg-1 (Paris)",
    edge_routing: "anycast",
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
});

server.get("/api/v1/health", async (): Promise<HealthResponse> => {
  return {
    status: "healthy",
    service: "meridian-api",
    version: "1.0.0",
    region: "cdg-1 (Paris)",
    edge_routing: "anycast",
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
});

// Projects
server.get("/api/v1/projects", async () => {
  return {
    data: projects,
    total: projects.length,
  };
});

server.get<{ Params: { slug: string } }>("/api/v1/projects/:slug", async (req, reply) => {
  const project = projects.find((p) => p.slug === req.params.slug);
  if (!project) {
    return reply.status(404).send({
      error: "Not Found",
      message: `Project with slug '${req.params.slug}' was not found.`,
    });
  }
  return project;
});

// Resources
server.get("/api/v1/resources", async () => {
  return {
    data: resources,
    total: resources.length,
    project: "meridian",
    environment: "production",
    retrieved_at: new Date().toISOString(),
  };
});

server.post<{ Body: CreateResourceRequest }>("/api/v1/resources", async (req, reply) => {
  const body = req.body;
  if (!body || typeof body !== "object") {
    return reply.status(400).send({
      error: "Bad Request",
      message: "Request body must be valid JSON.",
      code: "INVALID_JSON",
    });
  }

  const { name, type, tier, region } = body;
  const errors: string[] = [];
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    errors.push("Field 'name' (string) is required.");
  }
  const validTypes = ["database", "key-value", "storage", "compute", "certificate", "web"];
  if (!type || typeof type !== "string" || !validTypes.includes(type.toLowerCase())) {
    errors.push(`Field 'type' must be one of: ${validTypes.join(", ")}.`);
  }

  if (errors.length > 0) {
    return reply.status(400).send({
      error: "Validation Error",
      message: "Resource specification is invalid.",
      errors,
    });
  }

  const newResource: ResourceItem = {
    id: `res_${Math.random().toString(36).slice(2, 9)}`,
    name: name.trim(),
    type: type.toLowerCase() as ResourceItem["type"],
    tier: typeof tier === "string" && tier.trim() ? tier.trim() : "standard-compute",
    region: typeof region === "string" && region.trim() ? region.trim() : "cdg-1 (Paris)",
    status: "provisioned",
    created_at: new Date().toISOString(),
  };

  resources.unshift(newResource);

  return reply.status(201).header("x-jetway-resource-id", newResource.id).send({
    success: true,
    message: "Resource provisioned successfully.",
    data: newResource,
  });
});

// Releases
server.get("/api/v1/releases", async () => {
  return {
    data: releases,
  };
});

server.post<{ Body: CreateReleaseRequest }>("/api/v1/releases", async (req, reply) => {
  const body = req.body;
  if (!body || typeof body !== "object") {
    return reply.status(400).send({
      error: "Bad Request",
      message: "Request body must be valid JSON.",
      code: "INVALID_JSON",
    });
  }

  const { version, branch, commit, changelog } = body;
  const errors: string[] = [];

  if (!version || typeof version !== "string" || !/^\d+\.\d+(\.\d+)?(-[a-zA-Z0-9.]+)?$/.test(version.trim())) {
    errors.push("Field 'version' must follow semantic versioning (e.g. '2.4.1' or '2.5.0-rc1').");
  }
  if (!branch || typeof branch !== "string" || branch.trim().length === 0) {
    errors.push("Field 'branch' (e.g. 'main', 'production') is required.");
  }

  if (errors.length > 0) {
    return reply.status(400).send({
      error: "Invalid Release Manifest",
      message: "Release specification failed verification.",
      errors,
    });
  }

  const newRelease: ReleaseItem = {
    id: `rel_${Math.random().toString(36).slice(2, 10)}`,
    version: version.trim(),
    branch: branch.trim(),
    commit: typeof commit === "string" && commit.trim() ? commit.trim() : "8f3a21c",
    status: "published",
    deployed_to: "production",
    deployed_at: new Date().toISOString(),
    author: "Elena Rostova <elena@meridian.io>",
  };

  releases.unshift(newRelease);

  return reply.status(201).header("x-jetway-release-id", newRelease.id).send({
    success: true,
    message: "Release published to distributed edge mesh.",
    data: {
      ...newRelease,
      changelog: typeof changelog === "string" ? changelog : "Automated CI/CD build deployment",
      traffic_allocation: "100%",
      edge_regions: ["cdg-1", "fra-1", "lhr-1", "iad-1", "nrt-1"],
    },
  });
});

// Observability: Metrics (Prometheus)
server.get("/api/v1/observability/metrics", async (): Promise<MetricsResponse> => {
  return {
    cluster_cpu_usage_pct: 24.6,
    cluster_memory_usage_pct: 41.2,
    active_connections: 840,
    edge_request_rate_rps: 182.5,
    timestamp: new Date().toISOString(),
  };
});

// Observability: Logs (Fluent Bit / Grafana Loki)
server.get("/api/v1/observability/logs", async () => {
  const mockLogs: LogEntry[] = [
    {
      timestamp: new Date(Date.now() - 1000 * 30).toISOString(),
      level: "info",
      message: "[traefik] Ingress route resolved: meridian.jetway.app -> web-service (cdg-1)",
      pod: "traefik-ingress-7b4459b-v89z",
    },
    {
      timestamp: new Date(Date.now() - 1000 * 18).toISOString(),
      level: "info",
      message: "[buildkit] Rootless build container image push verified: oci://registry.jetway.internal/apps/meridian:2.4.0",
      pod: "builder-rootless-d6f78a",
    },
    {
      timestamp: new Date(Date.now() - 1000 * 5).toISOString(),
      level: "info",
      message: "[eso] External Secrets Operator synced AWS secrets to user namespace",
      pod: "eso-controller-587fc-2m8q",
    },
  ];

  return {
    service: "meridian-platform",
    entries: mockLogs,
  };
});

// Serve OpenAPI Spec
server.get("/openapi.yaml", async (_, reply) => {
  try {
    const specPath = resolve(process.cwd(), "../../packages/api_spec/openapi.yaml");
    const content = readFileSync(specPath, "utf-8");
    return reply.type("text/yaml").send(content);
  } catch {
    const fallbackPath = resolve(process.cwd(), "packages/api_spec/openapi.yaml");
    const content = readFileSync(fallbackPath, "utf-8");
    return reply.type("text/yaml").send(content);
  }
});

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";

try {
  await server.listen({ port, host });
  console.log(`🚀 Summit PaaS Backend Server listening on http://localhost:${port}`);
  console.log(`📋 OpenAPI Spec available at http://localhost:${port}/openapi.yaml`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
