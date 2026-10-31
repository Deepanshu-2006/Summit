"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Search,
  GitBranch,
  Check,
  ChevronDown,
  ArrowLeft,
  FolderGit2,
  Lock,
  Globe,
} from "lucide-react";

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

export interface DemoRepository {
  id: string;
  name: string;
  owner: string;
  repoName: string;
  description: string;
  defaultBranch: string;
  branches: string[];
  isPrivate?: boolean;
}

export const DEMO_REPOSITORIES: DemoRepository[] = [
  {
    id: "repo-1",
    name: "summit / web",
    owner: "summit",
    repoName: "web",
    description: "Next.js · App Router",
    defaultBranch: "main",
    branches: ["main", "develop", "staging", "v2-canvas"],
    isPrivate: false,
  },
  {
    id: "repo-2",
    name: "summit / backend",
    owner: "summit",
    repoName: "backend",
    description: "Go · REST API",
    defaultBranch: "main",
    branches: ["main", "develop", "feat/grpc", "release/v1.2"],
    isPrivate: true,
  },
  {
    id: "repo-3",
    name: "summit / api-gateway",
    owner: "summit",
    repoName: "api-gateway",
    description: "Node.js · TypeScript",
    defaultBranch: "develop",
    branches: ["develop", "main", "feat/ratelimit"],
    isPrivate: false,
  },
  {
    id: "repo-4",
    name: "summit / dashboard",
    owner: "summit",
    repoName: "dashboard",
    description: "React · TypeScript",
    defaultBranch: "main",
    branches: ["main", "develop", "staging"],
    isPrivate: true,
  },
  {
    id: "repo-5",
    name: "summit / worker",
    owner: "summit",
    repoName: "worker",
    description: "Node.js · Background jobs",
    defaultBranch: "main",
    branches: ["main", "worker-queue", "develop"],
    isPrivate: false,
  },
];

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
  // Navigation Steps: 1 = Repository Selection, 2 = Branch Selection
  const [step, setStep] = useState<1 | 2>(1);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Selected Repository & Branch
  const [selectedRepoId, setSelectedRepoId] = useState<string>("repo-1");
  const [selectedBranch, setSelectedBranch] = useState<string>("main");
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSearchQuery("");
      setIsBranchDropdownOpen(false);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 80);
    }
  }, [isOpen]);

  // Selected Repository Object
  const selectedRepo = useMemo(() => {
    return (
      DEMO_REPOSITORIES.find((r) => r.id === selectedRepoId) ||
      DEMO_REPOSITORIES[0]
    );
  }, [selectedRepoId]);

  // Synchronize branch whenever selected repo changes
  useEffect(() => {
    if (selectedRepo) {
      setSelectedBranch(selectedRepo.defaultBranch);
    }
  }, [selectedRepo]);

  // Filtered Repositories
  const filteredRepositories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return DEMO_REPOSITORIES;
    return DEMO_REPOSITORIES.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.repoName.toLowerCase().includes(q) ||
        r.defaultBranch.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Keyboard navigation: Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isBranchDropdownOpen) {
          setIsBranchDropdownOpen(false);
        } else if (step === 2) {
          setStep(1);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, step, isBranchDropdownOpen, onClose]);

  if (!isOpen) return null;

  // Handle final node addition to canvas
  const handleAddToCanvas = () => {
    if (!selectedRepo) return;

    const repoNameClean = selectedRepo.repoName || "web-repo";
    const repoUrl = `https://github.com/${selectedRepo.name.replace(/\s+/g, "")}`;

    // Confirm node creation in canvas
    onConfirm("github", {
      label: repoNameClean,
      repoUrl,
      branch: selectedBranch,
    });

    // Notify user with subtle success toast
    if (onShowToast) {
      onShowToast(`Repository added to canvas`);
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("summit:toast", {
          detail: { message: "Repository added to canvas", type: "success" },
        })
      );
    }

    onClose();
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

              {/* Minimal Repository List (No Cards, No Heavy Boxes) */}
              <div className="flex-1 overflow-hidden flex flex-col min-h-[200px] mt-1">
                {filteredRepositories.length > 0 ? (
                  <div className="max-h-[220px] overflow-y-auto space-y-0.5 custom-scrollbar pr-0.5">
                    {filteredRepositories.map((repo) => {
                      const isSelected = selectedRepoId === repo.id;
                      return (
                        <div
                          key={repo.id}
                          onClick={() => setSelectedRepoId(repo.id)}
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
                                  {repo.name}
                                </span>
                                {repo.isPrivate && (
                                  <Lock className="w-2.5 h-2.5 text-[#77756F] shrink-0" />
                                )}
                              </div>
                              <p className="font-sans text-[11px] text-[#77756F] group-hover:text-[#8E8C86] truncate">
                                {repo.description}
                              </p>
                            </div>
                          </div>

                          {/* Right: Branch label & clean checkmark */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-[10.5px] text-[#77756F] group-hover:text-[#A09E98] flex items-center gap-1">
                              <GitBranch className="w-2.5 h-2.5" />
                              <span>{repo.defaultBranch}</span>
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
                      No repositories found
                    </p>
                    <p className="font-sans text-[11px] text-[#77756F] mt-0.5">
                      No matching repo for &ldquo;{searchQuery}&rdquo;.
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
                  onClick={onClose}
                  className="px-3 py-1 rounded-[5px] text-[#A09E98] hover:text-[#F1F0ED] text-[12px] font-sans transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedRepoId}
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
            <div className="px-5 py-4 space-y-4">
              {/* Selected Repo Line (No Heavy Box Card) */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FolderGit2 className="w-4 h-4 text-[#E58B62] shrink-0" />
                  <div className="min-w-0">
                    <span className="font-sans text-[13px] font-medium text-[#F1F0ED] truncate block">
                      {selectedRepo.name}
                    </span>
                    <span className="font-sans text-[11px] text-[#77756F] truncate block">
                      {selectedRepo.description}
                    </span>
                  </div>
                </div>

                <span className="font-mono text-[10.5px] text-[#77756F]">
                  {selectedRepo.branches.length} branches
                </span>
              </div>

              {/* Branch Selector */}
              <div className="space-y-1.5 pt-1">
                <label className="block font-mono text-[10.5px] text-[#77756F] uppercase tracking-wider">
                  Target Branch
                </label>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsBranchDropdownOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-[5px] bg-[#181817] hover:bg-[#1f1f1d] border border-[#242424] text-left transition-colors cursor-pointer"
                    aria-expanded={isBranchDropdownOpen}
                  >
                    <div className="flex items-center gap-2 font-mono text-[12px] text-[#F1F0ED]">
                      <GitBranch className="w-3 h-3 text-[#E58B62]" />
                      <span>{selectedBranch}</span>
                      {selectedBranch === selectedRepo.defaultBranch && (
                        <span className="text-[10px] text-[#77756F] font-sans px-1 rounded bg-[#121211]">
                          default
                        </span>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[#77756F] transition-transform duration-150 ${
                        isBranchDropdownOpen ? "rotate-180 text-[#F1F0ED]" : ""
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {isBranchDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-[#181817] border border-[#242424] rounded-[6px] shadow-2xl py-1 overflow-hidden animate-in fade-in duration-100">
                      {selectedRepo.branches.map((b) => (
                        <div
                          key={b}
                          onClick={() => {
                            setSelectedBranch(b);
                            setIsBranchDropdownOpen(false);
                          }}
                          className={`flex items-center justify-between px-3 py-1.5 text-[12px] font-mono cursor-pointer transition-colors ${
                            selectedBranch === b
                              ? "bg-[#201A17] text-[#E58B62]"
                              : "text-[#DCDAD5] hover:bg-[#202020] hover:text-[#F1F0ED]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <GitBranch className="w-3 h-3 text-[#77756F]" />
                            <span>{b}</span>
                            {b === selectedRepo.defaultBranch && (
                              <span className="text-[10px] text-[#77756F] font-sans px-1 rounded bg-[#121211]">
                                default
                              </span>
                            )}
                          </div>
                          {selectedBranch === b && (
                            <Check className="w-3 h-3 text-[#E58B62]" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Minimal Explanation Note */}
              <p className="font-sans text-[11.5px] text-[#77756F] leading-normal pt-1">
                This branch will be deployed as the source for your application service. You can switch branches anytime in the node inspector.
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
                  onClick={handleAddToCanvas}
                  className="px-3.5 py-1.5 rounded-[5px] bg-[#E58B62] hover:bg-[#F0A17B] text-[#0B0B0A] font-sans font-medium text-[12px] transition-colors cursor-pointer"
                >
                  Add to canvas
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
