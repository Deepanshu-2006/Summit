"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Rocket,
  ChevronDown,
  Check,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  Edit2,
  ExternalLink,
  Layers,
  Sparkles,
  Shield,
  Loader2,
} from "lucide-react";
import { SummitLogo } from "@/components/layout/navbar";
import type { Environment } from "@/lib/canvas/types";

interface CanvasTopBarProps {
  projectName: string;
  onRenameProject: (newName: string) => void;
  environment: Environment;
  onChangeEnvironment: (env: Environment) => void;
  isDeploying: boolean;
  onDeploy: () => void;
  hasUnsavedChanges: boolean;
  onResetGraph: () => void;
  onClearGraph: () => void;
  onExportGraph: () => void;
  onImportGraph: () => void;
}

export function CanvasTopBar({
  projectName,
  onRenameProject,
  environment,
  onChangeEnvironment,
  isDeploying,
  onDeploy,
  hasUnsavedChanges,
  onResetGraph,
  onClearGraph,
  onExportGraph,
  onImportGraph,
}: CanvasTopBarProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(projectName);
  const [isEnvMenuOpen, setIsEnvMenuOpen] = useState(false);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTempName(projectName);
  }, [projectName]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleFinishRename = () => {
    setIsEditingName(false);
    if (tempName.trim()) {
      onRenameProject(tempName.trim());
    } else {
      setTempName(projectName);
    }
  };

  return (
    <header className="h-[54px] w-full bg-[#111111]/95 border-b border-[#242422] flex items-center justify-between px-4 z-30 select-none backdrop-blur-md shrink-0">
      {/* ================= Left Region: Brand & Project Name ================= */}
      <div className="flex items-center gap-3">
        {/* Summit Logo Backlink */}
        <Link
          href="/"
          className="flex items-center gap-2 group hover:opacity-90 transition-opacity pr-2 border-r border-[#242422]"
          title="Return to Summit Homepage"
        >
          <SummitLogo className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
          <span className="font-sans text-[15px] font-semibold tracking-[-0.025em] text-[#F5F5F3]">
            Summit
          </span>
        </Link>

        {/* Project Breadcrumb & Inline Rename */}
        <div className="flex items-center gap-1.5 font-mono text-[12px]">
          <span className="text-[#666662] hidden sm:inline">acme-corp /</span>

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
              className="px-1.5 py-0.5 rounded-[4px] bg-[#1A1A18] border border-accent-orange text-[#FAF8F5] outline-none text-[12px] font-mono min-w-[140px]"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-[4px] hover:bg-[#1C1C1A] text-[#FAF8F5] font-medium transition-colors cursor-pointer group"
              title="Click to rename project"
            >
              <span>{projectName}</span>
              <Edit2 className="w-3 h-3 text-[#555550] group-hover:text-accent-orange transition-colors" />
            </button>
          )}
        </div>

        {/* Environment Switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsEnvMenuOpen(!isEnvMenuOpen)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-[5px] bg-[#181816] hover:bg-[#20201D] border border-[#2B2B28] font-mono text-[11px] text-[#A0A09C] hover:text-[#FAF8F5] transition-colors cursor-pointer"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                environment === "production"
                  ? "bg-semantic-success"
                  : environment === "staging"
                  ? "bg-[#D6AD72]"
                  : "bg-[#9AC5EC]"
              }`}
            />
            <span className="capitalize">{environment}</span>
            <ChevronDown className="w-3 h-3 text-[#666662]" />
          </button>

          {isEnvMenuOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 w-[160px] bg-[#161614] border border-[#2B2B28] rounded-[8px] shadow-2xl p-1 z-50 font-mono text-[11px]"
              onMouseLeave={() => setIsEnvMenuOpen(false)}
            >
              {(["production", "staging", "preview"] as const).map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => {
                    onChangeEnvironment(env);
                    setIsEnvMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[5px] transition-colors cursor-pointer ${
                    environment === env
                      ? "bg-accent-orange/15 text-accent-orange font-medium"
                      : "text-[#A0A09C] hover:text-[#FAF8F5] hover:bg-[#1F1F1C]"
                  }`}
                >
                  <span className="capitalize">{env}</span>
                  {environment === env && <Check className="w-3 h-3 text-accent-orange" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================= Center Region: Status Pill ================= */}
      <div className="hidden md:flex items-center gap-2 font-mono text-[11px]">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#181816] border border-[#292926] text-[#80807C]">
          <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
          <span className="text-[#FAF8F5] font-medium">Orchestrator Online</span>
          <span className="text-[#555552]">// cdg-1 (Paris)</span>
        </div>

        {hasUnsavedChanges ? (
          <span className="text-accent-orange/90 text-[10.5px]">● Unsaved changes</span>
        ) : (
          <span className="text-[#555552] text-[10.5px]">Synced to local storage</span>
        )}
      </div>

      {/* ================= Right Region: Actions & Controls ================= */}
      <div className="flex items-center gap-2.5">
        {/* Project Options Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
            className="flex items-center gap-1 h-8 px-2.5 rounded-[6px] bg-[#181816] hover:bg-[#20201D] border border-[#2E2E2A] text-[#A0A09C] hover:text-[#FAF8F5] text-[11.5px] font-mono transition-colors cursor-pointer"
            title="Project Actions & Presets"
          >
            <span>Project</span>
            <ChevronDown className="w-3 h-3 text-[#666662]" />
          </button>

          {isProjectMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 w-[200px] bg-[#161614] border border-[#2B2B28] rounded-[8px] shadow-2xl p-1 z-50 font-mono text-[11.5px]"
              onMouseLeave={() => setIsProjectMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => {
                  onExportGraph();
                  setIsProjectMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] text-[#A0A09C] hover:text-[#FAF8F5] hover:bg-[#1F1F1C] transition-colors cursor-pointer text-left"
              >
                <Download className="w-3.5 h-3.5 text-accent-orange" />
                <span>Export Graph (JSON)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onImportGraph();
                  setIsProjectMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] text-[#A0A09C] hover:text-[#FAF8F5] hover:bg-[#1F1F1C] transition-colors cursor-pointer text-left"
              >
                <Upload className="w-3.5 h-3.5 text-[#9AC5EC]" />
                <span>Import Graph (JSON)</span>
              </button>

              <div className="h-[1px] bg-[#242422] my-1" />

              <button
                type="button"
                onClick={() => {
                  onResetGraph();
                  setIsProjectMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] text-[#A0A09C] hover:text-[#FAF8F5] hover:bg-[#1F1F1C] transition-colors cursor-pointer text-left"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#D6AD72]" />
                <span>Reset to Meridian Preset</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClearGraph();
                  setIsProjectMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] text-[#D77D7D] hover:bg-[#2B1B1B] transition-colors cursor-pointer text-left"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Canvas</span>
              </button>
            </div>
          )}
        </div>

        {/* Primary Deploy Button */}
        <button
          type="button"
          onClick={onDeploy}
          disabled={isDeploying}
          className={`flex items-center gap-2 h-8 px-4 rounded-[6px] font-sans text-[12.5px] font-semibold transition-all cursor-pointer shadow-sm ${
            isDeploying
              ? "bg-[#2A231E] text-accent-orange border border-accent-orange/40 cursor-not-allowed"
              : "bg-accent-orange hover:bg-accent-orange-hover text-[#111111] hover:shadow-[0_0_16px_rgba(216,135,98,0.3)] active:scale-[0.98]"
          }`}
          title="Deploy all services (⌘D)"
        >
          {isDeploying ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Deploying...</span>
            </>
          ) : (
            <>
              <Rocket className="w-3.5 h-3.5" />
              <span>Deploy</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}

