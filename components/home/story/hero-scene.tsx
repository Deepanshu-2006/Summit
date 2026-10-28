"use client";

import React from "react";
import Link from "next/link";
import { motion, MotionValue, useTransform } from "motion/react";
import { BRAND } from "@/lib/brand";

interface HeroSceneProps {
  scrollYProgress: MotionValue<number>;
  isReducedMotion?: boolean;
}

const STAGES = [
  { id: "source", label: "Source" },
  { id: "build", label: "Build" },
  { id: "production", label: "Production" },
];

/**
 * HeroScene: Narrative Scene 0 (Hero Presentation)
 * Sits in the left story column at the start of the user's scroll journey.
 * Fades out smoothly as the user scrolls into the deployment transition.
 */
export function HeroScene({ scrollYProgress, isReducedMotion }: HeroSceneProps) {
  // Transform motion values for scroll exit
  const opacity = useTransform(scrollYProgress, [0.12, 0.32], [1, 0]);
  const y = useTransform(scrollYProgress, [0.12, 0.32], [0, -32]);
  const pointerEvents = useTransform(scrollYProgress, (v) => (v > 0.28 ? "none" : "auto"));

  return (
    <motion.div
      style={{
        opacity: isReducedMotion ? 1 : opacity,
        y: isReducedMotion ? 0 : y,
        pointerEvents: isReducedMotion ? "auto" : pointerEvents,
      }}
      className="w-full flex flex-col justify-center"
      aria-label="Scene 0: Deployment Runway Hero"
    >
      {/* Technical Eyebrow */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1.5 h-1.5 rounded-[1px] bg-accent-orange" aria-hidden="true" />
        <p className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-muted">
          BUILT FOR THE WAY YOU SHIP
        </p>
      </div>

      {/* Main Headline */}
      <h1 className="font-sans text-[44px] sm:text-[54px] lg:text-[62px] xl:text-[70px] font-medium leading-[1.04] tracking-[-0.035em] text-[#F1F0EC] mb-5">
        Your code. <br />
        In <span className="text-accent-orange">motion</span>.
      </h1>

      {/* Supporting Copy */}
      <p className="font-sans text-[15.5px] sm:text-[16px] text-[#A6AAA9] leading-[1.6] max-w-[440px] mb-7">
        From your first deploy to production infrastructure, everything moves forward.
      </p>

      {/* Primary & Secondary Actions */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <Link
          href={BRAND.links.signup}
          className="inline-flex items-center justify-center h-[40px] px-5 rounded-[7px] bg-[#D88762] hover:bg-[#E39A76] text-[#121416] text-[13.5px] font-semibold transition-colors duration-[160ms] focus-visible:outline-2 focus-visible:outline-accent-orange focus-visible:outline-offset-2"
        >
          Start building
        </Link>

        <Link
          href="/product"
          className="inline-flex items-center justify-center h-[40px] px-5 rounded-[7px] bg-transparent border border-[#343A3D] hover:border-[#777D7D] text-[#F1F0EC] text-[13.5px] font-medium transition-colors duration-[160ms] focus-visible:outline-2 focus-visible:outline-accent-orange"
        >
          Explore the platform
        </Link>
      </div>

      {/* Integrated Stage Overview */}
      <div className="pt-5 border-t border-border-subtle/80 max-w-[460px]">
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-mono text-[10.5px] text-text-muted tracking-wider uppercase">
            DEPLOYMENT SEQUENCE // 01 SOURCE
          </span>
          <span className="font-mono text-[10px] text-accent-orange">SCROLL TO ADVANCE ↓</span>
        </div>

        {/* Stage Pills */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {STAGES.map((stage, idx) => {
            const isSelected = idx === 0;
            return (
              <div
                key={stage.id}
                className={`h-[32px] px-2 rounded-[6px] border text-[11.5px] font-mono flex items-center justify-center gap-1.5 ${
                  isSelected
                    ? "bg-[#202427] border-accent-orange/80 text-[#F1F0EC] shadow-sm"
                    : "bg-transparent border-border-subtle/60 text-text-muted"
                }`}
              >
                <span
                  className={`w-1 h-1 rounded-full ${
                    isSelected ? "bg-accent-orange" : "bg-text-muted/40"
                  }`}
                />
                <span>{stage.label}</span>
              </div>
            );
          })}
        </div>

        {/* Technical deployment annotation */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border-subtle/40 text-[11px] font-mono text-text-muted">
          <span className="text-accent-orange">◆</span>
          <span>git push origin main → automated edge deploy (0.84s)</span>
        </div>
      </div>
    </motion.div>
  );
}

export default HeroScene;
