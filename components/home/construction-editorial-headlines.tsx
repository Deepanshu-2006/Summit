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
    // Reveals as camera breaks through mist dive into sunlit clearing
    enterStart: 0.05,
    enterEnd: 0.09,
    exitStart: 0.18,
    exitEnd: 0.23,
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
    exitStart: 0.54,
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
    exitEnd: 1.05,
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
 * Performance Characteristics:
 * - High-Performance compositor-only animations (translate3d + opacity)
 * - Zero CSS blur convolution filters on text to avoid GPU rasterization stalls
 * - Cached geometric coordinates eliminating getBoundingClientRect layout thrashing
 * - 100% deterministic & reversible on backward scrolling
 */
export function ConstructionEditorialHeadlines({
  sectionRef,
  currentStage,
  isReducedMotion,
}: ConstructionEditorialHeadlinesProps) {
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wordRefs = useRef<(HTMLSpanElement | null)[][]>([]);

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
  }, [sectionRef]);

  const updateHeadlines = useCallback(
    (progress: number) => {
      const p = clamp01(progress);

      HEADLINES.forEach((def, k) => {
        const container = containerRefs.current[k];
        if (!container) return;

        if (isReducedMotion) {
          const isActive = def.stageNum === currentStage;
          container.style.opacity = isActive ? "1" : "0";
          container.style.transform = "none";
          container.style.visibility = isActive ? "visible" : "hidden";
          return;
        }

        // 1. Outside Active Timeline Window: fully hidden
        if (p < def.enterStart || p > def.exitEnd) {
          container.style.opacity = "0";
          container.style.visibility = "hidden";
          return;
        }

        container.style.visibility = "visible";
        const numWords = def.words.length;

        // 2. Entrance Phase: Word-by-word upward ascent (Compositor accelerated)
        if (p >= def.enterStart && p < def.enterEnd) {
          container.style.transform = "translate3d(0, 0, 0)";
          container.style.opacity = "1";

          const enterRange = def.enterEnd - def.enterStart;
          const normEnter = (p - def.enterStart) / enterRange;

          for (let w = 0; w < numWords; w++) {
            const wordEl = wordRefs.current[k]?.[w];
            if (!wordEl) continue;

            const wordStart = (w / numWords) * 0.45;
            const wordDur = 0.55;
            const wordT = clamp01((normEnter - wordStart) / wordDur);
            const easeT = smoothstep(wordT);
            const yOffset = (18 * (1 - easeT)).toFixed(2);

            wordEl.style.transform = `translate3d(0, ${yOffset}px, 0)`;
            wordEl.style.opacity = easeT.toFixed(3);
          }
          return;
        }

        // 3. Settled Plateau: Rock-solid, razor-sharp typography
        if (p >= def.enterEnd && p <= def.exitStart) {
          container.style.opacity = "1";
          container.style.transform = "translate3d(0, 0, 0)";

          for (let w = 0; w < numWords; w++) {
            const wordEl = wordRefs.current[k]?.[w];
            if (!wordEl) continue;
            wordEl.style.transform = "translate3d(0, 0, 0)";
            wordEl.style.opacity = "1";
          }
          return;
        }

        // 4. Exit Phase: Graceful upward drift and dissolve into next stage
        if (p > def.exitStart && p <= def.exitEnd) {
          const exitRange = def.exitEnd - def.exitStart;
          const normExit = (p - def.exitStart) / exitRange;
          const easeExit = smoothstep(normExit);
          const exitY = (-16 * easeExit).toFixed(2);
          const exitOp = (1 - easeExit).toFixed(3);

          container.style.transform = `translate3d(0, ${exitY}px, 0)`;
          container.style.opacity = exitOp;

          for (let w = 0; w < numWords; w++) {
            const wordEl = wordRefs.current[k]?.[w];
            if (!wordEl) continue;
            wordEl.style.transform = "translate3d(0, 0, 0)";
            wordEl.style.opacity = "1";
          }
        }
      });
    },
    [currentStage, isReducedMotion]
  );

  const applyScroll = useCallback(
    (scrollY: number) => {
      const { sectionTop, scrollDistance } = geoRef.current;
      const raw = (scrollY - sectionTop) / scrollDistance;
      updateHeadlines(clamp01(raw));
    },
    [updateHeadlines]
  );

  // Synchronize directly with Lenis smooth scroll tick
  useLenis((lenis) => {
    applyScroll(lenis.scroll);
  });

  useEffect(() => {
    const onNativeScroll = () => {
      applyScroll(window.scrollY);
    };

    const onResize = () => {
      measure();
      applyScroll(window.scrollY);
    };

    window.addEventListener("scroll", onNativeScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    measure();
    applyScroll(window.scrollY);
    const timer = setTimeout(() => {
      measure();
      applyScroll(window.scrollY);
    }, 100);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onNativeScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [measure, applyScroll]);

  return (
    <div
      className="absolute top-20 sm:top-24 lg:top-28 left-6 sm:left-12 lg:left-16 xl:left-20 max-w-[320px] sm:max-w-[460px] md:max-w-[560px] lg:max-w-[640px] pointer-events-none select-none z-10 transform-gpu contain-layout"
      aria-label="Construction stage narrative headlines"
    >
      {HEADLINES.map((def, k) => (
        <div
          key={def.id}
          ref={(el) => {
            containerRefs.current[k] = el;
          }}
          className="absolute top-0 left-0 w-full will-change-[transform,opacity] transform-gpu"
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
                className={`inline-block mr-[0.26em] will-change-[transform,opacity] transform-gpu ${
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
