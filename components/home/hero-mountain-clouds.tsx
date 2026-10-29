"use client";

import React, { useEffect, useRef } from "react";

interface HeroMountainCloudsProps {
  isInView?: boolean;
  isReducedMotion?: boolean;
}

interface Puff {
  u: number; // -0.5 to 0.5 along spine
  offsetY: number;
  rx: number;
  ry: number;
  density: number;
  wobblePhase: number;
  wobbleSpeed: number;
  wobbleAmp: number;
}

interface Filament {
  yOffset: number;
  uStart: number;
  uEnd: number;
  curveAmp: number;
  alphaFactor: number;
}

interface CloudFormation {
  id: number;
  corridorIdx: number;
  layer: "distant" | "valley" | "foreground";
  x: number;
  speed: number;
  length: number;
  height: number;
  baseAlpha: number;
  warmthWeight: number;
  puffs: Puff[];
  filaments: Filament[];
}

export function HeroMountainClouds({
  isInView = true,
  isReducedMotion = false,
}: HeroMountainCloudsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const formationsRef = useRef<CloudFormation[]>([]);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    // Valley Corridor Spline Functions (Normalized coordinates)
    const getCorridorY = (corridorIdx: number, nx: number, H: number): number => {
      switch (corridorIdx) {
        case 0:
          // Layer A — Distant Saddle / High Mountain Pass (subtle, high between peaks)
          return H * (0.42 - 0.05 * Math.sin(nx * Math.PI) + 0.02 * (nx - 0.5));
        case 1:
          // Layer B — Upper Valley Channel (sweeps from mid-left ridge pass through center)
          return (
            H *
            (0.50 -
              0.045 * Math.sin(nx * Math.PI * 1.2) +
              0.03 * Math.cos(nx * Math.PI * 0.75))
          );
        case 2:
          // Layer B — Main Central Valley & Ravine (primary sweeping valley drift)
          return (
            H *
            (0.57 +
              0.045 * Math.sin((nx - 0.2) * Math.PI * 1.15) -
              0.035 * Math.cos((nx - 0.4) * Math.PI * 0.85))
          );
        case 3:
          // Layer B — Mid-Lower Saddle (flows across the base of the middle crags)
          return (
            H *
            (0.64 -
              0.035 * Math.sin(nx * Math.PI * 0.95) +
              0.02 * Math.sin(nx * Math.PI * 2.2))
          );
        case 4:
        default:
          // Layer C — Foreground Lower Slope Mist (gentle broad drift over lower foothills)
          return H * (0.75 + 0.035 * Math.sin(nx * Math.PI * 0.8));
      }
    };

    // Helper to generate an organic, elongated cloud formation
    const createFormation = (
      id: number,
      corridorIdx: number,
      initialX: number,
      W: number,
      H: number
    ): CloudFormation => {
      let layer: "distant" | "valley" | "foreground";
      let speedRange: [number, number];
      let lengthRange: [number, number];
      let heightRange: [number, number];
      let alphaRange: [number, number];
      let warmthProbability: number;

      if (corridorIdx === 0) {
        // Layer A: Distant mist
        layer = "distant";
        speedRange = [18, 24];
        lengthRange = [380, 520];
        heightRange = [38, 52];
        alphaRange = [0.18, 0.26];
        warmthProbability = 0.2;
      } else if (corridorIdx === 4) {
        // Layer C: Foreground mist
        layer = "foreground";
        speedRange = [24, 30];
        lengthRange = [560, 780];
        heightRange = [75, 110];
        alphaRange = [0.14, 0.22];
        warmthProbability = 0.35;
      } else {
        // Layer B: Main valley clouds (Primary animated layer, clearly visible)
        layer = "valley";
        speedRange = [38, 48];
        lengthRange = [480, 680];
        heightRange = [55, 90];
        alphaRange = [0.30, 0.44];
        warmthProbability = 0.45;
      }

      const speed =
        speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
      const length =
        lengthRange[0] + Math.random() * (lengthRange[1] - lengthRange[0]);
      const fHeight =
        heightRange[0] + Math.random() * (heightRange[1] - heightRange[0]);
      const baseAlpha =
        alphaRange[0] + Math.random() * (alphaRange[1] - alphaRange[0]);
      const warmthWeight = Math.random() < warmthProbability ? 0.6 : 0.0;

      // Generate 10 to 14 overlapping puffs along the spine
      const numPuffs = 10 + Math.floor(Math.random() * 4);
      const puffs: Puff[] = [];

      for (let i = 0; i < numPuffs; i++) {
        // u from -0.5 to 0.5
        const u = (i - (numPuffs - 1) / 2) / ((numPuffs - 1) / 2 || 1);
        // Cosine envelope to taper ends smoothly
        const taper = Math.pow(Math.cos(u * Math.PI * 0.46), 1.15);

        // Elongated horizontal ratio (3:1 to 5:1)
        const rx =
          (length / numPuffs) * 1.85 * taper * (0.85 + Math.random() * 0.35);
        const ry = (fHeight * 0.44) * taper * (0.85 + Math.random() * 0.35);
        const offsetY = (Math.random() - 0.5) * fHeight * 0.28;

        puffs.push({
          u: u * 0.48, // scale along spine
          offsetY,
          rx: Math.max(rx, 25),
          ry: Math.max(ry, 12),
          density: taper * (0.85 + Math.random() * 0.35),
          wobblePhase: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.35 + Math.random() * 0.4,
          wobbleAmp: 3.0 + Math.random() * 4.0,
        });
      }

      // Generate 2 to 3 internal delicate flowing filaments (etched mist lines)
      const numFilaments = 2 + Math.floor(Math.random() * 2);
      const filaments: Filament[] = [];
      for (let f = 0; f < numFilaments; f++) {
        filaments.push({
          yOffset: (Math.random() - 0.5) * fHeight * 0.35,
          uStart: -0.42 + Math.random() * 0.15,
          uEnd: 0.25 + Math.random() * 0.2,
          curveAmp: (Math.random() - 0.5) * 16,
          alphaFactor: 0.15 + Math.random() * 0.15,
        });
      }

      return {
        id,
        corridorIdx,
        layer,
        x: initialX,
        speed,
        length,
        height: fHeight,
        baseAlpha,
        warmthWeight,
        puffs,
        filaments,
      };
    };

    // Initialize formations staggered across the full width and beyond
    const initFormations = (W: number, H: number) => {
      const formations: CloudFormation[] = [];
      let idCounter = 0;

      // Corridor assignments:
      // Corridor 0 (Layer A - Distant): 3 formations
      // Corridor 1 (Layer B - Upper Valley): 4 formations
      // Corridor 2 (Layer B - Main Ravine): 4 formations
      // Corridor 3 (Layer B - Lower Saddle): 3 formations
      // Corridor 4 (Layer C - Foreground): 3 formations
      const setup = [
        { corridor: 0, count: 3 },
        { corridor: 1, count: 4 },
        { corridor: 2, count: 4 },
        { corridor: 3, count: 3 },
        { corridor: 4, count: 3 },
      ];

      setup.forEach(({ corridor, count }) => {
        for (let i = 0; i < count; i++) {
          // Stagger across the entire width + margins so clouds are active immediately
          const initialX =
            -200 + (i / count) * (W + 500) + (Math.random() - 0.5) * 120;
          formations.push(
            createFormation(idCounter++, corridor, initialX, W, H)
          );
        }
      });

      formationsRef.current = formations;
    };

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      // Re-initialize formations if empty or on major size change
      if (formationsRef.current.length === 0) {
        initFormations(width, height);
      }
    };

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(canvas);

    // Render loop
    const render = (timestamp: number) => {
      if (!ctx || width === 0 || height === 0) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      const timeSec = timestamp / 1000;

      // Clear canvas
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const formations = formationsRef.current;

      // Update positions and draw
      for (let i = 0; i < formations.length; i++) {
        const f = formations[i];

        if (!isReducedMotion) {
          f.x += f.speed * dt;
          // Wrap around seamlessly with slight randomization
          if (f.x - f.length * 0.6 > width + 100) {
            f.x = -f.length * 0.6 - 40 - Math.random() * 140;
            // Slightly mutate speed and warmth for natural organic variation
            f.speed = Math.max(16, f.speed + (Math.random() - 0.5) * 4);
          }
        }

        const nx = f.x / width;
        const cy = getCorridorY(f.corridorIdx, nx, height);

        // Viewport entrance & exit feathering
        let fade = 1.0;
        const headX = f.x + f.length * 0.5;
        const tailX = f.x - f.length * 0.5;

        if (tailX < 120) {
          fade = Math.max(0, Math.min(1, (headX + 50) / (170 + f.length * 0.5)));
        } else if (headX > width - 150) {
          fade = Math.max(0, Math.min(1, (width + f.length * 0.5 - tailX) / (250 + f.length * 0.5)));
        }

        // Over-ridge modulation:
        // Where clouds cross dark valleys (nx ~ 0.15 - 0.65), opacity is at full richness.
        // Where they cross bright mountain faces on the right (nx ~ 0.72 - 0.95),
        // gently scale opacity down ~25% so the engraved linework remains crisp and readable!
        let cragMod = 1.0;
        if (nx > 0.70 && nx < 0.95) {
          cragMod = 0.75 + 0.25 * Math.cos(((nx - 0.70) / 0.25) * Math.PI);
        }

        const effectiveAlpha = f.baseAlpha * fade * cragMod;
        if (effectiveAlpha <= 0.005) continue;

        // Draw individual organic puffs
        for (let j = 0; j < f.puffs.length; j++) {
          const p = f.puffs[j];
          const wobbleY = isReducedMotion
            ? 0
            : Math.sin(timeSec * p.wobbleSpeed + p.wobblePhase) * p.wobbleAmp;
          const wobbleX = isReducedMotion
            ? 0
            : Math.cos(timeSec * p.wobbleSpeed * 0.7 + p.wobblePhase) *
              (p.wobbleAmp * 0.4);

          const px = f.x + p.u * f.length + wobbleX;
          const py = cy + p.offsetY + wobbleY;

          const puffAlpha = effectiveAlpha * p.density;
          if (puffAlpha <= 0.005) continue;

          ctx.save();
          ctx.translate(px, py);
          ctx.scale(1, p.ry / p.rx);

          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.rx);

          // Warm Ivory & Graphite Tonal Palette
          if (f.warmthWeight > 0.4) {
            // Subtle dawn ember warmth stop
            grad.addColorStop(0.0, `rgba(247, 244, 238, ${puffAlpha * 0.95})`);
            grad.addColorStop(0.3, `rgba(235, 215, 200, ${puffAlpha * 0.72})`);
            grad.addColorStop(0.65, `rgba(165, 155, 145, ${puffAlpha * 0.32})`);
            grad.addColorStop(1.0, "rgba(20, 20, 20, 0)");
          } else {
            // Classic antique engraved warm ivory & muted graphite
            grad.addColorStop(0.0, `rgba(245, 243, 238, ${puffAlpha * 0.95})`);
            grad.addColorStop(0.32, `rgba(225, 222, 215, ${puffAlpha * 0.70})`);
            grad.addColorStop(0.68, `rgba(142, 140, 134, ${puffAlpha * 0.30})`);
            grad.addColorStop(1.0, "rgba(20, 20, 20, 0)");
          }

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, p.rx, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Draw delicate etched filaments (matching mountain engraving lines)
        for (let k = 0; k < f.filaments.length; k++) {
          const fil = f.filaments[k];
          const filAlpha = effectiveAlpha * fil.alphaFactor;
          if (filAlpha <= 0.01) continue;

          const startX = f.x + fil.uStart * f.length;
          const endX = f.x + fil.uEnd * f.length;
          const midX = (startX + endX) / 2;
          const filY = cy + fil.yOffset;
          const cY = filY + fil.curveAmp;

          ctx.strokeStyle = `rgba(242, 240, 235, ${filAlpha})`;
          ctx.lineWidth = 0.85;
          ctx.beginPath();
          ctx.moveTo(startX, filY);
          ctx.quadraticCurveTo(midX, cY, endX, filY);
          ctx.stroke();
        }
      }

      // If reduced motion is requested, render once and do not continue animation
      if (isReducedMotion) {
        return;
      }

      // Continue animation if in view
      if (isInView) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    if (isInView) {
      animFrameRef.current = requestAnimationFrame(render);
    }

    return () => {
      resizeObserver.disconnect();
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isInView, isReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-[1]"
      style={{
        mixBlendMode: "screen",
      }}
      aria-hidden="true"
    />
  );
}

export default HeroMountainClouds;
