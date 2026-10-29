"use client";

import React from "react";
import Link from "next/link";
import { Check, ArrowUpRight } from "lucide-react";

const BUILD_SEQUENCE = [
  "Repository connected",
  "Dependencies installed",
  "Application built",
  "Deployment completed",
];

const BENEFITS = [
  "Connect your repository.",
  "Build your application.",
  "Deploy with confidence.",
];

/**
 * DeploymentExperience: Section 02 — Deployment Pipeline
 * Redesigned in a sophisticated, editorial grayscale visual language.
 * Deep charcoal surfaces, soft-white typography, thin understated borders,
 * generous negative space, and minimal technical details.
 * 100% stable, normal document flow.
 */
export function DeploymentExperience() {
  return (
    <section
      id="deployment-experience"
      className="relative w-full pt-16 pb-24 sm:pt-20 sm:pb-28 lg:pt-24 lg:pb-36 bg-transparent text-text-primary overflow-hidden"
      aria-labelledby="deployment-heading"
    >
      <div className="layout-container w-full">
        {/* =================================================================
            SECTION IDENTIFIER: 02 / DEPLOYMENT
            Understated, minimal divider line
            ================================================================= */}
        <div className="w-full border-t border-border-subtle pt-5 mb-12 sm:mb-16">
          <div className="flex items-center gap-2 font-mono text-[11px] text-text-muted tracking-[0.1em] uppercase">
            <span className="text-accent-orange font-medium">02</span>
            <span>/</span>
            <span>DEPLOYMENT</span>
          </div>
        </div>

        {/* =================================================================
            TWO-COLUMN EDITORIAL COMPOSITION (~40/60 Split)
            ================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          {/* -------------------------------------------------------------
              LEFT COLUMN: Restrained Editorial Story
              Headline receives the strongest visual emphasis
              ------------------------------------------------------------- */}
          <div className="lg:col-span-5 flex flex-col justify-start">
            
            {/* Main Headline */}
            <h2
              id="deployment-heading"
              className="font-sans text-[38px] sm:text-[48px] lg:text-[54px] font-medium leading-[1.08] tracking-[-0.03em] text-[#F5F5F3] mb-6"
            >
              Ship without the ceremony.
            </h2>

            {/* Supporting Paragraph */}
            <p className="font-sans text-[16px] sm:text-[17px] text-text-secondary leading-[1.65] max-w-[440px] mb-10">
              Connect your code. Build your application. Get it ready for
              production without the unnecessary complexity.
            </p>

            {/* Three Concise Benefits (No numbered square badges, no filler icons) */}
            <ul className="space-y-4 pt-8 border-t border-border-subtle list-none p-0 m-0 max-w-[440px]">
              {BENEFITS.map((benefit, index) => (
                <li
                  key={benefit}
                  className="flex items-center gap-3 text-[14.5px] sm:text-[15px] text-[#F5F5F3] font-medium"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      index === 2 ? "bg-accent-orange" : "bg-[#777777]"
                    }`}
                    aria-hidden="true"
                  />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

          </div>

          {/* -------------------------------------------------------------
              RIGHT COLUMN: Minimal, Believable Product Interface
              One primary surface with subtle border, generous internal padding
              ------------------------------------------------------------- */}
          <div className="lg:col-span-7 w-full">
            <div className="w-full rounded-[10px] bg-surface-card border border-border-default shadow-2xl p-6 sm:p-8 lg:p-9 font-mono">
              
              {/* Interface Header */}
              <div className="flex items-center justify-between pb-6 border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[#F5F5F3]">
                    jetway-app
                  </span>
                  <span className="text-[13px] text-text-muted">/</span>
                  <span className="text-[12.5px] text-text-muted">
                    service
                  </span>
                </div>

                <div className="px-2.5 py-1 rounded-[4px] bg-surface-elevated border border-border-default text-text-secondary text-[11px]">
                  Production
                </div>
              </div>

              {/* Command Execution */}
              <div className="py-6 flex items-center gap-2.5 text-[13px] text-[#F5F5F3]">
                <span className="text-text-muted select-none font-medium">$</span>
                <span className="font-medium">git push origin main</span>
              </div>

              {/* Build Sequence */}
              <div className="space-y-3.5 pb-8">
                {BUILD_SEQUENCE.map((step) => (
                  <div
                    key={step}
                    className="flex items-center gap-3 text-[12.5px] text-text-secondary"
                  >
                    <span className="w-4 h-4 flex items-center justify-center text-text-secondary shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>

              {/* Single Clear Completion State */}
              <div className="pt-6 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-semantic-success"
                      aria-hidden="true"
                    />
                    <span className="text-[11px] uppercase tracking-wider text-text-secondary font-medium">
                      Deployment ready
                    </span>
                  </div>

                  <Link
                    href="https://app.jetway.demo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[14px] text-[#F5F5F3] hover:text-accent-orange transition-colors group"
                  >
                    <span>app.jetway.demo</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent-orange transition-colors" />
                  </Link>
                </div>

                <div className="text-[11px] text-text-muted font-mono self-start sm:self-center">
                  Latest release
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
}

export default DeploymentExperience;
