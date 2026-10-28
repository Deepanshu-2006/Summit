"use client";

import React from "react";
import Link from "next/link";
import { Check, ExternalLink, Terminal, GitBranch, ShieldCheck } from "lucide-react";

interface WorkflowStep {
  id: string;
  label: string;
  detail: string;
  duration: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "connect",
    label: "Repository connected",
    detail: "github.com/jetway/app @ main",
    duration: "120ms",
  },
  {
    id: "install",
    label: "Dependencies installed",
    detail: "142 packages via pnpm-lock",
    duration: "380ms",
  },
  {
    id: "compile",
    label: "Application compiled",
    detail: "4 static, 1 edge route generated",
    duration: "410ms",
  },
  {
    id: "artifacts",
    label: "Build artifacts prepared",
    detail: "manifest dist/12.4 MB ready",
    duration: "190ms",
  },
  {
    id: "deploy",
    label: "Deployment completed",
    detail: "atomic cutover in 35 regions",
    duration: "84ms",
  },
];

/**
 * DeploymentExperience: Section 02 — Deployment Pipeline
 * Stable, static presentation in normal document flow.
 */
export function DeploymentExperience() {
  return (
    <section
      id="deployment-experience"
      className="relative w-full pt-12 pb-20 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28 bg-bg-main text-text-primary overflow-hidden"
      aria-labelledby="deployment-heading"
    >
      <div className="layout-container w-full">
        
        {/* =================================================================
            SECTION MARKER: 02 — DEPLOYMENT PIPELINE
            ================================================================= */}
        <div className="w-full flex items-center justify-between border-t border-border-subtle/70 pt-5 mb-10 sm:mb-14">
          <div className="flex items-center gap-3 font-mono text-[11px] text-text-muted tracking-wider">
            <span className="text-accent-orange font-medium">02</span>
            <div className="w-8 h-[1px] bg-accent-orange" aria-hidden="true" />
            <span>DEPLOYMENT PIPELINE</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 font-mono text-[10.5px] text-text-muted">
            <span>ZERO CONFIGURATION</span>
            <span className="text-border-default">•</span>
            <span>GLOBAL EDGE RUNWAY</span>
          </div>
        </div>

        {/* =================================================================
            TWO-COLUMN SECTION LAYOUT: Editorial (5 cols) + Terminal (7 cols)
            Normal document flow with stable positioning
            ================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          
          {/* -------------------------------------------------------------
              LEFT COLUMN: Editorial Heading, Copy, Architectural Highlights
              ------------------------------------------------------------- */}
          <div className="lg:col-span-5 flex flex-col justify-start">
            
            {/* Technical Eyebrow */}
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-accent-orange" aria-hidden="true" />
              <span className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-muted">
                FROM COMMIT TO PRODUCTION
              </span>
            </div>

            {/* Section Heading */}
            <h2
              id="deployment-heading"
              className="font-sans text-[34px] sm:text-[42px] lg:text-[48px] font-medium leading-[1.08] tracking-[-0.03em] text-[#F1F0EC] mb-5"
            >
              Ship without the ceremony.
            </h2>

            {/* Supporting Copy */}
            <p className="font-sans text-[15.5px] sm:text-[16px] text-text-secondary leading-[1.6] max-w-[460px] mb-8">
              Connect your code, build your application, and bring it online through a deployment workflow designed to stay out of your way.
            </p>

            {/* Architectural Highlights */}
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
                <div className="w-6 h-6 rounded-[5px] bg-[#191C1F] border border-accent-orange/40 flex items-center justify-center shrink-0 mt-0.5">
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

          </div>

          {/* -------------------------------------------------------------
              RIGHT COLUMN: Deployment Demonstration Interface (Terminal Panel)
              Standard static dimensions, unclipped and properly aligned
              ------------------------------------------------------------- */}
          <div className="lg:col-span-7 w-full relative">
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

                {/* Right: Branch label & Deployment State badge */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 font-mono text-[11px]">
                  
                  {/* Branch label */}
                  <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#202427] border border-border-subtle text-text-secondary text-[10.5px]">
                    <GitBranch className="w-3 h-3 text-text-muted" />
                    <span>main</span>
                  </div>

                  {/* Deployment State Badge */}
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border border-semantic-success/30 bg-semantic-success/15 text-semantic-success text-[10.5px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-semantic-success animate-pulse" />
                    <span>LIVE</span>
                  </div>

                </div>

              </div>

              {/* Progress Bar Line */}
              <div className="w-full h-[2px] bg-[#202427] overflow-hidden" role="progressbar" aria-label="Deployment status complete">
                <div className="h-full w-full bg-semantic-success" />
              </div>

              {/* Terminal Console Stream */}
              <div className="p-4 sm:p-5 font-mono text-[12px] sm:text-[12.5px] leading-relaxed space-y-3 bg-[#121416]/95 min-h-[300px]">
                
                {/* Prompt & Command */}
                <div className="flex items-center gap-2 text-[#F1F0EC]">
                  <span className="text-accent-orange font-semibold select-none">$</span>
                  <span className="font-medium">git push origin main</span>
                </div>

                {/* Remote git sync metadata */}
                <div className="text-[11px] text-text-muted pl-3.5 border-l border-border-subtle/60 py-0.5 space-y-0.5">
                  <div>[remote] commit 8f3a21c received (2.4 KB)</div>
                  <div>[remote] ephemeral edge builder container initialized (iad1)</div>
                </div>

                {/* Pipeline Step Events */}
                <div className="space-y-2 pt-2 border-t border-border-subtle/40">
                  {WORKFLOW_STEPS.map((step) => (
                    <div
                      key={step.id}
                      className="flex items-start sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <span className="w-4 h-4 flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 text-semantic-success" />
                        </span>

                        <span className="text-[12px] sm:text-[12.5px] truncate text-[#F1F0EC] font-medium">
                          {step.label}
                        </span>
                      </div>

                      {/* Technical metadata / duration */}
                      <div className="flex items-center gap-2 shrink-0 text-[10.5px] sm:text-[11px] text-text-muted">
                        <span className="hidden md:inline">{step.detail}</span>
                        <span className="text-semantic-success font-medium">
                          {step.duration}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Production Preview Card */}
                <div className="mt-4 pt-3.5 border-t border-border-subtle/60">
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
          </div>

        </div>

      </div>
    </section>
  );
}

export default DeploymentExperience;
