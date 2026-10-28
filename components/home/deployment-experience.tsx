"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, ExternalLink, RefreshCw, Terminal, GitBranch, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";

// React 19 SSR-safe subscriber for prefers-reduced-motion
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

interface WorkflowStep {
  id: string;
  label: string;
  activeLabel: string;
  detail: string;
  duration: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "connect",
    label: "Repository connected",
    activeLabel: "Connecting repository...",
    detail: "github.com/jetway/app @ main",
    duration: "120ms",
  },
  {
    id: "install",
    label: "Dependencies installed",
    activeLabel: "Resolving lockfile dependencies...",
    detail: "142 packages via pnpm-lock",
    duration: "380ms",
  },
  {
    id: "compile",
    label: "Application compiled",
    activeLabel: "Compiling bundle with Turbopack...",
    detail: "4 static, 1 edge route generated",
    duration: "410ms",
  },
  {
    id: "artifacts",
    label: "Build artifacts prepared",
    activeLabel: "Packaging isolated container...",
    detail: "manifest dist/12.4 MB ready",
    duration: "190ms",
  },
  {
    id: "deploy",
    label: "Deployment completed",
    activeLabel: "Propagating routes to edge mesh...",
    detail: "atomic cutover in 35 regions",
    duration: "84ms",
  },
];

export function DeploymentExperience() {
  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const sectionRef = useRef<HTMLElement>(null);
  const [hasTriggered, setHasTriggered] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isCommandVisible, setIsCommandVisible] = useState<boolean>(false);
  const [isPushMetaVisible, setIsPushMetaVisible] = useState<boolean>(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState<boolean>(false);
  const [isReplaying, setIsReplaying] = useState(false);

  // Scroll trigger detection with IntersectionObserver
  useEffect(() => {
    if (isReducedMotion || hasTriggered) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasTriggered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [isReducedMotion, hasTriggered]);

  // Deployment sequence orchestration (approx 3.8s total duration)
  useEffect(() => {
    if (isReducedMotion || (!hasTriggered && !isReplaying)) {
      return;
    }

    const timeouts: NodeJS.Timeout[] = [];

    // T=0.3s: $ git push origin main appears
    timeouts.push(
      setTimeout(() => {
        setIsCommandVisible(true);
      }, 300)
    );

    // T=0.6s: Remote push metadata log appears
    timeouts.push(
      setTimeout(() => {
        setIsPushMetaVisible(true);
      }, 650)
    );

    // T=1.1s: Step 1 (Repository connected)
    timeouts.push(
      setTimeout(() => {
        setCurrentStep(1);
      }, 1100)
    );

    // T=1.8s: Step 2 (Dependencies installed)
    timeouts.push(
      setTimeout(() => {
        setCurrentStep(2);
      }, 1800)
    );

    // T=2.5s: Step 3 (Application compiled)
    timeouts.push(
      setTimeout(() => {
        setCurrentStep(3);
      }, 2500)
    );

    // T=3.2s: Step 4 (Build artifacts prepared)
    timeouts.push(
      setTimeout(() => {
        setCurrentStep(4);
      }, 3200)
    );

    // T=3.8s: Step 5 (Deployment completed)
    timeouts.push(
      setTimeout(() => {
        setCurrentStep(5);
      }, 3800)
    );

    // T=4.1s: Live Production Preview appears
    timeouts.push(
      setTimeout(() => {
        setIsPreviewVisible(true);
        setIsReplaying(false);
      }, 4100)
    );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [hasTriggered, isReplaying, isReducedMotion]);

  // Manual replay button handler
  const handleReplay = () => {
    setCurrentStep(0);
    setIsCommandVisible(false);
    setIsPushMetaVisible(false);
    setIsPreviewVisible(false);
    setIsReplaying(true);
  };

  const isEffectiveComplete = isReducedMotion || currentStep >= 5;
  const effectiveStep = isReducedMotion ? 5 : currentStep;
  const isEffectiveCommandVisible = isReducedMotion || isCommandVisible;
  const isEffectivePushMetaVisible = isReducedMotion || isPushMetaVisible;
  const isEffectivePreviewVisible = isReducedMotion || isPreviewVisible;

  const progressPercent = isEffectiveComplete
    ? 100
    : effectiveStep === 4
    ? 85
    : effectiveStep === 3
    ? 65
    : effectiveStep === 2
    ? 45
    : effectiveStep === 1
    ? 25
    : isEffectiveCommandVisible
    ? 10
    : 0;

  return (
    <section
      ref={sectionRef}
      id="deployment-experience"
      className="relative w-full py-16 sm:py-20 lg:py-24 bg-bg-main text-text-primary overflow-hidden"
      aria-labelledby="deployment-heading"
    >
      <div className="layout-container w-full">
        
        {/* =================================================================
            SECTION TRANSITION: Visual continuity connector from hero
            ================================================================= */}
        <Reveal delay={0} duration={0.5} yOffset={10}>
          <div className="w-full flex items-center justify-between border-t border-border-subtle/70 pt-6 mb-12 sm:mb-16">
            <div className="flex items-center gap-3 font-mono text-[11px] text-text-muted tracking-wider">
              <span className="text-accent-orange font-medium">02</span>
              <span className="w-8 h-[1px] bg-border-subtle" aria-hidden="true" />
              <span>DEPLOYMENT PIPELINE</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 font-mono text-[10.5px] text-text-muted">
              <span>ZERO CONFIGURATION</span>
              <span className="text-border-default">•</span>
              <span>GLOBAL EDGE RUNWAY</span>
            </div>
          </div>
        </Reveal>

        {/* =================================================================
            ASYMMETRICAL SECTION LAYOUT: Text Column (5 cols) + Panel (7 cols)
            ================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          
          {/* -------------------------------------------------------------
              LEFT COLUMN: Editorial Heading, Copy, Architectural Notes
              ------------------------------------------------------------- */}
          <div className="lg:col-span-5 flex flex-col justify-start">
            
            {/* Technical Eyebrow */}
            <Reveal delay={0.08} duration={0.55}>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 rounded-[1px] bg-accent-orange" aria-hidden="true" />
                <span className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-muted">
                  FROM COMMIT TO PRODUCTION
                </span>
              </div>
            </Reveal>

            {/* Section Heading */}
            <Reveal delay={0.16} duration={0.6}>
              <h2
                id="deployment-heading"
                className="font-sans text-[34px] sm:text-[42px] lg:text-[48px] font-medium leading-[1.08] tracking-[-0.03em] text-[#F1F0EC] mb-5"
              >
                Ship without the ceremony.
              </h2>
            </Reveal>

            {/* Supporting Copy */}
            <Reveal delay={0.24} duration={0.6}>
              <p className="font-sans text-[15.5px] sm:text-[16px] text-text-secondary leading-[1.6] max-w-[460px] mb-8">
                Connect your code, build your application, and bring it online through a deployment workflow designed to stay out of your way.
              </p>
            </Reveal>

            {/* Architecture Highlights */}
            <Reveal delay={0.32} duration={0.65}>
              <div className="space-y-4 pt-6 border-t border-border-subtle/80 max-w-[460px]">
                
                {/* Feature 1 */}
                <div className="flex items-start gap-3.5">
                  <div className="w-6 h-6 rounded-[5px] bg-[#191C1F] border border-border-subtle flex items-center justify-center shrink-0 mt-0.5">
                    <span className="font-mono text-[10px] text-accent-orange font-medium">01</span>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#F1F0EC] font-sans">
                      Zero-friction connection
                    </h3>
                    <p className="text-[12.5px] text-text-muted leading-relaxed mt-0.5">
                      Automatic Git push detection on any provider. No YAML bureaucracy or complex pipelines.
                    </p>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="flex items-start gap-3.5">
                  <div className="w-6 h-6 rounded-[5px] bg-[#191C1F] border border-border-subtle flex items-center justify-center shrink-0 mt-0.5">
                    <span className="font-mono text-[10px] text-accent-orange font-medium">02</span>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#F1F0EC] font-sans">
                      Hermetic edge builds
                    </h3>
                    <p className="text-[12.5px] text-text-muted leading-relaxed mt-0.5">
                      Turbopack caching and isolated sandboxes compile bundles in fractions of a second.
                    </p>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="flex items-start gap-3.5">
                  <div className="w-6 h-6 rounded-[5px] bg-[#191C1F] border border-border-subtle flex items-center justify-center shrink-0 mt-0.5">
                    <span className="font-mono text-[10px] text-accent-orange font-medium">03</span>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#F1F0EC] font-sans">
                      Atomic global cutover
                    </h3>
                    <p className="text-[12.5px] text-text-muted leading-relaxed mt-0.5">
                      Instant zero-downtime traffic switching across 35+ edge regions with single-click rollbacks.
                    </p>
                  </div>
                </div>

              </div>
            </Reveal>

          </div>

          {/* -------------------------------------------------------------
              RIGHT COLUMN: Deployment Demonstration Interface (Terminal Panel)
              ------------------------------------------------------------- */}
          <div className="lg:col-span-7 w-full">
            <Reveal delay={0.28} duration={0.65} yOffset={24}>
              <div className="w-full rounded-[10px] bg-[#191C1F] border border-border-default shadow-2xl shadow-black/60 overflow-hidden">
                
                {/* Panel Header */}
                <div className="px-4 py-3 bg-[#16181B] border-b border-border-subtle flex items-center justify-between gap-3">
                  
                  {/* Left: Service identifier & indicator */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#292E31]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#292E31]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#292E31]" />
                    </div>
                    
                    <div className="h-3 w-[1px] bg-border-subtle mx-1 hidden sm:block" />

                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-text-secondary truncate">
                      <Terminal className="w-3.5 h-3.5 text-accent-orange shrink-0" />
                      <span className="text-[#F1F0EC] font-medium truncate">jetway-app</span>
                      <span className="text-text-muted hidden sm:inline">/ service</span>
                    </div>
                  </div>

                  {/* Right: Branch label, State badge, Replay action */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0 font-mono text-[11px]">
                    
                    {/* Branch label */}
                    <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#202427] border border-border-subtle text-text-secondary text-[10.5px]">
                      <GitBranch className="w-3 h-3 text-text-muted" />
                      <span>main</span>
                    </div>

                    {/* Deployment State Badge */}
                    <div
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border text-[10.5px] font-medium transition-colors duration-200 ${
                        isEffectiveComplete
                          ? "bg-semantic-success/15 border-semantic-success/30 text-semantic-success"
                          : effectiveStep > 0
                          ? "bg-accent-orange/15 border-accent-orange/30 text-accent-orange"
                          : "bg-[#202427] border-border-subtle text-text-muted"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isEffectiveComplete
                            ? "bg-semantic-success"
                            : effectiveStep > 0
                            ? "bg-accent-orange animate-pulse"
                            : "bg-text-muted"
                        }`}
                      />
                      <span>{isEffectiveComplete ? "LIVE" : effectiveStep > 0 ? "BUILDING" : "QUEUED"}</span>
                    </div>

                    {/* Replay action */}
                    <button
                      type="button"
                      onClick={handleReplay}
                      title="Replay deployment sequence"
                      className="p-1 rounded-[4px] text-text-muted hover:text-accent-orange hover:bg-[#202427] transition-colors focus-visible:outline-accent-orange"
                      aria-label="Replay deployment simulation"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isReplaying ? "animate-spin" : ""}`} />
                    </button>

                  </div>

                </div>

                {/* Smooth Progress Bar */}
                <div className="w-full h-[2px] bg-[#202427] overflow-hidden" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
                  <div
                    className={`h-full transition-all duration-400 ease-out ${
                      isEffectiveComplete ? "bg-semantic-success" : "bg-accent-orange"
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Terminal Console Stream */}
                <div className="p-4 sm:p-5 font-mono text-[12px] sm:text-[12.5px] leading-relaxed space-y-3 bg-[#121416]/95 min-h-[300px]">
                  
                  {/* Prompt & Command */}
                  {isEffectiveCommandVisible ? (
                    <div className="flex items-center gap-2 text-[#F1F0EC] transition-opacity duration-200">
                      <span className="text-accent-orange font-semibold select-none">$</span>
                      <span className="font-medium">git push origin main</span>
                    </div>
                  ) : (
                    <div className="h-5 flex items-center text-text-muted/40">
                      <span className="animate-pulse">_</span>
                    </div>
                  )}

                  {/* Remote git sync metadata */}
                  {isEffectivePushMetaVisible && (
                    <div className="text-[11px] text-text-muted pl-3.5 border-l border-border-subtle/60 py-0.5 space-y-0.5 transition-opacity duration-200">
                      <div>[remote] commit 8f3a21c received (2.4 KB)</div>
                      <div>[remote] ephemeral edge builder container initialized (iad1)</div>
                    </div>
                  )}

                  {/* Progressive Pipeline Step Events */}
                  <div className="space-y-2 pt-2 border-t border-border-subtle/40">
                    {WORKFLOW_STEPS.map((step, idx) => {
                      const stepNumber = idx + 1;
                      const isStepFinished = effectiveStep >= stepNumber;
                      const isStepActive = effectiveStep === stepNumber - 1 && isEffectivePushMetaVisible;
                      const isStepPending = effectiveStep < stepNumber - 1;

                      if (!isEffectiveCommandVisible) return null;

                      return (
                        <div
                          key={step.id}
                          className={`flex items-start sm:items-center justify-between gap-2 transition-all duration-200 ${
                            isStepPending ? "opacity-30" : "opacity-100"
                          }`}
                        >
                          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                            {/* Status Icon */}
                            <span className="w-4 h-4 flex items-center justify-center shrink-0">
                              {isStepFinished ? (
                                <Check className="w-3.5 h-3.5 text-semantic-success" />
                              ) : isStepActive ? (
                                <span className="text-accent-orange font-bold text-[13px] animate-pulse">→</span>
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-text-muted/40" />
                              )}
                            </span>

                            {/* Label */}
                            <span
                              className={`text-[12px] sm:text-[12.5px] truncate ${
                                isStepFinished
                                  ? "text-[#F1F0EC] font-medium"
                                  : isStepActive
                                  ? "text-accent-orange font-medium"
                                  : "text-text-muted"
                              }`}
                            >
                              {isStepActive ? step.activeLabel : step.label}
                            </span>
                          </div>

                          {/* Technical metadata / duration */}
                          <div className="flex items-center gap-2 shrink-0 text-[10.5px] sm:text-[11px] text-text-muted">
                            <span className="hidden md:inline">{step.detail}</span>
                            {isStepFinished && (
                              <span className="text-semantic-success font-medium">
                                {step.duration}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Production Preview Card */}
                  {isEffectivePreviewVisible && (
                    <div className="mt-4 pt-3.5 border-t border-border-subtle/60 transition-all duration-300">
                      <div className="rounded-[7px] bg-[#191C1F] border border-semantic-success/35 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-black/40">
                        
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-text-muted font-medium">
                            <ShieldCheck className="w-3 h-3 text-semantic-success" />
                            <span>PRODUCTION PREVIEW // SSL ACTIVE</span>
                          </div>
                          
                          <Link
                            href="https://app.jetway.demo"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[13px] sm:text-[13.5px] font-mono font-medium text-text-primary hover:text-accent-orange transition-colors"
                          >
                            <span>app.jetway.demo</span>
                            <ExternalLink className="w-3 h-3 text-text-muted" />
                          </Link>
                        </div>

                        {/* Edge Latency and Status Badge */}
                        <div className="flex items-center gap-2 self-start sm:self-center font-mono text-[10.5px]">
                          <span className="px-2 py-0.5 rounded-[4px] bg-[#202427] border border-border-subtle text-text-secondary">
                            14ms edge
                          </span>
                          <span className="px-2 py-0.5 rounded-[4px] bg-semantic-success/15 border border-semantic-success/30 text-semantic-success font-medium">
                            200 OK
                          </span>
                        </div>

                      </div>
                    </div>
                  )}

                </div>

                {/* Terminal Footer Annotation */}
                <div className="px-4 py-2 bg-[#16181B] border-t border-border-subtle/80 flex items-center justify-between text-[10.5px] font-mono text-text-muted">
                  <div className="flex items-center gap-1.5">
                    <span className="text-accent-orange">◆</span>
                    <span>edge-cluster: iad1-node-04</span>
                  </div>
                  <span className="hidden sm:inline">turbopack engine v2.4</span>
                </div>

              </div>
            </Reveal>
          </div>

        </div>

      </div>
    </section>
  );
}

export default DeploymentExperience;
