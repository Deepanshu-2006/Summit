"use client";

import React, { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { X } from "lucide-react";

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
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {/* Background glow when edge is selected */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke="#D88762"
          strokeWidth={6}
          strokeOpacity={0.25}
          strokeLinecap="round"
        />
      )}

      {/* Primary Edge Path */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? "#D88762" : style.stroke || "#8E8C86",
          strokeWidth: selected ? 2.2 : style.strokeWidth || 1.6,
          transition: "stroke 0.2s, stroke-width 0.2s",
        }}
      />

      {/* Delete Edge Action Button on hover / selected */}
      {selected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                window.dispatchEvent(
                  new CustomEvent("summit:delete-edge", { detail: { id } })
                );
              }}
              className="w-5 h-5 rounded-full bg-[#1A1918] border border-[#444440] hover:border-accent-orange text-[#8E8C86] hover:text-[#FAF8F5] flex items-center justify-center shadow-lg transition-colors cursor-pointer group"
              title="Delete connection"
              aria-label="Delete connection"
            >
              <X className="w-3 h-3 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

