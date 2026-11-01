"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";

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

interface Pillar {
  number: string;
  headline: string;
  supportingText: string;
}

const PILLARS: Pillar[] = [
  {
    number: "01",
    headline: "Start with the code.",
    supportingText:
      "Bring your repository and keep the workflow you already know.",
  },
  {
    number: "02",
    headline: "Know what's happening.",
    supportingText:
      "Understand every build and deployment without digging through logs.",
  },
  {
    number: "03",
    headline: "Everything you need. Nothing you don't.",
    supportingText:
      "Keep application settings, domains, and environments within reach.",
  },
];

/**
 * DeveloperExperience: Section 05 — Developer Experience
 *
 * Creative Architectural Grid & Editorial Cascade Entry Animation:
 * - Horizon Calibration Rule: A subtle luminous line draws across the section threshold.
 * - Masked Baseline Typography Reveal: The monumental headline lifts from an invisible architectural baseline.
 * - Vertical Grid Plumb Lines: The column dividers slice down smoothly, carving the 3-column editorial grid.
 * - Staggered Pillar Cascade (01 → 02 → 03):
 *     * Numbers illuminate with a warm burnt-orange coordinate glow.
 *     * Headlines unfold cleanly from baseline masks.
 *     * A delicate signature calibration sweep previews the interactive underline.
 *     * Supporting sentences settle with whisper-smooth opacity.
 * - 100% compositor-driven (transforms & opacities only) with zero layout thrashing.
 * - Accessible with instant contrast for prefers-reduced-motion.
 */
export function DeveloperExperience() {
  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState<boolean>(isReducedMotion);
  const [underlineHint, setUnderlineHint] = useState<boolean>(false);

  useEffect(() => {
    if (isReducedMotion) return;

    const targetEl = containerRef.current || sectionRef.current;
    if (!targetEl || typeof IntersectionObserver === "undefined") {
      const frame = window.requestAnimationFrame(() => setIsInView(true));
      return () => window.cancelAnimationFrame(frame);
    }

    let startTimer: NodeJS.Timeout;
    let hintTimer: NodeJS.Timeout;

    const clearAllTimers = () => {
      clearTimeout(startTimer);
      clearTimeout(hintTimer);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          clearAllTimers();

          // Deliberate arrival grace delay (400ms):
          // Ensures the user has scrolled to and settled on the section
          // before the creative architectural reveal plays out right in front of them
          startTimer = setTimeout(() => {
            setIsInView(true);

            // Subtle discovery sweep for the underline after headlines land
            hintTimer = setTimeout(() => {
              setUnderlineHint(true);
              setTimeout(() => setUnderlineHint(false), 900);
            }, 1300);
          }, 400);
        } else {
          clearAllTimers();

          // Reset when scrolled far off-screen so the user can enjoy the entry again
          const rect = entry.boundingClientRect;
          if (rect.top > window.innerHeight * 1.15 || rect.bottom < -window.innerHeight * 0.25) {
            setIsInView(false);
            setUnderlineHint(false);
          }
        }
      },
      {
        threshold: 0.35, // Section content must be at least 35% visible inside the viewport
        rootMargin: "0px 0px -80px 0px", // Guard against premature trigger while scrolling through top padding
      }
    );

    observer.observe(targetEl);

    return () => {
      observer.disconnect();
      clearAllTimers();
    };
  }, [isReducedMotion]);

  const active = isReducedMotion || isInView;

  return (
    <section
      ref={sectionRef}
      id="developer-experience"
      className="relative w-full pt-36 pb-44 sm:pt-48 sm:pb-56 lg:pt-56 lg:pb-64 xl:pt-64 xl:pb-72 mt-[6vh] sm:mt-[10vh] lg:mt-[12vh] scroll-mt-28 sm:scroll-mt-36 bg-transparent text-[#F0EEE9] overflow-hidden select-none"
      aria-labelledby="devex-heading"
    >
      <div ref={containerRef} className="layout-container w-full relative">

        {/* =================================================================
            ARCHITECTURAL CALIBRATION HORIZON LINE
            Luminous laser rule line that sweeps across the section header
            ================================================================= */}
        <div
          className="w-full h-[1px] mb-12 sm:mb-16 origin-left transition-transform duration-1000 ease-out pointer-events-none"
          style={{
            transform: active ? "scaleX(1)" : "scaleX(0)",
            background:
              "linear-gradient(90deg, rgba(229, 138, 97, 0.45) 0%, rgba(240, 238, 233, 0.25) 30%, rgba(36, 34, 32, 0.8) 70%, transparent 100%)",
            transitionDelay: "100ms",
          }}
          aria-hidden="true"
        />

        {/* =================================================================
            SECTION INTRODUCTION: Masked Editorial Reveal
            ================================================================= */}
        <div className="max-w-2xl mb-16 sm:mb-20 lg:mb-24">
          {/* Masked Baseline Headline */}
          <div className="overflow-hidden pb-1">
            <h2
              id="devex-heading"
              className="font-sans text-[38px] sm:text-[48px] lg:text-[54px] font-medium leading-[1.08] tracking-[-0.03em] text-[#F0EEE9] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                transform: active ? "translateY(0)" : "translateY(110%)",
                transitionDelay: "180ms",
              }}
            >
              Built for the way you work.
            </h2>
          </div>

          {/* Masked Supporting Paragraph */}
          <div className="overflow-hidden pt-4 sm:pt-5">
            <p
              className="font-sans text-[16px] sm:text-[17px] text-[#8E8A82] leading-[1.65] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                transform: active ? "translateY(0)" : "translateY(35px)",
                opacity: active ? 1 : 0,
                transitionDelay: "320ms",
              }}
            >
              Your tools should help you move forward, not slow you down. Keep
              your development workflow focused, your deployments understandable,
              and the essentials within reach.
            </p>
          </div>
        </div>

        {/* =================================================================
            THE THREE PILLARS: Horizontal Typography-First Editorial Row
            Separated by vertical architectural plumb lines that slice down
            ================================================================= */}
        <div className="relative grid grid-cols-1 md:grid-cols-3">
          
          {/* Desktop Vertical Column Plumb Lines (Draw down from top) */}
          <div
            className="hidden md:block absolute left-1/3 top-0 bottom-0 w-[1px] origin-top bg-[#242220] transition-transform duration-800 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              transform: active ? "scaleY(1)" : "scaleY(0)",
              transitionDelay: "450ms",
            }}
            aria-hidden="true"
          />
          <div
            className="hidden md:block absolute left-2/3 top-0 bottom-0 w-[1px] origin-top bg-[#242220] transition-transform duration-800 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              transform: active ? "scaleY(1)" : "scaleY(0)",
              transitionDelay: "550ms",
            }}
            aria-hidden="true"
          />

          {PILLARS.map((pillar, index) => {
            const delayOffset = 380 + index * 140;

            return (
              <div
                key={pillar.number}
                className={`group flex flex-col justify-between py-8 md:py-2 cursor-default relative ${
                  index === 0
                    ? "md:pr-8 lg:pr-12 md:pl-0 border-b md:border-b-0 border-[#242220]"
                    : index === 1
                    ? "md:px-8 lg:px-12 border-b md:border-b-0 border-[#242220]"
                    : "md:pl-8 lg:pl-12 md:pr-0"
                }`}
              >
                <div className="space-y-4 sm:space-y-5">
                  {/* 1. Monospaced Number with Coordinate Glow */}
                  <div
                    className="font-mono text-[12px] sm:text-[13px] text-[#E58A61] font-medium tracking-[0.08em] transition-all duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:text-[#FFAA80]"
                    style={{
                      transform: active ? "translateY(0) scale(1)" : "translateY(16px) scale(0.9)",
                      opacity: active ? 1 : 0,
                      transitionDelay: `${delayOffset}ms`,
                    }}
                  >
                    <span className="inline-block relative">
                      {pillar.number}
                      <span
                        className="absolute inset-0 blur-[6px] bg-[#E58A61] opacity-0 transition-opacity duration-500"
                        style={{
                          opacity: active ? (underlineHint ? 0.6 : 0) : 0,
                        }}
                        aria-hidden="true"
                      />
                    </span>
                  </div>

                  {/* 2. Prominent headline with Masked Baseline Rise & Discovery Sweep Underline */}
                  <div className="relative inline-block overflow-hidden pb-1">
                    <h3
                      className="font-sans text-[28px] sm:text-[32px] lg:text-[36px] xl:text-[38px] font-medium leading-[1.14] tracking-[-0.03em] text-[#F0EEE9] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:text-white"
                      style={{
                        transform: active ? "translateY(0)" : "translateY(105%)",
                        transitionDelay: `${delayOffset + 70}ms`,
                      }}
                    >
                      {pillar.headline}
                    </h3>
                    
                    {/* Interactive Underline with Initial Discovery Wave */}
                    <span
                      className="block h-[1.5px] bg-[#E58A61] w-full origin-left transition-transform duration-300 ease-out group-hover:scale-x-100 mt-3"
                      style={{
                        transform: underlineHint ? "scaleX(1)" : undefined,
                      }}
                      aria-hidden="true"
                    />
                  </div>

                  {/* 3. Concise supporting sentence with Smooth Settling Fade */}
                  <div className="overflow-hidden">
                    <p
                      className="font-sans text-[15px] sm:text-[16px] text-[#8E8A82] leading-[1.6] max-w-[340px] pt-1 transition-all duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:text-[#A8A49C]"
                      style={{
                        transform: active ? "translateY(0)" : "translateY(24px)",
                        opacity: active ? 1 : 0,
                        transitionDelay: `${delayOffset + 140}ms`,
                      }}
                    >
                      {pillar.supportingText}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default DeveloperExperience;
