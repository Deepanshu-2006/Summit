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
 *
 * Cinematic live deployment experience progressing through four connected stages:
 *   01 — SOURCE:  acme/web-app · main · 8f3a21c
 *   02 — BUILD:   Resolving dependencies → Compiling application → Verifying build output
 *   03 — RELEASE: release-v1.4.2 · Build verified
 *   04 — LIVE:    web-app.jetway.demo · LIVE (strongest visual emphasis)
 *
 * Continuous open composition directly on Jetway's near-black canvas.
 * Connected by an animated transit line and commit marker communicating cause and effect.
 * No cards. No nested mockups. No dashboard chrome.
 * Fully responsive: horizontal on desktop, vertical rail on mobile.
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
      { threshold: 0.2 }
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

  // Timed sequential stage progression
  useEffect(() => {
    if (isReducedMotion || !hasTriggered) return;

    const timeouts: NodeJS.Timeout[] = [];

    // Step 1: Source appears
    const initialT = setTimeout(() => setAnimStep(1), 50);
    timeouts.push(initialT);

    // Step 2: Commit travels along line toward Build
    timeouts.push(setTimeout(() => setAnimStep(2), 600));

    // Step 3: Build substep 1 (Resolving dependencies)
    timeouts.push(setTimeout(() => setAnimStep(3), 1300));

    // Step 4: Build substep 2 (Compiling application)
    timeouts.push(setTimeout(() => setAnimStep(4), 2100));

    // Step 5: Build substep 3 (Verifying build output)
    timeouts.push(setTimeout(() => setAnimStep(5), 2900));

    // Step 6: Transition completed build into Release
    timeouts.push(setTimeout(() => setAnimStep(6), 3700));

    // Step 7: Release marker travels toward Live destination
    timeouts.push(setTimeout(() => setAnimStep(7), 4400));

    // Step 8: Live domain appears prominently
    timeouts.push(setTimeout(() => setAnimStep(8), 5000));

    // Step 9: Sage-green LIVE indicator settles in
    timeouts.push(setTimeout(() => setAnimStep(9), 5500));

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [hasTriggered, isReducedMotion]);

  // Calculate desktop transit line percentage
  const getHorizontalProgress = () => {
    if (isReducedMotion || step >= 7) return 100;
    if (step === 6) return 66;
    if (step >= 2) return 33;
    return 0;
  };

  // Calculate mobile vertical transit line percentage
  const getVerticalProgress = () => {
    if (isReducedMotion || step >= 7) return 100;
    if (step === 6) return 66;
    if (step >= 2) return 33;
    return 0;
  };

  return (
    <section
      ref={sectionRef}
      id="getting-started"
      className="relative w-full pt-16 pb-24 sm:pt-20 sm:pb-28 lg:pt-24 lg:pb-36 bg-[#111110] text-[#F2F0EB] overflow-hidden select-none"
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
            Preserved exactly as requested
            ================================================================= */}
        <div className="max-w-2xl mb-16 sm:mb-20 lg:mb-24">
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
            LIVE DEPLOYMENT SEQUENCE: Continuous Open Composition
            Four sequential stages connected by transit line:
              01 — SOURCE
              02 — BUILD
              03 — RELEASE
              04 — LIVE (Dominant visual conclusion)
            No cards. No card backgrounds. No nested mockups.
            ================================================================= */}
        <div className="relative w-full">
          
          {/* ---------------------------------------------------------------
              DESKTOP / TABLET HORIZONTAL TRACK (hidden on mobile)
              --------------------------------------------------------------- */}
          <div className="hidden md:block relative w-full pt-10 pb-6">
            
            {/* The Precision Connecting Line */}
            <div className="relative w-full h-[1.5px] bg-[#22201E] mb-12" aria-hidden="true">
              {/* Progress Line */}
              <div
                className={`h-full ${
                  step >= 7 ? "bg-[#82B89D]" : "bg-[#E58B65]"
                } ${
                  isReducedMotion
                    ? "w-full"
                    : "transition-all duration-700 ease-out origin-left"
                }`}
                style={{ width: `${getHorizontalProgress()}%` }}
              />

              {/* Travelling Commit Marker */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full ${
                  step >= 8
                    ? "bg-[#82B89D] ring-4 ring-[#82B89D]/20"
                    : "bg-[#E58B65] ring-4 ring-[#E58B65]/20"
                } ${
                  isReducedMotion
                    ? "left-full"
                    : "transition-all duration-700 ease-out"
                }`}
                style={{ left: `${getHorizontalProgress()}%` }}
              />

              {/* Fixed Stage Nodes */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 left-0 w-2 h-2 rounded-full border ${
                  step >= 1
                    ? "bg-[#E58B65] border-[#FFAA80]"
                    : "bg-[#1C1B19] border-[#302D2A]"
                }`}
              />
              <div
                className={`absolute top-1/2 -translate-y-1/2 left-[33%] w-2 h-2 rounded-full border ${
                  step >= 6
                    ? "bg-[#82B89D] border-[#82B89D]"
                    : step >= 2
                    ? "bg-[#E58B65] border-[#FFAA80]"
                    : "bg-[#1C1B19] border-[#302D2A]"
                }`}
              />
              <div
                className={`absolute top-1/2 -translate-y-1/2 left-[66%] w-2 h-2 rounded-full border ${
                  step >= 7
                    ? "bg-[#82B89D] border-[#82B89D]"
                    : step >= 6
                    ? "bg-[#E58B65] border-[#FFAA80]"
                    : "bg-[#1C1B19] border-[#302D2A]"
                }`}
              />
              <div
                className={`absolute top-1/2 -translate-y-1/2 left-full -translate-x-full w-2 h-2 rounded-full border ${
                  step >= 8
                    ? "bg-[#82B89D] border-[#82B89D]"
                    : "bg-[#1C1B19] border-[#302D2A]"
                }`}
              />
            </div>

            {/* The Four Connected Stages (Spacious Asymmetric Grid) */}
            <div className="grid grid-cols-12 gap-8 items-start">
              
              {/* STAGE 01 — SOURCE (Col 1-3) */}
              <div className="col-span-3 space-y-4">
                <div className="font-mono text-[11px] text-[#77736D] tracking-[0.1em] uppercase">
                  01 / SOURCE
                </div>

                <div
                  className={`space-y-1.5 transition-all duration-500 ${
                    step >= 1
                      ? "opacity-100 translate-y-0"
                      : "opacity-30 translate-y-1"
                  }`}
                >
                  <div className="font-mono text-[16px] sm:text-[17px] font-semibold text-[#F2F0EB]">
                    acme/web-app
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[12px] text-[#8E8A82] pt-0.5">
                    <GitCommit className="w-3.5 h-3.5 text-[#E58B65]" />
                    <span>main · 8f3a21c</span>
                  </div>

                  <p className="font-mono text-[11px] text-[#77736D] pt-1">
                    Commit received on main
                  </p>
                </div>
              </div>

              {/* STAGE 02 — BUILD (Col 4-7: Slightly wider for 3 substeps) */}
              <div className="col-span-4 space-y-4 lg:pl-4">
                <div className="font-mono text-[11px] text-[#77736D] tracking-[0.1em] uppercase">
                  02 / BUILD
                </div>

                <div className="space-y-2.5 pt-0.5 font-mono text-[12.5px]">
                  {/* Build Substep 1: Resolving dependencies */}
                  <div
                    className={`flex items-center justify-between transition-colors duration-400 ${
                      step >= 4
                        ? "text-[#8E8A82]"
                        : step === 3
                        ? "text-[#F2F0EB] font-medium"
                        : "text-[#3E3C38]"
                    }`}
                  >
                    <span>Resolving dependencies</span>
                    {step >= 4 ? (
                      <span className="text-[#82B89D] text-[11px] font-medium">✓</span>
                    ) : step === 3 ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E58B65] animate-pulse" />
                    ) : null}
                  </div>

                  {/* Build Substep 2: Compiling application */}
                  <div
                    className={`flex items-center justify-between transition-colors duration-400 ${
                      step >= 5
                        ? "text-[#8E8A82]"
                        : step === 4
                        ? "text-[#F2F0EB] font-medium"
                        : "text-[#3E3C38]"
                    }`}
                  >
                    <span>Compiling application</span>
                    {step >= 5 ? (
                      <span className="text-[#82B89D] text-[11px] font-medium">✓</span>
                    ) : step === 4 ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E58B65] animate-pulse" />
                    ) : null}
                  </div>

                  {/* Build Substep 3: Verifying build output */}
                  <div
                    className={`flex items-center justify-between transition-colors duration-400 ${
                      step >= 6
                        ? "text-[#8E8A82]"
                        : step === 5
                        ? "text-[#F2F0EB] font-medium"
                        : "text-[#3E3C38]"
                    }`}
                  >
                    <span>Verifying build output</span>
                    {step >= 6 ? (
                      <span className="text-[#82B89D] text-[11px] font-medium">✓</span>
                    ) : step === 5 ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E58B65] animate-pulse" />
                    ) : null}
                  </div>

                  {/* Single subtle build progress indicator */}
                  <div
                    className="mt-3.5 w-full h-[1.5px] bg-[#22201E] overflow-hidden"
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
                </div>
              </div>

              {/* STAGE 03 — RELEASE (Col 8-9) */}
              <div className="col-span-2 space-y-4">
                <div className="font-mono text-[11px] text-[#77736D] tracking-[0.1em] uppercase">
                  03 / RELEASE
                </div>

                <div
                  className={`space-y-1.5 transition-all duration-500 ${
                    step >= 6
                      ? "opacity-100 translate-y-0"
                      : "opacity-30 translate-y-1"
                  }`}
                >
                  <div className="font-mono text-[16px] sm:text-[17px] font-semibold text-[#F2F0EB]">
                    release-v1.4.2
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[12px] text-[#82B89D] pt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#82B89D]" />
                    <span>Build verified</span>
                  </div>

                  <p className="font-mono text-[11px] text-[#77736D] pt-1">
                    Hermetic digest signed
                  </p>
                </div>
              </div>

              {/* STAGE 04 — LIVE (Col 10-12: Strongest visual emphasis) */}
              <div className="col-span-3 space-y-4">
                <div className="font-mono text-[11px] text-[#77736D] tracking-[0.1em] uppercase">
                  04 / LIVE
                </div>

                <div
                  className={`space-y-2 transition-all duration-600 ${
                    step >= 8
                      ? "opacity-100 translate-y-0"
                      : "opacity-30 translate-y-1"
                  }`}
                >
                  {/* Dominant live domain */}
                  <div className="font-mono text-[19px] sm:text-[21px] lg:text-[23px] xl:text-[25px] font-semibold tracking-tight text-[#F2F0EB]">
                    web-app.jetway.demo
                  </div>

                  {/* Restrained sage-green status indicator */}
                  <div
                    className={`flex items-center gap-2 font-mono text-[12px] transition-opacity duration-500 ${
                      step >= 9
                        ? "opacity-100 text-[#82B89D] font-medium"
                        : "opacity-0"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#82B89D] animate-pulse" />
                    <span>LIVE</span>
                    <span className="text-[#44423E]">·</span>
                    <span className="text-[#8E8A82]">200 OK</span>
                  </div>

                  <p className="font-mono text-[11px] text-[#77736D] pt-0.5">
                    Global edge routing active
                  </p>
                </div>
              </div>

            </div>

          </div>

          {/* ---------------------------------------------------------------
              MOBILE VERTICAL TRACK (shown on screens < 768px)
              Adapts into clear vertical progression with identical logic
              --------------------------------------------------------------- */}
          <div className="block md:hidden relative w-full pl-8 py-2">
            
            {/* Vertical Connecting Track Line */}
            <div
              className="absolute left-[11px] top-3 bottom-8 w-[1.5px] bg-[#22201E]"
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
                style={{ height: `${getVerticalProgress()}%` }}
              />
            </div>

            <div className="space-y-10">
              
              {/* MOBILE STAGE 01 — SOURCE */}
              <div className="relative space-y-2">
                <div
                  className={`absolute -left-[27px] top-1.5 w-2.5 h-2.5 rounded-full border ${
                    step >= 1
                      ? "bg-[#E58B65] border-[#FFAA80]"
                      : "bg-[#1C1B19] border-[#302D2A]"
                  }`}
                  aria-hidden="true"
                />
                <div className="font-mono text-[11px] text-[#77736D] uppercase">
                  01 / SOURCE
                </div>
                <div className="font-mono text-[16px] font-semibold text-[#F2F0EB]">
                  acme/web-app
                </div>
                <div className="flex items-center gap-2 font-mono text-[12px] text-[#8E8A82]">
                  <GitCommit className="w-3.5 h-3.5 text-[#E58B65]" />
                  <span>main · 8f3a21c</span>
                </div>
              </div>

              {/* MOBILE STAGE 02 — BUILD */}
              <div className="relative space-y-2">
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
                <div className="font-mono text-[11px] text-[#77736D] uppercase">
                  02 / BUILD
                </div>
                <div className="space-y-2 font-mono text-[12.5px] pt-1">
                  <div
                    className={`flex items-center justify-between ${
                      step >= 4
                        ? "text-[#8E8A82]"
                        : step === 3
                        ? "text-[#F2F0EB] font-medium"
                        : "text-[#3E3C38]"
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
                        : "text-[#3E3C38]"
                    }`}
                  >
                    <span>Compiling application</span>
                    {step >= 5 && <span className="text-[#82B89D]">✓</span>}
                  </div>
                  <div
                    className={`flex items-center justify-between ${
                      step >= 6
                        ? "text-[#8E8A82]"
                        : step === 5
                        ? "text-[#F2F0EB] font-medium"
                        : "text-[#3E3C38]"
                    }`}
                  >
                    <span>Verifying build output</span>
                    {step >= 6 && <span className="text-[#82B89D]">✓</span>}
                  </div>
                </div>
              </div>

              {/* MOBILE STAGE 03 — RELEASE */}
              <div className="relative space-y-2">
                <div
                  className={`absolute -left-[27px] top-1.5 w-2.5 h-2.5 rounded-full border ${
                    step >= 7
                      ? "bg-[#82B89D] border-[#82B89D]"
                      : step >= 6
                      ? "bg-[#E58B65] border-[#FFAA80]"
                      : "bg-[#1C1B19] border-[#302D2A]"
                  }`}
                  aria-hidden="true"
                />
                <div className="font-mono text-[11px] text-[#77736D] uppercase">
                  03 / RELEASE
                </div>
                <div
                  className={`space-y-1 ${
                    step >= 6 ? "opacity-100" : "opacity-30"
                  }`}
                >
                  <div className="font-mono text-[16px] font-semibold text-[#F2F0EB]">
                    release-v1.4.2
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[12px] text-[#82B89D]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#82B89D]" />
                    <span>Build verified</span>
                  </div>
                </div>
              </div>

              {/* MOBILE STAGE 04 — LIVE */}
              <div className="relative space-y-2">
                <div
                  className={`absolute -left-[27px] top-1.5 w-2.5 h-2.5 rounded-full border ${
                    step >= 8
                      ? "bg-[#82B89D] border-[#82B89D]"
                      : "bg-[#1C1B19] border-[#302D2A]"
                  }`}
                  aria-hidden="true"
                />
                <div className="font-mono text-[11px] text-[#77736D] uppercase">
                  04 / LIVE
                </div>
                <div
                  className={`space-y-2 ${
                    step >= 8 ? "opacity-100" : "opacity-30"
                  }`}
                >
                  <div className="font-mono text-[18px] sm:text-[20px] font-semibold text-[#F2F0EB] break-all">
                    web-app.jetway.demo
                  </div>
                  <div
                    className={`flex items-center gap-2 font-mono text-[12px] text-[#82B89D] font-medium ${
                      step >= 9 ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#82B89D] animate-pulse" />
                    <span>LIVE · 200 OK</span>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* =================================================================
            RESTRAINED DEMONSTRATION DISCLOSURE FOOTNOTE
            ================================================================= */}
        <div className="mt-20 pt-4 border-t border-[#262422]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-[#77736D]">
          <div className="flex items-center gap-2">
            <span className="text-[#E58B65]">◆</span>
            <span>Illustrative deployment sequence</span>
            <span>—</span>
            <span>Demonstrates the workflow from source commit to live production</span>
          </div>
          <span className="hidden sm:inline">Zero live infrastructure claims</span>
        </div>
      </div>
    </section>
  );
}

export default GettingStarted;
