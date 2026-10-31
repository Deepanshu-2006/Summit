/**
 * SUMMIT Infrastructure Canvas — Initial Graph State & Persistence Engine
 * Provides pre-seeded architectures, node factories, and localStorage persistence.
 */

import type { Edge } from "@xyflow/react";
import type { ProjectArchitecture, SummitNode, SummitNodeData, NodeType } from "./types";

export const LOCAL_STORAGE_KEY_PREFIX = "summit:architecture:project:";

/**
 * Canonical Starter Architecture: "Meridian Platform"
 * A production-grade multi-tier architecture with Repository, Web, API, Postgres, Redis, and Worker.
 */
export const INITIAL_NODES: SummitNode[] = [
  {
    id: "node_repo_meridian",
    type: "summitNode",
    position: { x: 60, y: 180 },
    data: {
      label: "meridian-platform",
      serviceType: "repository",
      status: "live",
      subType: "GitHub Monorepo",
      region: "Global Edge",
      repoUrl: "https://github.com/acme-corp/meridian-platform",
      branch: "main",
      commitSha: "8f3a21c",
      autoDeploy: true,
      envVars: [],
      metrics: { cpuPct: 0, memoryMb: 0, memoryLimitMb: 0, latencyMs: 14, requestsPerSec: 0 },
      logs: [
        { id: "log_1", timestamp: "12:00:15", level: "info", message: "Webhook linked to main branch" },
        { id: "log_2", timestamp: "12:01:02", level: "success", message: "Commit 8f3a21c verified (Signed)" },
      ],
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "node_app_web",
    type: "summitNode",
    position: { x: 380, y: 80 },
    data: {
      label: "meridian-web",
      serviceType: "application",
      status: "live",
      subType: "Next.js 16 SSR",
      region: "cdg-1 (Paris)",
      port: 3000,
      framework: "Next.js (Turbopack)",
      buildCommand: "pnpm build",
      startCommand: "pnpm start",
      rootDir: "apps/web",
      replicas: 2,
      liveUrl: "https://meridian.summit.dev",
      envVars: [
        { id: "ev_1", key: "NEXT_PUBLIC_API_URL", value: "https://api-meridian.summit.dev", isSecret: false },
        { id: "ev_2", key: "NODE_ENV", value: "production", isSecret: false },
      ],
      metrics: { cpuPct: 14, memoryMb: 184, memoryLimitMb: 512, latencyMs: 12, requestsPerSec: 240 },
      logs: [
        { id: "log_w1", timestamp: "12:01:14", level: "info", message: "Turbopack compilation successful in 1.4s" },
        { id: "log_w2", timestamp: "12:01:18", level: "success", message: "Deployed to 28 Anycast Edge POPS" },
      ],
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "node_app_api",
    type: "summitNode",
    position: { x: 380, y: 340 },
    data: {
      label: "meridian-api",
      serviceType: "application",
      status: "live",
      subType: "Go 1.23 REST Engine",
      region: "cdg-1 (Paris)",
      port: 4000,
      framework: "Go Standard Library",
      buildCommand: "go build -o bin/api ./cmd/api",
      startCommand: "./bin/api",
      rootDir: "apps/backend",
      replicas: 3,
      liveUrl: "https://api-meridian.summit.dev",
      envVars: [
        {
          id: "ev_a1",
          key: "DATABASE_URL",
          value: "${{meridian-postgres.CONNECTION_URL}}",
          isSecret: true,
          isReference: true,
          referenceSource: "node_db_postgres",
        },
        {
          id: "ev_a2",
          key: "REDIS_URL",
          value: "${{meridian-cache.CONNECTION_URL}}",
          isSecret: true,
          isReference: true,
          referenceSource: "node_cache_redis",
        },
        { id: "ev_a3", key: "JWT_SECRET", value: "••••••••••••••••", isSecret: true },
      ],
      metrics: { cpuPct: 8, memoryMb: 64, memoryLimitMb: 256, latencyMs: 4.8, requestsPerSec: 620 },
      logs: [
        { id: "log_a1", timestamp: "12:01:10", level: "info", message: "Connection pool established to Postgres" },
        { id: "log_a2", timestamp: "12:01:12", level: "success", message: "Listening on :4000 (HTTP/2 Anycast)" },
      ],
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "node_db_postgres",
    type: "summitNode",
    position: { x: 740, y: 220 },
    data: {
      label: "meridian-postgres",
      serviceType: "database",
      status: "live",
      subType: "PostgreSQL 16 Cluster",
      region: "cdg-1 (Paris)",
      port: 5432,
      databaseEngine: "postgresql",
      databaseVersion: "16.4",
      storageSizeGb: 20,
      connectionString: "postgresql://summit_admin:••••••••@cdg1-pg.summit.internal:5432/meridian_prod",
      sslRequired: true,
      envVars: [
        { id: "ev_db1", key: "POSTGRES_DB", value: "meridian_prod", isSecret: false },
        { id: "ev_db2", key: "POSTGRES_USER", value: "summit_admin", isSecret: false },
        { id: "ev_db3", key: "POSTGRES_PASSWORD", value: "smmt_sec_99a81c4", isSecret: true },
      ],
      metrics: { cpuPct: 18, memoryMb: 412, memoryLimitMb: 2048, latencyMs: 1.2, requestsPerSec: 480 },
      logs: [
        { id: "log_d1", timestamp: "12:00:00", level: "info", message: "Continuous WAL archiving active (PITR 30d)" },
        { id: "log_d2", timestamp: "12:00:02", level: "success", message: "Storage volume mounted: 20 GB NVMe" },
      ],
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "node_cache_redis",
    type: "summitNode",
    position: { x: 740, y: 460 },
    data: {
      label: "meridian-cache",
      serviceType: "cache",
      status: "live",
      subType: "Redis 7.2 In-Memory",
      region: "cdg-1 (Paris)",
      port: 6379,
      databaseEngine: "redis",
      databaseVersion: "7.2.5",
      storageSizeGb: 2,
      connectionString: "redis://default:••••••••@cdg1-redis.summit.internal:6379",
      sslRequired: true,
      envVars: [
        { id: "ev_r1", key: "REDIS_MAX_MEMORY", value: "1gb", isSecret: false },
        { id: "ev_r2", key: "REDIS_POLICY", value: "allkeys-lru", isSecret: false },
      ],
      metrics: { cpuPct: 4, memoryMb: 88, memoryLimitMb: 1024, latencyMs: 0.4, requestsPerSec: 1200 },
      logs: [
        { id: "log_c1", timestamp: "12:00:05", level: "success", message: "In-memory snapshot RDB written to NVMe" },
      ],
      updatedAt: new Date().toISOString(),
    },
  },
  {
    id: "node_worker_queue",
    type: "summitNode",
    position: { x: 740, y: 640 },
    data: {
      label: "meridian-worker",
      serviceType: "worker",
      status: "live",
      subType: "Async Queue Processor",
      region: "cdg-1 (Paris)",
      framework: "Go Worker",
      buildCommand: "go build -o bin/worker ./cmd/worker",
      startCommand: "./bin/worker --concurrency=8",
      rootDir: "apps/backend",
      replicas: 1,
      envVars: [
        {
          id: "ev_w1",
          key: "REDIS_URL",
          value: "${{meridian-cache.CONNECTION_URL}}",
          isSecret: true,
          isReference: true,
          referenceSource: "node_cache_redis",
        },
        { id: "ev_w2", key: "QUEUE_NAME", value: "meridian_webhooks", isSecret: false },
      ],
      metrics: { cpuPct: 6, memoryMb: 42, memoryLimitMb: 256, latencyMs: 0, requestsPerSec: 18 },
      logs: [
        { id: "log_wk1", timestamp: "12:01:20", level: "info", message: "Listening for job events on queue: meridian_webhooks" },
      ],
      updatedAt: new Date().toISOString(),
    },
  },
];

export const INITIAL_EDGES: Edge[] = [
  {
    id: "edge_repo_to_web",
    source: "node_repo_meridian",
    target: "node_app_web",
    animated: true,
    style: { stroke: "#D88762", strokeWidth: 1.8 },
  },
  {
    id: "edge_repo_to_api",
    source: "node_repo_meridian",
    target: "node_app_api",
    animated: true,
    style: { stroke: "#D88762", strokeWidth: 1.8 },
  },
  {
    id: "edge_web_to_api",
    source: "node_app_web",
    target: "node_app_api",
    animated: true,
    style: { stroke: "#8E8C86", strokeWidth: 1.5, strokeDasharray: "4 4" },
  },
  {
    id: "edge_api_to_db",
    source: "node_app_api",
    target: "node_db_postgres",
    animated: true,
    style: { stroke: "#83B69A", strokeWidth: 1.8 },
  },
  {
    id: "edge_api_to_cache",
    source: "node_app_api",
    target: "node_cache_redis",
    animated: true,
    style: { stroke: "#D6AD72", strokeWidth: 1.8 },
  },
  {
    id: "edge_cache_to_worker",
    source: "node_cache_redis",
    target: "node_worker_queue",
    animated: true,
    style: { stroke: "#D6AD72", strokeWidth: 1.8 },
  },
];

/**
 * Node Template Catalog for Toolbar Palette
 */
export interface NodeTemplate {
  serviceType: NodeType;
  name: string;
  category: "compute" | "database" | "storage" | "source";
  subType: string;
  icon: string;
  description: string;
  defaultData: Partial<SummitNodeData>;
}

export const NODE_TEMPLATES: NodeTemplate[] = [
  // Compute & Services
  {
    serviceType: "application",
    name: "Web Application",
    category: "compute",
    subType: "Next.js / Frontend",
    icon: "Layout",
    description: "Next.js, Remix, Astro or Vite frontend application",
    defaultData: {
      port: 3000,
      framework: "Next.js",
      buildCommand: "pnpm build",
      startCommand: "pnpm start",
      replicas: 1,
    },
  },
  {
    serviceType: "application",
    name: "API Backend",
    category: "compute",
    subType: "Go / Node / Python API",
    icon: "Server",
    description: "High-performance HTTP REST, GraphQL, or gRPC service",
    defaultData: {
      port: 4000,
      framework: "Go REST API",
      buildCommand: "go build -o bin/api ./cmd/api",
      startCommand: "./bin/api",
      replicas: 1,
    },
  },
  {
    serviceType: "worker",
    name: "Background Worker",
    category: "compute",
    subType: "Queue Consumer / Cron",
    icon: "Cpu",
    description: "Asynchronous job runner, queue processor, or scheduled task",
    defaultData: {
      framework: "Queue Worker",
      buildCommand: "pnpm build",
      startCommand: "pnpm start:worker",
      replicas: 1,
    },
  },

  // Databases & Caches
  {
    serviceType: "database",
    name: "PostgreSQL Database",
    category: "database",
    subType: "PostgreSQL 16",
    icon: "Database",
    description: "Managed relational database with auto-scaling storage & WAL backups",
    defaultData: {
      port: 5432,
      databaseEngine: "postgresql",
      databaseVersion: "16.4",
      storageSizeGb: 10,
      sslRequired: true,
    },
  },
  {
    serviceType: "cache",
    name: "Redis Cache",
    category: "database",
    subType: "Redis 7.2",
    icon: "Layers",
    description: "In-memory key-value data store for sessions, caching, and pub/sub",
    defaultData: {
      port: 6379,
      databaseEngine: "redis",
      databaseVersion: "7.2.5",
      storageSizeGb: 1,
      sslRequired: true,
    },
  },
  {
    serviceType: "database",
    name: "MySQL Database",
    category: "database",
    subType: "MySQL 8.4",
    icon: "Database",
    description: "ACID-compliant relational database engine",
    defaultData: {
      port: 3306,
      databaseEngine: "mysql",
      databaseVersion: "8.4",
      storageSizeGb: 10,
    },
  },

  // Storage & Source
  {
    serviceType: "repository",
    name: "GitHub Repository",
    category: "source",
    subType: "Git Version Control",
    icon: "GitBranch",
    description: "Source code repository with automatic deployment on commit push",
    defaultData: {
      branch: "main",
      autoDeploy: true,
    },
  },
  {
    serviceType: "storage",
    name: "Object Storage Bucket",
    category: "storage",
    subType: "S3-Compatible NVMe",
    icon: "HardDrive",
    description: "Edge-distributed object storage with zero egress fees",
    defaultData: {
      storageSizeGb: 50,
      region: "Global Anycast",
    },
  },
];

/**
 * Creates a new node instance from a template with unique IDs and clean defaults
 */
export function createNodeFromTemplate(
  template: NodeTemplate,
  position: { x: number; y: number }
): SummitNode {
  const slug = template.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const randomSuffix = Math.random().toString(36).slice(2, 6);
  const id = `node_${template.serviceType}_${randomSuffix}`;
  const label = `${slug}-${randomSuffix}`;

  return {
    id,
    type: "summitNode",
    position,
    data: {
      label,
      serviceType: template.serviceType,
      status: "idle",
      subType: template.subType,
      region: "cdg-1 (Paris)",
      envVars: [],
      metrics: {
        cpuPct: 0,
        memoryMb: 0,
        memoryLimitMb: template.serviceType === "database" ? 1024 : 512,
        latencyMs: 0,
        requestsPerSec: 0,
      },
      logs: [
        {
          id: `log_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: "info",
          message: `Created ${template.name} service`,
        },
      ],
      updatedAt: new Date().toISOString(),
      ...template.defaultData,
    },
  };
}

/**
 * Local Storage Persistence Helpers
 */
export function loadProjectArchitecture(projectId: string = "default"): ProjectArchitecture {
  if (typeof window === "undefined") {
    return {
      id: projectId,
      name: "Meridian Studio",
      environment: "production",
      nodes: INITIAL_NODES,
      edges: INITIAL_EDGES,
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${projectId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as ProjectArchitecture;
      if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Failed to load project from localStorage:", err);
  }

  // Fallback to initial canonical architecture
  const initialArch: ProjectArchitecture = {
    id: projectId,
    name: "Meridian Studio",
    environment: "production",
    nodes: INITIAL_NODES,
    edges: INITIAL_EDGES,
    viewport: { x: 40, y: 40, zoom: 0.95 },
    updatedAt: new Date().toISOString(),
  };

  saveProjectArchitecture(initialArch);
  return initialArch;
}

export function saveProjectArchitecture(project: ProjectArchitecture): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify({
      ...project,
      updatedAt: new Date().toISOString(),
    });
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${project.id}`, serialized);
  } catch (err) {
    console.error("Failed to save project to localStorage:", err);
  }
}

export function exportProjectAsJson(project: ProjectArchitecture): string {
  return JSON.stringify(project, null, 2);
}

export function importProjectFromJson(jsonStr: string): ProjectArchitecture | null {
  try {
    const parsed = JSON.parse(jsonStr) as ProjectArchitecture;
    if (parsed && parsed.name && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
      return {
        ...parsed,
        id: `proj_${Math.random().toString(36).slice(2, 9)}`,
        updatedAt: new Date().toISOString(),
      };
    }
  } catch {
    return null;
  }
  return null;
}

