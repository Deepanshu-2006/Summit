"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Search,
  ChevronRight,
  Plus,
} from "lucide-react";
import {
  PostgresLogo,
  MongoLogo,
  RedisLogo,
  MySQLLogo,
  DockerLogo,
  GitHubLogo,
  NextjsLogo,
  WorkerLogo,
} from "./database-logos";

export interface DeployPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOption: (optionId: string, customData?: Record<string, unknown>) => void;
}

interface DeployItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  hasSubmenu?: boolean;
  comingSoon?: boolean;
  /** Opens a chooser instead of creating a service immediately. */
  chooser?: "github" | "docker";
  actionPayload?: {
    optionId: string;
    customData?: Record<string, unknown>;
  };
}

const DEPLOY_SERVICES: DeployItem[] = [
  {
    id: "github",
    title: "Deploy from GitHub Repo",
    description: "Connect GitHub repository or monorepo branch",
    icon: GitHubLogo,
    hasSubmenu: true,
    chooser: "github",
  },
  {
    id: "postgres",
    title: "Deploy PostgreSQL",
    description: "PostgreSQL 16 relational database cluster",
    icon: PostgresLogo,
    actionPayload: {
      optionId: "database",
      customData: {
        label: "postgres-db",
        subType: "PostgreSQL",
        databaseEngine: "postgresql",
        port: 5432,
      },
    },
  },
  {
    id: "database_mysql",
    title: "Deploy MySQL",
    description: "MySQL is not available yet",
    icon: MySQLLogo,
    comingSoon: true,
  },
  {
    id: "database_mongodb",
    title: "Deploy MongoDB",
    description: "MongoDB is not available yet",
    icon: MongoLogo,
    comingSoon: true,
  },
  {
    id: "cache",
    title: "Deploy Redis Cache",
    description: "Redis 7.2 in-memory cache and key-value store",
    icon: RedisLogo,
    actionPayload: {
      optionId: "cache",
      customData: {
        label: "redis-cache",
        subType: "Redis",
        serviceType: "cache",
        databaseEngine: "redis",
        port: 6379,
      },
    },
  },
  {
    id: "application",
    title: "Deploy Web Application",
    description: "Next.js, Go API, Node.js, or frontend service",
    icon: NextjsLogo,
    hasSubmenu: true,
    chooser: "github",
  },
  {
    id: "docker",
    title: "Deploy Docker Image",
    description: "Containerized image from Docker Hub or GHCR",
    icon: DockerLogo,
    hasSubmenu: true,
    chooser: "docker",
  },
  {
    id: "worker",
    title: "Deploy Background Worker",
    description: "Asynchronous task, queue, or cron worker",
    icon: WorkerLogo,
    actionPayload: {
      optionId: "worker",
      customData: {
        label: "worker-service",
        subType: "Worker",
        serviceType: "worker",
      },
    },
  },
];

export function DeployPaletteModal({
  isOpen,
  onClose,
  onSelectOption,
}: DeployPaletteProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on open (the palette is mounted fresh each time it opens)
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Filter items
  const filteredServices = DEPLOY_SERVICES.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Execute selection
  const executeSelect = (item: DeployItem) => {
    if (item.comingSoon) return;
    if (item.chooser) {
      onSelectOption(item.chooser);
      onClose();
      return;
    }
    if (item.actionPayload) {
      onSelectOption(item.actionPayload.optionId, item.actionPayload.customData);
      onClose();
      return;
    }
    onSelectOption(item.id);
    onClose();
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      const listLength = filteredServices.length;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, listLength));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + listLength) % Math.max(1, listLength));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredServices[selectedIndex];
        if (selected) executeSelect(selected);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredServices, selectedIndex, onClose, onSelectOption]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-[2px] animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[490px] bg-[#111110] border border-[#222220] rounded-[12px] shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-5 overflow-hidden animate-in fade-in zoom-in-[0.98] duration-150"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deploy-palette-title"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#77756F] hover:text-[#F1F0ED] hover:bg-[#181817] p-1.5 rounded-[5px] transition-colors cursor-pointer shrink-0"
          title="Close (Esc)"
          aria-label="Close dialog"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex flex-col items-center text-center pt-1 pb-1">
          <div className="w-8 h-8 rounded-[7px] bg-[#181817] border border-[#262522] flex items-center justify-center text-[#E58B62] mb-2.5 shadow-inner">
            {/* 4-squares Grid Icon */}
            <div className="grid grid-cols-2 gap-1 w-3.5 h-3.5">
              <span className="w-1.5 h-1.5 rounded-sm bg-[#A09E98]" />
              <span className="w-1.5 h-1.5 rounded-sm bg-[#A09E98]" />
              <span className="w-1.5 h-1.5 rounded-sm bg-[#A09E98]" />
              <span className="w-1.5 h-1.5 rounded-sm bg-[#E58B62]" />
            </div>
          </div>

          <h2
            id="deploy-palette-title"
            className="font-sans text-[18px] font-semibold text-[#F1F0ED] tracking-[-0.02em] leading-tight"
          >
            New Service
          </h2>
          <p className="font-sans text-[12.5px] text-[#77756F] mt-1">
            Deploy your app to production effortlessly
          </p>
        </div>

        {/* ================= Ultra-Minimal GitHub-Style Search Bar ================= */}
        <div className="relative pt-2 pb-2 mt-2">
          <div className="flex items-center gap-2.5 py-1.5">
            <Search
              className={`w-3.5 h-3.5 transition-colors duration-200 shrink-0 ${
                isSearchFocused ? "text-[#E58B62]" : "text-[#77756F]"
              }`}
            />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="What are we going to deploy today?"
              className="w-full bg-transparent text-[13px] font-sans text-[#F1F0ED] placeholder:text-[#55534E] p-0 border-none !outline-none focus:!outline-none focus-visible:!outline-none focus:!ring-0 focus-visible:!ring-0 focus-visible:[outline:none!important] [outline:none!important] [box-shadow:none!important]"
              style={{ outline: "none", boxShadow: "none", border: "none" }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedIndex(0);
                  inputRef.current?.focus();
                }}
                className="text-[#77756F] hover:text-[#F1F0ED] p-0.5 transition-colors cursor-pointer"
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

        {/* ================= Options List with Natural Brand Logos ================= */}
        <div className="mt-2 max-h-[300px] overflow-y-auto no-scrollbar space-y-1">
          {filteredServices.length === 0 ? (
            <div className="py-8 text-center text-[12px] font-sans text-[#77756F]">
              No services matching &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            filteredServices.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  role="button"
                  aria-disabled={item.comingSoon || undefined}
                  onClick={() => executeSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[8px] transition-colors duration-150 group ${
                    item.comingSoon ? "cursor-not-allowed opacity-55" : "cursor-pointer"
                  } ${
                    isSelected && !item.comingSoon
                      ? "bg-[#181817] border border-[#2E2D2A]"
                      : "hover:bg-[#161615] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-[7px] bg-[#181817] border border-[#262522] flex items-center justify-center shrink-0 shadow-inner">
                      <Icon className="w-4 h-4 shrink-0" />
                    </div>
                    <div className="min-w-0 text-left">
                      <h4 className="font-sans text-[13px] font-medium text-[#F1F0ED] tracking-[-0.01em] truncate leading-tight">
                        {item.title}
                      </h4>
                      <p className="font-sans text-[11.5px] text-[#A09E98] truncate mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  {item.comingSoon ? (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#77756F] shrink-0 ml-2">
                      Soon
                    </span>
                  ) : item.hasSubmenu ? (
                    <ChevronRight className="w-4 h-4 text-[#77756F] group-hover:text-[#F1F0ED] shrink-0 ml-2 transition-colors" />
                  ) : (
                    <Plus className="w-4 h-4 text-[#77756F] group-hover:text-[#E58B62] shrink-0 ml-2 transition-colors" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer tip */}
        <div className="mt-3.5 pt-3 border-t border-[#1F1F1D] flex items-center justify-between text-[10.5px] font-mono text-[#77756F]">
          <span>Navigate with ↑ ↓ · Press Enter to deploy</span>
          <span>Esc to exit</span>
        </div>
      </div>
    </div>
  );
}
