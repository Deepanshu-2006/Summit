import type { User } from "@supabase/supabase-js";
import type { WorkspaceItem } from "./types";

export interface UserDisplay {
  name: string;
  email: string | null;
  initial: string;
}

/** Display fields for the signed-in user (falls back to a neutral guest label). */
export function getUserDisplay(user: User | null): UserDisplay {
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const email = user?.email ?? null;
  const metaName =
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    (typeof metadata.name === "string" && metadata.name) ||
    "";
  const name = metaName.trim() || email?.split("@")[0] || "Guest";
  return { name, email, initial: name.charAt(0).toUpperCase() || "?" };
}

/** Summit currently has one workspace: the signed-in user's personal projects. */
export function getPersonalWorkspace(user: User | null): WorkspaceItem {
  const { name } = getUserDisplay(user);
  return {
    id: user?.id ?? "personal",
    name: user ? `${name}'s projects` : "Personal",
    slug: "personal",
    plan: "Personal",
    isCurrent: true,
  };
}
