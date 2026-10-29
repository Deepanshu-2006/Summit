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
 * Locked-Screen Scroll Experience with Volumetric Cloud Parting & Re-closing:
 * 1. Screen locks in place (sticky viewport during scroll track)
 * 2. On arrival, clouds are completely CLOSED over the screen
 * 3. On scroll, clouds move horizontally OUT to the edges
 * 4. Section content surges forward from inside the screen into full crisp focus
 * 5. When scrolling past the section, clouds move back TOGETHER, closing the scene before unpinning
 */
export function FinalCta() {
  const sectionRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Volumetric cloud layer references (Left & Right depth formations)
  const cloudLeftBackRef = useRef<HTMLDivElement>(null);
  const cloudLeftMidRef = useRef<HTMLDivElement>(null);
  const cloudLeftForeRef = useRef<HTMLDivElement>(null);
  const cloudRightBackRef = useRef<HTMLDivElement>(null);
  const cloudRightMidRef = useRef<HTMLDivElement>(null);
  const cloudRightForeRef = useRef<HTMLDivElement>(null);

  // Section content reference (surges from inside the screen)
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

      resetEl(cloudLeftBackRef.current, "translate3d(-320px, 0, 0)", "0.35");
      resetEl(cloudLeftMidRef.current, "translate3d(-520px, 0, 0)", "0.85");
      resetEl(cloudLeftForeRef.current, "translate3d(-640px, 0, 0)", "0.20");

      resetEl(cloudRightBackRef.current, "translate3d(320px, 0, 0)", "0.35");
      resetEl(cloudRightMidRef.current, "translate3d(520px, 0, 0)", "0.85");
      resetEl(cloudRightForeRef.current, "translate3d(640px, 0, 0)", "0.20");

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
    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

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
      // OPEN FACTOR CALCULATION:
      // p in [0.00 .. 0.40]: Opening (0.0 -> 1.0)
      // p in [0.40 .. 0.65]: Settled Open (1.0)
      // p in [0.65 .. 1.00]: Closing (1.0 -> 0.0) as user scrolls past
      // =================================================================
      let openFactor: number;
      if (p < 0.40) {
        openFactor = easeOutCubic(p / 0.40);
      } else if (p <= 0.65) {
        openFactor = 1.0;
      } else {
        openFactor = 1.0 - easeInOutCubic((p - 0.65) / 0.35);
      }

      // =================================================================
      // 1. CLOUD LAYER DISPLACEMENTS
      // Clouds start overlapping in the center (inward offset),
      // move out to the flanks (open), and return to the center (close)
      // =================================================================

      // Middle Clouds (Main volumetric masses)
      const inMid = isMobile ? 110 : isTablet ? 170 : 250;
      const outMid = isMobile ? 280 : isTablet ? 480 : 700;
      const xLMid = (inMid - (inMid + outMid) * openFactor).toFixed(2);
      const xRMid = (-inMid + (inMid + outMid) * openFactor).toFixed(2);
      const sMid = (1.0 + 0.04 * openFactor).toFixed(3);
      const opMid = (0.95 - 0.12 * openFactor).toFixed(3);

      if (cloudLeftMidRef.current) {
        cloudLeftMidRef.current.style.transform = `translate3d(${xLMid}px, 0, 0) scale(${sMid})`;
        cloudLeftMidRef.current.style.opacity = opMid;
      }
      if (cloudRightMidRef.current) {
        cloudRightMidRef.current.style.transform = `translate3d(${xRMid}px, 0, 0) scale(${sMid})`;
        cloudRightMidRef.current.style.opacity = opMid;
      }

      // Background Mist (Slower, broad parallax)
      const inBack = isMobile ? 70 : isTablet ? 110 : 160;
      const outBack = isMobile ? 190 : isTablet ? 330 : 480;
      const xLBack = (inBack - (inBack + outBack) * openFactor).toFixed(2);
      const xRBack = (-inBack + (inBack + outBack) * openFactor).toFixed(2);
      const sBack = (1.0 + 0.03 * openFactor).toFixed(3);
      const opBack = (0.50 - 0.12 * openFactor).toFixed(3);

      if (cloudLeftBackRef.current) {
        cloudLeftBackRef.current.style.transform = `translate3d(${xLBack}px, 0, 0) scale(${sBack})`;
        cloudLeftBackRef.current.style.opacity = opBack;
      }
      if (cloudRightBackRef.current) {
        cloudRightBackRef.current.style.transform = `translate3d(${xRBack}px, 0, 0) scale(${sBack})`;
        cloudRightBackRef.current.style.opacity = opBack;
      }

      // Foreground Wisps (Faster drift + fade)
      const inFore = isMobile ? 90 : isTablet ? 140 : 220;
      const outFore = isMobile ? 340 : isTablet ? 560 : 840;
      const xLFore = (inFore - (inFore + outFore) * openFactor).toFixed(2);
      const xRFore = (-inFore + (inFore + outFore) * openFactor).toFixed(2);
      const yLFore = ((isMobile ? 14 : 26) * (1 - openFactor)).toFixed(2);
      const yRFore = (-(isMobile ? 14 : 26) * (1 - openFactor)).toFixed(2);
      const opFore = Math.max(0.04, 0.80 * (1 - openFactor * 0.90)).toFixed(3);

      if (cloudLeftForeRef.current) {
        cloudLeftForeRef.current.style.transform = `translate3d(${xLFore}px, ${yLFore}px, 0)`;
        cloudLeftForeRef.current.style.opacity = opFore;
      }
      if (cloudRightForeRef.current) {
        cloudRightForeRef.current.style.transform = `translate3d(${xRFore}px, ${yRFore}px, 0)`;
        cloudRightForeRef.current.style.opacity = opFore;
      }

      // =================================================================
      // 2. SECTION CONTENT: COMES FROM INSIDE THE SCREEN
      // 3D forward surge from depth: scale(0.76) -> scale(1.0) with blur dissolve
      // =================================================================
      if (contentWrapperRef.current) {
        const scaleContent = (0.76 + 0.24 * openFactor).toFixed(3);
        const yContent = ((isMobile ? 30 : 45) * (1 - openFactor)).toFixed(2);
        const opContent = Math.min(1.0, Math.max(0.0, openFactor * 1.05)).toFixed(3);
        const blurContent =
          openFactor > 0.92
            ? "none"
            : `blur(${((1 - openFactor) * 8).toFixed(1)}px)`;

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
      className="relative w-full h-[240vh] sm:h-[260vh] lg:h-[280vh] bg-[#111110] text-text-primary select-none"
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
            LAYER 1: BACKGROUND MIST (z-[1]: Subtle, broad, slow-moving)
            ================================================================= */}
        <div
          ref={cloudLeftBackRef}
          className="absolute left-[-22%] sm:left-[-15%] lg:left-[-8%] top-1/2 -translate-y-1/2 w-[72%] sm:w-[60%] lg:w-[50%] max-w-[1050px] pointer-events-none select-none will-change-[transform,opacity] z-[1]"
          aria-hidden="true"
        >
          <Image
            src="/images/clouds/cloud-left-back.webp"
            alt=""
            width={1376}
            height={768}
            priority
            className="w-full h-auto object-contain block mix-blend-screen opacity-50"
          />
        </div>

        <div
          ref={cloudRightBackRef}
          className="absolute right-[-22%] sm:right-[-15%] lg:right-[-8%] top-1/2 -translate-y-1/2 w-[72%] sm:w-[60%] lg:w-[50%] max-w-[1050px] pointer-events-none select-none will-change-[transform,opacity] z-[1]"
          aria-hidden="true"
        >
          <Image
            src="/images/clouds/cloud-right-back.webp"
            alt=""
            width={1376}
            height={768}
            priority
            className="w-full h-auto object-contain block mix-blend-screen opacity-50"
          />
        </div>

        {/* =================================================================
            EDITORIAL CONTENT & CALLS TO ACTION (z-[10])
            Surges forward from depth: scale(0.76) -> scale(1.0)
            ================================================================= */}
        <div
          ref={contentWrapperRef}
          className="layout-container w-full relative z-[10] will-change-[transform,opacity,filter]"
          style={{ perspective: "1200px" }}
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
            LAYER 2: MIDDLE CLOUD FORMATIONS (z-[15]: Main visual masses)
            Move out horizontally on scroll, close back when scrolling past
            ================================================================= */}
        <div
          ref={cloudLeftMidRef}
          className="absolute left-[-16%] sm:left-[-10%] lg:left-[-4%] top-1/2 -translate-y-1/2 w-[78%] sm:w-[64%] lg:w-[54%] max-w-[1150px] pointer-events-none select-none will-change-[transform,opacity] z-[15]"
          aria-hidden="true"
        >
          <Image
            src="/images/clouds/cloud-left-mid.webp"
            alt=""
            width={1376}
            height={768}
            priority
            className="w-full h-auto object-contain block mix-blend-screen opacity-90"
          />
        </div>

        <div
          ref={cloudRightMidRef}
          className="absolute right-[-16%] sm:right-[-10%] lg:right-[-4%] top-1/2 -translate-y-1/2 w-[78%] sm:w-[64%] lg:w-[54%] max-w-[1150px] pointer-events-none select-none will-change-[transform,opacity] z-[15]"
          aria-hidden="true"
        >
          <Image
            src="/images/clouds/cloud-right-mid.webp"
            alt=""
            width={1376}
            height={768}
            priority
            className="w-full h-auto object-contain block mix-blend-screen opacity-90"
          />
        </div>

        {/* =================================================================
            LAYER 3: FOREGROUND WISPS (z-[20]: Delicate tendrils & depth)
            ================================================================= */}
        <div
          ref={cloudLeftForeRef}
          className="absolute left-[-8%] sm:left-[-2%] lg:left-[4%] top-[48%] -translate-y-1/2 w-[66%] sm:w-[56%] lg:w-[48%] max-w-[980px] pointer-events-none select-none will-change-[transform,opacity] z-[20]"
          aria-hidden="true"
        >
          <Image
            src="/images/clouds/cloud-left-fore.webp"
            alt=""
            width={1376}
            height={768}
            priority
            className="w-full h-auto object-contain block mix-blend-screen opacity-75"
          />
        </div>

        <div
          ref={cloudRightForeRef}
          className="absolute right-[-8%] sm:right-[-2%] lg:right-[4%] top-[48%] -translate-y-1/2 w-[66%] sm:w-[56%] lg:w-[48%] max-w-[980px] pointer-events-none select-none will-change-[transform,opacity] z-[20]"
          aria-hidden="true"
        >
          <Image
            src="/images/clouds/cloud-right-fore.webp"
            alt=""
            width={1376}
            height={768}
            priority
            className="w-full h-auto object-contain block mix-blend-screen opacity-75"
          />
        </div>

        {/* =================================================================
            ATMOSPHERIC PERIMETER FALLOFF (z-[25])
            Soft radial vignette dissolving edges seamlessly into #111110
            ================================================================= */}
        <div
          className="absolute inset-0 pointer-events-none z-[25]"
          style={{
            background:
              "radial-gradient(ellipse 92% 82% at 50% 50%, transparent 35%, rgba(17,17,16,0.55) 75%, #111110 100%)",
          }}
          aria-hidden="true"
        />
      </div>
    </section>
  );
}

export default FinalCta;
