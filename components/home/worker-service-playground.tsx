"use client";

import React, { useState, useEffect, useRef } from "react";

type WorkerStage =
  | "queue"      // 800ms: Job selected in queue (highlighted in burnt orange)
  | "dispatch"   // 900ms: Job packet travels smoothly along rail into Worker 02
  | "processing" // 1400ms: Worker 02 processes job, progress bar smoothly advances from 0% to 100%
  | "completion" // 1000ms: Job completes, accent turns sage green, exits to Completed area
  | "hold";      // 1800ms: Hold completed state for reading before advancing to next job

interface JobDefinition {
  id: string;
  name: string;
  tag: string;
  worker: string;
  description: string;
}

const JOBS_SEQUENCE: JobDefinition[] = [
  {
    id: "job_01",
    name: "optimize_assets",
    tag: "Brotli · Image assets",
    worker: "Worker 02",
    description: "Compressing release tarballs for edge CDN distribution.",
  },
  {
    id: "job_02",
    name: "send_webhook",
    tag: "HTTP · Event dispatch",
    worker: "Worker 02",
    description: "Delivering signed release.published payload to subscriber endpoint.",
  },
  {
    id: "job_03",
    name: "generate_manifest",
    tag: "SHA-256 · Checksums",
    worker: "Worker 02",
    description: "Computing build artifact integrity hashes for deploy verification.",
  },
  {
    id: "job_04",
    name: "purge_cache",
    tag: "Edge · Stale keys",
    worker: "Worker 02",
    description: "Invalidating cached static assets across global edge POPs.",
  },
];

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

export function WorkerServicePlayground() {
  const [jobIndex, setJobIndex] = useState(0);
  const [stage, setStage] = useState<WorkerStage>("queue");
  const [progress, setProgress] = useState(0);
  const [isInViewport, setIsInViewport] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const isReducedMotion = React.useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  // Pause animation when preview is outside viewport
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Coordinated animation state machine
  useEffect(() => {
    if (isReducedMotion || !isInViewport) {
      return;
    }

    let timeoutId: NodeJS.Timeout;

    switch (stage) {
      case "queue":
        timeoutId = setTimeout(() => setStage("dispatch"), 800);
        break;
      case "dispatch":
        timeoutId = setTimeout(() => setStage("processing"), 900);
        break;
      case "processing":
        // Animate progress smoothly from 0 to 100%
        timeoutId = setTimeout(() => {
          setProgress(100);
          setStage("completion");
        }, 1400);
        break;
      case "completion":
        timeoutId = setTimeout(() => setStage("hold"), 1000);
        break;
      case "hold":
        timeoutId = setTimeout(() => {
          setJobIndex((prev) => (prev + 1) % JOBS_SEQUENCE.length);
          setProgress(0);
          setStage("queue");
        }, 1800);
        break;
    }

    return () => clearTimeout(timeoutId);
  }, [stage, isReducedMotion, isInViewport]);

  // Smooth progress ticker during "processing" stage
  useEffect(() => {
    if (stage !== "processing" || isReducedMotion || !isInViewport) return;

    const startTime = Date.now();
    const duration = 1350;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const current = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(current);
      if (current >= 100) clearInterval(interval);
    }, 40);

    return () => clearInterval(interval);
  }, [stage, isReducedMotion, isInViewport]);

  const activeStage = isReducedMotion ? "completion" : stage;
  const currentJob = JOBS_SEQUENCE[jobIndex];
  const nextJob1 = JOBS_SEQUENCE[(jobIndex + 1) % JOBS_SEQUENCE.length];
  const nextJob2 = JOBS_SEQUENCE[(jobIndex + 2) % JOBS_SEQUENCE.length];

  // Stage flags
  const isQueued = activeStage === "queue";
  const isDispatching = activeStage === "dispatch";
  const isProcessing = activeStage === "processing";
  const isCompleted = activeStage === "completion" || activeStage === "hold";
  const isWorking = isProcessing || isCompleted;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col justify-between select-none overflow-hidden"
    >
      {/* =================================================================
          TOP STREAM STATUS: Concisely shows the active task context
          ================================================================= */}
      <div className="flex items-center justify-between gap-4 pb-1 text-text-muted text-[11px] font-mono shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[#A5A19A] font-medium">DISPATCH STREAM</span>
          <span className="text-[#303030]">·</span>
          <span className="text-[#77736D]">default (concurrency 3)</span>
        </div>

        {/* Minimal inline flow indicator */}
        <div className="flex items-center gap-2 text-[10.5px]">
          <span className="text-[#F0EEE9] font-medium">{currentJob.name}</span>
          <span className="text-[#77736D]">→</span>
          <span className={isWorking ? "text-[#E58A61] font-medium" : "text-[#A5A19A]"}>
            {currentJob.worker}
          </span>
          <span className="text-[#77736D]">→</span>
          <span
            className={`font-medium transition-colors duration-300 ${
              isCompleted
                ? "text-[#82B89D]"
                : isProcessing
                ? "text-[#E58A61]"
                : "text-[#77736D]"
            }`}
          >
            {isCompleted ? "Completed" : isProcessing ? `Processing ${progress}%` : "Queued"}
          </span>
        </div>
      </div>

      {/* =================================================================
          MAIN SVG ILLUSTRATION: A LIVING JOB QUEUE
          Three distinct functional areas:
          A. Job queue on left
          B. Multi-lane worker pool in center
          C. Completed jobs on right
          Connected by precise architectural dispatch and completion rails.
          ================================================================= */}
      <div className="flex-1 w-full min-h-0 my-1 relative flex items-center justify-center overflow-hidden">
        <svg
          viewBox="0 0 940 220"
          className="w-full h-full max-h-[265px] select-none"
          preserveAspectRatio="xMidYMid meet"
          aria-label="Background worker pool and job queue illustration"
        >
          {/* -------------------------------------------------------------
              AREA A: JOB QUEUE (Left Region, X: 15 to 235)
              Orderly queue of pending tasks awaiting worker dispatch.
              ------------------------------------------------------------- */}
          <g id="job-queue">
            <text
              x="20"
              y="16"
              fill="#77736D"
              fontSize="8.5"
              fontFamily="monospace"
              letterSpacing="0.08em"
            >
              JOB QUEUE (3 PENDING)
            </text>

            {/* Queue Outer Boundary */}
            <rect
              x="15"
              y="24"
              width="220"
              height="182"
              rx="4"
              fill="#151515"
              stroke="#262626"
              strokeWidth="1"
            />

            {/* Slot 0: Active / Next-up Task Capsule */}
            <rect
              x="25"
              y="34"
              width="200"
              height="50"
              rx="3"
              fill={isQueued || isDispatching ? "#1A1614" : "#111111"}
              stroke={isQueued || isDispatching ? "#E58A61" : "#222222"}
              strokeWidth={isQueued || isDispatching ? "1.2" : "1"}
              className="transition-all duration-300"
            />
            <text
              x="35"
              y="52"
              fill={isQueued || isDispatching ? "#F0EEE9" : "#A5A19A"}
              fontSize="9"
              fontFamily="monospace"
              fontWeight={isQueued || isDispatching ? "600" : "400"}
              className="transition-colors duration-300"
            >
              {currentJob.name}
            </text>
            <text
              x="35"
              y="68"
              fill={isQueued || isDispatching ? "#E58A61" : "#77736D"}
              fontSize="7.5"
              fontFamily="monospace"
              className="transition-colors duration-300"
            >
              {isDispatching ? "dispatching →" : isQueued ? "● next for dispatch" : "dispatched"}
            </text>
            <circle
              cx="215"
              cy="59"
              r="2.5"
              fill={isQueued || isDispatching ? "#E58A61" : "#303030"}
              className="transition-colors duration-300"
            />

            {/* Slot 1: Next Pending Job */}
            <rect
              x="25"
              y="94"
              width="200"
              height="50"
              rx="3"
              fill="#111111"
              stroke="#222222"
              strokeWidth="1"
            />
            <text
              x="35"
              y="112"
              fill="#A5A19A"
              fontSize="9"
              fontFamily="monospace"
            >
              {nextJob1.name}
            </text>
            <text
              x="35"
              y="128"
              fill="#77736D"
              fontSize="7.5"
              fontFamily="monospace"
            >
              {nextJob1.tag}
            </text>

            {/* Slot 2: Trailing Pending Job */}
            <rect
              x="25"
              y="148"
              width="200"
              height="48"
              rx="3"
              fill="#111111"
              stroke="#222222"
              strokeWidth="1"
            />
            <text
              x="35"
              y="166"
              fill="#A5A19A"
              fontSize="9"
              fontFamily="monospace"
            >
              {nextJob2.name}
            </text>
            <text
              x="35"
              y="182"
              fill="#77736D"
              fontSize="7.5"
              fontFamily="monospace"
            >
              {nextJob2.tag}
            </text>
          </g>

          {/* -------------------------------------------------------------
              DISPATCH CONDUIT (From Queue Slot 0 to Worker 02)
              ------------------------------------------------------------- */}
          <g id="dispatch-conduit">
            {/* Base guide rail */}
            <path
              d="M 235 59 H 280 V 115 H 330"
              fill="none"
              stroke="#262626"
              strokeWidth="1"
              strokeDasharray="2 2"
            />

            {/* Active dispatch trace */}
            <path
              d="M 235 59 H 280 V 115 H 330"
              fill="none"
              stroke="#E58A61"
              strokeWidth="1.2"
              style={{
                strokeDasharray: 180,
                strokeDashoffset: isDispatching || isWorking ? 0 : 180,
                transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />

            {/* Traveling Dispatch Packet */}
            {isDispatching && (
              <circle
                cx={280}
                cy={87}
                r="3.5"
                fill="#E58A61"
                className="animate-pulse"
              />
            )}
          </g>

          {/* -------------------------------------------------------------
              AREA B: WORKER POOL (Center Region, X: 330 to 655)
              Three differentiated concurrent processing lanes.
              Worker 02 actively processes the dispatched task.
              ------------------------------------------------------------- */}
          <g id="worker-pool">
            <text
              x="335"
              y="16"
              fill="#77736D"
              fontSize="8.5"
              fontFamily="monospace"
              letterSpacing="0.08em"
            >
              WORKER POOL (3 CONCURRENT)
            </text>

            {/* ---------------------------------------------------------
                LANE 1: Worker 01 (Idle / Standby)
                --------------------------------------------------------- */}
            <g id="worker-01">
              <rect
                x="330"
                y="24"
                width="325"
                height="52"
                rx="4"
                fill="#151515"
                stroke="#262626"
                strokeWidth="1"
              />
              {/* Lane Badge */}
              <rect
                x="330"
                y="24"
                width="80"
                height="52"
                fill="#181818"
                stroke="#262626"
                strokeWidth="1"
                rx="4"
              />
              <text
                x="340"
                y="46"
                fill="#A5A19A"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="500"
              >
                Worker 01
              </text>
              <text
                x="340"
                y="60"
                fill="#77736D"
                fontSize="7.5"
                fontFamily="monospace"
              >
                STANDBY
              </text>

              {/* Lane Content */}
              <text
                x="425"
                y="46"
                fill="#77736D"
                fontSize="8.5"
                fontFamily="monospace"
              >
                Idle · Awaiting task dispatch
              </text>
              <circle cx="635" cy="50" r="2.5" fill="#303030" />
            </g>

            {/* ---------------------------------------------------------
                LANE 2: Worker 02 (THE ACTIVE HERO PROCESSING WORKER!)
                Accepts task, runs progress bar, transitions to sage green on completion.
                --------------------------------------------------------- */}
            <g id="worker-02">
              <rect
                x="330"
                y="86"
                width="325"
                height="58"
                rx="4"
                fill={
                  isCompleted
                    ? "#131815"
                    : isProcessing
                    ? "#1A1614"
                    : "#151515"
                }
                stroke={
                  isCompleted
                    ? "#82B89D"
                    : isProcessing
                    ? "#E58A61"
                    : "#262626"
                }
                strokeWidth={isWorking ? "1.5" : "1"}
                className="transition-all duration-300"
              />

              {/* Lane Badge */}
              <rect
                x="330"
                y="86"
                width="80"
                height="58"
                fill="#181818"
                stroke="#262626"
                strokeWidth="1"
                rx="4"
              />
              <text
                x="340"
                y="110"
                fill={isWorking ? "#F0EEE9" : "#A5A19A"}
                fontSize="9"
                fontFamily="monospace"
                fontWeight={isWorking ? "600" : "500"}
                className="transition-colors duration-300"
              >
                Worker 02
              </text>
              <text
                x="340"
                y="126"
                fill={isCompleted ? "#82B89D" : isProcessing ? "#E58A61" : "#77736D"}
                fontSize="7.5"
                fontFamily="monospace"
                fontWeight="medium"
                className="transition-colors duration-300"
              >
                {isCompleted ? "DONE" : isProcessing ? "ACTIVE" : "READY"}
              </text>

              {/* Active Task Details */}
              <text
                x="425"
                y="106"
                fill={isWorking ? "#F0EEE9" : "#A5A19A"}
                fontSize="9.5"
                fontFamily="monospace"
                fontWeight="500"
                className="transition-colors duration-300"
              >
                {isWorking ? currentJob.name : "Awaiting dispatch"}
              </text>

              <text
                x="640"
                y="106"
                fill={isCompleted ? "#82B89D" : isProcessing ? "#E58A61" : "#77736D"}
                fontSize="8"
                fontFamily="monospace"
                textAnchor="end"
                fontWeight="medium"
              >
                {isCompleted
                  ? "✔ 100%"
                  : isProcessing
                  ? `${progress}%`
                  : "0%"}
              </text>

              {/* Smooth Progress Bar Rail */}
              <rect
                x="425"
                y="122"
                width="215"
                height="4"
                rx="2"
                fill="#222222"
              />
              <rect
                x="425"
                y="122"
                width={isWorking ? Math.max(4, (progress / 100) * 215) : 0}
                height="4"
                rx="2"
                fill={isCompleted ? "#82B89D" : "#E58A61"}
                className="transition-all duration-100 ease-out"
              />
            </g>

            {/* ---------------------------------------------------------
                LANE 3: Worker 03 (Standby / Ready)
                --------------------------------------------------------- */}
            <g id="worker-03">
              <rect
                x="330"
                y="154"
                width="325"
                height="52"
                rx="4"
                fill="#151515"
                stroke="#262626"
                strokeWidth="1"
              />
              <rect
                x="330"
                y="154"
                width="80"
                height="52"
                fill="#181818"
                stroke="#262626"
                strokeWidth="1"
                rx="4"
              />
              <text
                x="340"
                y="176"
                fill="#A5A19A"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="500"
              >
                Worker 03
              </text>
              <text
                x="340"
                y="190"
                fill="#77736D"
                fontSize="7.5"
                fontFamily="monospace"
              >
                READY
              </text>

              <text
                x="425"
                y="176"
                fill="#77736D"
                fontSize="8.5"
                fontFamily="monospace"
              >
                Available · Polling queue
              </text>
              <circle cx="635" cy="180" r="2.5" fill="#303030" />
            </g>
          </g>

          {/* -------------------------------------------------------------
              EXIT CONDUIT (From Worker 02 to Completed Area)
              ------------------------------------------------------------- */}
          <g id="exit-conduit">
            <path
              d="M 655 115 H 685 V 59 H 715"
              fill="none"
              stroke="#262626"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <path
              d="M 655 115 H 685 V 59 H 715"
              fill="none"
              stroke="#82B89D"
              strokeWidth="1.2"
              style={{
                strokeDasharray: 180,
                strokeDashoffset: isCompleted ? 0 : 180,
                transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </g>

          {/* -------------------------------------------------------------
              AREA C: COMPLETED JOBS (Right Region, X: 715 to 925)
              Compact completion area where finished tasks exit in sage green.
              ------------------------------------------------------------- */}
          <g id="completed-jobs">
            <text
              x="720"
              y="16"
              fill="#77736D"
              fontSize="8.5"
              fontFamily="monospace"
              letterSpacing="0.08em"
            >
              COMPLETED (DISPATCHED)
            </text>

            <rect
              x="715"
              y="24"
              width="210"
              height="182"
              rx="4"
              fill="#151515"
              stroke="#262626"
              strokeWidth="1"
            />

            {/* Slot 0: Latest Completed Task */}
            <rect
              x="725"
              y="34"
              width="190"
              height="50"
              rx="3"
              fill={isCompleted ? "#131815" : "#111111"}
              stroke={isCompleted ? "#82B89D" : "#222222"}
              strokeWidth={isCompleted ? "1.2" : "1"}
              className="transition-all duration-300"
            />
            <text
              x="735"
              y="52"
              fill={isCompleted ? "#F0EEE9" : "#A5A19A"}
              fontSize="9"
              fontFamily="monospace"
              fontWeight={isCompleted ? "600" : "400"}
              className="transition-colors duration-300"
            >
              {isCompleted ? currentJob.name : "compile_wasm"}
            </text>
            <text
              x="735"
              y="68"
              fill="#82B89D"
              fontSize="7.5"
              fontFamily="monospace"
              fontWeight="medium"
            >
              ✔ completed
            </text>

            {/* Slot 1: Previously Completed Task */}
            <rect
              x="725"
              y="94"
              width="190"
              height="50"
              rx="3"
              fill="#111111"
              stroke="#222222"
              strokeWidth="1"
            />
            <text
              x="735"
              y="112"
              fill="#A5A19A"
              fontSize="9"
              fontFamily="monospace"
            >
              broadcast_event
            </text>
            <text
              x="735"
              y="128"
              fill="#82B89D"
              fontSize="7.5"
              fontFamily="monospace"
            >
              ✔ completed
            </text>

            {/* Slot 2: Previously Completed Task */}
            <rect
              x="725"
              y="148"
              width="190"
              height="48"
              rx="3"
              fill="#111111"
              stroke="#222222"
              strokeWidth="1"
            />
            <text
              x="735"
              y="166"
              fill="#A5A19A"
              fontSize="9"
              fontFamily="monospace"
            >
              generate_sitemap
            </text>
            <text
              x="735"
              y="182"
              fill="#82B89D"
              fontSize="7.5"
              fontFamily="monospace"
            >
              ✔ completed
            </text>
          </g>
        </svg>
      </div>

      {/* =================================================================
          LOWER AREA: CONCISE EXECUTION SUMMARY
          Understated single-line pipeline lifecycle.
          No fake throughput graphs or fabricated latency numbers.
          ================================================================= */}
      <div className="pt-2 border-t border-[#262626] shrink-0 space-y-2">
        {/* Single-line Lifecycle */}
        <div className="flex items-center justify-between text-[11px] font-mono pb-1 border-b border-[#222222]">
          <div className="flex items-center gap-3 sm:gap-5">
            {/* Stage 1: Task Queued */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  isWorking
                    ? "bg-[#82B89D]"
                    : isQueued || isDispatching
                    ? "bg-[#E58A61]"
                    : "bg-[#303030]"
                }`}
              />
              <span
                className={`transition-colors duration-300 ${
                  isQueued || isDispatching ? "text-[#F0EEE9] font-medium" : "text-[#77736D]"
                }`}
              >
                Task queued
              </span>
            </div>

            <span className="text-[#303030] text-[10px]">→</span>

            {/* Stage 2: Dispatched & Processed */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  isCompleted
                    ? "bg-[#82B89D]"
                    : isProcessing
                    ? "bg-[#E58A61]"
                    : "bg-[#303030]"
                }`}
              />
              <span
                className={`transition-colors duration-300 ${
                  isProcessing ? "text-[#F0EEE9] font-medium" : "text-[#77736D]"
                }`}
              >
                Worker 02 processing
              </span>
            </div>

            <span className="text-[#303030] text-[10px]">→</span>

            {/* Stage 3: Job Completed */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  isCompleted ? "bg-[#82B89D]" : "bg-[#303030]"
                }`}
              />
              <span
                className={`transition-colors duration-300 ${
                  isCompleted ? "text-[#F0EEE9] font-medium" : "text-[#77736D]"
                }`}
              >
                Job completed
              </span>
            </div>
          </div>

          {/* Right Status */}
          <div className="hidden sm:flex items-center gap-2 text-[10.5px]">
            {isCompleted ? (
              <span className="text-[#82B89D] flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#82B89D]" />
                Task resolved
              </span>
            ) : isProcessing ? (
              <span className="text-[#E58A61] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E58A61] animate-pulse" />
                Active execution
              </span>
            ) : (
              <span className="text-[#77736D]">Worker ready</span>
            )}
          </div>
        </div>

        {/* Result: Concise Task Operation Confirmation */}
        <div className="w-full font-mono text-[12px] py-1.5 flex items-center justify-between">
          <div
            className={`flex items-center gap-2 sm:gap-2.5 transition-all duration-300 ${
              isCompleted ? "opacity-100" : "opacity-35"
            }`}
          >
            <span className="text-[#F0EEE9] font-medium tracking-tight">
              {currentJob.name}
            </span>
            <span className="text-[#77736D]">·</span>
            <span className="text-[#E58A61] font-medium">{currentJob.worker}</span>
            <span className="text-[#77736D]">·</span>
            <span className="text-[#82B89D] flex items-center gap-1.5 font-medium">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  isCompleted ? "bg-[#82B89D]" : "bg-[#303030]"
                }`}
              />
              Completed
            </span>
            <span className="text-[#77736D] hidden md:inline">·</span>
            <span className="text-[#A5A19A] text-[11px] hidden md:inline truncate max-w-sm">
              {currentJob.description}
            </span>
          </div>

          <div className="text-[10px] text-[#77736D] hidden sm:block">
            Automatic retry backoff
          </div>
        </div>
      </div>
    </div>
  );
}
