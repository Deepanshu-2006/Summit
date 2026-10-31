"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  ChevronRight,
  Database,
  Layout,
  Server,
  ArrowRight,
  Check,
  AlertCircle,
} from "lucide-react";

// Authentic GitHub Brand Icon
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

// Authentic Docker Container Whale Icon
function DockerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186H8.1a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H5.136a.186.186 0 00-.186.185v1.888c0 .102.084.185.186.185m-2.928 0h2.12a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185M23.76 9.89a.82.82 0 00-.594-.367c-.22-.02-.85-.04-1.57.34-.33.175-.63.42-.9.72-.41-.26-.98-.44-1.68-.44h-.35a3.63 3.63 0 00-.65-1.28l-.34.22c.2.33.37.72.48 1.14l.03.11c-.55.15-2.02.58-2.63 1.95H.872a.87.87 0 00-.872.871c0 1.25.26 2.44.75 3.52.92 2.05 2.5 3.61 4.54 4.49 1.83.78 3.84 1.18 5.86 1.18 7.39 0 12.35-4.49 12.78-10.74.02-.13.04-.26.04-.39a.86.86 0 00-.17-.54" />
    </svg>
  );
}

// Authentic PostgreSQL Elephant Icon
function PostgresIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.14 2.53 7.69 6.12 9.17-.08-.7-.12-1.52-.12-2.17 0-1.8.44-3.5 1.25-4.99-.44-.22-.9-.4-1.38-.52-1.33-.33-2.18-1.52-2.18-2.89 0-1.54 1.15-2.83 2.67-2.98.65-.07 1.31.06 1.9.36.42-.51.93-.94 1.51-1.26C11.95 6.07 12 5.37 12 5c0-.6.18-1.18.52-1.68C12.18 3.1 12.09 3 12 3zm6.86 7.64c-.2-.04-.4-.06-.6-.06-1.05 0-2.02.48-2.66 1.29-.62-.31-1.31-.47-2.01-.47-2.48 0-4.5 2.02-4.5 4.5 0 .61.12 1.2.35 1.74-1.11 1.53-1.74 3.39-1.74 5.36 0 .47.04.93.1 1.38 1.25.76 2.72 1.2 4.29 1.2 4.65 0 8.44-3.56 8.87-8.1-.63.26-1.32.4-2.05.4-.55 0-1.07-.08-1.56-.24.58-.87.91-1.9.91-3 0-1.71-.82-3.23-2.1-4.2.43-.5.98-.9 1.6-1.14-.3-.39-.62-.73-.9-.66z" />
    </svg>
  );
}

// Popular sample repositories
const QUICK_REPOS = [
  { name: "summit / backend", branch: "main", desc: "Go 1.23 REST Engine & WebSocket Server" },
  { name: "summit / web", branch: "main", desc: "Next.js 16 App Router & Interactive Canvas" },
  { name: "summit / api-gateway", branch: "main", desc: "Reverse Proxy & Edge Rate Limiting" },
];

export interface NodeChooserDialogsProps {
  activeChooser: "none" | "github" | "application" | "database" | "docker";
  onClose: () => void;
  onConfirm: (optionId: string, customData?: Record<string, unknown>) => void;
}

export function NodeChooserDialogs({
  activeChooser,
  onClose,
  onConfirm,
}: NodeChooserDialogsProps) {
  // GitHub state
  const [githubUrl, setGithubUrl] = useState("");
  const [githubBranch, setGithubBranch] = useState("main");

  // Docker state
  const [dockerImage, setDockerImage] = useState("");
  const [dockerPort, setDockerPort] = useState("80");
  const [dockerError, setDockerError] = useState("");

  const urlInputRef = useRef<HTMLInputElement>(null);
  const dockerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeChooser === "github") {
      setGithubUrl("");
      setGithubBranch("main");
      setTimeout(() => urlInputRef.current?.focus(), 50);
    } else if (activeChooser === "docker") {
      setDockerImage("");
      setDockerPort("80");
      setDockerError("");
      setTimeout(() => dockerInputRef.current?.focus(), 50);
    }
  }, [activeChooser]);

  // Keyboard navigation: Escape closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeChooser !== "none") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeChooser, onClose]);

  if (activeChooser === "none") return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-[3px] animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      {/* ---------------- 1. GitHub Repository Chooser ---------------- */}
      {activeChooser === "github" && (
        <div
          className="w-full max-w-[460px] bg-[#141413] border border-[#282826] rounded-[14px] shadow-[0_24px_64px_rgba(0,0,0,0.85)] p-5 select-none animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#222220]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[7px] bg-[#1F1E24] border border-[#2B2934] flex items-center justify-center text-[#FAF8F5]">
                <GitHubIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-sans text-[14.5px] font-semibold text-[#FAF8F5]">
                  Import GitHub Repository
                </h3>
                <p className="font-sans text-[11px] text-[#8E8C86]">
                  Select from your repos or enter a custom repository link
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[#8E8C86] hover:text-[#FAF8F5] p-1 rounded hover:bg-[#1E1E1C] transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick-Pick Popular / Active Repositories */}
          <div className="mt-3.5 space-y-1.5">
            <span className="text-[10.5px] font-mono uppercase tracking-wider text-[#7A7873]">
              Quick Select Repository
            </span>
            <div className="space-y-1 max-h-[140px] overflow-y-auto no-scrollbar">
              {QUICK_REPOS.map((repo) => (
                <div
                  key={repo.name}
                  onClick={() => {
                    const label = repo.name.split("/").pop()?.trim() || "repo";
                    onConfirm("github", {
                      label,
                      repoUrl: `https://github.com/${repo.name.replace(/\s+/g, "")}`,
                      branch: repo.branch,
                    });
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-[8px] bg-[#181817] hover:bg-[#1F1E22] border border-[#242422] hover:border-accent-orange/50 transition-colors cursor-pointer group"
                >
                  <div className="min-w-0 text-left">
                    <span className="font-mono text-[12.5px] font-medium text-[#FAF8F5] group-hover:text-accent-orange transition-colors truncate block">
                      {repo.name}
                    </span>
                    <span className="font-sans text-[11px] text-[#8E8C86] truncate block">
                      {repo.desc}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#8E8C86] bg-[#131215] border border-[#25242A] px-1.5 py-0.5 rounded shrink-0 ml-2">
                    {repo.branch}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="my-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-[#222220]" />
            <span className="text-[10.5px] font-mono text-[#6A6864] uppercase">or custom url</span>
            <div className="h-px flex-1 bg-[#222220]" />
          </div>

          {/* Custom Repository Form Inputs */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-[#8E8C86]">
                Repository URL
              </label>
              <input
                ref={urlInputRef}
                type="text"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/organization/repository"
                className="w-full bg-[#181817] border border-[#282826] focus:border-accent-orange rounded-[7px] px-3 py-2 text-[12px] font-mono text-[#FAF8F5] placeholder:text-[#666460] outline-none transition-colors"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && githubUrl.trim()) {
                    const label =
                      githubUrl.split("/").filter(Boolean).pop()?.replace(".git", "") ||
                      "web-repo";
                    onConfirm("github", {
                      label,
                      repoUrl: githubUrl.trim(),
                      branch: githubBranch.trim() || "main",
                    });
                    onClose();
                  }
                }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono text-[#8E8C86]">
                Default Branch
              </label>
              <input
                type="text"
                value={githubBranch}
                onChange={(e) => setGithubBranch(e.target.value)}
                placeholder="main"
                className="w-full bg-[#181817] border border-[#282826] focus:border-accent-orange rounded-[7px] px-3 py-2 text-[12px] font-mono text-[#FAF8F5] outline-none transition-colors"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-[#222220]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-[6px] text-[#8E8C86] hover:text-[#FAF8F5] text-[12px] font-sans hover:bg-[#1E1E1C] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const label =
                  githubUrl.trim().split("/").filter(Boolean).pop()?.replace(".git", "") ||
                  "web-repo";
                onConfirm("github", {
                  label,
                  repoUrl: githubUrl.trim() || "https://github.com/summit/service",
                  branch: githubBranch.trim() || "main",
                });
                onClose();
              }}
              className="px-4 py-1.5 rounded-[7px] bg-accent-orange hover:bg-accent-orange-hover text-[#121110] text-[12.5px] font-medium transition-colors cursor-pointer"
            >
              Deploy to Canvas
            </button>
          </div>
        </div>
      )}

      {/* ---------------- 2. Database Engine Chooser ---------------- */}
      {activeChooser === "database" && (
        <div
          className="w-full max-w-[420px] bg-[#141413] border border-[#282826] rounded-[14px] shadow-[0_24px_64px_rgba(0,0,0,0.85)] p-5 select-none animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#222220]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[7px] bg-[#1E1925] border border-[#3A2D4A] flex items-center justify-center text-accent-orange">
                <Database className="w-4 h-4" />
              </div>
              <h3 className="font-sans text-[14.5px] font-semibold text-[#FAF8F5]">
                Select Database Engine
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[#8E8C86] hover:text-[#FAF8F5] p-1 rounded hover:bg-[#1E1E1C] transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {/* PostgreSQL Engine */}
            <button
              type="button"
              onClick={() => {
                onConfirm("database", {
                  label: "postgres-db",
                  subType: "PostgreSQL",
                  databaseEngine: "postgresql",
                  port: 5432,
                  connectionString: "postgresql://postgres:***@localhost:5432/main_db",
                });
                onClose();
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-[9px] bg-[#181817] hover:bg-[#1E1C24] border border-[#262624] hover:border-accent-orange/60 text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[7px] bg-[#141C24] border border-[#223545] flex items-center justify-center text-[#86CDDE] shrink-0">
                  <PostgresIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-sans text-[13.5px] font-medium text-[#FAF8F5] group-hover:text-accent-orange transition-colors">
                    PostgreSQL
                  </h4>
                  <p className="font-mono text-[11px] text-[#8E8C86] mt-0.5">
                    Version 16 · Standard port 5432
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#60605C] group-hover:text-accent-orange group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </button>

            {/* MySQL Engine */}
            <button
              type="button"
              onClick={() => {
                onConfirm("database", {
                  label: "mysql-db",
                  subType: "MySQL",
                  databaseEngine: "mysql",
                  port: 3306,
                  connectionString: "mysql://root:***@localhost:3306/main_db",
                });
                onClose();
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-[9px] bg-[#181817] hover:bg-[#1E1C24] border border-[#262624] hover:border-accent-orange/60 text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[7px] bg-[#221815] border border-[#442B22] flex items-center justify-center text-[#E08A58] shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-sans text-[13.5px] font-medium text-[#FAF8F5] group-hover:text-accent-orange transition-colors">
                    MySQL
                  </h4>
                  <p className="font-mono text-[11px] text-[#8E8C86] mt-0.5">
                    Version 8.4 · Standard port 3306
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#60605C] group-hover:text-accent-orange group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* ---------------- 3. Application Template Chooser ---------------- */}
      {activeChooser === "application" && (
        <div
          className="w-full max-w-[440px] bg-[#141413] border border-[#282826] rounded-[14px] shadow-[0_24px_64px_rgba(0,0,0,0.85)] p-5 select-none animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#222220]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[7px] bg-[#1A1F1B] border border-[#294231] flex items-center justify-center text-[#93DDA7]">
                <Layout className="w-4 h-4" />
              </div>
              <h3 className="font-sans text-[14.5px] font-semibold text-[#FAF8F5]">
                Choose Application Template
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[#8E8C86] hover:text-[#FAF8F5] p-1 rounded hover:bg-[#1E1E1C] transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {/* Next.js 16 Web App */}
            <button
              type="button"
              onClick={() => {
                onConfirm("application", {
                  label: "nextjs-web",
                  subType: "Next.js 16 SSR",
                  buildCommand: "pnpm build",
                  startCommand: "pnpm start",
                  port: 3000,
                });
                onClose();
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-[9px] bg-[#181817] hover:bg-[#1C201E] border border-[#262624] hover:border-[#93DDA7]/50 text-left transition-all group cursor-pointer"
            >
              <div>
                <h4 className="font-sans text-[13.5px] font-medium text-[#FAF8F5] group-hover:text-[#93DDA7] transition-colors">
                  Next.js 16 SSR Frontend
                </h4>
                <p className="font-sans text-[11px] text-[#8E8C86] mt-0.5">
                  App Router, server-side rendering, and React Server Components
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#60605C] group-hover:text-[#93DDA7] group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </button>

            {/* Go 1.23 REST Engine */}
            <button
              type="button"
              onClick={() => {
                onConfirm("application", {
                  label: "go-api",
                  subType: "Go REST API",
                  buildCommand: "go build -o bin/api ./cmd/server",
                  startCommand: "./bin/api",
                  port: 4000,
                });
                onClose();
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-[9px] bg-[#181817] hover:bg-[#1C201E] border border-[#262624] hover:border-[#93DDA7]/50 text-left transition-all group cursor-pointer"
            >
              <div>
                <h4 className="font-sans text-[13.5px] font-medium text-[#FAF8F5] group-hover:text-[#93DDA7] transition-colors">
                  Go 1.23 REST API Engine
                </h4>
                <p className="font-sans text-[11px] text-[#8E8C86] mt-0.5">
                  High-performance compiled backend service with sub-millisecond responses
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#60605C] group-hover:text-[#93DDA7] group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </button>

            {/* Node.js Service */}
            <button
              type="button"
              onClick={() => {
                onConfirm("application", {
                  label: "node-service",
                  subType: "Node.js Service",
                  buildCommand: "npm run build",
                  startCommand: "node dist/index.js",
                  port: 8080,
                });
                onClose();
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-[9px] bg-[#181817] hover:bg-[#1C201E] border border-[#262624] hover:border-[#93DDA7]/50 text-left transition-all group cursor-pointer"
            >
              <div>
                <h4 className="font-sans text-[13.5px] font-medium text-[#FAF8F5] group-hover:text-[#93DDA7] transition-colors">
                  Node.js Web Service
                </h4>
                <p className="font-sans text-[11px] text-[#8E8C86] mt-0.5">
                  Express or Fastify microservice API
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#60605C] group-hover:text-[#93DDA7] group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* ---------------- 4. Docker Image Chooser ---------------- */}
      {activeChooser === "docker" && (
        <div
          className="w-full max-w-[420px] bg-[#141413] border border-[#282826] rounded-[14px] shadow-[0_24px_64px_rgba(0,0,0,0.85)] p-5 select-none animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#222220]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[7px] bg-[#162130] border border-[#24354D] flex items-center justify-center text-[#60A5FA]">
                <DockerIcon className="w-4 h-4" />
              </div>
              <h3 className="font-sans text-[14.5px] font-semibold text-[#FAF8F5]">
                Deploy Docker Image
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[#8E8C86] hover:text-[#FAF8F5] p-1 rounded hover:bg-[#1E1E1C] transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-[#8E8C86]">
                Image Reference
              </label>
              <input
                ref={dockerInputRef}
                type="text"
                value={dockerImage}
                onChange={(e) => {
                  setDockerImage(e.target.value);
                  setDockerError("");
                }}
                placeholder="docker.io/library/nginx:alpine"
                className="w-full bg-[#181817] border border-[#2B2B28] focus:border-accent-orange rounded-[7px] px-3 py-2 text-[12px] font-mono text-[#FAF8F5] placeholder:text-[#666460] outline-none transition-colors"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const trimmed = dockerImage.trim();
                    if (!trimmed) {
                      setDockerError("Please enter a valid Docker image reference");
                      return;
                    }
                    const containerName =
                      trimmed.split("/").pop()?.split(":")[0] || "docker-service";
                    onConfirm("docker", {
                      label: containerName,
                      subType: "Docker Container",
                      port: parseInt(dockerPort, 10) || 80,
                      startCommand: `docker run -p ${dockerPort}:${dockerPort} ${trimmed}`,
                    });
                    onClose();
                  }
                }}
              />
              {dockerError && (
                <p className="text-[11px] font-sans text-[#E06C75] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{dockerError}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-[#8E8C86]">
                Exposed Port
              </label>
              <input
                type="number"
                value={dockerPort}
                onChange={(e) => setDockerPort(e.target.value)}
                placeholder="80"
                className="w-full bg-[#181817] border border-[#2B2B28] focus:border-accent-orange rounded-[7px] px-3 py-2 text-[12px] font-mono text-[#FAF8F5] outline-none transition-colors"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-[#222220]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-[6px] text-[#8E8C86] hover:text-[#FAF8F5] text-[12px] font-sans hover:bg-[#1E1E1C] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const trimmed = dockerImage.trim() || "nginx:alpine";
                const containerName =
                  trimmed.split("/").pop()?.split(":")[0] || "docker-service";
                onConfirm("docker", {
                  label: containerName,
                  subType: "Docker Container",
                  port: parseInt(dockerPort, 10) || 80,
                  startCommand: `docker run -p ${dockerPort}:${dockerPort} ${trimmed}`,
                });
                onClose();
              }}
              className="px-4 py-1.5 rounded-[7px] bg-accent-orange hover:bg-accent-orange-hover text-[#121110] text-[12.5px] font-medium transition-colors cursor-pointer"
            >
              Deploy to Canvas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

