"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { HeroMountainIllustration } from "@/components/home/hero-mountain-illustration";
import { usePreloader } from "@/components/layout/preloader-context";

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
 * Hero Component — Editorial Alpine Infrastructure Layout
 *
 * Cinematic alpine composition combining monumental mountain topography
 * with an architectural deployment journey:
 *
 * - Upper-Left Quadrant: Editorial typography ("Your code belongs up here.")
 *   with deliberate breathing room from the navbar and darker negative space framing.
 * - Central Valley: Serene open mountain corridor and living procedural valley mist.
 * - Right Flank: Three distinct infrastructure stations ascending toward the summit beacon:
 *     1. Station 01: Source (Commit & telemetry waypoint)
 *     2. Station 02: Build Engine (Turbopack compile station)
 *     3. Station 03: Production (Summit peak destination beacon)
 */
export function Hero() {
  const { isComplete } = usePreloader();
  const [animPhase, setAnimPhase] = useState<AnimPhase>("source");
  const [buildStep, setBuildStep] = useState<number>(0); // 0: idle, 1: installing, 2: compiling, 3: ready
  const heroRef = useRef<HTMLElement>(null);
  const [isInView, setIsInView] = useState(true);

  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const isRevealed = isReducedMotion || isComplete;

  // Intersection observer to pause animations when outside viewport
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
    if (isReducedMotion || !isInView || !isRevealed) {
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
  }, [isReducedMotion, isInView, isRevealed]);

  // Visual stage active states
  const activeStage =
    animPhase === "source" || animPhase === "packet1"
      ? "source"
      : animPhase === "building" || animPhase === "packet2"
      ? "build"
      : "production";

  const isProductionRunning = isReducedMotion || animPhase === "production";
  const currentBuildStep = isReducedMotion ? 3 : buildStep;

  // Minimal route connectors following landscape contours:
  // Route 1: Station 01 Source bottom (280, 106) -> Station 02 Build Engine top (350, 174)
  const route1D = "M 280 106 C 280 146, 350 134, 350 174";
  // Route 2: Station 02 Build Engine bottom (407, 298) -> Station 03 Production top (460, 344)
  const route2D = "M 407 298 C 407 328, 460 314, 460 344";

  return (
    <section
      ref={heroRef}
      id="hero"
      className="relative w-full min-h-screen flex flex-col justify-start pt-[104px] sm:pt-[116px] lg:pt-[128px] xl:pt-[140px] pb-24 sm:pb-32 lg:pb-40 xl:pb-48 overflow-hidden bg-transparent select-none"
      aria-label="Summit Cloud Infrastructure Hero"
    >
      {/* Signature Engraved Mountain Landscape & Volumetric Valley Mist */}
      <HeroMountainIllustration
        activeStage={activeStage}
        animPhase={animPhase}
        isReducedMotion={isReducedMotion}
        isInView={isInView}
      />

      <div className="layout-container max-w-[1400px] w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-14 items-start">
          
          {/* =================================================================
              UPPER-LEFT QUADRANT: Editorial Typography & Actions (5 cols)
              Anchored in the upper-left quadrant with intentional breathing room
              from the navbar, framed by the moody dark mountain valley terrain.
              ================================================================= */}
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col justify-start z-20 max-w-[480px]">

            {/* Editorial Two-Line Headline with Character-by-Character Entrance */}
            <h1
              className="font-sans text-[36px] sm:text-[44px] md:text-[50px] lg:text-[56px] xl:text-[64px] font-medium leading-[1.04] tracking-[-0.035em] text-[#FAF8F5] select-text max-w-[430px] lg:max-w-[450px] xl:max-w-[480px]"
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
                        : !isRevealed
                        ? { opacity: 0, transform: "translateY(20px)", filter: "blur(4px)" }
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
                        : !isRevealed
                        ? { opacity: 0, transform: "translateY(20px)", filter: "blur(4px)" }
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

            {/* Supporting Copy — Fades in beneath headline with generous breathing room */}
            <p
              className="hero-fade-up font-sans text-[15px] sm:text-[15.5px] text-[#A6A4A0] leading-[1.65] max-w-[380px] mt-6 sm:mt-7 mb-8 sm:mb-9 select-text"
              style={
                isReducedMotion
                  ? { opacity: 1, transform: "none" }
                  : !isRevealed
                  ? { opacity: 0, transform: "translateY(16px)" }
                  : {
                      animation: "heroFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
                      animationDelay: "0.80s",
                    }
              }
            >
              From your first deploy to production infrastructure, everything moves forward.
            </p>

            {/* Primary & Secondary Actions — Aligned in one balanced row */}
            <div
              className="hero-fade-up flex flex-wrap items-center gap-3.5 sm:gap-4"
              style={
                isReducedMotion
                  ? { opacity: 1, transform: "none" }
                  : !isRevealed
                  ? { opacity: 0, transform: "translateY(16px)" }
                  : {
                      animation: "heroFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
                      animationDelay: "1.00s",
                    }
              }
            >
              <Link
                href={BRAND.links.signup}
                className="inline-flex items-center justify-center h-[42px] px-6 rounded-[8px] bg-[#D88762] hover:bg-[#E39A76] text-[#111111] text-[13.5px] font-semibold transition-colors duration-[160ms] shadow-sm focus-visible:outline-2 focus-visible:outline-accent-orange focus-visible:outline-offset-2"
              >
                Start building
              </Link>

              <Link
                href="/product"
                className="inline-flex items-center justify-center h-[42px] px-5 rounded-[8px] bg-transparent border border-[#383834] hover:border-[#666660] text-[#FAF8F5] text-[13.5px] font-medium transition-colors duration-[160ms] focus-visible:outline-2 focus-visible:outline-accent-orange"
              >
                Explore the platform
              </Link>
            </div>

          </div>

          {/* =================================================================
              RIGHT FLANK: The Infrastructure Expedition (7 cols)
              Three waypoints ascending along the right mountain slopes toward
              the summit peak, leaving the center mountain valley open for
              dramatic atmospheric breathing room.
              ================================================================= */}
          <div className="lg:col-span-7 xl:col-span-7 relative w-full flex items-start justify-center lg:justify-end overflow-visible h-[270px] xs:h-[310px] sm:h-[370px] md:h-[420px] lg:h-[490px] z-20 mt-8 lg:mt-0">
            {/* Expedition Canvas: 680x490 coordinate space */}
            <div className="w-[680px] h-[490px] shrink-0 origin-top-left sm:origin-top lg:origin-top-right scale-[0.52] xs:scale-[0.60] sm:scale-[0.72] md:scale-[0.82] lg:scale-[0.88] xl:scale-100 relative select-none">
              
              {/* SVG Route Connectors: Glowing Minimal Paths (No White Dotted Lines) */}
              <svg
                viewBox="0 0 680 490"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible transition-opacity duration-700 ease-out"
                style={{
                  opacity: !isRevealed ? 0 : 1,
                  transitionDelay: isRevealed ? "400ms" : "0ms",
                }}
                aria-hidden="true"
              >
                <defs>
                  {/* Glowing orange aura filter for Route 1 */}
                  <filter id="routeGlowOrange" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  {/* Glowing green aura filter for Route 2 */}
                  <filter id="routeGlowGreen" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  {/* Luminous Orange Route Gradient */}
                  <linearGradient id="routeGradOrange" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFA67E" />
                    <stop offset="50%" stopColor="#D88762" />
                    <stop offset="100%" stopColor="#FFA67E" />
                  </linearGradient>

                  {/* Luminous Green Route Gradient */}
                  <linearGradient id="routeGradGreen" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#B3EAD0" />
                    <stop offset="50%" stopColor="#83B69A" />
                    <stop offset="100%" stopColor="#B3EAD0" />
                  </linearGradient>
                </defs>

                {/* -----------------------------------------------------------
                    ROUTE 1: Station 01 (Source) -> Station 02 (Build Engine)
                    GLOWING BURNT ORANGE ALONG MOUNTAIN SLOPE
                    ----------------------------------------------------------- */}
                {/* 1. Deep ambient orange glow aura */}
                <path
                  d={route1D}
                  stroke="#D88762"
                  strokeWidth="7"
                  strokeLinecap="round"
                  opacity="0.4"
                  filter="url(#routeGlowOrange)"
                >
                  {!isReducedMotion && (
                    <animate
                      attributeName="opacity"
                      values="0.30;0.65;0.30"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                  )}
                </path>

                {/* 2. Core bright orange line */}
                <path
                  d={route1D}
                  stroke="url(#routeGradOrange)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.95"
                />

                {/* 3. Glowing orange energy bead gliding along the trail */}
                {!isReducedMotion && (
                  <g>
                    <circle r="6" fill="#D88762" opacity="0.6" filter="url(#routeGlowOrange)">
                      <animateMotion
                        path={route1D}
                        dur="1.8s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle r="3" fill="#FFA67E" filter="url(#routeGlowOrange)">
                      <animateMotion
                        path={route1D}
                        dur="1.8s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
                )}

                {/* Anchor Reticles Route 1 */}
                <circle cx="280" cy="106" r="3.5" fill="#FFA67E" filter="url(#routeGlowOrange)" />
                <circle cx="350" cy="174" r="3.5" fill="#FFA67E" filter="url(#routeGlowOrange)" />

                {/* -----------------------------------------------------------
                    ROUTE 2: Station 02 (Build Engine) -> Station 03 (Production)
                    GLOWING SAGE GREEN ASCENDING THE HIGH SUMMIT PEAK
                    ----------------------------------------------------------- */}
                {/* 1. Deep ambient green glow aura */}
                <path
                  d={route2D}
                  stroke="#83B69A"
                  strokeWidth="7"
                  strokeLinecap="round"
                  opacity="0.4"
                  filter="url(#routeGlowGreen)"
                >
                  {!isReducedMotion && (
                    <animate
                      attributeName="opacity"
                      values="0.30;0.65;0.30"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                  )}
                </path>

                {/* 2. Core bright green line */}
                <path
                  d={route2D}
                  stroke="url(#routeGradGreen)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.95"
                />

                {/* 3. Glowing sage-green energy bead gliding along the trail */}
                {!isReducedMotion && (
                  <g>
                    <circle r="6" fill="#83B69A" opacity="0.6" filter="url(#routeGlowGreen)">
                      <animateMotion
                        path={route2D}
                        dur="1.8s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle r="3" fill="#B3EAD0" filter="url(#routeGlowGreen)">
                      <animateMotion
                        path={route2D}
                        dur="1.8s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
                )}

                {/* Anchor Reticles Route 2 */}
                <circle cx="407" cy="298" r="3.5" fill="#B3EAD0" filter="url(#routeGlowGreen)" />
                <circle cx="460" cy="344" r="3.5" fill="#B3EAD0" filter="url(#routeGlowGreen)" />
              </svg>

              {/* -------------------------------------------------------------
                  STATION 01 // SOURCE
                  Position: left 170px, top 12px, width 220px
                  Telemetry waypoint with origin commit & status
                  ------------------------------------------------------------- */}
              <div
                style={{
                  left: 170,
                  top: 12,
                  width: 220,
                  ...(isReducedMotion
                    ? {}
                    : !isRevealed
                    ? { opacity: 0, transform: "translateY(16px)" }
                    : {
                        animation: "heroFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
                        animationDelay: "0.55s",
                      }),
                }}
                className={`hero-fade-up absolute rounded-[8px] backdrop-blur-md p-3 transition-all duration-300 z-10 ${
                  activeStage === "source"
                    ? "bg-[#1B1917]/95 border-[1.5px] border-accent-orange ring-1 ring-accent-orange/50 shadow-[0_0_24px_rgba(216,135,98,0.32),0_6px_20px_rgba(0,0,0,0.6)]"
                    : "bg-[#141413]/90 border border-[#383834] hover:border-[#52524C] shadow-xl shadow-black/60"
                }`}
                aria-label="Station 01: Source"
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
                      SOURCE
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
                  STATION 02 // BUILD ENGINE
                  Position: left 280px, top 174px, width 254px
                  Core compilation station
                  ------------------------------------------------------------- */}
              <div
                style={{
                  left: 280,
                  top: 174,
                  width: 254,
                  ...(isReducedMotion
                    ? {}
                    : !isRevealed
                    ? { opacity: 0, transform: "translateY(16px)" }
                    : {
                        animation: "heroFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
                        animationDelay: "0.80s",
                      }),
                }}
                className={`hero-fade-up absolute rounded-[8px] backdrop-blur-md p-3.5 transition-all duration-300 z-10 ${
                  activeStage === "build"
                    ? "bg-[#1B1917]/95 border-[1.5px] border-accent-orange ring-1 ring-accent-orange/50 shadow-[0_0_28px_rgba(216,135,98,0.35),0_6px_20px_rgba(0,0,0,0.6)]"
                    : "bg-[#141413]/90 border border-[#383834] hover:border-[#52524C] shadow-xl shadow-black/60"
                }`}
                aria-label="Station 02: Build Engine"
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
                      BUILD ENGINE
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
                  STATION 03 // PRODUCTION (Summit Peak Destination)
                  Position: left 390px, top 344px, width 250px
                  Destination marker crowning the highest mountain peak
                  ------------------------------------------------------------- */}
              <div
                style={{
                  left: 390,
                  top: 344,
                  width: 250,
                  ...(isReducedMotion
                    ? {}
                    : !isRevealed
                    ? { opacity: 0, transform: "translateY(16px)" }
                    : {
                        animation: "heroFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
                        animationDelay: "1.05s",
                      }),
                }}
                className={`hero-fade-up absolute rounded-[8px] backdrop-blur-md p-3.5 transition-all duration-300 z-10 ${
                  activeStage === "production" || isProductionRunning
                    ? "bg-[#141B16]/95 border-[1.5px] border-semantic-success ring-1 ring-semantic-success/50 shadow-[0_0_28px_rgba(131,182,154,0.35),0_6px_20px_rgba(0,0,0,0.6)]"
                    : "bg-[#141413]/90 border border-[#383834] hover:border-[#52524C] shadow-xl shadow-black/60"
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
                      PRODUCTION
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

                {/* Station Footer: Summit Elevation & Health */}
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
