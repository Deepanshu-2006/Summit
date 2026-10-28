"use client";

import React, { useState, useEffect, useRef } from "react";

type RequestType = "GET" | "POST";

type LifecyclePhase =
  | "setup"       // 400ms: Request initiation at client origin window
  | "outgoing"    // 900ms: Burnt-orange signal travels through illustrated pathway to API
  | "processing"  // 500ms: Central API structure reorganizes and executes
  | "returning"   // 900ms: Sage-green signal travels along egress pathway to destination
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
      className="w-full h-full flex items-center justify-center overflow-hidden select-none relative py-1 sm:py-2"
    >
      <style>{`
        @keyframes outgoingSignalDesktop {
          0% {
            stroke-dashoffset: 40;
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          88% {
            opacity: 1;
          }
          100% {
            stroke-dashoffset: -170;
            opacity: 0;
          }
        }
        @keyframes returningSignalDesktop {
          0% {
            stroke-dashoffset: 40;
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          88% {
            opacity: 1;
          }
          100% {
            stroke-dashoffset: -170;
            opacity: 0;
          }
        }
        @keyframes signalTravelVerticalTop {
          0% {
            stroke-dashoffset: 30;
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            stroke-dashoffset: -70;
            opacity: 0;
          }
        }
        @keyframes signalTravelVerticalBottom {
          0% {
            stroke-dashoffset: 30;
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            stroke-dashoffset: -70;
            opacity: 0;
          }
        }
        @keyframes jsonFadeIn {
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
          DESKTOP & TABLET: The Complete Infrastructure Illustration
          A cohesive, balanced horizontal composition spanning the preview area
          viewBox="0 0 960 340"
          ================================================================= */}
      <div className="hidden md:flex w-full h-full items-center justify-center">
        <svg
          className="w-full h-full max-h-[380px] overflow-visible"
          viewBox="0 0 960 340"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
        >
          {/* =============================================================
              1. REQUEST ORIGIN: Client Application Window Glyph
              Understated terminal/window outline, HTTP method & endpoint
              ============================================================= */}
          <g id="request-origin-window">
            {/* Outer Window Chassis */}
            <rect
              x="30"
              y="60"
              width="240"
              height="215"
              rx="7"
              fill="#131416"
              stroke="#24262B"
              strokeWidth="1.2"
            />

            {/* Window Header Line */}
            <line x1="30" y1="92" x2="270" y2="92" stroke="#1F2126" strokeWidth="1" />

            {/* Application Window Glyph Dots */}
            <circle cx="48" cy="76" r="3" fill="#383B42" />
            <circle cx="60" cy="76" r="3" fill="#383B42" />
            <circle cx="72" cy="76" r="3" fill="#383B42" />

            {/* Application Window Title */}
            <text
              x="90"
              y="79.5"
              fill="#6A6F7C"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="10"
              letterSpacing="0.08em"
              fontWeight="500"
            >
              CLIENT ORIGIN
            </text>

            {/* Client Status Indicator */}
            <circle
              cx="250"
              cy="76"
              r="2.5"
              fill={activePhase === "outgoing" ? "#D88762" : "#383B42"}
              className="transition-colors duration-300"
            />

            {/* Active Request Method & Endpoint */}
            {isGet ? (
              <g>
                <text
                  x="48"
                  y="132"
                  fill="#83B69A"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="13.5"
                  fontWeight="700"
                  letterSpacing="0.02em"
                >
                  GET
                </text>
                <text
                  x="88"
                  y="132"
                  fill="#F1F0EC"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="14"
                  fontWeight="500"
                  letterSpacing="-0.01em"
                >
                  /api/v1/projects
                </text>
                <text
                  x="48"
                  y="162"
                  fill="#6B707C"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="11"
                  letterSpacing="-0.01em"
                >
                  Fetch project state &amp; deployment status
                </text>
              </g>
            ) : (
              <g>
                <text
                  x="48"
                  y="124"
                  fill="#D88762"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="13.5"
                  fontWeight="700"
                  letterSpacing="0.02em"
                >
                  POST
                </text>
                <text
                  x="96"
                  y="124"
                  fill="#F1F0EC"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="14"
                  fontWeight="500"
                  letterSpacing="-0.01em"
                >
                  /api/v1/resources
                </text>

                {/* POST Request Payload */}
                <text
                  x="48"
                  y="152"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="11.5"
                  fill="#4A4E57"
                  xmlSpace="preserve"
                >
                  <tspan x="48" dy="0">&#123;</tspan>
                  <tspan x="62" dy="20" fill="#8A8F98">&quot;name&quot;: <tspan fill="#D88762">&quot;Production resource&quot;</tspan><tspan fill="#4A4E57">,</tspan></tspan>
                  <tspan x="62" dy="20" fill="#8A8F98">&quot;type&quot;: <tspan fill="#D88762">&quot;web&quot;</tspan></tspan>
                  <tspan x="48" dy="20" fill="#4A4E57">&#125;</tspan>
                </text>
              </g>
            )}

            {/* Output Port Connector on Right Edge */}
            <rect x="268" y="159" width="4" height="12" rx="1" fill="#25272C" />
            <circle
              cx="270"
              cy="165"
              r="5"
              fill="none"
              stroke={activePhase === "outgoing" ? "#D88762" : "#383B42"}
              strokeWidth="1"
              opacity="0.6"
              className="transition-colors duration-300"
            />
            <circle
              cx="270"
              cy="165"
              r="2.5"
              fill={activePhase === "outgoing" ? "#D88762" : "#383B42"}
              className="transition-colors duration-300"
            />
          </g>

          {/* =============================================================
              CONNECTOR 1: Outgoing Illustrated Pathway
              From Client Window (270, 165) → API Gateway Ingress (390, 190)
              ============================================================= */}
          <g id="pathway-outgoing">
            {/* Base Neutral Conduit */}
            <path
              d="M 270 165 H 330 L 355 190 H 390"
              stroke={activePhase === "outgoing" ? "#3D4046" : "#26292E"}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-colors duration-300"
            />

            {/* Micro Conduit Tick */}
            <circle cx="330" cy="165" r="1.5" fill="#3D4046" />

            {/* Traveling Burnt-Orange Signal */}
            {activePhase === "outgoing" && (
              <path
                d="M 270 165 H 330 L 355 190 H 390"
                stroke="#D88762"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="36 200"
                style={{
                  animation: "outgoingSignalDesktop 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                }}
              />
            )}
          </g>

          {/* =============================================================
              2. API INFRASTRUCTURE: Distinctive Engineered Architecture
              One clear central processing point with reorganizing gates
              ============================================================= */}
          <g id="api-infrastructure" transform="translate(0, 0)">
            {/* Precision Technical Registration Corners */}
            <path d="M 380 60 H 390 M 385 55 V 65" stroke="#33373E" strokeWidth="1" />
            <path d="M 570 60 H 580 M 575 55 V 65" stroke="#33373E" strokeWidth="1" />
            <path d="M 380 275 H 390 M 385 270 V 280" stroke="#33373E" strokeWidth="1" />
            <path d="M 570 275 H 580 M 575 270 V 280" stroke="#33373E" strokeWidth="1" />

            {/* Infrastructure Bounding Guide Frame */}
            <rect
              x="385"
              y="60"
              width="190"
              height="215"
              rx="6"
              fill="#101113"
              stroke="#222429"
              strokeWidth="1"
            />

            {/* Header Identity */}
            <text
              x="480"
              y="82"
              textAnchor="middle"
              fill="#7A808D"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="10"
              letterSpacing="0.14em"
              fontWeight="600"
            >
              JETWAY API RUNTIME
            </text>

            {/* Upper Architectural Bus Track */}
            <line x1="405" y1="108" x2="555" y2="108" stroke="#1F2126" strokeWidth="1" />
            <circle cx="430" cy="108" r="1.5" fill="#3D4046" />
            <circle cx="530" cy="108" r="1.5" fill="#3D4046" />

            {/* Lower Architectural Bus Track */}
            <line x1="405" y1="228" x2="555" y2="228" stroke="#1F2126" strokeWidth="1" />
            <circle cx="430" cy="228" r="1.5" fill="#3D4046" />
            <circle cx="530" cy="228" r="1.5" fill="#3D4046" />

            {/* Ingress Gateway Stub on Left (Y = 190) */}
            <line x1="385" y1="190" x2="415" y2="190" stroke="#2B2E33" strokeWidth="1.5" />
            <circle cx="415" cy="190" r="2" fill="#3D4046" />

            {/* Internal Ingress Channel (Chamfers up to Central Core at Y = 168) */}
            <path
              d="M 415 190 H 430 L 442 168 H 455"
              stroke={activePhase === "processing" ? "#D88762" : "#24272D"}
              strokeWidth="1.2"
              fill="none"
              strokeLinejoin="round"
              className="transition-colors duration-300"
            />

            {/* Reorganizing Processing Gates (Sliding Brackets) */}
            {/* Left Gate Bracket */}
            <path
              d="M 448 144 H 462 V 192 H 448"
              stroke={
                activePhase === "processing"
                  ? "#D88762"
                  : isResponseActive
                  ? "#83B69A"
                  : "#2E3238"
              }
              strokeWidth={activePhase === "processing" || isResponseActive ? "1.8" : "1.2"}
              fill="none"
              strokeLinejoin="round"
              className="transition-all duration-300"
              transform={
                activePhase === "processing"
                  ? "translate(5, 0)"
                  : isResponseActive
                  ? "translate(3, 0)"
                  : "translate(0, 0)"
              }
            />

            {/* Right Gate Bracket */}
            <path
              d="M 512 144 H 498 V 192 H 512"
              stroke={
                activePhase === "processing"
                  ? "#D88762"
                  : isResponseActive
                  ? "#83B69A"
                  : "#2E3238"
              }
              strokeWidth={activePhase === "processing" || isResponseActive ? "1.8" : "1.2"}
              fill="none"
              strokeLinejoin="round"
              className="transition-all duration-300"
              transform={
                activePhase === "processing"
                  ? "translate(-5, 0)"
                  : isResponseActive
                  ? "translate(-3, 0)"
                  : "translate(0, 0)"
              }
            />

            {/* Central Execution Core (Precision Hex/Diamond Matrix) */}
            <g id="central-execution-core" transform="translate(480, 168)">
              {/* Outer Matrix Frame */}
              <rect
                x="-18"
                y="-18"
                width="36"
                height="36"
                rx="4"
                fill="#141518"
                stroke={
                  activePhase === "processing"
                    ? "#D88762"
                    : isResponseActive
                    ? "#83B69A"
                    : "#2B2E33"
                }
                strokeWidth="1.2"
                className="transition-colors duration-300"
              />

              {/* Crosshair Registration Ticks */}
              <line x1="-10" y1="0" x2="10" y2="0" stroke="#383C44" strokeWidth="1" />
              <line x1="0" y1="-10" x2="0" y2="10" stroke="#383C44" strokeWidth="1" />

              {/* Core Execution Cell */}
              <rect
                x="-7"
                y="-7"
                width="14"
                height="14"
                rx="2"
                fill={
                  activePhase === "processing"
                    ? "#D88762"
                    : isResponseActive
                    ? "#83B69A"
                    : "#1C1E22"
                }
                stroke={
                  activePhase === "processing"
                    ? "#D88762"
                    : isResponseActive
                    ? "#83B69A"
                    : "#3E424B"
                }
                strokeWidth="1.5"
                transform={activePhase === "processing" ? "rotate(45)" : "rotate(0)"}
                className="transition-all duration-300"
              />
            </g>

            {/* Internal Egress Channel (From Core at Y = 168 to Egress at Y = 150) */}
            <path
              d="M 505 168 H 518 L 530 150 H 545"
              stroke={isResponseActive ? "#83B69A" : "#24272D"}
              strokeWidth="1.2"
              fill="none"
              strokeLinejoin="round"
              className="transition-colors duration-300"
            />

            {/* Egress Gateway Stub on Right (Y = 150) */}
            <circle cx="545" cy="150" r="2" fill="#3D4046" />
            <line x1="545" y1="150" x2="575" y2="150" stroke="#2B2E33" strokeWidth="1.5" />

            {/* Dynamic Processing Status Indicator */}
            <g id="processing-status-label">
              {activePhase === "setup" || activePhase === "outgoing" ? (
                <text
                  x="480"
                  y="256"
                  textAnchor="middle"
                  fill="#636874"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="11.5"
                >
                  Awaiting request
                </text>
              ) : activePhase === "processing" ? (
                <g>
                  <circle cx="418" cy="252" r="2" fill="#D88762" />
                  <text
                    x="480"
                    y="256"
                    textAnchor="middle"
                    fill="#D88762"
                    fontFamily="var(--font-geist-mono), monospace"
                    fontSize="11.5"
                    fontWeight="600"
                  >
                    {isGet ? "Resolving project..." : "Allocating resource..."}
                  </text>
                </g>
              ) : (
                <g>
                  <circle cx="410" cy="252" r="2.5" fill="#83B69A" />
                  <text
                    x="480"
                    y="256"
                    textAnchor="middle"
                    fill="#83B69A"
                    fontFamily="var(--font-geist-mono), monospace"
                    fontSize="11.5"
                    fontWeight="600"
                  >
                    {isGet ? "200 OK — Resolved" : "201 Created — Allocated"}
                  </text>
                </g>
              )}
            </g>
          </g>

          {/* =============================================================
              CONNECTOR 2: Returning Illustrated Pathway
              From API Gateway Egress (575, 150) → Response Destination (690, 175)
              ============================================================= */}
          <g id="pathway-returning">
            {/* Base Neutral Conduit */}
            <path
              d="M 575 150 H 615 L 640 175 H 690"
              stroke={activePhase === "returning" ? "#3D4046" : "#26292E"}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-colors duration-300"
            />

            {/* Micro Conduit Tick */}
            <circle cx="615" cy="150" r="1.5" fill="#3D4046" />

            {/* Traveling Sage-Green Signal */}
            {activePhase === "returning" && (
              <path
                d="M 575 150 H 615 L 640 175 H 690"
                stroke="#83B69A"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="36 200"
                style={{
                  animation: "returningSignalDesktop 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                }}
              />
            )}
          </g>

          {/* =============================================================
              3. RESPONSE DESTINATION: Clean Typographic Emergence
              Real JSON revealed line by line connected directly to egress conduit
              ============================================================= */}
          <g id="response-destination">
            {/* Destination Receiver Port */}
            <rect x="688" y="169" width="4" height="12" rx="1" fill="#25272C" />
            <circle
              cx="690"
              cy="175"
              r="5"
              fill="none"
              stroke={isResponseActive ? "#83B69A" : "#383B42"}
              strokeWidth="1"
              opacity="0.6"
              className="transition-colors duration-300"
            />
            <circle
              cx="690"
              cy="175"
              r="2.5"
              fill={isResponseActive ? "#83B69A" : "#383B42"}
              className="transition-colors duration-300"
            />

            {/* Vertical Alignment Datum Trace */}
            <line
              x1="706"
              y1="96"
              x2="706"
              y2="245"
              stroke="#1C1E22"
              strokeWidth="1"
              strokeDasharray="3 3"
            />

            {/* Response Status Header */}
            {isResponseActive ? (
              <g>
                <circle cx="724" cy="76" r="3" fill="#83B69A" />
                <text
                  x="736"
                  y="80"
                  fill="#83B69A"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="14.5"
                  fontWeight="600"
                  letterSpacing="-0.01em"
                >
                  {isGet ? "200 OK" : "201 Created"}
                </text>
              </g>
            ) : (
              <text
                x="720"
                y="80"
                fill="#4E535E"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="12.5"
                letterSpacing="-0.01em"
              >
                Response destination
              </text>
            )}

            {/* Progressive JSON Content */}
            {!isResponseActive ? (
              <text
                x="720"
                y="135"
                fill="#3E424B"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="11.5"
              >
                Waiting for request stream...
              </text>
            ) : isGet ? (
              <text
                x="720"
                y="126"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="12.5"
                fill="#4A4E57"
                xmlSpace="preserve"
              >
                <tspan x="720" dy="0">&#123;</tspan>
                <tspan
                  x="736"
                  dy="22"
                  fill="#8A8F98"
                  style={{ animation: "jsonFadeIn 0.25s ease-out 0.05s both" }}
                >
                  &quot;name&quot;: <tspan fill="#83B69A">&quot;Meridian&quot;</tspan><tspan fill="#4A4E57">,</tspan>
                </tspan>
                <tspan
                  x="736"
                  dy="22"
                  fill="#8A8F98"
                  style={{ animation: "jsonFadeIn 0.25s ease-out 0.18s both" }}
                >
                  &quot;status&quot;: <tspan fill="#83B69A">&quot;healthy&quot;</tspan>
                </tspan>
                <tspan
                  x="720"
                  dy="22"
                  fill="#4A4E57"
                  style={{ animation: "jsonFadeIn 0.25s ease-out 0.28s both" }}
                >
                  &#125;
                </tspan>
              </text>
            ) : (
              <text
                x="720"
                y="126"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="12.5"
                fill="#4A4E57"
                xmlSpace="preserve"
              >
                <tspan x="720" dy="0">&#123;</tspan>
                <tspan
                  x="736"
                  dy="22"
                  fill="#8A8F98"
                  style={{ animation: "jsonFadeIn 0.25s ease-out 0.05s both" }}
                >
                  &quot;id&quot;: <tspan fill="#F1F0EC">&quot;resource_08&quot;</tspan><tspan fill="#4A4E57">,</tspan>
                </tspan>
                <tspan
                  x="736"
                  dy="22"
                  fill="#8A8F98"
                  style={{ animation: "jsonFadeIn 0.25s ease-out 0.18s both" }}
                >
                  &quot;created&quot;: <tspan fill="#D88762">true</tspan>
                </tspan>
                <tspan
                  x="720"
                  dy="22"
                  fill="#4A4E57"
                  style={{ animation: "jsonFadeIn 0.25s ease-out 0.28s both" }}
                >
                  &#125;
                </tspan>
              </text>
            )}
          </g>
        </svg>
      </div>

      {/* =================================================================
          MOBILE COMPOSITION (< md): Optimized Vertical Technical Circuit
          Preserves generous typography and identical 3-region lifecycle
          viewBox="0 0 340 400"
          ================================================================= */}
      <div className="flex md:hidden w-full h-full items-center justify-center">
        <svg
          className="w-full h-full max-h-[380px] overflow-visible"
          viewBox="0 0 340 400"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
        >
          {/* 1. Mobile Request Origin Window */}
          <g id="mobile-request-origin">
            <rect
              x="20"
              y="15"
              width="300"
              height={isGet ? "95" : "120"}
              rx="6"
              fill="#131416"
              stroke="#24262B"
              strokeWidth="1.2"
            />
            <line x1="20" y1="42" x2="320" y2="42" stroke="#1F2126" strokeWidth="1" />
            <circle cx="36" cy="28" r="2.5" fill="#383B42" />
            <circle cx="46" cy="28" r="2.5" fill="#383B42" />
            <circle cx="56" cy="28" r="2.5" fill="#383B42" />
            <text
              x="70"
              y="31"
              fill="#6A6F7C"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="9.5"
              letterSpacing="0.08em"
            >
              CLIENT ORIGIN
            </text>

            {/* Method & Endpoint */}
            <text
              x="36"
              y="68"
              fill={isGet ? "#83B69A" : "#D88762"}
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="12.5"
              fontWeight="700"
            >
              {isGet ? "GET" : "POST"}
            </text>
            <text
              x={isGet ? "70" : "78"}
              y="68"
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
                y="90"
                fill="#6B707C"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="10"
              >
                Fetch project state &amp; deployment status
              </text>
            ) : (
              <text
                x="36"
                y="88"
                fill="#8A8F98"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="10"
              >
                payload: &#123; name: &quot;Production resource&quot;, type: &quot;web&quot; &#125;
              </text>
            )}
          </g>

          {/* Vertical Conduit 1: Window to API Gateway */}
          <g id="mobile-conduit-top">
            <line
              x1="170"
              y1={isGet ? 110 : 135}
              x2="170"
              y2="175"
              stroke={activePhase === "outgoing" ? "#3D4046" : "#24262B"}
              strokeWidth="1.5"
            />
            {activePhase === "outgoing" && (
              <line
                x1="170"
                y1={isGet ? 110 : 135}
                x2="170"
                y2="175"
                stroke="#D88762"
                strokeWidth="2.5"
                strokeDasharray="20 60"
                style={{
                  animation: "signalTravelVerticalTop 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                }}
              />
            )}
          </g>

          {/* 2. Mobile Central API Gateway */}
          <g id="mobile-api-gateway" transform="translate(0, 175)">
            <rect
              x="50"
              y="0"
              width="240"
              height="80"
              rx="6"
              fill="#101113"
              stroke="#222429"
              strokeWidth="1"
            />
            <text
              x="170"
              y="22"
              textAnchor="middle"
              fill="#7A808D"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="9.5"
              letterSpacing="0.12em"
              fontWeight="600"
            >
              JETWAY API RUNTIME
            </text>

            {/* Core Node */}
            <circle
              cx="170"
              cy="46"
              r="10"
              fill={
                activePhase === "processing"
                  ? "#D88762"
                  : isResponseActive
                  ? "#83B69A"
                  : "#1A1C20"
              }
              stroke={
                activePhase === "processing"
                  ? "#D88762"
                  : isResponseActive
                  ? "#83B69A"
                  : "#383C44"
              }
              strokeWidth="1.5"
              className="transition-colors duration-300"
            />

            {/* Status Line */}
            <text
              x="170"
              y="70"
              textAnchor="middle"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="10"
            >
              {activePhase === "setup" || activePhase === "outgoing" ? (
                <tspan fill="#636874">Awaiting request</tspan>
              ) : activePhase === "processing" ? (
                <tspan fill="#D88762" fontWeight="600">Processing...</tspan>
              ) : (
                <tspan fill="#83B69A" fontWeight="600">{isGet ? "200 OK" : "201 Created"}</tspan>
              )}
            </text>
          </g>

          {/* Vertical Conduit 2: Gateway to Response Destination */}
          <g id="mobile-conduit-bottom">
            <line
              x1="170"
              y1="255"
              x2="170"
              y2="285"
              stroke={activePhase === "returning" ? "#3D4046" : "#24262B"}
              strokeWidth="1.5"
            />
            {activePhase === "returning" && (
              <line
                x1="170"
                y1="255"
                x2="170"
                y2="285"
                stroke="#83B69A"
                strokeWidth="2.5"
                strokeDasharray="20 60"
                style={{
                  animation: "signalTravelVerticalBottom 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                }}
              />
            )}
          </g>

          {/* 3. Mobile Response Destination */}
          <g id="mobile-response-destination" transform="translate(0, 285)">
            <rect
              x="20"
              y="0"
              width="300"
              height="95"
              rx="6"
              fill="#101113"
              stroke="#202227"
              strokeWidth="1"
            />

            <circle
              cx="36"
              cy="20"
              r="2.5"
              fill={isResponseActive ? "#83B69A" : "#383B42"}
            />
            <text
              x="46"
              y="24"
              fill={isResponseActive ? "#83B69A" : "#555A64"}
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="12"
              fontWeight="600"
            >
              {isResponseActive ? (isGet ? "200 OK" : "201 Created") : "Response destination"}
            </text>

            {isResponseActive ? (
              isGet ? (
                <text
                  x="36"
                  y="50"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="10.5"
                  fill="#8A8F98"
                >
                  &#123; &quot;name&quot;: &quot;Meridian&quot;, &quot;status&quot;: &quot;healthy&quot; &#125;
                </text>
              ) : (
                <text
                  x="36"
                  y="50"
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
                y="50"
                fill="#3E424B"
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
