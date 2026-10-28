"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/**
 * ProductExperience: Section 03 — From repository to reality
 *
 * Art-Directed Diagonal Architectural Infrastructure Illustration:
 * - 3 stages composed along a deliberate, elegant diagonal journey:
 *     01 SOURCE (Upper Left) -> 02 BUILD ENGINE (Centerpiece Anchor) -> 03 PRODUCTION (Lower Right)
 * - Cohesive 30-degree isometric perspective across all stages
 * - Grounded isometric base slab underneath the production browser
 * - Cleaned-up Jetway Build Core: removed detached/awkward vertical lines, pure layered plinth geometry
 * - Meaningful dual-color conduits:
 *     Source-to-Build: Burnt Orange (#D88762)
 *     Build-to-Production: Muted Green (#83B69A)
 * - Precision connection nodes and flange couplings
 * - Subtle motion packets with motion-reduce:hidden support
 * - Compact, perfectly aligned build telemetry sequence docked beneath the engine
 * - Crisp, uncluttered production live viewport with domain & status strip
 * - Fully responsive with clean vertical reflow on mobile/tablet
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
            ================================================================= */}
        <div className="w-full border-t border-border-subtle pt-5 mb-8 sm:mb-10">
          <div className="flex items-center gap-2 font-mono text-[11px] text-text-muted tracking-[0.1em] uppercase">
            <span className="text-accent-orange font-medium">03</span>
            <span>/</span>
            <span>SYSTEM ARCHITECTURE</span>
          </div>
        </div>

        {/* =================================================================
            EDITORIAL INTRODUCTION
            ================================================================= */}
        <div className="max-w-3xl mb-6 sm:mb-8">
          <h2
            id="experience-heading"
            className="font-sans text-[36px] sm:text-[44px] lg:text-[50px] xl:text-[54px] font-medium leading-[1.08] tracking-[-0.035em] text-[#F5F5F3] mb-4 sm:mb-5"
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
            ART-DIRECTED DIAGONAL INFRASTRUCTURE ILLUSTRATION
            ================================================================= */}
        <div className="w-full relative">
          
          {/* -------------------------------------------------------------
              DESKTOP SCENE: Large Diagonal Engineering Architecture
              Staggered Upper-Left -> Centerpiece -> Lower-Right Composition
              ------------------------------------------------------------- */}
          <div className="hidden lg:block w-full">
            <svg
              className="w-full h-auto select-none overflow-visible"
              viewBox="0 0 1200 570"
              preserveAspectRatio="xMidYMid meet"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Art-directed architectural illustration of Jetway deployment infrastructure"
            >
              <defs>
                {/* Precision Volumetric Isometric Shading */}
                <linearGradient id="iso-top-vol" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22262A" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#131618" stopOpacity="0.95" />
                </linearGradient>

                <linearGradient id="iso-left-vol" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1A1D20" stopOpacity="0.98" />
                  <stop offset="100%" stopColor="#0E1012" stopOpacity="0.98" />
                </linearGradient>

                <linearGradient id="iso-right-vol" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#16181B" stopOpacity="0.98" />
                  <stop offset="100%" stopColor="#0A0B0D" stopOpacity="0.98" />
                </linearGradient>

                <linearGradient id="core-glow-vol" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#D88762" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#D88762" stopOpacity="0.06" />
                </linearGradient>
              </defs>

              {/* =========================================================
                  CONNECTING INFRASTRUCTURE WIRING (Rendered Behind Geometry)
                  Leg 1: Source -> Build Engine Conduit (Burnt Orange #D88762)
                  Leg 2: Build Engine -> Production Conduit (Muted Green #83B69A)
                  ========================================================= */}
              
              {/* Leg 1: Source to Build Engine Conduit (Burnt Orange) */}
              <path
                d="M 270,205 C 345,205 375,320 450,320"
                stroke="#3D4245"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                fill="none"
              />
              <path
                id="source-to-build-path"
                d="M 270,205 C 345,205 375,320 450,320"
                stroke="#D88762"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
              {/* Outlined Junction Node on Leg 1 */}
              <circle cx="360" cy="262.5" r="3.5" fill="#121416" stroke="#D88762" strokeWidth="1.4" />
              <circle cx="360" cy="262.5" r="1.5" fill="#D88762" />

              {/* Subtle Signal Motion Packet: Source to Build (respects prefers-reduced-motion) */}
              <circle className="motion-reduce:hidden" r="3.5" fill="#D88762">
                <animateMotion
                  path="M 270,205 C 345,205 375,320 450,320"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </circle>

              {/* Leg 2: Build Engine to Production Conduit (Muted Green) */}
              <path
                d="M 730,320 C 790,320 815,365 875,365"
                stroke="#3D4245"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                fill="none"
              />
              <path
                id="build-to-prod-path"
                d="M 730,320 C 790,320 815,365 875,365"
                stroke="#83B69A"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
              {/* Outlined Junction Node on Leg 2 */}
              <circle cx="802.5" cy="342.5" r="3.5" fill="#121416" stroke="#83B69A" strokeWidth="1.4" />
              <circle cx="802.5" cy="342.5" r="1.5" fill="#83B69A" />

              {/* Subtle Signal Motion Packet: Build to Production (respects prefers-reduced-motion) */}
              <circle className="motion-reduce:hidden" r="3.5" fill="#83B69A">
                <animateMotion
                  path="M 730,320 C 790,320 815,365 875,365"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </circle>

              {/* =========================================================
                  STAGE 01: SOURCE — THE REPOSITORY MODULE (Upper Left)
                  ========================================================= */}
              <g id="scene-source">
                {/* Stage 1 Heading: Aligned above Source module (X = 70) */}
                <text x="70" y="48" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#A6AAA9" letterSpacing="0.12em">
                  01 / SOURCE
                </text>
                <text x="70" y="74" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="23" fontWeight="500" fill="#F1F0EC" letterSpacing="-0.02em">
                  my-project
                </text>
                <text x="70" y="96" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#777D7D">
                  main · 8f3a21c
                </text>

                {/* 30-Degree Isometric Repository Chassis Foundation */}
                <polygon
                  points="175,150 270,205 175,260 80,205"
                  fill="url(#iso-top-vol)"
                  stroke="#F1F0EC"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <polygon
                  points="80,205 175,260 175,310 80,255"
                  fill="url(#iso-left-vol)"
                  stroke="#F1F0EC"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <polygon
                  points="175,260 270,205 270,255 175,310"
                  fill="url(#iso-right-vol)"
                  stroke="#F1F0EC"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />

                {/* Recessed Top Bay */}
                <polygon
                  points="175,164 256,205 175,246 94,205"
                  fill="#0D0F11"
                  stroke="#A6AAA9"
                  strokeWidth="1.2"
                />

                {/* Front Panel Cooling Ventilation Micro-Slits */}
                <line x1="95" y1="222" x2="162" y2="260" stroke="#3D4245" strokeWidth="1.2" />
                <line x1="95" y1="232" x2="162" y2="270" stroke="#3D4245" strokeWidth="1.2" />
                <line x1="95" y1="242" x2="162" y2="280" stroke="#3D4245" strokeWidth="1.2" />

                {/* Precision Corner Screws */}
                <circle cx="94" cy="205" r="1.5" fill="#A6AAA9" />
                <circle cx="256" cy="205" r="1.5" fill="#A6AAA9" />
                <circle cx="175" cy="246" r="1.5" fill="#A6AAA9" />
                <circle cx="175" cy="164" r="1.5" fill="#A6AAA9" />

                {/* Main Branch Bus Circuit */}
                <path d="M 115,205 L 155,195 L 195,185 L 270,205" stroke="#D88762" strokeWidth="1.6" fill="none" />
                
                {/* Commit Pads */}
                <circle cx="115" cy="205" r="3.5" fill="#121416" stroke="#A6AAA9" strokeWidth="1.2" />
                <circle cx="155" cy="195" r="4" fill="#121416" stroke="#D88762" strokeWidth="1.4" />
                
                {/* HEAD Commit Node with Subtle Halo */}
                <circle cx="195" cy="185" r="5.5" fill="#D88762" stroke="#F1F0EC" strokeWidth="1.8" />
                <circle cx="195" cy="185" r="9.5" stroke="#D88762" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2 2" fill="none" />

                {/* Output Coupling Flange at Chassis Vertex (270, 205) */}
                <ellipse cx="270" cy="205" rx="4.5" ry="7" fill="#1A1D20" stroke="#F1F0EC" strokeWidth="1.8" />
                <circle cx="270" cy="205" r="2.5" fill="#D88762" />

                {/* HEAD & Commit Metadata Annotation (Positioned Cleanly Outside Geometry) */}
                <text x="195" y="130" textAnchor="middle" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="11" fontWeight="600" fill="#F1F0EC" letterSpacing="0.06em">
                  HEAD
                </text>
                <text x="195" y="145" textAnchor="middle" fontFamily="var(--font-geist-mono), monospace" fontSize="9.5" fill="#A6AAA9" letterSpacing="0.04em">
                  COMMIT 8F3A21C
                </text>
                <line x1="195" y1="151" x2="195" y2="172" stroke="#45494B" strokeWidth="1" />
              </g>

              {/* =========================================================
                  STAGE 02: BUILD ENGINE — JETWAY BUILD CORE (Monumental Anchor)
                  ========================================================= */}
              <g id="scene-build">
                {/* Stage 2 Heading: Centered above Build Core (X = 590) */}
                <text x="590" y="75" textAnchor="middle" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#D88762" letterSpacing="0.12em">
                  02 / BUILD ENGINE
                </text>
                <text x="590" y="102" textAnchor="middle" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="25" fontWeight="500" fill="#F1F0EC" letterSpacing="-0.02em">
                  Jetway Build Core
                </text>
                <text x="590" y="124" textAnchor="middle" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#777D7D">
                  Hermetic container pipeline
                </text>

                {/* Base Level: Substructure Foundation Platform (30° Isometric) */}
                <polygon
                  points="590,240 730,320 590,400 450,320"
                  fill="url(#iso-top-vol)"
                  stroke="#F1F0EC"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <polygon
                  points="450,320 590,400 590,445 450,365"
                  fill="url(#iso-left-vol)"
                  stroke="#F1F0EC"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <polygon
                  points="590,400 730,320 730,365 590,445"
                  fill="url(#iso-right-vol)"
                  stroke="#F1F0EC"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />

                {/* Substructure Cooling Ventilation Micro-Fins */}
                <line x1="476" y1="342" x2="476" y2="378" stroke="#3D4245" strokeWidth="1.2" />
                <line x1="506" y1="358" x2="506" y2="395" stroke="#3D4245" strokeWidth="1.2" />
                <line x1="536" y1="375" x2="536" y2="412" stroke="#3D4245" strokeWidth="1.2" />
                <line x1="644" y1="375" x2="644" y2="412" stroke="#3D4245" strokeWidth="1.2" />
                <line x1="674" y1="358" x2="674" y2="395" stroke="#3D4245" strokeWidth="1.2" />
                <line x1="704" y1="342" x2="704" y2="378" stroke="#3D4245" strokeWidth="1.2" />

                {/* Mid Level: Upper Integrated Core Plinth (No awkward detached lines) */}
                <polygon
                  points="590,215 680,267 590,319 500,267"
                  fill="url(#iso-top-vol)"
                  stroke="#F1F0EC"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <polygon
                  points="500,267 590,319 590,354 500,302"
                  fill="url(#iso-left-vol)"
                  stroke="#A6AAA9"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <polygon
                  points="590,319 680,267 680,302 590,354"
                  fill="url(#iso-right-vol)"
                  stroke="#A6AAA9"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />

                {/* Core Level: Active Burnt-Orange Central Processor Nucleus */}
                <polygon
                  points="590,235 645,267 590,299 535,267"
                  fill="url(#core-glow-vol)"
                  stroke="#D88762"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <line x1="560" y1="267" x2="620" y2="267" stroke="#D88762" strokeWidth="1.2" />
                <line x1="590" y1="250" x2="590" y2="284" stroke="#D88762" strokeWidth="1.2" />
                <circle cx="590" cy="267" r="3" fill="#D88762" />

                {/* Internal Pipeline Trace (Connecting Left Flange -> Core -> Right Flange) */}
                <path d="M 450,320 L 535,267 L 645,267 L 730,320" stroke="#D88762" strokeWidth="1.4" strokeDasharray="2.5 2.5" fill="none" />

                {/* Flange Couplings at Platform Vertices */}
                <circle cx="450" cy="320" r="5.5" fill="#121416" stroke="#F1F0EC" strokeWidth="1.8" />
                <circle cx="450" cy="320" r="2.5" fill="#D88762" />
                
                <circle cx="730" cy="320" r="5.5" fill="#121416" stroke="#F1F0EC" strokeWidth="1.8" />
                <circle cx="730" cy="320" r="2.5" fill="#83B69A" />

                {/* =====================================================
                    BUILD ENGINE TELEMETRY SEQUENCE (Docked Directly Beneath)
                    ===================================================== */}
                <g id="build-timing-list">
                  {/* Step 1: Dependencies resolved */}
                  <g>
                    <circle cx="450" cy="471" r="3" fill="#121416" stroke="#83B69A" strokeWidth="1.6" />
                    <text x="466" y="475" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#F1F0EC">
                      Dependencies resolved
                    </text>
                    <text x="730" y="475" textAnchor="end" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#A6AAA9">
                      1.1s
                    </text>
                  </g>

                  {/* Step 2: Application compiled (Active Highlighted Step) */}
                  <g>
                    <circle cx="450" cy="498" r="3" fill="#D88762" stroke="#D88762" strokeWidth="1.6" />
                    <text x="466" y="502" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#F1F0EC">
                      Application compiled
                    </text>
                    <text x="730" y="502" textAnchor="end" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#D88762">
                      2.4s
                    </text>
                  </g>

                  {/* Step 3: Release prepared */}
                  <g>
                    <circle cx="450" cy="525" r="3" fill="#121416" stroke="#83B69A" strokeWidth="1.6" />
                    <text x="466" y="529" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#F1F0EC">
                      Release prepared
                    </text>
                    <text x="730" y="529" textAnchor="end" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#A6AAA9">
                      0.6s
                    </text>
                  </g>
                </g>
              </g>

              {/* =========================================================
                  STAGE 03: PRODUCTION — LIVE APPLICATION & ISOMETRIC BASE
                  ========================================================= */}
              <g id="scene-production">
                {/* Stage 3 Heading: Aligned above Production illustration (X = 875) */}
                <text x="875" y="195" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#83B69A" letterSpacing="0.12em">
                  03 / PRODUCTION
                </text>
                <text x="875" y="222" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="23" fontWeight="500" fill="#F1F0EC" letterSpacing="-0.02em">
                  my-project.jetway.app
                </text>
                <text x="875" y="244" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#777D7D">
                  Live endpoint · Anycast Edge
                </text>

                {/* Preserved Isometric Geometric Base Underneath Production Browser */}
                <polygon
                  points="1000,420 1135,470 1000,520 865,470"
                  fill="url(#iso-top-vol)"
                  stroke="#A6AAA9"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <polygon
                  points="865,470 1000,520 1000,542 865,492"
                  fill="url(#iso-left-vol)"
                  stroke="#A6AAA9"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <polygon
                  points="1000,520 1135,470 1135,492 1000,542"
                  fill="url(#iso-right-vol)"
                  stroke="#A6AAA9"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />

                {/* Upright Front-Facing Application Viewport Glass Display */}
                {/* Top Depth Face */}
                <polygon
                  points="875,270 888,260 1138,260 1125,270"
                  fill="#24282B"
                  stroke="#A6AAA9"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                {/* Right Depth Face */}
                <polygon
                  points="1125,270 1138,260 1138,430 1125,440"
                  fill="#0D0F11"
                  stroke="#A6AAA9"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                {/* Front Window Face */}
                <rect
                  x="875"
                  y="270"
                  width="250"
                  height="170"
                  rx="4"
                  fill="url(#iso-top-vol)"
                  stroke="#F1F0EC"
                  strokeWidth="1.8"
                />

                {/* Window Header Bar */}
                <line x1="875" y1="304" x2="1125" y2="304" stroke="#343A3D" strokeWidth="1.2" />

                {/* Window Control Dots */}
                <circle cx="890" cy="287" r="2.5" fill="#A6AAA9" />
                <circle cx="900" cy="287" r="2.5" fill="#A6AAA9" />
                <circle cx="910" cy="287" r="2.5" fill="#A6AAA9" />

                {/* Recessed Horizontal URL Address Bar */}
                <rect
                  x="926"
                  y="278"
                  width="188"
                  height="20"
                  rx="3"
                  fill="#0F1113"
                  stroke="#343A3D"
                  strokeWidth="1"
                />
                {/* Green TLS Lock Indicator Dot */}
                <circle cx="939" cy="288" r="2.5" fill="#83B69A" />
                {/* Deployed Domain Text */}
                <text x="949" y="292" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#F1F0EC">
                  my-project.jetway.app
                </text>

                {/* Interface Content: Clean, Purposeful Minimal Elements */}
                <line x1="892" y1="324" x2="956" y2="324" stroke="#F1F0EC" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="892" y1="337" x2="936" y2="337" stroke="#45494B" strokeWidth="1.5" strokeLinecap="round" />

                {/* Content Cards */}
                <rect
                  x="892"
                  y="352"
                  width="108"
                  height="42"
                  rx="3"
                  fill="#16191C"
                  stroke="#303438"
                  strokeWidth="1"
                />
                <line x1="904" y1="367" x2="948" y2="367" stroke="#F1F0EC" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="904" y1="379" x2="972" y2="379" stroke="#45494B" strokeWidth="1.2" strokeLinecap="round" />

                <rect
                  x="1010"
                  y="352"
                  width="103"
                  height="42"
                  rx="3"
                  fill="#16191C"
                  stroke="#303438"
                  strokeWidth="1"
                />
                <line x1="1022" y1="367" x2="1066" y2="367" stroke="#F1F0EC" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="1022" y1="379" x2="1088" y2="379" stroke="#45494B" strokeWidth="1.2" strokeLinecap="round" />

                {/* Live Status Strip with Unified Horizontal Baseline */}
                <rect
                  x="892"
                  y="405"
                  width="221"
                  height="22"
                  rx="3"
                  fill="#0F1813"
                  stroke="#83B69A"
                  strokeWidth="1"
                />
                <circle cx="906" cy="416" r="3" fill="#83B69A" />
                <circle cx="906" cy="416" r="6" stroke="#83B69A" strokeOpacity="0.4" strokeWidth="1" fill="none" />
                
                <text x="918" y="419" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#83B69A" fontWeight="600" letterSpacing="0.08em">
                  LIVE
                </text>
                <text x="950" y="419" fontFamily="var(--font-geist-mono), monospace" fontSize="9.5" fill="#F1F0EC">
                  · TLS ACTIVE
                </text>
                <text x="1032" y="419" fontFamily="var(--font-geist-mono), monospace" fontSize="9.5" fill="#A6AAA9">
                  · ANYCAST
                </text>

                {/* Destination Intake Flange (Receives Leg 2 Conduit at 875, 365) */}
                <circle cx="875" cy="365" r="5.5" fill="#121416" stroke="#83B69A" strokeWidth="1.8" />
                <circle cx="875" cy="365" r="2.5" fill="#83B69A" />
              </g>

            </svg>
          </div>

          {/* -------------------------------------------------------------
              MOBILE / TABLET SCENE: Vertical Reflow Architecture
              Continuous vertical deployment pipeline with crisp legibility
              ------------------------------------------------------------- */}
          <div className="lg:hidden w-full max-w-[460px] mx-auto relative">
            <svg
              className="w-full h-auto select-none overflow-visible"
              viewBox="0 0 380 720"
              preserveAspectRatio="xMidYMid meet"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Vertical technical diagram illustrating code deployment journey"
            >
              <defs>
                <linearGradient
                  id="mobile-vert-gradient"
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

              {/* Continuous Vertical Route */}
              <path
                d="M 36,95 L 36,260 L 36,440 L 36,585"
                stroke="#3D4245"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                fill="none"
              />
              <path
                d="M 36,95 L 36,260 L 36,440 L 36,585"
                stroke="url(#mobile-vert-gradient)"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />

              {/* Mobile Motion Signal (respects prefers-reduced-motion) */}
              <circle className="motion-reduce:hidden" r="3.5" fill="#D88762">
                <animateMotion
                  path="M 36,95 L 36,260 L 36,440 L 36,585"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </circle>

              {/* STAGE 1: SOURCE */}
              <g transform="translate(26, 20)">
                <circle cx="10" cy="75" r="5" fill="#D88762" stroke="#F1F0EC" strokeWidth="1.5" />
                <text x="35" y="32" fontFamily="var(--font-geist-mono), monospace" fontSize="10.5" fill="#A6AAA9" letterSpacing="0.1em">
                  01 / SOURCE
                </text>
                <text x="35" y="56" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="21" fontWeight="500" fill="#F1F0EC">
                  my-project
                </text>
                <text x="35" y="78" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#777D7D">
                  main · 8f3a21c
                </text>
                <text x="35" y="98" fontFamily="var(--font-geist-mono), monospace" fontSize="10.5" fill="#D88762">
                  HEAD · COMMIT 8F3A21C
                </text>
              </g>

              {/* STAGE 2: BUILD ENGINE */}
              <g transform="translate(26, 240)">
                <circle cx="10" cy="20" r="5" fill="#D88762" />
                <text x="35" y="10" fontFamily="var(--font-geist-mono), monospace" fontSize="10.5" fill="#D88762" letterSpacing="0.1em">
                  02 / BUILD ENGINE
                </text>
                <text x="35" y="34" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="21" fontWeight="500" fill="#F1F0EC">
                  Jetway Build Core
                </text>
                <text x="35" y="54" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#777D7D">
                  Hermetic container pipeline
                </text>
                
                {/* Build Steps */}
                <g transform="translate(35, 74)">
                  <g transform="translate(0, 0)">
                    <circle cx="5" cy="6" r="3" fill="#121416" stroke="#83B69A" strokeWidth="1.5" />
                    <text x="18" y="10" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#F1F0EC">
                      Dependencies resolved
                    </text>
                    <text x="235" y="10" textAnchor="end" fontFamily="var(--font-geist-mono), monospace" fontSize="11.5" fill="#A6AAA9">
                      1.1s
                    </text>
                  </g>
                  <g transform="translate(0, 28)">
                    <circle cx="5" cy="6" r="3" fill="#D88762" stroke="#D88762" strokeWidth="1.5" />
                    <text x="18" y="10" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#F1F0EC">
                      Application compiled
                    </text>
                    <text x="235" y="10" textAnchor="end" fontFamily="var(--font-geist-mono), monospace" fontSize="11.5" fill="#D88762">
                      2.4s
                    </text>
                  </g>
                  <g transform="translate(0, 56)">
                    <circle cx="5" cy="6" r="3" fill="#121416" stroke="#83B69A" strokeWidth="1.5" />
                    <text x="18" y="10" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#F1F0EC">
                      Release prepared
                    </text>
                    <text x="235" y="10" textAnchor="end" fontFamily="var(--font-geist-mono), monospace" fontSize="11.5" fill="#A6AAA9">
                      0.6s
                    </text>
                  </g>
                </g>
              </g>

              {/* STAGE 3: PRODUCTION */}
              <g transform="translate(26, 510)">
                <circle cx="10" cy="75" r="5" fill="#83B69A" stroke="#F1F0EC" strokeWidth="1.5" />
                <text x="35" y="24" fontFamily="var(--font-geist-mono), monospace" fontSize="10.5" fill="#83B69A" letterSpacing="0.1em">
                  03 / PRODUCTION
                </text>
                <text x="35" y="48" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="21" fontWeight="500" fill="#F1F0EC">
                  my-project.jetway.app
                </text>
                <text x="35" y="70" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fill="#777D7D">
                  Live endpoint · Anycast Edge
                </text>
                <text x="35" y="94" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#83B69A" fontWeight="500">
                  ● LIVE · TLS ACTIVE · ANYCAST
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
