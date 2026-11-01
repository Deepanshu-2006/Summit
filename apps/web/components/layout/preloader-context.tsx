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
  isTransitionDone: boolean;
  isHeroActive: boolean;
  subscribeProgress: (cb: ProgressListener) => () => void;
  replay: () => void;
}

const PreloaderContext = createContext<PreloaderContextValue>({
  phase: "complete",
  progress: 100,
  progressFloat: 100,
  isComplete: true,
  isTransitionDone: true,
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
  const [isTransitionDone, setIsTransitionDone] = useState<boolean>(false);
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

    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }

    // Reset initial state
    setPhase("dark");
    setProgress(0);
    setProgressFloat(0);
    setIsTransitionDone(false);
    setIsHeroActive(false);

    // Preload critical mountain images immediately
    if (typeof window !== "undefined") {
      const imgMountain = new Image();
      imgMountain.src = "/images/hero/hero-engraved-mountains-fullbleed.webp";
      const imgContours = new Image();
      imgContours.src = "/images/hero/hero-mountain-contours.webp";
    }

    const startTime = performance.now();
    const duration = 2100; // 2.1s duration for mountain contour drawing & full reveal

    let lastInt = -1;
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
      } else {
        nextPhase = "revealing";
      }

      if (nextPhase !== currentPhase) {
        currentPhase = nextPhase;
        setPhase(nextPhase);
      }

      // 3. Update React progress state on integer changes
      if (intPct !== lastInt) {
        lastInt = intPct;
        setProgress(intPct);
        setProgressFloat(floatPct);
      }

      if (rawT < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Preloader mountain tracing and counter transition is 100% DONE
        setProgress(100);
        setProgressFloat(100);
        setIsTransitionDone(true);

        listenersRef.current.forEach((cb) => {
          try {
            cb(100, 100);
          } catch {}
        });

        // "when transition done after that heading and illustration should appear with their animation after a little delay"
        // Hold for a deliberate cinematic breath (340ms little delay) so the resolved mountain can be absorbed
        const delayTimer = setTimeout(() => {
          setIsHeroActive(true);
          setPhase("complete");
        }, 340);
        timeoutsRef.current.push(delayTimer);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [clearAllTimers]);

  useEffect(() => {
    const finishPreloader = () => {
      setProgress(100);
      setProgressFloat(100);
      setIsTransitionDone(true);
      setIsHeroActive(true);
      setPhase("complete");
    };

    // Check if not on homepage (e.g. dashboard workspace routes)
    // Also skip the sequence for users who prefer reduced motion.
    if (
      window.location.pathname !== "/" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const frame = window.requestAnimationFrame(finishPreloader);
      return () => window.cancelAnimationFrame(frame);
    }

    // Always trigger preloader on reload / fresh load
    const frame = window.requestAnimationFrame(runSequence);

    return () => {
      window.cancelAnimationFrame(frame);
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

  // Lock body scroll during preloader, release smoothly as hero heading and illustrations enter
  useEffect(() => {
    if (!isHeroActive) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isHeroActive]);

  return (
    <PreloaderContext.Provider
      value={{
        phase,
        progress,
        progressFloat,
        isComplete: phase === "complete",
        isTransitionDone,
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
