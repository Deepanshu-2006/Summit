"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Plus,
  Play,
  RotateCcw,
  ExternalLink,
  Activity,
  Terminal,
  Settings,
  Shield,
  Layers,
  Database,
  Layout,
  Server,
  GitBranch,
  Cpu,
  HardDrive,
  AlertCircle,
} from "lucide-react";
import type { SummitNode, SummitNodeData, EnvironmentVariable } from "@/lib/canvas/types";

interface ConfigPanelProps {
  selectedNode: SummitNode | null;
  onUpdateNodeData: (nodeId: string, updatedData: Partial<SummitNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (node: SummitNode) => void;
  onClose: () => void;
  allNodes: SummitNode[];
}

export function ConfigPanel({
  selectedNode,
  onUpdateNodeData,
  onDeleteNode,
  onDuplicateNode,
  onClose,
  allNodes,
}: ConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<"settings" | "env" | "metrics">("settings");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvVal, setNewEnvVal] = useState("");
  const [newEnvSecret, setNewEnvSecret] = useState(false);

  if (!selectedNode) return null;

  const { id, data } = selectedNode;

  const handleCopy = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const toggleRevealSecret = (varId: string) => {
    setRevealedSecrets((prev) => ({ ...prev, [varId]: !prev[varId] }));
  };

  const handleAddEnvVar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEnvKey.trim()) return;

    const newVar: EnvironmentVariable = {
      id: `ev_${Date.now()}`,
      key: newEnvKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
      value: newEnvVal,
      isSecret: newEnvSecret,
    };

    onUpdateNodeData(id, {
      envVars: [...data.envVars, newVar],
    });

    setNewEnvKey("");
    setNewEnvVal("");
    setNewEnvSecret(false);
  };

  const handleDeleteEnvVar = (varId: string) => {
    onUpdateNodeData(id, {
      envVars: data.envVars.filter((v) => v.id !== varId),
    });
  };

  // Connected nodes analysis for reference variables (like Railway)
  const availableReferences = allNodes
    .filter((n) => n.id !== id && (n.data.serviceType === "database" || n.data.serviceType === "cache"))
    .map((n) => ({
      nodeId: n.id,
      label: n.data.label,
      type: n.data.databaseEngine || n.data.serviceType,
      refVar: `${n.data.label.toUpperCase().replace(/-/g, "_")}_URL`,
      refVal: `\${{${n.data.label}.CONNECTION_URL}}`,
    }));

  return (
    <aside
      className="absolute right-4 top-20 bottom-6 w-[380px] max-w-[calc(100vw-32px)] bg-[#141413]/98 border border-[#2B2B28] rounded-[12px] shadow-2xl shadow-black/90 backdrop-blur-xl z-20 flex flex-col overflow-hidden select-none animate-in fade-in slide-in-from-right-4 duration-200"
      aria-label="Node Configuration Panel"
    >
      {/* ---------------- Panel Header ---------------- */}
      <div className="p-4 border-b border-[#242422] flex items-center justify-between shrink-0 bg-[#121211]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-[6px] bg-[#1E1E1C] border border-[#333330] flex items-center justify-center text-accent-orange shrink-0">
            {data.serviceType === "repository" && <GitBranch className="w-4 h-4" />}
            {data.serviceType === "application" && <Layout className="w-4 h-4" />}
            {data.serviceType === "database" && <Database className="w-4 h-4" />}
            {data.serviceType === "cache" && <Layers className="w-4 h-4" />}
            {data.serviceType === "worker" && <Cpu className="w-4 h-4" />}
            {data.serviceType === "storage" && <HardDrive className="w-4 h-4" />}
          </div>

          <div className="min-w-0">
            <input
              type="text"
              value={data.label}
              onChange={(e) => onUpdateNodeData(id, { label: e.target.value })}
              className="font-mono text-[13px] font-semibold text-[#FAF8F5] bg-transparent border-b border-transparent hover:border-[#383834] focus:border-accent-orange outline-none truncate w-full"
            />
            <p className="font-mono text-[10px] text-[#80807C]">
              {data.subType || data.serviceType.toUpperCase()} // {data.region}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onDuplicateNode(selectedNode)}
            className="p-1.5 rounded-[5px] text-[#80807C] hover:text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors cursor-pointer"
            title="Duplicate service"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onDeleteNode(id)}
            className="p-1.5 rounded-[5px] text-[#80807C] hover:text-[#D77D7D] hover:bg-[#2B1919] transition-colors cursor-pointer"
            title="Delete service"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[5px] text-[#80807C] hover:text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors cursor-pointer ml-1"
            title="Close panel (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ---------------- Navigation Tabs ---------------- */}
      <div className="flex items-center px-4 border-b border-[#242422] bg-[#121211] shrink-0 font-mono text-[11px]">
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`py-2 px-3 border-b-2 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "settings"
              ? "border-accent-orange text-accent-orange"
              : "border-transparent text-[#80807C] hover:text-[#FAF8F5]"
          }`}
        >
          <Settings className="w-3 h-3" />
          <span>Settings</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("env")}
          className={`py-2 px-3 border-b-2 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "env"
              ? "border-accent-orange text-accent-orange"
              : "border-transparent text-[#80807C] hover:text-[#FAF8F5]"
          }`}
        >
          <Shield className="w-3 h-3" />
          <span>Variables ({data.envVars.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("metrics")}
          className={`py-2 px-3 border-b-2 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "metrics"
              ? "border-accent-orange text-accent-orange"
              : "border-transparent text-[#80807C] hover:text-[#FAF8F5]"
          }`}
        >
          <Activity className="w-3 h-3" />
          <span>Telemetry</span>
        </button>
      </div>

      {/* ---------------- Panel Content ---------------- */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ================= TAB 1: SETTINGS ================= */}
        {activeTab === "settings" && (
          <div className="space-y-4 font-mono text-[11.5px]">
            {/* Common: Service Identifier */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-[#80807C] font-semibold">Service Name</label>
              <input
                type="text"
                value={data.label}
                onChange={(e) => onUpdateNodeData(id, { label: e.target.value })}
                className="w-full h-8 px-2.5 rounded-[6px] bg-[#181816] border border-[#2E2E2A] text-[#FAF8F5] focus:border-accent-orange outline-none"
              />
            </div>

            {/* Application / API Specifics */}
            {(data.serviceType === "application" || data.serviceType === "worker") && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-[#80807C] font-semibold">Port</label>
                    <input
                      type="number"
                      value={data.port || 3000}
                      onChange={(e) => onUpdateNodeData(id, { port: parseInt(e.target.value) || 3000 })}
                      className="w-full h-8 px-2.5 rounded-[6px] bg-[#181816] border border-[#2E2E2A] text-[#FAF8F5] focus:border-accent-orange outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-[#80807C] font-semibold">Replicas</label>
                    <select
                      value={data.replicas || 1}
                      onChange={(e) => onUpdateNodeData(id, { replicas: parseInt(e.target.value) || 1 })}
                      className="w-full h-8 px-2 rounded-[6px] bg-[#181816] border border-[#2E2E2A] text-[#FAF8F5] focus:border-accent-orange outline-none cursor-pointer"
                    >
                      <option value={1}>1 Instance</option>
                      <option value={2}>2 Instances</option>
                      <option value={3}>3 Instances</option>
                      <option value={5}>5 Instances (Autoscale)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-[#80807C] font-semibold">Build Command</label>
                  <input
                    type="text"
                    value={data.buildCommand || ""}
                    onChange={(e) => onUpdateNodeData(id, { buildCommand: e.target.value })}
                    placeholder="e.g. pnpm build"
                    className="w-full h-8 px-2.5 rounded-[6px] bg-[#181816] border border-[#2E2E2A] text-[#FAF8F5] focus:border-accent-orange outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-[#80807C] font-semibold">Start Command</label>
                  <input
                    type="text"
                    value={data.startCommand || ""}
                    onChange={(e) => onUpdateNodeData(id, { startCommand: e.target.value })}
                    placeholder="e.g. pnpm start"
                    className="w-full h-8 px-2.5 rounded-[6px] bg-[#181816] border border-[#2E2E2A] text-[#FAF8F5] focus:border-accent-orange outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-[#80807C] font-semibold">Root Directory</label>
                  <input
                    type="text"
                    value={data.rootDir || ""}
                    onChange={(e) => onUpdateNodeData(id, { rootDir: e.target.value })}
                    placeholder="e.g. apps/web"
                    className="w-full h-8 px-2.5 rounded-[6px] bg-[#181816] border border-[#2E2E2A] text-[#FAF8F5] focus:border-accent-orange outline-none"
                  />
                </div>
              </>
            )}

            {/* Database / Cache Specifics */}
            {(data.serviceType === "database" || data.serviceType === "cache") && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-[#80807C] font-semibold">Port</label>
                    <input
                      type="number"
                      value={data.port || 5432}
                      onChange={(e) => onUpdateNodeData(id, { port: parseInt(e.target.value) || 5432 })}
                      className="w-full h-8 px-2.5 rounded-[6px] bg-[#181816] border border-[#2E2E2A] text-[#FAF8F5] focus:border-accent-orange outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-[#80807C] font-semibold">Storage Volume</label>
                    <select
                      value={data.storageSizeGb || 10}
                      onChange={(e) => onUpdateNodeData(id, { storageSizeGb: parseInt(e.target.value) || 10 })}
                      className="w-full h-8 px-2 rounded-[6px] bg-[#181816] border border-[#2E2E2A] text-[#FAF8F5] focus:border-accent-orange outline-none cursor-pointer"
                    >
                      <option value={5}>5 GB NVMe</option>
                      <option value={10}>10 GB NVMe</option>
                      <option value={20}>20 GB NVMe</option>
                      <option value={50}>50 GB NVMe</option>
                    </select>
                  </div>
                </div>

                {data.connectionString && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase text-[#80807C] font-semibold">Internal Connection URL</label>
                      <button
                        type="button"
                        onClick={() => handleCopy(data.connectionString!, "conn_str")}
                        className="text-[10px] text-accent-orange hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === "conn_str" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === "conn_str" ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="p-2.5 rounded-[6px] bg-[#181816] border border-[#2E2E2A] text-[10.5px] text-[#B5B3AF] break-all font-mono">
                      {data.connectionString}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Repository Specifics */}
            {data.serviceType === "repository" && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-[#80807C] font-semibold">Repository URL</label>
                  <input
                    type="text"
                    value={data.repoUrl || ""}
                    onChange={(e) => onUpdateNodeData(id, { repoUrl: e.target.value })}
                    placeholder="https://github.com/..."
                    className="w-full h-8 px-2.5 rounded-[6px] bg-[#181816] border border-[#2E2E2A] text-[#FAF8F5] focus:border-accent-orange outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-[#80807C] font-semibold">Target Branch</label>
                  <input
                    type="text"
                    value={data.branch || "main"}
                    onChange={(e) => onUpdateNodeData(id, { branch: e.target.value })}
                    placeholder="main"
                    className="w-full h-8 px-2.5 rounded-[6px] bg-[#181816] border border-[#2E2E2A] text-[#FAF8F5] focus:border-accent-orange outline-none"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-[6px] bg-[#181816] border border-[#2E2E2A]">
                  <div>
                    <span className="text-[11px] text-[#FAF8F5] block font-medium">Automatic Deployments</span>
                    <span className="text-[9.5px] text-[#70706C]">Trigger build on git push to {data.branch || "main"}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={data.autoDeploy ?? true}
                    onChange={(e) => onUpdateNodeData(id, { autoDeploy: e.target.checked })}
                    className="w-4 h-4 accent-accent-orange cursor-pointer"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* ================= TAB 2: ENVIRONMENT VARIABLES ================= */}
        {activeTab === "env" && (
          <div className="space-y-4 font-mono text-[11px]">
            {/* Railway-style Connected Service References */}
            {availableReferences.length > 0 && (
              <div className="p-2.5 rounded-[8px] bg-[#1B1917] border border-[#402D22] space-y-1.5">
                <div className="flex items-center gap-1.5 text-accent-orange text-[10.5px] font-semibold">
                  <Database className="w-3.5 h-3.5" />
                  <span>Connectable Service References</span>
                </div>
                <p className="text-[10px] text-[#B0ADA6] leading-normal font-sans">
                  Variables available from connected architecture nodes:
                </p>
                <div className="space-y-1 pt-1">
                  {availableReferences.map((ref, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-1.5 rounded-[4px] bg-[#151413] border border-[#2C241E] text-[10px]"
                    >
                      <span className="text-accent-orange font-semibold">{ref.refVar}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const existing = data.envVars.find((v) => v.key === ref.refVar);
                          if (!existing) {
                            onUpdateNodeData(id, {
                              envVars: [
                                ...data.envVars,
                                {
                                  id: `ev_${Date.now()}`,
                                  key: ref.refVar,
                                  value: ref.refVal,
                                  isSecret: true,
                                  isReference: true,
                                  referenceSource: ref.nodeId,
                                },
                              ],
                            });
                          }
                        }}
                        className="px-2 py-0.5 rounded bg-[#2A201A] hover:bg-accent-orange hover:text-[#111111] text-accent-orange transition-colors cursor-pointer"
                      >
                        + Insert Ref
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Existing Env Vars List */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase text-[#80807C] font-semibold">Active Variables</span>
              {data.envVars.length === 0 ? (
                <div className="p-4 rounded-[6px] bg-[#181816] border border-dashed border-[#2E2E2A] text-center text-[#666662] text-[11px]">
                  No environment variables defined yet.
                </div>
              ) : (
                data.envVars.map((v) => {
                  const isRevealed = revealedSecrets[v.id];
                  return (
                    <div
                      key={v.id}
                      className="p-2 rounded-[6px] bg-[#181816] border border-[#2B2B28] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-accent-orange font-semibold text-[11px] truncate">
                          {v.key}
                        </span>
                        <div className="flex items-center gap-1">
                          {v.isSecret && (
                            <button
                              type="button"
                              onClick={() => toggleRevealSecret(v.id)}
                              className="p-1 rounded text-[#80807C] hover:text-[#FAF8F5]"
                              title={isRevealed ? "Hide Secret" : "Reveal Secret"}
                            >
                              {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteEnvVar(v.id)}
                            className="p-1 rounded text-[#80807C] hover:text-[#D77D7D]"
                            title="Delete variable"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="text-[10.5px] text-[#A0A09C] break-all">
                        {v.isSecret && !isRevealed ? "••••••••••••••••" : v.value}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add New Variable Form */}
            <form onSubmit={handleAddEnvVar} className="p-3 rounded-[8px] bg-[#181816] border border-[#2B2B28] space-y-2.5">
              <span className="text-[10px] uppercase text-[#80807C] font-semibold block">Add Variable</span>
              <input
                type="text"
                placeholder="KEY (e.g. API_SECRET)"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                className="w-full h-7 px-2 rounded-[4px] bg-[#121211] border border-[#2B2B28] text-[#FAF8F5] focus:border-accent-orange outline-none text-[10.5px]"
              />
              <input
                type="text"
                placeholder="VALUE"
                value={newEnvVal}
                onChange={(e) => setNewEnvVal(e.target.value)}
                className="w-full h-7 px-2 rounded-[4px] bg-[#121211] border border-[#2B2B28] text-[#FAF8F5] focus:border-accent-orange outline-none text-[10.5px]"
              />
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-1.5 text-[10px] text-[#A0A09C] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEnvSecret}
                    onChange={(e) => setNewEnvSecret(e.target.checked)}
                    className="w-3.5 h-3.5 accent-accent-orange cursor-pointer"
                  />
                  <span>Mask as Secret</span>
                </label>
                <button
                  type="submit"
                  disabled={!newEnvKey.trim()}
                  className="h-6 px-3 rounded-[4px] bg-accent-orange hover:bg-accent-orange-hover text-[#111111] font-semibold text-[10.5px] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Add Variable
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= TAB 3: METRICS & LOGS ================= */}
        {activeTab === "metrics" && (
          <div className="space-y-4 font-mono text-[11px]">
            {/* Live Metrics Card */}
            <div className="p-3 rounded-[8px] bg-[#181816] border border-[#2B2B28] space-y-3">
              <span className="text-[10px] uppercase text-[#80807C] font-semibold block">Resource Utilization</span>

              {/* CPU Gauge */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#A0A09C]">CPU Load</span>
                  <span className="text-[#FAF8F5]">{data.metrics.cpuPct}%</span>
                </div>
                <div className="h-1.5 w-full bg-[#20201E] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-orange rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, data.metrics.cpuPct)}%` }}
                  />
                </div>
              </div>

              {/* Memory Gauge */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#A0A09C]">Memory (RAM)</span>
                  <span className="text-[#FAF8F5]">
                    {data.metrics.memoryMb} MB / {data.metrics.memoryLimitMb} MB
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[#20201E] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-semantic-success rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (data.metrics.memoryMb / (data.metrics.memoryLimitMb || 512)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Ingress Throughput */}
              <div className="flex items-center justify-between pt-1 border-t border-[#222220] text-[10px]">
                <span className="text-[#80807C]">Ingress Request Rate</span>
                <span className="text-[#FAF8F5]">{data.metrics.requestsPerSec} req/sec</span>
              </div>
            </div>

            {/* Event Logs Stream */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-[#80807C] font-semibold">Service Event Stream</span>
                <span className="text-[9px] text-[#60605C]">{data.logs.length} entries</span>
              </div>
              <div className="p-2.5 rounded-[8px] bg-[#10100F] border border-[#262624] space-y-1.5 max-h-[220px] overflow-y-auto">
                {data.logs.map((log) => (
                  <div key={log.id} className="text-[10px] leading-relaxed flex items-start gap-2">
                    <span className="text-[#555550] shrink-0">{log.timestamp}</span>
                    <span
                      className={`truncate ${
                        log.level === "success"
                          ? "text-semantic-success"
                          : log.level === "error"
                          ? "text-semantic-error"
                          : log.level === "warn"
                          ? "text-[#D6AD72]"
                          : "text-[#B5B3AF]"
                      }`}
                    >
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

