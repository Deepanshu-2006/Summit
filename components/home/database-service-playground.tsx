"use client";

import React, { useState, useEffect, useRef } from "react";

type QueryType = "SELECT" | "UPDATE";

type LifecyclePhase =
  | "query_activation" // 500ms: Query becomes active, WHERE clause highlighted in burnt orange, index activated
  | "index_lookup"     // 800ms: B-tree index searches for matching records, signal travels along connections
  | "record_matching"  // 700ms: Relevant storage page slots highlight in original positions (sage green / write pulse)
  | "retrieval"        // 900ms: Records projected to result area, rows revealed progressively
  | "completed";       // 2200ms: "3 matching records" or "1 record updated" held for reading before smooth transition

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
  const [phase, setPhase] = useState<LifecyclePhase>("query_activation");
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

  // Coordinated animation state machine
  useEffect(() => {
    if (isReducedMotion || !isInViewport) {
      return;
    }

    let timeoutId: NodeJS.Timeout;

    switch (phase) {
      case "query_activation":
        timeoutId = setTimeout(() => setPhase("index_lookup"), 600);
        break;
      case "index_lookup":
        timeoutId = setTimeout(() => setPhase("record_matching"), 850);
        break;
      case "record_matching":
        timeoutId = setTimeout(() => setPhase("retrieval"), 750);
        break;
      case "retrieval":
        timeoutId = setTimeout(() => setPhase("completed"), 950);
        break;
      case "completed":
        // Hold completed state, then smoothly cycle between SELECT and UPDATE
        timeoutId = setTimeout(() => {
          setQueryType((prev) => (prev === "SELECT" ? "UPDATE" : "SELECT"));
          setPhase("query_activation");
        }, 2200);
        break;
    }

    return () => clearTimeout(timeoutId);
  }, [phase, isReducedMotion, isInViewport]);

  const activePhase: LifecyclePhase = isReducedMotion ? "completed" : phase;
  const isSelect = queryType === "SELECT";

  // Phase flags
  const isQueryActive = activePhase !== "completed";
  const isIndexLookup =
    activePhase === "index_lookup" ||
    activePhase === "record_matching" ||
    activePhase === "retrieval" ||
    activePhase === "completed";
  const isRecordsMatched =
    activePhase === "record_matching" ||
    activePhase === "retrieval" ||
    activePhase === "completed";
  const isRetrieving =
    activePhase === "retrieval" || activePhase === "completed";
  const isCompleted = activePhase === "completed";

  // Progressive row reveals in Results
  const isRow1Visible = isRetrieving;
  const isRow2Visible = isSelect && (activePhase === "retrieval" ? true : isCompleted);
  const isRow3Visible = isSelect && isCompleted;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col justify-between select-none overflow-hidden"
    >
      {/* =================================================================
          AREA 1: UPPER AREA — COMPACT SQL QUERY & PLAN METADATA
          No large editor card or fake IDE frame. Clean Geist Mono query.
          ================================================================= */}
      <div className="flex items-start justify-between gap-4 pb-2 shrink-0">
        {/* Left: Compact SQL Query with active WHERE condition */}
        <div className="font-mono text-[11px] leading-[1.38] tracking-tight">
          {isSelect ? (
            <div className="space-y-0.5">
              <div className="text-text-muted">
                <span className="text-[#A3A3A3] font-medium">SELECT</span>{" "}
                <span className="text-[#E5E5E5]">id, slug, status</span>
              </div>
              <div className="text-text-muted">
                <span className="text-[#A3A3A3] font-medium">FROM</span>{" "}
                <span className="text-[#E5E5E5]">releases</span>
              </div>
              <div
                className={`transition-all duration-300 inline-block px-1 -mx-1 rounded ${
                  isQueryActive
                    ? "bg-accent-orange/15 text-accent-orange font-medium"
                    : "text-text-muted"
                }`}
              >
                <span className={isQueryActive ? "text-accent-orange" : "text-[#A3A3A3]"}>
                  WHERE
                </span>{" "}
                <span className={isQueryActive ? "text-[#F1F0EC]" : "text-[#E5E5E5]"}>
                  status = &apos;published&apos;
                </span>
              </div>
              <div className="text-text-muted">
                <span className="text-[#A3A3A3] font-medium">ORDER BY</span>{" "}
                <span className="text-[#E5E5E5]">deployed_at</span>{" "}
                <span className="text-[#A3A3A3] font-medium">DESC</span>{" "}
                <span className="text-[#A3A3A3] font-medium">LIMIT</span>{" "}
                <span className="text-[#E5E5E5]">3</span>;
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="text-text-muted">
                <span className="text-[#A3A3A3] font-medium">UPDATE</span>{" "}
                <span className="text-[#E5E5E5]">releases</span>
              </div>
              <div className="text-text-muted">
                <span className="text-[#A3A3A3] font-medium">SET</span>{" "}
                <span className="text-[#E5E5E5]">status = &apos;published&apos;</span>
              </div>
              <div
                className={`transition-all duration-300 inline-block px-1 -mx-1 rounded ${
                  isQueryActive
                    ? "bg-accent-orange/15 text-accent-orange font-medium"
                    : "text-text-muted"
                }`}
              >
                <span className={isQueryActive ? "text-accent-orange" : "text-[#A3A3A3]"}>
                  WHERE
                </span>{" "}
                <span className={isQueryActive ? "text-[#F1F0EC]" : "text-[#E5E5E5]"}>
                  id = &apos;rel_024&apos;
                </span>
              </div>
              <div className="text-text-muted">
                <span className="text-[#A3A3A3] font-medium">RETURNING</span>{" "}
                <span className="text-[#E5E5E5]">id, status</span>;
              </div>
            </div>
          )}
        </div>

        {/* Right: Restrained PostgreSQL Storage & Access Plan Info */}
        <div className="hidden sm:flex flex-col items-end font-mono text-[10px] text-text-muted leading-tight shrink-0 pt-0.5">
          <div className="flex items-center gap-1.5 text-text-secondary font-medium">
            <span
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                isIndexLookup ? "bg-accent-orange" : "bg-text-muted/40"
              }`}
            />
            <span className="text-[#F1F0EC]">
              {isSelect ? "idx_releases_status" : "releases_pkey"}
            </span>
            <span className="text-border-default">·</span>
            <span className="text-text-muted font-normal">B-Tree</span>
          </div>
          <div className="text-[9.5px] text-text-muted mt-1">
            {isSelect
              ? "Storage pages: Heap 8KB · Filter: status = 'published'"
              : "Point lookup: Heap 8KB · Tuple slot update"}
          </div>
        </div>
      </div>

      {/* =================================================================
          AREA 2: CENTRAL AREA — THE INDEXED STORAGE FIELD (HERO SVG)
          Architectural drawing of database storage pages and indexed records.
          No chips, no central diamonds, no horizontal pipes.
          ================================================================= */}
      <div className="flex-1 w-full min-h-0 my-1 relative flex items-center justify-center overflow-hidden">
        <svg
          viewBox="0 0 940 210"
          className="w-full h-full max-h-[220px] select-none"
          preserveAspectRatio="xMidYMid meet"
          aria-label="Database indexed storage pages illustration"
        >
          <defs>
            {/* Subtle glow filter for active index key and matching records */}
            <filter id="accent-pulse" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#D96B27" floodOpacity="0.4" />
            </filter>
            <filter id="sage-match-glow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#4EAA7A" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* -------------------------------------------------------------
              PART A: B-TREE INDEX STRUCTURE (Left Region, X: 15 to 220)
              ------------------------------------------------------------- */}
          <g id="index-structure">
            {/* Index Section Title */}
            <text
              x="20"
              y="18"
              fill="#7A7D82"
              fontSize="9"
              fontFamily="monospace"
              letterSpacing="0.08em"
            >
              {isSelect ? "INDEX: idx_releases_status" : "INDEX: releases_pkey"}
            </text>

            {/* Root Node */}
            <rect
              x="45"
              y="28"
              width="130"
              height="22"
              rx="2"
              fill="#141517"
              stroke={isIndexLookup ? "#D96B27" : "#2A2C30"}
              strokeWidth={isIndexLookup ? "1.2" : "1"}
              className="transition-colors duration-300"
            />
            <text
              x="110"
              y="42"
              fill={isIndexLookup ? "#F1F0EC" : "#8A8D93"}
              fontSize="8.5"
              fontFamily="monospace"
              textAnchor="middle"
              className="transition-colors duration-300"
            >
              ROOT [PAGE 0x00]
            </text>

            {/* Tree Branch Lines from Root to Leaf Keys */}
            <path
              d="M 110 50 L 60 76"
              fill="none"
              stroke={isIndexLookup ? "#D96B27" : "#26282B"}
              strokeWidth="1"
              strokeDasharray={isIndexLookup ? "none" : "2 2"}
              className="transition-colors duration-300"
            />
            <path
              d="M 110 50 L 150 76"
              fill="none"
              stroke={isIndexLookup ? "#D96B27" : "#26282B"}
              strokeWidth="1"
              strokeDasharray={isIndexLookup ? "none" : "2 2"}
              className="transition-colors duration-300"
            />

            {/* Leaf Key 1 (Inactive) */}
            <rect
              x="20"
              y="76"
              width="170"
              height="20"
              rx="2"
              fill="#121315"
              stroke="#222427"
              strokeWidth="1"
            />
            <text
              x="28"
              y="89"
              fill="#52555A"
              fontSize="8"
              fontFamily="monospace"
            >
              {isSelect ? "KEY: 'draft' (6 ptrs)" : "KEY: 'rel_020' (ptrs)"}
            </text>

            {/* Leaf Key 2 (ACTIVE TARGET KEY!) */}
            <rect
              x="20"
              y="102"
              width="170"
              height="26"
              rx="2"
              fill={isIndexLookup ? "#1A1613" : "#121315"}
              stroke={isIndexLookup ? "#D96B27" : "#282A2E"}
              strokeWidth={isIndexLookup ? "1.5" : "1"}
              filter={isIndexLookup ? "url(#accent-pulse)" : undefined}
              className="transition-all duration-300"
            />
            <text
              x="28"
              y="118"
              fill={isIndexLookup ? "#F1F0EC" : "#7A7D82"}
              fontSize="8.5"
              fontFamily="monospace"
              fontWeight={isIndexLookup ? "bold" : "normal"}
              className="transition-colors duration-300"
            >
              {isSelect ? "KEY: 'published'" : "KEY: 'rel_024'"}
            </text>
            <text
              x="180"
              y="118"
              fill={isIndexLookup ? "#D96B27" : "#4A4D52"}
              fontSize="8"
              fontFamily="monospace"
              textAnchor="end"
              fontWeight="medium"
            >
              {isSelect ? "[3 TUPLES]" : "[PAGE 0x01]"}
            </text>

            {/* Leaf Key 3 (Inactive) */}
            <rect
              x="20"
              y="134"
              width="170"
              height="20"
              rx="2"
              fill="#121315"
              stroke="#222427"
              strokeWidth="1"
            />
            <text
              x="28"
              y="147"
              fill="#52555A"
              fontSize="8"
              fontFamily="monospace"
            >
              {isSelect ? "KEY: 'archived' (2 ptrs)" : "KEY: 'rel_028' (ptrs)"}
            </text>

            {/* Connection Node / Output Port from Target Leaf */}
            <circle
              cx="190"
              cy="115"
              r="3.5"
              fill={isIndexLookup ? "#D96B27" : "#282A2E"}
              className="transition-colors duration-300"
            />
          </g>

          {/* -------------------------------------------------------------
              PART B: FINE CONNECTION PATHS FROM INDEX TO STORAGE SLOTS
              Architectural vector bus traces with precise right-angle routing.
              ------------------------------------------------------------- */}
          <g id="index-connections">
            {/* Connection 1: Index Leaf -> Page 1, Slot 1 (rel_024) */}
            <path
              d="M 193 115 H 220 V 49 H 465"
              fill="none"
              stroke={
                isIndexLookup
                  ? (isSelect && isRecordsMatched ? "#3B7E58" : "#D96B27")
                  : "#222427"
              }
              strokeWidth={isIndexLookup ? "1.5" : "1"}
              strokeDasharray={isIndexLookup ? "none" : "2 2"}
              className="transition-colors duration-300"
            />
            {/* Directional terminal tick into slot 1 */}
            <circle
              cx="465"
              cy="49"
              r="2.5"
              fill={
                isIndexLookup
                  ? (isSelect && isRecordsMatched ? "#4EAA7A" : "#D96B27")
                  : "#25272B"
              }
            />

            {/* Connection 2 (SELECT only): Index Leaf -> Page 2, Slot 0 (rel_023) */}
            {isSelect && (
              <>
                <path
                  d="M 193 115 H 235 V 109 H 325"
                  fill="none"
                  stroke={
                    isIndexLookup
                      ? (isRecordsMatched ? "#3B7E58" : "#D96B27")
                      : "#222427"
                  }
                  strokeWidth={isIndexLookup ? "1.5" : "1"}
                  strokeDasharray={isIndexLookup ? "none" : "2 2"}
                  className="transition-colors duration-300"
                />
                <circle
                  cx="325"
                  cy="109"
                  r="2.5"
                  fill={isIndexLookup ? (isRecordsMatched ? "#4EAA7A" : "#D96B27") : "#25272B"}
                />
              </>
            )}

            {/* Connection 3 (SELECT only): Index Leaf -> Page 3, Slot 2 (rel_022) */}
            {isSelect && (
              <>
                <path
                  d="M 193 115 H 220 V 169 H 605"
                  fill="none"
                  stroke={
                    isIndexLookup
                      ? (isRecordsMatched ? "#3B7E58" : "#D96B27")
                      : "#222427"
                  }
                  strokeWidth={isIndexLookup ? "1.5" : "1"}
                  strokeDasharray={isIndexLookup ? "none" : "2 2"}
                  className="transition-colors duration-300"
                />
                <circle
                  cx="605"
                  cy="169"
                  r="2.5"
                  fill={isIndexLookup ? (isRecordsMatched ? "#4EAA7A" : "#D96B27") : "#25272B"}
                />
              </>
            )}
          </g>

          {/* -------------------------------------------------------------
              PART C: POSTGRESQL HEAP STORAGE PAGES (Right Region, X: 245 to 925)
              Three horizontal 8KB storage pages containing structured record slots.
              ------------------------------------------------------------- */}
          <g id="storage-field">
            {/* Storage Header Label */}
            <text
              x="250"
              y="18"
              fill="#7A7D82"
              fontSize="9"
              fontFamily="monospace"
              letterSpacing="0.08em"
            >
              STORAGE: releases (HEAP 8KB PAGES)
            </text>

            {/* =========================================================
                PAGE 1: Heap Page 0x01 (Offset 0x0000)
                Contains MATCH #1 (rel_024) in Slot 1
                ========================================================= */}
            <g id="page-0x01">
              {/* Outer Page Container */}
              <rect
                x="250"
                y="26"
                width="675"
                height="46"
                rx="3"
                fill="#101113"
                stroke="#202225"
                strokeWidth="1"
              />

              {/* Page Header Tab */}
              <rect
                x="250"
                y="26"
                width="70"
                height="46"
                fill="#131417"
                stroke="#202225"
                strokeWidth="1"
                rx="3"
              />
              <text
                x="258"
                y="43"
                fill="#A0A3A8"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                PAGE 0x01
              </text>
              <text
                x="258"
                y="58"
                fill="#55585E"
                fontSize="7.5"
                fontFamily="monospace"
              >
                LSN 0/1A · 8KB
              </text>

              {/* Slot 0: rel_018 (Inactive) */}
              <rect
                x="326"
                y="30"
                width="134"
                height="38"
                rx="2"
                fill="#131416"
                stroke="#1E2023"
                strokeWidth="1"
              />
              <text x="333" y="44" fill="#4E5157" fontSize="8" fontFamily="monospace">
                [0] rel_018
              </text>
              <text x="333" y="58" fill="#3D4045" fontSize="7.5" fontFamily="monospace">
                draft · v2.1.8
              </text>

              {/* Slot 1: rel_024 (TARGET / MATCH RECORD!) */}
              <rect
                x="466"
                y="30"
                width="134"
                height="38"
                rx="2"
                fill={
                  isRecordsMatched
                    ? (isSelect ? "#112117" : "#1B1713")
                    : "#131416"
                }
                stroke={
                  isRecordsMatched
                    ? (isSelect ? "#3B7E58" : "#D96B27")
                    : isIndexLookup ? "#D96B27" : "#1E2023"
                }
                strokeWidth={isRecordsMatched ? "1.5" : "1"}
                filter={isRecordsMatched && isSelect ? "url(#sage-match-glow)" : undefined}
                className="transition-all duration-300"
              />
              <text
                x="473"
                y="44"
                fill={isRecordsMatched ? "#F1F0EC" : "#7A7D82"}
                fontSize="8.5"
                fontFamily="monospace"
                fontWeight={isRecordsMatched ? "bold" : "normal"}
                className="transition-colors duration-300"
              >
                [1] rel_024
              </text>
              <text
                x="473"
                y="58"
                fill={
                  isRecordsMatched
                    ? (isSelect
                        ? "#4EAA7A"
                        : (activePhase === "completed" ? "#4EAA7A" : "#D96B27"))
                    : "#4E5157"
                }
                fontSize="7.5"
                fontFamily="monospace"
                fontWeight="medium"
                className="transition-colors duration-300"
              >
                {isSelect
                  ? "● published · v2.4-prod"
                  : (activePhase === "completed"
                      ? "✔ published (updated)"
                      : "● writing: draft → pub")}
              </text>
              {isRecordsMatched && (
                <text
                  x="594"
                  y="43"
                  fill={isSelect ? "#4EAA7A" : "#D96B27"}
                  fontSize="7.5"
                  fontFamily="monospace"
                  textAnchor="end"
                  fontWeight="bold"
                >
                  {isSelect ? "MATCH" : "WRITE"}
                </text>
              )}

              {/* Slot 2: rel_011 (Inactive) */}
              <rect
                x="606"
                y="30"
                width="134"
                height="38"
                rx="2"
                fill="#131416"
                stroke="#1E2023"
                strokeWidth="1"
              />
              <text x="613" y="44" fill="#4E5157" fontSize="8" fontFamily="monospace">
                [2] rel_011
              </text>
              <text x="613" y="58" fill="#3D4045" fontSize="7.5" fontFamily="monospace">
                archived · v1.9.0
              </text>

              {/* Slot 3: rel_019 (Inactive) */}
              <rect
                x="746"
                y="30"
                width="173"
                height="38"
                rx="2"
                fill="#131416"
                stroke="#1E2023"
                strokeWidth="1"
              />
              <text x="753" y="44" fill="#4E5157" fontSize="8" fontFamily="monospace">
                [3] rel_019
              </text>
              <text x="753" y="58" fill="#3D4045" fontSize="7.5" fontFamily="monospace">
                draft · v2.2.0-rc1
              </text>
            </g>

            {/* =========================================================
                PAGE 2: Heap Page 0x02 (Offset 0x2000)
                Contains MATCH #2 (rel_023) in Slot 0 for SELECT
                ========================================================= */}
            <g id="page-0x02">
              <rect
                x="250"
                y="80"
                width="675"
                height="46"
                rx="3"
                fill="#101113"
                stroke="#202225"
                strokeWidth="1"
              />

              {/* Page Header Tab */}
              <rect
                x="250"
                y="80"
                width="70"
                height="46"
                fill="#131417"
                stroke="#202225"
                strokeWidth="1"
                rx="3"
              />
              <text
                x="258"
                y="97"
                fill="#A0A3A8"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                PAGE 0x02
              </text>
              <text
                x="258"
                y="112"
                fill="#55585E"
                fontSize="7.5"
                fontFamily="monospace"
              >
                LSN 0/1B · 8KB
              </text>

              {/* Slot 0: rel_023 (MATCH RECORD #2 for SELECT) */}
              <rect
                x="326"
                y="84"
                width="134"
                height="38"
                rx="2"
                fill={isSelect && isRecordsMatched ? "#112117" : "#131416"}
                stroke={
                  isSelect && isRecordsMatched
                    ? "#3B7E58"
                    : isSelect && isIndexLookup ? "#D96B27" : "#1E2023"
                }
                strokeWidth={isSelect && isRecordsMatched ? "1.5" : "1"}
                filter={isSelect && isRecordsMatched ? "url(#sage-match-glow)" : undefined}
                className="transition-all duration-300"
              />
              <text
                x="333"
                y="98"
                fill={isSelect && isRecordsMatched ? "#F1F0EC" : "#7A7D82"}
                fontSize="8.5"
                fontFamily="monospace"
                fontWeight={isSelect && isRecordsMatched ? "bold" : "normal"}
                className="transition-colors duration-300"
              >
                [0] rel_023
              </text>
              <text
                x="333"
                y="112"
                fill={isSelect && isRecordsMatched ? "#4EAA7A" : "#4E5157"}
                fontSize="7.5"
                fontFamily="monospace"
                fontWeight="medium"
                className="transition-colors duration-300"
              >
                {isSelect && isRecordsMatched ? "● published · v2.3-stable" : "draft · v2.3-dev"}
              </text>
              {isSelect && isRecordsMatched && (
                <text
                  x="454"
                  y="97"
                  fill="#4EAA7A"
                  fontSize="7.5"
                  fontFamily="monospace"
                  textAnchor="end"
                  fontWeight="bold"
                >
                  MATCH
                </text>
              )}

              {/* Slot 1: rel_015 (Inactive) */}
              <rect
                x="466"
                y="84"
                width="134"
                height="38"
                rx="2"
                fill="#131416"
                stroke="#1E2023"
                strokeWidth="1"
              />
              <text x="473" y="98" fill="#4E5157" fontSize="8" fontFamily="monospace">
                [1] rel_015
              </text>
              <text x="473" y="112" fill="#3D4045" fontSize="7.5" fontFamily="monospace">
                draft · v2.0.1
              </text>

              {/* Slot 2: rel_009 (Inactive) */}
              <rect
                x="606"
                y="84"
                width="134"
                height="38"
                rx="2"
                fill="#131416"
                stroke="#1E2023"
                strokeWidth="1"
              />
              <text x="613" y="98" fill="#4E5157" fontSize="8" fontFamily="monospace">
                [2] rel_009
              </text>
              <text x="613" y="112" fill="#3D4045" fontSize="7.5" fontFamily="monospace">
                archived · v1.8.4
              </text>

              {/* Slot 3: rel_014 (Inactive) */}
              <rect
                x="746"
                y="84"
                width="173"
                height="38"
                rx="2"
                fill="#131416"
                stroke="#1E2023"
                strokeWidth="1"
              />
              <text x="753" y="98" fill="#4E5157" fontSize="8" fontFamily="monospace">
                [3] rel_014
              </text>
              <text x="753" y="112" fill="#3D4045" fontSize="7.5" fontFamily="monospace">
                draft · v2.0.0-rc2
              </text>
            </g>

            {/* =========================================================
                PAGE 3: Heap Page 0x03 (Offset 0x4000)
                Contains MATCH #3 (rel_022) in Slot 2 for SELECT
                ========================================================= */}
            <g id="page-0x03">
              <rect
                x="250"
                y="134"
                width="675"
                height="46"
                rx="3"
                fill="#101113"
                stroke="#202225"
                strokeWidth="1"
              />

              {/* Page Header Tab */}
              <rect
                x="250"
                y="134"
                width="70"
                height="46"
                fill="#131417"
                stroke="#202225"
                strokeWidth="1"
                rx="3"
              />
              <text
                x="258"
                y="151"
                fill="#A0A3A8"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                PAGE 0x03
              </text>
              <text
                x="258"
                y="166"
                fill="#55585E"
                fontSize="7.5"
                fontFamily="monospace"
              >
                LSN 0/1C · 8KB
              </text>

              {/* Slot 0: rel_007 (Inactive) */}
              <rect
                x="326"
                y="138"
                width="134"
                height="38"
                rx="2"
                fill="#131416"
                stroke="#1E2023"
                strokeWidth="1"
              />
              <text x="333" y="152" fill="#4E5157" fontSize="8" fontFamily="monospace">
                [0] rel_007
              </text>
              <text x="333" y="166" fill="#3D4045" fontSize="7.5" fontFamily="monospace">
                archived · v1.7.2
              </text>

              {/* Slot 1: rel_016 (Inactive) */}
              <rect
                x="466"
                y="138"
                width="134"
                height="38"
                rx="2"
                fill="#131416"
                stroke="#1E2023"
                strokeWidth="1"
              />
              <text x="473" y="152" fill="#4E5157" fontSize="8" fontFamily="monospace">
                [1] rel_016
              </text>
              <text x="473" y="166" fill="#3D4045" fontSize="7.5" fontFamily="monospace">
                draft · v2.1.0-alpha
              </text>

              {/* Slot 2: rel_022 (MATCH RECORD #3 for SELECT) */}
              <rect
                x="606"
                y="138"
                width="134"
                height="38"
                rx="2"
                fill={isSelect && isRecordsMatched ? "#112117" : "#131416"}
                stroke={
                  isSelect && isRecordsMatched
                    ? "#3B7E58"
                    : isSelect && isIndexLookup ? "#D96B27" : "#1E2023"
                }
                strokeWidth={isSelect && isRecordsMatched ? "1.5" : "1"}
                filter={isSelect && isRecordsMatched ? "url(#sage-match-glow)" : undefined}
                className="transition-all duration-300"
              />
              <text
                x="613"
                y="152"
                fill={isSelect && isRecordsMatched ? "#F1F0EC" : "#7A7D82"}
                fontSize="8.5"
                fontFamily="monospace"
                fontWeight={isSelect && isRecordsMatched ? "bold" : "normal"}
                className="transition-colors duration-300"
              >
                [2] rel_022
              </text>
              <text
                x="613"
                y="166"
                fill={isSelect && isRecordsMatched ? "#4EAA7A" : "#4E5157"}
                fontSize="7.5"
                fontFamily="monospace"
                fontWeight="medium"
                className="transition-colors duration-300"
              >
                {isSelect && isRecordsMatched ? "● published · v2.2-prod" : "draft · v2.2-rc"}
              </text>
              {isSelect && isRecordsMatched && (
                <text
                  x="734"
                  y="151"
                  fill="#4EAA7A"
                  fontSize="7.5"
                  fontFamily="monospace"
                  textAnchor="end"
                  fontWeight="bold"
                >
                  MATCH
                </text>
              )}

              {/* Slot 3: rel_013 (Inactive) */}
              <rect
                x="746"
                y="138"
                width="173"
                height="38"
                rx="2"
                fill="#131416"
                stroke="#1E2023"
                strokeWidth="1"
              />
              <text x="753" y="152" fill="#4E5157" fontSize="8" fontFamily="monospace">
                [3] rel_013
              </text>
              <text x="753" y="166" fill="#3D4045" fontSize="7.5" fontFamily="monospace">
                draft · v1.9.8
              </text>
            </g>

            {/* Projection Indicators downward from Matching Slots */}
            {isRetrieving && (
              <g id="retrieval-projections" className="animate-in fade-in duration-300">
                {/* Pointer from Page 1, Slot 1 */}
                <path
                  d="M 533 68 V 195"
                  stroke="#3B7E58"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                  opacity="0.6"
                />
                {isSelect && (
                  <>
                    {/* Pointer from Page 2, Slot 0 */}
                    <path
                      d="M 393 122 V 195"
                      stroke="#3B7E58"
                      strokeWidth="1"
                      strokeDasharray="2 3"
                      opacity="0.6"
                    />
                    {/* Pointer from Page 3, Slot 2 */}
                    <path
                      d="M 673 176 V 195"
                      stroke="#3B7E58"
                      strokeWidth="1"
                      strokeDasharray="2 3"
                      opacity="0.6"
                    />
                  </>
                )}
              </g>
            )}
          </g>
        </svg>
      </div>

      {/* =================================================================
          AREA 3: LOWER AREA — EXECUTION STEPS & STRUCTURED RESULTS
          Compact execution summary alongside structured returned records.
          ================================================================= */}
      <div className="pt-2 border-t border-border-subtle/70 shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-6 items-center">
          {/* Left: Query Execution Steps (sm:col-span-5) */}
          <div className="sm:col-span-5 flex flex-col justify-center space-y-1.5 font-mono text-[10.5px]">
            {/* Step 1: Index Lookup */}
            <div className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  isRecordsMatched
                    ? "bg-semantic-success"
                    : isIndexLookup
                    ? "bg-accent-orange animate-pulse"
                    : "bg-[#2A2C30]"
                }`}
              />
              <span
                className={`transition-colors duration-300 ${
                  isIndexLookup ? "text-[#F1F0EC] font-medium" : "text-text-muted"
                }`}
              >
                1. Index lookup
              </span>
              <span className="text-text-muted/70 text-[9.5px] ml-auto">
                {isSelect ? "3 leaf pointers" : "1 tuple pointer"}
              </span>
            </div>

            {/* Step 2: Record Matching / Write */}
            <div className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  isRetrieving
                    ? "bg-semantic-success"
                    : isRecordsMatched
                    ? (isSelect ? "bg-semantic-success" : "bg-accent-orange animate-pulse")
                    : "bg-[#2A2C30]"
                }`}
              />
              <span
                className={`transition-colors duration-300 ${
                  isRecordsMatched ? "text-[#F1F0EC] font-medium" : "text-text-muted"
                }`}
              >
                {isSelect ? "2. 3 matching records" : "2. Targeted record update"}
              </span>
              <span className="text-text-muted/70 text-[9.5px] ml-auto">
                {isSelect ? "3 heap pages" : "page 0x01:slot 1"}
              </span>
            </div>

            {/* Step 3: Results Returned */}
            <div className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  isCompleted
                    ? "bg-semantic-success"
                    : isRetrieving
                    ? "bg-semantic-success animate-pulse"
                    : "bg-[#2A2C30]"
                }`}
              />
              <span
                className={`transition-colors duration-300 ${
                  isRetrieving ? "text-[#F1F0EC] font-medium" : "text-text-muted"
                }`}
              >
                3. Results returned
              </span>
              <span
                className={`text-[10px] ml-auto font-medium transition-opacity duration-300 ${
                  isCompleted ? "opacity-100 text-semantic-success" : "opacity-0"
                }`}
              >
                {isSelect ? "3 matching records" : "1 record updated"}
              </span>
            </div>
          </div>

          {/* Right: Structured Query Results Table (sm:col-span-7) */}
          <div className="sm:col-span-7 sm:border-l sm:border-border-subtle/70 sm:pl-5 flex flex-col justify-center">
            {/* Table Column Headers */}
            <div className="grid grid-cols-12 text-[9.5px] font-mono text-text-muted pb-1 border-b border-border-subtle/60 uppercase tracking-wider">
              <div className={isSelect ? "col-span-3" : "col-span-5"}>id</div>
              {isSelect && <div className="col-span-5">slug</div>}
              <div className={isSelect ? "col-span-4" : "col-span-7"}>status</div>
            </div>

            {/* Structured Rows (Fixed Height to Prevent Layout Shift) */}
            <div className="font-mono text-[11px] min-h-[58px] flex flex-col justify-center divide-y divide-border-subtle/30">
              {isSelect ? (
                <>
                  {/* Row 1 */}
                  <div
                    className={`grid grid-cols-12 py-0.5 items-center transition-all duration-300 ${
                      isRow1Visible
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 -translate-y-1"
                    }`}
                  >
                    <span className="col-span-3 text-[#F1F0EC] font-medium">rel_024</span>
                    <span className="col-span-5 text-text-secondary text-[10.5px]">v2.4-production</span>
                    <span className="col-span-4 text-semantic-success flex items-center gap-1 font-medium text-[10.5px]">
                      <span className="w-1 h-1 rounded-full bg-semantic-success" />
                      published
                    </span>
                  </div>

                  {/* Row 2 */}
                  <div
                    className={`grid grid-cols-12 py-0.5 items-center transition-all duration-300 ${
                      isRow2Visible
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 -translate-y-1"
                    }`}
                  >
                    <span className="col-span-3 text-[#F1F0EC] font-medium">rel_023</span>
                    <span className="col-span-5 text-text-secondary text-[10.5px]">v2.3-stable</span>
                    <span className="col-span-4 text-semantic-success flex items-center gap-1 font-medium text-[10.5px]">
                      <span className="w-1 h-1 rounded-full bg-semantic-success" />
                      published
                    </span>
                  </div>

                  {/* Row 3 */}
                  <div
                    className={`grid grid-cols-12 py-0.5 items-center transition-all duration-300 ${
                      isRow3Visible
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 -translate-y-1"
                    }`}
                  >
                    <span className="col-span-3 text-[#F1F0EC] font-medium">rel_022</span>
                    <span className="col-span-5 text-text-secondary text-[10.5px]">v2.2-production</span>
                    <span className="col-span-4 text-semantic-success flex items-center gap-1 font-medium text-[10.5px]">
                      <span className="w-1 h-1 rounded-full bg-semantic-success" />
                      published
                    </span>
                  </div>
                </>
              ) : (
                /* UPDATE Returned Row */
                <div
                  className={`grid grid-cols-12 py-2 items-center transition-all duration-300 ${
                    isRow1Visible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 -translate-y-1"
                  }`}
                >
                  <span className="col-span-5 text-[#F1F0EC] font-medium">rel_024</span>
                  <span className="col-span-7 text-semantic-success flex items-center gap-1.5 font-medium text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                    published
                    <span className="text-[10px] text-text-muted font-normal ml-1">
                      (1 row updated)
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
