"use client";

import React, { useState, useEffect, useRef } from "react";

type RequestType = "GET" | "POST";

type LifecyclePhase =
  | "setup"       // 400ms: Request initiation at client origin
  | "outgoing"    // 900ms: Burnt-orange signal travels along architectural path to API junction
  | "processing"  // 500ms: Central geometric junction transitions to processing state
  | "returning"   // 900ms: Sage-green signal travels along return path to response destination
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
      className="w-full h-full flex flex-col justify-center overflow-hidden text-[12px] font-sans select-none relative py-2 sm:py-4"
    >
      <style>{`
        @keyframes outgoingSignalDesktop {
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
            stroke-dashoffset: -230;
            opacity: 0;
          }
        }
        @keyframes returningSignalDesktop {
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
            stroke-dashoffset: -230;
            opacity: 0;
          }
        }
        @keyframes signalTravelVertical {
          0% {
            top: 0%;
            opacity: 0;
            transform: translateX(-50%) scaleY(0.4);
          }
          15% {
            opacity: 1;
            transform: translateX(-50%) scaleY(1);
          }
          85% {
            opacity: 1;
            transform: translateX(-50%) scaleY(1);
          }
          100% {
            top: 100%;
            opacity: 0;
            transform: translateX(-50%) scaleY(0.4);
          }
        }
        @keyframes jsonLineFade {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* =================================================================
          THE LIVING REQUEST: One Continuous Visual Flow
          No Three-Card Containers. Data Itself Streaming Through Infrastructure.
          Request (Origin) ────[Continuous Architectural Path]────> Junction ────[Return Path]────> Response (Destination)
          ================================================================= */}
      <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-4 my-auto">
        {/* ===============================================================
            1. REQUEST: Origin & Concise Endpoint
            Restrained typography, method distinguished without a badge
            =============================================================== */}
        <div className="w-full lg:w-[280px] flex flex-col justify-center shrink-0 min-h-[140px]">
          {/* Method and Endpoint */}
          <div className="flex items-baseline gap-2.5 font-mono">
            <span
              className={`text-[13.5px] font-bold tracking-wide transition-colors duration-300 ${
                isGet ? "text-semantic-success" : "text-accent-orange"
              }`}
            >
              {isGet ? "GET" : "POST"}
            </span>
            <span className="text-[15px] sm:text-[16px] font-medium text-[#F1F0EC] tracking-tight truncate">
              {isGet ? "/api/v1/projects" : "/api/v1/resources"}
            </span>
          </div>

          {/* Content: GET descriptor or POST real request payload */}
          <div className="min-h-[90px] flex flex-col justify-start">
            {isGet ? (
              <div className="font-mono text-[11.5px] text-text-muted mt-3 leading-relaxed">
                Query project state &amp; deployment status
              </div>
            ) : (
              <div className="mt-3 font-mono text-[12px] leading-relaxed select-text">
                <div className="text-[#4E525A]">{"{"}</div>
                <div className="pl-4">
                  <span className="text-text-muted">&quot;name&quot;:</span>{" "}
                  <span className="text-accent-orange">&quot;Production resource&quot;</span>,
                </div>
                <div className="pl-4">
                  <span className="text-text-muted">&quot;type&quot;:</span>{" "}
                  <span className="text-accent-orange">&quot;web&quot;</span>
                </div>
                <div className="text-[#4E525A]">{"}"}</div>
              </div>
            )}
          </div>
        </div>

        {/* ===============================================================
            2. THE LIVING PATH & CENTRAL PROCESSING JUNCTION (Desktop)
            Single Continuous Architectural SVG with Precision 45° Chamfers
            and Engineered Geometric Junction
            =============================================================== */}
        <div className="hidden lg:flex flex-1 flex-col items-center justify-center relative min-w-[320px] max-w-[520px] px-2 shrink-0">
          {/* Understated Processing Identity */}
          <div className="font-sans text-[15px] sm:text-[16px] font-medium text-[#F1F0EC] tracking-tight mb-1">
            Jetway API
          </div>

          {/* Unified SVG Canvas: Path + Junction + Return Trace */}
          <div className="w-full h-[120px] flex items-center justify-center relative">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 460 120"
              fill="none"
            >
              {/* --- Left Terminal Node (Request Origin Anchor) --- */}
              <circle
                cx="6"
                cy="38"
                r="3"
                fill={activePhase === "outgoing" ? "#D88762" : "#3D4046"}
                className="transition-colors duration-300"
              />
              <circle
                cx="6"
                cy="38"
                r="6"
                fill="none"
                stroke={activePhase === "outgoing" ? "#D88762" : "#2E3136"}
                strokeWidth="1"
                opacity="0.5"
                className="transition-colors duration-300"
              />

              {/* --- Base Outgoing Architectural Path with 45° Chamfer --- */}
              <path
                d="M 6 38 H 110 L 132 60 H 170"
                stroke={activePhase === "outgoing" ? "#3D4046" : "#2B2D31"}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-colors duration-300"
              />

              {/* --- Outgoing Burnt-Orange Signal Trace --- */}
              {activePhase === "outgoing" && (
                <path
                  d="M 6 38 H 110 L 132 60 H 170 L 230 20"
                  stroke="#D88762"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="40 280"
                  style={{
                    animation: "outgoingSignalDesktop 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                  }}
                />
              )}

              {/* --- Central Geometric Junction Structure --- */}
              {/* Centerline Axis */}
              <line
                x1="170"
                y1="60"
                x2="290"
                y2="60"
                stroke="#2A2C30"
                strokeWidth="1"
                strokeDasharray="2 3"
              />

              {/* Dual Diamond Rails (Upper & Lower) */}
              <path
                d="M 170 60 L 230 20 L 290 60"
                stroke={
                  activePhase === "processing"
                    ? "#D88762"
                    : isResponseActive
                    ? "#83B69A"
                    : "#2E3136"
                }
                strokeWidth={activePhase === "processing" || isResponseActive ? "2" : "1.5"}
                strokeLinejoin="round"
                className="transition-colors duration-300"
              />
              <path
                d="M 170 60 L 230 100 L 290 60"
                stroke={
                  activePhase === "processing"
                    ? "#D88762"
                    : isResponseActive
                    ? "#83B69A"
                    : "#2E3136"
                }
                strokeWidth={activePhase === "processing" || isResponseActive ? "2" : "1.5"}
                strokeLinejoin="round"
                className="transition-colors duration-300"
              />

              {/* Precision Technical Crosshair Ticks */}
              <path d="M 220 60 H 240" stroke="#3A3D42" strokeWidth="1" />
              <path d="M 230 50 V 70" stroke="#3A3D42" strokeWidth="1" />

              {/* Precision Geometric Diamond Core */}
              <rect
                x="223"
                y="53"
                width="14"
                height="14"
                transform={
                  activePhase === "processing"
                    ? "rotate(90 230 60) scale(1.15)"
                    : "rotate(45 230 60)"
                }
                style={{ transformOrigin: "230px 60px" }}
                fill={
                  activePhase === "processing"
                    ? "#D88762"
                    : isResponseActive
                    ? "#83B69A"
                    : "#151618"
                }
                stroke={
                  activePhase === "processing"
                    ? "#D88762"
                    : isResponseActive
                    ? "#83B69A"
                    : "#3D4046"
                }
                strokeWidth="1.5"
                className="transition-all duration-300"
              />

              {/* --- Base Returning Architectural Path with 45° Chamfer --- */}
              <path
                d="M 290 60 H 328 L 350 82 H 454"
                stroke={activePhase === "returning" ? "#3D4046" : "#2B2D31"}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-colors duration-300"
              />

              {/* --- Returning Sage-Green Signal Trace --- */}
              {activePhase === "returning" && (
                <path
                  d="M 230 20 L 290 60 H 328 L 350 82 H 454"
                  stroke="#83B69A"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="40 280"
                  style={{
                    animation: "returningSignalDesktop 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                  }}
                />
              )}

              {/* --- Right Terminal Node (Response Destination Anchor) --- */}
              <circle
                cx="454"
                cy="82"
                r="3"
                fill={isResponseActive ? "#83B69A" : "#3D4046"}
                className="transition-colors duration-300"
              />
              <circle
                cx="454"
                cy="82"
                r="6"
                fill="none"
                stroke={isResponseActive ? "#83B69A" : "#2E3136"}
                strokeWidth="1"
                opacity="0.5"
                className="transition-colors duration-300"
              />
            </svg>
          </div>

          {/* Dynamic Processing State Indicator */}
          <div className="font-mono text-[11.5px] mt-1 transition-colors">
            {activePhase === "setup" || activePhase === "outgoing" ? (
              <span className="text-text-muted">Awaiting request</span>
            ) : activePhase === "processing" ? (
              <span className="text-accent-orange font-medium flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-orange animate-ping" />
                {isGet ? "Resolving project..." : "Allocating resource..."}
              </span>
            ) : (
              <span className="text-semantic-success font-semibold flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                {isGet ? "200 OK" : "201 Created"}
              </span>
            )}
          </div>
        </div>

        {/* Mobile Vertical Circuit Layout (< lg) */}
        <div className="flex lg:hidden flex-col items-center justify-center w-full my-1">
          {/* Top Outgoing Trace */}
          <div className="h-6 w-[1.5px] bg-border-subtle/70 relative">
            {activePhase === "outgoing" && (
              <span
                className="absolute left-1/2 -translate-x-1/2 h-5 w-[2px] bg-gradient-to-b from-transparent via-accent-orange to-accent-orange rounded-full pointer-events-none"
                style={{
                  animation: "signalTravelVertical 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                }}
              />
            )}
          </div>

          {/* Central Mobile Node */}
          <div className="my-1 flex flex-col items-center text-center">
            <span className="font-sans text-[14px] font-medium text-[#F1F0EC]">Jetway API</span>
            <div className="font-mono text-[11px] mt-0.5">
              {activePhase === "processing" ? (
                <span className="text-accent-orange font-medium">Processing...</span>
              ) : isResponseActive ? (
                <span className="text-semantic-success font-semibold">{isGet ? "200 OK" : "201 Created"}</span>
              ) : (
                <span className="text-text-muted">Ready</span>
              )}
            </div>
          </div>

          {/* Bottom Return Trace */}
          <div className="h-6 w-[1.5px] bg-border-subtle/70 relative">
            {activePhase === "returning" && (
              <span
                className="absolute left-1/2 -translate-x-1/2 h-5 w-[2px] bg-gradient-to-b from-transparent via-semantic-success to-semantic-success rounded-full pointer-events-none"
                style={{
                  animation: "signalTravelVertical 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                }}
              />
            )}
          </div>
        </div>

        {/* ===============================================================
            3. RESPONSE: Readable Destination (Natural Emergence, No Box)
            Real JSON revealed line by line as response signal arrives
            =============================================================== */}
        <div className="w-full lg:w-[280px] flex flex-col justify-center shrink-0 min-h-[140px]">
          {/* Status Indicator */}
          <div className="font-mono text-[14px] sm:text-[15px] font-semibold transition-colors flex items-center gap-2">
            {isResponseActive ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                <span className="text-semantic-success">{isGet ? "200 OK" : "201 Created"}</span>
              </>
            ) : (
              <span className="text-text-muted/40 font-normal text-[13px]">Response</span>
            )}
          </div>

          {/* Emergent JSON Payload (Pure Typography, No Bordered Container) */}
          <div className="min-h-[90px] flex flex-col justify-start">
            {!isResponseActive ? (
              <div className="mt-3 font-mono text-[11.5px] text-text-muted/30">
                Awaiting response...
              </div>
            ) : (
              <div className="mt-3 font-mono text-[12px] leading-relaxed select-text">
                <div className="text-[#4E525A]">{"{"}</div>
                {isGet ? (
                  <>
                    <div
                      className="pl-4"
                      style={{ animation: "jsonLineFade 0.25s ease-out 0.05s both" }}
                    >
                      <span className="text-text-muted">&quot;name&quot;:</span>{" "}
                      <span className="text-semantic-success">&quot;Meridian&quot;</span>,
                    </div>
                    <div
                      className="pl-4"
                      style={{ animation: "jsonLineFade 0.25s ease-out 0.18s both" }}
                    >
                      <span className="text-text-muted">&quot;status&quot;:</span>{" "}
                      <span className="text-semantic-success">&quot;healthy&quot;</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className="pl-4"
                      style={{ animation: "jsonLineFade 0.25s ease-out 0.05s both" }}
                    >
                      <span className="text-text-muted">&quot;id&quot;:</span>{" "}
                      <span className="text-[#F1F0EC]">&quot;resource_08&quot;</span>,
                    </div>
                    <div
                      className="pl-4"
                      style={{ animation: "jsonLineFade 0.25s ease-out 0.18s both" }}
                    >
                      <span className="text-text-muted">&quot;created&quot;:</span>{" "}
                      <span className="text-accent-orange">true</span>
                    </div>
                  </>
                )}
                <div className="text-[#4E525A]">{"}"}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApiServicePlayground;
