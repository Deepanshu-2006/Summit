"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, RefreshCw } from "lucide-react";
import { BRAND } from "@/lib/brand";

type StageId = "source" | "build" | "production";

interface StageInfo {
  id: StageId;
  label: string;
  stepNum: string;
  description: string;
}

const STAGES: StageInfo[] = [
  {
    id: "source",
    label: "Source",
    stepNum: "01",
    description: "Connect your repository and prepare your application.",
  },
  {
    id: "build",
    label: "Build",
    stepNum: "02",
    description: "Compile your application and prepare it for release.",
  },
  {
    id: "production",
    label: "Production",
    stepNum: "03",
    description: "Inspect your running service and its deployment status.",
  },
];

// React 19 compliant external store subscription for prefers-reduced-motion
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

export function Hero() {
  const [selectedStage, setSelectedStage] = useState<StageId | null>(null);
  const [sequenceStep, setSequenceStep] = useState<number>(0); // 0: source, 1: build, 2: deploy, 3: completed/hold
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const [isInView, setIsInView] = useState(true);

  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  // Intersection observer to pause animation when outside viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.15 }
    );
    if (heroRef.current) {
      observer.observe(heroRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // 6-second deployment cycle timer with a calm 4-second hold
  useEffect(() => {
    if (isReducedMotion || isUserInteracting || !isInView) {
      return;
    }

    const timeouts: NodeJS.Timeout[] = [];

    // Step 1: Build engine compiling (1.6s)
    timeouts.push(
      setTimeout(() => {
        setSequenceStep(1);
      }, 1600)
    );

    // Step 2: Deploying across to Production (3.6s)
    timeouts.push(
      setTimeout(() => {
        setSequenceStep(2);
      }, 3600)
    );

    // Step 3: Production live & hold state (5.0s)
    timeouts.push(
      setTimeout(() => {
        setSequenceStep(3);
      }, 5000)
    );

    // Total loop duration: 9.5s (5.0s animation + 4.5s quiet hold)
    const interval = setInterval(() => {
      setSequenceStep(0);
      timeouts.push(
        setTimeout(() => {
          setSequenceStep(1);
        }, 1600)
      );
      timeouts.push(
        setTimeout(() => {
          setSequenceStep(2);
        }, 3600)
      );
      timeouts.push(
        setTimeout(() => {
          setSequenceStep(3);
        }, 5000)
      );
    }, 9500);

    return () => {
      clearInterval(interval);
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [isReducedMotion, isUserInteracting, isInView]);

  // Handle stage selection
  const handleStageSelect = (stageId: StageId) => {
    setIsUserInteracting(true);
    setSelectedStage(stageId);
    if (stageId === "source") setSequenceStep(0);
    if (stageId === "build") setSequenceStep(1);
    if (stageId === "production") setSequenceStep(3);

    // Resume auto-cycle after 9 seconds of inactivity
    const resumeTimer = setTimeout(() => {
      setIsUserInteracting(false);
      setSelectedStage(null);
    }, 9000);
    return () => clearTimeout(resumeTimer);
  };

  // Determine active visual stage for diagram emphasis
  const activeStage: StageId =
    selectedStage ??
    (sequenceStep === 0
      ? "source"
      : sequenceStep === 1
      ? "build"
      : "production");

  return (
    <section
      ref={heroRef}
      className="relative w-full min-h-[640px] xl:min-h-[700px] flex items-center justify-center pt-8 pb-16 lg:py-20 overflow-hidden"
      aria-label="Deployment Runway Hero"
    >
      <div className="layout-container w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* =================================================================
              LEFT COLUMN: Typography & Value Proposition (approx 45%)
              ================================================================= */}
          <div className="lg:col-span-5 flex flex-col justify-center z-10">
            
            {/* Technical Eyebrow */}
            <div className="flex items-center gap-2 mb-5">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-accent-orange" aria-hidden="true" />
              <p className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-muted">
                BUILT FOR THE WAY YOU SHIP
              </p>
            </div>

            {/* Main Headline */}
            <h1 className="font-sans text-[48px] sm:text-[62px] lg:text-[68px] xl:text-[76px] font-medium leading-[1.04] tracking-[-0.035em] text-text-primary mb-6">
              Your code. <br />
              In <span className="text-accent-orange">motion</span>.
            </h1>

            {/* Supporting Copy */}
            <p className="font-sans text-[16px] sm:text-[17px] text-text-secondary leading-[1.6] max-w-[460px] mb-8">
              From your first deploy to production infrastructure, everything moves forward.
            </p>

            {/* Primary & Secondary Actions */}
            <div className="flex flex-wrap items-center gap-4 mb-10">
              <Link
                href={BRAND.links.signup}
                className="inline-flex items-center justify-center h-[42px] px-5 rounded-[7px] bg-accent-orange hover:bg-accent-orange-hover text-bg-main text-[13.5px] font-semibold transition-colors duration-[160ms] focus-visible:outline-2 focus-visible:outline-accent-orange focus-visible:outline-offset-2 shadow-sm"
              >
                Start building
              </Link>

              <Link
                href="/product"
                className="inline-flex items-center justify-center h-[42px] px-5 rounded-[7px] bg-transparent border border-border-default hover:border-text-secondary text-text-primary text-[13.5px] font-medium transition-colors duration-[160ms] focus-visible:outline-2 focus-visible:outline-accent-orange"
              >
                Explore the platform
              </Link>
            </div>

            {/* Interactive Stage Controls & Explanatory Caption */}
            <div className="pt-6 border-t border-border-subtle/80 max-w-[480px]">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10.5px] text-text-muted tracking-wider uppercase">
                  Deployment Runway
                </span>
                {isUserInteracting && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserInteracting(false);
                      setSelectedStage(null);
                    }}
                    className="font-mono text-[10.5px] text-accent-orange hover:underline inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    resume sequence
                  </button>
                )}
              </div>

              {/* Stage Selection Buttons */}
              <div
                role="tablist"
                aria-label="Deployment stages"
                className="grid grid-cols-3 gap-2 mb-3.5"
              >
                {STAGES.map((stage) => {
                  const isSelected = activeStage === stage.id;
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => handleStageSelect(stage.id)}
                      className={`h-[34px] px-2.5 rounded-[6px] border text-[12px] font-mono transition-all duration-[160ms] flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-accent-orange ${
                        isSelected
                          ? "bg-surface-card border-accent-orange/70 text-text-primary shadow-sm"
                          : "bg-transparent border-border-subtle/60 text-text-muted hover:text-text-secondary hover:border-border-default"
                      }`}
                    >
                      <span className={`w-1 h-1 rounded-full ${isSelected ? "bg-accent-orange" : "bg-text-muted/40"}`} />
                      <span>{stage.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Explanatory Caption */}
              <p className="text-[12.5px] text-text-secondary leading-relaxed min-h-[38px] transition-opacity duration-[180ms]">
                {STAGES.find((s) => s.id === activeStage)?.description}
              </p>

              {/* Technical deployment-flow metadata tag */}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border-subtle/40 text-[11px] font-mono text-text-muted">
                <span className="text-accent-orange">◆</span>
                <span>git push origin main → automated edge deploy</span>
              </div>
            </div>

          </div>

          {/* =================================================================
              RIGHT COLUMN: The Deployment Runway Visualization (approx 55%)
              ================================================================= */}
          <div className="lg:col-span-7 relative w-full flex items-center justify-center">
            
            {/* Ambient System Grid Background (Restrained) */}
            <div className="w-full relative aspect-[580/460] max-w-[580px]">
              
              {/* Connecting Vector Lines SVG Layer */}
              <svg
                viewBox="0 0 580 460"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute inset-0 w-full h-full pointer-events-none select-none"
                aria-hidden="true"
              >
                {/* Architectural Grid Crosshairs */}
                <g stroke="#292E31" strokeWidth="1" strokeDasharray="3 3" opacity="0.6">
                  <path d="M 20 20 H 560" />
                  <path d="M 20 440 H 560" />
                  <path d="M 20 20 V 440" />
                  <path d="M 560 20 V 440" />
                </g>

                {/* Neutral Base Connection Path: Source -> Build */}
                <path
                  d="M 240 100 C 310 100, 240 180, 290 190"
                  stroke="#292E31"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />

                {/* Active Animated Path: Source -> Build */}
                <path
                  d="M 240 100 C 310 100, 240 180, 290 190"
                  stroke={sequenceStep >= 1 || activeStage === "build" ? "#D88762" : "transparent"}
                  strokeWidth="2"
                  strokeDasharray={sequenceStep >= 1 ? "none" : "6 6"}
                  className="transition-all duration-500"
                />

                {/* Neutral Base Connection Path: Build -> Production */}
                <path
                  d="M 430 250 C 500 260, 390 320, 380 340"
                  stroke="#292E31"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />

                {/* Active Animated Path: Build -> Production */}
                <path
                  d="M 430 250 C 500 260, 390 320, 380 340"
                  stroke={sequenceStep >= 2 || activeStage === "production" ? (sequenceStep >= 3 ? "#83B69A" : "#D88762") : "transparent"}
                  strokeWidth="2"
                  strokeDasharray={sequenceStep >= 3 ? "none" : "6 6"}
                  className="transition-all duration-500"
                />

                {/* Intermediate Pipeline Junction Anchor 1 */}
                <g transform="translate(265, 145)">
                  <circle r="4" fill="#121416" stroke={sequenceStep >= 1 ? "#D88762" : "#343A3D"} strokeWidth="1.5" />
                  <text x="8" y="3" fill="#777D7D" fontSize="9" fontFamily="var(--font-geist-mono)" letterSpacing="0.05em">
                    tar.zst
                  </text>
                </g>

                {/* Intermediate Pipeline Junction Anchor 2 */}
                <g transform="translate(445, 295)">
                  <circle r="4" fill="#121416" stroke={sequenceStep >= 3 ? "#83B69A" : sequenceStep >= 2 ? "#D88762" : "#343A3D"} strokeWidth="1.5" />
                  <text x="8" y="3" fill="#777D7D" fontSize="9" fontFamily="var(--font-geist-mono)" letterSpacing="0.05em">
                    img:sha256
                  </text>
                </g>
              </svg>

              {/* -------------------------------------------------------------
                  STAGE A: SOURCE NODE (Top-Left)
                  ------------------------------------------------------------- */}
              <div
                onClick={() => handleStageSelect("source")}
                className={`absolute top-[28px] left-[16px] sm:left-[24px] w-[220px] sm:w-[230px] rounded-[9px] bg-[#191C1F] border p-3.5 transition-all duration-300 cursor-pointer shadow-lg ${
                  activeStage === "source"
                    ? "border-accent-orange/80 shadow-accent-orange/5 translate-y-[-2px]"
                    : "border-border-subtle hover:border-border-default"
                }`}
                role="button"
                tabIndex={0}
                aria-label="Inspect Source Node"
                onKeyDown={(e) => e.key === "Enter" && handleStageSelect("source")}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-border-subtle/50">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted font-medium">
                      SOURCE
                    </span>
                  </div>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-[4px] bg-[#202427] border border-border-subtle text-text-secondary">
                    main
                  </span>
                </div>

                {/* Node Body: Commit & Diff Details */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-text-primary font-medium">commit 8f3a21c</span>
                    <span className="text-semantic-success text-[10px]">+142 -18</span>
                  </div>
                  <p className="text-[11px] text-text-muted truncate font-mono">
                    feat(routing): edge cluster v2
                  </p>
                </div>

                {/* Source status indicator */}
                <div className="mt-2.5 pt-2 border-t border-border-subtle/40 flex items-center justify-between font-mono text-[10px] text-text-muted">
                  <span>origin/main</span>
                  <span className="text-accent-orange">READY</span>
                </div>
              </div>

              {/* -------------------------------------------------------------
                  STAGE B: BUILD ENGINE NODE (Center)
                  ------------------------------------------------------------- */}
              <div
                onClick={() => handleStageSelect("build")}
                className={`absolute top-[150px] left-[170px] sm:left-[200px] w-[240px] sm:w-[250px] rounded-[9px] bg-[#191C1F] border p-3.5 transition-all duration-300 cursor-pointer shadow-xl ${
                  activeStage === "build"
                    ? "border-accent-orange/90 shadow-accent-orange/10 translate-y-[-2px]"
                    : "border-border-subtle hover:border-border-default"
                }`}
                role="button"
                tabIndex={0}
                aria-label="Inspect Build Engine Node"
                onKeyDown={(e) => e.key === "Enter" && handleStageSelect("build")}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-border-subtle/50">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        sequenceStep >= 1 ? "bg-accent-orange animate-pulse" : "bg-text-muted"
                      }`}
                    />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted font-medium">
                      BUILD ENGINE
                    </span>
                  </div>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-[4px] bg-[#202427] border border-border-subtle text-text-secondary">
                    turbopack
                  </span>
                </div>

                {/* Simulated Build Steps */}
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted text-[10px]">01</span>
                    <span className={sequenceStep >= 1 ? "text-text-primary" : "text-text-muted"}>
                      pnpm install --frozen
                    </span>
                    {sequenceStep >= 1 && <Check className="w-3 h-3 text-semantic-success ml-auto" />}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-text-muted text-[10px]">02</span>
                    <span
                      className={
                        sequenceStep === 1
                          ? "text-accent-orange font-medium"
                          : sequenceStep > 1
                          ? "text-text-primary"
                          : "text-text-muted"
                      }
                    >
                      {sequenceStep === 1 ? "compiling bundle..." : "next build (142ms)"}
                    </span>
                    {sequenceStep >= 2 && <Check className="w-3 h-3 text-semantic-success ml-auto" />}
                  </div>

                  {/* Progress bar line */}
                  <div className="w-full h-1 bg-[#202427] rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full bg-accent-orange transition-all duration-700 ${
                        sequenceStep === 0
                          ? "w-[15%]"
                          : sequenceStep === 1
                          ? "w-[65%]"
                          : "w-full bg-semantic-success"
                      }`}
                    />
                  </div>
                </div>

                {/* Build status label */}
                <div className="mt-2.5 pt-2 border-t border-border-subtle/40 flex items-center justify-between font-mono text-[10px]">
                  <span className="text-text-muted">status</span>
                  <span
                    className={
                      sequenceStep >= 2
                        ? "text-semantic-success font-medium"
                        : "text-accent-orange font-medium"
                    }
                  >
                    {sequenceStep >= 2 ? "BUILD SUCCESSFUL" : "PROCESSING"}
                  </span>
                </div>
              </div>

              {/* -------------------------------------------------------------
                  STAGE C: PRODUCTION NODE (Bottom-Right)
                  ------------------------------------------------------------- */}
              <div
                onClick={() => handleStageSelect("production")}
                className={`absolute top-[280px] left-[260px] sm:left-[290px] w-[240px] sm:w-[255px] rounded-[9px] bg-[#191C1F] border p-3.5 transition-all duration-300 cursor-pointer shadow-xl ${
                  activeStage === "production"
                    ? "border-semantic-success/80 shadow-semantic-success/5 translate-y-[-2px]"
                    : "border-border-subtle hover:border-border-default"
                }`}
                role="button"
                tabIndex={0}
                aria-label="Inspect Production Node"
                onKeyDown={(e) => e.key === "Enter" && handleStageSelect("production")}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-border-subtle/50">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        sequenceStep >= 3
                          ? "bg-semantic-success animate-pulse"
                          : "bg-text-muted/60"
                      }`}
                    />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted font-medium">
                      PRODUCTION
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded-[4px] border font-medium ${
                      sequenceStep >= 3
                        ? "bg-semantic-success/15 border-semantic-success/30 text-semantic-success"
                        : "bg-[#202427] border-border-subtle text-text-muted"
                    }`}
                  >
                    {sequenceStep >= 3 ? "RUNNING" : "DEPLOYING"}
                  </span>
                </div>

                {/* Production Body: Service details */}
                <div className="space-y-1 font-mono text-[11px]">
                  <div className="text-[#F1F0EC] font-medium truncate flex items-center justify-between">
                    <span>app.jetway.demo</span>
                    <span className="text-[10px] text-text-muted">https</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-text-muted">
                    <span>cluster: iad1-edge</span>
                    <span className="text-semantic-success">18ms</span>
                  </div>
                </div>

                {/* Health & Deployment confirmation */}
                <div className="mt-2.5 pt-2 border-t border-border-subtle/40 flex items-center justify-between font-mono text-[10px] text-text-muted">
                  <span>health: 100%</span>
                  <span className="text-text-primary">SSL active</span>
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>
    </section>
  );
}

export default Hero;
