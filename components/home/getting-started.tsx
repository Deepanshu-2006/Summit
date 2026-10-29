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
 * Complete Visual Redesign
 *
 * An engineered, asymmetric deployment journey composed into three distinct visual zones:
 *
 * 1. LEFT — SOURCE:
 *    Repository reference & commit trigger (acme/web-app · main · 8f3a21c).
 *
 * 2. CENTER — BUILD AND RELEASE (The Engine):
 *    Actively transforms source code into a signed, hermetic release.
 *    Sequential build operations:
 *      - Resolving dependencies
 *      - Compiling application
 *      - Verifying build output
 *    Resolves cleanly into release-v1.4.2.
 *
 * 3. RIGHT — LIVE (Primary Focal Point):
 *    The completed release reaches its destination.
 *    Dominant typographic live domain: web-app.jetway.demo
 *    Restrained sage-green status confirmation: ● LIVE · 200 OK
 *
 * Connected by an animated SVG deployment path that starts burnt-orange (#E58B65)
 * during source/build and transitions to sage-green (#82B89D) as the verified release travels to Live.
 */
export function GettingStarted() {
  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const sectionRef = useRef<HTMLElement>(null);
  const [hasTriggered, setHasTriggered] = useState(false);
  const [animStep, setAnimStep] = useState<number>(0);
  const step = isReducedMotion ? 9 : animStep;

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

    // Phase 1: Source arrives (t = 50ms)
    timeouts.push(setTimeout(() => setAnimStep(1), 50));

    // Phase 2: Active marker moves toward Build stage (t = 650ms)
    timeouts.push(setTimeout(() => setAnimStep(2), 650));

    // Build Op 1: Resolving dependencies active (t = 1350ms)
    timeouts.push(setTimeout(() => setAnimStep(3), 1350));

    // Build Op 2: Compiling application active (t = 2150ms)
    timeouts.push(setTimeout(() => setAnimStep(4), 2150));

    // Build Op 3: Verifying build output active (t = 2950ms)
    timeouts.push(setTimeout(() => setAnimStep(5), 2950));

    // Phase 3: Release verified & signed (t = 3750ms)
    timeouts.push(setTimeout(() => setAnimStep(6), 3750));

    // Release marker travels toward Live destination (t = 4450ms)
    timeouts.push(setTimeout(() => setAnimStep(7), 4450));

    // Phase 4: Application domain appears (t = 5050ms)
    timeouts.push(setTimeout(() => setAnimStep(8), 5050));

    // Final confirmation: Sage-green LIVE indicator activates (t = 5550ms)
    timeouts.push(setTimeout(() => setAnimStep(9), 5550));

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [hasTriggered, isReducedMotion]);

  // Desktop SVG Path coordinates (Source: x=40, Build: x=380, Live: x=960)
  const getDesktopPathValues = () => {
    if (isReducedMotion) {
      return {
        segment1X: 380,
        segment2X: 960,
        markerX: 960,
        markerColor: "#82B89D",
      };
    }

    // Step 0: Idle
    if (step === 0) {
      return { segment1X: 40, segment2X: 380, markerX: 40, markerColor: "#E58B65" };
    }
    // Step 1: Source visible, marker at Source
    if (step === 1) {
      return { segment1X: 40, segment2X: 380, markerX: 40, markerColor: "#E58B65" };
    }
    // Step 2-5: Segment 1 drawn, marker resting at Build engine
    if (step >= 2 && step <= 5) {
      return { segment1X: 380, segment2X: 380, markerX: 380, markerColor: "#E58B65" };
    }
    // Step 6: Build verified into Release, marker turns sage green at Build
    if (step === 6) {
      return { segment1X: 380, segment2X: 380, markerX: 380, markerColor: "#82B89D" };
    }
    // Step 7-9: Segment 2 drawn, marker glides to Live destination
    return { segment1X: 380, segment2X: 960, markerX: 960, markerColor: "#82B89D" };
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
            EDITORIAL INTRO: Eyebrow, Heading & Supporting Copy
            ================================================================= */}
        <div className="max-w-2xl mb-14 sm:mb-18 lg:mb-20">
          <div className="flex items-center gap-2 mb-4">
            <span
              className="w-1.5 h-1.5 rounded-[1px] bg-[#E58B65]"
              aria-hidden="true"
            />
            <span className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-[#77736D]">
              THREE STEPS. ONE STARTING POINT.
            </span>
          </div>

          <h2
            id="getting-started-heading"
            className="font-sans text-[38px] sm:text-[48px] lg:text-[54px] font-medium leading-[1.08] tracking-[-0.03em] text-[#F2F0EB] mb-5"
          >
            From first commit to first deploy.
          </h2>

          <p className="font-sans text-[16px] sm:text-[17px] text-[#8E8A82] leading-[1.65]">
            Your next deployment doesn’t need a complicated setup. Start with
            your code, configure your application, and get ready to ship.
          </p>
        </div>

        {/* =================================================================
            CUSTOM HORIZONTAL DEPLOYMENT VISUALIZATION
            Continuous, asymmetric composition with three distinct visual zones:
              - LEFT: Source
              - CENTER: Build & Release Engine (Heart of the section)
              - RIGHT: Live Production (Dominant typographic element)
            ================================================================= */}
        <div className="relative w-full">

          {/* ---------------------------------------------------------------
              DESKTOP / TABLET VISUALIZATION (>= 1024px)
              --------------------------------------------------------------- */}
          <div className="hidden lg:block relative w-full pt-4 pb-8">
            
            {/* The Precision SVG Deployment Conduit */}
            <div className="relative w-full h-8 mb-8" aria-hidden="true">
              <svg
                className="w-full h-8 overflow-visible"
                viewBox="0 0 1000 32"
                preserveAspectRatio="none"
                fill="none"
              >
                {/* 1. Underlying baseline conduit */}
                <line
                  x1="40"
                  y1="16"
                  x2="960"
                  y2="16"
                  stroke="#22201E"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />

                {/* 2. Active Source -> Build Segment (Burnt Orange) */}
                <line
                  x1="40"
                  y1="16"
                  x2={segment1X}
                  y2="16"
                  stroke="#E58B65"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className={isReducedMotion ? "" : "transition-all duration-700 ease-out"}
                />

                {/* 3. Verified Build -> Live Segment (Sage Green) */}
                {step >= 6 && (
                  <line
                    x1="380"
                    y1="16"
                    x2={segment2X}
                    y2="16"
                    stroke="#82B89D"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className={isReducedMotion ? "" : "transition-all duration-700 ease-out"}
                  />
                )}

                {/* 4. Fixed Stage Junction Nodes */}
                {/* Node 1: Source */}
                <circle
                  cx="40"
                  cy="16"
                  r="3.5"
                  fill={step >= 1 ? "#E58B65" : "#22201E"}
                  stroke="#111110"
                  strokeWidth="1.5"
                />
                {/* Node 2: Build Engine Center */}
                <circle
                  cx="380"
                  cy="16"
                  r="4"
                  fill={step >= 6 ? "#82B89D" : step >= 2 ? "#E58B65" : "#22201E"}
                  stroke="#111110"
                  strokeWidth="1.5"
                />
                {/* Node 3: Live Destination */}
                <circle
                  cx="960"
                  cy="16"
                  r="4"
                  fill={step >= 8 ? "#82B89D" : "#22201E"}
                  stroke="#111110"
                  strokeWidth="1.5"
                />

                {/* 5. Travelling Commit/Release Marker */}
                <g className={isReducedMotion ? "" : "transition-all duration-700 ease-out"}>
                  <circle
                    cx={markerX}
                    cy="16"
                    r="8"
                    fill={markerColor}
                    opacity="0.2"
                  />
                  <circle
                    cx={markerX}
                    cy="16"
                    r="4"
                    fill={markerColor}
                  />
                </g>
              </svg>
            </div>

            {/* Three Asymmetric Visual Zones */}
            <div className="grid grid-cols-12 gap-10 xl:gap-14 items-start">
              
              {/* =============================================================
                  ZONE 1: LEFT — SOURCE (3 cols)
                  Repository and commit trigger enter the deployment
                  ============================================================= */}
              <div className="col-span-3 space-y-4">
                <div className="font-mono text-[11px] text-[#77736D] tracking-[0.14em] uppercase">
                  01 / SOURCE
                </div>

                <div
                  className={`space-y-2.5 transition-all duration-500 ${
                    step >= 1 ? "opacity-100 translate-y-0" : "opacity-30 translate-y-1"
                  }`}
                >
                  <h3 className="font-sans text-[22px] font-medium text-[#F2F0EB] tracking-tight">
                    Code committed.
                  </h3>

                  <div className="font-mono text-[15px] font-medium text-[#F2F0EB] pt-1">
                    acme/web-app
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[12px] text-[#8E8A82]">
                    <GitCommit className="w-3.5 h-3.5 text-[#E58B65]" />
                    <span>main · 8f3a21c</span>
                  </div>

                  <p className="font-mono text-[11px] text-[#77736D] pt-1.5 leading-relaxed">
                    Webhook received · Automated pipeline triggered
                  </p>
                </div>
              </div>

              {/* =============================================================
                  ZONE 2: CENTER — BUILD AND RELEASE ENGINE (5 cols)
                  The visual heart and engine of the section
                  ============================================================= */}
              <div className="col-span-5 space-y-4">
                <div className="font-mono text-[11px] text-[#77736D] tracking-[0.14em] uppercase flex items-center justify-between">
                  <span>02 / BUILD & RELEASE</span>
                  <span className="text-[10px] text-[#55524E]">ENGINE</span>
                </div>

                <div className="space-y-4">
                  <h3 className="font-sans text-[22px] font-medium text-[#F2F0EB] tracking-tight">
                    Artifact verified.
                  </h3>

                  {/* Typographic Build Sequence */}
                  <div className="space-y-3 font-mono text-[12.5px] pt-1">
                    {/* Operation 1: Resolving dependencies */}
                    <div
                      className={`flex items-center justify-between transition-colors duration-400 ${
                        step >= 4
                          ? "text-[#8E8A82]"
                          : step === 3
                          ? "text-[#F2F0EB] font-medium"
                          : "text-[#44423E]"
                      }`}
                    >
                      <span>Resolving dependencies</span>
                      {step >= 4 ? (
                        <span className="text-[#82B89D] text-[11px] flex items-center gap-1">
                          <span>DONE</span>
                          <span className="text-[#55524E]">·</span>
                          <span className="text-[#77736D]">1.2s</span>
                        </span>
                      ) : step === 3 ? (
                        <span className="text-[#E58B65] text-[11px] font-medium tracking-wider">
                          RUNNING
                        </span>
                      ) : (
                        <span className="text-[#33312E] text-[11px]">QUEUED</span>
                      )}
                    </div>

                    {/* Operation 2: Compiling application */}
                    <div
                      className={`flex items-center justify-between transition-colors duration-400 ${
                        step >= 5
                          ? "text-[#8E8A82]"
                          : step === 4
                          ? "text-[#F2F0EB] font-medium"
                          : "text-[#44423E]"
                      }`}
                    >
                      <span>Compiling application</span>
                      {step >= 5 ? (
                        <span className="text-[#82B89D] text-[11px] flex items-center gap-1">
                          <span>DONE</span>
                          <span className="text-[#55524E]">·</span>
                          <span className="text-[#77736D]">2.4s</span>
                        </span>
                      ) : step === 4 ? (
                        <span className="text-[#E58B65] text-[11px] font-medium tracking-wider">
                          COMPILING
                        </span>
                      ) : (
                        <span className="text-[#33312E] text-[11px]">WAITING</span>
                      )}
                    </div>

                    {/* Operation 3: Verifying build output */}
                    <div
                      className={`flex items-center justify-between transition-colors duration-400 ${
                        step >= 6
                          ? "text-[#8E8A82]"
                          : step === 5
                          ? "text-[#F2F0EB] font-medium"
                          : "text-[#44423E]"
                      }`}
                    >
                      <span>Verifying build output</span>
                      {step >= 6 ? (
                        <span className="text-[#82B89D] text-[11px] flex items-center gap-1 font-medium">
                          <span>HERMETIC</span>
                          <span className="text-[#55524E]">·</span>
                          <span>SIGNED</span>
                        </span>
                      ) : step === 5 ? (
                        <span className="text-[#E58B65] text-[11px] font-medium tracking-wider">
                          VERIFYING
                        </span>
                      ) : (
                        <span className="text-[#33312E] text-[11px]">PENDING</span>
                      )}
                    </div>
                  </div>

                  {/* Single Restrained Build Progress Indicator */}
                  <div
                    className="w-full h-[1.5px] bg-[#22201E] overflow-hidden my-2"
                    aria-hidden="true"
                  >
                    <div
                      className={`h-full ${
                        step >= 6 ? "bg-[#82B89D]" : "bg-[#E58B65]"
                      } transition-all duration-500 ease-out`}
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

                  {/* Completed Build to Release Output Bridge */}
                  <div
                    className={`pt-2 flex items-center justify-between font-mono text-[12px] transition-all duration-500 ${
                      step >= 6 ? "opacity-100" : "opacity-25"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#F2F0EB]">release-v1.4.2</span>
                      <span className="text-[#82B89D] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#82B89D]" />
                        <span>Build verified</span>
                      </span>
                    </div>
                    <span className="text-[#77736D] text-[11px]">sha256:8f3a21c</span>
                  </div>
                </div>
              </div>

              {/* =============================================================
                  ZONE 3: RIGHT — LIVE DESTINATION (4 cols)
                  The prominent typographic conclusion and focal destination
                  ============================================================= */}
              <div className="col-span-4 space-y-4">
                <div className="font-mono text-[11px] text-[#77736D] tracking-[0.14em] uppercase">
                  03 / LIVE DESTINATION
                </div>

                <div
                  className={`space-y-3 transition-all duration-600 ${
                    step >= 8 ? "opacity-100 translate-y-0" : "opacity-30 translate-y-1"
                  }`}
                >
                  <h3 className="font-sans text-[22px] font-medium text-[#F2F0EB] tracking-tight">
                    Traffic shifted.
                  </h3>

                  {/* Primary Focal Typographic Element: The Deployed Domain (never wraps) */}
                  <div className="pt-1">
                    <div className="font-mono text-[22px] xl:text-[25px] font-bold tracking-tight text-[#F2F0EB] whitespace-nowrap">
                      web-app.jetway.demo
                    </div>
                  </div>

                  {/* Subtle Sage-Green Status Confirmation */}
                  <div
                    className={`flex items-center gap-2.5 font-mono text-[12px] transition-opacity duration-500 ${
                      step >= 9 ? "opacity-100 text-[#82B89D] font-medium" : "opacity-0"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#82B89D] animate-pulse" />
                    <span>LIVE</span>
                    <span className="text-[#44423E]">·</span>
                    <span className="text-[#A8A49C]">200 OK</span>
                    <span className="text-[#44423E]">·</span>
                    <span className="text-[#77736D]">Global Edge</span>
                  </div>

                  <p className="font-mono text-[11px] text-[#77736D] pt-0.5 leading-relaxed">
                    100% traffic cutover · Zero downtime release
                  </p>
                </div>
              </div>

            </div>

          </div>

          {/* ---------------------------------------------------------------
              MOBILE / TABLET ADAPTIVE VERTICAL PROGRESSION (< 1024px)
              Recomposed into a readable vertical journey with the same narrative
              --------------------------------------------------------------- */}
          <div className="block lg:hidden relative w-full pl-8 py-4">
            
            {/* Vertical Connecting Track Line */}
            <div
              className="absolute left-[11px] top-4 bottom-10 w-[1.5px] bg-[#22201E]"
              aria-hidden="true"
            >
              <div
                className={`w-full ${
                  step >= 7 ? "bg-[#82B89D]" : "bg-[#E58B65]"
                } ${
                  isReducedMotion
                    ? "h-full"
                    : "transition-all duration-700 ease-out origin-top"
                }`}
                style={{ height: `${getMobileProgress()}%` }}
              />
            </div>

            <div className="space-y-12">
              
              {/* MOBILE ZONE 1: SOURCE */}
              <div className="relative space-y-2.5">
                <div
                  className={`absolute -left-[27px] top-1.5 w-2.5 h-2.5 rounded-full border ${
                    step >= 1
                      ? "bg-[#E58B65] border-[#FFAA80]"
                      : "bg-[#1C1B19] border-[#302D2A]"
                  }`}
                  aria-hidden="true"
                />
                <div className="font-mono text-[11px] text-[#77736D] uppercase tracking-wider">
                  01 / SOURCE
                </div>
                <div className="font-mono text-[17px] font-semibold text-[#F2F0EB]">
                  acme/web-app
                </div>
                <div className="flex items-center gap-2 font-mono text-[12px] text-[#8E8A82]">
                  <GitCommit className="w-3.5 h-3.5 text-[#E58B65]" />
                  <span>main · 8f3a21c</span>
                </div>
              </div>

              {/* MOBILE ZONE 2: BUILD & RELEASE ENGINE */}
              <div className="relative space-y-3.5">
                <div
                  className={`absolute -left-[27px] top-1.5 w-2.5 h-2.5 rounded-full border ${
                    step >= 6
                      ? "bg-[#82B89D] border-[#82B89D]"
                      : step >= 2
                      ? "bg-[#E58B65] border-[#FFAA80]"
                      : "bg-[#1C1B19] border-[#302D2A]"
                  }`}
                  aria-hidden="true"
                />
                <div className="font-mono text-[11px] text-[#77736D] uppercase tracking-wider">
                  02 / BUILD & RELEASE ENGINE
                </div>

                <div className="space-y-2.5 font-mono text-[12.5px] pt-1">
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
                    {step >= 4 ? (
                      <span className="text-[#82B89D] text-[11px]">DONE · 1.2s</span>
                    ) : step === 3 ? (
                      <span className="text-[#E58B65] text-[11px]">RUNNING</span>
                    ) : null}
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
                    <span>Compiling application</span>
                    {step >= 5 ? (
                      <span className="text-[#82B89D] text-[11px]">DONE · 2.4s</span>
                    ) : step === 4 ? (
                      <span className="text-[#E58B65] text-[11px]">COMPILING</span>
                    ) : null}
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
                    <span>Verifying build output</span>
                    {step >= 6 ? (
                      <span className="text-[#82B89D] text-[11px]">HERMETIC · SIGNED</span>
                    ) : step === 5 ? (
                      <span className="text-[#E58B65] text-[11px]">VERIFYING</span>
                    ) : null}
                  </div>
                </div>

                {/* Release identifier bridge */}
                <div
                  className={`pt-2 border-t border-[#22201E] flex items-center justify-between font-mono text-[12px] ${
                    step >= 6 ? "opacity-100" : "opacity-30"
                  }`}
                >
                  <span className="font-semibold text-[#F2F0EB]">release-v1.4.2</span>
                  <span className="text-[#82B89D] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#82B89D]" />
                    <span>Verified</span>
                  </span>
                </div>
              </div>

              {/* MOBILE ZONE 3: LIVE DESTINATION */}
              <div className="relative space-y-2.5">
                <div
                  className={`absolute -left-[27px] top-1.5 w-2.5 h-2.5 rounded-full border ${
                    step >= 8
                      ? "bg-[#82B89D] border-[#82B89D]"
                      : "bg-[#1C1B19] border-[#302D2A]"
                  }`}
                  aria-hidden="true"
                />
                <div className="font-mono text-[11px] text-[#77736D] uppercase tracking-wider">
                  03 / LIVE DESTINATION
                </div>

                <div
                  className={`space-y-2 ${
                    step >= 8 ? "opacity-100" : "opacity-30"
                  }`}
                >
                  <div className="font-mono text-[19px] sm:text-[21px] font-bold text-[#F2F0EB] break-all">
                    web-app.jetway.demo
                  </div>

                  <div
                    className={`flex items-center gap-2 font-mono text-[12px] text-[#82B89D] font-medium ${
                      step >= 9 ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#82B89D] animate-pulse" />
                    <span>LIVE · 200 OK</span>
                    <span className="text-[#44423E]">·</span>
                    <span className="text-[#77736D]">Global Edge</span>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* =================================================================
            DEMONSTRATION DISCLOSURE FOOTNOTE
            ================================================================= */}
        <div className="mt-20 pt-4 border-t border-[#262422]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-[#77736D]">
          <div className="flex items-center gap-2">
            <span className="text-[#E58B65]">◆</span>
            <span>Illustrative deployment sequence</span>
            <span>—</span>
            <span>Demonstrates workflow from source commit to live production</span>
          </div>
          <span className="hidden sm:inline">Zero live infrastructure claims</span>
        </div>
      </div>
    </section>
  );
}

export default GettingStarted;
