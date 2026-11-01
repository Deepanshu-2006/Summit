"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { Plus, Search, X, AlertCircle, RotateCw } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { DashboardTopNav } from "./dashboard-top-nav";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DeploymentsView } from "./deployments-view";
import { ProjectCard } from "./project-card";
import { EmptyState } from "./empty-state";
import { NewProjectCard } from "./new-project-card";
import { RenameProjectDialog } from "./rename-project-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { useAuth } from "@/components/auth/auth-context";
import { clearProjectArchitecture } from "@/lib/canvas/initial-graph";
import {
  deleteProject,
  describeApiError,
  listAllProjects,
  renameProject,
  toDashboardProject,
} from "@/lib/platform-api";
import type { DashboardProject } from "@/lib/dashboard/types";

type LoadState = "loading" | "ready" | "error";

interface DashboardScreenProps {
  initialNewProject?: boolean;
}

export function DashboardScreen({ initialNewProject = false }: DashboardScreenProps = {}) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const [activeTab, setActiveTab] = useState<"projects" | "deployments">("projects");
  const { user, session, isLoading: isAuthLoading, openAuthModal } = useAuth();
  const accessToken = session?.access_token;
  const userId = user?.id;

  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [fetchState, setFetchState] = useState<LoadState>("loading");
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(initialNewProject);

  // Rename and Delete Dialogs
  const [renameTarget, setRenameTarget] = useState<DashboardProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardProject | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load the signed-in user's projects from the backend. State is only set
  // after the request settles; stale responses (token change / unmount) are dropped.
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    listAllProjects(accessToken)
      .then((loaded) => {
        if (cancelled) return;
        const now = Date.now();
        setProjects(
          loaded
            .map((project) => toDashboardProject(project, now))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        );
        setFetchError(null);
        setLoadedUserId(userId ?? null);
        setFetchState("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        setFetchError(describeApiError(error, "Could not load your projects."));
        setLoadedUserId(userId ?? null);
        setFetchState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, userId, reloadKey]);

  const viewState: LoadState | "signed-out" = isAuthLoading
    ? "loading"
    : !accessToken
    ? "signed-out"
    : loadedUserId !== (userId ?? null)
    ? "loading"
    : fetchState;

  const handleRetry = useCallback(() => {
    setFetchState("loading");
    setLoadedUserId(null);
    setReloadKey((key) => key + 1);
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

  // Smoothly animates into New Project flow
  const handleNewProjectClick = () => {
    setIsCreatingProject(true);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/dashboard/project/new");
    }
  };

  const handleBackFromNewProject = () => {
    setIsCreatingProject(false);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/dashboard");
    }
  };

  useEffect(() => {
    const onPopState = () => {
      if (typeof window !== "undefined") {
        setIsCreatingProject(window.location.pathname.includes("/project/new"));
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isCreatingProject) {
        handleBackFromNewProject();
      }
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isCreatingProject]);

  const handleRenameProject = async (projectId: string, newName: string) => {
    if (!accessToken) throw new Error("Sign in to rename projects.");
    const updated = await renameProject(accessToken, projectId, newName);
    const mapped = toDashboardProject(updated);
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? { ...project, name: mapped.name, slug: mapped.slug, updatedAt: mapped.updatedAt, updatedLabel: mapped.updatedLabel }
          : project,
      ),
    );
    showToast(`Renamed to ${updated.name}`);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!accessToken) throw new Error("Sign in to delete projects.");
    const target = projects.find((p) => p.id === projectId);
    await deleteProject(accessToken, projectId);
    clearProjectArchitecture(projectId);
    setProjects((current) => current.filter((project) => project.id !== projectId));
    showToast(`Deleted ${target?.name || "project"}`);
  };

  const displayedProjects = useMemo(() => {
    let result = [...projects];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          (p.repository ?? "").toLowerCase().includes(q) ||
          (p.branch ?? "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [projects, searchQuery]);

  const hasProjects = viewState === "ready" && projects.length > 0;
  // Everything except a populated list uses the full-bleed hero layout.
  const isProjectsEmpty = !hasProjects;

  return (
    <div className="min-h-screen flex flex-col bg-[#0A0A09] text-[#FAF8F5] selection:bg-[#E58B62]/25 selection:text-[#FAF8F5]">
      {/* 1. Sleek Top Navigation Bar */}
      <DashboardTopNav
        isCreatingProject={isCreatingProject}
        onBackToProjects={handleBackFromNewProject}
      />

      {/* 2. Workspace Body: Left Sidebar + Main Content */}
      <div className="flex-1 flex w-full overflow-hidden">
        {/* Left Sidebar to Choose Projects and Deployments (Slides out smoothly when creating new project) */}
        <AnimatePresence initial={false}>
          {!isCreatingProject && (
            <motion.div
              key="dashboard-sidebar-wrapper"
              initial={{ x: 0, opacity: 1, width: 200 }}
              animate={{ x: 0, opacity: 1, width: 200 }}
              exit={{
                x: -210,
                opacity: 0,
                width: 0,
                transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
              }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="shrink-0 overflow-hidden"
            >
              <DashboardSidebar
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main
          className={`flex-1 min-w-0 min-h-[calc(100vh-48px)] flex flex-col relative ${
            (isProjectsEmpty || isCreatingProject) && activeTab === "projects"
              ? "p-0 overflow-hidden"
              : "p-6 sm:p-8"
          }`}
        >
          {/* Full-bleed Alpine Dither Background with reduced opacity for high text legibility */}
          {(isProjectsEmpty || isCreatingProject) && activeTab === "projects" && (
            <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0 bg-[#0A0A09]">
              <Image
                src="/images/dashboard-empty-bg.png"
                alt=""
                aria-hidden="true"
                fill
                sizes="100vw"
                className="w-full h-full object-cover object-bottom select-none pointer-events-none opacity-[0.18]"
              />
            </div>
          )}

          <AnimatePresence mode="wait">
            {isCreatingProject ? (
              /* New Project Flow with low opacity background */
              <motion.div
                key="new-project-flow-view"
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="relative z-10 w-full flex-1 min-h-[calc(100vh-48px)] flex items-center justify-center p-4"
              >
                <NewProjectCard onCancel={handleBackFromNewProject} />
              </motion.div>
            ) : activeTab === "deployments" ? (
              /* Deployments View */
              <motion.div
                key="deployments-view"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="w-full flex-1 flex flex-col"
              >
                <DeploymentsView
                  projects={projects}
                  accessToken={accessToken}
                  isAuthLoading={isAuthLoading}
                  projectsState={viewState}
                  onSignIn={() => openAuthModal({ mode: "signin" })}
                />
              </motion.div>
            ) : (
              /* Projects View */
              <motion.div
                key="projects-view"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: 0,
                        y: -10,
                        transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
                      }
                }
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className={`w-full flex-1 flex flex-col ${
                  isProjectsEmpty
                    ? "max-w-none relative min-h-[calc(100vh-48px)] overflow-hidden"
                    : "max-w-[1180px]"
                }`}
              >
                {/* Header Row: Title (+ Search & New Project if projects exist) */}
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className={`flex items-center justify-between gap-4 relative z-20 ${
                    isProjectsEmpty ? "px-6 sm:px-8 pt-6 sm:pt-8 pb-4" : "mb-7"
                  }`}
                >
                  <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.26, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-center gap-2.5"
                  >
                    <h1 className="font-sans text-[20px] font-medium text-[#FAF8F5] tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                      Projects
                    </h1>
                    {hasProjects && (
                      <span className="text-[11px] font-mono text-[#75736D] bg-[#141413] border border-[#1E1E1C] px-2 py-0.5 rounded-full">
                        {projects.length} {projects.length === 1 ? "project" : "projects"}
                      </span>
                    )}
                  </motion.div>

                  {/* Right: Search & New Project Button (Only shown when projects exist) */}
                  {hasProjects && (
                    <motion.div
                      initial={shouldReduceMotion ? false : { opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.26, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
                      className="flex items-center gap-2.5"
                    >
                      {/* Search Input */}
                      <div className="relative flex items-center h-8 px-2.5 rounded-[5px] bg-[#111110] border border-[#1E1E1C] focus-within:border-[#333330] transition-colors w-52 sm:w-60 group shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
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

                      {/* New Project Button */}
                      <button
                        type="button"
                        onClick={handleNewProjectClick}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[5px] bg-[#E58B62] hover:bg-[#F29C75] text-[#0C0B0A] font-sans font-medium text-[12px] transition-colors cursor-pointer shrink-0 shadow-[0_2px_8px_rgba(229,139,98,0.25)]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New project</span>
                      </button>
                    </motion.div>
                  )}
                </motion.div>

                {/* Projects Grid or Clean Empty State */}
                <div className={`flex-1 flex flex-col ${isProjectsEmpty ? "relative z-10" : ""}`}>
                  <AnimatePresence mode="wait">
                    {viewState === "loading" ? (
                      <motion.div
                        key="loading-state-view"
                        initial={shouldReduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 flex items-center justify-center text-[#75736D] font-mono text-[12.5px] select-none"
                        role="status"
                      >
                        Loading projects…
                      </motion.div>
                    ) : viewState === "signed-out" ? (
                      <StatePanel
                        key="signed-out-view"
                        title="Sign in to see your projects"
                        description="Your projects, services and deployments live in your Summit account."
                        actionLabel="Sign in"
                        onAction={() => openAuthModal({ mode: "signin" })}
                      />
                    ) : viewState === "error" ? (
                      <StatePanel
                        key="error-view"
                        tone="error"
                        title="Could not load projects"
                        description={fetchError ?? "The Summit backend returned an error."}
                        actionLabel="Try again"
                        onAction={handleRetry}
                      />
                    ) : isProjectsEmpty ? (
                      <motion.div
                        key="empty-state-view"
                        initial={shouldReduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 flex flex-col h-full"
                      >
                        <EmptyState onCreateProject={handleNewProjectClick} />
                      </motion.div>
                    ) : displayedProjects.length === 0 ? (
                      <motion.div
                        key="no-projects-view"
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col items-center justify-center py-20 text-center select-none"
                      >
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
                      </motion.div>
                    ) : (
                      /* 3-Column Compact Developer Grid */
                      <motion.div
                        key="projects-grid-view"
                        initial={shouldReduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5"
                      >
                        {displayedProjects.map((project, idx) => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            onRename={(p) => setRenameTarget(p)}
                            onDelete={(p) => setDeleteTarget(p)}
                            onToast={showToast}
                            index={idx}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Minimal footer - hidden unless projects are listed */}
                {hasProjects && (
                  <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="mt-12 pt-4 border-t border-[#141413] flex items-center justify-between text-[11px] font-mono text-[#4A4944] select-none"
                  >
                    <span>Summit Console</span>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
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
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed bottom-6 right-6 z-50 bg-[#141413] border border-[#242422] text-[#FAF8F5] px-3.5 py-2 rounded-[6px] text-[12px] font-sans shadow-xl flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#E58B62]" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatePanel({
  title,
  description,
  actionLabel,
  onAction,
  tone = "neutral",
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  tone?: "neutral" | "error";
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 select-none" role={tone === "error" ? "alert" : undefined}>
      {tone === "error" && <AlertCircle className="w-5 h-5 text-[#D77D7D] mb-3" />}
      <h3 className="font-sans text-[16px] font-medium text-[#FAF8F5]">{title}</h3>
      <p className="text-[12.5px] text-[#8E8C86] mt-1.5 max-w-[420px] leading-relaxed">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[5px] bg-[#E58B62] hover:bg-[#F29C75] text-[#0C0B0A] font-sans font-medium text-[12px] transition-colors cursor-pointer"
      >
        {tone === "error" && <RotateCw className="w-3 h-3" />}
        <span>{actionLabel}</span>
      </button>
    </div>
  );
}
