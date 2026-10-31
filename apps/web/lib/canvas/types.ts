/**
 * SUMMIT Infrastructure Canvas — Type System & Data Architecture
 * Models Railway-grade project graphs, service nodes, connections, and metadata.
 */

import type { Node, Edge } from "@xyflow/react";

export type NodeType =
  | "repository"
  | "application"
  | "database"
  | "cache"
  | "worker"
  | "storage";

export type NodeStatus =
  | "idle"
  | "building"
  | "deploying"
  | "live"
  | "stopped"
  | "failed";

export type Environment = "production" | "staging" | "preview";

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
  isReference?: boolean;
  referenceSource?: string;
}

export interface ServiceMetrics {
  cpuPct: number;
  memoryMb: number;
  memoryLimitMb: number;
  latencyMs: number;
  requestsPerSec: number;
}

export interface DeploymentLogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

export interface SummitNodeData extends Record<string, unknown> {
  label: string;
  serviceType: NodeType;
  status: NodeStatus;
  subType?: string; // e.g. "Next.js", "Go API", "PostgreSQL 16", "Redis 7.2"
  region: string; // e.g. "cdg-1 (Paris)", "iad-1 (US East)"
  port?: number;
  
  // Repository-specific fields
  repoUrl?: string;
  branch?: string;
  autoDeploy?: boolean;
  commitSha?: string;

  // Application/Worker-specific fields
  framework?: string;
  buildCommand?: string;
  startCommand?: string;
  rootDir?: string;
  replicas?: number;
  liveUrl?: string;

  // Database/Cache/Storage-specific fields
  databaseEngine?: "postgresql" | "mysql" | "redis" | "mongodb";
  databaseVersion?: string;
  storageSizeGb?: number;
  connectionString?: string;
  sslRequired?: boolean;

  // Common configuration
  envVars: EnvironmentVariable[];
  metrics: ServiceMetrics;
  logs: DeploymentLogEntry[];
  updatedAt: string;
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
