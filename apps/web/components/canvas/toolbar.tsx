"use client";

import React, { useState } from "react";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Layout,
  Server,
  Database,
  Layers,
  Cpu,
  GitBranch,
  HardDrive,
  Sparkles,
} from "lucide-react";
import { NODE_TEMPLATES, type NodeTemplate } from "@/lib/canvas/initial-graph";
import type { NodeType } from "@/lib/canvas/types";

interface CanvasToolbarProps {
  onAddNode: (template: NodeTemplate) => void;
}

function getTemplateIcon(type: NodeType) {
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

export function CanvasToolbar({ onAddNode }: CanvasToolbarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | "compute" | "database" | "storage">("all");

  const filteredTemplates = NODE_TEMPLATES.filter((tpl) => {
    const matchesSearch =
      tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.subType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === "all" ||
      (activeCategory === "storage" ? tpl.category === "storage" || tpl.category === "source" : tpl.category === activeCategory);
    return matchesSearch && matchesCategory;
  });

  const onDragStart = (event: React.DragEvent, template: NodeTemplate) => {
    event.dataTransfer.setData("application/summit-template", JSON.stringify(template));
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside
      className={`absolute left-4 top-20 z-20 flex flex-col transition-all duration-300 pointer-events-auto select-none ${
        isCollapsed ? "w-[48px]" : "w-[290px]"
      }`}
      aria-label="Infrastructure Resource Palette"
    >
      <div className="bg-[#141413]/95 border border-[#2B2B28] rounded-[10px] shadow-2xl shadow-black/80 backdrop-blur-xl overflow-hidden flex flex-col">
        {/* Toolbar Header */}
        <div className="p-3 border-b border-[#242422] flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#A0A09C] font-semibold">
                RESOURCES
              </span>
              <span className="font-mono text-[9.5px] px-1.5 py-0.2 rounded bg-[#20201E] border border-[#2C2C28] text-[#80807C]">
                {filteredTemplates.length}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-6 h-6 rounded-[5px] bg-[#1E1E1C] hover:bg-[#282825] border border-[#333330] text-[#A0A09C] hover:text-[#FAF8F5] flex items-center justify-center transition-colors cursor-pointer ml-auto"
            title={isCollapsed ? "Expand Palette" : "Collapse Palette"}
            aria-label={isCollapsed ? "Expand Palette" : "Collapse Palette"}
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Collapsed view quick-add trigger */}
        {isCollapsed ? (
          <div className="p-2 space-y-2 flex flex-col items-center">
            {NODE_TEMPLATES.slice(0, 5).map((tpl, i) => {
              const Icon = getTemplateIcon(tpl.serviceType);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onAddNode(tpl)}
                  className="w-8 h-8 rounded-[6px] bg-[#1B1B19] hover:bg-[#282824] border border-[#2F2F2B] text-[#A0A09C] hover:text-accent-orange flex items-center justify-center transition-colors cursor-pointer"
                  title={`Add ${tpl.name}`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        ) : (
          <>
            {/* Search and Category Filter */}
            <div className="p-3 pb-2 space-y-2 border-b border-[#242422]">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#6B6B67] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-7 pl-8 pr-2.5 rounded-[5px] bg-[#181816] border border-[#2E2E2A] focus:border-accent-orange text-[11px] font-mono text-[#F5F5F3] placeholder:text-[#666662] outline-none transition-colors"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1">
                {(["all", "compute", "database", "storage"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2 py-1 rounded-[4px] font-mono text-[9.5px] uppercase tracking-wider transition-colors cursor-pointer ${
                      activeCategory === cat
                        ? "bg-accent-orange/15 text-accent-orange border border-accent-orange/30 font-medium"
                        : "text-[#80807C] hover:text-[#B5B3AF] hover:bg-[#1E1E1C]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Template List */}
            <div className="p-2 space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto">
              {filteredTemplates.map((template, idx) => {
                const Icon = getTemplateIcon(template.serviceType);
                return (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => onDragStart(e, template)}
                    onClick={() => onAddNode(template)}
                    className="p-2.5 rounded-[7px] bg-[#181816] hover:bg-[#20201D] border border-[#292926] hover:border-accent-orange/50 transition-all cursor-grab active:cursor-grabbing group flex items-start gap-2.5"
                  >
                    <div className="w-6 h-6 rounded-[5px] bg-[#22221F] border border-[#33332F] group-hover:border-accent-orange/40 text-[#A0A09C] group-hover:text-accent-orange flex items-center justify-center shrink-0 transition-colors mt-0.5">
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[11.5px] font-medium text-[#FAF8F5] group-hover:text-accent-orange transition-colors truncate">
                          {template.name}
                        </span>
                        <Plus className="w-3.5 h-3.5 text-[#555550] group-hover:text-accent-orange shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[10px] text-[#7A7A75] leading-snug line-clamp-2 mt-0.5 font-sans">
                        {template.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Drag & Drop Hint */}
            <div className="p-2.5 border-t border-[#242422] bg-[#121211] flex items-center gap-1.5 text-[10px] font-mono text-[#666662]">
              <Sparkles className="w-3 h-3 text-accent-orange/70 shrink-0" />
              <span>Click or drag onto canvas</span>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

