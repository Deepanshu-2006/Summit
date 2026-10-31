"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Layout,
  Server,
  Database,
  Layers,
  Cpu,
  GitBranch,
} from "lucide-react";
import type { SummitNode, NodeType } from "@/lib/canvas/types";

/**
 * Maps service type to its canonical Lucide icon
 */
function getServiceIcon(type: NodeType) {
  switch (type) {
    case "repository":
      return GitBranch;
    case "application":
      return Layout;
    case "database":
      return Database;
    case "cache":
      return Layers;
    case "worker":
      return Cpu;
    default:
      return Server;
  }
}

/**
 * Custom Summit Node Component
 * Minimal visual programming node matching Summit design language.
 * Contains only: Icon, Resource Name, Type Label, and Handles.
 */
export const SummitNodeComponent = memo(function SummitNodeComponent({
  data,
  selected,
}: NodeProps<SummitNode>) {
  const Icon = getServiceIcon(data.serviceType);

  return (
    <div
      className={`relative min-w-[190px] max-w-[240px] px-3.5 py-3 rounded-[8px] transition-all duration-150 select-none group ${
        selected
          ? "bg-[#161615] border-[1.5px] border-accent-orange shadow-[0_0_16px_rgba(216,135,98,0.18)]"
          : "bg-[#131312] border border-[#272725] hover:border-[#3D3D39] hover:bg-[#151514]"
      }`}
    >
      {/* Target Handle (Left): input dependencies */}
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className={`!w-[9px] !h-[9px] !-left-[5px] !bg-[#1E1E1C] !border-[1.5px] !transition-all duration-150 ${
          selected
            ? "!border-accent-orange !bg-accent-orange"
            : "!border-[#4A4A45] group-hover:!border-accent-orange"
        }`}
      />

      {/* Source Handle (Right): output dependencies */}
      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className={`!w-[9px] !h-[9px] !-right-[5px] !bg-[#1E1E1C] !border-[1.5px] !transition-all duration-150 ${
          selected
            ? "!border-accent-orange !bg-accent-orange"
            : "!border-[#4A4A45] group-hover:!border-accent-orange"
        }`}
      />

      {/* Node Content */}
      <div className="flex items-center gap-3">
        {/* Resource Icon */}
        <div
          className={`w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0 border transition-colors ${
            selected
              ? "bg-[#251E1A] border-[#4E3526] text-accent-orange"
              : "bg-[#1C1C1A] border-[#2E2E2B] text-[#B5B3AF] group-hover:text-[#FAF8F5]"
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>

        {/* Text Content */}
        <div className="min-w-0 flex-1">
          <h4
            className="font-mono text-[12.5px] font-medium text-[#FAF8F5] truncate leading-tight tracking-[-0.01em]"
            title={data.label}
          >
            {data.label}
          </h4>
          <p className="font-sans text-[11px] text-[#8E8C86] truncate leading-tight mt-0.5">
            {data.subType || data.serviceType}
          </p>
        </div>
      </div>
    </div>
  );
});
