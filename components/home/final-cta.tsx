"use client";

import React, { useRef, useEffect, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";

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

const HEADLINE_LINES = [
  { words: ["Your", "code."], color: "text-[#F2F0EB]", weight: "font-medium" },
  { words: ["Ready", "for"], color: "text-[#DDD8CE]", weight: "font-normal" },
  { words: ["what’s", "next."], color: "text-[#C2BCAD]", weight: "font-normal" },
];

const TOTAL_HEADLINE_CHARS = HEADLINE_LINES.reduce(
  (acc, line) => acc + line.words.reduce((wAcc, w) => wAcc + w.length, 0),
  0
);

/**
 * FinalCta: Section 08 — Final Call to Action
 * "Your code. Ready for what’s next."
 * Locked-Screen Multi-Stage Cinematic Reveal:
 * 1. Screen locks in place with extended scroll track (h-[360vh] sm:h-[380vh] lg:h-[400vh])
 * 2. Stage 0: Clouds sweep in and seal shut ("clouds came and got closed")
 * 3. Stage 1 & 2: Clouds open wide and mountain horizon emerges simultaneously
 * 4. Stage 3: Independent alphabet-by-alphabet kinetic typographic emergence
 * 5. Stage 4: Settled plateau where the complete scene remains stable and interactive
 */
export function FinalCta() {
  const sectionRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Diagrammatic cloud section references (Dedicated Left & Right sections)
  const cloudLeftRef = useRef<HTMLDivElement>(null);
  const cloudRightRef = useRef<HTMLDivElement>(null);

  // Emerging mountain horizon reference (Rises upward after clouds part, before text)
  const mountainRef = useRef<HTMLDivElement>(null);

  // Staggered editorial section references
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const subcopyRef = useRef<HTMLParagraphElement>(null);
  const ctaAreaRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  // Synchronously subscribe to reduced motion preference
  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  useEffect(() => {
    // If reduced motion is requested, render static open framing
    if (isReducedMotion) {
      const resetEl = (el: HTMLElement | null, transform = "none", opacity = "1") => {
        if (!el) return;
        el.style.transform = transform;
        el.style.opacity = opacity;
        el.style.filter = "none";
        el.style.transition = "none";
      };

      resetEl(cloudLeftRef.current, "translate3d(-900px, 0, 0)", "0.85");
      resetEl(cloudRightRef.current, "translate3d(900px, 0, 0)", "0.85");
      resetEl(mountainRef.current, "translate3d(0, 0, 0)", "1.0");
      resetEl(contentWrapperRef.current, "none", "1");
      charRefs.current.forEach((el) => resetEl(el, "none", "1"));
      resetEl(subcopyRef.current, "none", "1");
      resetEl(ctaAreaRef.current, "none", "1");
      resetEl(detailsRef.current, "none", "1");
      return;
    }

    const section = sectionRef.current;
    if (!section) return;

    let targetP = 0;
    let currentP = 0;
    let isInitialized = false;
    let rafId: number | null = null;
    let entryStartTime: number | null = null;

    // Quintic smootherstep polynomial (Ken Perlin): 6t^5 - 15t^4 + 10t^3
    // Yields completely continuous derivatives (zero initial velocity and acceleration)
    // for silky, organic cloud parting and mountain emergence
    const smootherstep = (t: number) => {
      const c = Math.max(0, Math.min(1, t));
      return c * c * c * (c * (c * 6 - 15) + 10);
    };

    // Compute locked scroll progress p in [0.0, 1.0]
    // Section pins when rect.top <= 0, and unpins when user scrolls through track
    const computeTargetP = () => {
      if (!section) return 0;
      const rect = section.getBoundingClientRect();
      const scrollTrack = rect.height - window.innerHeight;
      if (scrollTrack <= 0) return 0;

      // When section top is above viewport (pinned): -rect.top advances from 0 to scrollTrack
      const rawP = -rect.top / scrollTrack;
      return Math.min(1.0, Math.max(0.0, rawP));
    };

    const render = (p: number, now: number) => {
      const isMobile = window.innerWidth < 640;
      const isTablet = window.innerWidth >= 640 && window.innerWidth < 1024;

      // =================================================================
      // STAGE 0: ENTRY SEAL ANIMATION ("Clouds came and got closed")
      // As the user arrives at this section, clouds glide in from the sides
      // and seal shut in the center, before parting.
      // =================================================================
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      const scrollApproach =
        rect.top <= 0
          ? 1.0
          : Math.max(0.0, 1.0 - rect.top / (vh * 0.85));

      const timeElapsed =
        entryStartTime !== null ? (now - entryStartTime) / 800 : 1.0;
      const timeSeal = Math.min(1.0, Math.max(0.0, timeElapsed));

      // As user arrives, entrySeal goes from 0 (separated) to 1.0 (sealed)
      const entrySeal =
        p > 0.02
          ? 1.0
          : Math.max(smootherstep(timeSeal), smootherstep(scrollApproach));

      const entrySeparation =
        (1 - entrySeal) * (isMobile ? 260 : isTablet ? 360 : 480);

      // =================================================================
      // STAGE 1: CLOUDS OPEN WIDE (p in [0.03 .. 0.50])
      // Using quintic smootherstep for ultra-fluid, organic opening with zero initial jerk
      // =================================================================
      let rawOpen = 0;
      if (p >= 0.03) {
        rawOpen = Math.min(1.0, (p - 0.03) / 0.47);
      }
      const openFactor = smootherstep(rawOpen);

      // Generous wide offset so clouds travel significantly further to left and right
      const outOffset = Math.max(
        window.innerWidth * 0.78,
        isMobile ? 640 : isTablet ? 980 : 1420
      );

      const xLeft = (-entrySeparation - outOffset * openFactor).toFixed(2);
      const xRight = (entrySeparation + outOffset * openFactor).toFixed(2);

      // Subtle atmospheric dissipation
      const sCloud = (1.0 + 0.035 * openFactor).toFixed(3);
      const yCloud = (-10 * openFactor).toFixed(2);
      const opCloud = (
        (0.72 + 0.24 * entrySeal) * (1.0 - 0.35 * openFactor)
      ).toFixed(3);

      if (cloudLeftRef.current) {
        cloudLeftRef.current.style.transform = `translate3d(${xLeft}px, ${yCloud}px, 0) scale(${sCloud})`;
        cloudLeftRef.current.style.opacity = opCloud;
      }
      if (cloudRightRef.current) {
        cloudRightRef.current.style.transform = `translate3d(${xRight}px, ${yCloud}px, 0) scale(${sCloud})`;
        cloudRightRef.current.style.opacity = opCloud;
      }

      // =================================================================
      // STAGE 2: MOUNTAIN HORIZON EMERGES IN LOCKSTEP (p in [0.03 .. 0.50])
      // Ascends simultaneously with the cloud parting in perfect harmony
      // =================================================================
      let rawMountain = 0;
      if (p >= 0.03) {
        rawMountain = Math.min(1.0, (p - 0.03) / 0.47);
      }
      const mountainFactor = smootherstep(rawMountain);

      if (mountainRef.current) {
        const baseOffsetY = isMobile ? 140 : isTablet ? 180 : 220;
        const mountainY = (baseOffsetY * (1 - mountainFactor)).toFixed(2);
        const mountainOp = (mountainFactor * 1.0).toFixed(3);
        const mountainScale = (0.96 + 0.04 * mountainFactor).toFixed(3);

        mountainRef.current.style.transform = `translate3d(0, ${mountainY}px, 0) scale(${mountainScale})`;
        mountainRef.current.style.opacity = mountainOp;
      }

      // =================================================================
      // STAGE 3: INDEPENDENT ALPHABET-BY-ALPHABET EMERGENCE (p in [0.46 .. 0.76])
      // Each letter ascends from underneath independently in rhythmic cascade
      // =================================================================
      charRefs.current.forEach((el, i) => {
        if (!el) return;
        const start = 0.46 + (i / TOTAL_HEADLINE_CHARS) * 0.20;
        const dur = 0.08;
        let f = 0;
        if (p >= start + dur) f = 1;
        else if (p > start) f = smootherstep((p - start) / dur);

        const y = (110 * (1 - f)).toFixed(1);
        const op = f.toFixed(3);
        el.style.transform = `translate3d(0, ${y}%, 0)`;
        el.style.opacity = op;
      });

      // Supporting copy, CTA area, and field notes reveal
      const getFactor = (start: number, end: number) => {
        if (p < start) return 0;
        if (p >= end) return 1;
        return smootherstep((p - start) / (end - start));
      };

      const subcopyFactor = getFactor(0.68, 0.82);
      const ctaFactor = getFactor(0.74, 0.88);
      const detailsFactor = getFactor(0.80, 0.92);

      const applyStagger = (el: HTMLElement | null, factor: number, distY = 16) => {
        if (!el) return;
        const y = (distY * (1 - factor)).toFixed(2);
        el.style.transform = `translate3d(0, ${y}px, 0)`;
        el.style.opacity = factor.toFixed(3);
      };

      if (contentWrapperRef.current) {
        contentWrapperRef.current.style.opacity = p >= 0.44 ? "1" : "0";
      }

      applyStagger(subcopyRef.current, subcopyFactor, 16);
      applyStagger(ctaAreaRef.current, ctaFactor, 16);
      applyStagger(detailsRef.current, detailsFactor, 12);
    };

    const resetToInitialState = () => {
      targetP = 0;
      currentP = 0;
      entryStartTime = null;
      isInitialized = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      lastTime = null;

      const isMobile = window.innerWidth < 640;
      const isTablet = window.innerWidth >= 640 && window.innerWidth < 1024;
      const initialSep = isMobile ? 260 : isTablet ? 360 : 480;

      // Reset clouds to separated pre-entry stance
      if (cloudLeftRef.current) {
        cloudLeftRef.current.style.transform = `translate3d(-${initialSep}px, 0, 0) scale(1)`;
        cloudLeftRef.current.style.opacity = "0.72";
      }
      if (cloudRightRef.current) {
        cloudRightRef.current.style.transform = `translate3d(${initialSep}px, 0, 0) scale(1)`;
        cloudRightRef.current.style.opacity = "0.72";
      }

      // Reset mountain to hidden stance below horizon
      if (mountainRef.current) {
        const baseOffsetY = isMobile ? 140 : isTablet ? 180 : 220;
        mountainRef.current.style.transform = `translate3d(0, ${baseOffsetY}px, 0) scale(0.96)`;
        mountainRef.current.style.opacity = "0";
      }

      // Reset headline characters (hidden underneath mask)
      charRefs.current.forEach((el) => {
        if (!el) return;
        el.style.transform = "translate3d(0, 110%, 0)";
        el.style.opacity = "0";
      });

      // Reset editorial content wrapper and supporting copy
      if (contentWrapperRef.current) {
        contentWrapperRef.current.style.opacity = "0";
      }
      if (subcopyRef.current) {
        subcopyRef.current.style.transform = "translate3d(0, 16px, 0)";
        subcopyRef.current.style.opacity = "0";
      }
      if (ctaAreaRef.current) {
        ctaAreaRef.current.style.transform = "translate3d(0, 16px, 0)";
        ctaAreaRef.current.style.opacity = "0";
      }
      if (detailsRef.current) {
        detailsRef.current.style.transform = "translate3d(0, 12px, 0)";
        detailsRef.current.style.opacity = "0";
      }
    };

    let lastTime: number | null = null;

    // Responsive interpolation loop synchronized with Lenis
    const tick = (now: number) => {
      if (lastTime === null) lastTime = now;
      const dt = Math.min(0.05, Math.max(0.008, (now - lastTime) / 1000));
      lastTime = now;

      const diff = targetP - currentP;
      const isSealing =
        entryStartTime !== null && now - entryStartTime < 850 && currentP <= 0.03;

      if (Math.abs(diff) < 0.0004 && !isSealing) {
        currentP = targetP;
        render(currentP, now);
        rafId = null;
        lastTime = null;
        return;
      }

      // Synchronized interpolation that tracks Lenis smooth scroll curvature cleanly
      const lerpRate = 18.0;
      const step = diff * (1 - Math.exp(-lerpRate * dt));

      currentP += step;
      render(currentP, now);
      rafId = requestAnimationFrame(tick);
    };

    const requestTick = () => {
      targetP = computeTargetP();
      if (rafId === null) {
        lastTime = null;
        rafId = requestAnimationFrame(tick);
      }
    };

    const onScroll = () => {
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;

      // 1. User scrolled UP past the section (section is completely below viewport)
      if (rect.top >= vh) {
        if (isInitialized || currentP > 0 || entryStartTime !== null) {
          resetToInitialState();
        }
        return;
      }

      // 2. User scrolled DOWN past the section (section is completely above viewport)
      if (rect.bottom <= 0) {
        if (isInitialized || currentP > 0 || entryStartTime !== null) {
          resetToInitialState();
        }
        return;
      }

      // 3. Section is approaching or inside viewport
      if (entryStartTime === null) {
        entryStartTime = performance.now();
      }

      isInitialized = true;
      requestTick();
    };

    const onResize = () => {
      onScroll();
    };

    // Keep scroll and resize listeners actively registered
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    // IntersectionObserver as secondary guard for layout shifts
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          const rect = entry.boundingClientRect;
          if (rect.top >= window.innerHeight || rect.bottom <= 0) {
            resetToInitialState();
          }
        } else {
          onScroll();
        }
      },
      { rootMargin: "0px", threshold: 0 }
    );

    observer.observe(section);

    // Initial check on mount
    const initialRect = section.getBoundingClientRect();
    const initialVh = window.innerHeight;
    if (initialRect.top < initialVh && initialRect.bottom > 0) {
      entryStartTime = performance.now() - 1000;
      targetP = computeTargetP();
      currentP = targetP;
      render(currentP, performance.now());
      isInitialized = true;
    } else {
      resetToInitialState();
    }

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
      className="relative z-20 w-full h-[360vh] sm:h-[380vh] lg:h-[400vh] bg-transparent text-text-primary select-none"
      aria-labelledby="cta-heading"
    >
      {/* =================================================================
          LOCKED SCREEN STICKY VIEWPORT (Pins to viewport during scroll track)
          ================================================================= */}
      <div
        ref={viewportRef}
        className="sticky top-0 z-20 w-full h-screen overflow-hidden flex flex-col justify-center items-center bg-transparent select-none"
      >
        {/* =================================================================
            EMERGING MOUNTAIN HORIZON (z-[5]: Rises upward after clouds part, BEFORE text)
            Full-width photorealistic mountain panorama spanning 100% viewport width
            Initial state: completely hidden (opacity 0, translateY 220px)
            ================================================================= */}
        <div
          ref={mountainRef}
          className="absolute bottom-0 left-0 w-full pointer-events-none select-none will-change-[transform,opacity] z-[5] flex items-end justify-center overflow-hidden"
          style={{ opacity: 0, transform: "translate3d(0, 220px, 0)" }}
          aria-hidden="true"
        >
          <Image
            src="/images/mountains-photorealistic.webp"
            alt=""
            width={3840}
            height={1279}
            priority
            unoptimized
            className="w-full h-auto min-w-full min-h-[240px] sm:min-h-[320px] md:min-h-[380px] lg:min-h-[460px] max-h-[64vh] object-cover object-bottom block"
          />
        </div>

        {/* =================================================================
            GEOLOGICAL EDITORIAL COMPOSITION (z-[10])
            Asymmetric single-column editorial composition (~55-65% width)
            Framed naturally by the towering mountain silhouettes on left & right
            ================================================================= */}
        <div
          ref={contentWrapperRef}
          className="layout-container w-full relative z-[10] flex justify-start items-center"
          style={{ opacity: 0 }}
        >

          <div className="w-full max-w-[700px] xl:max-w-[760px] flex flex-col items-start text-left select-text lg:pl-2 xl:pl-6">
            {/* Main Headline — Independent Alphabet-by-Alphabet Kinetic Emergence */}
            <h2
              id="cta-heading"
              className="font-sans text-[44px] sm:text-[58px] md:text-[68px] lg:text-[76px] xl:text-[84px] leading-[0.96] sm:leading-[0.98] tracking-[-0.038em] max-w-[660px] select-text"
            >
              {(() => {
                let charCounter = 0;
                return HEADLINE_LINES.map((line, lineIdx) => (
                  <span
                    key={lineIdx}
                    className={`block ${line.color} ${line.weight} ${
                      lineIdx > 0 ? "mt-0.5 sm:mt-1" : ""
                    }`}
                  >
                    {line.words.map((word, wordIdx) => (
                      <span
                        key={wordIdx}
                        className="inline-block whitespace-nowrap"
                      >
                        {Array.from(word).map((char, charIdx) => {
                          const currIdx = charCounter++;
                          return (
                            <span
                              key={charIdx}
                              className="inline-block overflow-hidden pb-1 -mb-1 align-bottom"
                            >
                              <span
                                ref={(el) => {
                                  charRefs.current[currIdx] = el;
                                }}
                                className="inline-block will-change-transform"
                                style={{
                                  transform: "translate3d(0, 110%, 0)",
                                  opacity: 0,
                                }}
                              >
                                {char}
                              </span>
                            </span>
                          );
                        })}
                        {wordIdx < line.words.length - 1 && (
                          <span className="inline-block">&nbsp;</span>
                        )}
                      </span>
                    ))}
                  </span>
                ));
              })()}
            </h2>

            {/* Level C: Supporting Copy */}
            <p
              ref={subcopyRef}
              className="font-sans text-[17px] sm:text-[18px] lg:text-[19px] leading-[1.6] text-[#9A968E] max-w-[460px] mt-6 sm:mt-7 lg:mt-8 select-text will-change-[transform,opacity]"
              style={{ opacity: 0 }}
            >
              Bring your next idea to life. Build toward something worth shipping.
            </p>

            {/* Unified Editorial Action Area */}
            <div
              ref={ctaAreaRef}
              className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mt-8 sm:mt-9 w-full sm:w-auto will-change-[transform,opacity]"
              style={{ opacity: 0 }}
            >
              {/* Primary Action: Start building */}
              <Link
                href="#getting-started"
                className="inline-flex items-center justify-between sm:justify-center gap-3.5 h-[50px] sm:h-[52px] px-7 sm:px-8 rounded-[6px] bg-accent-orange hover:bg-accent-orange-hover text-[#121110] text-[15px] font-medium tracking-[-0.01em] transition-all duration-200 shadow-sm shadow-accent-orange/15 hover:shadow-accent-orange/25 active:translate-y-0 w-full sm:w-auto group"
              >
                <span>Start building</span>
                <span
                  aria-hidden="true"
                  className="text-[15px] font-sans transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                >
                  ↗
                </span>
              </Link>

              {/* Secondary Action: Explore the repository */}
              <Link
                href="https://github.com/Deepanshu-2006/jetway"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[14px] font-mono text-[#8E8A82] hover:text-[#F2F0EB] transition-colors duration-200 py-1 group"
              >
                <span className="border-b border-[#3E3B37] group-hover:border-[#F2F0EB] transition-colors duration-200 pb-0.5">
                  Explore the repository
                </span>
                <span
                  aria-hidden="true"
                  className="text-[13px] leading-none text-[#77736D] group-hover:text-[#F2F0EB] transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                >
                  ↗
                </span>
              </Link>
            </div>

            {/* Subtle Editorial Anchor Detail */}
            <div
              ref={detailsRef}
              className="mt-8 pt-4 border-t border-[#252523] flex items-center gap-3 select-text will-change-[transform,opacity]"
              style={{ opacity: 0 }}
            >
              <span className="w-1 h-1 rounded-full bg-[#524E48]" aria-hidden="true" />
              <span className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-[#6B6760]">
                BUILT TO SHIP // LATENCY 14MS
              </span>
            </div>
          </div>
        </div>

        {/* =================================================================
            LEFT CLOUD SECTION (z-[15]: Towering diagrammatic illustration)
            ================================================================= */}
        <div
          ref={cloudLeftRef}
          className="absolute -left-[12vw] sm:-left-[8vw] lg:-left-[5vw] top-1/2 -translate-y-1/2 h-[94vh] sm:h-[96vh] lg:h-[98vh] max-h-screen w-auto pointer-events-none select-none will-change-[transform,opacity] z-[15] flex items-center justify-start"
          aria-hidden="true"
        >
          <Image
            src="/images/clouds/diagram-cloud-left-v2.webp"
            alt=""
            width={1200}
            height={896}
            priority
            className="h-full w-auto max-w-none object-contain block opacity-90"
          />
        </div>

        {/* =================================================================
            RIGHT CLOUD SECTION (z-[15]: Towering diagrammatic illustration)
            ================================================================= */}
        <div
          ref={cloudRightRef}
          className="absolute -right-[12vw] sm:-right-[8vw] lg:-right-[5vw] top-1/2 -translate-y-1/2 h-[94vh] sm:h-[96vh] lg:h-[98vh] max-h-screen w-auto pointer-events-none select-none will-change-[transform,opacity] z-[15] flex items-center justify-end"
          aria-hidden="true"
        >
          <Image
            src="/images/clouds/diagram-cloud-right-v2.webp"
            alt=""
            width={1200}
            height={896}
            priority
            className="h-full w-auto max-w-none object-contain block opacity-90"
          />
        </div>

        {/* =================================================================
            ATMOSPHERIC PERIMETER FALLOFF (z-[25])
            Clean transparent transition at top to seamlessly preserve ambient stardust/glow,
            with gentle feathering into #111111 only at the bottom before footer
            ================================================================= */}
        <div
          className="absolute inset-0 pointer-events-none z-[25]"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, transparent 85%, #111111 100%)",
          }}
          aria-hidden="true"
        />
      </div>
    </section>
  );
}

export default FinalCta;
