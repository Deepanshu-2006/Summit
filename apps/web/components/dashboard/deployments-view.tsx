"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { DashboardProject } from "@/lib/dashboard/types";
import {
  describeApiError,
  formatRelativeTime,
  listProjectDeployments,
  projectStatusFromDeployment,
  shortSha,
  statusLabel,
  type DeploymentSummary,
} from "@/lib/platform-api";

/** Deployments fetched per project, and rows shown across all projects. */
const PER_PROJECT_LIMIT = 10;
const MAX_PROJECTS = 25;
const MAX_ROWS = 50;

interface DeploymentsViewProps {
  projects: DashboardProject[];
  accessToken: string | undefined;
  isAuthLoading: boolean;
  projectsState: "loading" | "ready" | "error" | "signed-out";
  onSignIn: () => void;
}

interface DeploymentRow {
  deployment: DeploymentSummary;
  projectId: string;
  projectName: string;
}

interface LoadResult {
  key: string;
  loadedAt: number;
  rows: DeploymentRow[];
  error: string | null;
}

const DOT_BY_STATUS = {
  running: "bg-emerald-400",
  building: "bg-amber-400 animate-pulse",
  failed: "bg-[#D77D7D]",
  stopped: "bg-[#5A5954]",
  idle: "bg-[#3E3D39]",
} as const;

function formatDuration(deployment: DeploymentSummary): string | null {
  if (!deployment.started_at || !deployment.finished_at) return null;
  const ms = Date.parse(deployment.finished_at) - Date.parse(deployment.started_at);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function DeploymentsView({
  projects,
  accessToken,
  isAuthLoading,
  projectsState,
  onSignIn,
}: DeploymentsViewProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [result, setResult] = useState<LoadResult | null>(null);

  const scopedProjects = useMemo(() => projects.slice(0, MAX_PROJECTS), [projects]);
  const key = scopedProjects.map((project) => project.id).join(",");

  useEffect(() => {
    if (!accessToken || projectsState !== "ready") return;
    let cancelled = false;

    Promise.allSettled(
      scopedProjects.map((project) =>
        listProjectDeployments(accessToken, project.id, { limit: PER_PROJECT_LIMIT }).then(
          (page) =>
            page.data.map((deployment) => ({
              deployment,
              projectId: project.id,
              projectName: project.name,
            })),
        ),
      ),
    ).then((settled) => {
      if (cancelled) return;
      const rows: DeploymentRow[] = [];
      let firstError: unknown = null;
      let failures = 0;
      for (const entry of settled) {
        if (entry.status === "fulfilled") rows.push(...entry.value);
        else {
          failures += 1;
          firstError ??= entry.reason;
        }
      }
      rows.sort((a, b) => b.deployment.created_at.localeCompare(a.deployment.created_at));
      setResult({
        key,
        loadedAt: Date.now(),
        rows: rows.slice(0, MAX_ROWS),
        error:
          failures > 0 && failures === settled.length
            ? describeApiError(firstError, "Could not load deployments.")
            : null,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [accessToken, projectsState, scopedProjects, key]);

  const current = result && result.key === key ? result : null;
  const notice = (() => {
    if (isAuthLoading || projectsState === "loading") return { text: "Loading deployments…" };
    if (projectsState === "signed-out" || !accessToken) {
      return { text: "Sign in to see your deployments.", action: "Sign in" };
    }
    if (projectsState === "error") return { text: "Could not load projects, so deployments are unavailable.", error: true };
    if (scopedProjects.length === 0) return { text: "Create a project to see deployments here." };
    if (!current) return { text: "Loading deployments…" };
    if (current.error) return { text: current.error, error: true };
    if (current.rows.length === 0) return { text: "No deployments yet. Deploy a service from a project canvas." };
    return null;
  })();
  const deployments = notice ? [] : current?.rows ?? [];

  return (
    <div className="w-full flex flex-col">
      {/* Header */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6"
      >
        <h1 className="font-sans text-[20px] font-medium text-[#FAF8F5] tracking-tight">
          Deployments
        </h1>
        <p className="text-[12.5px] text-[#75736D] mt-0.5">
          Recent builds and releases across your projects, newest first.
        </p>
      </motion.div>

      {/* Deployments List */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="w-full bg-[#111110] border border-[#1E1E1C] rounded-[8px] overflow-hidden"
      >
        {/* Table Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#141413] border-b border-[#1E1E1C] text-[10.5px] font-mono uppercase tracking-wider text-[#55544E]">
          <div className="w-1/4">Deployment</div>
          <div className="w-1/3">Commit</div>
          <div className="w-1/6 hidden sm:block">Branch</div>
          <div className="w-24 text-right">Age</div>
          <div className="w-16 text-right">Action</div>
        </div>

        {/* Rows */}
        {notice && (
          <div
            role={"error" in notice && notice.error ? "alert" : "status"}
            className={`px-4 py-10 text-center text-[12.5px] ${
              "error" in notice && notice.error ? "text-[#D77D7D]" : "text-[#75736D]"
            }`}
          >
            <p>{notice.text}</p>
            {"action" in notice && notice.action && (
              <button
                type="button"
                onClick={onSignIn}
                className="mt-3 inline-flex items-center h-8 px-3.5 rounded-[5px] bg-[#E58B62] hover:bg-[#F29C75] text-[#0C0B0A] font-sans font-medium text-[12px] transition-colors cursor-pointer"
              >
                {notice.action}
              </button>
            )}
          </div>
        )}
        {deployments.map(({ deployment, projectId, projectName }, idx) => {
          const status = projectStatusFromDeployment(deployment);
          const duration = formatDuration(deployment);
          return (
            <motion.div
              key={deployment.id}
              initial={shouldReduceMotion ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.22,
                delay: shouldReduceMotion ? 0 : Math.min(0.08 + idx * 0.035, 0.4),
                ease: [0.16, 1, 0.3, 1],
              }}
              onClick={() => router.push(`/dashboard/project/${projectId}`)}
              className="flex items-center justify-between px-4 py-3 border-b border-[#181817] last:border-b-0 hover:bg-[#141413] transition-colors cursor-pointer text-[12.5px] group"
            >
              {/* Col 1: Status Dot + Project Name */}
              <div className="w-1/4 flex items-center gap-2 min-w-0 pr-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_BY_STATUS[status]}`} />
                <span className="font-sans font-medium text-[#FAF8F5] group-hover:text-white truncate">
                  {projectName}
                </span>
              </div>

              {/* Col 2: Commit + status */}
              <div className="w-1/3 flex items-center gap-2 min-w-0 pr-3">
                <span className="font-mono text-[11px] text-[#75736D] shrink-0">
                  {shortSha(deployment.commit_sha) ?? "—"}
                </span>
                <span
                  className={`font-sans text-[12px] truncate capitalize ${
                    status === "failed" ? "text-[#D77D7D]" : "text-[#8E8C86]"
                  }`}
                  title={deployment.error_message ?? undefined}
                >
                  {statusLabel(deployment.status)}
                  {duration ? ` · ${duration}` : ""}
                </span>
              </div>

              {/* Col 3: Branch */}
              <div className="w-1/6 hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-[#75736D]">
                {deployment.branch ? (
                  <>
                    <GitBranch className="w-3 h-3 text-[#55544E]" />
                    <span className="truncate">{deployment.branch}</span>
                  </>
                ) : (
                  <span className="text-[#55544E]">—</span>
                )}
              </div>

              {/* Col 4: Time */}
              <div className="w-24 text-right text-[11px] font-mono text-[#55544E]">
                {formatRelativeTime(deployment.created_at, current?.loadedAt)}
              </div>

              {/* Col 5: Open Action */}
              <div className="w-16 text-right">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/dashboard/project/${projectId}`);
                  }}
                  className="text-[11.5px] font-sans text-[#75736D] group-hover:text-[#E58B62] transition-colors inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Canvas</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

