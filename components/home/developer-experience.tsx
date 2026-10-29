"use client";

import React, { useState, useRef, useEffect, useSyncExternalStore } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Radio,
  FileText,
  Server,
  GitCommit,
  ArrowRight,
  Globe,
  Cpu,
} from "lucide-react";

// =============================================================================
// PILLARS DATA — Section 05: Developer Experience (Typography-First)
// =============================================================================
interface Pillar {
  number: string;
  headline: string;
  supportingText: string;
}

const PILLARS: Pillar[] = [
  {
    number: "01",
    headline: "Start with the code.",
    supportingText:
      "Bring your repository and keep the workflow you already know.",
  },
  {
    number: "02",
    headline: "Know what's happening.",
    supportingText:
      "Understand every build and deployment without digging through logs.",
  },
  {
    number: "03",
    headline: "Everything you need. Nothing you don't.",
    supportingText:
      "Keep application settings, domains, and environments within reach.",
  },
];

// =============================================================================
// PRODUCTION VISIBILITY DATA — 3 Coordinated Perspectives
// =============================================================================
interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  detail: string;
  type: "release" | "health" | "build" | "trigger";
}

const TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: "e1",
    time: "14:28:10",
    title: "Release cutover completed",
    detail: "release-v1.4.2 traffic shifted to 100% · zero drop",
    type: "release",
  },
  {
    id: "e2",
    time: "14:27:52",
    title: "Edge synthetic probes passed",
    detail: "Latency verified across 4 regions (iad1, sfo1, lhr1, nrt1)",
    type: "health",
  },
  {
    id: "e3",
    time: "14:27:38",
    title: "Hermetic container signed",
    detail: "Digest sha256:8f3a21c registered to artifact registry",
    type: "build",
  },
  {
    id: "e4",
    time: "14:26:44",
    title: "Deployment initiated",
    detail: "Commit 8f3a21c received on branch main",
    type: "trigger",
  },
];

interface DiagnosticEntry {
  id: string;
  time: string;
  method: "GET" | "POST" | "SYS";
  path: string;
  status: string;
  latency: string;
  region: string;
  category: "http" | "sys";
}

const DIAGNOSTIC_LOGS: DiagnosticEntry[] = [
  {
    id: "d1",
    time: "14:28:02",
    method: "GET",
    path: "/api/v1/health",
    status: "200 OK",
    latency: "8ms",
    region: "iad1",
    category: "http",
  },
  {
    id: "d2",
    time: "14:27:49",
    method: "POST",
    path: "/api/v1/auth/session",
    status: "200 OK",
    latency: "24ms",
    region: "iad1",
    category: "http",
  },
  {
    id: "d3",
    time: "14:26:15",
    method: "GET",
    path: "/",
    status: "200 OK",
    latency: "12ms",
    region: "sfo1",
    category: "http",
  },
  {
    id: "d4",
    time: "14:25:34",
    method: "SYS",
    path: "runtime-worker-initialized",
    status: "READY",
    latency: "120ms",
    region: "worker-04",
    category: "sys",
  },
  {
    id: "d5",
    time: "14:25:12",
    method: "GET",
    path: "/api/v1/projects",
    status: "200 OK",
    latency: "18ms",
    region: "lhr1",
    category: "http",
  },
  {
    id: "d6",
    time: "14:24:50",
    method: "GET",
    path: "/api/v1/telemetry/stream",
    status: "101 SWITCH",
    latency: "15ms",
    region: "edge-anycast",
    category: "http",
  },
];

interface EdgeRegionProbe {
  code: string;
  name: string;
  latency: string;
  status: string;
}

const EDGE_PROBES: EdgeRegionProbe[] = [
  { code: "iad1", name: "US East (N. Virginia)", latency: "9ms", status: "200 OK" },
  { code: "sfo1", name: "US West (San Francisco)", latency: "14ms", status: "200 OK" },
  { code: "lhr1", name: "Europe (London)", latency: "21ms", status: "200 OK" },
  { code: "nrt1", name: "Asia (Tokyo)", latency: "32ms", status: "200 OK" },
];

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
 * DeveloperExperience: Unified Storytelling Section
 * Merges Section 05 (Developer Experience Pillars) and Section 06 (Production Visibility)
 * into ONE continuous, art-directed editorial narrative.
 *
 * Flow:
 * 1. Part 1: Philosophy — Large typography-led pillars (Start with the code, Know what's happening, Everything you need).
 * 2. Transition: Natural chapter progression without harsh section boundaries.
 * 3. Part 2: Reality — Coordinated, diagonally layered carousel with 3 views:
 *    - VIEW 1: Deployment Activity (Cutover, hermetic digest, commit triggers)
 *    - VIEW 2: Application Health (Operational state, synthetic edge probes, TLS)
 *    - VIEW 3: Runtime Diagnostics (Structured HTTP & system telemetry)
 */
export function DeveloperExperience() {
  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [logFilter, setLogFilter] = useState<"all" | "http" | "sys">("all");
  const trackRef = useRef<HTMLDivElement>(null);
  const isManualScrollRef = useRef<boolean>(false);

  // Scroll listener for natural, reversible progression across the 3 diagonal views
  useEffect(() => {
    if (isReducedMotion) return;

    const handleScroll = () => {
      if (isManualScrollRef.current) return;
      if (!trackRef.current) return;

      const rect = trackRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const scrollableDistance = rect.height - viewportHeight;

      if (scrollableDistance <= 0) return;

      // Calculate progress through this section's vertical runway
      // 0 = top of track reaches top of viewport
      // 1 = bottom of track reaches bottom of viewport
      const currentScroll = -rect.top;
      const progress = Math.max(0, Math.min(1, currentScroll / scrollableDistance));

      if (progress < 0.35) {
        setActiveIndex(0);
      } else if (progress < 0.70) {
        setActiveIndex(1);
      } else {
        setActiveIndex(2);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isReducedMotion]);

  // Click on a view tab smoothly transitions both state and document scroll
  const handleSelectView = (index: number) => {
    setActiveIndex(index);

    if (typeof window !== "undefined" && trackRef.current && window.innerWidth >= 768 && !isReducedMotion) {
      const rect = trackRef.current.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const trackTop = rect.top + scrollTop;
      const scrollableDistance = rect.height - window.innerHeight;

      if (scrollableDistance > 0) {
        const targetFraction = index === 0 ? 0.12 : index === 1 ? 0.50 : 0.85;
        const targetScrollY = trackTop + targetFraction * scrollableDistance;

        isManualScrollRef.current = true;
        window.scrollTo({ top: targetScrollY, behavior: "smooth" });

        const timeout = setTimeout(() => {
          isManualScrollRef.current = false;
        }, 700);

        return () => clearTimeout(timeout);
      }
    }
  };

  const filteredLogs =
    logFilter === "all"
      ? DIAGNOSTIC_LOGS
      : DIAGNOSTIC_LOGS.filter((l) => l.category === logFilter);

  // Transform calculation for the diagonal layered panels on desktop/tablet
  const getPanelStyle = (panelIndex: number): React.CSSProperties => {
    if (isReducedMotion) {
      const isActive = panelIndex === activeIndex;
      return {
        display: isActive ? "block" : "none",
        position: "relative",
        opacity: 1,
        transform: "none",
        zIndex: 10,
      };
    }

    const diff = panelIndex - activeIndex;

    // ACTIVE PANEL (Focal point: center, dominant, scale 1, opacity 100%)
    if (diff === 0) {
      return {
        transform: "translate3d(0px, 0px, 0px) scale(1)",
        opacity: 1,
        zIndex: 30,
        pointerEvents: "auto",
        transition: "transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease",
      };
    }

    // PRECEDING PANEL (Sits slightly behind and to the left: -X, -Y, scale down)
    if (diff === -1) {
      return {
        transform: "translate3d(-64px, -20px, 0px) scale(0.94)",
        opacity: 0.35,
        zIndex: 10,
        pointerEvents: "auto",
        transition: "transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease",
      };
    }

    // UPCOMING PANEL (Sits slightly behind and to the right: +X, +Y, scale down)
    if (diff === 1) {
      return {
        transform: "translate3d(64px, 20px, 0px) scale(0.94)",
        opacity: 0.35,
        zIndex: 20,
        pointerEvents: "auto",
        transition: "transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease",
      };
    }

    // 2+ STEPS PRECEDING
    if (diff < -1) {
      return {
        transform: "translate3d(-120px, -40px, 0px) scale(0.88)",
        opacity: 0,
        zIndex: 5,
        pointerEvents: "none",
        transition: "transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease",
      };
    }

    // 2+ STEPS UPCOMING
    return {
      transform: "translate3d(120px, 40px, 0px) scale(0.88)",
      opacity: 0,
      zIndex: 5,
      pointerEvents: "none",
      transition: "transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease",
    };
  };

  return (
    <section
      id="developer-experience"
      className="relative w-full pt-16 pb-20 sm:pt-20 sm:pb-28 lg:pt-24 lg:pb-36 bg-[#111110] text-[#F0EEE9] overflow-hidden select-none"
      aria-labelledby="devex-heading"
    >
      <div className="layout-container w-full">
        {/* ===================================================================
            SECTION MARKER: 05 / DEVELOPER EXPERIENCE
            Understated divider line matching Jetway design language
            =================================================================== */}
        <div className="w-full border-t border-[#262422] pt-5 mb-12 sm:mb-16">
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#77736D] tracking-[0.1em] uppercase">
            <span className="text-[#E58A61] font-medium">05</span>
            <span>/</span>
            <span>DEVELOPER EXPERIENCE & OBSERVABILITY</span>
          </div>
        </div>

        {/* ===================================================================
            PART 1: SECTION INTRODUCTION (Heading & Supporting Copy)
            =================================================================== */}
        <div className="max-w-2xl mb-16 sm:mb-20 lg:mb-24">
          <h2
            id="devex-heading"
            className="font-sans text-[38px] sm:text-[48px] lg:text-[54px] font-medium leading-[1.08] tracking-[-0.03em] text-[#F0EEE9] mb-5"
          >
            Built for the way you work.
          </h2>
          <p className="font-sans text-[16px] sm:text-[17px] text-[#8E8A82] leading-[1.65]">
            Your tools should help you move forward, not slow you down. Keep
            your development workflow focused, your deployments understandable,
            and essential controls within reach.
          </p>
        </div>

        {/* ===================================================================
            PART 1: THE THREE PILLARS (Clean Editorial Typography Grid)
            Space Grotesk typography, warm off-white headings, muted neutral supporting text,
            small burnt-orange numbers, restrained separators.
            No cards. No backgrounds. No illustrations.
            =================================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#242220]">
          {PILLARS.map((pillar, index) => (
            <div
              key={pillar.number}
              className={`group flex flex-col justify-between py-8 md:py-2 cursor-default ${
                index === 0
                  ? "md:pr-8 lg:pr-12 md:pl-0"
                  : index === 1
                  ? "md:px-8 lg:px-12"
                  : "md:pl-8 lg:pl-12 md:pr-0"
              }`}
            >
              <div className="space-y-4 sm:space-y-5">
                {/* 1. Small, restrained numbered label */}
                <div className="font-mono text-[12px] sm:text-[13px] text-[#E58A61] font-medium tracking-[0.08em] transition-colors duration-200 group-hover:text-[#FFAA80]">
                  {pillar.number}
                </div>

                {/* 2. Prominent headline with subtle interactive underline */}
                <div className="relative inline-block">
                  <h3 className="font-sans text-[28px] sm:text-[32px] lg:text-[36px] xl:text-[38px] font-medium leading-[1.14] tracking-[-0.03em] text-[#F0EEE9] transition-colors duration-200 group-hover:text-white">
                    {pillar.headline}
                  </h3>
                  <span
                    className="block h-[1.5px] bg-[#E58A61] w-full origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100 mt-3"
                    aria-hidden="true"
                  />
                </div>

                {/* 3. Concise supporting sentence */}
                <p className="font-sans text-[15px] sm:text-[16px] text-[#8E8A82] leading-[1.6] max-w-[340px] pt-1 transition-colors duration-200 group-hover:text-[#A8A49C]">
                  {pillar.supportingText}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ===================================================================
            TRANSITION INTO PRODUCTION VISIBILITY
            Continuous editorial progression connecting developer philosophy
            to concrete production observability.
            =================================================================== */}
        <div id="production-visibility" className="pt-24 sm:pt-32 lg:pt-36">
          <div className="max-w-3xl mb-10 sm:mb-14">
            {/* Chapter Eyebrow */}
            <div className="flex items-center gap-2 mb-4 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-[#77736D]">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-[#E58A61]" aria-hidden="true" />
              <span>PRODUCTION CLARITY</span>
            </div>

            {/* Editorial Heading */}
            <h3 className="font-sans text-[36px] sm:text-[46px] lg:text-[52px] font-medium leading-[1.08] tracking-[-0.035em] text-[#F0EEE9] mb-5">
              Know what’s happening. Keep moving forward.
            </h3>

            {/* Supporting Copy */}
            <p className="font-sans text-[16px] sm:text-[17px] text-[#8E8A82] leading-[1.65] max-w-[620px]">
              Production shouldn’t feel like a black box. Understand application
              health, inspect recent deployment activity, and diagnose runtime
              events without leaving your workflow.
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================================
          PART 2: DIAGONAL LAYERED PRODUCTION-VIEW CAROUSEL
          - Desktop: Smooth scroll-linked diagonal progression in a comfortable track
          - Mobile / Reduced-Motion: Clean, accessible, touch-friendly tabbed views
          ===================================================================== */}
      {isReducedMotion ? (
        // ACCESSIBLE STATIC PRESENTATION FOR PREFERS-REDUCED-MOTION
        <div className="layout-container w-full mt-4">
          <div className="flex items-center gap-2 mb-6 border-b border-[#262422] pb-3">
            {(["Deployment activity", "Application health", "Runtime diagnostics"] as const).map(
              (label, i) => (
                <button
                  key={label}
                  onClick={() => setActiveIndex(i)}
                  className={`px-3 py-1.5 rounded-[6px] font-mono text-[12px] transition-colors ${
                    activeIndex === i
                      ? "bg-[#252320] text-[#F0EEE9] border border-[#3A3734]"
                      : "text-[#77736D] hover:text-[#B0B0AE]"
                  }`}
                >
                  <span className="text-[#E58A61] font-medium mr-1.5">0{i + 1}</span>
                  {label}
                </button>
              )
            )}
          </div>

          <div className="w-full rounded-[12px] bg-[#161514] border border-[#262422] overflow-hidden p-6">
            {activeIndex === 0 && <DeploymentActivityPanel />}
            {activeIndex === 1 && <ApplicationHealthPanel />}
            {activeIndex === 2 && <RuntimeDiagnosticsPanel filter={logFilter} onFilterChange={setLogFilter} logs={filteredLogs} />}
          </div>
        </div>
      ) : (
        // DYNAMIC RESPONSIVE IMPLEMENTATION
        <>
          {/* MOBILE VIEW (< 768px): Touch-friendly tabbed cards, 0 horizontal overflow */}
          <div className="block md:hidden layout-container w-full mt-4">
            {/* View Selector Tabs */}
            <div className="flex items-center justify-between gap-1 p-1 mb-6 rounded-[8px] bg-[#161514] border border-[#262422]">
              {(["Activity", "Health", "Diagnostics"] as const).map((label, i) => (
                <button
                  key={label}
                  onClick={() => setActiveIndex(i)}
                  className={`flex-1 py-1.5 px-2 rounded-[5px] font-mono text-[11px] text-center transition-all ${
                    activeIndex === i
                      ? "bg-[#252320] text-[#F0EEE9] border border-[#3A3734] font-medium shadow-sm"
                      : "text-[#77736D] hover:text-[#A8A49C]"
                  }`}
                >
                  <span className="text-[#E58A61] font-semibold mr-1">0{i + 1}</span>
                  {label}
                </button>
              ))}
            </div>

            {/* Active Panel Container */}
            <div className="w-full rounded-[12px] bg-[#161514] border border-[#262422] overflow-hidden">
              {activeIndex === 0 && <DeploymentActivityPanel />}
              {activeIndex === 1 && <ApplicationHealthPanel />}
              {activeIndex === 2 && (
                <RuntimeDiagnosticsPanel
                  filter={logFilter}
                  onFilterChange={setLogFilter}
                  logs={filteredLogs}
                />
              )}
            </div>

            {/* Illustrative Disclosure */}
            <div className="mt-4 flex items-center justify-between text-[11px] font-mono text-[#77736D] px-1">
              <span className="flex items-center gap-1.5">
                <span className="text-[#E58A61]">◆</span>
                <span>Illustrative production view</span>
              </span>
              <span>Sample telemetry</span>
            </div>
          </div>

          {/* DESKTOP & TABLET VIEW (>= 768px): Coordinated Diagonal Layered Carousel */}
          <div
            ref={trackRef}
            className="hidden md:block relative w-full"
            style={{ height: "210vh" }}
          >
            {/* Sticky Stage Container positioned naturally within the document scroll */}
            <div className="sticky top-20 lg:top-24 w-full flex flex-col items-center">
              <div className="layout-container w-full">
                {/* View Switcher Bar with Active Indicators */}
                <div className="flex items-center justify-between mb-6 pb-2">
                  <div className="flex items-center gap-2 p-1 rounded-[8px] bg-[#161514] border border-[#262422] shadow-sm">
                    {[
                      { index: 0, label: "Deployment activity" },
                      { index: 1, label: "Application health" },
                      { index: 2, label: "Runtime diagnostics" },
                    ].map((item) => (
                      <button
                        key={item.index}
                        onClick={() => handleSelectView(item.index)}
                        className={`px-3 py-1.5 rounded-[5px] font-mono text-[12px] flex items-center gap-2 transition-all duration-200 cursor-pointer ${
                          activeIndex === item.index
                            ? "bg-[#252320] text-[#F0EEE9] border border-[#3A3734] font-medium shadow"
                            : "text-[#77736D] hover:text-[#B0B0AE] border border-transparent"
                        }`}
                        aria-pressed={activeIndex === item.index}
                      >
                        <span
                          className={`text-[11px] font-semibold transition-colors ${
                            activeIndex === item.index ? "text-[#E58A61]" : "text-[#77736D]"
                          }`}
                        >
                          0{item.index + 1}
                        </span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Operational status marker */}
                  <div className="hidden lg:flex items-center gap-3 font-mono text-[11px] text-[#77736D]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#82B89D] animate-pulse" />
                      <span className="text-[#82B89D] font-medium">TELEMETRY SYNCHRONIZED</span>
                    </span>
                    <span>•</span>
                    <span>STAGE {activeIndex + 1} OF 3</span>
                  </div>
                </div>

                {/* Diagonal Layered Stage Wrapper */}
                <div className="relative w-full max-w-[960px] h-[490px] mx-auto">
                  {/* PANEL 0: Deployment Activity */}
                  <div
                    style={getPanelStyle(0)}
                    onClick={() => activeIndex !== 0 && handleSelectView(0)}
                    className={`absolute inset-0 rounded-[12px] bg-[#161514] border border-[#262422] shadow-2xl overflow-hidden transition-shadow duration-300 ${
                      activeIndex === 0
                        ? "shadow-[0_20px_50px_rgba(0,0,0,0.85)] border-[#363330]"
                        : "cursor-pointer hover:border-[#33312E]"
                    }`}
                  >
                    <DeploymentActivityPanel />
                  </div>

                  {/* PANEL 1: Application Health */}
                  <div
                    style={getPanelStyle(1)}
                    onClick={() => activeIndex !== 1 && handleSelectView(1)}
                    className={`absolute inset-0 rounded-[12px] bg-[#161514] border border-[#262422] shadow-2xl overflow-hidden transition-shadow duration-300 ${
                      activeIndex === 1
                        ? "shadow-[0_20px_50px_rgba(0,0,0,0.85)] border-[#363330]"
                        : "cursor-pointer hover:border-[#33312E]"
                    }`}
                  >
                    <ApplicationHealthPanel />
                  </div>

                  {/* PANEL 2: Runtime Diagnostics */}
                  <div
                    style={getPanelStyle(2)}
                    onClick={() => activeIndex !== 2 && handleSelectView(2)}
                    className={`absolute inset-0 rounded-[12px] bg-[#161514] border border-[#262422] shadow-2xl overflow-hidden transition-shadow duration-300 ${
                      activeIndex === 2
                        ? "shadow-[0_20px_50px_rgba(0,0,0,0.85)] border-[#363330]"
                        : "cursor-pointer hover:border-[#33312E]"
                    }`}
                  >
                    <RuntimeDiagnosticsPanel
                      filter={logFilter}
                      onFilterChange={setLogFilter}
                      logs={filteredLogs}
                    />
                  </div>
                </div>

                {/* Subtle Grounding Disclosure Strip */}
                <div className="max-w-[960px] mx-auto mt-6 pt-3 flex items-center justify-between text-[11px] font-mono text-[#77736D] border-t border-[#22201E]">
                  <div className="flex items-center gap-2">
                    <span className="text-[#E58A61]">◆</span>
                    <span>Illustrative production view</span>
                    <span>—</span>
                    <span>Demonstrates visibility concepts without live operational claims</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-[10.5px]">
                    <span>Scroll to explore stages</span>
                    <ArrowRight className="w-3 h-3 text-[#77736D]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// =============================================================================
// SUB-PANEL 1: DEPLOYMENT ACTIVITY VIEW
// Deployment history, build completion & release status, chronological activity list.
// =============================================================================
function DeploymentActivityPanel() {
  return (
    <div className="w-full h-full flex flex-col justify-between text-[#F0EEE9]">
      {/* Panel Header */}
      <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-[#1B1A18] border-b border-[#262422] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[6px] bg-[#242220] border border-[#302D2A] flex items-center justify-center text-[#E58A61] shrink-0">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 font-mono text-[13px]">
              <span className="font-semibold text-[#F0EEE9]">my-project</span>
              <span className="px-1.5 py-0.2 rounded-[3px] bg-[#252320] border border-[#302D2A] text-[10px] text-[#A8A49C]">
                Production
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-[#77736D] mt-0.5">
              <span>app.jetway.demo</span>
              <span>•</span>
              <span>Active release: v1.4.2</span>
            </div>
          </div>
        </div>

        {/* Release Status Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-[11px]">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-[5px] bg-[#82B89D]/10 border border-[#82B89D]/30 text-[#82B89D] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#82B89D] animate-pulse" />
            <span>CUTOVER 100% · ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Release Info (Left) + Chronological Timeline (Right) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#262422] overflow-y-auto">
        {/* Left Column: Release Attestation & Commit Details */}
        <div className="lg:col-span-5 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#77736D] pb-1">
            <GitCommit className="w-3.5 h-3.5 text-[#E58A61]" />
            <span>Active Release Context</span>
          </div>

          <div className="p-3.5 rounded-[8px] bg-[#191817] border border-[#262422] space-y-3 font-mono text-[11.5px]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#77736D]">Commit Hash</span>
              <span className="text-[#F0EEE9] font-medium">8f3a21c</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#77736D]">Branch</span>
              <span className="text-[#F0EEE9]">main</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#77736D]">Container Attestation</span>
              <span className="text-[#82B89D]">Hermetic · Signed</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#77736D]">Build Duration</span>
              <span className="text-[#F0EEE9]">42 seconds</span>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="font-mono text-[10.5px] uppercase tracking-wider text-[#77736D]">
              Rollout Verification
            </div>
            <p className="font-sans text-[12.5px] text-[#8E8A82] leading-[1.5]">
              Canary health verified at 10%, 50%, and 100% traffic milestones.
              Zero anomalous error rates observed during migration.
            </p>
          </div>
        </div>

        {/* Right Column: Chronological Event Stream */}
        <div className="lg:col-span-7 p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#22201E]">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#77736D]">
              <Activity className="w-3.5 h-3.5 text-[#E58A61]" />
              <span>Chronological Activity List</span>
            </div>
            <span className="font-mono text-[10.5px] text-[#77736D]">Live Timeline</span>
          </div>

          <div className="space-y-2 pt-1 font-mono">
            {TIMELINE_EVENTS.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 p-2.5 rounded-[6px] bg-[#191817] border border-[#22201E] hover:border-[#2C2926] transition-colors"
              >
                <div className="w-5 h-5 rounded-[4px] bg-[#242220] border border-[#302D2A] flex items-center justify-center shrink-0 mt-0.5">
                  {event.type === "release" ? (
                    <CheckCircle2 className="w-3 h-3 text-[#82B89D]" />
                  ) : event.type === "health" ? (
                    <Radio className="w-3 h-3 text-teal-400" />
                  ) : (
                    <Clock className="w-3 h-3 text-[#E58A61]" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-sans font-medium text-[#F0EEE9] truncate">
                      {event.title}
                    </span>
                    <span className="text-[10px] text-[#77736D] shrink-0">{event.time}</span>
                  </div>
                  <p className="text-[11px] text-[#8E8A82] mt-0.5 truncate">{event.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel Footer */}
      <div className="px-5 py-2.5 bg-[#141312] border-t border-[#262422] flex items-center justify-between font-mono text-[10.5px] text-[#77736D]">
        <span>Deploy ID: dep_8f3a21c9902 · SHA-256 Attested</span>
        <span className="hidden sm:inline">Hermetic container build · 0 rollback events</span>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-PANEL 2: APPLICATION HEALTH VIEW
// Application operational status, health-check info, synthetic probes, regional latencies.
// =============================================================================
function ApplicationHealthPanel() {
  return (
    <div className="w-full h-full flex flex-col justify-between text-[#F0EEE9]">
      {/* Panel Header */}
      <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-[#1B1A18] border-b border-[#262422] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[6px] bg-[#242220] border border-[#302D2A] flex items-center justify-center text-[#82B89D] shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 font-mono text-[13px]">
              <span className="font-semibold text-[#F0EEE9]">Global Health Matrix</span>
              <span className="px-1.5 py-0.2 rounded-[3px] bg-[#252320] border border-[#302D2A] text-[10px] text-[#A8A49C]">
                30-day Uptime: 99.98%
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-[#77736D] mt-0.5">
              <span>Automated health probes active across 4 edge clusters</span>
            </div>
          </div>
        </div>

        {/* Global Operational Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-[11px]">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-[5px] bg-[#82B89D]/10 border border-[#82B89D]/30 text-[#82B89D] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#82B89D] animate-pulse" />
            <span>OPERATIONAL (4/4 REGIONS)</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Subsystem Health (Left) + Synthetic Probes (Right) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#262422] overflow-y-auto">
        {/* Left Column: Subsystem Status */}
        <div className="lg:col-span-5 p-5 sm:p-6 space-y-3.5">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#77736D] pb-1">
            <Cpu className="w-3.5 h-3.5 text-[#E58A61]" />
            <span>Subsystem Health Probes</span>
          </div>

          <div className="space-y-2 font-mono text-[11.5px]">
            <div className="p-3 rounded-[6px] bg-[#191817] border border-[#22201E] flex items-center justify-between">
              <div>
                <div className="text-[#F0EEE9] font-medium">Global Edge CDN</div>
                <div className="text-[10px] text-[#77736D]">Anycast DNS routing</div>
              </div>
              <div className="text-right">
                <span className="text-[#82B89D] text-[11px]">11ms avg</span>
                <div className="text-[10px] text-[#77736D]">100% avail</div>
              </div>
            </div>

            <div className="p-3 rounded-[6px] bg-[#191817] border border-[#22201E] flex items-center justify-between">
              <div>
                <div className="text-[#F0EEE9] font-medium">API Gateway & Handlers</div>
                <div className="text-[10px] text-[#77736D]">HTTP routing pipeline</div>
              </div>
              <div className="text-right">
                <span className="text-[#82B89D] text-[11px]">16ms avg</span>
                <div className="text-[10px] text-[#77736D]">99.99% avail</div>
              </div>
            </div>

            <div className="p-3 rounded-[6px] bg-[#191817] border border-[#22201E] flex items-center justify-between">
              <div>
                <div className="text-[#F0EEE9] font-medium">Background Worker Queue</div>
                <div className="text-[10px] text-[#77736D]">0 tasks backlog</div>
              </div>
              <div className="text-right">
                <span className="text-[#82B89D] text-[11px]">12 active</span>
                <div className="text-[10px] text-[#77736D]">Healthy</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Regional Edge Probes & SSL Security */}
        <div className="lg:col-span-7 p-5 sm:p-6 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-[#22201E]">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#77736D]">
              <Globe className="w-3.5 h-3.5 text-[#E58A61]" />
              <span>Synthetic Regional Probes</span>
            </div>
            <span className="font-mono text-[10.5px] text-[#77736D]">Interval: 30s</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono">
            {EDGE_PROBES.map((probe) => (
              <div
                key={probe.code}
                className="p-3 rounded-[6px] bg-[#191817] border border-[#22201E] flex items-center justify-between"
              >
                <div>
                  <div className="text-[12px] font-semibold text-[#F0EEE9]">{probe.code}</div>
                  <div className="text-[10.5px] text-[#77736D] truncate">{probe.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11.5px] text-[#82B89D] font-medium">{probe.latency}</div>
                  <div className="text-[10px] text-[#77736D]">{probe.status}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-[6px] bg-[#191817] border border-[#22201E] flex items-center justify-between font-mono text-[11px]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#82B89D]" />
              <span className="text-[#F0EEE9]">TLS / SSL Certificate</span>
            </div>
            <span className="text-[#77736D]">Valid · Auto-renews in 84 days</span>
          </div>
        </div>
      </div>

      {/* Panel Footer */}
      <div className="px-5 py-2.5 bg-[#141312] border-t border-[#262422] flex items-center justify-between font-mono text-[10.5px] text-[#77736D]">
        <span>Continuous edge probe monitoring · 4 global regions verified</span>
        <span className="hidden sm:inline">Zero operational degradation reported</span>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-PANEL 3: RUNTIME DIAGNOSTICS VIEW
// Recent HTTP requests, response codes, response times, runtime events.
// =============================================================================
interface RuntimeDiagnosticsPanelProps {
  filter: "all" | "http" | "sys";
  onFilterChange: (f: "all" | "http" | "sys") => void;
  logs: DiagnosticEntry[];
}

function RuntimeDiagnosticsPanel({
  filter,
  onFilterChange,
  logs,
}: RuntimeDiagnosticsPanelProps) {
  return (
    <div className="w-full h-full flex flex-col justify-between text-[#F0EEE9]">
      {/* Panel Header */}
      <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-[#1B1A18] border-b border-[#262422] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[6px] bg-[#242220] border border-[#302D2A] flex items-center justify-center text-[#E58A61] shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 font-mono text-[13px]">
              <span className="font-semibold text-[#F0EEE9]">Runtime Diagnostics</span>
              <span className="px-1.5 py-0.2 rounded-[3px] bg-[#252320] border border-[#302D2A] text-[10px] text-[#A8A49C]">
                Live Stream
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-[#77736D] mt-0.5">
              <span>Structured request telemetry & worker events</span>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-1 font-mono text-[11px] self-start sm:self-auto bg-[#191817] p-1 rounded-[5px] border border-[#262422]">
          {(["all", "http", "sys"] as const).map((category) => (
            <button
              key={category}
              onClick={() => onFilterChange(category)}
              className={`px-2 py-0.5 rounded-[3px] uppercase text-[10px] font-medium transition-colors ${
                filter === category
                  ? "bg-[#282623] text-[#E58A61] border border-[#383531]"
                  : "text-[#77736D] hover:text-[#B0B0AE]"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Main Diagnostic Stream */}
      <div className="flex-1 p-5 sm:p-6 overflow-y-auto space-y-2 font-mono">
        {logs.map((log) => (
          <div
            key={log.id}
            className="p-2.5 rounded-[6px] bg-[#191817] border border-[#22201E] hover:border-[#2C2926] flex items-center justify-between gap-3 text-[11.5px] transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-[#77736D] text-[10px] shrink-0">{log.time}</span>
              <span
                className={`text-[9.5px] px-1.5 py-0.5 rounded font-semibold tracking-wider shrink-0 ${
                  log.method === "GET"
                    ? "bg-teal-500/15 text-teal-300"
                    : log.method === "POST"
                    ? "bg-[#E58A61]/15 text-[#E58A61]"
                    : "bg-[#252320] text-[#A8A49C]"
                }`}
              >
                {log.method}
              </span>
              <span className="text-[#F0EEE9] truncate">{log.path}</span>
            </div>

            <div className="flex items-center gap-3 shrink-0 text-[11px]">
              <span className="text-[#77736D] hidden sm:inline">{log.region}</span>
              <span className="text-[#82B89D] font-medium">{log.status}</span>
              <span className="text-[#77736D]">{log.latency}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Panel Footer: Telemetry Metrics */}
      <div className="px-5 py-2.5 bg-[#141312] border-t border-[#262422] flex items-center justify-between font-mono text-[10.5px] text-[#77736D]">
        <div className="flex items-center gap-3">
          <span>P50: 12ms</span>
          <span>•</span>
          <span>P95: 24ms</span>
          <span>•</span>
          <span>Errors: 0.00%</span>
        </div>
        <span className="hidden sm:inline">Direct runtime inspection · Probes active</span>
      </div>
    </div>
  );
}

export default DeveloperExperience;
