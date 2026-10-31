"use client";

import React, { useRef, useEffect } from "react";
import {
  Search,
  X,
  LayoutGrid,
  List,
  Filter,
  ArrowUpDown,
  RotateCcw,
} from "lucide-react";
import type {
  ViewMode,
  SortOption,
  StatusFilter,
} from "@/lib/dashboard/types";

interface ProjectToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  sortOption: SortOption;
  onSortOptionChange: (sort: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  totalCount: number;
  filteredCount: number;
  isEmptyDemo: boolean;
  onToggleEmptyDemo: () => void;
}

export function ProjectToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortOption,
  onSortOptionChange,
  viewMode,
  onViewModeChange,
  searchInputRef,
  totalCount,
  filteredCount,
  isEmptyDemo,
  onToggleEmptyDemo,
}: ProjectToolbarProps) {
  // Global ⌘K or / shortcut listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchInputRef]);

  return (
    <div className="w-full flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6 select-none">
      {/* Left: Search Bar with Restrained Underline Focus Treatment */}
      <div className="relative flex-1 max-w-full md:max-w-[360px] group">
        <div className="relative flex items-center h-9 px-3 rounded-[6px] bg-[#141413] border border-[#242422] group-hover:border-[#30302E] transition-colors overflow-hidden">
          <Search className="w-4 h-4 text-[#75736D] group-focus-within:text-[#FAF8F5] transition-colors shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search projects..."
            className="w-full h-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-[#FAF8F5] placeholder-[#75736D] text-[13px] px-2.5 font-sans"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                onSearchChange("");
                searchInputRef.current?.focus();
              }}
              className="text-[#8E8C86] hover:text-[#FAF8F5] p-0.5 rounded transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block text-[10px] font-mono text-[#666560] px-1.5 py-0.5 rounded bg-[#1C1C1A] border border-[#282826] shrink-0">
              ⌘K
            </kbd>
          )}

          {/* Underline Focus Highlight (Summit Burnt Orange) */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E58B62] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-200 ease-out origin-left pointer-events-none" />
        </div>
      </div>

      {/* Right: Filters, Sort, View Toggle, and Demo Reset */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status Filter Dropdown */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
            className="h-9 pl-8 pr-7 rounded-[6px] bg-[#141413] border border-[#242422] hover:border-[#30302E] text-[#C4C2BC] text-[12.5px] font-sans appearance-none outline-none focus:border-[#E58B62] transition-colors cursor-pointer"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="development">Development</option>
          </select>
          <Filter className="w-3.5 h-3.5 text-[#75736D] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#75736D] text-[10px]">
            ▼
          </div>
        </div>

        {/* Sort Selector Dropdown */}
        <div className="relative">
          <select
            value={sortOption}
            onChange={(e) => onSortOptionChange(e.target.value as SortOption)}
            className="h-9 pl-8 pr-7 rounded-[6px] bg-[#141413] border border-[#242422] hover:border-[#30302E] text-[#C4C2BC] text-[12.5px] font-sans appearance-none outline-none focus:border-[#E58B62] transition-colors cursor-pointer"
          >
            <option value="updated">Recently updated</option>
            <option value="name">Name (A-Z)</option>
            <option value="created">Created date</option>
          </select>
          <ArrowUpDown className="w-3.5 h-3.5 text-[#75736D] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#75736D] text-[10px]">
            ▼
          </div>
        </div>

        {/* View Mode Toggle (Grid vs List) */}
        <div className="flex items-center h-9 p-0.5 rounded-[6px] bg-[#141413] border border-[#242422]">
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            className={`h-full px-2.5 rounded-[4px] flex items-center justify-center transition-colors cursor-pointer ${
              viewMode === "grid"
                ? "bg-[#222220] text-[#FAF8F5] shadow-sm"
                : "text-[#75736D] hover:text-[#C4C2BC]"
            }`}
            title="Grid view"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            className={`h-full px-2.5 rounded-[4px] flex items-center justify-center transition-colors cursor-pointer ${
              viewMode === "list"
                ? "bg-[#222220] text-[#FAF8F5] shadow-sm"
                : "text-[#75736D] hover:text-[#C4C2BC]"
            }`}
            title="List view"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Demo Switcher Toggle: Test Empty vs Populated State */}
        <button
          type="button"
          onClick={onToggleEmptyDemo}
          className={`h-9 px-2.5 rounded-[6px] text-[11.5px] font-mono flex items-center gap-1.5 border transition-colors cursor-pointer ${
            isEmptyDemo
              ? "bg-[#E58B62]/10 border-[#E58B62]/40 text-[#E58B62]"
              : "bg-[#141413] border-[#242422] text-[#8E8C86] hover:text-[#FAF8F5] hover:border-[#30302E]"
          }`}
          title="Toggle between Empty State and Populated State"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{isEmptyDemo ? "Show Demo Projects" : "Test Empty State"}</span>
        </button>
      </div>
    </div>
  );
}

