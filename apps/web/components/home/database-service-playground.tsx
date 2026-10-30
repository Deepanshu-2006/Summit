"use client";

import React, { useState, useEffect, useRef } from "react";

type AnimationPhase =
  | "query"        // 700ms: Emphasize active SQL condition WHERE id = 'rel_024'
  | "lookup"       // 900ms: rel_024 key in index highlights in burnt orange, connector traces smoothly to Page 01
  | "update"       // 800ms: rel_024 slot is selected, status transitions from draft to published, settling to sage green
  | "confirmation" // 2600ms: Execution summary confirms stages, returned result row settles in full clarity

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
  const [phase, setPhase] = useState<AnimationPhase>("query");
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

  // Single coordinated animation timeline
  useEffect(() => {
    if (isReducedMotion || !isInViewport) {
      return;
    }

    let timeoutId: NodeJS.Timeout;

    switch (phase) {
      case "query":
        timeoutId = setTimeout(() => setPhase("lookup"), 700);
        break;
      case "lookup":
        timeoutId = setTimeout(() => setPhase("update"), 900);
        break;
      case "update":
        timeoutId = setTimeout(() => setPhase("confirmation"), 800);
        break;
      case "confirmation":
        // Hold completed state, then restart smoothly
        timeoutId = setTimeout(() => setPhase("query"), 2600);
        break;
    }

    return () => clearTimeout(timeoutId);
  }, [phase, isReducedMotion, isInViewport]);

  const activePhase: AnimationPhase = isReducedMotion ? "confirmation" : phase;

  // State flags for coordinated transitions
  const isConditionActive = activePhase === "query" || activePhase === "lookup";
  const isLookup = activePhase === "lookup" || activePhase === "update" || activePhase === "confirmation";
  const isUpdate = activePhase === "update" || activePhase === "confirmation";
  const isConfirmation = activePhase === "confirmation";

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col justify-between select-none overflow-hidden"
    >
      {/* =================================================================
          1. SQL QUERY: COMPACT, CAREFULLY TYPESET CODE BLOCK
          Geist Mono, burnt orange keywords, warm off-white identifiers, sage strings.
          ================================================================= */}
      <div className="pb-1 shrink-0">
        <div className="font-mono text-[11.5px] leading-[1.42] tracking-tight">
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
              className={`transition-all duration-300 inline-block px-1.5 -mx-1.5 py-0.5 rounded ${
                isConditionActive
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
        </div>
      </div>

      {/* =================================================================
          2. THE HERO: THE INDEXED STORAGE FIELD
          Architectural technical illustration: neutral charcoal & warm gray.
          The storage pages and rel_024 are the primary visual focal point.
          NO vertical dotted lines.
          ================================================================= */}
      <div className="flex-1 w-full min-h-0 my-1 relative flex items-center justify-center overflow-hidden">
        <svg
          viewBox="0 0 940 190"
          className="w-full h-full max-h-[225px] select-none"
          preserveAspectRatio="xMidYMid meet"
          aria-label="Database indexed storage pages illustration"
        >
          {/* -------------------------------------------------------------
              PART A: PRIMARY-KEY INDEX (Left Region, X: 15 to 200)
              Consistent node dimensions, understated root, neutral inactive keys.
              ------------------------------------------------------------- */}
          <g id="index-tree">
            <text
              x="20"
              y="16"
              fill="#77736D"
              fontSize="8.5"
              fontFamily="monospace"
              letterSpacing="0.08em"
            >
              INDEX
            </text>

            {/* Root Node: primary_key */}
            <rect
              x="30"
              y="24"
              width="140"
              height="24"
              rx="3"
              fill="#151515"
              stroke={isLookup ? "#E58A61" : "#262626"}
              strokeWidth="1"
              className="transition-colors duration-300"
            />
            <text
              x="100"
              y="39"
              fill={isLookup ? "#F0EEE9" : "#A5A19A"}
              fontSize="8.5"
              fontFamily="monospace"
              textAnchor="middle"
              className="transition-colors duration-300"
            >
              primary_key
            </text>

            {/* Tree Branch Lines */}
            <path
              d="M 100 48 L 50 72"
              fill="none"
              stroke={isLookup ? "#E58A61" : "#262626"}
              strokeWidth="1"
              className="transition-colors duration-300"
            />
            <path
              d="M 100 48 L 150 72"
              fill="none"
              stroke={isLookup ? "#E58A61" : "#262626"}
              strokeWidth="1"
              className="transition-colors duration-300"
            />

            {/* Leaf Key 1: rel_020 (Inactive) */}
            <rect
              x="20"
              y="72"
              width="160"
              height="24"
              rx="3"
              fill="#151515"
              stroke="#262626"
              strokeWidth="1"
            />
            <text
              x="30"
              y="87"
              fill="#77736D"
              fontSize="8.5"
              fontFamily="monospace"
            >
              rel_020
            </text>

            {/* Leaf Key 2: rel_024 (SELECTED KEY) */}
            <rect
              x="20"
              y="103"
              width="160"
              height="24"
              rx="3"
              fill={isLookup ? "#1A1614" : "#151515"}
              stroke={isLookup ? (isUpdate ? "#82B89D" : "#E58A61") : "#262626"}
              strokeWidth={isLookup ? "1.2" : "1"}
              className="transition-all duration-300"
            />
            <text
              x="30"
              y="118"
              fill={isLookup ? "#F0EEE9" : "#A5A19A"}
              fontSize="9"
              fontFamily="monospace"
              fontWeight={isLookup ? "500" : "400"}
              className="transition-colors duration-300"
            >
              rel_024
            </text>
            <circle
              cx="172"
              cy="115"
              r="2.5"
              fill={isLookup ? (isUpdate ? "#82B89D" : "#E58A61") : "#303030"}
              className="transition-colors duration-300"
            />

            {/* Leaf Key 3: rel_028 (Inactive) */}
            <rect
              x="20"
              y="134"
              width="160"
              height="24"
              rx="3"
              fill="#151515"
              stroke="#262626"
              strokeWidth="1"
            />
            <text
              x="30"
              y="149"
              fill="#77736D"
              fontSize="8.5"
              fontFamily="monospace"
            >
              rel_028
            </text>
          </g>

          {/* -------------------------------------------------------------
              PART B: PRECISE CONTINUOUS CONNECTOR PATH
              From rel_024 index entry directly terminating at Page 01, Slot 1.
              Smooth stroke-dashoffset transition.
              ------------------------------------------------------------- */}
          <g id="index-connections">
            {/* Base inactive guide line */}
            <path
              d="M 180 115 H 220 V 46 H 457"
              fill="none"
              stroke="#262626"
              strokeWidth="1"
              strokeDasharray="2 2"
            />

            {/* Active animated trace line */}
            <path
              d="M 180 115 H 220 V 46 H 457"
              fill="none"
              stroke={isUpdate ? "#82B89D" : "#E58A61"}
              strokeWidth="1.2"
              style={{
                strokeDasharray: 346,
                strokeDashoffset: isLookup ? 0 : 346,
                transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.4s ease",
              }}
            />

            {/* Terminal node at the entrance of slot rel_024 */}
            <circle
              cx="457"
              cy="46"
              r="2"
              fill={isLookup ? (isUpdate ? "#82B89D" : "#E58A61") : "#262626"}
              className="transition-colors duration-300"
            />
          </g>

          {/* -------------------------------------------------------------
              PART C: STORAGE PAGES (The Hero Visual Structure)
              Three horizontal pages. Only rel_024 is the focal point.
              NO unwanted vertical lines.
              ------------------------------------------------------------- */}
          <g id="storage-field">
            <text
              x="235"
              y="16"
              fill="#77736D"
              fontSize="8.5"
              fontFamily="monospace"
              letterSpacing="0.08em"
            >
              STORAGE PAGES
            </text>

            {/* =========================================================
                PAGE 1: Heap Page 01 (Contains the Hero Slot rel_024)
                ========================================================= */}
            <g id="page-01">
              <rect
                x="235"
                y="24"
                width="686"
                height="44"
                rx="4"
                fill="#151515"
                stroke="#262626"
                strokeWidth="1"
              />

              {/* Page Identifier */}
              <rect
                x="235"
                y="24"
                width="66"
                height="44"
                fill="#181818"
                stroke="#262626"
                strokeWidth="1"
                rx="4"
              />
              <text
                x="245"
                y="49"
                fill="#A5A19A"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="500"
              >
                Page 01
              </text>

              {/* Slot 0: rel_018 (Inactive) */}
              <rect
                x="307"
                y="28"
                width="144"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="315" y="43" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_018
              </text>
              <text x="315" y="56" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                draft
              </text>

              {/* Slot 1: rel_024 — THE PRIMARY VISUAL FOCAL POINT */}
              <rect
                x="457"
                y="28"
                width="144"
                height="36"
                rx="3"
                fill={
                  isUpdate
                    ? "#131815"
                    : isLookup
                    ? "#1A1614"
                    : "#111111"
                }
                stroke={
                  isUpdate
                    ? "#82B89D"
                    : isLookup
                    ? "#E58A61"
                    : "#222222"
                }
                strokeWidth={isLookup || isUpdate ? "1.5" : "1"}
                className="transition-all duration-300"
              />
              <text
                x="465"
                y="43"
                fill={isLookup || isUpdate ? "#F0EEE9" : "#A5A19A"}
                fontSize="8.5"
                fontFamily="monospace"
                fontWeight={isLookup || isUpdate ? "600" : "400"}
                className="transition-colors duration-300"
              >
                rel_024
              </text>
              <text
                x="465"
                y="56"
                fill={
                  isUpdate
                    ? "#82B89D"
                    : isLookup
                    ? "#E58A61"
                    : "#77736D"
                }
                fontSize="7.5"
                fontFamily="monospace"
                fontWeight={isUpdate ? "500" : "400"}
                className="transition-colors duration-300"
              >
                {isUpdate ? "● published" : isLookup ? "draft → updating" : "draft"}
              </text>

              {/* Slot 2: rel_011 (Inactive) */}
              <rect
                x="607"
                y="28"
                width="144"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="615" y="43" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_011
              </text>
              <text x="615" y="56" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                archived
              </text>

              {/* Slot 3: rel_019 (Inactive) */}
              <rect
                x="757"
                y="28"
                width="158"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="765" y="43" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_019
              </text>
              <text x="765" y="56" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                draft
              </text>
            </g>

            {/* =========================================================
                PAGE 2: Heap Page 02 (Subdued Inactive Records)
                ========================================================= */}
            <g id="page-02">
              <rect
                x="235"
                y="79"
                width="686"
                height="44"
                rx="4"
                fill="#151515"
                stroke="#262626"
                strokeWidth="1"
              />

              <rect
                x="235"
                y="79"
                width="66"
                height="44"
                fill="#181818"
                stroke="#262626"
                strokeWidth="1"
                rx="4"
              />
              <text
                x="245"
                y="104"
                fill="#A5A19A"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="500"
              >
                Page 02
              </text>

              {/* Slot 0: rel_023 (Inactive) */}
              <rect
                x="307"
                y="83"
                width="144"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="315" y="98" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_023
              </text>
              <text x="315" y="111" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                draft
              </text>

              {/* Slot 1: rel_015 (Inactive) */}
              <rect
                x="457"
                y="83"
                width="144"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="465" y="98" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_015
              </text>
              <text x="465" y="111" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                draft
              </text>

              {/* Slot 2: rel_009 (Inactive) */}
              <rect
                x="607"
                y="83"
                width="144"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="615" y="98" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_009
              </text>
              <text x="615" y="111" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                archived
              </text>

              {/* Slot 3: rel_014 (Inactive) */}
              <rect
                x="757"
                y="83"
                width="158"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="765" y="98" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_014
              </text>
              <text x="765" y="111" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                draft
              </text>
            </g>

            {/* =========================================================
                PAGE 3: Heap Page 03 (Subdued Inactive Records)
                ========================================================= */}
            <g id="page-03">
              <rect
                x="235"
                y="134"
                width="686"
                height="44"
                rx="4"
                fill="#151515"
                stroke="#262626"
                strokeWidth="1"
              />

              <rect
                x="235"
                y="134"
                width="66"
                height="44"
                fill="#181818"
                stroke="#262626"
                strokeWidth="1"
                rx="4"
              />
              <text
                x="245"
                y="159"
                fill="#A5A19A"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="500"
              >
                Page 03
              </text>

              {/* Slot 0: rel_007 (Inactive) */}
              <rect
                x="307"
                y="138"
                width="144"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="315" y="153" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_007
              </text>
              <text x="315" y="166" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                archived
              </text>

              {/* Slot 1: rel_016 (Inactive) */}
              <rect
                x="457"
                y="138"
                width="144"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="465" y="153" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_016
              </text>
              <text x="465" y="166" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                draft
              </text>

              {/* Slot 2: rel_022 (Inactive) */}
              <rect
                x="607"
                y="138"
                width="144"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="615" y="153" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_022
              </text>
              <text x="615" y="166" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                draft
              </text>

              {/* Slot 3: rel_013 (Inactive) */}
              <rect
                x="757"
                y="138"
                width="158"
                height="36"
                rx="3"
                fill="#111111"
                stroke="#222222"
                strokeWidth="1"
              />
              <text x="765" y="153" fill="#A5A19A" fontSize="8.5" fontFamily="monospace">
                rel_013
              </text>
              <text x="765" y="166" fill="#77736D" fontSize="7.5" fontFamily="monospace">
                draft
              </text>
            </g>
          </g>
        </svg>
      </div>

      {/* =================================================================
          3. EXECUTION SUMMARY & CONCISE CONFIRMATION RESULT
          Compact, single-line lifecycle + concise returned record.
          No dotted vertical lines. No RETURNING id, status label on right.
          ================================================================= */}
      <div className="pt-2 border-t border-[#262626] shrink-0 space-y-2">
        {/* Single-line Lifecycle */}
        <div className="flex items-center justify-between text-[11px] font-mono pb-1 border-b border-[#222222]">
          <div className="flex items-center gap-3 sm:gap-5">
            {/* Stage 1: Index lookup */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  isUpdate
                    ? "bg-[#82B89D]"
                    : isLookup
                    ? "bg-[#E58A61]"
                    : "bg-[#303030]"
                }`}
              />
              <span
                className={`transition-colors duration-300 ${
                  isLookup ? "text-[#F0EEE9] font-medium" : "text-[#77736D]"
                }`}
              >
                Index lookup
              </span>
            </div>

            <span className="text-[#303030] text-[10px]">→</span>

            {/* Stage 2: Record updated */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  isConfirmation
                    ? "bg-[#82B89D]"
                    : isUpdate
                    ? "bg-[#E58A61]"
                    : "bg-[#303030]"
                }`}
              />
              <span
                className={`transition-colors duration-300 ${
                  isUpdate ? "text-[#F0EEE9] font-medium" : "text-[#77736D]"
                }`}
              >
                Record updated
              </span>
            </div>

            <span className="text-[#303030] text-[10px]">→</span>

            {/* Stage 3: Result returned */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  isConfirmation ? "bg-[#82B89D]" : "bg-[#303030]"
                }`}
              />
              <span
                className={`transition-colors duration-300 ${
                  isConfirmation ? "text-[#F0EEE9] font-medium" : "text-[#77736D]"
                }`}
              >
                Result returned
              </span>
            </div>
          </div>
        </div>

        {/* Result: Concise Operation Confirmation (rel_024 · published · Updated from draft) */}
        <div className="w-full font-mono text-[12px] py-1.5 flex items-center">
          <div
            className={`flex items-center gap-2 sm:gap-2.5 transition-all duration-300 ${
              isConfirmation ? "opacity-100" : "opacity-30"
            }`}
          >
            <span className="text-[#F0EEE9] font-medium tracking-tight">rel_024</span>
            <span className="text-[#77736D]">·</span>
            <span className="text-[#82B89D] flex items-center gap-1.5 font-medium">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  isConfirmation ? "bg-[#82B89D]" : "bg-[#303030]"
                }`}
              />
              published
            </span>
            <span className="text-[#77736D]">·</span>
            <span className="text-[#A5A19A] text-[11px]">Updated from draft</span>
          </div>
        </div>
      </div>
    </div>
  );
}
