/**
 * Turns palette / chooser payloads into the backend create-service body.
 * Unsupported engines (MySQL, MongoDB, …) are rejected instead of drawn locally.
 */

import { toServiceName, type ServiceType } from "../platform-api.ts";

export type ServiceDraft = {
  name: string;
  type: ServiceType;
  image?: string;
  port?: number;
  /** Open the GitHub dialog against the service that was just created. */
  connectRepository: boolean;
};

export type DraftResult =
  | { ok: true; draft: ServiceDraft }
  | { ok: false; reason: "unsupported" | "invalid"; message: string };

const IMAGE_REF =
  /^(?:[a-z0-9][a-z0-9._-]*(?::[0-9]+)?\/)?[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*(?::[a-z0-9_][a-z0-9._-]{0,127})?(?:@sha256:[a-f0-9]{64})?$/;

/** Accepts `nginx:1.27`, `ghcr.io/org/app:tag`, and optional `@sha256:` digests. */
export function parseImageReference(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 512 || /\s/.test(trimmed)) return null;
  const digestAt = trimmed.lastIndexOf("@");
  const normalized =
    digestAt === -1
      ? trimmed.toLowerCase()
      : `${trimmed.slice(0, digestAt).toLowerCase()}@${trimmed.slice(digestAt + 1).toLowerCase()}`;
  return IMAGE_REF.test(normalized) ? normalized : null;
}

/** Empty input uses `fallback` (80 for published web images). Out-of-range values fail. */
export function parseServicePort(raw: string, fallback = 80): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (!/^\d+$/.test(trimmed)) return null;
  const port = Number(trimmed);
  if (port < 1 || port > 65535) return null;
  return port;
}

export function serviceNameFromImage(image: string): string {
  const withoutDigest = image.split("@")[0] ?? image;
  const leaf = withoutDigest.split("/").pop() ?? image;
  const name = leaf.split(":")[0] ?? leaf;
  return toServiceName(name);
}

function textField(data: Record<string, unknown> | undefined, key: string): string {
  const value = data?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export function isAddonType(type: string | undefined): boolean {
  return type === "postgres" || type === "redis";
}

export function isRepositoryType(type: string | undefined): boolean {
  return type === "web" || type === "worker";
}

/** Image pulls and database provisioning have no build logs. */
export function isBuildlessType(type: string | undefined): boolean {
  return type === "image" || isAddonType(type);
}

/** Addons first, then everything else, preserving relative order. */
export function orderForDeployAll<T extends { type: string }>(services: T[]): T[] {
  return services
    .map((service, index) => ({ service, index }))
    .sort((a, b) => {
      const rank = (type: string) => (isAddonType(type) ? 0 : 1);
      const byRank = rank(a.service.type) - rank(b.service.type);
      return byRank || a.index - b.index;
    })
    .map((entry) => entry.service);
}

/**
 * `null` means this option is not a create-service action (GitHub / application
 * templates go through the repository import flow).
 */
export function draftFromChooser(
  optionId: string,
  customData?: Record<string, unknown>,
): DraftResult | null {
  if (optionId === "github" || optionId === "application") return null;

  if (optionId === "worker") {
    return {
      ok: true,
      draft: {
        name: textField(customData, "label") || "worker",
        type: "worker",
        connectRepository: true,
      },
    };
  }

  if (optionId === "docker") {
    const image = parseImageReference(textField(customData, "image"));
    if (!image) {
      return {
        ok: false,
        reason: "invalid",
        message: "Enter an image like nginx:1.27 or ghcr.io/org/app:tag.",
      };
    }
    const portValue = customData?.port;
    const port =
      typeof portValue === "number"
        ? portValue >= 1 && portValue <= 65535
          ? portValue
          : null
        : parseServicePort(portValue === undefined || portValue === null ? "" : String(portValue), 80);
    if (port === null) {
      return { ok: false, reason: "invalid", message: "Port must be a number from 1 to 65535." };
    }
    return {
      ok: true,
      draft: {
        name: textField(customData, "label") || serviceNameFromImage(image),
        type: "image",
        image,
        port,
        connectRepository: false,
      },
    };
  }

  if (optionId === "cache") {
    return {
      ok: true,
      draft: {
        name: textField(customData, "label") || "redis",
        type: "redis",
        connectRepository: false,
      },
    };
  }

  if (optionId === "database") {
    const engine = String(customData?.databaseEngine ?? customData?.platformType ?? "postgresql");
    if (engine === "redis") {
      return {
        ok: true,
        draft: {
          name: textField(customData, "label") || "redis",
          type: "redis",
          connectRepository: false,
        },
      };
    }
    if (engine === "postgresql" || engine === "postgres") {
      return {
        ok: true,
        draft: {
          name: textField(customData, "label") || "postgres",
          type: "postgres",
          connectRepository: false,
        },
      };
    }
    return { ok: false, reason: "unsupported", message: "That database engine is coming soon." };
  }

  return { ok: false, reason: "unsupported", message: "That service is not available yet." };
}
