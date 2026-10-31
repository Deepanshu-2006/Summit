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
      exit={
        shouldReduceMotion
          ? undefined
          : {
              opacity: 0,
              y: -14,
              transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
            }
      }
      transition={{ duration: 0.35 }}
      className="relative w-full flex-1 flex flex-col items-center justify-center text-center px-4 select-none pb-20 sm:pb-28"
    >
      {/* Foreground Minimal Typography */}
      <motion.div
        exit={
          shouldReduceMotion
            ? undefined
            : {
                opacity: 0,
                y: -18,
                scale: 0.96,
                transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
              }
        }
        className="relative z-10 w-full max-w-[480px] flex flex-col items-center text-center px-4"
      >
        {/* Heading */}
        <motion.h2
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={
            shouldReduceMotion
              ? undefined
              : {
                  opacity: 0,
                  y: -14,
                  transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
                }
          }
          transition={{ duration: 0.28, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="font-sans text-[24px] sm:text-[28px] font-semibold text-[#FAF8F5] tracking-[-0.025em] leading-[1.2] drop-shadow-[0_2px_16px_rgba(0,0,0,1)]"
        >
          Your next project starts here
        </motion.h2>

        {/* Description */}
        <motion.p
          initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={
            shouldReduceMotion
              ? undefined
              : {
                  opacity: 0,
                  y: -10,
                  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
                }
          }
          transition={{ duration: 0.28, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="text-[14px] sm:text-[14.5px] text-[#B0ADA6] leading-relaxed mt-2.5 mb-7 max-w-[400px] font-sans drop-shadow-[0_1px_8px_rgba(0,0,0,0.95)]"
        >
          Organize your web services, APIs, and databases into a clean visual infrastructure canvas.
        </motion.p>

        {/* Action Controls */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={
            shouldReduceMotion
              ? undefined
              : {
                  opacity: 0,
                  scale: 0.92,
                  y: -8,
                  transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
                }
          }
          transition={{ duration: 0.25, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-3.5"
        >
          <button
            type="button"
            onClick={onCreateProject}
            className="inline-flex items-center justify-center gap-2 h-9 px-4.5 rounded-[6px] bg-[#E58B62] hover:bg-[#F29C75] text-[#0C0B0A] font-sans font-medium text-[13px] transition-all cursor-pointer shadow-[0_4px_24px_rgba(229,139,98,0.35)] active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New project</span>
          </button>

          <Link
            href="/dashboard/project/new"
            onClick={(e) => {
              e.preventDefault();
              onCreateProject();
            }}
            className="inline-flex items-center gap-1.5 text-[12px] font-mono text-[#8E8C86] hover:text-[#FAF8F5] transition-colors group drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]"
          >
            <span>Explore canvas template</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
