"use client";

import React from "react";
import { motion, MotionValue, useTransform } from "motion/react";

interface StoryProgressProps {
  scrollYProgress: MotionValue<number>;
  isReducedMotion?: boolean;
}

const MILESTONES = [
  { id: "source", label: "01 SOURCE", range: [0, 0.35] },
  { id: "build", label: "02 BUILD", range: [0.35, 0.75] },
  { id: "production", label: "03 PRODUCTION", range: [0.75, 1.0] },
];

/**
 * StoryProgress: Minimal, restrained milestone indicator
 * Reflects current position in the continuous deployment narrative
 */
export function StoryProgress({ scrollYProgress, isReducedMotion }: StoryProgressProps) {
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const activeSceneIndex = useTransform(scrollYProgress, (v) => {
    if (v < 0.35) return 0;
    if (v < 0.75) return 1;
    return 2;
  });

  if (isReducedMotion) {
    return null;
  }

  return (
    <div
      className="hidden xl:flex items-center gap-6 font-mono text-[10px] text-text-muted tracking-wider select-none py-2"
      aria-hidden="true"
    >
      <div className="flex items-center gap-4">
        {MILESTONES.map((m, idx) => {
          return (
            <span
              key={m.id}
              className={`transition-colors duration-200 ${
                activeSceneIndex.get() === idx
                  ? "text-accent-orange font-medium"
                  : "text-text-muted/60"
              }`}
            >
              {m.label}
            </span>
          );
        })}
      </div>

      {/* Progress Track */}
      <div className="w-24 h-[1.5px] bg-[#292E31] rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-accent-orange"
          style={{ width: progressWidth }}
        />
      </div>
    </div>
  );
}

export default StoryProgress;
