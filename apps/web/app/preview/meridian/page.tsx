"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";

/**
 * Meridian Architecture & Spatial Design
 * Dedicated full-page demo website running on Jetway.
 *
 * Characteristics:
 * - Warm ivory/cream background (#F7F5F0)
 * - Deep charcoal typography (#1C1A17)
 * - Editorial serif & grotesk pairings
 * - Large architectural photography
 * - 4 distinct content sections + complete studio footer
 * - Autonomous cinematic auto-scroll controller with pause-on-interaction
 */
export default function MeridianPreviewPage() {
  const [activeNav, setActiveNav] = useState<string>("works");
  const isInteractingRef = useRef<boolean>(false);
  const isHoveredRef = useRef<boolean>(false);
  const isPausedFromParentRef = useRef<boolean>(false);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Auto-scroll controller
  useEffect(() => {
    // Check user preference for reduced motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) return;

    let state: "PAUSE_TOP" | "SCROLL_DOWN" | "PAUSE_BOTTOM" | "SCROLL_UP" =
      "PAUSE_TOP";
    let stateStartTime = performance.now();
    let startScrollY = 0;
    let targetScrollY = 0;

    const DURATION_PAUSE_TOP = 2200; // 2.2s at top
    const DURATION_SCROLL_DOWN = 26000; // 26s gentle cinematic scroll down
    const DURATION_PAUSE_BOTTOM = 3000; // 3.0s at bottom
    const DURATION_SCROLL_UP = 4200; // 4.2s smooth return to top

    // Smooth easing functions
    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const easeInOutQuad = (t: number) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const getMaxScroll = () =>
      Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      );

    const step = (now: number) => {
      const isBlocked =
        isInteractingRef.current ||
        isHoveredRef.current ||
        isPausedFromParentRef.current ||
        document.hidden;

      if (!isBlocked) {
        const maxScroll = getMaxScroll();
        const elapsed = now - stateStartTime;

        if (state === "PAUSE_TOP") {
          if (elapsed >= DURATION_PAUSE_TOP && maxScroll > 0) {
            state = "SCROLL_DOWN";
            stateStartTime = now;
            startScrollY = window.scrollY;
            targetScrollY = maxScroll;
          }
        } else if (state === "SCROLL_DOWN") {
          const progress = Math.min(1, elapsed / DURATION_SCROLL_DOWN);
          const currentY =
            startScrollY + (targetScrollY - startScrollY) * easeInOutQuad(progress);
          window.scrollTo(0, currentY);

          if (progress >= 1 || currentY >= maxScroll - 2) {
            state = "PAUSE_BOTTOM";
            stateStartTime = now;
          }
        } else if (state === "PAUSE_BOTTOM") {
          if (elapsed >= DURATION_PAUSE_BOTTOM) {
            state = "SCROLL_UP";
            stateStartTime = now;
            startScrollY = window.scrollY;
            targetScrollY = 0;
          }
        } else if (state === "SCROLL_UP") {
          const progress = Math.min(1, elapsed / DURATION_SCROLL_UP);
          const currentY =
            startScrollY + (targetScrollY - startScrollY) * easeInOutCubic(progress);
          window.scrollTo(0, currentY);

          if (progress >= 1 || currentY <= 2) {
            window.scrollTo(0, 0);
            state = "PAUSE_TOP";
            stateStartTime = now;
          }
        }
      } else {
        // When user is interacting, keep the timer synced to now
        stateStartTime = now;
        startScrollY = window.scrollY;
      }

      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);

    // Interaction handler: pause on wheel, touch, or click; resume after quiet delay
    const handleUserInteraction = () => {
      isInteractingRef.current = true;
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);

      resumeTimeoutRef.current = setTimeout(() => {
        isInteractingRef.current = false;
        // Resume from current scroll position
        stateStartTime = performance.now();
        startScrollY = window.scrollY;
        const maxScroll = getMaxScroll();

        // If user left near bottom, scroll up; otherwise continue down
        if (window.scrollY >= maxScroll - 60) {
          state = "PAUSE_BOTTOM";
        } else {
          state = "SCROLL_DOWN";
          targetScrollY = maxScroll;
        }
      }, 3500); // Resume 3.5s after user interaction ends
    };

    const handleMouseEnter = () => {
      isHoveredRef.current = true;
    };

    const handleMouseLeave = () => {
      isHoveredRef.current = false;
      // Restart state time from current position
      stateStartTime = performance.now();
      startScrollY = window.scrollY;
    };

    // Listen for parent messages (e.g. when Jetway preview is out of view)
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "JETWAY_PREVIEW_PAUSE") {
        isPausedFromParentRef.current = true;
      } else if (e.data?.type === "JETWAY_PREVIEW_RESUME") {
        isPausedFromParentRef.current = false;
        stateStartTime = performance.now();
        startScrollY = window.scrollY;
      }
    };

    window.addEventListener("wheel", handleUserInteraction, { passive: true });
    window.addEventListener("touchstart", handleUserInteraction, { passive: true });
    window.addEventListener("mousedown", handleUserInteraction, { passive: true });
    window.addEventListener("mouseenter", handleMouseEnter);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("message", handleMessage);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
      window.removeEventListener("wheel", handleUserInteraction);
      window.removeEventListener("touchstart", handleUserInteraction);
      window.removeEventListener("mousedown", handleUserInteraction);
      window.removeEventListener("mouseenter", handleMouseEnter);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return (
    <div className="w-full min-h-screen bg-[#F7F5F0] text-[#1C1A17] font-sans antialiased selection:bg-[#E2DDD3] selection:text-[#1C1A17]">
      {/* =================================================================
          01. EDITORIAL HEADER & NAVIGATION
          ================================================================= */}
      <header className="sticky top-0 z-40 w-full bg-[#F7F5F0]/90 backdrop-blur-md border-b border-[#E7E2D6] px-5 sm:px-8 lg:px-12 py-3 sm:py-3.5 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Studio Wordmark */}
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-[18px] sm:text-[20px] font-semibold tracking-[-0.02em] text-[#1C1A17]">
              MERIDIAN
            </span>
            <span className="hidden sm:inline font-mono text-[9.5px] tracking-[0.18em] uppercase text-[#736E65]">
              STUDIO
            </span>
          </div>

          {/* Nav Links */}
          <nav className="flex items-center gap-5 sm:gap-8 text-[12px] tracking-[0.04em]">
            <button
              type="button"
              onClick={() => setActiveNav("works")}
              className={`transition-colors cursor-pointer ${
                activeNav === "works"
                  ? "text-[#1C1A17] font-medium"
                  : "text-[#736E65] hover:text-[#1C1A17]"
              }`}
            >
              Selected Works
            </button>
            <button
              type="button"
              onClick={() => setActiveNav("studio")}
              className={`transition-colors cursor-pointer ${
                activeNav === "studio"
                  ? "text-[#1C1A17] font-medium"
                  : "text-[#736E65] hover:text-[#1C1A17]"
              }`}
            >
              The Practice
            </button>
            <button
              type="button"
              onClick={() => setActiveNav("monograph")}
              className={`hidden md:inline transition-colors cursor-pointer ${
                activeNav === "monograph"
                  ? "text-[#1C1A17] font-medium"
                  : "text-[#736E65] hover:text-[#1C1A17]"
              }`}
            >
              Monograph
            </button>
          </nav>

          {/* Location & Status */}
          <div className="hidden lg:flex items-center gap-2 font-mono text-[10.5px] text-[#736E65]">
            <span>Zürich</span>
            <span>—</span>
            <span>Tokyo</span>
            <span>—</span>
            <span>Oslo</span>
          </div>
        </div>
      </header>

      {/* =================================================================
          02. HERO SECTION: Big Editorial Typography & Full-Width Pavilion
          ================================================================= */}
      <section className="px-5 sm:px-8 lg:px-12 pt-8 sm:pt-12 pb-10 max-w-7xl mx-auto">
        <div className="max-w-4xl mb-6 sm:mb-8">
          <div className="inline-block font-mono text-[10px] tracking-[0.2em] uppercase text-[#736E65] mb-2 sm:mb-3">
            ARCHITECTURE & SPATIAL DESIGN · EST. 2016
          </div>
          <h1 className="font-serif text-[34px] sm:text-[46px] lg:text-[54px] font-normal leading-[1.06] tracking-[-0.03em] text-[#1C1A17] mb-3 sm:mb-4">
            Architecture shaped by light, material, and silence.
          </h1>
          <p className="text-[14px] sm:text-[16px] text-[#635E54] leading-[1.6] max-w-2xl font-light">
            An international architecture practice crafting residences, pavilions,
            and quiet interiors deeply integrated with natural topography.
          </p>
        </div>

        {/* Hero Architectural Image */}
        <div className="w-full relative aspect-[16/9] rounded-[4px] overflow-hidden bg-[#E9E4D8] border border-[#E0DACE]">
          <Image
            src="/images/meridian/hero-alpine.jpg"
            alt="Alpine Pavilion 01 by Meridian Studio"
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1200px"
            className="object-cover"
          />
        </div>
        <div className="flex items-center justify-between pt-3 text-[12px] font-mono text-[#736E65]">
          <span>Alpine Pavilion 01 · Engadin Valley, Switzerland</span>
          <span className="hidden sm:inline">Cast concrete, native larch, mountain slate</span>
        </div>
      </section>

      {/* =================================================================
          03. SELECTED WORKS: Asymmetric Showcase 01 & 02
          ================================================================= */}
      <section className="px-6 sm:px-10 lg:px-16 py-16 sm:py-24 border-t border-[#E7E2D6] max-w-7xl mx-auto">
        <div className="flex items-baseline justify-between mb-12">
          <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#736E65]">
            01 / SELECTED WORKS
          </span>
          <span className="text-[13px] text-[#635E54]">
            Recent completions (2024–2026)
          </span>
        </div>

        {/* Work 01: Villa Sōra */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center mb-20 sm:mb-28">
          <div className="lg:col-span-5 space-y-4">
            <div className="font-mono text-[11px] text-[#8C867B] tracking-wider uppercase">
              Nagano, Japan · 2025
            </div>
            <h2 className="font-serif text-[32px] sm:text-[40px] font-normal tracking-[-0.02em] leading-tight text-[#1C1A17]">
              Villa Sōra
            </h2>
            <p className="text-[15px] sm:text-[16px] text-[#635E54] leading-[1.65] font-light">
              Constructed from charred Japanese cedar (Yakisugi) and local riverbed
              granite, arranged around a central moss garden to capture morning mist
              and changing seasons.
            </p>
            <div className="pt-2 flex items-center gap-6 text-[12px] font-mono text-[#736E65]">
              <span>Area: 420 m²</span>
              <span>•</span>
              <span>Timber framing</span>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="relative aspect-[4/3] rounded-[4px] overflow-hidden bg-[#E9E4D8] border border-[#E0DACE]">
              <Image
                src="/images/meridian/villa-sora.jpg"
                alt="Villa Sōra courtyard in Nagano"
                fill
                sizes="(max-width: 1024px) 100vw, 700px"
                className="object-cover"
              />
            </div>
          </div>
        </div>

        {/* Work 02: Interior Travertine Living Space */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div className="relative aspect-[4/3] rounded-[4px] overflow-hidden bg-[#E9E4D8] border border-[#E0DACE]">
              <Image
                src="/images/meridian/interior-travertine.jpg"
                alt="Travertine and oak interior space"
                fill
                sizes="(max-width: 1024px) 100vw, 700px"
                className="object-cover"
              />
            </div>
          </div>

          <div className="lg:col-span-5 order-1 lg:order-2 space-y-4">
            <div className="font-mono text-[11px] text-[#8C867B] tracking-wider uppercase">
              Zurichberg Residence · 2024
            </div>
            <h2 className="font-serif text-[32px] sm:text-[40px] font-normal tracking-[-0.02em] leading-tight text-[#1C1A17]">
              Living in Quietude
            </h2>
            <p className="text-[15px] sm:text-[16px] text-[#635E54] leading-[1.65] font-light">
              Lime-washed walls and monolithic travertine stone create an
              unhurried domestic atmosphere where daylight moves undisturbed across
              natural textures.
            </p>
            <div className="pt-2 flex items-center gap-6 text-[12px] font-mono text-[#736E65]">
              <span>Private residence</span>
              <span>•</span>
              <span>Custom furniture</span>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================
          04. STUDIO PHILOSOPHY / MANIFESTO (Full-width Ivory Quote)
          ================================================================= */}
      <section className="bg-[#EFECE3] border-y border-[#E2DDD0] py-20 sm:py-28 px-6 sm:px-10 lg:px-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <span className="font-mono text-[11px] tracking-[0.24em] uppercase text-[#8C867B]">
            02 / PHILOSOPHY
          </span>
          <blockquote className="font-serif text-[30px] sm:text-[44px] lg:text-[52px] font-normal leading-[1.14] tracking-[-0.02em] text-[#1C1A17]">
            “Space is not empty. It is a slow instrument for atmosphere, light, and
            memory.”
          </blockquote>
          <div className="text-[13px] font-mono text-[#736E65] tracking-widest uppercase">
            MERIDIAN MANIFESTO — ITEM IV
          </div>
        </div>

        {/* Three Principles */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 pt-16 mt-16 border-t border-[#DFD8C9]">
          <div className="space-y-2">
            <div className="font-mono text-[11px] text-[#8C867B]">01 / TOPOGRAPHY</div>
            <h3 className="font-serif text-[20px] font-medium text-[#1C1A17]">
              Rooted in Terrain
            </h3>
            <p className="text-[14px] text-[#635E54] leading-relaxed font-light">
              Every building begins with the soil and horizon. We study geological
              contours to touch the earth as lightly as possible.
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-mono text-[11px] text-[#8C867B]">02 / HONEST STONE</div>
            <h3 className="font-serif text-[20px] font-medium text-[#1C1A17]">
              Enduring Materials
            </h3>
            <p className="text-[14px] text-[#635E54] leading-relaxed font-light">
              Untreated cedar, honed limestone, and cast bronze. Materials that
              patina naturally and gain quiet character over generations.
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-mono text-[11px] text-[#8C867B]">03 / DIFFUSED LIGHT</div>
            <h3 className="font-serif text-[20px] font-medium text-[#1C1A17]">
              Atmospheric Cadence
            </h3>
            <p className="text-[14px] text-[#635E54] leading-relaxed font-light">
              Windows are not just openings; they are deliberate apertures framing
              sky, shadow, and passing clouds throughout the day.
            </p>
          </div>
        </div>
      </section>

      {/* =================================================================
          05. SHOWCASE 03: Full-Bleed Nordic Fjord Pavilion
          ================================================================= */}
      <section className="px-6 sm:px-10 lg:px-16 py-16 sm:py-24 max-w-7xl mx-auto">
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <div className="font-mono text-[11px] text-[#8C867B] tracking-wider uppercase mb-1">
              Lofoten, Norway · 2026
            </div>
            <h2 className="font-serif text-[30px] sm:text-[38px] font-normal tracking-[-0.02em] text-[#1C1A17]">
              The Fjord Sanctuary
            </h2>
          </div>
          <span className="hidden sm:inline font-mono text-[12px] text-[#736E65]">
            Atlantic Coastal Reserve
          </span>
        </div>

        <div className="w-full relative aspect-[16/9] rounded-[4px] overflow-hidden bg-[#E9E4D8] border border-[#E0DACE] mb-4">
          <Image
            src="/images/meridian/nordic-fjord.jpg"
            alt="Nordic timber pavilion on a rocky fjord coast in Norway"
            fill
            sizes="(max-width: 1280px) 100vw, 1200px"
            className="object-cover"
          />
        </div>
        <div className="flex items-center justify-between text-[12px] font-mono text-[#736E65]">
          <span>Glazed seaside pavilion resting directly on prehistoric granite</span>
          <span>Commissioned by the Nordic Arts Trust</span>
        </div>
      </section>

      {/* =================================================================
          06. MONOGRAPH & PUBLICATIONS
          ================================================================= */}
      <section className="px-6 sm:px-10 lg:px-16 py-16 border-t border-[#E7E2D6] max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-3">
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#8C867B]">
              03 / MONOGRAPH
            </span>
            <h3 className="font-serif text-[28px] sm:text-[34px] font-normal text-[#1C1A17] tracking-tight">
              Structures in Topography (2018–2026)
            </h3>
            <p className="text-[15px] text-[#635E54] leading-relaxed max-w-2xl font-light">
              A 320-page monograph documenting twenty-two completed spatial
              projects, accompanied by essays on stillness, concrete, and alpine
              horizons.
            </p>
          </div>

          <div className="lg:col-span-4 lg:text-right">
            <button
              type="button"
              className="px-5 py-2.5 rounded-[2px] bg-[#1C1A17] hover:bg-[#33302B] text-[#F7F5F0] text-[13px] tracking-wide transition-colors font-medium cursor-pointer"
            >
              Order Monograph · CHF 85
            </button>
          </div>
        </div>
      </section>

      {/* =================================================================
          07. COMPLETE STUDIO FOOTER
          ================================================================= */}
      <footer className="bg-[#1C1A17] text-[#F7F5F0] px-6 sm:px-10 lg:px-16 pt-16 pb-12 mt-12">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-12 border-b border-[#33302B]">
            {/* Zurich */}
            <div className="space-y-1.5 font-mono text-[12px]">
              <div className="text-[#8C867B] uppercase tracking-wider text-[10.5px]">
                ZÜRICH
              </div>
              <div className="text-[#F7F5F0]">Neugasse 29</div>
              <div className="text-[#8C867B]">8005 Zürich, Switzerland</div>
            </div>

            {/* Tokyo */}
            <div className="space-y-1.5 font-mono text-[12px]">
              <div className="text-[#8C867B] uppercase tracking-wider text-[10.5px]">
                TOKYO
              </div>
              <div className="text-[#F7F5F0]">3-14-2 Minami-Aoyama</div>
              <div className="text-[#8C867B]">Minato-ku, Tokyo 107-0062</div>
            </div>

            {/* Oslo */}
            <div className="space-y-1.5 font-mono text-[12px]">
              <div className="text-[#8C867B] uppercase tracking-wider text-[10.5px]">
                OSLO
              </div>
              <div className="text-[#F7F5F0]">Havnepromenaden 12</div>
              <div className="text-[#8C867B]">0150 Oslo, Norway</div>
            </div>

            {/* Inquiries */}
            <div className="space-y-1.5 font-mono text-[12px]">
              <div className="text-[#8C867B] uppercase tracking-wider text-[10.5px]">
                INQUIRIES
              </div>
              <div className="text-[#F7F5F0]">studio@meridian.ch</div>
              <div className="text-[#8C867B]">+41 44 210 88 40</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-mono text-[#8C867B]">
            <div>© 2026 MERIDIAN ARCHITECTURE AG. ALL RIGHTS RESERVED.</div>
            <div className="flex items-center gap-6">
              <span>PRESS KIT</span>
              <span>INSTAGRAM</span>
              <span>IMPRINT</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
