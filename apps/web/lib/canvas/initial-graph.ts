/**
 * SUMMIT Infrastructure Canvas — Resource Templates & Persistence Engine
 * Empty-canvas default, structured graph serialization, and node factory.
 */

import type { Edge } from "@xyflow/react";
import type {
  ProjectArchitecture,
  SummitNode,
  ResourceTemplate,
} from "./types";

export const LOCAL_STORAGE_KEY_PREFIX = "summit:architecture:project:";

/**
 * Supported Resource Templates for the Node Selector
 */
export const SUPPORTED_RESOURCES: ResourceTemplate[] = [
  // Compute
  {
    category: "Compute",
    type: "application",
    subType: "Web Application",
    defaultLabel: "web-app",
    description: "Next.js, React, or static frontend application",
    icon: "layout",
    defaultConfig: {
      rootDir: "apps/web",
      buildCommand: "pnpm build",
      startCommand: "pnpm start",
      envVars: [
        { id: "ev_1", key: "NODE_ENV", value: "production" },
      ],
    },
  },
  {
    category: "Compute",
    type: "application",
    subType: "API Service",
    defaultLabel: "api-service",
    description: "Go, Node.js, or Python backend HTTP service",
    icon: "server",
    defaultConfig: {
      rootDir: "apps/api",
      buildCommand: "go build -o bin/api ./cmd/api",
      startCommand: "./bin/api",
      port: 8080,
      envVars: [
        { id: "ev_1", key: "PORT", value: "8080" },
      ],
    },
  },
  {
    category: "Compute",
    type: "worker",
    subType: "Background Worker",
    defaultLabel: "queue-worker",
    description: "Asynchronous task or queue processor",
    icon: "cpu",
    defaultConfig: {
      rootDir: "apps/worker",
      buildCommand: "go build -o bin/worker ./cmd/worker",
      startCommand: "./bin/worker",
      envVars: [],
    },
  },

  // Data
  {
    category: "Data",
    type: "database",
    subType: "PostgreSQL",
    defaultLabel: "postgres-db",
    description: "PostgreSQL 16 relational database cluster",
    icon: "database",
    defaultConfig: {
      databaseEngine: "postgresql",
      databaseName: "main_db",
      port: 5432,
      connectionString: "postgresql://postgres:***@localhost:5432/main_db",
      envVars: [],
    },
  },
  {
    category: "Data",
    type: "database",
    subType: "MySQL",
    defaultLabel: "mysql-db",
    description: "MySQL 8.4 relational database instance",
    icon: "database",
    defaultConfig: {
      databaseEngine: "mysql",
      databaseName: "app_db",
      port: 3306,
      connectionString: "mysql://root:***@localhost:3306/app_db",
      envVars: [],
    },
  },
  {
    category: "Data",
    type: "cache",
    subType: "Redis",
    defaultLabel: "redis-cache",
    description: "Redis 7.2 in-memory cache and key-value store",
    icon: "layers",
    defaultConfig: {
      databaseEngine: "redis",
      port: 6379,
      connectionString: "redis://localhost:6379",
      envVars: [],
    },
  },

  // Source
  {
    category: "Source",
    type: "repository",
    subType: "GitHub Repository",
    defaultLabel: "github-repo",
    description: "Source code repository and branch tracking",
    icon: "git-branch",
    defaultConfig: {
      repoUrl: "https://github.com/org/repo",
      branch: "main",
      envVars: [],
    },
  },
];

/**
 * Generates a clean, unique node ID
 */
export function generateNodeId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 7);
  return `${prefix}_${rand}`;
}

/**
 * Creates a brand new node on the canvas from a selected template
 */
export function createNodeFromTemplate(
  template: ResourceTemplate,
  position: { x: number; y: number }
): SummitNode {
  const id = generateNodeId(template.defaultLabel.replace(/[^a-z0-9]/gi, "_"));

  return {
    id,
    type: "summitNode",
    position,
    data: {
      label: template.defaultLabel,
      serviceType: template.type,
      subType: template.subType,
      ...template.defaultConfig,
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Default empty architecture state
 */
export function getEmptyArchitecture(id: string = "default"): ProjectArchitecture {
  return {
    id,
    name: "Untitled Project",
    environment: "production",
    nodes: [],
    edges: [],
    updatedAt: "",
  };
}

/**
 * Loads project architecture from localStorage.
 * IMPORTANT: Starts with an empty canvas if no saved state exists!
 */
export function loadProjectArchitecture(projectId: string = "default"): ProjectArchitecture {
  if (typeof window === "undefined") {
    return getEmptyArchitecture(projectId);
  }

  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${projectId}`);
    if (!raw) {
      return getEmptyArchitecture(projectId);
    }

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.nodes)) {
      return getEmptyArchitecture(projectId);
    }

    return {
      id: parsed.id || projectId,
      name: parsed.name || "Untitled Project",
      environment: parsed.environment || "production",
      nodes: parsed.nodes || [],
      edges: parsed.edges || [],
      viewport: parsed.viewport,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch (err) {
    console.error("Failed to load project from localStorage:", err);
    return getEmptyArchitecture(projectId);
  }
}

/**
 * Persists the architecture to localStorage
 */
export function saveProjectArchitecture(architecture: ProjectArchitecture): boolean {
  if (typeof window === "undefined") return false;

  try {
    localStorage.setItem(
      `${LOCAL_STORAGE_KEY_PREFIX}${architecture.id}`,
      JSON.stringify({
        ...architecture,
        updatedAt: new Date().toISOString(),
      })
    );
    return true;
  } catch (err) {
    console.error("Failed to save project architecture:", err);
    return false;
  }
}

/**
 * Clears saved project from localStorage
 */
export function clearProjectArchitecture(projectId: string = "default"): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}${projectId}`);
  } catch (err) {
    console.error("Failed to clear architecture:", err);
  }
}

/**
 * Export architecture as downloadable JSON
 */
export function exportProjectAsJson(arch: ProjectArchitecture): void {
  if (typeof window === "undefined") return;

  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(arch, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute(
    "download",
    `${arch.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-summit.json`
  );
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
