"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  GitBranch,
  ArrowUpRight,
  ExternalLink,
  Edit2,
  Copy,
  Trash2,
  Check,
} from "lucide-react";
import type { DashboardProject } from "@/lib/dashboard/types";

interface ProjectCardProps {
  project: DashboardProject;
  onRename: (project: DashboardProject) => void;
  onDuplicate: (project: DashboardProject) => void;
  onDelete: (project: DashboardProject) => void;
  onToast: (msg: string) => void;
  index: number;
}

export function ProjectCard({
  project,
  onRename,
  onDuplicate,
  onDelete,
  onToast,
  index,
}: ProjectCardProps) {
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

  const handleCardClick = (e: React.MouseEvent) => {
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
    onToast(`Project ID copied`);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative bg-[#111110] hover:bg-[#141413] border border-[#1E1E1C] hover:border-[#2C2C29] rounded-[8px] p-4 flex flex-col justify-between transition-all duration-150 cursor-pointer shadow-sm focus-visible:outline-2 focus-visible:outline-[#E58B62]"
      style={{
        animation: "fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        animationDelay: `${Math.min(index * 35, 200)}ms`,
      }}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          router.push(`/dashboard/project/${project.id}`);
        }
      }}
    >
      <div>
        {/* Top Header: Name + Status Dot + Overflow Menu */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-sans text-[14.5px] font-medium text-[#FAF8F5] group-hover:text-white transition-colors truncate">
                {project.name}
              </h3>
            </div>
            {/* Repo Owner and Branch */}
            <div className="flex items-center gap-1.5 text-[11.5px] font-mono text-[#75736D] mt-0.5 truncate">
              <span className="truncate max-w-[140px]">{project.owner}</span>
              <span className="text-[#3E3D39]">·</span>
              <GitBranch className="w-3 h-3 text-[#5A5954] shrink-0" />
              <span className="truncate">{project.branch}</span>
            </div>
          </div>

          {/* Right Status Dot & Menu */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#8E8C86] px-1.5 py-0.5 rounded">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  project.status === "building"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-emerald-400"
                }`}
              />
              <span className="capitalize text-[#75736D]">
                {project.status === "building" ? "building" : "active"}
              </span>
            </span>

            {/* Overflow Menu Button */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(!isMenuOpen);
                }}
                className="w-6 h-6 rounded-[4px] flex items-center justify-center text-[#5A5954] hover:text-[#FAF8F5] hover:bg-[#1A1918] transition-colors cursor-pointer"
                title="Options"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-[#141413] border border-[#242422] rounded-[7px] shadow-[0_12px_28px_rgba(0,0,0,0.85)] p-1 z-50 text-[12px] font-sans animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      router.push(`/dashboard/project/${project.id}`);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[4px] text-[#FAF8F5] hover:bg-[#1C1C1A] transition-colors text-left cursor-pointer"
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
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[4px] text-[#FAF8F5] hover:bg-[#1C1C1A] transition-colors text-left cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[#8E8C86]" />
                    <span>Rename</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onDuplicate(project);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[4px] text-[#FAF8F5] hover:bg-[#1C1C1A] transition-colors text-left cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#8E8C86]" />
                    <span>Duplicate</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[4px] text-[#FAF8F5] hover:bg-[#1C1C1A] transition-colors text-left cursor-pointer"
                  >
                    {hasCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-[#8E8C86]" />
                    )}
                    <span>Copy ID</span>
                  </button>

                  <div className="h-px bg-[#20201E] my-1" />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onDelete(project);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[4px] text-[#D77D7D] hover:bg-[#201515] transition-colors text-left cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Short description */}
        <p className="text-[12.5px] text-[#8E8C86] line-clamp-2 mt-2.5 font-sans leading-relaxed">
          {project.description}
        </p>
      </div>

      {/* Bottom Metadata & Arrow indicator */}
      <div className="mt-4 pt-3 border-t border-[#181817] flex items-center justify-between text-[11px] font-mono text-[#5A5954]">
        <div className="flex items-center gap-2">
          <span className="text-[#666560]">{project.region}</span>
          <span className="text-[#3E3D39]">·</span>
          <span>{project.updatedAt}</span>
        </div>

        <div className="flex items-center gap-1 text-[#666560] group-hover:text-[#E58B62] transition-colors">
          <span>Open</span>
          <ArrowUpRight className="w-3 h-3 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </div>
  );
}
