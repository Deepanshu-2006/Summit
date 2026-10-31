"use client";

import React from "react";
import { getBezierPath, type ConnectionLineComponentProps } from "@xyflow/react";

/**
 * Summit Animated Drag Connection Line
 * Displayed in real-time while dragging manually between nodes.
 * Features an animated flowing dash stroke, magnetic anchor pulse,
 * and high-contrast targeting feedback for fluid tactile interaction.
 */
export function SummitConnectionLineComponent({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  connectionStatus,
}: ConnectionLineComponentProps) {
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });

  const isValid = connectionStatus === "valid";
  const isInvalid = connectionStatus === "invalid";

  const strokeColor = isValid ? "#E79570" : isInvalid ? "#77746F" : "#E79570";

  return (
    <g className="pointer-events-none z-50">
      {/* Dynamic Source Anchor Ring with Breathing Pulse */}
      <circle
        cx={fromX}
        cy={fromY}
        r={7}
        fill="none"
        stroke="#E79570"
        strokeWidth={1.2}
      >
        <animate
          attributeName="r"
          values="5; 9; 5"
          dur="1.5s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.8; 0.25; 0.8"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Solid Source Anchor Core */}
      <circle cx={fromX} cy={fromY} r={3.5} fill="#E79570" />

      {/* Animated Flowing Round Dotted Drag Line */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isValid ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeDasharray="0.1 7"
        opacity={isInvalid ? 0.35 : 0.95}
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to="-28"
          dur="0.55s"
          repeatCount="indefinite"
        />
      </path>

      {/* Cursor Target Reticle & Magnetic Snap Feedback */}
      {isValid ? (
        // Snapped to Valid Node: Radiant Burnt-Orange Reticle
        <g>
          <circle
            cx={toX}
            cy={toY}
            r={13}
            fill="rgba(231, 149, 112, 0.16)"
            stroke="#E79570"
            strokeWidth={1.5}
          >
            <animate
              attributeName="r"
              values="11; 14; 11"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx={toX} cy={toY} r={4} fill="#E79570" />
          <circle cx={toX} cy={toY} r={2} fill="#F2F0EC" />
        </g>
      ) : (
        // Free Dragging Reticle
        <g>
          <circle
            cx={toX}
            cy={toY}
            r={7}
            fill="none"
            stroke={isInvalid ? "#77746F" : "#E79570"}
            strokeWidth={1.2}
            opacity={0.65}
          />
          <circle
            cx={toX}
            cy={toY}
            r={3}
            fill={isInvalid ? "#77746F" : "#F2F0EC"}
          />
        </g>
      )}
    </g>
  );
}
