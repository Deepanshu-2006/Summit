"use client";

import React, { useState, useEffect, useRef } from "react";

type QueryType = "SELECT" | "UPDATE";

type LifecyclePhase =
  | "setup"       // 400ms: Query initiation & line emphasis
  | "outgoing"    // 900ms: Burnt-orange signal travels through curved conduit into storage engine
  | "processing"  // 500ms: Central storage engine activates, layers scan or mutate
  | "returning"   // 900ms: Sage-green signal travels through egress conduit to result destination
  | "reveal"      // 600ms: Structured record rows materialize progressively
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

export function DatabaseServicePlayground() {
  const [queryType, setQueryType] = useState<QueryType>("SELECT");
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
        // Hold completed state, then smoothly cycle between SELECT and UPDATE
        timeoutId = setTimeout(() => {
          setQueryType((prev) => (prev === "SELECT" ? "UPDATE" : "SELECT"));
          setPhase("setup");
        }, 1600);
        break;
    }

    return () => clearTimeout(timeoutId);
  }, [phase, isReducedMotion, isInViewport]);

  const activePhase: LifecyclePhase = isReducedMotion ? "completed" : phase;
  const isSelect = queryType === "SELECT";

  const isResponseActive =
    activePhase === "returning" || activePhase === "reveal" || activePhase === "completed";

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden select-none relative"
    >
      <style>{`
        @keyframes dbSignalTravel1 {
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
        @keyframes dbSignalTravel2 {
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
        @keyframes rowFadeIn {
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
          DESKTOP & TABLET: The Living Database Engine Illustration
          Zero Slate Backgrounds · Tiered Storage Engine · Smooth Bézier Conduits
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
            {/* Precision Volumetric Storage Shading */}
            <linearGradient id="db-tier-top" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E2226" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#111315" stopOpacity="0.95" />
            </linearGradient>

            <linearGradient id="db-tier-mid" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#252A2F" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#131618" stopOpacity="0.95" />
            </linearGradient>

            <linearGradient id="db-tier-bot" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1B1E22" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#0F1113" stopOpacity="0.95" />
            </linearGradient>

            <linearGradient id="db-segment-scan" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#83B69A" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#83B69A" stopOpacity="0.08" />
            </linearGradient>

            <linearGradient id="db-segment-update" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#D88762" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#D88762" stopOpacity="0.10" />
            </linearGradient>
          </defs>

          {/* =============================================================
              CONNECTING PIPELINE CONDUITS (Rendered Behind Geometry)
              Leg 1: Query Origin (280, 215) -> Database Engine Ingress (410, 204)
              Leg 2: Database Engine Egress (610, 204) -> Results Destination (730, 204)
              ============================================================= */}
          <g id="db-conduit-wiring">
            {/* Leg 1: Background Dashed Guide */}
            <path
              d="M 280,215 C 325,185 365,235 410,204"
              stroke="#3D4245"
              strokeWidth="1.2"
              strokeDasharray="3 3"
              fill="none"
            />
            {/* Leg 1: Active Burnt-Orange Trace */}
            <path
              id="db-leg1-path"
              d="M 280,215 C 325,185 365,235 410,204"
              stroke="#D88762"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity={activePhase === "outgoing" ? 1 : 0.4}
              className="transition-opacity duration-300"
            />
            {/* Leg 1 Midpoint Outlined Junction Node */}
            <circle cx="345" cy="209.5" r="4" fill="#121416" stroke="#D88762" strokeWidth="1.4" />
            <circle cx="345" cy="209.5" r="1.8" fill="#D88762" />

            {/* Leg 1 Animated Signal Motion Packet */}
            {activePhase === "outgoing" && (
              <circle
                r="4.5"
                fill="#D88762"
                style={{
                  offsetPath: "path('M 280,215 C 325,185 365,235 410,204')",
                  animation: "dbSignalTravel1 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                }}
              />
            )}

            {/* Leg 2: Background Dashed Guide */}
            <path
              d="M 610,204 C 655,185 685,225 730,204"
              stroke="#3D4245"
              strokeWidth="1.2"
              strokeDasharray="3 3"
              fill="none"
            />
            {/* Leg 2: Active Sage-Green Trace */}
            <path
              id="db-leg2-path"
              d="M 610,204 C 655,185 685,225 730,204"
              stroke="#83B69A"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity={isResponseActive ? 1 : 0.3}
              className="transition-opacity duration-300"
            />
            {/* Leg 2 Midpoint Outlined Junction Node */}
            <circle cx="670" cy="204" r="4" fill="#121416" stroke="#83B69A" strokeWidth="1.4" />
            <circle cx="670" cy="204" r="1.8" fill="#83B69A" />

            {/* Leg 2 Animated Signal Motion Packet */}
            {activePhase === "returning" && (
              <circle
                r="4.5"
                fill="#83B69A"
                style={{
                  offsetPath: "path('M 610,204 C 655,185 685,225 730,204')",
                  animation: "dbSignalTravel2 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                }}
              />
            )}
          </g>

          {/* =============================================================
              STAGE 01: SQL QUERY (Left Section)
              Zero Slate Card · Pure Elegant Typography & Origin Flange
              ============================================================= */}
          <g id="scene-query">
            {/* Stage Identifier */}
            <text
              x="50"
              y="62"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="11"
              fill="#D88762"
              letterSpacing="0.12em"
              fontWeight="500"
            >
              01 / SQL QUERY
            </text>

            {/* Statement Header */}
            <text
              x="50"
              y="96"
              fontFamily="var(--font-space-grotesk), sans-serif"
              fontSize="22"
              fontWeight="600"
              fill="#F1F0EC"
              letterSpacing="-0.02em"
            >
              <tspan fill="#D88762">{isSelect ? "SELECT" : "UPDATE"}</tspan>
              <tspan fill="#F1F0EC" dx="8">releases</tspan>
            </text>

            {/* Description */}
            <text
              x="50"
              y="122"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="12"
              fill="#777D7D"
            >
              {isSelect ? "Index scan on deployed_at" : "Targeted row mutation with returning clause"}
            </text>

            {/* Structured SQL Syntax (Readable Geist Mono with Restrained Syntax Highlighting) */}
            {isSelect ? (
              <text
                x="50"
                y="150"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="12"
                fill="#F1F0EC"
                xmlSpace="preserve"
              >
                <tspan x="50" dy="0"><tspan fill="#D88762" fontWeight="600">SELECT</tspan> id, slug, status</tspan>
                <tspan x="50" dy="20"><tspan fill="#D88762" fontWeight="600">FROM</tspan> releases</tspan>
                <tspan x="50" dy="20"><tspan fill="#D88762" fontWeight="600">WHERE</tspan> status = <tspan fill="#83B69A">&apos;published&apos;</tspan></tspan>
                <tspan x="50" dy="20"><tspan fill="#D88762" fontWeight="600">ORDER BY</tspan> deployed_at <tspan fill="#D88762" fontWeight="600">DESC</tspan></tspan>
                <tspan x="50" dy="20"><tspan fill="#D88762" fontWeight="600">LIMIT</tspan> 3;</tspan>
              </text>
            ) : (
              <text
                x="50"
                y="150"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="12"
                fill="#F1F0EC"
                xmlSpace="preserve"
              >
                <tspan x="50" dy="0"><tspan fill="#D88762" fontWeight="600">UPDATE</tspan> releases</tspan>
                <tspan x="50" dy="20"><tspan fill="#D88762" fontWeight="600">SET</tspan> status = <tspan fill="#83B69A">&apos;published&apos;</tspan></tspan>
                <tspan x="50" dy="20"><tspan fill="#D88762" fontWeight="600">WHERE</tspan> id = <tspan fill="#83B69A">&apos;rel_024&apos;</tspan></tspan>
                <tspan x="50" dy="20"><tspan fill="#D88762" fontWeight="600">RETURNING</tspan> id, status;</tspan>
              </text>
            )}

            {/* Output Flange Coupling at Vertex (280, 215) */}
            <circle cx="280" cy="215" r="5.5" fill="#121416" stroke="#F1F0EC" strokeWidth="1.8" />
            <circle cx="280" cy="215" r="2.5" fill="#D88762" />
          </g>

          {/* =============================================================
              STAGE 02: POSTGRESQL STORAGE ENGINE (Center Section)
              Tiered Storage Strata · Central Processing Node · Telemetry List
              ============================================================= */}
          <g id="scene-storage-engine">
            {/* Heading */}
            <text
              x="510"
              y="55"
              textAnchor="middle"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="11"
              fill="#D88762"
              letterSpacing="0.12em"
            >
              02 / ENGINE
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
              PostgreSQL
            </text>
            <text
              x="510"
              y="100"
              textAnchor="middle"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="12"
              fill="#777D7D"
            >
              Tiered tablespace · Write-ahead log · NVMe storage
            </text>

            {/* --- Tier 1 (Top Layer): WAL & Memory Buffers (Y = 146 to 170) --- */}
            <g id="engine-tier-wal">
              <rect
                x="420"
                y="146"
                width="180"
                height="24"
                rx="4"
                fill="url(#db-tier-top)"
                stroke="#32363D"
                strokeWidth="1.2"
              />
              {/* Partition Dividers */}
              <line x1="465" y1="146" x2="465" y2="170" stroke="#22252B" strokeWidth="1" />
              <line x1="510" y1="146" x2="510" y2="170" stroke="#22252B" strokeWidth="1" />
              <line x1="555" y1="146" x2="555" y2="170" stroke="#22252B" strokeWidth="1" />
              {/* Segment Micro-label */}
              <text x="428" y="162" fontFamily="var(--font-geist-mono), monospace" fontSize="9" fill="#585D68">WAL BUFFER</text>
              <circle cx="585" cy="158" r="2" fill={activePhase === "processing" && !isSelect ? "#D88762" : "#3D424A"} className="transition-colors duration-300" />
            </g>

            {/* --- Tier 2 (Middle Layer): Active Table Segments — releases (Y = 186 to 222) --- */}
            <g id="engine-tier-table">
              <rect
                x="410"
                y="186"
                width="200"
                height="36"
                rx="4"
                fill="url(#db-tier-mid)"
                stroke={activePhase === "processing" ? "#D88762" : isResponseActive ? "#83B69A" : "#F1F0EC"}
                strokeWidth="1.5"
                className="transition-colors duration-300"
              />

              {/* Data Segments with dividing lines */}
              <line x1="460" y1="186" x2="460" y2="222" stroke="#2E333B" strokeWidth="1" />
              <line x1="510" y1="186" x2="510" y2="222" stroke="#2E333B" strokeWidth="1" />
              <line x1="560" y1="186" x2="560" y2="222" stroke="#2E333B" strokeWidth="1" />

              {/* Segment 1: rel_024 target block (Highlights on UPDATE/SELECT) */}
              <rect
                x="411"
                y="187"
                width="48"
                height="34"
                rx="3"
                fill={
                  activePhase === "processing"
                    ? isSelect
                      ? "url(#db-segment-scan)"
                      : "url(#db-segment-update)"
                    : isResponseActive
                    ? "url(#db-segment-scan)"
                    : "transparent"
                }
                className="transition-colors duration-300"
              />

              {/* Segment 2 & 3: Scan Highlights on SELECT */}
              {isSelect && (
                <>
                  <rect
                    x="461"
                    y="187"
                    width="48"
                    height="34"
                    fill={activePhase === "processing" || isResponseActive ? "url(#db-segment-scan)" : "transparent"}
                    className="transition-colors duration-300"
                  />
                  <rect
                    x="511"
                    y="187"
                    width="48"
                    height="34"
                    fill={activePhase === "processing" || isResponseActive ? "url(#db-segment-scan)" : "transparent"}
                    className="transition-colors duration-300"
                  />
                </>
              )}

              {/* Segment Micro-labels */}
              <text x="418" y="208" fontFamily="var(--font-geist-mono), monospace" fontSize="9.5" fill="#8A8F98">rel_024</text>
              <text x="468" y="208" fontFamily="var(--font-geist-mono), monospace" fontSize="9.5" fill="#6E737D">rel_023</text>
              <text x="518" y="208" fontFamily="var(--font-geist-mono), monospace" fontSize="9.5" fill="#6E737D">rel_022</text>
              <text x="568" y="208" fontFamily="var(--font-geist-mono), monospace" fontSize="9.5" fill="#4E535C">rel_021</text>
            </g>

            {/* --- Tier 3 (Bottom Layer): Index Storage Segments — idx_deployed_at (Y = 238 to 262) --- */}
            <g id="engine-tier-index">
              <rect
                x="420"
                y="238"
                width="180"
                height="24"
                rx="4"
                fill="url(#db-tier-bot)"
                stroke="#32363D"
                strokeWidth="1.2"
              />
              <line x1="465" y1="238" x2="465" y2="262" stroke="#22252B" strokeWidth="1" />
              <line x1="510" y1="238" x2="510" y2="262" stroke="#22252B" strokeWidth="1" />
              <line x1="555" y1="238" x2="555" y2="262" stroke="#22252B" strokeWidth="1" />
              <text x="428" y="254" fontFamily="var(--font-geist-mono), monospace" fontSize="9" fill="#585D68">BTREE INDEX</text>
              <circle cx="585" cy="250" r="2" fill={activePhase === "processing" && isSelect ? "#83B69A" : "#3D424A"} className="transition-colors duration-300" />
            </g>

            {/* Vertical Query Execution Core & Axis Traces */}
            <line x1="510" y1="135" x2="510" y2="272" stroke="#2E333B" strokeWidth="1" strokeDasharray="2 2" />

            {/* Central Execution Node at (510, 204) */}
            <rect
              x="502"
              y="196"
              width="16"
              height="16"
              rx="2"
              fill={
                activePhase === "processing"
                  ? isSelect
                    ? "#83B69A"
                    : "#D88762"
                  : isResponseActive
                  ? "#83B69A"
                  : "#1C1F24"
              }
              stroke={
                activePhase === "processing"
                  ? isSelect
                    ? "#83B69A"
                    : "#D88762"
                  : isResponseActive
                  ? "#83B69A"
                  : "#454A54"
              }
              strokeWidth="1.5"
              transform={activePhase === "processing" ? "rotate(90 510 204)" : "rotate(45 510 204)"}
              className="transition-all duration-300"
            />

            {/* Flange Couplings at Vertices */}
            <circle cx="410" cy="204" r="5.5" fill="#121416" stroke="#F1F0EC" strokeWidth="1.8" />
            <circle
              cx="410"
              cy="204"
              r="2.5"
              fill={activePhase === "outgoing" || activePhase === "processing" ? "#D88762" : "#45494B"}
              className="transition-colors duration-300"
            />

            <circle cx="610" cy="204" r="5.5" fill="#121416" stroke="#F1F0EC" strokeWidth="1.8" />
            <circle
              cx="610"
              cy="204"
              r="2.5"
              fill={isResponseActive ? "#83B69A" : "#45494B"}
              className="transition-colors duration-300"
            />

            {/* =========================================================
                DATABASE TELEMETRY SEQUENCE (Docked Directly Beneath)
                ========================================================= */}
            <g id="db-telemetry-sequence">
              {/* Step 1: Query planned */}
              <g>
                <circle
                  cx="410"
                  cy="300"
                  r="3"
                  fill="#121416"
                  stroke={activePhase === "setup" ? "#45494B" : "#83B69A"}
                  strokeWidth="1.6"
                />
                <text x="424" y="304" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#F1F0EC">
                  Query planned &amp; optimized
                </text>
                <text x="610" y="304" textAnchor="end" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#A6AAA9">
                  0.3ms
                </text>
              </g>

              {/* Step 2: Storage access / mutation */}
              <g>
                <circle
                  cx="410"
                  cy="322"
                  r="3"
                  fill={activePhase === "processing" ? (isSelect ? "#83B69A" : "#D88762") : isResponseActive ? "#83B69A" : "#121416"}
                  stroke={activePhase === "processing" ? (isSelect ? "#83B69A" : "#D88762") : isResponseActive ? "#83B69A" : "#45494B"}
                  strokeWidth="1.6"
                  className="transition-colors duration-300"
                />
                <text x="424" y="326" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#F1F0EC">
                  {isSelect ? "B-tree index scan on deployed_at" : "WAL log flush &amp; row mutation"}
                </text>
                <text
                  x="610"
                  y="326"
                  textAnchor="end"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="11"
                  fill={activePhase === "processing" ? (isSelect ? "#83B69A" : "#D88762") : isResponseActive ? "#83B69A" : "#A6AAA9"}
                  className="transition-colors duration-300"
                >
                  {isSelect ? "0.8ms" : "1.4ms"}
                </text>
              </g>

              {/* Step 3: Result serialized */}
              <g>
                <circle
                  cx="410"
                  cy="344"
                  r="3"
                  fill="#121416"
                  stroke={isResponseActive ? "#83B69A" : "#45494B"}
                  strokeWidth="1.6"
                  className="transition-colors duration-300"
                />
                <text x="424" y="348" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#F1F0EC">
                  {isSelect ? "3 matching tuples materialized" : "1 row updated &amp; returned"}
                </text>
                <text x="610" y="348" textAnchor="end" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#A6AAA9">
                  0.2ms
                </text>
              </g>
            </g>
          </g>

          {/* =============================================================
              STAGE 03: QUERY RESULTS (Right Section)
              Zero Slate Card · Structured Record Table · Intake Flange
              ============================================================= */}
          <g id="scene-results">
            {/* Stage Identifier */}
            <text
              x="730"
              y="62"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="11"
              fill="#83B69A"
              letterSpacing="0.12em"
              fontWeight="500"
            >
              03 / QUERY RESULTS
            </text>

            {/* Metric / Status Header */}
            {isResponseActive ? (
              <g>
                <circle cx="735" cy="88" r="3.5" fill="#83B69A" />
                <text
                  x="748"
                  y="96"
                  fontFamily="var(--font-space-grotesk), sans-serif"
                  fontSize="22"
                  fontWeight="600"
                  fill="#83B69A"
                  letterSpacing="-0.02em"
                >
                  {isSelect ? "3 rows returned" : "1 row updated"}
                </text>
                <text
                  x="730"
                  y="122"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="12"
                  fill="#777D7D"
                >
                  {isSelect ? "Query resolved in 0.6ms" : "Tuple updated in 0.8ms · WAL synced"}
                </text>
              </g>
            ) : (
              <g>
                <text
                  x="730"
                  y="96"
                  fontFamily="var(--font-space-grotesk), sans-serif"
                  fontSize="22"
                  fontWeight="500"
                  fill="#555A64"
                  letterSpacing="-0.02em"
                >
                  Query destination
                </text>
                <text
                  x="730"
                  y="122"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontSize="12"
                  fill="#444852"
                >
                  Waiting for query execution...
                </text>
              </g>
            )}

            {/* Results Table (Readable, Compact, Pure Typography with Dividers) */}
            {!isResponseActive ? (
              <text
                x="730"
                y="156"
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="11.5"
                fill="#3E424B"
              >
                Waiting for record stream...
              </text>
            ) : isSelect ? (
              <g id="table-select-results">
                {/* Column Headers */}
                <text x="730" y="152" fill="#717682" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fontWeight="600">id</text>
                <text x="800" y="152" fill="#717682" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fontWeight="600">slug</text>
                <text x="920" y="152" fill="#717682" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fontWeight="600">status</text>
                <line x1="730" y1="160" x2="980" y2="160" stroke="#25282F" strokeWidth="1" />

                {/* Row 1 */}
                <g style={{ animation: "rowFadeIn 0.25s ease-out 0.05s both" }}>
                  <text x="730" y="178" fill="#F1F0EC" fontFamily="var(--font-geist-mono), monospace" fontSize="11.5">rel_024</text>
                  <text x="800" y="178" fill="#A6AAA9" fontFamily="var(--font-geist-mono), monospace" fontSize="11.5">v2.4-production</text>
                  <text x="920" y="178" fill="#83B69A" fontFamily="var(--font-geist-mono), monospace" fontSize="11.5">published</text>
                </g>

                {/* Row 2 */}
                <g style={{ animation: "rowFadeIn 0.25s ease-out 0.16s both" }}>
                  <text x="730" y="198" fill="#F1F0EC" fontFamily="var(--font-geist-mono), monospace" fontSize="11.5">rel_023</text>
                  <text x="800" y="198" fill="#A6AAA9" fontFamily="var(--font-geist-mono), monospace" fontSize="11.5">v2.3-stable</text>
                  <text x="920" y="198" fill="#83B69A" fontFamily="var(--font-geist-mono), monospace" fontSize="11.5">published</text>
                </g>

                {/* Row 3 */}
                <g style={{ animation: "rowFadeIn 0.25s ease-out 0.27s both" }}>
                  <text x="730" y="218" fill="#F1F0EC" fontFamily="var(--font-geist-mono), monospace" fontSize="11.5">rel_022</text>
                  <text x="800" y="218" fill="#A6AAA9" fontFamily="var(--font-geist-mono), monospace" fontSize="11.5">v2.2-production</text>
                  <text x="920" y="218" fill="#83B69A" fontFamily="var(--font-geist-mono), monospace" fontSize="11.5">published</text>
                </g>

                <line x1="730" y1="228" x2="980" y2="228" stroke="#1F2228" strokeWidth="1" />
                <text x="730" y="246" fill="#6A6F7C" fontFamily="var(--font-geist-mono), monospace" fontSize="11">
                  ● 3 rows in set (0.6ms)
                </text>
              </g>
            ) : (
              <g id="table-update-results">
                {/* Column Headers */}
                <text x="730" y="152" fill="#717682" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fontWeight="600">id</text>
                <text x="830" y="152" fill="#717682" fontFamily="var(--font-geist-mono), monospace" fontSize="11" fontWeight="600">status</text>
                <line x1="730" y1="160" x2="980" y2="160" stroke="#25282F" strokeWidth="1" />

                {/* Updated Row */}
                <g style={{ animation: "rowFadeIn 0.25s ease-out 0.08s both" }}>
                  <text x="730" y="180" fill="#F1F0EC" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fontWeight="500">rel_024</text>
                  <text x="830" y="180" fill="#83B69A" fontFamily="var(--font-geist-mono), monospace" fontSize="12" fontWeight="500">published</text>
                </g>

                <line x1="730" y1="200" x2="980" y2="200" stroke="#1F2228" strokeWidth="1" />
                <text x="730" y="222" fill="#83B69A" fontFamily="var(--font-geist-mono), monospace" fontSize="11.5" fontWeight="600">
                  ✔ 1 row updated in 0.8ms
                </text>
                <text x="730" y="242" fill="#6A6F7C" fontFamily="var(--font-geist-mono), monospace" fontSize="11">
                  WAL flush verified · Commit confirmed
                </text>
              </g>
            )}

            {/* Destination Intake Flange at Vertex (730, 204) */}
            <circle
              cx="730"
              cy="204"
              r="5.5"
              fill="#121416"
              stroke={isResponseActive ? "#83B69A" : "#45494B"}
              strokeWidth="1.8"
            />
            <circle
              cx="730"
              cy="204"
              r="2.5"
              fill={isResponseActive ? "#83B69A" : "#383B42"}
            />
          </g>
        </svg>
      </div>

      {/* =================================================================
          MOBILE COMPOSITION (< md): Coordinated Vertical Architecture
          Continuous vertical query pipeline with crisp legibility
          viewBox="0 0 360 410"
          ================================================================= */}
      <div className="flex md:hidden w-full h-full items-center justify-center">
        <svg
          className="w-full h-full max-h-[380px] overflow-visible"
          viewBox="0 0 360 410"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
        >
          {/* Top Query Section */}
          <g id="mobile-query-section">
            <text x="24" y="24" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#D88762" letterSpacing="0.12em">
              01 / SQL QUERY
            </text>
            <text x="24" y="48" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="17" fontWeight="600" fill="#F1F0EC">
              <tspan fill="#D88762">{isSelect ? "SELECT" : "UPDATE"}</tspan>
              <tspan fill="#F1F0EC" dx="6">releases</tspan>
            </text>
            <text x="24" y="68" fontFamily="var(--font-geist-mono), monospace" fontSize="10.5" fill="#777D7D">
              {isSelect ? "SELECT id, slug, status FROM releases LIMIT 3;" : "UPDATE releases SET status = 'published';"}
            </text>
            <circle cx="180" cy="85" r="4.5" fill="#121416" stroke="#F1F0EC" strokeWidth="1.6" />
            <circle cx="180" cy="85" r="2" fill="#D88762" />
          </g>

          {/* Top Conduit Line */}
          <path d="M 180,85 C 180,105 180,115 180,135" stroke="#3D4245" strokeWidth="1.2" strokeDasharray="3 3" fill="none" />
          <path d="M 180,85 C 180,105 180,115 180,135" stroke="#D88762" strokeWidth="2" strokeLinecap="round" fill="none" opacity={activePhase === "outgoing" ? 1 : 0.4} />
          {activePhase === "outgoing" && (
            <circle cx="180" cy="110" r="3.5" fill="#D88762" />
          )}

          {/* Center Storage Engine */}
          <g id="mobile-center-engine" transform="translate(0, 135)">
            <text x="180" y="16" textAnchor="middle" fontFamily="var(--font-geist-mono), monospace" fontSize="9.5" fill="#D88762" letterSpacing="0.1em">
              02 / ENGINE · POSTGRESQL 16
            </text>

            {/* Storage Tiers */}
            <rect x="70" y="28" width="220" height="18" rx="3" fill="url(#db-tier-top)" stroke="#32363D" strokeWidth="1" />
            <rect
              x="60"
              y="52"
              width="240"
              height="26"
              rx="3"
              fill="url(#db-tier-mid)"
              stroke={activePhase === "processing" ? "#D88762" : isResponseActive ? "#83B69A" : "#F1F0EC"}
              strokeWidth="1.4"
            />
            <rect x="70" y="84" width="220" height="18" rx="3" fill="url(#db-tier-bot)" stroke="#32363D" strokeWidth="1" />

            <circle cx="180" cy="65" r="4" fill={activePhase === "processing" ? (isSelect ? "#83B69A" : "#D88762") : isResponseActive ? "#83B69A" : "#1C1F24"} />

            <text x="180" y="122" textAnchor="middle" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill={activePhase === "processing" ? "#D88762" : isResponseActive ? "#83B69A" : "#777D7D"}>
              {activePhase === "processing" ? (isSelect ? "● Index scan running..." : "● Mutating row in WAL...") : isResponseActive ? "● 0.6ms execution verified" : "○ Engine ready"}
            </text>
          </g>

          {/* Bottom Conduit Line */}
          <path d="M 180,270 C 180,290 180,300 180,315" stroke="#3D4245" strokeWidth="1.2" strokeDasharray="3 3" fill="none" />
          <path d="M 180,270 C 180,290 180,300 180,315" stroke="#83B69A" strokeWidth="2" strokeLinecap="round" fill="none" opacity={isResponseActive ? 1 : 0.3} />
          {activePhase === "returning" && (
            <circle cx="180" cy="295" r="3.5" fill="#83B69A" />
          )}

          {/* Bottom Results Section */}
          <g id="mobile-results-section" transform="translate(0, 315)">
            <circle cx="180" cy="0" r="4.5" fill="#121416" stroke={isResponseActive ? "#83B69A" : "#45494B"} strokeWidth="1.6" />
            <circle cx="180" cy="0" r="2" fill={isResponseActive ? "#83B69A" : "#383B42"} />

            <text x="24" y="24" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#83B69A" letterSpacing="0.12em">
              03 / RESULTS
            </text>
            <text x="24" y="48" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="17" fontWeight="600" fill={isResponseActive ? "#83B69A" : "#555A64"}>
              {isResponseActive ? (isSelect ? "3 rows returned" : "1 row updated") : "Awaiting results..."}
            </text>

            {isResponseActive ? (
              isSelect ? (
                <text x="24" y="70" fontFamily="var(--font-geist-mono), monospace" fontSize="10.5" fill="#A6AAA9">
                  rel_024 · v2.4-production · published
                </text>
              ) : (
                <text x="24" y="70" fontFamily="var(--font-geist-mono), monospace" fontSize="10.5" fill="#83B69A">
                  rel_024 · published (1 row updated)
                </text>
              )
            ) : (
              <text x="24" y="70" fontFamily="var(--font-geist-mono), monospace" fontSize="10.5" fill="#444852">
                Waiting for record stream...
              </text>
            )}
          </g>
        </svg>
      </div>
    </div>
  );
}

export default DatabaseServicePlayground;
