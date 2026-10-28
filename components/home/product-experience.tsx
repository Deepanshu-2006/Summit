"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/**
 * ProductExperience: Section 03 — From repository to reality
 *
 * Polished, art-directed technical illustration:
 * - Asymmetrical composition: Source (left) -> Build Core (centerpiece) -> Production (right)
 * - Large visual scale utilizing the full container width with generous negative space
 * - Fine, engineered line work and 3D isometric perspective
 * - One continuous deployment path (Burnt Orange #D88762 -> Restrained Green #83B69A)
 * - Build steps cleanly integrated below the core with zero path overlap
 * - 100% normal document flow, fully responsive.
 */
export function ProductExperience() {
  return (
    <section
      id="product-experience"
      className="relative w-full pt-16 pb-24 sm:pt-20 sm:pb-28 lg:pt-24 lg:pb-36 bg-bg-main text-text-primary overflow-hidden"
      aria-labelledby="experience-heading"
    >
      <div className="layout-container w-full">
        {/* =================================================================
            SECTION IDENTIFIER: 03 / SYSTEM ARCHITECTURE
            Understated, minimal divider line
            ================================================================= */}
        <div className="w-full border-t border-border-subtle pt-5 mb-12 sm:mb-16">
          <div className="flex items-center gap-2 font-mono text-[11px] text-text-muted tracking-[0.1em] uppercase">
            <span className="text-accent-orange font-medium">03</span>
            <span>/</span>
            <span>SYSTEM ARCHITECTURE</span>
          </div>
        </div>

        {/* =================================================================
            EDITORIAL INTRODUCTION
            Space Grotesk headline, supporting copy, subtle text link
            ================================================================= */}
        <div className="max-w-3xl mb-12 sm:mb-16">
          <h2
            id="experience-heading"
            className="font-sans text-[36px] sm:text-[44px] lg:text-[50px] xl:text-[54px] font-medium leading-[1.08] tracking-[-0.035em] text-[#F5F5F3] mb-5"
          >
            From repository to reality.
          </h2>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-6 pt-1">
            <p className="font-sans text-[16px] sm:text-[17px] text-text-secondary leading-[1.6] max-w-[560px]">
              Connect your code. Jetway builds it, deploys it, and gives your
              application a home on the internet.
            </p>

            <Link
              href="#deployment-experience"
              className="inline-flex items-center gap-1.5 text-[14px] text-text-secondary hover:text-[#F5F5F3] transition-colors group shrink-0"
            >
              <span>Explore the workflow</span>
              <ArrowUpRight className="w-4 h-4 text-accent-orange transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </div>

        {/* =================================================================
            CUSTOM ILLUSTRATED TECHNICAL DIAGRAM
            Engineered, open composition with generous negative space.
            The Build Core is the primary centerpiece.
            ================================================================= */}
        <div className="w-full relative">
          
          {/* -------------------------------------------------------------
              DESKTOP VIEWPORT (Wide Engineered Architectural Illustration)
              ------------------------------------------------------------- */}
          <div className="hidden lg:block w-full">
            <svg
              className="w-full h-auto select-none overflow-visible"
              viewBox="0 0 1140 480"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Engineered technical diagram illustrating code deployment journey from Git repository through Jetway build engine to a live application"
            >
              <defs>
                {/* Active Data Route Gradient: Burnt Orange transitioning to Restrained Green at Production */}
                <linearGradient
                  id="desktop-pipeline-gradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#D88762" />
                  <stop offset="68%" stopColor="#D88762" />
                  <stop offset="88%" stopColor="#83B69A" />
                  <stop offset="100%" stopColor="#83B69A" />
                </linearGradient>

                {/* Volumetric surface shading for 3D isometric planes */}
                <linearGradient id="facet-top" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1C1F22" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#121416" stopOpacity="0.85" />
                </linearGradient>

                <linearGradient id="facet-left" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#16181B" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#0E0F11" stopOpacity="0.95" />
                </linearGradient>

                <linearGradient id="facet-right" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#141618" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#0B0C0D" stopOpacity="0.95" />
                </linearGradient>

                <linearGradient id="core-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#D88762" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#D88762" stopOpacity="0.05" />
                </linearGradient>
              </defs>

              {/* =========================================================
                  THE CONTINUOUS CONNECTING PATH (The Storytelling Element)
                  Deliberate, smooth route passing cleanly through the 3 stages:
                  Source Head (210, 175) -> Build Core (560, 207) -> Production (850, 202)
                  ========================================================= */}
              
              {/* Background structural conduit line */}
              <path
                d="M 210,175 C 310,175 390,205 470,205 L 560,207 L 650,205 C 730,205 800,202 850,202"
                stroke="#2A2E31"
                strokeWidth="2.5"
                strokeDasharray="4 4"
                fill="none"
              />

              {/* Active deployment route: Burnt orange transitioning to green */}
              <path
                d="M 210,175 C 310,175 390,205 470,205 L 560,207 L 650,205 C 730,205 800,202 850,202"
                stroke="url(#desktop-pipeline-gradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />

              {/* =========================================================
                  STAGE 1: SOURCE — THE REPOSITORY (Left)
                  ========================================================= */}
              <g id="desktop-source">
                {/* Stage Header */}
                <text x="60" y="75" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#777D7D" letterSpacing="0.14em">
                  01 / SOURCE
                </text>
                <text x="60" y="102" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="22" fontWeight="500" fill="#F1F0EC">
                  my-project
                </text>
                <text x="60" y="124" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#A6AAA9">
                  main · 8f3a21c
                </text>

                {/* Isometric Chassis Base Plate */}
                <polygon
                  points="160,180 230,220 160,260 90,220"
                  fill="url(#facet-top)"
                  stroke="#343A3D"
                  strokeWidth="1.2"
                />
                {/* Extrusion Rim */}
                <polygon
                  points="90,220 160,260 160,270 90,230"
                  fill="url(#facet-left)"
                  stroke="#343A3D"
                  strokeWidth="1.2"
                />
                <polygon
                  points="160,260 230,220 230,230 160,270"
                  fill="url(#facet-right)"
                  stroke="#343A3D"
                  strokeWidth="1.2"
                />

                {/* Chassis Internal Grid & Alignment Brackets */}
                <line x1="125" y1="200" x2="195" y2="240" stroke="#222629" strokeWidth="1" />
                <line x1="195" y1="200" x2="125" y2="240" stroke="#222629" strokeWidth="1" />

                {/* Rising Git Commit Tree Linework */}
                {/* Base commit */}
                <circle cx="140" cy="225" r="3" fill="#121416" stroke="#44494C" strokeWidth="1.5" />
                
                {/* Feature branch (muted dashed) */}
                <path d="M 140,225 C 120,215 120,200 135,190" stroke="#343A3D" strokeWidth="1" strokeDasharray="2 2" fill="none" />
                <circle cx="135" cy="190" r="2.5" fill="#121416" stroke="#777D7D" strokeWidth="1" />

                {/* Main branch (active burnt orange) */}
                <path d="M 140,225 C 160,215 160,195 160,185 L 210,175" stroke="#D88762" strokeWidth="1.6" fill="none" />
                <circle cx="160" cy="185" r="3.5" fill="#121416" stroke="#D88762" strokeWidth="1.5" />

                {/* Head Commit Node (Origin Connection Port) */}
                <circle cx="210" cy="175" r="4.5" fill="#D88762" stroke="#F1F0EC" strokeWidth="1.4" />
                <circle cx="210" cy="175" r="8" stroke="#D88762" strokeOpacity="0.3" strokeWidth="1" fill="none" />

                {/* Technical Callout Bracket */}
                <line x1="218" y1="175" x2="235" y2="175" stroke="#44494C" strokeWidth="1" />
                <text x="242" y="172" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#F1F0EC" fontWeight="500">
                  HEAD
                </text>
                <text x="242" y="186" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#777D7D">
                  git push
                </text>
              </g>

              {/* =========================================================
                  STAGE 2: BUILD — JETWAY BUILD CORE (The Centerpiece)
                  Substantially larger visual weight, commanding silhouette
                  ========================================================= */}
              <g id="desktop-build">
                {/* Centerpiece Header */}
                <text x="560" y="60" textAnchor="middle" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#D88762" letterSpacing="0.14em">
                  02 / BUILD ENGINE
                </text>
                <text x="560" y="88" textAnchor="middle" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="24" fontWeight="500" fill="#F1F0EC">
                  Jetway Build Core
                </text>
                <text x="560" y="108" textAnchor="middle" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#777D7D">
                  Hermetic container pipeline
                </text>

                {/* Foundation Base Platform (Level 1) */}
                <polygon
                  points="560,240 650,280 560,320 470,280"
                  fill="url(#facet-top)"
                  stroke="#343A3D"
                  strokeWidth="1.2"
                />
                <polygon
                  points="470,280 560,320 560,332 470,292"
                  fill="url(#facet-left)"
                  stroke="#343A3D"
                  strokeWidth="1.2"
                />
                <polygon
                  points="560,320 650,280 650,292 560,332"
                  fill="url(#facet-right)"
                  stroke="#343A3D"
                  strokeWidth="1.2"
                />

                {/* Base Platform Structural Grid */}
                <line x1="515" y1="260" x2="605" y2="300" stroke="#222629" strokeWidth="1" />
                <line x1="605" y1="260" x2="515" y2="300" stroke="#222629" strokeWidth="1" />

                {/* Central Transformation Core Chamber (Level 2) */}
                <polygon
                  points="560,175 615,205 560,235 505,205"
                  fill="url(#facet-top)"
                  stroke="#44494C"
                  strokeWidth="1.5"
                />
                <polygon
                  points="505,205 560,235 560,265 505,235"
                  fill="url(#facet-left)"
                  stroke="#44494C"
                  strokeWidth="1.5"
                />
                <polygon
                  points="560,235 615,205 615,235 560,265"
                  fill="url(#facet-right)"
                  stroke="#44494C"
                  strokeWidth="1.5"
                />

                {/* Active Transformation Core Aperture in Burnt Orange */}
                <polygon
                  points="560,190 595,207 560,224 525,207"
                  fill="url(#core-glow)"
                  stroke="#D88762"
                  strokeWidth="1.8"
                />
                {/* Precision Core Crosshair */}
                <line x1="545" y1="207" x2="575" y2="207" stroke="#D88762" strokeWidth="1.2" />
                <line x1="560" y1="198" x2="560" y2="216" stroke="#D88762" strokeWidth="1.2" />
                <circle cx="560" cy="207" r="2.5" fill="#D88762" />

                {/* Pipeline Entry Port (470, 205) & Exit Port (650, 205) */}
                <circle cx="470" cy="205" r="4.5" fill="#121416" stroke="#D88762" strokeWidth="1.5" />
                <circle cx="650" cy="205" r="4.5" fill="#121416" stroke="#D88762" strokeWidth="1.5" />

                {/* Floating Upper Alignment Canopy (Level 3) */}
                <polygon
                  points="560,130 600,150 560,170 520,150"
                  fill="#181B1E"
                  fillOpacity="0.8"
                  stroke="#FFFFFF"
                  strokeOpacity="0.45"
                  strokeWidth="1.2"
                />
                {/* Vertical Laser / Precision Guide Rays */}
                <line x1="520" y1="150" x2="505" y2="205" stroke="#343A3D" strokeWidth="0.8" strokeDasharray="2 3" />
                <line x1="600" y1="150" x2="615" y2="205" stroke="#343A3D" strokeWidth="0.8" strokeDasharray="2 3" />
                <line x1="560" y1="170" x2="560" y2="235" stroke="#343A3D" strokeWidth="0.8" strokeDasharray="2 3" />

                {/* =====================================================
                    ORDERED BUILD STEPS SEQUENCE (Cleanly Integrated Below)
                    Completely clear of the connecting path, no overlap!
                    ===================================================== */}
                <g transform="translate(425, 360)">
                  {/* Step 1: Dependencies resolved */}
                  <g transform="translate(0, 0)">
                    <circle cx="6" cy="7" r="3" fill="#121416" stroke="#83B69A" strokeWidth="1.5" />
                    <text x="18" y="11" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#F1F0EC">
                      Dependencies resolved
                    </text>
                    <text x="220" y="11" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#777D7D">
                      1.1s
                    </text>
                  </g>

                  {/* Step 2: Application compiled */}
                  <g transform="translate(0, 24)">
                    <circle cx="6" cy="7" r="3" fill="#D88762" stroke="#D88762" strokeWidth="1.5" />
                    <text x="18" y="11" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#F1F0EC">
                      Application compiled
                    </text>
                    <text x="220" y="11" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#D88762">
                      2.4s
                    </text>
                  </g>

                  {/* Step 3: Release prepared */}
                  <g transform="translate(0, 48)">
                    <circle cx="6" cy="7" r="3" fill="#121416" stroke="#83B69A" strokeWidth="1.5" />
                    <text x="18" y="11" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#F1F0EC">
                      Release prepared
                    </text>
                    <text x="220" y="11" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#777D7D">
                      0.6s
                    </text>
                  </g>
                </g>
              </g>

              {/* =========================================================
                  STAGE 3: PRODUCTION — LIVE APPLICATION (Right)
                  Refined 2.5D perspective browser canvas, clean geometry
                  ========================================================= */}
              <g id="desktop-production">
                {/* Stage Header */}
                <text x="850" y="75" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#83B69A" letterSpacing="0.14em">
                  03 / PRODUCTION
                </text>
                <text x="850" y="102" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="22" fontWeight="500" fill="#F5F5F3">
                  my-project.jetway.app
                </text>
                <text x="850" y="124" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#A6AAA9">
                  Live endpoint · Anycast Edge
                </text>

                {/* Perspective Browser Window Frame */}
                <polygon
                  points="850,170 1070,190 1070,335 850,315"
                  fill="url(#facet-top)"
                  stroke="#44494C"
                  strokeWidth="1.5"
                />
                {/* 3D Depth Extrusion Edge */}
                <polygon
                  points="1070,190 1076,186 1076,331 1070,335"
                  fill="#0E1012"
                  stroke="#343A3D"
                  strokeWidth="1"
                />

                {/* Perspective Header Bar Line */}
                <line x1="850" y1="202" x2="1070" y2="222" stroke="#2B3033" strokeWidth="1" />

                {/* Window Controls */}
                <circle cx="865" cy="188" r="2.5" fill="#555A5D" />
                <circle cx="875" cy="189" r="2.5" fill="#555A5D" />
                <circle cx="885" cy="190" r="2.5" fill="#555A5D" />

                {/* URL in Perspective Header */}
                <text x="900" y="194" fontFamily="var(--font-geist-mono), monospace" fontSize="10.5" fill="#A6AAA9">
                  my-project.jetway.app
                </text>

                {/* Interface Wireframe: Heading bar */}
                <line x1="870" y1="230" x2="945" y2="237" stroke="#F1F0EC" strokeWidth="2.5" strokeLinecap="round" />

                {/* Interface Wireframe: Restrained content rules */}
                <line x1="870" y1="248" x2="990" y2="259" stroke="#3E4447" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="870" y1="262" x2="960" y2="270" stroke="#3E4447" strokeWidth="1.5" strokeLinecap="round" />

                {/* Compact Deployment Status Indicator */}
                <polygon
                  points="870,282 1010,295 1010,312 870,299"
                  fill="#131E18"
                  stroke="#22382C"
                  strokeWidth="1"
                />
                <circle cx="884" cy="291" r="3" fill="#83B69A" />
                <circle cx="884" cy="291" r="6" stroke="#83B69A" strokeOpacity="0.4" strokeWidth="1" fill="none" />
                
                <text x="896" y="295" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#83B69A" fontWeight="500">
                  LIVE
                </text>
                <text x="930" y="298" fontFamily="var(--font-geist-mono), monospace" fontSize="9.5" fill="#777D7D">
                  · TLS 1.3 ACTIVE
                </text>

                {/* Route Destination Terminal Anchor Node */}
                <circle cx="850" cy="202" r="5" fill="#121416" stroke="#83B69A" strokeWidth="1.5" />
                <circle cx="850" cy="202" r="2" fill="#83B69A" />
              </g>

            </svg>
          </div>

          {/* -------------------------------------------------------------
              MOBILE VIEWPORT (Vertical Sequential 3D Isometric Journey)
              Reflowed cleanly to avoid horizontal shrinkage or overflow
              ------------------------------------------------------------- */}
          <div className="lg:hidden w-full relative">
            <svg
              className="w-full h-auto select-none overflow-visible"
              viewBox="0 0 360 680"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Technical diagram illustrating code deployment journey"
            >
              <defs>
                <linearGradient
                  id="mobile-pipeline-vert"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#D88762" />
                  <stop offset="55%" stopColor="#D88762" />
                  <stop offset="85%" stopColor="#83B69A" />
                  <stop offset="100%" stopColor="#83B69A" />
                </linearGradient>
              </defs>

              {/* Continuous Vertical Connecting Route */}
              <path
                d="M 40,110 L 40,240 L 40,430 L 40,530"
                stroke="#24282B"
                strokeWidth="2"
                strokeDasharray="4 4"
                fill="none"
              />
              <path
                d="M 40,110 L 40,240 L 40,430 L 40,530"
                stroke="url(#mobile-pipeline-vert)"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />

              {/* STAGE 1: SOURCE */}
              <g transform="translate(30, 20)">
                <circle cx="10" cy="90" r="4.5" fill="#D88762" stroke="#FFFFFF" strokeWidth="1.2" />
                <text x="35" y="45" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#777D7D" letterSpacing="0.1em">
                  01 / SOURCE
                </text>
                <text x="35" y="68" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="19" fontWeight="500" fill="#F1F0EC">
                  my-project
                </text>
                <text x="35" y="88" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#A6AAA9">
                  main · 8f3a21c
                </text>
                <text x="35" y="106" fontFamily="var(--font-geist-mono), monospace" fontSize="10.5" fill="#777D7D">
                  Push to deploy
                </text>
              </g>

              {/* STAGE 2: BUILD ENGINE */}
              <g transform="translate(30, 230)">
                <circle cx="10" cy="30" r="4.5" fill="#D88762" />
                <text x="35" y="15" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#D88762" letterSpacing="0.1em">
                  02 / BUILD ENGINE
                </text>
                <text x="35" y="38" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="19" fontWeight="500" fill="#F1F0EC">
                  Jetway Build Core
                </text>
                
                {/* Concise Build Steps Sequence */}
                <g transform="translate(35, 60)">
                  <g transform="translate(0, 0)">
                    <circle cx="5" cy="6" r="3" fill="#121416" stroke="#83B69A" strokeWidth="1.5" />
                    <text x="16" y="10" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#F1F0EC">
                      Dependencies resolved
                    </text>
                    <text x="210" y="10" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#777D7D">
                      1.1s
                    </text>
                  </g>
                  <g transform="translate(0, 26)">
                    <circle cx="5" cy="6" r="3" fill="#D88762" stroke="#D88762" strokeWidth="1.5" />
                    <text x="16" y="10" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#F1F0EC">
                      Application compiled
                    </text>
                    <text x="210" y="10" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#D88762">
                      2.4s
                    </text>
                  </g>
                  <g transform="translate(0, 52)">
                    <circle cx="5" cy="6" r="3" fill="#121416" stroke="#83B69A" strokeWidth="1.5" />
                    <text x="16" y="10" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#F1F0EC">
                      Release prepared
                    </text>
                    <text x="210" y="10" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#777D7D">
                      0.6s
                    </text>
                  </g>
                </g>
              </g>

              {/* STAGE 3: PRODUCTION */}
              <g transform="translate(30, 480)">
                <circle cx="10" cy="50" r="5" fill="#83B69A" stroke="#FFFFFF" strokeWidth="1.2" />
                <text x="35" y="15" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#83B69A" letterSpacing="0.1em">
                  03 / PRODUCTION
                </text>
                <text x="35" y="38" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="19" fontWeight="500" fill="#F5F5F3">
                  my-project.jetway.app
                </text>
                <text x="35" y="58" fontFamily="var(--font-geist-mono), monospace" fontSize="11.5" fill="#83B69A">
                  ● Live · Anycast Edge
                </text>
                <text x="35" y="76" fontFamily="var(--font-geist-mono), monospace" fontSize="10.5" fill="#777D7D">
                  TLS 1.3 Active · 0ms cutover
                </text>
              </g>
            </svg>
          </div>

        </div>

      </div>
    </section>
  );
}

export default ProductExperience;
