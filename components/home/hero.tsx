"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { HeroMountainIllustration } from "@/components/home/hero-mountain-illustration";

type AnimPhase = "source" | "packet1" | "building" | "packet2" | "production";

// Exact two-line headline with tuned character stagger & deliberate cadence
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

/**
 * Hero Component — The Infrastructure Expedition
 *
 * Cinematic alpine composition combining monumental mountain topography
 * with an architectural deployment journey:
 *
 * - Left Third: Editorial typography ("Your code belongs up here.") with dramatic negative space.
 * - Central Valley: Expansive open corridor with living procedural valley mist.
 * - Right Half: Three distinct expedition waypoints ascending toward the summit beacon:
 *     1. Waypoint 01 // Source (Basecamp telemetry capsule)
 *     2. Waypoint 02 // Build Engine (Core turbine station)
 *     3. Destination // Production (Summit peak destination beacon)
 */
export function Hero() {
  const [animPhase, setAnimPhase] = useState<AnimPhase>("source");
  const [buildStep, setBuildStep] = useState<number>(0); // 0: idle, 1: installing, 2: compiling, 3: ready
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

    // T=0.8s: Packet 1 active
    timeouts.push(
      setTimeout(() => {
        setAnimPhase("packet1");
      }, 800)
    );

    // T=1.8s: Build Engine activates
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

    // T=3.8s: Packet 2 active
    timeouts.push(
      setTimeout(() => {
        setAnimPhase("packet2");
      }, 3800)
    );

    // T=4.8s: Production goes RUNNING (live calm hold)
    timeouts.push(
      setTimeout(() => {
        setAnimPhase("production");
      }, 4800)
    );

    // Total loop interval: 9.6s
    const interval = setInterval(() => {
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
  }, [isReducedMotion, isInView]);

  // Visual stage active states
  const activeStage =
    animPhase === "source" || animPhase === "packet1"
      ? "source"
      : animPhase === "building" || animPhase === "packet2"
      ? "build"
      : "production";

  const isProductionRunning = isReducedMotion || animPhase === "production";
  const currentBuildStep = isReducedMotion ? 3 : buildStep;

  // Minimal expedition route connectors following landscape contours:
  // Route 1: Waypoint 01 Source bottom (168, 116) -> Waypoint 02 Build Engine top (284, 184)
  const route1D = "M 168 116 C 168 156, 284 144, 284 184";
  // Route 2: Waypoint 02 Build Engine bottom (414, 332) -> Destination Summit top (450, 384)
  const route2D = "M 414 332 C 414 364, 450 352, 450 384";

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

      <div className="layout-container max-w-[1400px] w-full relative z-10 my-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 items-center min-h-[calc(100vh-140px)]">
          
          {/* =================================================================
              LEFT THIRD: Editorial Typography & Actions (5 cols)
              Occupies the left third with dramatic negative space, framed by
              the moody dark valley terrain.
              ================================================================= */}
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col justify-center z-20 max-w-[480px]">

            {/* Editorial Two-Line Headline with Character-by-Character Entrance */}
            <h1
              className="font-sans text-[38px] sm:text-[46px] md:text-[54px] lg:text-[58px] xl:text-[66px] 2xl:text-[72px] font-medium leading-[1.04] tracking-[-0.035em] text-[#FAF8F5] mb-4 select-text max-w-[460px] xl:max-w-[500px]"
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

              {/* Line 2: "up here." with Summit's burnt-orange accent */}
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

            {/* Supporting Copy — Fades in after headline */}
            <p
              className="hero-fade-up font-sans text-[15.5px] text-[#A6A4A0] leading-[1.6] max-w-[390px] mb-8 select-text"
              style={
                isReducedMotion
                  ? { opacity: 1, transform: "none" }
                  : {
                      animation: "heroFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
                      animationDelay: "0.80s",
                    }
              }
            >
              From your first deploy to production infrastructure, everything moves forward.
            </p>

            {/* Primary & Secondary Actions — Fades in beneath copy */}
            <div
              className="hero-fade-up flex flex-wrap items-center gap-3.5"
              style={
                isReducedMotion
                  ? { opacity: 1, transform: "none" }
                  : {
                      animation: "heroFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
                      animationDelay: "1.00s",
                    }
              }
            >
              <Link
                href={BRAND.links.signup}
                className="inline-flex items-center justify-center h-[40px] px-5 rounded-[8px] bg-[#D88762] hover:bg-[#E39A76] text-[#111111] text-[13.5px] font-semibold transition-colors duration-[160ms] shadow-sm focus-visible:outline-2 focus-visible:outline-accent-orange focus-visible:outline-offset-2"
              >
                Start building
              </Link>

              <Link
                href="/product"
                className="inline-flex items-center justify-center h-[40px] px-5 rounded-[8px] bg-transparent border border-[#333330] hover:border-[#777777] text-[#FAF8F5] text-[13.5px] font-medium transition-colors duration-[160ms] focus-visible:outline-2 focus-visible:outline-accent-orange"
              >
                Explore the platform
              </Link>
            </div>

          </div>

          {/* =================================================================
              RIGHT HALF: The Infrastructure Expedition (7 cols)
              Three bespoke waypoints ascending along the mountain contours:
              Waypoint 01 (Basecamp) -> Waypoint 02 (High Engine) -> Destination (Summit)
              ================================================================= */}
          <div className="lg:col-span-7 xl:col-span-7 relative w-full flex items-center justify-center lg:justify-end overflow-visible h-[300px] xs:h-[350px] sm:h-[430px] md:h-[480px] lg:h-[530px] lg:-translate-y-4 lg:translate-x-3 xl:-translate-y-6 xl:translate-x-6 z-20">
            {/* Expedition Canvas: 680x520 coordinate space */}
            <div className="w-[680px] h-[520px] shrink-0 origin-center lg:origin-top-right scale-[0.48] xs:scale-[0.56] sm:scale-[0.68] md:scale-[0.78] lg:scale-[0.88] xl:scale-100 relative select-none">
              
              {/* SVG Expedition Route Connectors (Glowing Minimal Paths, No White Dotted) */}
              <svg
                viewBox="0 0 680 520"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
                aria-hidden="true"
              >
                <defs>
                  {/* Glowing orange aura filter for Trail 1 */}
                  <filter id="expeditionGlowOrange" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur1" />
                    <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur2" />
                    <feMerge>
                      <feMergeNode in="blur2" />
                      <feMergeNode in="blur1" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  {/* Glowing green aura filter for Trail 2 */}
                  <filter id="expeditionGlowGreen" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur1" />
                    <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur2" />
                    <feMerge>
                      <feMergeNode in="blur2" />
                      <feMergeNode in="blur1" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  {/* Luminous Orange Trail Gradient */}
                  <linearGradient id="trailGradOrange" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFA67E" />
                    <stop offset="50%" stopColor="#D88762" />
                    <stop offset="100%" stopColor="#FFA67E" />
                  </linearGradient>

                  {/* Luminous Green Trail Gradient */}
                  <linearGradient id="trailGradGreen" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#B3EAD0" />
                    <stop offset="50%" stopColor="#83B69A" />
                    <stop offset="100%" stopColor="#B3EAD0" />
                  </linearGradient>
                </defs>

                {/* -----------------------------------------------------------
                    EXPEDITION ROUTE 1: Waypoint 01 (Source) -> Waypoint 02 (Build Engine)
                    GLOWING BURNT ORANGE ALONG MOUNTAIN SADDLE CONTOUR
                    ----------------------------------------------------------- */}
                {/* 1. Deep ambient orange glow shadow */}
                <path
                  d={route1D}
                  stroke="#D88762"
                  strokeWidth="7"
                  strokeLinecap="round"
                  opacity="0.4"
                  filter="url(#expeditionGlowOrange)"
                >
                  {!isReducedMotion && (
                    <animate
                      attributeName="opacity"
                      values="0.30;0.60;0.30"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                  )}
                </path>

                {/* 2. Core bright orange line */}
                <path
                  d={route1D}
                  stroke="url(#trailGradOrange)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.95"
                />

                {/* 3. Glowing orange energy bead gliding along the trail */}
                {!isReducedMotion && (
                  <g>
                    <circle r="6" fill="#D88762" opacity="0.6" filter="url(#expeditionGlowOrange)">
                      <animateMotion
                        path={route1D}
                        dur="1.8s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle r="3" fill="#FFA67E" filter="url(#expeditionGlowOrange)">
                      <animateMotion
                        path={route1D}
                        dur="1.8s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
                )}

                {/* Anchor Reticles Route 1 */}
                <circle cx="168" cy="116" r="3.5" fill="#FFA67E" filter="url(#expeditionGlowOrange)" />
                <circle cx="284" cy="184" r="3.5" fill="#FFA67E" filter="url(#expeditionGlowOrange)" />

                {/* -----------------------------------------------------------
                    EXPEDITION ROUTE 2: Waypoint 02 (Build Engine) -> Destination (Summit)
                    GLOWING SAGE GREEN ASCENDING THE HIGH SUMMIT ARÊTE
                    ----------------------------------------------------------- */}
                {/* 1. Deep ambient green glow shadow */}
                <path
                  d={route2D}
                  stroke="#83B69A"
                  strokeWidth="7"
                  strokeLinecap="round"
                  opacity="0.4"
                  filter="url(#expeditionGlowGreen)"
                >
                  {!isReducedMotion && (
                    <animate
                      attributeName="opacity"
                      values="0.30;0.60;0.30"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                  )}
                </path>

                {/* 2. Core bright green line */}
                <path
                  d={route2D}
                  stroke="url(#trailGradGreen)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.95"
                />

                {/* 3. Glowing sage-green energy bead gliding along the trail */}
                {!isReducedMotion && (
                  <g>
                    <circle r="6" fill="#83B69A" opacity="0.6" filter="url(#expeditionGlowGreen)">
                      <animateMotion
                        path={route2D}
                        dur="1.8s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle r="3" fill="#B3EAD0" filter="url(#expeditionGlowGreen)">
                      <animateMotion
                        path={route2D}
                        dur="1.8s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
                )}

                {/* Anchor Reticles Route 2 */}
                <circle cx="414" cy="332" r="3.5" fill="#B3EAD0" filter="url(#expeditionGlowGreen)" />
                <circle cx="450" cy="384" r="3.5" fill="#B3EAD0" filter="url(#expeditionGlowGreen)" />
              </svg>

              {/* -------------------------------------------------------------
                  STATION 01 // SOURCE (Basecamp Waypoint Capsule)
                  Position: left 60px, top 24px, width 216px
                  Compact, sleek telemetry waypoint with origin commit & status
                  ------------------------------------------------------------- */}
              <div
                style={{
                  left: 60,
                  top: 24,
                  width: 216,
                  ...(isReducedMotion
                    ? {}
                    : {
                        animation: "heroFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
                        animationDelay: "0.55s",
                      }),
                }}
                className={`hero-fade-up absolute rounded-[8px] backdrop-blur-md p-3 transition-all duration-300 z-10 ${
                  activeStage === "source"
                    ? "bg-[#1A1816]/95 border-[1.5px] border-accent-orange ring-1 ring-accent-orange/50 shadow-[0_0_24px_rgba(216,135,98,0.32),0_4px_16px_rgba(0,0,0,0.6)]"
                    : "bg-[#141413]/90 border border-[#3A3A36] hover:border-[#555550] shadow-xl shadow-black/60"
                }`}
                aria-label="Waypoint 01: Source"
              >
                {/* Station Header */}
                <div
                  className={`flex items-center justify-between mb-1.5 pb-1.5 border-b transition-colors duration-300 ${
                    activeStage === "source" ? "border-accent-orange/30" : "border-[#2C2C2A]/60"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        activeStage === "source"
                          ? "bg-accent-orange shadow-[0_0_8px_rgba(216,135,98,0.9)]"
                          : "bg-accent-orange/70"
                      }`}
                    />
                    <span
                      className={`font-mono text-[9px] uppercase tracking-wider font-medium transition-colors duration-300 ${
                        activeStage === "source" ? "text-accent-orange" : "text-text-muted"
                      }`}
                    >
                      01 // SOURCE
                    </span>
                  </div>
                  <span className="font-mono text-[8.5px] px-1.5 py-0.5 rounded-[3px] bg-[#20201E] border border-[#2C2C2A] text-text-secondary">
                    main
                  </span>
                </div>

                {/* Station Body: Commit & Diff Details */}
                <div className="space-y-0.5 font-mono text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#FAF8F5] font-medium">commit 8f3a21c</span>
                    <span className="text-semantic-success text-[9px]">+142 -18</span>
                  </div>
                  <p className="text-[9.5px] text-text-muted truncate">
                    feat(routing): edge cluster v2
                  </p>
                </div>

                {/* Station Footer */}
                <div className="mt-2 pt-1.5 border-t border-[#2C2C2A]/50 flex items-center justify-between font-mono text-[9px] text-text-muted">
                  <span className="tracking-wide">ELEV 1,640M</span>
                  <span className="text-accent-orange font-medium">READY</span>
                </div>
              </div>

              {/* -------------------------------------------------------------
                  STATION 02 // BUILD ENGINE (Core Turbine Station)
                  Position: left 220px, top 184px, width 254px
                  The prominent central technical instrument panel
                  ------------------------------------------------------------- */}
              <div
                style={{
                  left: 220,
                  top: 184,
                  width: 254,
                  ...(isReducedMotion
                    ? {}
                    : {
                        animation: "heroFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
                        animationDelay: "0.80s",
                      }),
                }}
                className={`hero-fade-up absolute rounded-[8px] backdrop-blur-md p-3.5 transition-all duration-300 z-10 ${
                  activeStage === "build"
                    ? "bg-[#1A1816]/95 border-[1.5px] border-accent-orange ring-1 ring-accent-orange/50 shadow-[0_0_28px_rgba(216,135,98,0.35),0_4px_16px_rgba(0,0,0,0.6)]"
                    : "bg-[#141413]/90 border border-[#3A3A36] hover:border-[#555550] shadow-xl shadow-black/60"
                }`}
                aria-label="Waypoint 02: Build Engine"
              >
                {/* Station Header */}
                <div
                  className={`flex items-center justify-between mb-1.5 pb-1.5 border-b transition-colors duration-300 ${
                    activeStage === "build" ? "border-accent-orange/30" : "border-[#2C2C2A]/60"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        activeStage === "build" || animPhase === "building"
                          ? "bg-accent-orange shadow-[0_0_8px_rgba(216,135,98,0.9)] animate-pulse"
                          : currentBuildStep >= 3
                          ? "bg-semantic-success shadow-[0_0_8px_rgba(131,182,154,0.8)]"
                          : "bg-text-muted"
                      }`}
                    />
                    <span
                      className={`font-mono text-[9px] uppercase tracking-wider font-medium transition-colors duration-300 ${
                        activeStage === "build" ? "text-accent-orange" : "text-text-muted"
                      }`}
                    >
                      02 // BUILD ENGINE
                    </span>
                  </div>
                  <span className="font-mono text-[8.5px] px-1.5 py-0.5 rounded-[3px] bg-[#20201E] border border-[#2C2C2A] text-text-secondary">
                    turbopack
                  </span>
                </div>

                {/* Simulated Build Steps */}
                <div className="space-y-1 font-mono text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted text-[9px]">01</span>
                    <span className={currentBuildStep >= 1 ? "text-[#FAF8F5]" : "text-text-muted"}>
                      pnpm install --frozen
                    </span>
                    {currentBuildStep >= 1 && <Check className="w-2.5 h-2.5 text-semantic-success ml-auto" />}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted text-[9px]">02</span>
                    <span
                      className={
                        currentBuildStep === 2
                          ? "text-accent-orange font-medium"
                          : currentBuildStep >= 3
                          ? "text-[#FAF8F5]"
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

                {/* Station Footer */}
                <div className="mt-2 pt-1.5 border-t border-[#2C2C2A]/50 flex items-center justify-between font-mono text-[9px]">
                  <span className="text-text-muted tracking-wide">ELEV 2,840M</span>
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
                  STATION 03 // DESTINATION (The Summit Peak Beacon)
                  Position: left 380px, top 384px, width 250px
                  Refined destination marker crowning the highest mountain peak
                  ------------------------------------------------------------- */}
              <div
                style={{
                  left: 380,
                  top: 384,
                  width: 250,
                  ...(isReducedMotion
                    ? {}
                    : {
                        animation: "heroFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
                        animationDelay: "1.05s",
                      }),
                }}
                className={`hero-fade-up absolute rounded-[8px] backdrop-blur-md p-3.5 transition-all duration-300 z-10 ${
                  activeStage === "production" || isProductionRunning
                    ? "bg-[#141B16]/95 border-[1.5px] border-semantic-success ring-1 ring-semantic-success/50 shadow-[0_0_28px_rgba(131,182,154,0.35),0_4px_16px_rgba(0,0,0,0.6)]"
                    : "bg-[#141413]/90 border border-[#3A3A36] hover:border-[#555550] shadow-xl shadow-black/60"
                }`}
                aria-label="Destination: Summit Peak Production"
              >
                {/* Station Header: Destination Marker */}
                <div
                  className={`flex items-center justify-between mb-1.5 pb-1.5 border-b transition-colors duration-300 ${
                    isProductionRunning ? "border-semantic-success/30" : "border-[#2C2C2A]/60"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isProductionRunning
                          ? "bg-semantic-success shadow-[0_0_8px_rgba(131,182,154,0.9)] animate-pulse"
                          : "bg-text-muted/60"
                      }`}
                    />
                    <span
                      className={`font-mono text-[9px] uppercase tracking-wider font-semibold transition-colors duration-300 ${
                        isProductionRunning ? "text-semantic-success" : "text-text-muted"
                      }`}
                    >
                      DESTINATION // SUMMIT
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[8.5px] px-1.5 py-0.5 rounded-[3px] border font-medium ${
                      isProductionRunning
                        ? "bg-semantic-success/15 border-semantic-success/30 text-semantic-success"
                        : "bg-[#20201E] border-[#2C2C2A] text-text-muted"
                    }`}
                  >
                    {isProductionRunning ? "LIVE" : "DEPLOYING"}
                  </span>
                </div>

                {/* Station Body: Endpoint & Global Edge Telemetry */}
                <div className="space-y-0.5 font-mono text-[10px]">
                  <div className="text-[#FAF8F5] font-medium truncate flex items-center justify-between">
                    <span>app.summit.demo</span>
                    <span className="text-[8.5px] text-text-muted">https</span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-text-muted">
                    <span>iad1-edge</span>
                    <span className="text-semantic-success">18ms</span>
                  </div>
                </div>

                {/* Station Footer: Geodesic Summit Elevation & Health */}
                <div className="mt-2 pt-1.5 border-t border-[#2C2C2A]/50 flex items-center justify-between font-mono text-[9px] text-text-muted">
                  <span className="tracking-wide">SUMMIT // 3,428M</span>
                  <span className="text-semantic-success font-medium">SSL active</span>
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