/**
 * Typed client for the Summit platform backend (proxied through
 * `/api/platform/v1/*`). All payloads are snake_case JSON; timestamps are RFC3339.
 */

import type { DashboardProject, ProjectStatus } from "./dashboard/types";

// ---------------------------------------------------------------------------
// Shared request helper
// ---------------------------------------------------------------------------

export class PlatformApiError extends Error {
  status: number;
  code?: string;
  requestId?: string;

  constructor(message: string, status: number, code?: string, requestId?: string) {
    super(message);
    this.name = "PlatformApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

function errorFromBody(body: unknown, status: number): PlatformApiError {
  const fallback = `Backend request failed (${status})`;
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    // Go backend envelope: { error: { code, message, request_id } }
    if (record.error && typeof record.error === "object") {
      const inner = record.error as Record<string, unknown>;
      return new PlatformApiError(
        typeof inner.message === "string" && inner.message ? inner.message : fallback,
        status,
        typeof inner.code === "string" ? inner.code : undefined,
        typeof inner.request_id === "string" ? inner.request_id : undefined,
      );
    }
    // Proxy-generated errors: { error: "Backend API is unavailable" }
    if (typeof record.error === "string" && record.error) {
      return new PlatformApiError(record.error, status);
    }
    if (typeof record.message === "string" && record.message) {
      return new PlatformApiError(
        record.message,
        status,
        typeof record.code === "string" ? record.code : undefined,
      );
    }
  }
  return new PlatformApiError(fallback, status);
}

export async function platformRequest<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/platform${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw errorFromBody(body, response.status);
  return body as T;
}

/** Human-readable message for any thrown value, with hints for common failures. */
export function describeApiError(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof PlatformApiError) {
    if (error.status === 503) {
      return `${error.message}. The Summit backend is unavailable right now — try again shortly.`;
    }
    // Go's httpx emits upper-case codes (SERVICE_SOURCE_NOT_FOUND); compare case-insensitively.
    if (error.code?.toUpperCase() === "SERVICE_SOURCE_NOT_FOUND") {
      return "No repository is connected to this service yet. Connect a repository first.";
    }
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// Types
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
  // Legacy values still present in the backend enum.
  | "pending"
  | "active";

export type DeploymentSummary = {
  id: string;
  project_id: string;
  environment_id: string;
  service_id: string | null;
  status: DeploymentStatus;
  commit_sha: string | null;
  branch: string | null;
  trigger_type: string | null;
  error_message: string | null;
  status_reason: string | null;
  image_ref: string | null;
  public_url: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
};

export type DeploymentBuild = {
  id: string;
  status: string;
  current_stage: string | null;
  image_repository: string | null;
  image_tag: string | null;
  image_digest: string | null;
  error_message: string | null;
  requested_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export type DeploymentEvent = {
  from_status: DeploymentStatus | null;
  to_status: DeploymentStatus;
  reason: string | null;
  created_at: string;
};

export type DeploymentDetail = DeploymentSummary & {
  build: DeploymentBuild | null;
  events: DeploymentEvent[];
};

export type DeploymentLogEntry = {
  id: number;
  timestamp: string;
  stream: string;
  message: string;
};

export type ProjectSummary = {
  id: string;
  slug: string;
  name: string;
  git_repository_url: string | null;
  default_branch: string | null;
  services_count: number;
  latest_deployment: DeploymentSummary | null;
  created_at: string;
  updated_at: string;
};

export type ServiceSourceSummary = {
  repository_full_name: string;
  branch: string;
  root_directory: string;
  source_status: string;
  auto_deploy: boolean;
};

export type ServiceSummary = {
  id: string;
  project_id: string;
  environment_id: string;
  environment_name: string;
  name: string;
  type: "web" | "worker";
  source: ServiceSourceSummary | null;
  latest_deployment: DeploymentSummary | null;
  created_at: string;
  updated_at: string;
};

export type ProjectEnvironmentSummary = {
  id: string;
  name: string;
  type: string;
  is_ephemeral: boolean;
};

export type ProjectDetail = ProjectSummary & {
  environments: ProjectEnvironmentSummary[];
  services: ServiceSummary[];
};

export type Page<T> = { data: T[]; next_cursor: string | null };
export type LogPage = { data: DeploymentLogEntry[]; next_after: number | null };

// ---------------------------------------------------------------------------
// Deployment status helpers (mirrors apps/backend/internal/platformdb/types.go)
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["failed", "cancelled", "superseded"]);
const IN_FLIGHT_STATUSES: ReadonlySet<string> = new Set([
  "queued",
  "building",
  "image_ready",
  "deploying",
  "health_checking",
]);

/** No further transition is possible. */
export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Queued/building/deploying — the only states that can be cancelled. */
export function isInFlightStatus(status: string): boolean {
  return IN_FLIGHT_STATUSES.has(status);
}

/** Polling can stop: terminal, or steady-state running. */
export function isSettledStatus(status: string): boolean {
  return !isInFlightStatus(status) && status !== "pending";
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

function pageQuery(params: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

export function listProjects(
  accessToken: string,
  options: { limit?: number; cursor?: string | null } = {},
) {
  return platformRequest<Page<ProjectSummary>>(
    `/v1/projects${pageQuery({ limit: options.limit, cursor: options.cursor })}`,
    accessToken,
  );
}

/** Follows `next_cursor` until exhausted (capped to protect against runaway loops). */
export async function listAllProjects(accessToken: string, maxPages = 10) {
  const projects: ProjectSummary[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page += 1) {
    const result: Page<ProjectSummary> = await listProjects(accessToken, { limit: 100, cursor });
    projects.push(...result.data);
    cursor = result.next_cursor;
    if (!cursor) break;
  }
  return projects;
}

export function createProject(accessToken: string, input: { name: string; slug?: string }) {
  return platformRequest<ProjectSummary>("/v1/projects", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getProject(accessToken: string, projectId: string) {
  return platformRequest<ProjectDetail>(
    `/v1/projects/${encodeURIComponent(projectId)}`,
    accessToken,
  );
}

export function renameProject(accessToken: string, projectId: string, name: string) {
  return platformRequest<ProjectSummary>(
    `/v1/projects/${encodeURIComponent(projectId)}`,
    accessToken,
    { method: "PATCH", body: JSON.stringify({ name }) },
  );
}

export async function deleteProject(accessToken: string, projectId: string) {
  await platformRequest<null>(`/v1/projects/${encodeURIComponent(projectId)}`, accessToken, {
    method: "DELETE",
  });
}

/**
 * Service names are DNS labels on the backend (1-63 chars of a-z, 0-9, '-',
 * no leading/trailing '-'), so free-form names such as GitHub repo names
 * ("My_App", "Summit.Web") must be normalised before they are sent.
 */
export function toServiceName(raw: string): string {
  const name = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
  return name || "web";
}

export function createService(
  accessToken: string,
  projectId: string,
  input: { name: string; type?: "web" | "worker"; environmentId?: string },
) {
  return platformRequest<ServiceSummary>(
    `/v1/projects/${encodeURIComponent(projectId)}/services`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        name: toServiceName(input.name),
        type: input.type ?? "web",
        ...(input.environmentId ? { environment_id: input.environmentId } : {}),
      }),
    },
  );
}

export function listProjectDeployments(
  accessToken: string,
  projectId: string,
  options: { limit?: number; cursor?: string | null } = {},
) {
  return platformRequest<Page<DeploymentSummary>>(
    `/v1/projects/${encodeURIComponent(projectId)}/deployments${pageQuery({
      limit: options.limit,
      cursor: options.cursor,
    })}`,
    accessToken,
  );
}

export function getDeployment(accessToken: string, deploymentId: string) {
  return platformRequest<DeploymentDetail>(
    `/v1/deployments/${encodeURIComponent(deploymentId)}`,
    accessToken,
  );
}

export function cancelDeployment(accessToken: string, deploymentId: string) {
  return platformRequest<DeploymentSummary>(
    `/v1/deployments/${encodeURIComponent(deploymentId)}/cancel`,
    accessToken,
    { method: "POST" },
  );
}

export function getDeploymentLogs(
  accessToken: string,
  deploymentId: string,
  options: { after?: number | null; limit?: number } = {},
) {
  return platformRequest<LogPage>(
    `/v1/deployments/${encodeURIComponent(deploymentId)}/logs${pageQuery({
      after: options.after,
      limit: options.limit,
    })}`,
    accessToken,
  );
}

export type ManualDeployment = {
  id: string;
  service_id: string;
  status: DeploymentStatus;
  commit_sha: string | null;
  build_job_id: string | null;
};

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Starts a deployment of the service's connected repository. A fresh idempotency key is sent per call. */
export function deployService(
  accessToken: string,
  serviceId: string,
  options: { ref?: string; reason?: string; idempotencyKey?: string } = {},
) {
  return platformRequest<ManualDeployment>(
    `/v1/services/${encodeURIComponent(serviceId)}/deployments`,
    accessToken,
    {
      method: "POST",
      headers: { "Idempotency-Key": options.idempotencyKey ?? newIdempotencyKey() },
      body: JSON.stringify({
        source: options.ref ? { ref: options.ref } : {},
        ...(options.reason ? { reason: options.reason } : {}),
      }),
    },
  );
}

// ---------------------------------------------------------------------------
// Formatting + dashboard mapping
// ---------------------------------------------------------------------------

export function formatRelativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "—";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "—";
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(time).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function shortSha(sha: string | null | undefined): string | null {
  return sha ? sha.slice(0, 7) : null;
}

/** "https://github.com/acme/app.git" → "acme/app". Returns the input if it is not a URL. */
export function repositoryLabel(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/^(?:https?:\/\/|git@)[^/:]+[/:](.+?)(?:\.git)?\/?$/i);
  return match ? match[1] : url;
}

export function projectStatusFromDeployment(
  deployment: Pick<DeploymentSummary, "status"> | null,
): ProjectStatus {
  if (!deployment) return "idle";
  switch (deployment.status) {
    case "running":
    case "active":
      return "running";
    case "failed":
      return "failed";
    case "cancelled":
    case "superseded":
      return "stopped";
    default:
      return "building";
  }
}

export function toDashboardProject(
  project: ProjectSummary,
  now: number = Date.now(),
): DashboardProject {
  const latest = project.latest_deployment;
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    repository: repositoryLabel(project.git_repository_url),
    branch: latest?.branch ?? project.default_branch ?? null,
    servicesCount: project.services_count,
    status: projectStatusFromDeployment(latest),
    statusLabel: latest ? statusLabel(latest.status) : "no deployments",
    commitSha: shortSha(latest?.commit_sha),
    lastDeployedLabel: latest ? formatRelativeTime(latest.created_at, now) : null,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    updatedLabel: formatRelativeTime(project.updated_at, now),
  };
}

/** Public URLs come from the backend; only ever render http(s) ones as links. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
