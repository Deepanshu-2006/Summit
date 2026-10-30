"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";

interface EndpointTarget {
  name: string;
  route: string;
  glyph: "storage" | "purge" | "search";
  latency: string;
}

interface DispatchEvent {
  name: string;
  source: string;
  targets: EndpointTarget[];
}

const EVENTS: DispatchEvent[] = [
  {
    name: "asset.transformed",
    source: "media.worker.pool",
    targets: [
      { name: "S3 Object Store", route: "s3.internal/optimized", glyph: "storage", latency: "14ms" },
      { name: "CDN Purge Hook", route: "cloudflare.com/purge", glyph: "purge", latency: "22ms" },
      { name: "Search Indexer", route: "algolia.ingress/assets", glyph: "search", latency: "11ms" },
    ],
  },
  {
    name: "payment.succeeded",
    source: "stripe.webhook.ingress",
    targets: [
      { name: "Billing Ledger", route: "ledger.internal/receipts", glyph: "storage", latency: "16ms" },
      { name: "Customer Notifier", route: "resend.com/emails", glyph: "purge", latency: "19ms" },
      { name: "Analytics Warehouse", route: "snowflake.ingress/events", glyph: "search", latency: "25ms" },
    ],
  },
  {
    name: "release.deployed",
    source: "ci.pipeline.builder",
    targets: [
      { name: "Edge Cache Invalidation", route: "edge.jetway.internal", glyph: "purge", latency: "8ms" },
      { name: "Deployment Monitor", route: "datadog.ingress/deploy", glyph: "storage", latency: "18ms" },
      { name: "Team Slack Channel", route: "hooks.slack.com/releases", glyph: "search", latency: "24ms" },
    ],
  },
];

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

// Parametric evaluation of the stepped incoming conduit from (224, 174) to (414, 184)
function getIngressPoint(t: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(1, t));
  // Seg 1: (224, 174) -> (268, 174)
  if (clamped <= 0.230) {
    const s = clamped / 0.230;
    return { x: 224 + s * 44, y: 174 };
  }
  // Seg 2: (268, 174) -> (320, 184)
  else if (clamped <= 0.508) {
    const s = (clamped - 0.230) / (0.508 - 0.230);
    return { x: 268 + s * 52, y: 174 + s * 10 };
  }
  // Seg 3: (320, 184) -> (414, 184) (Straight horizontal through Node 2 and Node 3)
  else {
    const s = Math.min(1, (clamped - 0.508) / (1 - 0.508));
    return { x: 320 + s * 94, y: 184 };
  }
}

// Parametric evaluation of top cubic Bezier: (569, 144) -> (714, 102)
function getTopEgressPoint(u: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(1, u));
  const inv = 1 - clamped;
  const x = inv ** 3 * 569 + 3 * inv ** 2 * clamped * 630 + 3 * inv * clamped ** 2 * 656 + clamped ** 3 * 714;
  const y = inv ** 3 * 144 + 3 * inv ** 2 * clamped * 144 + 3 * inv * clamped ** 2 * 102 + clamped ** 3 * 102;
  return { x, y };
}

// Parametric evaluation of middle cubic Bezier: (577, 168) -> (714, 170)
function getMidEgressPoint(u: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(1, u));
  const inv = 1 - clamped;
  const x = inv ** 3 * 577 + 3 * inv ** 2 * clamped * 625 + 3 * inv * clamped ** 2 * 665 + clamped ** 3 * 714;
  const y = inv ** 3 * 168 + 3 * inv ** 2 * clamped * 168 + 3 * inv * clamped ** 2 * 170 + clamped ** 3 * 170;
  return { x, y };
}

// Parametric evaluation of bottom cubic Bezier: (565, 190) -> (714, 238)
function getBotEgressPoint(u: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(1, u));
  const inv = 1 - clamped;
  const x = inv ** 3 * 565 + 3 * inv ** 2 * clamped * 630 + 3 * inv * clamped ** 2 * 656 + clamped ** 3 * 714;
  const y = inv ** 3 * 190 + 3 * inv ** 2 * clamped * 190 + 3 * inv * clamped ** 2 * 238 + clamped ** 3 * 238;
  return { x, y };
}

function renderTargetGlyph(glyph: "storage" | "purge" | "search") {
  switch (glyph) {
    case "storage":
      return (
        <g>
          <polygon points="0,-7 8,-3 0,1 -8,-3" fill="none" stroke="#F0EEE9" strokeWidth="1.1" />
          <polygon points="-8,-3 0,1 0,9 -8,5" fill="none" stroke="#A5A19A" strokeWidth="1.1" />
          <polygon points="0,1 8,-3 8,5 0,9" fill="none" stroke="#77736D" strokeWidth="1.1" />
        </g>
      );
    case "purge":
      return (
        <path
          d="M 2,-8 L -4,0 H 1 L -2,8 L 5,-1 H 0 Z"
          fill="none"
          stroke="#F0EEE9"
          strokeWidth="1.2"
        />
      );
    case "search":
      return (
        <g>
          <circle cx="-2" cy="-2" r="4.5" fill="none" stroke="#F0EEE9" strokeWidth="1.2" />
          <line x1="2" y1="2" x2="6" y2="6" stroke="#F0EEE9" strokeWidth="1.4" />
        </g>
      );
  }
}

export function WorkerServicePlayground() {
  const [eventIndex, setEventIndex] = useState(0);
  const [cycleTime, setCycleTime] = useState(0); // 0 to 4200ms
  const [isInViewport, setIsInViewport] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  // Pause when outside viewport
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Continuous high-precision 60fps animation loop using requestAnimationFrame (100% reliable in Safari)
  useEffect(() => {
    if (isReducedMotion || !isInViewport) return;

    let animationFrameId: number;
    let startTime = performance.now();

    const render = (now: number) => {
      const elapsed = now - startTime;
      const CYCLE_DURATION = 4200; // 4.2s cycle

      if (elapsed >= CYCLE_DURATION) {
        startTime = now;
        setEventIndex((prev) => (prev + 1) % EVENTS.length);
        setCycleTime(0);
      } else {
        setCycleTime(elapsed);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isReducedMotion, isInViewport]);

  const currentEvent = EVENTS[eventIndex];

  // Lifecycle phases derived directly from cycleTime
  // 0ms -> 1000ms: Ingress (orange signal moves along stepped conduit)
  // 1000ms -> 1800ms: Core (center rotunda & amber vents fully energized)
  // 1800ms -> 2800ms: Egress (3 sage-green signals fan out to endpoints)
  // 2800ms -> 4200ms: Delivery confirmation & settle
  const isIngress = !isReducedMotion && cycleTime < 1000;
  const isCore = !isReducedMotion && cycleTime >= 1000 && cycleTime < 1800;
  const isEgress = !isReducedMotion && cycleTime >= 1800 && cycleTime < 2800;
  const isDelivered = isReducedMotion || cycleTime >= 2800;

  // Normalized phase progress
  const ingressProgress = isIngress ? cycleTime / 1000 : isCore || isEgress || isDelivered ? 1 : 0;
  const egressProgress = isEgress ? (cycleTime - 1800) / 1000 : isDelivered ? 1 : 0;

  // Signal particle coordinates
  const ingressPos = getIngressPoint(ingressProgress);
  const egressPosTop = getTopEgressPoint(egressProgress);
  const egressPosMid = getMidEgressPoint(egressProgress);
  const egressPosBot = getBotEgressPoint(egressProgress);

  // Active state flags for each node along the network
  const isNode1Active = ingressProgress >= 0.23;
  const isNode2Active = ingressProgress >= 0.63;
  const isNode3Active = ingressProgress >= 0.92;

  const isCenterEnergized = isCore || isEgress || isDelivered;
  const isConduitsActive = isEgress || isDelivered;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col justify-center items-center select-none overflow-hidden"
    >
      <div className="w-full h-full relative flex items-center justify-center">
        <svg
          viewBox="0 0 1060 320"
          className="w-full h-full select-none"
          preserveAspectRatio="xMidYMid meet"
          aria-label="Jetway background worker live event dispatch rotunda"
        >
          <defs>
            {/* 3D Rotunda Base Cylinder Metallic Wall (Warm charcoal, not cool blue/slate) */}
            <linearGradient id="warm-rotunda-wall" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#121110" />
              <stop offset="20%" stopColor="#1A1816" />
              <stop offset="50%" stopColor="#24201D" />
              <stop offset="80%" stopColor="#1A1816" />
              <stop offset="100%" stopColor="#121110" />
            </linearGradient>

            {/* Stepped Ingress Conduit Beam Gradient */}
            <linearGradient id="warm-ingress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E58A61" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#FFAA80" stopOpacity="1" />
            </linearGradient>

            {/* Atmospheric Ambient Amber Glow behind diamond core */}
            <radialGradient id="center-ambient-amber" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E58A61" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#E58A61" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#E58A61" stopOpacity="0" />
            </radialGradient>

            {/* Soft Glow Filter for active points and diamond */}
            <filter id="point-amber-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="point-green-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* =============================================================
              1. BACKGROUND ISOMETRIC DOTTED ORBITS & ALIGNMENT AXES
              ============================================================= */}
          <g id="guide-axes">
            {/* Dotted Orbital Ellipse */}
            <ellipse
              cx="490"
              cy="176"
              rx="124"
              ry="58"
              fill="none"
              stroke={isCenterEnergized ? "#3D2B20" : "#2A231E"}
              strokeWidth="1"
              strokeDasharray="2 4"
              className="transition-colors duration-400"
            />
          </g>

          {/* =============================================================
              2. 3D ISOMETRIC CYLINDRICAL ROTUNDA (Center: 490, 172)
              Warm charcoal palette with glowing amber interior vents
              ============================================================= */}
          <g id="center-rotunda">
            {/* Ambient Warm Volumetric Core Glow */}
            <ellipse
              cx="490"
              cy="146"
              rx={isCenterEnergized ? 75 : 55}
              ry={isCenterEnergized ? 42 : 30}
              fill="url(#center-ambient-amber)"
              opacity={isCenterEnergized ? 1 : 0.4}
              className="transition-all duration-400"
            />

            {/* --- Tier 1: Lower Cylinder Base --- */}
            <path
              d="M 414,172 V 192 A 76 36 0 0 0 566,192 V 172 A 76 36 0 0 1 414,172 Z"
              fill="url(#warm-rotunda-wall)"
              stroke="#302B26"
              strokeWidth="1"
            />
            <path
              d="M 414,192 A 76 36 0 0 0 566,192"
              fill="none"
              stroke="#3D352E"
              strokeWidth="1"
            />

            {/* Slotted Recessed Vents with Vibrant Amber Interior Glow */}
            <g id="amber-vents">
              {/* Vent 1 */}
              <rect
                x="438"
                y="176"
                width="6.5"
                height="12"
                rx="1.5"
                fill={isCenterEnergized ? "#FFAA80" : "#6E3821"}
                filter={isCenterEnergized ? "url(#point-amber-glow)" : undefined}
                className="transition-all duration-300"
              />
              {/* Vent 2 */}
              <rect
                x="462"
                y="181"
                width="7"
                height="13"
                rx="1.5"
                fill={isCenterEnergized ? "#FFAA80" : "#6E3821"}
                filter={isCenterEnergized ? "url(#point-amber-glow)" : undefined}
                className="transition-all duration-300"
              />
              {/* Vent 3 (Center) */}
              <rect
                x="486.5"
                y="183"
                width="7"
                height="13"
                rx="1.5"
                fill={isCenterEnergized ? "#FFBA94" : "#7A3F24"}
                filter={isCenterEnergized ? "url(#point-amber-glow)" : undefined}
                className="transition-all duration-300"
              />
              {/* Vent 4 */}
              <rect
                x="511"
                y="181"
                width="7"
                height="13"
                rx="1.5"
                fill={isCenterEnergized ? "#FFAA80" : "#6E3821"}
                filter={isCenterEnergized ? "url(#point-amber-glow)" : undefined}
                className="transition-all duration-300"
              />
              {/* Vent 5 */}
              <rect
                x="535.5"
                y="176"
                width="6.5"
                height="12"
                rx="1.5"
                fill={isCenterEnergized ? "#FFAA80" : "#6E3821"}
                filter={isCenterEnergized ? "url(#point-amber-glow)" : undefined}
                className="transition-all duration-300"
              />
            </g>

            {/* --- Tier 2: Stepped Ring & Bevel --- */}
            <ellipse
              cx="490"
              cy="166"
              rx="70"
              ry="33"
              fill="#141312"
              stroke="#3D3630"
              strokeWidth="1.2"
            />

            {/* --- Tier 3: Upper Cylinder Rotunda --- */}
            <path
              d="M 435,148 V 162 A 55 26 0 0 0 545,162 V 148 A 55 26 0 0 1 435,148 Z"
              fill="#181615"
              stroke="#332D28"
              strokeWidth="1"
            />
            <ellipse
              cx="490"
              cy="148"
              rx="55"
              ry="26"
              fill="#121110"
              stroke="#4A413A"
              strokeWidth="1.2"
            />
            {/* Recessed Chamber Floor */}
            <ellipse
              cx="490"
              cy="148"
              rx="46"
              ry="22"
              fill="#0A0909"
              stroke="#24201D"
              strokeWidth="1"
            />

            {/* --- Floating Luminous Isometric Diamond Core --- */}
            <g
              id="diamond-core"
              transform={isCenterEnergized ? "translate(0, -2)" : undefined}
              className="transition-transform duration-500 ease-out"
            >
              {/* Diamond Volumetric Ambient Glow Halo */}
              {isCenterEnergized && (
                <polygon
                  points="490,123 521,139 490,155 459,139"
                  fill="rgba(229, 138, 97, 0.25)"
                  filter="url(#point-amber-glow)"
                />
              )}

              {/* Core Outer Diamond Surface */}
              <polygon
                points="490,125 518,139 490,153 462,139"
                fill={isCenterEnergized ? "rgba(229, 138, 97, 0.24)" : "rgba(229, 138, 97, 0.10)"}
                stroke={isCenterEnergized ? "#FFAA80" : "#E58A61"}
                strokeWidth={isCenterEnergized ? "1.8" : "1.4"}
                strokeLinejoin="round"
                className="transition-all duration-300"
              />

              {/* Inner Concentric Isometric Diamond Chip */}
              <polygon
                points="490,132 504,139 490,146 476,139"
                fill={isCenterEnergized ? "rgba(255, 170, 128, 0.18)" : "rgba(229, 138, 97, 0.06)"}
                stroke={isCenterEnergized ? "#FFAA80" : "#B86642"}
                strokeWidth="1.1"
                strokeLinejoin="round"
                className="transition-all duration-300"
              />

              {/* Precision Solid Crosshairs (Crisp Solid Lines, Perfectly Contained Inside Diamond) */}
              <line
                x1="462"
                y1="139"
                x2="518"
                y2="139"
                stroke={isCenterEnergized ? "#FFAA80" : "#E58A61"}
                strokeWidth="1"
                opacity={isCenterEnergized ? 0.9 : 0.5}
                className="transition-opacity duration-300"
              />
              <line
                x1="490"
                y1="125"
                x2="490"
                y2="153"
                stroke={isCenterEnergized ? "#FFAA80" : "#E58A61"}
                strokeWidth="1"
                opacity={isCenterEnergized ? 0.9 : 0.5}
                className="transition-opacity duration-300"
              />

              {/* Vertex Registration Markers at 4 Cardinal Tips */}
              <circle cx="462" cy="139" r="1.5" fill={isCenterEnergized ? "#FFAA80" : "#B86642"} />
              <circle cx="518" cy="139" r="1.5" fill={isCenterEnergized ? "#FFAA80" : "#B86642"} />
              <circle cx="490" cy="125" r="1.5" fill={isCenterEnergized ? "#FFAA80" : "#B86642"} />
              <circle cx="490" cy="153" r="1.5" fill={isCenterEnergized ? "#FFAA80" : "#B86642"} />

              {/* Center Luminous Quantum Nucleus */}
              <circle
                cx="490"
                cy="139"
                r="3"
                fill={isCenterEnergized ? "#FFAA80" : "#E58A61"}
                filter={isCenterEnergized ? "url(#point-amber-glow)" : undefined}
                className="transition-all duration-300"
              />
              {isCenterEnergized && (
                <circle cx="490" cy="139" r="1.4" fill="#FFFFFF" />
              )}
            </g>

            {/* --- Right Rim 3 Output Port Rings --- */}
            {/* Top Port at (564, 144) */}
            <circle
              cx="564"
              cy="144"
              r="5.5"
              fill="#121416"
              stroke={isConduitsActive ? "#82B89D" : "#3D4E44"}
              strokeWidth="1.5"
              className="transition-colors duration-300"
            />
            <circle
              cx="564"
              cy="144"
              r="2.2"
              fill={isConduitsActive ? "#82B89D" : "#3D4E44"}
              filter={isConduitsActive ? "url(#point-green-glow)" : undefined}
              className="transition-all duration-300"
            />

            {/* Mid Port at (572, 168) */}
            <circle
              cx="572"
              cy="168"
              r="5.5"
              fill="#121416"
              stroke={isConduitsActive ? "#82B89D" : "#3D4E44"}
              strokeWidth="1.5"
              className="transition-colors duration-300"
            />
            <circle
              cx="572"
              cy="168"
              r="2.2"
              fill={isConduitsActive ? "#82B89D" : "#3D4E44"}
              filter={isConduitsActive ? "url(#point-green-glow)" : undefined}
              className="transition-all duration-300"
            />

            {/* Bot Port at (560, 190) */}
            <circle
              cx="560"
              cy="190"
              r="5.5"
              fill="#121416"
              stroke={isConduitsActive ? "#82B89D" : "#3D4E44"}
              strokeWidth="1.5"
              className="transition-colors duration-300"
            />
            <circle
              cx="560"
              cy="190"
              r="2.2"
              fill={isConduitsActive ? "#82B89D" : "#3D4E44"}
              filter={isConduitsActive ? "url(#point-green-glow)" : undefined}
              className="transition-all duration-300"
            />
          </g>

          {/* =============================================================
              3. LEFT SIDE: QUEUED EVENT & STEPPED CONDUIT
              Interactive nodes and smooth traveling orange particle
              ============================================================= */}
          <g id="left-ingress">
            {/* QUEUED EVENT Tag */}
            <text
              x="70"
              y="148"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="10"
              fill={isIngress ? "#E58A61" : "#77736D"}
              letterSpacing="0.1em"
              className="transition-colors duration-300"
            >
              QUEUED EVENT
            </text>

            {/* Left Event Square Badge */}
            <rect
              x="70"
              y="162"
              width="24"
              height="24"
              rx="4"
              fill="#14171A"
              stroke={isIngress ? "#FFAA80" : "#E58A61"}
              strokeWidth="1.4"
              className="transition-colors duration-300"
            />
            <circle
              cx="82"
              cy="174"
              r="3.5"
              fill={isIngress ? "#FFAA80" : "#E58A61"}
              filter={isIngress ? "url(#point-amber-glow)" : undefined}
              className="transition-all duration-300"
            />

            {/* Event Name */}
            <text
              x="104"
              y="172"
              fontFamily="var(--font-space-grotesk), sans-serif"
              fontSize="15"
              fontWeight="500"
              fill="#F0EEE9"
              letterSpacing="-0.01em"
            >
              {currentEvent.name}
            </text>

            {/* Source Subtitle */}
            <text
              x="104"
              y="188"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="11"
              fill="#77736D"
            >
              source: {currentEvent.source}
            </text>

            {/* Stepped Conduit Base Line: straight horizontal line through Node 2 and Node 3 into cylinder */}
            <path
              d="M 224,174 H 268 L 320,184 H 414"
              fill="none"
              stroke="#262A30"
              strokeWidth="1.4"
            />

            {/* Stepped Conduit Active Highlight Beam */}
            <path
              d="M 224,174 H 268 L 320,184 H 414"
              fill="none"
              stroke="url(#warm-ingress-gradient)"
              strokeWidth="1.8"
              opacity={isIngress ? 1 : 0.25}
              className="transition-opacity duration-300"
            />

            {/* Point 1: Node at (268, 174) */}
            <circle
              cx="268"
              cy="174"
              r="5"
              fill="#121416"
              stroke={isNode1Active ? "#FFAA80" : "#3A424D"}
              strokeWidth={isNode1Active ? "1.6" : "1.2"}
              className="transition-all duration-200"
            />
            {isNode1Active && (
              <circle cx="268" cy="174" r="2" fill="#FFAA80" filter="url(#point-amber-glow)" />
            )}

            {/* Point 2: Orange Node at (344, 184) - Perfectly centered on horizontal segment */}
            <circle
              cx="344"
              cy="184"
              r="5.5"
              fill="#121416"
              stroke={isNode2Active ? "#FFAA80" : "#E58A61"}
              strokeWidth="1.4"
              className="transition-colors duration-200"
            />
            <circle
              cx="344"
              cy="184"
              r="2.5"
              fill={isNode2Active ? "#FFAA80" : "#E58A61"}
              filter={isNode2Active ? "url(#point-amber-glow)" : undefined}
              className="transition-all duration-200"
            />

            {/* Point 3: Coupling Double-Ring at (400, 184) - Clean 7.5px spacing from cylinder wall */}
            <circle
              cx="400"
              cy="184"
              r="6.5"
              fill="#121416"
              stroke={isNode3Active ? "#FFAA80" : "#F0EEE9"}
              strokeWidth="1.4"
              className="transition-colors duration-200"
            />
            <circle
              cx="400"
              cy="184"
              r="3.8"
              fill="none"
              stroke={isNode3Active ? "#FFAA80" : "#E58A61"}
              strokeWidth="1.2"
            />
            <circle
              cx="400"
              cy="184"
              r="2"
              fill={isNode3Active ? "#FFAA80" : "#E58A61"}
              filter={isNode3Active ? "url(#point-amber-glow)" : undefined}
            />

            {/* Guaranteed Moving Orange Particle along Stepped Path */}
            {isIngress && (
              <g>
                <circle
                  cx={ingressPos.x}
                  cy={ingressPos.y}
                  r="4.5"
                  fill="#FFAA80"
                  filter="url(#point-amber-glow)"
                />
                <circle cx={ingressPos.x} cy={ingressPos.y} r="2.2" fill="#FFFFFF" />
              </g>
            )}
          </g>

          {/* =============================================================
              4. RIGHT SIDE: 3 SAGE GREEN CONDUITS & HEXAGONAL ENDPOINTS
              Moving signals, glowing hexagons, live delivery text
              ============================================================= */}
          <g id="right-egress">
            {/* Top Conduit: (569, 144) -> (714, 102) */}
            <path
              d="M 569,144 C 630,144 656,102 714,102"
              fill="none"
              stroke="#82B89D"
              strokeWidth={isConduitsActive ? "1.8" : "1.2"}
              opacity={isConduitsActive ? 1 : 0.35}
              className="transition-all duration-300"
            />

            {/* Mid Conduit: (577, 168) -> (714, 170) */}
            <path
              d="M 577,168 C 625,168 665,170 714,170"
              fill="none"
              stroke="#82B89D"
              strokeWidth={isConduitsActive ? "1.8" : "1.2"}
              opacity={isConduitsActive ? 1 : 0.35}
              className="transition-all duration-300"
            />

            {/* Bot Conduit: (565, 190) -> (714, 238) */}
            <path
              d="M 565,190 C 630,190 656,238 714,238"
              fill="none"
              stroke="#82B89D"
              strokeWidth={isConduitsActive ? "1.8" : "1.2"}
              opacity={isConduitsActive ? 1 : 0.35}
              className="transition-all duration-300"
            />

            {/* Guaranteed Moving Green Signal Particles along the 3 Bezier Paths */}
            {isEgress && (
              <g>
                {/* Top Particle */}
                <circle
                  cx={egressPosTop.x}
                  cy={egressPosTop.y}
                  r="4"
                  fill="#82B89D"
                  filter="url(#point-green-glow)"
                />
                <circle cx={egressPosTop.x} cy={egressPosTop.y} r="1.8" fill="#FFFFFF" />

                {/* Mid Particle */}
                <circle
                  cx={egressPosMid.x}
                  cy={egressPosMid.y}
                  r="4"
                  fill="#82B89D"
                  filter="url(#point-green-glow)"
                />
                <circle cx={egressPosMid.x} cy={egressPosMid.y} r="1.8" fill="#FFFFFF" />

                {/* Bot Particle */}
                <circle
                  cx={egressPosBot.x}
                  cy={egressPosBot.y}
                  r="4"
                  fill="#82B89D"
                  filter="url(#point-green-glow)"
                />
                <circle cx={egressPosBot.x} cy={egressPosBot.y} r="1.8" fill="#FFFFFF" />
              </g>
            )}

            {/* --- Destination 1: Top (Y = 102) --- */}
            <g transform="translate(714, 102)">
              {/* Terminal Coupling Dot */}
              <circle
                cx="0"
                cy="0"
                r="3.5"
                fill="#82B89D"
                filter={isDelivered ? "url(#point-green-glow)" : undefined}
              />
              <line x1="4" y1="0" x2="16" y2="0" stroke="#82B89D" strokeWidth="1.2" />

              {/* Hexagonal Outlined Badge */}
              <g transform="translate(32, 0)">
                <polygon
                  points="0,-17 15,-8.5 15,8.5 0,17 -15,8.5 -15,-8.5"
                  fill="#131619"
                  stroke={isDelivered ? "#82B89D" : "#4A564E"}
                  strokeWidth={isDelivered ? "1.6" : "1.2"}
                  filter={isDelivered ? "url(#point-green-glow)" : undefined}
                  className="transition-all duration-300"
                />
                {renderTargetGlyph(currentEvent.targets[0].glyph)}
              </g>

              {/* Title & Route */}
              <text
                x="58"
                y="-3"
                fontFamily="var(--font-space-grotesk), sans-serif"
                fontSize="13"
                fontWeight="500"
                fill="#F0EEE9"
                letterSpacing="-0.01em"
              >
                {currentEvent.targets[0].name}
              </text>
              <text
                x="58"
                y="12"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="11"
                fill={isDelivered ? "#A5A19A" : "#68645E"}
                className="transition-colors duration-300"
              >
                {currentEvent.targets[0].route}
              </text>

              {/* Live Delivery Telemetry Pill */}
              <g transform="translate(236, 0)">
                <rect
                  x="0"
                  y="-9"
                  width="62"
                  height="18"
                  rx="9"
                  fill={isDelivered ? "#112017" : "#131619"}
                  stroke={isDelivered ? "#244431" : "#22272E"}
                  strokeWidth="1"
                  className="transition-all duration-300"
                />
                <circle
                  cx="10"
                  cy="0"
                  r={isDelivered ? "2.5" : "2"}
                  fill={isDelivered ? "#82B89D" : "#4A5360"}
                  filter={isDelivered ? "url(#point-green-glow)" : undefined}
                  className="transition-all duration-300"
                />
                <text
                  x="20"
                  y="3.5"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="10"
                  fontWeight={isDelivered ? "500" : "400"}
                  fill={isDelivered ? "#82B89D" : "#5A6472"}
                  className="transition-colors duration-300"
                >
                  {isDelivered ? currentEvent.targets[0].latency : "queue"}
                </text>
              </g>
            </g>

            {/* --- Destination 2: Mid (Y = 170) --- */}
            <g transform="translate(714, 170)">
              {/* Terminal Coupling Dot */}
              <circle
                cx="0"
                cy="0"
                r="3.5"
                fill="#82B89D"
                filter={isDelivered ? "url(#point-green-glow)" : undefined}
              />
              <line x1="4" y1="0" x2="16" y2="0" stroke="#82B89D" strokeWidth="1.2" />

              {/* Hexagonal Outlined Badge */}
              <g transform="translate(32, 0)">
                <polygon
                  points="0,-17 15,-8.5 15,8.5 0,17 -15,8.5 -15,-8.5"
                  fill="#131619"
                  stroke={isDelivered ? "#82B89D" : "#4A564E"}
                  strokeWidth={isDelivered ? "1.6" : "1.2"}
                  filter={isDelivered ? "url(#point-green-glow)" : undefined}
                  className="transition-all duration-300"
                />
                {renderTargetGlyph(currentEvent.targets[1].glyph)}
              </g>

              {/* Title & Route */}
              <text
                x="58"
                y="-3"
                fontFamily="var(--font-space-grotesk), sans-serif"
                fontSize="13"
                fontWeight="500"
                fill="#F0EEE9"
                letterSpacing="-0.01em"
              >
                {currentEvent.targets[1].name}
              </text>
              <text
                x="58"
                y="12"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="11"
                fill={isDelivered ? "#A5A19A" : "#68645E"}
                className="transition-colors duration-300"
              >
                {currentEvent.targets[1].route}
              </text>

              {/* Live Delivery Telemetry Pill */}
              <g transform="translate(236, 0)">
                <rect
                  x="0"
                  y="-9"
                  width="62"
                  height="18"
                  rx="9"
                  fill={isDelivered ? "#112017" : "#131619"}
                  stroke={isDelivered ? "#244431" : "#22272E"}
                  strokeWidth="1"
                  className="transition-all duration-300"
                />
                <circle
                  cx="10"
                  cy="0"
                  r={isDelivered ? "2.5" : "2"}
                  fill={isDelivered ? "#82B89D" : "#4A5360"}
                  filter={isDelivered ? "url(#point-green-glow)" : undefined}
                  className="transition-all duration-300"
                />
                <text
                  x="20"
                  y="3.5"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="10"
                  fontWeight={isDelivered ? "500" : "400"}
                  fill={isDelivered ? "#82B89D" : "#5A6472"}
                  className="transition-colors duration-300"
                >
                  {isDelivered ? currentEvent.targets[1].latency : "queue"}
                </text>
              </g>
            </g>

            {/* --- Destination 3: Bot (Y = 238) --- */}
            <g transform="translate(714, 238)">
              {/* Terminal Coupling Dot */}
              <circle
                cx="0"
                cy="0"
                r="3.5"
                fill="#82B89D"
                filter={isDelivered ? "url(#point-green-glow)" : undefined}
              />
              <line x1="4" y1="0" x2="16" y2="0" stroke="#82B89D" strokeWidth="1.2" />

              {/* Hexagonal Outlined Badge */}
              <g transform="translate(32, 0)">
                <polygon
                  points="0,-17 15,-8.5 15,8.5 0,17 -15,8.5 -15,-8.5"
                  fill="#131619"
                  stroke={isDelivered ? "#82B89D" : "#4A564E"}
                  strokeWidth={isDelivered ? "1.6" : "1.2"}
                  filter={isDelivered ? "url(#point-green-glow)" : undefined}
                  className="transition-all duration-300"
                />
                {renderTargetGlyph(currentEvent.targets[2].glyph)}
              </g>

              {/* Title & Route */}
              <text
                x="58"
                y="-3"
                fontFamily="var(--font-space-grotesk), sans-serif"
                fontSize="13"
                fontWeight="500"
                fill="#F0EEE9"
                letterSpacing="-0.01em"
              >
                {currentEvent.targets[2].name}
              </text>
              <text
                x="58"
                y="12"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="11"
                fill={isDelivered ? "#A5A19A" : "#68645E"}
                className="transition-colors duration-300"
              >
                {currentEvent.targets[2].route}
              </text>

              {/* Live Delivery Telemetry Pill */}
              <g transform="translate(236, 0)">
                <rect
                  x="0"
                  y="-9"
                  width="62"
                  height="18"
                  rx="9"
                  fill={isDelivered ? "#112017" : "#131619"}
                  stroke={isDelivered ? "#244431" : "#22272E"}
                  strokeWidth="1"
                  className="transition-all duration-300"
                />
                <circle
                  cx="10"
                  cy="0"
                  r={isDelivered ? "2.5" : "2"}
                  fill={isDelivered ? "#82B89D" : "#4A5360"}
                  filter={isDelivered ? "url(#point-green-glow)" : undefined}
                  className="transition-all duration-300"
                />
                <text
                  x="20"
                  y="3.5"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="10"
                  fontWeight={isDelivered ? "500" : "400"}
                  fill={isDelivered ? "#82B89D" : "#5A6472"}
                  className="transition-colors duration-300"
                >
                  {isDelivered ? currentEvent.targets[2].latency : "queue"}
                </text>
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
