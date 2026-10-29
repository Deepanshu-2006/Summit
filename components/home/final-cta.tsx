"use client";

import React, { useRef, useEffect, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

// Reduced Motion Subscription helper
function subscribeReducedMotion(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

/**
 * FinalCta: Section 08 — Final Call to Action
 * "Your code. Ready for what’s next."
 *
 * Cinematic typography & scroll-driven mountain composition:
 * - Two-statement art-directed headline: "Your code." followed by "Ready for what’s next."
 * - Completely removed top pill/capsule for immediate typographic authority
 * - Calm, narrower supporting copy with generous breathing room
 * - Distinct button hierarchy: high-contrast burnt-orange primary with refined arrow
 *   paired with a quiet, border-defined dark secondary action
 * - Coordinated viewport entrance animation (headline -> copy -> actions)
 * - 5 independently emerging scroll-driven terrain layers preserved seamlessly
 */
export function FinalCta() {
  const sectionRef = useRef<HTMLElement>(null);
  const masterLayerRef = useRef<HTMLDivElement>(null);
  const layer1Ref = useRef<HTMLDivElement>(null);
  const layer2Ref = useRef<HTMLDivElement>(null);
  const layer3Ref = useRef<HTMLDivElement>(null);
  const layer4Ref = useRef<HTMLDivElement>(null);
  const layer5Ref = useRef<HTMLDivElement>(null);
  const lightLayerRef = useRef<HTMLDivElement>(null);

  // Content DOM references for 3D scroll-driven emergence from back to front
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Synchronously subscribe to reduced motion preference
  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  useEffect(() => {
    // If reduced motion is requested, ensure all layers and text are in final resting state
    if (isReducedMotion) {
      const resetLayer = (el: HTMLElement | null) => {
        if (!el) return;
        el.style.transform = "none";
        el.style.opacity = "1";
        el.style.filter = "none";
      };
      resetLayer(layer1Ref.current);
      resetLayer(layer2Ref.current);
      resetLayer(layer3Ref.current);
      resetLayer(layer4Ref.current);
      resetLayer(layer5Ref.current);
      resetLayer(headlineRef.current);
      resetLayer(paragraphRef.current);
      resetLayer(actionsRef.current);
      if (masterLayerRef.current) masterLayerRef.current.style.opacity = "1";
      return;
    }

    const section = sectionRef.current;
    if (!section) return;

    let rafId: number | null = null;
    let isIntersecting = false;

    // Easing helpers
    const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const updateLayers = () => {
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const windowH = window.innerHeight;

      // Emergence starts when the section is ~65% down the viewport
      const startY = windowH * 0.65;
      // Emergence completes and settles as the section reaches its reading position
      const endY = Math.max(40, windowH * 0.05);

      const rawP = (startY - rect.top) / (startY - endY);
      const p = Math.max(0, Math.min(1, rawP));

      // Layer 1: Distant Ridge (progress: 0.00 -> 0.55)
      if (layer1Ref.current) {
        const p1 = Math.max(0, Math.min(1, p / 0.55));
        const y1 = (55 * (1 - easeOutQuad(p1))).toFixed(2);
        const op1 = Math.min(1, p1 * 1.5).toFixed(3);
        layer1Ref.current.style.transform = `translate3d(0, ${y1}px, 0)`;
        layer1Ref.current.style.opacity = op1;
      }

      // Layer 2: Left Mountain (progress: 0.12 -> 0.72)
      if (layer2Ref.current) {
        const p2 = Math.max(0, Math.min(1, (p - 0.12) / 0.60));
        const y2 = (115 * (1 - easeOutCubic(p2))).toFixed(2);
        const op2 = Math.min(1, p2 * 1.5).toFixed(3);
        layer2Ref.current.style.transform = `translate3d(0, ${y2}px, 0)`;
        layer2Ref.current.style.opacity = op2;
      }

      // Layer 3: Central Valley (progress: 0.25 -> 0.82)
      if (layer3Ref.current) {
        const p3 = Math.max(0, Math.min(1, (p - 0.25) / 0.57));
        const y3 = (90 * (1 - easeOutQuad(p3))).toFixed(2);
        const op3 = Math.min(1, p3 * 1.5).toFixed(3);
        layer3Ref.current.style.transform = `translate3d(0, ${y3}px, 0)`;
        layer3Ref.current.style.opacity = op3;
      }

      // Layer 4: Right Mountain (progress: 0.38 -> 0.92)
      if (layer4Ref.current) {
        const p4 = Math.max(0, Math.min(1, (p - 0.38) / 0.54));
        const y4 = (135 * (1 - easeOutCubic(p4))).toFixed(2);
        const op4 = Math.min(1, p4 * 1.5).toFixed(3);
        layer4Ref.current.style.transform = `translate3d(0, ${y4}px, 0)`;
        layer4Ref.current.style.opacity = op4;
      }

      // Layer 5: Foreground Terrain (progress: 0.50 -> 1.00)
      if (layer5Ref.current) {
        const p5 = Math.max(0, Math.min(1, (p - 0.50) / 0.50));
        const y5 = (155 * (1 - easeOutCubic(p5))).toFixed(2);
        const op5 = Math.min(1, p5 * 1.6).toFixed(3);
        layer5Ref.current.style.transform = `translate3d(0, ${y5}px, 0)`;
        layer5Ref.current.style.opacity = op5;
      }

      // Ambient light shimmer opacity tracks terrain emergence
      if (lightLayerRef.current) {
        const lightOp = (0.28 * Math.min(1, p * 1.2)).toFixed(3);
        lightLayerRef.current.style.opacity = lightOp;
      }

      // Master composite lock: smoothly fades in as everything settles into final resting composition
      if (masterLayerRef.current) {
        const masterOp = p >= 0.85 ? Math.min(1, (p - 0.85) / 0.15).toFixed(3) : "0";
        masterLayerRef.current.style.opacity = masterOp;
      }

      // =================================================================
      // TEXT & ACTIONS SCROLL EMERGENCE: BACK OF MOUNTAINS TO THE FRONT
      // Responsive travel offsets: starting deep in the valley behind peaks,
      // ascending and surging forward in 3D perspective to front plane
      // =================================================================
      const isMobile = window.innerWidth < 640;
      const yTravelH = isMobile ? 100 : 160;
      const yTravelP = isMobile ? 120 : 190;
      const yTravelB = isMobile ? 140 : 220;

      // 1. Headline (delayed emergence: mountains rise first, then headline ascends at p = 0.22 -> 0.78)
      if (headlineRef.current) {
        const pH = Math.max(0, Math.min(1, (p - 0.22) / 0.56));
        const eH = easeOutCubic(pH);
        const yH = (yTravelH * (1 - eH)).toFixed(2);
        const sH = (0.70 + 0.30 * eH).toFixed(3);
        const rotH = ((isMobile ? 3.5 : 6.5) * (1 - eH)).toFixed(2);
        const opH = Math.min(1, pH * 1.5).toFixed(3);
        const blurH = ((isMobile ? 5 : 8) * (1 - eH)).toFixed(2);

        if (pH >= 0.98) {
          headlineRef.current.style.transform = "translate3d(0, 0, 0)";
          headlineRef.current.style.opacity = "1";
          headlineRef.current.style.filter = "none";
          headlineRef.current.style.transition = "none";
        } else {
          headlineRef.current.style.transform = `translate3d(0, ${yH}px, 0) scale(${sH}) rotateX(${rotH}deg)`;
          headlineRef.current.style.opacity = opH;
          headlineRef.current.style.filter = `blur(${blurH}px)`;
          headlineRef.current.style.transition = "transform 0.14s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.14s ease-out, filter 0.14s ease-out";
        }
      }

      // 2. Supporting Paragraph (delayed: follows headline at p = 0.36 -> 0.88)
      if (paragraphRef.current) {
        const pP = Math.max(0, Math.min(1, (p - 0.36) / 0.52));
        const eP = easeOutCubic(pP);
        const yP = (yTravelP * (1 - eP)).toFixed(2);
        const sP = (0.74 + 0.26 * eP).toFixed(3);
        const rotP = ((isMobile ? 3 : 5.5) * (1 - eP)).toFixed(2);
        const opP = Math.min(1, pP * 1.5).toFixed(3);
        const blurP = ((isMobile ? 5 : 8) * (1 - eP)).toFixed(2);

        if (pP >= 0.98) {
          paragraphRef.current.style.transform = "translate3d(0, 0, 0)";
          paragraphRef.current.style.opacity = "1";
          paragraphRef.current.style.filter = "none";
          paragraphRef.current.style.transition = "none";
        } else {
          paragraphRef.current.style.transform = `translate3d(0, ${yP}px, 0) scale(${sP}) rotateX(${rotP}deg)`;
          paragraphRef.current.style.opacity = opP;
          paragraphRef.current.style.filter = `blur(${blurP}px)`;
          paragraphRef.current.style.transition = "transform 0.14s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.14s ease-out, filter 0.14s ease-out";
        }
      }

      // 3. Actions / Buttons (delayed: emerges last from the valley at p = 0.50 -> 0.98)
      if (actionsRef.current) {
        const pB = Math.max(0, Math.min(1, (p - 0.50) / 0.48));
        const eB = easeOutCubic(pB);
        const yB = (yTravelB * (1 - eB)).toFixed(2);
        const sB = (0.78 + 0.22 * eB).toFixed(3);
        const rotB = ((isMobile ? 2.5 : 4.5) * (1 - eB)).toFixed(2);
        const opB = Math.min(1, pB * 1.6).toFixed(3);
        const blurB = ((isMobile ? 4 : 6) * (1 - eB)).toFixed(2);

        if (pB >= 0.98) {
          actionsRef.current.style.transform = "translate3d(0, 0, 0)";
          actionsRef.current.style.opacity = "1";
          actionsRef.current.style.filter = "none";
          actionsRef.current.style.transition = "none";
        } else {
          actionsRef.current.style.transform = `translate3d(0, ${yB}px, 0) scale(${sB}) rotateX(${rotB}deg)`;
          actionsRef.current.style.opacity = opB;
          actionsRef.current.style.filter = `blur(${blurB}px)`;
          actionsRef.current.style.transition = "transform 0.14s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.14s ease-out, filter 0.14s ease-out";
        }
      }
    };

    const onScroll = () => {
      if (!isIntersecting) return;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateLayers);
    };

    // Use IntersectionObserver to ensure 0 scroll overhead when off-screen
    const observer = new IntersectionObserver(
      ([entry]) => {
        isIntersecting = entry.isIntersecting;
        if (isIntersecting) {
          updateLayers();
          window.addEventListener("scroll", onScroll, { passive: true });
          window.addEventListener("resize", onScroll, { passive: true });
        } else {
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("resize", onScroll);
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
        }
      },
      { rootMargin: "300px 0px 300px 0px", threshold: 0 }
    );

    observer.observe(section);

    // Initial positioning calculation
    updateLayers();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isReducedMotion]);

  return (
    <section
      ref={sectionRef}
      id="final-cta"
      className="relative w-full min-h-[640px] sm:min-h-[720px] lg:min-h-[800px] pt-24 pb-32 sm:pt-32 sm:pb-40 lg:pt-38 lg:pb-48 bg-[#111110] text-text-primary overflow-hidden flex flex-col justify-start select-none"
      aria-labelledby="cta-heading"
    >
      {/* Dynamic Keyframes for Subtle Terrain Lighting Drift */}
      <style>{`
        @keyframes terrainLightDrift {
          0% {
            opacity: 0.12;
            transform: scale(0.98) translate3d(-1.5%, 0, 0);
          }
          50% {
            opacity: 0.22;
            transform: scale(1.02) translate3d(2%, -1%, 0);
          }
          100% {
            opacity: 0.12;
            transform: scale(0.98) translate3d(-1.5%, 0, 0);
          }
        }
      `}</style>

      {/* =================================================================
          LAYER 1 TO 5: INDEPENDENTLY EMERGING MOUNTAIN TERRAIN RIDGES
          Organic terrain layers rising out of darkness based on scroll progress
          ================================================================= */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none select-none overflow-hidden flex items-end justify-center w-full z-0 h-[380px] sm:h-[480px] lg:h-[580px]"
        aria-hidden="true"
      >
        <div className="relative w-full max-w-[1920px] h-full flex items-end justify-center">
          {/* Master Resting Composite (locks into 100% fidelity once settled) */}
          <div
            ref={masterLayerRef}
            className="absolute inset-0 pointer-events-none will-change-[opacity]"
            style={{ opacity: isReducedMotion ? 1 : 0 }}
          >
            <Image
              src="/images/mountains-dark.webp"
              alt=""
              width={1924}
              height={610}
              priority
              className="w-full h-auto min-h-[300px] sm:min-h-[420px] lg:min-h-[520px] object-cover object-bottom block opacity-95"
            />
          </div>

          {/* Layer 1: Distant Ridge (First to emerge: soft low-contrast atmospheric silhouette) */}
          <div
            ref={layer1Ref}
            className="absolute inset-0 pointer-events-none will-change-[transform,opacity]"
            style={{
              transform: isReducedMotion ? "translate3d(0, 0, 0)" : "translate3d(0, 55px, 0)",
              opacity: isReducedMotion ? 1 : 0,
            }}
          >
            <Image
              src="/images/mountains-layer-1-distant.webp"
              alt=""
              width={1924}
              height={610}
              priority
              className="w-full h-auto min-h-[300px] sm:min-h-[420px] lg:min-h-[520px] object-cover object-bottom block"
            />
          </div>

          {/* Layer 2: Left Mountain (Second: large rounded formation rising on the left) */}
          <div
            ref={layer2Ref}
            className="absolute inset-0 pointer-events-none will-change-[transform,opacity]"
            style={{
              transform: isReducedMotion ? "translate3d(0, 0, 0)" : "translate3d(0, 115px, 0)",
              opacity: isReducedMotion ? 1 : 0,
            }}
          >
            <Image
              src="/images/mountains-layer-2-left.webp"
              alt=""
              width={1924}
              height={610}
              priority
              className="w-full h-auto min-h-[300px] sm:min-h-[420px] lg:min-h-[520px] object-cover object-bottom block"
            />
          </div>

          {/* Layer 3: Central Valley (Third: deeper valley & mid-ridge establishing spatial depth) */}
          <div
            ref={layer3Ref}
            className="absolute inset-0 pointer-events-none will-change-[transform,opacity]"
            style={{
              transform: isReducedMotion ? "translate3d(0, 0, 0)" : "translate3d(0, 90px, 0)",
              opacity: isReducedMotion ? 1 : 0,
            }}
          >
            <Image
              src="/images/mountains-layer-3-center.webp"
              alt=""
              width={1924}
              height={610}
              priority
              className="w-full h-auto min-h-[300px] sm:min-h-[420px] lg:min-h-[520px] object-cover object-bottom block"
            />
          </div>

          {/* Layer 4: Right Mountain (Fourth: towering craggy peak rising independently) */}
          <div
            ref={layer4Ref}
            className="absolute inset-0 pointer-events-none will-change-[transform,opacity]"
            style={{
              transform: isReducedMotion ? "translate3d(0, 0, 0)" : "translate3d(0, 135px, 0)",
              opacity: isReducedMotion ? 1 : 0,
            }}
          >
            <Image
              src="/images/mountains-layer-4-right.webp"
              alt=""
              width={1924}
              height={610}
              priority
              className="w-full h-auto min-h-[300px] sm:min-h-[420px] lg:min-h-[520px] object-cover object-bottom block"
            />
          </div>

          {/* Layer 5: Foreground Terrain (Fifth: closest foreground ridges & bright stippled crests) */}
          <div
            ref={layer5Ref}
            className="absolute inset-0 pointer-events-none will-change-[transform,opacity]"
            style={{
              transform: isReducedMotion ? "translate3d(0, 0, 0)" : "translate3d(0, 155px, 0)",
              opacity: isReducedMotion ? 1 : 0,
            }}
          >
            <Image
              src="/images/mountains-layer-5-foreground.webp"
              alt=""
              width={1924}
              height={610}
              priority
              className="w-full h-auto min-h-[300px] sm:min-h-[420px] lg:min-h-[520px] object-cover object-bottom block"
            />
          </div>

          {/* Seamless Edge Falloff: Blends bottom edge invisibly into #111110 */}
          <div
            className="absolute inset-x-0 bottom-0 h-20 pointer-events-none z-10"
            style={{
              background:
                "linear-gradient(to bottom, rgba(17,17,16,0) 0%, rgba(17,17,16,0.6) 50%, #111110 100%)",
            }}
          />

          {/* Subtle Ambient Light Shimmer Across Mountain Ridges */}
          <div
            ref={lightLayerRef}
            className="absolute inset-0 pointer-events-none mix-blend-screen z-20"
            style={{
              background:
                "radial-gradient(ellipse 65% 45% at 50% 88%, rgba(245,240,230,0.28) 0%, rgba(216,135,98,0.07) 48%, transparent 75%)",
              animation: !isReducedMotion ? "terrainLightDrift 16s ease-in-out infinite" : "none",
            }}
          />
        </div>
      </div>

      {/* =================================================================
          ATMOSPHERIC VIGNETTE FOR UNCOMPROMISED TEXT LEGIBILITY
          Soft radial falloff behind central text ensuring crisp contrast
          ================================================================= */}
      <div
        className="absolute inset-0 pointer-events-none z-[5]"
        style={{
          background:
            "radial-gradient(ellipse 75% 58% at 50% 32%, rgba(17,17,16,0.92) 0%, rgba(17,17,16,0.58) 55%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      {/* =================================================================
          EDITORIAL CONTENT & CALLS TO ACTION (z-10)
          3D Perspective viewport where typography surges from back to front
          ================================================================= */}
      <div
        className="layout-container w-full relative z-10"
        style={{ perspective: "1200px" }}
      >
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center select-text">
          {/* Art-Directed Two-Statement Headline */}
          <h2
            ref={headlineRef}
            id="cta-heading"
            className="font-sans text-[44px] sm:text-[58px] md:text-[68px] lg:text-[78px] xl:text-[84px] leading-[0.98] sm:leading-[1.02] tracking-[-0.04em] max-w-[880px] mx-auto will-change-[transform,opacity,filter]"
            style={{
              transformOrigin: "center center",
              opacity: isReducedMotion ? 1 : 0,
            }}
          >
            <span className="block font-medium text-[#F2F0EB]">Your code.</span>
            <span className="block font-normal text-[#DDD9D0] mt-1.5 sm:mt-2">
              Ready for what’s next.
            </span>
          </h2>

          {/* Refined Supporting Copy */}
          <p
            ref={paragraphRef}
            className="font-sans text-[16.5px] sm:text-[18px] lg:text-[19.5px] leading-[1.55] text-[#9E9B93] max-w-[500px] mx-auto mt-7 sm:mt-8 mb-10 sm:mb-12 will-change-[transform,opacity,filter]"
            style={{
              transformOrigin: "center center",
              opacity: isReducedMotion ? 1 : 0,
            }}
          >
            Bring your next idea to life. Start with your code and build toward
            something worth shipping.
          </p>

          {/* Actions: High-Contrast Burnt Orange Primary + Quiet Border-Defined Secondary */}
          <div
            ref={actionsRef}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-4.5 w-full sm:w-auto will-change-[transform,opacity,filter]"
            style={{
              transformOrigin: "center center",
              opacity: isReducedMotion ? 1 : 0,
            }}
          >
            {/* Primary Action: Direct jump to Onboarding */}
            <Link
              href="#getting-started"
              className="inline-flex items-center justify-center gap-2.5 h-[54px] sm:h-[58px] px-8 sm:px-9 rounded-[8px] bg-accent-orange hover:bg-accent-orange-hover text-[#121110] text-[15px] sm:text-[15.5px] font-semibold transition-all duration-200 shadow-md shadow-accent-orange/15 hover:shadow-accent-orange/25 hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto group"
            >
              <span>Get started</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>

            {/* Secondary Action: Repository Destination */}
            <Link
              href="https://github.com/Deepanshu-2006/jetway"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-[54px] sm:h-[58px] px-7 sm:px-8 rounded-[8px] bg-[#181817]/90 hover:bg-[#222220] border border-white/12 hover:border-white/22 text-[#E8E6E0] hover:text-[#F5F5F3] text-[14.5px] sm:text-[15px] font-medium transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-sm w-full sm:w-auto group"
            >
              <span>GitHub repository</span>
              <ExternalLink className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FinalCta;
