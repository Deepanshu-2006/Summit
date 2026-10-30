"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
} from "react";
import { useLenis } from "@/components/layout/smooth-scroll-provider";
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
 * Tells the story of an application going from its first commit to production
 * through the visual metaphor of a modern architectural bungalow being built in a woodland clearing.
 *
 * Minimalist UI:
 * Pure architectural 3D focus with a clean, restrained stage indicator:
 * - 01 SOURCE
 * - 02 BUILD
 * - 03 PRODUCTION
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
    if (!isReducedMotion) {
      computeScrollProgress();
    }
  });

  // Native scroll fallback
  useEffect(() => {
    if (isReducedMotion) {
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

  // Current effective progress
  const effectiveProgress = isReducedMotion ? 1.0 : scrollProgress;

  // Active stage determination
  const currentStage =
    effectiveProgress >= 0.72
      ? 3
      : effectiveProgress >= 0.34
      ? 2
      : 1;

  // Smooth navigation to stage on click
  const scrollToStage = (stage: number) => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const vh = window.innerHeight;
    const scrollDistance = rect.height - vh;
    if (scrollDistance <= 0) return;

    const targetProgress = stage === 1 ? 0.08 : stage === 2 ? 0.52 : 0.95;
    const targetScrollY = rect.top + scrollY + targetProgress * scrollDistance;
    window.scrollTo({ top: targetScrollY, behavior: "smooth" });
  };

  return (
    <section
      ref={sectionRef}
      id="getting-started"
      className="relative w-full h-[320vh] sm:h-[350vh] lg:h-[380vh] bg-[#0b0b0a] text-text-primary selection:bg-accent-orange/20 mb-[24vh] sm:mb-[32vh] lg:mb-[40vh]"
      aria-label="Architectural construction journey from commit to production"
    >
      {/* =================================================================
          STICKY FULL-SCREEN ARCHITECTURAL VIEWPORT
          ================================================================= */}
      <div
        ref={stickyRef}
        className={
          isReducedMotion
            ? "relative w-full h-screen bg-[#0b0b0a]"
            : "sticky top-0 z-20 w-full h-screen overflow-hidden flex flex-col justify-between bg-[#0b0b0a] select-none"
        }
      >
        {/* Full-Bleed 3D WebGL Architectural Woodland Scene */}
        <ArchitecturalConstructionCanvas
          progress={effectiveProgress}
          isReducedMotion={isReducedMotion}
        />

        {/* Subtle Cinematic Vignette Overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-[1] bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(11,11,10,0.5)_85%,#0B0B0A_100%)]"
          aria-hidden="true"
        />

        {/* Ambient Top & Bottom Edge Blends */}
        <div
          className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#0b0b0a] via-[#0b0b0a]/60 to-transparent pointer-events-none z-[2]"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0b0b0a] via-[#0b0b0a]/60 to-transparent pointer-events-none z-[2]"
          aria-hidden="true"
        />

        {/* =============================================================
            MINIMAL, RESTRAINED STAGE INDICATOR
            Positioned cleanly within the viewport so architecture remains hero
            ============================================================= */}
        <div className="absolute bottom-8 left-8 sm:left-12 z-10 select-none">
          <div className="flex items-center gap-5 sm:gap-7 font-mono text-[11px] sm:text-[11.5px] tracking-[0.14em]">
            <button
              type="button"
              onClick={() => scrollToStage(1)}
              className={`flex items-center gap-2 transition-colors duration-300 ${
                currentStage === 1
                  ? "text-accent-orange font-medium"
                  : "text-[#625E57] hover:text-[#A8A49C]"
              }`}
              aria-label="Stage 1: Source"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  currentStage === 1
                    ? "bg-accent-orange shadow-[0_0_8px_rgba(216,135,98,0.8)] scale-110"
                    : "bg-[#33312E]"
                }`}
              />
              <span>01 SOURCE</span>
            </button>

            <span className="text-[#2C2926]">/</span>

            <button
              type="button"
              onClick={() => scrollToStage(2)}
              className={`flex items-center gap-2 transition-colors duration-300 ${
                currentStage === 2
                  ? "text-accent-orange font-medium"
                  : "text-[#625E57] hover:text-[#A8A49C]"
              }`}
              aria-label="Stage 2: Build"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  currentStage === 2
                    ? "bg-accent-orange shadow-[0_0_8px_rgba(216,135,98,0.8)] scale-110"
                    : "bg-[#33312E]"
                }`}
              />
              <span>02 BUILD</span>
            </button>

            <span className="text-[#2C2926]">/</span>

            <button
              type="button"
              onClick={() => scrollToStage(3)}
              className={`flex items-center gap-2 transition-colors duration-300 ${
                currentStage === 3
                  ? "text-semantic-success font-medium"
                  : "text-[#625E57] hover:text-[#A8A49C]"
              }`}
              aria-label="Stage 3: Production"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  currentStage === 3
                    ? "bg-semantic-success shadow-[0_0_8px_rgba(130,184,157,0.8)] scale-110"
                    : "bg-[#33312E]"
                }`}
              />
              <span>03 PRODUCTION</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default GettingStarted;
