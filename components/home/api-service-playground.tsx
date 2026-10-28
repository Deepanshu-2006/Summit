"use client";

import React, { useState, useEffect, useRef } from "react";

type RequestType = "GET" | "POST";

type LifecyclePhase =
  | "setup"       // 400ms: Request initiation at client origin
  | "outgoing"    // 900ms: Burnt-orange signal travels through illustrated pathway into API
  | "processing"  // 500ms: Central API structure executes and reorganizes
  | "returning"   // 900ms: Sage-green signal travels through egress pathway to destination
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
      className="w-full h-full flex items-center justify-center overflow-hidden select-none relative py-1"
    >
      <style>{`
        @keyframes signalTravelDesktop {
          0% {
            stroke-dashoffset: 40;
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            stroke-dashoffset: -180;
            opacity: 0;
          }
        }
        @keyframes signalTravelVerticalTop {
          0% {
            stroke-dashoffset: 20;
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            stroke-dashoffset: -40;
            opacity: 0;
          }
        }
        @keyframes signalTravelVerticalBottom {
          0% {
            stroke-dashoffset: 20;
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            stroke-dashoffset: -40;
            opacity: 0;
          }
        }
        @keyframes jsonLineFade {
          from {
            opacity: 0;
            transform: translateY(2px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* =================================================================
          DESKTOP & TABLET: Perfectly Balanced Three-Stage Composition
          Left Card: 260px × 180px (Y=70 to 250)
          Center Illustration: 260px × 180px (Y=70 to 250)
          Right Card: 260px × 180px (Y=70 to 250)
          All ports & conduits precisely aligned along Y = 160
          viewBox="0 0 960 320"
          ================================================================= */}
      <div className="hidden md:flex w-full h-full items-center justify-center">
        <svg
          className="w-full h-full max-h-[380px] overflow-visible"
          viewBox="0 0 960 320"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
        >
          {/* =============================================================
              1. LEFT REQUEST CARD (X: 30 to 290, Y: 70 to 250)
              Matching surface, border, corner radius, and padding as Right Card
              ============================================================= */}
          <g id="request-card">
            {/* Unified Card Surface */}
            <rect
              x="30"
              y="70"
              width="260"
              height="180"
              rx="6"
              fill="#121315"
              stroke="#23252A"
              strokeWidth="1"
            />

            {/* Method & Endpoint Header */}
            <text
              x="54"
              y="106"
              fill={isGet ? "#83B69A" : "#D88762"}
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="13"
              fontWeight="700"
              letterSpacing="0.02em"
            >
              {isGet ? "GET" : "POST"}
            </text>
            <text
              x={isGet ? "92" : "100"}
              y="106"
              fill="#F1F0EC"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="13.5"
              fontWeight="500"
              letterSpacing="-0.01em"
            >
              {isGet ? "/api/v1/projects" : "/api/v1/resources"}
            </text>

            {/* Card Content: Concise Description for GET or Request Payload for POST */}
            {isGet ? (
              <g>
                <text
                  x="54"
                  y="136"
                  fill="#717682"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="11.5"
                >
                  Fetch project state &amp; deployment status
                </text>
                <text
                  x="54"
                  y="160"
                  fill="#454952"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="10.5"
                >
                  Content-Type: application/json
                </text>
              </g>
            ) : (
              <text
                x="54"
                y="134"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="11.5"
                fill="#4E525A"
                xmlSpace="preserve"
              >
                <tspan x="54" dy="0">&#123;</tspan>
                <tspan x="68" dy="19" fill="#8A8F98">&quot;name&quot;: <tspan fill="#D88762">&quot;Production resource&quot;</tspan><tspan fill="#4E525A">,</tspan></tspan>
                <tspan x="68" dy="19" fill="#8A8F98">&quot;type&quot;: <tspan fill="#D88762">&quot;web&quot;</tspan></tspan>
                <tspan x="54" dy="19" fill="#4E525A">&#125;</tspan>
              </text>
            )}

            {/* Left Card Port (Right Edge Anchor: 290, 160) */}
            <circle
              cx="290"
              cy="160"
              r="4"
              fill="#121315"
              stroke={activePhase === "outgoing" ? "#D88762" : "#2E3137"}
              strokeWidth="1.2"
              className="transition-colors duration-300"
            />
            <circle
              cx="290"
              cy="160"
              r="2"
              fill={activePhase === "outgoing" ? "#D88762" : "#383B42"}
              className="transition-colors duration-300"
            />
          </g>

          {/* =============================================================
              CONNECTOR 1: Outgoing Transmission Conduit
              Straight, perfectly aligned connection from (290, 160) to (350, 160)
              ============================================================= */}
          <g id="connector-outgoing">
            <line
              x1="290"
              y1="160"
              x2="350"
              y2="160"
              stroke={activePhase === "outgoing" ? "#3D4046" : "#24262B"}
              strokeWidth="1.5"
              strokeLinecap="round"
              className="transition-colors duration-300"
            />

            {/* Outgoing Burnt-Orange Signal traveling into the illustration */}
            {activePhase === "outgoing" && (
              <path
                d="M 290 160 H 480"
                stroke="#D88762"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="32 160"
                style={{
                  animation: "signalTravelDesktop 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                }}
              />
            )}
          </g>

          {/* =============================================================
              2. CENTER API INFRASTRUCTURE ILLUSTRATION (X: 350 to 610, Y: 70 to 250)
              Detailed, architectural technical network representation
              ============================================================= */}
          <g id="center-api-illustration">
            {/* Technical Registration Corner Ticks */}
            <path d="M 345 70 H 355 M 350 65 V 75" stroke="#33373E" strokeWidth="1" />
            <path d="M 605 70 H 615 M 610 65 V 75" stroke="#33373E" strokeWidth="1" />
            <path d="M 345 250 H 355 M 350 245 V 255" stroke="#33373E" strokeWidth="1" />
            <path d="M 605 250 H 615 M 610 245 V 255" stroke="#33373E" strokeWidth="1" />

            {/* Subtle Chassis Boundary */}
            <rect
              x="350"
              y="70"
              width="260"
              height="180"
              rx="6"
              fill="#101113"
              stroke="#222429"
              strokeWidth="1"
            />

            {/* Top Identity Header */}
            <text
              x="480"
              y="93"
              textAnchor="middle"
              fill="#8E93A0"
              fontFamily="var(--font-space-grotesk), sans-serif"
              fontSize="11.5"
              fontWeight="600"
              letterSpacing="0.06em"
            >
              JETWAY API RUNTIME
            </text>

            {/* Subtle Architectural Grid Axis Lines */}
            <line x1="365" y1="104" x2="595" y2="104" stroke="#1A1C20" strokeWidth="1" />
            <line x1="365" y1="216" x2="595" y2="216" stroke="#1A1C20" strokeWidth="1" />

            {/* --- Upper Parallel Bus Track (Y = 118) --- */}
            <path
              d="M 396 160 H 408 L 426 118 H 534 L 552 160 H 564"
              stroke={
                activePhase === "processing"
                  ? "#D88762"
                  : isResponseActive
                  ? "#83B69A"
                  : "#23262C"
              }
              strokeWidth="1.2"
              fill="none"
              strokeLinejoin="round"
              className="transition-colors duration-300"
            />
            {/* Secondary Nodes on Upper Track */}
            <circle cx="426" cy="118" r="2" fill="#383C44" />
            <circle cx="480" cy="118" r="2.5" fill={activePhase === "processing" ? "#D88762" : "#383C44"} className="transition-colors duration-300" />
            <circle cx="534" cy="118" r="2" fill="#383C44" />

            {/* --- Lower Parallel Bus Track (Y = 202) --- */}
            <path
              d="M 396 160 H 408 L 426 202 H 534 L 552 160 H 564"
              stroke={
                activePhase === "processing"
                  ? "#D88762"
                  : isResponseActive
                  ? "#83B69A"
                  : "#23262C"
              }
              strokeWidth="1.2"
              fill="none"
              strokeLinejoin="round"
              className="transition-colors duration-300"
            />
            {/* Secondary Nodes on Lower Track */}
            <circle cx="426" cy="202" r="2" fill="#383C44" />
            <circle cx="480" cy="202" r="2.5" fill={activePhase === "processing" ? "#D88762" : "#383C44"} className="transition-colors duration-300" />
            <circle cx="534" cy="202" r="2" fill="#383C44" />

            {/* --- Ingress Port (350, 160) & Distribution Junction --- */}
            <line x1="350" y1="160" x2="396" y2="160" stroke="#2E323A" strokeWidth="1.5" />
            <circle cx="396" cy="160" r="3" fill="#1A1C20" stroke="#3D414B" strokeWidth="1" />

            {/* Central Direct Pathway into Core */}
            <line
              x1="396"
              y1="160"
              x2="454"
              y2="160"
              stroke={activePhase === "outgoing" || activePhase === "processing" ? "#D88762" : "#262930"}
              strokeWidth="1.5"
              className="transition-colors duration-300"
            />

            {/* --- Vertical Interconnect Traces --- */}
            <line x1="480" y1="118" x2="480" y2="134" stroke="#282B33" strokeWidth="1" />
            <line x1="480" y1="186" x2="480" y2="202" stroke="#282B33" strokeWidth="1" />

            {/* --- THE CENTRAL PROCESSING CORE (Prominent 52px Octagon + Execution Matrix) --- */}
            <g id="central-core">
              {/* Outer Architectural Octagon */}
              <polygon
                points="460,134 500,134 506,140 506,180 500,186 460,186 454,180 454,140"
                fill="#131417"
                stroke={
                  activePhase === "processing"
                    ? "#D88762"
                    : isResponseActive
                    ? "#83B69A"
                    : "#2B2E35"
                }
                strokeWidth={activePhase === "processing" || isResponseActive ? "1.8" : "1.2"}
                className="transition-colors duration-300"
              />

              {/* Precision Technical Crosshair Ticks */}
              <line x1="466" y1="160" x2="494" y2="160" stroke="#3A3E47" strokeWidth="1" />
              <line x1="480" y1="146" x2="480" y2="174" stroke="#3A3E47" strokeWidth="1" />

              {/* Central Geometric Execution Cell (Rotates smoothly during processing) */}
              <rect
                x="472"
                y="152"
                width="16"
                height="16"
                rx="2"
                fill={
                  activePhase === "processing"
                    ? "#D88762"
                    : isResponseActive
                    ? "#83B69A"
                    : "#1C1E23"
                }
                stroke={
                  activePhase === "processing"
                    ? "#D88762"
                    : isResponseActive
                    ? "#83B69A"
                    : "#3D414B"
                }
                strokeWidth="1.5"
                transform={
                  activePhase === "processing"
                    ? "rotate(90 480 160)"
                    : isResponseActive
                    ? "rotate(45 480 160)"
                    : "rotate(45 480 160)"
                }
                className="transition-all duration-300"
              />
            </g>

            {/* Central Direct Pathway out of Core */}
            <line
              x1="506"
              y1="160"
              x2="564"
              y2="160"
              stroke={isResponseActive ? "#83B69A" : "#262930"}
              strokeWidth="1.5"
              className="transition-colors duration-300"
            />

            {/* --- Egress Convergence Junction & Egress Port (610, 160) --- */}
            <circle cx="564" cy="160" r="3" fill="#1A1C20" stroke="#3D414B" strokeWidth="1" />
            <line x1="564" y1="160" x2="610" y2="160" stroke="#2E323A" strokeWidth="1.5" />

            {/* Bottom Dynamic Processing Status */}
            <g id="central-status">
              {activePhase === "setup" || activePhase === "outgoing" ? (
                <text
                  x="480"
                  y="235"
                  textAnchor="middle"
                  fill="#636875"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="11"
                >
                  Awaiting request
                </text>
              ) : activePhase === "processing" ? (
                <g>
                  <circle cx="414" cy="231" r="2.5" fill="#D88762" />
                  <text
                    x="480"
                    y="235"
                    textAnchor="middle"
                    fill="#D88762"
                    fontFamily="var(--font-geist-mono), monospace"
                    fontSize="11"
                    fontWeight="600"
                  >
                    {isGet ? "Resolving project..." : "Allocating resource..."}
                  </text>
                </g>
              ) : (
                <g>
                  <circle cx="414" cy="231" r="2.5" fill="#83B69A" />
                  <text
                    x="480"
                    y="235"
                    textAnchor="middle"
                    fill="#83B69A"
                    fontFamily="var(--font-geist-mono), monospace"
                    fontSize="11"
                    fontWeight="600"
                  >
                    {isGet ? "200 OK — Resolved" : "201 Created — Allocated"}
                  </text>
                </g>
              )}
            </g>
          </g>

          {/* =============================================================
              CONNECTOR 2: Returning Transmission Conduit
              Straight, perfectly aligned connection from (610, 160) to (670, 160)
              ============================================================= */}
          <g id="connector-returning">
            <line
              x1="610"
              y1="160"
              x2="670"
              y2="160"
              stroke={activePhase === "returning" ? "#3D4046" : "#24262B"}
              strokeWidth="1.5"
              strokeLinecap="round"
              className="transition-colors duration-300"
            />

            {/* Returning Sage-Green Signal traveling into the response card */}
            {activePhase === "returning" && (
              <path
                d="M 480 160 H 670"
                stroke="#83B69A"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="32 160"
                style={{
                  animation: "signalTravelDesktop 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                }}
              />
            )}
          </g>

          {/* =============================================================
              3. RIGHT RESPONSE CARD (X: 670 to 930, Y: 70 to 250)
              Matching surface, border, corner radius, and padding as Left Card
              ============================================================= */}
          <g id="response-card">
            {/* Unified Card Surface */}
            <rect
              x="670"
              y="70"
              width="260"
              height="180"
              rx="6"
              fill="#121315"
              stroke="#23252A"
              strokeWidth="1"
            />

            {/* Right Card Port (Left Edge Anchor: 670, 160) */}
            <circle
              cx="670"
              cy="160"
              r="4"
              fill="#121315"
              stroke={isResponseActive ? "#83B69A" : "#2E3137"}
              strokeWidth="1.2"
              className="transition-colors duration-300"
            />
            <circle
              cx="670"
              cy="160"
              r="2"
              fill={isResponseActive ? "#83B69A" : "#383B42"}
              className="transition-colors duration-300"
            />

            {/* Response Status Header */}
            {isResponseActive ? (
              <g>
                <circle cx="698" cy="102" r="3" fill="#83B69A" />
                <text
                  x="710"
                  y="106"
                  fill="#83B69A"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="13.5"
                  fontWeight="600"
                  letterSpacing="-0.01em"
                >
                  {isGet ? "200 OK" : "201 Created"}
                </text>
              </g>
            ) : (
              <text
                x="694"
                y="106"
                fill="#555A64"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="12.5"
                letterSpacing="-0.01em"
              >
                Response destination
              </text>
            )}

            {/* Card Content: Formatted JSON Response */}
            {!isResponseActive ? (
              <text
                x="694"
                y="142"
                fill="#444852"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="11.5"
              >
                Awaiting response...
              </text>
            ) : isGet ? (
              <text
                x="694"
                y="134"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="11.5"
                fill="#4E525A"
                xmlSpace="preserve"
              >
                <tspan x="694" dy="0">&#123;</tspan>
                <tspan
                  x="708"
                  dy="19"
                  fill="#8A8F98"
                  style={{ animation: "jsonLineFade 0.25s ease-out 0.05s both" }}
                >
                  &quot;name&quot;: <tspan fill="#83B69A">&quot;Meridian&quot;</tspan><tspan fill="#4E525A">,</tspan>
                </tspan>
                <tspan
                  x="708"
                  dy="19"
                  fill="#8A8F98"
                  style={{ animation: "jsonLineFade 0.25s ease-out 0.18s both" }}
                >
                  &quot;status&quot;: <tspan fill="#83B69A">&quot;healthy&quot;</tspan>
                </tspan>
                <tspan
                  x="694"
                  dy="19"
                  fill="#4E525A"
                  style={{ animation: "jsonLineFade 0.25s ease-out 0.28s both" }}
                >
                  &#125;
                </tspan>
              </text>
            ) : (
              <text
                x="694"
                y="134"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="11.5"
                fill="#4E525A"
                xmlSpace="preserve"
              >
                <tspan x="694" dy="0">&#123;</tspan>
                <tspan
                  x="708"
                  dy="19"
                  fill="#8A8F98"
                  style={{ animation: "jsonLineFade 0.25s ease-out 0.05s both" }}
                >
                  &quot;id&quot;: <tspan fill="#F1F0EC">&quot;resource_08&quot;</tspan><tspan fill="#4E525A">,</tspan>
                </tspan>
                <tspan
                  x="708"
                  dy="19"
                  fill="#8A8F98"
                  style={{ animation: "jsonLineFade 0.25s ease-out 0.18s both" }}
                >
                  &quot;created&quot;: <tspan fill="#D88762">true</tspan>
                </tspan>
                <tspan
                  x="694"
                  dy="19"
                  fill="#4E525A"
                  style={{ animation: "jsonLineFade 0.25s ease-out 0.28s both" }}
                >
                  &#125;
                </tspan>
              </text>
            )}
          </g>
        </svg>
      </div>

      {/* =================================================================
          MOBILE COMPOSITION (< md): Coordinated Vertical Architecture
          Matching card styles on top and bottom, substantial center illustration
          viewBox="0 0 340 390"
          ================================================================= */}
      <div className="flex md:hidden w-full h-full items-center justify-center">
        <svg
          className="w-full h-full max-h-[380px] overflow-visible"
          viewBox="0 0 340 390"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
        >
          {/* Top Request Card */}
          <g id="mobile-request-card">
            <rect
              x="20"
              y="15"
              width="300"
              height="95"
              rx="6"
              fill="#121315"
              stroke="#23252A"
              strokeWidth="1"
            />
            <text
              x="36"
              y="44"
              fill={isGet ? "#83B69A" : "#D88762"}
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="12.5"
              fontWeight="700"
            >
              {isGet ? "GET" : "POST"}
            </text>
            <text
              x={isGet ? "70" : "78"}
              y="44"
              fill="#F1F0EC"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="12.5"
              fontWeight="500"
            >
              {isGet ? "/api/v1/projects" : "/api/v1/resources"}
            </text>

            {isGet ? (
              <text
                x="36"
                y="70"
                fill="#717682"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="10.5"
              >
                Fetch project state &amp; deployment status
              </text>
            ) : (
              <text
                x="36"
                y="70"
                fill="#8A8F98"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="10.5"
              >
                &#123; name: &quot;Production resource&quot;, type: &quot;web&quot; &#125;
              </text>
            )}
          </g>

          {/* Top Connector */}
          <line
            x1="170"
            y1="110"
            x2="170"
            y2="140"
            stroke={activePhase === "outgoing" ? "#3D4046" : "#24262B"}
            strokeWidth="1.5"
          />
          {activePhase === "outgoing" && (
            <line
              x1="170"
              y1="110"
              x2="170"
              y2="140"
              stroke="#D88762"
              strokeWidth="2.5"
              strokeDasharray="16 40"
              style={{
                animation: "signalTravelVerticalTop 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
              }}
            />
          )}

          {/* Center Mobile Illustration */}
          <g id="mobile-center-illustration" transform="translate(0, 140)">
            <rect
              x="20"
              y="0"
              width="300"
              height="110"
              rx="6"
              fill="#101113"
              stroke="#222429"
              strokeWidth="1"
            />
            <text
              x="170"
              y="24"
              textAnchor="middle"
              fill="#8E93A0"
              fontFamily="var(--font-space-grotesk), sans-serif"
              fontSize="10.5"
              fontWeight="600"
              letterSpacing="0.06em"
            >
              JETWAY API RUNTIME
            </text>

            {/* Core Octagon */}
            <polygon
              points="155,42 185,42 190,47 190,73 185,78 155,78 150,73 150,47"
              fill="#131417"
              stroke={
                activePhase === "processing"
                  ? "#D88762"
                  : isResponseActive
                  ? "#83B69A"
                  : "#2B2E35"
              }
              strokeWidth="1.2"
              className="transition-colors duration-300"
            />

            {/* Core Cell */}
            <circle
              cx="170"
              cy="60"
              r="6"
              fill={
                activePhase === "processing"
                  ? "#D88762"
                  : isResponseActive
                  ? "#83B69A"
                  : "#1C1E23"
              }
              className="transition-colors duration-300"
            />

            {/* Status Line */}
            <text
              x="170"
              y="97"
              textAnchor="middle"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="10"
            >
              {activePhase === "setup" || activePhase === "outgoing" ? (
                <tspan fill="#636874">Awaiting request</tspan>
              ) : activePhase === "processing" ? (
                <tspan fill="#D88762" fontWeight="600">Processing...</tspan>
              ) : (
                <tspan fill="#83B69A" fontWeight="600">{isGet ? "200 OK — Ready" : "201 Created — Ready"}</tspan>
              )}
            </text>
          </g>

          {/* Bottom Connector */}
          <line
            x1="170"
            y1="250"
            x2="170"
            y2="280"
            stroke={activePhase === "returning" ? "#3D4046" : "#24262B"}
            strokeWidth="1.5"
          />
          {activePhase === "returning" && (
            <line
              x1="170"
              y1="250"
              x2="170"
              y2="280"
              stroke="#83B69A"
              strokeWidth="2.5"
              strokeDasharray="16 40"
              style={{
                animation: "signalTravelVerticalBottom 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
              }}
            />
          )}

          {/* Bottom Response Card */}
          <g id="mobile-response-card" transform="translate(0, 280)">
            <rect
              x="20"
              y="0"
              width="300"
              height="95"
              rx="6"
              fill="#121315"
              stroke="#23252A"
              strokeWidth="1"
            />

            {isResponseActive ? (
              <g>
                <circle cx="36" cy="24" r="2.5" fill="#83B69A" />
                <text
                  x="46"
                  y="28"
                  fill="#83B69A"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="12"
                  fontWeight="600"
                >
                  {isGet ? "200 OK" : "201 Created"}
                </text>
              </g>
            ) : (
              <text
                x="36"
                y="28"
                fill="#555A64"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="11.5"
              >
                Response destination
              </text>
            )}

            {isResponseActive ? (
              isGet ? (
                <text
                  x="36"
                  y="56"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="10.5"
                  fill="#8A8F98"
                >
                  &#123; &quot;name&quot;: &quot;Meridian&quot;, &quot;status&quot;: &quot;healthy&quot; &#125;
                </text>
              ) : (
                <text
                  x="36"
                  y="56"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="10.5"
                  fill="#8A8F98"
                >
                  &#123; &quot;id&quot;: &quot;resource_08&quot;, &quot;created&quot;: true &#125;
                </text>
              )
            ) : (
              <text
                x="36"
                y="56"
                fill="#444852"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="10.5"
              >
                Waiting for response stream...
              </text>
            )}
          </g>
        </svg>
      </div>
    </div>
  );
}

export default ApiServicePlayground;
