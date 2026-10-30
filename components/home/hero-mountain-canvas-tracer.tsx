"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePreloader } from "@/components/layout/preloader-context";

interface ContourLine {
  t: number;
  p: [number, number][];
}

/**
 * HeroMountainCanvasTracer
 *
 * Hardware-accelerated canvas plotter that physically draws the exact mathematical
 * topographic contours of Summit's signature engraved mountain from scratch in real time.
 * Coordinates are mapped to match the exact object-cover position (64% 50%) of the master hero image.
 */
export function HeroMountainCanvasTracer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { progress, phase, isComplete } = usePreloader();
  const [lines, setLines] = useState<ContourLine[] | null>(null);

  // Fetch pre-computed true elevation contour lines extracted from hero mountain
  useEffect(() => {
    let active = true;
    fetch("/images/hero/mountain-contour-lines.json")
      .then((res) => res.json())
      .then((data: ContourLine[]) => {
        if (active) {
          setLines(data);
        }
      })
      .catch((err) => {
        console.error("Failed to load mountain contour lines:", err);
      });
    return () => {
      active = false;
    };
  }, []);

  // Draw lines onto canvas synchronized with live progress (0 -> 100)
  useEffect(() => {
    if (!lines || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const cw = rect.width || 1440;
    const ch = rect.height || 800;

    // Viewport and Retina scaling
    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cw, ch);

    // If progress is at 0, canvas remains pitch black
    if (progress <= 1) {
      ctx.restore();
      return;
    }

    // Object-cover coordinate mapping matching hero image: object-[64%_50%]
    const baseW = 1440;
    const baseH = 800;
    const scale = Math.max(cw / baseW, ch / baseH);
    const offsetX = (cw - baseW * scale) * 0.64;
    const offsetY = (ch - baseH * scale) * 0.5;

    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Glow settings for luminous pen tracing
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw lines across the 8 elevation tiers
    for (let i = 0; i < lines.length; i++) {
      const { t, p } = lines[i];

      // Stagger start of drawing according to elevation tier
      // Tier 0,1 (High Peaks): start at progress 2%
      // Tier 2,3 (High arêtes): start at progress 10%
      // Tier 4,5 (Saddle): start at progress 22%
      // Tier 6,7 (Valleys): start at progress 35%
      const startPct = t <= 1 ? 2 : t <= 3 ? 10 : t <= 5 ? 22 : 35;
      const endPct = Math.min(85, startPct + 48);

      if (progress < startPct) continue;

      const lineFrac = Math.min(1, (progress - startPct) / (endPct - startPct));
      const ptCount = Math.max(2, Math.floor(p.length * lineFrac));

      // Color and line styling based on elevation
      if (t <= 1) {
        ctx.strokeStyle = "rgba(250, 248, 245, 0.95)"; // Pure Ivory for Highest Peaks
        ctx.lineWidth = 1.4;
        ctx.shadowColor = "rgba(250, 248, 245, 0.55)";
        ctx.shadowBlur = 3;
      } else if (t <= 3) {
        ctx.strokeStyle = "rgba(229, 227, 222, 0.85)"; // Warm Slate for Arêtes
        ctx.lineWidth = 1.15;
        ctx.shadowColor = "rgba(229, 227, 222, 0.35)";
        ctx.shadowBlur = 2;
      } else if (t <= 5) {
        ctx.strokeStyle = "rgba(216, 135, 98, 0.8)"; // Burnt Orange for Mid Pass Saddle
        ctx.lineWidth = 1.05;
        ctx.shadowColor = "rgba(216, 135, 98, 0.45)";
        ctx.shadowBlur = 2;
      } else {
        ctx.strokeStyle = "rgba(142, 140, 134, 0.65)"; // Charcoal for Foothills
        ctx.lineWidth = 0.9;
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      for (let j = 1; j < ptCount; j++) {
        ctx.lineTo(p[j][0], p[j][1]);
      }
      ctx.stroke();

      // Draw a luminous tracer spark at the pen head of major lines
      if (lineFrac > 0.05 && lineFrac < 0.98 && ptCount > 3 && i % 3 === 0) {
        const headPt = p[ptCount - 1];
        ctx.fillStyle = t <= 2 ? "#FFFFFF" : "#FFA67E";
        ctx.shadowColor = "#D88762";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(headPt[0], headPt[1], 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }, [lines, progress]);

  // Fade out canvas smoothly as the full illustration takes over in Stage 3/4
  const opacity =
    isComplete
      ? 0
      : phase === "revealing"
      ? 0.35
      : 1;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10 transition-opacity duration-700 ease-out"
      style={{
        opacity,
      }}
      aria-hidden="true"
    />
  );
}
