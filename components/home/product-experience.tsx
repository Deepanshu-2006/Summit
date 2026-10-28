"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  GitBranch,
  Lock,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Layers,
  Zap,
  Globe2,
} from "lucide-react";

/**
 * ProductExperience: Section 03 — Product Experience
 * "From repository to reality."
 * Shows the tangible outcome of deployment: a live, accessible application.
 * Normal document flow only — clean, spacious, and stable.
 */
export function ProductExperience() {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  const handleCopyUrl = () => {
    navigator.clipboard?.writeText("https://my-project.jetway.app");
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyCommand = () => {
    navigator.clipboard?.writeText("npm i @prism/tokens");
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  return (
    <section
      id="product-experience"
      className="relative w-full pt-12 pb-20 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-32 bg-bg-main text-text-primary overflow-hidden"
      aria-labelledby="experience-heading"
    >
      <div className="layout-container w-full">
        {/* =================================================================
            SECTION MARKER: 03 — PRODUCT EXPERIENCE
            ================================================================= */}
        <div className="w-full flex items-center justify-between border-t border-border-subtle/70 pt-5 mb-10 sm:mb-14">
          <div className="flex items-center gap-3 font-mono text-[11px] text-text-muted tracking-wider">
            <span className="text-accent-orange font-medium">03</span>
            <div className="w-8 h-[1px] bg-accent-orange" aria-hidden="true" />
            <span>PRODUCT EXPERIENCE</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 font-mono text-[10.5px] text-text-muted">
            <span>DEPLOYED APPLICATION</span>
            <span className="text-border-default">•</span>
            <span>LIVE OUTCOME</span>
          </div>
        </div>

        {/* =================================================================
            EDITORIAL INTRO: Eyebrow, Headline, Supporting Copy, CTA
            Spacious, clear typography establishing the outcome
            ================================================================= */}
        <div className="max-w-3xl mb-10 sm:mb-14">
          {/* Technical Eyebrow */}
          <div className="flex items-center gap-2 mb-4">
            <span
              className="w-1.5 h-1.5 rounded-[1px] bg-accent-orange"
              aria-hidden="true"
            />
            <span className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-muted">
              FROM COMMIT TO CUSTOMER
            </span>
          </div>

          {/* Section Headline */}
          <h2
            id="experience-heading"
            className="font-sans text-[36px] sm:text-[46px] lg:text-[54px] font-medium leading-[1.06] tracking-[-0.035em] text-[#F5F5F3] mb-5"
          >
            From repository to reality.
          </h2>

          {/* Supporting Copy & Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-1">
            <p className="font-sans text-[16px] sm:text-[17px] text-text-secondary leading-[1.6] max-w-[560px]">
              Connect your code, deploy your application, and get a live product
              without getting buried in infrastructure.
            </p>

            <Link
              href="#deployment-experience"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[6px] bg-[#1D1D1D] hover:bg-[#252525] border border-border-default hover:border-accent-orange/40 text-text-primary text-[13px] font-medium transition-all shrink-0 self-start sm:self-center group"
            >
              <span>Explore the workflow</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-accent-orange group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* =================================================================
            MAIN VISUAL: The Deployed Application (The Focal Point)
            Full-width browser showcase window containing a real-feeling product
            ================================================================= */}
        <div className="w-full relative">
          <div className="w-full rounded-[12px] bg-[#171717] border border-border-default shadow-2xl shadow-black/80 overflow-hidden">
            
            {/* -------------------------------------------------------------
                WINDOW BROWSER HEADER
                Controls, illustrative URL bar, repository link, live status
                ------------------------------------------------------------- */}
            <div className="px-4 py-3 bg-[#171717] border-b border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-3">
              
              {/* Window Controls & Project Indicator */}
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center gap-1.5 shrink-0"
                  aria-hidden="true"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#444444]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#444444]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#444444]" />
                </div>

                <div className="h-3 w-[1px] bg-border-subtle hidden sm:block" />

                {/* Subordinate Project Identity */}
                <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted">
                  <span className="text-[#F5F5F3] font-medium">my-project</span>
                  <span className="hidden sm:inline text-text-muted">/</span>
                  <span className="hidden sm:inline text-text-muted">
                    github.com/example/my-project
                  </span>
                </div>
              </div>

              {/* Central Browser Address Bar */}
              <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-[6px] bg-[#111111] border border-border-subtle text-[11.5px] font-mono text-text-secondary w-full md:max-w-[380px]">
                <div className="flex items-center gap-2 truncate">
                  <Lock className="w-3 h-3 text-semantic-success shrink-0" />
                  <span className="text-text-muted">https://</span>
                  <span className="text-[#F5F5F3] font-medium truncate">
                    my-project.jetway.app
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleCopyUrl}
                    className="p-1 rounded hover:bg-[#252525] text-text-muted hover:text-text-primary transition-colors"
                    title="Copy domain URL"
                    aria-label="Copy domain URL"
                  >
                    {copiedUrl ? (
                      <Check className="w-3 h-3 text-semantic-success" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                  <Link
                    href="https://my-project.jetway.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-[#252525] text-text-muted hover:text-accent-orange transition-colors"
                    title="Open live link"
                    aria-label="Open live link"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Right: Branch & Status Badge */}
              <div className="flex items-center gap-2.5 font-mono text-[11px] self-end md:self-auto">
                <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#252525] border border-border-subtle text-text-secondary text-[10.5px]">
                  <GitBranch className="w-3 h-3 text-text-muted" />
                  <span>main</span>
                </div>

                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border border-semantic-success/35 bg-semantic-success/15 text-semantic-success text-[10.5px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                  <span>LIVE</span>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------
                APPLICATION PREVIEW CANVAS (The Deployed Website)
                Fictional modern SaaS product "Prism Studio" running live
                ------------------------------------------------------------- */}
            <div className="w-full bg-[#111111] p-5 sm:p-8 lg:p-12 relative overflow-hidden">
              {/* Fictional App Container */}
              <div className="max-w-4xl mx-auto rounded-[10px] bg-[#1D1D1D] border border-border-subtle p-6 sm:p-8 lg:p-10 shadow-xl relative z-10">
                
                {/* Fictional App Navbar */}
                <div className="flex items-center justify-between pb-6 sm:pb-8 border-b border-border-subtle/50 mb-8 sm:mb-10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-[6px] bg-[#252525] border border-border-default flex items-center justify-center text-accent-orange font-semibold text-xs shadow-sm">
                      ◆
                    </div>
                    <span className="font-sans font-semibold text-[15px] tracking-tight text-[#F5F5F3]">
                      Prism
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#252525] border border-border-subtle text-text-muted">
                      v2.4
                    </span>
                  </div>

                  <div className="hidden sm:flex items-center gap-6 text-[13px] text-text-secondary font-medium">
                    <span className="hover:text-text-primary cursor-pointer transition-colors">
                      Tokens
                    </span>
                    <span className="hover:text-text-primary cursor-pointer transition-colors">
                      Workflows
                    </span>
                    <span className="hover:text-text-primary cursor-pointer transition-colors">
                      Documentation
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button className="px-3 py-1.5 rounded-[6px] bg-[#252525] hover:bg-[#303030] text-[12px] text-text-primary font-medium border border-border-subtle transition-colors">
                      Sign In
                    </button>
                    <button className="px-3.5 py-1.5 rounded-[6px] bg-accent-orange hover:bg-accent-orange-hover text-[12px] text-[#111111] font-semibold transition-colors shadow-sm">
                      Get Started
                    </button>
                  </div>
                </div>

                {/* Fictional App Hero Area */}
                <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#252525] border border-border-subtle text-[11px] text-text-secondary font-mono mb-4">
                    <Sparkles className="w-3 h-3 text-accent-orange" />
                    <span>Real-time design token synchronization</span>
                  </div>

                  <h3 className="font-sans text-[28px] sm:text-[38px] lg:text-[42px] font-medium leading-[1.12] tracking-[-0.025em] text-[#F5F5F3] mb-4">
                    Design tokens in motion, straight to production.
                  </h3>

                  <p className="font-sans text-[14px] sm:text-[15.5px] text-text-secondary leading-relaxed max-w-xl mx-auto mb-6">
                    Prism automatically compiles multi-brand design tokens into
                    type-safe CSS variables, Tailwind tokens, and native mobile
                    themes on every Git commit.
                  </p>

                  {/* Fictional CTAs & Install Snippet */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button className="w-full sm:w-auto px-5 py-2.5 rounded-[6px] bg-accent-orange hover:bg-accent-orange-hover text-[#111111] font-medium text-[13px] transition-colors shadow-lg shadow-accent-orange/20">
                      Start building for free
                    </button>

                    <div className="w-full sm:w-auto flex items-center justify-between gap-2 px-3 py-2 rounded-[6px] bg-[#111111] border border-border-default font-mono text-[12px] text-text-muted">
                      <span>$ npm i @prism/tokens</span>
                      <button
                        onClick={handleCopyCommand}
                        className="p-1 hover:text-text-primary transition-colors"
                        title="Copy install command"
                      >
                        {copiedCommand ? (
                          <Check className="w-3.5 h-3.5 text-semantic-success" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Fictional Product Content Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
                  {/* Card 1 */}
                  <div className="p-4 rounded-[8px] bg-[#252525] border border-border-subtle flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-7 h-7 rounded-[5px] bg-[#1D1D1D] border border-border-subtle flex items-center justify-center">
                        <Layers className="w-3.5 h-3.5 text-accent-orange" />
                      </div>
                      <span className="font-mono text-[10px] text-text-muted">
                        Figma Webhook
                      </span>
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-[#F5F5F3] mb-1 font-sans">
                        Zero Manual Export
                      </div>
                      <p className="text-[11.5px] text-text-muted leading-relaxed">
                        Changes published in Figma push directly to repository branches.
                      </p>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="p-4 rounded-[8px] bg-[#252525] border border-border-subtle flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-7 h-7 rounded-[5px] bg-[#1D1D1D] border border-border-subtle flex items-center justify-center">
                        <Zap className="w-3.5 h-3.5 text-accent-orange" />
                      </div>
                      <span className="font-mono text-[10px] text-text-muted">
                        Sub-second
                      </span>
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-[#F5F5F3] mb-1 font-sans">
                        Hermetic Generation
                      </div>
                      <p className="text-[11.5px] text-text-muted leading-relaxed">
                        Compiles 4,000 token variations in less than 80ms.
                      </p>
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div className="p-4 rounded-[8px] bg-[#252525] border border-border-subtle flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-7 h-7 rounded-[5px] bg-[#1D1D1D] border border-border-subtle flex items-center justify-center">
                        <Globe2 className="w-3.5 h-3.5 text-semantic-success" />
                      </div>
                      <span className="font-mono text-[10px] text-text-muted">
                        Global Edge
                      </span>
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-[#F5F5F3] mb-1 font-sans">
                        Instant CDN Delivery
                      </div>
                      <p className="text-[11.5px] text-text-muted leading-relaxed">
                        CSS bundle delivered via Anycast edge nodes in under 15ms.
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* -------------------------------------------------------------
                SLIM METADATA STRIP (Deployment Outcome Details)
                Latest deployment, branch, build duration, live domain
                Subordinate to the preview, clearly illustrative
                ------------------------------------------------------------- */}
            <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-[#111111] border-t border-border-subtle flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-[11.5px] font-mono text-text-muted">
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                {/* Detail 1: Latest Deployment */}
                <div>
                  <div className="text-[10px] uppercase text-text-muted tracking-wider">
                    LATEST DEPLOYMENT
                  </div>
                  <div className="text-[#F5F5F3] font-medium mt-0.5">
                    commit 8f3a21c <span className="text-text-muted font-normal">(2m ago)</span>
                  </div>
                </div>

                {/* Detail 2: Branch */}
                <div>
                  <div className="text-[10px] uppercase text-text-muted tracking-wider">
                    TARGET BRANCH
                  </div>
                  <div className="text-[#F5F5F3] font-medium mt-0.5">
                    main <span className="text-semantic-success">✓ synced</span>
                  </div>
                </div>

                {/* Detail 3: Build Duration */}
                <div>
                  <div className="text-[10px] uppercase text-text-muted tracking-wider">
                    BUILD DURATION
                  </div>
                  <div className="text-[#F5F5F3] font-medium mt-0.5">
                    1.4s <span className="text-text-muted font-normal">(cached)</span>
                  </div>
                </div>

                {/* Detail 4: Live Domain */}
                <div>
                  <div className="text-[10px] uppercase text-text-muted tracking-wider">
                    LIVE DOMAIN
                  </div>
                  <div className="text-[#F5F5F3] font-medium mt-0.5 truncate">
                    my-project.jetway.app
                  </div>
                </div>
              </div>

              {/* Footnote Disclosing Sample Data */}
              <div className="text-[10.5px] text-text-muted/80 self-start lg:self-center border-t lg:border-t-0 pt-2 lg:pt-0 border-border-subtle/50">
                <span>* Illustrative preview demonstrating a live deployed application.</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}

export default ProductExperience;
