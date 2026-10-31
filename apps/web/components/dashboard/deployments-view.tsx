"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { GitBranch, ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { DashboardProject } from "@/lib/dashboard/types";

interface DeploymentsViewProps {
  projects: DashboardProject[];
}

export function DeploymentsView({ projects }: DeploymentsViewProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  // Create a realistic sequence of deployments based on the projects
  const deployments = [
    {
      id: "dep_1",
      project: projects[0] || { id: "proj_summit_web", name: "summit-web" },
      environment: "production",
      branch: "main",
      commitMessage: "feat(canvas): redesign topbar layout and add underline input highlights",
      commitHash: "854cbec",
      status: "ready",
      time: "12m ago",
      duration: "42s",
    },
    {
      id: "dep_2",
      project: projects[1] || { id: "proj_api_gateway", name: "api-gateway" },
      environment: "development",
      branch: "main",
      commitMessage: "feat(builder): implement standalone builder execution system",
      commitHash: "8cc1077",
      status: "ready",
      time: "2h ago",
      duration: "1m 15s",
    },
    {
      id: "dep_3",
      project: projects[2] || { id: "proj_graphmind", name: "graphmind" },
      environment: "production",
      branch: "feat/rag-pipeline",
      commitMessage: "feat(vectors): add pgvector indexing and cosine similarity router",
      commitHash: "4cfe356",
      status: "building",
      time: "Just now",
      duration: "28s",
    },
    {
      id: "dep_4",
      project: projects[3] || { id: "proj_telemetry", name: "telemetry-service" },
      environment: "staging",
      branch: "staging",
      commitMessage: "fix(metrics): optimize Prometheus exporter scrape latency",
      commitHash: "feabad6",
      status: "ready",
      time: "3d ago",
      duration: "38s",
    },
    {
      id: "dep_5",
      project: projects[0] || { id: "proj_summit_web", name: "summit-web" },
      environment: "production",
      branch: "main",
      commitMessage: "fix(buildkit): support insecure registry flag and reuse active socket",
      commitHash: "c1fa3cb",
      status: "ready",
      time: "5d ago",
      duration: "52s",
    },
  ];

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
          Live build executions and active cloud infrastructure runs.
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
          <div className="w-1/6 hidden sm:block">Environment</div>
          <div className="w-24 text-right">Age</div>
          <div className="w-16 text-right">Action</div>
        </div>

        {/* Rows */}
        {deployments.map((dep, idx) => (
          <motion.div
            key={dep.id}
            initial={shouldReduceMotion ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.22,
              delay: shouldReduceMotion ? 0 : 0.08 + idx * 0.035,
              ease: [0.16, 1, 0.3, 1],
            }}
            onClick={() => router.push(`/dashboard/project/${dep.project.id}`)}
            className="flex items-center justify-between px-4 py-3 border-b border-[#181817] last:border-b-0 hover:bg-[#141413] transition-colors cursor-pointer text-[12.5px] group"
          >
            {/* Col 1: Status Dot + Project Name */}
            <div className="w-1/4 flex items-center gap-2 min-w-0 pr-2">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  dep.status === "building"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-emerald-400"
                }`}
              />
              <span className="font-sans font-medium text-[#FAF8F5] group-hover:text-white truncate">
                {dep.project.name}
              </span>
            </div>

            {/* Col 2: Commit message + Hash */}
            <div className="w-1/3 flex items-center gap-2 min-w-0 pr-3">
              <span className="font-mono text-[11px] text-[#75736D] shrink-0">
                {dep.commitHash}
              </span>
              <span className="font-sans text-[12px] text-[#8E8C86] truncate">
                {dep.commitMessage}
              </span>
            </div>

            {/* Col 3: Environment */}
            <div className="w-1/6 hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-[#75736D]">
              <span className="capitalize">{dep.environment}</span>
              <span className="text-[#3E3D39]">·</span>
              <GitBranch className="w-3 h-3 text-[#55544E]" />
              <span className="truncate">{dep.branch}</span>
            </div>

            {/* Col 4: Time */}
            <div className="w-24 text-right text-[11px] font-mono text-[#55544E]">
              {dep.time}
            </div>

            {/* Col 5: Open Action */}
            <div className="w-16 text-right">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/dashboard/project/${dep.project.id}`);
                }}
                className="text-[11.5px] font-sans text-[#75736D] group-hover:text-[#E58B62] transition-colors inline-flex items-center gap-0.5 cursor-pointer"
              >
                <span>Canvas</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

