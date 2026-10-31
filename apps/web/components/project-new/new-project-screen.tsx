"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ChevronRight,
  Database,
  Terminal,
  X,
  Check,
  AlertCircle,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { SummitLogo } from "@/components/layout/navbar";
import { useAuth } from "@/components/auth/auth-context";
import {
  MOUNTAIN_SKYLINE_PATH,
  MOUNTAIN_MAIN_ARETE_PATH,
  MOUNTAIN_EAST_RIDGE_PATH,
} from "@/lib/mountain-contours";
import {
  saveProjectArchitecture,
  getEmptyArchitecture,
} from "@/lib/canvas/initial-graph";
import type { SummitNode } from "@/lib/canvas/types";

// Clean inline SVGs for GitHub and Docker brand icons
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

function DockerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186H8.1a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H5.136a.186.186 0 00-.186.185v1.888c0 .102.084.185.186.185m-2.928 0h2.12a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185M23.76 9.89a.82.82 0 00-.594-.367c-.22-.02-.85-.04-1.57.34-.33.175-.63.42-.9.72-.41-.26-.98-.44-1.68-.44h-.35a3.63 3.63 0 00-.65-1.28l-.34.22c.2.33.37.72.48 1.14l.03.11c-.55.15-2.02.58-2.63 1.95H.872a.87.87 0 00-.872.871c0 1.25.26 2.44.75 3.52.92 2.05 2.5 3.61 4.54 4.49 1.83.78 3.84 1.18 5.86 1.18 7.39 0 12.35-4.49 12.78-10.74.02-.13.04-.26.04-.39a.86.86 0 00-.17-.54" />
    </svg>
  );
}

export function NewProjectScreen() {
  const router = useRouter();
  const { user, signOut, openAuthModal } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Prompt / Repo Input State
  const [inputValue, setInputValue] = useState("");
  const [activeModal, setActiveModal] = useState<
    "none" | "github" | "database" | "docker"
  >("none");

  // GitHub Modal State
  const [githubRepoUrl, setGithubRepoUrl] = useState("");
  const [githubBranch, setGithubBranch] = useState("main");

  // Docker Modal State
  const [dockerImage, setDockerImage] = useState("");
  const [dockerPort, setDockerPort] = useState("80");
  const [dockerError, setDockerError] = useState("");

  // Helper to generate a unique project ID
  const generateProjectId = () => {
    return `proj_${Math.random().toString(36).substring(2, 9)}`;
  };

  // 1. Handle Empty Project: Navigates straight to empty canvas
  const handleSelectEmptyProject = () => {
    const projectId = generateProjectId();
    const emptyArch = getEmptyArchitecture(projectId);
    emptyArch.name = "Empty Architecture";
    saveProjectArchitecture(emptyArch);
    router.push(`/dashboard/project/${projectId}`);
  };

  // 2. Handle Top Input Submit (URL or prompt)
  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    if (trimmed.includes("github.com") || trimmed.startsWith("git@")) {
      setGithubRepoUrl(trimmed);
      setActiveModal("github");
    } else {
      // Natural language input placeholder: route to GitHub or Empty Project
      setActiveModal("github");
    }
  };

  // 3. Confirm GitHub Repository
  const handleConfirmGitHub = () => {
    const projectId = generateProjectId();
    const repoName =
      githubRepoUrl.split("/").filter(Boolean).pop()?.replace(".git", "") ||
      "web-repo";

    const initialNode: SummitNode = {
      id: "node_repo_init",
      type: "summitNode",
      position: { x: 300, y: 200 },
      data: {
        label: repoName,
        serviceType: "repository",
        subType: "GitHub Repository",
        repoUrl: githubRepoUrl || "https://github.com/summit-platform/example",
        branch: githubBranch || "main",
        updatedAt: new Date().toISOString(),
      },
    };

    const arch = getEmptyArchitecture(projectId);
    arch.name = repoName;
    arch.nodes = [initialNode];
    saveProjectArchitecture(arch);
    router.push(`/dashboard/project/${projectId}`);
  };

  // 4. Confirm Database Engine
  const handleSelectDatabase = (engine: "postgresql" | "mysql" | "redis") => {
    const projectId = generateProjectId();
    const configMap = {
      postgresql: {
        label: "postgres-db",
        subType: "PostgreSQL",
        port: 5432,
      },
      mysql: {
        label: "mysql-db",
        subType: "MySQL",
        port: 3306,
      },
      redis: {
        label: "redis-cache",
        subType: "Redis",
        port: 6379,
      },
    };

    const cfg = configMap[engine];
    const initialNode: SummitNode = {
      id: `node_db_${engine}`,
      type: "summitNode",
      position: { x: 320, y: 200 },
      data: {
        label: cfg.label,
        serviceType: engine === "redis" ? "cache" : "database",
        subType: cfg.subType,
        databaseEngine: engine,
        port: cfg.port,
        updatedAt: new Date().toISOString(),
      },
    };

    const arch = getEmptyArchitecture(projectId);
    arch.name = `${cfg.subType} Project`;
    arch.nodes = [initialNode];
    saveProjectArchitecture(arch);
    router.push(`/dashboard/project/${projectId}`);
  };

  // 5. Confirm Docker Image
  const handleConfirmDocker = () => {
    const trimmed = dockerImage.trim();
    if (!trimmed) {
      setDockerError("Please enter a valid Docker image reference");
      return;
    }

    const projectId = generateProjectId();
    const containerName =
      trimmed.split("/").pop()?.split(":")[0] || "docker-service";

    const initialNode: SummitNode = {
      id: "node_docker_init",
      type: "summitNode",
      position: { x: 300, y: 200 },
      data: {
        label: containerName,
        serviceType: "application",
        subType: "Docker Container",
        port: parseInt(dockerPort, 10) || 80,
        startCommand: `docker run -p ${dockerPort}:${dockerPort} ${trimmed}`,
        updatedAt: new Date().toISOString(),
      },
    };

    const arch = getEmptyArchitecture(projectId);
    arch.name = `${containerName} Service`;
    arch.nodes = [initialNode];
    saveProjectArchitecture(arch);
    router.push(`/dashboard/project/${projectId}`);
  };

  return (
    <div className="relative w-full h-screen bg-[#0C0B0A] text-[#FAF8F5] flex flex-col overflow-hidden font-sans select-none">
      {/* ---------------- Slim Header (56px) ---------------- */}
      <header className="h-[56px] w-full bg-[#0E0E0D]/90 border-b border-[#222220] flex items-center justify-between px-6 z-20 shrink-0 backdrop-blur-md">
        {/* Left: Brand & New Project Indicator */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 group hover:opacity-90 transition-opacity pr-3 border-r border-[#222220]"
            title="Summit Homepage"
          >
            <SummitLogo className="w-4 h-4 text-accent-orange shrink-0 transition-transform group-hover:scale-105" />
            <span className="font-sans text-[14px] font-semibold tracking-[-0.02em] text-[#FAF8F5]">
              Summit
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-orange/80" />
            <span className="font-mono text-[12px] text-[#A0A09C]">
              New project
            </span>
          </div>
        </div>

        {/* Right: Minimal Account Avatar / Controls */}
        <div className="flex items-center gap-3" ref={userDropdownRef}>
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-7 h-7 rounded-full bg-[#1A1A18] border border-[#2E2E2A] hover:border-accent-orange text-[#FAF8F5] text-[11px] font-mono flex items-center justify-center font-medium shadow-inner transition-colors"
                title={user.email ?? "Account"}
              >
                {user.email ? user.email.charAt(0).toUpperCase() : "DK"}
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-[#141413] border border-[#282826] rounded-[6px] shadow-2xl py-1.5 z-50 animate-in fade-in duration-100">
                  <div className="px-3 py-2 border-b border-[#222220]">
                    <div className="text-[11px] font-mono text-[#8E8C86] uppercase tracking-wider">Signed in as</div>
                    <div className="text-[12px] font-mono text-[#FAF8F5] truncate mt-0.5">{user.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsUserMenuOpen(false);
                      await signOut();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] font-mono text-[#E06C75] hover:bg-[#1A1A18] transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal({ mode: "signin" })}
              className="text-[12px] font-mono text-[#D1CFCA] hover:text-[#FAF8F5] px-2.5 py-1 rounded-[6px] hover:bg-[#1C1C1A] border border-[#262624] transition-colors"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* ---------------- Large Dark Workspace ---------------- */}
      <main className="relative flex-1 w-full flex items-center justify-center overflow-hidden">
        {/* Subtle Dotted Grid Background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(#262624 1.2px, transparent 1.2px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Faint, Understated Mountain Silhouette Detail */}
        <div className="absolute bottom-0 left-0 right-0 h-[220px] pointer-events-none opacity-[0.08] overflow-hidden flex items-end">
          <svg
            viewBox="0 0 1440 800"
            className="w-full h-auto text-[#FAF8F5]"
            preserveAspectRatio="none"
          >
            <path
              d={MOUNTAIN_SKYLINE_PATH}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d={MOUNTAIN_MAIN_ARETE_PATH}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
            <path
              d={MOUNTAIN_EAST_RIDGE_PATH}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>
        </div>

        {/* ---------------- Centered Project Selector Panel (440px) ---------------- */}
        <div className="relative w-full max-w-[440px] mx-4 bg-[#141413] border border-[#262624] rounded-[12px] shadow-[0_16px_48px_rgba(0,0,0,0.85)] p-2 z-10 animate-in fade-in zoom-in-95 duration-200">
          {/* Top Single-Line Input */}
          <form onSubmit={handleInputSubmit} className="relative">
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] bg-[#181817] border border-[#262624] focus-within:border-accent-orange transition-colors">
              <Sparkles className="w-3.5 h-3.5 text-[#8E8C86] shrink-0" />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Describe your project or paste a repo link"
                className="w-full bg-transparent text-[12.5px] font-sans text-[#FAF8F5] placeholder-[#60605C] outline-none tracking-[-0.01em]"
              />
            </div>
          </form>

          {/* Thin Divider */}
          <div className="my-1.5 border-t border-[#20201E]" />

          {/* Exactly Four Stacked Options */}
          <div className="space-y-0.5">
            {/* 1. GitHub Repository */}
            <button
              type="button"
              onClick={() => {
                if (inputValue.includes("github.com")) {
                  setGithubRepoUrl(inputValue.trim());
                }
                setActiveModal("github");
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-[7px] text-left transition-colors hover:bg-[#1E1E1C] active:bg-[#232320] group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded flex items-center justify-center text-[#B5B3AF] group-hover:text-[#FAF8F5] transition-colors">
                  <GitHubIcon className="w-4 h-4" />
                </div>
                <span className="font-sans text-[13px] font-medium text-[#FAF8F5]">
                  GitHub Repository
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#60605C] group-hover:text-[#FAF8F5] group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* 2. Database */}
            <button
              type="button"
              onClick={() => setActiveModal("database")}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-[7px] text-left transition-colors hover:bg-[#1E1E1C] active:bg-[#232320] group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded flex items-center justify-center text-[#B5B3AF] group-hover:text-[#FAF8F5] transition-colors">
                  <Database className="w-4 h-4" />
                </div>
                <span className="font-sans text-[13px] font-medium text-[#FAF8F5]">
                  Database
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#60605C] group-hover:text-[#FAF8F5] group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* 3. Docker Image */}
            <button
              type="button"
              onClick={() => setActiveModal("docker")}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-[7px] text-left transition-colors hover:bg-[#1E1E1C] active:bg-[#232320] group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded flex items-center justify-center text-[#B5B3AF] group-hover:text-[#FAF8F5] transition-colors">
                  <DockerIcon className="w-4 h-4" />
                </div>
                <span className="font-sans text-[13px] font-medium text-[#FAF8F5]">
                  Docker Image
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#60605C] group-hover:text-[#FAF8F5] group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* 4. Empty Project */}
            <button
              type="button"
              onClick={handleSelectEmptyProject}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-[7px] text-left transition-colors hover:bg-[#1E1E1C] active:bg-[#232320] group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded flex items-center justify-center text-[#B5B3AF] group-hover:text-[#FAF8F5] transition-colors">
                  <Terminal className="w-4 h-4" />
                </div>
                <span className="font-sans text-[13px] font-medium text-[#FAF8F5]">
                  Empty Project
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#60605C] group-hover:text-[#FAF8F5] group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </div>
      </main>

      {/* ---------------- Modals for Option Next Steps ---------------- */}

      {/* GitHub Repository Modal */}
      {activeModal === "github" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-100"
          onClick={() => setActiveModal("none")}
        >
          <div
            className="w-full max-w-[420px] bg-[#141413] border border-[#282826] rounded-[10px] shadow-2xl p-5 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#222220]">
              <div className="flex items-center gap-2.5">
                <GitHubIcon className="w-4 h-4 text-[#FAF8F5]" />
                <h3 className="font-sans text-[14px] font-semibold text-[#FAF8F5]">
                  Import GitHub Repository
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("none")}
                className="text-[#8E8C86] hover:text-[#FAF8F5] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[#8E8C86]">
                  Repository URL
                </label>
                <input
                  type="text"
                  value={githubRepoUrl}
                  onChange={(e) => setGithubRepoUrl(e.target.value)}
                  placeholder="https://github.com/organization/repository"
                  className="w-full bg-[#181817] border border-[#2B2B28] focus:border-accent-orange rounded-[6px] px-3 py-2 text-[12px] font-mono text-[#FAF8F5] outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[#8E8C86]">
                  Default Branch
                </label>
                <input
                  type="text"
                  value={githubBranch}
                  onChange={(e) => setGithubBranch(e.target.value)}
                  placeholder="main"
                  className="w-full bg-[#181817] border border-[#2B2B28] focus:border-accent-orange rounded-[6px] px-3 py-2 text-[12px] font-mono text-[#FAF8F5] outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-[#222220]">
              <button
                type="button"
                onClick={() => setActiveModal("none")}
                className="px-3.5 py-1.5 rounded-[6px] text-[#8E8C86] hover:text-[#FAF8F5] text-[12px] font-sans transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmGitHub}
                className="px-4 py-1.5 rounded-[6px] bg-accent-orange hover:bg-accent-orange-hover text-[#121110] text-[12.5px] font-medium transition-colors"
              >
                Open Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Database Engine Modal */}
      {activeModal === "database" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-100"
          onClick={() => setActiveModal("none")}
        >
          <div
            className="w-full max-w-[420px] bg-[#141413] border border-[#282826] rounded-[10px] shadow-2xl p-5 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#222220]">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-accent-orange" />
                <h3 className="font-sans text-[14px] font-semibold text-[#FAF8F5]">
                  Select Database Engine
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("none")}
                className="text-[#8E8C86] hover:text-[#FAF8F5] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => handleSelectDatabase("postgresql")}
                className="w-full flex items-center justify-between p-3 rounded-[8px] bg-[#181817] hover:bg-[#1E1E1C] border border-[#262624] hover:border-accent-orange/60 text-left transition-colors group cursor-pointer"
              >
                <div>
                  <h4 className="font-sans text-[13px] font-medium text-[#FAF8F5]">
                    PostgreSQL
                  </h4>
                  <p className="font-mono text-[10.5px] text-[#8E8C86] mt-0.5">
                    Version 16 · Standard port 5432
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#60605C] group-hover:text-accent-orange transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => handleSelectDatabase("mysql")}
                className="w-full flex items-center justify-between p-3 rounded-[8px] bg-[#181817] hover:bg-[#1E1E1C] border border-[#262624] hover:border-accent-orange/60 text-left transition-colors group cursor-pointer"
              >
                <div>
                  <h4 className="font-sans text-[13px] font-medium text-[#FAF8F5]">
                    MySQL
                  </h4>
                  <p className="font-mono text-[10.5px] text-[#8E8C86] mt-0.5">
                    Version 8.4 · Standard port 3306
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#60605C] group-hover:text-accent-orange transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => handleSelectDatabase("redis")}
                className="w-full flex items-center justify-between p-3 rounded-[8px] bg-[#181817] hover:bg-[#1E1E1C] border border-[#262624] hover:border-accent-orange/60 text-left transition-colors group cursor-pointer"
              >
                <div>
                  <h4 className="font-sans text-[13px] font-medium text-[#FAF8F5]">
                    Redis
                  </h4>
                  <p className="font-mono text-[10.5px] text-[#8E8C86] mt-0.5">
                    Version 7.2 · In-memory cache & store
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#60605C] group-hover:text-accent-orange transition-colors" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Docker Image Modal */}
      {activeModal === "docker" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-100"
          onClick={() => setActiveModal("none")}
        >
          <div
            className="w-full max-w-[420px] bg-[#141413] border border-[#282826] rounded-[10px] shadow-2xl p-5 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#222220]">
              <div className="flex items-center gap-2.5">
                <DockerIcon className="w-4 h-4 text-accent-orange" />
                <h3 className="font-sans text-[14px] font-semibold text-[#FAF8F5]">
                  Deploy Docker Image
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("none")}
                className="text-[#8E8C86] hover:text-[#FAF8F5] p-1"
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
                  type="text"
                  value={dockerImage}
                  onChange={(e) => {
                    setDockerImage(e.target.value);
                    setDockerError("");
                  }}
                  placeholder="docker.io/library/nginx:alpine"
                  className="w-full bg-[#181817] border border-[#2B2B28] focus:border-accent-orange rounded-[6px] px-3 py-2 text-[12px] font-mono text-[#FAF8F5] outline-none"
                />
                {dockerError && (
                  <p className="text-[11px] font-sans text-[#D77D7D] flex items-center gap-1">
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
                  className="w-full bg-[#181817] border border-[#2B2B28] focus:border-accent-orange rounded-[6px] px-3 py-2 text-[12px] font-mono text-[#FAF8F5] outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-[#222220]">
              <button
                type="button"
                onClick={() => setActiveModal("none")}
                className="px-3.5 py-1.5 rounded-[6px] text-[#8E8C86] hover:text-[#FAF8F5] text-[12px] font-sans transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDocker}
                className="px-4 py-1.5 rounded-[6px] bg-accent-orange hover:bg-accent-orange-hover text-[#121110] text-[12.5px] font-medium transition-colors"
              >
                Open Canvas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

