"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";

export type PreloaderPhase = "dark" | "tracing" | "revealing" | "complete";

interface PreloaderContextValue {
  phase: PreloaderPhase;
  progress: number;
  isComplete: boolean;
  replay: () => void;
}

const PreloaderContext = createContext<PreloaderContextValue>({
  phase: "complete",
  progress: 100,
  isComplete: true,
  replay: () => {},
});

export function PreloaderProvider({ children }: { children: React.ReactNode }) {
  // Start with "dark" and progress 0 so reload immediately displays the preloader without flash
  const [phase, setPhase] = useState<PreloaderPhase>("dark");
  const [progress, setProgress] = useState<number>(0);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const rafRef = useRef<number | null>(null);

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const runSequence = useCallback(() => {
    clearAllTimeouts();

    // Reset initial state
    setPhase("dark");
    setProgress(0);

    // Preload critical mountain images immediately
    if (typeof window !== "undefined") {
      const imgMountain = new Image();
      imgMountain.src = "/images/hero/hero-engraved-mountains-fullbleed.webp";
      const imgContours = new Image();
      imgContours.src = "/images/hero/hero-mountain-contours.webp";
    }

    const startTime = performance.now();
    const duration = 2100; // 2.1s duration to 100%

    // Animate progress percentage smoothly from 0 to 100
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Gentle ease-out curve for natural countdown/up pacing
      const currentPct = Math.min(100, Math.round(t * 100));
      setProgress(currentPct);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    // Stage 2: Contour Tracing from Scratch (280ms -> 1550ms)
    const t1 = setTimeout(() => {
      setPhase("tracing");
    }, 280);
    timeoutsRef.current.push(t1);

    // Stage 3: Fill / Reveal Illustration (1550ms -> 2200ms)
    const t2 = setTimeout(() => {
      setPhase("revealing");
    }, 1550);
    timeoutsRef.current.push(t2);

    // Stage 4: Seamless Hero Reveal & Completion (2250ms+)
    const t3 = setTimeout(() => {
      setProgress(100);
      setPhase("complete");
    }, 2250);
    timeoutsRef.current.push(t3);
  }, [clearAllTimeouts]);

  useEffect(() => {
    // Check prefers-reduced-motion
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isReduced) {
      setProgress(100);
      setPhase("complete");
      return;
    }

    // Always trigger preloader on reload / fresh load
    runSequence();

    return () => {
      clearAllTimeouts();
    };
  }, [runSequence, clearAllTimeouts]);

  const replay = useCallback(() => {
    runSequence();
  }, [runSequence]);

  useEffect(() => {
    if (phase !== "complete") {
      document.body.style.overflow = "hidden";
      window.scrollTo(0, 0);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [phase]);

  return (
    <PreloaderContext.Provider
      value={{
        phase,
        progress,
        isComplete: phase === "complete",
        replay,
      }}
    >
      {children}
    </PreloaderContext.Provider>
  );
}

export function usePreloader() {
  return useContext(PreloaderContext);
}
