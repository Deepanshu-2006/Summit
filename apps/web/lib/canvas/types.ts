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
  databaseEngine?: "postgresql" | "mysql" | "redis";
  databaseName?: string;
  port?: number;
  connectionString?: string;

  // Environment variables
  envVars?: EnvironmentVariable[];
  updatedAt?: string;
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
