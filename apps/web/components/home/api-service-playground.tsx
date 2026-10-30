"use client";

import React, { useState, useEffect, useRef } from "react";

type RequestType = "GET" | "POST";

type LifecyclePhase =
  | "setup"       // 400ms: Request initiation at client origin
  | "outgoing"    // 900ms: Burnt-orange signal travels through curved conduit into API engine
  | "processing"  // 500ms: Central isometric engine core illuminates & executes
  | "returning"   // 900ms: Sage-green signal travels through egress conduit to destination
  | "reveal"      // 600ms: Response status & JSON properties materialize line by line
  | "completed";  // 1600ms: Completed state held for reading

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

export function ApiServicePlayground() {
  const [requestType, setRequestType] = useState<RequestType>("GET");
  const [phase, setPhase] = useState<LifecyclePhase>("setup");
  const [isInViewport, setIsInViewport] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const isReducedMotion = React.useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  // Pause animation when preview is outside viewport
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

  // Single controlled animation state machine
  useEffect(() => {
    if (isReducedMotion || !isInViewport) {
      return;
    }

    let timeoutId: NodeJS.Timeout;

    switch (phase) {
      case "setup":
        timeoutId = setTimeout(() => setPhase("outgoing"), 400);
        break;
      case "outgoing":
        timeoutId = setTimeout(() => setPhase("processing"), 900);
        break;
      case "processing":
        timeoutId = setTimeout(() => setPhase("returning"), 500);
        break;
      case "returning":
        timeoutId = setTimeout(() => setPhase("reveal"), 900);
        break;
      case "reveal":
        timeoutId = setTimeout(() => setPhase("completed"), 600);
        break;
      case "completed":
        // Hold completed state, then smoothly cycle between GET and POST
        timeoutId = setTimeout(() => {
          setRequestType((prev) => (prev === "GET" ? "POST" : "GET"));
          setPhase("setup");
        }, 1600);
        break;
    }

    return () => clearTimeout(timeoutId);
  }, [phase, isReducedMotion, isInViewport]);

  const activePhase: LifecyclePhase = isReducedMotion ? "completed" : phase;
  const isGet = requestType === "GET";

  const isResponseActive =
    activePhase === "returning" || activePhase === "reveal" || activePhase === "completed";

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden select-none relative"
    >
      <style>{`
        @keyframes conduitDashFlow {
          0% {
            stroke-dashoffset: 20;
          }
          100% {
            stroke-dashoffset: -20;
          }
        }
        @keyframes signalTravelDesktop1 {
          0% {
            offset-distance: 0%;
            opacity: 0;
            transform: scale(0.6);
          }
          15% {
            opacity: 1;
            transform: scale(1);
          }
          85% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            offset-distance: 100%;
            opacity: 0;
            transform: scale(0.6);
          }
        }
        @keyframes signalTravelDesktop2 {
          0% {
            offset-distance: 0%;
            opacity: 0;
            transform: scale(0.6);
          }
          15% {
            opacity: 1;
            transform: scale(1);
          }
          85% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            offset-distance: 100%;
            opacity: 0;
            transform: scale(0.6);
          }
        }
        @keyframes pulseHalo {
          0%, 100% {
            transform: scale(1);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.3);
            opacity: 0.9;
          }
        }
        @keyframes jsonLineFade {
          from {
            opacity: 0;
            transform: translateY(3px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* =================================================================
          DESKTOP & TABLET: Architectural Technical Sketch
          Zero Slate Backgrounds · Pure Isometric Plinth Sketch · Smooth Bézier Conduits
          viewBox="0 0 1020 360"
          ================================================================= */}
      <div className="hidden md:flex w-full h-full items-center justify-center">
        <svg
          className="w-full h-full max-h-[390px] overflow-visible"
          viewBox="0 0 1020 360"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
        >
          <defs>
            {/* Precision Volumetric Isometric Shading (Matching Jetway Build Core) */}
            <linearGradient id="api-iso-top-vol" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22262A" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#131618" stopOpacity="0.95" />
            </linearGradient>

            <linearGradient id="api-iso-left-vol" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1A1D20" stopOpacity="0.98" />
              <stop offset="100%" stopColor="#0E1012" stopOpacity="0.98" />
            </linearGradient>

            <linearGradient id="api-iso-right-vol" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#16181B" stopOpacity="0.98" />
              <stop offset="100%" stopColor="#0A0B0D" stopOpacity="0.98" />
            </linearGradient>

            <linearGradient id="api-core-glow-active" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#D88762" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#D88762" stopOpacity="0.08" />
            </linearGradient>

            <linearGradient id="api-core-glow-success" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#83B69A" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#83B69A" stopOpacity="0.08" />
            </linearGradient>

            <linearGradient id="api-core-glow-idle" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22262A" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#131618" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* =============================================================
              CONNECTING PIPELINE CONDUITS (Rendered Behind Geometry)
              Leg 1: Request Origin (280, 215) -> API Engine (410, 215)
              Leg 2: API Engine (610, 215) -> Response Destination (740, 215)
              ============================================================= */}
          <g id="conduit-wiring">
            {/* Leg 1: Background Dashed Guide */}
            <path
              d="M 280,215 C 325,185 365,245 410,215"
              stroke="#3D4245"
              strokeWidth="1.2"
              strokeDasharray="3 3"
              fill="none"
            />
            {/* Leg 1: Active Burnt-Orange Trace */}
            <path
              id="leg1-path"
              d="M 280,215 C 325,185 365,245 410,215"
              stroke="#D88762"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity={activePhase === "outgoing" ? 1 : 0.4}
              className="transition-opacity duration-300"
            />
            {/* Leg 1 Midpoint Outlined Junction Node */}
            <circle cx="345" cy="215" r="4" fill="#121416" stroke="#D88762" strokeWidth="1.4" />
            <circle cx="345" cy="215" r="1.8" fill="#D88762" />

            {/* Leg 1 Animated Signal Motion Packet */}
            {activePhase === "outgoing" && (
              <circle
                r="4.5"
                fill="#D88762"
                style={{
                  offsetPath: "path('M 280,215 C 325,185 365,245 410,215')",
                  animation: "signalTravelDesktop1 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                }}
              />
            )}

            {/* Leg 2: Background Dashed Guide */}
            <path
              d="M 610,215 C 655,185 695,245 740,215"
              stroke="#3D4245"
              strokeWidth="1.2"
              strokeDasharray="3 3"
              fill="none"
            />
            {/* Leg 2: Active Sage-Green Trace */}
            <path
              id="leg2-path"
              d="M 610,215 C 655,185 695,245 740,215"
              stroke="#83B69A"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity={isResponseActive ? 1 : 0.3}
              className="transition-opacity duration-300"
            />
            {/* Leg 2 Midpoint Outlined Junction Node */}
            <circle cx="675" cy="215" r="4" fill="#121416" stroke="#83B69A" strokeWidth="1.4" />
            <circle cx="675" cy="215" r="1.8" fill="#83B69A" />

            {/* Leg 2 Animated Signal Motion Packet */}
            {activePhase === "returning" && (
              <circle
                r="4.5"
                fill="#83B69A"
                style={{
                  offsetPath: "path('M 610,215 C 655,185 695,245 740,215')",
                  animation: "signalTravelDesktop2 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                }}
              />
            )}
          </g>

          {/* =============================================================
              STAGE 01: REQUEST ORIGIN (Left Section)
              Zero Slate Card · Pure Elegant Typography & Origin Flange
              ============================================================= */}
          <g id="scene-request">
            {/* Section Stage Identifier */}
            <text
              x="50"
              y="62"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="11"
              fill="#D88762"
              letterSpacing="0.12em"
              fontWeight="500"
            >
              01 / REQUEST
            </text>

            {/* Method & Endpoint (Prominent, High-Contrast Typography) */}
            <text
              x="50"
              y="96"
              fontFamily="var(--font-space-grotesk), sans-serif"
              fontSize="22"
              fontWeight="600"
              fill="#F1F0EC"
              letterSpacing="-0.02em"
            >
              <tspan fill={isGet ? "#83B69A" : "#D88762"}>{isGet ? "GET" : "POST"}</tspan>
              <tspan fill="#F1F0EC" dx="8">
                {isGet ? "/api/v1/projects" : "/api/v1/resources"}
              </tspan>
            </text>

            {/* Subtitle / Description */}
            <text
              x="50"
              y="122"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="12"
              fill="#777D7D"
            >
              {isGet ? "Query project metadata & deployment status" : "Provision production application resource"}
            </text>

            {/* Content Payload / Protocol Headers (No Box, Pure Typography) */}
            {isGet ? (
              <g>
                <text
                  x="50"
                  y="156"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="11.5"
                  fill="#4E535C"
                >
                  Accept: application/json
                </text>
                <text
                  x="50"
                  y="178"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="11.5"
                  fill="#4E535C"
                >
                  Authorization: Bearer jet_live_sec
                </text>
                <text
                  x="50"
                  y="200"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="11.5"
                  fill="#3D424A"
                >
                  Host: api.jetway.internal
                </text>
              </g>
            ) : (
              <text
                x="50"
                y="152"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="12"
                fill="#4E525A"
                xmlSpace="preserve"
              >
                <tspan x="50" dy="0">&#123;</tspan>
                <tspan x="68" dy="21" fill="#8A8F98">&quot;name&quot;: <tspan fill="#D88762">&quot;Production resource&quot;</tspan><tspan fill="#4E525A">,</tspan></tspan>
                <tspan x="68" dy="21" fill="#8A8F98">&quot;type&quot;: <tspan fill="#D88762">&quot;web&quot;</tspan></tspan>
                <tspan x="50" dy="21" fill="#4E525A">&#125;</tspan>
              </text>
            )}

            {/* Output Flange Coupling at Vertex (280, 215) */}
            <circle cx="280" cy="215" r="5.5" fill="#121416" stroke="#F1F0EC" strokeWidth="1.8" />
            <circle cx="280" cy="215" r="2.5" fill="#D88762" />
          </g>

          {/* =============================================================
              STAGE 02: API ENGINE — THE ISOMETRIC ARCHITECTURAL SKETCH
              Modeled directly after Jetway Build Core · Layered 30° Plinth
              ============================================================= */}
          <g id="scene-engine">
            {/* Stage 02 Heading: Centered above API Engine (X = 510) */}
            <text
              x="510"
              y="55"
              textAnchor="middle"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="11"
              fill="#D88762"
              letterSpacing="0.12em"
            >
              02 / RUNTIME
            </text>
            <text
              x="510"
              y="80"
              textAnchor="middle"
              fontFamily="var(--font-space-grotesk), sans-serif"
              fontSize="22"
              fontWeight="500"
              fill="#F1F0EC"
              letterSpacing="-0.02em"
            >
              Jetway API Engine
            </text>
            <text
              x="510"
              y="100"
              textAnchor="middle"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="12"
              fill="#777D7D"
            >
              Distributed edge request execution
            </text>

            {/* Base Level: Substructure Foundation Platform (30° Isometric) */}
            <polygon
              points="510,165 610,215 510,265 410,215"
              fill="url(#api-iso-top-vol)"
              stroke="#F1F0EC"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <polygon
              points="410,215 510,265 510,295 410,245"
              fill="url(#api-iso-left-vol)"
              stroke="#F1F0EC"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <polygon
              points="510,265 610,215 610,245 510,295"
              fill="url(#api-iso-right-vol)"
              stroke="#F1F0EC"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />

            {/* Substructure Cooling Ventilation Micro-Fins (Vertical Slits) */}
            <line x1="432" y1="228" x2="432" y2="252" stroke="#3D4245" strokeWidth="1.2" />
            <line x1="454" y1="239" x2="454" y2="263" stroke="#3D4245" strokeWidth="1.2" />
            <line x1="476" y1="250" x2="476" y2="274" stroke="#3D4245" strokeWidth="1.2" />
            <line x1="544" y1="250" x2="544" y2="274" stroke="#3D4245" strokeWidth="1.2" />
            <line x1="566" y1="239" x2="566" y2="263" stroke="#3D4245" strokeWidth="1.2" />
            <line x1="588" y1="228" x2="588" y2="252" stroke="#3D4245" strokeWidth="1.2" />

            {/* Mid Level: Upper Integrated Core Plinth (Isometric) */}
            <polygon
              points="510,148 575,180 510,212 445,180"
              fill="url(#api-iso-top-vol)"
              stroke="#F1F0EC"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <polygon
              points="445,180 510,212 510,230 445,198"
              fill="url(#api-iso-left-vol)"
              stroke="#A6AAA9"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <polygon
              points="510,212 575,180 575,198 510,230"
              fill="url(#api-iso-right-vol)"
              stroke="#A6AAA9"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />

            {/* Core Level: Active Central Processor Nucleus (Illuminates on request) */}
            <polygon
              points="510,160 545,178 510,196 475,178"
              fill={
                activePhase === "processing"
                  ? "url(#api-core-glow-active)"
                  : isResponseActive
                  ? "url(#api-core-glow-success)"
                  : "url(#api-core-glow-idle)"
              }
              stroke={
                activePhase === "processing"
                  ? "#D88762"
                  : isResponseActive
                  ? "#83B69A"
                  : "#555A64"
              }
              strokeWidth="1.8"
              strokeLinejoin="round"
              className="transition-colors duration-300"
            />
            {/* Core Crosshair Registration Lines */}
            <line
              x1="490"
              y1="178"
              x2="530"
              y2="178"
              stroke={activePhase === "processing" ? "#D88762" : isResponseActive ? "#83B69A" : "#555A64"}
              strokeWidth="1.2"
              className="transition-colors duration-300"
            />
            <line
              x1="510"
              y1="168"
              x2="510"
              y2="188"
              stroke={activePhase === "processing" ? "#D88762" : isResponseActive ? "#83B69A" : "#555A64"}
              strokeWidth="1.2"
              className="transition-colors duration-300"
            />
            <circle
              cx="510"
              cy="178"
              r="2.8"
              fill={activePhase === "processing" ? "#D88762" : isResponseActive ? "#83B69A" : "#555A64"}
              className="transition-colors duration-300"
            />

            {/* Internal Pipeline Trace (Connecting Left Flange -> Core -> Right Flange) */}
            <path
              d="M 410,215 L 475,178 L 545,178 L 610,215"
              stroke={activePhase === "processing" ? "#D88762" : isResponseActive ? "#83B69A" : "#3D4245"}
              strokeWidth="1.4"
              strokeDasharray="2.5 2.5"
              fill="none"
              className="transition-colors duration-300"
            />

            {/* Flange Couplings at Platform Vertices */}
            <circle cx="410" cy="215" r="5.5" fill="#121416" stroke="#F1F0EC" strokeWidth="1.8" />
            <circle
              cx="410"
              cy="215"
              r="2.5"
              fill={activePhase === "outgoing" || activePhase === "processing" ? "#D88762" : "#45494B"}
              className="transition-colors duration-300"
            />

            <circle cx="610" cy="215" r="5.5" fill="#121416" stroke="#F1F0EC" strokeWidth="1.8" />
            <circle
              cx="610"
              cy="215"
              r="2.5"
              fill={isResponseActive ? "#83B69A" : "#45494B"}
              className="transition-colors duration-300"
            />

            {/* =========================================================
                API ENGINE TELEMETRY SEQUENCE (Docked Directly Beneath)
                ========================================================= */}
            <g id="engine-telemetry-sequence">
              {/* Step 1: Route resolved */}
              <g>
                <circle
                  cx="410"
                  cy="312"
                  r="3"
                  fill="#121416"
                  stroke={activePhase === "setup" ? "#45494B" : "#83B69A"}
                  strokeWidth="1.6"
                />
                <text x="424" y="316" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#F1F0EC">
                  Route matched
                </text>
                <text x="610" y="316" textAnchor="end" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#A6AAA9">
                  1.2ms
                </text>
              </g>

              {/* Step 2: Handler executed (Active Highlight during processing) */}
              <g>
                <circle
                  cx="410"
                  cy="332"
                  r="3"
                  fill={activePhase === "processing" ? "#D88762" : isResponseActive ? "#83B69A" : "#121416"}
                  stroke={activePhase === "processing" ? "#D88762" : isResponseActive ? "#83B69A" : "#45494B"}
                  strokeWidth="1.6"
                  className="transition-colors duration-300"
                />
                <text x="424" y="336" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#F1F0EC">
                  Handler executed
                </text>
                <text
                  x="610"
                  y="336"
                  textAnchor="end"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="11"
                  fill={activePhase === "processing" ? "#D88762" : isResponseActive ? "#83B69A" : "#A6AAA9"}
                  className="transition-colors duration-300"
                >
                  18.4ms
                </text>
              </g>

              {/* Step 3: Response prepared */}
              <g>
                <circle
                  cx="410"
                  cy="352"
                  r="3"
                  fill="#121416"
                  stroke={isResponseActive ? "#83B69A" : "#45494B"}
                  strokeWidth="1.6"
                  className="transition-colors duration-300"
                />
                <text x="424" y="356" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#F1F0EC">
                  Response serialized
                </text>
                <text x="610" y="356" textAnchor="end" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#A6AAA9">
                  0.4ms
                </text>
              </g>
            </g>
          </g>

          {/* =============================================================
              STAGE 03: RESPONSE DESTINATION (Right Section)
              Zero Slate Card · Pure Elegant Typography & Intake Flange
              ============================================================= */}
          <g id="scene-response">
            {/* Section Stage Identifier */}
            <text
              x="740"
              y="62"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="11"
              fill="#83B69A"
              letterSpacing="0.12em"
              fontWeight="500"
            >
              03 / RESPONSE
            </text>

            {/* Status Header (Prominent, High-Contrast Typography) */}
            {isResponseActive ? (
              <g>
                <circle cx="745" cy="88" r="3.5" fill="#83B69A" />
                <text
                  x="758"
                  y="96"
                  fontFamily="var(--font-space-grotesk), sans-serif"
                  fontSize="22"
                  fontWeight="600"
                  fill="#83B69A"
                  letterSpacing="-0.02em"
                >
                  {isGet ? "200 OK" : "201 Created"}
                </text>
                <text
                  x="740"
                  y="122"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="12"
                  fill="#777D7D"
                >
                  {isGet ? "Payload retrieved · Edge response" : "Resource created · Anycast Edge"}
                </text>
              </g>
            ) : (
              <g>
                <text
                  x="740"
                  y="96"
                  fontFamily="var(--font-space-grotesk), sans-serif"
                  fontSize="22"
                  fontWeight="500"
                  fill="#555A64"
                  letterSpacing="-0.02em"
                >
                  Response destination
                </text>
                <text
                  x="740"
                  y="122"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="12"
                  fill="#444852"
                >
                  Waiting for execution cycle...
                </text>
              </g>
            )}

            {/* Formatted JSON Payload (Clean, High-Contrast, Line-by-Line Reveal) */}
            {!isResponseActive ? (
              <text
                x="740"
                y="156"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="11.5"
                fill="#3E424B"
              >
                Waiting for response stream...
              </text>
            ) : isGet ? (
              <text
                x="740"
                y="152"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="12"
                fill="#4E525A"
                xmlSpace="preserve"
              >
                <tspan x="740" dy="0">&#123;</tspan>
                <tspan
                  x="758"
                  dy="21"
                  fill="#8A8F98"
                  style={{ animation: "jsonLineFade 0.25s ease-out 0.05s both" }}
                >
                  &quot;name&quot;: <tspan fill="#83B69A">&quot;Meridian&quot;</tspan><tspan fill="#4E525A">,</tspan>
                </tspan>
                <tspan
                  x="758"
                  dy="21"
                  fill="#8A8F98"
                  style={{ animation: "jsonLineFade 0.25s ease-out 0.18s both" }}
                >
                  &quot;status&quot;: <tspan fill="#83B69A">&quot;healthy&quot;</tspan>
                </tspan>
                <tspan
                  x="740"
                  dy="21"
                  fill="#4E525A"
                  style={{ animation: "jsonLineFade 0.25s ease-out 0.28s both" }}
                >
                  &#125;
                </tspan>
              </text>
            ) : (
              <text
                x="740"
                y="152"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="12"
                fill="#4E525A"
                xmlSpace="preserve"
              >
                <tspan x="740" dy="0">&#123;</tspan>
                <tspan
                  x="758"
                  dy="21"
                  fill="#8A8F98"
                  style={{ animation: "jsonLineFade 0.25s ease-out 0.05s both" }}
                >
                  &quot;id&quot;: <tspan fill="#F1F0EC">&quot;resource_08&quot;</tspan><tspan fill="#4E525A">,</tspan>
                </tspan>
                <tspan
                  x="758"
                  dy="21"
                  fill="#8A8F98"
                  style={{ animation: "jsonLineFade 0.25s ease-out 0.18s both" }}
                >
                  &quot;created&quot;: <tspan fill="#D88762">true</tspan>
                </tspan>
                <tspan
                  x="740"
                  dy="21"
                  fill="#4E525A"
                  style={{ animation: "jsonLineFade 0.25s ease-out 0.28s both" }}
                >
                  &#125;
                </tspan>
              </text>
            )}

            {/* Destination Intake Flange at Vertex (740, 215) */}
            <circle
              cx="740"
              cy="215"
              r="5.5"
              fill="#121416"
              stroke={isResponseActive ? "#83B69A" : "#45494B"}
              strokeWidth="1.8"
            />
            <circle
              cx="740"
              cy="215"
              r="2.5"
              fill={isResponseActive ? "#83B69A" : "#383B42"}
            />
          </g>
        </svg>
      </div>

      {/* =================================================================
          MOBILE COMPOSITION (< md): Vertical Architectural Sketch
          Zero Slate Backgrounds · Continuous Isometric Technical Pipeline
          viewBox="0 0 360 410"
          ================================================================= */}
      <div className="flex md:hidden w-full h-full items-center justify-center">
        <svg
          className="w-full h-full max-h-[380px] overflow-visible"
          viewBox="0 0 360 410"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
        >
          {/* Top Request Section */}
          <g id="mobile-request-section">
            <text x="24" y="24" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#D88762" letterSpacing="0.12em">
              01 / REQUEST
            </text>
            <text x="24" y="48" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="17" fontWeight="600" fill="#F1F0EC">
              <tspan fill={isGet ? "#83B69A" : "#D88762"}>{isGet ? "GET" : "POST"}</tspan>
              <tspan fill="#F1F0EC" dx="6">{isGet ? "/api/v1/projects" : "/api/v1/resources"}</tspan>
            </text>
            {isGet ? (
              <text x="24" y="68" fontFamily="var(--font-geist-mono), monospace" fontSize="10.5" fill="#777D7D">
                Query project state &amp; deployment status
              </text>
            ) : (
              <text x="24" y="68" fontFamily="var(--font-geist-mono), monospace" fontSize="10.5" fill="#8A8F98">
                &#123; &quot;name&quot;: &quot;Production resource&quot;, &quot;type&quot;: &quot;web&quot; &#125;
              </text>
            )}
            <circle cx="180" cy="85" r="4.5" fill="#121416" stroke="#F1F0EC" strokeWidth="1.6" />
            <circle cx="180" cy="85" r="2" fill="#D88762" />
          </g>

          {/* Top Conduit Line */}
          <path d="M 180,85 C 180,110 180,120 180,140" stroke="#3D4245" strokeWidth="1.2" strokeDasharray="3 3" fill="none" />
          <path d="M 180,85 C 180,110 180,120 180,140" stroke="#D88762" strokeWidth="2" strokeLinecap="round" fill="none" opacity={activePhase === "outgoing" ? 1 : 0.4} />
          {activePhase === "outgoing" && (
            <circle cx="180" cy="115" r="3.5" fill="#D88762" />
          )}

          {/* Mobile Center Isometric Sketch */}
          <g id="mobile-center-isometric" transform="translate(0, 140)">
            <text x="180" y="16" textAnchor="middle" fontFamily="var(--font-geist-mono), monospace" fontSize="9.5" fill="#D88762" letterSpacing="0.1em">
              02 / RUNTIME · JETWAY API
            </text>

            {/* Base Platform */}
            <polygon points="180,30 250,60 180,90 110,60" fill="url(#api-iso-top-vol)" stroke="#F1F0EC" strokeWidth="1.4" strokeLinejoin="round" />
            <polygon points="110,60 180,90 180,105 110,75" fill="url(#api-iso-left-vol)" stroke="#F1F0EC" strokeWidth="1.4" strokeLinejoin="round" />
            <polygon points="180,90 250,60 250,75 180,105" fill="url(#api-iso-right-vol)" stroke="#F1F0EC" strokeWidth="1.4" strokeLinejoin="round" />

            {/* Core Nucleus */}
            <polygon
              points="180,45 205,60 180,75 155,60"
              fill={activePhase === "processing" ? "url(#api-core-glow-active)" : isResponseActive ? "url(#api-core-glow-success)" : "url(#api-core-glow-idle)"}
              stroke={activePhase === "processing" ? "#D88762" : isResponseActive ? "#83B69A" : "#555A64"}
              strokeWidth="1.6"
            />
            <circle cx="180" cy="60" r="2.5" fill={activePhase === "processing" ? "#D88762" : isResponseActive ? "#83B69A" : "#555A64"} />

            {/* Telemetry line */}
            <text x="180" y="122" textAnchor="middle" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill={activePhase === "processing" ? "#D88762" : isResponseActive ? "#83B69A" : "#777D7D"}>
              {activePhase === "processing" ? "● Executing route..." : isResponseActive ? "● 200 OK — Serialized" : "○ Awaiting request"}
            </text>
          </g>

          {/* Bottom Conduit Line */}
          <path d="M 180,270 C 180,290 180,300 180,315" stroke="#3D4245" strokeWidth="1.2" strokeDasharray="3 3" fill="none" />
          <path d="M 180,270 C 180,290 180,300 180,315" stroke="#83B69A" strokeWidth="2" strokeLinecap="round" fill="none" opacity={isResponseActive ? 1 : 0.3} />
          {activePhase === "returning" && (
            <circle cx="180" cy="295" r="3.5" fill="#83B69A" />
          )}

          {/* Bottom Response Section */}
          <g id="mobile-response-section" transform="translate(0, 315)">
            <circle cx="180" cy="0" r="4.5" fill="#121416" stroke={isResponseActive ? "#83B69A" : "#45494B"} strokeWidth="1.6" />
            <circle cx="180" cy="0" r="2" fill={isResponseActive ? "#83B69A" : "#383B42"} />

            <text x="24" y="24" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#83B69A" letterSpacing="0.12em">
              03 / RESPONSE
            </text>
            <text x="24" y="48" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="17" fontWeight="600" fill={isResponseActive ? "#83B69A" : "#555A64"}>
              {isResponseActive ? (isGet ? "200 OK" : "201 Created") : "Awaiting response..."}
            </text>

            {isResponseActive ? (
              isGet ? (
                <text x="24" y="70" fontFamily="var(--font-geist-mono), monospace" fontSize="10.5" fill="#8A8F98">
                  &#123; &quot;name&quot;: &quot;Meridian&quot;, &quot;status&quot;: &quot;healthy&quot; &#125;
                </text>
              ) : (
                <text x="24" y="70" fontFamily="var(--font-geist-mono), monospace" fontSize="10.5" fill="#8A8F98">
                  &#123; &quot;id&quot;: &quot;resource_08&quot;, &quot;created&quot;: true &#125;
                </text>
              )
            ) : (
              <text x="24" y="70" fontFamily="var(--font-geist-mono), monospace" fontSize="10.5" fill="#444852">
                Waiting for execution cycle...
              </text>
            )}
          </g>
        </svg>
      </div>
    </div>
  );
}

export default ApiServicePlayground;
