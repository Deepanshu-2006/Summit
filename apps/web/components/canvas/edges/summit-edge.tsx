"use client";

import React, { memo, useState, useEffect, useCallback } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Position,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { X } from "lucide-react";

interface SummitEdgeData {
  isNew?: boolean;
  createdAt?: number;
  delayMs?: number;
}

/**
 * Exact Railway-Inspired Infrastructure Connection Component
 *
 * Characteristics:
 * 1. Geometry-Aware Center Alignment:
 *    - For vertical alignments (e.g. backend to database): produces a razor-sharp,
 *      100% straight vertical dotted line or smooth S-curve down the center axis.
 *    - For horizontal arrangements: produces a clean, fluid horizontal cubic Bezier.
 *    - Prevents backward looping and unnatural arcs.
 * 2. Multi-Stage Connection Establishment Animation (0–1800ms):
 *    - Phase 1 (0–250ms): Source handle burnt-orange ignition burst.
 *    - Phase 2 (200–1050ms): Progressive laser beam reveal with a dual-layer traveling comet particle.
 *    - Phase 3 (1000–1450ms): Destination handle cyan arrival shockwave ripple.
 *    - Phase 4 (1100–1650ms): Full connection confirmation pulse.
 * 3. Settled State (>1800ms):
 *    - Refined, high-contrast dotted line (3px dots, 4px gap) in calm neutral gray.
 *    - Interactive hover & selection with centered delete (X) badge.
 */
export const SummitEdgeComponent = memo(function SummitEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
  style = {},
  markerEnd,
  selected,
  data,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { setEdges, deleteElements } = useReactFlow();

  const edgeData = data as SummitEdgeData | undefined;
  const isInitialNew = Boolean(
    edgeData?.isNew && Date.now() - (edgeData.createdAt || 0) < 2200
  );

  const [isAnimating, setIsAnimating] = useState(isInitialNew);
  const delayMs = edgeData?.delayMs || 0;

  // Reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(media.matches);
    }
  }, []);

  // Complete animation sequence after ~1.8 seconds and settle into permanent dotted state
  useEffect(() => {
    if (!isInitialNew || prefersReducedMotion) {
      setIsAnimating(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsAnimating(false);
    }, delayMs + 1850);

    return () => clearTimeout(timer);
  }, [isInitialNew, delayMs, prefersReducedMotion]);

  // Clean, gap-free SVG path construction directly from graph coordinate endpoints
  const isDirectlyVertical =
    ((sourcePosition === Position.Bottom && targetPosition === Position.Top) ||
      (sourcePosition === Position.Top && targetPosition === Position.Bottom)) &&
    Math.abs(targetX - sourceX) < 1.5;

  const isDirectlyHorizontal =
    ((sourcePosition === Position.Right && targetPosition === Position.Left) ||
      (sourcePosition === Position.Left && targetPosition === Position.Right)) &&
    Math.abs(targetY - sourceY) < 1.5;

  let edgePath = "";
  let labelX = (sourceX + targetX) / 2;
  let labelY = (sourceY + targetY) / 2;

  if (isDirectlyVertical) {
    // Pure vertical straight dotted line directly connecting the two handles
    edgePath = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
  } else if (isDirectlyHorizontal) {
    // Pure horizontal straight dotted line directly connecting the two handles
    edgePath = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
  } else {
    // Smooth, natural cubic Bézier curve calculated from actual handle coordinates & directions
    const [path, lx, ly] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
    edgePath = path;
    labelX = lx;
    labelY = ly;
  }

  const handleDelete = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (deleteElements) {
        deleteElements({ edges: [{ id }] });
      }

      setEdges((eds) => eds.filter((edge) => edge.id !== id));

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("summit:delete-edge", { detail: { id } })
        );
      }
    },
    [id, setEdges, deleteElements]
  );

  const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const maskId = `summit-conn-mask-${cleanId}`;
  const energyGradId = `summit-energy-grad-${cleanId}`;

  const delaySec = delayMs / 1000;
  const drawStartSec = (delayMs + 240) / 1000;
  const destArrivalSec = (delayMs + 980) / 1000;
  const confirmStartSec = (delayMs + 1040) / 1000;

  return (
    <>
      <defs>
        {/* Dynamic Summit Warm-Neutral Connection Beam Gradient */}
        <linearGradient id={energyGradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E79570" stopOpacity={0.95} />
          <stop offset="50%" stopColor="#F2F0EC" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#F0A17B" stopOpacity={0.95} />
        </linearGradient>

        {/* SVG Mask for Progressive Path Drawing from Source to Target */}
        {isAnimating && (
          <mask id={maskId} maskUnits="userSpaceOnUse">
            <path
              d={edgePath}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={14}
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="100"
            >
              <animate
                attributeName="stroke-dashoffset"
                values="100; 0"
                begin={`${drawStartSec}s`}
                dur="0.78s"
                fill="freeze"
                calcMode="spline"
                keyTimes="0; 1"
                keySplines="0.16 1 0.3 1"
              />
            </path>
          </mask>
        )}
      </defs>

      {/* Invisible broad hit path (26px) for effortless hover & selection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={26}
        className="cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Selected Edge Luminous Glow Backdrop */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke="#E79570"
          strokeWidth={6}
          strokeOpacity={0.25}
          strokeLinecap="round"
        />
      )}

      {/* Hover Illumination Subtle Backdrop */}
      {isHovered && !selected && (
        <path
          d={edgePath}
          fill="none"
          stroke="#F2F0EC"
          strokeWidth={4.5}
          strokeOpacity={0.12}
          strokeLinecap="round"
        />
      )}

      {/* Permanent Settled State: Crisp Railway-Style Round Dotted Line */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected
            ? "#E79570"
            : isHovered
            ? "#F2F0EC"
            : isAnimating
            ? "#242424"
            : "#77746F",
          strokeWidth: selected ? 2.4 : isHovered ? 2.2 : 1.8,
          strokeDasharray: "0.1 7",
          strokeLinecap: "round",
          transition: "stroke 0.2s ease, opacity 0.3s ease",
          opacity: isAnimating ? 0.3 : 1,
        }}
      />

      {/* ------------------------------------------------------------------
          1.5–1.8 Second Cinematic Connection Establishment Animation
          ------------------------------------------------------------------ */}
      {isAnimating && (
        <g className="pointer-events-none">
          {/* Phase 1 (0–250ms): Source Handle Burnt-Orange Ignition Burst */}
          <circle cx={sourceX} cy={sourceY} r="3" fill="#E79570">
            <animate
              attributeName="r"
              values="3; 13; 15"
              begin={`${delaySec}s`}
              dur="0.32s"
              fill="freeze"
            />
            <animate
              attributeName="opacity"
              values="0.95; 0.35; 0"
              begin={`${delaySec}s`}
              dur="0.32s"
              fill="freeze"
            />
          </circle>
          <circle cx={sourceX} cy={sourceY} r="3" fill="#F2F0EC">
            <animate
              attributeName="opacity"
              values="1; 0"
              begin={`${delaySec}s`}
              dur="0.28s"
              fill="freeze"
            />
          </circle>

          {/* Phase 2 (200–1050ms): Progressively Drawing Flowing Laser Beam */}
          <path
            d={edgePath}
            fill="none"
            stroke={`url(#${energyGradId})`}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeDasharray="0.1 7"
            mask={`url(#${maskId})`}
            opacity={0.95}
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="-28"
              dur="0.45s"
              repeatCount="indefinite"
            />
          </path>

          {/* Phase 2 (200–1050ms): Dual Luminous Traveling Comet Particles */}
          <g>
            {/* Outer Accent Halo */}
            <circle r="7" fill="#E79570">
              <animateMotion
                path={edgePath}
                begin={`${drawStartSec}s`}
                dur="0.78s"
                fill="freeze"
                calcMode="spline"
                keyTimes="0; 1"
                keySplines="0.16 1 0.3 1"
              />
              <animate
                attributeName="opacity"
                values="0; 0.35; 0.35; 0"
                keyTimes="0; 0.08; 0.92; 1"
                begin={`${drawStartSec}s`}
                dur="0.8s"
                fill="freeze"
              />
            </circle>

            {/* Middle Warm Glow */}
            <circle r="4" fill="#F0A17B">
              <animateMotion
                path={edgePath}
                begin={`${drawStartSec}s`}
                dur="0.78s"
                fill="freeze"
                calcMode="spline"
                keyTimes="0; 1"
                keySplines="0.16 1 0.3 1"
              />
              <animate
                attributeName="opacity"
                values="0; 0.75; 0.75; 0"
                keyTimes="0; 0.06; 0.94; 1"
                begin={`${drawStartSec}s`}
                dur="0.8s"
                fill="freeze"
              />
            </circle>

            {/* Bright Core Spark */}
            <circle r="2.2" fill="#F2F0EC">
              <animateMotion
                path={edgePath}
                begin={`${drawStartSec}s`}
                dur="0.78s"
                fill="freeze"
                calcMode="spline"
                keyTimes="0; 1"
                keySplines="0.16 1 0.3 1"
              />
              <animate
                attributeName="opacity"
                values="0; 1; 1; 0"
                keyTimes="0; 0.04; 0.96; 1"
                begin={`${drawStartSec}s`}
                dur="0.8s"
                fill="freeze"
              />
            </circle>
          </g>

          {/* Phase 3 (1000–1450ms): Destination Arrival Shockwave Ripple */}
          <circle
            cx={targetX}
            cy={targetY}
            r="3"
            fill="none"
            stroke="#E79570"
            strokeWidth={1.5}
          >
            <animate
              attributeName="r"
              values="3; 16; 18"
              begin={`${destArrivalSec}s`}
              dur="0.45s"
              fill="freeze"
            />
            <animate
              attributeName="opacity"
              values="0.9; 0.3; 0"
              begin={`${destArrivalSec}s`}
              dur="0.45s"
              fill="freeze"
            />
          </circle>
          <circle
            cx={targetX}
            cy={targetY}
            r="3"
            fill="none"
            stroke="#F0A17B"
            strokeWidth={1.2}
          >
            <animate
              attributeName="r"
              values="3; 11; 12"
              begin={`${destArrivalSec}s`}
              dur="0.42s"
              fill="freeze"
            />
            <animate
              attributeName="opacity"
              values="0.95; 0.4; 0"
              begin={`${destArrivalSec}s`}
              dur="0.42s"
              fill="freeze"
            />
          </circle>

          {/* Phase 4 (1100–1650ms): Full Connection Confirmation Pulse */}
          <path
            d={edgePath}
            fill="none"
            stroke="#E79570"
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="0.1 7"
          >
            <animate
              attributeName="opacity"
              values="0; 0.85; 0.5; 0"
              keyTimes="0; 0.25; 0.65; 1"
              begin={`${confirmStartSec}s`}
              dur="0.58s"
              fill="freeze"
            />
          </path>
        </g>
      )}

      {/* Delete Connection Action Badge when hovered or selected */}
      {(selected || isHovered) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "auto",
            }}
            className="nodrag nopan pointer-events-auto z-50 animate-in fade-in zoom-in-75 duration-150"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <button
              type="button"
              style={{ pointerEvents: "auto" }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleDelete(e);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleDelete(e);
              }}
              onClick={handleDelete}
              className={`w-5 h-5 rounded-full bg-[#191919] border flex items-center justify-center shadow-lg transition-all duration-150 cursor-pointer active:scale-95 pointer-events-auto ${
                selected
                  ? "border-[#E79570] text-[#E79570] hover:bg-[#E79570] hover:text-[#0D0D0D]"
                  : "border-[#2A2A2A] text-[#A09D98] hover:border-[#E79570] hover:text-[#E79570] hover:bg-[#202020]"
              }`}
              title="Delete connection"
              aria-label="Delete connection"
            >
              <X className="w-3 h-3 stroke-[2.5]" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
