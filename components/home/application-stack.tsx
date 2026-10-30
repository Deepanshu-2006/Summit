"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from "react";
import { useLenis } from "@/components/layout/smooth-scroll-provider";
import { ApiServicePlayground } from "./api-service-playground";
import { DatabaseServicePlayground } from "./database-service-playground";
import { WorkerServicePlayground } from "./worker-service-playground";

type ServiceId = "web" | "api" | "db" | "worker";

interface ServiceMetadata {
  id: ServiceId;
  index: string;
  name: string;
  shortName: string;
  description: string;
  elevation: string;
}

const SERVICES: Record<ServiceId, ServiceMetadata> = {
  web: {
    id: "web",
    index: "01",
    name: "Web frontend",
    shortName: "Web",
    description: "The experience your users see.",
    elevation: "1,420M",
  },
  api: {
    id: "api",
    index: "02",
    name: "API service",
    shortName: "API",
    description: "Logic and application requests.",
    elevation: "2,150M",
  },
  db: {
    id: "db",
    index: "03",
    name: "Database",
    shortName: "Database",
    description: "Persistent application data.",
    elevation: "2,890M",
  },
  worker: {
    id: "worker",
    index: "04",
    name: "Background worker",
    shortName: "Worker",
    description: "Tasks that run behind the scenes.",
    elevation: "3,420M",
  },
};

const SERVICE_KEYS: ServiceId[] = ["web", "api", "db", "worker"];

// Reduced Motion Subscription helper
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
 * Maps pinned scroll progress [0, 1] across the 4 stages into a continuous trail progress [0, 1].
 * Dwells comfortably at each station so users can read the active stage content,
 * then organically accelerates and decelerates while walking between stations.
 */
function progressToTrailRatio(p: number): number {
  if (p <= 0.08) return 0;
  if (p < 0.35) {
    const t = (p - 0.08) / 0.27;
    // Hermite smootherstep for continuous, organic acceleration/deceleration
    const s = t * t * (3 - 2 * t);
    return (1 / 3) * s;
  }
  if (p <= 0.42) return 1 / 3;
  if (p < 0.68) {
    const t = (p - 0.42) / 0.26;
    const s = t * t * (3 - 2 * t);
    return 1 / 3 + (1 / 3) * s;
  }
  if (p <= 0.74) return 2 / 3;
  if (p < 0.94) {
    const t = (p - 0.74) / 0.20;
    const s = t * t * (3 - 2 * t);
    return 2 / 3 + (1 / 3) * s;
  }
  return 1;
}

/**
 * TopDownHiker Component
 *
 * Meticulously detailed top-down miniature alpine expeditioner:
 * - Wide-brim expedition sun hat with Summit burnt-orange hatband
 * - Broad technical shoulders with alpine shell jacket
 * - Technical mountain backpack with burnt-orange top flap and rolled bedroll
 * - Alternating leather boots and swinging trekking poles in responsive stride
 * - Ground contact shadow and subtle warm ambient lantern glow
 */
function HorizontalTopDownHiker({
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
      <circle cx="0" cy="1" r="18" fill="#D88762" opacity="0.16" />
      <ellipse cx="0" cy="1" rx="10" ry="13" fill="#000000" opacity="0.6" />

      {/* 2. Walking Legs & Boots (Alternating stride) */}
      <g id="hiker-boots">
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
      <g id="hiker-poles">
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
          {/* Rolled Expedition Bedroll */}
          <rect
            x="-7"
            y="-4.8"
            width="14"
            height="2.8"
            rx="1"
            fill="#C97A56"
            stroke="#A35C3E"
            strokeWidth="0.5"
          />
        </g>

        {/* 5. Head & Wide-Brim Expedition Sun Hat */}
        <g transform="translate(0, -5.5)">
          {/* Wide Brim */}
          <ellipse
            cx="0"
            cy="0"
            rx="5.8"
            ry="6.4"
            fill="#423E39"
            stroke="#504C46"
            strokeWidth="0.7"
          />
          {/* Burnt-Orange Hatband */}
          <ellipse
            cx="0"
            cy="0"
            rx="3.8"
            ry="4.2"
            fill="none"
            stroke="#D88762"
            strokeWidth="0.8"
          />
          {/* Crown */}
          <ellipse cx="0" cy="0" rx="3.1" ry="3.5" fill="#2E2B27" />
        </g>
      </g>
    </g>
  );
}

/**
 * ApplicationStack: Section 04 — The Platform
 * "One platform. Your entire stack."
 *
 * Storytelling Transformation:
 * - Pinned scroll runway dividing application stack into 4 sequential chapters.
 * - Conventional underline replaced completely by a continuous horizontal mountain trail with top-down hiker.
 * - Hiker advances along the alpine path as user scrolls, illuminating conquered waypoints in Summit burnt orange.
 * - Clicking any stage label smoothly scrolls the page and animates the hiker to that station.
 * - Smooth, zero-height-jump crossfades between the four infrastructure views.
 * - Releases cleanly into normal page flow revealing the three architectural benefit pillars.
 */
export function ApplicationStack() {
  const [selectedId, setSelectedId] = useState<ServiceId>("web");
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [tabCenters, setTabCenters] = useState<number[]>([]);
  const [tabWidths, setTabWidths] = useState<number[]>([]);
  const tabCentersRef = useRef<number[]>([]);
  const tabWidthsRef = useRef<number[]>([]);

  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const switcherRef = useRef<HTMLDivElement>(null);
  const underlineRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const benefitRef = useRef<HTMLElement>(null);
  const benefitsTriggeredRef = useRef<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [benefitsInView, setBenefitsInView] = useState<boolean>(false);
  const [transitionDirection, setTransitionDirection] = useState<"forward" | "backward">("forward");
  const prevIndexRef = useRef<number>(0);

  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  // Helper to compute directional transition classes for service panels
  const getPanelTransitionClasses = useCallback((viewIndex: number) => {
    const isSelected = activeIndex === viewIndex;
    const isPast = activeIndex > viewIndex;

    if (isReducedMotion) {
      return isSelected
        ? "opacity-100 translate-x-0 pointer-events-auto z-10"
        : "opacity-0 pointer-events-none absolute inset-0 pt-3 sm:pt-4 lg:pt-5 px-3 sm:px-5 lg:px-6 pb-0 z-0";
    }

    if (isSelected) {
      return "opacity-100 translate-x-0 pointer-events-auto z-10 transition-all duration-450 ease-out";
    }

    // Exited views: if it's before current active stage, slide slightly left; if after, slide slightly right
    return isPast
      ? "opacity-0 -translate-x-3 pointer-events-none absolute inset-0 pt-3 sm:pt-4 lg:pt-5 px-3 sm:px-5 lg:px-6 pb-0 z-0 transition-all duration-350 ease-in"
      : "opacity-0 translate-x-3 pointer-events-none absolute inset-0 pt-3 sm:pt-4 lg:pt-5 px-3 sm:px-5 lg:px-6 pb-0 z-0 transition-all duration-350 ease-in";
  }, [activeIndex, isReducedMotion]);

  // SVG Trail Refs
  const pathRef = useRef<SVGPathElement>(null);
  const traveledPathRef = useRef<SVGPathElement>(null);
  const traveledGlowRef = useRef<SVGPathElement>(null);
  const traveledCoreRef = useRef<SVGPathElement>(null);
  const pathLengthRef = useRef<number>(600);

  // Hiker DOM Refs for 60fps/120fps direct RAF transforms
  const hikerRef = useRef<SVGGElement>(null);
  const leftBootRef = useRef<SVGGElement>(null);
  const rightBootRef = useRef<SVGGElement>(null);
  const leftPoleRef = useRef<SVGGElement>(null);
  const rightPoleRef = useRef<SVGGElement>(null);
  const torsoRef = useRef<SVGGElement>(null);

  // Animation state tracking
  const animRef = useRef({
    targetProgress: 0,
    currentProgress: 0,
    walkCycle: 0,
    stride: 0,
    armStride: 0,
    sway: 0,
    isWalking: false,
    isWalkingBackward: false,
    lastDistance: 0,
    rafId: null as number | null,
  });

  const activeIndexRef = useRef<number>(0);

  // Shared Lenis scroll instance
  const lenis = useLenis();

  // Measure tab centers and widths for dynamic path and underline indicator
  const measureTabCenters = useCallback(() => {
    if (!switcherRef.current) return;
    const containerRect = switcherRef.current.getBoundingClientRect();
    const width = containerRect.width;
    if (width <= 0) return;

    const centers: number[] = [];
    const widths: number[] = [];
    tabRefs.current.forEach((tab) => {
      if (tab) {
        const tabRect = tab.getBoundingClientRect();
        const cx = tabRect.left - containerRect.left + tabRect.width / 2;
        centers.push(cx);
        widths.push(tabRect.width);
      }
    });

    const isSame = (a: number[], b: number[]) =>
      a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 0.5);

    if (centers.length === 4) {
      tabCentersRef.current = centers;
      tabWidthsRef.current = widths;
      setTabCenters((prev) => (isSame(prev, centers) ? prev : centers));
      setTabWidths((prev) => (isSame(prev, widths) ? prev : widths));
    } else {
      // Default fallback grid distribution
      const fallbackCenters = [width * 0.125, width * 0.375, width * 0.625, width * 0.875];
      const fallbackWidths = [width * 0.22, width * 0.22, width * 0.22, width * 0.22];
      tabCentersRef.current = fallbackCenters;
      tabWidthsRef.current = fallbackWidths;
      setTabCenters((prev) => (isSame(prev, fallbackCenters) ? prev : fallbackCenters));
      setTabWidths((prev) => (isSame(prev, fallbackWidths) ? prev : fallbackWidths));
    }
  }, []);

  // Compute SVG trail path with subtle organic mountain contour bends
  const pathD = React.useMemo(() => {
    if (tabCenters.length < 4) return "M 0 16 L 600 16";
    const [x0, x1, x2, x3] = tabCenters;
    const dx01 = x1 - x0;
    const dx12 = x2 - x1;
    const dx23 = x3 - x2;

    // Organic mountain trail curvature through subtle topographic saddles and knolls
    return `M ${x0.toFixed(1)} 16.0 ` +
      `C ${(x0 + dx01 * 0.35).toFixed(1)} 12.5, ${(x0 + dx01 * 0.68).toFixed(1)} 19.5, ${x1.toFixed(1)} 16.0 ` +
      `C ${(x1 + dx12 * 0.32).toFixed(1)} 20.0, ${(x1 + dx12 * 0.70).toFixed(1)} 13.0, ${x2.toFixed(1)} 16.0 ` +
      `C ${(x2 + dx23 * 0.35).toFixed(1)} 12.0, ${(x2 + dx23 * 0.65).toFixed(1)} 18.5, ${x3.toFixed(1)} 16.0`;
  }, [tabCenters]);

  // Measure path total length whenever path geometry updates
  useEffect(() => {
    if (pathRef.current) {
      const len = pathRef.current.getTotalLength();
      if (len > 0) {
        pathLengthRef.current = len;
        // Initialize traveled trail paths strokeDasharray
        [traveledPathRef.current, traveledGlowRef.current, traveledCoreRef.current].forEach(
          (el) => {
            if (el) {
              el.style.strokeDasharray = `${len}`;
            }
          }
        );
      }
    }
  }, [pathD]);

  // Direct RAF render loop updating hiker & trail without React reconciler overhead
  const updateHikerAndTrail = useCallback((dist: number, anim: typeof animRef.current, trailRatio?: number) => {
    const totalLen = pathLengthRef.current;
    if (totalLen <= 0 || !pathRef.current) return;

    const clampedDist = Math.max(0, Math.min(totalLen, dist));

    // Update traveled path lengths
    const dashOffset = (totalLen - clampedDist).toFixed(1);
    if (traveledPathRef.current) {
      traveledPathRef.current.style.strokeDashoffset = dashOffset;
    }
    if (traveledGlowRef.current) {
      traveledGlowRef.current.style.strokeDashoffset = dashOffset;
    }
    if (traveledCoreRef.current) {
      traveledCoreRef.current.style.strokeDashoffset = dashOffset;
    }

    // Determine position and orientation on mountain path
    const pt = pathRef.current.getPointAtLength(clampedDist);
    const ptAhead = pathRef.current.getPointAtLength(Math.min(totalLen, clampedDist + 2));
    const slope = Math.atan2(ptAhead.y - pt.y, ptAhead.x - pt.x) * (180 / Math.PI);
    // Orient hiker along the path: 90deg base angle facing East (right)
    const baseAngle = anim.isWalkingBackward ? slope + 180 + 90 : slope + 90;

    // Apply hiker transforms directly
    if (hikerRef.current) {
      hikerRef.current.setAttribute(
        "transform",
        `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}) rotate(${baseAngle.toFixed(1)}) scale(0.85)`
      );
    }
    if (leftBootRef.current) {
      const lOffset = (anim.stride * 4.5).toFixed(1);
      leftBootRef.current.setAttribute("transform", `translate(-5.5, ${(7 + Number(lOffset)).toFixed(1)})`);
    }
    if (rightBootRef.current) {
      const rOffset = (-anim.stride * 4.5).toFixed(1);
      rightBootRef.current.setAttribute("transform", `translate(5.5, ${(7 + Number(rOffset)).toFixed(1)})`);
    }
    if (leftPoleRef.current) {
      const lpOffset = (-anim.armStride * 4.0).toFixed(1);
      leftPoleRef.current.setAttribute("transform", `translate(-9, ${(-5 + Number(lpOffset)).toFixed(1)})`);
    }
    if (rightPoleRef.current) {
      const rpOffset = (anim.armStride * 4.0).toFixed(1);
      rightPoleRef.current.setAttribute("transform", `translate(9, ${(-5 + Number(rpOffset)).toFixed(1)})`);
    }
    if (torsoRef.current) {
      torsoRef.current.setAttribute("transform", `rotate(${anim.sway.toFixed(1)})`);
    }

    // Synchronize continuous travelling orange underline indicator across the 4 switcher tabs
    const centers = tabCentersRef.current;
    const widths = tabWidthsRef.current;
    if (underlineRef.current && centers.length === 4) {
      const ratio = typeof trailRatio === "number" ? trailRatio : (totalLen > 0 ? clampedDist / totalLen : 0);
      const scaledP = Math.max(0, Math.min(3, ratio * 3));
      const segIdx = Math.min(2, Math.floor(scaledP));
      const localT = Math.max(0, Math.min(1, scaledP - segIdx));
      const smoothT = localT * localT * (3 - 2 * localT);

      const c0 = centers[segIdx];
      const c1 = centers[segIdx + 1];
      const w0 = Math.min(widths[segIdx] || 56, 76);
      const w1 = Math.min(widths[segIdx + 1] || 56, 76);

      const baseW = w0 + (w1 - w0) * smoothT;
      const travelStretch = Math.sin(localT * Math.PI) * 14;
      const currentW = Math.max(36, baseW + travelStretch);
      const currentCenter = c0 + (c1 - c0) * smoothT;
      const currentX = currentCenter - currentW / 2;

      underlineRef.current.style.transform = `translate3d(${currentX.toFixed(1)}px, 0, 0)`;
      underlineRef.current.style.width = `${currentW.toFixed(1)}px`;
    }
  }, []);

  // Responsive tick loop synchronized with Lenis
  const startTick = useCallback(() => {
    const anim = animRef.current;
    if (anim.rafId !== null) return;

    const tick = () => {
      const diff = anim.targetProgress - anim.currentProgress;

      if (Math.abs(diff) > 0.0002) {
        anim.currentProgress += diff * 0.16;
      } else {
        anim.currentProgress = anim.targetProgress;
      }

      const trailRatio = progressToTrailRatio(anim.currentProgress);
      const totalLen = pathLengthRef.current;
      const targetDist = trailRatio * totalLen;
      const deltaD = targetDist - anim.lastDistance;
      anim.lastDistance = targetDist;

      if (Math.abs(deltaD) > 0.04) {
        anim.isWalking = true;
        anim.isWalkingBackward = deltaD < 0;
        anim.walkCycle += Math.abs(deltaD) * 0.14;
        anim.stride = Math.sin(anim.walkCycle);
        anim.armStride = Math.cos(anim.walkCycle);
        anim.sway = Math.sin(anim.walkCycle * 0.5) * 2.2;
      } else {
        anim.stride *= 0.82;
        anim.armStride *= 0.82;
        anim.sway *= 0.82;
        if (Math.abs(anim.stride) < 0.01) {
          anim.stride = 0;
          anim.armStride = 0;
          anim.sway = 0;
          anim.isWalking = false;
        }
      }

      updateHikerAndTrail(targetDist, anim, trailRatio);

      // Determine active stage based on progress with hysteresis to prevent flickering
      let stageIdx = activeIndexRef.current;
      const p = anim.currentProgress;

      if (p < 0.20) {
        stageIdx = 0;
      } else if (p < 0.52) {
        // Transition 0 -> 1 at 0.22, reverse 1 -> 0 at 0.18
        if (stageIdx === 0 && p >= 0.22) stageIdx = 1;
        if (stageIdx === 1 && p < 0.18) stageIdx = 0;
        if (stageIdx > 1) stageIdx = 1;
      } else if (p < 0.82) {
        // Transition 1 -> 2 at 0.54, reverse 2 -> 1 at 0.50
        if (stageIdx <= 1 && p >= 0.54) stageIdx = 2;
        if (stageIdx === 2 && p < 0.50) stageIdx = 1;
        if (stageIdx > 2) stageIdx = 2;
      } else {
        // Transition 2 -> 3 at 0.84, reverse 3 -> 2 at 0.80
        if (stageIdx <= 2 && p >= 0.84) stageIdx = 3;
        if (stageIdx === 3 && p < 0.80) stageIdx = 2;
      }

      if (stageIdx !== activeIndexRef.current) {
        const dir = stageIdx >= activeIndexRef.current ? "forward" : "backward";
        setTransitionDirection(dir);
        prevIndexRef.current = stageIdx;
        activeIndexRef.current = stageIdx;
        setActiveIndex(stageIdx);
        setSelectedId(SERVICE_KEYS[stageIdx]);
      }

      // Continue animating until settled in place
      if (Math.abs(diff) > 0.0002 || anim.isWalking || Math.abs(anim.stride) > 0.01) {
        anim.rafId = requestAnimationFrame(tick);
      } else {
        anim.rafId = null;
      }
    };

    anim.rafId = requestAnimationFrame(tick);
  }, [updateHikerAndTrail]);

  // Schmitt trigger hysteresis deadband check for platform architectural benefits
  const checkBenefitsPosition = useCallback(() => {
    if (!benefitRef.current) return;
    const rect = benefitRef.current.getBoundingClientRect();
    const vh = window.innerHeight;

    // Forward activation at 82% vh, reverse reset at 96% vh
    // 14% deadband prevents repeated triggering on boundary micro-scrolls
    if (!benefitsTriggeredRef.current && rect.top <= vh * 0.82 && rect.bottom >= 0) {
      benefitsTriggeredRef.current = true;
      setBenefitsInView(true);
    } else if (benefitsTriggeredRef.current && rect.top > vh * 0.96) {
      benefitsTriggeredRef.current = false;
      setBenefitsInView(false);
    }
  }, []);

  // Compute scroll progress from sticky section position
  const computeScrollProgress = useCallback(() => {
    if (!sectionRef.current) return;

    const rect = sectionRef.current.getBoundingClientRect();
    const vh = window.innerHeight;

    // Pinned travel distance strictly across the 4-stage exploration track
    const scrollDistance = rect.height - vh;
    if (scrollDistance <= 0) return;

    const currentScroll = -rect.top;
    const rawProgress = currentScroll / scrollDistance;
    const clampedProgress = Math.max(0, Math.min(1, rawProgress));

    animRef.current.targetProgress = clampedProgress;

    if (isReducedMotion) {
      animRef.current.currentProgress = clampedProgress;
      const trailRatio = progressToTrailRatio(clampedProgress);
      updateHikerAndTrail(trailRatio * pathLengthRef.current, animRef.current, trailRatio);
      let stageIdx = activeIndexRef.current;
      if (clampedProgress < 0.20) {
        stageIdx = 0;
      } else if (clampedProgress < 0.52) {
        stageIdx = 1;
      } else if (clampedProgress < 0.82) {
        stageIdx = 2;
      } else {
        stageIdx = 3;
      }
      if (stageIdx !== activeIndexRef.current) {
        const dir = stageIdx >= activeIndexRef.current ? "forward" : "backward";
        setTransitionDirection(dir);
        prevIndexRef.current = stageIdx;
        activeIndexRef.current = stageIdx;
        setActiveIndex(stageIdx);
        setSelectedId(SERVICE_KEYS[stageIdx]);
      }
      return;
    }

    startTick();
  }, [isReducedMotion, startTick, updateHikerAndTrail]);

  // Lenis scroll listener
  useLenis(() => {
    computeScrollProgress();
    checkBenefitsPosition();
  });

  // Setup resize and native scroll observers
  useEffect(() => {
    measureTabCenters();

    const onResize = () => {
      measureTabCenters();
      computeScrollProgress();
      checkBenefitsPosition();
    };

    const onScroll = () => {
      computeScrollProgress();
      checkBenefitsPosition();
    };

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && sectionRef.current) {
      ro = new ResizeObserver(() => {
        measureTabCenters();
        computeScrollProgress();
        checkBenefitsPosition();
      });
      ro.observe(sectionRef.current);
    }

    // Initial calculation on mount
    const timer = setTimeout(() => {
      measureTabCenters();
      computeScrollProgress();
      checkBenefitsPosition();
    }, 60);

    const anim = animRef.current;
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      if (ro) ro.disconnect();
      if (anim.rafId !== null) {
        cancelAnimationFrame(anim.rafId);
      }
    };
  }, [measureTabCenters, computeScrollProgress, checkBenefitsPosition]);

  // Handle stage tab click: smoothly scrolls the page and animates the hiker
  const handleStageClick = (idx: number) => {
    if (!sectionRef.current) return;

    const dir = idx >= activeIndexRef.current ? "forward" : "backward";
    setTransitionDirection(dir);
    prevIndexRef.current = idx;
    setSelectedId(SERVICE_KEYS[idx]);
    setActiveIndex(idx);
    activeIndexRef.current = idx;

    const rect = sectionRef.current.getBoundingClientRect();
    const scrollDistance = sectionRef.current.offsetHeight - window.innerHeight;

    // Target progress for stage centers: 0.05, 0.38, 0.70, 0.96
    const targetP = idx === 0 ? 0.05 : idx === 1 ? 0.38 : idx === 2 ? 0.70 : 0.96;
    const sectionDocumentTop = window.scrollY + rect.top;
    const targetScrollY = sectionDocumentTop + targetP * scrollDistance;

    if (lenis) {
      lenis.scrollTo(targetScrollY, { duration: isReducedMotion ? 0 : 0.8 });
    } else {
      window.scrollTo({
        top: targetScrollY,
        behavior: isReducedMotion ? "auto" : "smooth",
      });
    }

    animRef.current.targetProgress = targetP;
    if (isReducedMotion) {
      animRef.current.currentProgress = targetP;
      const trailRatio = progressToTrailRatio(targetP);
      updateHikerAndTrail(trailRatio * pathLengthRef.current, animRef.current, trailRatio);
    } else {
      startTick();
    }
  };

  // Pause preview animation when out of viewport, resume when visible
  useEffect(() => {
    if (!previewContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const msg =
            entry.isIntersecting && selectedId === "web"
              ? "JETWAY_PREVIEW_RESUME"
              : "JETWAY_PREVIEW_PAUSE";
          iframeRef.current?.contentWindow?.postMessage({ type: msg }, "*");
        });
      },
      { threshold: 0.15 }
    );

    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, [selectedId]);

  return (
    <>
      <section
        ref={sectionRef}
        id="platform-stack"
        className="relative w-full h-[320vh] sm:h-[360vh] lg:h-[400vh] bg-transparent text-text-primary"
        aria-labelledby="stack-heading"
      >
        {/* =================================================================
            STICKY VIEWPORT CONTAINER
            Pins during the 4-stage exploration track, keeping the experience
            perfectly centered and in focus.
            ================================================================= */}
        <div
          ref={stickyRef}
          className="sticky top-0 z-20 w-full h-screen overflow-hidden flex flex-col justify-between pt-[76px] pb-4 sm:pb-6 select-none bg-transparent"
        >
        <div className="layout-container w-full flex-1 flex flex-col justify-between min-h-0 select-text">

          {/* =============================================================
              EDITORIAL INTRODUCTION
              ============================================================= */}
          <div className="max-w-3xl mb-2 sm:mb-3 shrink-0">
            <h2
              id="stack-heading"
              className="font-sans text-[28px] sm:text-[36px] lg:text-[44px] font-medium leading-[1.08] tracking-[-0.03em] text-[#F1F0EC] mb-1.5 sm:mb-2"
            >
              One platform. Your entire stack.
            </h2>
            <p className="font-sans text-[13px] sm:text-[14.5px] text-text-secondary leading-[1.5] max-w-[580px] hidden sm:block">
              From the interface your users see to the services working behind the
              scenes, bring your application components together in one
              developer-focused workflow.
            </p>
          </div>

          {/* =============================================================
              STAGE NAVIGATION & HORIZONTAL MOUNTAIN TRAIL
              The conventional underline is completely replaced by an authentic
              engraved mountain trail with a top-down mountaineer.
              ============================================================= */}
          <div ref={switcherRef} className="w-full relative shrink-0 mb-3 sm:mb-4">
            {/* 4-Stage Horizontal Navigation Buttons */}
            <div
              role="tablist"
              aria-label="Application Services"
              className="grid grid-cols-4 gap-2 sm:gap-4 lg:gap-8 pb-1"
            >
              {SERVICE_KEYS.map((id, idx) => {
                const service = SERVICES[id];
                const isSelected = selectedId === id;

                return (
                  <button
                    key={id}
                    ref={(el) => {
                      tabRefs.current[idx] = el;
                    }}
                    role="tab"
                    id={`tab-${id}`}
                    aria-selected={isSelected}
                    aria-controls={`panel-${id}`}
                    onClick={() => handleStageClick(idx)}
                    className="group pt-1 pb-1 text-left transition-all relative flex flex-col justify-start focus:outline-none cursor-pointer select-none"
                  >
                    {/* Stage Number & Service Name */}
                    <div className="flex items-baseline gap-1.5 sm:gap-2 mb-0.5 sm:mb-1 font-sans">
                      <span
                        className={`font-mono text-[10px] sm:text-[11px] font-medium transition-colors duration-300 ${
                          isSelected
                            ? "text-accent-orange font-semibold"
                            : "text-[#66635D] group-hover:text-text-secondary"
                        }`}
                      >
                        {service.index}
                      </span>
                      <span className="text-[#3E3B37] text-[10px] sm:text-[11px]">—</span>
                      <span
                        className={`text-[13px] sm:text-[15px] lg:text-[16px] font-medium tracking-tight transition-colors duration-300 ${
                          isSelected
                            ? "text-[#FAF8F5] font-semibold"
                            : "text-[#77746E] group-hover:text-[#F1F0EC]"
                        }`}
                      >
                        <span className="sm:hidden">{service.shortName}</span>
                        <span className="hidden sm:inline">{service.name}</span>
                      </span>
                    </div>

                    {/* Stage Short Description (Desktop & Tablet) */}
                    <div
                      className={`font-sans text-[11px] sm:text-[12px] leading-snug hidden sm:block transition-colors duration-300 ${
                        isSelected ? "text-[#A8A59E]" : "text-[#55524E] group-hover:text-[#7A7771]"
                      }`}
                    >
                      {service.description}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Continuous Travelling Trail Underline */}
            <div className="w-full relative h-[2px] mt-1 mb-1 overflow-hidden pointer-events-none" aria-hidden="true">
              {/* Hairline rail */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-[#262422]/70" />
              {/* Travelling orange indicator */}
              <div
                ref={underlineRef}
                className="absolute top-0 left-0 h-[2px] rounded-full bg-accent-orange shadow-[0_0_8px_rgba(216,135,98,0.7)] will-change-transform"
                style={{
                  width: tabWidths[0] ? `${Math.min(tabWidths[0], 76)}px` : "56px",
                  transform: tabCenters[0]
                    ? `translate3d(${(tabCenters[0] - (tabWidths[0] ? Math.min(tabWidths[0], 76) / 2 : 28)).toFixed(1)}px, 0, 0)`
                    : "none",
                }}
              />
            </div>

            {/* Continuous Mountain Trail with Top-Down Hiker */}
            <div className="w-full relative h-[32px] sm:h-[36px] mt-0.5 overflow-visible select-none pointer-events-none">
              <svg
                className="w-full h-full overflow-visible"
                aria-hidden="true"
              >
                <defs>
                  {/* Subtle Burnt-Orange Trail Ambient Glow */}
                  <filter id="trail-orange-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Untraveled Mountain Path: Subdued engraved footpath */}
                <path
                  ref={pathRef}
                  d={pathD}
                  fill="none"
                  stroke="#262422"
                  strokeWidth="1.5"
                  strokeDasharray="4 2.5"
                />

                {/* Traveled Mountain Path: Glowing Summit Burnt-Orange Trail */}
                <path
                  ref={traveledGlowRef}
                  d={pathD}
                  fill="none"
                  stroke="#D88762"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  opacity="0.32"
                  filter="url(#trail-orange-glow)"
                />
                <path
                  ref={traveledPathRef}
                  d={pathD}
                  fill="none"
                  stroke="#D88762"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <path
                  ref={traveledCoreRef}
                  d={pathD}
                  fill="none"
                  stroke="#FFA67E"
                  strokeWidth="0.85"
                  strokeLinecap="round"
                />

                {/* Waypoint Stations: Circular nodes mapped beneath each stage */}
                {tabCenters.map((cx, i) => {
                  const isPassed = i <= activeIndex;
                  const isCurrent = i === activeIndex;

                  return (
                    <g key={i} className="transition-all duration-300">
                      {/* Luminous waypoint aura that gently blooms when active */}
                      <circle
                        cx={cx}
                        cy="16"
                        r={isCurrent ? "10" : "6"}
                        fill="#D88762"
                        className={`transition-all duration-400 ease-out ${
                          isCurrent ? "opacity-25" : "opacity-0"
                        }`}
                      />
                      {/* Waypoint ring */}
                      <circle
                        cx={cx}
                        cy="16"
                        r={isCurrent ? "4.8" : isPassed ? "4" : "3.2"}
                        fill={isPassed ? "#D88762" : "#1A1918"}
                        stroke={isPassed ? "#FAF8F5" : "#383531"}
                        strokeWidth={isPassed ? "1.2" : "0.9"}
                        className="transition-all duration-300 ease-out"
                      />
                      {/* Center reticle */}
                      <circle
                        cx={cx}
                        cy="16"
                        r="1.2"
                        fill={isPassed ? "#FAF8F5" : "#5A5752"}
                        className="transition-all duration-300 ease-out"
                      />
                      {/* Elevation notation */}
                      <text
                        x={cx}
                        y="28"
                        textAnchor="middle"
                        className={`font-mono text-[8.5px] sm:text-[9px] tracking-wider transition-colors duration-300 ${
                          isCurrent
                            ? "fill-accent-orange font-semibold"
                            : isPassed
                            ? "fill-[#A8A59E]"
                            : "fill-[#4E4B46]"
                        }`}
                      >
                        {SERVICES[SERVICE_KEYS[i]].elevation}
                      </text>
                    </g>
                  );
                })}

                {/* Top-Down Alpine Hiker navigating along the mountain path */}
                <HorizontalTopDownHiker
                  hikerRef={hikerRef}
                  leftBootRef={leftBootRef}
                  rightBootRef={rightBootRef}
                  leftPoleRef={leftPoleRef}
                  rightPoleRef={rightPoleRef}
                  torsoRef={torsoRef}
                />
              </svg>
            </div>
          </div>

          {/* =============================================================
              MAIN SERVICE STAGE: Fixed Equal-Height Interactive Card
              Zero height jumping when switching stages.
              Refined crossfade reveals the active infrastructure layer.
              ============================================================= */}
          <div
            id={`panel-${selectedId}`}
            role="tabpanel"
            aria-labelledby={`tab-${selectedId}`}
            className="w-full rounded-[10px] bg-surface-card border border-border-default shadow-2xl pt-3 sm:pt-4 lg:pt-5 px-3 sm:px-5 lg:px-6 pb-0 mb-1 sm:mb-2 flex-1 min-h-[380px] max-h-[500px] flex flex-col justify-between overflow-hidden relative"
          >
            {/* VIEW 1: WEB FRONTEND — Live Website Preview */}
            <div
              className={`w-full h-full flex flex-col justify-between ${getPanelTransitionClasses(0)}`}
              aria-hidden={selectedId !== "web"}
            >
              {/* Header with directional staggered entrance */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-3 pb-2 sm:pb-2.5 border-b border-border-subtle/70 shrink-0">
                <div className="space-y-0.5 max-w-xl">
                  <div
                    className={`flex items-center gap-2 font-mono text-[10.5px] text-text-muted tracking-[0.14em] uppercase transition-all duration-350 ease-out delay-[30ms] ${
                      selectedId === "web" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
                    }`}
                  >
                    <span className="text-accent-orange font-medium">01</span>
                    <span>/</span>
                    <span>WEB FRONTEND</span>
                  </div>
                  <h3
                    className={`font-sans text-[18px] sm:text-[21px] font-medium text-[#F1F0EC] tracking-tight leading-tight transition-all duration-400 ease-out delay-[70ms] ${
                      selectedId === "web" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1.5"
                    }`}
                  >
                    Your website, live.
                  </h3>
                  <p
                    className={`font-sans text-[12px] sm:text-[13px] text-text-secondary leading-relaxed line-clamp-1 transition-all duration-450 ease-out delay-[110ms] ${
                      selectedId === "web" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
                    }`}
                  >
                    From your first deploy to every release.
                  </p>
                </div>

                {/* Service Status Badge with subtle pulse focus moment */}
                <div
                  className={`flex items-center gap-2 font-mono text-[11px] self-start sm:self-auto shrink-0 pb-0.5 transition-all duration-400 ease-out delay-[130ms] ${
                    selectedId === "web" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`absolute inline-flex h-full w-full rounded-full bg-semantic-success opacity-75 ${
                        selectedId === "web" ? "animate-ping" : ""
                      }`}
                      style={{ animationDuration: "2.4s", animationIterationCount: 2 }}
                    />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-semantic-success" />
                  </span>
                  <span className="text-[#F1F0EC] font-medium tracking-tight">meridian.jetway.app</span>
                  <span className="text-semantic-success font-medium">Live</span>
                </div>
              </div>

              {/* Viewport Middle Area: Extended all the way to bottom edge */}
              <div
                ref={previewContainerRef}
                onMouseEnter={() => {
                  iframeRef.current?.contentWindow?.postMessage({ type: "JETWAY_PREVIEW_PAUSE" }, "*");
                }}
                onMouseLeave={() => {
                  iframeRef.current?.contentWindow?.postMessage({ type: "JETWAY_PREVIEW_RESUME" }, "*");
                }}
                className={`flex-1 w-full min-h-0 mt-2 sm:mt-2.5 rounded-t-[8px] bg-[#141618] border-t border-x border-border-default/80 overflow-hidden shadow-2xl flex flex-col transition-all duration-500 ease-out delay-[90ms] ${
                  selectedId === "web" ? "opacity-100 scale-100" : "opacity-80 scale-[0.995]"
                }`}
              >
                {/* Browser Frame Header */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-[#141618] border-b border-border-subtle/80 text-[10.5px] font-mono select-none shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#2A2E33]" />
                    <span className="w-2 h-2 rounded-full bg-[#2A2E33]" />
                    <span className="w-2 h-2 rounded-full bg-[#2A2E33]" />
                  </div>

                  <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-[4px] bg-[#1A1D20] border border-border-subtle/80 text-[10.5px] text-text-secondary max-w-sm w-full justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-semantic-success shrink-0" />
                    <span className="text-text-muted">https://</span>
                    <span className="text-[#F1F0EC] font-medium">meridian.jetway.app</span>
                  </div>

                  <div className="text-[10px] text-text-muted shrink-0 hidden sm:block">
                    Anycast Edge
                  </div>
                </div>

                {/* Real Scrollable Website Iframe Viewport */}
                <div className="flex-1 w-full min-h-0 bg-[#F7F5F0] overflow-hidden relative">
                  <iframe
                    ref={iframeRef}
                    src="/preview/meridian"
                    title="Meridian Architecture Studio — Live Frontend Preview on Jetway"
                    className="w-full h-full border-0 select-text"
                  />
                </div>
              </div>
            </div>

            {/* VIEW 2: API SERVICE — Real Request Playground */}
            <div
              className={`w-full h-full flex flex-col justify-between pb-3 sm:pb-4 lg:pb-4 ${getPanelTransitionClasses(1)}`}
              aria-hidden={selectedId !== "api"}
            >
              {/* Header with directional staggered entrance */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-3 pb-2 sm:pb-2.5 border-b border-border-subtle/70 shrink-0">
                <div className="space-y-0.5 max-w-xl">
                  <div
                    className={`flex items-center gap-2 font-mono text-[10.5px] text-text-muted tracking-[0.14em] uppercase transition-all duration-350 ease-out delay-[30ms] ${
                      selectedId === "api" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
                    }`}
                  >
                    <span className="text-accent-orange font-medium">02</span>
                    <span>/</span>
                    <span>API SERVICE</span>
                  </div>
                  <h3
                    className={`font-sans text-[18px] sm:text-[21px] font-medium text-[#F1F0EC] tracking-tight leading-tight transition-all duration-400 ease-out delay-[70ms] ${
                      selectedId === "api" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1.5"
                    }`}
                  >
                    Every request, handled.
                  </h3>
                  <p
                    className={`font-sans text-[12px] sm:text-[13px] text-text-secondary leading-relaxed line-clamp-1 transition-all duration-450 ease-out delay-[110ms] ${
                      selectedId === "api" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
                    }`}
                  >
                    From endpoint to response.
                  </p>
                </div>

                {/* Service Status Badge with subtle ping indicator */}
                <div
                  className={`flex items-center gap-2 font-mono text-[11px] self-start sm:self-auto shrink-0 pb-0.5 transition-all duration-400 ease-out delay-[130ms] ${
                    selectedId === "api" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`absolute inline-flex h-full w-full rounded-full bg-semantic-success opacity-75 ${
                        selectedId === "api" ? "animate-ping" : ""
                      }`}
                      style={{ animationDuration: "2.4s", animationIterationCount: 2 }}
                    />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-semantic-success" />
                  </span>
                  <span className="text-text-secondary">API online</span>
                </div>
              </div>

              {/* Functional API Playground */}
              <div
                className={`flex-1 min-h-0 mt-2.5 overflow-hidden transition-all duration-500 ease-out delay-[90ms] ${
                  selectedId === "api" ? "opacity-100 scale-100" : "opacity-80 scale-[0.995]"
                }`}
              >
                <ApiServicePlayground />
              </div>
            </div>

            {/* VIEW 3: DATABASE — The Living PostgreSQL Database Engine */}
            <div
              className={`w-full h-full flex flex-col justify-between pb-3 sm:pb-4 lg:pb-4 ${getPanelTransitionClasses(2)}`}
              aria-hidden={selectedId !== "db"}
            >
              {/* Header with directional staggered entrance */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-3 pb-2 sm:pb-2.5 border-b border-border-subtle/70 shrink-0">
                <div className="space-y-0.5 max-w-xl">
                  <div
                    className={`flex items-center gap-2 font-mono text-[10.5px] text-text-muted tracking-[0.14em] uppercase transition-all duration-350 ease-out delay-[30ms] ${
                      selectedId === "db" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
                    }`}
                  >
                    <span className="text-accent-orange font-medium">03</span>
                    <span>/</span>
                    <span>DATABASE</span>
                  </div>
                  <h3
                    className={`font-sans text-[18px] sm:text-[21px] font-medium text-[#F1F0EC] tracking-tight leading-tight transition-all duration-400 ease-out delay-[70ms] ${
                      selectedId === "db" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1.5"
                    }`}
                  >
                    Your data, always within reach.
                  </h3>
                  <p
                    className={`font-sans text-[12px] sm:text-[13px] text-text-secondary leading-relaxed line-clamp-1 transition-all duration-450 ease-out delay-[110ms] ${
                      selectedId === "db" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
                    }`}
                  >
                    PostgreSQL storage, built for your application.
                  </p>
                </div>

                {/* Service Status Badge with soft data glow indicator */}
                <div
                  className={`flex items-center gap-2 font-mono text-[11px] self-start sm:self-auto shrink-0 pb-0.5 transition-all duration-400 ease-out delay-[130ms] ${
                    selectedId === "db" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`absolute inline-flex h-full w-full rounded-full bg-semantic-success opacity-75 ${
                        selectedId === "db" ? "animate-ping" : ""
                      }`}
                      style={{ animationDuration: "2.4s", animationIterationCount: 2 }}
                    />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-semantic-success" />
                  </span>
                  <span className="text-[#F1F0EC] font-medium tracking-tight">PostgreSQL 16</span>
                  <span className="text-border-default text-[10px]">·</span>
                  <span className="text-semantic-success font-medium text-[10.5px]">Connected</span>
                </div>
              </div>

              {/* Living Database Engine Visualization */}
              <div
                className={`flex-1 min-h-0 mt-2.5 overflow-hidden transition-all duration-500 ease-out delay-[90ms] ${
                  selectedId === "db" ? "opacity-100 scale-100" : "opacity-80 scale-[0.995]"
                }`}
              >
                <DatabaseServicePlayground />
              </div>
            </div>

            {/* VIEW 4: BACKGROUND WORKER — Living Job Queue */}
            <div
              className={`w-full h-full flex flex-col justify-between pb-3 sm:pb-4 lg:pb-4 ${getPanelTransitionClasses(3)}`}
              aria-hidden={selectedId !== "worker"}
            >
              {/* Header with directional staggered entrance */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-3 pb-2 sm:pb-2.5 border-b border-border-subtle/70 shrink-0">
                <div className="space-y-0.5 max-w-xl">
                  <div
                    className={`flex items-center gap-2 font-mono text-[10.5px] text-text-muted tracking-[0.14em] uppercase transition-all duration-350 ease-out delay-[30ms] ${
                      selectedId === "worker" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
                    }`}
                  >
                    <span className="text-accent-orange font-medium">04</span>
                    <span>/</span>
                    <span>BACKGROUND WORKER</span>
                  </div>
                  <h3
                    className={`font-sans text-[18px] sm:text-[21px] font-medium text-[#F1F0EC] tracking-tight leading-tight transition-all duration-400 ease-out delay-[70ms] ${
                      selectedId === "worker" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1.5"
                    }`}
                  >
                    Heavy work. Handled in the background.
                  </h3>
                  <p
                    className={`font-sans text-[12px] sm:text-[13px] text-text-secondary leading-relaxed line-clamp-1 transition-all duration-450 ease-out delay-[110ms] ${
                      selectedId === "worker" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
                    }`}
                  >
                    Run jobs asynchronously without slowing down your application.
                  </p>
                </div>

                {/* Service Status Badge with worker progression status */}
                <div
                  className={`flex items-center gap-2 font-mono text-[11px] self-start sm:self-auto shrink-0 pb-0.5 transition-all duration-400 ease-out delay-[130ms] ${
                    selectedId === "worker" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`absolute inline-flex h-full w-full rounded-full bg-semantic-success opacity-75 ${
                        selectedId === "worker" ? "animate-ping" : ""
                      }`}
                      style={{ animationDuration: "2.4s", animationIterationCount: 2 }}
                    />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-semantic-success" />
                  </span>
                  <span className="text-semantic-success font-medium">Workers active</span>
                </div>
              </div>

              {/* Living Background Worker Visualization */}
              <div
                className={`flex-1 min-h-0 mt-2.5 overflow-hidden transition-all duration-500 ease-out delay-[90ms] ${
                  selectedId === "worker" ? "opacity-100 scale-100" : "opacity-80 scale-[0.995]"
                }`}
              >
                <WorkerServicePlayground />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

      {/* =================================================================
          NATURAL FLOW EXIT: THREE BENEFIT PILLARS
          Revealed as normal scrolling seamlessly resumes after Stage 4.
          Features a sequential signal conduit pulse and masked typographic reveals.
          ================================================================= */}
      <section
        ref={benefitRef}
        id="platform-benefits"
        className="relative z-10 w-full bg-transparent pt-16 pb-24 sm:pt-20 sm:pb-32"
        aria-label="Platform Architecture Benefits"
      >
        <div className="layout-container w-full max-w-6xl">
          {/* =============================================================
              HAIRLINE SIGNAL CONDUIT (Phase A)
              Conducts a burnt-orange signal pulse from the mountain trail
              across the top of the columns to trigger sequential reveals.
              ============================================================= */}
          <div className="relative w-full h-[2px] mb-8 sm:mb-10 overflow-hidden" aria-hidden="true">
            {/* Base conduit track */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-[#262422]" />

            {/* Burnt-Orange Signal Pulse */}
            <div
              className={`absolute top-0 left-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#D88762] to-[#FFA67E] transition-all ease-out ${
                benefitsInView || isReducedMotion
                  ? "w-full opacity-100 duration-1000"
                  : "w-0 opacity-0 duration-250"
              }`}
              style={{
                boxShadow: benefitsInView ? "0 0 10px rgba(216, 135, 98, 0.6)" : "none",
              }}
            />

            {/* Signal Origin Node */}
            <div
              className={`absolute top-[-2px] left-0 w-1.5 h-1.5 rounded-full bg-accent-orange transition-opacity duration-300 ${
                benefitsInView ? "opacity-90" : "opacity-0"
              }`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 w-full">
            {/* Column 01: Connected services */}
            <div className="space-y-2.5">
              {/* Masked 01 Number */}
              <div className="overflow-hidden">
                <div
                  className={`font-mono text-[11px] text-accent-orange font-medium tracking-wider transition-all ease-out ${
                    benefitsInView || isReducedMotion
                      ? "opacity-100 translate-y-0 duration-400"
                      : "opacity-0 translate-y-2 duration-250"
                  }`}
                  style={{
                    transitionDelay: benefitsInView && !isReducedMotion ? "80ms" : "0ms",
                  }}
                >
                  01
                </div>
              </div>

              {/* Masked Heading */}
              <div className="overflow-hidden">
                <h3
                  className={`font-sans text-[16px] sm:text-[17px] font-medium text-[#F1F0EC] tracking-[-0.015em] transition-all ease-out ${
                    benefitsInView || isReducedMotion
                      ? "opacity-100 translate-y-0 duration-450"
                      : "opacity-0 translate-y-2.5 duration-250"
                  }`}
                  style={{
                    transitionDelay: benefitsInView && !isReducedMotion ? "160ms" : "0ms",
                  }}
                >
                  Connected services
                </h3>
              </div>

              {/* Masked Supporting Text */}
              <div className="overflow-hidden">
                <p
                  className={`font-sans text-[13.5px] text-text-secondary leading-[1.6] transition-all ease-out ${
                    benefitsInView || isReducedMotion
                      ? "opacity-100 translate-y-0 duration-500"
                      : "opacity-0 translate-y-3 duration-250"
                  }`}
                  style={{
                    transitionDelay: benefitsInView && !isReducedMotion ? "240ms" : "0ms",
                  }}
                >
                  Keep the relationships between application components understandable through a shared internal network.
                </p>
              </div>
            </div>

            {/* Column 02: One developer workflow */}
            <div className="space-y-2.5">
              {/* Masked 02 Number */}
              <div className="overflow-hidden">
                <div
                  className={`font-mono text-[11px] text-accent-orange font-medium tracking-wider transition-all ease-out ${
                    benefitsInView || isReducedMotion
                      ? "opacity-100 translate-y-0 duration-400"
                      : "opacity-0 translate-y-2 duration-250"
                  }`}
                  style={{
                    transitionDelay: benefitsInView && !isReducedMotion ? "340ms" : "0ms",
                  }}
                >
                  02
                </div>
              </div>

              {/* Masked Heading */}
              <div className="overflow-hidden">
                <h3
                  className={`font-sans text-[16px] sm:text-[17px] font-medium text-[#F1F0EC] tracking-[-0.015em] transition-all ease-out ${
                    benefitsInView || isReducedMotion
                      ? "opacity-100 translate-y-0 duration-450"
                      : "opacity-0 translate-y-2.5 duration-250"
                  }`}
                  style={{
                    transitionDelay: benefitsInView && !isReducedMotion ? "420ms" : "0ms",
                  }}
                >
                  One developer workflow
                </h3>
              </div>

              {/* Masked Supporting Text */}
              <div className="overflow-hidden">
                <p
                  className={`font-sans text-[13.5px] text-text-secondary leading-[1.6] transition-all ease-out ${
                    benefitsInView || isReducedMotion
                      ? "opacity-100 translate-y-0 duration-500"
                      : "opacity-0 translate-y-3 duration-250"
                  }`}
                  style={{
                    transitionDelay: benefitsInView && !isReducedMotion ? "500ms" : "0ms",
                  }}
                >
                  Reduce the need to think about every component as an entirely separate project. Manage routing, environment, and code from one place.
                </p>
              </div>
            </div>

            {/* Column 03: Room to grow */}
            <div className="space-y-2.5">
              {/* Masked 03 Number */}
              <div className="overflow-hidden">
                <div
                  className={`font-mono text-[11px] text-accent-orange font-medium tracking-wider transition-all ease-out ${
                    benefitsInView || isReducedMotion
                      ? "opacity-100 translate-y-0 duration-400"
                      : "opacity-0 translate-y-2 duration-250"
                  }`}
                  style={{
                    transitionDelay: benefitsInView && !isReducedMotion ? "600ms" : "0ms",
                  }}
                >
                  03
                </div>
              </div>

              {/* Masked Heading */}
              <div className="overflow-hidden">
                <h3
                  className={`font-sans text-[16px] sm:text-[17px] font-medium text-[#F1F0EC] tracking-[-0.015em] transition-all ease-out ${
                    benefitsInView || isReducedMotion
                      ? "opacity-100 translate-y-0 duration-450"
                      : "opacity-0 translate-y-2.5 duration-250"
                  }`}
                  style={{
                    transitionDelay: benefitsInView && !isReducedMotion ? "680ms" : "0ms",
                  }}
                >
                  Room to grow
                </h3>
              </div>

              {/* Masked Supporting Text */}
              <div className="overflow-hidden">
                <p
                  className={`font-sans text-[13.5px] text-text-secondary leading-[1.6] transition-all ease-out ${
                    benefitsInView || isReducedMotion
                      ? "opacity-100 translate-y-0 duration-500"
                      : "opacity-0 translate-y-3 duration-250"
                  }`}
                  style={{
                    transitionDelay: benefitsInView && !isReducedMotion ? "760ms" : "0ms",
                  }}
                >
                  Start with a single frontend service, then attach background workers, queues, and databases as your application evolves.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default ApplicationStack;
