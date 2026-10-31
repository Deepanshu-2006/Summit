"use client";

import React, { memo, useState, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Layout,
  Cpu,
  Box,
  HardDrive,
  CheckCircle2,
  Database,
} from "lucide-react";
import type { SummitNode, NodeType } from "@/lib/canvas/types";

// Authentic GitHub Brand Icon
function GitHubOctocatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

// Authentic PostgreSQL Elephant Icon
function PostgresElephantIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.14 2.53 7.69 6.12 9.17-.08-.7-.12-1.52-.12-2.17 0-1.8.44-3.5 1.25-4.99-.44-.22-.9-.4-1.38-.52-1.33-.33-2.18-1.52-2.18-2.89 0-1.54 1.15-2.83 2.67-2.98.65-.07 1.31.06 1.9.36.42-.51.93-.94 1.51-1.26C11.95 6.07 12 5.37 12 5c0-.6.18-1.18.52-1.68C12.18 3.1 12.09 3 12 3zm6.86 7.64c-.2-.04-.4-.06-.6-.06-1.05 0-2.02.48-2.66 1.29-.62-.31-1.31-.47-2.01-.47-2.48 0-4.5 2.02-4.5 4.5 0 .61.12 1.2.35 1.74-1.11 1.53-1.74 3.39-1.74 5.36 0 .47.04.93.1 1.38 1.25.76 2.72 1.2 4.29 1.2 4.65 0 8.44-3.56 8.87-8.1-.63.26-1.32.4-2.05.4-.55 0-1.07-.08-1.56-.24.58-.87.91-1.9.91-3 0-1.71-.82-3.23-2.1-4.2.43-.5.98-.9 1.6-1.14-.3-.39-.62-.73-.9-.66z" />
    </svg>
  );
}

// Authentic Redis 3D Isometric Cube Icon
function RedisCubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.5 7.5L12 2l9.5 5.5v9L12 22l-9.5-5.5v-9zm10.5 12.18l7.5-4.34V8.66l-7.5 4.34v6.68zm-2-6.68L3.5 8.66v6.68l7.5 4.34v-6.68zm8.5-5.5l-7.5-4.34-7.5 4.34 7.5 4.34 7.5-4.34z" />
    </svg>
  );
}

// Authentic Docker Container Whale Icon
function DockerWhaleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186H8.1a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H5.136a.186.186 0 00-.186.185v1.888c0 .102.084.185.186.185m-2.928 0h2.12a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185M23.76 9.89a.82.82 0 00-.594-.367c-.22-.02-.85-.04-1.57.34-.33.175-.63.42-.9.72-.41-.26-.98-.44-1.68-.44h-.35a3.63 3.63 0 00-.65-1.28l-.34.22c.2.33.37.72.48 1.14l.03.11c-.55.15-2.02.58-2.63 1.95H.872a.87.87 0 00-.872.871c0 1.25.26 2.44.75 3.52.92 2.05 2.5 3.61 4.54 4.49 1.83.78 3.84 1.18 5.86 1.18 7.39 0 12.35-4.49 12.78-10.74.02-.13.04-.26.04-.39a.86.86 0 00-.17-.54" />
    </svg>
  );
}

/**
 * Resolves exact Railway-style icon, status description, and volume tag
 */
function getRailwayNodeDetails(data: SummitNode["data"]) {
  if (data.subType === "Docker Image") {
    return {
      Icon: DockerWhaleIcon,
      iconColor: "text-[#60A5FA]",
      statusText: "Just deployed via Docker",
      volumeTag: "docker-volume",
      isDatabase: false,
    };
  }

  switch (data.serviceType) {
    case "repository":
      return {
        Icon: GitHubOctocatIcon,
        iconColor: "text-[#F2F0EC]",
        statusText: "Just deployed via GitHub",
        volumeTag: `branch: ${data.branch || "main"}`,
        isDatabase: false,
      };
    case "database":
      if (data.databaseEngine === "mysql" || data.subType === "MySQL") {
        return {
          Icon: Database,
          iconColor: "text-[#E08A58]",
          statusText: "Ready to be deployed",
          volumeTag: "mysql-data",
          isDatabase: true,
        };
      }
      return {
        Icon: PostgresElephantIcon,
        iconColor: "text-[#86CDDE]",
        statusText: "Ready to be deployed",
        volumeTag: "pg-data",
        isDatabase: true,
      };
    case "cache":
      return {
        Icon: RedisCubeIcon,
        iconColor: "text-[#F87171]",
        statusText: "Just deployed",
        volumeTag: "redis-volume",
        isDatabase: true,
      };
    case "application":
      return {
        Icon: Layout,
        iconColor: "text-[#93DDA7]",
        statusText: "Just deployed via GitHub",
        volumeTag: data.rootDir ? `root: ${data.rootDir}` : "web-service",
        isDatabase: false,
      };
    case "worker":
      return {
        Icon: Cpu,
        iconColor: "text-[#CCA7E8]",
        statusText: "Active worker process",
        volumeTag: "queue-worker",
        isDatabase: false,
      };
    default:
      return {
        Icon: Layout,
        iconColor: "text-[#F2F0EC]",
        statusText: "Just deployed",
        volumeTag: "main-volume",
        isDatabase: false,
      };
  }
}

/**
 * Exact Railway-Style Node Component
 * Compact, tactile infrastructure card with top icon & title,
 * middle deployment status with green checkmark, bottom volume badge,
 * and optional card-stack depth.
 */
export const SummitNodeComponent = memo(function SummitNodeComponent({
  id,
  data,
  selected,
}: NodeProps<SummitNode>) {
  const { Icon, iconColor, statusText, volumeTag, isDatabase } =
    getRailwayNodeDetails(data);

  // Connection Animation Feedback
  const [isConnectionTarget, setIsConnectionTarget] = useState(false);
  const [isConnectionSource, setIsConnectionSource] = useState(false);

  useEffect(() => {
    const handleConnectionPulse = (e: Event) => {
      const custom = e as CustomEvent<{ sourceId: string; targetId: string }>;
      if (custom.detail?.targetId === id) {
        setIsConnectionTarget(true);
        const timer = setTimeout(() => setIsConnectionTarget(false), 1800);
        return () => clearTimeout(timer);
      }
      if (custom.detail?.sourceId === id) {
        setIsConnectionSource(true);
        const timer = setTimeout(() => setIsConnectionSource(false), 380);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener("summit:connection-pulse", handleConnectionPulse);
    return () =>
      window.removeEventListener("summit:connection-pulse", handleConnectionPulse);
  }, [id]);

  return (
    <div
      data-selected={selected ? "true" : "false"}
      className="relative select-none group"
    >
      {/* Main Node Card */}
      <div
        className={`relative w-[270px] min-h-[104px] p-3.5 rounded-[12px] transition-all duration-150 cursor-grab active:cursor-grabbing ${
          selected
            ? "bg-[#191919] border border-[#E79570] shadow-[0_0_0_1px_#E79570,0_8px_24px_rgba(231,149,112,0.18)]"
            : isConnectionTarget || isConnectionSource
            ? "bg-[#191919] border border-[#E79570] shadow-[0_4px_18px_rgba(231,149,112,0.18)]"
            : "bg-[#141414] border border-[#2A2A2A] hover:bg-[#191919] hover:border-[#383838] shadow-[0_4px_20px_rgba(0,0,0,0.6)]"
        }`}
      >
        {/* Subtle Visual Connection Locators (Visible on hover, zero-gap border alignment) */}
        <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#191919] border border-[#2A2A2A] group-hover:border-[#E79570] opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-20" />
        <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#191919] border border-[#2A2A2A] group-hover:border-[#E79570] opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-20" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#191919] border border-[#2A2A2A] group-hover:border-[#E79570] opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-20" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full bg-[#191919] border border-[#2A2A2A] group-hover:border-[#E79570] opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-20" />

        {/* Exact Geometric Center Connection Anchors on 4 Edges — Zero Gaps, 0.0px Pixel Precision */}
        {/* Left Edge Anchor */}
        <Handle
          type="source"
          position={Position.Left}
          id="target"
          className="!absolute !w-0 !h-0 !p-0 !m-0 !border-0 !bg-transparent !outline-none !shadow-none !opacity-0 cursor-crosshair z-30 after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-7 after:h-7 after:pointer-events-auto"
          style={{ left: 0, top: "50%", transform: "translateY(-50%)" }}
        />
        <Handle
          type="source"
          position={Position.Left}
          id="left"
          className="!absolute !w-0 !h-0 !p-0 !m-0 !border-0 !bg-transparent !outline-none !shadow-none !opacity-0 cursor-crosshair z-30 after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-7 after:h-7 after:pointer-events-auto"
          style={{ left: 0, top: "50%", transform: "translateY(-50%)" }}
        />

        {/* Right Edge Anchor */}
        <Handle
          type="source"
          position={Position.Right}
          id="source"
          className="!absolute !w-0 !h-0 !p-0 !m-0 !border-0 !bg-transparent !outline-none !shadow-none !opacity-0 cursor-crosshair z-30 after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-7 after:h-7 after:pointer-events-auto"
          style={{ right: 0, top: "50%", transform: "translateY(-50%)" }}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!absolute !w-0 !h-0 !p-0 !m-0 !border-0 !bg-transparent !outline-none !shadow-none !opacity-0 cursor-crosshair z-30 after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-7 after:h-7 after:pointer-events-auto"
          style={{ right: 0, top: "50%", transform: "translateY(-50%)" }}
        />

        {/* Top Edge Anchor */}
        <Handle
          type="source"
          position={Position.Top}
          id="top"
          className="!absolute !w-0 !h-0 !p-0 !m-0 !border-0 !bg-transparent !outline-none !shadow-none !opacity-0 cursor-crosshair z-30 after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-7 after:h-7 after:pointer-events-auto"
          style={{ top: 0, left: "50%", transform: "translateX(-50%)" }}
        />

        {/* Bottom Edge Anchor */}
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="!absolute !w-0 !h-0 !p-0 !m-0 !border-0 !bg-transparent !outline-none !shadow-none !opacity-0 cursor-crosshair z-30 after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-7 after:h-7 after:pointer-events-auto"
          style={{ bottom: 0, left: "50%", transform: "translateX(-50%)" }}
        />

        {/* Top Row: Brand Icon + Title + Status Badge */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <h4
              className="font-sans text-[14.5px] font-semibold text-[#F2F0EC] truncate tracking-[-0.015em] leading-snug"
              title={data.label}
            >
              {data.label}
            </h4>
          </div>

          {/* Railway 'New' Status Pill Badge */}
          {isDatabase ? (
            <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#17261F] text-[#72B69A] border border-[#264535] shrink-0">
              New
            </span>
          ) : (
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#72B69A] shrink-0 mr-1"
              title="Configured"
            />
          )}
        </div>

        {/* Middle Row: Green Checkmark Circle + Deployment Status */}
        <div className="flex items-center gap-1.5 mt-2.5 text-[12px] text-[#8F8C86] font-sans">
          <svg
            className="w-3.5 h-3.5 text-[#72B69A] shrink-0"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14zm3.854-8.854a.5.5 0 0 0-.708-.708L7.5 9.043 5.354 6.896a.5.5 0 1 0-.708.708l2.5 2.5a.5.5 0 0 0 .708 0l4-4z"
            />
          </svg>
          <span className="truncate">{statusText}</span>
        </div>

        {/* Bottom Row: Volume / Storage / Branch compartment */}
        <div className="mt-2.5 pt-2 border-t border-[#242424] flex items-center gap-1.5 text-[11px] font-mono text-[#77746F]">
          <HardDrive className="w-3 h-3 text-[#77746F] shrink-0" />
          <span className="truncate">{volumeTag}</span>
        </div>
      </div>
    </div>
  );
});
