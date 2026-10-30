"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
} from "react";
import Image from "next/image";
import { GitCommit, ExternalLink, Check } from "lucide-react";
import { useLenis } from "@/components/layout/smooth-scroll-provider";

// SSR-safe subscription for prefers-reduced-motion
function subscribeReducedMotion(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

/**
 * TopDownAscentHiker Component
 *
 * Meticulously illustrated top-down miniature alpine mountaineer:
 * - Wide-brim expedition sun hat with Summit burnt-orange hatband
 * - Broad technical shoulders with alpine shell jacket
 * - Technical mountain backpack with burnt-orange top flap and rolled bedroll
 * - Two leather hiking boots stepping in responsive alternating stride
 * - Two swinging trekking poles in responsive counter-stride
 * - Ambient warm ground contact shadow and subtle alpine lantern glow
 */
function TopDownAscentHiker({
  hikerRef,
  leftBootRef,
  rightBootRef,
  leftPoleRef,
  rightPoleRef,
  torsoRef,
}: {
  hikerRef: React.RefObject<SVGGElement | null>;
  leftBootRef: React.RefObject<SVGGElement | null>;
  rightBootRef: React.RefObject<SVGGElement | null>;
  leftPoleRef: React.RefObject<SVGGElement | null>;
  rightPoleRef: React.RefObject<SVGGElement | null>;
  torsoRef: React.RefObject<SVGGElement | null>;
}) {
  return (
    <g
      ref={hikerRef}
      className="will-change-transform pointer-events-none"
      aria-hidden="true"
    >
      {/* 1. Ambient Warm Ground Contact Shadow & Subtle Alpine Lantern Glow */}
      <circle cx="0" cy="1" r="16" fill="#D88762" opacity="0.14" />
      <ellipse cx="0" cy="1" rx="10" ry="13" fill="#000000" opacity="0.65" />

      {/* 2. Walking Legs & Boots (Alternating stride) */}
      <g id="ascent-hiker-boots">
        {/* Left Boot */}
        <g ref={leftBootRef} transform="translate(-5.5, 7)">
          <rect
            x="-2.2"
            y="-4"
            width="4.4"
            height="8"
            rx="2"
            fill="#1E1D1B"
            stroke="#111110"
            strokeWidth="0.75"
          />
          <line x1="-1.2" y1="-1" x2="1.2" y2="-1" stroke="#D88762" strokeWidth="0.7" />
          <line x1="-1.2" y1="1" x2="1.2" y2="1" stroke="#D88762" strokeWidth="0.7" />
          <ellipse cx="0" cy="-3" rx="1.8" ry="1" fill="#141312" />
        </g>

        {/* Right Boot */}
        <g ref={rightBootRef} transform="translate(5.5, 7)">
          <rect
            x="-2.2"
            y="-4"
            width="4.4"
            height="8"
            rx="2"
            fill="#1E1D1B"
            stroke="#111110"
            strokeWidth="0.75"
          />
          <line x1="-1.2" y1="-1" x2="1.2" y2="-1" stroke="#D88762" strokeWidth="0.7" />
          <line x1="-1.2" y1="1" x2="1.2" y2="1" stroke="#D88762" strokeWidth="0.7" />
          <ellipse cx="0" cy="-3" rx="1.8" ry="1" fill="#141312" />
        </g>
      </g>

      {/* 3. Trekking Poles & Hands */}
      <g id="ascent-hiker-poles">
        {/* Left Trekking Pole */}
        <g ref={leftPoleRef} transform="translate(-9, -5)">
          <line
            x1="-1.2"
            y1="-8"
            x2="1.2"
            y2="10"
            stroke="#8E8C86"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
          <circle cx="0.7" cy="7" r="2" fill="none" stroke="#FAF8F5" strokeWidth="0.5" />
          <circle cx="1.2" cy="10" r="0.7" fill="#FAF8F5" />
          <rect x="-0.9" y="-2.5" width="1.8" height="4" rx="0.7" fill="#FAF8F5" />
        </g>

        {/* Right Trekking Pole */}
        <g ref={rightPoleRef} transform="translate(9, -5)">
          <line
            x1="1.2"
            y1="-8"
            x2="-1.2"
            y2="10"
            stroke="#8E8C86"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
          <circle cx="-0.7" cy="7" r="2" fill="none" stroke="#FAF8F5" strokeWidth="0.5" />
          <circle cx="-1.2" cy="10" r="0.7" fill="#FAF8F5" />
          <rect x="-0.9" y="-2.5" width="1.8" height="4" rx="0.7" fill="#FAF8F5" />
        </g>
      </g>

      {/* 4. Torso & Technical Expedition Backpack */}
      <g ref={torsoRef}>
        {/* Alpine Shell Jacket */}
        <path
          d="M -8 -4 C -8 -7, 8 -7, 8 -4 C 8.5 0, 7.5 3.5, 6.5 4.5 C 3.5 5.5, -3.5 5.5, -6.5 4.5 C -7.5 3.5, -8.5 0, -8 -4 Z"
          fill="#34322E"
          stroke="#262422"
          strokeWidth="0.75"
        />

        {/* Technical Expedition Backpack */}
        <g transform="translate(0, 1)">
          <rect
            x="-6.5"
            y="-2"
            width="13"
            height="10"
            rx="2.5"
            fill="#23211E"
            stroke="#151413"
            strokeWidth="0.7"
          />
          {/* Burnt-Orange Top Flap */}
          <rect
            x="-5.5"
            y="-3"
            width="11"
            height="3.5"
            rx="1.2"
            fill="#D88762"
            stroke="#B96D4C"
            strokeWidth="0.5"
          />
          {/* Compression Straps */}
          <line x1="-3" y1="-3" x2="-3" y2="7" stroke="#111110" strokeWidth="0.7" />
          <line x1="3" y1="-3" x2="3" y2="7" stroke="#111110" strokeWidth="0.7" />
          {/* Rolled Bedroll (Backpack Base) */}
          <rect
            x="-6"
            y="7.5"
            width="12"
            height="3.2"
            rx="1.5"
            fill="#3A3834"
            stroke="#262422"
            strokeWidth="0.6"
          />
        </g>

        {/* 5. Head & Wide-Brim Expedition Hat */}
        <g transform="translate(0, -6)">
          <ellipse
            cx="0"
            cy="0"
            rx="6.5"
            ry="7.2"
            fill="#423E39"
            stroke="#504C46"
            strokeWidth="0.75"
          />
          {/* Signature Burnt-Orange Hatband */}
          <ellipse
            cx="0"
            cy="0"
            rx="4.2"
            ry="4.7"
            fill="none"
            stroke="#D88762"
            strokeWidth="0.85"
          />
          {/* Crown */}
          <ellipse cx="0" cy="0" rx="3.5" ry="4" fill="#2E2B27" />
        </g>
      </g>
    </g>
  );
}

/**
 * GettingStarted: Section 07 — The Deployment Journey
 * "From first commit to first deploy."
 *
 * Minimal, Editorial, Cinematic Mountain Ascent:
 * - Stage 01 Source (Lower-left): Code committed.
 * - Stage 02 Build (Center pass): Build verified.
 * - Stage 03 Production (High peak): Live in production.
 *
 * Atmospheric mountain landscape blending naturally into the black background
 * with a continuous glowing burnt-orange trail and miniature alpine mountaineer.
 */
export function GettingStarted() {
  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const lenis = useLenis();
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);

  // SVG Trail Refs (Desktop & Mobile)
  const pathRef = useRef<SVGPathElement>(null);
  const traveledPathRef = useRef<SVGPathElement>(null);
  const traveledGlowRef = useRef<SVGPathElement>(null);
  const pathLengthRef = useRef<number>(1000);

  // Mobile SVG Trail Refs
  const mobilePathRef = useRef<SVGPathElement>(null);
  const mobileTraveledPathRef = useRef<SVGPathElement>(null);
  const mobilePathLengthRef = useRef<number>(600);

  // Desktop Hiker DOM Refs
  const hikerRef = useRef<SVGGElement>(null);
  const leftBootRef = useRef<SVGGElement>(null);
  const rightBootRef = useRef<SVGGElement>(null);
  const leftPoleRef = useRef<SVGGElement>(null);
  const rightPoleRef = useRef<SVGGElement>(null);
  const torsoRef = useRef<SVGGElement>(null);

  // Mobile Hiker DOM Refs
  const mobileHikerRef = useRef<SVGGElement>(null);
  const mobileLeftBootRef = useRef<SVGGElement>(null);
  const mobileRightBootRef = useRef<SVGGElement>(null);
  const mobileLeftPoleRef = useRef<SVGGElement>(null);
  const mobileRightPoleRef = useRef<SVGGElement>(null);
  const mobileTorsoRef = useRef<SVGGElement>(null);

  // Storytelling milestone activation states
  const [activeStage, setActiveStage] = useState<number>(1);
  const activeStageRef = useRef<number>(1);

  const [buildSteps, setBuildSteps] = useState<{
    step1: boolean;
    step2: boolean;
    step3: boolean;
    isLive: boolean;
  }>({
    step1: false,
    step2: false,
    step3: false,
    isLive: false,
  });
  const buildStepsRef = useRef(buildSteps);

  // Animation motion tracking
  const motionRef = useRef({
    lastDistance: 0,
    walkCycle: 0,
    stride: 0,
    armStride: 0,
    sway: 0,
    rafId: null as number | null,
  });

  // Desktop Trail Path Coordinates:
  // Starts at lower-left foothills (140, 370)
  // Ascends through center saddle pass (580, 230)
  // Reaches high alpine summit crest (1040, 85)
  const desktopTrailD =
    "M 140 370 " +
    "C 260 370, 420 280, 580 230 " +
    "C 740 180, 900 120, 1040 85";

  // Mobile Vertical Trail Path Coordinates:
  // Graceful vertical winding topographic route
  const mobileTrailD =
    "M 30 50 " +
    "C 46 130, 14 210, 30 290 " +
    "C 46 370, 14 450, 30 540";

  // Measure path lengths on mount and window resize
  const measurePaths = useCallback(() => {
    if (pathRef.current) {
      try {
        const len = pathRef.current.getTotalLength();
        if (len > 0) {
          pathLengthRef.current = len;
          if (traveledPathRef.current) traveledPathRef.current.style.strokeDasharray = `${len}px ${len}px`;
          if (traveledGlowRef.current) traveledGlowRef.current.style.strokeDasharray = `${len}px ${len}px`;
        }
      } catch {}
    }
    if (mobilePathRef.current) {
      try {
        const len = mobilePathRef.current.getTotalLength();
        if (len > 0) {
          mobilePathLengthRef.current = len;
          if (mobileTraveledPathRef.current) mobileTraveledPathRef.current.style.strokeDasharray = `${len}px ${len}px`;
        }
      } catch {}
    }
  }, []);

  // Synchronous Direct DOM Updates for Trail & Hiker (0-drift, 0-lag behind scroll)
  const applyProgress = useCallback((progress: number) => {
    const desktopTotal = pathLengthRef.current;
    const desktopPath = pathRef.current;
    const desktopDist = Math.max(0, Math.min(desktopTotal, progress * desktopTotal));

    // 1. Reveal Desktop Traveled Trail
    const desktopOffset = Math.max(0, desktopTotal - desktopDist);
    if (traveledPathRef.current) {
      traveledPathRef.current.style.strokeDashoffset = `${desktopOffset.toFixed(1)}px`;
    }
    if (traveledGlowRef.current) {
      traveledGlowRef.current.style.strokeDashoffset = `${desktopOffset.toFixed(1)}px`;
    }

    // 2. Position Desktop Hiker
    if (desktopPath && desktopTotal > 0 && hikerRef.current) {
      const pt = desktopPath.getPointAtLength(desktopDist);
      const sampleDist = Math.min(desktopTotal, desktopDist + 2.0);
      const samplePt = desktopPath.getPointAtLength(sampleDist);
      const dx = samplePt.x - pt.x;
      const dy = samplePt.y - pt.y;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

      hikerRef.current.setAttribute(
        "transform",
        `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}) rotate(${angle.toFixed(1)})`
      );

      // Stride & gait physics
      const deltaD = desktopDist - motionRef.current.lastDistance;
      motionRef.current.lastDistance = desktopDist;

      if (Math.abs(deltaD) > 0.05) {
        motionRef.current.walkCycle += deltaD * 0.22;
        motionRef.current.stride = Math.sin(motionRef.current.walkCycle);
        motionRef.current.armStride = Math.cos(motionRef.current.walkCycle);
        motionRef.current.sway = Math.sin(motionRef.current.walkCycle * 0.5) * 1.5;
      } else {
        motionRef.current.stride *= 0.82;
        motionRef.current.armStride *= 0.82;
        motionRef.current.sway *= 0.82;
      }

      const strideOffset = motionRef.current.stride * 4.5;
      const armOffset = motionRef.current.armStride * 4.0;

      if (leftBootRef.current) {
        leftBootRef.current.setAttribute("transform", `translate(-5.5, ${(7 + strideOffset).toFixed(1)})`);
      }
      if (rightBootRef.current) {
        rightBootRef.current.setAttribute("transform", `translate(5.5, ${(7 - strideOffset).toFixed(1)})`);
      }
      if (leftPoleRef.current) {
        leftPoleRef.current.setAttribute("transform", `translate(-9, ${(-5 - armOffset).toFixed(1)})`);
      }
      if (rightPoleRef.current) {
        rightPoleRef.current.setAttribute("transform", `translate(9, ${(-5 + armOffset).toFixed(1)})`);
      }
      if (torsoRef.current) {
        torsoRef.current.setAttribute("transform", `rotate(${motionRef.current.sway.toFixed(1)})`);
      }
    }

    // 3. Reveal Mobile Traveled Trail & Position Mobile Hiker
    const mobileTotal = mobilePathLengthRef.current;
    const mobilePath = mobilePathRef.current;
    const mobileDist = Math.max(0, Math.min(mobileTotal, progress * mobileTotal));

    if (mobileTraveledPathRef.current) {
      const mobileOffset = Math.max(0, mobileTotal - mobileDist);
      mobileTraveledPathRef.current.style.strokeDashoffset = `${mobileOffset.toFixed(1)}px`;
    }

    if (mobilePath && mobileTotal > 0 && mobileHikerRef.current) {
      const pt = mobilePath.getPointAtLength(mobileDist);
      const sampleDist = Math.min(mobileTotal, mobileDist + 2.0);
      const samplePt = mobilePath.getPointAtLength(sampleDist);
      const dx = samplePt.x - pt.x;
      const dy = samplePt.y - pt.y;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

      mobileHikerRef.current.setAttribute(
        "transform",
        `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}) rotate(${angle.toFixed(1)})`
      );

      const strideOffset = motionRef.current.stride * 4.5;
      const armOffset = motionRef.current.armStride * 4.0;

      if (mobileLeftBootRef.current) {
        mobileLeftBootRef.current.setAttribute("transform", `translate(-5.5, ${(7 + strideOffset).toFixed(1)})`);
      }
      if (mobileRightBootRef.current) {
        mobileRightBootRef.current.setAttribute("transform", `translate(5.5, ${(7 - strideOffset).toFixed(1)})`);
      }
      if (mobileLeftPoleRef.current) {
        mobileLeftPoleRef.current.setAttribute("transform", `translate(-9, ${(-5 - armOffset).toFixed(1)})`);
      }
      if (mobileRightPoleRef.current) {
        mobileRightPoleRef.current.setAttribute("transform", `translate(9, ${(-5 + armOffset).toFixed(1)})`);
      }
      if (mobileTorsoRef.current) {
        mobileTorsoRef.current.setAttribute("transform", `rotate(${motionRef.current.sway.toFixed(1)})`);
      }
    }

    // 4. Update Storytelling Stages with Hysteresis (Prevents rapid state thrashing)
    let newStage = activeStageRef.current;
    if (progress < 0.28) {
      newStage = 1;
    } else if (progress < 0.68) {
      newStage = 2;
    } else {
      newStage = 3;
    }

    if (newStage !== activeStageRef.current) {
      activeStageRef.current = newStage;
      setActiveStage(newStage);
    }

    // 5. Update Sequential Build Engine State
    const nextBuild = {
      step1: progress >= 0.36,
      step2: progress >= 0.46,
      step3: progress >= 0.58,
      isLive: progress >= 0.78,
    };

    if (
      nextBuild.step1 !== buildStepsRef.current.step1 ||
      nextBuild.step2 !== buildStepsRef.current.step2 ||
      nextBuild.step3 !== buildStepsRef.current.step3 ||
      nextBuild.isLive !== buildStepsRef.current.isLive
    ) {
      buildStepsRef.current = nextBuild;
      setBuildSteps(nextBuild);
    }
  }, []);

  // Compute scroll progress from sticky container position
  const computeProgress = useCallback(() => {
    if (!sectionRef.current) return;

    const rect = sectionRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const scrollDistance = rect.height - vh;
    if (scrollDistance <= 0) return;

    const currentScroll = -rect.top;
    const rawProgress = currentScroll / scrollDistance;
    const clampedProgress = Math.max(0, Math.min(1, rawProgress));

    applyProgress(clampedProgress);
  }, [applyProgress]);

  // Synchronize 1:1 with Lenis smooth scroll
  useLenis(() => {
    computeProgress();
  });

  // Setup listeners and measurements
  useEffect(() => {
    measurePaths();
    computeProgress();

    const onResize = () => {
      measurePaths();
      computeProgress();
    };

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", computeProgress, { passive: true });

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && sectionRef.current) {
      ro = new ResizeObserver(() => {
        measurePaths();
        computeProgress();
      });
      ro.observe(sectionRef.current);
    }

    const timer = setTimeout(() => {
      measurePaths();
      computeProgress();
    }, 80);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", computeProgress);
      if (ro) ro.disconnect();
    };
  }, [measurePaths, computeProgress]);

  // Fallback for reduced motion
  const effectiveStage = isReducedMotion ? 3 : activeStage;
  const effectiveBuild = isReducedMotion
    ? { step1: true, step2: true, step3: true, isLive: true }
    : buildSteps;

  return (
    <section
      ref={sectionRef}
      id="getting-started"
      className={
        isReducedMotion
          ? "relative w-full mt-24 mb-32 sm:mt-32 sm:mb-44 lg:mt-40 lg:mb-56 bg-transparent text-[#F2F0EB] select-none"
          : "relative w-full h-[260vh] sm:h-[280vh] lg:h-[300vh] mt-[28vh] sm:mt-[34vh] lg:mt-[40vh] mb-[40vh] sm:mb-[48vh] lg:mb-[56vh] bg-transparent text-[#F2F0EB] select-none"
      }
      aria-labelledby="getting-started-heading"
    >
      {/* =================================================================
          STICKY VIEWPORT CONTAINER
          Pins during the 3-stage mountain ascent, releasing cleanly into
          normal page flow once the summit deployment completes.
          ================================================================= */}
      <div
        ref={stickyRef}
        className={
          isReducedMotion
            ? "relative w-full"
            : "sticky top-0 z-20 w-full h-screen overflow-hidden flex flex-col justify-between pt-[76px] pb-6 sm:pb-8 bg-transparent"
        }
      >
        <div className="layout-container w-full flex-1 flex flex-col justify-between min-h-0 select-text">

          {/* =============================================================
              EDITORIAL INTRODUCTION
              Confident, intentional composition with understated identifier
              ============================================================= */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 lg:gap-12 mb-4 sm:mb-6 shrink-0">
            <div>
              {/* Understated Section Identifier */}
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
                <span className="font-mono text-[11px] text-[#A8A49C] tracking-[0.16em] uppercase">
                  THE DEPLOYMENT JOURNEY · AN ASCENT TO PRODUCTION
                </span>
              </div>

              {/* Confident Heading with deliberate line break */}
              <h2
                id="getting-started-heading"
                className="font-sans text-[32px] sm:text-[42px] lg:text-[48px] font-medium leading-[1.08] tracking-[-0.035em] text-[#F2F0EB]"
              >
                From first commit<br className="hidden sm:inline" /> to first deploy.
              </h2>
            </div>

            {/* Supporting Copy */}
            <p className="font-sans text-[13.5px] sm:text-[14.5px] text-[#8E8A82] leading-[1.6] max-w-[420px] pb-0.5 shrink-0">
              Your next deployment doesn’t need a complicated setup. Start with your
              code, configure your application, and get ready to ship.
            </p>
          </div>

          {/* =============================================================
              MAIN VISUAL STAGE: THE MOUNTAIN ASCENT CANVAS
              Open, expansive alpine landscape with subtle edge vignetting.
              No card borders, no heavy dashboard boxes.
              ============================================================= */}
          <div className="relative w-full flex-1 min-h-[440px] sm:min-h-[500px] flex flex-col justify-between overflow-hidden">

            {/* -----------------------------------------------------------
                LAYER 1: BACKGROUND ENGRAVED ALPINE ARTWORK & VIGNETTE
                Blends seamlessly into the black background.
                ----------------------------------------------------------- */}
            <div className="absolute inset-0 pointer-events-none select-none overflow-hidden" aria-hidden="true">
              <div
                className="relative w-full h-full opacity-25 mix-blend-screen"
                style={{
                  maskImage: "radial-gradient(ellipse 95% 80% at 50% 65%, black 40%, transparent 100%)",
                  WebkitMaskImage: "radial-gradient(ellipse 95% 80% at 50% 65%, black 40%, transparent 100%)",
                }}
              >
                <Image
                  src="/images/mountains-dark-v2.webp"
                  alt=""
                  fill
                  priority={false}
                  className="object-cover object-bottom"
                />
              </div>
            </div>

            {/* -----------------------------------------------------------
                LAYER 2: DESKTOP / TABLET PANORAMIC MOUNTAIN PATH & CONTOURS
                ----------------------------------------------------------- */}
            <div className="hidden lg:block absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
              <svg
                viewBox="0 0 1200 460"
                preserveAspectRatio="none"
                fill="none"
                className="w-full h-full overflow-visible"
              >
                <defs>
                  {/* Burnt Orange to Sage Green Gradient for Summit Arrival */}
                  <linearGradient id="ascentTrailGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#D88762" />
                    <stop offset="72%" stopColor="#E58B65" />
                    <stop offset="100%" stopColor="#82B89D" />
                  </linearGradient>

                  <filter id="ascentGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Subtle Topographic Saddle Contour Lines */}
                <path
                  d="M 60 410 C 260 395, 460 340, 640 310 S 980 270, 1200 240"
                  stroke="#262421"
                  strokeWidth="1"
                  strokeDasharray="4 14"
                  className="opacity-40"
                />
                <path
                  d="M 120 310 C 340 280, 560 215, 760 175 S 1020 120, 1200 100"
                  stroke="#2F2C28"
                  strokeWidth="1"
                  strokeDasharray="3 12"
                  className="opacity-40"
                />

                {/* --- The Continuous Ascending Mountain Trail --- */}
                {/* 1. Muted Untraveled Route */}
                <path
                  ref={pathRef}
                  d={desktopTrailD}
                  stroke="#2A2825"
                  strokeWidth="1.8"
                  strokeDasharray="3 7"
                  strokeLinecap="round"
                />

                {/* 2. Traveled Active Burnt-Orange Glowing Trail */}
                <path
                  ref={traveledGlowRef}
                  d={desktopTrailD}
                  stroke="url(#ascentTrailGradient)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  opacity="0.32"
                  filter="url(#ascentGlow)"
                  style={{
                    strokeDasharray: "1000px 1000px",
                    strokeDashoffset: isReducedMotion ? "0px" : "1000px",
                  }}
                />
                <path
                  ref={traveledPathRef}
                  d={desktopTrailD}
                  stroke="url(#ascentTrailGradient)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: "1000px 1000px",
                    strokeDashoffset: isReducedMotion ? "0px" : "1000px",
                  }}
                />

                {/* Station 01 Waypoint Reticle */}
                <circle
                  cx="140"
                  cy="370"
                  r="5"
                  fill="#111110"
                  stroke={effectiveStage >= 1 ? "#D88762" : "#383531"}
                  strokeWidth="1.8"
                  className="transition-colors duration-400"
                />
                <circle
                  cx="140"
                  cy="370"
                  r="2"
                  fill={effectiveStage >= 1 ? "#D88762" : "#22201E"}
                  className="transition-colors duration-400"
                />

                {/* Station 02 Waypoint Reticle */}
                <circle
                  cx="580"
                  cy="230"
                  r="5"
                  fill="#111110"
                  stroke={effectiveBuild.step3 ? "#82B89D" : effectiveStage >= 2 ? "#D88762" : "#383531"}
                  strokeWidth="1.8"
                  className="transition-colors duration-400"
                />
                <circle
                  cx="580"
                  cy="230"
                  r="2"
                  fill={effectiveBuild.step3 ? "#82B89D" : effectiveStage >= 2 ? "#D88762" : "#22201E"}
                  className="transition-colors duration-400"
                />

                {/* Station 03 Waypoint Reticle (Peak) */}
                <circle
                  cx="1040"
                  cy="85"
                  r="5.5"
                  fill="#111110"
                  stroke={effectiveBuild.isLive ? "#82B89D" : "#383531"}
                  strokeWidth="2"
                  className="transition-colors duration-400"
                />
                <circle
                  cx="1040"
                  cy="85"
                  r="2.2"
                  fill={effectiveBuild.isLive ? "#82B89D" : "#22201E"}
                  className="transition-colors duration-400"
                />

                {/* Top-Down Miniature Alpine Mountaineer (Ascent Hiker) */}
                <TopDownAscentHiker
                  hikerRef={hikerRef}
                  leftBootRef={leftBootRef}
                  rightBootRef={rightBootRef}
                  leftPoleRef={leftPoleRef}
                  rightPoleRef={rightPoleRef}
                  torsoRef={torsoRef}
                />
              </svg>
            </div>

            {/* -----------------------------------------------------------
                LAYER 3: THE THREE MINIMAL REFINED MILESTONES (DESKTOP)
                ----------------------------------------------------------- */}
            <div className="hidden lg:grid grid-cols-12 gap-8 w-full h-full relative z-10 pointer-events-none py-2">

              {/* =========================================================
                  STAGE 01 — SOURCE (Lower-left foothills)
                  ========================================================= */}
              <div className="col-span-4 flex flex-col justify-end pb-4 pointer-events-auto">
                <div
                  className={`space-y-2 max-w-[320px] transition-all duration-500 ease-out ${
                    effectiveStage === 1
                      ? "opacity-100 translate-y-0"
                      : effectiveStage > 1
                      ? "opacity-65 translate-y-0"
                      : "opacity-35 translate-y-2"
                  }`}
                >
                  {/* Stage Number */}
                  <div className="font-mono text-[11px] font-medium text-accent-orange tracking-wider">
                    01
                  </div>

                  {/* Heading */}
                  <h3 className="font-sans text-[24px] sm:text-[26px] font-medium text-[#F2F0EB] tracking-[-0.02em] leading-tight">
                    Code committed.
                  </h3>

                  {/* Supporting Sentence */}
                  <p className="font-sans text-[13.5px] sm:text-[14px] text-[#8E8A82] leading-[1.6]">
                    Your repository is connected and ready to build.
                  </p>

                  {/* Discreet Repository Indicator */}
                  <div className="pt-1 flex items-center gap-2 font-mono text-[12px] text-[#A8A49C]">
                    <GitCommit className="w-3.5 h-3.5 text-accent-orange shrink-0" />
                    <span>acme/web-app · main</span>
                  </div>
                </div>
              </div>

              {/* =========================================================
                  STAGE 02 — BUILD (Center saddle pass)
                  ========================================================= */}
              <div className="col-span-4 flex flex-col justify-center items-center pointer-events-auto">
                <div
                  className={`space-y-2.5 max-w-[320px] w-full transition-all duration-500 ease-out ${
                    effectiveStage === 2
                      ? "opacity-100 translate-y-0"
                      : effectiveStage > 2
                      ? "opacity-65 translate-y-0"
                      : "opacity-35 translate-y-2"
                  }`}
                >
                  {/* Stage Number */}
                  <div className="font-mono text-[11px] font-medium text-accent-orange tracking-wider">
                    02
                  </div>

                  {/* Heading */}
                  <h3 className="font-sans text-[24px] sm:text-[26px] font-medium text-[#F2F0EB] tracking-[-0.02em] leading-tight">
                    Build verified.
                  </h3>

                  {/* Supporting Sentence */}
                  <p className="font-sans text-[13.5px] sm:text-[14px] text-[#8E8A82] leading-[1.6]">
                    Dependencies resolved. Application ready to ship.
                  </p>

                  {/* Simplified, Compact Build Verification Snippet */}
                  <div className="mt-2 w-full rounded-lg border border-[#262421]/80 bg-[#141517]/75 backdrop-blur-sm p-3 font-mono text-[11.5px] space-y-1.5 shadow-xl">
                    <div className="flex items-center justify-between text-[#8E8A82]">
                      <span>Dependencies resolved</span>
                      <span className={effectiveBuild.step1 ? "text-semantic-success flex items-center gap-1 font-medium" : "text-[#4A4742]"}>
                        {effectiveBuild.step1 ? <Check className="w-3 h-3 stroke-[2.5]" /> : "·"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[#8E8A82]">
                      <span>Application compiled</span>
                      <span className={effectiveBuild.step2 ? "text-semantic-success flex items-center gap-1 font-medium" : "text-[#4A4742]"}>
                        {effectiveBuild.step2 ? <Check className="w-3 h-3 stroke-[2.5]" /> : "·"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#22201D] text-[#8E8A82]">
                      <span className="text-[#F2F0EB] font-medium">Artifact hermetic</span>
                      <span className={effectiveBuild.step3 ? "text-semantic-success font-medium flex items-center gap-1" : "text-[#4A4742]"}>
                        {effectiveBuild.step3 ? (
                          <>
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            <span>Verified</span>
                          </>
                        ) : (
                          "Pending"
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* =========================================================
                  STAGE 03 — PRODUCTION (High summit peak)
                  ========================================================= */}
              <div className="col-span-4 flex flex-col justify-start pt-3 items-end text-right pointer-events-auto">
                <div
                  className={`space-y-2 max-w-[320px] transition-all duration-500 ease-out ${
                    effectiveStage === 3
                      ? "opacity-100 translate-y-0"
                      : "opacity-35 -translate-y-2"
                  }`}
                >
                  {/* Stage Number */}
                  <div className="font-mono text-[11px] font-medium text-semantic-success tracking-wider">
                    03
                  </div>

                  {/* Heading */}
                  <h3 className="font-sans text-[24px] sm:text-[26px] font-medium text-[#F2F0EB] tracking-[-0.02em] leading-tight">
                    Live in production.
                  </h3>

                  {/* Supporting Sentence */}
                  <p className="font-sans text-[13.5px] sm:text-[14px] text-[#8E8A82] leading-[1.6]">
                    Deployed globally. Ready for real traffic.
                  </p>

                  {/* Understated Production Indicator */}
                  <div className="pt-1.5 flex items-center justify-end gap-2.5 font-mono text-[13.5px]">
                    <span className="relative flex h-2 w-2">
                      <span
                        className={`absolute inline-flex h-full w-full rounded-full bg-semantic-success opacity-75 ${
                          effectiveBuild.isLive ? "animate-ping" : ""
                        }`}
                        style={{ animationDuration: "2.5s", animationIterationCount: 2 }}
                      />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-semantic-success" />
                    </span>
                    <a
                      href="https://meridian.jetway.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#F2F0EB] hover:text-accent-orange transition-colors font-semibold flex items-center gap-1.5"
                    >
                      <span>web-app.jetway.app</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-50" />
                    </a>
                    <span className="text-semantic-success text-[11px] font-medium">Live</span>
                  </div>
                </div>
              </div>

            </div>

            {/* -----------------------------------------------------------
                LAYER 4: MOBILE / TABLET VERTICAL MOUNTAIN TRAIL & MILESTONES
                (< 1024px: High-legibility vertical progression with hiker)
                ----------------------------------------------------------- */}
            <div className="block lg:hidden relative w-full h-full min-h-[580px] pl-12 sm:pl-16 py-4">

              {/* Vertical Alpine Trail SVG Track */}
              <div className="absolute left-2 top-0 bottom-0 w-10 h-full pointer-events-none" aria-hidden="true">
                <svg
                  viewBox="0 0 60 600"
                  preserveAspectRatio="none"
                  fill="none"
                  className="w-full h-full overflow-visible"
                >
                  <path
                    ref={mobilePathRef}
                    d={mobileTrailD}
                    stroke="#2A2825"
                    strokeWidth="1.8"
                    strokeDasharray="3 7"
                    strokeLinecap="round"
                  />
                  <path
                    ref={mobileTraveledPathRef}
                    d={mobileTrailD}
                    stroke="#D88762"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    style={{
                      strokeDasharray: "600px 600px",
                      strokeDashoffset: isReducedMotion ? "0px" : "600px",
                    }}
                  />

                  {/* Mobile Waypoint Reticles */}
                  <circle cx="30" cy="50" r="4.5" fill="#111110" stroke="#D88762" strokeWidth="1.8" />
                  <circle cx="30" cy="290" r="4.5" fill="#111110" stroke={effectiveBuild.step3 ? "#82B89D" : "#D88762"} strokeWidth="1.8" />
                  <circle cx="30" cy="540" r="5" fill="#111110" stroke={effectiveBuild.isLive ? "#82B89D" : "#383531"} strokeWidth="2" />

                  {/* Mobile Top-Down Hiker */}
                  <TopDownAscentHiker
                    hikerRef={mobileHikerRef}
                    leftBootRef={mobileLeftBootRef}
                    rightBootRef={mobileRightBootRef}
                    leftPoleRef={mobileLeftPoleRef}
                    rightPoleRef={mobileRightPoleRef}
                    torsoRef={mobileTorsoRef}
                  />
                </svg>
              </div>

              {/* Vertically Stacked Mobile Milestones */}
              <div className="space-y-12 sm:space-y-16">

                {/* Mobile Milestone 01: Source */}
                <div
                  className={`space-y-1.5 transition-all duration-500 ${
                    effectiveStage >= 1 ? "opacity-100" : "opacity-35"
                  }`}
                >
                  <div className="font-mono text-[10.5px] font-medium text-accent-orange tracking-wider">
                    01
                  </div>
                  <h3 className="font-sans text-[20px] font-medium text-[#F2F0EB]">
                    Code committed.
                  </h3>
                  <p className="font-sans text-[13px] text-[#8E8A82]">
                    Your repository is connected and ready to build.
                  </p>
                  <div className="pt-0.5 flex items-center gap-1.5 font-mono text-[11.5px] text-[#A8A49C]">
                    <GitCommit className="w-3.5 h-3.5 text-accent-orange" />
                    <span>acme/web-app · main</span>
                  </div>
                </div>

                {/* Mobile Milestone 02: Build */}
                <div
                  className={`space-y-1.5 transition-all duration-500 ${
                    effectiveStage >= 2 ? "opacity-100" : "opacity-35"
                  }`}
                >
                  <div className="font-mono text-[10.5px] font-medium text-accent-orange tracking-wider">
                    02
                  </div>
                  <h3 className="font-sans text-[20px] font-medium text-[#F2F0EB]">
                    Build verified.
                  </h3>
                  <p className="font-sans text-[13px] text-[#8E8A82]">
                    Dependencies resolved. Application ready to ship.
                  </p>
                  <div className="rounded-lg border border-[#262421]/80 bg-[#141517]/75 p-2.5 font-mono text-[11px] space-y-1 max-w-xs">
                    <div className="flex items-center justify-between text-[#8E8A82]">
                      <span>Dependencies</span>
                      <span className={effectiveBuild.step1 ? "text-semantic-success" : "text-[#4A4742]"}>
                        {effectiveBuild.step1 ? "✓" : "·"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[#8E8A82]">
                      <span>Compilation</span>
                      <span className={effectiveBuild.step2 ? "text-semantic-success" : "text-[#4A4742]"}>
                        {effectiveBuild.step2 ? "✓" : "·"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[#8E8A82]">
                      <span className="text-[#F2F0EB]">Artifact</span>
                      <span className={effectiveBuild.step3 ? "text-semantic-success font-medium" : "text-[#4A4742]"}>
                        {effectiveBuild.step3 ? "Verified ✓" : "Pending"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mobile Milestone 03: Production */}
                <div
                  className={`space-y-1.5 transition-all duration-500 ${
                    effectiveStage >= 3 ? "opacity-100" : "opacity-35"
                  }`}
                >
                  <div className="font-mono text-[10.5px] font-medium text-semantic-success tracking-wider">
                    03
                  </div>
                  <h3 className="font-sans text-[20px] font-medium text-[#F2F0EB]">
                    Live in production.
                  </h3>
                  <p className="font-sans text-[13px] text-[#8E8A82]">
                    Deployed globally. Ready for real traffic.
                  </p>
                  <div className="pt-0.5 flex items-center gap-2 font-mono text-[12px]">
                    <span className="w-2 h-2 rounded-full bg-semantic-success animate-pulse" />
                    <span className="text-[#F2F0EB] font-semibold">web-app.jetway.app</span>
                    <span className="text-semantic-success font-medium">Live</span>
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>
      </div>
    </section>
  );
}

export default GettingStarted;