"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useLenis } from "@/components/layout/smooth-scroll-provider";

interface ConstructionEditorialHeadlinesProps {
  sectionRef: React.RefObject<HTMLElement | null>;
  currentStage: number;
  isReducedMotion: boolean;
}

interface HeadlineDef {
  id: string;
  stageNum: number;
  words: { text: string; accent?: boolean }[];
  enterStart: number;
  enterEnd: number;
  exitStart: number;
  exitEnd: number;
}

const HEADLINES: HeadlineDef[] = [
  {
    id: "source",
    stageNum: 1,
    words: [
      { text: "Every" },
      { text: "build" },
      { text: "starts" },
      { text: "somewhere.", accent: true },
    ],
    // Reveals during early clearing & foundation touchdown
    enterStart: 0.01,
    enterEnd: 0.07,
    exitStart: 0.17,
    exitEnd: 0.22,
  },
  {
    id: "build",
    stageNum: 2,
    words: [
      { text: "From" },
      { text: "commit" },
      { text: "to" },
      { text: "creation.", accent: true },
    ],
    // Reveals as columns anchor and roof frame takes shape
    enterStart: 0.24,
    enterEnd: 0.30,
    exitStart: 0.53,
    exitEnd: 0.58,
  },
  {
    id: "production",
    stageNum: 3,
    words: [
      { text: "Built" },
      { text: "to" },
      { text: "go" },
      { text: "live.", accent: true },
    ],
    // Reveals as glass curtain walls enclose and residence illuminates in evening twilight
    enterStart: 0.62,
    enterEnd: 0.68,
    exitStart: 0.98,
    exitEnd: 1.05, // Sustained through completion of the architectural sequence
  },
];

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

/**
 * ConstructionEditorialHeadlines
 *
 * Minimal, cinematic typography system connecting the bungalow construction
 * to Summit's deployment narrative:
 * 1. SOURCE: "Every build starts somewhere."
 * 2. BUILD: "From commit to creation."
 * 3. PRODUCTION: "Built to go live."
 *
 * Characteristics:
 * - Large, carefully proportioned Space Grotesk display typography
 * - Restrained burnt-orange accent on the operative keyword
 * - Smooth word-by-word upward entrance with temporary softening resolving to crisp typography
 * - Natural upward exit drift without abrupt cuts
 * - Deterministic, 100% reversible scroll synchronization
 * - Direct DOM style mutations with zero React re-render overhead at 60/120fps
 * - Respects prefers-reduced-motion with instant clean typography
 */
export function ConstructionEditorialHeadlines({
  sectionRef,
  currentStage,
  isReducedMotion,
}: ConstructionEditorialHeadlinesProps) {
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wordRefs = useRef<(HTMLSpanElement | null)[][]>([[], [], []]);
  const rafIdRef = useRef<number | null>(null);

  const updateHeadlines = useCallback(
    (p: number) => {
      HEADLINES.forEach((def, k) => {
        const container = containerRefs.current[k];
        if (!container) return;

        // Reduced motion fallback: instant full contrast on active stage
        if (isReducedMotion) {
          const isActive = currentStage === def.stageNum;
          container.style.opacity = isActive ? "1" : "0";
          container.style.visibility = isActive ? "visible" : "hidden";
          container.style.transform = "none";
          container.style.filter = "none";
          container.setAttribute("aria-hidden", (!isActive).toString());
          return;
        }

        const numWords = def.words.length;

        // 1. Completely before entrance or after exit
        if (p < def.enterStart || p > def.exitEnd) {
          container.style.opacity = "0";
          container.style.visibility = "hidden";
          container.setAttribute("aria-hidden", "true");
          return;
        }

        container.style.visibility = "visible";
        container.setAttribute("aria-hidden", "false");

        // 2. Entrance Phase: Refined word-by-word upward reveal with soft resolving blur
        if (p >= def.enterStart && p < def.enterEnd) {
          const enterRange = def.enterEnd - def.enterStart;
          const normEnter = (p - def.enterStart) / enterRange;

          container.style.opacity = "1";
          container.style.transform = "translate3d(0, 0, 0)";
          container.style.filter = "none";

          for (let w = 0; w < numWords; w++) {
            const wordEl = wordRefs.current[k]?.[w];
            if (!wordEl) continue;

            const wordStart = (w / numWords) * 0.45;
            const wordDur = 0.55;
            const wordT = clamp01((normEnter - wordStart) / wordDur);
            const easeT = smoothstep(wordT);
            const yOffset = (22 * (1 - easeT)).toFixed(2);
            const blur = ((1 - easeT) * 4).toFixed(2);

            wordEl.style.transform = `translate3d(0, ${yOffset}px, 0)`;
            wordEl.style.opacity = easeT.toFixed(3);
            wordEl.style.filter = parseFloat(blur) > 0.05 ? `blur(${blur}px)` : "none";
          }
          return;
        }

        // 3. Settled Plateau: Rock-solid, razor-sharp typography with zero blur
        if (p >= def.enterEnd && p <= def.exitStart) {
          container.style.opacity = "1";
          container.style.transform = "translate3d(0, 0, 0)";
          container.style.filter = "none";

          for (let w = 0; w < numWords; w++) {
            const wordEl = wordRefs.current[k]?.[w];
            if (!wordEl) continue;
            wordEl.style.transform = "translate3d(0, 0, 0)";
            wordEl.style.opacity = "1";
            wordEl.style.filter = "none";
          }
          return;
        }

        // 4. Exit Phase: Graceful upward drift and dissolve into next stage
        if (p > def.exitStart && p <= def.exitEnd) {
          const exitRange = def.exitEnd - def.exitStart;
          const normExit = (p - def.exitStart) / exitRange;
          const easeExit = smoothstep(normExit);
          const exitY = (-18 * easeExit).toFixed(2);
          const exitOp = (1 - easeExit).toFixed(3);
          const exitBlur = (easeExit * 3).toFixed(2);

          container.style.transform = `translate3d(0, ${exitY}px, 0)`;
          container.style.opacity = exitOp;
          container.style.filter = parseFloat(exitBlur) > 0.05 ? `blur(${exitBlur}px)` : "none";

          for (let w = 0; w < numWords; w++) {
            const wordEl = wordRefs.current[k]?.[w];
            if (!wordEl) continue;
            wordEl.style.transform = "translate3d(0, 0, 0)";
            wordEl.style.opacity = "1";
            wordEl.style.filter = "none";
          }
        }
      });
    },
    [currentStage, isReducedMotion]
  );

  const measureAndApply = useCallback(() => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const scrollDistance = rect.height - vh;
    if (scrollDistance <= 0) {
      updateHeadlines(0);
      return;
    }

    const raw = -rect.top / scrollDistance;
    const clamped = clamp01(raw);
    updateHeadlines(clamped);
  }, [sectionRef, updateHeadlines]);

  const scheduleUpdate = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      measureAndApply();
    });
  }, [measureAndApply]);

  useLenis(() => {
    measureAndApply();
  });

  useEffect(() => {
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });

    measureAndApply();
    const timer = setTimeout(measureAndApply, 60);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [scheduleUpdate, measureAndApply]);

  return (
    <div
      className="absolute top-20 sm:top-24 lg:top-28 left-6 sm:left-12 lg:left-16 xl:left-20 max-w-[320px] sm:max-w-[460px] md:max-w-[560px] lg:max-w-[640px] pointer-events-none select-none z-10"
      aria-label="Construction stage narrative headlines"
    >
      {HEADLINES.map((def, k) => (
        <div
          key={def.id}
          ref={(el) => {
            containerRefs.current[k] = el;
          }}
          className="absolute top-0 left-0 w-full will-change-[transform,opacity,filter]"
          style={{ opacity: 0, visibility: "hidden" }}
        >
          <h2 className="font-sans text-[32px] sm:text-[44px] md:text-[50px] lg:text-[58px] xl:text-[64px] font-medium leading-[1.10] sm:leading-[1.08] lg:leading-[1.05] tracking-[-0.035em] text-[#F5F5F3] [text-wrap:balance]">
            {def.words.map((word, wIdx) => (
              <span
                key={wIdx}
                ref={(el) => {
                  if (!wordRefs.current[k]) wordRefs.current[k] = [];
                  wordRefs.current[k][wIdx] = el;
                }}
                className={`inline-block mr-[0.26em] will-change-[transform,opacity,filter] ${
                  word.accent ? "text-accent-orange" : "text-[#F5F5F3]"
                }`}
              >
                {word.text}
              </span>
            ))}
          </h2>
        </div>
      ))}
    </div>
  );
}

export default ConstructionEditorialHeadlines;

