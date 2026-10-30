"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
} from "react";
import Image from "next/image";
import { useLenis } from "@/components/layout/smooth-scroll-provider";

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
 * GettingStarted: Section 07 — The Deployment Journey
 * "From first commit to first deploy."
 *
 * Completely Redesigned into a Premium, Cinematic, Editorial Experience:
 * - Mountain Background: Authentic engraved alpine panorama (mountains-dark-v2.webp)
 * - Three Minimalist Editorial Moments:
 *     01 / SOURCE: Code committed. (Your repository, ready to build.)
 *     02 / BUILD: Build verified. (Dependencies resolved. Output ready.)
 *     03 / LIVE: Now it’s live. (Deployed and ready for traffic.)
 * - Single continuous refined burnt-orange trail with restrained travelling light beacon.
 * - Smooth, natural in-flow scrolling synchronized with Lenis (no scroll hijacking or forced pinning).
 * - Zero dashboard cards or technical clutter.
 */
export function GettingStarted() {
  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const sectionRef = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const mobilePathRef = useRef<SVGPathElement>(null);

  // Direct DOM refs for 60fps/120fps hardware-accelerated travelling light
  const traveledLineRef = useRef<SVGPathElement>(null);
  const mobileTraveledLineRef = useRef<SVGPathElement>(null);
  const beaconRef = useRef<SVGGElement>(null);
  const mobileBeaconRef = useRef<SVGGElement>(null);

  const pathLengthRef = useRef<number>(1000);
  const mobilePathLengthRef = useRef<number>(600);

  // Animated progress state [0.0 to 1.0]
  const animRef = useRef({
    currentProgress: 0,
    targetProgress: 0,
    rafId: null as number | null,
  });

  const [activeStage, setActiveStage] = useState<1 | 2 | 3>(1);
  const [sectionEntered, setSectionEntered] = useState(false);

  // Desktop Trail Path Coordinates:
  // Starts at lower-left foothills (140, 270)
  // Crosses center saddle pass (520, 180)
  // Ascends to high alpine summit crest (1040, 50)
  // Passes cleanly ABOVE and BETWEEN text moments without crossing headings
  const desktopTrailD =
    "M 140 270 " +
    "C 260 270, 380 220, 520 180 " +
    "C 640 145, 780 110, 900 75 " +
    "C 950 60, 995 52, 1040 50";

  // Mobile Vertical Trail Path Coordinates:
  // Downward route down the left margin connecting the 3 vertically stacked milestones
  const mobileTrailD =
    "M 32 40 " +
    "C 48 85, 20 135, 32 180 " +
    "C 44 225, 20 270, 32 320 " +
    "C 44 365, 20 410, 32 460";

  // Measure path lengths on mount and window resize
  useEffect(() => {
    const measure = () => {
      if (pathRef.current) {
        try {
          const len = pathRef.current.getTotalLength();
          if (len > 0) pathLengthRef.current = len;
        } catch {}
      }
      if (mobilePathRef.current) {
        try {
          const len = mobilePathRef.current.getTotalLength();
          if (len > 0) mobilePathLengthRef.current = len;
        } catch {}
      }
    };

    measure();
    window.addEventListener("resize", measure, { passive: true });
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Update travelling light beacon and traveled line via direct DOM manipulation
  const updateVisuals = useCallback(
    (p: number) => {
      const desktopPath = pathRef.current;
      const totalLen = pathLengthRef.current;

      if (desktopPath && totalLen > 0) {
        const clampedDist = Math.max(0, Math.min(totalLen, p * totalLen));
        const pt = desktopPath.getPointAtLength(clampedDist);

        // Position travelling light beacon
        if (beaconRef.current) {
          beaconRef.current.setAttribute("transform", `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
        }

        // Draw active burnt-orange path
        const offset = Math.max(0, totalLen - clampedDist);
        if (traveledLineRef.current) {
          traveledLineRef.current.style.strokeDashoffset = `${offset.toFixed(1)}px`;
        }
      }

      // Mobile
      const mobilePath = mobilePathRef.current;
      const mobileTotalLen = mobilePathLengthRef.current;

      if (mobilePath && mobileTotalLen > 0) {
        const clampedDist = Math.max(0, Math.min(mobileTotalLen, p * mobileTotalLen));
        const pt = mobilePath.getPointAtLength(clampedDist);

        if (mobileBeaconRef.current) {
          mobileBeaconRef.current.setAttribute("transform", `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
        }

        const offset = Math.max(0, mobileTotalLen - clampedDist);
        if (mobileTraveledLineRef.current) {
          mobileTraveledLineRef.current.style.strokeDashoffset = `${offset.toFixed(1)}px`;
        }
      }
    },
    []
  );

  // Smooth animation tick loop (60fps/120fps with damping)
  const startTick = useCallback(() => {
    const anim = animRef.current;
    if (anim.rafId !== null) return;

    const tick = () => {
      const diff = anim.targetProgress - anim.currentProgress;

      if (Math.abs(diff) < 0.001) {
        anim.currentProgress = anim.targetProgress;
        updateVisuals(anim.currentProgress);
        anim.rafId = null;
        return;
      }

      anim.currentProgress += diff * 0.12;
      updateVisuals(anim.currentProgress);

      const p = anim.currentProgress;
      const stage = p < 0.32 ? 1 : p < 0.72 ? 2 : 3;
      setActiveStage(stage);

      anim.rafId = requestAnimationFrame(tick);
    };

    anim.rafId = requestAnimationFrame(tick);
  }, [updateVisuals]);

  // Compute natural in-flow scroll progress as visitor scrolls past section
  const computeScrollProgress = useCallback(() => {
    if (!sectionRef.current) return;

    const rect = sectionRef.current.getBoundingClientRect();
    const vh = window.innerHeight;

    // Viewport focal window: progress begins as section enters bottom half,
    // completes naturally as the section crests through center
    const triggerStart = vh * 0.85;
    const triggerEnd = vh * 0.10;
    const scrollTravel = triggerStart - triggerEnd + rect.height * 0.35;

    const currentScroll = triggerStart - rect.top;
    const rawProgress = currentScroll / scrollTravel;
    const clampedProgress = Math.max(0, Math.min(1, rawProgress));

    if (rect.top < vh * 0.95 && rect.bottom > 0) {
      setSectionEntered(true);
    }

    animRef.current.targetProgress = clampedProgress;

    if (isReducedMotion) {
      animRef.current.currentProgress = clampedProgress;
      updateVisuals(clampedProgress);
      const stage = clampedProgress < 0.32 ? 1 : clampedProgress < 0.72 ? 2 : 3;
      setActiveStage(stage);
      return;
    }

    startTick();
  }, [isReducedMotion, startTick, updateVisuals]);

  // Synchronize with site-wide Lenis smooth scroll
  useLenis(() => {
    computeScrollProgress();
  });

  // Native scroll fallback
  useEffect(() => {
    window.addEventListener("scroll", computeScrollProgress, { passive: true });
    window.addEventListener("resize", computeScrollProgress, { passive: true });

    // Initial calculation on mount
    const timer = setTimeout(() => {
      computeScrollProgress();
    }, 60);

    const anim = animRef.current;
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", computeScrollProgress);
      window.removeEventListener("resize", computeScrollProgress);
      if (anim.rafId !== null) {
        cancelAnimationFrame(anim.rafId);
      }
    };
  }, [computeScrollProgress]);

  // Effective visual stage for reduced-motion users
  const currentStage = isReducedMotion ? 3 : activeStage;

  return (
    <section
      ref={sectionRef}
      id="getting-started"
      className="relative w-full py-28 sm:py-36 lg:py-44 bg-transparent text-[#F2F0EB] select-none overflow-hidden"
      aria-labelledby="getting-started-heading"
    >
      <div className="layout-container w-full relative z-10 select-text">

        {/* =============================================================
            1. EDITORIAL INTRODUCTION
            Clean, confident typographic presence with deliberate line break
            ============================================================= */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 lg:gap-16 mb-12 sm:mb-16 lg:mb-20">
          <div>
            {/* Small understated section identifier */}
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
              <span className="font-mono text-[11px] text-[#8E8A82] tracking-[0.16em] uppercase">
                THE DEPLOYMENT JOURNEY
              </span>
            </div>

            {/* Confident Heading */}
            <h2
              id="getting-started-heading"
              className="font-sans text-[32px] sm:text-[42px] lg:text-[48px] font-medium leading-[1.08] tracking-[-0.035em] text-[#F2F0EB]"
            >
              From first commit<br className="hidden sm:inline" /> to first deploy.
            </h2>
          </div>

          {/* Supporting Copy */}
          <p className="font-sans text-[14px] sm:text-[15px] text-[#8E8A82] leading-[1.65] max-w-[440px] pb-1 shrink-0">
            Your next deployment doesn’t need a complicated setup. Start with your
            code, configure your application, and get ready to ship.
          </p>
        </div>

        {/* =============================================================
            2. THE MOUNTAIN ASCENT VISUAL CANVAS
            Pure editorial composition directly embedded in the landscape.
            Zero cards, zero borders, zero dashboard containers.
            ============================================================= */}
        <div className="relative w-full min-h-[440px] sm:min-h-[480px] lg:min-h-[520px] flex flex-col justify-between">

          {/* -----------------------------------------------------------
              A. BACKGROUND MOUNTAIN PANORAMA (mountains-dark-v2.webp)
              Layered peaks, natural contour relief, deep black negative space.
              ----------------------------------------------------------- */}
          <div
            className={`absolute inset-0 pointer-events-none select-none transition-opacity duration-1000 ease-out ${
              sectionEntered || isReducedMotion ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden="true"
          >
            {/* Mountain Image */}
            <div className="relative w-full h-full">
              <Image
                src="/images/mountains-dark-v2.webp"
                alt=""
                fill
                quality={85}
                sizes="(max-width: 1024px) 100vw, 1200px"
                className="object-cover object-bottom opacity-75 sm:opacity-85 mix-blend-screen"
              />
            </div>

            {/* Natural gradient fades to integrate seamlessly into #111111 */}
            <div
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{
                background:
                  "linear-gradient(to bottom, #111111 0%, transparent 25%, transparent 75%, #111111 100%)",
              }}
            />

            {/* Subtle atmospheric warm underglow */}
            <div
              className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
              style={{
                background:
                  "radial-gradient(ellipse 70% 50% at 50% 65%, rgba(216, 135, 98, 0.06) 0%, transparent 70%)",
              }}
            />
          </div>

          {/* -----------------------------------------------------------
              B. DESKTOP / TABLET DEPLOYMENT TRAIL & TRAVELLING LIGHT
              (Single continuous line connecting Source → Build → Live)
              ----------------------------------------------------------- */}
          <div className="hidden lg:block absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
            <svg
              viewBox="0 0 1200 420"
              preserveAspectRatio="none"
              fill="none"
              className="w-full h-full overflow-visible"
            >
              <defs>
                {/* Soft glow for travelling beacon */}
                <filter id="beaconGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* 1. Underlying Baseline Trail (Muted contour route) */}
              <path
                ref={pathRef}
                d={desktopTrailD}
                stroke="#2B2825"
                strokeWidth="1.2"
                strokeDasharray="2 6"
                strokeLinecap="round"
              />

              {/* 2. Traveled Active Trail (Burnt-orange single line) */}
              <path
                ref={traveledLineRef}
                d={desktopTrailD}
                stroke="#D88762"
                strokeWidth="1.5"
                strokeLinecap="round"
                style={{
                  strokeDasharray: "1000px 1000px",
                  strokeDashoffset: isReducedMotion ? "0px" : "1000px",
                }}
              />

              {/* 3. Three Milestone Waypoint Reticles */}
              {/* Station 01 Marker */}
              <circle
                cx="140"
                cy="270"
                r="3.5"
                fill="#111110"
                stroke={currentStage >= 1 ? "#D88762" : "#44403B"}
                strokeWidth="1.5"
              />
              <circle
                cx="140"
                cy="270"
                r="1.5"
                fill={currentStage >= 1 ? "#D88762" : "#2B2825"}
              />

              {/* Station 02 Marker */}
              <circle
                cx="520"
                cy="180"
                r="3.5"
                fill="#111110"
                stroke={currentStage >= 2 ? "#D88762" : "#44403B"}
                strokeWidth="1.5"
              />
              <circle
                cx="520"
                cy="180"
                r="1.5"
                fill={currentStage >= 2 ? "#D88762" : "#2B2825"}
              />

              {/* Station 03 Marker (Summit Arrival) */}
              <circle
                cx="1040"
                cy="50"
                r="4"
                fill="#111110"
                stroke={currentStage >= 3 ? "#82B89D" : "#44403B"}
                strokeWidth="1.5"
              />
              <circle
                cx="1040"
                cy="50"
                r="1.8"
                fill={currentStage >= 3 ? "#82B89D" : "#2B2825"}
              />

              {/* 4. Restrained Travelling Light Beacon */}
              <g ref={beaconRef} className="will-change-transform" transform="translate(140, 270)">
                <circle cx="0" cy="0" r="10" fill="#D88762" opacity="0.22" filter="url(#beaconGlow)" />
                <circle cx="0" cy="0" r="5" fill="#E58B65" opacity="0.5" />
                <circle cx="0" cy="0" r="2.5" fill="#FAF8F5" />
              </g>
            </svg>
          </div>

          {/* -----------------------------------------------------------
              C. DESKTOP ASYMMETRIC EDITORIAL MOMENTS (>= 1024px)
              Directly positioned into the landscape with generous breathing room.
              ----------------------------------------------------------- */}
          <div className="hidden lg:grid grid-cols-12 gap-8 w-full h-full relative z-10 pointer-events-none min-h-[440px]">

            {/* =========================================================
                STAGE 01: SOURCE (Lower Left Foothills)
                ========================================================= */}
            <div className="col-span-4 flex flex-col justify-end pb-3 pointer-events-auto">
              <div
                className={`space-y-1.5 max-w-[280px] transition-all duration-500 ease-out ${
                  currentStage >= 1 ? "opacity-100 translate-y-0" : "opacity-35 translate-y-2"
                }`}
              >
                {/* 1. Small stage number */}
                <div
                  className={`font-mono text-[11px] tracking-[0.16em] uppercase transition-colors duration-400 ${
                    currentStage >= 1 ? "text-accent-orange font-medium" : "text-[#66635D]"
                  }`}
                >
                  01 / SOURCE
                </div>

                {/* 2. Strong, short heading */}
                <h3
                  className={`font-sans text-[22px] xl:text-[24px] font-medium tracking-tight transition-colors duration-400 ${
                    currentStage >= 1 ? "text-[#F2F0EB]" : "text-[#77736D]"
                  }`}
                >
                  Code committed.
                </h3>

                {/* 3. One concise supporting line */}
                <p className="font-sans text-[13.5px] text-[#8E8A82] leading-[1.55]">
                  Your repository, ready to build.
                </p>
              </div>
            </div>

            {/* =========================================================
                STAGE 02: BUILD (Center Saddle Pass)
                ========================================================= */}
            <div className="col-span-4 flex flex-col justify-center items-center pointer-events-auto pt-10">
              <div
                className={`space-y-1.5 max-w-[300px] w-full transition-all duration-500 ease-out ${
                  currentStage >= 2 ? "opacity-100 translate-y-0" : "opacity-35 translate-y-2"
                }`}
              >
                {/* 1. Small stage number */}
                <div
                  className={`font-mono text-[11px] tracking-[0.16em] uppercase transition-colors duration-400 ${
                    currentStage >= 2 ? "text-accent-orange font-medium" : "text-[#66635D]"
                  }`}
                >
                  02 / BUILD
                </div>

                {/* 2. Strong, short heading */}
                <h3
                  className={`font-sans text-[22px] xl:text-[24px] font-medium tracking-tight transition-colors duration-400 ${
                    currentStage >= 2 ? "text-[#F2F0EB]" : "text-[#77736D]"
                  }`}
                >
                  Build verified.
                </h3>

                {/* 3. One concise supporting line */}
                <p className="font-sans text-[13.5px] text-[#8E8A82] leading-[1.55]">
                  Dependencies resolved. Output ready.
                </p>

                {/* Small, refined terminal-style indicator */}
                <div
                  className={`pt-1.5 flex items-center gap-2 font-mono text-[11px] transition-opacity duration-500 ${
                    currentStage >= 2 ? "opacity-100 text-[#A8A49C]" : "opacity-0"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
                  <span>release-v1.4.2</span>
                  <span className="text-[#55524E]">·</span>
                  <span className="text-semantic-success font-medium">verified</span>
                </div>
              </div>
            </div>

            {/* =========================================================
                STAGE 03: PRODUCTION (Upper Right Summit Peak)
                ========================================================= */}
            <div className="col-span-4 flex flex-col justify-start items-end pointer-events-auto text-right pt-2">
              <div
                className={`space-y-1.5 max-w-[280px] transition-all duration-600 ease-out ${
                  currentStage >= 3 ? "opacity-100 translate-y-0" : "opacity-35 -translate-y-2"
                }`}
              >
                {/* 1. Small stage number */}
                <div
                  className={`font-mono text-[11px] tracking-[0.16em] uppercase transition-colors duration-400 ${
                    currentStage >= 3 ? "text-semantic-success font-medium" : "text-[#66635D]"
                  }`}
                >
                  03 / LIVE
                </div>

                {/* 2. Strong, short heading */}
                <h3
                  className={`font-sans text-[22px] xl:text-[24px] font-medium tracking-tight transition-colors duration-400 ${
                    currentStage >= 3 ? "text-[#F2F0EB]" : "text-[#77736D]"
                  }`}
                >
                  Now it’s live.
                </h3>

                {/* 3. One concise supporting line */}
                <p className="font-sans text-[13.5px] text-[#8E8A82] leading-[1.55]">
                  Deployed and ready for traffic.
                </p>

                {/* Restrained sage-green live indicator */}
                <div
                  className={`pt-1.5 flex items-center justify-end gap-2 font-mono text-[11.5px] transition-opacity duration-500 ${
                    currentStage >= 3 ? "opacity-100 text-semantic-success font-medium" : "opacity-0"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-semantic-success animate-pulse" />
                  <span>LIVE</span>
                  <span className="text-[#55524E]">·</span>
                  <span className="text-[#FAF8F5]">200 OK</span>
                </div>
              </div>
            </div>

          </div>

          {/* -----------------------------------------------------------
              D. MOBILE / TABLET REFINED PROGRESSION (< 1024px)
              Clean vertical route on left margin with stacked editorial moments.
              Zero horizontal overflow or crowded text.
              ----------------------------------------------------------- */}
          <div className="block lg:hidden relative w-full pl-14 sm:pl-16 py-4">

            {/* Mobile Vertical Trail SVG */}
            <div className="absolute left-1 top-0 bottom-0 w-10 pointer-events-none" aria-hidden="true">
              <svg
                viewBox="0 0 64 500"
                preserveAspectRatio="none"
                fill="none"
                className="w-full h-full overflow-visible"
              >
                {/* Baseline path */}
                <path
                  ref={mobilePathRef}
                  d={mobileTrailD}
                  stroke="#2B2825"
                  strokeWidth="1.2"
                  strokeDasharray="2 6"
                  strokeLinecap="round"
                />

                {/* Active path */}
                <path
                  ref={mobileTraveledLineRef}
                  d={mobileTrailD}
                  stroke="#D88762"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: "600px 600px",
                    strokeDashoffset: isReducedMotion ? "0px" : "600px",
                  }}
                />

                {/* Reticles */}
                <circle cx="32" cy="40" r="3.5" fill="#111110" stroke={currentStage >= 1 ? "#D88762" : "#44403B"} strokeWidth="1.5" />
                <circle cx="32" cy="250" r="3.5" fill="#111110" stroke={currentStage >= 2 ? "#D88762" : "#44403B"} strokeWidth="1.5" />
                <circle cx="32" cy="460" r="4" fill="#111110" stroke={currentStage >= 3 ? "#82B89D" : "#44403B"} strokeWidth="1.5" />

                {/* Mobile Travelling Beacon */}
                <g ref={mobileBeaconRef} transform="translate(32, 40)">
                  <circle cx="0" cy="0" r="8" fill="#D88762" opacity="0.25" />
                  <circle cx="0" cy="0" r="2.5" fill="#FAF8F5" />
                </g>
              </svg>
            </div>

            {/* Stacked Mobile Editorial Moments */}
            <div className="space-y-10 sm:space-y-12">

              {/* Mobile Stage 01 */}
              <div
                className={`space-y-1 transition-all duration-500 ${
                  currentStage >= 1 ? "opacity-100" : "opacity-35"
                }`}
              >
                <div className="font-mono text-[10.5px] text-accent-orange font-medium tracking-[0.16em] uppercase">
                  01 / SOURCE
                </div>
                <h3 className="font-sans text-[20px] font-medium text-[#F2F0EB]">
                  Code committed.
                </h3>
                <p className="font-sans text-[13px] text-[#8E8A82]">
                  Your repository, ready to build.
                </p>
              </div>

              {/* Mobile Stage 02 */}
              <div
                className={`space-y-1 transition-all duration-500 ${
                  currentStage >= 2 ? "opacity-100" : "opacity-35"
                }`}
              >
                <div className="font-mono text-[10.5px] text-accent-orange font-medium tracking-[0.16em] uppercase">
                  02 / BUILD
                </div>
                <h3 className="font-sans text-[20px] font-medium text-[#F2F0EB]">
                  Build verified.
                </h3>
                <p className="font-sans text-[13px] text-[#8E8A82]">
                  Dependencies resolved. Output ready.
                </p>
                <div className="pt-1 flex items-center gap-2 font-mono text-[10.5px] text-[#A8A49C]">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
                  <span>release-v1.4.2</span>
                  <span className="text-semantic-success">verified</span>
                </div>
              </div>

              {/* Mobile Stage 03 */}
              <div
                className={`space-y-1 transition-all duration-500 ${
                  currentStage >= 3 ? "opacity-100" : "opacity-35"
                }`}
              >
                <div className="font-mono text-[10.5px] text-semantic-success font-medium tracking-[0.16em] uppercase">
                  03 / LIVE
                </div>
                <h3 className="font-sans text-[20px] font-medium text-[#F2F0EB]">
                  Now it’s live.
                </h3>
                <p className="font-sans text-[13px] text-[#8E8A82]">
                  Deployed and ready for traffic.
                </p>
                <div className="pt-1 flex items-center gap-2 font-mono text-[11px] text-semantic-success font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-semantic-success animate-pulse" />
                  <span>LIVE · 200 OK</span>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}

export default GettingStarted;
