"use client";

import React, { useState, useEffect } from "react";

type RequestType = "GET" | "POST";

type LifecyclePhase =
  | "setup"       // 0.6s: Client prepares request (displays method & endpoint, shows payload if POST)
  | "outgoing"    // 0.9s: Burnt orange packet travels Client -> Jetway API
  | "processing"  // 0.8s: API processes request, node accentuates, status "Processing request..."
  | "returning"   // 0.9s: Sage green packet travels Jetway API -> Response
  | "reveal"      // 0.7s: Response JSON reveals smoothly
  | "completed";  // 1.6s: Full completed state held for reading

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
  const isReducedMotion = React.useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  // Main lifecycle state machine
  useEffect(() => {
    if (isReducedMotion) {
      return;
    }

    let timeoutId: NodeJS.Timeout;

    switch (phase) {
      case "setup":
        timeoutId = setTimeout(() => setPhase("outgoing"), 600);
        break;
      case "outgoing":
        timeoutId = setTimeout(() => setPhase("processing"), 900);
        break;
      case "processing":
        timeoutId = setTimeout(() => setPhase("returning"), 800);
        break;
      case "returning":
        timeoutId = setTimeout(() => setPhase("reveal"), 900);
        break;
      case "reveal":
        timeoutId = setTimeout(() => setPhase("completed"), 700);
        break;
      case "completed":
        // Hold completed state, then toggle GET <-> POST and restart sequence
        timeoutId = setTimeout(() => {
          setRequestType((prev) => (prev === "GET" ? "POST" : "GET"));
          setPhase("setup");
        }, 1600);
        break;
    }

    return () => clearTimeout(timeoutId);
  }, [phase, isReducedMotion]);

  const activePhase: LifecyclePhase = isReducedMotion ? "completed" : phase;
  const isGet = requestType === "GET";

  const handleSelectType = (type: RequestType) => {
    if (requestType !== type) {
      setRequestType(type);
      setPhase("setup");
    }
  };

  return (
    <div className="w-full h-full flex flex-col justify-between overflow-hidden text-[12px] font-sans select-none">
      <style>{`
        @keyframes packetTravelHorizontal {
          0% { left: 0%; opacity: 0; transform: translateY(-50%) scale(0.7); }
          15% { opacity: 1; transform: translateY(-50%) scale(1); }
          85% { opacity: 1; transform: translateY(-50%) scale(1); }
          100% { left: 100%; opacity: 0; transform: translateY(-50%) scale(0.7); }
        }
        @keyframes packetTravelVertical {
          0% { top: 0%; opacity: 0; transform: translateX(-50%) scale(0.7); }
          15% { opacity: 1; transform: translateX(-50%) scale(1); }
          85% { opacity: 1; transform: translateX(-50%) scale(1); }
          100% { top: 100%; opacity: 0; transform: translateX(-50%) scale(0.7); }
        }
      `}</style>

      {/* =================================================================
          TOP SEQUENCE BAR: Shows automatic progression between GET and POST
          ================================================================= */}
      <div className="shrink-0 flex items-center justify-between pb-2 sm:pb-2.5 border-b border-border-subtle/60 text-[11px] font-mono">
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="text-text-muted uppercase text-[9.5px] tracking-wider hidden sm:inline">
            Request Sequence:
          </span>
          <button
            onClick={() => handleSelectType("GET")}
            className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
              isGet ? "text-[#F1F0EC] font-medium" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <span
              className={`text-[9.5px] font-bold ${
                isGet ? "text-semantic-success" : "text-text-muted"
              }`}
            >
              GET
            </span>
            <span>/api/v1/projects</span>
            {isGet && <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />}
          </button>

          <span className="text-border-default text-[10px]">→</span>

          <button
            onClick={() => handleSelectType("POST")}
            className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
              !isGet ? "text-[#F1F0EC] font-medium" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <span
              className={`text-[9.5px] font-bold ${
                !isGet ? "text-accent-orange" : "text-text-muted"
              }`}
            >
              POST
            </span>
            <span>/api/v1/resources</span>
            {!isGet && <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />}
          </button>
        </div>

        <div className="flex items-center gap-2 text-text-muted text-[10.5px]">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-orange animate-pulse" />
          <span className="hidden sm:inline">Automated Lifecycle</span>
        </div>
      </div>

      {/* =================================================================
          MAIN REQUEST-FLOW VISUALIZATION: CLIENT → JETWAY API → RESPONSE
          Spacious horizontal flow on desktop, streamlined vertical on mobile
          ================================================================= */}
      <div className="flex-1 min-h-0 my-auto py-1 sm:py-2 flex flex-col lg:flex-row items-center justify-between gap-1.5 sm:gap-2 lg:gap-4 overflow-hidden">
        {/* ===============================================================
            STAGE A: CLIENT
            =============================================================== */}
        <div className="w-full lg:w-[30%] lg:max-w-[280px] h-[78px] sm:h-[86px] lg:h-[220px] rounded-[6px] bg-[#141618] border border-border-subtle/80 p-2.5 sm:p-3.5 flex flex-col justify-between shrink-0 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 lg:pb-2 border-b border-border-subtle/60">
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3 rounded-[2px] border border-border-default/80 flex items-center justify-start gap-0.5 px-0.5">
                <span className="w-0.5 h-0.5 rounded-full bg-text-muted" />
                <span className="w-0.5 h-0.5 rounded-full bg-text-muted" />
                <span className="w-0.5 h-0.5 rounded-full bg-text-muted" />
              </div>
              <span className="font-mono text-[9.5px] sm:text-[10px] tracking-[0.14em] text-text-muted uppercase font-medium">
                Client
              </span>
            </div>
            <span className="font-mono text-[9.5px] sm:text-[10px] text-text-muted">
              {isGet ? "read query" : "mutation"}
            </span>
          </div>

          {/* Middle: Method, Endpoint & Payload */}
          <div className="py-0.5 lg:py-1 space-y-1">
            <div className="flex items-center gap-1.5 font-mono text-[10.5px] sm:text-[11px]">
              <span
                className={`px-1.5 py-0.5 rounded-[2px] text-[9.5px] font-bold tracking-wide ${
                  isGet
                    ? "bg-[#83B69A]/15 text-semantic-success border border-semantic-success/30"
                    : "bg-[#D88762]/15 text-accent-orange border border-accent-orange/30"
                }`}
              >
                {isGet ? "GET" : "POST"}
              </span>
              <span className="text-[#F1F0EC] truncate font-medium">
                {isGet ? "/api/v1/projects" : "/api/v1/resources"}
              </span>
            </div>

            {/* Desktop Details: For GET show schema note, for POST show compact payload preview */}
            <div className="hidden lg:block">
              {isGet ? (
                <div className="font-mono text-[10px] text-text-muted leading-relaxed pt-1">
                  Query project state &amp; deployment health metadata.
                </div>
              ) : (
                <div className="rounded-[3px] bg-[#0E1012] border border-border-subtle/70 p-2 font-mono text-[10px] leading-relaxed text-text-secondary mt-1">
                  <div>{"{"}</div>
                  <div className="pl-2">
                    <span className="text-text-muted">&quot;name&quot;:</span>{" "}
                    <span className="text-semantic-success">&quot;Production resource&quot;</span>,
                  </div>
                  <div className="pl-2">
                    <span className="text-text-muted">&quot;type&quot;:</span>{" "}
                    <span className="text-semantic-success">&quot;web&quot;</span>
                  </div>
                  <div>{"}"}</div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Status */}
          <div className="pt-1 lg:pt-2 border-t border-border-subtle/40 flex items-center justify-between font-mono text-[9.5px] sm:text-[10px] text-text-muted">
            <span className="truncate">
              {activePhase === "setup"
                ? "Initiating request..."
                : activePhase === "outgoing"
                ? "Dispatching request..."
                : activePhase === "processing"
                ? "Awaiting gateway..."
                : "Request dispatched"}
            </span>
            {activePhase === "outgoing" && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent-orange animate-ping shrink-0" />
            )}
          </div>
        </div>

        {/* ===============================================================
            CONNECTOR 1: CLIENT → JETWAY API (Burnt Orange Packet)
            =============================================================== */}
        {/* Desktop horizontal connector */}
        <div className="hidden lg:flex flex-col items-center justify-center flex-1 min-w-[50px] max-w-[120px] px-2 h-[220px] relative select-none">
          <div className="w-full h-[1px] bg-border-subtle/80 relative">
            {activePhase === "outgoing" && (
              <span
                className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-accent-orange shadow-[0_0_10px_rgba(216,135,98,0.85)] pointer-events-none"
                style={{
                  animation: "packetTravelHorizontal 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                }}
              />
            )}
          </div>
          <div className="font-mono text-[9px] text-text-muted uppercase tracking-wider mt-2">
            {activePhase === "outgoing" ? (
              <span className="text-accent-orange">In Flight →</span>
            ) : (
              <span>Request →</span>
            )}
          </div>
        </div>

        {/* Mobile vertical connector */}
        <div className="flex lg:hidden items-center justify-center h-4 w-full relative select-none">
          <div className="h-full w-[1px] bg-border-subtle/80 relative">
            {activePhase === "outgoing" && (
              <span
                className="absolute left-1/2 w-2 h-2 rounded-full bg-accent-orange shadow-[0_0_8px_rgba(216,135,98,0.85)] pointer-events-none"
                style={{
                  animation: "packetTravelVertical 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                }}
              />
            )}
          </div>
        </div>

        {/* ===============================================================
            STAGE B: JETWAY API (Visual Anchor of the Flow)
            =============================================================== */}
        <div
          className={`w-full lg:w-[34%] lg:max-w-[320px] h-[84px] sm:h-[92px] lg:h-[220px] rounded-[6px] bg-[#16181A] border p-2.5 sm:p-3.5 flex flex-col justify-between shrink-0 shadow-md transition-all duration-300 relative ${
            activePhase === "processing"
              ? "border-accent-orange/70 shadow-[0_0_20px_rgba(216,135,98,0.15)] ring-1 ring-accent-orange/20"
              : activePhase === "returning" || activePhase === "reveal" || activePhase === "completed"
              ? "border-border-default/90"
              : "border-border-subtle/80"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 lg:pb-2 border-b border-border-subtle/60">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  activePhase === "processing"
                    ? "bg-accent-orange animate-pulse"
                    : activePhase === "returning" || activePhase === "reveal" || activePhase === "completed"
                    ? "bg-semantic-success"
                    : "bg-border-default"
                }`}
              />
              <span className="font-mono text-[9.5px] sm:text-[10px] tracking-[0.14em] text-text-muted uppercase font-medium">
                Jetway API
              </span>
            </div>
            <span className="font-mono text-[9.5px] sm:text-[10px] text-text-muted">
              cdg-1 (Paris)
            </span>
          </div>

          {/* Center: Processing State & Endpoint Anchor */}
          <div className="py-1 text-center flex flex-col items-center justify-center space-y-1.5 lg:space-y-2">
            <div className="font-mono text-[11px] sm:text-[12px] font-medium transition-colors">
              {activePhase === "setup" || activePhase === "outgoing" ? (
                <span className="text-text-muted">Awaiting request</span>
              ) : activePhase === "processing" ? (
                <span className="text-accent-orange flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-orange animate-ping" />
                  Processing request
                </span>
              ) : (
                <span className="text-semantic-success flex items-center justify-center gap-1.5 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                  {isGet ? "200 OK" : "201 Created"}
                </span>
              )}
            </div>

            {/* Active Endpoint displayed beneath API Node */}
            <div className="px-2 py-0.5 sm:py-1 rounded-[3px] bg-[#111214] border border-border-subtle/60 font-mono text-[10px] sm:text-[10.5px] text-[#F1F0EC] max-w-full truncate">
              <span
                className={
                  isGet ? "text-semantic-success font-semibold mr-1" : "text-accent-orange font-semibold mr-1"
                }
              >
                {isGet ? "GET" : "POST"}
              </span>
              <span>{isGet ? "/api/v1/projects" : "/api/v1/resources"}</span>
            </div>
          </div>

          {/* Footer Metadata */}
          <div className="pt-1 lg:pt-2 border-t border-border-subtle/40 flex items-center justify-between font-mono text-[9.5px] sm:text-[10px] text-text-muted">
            <span>Anycast edge mesh</span>
            <span>{isGet ? "12ms" : "18ms"}</span>
          </div>
        </div>

        {/* ===============================================================
            CONNECTOR 2: JETWAY API → RESPONSE (Sage Green Packet)
            =============================================================== */}
        {/* Desktop horizontal connector */}
        <div className="hidden lg:flex flex-col items-center justify-center flex-1 min-w-[50px] max-w-[120px] px-2 h-[220px] relative select-none">
          <div className="w-full h-[1px] bg-border-subtle/80 relative">
            {activePhase === "returning" && (
              <span
                className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-semantic-success shadow-[0_0_10px_rgba(131,182,154,0.85)] pointer-events-none"
                style={{
                  animation: "packetTravelHorizontal 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                }}
              />
            )}
          </div>
          <div className="font-mono text-[9px] text-text-muted uppercase tracking-wider mt-2">
            {activePhase === "returning" ? (
              <span className="text-semantic-success">Response Return →</span>
            ) : (
              <span>Response →</span>
            )}
          </div>
        </div>

        {/* Mobile vertical connector */}
        <div className="flex lg:hidden items-center justify-center h-4 w-full relative select-none">
          <div className="h-full w-[1px] bg-border-subtle/80 relative">
            {activePhase === "returning" && (
              <span
                className="absolute left-1/2 w-2 h-2 rounded-full bg-semantic-success shadow-[0_0_8px_rgba(131,182,154,0.85)] pointer-events-none"
                style={{
                  animation: "packetTravelVertical 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                }}
              />
            )}
          </div>
        </div>

        {/* ===============================================================
            STAGE C: RESPONSE (Compact, Progressive JSON)
            =============================================================== */}
        <div className="w-full lg:w-[32%] lg:max-w-[300px] h-[86px] sm:h-[96px] lg:h-[220px] rounded-[6px] bg-[#141618] border border-border-subtle/80 p-2.5 sm:p-3.5 flex flex-col justify-between shrink-0 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 lg:pb-2 border-b border-border-subtle/60">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  activePhase === "reveal" || activePhase === "completed"
                    ? "bg-semantic-success"
                    : "bg-border-default"
                }`}
              />
              <span className="font-mono text-[9.5px] sm:text-[10px] tracking-[0.14em] text-text-muted uppercase font-medium">
                Response
              </span>
            </div>
            <span
              className={`font-mono text-[9.5px] sm:text-[10px] font-medium ${
                activePhase === "reveal" || activePhase === "completed"
                  ? "text-semantic-success"
                  : "text-text-muted"
              }`}
            >
              {activePhase === "reveal" || activePhase === "completed"
                ? isGet
                  ? "200 OK"
                  : "201 Created"
                : "Pending"}
            </span>
          </div>

          {/* Middle: Progressive JSON Snippet */}
          <div className="py-0.5 lg:py-1">
            {activePhase === "setup" || activePhase === "outgoing" || activePhase === "processing" ? (
              <div className="h-[44px] sm:h-[50px] lg:h-[105px] rounded-[3px] bg-[#0E1012] border border-border-subtle/40 flex flex-col items-center justify-center text-text-muted font-mono text-[10px]">
                <span>Awaiting payload...</span>
              </div>
            ) : (
              <div className="h-[44px] sm:h-[50px] lg:h-[105px] rounded-[3px] bg-[#0E1012] border border-border-subtle/70 p-1.5 sm:p-2 font-mono text-[9.5px] sm:text-[10px] leading-relaxed text-text-secondary animate-in fade-in duration-300 overflow-hidden flex flex-col justify-center">
                <div>{"{"}</div>
                {isGet ? (
                  <>
                    <div className="pl-2">
                      <span className="text-text-muted">&quot;id&quot;:</span>{" "}
                      <span className="text-[#F1F0EC]">&quot;project_01&quot;</span>,
                    </div>
                    <div className="pl-2">
                      <span className="text-text-muted">&quot;name&quot;:</span>{" "}
                      <span className="text-semantic-success">&quot;Meridian&quot;</span>,
                    </div>
                    <div className="pl-2">
                      <span className="text-text-muted">&quot;status&quot;:</span>{" "}
                      <span className="text-semantic-success">&quot;healthy&quot;</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="pl-2">
                      <span className="text-text-muted">&quot;id&quot;:</span>{" "}
                      <span className="text-[#F1F0EC]">&quot;resource_08&quot;</span>,
                    </div>
                    <div className="pl-2">
                      <span className="text-text-muted">&quot;created&quot;:</span>{" "}
                      <span className="text-accent-orange">true</span>,
                    </div>
                    <div className="pl-2">
                      <span className="text-text-muted">&quot;status&quot;:</span>{" "}
                      <span className="text-semantic-success">&quot;success&quot;</span>
                    </div>
                  </>
                )}
                <div>{"}"}</div>
              </div>
            )}
          </div>

          {/* Footer Metadata */}
          <div className="pt-1 lg:pt-2 border-t border-border-subtle/40 flex items-center justify-between font-mono text-[9.5px] sm:text-[10px] text-text-muted">
            <span>application/json</span>
            <span>{isGet ? "142 B" : "96 B"}</span>
          </div>
        </div>
      </div>

      {/* =================================================================
          BOTTOM STATUS STRIP: Calm technical lifecycle progression
          ================================================================= */}
      <div className="shrink-0 pt-2 border-t border-border-subtle/50 flex items-center justify-between text-[10px] sm:text-[10.5px] font-mono text-text-muted">
        <div className="flex items-center gap-2">
          <span className="text-[#F1F0EC]">Lifecycle Step:</span>
          <span className="text-accent-orange font-medium">
            {activePhase === "setup"
              ? "01 / Request prepared"
              : activePhase === "outgoing"
              ? "02 / Traveling across network"
              : activePhase === "processing"
              ? "03 / Processing at Edge Gateway"
              : activePhase === "returning"
              ? "04 / Response dispatched"
              : activePhase === "reveal"
              ? "05 / JSON payload received"
              : "06 / Complete (holding state)"}
          </span>
        </div>
        <div className="text-text-muted hidden sm:block">
          {isGet ? "GET: Read query (idempotent)" : "POST: Resource creation"}
        </div>
      </div>
    </div>
  );
}

export default ApiServicePlayground;
