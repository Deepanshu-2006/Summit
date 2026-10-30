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
import { GitCommit, Check, Globe, ArrowUpRight } from "lucide-react";
import { ArchitecturalConstructionCanvas } from "./architectural-construction-canvas";

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
 * GettingStarted: The Architectural Construction Journey
 * "From first commit to a live product."
 *
 * Visual metaphor of a contemporary modern residence being built from scratch in a forest clearing:
 * - 01 / SOURCE: "It starts with a commit." (Site clearing & blueprint lines)
 * - 02 / BUILD: "The structure takes shape." (Foundation, steel columns, beams, timber framing)
 * - 03 / PRODUCTION: "From first commit to a live product." (Completed pavilion, glass walls, warm interior glow)
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
  const [manualState, setManualState] = useState<number | null>(null);

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
  }, []);

  // Synchronize with existing Lenis instance
  useLenis(() => {
    if (!isReducedMotion && manualState === null) {
      computeScrollProgress();
    }
  });

  // Native scroll fallback
  useEffect(() => {
    if (isReducedMotion) {
      setScrollProgress(1);
      return;
    }

    const onScroll = () => {
      if (manualState === null) computeScrollProgress();
    };
    const onResize = () => computeScrollProgress();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    const timer = setTimeout(computeScrollProgress, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [computeScrollProgress, isReducedMotion, manualState]);

  // Current effective progress (respecting manual state override for instant phase review)
  const effectiveProgress =
    manualState === 1
      ? 0.15
      : manualState === 2
      ? 0.52
      : manualState === 3
      ? 0.95
      : isReducedMotion
      ? 1.0
      : scrollProgress;

  // Active stage determination
  const currentStage =
    effectiveProgress >= 0.7
      ? 3
      : effectiveProgress >= 0.35
      ? 2
      : 1;

  // Milestone Opacity Calibrations
  const m1Opacity = isReducedMotion
    ? 1
    : currentStage === 1
    ? 1
    : 0;

  const m2Opacity = isReducedMotion
    ? 1
    : currentStage === 2
    ? 1
    : 0;

  const m3Opacity = isReducedMotion
    ? 1
    : currentStage === 3
    ? 1
    : 0;

  return (
    <section
      ref={sectionRef}
      id="getting-started"
      className="relative w-full h-[320vh] sm:h-[350vh] lg:h-[380vh] bg-[#0b0b0a] text-text-primary selection:bg-accent-orange/20 mb-[36vh] sm:mb-[44vh] lg:mb-[52vh]"
      aria-labelledby="getting-started-heading"
    >
      {/* =================================================================
          STICKY FULL-SCREEN ARCHITECTURAL VIEWPORT
          ================================================================= */}
      <div
        ref={stickyRef}
        className={
          isReducedMotion
            ? "relative w-full py-20 bg-[#0b0b0a]"
            : "sticky top-0 z-20 w-full h-screen overflow-hidden flex flex-col justify-between pt-[76px] pb-6 sm:pb-8 bg-[#0b0b0a] select-none"
        }
      >
        {/* Full-Bleed 3D WebGL Architectural Woodland Scene */}
        <ArchitecturalConstructionCanvas
          progress={effectiveProgress}
          isReducedMotion={isReducedMotion}
        />

        {/* Cinematic Vignette Overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-[1] bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(11,11,10,0.6)_85%,#0B0B0A_100%)]"
          aria-hidden="true"
        />

        {/* Ambient Top & Bottom Gradients */}
        <div
          className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-[#0b0b0a] via-[#0b0b0a]/70 to-transparent pointer-events-none z-[2]"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#0b0b0a] via-[#0b0b0a]/70 to-transparent pointer-events-none z-[2]"
          aria-hidden="true"
        />

        {/* Foreground Content Layer */}
        <div className="relative z-10 layout-container w-full flex-1 flex flex-col justify-between min-h-0 pointer-events-none">

          {/* =============================================================
              EDITORIAL INTRODUCTION & STAGE CONTROLLER
              ============================================================= */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 lg:gap-12 shrink-0 mb-3 pointer-events-auto">
            <div>
              <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
                <span className="font-mono text-[10.5px] sm:text-[11px] text-[#A8A49C] tracking-[0.16em] uppercase">
                  THE DEPLOYMENT JOURNEY · AN ARCHITECTURAL METAPHOR
                </span>
              </div>

              <h2
                id="getting-started-heading"
                className="font-sans text-[30px] sm:text-[38px] lg:text-[44px] font-medium leading-[1.08] tracking-[-0.035em] text-[#F2F0EB]"
              >
                From first commit<br className="hidden sm:inline" /> to production.
              </h2>
            </div>

            {/* Interactive Construction Phase Selector */}
            <div className="flex items-center gap-2 bg-[#141312]/85 backdrop-blur-md p-1.5 rounded-lg border border-[#22201D] font-mono text-[11px] shrink-0">
              <button
                type="button"
                onClick={() => setManualState(manualState === 1 ? null : 1)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                  currentStage === 1
                    ? "bg-accent-orange/15 text-accent-orange font-semibold border border-accent-orange/30"
                    : "text-[#8E8A82] hover:text-[#E8E6E1]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${currentStage === 1 ? "bg-accent-orange" : "bg-[#44413D]"}`} />
                <span>01 // SOURCE</span>
              </button>

              <button
                type="button"
                onClick={() => setManualState(manualState === 2 ? null : 2)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                  currentStage === 2
                    ? "bg-accent-orange/15 text-accent-orange font-semibold border border-accent-orange/30"
                    : "text-[#8E8A82] hover:text-[#E8E6E1]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${currentStage === 2 ? "bg-accent-orange" : "bg-[#44413D]"}`} />
                <span>02 // BUILD</span>
              </button>

              <button
                type="button"
                onClick={() => setManualState(manualState === 3 ? null : 3)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                  currentStage === 3
                    ? "bg-semantic-success/15 text-semantic-success font-semibold border border-semantic-success/30"
                    : "text-[#8E8A82] hover:text-[#E8E6E1]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${currentStage === 3 ? "bg-semantic-success" : "bg-[#44413D]"}`} />
                <span>03 // PRODUCTION</span>
              </button>
            </div>
          </div>

          {/* =============================================================
              THE THREE ARCHITECTURAL STAGES
              Minimal, restrained interface integrated into the clearing
              ============================================================= */}
          <div className="relative w-full flex-1 min-h-[340px] flex items-center justify-between">

            {/* ---------------------------------------------------------
                STAGE 01: SOURCE (Left, Clearing & Blueprint)
                --------------------------------------------------------- */}
            <div
              className="absolute left-0 bottom-4 sm:bottom-8 lg:bottom-12 max-w-[340px] sm:max-w-[380px] transition-all duration-500 ease-out pointer-events-auto"
              style={{
                opacity: m1Opacity,
                transform: `translateY(${(1 - m1Opacity) * 16}px)`,
                pointerEvents: m1Opacity > 0.5 ? "auto" : "none",
              }}
            >
              <div className="flex items-center gap-2 mb-2 font-mono text-[11px] text-accent-orange">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
                <span className="tracking-wider uppercase">01 / SOURCE</span>
              </div>

              <h3 className="font-sans text-[26px] sm:text-[30px] font-medium text-[#FAF8F5] leading-snug mb-1.5">
                It starts with a commit.
              </h3>
              <p className="font-sans text-[13.5px] sm:text-[14px] text-[#A8A49C] leading-relaxed mb-4">
                Commit verified · Source connected
              </p>

              <div className="px-3.5 py-2.5 rounded-lg bg-[#141312]/80 backdrop-blur-sm border border-[#22201D] font-mono text-[11.5px] flex items-center justify-between text-[#8E8A82]">
                <div className="flex items-center gap-2 text-[#FAF8F5]">
                  <GitCommit className="w-3.5 h-3.5 text-accent-orange" />
                  <span className="font-medium">meridian-studio</span>
                </div>
                <span className="text-accent-orange">commit 8f39a1c</span>
              </div>
            </div>

            {/* ---------------------------------------------------------
                STAGE 02: BUILD (Right, Foundation & Frame)
                --------------------------------------------------------- */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 max-w-[340px] sm:max-w-[380px] transition-all duration-500 ease-out pointer-events-auto"
              style={{
                opacity: m2Opacity,
                transform: `translateY(calc(-50% + ${(1 - m2Opacity) * 16}px))`,
                pointerEvents: m2Opacity > 0.5 ? "auto" : "none",
              }}
            >
              <div className="flex items-center gap-2 mb-2 font-mono text-[11px] text-accent-orange">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
                <span className="tracking-wider uppercase">02 / BUILD</span>
              </div>

              <h3 className="font-sans text-[26px] sm:text-[30px] font-medium text-[#FAF8F5] leading-snug mb-1.5">
                The structure takes shape.
              </h3>
              <p className="font-sans text-[13.5px] sm:text-[14px] text-[#A8A49C] leading-relaxed mb-4">
                Build verified · Ready to deploy
              </p>

              <div className="p-3 rounded-lg bg-[#141312]/80 backdrop-blur-sm border border-[#22201D] font-mono text-[11px] space-y-1.5">
                <div className="flex items-center justify-between text-[#E8E6E1]">
                  <span className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-semantic-success" />
                    Foundation cast
                  </span>
                  <span className="text-[#6E6A62]">concrete</span>
                </div>
                <div className="flex items-center justify-between text-[#E8E6E1]">
                  <span className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-semantic-success" />
                    Steel frame erected
                  </span>
                  <span className="text-[#6E6A62]">structural</span>
                </div>
                <div className="flex items-center justify-between text-semantic-success font-medium pt-1 border-t border-[#1F1D1B]">
                  <span className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-semantic-success" />
                    Build verified
                  </span>
                  <span className="text-accent-orange">ready</span>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------------
                STAGE 03: PRODUCTION (Left, Completed Modern Pavilion)
                --------------------------------------------------------- */}
            <div
              className="absolute left-0 top-16 sm:top-20 lg:top-24 max-w-[340px] sm:max-w-[400px] transition-all duration-500 ease-out pointer-events-auto"
              style={{
                opacity: m3Opacity,
                transform: `translateY(${(1 - m3Opacity) * 16}px)`,
                pointerEvents: m3Opacity > 0.5 ? "auto" : "none",
              }}
            >
              <div className="flex items-center gap-2 mb-2 font-mono text-[11px] text-semantic-success">
                <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                <span className="tracking-wider uppercase">03 / PRODUCTION</span>
              </div>

              <h3 className="font-sans text-[26px] sm:text-[30px] font-medium text-[#FAF8F5] leading-snug mb-1.5">
                From first commit to a live product.
              </h3>
              <p className="font-sans text-[13.5px] sm:text-[14px] text-[#A8A49C] leading-relaxed mb-4">
                Deployment successful · Live in production
              </p>

              <div className="p-3.5 rounded-lg bg-[#141312]/80 backdrop-blur-sm border border-[#22201D] font-mono text-[11.5px] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#FAF8F5]">
                    <Globe className="w-3.5 h-3.5 text-semantic-success" />
                    <span className="font-medium">meridian.jetway.app</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[10.5px] text-semantic-success">
                    <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                    Live
                  </span>
                </div>
                <div className="pt-1.5 border-t border-[#1F1D1B] flex items-center justify-between text-[11px]">
                  <span className="text-[#6E6A62]">Global Edge Anycast</span>
                  <Link
                    href="https://meridian.jetway.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#E8E6E1] hover:text-accent-orange transition-colors font-sans text-[11.5px]"
                  >
                    <span>Visit deploy</span>
                    <ArrowUpRight className="w-3 h-3 text-[#77746E]" />
                  </Link>
                </div>
              </div>
            </div>

          </div>

          {/* =============================================================
              LOWER TELEMETRY (Understated footer guide)
              ============================================================= */}
          <div className="pt-3 border-t border-[#1C1B19]/80 flex items-center justify-between text-[11px] font-mono text-[#77736C] shrink-0 pointer-events-auto">
            <div className="flex items-center gap-2">
              <span className="text-accent-orange">EXPLORATION:</span>
              <span>SCROLL OR SELECT STAGES TO WATCH THE ARCHITECTURAL TRANSFORMATION</span>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-[#8E8A82]">
              <span>SITE: NORDIC WOODLAND CLEARING</span>
              <span>STRUCTURE: MODERN TIMBER & CONCRETE PAVILION</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

export default GettingStarted;
