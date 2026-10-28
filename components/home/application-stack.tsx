"use client";

import React, { useState, useRef, useEffect } from "react";
import { ApiServicePlayground } from "./api-service-playground";

type ServiceId = "web" | "api" | "db" | "worker";

interface ServiceMetadata {
  id: ServiceId;
  index: string;
  name: string;
  description: string;
}

const SERVICES: Record<ServiceId, ServiceMetadata> = {
  web: {
    id: "web",
    index: "01",
    name: "Web frontend",
    description: "The experience your users see.",
  },
  api: {
    id: "api",
    index: "02",
    name: "API service",
    description: "Logic and application requests.",
  },
  db: {
    id: "db",
    index: "03",
    name: "Database",
    description: "Persistent application data.",
  },
  worker: {
    id: "worker",
    index: "04",
    name: "Background worker",
    description: "Tasks that run behind the scenes.",
  },
};

/**
 * ApplicationStack: Section 04 — The Platform
 * "One platform. Your entire stack."
 *
 * Unified Shared Architecture matching Section 02 (Deployment):
 * - Exactly equal outer card heights across all four service views:
 *   h-[475px] (mobile) / sm:h-[500px] (tablet) / lg:h-[530px] (desktop)
 * - Container reaches down directly to the line below it
 * - Web Frontend view removes the bottom footer and extends the site preview flush to the bottom edge of the container
 * - Both upper switcher and container can be viewed together on screen
 * - Zero layout jump or resizing when toggling between services
 * - Strict adherence to Jetway palette: #111111 bg, #1D1D1D surface, #F1F0EC text, #303030 borders, #D88762 accent, #83B69A success
 */
export function ApplicationStack() {
  const [selectedId, setSelectedId] = useState<ServiceId>("web");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Pause preview animation when out of viewport, resume when visible
  useEffect(() => {
    if (!previewContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const msg = entry.isIntersecting
            ? "JETWAY_PREVIEW_RESUME"
            : "JETWAY_PREVIEW_PAUSE";
          iframeRef.current?.contentWindow?.postMessage({ type: msg }, "*");
        });
      },
      { threshold: 0.15 }
    );

    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, [selectedId]);

  return (
    <section
      id="platform-stack"
      className="relative w-full pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-28 bg-bg-main text-text-primary overflow-hidden"
      aria-labelledby="stack-heading"
    >
      <div className="layout-container w-full">
        {/* =================================================================
            SECTION IDENTIFIER: 04 / THE PLATFORM
            ================================================================= */}
        <div className="w-full border-t border-border-subtle pt-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-2 font-mono text-[11px] text-text-muted tracking-[0.1em] uppercase">
            <span className="text-accent-orange font-medium">04</span>
            <span>/</span>
            <span>THE PLATFORM</span>
          </div>
        </div>

        {/* =================================================================
            EDITORIAL INTRODUCTION
            ================================================================= */}
        <div className="max-w-3xl mb-6 sm:mb-8">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <span
              className="w-1.5 h-1.5 rounded-[1px] bg-accent-orange"
              aria-hidden="true"
            />
            <span className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-muted">
              EVERYTHING WORKS TOGETHER
            </span>
          </div>

          <h2
            id="stack-heading"
            className="font-sans text-[36px] sm:text-[44px] lg:text-[50px] font-medium leading-[1.08] tracking-[-0.03em] text-[#F1F0EC] mb-3 sm:mb-4"
          >
            One platform. Your entire stack.
          </h2>

          <p className="font-sans text-[15px] sm:text-[16px] text-text-secondary leading-[1.6] max-w-[600px]">
            From the interface your users see to the services working behind the
            scenes, bring your application components together in one
            developer-focused workflow.
          </p>
        </div>

        {/* =================================================================
            SERVICE NAVIGATION: Minimal 4-Column Service Index
            Compact switcher positioned directly above the service container
            ================================================================= */}
        <div className="w-full border-b border-border-subtle mb-3 sm:mb-4">
          <div
            role="tablist"
            aria-label="Application Services"
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 pb-px"
          >
            {(Object.keys(SERVICES) as ServiceId[]).map((id) => {
              const service = SERVICES[id];
              const isSelected = selectedId === id;

              return (
                <button
                  key={id}
                  role="tab"
                  id={`tab-${id}`}
                  aria-selected={isSelected}
                  aria-controls={`panel-${id}`}
                  onClick={() => setSelectedId(id)}
                  className="group pb-2.5 sm:pb-3 pt-1 text-left transition-all relative flex flex-col justify-start focus:outline-none cursor-pointer"
                >
                  {/* Service Number & Service Name */}
                  <div className="flex items-baseline gap-2 mb-1 font-sans">
                    <span
                      className={`font-mono text-[11px] font-medium transition-colors ${
                        isSelected
                          ? "text-accent-orange"
                          : "text-text-muted group-hover:text-text-secondary"
                      }`}
                    >
                      {service.index}
                    </span>
                    <span className="text-border-default text-[11px]">—</span>
                    <span
                      className={`text-[15px] sm:text-[16px] font-medium tracking-tight transition-colors ${
                        isSelected
                          ? "text-[#F1F0EC]"
                          : "text-text-secondary group-hover:text-[#F1F0EC]"
                      }`}
                    >
                      {service.name}
                    </span>
                  </div>

                  {/* One Short Description */}
                  <div className="font-sans text-[12px] sm:text-[12.5px] text-text-muted leading-snug">
                    {service.description}
                  </div>

                  {/* Thin Burnt-Orange Active Line */}
                  {isSelected ? (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-orange transition-all"
                      aria-hidden="true"
                    />
                  ) : (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-[1px] bg-transparent group-hover:bg-border-default transition-colors"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* =================================================================
            MAIN SERVICE STAGE: Equal Height Across All Four Services
            Unified height (475px mobile / 500px tablet / 530px desktop)
            Takes the container down to the line below it
            Web Frontend removes the bottom of the container so the site goes flush to the bottom edge
            ================================================================= */}
        <div
          id={`panel-${selectedId}`}
          role="tabpanel"
          aria-labelledby={`tab-${selectedId}`}
          className="w-full rounded-[10px] bg-surface-card border border-border-default shadow-2xl pt-4 sm:pt-5 lg:pt-5 px-4 sm:px-5 lg:px-6 pb-0 mb-4 sm:mb-5 h-[475px] sm:h-[500px] lg:h-[530px] flex flex-col justify-between overflow-hidden"
        >
          {/* =============================================================
              VIEW 1: WEB FRONTEND — Real Website Preview
              Actual scrollable demo website extending to the very bottom edge of the container
              ============================================================= */}
          {selectedId === "web" && (
            <div className="w-full h-full flex flex-col justify-between animate-in fade-in duration-200">
              {/* Standardized Header */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2.5 sm:pb-3 border-b border-border-subtle/70 shrink-0">
                <div className="space-y-0.5 max-w-xl">
                  <div className="flex items-center gap-2 font-mono text-[10.5px] text-text-muted tracking-[0.14em] uppercase">
                    <span className="text-accent-orange font-medium">01</span>
                    <span>/</span>
                    <span>WEB FRONTEND</span>
                  </div>
                  <h3 className="font-sans text-[20px] sm:text-[22px] font-medium text-[#F1F0EC] tracking-tight leading-tight">
                    Your website, live.
                  </h3>
                  <p className="font-sans text-[12.5px] sm:text-[13px] text-text-secondary leading-relaxed line-clamp-1">
                    From your first deploy to every release.
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px] self-start sm:self-auto shrink-0 pb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                  <span className="text-[#F1F0EC] font-medium tracking-tight">meridian.jetway.app</span>
                  <span className="text-semantic-success font-medium">Live</span>
                </div>
              </div>

              {/* Viewport Middle Area: Extended all the way to the bottom edge of the container */}
              <div
                ref={previewContainerRef}
                onMouseEnter={() => {
                  iframeRef.current?.contentWindow?.postMessage({ type: "JETWAY_PREVIEW_PAUSE" }, "*");
                }}
                onMouseLeave={() => {
                  iframeRef.current?.contentWindow?.postMessage({ type: "JETWAY_PREVIEW_RESUME" }, "*");
                }}
                className="flex-1 w-full min-h-0 mt-2.5 sm:mt-3 rounded-t-[8px] bg-[#141618] border-t border-x border-border-default/80 overflow-hidden shadow-2xl flex flex-col"
              >
                {/* Minimal Browser Frame Header */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-[#141618] border-b border-border-subtle/80 text-[10.5px] font-mono select-none shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#2A2E33]" />
                    <span className="w-2 h-2 rounded-full bg-[#2A2E33]" />
                    <span className="w-2 h-2 rounded-full bg-[#2A2E33]" />
                  </div>

                  <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-[4px] bg-[#1A1D20] border border-border-subtle/80 text-[10.5px] text-text-secondary max-w-sm w-full justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-semantic-success shrink-0" />
                    <span className="text-text-muted">https://</span>
                    <span className="text-[#F1F0EC] font-medium">meridian.jetway.app</span>
                  </div>

                  <div className="text-[10px] text-text-muted shrink-0 hidden sm:block">
                    Anycast Edge
                  </div>
                </div>

                {/* Real Scrollable Website Iframe Viewport */}
                <div className="flex-1 w-full min-h-0 bg-[#F7F5F0] overflow-hidden relative">
                  <iframe
                    ref={iframeRef}
                    src="/preview/meridian"
                    title="Meridian Architecture Studio — Live Frontend Preview on Jetway"
                    className="w-full h-full border-0 select-text"
                  />
                </div>
              </div>
            </div>
          )}

          {/* =============================================================
              VIEW 2: API SERVICE — Real Backend Demonstration
              Interactive API playground with live Route Handlers
              ============================================================= */}
          {selectedId === "api" && (
            <div className="w-full h-full flex flex-col justify-between animate-in fade-in duration-200 pb-4 sm:pb-5 lg:pb-5">
              {/* Standardized Header */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2.5 sm:pb-3 border-b border-border-subtle/70 shrink-0">
                <div className="space-y-0.5 max-w-xl">
                  <div className="flex items-center gap-2 font-mono text-[10.5px] text-text-muted tracking-[0.14em] uppercase">
                    <span className="text-accent-orange font-medium">02</span>
                    <span>/</span>
                    <span>API SERVICE</span>
                  </div>
                  <h3 className="font-sans text-[20px] sm:text-[22px] font-medium text-[#F1F0EC] tracking-tight leading-tight">
                    Every request, handled.
                  </h3>
                  <p className="font-sans text-[12.5px] sm:text-[13px] text-text-secondary leading-relaxed line-clamp-1">
                    From endpoint to response.
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px] self-start sm:self-auto shrink-0 pb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                  <span className="text-text-secondary">API online</span>
                </div>
              </div>

              {/* Functional API Playground */}
              <div className="flex-1 min-h-0 mt-3 overflow-hidden">
                <ApiServicePlayground />
              </div>
            </div>
          )}

          {/* =============================================================
              VIEW 3: DATABASE — Improve Query and Record Composition
              Clear PostgreSQL heading, multi-line query, clean field-value ledger
              ============================================================= */}
          {selectedId === "db" && (
            <div className="w-full h-full flex flex-col justify-between animate-in fade-in duration-200 pb-4 sm:pb-5 lg:pb-5">
              {/* Standardized Header */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2.5 sm:pb-3 border-b border-border-subtle/70 shrink-0">
                <div className="space-y-0.5 max-w-xl">
                  <div className="flex items-center gap-2 font-mono text-[10.5px] text-text-muted tracking-[0.14em] uppercase">
                    <span className="text-accent-orange font-medium">03</span>
                    <span>/</span>
                    <span>DATABASE</span>
                  </div>
                  <h3 className="font-sans text-[20px] sm:text-[22px] font-medium text-[#F1F0EC] tracking-tight leading-tight">
                    Persistent application data.
                  </h3>
                  <p className="font-sans text-[12.5px] sm:text-[13px] text-text-secondary leading-relaxed line-clamp-1">
                    Fully managed PostgreSQL with automated point-in-time recovery and connection pooling.
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px] self-start sm:self-auto shrink-0 pb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                  <span className="text-[#F1F0EC] font-medium tracking-tight">PostgreSQL 16.2</span>
                  <span className="text-border-default text-[10px]">·</span>
                  <span className="text-semantic-success font-medium text-[10.5px]">Pool active</span>
                  <span className="text-border-default text-[10px]">·</span>
                  <span className="text-text-muted text-[10.5px]">0.6ms latency</span>
                </div>
              </div>

              {/* Middle Area: SQL Query + Ledger */}
              <div className="flex-1 min-h-0 my-3 flex flex-col justify-between py-1 overflow-hidden">
                {/* Natural Multi-Line SQL Query with Pre */}
                <pre className="py-2.5 px-3.5 rounded-[4px] bg-[#161616] border border-border-subtle font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre shrink-0">
                  <span className="text-accent-orange font-medium">SELECT</span>{" "}
                  <span className="text-[#F1F0EC]">id, slug, version, status, deployed_at</span>{"\n"}
                  <span className="text-accent-orange font-medium">FROM</span>{" "}
                  <span className="text-[#F1F0EC]">releases</span>{"\n"}
                  <span className="text-accent-orange font-medium">WHERE</span>{" "}
                  <span className="text-[#F1F0EC]">slug</span> = <span className="text-semantic-success">&apos;v2.4-production&apos;</span>{"\n"}
                  <span className="text-accent-orange font-medium">ORDER BY</span>{" "}
                  <span className="text-[#F1F0EC]">deployed_at</span> <span className="text-accent-orange font-medium">DESC</span>{" "}
                  <span className="text-accent-orange font-medium">LIMIT</span>{" "}
                  <span className="text-accent-orange font-medium">1</span>;
                </pre>

                {/* Returned Record: Clean Field-Value Ledger */}
                <div className="divide-y divide-border-subtle/80 font-mono text-[11px] sm:text-[11.5px] pt-1 shrink-0">
                  <div className="py-1.5 grid grid-cols-12 items-baseline">
                    <span className="col-span-4 sm:col-span-3 text-text-muted">id</span>
                    <span className="col-span-8 sm:col-span-9 text-[#F1F0EC]">rel_01hn8y7p412a9</span>
                  </div>

                  <div className="py-1.5 grid grid-cols-12 items-baseline">
                    <span className="col-span-4 sm:col-span-3 text-text-muted">version</span>
                    <span className="col-span-8 sm:col-span-9 text-[#F1F0EC]">2.4.0</span>
                  </div>

                  <div className="py-1.5 grid grid-cols-12 items-baseline">
                    <span className="col-span-4 sm:col-span-3 text-text-muted">status</span>
                    <span className="col-span-8 sm:col-span-9 text-semantic-success flex items-center gap-1.5 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                      published
                    </span>
                  </div>

                  <div className="py-1.5 grid grid-cols-12 items-baseline">
                    <span className="col-span-4 sm:col-span-3 text-text-muted">author</span>
                    <span className="col-span-8 sm:col-span-9 text-text-secondary truncate">
                      Elena Rostova &lt;elena@meridian.io&gt;
                    </span>
                  </div>

                  <div className="py-1.5 grid grid-cols-12 items-baseline">
                    <span className="col-span-4 sm:col-span-3 text-text-muted">commit_hash</span>
                    <span className="col-span-8 sm:col-span-9 text-[#F1F0EC]">8f3a21c</span>
                  </div>

                  <div className="py-1.5 grid grid-cols-12 items-baseline">
                    <span className="col-span-4 sm:col-span-3 text-text-muted">deployed_at</span>
                    <span className="col-span-8 sm:col-span-9 text-text-secondary">
                      2026-10-28 22:30:14 UTC
                    </span>
                  </div>
                </div>
              </div>

              {/* Standardized Footer */}
              <div className="pt-2.5 border-t border-border-subtle flex items-center justify-between text-[10.5px] font-mono text-text-muted shrink-0">
                <div>Encrypted NVMe storage · Port 5432 pooled</div>
                <div className="text-text-secondary">Automated hourly volume snapshots</div>
              </div>
            </div>
          )}

          {/* =============================================================
              VIEW 4: BACKGROUND WORKER — Elegant Job Lifecycle
              Three aligned groups (Completed, Processing focal point, Queued) with thin dividers
              ============================================================= */}
          {selectedId === "worker" && (
            <div className="w-full h-full flex flex-col justify-between animate-in fade-in duration-200 pb-4 sm:pb-5 lg:pb-5">
              {/* Standardized Header */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2.5 sm:pb-3 border-b border-border-subtle/70 shrink-0">
                <div className="space-y-0.5 max-w-xl">
                  <div className="flex items-center gap-2 font-mono text-[10.5px] text-text-muted tracking-[0.14em] uppercase">
                    <span className="text-accent-orange font-medium">04</span>
                    <span>/</span>
                    <span>BACKGROUND WORKER</span>
                  </div>
                  <h3 className="font-sans text-[20px] sm:text-[22px] font-medium text-[#F1F0EC] tracking-tight leading-tight">
                    Tasks behind the scenes.
                  </h3>
                  <p className="font-sans text-[12.5px] sm:text-[13px] text-text-secondary leading-relaxed line-clamp-1">
                    Decoupled asynchronous worker pool for asset processing, webhooks, and queues.
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px] self-start sm:self-auto shrink-0 pb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                  <span className="text-semantic-success font-medium">Queue active</span>
                  <span className="text-border-default text-[10px]">·</span>
                  <span className="text-[#F1F0EC] font-medium">0 backlog</span>
                  <span className="text-border-default text-[10px]">·</span>
                  <span className="text-text-muted text-[10.5px]">Healthy</span>
                </div>
              </div>

              {/* Middle Area: 3 Aligned Lifecycle Columns */}
              <div className="flex-1 min-h-0 my-3 flex flex-col justify-center py-2 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-7 items-start">
                  {/* Completed Jobs */}
                  <div className="space-y-2.5">
                    <div className="font-mono text-[10.5px] text-text-muted uppercase tracking-wider pb-1.5 border-b border-border-subtle">
                      Completed
                    </div>

                    <div className="space-y-2.5 font-mono text-[11.5px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#F1F0EC]">compile_wasm_bundle</span>
                        <span className="text-semantic-success text-[10.5px]">● 340ms</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[#F1F0EC]">generate_release_manifest</span>
                        <span className="text-semantic-success text-[10.5px]">● 115ms</span>
                      </div>
                    </div>
                  </div>

                  {/* Processing Job (Focal Point!) */}
                  <div className="space-y-2.5 lg:border-l lg:border-border-subtle lg:pl-6">
                    <div className="font-mono text-[10.5px] text-accent-orange uppercase tracking-wider pb-1.5 border-b border-border-subtle flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
                      Processing
                    </div>

                    <div className="space-y-1.5 font-mono text-[11.5px]">
                      <div>
                        <div className="text-[#F1F0EC] font-semibold text-[13px]">
                          optimize_edge_assets
                        </div>
                        <div className="font-sans text-[11.5px] text-text-secondary leading-snug mt-0.5">
                          Compressing Brotli release tarballs for edge distribution.
                        </div>
                      </div>

                      {/* Slim Restrained Progress Line */}
                      <div className="space-y-1 pt-0.5">
                        <div className="h-1 w-full bg-[#252525] rounded-full overflow-hidden">
                          <div className="h-full bg-accent-orange w-3/5 rounded-full" />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-text-muted">
                          <span className="text-accent-orange">Worker #03</span>
                          <span>84ms elapsed</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Queued Jobs */}
                  <div className="space-y-2.5 lg:border-l lg:border-border-subtle lg:pl-6">
                    <div className="font-mono text-[10.5px] text-text-muted uppercase tracking-wider pb-1.5 border-b border-border-subtle">
                      Queued
                    </div>

                    <div className="space-y-2.5 font-mono text-[11.5px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#F1F0EC]">broadcast_webhook_dispatch</span>
                        <span className="text-text-muted text-[10.5px]">○ High</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[#F1F0EC]">purge_stale_cache_keys</span>
                        <span className="text-text-muted text-[10.5px]">○ Scheduled</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Standardized Footer */}
              <div className="pt-2.5 border-t border-border-subtle flex items-center justify-between text-[10.5px] font-mono text-text-muted shrink-0">
                <div>Decoupled asynchronous worker pool with automatic retry backoff</div>
                <div className="text-text-secondary">Message broker: Redis memory bus</div>
              </div>
            </div>
          )}
        </div>

        {/* =================================================================
            THREE BENEFIT DESCRIPTIONS
            Understated editorial columns directly below the experience
            ================================================================= */}
        <div className="w-full border-t border-border-subtle pt-6 sm:pt-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-10 w-full max-w-6xl">
            {/* Column 01 */}
            <div className="space-y-2">
              <div className="font-mono text-[11px] text-accent-orange font-medium tracking-wider">
                01
              </div>
              <h3 className="font-sans text-[16px] sm:text-[17px] font-medium text-[#F1F0EC] tracking-[-0.015em]">
                Connected services
              </h3>
              <p className="font-sans text-[13.5px] text-text-secondary leading-[1.6]">
                Keep the relationships between application components understandable through a shared internal network.
              </p>
            </div>

            {/* Column 02 */}
            <div className="space-y-2">
              <div className="font-mono text-[11px] text-accent-orange font-medium tracking-wider">
                02
              </div>
              <h3 className="font-sans text-[16px] sm:text-[17px] font-medium text-[#F1F0EC] tracking-[-0.015em]">
                One developer workflow
              </h3>
              <p className="font-sans text-[13.5px] text-text-secondary leading-[1.6]">
                Reduce the need to think about every component as an entirely separate project. Manage routing, environment, and code from one place.
              </p>
            </div>

            {/* Column 03 */}
            <div className="space-y-2">
              <div className="font-mono text-[11px] text-accent-orange font-medium tracking-wider">
                03
              </div>
              <h3 className="font-sans text-[16px] sm:text-[17px] font-medium text-[#F1F0EC] tracking-[-0.015em]">
                Room to grow
              </h3>
              <p className="font-sans text-[13.5px] text-text-secondary leading-[1.6]">
                Start with a single frontend service, then attach background workers, queues, and databases as your application evolves.
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

export default ApplicationStack;
