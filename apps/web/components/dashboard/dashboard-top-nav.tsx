"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Check,
  User as UserIcon,
  Settings,
  LogOut,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { SummitLogo } from "@/components/layout/navbar";
import { useAuth } from "@/components/auth/auth-context";
import { getPersonalWorkspace, getUserDisplay } from "@/lib/dashboard/workspace";

interface DashboardTopNavProps {
  isCreatingProject?: boolean;
  onBackToProjects?: () => void;
}

export function DashboardTopNav({
  isCreatingProject = false,
  onBackToProjects,
}: DashboardTopNavProps = {}) {
  const shouldReduceMotion = useReducedMotion();
  const { user, signOut, openAuthModal } = useAuth();
  const workspace = getPersonalWorkspace(user);
  const userDisplay = getUserDisplay(user);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const wsDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

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
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <motion.header
      initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="h-[48px] w-full bg-[#0C0B0A] border-b border-[#1E1E1C] flex items-center justify-between px-5 sm:px-8 z-40 select-none shrink-0 sticky top-0"
    >
      {/* Left: Brand Identity + Workspace Selector */}
      <div className="flex items-center gap-2.5">
        <Link
          href="/"
          className="flex items-center gap-2 group hover:opacity-90 transition-opacity"
          title="Summit Homepage"
        >
          <SummitLogo className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
          <span className="font-sans text-[13.5px] font-semibold tracking-[-0.02em] text-[#F1F0ED]">
            Summit
          </span>
        </Link>

        <span className="text-[#3A3834] text-[13px] font-mono select-none">/</span>

        <AnimatePresence mode="wait">
          {isCreatingProject ? (
            <motion.div
              key="nav-new-project-crumbs"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-2.5"
            >
              <button
                type="button"
                onClick={onBackToProjects}
                className="text-[#8E8C86] hover:text-[#FAF8F5] transition-colors text-[13px] font-sans cursor-pointer"
                title="Back to Projects"
              >
                Projects
              </button>

              <span className="text-[#3A3834] text-[13px] font-mono select-none">/</span>

              <div className="flex items-center gap-1.5 px-1 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E58B62]" />
                <span className="font-mono text-[12px] text-[#A0A09C]">
                  New project
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="nav-workspace-crumbs"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.18 }}
              className="relative"
              ref={wsDropdownRef}
            >
              <button
                type="button"
                onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-[5px] text-[#A6A4A0] hover:text-[#FAF8F5] hover:bg-[#161615] text-[12.5px] font-mono transition-colors cursor-pointer"
              >
                <span>{workspace.name}</span>
                <ChevronDown
                  className={`w-3 h-3 text-[#75736D] transition-transform duration-150 ${
                    isWorkspaceMenuOpen ? "rotate-180 text-[#FAF8F5]" : ""
                  }`}
                />
              </button>

              <AnimatePresence>
                {isWorkspaceMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -2, scale: 0.98 }}
                    transition={{ duration: 0.12, ease: "easeOut" }}
                    className="absolute left-0 mt-1.5 w-52 bg-[#141413] border border-[#242422] rounded-[8px] shadow-[0_12px_32px_rgba(0,0,0,0.85)] p-1 z-50 text-[12.5px] font-sans"
                  >
                    <div className="px-2.5 py-1.5 text-[10.5px] font-mono uppercase tracking-wider text-[#666560]">
                      Workspaces
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsWorkspaceMenuOpen(false)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-[5px] text-left hover:bg-[#1C1C1A] transition-colors cursor-pointer"
                    >
                      <span className="min-w-0">
                        <span className="block text-[#FAF8F5] font-medium truncate">
                          {workspace.name}
                        </span>
                        <span className="block text-[10.5px] font-mono text-[#666560]">
                          {workspace.plan}
                        </span>
                      </span>
                      <Check className="w-3.5 h-3.5 text-[#E58B62] shrink-0" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: Docs Link + User Profile */}
      <div className="flex items-center gap-3">
        <Link
          href="/docs"
          className="text-[12px] font-mono text-[#8E8C86] hover:text-[#FAF8F5] transition-colors hidden sm:block"
        >
          Docs
        </Link>

        {/* User Avatar */}
        <div className="relative" ref={userDropdownRef}>
          <button
            type="button"
            onClick={() => {
              if (user) setIsUserMenuOpen(!isUserMenuOpen);
              else openAuthModal({ mode: "signin" });
            }}
            className="w-6 h-6 rounded-full bg-[#181817] hover:bg-[#20201E] border border-[#2A2A28] flex items-center justify-center text-[10px] font-mono text-[#E58B62] transition-colors cursor-pointer"
            title={user ? "User menu" : "Sign in"}
          >
            {user ? userDisplay.initial : <UserIcon className="w-3 h-3" />}
          </button>

          <AnimatePresence>
            {isUserMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -2, scale: 0.98 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="absolute right-0 mt-1.5 w-52 bg-[#141413] border border-[#242422] rounded-[8px] shadow-[0_12px_32px_rgba(0,0,0,0.85)] p-1 z-50 text-[12.5px] font-sans"
              >
                <div className="px-2.5 py-1.5">
                  <div className="text-[#FAF8F5] font-medium text-[12.5px]">
                    {userDisplay.name}
                  </div>
                  <div className="text-[11px] font-mono text-[#75736D] truncate">
                    {userDisplay.email}
                  </div>
                </div>
                <div className="h-px bg-[#20201E] my-1" />
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] text-[#FAF8F5] hover:bg-[#1C1C1A] transition-colors text-left cursor-pointer"
                >
                  <UserIcon className="w-3.5 h-3.5 text-[#8E8C86]" />
                  <span>Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] text-[#FAF8F5] hover:bg-[#1C1C1A] transition-colors text-left cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-[#8E8C86]" />
                  <span>Settings</span>
                </button>
                <div className="h-px bg-[#20201E] my-1" />
                <button
                  type="button"
                  onClick={async () => {
                    setIsUserMenuOpen(false);
                    await signOut();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] text-[#D77D7D] hover:bg-[#1C1C1A] transition-colors text-left cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.header>
  );
}
