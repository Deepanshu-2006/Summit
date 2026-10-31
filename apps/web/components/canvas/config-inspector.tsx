"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Trash2,
  Plus,
  Layout,
  Server,
  Database,
  Layers,
  Cpu,
  GitBranch,
} from "lucide-react";
import type {
  SummitNode,
  SummitNodeData,
  NodeType,
  EnvironmentVariable,
} from "@/lib/canvas/types";

interface ConfigInspectorProps {
  node: SummitNode | null;
  onClose: () => void;
  onUpdateNode: (nodeId: string, updatedData: Partial<SummitNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
}

function getServiceIcon(type: NodeType) {
  switch (type) {
    case "repository":
      return GitBranch;
    case "application":
      return Layout;
    case "database":
      return Database;
    case "cache":
      return Layers;
    case "worker":
      return Cpu;
    default:
      return Server;
  }
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
  }, [node]);

  if (!node) return null;

  const data = node.data;
  const Icon = getServiceIcon(data.serviceType);

  const handleUpdate = (fields: Partial<SummitNodeData>) => {
    onUpdateNode(node.id, fields);
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

  return (
    <aside
      className="absolute right-0 top-0 bottom-0 w-[320px] bg-[#141414] border-l border-[#242424] z-20 flex flex-col select-none shadow-2xl animate-in slide-in-from-right duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="h-[52px] px-4 border-b border-[#242424] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 bg-[#191919] border border-[#2A2A2A] text-[#E79570]">
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-sans text-[13px] font-medium text-[#F2F0EC] truncate">
              {data.subType || data.serviceType}
            </h3>
            <p className="font-mono text-[10px] text-[#77746F] truncate">
              ID: {node.id}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center text-[#A09D98] hover:text-[#F2F0EC] hover:bg-[#202020] transition-colors"
          title="Close inspector (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Settings Form Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Resource Name */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono text-[#A09D98]">
            Resource Name
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              handleUpdate({ label: e.target.value });
            }}
            placeholder="service-name"
            className="w-full bg-[#191919] border border-[#2A2A2A] focus:border-[#E79570] rounded-[6px] px-2.5 py-1.5 text-[12.5px] font-mono text-[#F2F0EC] outline-none transition-colors"
          />
        </div>

        {/* Repository Settings */}
        {isRepo && (
          <>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-[#A09D98]">
                Repository URL
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => {
                  setRepoUrl(e.target.value);
                  handleUpdate({ repoUrl: e.target.value });
                }}
                placeholder="https://github.com/org/repo"
                className="w-full bg-[#191919] border border-[#2A2A2A] focus:border-[#E79570] rounded-[6px] px-2.5 py-1.5 text-[12px] font-mono text-[#F2F0EC] outline-none transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-[#A09D98]">
                Default Branch
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => {
                  setBranch(e.target.value);
                  handleUpdate({ branch: e.target.value });
                }}
                placeholder="main"
                className="w-full bg-[#191919] border border-[#2A2A2A] focus:border-[#E79570] rounded-[6px] px-2.5 py-1.5 text-[12px] font-mono text-[#F2F0EC] outline-none transition-colors"
              />
            </div>
          </>
        )}

        {/* Application / Worker Settings */}
        {isApp && (
          <>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-[#A09D98]">
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
                className="w-full bg-[#191919] border border-[#2A2A2A] focus:border-[#E79570] rounded-[6px] px-2.5 py-1.5 text-[12px] font-mono text-[#F2F0EC] outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-[#A09D98]">
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
                className="w-full bg-[#191919] border border-[#2A2A2A] focus:border-[#E79570] rounded-[6px] px-2.5 py-1.5 text-[12px] font-mono text-[#F2F0EC] outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-[#A09D98]">
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
                className="w-full bg-[#191919] border border-[#2A2A2A] focus:border-[#E79570] rounded-[6px] px-2.5 py-1.5 text-[12px] font-mono text-[#F2F0EC] outline-none transition-colors"
              />
            </div>

            {/* Environment Variables */}
            <div className="space-y-2 pt-2 border-t border-[#242424]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#A09D98]">
                  Environment Variables
                </span>
                <button
                  type="button"
                  onClick={handleAddEnvVar}
                  className="inline-flex items-center gap-1 text-[11px] font-sans text-[#E79570] hover:text-[#F0A17B] hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              </div>

              {envVars.length === 0 ? (
                <p className="text-[11px] text-[#77746F] italic">
                  No environment variables defined.
                </p>
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
                        className="w-1/2 bg-[#191919] border border-[#2A2A2A] rounded px-2 py-1 text-[11px] font-mono text-[#F2F0EC] outline-none focus:border-[#E79570]"
                      />
                      <input
                        type="text"
                        value={ev.value}
                        onChange={(e) =>
                          handleUpdateEnvVar(ev.id, ev.key, e.target.value)
                        }
                        placeholder="VALUE"
                        className="w-1/2 bg-[#191919] border border-[#2A2A2A] rounded px-2 py-1 text-[11px] font-mono text-[#F2F0EC] outline-none focus:border-[#E79570]"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveEnvVar(ev.id)}
                        className="text-[#77746F] hover:text-[#D77D7D] p-1"
                        title="Remove variable"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Database / Cache Settings */}
        {isDb && (
          <>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-[#A09D98]">
                Database Name
              </label>
              <input
                type="text"
                value={databaseName}
                onChange={(e) => {
                  setDatabaseName(e.target.value);
                  handleUpdate({ databaseName: e.target.value });
                }}
                placeholder="app_db"
                className="w-full bg-[#191919] border border-[#2A2A2A] focus:border-[#E79570] rounded-[6px] px-2.5 py-1.5 text-[12px] font-mono text-[#F2F0EC] outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-[#A09D98]">
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
                className="w-full bg-[#191919] border border-[#2A2A2A] focus:border-[#E79570] rounded-[6px] px-2.5 py-1.5 text-[12px] font-mono text-[#F2F0EC] outline-none transition-colors"
              />
            </div>

            {data.connectionString && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[#A09D98]">
                  Internal Connection String
                </label>
                <div className="bg-[#191919] border border-[#2A2A2A] rounded-[6px] px-2.5 py-1.5 text-[11px] font-mono text-[#A09D98] break-all select-all">
                  {data.connectionString}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer: Delete Action */}
      <div className="p-3 border-t border-[#242424] bg-[#141414] shrink-0">
        <button
          type="button"
          onClick={() => onDeleteNode(node.id)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-[#3A2222] bg-[#1E1414] hover:bg-[#2A1818] text-[#D77D7D] text-[12px] font-sans transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Node</span>
        </button>
      </div>
    </aside>
  );
}

