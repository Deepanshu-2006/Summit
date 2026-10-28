"use client";

import React from "react";
import {
  GitBranch,
  FolderGit2,
  CheckCircle2,
  Settings2,
  Rocket,
  ExternalLink,
  Info,
} from "lucide-react";

/**
 * GettingStarted: Section 07 — Getting Started
 * "From first commit to first deploy."
 * Three-step journey:
 * 1. Connect your code (Repository selection & connection)
 * 2. Configure your application (Runtime & essential build commands)
 * 3. Deploy your application (Verification & live production cutover)
 * 100% normal document flow — stable, spacious, and responsive.
 */
export function GettingStarted() {
  return (
    <section
      id="getting-started"
      className="relative w-full pt-12 pb-20 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-32 bg-bg-main text-text-primary overflow-hidden"
      aria-labelledby="getting-started-heading"
    >
      <div className="layout-container w-full">
        {/* =================================================================
            SECTION MARKER: 07 — GETTING STARTED
            ================================================================= */}
        <div className="w-full flex items-center justify-between border-t border-border-subtle/70 pt-5 mb-10 sm:mb-14">
          <div className="flex items-center gap-3 font-mono text-[11px] text-text-muted tracking-wider">
            <span className="text-accent-orange font-medium">07</span>
            <div className="w-8 h-[1px] bg-accent-orange" aria-hidden="true" />
            <span>GETTING STARTED</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 font-mono text-[10.5px] text-text-muted">
            <span>ONBOARDING WORKFLOW</span>
            <span className="text-border-default">•</span>
            <span>FIRST DEPLOYMENT</span>
          </div>
        </div>

        {/* =================================================================
            EDITORIAL INTRO: Eyebrow, Headline, Supporting Copy
            ================================================================= */}
        <div className="max-w-3xl mb-12 sm:mb-16">
          {/* Technical Eyebrow */}
          <div className="flex items-center gap-2 mb-4">
            <span
              className="w-1.5 h-1.5 rounded-[1px] bg-accent-orange"
              aria-hidden="true"
            />
            <span className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-muted">
              THREE STEPS. ONE STARTING POINT.
            </span>
          </div>

          {/* Section Headline */}
          <h2
            id="getting-started-heading"
            className="font-sans text-[36px] sm:text-[46px] lg:text-[54px] font-medium leading-[1.06] tracking-[-0.035em] text-[#F5F5F3] mb-5"
          >
            From first commit to first deploy.
          </h2>

          {/* Supporting Copy */}
          <p className="font-sans text-[16px] sm:text-[17px] text-text-secondary leading-[1.6] max-w-[620px]">
            Your next deployment doesn’t need a complicated setup. Start with
            your code, configure your application, and get ready to ship.
          </p>
        </div>

        {/* =================================================================
            THREE-STEP JOURNEY: Horizontal Sequence on Desktop / Stacked on Mobile
            ================================================================= */}
        <div className="relative">
          
          {/* Connecting Track Line across cards on desktop */}
          <div
            className="hidden md:block absolute top-[28px] left-[15%] right-[15%] h-[1px] bg-border-subtle z-0"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 relative z-10">
            
            {/* -------------------------------------------------------------
                STEP 01: Connect your code
                ------------------------------------------------------------- */}
            <div className="rounded-[12px] bg-[#171717] border border-border-default p-6 sm:p-7 flex flex-col justify-between shadow-xl">
              
              {/* Step Header */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-[6px] bg-[#1D1D1D] border border-accent-orange/40 flex items-center justify-center font-mono text-[12px] font-semibold text-accent-orange shadow-sm">
                    01
                  </div>
                  <span className="font-mono text-[10.5px] text-text-muted uppercase">
                    Connect your code
                  </span>
                </div>

                <h3 className="font-sans text-[20px] font-medium text-[#F5F5F3] tracking-tight">
                  Start with your repository.
                </h3>

                <p className="font-sans text-[13.5px] text-text-secondary leading-relaxed">
                  Bring your application code into your deployment workflow.
                </p>
              </div>

              {/* Visual Preview: Repository Selector */}
              <div className="rounded-[9px] bg-[#1D1D1D] border border-border-default p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-text-muted pb-2 border-b border-border-subtle/70">
                  <span>Import Source</span>
                  <span className="text-semantic-success flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Connected</span>
                  </span>
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-[6px] bg-[#111111] border border-border-subtle">
                  <FolderGit2 className="w-4 h-4 text-accent-orange shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[12px] font-medium text-[#F5F5F3] truncate">
                      acme/web-app
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted mt-0.5">
                      <GitBranch className="w-3 h-3 text-text-muted" />
                      <span>main branch</span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-text-muted flex items-center justify-between pt-1">
                  <span>Latest commit: 8f3a21c</span>
                  <span className="text-[#F5F5F3]">Ready</span>
                </div>
              </div>

            </div>

            {/* -------------------------------------------------------------
                STEP 02: Configure your application
                ------------------------------------------------------------- */}
            <div className="rounded-[12px] bg-[#171717] border border-border-default p-6 sm:p-7 flex flex-col justify-between shadow-xl">
              
              {/* Step Header */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-[6px] bg-[#1D1D1D] border border-accent-orange/40 flex items-center justify-center font-mono text-[12px] font-semibold text-accent-orange shadow-sm">
                    02
                  </div>
                  <span className="font-mono text-[10.5px] text-text-muted uppercase">
                    Configure your app
                  </span>
                </div>

                <h3 className="font-sans text-[20px] font-medium text-[#F5F5F3] tracking-tight">
                  Set up the essentials.
                </h3>

                <p className="font-sans text-[13.5px] text-text-secondary leading-relaxed">
                  Define the configuration your application needs to run.
                </p>
              </div>

              {/* Visual Preview: Configuration Fields */}
              <div className="rounded-[9px] bg-[#1D1D1D] border border-border-default p-4 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-text-muted pb-2 border-b border-border-subtle/70">
                  <div className="flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5 text-accent-orange" />
                    <span className="text-[#F5F5F3] font-medium">Build Settings</span>
                  </div>
                  <span>Defaults</span>
                </div>

                {/* Key-Value Config Entries */}
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between p-1.5 rounded bg-[#111111] border border-border-subtle/70">
                    <span className="text-text-muted">Runtime</span>
                    <span className="text-[#F5F5F3] font-medium">Next.js / Node 20</span>
                  </div>

                  <div className="flex items-center justify-between p-1.5 rounded bg-[#111111] border border-border-subtle/70">
                    <span className="text-text-muted">Build Command</span>
                    <span className="text-accent-orange">npm run build</span>
                  </div>

                  <div className="flex items-center justify-between p-1.5 rounded bg-[#111111] border border-border-subtle/70">
                    <span className="text-text-muted">Start Command</span>
                    <span className="text-[#F5F5F3]">npm run start</span>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-text-muted flex items-center justify-between pt-1">
                  <span>Port: 3000 (HTTPS)</span>
                  <span className="text-semantic-success">Config Valid</span>
                </div>
              </div>

            </div>

            {/* -------------------------------------------------------------
                STEP 03: Deploy your application
                ------------------------------------------------------------- */}
            <div className="rounded-[12px] bg-[#171717] border border-border-default p-6 sm:p-7 flex flex-col justify-between shadow-xl">
              
              {/* Step Header */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-[6px] bg-[#1D1D1D] border border-accent-orange/40 flex items-center justify-center font-mono text-[12px] font-semibold text-accent-orange shadow-sm">
                    03
                  </div>
                  <span className="font-mono text-[10.5px] text-text-muted uppercase">
                    Deploy your app
                  </span>
                </div>

                <h3 className="font-sans text-[20px] font-medium text-[#F5F5F3] tracking-tight">
                  Get ready to go live.
                </h3>

                <p className="font-sans text-[13.5px] text-text-secondary leading-relaxed">
                  Review the deployment and move your application toward production.
                </p>
              </div>

              {/* Visual Preview: Deployment Cutover & Domain */}
              <div className="rounded-[9px] bg-[#1D1D1D] border border-border-default p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-text-muted pb-2 border-b border-border-subtle/70">
                  <div className="flex items-center gap-1.5">
                    <Rocket className="w-3.5 h-3.5 text-accent-orange" />
                    <span className="text-[#F5F5F3] font-medium">Cutover Ready</span>
                  </div>
                  <span className="text-semantic-success font-medium">LIVE</span>
                </div>

                <div className="p-2.5 rounded-[6px] bg-[#111111] border border-border-subtle space-y-1">
                  <div className="flex items-center justify-between text-[10.5px] font-mono">
                    <span className="text-text-muted">Target Domain</span>
                    <span className="text-semantic-success flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                      <span>200 OK</span>
                    </span>
                  </div>
                  <div className="font-mono text-[12px] font-medium text-[#F5F5F3] truncate">
                    web-app.jetway.demo
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-text-muted pt-1">
                  <span>Build verified in 1.4s</span>
                  <div className="flex items-center gap-1 text-accent-orange hover:text-accent-orange-hover transition-colors cursor-pointer">
                    <span>View app</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* Footnote Disclosing Conceptual Demo Data */}
        <div className="mt-12 pt-4 border-t border-border-subtle/50 flex items-center gap-2 text-[10.5px] font-mono text-text-muted">
          <Info className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span>
            Illustrative onboarding sequence. Demonstrates the intended workflow from repository connection to deployment.
          </span>
        </div>

      </div>
    </section>
  );
}

export default GettingStarted;
