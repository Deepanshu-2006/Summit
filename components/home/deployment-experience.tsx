"use client";

import React, { useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, ExternalLink, Terminal, GitBranch, ShieldCheck } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";

// React 19 SSR-safe subscriber for prefers-reduced-motion
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

interface WorkflowStep {
  id: string;
  label: string;
  detail: string;
  duration: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "connect",
    label: "Repository connected",
    detail: "github.com/jetway/app @ main",
    duration: "120ms",
  },
  {
    id: "install",
    label: "Dependencies installed",
    detail: "142 packages via pnpm-lock",
    duration: "380ms",
  },
  {
    id: "compile",
    label: "Application compiled",
    detail: "4 static, 1 edge route generated",
    duration: "410ms",
  },
  {
    id: "artifacts",
    label: "Build artifacts prepared",
    detail: "manifest dist/12.4 MB ready",
    duration: "190ms",
  },
  {
    id: "deploy",
    label: "Deployment completed",
    detail: "atomic cutover in 35 regions",
    duration: "84ms",
  },
];

/**
 * DeploymentExperience: Natural Scroll-Driven Section
 * - Remains in normal document flow (no sticky viewport locks, no scroll hijacking).
 * - All animations respond reversibly to local scroll progress.
 * - Connects visually to the hero via a shared infrastructure conduit.
 */
export function DeploymentExperience() {
  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const sectionRef = useRef<HTMLElement>(null);

  // Local scroll progress calculated per-element as this section moves through the viewport
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "center 40%"],
  });

  // Reversible, scroll-linked motion values
  const conduitProgress = useTransform(scrollYProgress, [0.0, 0.2], ["0%", "100%"]);

  // Left column reveals
  const eyebrowOpacity = useTransform(scrollYProgress, [0.06, 0.22], [0, 1]);
  const headingOpacity = useTransform(scrollYProgress, [0.1, 0.28], [0, 1]);
  const headingY = useTransform(scrollYProgress, [0.1, 0.28], [18, 0]);
  const copyOpacity = useTransform(scrollYProgress, [0.16, 0.34], [0, 1]);
  const pillar1Opacity = useTransform(scrollYProgress, [0.22, 0.42], [0, 1]);
  const pillar2Opacity = useTransform(scrollYProgress, [0.32, 0.52], [0, 1]);
  const pillar3Opacity = useTransform(scrollYProgress, [0.42, 0.62], [0, 1]);

  // Right column terminal panel
  const panelOpacity = useTransform(scrollYProgress, [0.12, 0.32], [0, 1]);
  const panelY = useTransform(scrollYProgress, [0.12, 0.32], [24, 0]);
  const progressBarWidth = useTransform(scrollYProgress, [0.22, 0.82], ["10%", "100%"]);

  // Terminal commands and logs
  const cmdOpacity = useTransform(scrollYProgress, [0.18, 0.28], [0, 1]);
  const pushMetaOpacity = useTransform(scrollYProgress, [0.24, 0.34], [0, 1]);

  // Step-by-step progressive pipeline reveals
  const step1Opacity = useTransform(scrollYProgress, [0.30, 0.40], [0.25, 1]);
  const step2Opacity = useTransform(scrollYProgress, [0.40, 0.50], [0.25, 1]);
  const step3Opacity = useTransform(scrollYProgress, [0.50, 0.60], [0.25, 1]);
  const step4Opacity = useTransform(scrollYProgress, [0.60, 0.70], [0.25, 1]);
  const step5Opacity = useTransform(scrollYProgress, [0.70, 0.80], [0.25, 1]);

  // Final production preview card
  const previewOpacity = useTransform(scrollYProgress, [0.78, 0.92], [0, 1]);
  const previewY = useTransform(scrollYProgress, [0.78, 0.92], [10, 0]);

  // State badge live flag
  const isComplete = useTransform(scrollYProgress, (v) => v >= 0.80);

  return (
    <section
      ref={sectionRef}
      id="deployment-experience"
      className="relative w-full py-16 sm:py-20 lg:py-24 bg-bg-main text-text-primary overflow-hidden"
      aria-labelledby="deployment-heading"
    >
      <div className="layout-container w-full">
        
        {/* =================================================================
            SECTION TRANSITION: Visual continuity connector from hero
            Shared infrastructure line extending into this section
            ================================================================= */}
        <div className="w-full flex items-center justify-between border-t border-border-subtle/70 pt-6 mb-12 sm:mb-16">
          <div className="flex items-center gap-3 font-mono text-[11px] text-text-muted tracking-wider">
            <span className="text-accent-orange font-medium">02</span>
            <div className="w-12 h-[1px] bg-border-subtle relative overflow-hidden" aria-hidden="true">
              <motion.div
                style={{ width: isReducedMotion ? "100%" : conduitProgress }}
                className="h-full bg-accent-orange"
              />
            </div>
            <span>DEPLOYMENT PIPELINE</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 font-mono text-[10.5px] text-text-muted">
            <span>ZERO CONFIGURATION</span>
            <span className="text-border-default">•</span>
            <span>GLOBAL EDGE RUNWAY</span>
          </div>
        </div>

        {/* =================================================================
            ASYMMETRICAL SECTION LAYOUT: Text Column (5 cols) + Panel (7 cols)
            Normal document flow; user scrolls through naturally
            ================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          
          {/* -------------------------------------------------------------
              LEFT COLUMN: Editorial Heading, Copy, Architectural Notes
              ------------------------------------------------------------- */}
          <div className="lg:col-span-5 flex flex-col justify-start">
            
            {/* Technical Eyebrow */}
            <motion.div
              style={{ opacity: isReducedMotion ? 1 : eyebrowOpacity }}
              className="flex items-center gap-2 mb-4"
            >
              <span className="w-1.5 h-1.5 rounded-[1px] bg-accent-orange" aria-hidden="true" />
              <span className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-muted">
                FROM COMMIT TO PRODUCTION
              </span>
            </motion.div>

            {/* Section Heading */}
            <motion.h2
              id="deployment-heading"
              style={{
                opacity: isReducedMotion ? 1 : headingOpacity,
                y: isReducedMotion ? 0 : headingY,
              }}
              className="font-sans text-[34px] sm:text-[42px] lg:text-[48px] font-medium leading-[1.08] tracking-[-0.03em] text-[#F1F0EC] mb-5"
            >
              Ship without the ceremony.
            </motion.h2>

            {/* Supporting Copy */}
            <motion.p
              style={{ opacity: isReducedMotion ? 1 : copyOpacity }}
              className="font-sans text-[15.5px] sm:text-[16px] text-text-secondary leading-[1.6] max-w-[460px] mb-8"
            >
              Connect your code, build your application, and bring it online through a deployment workflow designed to stay out of your way.
            </motion.p>

            {/* Architectural Highlights */}
            <div className="space-y-4 pt-6 border-t border-border-subtle/80 max-w-[460px]">
              
              {/* Feature 1 */}
              <motion.div
                style={{ opacity: isReducedMotion ? 1 : pillar1Opacity }}
                className="flex items-start gap-3.5"
              >
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
              </motion.div>

              {/* Feature 2 */}
              <motion.div
                style={{ opacity: isReducedMotion ? 1 : pillar2Opacity }}
                className="flex items-start gap-3.5"
              >
                <div className="w-6 h-6 rounded-[5px] bg-[#191C1F] border border-accent-orange/40 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="font-mono text-[10px] text-accent-orange font-medium">02</span>
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-[#F1F0EC] font-sans">
                    Hermetic edge builds
                  </h3>
                  <p className="text-[12.5px] text-text-muted leading-relaxed mt-0.5">
                    Turbopack caching and isolated sandboxes compile bundles in fractions of a second.
                  </p>
                </div>
              </motion.div>

              {/* Feature 3 */}
              <motion.div
                style={{ opacity: isReducedMotion ? 1 : pillar3Opacity }}
                className="flex items-start gap-3.5"
              >
                <div className="w-6 h-6 rounded-[5px] bg-[#191C1F] border border-border-subtle flex items-center justify-center shrink-0 mt-0.5">
                  <span className="font-mono text-[10px] text-accent-orange font-medium">03</span>
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-[#F1F0EC] font-sans">
                    Atomic global cutover
                  </h3>
                  <p className="text-[12.5px] text-text-muted leading-relaxed mt-0.5">
                    Instant zero-downtime traffic switching across 35+ edge regions with single-click rollbacks.
                  </p>
                </div>
              </motion.div>

            </div>

          </div>

          {/* -------------------------------------------------------------
              RIGHT COLUMN: Deployment Demonstration Interface (Terminal Panel)
              Reveals progressively as user scrolls through this section
              ------------------------------------------------------------- */}
          <div className="lg:col-span-7 w-full">
            <motion.div
              style={{
                opacity: isReducedMotion ? 1 : panelOpacity,
                y: isReducedMotion ? 0 : panelY,
              }}
              className="w-full rounded-[10px] bg-[#191C1F] border border-border-default shadow-2xl shadow-black/60 overflow-hidden"
            >
              
              {/* Panel Header */}
              <div className="px-4 py-3 bg-[#16181B] border-b border-border-subtle flex items-center justify-between gap-3">
                
                {/* Left: Service identifier & indicator */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#292E31]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#292E31]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#292E31]" />
                  </div>
                  
                  <div className="h-3 w-[1px] bg-border-subtle mx-1 hidden sm:block" />

                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-text-secondary truncate">
                    <Terminal className="w-3.5 h-3.5 text-accent-orange shrink-0" />
                    <span className="text-[#F1F0EC] font-medium truncate">jetway-app</span>
                    <span className="text-text-muted hidden sm:inline">/ service</span>
                  </div>
                </div>

                {/* Right: Branch label & Scroll-linked State badge */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 font-mono text-[11px]">
                  
                  {/* Branch label */}
                  <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#202427] border border-border-subtle text-text-secondary text-[10.5px]">
                    <GitBranch className="w-3 h-3 text-text-muted" />
                    <span>main</span>
                  </div>

                  {/* Scroll-Driven Deployment State Badge */}
                  <div
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border text-[10.5px] font-medium transition-colors duration-200 ${
                      isReducedMotion || isComplete.get()
                        ? "bg-semantic-success/15 border-semantic-success/30 text-semantic-success"
                        : "bg-accent-orange/15 border-accent-orange/30 text-accent-orange"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isReducedMotion || isComplete.get()
                          ? "bg-semantic-success"
                          : "bg-accent-orange animate-pulse"
                      }`}
                    />
                    <span>{isReducedMotion || isComplete.get() ? "LIVE" : "BUILDING"}</span>
                  </div>

                </div>

              </div>

              {/* Scroll-Linked Progress Bar (advances as you scroll) */}
              <div className="w-full h-[2px] bg-[#202427] overflow-hidden" role="progressbar" aria-label="Deployment scroll progress">
                <motion.div
                  style={{
                    width: isReducedMotion ? "100%" : progressBarWidth,
                  }}
                  className="h-full bg-accent-orange transition-colors duration-300"
                />
              </div>

              {/* Terminal Console Stream (Scroll-driven reveals) */}
              <div className="p-4 sm:p-5 font-mono text-[12px] sm:text-[12.5px] leading-relaxed space-y-3 bg-[#121416]/95 min-h-[300px]">
                
                {/* Prompt & Command */}
                <motion.div
                  style={{ opacity: isReducedMotion ? 1 : cmdOpacity }}
                  className="flex items-center gap-2 text-[#F1F0EC]"
                >
                  <span className="text-accent-orange font-semibold select-none">$</span>
                  <span className="font-medium">git push origin main</span>
                </motion.div>

                {/* Remote git sync metadata */}
                <motion.div
                  style={{ opacity: isReducedMotion ? 1 : pushMetaOpacity }}
                  className="text-[11px] text-text-muted pl-3.5 border-l border-border-subtle/60 py-0.5 space-y-0.5"
                >
                  <div>[remote] commit 8f3a21c received (2.4 KB)</div>
                  <div>[remote] ephemeral edge builder container initialized (iad1)</div>
                </motion.div>

                {/* Progressive Pipeline Step Events (Reversible with scroll) */}
                <div className="space-y-2 pt-2 border-t border-border-subtle/40">
                  {WORKFLOW_STEPS.map((step, idx) => {
                    const stepOpacity =
                      idx === 0
                        ? step1Opacity
                        : idx === 1
                        ? step2Opacity
                        : idx === 2
                        ? step3Opacity
                        : idx === 3
                        ? step4Opacity
                        : step5Opacity;

                    return (
                      <motion.div
                        key={step.id}
                        style={{ opacity: isReducedMotion ? 1 : stepOpacity }}
                        className="flex items-start sm:items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                          <span className="w-4 h-4 flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 text-semantic-success" />
                          </span>

                          <span className="text-[12px] sm:text-[12.5px] truncate text-[#F1F0EC] font-medium">
                            {step.label}
                          </span>
                        </div>

                        {/* Technical metadata / duration */}
                        <div className="flex items-center gap-2 shrink-0 text-[10.5px] sm:text-[11px] text-text-muted">
                          <span className="hidden md:inline">{step.detail}</span>
                          <span className="text-semantic-success font-medium">
                            {step.duration}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Production Preview Card (Reveals toward bottom of sequence) */}
                <motion.div
                  style={{
                    opacity: isReducedMotion ? 1 : previewOpacity,
                    y: isReducedMotion ? 0 : previewY,
                  }}
                  className="mt-4 pt-3.5 border-t border-border-subtle/60"
                >
                  <div className="rounded-[7px] bg-[#191C1F] border border-semantic-success/35 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-black/40">
                    
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-text-muted font-medium">
                        <ShieldCheck className="w-3 h-3 text-semantic-success" />
                        <span>PRODUCTION PREVIEW // SSL ACTIVE</span>
                      </div>
                      
                      <Link
                        href="https://app.jetway.demo"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[13px] sm:text-[13.5px] font-mono font-medium text-text-primary hover:text-accent-orange transition-colors"
                      >
                        <span>app.jetway.demo</span>
                        <ExternalLink className="w-3 h-3 text-text-muted" />
                      </Link>
                    </div>

                    {/* Edge Latency and Status Badge */}
                    <div className="flex items-center gap-2 self-start sm:self-center font-mono text-[10.5px]">
                      <span className="px-2 py-0.5 rounded-[4px] bg-[#202427] border border-border-subtle text-text-secondary">
                        14ms edge
                      </span>
                      <span className="px-2 py-0.5 rounded-[4px] bg-semantic-success/15 border border-semantic-success/30 text-semantic-success font-medium">
                        200 OK
                      </span>
                    </div>

                  </div>
                </motion.div>

              </div>

              {/* Terminal Footer Annotation */}
              <div className="px-4 py-2 bg-[#16181B] border-t border-border-subtle/80 flex items-center justify-between text-[10.5px] font-mono text-text-muted">
                <div className="flex items-center gap-1.5">
                  <span className="text-accent-orange">◆</span>
                  <span>edge-cluster: iad1-node-04</span>
                </div>
                <span className="hidden sm:inline">turbopack engine v2.4</span>
              </div>

            </motion.div>
          </div>

        </div>

      </div>
    </section>
  );
}

export default DeploymentExperience;
