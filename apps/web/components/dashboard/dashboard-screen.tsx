"use client";

import React, { useState, useEffect, useRef, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { DashboardTopNav } from "./dashboard-top-nav";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DeploymentsView } from "./deployments-view";
import { ProjectCard } from "./project-card";
import { EmptyState } from "./empty-state";
import { RenameProjectDialog } from "./rename-project-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import {
  getStoredProjects,
  saveStoredProjects,
  seedProjectCanvasArchitecture,
  INITIAL_DEMO_PROJECTS,
} from "@/lib/dashboard/mock-data";
import type { DashboardProject } from "@/lib/dashboard/types";

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

export function DashboardScreen() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const [activeTab, setActiveTab] = useState<"projects" | "deployments">("projects");
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEmptyDemo, setIsEmptyDemo] = useState(false);

  // Rename and Delete Dialogs
  const [renameTarget, setRenameTarget] = useState<DashboardProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardProject | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loaded = getStoredProjects();
    setProjects(loaded);
  }, []);

  // Keyboard shortcut listener for / to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Directly routes to the New Project screen (/dashboard/project/new)
  const handleNewProjectClick = () => {
    router.push("/dashboard/project/new");
  };

  const handleToggleEmptyDemo = () => {
    if (isEmptyDemo) {
      setProjects(INITIAL_DEMO_PROJECTS);
      saveStoredProjects(INITIAL_DEMO_PROJECTS);
      setIsEmptyDemo(false);
      showToast("Demo projects restored");
    } else {
      setProjects([]);
      setIsEmptyDemo(true);
      showToast("Empty state loaded");
    }
  };

  const handleRenameProject = (projectId: string, newName: string) => {
    const updated = projects.map((p) =>
      p.id === projectId ? { ...p, name: newName, updatedAt: "just now" } : p
    );
    setProjects(updated);
    saveStoredProjects(updated);
    showToast(`Renamed to ${newName}`);
  };

  const handleDuplicateProject = (project: DashboardProject) => {
    const id = `proj_${Math.random().toString(36).substring(2, 9)}`;
    const duplicated: DashboardProject = {
      ...project,
      id,
      name: `${project.name}-copy`,
      owner: `summit-platform/${project.name}-copy`,
      updatedAt: "just now",
      createdAt: new Date().toISOString(),
    };

    seedProjectCanvasArchitecture(duplicated);

    const updated = [duplicated, ...projects];
    setProjects(updated);
    saveStoredProjects(updated);
    showToast(`Duplicated ${project.name}`);
  };

  const handleDeleteProject = (projectId: string) => {
    const target = projects.find((p) => p.id === projectId);
    const updated = projects.filter((p) => p.id !== projectId);
    setProjects(updated);
    saveStoredProjects(updated);
    showToast(`Deleted ${target?.name || ""}`);
  };

  const displayedProjects = useMemo(() => {
    let result = [...projects];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.owner.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.branch.toLowerCase().includes(q)
      );
    }

    return result;
  }, [projects, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0A0A09] text-[#FAF8F5] selection:bg-[#E58B62]/25 selection:text-[#FAF8F5]">
      {/* 1. Sleek Top Navigation Bar */}
      <DashboardTopNav />

      {/* 2. Workspace Body: Left Sidebar + Main Content */}
      <div className="flex-1 flex w-full">
        {/* Left Sidebar to Choose Projects and Deployments */}
        <DashboardSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          projectsCount={projects.length}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-6 sm:p-8 flex flex-col">
          {activeTab === "deployments" ? (
            /* Deployments View */
            <DeploymentsView projects={projects} />
          ) : (
            /* Projects View */
            <div className="w-full flex-1 flex flex-col">
              {/* Header Row: Title + Search + New Project Action */}
              <div
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7"
                style={
                  isReducedMotion
                    ? {}
                    : {
                        animation: "fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
                        animationDelay: "30ms",
                      }
                }
              >
                <div>
                  <h1 className="font-sans text-[20px] font-medium text-[#FAF8F5] tracking-tight">
                    Projects
                  </h1>
                </div>

                {/* Right: Search & New Project Button */}
                <div className="flex items-center gap-2.5">
                  {/* Search Input */}
                  <div className="relative flex items-center h-8 px-2.5 rounded-[5px] bg-[#111110] border border-[#1E1E1C] focus-within:border-[#333330] transition-colors w-52 sm:w-60 group">
                    <Search className="w-3.5 h-3.5 text-[#5A5954] group-focus-within:text-[#8E8C86] shrink-0" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search projects..."
                      className="w-full h-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-[#FAF8F5] placeholder-[#5A5954] text-[12px] px-2 font-sans"
                    />
                    {searchQuery ? (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="text-[#75736D] hover:text-[#FAF8F5] p-0.5 rounded cursor-pointer"
                        title="Clear"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    ) : (
                      <kbd className="text-[10px] font-mono text-[#4A4944] px-1 rounded bg-[#161615] border border-[#222220]">
                        /
                      </kbd>
                    )}
                  </div>

                  {/* New Project Button: Directly Launches Canvas */}
                  <button
                    type="button"
                    onClick={handleNewProjectClick}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[5px] bg-[#E58B62] hover:bg-[#F29C75] text-[#0C0B0A] font-sans font-medium text-[12px] transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New project</span>
                  </button>
                </div>
              </div>

              {/* Projects Grid or Clean Empty State */}
              <div className="flex-1 flex flex-col">
                {projects.length === 0 || isEmptyDemo ? (
                  <EmptyState onCreateProject={handleNewProjectClick} />
                ) : displayedProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center select-none">
                    <h3 className="font-sans text-[14px] font-medium text-[#FAF8F5]">
                      No projects found
                    </h3>
                    <p className="text-[12.5px] text-[#75736D] mt-1">
                      No results for &ldquo;{searchQuery}&rdquo;.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="mt-3 text-[12px] font-mono text-[#E58B62] hover:underline cursor-pointer"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  /* 2-Column Clean Cards */
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                    {displayedProjects.map((project, idx) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onRename={(p) => setRenameTarget(p)}
                        onDuplicate={handleDuplicateProject}
                        onDelete={(p) => setDeleteTarget(p)}
                        onToast={showToast}
                        index={idx}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Minimal Quiet Switcher in Footer */}
              <div className="mt-12 pt-4 border-t border-[#141413] flex items-center justify-between text-[11px] font-mono text-[#4A4944] select-none">
                <span>Summit Console</span>
                <button
                  type="button"
                  onClick={handleToggleEmptyDemo}
                  className="hover:text-[#75736D] transition-colors cursor-pointer"
                >
                  {isEmptyDemo || projects.length === 0
                    ? "← Restore demo projects"
                    : "Toggle empty state preview →"}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Rename Dialog */}
      <RenameProjectDialog
        project={renameTarget}
        isOpen={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        onRename={handleRenameProject}
      />

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        project={deleteTarget}
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirmDelete={handleDeleteProject}
      />

      {/* HUD Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#141413] border border-[#242422] text-[#FAF8F5] px-3.5 py-2 rounded-[6px] text-[12px] font-sans shadow-xl flex items-center gap-2 animate-in fade-in duration-150">
          <div className="w-1.5 h-1.5 rounded-full bg-[#E58B62]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
