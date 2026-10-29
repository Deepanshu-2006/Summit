"use client";

import React from "react";

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

/**
 * DeveloperExperience: Section 05 — Developer Experience
 * Typography-first editorial redesign.
 *
 * Core principles:
 * - No cards, no dashboards, no illustrations.
 * - Three strong ideas, beautifully typeset, separated by space.
 * - Warm off-white Space Grotesk headlines, burnt-orange numbers, and soft neutral gray supporting copy.
 * - Understated interactive underline that draws smoothly on pointer hover.
 */
export function DeveloperExperience() {
  return (
    <section
      id="developer-experience"
      className="relative w-full pt-16 pb-24 sm:pt-20 sm:pb-28 lg:pt-24 lg:pb-36 bg-transparent text-[#F0EEE9] overflow-hidden select-none"
      aria-labelledby="devex-heading"
    >
      <div className="layout-container w-full">

        {/* =================================================================
            SECTION INTRODUCTION: Heading & Supporting Copy
            ================================================================= */}
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
            and the essentials within reach.
          </p>
        </div>

        {/* =================================================================
            THE THREE PILLARS: Horizontal Typography-First Editorial Row
            Shared content grid, generous spacing, thin vertical separators on desktop
            No cards. No dashboards. No illustrations.
            ================================================================= */}
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

                {/* 2 & 4. Prominent headline with subtle interactive underline */}
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
      </div>
    </section>
  );
}

export default DeveloperExperience;
