"use client";

import React, { useEffect, useRef } from "react";

interface HeroMountainCloudsProps {
  isInView?: boolean;
  isReducedMotion?: boolean;
}

interface Puff {
  u: number; // -0.5 to 0.5 along formation spine
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
  isAccent?: boolean;
}

interface CloudFormation {
  id: number;
  corridorIdx: number;
  layer: "background" | "midground" | "foreground";
  x: number;
  speed: number;
  length: number;
  height: number;
  baseAlpha: number;
  warmthWeight: number;
  breathPhase: number;
  breathSpeed: number;
  puffs: Puff[];
  filaments: Filament[];
}

/**
 * HeroMountainClouds
 *
 * Multi-layer atmospheric mountain mist adhering to Summit's engraved copperplate aesthetic:
 *
 * 1. Background Haze (Distant Peaks):
 *    - Very gentle, high-elevation haze drifting across the distant peaks (y ~ 0.22 to 0.40).
 *    - Wide, soft translucent horizontal bands creating atmospheric depth without cursor parallax.
 *    - Ultra-slow drift speed: ~10 to 14 px/s.
 *
 * 2. Midground Valley Formations (Mountain Passes & Saddles):
 *    - Drifting laterally through the mountain saddles and passes (y ~ 0.46 to 0.65).
 *    - Composed of translucent stratified cloud bodies with internal etched linework.
 *    - Natural density breathing and soft ridge interaction.
 *    - Medium drift speed: ~18 to 26 px/s.
 *
 * 3. Foreground Mist (Wispy Strands):
 *    - Thin, elongated wispy strands traveling across the lower ravines and ridge crests (y ~ 0.68 to 0.82).
 *    - Delicate tapered bezier threads that softly reveal and conceal parts of the engraved terrain.
 *    - Faster drift speed: ~28 to 36 px/s.
 *
 * 4. Continuous, Seamless Loop:
 *    - Smooth wrapping with cosine boundary feathering; zero pop, reset, or flash.
 *    - DPR scaling, paused when out of view, static for prefers-reduced-motion.
 */
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

    // Valley corridor elevation curves across normalized width (0 to 1)
    const getCorridorY = (corridorIdx: number, nx: number, H: number): number => {
      switch (corridorIdx) {
        case 0:
          // Background Layer: High Mountain Ridge Haze (around distant peaks)
          return H * (0.28 - 0.04 * Math.sin(nx * Math.PI) + 0.02 * (nx - 0.5));
        case 1:
          // Background Layer: Distant Saddle Haze
          return H * (0.38 - 0.035 * Math.sin(nx * Math.PI * 1.1) + 0.02 * Math.cos(nx * Math.PI * 0.8));
        case 2:
          // Midground Layer: Upper Mountain Pass (sweeps from mid-left through center saddle)
          return (
            H *
            (0.50 -
              0.045 * Math.sin(nx * Math.PI * 1.15) +
              0.025 * Math.cos(nx * Math.PI * 0.75))
          );
        case 3:
          // Midground Layer: Central Ravine & Ridge Channel (primary sweeping valley drift)
          return (
            H *
            (0.58 +
              0.04 * Math.sin((nx - 0.2) * Math.PI * 1.2) -
              0.03 * Math.cos((nx - 0.4) * Math.PI * 0.9))
          );
        case 4:
          // Foreground Layer: Lower Valley Slopes & Ravine (wispy strands)
          return (
            H *
            (0.68 -
              0.035 * Math.sin(nx * Math.PI * 0.95) +
              0.02 * Math.sin(nx * Math.PI * 2.1))
          );
        case 5:
        default:
          // Foreground Layer: Low Foothill Mist Strands
          return H * (0.78 + 0.03 * Math.sin(nx * Math.PI * 0.85));
      }
    };

    // Helper to generate a tailored cloud formation for a specific layer
    const createFormation = (
      id: number,
      corridorIdx: number,
      initialX: number
    ): CloudFormation => {
      let layer: "background" | "midground" | "foreground";
      let speedRange: [number, number];
      let lengthRange: [number, number];
      let heightRange: [number, number];
      let alphaRange: [number, number];
      let warmthProbability: number;

      if (corridorIdx <= 1) {
        // Layer 1: Background Peak Haze
        layer = "background";
        speedRange = [10, 14];
        lengthRange = [580, 840];
        heightRange = [44, 68];
        alphaRange = [0.12, 0.18];
        warmthProbability = 0.2;
      } else if (corridorIdx >= 4) {
        // Layer 3: Foreground Wispy Mist Strands
        layer = "foreground";
        speedRange = [28, 36];
        lengthRange = [380, 620];
        heightRange = [22, 42];
        alphaRange = [0.16, 0.26];
        warmthProbability = 0.4;
      } else {
        // Layer 2: Midground Valley Formations (Primary visible formations)
        layer = "midground";
        speedRange = [18, 25];
        lengthRange = [480, 720];
        heightRange = [52, 85];
        alphaRange = [0.24, 0.38];
        warmthProbability = 0.5;
      }

      const speed = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
      const length = lengthRange[0] + Math.random() * (lengthRange[1] - lengthRange[0]);
      const fHeight = heightRange[0] + Math.random() * (heightRange[1] - heightRange[0]);
      const baseAlpha = alphaRange[0] + Math.random() * (alphaRange[1] - alphaRange[0]);
      const warmthWeight = Math.random() < warmthProbability ? 0.6 : 0.0;
      const breathPhase = Math.random() * Math.PI * 2;
      const breathSpeed = 0.2 + Math.random() * 0.25;

      // Density puffs along formation spine
      const numPuffs = layer === "foreground" ? 8 : layer === "background" ? 10 : 13;
      const puffs: Puff[] = [];

      for (let i = 0; i < numPuffs; i++) {
        const u = (i - (numPuffs - 1) / 2) / ((numPuffs - 1) / 2 || 1);
        const taper = Math.pow(Math.cos(u * Math.PI * 0.46), 1.15);

        // Highly elongated horizontal ratio (4:1 to 7:1) for stratified mountain mist
        const rx = (length / numPuffs) * (layer === "foreground" ? 2.2 : 1.9) * taper * (0.85 + Math.random() * 0.3);
        const ry = (fHeight * 0.42) * taper * (0.85 + Math.random() * 0.3);
        const offsetY = (Math.random() - 0.5) * fHeight * (layer === "foreground" ? 0.2 : 0.28);

        puffs.push({
          u: u * 0.48,
          offsetY,
          rx: Math.max(rx, 20),
          ry: Math.max(ry, layer === "foreground" ? 8 : 12),
          density: taper * (0.85 + Math.random() * 0.3),
          wobblePhase: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.3 + Math.random() * 0.35,
          wobbleAmp: layer === "foreground" ? 2.0 : 3.5,
        });
      }

      // Delicate etched filaments matching copperplate mountain lines
      const numFilaments = layer === "foreground" ? 3 : layer === "midground" ? 3 : 2;
      const filaments: Filament[] = [];
      for (let f = 0; f < numFilaments; f++) {
        filaments.push({
          yOffset: (Math.random() - 0.5) * fHeight * 0.32,
          uStart: -0.42 + Math.random() * 0.15,
          uEnd: 0.28 + Math.random() * 0.18,
          curveAmp: (Math.random() - 0.5) * 14,
          alphaFactor: layer === "foreground" ? 0.25 : 0.18,
          isAccent: Math.random() < 0.3,
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
        breathPhase,
        breathSpeed,
        puffs,
        filaments,
      };
    };

    // Initialize formations distributed across full width + margins
    const initFormations = (W: number) => {
      const formations: CloudFormation[] = [];
      let idCounter = 0;

      // Corridors configuration:
      // 0 & 1: Background Peak Haze (2 + 2 = 4 formations)
      // 2 & 3: Midground Valley Channels (4 + 4 = 8 formations)
      // 4 & 5: Foreground Wispy Strands (3 + 3 = 6 formations)
      const setup = [
        { corridor: 0, count: 2 },
        { corridor: 1, count: 2 },
        { corridor: 2, count: 4 },
        { corridor: 3, count: 4 },
        { corridor: 4, count: 3 },
        { corridor: 5, count: 3 },
      ];

      setup.forEach(({ corridor, count }) => {
        for (let i = 0; i < count; i++) {
          const initialX =
            -250 + (i / count) * (W + 550) + (Math.random() - 0.5) * 140;
          formations.push(createFormation(idCounter++, corridor, initialX));
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

      if (formationsRef.current.length === 0) {
        initFormations(width);
      }
    };

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(canvas);

    // Continuous Animation Loop
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

      for (let i = 0; i < formations.length; i++) {
        const f = formations[i];

        if (!isReducedMotion) {
          f.x += f.speed * dt;
          // Continuous seamless wrap: when tail exits right side, cycle to left buffer
          if (f.x - f.length * 0.6 > width + 120) {
            f.x = -f.length * 0.6 - 50 - Math.random() * 120;
            f.speed = Math.max(12, f.speed + (Math.random() - 0.5) * 3);
          }
        }

        const nx = f.x / width;
        const cy = getCorridorY(f.corridorIdx, nx, height);

        // Viewport entrance & exit cosine feathering (eliminates popping)
        let edgeFade = 1.0;
        const headX = f.x + f.length * 0.5;
        const tailX = f.x - f.length * 0.5;

        if (tailX < 140) {
          edgeFade = Math.max(0, Math.min(1, (headX + 40) / (180 + f.length * 0.5)));
        } else if (headX > width - 140) {
          edgeFade = Math.max(0, Math.min(1, (width + f.length * 0.5 - tailX) / (220 + f.length * 0.5)));
        }

        // Over-ridge modulation:
        // When crossing dark valleys (nx ~ 0.15 - 0.65), full mist opacity.
        // When crossing bright mountain peaks on the right (nx ~ 0.72 - 0.95),
        // gently reduce opacity ~25% so engraved peak details stay sharp and crisp!
        let cragMod = 1.0;
        if (nx > 0.70 && nx < 0.95) {
          cragMod = 0.75 + 0.25 * Math.cos(((nx - 0.70) / 0.25) * Math.PI);
        }

        // Headline zone attenuation:
        // Softly reduce mist opacity directly behind the headline (nx < 0.38)
        // so mist never competes with or washes out text contrast.
        let headlineMod = 1.0;
        if (nx < 0.38) {
          headlineMod = 0.52 + 0.48 * Math.max(0, nx / 0.38);
        }

        // Density breathing modulation
        const breath = isReducedMotion
          ? 1.0
          : 0.9 + 0.1 * Math.sin(timeSec * f.breathSpeed + f.breathPhase);

        const effectiveAlpha = f.baseAlpha * edgeFade * cragMod * headlineMod * breath;
        if (effectiveAlpha <= 0.005) continue;

        // Draw stratified mist puffs along spine
        for (let j = 0; j < f.puffs.length; j++) {
          const p = f.puffs[j];
          const wobbleY = isReducedMotion
            ? 0
            : Math.sin(timeSec * p.wobbleSpeed + p.wobblePhase) * p.wobbleAmp;
          const wobbleX = isReducedMotion
            ? 0
            : Math.cos(timeSec * p.wobbleSpeed * 0.7 + p.wobblePhase) * (p.wobbleAmp * 0.35);

          const px = f.x + p.u * f.length + wobbleX;
          const py = cy + p.offsetY + wobbleY;

          const puffAlpha = effectiveAlpha * p.density;
          if (puffAlpha <= 0.005) continue;

          ctx.save();
          ctx.translate(px, py);
          ctx.scale(1, p.ry / p.rx);

          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.rx);

          if (f.warmthWeight > 0.4) {
            // Subtle warm dawn undertone stop
            grad.addColorStop(0.0, `rgba(247, 244, 238, ${puffAlpha * 0.92})`);
            grad.addColorStop(0.3, `rgba(235, 215, 202, ${puffAlpha * 0.68})`);
            grad.addColorStop(0.65, `rgba(165, 155, 145, ${puffAlpha * 0.28})`);
            grad.addColorStop(1.0, "rgba(17, 17, 17, 0)");
          } else {
            // Antique engraved warm ivory & muted graphite
            grad.addColorStop(0.0, `rgba(245, 243, 238, ${puffAlpha * 0.92})`);
            grad.addColorStop(0.32, `rgba(225, 222, 215, ${puffAlpha * 0.66})`);
            grad.addColorStop(0.68, `rgba(142, 140, 134, ${puffAlpha * 0.28})`);
            grad.addColorStop(1.0, "rgba(17, 17, 17, 0)");
          }

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, p.rx, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Draw delicate etched filaments (engraved mist lines)
        for (let k = 0; k < f.filaments.length; k++) {
          const fil = f.filaments[k];
          const filAlpha = effectiveAlpha * fil.alphaFactor;
          if (filAlpha <= 0.008) continue;

          const startX = f.x + fil.uStart * f.length;
          const endX = f.x + fil.uEnd * f.length;
          const midX = (startX + endX) / 2;
          const filY = cy + fil.yOffset;
          const cY = filY + fil.curveAmp;

          ctx.strokeStyle = fil.isAccent
            ? `rgba(216, 135, 98, ${filAlpha * 0.85})`
            : `rgba(242, 240, 235, ${filAlpha})`;
          ctx.lineWidth = f.layer === "foreground" ? 0.95 : 0.75;
          ctx.beginPath();
          ctx.moveTo(startX, filY);
          ctx.quadraticCurveTo(midX, cY, endX, filY);
          ctx.stroke();
        }
      }

      // If reduced motion is active, do not request further frames
      if (isReducedMotion) {
        return;
      }

      // Continue animation when in view
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