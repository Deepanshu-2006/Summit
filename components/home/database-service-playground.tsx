"use client";

import React, { useState, useEffect, useRef } from "react";

type QueryType = "SELECT" | "UPDATE";

type LifecyclePhase =
  | "query_activation" // 450ms: Query condition highlighted in burnt orange
  | "index_lookup"     // 750ms: Index node activates, burnt-orange signal traces to matching storage slots
  | "record_matching"  // 700ms: Matching storage slots transition to sage green (or write pulse for UPDATE)
  | "retrieval"        // 900ms: Records projected to result area, rows reveal progressively
  | "completed";       // 2200ms: Hold completed state for reading before smooth transition

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
        timeoutId = setTimeout(() => setPhase("index_lookup"), 500);
        break;
      case "index_lookup":
        timeoutId = setTimeout(() => setPhase("record_matching"), 800);
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

  // Step completion flags
  const isIndexDone = isRecordsMatched;
  const isMatchingDone = isRetrieving;

  // Progressive row reveals in Results
  const isRow1Visible = isRetrieving || isCompleted;
  const isRow2Visible = isSelect && ((activePhase === "retrieval") || isCompleted);
  const isRow3Visible = isSelect && isCompleted;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col justify-between select-none overflow-hidden"
    >
      {/* =================================================================
          AREA 1: UPPER AREA — COMPACT TYPESET SQL QUERY & PLAN INFO
          Warm neutral palette: #E58A61 for keywords, #F0EEE9 for identifiers, #82B89D for strings.
          ================================================================= */}
      <div className="flex items-start justify-between gap-4 pb-1 shrink-0">
        {/* Left: Compact SQL Query */}
        <div className="font-mono text-[11px] leading-[1.4] tracking-tight">
          {isSelect ? (
            <div className="space-y-0.5">
              <div>
                <span className="text-[#E58A61] font-medium">SELECT</span>{" "}
                <span className="text-[#F0EEE9]">id, slug, status</span>
              </div>
              <div>
                <span className="text-[#E58A61] font-medium">FROM</span>{" "}
                <span className="text-[#F0EEE9]">releases</span>
              </div>
              <div
                className={`transition-all duration-300 inline-block px-1 -mx-1 rounded ${
                  isQueryActive
                    ? "bg-[#E58A61]/15 text-[#F0EEE9]"
                    : "text-[#A5A19A]"
                }`}
              >
                <span className="text-[#E58A61] font-medium">WHERE</span>{" "}
                <span className="text-[#F0EEE9]">status</span> ={" "}
                <span className="text-[#82B89D]">&apos;published&apos;</span>
              </div>
              <div>
                <span className="text-[#E58A61] font-medium">ORDER BY</span>{" "}
                <span className="text-[#F0EEE9]">deployed_at</span>{" "}
                <span className="text-[#E58A61] font-medium">DESC</span>{" "}
                <span className="text-[#E58A61] font-medium">LIMIT</span>{" "}
                <span className="text-[#F0EEE9]">3</span>;
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div>
                <span className="text-[#E58A61] font-medium">UPDATE</span>{" "}
                <span className="text-[#F0EEE9]">releases</span>
              </div>
              <div>
                <span className="text-[#E58A61] font-medium">SET</span>{" "}
                <span className="text-[#F0EEE9]">status</span> ={" "}
                <span className="text-[#82B89D]">&apos;published&apos;</span>
              </div>
              <div
                className={`transition-all duration-300 inline-block px-1 -mx-1 rounded ${
                  isQueryActive
                    ? "bg-[#E58A61]/15 text-[#F0EEE9]"
                    : "text-[#A5A19A]"
                }`}
              >
                <span className="text-[#E58A61] font-medium">WHERE</span>{" "}
                <span className="text-[#F0EEE9]">id</span> ={" "}
                <span className="text-[#82B89D]">&apos;rel_024&apos;</span>
              </div>
              <div>
                <span className="text-[#E58A61] font-medium">RETURNING</span>{" "}
                <span className="text-[#F0EEE9]">id, status</span>;
              </div>
            </div>
          )}
        </div>

        {/* Right: Restrained PostgreSQL Access Specification */}
        <div className="hidden sm:flex flex-col items-end font-mono text-[10px] text-[#A5A19A] leading-tight shrink-0 pt-0.5">
          <div className="flex items-center gap-1.5 text-[#F0EEE9] font-medium">
            <span
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                isIndexLookup ? "bg-[#E58A61]" : "bg-[#303030]"
              }`}
            />
            <span>{isSelect ? "idx_releases_status" : "releases_pkey"}</span>
            <span className="text-[#303030]">·</span>
            <span className="text-[#77736D] font-normal">B-Tree</span>
          </div>
          <div className="text-[9.5px] text-[#77736D] mt-1">
            {isSelect
              ? "Storage pages: Heap 8KB · Filter: status = 'published'"
              : "Point lookup: Heap 8KB · Tuple slot update"}
          </div>
        </div>
      </div>

      {/* =================================================================
          AREA 2: CENTRAL AREA — THE INDEXED STORAGE FIELD (HERO SVG)
          Architectural technical illustration: neutral charcoal & warm gray.
          ================================================================= */}
      <div className="flex-1 w-full min-h-0 my-1 relative flex items-center justify-center overflow-hidden">
        <svg
          viewBox="0 0 940 196"
          className="w-full h-full max-h-[210px] select-none"
          preserveAspectRatio="xMidYMid meet"
          aria-label="Database indexed storage pages illustration"
        >
          {/* -------------------------------------------------------------
              PART A: B-TREE INDEX STRUCTURE (Left Region, X: 15 to 205)
              ------------------------------------------------------------- */}
          <g id="index-structure">
            {/* Index Section Title */}
            <text
              x="20"
              y="16"
              fill="#77736D"
              fontSize="9"
              fontFamily="monospace"
              letterSpacing="0.06em"
            >
              {isSelect ? "INDEX: idx_releases_status" : "INDEX: releases_pkey"}
            </text>

            {/* Root Node */}
            <rect
              x="35"
              y="24"
              width="130"
              height="22"
              rx="3"
              fill="#151515"
              stroke={isIndexLookup ? "#E58A61" : "#262626"}
              strokeWidth="1"
              className="transition-colors duration-300"
            />
            <text
              x="100"
              y="38"
              fill={isIndexLookup ? "#F0EEE9" : "#A5A19A"}
              fontSize="8.5"
              fontFamily="monospace"
              textAnchor="middle"
              className="transition-colors duration-300"
            >
              ROOT NODE
            </text>

            {/* Tree Branch Lines from Root to Leaf Keys */}
            <path
              d="M 100 46 L 60 68"
              fill="none"
              stroke={isIndexLookup ? "#E58A61" : "#262626"}
              strokeWidth="1"
              className="transition-colors duration-300"
            />
            <path
              d="M 100 46 L 140 68"
              fill="none"
              stroke={isIndexLookup ? "#E58A61" : "#262626"}
              strokeWidth="1"
              className="transition-colors duration-300"
            />

            {/* Leaf Key 1 (Inactive) */}
            <rect
              x="20"
              y="68"
              width="160"
              height="22"
              rx="3"
              fill="#151515"
              stroke="#262626"
              strokeWidth="1"
            />
            <text
              x="30"
              y="82"
              fill="#77736D"
              fontSize="8.5"
              fontFamily="monospace"
            >
              {isSelect ? "'draft'" : "'rel_020'"}
            </text>

            {/* Leaf Key 2 (ACTIVE TARGET KEY!) */}
            <rect
              x="20"
              y="96"
              width="160"
              height="26"
              rx="3"
              fill={isIndexLookup ? "#1A1614" : "#151515"}
              stroke={isIndexLookup ? "#E58A61" : "#2A2A2A"}
              strokeWidth={isIndexLookup ? "1.2" : "1"}
              className="transition-all duration-300"
            />
            <text
              x="30"
              y="112"
              fill={isIndexLookup ? "#F0EEE9" : "#A5A19A"}
              fontSize="9"
              fontFamily="monospace"
              fontWeight={isIndexLookup ? "500" : "400"}
              className="transition-colors duration-300"
            >
              {isSelect ? "'published'" : "'rel_024'"}
            </text>
            <circle
              cx="172"
              cy="109"
              r="2.5"
              fill={isIndexLookup ? "#E58A61" : "#303030"}
              className="transition-colors duration-300"
            />

            {/* Leaf Key 3 (Inactive) */}
            <rect
              x="20"
              y="128"
              width="160"
              height="22"
              rx="3"
              fill="#151515"
              stroke="#262626"
              strokeWidth="1"
            />
            <text
              x="30"
              y="142"
              fill="#77736D"
              fontSize="8.5"
              fontFamily="monospace"
            >
              {isSelect ? "'archived'" : "'rel_028'"}
            </text>
          </g>

          {/* -------------------------------------------------------------
              PART B: PRECISE CONNECTOR PATHS (Index -> Storage Slots)
              Crisp right-angle bus lines in burnt orange or sage green.
              ------------------------------------------------------------- */}
          <g id="index-connections">
            {/* Connection 1: Index Leaf -> Page 1, Slot 1 (rel_024) */}
            <path
              d="M 180 109 H 215 V 45 H 455"
              fill="none"
              stroke={
                isIndexLookup
                  ? (isSelect && isRecordsMatched ? "#82B89D" : "#E58A61")
                  : "#262626"
              }
              strokeWidth={isIndexLookup ? "1.2" : "1"}
              strokeDasharray={isIndexLookup ? "none" : "2 2"}
              className="transition-colors duration-300"
            />
            <circle
              cx="455"
              cy="45"
              r="2"
              fill={
                isIndexLookup
                  ? (isSelect && isRecordsMatched ? "#82B89D" : "#E58A61")
                  : "#262626"
              }
            />

            {/* Connection 2 (SELECT only): Index Leaf -> Page 2, Slot 0 (rel_023) */}
            {isSelect && (
              <>
                <path
                  d="M 180 109 H 225 V 101 H 308"
                  fill="none"
                  stroke={
                    isIndexLookup
                      ? (isRecordsMatched ? "#82B89D" : "#E58A61")
                      : "#262626"
                  }
                  strokeWidth={isIndexLookup ? "1.2" : "1"}
                  strokeDasharray={isIndexLookup ? "none" : "2 2"}
                  className="transition-colors duration-300"
                />
                <circle
                  cx="308"
                  cy="101"
                  r="2"
                  fill={isIndexLookup ? (isRecordsMatched ? "#82B89D" : "#E58A61") : "#262626"}
                />
              </>
            )}

            {/* Connection 3 (SELECT only): Index Leaf -> Page 3, Slot 2 (rel_022) */}
            {isSelect && (
              <>
                <path
                  d="M 180 109 H 215 V 157 H 602"
                  fill="none"
                  stroke={
                    isIndexLookup
                      ? (isRecordsMatched ? "#82B89D" : "#E58A61")
                      : "#262626"
                  }
                  strokeWidth={isIndexLookup ? "1.2" : "1"}
                  strokeDasharray={isIndexLookup ? "none" : "2 2"}
                  className="transition-colors duration-300"
                />
                <circle
                  cx="602"
                  cy="157"
                  r="2"
                  fill={isIndexLookup ? (isRecordsMatched ? "#82B89D" : "#E58A61") : "#262626"}
                />
              </>
            )}
          </g>

          {/* -------------------------------------------------------------
              PART C: STORAGE PAGES (Right Region, X: 235 to 925)
              Three horizontal 8KB pages with consistent slots and clear hierarchy.
              ------------------------------------------------------------- */}
          <g id="storage-field">
            {/* Storage Header Label */}
            <text
              x="238"
              y="16"
              fill="#77736D"
              fontSize="9"
              fontFamily="monospace"
              letterSpacing="0.06em"
            >
              STORAGE PAGES (8KB HEAP)
            </text>

            {/* =========================================================
                PAGE 1: Heap Page 01 (Contains rel_024 in Slot 1)
                ========================================================= */}
            <g id="page-01">
              {/* Outer Page Boundary */}
              <rect
                x="238"
                y="24"
                width="686"
                height="44"
                rx="4"
                fill="#151515"
                stroke="#262626"
                strokeWidth="1"
              />

              {/* Page Identifier Tab */}
              <rect
                x="238"
                y="24"
                width="66"
                height="44"
                fill="#181818"
                stroke="#262626"
                strokeWidth="1"
                rx="4"
              />
              <text
                x="247"
                y="42"
                fill="#A5A19A"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="500"
              >
                PAGE 01
              </text>
              <text
                x="247"
                y="55"
                fill="#77736D"
                fontSize="7.5"
                fontFamily="monospace"
              >
                8KB HEAP
              </text>

              {/* Slot 0: rel_018 (Inactive) */}
              <rect
                x="310"
                y="28"
                width="142"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="318" y="42" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_018
              </text>
              <text x="318" y="55" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                draft
              </text>

              {/* Slot 1: rel_024 (MATCH / TARGET RECORD!) */}
              <rect
                x="458"
                y="28"
                width="142"
                height="36"
                rx="3"
                fill={
                  isRecordsMatched
                    ? (isSelect ? "#131815" : "#1A1614")
                    : isIndexLookup ? "#1A1614" : "#111111"
                }
                stroke={
                  isRecordsMatched
                    ? (isSelect ? "#82B89D" : "#E58A61")
                    : isIndexLookup ? "#E58A61" : "#222222"
                }
                strokeWidth={isRecordsMatched || isIndexLookup ? "1.2" : "1"}
                className="transition-all duration-300"
              />
              <text
                x="466"
                y="42"
                fill={isRecordsMatched ? "#F0EEE9" : "#A5A19A"}
                fontSize="8.5"
                fontFamily="monospace"
                fontWeight={isRecordsMatched ? "500" : "400"}
                className="transition-colors duration-300"
              >
                rel_024
              </text>
              <text
                x="466"
                y="55"
                fill={
                  isRecordsMatched
                    ? (isSelect
                        ? "#82B89D"
                        : (activePhase === "completed" ? "#82B89D" : "#E58A61"))
                    : "#77736D"
                }
                fontSize="7.5"
                fontFamily="monospace"
                fontWeight="medium"
                className="transition-colors duration-300"
              >
                {isSelect
                  ? "● published"
                  : (activePhase === "completed" ? "✔ published" : "updating...")}
              </text>

              {/* Slot 2: rel_011 (Inactive) */}
              <rect
                x="606"
                y="28"
                width="142"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="614" y="42" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_011
              </text>
              <text x="614" y="55" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                archived
              </text>

              {/* Slot 3: rel_019 (Inactive) */}
              <rect
                x="754"
                y="28"
                width="164"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="762" y="42" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_019
              </text>
              <text x="762" y="55" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                draft
              </text>
            </g>

            {/* =========================================================
                PAGE 2: Heap Page 02 (Contains rel_023 in Slot 0 for SELECT)
                ========================================================= */}
            <g id="page-02">
              <rect
                x="238"
                y="76"
                width="686"
                height="44"
                rx="4"
                fill="#151515"
                stroke="#262626"
                strokeWidth="1"
              />

              <rect
                x="238"
                y="76"
                width="66"
                height="44"
                fill="#181818"
                stroke="#262626"
                strokeWidth="1"
                rx="4"
              />
              <text
                x="247"
                y="94"
                fill="#A5A19A"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="500"
              >
                PAGE 02
              </text>
              <text
                x="247"
                y="107"
                fill="#77736D"
                fontSize="7.5"
                fontFamily="monospace"
              >
                8KB HEAP
              </text>

              {/* Slot 0: rel_023 (MATCH FOR SELECT) */}
              <rect
                x="310"
                y="80"
                width="142"
                height="36"
                rx="3"
                fill={isSelect && isRecordsMatched ? "#131815" : (isSelect && isIndexLookup ? "#1A1614" : "#111111")}
                stroke={
                  isSelect && isRecordsMatched
                    ? "#82B89D"
                    : isSelect && isIndexLookup ? "#E58A61" : "#222222"
                }
                strokeWidth={isSelect && (isRecordsMatched || isIndexLookup) ? "1.2" : "1"}
                className="transition-all duration-300"
              />
              <text
                x="318"
                y="94"
                fill={isSelect && isRecordsMatched ? "#F0EEE9" : "#A5A19A"}
                fontSize="8.5"
                fontFamily="monospace"
                fontWeight={isSelect && isRecordsMatched ? "500" : "400"}
                className="transition-colors duration-300"
              >
                rel_023
              </text>
              <text
                x="318"
                y="107"
                fill={isSelect && isRecordsMatched ? "#82B89D" : "#77736D"}
                fontSize="7.5"
                fontFamily="monospace"
                fontWeight="medium"
                className="transition-colors duration-300"
              >
                {isSelect && isRecordsMatched ? "● published" : "draft"}
              </text>

              {/* Slot 1: rel_015 (Inactive) */}
              <rect
                x="458"
                y="80"
                width="142"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="466" y="94" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_015
              </text>
              <text x="466" y="107" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                draft
              </text>

              {/* Slot 2: rel_009 (Inactive) */}
              <rect
                x="606"
                y="80"
                width="142"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="614" y="94" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_009
              </text>
              <text x="614" y="107" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                archived
              </text>

              {/* Slot 3: rel_014 (Inactive) */}
              <rect
                x="754"
                y="80"
                width="164"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="762" y="94" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_014
              </text>
              <text x="762" y="107" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                draft
              </text>
            </g>

            {/* =========================================================
                PAGE 3: Heap Page 03 (Contains rel_022 in Slot 2 for SELECT)
                ========================================================= */}
            <g id="page-03">
              <rect
                x="238"
                y="128"
                width="686"
                height="44"
                rx="4"
                fill="#151515"
                stroke="#262626"
                strokeWidth="1"
              />

              <rect
                x="238"
                y="128"
                width="66"
                height="44"
                fill="#181818"
                stroke="#262626"
                strokeWidth="1"
                rx="4"
              />
              <text
                x="247"
                y="146"
                fill="#A5A19A"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="500"
              >
                PAGE 03
              </text>
              <text
                x="247"
                y="159"
                fill="#77736D"
                fontSize="7.5"
                fontFamily="monospace"
              >
                8KB HEAP
              </text>

              {/* Slot 0: rel_007 (Inactive) */}
              <rect
                x="310"
                y="132"
                width="142"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="318" y="146" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_007
              </text>
              <text x="318" y="159" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                archived
              </text>

              {/* Slot 1: rel_016 (Inactive) */}
              <rect
                x="458"
                y="132"
                width="142"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="466" y="146" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_016
              </text>
              <text x="466" y="159" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                draft
              </text>

              {/* Slot 2: rel_022 (MATCH FOR SELECT) */}
              <rect
                x="606"
                y="132"
                width="142"
                height="36"
                rx="3"
                fill={isSelect && isRecordsMatched ? "#131815" : (isSelect && isIndexLookup ? "#1A1614" : "#111111")}
                stroke={
                  isSelect && isRecordsMatched
                    ? "#82B89D"
                    : isSelect && isIndexLookup ? "#E58A61" : "#222222"
                }
                strokeWidth={isSelect && (isRecordsMatched || isIndexLookup) ? "1.2" : "1"}
                className="transition-all duration-300"
              />
              <text
                x="614"
                y="146"
                fill={isSelect && isRecordsMatched ? "#F0EEE9" : "#A5A19A"}
                fontSize="8.5"
                fontFamily="monospace"
                fontWeight={isSelect && isRecordsMatched ? "500" : "400"}
                className="transition-colors duration-300"
              >
                rel_022
              </text>
              <text
                x="614"
                y="159"
                fill={isSelect && isRecordsMatched ? "#82B89D" : "#77736D"}
                fontSize="7.5"
                fontFamily="monospace"
                fontWeight="medium"
                className="transition-colors duration-300"
              >
                {isSelect && isRecordsMatched ? "● published" : "draft"}
              </text>

              {/* Slot 3: rel_013 (Inactive) */}
              <rect
                x="754"
                y="132"
                width="164"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="762" y="146" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_013
              </text>
              <text x="762" y="159" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                draft
              </text>
            </g>

            {/* Projection Indicators downward from Matching Slots during retrieval */}
            {isRetrieving && (
              <g id="retrieval-projections" className="animate-in fade-in duration-300">
                <path
                  d="M 529 64 V 186"
                  stroke="#82B89D"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                  opacity="0.5"
                />
                {isSelect && (
                  <>
                    <path
                      d="M 381 116 V 186"
                      stroke="#82B89D"
                      strokeWidth="1"
                      strokeDasharray="2 3"
                      opacity="0.5"
                    />
                    <path
                      d="M 677 168 V 186"
                      stroke="#82B89D"
                      strokeWidth="1"
                      strokeDasharray="2 3"
                      opacity="0.5"
                    />
                  </>
                )}
              </g>
            )}
          </g>
        </svg>
      </div>

      {/* =================================================================
          AREA 3: LOWER AREA — COHERENT RESULT SUMMARY
          Single integrated summary with 3 concise stages and structured table.
          No fabricated execution times, no empty gaps, zero layout shift.
          ================================================================= */}
      <div className="pt-2 border-t border-[#262626] shrink-0 space-y-2">
        {/* Concise Query Execution Stages Strip */}
        <div className="flex items-center justify-between text-[11px] font-mono pb-1 border-b border-[#222222]">
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Stage 1: Index lookup */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  isIndexDone
                    ? "bg-[#82B89D]"
                    : isIndexLookup
                    ? "bg-[#E58A61]"
                    : "bg-[#303030]"
                }`}
              />
              <span
                className={`transition-colors duration-300 ${
                  isIndexLookup ? "text-[#F0EEE9] font-medium" : "text-[#77736D]"
                }`}
              >
                Index lookup
              </span>
            </div>

            <span className="text-[#303030] text-[10px]">→</span>

            {/* Stage 2: 3 records matched / 1 record updated */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  isMatchingDone
                    ? "bg-[#82B89D]"
                    : isRecordsMatched
                    ? (isSelect ? "bg-[#82B89D]" : "bg-[#E58A61]")
                    : "bg-[#303030]"
                }`}
              />
              <span
                className={`transition-colors duration-300 ${
                  isRecordsMatched ? "text-[#F0EEE9] font-medium" : "text-[#77736D]"
                }`}
              >
                {isSelect ? "3 records matched" : "1 record updated"}
              </span>
            </div>

            <span className="text-[#303030] text-[10px]">→</span>

            {/* Stage 3: Results returned */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  isCompleted
                    ? "bg-[#82B89D]"
                    : isRetrieving
                    ? "bg-[#82B89D]"
                    : "bg-[#303030]"
                }`}
              />
              <span
                className={`transition-colors duration-300 ${
                  isRetrieving ? "text-[#F0EEE9] font-medium" : "text-[#77736D]"
                }`}
              >
                Results returned
              </span>
            </div>
          </div>

          {/* Right Status Indicator */}
          <div className="hidden sm:flex items-center gap-2 text-[10.5px]">
            {isCompleted ? (
              <span className="text-[#82B89D] flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#82B89D]" />
                {isSelect ? "3 matching records" : "1 record updated"}
              </span>
            ) : isRetrieving ? (
              <span className="text-[#82B89D]/80">Streaming tuples</span>
            ) : isRecordsMatched ? (
              <span className="text-[#A5A19A]">Reading heap</span>
            ) : (
              <span className="text-[#77736D]">Scanning index</span>
            )}
          </div>
        </div>

        {/* Structured Results Table */}
        <div className="w-full font-mono text-[11px]">
          {/* Table Column Headers */}
          <div className="grid grid-cols-12 text-[9.5px] text-[#77736D] pb-1 border-b border-[#222222] uppercase tracking-wider">
            <div className={isSelect ? "col-span-3" : "col-span-4"}>ID</div>
            {isSelect && <div className="col-span-5">SLUG</div>}
            <div className={isSelect ? "col-span-4" : "col-span-8"}>STATUS</div>
          </div>

          {/* Structured Rows (Fixed Height to Prevent Layout Shift) */}
          <div className="min-h-[56px] flex flex-col justify-center divide-y divide-[#1D1D1D]">
            {isSelect ? (
              <>
                {/* Row 1 */}
                <div
                  className={`grid grid-cols-12 py-0.5 items-center transition-all duration-300 ${
                    isRow1Visible ? "opacity-100 translate-y-0" : "opacity-20"
                  }`}
                >
                  <span className="col-span-3 text-[#F0EEE9] font-medium">rel_024</span>
                  <span className="col-span-5 text-[#A5A19A]">v2.4-production</span>
                  <span className="col-span-4 text-[#82B89D] flex items-center gap-1.5 font-medium">
                    <span className={`w-1 h-1 rounded-full ${isRow1Visible ? "bg-[#82B89D]" : "bg-[#303030]"}`} />
                    published
                  </span>
                </div>

                {/* Row 2 */}
                <div
                  className={`grid grid-cols-12 py-0.5 items-center transition-all duration-300 ${
                    isRow2Visible ? "opacity-100 translate-y-0" : "opacity-20"
                  }`}
                >
                  <span className="col-span-3 text-[#F0EEE9] font-medium">rel_023</span>
                  <span className="col-span-5 text-[#A5A19A]">v2.3-stable</span>
                  <span className="col-span-4 text-[#82B89D] flex items-center gap-1.5 font-medium">
                    <span className={`w-1 h-1 rounded-full ${isRow2Visible ? "bg-[#82B89D]" : "bg-[#303030]"}`} />
                    published
                  </span>
                </div>

                {/* Row 3 */}
                <div
                  className={`grid grid-cols-12 py-0.5 items-center transition-all duration-300 ${
                    isRow3Visible ? "opacity-100 translate-y-0" : "opacity-20"
                  }`}
                >
                  <span className="col-span-3 text-[#F0EEE9] font-medium">rel_022</span>
                  <span className="col-span-5 text-[#A5A19A]">v2.2-production</span>
                  <span className="col-span-4 text-[#82B89D] flex items-center gap-1.5 font-medium">
                    <span className={`w-1 h-1 rounded-full ${isRow3Visible ? "bg-[#82B89D]" : "bg-[#303030]"}`} />
                    published
                  </span>
                </div>
              </>
            ) : (
              /* UPDATE Returned Row */
              <div
                className={`grid grid-cols-12 py-1.5 items-center transition-all duration-300 ${
                  isRow1Visible ? "opacity-100 translate-y-0" : "opacity-20"
                }`}
              >
                <span className="col-span-4 text-[#F0EEE9] font-medium">rel_024</span>
                <span className="col-span-8 text-[#82B89D] flex items-center gap-2 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#82B89D]" />
                  published
                  <span className="text-[10px] text-[#A5A19A] font-normal">
                    (updated from draft)
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
