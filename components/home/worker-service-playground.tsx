"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";

type DispatchPhase =
  | "queued"     // 700ms: Event arrives on left, burnt-orange packet travels to center circular hub
  | "processing" // 1000ms: Circular hub rotor rotates, core activates, progress arc sweeps 0% → 100%
  | "dispatch"   // 750ms: Webhook pulses shoot out along 3 radiant conduits from hub to endpoints
  | "delivered"  // 650ms: Endpoints flash with 200 OK delivery receipts and latency confirmation
  | "settle";    // 1600ms: Completed state held for reading before advancing to next event

interface WebhookTarget {
  name: string;
  url: string;
  latency: string;
}

interface WebhookEvent {
  id: string;
  name: string;
  source: string;
  payloadKey: string;
  payloadValue: string;
  targets: WebhookTarget[];
}

const EVENTS: WebhookEvent[] = [
  {
    id: "evt_9821",
    name: "payment.succeeded",
    source: "stripe.webhook.ingress",
    payloadKey: "amount",
    payloadValue: "$128.00 USD",
    targets: [
      { name: "Billing Service", url: "api.internal/billing", latency: "14ms" },
      { name: "Notification Hub", url: "hooks.slack.com/jetway", latency: "22ms" },
      { name: "Analytics Ledger", url: "events.internal/audit", latency: "11ms" },
    ],
  },
  {
    id: "evt_4419",
    name: "release.deployed",
    source: "ci.pipeline.builder",
    payloadKey: "version",
    payloadValue: "v2.14.0 (prod)",
    targets: [
      { name: "Edge Cache Invalidation", url: "edge.jetway.internal", latency: "9ms" },
      { name: "Deployment Monitor", url: "datadog.ingress/deploy", latency: "18ms" },
      { name: "Team Slack Channel", url: "hooks.slack.com/releases", latency: "26ms" },
    ],
  },
  {
    id: "evt_7302",
    name: "asset.transformed",
    source: "media.worker.pool",
    payloadKey: "format",
    payloadValue: "webp (412 KB)",
    targets: [
      { name: "S3 Object Store", url: "s3.internal/optimized", latency: "16ms" },
      { name: "CDN Purge Hook", url: "cloudflare.com/purge", latency: "12ms" },
      { name: "Search Indexer", url: "algolia.ingress/assets", latency: "20ms" },
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
  const [phase, setPhase] = useState<DispatchPhase>("queued");
  const [progress, setProgress] = useState(0);
  const [isInViewport, setIsInViewport] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  // Pause animations when section is outside the viewport
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

  // Coordinated timeline: queued → processing → dispatch → delivered → settle
  useEffect(() => {
    if (isReducedMotion || !isInViewport) {
      return;
    }

    let timeoutId: NodeJS.Timeout;

    switch (phase) {
      case "queued":
        timeoutId = setTimeout(() => setPhase("processing"), 700);
        break;

      case "processing":
        timeoutId = setTimeout(() => {
          setProgress(100);
          setPhase("dispatch");
        }, 1000);
        break;

      case "dispatch":
        timeoutId = setTimeout(() => setPhase("delivered"), 750);
        break;

      case "delivered":
        timeoutId = setTimeout(() => setPhase("settle"), 650);
        break;

      case "settle":
        timeoutId = setTimeout(() => {
          setEventIndex((prev) => (prev + 1) % EVENTS.length);
          setProgress(0);
          setPhase("queued");
        }, 1600);
        break;
    }

    return () => clearTimeout(timeoutId);
  }, [phase, isReducedMotion, isInViewport]);

  // Smooth progress ticker during Phase "processing"
  useEffect(() => {
    if (phase !== "processing" || isReducedMotion || !isInViewport) return;

    const startTime = Date.now();
    const duration = 950;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const current = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(current);
      if (current >= 100) clearInterval(interval);
    }, 25);

    return () => clearInterval(interval);
  }, [phase, isReducedMotion, isInViewport]);

  const activePhase = isReducedMotion ? "delivered" : phase;
  const currentEvent = EVENTS[eventIndex];

  // Stage flags
  const isQueued = activePhase === "queued";
  const isProcessing = activePhase === "processing";
  const isDispatch = activePhase === "dispatch";
  const isDelivered = activePhase === "delivered";
  const isSettle = activePhase === "settle";

  const isHubActive = isProcessing || isDispatch || isDelivered;
  const isSent = isDispatch || isDelivered || isSettle;

  // Active progress arc on radius 68: 2 * PI * 68 ≈ 427.26px
  const arcCircumference = 427.26;
  const arcOffset = isProcessing
    ? arcCircumference - (progress / 100) * arcCircumference
    : isSent
    ? 0
    : arcCircumference;

  // Rotor rotation angle
  const rotorAngle = isProcessing ? 90 : isSent ? 90 : 0;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col justify-center items-center select-none overflow-hidden"
    >
      <style>{`
        @keyframes conduitSignalPulse {
          0% {
            stroke-dashoffset: 120;
            opacity: 0.3;
          }
          50% {
            opacity: 1;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 0.9;
          }
        }
        @keyframes hubOrbitalSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes packetTravelLeft {
          0% {
            cx: 330;
            opacity: 0.3;
          }
          30% {
            opacity: 1;
          }
          100% {
            cx: 430;
            opacity: 1;
          }
        }
        @keyframes packetTravelRightTop {
          0% {
            transform: translate(590px, 180px);
            opacity: 0;
          }
          30% {
            opacity: 1;
          }
          100% {
            transform: translate(720px, 105px);
            opacity: 1;
          }
        }
        @keyframes packetTravelRightMid {
          0% {
            transform: translate(590px, 180px);
            opacity: 0;
          }
          30% {
            opacity: 1;
          }
          100% {
            transform: translate(720px, 180px);
            opacity: 1;
          }
        }
        @keyframes packetTravelRightBot {
          0% {
            transform: translate(590px, 180px);
            opacity: 0;
          }
          30% {
            opacity: 1;
          }
          100% {
            transform: translate(720px, 255px);
            opacity: 1;
          }
        }
      `}</style>

      {/* =================================================================
          JETWAY DISPATCH HUB & WEBHOOK FANOUT ILLUSTRATION
          - Center: Magnificent circular webhook processing core
          - Left: Event trigger & payload spec
          - Right: 3 Webhook destinations receiving live delivery with 200 OK
          - Rich, architectural, high-contrast, perfectly filled stage
          ================================================================= */}
      <div className="w-full h-full relative flex items-center justify-center">
        <svg
          viewBox="0 0 1020 360"
          className="w-full h-full select-none"
          preserveAspectRatio="xMidYMid meet"
          aria-label="Jetway circular background worker dispatching webhooks to live endpoints"
        >
          <defs>
            {/* Core Radial Atmosphere Gradient */}
            <radialGradient id="hub-core-radial" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1E2328" stopOpacity="0.9" />
              <stop offset="70%" stopColor="#14171A" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#0E1012" stopOpacity="1" />
            </radialGradient>

            {/* Glowing Burnt-Orange Ingress Beam */}
            <linearGradient id="ingress-beam" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E58A61" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#E58A61" stopOpacity="1" />
            </linearGradient>

            {/* Glowing Sage-Green Egress Fanout Beams */}
            <linearGradient id="egress-beam" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#82B89D" stopOpacity="1" />
              <stop offset="100%" stopColor="#82B89D" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* =============================================================
              STAGE 01: INCOMING EVENT QUEUE (Left Section, X: 40 to 330)
              Clean, high-contrast architectural card with event payload
              ============================================================= */}
          <g id="scene-trigger">
            {/* Section Stage Tag */}
            <text
              x="45"
              y="52"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="11"
              fill="#E58A61"
              letterSpacing="0.12em"
              fontWeight="500"
            >
              01 / QUEUED EVENT
            </text>

            {/* Event Name & Source */}
            <text
              x="45"
              y="82"
              fontFamily="var(--font-space-grotesk), sans-serif"
              fontSize="20"
              fontWeight="600"
              fill="#F1F0EC"
              letterSpacing="-0.02em"
            >
              {currentEvent.name}
            </text>
            <text
              x="45"
              y="104"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="11"
              fill="#8A8F98"
            >
              source: {currentEvent.source}
            </text>

            {/* Event Spec Payload Card */}
            <rect
              x="45"
              y="126"
              width="275"
              height="146"
              rx="6"
              fill="#131618"
              stroke="#262A2E"
              strokeWidth="1"
            />

            {/* Card Header Bar */}
            <rect x="45" y="126" width="275" height="32" rx="6" fill="#171A1D" />
            <line x1="45" y1="158" x2="320" y2="158" stroke="#22262B" strokeWidth="1" />

            {/* Pulsing Status Dot */}
            <circle
              cx="62"
              cy="142"
              r="3.5"
              fill={isQueued ? "#E58A61" : "#5A6068"}
              className="transition-colors duration-300"
            />
            <text
              x="76"
              y="146"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="11"
              fill="#F1F0EC"
              fontWeight="500"
            >
              {currentEvent.id}
            </text>

            {/* Asynchronous Badge */}
            <rect x="232" y="133" width="76" height="18" rx="3" fill="#1C2126" stroke="#2A3036" strokeWidth="1" />
            <text
              x="270"
              y="145"
              textAnchor="middle"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="9"
              fill="#8A8F98"
              letterSpacing="0.05em"
            >
              ASYNC · 3x RETRY
            </text>

            {/* Payload JSON Snippet */}
            <g transform="translate(60, 180)">
              <text fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#777D7D">
                Payload JSON:
              </text>
              <text
                y="22"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="11"
                fill="#4E535C"
                xmlSpace="preserve"
              >
                &#123;&nbsp;<tspan fill="#8A8F98">&quot;{currentEvent.payloadKey}&quot;</tspan>:&nbsp;
                <tspan fill="#E58A61">&quot;{currentEvent.payloadValue}&quot;</tspan>&nbsp;&#125;
              </text>
            </g>

            {/* Concurrency & Target Summary inside card */}
            <line x1="60" y1="230" x2="305" y2="230" stroke="#1F2328" strokeWidth="1" />
            <text
              x="60"
              y="252"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="10"
              fill="#8A8F98"
            >
              Dispatch targets: <tspan fill="#F1F0EC" fontWeight="500">3 webhook listeners</tspan>
            </text>

            {/* Left Exit Coupling Flange at Vertex (330, 180) */}
            <circle cx="330" cy="180" r="5.5" fill="#131618" stroke="#E58A61" strokeWidth="1.6" />
            <circle cx="330" cy="180" r="2.5" fill="#E58A61" />
          </g>

          {/* =============================================================
              INGRESS CONDUIT: Left (330, 180) → Center Circular Hub (430, 180)
              ============================================================= */}
          <g id="ingress-conduit">
            {/* Guide track */}
            <line x1="330" y1="180" x2="430" y2="180" stroke="#252A2F" strokeWidth="2" strokeDasharray="3 3" />

            {/* Active beam when event is queued & moving into hub */}
            <line
              x1="330"
              y1="180"
              x2="430"
              y2="180"
              stroke="url(#ingress-beam)"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity={isQueued || isProcessing ? 1 : 0.25}
              className="transition-opacity duration-300"
            />

            {/* Moving signal packet */}
            {isQueued && !isReducedMotion && (
              <circle
                cy="180"
                r="4.5"
                fill="#E58A61"
                style={{
                  animation: "packetTravelLeft 700ms cubic-bezier(0.25, 1, 0.5, 1) forwards",
                }}
              />
            )}
          </g>

          {/* =============================================================
              STAGE 02: THE CIRCULAR WEBHOOK DISPATCH HUB (Center: 510, 180)
              The visual focal point: rich orbital geometry, mechanical rotor,
              progress arc, and central high-contrast status core
              ============================================================= */}
          <g id="scene-hub">
            {/* Center Section Stage Tag above Hub */}
            <text
              x="510"
              y="44"
              textAnchor="middle"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="11"
              fill="#E58A61"
              letterSpacing="0.12em"
              fontWeight="500"
            >
              02 / DISPATCH HUB
            </text>
            <text
              x="510"
              y="66"
              textAnchor="middle"
              fontFamily="var(--font-space-grotesk), sans-serif"
              fontSize="18"
              fontWeight="600"
              fill="#F1F0EC"
              letterSpacing="-0.01em"
            >
              Worker Runtime Engine
            </text>

            {/* --- Layer 1: Outer Orbital Compass Ring (R = 100) --- */}
            <circle
              cx="510"
              cy="180"
              r="100"
              fill="none"
              stroke="#252A2F"
              strokeWidth="1"
              strokeDasharray="3 4"
            />

            {/* Orbiting Satellite Node around hub when active */}
            {!isReducedMotion && isHubActive && (
              <g
                style={{
                  transformOrigin: "510px 180px",
                  animation: "hubOrbitalSpin 8s linear infinite",
                }}
              >
                <circle cx="610" cy="180" r="3.5" fill="#E58A61" />
                <circle cx="610" cy="180" r="1.5" fill="#F1F0EC" />
              </g>
            )}

            {/* --- Layer 2: Precision Stator Housing Platform (R = 82) --- */}
            <circle
              cx="510"
              cy="180"
              r="82"
              fill="url(#hub-core-radial)"
              stroke="#32373F"
              strokeWidth="1.5"
            />

            {/* 16 Radial Stator Ticks around circumference */}
            {Array.from({ length: 16 }).map((_, i) => {
              const deg = i * 22.5;
              const isCardinal = deg % 90 === 0;
              const rad = (deg * Math.PI) / 180;
              const innerR = isCardinal ? 74 : 77;
              const x1 = 510 + Math.cos(rad) * innerR;
              const y1 = 180 + Math.sin(rad) * innerR;
              const x2 = 510 + Math.cos(rad) * 82;
              const y2 = 180 + Math.sin(rad) * 82;
              return (
                <line
                  key={`stator-tick-${deg}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isCardinal ? "#5A616B" : "#2E343B"}
                  strokeWidth={isCardinal ? "1.5" : "1"}
                />
              );
            })}

            {/* Left & Right Docking Gates on Hub */}
            <rect x="424" y="172" width="12" height="16" rx="2" fill="#181B1E" stroke="#3A4048" strokeWidth="1" />
            <rect x="584" y="172" width="12" height="16" rx="2" fill="#181B1E" stroke="#3A4048" strokeWidth="1" />

            {/* --- Layer 3: Progress Arc Track & Active Arc (R = 68) --- */}
            <circle
              cx="510"
              cy="180"
              r="68"
              fill="none"
              stroke="#1D2125"
              strokeWidth="2.5"
            />
            <circle
              cx="510"
              cy="180"
              r="68"
              fill="none"
              stroke={isSent ? "#82B89D" : "#E58A61"}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={arcCircumference}
              strokeDashoffset={arcOffset}
              transform="rotate(-90 510 180)"
              className="transition-all duration-100 ease-out"
            />

            {/* --- Layer 4: Rotating Mechanical Caliper / Turbine Rotor (R = 50) --- */}
            <g
              transform={`rotate(${rotorAngle} 510 180)`}
              style={{
                transition: "transform 1s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {/* Rotor Rim */}
              <circle
                cx="510"
                cy="180"
                r="50"
                fill="#121517"
                stroke="#2A3036"
                strokeWidth="1"
              />

              {/* 4 Caliper Vanes */}
              <line x1="478" y1="180" x2="464" y2="180" stroke="#48505A" strokeWidth="1.8" />
              <circle cx="464" cy="180" r="2" fill="#6A727D" />

              <line x1="542" y1="180" x2="556" y2="180" stroke="#48505A" strokeWidth="1.8" />
              <circle cx="556" cy="180" r="2" fill="#6A727D" />

              <line x1="510" y1="148" x2="510" y2="134" stroke="#48505A" strokeWidth="1.8" />
              <circle cx="510" cy="134" r="2" fill="#6A727D" />

              <line x1="510" y1="212" x2="510" y2="226" stroke="#48505A" strokeWidth="1.8" />
              <circle cx="510" cy="226" r="2" fill="#6A727D" />
            </g>

            {/* --- Layer 5: Central High-Contrast Processing Core (R = 30) --- */}
            <circle
              cx="510"
              cy="180"
              r="30"
              fill={
                isSent
                  ? "#111A15"
                  : isProcessing
                  ? "#1F1813"
                  : "#0E1113"
              }
              stroke={
                isSent
                  ? "#82B89D"
                  : isProcessing
                  ? "#E58A61"
                  : "#343A42"
              }
              strokeWidth={isHubActive ? "1.8" : "1.2"}
              className="transition-colors duration-300"
            />

            {/* Core Center Webhook Glyph */}
            <g transform="translate(510, 175)">
              <polygon
                points="0,-10 9,0 0,10 -9,0"
                fill={isSent ? "#192B20" : isProcessing ? "#2F1F17" : "#171B1E"}
                stroke={isSent ? "#82B89D" : isProcessing ? "#E58A61" : "#4A525C"}
                strokeWidth="1.2"
                className="transition-colors duration-300"
              />
              <circle
                cx="0"
                cy="0"
                r="3"
                fill={isSent ? "#82B89D" : isProcessing ? "#E58A61" : "#8A8F98"}
                className="transition-colors duration-300"
              />
            </g>

            {/* Hub Subtitle Status below core */}
            <text
              x="510"
              y="200"
              textAnchor="middle"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="8.5"
              fill={isSent ? "#82B89D" : isProcessing ? "#E58A61" : "#777D7D"}
              fontWeight="500"
              letterSpacing="0.06em"
              className="transition-colors duration-300"
            >
              {isSent ? "DISPATCHED" : isProcessing ? `ROUTING ${progress}%` : "IDLE"}
            </text>
          </g>

          {/* =============================================================
              EGRESS CONDUITS: Center Hub (590, 180) → 3 Webhook Endpoints (720, Y)
              3 Smooth Radiant Béziers:
              - Top: to (720, 105)
              - Mid: to (720, 180)
              - Bot: to (720, 255)
              ============================================================= */}
          <g id="egress-conduits">
            {/* Top Conduit Path */}
            <path
              d="M 590,180 C 640,180 660,105 720,105"
              fill="none"
              stroke="#252A2F"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <path
              d="M 590,180 C 640,180 660,105 720,105"
              fill="none"
              stroke="url(#egress-beam)"
              strokeWidth="2"
              strokeLinecap="round"
              opacity={isSent ? 1 : 0.2}
              className="transition-opacity duration-300"
            />

            {/* Mid Conduit Path */}
            <path
              d="M 590,180 H 720"
              fill="none"
              stroke="#252A2F"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <path
              d="M 590,180 H 720"
              fill="none"
              stroke="url(#egress-beam)"
              strokeWidth="2"
              strokeLinecap="round"
              opacity={isSent ? 1 : 0.2}
              className="transition-opacity duration-300"
            />

            {/* Bot Conduit Path */}
            <path
              d="M 590,180 C 640,180 660,255 720,255"
              fill="none"
              stroke="#252A2F"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <path
              d="M 590,180 C 640,180 660,255 720,255"
              fill="none"
              stroke="url(#egress-beam)"
              strokeWidth="2"
              strokeLinecap="round"
              opacity={isSent ? 1 : 0.2}
              className="transition-opacity duration-300"
            />

            {/* Animated Dispatch Packets shooting out in parallel */}
            {isDispatch && !isReducedMotion && (
              <g>
                <circle
                  r="4"
                  fill="#82B89D"
                  style={{
                    animation: "packetTravelRightTop 750ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
                  }}
                />
                <circle
                  r="4"
                  fill="#82B89D"
                  style={{
                    animation: "packetTravelRightMid 750ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
                  }}
                />
                <circle
                  r="4"
                  fill="#82B89D"
                  style={{
                    animation: "packetTravelRightBot 750ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
                  }}
                />
              </g>
            )}
          </g>

          {/* =============================================================
              STAGE 03: WEBHOOKS SENDING — 3 TARGET ENDPOINTS (Right Section)
              Each endpoint confirms live delivery with 200 OK & latency receipt
              ============================================================= */}
          <g id="scene-endpoints">
            {/* Section Stage Tag */}
            <text
              x="720"
              y="52"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="11"
              fill="#82B89D"
              letterSpacing="0.12em"
              fontWeight="500"
            >
              03 / WEBHOOKS DELIVERED
            </text>

            {/* Target 1: Top (Y = 85 to 125) */}
            <g transform="translate(720, 85)">
              <rect
                x="0"
                y="0"
                width="260"
                height="40"
                rx="5"
                fill="#131618"
                stroke={isSent ? "#2E4235" : "#24282E"}
                strokeWidth="1"
                className="transition-colors duration-300"
              />
              <circle
                cx="16"
                cy="20"
                r="3"
                fill={isSent ? "#82B89D" : "#4A525C"}
                className="transition-colors duration-300"
              />
              <text
                x="28"
                y="17"
                fontFamily="var(--font-space-grotesk), sans-serif"
                fontSize="12"
                fontWeight="600"
                fill="#F1F0EC"
              >
                {currentEvent.targets[0].name}
              </text>
              <text
                x="28"
                y="31"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="10"
                fill="#777D7D"
              >
                {currentEvent.targets[0].url}
              </text>
              {/* Receipt Status Badge */}
              <rect
                x="176"
                y="10"
                width="74"
                height="20"
                rx="3"
                fill={isSent ? "#16271E" : "#181B1E"}
                stroke={isSent ? "#2B4D36" : "#282D33"}
                strokeWidth="1"
                className="transition-colors duration-300"
              />
              <text
                x="213"
                y="24"
                textAnchor="middle"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="9.5"
                fontWeight="500"
                fill={isSent ? "#82B89D" : "#555C66"}
                className="transition-colors duration-300"
              >
                {isSent ? `200 · ${currentEvent.targets[0].latency}` : "READY"}
              </text>
            </g>

            {/* Target 2: Middle (Y = 160 to 200) */}
            <g transform="translate(720, 160)">
              <rect
                x="0"
                y="0"
                width="260"
                height="40"
                rx="5"
                fill="#131618"
                stroke={isSent ? "#2E4235" : "#24282E"}
                strokeWidth="1"
                className="transition-colors duration-300"
              />
              <circle
                cx="16"
                cy="20"
                r="3"
                fill={isSent ? "#82B89D" : "#4A525C"}
                className="transition-colors duration-300"
              />
              <text
                x="28"
                y="17"
                fontFamily="var(--font-space-grotesk), sans-serif"
                fontSize="12"
                fontWeight="600"
                fill="#F1F0EC"
              >
                {currentEvent.targets[1].name}
              </text>
              <text
                x="28"
                y="31"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="10"
                fill="#777D7D"
              >
                {currentEvent.targets[1].url}
              </text>
              {/* Receipt Status Badge */}
              <rect
                x="176"
                y="10"
                width="74"
                height="20"
                rx="3"
                fill={isSent ? "#16271E" : "#181B1E"}
                stroke={isSent ? "#2B4D36" : "#282D33"}
                strokeWidth="1"
                className="transition-colors duration-300"
              />
              <text
                x="213"
                y="24"
                textAnchor="middle"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="9.5"
                fontWeight="500"
                fill={isSent ? "#82B89D" : "#555C66"}
                className="transition-colors duration-300"
              >
                {isSent ? `200 · ${currentEvent.targets[1].latency}` : "READY"}
              </text>
            </g>

            {/* Target 3: Bottom (Y = 235 to 275) */}
            <g transform="translate(720, 235)">
              <rect
                x="0"
                y="0"
                width="260"
                height="40"
                rx="5"
                fill="#131618"
                stroke={isSent ? "#2E4235" : "#24282E"}
                strokeWidth="1"
                className="transition-colors duration-300"
              />
              <circle
                cx="16"
                cy="20"
                r="3"
                fill={isSent ? "#82B89D" : "#4A525C"}
                className="transition-colors duration-300"
              />
              <text
                x="28"
                y="17"
                fontFamily="var(--font-space-grotesk), sans-serif"
                fontSize="12"
                fontWeight="600"
                fill="#F1F0EC"
              >
                {currentEvent.targets[2].name}
              </text>
              <text
                x="28"
                y="31"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="10"
                fill="#777D7D"
              >
                {currentEvent.targets[2].url}
              </text>
              {/* Receipt Status Badge */}
              <rect
                x="176"
                y="10"
                width="74"
                height="20"
                rx="3"
                fill={isSent ? "#16271E" : "#181B1E"}
                stroke={isSent ? "#2B4D36" : "#282D33"}
                strokeWidth="1"
                className="transition-colors duration-300"
              />
              <text
                x="213"
                y="24"
                textAnchor="middle"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="9.5"
                fontWeight="500"
                fill={isSent ? "#82B89D" : "#555C66"}
                className="transition-colors duration-300"
              >
                {isSent ? `200 · ${currentEvent.targets[2].latency}` : "READY"}
              </text>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
