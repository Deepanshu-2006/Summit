/**
 * Summit Project Dashboard — Type System
 * Minimal, strongly-typed contracts for projects, workspaces, and filter states.
 */

export type ProjectEnvironment = "production" | "staging" | "development" | "preview";
export type ProjectStatus = "ready" | "active" | "building" | "draft" | "paused";
export type ViewMode = "grid" | "list";
export type SortOption = "updated" | "name" | "created";
export type StatusFilter = "all" | "ready" | "building" | "draft";

export interface DashboardProject {
  id: string;
  name: string;
  description: string;
  environment: ProjectEnvironment;
  status: ProjectStatus;
  type: string; // e.g. "Next.js Application", "Go API Service", "Web Application"
  icon: "layout" | "server" | "database" | "cpu" | "git-branch" | "github" | "docker";
  servicesCount: number;
  owner: string; // e.g. "summit-platform/summit-web"
  branch: string;
  commitMessage: string;
  commitHash: string;
  commitPath: string;
  formattedDate: string;
  region: string;
  updatedAt: string;
  createdAt: string;
  template?: "fullstack" | "api" | "empty" | "github" | "database" | "docker";
}

export interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isCurrent: boolean;
}
