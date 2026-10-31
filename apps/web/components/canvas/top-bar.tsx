"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, Check, LogOut, User as UserIcon } from "lucide-react";
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

  const environments: { value: Environment; label: string; dotColor: string }[] = [
    { value: "production", label: "Production", dotColor: "bg-emerald-500/80" },
    { value: "staging", label: "Staging", dotColor: "bg-amber-500/80" },
    { value: "preview", label: "Preview", dotColor: "bg-sky-500/80" },
  ];

  const currentEnv = environments.find((e) => e.value === environment) || environments[0];

  return (
    <header className="h-[48px] w-full bg-[#0E0E0D]/95 backdrop-blur-md border-b border-[#20201E] flex items-center justify-between px-4 z-30 select-none shrink-0 transition-colors">
      {/* Left: Brand Identity & Editable Project Name */}
      <div className="flex items-center gap-2.5">
        {/* Summit Logo Backlink */}
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

        {/* Minimal Breadcrumb Slash */}
        <span className="text-[#3E3D39] text-[13px] font-mono select-none">/</span>

        {/* Project Name (Editable with minimal underline) */}
        <div className="flex items-center">
          {isEditingName ? (
            <div className="relative">
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
                className="bg-transparent text-[#F1F0ED] px-1 py-0.5 text-[12.5px] font-mono outline-none border-none focus:outline-none focus:ring-0 max-w-[200px]"
                style={{ outline: "none", boxShadow: "none", border: "none" }}
              />
              <div className="h-px w-full bg-[#E58B62]" />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              className="text-[12.5px] font-mono text-[#F1F0ED] hover:text-[#E58B62] transition-colors truncate max-w-[220px] px-1.5 py-0.5 rounded-[4px] hover:bg-[#181817] cursor-pointer"
              title="Click to rename project"
            >
              {projectName}
            </button>
          )}
        </div>
      </div>

      {/* Right: Controls (Environment, Save Telemetry, Deploy, Profile) */}
      <div className="flex items-center gap-3">
        {/* Environment Selector Dropdown */}
        <div className="relative" ref={envDropdownRef}>
          <button
            type="button"
            onClick={() => setIsEnvMenuOpen(!isEnvMenuOpen)}
            className="flex items-center gap-2 h-7 px-2.5 rounded-[5px] bg-[#141413] hover:bg-[#181817] border border-[#222220] hover:border-[#2C2B28] text-[12px] font-sans font-medium text-[#C9C7C2] hover:text-[#F1F0ED] transition-colors cursor-pointer"
            aria-expanded={isEnvMenuOpen}
            aria-label="Select environment"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${currentEnv.dotColor}`} />
            <span>{currentEnv.label}</span>
            <ChevronDown
              className={`w-3 h-3 text-[#77756F] transition-transform duration-150 ${
                isEnvMenuOpen ? "rotate-180 text-[#F1F0ED]" : ""
              }`}
            />
          </button>

          {isEnvMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-36 bg-[#141413] border border-[#222220] rounded-[7px] shadow-2xl py-1 z-50 animate-in fade-in duration-100">
              {environments.map((env) => (
                <button
                  key={env.value}
                  type="button"
                  onClick={() => {
                    onChangeEnvironment(env.value);
                    setIsEnvMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-[12px] font-sans transition-colors cursor-pointer ${
                    environment === env.value
                      ? "text-[#E58B62] bg-[#181817] font-medium"
                      : "text-[#A09E98] hover:text-[#F1F0ED] hover:bg-[#1A1A19]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${env.dotColor}`} />
                    <span>{env.label}</span>
                  </div>
                  {environment === env.value && (
                    <Check className="w-3 h-3 text-[#E58B62]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Real Save Telemetry Indicator */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono select-none">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isSaving
                ? "bg-[#E58B62] animate-pulse"
                : "bg-emerald-500/70"
            }`}
          />
          <span className="text-[#77756F]">
            {isSaving ? "Saving..." : "Saved"}
          </span>
        </div>

        {/* Vertical Divider */}
        <div className="w-px h-3.5 bg-[#222220]" />

        {/* Primary Deploy Button */}
        <button
          type="button"
          onClick={onDeploy}
          className="h-7 px-3.5 rounded-[5px] bg-[#E58B62] hover:bg-[#EA9670] active:scale-[0.98] text-[#0B0B0A] font-sans font-semibold text-[12px] transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          <span>Deploy</span>
        </button>

        {/* User Account Controls */}
        <div className="relative pl-1" ref={userDropdownRef}>
          {user ? (
            <div>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-7 h-7 rounded-full bg-[#181817] hover:bg-[#1E1E1C] border border-[#262522] hover:border-[#E58B62]/60 flex items-center justify-center text-[11.5px] font-mono font-medium text-[#F1F0ED] transition-colors cursor-pointer"
                title={user.email ?? "Account"}
              >
                {user.email ? (
                  user.email.charAt(0).toUpperCase()
                ) : (
                  <UserIcon className="w-3.5 h-3.5 text-[#77756F]" />
                )}
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-52 bg-[#141413] border border-[#222220] rounded-[7px] shadow-2xl py-1.5 z-50 animate-in fade-in duration-100">
                  <div className="px-3 py-2 border-b border-[#20201E]">
                    <div className="text-[10.5px] font-mono text-[#77756F] uppercase tracking-wider">
                      Signed in as
                    </div>
                    <div className="text-[12px] font-mono text-[#F1F0ED] truncate mt-0.5">
                      {user.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsUserMenuOpen(false);
                      await signOut();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] font-mono text-[#D77D7D] hover:bg-[#1A1A18] transition-colors cursor-pointer"
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
              className="text-[12px] font-mono text-[#A09E98] hover:text-[#F1F0ED] px-2.5 py-1 rounded-[5px] hover:bg-[#181817] border border-[#222220] transition-colors cursor-pointer"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
