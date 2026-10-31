"use client";

import React from "react";
import {
  LayoutGrid,
  Rocket,
  ChevronsUpDown,
} from "lucide-react";

interface DashboardSidebarProps {
  activeTab: "projects" | "deployments";
  onTabChange: (tab: "projects" | "deployments") => void;
  projectsCount: number;
}

export function DashboardSidebar({
  activeTab,
  onTabChange,
  projectsCount,
}: DashboardSidebarProps) {
  return (
    <aside className="w-[200px] h-[calc(100vh-48px)] bg-[#0C0B0A] border-r border-[#1C1C1A] flex flex-col justify-between shrink-0 select-none sticky top-[48px] z-20">
      {/* Top Nav Links */}
      <div className="p-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-[#55544E] px-2.5 mb-2">
          Console
        </div>

        <nav className="space-y-0.5">
          {/* Projects Tab */}
          <button
            type="button"
            onClick={() => onTabChange("projects")}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[5px] text-[13px] font-sans transition-colors cursor-pointer ${
              activeTab === "projects"
                ? "bg-[#181817] text-[#FAF8F5] font-medium"
                : "text-[#75736D] hover:text-[#FAF8F5] hover:bg-[#141413]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <LayoutGrid
                className={`w-3.5 h-3.5 ${
                  activeTab === "projects" ? "text-[#E58B62]" : "text-[#55544E]"
                }`}
              />
              <span>Projects</span>
            </div>
            {activeTab === "projects" && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#E58B62]" />
            )}
          </button>

          {/* Deployments Tab */}
          <button
            type="button"
            onClick={() => onTabChange("deployments")}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[5px] text-[13px] font-sans transition-colors cursor-pointer ${
              activeTab === "deployments"
                ? "bg-[#181817] text-[#FAF8F5] font-medium"
                : "text-[#75736D] hover:text-[#FAF8F5] hover:bg-[#141413]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Rocket
                className={`w-3.5 h-3.5 ${
                  activeTab === "deployments" ? "text-[#E58B62]" : "text-[#55544E]"
                }`}
              />
              <span>Deployments</span>
            </div>
            {activeTab === "deployments" && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#E58B62]" />
            )}
          </button>
        </nav>
      </div>

      {/* Bottom User Profile */}
      <div className="p-3 border-t border-[#1C1C1A]">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-[5px] hover:bg-[#141413] transition-colors cursor-pointer">
          <div className="w-6 h-6 rounded-full bg-[#181817] border border-[#262624] flex items-center justify-center text-[10px] font-mono text-[#E58B62] shrink-0">
            D
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-[#FAF8F5] truncate leading-tight">
              Deepanshu Khatri
            </div>
            <div className="text-[10px] font-mono text-[#55544E] truncate">
              deepanshu@summit.dev
            </div>
          </div>
          <ChevronsUpDown className="w-3 h-3 text-[#4A4944] shrink-0" />
        </div>
      </div>
    </aside>
  );
}
