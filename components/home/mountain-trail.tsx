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

interface Checkpoint {
  id: string;
  index: string;
  title: string;
  subtext: string;
  y: number;
  passed: boolean;
}

/**
 * TopDownHiker Component
 *
 * Meticulously illustrated miniature alpine expeditioner viewed directly from above (zenith):
 * - Wide-brim expedition sun hat with Summit burnt-orange hatband
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
  visible,
}: {
  x: number;
  y: number;
  angle: number;
  stride: number;
  armStride: number;
  sway: number;
  isWalking: boolean;
  visible: boolean;
}) {
  const leftBootOffset = stride * 5.0;
  const rightBootOffset = -stride * 5.0;
  const leftArmOffset = -armStride * 4.5;
  const rightArmOffset = armStride * 4.5;
  const packBob = isWalking ? Math.abs(armStride) * 0.6 : 0;

  return (
    <g
      transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${angle.toFixed(1)})`}
      className={`will-change-transform pointer-events-none transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden="true"
    >
      {/* 1. Ambient Ground Contact Shadow */}
      <ellipse
        cx="0"
        cy={1 + packBob * 0.5}
        rx="11"
        ry="15"
        fill="#000000"
        opacity="0.55"
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
          <line x1="-1.5" y1="-1" x2="1.5" y2="-1" stroke="#D88762" strokeWidth="0.8" />
          <line x1="-1.5" y1="1" x2="1.5" y2="1" stroke="#D88762" strokeWidth="0.8" />
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
          <line x1="-1.5" y1="-1" x2="1.5" y2="-1" stroke="#D88762" strokeWidth="0.8" />
          <line x1="-1.5" y1="1" x2="1.5" y2="1" stroke="#D88762" strokeWidth="0.8" />
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
          <line x1="-3.5" y1="-3" x2="-3.5" y2="8" stroke="#111110" strokeWidth="0.75" />
          <line x1="3.5" y1="-3" x2="3.5" y2="8" stroke="#111110" strokeWidth="0.75" />
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
 * - Start: End of Hero Section (at the threshold into Section 2 Deployment)
 * - Section 2: Deployment Experience ("Ship without the ceremony.") -> 01 // DEPLOYMENT PIPELINE
 * - Section 3: Product Experience ("From repository to reality.") -> 02 // ARCHITECTURE
 * - Section 4: Application Stack ("One platform. Your entire stack.") -> 03 // APPLICATION STACK
 * - End: Section 5: Developer Experience ("Built for the way you work.") -> 04 // PRODUCTION SUMMIT
 *
 * Distinctive Visuals:
 * - Traveled trail looks definitively conquered: solid, luminous burnt-orange with glowing halo.
 * - Checkpoints correspond directly to the platform sections on the website.
 * - Completed checkpoints illuminate with glowing checked reticles and [ VERIFIED ] status badges.
 */
export function MountainTrail() {
  const containerRef = useRef<HTMLDivElement>(null);
  const traveledGlowRef = useRef<SVGLineElement>(null);
  const traveledCoreRef = useRef<SVGLineElement>(null);
  const traveledHighlightRef = useRef<SVGLineElement>(null);
  const traveledGlowLowerRef = useRef<SVGLineElement>(null);
  const traveledCoreLowerRef = useRef<SVGLineElement>(null);
  const traveledHighlightLowerRef = useRef<SVGLineElement>(null);

  const [lineCoords, setLineCoords] = useState<{
    x: number;
    startY: number;
    cp3Y: number;
    resumeY: number;
    endY: number;
    totalHeight: number;
    width: number;
    isDesktopGutter: boolean;
  }>({
    x: 120,
    startY: 900,
    cp3Y: 2100,
    resumeY: 3500,
    endY: 4200,
    totalHeight: 6000,
    width: 1440,
    isDesktopGutter: true,
  });

  const lineCoordsRef = useRef(lineCoords);
  useEffect(() => {
    lineCoordsRef.current = lineCoords;
  }, [lineCoords]);

  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [isHikerVisible, setIsHikerVisible] = useState<boolean>(false);

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
    y: 900,
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

  const targetYRef = useRef<number>(900);
  const currentYRef = useRef<number>(900);
  const lastYRef = useRef<number>(900);
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
      const productEl = document.getElementById("product-experience");
      const stackEl = document.getElementById("platform-stack");
      const benefitsEl = document.getElementById("platform-benefits");
      const devexEl = document.getElementById("developer-experience");

      const isMobile = mainWidth < 768;
      const isTablet = mainWidth >= 768 && mainWidth < 1024;
      const containerMax = Math.min(mainWidth, 1200);
      const gutterLeft = Math.max(16, (mainWidth - containerMax) / 2);

      // Line sits strictly in the left gutter
      const lineX = isMobile
        ? 18
        : isTablet
        ? Math.max(20, gutterLeft + 12)
        : gutterLeft + 16;

      // Start: End of Hero section (where Deployment section begins)
      const startY = deployEl
        ? deployEl.offsetTop
        : heroEl
        ? heroEl.offsetTop + heroEl.offsetHeight
        : 900;

      // Checkpoint Y coordinates corresponding to the website sections
      const cp1Y = deployEl ? deployEl.offsetTop + 140 : startY + 140;
      const cp2Y = productEl ? productEl.offsetTop + 140 : startY + 1100;
      const cp3Y = stackEl ? stackEl.offsetTop + 140 : startY + 2100;
      // Section 4 exit / lower trail start coordinate: at the top of platform-benefits conduit
      const resumeY = benefitsEl
        ? benefitsEl.offsetTop + 70
        : stackEl
        ? stackEl.offsetTop + stackEl.offsetHeight
        : cp3Y + 1400;
      const cp4Y = devexEl ? devexEl.offsetTop + 140 : resumeY + 900;

      // End: In Section 5 Developer Experience, right below Checkpoint 4
      const endY = devexEl
        ? devexEl.offsetTop + devexEl.offsetHeight - 80
        : cp4Y + 300;

      const isDesktopGutter = gutterLeft >= 80;

      setLineCoords((prev) => {
        if (
          prev.x === lineX &&
          prev.startY === startY &&
          prev.cp3Y === cp3Y &&
          prev.resumeY === resumeY &&
          prev.endY === endY &&
          prev.totalHeight === mainHeight &&
          prev.width === mainWidth &&
          prev.isDesktopGutter === isDesktopGutter
        ) {
          return prev;
        }
        return {
          x: lineX,
          startY,
          cp3Y,
          resumeY,
          endY,
          totalHeight: mainHeight,
          width: mainWidth,
          isDesktopGutter,
        };
      });

      // Website Checkpoints:
      // 01 // DEPLOYMENT PIPELINE (Ship without the ceremony)
      // 02 // ARCHITECTURE (From repository to reality)
      // 03 // APPLICATION STACK (One platform. Your entire stack)
      // 04 // PRODUCTION SUMMIT (Built for the way you work)
      const cps: Checkpoint[] = [
        {
          id: "cp-deploy",
          index: "01",
          title: "DEPLOYMENT PIPELINE",
          subtext: "SHIP WITHOUT CEREMONY",
          y: cp1Y,
          passed: false,
        },
        {
          id: "cp-product",
          index: "02",
          title: "ARCHITECTURE",
          subtext: "FROM REPO TO REALITY",
          y: cp2Y,
          passed: false,
        },
        {
          id: "cp-stack",
          index: "03",
          title: "APPLICATION STACK",
          subtext: "WEB · API · DB · WORKER",
          y: cp3Y,
          passed: false,
        },
        {
          id: "cp-devex",
          index: "04",
          title: "PRODUCTION SUMMIT",
          subtext: "BUILT FOR THE WAY YOU WORK",
          y: cp4Y,
          passed: false,
        },
      ];

      setCheckpoints((prev) => {
        if (
          prev.length === cps.length &&
          prev.every((p, i) => p.y === cps[i].y && p.title === cps[i].title)
        ) {
          return prev;
        }
        return cps;
      });

      if (currentYRef.current === 900) {
        targetYRef.current = startY;
        currentYRef.current = startY;
        lastYRef.current = startY;
      }
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

    // Viewport focal line: ~45% down the screen
    const viewportGuideY = scrollY + vh * 0.45;

    // Check if user is currently inside Section 4's pinned exploration track
    const stackEl = document.getElementById("platform-stack");
    const stackTop = stackEl ? stackEl.offsetTop : 0;
    const stackHeight = stackEl ? stackEl.offsetHeight : 0;
    const isInsideStack = stackEl
      ? scrollY >= stackTop - 40 && scrollY <= stackTop + stackHeight - vh - 20
      : false;
    const isPastStack = stackEl ? scrollY > stackTop + stackHeight - vh - 20 : false;

    // Hiker only becomes visible once the user scrolls past Hero.
    // While inside Section 4, the vertical hiker is hidden and converts to the horizontal hiker.
    const hasReachedTrail = scrollY + vh * 0.35 >= lineCoords.startY;
    setIsHikerVisible(hasReachedTrail && !isInsideStack);

    let effectiveTargetY = viewportGuideY;
    if (isInsideStack) {
      // Hold at Checkpoint 03 while inside Section 4
      effectiveTargetY = lineCoords.cp3Y;
    } else if (isPastStack) {
      // Past Section 4: vertical trail resumes from resumeY down to endY
      effectiveTargetY = Math.max(
        lineCoords.resumeY,
        Math.min(lineCoords.endY, viewportGuideY)
      );

      // If transition was just crossed moving downward, pick up seamlessly at resumeY
      if (currentYRef.current < lineCoords.resumeY) {
        currentYRef.current = lineCoords.resumeY;
        lastYRef.current = lineCoords.resumeY;
      }
    } else {
      // Above Section 4: hiker moves down the upper trail, clamped at Checkpoint 03
      effectiveTargetY = Math.max(
        lineCoords.startY,
        Math.min(lineCoords.cp3Y, viewportGuideY)
      );

      // If transition was just crossed moving upward, clamp at cp3Y
      if (currentYRef.current > lineCoords.cp3Y) {
        currentYRef.current = lineCoords.cp3Y;
        lastYRef.current = lineCoords.cp3Y;
      }
    }

    targetYRef.current = effectiveTargetY;
  }, [lineCoords.startY, lineCoords.cp3Y, lineCoords.resumeY, lineCoords.endY]);

  // Lenis 1:1 synchronization
  useLenis(() => {
    updateTargetY();
  });

  // Native scroll fallback
  useEffect(() => {
    window.addEventListener("scroll", updateTargetY, { passive: true });
    return () => window.removeEventListener("scroll", updateTargetY);
  }, [updateTargetY]);

  // Reduced motion static update
  useEffect(() => {
    if (!isReducedMotion) return;

    const onScrollStatic = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const vh = window.innerHeight;

      const stackEl = document.getElementById("platform-stack");
      const stackTop = stackEl ? stackEl.offsetTop : 0;
      const stackHeight = stackEl ? stackEl.offsetHeight : 0;
      const isInsideStack = stackEl
        ? scrollY >= stackTop - 40 && scrollY <= stackTop + stackHeight - vh - 20
        : false;
      const isPastStack = stackEl ? scrollY > stackTop + stackHeight - vh - 20 : false;

      const targetY = isInsideStack
        ? lineCoords.cp3Y
        : isPastStack
        ? Math.max(lineCoords.resumeY, Math.min(lineCoords.endY, scrollY + vh * 0.45))
        : Math.max(lineCoords.startY, Math.min(lineCoords.cp3Y, scrollY + vh * 0.45));

      const hasReachedTrail = scrollY + vh * 0.35 >= lineCoords.startY;
      setIsHikerVisible(hasReachedTrail && !isInsideStack);

      setHikerPos({
        x: lineCoords.x,
        y: targetY,
        angle: 180,
        stride: 0,
        armStride: 0,
        sway: 0,
        isWalking: false,
      });

      const upperY2 = Math.min(targetY, lineCoords.cp3Y);
      traveledGlowRef.current?.setAttribute("y2", upperY2.toFixed(1));
      traveledCoreRef.current?.setAttribute("y2", upperY2.toFixed(1));
      traveledHighlightRef.current?.setAttribute("y2", upperY2.toFixed(1));

      const lowerY2 = isPastStack ? Math.max(lineCoords.resumeY, targetY) : lineCoords.resumeY;
      traveledGlowLowerRef.current?.setAttribute("y2", lowerY2.toFixed(1));
      traveledCoreLowerRef.current?.setAttribute("y2", lowerY2.toFixed(1));
      traveledHighlightLowerRef.current?.setAttribute("y2", lowerY2.toFixed(1));
    };

    onScrollStatic();
    window.addEventListener("scroll", onScrollStatic, { passive: true });
    return () => window.removeEventListener("scroll", onScrollStatic);
  }, [isReducedMotion, lineCoords.startY, lineCoords.cp3Y, lineCoords.resumeY, lineCoords.endY, lineCoords.x]);

  // Fluid 60fps Animation Loop: Straight Motion, Done Trail & Gait Physics
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

      // Snappy, organic damping (0.16)
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

      // One full stride cycle every ~20px of descent
      const walkPhase = strideAccumulatorRef.current * 0.32;
      const idleFactor = Math.max(0, 1 - idleTimerRef.current / 220);

      const strideVal = Math.sin(walkPhase) * idleFactor;
      const armStrideVal = Math.cos(walkPhase) * idleFactor;
      const swayVal = Math.sin(walkPhase) * 2.2 * idleFactor;

      // Natural facing: 180° when moving down, smoothly flips to 0° if scrolling up.
      // When approaching Checkpoint 03, gracefully turns 90° (East) toward the Application Stack
      let targetAngle = dy < -0.3 ? 0 : 180;
      const stackEl = document.getElementById("platform-stack");
      if (
        stackEl &&
        newY >= lineCoordsRef.current.cp3Y - 60 &&
        newY <= lineCoordsRef.current.cp3Y + 30
      ) {
        targetAngle = 90;
      }

      setHikerPos((prev) => {
        let diff = ((targetAngle - prev.angle + 180) % 360) - 180;
        if (diff < -180) diff += 360;
        const nextAngle = Math.abs(diff) > 0.1 ? prev.angle + diff * 0.20 : targetAngle;

        // Skip state update if values are virtually unchanged (idle resting state)
        if (
          Math.abs(prev.y - newY) < 0.05 &&
          Math.abs(prev.angle - nextAngle) < 0.1 &&
          Math.abs(prev.stride - strideVal) < 0.005 &&
          prev.isWalking === isWalking
        ) {
          return prev;
        }

        return {
          x: lineCoordsRef.current.x,
          y: newY,
          angle: nextAngle,
          stride: strideVal,
          armStride: armStrideVal,
          sway: swayVal,
          isWalking,
        };
      });

      // Update upper trail traveled line (startY to cp3Y)
      const upperY2 = Math.min(newY, lineCoordsRef.current.cp3Y);
      if (traveledGlowRef.current) {
        traveledGlowRef.current.setAttribute("y2", upperY2.toFixed(1));
      }
      if (traveledCoreRef.current) {
        traveledCoreRef.current.setAttribute("y2", upperY2.toFixed(1));
      }
      if (traveledHighlightRef.current) {
        traveledHighlightRef.current.setAttribute("y2", upperY2.toFixed(1));
      }

      // Update lower trail traveled line (resumeY to endY)
      const isPast = newY >= lineCoordsRef.current.resumeY - 2;
      const lowerY2 = isPast ? Math.max(lineCoordsRef.current.resumeY, newY) : lineCoordsRef.current.resumeY;
      if (traveledGlowLowerRef.current) {
        traveledGlowLowerRef.current.setAttribute("y2", lowerY2.toFixed(1));
        traveledGlowLowerRef.current.style.opacity = isPast ? "0.45" : "0";
      }
      if (traveledCoreLowerRef.current) {
        traveledCoreLowerRef.current.setAttribute("y2", lowerY2.toFixed(1));
        traveledCoreLowerRef.current.style.opacity = isPast ? "1.0" : "0";
      }
      if (traveledHighlightLowerRef.current) {
        traveledHighlightLowerRef.current.setAttribute("y2", lowerY2.toFixed(1));
        traveledHighlightLowerRef.current.style.opacity = isPast ? "0.9" : "0";
      }

      // Update checkpoint passed / verified status only when a checkpoint actually transitions
      setCheckpoints((prev) => {
        let changed = false;
        for (const cp of prev) {
          const isPassed = newY >= cp.y - 10;
          if (cp.passed !== isPassed) {
            changed = true;
            break;
          }
        }
        if (!changed) return prev;

        return prev.map((cp) => {
          const isPassed = newY >= cp.y - 10;
          return cp.passed !== isPassed ? { ...cp, passed: isPassed } : cp;
        });
      });

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [isReducedMotion]);

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
          {/* Luminous Done Trail Aura Glow Filter */}
          <filter id="doneTrailGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.0" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Luminous Traveled Gradient (Warm Ivory to Burnt Orange) */}
          <linearGradient id="doneTrailGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFA67E" />
            <stop offset="50%" stopColor="#D88762" />
            <stop offset="100%" stopColor="#FFA67E" />
          </linearGradient>
        </defs>

        {/* =================================================================
            1. UNTRAVELED ROUTES (Muted Dashed Cartographic Line)
            Upper: Start of trail (Deployment) to Checkpoint 03 (Application Stack)
            Lower: Resumes below Section 4 to Section 5
            (Vertical trail removed through Section 4 while horizontal trail is active)
            ================================================================= */}
        {/* Upper Segment: Dark casing */}
        <line
          x1={lineCoords.x}
          y1={lineCoords.startY}
          x2={lineCoords.x}
          y2={lineCoords.cp3Y}
          stroke="#181715"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.6"
        />
        {/* Upper Segment: Muted untraveled dashed line */}
        <line
          x1={lineCoords.x}
          y1={lineCoords.startY}
          x2={lineCoords.x}
          y2={lineCoords.cp3Y}
          stroke="#32302D"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          strokeLinecap="round"
          opacity="0.75"
        />

        {/* Lower Segment: Dark casing (Resumes below Section 4) */}
        <line
          x1={lineCoords.x}
          y1={lineCoords.resumeY}
          x2={lineCoords.x}
          y2={lineCoords.endY}
          stroke="#181715"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.6"
        />
        {/* Lower Segment: Muted untraveled dashed line */}
        <line
          x1={lineCoords.x}
          y1={lineCoords.resumeY}
          x2={lineCoords.x}
          y2={lineCoords.endY}
          stroke="#32302D"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          strokeLinecap="round"
          opacity="0.75"
        />

        {/* =================================================================
            2. TRAVELED "DONE" TRAILS (Summit Theme Orange #D88762)
            ================================================================= */}
        {/* UPPER SEGMENT: Ambient theme-orange glow aura */}
        <line
          ref={traveledGlowRef}
          x1={lineCoords.x}
          y1={lineCoords.startY}
          x2={lineCoords.x}
          y2={Math.min(hikerPos.y, lineCoords.cp3Y)}
          stroke="#D88762"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.45"
          filter="url(#doneTrailGlow)"
        />
        {/* UPPER SEGMENT: Solid, bold theme-orange core line */}
        <line
          ref={traveledCoreRef}
          x1={lineCoords.x}
          y1={lineCoords.startY}
          x2={lineCoords.x}
          y2={Math.min(hikerPos.y, lineCoords.cp3Y)}
          stroke="#D88762"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="1.0"
        />
        {/* UPPER SEGMENT: Luminous light filament highlight */}
        <line
          ref={traveledHighlightRef}
          x1={lineCoords.x}
          y1={lineCoords.startY}
          x2={lineCoords.x}
          y2={Math.min(hikerPos.y, lineCoords.cp3Y)}
          stroke="#FFA67E"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* LOWER SEGMENT: Ambient theme-orange glow aura */}
        <line
          ref={traveledGlowLowerRef}
          x1={lineCoords.x}
          y1={lineCoords.resumeY}
          x2={lineCoords.x}
          y2={lineCoords.resumeY}
          stroke="#D88762"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0"
          filter="url(#doneTrailGlow)"
        />
        {/* LOWER SEGMENT: Solid, bold theme-orange core line */}
        <line
          ref={traveledCoreLowerRef}
          x1={lineCoords.x}
          y1={lineCoords.resumeY}
          x2={lineCoords.x}
          y2={lineCoords.resumeY}
          stroke="#D88762"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0"
        />
        {/* LOWER SEGMENT: Luminous light filament highlight */}
        <line
          ref={traveledHighlightLowerRef}
          x1={lineCoords.x}
          y1={lineCoords.resumeY}
          x2={lineCoords.x}
          y2={lineCoords.resumeY}
          stroke="#FFA67E"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0"
        />

        {/* =================================================================
            3. START TRAILHEAD MARKER (At end of Hero section)
            ================================================================= */}
        <g transform={`translate(${lineCoords.x}, ${lineCoords.startY})`}>
          <circle
            cx="0"
            cy="0"
            r="4"
            fill="#D88762"
            stroke="#FFA67E"
            strokeWidth="1"
          />
          <circle cx="0" cy="0" r="1.5" fill="#FAF8F5" />
        </g>

        {/* =================================================================
            4. WEBSITE PLATFORM CHECKPOINTS
            01 // DEPLOYMENT PIPELINE
            02 // ARCHITECTURE
            03 // APPLICATION STACK
            04 // PRODUCTION SUMMIT
            ================================================================= */}
        <g id="website-checkpoints">
          {checkpoints.map((cp) => (
            <g
              key={cp.id}
              transform={`translate(${lineCoords.x}, ${cp.y})`}
              className="transition-all duration-300"
            >
              {/* Outer Checkpoint Reticle */}
              <circle
                cx="0"
                cy="0"
                r={cp.passed ? "5.5" : "4.5"}
                fill={cp.passed ? "#1E1A17" : "#141312"}
                stroke={cp.passed ? "#D88762" : "#383531"}
                strokeWidth={cp.passed ? "1.5" : "1"}
                className="transition-all duration-300"
              />

              {/* Crosshair surveyor lines */}
              <line
                x1="-6.5"
                y1="0"
                x2="6.5"
                y2="0"
                stroke={cp.passed ? "#FFA67E" : "#44413D"}
                strokeWidth="0.7"
              />
              <line
                x1="0"
                y1="-6.5"
                x2="0"
                y2="6.5"
                stroke={cp.passed ? "#FFA67E" : "#44413D"}
                strokeWidth="0.7"
              />

              {/* Center status dot */}
              <circle
                cx="0"
                cy="0"
                r={cp.passed ? "2.2" : "1.5"}
                fill={cp.passed ? "#FFA67E" : "#242220"}
                className="transition-colors duration-300"
              />

              {/* Checkpoint Telemetry Card: Aligned beside the reticle */}
              <g
                transform={
                  lineCoords.isDesktopGutter
                    ? "translate(-14, -8)"
                    : "translate(14, -8)"
                }
              >
                {/* Step Index & Section Title */}
                <text
                  x="0"
                  y="6"
                  fill={cp.passed ? "#FAF8F5" : "#6E6B66"}
                  fontSize="8.5"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontWeight="600"
                  letterSpacing="0.08em"
                  textAnchor={lineCoords.isDesktopGutter ? "end" : "start"}
                  className="transition-colors duration-300"
                >
                  {`${cp.passed ? "✓ " : ""}${cp.index} // ${cp.title}`}
                </text>

                {/* Subtext description according to the website */}
                <text
                  x="0"
                  y="16.5"
                  fill={cp.passed ? "#D88762" : "#4E4B46"}
                  fontSize="7.5"
                  fontFamily="var(--font-geist-mono), monospace"
                  letterSpacing="0.10em"
                  textAnchor={lineCoords.isDesktopGutter ? "end" : "start"}
                  className="transition-colors duration-300"
                >
                  {cp.subtext}
                </text>

                {/* Status Pill Badge: VERIFIED vs QUEUED */}
                <text
                  x="0"
                  y="26.5"
                  fill={cp.passed ? "#83B69A" : "#3E3C38"}
                  fontSize="7"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontWeight="600"
                  letterSpacing="0.12em"
                  textAnchor={lineCoords.isDesktopGutter ? "end" : "start"}
                  className="transition-colors duration-300"
                >
                  {cp.passed ? "[ VERIFIED ]" : "[ QUEUED ]"}
                </text>
              </g>

              {/* If Checkpoint 03 (Application Stack), Eastward spur turning toward the stack */}
              {cp.id === "cp-stack" && (
                <g>
                  <path
                    d="M 0 0 L 26 0"
                    fill="none"
                    stroke={cp.passed ? "#D88762" : "#383531"}
                    strokeWidth={cp.passed ? "2" : "1.2"}
                    strokeDasharray={cp.passed ? "none" : "3 2"}
                    strokeLinecap="round"
                    className="transition-all duration-300"
                  />
                  <circle
                    cx="26"
                    cy="0"
                    r={cp.passed ? "2.5" : "1.8"}
                    fill={cp.passed ? "#FFA67E" : "#383531"}
                    className="transition-all duration-300"
                  />
                </g>
              )}
            </g>
          ))}
        </g>

        {/* =================================================================
            5. LOWER TRAIL RESUME WAYPOINT (Below Section 4)
            "then start trail from here"
            ================================================================= */}
        <g transform={`translate(${lineCoords.x}, ${lineCoords.resumeY})`}>
          <circle
            cx="0"
            cy="0"
            r={hikerPos.y >= lineCoords.resumeY ? "5" : "3.5"}
            fill={hikerPos.y >= lineCoords.resumeY ? "#1E1A17" : "#141312"}
            stroke={hikerPos.y >= lineCoords.resumeY ? "#D88762" : "#383531"}
            strokeWidth={hikerPos.y >= lineCoords.resumeY ? "1.5" : "1"}
            className="transition-all duration-300"
          />
          <circle
            cx="0"
            cy="0"
            r="1.5"
            fill={hikerPos.y >= lineCoords.resumeY ? "#FAF8F5" : "#4A4742"}
            className="transition-all duration-300"
          />
          {/* Spur connecting from the benefits signal conduit into the vertical trail */}
          <path
            d="M 26 0 L 0 0"
            fill="none"
            stroke={hikerPos.y >= lineCoords.resumeY ? "#D88762" : "#383531"}
            strokeWidth="1.2"
            strokeDasharray={hikerPos.y >= lineCoords.resumeY ? "none" : "3 2"}
            className="transition-all duration-300"
          />
        </g>

        {/* =================================================================
            5. THE TOP-DOWN MINIATURE HIKER
            Walks straight down the vertical trail; hidden when in Hero
            ================================================================= */}
        <TopDownHiker
          x={hikerPos.x}
          y={hikerPos.y}
          angle={hikerPos.angle}
          stride={hikerPos.stride}
          armStride={hikerPos.armStride}
          sway={hikerPos.sway}
          isWalking={hikerPos.isWalking}
          visible={isHikerVisible}
        />
      </svg>
    </div>
  );
}

export default MountainTrail;
