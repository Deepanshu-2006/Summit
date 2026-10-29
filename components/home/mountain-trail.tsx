"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
  x: number;
  y: number;
  passed: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface ContourArc {
  cx: number;
  cy: number;
  r1: number;
  r2: number;
  r3: number;
  startAngle: number;
  endAngle: number;
}

/**
 * Generate a smooth cubic Bezier path through arbitrary waypoints
 * using Catmull-Rom to Cubic Bezier conversion ($C^1$ continuity).
 */
function catmullRomToBezier(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  const d: string[] = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6.0;
    const cp1y = p1.y + (p2.y - p0.y) / 6.0;
    const cp2x = p2.x - (p3.x - p1.x) / 6.0;
    const cp2y = p2.y - (p3.y - p1.y) / 6.0;

    d.push(
      `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    );
  }

  return d.join(" ");
}

/**
 * Top-Down Miniature Hiker (Bird's Eye / Zenith View)
 *
 * Meticulously illustrated miniature alpine expeditioner:
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
  // Stride offsets (in pixels)
  const leftBootOffset = stride * 5.0;
  const rightBootOffset = -stride * 5.0;
  const leftArmOffset = -armStride * 4.5;
  const rightArmOffset = armStride * 4.5;
  const packBob = isWalking ? Math.abs(armStride) * 0.6 : 0;

  return (
    <g
      transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${angle.toFixed(1)})`}
      className="transition-transform duration-75 will-change-transform"
      aria-hidden="true"
    >
      {/* 1. Ambient Ground Contact Shadow */}
      <ellipse
        cx="0"
        cy={1 + packBob * 0.5}
        rx="11"
        ry="15"
        fill="#000000"
        opacity="0.45"
      />

      {/* 2. Walking Legs & Boots (Alternating stride along travel axis) */}
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
          {/* Carbon Pole Shaft (Angles forward slightly) */}
          <line
            x1="-1.5"
            y1="-9"
            x2="1.5"
            y2="11"
            stroke="#8E8C86"
            strokeWidth="0.85"
            strokeLinecap="round"
          />
          {/* Snow/Mud Basket Ring */}
          <circle cx="0.8" cy="8" r="2.2" fill="none" stroke="#FAF8F5" strokeWidth="0.6" />
          {/* Tungsten Carbide Tip */}
          <circle cx="1.5" cy="11" r="0.8" fill="#FAF8F5" />
          {/* Hand Grip */}
          <rect x="-1" y="-3" width="2" height="4.5" rx="0.8" fill="#FAF8F5" />
        </g>

        {/* Right Trekking Pole & Hand */}
        <g transform={`translate(10, ${(-5 + rightArmOffset).toFixed(1)})`}>
          {/* Carbon Pole Shaft */}
          <line
            x1="1.5"
            y1="-9"
            x2="-1.5"
            y2="11"
            stroke="#8E8C86"
            strokeWidth="0.85"
            strokeLinecap="round"
          />
          {/* Snow/Mud Basket Ring */}
          <circle cx="-0.8" cy="8" r="2.2" fill="none" stroke="#FAF8F5" strokeWidth="0.6" />
          {/* Tungsten Carbide Tip */}
          <circle cx="-1.5" cy="11" r="0.8" fill="#FAF8F5" />
          {/* Hand Grip */}
          <rect x="-1" y="-3" width="2" height="4.5" rx="0.8" fill="#FAF8F5" />
        </g>
      </g>

      {/* 4. Torso & Shoulders with subtle gait sway */}
      <g transform={`rotate(${sway.toFixed(1)})`}>
        {/* Alpine Shell Jacket Torso */}
        <path
          d="M -9 -5 C -9 -8, 9 -8, 9 -5 C 9.5 0, 8.5 4, 7.5 5 C 4 6, -4 6, -7.5 5 C -8.5 4, -9.5 0, -9 -5 Z"
          fill="#34322E"
          stroke="#262422"
          strokeWidth="0.75"
        />

        {/* Technical Expedition Backpack (Anchored on back) */}
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
          {/* Twin Compression Straps */}
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
          {/* Buckle Reticles */}
          <rect x="-4" y="2" width="1" height="1.5" fill="#FAF8F5" />
          <rect x="3" y="2" width="1" height="1.5" fill="#FAF8F5" />
        </g>

        {/* 5. Head & Wide-Brim Expedition Hat */}
        <g transform="translate(0, -6)">
          {/* Outer Hat Brim */}
          <ellipse
            cx="0"
            cy="0"
            rx="6.5"
            ry="7.2"
            fill="#423E39"
            stroke="#504C46"
            strokeWidth="0.75"
          />
          {/* Burnt-Orange Hatband */}
          <ellipse
            cx="0"
            cy="0"
            rx="4.2"
            ry="4.7"
            fill="none"
            stroke="#D88762"
            strokeWidth="0.85"
          />
          {/* Hat Crown (Center peak viewed from directly above) */}
          <ellipse
            cx="0"
            cy="0"
            rx="3.5"
            ry="4.0"
            fill="#2E2B27"
          />
          {/* Vent grommets */}
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
 * Full-page continuous engraved mountain expedition trail with top-down miniature hiker:
 * - Connects all 8 homepage sections into one cohesive expedition journey.
 * - Dynamic SVG path generated using Catmull-Rom splines adapted to real section coordinates.
 * - Restrained cartographic aesthetic: dashed untraveled route, progressive warm-orange traveled line.
 * - Genuine walking gait: limbs stride and poles swing in response to scroll movement.
 * - 4 Sparse surveyor benchmarks marking Trailhead, Basecamp, High Pass, and Summit.
 * - Non-intrusive, sits behind content (`z-0`), lightweight hardware-accelerated 60fps rAF loop.
 */
export function MountainTrail() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const traveledPathRef = useRef<SVGPathElement>(null);

  const [pathData, setPathData] = useState<string>("");
  const [contourArcs, setContourArcs] = useState<ContourArc[]>([]);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 1440,
    height: 8000,
  });

  // Hiker rendering state
  const [hikerPos, setHikerPos] = useState<{
    x: number;
    y: number;
    angle: number;
    stride: number;
    armStride: number;
    sway: number;
    isWalking: boolean;
  }>({
    x: 100,
    y: 100,
    angle: 0,
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

  // Motion physics refs for buttery smooth 60fps rAF loop
  const currentDistRef = useRef<number>(0);
  const targetDistRef = useRef<number>(0);
  const currentAngleRef = useRef<number>(0);
  const strideAccumulatorRef = useRef<number>(0);
  const idleTimerRef = useRef<number>(0);
  const totalLengthRef = useRef<number>(1000);
  const rafIdRef = useRef<number | null>(null);

  // Measure sections and generate adaptive mountain route
  useEffect(() => {
    function computeRoute() {
      if (!containerRef.current) return;
      const mainEl = containerRef.current.parentElement;
      if (!mainEl) return;

      const mainWidth = mainEl.offsetWidth;
      const mainHeight = mainEl.scrollHeight;

      if (mainWidth === 0 || mainHeight === 0) return;

      setDimensions({ width: mainWidth, height: mainHeight });

      // Identify all 8 section anchors
      const sectionIds = [
        "hero",
        "deployment-experience",
        "product-experience",
        "platform-stack",
        "developer-experience",
        "production-visibility",
        "getting-started",
        "final-cta",
      ];

      // Measure section rects relative to <main>
      const sections = sectionIds.map((id) => {
        const el = document.getElementById(id);
        if (!el) {
          return { id, top: 0, height: 800 };
        }
        return {
          id,
          top: el.offsetTop,
          height: el.offsetHeight,
        };
      });

      const isMobile = mainWidth < 768;
      const isTablet = mainWidth >= 768 && mainWidth < 1024;
      const containerMax = Math.min(mainWidth, 1200);
      const gutterLeft = Math.max(16, (mainWidth - containerMax) / 2);
      const pad = isMobile ? 20 : isTablet ? 32 : 48;

      // Base left margin spine for the mountain path
      const spineX = isMobile
        ? 28
        : isTablet
        ? gutterLeft + 24
        : gutterLeft + pad * 0.45;

      const pts: Point[] = [];
      const newLandmarks: Landmark[] = [];
      const newContourArcs: ContourArc[] = [];

      // Section 1: Hero
      const s0 = sections[0];
      const heroTop = s0.top;
      const heroH = s0.height;

      // Landmark 1: Trailhead
      const trailheadPt = { x: spineX + 8, y: heroTop + 140 };
      pts.push(trailheadPt);
      newLandmarks.push({
        id: "landmark-trailhead",
        index: "01",
        title: "TRAILHEAD",
        elevation: "1,200M",
        x: trailheadPt.x,
        y: trailheadPt.y,
        passed: false,
      });

      pts.push({ x: spineX - 10, y: heroTop + 380 });
      pts.push({ x: spineX + 22, y: heroTop + 620 });
      pts.push({ x: spineX + 48, y: heroTop + heroH - 140 });

      // Switchback 1: Gap between Hero and Deployment Experience
      const s1 = sections[1];
      const deployTop = s1 ? s1.top : heroTop + heroH;
      const sw1Y = (heroTop + heroH + deployTop) / 2;
      pts.push({ x: spineX + (isMobile ? 24 : 75), y: sw1Y });
      newContourArcs.push({
        cx: spineX + (isMobile ? 24 : 75),
        cy: sw1Y,
        r1: 18,
        r2: 30,
        r3: 42,
        startAngle: -45,
        endAngle: 135,
      });

      // Section 2: Deployment Experience
      if (s1) {
        pts.push({ x: spineX + 12, y: s1.top + 50 });

        // Landmark 2: Basecamp
        const basecampPt = { x: spineX + 8, y: s1.top + 280 };
        pts.push(basecampPt);
        newLandmarks.push({
          id: "landmark-basecamp",
          index: "02",
          title: "BASECAMP",
          elevation: "1,840M",
          x: basecampPt.x,
          y: basecampPt.y,
          passed: false,
        });

        pts.push({ x: spineX + 28, y: s1.top + 540 });
        pts.push({ x: spineX + 54, y: s1.top + s1.height - 120 });
      }

      // Section 3: Product Experience
      const s2 = sections[2];
      if (s2) {
        const sw2Y = ((s1 ? s1.top + s1.height : s2.top - 100) + s2.top) / 2;
        pts.push({ x: spineX + (isMobile ? 20 : 85), y: sw2Y });
        newContourArcs.push({
          cx: spineX + (isMobile ? 20 : 85),
          cy: sw2Y,
          r1: 22,
          r2: 36,
          r3: 50,
          startAngle: 30,
          endAngle: 210,
        });

        pts.push({ x: spineX + 10, y: s2.top + 80 });
        pts.push({ x: spineX + 24, y: s2.top + 340 });
        pts.push({ x: spineX + 56, y: s2.top + s2.height - 140 });
      }

      // Section 4: Platform Stack
      const s3 = sections[3];
      if (s3) {
        const sw3Y = ((s2 ? s2.top + s2.height : s3.top - 100) + s3.top) / 2;
        pts.push({ x: spineX + (isMobile ? 22 : 70), y: sw3Y });

        // Landmark 3: High Pass
        const highPassPt = { x: spineX + 12, y: s3.top + 90 };
        pts.push(highPassPt);
        newLandmarks.push({
          id: "landmark-highpass",
          index: "03",
          title: "HIGH PASS",
          elevation: "2,680M",
          x: highPassPt.x,
          y: highPassPt.y,
          passed: false,
        });

        pts.push({ x: spineX + 18, y: s3.top + 360 });
        pts.push({ x: spineX + 46, y: s3.top + s3.height - 120 });
      }

      // Section 5: Developer Experience
      const s4 = sections[4];
      if (s4) {
        const sw4Y = ((s3 ? s3.top + s3.height : s4.top - 100) + s4.top) / 2;
        pts.push({ x: spineX + (isMobile ? 18 : 65), y: sw4Y });

        pts.push({ x: spineX + 14, y: s4.top + 80 });
        pts.push({ x: spineX + 22, y: s4.top + 320 });
        pts.push({ x: spineX + 52, y: s4.top + s4.height - 120 });
      }

      // Section 6: Production Visibility (Extended Scroll Corridor)
      const s5 = sections[5];
      if (s5) {
        pts.push({ x: spineX + 16, y: s5.top + s5.height * 0.22 });
        pts.push({ x: spineX + (isMobile ? 26 : 60), y: s5.top + s5.height * 0.50 });
        pts.push({ x: spineX + 14, y: s5.top + s5.height * 0.78 });
      }

      // Section 7: Getting Started
      const s6 = sections[6];
      if (s6) {
        pts.push({ x: spineX + 12, y: s6.top + 90 });
        pts.push({ x: spineX + 32, y: s6.top + 360 });
        pts.push({ x: spineX + (isMobile ? 22 : 68), y: s6.top + s6.height - 180 });
      }

      // Section 8: Final CTA (Summit Apex)
      const s7 = sections[7];
      if (s7) {
        pts.push({ x: spineX + 20, y: s7.top + s7.height * 0.25 });
        pts.push({ x: spineX + (isMobile ? 28 : 72), y: s7.top + s7.height * 0.55 });

        // Landmark 4: Summit Peak
        const summitPt = {
          x: spineX + (isMobile ? 20 : 54),
          y: s7.top + s7.height * 0.88,
        };
        pts.push(summitPt);
        newLandmarks.push({
          id: "landmark-summit",
          index: "04",
          title: "SUMMIT PEAK",
          elevation: "3,428M",
          x: summitPt.x,
          y: summitPt.y,
          passed: false,
        });
      }

      // Build smooth Catmull-Rom spline path string
      const d = catmullRomToBezier(pts);
      setPathData(d);
      setLandmarks(newLandmarks);
      setContourArcs(newContourArcs);
    }

    computeRoute();

    // ResizeObserver tracks document reflows and dynamic height shifts
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current?.parentElement && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        computeRoute();
      });
      resizeObserver.observe(containerRef.current.parentElement);
    }

    window.addEventListener("resize", computeRoute, { passive: true });

    return () => {
      window.removeEventListener("resize", computeRoute);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, []);

  // Update total path length when pathData settles
  useEffect(() => {
    if (pathRef.current) {
      try {
        const len = pathRef.current.getTotalLength();
        if (len > 0) {
          totalLengthRef.current = len;
          if (traveledPathRef.current) {
            traveledPathRef.current.style.strokeDasharray = `0 ${len}`;
          }
        }
      } catch {
        // Fallback for mock environments
      }
    }
  }, [pathData]);

  // Handle scroll progress update via Lenis or native scroll fallback
  const handleScrollUpdate = () => {
    if (!pathRef.current || typeof window === "undefined") return;

    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.max(0, Math.min(1, scrollY / maxScroll));

    const totalLen = totalLengthRef.current;
    targetDistRef.current = progress * totalLen;
  };

  // Synchronize 1:1 with Lenis smooth scroll
  useLenis((lenis) => {
    if (lenis && typeof lenis.progress === "number") {
      targetDistRef.current = Math.max(0, Math.min(1, lenis.progress)) * totalLengthRef.current;
    } else {
      handleScrollUpdate();
    }
  });

  // Native scroll event fallback listener
  useEffect(() => {
    window.addEventListener("scroll", handleScrollUpdate, { passive: true });
    return () => window.removeEventListener("scroll", handleScrollUpdate);
  }, []);

  // Static positioning for reduced motion users
  useEffect(() => {
    if (!isReducedMotion) return;

    const updateStatic = () => {
      const pathEl = pathRef.current;
      const totalLen = totalLengthRef.current;
      if (!pathEl || totalLen <= 0) return;

      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.max(0, Math.min(1, scrollY / maxScroll));
      const dist = progress * totalLen;

      try {
        const pt = pathEl.getPointAtLength(dist);
        const aheadDist = Math.min(totalLen, dist + 2);
        const ptAhead = pathEl.getPointAtLength(aheadDist);
        const dx = ptAhead.x - pt.x;
        const dy = ptAhead.y - pt.y;
        const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;

        setHikerPos({
          x: pt.x,
          y: pt.y,
          angle: deg,
          stride: 0,
          armStride: 0,
          sway: 0,
          isWalking: false,
        });

        if (traveledPathRef.current) {
          traveledPathRef.current.style.strokeDasharray = `${dist} ${totalLen}`;
          traveledPathRef.current.style.strokeDashoffset = "0";
        }
      } catch {
        // Guard
      }
    };

    updateStatic();
    window.addEventListener("scroll", updateStatic, { passive: true });
    return () => window.removeEventListener("scroll", updateStatic);
  }, [isReducedMotion, pathData]);

  // Fluid 60fps Animation Loop: Hiker Motion, Tangent Orientation & Gait Physics
  useEffect(() => {
    if (isReducedMotion) return;

    let isRunning = true;
    let lastTime = performance.now();

    const loop = (time: number) => {
      if (!isRunning) return;

      const dt = Math.min(32, time - lastTime);
      lastTime = time;

      const target = targetDistRef.current;
      const current = currentDistRef.current;
      const totalLen = totalLengthRef.current;

      // Snappy, organic damping interpolation (0.16)
      const diff = target - current;
      const moveDelta = diff * 0.16;
      currentDistRef.current += moveDelta;

      const newDist = currentDistRef.current;
      const pathEl = pathRef.current;

      if (pathEl && totalLen > 0) {
        try {
          const clampedDist = Math.max(0, Math.min(totalLen, newDist));
          const pt = pathEl.getPointAtLength(clampedDist);

          // Tangent orientation calculation with lookahead and lookbehind
          const aheadDist = Math.min(totalLen, clampedDist + 3.0);
          const behindDist = Math.max(0, clampedDist - 3.0);
          const ptAhead = pathEl.getPointAtLength(aheadDist);
          const ptBehind = pathEl.getPointAtLength(behindDist);

          const dx = ptAhead.x - ptBehind.x;
          const dy = ptAhead.y - ptBehind.y;

          // Hiker natural facing is UP (-y axis, so subtract 90 deg)
          const targetDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;

          // Angle unwrap interpolation prevents 360-degree spin snap
          let degDiff = ((targetDeg - currentAngleRef.current + 180) % 360) - 180;
          if (degDiff < -180) degDiff += 360;
          currentAngleRef.current += degDiff * 0.18;

          // Gait & Stride physics driven by actual movement delta
          const stepSpeed = Math.abs(moveDelta);
          const isWalking = stepSpeed > 0.12;

          if (isWalking) {
            strideAccumulatorRef.current += moveDelta;
            idleTimerRef.current = 0;
          } else {
            idleTimerRef.current += dt;
          }

          // Complete step stride every ~20px of path traveled
          const walkPhase = strideAccumulatorRef.current * 0.32;

          // If idle for > 200ms, smoothly ease limbs back to grounded resting pose
          const idleFactor = Math.max(0, 1 - idleTimerRef.current / 220);
          const strideVal = Math.sin(walkPhase) * idleFactor;
          const armStrideVal = Math.cos(walkPhase) * idleFactor;
          const swayVal = Math.sin(walkPhase) * 2.2 * idleFactor;

          setHikerPos({
            x: pt.x,
            y: pt.y,
            angle: currentAngleRef.current,
            stride: strideVal,
            armStride: armStrideVal,
            sway: swayVal,
            isWalking,
          });

          // Update traveled route trail stroke length
          if (traveledPathRef.current) {
            traveledPathRef.current.style.strokeDasharray = `${clampedDist.toFixed(1)} ${totalLen.toFixed(1)}`;
            traveledPathRef.current.style.strokeDashoffset = "0";
          }

          // Update landmark active state
          setLandmarks((prev) =>
            prev.map((lm) => {
              const isPassed = pt.y >= lm.y - 40;
              return lm.passed !== isPassed ? { ...lm, passed: isPassed } : lm;
            })
          );
        } catch {
          // Guard for SVG path length parsing in edge cases
        }
      }

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

  if (!pathData) {
    return (
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-[5]"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-[5] select-none"
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Luminous Traveled Route Gradient (Warm Ivory to Burnt Orange) */}
          <linearGradient id="traveledTrailGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FAF8F5" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#D88762" stopOpacity="0.90" />
            <stop offset="100%" stopColor="#FFA67E" stopOpacity="0.95" />
          </linearGradient>

          {/* Restrained Hiker Glow Aura Filter */}
          <filter id="hikerShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* =================================================================
            LAYER 1: TOPOGRAPHIC CONTOUR DETAIL ARCS (Selected Trail Bends)
            Vintage USGS/Swiss cartographic contour rings around switchbacks
            ================================================================= */}
        <g id="trail-contour-bends" className="opacity-30">
          {contourArcs.map((arc, idx) => (
            <g key={`contour-${idx}`}>
              <circle
                cx={arc.cx}
                cy={arc.cy}
                r={arc.r1}
                fill="none"
                stroke="#3A3733"
                strokeWidth="0.7"
                strokeDasharray="2 6"
              />
              <circle
                cx={arc.cx}
                cy={arc.cy}
                r={arc.r2}
                fill="none"
                stroke="#2C2A26"
                strokeWidth="0.65"
                strokeDasharray="3 7"
              />
              <circle
                cx={arc.cx}
                cy={arc.cy}
                r={arc.r3}
                fill="none"
                stroke="#24221F"
                strokeWidth="0.6"
                strokeDasharray="4 8"
              />
            </g>
          ))}
        </g>

        {/* =================================================================
            LAYER 2: UNTRAVELED MOUNTAIN TRAIL (Dashed Cartographic Path)
            Vintage engraved footpath etched into the mountain topography
            ================================================================= */}
        {/* Soft casing backdrop */}
        <path
          d={pathData}
          fill="none"
          stroke="#181715"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
        />

        {/* Untraveled Dashed Footpath */}
        <path
          ref={pathRef}
          d={pathData}
          fill="none"
          stroke="#383430"
          strokeWidth="1.5"
          strokeDasharray="5 5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.75"
        />

        {/* =================================================================
            LAYER 3: PROGRESSIVE TRAVELED ROUTE (Burnt Orange / Warm Ivory)
            Illuminates behind the hiker as the user explores down the page
            ================================================================= */}
        <path
          ref={traveledPathRef}
          d={pathData}
          fill="none"
          stroke="url(#traveledTrailGrad)"
          strokeWidth="1.85"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="will-change-[stroke-dasharray]"
        />

        {/* =================================================================
            LAYER 4: SPARSE SURVEYOR BENCHMARK LANDMARKS
            Authentic alpine geodesic checkpoints: Trailhead, Basecamp, High Pass, Summit
            ================================================================= */}
        <g id="trail-landmarks">
          {landmarks.map((lm) => (
            <g
              key={lm.id}
              transform={`translate(${lm.x}, ${lm.y})`}
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
                  ELEV {lm.elevation}
                </text>
              </g>
            </g>
          ))}
        </g>

        {/* =================================================================
            LAYER 5: THE TOP-DOWN MINIATURE HIKER
            Bird's-eye view expeditioner walking smoothly along the trail
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
