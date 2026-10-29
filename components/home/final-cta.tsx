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
 * Locked-Screen Multi-Stage Cinematic Reveal:
 * 1. Screen locks in place with extended scroll track (h-[360vh] sm:h-[380vh] lg:h-[400vh])
 * 2. Stage 1 (p in [0.00 .. 0.34]): Clouds part horizontally to the flanks
 * 3. Stage 2 (p in [0.32 .. 0.64]): Mountain horizon emerges and ascends from the bottom
 * 4. Stage 3 (p in [0.62 .. 0.88]): Typography ("Your code. Ready for what’s next.") and CTAs surge forward into crisp focus
 * 5. Stage 4 (p in [0.88 .. 1.00]): Settled plateau where the complete scene remains stable and interactive
 */
export function FinalCta() {
  const sectionRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Diagrammatic cloud section references (Dedicated Left & Right sections)
  const cloudLeftRef = useRef<HTMLDivElement>(null);
  const cloudRightRef = useRef<HTMLDivElement>(null);

  // Emerging mountain horizon reference (Rises upward after clouds part)
  const mountainRef = useRef<HTMLDivElement>(null);

  // Section content reference (surges from inside the screen after mountain settles)
  const contentWrapperRef = useRef<HTMLDivElement>(null);

  // Synchronously subscribe to reduced motion preference
  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  useEffect(() => {
    // If reduced motion is requested, render static open framing
    if (isReducedMotion) {
      const resetEl = (el: HTMLElement | null, transform = "none", opacity = "1") => {
        if (!el) return;
        el.style.transform = transform;
        el.style.opacity = opacity;
        el.style.filter = "none";
        el.style.transition = "none";
      };

      resetEl(cloudLeftRef.current, "translate3d(-600px, 0, 0)", "0.85");
      resetEl(cloudRightRef.current, "translate3d(600px, 0, 0)", "0.85");
      resetEl(mountainRef.current, "translate3d(0, 0, 0)", "1.0");
      resetEl(contentWrapperRef.current, "none", "1");
      return;
    }

    const section = sectionRef.current;
    if (!section) return;

    let targetP = 0;
    let currentP = 0;
    let isInitialized = false;
    let rafId: number | null = null;
    let isIntersecting = false;

    // Deceleration & symmetrical easing helpers
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    // Compute locked scroll progress p in [0.0, 1.0]
    // Section pins when rect.top <= 0, and unpins when user scrolls through track
    const computeTargetP = () => {
      if (!section) return 0;
      const rect = section.getBoundingClientRect();
      const scrollTrack = rect.height - window.innerHeight;
      if (scrollTrack <= 0) return 0;

      // When section top is above viewport (pinned): -rect.top advances from 0 to scrollTrack
      const rawP = -rect.top / scrollTrack;
      return Math.min(1.0, Math.max(0.0, rawP));
    };

    const render = (p: number) => {
      const isMobile = window.innerWidth < 640;
      const isTablet = window.innerWidth >= 640 && window.innerWidth < 1024;

      // =================================================================
      // STAGE 1: CLOUDS PART HORIZONTALLY (p in [0.00 .. 0.34])
      // =================================================================
      const cloudFactor = p < 0.34 ? easeOutCubic(p / 0.34) : 1.0;

      // =================================================================
      // STAGE 2: MOUNTAINS EMERGE FROM BOTTOM (p in [0.32 .. 0.64])
      // Appears first after clouds open, before the text renders
      // =================================================================
      let mountainFactor = 0;
      if (p >= 0.32) {
        mountainFactor = p < 0.64 ? easeOutCubic((p - 0.32) / 0.32) : 1.0;
      }

      // =================================================================
      // STAGE 3: TEXT & CTAS RENDER (p in [0.62 .. 0.88])
      // Surges into focus after the mountain horizon has risen into place
      // =================================================================
      let textFactor = 0;
      if (p >= 0.62) {
        textFactor = p < 0.88 ? easeOutCubic((p - 0.62) / 0.26) : 1.0;
      }

      // -----------------------------------------------------------------
      // 1. LEFT & RIGHT CLOUDS: Glide outward to flanks
      // -----------------------------------------------------------------
      const outOffset = isMobile ? 320 : isTablet ? 460 : 620;
      const xLeft = (-outOffset * cloudFactor).toFixed(2);
      const xRight = (outOffset * cloudFactor).toFixed(2);
      const sCloud = (1.0 + 0.02 * cloudFactor).toFixed(3);
      const opCloud = (0.92 - 0.06 * cloudFactor).toFixed(3);

      if (cloudLeftRef.current) {
        cloudLeftRef.current.style.transform = `translate3d(${xLeft}px, 0, 0) scale(${sCloud})`;
        cloudLeftRef.current.style.opacity = opCloud;
      }
      if (cloudRightRef.current) {
        cloudRightRef.current.style.transform = `translate3d(${xRight}px, 0, 0) scale(${sCloud})`;
        cloudRightRef.current.style.opacity = opCloud;
      }

      // -----------------------------------------------------------------
      // 2. MOUNTAINS: Ascend smoothly from bottom (First after clouds)
      // -----------------------------------------------------------------
      if (mountainRef.current) {
        const baseOffsetY = isMobile ? 140 : isTablet ? 180 : 220;
        const mountainY = (baseOffsetY * (1 - mountainFactor)).toFixed(2);
        const mountainOp = (mountainFactor * 1.0).toFixed(3);
        const mountainScale = (0.96 + 0.04 * mountainFactor).toFixed(3);

        mountainRef.current.style.transform = `translate3d(0, ${mountainY}px, 0) scale(${mountainScale})`;
        mountainRef.current.style.opacity = mountainOp;
      }

      // -----------------------------------------------------------------
      // 3. EDITORIAL TEXT & CTAS: 3D Surge into crisp focus (After mountains)
      // -----------------------------------------------------------------
      if (contentWrapperRef.current) {
        const scaleContent = (0.80 + 0.20 * textFactor).toFixed(3);
        const yContent = ((isMobile ? 24 : 36) * (1 - textFactor)).toFixed(2);
        const opContent = (textFactor * 1.0).toFixed(3);
        const blurContent =
          textFactor > 0.88
            ? "none"
            : `blur(${((1 - textFactor) * 6).toFixed(1)}px)`;

        contentWrapperRef.current.style.transform = `translate3d(0, ${yContent}px, 0) scale(${scaleContent})`;
        contentWrapperRef.current.style.opacity = opContent;
        contentWrapperRef.current.style.filter = blurContent;
      }
    };

    let lastTime: number | null = null;

    // Velvet interpolation loop for buttery-smooth responsiveness
    const tick = (now: number) => {
      if (lastTime === null) lastTime = now;
      const dt = Math.min(0.05, Math.max(0.008, (now - lastTime) / 1000));
      lastTime = now;

      const diff = targetP - currentP;
      if (Math.abs(diff) < 0.0004) {
        currentP = targetP;
        render(currentP);
        rafId = null;
        lastTime = null;
        return;
      }

      // Dignified progression velocity cap
      const maxVelocity = 0.85;
      const maxStep = maxVelocity * dt;

      // Exponential decay damping
      const lerpRate = 4.2;
      const rawStep = diff * (1 - Math.exp(-lerpRate * dt));
      const clampedStep = Math.sign(rawStep) * Math.min(Math.abs(rawStep), maxStep);

      currentP += clampedStep;
      render(currentP);
      rafId = requestAnimationFrame(tick);
    };

    const requestTick = () => {
      if (!isIntersecting) return;
      targetP = computeTargetP();
      if (rafId === null) {
        lastTime = null;
        rafId = requestAnimationFrame(tick);
      }
    };

    const onScroll = () => requestTick();
    const onResize = () => requestTick();

    // IntersectionObserver guarantees zero scroll overhead when off-screen
    const observer = new IntersectionObserver(
      ([entry]) => {
        isIntersecting = entry.isIntersecting;
        if (isIntersecting) {
          targetP = computeTargetP();
          if (!isInitialized) {
            currentP = targetP;
            render(currentP);
            isInitialized = true;
          } else {
            requestTick();
          }
          window.addEventListener("scroll", onScroll, { passive: true });
          window.addEventListener("resize", onResize, { passive: true });
        } else {
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("resize", onResize);
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
            lastTime = null;
          }
        }
      },
      { rootMargin: "300px 0px 300px 0px", threshold: 0 }
    );

    observer.observe(section);

    // Initial calculation on mount
    targetP = computeTargetP();
    currentP = targetP;
    render(currentP);
    isInitialized = true;

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isReducedMotion]);

  return (
    <section
      ref={sectionRef}
      id="final-cta"
      className="relative w-full h-[360vh] sm:h-[380vh] lg:h-[400vh] bg-[#111110] text-text-primary select-none"
      aria-labelledby="cta-heading"
    >
      {/* =================================================================
          LOCKED SCREEN STICKY VIEWPORT (Pins to viewport during scroll track)
          ================================================================= */}
      <div
        ref={viewportRef}
        className="sticky top-0 w-full h-screen overflow-hidden flex flex-col justify-center items-center bg-[#111110] select-none"
      >
        {/* =================================================================
            EMERGING MOUNTAIN HORIZON (z-[5]: Rises upward after clouds part, BEFORE text)
            Initial state: completely hidden (opacity 0, translateY 220px)
            ================================================================= */}
        <div
          ref={mountainRef}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[1920px] pointer-events-none select-none will-change-[transform,opacity] z-[5] flex justify-center items-end"
          style={{ opacity: 0, transform: "translate3d(0, 220px, 0)" }}
          aria-hidden="true"
        >
          <Image
            src="/images/mountains-dark.webp"
            alt=""
            width={1924}
            height={610}
            priority
            className="w-full h-auto max-h-[48vh] sm:max-h-[52vh] lg:max-h-[56vh] object-contain object-bottom block"
          />
        </div>

        {/* =================================================================
            EDITORIAL CONTENT & CALLS TO ACTION (z-[10])
            Surges forward AFTER mountains have risen: scale(0.80) -> scale(1.0)
            ================================================================= */}
        <div
          ref={contentWrapperRef}
          className="layout-container w-full relative z-[10] will-change-[transform,opacity,filter]"
          style={{ perspective: "1200px", opacity: 0, transform: "translate3d(0, 36px, 0) scale(0.80)" }}
        >
          <div className="max-w-4xl mx-auto text-center flex flex-col items-center select-text">
            {/* Art-Directed Two-Statement Headline */}
            <h2
              id="cta-heading"
              className="font-sans text-[44px] sm:text-[58px] md:text-[68px] lg:text-[78px] xl:text-[84px] leading-[0.98] sm:leading-[1.02] tracking-[-0.04em] max-w-[880px] mx-auto select-text"
            >
              <span className="block font-medium text-[#F2F0EB]">Your code.</span>
              <span className="block font-normal text-[#DDD9D0] mt-1.5 sm:mt-2">
                Ready for what’s next.
              </span>
            </h2>

            {/* Refined Supporting Copy */}
            <p className="font-sans text-[16.5px] sm:text-[18px] lg:text-[19.5px] leading-[1.55] text-[#9E9B93] max-w-[500px] mx-auto mt-7 sm:mt-8 mb-10 sm:mb-12">
              Bring your next idea to life. Start with your code and build toward
              something worth shipping.
            </p>

            {/* Actions: High-Contrast Burnt Orange Primary + Quiet Border-Defined Secondary */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-4.5 w-full sm:w-auto">
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

        {/* =================================================================
            LEFT CLOUD SECTION (z-[15]: Towering diagrammatic illustration)
            ================================================================= */}
        <div
          ref={cloudLeftRef}
          className="absolute -left-[12vw] sm:-left-[8vw] lg:-left-[5vw] top-1/2 -translate-y-1/2 h-[104vh] min-h-[750px] w-auto pointer-events-none select-none will-change-[transform,opacity] z-[15] flex items-center justify-start"
          aria-hidden="true"
        >
          <Image
            src="/images/clouds/diagram-cloud-left-v2.webp"
            alt=""
            width={1200}
            height={896}
            priority
            className="h-full w-auto max-w-none object-contain block opacity-90"
          />
        </div>

        {/* =================================================================
            RIGHT CLOUD SECTION (z-[15]: Towering diagrammatic illustration)
            ================================================================= */}
        <div
          ref={cloudRightRef}
          className="absolute -right-[12vw] sm:-right-[8vw] lg:-right-[5vw] top-1/2 -translate-y-1/2 h-[104vh] min-h-[750px] w-auto pointer-events-none select-none will-change-[transform,opacity] z-[15] flex items-center justify-end"
          aria-hidden="true"
        >
          <Image
            src="/images/clouds/diagram-cloud-right-v2.webp"
            alt=""
            width={1200}
            height={896}
            priority
            className="h-full w-auto max-w-none object-contain block opacity-90"
          />
        </div>

        {/* =================================================================
            ATMOSPHERIC PERIMETER FALLOFF (z-[25])
            Soft vertical feathering at section edges to transition cleanly
            ================================================================= */}
        <div
          className="absolute inset-0 pointer-events-none z-[25]"
          style={{
            background:
              "linear-gradient(to bottom, #111110 0%, transparent 12%, transparent 88%, #111110 100%)",
          }}
          aria-hidden="true"
        />
      </div>
    </section>
  );
}

export default FinalCta;
