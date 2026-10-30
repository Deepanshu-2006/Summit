"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useSyncExternalStore,
} from "react";
import { useLenis } from "@/components/layout/smooth-scroll-provider";
import { ArchitecturalConstructionCanvas } from "./architectural-construction-canvas";
import { ConstructionEditorialHeadlines } from "./construction-editorial-headlines";
import { WorldPortalTransition } from "./world-portal-transition";

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
 * GettingStarted: Section 06 — Architectural Modern Bungalow Construction Journey
 *
 * Cinematic scroll-driven bungalow construction experience telling the story of:
 * SOURCE → BUILD → PRODUCTION
 *
 * Performance Architecture (Zero-Layout-Thrashing with Lenis):
 * - Caches geometric section offsets once on mount/resize to prevent forced synchronous reflows.
 * - Subscribes directly to Lenis's sub-pixel float coordinates (60/120Hz lock).
 * - React re-renders strictly occur only on stage transitions (1 -> 2 -> 3).
 * - WebGL and DOM transforms run on dedicated GPU compositor layers.
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
  const indicatorRef = useRef<HTMLDivElement>(null);
  const [currentStage, setCurrentStage] = useState<number>(1);
  const currentStageRef = useRef<number>(1);

  // Cached geometry to eliminate getBoundingClientRect layout thrashing during scroll
  const geoRef = useRef({
    sectionTop: 0,
    scrollDistance: 1,
  });

  const measure = useCallback(() => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    geoRef.current = {
      sectionTop: rect.top + window.scrollY,
      scrollDistance: Math.max(1, rect.height - vh),
    };
  }, []);

  // Synchronize stage indicator with scroll progress (Zero DOM reads on tick)
  const updateStageFromScroll = useCallback(
    (scrollY: number) => {
      const { sectionTop, scrollDistance } = geoRef.current;
      const currentProgress = (scrollY - sectionTop) / scrollDistance;
      const newStage = currentProgress >= 0.60 ? 3 : currentProgress >= 0.20 ? 2 : 1;

      if (newStage !== currentStageRef.current) {
        currentStageRef.current = newStage;
        setCurrentStage(newStage);
      }

      // Fade in indicator only after breaking through the mist into Stage 1 SOURCE
      if (indicatorRef.current && !isReducedMotion) {
        if (currentProgress <= 0.01) {
          indicatorRef.current.style.opacity = "0";
          indicatorRef.current.style.pointerEvents = "none";
        } else if (currentProgress < 0.06) {
          const t = (currentProgress - 0.01) / 0.05;
          const s = t * t * (3 - 2 * t);
          indicatorRef.current.style.opacity = s.toFixed(3);
          indicatorRef.current.style.pointerEvents = s > 0.5 ? "auto" : "none";
        } else {
          indicatorRef.current.style.opacity = "1";
          indicatorRef.current.style.pointerEvents = "auto";
        }
      }
    },
    [isReducedMotion]
  );

  // Synchronize with existing Lenis instance on sub-pixel ticks
  useLenis((lenisInstance) => {
    updateStageFromScroll(lenisInstance.scroll);
  });

  // Native scroll fallback & initial measurement
  useEffect(() => {
    const onScroll = () => updateStageFromScroll(window.scrollY);
    const onResize = () => {
      measure();
      updateStageFromScroll(window.scrollY);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    measure();
    updateStageFromScroll(window.scrollY);
    const timer = setTimeout(() => {
      measure();
      updateStageFromScroll(window.scrollY);
    }, 100);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [measure, updateStageFromScroll]);

  // Smooth navigation to stage on click via Lenis
  const scrollToStage = (stage: number) => {
    const { sectionTop, scrollDistance } = geoRef.current;
    if (scrollDistance <= 0) return;

    // Target positions: 0.05 for Source, 0.38 for Build, 0.92 for Production
    const targetProgress = stage === 1 ? 0.05 : stage === 2 ? 0.38 : 0.92;
    const targetScrollY = sectionTop + targetProgress * scrollDistance;

    if (lenis) {
      lenis.scrollTo(targetScrollY, {
        duration: isReducedMotion ? 0 : 1.1,
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
      className="relative w-full h-[320vh] sm:h-[350vh] lg:h-[380vh] bg-transparent text-text-primary selection:bg-accent-orange/20 mt-[16vh] sm:mt-[20vh] lg:mt-[24vh] mb-[8vh] sm:mb-[10vh] lg:mb-[12vh]"
      aria-label="Architectural construction journey from commit to production"
    >
      {/* =================================================================
          STICKY FULL-SCREEN ARCHITECTURAL VIEWPORT & WORLD PORTAL GATEWAY
          ================================================================= */}
      <div
        ref={stickyRef}
        className={
          isReducedMotion
            ? "relative w-full h-screen bg-transparent"
            : "sticky top-0 z-20 w-full h-screen overflow-hidden flex flex-col justify-between bg-transparent select-none transform-gpu will-change-transform contain-layout"
        }
      >
        <WorldPortalTransition
          sectionRef={sectionRef}
          isReducedMotion={isReducedMotion}
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
          <div
            ref={indicatorRef}
            className="absolute bottom-7 left-6 sm:bottom-9 sm:left-12 z-10 select-none transform-gpu will-change-opacity"
            style={{ opacity: isReducedMotion ? 1 : 0 }}
          >
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
        </WorldPortalTransition>
      </div>
    </section>
  );
}

export default GettingStarted;
