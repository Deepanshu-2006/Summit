"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  ChevronRight,
  Database,
  Layout,
  Server,
  ArrowRight,
  Check,
  AlertCircle,
} from "lucide-react";
import { GitHubImportDialog, type EnsureServiceTarget } from "./github-import-dialog";
import { DatabaseChooserDialog } from "./database-chooser-dialog";
import { parseImageReference, parseServicePort, serviceNameFromImage } from "@/lib/canvas/service-draft";

// Authentic Docker Container Whale Icon
function DockerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186H8.1a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H5.136a.186.186 0 00-.186.185v1.888c0 .102.084.185.186.185m-2.928 0h2.12a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185M23.76 9.89a.82.82 0 00-.594-.367c-.22-.02-.85-.04-1.57.34-.33.175-.63.42-.9.72-.41-.26-.98-.44-1.68-.44h-.35a3.63 3.63 0 00-.65-1.28l-.34.22c.2.33.37.72.48 1.14l.03.11c-.55.15-2.02.58-2.63 1.95H.872a.87.87 0 00-.872.871c0 1.25.26 2.44.75 3.52.92 2.05 2.5 3.61 4.54 4.49 1.83.78 3.84 1.18 5.86 1.18 7.39 0 12.35-4.49 12.78-10.74.02-.13.04-.26.04-.39a.86.86 0 00-.17-.54" />
    </svg>
  );
}


export interface NodeChooserDialogsProps {
  activeChooser: "none" | "github" | "application" | "database" | "docker";
  onClose: () => void;
  onConfirm: (optionId: string, customData?: Record<string, unknown>) => void;
  onShowToast?: (message: string) => void;
  /** Resolves the backend service for the GitHub repository flow. */
  ensureGitHubService?: EnsureServiceTarget;
  githubTargetDescription?: string;
  githubSetupError?: string | null;
}

export function NodeChooserDialogs({
  activeChooser,
  onClose,
  onConfirm,
  onShowToast,
  ensureGitHubService,
  githubTargetDescription,
  githubSetupError,
}: NodeChooserDialogsProps) {
  // Docker state
  const [dockerImage, setDockerImage] = useState("");
  const [dockerPort, setDockerPort] = useState("80");
  const [dockerError, setDockerError] = useState("");

  const dockerInputRef = useRef<HTMLInputElement>(null);

  const submitDocker = () => {
    const image = parseImageReference(dockerImage);
    if (!image) {
      setDockerError("Enter an image like nginx:1.27 or ghcr.io/org/app:tag.");
      return;
    }
    const port = parseServicePort(dockerPort, 80);
    if (port === null) {
      setDockerError("Port must be a number from 1 to 65535.");
      return;
    }
    onConfirm("docker", {
      label: serviceNameFromImage(image),
      image,
      port,
      subType: "Docker Image",
      platformType: "image",
    });
    onClose();
  };

  useEffect(() => {
    if (activeChooser === "docker") {
      setDockerImage("");
      setDockerPort("80");
      setDockerError("");
      setTimeout(() => dockerInputRef.current?.focus(), 50);
    }
  }, [activeChooser]);

  // Keyboard navigation: Escape closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeChooser !== "none") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeChooser, onClose]);

  if (activeChooser === "none") return null;

  if (activeChooser === "github") {
    return (
      <GitHubImportDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        onShowToast={onShowToast}
        ensureService={ensureGitHubService}
        targetDescription={githubTargetDescription}
        installationErrorCode={githubSetupError}
      />
    );
  }

  if (activeChooser === "database") {
    return (
      <DatabaseChooserDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        onShowToast={onShowToast}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-[3px] animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >

      {/* ---------------- 3. Application Template Chooser ---------------- */}
      {activeChooser === "application" && (
        <div
          className="w-full max-w-[440px] bg-[#141414] border border-[#2A2A2A] rounded-[14px] shadow-[0_24px_64px_rgba(0,0,0,0.85)] p-5 select-none animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[7px] bg-[#191919] border border-[#2A2A2A] flex items-center justify-center text-[#72B69A]">
                <Layout className="w-4 h-4" />
              </div>
              <h3 className="font-sans text-[14.5px] font-semibold text-[#F2F0EC]">
                Choose Application Template
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[#A09D98] hover:text-[#F2F0EC] p-1 rounded hover:bg-[#202020] transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {/* Next.js 16 Web App */}
            <button
              type="button"
              onClick={() => {
                onConfirm("application", {
                  label: "nextjs-web",
                  subType: "Next.js 16 SSR",
                  buildCommand: "pnpm build",
                  startCommand: "pnpm start",
                  port: 3000,
                });
                onClose();
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-[9px] bg-[#191919] hover:bg-[#202020] border border-[#242424] hover:border-[#72B69A]/50 text-left transition-all group cursor-pointer"
            >
              <div>
                <h4 className="font-sans text-[13.5px] font-medium text-[#F2F0EC] group-hover:text-[#72B69A] transition-colors">
                  Next.js 16 SSR Frontend
                </h4>
                <p className="font-sans text-[11px] text-[#A09D98] mt-0.5">
                  App Router, server-side rendering, and React Server Components
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#77746F] group-hover:text-[#72B69A] group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </button>

            {/* Go 1.23 REST Engine */}
            <button
              type="button"
              onClick={() => {
                onConfirm("application", {
                  label: "go-api",
                  subType: "Go REST API",
                  buildCommand: "go build -o bin/api ./cmd/server",
                  startCommand: "./bin/api",
                  port: 4000,
                });
                onClose();
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-[9px] bg-[#191919] hover:bg-[#202020] border border-[#242424] hover:border-[#72B69A]/50 text-left transition-all group cursor-pointer"
            >
              <div>
                <h4 className="font-sans text-[13.5px] font-medium text-[#F2F0EC] group-hover:text-[#72B69A] transition-colors">
                  Go 1.23 REST API Engine
                </h4>
                <p className="font-sans text-[11px] text-[#A09D98] mt-0.5">
                  High-performance compiled backend service with sub-millisecond responses
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#77746F] group-hover:text-[#72B69A] group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </button>

            {/* Node.js Service */}
            <button
              type="button"
              onClick={() => {
                onConfirm("application", {
                  label: "node-service",
                  subType: "Node.js Service",
                  buildCommand: "npm run build",
                  startCommand: "node dist/index.js",
                  port: 8080,
                });
                onClose();
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-[9px] bg-[#191919] hover:bg-[#202020] border border-[#242424] hover:border-[#72B69A]/50 text-left transition-all group cursor-pointer"
            >
              <div>
                <h4 className="font-sans text-[13.5px] font-medium text-[#F2F0EC] group-hover:text-[#72B69A] transition-colors">
                  Node.js Web Service
                </h4>
                <p className="font-sans text-[11px] text-[#A09D98] mt-0.5">
                  Express or Fastify microservice API
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#77746F] group-hover:text-[#72B69A] group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* ---------------- 4. Docker Image Chooser ---------------- */}
      {activeChooser === "docker" && (
        <div
          className="w-full max-w-[420px] bg-[#141414] border border-[#2A2A2A] rounded-[14px] shadow-[0_24px_64px_rgba(0,0,0,0.85)] p-5 select-none animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[7px] bg-[#191919] border border-[#2A2A2A] flex items-center justify-center text-[#60A5FA]">
                <DockerIcon className="w-4 h-4" />
              </div>
              <h3 className="font-sans text-[14.5px] font-semibold text-[#F2F0EC]">
                Deploy Docker Image
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[#A09D98] hover:text-[#F2F0EC] p-1 rounded hover:bg-[#202020] transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-[#A09D98]">
                Image Reference
              </label>
              <div className="relative group bg-[#191919] rounded-[7px] border border-[#2A2A2A] overflow-hidden transition-colors">
                <input
                  ref={dockerInputRef}
                  type="text"
                  value={dockerImage}
                  onChange={(e) => {
                    setDockerImage(e.target.value);
                    setDockerError("");
                  }}
                  placeholder="docker.io/library/nginx:alpine"
                  className="w-full h-9 px-3 bg-transparent text-[12px] font-mono text-[#F2F0EC] placeholder:text-[#77746F] outline-none border-none focus:outline-none focus:ring-0 focus-visible:outline-none"
                  style={{ outline: "none", boxShadow: "none", border: "none" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitDocker();
                  }}
                />
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E79570] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-200 ease-out origin-left pointer-events-none" />
              </div>
              {dockerError && (
                <p className="text-[11px] font-sans text-[#D77D7D] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{dockerError}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-[#A09D98]">
                Exposed Port
              </label>
              <div className="relative group bg-[#191919] rounded-[7px] border border-[#2A2A2A] overflow-hidden transition-colors">
                <input
                  type="number"
                  value={dockerPort}
                  onChange={(e) => setDockerPort(e.target.value)}
                  placeholder="80"
                  className="w-full h-9 px-3 bg-transparent text-[12px] font-mono text-[#F2F0EC] outline-none border-none focus:outline-none focus:ring-0 focus-visible:outline-none"
                  style={{ outline: "none", boxShadow: "none", border: "none" }}
                />
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E79570] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-200 ease-out origin-left pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-[#242424]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-[6px] text-[#A09D98] hover:text-[#F2F0EC] text-[12px] font-sans hover:bg-[#202020] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitDocker}
              className="px-4 py-1.5 rounded-[7px] bg-[#E79570] hover:bg-[#F0A17B] text-[#0D0D0D] text-[12.5px] font-medium transition-colors cursor-pointer"
            >
              Add image
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

