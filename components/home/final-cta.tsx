"use client";

import React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

/**
 * FinalCta: Section 08 — Final Call to Action
 * "Your code. Ready for what’s next."
 * Concludes the product narrative and gives visitors a clear, obvious next step.
 * 100% normal document flow — spacious, confident, and stable.
 */
export function FinalCta() {
  return (
    <section
      id="final-cta"
      className="relative w-full pt-16 pb-24 sm:pt-24 sm:pb-32 lg:pt-28 lg:pb-36 bg-bg-main text-text-primary overflow-hidden"
      aria-labelledby="cta-heading"
    >
      <div className="layout-container w-full relative">
        
        {/* =================================================================
            SUBTLE INFRASTRUCTURE MOTIF: Static Converging Path & Grid Markers
            Refined geometric circuit lines drawing visual focus toward the CTA
            ================================================================= */}
        <div
          className="absolute inset-x-0 top-0 h-[240px] pointer-events-none select-none flex justify-center opacity-40"
          aria-hidden="true"
        >
          <svg
            width="800"
            height="240"
            viewBox="0 0 800 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full max-w-[800px] h-full"
          >
            {/* Converging side paths */}
            <path
              d="M 50 20 L 250 140 L 400 140"
              stroke="#303030"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
            <path
              d="M 750 20 L 550 140 L 400 140"
              stroke="#303030"
              strokeWidth="1"
              strokeDasharray="4 6"
            />

            {/* Accent focal conduit */}
            <path
              d="M 400 0 L 400 140"
              stroke="#D88762"
              strokeWidth="1.5"
              strokeOpacity="0.8"
            />

            {/* Circuit Pin Junctions */}
            <circle cx="250" cy="140" r="3" fill="#1D1D1D" stroke="#303030" />
            <circle cx="550" cy="140" r="3" fill="#1D1D1D" stroke="#303030" />
            <circle cx="400" cy="140" r="4" fill="#D88762" />

            {/* Subtle Technical Grid Coordinates */}
            <g fontFamily="var(--font-geist-mono), monospace" fontSize="8" fill="#777777">
              <text x="210" y="132">[NODE // READY]</text>
              <text x="500" y="132">[NODE // SHIP]</text>
            </g>
          </svg>
        </div>

        {/* =================================================================
            EDITORIAL CLOSING CONTENT
            Focal Headline, Supporting Copy, High-Emphasis CTAs
            ================================================================= */}
        <div className="relative z-10 max-w-3xl mx-auto text-center flex flex-col items-center">
          
          {/* Eyebrow Label */}
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-[#171717] border border-border-subtle">
            <span
              className="w-1.5 h-1.5 rounded-[1px] bg-accent-orange"
              aria-hidden="true"
            />
            <span className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-muted">
              YOUR NEXT CHAPTER STARTS HERE
            </span>
          </div>

          {/* Focal Headline */}
          <h2
            id="cta-heading"
            className="font-sans text-[38px] sm:text-[50px] lg:text-[60px] font-medium leading-[1.05] tracking-[-0.035em] text-[#F5F5F3] mb-5 max-w-2xl"
          >
            Your code. Ready for what’s next.
          </h2>

          {/* Supporting Copy */}
          <p className="font-sans text-[16.5px] sm:text-[18px] text-text-secondary leading-[1.6] max-w-[580px] mb-8 sm:mb-10">
            Bring your next idea to life. Start with your code and build toward
            something worth shipping.
          </p>

          {/* Actions: Primary CTA with Strongest Emphasis + Secondary CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto">
            {/* Primary Action: Direct jump to the working Getting Started on-page onboarding */}
            <Link
              href="#getting-started"
              className="inline-flex items-center justify-center h-[46px] px-7 rounded-[7px] bg-accent-orange hover:bg-accent-orange-hover text-[#111111] text-[14px] font-semibold transition-colors shadow-lg shadow-accent-orange/20 w-full sm:w-auto"
            >
              Get started
            </Link>

            {/* Secondary Action: Valid repository destination */}
            <Link
              href="https://github.com/Deepanshu-2006/jetway"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 h-[46px] px-6 rounded-[7px] bg-[#171717] hover:bg-[#1D1D1D] border border-border-default hover:border-accent-orange/40 text-text-primary text-[13.5px] font-medium transition-colors w-full sm:w-auto group"
            >
              <span>GitHub repository</span>
              <ExternalLink className="w-3.5 h-3.5 text-text-muted group-hover:text-accent-orange transition-colors" />
            </Link>
          </div>

        </div>

      </div>
    </section>
  );
}

export default FinalCta;
