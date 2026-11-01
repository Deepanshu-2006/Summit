/**
 * Summit Jetway PaaS API Specification & Shared TypeScript Types
 * Aligned with packages/api_spec/openapi.yaml (canonical OpenAPI 3.1 contract)
 *
 * This package defines the shared contract between the Go backend (apps/backend)
 * and the Next.js frontend (apps/web).
 *
 * The platform API types (ProjectSummary ... ManualDeploymentResponse) mirror
 * routes the Go backend serves under /v1. Types after the "Legacy" banner are
 * not backed by the Go API.
 */

// ---------------------------------------------------------------------------
// Platform API (Go backend, served under /v1). Matches openapi.yaml.
// ---------------------------------------------------------------------------

export type DeploymentStatus =
  | "queued"
  | "building"
  | "image_ready"
  | "deploying"
  | "health_checking"
  | "running"
  | "superseded"
  | "failed"
  | "cancelled"
  | "pending"
  | "active";

export interface ApiErrorEnvelope {
  error: { code: string; message: string; request_id: string };
}

export interface DeploymentSummary {
  id: string;
  project_id: string;
  environment_id: string;
  service_id: string | null;
  status: DeploymentStatus;
  commit_sha: string;
  branch: string;
  trigger_type: string;
  error_message: string | null;
  status_reason: string | null;
  image_ref: string | null;
  public_url: string | null;
  cancel_requested_at: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

export interface BuildSummary {
  id: string;
  status: "queued" | "dispatched" | "running" | "succeeded" | "failed" | "cancelled";
  current_stage: string | null;
  image_repository: string | null;
  image_tag: string | null;
  image_digest: string | null;
  error_message: string | null;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface DeploymentEvent {
  from_status: DeploymentStatus | null;
  to_status: DeploymentStatus;
  reason: string | null;
  created_at: string;
}

export interface DeploymentDetail extends DeploymentSummary {
  build: BuildSummary | null;
  events: DeploymentEvent[];
}

export interface DeploymentList {
  data: DeploymentSummary[];
  next_cursor: string | null;
}

export interface ServiceSource {
  repository_full_name: string;
  branch: string;
  root_directory: string;
  source_status: "active" | "disconnected" | "blocked";
  auto_deploy: boolean;
}

export interface ServiceSummary {
  id: string;
  project_id: string;
  environment_id: string;
  environment_name: string;
  name: string;
  type: "web" | "worker" | "cron";
  source: ServiceSource | null;
  latest_deployment: DeploymentSummary | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectSummary {
  id: string;
  slug: string;
  name: string;
  git_repository_url: string | null;
  default_branch: string;
  services_count: number;
  latest_deployment: DeploymentSummary | null;
  created_at: string;
  updated_at: string;
}

export interface EnvironmentSummary {
  id: string;
  name: string;
  type: "production" | "staging" | "preview";
  is_ephemeral: boolean;
}

export interface ProjectDetail extends ProjectSummary {
  environments: EnvironmentSummary[];
  services: ServiceSummary[];
}

export interface ProjectList {
  data: ProjectSummary[];
  next_cursor: string | null;
}

export interface CreateProjectRequest {
  name: string;
  slug?: string;
}

export interface UpdateProjectRequest {
  name?: string;
}

export interface CreateServiceRequest {
  name: string;
  type?: "web" | "worker";
  environment_id?: string | null;
}

export interface LogLine {
  id: number;
  timestamp: string;
  stream: "stdout" | "stderr" | "system";
  level: "debug" | "info" | "warn" | "error";
  stage: string | null;
  message: string;
}

export interface LogList {
  data: LogLine[];
  next_after: number | null;
}

export interface ManualDeploymentRequest {
  source?: { ref?: string };
  reason?: string;
}

export interface ManualDeploymentResponse {
  id: string;
  service_id: string;
  status: DeploymentStatus;
  commit_sha: string;
  build_job_id: string;
}

// ---------------------------------------------------------------------------
// Legacy mock-store types. The Go backend does NOT serve these (no
// /api/v1/resources, /releases or /observability routes); they remain only so
// existing apps/web imports keep compiling and can be deleted with the mocks.
// ---------------------------------------------------------------------------

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

export interface ProjectListResponse {
  data: Project[];
  total: number;
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

export interface DeleteResourceResponse {
  success: boolean;
  message: string;
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

export interface ReleaseListResponse {
  data: ReleaseItem[];
  total?: number;
}

export interface ReleaseCreatedData extends ReleaseItem {
  changelog?: string;
  traffic_allocation?: string;
  edge_regions?: string[];
}

export interface ReleaseCreatedResponse {
  success: boolean;
  message: string;
  data: ReleaseCreatedData;
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

export interface LogStreamResponse {
  service?: string;
  entries: LogEntry[];
}

export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  errors?: string[];
}

// ---------------------------------------------------------------------------
// Managed Agents API (Gate 2 slice). Matches openapi.yaml.
// ---------------------------------------------------------------------------

export type AgentDeploymentStatus =
  | "provisioning"
  | "active"
  | "draining"
  | "read_only"
  | "failed"
  | "terminated";

export type AgentSessionStatus =
  | "provisioning"
  | "active"
  | "read_only"
  | "purge_pending"
  | "purged"
  | "failed";

export interface CredentialRefSummary {
  name: string;
  secret_reference_id: string;
  purpose?: string;
}

export interface AgentConfig {
  model: string;
  instructions: string;
  tools?: string[];
  limits?: Record<string, unknown>;
  credential_references?: CredentialRefSummary[];
}

export interface CreateAgentRequest {
  name: string;
  description?: string;
  model: string;
  instructions: string;
  tools?: string[];
  limits?: Record<string, unknown>;
  credential_references?: CredentialRefSummary[];
}

export interface CreateRevisionRequest {
  model: string;
  instructions: string;
  tools?: string[];
  limits?: Record<string, unknown>;
  credential_references?: CredentialRefSummary[];
}

export interface CreateDeploymentRequest {
  environment_id: string;
  agent_revision_id: string;
  runtime_version?: string;
}

export interface CreateSessionRequest {}

export interface AgentResponse {
  id: string;
  project_id: string;
  name: string;
  description?: string | null;
  current_revision_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentSummaryResponse extends AgentResponse {
  current_revision_number?: number | null;
  active_deployment_id?: string | null;
  active_deployment_status?: AgentDeploymentStatus | null;
}

export interface AgentListResponse {
  data: AgentSummaryResponse[];
  next_cursor?: string | null;
}

export interface AgentRevision {
  id: string;
  agent_id: string;
  revision_number: number;
  config: AgentConfig;
  config_hash: string;
  created_at: string;
}

export interface RevisionListResponse {
  data: AgentRevision[];
}

export interface AgentDeployment {
  id: string;
  agent_id: string;
  agent_revision_id: string;
  project_id: string;
  environment_id: string;
  deployment_number: number;
  supersedes_deployment_id?: string | null;
  runtime_version: string;
  status: AgentDeploymentStatus;
  status_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeploymentListResponse {
  data: AgentDeployment[];
}

export interface AgentSession {
  id: string;
  deployment_id: string;
  pi_conversation_id?: string | null;
  actor_key_version: string;
  status: AgentSessionStatus;
  status_reason?: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface SessionListResponse {
  data: AgentSession[];
}

export interface AgentDetailResponse extends AgentResponse {
  current_revision?: AgentRevision | null;
  active_deployment?: AgentDeployment | null;
}
