/**
 * SUMMIT Infrastructure Canvas — Type System & Data Architecture
 * Minimal, premium architectural graph model for visual node-based infrastructure editing.
 */

import type { Node, Edge } from "@xyflow/react";

export type NodeType =
  | "repository"
  | "application"
  | "database"
  | "cache"
  | "worker";

export type Environment = "production" | "staging" | "preview";

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
}

export interface SummitNodeData extends Record<string, unknown> {
  label: string;
  serviceType: NodeType;
  subType: string; // e.g. "Web Application", "API Service", "PostgreSQL", "Redis", "GitHub Repository"

  // Source / Repository fields
  repoUrl?: string;
  branch?: string;

  // Application / Worker fields
  buildCommand?: string;
  startCommand?: string;
  rootDir?: string;

  // Database / Cache fields
  databaseEngine?: "postgresql" | "mysql" | "redis" | "mongodb";
  databaseName?: string;
  port?: number;
  connectionString?: string;
  region?: string;
  memorySize?: string;
  username?: string;

  // Environment variables
  envVars?: EnvironmentVariable[];
  updatedAt?: string;

  // Backend-managed service fields (present only on nodes that mirror a real
  // platform service; populated from the API on every load, never from storage).
  serviceId?: string;
  /** Backend service type. Drives icons, deploy affordances, and delete copy. */
  platformType?: "web" | "worker" | "image" | "postgres" | "redis";
  environmentId?: string;
  environmentName?: string;
  repositoryFullName?: string;
  sourceStatus?: string;
  autoDeploy?: boolean;
  deploymentStatus?: string;
  commitSha?: string;
  publicUrl?: string;
  imageRef?: string;
  resolvedImage?: string;
  addonEngine?: "postgres" | "redis";
  addonVersion?: string;
  storageMb?: number;
  /** Env var injected into other services, e.g. DATABASE_URL. */
  urlEnv?: string;
  /** Secondary line on the node: repo, image reference, or addon env var. */
  detailText?: string;
  /** One-line summary shown on the node card. */
  statusText?: string;
  statusTone?: "ok" | "progress" | "error" | "idle";
  /** Kept in localStorage even without a backend service. Service drawings are not. */
  decorative?: boolean;
}

export type SummitNode = Node<SummitNodeData, "summitNode">;

export interface ProjectArchitecture {
  id: string;
  name: string;
  environment: Environment;
  nodes: SummitNode[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
  updatedAt: string;
}

export interface ResourceTemplate {
  category: "Compute" | "Data" | "Source";
  type: NodeType;
  subType: string;
  defaultLabel: string;
  description: string;
  icon: "layout" | "server" | "cpu" | "database" | "layers" | "git-branch";
  defaultConfig?: Partial<SummitNodeData>;
}
