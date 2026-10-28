"use client";

import React, { useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileText,
  Radio,
  Info,
  Server,
} from "lucide-react";

interface ActivityEvent {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  type: "release" | "health" | "build" | "trigger";
}

interface DiagnosticEntry {
  id: string;
  time: string;
  method: "GET" | "POST" | "SYS";
  path: string;
  status: string;
  latency: string;
  category: "all" | "http" | "sys";
}

const RECENT_EVENTS: ActivityEvent[] = [
  {
    id: "e1",
    title: "New version published",
    detail: "release-v1.4.2 cutover complete (100% traffic)",
    timestamp: "12m ago",
    type: "release",
  },
  {
    id: "e2",
    title: "Application status checked",
    detail: "Synthetic edge probes verified response across regions",
    timestamp: "18m ago",
    type: "health",
  },
  {
    id: "e3",
    title: "Build completed",
    detail: "Hermetic container digest verified and signed",
    timestamp: "24m ago",
    type: "build",
  },
  {
    id: "e4",
    title: "Deployment initiated",
    detail: "Commit 8f3a21c received on branch main",
    timestamp: "25m ago",
    type: "trigger",
  },
];

const DIAGNOSTIC_LOGS: DiagnosticEntry[] = [
  {
    id: "d1",
    time: "14:28:02",
    method: "GET",
    path: "/api/v1/health",
    status: "200 OK",
    latency: "8ms",
    category: "http",
  },
  {
    id: "d2",
    time: "14:27:49",
    method: "POST",
    path: "/api/v1/auth/session",
    status: "200 OK",
    latency: "24ms",
    category: "http",
  },
  {
    id: "d3",
    time: "14:26:15",
    method: "GET",
    path: "/",
    status: "200 OK",
    latency: "12ms",
    category: "http",
  },
  {
    id: "d4",
    time: "14:25:34",
    method: "SYS",
    path: "runtime-worker-initialized",
    status: "READY",
    latency: "120ms",
    category: "sys",
  },
  {
    id: "d5",
    time: "14:25:12",
    method: "GET",
    path: "/api/v1/projects",
    status: "200 OK",
    latency: "18ms",
    category: "http",
  },
];

/**
 * ProductionVisibility: Section 06 — Production Visibility
 * "Know what’s happening. Keep moving forward."
 * Three connected areas: Application Status, Recent Activity, Diagnostic Details.
 * 100% normal document flow — stable, spacious, and responsive.
 */
export function ProductionVisibility() {
  const [logFilter, setLogFilter] = useState<"all" | "http" | "sys">("all");

  const filteredLogs =
    logFilter === "all"
      ? DIAGNOSTIC_LOGS
      : DIAGNOSTIC_LOGS.filter((log) => log.category === logFilter);

  return (
    <section
      id="production-visibility"
      className="relative w-full pt-12 pb-20 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-32 bg-bg-main text-text-primary overflow-hidden"
      aria-labelledby="visibility-heading"
    >
      <div className="layout-container w-full">
        {/* =================================================================
            SECTION MARKER: 06 — PRODUCTION VISIBILITY
            ================================================================= */}
        <div className="w-full flex items-center justify-between border-t border-border-subtle/70 pt-5 mb-10 sm:mb-14">
          <div className="flex items-center gap-3 font-mono text-[11px] text-text-muted tracking-wider">
            <span className="text-accent-orange font-medium">06</span>
            <div className="w-8 h-[1px] bg-accent-orange" aria-hidden="true" />
            <span>PRODUCTION VISIBILITY</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 font-mono text-[10.5px] text-text-muted">
            <span>OBSERVABILITY ARCHITECTURE</span>
            <span className="text-border-default">•</span>
            <span>HEALTH & TELEMETRY</span>
          </div>
        </div>

        {/* =================================================================
            EDITORIAL INTRO: Eyebrow, Headline, Supporting Copy
            ================================================================= */}
        <div className="max-w-3xl mb-12 sm:mb-16">
          {/* Technical Eyebrow */}
          <div className="flex items-center gap-2 mb-4">
            <span
              className="w-1.5 h-1.5 rounded-[1px] bg-accent-orange"
              aria-hidden="true"
            />
            <span className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-muted">
              CLARITY AFTER DEPLOYMENT
            </span>
          </div>

          {/* Section Headline */}
          <h2
            id="visibility-heading"
            className="font-sans text-[36px] sm:text-[46px] lg:text-[54px] font-medium leading-[1.06] tracking-[-0.035em] text-[#F5F5F3] mb-5"
          >
            Know what’s happening. Keep moving forward.
          </h2>

          {/* Supporting Copy */}
          <p className="font-sans text-[16px] sm:text-[17px] text-text-secondary leading-[1.6] max-w-[620px]">
            Production shouldn’t feel like a black box. Give developers a clear
            view of application status, recent activity, and the information
            they need to understand what’s happening.
          </p>
        </div>

        {/* =================================================================
            PRIMARY VISUAL: Application Health and Activity Product Interface
            Connected areas: Status Header + Recent Activity + Diagnostic Details
            ================================================================= */}
        <div className="w-full rounded-[14px] bg-[#171717] border border-border-default shadow-2xl overflow-hidden">
          
          {/* ---------------------------------------------------------------
              AREA A: APPLICATION STATUS HEADER
              Identity, Environment, Operational State, and Latest Release
              --------------------------------------------------------------- */}
          <div className="px-5 py-4 sm:px-8 sm:py-5 bg-[#1D1D1D] border-b border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Application Identifier & Environment */}
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-[8px] bg-[#252525] border border-border-default flex items-center justify-center text-accent-orange shrink-0">
                <Server className="w-4.5 h-4.5" />
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[14px] font-semibold text-[#F5F5F3]">
                    my-project
                  </span>
                  <span className="px-2 py-0.5 rounded-[4px] bg-[#252525] border border-border-subtle text-[10.5px] font-mono text-text-secondary">
                    Production
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted mt-0.5">
                  <span>app.jetway.demo</span>
                  <span>•</span>
                  <span>Latest release: v1.4.2</span>
                </div>
              </div>
            </div>

            {/* Health & Operational Indicator */}
            <div className="flex items-center gap-3 font-mono text-[11.5px] self-start md:self-auto">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[#252525] border border-border-subtle text-text-secondary text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-text-muted" />
                <span>SSL Validated</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1 rounded-[5px] bg-semantic-success/15 border border-semantic-success/35 text-semantic-success font-medium">
                <span className="w-2 h-2 rounded-full bg-semantic-success animate-pulse" />
                <span>OPERATIONAL</span>
              </div>
            </div>

          </div>

          {/* ---------------------------------------------------------------
              TWO-COLUMN MAIN BODY: Recent Activity (Left) + Diagnostic Details (Right)
              --------------------------------------------------------------- */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border-subtle">
            
            {/* -------------------------------------------------------------
                AREA B: RECENT ACTIVITY TIMELINE (7 cols)
                Chronological list of application deployment & check events
                ------------------------------------------------------------- */}
            <div className="lg:col-span-7 p-5 sm:p-7 space-y-4">
              
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle/70">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-accent-orange" />
                  <span className="font-mono text-[12px] font-medium text-[#F5F5F3]">
                    Recent Activity Timeline
                  </span>
                </div>
                <span className="font-mono text-[10.5px] text-text-muted">
                  Chronological Log
                </span>
              </div>

              {/* Event Stream */}
              <div className="space-y-3.5 pt-1">
                {RECENT_EVENTS.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-[8px] bg-[#1D1D1D]/60 border border-border-subtle/60 hover:border-border-default transition-colors"
                  >
                    {/* Event Status Dot / Icon */}
                    <div className="w-6 h-6 rounded-[5px] bg-[#252525] border border-border-subtle flex items-center justify-center shrink-0 mt-0.5">
                      {event.type === "release" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-semantic-success" />
                      ) : event.type === "health" ? (
                        <Radio className="w-3.5 h-3.5 text-teal-400" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-accent-orange" />
                      )}
                    </div>

                    {/* Event Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-sans text-[13.5px] font-medium text-[#F5F5F3] truncate">
                          {event.title}
                        </span>
                        <span className="font-mono text-[10.5px] text-text-muted shrink-0">
                          {event.timestamp}
                        </span>
                      </div>
                      <p className="font-mono text-[11.5px] text-text-muted mt-0.5 truncate">
                        {event.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* -------------------------------------------------------------
                AREA C: DIAGNOSTIC DETAILS PANEL (5 cols)
                Subordinate structured request inspector
                ------------------------------------------------------------- */}
            <div className="lg:col-span-5 p-5 sm:p-7 space-y-4 bg-[#171717]">
              
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle/70">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-accent-orange" />
                  <span className="font-mono text-[12px] font-medium text-[#F5F5F3]">
                    Diagnostic Details
                  </span>
                </div>

                {/* Filter Toggles */}
                <div className="flex items-center gap-1 font-mono text-[10px]">
                  <button
                    onClick={() => setLogFilter("all")}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      logFilter === "all"
                        ? "bg-[#252525] text-accent-orange font-medium"
                        : "text-text-muted hover:text-text-primary"
                    }`}
                  >
                    All
                  </button>
                  <span className="text-border-default">/</span>
                  <button
                    onClick={() => setLogFilter("http")}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      logFilter === "http"
                        ? "bg-[#252525] text-accent-orange font-medium"
                        : "text-text-muted hover:text-text-primary"
                    }`}
                  >
                    HTTP
                  </button>
                  <span className="text-border-default">/</span>
                  <button
                    onClick={() => setLogFilter("sys")}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      logFilter === "sys"
                        ? "bg-[#252525] text-accent-orange font-medium"
                        : "text-text-muted hover:text-text-primary"
                    }`}
                  >
                    SYS
                  </button>
                </div>
              </div>

              {/* Diagnostic Stream Rows */}
              <div className="space-y-2 pt-1 font-mono text-[11px]">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-[6px] bg-[#1D1D1D] border border-border-subtle/70 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-text-muted text-[10px]">
                        {log.time}
                      </span>
                      <span
                        className={`text-[9.5px] px-1 py-0.2 rounded font-semibold ${
                          log.method === "GET"
                            ? "bg-teal-500/15 text-teal-400"
                            : log.method === "POST"
                            ? "bg-accent-orange/15 text-accent-orange"
                            : "bg-[#303030] text-text-muted"
                        }`}
                      >
                        {log.method}
                      </span>
                      <span className="text-[#F5F5F3] truncate">
                        {log.path}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-[10.5px]">
                      <span className="text-semantic-success">
                        {log.status}
                      </span>
                      <span className="text-text-muted">
                        {log.latency}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Inspection Summary Note */}
              <div className="pt-2 text-[10.5px] font-mono text-text-muted">
                <span>Direct runtime inspection · Probes active</span>
              </div>

            </div>

          </div>

          {/* ---------------------------------------------------------------
              PANEL FOOTER: Disclose Sample Data
              --------------------------------------------------------------- */}
          <div className="px-5 py-3 bg-[#111111] border-t border-border-subtle/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10.5px] font-mono text-text-muted">
            <div className="flex items-center gap-1.5">
              <span className="text-accent-orange">◆</span>
              <span>Illustrative production state interface</span>
            </div>
            <span>
              Demonstrates visibility concepts without live operational claims
            </span>
          </div>

        </div>

        {/* Footnote Disclosing Conceptual Model */}
        <div className="mt-12 pt-4 border-t border-border-subtle/50 flex items-center gap-2 text-[10.5px] font-mono text-text-muted">
          <Info className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span>
            Conceptual production monitoring model. Illustrates how developers can inspect deployment health and activity.
          </span>
        </div>

      </div>
    </section>
  );
}

export default ProductionVisibility;
