"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Search,
  ChevronRight,
  ArrowLeft,
  Server,
  Layers,
  Database,
  Cpu,
  Layout,
  Box,
  Plus,
} from "lucide-react";

export interface DeployPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOption: (optionId: string, customData?: Record<string, unknown>) => void;
}

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

// Authentic PostgreSQL Elephant Icon
export function PostgresIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.968 2C6.46 2 2 6.46 2 11.968c0 4.407 2.856 8.146 6.819 9.47.5.092.683-.217.683-.482 0-.237-.009-.868-.014-1.703-2.773.602-3.358-1.337-3.358-1.337-.454-1.152-1.108-1.46-1.108-1.46-.905-.618.069-.606.069-.606 1 .07 1.526 1.028 1.526 1.028.89 1.524 2.334 1.084 2.902.829.09-.644.348-1.084.633-1.334-2.214-.251-4.542-1.107-4.542-4.928 0-1.088.389-1.979 1.026-2.676-.103-.252-.445-1.266.098-2.639 0 0 .837-.268 2.742 1.022A9.55 9.55 0 0112 6.837c.85.004 1.705.115 2.504.337 1.905-1.29 2.74-1.022 2.74-1.022.545 1.373.203 2.387.1 2.639.639.697 1.026 1.588 1.026 2.676 0 3.83-2.332 4.673-4.553 4.92.358.308.677.917.677 1.848 0 1.334-.012 2.41-.012 2.738 0 .267.18.578.686.48 3.96-1.326 6.814-5.063 6.814-9.468C22 6.46 17.476 2 11.968 2z" opacity={0} />
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.14 2.53 7.69 6.12 9.17-.08-.7-.12-1.52-.12-2.17 0-1.8.44-3.5 1.25-4.99-.44-.22-.9-.4-1.38-.52-1.33-.33-2.18-1.52-2.18-2.89 0-1.54 1.15-2.83 2.67-2.98.65-.07 1.31.06 1.9.36.42-.51.93-.94 1.51-1.26C11.95 6.07 12 5.37 12 5c0-.6.18-1.18.52-1.68C12.18 3.1 12.09 3 12 3zm6.86 7.64c-.2-.04-.4-.06-.6-.06-1.05 0-2.02.48-2.66 1.29-.62-.31-1.31-.47-2.01-.47-2.48 0-4.5 2.02-4.5 4.5 0 .61.12 1.2.35 1.74-1.11 1.53-1.74 3.39-1.74 5.36 0 .47.04.93.1 1.38 1.25.76 2.72 1.2 4.29 1.2 4.65 0 8.44-3.56 8.87-8.1-.63.26-1.32.4-2.05.4-.55 0-1.07-.08-1.56-.24.58-.87.91-1.9.91-3 0-1.71-.82-3.23-2.1-4.2.43-.5.98-.9 1.6-1.14-.3-.39-.62-.73-.9-.66z" />
    </svg>
  );
}

// Authentic Redis Cube Icon
export function RedisIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.5 7.5L12 2l9.5 5.5v9L12 22l-9.5-5.5v-9zm10.5 12.18l7.5-4.34V8.66l-7.5 4.34v6.68zm-2-6.68L3.5 8.66v6.68l7.5 4.34v-6.68zm8.5-5.5l-7.5-4.34-7.5 4.34 7.5 4.34 7.5-4.34z" />
    </svg>
  );
}

interface DeployItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  hasSubmenu?: boolean;
}

const DEPLOY_SERVICES: DeployItem[] = [
  {
    id: "github",
    title: "Deploy from GitHub Repo",
    description: "Connect GitHub repository or monorepo branch",
    icon: GitHubIcon,
    iconColor: "text-[#FAF8F5]",
    hasSubmenu: true,
  },
  {
    id: "database",
    title: "Deploy PostgreSQL",
    description: "PostgreSQL 16 relational database cluster",
    icon: PostgresIcon,
    iconColor: "text-[#86CDDE]",
  },
  {
    id: "database_mysql",
    title: "Deploy MySQL",
    description: "MySQL 8.4 relational database engine",
    icon: Database,
    iconColor: "text-[#E08A58]",
  },
  {
    id: "application",
    title: "Deploy Web Application",
    description: "Next.js, Go API, Node.js, or frontend service",
    icon: Layout,
    iconColor: "text-[#93DDA7]",
  },
  {
    id: "docker",
    title: "Deploy Docker Image",
    description: "Containerized image from Docker Hub or GHCR",
    icon: Box,
    iconColor: "text-[#60A5FA]",
  },
];

const SAMPLE_GITHUB_REPOS = [
  { name: "summit / backend", branch: "main", desc: "Go 1.23 REST Engine & WebSocket Server" },
  { name: "summit / web", branch: "main", desc: "Next.js 16 App Router & Interactive Canvas" },
  { name: "summit / api-gateway", branch: "main", desc: "Reverse Proxy & Edge Rate Limiting" },
  { name: "summit / worker-queue", branch: "main", desc: "Temporal & Redis Stream Queue Worker" },
  { name: "deepanshu / meridian", branch: "main", desc: "Cloud deployment template" },
];

export function DeployPaletteModal({
  isOpen,
  onClose,
  onSelectOption,
}: DeployPaletteProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentView, setCurrentView] = useState<"menu" | "github">("menu");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setCurrentView("menu");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter items
  const filteredServices = DEPLOY_SERVICES.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRepos = SAMPLE_GITHUB_REPOS.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (currentView === "github") {
          setCurrentView("menu");
          setSearchQuery("");
        } else {
          onClose();
        }
        return;
      }

      const listLength =
        currentView === "menu" ? filteredServices.length : filteredRepos.length;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, listLength));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + listLength) % Math.max(1, listLength));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (currentView === "menu") {
          const selected = filteredServices[selectedIndex];
          if (!selected) return;
          if (selected.hasSubmenu) {
            setCurrentView("github");
            setSearchQuery("");
            setSelectedIndex(0);
          } else if (selected.id === "database_mysql") {
            onSelectOption("database", {
              label: "mysql-db",
              subType: "MySQL",
              databaseEngine: "mysql",
              port: 3306,
            });
            onClose();
          } else {
            onSelectOption(selected.id);
            onClose();
          }
        } else {
          const selected = filteredRepos[selectedIndex];
          if (selected) {
            onSelectOption("github", {
              label: selected.name.split("/").pop()?.trim() || "repo",
              repoUrl: `https://github.com/${selected.name.replace(/\s+/g, "")}`,
              branch: selected.branch,
            });
            onClose();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentView, filteredServices, filteredRepos, selectedIndex, onClose, onSelectOption]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-[4px] animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[490px] bg-[#121113] border border-[#26242A] rounded-[16px] shadow-[0_24px_64px_rgba(0,0,0,0.85)] p-6 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-7 h-7 rounded-[7px] flex items-center justify-center text-[#8E8C86] hover:text-[#FAF8F5] hover:bg-[#1E1C21] transition-colors cursor-pointer"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon & Title (Exact Railway frame 34 / 05 layout) */}
        <div className="flex flex-col items-center text-center mt-1">
          {currentView === "menu" ? (
            <div className="w-10 h-10 rounded-[10px] bg-[#1F1A28] border border-[#3A2D4A] flex items-center justify-center text-[#CCA7E8] mb-3 shadow-[0_0_20px_rgba(204,167,232,0.15)]">
              {/* 4-squares Grid Icon */}
              <div className="grid grid-cols-2 gap-1 w-4 h-4">
                <span className="w-1.5 h-1.5 rounded-sm bg-[#CCA7E8]" />
                <span className="w-1.5 h-1.5 rounded-sm bg-[#CCA7E8]" />
                <span className="w-1.5 h-1.5 rounded-sm bg-[#CCA7E8]" />
                <span className="w-1.5 h-1.5 rounded-sm bg-accent-orange" />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCurrentView("menu");
                setSearchQuery("");
              }}
              className="flex items-center gap-1.5 text-[12px] text-[#8E8C86] hover:text-[#FAF8F5] mb-2 self-start transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to services
            </button>
          )}

          <h2 className="font-sans text-[21px] font-semibold text-[#FAF8F5] tracking-[-0.025em]">
            {currentView === "menu" ? "New Service" : "Deploy GitHub Repo"}
          </h2>
          <p className="font-sans text-[13px] text-[#8E8C86] mt-1 tracking-normal">
            {currentView === "menu"
              ? "Deploy your app to production effortlessly"
              : "Select a repository to deploy"}
          </p>
        </div>

        {/* Search Input: 'What are we going to deploy today?' */}
        <div className="relative mt-5">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A7873]">
            <Search className="w-4 h-4" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="What are we going to deploy today?"
            className="w-full h-11 pl-10 pr-4 bg-[#18171B] border border-[#2B2930] focus:border-accent-orange rounded-[10px] text-[13.5px] text-[#FAF8F5] placeholder:text-[#6C6A66] outline-none transition-colors"
          />
        </div>

        {/* Options List */}
        <div className="mt-3.5 max-h-[290px] overflow-y-auto no-scrollbar space-y-1">
          {currentView === "menu" ? (
            filteredServices.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.hasSubmenu) {
                      setCurrentView("github");
                      setSearchQuery("");
                      setSelectedIndex(0);
                    } else if (item.id === "database_mysql") {
                      onSelectOption("database", {
                        label: "mysql-db",
                        subType: "MySQL",
                        databaseEngine: "mysql",
                        port: 3306,
                      });
                      onClose();
                    } else {
                      onSelectOption(item.id);
                      onClose();
                    }
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-[9px] cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-[#201D26] border border-[#383345]"
                      : "hover:bg-[#18161D] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-[7px] bg-[#18161D] border border-[#27252E] flex items-center justify-center shrink-0">
                      <Icon className={`w-4 h-4 ${item.iconColor}`} />
                    </div>
                    <div className="min-w-0 text-left">
                      <h4 className="font-sans text-[13.5px] font-medium text-[#FAF8F5] truncate leading-tight">
                        {item.title}
                      </h4>
                      <p className="font-sans text-[11.5px] text-[#8E8C86] truncate mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  {item.hasSubmenu ? (
                    <ChevronRight className="w-4 h-4 text-[#7A7873] shrink-0 ml-2" />
                  ) : (
                    <Plus className="w-4 h-4 text-[#7A7873] group-hover:text-accent-orange shrink-0 ml-2" />
                  )}
                </div>
              );
            })
          ) : (
            filteredRepos.map((repo, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={repo.name}
                  onClick={() => {
                    onSelectOption("github", {
                      label: repo.name.split("/").pop()?.trim() || "repo",
                      repoUrl: `https://github.com/${repo.name.replace(/\s+/g, "")}`,
                      branch: repo.branch,
                    });
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-[9px] cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-[#201D26] border border-[#383345]"
                      : "hover:bg-[#18161D] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-[7px] bg-[#18161D] border border-[#27252E] flex items-center justify-center shrink-0">
                      <GitHubIcon className="w-4 h-4 text-[#FAF8F5]" />
                    </div>
                    <div className="min-w-0 text-left">
                      <h4 className="font-mono text-[13px] font-medium text-[#FAF8F5] truncate leading-tight">
                        {repo.name}
                      </h4>
                      <p className="font-sans text-[11.5px] text-[#8E8C86] truncate mt-0.5">
                        {repo.desc}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10.5px] font-mono text-[#8E8C86] bg-[#1A191E] border border-[#2A2832] px-2 py-0.5 rounded shrink-0 ml-2">
                    {repo.branch}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer tip */}
        <div className="mt-4 pt-3 border-t border-[#222026] flex items-center justify-between text-[11px] font-mono text-[#7A7873]">
          <span>Navigate with ↑ ↓ · Press Enter to deploy</span>
          <span>Esc to exit</span>
        </div>
      </div>
    </div>
  );
}

