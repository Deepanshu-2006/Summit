"use client";

import React, { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { HeroMountainClouds } from "./hero-mountain-clouds";
import { HeroTerrainWake } from "./hero-terrain-wake";
import { HeroMountainCanvasTracer } from "./hero-mountain-canvas-tracer";
import { usePreloader } from "@/components/layout/preloader-context";
import {
  MOUNTAIN_SKYLINE_PATH,
  MOUNTAIN_MAIN_ARETE_PATH,
  MOUNTAIN_EAST_RIDGE_PATH,
} from "@/lib/mountain-contours";

interface HeroMountainIllustrationProps {
  activeStage?: "source" | "build" | "production";
  animPhase?: "source" | "packet1" | "building" | "packet2" | "production";
  isReducedMotion: boolean;
  isInView?: boolean;
}

/**
 * Editorial Percentage Counter for Preloader
 *
 * Direct DOM-mutating 60/120Hz display ticker that tracks the master animation clock
 * without React state reconciliation batching or dropped frames.
 *
 * At 92% -> 100%, it seamlessly glides upward with a gentle atmospheric blur,
 * handcrafting a continuous upward momentum handoff into the hero headline character lift.
 */
function HeroMountainPreloaderCounter() {
  const { subscribeProgress, phase, progress } = usePreloader();
  const numRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeProgress((intPct, floatPct) => {
      if (numRef.current) {
        numRef.current.textContent = String(intPct).padStart(2, "0");
        if (intPct >= 99) {
          numRef.current.style.textShadow =
            "0 0 28px rgba(250, 248, 245, 0.9), 0 0 54px rgba(216, 135, 98, 0.45)";
        }
      }
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${Math.min(1, floatPct / 100)})`;
      }
      if (floatPct >= 92 && !isExiting) {
        setIsExiting(true);
      }
      if (statusRef.current) {
        if (intPct >= 99) {
          statusRef.current.textContent = "TOPOGRAPHY CALIBRATED // ELEV 3,428M";
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [subscribeProgress, isExiting]);

  const shouldExit = isExiting || progress >= 92 || phase === "complete";

  return (
    <div
      className="fixed left-6 sm:left-10 md:left-14 lg:left-20 bottom-8 sm:bottom-12 lg:bottom-16 z-30 pointer-events-none select-none will-change-[transform,opacity,filter]"
      style={{
        opacity: shouldExit ? 0 : 1,
        transform: shouldExit ? "translateY(-14px) scale(0.98)" : "translateY(0) scale(1)",
        filter: shouldExit ? "blur(8px)" : "blur(0px)",
        transition:
          "opacity 450ms cubic-bezier(0.16, 1, 0.3, 1), transform 500ms cubic-bezier(0.16, 1, 0.3, 1), filter 450ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Big Editorial Tabular Percentage */}
      <div className="flex items-baseline gap-1 sm:gap-2">
        <span
          ref={numRef}
          className="font-mono text-[80px] sm:text-[104px] md:text-[124px] lg:text-[144px] font-light leading-none tracking-[-0.04em] text-[#FAF8F5] tabular-nums transition-[text-shadow] duration-300"
        >
          {String(progress).padStart(2, "0")}
        </span>
        <span className="font-mono text-[26px] sm:text-[34px] lg:text-[42px] font-normal text-accent-orange leading-none">
          %
        </span>
      </div>

      {/* Precision Topographic Calibration Status */}
      <div className="flex items-center gap-2.5 mt-3 sm:mt-4">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-orange opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-orange" />
        </span>
        <span
          ref={statusRef}
          className="font-mono text-[10.5px] sm:text-[11.5px] uppercase tracking-[0.22em] text-[#A6A4A0] font-medium"
        >
          CALIBRATING TOPOGRAPHY
        </span>
        <span className="font-mono text-[10.5px] sm:text-[11.5px] text-[#666460] hidden xs:inline">
          // ELEV 3,428M
        </span>
      </div>

      {/* Fine Hairline Progress Track */}
      <div className="w-[180px] sm:w-[240px] h-[1.5px] bg-[#22211F] rounded-full overflow-hidden mt-3">
        <div
          ref={barRef}
          className="h-full bg-accent-orange origin-left will-change-transform"
          style={{
            transform: `scaleX(${progress / 100})`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * HeroMountainIllustration
 *
 * Full-Viewport, Infinitely Living Monochromatic Mountain Landscape:
 *
 * 1. Anamorphic Camera Motion:
 *    - Starts gently pushed in (scale 1.032, translateY 8px).
 *    - Pulls back smoothly to scale(1) translateY(0) as the copperplate engraving resolves.
 *
 * 2. Alpine Alpenglow Summit Crest Glint:
 *    - Radiant golden streak sweeping across the highest jagged peak ridge (78% -> 98%).
 *
 * 3. Preloader Contour Tracing from Scratch:
 *    - Big, bold, architectural percentage loader in the bottom-left corner with 120Hz smooth ticking.
 *    - Mountain topography plotted line-by-line via HeroMountainCanvasTracer (280 true elevation contours).
 *    - Seamless mathematical dissolution into full photorealistic artwork (55% -> 92%).
 *
 * 4. Continuous Handoff:
 *    - Upward counter evaporation transferring visual energy directly into the headline character lift.
 */
export function HeroMountainIllustration({
  isReducedMotion,
  isInView = true,
}: HeroMountainIllustrationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { phase, progress, progressFloat, isComplete, isTransitionDone } = usePreloader();

  // Preloader active while mountain contour tracing and counter transition are running
  const isPreloaderActive = !isComplete && !isTransitionDone;

  // Cinematic Anamorphic Camera Motion:
  // Starts gently pushed in (scale 1.022, translateY 5px) on dark screen,
  // then glides smoothly to rest (scale 1, translateY 0) over 2400ms on the GPU compositor.
  const isPushedIn = phase === "dark";
  const cameraTransform = isReducedMotion
    ? "scale(1) translate3d(0, 0px, 0)"
    : isPushedIn
    ? "scale(1.022) translate3d(0, 5px, 0)"
    : "scale(1) translate3d(0, 0px, 0)";

  // Continuous smooth opacity calculation for seamless blending
  const masterImageOpacity = !isPreloaderActive
    ? 0.95
    : progressFloat < 55
    ? 0
    : progressFloat < 92
    ? ((progressFloat - 55) / 37) * 0.95
    : 0.95;

  const vectorLinesOpacity = !isPreloaderActive
    ? 0
    : progressFloat < 72
    ? 1
    : Math.max(0, 1 - (progressFloat - 72) / 22);

  const radianceOpacity = !isPreloaderActive
    ? 0.35
    : progressFloat < 60
    ? 0
    : Math.min(0.35, ((progressFloat - 60) / 32) * 0.35);

  const surveySvgOpacity = !isPreloaderActive
    ? 1
    : progressFloat < 55
    ? 0
    : progressFloat < 88
    ? ((progressFloat - 55) / 33) * 1
    : 1;

  const contrastGuardOpacity = !isPreloaderActive
    ? 0.5
    : progressFloat < 70
    ? 0
    : Math.min(0.5, ((progressFloat - 70) / 24) * 0.5);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0 bg-[#111111]"
      aria-hidden="true"
    >
      {/* =================================================================
          BIG EDITORIAL PERCENTAGE LOADER (LEFT BOTTOM)
          Monumental monospaced numeral in the bottom-left corner
          counting smoothly from 00% to 100% in lockstep with the mountain tracing.
          Remains mounted until the entire sequence & breath delay completes.
          ================================================================= */}
      {!isComplete && <HeroMountainPreloaderCounter />}

      {/* =================================================================
          ANAMORPHIC CAMERA RIG (CONTAINING ALL MOUNTAIN ARTWORK & CONTOURS)
          Continuous physical camera ease: scale(1.022) -> scale(1.000)
          ================================================================= */}
      <div
        className="absolute inset-0 w-full h-full will-change-transform"
        style={{
          transform: cameraTransform,
          transition: isReducedMotion ? "none" : "transform 2400ms cubic-bezier(0.16, 1, 0.3, 1)",
          backfaceVisibility: "hidden",
        }}
      >
        {/* =================================================================
            LAYER 1: ATMOSPHERIC SADDLE RADIANT BASE & VOLUMETRIC DAWN
            Ultra-gentle warm radiance echoing through the central pass.
            ================================================================= */}
        <div
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            opacity: radianceOpacity,
            background:
              "radial-gradient(ellipse 80% 60% at 65% 50%, rgba(216, 135, 98, 0.08) 0%, rgba(216, 135, 98, 0.02) 45%, transparent 75%)",
          }}
        />

        {/* =================================================================
            PRELOADER LAYER A: 280 TRUE MATHEMATICAL CONTOUR LINES ON CANVAS
            Hardware-accelerated plotter drawing the mountain from zero against
            the dark screen with continuous fractional sub-segment interpolation.
            Kept permanently mounted to preserve GPU layer continuity without frame drops.
            ================================================================= */}
        <HeroMountainCanvasTracer />

        {/* =================================================================
            PRELOADER LAYER B: LUMINOUS PRIMARY SKYLINE & ARÊTE VECTORS
            Bold, glowing razor-sharp silhouette lines tracing across the peaks.
            ================================================================= */}
        {!isComplete && (
          <svg
            viewBox="0 0 1440 800"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible"
            style={{
              opacity: vectorLinesOpacity,
            }}
            aria-hidden="true"
          >
            <defs>
              <filter id="traceGlowMain" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.5" result="blur1" />
                <feGaussianBlur stdDeviation="1.2" result="blur2" />
                <feMerge>
                  <feMergeNode in="blur1" />
                  <feMergeNode in="blur2" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="traceGlowEast" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.0" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* 1. Primary Mountain Skyline (progress 0 -> 70%) */}
            <path
              d={MOUNTAIN_SKYLINE_PATH}
              stroke="#FAF8F5"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#traceGlowMain)"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={Math.max(0, 100 - (progress / 70) * 100)}
              style={{
                willChange: "stroke-dashoffset",
              }}
            />

            {/* 2. Main High Arête (progress 8 -> 75%) */}
            <path
              d={MOUNTAIN_MAIN_ARETE_PATH}
              stroke="#FAF8F5"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#traceGlowMain)"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={Math.max(0, 100 - (Math.max(0, progress - 8) / 67) * 100)}
              style={{
                willChange: "stroke-dashoffset",
              }}
            />

            {/* 3. Eastern High Shoulder (progress 18 -> 80%) in Burnt Orange */}
            <path
              d={MOUNTAIN_EAST_RIDGE_PATH}
              stroke="#D88762"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#traceGlowEast)"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={Math.max(0, 100 - (Math.max(0, progress - 18) / 62) * 100)}
              style={{
                willChange: "stroke-dashoffset",
              }}
            />
          </svg>
        )}

        {/* =================================================================
            ALPINE ALPENGLOW SUMMIT CREST SWEEP
            A brilliant beam of dawn light sweeping across the jagged peak ridge
            as the mountain contours resolve into full photographic presence.
            ================================================================= */}
        {!isComplete && progress >= 72 && (
          <svg
            viewBox="0 0 1440 800"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible transition-opacity duration-300 ease-out"
            style={{
              opacity: progress >= 78 && progress <= 98 ? 1 : 0,
            }}
            aria-hidden="true"
          >
            <defs>
              <filter id="crestAlpenglow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4.5" result="blur1" />
                <feGaussianBlur stdDeviation="1.5" result="blur2" />
                <feMerge>
                  <feMergeNode in="blur1" />
                  <feMergeNode in="blur2" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="crestGlintGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FFA67E" stopOpacity="0" />
                <stop offset="35%" stopColor="#D88762" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#FFFFFF" stopOpacity="1" />
                <stop offset="65%" stopColor="#FFA67E" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#D88762" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={MOUNTAIN_SKYLINE_PATH}
              stroke="url(#crestGlintGrad)"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#crestAlpenglow)"
              pathLength="100"
              strokeDasharray="24 76"
              strokeDashoffset={100 - ((Math.min(98, Math.max(78, progress)) - 78) / 20) * 124}
              style={{
                willChange: "stroke-dashoffset",
              }}
            />
          </svg>
        )}

        {/* =================================================================
            LAYER 2: FULL-BLEED PANORAMIC ENGRAVED MOUNTAIN TOPOGRAPHY
            Antique copperplate alpine artwork filling the hero edge-to-edge.
            Fades smoothly into view behind the traced contours between 55% and 92%.
            ================================================================= */}
        <div
          className="absolute inset-0 w-full h-full pointer-events-none will-change-[opacity]"
          style={{
            opacity: masterImageOpacity,
            transform: "translate3d(0, 0, 0)",
            backfaceVisibility: "hidden",
          }}
        >
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
            Slow-moving ambient illumination travelling gently across the ridges.
            ================================================================= */}
        {!isReducedMotion && (
          <div
            className="absolute inset-0 w-full h-full pointer-events-none animate-[ridgeIlluminationSweep_54s_easeInOut_infinite] will-change-transform transition-opacity duration-700"
            style={{
              opacity: isPreloaderActive ? Math.max(0, (progressFloat - 80) / 20) : 1,
              background:
                "radial-gradient(ellipse 75% 55% at 54% 45%, rgba(247, 244, 238, 0.11) 0%, rgba(238, 225, 212, 0.07) 28%, rgba(216, 135, 98, 0.04) 52%, rgba(142, 140, 134, 0.012) 75%, transparent 95%)",
              mixBlendMode: "screen",
            }}
          />
        )}

        {/* =================================================================
            LAYER 4: LIVING ATMOSPHERIC MOUNTAIN VALLEY CLOUDS (CANVAS)
            Multi-layer procedural mist moving continuously through the valleys.
            Pre-allocated and smoothly faded in to eliminate canvas creation hitches.
            ================================================================= */}
        <div
          className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-700 ease-out"
          style={{
            opacity: isPreloaderActive && progressFloat < 75 ? 0 : 1,
            transform: "translate3d(0, 0, 0)",
          }}
        >
          <HeroMountainClouds
            isInView={isInView}
            isReducedMotion={isReducedMotion}
          />
        </div>

        {/* =================================================================
            LAYER 5: SIGNATURE TERRAIN WAKE (CANVAS)
            Delicate, flowing topographic strands created by cursor movement.
            Pre-allocated and smoothly activated to eliminate canvas creation hitches.
            ================================================================= */}
        <div
          className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-700 ease-out"
          style={{
            opacity: isTransitionDone || isComplete ? 1 : 0,
            transform: "translate3d(0, 0, 0)",
          }}
        >
          <HeroTerrainWake
            isInView={isInView}
            isReducedMotion={isReducedMotion}
          />
        </div>

        {/* =================================================================
            LAYER 6: CARTOGRAPHIC SURVEY CONTOURS & BENCHMARKS (STATIONARY SVG)
            Clean, stationary precision vector elevation contours in authentic
            monochrome charcoal with geodesic calibration reticle.
            ================================================================= */}
        <svg
          viewBox="0 0 1440 800"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            opacity: surveySvgOpacity,
          }}
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

          {/* Benchmark 03: Right Peak Crest with Geodesic Reticle */}
          <g transform="translate(1240, 160)" className="transition-opacity duration-500">
            {/* Rotating geodesic reticle during preloader */}
            {isPreloaderActive && progress < 92 && (
              <circle
                cx="0"
                cy="0"
                r="11"
                stroke="#D88762"
                strokeWidth="0.75"
                strokeDasharray="3 4"
                className="animate-[spin_7s_linear_infinite] opacity-50"
              />
            )}
            {/* Locked reticle ring */}
            {(!isPreloaderActive || progress >= 92) && (
              <circle
                cx="0"
                cy="0"
                r="9"
                stroke="#8E8C86"
                strokeWidth="0.75"
                className="opacity-35"
              />
            )}
            <circle cx="0" cy="0" r="2.5" fill={progress >= 92 ? "#FAF8F5" : "#D88762"} />
            <line x1="-7" y1="0" x2="7" y2="0" stroke={progress >= 92 ? "#8E8C86" : "#D88762"} strokeWidth="0.75" />
            <line x1="0" y1="-7" x2="0" y2="7" stroke={progress >= 92 ? "#8E8C86" : "#D88762"} strokeWidth="0.75" />
            <text
              x="14"
              y="3.5"
              fill={progress >= 92 ? "#FAF8F5" : "#A6A4A0"}
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
            Gentle, broad atmospheric shadow behind the left typography column.
            ================================================================= */}
        <div
          className="absolute left-0 top-0 w-full sm:w-[60vw] lg:w-[52vw] h-full pointer-events-none transition-opacity duration-500 ease-out"
          style={{
            opacity: contrastGuardOpacity,
            background:
              "radial-gradient(ellipse 75% 70% at 20% 46%, rgba(17, 17, 17, 0.88) 0%, rgba(17, 17, 17, 0.45) 55%, transparent 100%)",
          }}
        />
        <div
          className="absolute left-0 top-0 w-[35vw] h-full pointer-events-none transition-opacity duration-500 ease-out hidden lg:block"
          style={{
            opacity: !isPreloaderActive ? 0.3 : contrastGuardOpacity * 0.6,
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
    </div>
  );
}

export default HeroMountainIllustration;
