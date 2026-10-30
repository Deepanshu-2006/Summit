"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useLenis } from "@/components/layout/smooth-scroll-provider";
import {
  GitCommit,
  CheckCircle2,
  Globe,
  ShieldCheck,
  Cpu,
  Terminal,
  ExternalLink,
  Zap,
  Activity,
  Layers,
  ArrowRight,
} from "lucide-react";

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
 * GettingStarted: The Living Release Stream
 * "From first commit to first deploy."
 *
 * An authentic, tactile developer journey connecting:
 * - 01 Source: Origin Git commit node (main branch, GPG verified)
 * - 02 Build: Isolated Turbopack verification engine (modules, compilation, artifact hash)
 * - 03 Production: Living global Anycast edge endpoint (HTTP/3, SSL, multi-region routing)
 *
 * Driven 1:1 by Lenis smooth scroll progress with physical conduit data flow.
 */
export function GettingStarted() {
  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [activeStage, setActiveStage] = useState<number>(1);
  const activeStageRef = useRef<number>(1);

  // Smooth scroll progress calculation
  const computeScrollProgress = useCallback(() => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const scrollDistance = rect.height - vh;
    if (scrollDistance <= 0) return;

    const raw = -rect.top / scrollDistance;
    const clamped = Math.max(0, Math.min(1, raw));
    setScrollProgress(clamped);

    // Hysteresis deadband for stable 3-stage progression without boundary flicker
    let stage = activeStageRef.current;
    if (clamped < 0.35) {
      if (stage !== 1 && clamped <= 0.32) stage = 1;
      else if (stage === 1) stage = 1;
    } else if (clamped < 0.68) {
      if (stage === 1 && clamped >= 0.38) stage = 2;
      else if (stage === 3 && clamped <= 0.64) stage = 2;
      else if (stage === 2) stage = 2;
    } else {
      if (stage !== 3 && clamped >= 0.70) stage = 3;
    }

    if (stage !== activeStageRef.current) {
      activeStageRef.current = stage;
      setActiveStage(stage);
    }
  }, []);

  // Synchronize with existing Lenis instance
  useLenis(() => {
    if (!isReducedMotion) {
      computeScrollProgress();
    }
  });

  // Native scroll and resize listeners fallback
  useEffect(() => {
    if (isReducedMotion) {
      setActiveStage(3);
      setScrollProgress(1);
      return;
    }

    const onScroll = () => computeScrollProgress();
    const onResize = () => computeScrollProgress();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    const timer = setTimeout(computeScrollProgress, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [computeScrollProgress, isReducedMotion]);

  // Derived sub-progress for conduit flow
  // Conduit 1 (Source -> Build): runs over progress 0.10 to 0.45
  const conduit1Progress = Math.max(0, Math.min(1, (scrollProgress - 0.10) / 0.35));
  // Conduit 2 (Build -> Production): runs over progress 0.48 to 0.82
  const conduit2Progress = Math.max(0, Math.min(1, (scrollProgress - 0.48) / 0.34));

  // Build verification step thresholds
  const buildStep1 = isReducedMotion || scrollProgress >= 0.38;
  const buildStep2 = isReducedMotion || scrollProgress >= 0.50;
  const buildStep3 = isReducedMotion || scrollProgress >= 0.62;

  // Edge latency live pings
  const edgeLive = isReducedMotion || scrollProgress >= 0.75;

  return (
    <section
      ref={sectionRef}
      id="getting-started"
      className="relative w-full h-[260vh] sm:h-[280vh] lg:h-[300vh] bg-transparent text-text-primary selection:bg-accent-orange/20 mb-[36vh] sm:mb-[44vh] lg:mb-[52vh]"
      aria-labelledby="getting-started-heading"
    >
      {/* =================================================================
          STICKY VIEWPORT CONTAINER
          Pins during the 3-stage release stream journey.
          ================================================================= */}
      <div
        ref={stickyRef}
        className={
          isReducedMotion
            ? "relative w-full py-20"
            : "sticky top-0 z-20 w-full h-screen overflow-hidden flex flex-col justify-between pt-[76px] pb-6 sm:pb-8 bg-transparent select-none"
        }
      >
        <div className="layout-container w-full flex-1 flex flex-col justify-between min-h-0 select-text">

          {/* =============================================================
              EDITORIAL INTRODUCTION
              Restrained, confident typographic introduction
              ============================================================= */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 lg:gap-12 shrink-0 mb-4 sm:mb-6">
            <div>
              {/* Subtle Section Identifier */}
              <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
                <span className="font-mono text-[10.5px] sm:text-[11px] text-[#A8A49C] tracking-[0.16em] uppercase">
                  THE DEPLOYMENT JOURNEY · CONTINUOUS EDGE DELIVERY
                </span>
              </div>

              {/* Heading */}
              <h2
                id="getting-started-heading"
                className="font-sans text-[30px] sm:text-[38px] lg:text-[44px] font-medium leading-[1.08] tracking-[-0.035em] text-[#F2F0EB]"
              >
                From first commit<br className="hidden sm:inline" /> to first deploy.
              </h2>
            </div>

            {/* Supporting Copy */}
            <p className="font-sans text-[13px] sm:text-[14px] text-[#8E8A82] leading-[1.6] max-w-[430px] pb-0.5 shrink-0">
              Push your code to Git. Summit automatically detects your framework,
              executes an isolated containerized build, and routes traffic across our
              global Anycast network in seconds.
            </p>
          </div>

          {/* =============================================================
              STAGE PROGRESSION RAIL (Top Interactive Indicator)
              Tracks the continuous journey across Source → Build → Production
              ============================================================= */}
          <div className="relative w-full mb-4 sm:mb-6 shrink-0 border-b border-[#22201D] pb-3">
            <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-4xl mx-auto">
              {/* Tab 01: Source */}
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    activeStage >= 1
                      ? "bg-accent-orange shadow-[0_0_8px_rgba(216,135,98,0.6)]"
                      : "bg-[#33312E]"
                  }`}
                />
                <span
                  className={`font-mono text-[11px] sm:text-[12px] tracking-wider transition-colors duration-300 ${
                    activeStage === 1
                      ? "text-accent-orange font-semibold"
                      : activeStage > 1
                      ? "text-[#8E8A82]"
                      : "text-[#55524E]"
                  }`}
                >
                  01 // SOURCE
                </span>
              </div>

              {/* Tab 02: Build */}
              <div className="flex items-center gap-2 justify-center">
                <span
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    activeStage >= 2
                      ? "bg-accent-orange shadow-[0_0_8px_rgba(216,135,98,0.6)]"
                      : "bg-[#33312E]"
                  }`}
                />
                <span
                  className={`font-mono text-[11px] sm:text-[12px] tracking-wider transition-colors duration-300 ${
                    activeStage === 2
                      ? "text-accent-orange font-semibold"
                      : activeStage > 2
                      ? "text-[#8E8A82]"
                      : "text-[#55524E]"
                  }`}
                >
                  02 // BUILD
                </span>
              </div>

              {/* Tab 03: Production */}
              <div className="flex items-center gap-2 justify-end">
                <span
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    activeStage === 3
                      ? "bg-semantic-success shadow-[0_0_8px_rgba(130,184,157,0.7)]"
                      : "bg-[#33312E]"
                  }`}
                />
                <span
                  className={`font-mono text-[11px] sm:text-[12px] tracking-wider transition-colors duration-300 ${
                    activeStage === 3
                      ? "text-semantic-success font-semibold"
                      : "text-[#55524E]"
                  }`}
                >
                  03 // PRODUCTION
                </span>
              </div>
            </div>

            {/* Traveling Progress Line on Rail */}
            <div className="absolute bottom-[-1px] left-0 right-0 h-[1.5px] bg-[#1A1917] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-orange via-accent-orange to-semantic-success transition-all duration-150 ease-out"
                style={{
                  width: `${(scrollProgress * 100).toFixed(1)}%`,
                }}
              />
            </div>
          </div>

          {/* =============================================================
              MAIN KINETIC STAGE: THE LIVING RELEASE STREAM
              Horizontal 3-Station Architectural Pipeline with Fluid Conduits
              ============================================================= */}
          <div className="relative w-full flex-1 min-h-[380px] sm:min-h-[420px] lg:min-h-[440px] flex items-center">

            {/* -----------------------------------------------------------
                DESKTOP PIPELINE VIEW (LG:FLEX)
                ----------------------------------------------------------- */}
            <div className="hidden lg:grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-0 w-full h-full">

              {/* =========================================================
                  STATION 01: SOURCE (Origin Git Commit Node)
                  ========================================================= */}
              <div
                className={`relative p-5 xl:p-6 rounded-xl border transition-all duration-500 ${
                  activeStage === 1
                    ? "bg-[#111110]/95 border-accent-orange/60 shadow-[0_12px_40px_rgba(0,0,0,0.8)] scale-[1.01]"
                    : "bg-[#0E0E0D]/60 border-[#22201D] opacity-45 scale-[0.99]"
                }`}
              >
                {/* Station Tag & Status */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#22201D]">
                  <div className="flex items-center gap-2">
                    <GitCommit className={`w-4 h-4 ${activeStage === 1 ? "text-accent-orange" : "text-[#77746E]"}`} />
                    <span className="font-mono text-[11px] font-medium tracking-wider text-[#E8E6E1]">
                      GIT REPOSITORY
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] bg-accent-orange/10 text-accent-orange border border-accent-orange/20">
                    PUSH TRIGGERED
                  </span>
                </div>

                {/* Commit Payload Metadata */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] font-semibold text-[#FAF8F5] bg-[#1A1918] px-2 py-0.5 rounded border border-[#2D2A27]">
                      commit 8f39a1c
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-semantic-success">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      GPG Verified
                    </span>
                  </div>

                  <p className="font-sans text-[14px] text-[#FAF8F5] font-medium leading-snug">
                    feat(api): optimize edge cache resolution
                  </p>

                  <div className="flex items-center gap-3 pt-1 text-[11.5px] font-mono text-[#8E8A82]">
                    <span className="text-accent-orange">main</span>
                    <span>→</span>
                    <span>origin/main</span>
                    <span className="text-[#55524D]">·</span>
                    <span>14 files</span>
                  </div>
                </div>

                {/* Lower Hardware Origin Telemetry */}
                <div className="mt-4 pt-3 border-t border-[#1F1D1B] flex items-center justify-between text-[10.5px] font-mono text-[#6E6A62]">
                  <span>TRIGGER: GitHub Webhook</span>
                  <span>TIME: 0.04s</span>
                </div>
              </div>

              {/* =========================================================
                  CONDUIT 1 → 2: BUS CONDUIT FROM SOURCE TO BUILD
                  ========================================================= */}
              <div className="relative w-12 xl:w-16 h-12 flex items-center justify-center">
                {/* Background Rail */}
                <div className="w-full h-[2px] bg-[#22201D]" />

                {/* Animated Flowing Line */}
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-accent-orange transition-all duration-100 ease-out"
                  style={{
                    width: `${(conduit1Progress * 100).toFixed(0)}%`,
                  }}
                />

                {/* Flowing Data Photon */}
                {conduit1Progress > 0 && conduit1Progress < 1 && (
                  <span
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent-orange shadow-[0_0_8px_#D88762]"
                    style={{
                      left: `calc(${(conduit1Progress * 100).toFixed(0)}% - 4px)`,
                    }}
                  />
                )}
              </div>

              {/* =========================================================
                  STATION 02: BUILD (Turbopack Verification Engine)
                  ========================================================= */}
              <div
                className={`relative p-5 xl:p-6 rounded-xl border transition-all duration-500 ${
                  activeStage === 2
                    ? "bg-[#111110]/95 border-accent-orange/60 shadow-[0_12px_40px_rgba(0,0,0,0.8)] scale-[1.01]"
                    : "bg-[#0E0E0D]/60 border-[#22201D] opacity-45 scale-[0.99]"
                }`}
              >
                {/* Station Tag & Engine Status */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#22201D]">
                  <div className="flex items-center gap-2">
                    <Cpu className={`w-4 h-4 ${activeStage === 2 ? "text-accent-orange" : "text-[#77746E]"}`} />
                    <span className="font-mono text-[11px] font-medium tracking-wider text-[#E8E6E1]">
                      ISOLATED RUNTIME
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] transition-colors duration-300 ${
                      buildStep3
                        ? "bg-semantic-success/15 text-semantic-success border border-semantic-success/30"
                        : "bg-accent-orange/10 text-accent-orange border border-accent-orange/20"
                    }`}
                  >
                    {buildStep3 ? "BUILD VERIFIED ✓" : "TURBOPACK 16.4"}
                  </span>
                </div>

                {/* Three Real Verification Passes */}
                <div className="space-y-2.5 font-mono text-[12px]">
                  {/* Step 1: Dependencies */}
                  <div className="flex items-center justify-between p-2 rounded bg-[#161514] border border-[#23211F]">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${buildStep1 ? "bg-semantic-success" : "bg-[#44413D]"}`} />
                      <span className={buildStep1 ? "text-[#E8E6E1]" : "text-[#77746E]"}>
                        pnpm-lock resolved
                      </span>
                    </div>
                    <span className="text-[10.5px] text-[#6E6A62]">
                      {buildStep1 ? "142 modules · 118ms" : "pending"}
                    </span>
                  </div>

                  {/* Step 2: TypeScript & Next.js Engine */}
                  <div className="flex items-center justify-between p-2 rounded bg-[#161514] border border-[#23211F]">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${buildStep2 ? "bg-semantic-success" : "bg-[#44413D]"}`} />
                      <span className={buildStep2 ? "text-[#E8E6E1]" : "text-[#77746E]"}>
                        App Router compilation
                      </span>
                    </div>
                    <span className="text-[10.5px] text-[#6E6A62]">
                      {buildStep2 ? "0 errors · 384ms" : "waiting"}
                    </span>
                  </div>

                  {/* Step 3: Bundle Artifact Optimization */}
                  <div className="flex items-center justify-between p-2 rounded bg-[#161514] border border-[#23211F]">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${buildStep3 ? "bg-semantic-success" : "bg-[#44413D]"}`} />
                      <span className={buildStep3 ? "text-[#E8E6E1]" : "text-[#77746E]"}>
                        Optimized bundle output
                      </span>
                    </div>
                    <span className="text-[10.5px] text-accent-orange font-medium">
                      {buildStep3 ? "142.4 kB gzip" : "queued"}
                    </span>
                  </div>
                </div>

                {/* Lower Artifact Hash Telemetry */}
                <div className="mt-4 pt-3 border-t border-[#1F1D1B] flex items-center justify-between text-[10.5px] font-mono text-[#6E6A62]">
                  <span>SHA256: 7e4b9c1d</span>
                  <span>TOTAL: 0.58s</span>
                </div>
              </div>

              {/* =========================================================
                  CONDUIT 2 → 3: BUS CONDUIT FROM BUILD TO PRODUCTION
                  ========================================================= */}
              <div className="relative w-12 xl:w-16 h-12 flex items-center justify-center">
                {/* Background Rail */}
                <div className="w-full h-[2px] bg-[#22201D]" />

                {/* Animated Flowing Line with Gradient Shift to Green */}
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-gradient-to-r from-accent-orange to-semantic-success transition-all duration-100 ease-out"
                  style={{
                    width: `${(conduit2Progress * 100).toFixed(0)}%`,
                  }}
                />

                {/* Flowing Data Photon */}
                {conduit2Progress > 0 && conduit2Progress < 1 && (
                  <span
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-semantic-success shadow-[0_0_8px_#82B89D]"
                    style={{
                      left: `calc(${(conduit2Progress * 100).toFixed(0)}% - 4px)`,
                    }}
                  />
                )}
              </div>

              {/* =========================================================
                  STATION 03: PRODUCTION (Living Global Edge Endpoint)
                  ========================================================= */}
              <div
                className={`relative p-5 xl:p-6 rounded-xl border transition-all duration-500 ${
                  activeStage === 3
                    ? "bg-[#111110]/95 border-semantic-success/60 shadow-[0_12px_40px_rgba(0,0,0,0.8)] scale-[1.01]"
                    : "bg-[#0E0E0D]/60 border-[#22201D] opacity-45 scale-[0.99]"
                }`}
              >
                {/* Station Tag & Live Status */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#22201D]">
                  <div className="flex items-center gap-2">
                    <Globe className={`w-4 h-4 ${activeStage === 3 ? "text-semantic-success" : "text-[#77746E]"}`} />
                    <span className="font-mono text-[11px] font-medium tracking-wider text-[#E8E6E1]">
                      GLOBAL EDGE RUNTIME
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[10px] bg-semantic-success/15 text-semantic-success border border-semantic-success/30">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className={`absolute inline-flex h-full w-full rounded-full bg-semantic-success opacity-75 ${activeStage === 3 ? "animate-ping" : "opacity-0"}`} />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-semantic-success" />
                    </span>
                    HTTP 200 · LIVE
                  </span>
                </div>

                {/* Live Production URL Bar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#161514] border border-[#2D2A27]">
                    <div className="flex items-center gap-2 min-w-0">
                      <ShieldCheck className="w-3.5 h-3.5 text-semantic-success shrink-0" />
                      <span className="font-mono text-[12.5px] font-medium text-[#FAF8F5] truncate">
                        meridian.jetway.app
                      </span>
                    </div>
                    <span className="font-mono text-[10.5px] text-[#8E8A82] shrink-0 bg-[#22201E] px-1.5 py-0.5 rounded">
                      Edge Anycast
                    </span>
                  </div>

                  {/* Planetary Edge Node Latency Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center font-mono">
                    <div className="p-1.5 rounded bg-[#161514] border border-[#201F1D]">
                      <div className="text-[9.5px] text-[#6E6A62]">SFO</div>
                      <div className={`text-[12px] font-medium ${edgeLive ? "text-semantic-success" : "text-[#6E6A62]"}`}>
                        9ms
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-[#161514] border border-[#201F1D]">
                      <div className="text-[9.5px] text-[#6E6A62]">FRA</div>
                      <div className={`text-[12px] font-medium ${edgeLive ? "text-semantic-success" : "text-[#6E6A62]"}`}>
                        18ms
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-[#161514] border border-[#201F1D]">
                      <div className="text-[9.5px] text-[#6E6A62]">NRT</div>
                      <div className={`text-[12px] font-medium ${edgeLive ? "text-semantic-success" : "text-[#6E6A62]"}`}>
                        12ms
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lower Network Telemetry */}
                <div className="mt-4 pt-3 border-t border-[#1F1D1B] flex items-center justify-between text-[10.5px] font-mono text-[#6E6A62]">
                  <span>PROTOCOL: HTTP/3 TLS 1.3</span>
                  <span className="text-semantic-success font-medium">99.4% HIT</span>
                </div>
              </div>
            </div>

            {/* -----------------------------------------------------------
                MOBILE ADAPTIVE VERTICAL VIEW (LG:HIDDEN)
                Tactile sequential console stack
                ----------------------------------------------------------- */}
            <div className="lg:hidden w-full space-y-3.5 py-2">
              {/* Mobile Station 01: Source */}
              <div
                className={`p-4 rounded-xl border transition-all duration-300 ${
                  activeStage === 1
                    ? "bg-[#111110] border-accent-orange/70 shadow-lg"
                    : "bg-[#0E0E0D]/60 border-[#22201D] opacity-40"
                }`}
              >
                <div className="flex items-center justify-between text-[10.5px] font-mono mb-2">
                  <span className="text-accent-orange font-semibold">01 // SOURCE</span>
                  <span className="text-[#8E8A82]">commit 8f39a1c</span>
                </div>
                <h4 className="font-sans text-[15px] font-medium text-[#FAF8F5]">
                  Code committed.
                </h4>
                <p className="font-mono text-[11px] text-[#8E8A82] mt-1">
                  main branch · GPG verified push
                </p>
              </div>

              {/* Mobile Station 02: Build */}
              <div
                className={`p-4 rounded-xl border transition-all duration-300 ${
                  activeStage === 2
                    ? "bg-[#111110] border-accent-orange/70 shadow-lg"
                    : "bg-[#0E0E0D]/60 border-[#22201D] opacity-40"
                }`}
              >
                <div className="flex items-center justify-between text-[10.5px] font-mono mb-2">
                  <span className="text-accent-orange font-semibold">02 // BUILD</span>
                  <span className="text-semantic-success font-medium">Verified ✓</span>
                </div>
                <h4 className="font-sans text-[15px] font-medium text-[#FAF8F5]">
                  Build verified.
                </h4>
                <p className="font-mono text-[11px] text-[#8E8A82] mt-1">
                  Turbopack 16.4 · 142.4 kB standalone bundle
                </p>
              </div>

              {/* Mobile Station 03: Production */}
              <div
                className={`p-4 rounded-xl border transition-all duration-300 ${
                  activeStage === 3
                    ? "bg-[#111110] border-semantic-success/70 shadow-lg"
                    : "bg-[#0E0E0D]/60 border-[#22201D] opacity-40"
                }`}
              >
                <div className="flex items-center justify-between text-[10.5px] font-mono mb-2">
                  <span className="text-semantic-success font-semibold">03 // PRODUCTION</span>
                  <span className="text-semantic-success">● HTTP 200</span>
                </div>
                <h4 className="font-sans text-[15px] font-medium text-[#FAF8F5]">
                  Live in production.
                </h4>
                <p className="font-mono text-[11px] text-semantic-success mt-1">
                  meridian.jetway.app · 14ms Anycast Edge
                </p>
              </div>
            </div>

          </div>

          {/* =============================================================
              LOWER TELEMETRY TICKER
              Subtle, tactile engineering heartbeat running below the stream
              ============================================================= */}
          <div className="mt-3 pt-3 border-t border-[#1C1B19] flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-[#77736C]">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-accent-orange">
                <Zap className="w-3.5 h-3.5" />
                <span>CONTINUOUS DEPLOYMENT ENGINE</span>
              </span>
              <span className="text-[#3A3834] hidden sm:inline">|</span>
              <span className="hidden sm:inline text-[#8E8A82]">
                AUTOMATED ZERO-DOWNTIME ROLLOUTS
              </span>
            </div>

            <div className="flex items-center gap-4 text-[#8E8A82]">
              <span>AVERAGE CYCLE: 4.8s</span>
              <span>ISOLATION: MicroVM (gVisor)</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

export default GettingStarted;
