"use client";

import React from "react";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

interface EmptyStateProps {
  onCreateProject: () => void;
  onExploreCanvas?: () => void;
}

export function EmptyState({ onCreateProject }: EmptyStateProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full flex-1 flex flex-col items-center justify-center py-20 px-4 select-none"
    >
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
            <motion.path
              d="M20 75L65 40L90 20L115 40L160 75"
              stroke="#242422"
              strokeWidth="1.2"
              strokeDasharray="3 3"
              initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Glowing signal line */}
            <motion.path
              d="M50 52L90 20L130 52"
              stroke="#E58B62"
              strokeWidth="1.2"
              strokeOpacity="0.5"
              initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{ duration: 0.45, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Left Node */}
            <motion.circle
              cx="50"
              cy="52"
              r="3"
              fill="#141413"
              stroke="#333330"
              strokeWidth="1.5"
              initial={shouldReduceMotion ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25, delay: 0.25, type: "spring", stiffness: 350, damping: 20 }}
            />

            {/* Center Summit Beacon Node */}
            <motion.circle
              cx="90"
              cy="20"
              r="4.5"
              fill="#E58B62"
              className="animate-pulse"
              initial={shouldReduceMotion ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.35, type: "spring", stiffness: 300, damping: 18 }}
            />
            <circle cx="90" cy="20" r="9" stroke="#E58B62" strokeWidth="1" strokeOpacity="0.25" />

            {/* Right Node */}
            <motion.circle
              cx="130"
              cy="52"
              r="3"
              fill="#141413"
              stroke="#333330"
              strokeWidth="1.5"
              initial={shouldReduceMotion ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25, delay: 0.3, type: "spring", stiffness: 350, damping: 20 }}
            />
          </svg>
        </div>

        {/* Heading */}
        <motion.h2
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="font-sans text-[16px] font-medium text-[#FAF8F5] tracking-tight"
        >
          Your next project starts here
        </motion.h2>

        {/* Description */}
        <motion.p
          initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="text-[13px] text-[#75736D] leading-relaxed mt-1 mb-5 max-w-[320px]"
        >
          Organize your web services, APIs, and databases into a clean visual infrastructure canvas.
        </motion.p>

        {/* Primary Action Button */}
        <motion.button
          type="button"
          onClick={onCreateProject}
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.95, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.34, ease: [0.16, 1, 0.3, 1] }}
          whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
          className="inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-[6px] bg-[#E58B62] hover:bg-[#F29C75] text-[#0C0B0A] font-sans font-medium text-[12.5px] transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New project</span>
        </motion.button>

        {/* Quiet Link */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.4 }}
        >
          <Link
            href="/dashboard/project/new"
            className="mt-4 inline-flex items-center gap-1 text-[11.5px] font-mono text-[#5A5954] hover:text-[#FAF8F5] transition-colors group"
          >
            <span>Explore canvas template</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
