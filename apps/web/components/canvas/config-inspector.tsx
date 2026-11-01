"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Trash2,
  Plus,
  Layout,
  Cpu,
  GitBranch,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import type {
  SummitNode,
  SummitNodeData,
  EnvironmentVariable,
} from "@/lib/canvas/types";
import {
  PostgresLogo,
  MongoLogo,
  RedisLogo,
  MySQLLogo,
} from "./database-logos";

interface ConfigInspectorProps {
  node: SummitNode | null;
  onClose: () => void;
  onUpdateNode: (nodeId: string, updatedData: Partial<SummitNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
}

// Authentic GitHub Brand Vector
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

// Authentic Docker Container Whale Vector
function DockerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186H8.1a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H5.136a.186.186 0 00-.186.185v1.888c0 .102.084.185.186.185m-2.928 0h2.12a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185M23.76 9.89a.82.82 0 00-.594-.367c-.22-.02-.85-.04-1.57.34-.33.175-.63.42-.9.72-.41-.26-.98-.44-1.68-.44h-.35a3.63 3.63 0 00-.65-1.28l-.34.22c.2.33.37.72.48 1.14l.03.11c-.55.15-2.02.58-2.63 1.95H.872a.87.87 0 00-.872.871c0 1.25.26 2.44.75 3.52.92 2.05 2.5 3.61 4.54 4.49 1.83.78 3.84 1.18 5.86 1.18 7.39 0 12.35-4.49 12.78-10.74.02-.13.04-.26.04-.39a.86.86 0 00-.17-.54" />
    </svg>
  );
}

function resolveServiceIcon(data: SummitNodeData) {
  if (data.serviceType === "repository") return GitHubIcon;
  if (data.subType === "Docker Image") return DockerIcon;
  if (data.serviceType === "database") {
    if (data.databaseEngine === "mongodb" || data.subType === "MongoDB") return MongoLogo;
    if (data.databaseEngine === "redis" || data.subType === "Redis") return RedisLogo;
    if (data.databaseEngine === "mysql" || data.subType === "MySQL") return MySQLLogo;
    return PostgresLogo;
  }
  if (data.serviceType === "cache") return RedisLogo;
  if (data.serviceType === "worker") return Cpu;
  return Layout;
}

export function ConfigInspector({
  node,
  onClose,
  onUpdateNode,
  onDeleteNode,
}: ConfigInspectorProps) {
  const [label, setLabel] = useState("");
  const [buildCommand, setBuildCommand] = useState("");
  const [startCommand, setStartCommand] = useState("");
  const [rootDir, setRootDir] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [databaseName, setDatabaseName] = useState("");
  const [port, setPort] = useState<number | undefined>(undefined);
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Synchronize when selected node changes
  useEffect(() => {
    if (!node) return;
    const d = node.data;
    setLabel(d.label || "");
    setBuildCommand(d.buildCommand || "");
    setStartCommand(d.startCommand || "");
    setRootDir(d.rootDir || "");
    setRepoUrl(d.repoUrl || "");
    setBranch(d.branch || "");
    setDatabaseName(d.databaseName || "");
    setPort(d.port);
    setEnvVars(d.envVars || []);
    setConfirmDelete(false);
  }, [node]);

  if (!node) return null;

  const data = node.data;
  const Icon = resolveServiceIcon(data);

  const handleUpdate = (fields: Partial<SummitNodeData>) => {
    onUpdateNode(node.id, fields);
  };

  const handleCopyConnectionString = () => {
    if (!data.connectionString) return;
    navigator.clipboard.writeText(data.connectionString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddEnvVar = () => {
    const updated = [
      ...envVars,
      { id: `ev_${Date.now()}`, key: "", value: "" },
    ];
    setEnvVars(updated);
    handleUpdate({ envVars: updated });
  };

  const handleUpdateEnvVar = (id: string, key: string, value: string) => {
    const updated = envVars.map((ev) =>
      ev.id === id ? { ...ev, key, value } : ev
    );
    setEnvVars(updated);
    handleUpdate({ envVars: updated });
  };

  const handleRemoveEnvVar = (id: string) => {
    const updated = envVars.filter((ev) => ev.id !== id);
    setEnvVars(updated);
    handleUpdate({ envVars: updated });
  };

  const isApp = data.serviceType === "application" || data.serviceType === "worker";
  const isDb = data.serviceType === "database" || data.serviceType === "cache";
  const isRepo = data.serviceType === "repository";
  // Mirrors a real platform service: backend-owned, so not editable here.
  const isManaged = Boolean(data.serviceId);

  return (
    <aside
      className="absolute right-0 top-0 bottom-0 w-[340px] max-w-[calc(100vw-32px)] bg-[#111110] border-l border-[#222220] z-40 flex flex-col select-none shadow-[-16px_0_40px_rgba(0,0,0,0.7)] animate-in slide-in-from-right-2 duration-150 ease-out"
      onClick={(e) => e.stopPropagation()}
    >
      {/* ================= Header with Rich Identity ================= */}
      <div className="px-4 py-3.5 border-b border-[#222220] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <div className="w-7 h-7 rounded-[6px] bg-[#181817] border border-[#262522] flex items-center justify-center shrink-0 shadow-inner">
            <Icon className="w-4 h-4 shrink-0" />
          </div>
          <div className="min-w-0">
            <h3 className="font-sans text-[13.5px] font-semibold text-[#F1F0ED] tracking-[-0.015em] truncate leading-tight">
              {label || data.label || "Service"}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#72B69A] shrink-0" />
              <p className="font-mono text-[10.5px] text-[#A09E98] truncate">
                {data.subType || data.serviceType}
              </p>
              <span className="text-[#3E3D38] text-[9px]">•</span>
              <span className="font-mono text-[10px] text-[#77756F] truncate">
                {node.id}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-[5px] text-[#77756F] hover:text-[#F1F0ED] hover:bg-[#181817] transition-colors cursor-pointer shrink-0"
          title="Close inspector (Esc)"
          aria-label="Close inspector"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ================= Scrollable Body ================= */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Section: General Identity */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between pb-1 border-b border-[#1E1E1C]">
            <span className="font-mono text-[10px] font-medium tracking-[0.08em] uppercase text-[#77756F]">
              General Settings
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11.5px] font-medium text-[#A09E98] tracking-[-0.01em]">
              Service Name
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                handleUpdate({ label: e.target.value });
              }}
              placeholder="service-name"
              readOnly={isManaged}
              className="w-full h-8 px-2.5 rounded-[5px] bg-[#161615] hover:bg-[#181817] focus:bg-[#141413] border border-[#222220] hover:border-[#2C2B28] focus:border-[#E58B62]/80 focus:ring-1 focus:ring-[#E58B62]/20 text-[12px] font-sans text-[#F1F0ED] outline-none transition-all placeholder:text-[#52504B]"
            />
          </div>
        </div>

        {/* Section: Repository / Source Details */}
        {isRepo && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between pb-1 border-b border-[#1E1E1C]">
              <span className="font-mono text-[10px] font-medium tracking-[0.08em] uppercase text-[#77756F]">
                Source Repository
              </span>
            </div>

            {/* Technical Metadata Card */}
            <div className="rounded-[6px] bg-[#161615] border border-[#222220] p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#77756F] font-sans">Provider</span>
                <span className="font-mono text-[#F1F0ED] flex items-center gap-1.5">
                  <GitHubIcon className="w-3 h-3 text-[#A09E98]" />
                  <span>GitHub</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#77756F] font-sans">Branch</span>
                <span className="font-mono text-[#F1F0ED] flex items-center gap-1">
                  <GitBranch className="w-2.5 h-2.5 text-[#E58B62]" />
                  <span>{branch || "main"}</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#77756F] font-sans">Deployment</span>
                <span className="font-mono text-[#72B69A] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#72B69A]" />
                  <span>Auto-deploy</span>
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11.5px] font-medium text-[#A09E98] tracking-[-0.01em]">
                  Repository URL
                </label>
                {repoUrl && (
                  <a
                    href={repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10.5px] font-mono text-[#77756F] hover:text-[#E58B62] transition-colors"
                  >
                    <span>View repo</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => {
                  setRepoUrl(e.target.value);
                  handleUpdate({ repoUrl: e.target.value });
                }}
                placeholder="https://github.com/org/repo"
                className="w-full h-8 px-2.5 rounded-[5px] bg-[#161615] hover:bg-[#181817] focus:bg-[#141413] border border-[#222220] hover:border-[#2C2B28] focus:border-[#E58B62]/80 focus:ring-1 focus:ring-[#E58B62]/20 text-[11.5px] font-mono text-[#F1F0ED] outline-none transition-all placeholder:text-[#52504B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11.5px] font-medium text-[#A09E98] tracking-[-0.01em]">
                Active Branch
              </label>
              <div className="relative flex items-center">
                <GitBranch className="w-3.5 h-3.5 text-[#77756F] absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => {
                    setBranch(e.target.value);
                    handleUpdate({ branch: e.target.value });
                  }}
                  placeholder="main"
                  className="w-full h-8 pl-8 pr-2.5 rounded-[5px] bg-[#161615] hover:bg-[#181817] focus:bg-[#141413] border border-[#222220] hover:border-[#2C2B28] focus:border-[#E58B62]/80 focus:ring-1 focus:ring-[#E58B62]/20 text-[11.5px] font-mono text-[#F1F0ED] outline-none transition-all placeholder:text-[#52504B]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section: Backend-managed service summary */}
        {isManaged && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between pb-1 border-b border-[#1E1E1C]">
              <span className="font-mono text-[10px] font-medium tracking-[0.08em] uppercase text-[#77756F]">
                Service
              </span>
            </div>
            <div className="rounded-[6px] bg-[#161615] border border-[#222220] p-3 space-y-2 text-[11px]">
              {(
                [
                  ["Environment", data.environmentName],
                  ["Repository", data.repositoryFullName ?? "Not connected"],
                  ["Branch", data.branch],
                  ["Root directory", data.rootDir],
                  ["Source", data.sourceStatus],
                  [
                    "Auto-deploy",
                    data.autoDeploy === undefined ? undefined : data.autoDeploy ? "On" : "Off",
                  ],
                  ["Latest deployment", data.deploymentStatus?.replace(/_/g, " ") ?? "None yet"],
                  ["Commit", data.commitSha?.slice(0, 7)],
                ] as const
              )
                .filter(([, value]) => value)
                .map(([name, value]) => (
                  <div key={name} className="flex items-center justify-between gap-3">
                    <span className="text-[#77756F] font-sans">{name}</span>
                    <span className="font-mono text-[#F1F0ED] truncate">{value}</span>
                  </div>
                ))}
            </div>
            {data.publicUrl && /^https?:\/\//i.test(data.publicUrl) && (
              <a
                href={data.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-mono text-[#E58B62] hover:underline break-all"
              >
                <span>{data.publicUrl}</span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </a>
            )}
          </div>
        )}

        {/* Section: Application / Worker Build Configuration */}
        {isApp && !isManaged && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between pb-1 border-b border-[#1E1E1C]">
              <span className="font-mono text-[10px] font-medium tracking-[0.08em] uppercase text-[#77756F]">
                Build & Runtime
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11.5px] font-medium text-[#A09E98] tracking-[-0.01em]">
                Root Directory
              </label>
              <input
                type="text"
                value={rootDir}
                onChange={(e) => {
                  setRootDir(e.target.value);
                  handleUpdate({ rootDir: e.target.value });
                }}
                placeholder="."
                className="w-full h-8 px-2.5 rounded-[5px] bg-[#161615] hover:bg-[#181817] focus:bg-[#141413] border border-[#222220] hover:border-[#2C2B28] focus:border-[#E58B62]/80 focus:ring-1 focus:ring-[#E58B62]/20 text-[11.5px] font-mono text-[#F1F0ED] outline-none transition-all placeholder:text-[#52504B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11.5px] font-medium text-[#A09E98] tracking-[-0.01em]">
                Build Command
              </label>
              <input
                type="text"
                value={buildCommand}
                onChange={(e) => {
                  setBuildCommand(e.target.value);
                  handleUpdate({ buildCommand: e.target.value });
                }}
                placeholder="pnpm build"
                className="w-full h-8 px-2.5 rounded-[5px] bg-[#161615] hover:bg-[#181817] focus:bg-[#141413] border border-[#222220] hover:border-[#2C2B28] focus:border-[#E58B62]/80 focus:ring-1 focus:ring-[#E58B62]/20 text-[11.5px] font-mono text-[#F1F0ED] outline-none transition-all placeholder:text-[#52504B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11.5px] font-medium text-[#A09E98] tracking-[-0.01em]">
                Start Command
              </label>
              <input
                type="text"
                value={startCommand}
                onChange={(e) => {
                  setStartCommand(e.target.value);
                  handleUpdate({ startCommand: e.target.value });
                }}
                placeholder="pnpm start"
                className="w-full h-8 px-2.5 rounded-[5px] bg-[#161615] hover:bg-[#181817] focus:bg-[#141413] border border-[#222220] hover:border-[#2C2B28] focus:border-[#E58B62]/80 focus:ring-1 focus:ring-[#E58B62]/20 text-[11.5px] font-mono text-[#F1F0ED] outline-none transition-all placeholder:text-[#52504B]"
              />
            </div>

            {/* Environment Variables */}
            <div className="space-y-2 pt-2 border-t border-[#1C1C1A]">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-medium text-[#A09E98] tracking-[-0.01em]">
                  Environment Variables
                </span>
                <button
                  type="button"
                  onClick={handleAddEnvVar}
                  className="inline-flex items-center gap-1 text-[11px] font-sans text-[#E58B62] hover:text-[#F0A17B] transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add variable</span>
                </button>
              </div>

              {envVars.length === 0 ? (
                <div className="px-3 py-2 rounded-[6px] bg-[#161615]/60 border border-[#1F1F1D] text-[11px] text-[#77756F]">
                  No custom environment variables.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {envVars.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={ev.key}
                        onChange={(e) =>
                          handleUpdateEnvVar(ev.id, e.target.value, ev.value)
                        }
                        placeholder="KEY"
                        className="w-1/2 h-7 bg-[#161615] border border-[#222220] focus:border-[#E58B62]/80 rounded-[4px] px-2 text-[10.5px] font-mono text-[#F1F0ED] outline-none placeholder:text-[#52504B]"
                      />
                      <input
                        type="text"
                        value={ev.value}
                        onChange={(e) =>
                          handleUpdateEnvVar(ev.id, ev.key, e.target.value)
                        }
                        placeholder="VALUE"
                        className="w-1/2 h-7 bg-[#161615] border border-[#222220] focus:border-[#E58B62]/80 rounded-[4px] px-2 text-[10.5px] font-mono text-[#F1F0ED] outline-none placeholder:text-[#52504B]"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveEnvVar(ev.id)}
                        className="text-[#77756F] hover:text-[#EF4444] p-1 rounded transition-colors cursor-pointer"
                        title="Remove variable"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section: Database & Cache Configuration */}
        {isDb && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between pb-1 border-b border-[#1E1E1C]">
              <span className="font-mono text-[10px] font-medium tracking-[0.08em] uppercase text-[#77756F]">
                Engine & Networking
              </span>
            </div>

            {/* Technical Metadata Card */}
            <div className="rounded-[6px] bg-[#161615] border border-[#222220] p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#77756F] font-sans">Engine</span>
                <span className="font-mono text-[#F1F0ED]">{data.subType || "Database"}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#77756F] font-sans">Default Port</span>
                <span className="font-mono text-[#F1F0ED]">{port || 5432}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#77756F] font-sans">Status</span>
                <span className="font-mono text-[#72B69A] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#72B69A]" />
                  <span>Ready to deploy</span>
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11.5px] font-medium text-[#A09E98] tracking-[-0.01em]">
                Database Name
              </label>
              <input
                type="text"
                value={databaseName}
                onChange={(e) => {
                  setDatabaseName(e.target.value);
                  handleUpdate({ databaseName: e.target.value });
                }}
                placeholder="app"
                className="w-full h-8 px-2.5 rounded-[5px] bg-[#161615] hover:bg-[#181817] focus:bg-[#141413] border border-[#222220] hover:border-[#2C2B28] focus:border-[#E58B62]/80 focus:ring-1 focus:ring-[#E58B62]/20 text-[11.5px] font-mono text-[#F1F0ED] outline-none transition-all placeholder:text-[#52504B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11.5px] font-medium text-[#A09E98] tracking-[-0.01em]">
                Port
              </label>
              <input
                type="number"
                value={port ?? ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setPort(isNaN(val) ? undefined : val);
                  handleUpdate({ port: isNaN(val) ? undefined : val });
                }}
                placeholder="5432"
                className="w-full h-8 px-2.5 rounded-[5px] bg-[#161615] hover:bg-[#181817] focus:bg-[#141413] border border-[#222220] hover:border-[#2C2B28] focus:border-[#E58B62]/80 focus:ring-1 focus:ring-[#E58B62]/20 text-[11.5px] font-mono text-[#F1F0ED] outline-none transition-all placeholder:text-[#52504B]"
              />
            </div>

            {data.connectionString && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11.5px] font-medium text-[#A09E98] tracking-[-0.01em]">
                    Internal Connection URL
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyConnectionString}
                    className="inline-flex items-center gap-1 text-[10.5px] font-mono text-[#77756F] hover:text-[#E58B62] transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-2.5 h-2.5 text-[#72B69A]" />
                        <span className="text-[#72B69A]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-2.5 h-2.5" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="w-full bg-[#161615] border border-[#222220] rounded-[6px] px-3 py-2 text-[11px] font-mono text-[#A09E98] break-all select-all whitespace-pre-wrap leading-relaxed">
                  {data.connectionString}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= Minimal Footer: Delete Service ================= */}
      <div className="p-3 border-t border-[#222220] bg-[#111110] shrink-0">
        {isManaged ? (
          <p className="text-[11px] font-sans text-[#77756F] leading-snug">
            This service is managed by Summit. Deleting services from the canvas isn&apos;t supported yet.
          </p>
        ) : confirmDelete ? (
          <div className="flex items-center gap-2 animate-in fade-in duration-100">
            <button
              type="button"
              onClick={() => onDeleteNode(node.id)}
              className="flex-1 px-3 py-1.5 rounded-[5px] bg-[#EF4444] hover:bg-[#DC2626] text-white text-[11.5px] font-medium font-sans transition-colors cursor-pointer"
            >
              Confirm delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 rounded-[5px] bg-[#181817] hover:bg-[#202020] text-[#A09E98] text-[11.5px] font-medium font-sans transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[5px] text-[#77756F] hover:text-[#EF4444] hover:bg-[#1E1414] border border-transparent hover:border-[#381F1F] text-[11.5px] font-sans transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete service</span>
          </button>
        )}
      </div>
    </aside>
  );
}
