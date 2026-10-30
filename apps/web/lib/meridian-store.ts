/**
 * In-memory data store for the live Meridian API demonstration.
 * Allows interactive POST /api/v1/resources and POST /api/v1/releases
 * to dynamically update and be reflected in subsequent GET calls.
 */

import type { ResourceItem, ReleaseItem } from "@summit/api-spec";
export type { ResourceItem, ReleaseItem };

// Initial seed data
const initialResources: ResourceItem[] = [
  {
    id: "res_db_primary",
    name: "Primary Postgres Cluster",
    type: "database",
    status: "available",
    tier: "dedicated-4cpu",
    region: "cdg-1 (Paris)",
    created_at: "2026-10-28T12:00:00Z",
  },
  {
    id: "res_redis_queue",
    name: "Job Broker Cache",
    type: "key-value",
    status: "available",
    tier: "standard-1gb",
    region: "cdg-1 (Paris)",
    created_at: "2026-10-28T14:30:00Z",
  },
  {
    id: "res_bucket_media",
    name: "Studio Architectural Assets",
    type: "storage",
    status: "available",
    tier: "multi-region-nvme",
    region: "global-edge",
    created_at: "2026-10-28T15:15:00Z",
  },
  {
    id: "res_cert_ssl",
    name: "meridian.jetway.app mTLS",
    type: "certificate",
    status: "active",
    tier: "anycast-ssl",
    region: "global-edge",
    created_at: "2026-10-28T18:00:00Z",
  },
];

const initialReleases: ReleaseItem[] = [
  {
    id: "rel_01hn8y7p412a9",
    version: "2.4.0",
    branch: "main",
    commit: "8f3a21c",
    status: "published",
    deployed_to: "production",
    deployed_at: "2026-10-28T22:30:14Z",
    author: "Elena Rostova <elena@meridian.io>",
  },
];

// Global in-memory storage (persists across requests during server runtime)
class MeridianStore {
  private resources: ResourceItem[] = [...initialResources];
  private releases: ReleaseItem[] = [...initialReleases];

  getResources(): ResourceItem[] {
    return [...this.resources];
  }

  addResource(item: Omit<ResourceItem, "id" | "status" | "created_at" | "region"> & { region?: string }): ResourceItem {
    const newResource: ResourceItem = {
      id: `res_${Math.random().toString(36).slice(2, 9)}`,
      name: item.name,
      type: item.type,
      tier: item.tier || "standard-compute",
      region: item.region || "cdg-1 (Paris)",
      status: "provisioned",
      created_at: new Date().toISOString(),
    };
    this.resources.unshift(newResource);
    return newResource;
  }

  getReleases(): ReleaseItem[] {
    return [...this.releases];
  }

  addRelease(item: { version: string; branch: string; commit?: string; author?: string }): ReleaseItem {
    const newRelease: ReleaseItem = {
      id: `rel_${Math.random().toString(36).slice(2, 10)}`,
      version: item.version,
      branch: item.branch,
      commit: item.commit || Math.random().toString(16).slice(2, 9),
      status: "published",
      deployed_to: "production",
      deployed_at: new Date().toISOString(),
      author: item.author || "Elena Rostova <elena@meridian.io>",
    };
    this.releases.unshift(newRelease);
    return newRelease;
  }
}

// Attach to globalThis so Next.js fast-refresh / module reloads preserve state
const globalStoreKey = Symbol.for("jetway.meridian.store");
const globalWithStore = globalThis as unknown as { [globalStoreKey]?: MeridianStore };

export const meridianStore = globalWithStore[globalStoreKey] ?? (globalWithStore[globalStoreKey] = new MeridianStore());
