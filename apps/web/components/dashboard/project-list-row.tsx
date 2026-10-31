"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MoreVertical,
  Layout,
  Server,
  Database,
  Cpu,
  GitBranch,
  ExternalLink,
  Edit2,
  Copy,
  Trash2,
  Check,
} from "lucide-react";
import type { DashboardProject } from "@/lib/dashboard/types";

interface ProjectListRowProps {
  project: DashboardProject;
  onRename: (project: DashboardProject) => void;
  onDuplicate: (project: DashboardProject) => void;
  onDelete: (project: DashboardProject) => void;
  onToast: (msg: string) => void;
  index: number;
}

export function ProjectListRow({
  project,
  onRename,
  onDuplicate,
  onDelete,
  onToast,
  index,
}: ProjectListRowProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isMenuOpen]);

  const renderIcon = () => {
    switch (project.icon) {
      case "server":
        return <Server className="w-3.5 h-3.5 text-[#E58B62]" />;
      case "database":
        return <Database className="w-3.5 h-3.5 text-[#83B69A]" />;
      case "cpu":
        return <Cpu className="w-3.5 h-3.5 text-[#A0A09A]" />;
      case "git-branch":
        return <GitBranch className="w-3.5 h-3.5 text-[#D88762]" />;
      case "layout":
      default:
        return <Layout className="w-3.5 h-3.5 text-[#E58B62]" />;
    }
  };

  const getEnvBadge = () => {
    switch (project.environment) {
      case "production":
        return {
          dot: "bg-emerald-500",
          label: "Production",
          text: "text-emerald-400/90",
          border: "border-emerald-500/20 bg-emerald-500/5",
        };
      case "staging":
        return {
          dot: "bg-sky-500",
          label: "Staging",
          text: "text-sky-400/90",
          border: "border-sky-500/20 bg-sky-500/5",
        };
      case "development":
      default:
        return {
          dot: "bg-amber-500",
          label: "Development",
          text: "text-amber-400/90",
          border: "border-amber-500/20 bg-amber-500/5",
        };
    }
  };

  const env = getEnvBadge();

  const handleRowClick = (e: React.MouseEvent) => {
    if (menuRef.current && menuRef.current.contains(e.target as Node)) {
      return;
    }
    router.push(`/dashboard/project/${project.id}`);
  };

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(project.id);
    setHasCopied(true);
    setIsMenuOpen(false);
    onToast(`Project ID copied: ${project.id}`);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div
      onClick={handleRowClick}
      className="group flex items-center justify-between px-4 py-3 bg-[#141413] hover:bg-[#181817] border-b border-[#20201E] last:border-b-0 transition-colors cursor-pointer text-[13px]"
      style={{
        animation: "fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        animationDelay: `${Math.min(index * 30, 200)}ms`,
      }}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          router.push(`/dashboard/project/${project.id}`);
        }
      }}
    >
      {/* Col 1: Icon + Name + Description */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-4">
        <div className="w-7 h-7 rounded-[5px] bg-[#1A1918] border border-[#262624] flex items-center justify-center shrink-0">
          {renderIcon()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-sans font-medium text-[#FAF8F5] group-hover:text-white transition-colors truncate">
              {project.name}
            </span>
            <span className="text-[11px] font-mono text-[#75736D] hidden md:inline truncate">
              · {project.type}
            </span>
          </div>
          <p className="text-[12px] text-[#8E8C86] truncate max-w-md hidden sm:block">
            {project.description}
          </p>
        </div>
      </div>

      {/* Col 2: Environment */}
      <div className="w-28 shrink-0 hidden sm:block">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10.5px] font-mono border ${env.border} ${env.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${env.dot}`} />
          {env.label}
        </span>
      </div>

      {/* Col 3: Branch / Region */}
      <div className="w-32 shrink-0 hidden lg:flex items-center gap-1.5 text-[11.5px] font-mono text-[#8E8C86]">
        <GitBranch className="w-3 h-3 text-[#75736D]" />
        <span className="truncate">{project.branch}</span>
      </div>

      {/* Col 4: Last Updated */}
      <div className="w-24 shrink-0 text-right text-[11.5px] font-mono text-[#75736D] pr-3">
        {project.updatedAt}
      </div>

      {/* Col 5: Actions */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen(!isMenuOpen);
          }}
          className="w-7 h-7 rounded-[5px] flex items-center justify-center text-[#75736D] hover:text-[#FAF8F5] hover:bg-[#20201E] transition-colors cursor-pointer"
          title="Project options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 mt-1 w-48 bg-[#161615] border border-[#282826] rounded-[8px] shadow-[0_12px_32px_rgba(0,0,0,0.8)] p-1 z-50 text-[12.5px] font-sans animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
                router.push(`/dashboard/project/${project.id}`);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] text-[#FAF8F5] hover:bg-[#222220] transition-colors text-left cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#8E8C86]" />
              <span>Open canvas</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
                onRename(project);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] text-[#FAF8F5] hover:bg-[#222220] transition-colors text-left cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-[#8E8C86]" />
              <span>Rename project</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
                onDuplicate(project);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] text-[#FAF8F5] hover:bg-[#222220] transition-colors text-left cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-[#8E8C86]" />
              <span>Duplicate project</span>
            </button>

            <button
              type="button"
              onClick={handleCopyId}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] text-[#FAF8F5] hover:bg-[#222220] transition-colors text-left cursor-pointer"
            >
              {hasCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-[#8E8C86]" />
              )}
              <span>Copy project ID</span>
            </button>

            <div className="h-px bg-[#262624] my-1" />

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
                onDelete(project);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] text-[#D77D7D] hover:bg-[#251818] transition-colors text-left cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete project</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

