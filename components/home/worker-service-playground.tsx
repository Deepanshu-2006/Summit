"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";

type ConveyorStage =
  | "arrival"    // 1000ms: Active task marker approaches station along curved path, label visible
  | "pickup"     // 850ms: Station accepts task, marker moves into central docking chamber
  | "processing" // 1700ms: Rotor mechanism turns, progress arc advances 0% → 100%
  | "release"    // 900ms: Accent transitions to sage green, task exits along outgoing path
  | "hold";      // 1600ms: Hold completed state visible before advancing to next task

interface Job {
  name: string;
}

const JOBS: Job[] = [
  { name: "optimize_assets" },
  { name: "send_webhook" },
  { name: "generate_manifest" },
  { name: "purge_cache" },
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

/**
 * Calculates the Y coordinate on the continuous curved conveyor track for a given X coordinate.
 * Uses a smooth cubic Hermite spline:
 * - Incoming (X: 80 → 480): curves gently from Y: 130 to Y: 160 with horizontal tangents at both ends
 * - Outgoing (X: 480 → 880): curves gently from Y: 160 to Y: 190 with horizontal tangents at both ends
 */
function getTrackY(x: number): number {
  if (x <= 480) {
    const t = Math.max(0, Math.min(1, (x - 80) / 400));
    return 130 + 30 * (3 * t * t - 2 * t * t * t);
  } else {
    const t = Math.max(0, Math.min(1, (x - 480) / 400));
    return 160 + 30 * (3 * t * t - 2 * t * t * t);
  }
}

export function WorkerServicePlayground() {
  const [jobIndex, setJobIndex] = useState(0);
  const [stage, setStage] = useState<ConveyorStage>("arrival");
  const [progress, setProgress] = useState(0);
  const [isInViewport, setIsInViewport] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  // Pause animations when section is scrolled out of viewport
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

  // Coordinated conveyor state machine: Arrival → Pickup → Processing → Release → Hold
  useEffect(() => {
    if (isReducedMotion || !isInViewport) {
      return;
    }

    let timeoutId: NodeJS.Timeout;

    switch (stage) {
      case "arrival":
        timeoutId = setTimeout(() => setStage("pickup"), 1000);
        break;
      case "pickup":
        timeoutId = setTimeout(() => setStage("processing"), 850);
        break;
      case "processing":
        timeoutId = setTimeout(() => {
          setProgress(100);
          setStage("release");
        }, 1700);
        break;
      case "release":
        timeoutId = setTimeout(() => setStage("hold"), 900);
        break;
      case "hold":
        timeoutId = setTimeout(() => {
          setJobIndex((prev) => (prev + 1) % JOBS.length);
          setProgress(0);
          setStage("arrival");
        }, 1600);
        break;
    }

    return () => clearTimeout(timeoutId);
  }, [stage, isReducedMotion, isInViewport]);

  // Smooth progress ticker during active processing (0% → 100%)
  useEffect(() => {
    if (stage !== "processing" || isReducedMotion || !isInViewport) return;

    const startTime = Date.now();
    const duration = 1600;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const current = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(current);
      if (current >= 100) clearInterval(interval);
    }, 30);

    return () => clearInterval(interval);
  }, [stage, isReducedMotion, isInViewport]);

  const activeStage = isReducedMotion ? "hold" : stage;
  const currentJob = JOBS[jobIndex];

  // Stage flags
  const isArrival = activeStage === "arrival";
  const isPickup = activeStage === "pickup";
  const isProcessing = activeStage === "processing";
  const isRelease = activeStage === "release";
  const isHold = activeStage === "hold";
  const isCompleted = isRelease || isHold;

  // Active marker coordinates along the continuous curved track
  // - Arrival: approaching station at X = 320
  // - Pickup & Processing: docked in central chamber at X = 480, Y = 160
  // - Release & Hold: traveling out to completed lane at X = 670
  let markerX = 320;
  if (isPickup || isProcessing) {
    markerX = 480;
  } else if (isRelease || isHold) {
    markerX = 670;
  }
  const markerY = getTrackY(markerX);

  // Progress arc circumference for radius 50px: 2 * PI * 50 ≈ 314.16px
  const arcCircumference = 314.16;
  const arcOffset =
    isProcessing
      ? arcCircumference - (progress / 100) * arcCircumference
      : isCompleted
      ? 0
      : arcCircumference;

  // Rotor mechanism rotation (turns 90° during processing, 180° upon release)
  const rotorAngle = isProcessing ? 90 : isCompleted ? 180 : 0;

  // Track sleeper cross-ties positions
  const incomingTicks = [100, 130, 160, 190, 220, 250, 280, 310, 340, 370, 400];
  const outgoingTicks = [560, 590, 620, 650, 680, 710, 740, 770, 800, 830, 860];

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col justify-center items-center select-none overflow-hidden"
    >
      {/* =================================================================
          CONTINUOUS TASK CONVEYOR & PROCESSING STATION
          - No cards, no 3 columns, no dashboard tables
          - One continuous curved conveyor: Incoming → Processing Station → Completed
          - Clean visual hierarchy: Central Station > Active Marker > Track > Label
          ================================================================= */}
      <div className="w-full h-full max-h-[380px] sm:max-h-[410px] relative flex items-center justify-center">
        <svg
          viewBox="0 0 960 320"
          className="w-full h-full select-none"
          preserveAspectRatio="xMidYMid meet"
          aria-label="Background worker conveyor and processing station illustration"
        >
          <defs>
            {/* Subtle linear glow gradient for active progress arc */}
            <linearGradient id="worker-active-glow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E58A61" />
              <stop offset="100%" stopColor="#D47348" />
            </linearGradient>
            <linearGradient id="worker-success-glow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#82B89D" />
              <stop offset="100%" stopColor="#6AA487" />
            </linearGradient>
          </defs>

          {/* -------------------------------------------------------------
              1. CONTINUOUS GENTLY CURVED CONVEYOR RAILS & CROSS-TIES
              Dual-rail conveyor track with sleeper cross-ties following the Hermite curve
              ------------------------------------------------------------- */}
          <g id="conveyor-structure">
            {/* Sleeper cross-ties on incoming track */}
            {incomingTicks.map((tickX) => {
              const tickY = getTrackY(tickX);
              return (
                <line
                  key={`in-tick-${tickX}`}
                  x1={tickX}
                  y1={tickY - 9}
                  x2={tickX}
                  y2={tickY + 9}
                  stroke="#1E1E1E"
                  strokeWidth="1"
                />
              );
            })}

            {/* Sleeper cross-ties on outgoing track */}
            {outgoingTicks.map((tickX) => {
              const tickY = getTrackY(tickX);
              return (
                <line
                  key={`out-tick-${tickX}`}
                  x1={tickX}
                  y1={tickY - 9}
                  x2={tickX}
                  y2={tickY + 9}
                  stroke="#1E1E1E"
                  strokeWidth="1"
                />
              );
            })}

            {/* Incoming Dual Rails (entering station outer perimeter at X = 410) */}
            {/* Upper Rail */}
            <path
              d="M 80,122 C 240,122 350,152 410,152"
              fill="none"
              stroke="#262626"
              strokeWidth="1.2"
            />
            {/* Lower Rail */}
            <path
              d="M 80,138 C 240,138 350,168 410,168"
              fill="none"
              stroke="#262626"
              strokeWidth="1.2"
            />

            {/* Outgoing Dual Rails (exiting station outer perimeter at X = 550) */}
            {/* Upper Rail */}
            <path
              d="M 550,152 C 610,152 720,182 880,182"
              fill="none"
              stroke="#262626"
              strokeWidth="1.2"
            />
            {/* Lower Rail */}
            <path
              d="M 550,168 C 610,168 720,198 880,198"
              fill="none"
              stroke="#262626"
              strokeWidth="1.2"
            />

            {/* Center Guide Trace Line (neutral unless task is moving) */}
            <path
              d="M 80,130 C 240,130 350,160 410,160"
              fill="none"
              stroke={isArrival || isPickup ? "#E58A61" : "#1F1F1F"}
              strokeWidth="1"
              strokeDasharray={isArrival || isPickup ? "none" : "3 3"}
              className="transition-colors duration-400"
            />
            <path
              d="M 550,160 C 610,160 720,190 880,190"
              fill="none"
              stroke={isCompleted ? "#82B89D" : "#1F1F1F"}
              strokeWidth="1"
              strokeDasharray={isCompleted ? "none" : "3 3"}
              className="transition-colors duration-400"
            />
          </g>

          {/* -------------------------------------------------------------
              2. INCOMING TASK MARKERS (Left Stream)
              Small, quiet markers waiting on the conveyor. No cards.
              ------------------------------------------------------------- */}
          <g id="incoming-queue">
            {/* Marker 3 (Furthest queue item, hidden on very narrow screens) */}
            <g className="hidden sm:inline">
              <rect
                x="114"
                y={getTrackY(130) - 7}
                width="32"
                height="14"
                rx="7"
                fill="#141414"
                stroke="#242424"
                strokeWidth="1"
              />
              <circle cx="130" cy={getTrackY(130)} r="2" fill="#303030" />
            </g>

            {/* Marker 2 (Second in queue) */}
            <g>
              <rect
                x="184"
                y={getTrackY(200) - 7}
                width="32"
                height="14"
                rx="7"
                fill="#141414"
                stroke="#242424"
                strokeWidth="1"
              />
              <circle cx="200" cy={getTrackY(200)} r="2" fill="#303030" />
            </g>
          </g>

          {/* -------------------------------------------------------------
              3. COMPLETED TASK MARKERS (Right Stream)
              Subtle sage-green completed task markers on outgoing track.
              ------------------------------------------------------------- */}
          <g id="completed-queue">
            {/* Completed Marker C1 */}
            <g>
              <rect
                x="754"
                y={getTrackY(770) - 7}
                width="32"
                height="14"
                rx="7"
                fill="#131815"
                stroke="#223326"
                strokeWidth="1"
              />
              <circle cx="770" cy={getTrackY(770)} r="2" fill="#4B7759" />
            </g>

            {/* Completed Marker C2 (furthest completed item, hidden on mobile) */}
            <g className="hidden sm:inline">
              <rect
                x="824"
                y={getTrackY(840) - 7}
                width="32"
                height="14"
                rx="7"
                fill="#131815"
                stroke="#223326"
                strokeWidth="1"
              />
              <circle cx="840" cy={getTrackY(840)} r="2" fill="#4B7759" />
            </g>
          </g>

          {/* -------------------------------------------------------------
              4. CENTRAL PROCESSING STATION (Hero Visual Focal Point)
              Center: X = 480, Y = 160.
              Engineered orbital infrastructure: precision ticks, progress arc,
              docking notch gates, caliper rotor, and central chamber.
              ------------------------------------------------------------- */}
          <g id="processing-station">
            {/* Outer Precision Housing Ring (r = 70) */}
            <circle
              cx="480"
              cy="160"
              r="70"
              fill="#151515"
              stroke="#282828"
              strokeWidth="1"
            />

            {/* Precision Vernier Radial Ticks (24 ticks around circumference) */}
            {Array.from({ length: 24 }).map((_, i) => {
              const deg = i * 15;
              const isMajor = deg % 90 === 0;
              const rad = (deg * Math.PI) / 180;
              const innerR = isMajor ? 63 : 66;
              const x1 = 480 + Math.cos(rad) * innerR;
              const y1 = 160 + Math.sin(rad) * innerR;
              const x2 = 480 + Math.cos(rad) * 70;
              const y2 = 160 + Math.sin(rad) * 70;
              return (
                <line
                  key={`station-tick-${deg}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isMajor ? "#3A3A3A" : "#282828"}
                  strokeWidth="1"
                />
              );
            })}

            {/* Inner Concentric Guide Ring (r = 60) */}
            <circle
              cx="480"
              cy="160"
              r="60"
              fill="none"
              stroke="#1C1C1C"
              strokeWidth="1"
            />

            {/* Progress Arc Guide Track (r = 50) */}
            <circle
              cx="480"
              cy="160"
              r="50"
              fill="none"
              stroke="#202020"
              strokeWidth="2.5"
            />

            {/* Restrained Active Progress Arc (r = 50) */}
            <circle
              cx="480"
              cy="160"
              r="50"
              fill="none"
              stroke={isCompleted ? "url(#worker-success-glow)" : "url(#worker-active-glow)"}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={arcCircumference}
              strokeDashoffset={arcOffset}
              transform="rotate(-90 480 160)"
              className="transition-all duration-100 ease-out"
            />

            {/* Internal Caliper Rotor Mechanism (Rotates during processing) */}
            <g
              transform={`rotate(${rotorAngle} 480 160)`}
              style={{
                transition: "transform 1.4s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {/* Concentric rotor rim (r = 32) */}
              <circle
                cx="480"
                cy="160"
                r="32"
                fill="none"
                stroke="#222222"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              {/* Horizontal Crosshair Caliper */}
              <line
                x1="448"
                y1="160"
                x2="512"
                y2="160"
                stroke="#2B2B2B"
                strokeWidth="1"
              />
              {/* Vertical Crosshair Caliper */}
              <line
                x1="480"
                y1="128"
                x2="480"
                y2="192"
                stroke="#2B2B2B"
                strokeWidth="1"
              />
              {/* Caliper End Pins */}
              <circle cx="448" cy="160" r="1.5" fill="#3A3A3A" />
              <circle cx="512" cy="160" r="1.5" fill="#3A3A3A" />
              <circle cx="480" cy="128" r="1.5" fill="#3A3A3A" />
              <circle cx="480" cy="192" r="1.5" fill="#3A3A3A" />
            </g>

            {/* Central Docking Chamber (r = 20) */}
            <circle
              cx="480"
              cy="160"
              r="20"
              fill={
                isCompleted
                  ? "#121714"
                  : isProcessing || isPickup
                  ? "#181412"
                  : "#111111"
              }
              stroke={
                isCompleted
                  ? "#82B89D"
                  : isProcessing
                  ? "#E58A61"
                  : "#262626"
              }
              strokeWidth={isProcessing || isCompleted ? "1.5" : "1"}
              className="transition-colors duration-300"
            />

            {/* Docking Gate Entrance/Exit Notches */}
            <line x1="408" y1="160" x2="416" y2="160" stroke="#363636" strokeWidth="2" />
            <line x1="544" y1="160" x2="552" y2="160" stroke="#363636" strokeWidth="2" />
          </g>

          {/* -------------------------------------------------------------
              5. ACTIVE MOVING TASK MARKER & GEIST MONO LABEL
              Visibly travels along the curved conveyor: Arrival → Pickup → Release
              ------------------------------------------------------------- */}
          <g
            id="active-task-unit"
            style={{
              transform: `translate(${markerX}px, ${markerY}px)`,
              transition:
                isPickup || isRelease
                  ? "transform 0.85s cubic-bezier(0.4, 0, 0.2, 1)"
                  : "none",
            }}
          >
            {/* Active Task Capsule (-17 to +17, -8 to +8) */}
            <rect
              x="-17"
              y="-8"
              width="34"
              height="16"
              rx="8"
              fill={
                isCompleted
                  ? "#131815"
                  : isProcessing || isPickup || isArrival
                  ? "#191512"
                  : "#111111"
              }
              stroke={
                isCompleted
                  ? "#82B89D"
                  : isProcessing || isPickup || isArrival
                  ? "#E58A61"
                  : "#303030"
              }
              strokeWidth={isProcessing || isCompleted ? "1.5" : "1.2"}
              className="transition-colors duration-300"
            />

            {/* Center Core Dot */}
            <circle
              cx="0"
              cy="0"
              r="2.5"
              fill={isCompleted ? "#82B89D" : "#E58A61"}
              className="transition-colors duration-300"
            />

            {/* Attached Geist Mono Job Label (hovering above the active marker) */}
            <g
              transform="translate(0, -18)"
              className="transition-opacity duration-300"
              style={{ opacity: isHold && !isReducedMotion ? 0.75 : 1 }}
            >
              <text
                x="0"
                y="0"
                fill="#F0EEE9"
                fontSize="11"
                fontFamily="var(--font-geist-mono), monospace"
                fontWeight="500"
                textAnchor="middle"
                letterSpacing="0.02em"
              >
                {currentJob.name}
              </text>
            </g>

            {/* Status confirmation below marker during processing & completion */}
            <g
              transform="translate(0, 22)"
              className="transition-opacity duration-300"
            >
              <text
                x="0"
                y="0"
                fill={
                  isCompleted
                    ? "#82B89D"
                    : isProcessing
                    ? "#E58A61"
                    : "#A5A19A"
                }
                fontSize="9"
                fontFamily="var(--font-geist-mono), monospace"
                textAnchor="middle"
                letterSpacing="0.02em"
                className="transition-colors duration-300"
              >
                {isCompleted
                  ? "completed"
                  : isProcessing
                  ? `processing ${progress}%`
                  : ""}
              </text>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
