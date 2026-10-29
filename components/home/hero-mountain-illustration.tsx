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
 * Bespoke Signature Artwork for Jetway's Hero Section:
 * 1. Intricate Monochromatic Engraved Mountain Landscape:
 *    - Antique topographic copperplate engraving brought into a computational environment.
 *    - Asymmetrical framing: quiet, dark negative space on the left protecting typography;
 *      towering sculptural peaks, arête ridges, and elevation contours framing the deployment runway on the right.
 * 2. Drifting Volumetric Valley Mist & Clouds:
 *    - Atmospheric charcoal and warm-ivory mist drifting gently through the mountain valleys.
 *    - Subtle three-dimensional occlusion between mountain passes.
 * 3. Interactive Topographic Survey Contours & Light Echoes:
 *    - Topographic vector elevations and geodesic survey benchmarks (+ STN-01, ELEV 3,428M).
 *    - Dynamic luminescent pulses echoing data packets:
 *      * Burnt-orange (#D88762) pulse when compiling in Build Engine.
 *      * Sage-green (#83B69A) glow when verifying in Production.
 * 4. Micro-Parallax:
 *    - Tactile, weighted multi-plane depth responsive to pointer motion (disabled if reduced motion).
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
      // Normalized coordinates from center [-1 .. 1]
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    const onMouseLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    const animate = () => {
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;

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

  // Dynamic light pulse state based on deployment pipeline
  const isBuildActive =
    animPhase === "packet1" || animPhase === "building" || activeStage === "build";
  const isProductionActive =
    animPhase === "packet2" || animPhase === "production" || activeStage === "production";

  // Differentiated parallax offsets for each depth plane
  const mountainShiftX = isReducedMotion ? 0 : mouseOffset.x * 8;
  const mountainShiftY = isReducedMotion ? 0 : mouseOffset.y * 5;

  const mistShiftX = isReducedMotion ? 0 : mouseOffset.x * 14;
  const mistShiftY = isReducedMotion ? 0 : mouseOffset.y * 8;

  const vectorShiftX = isReducedMotion ? 0 : mouseOffset.x * 18;
  const vectorShiftY = isReducedMotion ? 0 : mouseOffset.y * 10;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0"
      aria-hidden="true"
    >
      {/* =================================================================
          LAYER 1: ATMOSPHERIC HORIZON UNDERGLOW
          Ultra-gentle warm radiance in the right mountain saddle
          ================================================================= */}
      <div
        className="absolute right-0 top-1/4 w-[65vw] max-w-[900px] h-[75%] pointer-events-none opacity-40 transition-opacity duration-700"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 75% 45%, rgba(216, 135, 98, 0.07) 0%, rgba(216, 135, 98, 0.02) 40%, transparent 75%)",
        }}
      />

      {/* =================================================================
          LAYER 2: BESPOKE ENGRAVED MOUNTAIN TOPOGRAPHY
          Antique copperplate / generative fine-line alpine formation
          ================================================================= */}
      <div
        className="absolute inset-0 w-full h-full will-change-transform transition-transform duration-100 ease-out flex items-center justify-end"
        style={{
          transform: `translate3d(${mountainShiftX}px, ${mountainShiftY}px, 0)`,
        }}
      >
        <div className="relative w-full h-full min-w-[960px] lg:min-w-[1280px] xl:min-w-[1440px] flex items-center justify-end">
          <Image
            src="/images/hero/hero-engraved-mountains.webp"
            alt=""
            width={1376}
            height={768}
            priority
            quality={98}
            className="w-full h-full object-cover object-right lg:object-right-bottom block opacity-95 transition-opacity duration-500"
            style={{
              maskImage:
                "linear-gradient(to right, transparent 0%, black 18%, black 90%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 10%, black 88%, transparent 100%)",
              WebkitMaskComposite: "source-in",
              maskComposite: "intersect",
            }}
          />
        </div>
      </div>

      {/* =================================================================
          LAYER 3: VOLUMETRIC VALLEY MIST & DRIFTING CLOUDS
          Soft graphite & ivory volumetric mist wafting through the ravine
          ================================================================= */}
      <div
        className="absolute inset-0 w-full h-full will-change-transform pointer-events-none"
        style={{
          transform: `translate3d(${mistShiftX}px, ${mistShiftY}px, 0)`,
        }}
      >
        {/* Cloud Ribbon A: Slow, wide drift through midground pass */}
        <div
          className={`absolute right-[8vw] sm:right-[14vw] lg:right-[20vw] top-[32%] sm:top-[28%] w-[380px] sm:w-[520px] lg:w-[640px] h-[180px] sm:h-[240px] rounded-full pointer-events-none opacity-30 ${
            isReducedMotion ? "" : "animate-[driftSlow_38s_easeInOut_infinite_alternate]"
          }`}
          style={{
            background:
              "radial-gradient(ellipse 65% 45% at 50% 50%, rgba(242, 240, 235, 0.12) 0%, rgba(142, 140, 134, 0.08) 35%, rgba(28, 27, 25, 0.04) 65%, transparent 85%)",
            filter: "blur(24px)",
          }}
        />

        {/* Cloud Ribbon B: Deeper valley plume near right shoulder */}
        <div
          className={`absolute right-[-4vw] sm:right-[2vw] lg:right-[6vw] top-[54%] sm:top-[48%] w-[320px] sm:w-[440px] lg:w-[560px] h-[160px] sm:h-[220px] rounded-full pointer-events-none opacity-25 ${
            isReducedMotion ? "" : "animate-[driftSlow_46s_easeInOut_infinite_alternate-reverse]"
          }`}
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(216, 135, 98, 0.08) 0%, rgba(142, 140, 134, 0.06) 40%, transparent 80%)",
            filter: "blur(28px)",
          }}
        />
      </div>

      {/* =================================================================
          LAYER 4: TOPOGRAPHIC SURVEY VECTORS & INFRASTRUCTURE CONDUITS
          Precision cartographic benchmarks, elevation contours, and pulse echoes
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
          {/* Subtle glow filter for active topographic contour echoes */}
          <filter id="topographicGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* --- Cartographic Geodesic Benchmarks --- */}
        {/* Benchmark 01: Near Source Pass (Upper center-right) */}
        <g transform="translate(780, 240)" className="opacity-45">
          <circle cx="0" cy="0" r="2.5" fill="#D88762" />
          <line x1="-8" y1="0" x2="-3.5" y2="0" stroke="#8E8C86" strokeWidth="0.75" />
          <line x1="3.5" y1="0" x2="8" y2="0" stroke="#8E8C86" strokeWidth="0.75" />
          <line x1="0" y1="-8" x2="0" y2="-3.5" stroke="#8E8C86" strokeWidth="0.75" />
          <line x1="0" y1="3.5" x2="0" y2="8" stroke="#8E8C86" strokeWidth="0.75" />
          <text
            x="12"
            y="3.5"
            fill="#8E8C86"
            fontSize="9"
            fontFamily="var(--font-geist-mono)"
            letterSpacing="0.12em"
          >
            STN-01 // ELEV 2,840M
          </text>
        </g>

        {/* Benchmark 02: Near Peak Crest (Upper right) */}
        <g transform="translate(1220, 160)" className="opacity-40">
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

        {/* Benchmark 03: Near Production Edge (Lower right) */}
        <g transform="translate(1120, 620)" className="opacity-45">
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

        {/* --- Topographic Harmonic Elevation Curves --- */}
        {/* Curve 1: Flowing from the valley across the build pass */}
        <path
          d="M 680 340 C 760 320, 880 330, 960 280 S 1120 220, 1260 210"
          stroke={isBuildActive ? "#D88762" : "#383532"}
          strokeWidth={isBuildActive ? "1.25" : "0.75"}
          strokeDasharray={isBuildActive ? "none" : "3 5"}
          opacity={isBuildActive ? "0.65" : "0.3"}
          filter={isBuildActive ? "url(#topographicGlow)" : "none"}
          className="transition-all duration-500"
        />

        {/* Curve 2: Secondary arête contour echoing build output into production */}
        <path
          d="M 740 460 C 840 430, 940 470, 1060 440 S 1240 460, 1380 480"
          stroke={isProductionActive ? "#83B69A" : isBuildActive ? "#D88762" : "#302D2A"}
          strokeWidth={isProductionActive || isBuildActive ? "1.25" : "0.75"}
          strokeDasharray={isProductionActive || isBuildActive ? "none" : "2 6"}
          opacity={isProductionActive ? "0.65" : isBuildActive ? "0.45" : "0.25"}
          filter={isProductionActive ? "url(#topographicGlow)" : "none"}
          className="transition-all duration-500"
        />

        {/* Curve 3: Lower ridge contour line grounding the scene */}
        <path
          d="M 820 620 C 920 600, 1040 640, 1180 610 S 1320 630, 1420 620"
          stroke="#262422"
          strokeWidth="0.75"
          strokeDasharray="4 8"
          opacity="0.35"
        />
      </svg>

      {/* =================================================================
          LAYER 5: PERIMETER FALLOFF (Seamless Integration)
          Feathers out edges completely into #111111
          ================================================================= */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, #111111 0%, transparent 22%, transparent 88%, #111111 100%), linear-gradient(to bottom, #111111 0%, transparent 14%, transparent 84%, #111111 100%)",
        }}
      />
    </div>
  );
}

export default HeroMountainIllustration;
