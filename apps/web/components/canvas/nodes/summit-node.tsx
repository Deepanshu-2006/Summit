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
  HardDrive,
  ExternalLink,
  Circle,
  Activity,
  Terminal,
} from "lucide-react";
import type { SummitNode, NodeType, NodeStatus } from "@/lib/canvas/types";

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
    case "storage":
      return HardDrive;
    default:
      return Server;
  }
}

/**
 * Status indicator badge config
 */
function getStatusConfig(status: NodeStatus) {
  switch (status) {
    case "live":
      return {
        label: "LIVE",
        color: "#83B69A",
        bg: "rgba(131, 182, 154, 0.12)",
        dot: "bg-[#83B69A]",
      };
    case "building":
      return {
        label: "BUILDING",
        color: "#D6AD72",
        bg: "rgba(214, 173, 114, 0.14)",
        dot: "bg-[#D6AD72] animate-pulse",
      };
    case "deploying":
      return {
        label: "DEPLOYING",
        color: "#D88762",
        bg: "rgba(216, 135, 98, 0.14)",
        dot: "bg-[#D88762] animate-ping",
      };
    case "failed":
      return {
        label: "FAILED",
        color: "#D77D7D",
        bg: "rgba(215, 125, 125, 0.14)",
        dot: "bg-[#D77D7D]",
      };
    case "stopped":
      return {
        label: "STOPPED",
        color: "#777777",
        bg: "rgba(119, 119, 119, 0.12)",
        dot: "bg-[#777777]",
      };
    default:
      return {
        label: "READY",
        color: "#8E8C86",
        bg: "rgba(142, 140, 134, 0.12)",
        dot: "bg-[#8E8C86]",
      };
  }
}

/**
 * Custom Summit Node Component
 * Compact, architectural, dark-alpine card matching Summit design language.
 */
export const SummitNodeComponent = memo(function SummitNodeComponent({
  id,
  data,
  selected,
}: NodeProps<SummitNode>) {
  const Icon = getServiceIcon(data.serviceType);
  const statusCfg = getStatusConfig(data.status);

  // Type-specific color accents
  const isRepo = data.serviceType === "repository";
  const isDb = data.serviceType === "database" || data.serviceType === "cache";
  const isApp = data.serviceType === "application";
  const isWorker = data.serviceType === "worker";

  return (
    <div
      className={`relative w-[280px] rounded-[10px] transition-all duration-200 select-none group ${
        selected
          ? "bg-[#1C1B1A] border-[1.5px] border-accent-orange shadow-[0_0_24px_rgba(216,135,98,0.22),0_8px_32px_rgba(0,0,0,0.8)]"
          : "bg-[#161615]/95 border border-[#2B2B28] hover:border-[#42423E] hover:shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
      }`}
      style={{
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Target Handle (Left): accepts incoming dependencies */}
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className="!w-[11px] !h-[11px] !-left-[6px] !bg-[#1E1E1C] !border-[2px] !border-[#444440] hover:!border-accent-orange hover:!scale-125 !transition-all"
        style={{
          boxShadow: selected ? "0 0 8px rgba(216, 135, 98, 0.6)" : "none",
        }}
      />

      {/* Source Handle (Right): provides service output/connections */}
      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className="!w-[11px] !h-[11px] !-right-[6px] !bg-[#1E1E1C] !border-[2px] !border-[#444440] hover:!border-accent-orange hover:!scale-125 !transition-all"
        style={{
          boxShadow: selected ? "0 0 8px rgba(216, 135, 98, 0.6)" : "none",
        }}
      />

      {/* ---------------- Node Header ---------------- */}
      <div className="p-3 pb-2.5 border-b border-[#242422] flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Icon Badge */}
          <div
            className={`w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0 border ${
              isRepo
                ? "bg-[#2A231F] border-[#4E3526] text-accent-orange"
                : isDb
                ? "bg-[#1F2923] border-[#2A4434] text-semantic-success"
                : isApp
                ? "bg-[#1E252D] border-[#2E3C4B] text-[#9AC5EC]"
                : "bg-[#25221F] border-[#3E3830] text-[#D6AD72]"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>

          {/* Name & Subtype */}
          <div className="min-w-0 flex-1">
            <h4
              className="font-mono text-[12.5px] font-semibold text-[#F5F5F3] truncate tracking-[-0.01em]"
              title={data.label}
            >
              {data.label}
            </h4>
            <p className="font-mono text-[10px] text-[#8E8C86] truncate">
              {data.subType || data.serviceType}
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] font-mono text-[9px] font-medium shrink-0"
          style={{
            backgroundColor: statusCfg.bg,
            color: statusCfg.color,
          }}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
          <span>{statusCfg.label}</span>
        </div>
      </div>

      {/* ---------------- Node Body ---------------- */}
      <div className="p-3 pt-2.5 space-y-2">
        {/* Key Attributes Row */}
        <div className="flex items-center justify-between text-[11px] font-mono text-[#A0A09C]">
          {/* Port or Branch or Engine */}
          <div className="flex items-center gap-1.5 truncate">
            {data.port && (
              <span className="px-1.5 py-0.5 rounded-[3px] bg-[#222220] border border-[#2E2E2A] text-[#FAF8F5] text-[10px]">
                :{data.port}
              </span>
            )}
            {data.branch && (
              <span className="flex items-center gap-1 text-[10.5px] text-[#B5B3AF]">
                <GitBranch className="w-3 h-3 text-accent-orange" />
                {data.branch}
              </span>
            )}
            {data.databaseEngine && (
              <span className="text-[10.5px] text-[#B5B3AF]">
                {data.databaseEngine.toUpperCase()}
              </span>
            )}
          </div>

          {/* Region */}
          <span className="text-[10px] text-[#70706C] shrink-0">
            {data.region}
          </span>
        </div>

        {/* Live URL / Commit metadata */}
        {data.liveUrl && (
          <div className="flex items-center justify-between pt-1 border-t border-[#222220]">
            <a
              href={data.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[10px] font-mono text-accent-orange hover:underline truncate max-w-[210px]"
            >
              <span className="truncate">{data.liveUrl.replace("https://", "")}</span>
              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
            </a>
            <span className="font-mono text-[9px] text-[#60605C]">
              200 OK
            </span>
          </div>
        )}

        {/* Real-time telemetry indicators (CPU / RAM) */}
        {data.status === "live" && data.metrics.memoryLimitMb > 0 && (
          <div className="pt-1.5 border-t border-[#222220] flex items-center justify-between text-[9.5px] font-mono text-[#777774]">
            <div className="flex items-center gap-1">
              <Activity className="w-2.5 h-2.5 text-accent-orange" />
              <span>{data.metrics.cpuPct}% CPU</span>
            </div>
            <span>
              {data.metrics.memoryMb}MB / {data.metrics.memoryLimitMb}MB
            </span>
          </div>
        )}
      </div>

      {/* Selected Indicator Glow Corner */}
      {selected && (
        <div className="absolute -top-[1px] -right-[1px] w-2.5 h-2.5 bg-accent-orange rounded-tr-[9px] pointer-events-none" />
      )}
    </div>
  );
});

