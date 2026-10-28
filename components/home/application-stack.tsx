"use client";

import React, { useState } from "react";
import { Check, ArrowUpRight } from "lucide-react";

type ServiceId = "web" | "api" | "db" | "worker";

interface ServiceMetadata {
  id: ServiceId;
  index: string;
  name: string;
  tag: string;
  description: string;
}

const SERVICES: Record<ServiceId, ServiceMetadata> = {
  web: {
    id: "web",
    index: "01",
    name: "Web frontend",
    tag: "web-frontend",
    description: "The experience your users see.",
  },
  api: {
    id: "api",
    index: "02",
    name: "API service",
    tag: "core-api",
    description: "Logic and application requests.",
  },
  db: {
    id: "db",
    index: "03",
    name: "Database",
    tag: "primary-db",
    description: "Persistent application data.",
  },
  worker: {
    id: "worker",
    index: "04",
    name: "Background worker",
    tag: "queue-worker",
    description: "Tasks that run behind the scenes.",
  },
};

/**
 * ApplicationStack: Section 04 — The Platform
 * "One platform. Your entire stack."
 *
 * Refactored to match the warm, editorial visual identity of the Deployment section:
 * - Warm near-black backgrounds (#111111) and restrained charcoal surfaces (#1D1D1D)
 * - Minimal horizontal 4-column service index with consistent baselines and burnt-orange active line
 * - Four distinctly composed service views sharing the single fictional "Meridian" product story:
 *     01 Web Frontend: Clean application release stage inside an understated browser frame
 *     02 API Service: Single connected request lifecycle sequence (Auth -> Persistence -> Async Dispatch)
 *     03 Database: Focused PostgreSQL query and clean key-value entity ledger
 *     04 Background Worker: Three-stage horizontal lifecycle (Completed -> Processing -> Queued)
 * - Typography carries the visual hierarchy without card-soup or dashboard widget bloat
 * - Three understated editorial benefit columns below
 */
export function ApplicationStack() {
  const [selectedId, setSelectedId] = useState<ServiceId>("web");

  return (
    <section
      id="platform-stack"
      className="relative w-full pt-16 pb-24 sm:pt-20 sm:pb-28 lg:pt-24 lg:pb-36 bg-bg-main text-text-primary overflow-hidden"
      aria-labelledby="stack-heading"
    >
      <div className="layout-container w-full">
        {/* =================================================================
            SECTION IDENTIFIER: 04 / THE PLATFORM
            Understated minimal divider line matching Section 02
            ================================================================= */}
        <div className="w-full border-t border-border-subtle pt-5 mb-8 sm:mb-10">
          <div className="flex items-center gap-2 font-mono text-[11px] text-text-muted tracking-[0.1em] uppercase">
            <span className="text-accent-orange font-medium">04</span>
            <span>/</span>
            <span>THE PLATFORM</span>
          </div>
        </div>

        {/* =================================================================
            EDITORIAL INTRODUCTION
            ================================================================= */}
        <div className="max-w-3xl mb-10 sm:mb-14">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
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
            className="font-sans text-[38px] sm:text-[46px] lg:text-[54px] font-medium leading-[1.08] tracking-[-0.03em] text-[#F1F0EC] mb-4 sm:mb-5"
          >
            One platform. Your entire stack.
          </h2>

          <p className="font-sans text-[16px] sm:text-[17px] text-text-secondary leading-[1.65] max-w-[600px]">
            From the interface your users see to the services working behind the
            scenes, bring your application components together in one
            developer-focused workflow.
          </p>
        </div>

        {/* =================================================================
            FOUR-SERVICE NAVIGATION: Minimal Horizontal Service Index
            Equal-width columns, consistent baseline alignment, burnt-orange active line
            ================================================================= */}
        <div className="w-full border-b border-border-subtle mb-10 sm:mb-12">
          <div
            role="tablist"
            aria-label="Application Services"
            className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 pb-px"
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
                  className="group pb-5 text-left transition-all relative flex flex-col justify-start focus:outline-none cursor-pointer"
                >
                  {/* Index & Identifier */}
                  <div className="flex items-center gap-2 mb-2 font-mono text-[11px]">
                    <span
                      className={`font-medium transition-colors ${
                        isSelected
                          ? "text-accent-orange"
                          : "text-text-muted group-hover:text-text-secondary"
                      }`}
                    >
                      {service.index}
                    </span>
                    <span className="text-border-default">—</span>
                    <span className="text-text-muted">{service.tag}</span>
                  </div>

                  {/* Service Name */}
                  <div
                    className={`font-sans text-[17px] sm:text-[18px] font-medium tracking-tight mb-1.5 transition-colors ${
                      isSelected
                        ? "text-[#F1F0EC]"
                        : "text-text-secondary group-hover:text-[#F1F0EC]"
                    }`}
                  >
                    {service.name}
                  </div>

                  {/* Description */}
                  <div className="font-sans text-[13px] text-text-muted leading-relaxed">
                    {service.description}
                  </div>

                  {/* Active Underline Indicator */}
                  {isSelected ? (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-orange"
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
            MAIN SERVICE STAGE: Distinct, Restrained Compositions
            Understated primary charcoal surface matching Deployment section
            ================================================================= */}
        <div
          id={`panel-${selectedId}`}
          role="tabpanel"
          aria-labelledby={`tab-${selectedId}`}
          className="w-full rounded-[10px] bg-surface-card border border-border-default shadow-2xl p-6 sm:p-8 lg:p-10 mb-16 sm:mb-20 min-h-[460px] flex flex-col justify-between"
        >
          {/* =============================================================
              VIEW 1: WEB FRONTEND — The Live Application
              Clean, immersive product UI inside an understated browser frame
              ============================================================= */}
          {selectedId === "web" && (
            <div className="w-full space-y-8 animate-in fade-in duration-200">
              {/* Minimal Understated Browser Header */}
              <div className="flex items-center justify-between pb-6 border-b border-border-subtle text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#353A40]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#353A40]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#353A40]" />
                </div>

                <div className="flex items-center gap-2 px-3 py-1 rounded-[4px] bg-[#171717] border border-border-subtle text-[12px] text-text-secondary truncate max-w-sm sm:max-w-md w-full mx-4 justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-semantic-success shrink-0" />
                  <span className="text-text-muted">https://</span>
                  <span className="text-[#F1F0EC] font-medium">meridian.jetway.app</span>
                  <span className="text-text-muted">/releases/v2.4</span>
                </div>

                <div className="flex items-center gap-1.5 text-semantic-success text-[11px] shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                  <span className="hidden sm:inline">Deployed to Anycast Edge</span>
                </div>
              </div>

              {/* Application Content */}
              <div className="w-full space-y-8">
                {/* Product Header */}
                <div className="flex items-center justify-between pb-6 border-b border-border-subtle">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-[4px] bg-accent-orange flex items-center justify-center text-[#111111] font-mono font-bold text-xs select-none">
                      M
                    </div>
                    <span className="font-sans font-medium text-[17px] text-[#F1F0EC] tracking-tight">
                      Meridian
                    </span>
                    <span className="font-mono text-[11px] text-text-muted">
                      /
                    </span>
                    <span className="font-mono text-[12px] text-text-secondary">
                      v2.4.0-rc1
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono text-text-muted">
                    <span>Author: Elena Rostova</span>
                    <span className="hidden sm:inline text-border-default">•</span>
                    <span className="hidden sm:inline">Commit: 8f3a21c</span>
                  </div>
                </div>

                {/* Main Release Focal Point & Verification Items */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Left: Release Title & Milestone Verification */}
                  <div className="lg:col-span-8 space-y-4">
                    <div>
                      <div className="font-mono text-[11px] text-accent-orange uppercase tracking-wider mb-2 font-medium">
                        PRODUCTION CANDIDATE
                      </div>
                      <h3 className="font-sans text-[28px] sm:text-[34px] font-medium text-[#F1F0EC] tracking-tight leading-tight">
                        Release v2.4.0
                      </h3>
                      <p className="font-sans text-[15px] text-text-secondary leading-relaxed mt-2 max-w-xl">
                        Automated build verified across isolated test environments. All dependency closures resolved and edge cache warmed.
                      </p>
                    </div>

                    {/* Verification Items with Fine Separators */}
                    <div className="space-y-3 pt-4 border-t border-border-subtle">
                      <div className="flex items-center gap-3 text-[13.5px] text-[#F1F0EC]">
                        <Check className="w-4 h-4 text-semantic-success shrink-0" />
                        <span>Universal search indexing engine compiled</span>
                      </div>
                      <div className="flex items-center gap-3 text-[13.5px] text-[#F1F0EC]">
                        <Check className="w-4 h-4 text-semantic-success shrink-0" />
                        <span>Realtime collaboration websocket cluster attached</span>
                      </div>
                      <div className="flex items-center gap-3 text-[13.5px] text-[#F1F0EC]">
                        <Check className="w-4 h-4 text-semantic-success shrink-0" />
                        <span>Database migration 0042_release_manifest verified</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: One Meaningful Primary Action */}
                  <div className="lg:col-span-4 pt-2 lg:pt-4 lg:border-l lg:border-border-subtle lg:pl-8 space-y-5">
                    <div className="space-y-1 font-mono text-[12px]">
                      <div className="text-text-muted">Target Environment</div>
                      <div className="text-[#F1F0EC] font-medium">production-anycast</div>
                    </div>

                    <div className="space-y-1 font-mono text-[12px]">
                      <div className="text-text-muted">SHA-256 Digest</div>
                      <div className="text-text-secondary text-[11px] truncate">
                        7f10b8a4e912c0a4b3d8...
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        className="w-full py-2.5 px-4 rounded-[6px] bg-accent-orange hover:bg-accent-orange-hover text-[#111111] font-sans font-medium text-[13.5px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <span>Deploy to Production</span>
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Single Clean Footer Telemetry */}
              <div className="pt-6 border-t border-border-subtle flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono text-text-muted">
                <div>Render Engine: Next.js SSR · Cold start: 0ms</div>
                <div className="text-text-secondary">12ms edge response time</div>
              </div>
            </div>
          )}

          {/* =============================================================
              VIEW 2: API SERVICE — The Request in Motion
              Single connected request trace moving through 3 lifecycle stages
              ============================================================= */}
          {selectedId === "api" && (
            <div className="w-full space-y-8 animate-in fade-in duration-200">
              {/* Request Header */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-6 border-b border-border-subtle">
                <div className="space-y-1">
                  <div className="font-mono text-[11px] text-accent-orange uppercase tracking-wider font-medium">
                    INCOMING REQUEST TRACE
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-accent-orange font-semibold text-[15px]">
                      POST
                    </span>
                    <h3 className="font-sans text-[24px] sm:text-[30px] font-medium text-[#F1F0EC] tracking-tight">
                      /api/v2/releases/publish
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-4 font-mono text-[12px] self-start sm:self-auto">
                  <div className="flex items-center gap-1.5 text-semantic-success font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                    <span>200 OK</span>
                  </div>
                  <span className="text-border-default">•</span>
                  <div className="text-text-secondary">
                    18.4ms total latency
                  </div>
                </div>
              </div>

              {/* Connected Request Lifecycle Sequence */}
              <div className="space-y-4">
                <div className="font-mono text-[10.5px] uppercase tracking-wider text-text-muted">
                  REQUEST LIFECYCLE STAGES
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  {/* Stage 01 */}
                  <div className="space-y-2 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                      <span className="font-mono text-[11px] text-semantic-success font-medium tracking-wider">
                        01 — AUTH & ROUTING
                      </span>
                    </div>
                    <div className="font-sans text-[16px] font-medium text-[#F1F0EC]">
                      JWT verification
                    </div>
                    <p className="font-sans text-[13px] text-text-secondary leading-relaxed">
                      Token validated and request authorized for user{" "}
                      <span className="font-mono text-[#F1F0EC]">elena_91a</span>.
                    </p>
                    <div className="font-mono text-[11px] text-text-muted pt-1">
                      1.2ms latency
                    </div>
                  </div>

                  {/* Stage 02 */}
                  <div className="space-y-2 pr-4 md:border-l md:border-border-subtle md:pl-6">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                      <span className="font-mono text-[11px] text-semantic-success font-medium tracking-wider">
                        02 — PERSISTENCE
                      </span>
                    </div>
                    <div className="font-sans text-[16px] font-medium text-[#F1F0EC]">
                      Database transaction
                    </div>
                    <p className="font-sans text-[13px] text-text-secondary leading-relaxed">
                      Release record updated to{" "}
                      <span className="font-mono text-semantic-success">published</span> in{" "}
                      <span className="font-mono text-[#F1F0EC]">primary-db</span>.
                    </p>
                    <div className="font-mono text-[11px] text-text-muted pt-1">
                      2.8ms execution
                    </div>
                  </div>

                  {/* Stage 03 */}
                  <div className="space-y-2 md:border-l md:border-border-subtle md:pl-6">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
                      <span className="font-mono text-[11px] text-accent-orange font-medium tracking-wider">
                        03 — ASYNC DISPATCH
                      </span>
                    </div>
                    <div className="font-sans text-[16px] font-medium text-[#F1F0EC]">
                      Queue acknowledgement
                    </div>
                    <p className="font-sans text-[13px] text-text-secondary leading-relaxed">
                      Task dispatched to{" "}
                      <span className="font-mono text-[#F1F0EC]">queue-worker</span> for edge bundle generation.
                    </p>
                    <div className="font-mono text-[11px] text-text-muted pt-1">
                      0.8ms broker ACK
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Requests: Clean aligned rows with subtle separators */}
              <div className="pt-6 border-t border-border-subtle space-y-3">
                <div className="font-mono text-[10.5px] uppercase tracking-wider text-text-muted">
                  RECENT SERVICE REQUESTS
                </div>

                <div className="divide-y divide-border-subtle/80 font-mono text-[12px]">
                  <div className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-text-muted w-12 font-medium">GET</span>
                      <span className="text-[#F1F0EC]">/api/v2/releases/v2.4-rc1</span>
                    </div>
                    <div className="flex items-center gap-4 text-text-muted">
                      <span className="text-semantic-success">200 OK</span>
                      <span>4.2ms</span>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-accent-orange w-12 font-medium">POST</span>
                      <span className="text-[#F1F0EC]">/api/v2/releases/publish</span>
                    </div>
                    <div className="flex items-center gap-4 text-text-muted">
                      <span className="text-semantic-success">200 OK</span>
                      <span>18.4ms</span>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-text-muted w-12 font-medium">GET</span>
                      <span className="text-[#F1F0EC]">/api/v2/projects/meridian</span>
                    </div>
                    <div className="flex items-center gap-4 text-text-muted">
                      <span className="text-semantic-success">200 OK</span>
                      <span>8.1ms</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-6 border-t border-border-subtle flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono text-text-muted">
                <div>Zero public ports exposed · Internal WireGuard private mesh</div>
                <div className="text-text-secondary">Mutual TLS 1.3 enforced</div>
              </div>
            </div>
          )}

          {/* =============================================================
              VIEW 3: DATABASE — Make Data Readable
              Focused PostgreSQL query & structured record key-value ledger
              ============================================================= */}
          {selectedId === "db" && (
            <div className="w-full space-y-8 animate-in fade-in duration-200">
              {/* Heading & Secondary Connection Info */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-6 border-b border-border-subtle">
                <div className="space-y-1">
                  <div className="font-mono text-[11px] text-accent-orange uppercase tracking-wider font-medium">
                    PERSISTENT DATA LAYER
                  </div>
                  <h3 className="font-sans text-[28px] sm:text-[34px] font-medium text-[#F1F0EC] tracking-tight">
                    PostgreSQL 16.2
                  </h3>
                </div>

                <div className="flex items-center gap-2 font-mono text-[12px] text-text-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                  <span>Pool active · 0.6ms execution</span>
                </div>
              </div>

              {/* SQL Query (No heavy editor container, restrained syntax colors) */}
              <div className="space-y-2">
                <div className="font-mono text-[10.5px] uppercase tracking-wider text-text-muted">
                  EXECUTED QUERY
                </div>
                <div className="py-3 px-4 rounded-[6px] bg-[#171717] border border-border-subtle font-mono text-[12.5px] overflow-x-auto leading-relaxed">
                  <span className="text-accent-orange font-medium">SELECT</span>{" "}
                  <span className="text-[#F1F0EC]">id, slug, version, status, author_id, commit_hash, deployed_at</span>{"\n"}
                  <span className="text-accent-orange font-medium">FROM</span>{" "}
                  <span className="text-[#F1F0EC]">releases</span>{"\n"}
                  <span className="text-accent-orange font-medium">WHERE</span>{" "}
                  <span className="text-[#F1F0EC]">slug</span> = <span className="text-semantic-success">&apos;v2.4-production&apos;</span>{"\n"}
                  <span className="text-accent-orange font-medium">ORDER BY</span>{" "}
                  <span className="text-[#F1F0EC]">deployed_at</span> <span className="text-accent-orange font-medium">DESC</span>{"\n"}
                  <span className="text-accent-orange font-medium">LIMIT</span>{" "}
                  <span className="text-accent-orange font-medium">1</span>;
                </div>
              </div>

              {/* Returned Record: Clean Field-Value Layout with Subtle Horizontal Dividers */}
              <div className="space-y-2">
                <div className="font-mono text-[10.5px] uppercase tracking-wider text-text-muted">
                  RETURNED RECORD // RELEASES
                </div>

                <div className="divide-y divide-border-subtle font-mono text-[12px]">
                  <div className="py-2.5 grid grid-cols-12 items-baseline">
                    <span className="col-span-4 sm:col-span-3 text-text-muted">id</span>
                    <span className="col-span-8 sm:col-span-9 text-[#F1F0EC]">rel_01hn8y7p412a9</span>
                  </div>

                  <div className="py-2.5 grid grid-cols-12 items-baseline">
                    <span className="col-span-4 sm:col-span-3 text-text-muted">version</span>
                    <span className="col-span-8 sm:col-span-9 text-[#F1F0EC]">2.4.0-rc1</span>
                  </div>

                  <div className="py-2.5 grid grid-cols-12 items-baseline">
                    <span className="col-span-4 sm:col-span-3 text-text-muted">status</span>
                    <span className="col-span-8 sm:col-span-9 text-semantic-success flex items-center gap-2 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                      published
                    </span>
                  </div>

                  <div className="py-2.5 grid grid-cols-12 items-baseline">
                    <span className="col-span-4 sm:col-span-3 text-text-muted">author</span>
                    <span className="col-span-8 sm:col-span-9 text-text-secondary">
                      Elena Rostova &lt;elena@meridian.io&gt;
                    </span>
                  </div>

                  <div className="py-2.5 grid grid-cols-12 items-baseline">
                    <span className="col-span-4 sm:col-span-3 text-text-muted">commit_hash</span>
                    <span className="col-span-8 sm:col-span-9 text-[#F1F0EC]">8f3a21c</span>
                  </div>

                  <div className="py-2.5 grid grid-cols-12 items-baseline">
                    <span className="col-span-4 sm:col-span-3 text-text-muted">deployed_at</span>
                    <span className="col-span-8 sm:col-span-9 text-text-secondary">
                      2026-10-28 22:30:14 UTC
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-6 border-t border-border-subtle flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono text-text-muted">
                <div>Encrypted internal storage · Port 5432</div>
                <div className="text-text-secondary">Automated hourly volume snapshots</div>
              </div>
            </div>
          )}

          {/* =============================================================
              VIEW 4: BACKGROUND WORKER — Show the Job Lifecycle
              Three stages: Completed, Processing (focal point), Queued
              ============================================================= */}
          {selectedId === "worker" && (
            <div className="w-full space-y-8 animate-in fade-in duration-200">
              {/* Heading */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-6 border-b border-border-subtle">
                <div className="space-y-1">
                  <div className="font-mono text-[11px] text-accent-orange uppercase tracking-wider font-medium">
                    ASYNCHRONOUS SYSTEM
                  </div>
                  <h3 className="font-sans text-[28px] sm:text-[34px] font-medium text-[#F1F0EC] tracking-tight">
                    Job Execution Lifecycle
                  </h3>
                </div>

                <div className="flex items-center gap-2 font-mono text-[12px] text-text-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                  <span>Queue active · 0 backlog</span>
                </div>
              </div>

              {/* Three Connected Lifecycle Stages (Horizontal on desktop, stacked on mobile) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                
                {/* Stage 1: Completed Jobs */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                    <span className="font-mono text-[11px] text-semantic-success font-medium tracking-wider uppercase">
                      COMPLETED
                    </span>
                    <span className="font-mono text-[11px] text-text-muted">2 jobs</span>
                  </div>

                  <div className="divide-y divide-border-subtle/80 font-mono text-[12px]">
                    <div className="py-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[#F1F0EC] font-medium">compile_wasm_bundle</span>
                        <span className="text-semantic-success text-[11px]">340ms</span>
                      </div>
                      <div className="text-[11px] text-text-muted">
                        Worker #02 · Success
                      </div>
                    </div>

                    <div className="py-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[#F1F0EC] font-medium">generate_release_manifest</span>
                        <span className="text-semantic-success text-[11px]">115ms</span>
                      </div>
                      <div className="text-[11px] text-text-muted">
                        Worker #01 · Success
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stage 2: Processing (Focal Point!) */}
                <div className="space-y-4 lg:border-l lg:border-border-subtle lg:pl-8">
                  <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                    <span className="font-mono text-[11px] text-accent-orange font-medium tracking-wider uppercase flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
                      PROCESSING
                    </span>
                    <span className="font-mono text-[11px] text-accent-orange font-medium">ACTIVE</span>
                  </div>

                  <div className="py-3 space-y-3 font-mono text-[12px]">
                    <div>
                      <div className="text-[#F1F0EC] font-semibold text-[14px]">
                        optimize_edge_assets
                      </div>
                      <div className="font-sans text-[12.5px] text-text-secondary leading-snug mt-1">
                        Compressing Brotli release tarballs for multi-region edge distribution.
                      </div>
                    </div>

                    {/* Restrained Progress Bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="h-1 w-full bg-[#252525] rounded-full overflow-hidden">
                        <div className="h-full bg-accent-orange w-3/5 rounded-full" />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-text-muted">
                        <span className="text-accent-orange">Worker #03</span>
                        <span>84ms elapsed</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stage 3: Queued Jobs */}
                <div className="space-y-4 lg:border-l lg:border-border-subtle lg:pl-8">
                  <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                    <span className="font-mono text-[11px] text-text-muted font-medium tracking-wider uppercase">
                      QUEUED
                    </span>
                    <span className="font-mono text-[11px] text-text-muted">2 jobs</span>
                  </div>

                  <div className="divide-y divide-border-subtle/80 font-mono text-[12px]">
                    <div className="py-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[#F1F0EC]">broadcast_webhook_dispatch</span>
                        <span className="text-text-muted text-[11px]">Priority: High</span>
                      </div>
                      <div className="text-[11px] text-text-muted">
                        Waiting in queue · 24ms
                      </div>
                    </div>

                    <div className="py-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[#F1F0EC]">purge_stale_cache_keys</span>
                        <span className="text-text-muted text-[11px]">Scheduled</span>
                      </div>
                      <div className="text-[11px] text-text-muted">
                        Waiting on optimize_edge_assets
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="pt-6 border-t border-border-subtle flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono text-text-muted">
                <div>Decoupled asynchronous worker pool with automatic retry backoff</div>
                <div className="text-text-secondary">Message broker: Redis memory bus</div>
              </div>
            </div>
          )}
        </div>

        {/* =================================================================
            THREE BENEFIT DESCRIPTIONS
            Understated editorial columns beneath the experience
            ================================================================= */}
        <div className="w-full border-t border-border-subtle pt-10 sm:pt-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 w-full max-w-6xl">
            {/* Column 01 */}
            <div className="space-y-2.5">
              <div className="font-mono text-[11px] text-accent-orange font-medium tracking-wider">
                01
              </div>
              <h3 className="font-sans text-[17px] sm:text-[18px] font-medium text-[#F1F0EC] tracking-[-0.015em]">
                Connected services
              </h3>
              <p className="font-sans text-[14px] text-text-secondary leading-[1.6]">
                Keep the relationships between application components understandable through a shared internal network.
              </p>
            </div>

            {/* Column 02 */}
            <div className="space-y-2.5">
              <div className="font-mono text-[11px] text-accent-orange font-medium tracking-wider">
                02
              </div>
              <h3 className="font-sans text-[17px] sm:text-[18px] font-medium text-[#F1F0EC] tracking-[-0.015em]">
                One developer workflow
              </h3>
              <p className="font-sans text-[14px] text-text-secondary leading-[1.6]">
                Reduce the need to think about every component as an entirely separate project. Manage routing, environment, and code from one place.
              </p>
            </div>

            {/* Column 03 */}
            <div className="space-y-2.5">
              <div className="font-mono text-[11px] text-accent-orange font-medium tracking-wider">
                03
              </div>
              <h3 className="font-sans text-[17px] sm:text-[18px] font-medium text-[#F1F0EC] tracking-[-0.015em]">
                Room to grow
              </h3>
              <p className="font-sans text-[14px] text-text-secondary leading-[1.6]">
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
