"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";

type NetworkPhase =
  | "arrival"  // 700ms: Event arrives on left, travels along incoming path to dispatch junction
  | "dispatch" // 350ms: Event enters central junction core, routing mechanism activates
  | "fanout"   // 850ms: Coordinated event markers branch out along the 3 conduits to endpoints
  | "delivery" // 700ms: Endpoints confirm delivery, conduits transition to sage green
  | "settle";  // 1200ms: Completed state held cleanly before looping to next event

interface EndpointTarget {
  name: string;
  route: string;
  glyph: "storage" | "purge" | "search";
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
      { name: "S3 Object Store", route: "s3.internal/optimized", glyph: "storage" },
      { name: "CDN Purge Hook", route: "cloudflare.com/purge", glyph: "purge" },
      { name: "Search Indexer", route: "algolia.ingress/assets", glyph: "search" },
    ],
  },
  {
    name: "payment.succeeded",
    source: "stripe.webhook.ingress",
    targets: [
      { name: "Billing Ledger", route: "ledger.internal/receipts", glyph: "storage" },
      { name: "Customer Notifier", route: "resend.com/emails", glyph: "purge" },
      { name: "Analytics Warehouse", route: "snowflake.ingress/events", glyph: "search" },
    ],
  },
  {
    name: "release.deployed",
    source: "ci.pipeline.builder",
    targets: [
      { name: "Edge Cache Invalidation", route: "edge.jetway.internal", glyph: "purge" },
      { name: "Deployment Monitor", route: "datadog.ingress/deploy", glyph: "storage" },
      { name: "Team Slack Channel", route: "hooks.slack.com/releases", glyph: "search" },
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

export function WorkerServicePlayground() {
  const [eventIndex, setEventIndex] = useState(0);
  const [phase, setPhase] = useState<NetworkPhase>("arrival");
  const [isInViewport, setIsInViewport] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  // Pause animation when preview leaves the viewport
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

  // Coordinated event-dispatch timeline
  useEffect(() => {
    if (isReducedMotion || !isInViewport) {
      return;
    }

    let timeoutId: NodeJS.Timeout;

    switch (phase) {
      case "arrival":
        // 700ms: Event travels along incoming path
        timeoutId = setTimeout(() => setPhase("dispatch"), 700);
        break;

      case "dispatch":
        // 350ms: Core accepts event and activates output ports
        timeoutId = setTimeout(() => setPhase("fanout"), 350);
        break;

      case "fanout":
        // 850ms: Coordinated fan-out along 3 branching paths
        timeoutId = setTimeout(() => setPhase("delivery"), 850);
        break;

      case "delivery":
        // 700ms: Success state confirmation
        timeoutId = setTimeout(() => setPhase("settle"), 700);
        break;

      case "settle":
        // 1200ms: Settle and pause, then smoothly cycle to next event
        timeoutId = setTimeout(() => {
          setEventIndex((prev) => (prev + 1) % EVENTS.length);
          setPhase("arrival");
        }, 1200);
        break;
    }

    return () => clearTimeout(timeoutId);
  }, [phase, isReducedMotion, isInViewport]);

  const activePhase = isReducedMotion ? "delivery" : phase;
  const currentEvent = EVENTS[eventIndex];

  // Stage flags
  const isArrival = activePhase === "arrival";
  const isDispatch = activePhase === "dispatch";
  const isFanout = activePhase === "fanout";
  const isDelivery = activePhase === "delivery";
  const isSettle = activePhase === "settle";

  const isJunctionActive = isDispatch || isFanout;
  const isDeliveredState = isDelivery || isSettle;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col justify-center items-center select-none overflow-hidden"
    >
      <style>{`
        @keyframes incomingMarkerSlide {
          0% {
            transform: translate(250px, 170px);
            opacity: 0.2;
          }
          20% {
            opacity: 1;
          }
          100% {
            transform: translate(440px, 170px);
            opacity: 1;
          }
        }
        @keyframes junctionCoreEnter {
          0% {
            transform: translate(440px, 170px);
          }
          100% {
            transform: translate(480px, 170px);
          }
        }
        @keyframes branchMarkerTop {
          0% {
            transform: translate(520px, 152px);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          30% {
            transform: translate(565px, 145px);
          }
          60% {
            transform: translate(625px, 122px);
          }
          85% {
            transform: translate(680px, 100px);
          }
          100% {
            transform: translate(720px, 95px);
            opacity: 1;
          }
        }
        @keyframes branchMarkerMid {
          0% {
            transform: translate(520px, 170px);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          100% {
            transform: translate(720px, 170px);
            opacity: 1;
          }
        }
        @keyframes branchMarkerBot {
          0% {
            transform: translate(520px, 188px);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          30% {
            transform: translate(565px, 195px);
          }
          60% {
            transform: translate(625px, 218px);
          }
          85% {
            transform: translate(680px, 240px);
          }
          100% {
            transform: translate(720px, 245px);
            opacity: 1;
          }
        }
      `}</style>

      {/* =================================================================
          LIVING EVENT-DISPATCH NETWORK
          - Left: Event Source (asset.transformed)
          - Center: Geometric Dispatch Junction (angular faceted silhouette)
          - Right: 3 Integrated Endpoints (S3, CDN Purge, Search Indexer)
          - The network itself is the visual illustration.
          ================================================================= */}
      <div className="w-full h-full relative flex items-center justify-center">
        <svg
          viewBox="0 0 1000 340"
          className="w-full h-full select-none"
          preserveAspectRatio="xMidYMid meet"
          aria-label="Jetway living event-dispatch network illustration"
        >
          <defs>
            {/* Subtle glow gradients for active conduits */}
            <linearGradient id="net-incoming-glow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E58A61" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#E58A61" stopOpacity="1" />
            </linearGradient>

            <linearGradient id="net-branch-success" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#82B89D" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#82B89D" stopOpacity="1" />
            </linearGradient>
          </defs>

          {/* =============================================================
              1. LEFT: COMPACT EVENT SOURCE (No large cards, pure typography & node)
              ============================================================= */}
          <g id="event-source">
            {/* Event Category Tag */}
            <text
              x="60"
              y="136"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="10"
              fill={isArrival ? "#E58A61" : "#77736D"}
              letterSpacing="0.1em"
              className="transition-colors duration-300"
            >
              QUEUED EVENT
            </text>

            {/* Main Event Name */}
            <text
              x="60"
              y="164"
              fontFamily="var(--font-space-grotesk), sans-serif"
              fontSize="20"
              fontWeight="600"
              fill="#F0EEE9"
              letterSpacing="-0.015em"
            >
              {currentEvent.name}
            </text>

            {/* Source Subtitle */}
            <text
              x="60"
              y="186"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="11"
              fill="#77736D"
            >
              source: {currentEvent.source}
            </text>

            {/* Compact Origin Terminal Socket at (248, 170) */}
            <g transform="translate(248, 170)">
              <rect
                x="-8"
                y="-8"
                width="16"
                height="16"
                rx="3"
                fill="#14171A"
                stroke={isArrival ? "#E58A61" : "#2B3037"}
                strokeWidth="1.2"
                className="transition-colors duration-300"
              />
              <circle
                cx="0"
                cy="0"
                r="2.5"
                fill={isArrival ? "#E58A61" : "#4A525C"}
                className="transition-colors duration-300"
              />
            </g>
          </g>

          {/* =============================================================
              2. INCOMING CONDUIT: From (256, 170) to Junction Input (440, 170)
              ============================================================= */}
          <g id="incoming-conduit">
            {/* Passive Baseline Conduit */}
            <line
              x1="256"
              y1="170"
              x2="440"
              y2="170"
              stroke="#24282F"
              strokeWidth="1.2"
            />

            {/* Conduit Cross-Tie Guides */}
            {[290, 330, 370, 410].map((x) => (
              <line
                key={`tie-${x}`}
                x1={x}
                y1={166}
                x2={x}
                y2={174}
                stroke="#1E2227"
                strokeWidth="1"
              />
            ))}

            {/* Active Highlight Stroke ahead of event */}
            {(isArrival || isDispatch) && (
              <line
                x1="256"
                y1="170"
                x2="440"
                y2="170"
                stroke="url(#net-incoming-glow)"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            )}
          </g>

          {/* =============================================================
              3. CENTER: GEOMETRIC DISPATCH JUNCTION (No circles, faceted routing core)
              Center: (480, 170). Angular faceted polygon silhouette.
              ============================================================= */}
          <g id="dispatch-junction">
            {/* Junction Classification Tag */}
            <text
              x="480"
              y="118"
              textAnchor="middle"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="9.5"
              fill={isJunctionActive ? "#E58A61" : "#77736D"}
              letterSpacing="0.1em"
              className="transition-colors duration-300"
            >
              DISPATCH JUNCTION
            </text>

            {/* Outer Angular Faceted Chassis */}
            <polygon
              points="440,170 464,142 496,142 520,152 520,188 496,198 464,198"
              fill="#131618"
              stroke={isJunctionActive ? "#E58A61" : "#2B3037"}
              strokeWidth="1.2"
              strokeLinejoin="round"
              className="transition-colors duration-300"
            />

            {/* Inner Structural Facet Divisions */}
            <line x1="464" y1="142" x2="480" y2="160" stroke="#22262C" strokeWidth="1" />
            <line x1="464" y1="198" x2="480" y2="180" stroke="#22262C" strokeWidth="1" />
            <line x1="496" y1="142" x2="480" y2="160" stroke="#22262C" strokeWidth="1" />
            <line x1="496" y1="198" x2="480" y2="180" stroke="#22262C" strokeWidth="1" />

            {/* Internal Routing Logic Micro-Traces (Feeding the 3 output ports) */}
            <line
              x1="440"
              y1="170"
              x2="470"
              y2="170"
              stroke={isArrival || isDispatch ? "#E58A61" : "#24282F"}
              strokeWidth="1.5"
              className="transition-colors duration-300"
            />
            {/* To Top Port */}
            <line
              x1="486"
              y1="165"
              x2="520"
              y2="152"
              stroke={isJunctionActive || isFanout ? "#E58A61" : isDeliveredState ? "#82B89D" : "#24282F"}
              strokeWidth="1.5"
              className="transition-colors duration-300"
            />
            {/* To Mid Port */}
            <line
              x1="490"
              y1="170"
              x2="520"
              y2="170"
              stroke={isJunctionActive || isFanout ? "#E58A61" : isDeliveredState ? "#82B89D" : "#24282F"}
              strokeWidth="1.5"
              className="transition-colors duration-300"
            />
            {/* To Bot Port */}
            <line
              x1="486"
              y1="175"
              x2="520"
              y2="188"
              stroke={isJunctionActive || isFanout ? "#E58A61" : isDeliveredState ? "#82B89D" : "#24282F"}
              strokeWidth="1.5"
              className="transition-colors duration-300"
            />

            {/* Central Diamond Routing Core */}
            <polygon
              points="480,161 489,170 480,179 471,170"
              fill={
                isDeliveredState
                  ? "#14241B"
                  : isJunctionActive
                  ? "#241812"
                  : "#181B1E"
              }
              stroke={
                isDeliveredState
                  ? "#82B89D"
                  : isJunctionActive
                  ? "#E58A61"
                  : "#3A414A"
              }
              strokeWidth="1.4"
              className="transition-colors duration-300"
            />
            {/* Center Core Dot */}
            <circle
              cx="480"
              cy="170"
              r="2.5"
              fill={
                isDeliveredState
                  ? "#82B89D"
                  : isJunctionActive
                  ? "#E58A61"
                  : "#5A616B"
              }
              className="transition-colors duration-300"
            />

            {/* 3 Output Terminal Ports on Right Facet */}
            <circle cx="520" cy="152" r="2.5" fill={isFanout || isDeliveredState ? "#82B89D" : "#3A414A"} />
            <circle cx="520" cy="170" r="2.5" fill={isFanout || isDeliveredState ? "#82B89D" : "#3A414A"} />
            <circle cx="520" cy="188" r="2.5" fill={isFanout || isDeliveredState ? "#82B89D" : "#3A414A"} />
          </g>

          {/* =============================================================
              4. BRANCHING FAN-OUT CONDUITS (3 Smooth Cubic Bézier Paths)
              - Top: (520, 152) -> (720, 95)
              - Mid: (520, 170) -> (720, 170)
              - Bot: (520, 188) -> (720, 245)
              ============================================================= */}
          <g id="branching-conduits">
            {/* --- Branch 1: Top (to S3 Object Store) --- */}
            {/* Inactive Base Track */}
            <path
              d="M 520,152 C 600,152 640,95 720,95"
              fill="none"
              stroke="#24282F"
              strokeWidth="1.2"
            />
            {/* Active Trace */}
            <path
              d="M 520,152 C 600,152 640,95 720,95"
              fill="none"
              stroke={isDeliveredState ? "#82B89D" : isFanout ? "#E58A61" : "transparent"}
              strokeWidth="1.8"
              strokeLinecap="round"
              className="transition-all duration-400"
            />

            {/* --- Branch 2: Mid (to CDN Purge Hook) --- */}
            {/* Inactive Base Track */}
            <line
              x1="520"
              y1="170"
              x2="720"
              y2="170"
              stroke="#24282F"
              strokeWidth="1.2"
            />
            {/* Active Trace */}
            <line
              x1="520"
              y1="170"
              x2="720"
              y2="170"
              stroke={isDeliveredState ? "#82B89D" : isFanout ? "#E58A61" : "transparent"}
              strokeWidth="1.8"
              strokeLinecap="round"
              className="transition-all duration-400"
            />

            {/* --- Branch 3: Bot (to Search Indexer) --- */}
            {/* Inactive Base Track */}
            <path
              d="M 520,188 C 600,188 640,245 720,245"
              fill="none"
              stroke="#24282F"
              strokeWidth="1.2"
            />
            {/* Active Trace */}
            <path
              d="M 520,188 C 600,188 640,245 720,245"
              fill="none"
              stroke={isDeliveredState ? "#82B89D" : isFanout ? "#E58A61" : "transparent"}
              strokeWidth="1.8"
              strokeLinecap="round"
              className="transition-all duration-400"
            />
          </g>

          {/* =============================================================
              5. ANIMATED EVENT MARKERS (Smooth Path-Based Motion)
              ============================================================= */}
          {!isReducedMotion && (
            <g id="animated-markers">
              {/* Phase A: Incoming Marker traveling along incoming conduit */}
              {isArrival && (
                <g style={{ animation: "incomingMarkerSlide 700ms cubic-bezier(0.25, 1, 0.5, 1) forwards" }}>
                  <rect x="-6" y="-6" width="12" height="12" rx="2.5" fill="#14171A" stroke="#E58A61" strokeWidth="1.4" />
                  <circle cx="0" cy="0" r="2" fill="#E58A61" />
                </g>
              )}

              {/* Phase B: Entering Junction Core */}
              {isDispatch && (
                <g style={{ animation: "junctionCoreEnter 350ms cubic-bezier(0.4, 0, 0.2, 1) forwards" }}>
                  <rect x="-6" y="-6" width="12" height="12" rx="2.5" fill="#14171A" stroke="#E58A61" strokeWidth="1.4" />
                  <circle cx="0" cy="0" r="2" fill="#E58A61" />
                </g>
              )}

              {/* Phase C: 3 Coordinated Fan-out Markers along the 3 branches */}
              {isFanout && (
                <g>
                  {/* Top Branch Marker */}
                  <g style={{ animation: "branchMarkerTop 750ms cubic-bezier(0.25, 1, 0.5, 1) forwards" }}>
                    <rect x="-5" y="-5" width="10" height="10" rx="2" fill="#14171A" stroke="#E58A61" strokeWidth="1.4" />
                    <circle cx="0" cy="0" r="1.8" fill="#E58A61" />
                  </g>

                  {/* Mid Branch Marker (staggered by 60ms) */}
                  <g style={{ animation: "branchMarkerMid 750ms 60ms cubic-bezier(0.25, 1, 0.5, 1) forwards" }}>
                    <rect x="-5" y="-5" width="10" height="10" rx="2" fill="#14171A" stroke="#E58A61" strokeWidth="1.4" />
                    <circle cx="0" cy="0" r="1.8" fill="#E58A61" />
                  </g>

                  {/* Bot Branch Marker (staggered by 120ms) */}
                  <g style={{ animation: "branchMarkerBot 750ms 120ms cubic-bezier(0.25, 1, 0.5, 1) forwards" }}>
                    <rect x="-5" y="-5" width="10" height="10" rx="2" fill="#14171A" stroke="#E58A61" strokeWidth="1.4" />
                    <circle cx="0" cy="0" r="1.8" fill="#E58A61" />
                  </g>
                </g>
              )}
            </g>
          )}

          {/* =============================================================
              6. RIGHT: INTEGRATED ENDPOINTS (No bulky cards, clean modules)
              Terminating precisely at (720, Y)
              ============================================================= */}
          <g id="endpoints">
            {/* Header / Category Tag */}
            <text
              x="720"
              y="52"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="10"
              fill={isDeliveredState ? "#82B89D" : "#77736D"}
              letterSpacing="0.1em"
              className="transition-colors duration-300"
            >
              DISPATCH DESTINATIONS
            </text>

            {/* --- Endpoint 1: Top (S3 Object Store at Y = 95) --- */}
            <g transform="translate(720, 95)">
              {/* Terminal Coupling Node */}
              <circle
                cx="0"
                cy="0"
                r="4.5"
                fill="#131618"
                stroke={isDeliveredState ? "#82B89D" : "#2B3037"}
                strokeWidth="1.5"
                className="transition-colors duration-300"
              />
              <circle
                cx="0"
                cy="0"
                r="2"
                fill={isDeliveredState ? "#82B89D" : "#4A525C"}
                className="transition-colors duration-300"
              />

              {/* Connecting Lead */}
              <line x1="5" y1="0" x2="24" y2="0" stroke="#2B3037" strokeWidth="1" />

              {/* Storage Icon Glyph */}
              <g transform="translate(32, -8)">
                <path d="M 0,4 L 7,0 L 14,4 L 7,8 Z" fill="none" stroke="#A5A19A" strokeWidth="1" />
                <path d="M 0,4 V 11 L 7,15 L 14,11 V 4" fill="none" stroke="#77736D" strokeWidth="1" />
              </g>

              {/* Destination Name & Route */}
              <text
                x="56"
                y="-1"
                fontFamily="var(--font-space-grotesk), sans-serif"
                fontSize="14"
                fontWeight="500"
                fill={isDeliveredState ? "#F0EEE9" : "#C5C1BA"}
                letterSpacing="-0.01em"
                className="transition-colors duration-300"
              >
                {currentEvent.targets[0].name}
              </text>
              <text
                x="56"
                y="14"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="11"
                fill="#77736D"
              >
                {currentEvent.targets[0].route}
              </text>

              {/* Delivery State Confirmation */}
              <text
                x="240"
                y="6"
                textAnchor="end"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="11"
                fontWeight="500"
                fill={isDeliveredState ? "#82B89D" : "#3D444E"}
                className="transition-colors duration-300"
              >
                {isDeliveredState ? "✓ delivered" : "standby"}
              </text>
            </g>

            {/* --- Endpoint 2: Mid (CDN Purge Hook at Y = 170) --- */}
            <g transform="translate(720, 170)">
              {/* Terminal Coupling Node */}
              <circle
                cx="0"
                cy="0"
                r="4.5"
                fill="#131618"
                stroke={isDeliveredState ? "#82B89D" : "#2B3037"}
                strokeWidth="1.5"
                className="transition-colors duration-300"
              />
              <circle
                cx="0"
                cy="0"
                r="2"
                fill={isDeliveredState ? "#82B89D" : "#4A525C"}
                className="transition-colors duration-300"
              />

              {/* Connecting Lead */}
              <line x1="5" y1="0" x2="24" y2="0" stroke="#2B3037" strokeWidth="1" />

              {/* Lightning Purge Glyph */}
              <g transform="translate(32, -8)">
                <path
                  d="M 8,0 L 3,8 H 8 L 6,15 L 13,7 H 8 Z"
                  fill="none"
                  stroke={isDeliveredState ? "#82B89D" : "#A5A19A"}
                  strokeWidth="1.1"
                  className="transition-colors duration-300"
                />
              </g>

              {/* Destination Name & Route */}
              <text
                x="56"
                y="-1"
                fontFamily="var(--font-space-grotesk), sans-serif"
                fontSize="14"
                fontWeight="500"
                fill={isDeliveredState ? "#F0EEE9" : "#C5C1BA"}
                letterSpacing="-0.01em"
                className="transition-colors duration-300"
              >
                {currentEvent.targets[1].name}
              </text>
              <text
                x="56"
                y="14"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="11"
                fill="#77736D"
              >
                {currentEvent.targets[1].route}
              </text>

              {/* Delivery State Confirmation */}
              <text
                x="240"
                y="6"
                textAnchor="end"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="11"
                fontWeight="500"
                fill={isDeliveredState ? "#82B89D" : "#3D444E"}
                className="transition-colors duration-300"
              >
                {isDeliveredState ? "✓ delivered" : "standby"}
              </text>
            </g>

            {/* --- Endpoint 3: Bot (Search Indexer at Y = 245) --- */}
            <g transform="translate(720, 245)">
              {/* Terminal Coupling Node */}
              <circle
                cx="0"
                cy="0"
                r="4.5"
                fill="#131618"
                stroke={isDeliveredState ? "#82B89D" : "#2B3037"}
                strokeWidth="1.5"
                className="transition-colors duration-300"
              />
              <circle
                cx="0"
                cy="0"
                r="2"
                fill={isDeliveredState ? "#82B89D" : "#4A525C"}
                className="transition-colors duration-300"
              />

              {/* Connecting Lead */}
              <line x1="5" y1="0" x2="24" y2="0" stroke="#2B3037" strokeWidth="1" />

              {/* Search Indexer Glyph */}
              <g transform="translate(32, -8)">
                <circle cx="5" cy="5" r="4.5" fill="none" stroke="#A5A19A" strokeWidth="1" />
                <line x1="8.5" y1="8.5" x2="13" y2="13" stroke="#77736D" strokeWidth="1.2" />
              </g>

              {/* Destination Name & Route */}
              <text
                x="56"
                y="-1"
                fontFamily="var(--font-space-grotesk), sans-serif"
                fontSize="14"
                fontWeight="500"
                fill={isDeliveredState ? "#F0EEE9" : "#C5C1BA"}
                letterSpacing="-0.01em"
                className="transition-colors duration-300"
              >
                {currentEvent.targets[2].name}
              </text>
              <text
                x="56"
                y="14"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="11"
                fill="#77736D"
              >
                {currentEvent.targets[2].route}
              </text>

              {/* Delivery State Confirmation */}
              <text
                x="240"
                y="6"
                textAnchor="end"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="11"
                fontWeight="500"
                fill={isDeliveredState ? "#82B89D" : "#3D444E"}
                className="transition-colors duration-300"
              >
                {isDeliveredState ? "✓ delivered" : "standby"}
              </text>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
