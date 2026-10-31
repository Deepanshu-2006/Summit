"use client";

import React, { memo, useState, useEffect, useCallback } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
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
 * Features:
 * 1. Automatic Vertical & Horizontal Geometry Awareness:
 *    - For vertical arrangements (e.g. backend above postgres): renders Railway's signature
 *      illuminated bundle of fine parallel vertical flow rays with a soft radiant center aura.
 *    - For horizontal arrangements (e.g. backend to redis): renders a sleek cubic Bézier stream.
 * 2. 1.5–2 Second Connection Establishment Sequence:
 *    - Phase 1 (0–300ms): Source handle pulse & initial path reveal.
 *    - Phase 2 (300–1100ms): Progressive path drawing with luminous traveling particle.
 *    - Phase 3 (1100–1500ms): Destination handle arrival pulse & full connection illumination.
 *    - Phase 4 (1500–1800ms): Smooth transition into calm, permanent state.
 * 3. Settled State (>1800ms):
 *    - Crisp, thin neutral-gray dotted line (2px dots, 4px gap) that stays clean and calm.
 *    - Effortless hover/selection with centered delete badge (X).
 */
export const SummitEdgeComponent = memo(function SummitEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
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

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

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
  const gradientId = `summit-conn-grad-${cleanId}`;
  const confirmGradId = `summit-confirm-grad-${cleanId}`;

  const delaySec = delayMs / 1000;
  const drawStartSec = (delayMs + 280) / 1000;
  const destPulseSec = (delayMs + 1080) / 1000;
  const confirmStartSec = (delayMs + 1100) / 1000;

  // Check if connection is predominantly vertical (like Railway's backend-postgres demo)
  const isVertical = Math.abs(targetY - sourceY) > Math.abs(targetX - sourceX) * 0.7;
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  return (
    <>
      <defs>
        {/* Connection Establishment Gradient: Burnt Orange to Blue-Violet */}
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D88762" stopOpacity={0.85} />
          <stop offset="55%" stopColor="#818CF8" stopOpacity={0.95} />
          <stop offset="100%" stopColor="#A5B4FC" stopOpacity={0.9} />
        </linearGradient>

        {/* Confirmation Pulse Gradient */}
        <linearGradient id={confirmGradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D88762" stopOpacity={0.4} />
          <stop offset="50%" stopColor="#818CF8" stopOpacity={0.8} />
          <stop offset="100%" stopColor="#A5B4FC" stopOpacity={0.6} />
        </linearGradient>

        {/* Radial Luminous Center Glow for Vertical Network Bundles (Railway aesthetic) */}
        <radialGradient id={`glow-${cleanId}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.16} />
          <stop offset="60%" stopColor="#818CF8" stopOpacity={0.06} />
          <stop offset="100%" stopColor="#818CF8" stopOpacity={0} />
        </radialGradient>

        {/* SVG Mask for Progressive Path Drawing from Source to Destination */}
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
                dur="0.82s"
                fill="freeze"
                calcMode="spline"
                keyTimes="0; 1"
                keySplines="0.25 0.1 0.25 1"
              />
            </path>
          </mask>
        )}
      </defs>

      {/* Railway Subtle Luminous Center Aura between Connected Nodes */}
      {isVertical && (
        <ellipse
          cx={midX}
          cy={midY}
          rx={55}
          ry={35}
          fill={`url(#glow-${cleanId})`}
          className="pointer-events-none"
        />
      )}

      {/* Broad invisible hit path (26px) for effortless hover & selection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={26}
        className="cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Railway Multi-Ray Vertical Flow Bundle (when vertical) */}
      {isVertical && (
        <g className="pointer-events-none opacity-30">
          <path
            d={`M ${sourceX - 8} ${sourceY} C ${sourceX - 8} ${midY}, ${targetX - 8} ${midY}, ${targetX - 8} ${targetY}`}
            fill="none"
            stroke="#38BDF8"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
          <path
            d={`M ${sourceX + 8} ${sourceY} C ${sourceX + 8} ${midY}, ${targetX + 8} ${midY}, ${targetX + 8} ${targetY}`}
            fill="none"
            stroke="#38BDF8"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        </g>
      )}

      {/* Permanent Connected State: Thin, elegant dotted line */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected
            ? "#D88762"
            : isHovered
            ? "#6E6B65"
            : isAnimating
            ? "#2C2B28"
            : "#44433F",
          strokeWidth: selected ? 2 : 1.5,
          strokeDasharray: "2 4",
          transition: "stroke 0.25s ease, opacity 0.35s ease",
          opacity: isAnimating ? 0.35 : 1,
        }}
      />

      {/* ------------------------------------------------------------------
          1.5–2 Second Connection Establishment Animation
          ------------------------------------------------------------------ */}
      {isAnimating && (
        <g className="pointer-events-none">
          {/* Phase 1 (0–300ms): Source Handle Burnt-Orange Pulse */}
          <circle cx={sourceX} cy={sourceY} r="3" fill="#D88762">
            <animate
              attributeName="r"
              values="3; 10; 12"
              begin={`${delaySec}s`}
              dur="0.32s"
              fill="freeze"
            />
            <animate
              attributeName="opacity"
              values="0.95; 0.4; 0"
              begin={`${delaySec}s`}
              dur="0.32s"
              fill="freeze"
            />
          </circle>

          {/* Phase 2 (300–1100ms): Progressively Drawing Dashed Line */}
          <path
            d={edgePath}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={1.6}
            strokeDasharray="3 3"
            strokeLinecap="round"
            mask={`url(#${maskId})`}
            opacity={0.9}
          />

          {/* Phase 2 (300–1100ms): Luminous Particle Travelling Along Path */}
          <g>
            <circle r="4.5" fill="#818CF8">
              <animateMotion
                path={edgePath}
                begin={`${drawStartSec}s`}
                dur="0.82s"
                fill="freeze"
                calcMode="spline"
                keyTimes="0; 1"
                keySplines="0.25 0.1 0.25 1"
              />
              <animate
                attributeName="opacity"
                values="0; 0.45; 0.45; 0"
                keyTimes="0; 0.08; 0.92; 1"
                begin={`${drawStartSec}s`}
                dur="0.84s"
                fill="freeze"
              />
            </circle>

            <circle r="2" fill="#FAF8F5">
              <animateMotion
                path={edgePath}
                begin={`${drawStartSec}s`}
                dur="0.82s"
                fill="freeze"
                calcMode="spline"
                keyTimes="0; 1"
                keySplines="0.25 0.1 0.25 1"
              />
              <animate
                attributeName="opacity"
                values="0; 1; 1; 0"
                keyTimes="0; 0.05; 0.95; 1"
                begin={`${drawStartSec}s`}
                dur="0.84s"
                fill="freeze"
              />
            </circle>
          </g>

          {/* Phase 2 End (~1100ms): Destination Handle Soft Pulse on Arrival */}
          <circle cx={targetX} cy={targetY} r="3" fill="#818CF8">
            <animate
              attributeName="r"
              values="3; 11; 13"
              begin={`${destPulseSec}s`}
              dur="0.42s"
              fill="freeze"
            />
            <animate
              attributeName="opacity"
              values="0.85; 0.35; 0"
              begin={`${destPulseSec}s`}
              dur="0.42s"
              fill="freeze"
            />
          </circle>

          {/* Phase 3 (1100–1500ms): Full Connection Illumination & Confirmation Pulse */}
          <path
            d={edgePath}
            fill="none"
            stroke={`url(#${confirmGradId})`}
            strokeWidth={1.8}
            strokeDasharray="2 4"
          >
            <animate
              attributeName="opacity"
              values="0; 0.85; 0.6; 0"
              keyTimes="0; 0.25; 0.65; 1"
              begin={`${confirmStartSec}s`}
              dur="0.65s"
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
              className={`w-5 h-5 rounded-full bg-[#181816] border flex items-center justify-center shadow-lg transition-all duration-150 cursor-pointer active:scale-95 pointer-events-auto ${
                selected
                  ? "border-accent-orange text-accent-orange hover:bg-accent-orange hover:text-[#121110]"
                  : "border-[#4A4944] text-[#B5B3AF] hover:border-accent-orange hover:text-accent-orange hover:bg-[#201C1A]"
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
