"use client";

import React from "react";
import { X, Download, ShieldAlert } from "lucide-react";
import type { ProjectArchitecture } from "@/lib/canvas/types";
import { exportProjectAsJson } from "@/lib/canvas/initial-graph";

interface DeploymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  architecture: ProjectArchitecture;
}

export function DeploymentDialog({
  isOpen,
  onClose,
  architecture,
}: DeploymentDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] bg-[#141413] border border-[#282826] rounded-[10px] shadow-2xl p-5 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[6px] bg-[#231E18] border border-[#3E2E20] flex items-center justify-center text-accent-orange">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-sans text-[14px] font-semibold text-[#FAF8F5]">
                Deploy Architecture
              </h3>
              <p className="font-mono text-[11px] text-[#8E8C86]">
                Target: {architecture.environment}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8E8C86] hover:text-[#FAF8F5] p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-3">
          <p className="text-[12.5px] font-sans text-[#B5B3AF] leading-relaxed">
            A live cloud deployment pipeline is not currently attached to this workspace. The architecture is validated and preserved locally.
          </p>

          {/* Architecture Summary */}
          <div className="bg-[#181817] border border-[#262624] rounded-[6px] p-3 flex items-center justify-around font-mono text-[12px]">
            <div className="text-center">
              <div className="text-[#FAF8F5] font-semibold">
                {architecture.nodes.length}
              </div>
              <div className="text-[#70706C] text-[10.5px]">Nodes</div>
            </div>
            <div className="w-px h-6 bg-[#2B2B28]" />
            <div className="text-center">
              <div className="text-[#FAF8F5] font-semibold">
                {architecture.edges.length}
              </div>
              <div className="text-[#70706C] text-[10.5px]">Connections</div>
            </div>
            <div className="w-px h-6 bg-[#2B2B28]" />
            <div className="text-center">
              <div className="text-accent-orange font-semibold">
                Valid
              </div>
              <div className="text-[#70706C] text-[10.5px]">Graph State</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-[#222220]">
          <button
            type="button"
            onClick={() => {
              exportProjectAsJson(architecture);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#1E1E1C] hover:bg-[#262624] border border-[#2E2E2A] text-[12px] font-sans text-[#FAF8F5] transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#8E8C86]" />
            <span>Export Graph (JSON)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-[6px] bg-[#2A2A28] hover:bg-[#333330] text-[#FAF8F5] text-[12px] font-sans transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

