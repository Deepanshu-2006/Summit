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
import { ConstructionEditorialHeadlines } from "./construction-editorial-headlines";

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

  const lenis = useLenis();
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const [currentStage, setCurrentStage] = useState<number>(1);
  const currentStageRef = useRef<number>(1);

  // Synchronize stage indicator with scroll progress (avoids 60fps React re-renders)
  const updateStageFromScroll = useCallback(() => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const scrollDistance = rect.height - vh;
    if (scrollDistance <= 0) return;

    const raw = -rect.top / scrollDistance;
    const clamped = Math.max(0, Math.min(1, raw));
    const newStage = clamped >= 0.60 ? 3 : clamped >= 0.20 ? 2 : 1;

    if (newStage !== currentStageRef.current) {
      currentStageRef.current = newStage;
      setCurrentStage(newStage);
    }
  }, []);

  // Synchronize with existing Lenis instance
  useLenis(() => {
    updateStageFromScroll();
  });

  // Native scroll fallback & initial measurement
  useEffect(() => {
    const onScroll = () => updateStageFromScroll();
    const onResize = () => updateStageFromScroll();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    updateStageFromScroll();
    const timer = setTimeout(updateStageFromScroll, 60);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [updateStageFromScroll]);

  // Smooth navigation to stage on click via Lenis
  const scrollToStage = (stage: number) => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const vh = window.innerHeight;
    const scrollDistance = rect.height - vh;
    if (scrollDistance <= 0) return;

    // Target positions: 0.05 for Source, 0.38 for Build, 0.92 for Production
    const targetProgress = stage === 1 ? 0.05 : stage === 2 ? 0.38 : 0.92;
    const targetScrollY = rect.top + scrollY + targetProgress * scrollDistance;

    if (lenis) {
      lenis.scrollTo(targetScrollY, {
        duration: isReducedMotion ? 0 : 1.2,
        immediate: isReducedMotion,
      });
    } else {
      window.scrollTo({
        top: targetScrollY,
        behavior: isReducedMotion ? "instant" : "smooth",
      });
    }
  };

  return (
    <section
      ref={sectionRef}
      id="getting-started"
      className="relative w-full h-[320vh] sm:h-[350vh] lg:h-[380vh] bg-[#0b0b0a] text-text-primary selection:bg-accent-orange/20 mt-[42vh] sm:mt-[52vh] lg:mt-[60vh] mb-[8vh] sm:mb-[10vh] lg:mb-[12vh]"
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
          isReducedMotion={isReducedMotion}
        />

        {/* Minimal Editorial Construction Headlines */}
        <ConstructionEditorialHeadlines
          sectionRef={sectionRef}
          currentStage={currentStage}
          isReducedMotion={isReducedMotion}
        />

        {/* =============================================================
            MINIMAL, RESTRAINED STAGE INDICATOR
            Positioned cleanly within the viewport so architecture remains hero
            ============================================================= */}
        <div className="absolute bottom-7 left-6 sm:bottom-9 sm:left-12 z-10 select-none">
          <div className="flex items-center gap-4 sm:gap-6 font-mono text-[11px] sm:text-[11.5px] tracking-[0.14em] px-3.5 py-2 rounded-full bg-[#111315]/80 backdrop-blur-md border border-white/[0.06] shadow-lg shadow-black/40">
            <button
              type="button"
              onClick={() => scrollToStage(1)}
              className={`flex items-center gap-2 transition-colors duration-300 ${
                currentStage === 1
                  ? "text-accent-orange font-medium"
                  : "text-[#726E67] hover:text-[#B8B4AC]"
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
              <span>01 / SOURCE</span>
            </button>

            <span className="text-[#33312E]">·</span>

            <button
              type="button"
              onClick={() => scrollToStage(2)}
              className={`flex items-center gap-2 transition-colors duration-300 ${
                currentStage === 2
                  ? "text-accent-orange font-medium"
                  : "text-[#726E67] hover:text-[#B8B4AC]"
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
              <span>02 / BUILD</span>
            </button>

            <span className="text-[#33312E]">·</span>

            <button
              type="button"
              onClick={() => scrollToStage(3)}
              className={`flex items-center gap-2 transition-colors duration-300 ${
                currentStage === 3
                  ? "text-semantic-success font-medium"
                  : "text-[#726E67] hover:text-[#B8B4AC]"
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
              <span>03 / PRODUCTION</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default GettingStarted;
