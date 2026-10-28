"use client";

import React, { useState } from "react";
import { ArrowDown, Check, Lock } from "lucide-react";

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
    tag: "web-frontend",
    name: "Web Frontend",
    category: "WEB APPLICATION",
    role: "The experience your users see",
    description:
      "Public-facing user interface rendering client requests, static assets, and edge routes.",
    tech: "Next.js / React SSR",
    protocol: "HTTPS · Port 443",
    status: "Active Ingress",
  },
  api: {
    id: "api",
    tag: "core-api",
    name: "API Service",
    category: "COORDINATION CORE",
    role: "Logic and application requests",
    description:
      "Central application backend handling business logic, user authentication, request routing, and service coordination.",
    tech: "Node.js / Go / Python",
    protocol: "Private Mesh · gRPC & REST",
    status: "Connected Core",
  },
  db: {
    id: "db",
    tag: "primary-db",
    name: "Database",
    category: "PERSISTENT STORAGE",
    role: "Persistent application data",
    description:
      "Managed relational data storage providing transactional integrity, connection pooling, and isolated persistence.",
    tech: "PostgreSQL 16 Engine",
    protocol: "Encrypted Internal Wire · Port 5432",
    status: "Volume Attached",
  },
  worker: {
    id: "worker",
    tag: "queue-worker",
    name: "Background Worker",
    category: "ASYNC PROCESSING",
    role: "Tasks that run behind the scenes",
    description:
      "Asynchronous job processor executing heavy computations, scheduled jobs, webhook deliveries, and queue tasks.",
    tech: "Job Queue Runtime",
    protocol: "Internal Message Broker",
    status: "Queue Listening",
  },
};

/**
 * ApplicationStack: Section 04 — The Platform
 * "One platform. Your entire stack."
 *
 * Art-directed, card-less technical cloud topology diagram:
 * - Diagram sits directly on the page background without an outer card container
 * - Hierarchical 4-service topology: Web Frontend -> API Core -> Database & Background Worker
 * - Thin, intentional SVG connectors with integrated annotations (no pill boxes)
 * - Clear visual hierarchy distinguishing the central API coordinator
 * - Editorial two-column component inspector
 * - Three clean editorial value columns beneath the architecture
 * - Fully responsive with clean vertical reflow on mobile/tablet
 */
export function ApplicationStack() {
  const [selectedId, setSelectedId] = useState<"web" | "api" | "db" | "worker">("api");

  const current = STACK_SERVICES[selectedId];

  return (
    <section
      id="platform-stack"
      className="relative w-full pt-16 pb-24 sm:pt-20 sm:pb-28 lg:pt-24 lg:pb-36 bg-bg-main text-text-primary overflow-hidden"
      aria-labelledby="stack-heading"
    >
      <div className="layout-container w-full">
        {/* =================================================================
            SECTION IDENTIFIER: 04 / THE PLATFORM
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
            className="font-sans text-[36px] sm:text-[44px] lg:text-[50px] xl:text-[54px] font-medium leading-[1.08] tracking-[-0.035em] text-[#F1F0EC] mb-4 sm:mb-5"
          >
            One platform. Your entire stack.
          </h2>

          <p className="font-sans text-[16px] sm:text-[17px] text-text-secondary leading-[1.6] max-w-[600px]">
            From the interface your users see to the services working behind the
            scenes, bring your application components together in one
            developer-focused workflow.
          </p>
        </div>

        {/* =================================================================
            HERO VISUAL: CONNECTED SERVICE TOPOLOGY
            Card-less, open architectural illustration directly on page background
            ================================================================= */}
        <div className="w-full relative mb-12 sm:mb-16">
          
          {/* -------------------------------------------------------------
              DESKTOP TOPOLOGY SCHEMATIC (lg and up)
              Pure vector precision with interactive SVG service nodes
              ------------------------------------------------------------- */}
          <div className="hidden lg:block w-full">
            <svg
              className="w-full h-auto select-none overflow-visible"
              viewBox="0 0 1000 450"
              preserveAspectRatio="xMidYMid meet"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Connected cloud service architecture topology"
            >
              <defs>
                {/* Subtle surface gradient fills */}
                <linearGradient id="node-base-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#181B1E" />
                  <stop offset="100%" stopColor="#121416" />
                </linearGradient>

                <linearGradient id="node-api-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1C2023" />
                  <stop offset="100%" stopColor="#14171A" />
                </linearGradient>
              </defs>

              {/* =========================================================
                  CONNECTING TOPOLOGY CONDUITS (Drawn Behind Service Nodes)
                  ========================================================= */}

              {/* 1. Ingress Conduit: Web Frontend -> API Core */}
              <line
                x1="500"
                y1="96"
                x2="500"
                y2="180"
                stroke="#343A3D"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
              <line
                x1="500"
                y1="96"
                x2="500"
                y2="180"
                stroke="#D88762"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              
              {/* Primary Ingress Motion Signal */}
              <circle className="motion-reduce:hidden" r="3" fill="#D88762">
                <animateMotion
                  path="M 500,96 L 500,180"
                  dur="2.4s"
                  repeatCount="indefinite"
                />
              </circle>

              {/* Ingress Annotation: Text-only alongside wire (No pill capsule) */}
              <text x="516" y="132" fontFamily="var(--font-geist-mono), monospace" fontSize="10.5" fill="#D88762" letterSpacing="0.08em">
                HTTPS INGRESS ROUTING
              </text>
              <text x="516" y="148" fontFamily="var(--font-geist-mono), monospace" fontSize="9.5" fill="#777D7D">
                Client requests · Port 443 · Edge TLS
              </text>

              {/* 2. Left Branch Conduit: API Core -> Database */}
              <path
                d="M 400,270 C 400,314 260,314 260,356"
                stroke="#343A3D"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                fill="none"
              />
              <path
                d="M 400,270 C 400,314 260,314 260,356"
                stroke={selectedId === "db" || selectedId === "api" ? "#D88762" : "#343A3D"}
                strokeWidth={selectedId === "db" ? "2" : "1.4"}
                strokeLinecap="round"
                fill="none"
              />
              
              {/* Left Branch Node */}
              <circle cx="330" cy="314" r="3" fill="#121416" stroke={selectedId === "db" || selectedId === "api" ? "#D88762" : "#343A3D"} strokeWidth="1.4" />
              <circle cx="330" cy="314" r="1.5" fill={selectedId === "db" || selectedId === "api" ? "#D88762" : "#343A3D"} />

              {/* Database Conduit Annotation (Integrated text, no pills) */}
              <text x="314" y="306" textAnchor="end" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#A6AAA9" letterSpacing="0.08em">
                SQL CONNECTION POOL
              </text>
              <text x="314" y="322" textAnchor="end" fontFamily="var(--font-geist-mono), monospace" fontSize="9" fill="#777D7D">
                Encrypted wire · Port 5432
              </text>

              {/* 3. Right Branch Conduit: API Core -> Background Worker */}
              <path
                d="M 600,270 C 600,314 740,314 740,356"
                stroke="#343A3D"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                fill="none"
              />
              <path
                d="M 600,270 C 600,314 740,314 740,356"
                stroke={selectedId === "worker" || selectedId === "api" ? "#D88762" : "#343A3D"}
                strokeWidth={selectedId === "worker" ? "2" : "1.4"}
                strokeLinecap="round"
                fill="none"
              />

              {/* Right Branch Node */}
              <circle cx="670" cy="314" r="3" fill="#121416" stroke={selectedId === "worker" || selectedId === "api" ? "#D88762" : "#343A3D"} strokeWidth="1.4" />
              <circle cx="670" cy="314" r="1.5" fill={selectedId === "worker" || selectedId === "api" ? "#D88762" : "#343A3D"} />

              {/* Worker Conduit Annotation (Integrated text, no pills) */}
              <text x="686" y="306" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#A6AAA9" letterSpacing="0.08em">
                ASYNC JOB DISPATCH
              </text>
              <text x="686" y="322" fontFamily="var(--font-geist-mono), monospace" fontSize="9" fill="#777D7D">
                Message broker · Task queue
              </text>

              {/* =========================================================
                  SERVICE NODE 1: WEB FRONTEND (Top Tier)
                  ========================================================= */}
              <g
                id="node-web"
                tabIndex={0}
                role="button"
                aria-pressed={selectedId === "web"}
                onClick={() => setSelectedId("web")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId("web");
                  }
                }}
                className="cursor-pointer focus:outline-none group"
              >
                {/* Node Framing */}
                <rect
                  x="330"
                  y="20"
                  width="340"
                  height="76"
                  rx="4"
                  fill="url(#node-base-fill)"
                  stroke={selectedId === "web" ? "#D88762" : "#2A2E31"}
                  strokeWidth={selectedId === "web" ? "1.6" : "1"}
                  className="transition-colors group-hover:stroke-[#454B50]"
                />
                
                {/* Line-Art Glyph: Minimal Ingress Terminal */}
                <rect x="348" y="36" width="18" height="14" rx="2" stroke="#D88762" strokeWidth="1.2" fill="none" />
                <line x1="348" y1="41" x2="366" y2="41" stroke="#3D4245" strokeWidth="1" />
                <circle cx="352" cy="38.5" r="0.8" fill="#D88762" />
                <circle cx="355" cy="38.5" r="0.8" fill="#A6AAA9" />

                {/* Node Metadata & Typography */}
                <text x="376" y="40" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#A6AAA9" letterSpacing="0.1em">
                  WEB FRONTEND
                </text>
                <text x="376" y="60" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="17" fontWeight="500" fill="#F1F0EC">
                  web-frontend
                </text>
                <text x="376" y="78" fontFamily="var(--font-sans), sans-serif" fontSize="12" fill="#777D7D">
                  The experience your users see
                </text>

                {/* Status Indicator (Inline, No Pill Capsule) */}
                <circle cx="620" cy="38" r="2.5" fill="#83B69A" />
                <text x="628" y="41" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#83B69A">
                  HTTPS · 443
                </text>

                {/* Outgoing Coupling Node */}
                <circle cx="500" cy="96" r="4.5" fill="#121416" stroke="#D88762" strokeWidth="1.4" />
                <circle cx="500" cy="96" r="2" fill="#D88762" />
              </g>

              {/* =========================================================
                  SERVICE NODE 2: API SERVICE (Central Coordination Core)
                  Receives visual emphasis through geometry and central location
                  ========================================================= */}
              <g
                id="node-api"
                tabIndex={0}
                role="button"
                aria-pressed={selectedId === "api"}
                onClick={() => setSelectedId("api")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId("api");
                  }
                }}
                className="cursor-pointer focus:outline-none group"
              >
                {/* Node Framing */}
                <rect
                  x="300"
                  y="180"
                  width="400"
                  height="90"
                  rx="4"
                  fill="url(#node-api-fill)"
                  stroke={selectedId === "api" ? "#D88762" : "#363C40"}
                  strokeWidth={selectedId === "api" ? "1.8" : "1.2"}
                  className="transition-colors group-hover:stroke-accent-orange/70"
                />

                {/* Precision Corner Register Marks */}
                <line x1="300" y1="188" x2="300" y2="180" stroke="#D88762" strokeWidth="1.6" />
                <line x1="300" y1="180" x2="308" y2="180" stroke="#D88762" strokeWidth="1.6" />
                <line x1="700" y1="188" x2="700" y2="180" stroke="#D88762" strokeWidth="1.6" />
                <line x1="700" y1="180" x2="692" y2="180" stroke="#D88762" strokeWidth="1.6" />

                {/* Line-Art Glyph: Central Logic Core */}
                <rect x="320" y="198" width="22" height="22" rx="3" stroke="#D88762" strokeWidth="1.5" fill="#1D2023" />
                <rect x="326" y="204" width="10" height="10" rx="1" stroke="#D88762" strokeWidth="1" fill="#D88762" fillOpacity="0.2" />
                <line x1="324" y1="195" x2="324" y2="198" stroke="#D88762" strokeWidth="1" />
                <line x1="338" y1="195" x2="338" y2="198" stroke="#D88762" strokeWidth="1" />
                <line x1="324" y1="220" x2="324" y2="223" stroke="#D88762" strokeWidth="1" />
                <line x1="338" y1="220" x2="338" y2="223" stroke="#D88762" strokeWidth="1" />

                {/* Node Metadata & Typography */}
                <text x="354" y="203" fontFamily="var(--font-geist-mono), monospace" fontSize="10.5" fill="#D88762" fontWeight="600" letterSpacing="0.12em">
                  API SERVICE · COORDINATION CORE
                </text>
                <text x="354" y="226" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="19" fontWeight="500" fill="#F1F0EC">
                  core-api
                </text>
                <text x="354" y="250" fontFamily="var(--font-sans), sans-serif" fontSize="12.5" fill="#A6AAA9">
                  Logic, authentication, routing & service coordination
                </text>

                {/* Right-aligned Protocol Info */}
                <text x="682" y="203" textAnchor="end" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#777D7D">
                  gRPC & REST · 8080
                </text>
                <circle cx="634" cy="223" r="2.5" fill="#83B69A" />
                <text x="642" y="226" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#83B69A">
                  Private Mesh
                </text>

                {/* Top Intake Node (Receives Ingress from Web) */}
                <circle cx="500" cy="180" r="4.5" fill="#121416" stroke="#D88762" strokeWidth="1.4" />
                <circle cx="500" cy="180" r="2" fill="#D88762" />

                {/* Bottom Left Branch Flange (To DB) */}
                <circle cx="400" cy="270" r="4" fill="#121416" stroke={selectedId === "db" || selectedId === "api" ? "#D88762" : "#343A3D"} strokeWidth="1.4" />
                <circle cx="400" cy="270" r="1.5" fill={selectedId === "db" || selectedId === "api" ? "#D88762" : "#343A3D"} />

                {/* Bottom Right Branch Flange (To Worker) */}
                <circle cx="600" cy="270" r="4" fill="#121416" stroke={selectedId === "worker" || selectedId === "api" ? "#D88762" : "#343A3D"} strokeWidth="1.4" />
                <circle cx="600" cy="270" r="1.5" fill={selectedId === "worker" || selectedId === "api" ? "#D88762" : "#343A3D"} />
              </g>

              {/* =========================================================
                  SERVICE NODE 3: DATABASE (Bottom Left Tier)
                  ========================================================= */}
              <g
                id="node-db"
                tabIndex={0}
                role="button"
                aria-pressed={selectedId === "db"}
                onClick={() => setSelectedId("db")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId("db");
                  }
                }}
                className="cursor-pointer focus:outline-none group"
              >
                {/* Node Framing */}
                <rect
                  x="100"
                  y="356"
                  width="320"
                  height="76"
                  rx="4"
                  fill="url(#node-base-fill)"
                  stroke={selectedId === "db" ? "#D88762" : "#2A2E31"}
                  strokeWidth={selectedId === "db" ? "1.6" : "1"}
                  className="transition-colors group-hover:stroke-[#454B50]"
                />

                {/* Line-Art Glyph: Relational Cylinder Stacks */}
                <ellipse cx="120" cy="375" rx="8" ry="3" stroke="#A6AAA9" strokeWidth="1.2" fill="none" />
                <path d="M 112,375 v 8 c 0 1.6 3.6 3 8 3 s 8 -1.4 8 -3 v -8" stroke="#A6AAA9" strokeWidth="1.2" fill="none" />
                <path d="M 112,379 v 4 c 0 1.6 3.6 3 8 3 s 8 -1.4 8 -3 v -4" stroke="#A6AAA9" strokeWidth="1" strokeDasharray="1.5 1.5" fill="none" />

                {/* Node Metadata & Typography */}
                <text x="140" y="376" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#A6AAA9" letterSpacing="0.1em">
                  DATABASE
                </text>
                <text x="140" y="396" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="17" fontWeight="500" fill="#F1F0EC">
                  primary-db
                </text>
                <text x="140" y="414" fontFamily="var(--font-sans), sans-serif" fontSize="12" fill="#777D7D">
                  Persistent application data
                </text>

                {/* Tech Metadata (Inline, No Pill Capsule) */}
                <text x="404" y="376" textAnchor="end" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#777D7D">
                  PostgreSQL 16
                </text>

                {/* Top Intake Node */}
                <circle cx="260" cy="356" r="4" fill="#121416" stroke={selectedId === "db" || selectedId === "api" ? "#D88762" : "#343A3D"} strokeWidth="1.4" />
                <circle cx="260" cy="356" r="1.5" fill={selectedId === "db" || selectedId === "api" ? "#D88762" : "#343A3D"} />
              </g>

              {/* =========================================================
                  SERVICE NODE 4: BACKGROUND WORKER (Bottom Right Tier)
                  ========================================================= */}
              <g
                id="node-worker"
                tabIndex={0}
                role="button"
                aria-pressed={selectedId === "worker"}
                onClick={() => setSelectedId("worker")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId("worker");
                  }
                }}
                className="cursor-pointer focus:outline-none group"
              >
                {/* Node Framing */}
                <rect
                  x="580"
                  y="356"
                  width="320"
                  height="76"
                  rx="4"
                  fill="url(#node-base-fill)"
                  stroke={selectedId === "worker" ? "#D88762" : "#2A2E31"}
                  strokeWidth={selectedId === "worker" ? "1.6" : "1"}
                  className="transition-colors group-hover:stroke-[#454B50]"
                />

                {/* Line-Art Glyph: Async Queue Processing Loop */}
                <path d="M 598,375 a 5 5 0 1 1 -2 4" stroke="#A6AAA9" strokeWidth="1.2" fill="none" />
                <polyline points="598,373 598,376 601,376" stroke="#A6AAA9" strokeWidth="1.2" fill="none" />
                <circle cx="601" cy="379" r="1.2" fill="#D88762" />

                {/* Node Metadata & Typography */}
                <text x="620" y="376" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#A6AAA9" letterSpacing="0.1em">
                  BACKGROUND WORKER
                </text>
                <text x="620" y="396" fontFamily="var(--font-space-grotesk), sans-serif" fontSize="17" fontWeight="500" fill="#F1F0EC">
                  queue-worker
                </text>
                <text x="620" y="414" fontFamily="var(--font-sans), sans-serif" fontSize="12" fill="#777D7D">
                  Tasks that run behind the scenes
                </text>

                {/* Tech Metadata (Inline, No Pill Capsule) */}
                <text x="884" y="376" textAnchor="end" fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#777D7D">
                  Async Jobs · Queue
                </text>

                {/* Top Intake Node */}
                <circle cx="740" cy="356" r="4" fill="#121416" stroke={selectedId === "worker" || selectedId === "api" ? "#D88762" : "#343A3D"} strokeWidth="1.4" />
                <circle cx="740" cy="356" r="1.5" fill={selectedId === "worker" || selectedId === "api" ? "#D88762" : "#343A3D"} />
              </g>

            </svg>
          </div>

          {/* -------------------------------------------------------------
              MOBILE / TABLET TOPOLOGY (Below lg)
              Clean, unboxed vertical flow with clear routing connections
              ------------------------------------------------------------- */}
          <div className="lg:hidden w-full max-w-xl mx-auto flex flex-col space-y-3">
            
            {/* 1. Web Frontend */}
            <button
              onClick={() => setSelectedId("web")}
              className={`w-full p-4.5 rounded-[6px] bg-[#16181B] border transition-all text-left ${
                selectedId === "web"
                  ? "border-accent-orange ring-1 ring-accent-orange/40"
                  : "border-border-default/80 hover:border-border-default"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] text-text-muted tracking-wider uppercase">
                  WEB FRONTEND
                </span>
                <span className="font-mono text-[10px] text-semantic-success flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                  HTTPS · 443
                </span>
              </div>
              <div className="font-sans text-[18px] font-medium text-[#F1F0EC]">
                web-frontend
              </div>
              <p className="font-sans text-[13px] text-text-secondary mt-0.5">
                The experience your users see
              </p>
            </button>

            {/* Vertical Connector: Ingress */}
            <div className="flex flex-col items-center py-1 select-none text-text-muted">
              <div className="w-[1.5px] h-4 bg-accent-orange" />
              <div className="font-mono text-[10px] text-accent-orange my-1 tracking-wider uppercase flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                <span>HTTPS INGRESS ROUTING</span>
                <ArrowDown className="w-3 h-3" />
              </div>
              <div className="w-[1.5px] h-4 bg-accent-orange" />
            </div>

            {/* 2. API Service (Coordinator) */}
            <button
              onClick={() => setSelectedId("api")}
              className={`w-full p-5 rounded-[6px] bg-[#1A1D20] border transition-all text-left ${
                selectedId === "api"
                  ? "border-accent-orange ring-1 ring-accent-orange/50"
                  : "border-[#343A3D] hover:border-accent-orange/50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10.5px] text-accent-orange font-medium tracking-wider uppercase">
                  API SERVICE · COORDINATOR
                </span>
                <span className="font-mono text-[10px] text-semantic-success flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                  Private Mesh
                </span>
              </div>
              <div className="font-sans text-[20px] font-medium text-[#F1F0EC]">
                core-api
              </div>
              <p className="font-sans text-[13px] text-text-secondary mt-0.5">
                Logic, authentication, routing & service coordination
              </p>
            </button>

            {/* Branch Connector */}
            <div className="flex flex-col items-center py-1 select-none text-text-muted">
              <div className="w-[1.5px] h-4 bg-border-default" />
              <div className="font-mono text-[10px] text-text-muted my-1 tracking-wider uppercase flex items-center gap-1">
                <span>INTERNAL SERVICE DISPATCH</span>
                <ArrowDown className="w-3 h-3" />
              </div>
              <div className="w-[1.5px] h-4 bg-border-default" />
            </div>

            {/* 3 & 4. Database & Background Worker */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              
              {/* Database */}
              <button
                onClick={() => setSelectedId("db")}
                className={`w-full p-4 rounded-[6px] bg-[#16181B] border transition-all text-left ${
                  selectedId === "db"
                    ? "border-accent-orange ring-1 ring-accent-orange/40"
                    : "border-border-default/80 hover:border-border-default"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] text-text-muted tracking-wider uppercase">
                    DATABASE
                  </span>
                  <span className="font-mono text-[10px] text-text-muted">Postgres</span>
                </div>
                <div className="font-sans text-[17px] font-medium text-[#F1F0EC]">
                  primary-db
                </div>
                <p className="font-sans text-[12.5px] text-text-secondary mt-0.5">
                  Persistent application data
                </p>
              </button>

              {/* Background Worker */}
              <button
                onClick={() => setSelectedId("worker")}
                className={`w-full p-4 rounded-[6px] bg-[#16181B] border transition-all text-left ${
                  selectedId === "worker"
                    ? "border-accent-orange ring-1 ring-accent-orange/40"
                    : "border-border-default/80 hover:border-border-default"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] text-text-muted tracking-wider uppercase">
                    WORKER
                  </span>
                  <span className="font-mono text-[10px] text-text-muted">Async Jobs</span>
                </div>
                <div className="font-sans text-[17px] font-medium text-[#F1F0EC]">
                  queue-worker
                </div>
                <p className="font-sans text-[12.5px] text-text-secondary mt-0.5">
                  Tasks that run behind the scenes
                </p>
              </button>

            </div>

          </div>

        </div>

        {/* =================================================================
            EDITORIAL COMPONENT INSPECTOR
            Two-column layout sitting naturally on the page (no enclosing card)
            ================================================================= */}
        <div className="w-full border-t border-border-subtle pt-8 sm:pt-10 mb-14 sm:mb-20">
          <div className="w-full flex flex-col md:flex-row md:items-start justify-between gap-6 sm:gap-8">
            
            {/* Left Column: Role & Explanatory Sentence */}
            <div className="space-y-2 max-w-xl">
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent-orange flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
                <span>INSPECTING COMPONENT // {current.category}</span>
              </div>
              <div className="font-sans text-[22px] sm:text-[24px] font-medium text-[#F1F0EC] tracking-[-0.02em]">
                {current.name}{" "}
                <span className="font-mono text-[13px] text-text-muted font-normal">
                  ({current.tag})
                </span>
              </div>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                {current.description}
              </p>
            </div>

            {/* Right Column: Runtime & Diagnostic Metadata */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10 shrink-0 self-start md:self-center font-mono text-[12px] pt-1">
              <div className="space-y-1">
                <div className="text-[10px] uppercase text-text-muted tracking-wider">
                  RUNTIME / ENGINE
                </div>
                <div className="text-[#F1F0EC]">{current.tech}</div>
              </div>
              
              <div className="space-y-1">
                <div className="text-[10px] uppercase text-text-muted tracking-wider">
                  PROTOCOL
                </div>
                <div className="text-text-secondary">{current.protocol}</div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] uppercase text-text-muted tracking-wider">
                  HEALTH STATUS
                </div>
                <div className="flex items-center gap-1.5 text-semantic-success font-medium">
                  <Check className="w-3.5 h-3.5 text-semantic-success" />
                  <span>{current.status}</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* =================================================================
            THREE BENEFIT DESCRIPTIONS
            Clean editorial columns beneath the architecture (no card boxes)
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
