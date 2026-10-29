"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { HeroMountainClouds } from "./hero-mountain-clouds";
import { HeroTerrainWake } from "./hero-terrain-wake";

interface HeroMountainIllustrationProps {
  activeStage?: "source" | "build" | "production";
  animPhase?: "source" | "packet1" | "building" | "packet2" | "production";
  isReducedMotion: boolean;
  isInView?: boolean;
}

/**
 * HeroMountainIllustration
 *
 * Full-Viewport, Infinitely Living Monochromatic Mountain Landscape:
 *
 * 1. Full-Screen Mountain Background:
 *    - Signature antique copperplate alpine artwork (hero-engraved-mountains-fullbleed.webp).
 *    - Balanced composition: darker mountain terrain and negative space on the text flank (left),
 *      soaring summit peaks on the right.
 *    - Stably anchored: sharp engraved character at all times.
 *
 * 2. Travelling Mountain Ridge Illumination (Ambient 54s Loop):
 *    - Soft, wide illumination travelling gradually across the high mountain ridges.
 *    - Warm ivory with restrained burnt-orange undertone, subtly revealing contour relief.
 *
 * 3. Living Atmospheric Valley Clouds (HeroMountainClouds):
 *    - 3 independent procedural mist layers (background peak haze, midground pass mist, foreground wisps).
 *    - Softened opacity behind the headline to maintain effortless text contrast.
 *
 * 4. Signature Terrain Wake (HeroTerrainWake):
 *    - Ephemeral topographic wake from pointer movement, dissipating naturally.
 *
 * 5. Clean Cartographic Elevation Contours:
 *    - Precision SVG elevation contours in restrained monochrome charcoal.
 *    - No duplicate connector lines, no glowing circuit overlays.
 */
export function HeroMountainIllustration({
  isReducedMotion,
  isInView = true,
}: HeroMountainIllustrationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0"
      aria-hidden="true"
    >
      {/* =================================================================
          LAYER 1: ATMOSPHERIC SADDLE RADIANT BASE
          Ultra-gentle warm radiance echoing through the central pass
          ================================================================= */}
      <div
        className="absolute inset-0 w-full h-full pointer-events-none opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 65% 50%, rgba(216, 135, 98, 0.05) 0%, rgba(216, 135, 98, 0.015) 45%, transparent 75%)",
        }}
      />

      {/* =================================================================
          LAYER 2: FULL-BLEED PANORAMIC ENGRAVED MOUNTAIN TOPOGRAPHY
          Antique copperplate alpine artwork filling the hero edge-to-edge.
          Positioned so darker terrain sits behind headline on left, and
          bright, soaring alpine peaks command the right.
          ================================================================= */}
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <div className="relative w-full h-full">
          <Image
            src="/images/hero/hero-engraved-mountains-fullbleed.webp"
            alt=""
            fill
            priority
            quality={85}
            sizes="100vw"
            className="w-full h-full object-cover object-[70%_52%] sm:object-[68%_52%] lg:object-[64%_50%] block opacity-95"
          />
        </div>
      </div>

      {/* =================================================================
          LAYER 3: TRAVELLING MOUNTAIN RIDGE ILLUMINATION (Ambient 54s Loop)
          Slow-moving ambient illumination travelling gently across the mountain
          ridges, softly revealing ridge contours.
          Warm ivory with restrained burnt-orange undertone.
          ================================================================= */}
      {!isReducedMotion && (
        <div
          className="absolute inset-0 w-full h-full pointer-events-none animate-[ridgeIlluminationSweep_54s_easeInOut_infinite] will-change-transform"
          style={{
            background:
              "radial-gradient(ellipse 75% 55% at 54% 45%, rgba(247, 244, 238, 0.11) 0%, rgba(238, 225, 212, 0.07) 28%, rgba(216, 135, 98, 0.04) 52%, rgba(142, 140, 134, 0.012) 75%, transparent 95%)",
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* =================================================================
          LAYER 4: LIVING ATMOSPHERIC MOUNTAIN VALLEY CLOUDS (CANVAS)
          Multi-layer procedural mist moving continuously through the valleys.
          ================================================================= */}
      <HeroMountainClouds
        isInView={isInView}
        isReducedMotion={isReducedMotion}
      />

      {/* =================================================================
          LAYER 5: SIGNATURE TERRAIN WAKE (CANVAS)
          Delicate, flowing topographic strands created by cursor movement
          along its recent path, dissipating smoothly when stopped.
          ================================================================= */}
      <HeroTerrainWake
        isInView={isInView}
        isReducedMotion={isReducedMotion}
      />

      {/* =================================================================
          LAYER 6: CARTOGRAPHIC SURVEY CONTOURS & BENCHMARKS (STATIONARY SVG)
          Clean, stationary precision vector elevation contours in authentic
          monochrome charcoal. Free of circuit-like highlights or clutter.
          ================================================================= */}
      <svg
        viewBox="0 0 1440 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        {/* --- Left Flank: Distant Low-Contrast Contours (Flowing subtly beneath typography) --- */}
        <path
          d="M 0 540 C 160 520, 320 560, 480 500 S 680 480, 840 460"
          stroke="#383532"
          strokeWidth="0.75"
          strokeDasharray="4 16"
          className="opacity-25 animate-[contourCurrent_60s_linear_infinite]"
        />
        <path
          d="M 0 660 C 140 640, 300 680, 460 630 S 660 610, 800 590"
          stroke="#262422"
          strokeWidth="0.75"
          strokeDasharray="3 17"
          className="opacity-20 animate-[contourCurrent_75s_linear_infinite]"
        />

        {/* --- Center Saddle: Elevation Curve (Pure monochrome contour, no colored clutter) --- */}
        <path
          d="M 460 490 C 580 470, 740 440, 880 390 S 1060 320, 1220 280"
          stroke="#383532"
          strokeWidth="0.75"
          strokeDasharray="3 13"
          className="opacity-25 animate-[contourCurrent_50s_linear_infinite]"
        />

        {/* --- High Crest: Delicate Breathing Ridge Pulse (26s loop, stable geometry) --- */}
        <path
          d="M 880 260 C 980 230, 1100 200, 1240 180 S 1360 210, 1440 230"
          stroke="#383532"
          strokeWidth="0.85"
          strokeDasharray="5 15"
          className="opacity-25 animate-[ridgePulse_26s_easeInOut_infinite] animate-[contourCurrent_65s_linear_infinite]"
        />

        {/* --- Right Flank: Grounding Arête Contour (Pure monochrome, framing landscape) --- */}
        <path
          d="M 720 450 C 820 420, 930 460, 1050 430 S 1230 450, 1380 470"
          stroke="#302D2A"
          strokeWidth="0.75"
          strokeDasharray="2 6"
          className="opacity-20"
        />

        {/* --- Cartographic Geodesic Benchmarks --- */}
        {/* Benchmark 01: Left Saddle Pass */}
        <g transform="translate(380, 500)" className="opacity-30">
          <circle cx="0" cy="0" r="2" fill="#8E8C86" />
          <line x1="-5" y1="0" x2="5" y2="0" stroke="#777777" strokeWidth="0.7" />
          <line x1="0" y1="-5" x2="0" y2="5" stroke="#777777" strokeWidth="0.7" />
          <text
            x="8"
            y="3"
            fill="#777777"
            fontSize="8"
            fontFamily="var(--font-geist-mono)"
            letterSpacing="0.12em"
          >
            PASS-01 // ELEV 1,640M
          </text>
        </g>

        {/* Benchmark 02: Center Mountain Ridge Approach */}
        <g transform="translate(800, 240)" className="opacity-35">
          <circle cx="0" cy="0" r="2" fill="#8E8C86" />
          <line x1="-6" y1="0" x2="-3" y2="0" stroke="#8E8C86" strokeWidth="0.7" />
          <line x1="3" y1="0" x2="6" y2="0" stroke="#8E8C86" strokeWidth="0.7" />
          <line x1="0" y1="-6" x2="0" y2="-3" stroke="#8E8C86" strokeWidth="0.7" />
          <line x1="0" y1="3" x2="0" y2="6" stroke="#8E8C86" strokeWidth="0.7" />
          <text
            x="10"
            y="3.5"
            fill="#8E8C86"
            fontSize="8.5"
            fontFamily="var(--font-geist-mono)"
            letterSpacing="0.12em"
          >
            STN-02 // ELEV 2,840M
          </text>
        </g>

        {/* Benchmark 03: Right Peak Crest */}
        <g transform="translate(1240, 160)" className="opacity-35">
          <circle cx="0" cy="0" r="2.5" fill="#F2F0EB" />
          <line x1="-6" y1="0" x2="6" y2="0" stroke="#777777" strokeWidth="0.75" />
          <line x1="0" y1="-6" x2="0" y2="6" stroke="#777777" strokeWidth="0.75" />
          <text
            x="10"
            y="3.5"
            fill="#777777"
            fontSize="8.5"
            fontFamily="var(--font-geist-mono)"
            letterSpacing="0.14em"
          >
            PEAK // 3,428M
          </text>
        </g>
      </svg>

      {/* =================================================================
          LAYER 7: CONTENT CONTRAST GUARD & BOTTOM VIGNETTE
          Gentle, broad atmospheric shadow behind the left typography column
          ensuring 100% text contrast without creating an obvious box,
          plus a smooth transparent-to-black fade at the bottom.
          ================================================================= */}
      <div
        className="absolute left-0 top-0 w-full sm:w-[60vw] lg:w-[52vw] h-full pointer-events-none opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 75% 70% at 20% 46%, rgba(17, 17, 17, 0.88) 0%, rgba(17, 17, 17, 0.45) 55%, transparent 100%)",
        }}
      />
      <div
        className="absolute left-0 top-0 w-[35vw] h-full pointer-events-none opacity-30 hidden lg:block"
        style={{
          background:
            "linear-gradient(to right, rgba(17, 17, 17, 0.75) 0%, rgba(17, 17, 17, 0.25) 50%, transparent 100%)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-full h-[120px] pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, transparent 0%, rgba(17, 17, 17, 0.8) 70%, #111111 100%)",
        }}
      />
    </div>
  );
}

export default HeroMountainIllustration;