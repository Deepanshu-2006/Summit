/**
 * Summit Jetway PaaS API Specification & Shared TypeScript Types
 * Generated and aligned with packages/api_spec/openapi.yaml
 */

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  service: string;
  version: string;
  region: string;
  edge_routing: string;
  uptime_seconds: number;
  timestamp: string;
}

export interface Environment {
  name: string;
  url: string;
  live: boolean;
}

export interface ServiceStatus {
  status?: string;
  instances?: number;
  edge_response_ms?: number;
  latency_ms?: number;
  auth?: string;
  engine?: string;
  pool?: string;
  connections?: number;
  queue_size?: number;
  active_jobs?: number;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  status: "active" | "deploying" | "paused" | "failed";
  framework: string;
  version: string;
  region: string;
  edge_routing: string;
  environments: Environment[];
  services: Record<string, ServiceStatus>;
  updated_at: string;
}

export type ResourceType =
  | "database"
  | "key-value"
  | "storage"
  | "compute"
  | "certificate"
  | "web";

export type ResourceStatus =
  | "available"
  | "provisioned"
  | "active"
  | "terminating";

export interface ResourceItem {
  id: string;
  name: string;
  type: ResourceType;
  status: ResourceStatus;
  tier: string;
  region: string;
  created_at: string;
}

export interface CreateResourceRequest {
  name: string;
  type: ResourceType;
  tier?: string;
  region?: string;
}

export interface ResourceListResponse {
  data: ResourceItem[];
  total: number;
  project: string;
  environment: string;
  retrieved_at: string;
}

export interface ResourceCreatedResponse {
  success: boolean;
  message: string;
  data: ResourceItem;
}

export interface ReleaseItem {
  id: string;
  version: string;
  branch: string;
  commit: string;
  status: "published" | "queued" | "verified" | "failed";
  deployed_to: string;
  deployed_at: string;
  author: string;
}

export interface CreateReleaseRequest {
  version: string;
  branch: string;
  commit?: string;
  changelog?: string;
}

export interface ReleaseCreatedResponse {
  success: boolean;
  message: string;
  data: ReleaseItem & {
    changelog?: string;
    traffic_allocation?: string;
    edge_regions?: string[];
  };
}

export interface MetricsResponse {
  cluster_cpu_usage_pct: number;
  cluster_memory_usage_pct: number;
  active_connections: number;
  edge_request_rate_rps: number;
  timestamp: string;
}

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  pod: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  errors?: string[];
}
