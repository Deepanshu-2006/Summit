"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";

interface HeroMountainIllustrationProps {
  activeStage: "source" | "build" | "production";
  animPhase: "source" | "packet1" | "building" | "packet2" | "production";
  isReducedMotion: boolean;
}

/**
 * HeroMountainIllustration
 *
 * Full-Viewport, Infinitely Living Monochromatic Mountain Landscape:
 *
 * 1. Full-Viewport, Full-Bleed Composition:
 *    - Fills the complete available height beneath the navbar and spans edge-to-edge.
 *    - Left Region: Distant, low-contrast mountain contours emerge quietly from darkness,
 *      maintaining 100% legibility and contrast for the headline, copy, and CTAs.
 *    - Center Region: Overlapping midground mountain passes and valley mist creating depth
 *      and a seamless spatial bridge.
 *    - Right Region: Towering copperplate peaks with sculptural arête ridges, detailed
 *      cross-hatching, and stippling framing the deployment interface.
 *    - Lower Region: Valley contours naturally extend to the bottom edge without artificial cutoffs.
 *    - Completely seamless: zero rectangular image bounds, 100% integrated with #111111.
 *
 * 2. Four Coordinated Continuous Living Animation Layers:
 *    A. Atmospheric Clouds (Continuous Unidirectional Drift & Depth Parallax):
 *       - Dual-phase conveyor ribbon drifting continuously westward across the valley (80s linear infinite)
 *         with zero reversal, plus staggered 3D depth swell (36s) and ravine orbital mist (72s).
 *    B. Travelling Ambient Light (Slow, Atmospheric Ridge Illumination):
 *       - A broad, soft illumination field (58s continuous cycle) slowly gliding across the terrain,
 *         subtly revealing ridge contours and delicate linework before gently subsiding.
 *    C. Contour Highlights & Currents (Delicate Linework Movement):
 *       - Seamlessly flowing elevation currents (stroke-dash flow at 60s & 75s) and slow-breathing
 *         ridge pulses (26s) that keep the environment alive while preserving mountain geometry.
 *    D. Barely Perceptible Depth Parallax:
 *       - Multi-plane depth with inertia damping (disabled on prefers-reduced-motion).
 *
 * 3. Deployment Telemetry Synchronization:
 *    - Harmonic contour echoes illuminate burnt-orange (#D88762) during Build Engine compiling
 *      and sage-green (#83B69A) when Production is running.
 */
export function HeroMountainIllustration({
  activeStage,
  animPhase,
  isReducedMotion,
}: HeroMountainIllustrationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

  // Smooth pointer parallax tracking with inertia
  useEffect(() => {
    if (isReducedMotion) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let rafId: number | null = null;

    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    const onMouseLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    const animate = () => {
      currentX += (targetX - currentX) * 0.04;
      currentY += (targetY - currentY) * 0.04;

      setMouseOffset({
        x: Math.round(currentX * 100) / 100,
        y: Math.round(currentY * 100) / 100,
      });

      rafId = requestAnimationFrame(animate);
    };

    const el = containerRef.current;
    if (el) {
      window.addEventListener("mousemove", onMouseMove, { passive: true });
      el.addEventListener("mouseleave", onMouseLeave);
      rafId = requestAnimationFrame(animate);
    }

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      if (el) el.removeEventListener("mouseleave", onMouseLeave);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isReducedMotion]);

  // Deployment pulse states
  const isBuildActive =
    animPhase === "packet1" || animPhase === "building" || activeStage === "build";
  const isProductionActive =
    animPhase === "packet2" || animPhase === "production" || activeStage === "production";

  // Differentiated parallax offsets per visual plane (barely perceptible, structurally stable)
  const mountainShiftX = isReducedMotion ? 0 : mouseOffset.x * 5;
  const mountainShiftY = isReducedMotion ? 0 : mouseOffset.y * 3;

  const mistShiftX = isReducedMotion ? 0 : mouseOffset.x * 10;
  const mistShiftY = isReducedMotion ? 0 : mouseOffset.y * 6;

  const vectorShiftX = isReducedMotion ? 0 : mouseOffset.x * 15;
  const vectorShiftY = isReducedMotion ? 0 : mouseOffset.y * 8;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0"
      aria-hidden="true"
    >
      {/* =================================================================
          LAYER 1: ATMOSPHERIC HORIZON RADIANT BASE
          Ultra-gentle warm radiance echoing through the central saddle pass
          ================================================================= */}
      <div
        className="absolute inset-0 w-full h-full pointer-events-none opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 65% 50%, rgba(216, 135, 98, 0.06) 0%, rgba(216, 135, 98, 0.02) 45%, transparent 75%)",
        }}
      />

      {/* =================================================================
          LAYER 2: FULL-BLEED PANORAMIC ENGRAVED MOUNTAIN TOPOGRAPHY
          Edge-to-edge antique copperplate / computational alpine environment:
          - Left: Distant low-contrast contours emerging from darkness
          - Center: Midground saddle ridges & atmospheric depth
          - Right: Sharp, towering sculptural peaks framing deployment runway
          - Scaled proportionally (scale 1.05) to eliminate any visible rectangular borders
          ================================================================= */}
      <div
        className="absolute inset-0 w-full h-full will-change-transform transition-transform duration-100 ease-out"
        style={{
          transform: `translate3d(${mountainShiftX}px, ${mountainShiftY}px, 0)`,
        }}
      >
        <div className="relative w-full h-full">
          <Image
            src="/images/hero/hero-engraved-mountains-fullbleed.webp"
            alt=""
            fill
            priority
            quality={75}
            sizes="100vw"
            className="w-full h-full object-cover object-[center_60%] lg:object-[center_55%] block opacity-95 scale-[1.05]"
          />
        </div>
      </div>

      {/* =================================================================
          LAYER 3: TRAVELLING ATMOSPHERIC AMBIENT LIGHT (Layer B - 58s Continuous Loop)
          Slow-moving ambient illumination travelling gently across the mountain
          range, softly revealing ridge contours and subsiding without harsh spotlights
          ================================================================= */}
      {!isReducedMotion && (
        <div
          className="absolute inset-0 w-full h-full pointer-events-none animate-[terrainLightSweep_58s_easeInOut_infinite] will-change-transform"
          style={{
            background:
              "radial-gradient(ellipse 75% 55% at 50% 45%, rgba(242, 240, 235, 0.08) 0%, rgba(216, 135, 98, 0.04) 40%, transparent 75%)",
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* =================================================================
          LAYER 4: SEAMLESS LIVING VOLUMETRIC VALLEY CLOUDS (Layer A)
          Continuous horizontal drift conveyor + depth swell:
          - Infinite conveyor track (0% to -50% loop) with zero direction reversal
          - Secondary orbital ravine mist and upper ridge veil
          ================================================================= */}
      <div
        className="absolute inset-0 w-full h-full will-change-transform pointer-events-none"
        style={{
          transform: `translate3d(${mistShiftX}px, ${mistShiftY}px, 0)`,
        }}
      >
        {/* Continuous Horizontal Conveyor: Infinite Westward Cloud Drift (80s loop) */}
        {!isReducedMotion && (
          <div className="absolute top-[28%] left-0 w-[200%] h-[240px] flex pointer-events-none animate-[cloudConveyorWest_80s_linear_infinite]">
            {/* Ribbon Half 1 */}
            <div className="w-1/2 h-full relative flex items-center">
              <div
                className="absolute left-[20%] w-[580px] h-[190px] rounded-full opacity-25 animate-[cloudDepthSwell_36s_easeInOut_infinite]"
                style={{
                  background:
                    "radial-gradient(ellipse 65% 45% at 50% 50%, rgba(242, 240, 235, 0.10) 0%, rgba(142, 140, 134, 0.06) 35%, rgba(28, 27, 25, 0.03) 65%, transparent 85%)",
                  filter: "blur(28px)",
                }}
              />
              <div
                className="absolute left-[62%] w-[480px] h-[170px] rounded-full opacity-22 animate-[cloudDepthSwell_44s_easeInOut_infinite]"
                style={{
                  background:
                    "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(216, 135, 98, 0.07) 0%, rgba(142, 140, 134, 0.05) 40%, transparent 80%)",
                  filter: "blur(26px)",
                }}
              />
            </div>
            {/* Ribbon Half 2 (Exact Duplicate for Seamless 0%->-50% Loop) */}
            <div className="w-1/2 h-full relative flex items-center">
              <div
                className="absolute left-[20%] w-[580px] h-[190px] rounded-full opacity-25 animate-[cloudDepthSwell_36s_easeInOut_infinite]"
                style={{
                  background:
                    "radial-gradient(ellipse 65% 45% at 50% 50%, rgba(242, 240, 235, 0.10) 0%, rgba(142, 140, 134, 0.06) 35%, rgba(28, 27, 25, 0.03) 65%, transparent 85%)",
                  filter: "blur(28px)",
                }}
              />
              <div
                className="absolute left-[62%] w-[480px] h-[170px] rounded-full opacity-22 animate-[cloudDepthSwell_44s_easeInOut_infinite]"
                style={{
                  background:
                    "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(216, 135, 98, 0.07) 0%, rgba(142, 140, 134, 0.05) 40%, transparent 80%)",
                  filter: "blur(26px)",
                }}
              />
            </div>
          </div>
        )}

        {/* Cloud Ribbon: Center-Right Ravine Pass (drifts through midground ravine, 72s loop) */}
        <div
          className={`absolute right-[8vw] sm:right-[16vw] top-[48%] sm:top-[44%] w-[380px] sm:w-[520px] lg:w-[640px] h-[180px] sm:h-[230px] rounded-full pointer-events-none ${
            isReducedMotion ? "opacity-22" : "animate-[mistOrbitalB_72s_easeInOut_infinite]"
          }`}
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(216, 135, 98, 0.07) 0%, rgba(142, 140, 134, 0.06) 40%, rgba(28, 27, 25, 0.03) 70%, transparent 85%)",
            filter: "blur(28px)",
          }}
        />

        {/* Cloud Ribbon: Upper High Ridge Wisp (subtle veil near right peak shoulder, 94s loop) */}
        <div
          className={`absolute right-[2vw] sm:right-[6vw] top-[16%] sm:top-[14%] w-[320px] sm:w-[440px] lg:w-[540px] h-[150px] sm:h-[200px] rounded-full pointer-events-none ${
            isReducedMotion ? "opacity-18" : "animate-[mistOrbitalC_94s_easeInOut_infinite]"
          }`}
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(242, 240, 235, 0.09) 0%, rgba(142, 140, 134, 0.05) 45%, transparent 80%)",
            filter: "blur(24px)",
          }}
        />

        {/* Cloud Ribbon: Sub-Stratosphere High Veil (drifts softly behind navbar, 110s loop) */}
        <div
          className={`absolute left-[30vw] sm:left-[38vw] top-[3%] sm:top-[4%] w-[420px] sm:w-[600px] h-[110px] sm:h-[140px] rounded-full pointer-events-none ${
            isReducedMotion ? "opacity-12" : "animate-[mistOrbitalA_110s_easeInOut_infinite]"
          }`}
          style={{
            background:
              "radial-gradient(ellipse 65% 35% at 50% 50%, rgba(242, 240, 235, 0.065) 0%, rgba(216, 135, 98, 0.025) 40%, transparent 80%)",
            filter: "blur(22px)",
          }}
        />
      </div>

      {/* =================================================================
          LAYER 5: PANORAMIC TOPOGRAPHIC SURVEY CONTOURS & DELICATE CURRENTS (Layer C)
          Precision vector elevation contours with continuous 60s flowing currents,
          subtle ridge breathing pulses, and geodesic benchmarks spanning 0% to 100%
          ================================================================= */}
      <svg
        viewBox="0 0 1440 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full pointer-events-none will-change-transform"
        style={{
          transform: `translate3d(${vectorShiftX}px, ${vectorShiftY}px, 0)`,
        }}
        aria-hidden="true"
      >
        <defs>
          <filter id="topographicGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* --- Left Flank: Distant Low-Contrast Contours (Flowing subtly beneath typography) --- */}
        <path
          d="M 0 540 C 160 520, 320 560, 480 500 S 680 480, 840 460"
          stroke="#383532"
          strokeWidth="0.75"
          strokeDasharray="4 16"
          className="opacity-30 animate-[contourCurrent_60s_linear_infinite]"
        />
        <path
          d="M 0 660 C 140 640, 300 680, 460 630 S 660 610, 800 590"
          stroke="#262422"
          strokeWidth="0.75"
          strokeDasharray="3 17"
          className="opacity-25 animate-[contourCurrent_75s_linear_infinite]"
        />

        {/* --- Center Saddle: Connecting Harmonic Elevation Curves --- */}
        <path
          d="M 460 490 C 580 470, 740 440, 880 390 S 1060 320, 1220 280"
          stroke={isBuildActive ? "#D88762" : "#383532"}
          strokeWidth={isBuildActive ? "1.25" : "0.75"}
          strokeDasharray={isBuildActive ? "none" : "3 13"}
          opacity={isBuildActive ? "0.65" : "0.35"}
          filter={isBuildActive ? "url(#topographicGlow)" : "none"}
          className="transition-all duration-500 animate-[contourCurrent_50s_linear_infinite]"
        />

        {/* --- High Crest: Delicate Breathing Ridge Pulse (26s loop, stable geometry) --- */}
        <path
          d="M 880 260 C 980 230, 1100 200, 1240 180 S 1360 210, 1440 230"
          strokeWidth="0.85"
          strokeDasharray="5 15"
          className="animate-[ridgePulse_26s_easeInOut_infinite] animate-[contourCurrent_65s_linear_infinite]"
        />

        {/* --- Right Flank: Grounding Arête Contours Framing Deployment Interface --- */}
        <path
          d="M 720 450 C 820 420, 930 460, 1050 430 S 1230 450, 1380 470"
          stroke={isProductionActive ? "#83B69A" : isBuildActive ? "#D88762" : "#302D2A"}
          strokeWidth={isProductionActive || isBuildActive ? "1.25" : "0.75"}
          strokeDasharray={isProductionActive || isBuildActive ? "none" : "2 6"}
          opacity={isProductionActive ? "0.65" : isBuildActive ? "0.45" : "0.25"}
          filter={isProductionActive ? "url(#topographicGlow)" : "none"}
          className="transition-all duration-500"
        />

        {/* --- Cartographic Geodesic Benchmarks --- */}
        {/* Benchmark 01: Left Saddle Pass */}
        <g transform="translate(380, 500)" className="opacity-35">
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

        {/* Benchmark 02: Center Build Approach */}
        <g transform="translate(800, 240)" className="opacity-45">
          <circle cx="0" cy="0" r="2.5" fill="#D88762" />
          <line x1="-7" y1="0" x2="-3.5" y2="0" stroke="#8E8C86" strokeWidth="0.75" />
          <line x1="3.5" y1="0" x2="7" y2="0" stroke="#8E8C86" strokeWidth="0.75" />
          <line x1="0" y1="-7" x2="0" y2="-3.5" stroke="#8E8C86" strokeWidth="0.75" />
          <line x1="0" y1="3.5" x2="0" y2="7" stroke="#8E8C86" strokeWidth="0.75" />
          <text
            x="11"
            y="3.5"
            fill="#8E8C86"
            fontSize="9"
            fontFamily="var(--font-geist-mono)"
            letterSpacing="0.12em"
          >
            STN-02 // ELEV 2,840M
          </text>
        </g>

        {/* Benchmark 03: Right Peak Crest */}
        <g transform="translate(1240, 160)" className="opacity-40">
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

        {/* Benchmark 04: Production Edge Region */}
        <g transform="translate(1140, 620)" className="opacity-45">
          <circle
            cx="0"
            cy="0"
            r="2.5"
            fill={isProductionActive ? "#83B69A" : "#8E8C86"}
            className="transition-colors duration-500"
          />
          <line x1="-7" y1="0" x2="7" y2="0" stroke="#8E8C86" strokeWidth="0.75" />
          <line x1="0" y1="-7" x2="0" y2="7" stroke="#8E8C86" strokeWidth="0.75" />
          <text
            x="12"
            y="3.5"
            fill={isProductionActive ? "#83B69A" : "#8E8C86"}
            fontSize="8.5"
            fontFamily="var(--font-geist-mono)"
            letterSpacing="0.12em"
            className="transition-colors duration-500"
          >
            EDGE NODE // REGION 03
          </text>
        </g>
      </svg>

      {/* =================================================================
          LAYER 6: CONTENT CONTRAST GUARD
          A gentle, broad shadow behind the left typography column ensuring 100%
          text contrast against the mountain backdrop without creating a visible box
          ================================================================= */}
      <div
        className="absolute left-0 top-0 w-full sm:w-[55vw] lg:w-[48vw] h-full pointer-events-none opacity-35"
        style={{
          background:
            "radial-gradient(ellipse 75% 65% at 25% 42%, rgba(17, 17, 17, 0.70) 0%, rgba(17, 17, 17, 0.25) 60%, transparent 100%)",
        }}
      />
    </div>
  );
}

export default HeroMountainIllustration;
