"use client";

import React, { useEffect, useRef, useSyncExternalStore } from "react";

// The exact, art-directed editorial statement
const PARAGRAPH_TEXT =
  "Production shouldn’t feel like a black box. Understand what’s happening, know when your application is healthy, and keep moving forward.";

const WORDS = PARAGRAPH_TEXT.split(" ");

// Reduced Motion Subscription helper
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
 * ProductionVisibility: Section 06 — Production Visibility
 *
 * Minimal, centered, typography-only storytelling experience:
 * - Small section label: 06 / PRODUCTION VISIBILITY
 * - Single centered Space Grotesk paragraph (~850–920px max width)
 * - Progressive, continuous word-by-word scroll illumination:
 *   Words transition smoothly from muted neutral gray to warm off-white (#F2F0EB)
 * - Normal document flow with generous breathing room
 * - Zero cards, zero columns, zero dashboard chrome, zero scroll hijacking
 * - Respects prefers-reduced-motion: immediate full contrast without scrolling
 */
export function ProductionVisibility() {
  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const sectionRef = useRef<HTMLElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (isReducedMotion) {
      // Display immediately at full contrast for users who prefer reduced motion
      wordRefs.current.forEach((el) => {
        if (el) {
          el.style.color = "#F2F0EB";
        }
      });
      return;
    }

    const numWords = WORDS.length;
    // Spread window controls how smoothly overlapping words brighten
    const spread = 0.18;

    const updateWords = () => {
      if (!sectionRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();
      const vh = window.innerHeight;

      // Start brightening when the section is comfortably in view (top reaches 75% of viewport)
      // Reach full illumination when the section has moved through center view
      const start = vh * 0.75;
      const end = vh * 0.1;
      const rawProgress = (start - rect.top) / (start - end);
      const progress = Math.max(0, Math.min(1, rawProgress));

      for (let i = 0; i < numWords; i++) {
        const el = wordRefs.current[i];
        if (!el) continue;

        const wordStart = (i / (numWords - 1)) * (1 - spread);
        const wordEnd = wordStart + spread;
        const wordProgress = Math.max(
          0,
          Math.min(1, (progress - wordStart) / (wordEnd - wordStart))
        );

        // Alpha interpolates continuously from 0.22 (muted gray) to 1.0 (warm off-white)
        const alpha = 0.22 + wordProgress * 0.78;
        el.style.color = `rgba(242, 240, 235, ${alpha.toFixed(3)})`;
      }
    };

    const handleScroll = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(updateWords);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    // Initial call to set initial state based on current scroll position
    updateWords();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [isReducedMotion]);

  return (
    <section
      ref={sectionRef}
      id="production-visibility"
      className="relative w-full pt-16 pb-28 sm:pt-20 sm:pb-36 lg:pt-24 lg:pb-48 bg-[#111110] text-[#F2F0EB] overflow-hidden select-none"
      aria-label="Production Visibility"
    >
      <div className="layout-container w-full">
        {/* =================================================================
            SECTION IDENTIFIER: 06 / PRODUCTION VISIBILITY
            Understated divider line matching Jetway standard
            ================================================================= */}
        <div className="w-full border-t border-[#262422] pt-5 mb-20 sm:mb-28 lg:mb-36">
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#77736D] tracking-[0.1em] uppercase">
            <span className="text-[#E58B65] font-medium">06</span>
            <span>/</span>
            <span>PRODUCTION VISIBILITY</span>
          </div>
        </div>

        {/* =================================================================
            CENTERED EDITORIAL PARAGRAPH
            Generous breathing room, natural wrapping, word-by-word scroll illumination
            ================================================================= */}
        <div className="w-full flex justify-center px-2 sm:px-4">
          <p
            className="w-full max-w-[850px] lg:max-w-[920px] text-center font-sans text-[28px] sm:text-[34px] md:text-[40px] lg:text-[46px] xl:text-[48px] font-medium leading-[1.35] tracking-[-0.025em]"
          >
            {WORDS.map((word, index) => (
              <React.Fragment key={index}>
                <span
                  ref={(el) => {
                    wordRefs.current[index] = el;
                  }}
                  style={{
                    color: isReducedMotion
                      ? "#F2F0EB"
                      : "rgba(242, 240, 235, 0.22)",
                    willChange: isReducedMotion ? "auto" : "color",
                  }}
                  className="inline-block"
                >
                  {word}
                </span>
                {index < WORDS.length - 1 && " "}
              </React.Fragment>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}

export default ProductionVisibility;
