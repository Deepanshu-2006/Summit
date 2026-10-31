"use client";

import React, { useState, useEffect, useRef, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { DashboardTopNav } from "./dashboard-top-nav";
import { ProjectToolbar } from "./project-toolbar";
import { ProjectCard } from "./project-card";
import { ProjectListRow } from "./project-list-row";
import { EmptyState } from "./empty-state";
import { CreateProjectDialog } from "./create-project-dialog";
import { RenameProjectDialog } from "./rename-project-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import {
  getStoredProjects,
  saveStoredProjects,
  seedProjectCanvasArchitecture,
  INITIAL_DEMO_PROJECTS,
  DASHBOARD_VIEW_MODE_KEY,
} from "@/lib/dashboard/mock-data";
import type {
  DashboardProject,
  ViewMode,
  SortOption,
  StatusFilter,
} from "@/lib/dashboard/types";

// SSR-safe subscription for prefers-reduced-motion
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

  // Core Project State
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("updated");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Dialogs State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DashboardProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardProject | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Empty state toggle for reviewers to effortlessly test both states
  const [isEmptyDemo, setIsEmptyDemo] = useState(false);

  // Load projects from localStorage on mount
  useEffect(() => {
    const loaded = getStoredProjects();
    setProjects(loaded);

    // Load view mode preference
    try {
      const savedMode = localStorage.getItem(DASHBOARD_VIEW_MODE_KEY) as ViewMode | null;
      if (savedMode === "grid" || savedMode === "list") {
        setViewMode(savedMode);
      }
    } catch {}

    setIsInitialized(true);
  }, []);

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(DASHBOARD_VIEW_MODE_KEY, mode);
    } catch {}
  };

  // Toggle between Populated demo data and Empty demo state
  const handleToggleEmptyDemo = () => {
    if (isEmptyDemo) {
      setProjects(INITIAL_DEMO_PROJECTS);
      saveStoredProjects(INITIAL_DEMO_PROJECTS);
      setIsEmptyDemo(false);
      showToast("Demo projects restored.");
    } else {
      setProjects([]);
      setIsEmptyDemo(true);
      showToast("Switched to Empty Dashboard state.");
    }
  };

  // Create Project handler
  const handleCreateProject = (
    newProjData: Omit<DashboardProject, "id" | "updatedAt" | "createdAt">
  ) => {
    const id = `proj_${Math.random().toString(36).substring(2, 9)}`;
    const newProject: DashboardProject = {
      ...newProjData,
      id,
      updatedAt: "just now",
      createdAt: new Date().toISOString(),
    };

    // Seed its canvas architecture
    seedProjectCanvasArchitecture(newProject);

    // Update state & persistence
    const updated = [newProject, ...projects];
    setProjects(updated);
    saveStoredProjects(updated);
    setIsEmptyDemo(false);
    setIsCreateOpen(false);

    showToast(`Project created: ${newProject.name}`);
  };

  // Rename Project handler
  const handleRenameProject = (projectId: string, newName: string) => {
    const updated = projects.map((p) =>
      p.id === projectId ? { ...p, name: newName, updatedAt: "just now" } : p
    );
    setProjects(updated);
    saveStoredProjects(updated);
    showToast(`Project renamed to ${newName}`);
  };

  // Duplicate Project handler
  const handleDuplicateProject = (project: DashboardProject) => {
    const id = `proj_${Math.random().toString(36).substring(2, 9)}`;
    const duplicated: DashboardProject = {
      ...project,
      id,
      name: `${project.name}-copy`,
      updatedAt: "just now",
      createdAt: new Date().toISOString(),
    };

    seedProjectCanvasArchitecture(duplicated);

    const updated = [duplicated, ...projects];
    setProjects(updated);
    saveStoredProjects(updated);
    showToast(`Duplicated ${project.name} as ${duplicated.name}`);
  };

  // Delete Project handler
  const handleDeleteProject = (projectId: string) => {
    const target = projects.find((p) => p.id === projectId);
    const updated = projects.filter((p) => p.id !== projectId);
    setProjects(updated);
    saveStoredProjects(updated);
    showToast(`Project ${target?.name || ""} deleted.`);
  };

  // Filtered & Sorted Projects
  const displayedProjects = useMemo(() => {
    let result = [...projects];

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.type.toLowerCase().includes(q) ||
          p.branch.toLowerCase().includes(q) ||
          p.environment.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortOption === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sortOption === "created") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      // "updated" is default
      return 0;
    });

    return result;
  }, [projects, statusFilter, searchQuery, sortOption]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0C0B0A] text-[#FAF8F5] selection:bg-[#E58B62]/25 selection:text-[#FAF8F5]">
      {/* Stage 1: Top Navigation Bar */}
      <DashboardTopNav
        onSearchFocus={() => searchInputRef.current?.focus()}
        onOpenNewProject={() => setIsCreateOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1240px] mx-auto px-5 sm:px-8 py-8 sm:py-10 flex flex-col">
        {/* Stage 2: Page Header Row */}
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
          style={
            isReducedMotion
              ? {}
              : {
                  animation: "fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
                  animationDelay: "80ms",
                }
          }
        >
          <div>
            <h1 className="font-sans text-[24px] sm:text-[26px] font-semibold text-[#FAF8F5] tracking-tight">
              Projects
            </h1>
            <p className="text-[13px] text-[#8E8C86] mt-1">
              Your projects, services, and infrastructure in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 h-9 px-4 rounded-[6px] bg-[#E58B62] hover:bg-[#F29C75] text-[#0C0B0A] font-sans font-semibold text-[13px] transition-all duration-150 shadow-sm active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New project</span>
          </button>
        </div>

        {/* Stage 3: Project Toolbar */}
        <div
          style={
            isReducedMotion
              ? {}
              : {
                  animation: "fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
                  animationDelay: "140ms",
                }
          }
        >
          <ProjectToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            sortOption={sortOption}
            onSortOptionChange={setSortOption}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            searchInputRef={searchInputRef}
            totalCount={projects.length}
            filteredCount={displayedProjects.length}
            isEmptyDemo={isEmptyDemo || projects.length === 0}
            onToggleEmptyDemo={handleToggleEmptyDemo}
          />
        </div>

        {/* Stage 4: Content State (Empty State vs Populated Projects) */}
        <div className="flex-1 flex flex-col">
          {projects.length === 0 || isEmptyDemo ? (
            /* Dedicated Empty State */
            <EmptyState
              onCreateProject={() => setIsCreateOpen(true)}
              onExploreCanvas={() => router.push("/dashboard/project/new")}
            />
          ) : displayedProjects.length === 0 ? (
            /* Search / Filter yielded no matches */
            <div className="flex flex-col items-center justify-center py-20 text-center select-none">
              <div className="w-10 h-10 rounded-full bg-[#181817] border border-[#262624] flex items-center justify-center text-[#8E8C86] mb-3">
                ?
              </div>
              <h3 className="font-sans text-[15px] font-medium text-[#FAF8F5]">
                No projects found
              </h3>
              <p className="text-[13px] text-[#8E8C86] mt-1 max-w-sm">
                No projects matched your search for &ldquo;{searchQuery}&rdquo;. Try clearing filters or creating a new project.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="mt-4 px-3.5 py-1.5 rounded-[6px] bg-[#181817] border border-[#282826] hover:border-[#383834] text-[12.5px] font-sans text-[#FAF8F5] transition-colors cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : viewMode === "grid" ? (
            /* Populated Grid View (3 columns desktop, 2 tablet, 1 mobile) */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          ) : (
            /* Populated List View */
            <div className="w-full bg-[#141413] border border-[#242422] rounded-[10px] overflow-hidden shadow-sm">
              {/* Table Column Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#10100F] border-b border-[#20201E] text-[11px] font-mono uppercase tracking-wider text-[#75736D] select-none">
                <div className="flex-1 min-w-0">Project</div>
                <div className="w-28 shrink-0 hidden sm:block">Environment</div>
                <div className="w-32 shrink-0 hidden lg:block">Branch</div>
                <div className="w-24 shrink-0 text-right pr-3">Updated</div>
                <div className="w-7 shrink-0 text-right"></div>
              </div>

              {/* Rows */}
              {displayedProjects.map((project, idx) => (
                <ProjectListRow
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
      </main>

      {/* Dialogs */}
      <CreateProjectDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateProject}
      />

      <RenameProjectDialog
        project={renameTarget}
        isOpen={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        onRename={handleRenameProject}
      />

      <DeleteConfirmDialog
        project={deleteTarget}
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirmDelete={handleDeleteProject}
      />

      {/* Floating HUD feedback toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#161615] border border-[#2E2E2A] text-[#FAF8F5] px-4 py-2.5 rounded-[8px] text-[13px] font-sans shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="w-1.5 h-1.5 rounded-full bg-[#E58B62]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

