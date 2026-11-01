/**
 * Maps real platform services onto canvas nodes. The backend owns which
 * services exist and their state; localStorage only remembers node positions
 * and UI-only nodes (databases, docker, ...), keyed by project id.
 */

import type { ServiceSummary } from "../platform-api.ts";
import type { SummitNode, SummitNodeData } from "./types";

export const NODE_WIDTH = 270;
const COLUMN_GAP = 330;
const ROW_GAP = 150;
const ORIGIN = { x: 180, y: 160 };

export function serviceNodeId(serviceId: string): string {
  return `svc_${serviceId}`;
}

function describeStatus(service: ServiceSummary): Pick<SummitNodeData, "statusText" | "statusTone"> {
  const latest = service.latest_deployment;
  if (latest) {
    const label = latest.status.replace(/_/g, " ");
    switch (latest.status) {
      case "running":
      case "active":
        return { statusText: "Running", statusTone: "ok" };
      case "failed":
        return { statusText: "Last deployment failed", statusTone: "error" };
      case "cancelled":
      case "superseded":
        return { statusText: `Last deployment ${label}`, statusTone: "idle" };
      default:
        return { statusText: `Deployment ${label}`, statusTone: "progress" };
    }
  }
  if (service.source) return { statusText: "Not deployed yet", statusTone: "idle" };
  return { statusText: "No repository connected", statusTone: "idle" };
}

/** Node data derived entirely from the backend service. */
export function serviceToNodeData(service: ServiceSummary): SummitNodeData {
  const source = service.source;
  const latest = service.latest_deployment;
  return {
    label: service.name,
    serviceType: service.type === "worker" ? "worker" : "application",
    subType: service.type === "worker" ? "Worker" : "Web Service",
    serviceId: service.id,
    environmentName: service.environment_name,
    repositoryFullName: source?.repository_full_name,
    repoUrl: source ? `https://github.com/${source.repository_full_name}` : undefined,
    branch: source?.branch,
    rootDir: source?.root_directory,
    sourceStatus: source?.source_status,
    autoDeploy: source?.auto_deploy,
    deploymentStatus: latest?.status,
    commitSha: latest?.commit_sha ?? undefined,
    publicUrl: latest?.public_url ?? undefined,
    ...describeStatus(service),
    updatedAt: service.updated_at,
  };
}

function overlaps(a: { x: number; y: number }, nodes: SummitNode[]) {
  return nodes.some(
    (node) =>
      Math.abs(node.position.x - a.x) < NODE_WIDTH + 24 &&
      Math.abs(node.position.y - a.y) < 115 + 24,
  );
}

function freePosition(existing: SummitNode[]): { x: number; y: number } {
  for (let slot = 0; slot < 200; slot += 1) {
    const candidate = {
      x: ORIGIN.x + (slot % 3) * COLUMN_GAP,
      y: ORIGIN.y + Math.floor(slot / 3) * ROW_GAP,
    };
    if (!overlaps(candidate, existing)) return candidate;
  }
  return ORIGIN;
}

/**
 * Combine stored nodes with the project's real services:
 *  - UI-only stored nodes (no `serviceId`) are kept as-is;
 *  - stored service nodes keep their position but take fresh data from the API;
 *  - services without a stored node are placed on a free grid slot;
 *  - stored service nodes whose service no longer exists are dropped.
 */
export function mergeServiceNodes(
  storedNodes: SummitNode[],
  services: ServiceSummary[],
): SummitNode[] {
  const uiOnly = storedNodes.filter((node) => !node.data.serviceId);
  const positions = new Map<string, { x: number; y: number }>();
  for (const node of storedNodes) {
    if (node.data.serviceId) positions.set(node.data.serviceId, node.position);
  }

  const result: SummitNode[] = [...uiOnly];
  for (const service of services) {
    const position = positions.get(service.id) ?? freePosition(result);
    result.push({
      id: serviceNodeId(service.id),
      type: "summitNode",
      position,
      // Services are owned by the backend; they can't be removed from the canvas.
      deletable: false,
      data: serviceToNodeData(service),
    });
  }
  return result;
}

/** Updates backend-owned data on existing service nodes without touching positions. */
export function refreshServiceNodes(
  nodes: SummitNode[],
  services: ServiceSummary[],
): SummitNode[] {
  return mergeServiceNodes(nodes, services).map((merged) => {
    const current = nodes.find((node) => node.id === merged.id);
    return current ? { ...current, data: merged.data } : merged;
  });
}
