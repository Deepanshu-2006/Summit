"use client";

import React from "react";
import Link from "next/link";
import { Plus, Compass, ArrowRight } from "lucide-react";

interface EmptyStateProps {
  onCreateProject: () => void;
  onExploreCanvas?: () => void;
}

export function EmptyState({ onCreateProject, onExploreCanvas }: EmptyStateProps) {
  return (
    <div className="w-full flex items-center justify-center py-16 sm:py-24 px-4 select-none">
      <div className="w-full max-w-[440px] bg-[#141413] border border-[#242422] rounded-[12px] p-8 text-center shadow-[0_12px_40px_rgba(0,0,0,0.5)] flex flex-col items-center">
        {/* Restrained Architectural Line Illustration */}
        <div className="w-20 h-20 mb-5 relative flex items-center justify-center">
          <svg
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
            aria-hidden="true"
          >
            {/* Fine Grid Background */}
            <circle cx="20" cy="20" r="1.5" fill="#30302E" />
            <circle cx="40" cy="20" r="1.5" fill="#30302E" />
            <circle cx="60" cy="20" r="1.5" fill="#30302E" />
            <circle cx="20" cy="40" r="1.5" fill="#30302E" />
            <circle cx="40" cy="40" r="1.5" fill="#30302E" />
            <circle cx="60" cy="40" r="1.5" fill="#30302E" />
            <circle cx="20" cy="60" r="1.5" fill="#30302E" />
            <circle cx="40" cy="60" r="1.5" fill="#30302E" />
            <circle cx="60" cy="60" r="1.5" fill="#30302E" />

            {/* Connection Lines */}
            <path
              d="M24 28L40 40M40 40L56 52M40 40L56 28"
              stroke="#2E2E2A"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />

            {/* Left Source Node */}
            <rect
              x="14"
              y="20"
              width="16"
              height="16"
              rx="4"
              fill="#1C1C1A"
              stroke="#383834"
              strokeWidth="1"
            />
            <path
              d="M19 28H25M22 25V31"
              stroke="#8E8C86"
              strokeWidth="1.2"
              strokeLinecap="round"
            />

            {/* Center Router / Gateway Node (Summit Accent) */}
            <rect
              x="32"
              y="32"
              width="16"
              height="16"
              rx="4"
              fill="#221C18"
              stroke="#E58B62"
              strokeWidth="1.2"
            />
            <circle cx="40" cy="40" r="2.5" fill="#E58B62" />

            {/* Right Destination Compute Node */}
            <rect
              x="50"
              y="20"
              width="16"
              height="16"
              rx="4"
              fill="#1C1C1A"
              stroke="#383834"
              strokeWidth="1"
            />
            <rect
              x="54"
              y="25"
              width="8"
              height="6"
              rx="1.5"
              stroke="#8E8C86"
              strokeWidth="1"
            />

            {/* Bottom Database Node */}
            <rect
              x="50"
              y="44"
              width="16"
              height="16"
              rx="4"
              fill="#1C1C1A"
              stroke="#383834"
              strokeWidth="1"
            />
            <ellipse
              cx="58"
              cy="50"
              rx="4"
              ry="2"
              stroke="#83B69A"
              strokeWidth="1"
            />
            <path
              d="M54 50V54C54 55.1 55.8 56 58 56C60.2 56 62 55.1 62 54V50"
              stroke="#83B69A"
              strokeWidth="1"
            />
          </svg>
        </div>

        {/* Title */}
        <h3 className="font-sans text-[17px] font-semibold text-[#FAF8F5] tracking-[-0.015em]">
          Your next project starts here
        </h3>

        {/* Description */}
        <p className="text-[13px] text-[#8E8C86] leading-relaxed mt-2 mb-6 max-w-[340px]">
          Projects organize your applications, services, and databases inside Summit’s visual infrastructure canvas.
        </p>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={onCreateProject}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[6px] bg-[#E58B62] hover:bg-[#F29C75] text-[#0C0B0A] font-sans font-semibold text-[13px] transition-all duration-150 shadow-sm active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create your first project</span>
        </button>

        {/* Quiet Secondary Action */}
        <div className="mt-4">
          <Link
            href="/dashboard/project/new"
            className="inline-flex items-center gap-1.5 text-[12px] font-mono text-[#75736D] hover:text-[#FAF8F5] transition-colors py-1 group"
          >
            <Compass className="w-3.5 h-3.5 text-[#75736D] group-hover:text-[#E58B62] transition-colors" />
            <span>Explore the canvas</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}

