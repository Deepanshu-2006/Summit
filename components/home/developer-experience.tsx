"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import {
  GitBranch,
  GitCommit,
  CheckCircle2,
  Globe,
  ShieldCheck,
  Layers,
  Clock,
  Radio,
  Sliders,
} from "lucide-react";

/**
 * Subscription to prefers-reduced-motion media query
 */
function subscribeReducedMotion(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

interface DeploymentEvent {
  id: string;
  title: string;
  target: string;
  outcome: string;
  timestamp: string;
  type: "completed" | "preview" | "cached";
}

const TIMELINE_EVENTS: DeploymentEvent[] = [
  {
    id: "ev-cutover",
    title: "Production cutover completed",
    target: "app.jetway.demo · commit 8f3a21c",
    outcome: "100% traffic",
    timestamp: "2m ago",
    type: "completed",
  },
  {
    id: "ev-preview",
    title: "Branch preview online",
    target: "pr-42.preview.jetway.app · feat/auth-revamp",
    outcome: "Active preview",
    timestamp: "14m ago",
    type: "preview",
  },
  {
    id: "ev-cache",
    title: "Hermetic build artifact cached",
    target: "digest sha256:77df0c · layer cache hit",
    outcome: "Cached",
    timestamp: "32m ago",
    type: "cached",
  },
];

/**
 * DeveloperExperience: Section 05 — Developer Experience
 * "Built for the way you work."
 *
 * Art-directed editorial layout:
 * - One prominent, full-width first pillar: Continuous horizontal workflow (Repository → Build → Ready)
 * - Two complementary lower pillars: Chronological deployment stream + Minimal settings composition
 * - Warm charcoal surfaces (#131312), warm off-white typography (#F0EEE9), burnt orange (#E58A61), sage green (#82B89D)
 * - Restrained typography and zero nested card-within-card clutter.
 */
export function DeveloperExperience() {
  // Pillar 1: Smooth 4.8s continuous animation loop
  const [workflowTime, setWorkflowTime] = useState(0);
  const [isInViewport, setIsInViewport] = useState(true);
  const [timelineRevealed, setTimelineRevealed] = useState(false);
  const [branchPreviews, setBranchPreviews] = useState(true);

  const sectionRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  // Intersection observer to pause background loop when offscreen
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // One-shot entrance reveal for Pillar 2 timeline
  useEffect(() => {
    const el = timelineRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimelineRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Pillar 1 continuous workflow cycle (4800ms)
  useEffect(() => {
    if (isReducedMotion || !isInViewport) return;

    let animId: number;
    let startTimestamp: number | null = null;

    const loop = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const cycle = elapsed % 4800;
      setWorkflowTime(cycle);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isReducedMotion, isInViewport]);

  // Pillar 1 phase derivations
  // 0ms - 900ms: Commit initiated & signal 1 travels
  // 900ms - 2200ms: Automatic build active & compiling
  // 2200ms - 3200ms: Signal 2 travels to Ready
  // 3200ms - 4800ms: Ready state in sage green; settled reading period
  const isP1Commit = !isReducedMotion && workflowTime < 900;
  const isP1Build = !isReducedMotion && workflowTime >= 900 && workflowTime < 2200;
  const isP1Deploy = !isReducedMotion && workflowTime >= 2200 && workflowTime < 3200;
  const isP1Ready = isReducedMotion || workflowTime >= 3200;

  // Signal progress values (0 to 1)
  const signal1Progress = isReducedMotion
    ? 1
    : workflowTime < 900
    ? workflowTime / 900
    : 1;

  const signal2Progress = isReducedMotion
    ? 1
    : workflowTime < 2200
    ? 0
    : workflowTime < 3200
    ? (workflowTime - 2200) / 1000
    : 1;

  return (
    <section
      ref={sectionRef}
      id="developer-experience"
      className="relative w-full pt-16 pb-24 sm:pt-20 sm:pb-28 lg:pt-24 lg:pb-36 bg-[#111110] text-[#F0EEE9] overflow-hidden select-none"
      aria-labelledby="devex-heading"
    >
      <div className="layout-container w-full">
        {/* =================================================================
            SECTION IDENTIFIER: 05 / DEVELOPER EXPERIENCE
            Understated divider line matching Section 02 / 04 standard
            ================================================================= */}
        <div className="w-full border-t border-[#262422] pt-5 mb-10 sm:mb-14">
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#77736D] tracking-[0.1em] uppercase">
            <span className="text-[#E58A61] font-medium">05</span>
            <span>/</span>
            <span>DEVELOPER EXPERIENCE</span>
          </div>
        </div>

        {/* =================================================================
            SECTION INTRODUCTION: Crisp typography, natural line height
            ================================================================= */}
        <div className="max-w-2xl mb-12 sm:mb-16">
          <h2
            id="devex-heading"
            className="font-sans text-[36px] sm:text-[44px] lg:text-[50px] font-medium leading-[1.08] tracking-[-0.03em] text-[#F0EEE9] mb-5"
          >
            Built for the way you work.
          </h2>
          <p className="font-sans text-[16px] sm:text-[17px] text-[#9E9A92] leading-[1.65]">
            Your tools should help you move forward, not slow you down. Keep
            your development workflow focused, your deployments understandable,
            and the essentials within reach.
          </p>
        </div>

        {/* =================================================================
            THREE PILLARS: ONE EDITORIAL COMPOSITION
            1. Wide Full-Width Pillar (Workflow Sequence)
            2. Split Row: Pillar 02 (Timeline) + Pillar 03 (Settings)
            ================================================================= */}
        <div className="space-y-6 sm:space-y-8">
          {/* ---------------------------------------------------------------
              PILLAR 01: Full-Width Continuous Workflow Sequence
              Repository → Automatic Build → Ready
              --------------------------------------------------------------- */}
          <div className="w-full rounded-[12px] bg-[#141413] border border-[#242220] p-6 sm:p-8 lg:p-10 relative overflow-hidden transition-all duration-300">
            {/* Header copy */}
            <div className="max-w-xl mb-8 sm:mb-10">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="font-mono text-[10.5px] text-[#E58A61] font-medium tracking-[0.08em] uppercase">
                  01 / WORKFLOW INTEGRATION
                </span>
              </div>
              <h3 className="font-sans text-[22px] sm:text-[26px] font-medium tracking-tight text-[#F0EEE9] mb-2.5">
                Start with the code you already have.
              </h3>
              <p className="font-sans text-[14.5px] sm:text-[15px] text-[#9E9A92] leading-relaxed">
                Connect your repository and build on the development workflow
                you already know.
              </p>
            </div>

            {/* Continuous Horizontal Workflow Sequence */}
            <div className="w-full pt-4 pb-2">
              <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 lg:gap-0 items-center">
                
                {/* --- Stage 1: Repository Origin --- */}
                <div className="lg:col-span-3 w-full">
                  <div
                    className={`rounded-[8px] p-4 transition-all duration-300 border ${
                      isP1Commit
                        ? "bg-[#1A1816] border-[#E58A61]/50 shadow-[0_0_15px_rgba(229,138,97,0.12)]"
                        : "bg-[#171615] border-[#2B2825]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <GitBranch
                          className={`w-3.5 h-3.5 transition-colors duration-300 ${
                            isP1Commit ? "text-[#E58A61]" : "text-[#77736D]"
                          }`}
                        />
                        <span className="font-mono text-[13px] font-semibold text-[#F0EEE9]">
                          acme/jetway-app
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-[#77736D] px-1.5 py-0.5 rounded bg-[#1F1E1C] border border-[#2B2825]">
                        main
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#8A8780]">
                      <GitCommit
                        className={`w-3 h-3 transition-colors duration-300 ${
                          isP1Commit ? "text-[#FFAA80]" : "text-[#6E6A63]"
                        }`}
                      />
                      <span className="truncate">8f3a21c · sync production dependencies</span>
                    </div>
                  </div>
                </div>

                {/* --- Connector 1: Repository to Build --- */}
                <div className="lg:col-span-1 hidden lg:flex items-center justify-center px-1">
                  <div className="w-full relative flex items-center justify-center">
                    {/* Background track */}
                    <div className="w-full h-[1.5px] bg-[#262422]" />
                    {/* Traveling Signal Pulse */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-[2px] bg-gradient-to-r from-transparent via-[#FFAA80] to-[#E58A61] transition-all duration-100"
                      style={{
                        left: `${Math.max(0, signal1Progress * 100 - 40)}%`,
                        width: "40%",
                        opacity: isP1Commit ? 1 : 0.25,
                      }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#FFAA80] shadow-[0_0_8px_#FFAA80] transition-all duration-100"
                      style={{
                        left: `calc(${signal1Progress * 100}% - 4px)`,
                        opacity: isP1Commit ? 1 : 0,
                      }}
                    />
                  </div>
                </div>

                {/* --- Stage 2: Automatic Build Pipeline --- */}
                <div className="lg:col-span-3 w-full">
                  <div
                    className={`rounded-[8px] p-4 transition-all duration-300 border ${
                      isP1Build
                        ? "bg-[#1A1816] border-[#E58A61]/60 shadow-[0_0_15px_rgba(229,138,97,0.15)]"
                        : "bg-[#171615] border-[#2B2825]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <Layers
                          className={`w-3.5 h-3.5 transition-colors duration-300 ${
                            isP1Build ? "text-[#E58A61] animate-pulse" : "text-[#77736D]"
                          }`}
                        />
                        <span className="font-mono text-[13px] font-medium text-[#F0EEE9]">
                          Automatic Build
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                            isP1Build
                              ? "bg-[#FFAA80] shadow-[0_0_6px_#FFAA80]"
                              : isP1Ready || isP1Deploy
                              ? "bg-[#82B89D]"
                              : "bg-[#45423E]"
                          }`}
                        />
                        <span
                          className={`font-mono text-[10px] uppercase tracking-wider transition-colors duration-300 ${
                            isP1Build
                              ? "text-[#FFAA80] font-medium"
                              : isP1Ready || isP1Deploy
                              ? "text-[#82B89D]"
                              : "text-[#6E6A63]"
                          }`}
                        >
                          {isP1Build ? "Compiling" : isP1Ready || isP1Deploy ? "Compiled" : "Standby"}
                        </span>
                      </div>
                    </div>
                    <div className="font-mono text-[11px] text-[#8A8780] truncate">
                      {isP1Build ? "Resolving hermetic container digest..." : "Hermetic container runtime"}
                    </div>
                  </div>
                </div>

                {/* --- Connector 2: Build to Ready --- */}
                <div className="lg:col-span-1 hidden lg:flex items-center justify-center px-1">
                  <div className="w-full relative flex items-center justify-center">
                    {/* Background track */}
                    <div className="w-full h-[1.5px] bg-[#262422]" />
                    {/* Traveling Signal Pulse */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-[2px] bg-gradient-to-r from-transparent via-[#A8D4BC] to-[#82B89D] transition-all duration-100"
                      style={{
                        left: `${Math.max(0, signal2Progress * 100 - 40)}%`,
                        width: "40%",
                        opacity: isP1Deploy ? 1 : 0.25,
                      }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#82B89D] shadow-[0_0_8px_#82B89D] transition-all duration-100"
                      style={{
                        left: `calc(${signal2Progress * 100}% - 4px)`,
                        opacity: isP1Deploy ? 1 : 0,
                      }}
                    />
                  </div>
                </div>

                {/* --- Stage 3: Production Ready --- */}
                <div className="lg:col-span-3 w-full">
                  <div
                    className={`rounded-[8px] p-4 transition-all duration-300 border ${
                      isP1Ready
                        ? "bg-[#121E17] border-[#82B89D]/50 shadow-[0_0_15px_rgba(130,184,157,0.12)]"
                        : "bg-[#171615] border-[#2B2825]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2
                          className={`w-3.5 h-3.5 transition-colors duration-300 ${
                            isP1Ready ? "text-[#82B89D]" : "text-[#77736D]"
                          }`}
                        />
                        <span className="font-mono text-[13px] font-semibold text-[#F0EEE9]">
                          app.jetway.demo
                        </span>
                      </div>
                      <div
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[10.5px] font-medium transition-all duration-300 ${
                          isP1Ready
                            ? "bg-[#82B89D]/20 text-[#82B89D] border border-[#82B89D]/30"
                            : "bg-[#1F1E1C] text-[#6E6A63] border border-[#2B2825]"
                        }`}
                      >
                        <span>Ready in 1.4s</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-[#8A8780]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#82B89D]" />
                      <span>Anycast Edge · TLS Verified</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------
              SPLIT ROW: PILLARS 02 & 03
              Pillar 02: Chronological Deployment Stream
              Pillar 03: Focused Settings Composition
              --------------------------------------------------------------- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            
            {/* =============================================================
                PILLAR 02: Deployment Visibility
                A compact chronological stream of three deployment events
                ============================================================= */}
            <div
              ref={timelineRef}
              className="w-full rounded-[12px] bg-[#141413] border border-[#242220] p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden"
            >
              {/* Header Copy */}
              <div className="mb-6 sm:mb-8">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="font-mono text-[10.5px] text-[#E58A61] font-medium tracking-[0.08em] uppercase">
                    02 / DEPLOYMENT VISIBILITY
                  </span>
                </div>
                <h3 className="font-sans text-[20px] sm:text-[23px] font-medium tracking-tight text-[#F0EEE9] mb-2">
                  Know where every deployment stands.
                </h3>
                <p className="font-sans text-[14px] sm:text-[14.5px] text-[#9E9A92] leading-relaxed">
                  Make build results and deployment status easy to understand, so
                  you can spend less time searching for answers.
                </p>
              </div>

              {/* Chronological Stream: Single Vertical Timeline */}
              <div className="relative pl-6 sm:pl-7 space-y-6 pt-1">
                {/* Continuous Vertical Timeline Line */}
                <div
                  className="absolute left-[11px] top-2 bottom-2 w-[1.5px] bg-[#262422] transition-opacity duration-700"
                  style={{ opacity: timelineRevealed || isReducedMotion ? 1 : 0.3 }}
                />

                {TIMELINE_EVENTS.map((event, idx) => {
                  const isVisible = timelineRevealed || isReducedMotion;
                  return (
                    <div
                      key={event.id}
                      className="relative transition-all duration-500 ease-out"
                      style={{
                        opacity: isVisible ? 1 : 0,
                        transform: isVisible ? "translateY(0)" : "translateY(8px)",
                        transitionDelay: `${idx * 120}ms`,
                      }}
                    >
                      {/* Timeline Node Marker */}
                      <div className="absolute -left-[23px] sm:-left-[24px] top-1">
                        {event.type === "completed" ? (
                          <div className="w-[15px] h-[15px] rounded-full bg-[#121F17] border border-[#82B89D] flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#82B89D]" />
                          </div>
                        ) : event.type === "preview" ? (
                          <div className="w-[15px] h-[15px] rounded-full bg-[#1E1914] border border-[#E58A61] flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#E58A61]" />
                          </div>
                        ) : (
                          <div className="w-[15px] h-[15px] rounded-full bg-[#161514] border border-[#4A4641] flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#77736D]" />
                          </div>
                        )}
                      </div>

                      {/* Event Row Body */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4">
                        <div className="min-w-0">
                          <div className="font-sans text-[14px] font-medium text-[#F0EEE9]">
                            {event.title}
                          </div>
                          <div className="font-mono text-[11px] text-[#8A8780] mt-0.5 truncate">
                            {event.target}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 font-mono text-[10.5px]">
                          <span
                            className={`px-2 py-0.5 rounded font-medium ${
                              event.type === "completed"
                                ? "bg-[#82B89D]/15 text-[#82B89D] border border-[#82B89D]/25"
                                : event.type === "preview"
                                ? "bg-[#E58A61]/15 text-[#FFAA80] border border-[#E58A61]/25"
                                : "bg-[#1E1D1B] text-[#8A8780] border border-[#2B2825]"
                            }`}
                          >
                            {event.outcome}
                          </span>
                          <span className="text-[#6E6A63] flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{event.timestamp}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* =============================================================
                PILLAR 03: Control Without Clutter
                Clean, focused settings composition without nested card boxes
                ============================================================= */}
            <div className="w-full rounded-[12px] bg-[#141413] border border-[#242220] p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden">
              {/* Header Copy */}
              <div className="mb-6 sm:mb-8">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="font-mono text-[10.5px] text-[#E58A61] font-medium tracking-[0.08em] uppercase">
                    03 / PROJECT CONTROL
                  </span>
                </div>
                <h3 className="font-sans text-[20px] sm:text-[23px] font-medium tracking-tight text-[#F0EEE9] mb-2">
                  Keep the essentials within reach.
                </h3>
                <p className="font-sans text-[14px] sm:text-[14.5px] text-[#9E9A92] leading-relaxed">
                  Give developers a clear place to understand their applications
                  and access the settings they need.
                </p>
              </div>

              {/* Integrated Settings List */}
              <div className="space-y-4 pt-1">
                
                {/* Setting 1: Custom Domain & SSL */}
                <div className="flex items-center justify-between gap-4 p-3 rounded-[8px] bg-[#171615] border border-[#262422] hover:border-[#383430] transition-colors duration-200">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-[6px] bg-[#1E1D1B] border border-[#2E2A27] flex items-center justify-center shrink-0">
                      <Globe className="w-4 h-4 text-[#8A8780]" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-sans text-[13.5px] font-medium text-[#F0EEE9]">
                        Custom Domain
                      </div>
                      <div className="font-mono text-[11px] text-[#8A8780] truncate">
                        app.jetway.demo
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[#122017] border border-[#234431] text-[#82B89D] font-mono text-[11px] shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>SSL Active</span>
                  </div>
                </div>

                {/* Setting 2: Branch Previews Toggle */}
                <div className="flex items-center justify-between gap-4 p-3 rounded-[8px] bg-[#171615] border border-[#262422] hover:border-[#383430] transition-colors duration-200">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-[6px] bg-[#1E1D1B] border border-[#2E2A27] flex items-center justify-center shrink-0">
                      <Radio className="w-4 h-4 text-[#8A8780]" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-sans text-[13.5px] font-medium text-[#F0EEE9]">
                        Branch Previews
                      </div>
                      <div className="font-sans text-[12px] text-[#8A8780] truncate">
                        Automatic preview URL per pull request
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-mono text-[11px] text-[#8A8780] hidden sm:inline">
                      {branchPreviews ? "Enabled" : "Paused"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={branchPreviews}
                      aria-label="Toggle branch preview deployments"
                      onClick={() => setBranchPreviews((prev) => !prev)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E58A61] ${
                        branchPreviews ? "bg-[#E58A61]" : "bg-[#2E2A27]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          branchPreviews ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Setting 3: Environment Target */}
                <div className="flex items-center justify-between gap-4 p-3 rounded-[8px] bg-[#171615] border border-[#262422] hover:border-[#383430] transition-colors duration-200">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-[6px] bg-[#1E1D1B] border border-[#2E2A27] flex items-center justify-center shrink-0">
                      <Sliders className="w-4 h-4 text-[#8A8780]" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-sans text-[13.5px] font-medium text-[#F0EEE9]">
                        Environment Target
                      </div>
                      <div className="font-sans text-[12px] text-[#8A8780] truncate">
                        Production & preview secret isolation
                      </div>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-[5px] bg-[#1E1D1B] border border-[#2E2A27] font-mono text-[11px] text-[#A5A19A] shrink-0">
                    3 keys isolated
                  </span>
                </div>

              </div>
            </div>

          </div>
        </div>

        {/* =================================================================
            UNDERSTATED REAR FOOTNOTE: Architecture Alignment
            ================================================================= */}
        <div className="mt-12 pt-5 border-t border-[#262422] flex items-center justify-between text-[11px] font-mono text-[#6E6A63]">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E58A61]" />
            <span>05 / ARCHITECTURE · DEVELOPER WORKFLOW</span>
          </div>
          <span className="hidden sm:inline text-[#55514C]">
            BUILT-IN AUTOMATION · ZERO CONFIGURATION BY DEFAULT
          </span>
        </div>
      </div>
    </section>
  );
}

export default DeveloperExperience;
