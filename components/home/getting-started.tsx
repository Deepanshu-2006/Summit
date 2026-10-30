"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
} from "react";
import Image from "next/image";
import { GitCommit, ExternalLink, Terminal, CheckCircle2 } from "lucide-react";
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
      <circle cx="0" cy="1" r="14" fill="#D88762" opacity="0.12" />
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
 * Completely Redesigned as an Authentic Ascent to Production:
 * - 01 SOURCE: Lower foothills (Code committed, acme/web-app, main · 8f3a21c)
 * - 02 BUILD & RELEASE: Mid-mountain pass (Artifact verified, hermetic build sequence)
 * - 03 LIVE DESTINATION: High alpine summit (Traffic shifted, web-app.jetway.demo, Live 200 OK)
 *
 * Driven by an engraved topographic mountain contour path with our miniature mountaineer.
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
  const mobilePathLengthRef = useRef<number>(800);

  // Hiker DOM Refs for direct 60fps/120fps RAF transforms
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

  // Animation and storytelling state tracking
  const animRef = useRef({
    targetProgress: 0,
    currentProgress: 0,
    walkCycle: 0,
    stride: 0,
    armStride: 0,
    sway: 0,
    isWalking: false,
    lastDistance: 0,
    rafId: null as number | null,
  });

  // Storytelling milestone activation states [0, 1, 2, 3]
  const [activeStage, setActiveStage] = useState<number>(0);
  const [buildStepState, setBuildStepState] = useState<{
    step1: "queued" | "running" | "done";
    step2: "waiting" | "compiling" | "done";
    step3: "pending" | "verifying" | "done";
    releaseVerified: boolean;
    isLive: boolean;
  }>({
    step1: "queued",
    step2: "waiting",
    step3: "pending",
    releaseVerified: false,
    isLive: false,
  });

  // Desktop Trail Path Coordinates:
  // Starts at lower-left foothills (140, 360)
  // Ascends through center mountain pass (580, 230)
  // Reaches high alpine summit crest (1050, 95)
  const desktopTrailD =
    "M 140 360 " +
    "C 240 360, 340 330, 430 290 " +
    "C 480 268, 530 245, 580 230 " +
    "C 660 210, 750 180, 840 145 " +
    "C 910 120, 980 102, 1050 95";

  // Mobile Vertical Trail Path Coordinates:
  // Downhill winding topographic route connecting the 3 vertically stacked milestones
  const mobileTrailD =
    "M 36 60 " +
    "C 68 120, 12 180, 48 240 " +
    "C 60 268, 50 295, 36 320 " +
    "C 18 355, 62 430, 22 500 " +
    "C 8 540, 52 590, 36 640";

  // Measure path lengths on mount and window resize
  useEffect(() => {
    if (pathRef.current) {
      try {
        const len = pathRef.current.getTotalLength();
        if (len > 0) pathLengthRef.current = len;
      } catch {}
    }
    if (mobilePathRef.current) {
      try {
        const len = mobilePathRef.current.getTotalLength();
        if (len > 0) mobilePathLengthRef.current = len;
      } catch {}
    }
  }, []);

  // Update hiker transform and SVG traveled path with direct DOM manipulation
  const updateHikerAndTrail = useCallback(
    (dist: number, anim: typeof animRef.current) => {
      // 1. Desktop Hiker & Path
      const desktopPath = pathRef.current;
      const totalLen = pathLengthRef.current;

      if (desktopPath && totalLen > 0) {
        const clampedDist = Math.max(0, Math.min(totalLen, dist));
        const pt = desktopPath.getPointAtLength(clampedDist);

        // Compute tangent angle for natural hiker facing
        const sampleDist = Math.min(totalLen, clampedDist + 2.0);
        const samplePt = desktopPath.getPointAtLength(sampleDist);
        const dx = samplePt.x - pt.x;
        const dy = samplePt.y - pt.y;
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI;

        // Apply direct transform on desktop hiker
        if (hikerRef.current) {
          hikerRef.current.setAttribute(
            "transform",
            `translate(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}) rotate(${angle.toFixed(1)})`
          );
        }

        // Gait mechanics (boots and poles)
        const strideOffset = anim.stride * 4.5;
        const armOffset = anim.armStride * 4.0;
        const swayAngle = anim.sway * 1.5;

        if (leftBootRef.current) {
          leftBootRef.current.setAttribute(
            "transform",
            `translate(-5.5, ${(7 + strideOffset).toFixed(2)})`
          );
        }
        if (rightBootRef.current) {
          rightBootRef.current.setAttribute(
            "transform",
            `translate(5.5, ${(7 - strideOffset).toFixed(2)})`
          );
        }
        if (leftPoleRef.current) {
          leftPoleRef.current.setAttribute(
            "transform",
            `translate(-9, ${(-5 - armOffset).toFixed(2)})`
          );
        }
        if (rightPoleRef.current) {
          rightPoleRef.current.setAttribute(
            "transform",
            `translate(9, ${(-5 + armOffset).toFixed(2)})`
          );
        }
        if (torsoRef.current) {
          torsoRef.current.setAttribute(
            "transform",
            `rotate(${swayAngle.toFixed(2)})`
          );
        }

        // Traveled path strokeDashoffset (illuminates behind hiker)
        const offsetVal = Math.max(0, totalLen - clampedDist);
        if (traveledPathRef.current) {
          traveledPathRef.current.style.strokeDashoffset = `${offsetVal.toFixed(1)}px`;
        }
        if (traveledGlowRef.current) {
          traveledGlowRef.current.style.strokeDashoffset = `${offsetVal.toFixed(1)}px`;
        }
      }

      // 2. Mobile Hiker & Path
      const mobilePath = mobilePathRef.current;
      const mobileTotalLen = mobilePathLengthRef.current;

      if (mobilePath && mobileTotalLen > 0) {
        const mobileDist = Math.max(0, Math.min(mobileTotalLen, anim.currentProgress * mobileTotalLen));
        const pt = mobilePath.getPointAtLength(mobileDist);

        const sampleDist = Math.min(mobileTotalLen, mobileDist + 2.0);
        const samplePt = mobilePath.getPointAtLength(sampleDist);
        const dx = samplePt.x - pt.x;
        const dy = samplePt.y - pt.y;
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI;

        if (mobileHikerRef.current) {
          mobileHikerRef.current.setAttribute(
            "transform",
            `translate(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}) rotate(${angle.toFixed(1)})`
          );
        }

        const strideOffset = anim.stride * 4.5;
        const armOffset = anim.armStride * 4.0;
        const swayAngle = anim.sway * 1.5;

        if (mobileLeftBootRef.current) {
          mobileLeftBootRef.current.setAttribute(
            "transform",
            `translate(-5.5, ${(7 + strideOffset).toFixed(2)})`
          );
        }
        if (mobileRightBootRef.current) {
          mobileRightBootRef.current.setAttribute(
            "transform",
            `translate(5.5, ${(7 - strideOffset).toFixed(2)})`
          );
        }
        if (mobileLeftPoleRef.current) {
          mobileLeftPoleRef.current.setAttribute(
            "transform",
            `translate(-9, ${(-5 - armOffset).toFixed(2)})`
          );
        }
        if (mobileRightPoleRef.current) {
          mobileRightPoleRef.current.setAttribute(
            "transform",
            `translate(9, ${(-5 + armOffset).toFixed(2)})`
          );
        }
        if (mobileTorsoRef.current) {
          mobileTorsoRef.current.setAttribute(
            "transform",
            `rotate(${swayAngle.toFixed(2)})`
          );
        }

        const mobileOffset = Math.max(0, mobileTotalLen - mobileDist);
        if (mobileTraveledPathRef.current) {
          mobileTraveledPathRef.current.style.strokeDashoffset = `${mobileOffset.toFixed(1)}px`;
        }
      }
    },
    []
  );

  // Smooth animation tick loop (60fps/120fps with damping)
  const startTick = useCallback(() => {
    const anim = animRef.current;
    if (anim.rafId !== null) return;

    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(32, now - lastTime);
      lastTime = now;

      // Smooth damping (0.14)
      const diff = anim.targetProgress - anim.currentProgress;

      if (Math.abs(diff) < 0.0008) {
        anim.currentProgress = anim.targetProgress;
        anim.isWalking = false;
        anim.stride = 0;
        anim.armStride = 0;
        anim.sway = 0;

        const targetDist = anim.currentProgress * pathLengthRef.current;
        updateHikerAndTrail(targetDist, anim);
        anim.rafId = null;
        return;
      }

      anim.currentProgress += diff * 0.14;
      const targetDist = anim.currentProgress * pathLengthRef.current;
      const deltaD = targetDist - anim.lastDistance;
      anim.lastDistance = targetDist;

      // Realistic alpine stride kinematics
      anim.isWalking = Math.abs(deltaD) > 0.08;
      if (anim.isWalking) {
        anim.walkCycle += deltaD * 0.22;
        anim.stride = Math.sin(anim.walkCycle);
        anim.armStride = Math.cos(anim.walkCycle);
        anim.sway = Math.sin(anim.walkCycle * 0.5);
      } else {
        anim.stride *= 0.85;
        anim.armStride *= 0.85;
        anim.sway *= 0.85;
      }

      updateHikerAndTrail(targetDist, anim);

      // Coordinated Stage & Milestone State updates
      const p = anim.currentProgress;
      const stage = p < 0.25 ? 1 : p < 0.70 ? 2 : 3;
      setActiveStage(stage);

      // Build sequence step updates
      setBuildStepState({
        step1: p >= 0.44 ? "done" : p >= 0.34 ? "running" : "queued",
        step2: p >= 0.54 ? "done" : p >= 0.44 ? "compiling" : "waiting",
        step3: p >= 0.64 ? "done" : p >= 0.54 ? "verifying" : "pending",
        releaseVerified: p >= 0.64,
        isLive: p >= 0.85,
      });

      anim.rafId = requestAnimationFrame(tick);
    };

    anim.rafId = requestAnimationFrame(tick);
  }, [updateHikerAndTrail]);

  // Compute scroll progress from sticky container position
  const computeScrollProgress = useCallback(() => {
    if (!sectionRef.current) return;

    const rect = sectionRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const scrollDistance = rect.height - vh;
    if (scrollDistance <= 0) return;

    const currentScroll = -rect.top;
    const rawProgress = currentScroll / scrollDistance;
    const clampedProgress = Math.max(0, Math.min(1, rawProgress));

    animRef.current.targetProgress = clampedProgress;

    if (isReducedMotion) {
      animRef.current.currentProgress = clampedProgress;
      updateHikerAndTrail(clampedProgress * pathLengthRef.current, animRef.current);
      const stage = clampedProgress < 0.25 ? 1 : clampedProgress < 0.70 ? 2 : 3;
      setActiveStage(stage);
      setBuildStepState({
        step1: clampedProgress >= 0.44 ? "done" : clampedProgress >= 0.34 ? "running" : "queued",
        step2: clampedProgress >= 0.54 ? "done" : clampedProgress >= 0.44 ? "compiling" : "waiting",
        step3: clampedProgress >= 0.64 ? "done" : clampedProgress >= 0.54 ? "verifying" : "pending",
        releaseVerified: clampedProgress >= 0.64,
        isLive: clampedProgress >= 0.85,
      });
      return;
    }

    startTick();
  }, [isReducedMotion, startTick, updateHikerAndTrail]);

  // Lenis scroll listener
  useLenis(() => {
    computeScrollProgress();
  });

  // Native scroll and resize listeners
  useEffect(() => {
    const onResize = () => {
      if (pathRef.current) {
        try {
          const len = pathRef.current.getTotalLength();
          if (len > 0) pathLengthRef.current = len;
        } catch {}
      }
      if (mobilePathRef.current) {
        try {
          const len = mobilePathRef.current.getTotalLength();
          if (len > 0) mobilePathLengthRef.current = len;
        } catch {}
      }
      computeScrollProgress();
    };

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", computeScrollProgress, { passive: true });

    // Initial measurement
    const timer = setTimeout(() => {
      onResize();
    }, 60);

    const anim = animRef.current;
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", computeScrollProgress);
      if (anim.rafId !== null) {
        cancelAnimationFrame(anim.rafId);
      }
    };
  }, [computeScrollProgress]);

  // Reduced motion static fallback values
  const effectiveStage = isReducedMotion ? 3 : activeStage;
  const effectiveBuild = isReducedMotion
    ? {
        step1: "done" as const,
        step2: "done" as const,
        step3: "done" as const,
        releaseVerified: true,
        isLive: true,
      }
    : buildStepState;

  return (
    <section
      ref={sectionRef}
      id="getting-started"
      className={
        isReducedMotion
          ? "relative w-full my-28 sm:my-36 lg:my-48 bg-transparent text-[#F2F0EB] select-none"
          : "relative w-full h-[260vh] sm:h-[280vh] lg:h-[300vh] my-[32vh] sm:my-[38vh] lg:my-[44vh] bg-transparent text-[#F2F0EB] select-none"
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
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
                <span className="font-mono text-[11px] text-[#A8A49C] tracking-[0.16em] uppercase">
                  THE DEPLOYMENT JOURNEY · AN ASCENT TO PRODUCTION
                </span>
              </div>

              {/* Confident Heading with deliberate line break */}
              <h2
                id="getting-started-heading"
                className="font-sans text-[32px] sm:text-[42px] lg:text-[50px] font-medium leading-[1.06] tracking-[-0.035em] text-[#F2F0EB]"
              >
                From first commit<br className="hidden sm:inline" /> to first deploy.
              </h2>
            </div>

            {/* Supporting Copy */}
            <p className="font-sans text-[13.5px] sm:text-[14.5px] text-[#8E8A82] leading-[1.6] max-w-[440px] pb-0.5 shrink-0">
              Your next deployment doesn’t need a complicated setup. Start with your
              code, configure your application, and get ready to ship.
            </p>
          </div>

          {/* =============================================================
              MAIN VISUAL STAGE: THE MOUNTAIN ASCENT TO PRODUCTION
              An authentic panoramic alpine landscape connecting 3 milestones:
                01 SOURCE (Foothills) -> 02 BUILD ENGINE (Pass) -> 03 LIVE (Peak)
              ============================================================= */}
          <div className="relative w-full flex-1 min-h-[460px] max-h-[580px] rounded-xl border border-[#22201E]/70 bg-[#121315]/40 backdrop-blur-[2px] overflow-hidden flex flex-col justify-between p-4 sm:p-6 lg:p-8">

            {/* -----------------------------------------------------------
                LAYER 1: BACKGROUND ENGRAVED ALPINE ARTWORK & VIGNETTE
                ----------------------------------------------------------- */}
            <div className="absolute inset-0 pointer-events-none select-none overflow-hidden" aria-hidden="true">
              <div className="relative w-full h-full opacity-15 mix-blend-screen">
                <Image
                  src="/images/hero/hero-engraved-mountains-panoramic.webp"
                  alt=""
                  fill
                  quality={80}
                  className="object-cover object-[center_bottom]"
                />
              </div>
              {/* Radial gradient shading behind text flank */}
              <div
                className="absolute inset-0 w-full h-full"
                style={{
                  background:
                    "radial-gradient(ellipse 90% 80% at 50% 50%, transparent 40%, rgba(17, 17, 17, 0.75) 100%)",
                }}
              />
            </div>

            {/* -----------------------------------------------------------
                LAYER 2: DESKTOP / TABLET PANORAMIC MOUNTAIN PATH & CONTOURS
                (Hidden on mobile; renders SVG viewBox with exact coordinates)
                ----------------------------------------------------------- */}
            <div className="hidden lg:block absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
              <svg
                viewBox="0 0 1200 480"
                preserveAspectRatio="none"
                fill="none"
                className="w-full h-full overflow-visible"
              >
                {/* Defs: Burnt Orange to Sage Green Gradient for Summit Arrival */}
                <defs>
                  <linearGradient id="ascentTrailGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#D88762" />
                    <stop offset="70%" stopColor="#E58B65" />
                    <stop offset="100%" stopColor="#82B89D" />
                  </linearGradient>

                  <filter id="ascentGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* --- 1. Background Cartographic Elevation Contours --- */}
                {/* Lower Valley Foot Contour */}
                <path
                  d="M 0 420 C 220 420, 360 395, 540 375 S 900 350, 1200 330"
                  stroke="#262421"
                  strokeWidth="1"
                  strokeDasharray="4 14"
                  className="opacity-45"
                />
                {/* Saddle Pass Contour */}
                <path
                  d="M 60 360 C 260 340, 420 295, 600 255 S 960 195, 1200 160"
                  stroke="#2F2C28"
                  strokeWidth="1"
                  strokeDasharray="3 11"
                  className="opacity-45"
                />
                {/* Summit High Peak Contour */}
                <path
                  d="M 280 260 C 480 220, 680 165, 880 115 S 1080 75, 1200 65"
                  stroke="#383430"
                  strokeWidth="1.2"
                  strokeDasharray="5 15"
                  className="opacity-50"
                />

                {/* --- 2. Geodesic Mountain Benchmarks --- */}
                {/* Benchmark 01: Valley Origin */}
                <g transform="translate(140, 395)" className="opacity-40">
                  <circle cx="0" cy="0" r="2.5" fill="#8E8C86" />
                  <line x1="-5" y1="0" x2="5" y2="0" stroke="#77736D" strokeWidth="0.75" />
                  <line x1="0" y1="-5" x2="0" y2="5" stroke="#77736D" strokeWidth="0.75" />
                  <text
                    x="8"
                    y="3"
                    fill="#8E8A82"
                    fontSize="9"
                    fontFamily="var(--font-geist-mono)"
                    letterSpacing="0.14em"
                  >
                    ORIGIN // ELEV 1,240M
                  </text>
                </g>

                {/* Benchmark 02: Engine Pass */}
                <g transform="translate(580, 205)" className="opacity-40">
                  <circle cx="0" cy="0" r="2.5" fill="#8E8C86" />
                  <line x1="-5" y1="0" x2="5" y2="0" stroke="#77736D" strokeWidth="0.75" />
                  <line x1="0" y1="-5" x2="0" y2="5" stroke="#77736D" strokeWidth="0.75" />
                  <text
                    x="8"
                    y="3"
                    fill="#8E8A82"
                    fontSize="9"
                    fontFamily="var(--font-geist-mono)"
                    letterSpacing="0.14em"
                  >
                    PASS // ELEV 2,180M
                  </text>
                </g>

                {/* Benchmark 03: High Summit Peak */}
                <g transform="translate(1050, 65)" className="opacity-45">
                  <circle cx="0" cy="0" r="3" fill="#FAF8F5" />
                  <line x1="-6" y1="0" x2="6" y2="0" stroke="#FAF8F5" strokeWidth="0.8" />
                  <line x1="0" y1="-6" x2="0" y2="6" stroke="#FAF8F5" strokeWidth="0.8" />
                  <text
                    x="9"
                    y="3.5"
                    fill="#FAF8F5"
                    fontSize="9"
                    fontFamily="var(--font-geist-mono)"
                    letterSpacing="0.16em"
                  >
                    SUMMIT // ELEV 3,420M
                  </text>
                </g>

                {/* --- 3. The Mountain Trail (Continuous Organic Ascent) --- */}
                {/* A. Baseline Engraved Trail (Muted) */}
                <path
                  ref={pathRef}
                  d={desktopTrailD}
                  stroke="#2E2C29"
                  strokeWidth="2"
                  strokeDasharray="3 7"
                  strokeLinecap="round"
                />

                {/* B. Traveled Path Ambient Burnt-Orange Glow */}
                <path
                  ref={traveledGlowRef}
                  d={desktopTrailD}
                  stroke="url(#ascentTrailGradient)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  opacity="0.30"
                  filter="url(#ascentGlow)"
                  style={{
                    strokeDasharray: "1000px 1000px",
                    strokeDashoffset: isReducedMotion ? "0px" : "1000px",
                  }}
                />

                {/* C. Traveled Path Core Solid Conquered Trail */}
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

                {/* D. Waypoint Markers along Trail */}
                {/* Station 01 Marker */}
                <circle
                  cx="140"
                  cy="360"
                  r="5"
                  fill="#111110"
                  stroke={effectiveStage >= 1 ? "#D88762" : "#44403B"}
                  strokeWidth="2"
                />
                <circle
                  cx="140"
                  cy="360"
                  r="2"
                  fill={effectiveStage >= 1 ? "#D88762" : "#2E2C29"}
                />

                {/* Station 02 Marker */}
                <circle
                  cx="580"
                  cy="230"
                  r="5.5"
                  fill="#111110"
                  stroke={effectiveBuild.releaseVerified ? "#82B89D" : effectiveStage >= 2 ? "#D88762" : "#44403B"}
                  strokeWidth="2"
                />
                <circle
                  cx="580"
                  cy="230"
                  r="2.5"
                  fill={effectiveBuild.releaseVerified ? "#82B89D" : effectiveStage >= 2 ? "#D88762" : "#2E2C29"}
                />

                {/* Station 03 Marker (Summit Peak) */}
                <circle
                  cx="1050"
                  cy="95"
                  r="6"
                  fill="#111110"
                  stroke={effectiveBuild.isLive ? "#82B89D" : "#44403B"}
                  strokeWidth="2"
                />
                <circle
                  cx="1050"
                  cy="95"
                  r="3"
                  fill={effectiveBuild.isLive ? "#82B89D" : "#2E2C29"}
                />

                {/* --- 4. The Miniature Top-Down Mountaineer (Ascent Hiker) --- */}
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
                LAYER 3: ASYMMETRIC DEPLOYMENT MILESTONES (DESKTOP)
                Integrated directly into the mountain composition without
                identical cards or cluttered boxes.
                ----------------------------------------------------------- */}
            <div className="hidden lg:grid grid-cols-12 gap-6 w-full h-full relative z-10 pointer-events-none">

              {/* =========================================================
                  MILESTONE 01: SOURCE (Lower Left Foothills · Elev 1,240M)
                  The origin of the journey: clean, grounded code entry.
                  ========================================================= */}
              <div className="col-span-3 flex flex-col justify-end pb-2 pointer-events-auto">
                <div
                  className={`space-y-2.5 transition-all duration-500 ${
                    effectiveStage >= 1 ? "opacity-100 translate-y-0" : "opacity-35 translate-y-2"
                  }`}
                >
                  {/* Eyebrow & Elevation */}
                  <div className="flex items-center justify-between font-mono text-[10.5px] text-[#8E8A82] tracking-[0.14em] uppercase">
                    <span className="text-accent-orange font-medium">01 / SOURCE</span>
                    <span>1,240M</span>
                  </div>

                  {/* Confident Heading */}
                  <h3 className="font-sans text-[22px] font-medium text-[#F2F0EB] tracking-tight">
                    Code committed.
                  </h3>

                  {/* Repository Identity */}
                  <div className="font-mono text-[14.5px] font-medium text-[#F2F0EB] pt-0.5">
                    acme/web-app
                  </div>

                  {/* Commit Badge */}
                  <div className="flex items-center gap-2 font-mono text-[12px] text-[#A8A49C]">
                    <GitCommit className="w-3.5 h-3.5 text-accent-orange shrink-0" />
                    <span>main · 8f3a21c</span>
                  </div>

                  {/* Supporting Trigger Status */}
                  <p className="font-mono text-[11px] text-[#77736D] leading-relaxed pt-1">
                    Webhook received · Pipeline triggered
                  </p>
                </div>
              </div>

              {/* =========================================================
                  MILESTONE 02: BUILD & RELEASE ENGINE (Center Saddle Pass · Elev 2,180M)
                  The active crucible of compilation and verification.
                  ========================================================= */}
              <div className="col-span-5 flex flex-col justify-center items-center pointer-events-auto pt-6">
                <div
                  className={`w-full max-w-[400px] space-y-3 transition-all duration-500 ${
                    effectiveStage >= 2 ? "opacity-100 translate-y-0" : "opacity-40 translate-y-2"
                  }`}
                >
                  {/* Eyebrow & Elevation */}
                  <div className="flex items-center justify-between font-mono text-[10.5px] text-[#8E8A82] tracking-[0.14em] uppercase">
                    <span className="text-accent-orange font-medium">02 / BUILD & RELEASE</span>
                    <span>2,180M PASS</span>
                  </div>

                  {/* Confident Heading */}
                  <h3 className="font-sans text-[22px] font-medium text-[#F2F0EB] tracking-tight">
                    Artifact verified.
                  </h3>

                  {/* Compact Engineered Build Runner Terminal Panel */}
                  <div className="w-full rounded-lg bg-[#141618]/90 border border-[#26282B] shadow-2xl p-3.5 space-y-2.5">
                    {/* Panel Header */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#22201E] font-mono text-[10.5px] text-[#77736D]">
                      <div className="flex items-center gap-1.5">
                        <Terminal className="w-3 h-3 text-accent-orange" />
                        <span className="text-[#A8A49C]">BUILD RUNNER</span>
                      </div>
                      <span className="text-[10px]">linux-amd64</span>
                    </div>

                    {/* Sequential Build Operations */}
                    <div className="space-y-2 font-mono text-[11.5px]">
                      {/* Op 1: Resolving dependencies */}
                      <div className="flex items-center justify-between">
                        <span
                          className={
                            effectiveBuild.step1 === "running"
                              ? "text-[#F2F0EB] font-medium"
                              : effectiveBuild.step1 === "done"
                              ? "text-[#8E8A82]"
                              : "text-[#44423E]"
                          }
                        >
                          Resolving dependencies
                        </span>
                        {effectiveBuild.step1 === "done" ? (
                          <span className="text-semantic-success text-[10.5px] flex items-center gap-1">
                            <span>DONE</span>
                            <span className="text-[#44423E]">·</span>
                            <span className="text-[#77736D]">1.2s</span>
                          </span>
                        ) : effectiveBuild.step1 === "running" ? (
                          <span className="text-accent-orange text-[10.5px] font-medium tracking-wider animate-pulse">
                            RESOLVING
                          </span>
                        ) : (
                          <span className="text-[#383532] text-[10.5px]">QUEUED</span>
                        )}
                      </div>

                      {/* Op 2: Compiling application */}
                      <div className="flex items-center justify-between">
                        <span
                          className={
                            effectiveBuild.step2 === "compiling"
                              ? "text-[#F2F0EB] font-medium"
                              : effectiveBuild.step2 === "done"
                              ? "text-[#8E8A82]"
                              : "text-[#44423E]"
                          }
                        >
                          Compiling application
                        </span>
                        {effectiveBuild.step2 === "done" ? (
                          <span className="text-semantic-success text-[10.5px] flex items-center gap-1">
                            <span>DONE</span>
                            <span className="text-[#44423E]">·</span>
                            <span className="text-[#77736D]">2.4s</span>
                          </span>
                        ) : effectiveBuild.step2 === "compiling" ? (
                          <span className="text-accent-orange text-[10.5px] font-medium tracking-wider animate-pulse">
                            COMPILING
                          </span>
                        ) : (
                          <span className="text-[#383532] text-[10.5px]">WAITING</span>
                        )}
                      </div>

                      {/* Op 3: Verifying build output */}
                      <div className="flex items-center justify-between">
                        <span
                          className={
                            effectiveBuild.step3 === "verifying"
                              ? "text-[#F2F0EB] font-medium"
                              : effectiveBuild.step3 === "done"
                              ? "text-[#8E8A82]"
                              : "text-[#44423E]"
                          }
                        >
                          Verifying build output
                        </span>
                        {effectiveBuild.step3 === "done" ? (
                          <span className="text-semantic-success text-[10.5px] flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3 h-3 text-semantic-success" />
                            <span>HERMETIC</span>
                          </span>
                        ) : effectiveBuild.step3 === "verifying" ? (
                          <span className="text-accent-orange text-[10.5px] font-medium tracking-wider animate-pulse">
                            VERIFYING
                          </span>
                        ) : (
                          <span className="text-[#383532] text-[10.5px]">PENDING</span>
                        )}
                      </div>
                    </div>

                    {/* Thin Progress Line */}
                    <div className="w-full h-[1.5px] bg-[#22201E] overflow-hidden rounded-full my-1" aria-hidden="true">
                      <div
                        className={`h-full transition-all duration-500 ease-out ${
                          effectiveBuild.releaseVerified ? "bg-semantic-success" : "bg-accent-orange"
                        }`}
                        style={{
                          width: effectiveBuild.releaseVerified
                            ? "100%"
                            : effectiveBuild.step3 === "verifying"
                            ? "80%"
                            : effectiveBuild.step2 === "compiling"
                            ? "50%"
                            : effectiveBuild.step1 === "running"
                            ? "20%"
                            : "0%",
                        }}
                      />
                    </div>

                    {/* Verified Release Tag Output */}
                    <div
                      className={`pt-1 flex items-center justify-between font-mono text-[11px] transition-opacity duration-500 ${
                        effectiveBuild.releaseVerified ? "opacity-100" : "opacity-30"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[#F2F0EB]">release-v1.4.2</span>
                        <span className="text-semantic-success text-[10px]">Verified</span>
                      </div>
                      <span className="text-[#77736D] text-[10.5px]">sha256:8f3a21c</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* =========================================================
                  MILESTONE 03: LIVE DESTINATION (High Summit Peak · Elev 3,420M)
                  The triumphant arrival: prominent domain & live edge status.
                  ========================================================= */}
              <div className="col-span-4 flex flex-col justify-start pt-2 items-end pointer-events-auto text-right">
                <div
                  className={`space-y-3 transition-all duration-600 max-w-[320px] ${
                    effectiveStage >= 3 ? "opacity-100 translate-y-0" : "opacity-35 -translate-y-2"
                  }`}
                >
                  {/* Eyebrow & Elevation */}
                  <div className="flex items-center justify-end gap-2 font-mono text-[10.5px] text-[#8E8A82] tracking-[0.14em] uppercase">
                    <span className="text-semantic-success font-medium">03 / LIVE DESTINATION</span>
                    <span>·</span>
                    <span className="text-[#FAF8F5]">3,420M PEAK</span>
                  </div>

                  {/* Confident Heading */}
                  <h3 className="font-sans text-[22px] font-medium text-[#F2F0EB] tracking-tight">
                    Traffic shifted.
                  </h3>

                  {/* Monumental Typographic Deployed Domain (Never wraps) */}
                  <div className="pt-0.5">
                    <a
                      href="https://meridian.jetway.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 font-mono text-[20px] xl:text-[23px] font-bold tracking-tight text-[#F2F0EB] hover:text-accent-orange transition-colors whitespace-nowrap"
                    >
                      <span>web-app.jetway.demo</span>
                      <ExternalLink className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  </div>

                  {/* Sage-Green Live Status Confirmation */}
                  <div
                    className={`flex items-center justify-end gap-2 font-mono text-[12px] transition-opacity duration-500 ${
                      effectiveBuild.isLive ? "opacity-100 text-semantic-success font-medium" : "opacity-25 text-[#44423E]"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-semantic-success animate-pulse" />
                    <span>LIVE</span>
                    <span className="text-[#44423E]">·</span>
                    <span className="text-[#F2F0EB]">200 OK</span>
                    <span className="text-[#44423E]">·</span>
                    <span className="text-[#8E8A82]">Global Edge</span>
                  </div>

                  {/* Supporting Cutover Telemetry */}
                  <p className="font-mono text-[11px] text-[#77736D] leading-relaxed">
                    100% traffic cutover · Zero downtime release
                  </p>
                </div>
              </div>

            </div>

            {/* -----------------------------------------------------------
                LAYER 4: MOBILE / TABLET VERTICAL MOUNTAIN TRAIL & MILESTONES
                (< 1024px: High-legibility vertical progression with hiker)
                ----------------------------------------------------------- */}
            <div className="block lg:hidden relative w-full h-full min-h-[660px] pl-14 sm:pl-16 py-2">

              {/* Vertical Alpine Trail SVG Track */}
              <div className="absolute left-2 top-0 bottom-0 w-12 h-full pointer-events-none" aria-hidden="true">
                <svg
                  viewBox="0 0 72 700"
                  preserveAspectRatio="none"
                  fill="none"
                  className="w-full h-full overflow-visible"
                >
                  <path
                    ref={mobilePathRef}
                    d={mobileTrailD}
                    stroke="#2E2C29"
                    strokeWidth="2"
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
                      strokeDasharray: "800px 800px",
                      strokeDashoffset: isReducedMotion ? "0px" : "800px",
                    }}
                  />

                  {/* Mobile Waypoint Reticles */}
                  <circle cx="36" cy="60" r="4.5" fill="#111110" stroke="#D88762" strokeWidth="2" />
                  <circle cx="36" cy="320" r="4.5" fill="#111110" stroke={effectiveBuild.releaseVerified ? "#82B89D" : "#D88762"} strokeWidth="2" />
                  <circle cx="36" cy="640" r="5" fill="#111110" stroke={effectiveBuild.isLive ? "#82B89D" : "#44403B"} strokeWidth="2" />

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
              <div className="space-y-10 sm:space-y-12">

                {/* Mobile Milestone 01: Source */}
                <div
                  className={`space-y-2 transition-all duration-500 ${
                    effectiveStage >= 1 ? "opacity-100" : "opacity-35"
                  }`}
                >
                  <div className="flex items-center gap-2 font-mono text-[10.5px] text-[#8E8A82] tracking-[0.14em] uppercase">
                    <span className="text-accent-orange font-medium">01 / SOURCE</span>
                    <span>·</span>
                    <span>ELEV 1,240M</span>
                  </div>
                  <h3 className="font-sans text-[20px] font-medium text-[#F2F0EB]">
                    Code committed.
                  </h3>
                  <div className="font-mono text-[14px] font-medium text-[#F2F0EB]">
                    acme/web-app
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11.5px] text-[#A8A49C]">
                    <GitCommit className="w-3.5 h-3.5 text-accent-orange" />
                    <span>main · 8f3a21c</span>
                  </div>
                </div>

                {/* Mobile Milestone 02: Build Engine */}
                <div
                  className={`space-y-2.5 transition-all duration-500 ${
                    effectiveStage >= 2 ? "opacity-100" : "opacity-35"
                  }`}
                >
                  <div className="flex items-center gap-2 font-mono text-[10.5px] text-[#8E8A82] tracking-[0.14em] uppercase">
                    <span className="text-accent-orange font-medium">02 / BUILD & RELEASE</span>
                    <span>·</span>
                    <span>ELEV 2,180M</span>
                  </div>
                  <h3 className="font-sans text-[20px] font-medium text-[#F2F0EB]">
                    Artifact verified.
                  </h3>

                  <div className="rounded-lg bg-[#141618]/90 border border-[#26282B] p-3 space-y-2 font-mono text-[11.5px] max-w-sm">
                    <div className="flex items-center justify-between text-[10px] text-[#77736D] border-b border-[#22201E] pb-1">
                      <span>BUILD RUNNER</span>
                      <span>linux-amd64</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={effectiveBuild.step1 === "done" ? "text-[#8E8A82]" : "text-[#F2F0EB]"}>
                        Resolving dependencies
                      </span>
                      {effectiveBuild.step1 === "done" ? (
                        <span className="text-semantic-success text-[10px]">DONE · 1.2s</span>
                      ) : (
                        <span className="text-accent-orange text-[10px]">ACTIVE</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={effectiveBuild.step2 === "done" ? "text-[#8E8A82]" : "text-[#F2F0EB]"}>
                        Compiling application
                      </span>
                      {effectiveBuild.step2 === "done" ? (
                        <span className="text-semantic-success text-[10px]">DONE · 2.4s</span>
                      ) : (
                        <span className="text-[#44423E] text-[10px]">WAITING</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={effectiveBuild.step3 === "done" ? "text-[#8E8A82]" : "text-[#44423E]"}>
                        Verifying build output
                      </span>
                      {effectiveBuild.step3 === "done" ? (
                        <span className="text-semantic-success text-[10px]">HERMETIC</span>
                      ) : (
                        <span className="text-[#44423E] text-[10px]">PENDING</span>
                      )}
                    </div>

                    <div className="pt-1.5 border-t border-[#22201E] flex items-center justify-between text-[10.5px]">
                      <span className="text-[#F2F0EB] font-semibold">release-v1.4.2</span>
                      <span className="text-semantic-success">Verified</span>
                    </div>
                  </div>
                </div>

                {/* Mobile Milestone 03: Live Destination */}
                <div
                  className={`space-y-2 transition-all duration-500 ${
                    effectiveStage >= 3 ? "opacity-100" : "opacity-35"
                  }`}
                >
                  <div className="flex items-center gap-2 font-mono text-[10.5px] text-[#8E8A82] tracking-[0.14em] uppercase">
                    <span className="text-semantic-success font-medium">03 / LIVE DESTINATION</span>
                    <span>·</span>
                    <span className="text-[#FAF8F5]">ELEV 3,420M</span>
                  </div>
                  <h3 className="font-sans text-[20px] font-medium text-[#F2F0EB]">
                    Traffic shifted.
                  </h3>
                  <div className="font-mono text-[17px] sm:text-[19px] font-bold text-[#F2F0EB] break-all">
                    web-app.jetway.demo
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11.5px] text-semantic-success font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-semantic-success animate-pulse" />
                    <span>LIVE · 200 OK · Global Edge</span>
                  </div>
                  <p className="font-mono text-[10.5px] text-[#77736D]">
                    100% traffic cutover · Zero downtime release
                  </p>
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
