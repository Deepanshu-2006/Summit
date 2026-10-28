"use client";

import React, { useState, useCallback } from "react";
import { Play, Copy, Check, RefreshCw } from "lucide-react";

type HttpMethod = "GET" | "POST";

interface EndpointPreset {
  id: string;
  method: HttpMethod;
  path: string;
  label: string;
  description: string;
  defaultBody?: string;
  defaultParams?: { key: string; value: string; enabled: boolean }[];
}

const ENDPOINTS: EndpointPreset[] = [
  {
    id: "health",
    method: "GET",
    path: "/api/v1/health",
    label: "Health Check",
    description: "Verify edge routing and runtime telemetry",
  },
  {
    id: "project",
    method: "GET",
    path: "/api/v1/projects/meridian",
    label: "Project Info",
    description: "Production metadata, framework & environments",
  },
  {
    id: "resources",
    method: "GET",
    path: "/api/v1/resources",
    label: "List Resources",
    description: "All active database, storage, and worker nodes",
  },
  {
    id: "create-resource",
    method: "POST",
    path: "/api/v1/resources",
    label: "Create Resource",
    description: "Provision a new managed cloud infrastructure component",
    defaultBody: JSON.stringify(
      {
        name: "Edge Cache Volume",
        type: "storage",
        tier: "nvme-high-iops",
      },
      null,
      2
    ),
  },
  {
    id: "publish-release",
    method: "POST",
    path: "/api/v1/releases",
    label: "Publish Release",
    description: "Trigger production deployment across edge mesh",
    defaultBody: JSON.stringify(
      {
        version: "2.4.1",
        branch: "main",
        commit: "8f3a21c",
        changelog: "Optimize SSR hydration latency",
      },
      null,
      2
    ),
  },
];

interface ApiResponseState {
  status: number | null;
  statusText: string;
  durationMs: number | null;
  sizeBytes: number | null;
  headers: Record<string, string>;
  data: unknown;
  rawText: string;
  isError: boolean;
  errorMessage?: string;
}

const initialHealthResponse: ApiResponseState = {
  status: 200,
  statusText: "OK",
  durationMs: 14,
  sizeBytes: 198,
  headers: {
    "content-type": "application/json",
    "x-jetway-service": "meridian-api",
    "x-jetway-region": "cdg-1",
    "x-jetway-env": "production",
    "cache-control": "no-store, max-age=0",
  },
  data: {
    status: "healthy",
    service: "meridian-api",
    version: "1.0.0",
    region: "cdg-1 (Paris)",
    edge_routing: "anycast",
    uptime_seconds: 21780,
    timestamp: "2026-10-28T18:10:00.000Z",
  },
  rawText:
    '{"status":"healthy","service":"meridian-api","version":"1.0.0","region":"cdg-1 (Paris)","edge_routing":"anycast","uptime_seconds":21780,"timestamp":"2026-10-28T18:10:00.000Z"}',
  isError: false,
};

export function ApiServicePlayground() {
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>("health");
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [urlPath, setUrlPath] = useState<string>("/api/v1/health");
  const [requestTab, setRequestTab] = useState<"body" | "headers" | "params">("params");
  const [responseTab, setResponseTab] = useState<"pretty" | "raw" | "headers">("pretty");
  const [requestBody, setRequestBody] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [response, setResponse] = useState<ApiResponseState | null>(initialHealthResponse);

  // Headers configuration
  const defaultHeaders = [
    { key: "Content-Type", value: "application/json", enabled: true },
    { key: "Authorization", value: "Bearer jwt_jetway_live_8f3a", enabled: true },
    { key: "Accept", value: "application/json", enabled: true },
  ];

  // Execute request against real local route handlers
  const executeRequest = useCallback(
    async (overridePath?: string, overrideMethod?: HttpMethod, overrideBody?: string) => {
      const targetPath = overridePath ?? urlPath;
      const targetMethod = overrideMethod ?? method;
      const targetBody = overrideBody ?? requestBody;

      setIsLoading(true);
      const startMs = Date.now();

      try {
        const fetchOptions: RequestInit = {
          method: targetMethod,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        };

        if (targetMethod === "POST" && targetBody.trim()) {
          fetchOptions.body = targetBody;
        }

        const res = await fetch(targetPath, fetchOptions);
        const elapsed = Math.max(1, Date.now() - startMs);

        // Extract headers
        const resHeaders: Record<string, string> = {};
        res.headers.forEach((value, key) => {
          resHeaders[key] = value;
        });

        const rawText = await res.text();
        const sizeBytes = new Blob([rawText]).size;

        let parsedJson: unknown = null;
        try {
          parsedJson = JSON.parse(rawText);
        } catch {
          parsedJson = null;
        }

        setResponse({
          status: res.status,
          statusText:
            res.statusText ||
            (res.status === 200
              ? "OK"
              : res.status === 201
              ? "Created"
              : res.status === 400
              ? "Bad Request"
              : "Response"),
          durationMs: elapsed,
          sizeBytes,
          headers: resHeaders,
          data: parsedJson,
          rawText,
          isError: !res.ok,
        });
      } catch (err: unknown) {
        const elapsed = Math.max(1, Date.now() - startMs);
        const errMsg = err instanceof Error ? err.message : "Failed to connect to API";
        setResponse({
          status: 0,
          statusText: "Network Error",
          durationMs: elapsed,
          sizeBytes: 0,
          headers: {},
          data: { error: "Network Error", details: errMsg },
          rawText: errMsg,
          isError: true,
          errorMessage: errMsg,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [urlPath, method, requestBody]
  );

  // Switch endpoint preset
  const handleSelectEndpoint = (preset: EndpointPreset) => {
    setSelectedEndpointId(preset.id);
    setMethod(preset.method);
    setUrlPath(preset.path);
    if (preset.defaultBody) {
      setRequestBody(preset.defaultBody);
      setRequestTab("body");
    } else {
      setRequestTab("params");
    }
    executeRequest(preset.path, preset.method, preset.defaultBody);
  };

  // Copy response
  const handleCopy = () => {
    if (!response) return;
    const textToCopy =
      responseTab === "headers"
        ? JSON.stringify(response.headers, null, 2)
        : responseTab === "raw"
        ? response.rawText
        : JSON.stringify(response.data, null, 2);

    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="w-full h-full flex flex-col justify-between overflow-hidden text-[12px] font-sans select-text">
      {/* =================================================================
          TOP PRESET BAR: Compact quick-selector for Meridian endpoints
          ================================================================= */}
      <div className="shrink-0 flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-border-subtle/60 scrollbar-none">
        <span className="font-mono text-[10px] uppercase text-text-muted tracking-wider pr-1 hidden sm:inline shrink-0">
          Endpoints:
        </span>
        {ENDPOINTS.map((endpoint) => {
          const isSelected = selectedEndpointId === endpoint.id;
          return (
            <button
              key={endpoint.id}
              onClick={() => handleSelectEndpoint(endpoint)}
              className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border text-[11px] font-mono transition-all cursor-pointer ${
                isSelected
                  ? "bg-[#22262A] border-accent-orange/70 text-[#F1F0EC] shadow-sm"
                  : "bg-[#16181B] border-border-subtle/80 text-text-muted hover:text-text-secondary hover:border-border-default"
              }`}
            >
              <span
                className={`font-semibold text-[10px] ${
                  endpoint.method === "GET" ? "text-semantic-success" : "text-accent-orange"
                }`}
              >
                {endpoint.method}
              </span>
              <span className="truncate max-w-[130px] sm:max-w-none">{endpoint.path}</span>
            </button>
          );
        })}
      </div>

      {/* =================================================================
          SPLIT PLAYGROUND: Left = Request Builder, Right = Response Viewer
          ================================================================= */}
      <div className="flex-1 min-h-0 my-2 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden">
        {/* ===============================================================
            LEFT PANEL: REQUEST BUILDER (5 cols)
            =============================================================== */}
        <div className="lg:col-span-5 h-full rounded-[6px] bg-[#141618] border border-border-subtle/80 p-3 flex flex-col justify-between overflow-hidden shadow-inner">
          {/* URL & Method Bar */}
          <div className="shrink-0 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                <span>Environment:</span>
                <span className="text-[#F1F0EC] font-medium">Production (meridian.jetway.app)</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-[#1A1D20] p-1 rounded-[5px] border border-border-subtle">
              {/* Method badge */}
              <span
                className={`px-2 py-1 rounded-[3px] font-mono text-[11px] font-bold tracking-wide select-none ${
                  method === "GET"
                    ? "bg-[#83B69A]/15 text-semantic-success border border-semantic-success/25"
                    : "bg-[#D88762]/15 text-accent-orange border border-accent-orange/25"
                }`}
              >
                {method}
              </span>

              {/* Editable URL path */}
              <input
                type="text"
                value={urlPath}
                onChange={(e) => setUrlPath(e.target.value)}
                placeholder="/api/v1/..."
                className="flex-1 min-w-0 bg-transparent text-[#F1F0EC] font-mono text-[11.5px] px-1 py-0.5 focus:outline-none"
              />

              {/* Send Button */}
              <button
                onClick={() => executeRequest()}
                disabled={isLoading}
                className="shrink-0 bg-accent-orange hover:bg-accent-orange-hover disabled:opacity-60 text-[#111111] font-sans font-medium px-3 py-1 rounded-[4px] text-[11.5px] flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                {isLoading ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Play className="w-3 h-3 fill-current" />
                )}
                <span>Send</span>
              </button>
            </div>
          </div>

          {/* Request Configuration Tabs */}
          <div className="flex-1 min-h-0 flex flex-col mt-2.5 pt-2 border-t border-border-subtle/70 overflow-hidden">
            <div className="shrink-0 flex items-center justify-between pb-1.5">
              <div className="flex items-center gap-1">
                {(["params", "headers", "body"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setRequestTab(tab)}
                    className={`px-2 py-0.5 rounded-[3px] font-mono text-[10.5px] uppercase tracking-wider transition-colors cursor-pointer ${
                      requestTab === tab
                        ? "bg-[#25292D] text-[#F1F0EC] font-medium"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {tab}
                    {tab === "body" && method === "POST" && (
                      <span className="ml-1 w-1.5 h-1.5 inline-block rounded-full bg-accent-orange" />
                    )}
                  </button>
                ))}
              </div>
              <span className="text-[10px] font-mono text-text-muted">
                {requestTab === "body" ? "application/json" : "HTTP/1.1"}
              </span>
            </div>

            {/* Tab: Body */}
            {requestTab === "body" && (
              <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
                <textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  placeholder="{\n  // Enter JSON payload\n}"
                  spellCheck={false}
                  className="w-full flex-1 min-h-0 p-2 rounded-[4px] bg-[#101214] border border-border-subtle/80 font-mono text-[11px] leading-relaxed text-[#F1F0EC] resize-none focus:outline-none focus:border-accent-orange/60"
                />
                <div className="text-[10px] font-mono text-text-muted pt-1 flex items-center justify-between shrink-0">
                  <span>Editable JSON body</span>
                  {method === "GET" && <span className="text-accent-orange">Note: GET ignores body</span>}
                </div>
              </div>
            )}

            {/* Tab: Headers */}
            {requestTab === "headers" && (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
                {defaultHeaders.map((header) => (
                  <div
                    key={header.key}
                    className="p-1.5 rounded-[3px] bg-[#101214] border border-border-subtle/60 flex items-center justify-between text-[10.5px]"
                  >
                    <span className="text-text-muted">{header.key}</span>
                    <span className="text-[#F1F0EC] truncate max-w-[180px]">{header.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Params */}
            {requestTab === "params" && (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
                <div className="p-1.5 rounded-[3px] bg-[#101214] border border-border-subtle/60 flex items-center justify-between text-[10.5px]">
                  <span className="text-text-muted">env</span>
                  <span className="text-[#F1F0EC]">production</span>
                </div>
                <div className="p-1.5 rounded-[3px] bg-[#101214] border border-border-subtle/60 flex items-center justify-between text-[10.5px]">
                  <span className="text-text-muted">region</span>
                  <span className="text-[#F1F0EC]">cdg-1 (Paris)</span>
                </div>
                <div className="p-1.5 rounded-[3px] bg-[#101214] border border-border-subtle/60 flex items-center justify-between text-[10.5px]">
                  <span className="text-text-muted">routing</span>
                  <span className="text-semantic-success font-medium">anycast-mesh</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===============================================================
            RIGHT PANEL: RESPONSE VIEWER (7 cols)
            =============================================================== */}
        <div className="lg:col-span-7 h-full rounded-[6px] bg-[#141618] border border-border-subtle/80 p-3 flex flex-col justify-between overflow-hidden shadow-inner">
          {/* Response Meta Header */}
          <div className="shrink-0 flex items-center justify-between pb-2 border-b border-border-subtle/70">
            {/* Status Indicator */}
            <div className="flex items-center gap-2">
              {response?.status ? (
                <div
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] font-mono text-[11px] font-semibold ${
                    response.status >= 200 && response.status < 300
                      ? "bg-[#83B69A]/15 text-semantic-success border border-semantic-success/25"
                      : response.status >= 400
                      ? "bg-[#E09F3E]/15 text-[#E09F3E] border border-[#E09F3E]/25"
                      : "bg-[#E57373]/15 text-[#E57373] border border-[#E57373]/25"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span>
                    {response.status} {response.statusText}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#555C60]" />
                  <span>Ready</span>
                </div>
              )}

              {/* Latency & Payload Size */}
              {response && response.durationMs !== null && (
                <div className="flex items-center gap-2 font-mono text-[10.5px] text-text-muted">
                  <span>·</span>
                  <span className="text-[#F1F0EC]">{response.durationMs}ms</span>
                  <span>·</span>
                  <span>{response.sizeBytes ? `${response.sizeBytes} B` : "--"}</span>
                </div>
              )}
            </div>

            {/* View Switcher & Copy Button */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-[#101214] p-0.5 rounded-[4px] border border-border-subtle/60">
                {(["pretty", "raw", "headers"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setResponseTab(tab)}
                    className={`px-2 py-0.5 rounded-[3px] font-mono text-[10px] uppercase tracking-wider transition-colors cursor-pointer ${
                      responseTab === tab
                        ? "bg-[#25292D] text-[#F1F0EC] font-medium"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <button
                onClick={handleCopy}
                disabled={!response}
                title="Copy response body"
                className="p-1 rounded-[4px] hover:bg-[#202428] text-text-muted hover:text-[#F1F0EC] transition-colors cursor-pointer disabled:opacity-40"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-semantic-success" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Response Payload Viewer */}
          <div className="flex-1 min-h-0 my-2 rounded-[4px] bg-[#0E1012] border border-border-subtle/80 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed relative">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-text-muted">
                <RefreshCw className="w-4 h-4 animate-spin text-accent-orange" />
                <span className="text-[11px] font-mono">Executing request against meridian-api...</span>
              </div>
            ) : response ? (
              responseTab === "pretty" ? (
                <pre className="text-[#F1F0EC] whitespace-pre-wrap break-all">
                  <JsonPrettyRenderer data={response.data} />
                </pre>
              ) : responseTab === "raw" ? (
                <pre className="text-[#F1F0EC] whitespace-pre-wrap break-all">{response.rawText}</pre>
              ) : (
                <div className="space-y-1.5 divide-y divide-border-subtle/40">
                  {Object.entries(response.headers).map(([key, val]) => (
                    <div key={key} className="pt-1 flex items-start justify-between text-[10.5px]">
                      <span className="text-text-muted">{key}:</span>
                      <span className="text-accent-orange text-right pl-3 truncate max-w-[300px]">{val}</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="h-full flex items-center justify-center text-text-muted text-[11px]">
                Click &quot;Send&quot; to execute endpoint
              </div>
            )}
          </div>

          {/* Response Footer Bar */}
          <div className="shrink-0 flex items-center justify-between text-[10px] font-mono text-text-muted pt-1 border-t border-border-subtle/60">
            <div className="flex items-center gap-2">
              <span className="text-accent-orange">Backend:</span>
              <span>Next.js Route Handlers · In-Memory Mesh</span>
            </div>
            <div>WireGuard Private Mesh</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Syntax-highlighted JSON renderer
 */
function JsonPrettyRenderer({ data }: { data: unknown }) {
  if (data === null || data === undefined) {
    return <span className="text-[#777D7D]">null</span>;
  }

  const jsonString = JSON.stringify(data, null, 2);
  const lines = jsonString.split("\n");

  return (
    <code>
      {lines.map((line, idx) => {
        const keyMatch = line.match(/^(\s*)(".*?"):\s*(.*)$/);
        if (keyMatch) {
          const [, indent, key, rest] = keyMatch;
          return (
            <div key={idx}>
              <span>{indent}</span>
              <span className="text-[#A5ABB0] font-medium">{key}</span>
              <span className="text-border-default">: </span>
              <ValueHighlighter value={rest} />
            </div>
          );
        }
        return (
          <div key={idx}>
            <ValueHighlighter value={line} />
          </div>
        );
      })}
    </code>
  );
}

function ValueHighlighter({ value }: { value: string }) {
  // String value
  if (/^".*?"[,]?$/.test(value.trim())) {
    return <span className="text-semantic-success">{value}</span>;
  }
  // Number value
  if (/^-?\d+(\.\d+)?[,]?$/.test(value.trim())) {
    return <span className="text-accent-orange font-medium">{value}</span>;
  }
  // Boolean value
  if (/^(true|false)[,]?$/.test(value.trim())) {
    return <span className="text-[#E09F3E] font-medium">{value}</span>;
  }
  // Null value
  if (/^null[,]?$/.test(value.trim())) {
    return <span className="text-[#777D7D]">{value}</span>;
  }
  // Bracket / brace / comma
  return <span className="text-[#F1F0EC]">{value}</span>;
}

export default ApiServicePlayground;
