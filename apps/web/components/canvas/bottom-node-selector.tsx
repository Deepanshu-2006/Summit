"use client";

import React from "react";
import { Layout, Database, Plus } from "lucide-react";
import type { ResourceTemplate } from "@/lib/canvas/types";

export interface BottomNodeSelectorProps {
  onSelectOption: (optionId: string) => void;
  onOpenDeployPalette: () => void;
}

export interface BottomBarOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  type: ResourceTemplate["type"];
  subType: string;
  defaultLabel: string;
}

// Authentic GitHub Brand Icon
function GitHubIcon({ className }: { className?: string }) {
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

// Authentic Docker Container Whale Icon
function DockerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186H8.1a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H5.136a.186.186 0 00-.186.185v1.888c0 .102.084.185.186.185m-2.928 0h2.12a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185M23.76 9.89a.82.82 0 00-.594-.367c-.22-.02-.85-.04-1.57.34-.33.175-.63.42-.9.72-.41-.26-.98-.44-1.68-.44h-.35a3.63 3.63 0 00-.65-1.28l-.34.22c.2.33.37.72.48 1.14l.03.11c-.55.15-2.02.58-2.63 1.95H.872a.87.87 0 00-.872.871c0 1.25.26 2.44.75 3.52.92 2.05 2.5 3.61 4.54 4.49 1.83.78 3.84 1.18 5.86 1.18 7.39 0 12.35-4.49 12.78-10.74.02-.13.04-.26.04-.39a.86.86 0 00-.17-.54" />
    </svg>
  );
}

export const BOTTOM_BAR_OPTIONS: BottomBarOption[] = [
  {
    id: "github",
    label: "GitHub Repository",
    icon: GitHubIcon,
    type: "repository",
    subType: "GitHub Repository",
    defaultLabel: "github-repo",
  },
  {
    id: "application",
    label: "Application",
    icon: Layout,
    type: "application",
    subType: "Application",
    defaultLabel: "web-app",
  },
  {
    id: "database",
    label: "Database",
    icon: Database,
    type: "database",
    subType: "Database",
    defaultLabel: "postgres-db",
  },
  {
    id: "docker",
    label: "Docker Image",
    icon: DockerIcon,
    type: "application",
    subType: "Docker Image",
    defaultLabel: "docker-service",
  },
];

export function BottomNodeSelector({
  onSelectOption,
  onOpenDeployPalette,
}: BottomNodeSelectorProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 select-none max-w-[calc(100vw-32px)]">
      <nav
        aria-label="Node selector bar"
        className="flex items-center gap-1.5 bg-[#121113]/95 backdrop-blur-md border border-[#26242B] rounded-[12px] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.85)] overflow-x-auto no-scrollbar"
      >
        {/* Railway Signature '+ Deploy' Button (Opens Deploy Palette) */}
        <button
          type="button"
          onClick={onOpenDeployPalette}
          className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-[#1E1925] border border-[#3A2D4A] hover:bg-[#271F32] hover:border-[#4B3B60] text-accent-orange transition-all duration-150 text-[12.5px] font-sans font-semibold tracking-[-0.01em] shrink-0 cursor-pointer shadow-[0_0_16px_rgba(216,135,98,0.12)]"
          title="Open Deploy Palette (⌘K)"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Deploy</span>
        </button>

        <div className="w-px h-4 bg-[#232128] shrink-0 mx-0.5" />

        {/* Resource Buttons */}
        {BOTTOM_BAR_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectOption(opt.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] hover:bg-[#1C1A20] active:bg-[#222026] text-[#A1A09A] hover:text-[#FAF8F5] transition-colors text-[12px] font-sans shrink-0 cursor-pointer"
              title={`Choose ${opt.label}`}
            >
              <div className="w-4 h-4 flex items-center justify-center text-[#7A7873] group-hover:text-[#FAF8F5] transition-colors">
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium tracking-[-0.01em]">
                {opt.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
