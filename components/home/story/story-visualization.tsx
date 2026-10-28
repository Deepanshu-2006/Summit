"use client";

import React from "react";
import { motion, MotionValue, useTransform } from "motion/react";
import { Check } from "lucide-react";

interface StoryVisualizationProps {
  scrollYProgress: MotionValue<number>;
  isReducedMotion?: boolean;
}

/**
 * StoryVisualization: The Persistent Shared Infrastructure System
 * Stays mounted throughout the scroll journey and evolves dynamically based on scroll progress:
 * - Scene 0 (Hero): Source node is active, Build is dormant.
 * - Scene 1 (Transition to Build): Source-to-Build path draws, packet glides, Build activates.
 * - Future Scenes: Extends into Production and complete global edge mesh.
 */
export function StoryVisualization({ scrollYProgress, isReducedMotion }: StoryVisualizationProps) {
  // Motion values driven by scrollYProgress (GPU accelerated, 0 React re-renders)
  const path1Length = useTransform(scrollYProgress, [0.12, 0.45], [0, 1]);
  const path1Opacity = useTransform(scrollYProgress, [0.10, 0.14], [0, 1]);
  const tag1Opacity = useTransform(scrollYProgress, [0.22, 0.38], [0.25, 1]);
  
  // Build node activation motion values
  const buildScale = useTransform(scrollYProgress, [0.38, 0.50], [0.98, 1.02]);
  const buildOpacity = useTransform(scrollYProgress, [0.38, 0.48], [0.75, 1]);
  const buildBorderColor = useTransform(
    scrollYProgress,
    [0.38, 0.50],
    ["#292E31", "#D88762"]
  );

  // Status transitions
  const buildProgressWidth = useTransform(
    scrollYProgress,
    [0.40, 0.55],
    ["15%", "75%"]
  );

  return (
    <div className="w-full relative aspect-[600/440] max-w-[600px] select-none">
      
      {/* =================================================================
          SVG INFRASTRUCTURE CIRCUIT LAYER
          Coordinates match 600x440 viewBox exactly:
          - Source bottom pin: (130, 116)
          - Build top pin: (310, 160)
          - Build bottom pin: (310, 272)
          - Production top pin: (460, 312)
          ================================================================= */}
      <svg
        viewBox="0 0 600 440"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          {/* Traveling Data Packet Marker attached to stroke tip */}
          <marker
            id="packet-head"
            viewBox="-6 -6 12 12"
            refX="0"
            refY="0"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
          >
            <circle r="4" fill="#D88762" />
            <circle r="6" fill="#D88762" opacity="0.3" />
          </marker>
        </defs>

        {/* -------------------------------------------------------------
            CONNECTION 1: Source bottom (130, 116) -> Build top (310, 160)
            ------------------------------------------------------------- */}
        {/* Base Inactive Path */}
        <path
          d="M 130 116 C 130 146, 310 130, 310 160"
          stroke="#292E31"
          strokeWidth="1.5"
        />

        {/* Active Scroll-Driven Highlight Path */}
        {!isReducedMotion ? (
          <motion.path
            d="M 130 116 C 130 146, 310 130, 310 160"
            stroke="#D88762"
            strokeWidth="1.75"
            strokeLinecap="round"
            style={{
              pathLength: path1Length,
              opacity: path1Opacity,
            }}
            markerEnd="url(#packet-head)"
          />
        ) : (
          <path
            d="M 130 116 C 130 146, 310 130, 310 160"
            stroke="#D88762"
            strokeWidth="1.75"
          />
        )}

        {/* Intermediate Artifact Tag 1 */}
        <motion.g
          transform="translate(195, 134)"
          style={{ opacity: isReducedMotion ? 1 : tag1Opacity }}
        >
          <rect
            x="-24"
            y="-8"
            width="48"
            height="15"
            rx="3"
            fill="#121416"
            stroke="#292E31"
            strokeWidth="1"
          />
          <text
            x="0"
            y="3"
            fill="#777D7D"
            fontSize="8.5"
            fontFamily="var(--font-geist-mono)"
            textAnchor="middle"
          >
            git:sha256
          </text>
        </motion.g>

        {/* -------------------------------------------------------------
            CONNECTION 2: Build bottom (310, 272) -> Production top (460, 312)
            ------------------------------------------------------------- */}
        <path
          d="M 310 272 C 310 298, 460 286, 460 312"
          stroke="#292E31"
          strokeWidth="1.5"
        />

        {/* Intermediate Artifact Tag 2 */}
        <g transform="translate(395, 288)">
          <rect
            x="-24"
            y="-8"
            width="48"
            height="15"
            rx="3"
            fill="#121416"
            stroke="#292E31"
            strokeWidth="1"
          />
          <text
            x="0"
            y="3"
            fill="#777D7D"
            fontSize="8.5"
            fontFamily="var(--font-geist-mono)"
            textAnchor="middle"
          >
            release:v2.4
          </text>
        </g>

        {/* -------------------------------------------------------------
            HARDWARE TERMINAL CONNECTION PINS
            ------------------------------------------------------------- */}
        {/* Source Output Pin (130, 116) - Active */}
        <g transform="translate(130, 116)">
          <rect
            x="-3.5"
            y="-3.5"
            width="7"
            height="7"
            rx="1.5"
            fill="#191C1F"
            stroke="#D88762"
            strokeWidth="1.5"
          />
          <circle r="1.5" fill="#D88762" />
        </g>

        {/* Build Input Pin (310, 160) */}
        <g transform="translate(310, 160)">
          <rect
            x="-3.5"
            y="-3.5"
            width="7"
            height="7"
            rx="1.5"
            fill="#191C1F"
            stroke="#343A3D"
            strokeWidth="1.5"
          />
          <circle r="1.5" fill="#777D7D" />
        </g>

        {/* Build Output Pin (310, 272) */}
        <g transform="translate(310, 272)">
          <rect
            x="-3.5"
            y="-3.5"
            width="7"
            height="7"
            rx="1.5"
            fill="#191C1F"
            stroke="#343A3D"
            strokeWidth="1.5"
          />
          <circle r="1.5" fill="#777D7D" />
        </g>

        {/* Production Input Pin (460, 312) */}
        <g transform="translate(460, 312)">
          <rect
            x="-3.5"
            y="-3.5"
            width="7"
            height="7"
            rx="1.5"
            fill="#191C1F"
            stroke="#343A3D"
            strokeWidth="1.5"
          />
          <circle r="1.5" fill="#777D7D" />
        </g>
      </svg>

      {/* =================================================================
          STAGE A: SOURCE NODE (Top-Left: 3.33% left, 5.45% top, 36.67% w)
          Origin point of deployment - always active
          ================================================================= */}
      <div
        style={{
          left: "3.33%",
          top: "5.45%",
          width: "36.67%",
        }}
        className="absolute rounded-[8px] bg-[#191C1F] border border-accent-orange/90 p-3 shadow-md shadow-accent-orange/5"
      >
        {/* Node Header */}
        <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-border-subtle/50">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
            <span className="font-mono text-[9.5px] uppercase tracking-wider text-text-muted font-medium">
              SOURCE
            </span>
          </div>
          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-[3px] bg-[#202427] border border-border-subtle text-text-secondary">
            main
          </span>
        </div>

        {/* Commit & Diff Details */}
        <div className="space-y-0.5 font-mono text-[10.5px]">
          <div className="flex items-center justify-between">
            <span className="text-[#F1F0EC] font-medium">commit 8f3a21c</span>
            <span className="text-semantic-success text-[9.5px]">+142 -18</span>
          </div>
          <p className="text-[10px] text-text-muted truncate">
            feat(routing): edge cluster v2
          </p>
        </div>

        {/* Node Footer */}
        <div className="mt-2 pt-1.5 border-t border-border-subtle/40 flex items-center justify-between font-mono text-[9.5px] text-text-muted">
          <span>origin/main</span>
          <span className="text-accent-orange font-medium">READY</span>
        </div>
      </div>

      {/* =================================================================
          STAGE B: BUILD ENGINE NODE (Center: 30.83% left, 36.36% top, 41.67% w)
          Dynamically activates as user scrolls into Scene 1
          ================================================================= */}
      <motion.div
        style={{
          left: "30.83%",
          top: "36.36%",
          width: "41.67%",
          scale: isReducedMotion ? 1 : buildScale,
          opacity: isReducedMotion ? 1 : buildOpacity,
          borderColor: isReducedMotion ? "#D88762" : buildBorderColor,
        }}
        className="absolute rounded-[8px] bg-[#191C1F] border p-3 shadow-md transition-shadow duration-200"
      >
        {/* Node Header */}
        <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-border-subtle/50">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-orange animate-pulse" />
            <span className="font-mono text-[9.5px] uppercase tracking-wider text-text-muted font-medium">
              BUILD ENGINE
            </span>
          </div>
          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-[3px] bg-[#202427] border border-border-subtle text-text-secondary">
            turbopack
          </span>
        </div>

        {/* Simulated Build Steps */}
        <div className="space-y-1 font-mono text-[10.5px]">
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted text-[9.5px]">01</span>
            <span className="text-[#F1F0EC]">pnpm install --frozen</span>
            <Check className="w-2.5 h-2.5 text-semantic-success ml-auto" />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-text-muted text-[9.5px]">02</span>
            <span className="text-accent-orange font-medium">compiling bundle...</span>
          </div>

          {/* Dynamic Progress bar line */}
          <div className="w-full h-1 bg-[#202427] rounded-full overflow-hidden mt-1">
            <motion.div
              style={{ width: isReducedMotion ? "85%" : buildProgressWidth }}
              className="h-full bg-accent-orange transition-all duration-300"
            />
          </div>
        </div>

        {/* Build status label */}
        <div className="mt-2 pt-1.5 border-t border-border-subtle/40 flex items-center justify-between font-mono text-[9.5px]">
          <span className="text-text-muted">status</span>
          <span className="text-accent-orange font-medium">COMPILING</span>
        </div>
      </motion.div>

      {/* =================================================================
          STAGE C: PRODUCTION NODE (Bottom-Right: 57.50% left, 70.91% top, 39.17% w)
          Target node for deployment completion
          ================================================================= */}
      <div
        style={{
          left: "57.50%",
          top: "70.91%",
          width: "39.17%",
        }}
        className="absolute rounded-[8px] bg-[#191C1F] border border-border-subtle p-3 shadow-md opacity-70"
      >
        {/* Node Header */}
        <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-border-subtle/50">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-text-muted/60" />
            <span className="font-mono text-[9.5px] uppercase tracking-wider text-text-muted font-medium">
              PRODUCTION
            </span>
          </div>
          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-[3px] border border-border-subtle bg-[#202427] text-text-muted">
            QUEUED
          </span>
        </div>

        {/* Production Body */}
        <div className="space-y-0.5 font-mono text-[10.5px]">
          <div className="text-[#F1F0EC] font-medium truncate flex items-center justify-between">
            <span>app.jetway.demo</span>
            <span className="text-[9px] text-text-muted">https</span>
          </div>
          <div className="flex items-center justify-between text-[9.5px] text-text-muted">
            <span>iad1-edge</span>
            <span className="text-text-muted">pending</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-2 pt-1.5 border-t border-border-subtle/40 flex items-center justify-between font-mono text-[9.5px] text-text-muted">
          <span>health: standby</span>
          <span className="text-text-muted">SSL ready</span>
        </div>
      </div>

    </div>
  );
}

export default StoryVisualization;
