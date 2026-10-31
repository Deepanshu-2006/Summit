"use client";

import React from "react";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";

interface EmptyStateProps {
  onCreateProject: () => void;
  onExploreCanvas?: () => void;
}

export function EmptyState({ onCreateProject }: EmptyStateProps) {
  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-20 px-4 select-none animate-in fade-in duration-300">
      <div className="w-full max-w-[380px] flex flex-col items-center text-center">
        {/* Minimal Mountain Ridge Node Art */}
        <div className="w-[180px] h-[90px] relative mb-5 flex items-center justify-center">
          <svg
            viewBox="0 0 180 90"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
            aria-hidden="true"
          >
            {/* Fine dashed mountain slope */}
            <path
              d="M20 75L65 40L90 20L115 40L160 75"
              stroke="#242422"
              strokeWidth="1.2"
              strokeDasharray="3 3"
            />

            {/* Glowing signal line */}
            <path
              d="M50 52L90 20L130 52"
              stroke="#E58B62"
              strokeWidth="1.2"
              strokeOpacity="0.5"
            />

            {/* Left Node */}
            <circle cx="50" cy="52" r="3" fill="#141413" stroke="#333330" strokeWidth="1.5" />

            {/* Center Summit Beacon Node */}
            <circle cx="90" cy="20" r="4.5" fill="#E58B62" className="animate-pulse" />
            <circle cx="90" cy="20" r="9" stroke="#E58B62" strokeWidth="1" strokeOpacity="0.25" />

            {/* Right Node */}
            <circle cx="130" cy="52" r="3" fill="#141413" stroke="#333330" strokeWidth="1.5" />
          </svg>
        </div>

        {/* Heading */}
        <h2 className="font-sans text-[16px] font-medium text-[#FAF8F5] tracking-tight">
          Your next project starts here
        </h2>

        {/* Description */}
        <p className="text-[13px] text-[#75736D] leading-relaxed mt-1 mb-5 max-w-[320px]">
          Organize your web services, APIs, and databases into a clean visual infrastructure canvas.
        </p>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={onCreateProject}
          className="inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-[6px] bg-[#E58B62] hover:bg-[#F29C75] text-[#0C0B0A] font-sans font-medium text-[12.5px] transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New project</span>
        </button>

        {/* Quiet Link */}
        <Link
          href="/dashboard/project/new"
          className="mt-4 inline-flex items-center gap-1 text-[11.5px] font-mono text-[#5A5954] hover:text-[#FAF8F5] transition-colors group"
        >
          <span>Explore canvas template</span>
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
