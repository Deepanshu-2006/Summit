"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { GitCommit } from "lucide-react";

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
 * GettingStarted: Section 07 — The Deployment Journey
 * Editorial, carefully art-directed infrastructure experience:
 *
 * Distinct Typographic Hierarchy:
 * - THE START: "One commit."
 *   Repository & commit reference entering the deployment pipeline.
 *
 * - THE WORK: "Built, checked, ready."
 *   Dedicated build & release stage:
 *     1. Resolving dependencies
 *     2. Compiling the application
 *     3. Verifying the build output
 *   Quietly resolving into release-v1.4.2.
 *
 * - THE RESULT: "Out in the world."
 *   Visual anchor: web-app.jetway.demo
 *   Supporting status: Live · 200 OK
 *   Supporting copy: Release verified. Traffic shifted to production.
 *
 * Coordinated connecting path transitions from active burnt orange (#E58B65)
 * into verified sage green (#82B89D) as progress advances.
 */
export function GettingStarted() {
  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const s1Ref = useRef<HTMLDivElement>(null);
  const s2Ref = useRef<HTMLDivElement>(null);
  const s3Ref = useRef<HTMLDivElement>(null);

  const [hasTriggered, setHasTriggered] = useState(false);
  const [animStep, setAnimStep] = useState<number>(0);
  const step = isReducedMotion ? 9 : animStep;

  // Responsive desktop track coordinates aligned with column positions
  const [coords, setCoords] = useState<{ x1: number; x2: number; x3: number; totalW: number }>({
    x1: 4,
    x2: 270,
    x3: 700,
    totalW: 1000,
  });

  // Dynamically synchronize stage markers with actual rendered column positions
  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateMeasurements = () => {
      if (!gridRef.current || !s1Ref.current || !s2Ref.current || !s3Ref.current) return;
      const gridRect = gridRef.current.getBoundingClientRect();
      const s1Rect = s1Ref.current.getBoundingClientRect();
      const s2Rect = s2Ref.current.getBoundingClientRect();
      const s3Rect = s3Ref.current.getBoundingClientRect();

      setCoords({
        x1: Math.max(4, s1Rect.left - gridRect.left + 2),
        x2: Math.max(20, s2Rect.left - gridRect.left + 2),
        x3: Math.max(40, s3Rect.left - gridRect.left + 2),
        totalW: gridRect.width,
      });
    };

    updateMeasurements();

    const el = gridRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      updateMeasurements();
    });
    ro.observe(el);

    window.addEventListener("resize", updateMeasurements);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateMeasurements);
    };
  }, []);

  // Trigger animation once when section enters viewport
  useEffect(() => {
    if (isReducedMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTriggered) {
            setHasTriggered(true);
          }
        });
      },
      { threshold: 0.15 }
    );

    const el = sectionRef.current;
    if (el) {
      observer.observe(el);
    }

    return () => {
      if (el) {
        observer.unobserve(el);
      }
    };
  }, [hasTriggered, isReducedMotion]);

  // Coordinated, phased animation progression
  useEffect(() => {
    if (isReducedMotion || !hasTriggered) return;

    const timeouts: NodeJS.Timeout[] = [];

    // Phase 1: Source appears (t = 40ms)
    timeouts.push(setTimeout(() => setAnimStep(1), 40));

    // Phase 2: Commit marker travels along path to Build (t = 450ms)
    timeouts.push(setTimeout(() => setAnimStep(2), 450));

    // Phase 3: Build Op 1 active: Resolving dependencies (t = 950ms)
    timeouts.push(setTimeout(() => setAnimStep(3), 950));

    // Phase 4: Build Op 2 active: Compiling the application (t = 1600ms)
    timeouts.push(setTimeout(() => setAnimStep(4), 1600));

    // Phase 5: Build Op 3 active: Verifying the build output (t = 2300ms)
    timeouts.push(setTimeout(() => setAnimStep(5), 2300));

    // Phase 6: Build verified into Release (t = 3000ms)
    timeouts.push(setTimeout(() => setAnimStep(6), 3000));

    // Phase 7: Release marker travels to Live destination (t = 3500ms)
    timeouts.push(setTimeout(() => setAnimStep(7), 3500));

    // Phase 8 & 9: Live domain reveals and status activates (t = 4100ms)
    timeouts.push(setTimeout(() => setAnimStep(8), 4100));
    timeouts.push(setTimeout(() => setAnimStep(9), 4350));

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [hasTriggered, isReducedMotion]);

  // Desktop horizontal SVG conduit measurements based on dynamic coordinates
  const getDesktopPathValues = () => {
    const { x1, x2, x3 } = coords;

    if (isReducedMotion) {
      return {
        segment1X: x2,
        segment2X: x3,
        markerX: x3,
        markerColor: "#82B89D",
      };
    }

    if (step <= 1) {
      return { segment1X: x1, segment2X: x2, markerX: x1, markerColor: "#E58B65" };
    }
    if (step >= 2 && step <= 5) {
      return { segment1X: x2, segment2X: x2, markerX: x2, markerColor: "#E58B65" };
    }
    if (step === 6) {
      return { segment1X: x2, segment2X: x2, markerX: x2, markerColor: "#82B89D" };
    }
    // step >= 7
    return { segment1X: x2, segment2X: x3, markerX: x3, markerColor: "#82B89D" };
  };

  const { segment1X, segment2X, markerX, markerColor } = getDesktopPathValues();

  // Mobile vertical progress calculation
  const getMobileProgress = () => {
    if (isReducedMotion || step >= 7) return 100;
    if (step === 6) return 60;
    if (step >= 2) return 30;
    return 0;
  };

  return (
    <section
      ref={sectionRef}
      id="getting-started"
      className="relative w-full pt-16 pb-24 sm:pt-20 sm:pb-32 lg:pt-24 lg:pb-40 bg-[#111110] text-[#F2F0EB] overflow-hidden select-none"
      aria-labelledby="getting-started-heading"
    >
      <div className="layout-container w-full">
        {/* =================================================================
            SECTION IDENTIFIER: 07 / GETTING STARTED
            Understated divider line matching Jetway standard
            ================================================================= */}
        <div className="w-full border-t border-[#262422] pt-5 mb-12 sm:mb-16">
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#77736D] tracking-[0.1em] uppercase">
            <span className="text-[#E58B65] font-medium">07</span>
            <span>/</span>
            <span>GETTING STARTED</span>
          </div>
        </div>

        {/* =================================================================
            EDITORIAL INTRO: Heading & Balanced Supporting Copy
            ================================================================= */}
        <div className="max-w-2xl mb-14 sm:mb-18 lg:mb-20">
          <h2
            id="getting-started-heading"
            className="font-sans text-[38px] sm:text-[48px] lg:text-[54px] font-medium leading-[1.08] tracking-[-0.03em] text-[#F2F0EB] mb-5"
          >
            From first commit to first deploy.
          </h2>

          <p className="font-sans text-[16px] sm:text-[17px] text-[#8E8A82] leading-[1.65] max-w-xl">
            Your next deployment doesn’t need a complicated setup. Start with
            your code, configure your application, and get ready to ship.
          </p>
        </div>

        {/* =================================================================
            DEPLOYMENT JOURNEY: Three Asymmetric Editorial Stages
            1. SOURCE (Compact footprint)
            2. BUILD & RELEASE (More room for meaningful activity)
            3. LIVE DESTINATION (Domain is the visual anchor)
            ================================================================= */}
        <div className="relative w-full">

          {/* ---------------------------------------------------------------
              DESKTOP PRESENTATION (>= 1024px)
              Controlled Asymmetric Grid + Precise Connecting Path
              --------------------------------------------------------------- */}
          <div className="hidden lg:block relative w-full pt-2 pb-6">
            
            {/* The Precision SVG Deployment Path */}
            <div className="relative w-full h-6 mb-8" aria-hidden="true">
              <svg
                className="w-full h-6 overflow-visible"
                viewBox={`0 0 ${coords.totalW} 24`}
                fill="none"
              >
                {/* 1. Subtle neutral base track aligned from Stage 1 to Stage 3 */}
                <line
                  x1={coords.x1}
                  y1="12"
                  x2={coords.x3}
                  y2="12"
                  stroke="#22201E"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />

                {/* 2. Active Source -> Build Segment (Burnt Orange, transitions to Sage Green when verified) */}
                <line
                  x1={coords.x1}
                  y1="12"
                  x2={segment1X}
                  y2="12"
                  stroke={step >= 6 ? "#82B89D" : "#E58B65"}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className={isReducedMotion ? "" : "transition-all duration-600 ease-out"}
                />

                {/* 3. Verified Build -> Live Segment (Sage Green) */}
                {step >= 6 && (
                  <line
                    x1={coords.x2}
                    y1="12"
                    x2={segment2X}
                    y2="12"
                    stroke="#82B89D"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    className={isReducedMotion ? "" : "transition-all duration-600 ease-out"}
                  />
                )}

                {/* 4. Small, restrained stage anchor nodes precisely aligned with columns */}
                <circle
                  cx={coords.x1}
                  cy="12"
                  r="3"
                  fill={step >= 6 ? "#82B89D" : step >= 1 ? "#E58B65" : "#22201E"}
                />
                <circle
                  cx={coords.x2}
                  cy="12"
                  r="3"
                  fill={step >= 6 ? "#82B89D" : step >= 2 ? "#E58B65" : "#22201E"}
                />
                <circle
                  cx={coords.x3}
                  cy="12"
                  r="3"
                  fill={step >= 8 ? "#82B89D" : "#22201E"}
                />

                {/* 5. Travelling Stage Marker */}
                <circle
                  cx={markerX}
                  cy="12"
                  r="3.75"
                  fill={markerColor}
                  className={isReducedMotion ? "" : "transition-all duration-600 ease-out"}
                />
              </svg>
            </div>

            {/* Three Distinct Typographic Stages (3 / 5 / 4 Column Split) */}
            <div ref={gridRef} className="grid grid-cols-12 gap-8 xl:gap-12 items-start">
              
              {/* =============================================================
                  STAGE 1: SOURCE (Compact Footprint)
                  ============================================================= */}
              <div ref={s1Ref} className="col-span-3 space-y-4">
                <div className="font-mono text-[11px] text-[#77736D] tracking-[0.14em] uppercase">
                  THE START
                </div>

                <div
                  className={`space-y-3 transition-all duration-500 ${
                    step >= 1 ? "opacity-100 translate-y-0" : "opacity-30 translate-y-1"
                  }`}
                >
                  <h3 className="font-sans text-[28px] xl:text-[32px] font-medium text-[#F2F0EB] tracking-[-0.03em] leading-tight">
                    One commit.
                  </h3>

                  <p className="font-sans text-[15px] text-[#8E8A82] leading-[1.6]">
                    Your code is ready. Jetway picks up the change and takes it
                    from here.
                  </p>

                  <div className="pt-2 space-y-1.5 font-mono">
                    <div className="text-[13px] text-[#F2F0EB]">
                      acme/web-app · main
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] text-[#E58B65]">
                      <GitCommit className="w-3.5 h-3.5" />
                      <span>8f3a21c</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* =============================================================
                  STAGE 2: BUILD & RELEASE (More Room For Operations)
                  ============================================================= */}
              <div ref={s2Ref} className="col-span-5 space-y-4 lg:pl-2 xl:pl-4">
                <div className="font-mono text-[11px] text-[#77736D] tracking-[0.14em] uppercase">
                  THE WORK
                </div>

                <div className="space-y-4">
                  <h3 className="font-sans text-[28px] xl:text-[32px] font-medium text-[#F2F0EB] tracking-[-0.03em] leading-tight">
                    Built, checked, ready.
                  </h3>

                  {/* Focused Typographic Operations Sequence */}
                  <div className="space-y-2.5 font-mono text-[13px] pt-1">
                    {/* Operation 1 */}
                    <div
                      className={`flex items-center justify-between transition-colors duration-300 ${
                        step >= 4
                          ? "text-[#8E8A82]"
                          : step === 3
                          ? "text-[#F2F0EB] font-medium"
                          : "text-[#44423E]"
                      }`}
                    >
                      <span>Resolving dependencies</span>
                      {step >= 4 ? (
                        <span className="text-[#82B89D] text-[11px]">✓</span>
                      ) : step === 3 ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E58B65]" />
                      ) : null}
                    </div>

                    {/* Operation 2 */}
                    <div
                      className={`flex items-center justify-between transition-colors duration-300 ${
                        step >= 5
                          ? "text-[#8E8A82]"
                          : step === 4
                          ? "text-[#F2F0EB] font-medium"
                          : "text-[#44423E]"
                      }`}
                    >
                      <span>Compiling the application</span>
                      {step >= 5 ? (
                        <span className="text-[#82B89D] text-[11px]">✓</span>
                      ) : step === 4 ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E58B65]" />
                      ) : null}
                    </div>

                    {/* Operation 3 */}
                    <div
                      className={`flex items-center justify-between transition-colors duration-300 ${
                        step >= 6
                          ? "text-[#8E8A82]"
                          : step === 5
                          ? "text-[#F2F0EB] font-medium"
                          : "text-[#44423E]"
                      }`}
                    >
                      <span>Verifying the build output</span>
                      {step >= 6 ? (
                        <span className="text-[#82B89D] text-[11px]">✓</span>
                      ) : step === 5 ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E58B65]" />
                      ) : null}
                    </div>
                  </div>

                  {/* Restrained Progress Indicator Under Operations */}
                  <div
                    className="w-full h-[1.5px] bg-[#22201E] overflow-hidden my-1"
                    aria-hidden="true"
                  >
                    <div
                      className={`h-full ${
                        step >= 6 ? "bg-[#82B89D]" : "bg-[#E58B65]"
                      } transition-all duration-400 ease-out`}
                      style={{
                        width:
                          step >= 6
                            ? "100%"
                            : step === 5
                            ? "85%"
                            : step === 4
                            ? "55%"
                            : step === 3
                            ? "25%"
                            : "0%",
                      }}
                    />
                  </div>

                  {/* Quiet Release Identifier Bridge */}
                  <div
                    className={`pt-2 flex items-center justify-between font-mono text-[12.5px] transition-all duration-400 ${
                      step >= 6 ? "opacity-100" : "opacity-30"
                    }`}
                  >
                    <span className="text-[#F2F0EB]">release-v1.4.2</span>
                    <span className="text-[#82B89D] text-[12px] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#82B89D]" />
                      <span>Build verified</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* =============================================================
                  STAGE 3: LIVE DESTINATION (The Result — Domain Anchor)
                  ============================================================= */}
              <div ref={s3Ref} className="col-span-4 space-y-4">
                <div className="font-mono text-[11px] text-[#77736D] tracking-[0.14em] uppercase">
                  THE RESULT
                </div>

                <div
                  className={`space-y-3 transition-all duration-500 ${
                    step >= 8 ? "opacity-100 translate-y-0" : "opacity-30 translate-y-1"
                  }`}
                >
                  <h3 className="font-sans text-[28px] xl:text-[32px] font-medium text-[#F2F0EB] tracking-[-0.03em] leading-tight">
                    Out in the world.
                  </h3>

                  {/* Visual Anchor: Prominent Deployed Domain (never wraps) */}
                  <div className="pt-1">
                    <div className="font-mono text-[22px] xl:text-[25px] font-semibold text-[#F2F0EB] tracking-[-0.02em] whitespace-nowrap">
                      web-app.jetway.demo
                    </div>
                  </div>

                  {/* Supporting Status: Live · 200 OK */}
                  <div
                    className={`flex items-center gap-2 font-mono text-[12.5px] transition-opacity duration-400 ${
                      step >= 9 ? "opacity-100 text-[#82B89D] font-medium" : "opacity-0"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#82B89D]" />
                    <span>Live · 200 OK</span>
                  </div>

                  {/* Supporting Copy */}
                  <p className="font-sans text-[14.5px] text-[#8E8A82] leading-[1.6] pt-1">
                    Release verified. Traffic shifted to production.
                  </p>
                </div>
              </div>

            </div>

          </div>

          {/* ---------------------------------------------------------------
              MOBILE / TABLET PRESENTATION (< 1024px)
              Vertical Narrative Flow with Identical Cause-and-Effect Logic
              --------------------------------------------------------------- */}
          <div className="block lg:hidden relative w-full pl-7 py-2">
            
            {/* Vertical Connecting Track Line */}
            <div
              className="absolute left-[7px] top-2 bottom-8 w-[1.5px] bg-[#22201E]"
              aria-hidden="true"
            >
              <div
                className={`w-full ${
                  step >= 6 ? "bg-[#82B89D]" : "bg-[#E58B65]"
                } ${
                  isReducedMotion
                    ? "h-full"
                    : "transition-all duration-600 ease-out origin-top"
                }`}
                style={{ height: `${getMobileProgress()}%` }}
              />
            </div>

            <div className="space-y-10 sm:space-y-12">
              
              {/* MOBILE STAGE 1: SOURCE */}
              <div className="relative space-y-2">
                <div
                  className={`absolute -left-[23px] top-1.5 w-2 h-2 rounded-full ${
                    step >= 6
                      ? "bg-[#82B89D]"
                      : step >= 1
                      ? "bg-[#E58B65]"
                      : "bg-[#22201E]"
                  }`}
                  aria-hidden="true"
                />
                <div className="font-mono text-[11px] text-[#77736D] uppercase tracking-wider">
                  THE START
                </div>
                <h3 className="font-sans text-[24px] sm:text-[28px] font-medium text-[#F2F0EB] tracking-tight">
                  One commit.
                </h3>
                <p className="font-sans text-[14.5px] text-[#8E8A82] leading-relaxed">
                  Your code is ready. Jetway picks up the change and takes it from here.
                </p>
                <div className="pt-1 space-y-1 font-mono text-[12.5px]">
                  <div className="text-[#F2F0EB]">acme/web-app · main</div>
                  <div className="text-[#E58B65] flex items-center gap-1.5">
                    <GitCommit className="w-3.5 h-3.5" />
                    <span>8f3a21c</span>
                  </div>
                </div>
              </div>

              {/* MOBILE STAGE 2: BUILD & RELEASE */}
              <div className="relative space-y-3">
                <div
                  className={`absolute -left-[23px] top-1.5 w-2 h-2 rounded-full ${
                    step >= 6
                      ? "bg-[#82B89D]"
                      : step >= 2
                      ? "bg-[#E58B65]"
                      : "bg-[#22201E]"
                  }`}
                  aria-hidden="true"
                />
                <div className="font-mono text-[11px] text-[#77736D] uppercase tracking-wider">
                  THE WORK
                </div>
                <h3 className="font-sans text-[24px] sm:text-[28px] font-medium text-[#F2F0EB] tracking-tight">
                  Built, checked, ready.
                </h3>

                <div className="space-y-2 font-mono text-[12.5px] pt-1">
                  <div
                    className={`flex items-center justify-between ${
                      step >= 4
                        ? "text-[#8E8A82]"
                        : step === 3
                        ? "text-[#F2F0EB] font-medium"
                        : "text-[#44423E]"
                    }`}
                  >
                    <span>Resolving dependencies</span>
                    {step >= 4 && <span className="text-[#82B89D]">✓</span>}
                  </div>
                  <div
                    className={`flex items-center justify-between ${
                      step >= 5
                        ? "text-[#8E8A82]"
                        : step === 4
                        ? "text-[#F2F0EB] font-medium"
                        : "text-[#44423E]"
                    }`}
                  >
                    <span>Compiling the application</span>
                    {step >= 5 && <span className="text-[#82B89D]">✓</span>}
                  </div>
                  <div
                    className={`flex items-center justify-between ${
                      step >= 6
                        ? "text-[#8E8A82]"
                        : step === 5
                        ? "text-[#F2F0EB] font-medium"
                        : "text-[#44423E]"
                    }`}
                  >
                    <span>Verifying the build output</span>
                    {step >= 6 && <span className="text-[#82B89D]">✓</span>}
                  </div>
                </div>

                <div
                  className={`pt-2 flex items-center justify-between font-mono text-[12px] ${
                    step >= 6 ? "opacity-100" : "opacity-30"
                  }`}
                >
                  <span className="text-[#F2F0EB]">release-v1.4.2</span>
                  <span className="text-[#82B89D] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#82B89D]" />
                    <span>Build verified</span>
                  </span>
                </div>
              </div>

              {/* MOBILE STAGE 3: LIVE DESTINATION */}
              <div className="relative space-y-2">
                <div
                  className={`absolute -left-[23px] top-1.5 w-2 h-2 rounded-full ${
                    step >= 8
                      ? "bg-[#82B89D]"
                      : "bg-[#22201E]"
                  }`}
                  aria-hidden="true"
                />
                <div className="font-mono text-[11px] text-[#77736D] uppercase tracking-wider">
                  THE RESULT
                </div>
                <h3 className="font-sans text-[24px] sm:text-[28px] font-medium text-[#F2F0EB] tracking-tight">
                  Out in the world.
                </h3>
                <div className="pt-1">
                  <div className="font-mono text-[17px] sm:text-[20px] font-semibold text-[#F2F0EB] whitespace-nowrap">
                    web-app.jetway.demo
                  </div>
                </div>
                <div
                  className={`flex items-center gap-1.5 font-mono text-[12px] text-[#82B89D] ${
                    step >= 9 ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#82B89D]" />
                  <span>Live · 200 OK</span>
                </div>
                <p className="font-sans text-[14px] text-[#8E8A82] leading-relaxed pt-0.5">
                  Release verified. Traffic shifted to production.
                </p>
              </div>

            </div>

          </div>

        </div>
      </div>
    </section>
  );
}

export default GettingStarted;
