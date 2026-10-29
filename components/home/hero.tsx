"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { HeroMountainIllustration } from "@/components/home/hero-mountain-illustration";

type AnimPhase = "source" | "packet1" | "building" | "packet2" | "production";

// Headline characters with tuned stagger & deliberate cadence
const LINE1_TEXT = "Your code belongs";
const LINE2_TEXT = "up here.";

const LINE1_CHARS = Array.from(LINE1_TEXT).map((char, index) => ({
  char,
  delay: +(0.08 + index * 0.032).toFixed(3),
}));

const LINE2_CHARS = Array.from(LINE2_TEXT).map((char, index) => ({
  char,
  delay: +(0.58 + index * 0.048).toFixed(3),
}));

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
  const [animPhase, setAnimPhase] = useState<AnimPhase>("source");
  const [buildStep, setBuildStep] = useState<number>(0); // 0: idle, 1: installing, 2: compiling, 3: ready
  const [loopKey, setLoopKey] = useState<number>(0);
  const heroRef = useRef<HTMLElement>(null);
  const [isInView, setIsInView] = useState(true);

  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  // Intersection observer to pause expensive animations when outside viewport
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

  // Autonomous deployment sequence animation (9.6s loop: 4.8s progression + 4.8s live hold)
  useEffect(() => {
    if (isReducedMotion || !isInView) {
      return;
    }

    const timeouts: NodeJS.Timeout[] = [];

    // T=0.8s: Packet 1 travels along Path 1 from Source to Build
    timeouts.push(
      setTimeout(() => {
        setAnimPhase("packet1");
      }, 800)
    );

    // T=1.8s: Packet 1 arrives; Build Engine activates
    timeouts.push(
      setTimeout(() => {
        setAnimPhase("building");
        setBuildStep(1); // pnpm install
      }, 1800)
    );

    // T=2.6s: Build compilation step
    timeouts.push(
      setTimeout(() => {
        setBuildStep(2); // compiling bundle
      }, 2600)
    );

    // T=3.4s: Build successful
    timeouts.push(
      setTimeout(() => {
        setBuildStep(3); // ready
      }, 3400)
    );

    // T=3.8s: Packet 2 travels from Build to Production along Path 2
    timeouts.push(
      setTimeout(() => {
        setAnimPhase("packet2");
      }, 3800)
    );

    // T=4.8s: Packet 2 arrives; Production goes RUNNING (live calm hold)
    timeouts.push(
      setTimeout(() => {
        setAnimPhase("production");
      }, 4800)
    );

    // Total loop interval: 9.6s, smoothly cycles without jarring reset
    const interval = setInterval(() => {
      setLoopKey((k) => k + 1);
      setAnimPhase("source");
      setBuildStep(0);

      timeouts.push(
        setTimeout(() => {
          setAnimPhase("packet1");
        }, 800)
      );
      timeouts.push(
        setTimeout(() => {
          setAnimPhase("building");
          setBuildStep(1);
        }, 1800)
      );
      timeouts.push(
        setTimeout(() => {
          setBuildStep(2);
        }, 2600)
      );
      timeouts.push(
        setTimeout(() => {
          setBuildStep(3);
        }, 3400)
      );
      timeouts.push(
        setTimeout(() => {
          setAnimPhase("packet2");
        }, 3800)
      );
      timeouts.push(
        setTimeout(() => {
          setAnimPhase("production");
        }, 4800)
      );
    }, 9600);

    return () => {
      clearInterval(interval);
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [isReducedMotion, isInView, loopKey]);

  // Visual stage active states
  const activeStage =
    animPhase === "source" || animPhase === "packet1"
      ? "source"
      : animPhase === "building" || animPhase === "packet2"
      ? "build"
      : "production";

  // Connection line active states
  const isPath1Active =
    !isReducedMotion &&
    (animPhase === "packet1" ||
      animPhase === "building" ||
      animPhase === "packet2" ||
      animPhase === "production");

  const isPath2Active =
    !isReducedMotion &&
    (animPhase === "packet2" || animPhase === "production");

  const isProductionRunning = isReducedMotion || animPhase === "production";
  const currentBuildStep = isReducedMotion ? 3 : buildStep;

  return (
    <section
      ref={heroRef}
      className="relative w-full min-h-screen flex flex-col justify-center pt-[72px] pb-10 sm:pb-14 lg:pb-16 overflow-hidden bg-transparent select-none"
      aria-label="Summit Cloud Infrastructure Hero"
    >
      {/* Signature Engraved Mountain Landscape & Volumetric Valley Mist */}
      <HeroMountainIllustration
        activeStage={activeStage}
        animPhase={animPhase}
        isReducedMotion={isReducedMotion}
        isInView={isInView}
      />

      <div className="layout-container w-full relative z-10 my-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          
          {/* =================================================================
              LEFT COLUMN: Editorial Typography & Actions (5 cols)
              Rebalanced without the stage selector: confident, elegant, legible
              ================================================================= */}
          <div className="lg:col-span-5 flex flex-col justify-center z-10">

            {/* Editorial Two-Line Headline with Character-by-Character Entrance */}
            <h1
              className="font-sans text-[42px] sm:text-[54px] md:text-[64px] lg:text-[72px] xl:text-[80px] font-medium leading-[1.04] tracking-[-0.035em] text-[#F5F5F3] mb-5 select-text"
              aria-label="Your code belongs up here."
            >
              {/* Accessible text representation for screen readers */}
              <span className="sr-only">Your code belongs up here.</span>

              {/* Line 1: "Your code belongs" */}
              <span aria-hidden="true" className="block whitespace-nowrap">
                {LINE1_CHARS.map((item, idx) => (
                  <span
                    key={`l1-${idx}`}
                    className="hero-char inline-block whitespace-pre will-change-[transform,opacity,filter]"
                    style={
                      isReducedMotion
                        ? { opacity: 1, transform: "none", filter: "none" }
                        : {
                            animation: "heroCharEntrance 0.48s cubic-bezier(0.16, 1, 0.3, 1) both",
                            animationDelay: `${item.delay}s`,
                          }
                    }
                  >
                    {item.char === " " ? "\u00A0" : item.char}
                  </span>
                ))}
              </span>

              {/* Line 2: "up here." with Burnt-Orange Accent */}
              <span
                aria-hidden="true"
                className="block whitespace-nowrap text-accent-orange"
              >
                {LINE2_CHARS.map((item, idx) => (
                  <span
                    key={`l2-${idx}`}
                    className="hero-char inline-block whitespace-pre will-change-[transform,opacity,filter]"
                    style={
                      isReducedMotion
                        ? { opacity: 1, transform: "none", filter: "none" }
                        : {
                            animation: "heroCharEntrance 0.48s cubic-bezier(0.16, 1, 0.3, 1) both",
                            animationDelay: `${item.delay}s`,
                          }
                    }
                  >
                    {item.char === " " ? "\u00A0" : item.char}
                  </span>
                ))}
              </span>
            </h1>

            {/* Supporting Copy */}
            <p className="font-sans text-[15.5px] sm:text-[16.5px] text-[#B0B0AE] leading-[1.6] max-w-[440px] mb-8 select-text">
              From your first deploy to production infrastructure, everything moves forward.
            </p>

            {/* Primary & Secondary Actions */}
            <div className="flex flex-wrap items-center gap-3.5">
              <Link
                href={BRAND.links.signup}
                className="inline-flex items-center justify-center h-[40px] px-5 rounded-[8px] bg-[#D88762] hover:bg-[#E39A76] text-[#111111] text-[13.5px] font-semibold transition-colors duration-[160ms] shadow-sm focus-visible:outline-2 focus-visible:outline-accent-orange focus-visible:outline-offset-2"
              >
                Start building
              </Link>

              <Link
                href="/product"
                className="inline-flex items-center justify-center h-[40px] px-5 rounded-[8px] bg-transparent border border-[#303030] hover:border-[#777777] text-[#F5F5F3] text-[13.5px] font-medium transition-colors duration-[160ms] focus-visible:outline-2 focus-visible:outline-accent-orange"
              >
                Explore the platform
              </Link>
            </div>

          </div>

          {/* =================================================================
              RIGHT COLUMN: Technical Overlay Infrastructure System (7 cols)
              Precision technical overlay integrated into the engraved mountainscape
              ================================================================= */}
          <div className="lg:col-span-7 relative w-full flex items-center justify-center lg:justify-end overflow-hidden h-[260px] xs:h-[310px] sm:h-[380px] md:h-[420px] lg:h-[460px]">
            {/* Diagram Container: Fixed 640x460 coordinate space */}
            <div className="w-[640px] h-[460px] shrink-0 origin-center lg:origin-top-right scale-[0.52] xs:scale-[0.62] sm:scale-[0.78] md:scale-[0.88] lg:scale-100 relative select-none">
              
              {/* SVG Infrastructure Circuit Layer (connections, pins, data packets) */}
              <svg
                viewBox="0 0 640 460"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute inset-0 w-full h-full pointer-events-none z-0"
                aria-hidden="true"
              >
                {/* CONNECTION 1 BASE: Source bottom (134, 114) -> Build top (324, 164) */}
                <path
                  d="M 134 114 C 134 148, 324 130, 324 164"
                  stroke="#282826"
                  strokeWidth="1.25"
                  strokeDasharray="3 3"
                />

                {/* Active Highlight Path 1 */}
                <path
                  d="M 134 114 C 134 148, 324 130, 324 164"
                  stroke={isPath1Active ? "#D88762" : "transparent"}
                  strokeWidth="1.5"
                  className="transition-colors duration-300"
                />

                {/* Packet 1: Glides along Path 1 from Source to Build */}
                {!isReducedMotion && animPhase === "packet1" && (
                  <g key={`packet1-${loopKey}`}>
                    <circle r="6" fill="#D88762" opacity="0.3">
                      <animateMotion
                        path="M 134 114 C 134 148, 324 130, 324 164"
                        dur="0.9s"
                        repeatCount="1"
                        fill="freeze"
                      />
                    </circle>
                    <circle r="3" fill="#D88762">
                      <animateMotion
                        path="M 134 114 C 134 148, 324 130, 324 164"
                        dur="0.9s"
                        repeatCount="1"
                        fill="freeze"
                      />
                    </circle>
                  </g>
                )}

                {/* Intermediate Artifact Tag 1 */}
                <g transform="translate(229, 139)">
                  <rect x="-24" y="-8" width="48" height="15" rx="3" fill="#141413" stroke="#2C2C2A" strokeWidth="0.85" />
                  <text x="0" y="3" fill="#777777" fontSize="8.5" fontFamily="var(--font-geist-mono)" textAnchor="middle">
                    git:sha256
                  </text>
                </g>

                {/* CONNECTION 2 BASE: Build bottom (324, 290) -> Production top (496, 334) */}
                <path
                  d="M 324 290 C 324 322, 496 302, 496 334"
                  stroke="#282826"
                  strokeWidth="1.25"
                  strokeDasharray="3 3"
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
                  strokeWidth="1.5"
                  className="transition-colors duration-300"
                />

                {/* Packet 2: Glides along Path 2 from Build to Production */}
                {!isReducedMotion && animPhase === "packet2" && (
                  <g key={`packet2-${loopKey}`}>
                    <circle r="6" fill="#D88762" opacity="0.3">
                      <animateMotion
                        path="M 324 290 C 324 322, 496 302, 496 334"
                        dur="0.9s"
                        repeatCount="1"
                        fill="freeze"
                      />
                    </circle>
                    <circle r="3" fill="#83B69A">
                      <animateMotion
                        path="M 324 290 C 324 322, 496 302, 496 334"
                        dur="0.9s"
                        repeatCount="1"
                        fill="freeze"
                      />
                    </circle>
                  </g>
                )}

                {/* Subtle continuous telemetry heartbeat ping during live production hold */}
                {!isReducedMotion && animPhase === "production" && (
                  <g key={`heartbeat-${loopKey}`}>
                    <circle r="2.5" fill="#83B69A" opacity="0.45">
                      <animateMotion
                        path="M 324 290 C 324 322, 496 302, 496 334"
                        dur="2.8s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
                )}

                {/* Intermediate Artifact Tag 2 */}
                <g transform="translate(410, 312)">
                  <rect x="-24" y="-8" width="48" height="15" rx="3" fill="#141413" stroke="#2C2C2A" strokeWidth="0.85" />
                  <text x="0" y="3" fill="#777777" fontSize="8.5" fontFamily="var(--font-geist-mono)" textAnchor="middle">
                    release:v2.4
                  </text>
                </g>

                {/* Hardware Terminal Ports (Connection Pins) */}
                {/* Source Output Pin (134, 114) */}
                <g transform="translate(134, 114)">
                  <rect x="-3" y="-3" width="6" height="6" rx="1.5" fill="#141413" stroke={isPath1Active ? "#D88762" : "#2C2C2A"} strokeWidth="1.2" />
                  <circle r="1.2" fill={isPath1Active ? "#D88762" : "#777777"} />
                </g>

                {/* Build Input Pin (324, 164) */}
                <g transform="translate(324, 164)">
                  <rect x="-3" y="-3" width="6" height="6" rx="1.5" fill="#141413" stroke={isPath1Active ? "#D88762" : "#2C2C2A"} strokeWidth="1.2" />
                  <circle r="1.2" fill={isPath1Active ? "#D88762" : "#777777"} />
                </g>

                {/* Build Output Pin (324, 290) */}
                <g transform="translate(324, 290)">
                  <rect x="-3" y="-3" width="6" height="6" rx="1.5" fill="#141413" stroke={isPath2Active ? (isProductionRunning ? "#83B69A" : "#D88762") : "#2C2C2A"} strokeWidth="1.2" />
                  <circle r="1.2" fill={isPath2Active ? (isProductionRunning ? "#83B69A" : "#D88762") : "#777777"} />
                </g>

                {/* Production Input Pin (496, 334) */}
                <g transform="translate(496, 334)">
                  <rect x="-3" y="-3" width="6" height="6" rx="1.5" fill="#141413" stroke={isPath2Active ? (isProductionRunning ? "#83B69A" : "#D88762") : "#2C2C2A"} strokeWidth="1.2" />
                  <circle r="1.2" fill={isProductionRunning ? "#83B69A" : isPath2Active ? "#D88762" : "#777777"} />
                </g>
              </svg>

              {/* -------------------------------------------------------------
                  NODE 1: SOURCE NODE (Top-Left: left 16px, top 16px, width 236px)
                  ------------------------------------------------------------- */}
              <div
                style={{
                  left: 16,
                  top: 16,
                  width: 236,
                }}
                className={`absolute rounded-[8px] bg-[#141413]/88 backdrop-blur-md border p-3 transition-all duration-200 shadow-xl shadow-black/50 z-10 ${
                  activeStage === "source"
                    ? "border-accent-orange/70 shadow-accent-orange/5"
                    : "border-[#2C2C2A] hover:border-[#444440]"
                }`}
                aria-label="Source Node"
              >
                {/* Node Header */}
                <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-[#2C2C2A]/60">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-text-muted font-medium">
                      SOURCE
                    </span>
                  </div>
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-[3px] bg-[#20201E] border border-[#2C2C2A] text-text-secondary">
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
                <div className="mt-2 pt-1.5 border-t border-[#2C2C2A]/50 flex items-center justify-between font-mono text-[9.5px] text-text-muted">
                  <span>origin/main</span>
                  <span className="text-accent-orange font-medium">READY</span>
                </div>
              </div>

              {/* -------------------------------------------------------------
                  NODE 2: BUILD ENGINE NODE (Center: left 196px, top 164px, width 256px)
                  ------------------------------------------------------------- */}
              <div
                style={{
                  left: 196,
                  top: 164,
                  width: 256,
                }}
                className={`absolute rounded-[8px] bg-[#141413]/88 backdrop-blur-md border p-3 transition-all duration-200 shadow-xl shadow-black/50 z-10 ${
                  activeStage === "build"
                    ? "border-accent-orange/70 shadow-accent-orange/10"
                    : "border-[#2C2C2A] hover:border-[#444440]"
                }`}
                aria-label="Build Engine Node"
              >
                {/* Node Header */}
                <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-[#2C2C2A]/60">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        activeStage === "build" || animPhase === "building"
                          ? "bg-accent-orange animate-pulse"
                          : currentBuildStep >= 3
                          ? "bg-semantic-success"
                          : "bg-text-muted"
                      }`}
                    />
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-text-muted font-medium">
                      BUILD ENGINE
                    </span>
                  </div>
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-[3px] bg-[#20201E] border border-[#2C2C2A] text-text-secondary">
                    turbopack
                  </span>
                </div>

                {/* Simulated Build Steps */}
                <div className="space-y-1 font-mono text-[10.5px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted text-[9.5px]">01</span>
                    <span className={currentBuildStep >= 1 ? "text-[#F5F5F3]" : "text-text-muted"}>
                      pnpm install --frozen
                    </span>
                    {currentBuildStep >= 1 && <Check className="w-2.5 h-2.5 text-semantic-success ml-auto" />}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted text-[9.5px]">02</span>
                    <span
                      className={
                        currentBuildStep === 2
                          ? "text-accent-orange font-medium"
                          : currentBuildStep >= 3
                          ? "text-[#F5F5F3]"
                          : "text-text-muted"
                      }
                    >
                      {currentBuildStep === 2 ? "compiling bundle..." : "next build (142ms)"}
                    </span>
                    {currentBuildStep >= 3 && <Check className="w-2.5 h-2.5 text-semantic-success ml-auto" />}
                  </div>

                  {/* Smooth Progress bar track */}
                  <div className="w-full h-1 bg-[#222220] rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full transition-all duration-500 ease-out ${
                        currentBuildStep === 0
                          ? "w-[10%] bg-text-muted"
                          : currentBuildStep === 1
                          ? "w-[45%] bg-accent-orange"
                          : currentBuildStep === 2
                          ? "w-[85%] bg-accent-orange"
                          : "w-full bg-semantic-success"
                      }`}
                    />
                  </div>
                </div>

                {/* Build status label */}
                <div className="mt-2 pt-1.5 border-t border-[#2C2C2A]/50 flex items-center justify-between font-mono text-[9.5px]">
                  <span className="text-text-muted">status</span>
                  <span
                    className={
                      currentBuildStep >= 3
                        ? "text-semantic-success font-medium"
                        : currentBuildStep > 0
                        ? "text-accent-orange font-medium"
                        : "text-text-muted"
                    }
                  >
                    {currentBuildStep >= 3 ? "BUILD READY" : currentBuildStep > 0 ? "COMPILING" : "QUEUED"}
                  </span>
                </div>
              </div>

              {/* -------------------------------------------------------------
                  NODE 3: PRODUCTION NODE (Bottom-Right: left 368px, top 334px, width 256px)
                  ------------------------------------------------------------- */}
              <div
                style={{
                  left: 368,
                  top: 334,
                  width: 256,
                }}
                className={`absolute rounded-[8px] bg-[#141413]/88 backdrop-blur-md border p-3 transition-all duration-200 shadow-xl shadow-black/50 z-10 ${
                  activeStage === "production" || isProductionRunning
                    ? "border-semantic-success/60 shadow-semantic-success/5"
                    : "border-[#2C2C2A] hover:border-[#444440]"
                }`}
                aria-label="Production Node"
              >
                {/* Node Header */}
                <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-[#2C2C2A]/60">
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
                        : "bg-[#20201E] border-[#2C2C2A] text-text-muted"
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
                <div className="mt-2 pt-1.5 border-t border-[#2C2C2A]/50 flex items-center justify-between font-mono text-[9.5px] text-text-muted">
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