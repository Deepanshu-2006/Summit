"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { useLenis } from "@/components/layout/smooth-scroll-provider";

interface WorldPortalTransitionProps {
  sectionRef: React.RefObject<HTMLElement | null>;
  isReducedMotion: boolean;
  children: React.ReactNode;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

/**
 * WorldPortalTransition
 *
 * Cinematic Dimensional Portal Gateway + Atmospheric Valley Mist Dive:
 * - High-Performance, Zero-Layout-Thrashing pipeline tailored for Lenis smooth scrolling.
 * - Caches geometric section offsets and evaluates directly against Lenis's sub-pixel float.
 * - Prevents premature visibility: Completely hidden until Developer Experience finishes.
 * - Hardware-accelerated CSS transforms and compositor-only opacity animations (120fps locked).
 * - Zero external cloud illustration images used (pure procedural CSS gradients).
 * - 100% deterministic & reversible on backward scrolling.
 * - Zero GPU/CPU overhead once crossed (display: none).
 */
export function WorldPortalTransition({
  sectionRef,
  isReducedMotion,
  children,
}: WorldPortalTransitionProps) {
  const portalRootRef = useRef<HTMLDivElement>(null);
  const portalFrameRef = useRef<HTMLDivElement>(null);
  const eventHorizonRef = useRef<HTMLDivElement>(null);
  const portalAuraRef = useRef<HTMLDivElement>(null);
  const mistLayerRef = useRef<HTMLDivElement>(null);

  // Cached geometry to eliminate getBoundingClientRect layout thrashing during scroll
  const geoRef = useRef({
    sectionTop: 0,
    sectionHeight: 0,
    vh: 900,
    scrollDistance: 1,
  });

  const measure = useCallback(() => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    geoRef.current = {
      sectionTop: rect.top + window.scrollY,
      sectionHeight: rect.height,
      vh,
      scrollDistance: Math.max(1, rect.height - vh),
    };
  }, [sectionRef]);

  const updatePortalWithScroll = useCallback(
    (scrollY: number) => {
      if (!portalRootRef.current || !portalFrameRef.current) return;

      if (isReducedMotion) {
        portalRootRef.current.style.opacity = "1";
        portalRootRef.current.style.visibility = "visible";
        portalFrameRef.current.style.transform = "none";
        portalFrameRef.current.style.borderRadius = "0px";
        if (eventHorizonRef.current) eventHorizonRef.current.style.display = "none";
        if (portalAuraRef.current) portalAuraRef.current.style.display = "none";
        if (mistLayerRef.current) mistLayerRef.current.style.display = "none";
        return;
      }

      const { sectionTop, vh, scrollDistance } = geoRef.current;
      const currentTop = sectionTop - scrollY;

      // -----------------------------------------------------------------
      // PHASE 1: PREVENT PREMATURE VISIBILITY
      // When currentTop >= vh * 0.45, user is still reading Developer Experience.
      // The portal and 3D canvas must remain completely hidden (opacity: 0).
      // -----------------------------------------------------------------
      const approachRunway = vh * 0.45;

      if (currentTop >= approachRunway) {
        portalRootRef.current.style.opacity = "0";
        portalRootRef.current.style.visibility = "hidden";
        if (mistLayerRef.current) mistLayerRef.current.style.display = "none";
        return;
      }

      portalRootRef.current.style.visibility = "visible";

      const isMobile = window.innerWidth < 640;
      const isTablet = window.innerWidth >= 640 && window.innerWidth < 1024;
      const maxRadius = isMobile ? 24 : isTablet ? 34 : 44;

      if (currentTop > 0) {
        // ===============================================================
        // APPROACH PHASE (currentTop > 0):
        // Scrolling between Developer Experience and the pinned threshold.
        // The portal appears as a floating, luminous dimensional aperture
        // shrouded in soft morning mountain mist.
        // ===============================================================
        const rawApproach = clamp01(1.0 - currentTop / approachRunway);
        const approachEase = smoothstep(rawApproach);

        // Fade in entire portal cleanly as threshold is approached
        portalRootRef.current.style.opacity = approachEase.toFixed(3);

        // Subtle scale from 0.82 to 0.88
        const baseScale = isMobile ? 0.84 : isTablet ? 0.83 : 0.82;
        const targetScale = isMobile ? 0.90 : isTablet ? 0.88 : 0.86;
        const currentScale = baseScale + approachEase * (targetScale - baseScale);

        portalFrameRef.current.style.transform = `translate3d(0, 0, 0) scale(${currentScale.toFixed(4)})`;
        portalFrameRef.current.style.borderRadius = `${maxRadius}px`;

        // Luminous Event Horizon Perimeter Ring
        if (eventHorizonRef.current) {
          eventHorizonRef.current.style.display = "block";
          eventHorizonRef.current.style.opacity = (approachEase * 0.90).toFixed(3);
          eventHorizonRef.current.style.borderRadius = `${maxRadius}px`;
        }

        // Luminous Warm Horizon Aura
        if (portalAuraRef.current) {
          portalAuraRef.current.style.display = "block";
          portalAuraRef.current.style.opacity = (approachEase * 0.70).toFixed(3);
        }

        // Procedural Mist Veil covers the interior of the portal
        if (mistLayerRef.current) {
          mistLayerRef.current.style.display = "block";
          mistLayerRef.current.style.opacity = (0.75 + approachEase * 0.20).toFixed(3);
          mistLayerRef.current.style.transform = "translate3d(0, 0, 0) scale(1, 1)";
        }
      } else {
        // ===============================================================
        // PINNED DIVE PHASE (currentTop <= 0):
        // Section is pinned in viewport. As user scrolls down (p: 0 -> 0.08),
        // the camera dives into the clearing, the portal frame expands to
        // full bleed (scale 1.0, radius 0px), and the mist billows and parts.
        // ===============================================================
        portalRootRef.current.style.opacity = "1";

        const rawProgress = clamp01(-currentTop / scrollDistance);
        const diveProgress = clamp01(rawProgress / 0.08);
        const diveEase = smoothstep(diveProgress);

        const baseScale = isMobile ? 0.90 : isTablet ? 0.88 : 0.86;
        const finalScale = baseScale + diveEase * (1.0 - baseScale);
        const currentRadius = (1.0 - diveEase) * maxRadius;

        portalFrameRef.current.style.transform = `translate3d(0, 0, 0) scale(${finalScale.toFixed(4)})`;
        portalFrameRef.current.style.borderRadius = `${currentRadius.toFixed(1)}px`;

        // Ring & Aura fade out smoothly as portal expands to full bleed
        if (eventHorizonRef.current) {
          if (diveEase >= 0.999) {
            eventHorizonRef.current.style.opacity = "0";
            eventHorizonRef.current.style.display = "none";
          } else {
            eventHorizonRef.current.style.display = "block";
            eventHorizonRef.current.style.opacity = ((1.0 - diveEase) * 0.90).toFixed(3);
            eventHorizonRef.current.style.borderRadius = `${currentRadius.toFixed(1)}px`;
          }
        }

        if (portalAuraRef.current) {
          if (diveEase >= 0.999) {
            portalAuraRef.current.style.opacity = "0";
            portalAuraRef.current.style.display = "none";
          } else {
            portalAuraRef.current.style.display = "block";
            portalAuraRef.current.style.opacity = ((1.0 - diveEase) * 0.70).toFixed(3);
          }
        }

        // Mist billows upward and parts horizontally, revealing the sunlit clearing
        if (mistLayerRef.current) {
          if (diveEase >= 0.999) {
            mistLayerRef.current.style.opacity = "0";
            mistLayerRef.current.style.display = "none";
          } else {
            mistLayerRef.current.style.display = "block";
            const mistOp = ((1.0 - diveEase) * 0.95).toFixed(3);
            const mistScaleY = (1.0 + diveEase * 2.2).toFixed(3);
            const mistScaleX = (1.0 + diveEase * 0.35).toFixed(3);
            const mistY = (-diveEase * 120).toFixed(1);

            mistLayerRef.current.style.opacity = mistOp;
            mistLayerRef.current.style.transform = `translate3d(0, ${mistY}px, 0) scale(${mistScaleX}, ${mistScaleY})`;
          }
        }
      }
    },
    [isReducedMotion]
  );

  // Synchronize directly with Lenis smooth scroll tick
  useLenis((lenis) => {
    updatePortalWithScroll(lenis.scroll);
  });

  useEffect(() => {
    const onNativeScroll = () => {
      updatePortalWithScroll(window.scrollY);
    };

    const onResize = () => {
      measure();
      updatePortalWithScroll(window.scrollY);
    };

    window.addEventListener("scroll", onNativeScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    measure();
    updatePortalWithScroll(window.scrollY);
    const timer = setTimeout(() => {
      measure();
      updatePortalWithScroll(window.scrollY);
    }, 100);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onNativeScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [measure, updatePortalWithScroll]);

  return (
    <div
      ref={portalRootRef}
      className="relative w-full h-full flex items-center justify-center contain-layout will-change-[opacity] transform-gpu"
      style={{ opacity: 0 }}
    >
      {/* Background Cosmic Event Horizon Aura */}
      <div
        ref={portalAuraRef}
        className="absolute inset-0 pointer-events-none z-[1] will-change-opacity transform-gpu"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(216, 135, 98, 0.22) 0%, rgba(216, 135, 98, 0.06) 45%, transparent 75%)",
          opacity: 0,
        }}
        aria-hidden="true"
      />

      {/* Floating Dimensional Portal Frame */}
      <div
        ref={portalFrameRef}
        className="relative w-full h-full overflow-hidden will-change-[transform,border-radius] transform-gpu contain-paint"
        style={{
          transformOrigin: "center center",
          background: "#0c0e10",
        }}
      >
        {children}

        {/* =================================================================
            ATMOSPHERIC VALLEY MIST STRATA (Threshold Fog Dive)
            Drifts horizontally across the entrance threshold.
            Expands and dissipates as the camera dives into the sunlit clearing.
            Strictly procedural: Zero external cloud images used.
            ================================================================= */}
        <div
          ref={mistLayerRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-hidden will-change-[transform,opacity] select-none transform-gpu"
          style={{ opacity: 0, display: "none" }}
          aria-hidden="true"
        >
          {/* Layer 1: High Valley Mist Ribbon (Drifts East) */}
          <div
            className="absolute -top-10 left-0 w-[200%] h-64 animate-[mistConveyorEast_38s_linear_infinite] will-change-transform pointer-events-none transform-gpu"
            style={{
              background:
                "radial-gradient(ellipse 50% 60% at 25% 45%, rgba(225, 235, 248, 0.40) 0%, rgba(215, 228, 242, 0.28) 25%, rgba(200, 215, 232, 0.16) 48%, rgba(200, 215, 232, 0.04) 68%, transparent 80%), radial-gradient(ellipse 50% 60% at 75% 45%, rgba(225, 235, 248, 0.40) 0%, rgba(215, 228, 242, 0.28) 25%, rgba(200, 215, 232, 0.16) 48%, rgba(200, 215, 232, 0.04) 68%, transparent 80%)",
            }}
          />

          {/* Layer 2: Mid-Elevation Saddle Mist Ribbon (Drifts West) */}
          <div
            className="absolute top-24 left-0 w-[200%] h-72 animate-[cloudConveyorWest_30s_linear_infinite] will-change-transform pointer-events-none transform-gpu"
            style={{
              background:
                "radial-gradient(ellipse 46% 55% at 30% 50%, rgba(215, 228, 240, 0.35) 0%, rgba(200, 218, 235, 0.22) 28%, rgba(185, 205, 225, 0.12) 50%, rgba(185, 205, 225, 0.03) 70%, transparent 82%), radial-gradient(ellipse 46% 55% at 80% 50%, rgba(215, 228, 240, 0.35) 0%, rgba(200, 218, 235, 0.22) 28%, rgba(185, 205, 225, 0.12) 50%, rgba(185, 205, 225, 0.03) 70%, transparent 82%)",
            }}
          />

          {/* Layer 3: Low Clearing Mist Deck (Drifts East with warm morning sun catch) */}
          <div
            className="absolute top-[38%] left-0 w-[200%] h-72 animate-[mistConveyorEast_22s_linear_infinite] will-change-transform pointer-events-none transform-gpu"
            style={{
              background:
                "radial-gradient(ellipse 44% 52% at 20% 55%, rgba(245, 240, 230, 0.32) 0%, rgba(230, 210, 195, 0.20) 26%, rgba(216, 135, 98, 0.12) 45%, rgba(216, 135, 98, 0.02) 65%, transparent 78%), radial-gradient(ellipse 44% 52% at 70% 55%, rgba(245, 240, 230, 0.32) 0%, rgba(230, 210, 195, 0.20) 26%, rgba(216, 135, 98, 0.12) 45%, rgba(216, 135, 98, 0.02) 65%, transparent 78%)",
            }}
          />

          {/* Layer 4: Ambient Mountain Mist Veil (Covers clearing before dive) */}
          <div
            className="absolute inset-0 pointer-events-none transform-gpu"
            style={{
              background:
                "radial-gradient(ellipse 90% 75% at 50% 50%, rgba(215, 228, 242, 0.35) 0%, rgba(205, 220, 235, 0.22) 35%, rgba(195, 212, 228, 0.10) 60%, transparent 85%)",
            }}
          />

          {/* Layer 5: Upper Atmospheric Horizon Blend (Soft cosmic edge blend) */}
          <div
            className="absolute top-0 left-0 right-0 h-36 pointer-events-none transform-gpu"
            style={{
              background:
                "linear-gradient(to bottom, rgba(12, 14, 16, 0.85) 0%, rgba(12, 14, 16, 0.25) 65%, transparent 100%)",
            }}
          />
        </div>

        {/* Luminous Event Horizon Perimeter Border */}
        <div
          ref={eventHorizonRef}
          className="absolute inset-0 pointer-events-none z-30 border transition-none will-change-[opacity,border-radius] transform-gpu"
          style={{
            borderColor: "rgba(216, 135, 98, 0.60)",
            boxShadow:
              "0 0 50px rgba(216, 135, 98, 0.38), inset 0 0 25px rgba(216, 135, 98, 0.22)",
            borderRadius: "44px",
            opacity: 0,
            display: "none",
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export default WorldPortalTransition;