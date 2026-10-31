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
        className="w-full max-w-[420px] bg-[#141414] border border-[#2A2A2A] rounded-[10px] shadow-2xl p-5 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[6px] bg-[#1F1713] border border-[#3A2218] flex items-center justify-center text-[#E79570]">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-sans text-[14px] font-semibold text-[#F2F0EC]">
                Deploy Architecture
              </h3>
              <p className="font-mono text-[11px] text-[#A09D98]">
                Target: {architecture.environment}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#A09D98] hover:text-[#F2F0EC] p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-3">
          <p className="text-[12.5px] font-sans text-[#A09D98] leading-relaxed">
            A live cloud deployment pipeline is not currently attached to this workspace. The architecture is validated and preserved locally.
          </p>

          {/* Architecture Summary */}
          <div className="bg-[#191919] border border-[#242424] rounded-[6px] p-3 flex items-center justify-around font-mono text-[12px]">
            <div className="text-center">
              <div className="text-[#F2F0EC] font-semibold">
                {architecture.nodes.length}
              </div>
              <div className="text-[#77746F] text-[10.5px]">Nodes</div>
            </div>
            <div className="w-px h-6 bg-[#242424]" />
            <div className="text-center">
              <div className="text-[#F2F0EC] font-semibold">
                {architecture.edges.length}
              </div>
              <div className="text-[#77746F] text-[10.5px]">Connections</div>
            </div>
            <div className="w-px h-6 bg-[#242424]" />
            <div className="text-center">
              <div className="text-[#72B69A] font-semibold">
                Valid
              </div>
              <div className="text-[#77746F] text-[10.5px]">Graph State</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-[#242424]">
          <button
            type="button"
            onClick={() => {
              exportProjectAsJson(architecture);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#191919] hover:bg-[#202020] border border-[#2A2A2A] text-[12px] font-sans text-[#F2F0EC] transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#A09D98]" />
            <span>Export Graph (JSON)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-[6px] bg-[#202020] hover:bg-[#2A2A2A] text-[#F2F0EC] text-[12px] font-sans transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

