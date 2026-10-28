"use client";

import React from "react";
import { motion, MotionValue, useTransform } from "motion/react";

interface DeploymentSceneProps {
  scrollYProgress: MotionValue<number>;
  isReducedMotion?: boolean;
}

/**
 * DeploymentScene: Narrative Scene 1 (Beginning of Deployment Experience)
 * Smoothly enters the left story column as the Source-to-Build connection draws.
 * Focuses on the "Ship without the ceremony" narrative and architectural principles.
 */
export function DeploymentScene({ scrollYProgress, isReducedMotion }: DeploymentSceneProps) {
  // Motion values for scroll-driven entry
  const opacity = useTransform(scrollYProgress, [0.28, 0.46], [0, 1]);
  const y = useTransform(scrollYProgress, [0.28, 0.46], [32, 0]);
  const pointerEvents = useTransform(scrollYProgress, (v) => (v > 0.30 ? "auto" : "none"));

  return (
    <motion.div
      style={{
        opacity: isReducedMotion ? 1 : opacity,
        y: isReducedMotion ? 0 : y,
        pointerEvents: isReducedMotion ? "auto" : pointerEvents,
      }}
      className="w-full flex flex-col justify-center"
      aria-label="Scene 1: Deployment Journey"
    >
      {/* Technical Eyebrow */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1.5 h-1.5 rounded-[1px] bg-accent-orange" aria-hidden="true" />
        <p className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-muted">
          FROM COMMIT TO PRODUCTION
        </p>
      </div>

      {/* Section Heading */}
      <h2 className="font-sans text-[36px] sm:text-[44px] lg:text-[50px] font-medium leading-[1.08] tracking-[-0.03em] text-[#F1F0EC] mb-5">
        Ship without the ceremony.
      </h2>

      {/* Supporting Copy */}
      <p className="font-sans text-[15.5px] sm:text-[16px] text-[#A6AAA9] leading-[1.6] max-w-[460px] mb-8">
        Connect your code, build your application, and bring it online through a deployment workflow designed to stay out of your way.
      </p>

      {/* Architectural Principles Breakdown */}
      <div className="space-y-4 pt-6 border-t border-border-subtle/80 max-w-[460px]">
        {/* Step 1 */}
        <div className="flex items-start gap-3.5">
          <div className="w-6 h-6 rounded-[5px] bg-[#191C1F] border border-border-subtle flex items-center justify-center shrink-0 mt-0.5">
            <span className="font-mono text-[10px] text-accent-orange font-medium">01</span>
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[#F1F0EC] font-sans">
              Zero-friction connection
            </h3>
            <p className="text-[12.5px] text-text-muted leading-relaxed mt-0.5">
              Automatic Git push detection on any provider. No YAML bureaucracy or complex pipelines.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex items-start gap-3.5">
          <div className="w-6 h-6 rounded-[5px] bg-[#191C1F] border border-accent-orange/40 flex items-center justify-center shrink-0 mt-0.5">
            <span className="font-mono text-[10px] text-accent-orange font-medium">02</span>
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[#F1F0EC] font-sans">
              Hermetic edge builds
            </h3>
            <p className="text-[12.5px] text-text-muted leading-relaxed mt-0.5">
              Turbopack dependency caching and isolated sandboxes compile bundles in fractions of a second.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex items-start gap-3.5">
          <div className="w-6 h-6 rounded-[5px] bg-[#191C1F] border border-border-subtle flex items-center justify-center shrink-0 mt-0.5">
            <span className="font-mono text-[10px] text-text-muted font-medium">03</span>
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[#F1F0EC] font-sans">
              Atomic global cutover
            </h3>
            <p className="text-[12.5px] text-text-muted leading-relaxed mt-0.5">
              Instant zero-downtime routing across 35+ edge regions with single-click automated rollbacks.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default DeploymentScene;
