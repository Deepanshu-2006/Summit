"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import { HeroMountainClouds } from "./hero-mountain-clouds";

interface HeroMountainIllustrationProps {
  activeStage: "source" | "build" | "production";
  animPhase: "source" | "packet1" | "building" | "packet2" | "production";
  isReducedMotion: boolean;
  isInView?: boolean;
}

/**
 * HeroMountainIllustration
 *
 * Full-Viewport, Infinitely Living Monochromatic Mountain Landscape:
 *
 * 1. Full-Bleed Engraved Mountain Topography:
 *    - The signature antique copperplate alpine artwork (hero-engraved-mountains-fullbleed.webp)
 *      forms the foundation of the hero.
 *    - Stationary foundation: No cursor-driven translation, tilt, scaling, or parallax.
 *
 * 2. Continuously Moving Atmospheric Mountain Clouds (HeroMountainClouds):
 *    - Layer A: Distant subtle mountain pass mist
 *    - Layer B: Main valley clouds continuously flowing through the central ravines (noticeable within seconds)
 *    - Layer C: Foreground diffuse slope mist creating depth
 *    - Seamless, infinite looping with zero resets and natural valley-following splines.
 *
 * 3. Atmospheric Illumination & Topographic Currents:
 *    - 58s slow ambient light sweep across the terrain.
 *    - Subtle cursor-following local illumination highlight (no displacement/parallax).
 *    - Stationary vector elevation contours with continuous flowing currents.
 */
export function HeroMountainIllustration({
  activeStage,
  animPhase,
  isReducedMotion,
  isInView = true,
}: HeroMountainIllustrationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorGlowRef = useRef<HTMLDivElement>(null);

  // Subtle cursor light interaction without ANY parallax / translation
  useEffect(() => {
    if (isReducedMotion) return;

    // Disable on touch devices
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches
    ) {
      return;
    }

    const container = containerRef.current;
    const glow = cursorGlowRef.current;
    if (!container || !glow) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let isInside = false;
    let rafId: number | null = null;

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      targetX = e.clientX - rect.left;
      targetY = e.clientY - rect.top;
      if (!isInside) {
        isInside = true;
        currentX = targetX;
        currentY = targetY;
        glow.style.opacity = "1";
      }
    };

    const onMouseLeave = () => {
      isInside = false;
      glow.style.opacity = "0";
    };

    const animate = () => {
      if (isInside) {
        currentX += (targetX - currentX) * 0.08;
        currentY += (targetY - currentY) * 0.08;
        glow.style.transform = `translate3d(${currentX - 250}px, ${
          currentY - 250
        }px, 0)`;
      }
      rafId = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    container.addEventListener("mouseleave", onMouseLeave);
    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isReducedMotion]);

  // Deployment pulse states
  const isBuildActive =
    animPhase === "packet1" ||
    animPhase === "building" ||
    activeStage === "build";
  const isProductionActive =
    animPhase === "packet2" ||
    animPhase === "production" ||
    activeStage === "production";

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
          Edge-to-edge antique copperplate alpine artwork:
          Stationary foundation layer (no cursor displacement or parallax).
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
            className="w-full h-full object-cover object-[center_60%] lg:object-[center_55%] block opacity-95 scale-[1.05]"
          />
        </div>
      </div>

      {/* =================================================================
          LAYER 3: TRAVELLING ATMOSPHERIC AMBIENT LIGHT (58s Continuous Loop)
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
          LAYER 4: SUBTLE CURSOR AMBIENT ILLUMINATION (NO PARALLAX)
          Cursor subtly influences local warm illumination without moving mountain
          artwork or cloud formations.
          ================================================================= */}
      {!isReducedMotion && (
        <div
          ref={cursorGlowRef}
          className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none opacity-0 transition-opacity duration-500 ease-out will-change-transform"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(216, 135, 98, 0.09) 0%, rgba(242, 240, 235, 0.04) 35%, transparent 70%)",
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* =================================================================
          LAYER 5: LIVING ATMOSPHERIC MOUNTAIN VALLEY CLOUDS (CANVAS)
          Dedicated multi-layer procedural cloud mist moving through the valleys:
          - Layer A: Distant low-contrast mist
          - Layer B: Main valley & ravine clouds (primary animated layer, visible in seconds)
          - Layer C: Foreground diffuse slope mist
          ================================================================= */}
      <HeroMountainClouds
        isInView={isInView}
        isReducedMotion={isReducedMotion}
      />

      {/* =================================================================
          LAYER 6: TOPOGRAPHIC SURVEY CONTOURS & DELICATE CURRENTS
          Stationary precision vector elevation contours with continuous 60s flowing currents,
          subtle ridge breathing pulses, and geodesic benchmarks.
          ================================================================= */}
      <svg
        viewBox="0 0 1440 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full pointer-events-none"
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
          LAYER 7: CONTENT CONTRAST GUARD
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
