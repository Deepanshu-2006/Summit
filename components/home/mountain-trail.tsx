"use client";

import React, { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
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

interface Landmark {
  id: string;
  index: string;
  title: string;
  elevation: string;
  y: number;
  passed: boolean;
}

/**
 * TopDownHiker Component
 *
 * Meticulously illustrated top-down miniature alpine expeditioner (zenith view):
 * - Wide-brim expedition sun hat with burnt-orange hatband
 * - Broad technical shoulders with alpine shell jacket
 * - Technical mountain backpack with burnt-orange top flap and rolled bedroll
 * - Two arms swinging trekking poles in alternating stride
 * - Two leather hiking boots stepping forward and backward
 * - Settles into grounded standing pose when user stops scrolling
 */
function TopDownHiker({
  x,
  y,
  angle,
  stride,
  armStride,
  sway,
  isWalking,
}: {
  x: number;
  y: number;
  angle: number;
  stride: number;
  armStride: number;
  sway: number;
  isWalking: boolean;
}) {
  const leftBootOffset = stride * 5.0;
  const rightBootOffset = -stride * 5.0;
  const leftArmOffset = -armStride * 4.5;
  const rightArmOffset = armStride * 4.5;
  const packBob = isWalking ? Math.abs(armStride) * 0.6 : 0;

  return (
    <g
      transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${angle.toFixed(1)})`}
      className="will-change-transform pointer-events-none"
      aria-hidden="true"
    >
      {/* 1. Ambient Ground Contact Shadow */}
      <ellipse
        cx="0"
        cy={1 + packBob * 0.5}
        rx="11"
        ry="15"
        fill="#000000"
        opacity="0.5"
      />

      {/* 2. Walking Legs & Boots (Alternating stride) */}
      <g id="hiker-boots">
        {/* Left Boot */}
        <g transform={`translate(-5.5, ${(7 + leftBootOffset).toFixed(1)})`}>
          <rect
            x="-2.5"
            y="-4.5"
            width="5"
            height="9"
            rx="2.2"
            fill="#1E1D1B"
            stroke="#111110"
            strokeWidth="0.75"
          />
          {/* Burnt-Orange Lace Accent */}
          <line x1="-1.5" y1="-1" x2="1.5" y2="-1" stroke="#D88762" strokeWidth="0.8" />
          <line x1="-1.5" y1="1" x2="1.5" y2="1" stroke="#D88762" strokeWidth="0.8" />
          {/* Boot Toe Cap */}
          <ellipse cx="0" cy="-3.5" rx="2" ry="1.2" fill="#141312" />
        </g>

        {/* Right Boot */}
        <g transform={`translate(5.5, ${(7 + rightBootOffset).toFixed(1)})`}>
          <rect
            x="-2.5"
            y="-4.5"
            width="5"
            height="9"
            rx="2.2"
            fill="#1E1D1B"
            stroke="#111110"
            strokeWidth="0.75"
          />
          {/* Burnt-Orange Lace Accent */}
          <line x1="-1.5" y1="-1" x2="1.5" y2="-1" stroke="#D88762" strokeWidth="0.8" />
          <line x1="-1.5" y1="1" x2="1.5" y2="1" stroke="#D88762" strokeWidth="0.8" />
          {/* Boot Toe Cap */}
          <ellipse cx="0" cy="-3.5" rx="2" ry="1.2" fill="#141312" />
        </g>
      </g>

      {/* 3. Trekking Poles & Forearms */}
      <g id="hiker-poles">
        {/* Left Trekking Pole & Hand */}
        <g transform={`translate(-10, ${(-5 + leftArmOffset).toFixed(1)})`}>
          <line
            x1="-1.5"
            y1="-9"
            x2="1.5"
            y2="11"
            stroke="#8E8C86"
            strokeWidth="0.85"
            strokeLinecap="round"
          />
          <circle cx="0.8" cy="8" r="2.2" fill="none" stroke="#FAF8F5" strokeWidth="0.6" />
          <circle cx="1.5" cy="11" r="0.8" fill="#FAF8F5" />
          <rect x="-1" y="-3" width="2" height="4.5" rx="0.8" fill="#FAF8F5" />
        </g>

        {/* Right Trekking Pole & Hand */}
        <g transform={`translate(10, ${(-5 + rightArmOffset).toFixed(1)})`}>
          <line
            x1="1.5"
            y1="-9"
            x2="-1.5"
            y2="11"
            stroke="#8E8C86"
            strokeWidth="0.85"
            strokeLinecap="round"
          />
          <circle cx="-0.8" cy="8" r="2.2" fill="none" stroke="#FAF8F5" strokeWidth="0.6" />
          <circle cx="-1.5" cy="11" r="0.8" fill="#FAF8F5" />
          <rect x="-1" y="-3" width="2" height="4.5" rx="0.8" fill="#FAF8F5" />
        </g>
      </g>

      {/* 4. Torso & Shoulders with subtle gait sway */}
      <g transform={`rotate(${sway.toFixed(1)})`}>
        {/* Alpine Shell Jacket */}
        <path
          d="M -9 -5 C -9 -8, 9 -8, 9 -5 C 9.5 0, 8.5 4, 7.5 5 C 4 6, -4 6, -7.5 5 C -8.5 4, -9.5 0, -9 -5 Z"
          fill="#34322E"
          stroke="#262422"
          strokeWidth="0.75"
        />

        {/* Technical Expedition Backpack */}
        <g transform={`translate(0, ${(1 + packBob).toFixed(1)})`}>
          {/* Main Pack Body */}
          <rect
            x="-7.5"
            y="-2"
            width="15"
            height="11"
            rx="3"
            fill="#23211E"
            stroke="#151413"
            strokeWidth="0.75"
          />
          {/* Top Lid / Brain (Summit Burnt Orange) */}
          <rect
            x="-6.5"
            y="-3"
            width="13"
            height="4"
            rx="1.5"
            fill="#D88762"
            stroke="#B96D4C"
            strokeWidth="0.5"
          />
          {/* Compression Straps */}
          <line x1="-3.5" y1="-3" x2="-3.5" y2="8" stroke="#111110" strokeWidth="0.75" />
          <line x1="3.5" y1="-3" x2="3.5" y2="8" stroke="#111110" strokeWidth="0.75" />
          {/* Rolled Sleeping Pad / Bedroll across top */}
          <rect
            x="-8"
            y="-5"
            width="16"
            height="3.2"
            rx="1.2"
            fill="#C97A56"
            stroke="#A35C3E"
            strokeWidth="0.5"
          />
          {/* Buckle Accents */}
          <rect x="-4" y="2" width="1" height="1.5" fill="#FAF8F5" />
          <rect x="3" y="2" width="1" height="1.5" fill="#FAF8F5" />
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
          <ellipse
            cx="0"
            cy="0"
            rx="4.2"
            ry="4.7"
            fill="none"
            stroke="#D88762"
            strokeWidth="0.85"
          />
          <ellipse
            cx="0"
            cy="0"
            rx="3.5"
            ry="4.0"
            fill="#2E2B27"
          />
          <circle cx="-2" cy="0" r="0.4" fill="#8E8C86" />
          <circle cx="2" cy="0" r="0.4" fill="#8E8C86" />
        </g>
      </g>
    </g>
  );
}

/**
 * MountainTrail Component
 *
 * Straight, clean vertical trail connecting:
 * - Start: Bottom of Hero (where the mountain meets Section 2)
 * - Section 2: Deployment Experience ("Ship without the ceremony.")
 * - Section 3: Product Experience ("From repository to reality.")
 * - Section 4: Application Stack ("One platform. Your entire stack.")
 * - End: Section 5: Developer Experience ("Built for the way you work.")
 *
 * The trail is completely straight, positioned safely in the left margin gutter
 * with zero text or UI collision. The top-down miniature hiker walks straight down
 * the trail as the user scrolls through these sections.
 */
export function MountainTrail() {
  const containerRef = useRef<HTMLDivElement>(null);
  const traveledLineRef = useRef<SVGLineElement>(null);

  const [lineCoords, setLineCoords] = useState<{
    x: number;
    startY: number;
    endY: number;
    totalHeight: number;
    width: number;
  }>({
    x: 120,
    startY: 800,
    endY: 4000,
    totalHeight: 6000,
    width: 1440,
  });

  const [landmarks, setLandmarks] = useState<Landmark[]>([]);

  // Hiker state
  const [hikerPos, setHikerPos] = useState<{
    x: number;
    y: number;
    angle: number;
    stride: number;
    armStride: number;
    sway: number;
    isWalking: boolean;
  }>({
    x: 120,
    y: 800,
    angle: 180,
    stride: 0,
    armStride: 0,
    sway: 0,
    isWalking: false,
  });

  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const targetYRef = useRef<number>(800);
  const currentYRef = useRef<number>(800);
  const lastYRef = useRef<number>(800);
  const strideAccumulatorRef = useRef<number>(0);
  const idleTimerRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  // Measure sections and calculate straight line bounds
  useEffect(() => {
    function computeGeometry() {
      if (!containerRef.current) return;
      const mainEl = containerRef.current.parentElement;
      if (!mainEl) return;

      const mainWidth = mainEl.offsetWidth;
      const mainHeight = mainEl.scrollHeight;
      if (mainWidth === 0 || mainHeight === 0) return;

      const heroEl = document.getElementById("hero");
      const deployEl = document.getElementById("deployment-experience");
      const stackEl = document.getElementById("platform-stack");
      const devexEl = document.getElementById("developer-experience");

      // Calculate container left and content edge
      const isMobile = mainWidth < 768;
      const isTablet = mainWidth >= 768 && mainWidth < 1024;
      const containerMax = Math.min(mainWidth, 1200);
      const gutterLeft = Math.max(16, (mainWidth - containerMax) / 2);

      // Position line safely in the left gutter, well clear of any text or bullets
      const lineX = isMobile
        ? 18
        : isTablet
        ? Math.max(20, gutterLeft + 12)
        : gutterLeft + 16;

      // Start: Bottom of Hero where mountain landscape transitions into Section 2
      const heroBottom = heroEl ? heroEl.offsetTop + heroEl.offsetHeight : 900;
      const deployTop = deployEl ? deployEl.offsetTop : heroBottom;
      const startY = Math.round(deployTop - 60);

      // End: In Section 5 (Developer Experience "Built for the way you work.")
      const devexBottom = devexEl ? devexEl.offsetTop + devexEl.offsetHeight : startY + 2800;
      const endY = Math.round(devexBottom - 60);

      setLineCoords({
        x: lineX,
        startY,
        endY,
        totalHeight: mainHeight,
        width: mainWidth,
      });

      // 4 Landmarks along this straight trail segment:
      // 1. Trailhead (at bottom of hero)
      // 2. Basecamp (at Section 2 Deployment Experience)
      // 3. High Pass (at Section 4 Platform Stack)
      // 4. Summit (at Section 5 Developer Experience end)
      const lms: Landmark[] = [
        {
          id: "lm-trailhead",
          index: "01",
          title: "TRAILHEAD",
          elevation: "1,200M",
          y: startY,
          passed: false,
        },
        {
          id: "lm-basecamp",
          index: "02",
          title: "BASECAMP",
          elevation: "1,840M",
          y: deployEl ? deployEl.offsetTop + 180 : startY + 400,
          passed: false,
        },
        {
          id: "lm-highpass",
          index: "03",
          title: "HIGH PASS",
          elevation: "2,680M",
          y: stackEl ? stackEl.offsetTop + 180 : (startY + endY) / 2,
          passed: false,
        },
        {
          id: "lm-summit",
          index: "04",
          title: "SUMMIT",
          elevation: "3,428M",
          y: endY,
          passed: false,
        },
      ];

      setLandmarks(lms);
      targetYRef.current = startY;
      currentYRef.current = startY;
      lastYRef.current = startY;
    }

    computeGeometry();

    let ro: ResizeObserver | null = null;
    if (containerRef.current?.parentElement && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => computeGeometry());
      ro.observe(containerRef.current.parentElement);
    }

    window.addEventListener("resize", computeGeometry, { passive: true });
    return () => {
      window.removeEventListener("resize", computeGeometry);
      if (ro) ro.disconnect();
    };
  }, []);

  // Update target Y based on scroll position
  const updateTargetY = useCallback(() => {
    if (typeof window === "undefined") return;

    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const vh = window.innerHeight;

    // The hiker tracks with the user's viewport (~45% down the screen)
    // while scrolling through the connected sections.
    const viewportGuideY = scrollY + vh * 0.45;
    const clampedY = Math.max(
      lineCoords.startY,
      Math.min(lineCoords.endY, viewportGuideY)
    );

    targetYRef.current = clampedY;
  }, [lineCoords.startY, lineCoords.endY]);

  // Lenis 1:1 synchronization
  useLenis(() => {
    updateTargetY();
  });

  // Native scroll fallback
  useEffect(() => {
    window.addEventListener("scroll", updateTargetY, { passive: true });
    return () => window.removeEventListener("scroll", updateTargetY);
  }, [updateTargetY]);

  // Reduced motion fallback (instant static positioning without stride physics)
  useEffect(() => {
    if (!isReducedMotion) return;

    const onScrollStatic = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const vh = window.innerHeight;
      const targetY = Math.max(
        lineCoords.startY,
        Math.min(lineCoords.endY, scrollY + vh * 0.45)
      );

      setHikerPos({
        x: lineCoords.x,
        y: targetY,
        angle: 180,
        stride: 0,
        armStride: 0,
        sway: 0,
        isWalking: false,
      });

      if (traveledLineRef.current) {
        traveledLineRef.current.setAttribute("y2", targetY.toFixed(1));
      }
    };

    onScrollStatic();
    window.addEventListener("scroll", onScrollStatic, { passive: true });
    return () => window.removeEventListener("scroll", onScrollStatic);
  }, [isReducedMotion, lineCoords]);

  // Fluid 60fps Animation Loop: Straight Motion & Gait Physics
  useEffect(() => {
    if (isReducedMotion) return;

    let isRunning = true;
    let lastTime = performance.now();

    const loop = (time: number) => {
      if (!isRunning) return;

      const dt = Math.min(32, time - lastTime);
      lastTime = time;

      const target = targetYRef.current;
      const current = currentYRef.current;

      // Snappy, organic damping
      const delta = (target - current) * 0.16;
      currentYRef.current += delta;

      const newY = currentYRef.current;
      const dy = newY - lastYRef.current;
      lastYRef.current = newY;

      const speed = Math.abs(dy);
      const isWalking = speed > 0.12;

      if (isWalking) {
        strideAccumulatorRef.current += dy;
        idleTimerRef.current = 0;
      } else {
        idleTimerRef.current += dt;
      }

      // One full human step every ~20px of descent
      const walkPhase = strideAccumulatorRef.current * 0.32;
      const idleFactor = Math.max(0, 1 - idleTimerRef.current / 220);

      const strideVal = Math.sin(walkPhase) * idleFactor;
      const armStrideVal = Math.cos(walkPhase) * idleFactor;
      const swayVal = Math.sin(walkPhase) * 2.2 * idleFactor;

      // Facing direction: 180° when moving down, smoothly flips to 0° if scrolling up
      const targetAngle = dy < -0.3 ? 0 : 180;

      setHikerPos((prev) => {
        let diff = ((targetAngle - prev.angle + 180) % 360) - 180;
        if (diff < -180) diff += 360;
        const nextAngle = prev.angle + diff * 0.20;

        return {
          x: lineCoords.x,
          y: newY,
          angle: nextAngle,
          stride: strideVal,
          armStride: armStrideVal,
          sway: swayVal,
          isWalking,
        };
      });

      // Update traveled straight line end coordinate
      if (traveledLineRef.current) {
        traveledLineRef.current.setAttribute("y2", newY.toFixed(1));
      }

      // Update landmark highlight status
      setLandmarks((prev) =>
        prev.map((lm) => {
          const isPassed = newY >= lm.y - 20;
          return lm.passed !== isPassed ? { ...lm, passed: isPassed } : lm;
        })
      );

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [isReducedMotion, lineCoords]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-[5] select-none"
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        viewBox={`0 0 ${lineCoords.width} ${lineCoords.totalHeight}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Luminous Traveled Route Gradient (Warm Ivory to Burnt Orange) */}
          <linearGradient id="straightTrailGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FAF8F5" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#D88762" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FFA67E" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* =================================================================
            1. BASE STRAIGHT UNTRAVELED TRAIL (Dashed Cartographic Line)
            Spans strictly from bottom of Hero to Section 5
            ================================================================= */}
        {/* Soft dark casing backdrop */}
        <line
          x1={lineCoords.x}
          y1={lineCoords.startY}
          x2={lineCoords.x}
          y2={lineCoords.endY}
          stroke="#161513"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Untraveled Stippled Dashed Footpath */}
        <line
          x1={lineCoords.x}
          y1={lineCoords.startY}
          x2={lineCoords.x}
          y2={lineCoords.endY}
          stroke="#383430"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          strokeLinecap="round"
          opacity="0.75"
        />

        {/* =================================================================
            2. PROGRESSIVE TRAVELED ROUTE (Solid Burnt-Orange Line)
            Follows the hiker in real time as the user scrolls
            ================================================================= */}
        <line
          ref={traveledLineRef}
          x1={lineCoords.x}
          y1={lineCoords.startY}
          x2={lineCoords.x}
          y2={hikerPos.y}
          stroke="url(#straightTrailGrad)"
          strokeWidth="1.85"
          strokeLinecap="round"
        />

        {/* =================================================================
            3. SPARSE SURVEYOR BENCHMARK LANDMARKS
            4 checkpoints: Trailhead, Basecamp, High Pass, Summit
            ================================================================= */}
        <g id="trail-landmarks">
          {landmarks.map((lm) => (
            <g
              key={lm.id}
              transform={`translate(${lineCoords.x}, ${lm.y})`}
              className="transition-opacity duration-300"
            >
              {/* Outer Benchmark Target Ring */}
              <circle
                cx="0"
                cy="0"
                r="4.5"
                fill="none"
                stroke={lm.passed ? "#D88762" : "#3C3935"}
                strokeWidth="0.8"
                className="transition-colors duration-300"
              />
              {/* Surveyor Reticle Crosshair */}
              <line
                x1="-6"
                y1="0"
                x2="6"
                y2="0"
                stroke={lm.passed ? "#FFA67E" : "#4A4641"}
                strokeWidth="0.65"
              />
              <line
                x1="0"
                y1="-6"
                x2="0"
                y2="6"
                stroke={lm.passed ? "#FFA67E" : "#4A4641"}
                strokeWidth="0.65"
              />
              {/* Center Geodesic Pin */}
              <circle
                cx="0"
                cy="0"
                r="1.8"
                fill={lm.passed ? "#D88762" : "#242220"}
                className="transition-colors duration-300"
              />

              {/* Monospace Surveyor Telemetry Badge */}
              <g transform="translate(12, 3)">
                <text
                  fill={lm.passed ? "#FAF8F5" : "#6E6B66"}
                  fontSize="8"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontWeight="600"
                  letterSpacing="0.10em"
                  className="transition-colors duration-300"
                >
                  {`${lm.index} // ${lm.title}`}
                </text>
                <text
                  y="9.5"
                  fill={lm.passed ? "#D88762" : "#55524D"}
                  fontSize="7.5"
                  fontFamily="var(--font-geist-mono), monospace"
                  letterSpacing="0.12em"
                  className="transition-colors duration-300"
                >
                  {`ELEV ${lm.elevation}`}
                </text>
              </g>
            </g>
          ))}
        </g>

        {/* =================================================================
            4. THE TOP-DOWN MINIATURE HIKER
            Walks straight down the vertical trail with dynamic gait
            ================================================================= */}
        <TopDownHiker
          x={hikerPos.x}
          y={hikerPos.y}
          angle={hikerPos.angle}
          stride={hikerPos.stride}
          armStride={hikerPos.armStride}
          sway={hikerPos.sway}
          isWalking={hikerPos.isWalking}
        />
      </svg>
    </div>
  );
}

export default MountainTrail;
