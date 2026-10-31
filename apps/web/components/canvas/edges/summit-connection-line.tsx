"use client";

import React from "react";
import { getBezierPath, type ConnectionLineComponentProps } from "@xyflow/react";

/**
 * Summit Custom Connection Line Preview
 * Displayed while dragging manually from a node handle.
 * Features a thin, dotted preview line that smoothly follows the pointer,
 * an anchor dot at the source handle, and valid/invalid status targeting feedback.
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
  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });

  const isValid = connectionStatus === "valid";
  const isInvalid = connectionStatus === "invalid";

  return (
    <g className="pointer-events-none z-40">
      {/* Anchor point at source handle */}
      <circle
        cx={fromX}
        cy={fromY}
        r={3.5}
        fill="#D88762"
        opacity={0.9}
      />
      <circle
        cx={fromX}
        cy={fromY}
        r={6.5}
        fill="none"
        stroke="#D88762"
        strokeWidth={1}
        opacity={0.35}
      />

      {/* Thin dotted preview line */}
      <path
        d={edgePath}
        fill="none"
        stroke={isValid ? "#D88762" : isInvalid ? "#4A4944" : "#8E8C86"}
        strokeWidth={isValid ? 1.8 : 1.5}
        strokeDasharray="2 4"
        opacity={isInvalid ? 0.3 : isValid ? 0.95 : 0.75}
        className="transition-colors duration-150"
      />

      {/* Pointer target crosshair / indicator */}
      <circle
        cx={toX}
        cy={toY}
        r={isValid ? 4.5 : 3}
        fill={isValid ? "#D88762" : "#FAF8F5"}
        opacity={0.9}
        className="transition-all duration-150"
      />
      {isValid && (
        <circle
          cx={toX}
          cy={toY}
          r={8}
          fill="none"
          stroke="#D88762"
          strokeWidth={1.2}
          opacity={0.45}
        />
      )}
    </g>
  );
}

