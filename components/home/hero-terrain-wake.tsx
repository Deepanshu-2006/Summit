"use client";

import React, { useEffect, useRef } from "react";

interface HeroTerrainWakeProps {
  isInView?: boolean;
  isReducedMotion?: boolean;
}

interface WakePoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  time: number;
}

/**
 * HeroTerrainWake
 *
 * Signature Terrain Wake:
 * - As the pointer moves across the engraved landscape, it creates a flowing wake
 *   of delicate, topographic strands along its recent trajectory.
 * - Composed of thin warm-ivory strands and restrained burnt-orange accents.
 * - Smoothly interpolated organic curve using Catmull-Rom splines.
 * - Decays naturally and dissipates completely when the cursor stops or leaves.
 * - No cursor light, no spotlight, no parallax, and no distortion of the background artwork.
 */
export function HeroTerrainWake({
  isInView = true,
  isReducedMotion = false,
}: HeroTerrainWakeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const wakeHistoryRef = useRef<WakePoint[]>([]);
  const lastMouseRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    };

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(canvas);

    // Pointer move listener on hero
    const onMouseMove = (e: MouseEvent) => {
      if (isReducedMotion) return;
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(pointer: coarse)").matches
      ) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;

      const now = performance.now();
      const last = lastMouseRef.current;

      if (last) {
        const dt = (now - last.time) / 1000;
        if (dt > 0.006) {
          const dx = x - last.x;
          const dy = y - last.y;
          const speed = Math.hypot(dx, dy) / dt;
          const vx = dx / dt;
          const vy = dy / dt;

          wakeHistoryRef.current.push({
            x,
            y,
            vx,
            vy,
            speed,
            time: now,
          });

          // Keep bounded wake history (max 32 samples)
          if (wakeHistoryRef.current.length > 32) {
            wakeHistoryRef.current.shift();
          }

          lastMouseRef.current = { x, y, time: now };
        }
      } else {
        lastMouseRef.current = { x, y, time: now };
      }
    };

    const onMouseLeave = () => {
      lastMouseRef.current = null;
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave);

    // Render loop
    const render = (timestamp: number) => {
      if (!ctx || width === 0 || height === 0) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const now = timestamp;
      const wake = wakeHistoryRef.current;

      // Clean up points older than 600ms
      while (wake.length > 0 && now - wake[0].time > 600) {
        wake.shift();
      }

      // Clear canvas
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      // Render flowing terrain wake strands
      if (!isReducedMotion && wake.length >= 2) {
        // Catmull-Rom spline interpolation through recent path
        const trailPoints: {
          x: number;
          y: number;
          life: number;
          nx: number;
          ny: number;
        }[] = [];

        for (let i = 0; i < wake.length - 1; i++) {
          const p0 = i > 0 ? wake[i - 1] : wake[i];
          const p1 = wake[i];
          const p2 = wake[i + 1];
          const p3 = i < wake.length - 2 ? wake[i + 2] : p2;

          const steps = 7;
          for (let s = 0; s < steps; s++) {
            const t = s / steps;
            const t2 = t * t;
            const t3 = t2 * t;

            const qx =
              0.5 *
              (2 * p1.x +
                (-p0.x + p2.x) * t +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
            const qy =
              0.5 *
              (2 * p1.y +
                (-p0.y + p2.y) * t +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

            const interpTime = p1.time + (p2.time - p1.time) * t;
            const ageSec = (now - interpTime) / 1000;
            const life = Math.max(0, 1 - ageSec / 0.55);

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;

            trailPoints.push({ x: qx, y: qy, life, nx, ny });
          }
        }

        const validTrail = trailPoints.filter((pt) => pt.life > 0.02);

        if (validTrail.length >= 2) {
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          // Strand 1: Main Center Topographic Strand (Warm Ivory)
          for (let i = 0; i < validTrail.length - 1; i++) {
            const pt1 = validTrail[i];
            const pt2 = validTrail[i + 1];
            const avgLife = (pt1.life + pt2.life) * 0.5;

            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.strokeStyle = `rgba(247, 244, 238, ${avgLife * 0.65})`;
            ctx.lineWidth = 1.15;
            ctx.stroke();
          }

          // Strand 2: Left Companion Strand (Feathered Ivory / Dashed)
          ctx.setLineDash([5, 8]);
          for (let i = 0; i < validTrail.length - 1; i++) {
            const pt1 = validTrail[i];
            const pt2 = validTrail[i + 1];
            const avgLife = (pt1.life + pt2.life) * 0.5;
            const off = -4.5 * avgLife;

            ctx.beginPath();
            ctx.moveTo(pt1.x + pt1.nx * off, pt1.y + pt1.ny * off);
            ctx.lineTo(pt2.x + pt2.nx * off, pt2.y + pt2.ny * off);
            ctx.strokeStyle = `rgba(235, 230, 222, ${avgLife * 0.45})`;
            ctx.lineWidth = 0.85;
            ctx.stroke();
          }

          // Strand 3: Right Companion Strand (Subtle Graphite)
          ctx.setLineDash([4, 7]);
          for (let i = 0; i < validTrail.length - 1; i++) {
            const pt1 = validTrail[i];
            const pt2 = validTrail[i + 1];
            const avgLife = (pt1.life + pt2.life) * 0.5;
            const off = 5.0 * avgLife;

            ctx.beginPath();
            ctx.moveTo(pt1.x + pt1.nx * off, pt1.y + pt1.ny * off);
            ctx.lineTo(pt2.x + pt2.nx * off, pt2.y + pt2.ny * off);
            ctx.strokeStyle = `rgba(180, 175, 168, ${avgLife * 0.4})`;
            ctx.lineWidth = 0.85;
            ctx.stroke();
          }

          // Strand 4: Restrained Burnt-Orange Dawn Accent Strand
          ctx.setLineDash([3, 10]);
          for (let i = 0; i < validTrail.length - 1; i++) {
            const pt1 = validTrail[i];
            const pt2 = validTrail[i + 1];
            const avgLife = (pt1.life + pt2.life) * 0.5;
            const off = 8.5 * avgLife;

            ctx.beginPath();
            ctx.moveTo(pt1.x + pt1.nx * off, pt1.y + pt1.ny * off);
            ctx.lineTo(pt2.x + pt2.nx * off, pt2.y + pt2.ny * off);
            ctx.strokeStyle = `rgba(216, 135, 98, ${avgLife * 0.32})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }

          ctx.restore();
        }
      }

      if (isReducedMotion) return;

      if (isInView) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    if (isInView) {
      animFrameRef.current = requestAnimationFrame(render);
    }

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      resizeObserver.disconnect();
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isInView, isReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-[2]"
      aria-hidden="true"
    />
  );
}

export default HeroTerrainWake;
