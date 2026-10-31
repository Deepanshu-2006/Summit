/**
 * Summit Project Dashboard — Mock Data & Local Persistence Engine
 * Believable developer platform demonstration records and canvas seed helpers.
 */

import type { DashboardProject, WorkspaceItem } from "./types";
import type { ProjectArchitecture, SummitNode } from "@/lib/canvas/types";
import { LOCAL_STORAGE_KEY_PREFIX } from "@/lib/canvas/initial-graph";

export const DASHBOARD_PROJECTS_STORAGE_KEY = "summit:dashboard:projects";
export const DASHBOARD_VIEW_MODE_KEY = "summit:dashboard:view_mode";

export const DEMO_WORKSPACES: WorkspaceItem[] = [
  {
    id: "ws_personal",
    name: "Personal",
    slug: "personal",
    plan: "Free",
    isCurrent: true,
  },
  {
    id: "ws_summit_eng",
    name: "Summit Engineering",
    slug: "summit-eng",
    plan: "Team Pro",
    isCurrent: false,
  },
  {
    id: "ws_production_mesh",
    name: "Production Mesh",
    slug: "production-mesh",
    plan: "Enterprise",
    isCurrent: false,
  },
];

export const INITIAL_DEMO_PROJECTS: DashboardProject[] = [
  {
    id: "proj_summit_web",
    name: "summit-web",
    description: "Production frontend and high-altitude edge deployment for the Summit cloud platform.",
    environment: "production",
    status: "active",
    type: "Next.js Application",
    icon: "layout",
    servicesCount: 3,
    branch: "main",
    region: "us-east-1",
    updatedAt: "12m ago",
    createdAt: "2026-10-14T10:00:00Z",
    template: "fullstack",
  },
  {
    id: "proj_api_gateway",
    name: "api-gateway",
    description: "High-throughput HTTP/gRPC ingress gateway with distributed rate limiting and token verification.",
    environment: "development",
    status: "active",
    type: "Go API Service",
    icon: "server",
    servicesCount: 2,
    branch: "dev",
    region: "us-east-1",
    updatedAt: "2h ago",
    createdAt: "2026-10-18T14:30:00Z",
    template: "api",
  },
  {
    id: "proj_graphmind",
    name: "graphmind",
    description: "Vector-assisted knowledge graph processor and semantic reasoning pipeline.",
    environment: "production",
    status: "draft",
    type: "Web Application",
    icon: "database",
    servicesCount: 4,
    branch: "feat/rag-pipeline",
    region: "us-west-2",
    updatedAt: "1d ago",
    createdAt: "2026-10-22T08:15:00Z",
    template: "fullstack",
  },
  {
    id: "proj_telemetry",
    name: "telemetry-service",
    description: "Real-time infrastructure telemetry daemon aggregating metrics and distributed audit logs.",
    environment: "staging",
    status: "active",
    type: "Background Worker",
    icon: "cpu",
    servicesCount: 2,
    branch: "staging",
    region: "eu-central-1",
    updatedAt: "3d ago",
    createdAt: "2026-10-25T16:45:00Z",
    template: "api",
  },
];

/**
 * Loads dashboard projects from localStorage.
 * Initializes with demo projects if nothing is stored yet.
 */
export function getStoredProjects(): DashboardProject[] {
  if (typeof window === "undefined") {
    return INITIAL_DEMO_PROJECTS;
  }

  try {
    const raw = localStorage.getItem(DASHBOARD_PROJECTS_STORAGE_KEY);
    if (!raw) {
      // First time initialization
      localStorage.setItem(
        DASHBOARD_PROJECTS_STORAGE_KEY,
        JSON.stringify(INITIAL_DEMO_PROJECTS)
      );
      // Seed architectures for the demo projects
      INITIAL_DEMO_PROJECTS.forEach(seedProjectCanvasArchitecture);
      return INITIAL_DEMO_PROJECTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return INITIAL_DEMO_PROJECTS;
  } catch (err) {
    console.error("Failed to read dashboard projects from localStorage:", err);
    return INITIAL_DEMO_PROJECTS;
  }
}

/**
 * Persists the project array to localStorage.
 */
export function saveStoredProjects(projects: DashboardProject[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DASHBOARD_PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  } catch (err) {
    console.error("Failed to save dashboard projects:", err);
  }
}

/**
 * Seeds the canvas architecture in localStorage for a project if not already present.
 */
export function seedProjectCanvasArchitecture(project: DashboardProject): void {
  if (typeof window === "undefined") return;

  const storageKey = `${LOCAL_STORAGE_KEY_PREFIX}${project.id}`;
  if (localStorage.getItem(storageKey)) {
    return; // Already exists, preserve user edits!
  }

  let nodes: SummitNode[] = [];
  let edges: ProjectArchitecture["edges"] = [];

  if (project.id === "proj_summit_web" || project.template === "fullstack") {
    nodes = [
      {
        id: "node_repo_init",
        type: "summitNode",
        position: { x: 180, y: 160 },
        data: {
          label: "summit-web",
          serviceType: "repository",
          subType: "GitHub Repository",
          repoUrl: "https://github.com/summit-platform/summit-web",
          branch: project.branch || "main",
          updatedAt: new Date().toISOString(),
        },
      },
      {
        id: "node_app_main",
        type: "summitNode",
        position: { x: 490, y: 160 },
        data: {
          label: "web-frontend",
          serviceType: "application",
          subType: "Next.js Application",
          rootDir: "apps/web",
          buildCommand: "pnpm build",
          startCommand: "pnpm start",
          envVars: [{ id: "ev_1", key: "NODE_ENV", value: project.environment }],
          updatedAt: new Date().toISOString(),
        },
      },
      {
        id: "node_db_pg",
        type: "summitNode",
        position: { x: 800, y: 160 },
        data: {
          label: "postgres-primary",
          serviceType: "database",
          subType: "PostgreSQL",
          databaseEngine: "postgresql",
          databaseName: "summit_prod",
          port: 5432,
          connectionString: "postgresql://postgres:***@summit.internal:5432/summit_prod",
          updatedAt: new Date().toISOString(),
        },
      },
    ];

    edges = [
      {
        id: "edge_repo_to_app",
        source: "node_repo_init",
        target: "node_app_main",
        type: "default",
        animated: true,
      },
      {
        id: "edge_app_to_db",
        source: "node_app_main",
        target: "node_db_pg",
        type: "default",
        animated: true,
      },
    ];
  } else if (project.id === "proj_api_gateway" || project.template === "api") {
    nodes = [
      {
        id: "node_gateway",
        type: "summitNode",
        position: { x: 260, y: 180 },
        data: {
          label: "api-gateway",
          serviceType: "application",
          subType: "Go API Service",
          rootDir: ".",
          buildCommand: "go build -o bin/api ./cmd/api",
          startCommand: "./bin/api",
          envVars: [{ id: "ev_1", key: "PORT", value: "8080" }],
          updatedAt: new Date().toISOString(),
        },
      },
      {
        id: "node_cache_redis",
        type: "summitNode",
        position: { x: 600, y: 180 },
        data: {
          label: "redis-cache",
          serviceType: "cache",
          subType: "Redis",
          databaseEngine: "redis",
          port: 6379,
          connectionString: "redis://cache.internal:6379",
          updatedAt: new Date().toISOString(),
        },
      },
    ];

    edges = [
      {
        id: "edge_gateway_to_cache",
        source: "node_gateway",
        target: "node_cache_redis",
        type: "default",
        animated: true,
      },
    ];
  } else if (project.id === "proj_graphmind") {
    nodes = [
      {
        id: "node_graph_api",
        type: "summitNode",
        position: { x: 240, y: 170 },
        data: {
          label: "graphmind-core",
          serviceType: "application",
          subType: "Python FastAPI",
          rootDir: "api",
          buildCommand: "pip install -r requirements.txt",
          startCommand: "uvicorn main:app --host 0.0.0.0 --port 8000",
          updatedAt: new Date().toISOString(),
        },
      },
      {
        id: "node_graph_db",
        type: "summitNode",
        position: { x: 580, y: 170 },
        data: {
          label: "vector-postgres",
          serviceType: "database",
          subType: "PostgreSQL + pgvector",
          databaseEngine: "postgresql",
          databaseName: "knowledge_vectors",
          port: 5432,
          connectionString: "postgresql://postgres:***@db.internal:5432/knowledge_vectors",
          updatedAt: new Date().toISOString(),
        },
      },
    ];

    edges = [
      {
        id: "edge_graph_to_db",
        source: "node_graph_api",
        target: "node_graph_db",
        type: "default",
        animated: true,
      },
    ];
  } else {
    // Empty canvas template
    nodes = [];
    edges = [];
  }

  const architecture: ProjectArchitecture = {
    id: project.id,
    name: project.name,
    environment: project.environment === "development" ? "staging" : (project.environment as any),
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(architecture));
  } catch (e) {
    console.error("Failed to seed canvas architecture:", e);
  }
}

