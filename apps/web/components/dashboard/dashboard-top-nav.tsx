"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Check,
  Search,
  HelpCircle,
  Settings,
  LogOut,
  User as UserIcon,
  Plus,
  BookOpen,
  ExternalLink,
  Shield,
  Key,
} from "lucide-react";
import { SummitLogo } from "@/components/layout/navbar";
import { DEMO_WORKSPACES } from "@/lib/dashboard/mock-data";
import type { WorkspaceItem } from "@/lib/dashboard/types";

interface DashboardTopNavProps {
  onSearchFocus?: () => void;
  onOpenNewProject?: () => void;
}

export function DashboardTopNav({
  onSearchFocus,
  onOpenNewProject,
}: DashboardTopNavProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>(DEMO_WORKSPACES);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceItem>(
    DEMO_WORKSPACES[0]
  );
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const wsDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const helpDropdownRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wsDropdownRef.current &&
        !wsDropdownRef.current.contains(event.target as Node)
      ) {
        setIsWorkspaceMenuOpen(false);
      }
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
      if (
        helpDropdownRef.current &&
        !helpDropdownRef.current.contains(event.target as Node)
      ) {
        setIsHelpMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSelectWorkspace = (ws: WorkspaceItem) => {
    setCurrentWorkspace(ws);
    setWorkspaces((prev) =>
      prev.map((item) => ({ ...item, isCurrent: item.id === ws.id }))
    );
    setIsWorkspaceMenuOpen(false);
    triggerToast(`Switched to workspace: ${ws.name}`);
  };

  return (
    <header className="h-[56px] w-full bg-[#0E0E0D]/95 backdrop-blur-md border-b border-[#222220] flex items-center justify-between px-5 sm:px-8 z-30 select-none shrink-0 transition-colors">
      {/* Left: Summit Logo + Divider + Workspace Selector */}
      <div className="flex items-center gap-3">
        {/* Logo and Wordmark */}
        <Link
          href="/"
          className="flex items-center gap-2 group hover:opacity-90 transition-opacity"
          title="Summit Homepage"
        >
          <SummitLogo className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
          <span className="font-sans text-[14px] font-semibold tracking-[-0.02em] text-[#F5F5F3]">
            Summit
          </span>
        </Link>

        {/* Minimal Divider */}
        <span className="text-[#3A3834] text-[13px] font-mono select-none">/</span>

        {/* Workspace Selector Dropdown */}
        <div className="relative" ref={wsDropdownRef}>
          <button
            type="button"
            onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-[6px] hover:bg-[#181817] text-[#FAF8F5] text-[13px] font-medium transition-colors border border-transparent hover:border-[#282826] cursor-pointer"
          >
            <div className="w-4 h-4 rounded-full bg-[#20201E] border border-[#2E2E2B] flex items-center justify-center text-[9px] font-mono font-medium text-[#FAF8F5]">
              {currentWorkspace.name.charAt(0)}
            </div>
            <span className="tracking-[-0.01em]">{currentWorkspace.name}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1C1C1A] text-[#8E8C86] font-mono border border-[#262624]">
              {currentWorkspace.plan}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#8E8C86] transition-transform duration-150 ${
                isWorkspaceMenuOpen ? "rotate-180 text-[#FAF8F5]" : ""
              }`}
            />
          </button>

          {isWorkspaceMenuOpen && (
            <div className="absolute left-0 mt-1.5 w-60 bg-[#141413] border border-[#262624] rounded-[10px] shadow-[0_12px_32px_rgba(0,0,0,0.7)] p-1.5 z-50 text-[13px] animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-1.5 text-[11px] font-mono uppercase tracking-wider text-[#666560]">
                Workspaces
              </div>
              <div className="space-y-0.5">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => handleSelectWorkspace(ws)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-left hover:bg-[#1E1E1C] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#1C1C1A] border border-[#2A2A28] flex items-center justify-center text-[10px] font-mono text-[#FAF8F5]">
                        {ws.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-[#FAF8F5] font-medium leading-tight">
                          {ws.name}
                        </div>
                        <div className="text-[11px] font-mono text-[#8E8C86]">
                          {ws.plan}
                        </div>
                      </div>
                    </div>
                    {ws.isCurrent && (
                      <Check className="w-3.5 h-3.5 text-[#E58B62]" />
                    )}
                  </button>
                ))}
              </div>

              <div className="h-px bg-[#222220] my-1" />

              <button
                type="button"
                onClick={() => {
                  setIsWorkspaceMenuOpen(false);
                  triggerToast("New workspace creation is simulated in demo.");
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] text-left text-[#A6A4A0] hover:text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New workspace</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: Search, Help, Settings, User Profile */}
      <div className="flex items-center gap-2">
        {/* Quick Search Trigger */}
        <button
          type="button"
          onClick={onSearchFocus}
          className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] bg-[#141413] hover:bg-[#1A1918] text-[#8E8C86] hover:text-[#FAF8F5] border border-[#242422] text-[12px] font-sans transition-colors cursor-pointer"
          title="Search projects (⌘K)"
        >
          <Search className="w-3.5 h-3.5 text-[#73716B]" />
          <span>Search...</span>
          <kbd className="text-[10px] font-mono px-1 py-0.5 rounded bg-[#1E1E1C] text-[#6A6863] border border-[#2A2A28]">
            ⌘K
          </kbd>
        </button>

        {/* Help Menu */}
        <div className="relative" ref={helpDropdownRef}>
          <button
            type="button"
            onClick={() => setIsHelpMenuOpen(!isHelpMenuOpen)}
            className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#8E8C86] hover:text-[#FAF8F5] hover:bg-[#181817] transition-colors border border-transparent hover:border-[#262624] cursor-pointer"
            title="Help and documentation"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {isHelpMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-52 bg-[#141413] border border-[#262624] rounded-[10px] shadow-[0_12px_32px_rgba(0,0,0,0.7)] p-1.5 z-50 text-[13px] animate-in fade-in zoom-in-95 duration-100">
              <Link
                href="/docs"
                onClick={() => setIsHelpMenuOpen(false)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#8E8C86]" />
                <span>Documentation</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsHelpMenuOpen(false);
                  triggerToast("API reference documentation opened.");
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors text-left"
              >
                <Key className="w-3.5 h-3.5 text-[#8E8C86]" />
                <span>API Reference</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsHelpMenuOpen(false);
                  triggerToast("System Status: All services operational (100% uptime).");
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors text-left"
              >
                <Shield className="w-3.5 h-3.5 text-[#8E8C86]" />
                <span>Platform Status</span>
              </button>
            </div>
          )}
        </div>

        {/* Settings button */}
        <button
          type="button"
          onClick={() => triggerToast("Workspace settings opened.")}
          className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#8E8C86] hover:text-[#FAF8F5] hover:bg-[#181817] transition-colors border border-transparent hover:border-[#262624] cursor-pointer"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Avatar with Dropdown */}
        <div className="relative" ref={userDropdownRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="w-7 h-7 rounded-full bg-[#181817] hover:bg-[#222220] text-[#E58B62] border border-[#2E2E2B] flex items-center justify-center text-[11px] font-mono font-medium transition-colors cursor-pointer ml-1"
            title="Account & profile"
          >
            D
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-60 bg-[#141413] border border-[#262624] rounded-[10px] shadow-[0_12px_32px_rgba(0,0,0,0.7)] p-1.5 z-50 text-[13px] animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-2">
                <div className="text-[#FAF8F5] font-medium leading-tight">
                  Deepanshu Khatri
                </div>
                <div className="text-[11px] font-mono text-[#8E8C86] truncate">
                  deepanshu@summit.dev
                </div>
              </div>

              <div className="h-px bg-[#222220] my-1" />

              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  triggerToast("Account settings opened.");
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] text-left text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5 text-[#8E8C86]" />
                <span>Account settings</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  triggerToast("Preferences updated.");
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] text-left text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-[#8E8C86]" />
                <span>Preferences</span>
              </button>

              <div className="h-px bg-[#222220] my-1" />

              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  triggerToast("Signed out of demo session.");
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] text-left text-[#D77D7D] hover:bg-[#1E1E1C] transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating HUD feedback toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#161615] border border-[#2E2E2A] text-[#FAF8F5] px-3.5 py-2 rounded-[8px] text-[12.5px] font-sans shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="w-1.5 h-1.5 rounded-full bg-[#E58B62]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </header>
  );
}

