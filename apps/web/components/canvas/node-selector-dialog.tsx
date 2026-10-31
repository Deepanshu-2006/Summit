"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  X,
  Layout,
  Server,
  Cpu,
  Database,
  Layers,
  GitBranch,
} from "lucide-react";
import { SUPPORTED_RESOURCES } from "@/lib/canvas/initial-graph";
import type { ResourceTemplate } from "@/lib/canvas/types";

interface NodeSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: ResourceTemplate) => void;
}

function getTemplateIcon(icon: string) {
  switch (icon) {
    case "layout":
      return Layout;
    case "server":
      return Server;
    case "cpu":
      return Cpu;
    case "database":
      return Database;
    case "layers":
      return Layers;
    case "git-branch":
      return GitBranch;
    default:
      return Server;
  }
}

export function NodeSelectorDialog({
  isOpen,
  onClose,
  onSelect,
}: NodeSelectorDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset search and focus input on open
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedCategory("All");
      setHighlightedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const categories = ["All", "Compute", "Data", "Source"];

  const filteredResources = useMemo(() => {
    return SUPPORTED_RESOURCES.filter((res) => {
      const matchesCategory =
        selectedCategory === "All" || res.category === selectedCategory;
      const matchesSearch =
        res.subType.toLowerCase().includes(search.toLowerCase()) ||
        res.defaultLabel.toLowerCase().includes(search.toLowerCase()) ||
        res.description.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategory]);

  // Keep highlighted index in bounds
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredResources]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredResources.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredResources.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredResources[highlightedIndex]) {
        onSelect(filteredResources[highlightedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[380px] bg-[#141413] border border-[#282826] rounded-[10px] shadow-2xl overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-[#242422]">
          <Search className="w-4 h-4 text-[#8E8C86] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Add a resource..."
            className="w-full bg-transparent text-[13px] font-sans text-[#FAF8F5] placeholder-[#666662] outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 rounded flex items-center justify-center text-[#8E8C86] hover:text-[#FAF8F5] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-[#20201E] bg-[#111110]">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-[#252523] text-[#FAF8F5] border border-[#383835]"
                  : "text-[#8E8C86] hover:text-[#FAF8F5]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Resources List */}
        <div className="max-h-[300px] overflow-y-auto p-1.5 space-y-0.5">
          {filteredResources.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-[#666662]">
              No matching resources found.
            </div>
          ) : (
            filteredResources.map((res, index) => {
              const Icon = getTemplateIcon(res.icon);
              const isHighlighted = index === highlightedIndex;

              return (
                <button
                  key={`${res.category}-${res.subType}`}
                  type="button"
                  onClick={() => onSelect(res)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-[6px] text-left transition-colors ${
                    isHighlighted
                      ? "bg-[#20201E] text-[#FAF8F5]"
                      : "text-[#D1CFCA] hover:bg-[#1A1A18]"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded flex items-center justify-center shrink-0 border ${
                      isHighlighted
                        ? "bg-[#282826] border-[#444440] text-accent-orange"
                        : "bg-[#181817] border-[#2A2A28] text-[#8E8C86]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-sans text-[12.5px] font-medium text-[#FAF8F5]">
                        {res.subType}
                      </span>
                      <span className="font-mono text-[10px] text-[#70706C]">
                        {res.category}
                      </span>
                    </div>
                    <p className="font-sans text-[11px] text-[#8E8C86] truncate">
                      {res.description}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

