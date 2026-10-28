"use client";

import React, { useState } from "react";
import {
  GitBranch,
  GitCommit,
  ArrowRight,
  Clock,
  CheckCircle2,
  Sliders,
  Globe,
  ShieldCheck,
  Activity,
  Info,
} from "lucide-react";

/**
 * DeveloperExperience: Section 05 — Developer Experience
 * "Built for the way you work."
 * Three distinct developer experience pillars:
 * 1. Work with your workflow (Horizontal repository-to-deployment interface)
 * 2. Understand what happened (Deployment activity timeline panel)
 * 3. Stay in control (Simplified settings & configuration controls)
 * 100% stable, normal document flow.
 */
export function DeveloperExperience() {
  const [previewToggled, setPreviewToggled] = useState(true);

  return (
    <section
      id="developer-experience"
      className="relative w-full pt-12 pb-20 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-32 bg-bg-main text-text-primary overflow-hidden"
      aria-labelledby="devex-heading"
    >
      <div className="layout-container w-full">
        {/* =================================================================
            SECTION MARKER: 05 — DEVELOPER EXPERIENCE
            ================================================================= */}
        <div className="w-full flex items-center justify-between border-t border-border-subtle/70 pt-5 mb-10 sm:mb-14">
          <div className="flex items-center gap-3 font-mono text-[11px] text-text-muted tracking-wider">
            <span className="text-accent-orange font-medium">05</span>
            <div className="w-8 h-[1px] bg-accent-orange" aria-hidden="true" />
            <span>DEVELOPER EXPERIENCE</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 font-mono text-[10.5px] text-text-muted">
            <span>WORKFLOW SIMPLICITY</span>
            <span className="text-border-default">•</span>
            <span>INTENTIONAL CONTROL</span>
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
              LESS FRICTION. MORE FLOW.
            </span>
          </div>

          {/* Section Headline */}
          <h2
            id="devex-heading"
            className="font-sans text-[36px] sm:text-[46px] lg:text-[54px] font-medium leading-[1.06] tracking-[-0.035em] text-[#F1F0EC] mb-5"
          >
            Built for the way you work.
          </h2>

          {/* Supporting Copy */}
          <p className="font-sans text-[16px] sm:text-[17px] text-text-secondary leading-[1.6] max-w-[620px]">
            Your tools should help you move forward, not slow you down. Keep
            your development workflow focused, your deployments understandable,
            and the essentials within reach.
          </p>
        </div>

        {/* =================================================================
            THREE DEVELOPER EXPERIENCE PILLARS
            Art-directed editorial layout: Wide Ribbon (Pillar 1) + Split Row (Pillars 2 & 3)
            ================================================================= */}
        <div className="space-y-6 sm:space-y-8">
          
          {/* -------------------------------------------------------------
              PILLAR 01: Work with your workflow
              Wide horizontal repository-to-deployment interface
              ------------------------------------------------------------- */}
          <div className="w-full rounded-[12px] bg-[#16181B] border border-border-default shadow-xl p-6 sm:p-8 lg:p-10 relative overflow-hidden">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* Text Info */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10.5px] text-accent-orange font-medium">
                    PILLAR 01
                  </span>
                  <div className="w-3 h-[1px] bg-accent-orange/60" aria-hidden="true" />
                  <span className="font-mono text-[10.5px] text-text-muted uppercase">
                    Work with your workflow
                  </span>
                </div>

                <h3 className="font-sans text-[22px] sm:text-[26px] font-medium tracking-tight text-[#F1F0EC]">
                  Start with the code you already have.
                </h3>

                <p className="font-sans text-[14.5px] text-text-secondary leading-relaxed">
                  Connect your repository and build on the development workflow
                  you already know.
                </p>
              </div>

              {/* Visual: Horizontal Repository-to-Deployment Action */}
              <div className="lg:col-span-7 w-full">
                <div className="rounded-[10px] bg-[#191C1F] border border-border-default p-4 sm:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                  
                  {/* Repo Details */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-[6px] bg-[#202427] border border-border-subtle flex items-center justify-center shrink-0 mt-0.5">
                      <GitBranch className="w-4 h-4 text-accent-orange" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[13px] font-semibold text-[#F1F0EC] truncate">
                          acme/jetway-app
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-[#202427] border border-border-subtle text-[10px] font-mono text-text-muted">
                          main
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-text-muted mt-1 truncate">
                        <GitCommit className="w-3 h-3 text-text-muted shrink-0" />
                        <span className="truncate">8f3a21c · sync production dependencies</span>
                      </div>
                    </div>
                  </div>

                  {/* Flow Arrow */}
                  <div className="hidden md:flex items-center justify-center text-accent-orange shrink-0">
                    <ArrowRight className="w-4 h-4" />
                  </div>

                  {/* Trigger Action & Outcome */}
                  <div className="flex items-center gap-3 shrink-0 self-start md:self-auto pt-2 md:pt-0 border-t md:border-t-0 border-border-subtle/60 w-full md:w-auto justify-between md:justify-start">
                    <div className="text-right hidden sm:block">
                      <div className="text-[10px] font-mono text-text-muted uppercase">
                        Action
                      </div>
                      <div className="text-[11.5px] font-mono text-[#F1F0EC] font-medium">
                        Automatic Build
                      </div>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-semantic-success/15 border border-semantic-success/30 text-semantic-success text-[11.5px] font-mono font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Ready in 1.4s</span>
                    </div>
                  </div>

                </div>
              </div>

            </div>

          </div>

          {/* -------------------------------------------------------------
              PILLARS 02 & 03: Split Row
              Pillar 2: Activity Timeline | Pillar 3: Simplified Settings
              ------------------------------------------------------------- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            
            {/* PILLAR 02: Understand what happened */}
            <div className="rounded-[12px] bg-[#16181B] border border-border-default shadow-xl p-6 sm:p-8 flex flex-col justify-between">
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10.5px] text-accent-orange font-medium">
                    PILLAR 02
                  </span>
                  <div className="w-3 h-[1px] bg-accent-orange/60" aria-hidden="true" />
                  <span className="font-mono text-[10.5px] text-text-muted uppercase">
                    Understand what happened
                  </span>
                </div>

                <h3 className="font-sans text-[22px] sm:text-[24px] font-medium tracking-tight text-[#F1F0EC]">
                  Know where every deployment stands.
                </h3>

                <p className="font-sans text-[14px] text-text-secondary leading-relaxed">
                  Make build results and deployment status easy to understand, so
                  you can spend less time searching for answers.
                </p>
              </div>

              {/* Visual: Clean Activity Timeline Panel */}
              <div className="rounded-[10px] bg-[#191C1F] border border-border-default p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border-subtle text-[11px] font-mono text-text-muted">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-accent-orange" />
                    <span className="text-[#F1F0EC] font-medium">Recent Activity</span>
                  </div>
                  <span>Illustrative Events</span>
                </div>

                {/* Event 1 */}
                <div className="flex items-start justify-between gap-3 text-[12px] font-mono">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-semantic-success mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[#F1F0EC] font-medium truncate">
                        Production cutover completed
                      </div>
                      <div className="text-[11px] text-text-muted truncate">
                        commit 8f3a21c • app.jetway.demo
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-text-muted shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>2m ago</span>
                  </span>
                </div>

                {/* Event 2 */}
                <div className="flex items-start justify-between gap-3 text-[12px] font-mono pt-2 border-t border-border-subtle/50">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-teal-400 mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[#F1F0EC] font-medium truncate">
                        Branch preview online
                      </div>
                      <div className="text-[11px] text-text-muted truncate">
                        PR #42 · feat/auth-revamp
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-text-muted shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>14m ago</span>
                  </span>
                </div>

                {/* Event 3 */}
                <div className="flex items-start justify-between gap-3 text-[12px] font-mono pt-2 border-t border-border-subtle/50">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-border-default mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[#F1F0EC] font-medium truncate">
                        Hermetic build artifact cached
                      </div>
                      <div className="text-[11px] text-text-muted truncate">
                        digest sha256:77df0c
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-text-muted shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>32m ago</span>
                  </span>
                </div>

              </div>

            </div>

            {/* PILLAR 03: Stay in control */}
            <div className="rounded-[12px] bg-[#16181B] border border-border-default shadow-xl p-6 sm:p-8 flex flex-col justify-between">
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10.5px] text-accent-orange font-medium">
                    PILLAR 03
                  </span>
                  <div className="w-3 h-[1px] bg-accent-orange/60" aria-hidden="true" />
                  <span className="font-mono text-[10.5px] text-text-muted uppercase">
                    Stay in control
                  </span>
                </div>

                <h3 className="font-sans text-[22px] sm:text-[24px] font-medium tracking-tight text-[#F1F0EC]">
                  Keep the essentials within reach.
                </h3>

                <p className="font-sans text-[14px] text-text-secondary leading-relaxed">
                  Give developers a clear place to understand their applications
                  and access the settings they need.
                </p>
              </div>

              {/* Visual: Simplified Application Settings Controls */}
              <div className="rounded-[10px] bg-[#191C1F] border border-border-default p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border-subtle text-[11px] font-mono text-text-muted">
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-accent-orange" />
                    <span className="text-[#F1F0EC] font-medium">Project Settings</span>
                  </div>
                  <span>Conceptual Controls</span>
                </div>

                {/* Setting 1: Custom Domain */}
                <div className="flex items-center justify-between gap-3 text-[12px] font-mono">
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span className="text-[#F1F0EC] font-medium truncate">
                      Custom Domain
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-semantic-success">
                    <ShieldCheck className="w-3 h-3" />
                    <span>SSL Active</span>
                  </div>
                </div>

                {/* Setting 2: Preview Deployments Toggle */}
                <div className="flex items-center justify-between gap-3 text-[12px] font-mono pt-2 border-t border-border-subtle/50">
                  <div>
                    <div className="text-[#F1F0EC] font-medium">
                      Branch Previews
                    </div>
                    <div className="text-[10.5px] text-text-muted">
                      Generate URL on pull request
                    </div>
                  </div>
                  <button
                    onClick={() => setPreviewToggled(!previewToggled)}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                      previewToggled ? "bg-accent-orange" : "bg-[#292E31]"
                    }`}
                    role="switch"
                    aria-checked={previewToggled}
                    aria-label="Toggle branch preview deployments"
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        previewToggled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Setting 3: Environment Variables */}
                <div className="flex items-center justify-between gap-3 text-[12px] font-mono pt-2 border-t border-border-subtle/50">
                  <div>
                    <div className="text-[#F1F0EC] font-medium">
                      Environment Target
                    </div>
                    <div className="text-[10.5px] text-text-muted">
                      3 production keys configured
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-[4px] bg-[#202427] border border-border-subtle text-[10.5px] text-text-secondary">
                    Isolated
                  </span>
                </div>

              </div>

            </div>

          </div>

        </div>

        {/* Footnote Disclosing Conceptual Demo Data */}
        <div className="mt-12 pt-4 border-t border-border-subtle/50 flex items-center gap-2 text-[10.5px] font-mono text-text-muted">
          <Info className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span>
            Conceptual developer workflow model. Demonstrates proposed interface interactions without live claims.
          </span>
        </div>

      </div>
    </section>
  );
}

export default DeveloperExperience;
