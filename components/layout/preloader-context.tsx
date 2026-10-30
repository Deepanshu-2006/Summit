"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

export type PreloaderPhase = "dark" | "tracing" | "revealing" | "complete";

type ProgressListener = (progress: number, progressFloat: number) => void;

interface PreloaderContextValue {
  phase: PreloaderPhase;
  progress: number;
  progressFloat: number;
  isComplete: boolean;
  isHeroActive: boolean;
  subscribeProgress: (cb: ProgressListener) => () => void;
  replay: () => void;
}

const PreloaderContext = createContext<PreloaderContextValue>({
  phase: "complete",
  progress: 100,
  progressFloat: 100,
  isComplete: true,
  isHeroActive: true,
  subscribeProgress: () => () => {},
  replay: () => {},
});

/**
 * High-precision algebraic sigmoid easing curve
 * Produces a buttery, continuous acceleration and deceleration
 * with an extended, fluid cruising speed through the mid-stages.
 */
function easeProgress(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const a = Math.pow(t, 1.6);
  const b = Math.pow(1 - t, 1.6);
  return a / (a + b);
}

export function PreloaderProvider({ children }: { children: React.ReactNode }) {
  // Start with "dark" and progress 0 so reload immediately displays the preloader without flash
  const [phase, setPhase] = useState<PreloaderPhase>("dark");
  const [progress, setProgress] = useState<number>(0);
  const [progressFloat, setProgressFloat] = useState<number>(0);
  const [isHeroActive, setIsHeroActive] = useState<boolean>(false);

  const listenersRef = useRef<Set<ProgressListener>>(new Set());
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const rafRef = useRef<number | null>(null);

  const subscribeProgress = useCallback((cb: ProgressListener) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  const clearAllTimers = useCallback(() => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const runSequence = useCallback(() => {
    clearAllTimers();

    // Reset initial state
    setPhase("dark");
    setProgress(0);
    setProgressFloat(0);
    setIsHeroActive(false);

    // Preload critical mountain images immediately
    if (typeof window !== "undefined") {
      const imgMountain = new Image();
      imgMountain.src = "/images/hero/hero-engraved-mountains-fullbleed.webp";
      const imgContours = new Image();
      imgContours.src = "/images/hero/hero-mountain-contours.webp";
    }

    const startTime = performance.now();
    const duration = 2400; // 2.4s calibrated duration

    let lastInt = -1;
    let heroTriggered = false;
    let currentPhase: PreloaderPhase = "dark";

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const rawT = Math.min(elapsed / duration, 1);

      // Smooth custom algebraic sigmoid easing
      const easedT = easeProgress(rawT);
      const floatPct = Math.min(100, Math.max(0, easedT * 100));
      const intPct = Math.min(100, Math.floor(floatPct));

      // 1. Notify direct high-frequency subscribers (Canvas, DOM counter) immediately
      // Runs at 60Hz / 120Hz display refresh without React reconciliation latency
      listenersRef.current.forEach((cb) => {
        try {
          cb(intPct, floatPct);
        } catch (e) {
          console.error("Progress listener error:", e);
        }
      });

      // 2. Continuous phase determination
      let nextPhase: PreloaderPhase = currentPhase;
      if (floatPct < 4) {
        nextPhase = "dark";
      } else if (floatPct < 65) {
        nextPhase = "tracing";
      } else if (floatPct < 96) {
        nextPhase = "revealing";
      } else {
        nextPhase = "complete";
      }

      if (nextPhase !== currentPhase) {
        currentPhase = nextPhase;
        setPhase(nextPhase);
      }

      // 3. Fluid Hero text handoff at ~92%
      // Begins headline character entrance right as mountain resolves
      if (!heroTriggered && floatPct >= 92) {
        heroTriggered = true;
        setIsHeroActive(true);
      }

      // 4. Update React progress state on integer changes
      if (intPct !== lastInt) {
        lastInt = intPct;
        setProgress(intPct);
        setProgressFloat(floatPct);
      }

      if (rawT < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Final frame lock
        setProgress(100);
        setProgressFloat(100);
        setPhase("complete");
        setIsHeroActive(true);
        listenersRef.current.forEach((cb) => {
          try {
            cb(100, 100);
          } catch {}
        });
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [clearAllTimers]);

  useEffect(() => {
    // Check prefers-reduced-motion
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isReduced) {
      setProgress(100);
      setProgressFloat(100);
      setPhase("complete");
      setIsHeroActive(true);
      return;
    }

    // Always trigger preloader on reload / fresh load
    runSequence();

    return () => {
      clearAllTimers();
    };
  }, [runSequence, clearAllTimers]);

  const replay = useCallback(() => {
    runSequence();
  }, [runSequence]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { __preloaderReplay?: () => void }).__preloaderReplay = replay;
    }
  }, [replay]);

  // Lock body scroll during preloader, release as hero resolves
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
        progressFloat,
        isComplete: phase === "complete",
        isHeroActive,
        subscribeProgress,
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
