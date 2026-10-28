"use client";

import React, { useRef, useSyncExternalStore } from "react";
import { useScroll } from "motion/react";
import { StoryVisualization } from "./story-visualization";
import { HeroScene } from "./hero-scene";
import { DeploymentScene } from "./deployment-scene";
import { StoryProgress } from "./story-progress";

// React 19 SSR-safe subscription for prefers-reduced-motion
function subscribeReducedMotion(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

/**
 * StoryShell: The Scroll-Driven Orchestration Frame
 * Coordinates the continuous narrative between Hero (Scene 0) and Deployment (Scene 1).
 * Uses a pinned viewport track on desktop where scroll position progressively draws
 * the infrastructure connection from Source to Build without scroll hijacking or page jumps.
 */
export function StoryShell() {
  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const containerRef = useRef<HTMLDivElement>(null);

  // Link scroll progress strictly to this narrative track
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Reduced motion: Render clean static layout
  if (isReducedMotion) {
    return (
      <div className="w-full bg-bg-main py-12 space-y-16">
        <div className="layout-container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5">
              <HeroScene scrollYProgress={scrollYProgress} isReducedMotion={true} />
            </div>
            <div className="lg:col-span-7">
              <StoryVisualization scrollYProgress={scrollYProgress} isReducedMotion={true} />
            </div>
          </div>
        </div>
        <div className="layout-container border-t border-border-subtle/60 pt-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6">
              <DeploymentScene scrollYProgress={scrollYProgress} isReducedMotion={true} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-bg-main text-text-primary"
    >
      {/* =================================================================
          DESKTOP: Continuous Sticky Scroll Canvas (lg and above)
          Scroll range: 200vh (approx 2 screens) for the first transition.
          ================================================================= */}
      <div className="hidden lg:block relative h-[210vh]">
        {/* Sticky Viewport Frame - pinned below 72px navbar */}
        <div className="sticky top-[72px] h-[calc(100vh-72px)] w-full flex flex-col justify-center overflow-hidden">
          
          <div className="layout-container w-full">
            {/* Top Pipeline Milestone Tracker */}
            <div className="w-full flex items-center justify-between pb-4 border-b border-border-subtle/50 mb-6">
              <StoryProgress scrollYProgress={scrollYProgress} isReducedMotion={false} />
              <div className="font-mono text-[10px] text-text-muted tracking-widest uppercase">
                SCROLL-DRIVEN PIPELINE // V1.0
              </div>
            </div>

            {/* Two-Column Story Grid: Left Narrative + Right Persistent Diagram */}
            <div className="grid grid-cols-12 gap-10 xl:gap-14 items-center">
              
              {/* Left Column: Cross-fading Narrative Scenes */}
              <div className="col-span-5 relative min-h-[460px] flex items-center">
                {/* Scene 0: Hero Narrative */}
                <div className="absolute inset-0 flex flex-col justify-center">
                  <HeroScene scrollYProgress={scrollYProgress} isReducedMotion={false} />
                </div>

                {/* Scene 1: Deployment Narrative */}
                <div className="absolute inset-0 flex flex-col justify-center">
                  <DeploymentScene scrollYProgress={scrollYProgress} isReducedMotion={false} />
                </div>
              </div>

              {/* Right Column: Persistent Shared Infrastructure Visualization */}
              <div className="col-span-7 flex items-center justify-center">
                <StoryVisualization scrollYProgress={scrollYProgress} isReducedMotion={false} />
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* =================================================================
          MOBILE / TABLET: Natural Responsive Flow (< lg)
          Guarantees frictionless touch scrolling without sticky viewport locks
          ================================================================= */}
      <div className="lg:hidden w-full py-8 space-y-12">
        <div className="layout-container space-y-8">
          <HeroScene scrollYProgress={scrollYProgress} isReducedMotion={true} />
          
          <div className="py-4">
            <StoryVisualization scrollYProgress={scrollYProgress} isReducedMotion={true} />
          </div>

          <div className="pt-8 border-t border-border-subtle/60">
            <DeploymentScene scrollYProgress={scrollYProgress} isReducedMotion={true} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default StoryShell;
