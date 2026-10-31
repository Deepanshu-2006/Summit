"use client";

import React from "react";
import { Plus, Layout, Database, Cpu, Layers } from "lucide-react";

export interface BottomNodeSelectorProps {
  onSelectOption: (optionId: string) => void;
  onOpenDeployPalette: () => void;
}

// Authentic GitHub Brand Vector
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

// Authentic Docker Container Whale Vector
function DockerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186H8.1a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H5.136a.186.186 0 00-.186.185v1.888c0 .102.084.185.186.185m-2.928 0h2.12a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185M23.76 9.89a.82.82 0 00-.594-.367c-.22-.02-.85-.04-1.57.34-.33.175-.63.42-.9.72-.41-.26-.98-.44-1.68-.44h-.35a3.63 3.63 0 00-.65-1.28l-.34.22c.2.33.37.72.48 1.14l.03.11c-.55.15-2.02.58-2.63 1.95H.872a.87.87 0 00-.872.871c0 1.25.26 2.44.75 3.52.92 2.05 2.5 3.61 4.54 4.49 1.83.78 3.84 1.18 5.86 1.18 7.39 0 12.35-4.49 12.78-10.74.02-.13.04-.26.04-.39a.86.86 0 00-.17-.54" />
    </svg>
  );
}

const RESOURCE_ITEMS = [
  {
    id: "github",
    label: "GitHub Repository",
    icon: GitHubIcon,
    iconColor: "text-[#F2F0EC]",
    glowColor: "group-hover:text-[#F2F0EC]",
  },
  {
    id: "application",
    label: "Application",
    icon: Layout,
    iconColor: "text-[#72B69A]",
    glowColor: "group-hover:text-[#72B69A]",
  },
  {
    id: "database",
    label: "Database",
    icon: Database,
    iconColor: "text-[#93C5FD]",
    glowColor: "group-hover:text-[#93C5FD]",
  },
  {
    id: "docker",
    label: "Docker Image",
    icon: DockerIcon,
    iconColor: "text-[#60A5FA]",
    glowColor: "group-hover:text-[#60A5FA]",
  },
  {
    id: "worker",
    label: "Worker",
    icon: Cpu,
    iconColor: "text-[#D1A5F5]",
    glowColor: "group-hover:text-[#D1A5F5]",
  },
  {
    id: "cache",
    label: "Cache",
    icon: Layers,
    iconColor: "text-[#F0A17B]",
    glowColor: "group-hover:text-[#F0A17B]",
  },
];

/**
 * Premium Cylindrical Floating Dock
 * Styled to match Summit's neutral charcoal and burnt-orange design tokens.
 * Features a fully rounded pill-shaped capsule, neutral charcoal surface,
 * Summit's signature burnt-orange Deploy action, and restrained micro-interactions.
 * Guarantees all items including 'Cache' have generous breathing room and visibility.
 */
export function BottomNodeSelector({
  onSelectOption,
  onOpenDeployPalette,
}: BottomNodeSelectorProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 select-none max-w-[calc(100vw-32px)]">
      <nav
        aria-label="Resource dock"
        className="flex items-center gap-1 bg-[#141414]/95 backdrop-blur-md border border-[#2A2A2A] rounded-full py-1.5 pl-2 pr-4 shadow-[0_12px_36px_rgba(0,0,0,0.6)] overflow-x-auto no-scrollbar"
      >
        {/* Summit Burnt-Orange Primary Action: Deploy */}
        <button
          type="button"
          onClick={onOpenDeployPalette}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E79570] hover:bg-[#F0A17B] text-[#0D0D0D] font-sans font-semibold text-[12.5px] tracking-[-0.01em] shadow-[0_2px_10px_rgba(231,149,112,0.25)] active:scale-[0.97] transition-all duration-150 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E79570]/60"
          title="Open Deploy Palette (⌘K)"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Deploy</span>
        </button>

        {/* Subtle Vertical Divider */}
        <div className="w-px h-4 bg-[#242424] shrink-0 mx-1.5" />

        {/* Unified Capsule Resource Options */}
        {RESOURCE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectOption(item.id)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[#A09D98] hover:text-[#F2F0EC] hover:bg-[#202020] active:scale-[0.96] transition-all duration-150 text-[12.5px] font-sans font-medium shrink-0 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E79570]/60 group"
              title={`Add ${item.label}`}
            >
              <div
                className={`w-3.5 h-3.5 flex items-center justify-center ${item.iconColor} opacity-80 group-hover:opacity-100 transition-opacity shrink-0`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="tracking-[-0.01em]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
