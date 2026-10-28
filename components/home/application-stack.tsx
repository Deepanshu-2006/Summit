"use client";

import React, { useState } from "react";
import {
  AppWindow,
  Cpu,
  Database,
  RefreshCw,
  Network,
  ArrowDown,
  Info,
  Lock,
} from "lucide-react";

interface ServiceComponent {
  id: "web" | "api" | "db" | "worker";
  tag: string;
  name: string;
  category: string;
  role: string;
  description: string;
  tech: string;
  protocol: string;
  status: string;
}

const STACK_SERVICES: Record<string, ServiceComponent> = {
  web: {
    id: "web",
    tag: "web-app",
    name: "Web Application",
    category: "WEB APP",
    role: "The experience your users see",
    description:
      "Public-facing user interface rendering client requests, static assets, and edge routes.",
    tech: "Next.js / React SSR",
    protocol: "HTTPS // Port 443",
    status: "Active Ingress",
  },
  api: {
    id: "api",
    tag: "api-service",
    name: "API Service",
    category: "API SERVICE",
    role: "Logic and application requests",
    description:
      "Central application backend handling business logic, user auth, and service coordination.",
    tech: "Node.js / Go / Python",
    protocol: "Private Mesh // gRPC & REST",
    status: "Connected Core",
  },
  db: {
    id: "db",
    tag: "primary-db",
    name: "Database",
    category: "DATABASE",
    role: "Persistent application data",
    description:
      "Managed relational data storage providing transactional integrity and isolated persistence.",
    tech: "PostgreSQL Engine",
    protocol: "Encrypted Internal Wire // 5432",
    status: "Volume Attached",
  },
  worker: {
    id: "worker",
    tag: "queue-worker",
    name: "Background Worker",
    category: "BACKGROUND WORKER",
    role: "Tasks that run behind the scenes",
    description:
      "Asynchronous job processor executing heavy computations, webhook deliveries, and scheduled tasks.",
    tech: "Job Queue Runtime",
    protocol: "Internal Message Broker",
    status: "Queue Listening",
  },
};

/**
 * ApplicationStack: Section 04 — The Platform
 * "One platform. Your entire stack."
 * Illustrates the relationships between frontend, API, database, and background worker services.
 * Completely normal document flow — stable, spacious, and responsive.
 */
export function ApplicationStack() {
  const [selectedId, setSelectedId] = useState<"web" | "api" | "db" | "worker">("api");

  const current = STACK_SERVICES[selectedId];

  return (
    <section
      id="platform-stack"
      className="relative w-full pt-12 pb-20 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-32 bg-bg-main text-text-primary overflow-hidden"
      aria-labelledby="stack-heading"
    >
      <div className="layout-container w-full">
        {/* =================================================================
            SECTION MARKER: 04 — THE PLATFORM
            ================================================================= */}
        <div className="w-full flex items-center justify-between border-t border-border-subtle/70 pt-5 mb-10 sm:mb-14">
          <div className="flex items-center gap-3 font-mono text-[11px] text-text-muted tracking-wider">
            <span className="text-accent-orange font-medium">04</span>
            <div className="w-8 h-[1px] bg-accent-orange" aria-hidden="true" />
            <span>THE PLATFORM</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 font-mono text-[10.5px] text-text-muted">
            <span>APPLICATION TOPOLOGY</span>
            <span className="text-border-default">•</span>
            <span>UNIFIED RUNTIME</span>
          </div>
        </div>

        {/* =================================================================
            EDITORIAL INTRO: Eyebrow, Headline, Supporting Copy
            Spacious, clear typography establishing the architecture
            ================================================================= */}
        <div className="max-w-3xl mb-12 sm:mb-16">
          {/* Technical Eyebrow */}
          <div className="flex items-center gap-2 mb-4">
            <span
              className="w-1.5 h-1.5 rounded-[1px] bg-accent-orange"
              aria-hidden="true"
            />
            <span className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-muted">
              EVERYTHING WORKS TOGETHER
            </span>
          </div>

          {/* Section Headline */}
          <h2
            id="stack-heading"
            className="font-sans text-[36px] sm:text-[46px] lg:text-[54px] font-medium leading-[1.06] tracking-[-0.035em] text-[#F5F5F3] mb-5"
          >
            One platform. Your entire stack.
          </h2>

          {/* Supporting Copy */}
          <p className="font-sans text-[16px] sm:text-[17px] text-text-secondary leading-[1.6] max-w-[620px]">
            From the interface your users see to the services working behind the
            scenes, bring your application components together in one
            developer-focused workflow.
          </p>
        </div>

        {/* =================================================================
            MAIN VISUAL: The Application Stack Topology Diagram
            Connected services showing relationships rather than a generic grid
            ================================================================= */}
        <div className="w-full rounded-[14px] bg-[#171717] border border-border-default shadow-2xl p-5 sm:p-8 lg:p-12 mb-12 sm:mb-16 relative overflow-hidden">
          
          {/* Subtle Ambient Dot Grid */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(#303030 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
            aria-hidden="true"
          />

          {/* Top Topology Header / Status */}
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 sm:pb-8 border-b border-border-subtle/80 mb-8 sm:mb-10 text-[11px] font-mono text-text-muted">
            <div className="flex items-center gap-2">
              <Network className="w-3.5 h-3.5 text-accent-orange" />
              <span className="text-[#F5F5F3] font-medium">
                stack-topology // service mesh
              </span>
              <span className="text-border-default">•</span>
              <span className="hidden sm:inline">4 Connected Services</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-[4px] bg-[#252525] border border-border-subtle text-text-muted text-[10px]">
                CONCEPTUAL STACK
              </span>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border border-semantic-success/30 bg-semantic-success/15 text-semantic-success text-[10.5px]">
                <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                <span>MESH HEALTHY</span>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------
              DESKTOP ARCHITECTURAL TOPOLOGY (md and up)
              Hierarchical connected layout: Web App (top) -> API (center) -> DB & Worker (bottom)
              --------------------------------------------------------------- */}
          <div className="relative z-10 hidden md:block max-w-4xl mx-auto py-2">
            
            {/* 1. TOP TIER: Web Application (Client Ingress) */}
            <div className="flex justify-center mb-6">
              <button
                onClick={() => setSelectedId("web")}
                className={`w-[360px] p-4 rounded-[10px] bg-[#1D1D1D] border transition-all text-left group ${
                  selectedId === "web"
                    ? "border-accent-orange shadow-lg shadow-accent-orange/10 ring-1 ring-accent-orange/30"
                    : "border-border-default hover:border-border-default/80"
                }`}
                role="button"
                aria-pressed={selectedId === "web"}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-[5px] bg-[#252525] border border-border-subtle flex items-center justify-center text-accent-orange">
                      <AppWindow className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-mono text-[10px] text-accent-orange font-medium">
                        WEB APP
                      </div>
                      <div className="font-mono text-[12px] font-semibold text-[#F5F5F3]">
                        web-frontend
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-semantic-success bg-semantic-success/10 px-2 py-0.5 rounded-[4px] border border-semantic-success/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                    <span>HTTPS 443</span>
                  </div>
                </div>
                <p className="text-[12px] text-text-secondary leading-snug">
                  The experience your users see
                </p>
              </button>
            </div>

            {/* Connector 1: Web App -> API Service */}
            <div className="flex flex-col items-center justify-center my-1 select-none">
              <div className="w-[1.5px] h-6 bg-border-default" />
              <div className="px-2.5 py-0.5 rounded-[4px] bg-[#111111] border border-border-subtle text-[9.5px] font-mono text-text-muted my-0.5 flex items-center gap-1.5">
                <Lock className="w-2.5 h-2.5 text-accent-orange" />
                <span>HTTPS / Public Ingress Routing</span>
                <ArrowDown className="w-2.5 h-2.5 text-text-muted" />
              </div>
              <div className="w-[1.5px] h-6 bg-border-default" />
            </div>

            {/* 2. CENTER TIER: API Service (Central Hub) */}
            <div className="flex justify-center mb-6">
              <button
                onClick={() => setSelectedId("api")}
                className={`w-[420px] p-4.5 rounded-[10px] bg-[#1D1D1D] border transition-all text-left relative ${
                  selectedId === "api"
                    ? "border-accent-orange shadow-xl shadow-accent-orange/15 ring-1 ring-accent-orange/40"
                    : "border-border-default hover:border-accent-orange/40"
                }`}
                role="button"
                aria-pressed={selectedId === "api"}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[6px] bg-[#252525] border border-accent-orange/40 flex items-center justify-center text-accent-orange">
                      <Cpu className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <div className="font-mono text-[10.5px] text-accent-orange font-semibold">
                        API SERVICE
                      </div>
                      <div className="font-mono text-[13px] font-semibold text-[#F5F5F3]">
                        core-api
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#F5F5F3] bg-[#252525] px-2 py-0.5 rounded-[4px] border border-border-subtle">
                    <span>Private Mesh</span>
                  </div>
                </div>
                <p className="text-[12.5px] text-text-secondary leading-snug">
                  Logic and application requests
                </p>
                <div className="mt-2 pt-2 border-t border-border-subtle/60 flex items-center justify-between text-[10px] font-mono text-text-muted">
                  <span>Routing core</span>
                  <span className="text-accent-orange font-medium">CENTRAL COORDINATOR</span>
                </div>
              </button>
            </div>

            {/* Symmetrical Branch Conduits (SVG) */}
            <div className="w-full flex justify-center mb-1">
              <svg
                width="640"
                height="50"
                viewBox="0 0 640 50"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="overflow-visible select-none"
                aria-hidden="true"
              >
                {/* Center Stem */}
                <path d="M 320 0 L 320 18" stroke="#303030" strokeWidth="1.5" />

                {/* Left Branch to Database */}
                <path
                  d="M 320 18 L 170 18 L 170 50"
                  stroke={selectedId === "db" || selectedId === "api" ? "#D88762" : "#303030"}
                  strokeWidth="1.5"
                  strokeDasharray={selectedId === "db" ? "none" : "3 3"}
                />

                {/* Right Branch to Background Worker */}
                <path
                  d="M 320 18 L 470 18 L 470 50"
                  stroke={selectedId === "worker" || selectedId === "api" ? "#D88762" : "#303030"}
                  strokeWidth="1.5"
                  strokeDasharray={selectedId === "worker" ? "none" : "3 3"}
                />

                {/* Left Branch Label */}
                <rect x="180" y="8" width="115" height="18" rx="3" fill="#111111" stroke="#303030" />
                <text x="186" y="20" fill="#777777" fontFamily="var(--font-geist-mono)" fontSize="8.5">
                  SQL Connection Pool
                </text>

                {/* Right Branch Label */}
                <rect x="345" y="8" width="115" height="18" rx="3" fill="#111111" stroke="#303030" />
                <text x="351" y="20" fill="#777777" fontFamily="var(--font-geist-mono)" fontSize="8.5">
                  Async Job Dispatch
                </text>
              </svg>
            </div>

            {/* 3. BOTTOM TIER: Database (Left) & Background Worker (Right) */}
            <div className="grid grid-cols-2 gap-8 max-w-3xl mx-auto">
              
              {/* Component C: Database */}
              <button
                onClick={() => setSelectedId("db")}
                className={`p-4 rounded-[10px] bg-[#1D1D1D] border transition-all text-left ${
                  selectedId === "db"
                    ? "border-accent-orange shadow-lg shadow-accent-orange/10 ring-1 ring-accent-orange/30"
                    : "border-border-default hover:border-border-default/80"
                }`}
                role="button"
                aria-pressed={selectedId === "db"}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-[5px] bg-[#252525] border border-border-subtle flex items-center justify-center text-accent-orange">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-mono text-[10px] text-accent-orange font-medium">
                        DATABASE
                      </div>
                      <div className="font-mono text-[12px] font-semibold text-[#F5F5F3]">
                        primary-db
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-text-muted bg-[#111111] px-2 py-0.5 rounded border border-border-subtle">
                    Postgres
                  </span>
                </div>
                <p className="text-[12px] text-text-secondary leading-snug">
                  Persistent application data
                </p>
              </button>

              {/* Component D: Background Worker */}
              <button
                onClick={() => setSelectedId("worker")}
                className={`p-4 rounded-[10px] bg-[#1D1D1D] border transition-all text-left ${
                  selectedId === "worker"
                    ? "border-accent-orange shadow-lg shadow-accent-orange/10 ring-1 ring-accent-orange/30"
                    : "border-border-default hover:border-border-default/80"
                }`}
                role="button"
                aria-pressed={selectedId === "worker"}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-[5px] bg-[#252525] border border-border-subtle flex items-center justify-center text-accent-orange">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-mono text-[10px] text-accent-orange font-medium">
                        BACKGROUND WORKER
                      </div>
                      <div className="font-mono text-[12px] font-semibold text-[#F5F5F3]">
                        queue-worker
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-text-muted bg-[#111111] px-2 py-0.5 rounded border border-border-subtle">
                    Async Jobs
                  </span>
                </div>
                <p className="text-[12px] text-text-secondary leading-snug">
                  Tasks that run behind the scenes
                </p>
              </button>

            </div>

          </div>

          {/* ---------------------------------------------------------------
              MOBILE ARCHITECTURAL TOPOLOGY (Stack vertical for < md)
              Clean vertical progression without cramped horizontal overflows
              --------------------------------------------------------------- */}
          <div className="relative z-10 md:hidden flex flex-col gap-3">
            
            {/* Mobile Web App */}
            <button
              onClick={() => setSelectedId("web")}
              className={`p-4 rounded-[10px] bg-[#1D1D1D] border text-left transition-all ${
                selectedId === "web" ? "border-accent-orange" : "border-border-default"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="font-mono text-[10px] text-accent-orange font-medium">
                  WEB APP
                </div>
                <span className="text-[10px] font-mono text-semantic-success">HTTPS 443</span>
              </div>
              <div className="font-mono text-[13px] font-semibold text-[#F5F5F3] mb-0.5">
                web-frontend
              </div>
              <p className="text-[12px] text-text-secondary">The experience your users see</p>
            </button>

            {/* Mobile Connector */}
            <div className="flex items-center justify-center py-0.5 text-text-muted">
              <ArrowDown className="w-3.5 h-3.5 text-accent-orange" />
            </div>

            {/* Mobile API */}
            <button
              onClick={() => setSelectedId("api")}
              className={`p-4 rounded-[10px] bg-[#1D1D1D] border text-left transition-all ${
                selectedId === "api" ? "border-accent-orange" : "border-border-default"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="font-mono text-[10px] text-accent-orange font-semibold">
                  API SERVICE
                </div>
                <span className="text-[10px] font-mono text-text-muted">Private Mesh</span>
              </div>
              <div className="font-mono text-[13px] font-semibold text-[#F5F5F3] mb-0.5">
                core-api
              </div>
              <p className="text-[12px] text-text-secondary">Logic and application requests</p>
            </button>

            {/* Mobile Connector */}
            <div className="flex items-center justify-center py-0.5 text-text-muted">
              <ArrowDown className="w-3.5 h-3.5 text-accent-orange" />
            </div>

            {/* Mobile Database */}
            <button
              onClick={() => setSelectedId("db")}
              className={`p-4 rounded-[10px] bg-[#1D1D1D] border text-left transition-all ${
                selectedId === "db" ? "border-accent-orange" : "border-border-default"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="font-mono text-[10px] text-accent-orange font-medium">
                  DATABASE
                </div>
                <span className="text-[10px] font-mono text-text-muted">Postgres</span>
              </div>
              <div className="font-mono text-[13px] font-semibold text-[#F5F5F3] mb-0.5">
                primary-db
              </div>
              <p className="text-[12px] text-text-secondary">Persistent application data</p>
            </button>

            {/* Mobile Connector */}
            <div className="flex items-center justify-center py-0.5 text-text-muted">
              <ArrowDown className="w-3.5 h-3.5 text-accent-orange" />
            </div>

            {/* Mobile Background Worker */}
            <button
              onClick={() => setSelectedId("worker")}
              className={`p-4 rounded-[10px] bg-[#1D1D1D] border text-left transition-all ${
                selectedId === "worker" ? "border-accent-orange" : "border-border-default"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="font-mono text-[10px] text-accent-orange font-medium">
                  BACKGROUND WORKER
                </div>
                <span className="text-[10px] font-mono text-text-muted">Async Jobs</span>
              </div>
              <div className="font-mono text-[13px] font-semibold text-[#F5F5F3] mb-0.5">
                queue-worker
              </div>
              <p className="text-[12px] text-text-secondary">Tasks that run behind the scenes</p>
            </button>

          </div>

          {/* ---------------------------------------------------------------
              SUBORDINATE SERVICE INSPECTOR PANEL
              Shows selected service's role, protocol, and relationship
              --------------------------------------------------------------- */}
          <div className="mt-8 pt-6 border-t border-border-subtle/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[11.5px] font-mono text-text-muted">
            <div className="space-y-1">
              <div className="text-[10px] uppercase text-text-muted tracking-wider">
                INSPECTING COMPONENT // {current.category}
              </div>
              <div className="text-[#F5F5F3] font-medium text-[13px] font-sans">
                {current.name} — <span className="text-text-secondary font-normal">{current.role}</span>
              </div>
              <p className="text-[12px] text-text-muted max-w-xl font-sans mt-0.5">
                {current.description}
              </p>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 self-start sm:self-center">
              <span className="px-2.5 py-1 rounded-[4px] bg-[#1D1D1D] border border-border-subtle text-text-secondary">
                {current.tech}
              </span>
              <span className="px-2.5 py-1 rounded-[4px] bg-semantic-success/15 border border-semantic-success/30 text-semantic-success font-medium">
                {current.status}
              </span>
            </div>
          </div>

        </div>

        {/* =================================================================
            SUPPORTING FEATURE ROW: 3 Compact Points Explaining Value
            01 Connected Services • 02 One Developer Workflow • 03 Room to Grow
            ================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 pt-4 max-w-5xl">
          
          {/* Feature 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-accent-orange font-medium">
                01
              </span>
              <div className="w-4 h-[1px] bg-accent-orange/60" aria-hidden="true" />
              <h3 className="font-sans text-[15px] font-semibold text-[#F5F5F3]">
                Connected services
              </h3>
            </div>
            <p className="font-sans text-[13px] text-text-muted leading-relaxed">
              Keep the relationships between application components understandable through a shared internal network.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-accent-orange font-medium">
                02
              </span>
              <div className="w-4 h-[1px] bg-accent-orange/60" aria-hidden="true" />
              <h3 className="font-sans text-[15px] font-semibold text-[#F5F5F3]">
                One developer workflow
              </h3>
            </div>
            <p className="font-sans text-[13px] text-text-muted leading-relaxed">
              Reduce the need to think about every component as an entirely separate project. Manage routing, environment, and code from one place.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-accent-orange font-medium">
                03
              </span>
              <div className="w-4 h-[1px] bg-accent-orange/60" aria-hidden="true" />
              <h3 className="font-sans text-[15px] font-semibold text-[#F5F5F3]">
                Room to grow
              </h3>
            </div>
            <p className="font-sans text-[13px] text-text-muted leading-relaxed">
              Start with a single frontend service, then attach background workers, queues, and databases as your application evolves.
            </p>
          </div>

        </div>

        {/* Footnote Disclosing Conceptual Model */}
        <div className="mt-10 pt-4 border-t border-border-subtle/50 flex items-center gap-2 text-[10.5px] font-mono text-text-muted">
          <Info className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span>
            Conceptual application architecture model. Illustrates service coordination on a unified developer platform.
          </span>
        </div>

      </div>
    </section>
  );
}

export default ApplicationStack;
