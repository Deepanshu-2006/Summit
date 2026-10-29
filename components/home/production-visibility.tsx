"use client";

import React, { useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { useLenis } from "@/components/layout/smooth-scroll-provider";

// The exact, art-directed editorial statement
const PARAGRAPH_TEXT =
  "Production shouldn’t feel like a black box. Understand what’s happening, know when your application is healthy, and keep moving forward.";

interface CharInfo {
  char: string;
  globalIndex: number;
}

interface WordInfo {
  word: string;
  chars: CharInfo[];
}

const RAW_WORDS = PARAGRAPH_TEXT.split(" ");
let runningCharIndex = 0;

export const WORDS_DATA: WordInfo[] = RAW_WORDS.map((word) => {
  const chars: CharInfo[] = word.split("").map((char) => ({
    char,
    globalIndex: runningCharIndex++,
  }));
  return { word, chars };
});

export const TOTAL_CHARS = runningCharIndex; // 117 characters total

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
 * Tactile, Pinned Scroll-Driven Text Illumination:
 * - Generous 220vh scroll runway with a centered sticky viewport pin.
 * - Words change opacity and tone smoothly and tangibly as you scroll:
 *   * Begins in dim, translucent graphite (opacity: 0.18).
 *   * Transitions progressively through each letter across an organic wavefront (W = 0.14).
 *   * Rises to full solid warm ivory (opacity: 1.0, #F5F5F3) with a subtle warm champagne crest.
 * - Scrolling feels physical, deliberate, and deeply satisfying—never rushed or abrupt.
 * - Scrolling upwards reverses the opacity and illumination naturally.
 * - 100% accessible to assistive technologies via sr-only mirror and aria-label.
 * - Zero layout shifts, zero React re-renders on scroll frames (direct DOM style mutations).
 * - Respects prefers-reduced-motion with instant full contrast.
 */
export function ProductionVisibility() {
  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const sectionRef = useRef<HTMLElement>(null);
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const lastProgressRef = useRef<number>(-1);
  const rafIdRef = useRef<number | null>(null);

  // Progressive Character Opacity & Illumination Math
  const updateIllumination = useCallback((scrollProgress: number) => {
    // Wavefront width (~16 characters wide, covering ~2.5 words in smooth transition)
    const W = 0.14;

    // Dedicated reading pacing:
    // - 0% to 6%: graceful entry cushion (opacity 0.18 across all text)
    // - 6% to 88%: progressive character opacity and light journey
    // - 88% to 100%: hold at full 1.0 contrast before unpinning
    const P = Math.max(0, Math.min(1, (scrollProgress - 0.06) / 0.82));
    const center = -W / 2 + P * (1 + W);

    for (let i = 0; i < TOTAL_CHARS; i++) {
      const el = charRefs.current[i];
      if (!el) continue;

      const pos = i / (TOTAL_CHARS - 1);
      const t = (center - pos + W / 2) / W;
      const clamped_t = Math.max(0, Math.min(1, t));

      // Cubic smoothstep curve for natural organic transition
      const s = clamped_t * clamped_t * (3 - 2 * clamped_t);

      // Opacity visibly rises from 0.18 (dim translucent graphite) to 1.0 (solid warm ivory)
      const opacity = 0.18 + 0.82 * s;

      // Subtle warm highlight crest peaking at s ~ 0.55
      const warmBoost = Math.pow(Math.sin(Math.PI * s), 1.5);

      // Subtle color warmth adjustment along the wave crest
      const r = Math.round((1 - s) * 235 + s * 245 + warmBoost * 14);
      const g = Math.round((1 - s) * 232 + s * 245 - warmBoost * 8);
      const b = Math.round((1 - s) * 228 + s * 243 - warmBoost * 18);

      el.style.opacity = opacity.toFixed(3);
      el.style.color = `rgb(${r}, ${g}, ${b})`;
    }
  }, []);

  const computeAndRender = useCallback(() => {
    if (!sectionRef.current || isReducedMotion) return;

    const rect = sectionRef.current.getBoundingClientRect();
    const vh = window.innerHeight;

    // Total distance the sticky child is pinned
    const scrollDistance = rect.height - vh;
    if (scrollDistance <= 0) return;

    // Current scroll distance through the pinned container
    const currentScroll = -rect.top;
    const rawProgress = currentScroll / scrollDistance;
    const scrollProgress = Math.max(0, Math.min(1, rawProgress));

    // Skip DOM updates if scrollProgress hasn't meaningfully changed
    if (Math.abs(scrollProgress - lastProgressRef.current) < 0.0005) {
      return;
    }
    lastProgressRef.current = scrollProgress;

    updateIllumination(scrollProgress);
  }, [isReducedMotion, updateIllumination]);

  const scheduleUpdate = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      computeAndRender();
    });
  }, [computeAndRender]);

  // Synchronize 1:1 with Lenis smooth scrolling loop
  useLenis(() => {
    scheduleUpdate();
  });

  useEffect(() => {
    if (isReducedMotion) {
      // Immediate full contrast for reduced motion
      charRefs.current.forEach((el) => {
        if (el) {
          el.style.opacity = "1";
          el.style.color = "#F5F5F3";
        }
      });
      return;
    }

    // Native scroll and resize fallback listeners
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });

    // Initial calculation on mount
    computeAndRender();

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [isReducedMotion, computeAndRender, scheduleUpdate]);

  return (
    <section
      ref={sectionRef}
      id="production-visibility"
      className={
        isReducedMotion
          ? "relative w-full py-24 sm:py-32 lg:py-40 bg-transparent text-[#F5F5F3]"
          : "relative w-full h-[220vh] bg-transparent text-[#F5F5F3]"
      }
      aria-label="Production Visibility"
    >
      <div className={isReducedMotion ? "w-full" : "sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden"}>
        <div className="layout-container w-full flex justify-center px-4 sm:px-6">
          {/* =================================================================
              CENTERED EDITORIAL PARAGRAPH
              Monumental 3-line balanced display typography with progressive opacity scroll current
              ================================================================= */}
          <p
            ref={paragraphRef}
            className="w-full max-w-[960px] lg:max-w-[1140px] xl:max-w-[1240px] text-center font-sans text-[32px] sm:text-[42px] md:text-[52px] lg:text-[62px] xl:text-[70px] font-medium leading-[1.16] sm:leading-[1.12] tracking-[-0.038em] [text-wrap:balance]"
            aria-label={PARAGRAPH_TEXT}
          >
            {/* Screen reader full text representation */}
            <span className="sr-only">{PARAGRAPH_TEXT}</span>

            {/* Visual character-level animated typography with physical opacity progression */}
            <span aria-hidden="true">
              {WORDS_DATA.map((wordObj, wordIndex) => (
                <React.Fragment key={wordIndex}>
                  <span className="inline-block whitespace-nowrap">
                    {wordObj.chars.map((charObj) => (
                      <span
                        key={charObj.globalIndex}
                        ref={(el) => {
                          charRefs.current[charObj.globalIndex] = el;
                        }}
                        className="inline"
                        style={{
                          opacity: isReducedMotion ? 1 : 0.18,
                          color: "#F5F5F3",
                        }}
                      >
                        {charObj.char}
                      </span>
                    ))}
                  </span>
                  {wordIndex < WORDS_DATA.length - 1 && " "}
                </React.Fragment>
              ))}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

export default ProductionVisibility;
