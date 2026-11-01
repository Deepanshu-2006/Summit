import { platformRequest as request } from "./platform-api.ts";

export type GitHubInstallation = {
  id: string;
  github_account: { login: string; type: string };
  status: string;
  repository_count: number;
};

export type GitHubRepository = {
  /** Stable Summit database identifier used by service_sources. */
  id: string;
  github_repository_id: number;
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
  archived: boolean;
  html_url: string;
};

export type SourceBuildService = {
  id: string;
  name: string;
  type: "web" | "worker";
  project_id: string;
  project_name: string;
  environment_id: string;
  environment_name: string;
};

export type ServiceSource = {
  id: string;
  service_id: string;
  repository: { id: string; full_name: string };
  branch: string;
  root_directory: string;
  dockerfile_path: string | null;
  build_configuration: Record<string, unknown>;
  auto_deploy: boolean;
  source_status: string;
  last_seen_commit_sha: string | null;
};

type ListResponse<T> = { data: T[]; next_cursor?: string | null };

export function listSourceBuildServices(accessToken: string) {
  return request<ListResponse<SourceBuildService>>("/v1/services", accessToken);
}

export function listGitHubInstallations(accessToken: string) {
  return request<ListResponse<GitHubInstallation>>(
    "/v1/github/installations",
    accessToken,
  );
}

export function startGitHubInstallation(accessToken: string) {
  return request<{ installation_url: string; state_expires_at: string }>(
    "/v1/github/installations",
    accessToken,
    { method: "POST" },
  );
}

export async function listInstallationRepositories(
  accessToken: string,
  installationId: string,
) {
  const repositories: GitHubRepository[] = [];
  const cursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const page = await request<ListResponse<GitHubRepository>>(
      `/v1/github/installations/${encodeURIComponent(installationId)}/repositories?${query.toString()}`,
      accessToken,
    );
    repositories.push(...page.data);
    cursor = page.next_cursor ?? null;
    if (cursor && cursors.has(cursor)) {
      throw new Error("Repository pagination returned a repeated cursor.");
    }
    if (cursor) cursors.add(cursor);
  } while (cursor);

  return repositories;
}

export async function syncInstallationRepositories(
  accessToken: string,
  installationId: string,
) {
  const result = await request<{ sync_id: string; status: string; repositories_synced: number }>(
    `/v1/github/installations/${encodeURIComponent(installationId)}/sync`,
    accessToken,
    { method: "POST" },
  );
  return { ...result, repositories: await listInstallationRepositories(accessToken, installationId) };
}

export function getServiceSource(accessToken: string, serviceId: string) {
  return request<ServiceSource>(
    `/v1/services/${encodeURIComponent(serviceId)}/source`,
    accessToken,
  );
}

export async function connectServiceRepository(
  accessToken: string,
  serviceId: string,
  input: {
    repositoryId: string;
    branch: string;
    rootDirectory?: string;
    dockerfilePath?: string | null;
    buildConfiguration?: Record<string, unknown>;
    autoDeploy?: boolean;
  },
) {
  await request<ServiceSource>(
    `/v1/services/${encodeURIComponent(serviceId)}/source`,
    accessToken,
    {
      method: "PUT",
      body: JSON.stringify({
        repository_id: input.repositoryId,
        branch: input.branch,
        root_directory: input.rootDirectory ?? ".",
        dockerfile_path: input.dockerfilePath ?? null,
        build_configuration: input.buildConfiguration ?? {},
        auto_deploy: input.autoDeploy ?? true,
      }),
    },
  );

  return getServiceSource(accessToken, serviceId);
}

export function disconnectServiceRepository(accessToken: string, serviceId: string) {
  return request<{ id: string; service_id: string; source_status: string; disconnect_reason: string }>(
    `/v1/services/${encodeURIComponent(serviceId)}/source`,
    accessToken,
    { method: "DELETE" },
  );
}
