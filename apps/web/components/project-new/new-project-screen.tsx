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
  createNodeByOptionId,
} from "@/lib/canvas/initial-graph";
import type { SummitNode } from "@/lib/canvas/types";
import { NodeChooserDialogs } from "@/components/canvas/node-chooser-dialogs";
import { getStoredProjects, saveStoredProjects } from "@/lib/dashboard/mock-data";
import type { DashboardProject } from "@/lib/dashboard/types";

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
  const [activeChooser, setActiveChooser] = useState<
    "none" | "github" | "application" | "database" | "docker"
  >("none");

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

    const newProject: DashboardProject = {
      id: projectId,
      name: "untitled-project",
      description: "Visual cloud infrastructure canvas architecture",
      environment: "production",
      status: "ready",
      type: "Clean Canvas",
      icon: "layout",
      servicesCount: 1,
      owner: "summit-platform/untitled-project",
      branch: "main",
      commitMessage: "Initial canvas architecture",
      commitHash: "initial",
      commitPath: "apps/web",
      formattedDate: "Just now",
      region: "us-east-1",
      updatedAt: "just now",
      createdAt: new Date().toISOString(),
      template: "empty",
    };
    try {
      const stored = getStoredProjects();
      saveStoredProjects([newProject, ...stored]);
    } catch {}

    router.push(`/dashboard/project/${projectId}`);
  };

  // 2. Handle Top Input Submit (URL or prompt)
  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setActiveChooser("github");
  };

  // 3. Handle Confirm from Node Chooser Dialogs
  const handleConfirmChooser = (
    optionId: string,
    customData?: Record<string, unknown>
  ) => {
    const projectId = generateProjectId();
    const initialNode = createNodeByOptionId(
      optionId,
      { x: 300, y: 200 },
      customData
    );

    const projectName =
      (customData?.label as string) ||
      (customData?.name as string) ||
      (optionId === "github" ? "web-repo" : `${optionId}-service`);

    const arch = getEmptyArchitecture(projectId);
    arch.name = projectName;
    arch.nodes = [initialNode];
    saveProjectArchitecture(arch);

    const newProject: DashboardProject = {
      id: projectId,
      name: projectName,
      description:
        (customData?.description as string) ||
        (optionId === "github"
          ? `Production web service connected to ${customData?.branch || "main"}`
          : optionId === "database"
          ? `High-availability managed ${customData?.subType || "database"}`
          : `Containerized deployment`),
      environment: "production",
      status: "ready",
      type:
        (customData?.subType as string) ||
        (optionId === "github"
          ? "GitHub Repository"
          : optionId === "database"
          ? "Database"
          : "Docker Image"),
      icon:
        optionId === "github"
          ? "github"
          : optionId === "database"
          ? "database"
          : optionId === "docker"
          ? "docker"
          : "layout",
      servicesCount: 1,
      owner: `summit-platform/${projectName}`,
      branch: (customData?.branch as string) || "main",
      commitMessage: `feat(init): connect ${projectName}`,
      commitHash: "0a1b2c3",
      commitPath: "apps/web",
      formattedDate: "Just now",
      region: (customData?.region as string) || "us-east-1",
      updatedAt: "just now",
      createdAt: new Date().toISOString(),
      template:
        optionId === "github"
          ? "github"
          : optionId === "database"
          ? "database"
          : optionId === "docker"
          ? "docker"
          : "empty",
    };

    try {
      const stored = getStoredProjects();
      saveStoredProjects([newProject, ...stored]);
    } catch {}

    setActiveChooser("none");
    router.push(`/dashboard/project/${projectId}`);
  };

  return (
    <div className="relative w-full h-screen bg-[#0C0B0A] text-[#FAF8F5] flex flex-col overflow-hidden font-sans select-none">
      {/* ---------------- Slim Header (48px) ---------------- */}
      <header className="h-[48px] w-full bg-[#0E0E0D]/95 border-b border-[#20201E] flex items-center justify-between px-4 z-20 shrink-0 backdrop-blur-md">
        {/* Left: Brand & New Project Indicator */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 group hover:opacity-90 transition-opacity"
            title="Summit Dashboard"
          >
            <SummitLogo className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
            <span className="font-sans text-[13.5px] font-semibold tracking-[-0.02em] text-[#F1F0ED]">
              Summit
            </span>
          </Link>

          <span className="text-[#3E3D39] text-[13px] font-mono select-none">/</span>

          <Link
            href="/dashboard"
            className="text-[#8E8C86] hover:text-[#FAF8F5] transition-colors text-[13px] font-sans"
            title="Back to Projects"
          >
            Projects
          </Link>

          <span className="text-[#3E3D39] text-[13px] font-mono select-none">/</span>

          <div className="flex items-center gap-1.5 px-1.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-orange/90" />
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
                className="w-7 h-7 rounded-full bg-[#181817] hover:bg-[#1E1E1C] border border-[#262522] hover:border-[#E58B62]/60 flex items-center justify-center text-[11.5px] font-mono font-medium text-[#F1F0ED] transition-colors cursor-pointer"
                title={user.email ?? "Account"}
              >
                {user.email ? user.email.charAt(0).toUpperCase() : "DK"}
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-52 bg-[#141413] border border-[#222220] rounded-[7px] shadow-2xl py-1.5 z-50 animate-in fade-in duration-100">
                  <div className="px-3 py-2 border-b border-[#20201E]">
                    <div className="text-[10.5px] font-mono text-[#77756F] uppercase tracking-wider">Signed in as</div>
                    <div className="text-[12px] font-mono text-[#F1F0ED] truncate mt-0.5">{user.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsUserMenuOpen(false);
                      await signOut();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] font-mono text-[#D77D7D] hover:bg-[#1A1A18] transition-colors cursor-pointer"
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
              className="text-[12px] font-mono text-[#A09E98] hover:text-[#F1F0ED] px-2.5 py-1 rounded-[5px] hover:bg-[#181817] border border-[#222220] transition-colors cursor-pointer"
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
            <div className="relative group flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] bg-[#181817] border border-[#262624] overflow-hidden transition-colors">
              <Sparkles className="w-3.5 h-3.5 text-[#8E8C86] group-focus-within:text-[#E58B62] transition-colors shrink-0" />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Describe your project or paste a repo link"
                className="w-full bg-transparent text-[12.5px] font-sans text-[#FAF8F5] placeholder-[#60605C] outline-none border-none focus:outline-none focus:ring-0 tracking-[-0.01em]"
                style={{ outline: "none", boxShadow: "none", border: "none" }}
              />
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-orange scale-x-0 group-focus-within:scale-x-100 transition-transform duration-200 ease-out origin-left pointer-events-none" />
            </div>
          </form>

          {/* Thin Divider */}
          <div className="my-1.5 border-t border-[#20201E]" />

          {/* Exactly Four Stacked Options */}
          <div className="space-y-0.5">
            {/* 1. GitHub Repository */}
            <button
              type="button"
              onClick={() => setActiveChooser("github")}
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
              onClick={() => setActiveChooser("database")}
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
              onClick={() => setActiveChooser("docker")}
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

      {/* ---------------- Exact Same Dialogs As Canvas Dock ---------------- */}
      <NodeChooserDialogs
        activeChooser={activeChooser}
        onClose={() => setActiveChooser("none")}
        onConfirm={handleConfirmChooser}
      />
    </div>
  );
}

