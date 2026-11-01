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
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import type { DashboardProject } from "@/lib/dashboard/types";

const STATUS_DOT: Record<DashboardProject["status"], string> = {
  running: "bg-emerald-400",
  building: "bg-amber-400 animate-pulse",
  failed: "bg-[#D77D7D]",
  stopped: "bg-[#5A5954]",
  idle: "bg-[#3E3D39]",
};

interface ProjectCardProps {
  project: DashboardProject;
  onRename: (project: DashboardProject) => void;
  onDelete: (project: DashboardProject) => void;
  onToast: (msg: string) => void;
  index: number;
}

export function ProjectCard({
  project,
  onRename,
  onDelete,
  onToast,
  index,
}: ProjectCardProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
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
    <motion.div
      onClick={handleCardClick}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.28,
        delay: shouldReduceMotion ? 0 : Math.min(index * 0.045, 0.25),
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={shouldReduceMotion ? undefined : { y: -2, transition: { duration: 0.15 } }}
      className={`group relative bg-[#111110] hover:bg-[#141413] border border-[#1E1E1C] hover:border-[#2C2C29] rounded-[8px] p-4 min-h-[150px] flex flex-col justify-between transition-colors duration-150 cursor-pointer shadow-sm focus-visible:outline-2 focus-visible:outline-[#E58B62] ${
        isMenuOpen ? "z-30" : "z-0 hover:z-10"
      }`}
      style={{
        zIndex: isMenuOpen ? 30 : undefined,
      }}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          router.push(`/dashboard/project/${project.id}`);
        }
      }}
    >
      <div>
        {/* Row 1: Project Name (Left) + Status & Overflow Menu (Right) */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-sans text-[14px] font-medium text-[#FAF8F5] group-hover:text-white transition-colors truncate">
            {project.name}
          </h3>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#8E8C86] px-1 py-0.5 rounded">
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[project.status]}`} />
              <span className="capitalize text-[#75736D]">{project.statusLabel}</span>
            </span>

            {/* Overflow Menu Button */}
            <div className={`relative ${isMenuOpen ? "z-50" : ""}`} ref={menuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(!isMenuOpen);
                }}
                className="w-5 h-5 rounded-[4px] flex items-center justify-center text-[#5A5954] hover:text-[#FAF8F5] hover:bg-[#1A1918] transition-colors cursor-pointer"
                title="Options"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>

              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -2, scale: 0.96 }}
                    transition={{ duration: 0.12, ease: "easeOut" }}
                    className="absolute right-0 mt-1 w-44 bg-[#141413] border border-[#242422] rounded-[7px] shadow-[0_16px_36px_rgba(0,0,0,0.95)] p-1 z-50 text-[12px] font-sans"
                  >
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Row 2: Repository Name and Branch */}
        <div className="flex items-center gap-1.5 text-[11.5px] font-mono text-[#75736D] mt-1.5 truncate">
          <span className="truncate">{project.repository ?? "No repository connected"}</span>
          {project.branch && (
            <>
              <span className="text-[#3E3D39]">·</span>
              <GitBranch className="w-3 h-3 text-[#5A5954] shrink-0" />
              <span className="truncate">{project.branch}</span>
            </>
          )}
        </div>

        {/* Row 3: Latest deployment */}
        <p className="text-[12px] text-[#8E8C86] truncate mt-2 font-sans leading-relaxed">
          {project.commitSha || project.lastDeployedLabel ? (
            <>
              {project.commitSha && <span className="font-mono text-[#75736D]">{project.commitSha}</span>}
              {project.commitSha && project.lastDeployedLabel && " · "}
              {project.lastDeployedLabel && `deployed ${project.lastDeployedLabel}`}
            </>
          ) : (
            "No deployments yet"
          )}
        </p>
      </div>

      {/* Bottom Row: Region & Relative Time (Left) + Open Action (Right) */}
      <div className="mt-3.5 pt-2.5 border-t border-[#181817] flex items-center justify-between text-[11px] font-mono text-[#5A5954]">
        <div className="flex items-center gap-1.5">
          <span className="text-[#666560]">
            {project.servicesCount} {project.servicesCount === 1 ? "service" : "services"}
          </span>
          <span className="text-[#3E3D39]">·</span>
          <span>updated {project.updatedLabel}</span>
        </div>

        <div className="flex items-center gap-1 text-[#666560] group-hover:text-[#E58B62] transition-colors">
          <span>Open</span>
          <ArrowUpRight className="w-3 h-3 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </motion.div>
  );
}
