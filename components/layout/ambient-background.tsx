"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useLenis } from "@/components/layout/smooth-scroll-provider";

type ParticleKind = "micro" | "small" | "accent";
type ColorType = "ivory" | "graphite" | "orange" | "green";

interface Particle {
  baseX: number; // Normalized horizontal position [0, 1]
  baseY: number; // Normalized vertical position [0, 1]
  z: number; // Depth factor: 0.25 (distant/slow) to 1.0 (foreground)
  kind: ParticleKind;
  colorType: ColorType;
  radius: number; // Rendered point radius in px
  baseAlpha: number;
  phase: number;
  driftSpeed: number;
}

// Deterministic PRNG (Lehmer LCG) for stable, art-directed distribution
function createPrng(seed = 19720429) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * AmbientBackground
 *
 * Recreates the ambient particle aesthetic from the Lenis reference,
 * fully integrated into Jetway's design system:
 *
 * 1. Palette:
 *    - Monochromatic foundation: warm ivory (#F2F0EB) and muted graphite (#8E8C86) for ~80% of points.
 *    - Soft burnt-orange (#D88762) highlights for a small minority (~16%).
 *    - Subtle sage-green (#83B69A) accents for rare points (~4%).
 * 2. Three Restrained Size Tiers:
 *    - Micro (~68%): tiny, barely visible textural points (0.55px–0.85px).
 *    - Small (~24%): slightly brighter depth points (0.95px–1.35px).
 *    - Accent (~8%): rare focal points (1.45px–1.85px) with soft halos.
 * 3. Spatial Distribution:
 *    - Generous negative space with irregular, art-directed density.
 *    - Crisp points with subtle, tight halos — zero heavy bloom or large blurry orbs.
 * 4. Atmosphere:
 *    - Almost imperceptible lower-viewport warm underglow blending naturally into #111111.
 * 5. Motion & Lenis Parallax:
 *    - Organic micro-drift and gentle breathing twinkle.
 *    - Subtly ascends on scroll with depth parallax (distant slower, foreground faster).
 * 6. Continuity:
 *    - Extends continuously from Hero through Section 08 (Final CTA).
 *    - Fades out cleanly before entering the Footer.
 */
export function AmbientBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const scrollYRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const isVisibleRef = useRef<boolean>(true);

  // Quintic smootherstep for seamless transitions
  const smootherstep = (t: number) => {
    const c = Math.max(0, Math.min(1, t));
    return c * c * c * (c * (c * 6 - 15) + 10);
  };

  // Boundary tracking: Active across Hero -> Final CTA, fades out before Footer
  const updateOpacity = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const footer = document.querySelector("footer");
    if (!footer) {
      container.style.opacity = "1";
      container.style.visibility = "visible";
      isVisibleRef.current = true;
      return;
    }

    const rect = footer.getBoundingClientRect();
    const vh = window.innerHeight;

    // Case 1: Footer completely below viewport (Hero through Final CTA)
    if (rect.top >= vh) {
      container.style.opacity = "1";
      container.style.visibility = "visible";
      isVisibleRef.current = true;
      return;
    }

    // Case 2: Fully inside or past footer
    if (rect.top <= 0) {
      container.style.opacity = "0";
      container.style.visibility = "hidden";
      isVisibleRef.current = false;
      return;
    }

    // Case 3: Transition zone: footer scrolling into view from bottom
    const p = Math.max(0, Math.min(1, rect.top / vh));
    const eased = smootherstep(p);
    container.style.opacity = eased.toFixed(3);
    const visible = eased > 0.005;
    container.style.visibility = visible ? "visible" : "hidden";
    isVisibleRef.current = visible;
  }, []);

  // Synchronize scroll position with Lenis
  useLenis((lenis) => {
    scrollYRef.current = lenis.scroll;
    updateOpacity();
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Generate art-directed, deterministic particle field with generous negative space
    const initParticles = () => {
      const width = window.innerWidth;
      const count = width < 640 ? 28 : width < 1024 ? 46 : 68;
      const rand = createPrng(19720429);
      const particles: Particle[] = [];

      for (let i = 0; i < count; i++) {
        // Depth distribution: heavier weighting toward distant particles
        const z = 0.22 + Math.pow(rand(), 1.5) * 0.78;

        // Determine size category: ~68% micro, ~24% small, ~8% accent
        const catRoll = rand();
        let kind: ParticleKind = "micro";
        let radius = 0.55 + rand() * 0.3; // 0.55px - 0.85px
        let baseAlpha = 0.18 + rand() * 0.18; // 0.18 - 0.36

        if (catRoll > 0.92) {
          kind = "accent";
          radius = 1.45 + rand() * 0.4; // 1.45px - 1.85px
          baseAlpha = 0.60 + rand() * 0.18; // 0.60 - 0.78
        } else if (catRoll > 0.68) {
          kind = "small";
          radius = 0.95 + rand() * 0.4; // 0.95px - 1.35px
          baseAlpha = 0.38 + rand() * 0.20; // 0.38 - 0.58
        }

        // Color distribution: ~48% ivory, ~32% graphite, ~16% orange, ~4% sage-green
        const colorRoll = rand();
        let colorType: ColorType = "ivory";
        if (colorRoll > 0.96) {
          colorType = "green";
        } else if (colorRoll > 0.80) {
          colorType = "orange";
        } else if (colorRoll > 0.48) {
          colorType = "graphite";
        }

        // Irregular spatial distribution with empty negative space pockets
        // Clustered perturbation creates natural void regions
        let rawX = rand();
        let rawY = rand();
        const clusterBias = Math.sin(rawX * Math.PI * 3.5) * Math.cos(rawY * Math.PI * 2.5);
        rawX = Math.max(0.02, Math.min(0.98, rawX + clusterBias * 0.08));
        rawY = Math.max(0.02, Math.min(0.98, rawY + clusterBias * 0.08));

        particles.push({
          baseX: rawX,
          baseY: rawY,
          z,
          kind,
          colorType,
          radius,
          baseAlpha,
          phase: rand() * Math.PI * 2,
          driftSpeed: 0.25 + rand() * 0.4,
        });
      }

      particlesRef.current = particles;
    };

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      initParticles();
      updateOpacity();
    };

    handleResize();

    const isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const render = (now: number) => {
      rafIdRef.current = requestAnimationFrame(render);

      // Skip painting when completely hidden at footer
      if (!isVisibleRef.current) return;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const scrollY = scrollYRef.current;

      ctx.clearRect(0, 0, width, height);

      const time = now * 0.001;
      const particles = particlesRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // 1. Slow, organic micro-drift (disabled in reduced motion)
        const driftX = isReducedMotion
          ? 0
          : Math.sin(time * p.driftSpeed + p.phase) * (8 * p.z);
        const driftY = isReducedMotion
          ? 0
          : now * 0.008 * p.z * p.driftSpeed;

        // 2. Scroll-responsive parallax: as user scrolls down, particles travel upward
        // Distance layer scales response: distant particles 0.14x, foreground 0.42x
        const scrollFactor = isReducedMotion ? 0 : (0.14 + p.z * 0.28);
        const scrollOffset = scrollY * scrollFactor;

        // Continuous wrap-around with generous margin
        const rawY = p.baseY * height - scrollOffset - driftY;
        const renderY = ((rawY % height) + height) % height;

        const rawX = p.baseX * width + driftX;
        const renderX = ((rawX % width) + width) % width;

        // Very slight, gentle breathing twinkle
        const twinkle = isReducedMotion
          ? 1.0
          : 0.88 + 0.12 * Math.sin(time * 1.5 + p.phase);
        const alpha = Math.min(1.0, p.baseAlpha * twinkle);

        // =================================================================
        // CHROMATIC PALETTE MAPPING
        // Monochromatic Warm Ivory & Graphite with rare Burnt Orange & Sage
        // =================================================================
        let coreRgb = "255, 252, 246"; // Ivory core
        let bodyRgb = "242, 240, 235";
        let haloRgb = "225, 222, 216";

        if (p.colorType === "graphite") {
          coreRgb = "195, 192, 186";
          bodyRgb = "142, 140, 134";
          haloRgb = "110, 108, 104";
        } else if (p.colorType === "orange") {
          coreRgb = "255, 235, 220";
          bodyRgb = "229, 139, 101";
          haloRgb = "216, 135, 98";
        } else if (p.colorType === "green") {
          coreRgb = "235, 248, 240";
          bodyRgb = "145, 192, 165";
          haloRgb = "131, 182, 154";
        }

        // =================================================================
        // RESTRAINED POINT RENDERING BY SIZE CATEGORY
        // =================================================================
        if (p.kind === "micro") {
          // Micro: single crisp pin-point, no halo
          ctx.beginPath();
          ctx.arc(renderX, renderY, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${bodyRgb}, ${alpha.toFixed(3)})`;
          ctx.fill();
        } else if (p.kind === "small") {
          // Small: tiny core + restrained tight halo
          ctx.beginPath();
          ctx.arc(renderX, renderY, p.radius * 1.6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${haloRgb}, ${(alpha * 0.22).toFixed(3)})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(renderX, renderY, p.radius * 0.85, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${coreRgb}, ${alpha.toFixed(3)})`;
          ctx.fill();
        } else {
          // Accent: subtle glowing core + delicate corona (rare focal interest)
          ctx.beginPath();
          ctx.arc(renderX, renderY, p.radius * 2.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${haloRgb}, ${(alpha * 0.28).toFixed(3)})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(renderX, renderY, p.radius * 1.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${bodyRgb}, ${(alpha * 0.65).toFixed(3)})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(renderX, renderY, p.radius * 0.65, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${coreRgb}, ${alpha.toFixed(3)})`;
          ctx.fill();
        }
      }
    };

    rafIdRef.current = requestAnimationFrame(render);

    const onNativeScroll = () => {
      scrollYRef.current = window.scrollY;
      updateOpacity();
    };

    window.addEventListener("scroll", onNativeScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      window.removeEventListener("scroll", onNativeScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [updateOpacity]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-[1] overflow-hidden select-none will-change-[opacity] transition-opacity duration-200"
      aria-hidden="true"
    >
      {/* =================================================================
          ATMOSPHERIC ILLUMINATION (Subtle lower-viewport warm underglow)
          Blends almost imperceptibly into #111111 without cloud/panel borders
          ================================================================= */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[48vh] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 110% 75% at 50% 100%, rgba(216, 135, 98, 0.08) 0%, rgba(216, 135, 98, 0.035) 35%, rgba(216, 135, 98, 0.01) 60%, transparent 80%)",
        }}
      />

      {/* =================================================================
          CANVAS PARTICLE FIELD (Lenis-Inspired Optical Stardust)
          Crisp, scattered points of light with generous negative space
          ================================================================= */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none block"
      />
    </div>
  );
}

export default AmbientBackground;
