/**
 * Summit Project Dashboard — Type System
 * View-model contracts for projects and workspaces. Projects are derived from
 * the backend `ProjectSummary` by `toDashboardProject` in `lib/platform-api.ts`.
 */

export type ProjectStatus = "running" | "building" | "failed" | "stopped" | "idle";

export interface DashboardProject {
  id: string;
  slug: string;
  name: string;
  /** "owner/repo" when a repository is attached to the project. */
  repository: string | null;
  branch: string | null;
  servicesCount: number;
  status: ProjectStatus;
  /** Raw deployment status, humanized ("health checking"), or "no deployments". */
  statusLabel: string;
  commitSha: string | null;
  lastDeployedLabel: string | null;
  createdAt: string;
  updatedAt: string;
  updatedLabel: string;
}

export interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isCurrent: boolean;
}
