"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, Check, Plus, LogOut, User as UserIcon } from "lucide-react";
import { SummitLogo } from "@/components/layout/navbar";
import { useAuth } from "@/components/auth/auth-context";
import type { Environment } from "@/lib/canvas/types";

interface CanvasTopBarProps {
  projectName: string;
  onRenameProject: (newName: string) => void;
  environment: Environment;
  onChangeEnvironment: (env: Environment) => void;
  isSaving: boolean;
  onDeploy: () => void;
}

export function CanvasTopBar({
  projectName,
  onRenameProject,
  environment,
  onChangeEnvironment,
  isSaving,
  onDeploy,
}: CanvasTopBarProps) {
  const { user, signOut, openAuthModal } = useAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(projectName);
  const [isEnvMenuOpen, setIsEnvMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const envDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTempName(projectName);
  }, [projectName]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Click outside listener for environment and user dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        envDropdownRef.current &&
        !envDropdownRef.current.contains(event.target as Node)
      ) {
        setIsEnvMenuOpen(false);
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

  const handleFinishRename = () => {
    setIsEditingName(false);
    if (tempName.trim()) {
      onRenameProject(tempName.trim());
    } else {
      setTempName(projectName);
    }
  };

  const environments: { value: Environment; label: string }[] = [
    { value: "production", label: "Production" },
    { value: "staging", label: "Staging" },
    { value: "preview", label: "Preview" },
  ];

  return (
    <header className="h-[56px] w-full bg-[#0B0B0B] border-b border-[#242424] flex items-center justify-between px-4 z-30 select-none shrink-0">
      {/* Left: Brand & Editable Project Name */}
      <div className="flex items-center gap-3">
        {/* Summit Logo Backlink */}
        <Link
          href="/"
          className="flex items-center gap-2 group hover:opacity-90 transition-opacity pr-3 border-r border-[#242424]"
          title="Summit Homepage"
        >
          <SummitLogo className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
          <span className="font-sans text-[14px] font-semibold tracking-[-0.02em] text-[#F2F0EC]">
            Summit
          </span>
        </Link>

        {/* Project Name */}
        <div className="flex items-center">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleFinishRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleFinishRename();
                if (e.key === "Escape") {
                  setTempName(projectName);
                  setIsEditingName(false);
                }
              }}
              className="bg-[#191919] border border-[#E79570] text-[#F2F0EC] px-2 py-1 rounded text-[13px] font-mono outline-none max-w-[200px]"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              className="text-[13px] font-mono text-[#F2F0EC] hover:text-[#E79570] transition-colors truncate max-w-[220px] px-1.5 py-0.5 rounded hover:bg-[#191919]"
              title="Click to rename project"
            >
              {projectName}
            </button>
          )}
        </div>
      </div>

      {/* Right: Environment, Save Status, Deploy */}
      <div className="flex items-center gap-3">
        {/* Environment Selector Dropdown */}
        <div className="relative" ref={envDropdownRef}>
          <button
            type="button"
            onClick={() => setIsEnvMenuOpen(!isEnvMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] bg-[#141414] hover:bg-[#191919] border border-[#2A2A2A] text-[12px] font-mono text-[#F2F0EC] transition-colors"
          >
            <span>{environments.find((e) => e.value === environment)?.label}</span>
            <ChevronDown className="w-3 h-3 text-[#77746F]" />
          </button>

          {isEnvMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-32 bg-[#141414] border border-[#2A2A2A] rounded-[6px] shadow-xl py-1 z-50 animate-in fade-in duration-100">
              {environments.map((env) => (
                <button
                  key={env.value}
                  type="button"
                  onClick={() => {
                    onChangeEnvironment(env.value);
                    setIsEnvMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-[12px] font-mono transition-colors ${
                    environment === env.value
                      ? "text-[#E79570] bg-[#191919]"
                      : "text-[#A09D98] hover:text-[#F2F0EC] hover:bg-[#202020]"
                  }`}
                >
                  <span>{env.label}</span>
                  {environment === env.value && <Check className="w-3 h-3 text-[#E79570]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Real Save Status Indicator */}
        <div className="flex items-center gap-1.5 px-2 text-[11px] font-mono select-none">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isSaving
                ? "bg-[#E79570] animate-pulse"
                : "bg-[#72B69A]"
            }`}
          />
          <span className="text-[#A09D98]">
            {isSaving ? "Saving..." : "Saved"}
          </span>
        </div>

        {/* Prominent Deploy Button */}
        <button
          type="button"
          onClick={onDeploy}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[#E79570] hover:bg-[#F0A17B] active:translate-y-px text-[#0D0D0D] text-[13px] font-medium tracking-[-0.01em] transition-all shadow-sm shadow-[#E79570]/20 cursor-pointer"
        >
          <span>Deploy</span>
        </button>

        {/* User Account Controls */}
        <div className="relative pl-2 border-l border-[#242424]" ref={userDropdownRef}>
          {user ? (
            <div>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-7 h-7 rounded-full bg-[#191919] border border-[#2A2A2A] hover:border-[#E79570]/60 flex items-center justify-center text-[12px] font-mono text-[#F2F0EC] transition-all"
                title={user.email ?? "Account"}
              >
                {user.email ? user.email.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5 text-[#77746F]" />}
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-[#141414] border border-[#2A2A2A] rounded-[6px] shadow-2xl py-1.5 z-50 animate-in fade-in duration-100">
                  <div className="px-3 py-2 border-b border-[#242424]">
                    <div className="text-[11px] font-mono text-[#77746F] uppercase tracking-wider">Signed in as</div>
                    <div className="text-[12px] font-mono text-[#F2F0EC] truncate mt-0.5">{user.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsUserMenuOpen(false);
                      await signOut();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] font-mono text-[#D77D7D] hover:bg-[#191919] transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal({ mode: "signin" })}
              className="text-[12px] font-mono text-[#A09D98] hover:text-[#F2F0EC] px-2.5 py-1 rounded-[6px] hover:bg-[#191919] border border-[#2A2A2A] transition-colors"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
