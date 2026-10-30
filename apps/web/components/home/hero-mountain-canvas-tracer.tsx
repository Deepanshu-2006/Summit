"use client";

import React, { useEffect, useRef } from "react";
import { usePreloader } from "@/components/layout/preloader-context";

interface ContourLine {
  t: number;
  p: [number, number][];
}

// Module-level cache so contour data loads once across navigation/reloads
let cachedContourLines: ContourLine[] | null = null;
let fetchPromise: Promise<ContourLine[]> | null = null;

function loadContourData(): Promise<ContourLine[]> {
  if (cachedContourLines) {
    return Promise.resolve(cachedContourLines);
  }
  if (!fetchPromise) {
    fetchPromise = fetch("/images/hero/mountain-contour-lines.json")
      .then((res) => res.json())
      .then((data: ContourLine[]) => {
        cachedContourLines = data;
        return data;
      })
      .catch((err) => {
        console.error("Failed to load mountain contour lines:", err);
        return [];
      });
  }
  return fetchPromise;
}

/**
 * HeroMountainCanvasTracer
 *
 * Hardware-accelerated canvas plotter that physically draws the exact mathematical
 * topographic contours of Summit's signature engraved mountain from scratch in real time.
 *
 * Features:
 * - 60Hz / 120Hz continuous fractional line interpolation (no vertex stepping).
 * - Exact responsive coordinate mapping matching object-[64%_50%] of the master hero image.
 * - Luminous pen-head sparks gliding along the active ridges.
 * - Seamless alpha crossfade as the full master mountain illustration gains depth and substance.
 */
export function HeroMountainCanvasTracer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { subscribeProgress, isComplete } = usePreloader();

  useEffect(() => {
    let active = true;
    let lines: ContourLine[] | null = cachedContourLines;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Load contour data if not yet cached
    if (!lines) {
      loadContourData().then((data) => {
        if (active) {
          lines = data;
        }
      });
    }

    // Render frame for a given progressFloat (0.00 to 100.00)
    const renderFrame = (curProgressFloat: number) => {
      if (!canvas || !ctx) return;

      const rect = canvas.getBoundingClientRect();
      const cw = rect.width || 1440;
      const ch = rect.height || 800;
      const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

      // Update canvas buffer size if dimensions or DPR changed
      const targetW = Math.round(cw * dpr);
      const targetH = Math.round(ch * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cw, ch);

      // Canvas remains pitch black at start, clears when complete
      if (curProgressFloat <= 0.5 || curProgressFloat >= 98 || !lines || lines.length === 0) {
        ctx.restore();
        return;
      }

      // Smooth fade-out crossfade as the copperplate engraving fills the scene (72% -> 96%)
      const crossfadeAlpha =
        curProgressFloat < 72
          ? 1.0
          : Math.max(0, 1.0 - (curProgressFloat - 72) / 24.0);

      ctx.globalAlpha = crossfadeAlpha;

      // Coordinate mapping matching exact responsive CSS object-cover:
      // Desktop: object-[64%_50%], Tablet: object-[68%_52%], Mobile: object-[70%_52%]
      const baseW = 1440;
      const baseH = 800;
      const scale = Math.max(cw / baseW, ch / baseH);

      let posX = 0.64;
      let posY = 0.50;
      if (cw < 640) {
        posX = 0.70;
        posY = 0.52;
      } else if (cw < 1024) {
        posX = 0.68;
        posY = 0.52;
      }

      const offsetX = (cw - baseW * scale) * posX;
      const offsetY = (ch - baseH * scale) * posY;

      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Collect active pen-head sparks to draw after line strokes
      const sparks: { x: number; y: number; isPeak: boolean }[] = [];

      // Draw all 280 mathematical contour lines across 8 elevation tiers
      for (let i = 0; i < lines.length; i++) {
        const { t, p } = lines[i];
        if (p.length < 2) continue;

        // Progressive stagger by elevation tier:
        // Tier 0, 1 (Highest peaks): 2% -> 65%
        // Tier 2, 3 (High arêtes & ridges): 8% -> 74%
        // Tier 4, 5 (Center pass saddle): 18% -> 82%
        // Tier 6, 7 (Valleys & foothills): 28% -> 90%
        let startPct = 28;
        let endPct = 90;
        if (t <= 1) {
          startPct = 2;
          endPct = 65;
        } else if (t <= 3) {
          startPct = 8;
          endPct = 74;
        } else if (t <= 5) {
          startPct = 18;
          endPct = 82;
        }

        if (curProgressFloat < startPct) continue;

        const lineFrac = Math.min(1.0, (curProgressFloat - startPct) / (endPct - startPct));
        const maxSegments = p.length - 1;
        const exactSegment = lineFrac * maxSegments;
        const wholeSegments = Math.floor(exactSegment);
        const subFraction = exactSegment - wholeSegments;

        // Styling based on elevation hierarchy
        if (t <= 1) {
          ctx.strokeStyle = "rgba(250, 248, 245, 0.95)"; // Pure Ivory
          ctx.lineWidth = 1.45;
          ctx.shadowColor = "rgba(250, 248, 245, 0.50)";
          ctx.shadowBlur = 3;
        } else if (t <= 3) {
          ctx.strokeStyle = "rgba(229, 227, 222, 0.85)"; // Warm Slate
          ctx.lineWidth = 1.15;
          ctx.shadowColor = "rgba(229, 227, 222, 0.30)";
          ctx.shadowBlur = 2;
        } else if (t <= 5) {
          ctx.strokeStyle = "rgba(216, 135, 98, 0.80)"; // Burnt Orange
          ctx.lineWidth = 1.05;
          ctx.shadowColor = "rgba(216, 135, 98, 0.40)";
          ctx.shadowBlur = 2;
        } else {
          ctx.strokeStyle = "rgba(142, 140, 134, 0.65)"; // Charcoal
          ctx.lineWidth = 0.85;
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.moveTo(p[0][0], p[0][1]);
        for (let j = 1; j <= wholeSegments; j++) {
          ctx.lineTo(p[j][0], p[j][1]);
        }

        let headX = p[wholeSegments][0];
        let headY = p[wholeSegments][1];

        // Buttery fractional sub-segment interpolation for liquid 120fps motion
        if (subFraction > 0.001 && wholeSegments < maxSegments) {
          const pA = p[wholeSegments];
          const pB = p[wholeSegments + 1];
          headX = pA[0] + (pB[0] - pA[0]) * subFraction;
          headY = pA[1] + (pB[1] - pA[1]) * subFraction;
          ctx.lineTo(headX, headY);
        }

        ctx.stroke();

        // Capture pen-head spark position for major active lines
        if (lineFrac > 0.04 && lineFrac < 0.97 && i % 3 === 0) {
          sparks.push({ x: headX, y: headY, isPeak: t <= 2 });
        }
      }

      // Draw luminous pen-head tracer sparks
      for (let s = 0; s < sparks.length; s++) {
        const spark = sparks[s];
        ctx.fillStyle = spark.isPeak ? "#FFFFFF" : "#FFA67E";
        ctx.shadowColor = spark.isPeak ? "rgba(255, 255, 255, 0.8)" : "#D88762";
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    // Subscribe to high-frequency RAF animation loop
    const unsubscribe = subscribeProgress((_intPct, floatPct) => {
      renderFrame(floatPct);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [subscribeProgress]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10 block will-change-transform"
      style={{
        transform: "translate3d(0, 0, 0)",
        backfaceVisibility: "hidden",
      }}
      aria-hidden="true"
    />
  );
}
