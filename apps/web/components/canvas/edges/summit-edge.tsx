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
      {/* Primary Edge Line */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? "#D88762" : "#3E3E3B",
          strokeWidth: selected ? 1.8 : 1.4,
          transition: "stroke 0.15s, stroke-width 0.15s",
        }}
      />

      {/* Delete Edge Action Button when connection is selected */}
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
              className="w-4 h-4 rounded-full bg-[#181817] border border-[#444440] hover:border-accent-orange text-[#8E8C86] hover:text-[#FAF8F5] flex items-center justify-center shadow-md transition-colors cursor-pointer group"
              title="Delete connection"
              aria-label="Delete connection"
            >
              <X className="w-2.5 h-2.5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
