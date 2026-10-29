"use client";

import React, { useRef, useEffect, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

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

// Headline Word & Character Definitions for Per-Alphabet Kinetic Emergence
const LINE_1_WORDS = [
  { word: "Your", chars: ["Y", "o", "u", "r"] },
  { word: "code.", chars: ["c", "o", "d", "e", "."] },
];

const LINE_2_WORDS = [
  { word: "Ready", chars: ["R", "e", "a", "d", "y"] },
  { word: "for", chars: ["f", "o", "r"] },
  { word: "what’s", chars: ["w", "h", "a", "t", "’", "s"] },
  { word: "next.", chars: ["n", "e", "x", "t", "."] },
];

const TOTAL_LINE_1_CHARS = LINE_1_WORDS.reduce((acc, w) => acc + w.chars.length, 0); // 9
const TOTAL_CHARS =
  TOTAL_LINE_1_CHARS + LINE_2_WORDS.reduce((acc, w) => acc + w.chars.length, 0); // 28

/**
 * FinalCta: Section 08 — Final Call to Action
 * "Your code. Ready for what’s next."
 *
 * Cinematic typography & scroll-driven mountain composition:
 * - Two-statement art-directed headline: "Your code." followed by "Ready for what’s next."
 * - Per-alphabet kinetic scroll emergence: each letter comes up separately from the mountains
 * - Completely removed top pill/capsule for immediate typographic authority
 * - Calm, narrower supporting copy with generous breathing room
 * - Distinct button hierarchy: high-contrast burnt-orange primary with refined arrow
 *   paired with a quiet, border-defined dark secondary action
 * - 5 independently emerging scroll-driven terrain layers preserved seamlessly
 */
export function FinalCta() {
  const sectionRef = useRef<HTMLElement>(null);
  const masterLayerRef = useRef<HTMLDivElement>(null);
  const layer1Ref = useRef<HTMLDivElement>(null);
  const layer2Ref = useRef<HTMLDivElement>(null);
  const layer3Ref = useRef<HTMLDivElement>(null);
  const layer4Ref = useRef<HTMLDivElement>(null);
  const layer5Ref = useRef<HTMLDivElement>(null);
  const lightLayerRef = useRef<HTMLDivElement>(null);

  // Per-character DOM references for letter-by-letter kinetic emergence
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Synchronously subscribe to reduced motion preference
  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  useEffect(() => {
    // If reduced motion is requested, ensure all layers and text are in final resting state
    if (isReducedMotion) {
      const resetLayer = (el: HTMLElement | null) => {
        if (!el) return;
        el.style.transform = "none";
        el.style.opacity = "1";
        el.style.filter = "none";
      };
      resetLayer(layer1Ref.current);
      resetLayer(layer2Ref.current);
      resetLayer(layer3Ref.current);
      resetLayer(layer4Ref.current);
      resetLayer(layer5Ref.current);
      charRefs.current.forEach((el) => {
        if (!el) return;
        el.style.transform = "none";
        el.style.opacity = "1";
        el.style.filter = "none";
        el.style.transition = "none";
      });
      if (paragraphRef.current) {
        paragraphRef.current.style.transform = "none";
        paragraphRef.current.style.opacity = "1";
        paragraphRef.current.style.filter = "none";
        paragraphRef.current.style.transition = "none";
      }
      if (actionsRef.current) {
        actionsRef.current.style.transform = "none";
        actionsRef.current.style.opacity = "1";
        actionsRef.current.style.filter = "none";
        actionsRef.current.style.transition = "none";
      }
      if (masterLayerRef.current) masterLayerRef.current.style.opacity = "1";
      return;
    }

    const section = sectionRef.current;
    if (!section) return;

    let targetP = 0;
    let currentP = 0;
    let isInitialized = false;
    let rafId: number | null = null;
    let isIntersecting = false;

    // Easing helper: smooth cubic deceleration curve
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    // Compute target scroll progress based on section position in viewport
    // Removing the 0.50 delay: emergence begins responsively as section enters viewport (~72% down)
    const computeTargetP = () => {
      if (!section) return 0;
      const rect = section.getBoundingClientRect();
      const windowH = window.innerHeight;
      const startY = windowH * 0.72;
      const endY = Math.max(40, windowH * 0.06);
      const rawP = (startY - rect.top) / (startY - endY);
      return Math.max(0, Math.min(1, rawP));
    };

    const render = (p: number) => {
      // =================================================================
      // DEEP PHYSICAL GROUND EMERGENCE: MOUNTAINS RISING FROM BEDROCK
      // Large vertical travel offsets so peaks physically pierce the ground
      // and rise upward out of the earth rather than fading in place
      // =================================================================
      const isMobile = window.innerWidth < 640;
      const yL1 = isMobile ? 180 : 280; // Distant ridge
      const yL2 = isMobile ? 280 : 460; // Left mountain (tallest mass on left)
      const yL3 = isMobile ? 190 : 300; // Central valley
      const yL4 = isMobile ? 290 : 480; // Right mountain (tall craggy peak on right)
      const yL5 = isMobile ? 200 : 320; // Foreground terrain

      // Layer 1: Distant Ridge (emerges immediately: progress 0.00 -> 0.46)
      if (layer1Ref.current) {
        const p1 = Math.max(0, Math.min(1, p / 0.46));
        const e1 = easeOutCubic(p1);
        const y1 = (yL1 * (1 - e1)).toFixed(2);
        const sY1 = (0.90 + 0.10 * e1).toFixed(3);
        const op1 = p1 > 0 ? Math.min(1, 0.35 + p1 * 0.65).toFixed(3) : "0";
        layer1Ref.current.style.transform = `translate3d(0, ${y1}px, 0) scaleY(${sY1})`;
        layer1Ref.current.style.opacity = op1;
      }

      // Layer 2: Left Mountain (breaches ground at p = 0.08 -> 0.60)
      if (layer2Ref.current) {
        const p2 = Math.max(0, Math.min(1, (p - 0.08) / 0.52));
        const e2 = easeOutCubic(p2);
        const y2 = (yL2 * (1 - e2)).toFixed(2);
        const sY2 = (0.86 + 0.14 * e2).toFixed(3);
        const op2 = p2 > 0 ? Math.min(1, 0.40 + p2 * 0.60).toFixed(3) : "0";
        layer2Ref.current.style.transform = `translate3d(0, ${y2}px, 0) scaleY(${sY2})`;
        layer2Ref.current.style.opacity = op2;
      }

      // Layer 3: Central Valley (rises between peaks at p = 0.16 -> 0.68)
      if (layer3Ref.current) {
        const p3 = Math.max(0, Math.min(1, (p - 0.16) / 0.52));
        const e3 = easeOutCubic(p3);
        const y3 = (yL3 * (1 - e3)).toFixed(2);
        const sY3 = (0.88 + 0.12 * e3).toFixed(3);
        const op3 = p3 > 0 ? Math.min(1, 0.35 + p3 * 0.65).toFixed(3) : "0";
        layer3Ref.current.style.transform = `translate3d(0, ${y3}px, 0) scaleY(${sY3})`;
        layer3Ref.current.style.opacity = op3;
      }

      // Layer 4: Right Mountain (pierces ground on right at p = 0.25 -> 0.77)
      if (layer4Ref.current) {
        const p4 = Math.max(0, Math.min(1, (p - 0.25) / 0.52));
        const e4 = easeOutCubic(p4);
        const y4 = (yL4 * (1 - e4)).toFixed(2);
        const sY4 = (0.86 + 0.14 * e4).toFixed(3);
        const op4 = p4 > 0 ? Math.min(1, 0.40 + p4 * 0.60).toFixed(3) : "0";
        layer4Ref.current.style.transform = `translate3d(0, ${y4}px, 0) scaleY(${sY4})`;
        layer4Ref.current.style.opacity = op4;
      }

      // Layer 5: Foreground Terrain (closest foreground ridges rise last: p = 0.36 -> 0.88)
      if (layer5Ref.current) {
        const p5 = Math.max(0, Math.min(1, (p - 0.36) / 0.52));
        const e5 = easeOutCubic(p5);
        const y5 = (yL5 * (1 - e5)).toFixed(2);
        const sY5 = (0.88 + 0.12 * e5).toFixed(3);
        const op5 = p5 > 0 ? Math.min(1, 0.45 + p5 * 0.55).toFixed(3) : "0";
        layer5Ref.current.style.transform = `translate3d(0, ${y5}px, 0) scaleY(${sY5})`;
        layer5Ref.current.style.opacity = op5;
      }

      // Ambient light shimmer opacity tracks terrain emergence
      if (lightLayerRef.current) {
        const lightOp = (0.28 * Math.max(0, Math.min(1, (p - 0.10) * 1.3))).toFixed(3);
        lightLayerRef.current.style.opacity = lightOp;
      }

      // Master composite lock: smoothly fades in as everything settles into final resting composition
      if (masterLayerRef.current) {
        const masterOp = p >= 0.84 ? Math.min(1, (p - 0.84) / 0.16).toFixed(3) : "0";
        masterLayerRef.current.style.opacity = masterOp;
      }

      // =================================================================
      // 1. HEADLINE PER-CHARACTER KINETIC EMERGENCE: BACK TO FRONT
      // Each alphabet emerges and rises up independently on scroll
      // =================================================================
      const charYTravel = isMobile ? 50 : 75;
      const windowSpan = 0.22;
      const staggerRange = 0.30;
      const maxBlur = isMobile ? 3 : 5;

      for (let i = 0; i < TOTAL_CHARS; i++) {
        const charEl = charRefs.current[i];
        if (!charEl) continue;

        const charStart = 0.18 + (i / (TOTAL_CHARS - 1)) * staggerRange;
        const charEnd = charStart + windowSpan;
        const charP = Math.max(0, Math.min(1, (p - charStart) / (charEnd - charStart)));

        if (charP >= 0.99) {
          charEl.style.transform = "translate3d(0, 0, 0)";
          charEl.style.opacity = "1";
          charEl.style.filter = "none";
        } else if (charP <= 0) {
          charEl.style.transform = `translate3d(0, ${charYTravel}px, 0) scale(0.75) rotateX(${isMobile ? 8 : 14}deg)`;
          charEl.style.opacity = "0";
          charEl.style.filter = `blur(${maxBlur}px)`;
        } else {
          const charEase = easeOutCubic(charP);
          const y = (charYTravel * (1 - charEase)).toFixed(2);
          const s = (0.75 + 0.25 * charEase).toFixed(3);
          const rot = ((isMobile ? 8 : 14) * (1 - charEase)).toFixed(2);
          const op = Math.min(1, charP * 1.5).toFixed(3);
          const blur = charP > 0.85 ? "none" : `blur(${((maxBlur) * (1 - charEase)).toFixed(2)}px)`;

          charEl.style.transform = `translate3d(0, ${y}px, 0) scale(${s}) rotateX(${rot}deg)`;
          charEl.style.opacity = op;
          charEl.style.filter = blur;
        }
      }

      // =================================================================
      // 2. SUPPORTING COPY & BUTTONS: PROGRESSIVE FORWARD SURGE
      // =================================================================
      const yTravelP = isMobile ? 100 : 160;
      const yTravelB = isMobile ? 120 : 180;
      const maxBlurP = isMobile ? 4 : 6;
      const maxBlurB = isMobile ? 3 : 5;

      // 2. Supporting Paragraph (delayed: follows headline cascade at p = 0.32 -> 0.80)
      if (paragraphRef.current) {
        const pP = Math.max(0, Math.min(1, (p - 0.32) / 0.48));
        if (pP >= 0.99) {
          paragraphRef.current.style.transform = "translate3d(0, 0, 0)";
          paragraphRef.current.style.opacity = "1";
          paragraphRef.current.style.filter = "none";
        } else if (pP <= 0) {
          paragraphRef.current.style.transform = `translate3d(0, ${yTravelP}px, 0) scale(0.76) rotateX(${isMobile ? 3 : 5}deg)`;
          paragraphRef.current.style.opacity = "0";
          paragraphRef.current.style.filter = `blur(${maxBlurP}px)`;
        } else {
          const eP = easeOutCubic(pP);
          const yP = (yTravelP * (1 - eP)).toFixed(2);
          const sP = (0.76 + 0.24 * eP).toFixed(3);
          const rotP = ((isMobile ? 3 : 5) * (1 - eP)).toFixed(2);
          const opP = Math.min(1, pP * 1.5).toFixed(3);
          const blurP = pP > 0.85 ? "none" : `blur(${((maxBlurP) * (1 - eP)).toFixed(2)}px)`;

          paragraphRef.current.style.transform = `translate3d(0, ${yP}px, 0) scale(${sP}) rotateX(${rotP}deg)`;
          paragraphRef.current.style.opacity = opP;
          paragraphRef.current.style.filter = blurP;
        }
      }

      // 3. Actions / Buttons (delayed: emerges last from the valley at p = 0.44 -> 0.92)
      if (actionsRef.current) {
        const pB = Math.max(0, Math.min(1, (p - 0.44) / 0.48));
        if (pB >= 0.99) {
          actionsRef.current.style.transform = "translate3d(0, 0, 0)";
          actionsRef.current.style.opacity = "1";
          actionsRef.current.style.filter = "none";
        } else if (pB <= 0) {
          actionsRef.current.style.transform = `translate3d(0, ${yTravelB}px, 0) scale(0.80) rotateX(${isMobile ? 2.5 : 4}deg)`;
          actionsRef.current.style.opacity = "0";
          actionsRef.current.style.filter = `blur(${maxBlurB}px)`;
        } else {
          const eB = easeOutCubic(pB);
          const yB = (yTravelB * (1 - eB)).toFixed(2);
          const sB = (0.80 + 0.20 * eB).toFixed(3);
          const rotB = ((isMobile ? 2.5 : 4) * (1 - eB)).toFixed(2);
          const opB = Math.min(1, pB * 1.6).toFixed(3);
          const blurB = pB > 0.85 ? "none" : `blur(${((maxBlurB) * (1 - eB)).toFixed(2)}px)`;

          actionsRef.current.style.transform = `translate3d(0, ${yB}px, 0) scale(${sB}) rotateX(${rotB}deg)`;
          actionsRef.current.style.opacity = opB;
          actionsRef.current.style.filter = blurB;
        }
      }
    };

    // Smooth Lerp Tick Loop: Eliminates mouse-wheel notch stepping and creates liquid motion
    const tick = () => {
      const diff = targetP - currentP;
      if (Math.abs(diff) < 0.0003) {
        currentP = targetP;
        render(currentP);
        rafId = null;
        return;
      }

      currentP += diff * 0.12;
      render(currentP);
      rafId = requestAnimationFrame(tick);
    };

    const requestTick = () => {
      if (!isIntersecting) return;
      targetP = computeTargetP();
      if (rafId === null) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const onScroll = () => {
      requestTick();
    };

    const onResize = () => {
      requestTick();
    };

    // Use IntersectionObserver to ensure 0 scroll overhead when off-screen
    const observer = new IntersectionObserver(
      ([entry]) => {
        isIntersecting = entry.isIntersecting;
        if (isIntersecting) {
          targetP = computeTargetP();
          if (!isInitialized) {
            currentP = targetP;
            render(currentP);
            isInitialized = true;
          } else {
            requestTick();
          }
          window.addEventListener("scroll", onScroll, { passive: true });
          window.addEventListener("resize", onResize, { passive: true });
        } else {
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("resize", onResize);
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
        }
      },
      { rootMargin: "300px 0px 300px 0px", threshold: 0 }
    );

    observer.observe(section);

    // Initial calculation on mount
    targetP = computeTargetP();
    currentP = targetP;
    render(currentP);
    isInitialized = true;

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isReducedMotion]);

  return (
    <section
      ref={sectionRef}
      id="final-cta"
      className="relative w-full min-h-[640px] sm:min-h-[720px] lg:min-h-[800px] pt-24 pb-32 sm:pt-32 sm:pb-40 lg:pt-38 lg:pb-48 bg-[#111110] text-text-primary overflow-hidden flex flex-col justify-start select-none"
      aria-labelledby="cta-heading"
    >
      {/* Dynamic Keyframes for Subtle Terrain Lighting Drift */}
      <style>{`
        @keyframes terrainLightDrift {
          0% {
            opacity: 0.12;
            transform: scale(0.98) translate3d(-1.5%, 0, 0);
          }
          50% {
            opacity: 0.22;
            transform: scale(1.02) translate3d(2%, -1%, 0);
          }
          100% {
            opacity: 0.12;
            transform: scale(0.98) translate3d(-1.5%, 0, 0);
          }
        }
      `}</style>

      {/* =================================================================
          LAYER 1 TO 5: INDEPENDENTLY EMERGING MOUNTAIN TERRAIN RIDGES
          Organic terrain layers rising out of darkness based on scroll progress
          ================================================================= */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none select-none overflow-hidden flex items-end justify-center w-full z-0 h-[380px] sm:h-[480px] lg:h-[580px]"
        aria-hidden="true"
      >
        <div className="relative w-full max-w-[1920px] h-full flex items-end justify-center">
          {/* Master Resting Composite (locks into 100% fidelity once settled) */}
          <div
            ref={masterLayerRef}
            className="absolute inset-0 pointer-events-none will-change-[opacity]"
            style={{ opacity: isReducedMotion ? 1 : 0 }}
          >
            <Image
              src="/images/mountains-dark.webp"
              alt=""
              width={1924}
              height={610}
              priority
              className="w-full h-auto min-h-[300px] sm:min-h-[420px] lg:min-h-[520px] object-cover object-bottom block opacity-95"
            />
          </div>

          {/* Layer 1: Distant Ridge (First to emerge: soft low-contrast atmospheric silhouette) */}
          <div
            ref={layer1Ref}
            className="absolute inset-0 pointer-events-none will-change-[transform,opacity]"
            style={{
              transformOrigin: "center bottom",
              transform: isReducedMotion ? "translate3d(0, 0, 0)" : "translate3d(0, 280px, 0) scaleY(0.9)",
              opacity: isReducedMotion ? 1 : 0,
            }}
          >
            <Image
              src="/images/mountains-layer-1-distant.webp"
              alt=""
              width={1924}
              height={610}
              priority
              className="w-full h-auto min-h-[300px] sm:min-h-[420px] lg:min-h-[520px] object-cover object-bottom block"
            />
          </div>

          {/* Layer 2: Left Mountain (Second: large rounded formation rising on the left) */}
          <div
            ref={layer2Ref}
            className="absolute inset-0 pointer-events-none will-change-[transform,opacity]"
            style={{
              transformOrigin: "center bottom",
              transform: isReducedMotion ? "translate3d(0, 0, 0)" : "translate3d(0, 460px, 0) scaleY(0.86)",
              opacity: isReducedMotion ? 1 : 0,
            }}
          >
            <Image
              src="/images/mountains-layer-2-left.webp"
              alt=""
              width={1924}
              height={610}
              priority
              className="w-full h-auto min-h-[300px] sm:min-h-[420px] lg:min-h-[520px] object-cover object-bottom block"
            />
          </div>

          {/* Layer 3: Central Valley (Third: deeper valley & mid-ridge establishing spatial depth) */}
          <div
            ref={layer3Ref}
            className="absolute inset-0 pointer-events-none will-change-[transform,opacity]"
            style={{
              transformOrigin: "center bottom",
              transform: isReducedMotion ? "translate3d(0, 0, 0)" : "translate3d(0, 300px, 0) scaleY(0.88)",
              opacity: isReducedMotion ? 1 : 0,
            }}
          >
            <Image
              src="/images/mountains-layer-3-center.webp"
              alt=""
              width={1924}
              height={610}
              priority
              className="w-full h-auto min-h-[300px] sm:min-h-[420px] lg:min-h-[520px] object-cover object-bottom block"
            />
          </div>

          {/* Layer 4: Right Mountain (Fourth: towering craggy peak rising independently) */}
          <div
            ref={layer4Ref}
            className="absolute inset-0 pointer-events-none will-change-[transform,opacity]"
            style={{
              transformOrigin: "center bottom",
              transform: isReducedMotion ? "translate3d(0, 0, 0)" : "translate3d(0, 480px, 0) scaleY(0.86)",
              opacity: isReducedMotion ? 1 : 0,
            }}
          >
            <Image
              src="/images/mountains-layer-4-right.webp"
              alt=""
              width={1924}
              height={610}
              priority
              className="w-full h-auto min-h-[300px] sm:min-h-[420px] lg:min-h-[520px] object-cover object-bottom block"
            />
          </div>

          {/* Layer 5: Foreground Terrain (Fifth: closest foreground ridges & bright stippled crests) */}
          <div
            ref={layer5Ref}
            className="absolute inset-0 pointer-events-none will-change-[transform,opacity]"
            style={{
              transformOrigin: "center bottom",
              transform: isReducedMotion ? "translate3d(0, 0, 0)" : "translate3d(0, 320px, 0) scaleY(0.88)",
              opacity: isReducedMotion ? 1 : 0,
            }}
          >
            <Image
              src="/images/mountains-layer-5-foreground.webp"
              alt=""
              width={1924}
              height={610}
              priority
              className="w-full h-auto min-h-[300px] sm:min-h-[420px] lg:min-h-[520px] object-cover object-bottom block"
            />
          </div>

          {/* Bedrock Ground Threshold: Solid dark base the mountains physically pierce and emerge through */}
          <div
            className="absolute inset-x-0 bottom-0 h-28 sm:h-36 pointer-events-none z-10"
            style={{
              background:
                "linear-gradient(to top, #111110 0%, rgba(17,17,16,0.92) 35%, rgba(17,17,16,0) 100%)",
            }}
          />

          {/* Subtle Ambient Light Shimmer Across Mountain Ridges */}
          <div
            ref={lightLayerRef}
            className="absolute inset-0 pointer-events-none mix-blend-screen z-20"
            style={{
              background:
                "radial-gradient(ellipse 65% 45% at 50% 88%, rgba(245,240,230,0.28) 0%, rgba(216,135,98,0.07) 48%, transparent 75%)",
              animation: !isReducedMotion ? "terrainLightDrift 16s ease-in-out infinite" : "none",
            }}
          />
        </div>
      </div>

      {/* =================================================================
          ATMOSPHERIC VIGNETTE FOR UNCOMPROMISED TEXT LEGIBILITY
          Soft radial falloff behind central text ensuring crisp contrast
          ================================================================= */}
      <div
        className="absolute inset-0 pointer-events-none z-[5]"
        style={{
          background:
            "radial-gradient(ellipse 75% 58% at 50% 32%, rgba(17,17,16,0.92) 0%, rgba(17,17,16,0.58) 55%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      {/* =================================================================
          EDITORIAL CONTENT & CALLS TO ACTION (z-10)
          3D Perspective viewport where typography surges from back to front
          ================================================================= */}
      <div
        className="layout-container w-full relative z-10"
        style={{ perspective: "1200px" }}
      >
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center select-text">
          {/* Art-Directed Two-Statement Headline with Per-Character Kinetic Emergence */}
          <h2
            id="cta-heading"
            className="font-sans text-[44px] sm:text-[58px] md:text-[68px] lg:text-[78px] xl:text-[84px] leading-[0.98] sm:leading-[1.02] tracking-[-0.04em] max-w-[880px] mx-auto select-text"
          >
            {/* Line 1: Your code. */}
            <span className="block font-medium text-[#F2F0EB]">
              {LINE_1_WORDS.map((w, wIdx) => {
                const wordStartIdx = LINE_1_WORDS.slice(0, wIdx).reduce(
                  (acc, item) => acc + item.chars.length,
                  0
                );
                return (
                  <span
                    key={w.word}
                    className="inline-block whitespace-nowrap mr-[0.26em] last:mr-0"
                  >
                    {w.chars.map((char, cIdx) => {
                      const charIndex = wordStartIdx + cIdx;
                      return (
                        <span
                          key={cIdx}
                          ref={(el) => {
                            charRefs.current[charIndex] = el;
                          }}
                          className="inline-block will-change-[transform,opacity,filter]"
                          style={{
                            transformOrigin: "center bottom",
                            opacity: isReducedMotion ? 1 : 0,
                          }}
                        >
                          {char}
                        </span>
                      );
                    })}
                  </span>
                );
              })}
            </span>

            {/* Line 2: Ready for what’s next. */}
            <span className="block font-normal text-[#DDD9D0] mt-1.5 sm:mt-2">
              {LINE_2_WORDS.map((w, wIdx) => {
                const line2PrevChars = LINE_2_WORDS.slice(0, wIdx).reduce(
                  (acc, item) => acc + item.chars.length,
                  0
                );
                const wordStartIdx = TOTAL_LINE_1_CHARS + line2PrevChars;
                return (
                  <span
                    key={w.word}
                    className="inline-block whitespace-nowrap mr-[0.26em] last:mr-0"
                  >
                    {w.chars.map((char, cIdx) => {
                      const charIndex = wordStartIdx + cIdx;
                      return (
                        <span
                          key={cIdx}
                          ref={(el) => {
                            charRefs.current[charIndex] = el;
                          }}
                          className="inline-block will-change-[transform,opacity,filter]"
                          style={{
                            transformOrigin: "center bottom",
                            opacity: isReducedMotion ? 1 : 0,
                          }}
                        >
                          {char}
                        </span>
                      );
                    })}
                  </span>
                );
              })}
            </span>
          </h2>

          {/* Refined Supporting Copy */}
          <p
            ref={paragraphRef}
            className="font-sans text-[16.5px] sm:text-[18px] lg:text-[19.5px] leading-[1.55] text-[#9E9B93] max-w-[500px] mx-auto mt-7 sm:mt-8 mb-10 sm:mb-12 will-change-[transform,opacity,filter]"
            style={{
              transformOrigin: "center center",
              opacity: isReducedMotion ? 1 : 0,
            }}
          >
            Bring your next idea to life. Start with your code and build toward
            something worth shipping.
          </p>

          {/* Actions: High-Contrast Burnt Orange Primary + Quiet Border-Defined Secondary */}
          <div
            ref={actionsRef}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-4.5 w-full sm:w-auto will-change-[transform,opacity,filter]"
            style={{
              transformOrigin: "center center",
              opacity: isReducedMotion ? 1 : 0,
            }}
          >
            {/* Primary Action: Direct jump to Onboarding */}
            <Link
              href="#getting-started"
              className="inline-flex items-center justify-center gap-2.5 h-[54px] sm:h-[58px] px-8 sm:px-9 rounded-[8px] bg-accent-orange hover:bg-accent-orange-hover text-[#121110] text-[15px] sm:text-[15.5px] font-semibold transition-all duration-200 shadow-md shadow-accent-orange/15 hover:shadow-accent-orange/25 hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto group"
            >
              <span>Get started</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>

            {/* Secondary Action: Repository Destination */}
            <Link
              href="https://github.com/Deepanshu-2006/jetway"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-[54px] sm:h-[58px] px-7 sm:px-8 rounded-[8px] bg-[#181817]/90 hover:bg-[#222220] border border-white/12 hover:border-white/22 text-[#E8E6E0] hover:text-[#F5F5F3] text-[14.5px] sm:text-[15px] font-medium transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-sm w-full sm:w-auto group"
            >
              <span>GitHub repository</span>
              <ExternalLink className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FinalCta;
