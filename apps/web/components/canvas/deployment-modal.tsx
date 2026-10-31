"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Rocket,
  ExternalLink,
  Shield,
  Layers,
  Terminal,
  Server,
  ArrowRight,
} from "lucide-react";
import type { SummitNode } from "@/lib/canvas/types";

interface DeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: SummitNode[];
  onCompleteDeployment: () => void;
}

interface DeployStep {
  id: string;
  label: string;
  detail: string;
  status: "pending" | "running" | "completed" | "error";
}

export function DeploymentModal({
  isOpen,
  onClose,
  nodes,
  onCompleteDeployment,
}: DeploymentModalProps) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [steps, setSteps] = useState<DeployStep[]>([
    {
      id: "validate",
      label: "Graph Architecture Validation",
      detail: "Validating node contracts, network topology, and dependencies",
      status: "pending",
    },
    {
      id: "provision",
      label: "Edge Compute & Storage Allocation",
      detail: "Provisioning isolated container runtime in region cdg-1 (Paris)",
      status: "pending",
    },
    {
      id: "build",
      label: "Turbopack & Go Service Compilation",
      detail: "Building production artifacts and linking environment variables",
      status: "pending",
    },
    {
      id: "route",
      label: "Anycast Global Routing & SSL",
      detail: "Configuring wire-speed mTLS certificates and edge ingress",
      status: "pending",
    },
  ]);

  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStepIdx(0);
      setIsFinished(false);
      setSteps((s) => s.map((step) => ({ ...step, status: "pending" })));
      return;
    }

    let active = true;

    async function runPipeline() {
      for (let i = 0; i < steps.length; i++) {
        if (!active) return;
        setCurrentStepIdx(i);
        setSteps((prev) =>
          prev.map((step, idx) => (idx === i ? { ...step, status: "running" } : step))
        );

        // Simulation delay per step with realistic cadence
        await new Promise((r) => setTimeout(r, 900));

        if (!active) return;
        setSteps((prev) =>
          prev.map((step, idx) => (idx === i ? { ...step, status: "completed" } : step))
        );
      }

      if (active) {
        setIsFinished(true);
        onCompleteDeployment();
      }
    }

    runPipeline();

    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const deployedApps = nodes.filter(
    (n) => n.data.serviceType === "application" && n.data.liveUrl
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div className="w-full max-w-[560px] bg-[#141413] border border-[#2E2E2A] rounded-[14px] shadow-2xl overflow-hidden flex flex-col font-sans">
        {/* Header */}
        <div className="p-4 border-b border-[#242422] flex items-center justify-between bg-[#111111]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[6px] bg-accent-orange/15 border border-accent-orange/30 text-accent-orange flex items-center justify-center">
              <Rocket className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-mono text-[13px] font-semibold text-[#FAF8F5]">
                Architecture Deployment Engine
              </h3>
              <p className="font-mono text-[10px] text-[#80807C]">
                Demonstration & Local Orchestrator // {nodes.length} services targeted
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-[6px] text-[#80807C] hover:text-[#FAF8F5] hover:bg-[#1E1E1C] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pipeline Execution Steps */}
        <div className="p-5 space-y-4">
          <div className="space-y-2.5 font-mono">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                className={`p-3 rounded-[8px] border transition-all ${
                  step.status === "running"
                    ? "bg-[#1A1816] border-accent-orange/50 shadow-[0_0_16px_rgba(216,135,98,0.12)]"
                    : step.status === "completed"
                    ? "bg-[#141816] border-semantic-success/30"
                    : "bg-[#161615] border-[#222220] opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {step.status === "running" && (
                      <Loader2 className="w-4 h-4 text-accent-orange animate-spin shrink-0" />
                    )}
                    {step.status === "completed" && (
                      <CheckCircle2 className="w-4 h-4 text-semantic-success shrink-0" />
                    )}
                    {step.status === "pending" && (
                      <div className="w-4 h-4 rounded-full border border-[#444440] flex items-center justify-center text-[9px] text-[#666662] shrink-0">
                        {idx + 1}
                      </div>
                    )}
                    <span className="text-[12px] font-medium text-[#FAF8F5]">
                      {step.label}
                    </span>
                  </div>

                  <span className="text-[10px] uppercase font-semibold text-[#80807C]">
                    {step.status}
                  </span>
                </div>

                <p className="text-[10.5px] text-[#8E8C86] mt-1 pl-6 font-sans">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>

          {/* Finished State Summary */}
          {isFinished && (
            <div className="p-4 rounded-[10px] bg-[#161917] border border-semantic-success/40 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 text-semantic-success font-mono text-[12px] font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Architecture Successfully Live on Edge Network!</span>
              </div>

              {deployedApps.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="font-mono text-[10px] text-[#80807C] uppercase block">
                    Public Endpoint Endpoints:
                  </span>
                  {deployedApps.map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between p-2 rounded-[6px] bg-[#101312] border border-[#222E28] font-mono text-[11px]"
                    >
                      <span className="text-[#FAF8F5]">{app.data.label}</span>
                      <a
                        href={app.data.liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-accent-orange hover:underline text-[10.5px]"
                      >
                        <span>{app.data.liveUrl}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#242422] bg-[#111111] flex items-center justify-between font-mono text-[11px]">
          <span className="text-[#666662]">
            {isFinished ? "Deployment completed in 3.6s" : "Orchestrating services..."}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-[6px] bg-[#1E1E1C] hover:bg-[#282825] border border-[#333330] text-[#FAF8F5] font-medium transition-colors cursor-pointer"
          >
            {isFinished ? "Done" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

