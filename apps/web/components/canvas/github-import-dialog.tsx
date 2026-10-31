"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  X,
  Search,
  GitBranch,
  Check,
  ArrowLeft,
  FolderGit2,
  Lock,
  RotateCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import {
  connectServiceRepository,
  listGitHubInstallations,
  listSourceBuildServices,
  startGitHubInstallation,
  syncInstallationRepositories,
  type GitHubRepository,
  type SourceBuildService,
} from "@/lib/github-integration";

/**
 * Authentic Minimal GitHub Logo
 */
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

export interface GitHubImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (optionId: string, customData?: Record<string, unknown>) => void;
  onShowToast?: (message: string) => void;
}

export function GitHubImportDialog({
  isOpen,
  onClose,
  onConfirm,
  onShowToast,
}: GitHubImportDialogProps) {
  const { session, isLoading: isAuthLoading, openAuthModal } = useAuth();
  const accessToken = session?.access_token;

  // Navigation Steps: 1 = Repository Selection, 2 = Branch Selection
  const [step, setStep] = useState<1 | 2>(1);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [services, setServices] = useState<SourceBuildService[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [rootDirectory, setRootDirectory] = useState(".");
  const [dockerfilePath, setDockerfilePath] = useState("");
  const [buildCommand, setBuildCommand] = useState("");
  const [autoDeploy, setAutoDeploy] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [needsInstallation, setNeedsInstallation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedRepo = useMemo(
    () => repositories.find((repo) => repo.id === selectedRepoId) ?? null,
    [repositories, selectedRepoId],
  );

  const loadIntegration = useCallback(async () => {
    if (!accessToken) {
      if (isAuthLoading) {
        setIsLoading(true);
        return;
      }
      setRepositories([]);
      setServices([]);
      setNeedsInstallation(false);
      setErrorMessage("Sign in to connect a GitHub repository.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [installationResult, serviceResult] = await Promise.all([
        listGitHubInstallations(accessToken),
        listSourceBuildServices(accessToken),
      ]);
      const activeInstallation = installationResult.data.find(
        (item) => item.status === "active",
      );
      setServices(serviceResult.data);
      setSelectedServiceId((current) =>
        serviceResult.data.some((service) => service.id === current)
          ? current
          : serviceResult.data[0]?.id ?? "",
      );
      setNeedsInstallation(!activeInstallation);

      if (!activeInstallation) {
        setRepositories([]);
        setSelectedRepoId("");
        return;
      }

      // This is the existing backend sync path. It fetches all installation
      // pages, upserts complete repository rows, then returns the DB records.
      const synced = await syncInstallationRepositories(
        accessToken,
        activeInstallation.id,
      );
      setRepositories(synced.repositories);
      setSelectedRepoId((current) =>
        synced.repositories.some((repo) => repo.id === current)
          ? current
          : synced.repositories[0]?.id ?? "",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load GitHub repositories.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, isAuthLoading]);

  // The dialog mounts only while its chooser is active, so its local state is
  // fresh on each open. Load database-backed records and focus the search box.
  useEffect(() => {
    if (!isOpen) return;
    const focusTimeout = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 80);
    const loadTimeout = window.setTimeout(() => {
      void loadIntegration();
    }, 0);
    return () => {
      window.clearTimeout(focusTimeout);
      window.clearTimeout(loadTimeout);
    };
  }, [isOpen, loadIntegration]);

  // Filtered Repositories
  const filteredRepositories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return repositories;
    return repositories.filter((repo) => repo.full_name.toLowerCase().includes(q));
  }, [repositories, searchQuery]);

  // Keyboard navigation: Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (step === 2) {
          setStep(1);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, step, onClose]);

  if (!isOpen) return null;

  const handleInstallGitHubApp = async () => {
    if (!accessToken) {
      openAuthModal({ mode: "signin" });
      return;
    }
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      const result = await startGitHubInstallation(accessToken);
      window.location.assign(result.installation_url);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not start GitHub App installation.",
      );
      setIsConnecting(false);
    }
  };

  const handleAddToCanvas = async () => {
    if (!accessToken) {
      openAuthModal({ mode: "signin" });
      return;
    }
    if (!selectedRepo || !selectedServiceId || !selectedBranch.trim()) return;

    setIsConnecting(true);
    setErrorMessage(null);
    try {
      await connectServiceRepository(accessToken, selectedServiceId, {
        repositoryId: selectedRepo.id,
        branch: selectedBranch.trim(),
        rootDirectory,
        dockerfilePath: dockerfilePath.trim() || null,
        buildConfiguration: buildCommand.trim()
          ? { build_command: buildCommand.trim() }
          : {},
        autoDeploy,
      });

      const repoUrl = selectedRepo.html_url || `https://github.com/${selectedRepo.full_name}`;
      onConfirm("github", {
        label: selectedRepo.name,
        repoUrl,
        branch: selectedBranch.trim(),
        repositoryId: selectedRepo.id,
        serviceId: selectedServiceId,
        rootDir: rootDirectory,
        buildCommand,
      });

      if (onShowToast) {
        onShowToast(`Connected ${selectedRepo.full_name} to the selected service`);
      } else if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("summit:toast", {
            detail: { message: `Connected ${selectedRepo.full_name}`, type: "success" },
          }),
        );
      }
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not connect this repository.",
      );
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-[2px] animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] bg-[#111110] border border-[#222220] rounded-[10px] shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden animate-in fade-in zoom-in-[0.99] duration-150"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-repo-title"
      >
        {/* ================= STEP 1: REPOSITORY SELECTION ================= */}
        {step === 1 && (
          <>
            {/* Minimal Header */}
            <div className="px-5 pt-4 pb-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <GitHubIcon className="w-4 h-4 text-[#A09E98]" />
                <div>
                  <h3
                    id="import-repo-title"
                    className="font-sans text-[14px] font-medium text-[#F1F0ED] tracking-tight leading-none"
                  >
                    Import repository
                  </h3>
                  <p className="font-sans text-[11.5px] text-[#77756F] mt-1">
                    Choose a repository to add to your project.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="text-[#77756F] hover:text-[#F1F0ED] p-1 rounded transition-colors cursor-pointer"
                title="Close (Esc)"
                aria-label="Close dialog"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="px-5 pt-1 pb-3 flex flex-col flex-1 overflow-hidden">
              {/* Ultra-Minimal Search Bar with Animating Underline (No Box) */}
              <div className="relative pt-1 pb-2">
                <div className="flex items-center gap-2.5 py-1.5">
                  <Search
                    className={`w-3.5 h-3.5 transition-colors duration-200 shrink-0 ${
                      isSearchFocused ? "text-[#E58B62]" : "text-[#77756F]"
                    }`}
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    placeholder="Search repositories…"
                    className="w-full bg-transparent text-[12.5px] font-sans text-[#F1F0ED] placeholder:text-[#55534E] p-0 border-none !outline-none focus:!outline-none focus-visible:!outline-none focus:!ring-0 focus-visible:!ring-0 focus-visible:[outline:none!important] [outline:none!important] [box-shadow:none!important]"
                    style={{ outline: "none", boxShadow: "none", border: "none" }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        searchInputRef.current?.focus();
                      }}
                      className="text-[#77756F] hover:text-[#F1F0ED] p-0.5"
                      title="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Base neutral divider line */}
                <div className="h-px w-full bg-[#222220]" />

                {/* Smooth animating focus underline */}
                <div
                  className={`absolute bottom-2 left-0 h-px bg-[#E58B62] transition-all duration-300 ease-out pointer-events-none ${
                    isSearchFocused ? "w-full opacity-100" : "w-0 opacity-0"
                  }`}
                />
              </div>

              {errorMessage && (
                <div className="mb-2 flex items-start gap-2 rounded-[5px] border border-[#4A2B24] bg-[#1A1412] px-3 py-2 text-[11px] text-[#E8B29C]">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {needsInstallation && !isLoading && (
                <div className="mb-2 flex items-center justify-between gap-3 rounded-[5px] border border-[#292825] bg-[#161615] px-3 py-2.5">
                  <span className="text-[11.5px] text-[#A09E98]">
                    Install the Summit GitHub App to load repositories.
                  </span>
                  <button
                    type="button"
                    onClick={handleInstallGitHubApp}
                    disabled={isConnecting}
                    className="shrink-0 rounded-[5px] bg-[#E58B62] px-2.5 py-1.5 text-[11px] font-medium text-[#0B0B0A] disabled:opacity-50"
                  >
                    Install GitHub App
                  </button>
                </div>
              )}

              {!accessToken && !isAuthLoading && (
                <button
                  type="button"
                  onClick={() => openAuthModal({ mode: "signin" })}
                  className="mb-2 rounded-[5px] border border-[#3A302B] px-3 py-2 text-left text-[11.5px] text-[#E8B29C] hover:bg-[#1A1412]"
                >
                  Sign in with GitHub to load your connected repositories.
                </button>
              )}

              {/* Repository rows are read from the backend after its GitHub App sync. */}
              <div className="flex-1 overflow-hidden flex flex-col min-h-[200px] mt-1">
                {isLoading ? (
                  <div className="flex flex-1 items-center justify-center gap-2 text-[11.5px] text-[#77756F]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E58B62]" />
                    Syncing repositories from GitHub…
                  </div>
                ) : filteredRepositories.length > 0 ? (
                  <div className="max-h-[220px] overflow-y-auto space-y-0.5 custom-scrollbar pr-0.5">
                    {filteredRepositories.map((repo) => {
                      const isSelected = selectedRepoId === repo.id;
                      return (
                        <div
                          key={repo.id}
                          onClick={() => {
                            setSelectedRepoId(repo.id);
                            setSelectedBranch(repo.default_branch || "main");
                          }}
                          className={`group relative flex items-center justify-between px-3 py-2.5 rounded-[5px] transition-colors duration-150 cursor-pointer ${
                            isSelected
                              ? "bg-[#181817] text-[#F1F0ED]"
                              : "bg-transparent hover:bg-[#181817]/60 text-[#DCDAD5]"
                          }`}
                        >
                          {/* Left: Minimal repo icon + Name & Subtitle (No icon box container) */}
                          <div className="flex items-center gap-2.5 min-w-0 pr-3">
                            <FolderGit2
                              className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                                isSelected
                                  ? "text-[#E58B62]"
                                  : "text-[#77756F] group-hover:text-[#A09E98]"
                              }`}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`font-sans text-[12.5px] truncate transition-colors ${
                                    isSelected
                                      ? "font-medium text-[#F1F0ED]"
                                      : "text-[#C9C7C2] group-hover:text-[#F1F0ED]"
                                  }`}
                                >
                                  {repo.full_name}
                                </span>
                                {repo.private && (
                                  <Lock className="w-2.5 h-2.5 text-[#77756F] shrink-0" />
                                )}
                              </div>
                              <p className="font-sans text-[11px] text-[#77756F] group-hover:text-[#8E8C86] truncate">
                                {repo.owner} · GitHub App repository
                              </p>
                            </div>
                          </div>

                          {/* Right: Branch label & clean checkmark */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-[10.5px] text-[#77756F] group-hover:text-[#A09E98] flex items-center gap-1">
                              <GitBranch className="w-2.5 h-2.5" />
                              <span>{repo.default_branch || "no default branch"}</span>
                            </span>

                            <div className="w-3.5 h-3.5 flex items-center justify-center">
                              {isSelected && (
                                <Check className="w-3 h-3 text-[#E58B62]" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Empty state */
                  <div className="py-8 flex flex-col items-center justify-center text-center">
                    <p className="font-sans text-[12.5px] text-[#F1F0ED]">
                      {needsInstallation ? "Connect GitHub to continue" : "No repositories found"}
                    </p>
                    <p className="font-sans text-[11px] text-[#77756F] mt-0.5">
                      {needsInstallation
                        ? "Repositories available to the GitHub App will appear here."
                        : searchQuery
                          ? `No matching repository for “${searchQuery}”.`
                          : "Refresh to sync repositories available to your GitHub App."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Minimal Footer */}
            <div className="px-5 py-3 border-t border-[#222220] flex items-center justify-between shrink-0">
              <div className="text-[11.5px] text-[#77756F] font-sans">
                {selectedRepo ? (
                  <span className="text-[#A09E98] flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-[#E58B62]" />
                    <span>1 repository selected</span>
                  </span>
                ) : (
                  <span>Choose a repository</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadIntegration()}
                  disabled={isLoading || !accessToken}
                  className="inline-flex items-center gap-1.5 rounded-[5px] px-2 py-1 text-[11px] text-[#A09E98] hover:text-[#F1F0ED] disabled:opacity-40"
                  title="Sync repositories"
                >
                  <RotateCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1 rounded-[5px] text-[#A09E98] hover:text-[#F1F0ED] text-[12px] font-sans transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedRepoId || isLoading}
                  onClick={() => setStep(2)}
                  className="px-3.5 py-1.5 rounded-[5px] bg-[#E58B62] hover:bg-[#F0A17B] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#E58B62] text-[#0B0B0A] font-sans font-medium text-[12px] transition-colors cursor-pointer"
                >
                  Continue
                </button>
              </div>
            </div>
          </>
        )}

        {/* ================= STEP 2: BRANCH SELECTION ================= */}
        {step === 2 && selectedRepo && (
          <>
            {/* Minimal Header */}
            <div className="px-5 pt-4 pb-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <GitBranch className="w-4 h-4 text-[#E58B62]" />
                <div>
                  <h3 className="font-sans text-[14px] font-medium text-[#F1F0ED] tracking-tight leading-none">
                    Select branch
                  </h3>
                  <p className="font-sans text-[11.5px] text-[#77756F] mt-1">
                    Choose which branch to connect as the source.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="text-[#77756F] hover:text-[#F1F0ED] p-1 rounded transition-colors cursor-pointer"
                title="Close (Esc)"
                aria-label="Close dialog"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Minimal Step 2 Content */}
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
              {/* Selected Repo Line (No Heavy Box Card) */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FolderGit2 className="w-4 h-4 text-[#E58B62] shrink-0" />
                  <div className="min-w-0">
                    <span className="font-sans text-[13px] font-medium text-[#F1F0ED] truncate block">
                      {selectedRepo.full_name}
                    </span>
                    <span className="font-sans text-[11px] text-[#77756F] truncate block">
                      {selectedRepo.private ? "Private repository" : "Public repository"}
                    </span>
                  </div>
                </div>
              </div>

              {/* The backend owns the service and repository records. */}
              <div className="space-y-1.5">
                <label
                  htmlFor="summit-source-service"
                  className="block font-mono text-[10.5px] text-[#77756F] uppercase tracking-wider"
                >
                  Summit Service
                </label>
                {services.length > 0 ? (
                  <select
                    id="summit-source-service"
                    value={selectedServiceId}
                    onChange={(event) => setSelectedServiceId(event.target.value)}
                    className="w-full rounded-[5px] border border-[#242424] bg-[#181817] px-3 py-2 text-[12px] text-[#F1F0ED] outline-none focus:border-[#E58B62]"
                  >
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.project_name} / {service.name} ({service.type})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="rounded-[5px] border border-[#292825] bg-[#161615] px-3 py-2 text-[11px] text-[#A09E98]">
                    No web or worker services are available for this account.
                  </p>
                )}
              </div>

              {/* Branch and supported source build settings */}
              <div className="space-y-1.5 pt-1">
                <label
                  htmlFor="summit-source-branch"
                  className="block font-mono text-[10.5px] text-[#77756F] uppercase tracking-wider"
                >
                  Target Branch
                </label>
                <div className="relative flex items-center">
                  <GitBranch className="absolute left-2.5 h-3.5 w-3.5 text-[#77756F]" />
                  <input
                    id="summit-source-branch"
                    value={selectedBranch}
                    onChange={(event) => setSelectedBranch(event.target.value)}
                    placeholder={selectedRepo.default_branch || "main"}
                    className="w-full rounded-[5px] border border-[#242424] bg-[#181817] py-2 pl-8 pr-3 font-mono text-[12px] text-[#F1F0ED] outline-none focus:border-[#E58B62]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 text-[10.5px] font-mono uppercase tracking-wider text-[#77756F]">
                  Root directory
                  <input
                    value={rootDirectory}
                    onChange={(event) => setRootDirectory(event.target.value)}
                    className="w-full rounded-[5px] border border-[#242424] bg-[#181817] px-2.5 py-2 font-mono text-[11.5px] normal-case tracking-normal text-[#F1F0ED] outline-none focus:border-[#E58B62]"
                  />
                </label>
                <label className="space-y-1.5 text-[10.5px] font-mono uppercase tracking-wider text-[#77756F]">
                  Dockerfile
                  <input
                    value={dockerfilePath}
                    onChange={(event) => setDockerfilePath(event.target.value)}
                    placeholder="Dockerfile (optional)"
                    className="w-full rounded-[5px] border border-[#242424] bg-[#181817] px-2.5 py-2 font-mono text-[11.5px] normal-case tracking-normal text-[#F1F0ED] outline-none focus:border-[#E58B62]"
                  />
                </label>
              </div>

              <label className="block space-y-1.5 text-[10.5px] font-mono uppercase tracking-wider text-[#77756F]">
                Build command
                <input
                  value={buildCommand}
                  onChange={(event) => setBuildCommand(event.target.value)}
                  placeholder="pnpm build (optional)"
                  className="w-full rounded-[5px] border border-[#242424] bg-[#181817] px-2.5 py-2 font-mono text-[11.5px] normal-case tracking-normal text-[#F1F0ED] outline-none focus:border-[#E58B62]"
                />
              </label>

              <label className="flex items-center gap-2 text-[11.5px] text-[#A09E98]">
                <input
                  type="checkbox"
                  checked={autoDeploy}
                  onChange={(event) => setAutoDeploy(event.target.checked)}
                  className="accent-[#E58B62]"
                />
                Deploy automatically when this branch changes
              </label>

              {errorMessage && (
                <p className="flex items-start gap-2 rounded-[5px] border border-[#4A2B24] bg-[#1A1412] px-3 py-2 text-[11px] text-[#E8B29C]">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{errorMessage}</span>
                </p>
              )}

              {/* Minimal Explanation Note */}
              <p className="font-sans text-[11.5px] text-[#77756F] leading-normal pt-1">
                This saves the repository in Summit and connects it to the selected service.
              </p>
            </div>

            {/* Step 2 Footer */}
            <div className="px-5 py-3 border-t border-[#222220] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-[5px] text-[#A09E98] hover:text-[#F1F0ED] text-[12px] font-sans transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1 rounded-[5px] text-[#A09E98] hover:text-[#F1F0ED] text-[12px] font-sans transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isConnecting || !selectedServiceId || !selectedBranch.trim()}
                  onClick={handleAddToCanvas}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[5px] bg-[#E58B62] hover:bg-[#F0A17B] disabled:opacity-40 disabled:cursor-not-allowed text-[#0B0B0A] font-sans font-medium text-[12px] transition-colors cursor-pointer"
                >
                  {isConnecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Connect repository
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
