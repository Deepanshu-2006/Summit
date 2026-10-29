"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, RefreshCw } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { HeroMountainIllustration } from "@/components/home/hero-mountain-illustration";

type StageId = "source" | "build" | "production";
type AnimPhase = "source" | "packet1" | "building" | "packet2" | "production";

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

// SSR-safe subscription for prefers-reduced-motion
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
  const [animPhase, setAnimPhase] = useState<AnimPhase>("source");
  const [buildStep, setBuildStep] = useState<number>(0); // 0: idle, 1: installing, 2: compiling, 3: ready
  const [loopKey, setLoopKey] = useState<number>(0);
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

  // Coordinated deployment sequence animation (8.5s total: 4.5s active sequence + 4.0s hold)
  useEffect(() => {
    if (isReducedMotion || isUserInteracting || !isInView) {
      return;
    }

    const timeouts: NodeJS.Timeout[] = [];

    // T=0.7s: Packet 1 travels from Source to Build along Path 1
    timeouts.push(
      setTimeout(() => {
        setAnimPhase("packet1");
      }, 700)
    );

    // T=1.6s: Packet 1 arrives; Build Engine activates and begins compilation
    timeouts.push(
      setTimeout(() => {
        setAnimPhase("building");
        setBuildStep(1); // pnpm install
      }, 1600)
    );

    // T=2.4s: Build compilation step
    timeouts.push(
      setTimeout(() => {
        setBuildStep(2); // turbo build
      }, 2400)
    );

    // T=3.2s: Build successful
    timeouts.push(
      setTimeout(() => {
        setBuildStep(3); // ready
      }, 3200)
    );

    // T=3.6s: Packet 2 travels from Build to Production along Path 2
    timeouts.push(
      setTimeout(() => {
        setAnimPhase("packet2");
      }, 3600)
    );

    // T=4.5s: Packet 2 arrives; Production goes RUNNING (calm hold for 4 seconds)
    timeouts.push(
      setTimeout(() => {
        setAnimPhase("production");
      }, 4500)
    );

    // Total loop interval: 8.5s, then quietly cycle
    const interval = setInterval(() => {
      setLoopKey((k) => k + 1);
      setAnimPhase("source");
      setBuildStep(0);

      timeouts.push(
        setTimeout(() => {
          setAnimPhase("packet1");
        }, 700)
      );
      timeouts.push(
        setTimeout(() => {
          setAnimPhase("building");
          setBuildStep(1);
        }, 1600)
      );
      timeouts.push(
        setTimeout(() => {
          setBuildStep(2);
        }, 2400)
      );
      timeouts.push(
        setTimeout(() => {
          setBuildStep(3);
        }, 3200)
      );
      timeouts.push(
        setTimeout(() => {
          setAnimPhase("packet2");
        }, 3600)
      );
      timeouts.push(
        setTimeout(() => {
          setAnimPhase("production");
        }, 4500)
      );
    }, 8500);

    return () => {
      clearInterval(interval);
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [isReducedMotion, isUserInteracting, isInView, loopKey]);

  // Handle stage selection
  const handleStageSelect = (stageId: StageId) => {
    setIsUserInteracting(true);
    setSelectedStage(stageId);

    if (stageId === "source") {
      setAnimPhase("source");
      setBuildStep(0);
    } else if (stageId === "build") {
      setAnimPhase("building");
      setBuildStep(2);
    } else if (stageId === "production") {
      setAnimPhase("production");
      setBuildStep(3);
    }

    // Resume auto-cycle after 10 seconds of user inactivity
    const resumeTimer = setTimeout(() => {
      setIsUserInteracting(false);
      setSelectedStage(null);
    }, 10000);
    return () => clearTimeout(resumeTimer);
  };

  // Determine active visual stage for diagram highlighting
  const activeStage: StageId =
    selectedStage ??
    (animPhase === "source" || animPhase === "packet1"
      ? "source"
      : animPhase === "building" || animPhase === "packet2"
      ? "build"
      : "production");

  // Connection line active states
  const isPath1Active =
    !isReducedMotion &&
    (selectedStage === "build" ||
      selectedStage === "production" ||
      animPhase === "packet1" ||
      animPhase === "building" ||
      animPhase === "packet2" ||
      animPhase === "production");

  const isPath2Active =
    !isReducedMotion &&
    (selectedStage === "production" ||
      animPhase === "packet2" ||
      animPhase === "production");

  const isProductionRunning = isReducedMotion || animPhase === "production";

  return (
    <section
      ref={heroRef}
      className="relative w-full min-h-screen flex flex-col justify-center pt-[72px] pb-6 sm:pb-8 lg:pb-10 overflow-hidden bg-transparent select-none"
      aria-label="Deployment Runway Hero"
    >
      {/* Signature Engraved Mountain Landscape & Volumetric Valley Clouds */}
      <HeroMountainIllustration
        activeStage={activeStage}
        animPhase={animPhase}
        isReducedMotion={isReducedMotion}
      />

      <div className="layout-container w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center">
          
          {/* =================================================================
              LEFT COLUMN: Typography, CTAs, Stage Selector (5 cols)
              Remains in normal document flow, fully legible throughout
              ================================================================= */}
          <div className="lg:col-span-5 flex flex-col justify-center z-10">
            

            {/* Main Headline - exactly 2 lines, never wraps into 4 lines */}
            <h1 className="font-sans text-[42px] sm:text-[50px] lg:text-[56px] xl:text-[64px] font-medium leading-[1.04] tracking-[-0.035em] text-[#F5F5F3] mb-4">
              <span className="block whitespace-nowrap">Your code.</span>
              <span className="block whitespace-nowrap">
                In <span className="text-accent-orange">motion</span>.
              </span>
            </h1>

            {/* Supporting Copy */}
            <p className="font-sans text-[15px] sm:text-[16px] text-[#B0B0AE] leading-[1.55] max-w-[420px] mb-6">
              From your first deploy to production infrastructure, everything moves forward.
            </p>

            {/* Primary & Secondary Actions */}
            <div className="flex flex-wrap items-center gap-3.5 mb-6">
              <Link
                href={BRAND.links.signup}
                className="inline-flex items-center justify-center h-[38px] px-5 rounded-[7px] bg-[#D88762] hover:bg-[#E39A76] text-[#111111] text-[13.5px] font-semibold transition-colors duration-[160ms] focus-visible:outline-2 focus-visible:outline-accent-orange focus-visible:outline-offset-2"
              >
                Start building
              </Link>

              <Link
                href="/product"
                className="inline-flex items-center justify-center h-[38px] px-5 rounded-[7px] bg-transparent border border-[#303030] hover:border-[#777777] text-[#F5F5F3] text-[13.5px] font-medium transition-colors duration-[160ms] focus-visible:outline-2 focus-visible:outline-accent-orange"
              >
                Explore the platform
              </Link>
            </div>

            {/* Integrated Stage Controls & Technical Details */}
            <div className="pt-4 border-t border-border-subtle/80 max-w-[460px]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10.5px] text-text-muted tracking-wider uppercase">
                  {`0${activeStage === "source" ? "1" : activeStage === "build" ? "2" : "3"} STAGE: ${activeStage.toUpperCase()}`}
                </span>
                {isUserInteracting && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserInteracting(false);
                      setSelectedStage(null);
                    }}
                    className="font-mono text-[10px] text-accent-orange hover:underline inline-flex items-center gap-1 focus-visible:outline-accent-orange"
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
                className="grid grid-cols-3 gap-2 mb-2.5"
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
                      className={`h-[30px] px-2 rounded-[6px] border text-[11px] font-mono transition-all duration-[160ms] flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-accent-orange ${
                        isSelected
                          ? "bg-[#1D1D1D] border-accent-orange/80 text-[#F5F5F3] shadow-sm"
                          : "bg-transparent border-border-subtle/60 text-text-muted hover:text-text-secondary hover:border-border-default"
                      }`}
                    >
                      <span className={`w-1 h-1 rounded-full ${isSelected ? "bg-accent-orange" : "bg-text-muted/40"}`} />
                      <span>{stage.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Explanatory Caption */}
              <p className="text-[12px] text-text-secondary leading-relaxed min-h-[32px] transition-opacity duration-[180ms]">
                {STAGES.find((s) => s.id === activeStage)?.description}
              </p>

              {/* Technical deployment annotation */}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border-subtle/40 text-[10.5px] font-mono text-text-muted">
                <span className="text-accent-orange">◆</span>
                <span>git push origin main → automated edge deploy (0.84s)</span>
              </div>
            </div>

          </div>

          {/* =================================================================
              RIGHT COLUMN: The Deployment Runway Infrastructure System (7 cols)
              Preserved at intended proportions; Sits at true scale without clipping
              ================================================================= */}
          <div className="lg:col-span-7 relative w-full flex items-center justify-center lg:justify-end overflow-hidden h-[260px] xs:h-[310px] sm:h-[380px] md:h-[420px] lg:h-[460px]">
            {/* Diagram Container: Fixed 640x460 coordinate space */}
            <div className="w-[640px] h-[460px] shrink-0 origin-center lg:origin-top-right scale-[0.54] xs:scale-[0.64] sm:scale-[0.8] md:scale-[0.9] lg:scale-100 relative select-none">
              
              {/* SVG Infrastructure Circuit Layer (connections, pins, data packets) */}
              <svg
                viewBox="0 0 640 460"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute inset-0 w-full h-full pointer-events-none"
                aria-hidden="true"
              >
                {/* CONNECTION 1: Source bottom (134, 114) -> Build top (324, 164) */}
                <path
                  d="M 134 114 C 134 148, 324 130, 324 164"
                  stroke="#303030"
                  strokeWidth="1.5"
                />

                {/* Active Highlight Path 1 */}
                <path
                  d="M 134 114 C 134 148, 324 130, 324 164"
                  stroke={isPath1Active ? "#D88762" : "transparent"}
                  strokeWidth="1.75"
                  className="transition-colors duration-300"
                />

                {/* Packet 1: Glides along Path 1 from Source to Build */}
                {!isReducedMotion && animPhase === "packet1" && (
                  <g key={`packet1-${loopKey}`}>
                    <circle r="6" fill="#D88762" opacity="0.3">
                      <animateMotion
                        path="M 134 114 C 134 148, 324 130, 324 164"
                        dur="0.85s"
                        repeatCount="1"
                        fill="freeze"
                      />
                    </circle>
                    <circle r="3.5" fill="#D88762">
                      <animateMotion
                        path="M 134 114 C 134 148, 324 130, 324 164"
                        dur="0.85s"
                        repeatCount="1"
                        fill="freeze"
                      />
                    </circle>
                  </g>
                )}

                {/* Intermediate Artifact Tag 1 */}
                <g transform="translate(229, 139)">
                  <rect x="-24" y="-8" width="48" height="15" rx="3" fill="#111111" stroke="#303030" strokeWidth="1" />
                  <text x="0" y="3" fill="#777777" fontSize="8.5" fontFamily="var(--font-geist-mono)" textAnchor="middle">
                    git:sha256
                  </text>
                </g>

                {/* CONNECTION 2: Build bottom (324, 290) -> Production top (496, 334) */}
                <path
                  d="M 324 290 C 324 322, 496 302, 496 334"
                  stroke="#303030"
                  strokeWidth="1.5"
                />

                {/* Active Highlight Path 2 */}
                <path
                  d="M 324 290 C 324 322, 496 302, 496 334"
                  stroke={
                    isPath2Active
                      ? isProductionRunning
                        ? "#83B69A"
                        : "#D88762"
                      : "transparent"
                  }
                  strokeWidth="1.75"
                  className="transition-colors duration-300"
                />

                {/* Packet 2: Glides along Path 2 from Build to Production */}
                {!isReducedMotion && animPhase === "packet2" && (
                  <g key={`packet2-${loopKey}`}>
                    <circle r="6" fill="#D88762" opacity="0.3">
                      <animateMotion
                        path="M 324 290 C 324 322, 496 302, 496 334"
                        dur="0.85s"
                        repeatCount="1"
                        fill="freeze"
                      />
                    </circle>
                    <circle r="3.5" fill="#D88762">
                      <animateMotion
                        path="M 324 290 C 324 322, 496 302, 496 334"
                        dur="0.85s"
                        repeatCount="1"
                        fill="freeze"
                      />
                    </circle>
                  </g>
                )}

                {/* Intermediate Artifact Tag 2 */}
                <g transform="translate(410, 312)">
                  <rect x="-24" y="-8" width="48" height="15" rx="3" fill="#111111" stroke="#303030" strokeWidth="1" />
                  <text x="0" y="3" fill="#777777" fontSize="8.5" fontFamily="var(--font-geist-mono)" textAnchor="middle">
                    release:v2.4
                  </text>
                </g>

                {/* Hardware Terminal Ports (Connection Pins) */}
                {/* Source Output Pin (134, 114) */}
                <g transform="translate(134, 114)">
                  <rect x="-3.5" y="-3.5" width="7" height="7" rx="1.5" fill="#1D1D1D" stroke={isPath1Active ? "#D88762" : "#303030"} strokeWidth="1.5" />
                  <circle r="1.5" fill={isPath1Active ? "#D88762" : "#777777"} />
                </g>

                {/* Build Input Pin (324, 164) */}
                <g transform="translate(324, 164)">
                  <rect x="-3.5" y="-3.5" width="7" height="7" rx="1.5" fill="#1D1D1D" stroke={isPath1Active ? "#D88762" : "#303030"} strokeWidth="1.5" />
                  <circle r="1.5" fill={isPath1Active ? "#D88762" : "#777777"} />
                </g>

                {/* Build Output Pin (324, 290) */}
                <g transform="translate(324, 290)">
                  <rect x="-3.5" y="-3.5" width="7" height="7" rx="1.5" fill="#1D1D1D" stroke={isPath2Active ? (isProductionRunning ? "#83B69A" : "#D88762") : "#303030"} strokeWidth="1.5" />
                  <circle r="1.5" fill={isPath2Active ? (isProductionRunning ? "#83B69A" : "#D88762") : "#777777"} />
                </g>

                {/* Production Input Pin (496, 334) */}
                <g transform="translate(496, 334)">
                  <rect x="-3.5" y="-3.5" width="7" height="7" rx="1.5" fill="#1D1D1D" stroke={isPath2Active ? (isProductionRunning ? "#83B69A" : "#D88762") : "#303030"} strokeWidth="1.5" />
                  <circle r="1.5" fill={isProductionRunning ? "#83B69A" : isPath2Active ? "#D88762" : "#777777"} />
                </g>
              </svg>

              {/* -------------------------------------------------------------
                  STAGE A: SOURCE NODE (Top-Left: left 16px, top 16px, width 236px)
                  ------------------------------------------------------------- */}
              <div
                onClick={() => handleStageSelect("source")}
                style={{
                  left: 16,
                  top: 16,
                  width: 236,
                }}
                className={`absolute rounded-[8px] bg-[#181817]/92 backdrop-blur-md border p-3 transition-all duration-200 cursor-pointer shadow-xl shadow-black/50 ${
                  activeStage === "source"
                    ? "border-accent-orange/90 shadow-accent-orange/5"
                    : "border-border-subtle hover:border-border-default"
                }`}
                role="button"
                tabIndex={0}
                aria-label="Inspect Source Node"
                onKeyDown={(e) => e.key === "Enter" && handleStageSelect("source")}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-border-subtle/50">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-text-muted font-medium">
                      SOURCE
                    </span>
                  </div>
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-[3px] bg-[#252525] border border-border-subtle text-text-secondary">
                    main
                  </span>
                </div>

                {/* Node Body: Commit & Diff Details */}
                <div className="space-y-0.5 font-mono text-[10.5px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#F5F5F3] font-medium">commit 8f3a21c</span>
                    <span className="text-semantic-success text-[9.5px]">+142 -18</span>
                  </div>
                  <p className="text-[10px] text-text-muted truncate">
                    feat(routing): edge cluster v2
                  </p>
                </div>

                {/* Node Footer */}
                <div className="mt-2 pt-1.5 border-t border-border-subtle/40 flex items-center justify-between font-mono text-[9.5px] text-text-muted">
                  <span>origin/main</span>
                  <span className="text-accent-orange font-medium">READY</span>
                </div>
              </div>

              {/* -------------------------------------------------------------
                  STAGE B: BUILD ENGINE NODE (Center: left 196px, top 164px, width 256px)
                  ------------------------------------------------------------- */}
              <div
                onClick={() => handleStageSelect("build")}
                style={{
                  left: 196,
                  top: 164,
                  width: 256,
                }}
                className={`absolute rounded-[8px] bg-[#181817]/92 backdrop-blur-md border p-3 transition-all duration-200 cursor-pointer shadow-xl shadow-black/50 ${
                  activeStage === "build"
                    ? "border-accent-orange/90 shadow-accent-orange/10"
                    : "border-border-subtle hover:border-border-default"
                }`}
                role="button"
                tabIndex={0}
                aria-label="Inspect Build Engine Node"
                onKeyDown={(e) => e.key === "Enter" && handleStageSelect("build")}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-border-subtle/50">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        activeStage === "build" || animPhase === "building"
                          ? "bg-accent-orange animate-pulse"
                          : "bg-text-muted"
                      }`}
                    />
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-text-muted font-medium">
                      BUILD ENGINE
                    </span>
                  </div>
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-[3px] bg-[#252525] border border-border-subtle text-text-secondary">
                    turbopack
                  </span>
                </div>

                {/* Simulated Build Steps */}
                <div className="space-y-1 font-mono text-[10.5px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted text-[9.5px]">01</span>
                    <span className={buildStep >= 1 ? "text-[#F5F5F3]" : "text-text-muted"}>
                      pnpm install --frozen
                    </span>
                    {buildStep >= 1 && <Check className="w-2.5 h-2.5 text-semantic-success ml-auto" />}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted text-[9.5px]">02</span>
                    <span
                      className={
                        buildStep === 2
                          ? "text-accent-orange font-medium"
                          : buildStep >= 3
                          ? "text-[#F5F5F3]"
                          : "text-text-muted"
                      }
                    >
                      {buildStep === 2 ? "compiling bundle..." : "next build (142ms)"}
                    </span>
                    {buildStep >= 3 && <Check className="w-2.5 h-2.5 text-semantic-success ml-auto" />}
                  </div>

                  {/* Progress bar line */}
                  <div className="w-full h-1 bg-[#252525] rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full transition-all duration-500 ${
                        buildStep === 0
                          ? "w-[10%] bg-text-muted"
                          : buildStep === 1
                          ? "w-[45%] bg-accent-orange"
                          : buildStep === 2
                          ? "w-[85%] bg-accent-orange"
                          : "w-full bg-semantic-success"
                      }`}
                    />
                  </div>
                </div>

                {/* Build status label */}
                <div className="mt-2 pt-1.5 border-t border-border-subtle/40 flex items-center justify-between font-mono text-[9.5px]">
                  <span className="text-text-muted">status</span>
                  <span
                    className={
                      buildStep >= 3
                        ? "text-semantic-success font-medium"
                        : buildStep > 0
                        ? "text-accent-orange font-medium"
                        : "text-text-muted"
                    }
                  >
                    {buildStep >= 3 ? "BUILD READY" : buildStep > 0 ? "COMPILING" : "QUEUED"}
                  </span>
                </div>
              </div>

              {/* -------------------------------------------------------------
                  STAGE C: PRODUCTION NODE (Bottom-Right: left 368px, top 334px, width 256px)
                  ------------------------------------------------------------- */}
              <div
                onClick={() => handleStageSelect("production")}
                style={{
                  left: 368,
                  top: 334,
                  width: 256,
                }}
                className={`absolute rounded-[8px] bg-[#181817]/92 backdrop-blur-md border p-3 transition-all duration-200 cursor-pointer shadow-xl shadow-black/50 ${
                  activeStage === "production"
                    ? "border-semantic-success/80 shadow-semantic-success/5"
                    : "border-border-subtle hover:border-border-default"
                }`}
                role="button"
                tabIndex={0}
                aria-label="Inspect Production Node"
                onKeyDown={(e) => e.key === "Enter" && handleStageSelect("production")}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-border-subtle/50">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isProductionRunning ? "bg-semantic-success animate-pulse" : "bg-text-muted/60"
                      }`}
                    />
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-text-muted font-medium">
                      PRODUCTION
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[9px] px-1.5 py-0.5 rounded-[3px] border font-medium ${
                      isProductionRunning
                        ? "bg-semantic-success/15 border-semantic-success/30 text-semantic-success"
                        : "bg-[#252525] border-border-subtle text-text-muted"
                    }`}
                  >
                    {isProductionRunning ? "RUNNING" : "DEPLOYING"}
                  </span>
                </div>

                {/* Production Body: Service details */}
                <div className="space-y-0.5 font-mono text-[10.5px]">
                  <div className="text-[#F5F5F3] font-medium truncate flex items-center justify-between">
                    <span>app.summit.demo</span>
                    <span className="text-[9px] text-text-muted">https</span>
                  </div>
                  <div className="flex items-center justify-between text-[9.5px] text-text-muted">
                    <span>iad1-edge</span>
                    <span className="text-semantic-success">18ms</span>
                  </div>
                </div>

                {/* Health & Deployment confirmation */}
                <div className="mt-2 pt-1.5 border-t border-border-subtle/40 flex items-center justify-between font-mono text-[9.5px] text-text-muted">
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
