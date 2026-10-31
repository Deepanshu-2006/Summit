"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ChevronRight, Database, Terminal, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
  saveProjectArchitecture,
  getEmptyArchitecture,
  createNodeByOptionId,
} from "@/lib/canvas/initial-graph";
import { NodeChooserDialogs } from "@/components/canvas/node-chooser-dialogs";
import { getStoredProjects, saveStoredProjects } from "@/lib/dashboard/mock-data";
import type { DashboardProject } from "@/lib/dashboard/types";

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

interface NewProjectCardProps {
  onCancel?: () => void;
}

export function NewProjectCard({ onCancel }: NewProjectCardProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const [inputValue, setInputValue] = useState("");
  const [activeChooser, setActiveChooser] = useState<
    "none" | "github" | "application" | "database" | "docker"
  >("none");

  const generateProjectId = () => {
    return `proj_${Math.random().toString(36).substring(2, 9)}`;
  };

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

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setActiveChooser("github");
  };

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
    <>
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.94, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.95, y: -8 }}
        transition={{ duration: 0.32, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[440px] mx-4 bg-[#141413] border border-[#262624] rounded-[12px] shadow-[0_24px_64px_rgba(0,0,0,0.92)] p-2 z-20"
      >
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
              autoFocus
            />
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-[#666560] hover:text-[#FAF8F5] p-0.5 rounded cursor-pointer transition-colors"
                title="Cancel (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E58B62] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-200 ease-out origin-left pointer-events-none" />
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
      </motion.div>

      {/* Chooser Dialogs */}
      <NodeChooserDialogs
        activeChooser={activeChooser}
        onClose={() => setActiveChooser("none")}
        onConfirm={handleConfirmChooser}
      />
    </>
  );
}

