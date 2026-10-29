"use client";

import React, { useEffect, useSyncExternalStore } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import "lenis/dist/lenis.css";

// SSR-safe subscription for prefers-reduced-motion
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
 * Navbar Height Constant (Matches var(--navbar-height): 72px)
 * Used to ensure anchor link targets aren't obscured beneath the sticky header.
 */
const NAVBAR_HEIGHT_OFFSET = -72;

/**
 * Internal Navigation & Anchor Listener
 * Coordinates in-page anchor links with the single shared Lenis instance.
 */
function LenisAnchorHandler() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;

    // Handle deep-link anchor on initial page load if present in the URL
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash;
      const targetEl = document.querySelector(hash);
      if (targetEl) {
        // Defer until initial render and layout dimensions have settled
        const timer = setTimeout(() => {
          const isReduced = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
          ).matches;
          lenis.scrollTo(targetEl as HTMLElement, {
            offset: NAVBAR_HEIGHT_OFFSET,
            immediate: isReduced,
            duration: isReduced ? 0 : 0.9,
          });
        }, 120);
        return () => clearTimeout(timer);
      }
    }

    const handleAnchorClick = (event: MouseEvent) => {
      // Ignore modified clicks (Ctrl, Cmd, Shift, Alt, middle-click)
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }

      // Find closest anchor tag within the composed path
      const anchor = (event.target as HTMLElement)?.closest?.("a");
      if (!anchor) return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref) return;

      const isReduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      // Case 1: "Back to top" link (href="#" or href="/#")
      if (rawHref === "#" || rawHref === "/#") {
        event.preventDefault();
        lenis.scrollTo(0, {
          offset: 0,
          duration: isReduced ? 0 : 1.0,
          immediate: isReduced,
        });
        history.pushState(null, "", window.location.pathname);
        return;
      }

      // Case 2: In-page hash link (e.g. href="#deployment-experience")
      if (rawHref.startsWith("#") && rawHref.length > 1) {
        const targetId = rawHref.slice(1);
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          event.preventDefault();
          lenis.scrollTo(targetEl, {
            offset: NAVBAR_HEIGHT_OFFSET,
            duration: isReduced ? 0 : 1.1,
            immediate: isReduced,
          });
          history.pushState(null, "", rawHref);
        }
      }
    };

    // Attach click listener at the document level with capture
    document.addEventListener("click", handleAnchorClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleAnchorClick, {
        capture: true,
      });
    };
  }, [lenis]);

  return null;
}

export interface SmoothScrollProviderProps {
  children: React.ReactNode;
}

/**
 * Site-wide Smooth Scroll Provider powered by Lenis
 *
 * Requirements & Characteristics:
 * 1. Single shared Lenis instance at the application root level.
 * 2. Tuned for a restrained, premium feel on MacBook trackpads (lerp: 0.095, no forced duration).
 * 3. Preserves native momentum scrolling on mobile devices (syncTouch: false).
 * 4. Respects `prefers-reduced-motion` dynamically with instant fallback.
 * 5. Handles sticky navbar offset (-72px) for all in-page anchors and back-to-top links.
 * 6. Clean lifecycle management preventing duplicate instances during React StrictMode.
 */
export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  return (
    <ReactLenis
      root
      options={{
        // Damping factor: 0.095 provides crisp, controlled response without sluggish inertia
        lerp: isReducedMotion ? 1 : 0.095,
        // Leave duration undefined so trackpad gestures feel natural and direct
        smoothWheel: !isReducedMotion,
        // Native touch on mobile: preserves 120Hz inertial physics without lag
        syncTouch: false,
        wheelMultiplier: 1.0,
        touchMultiplier: 1.0,
        autoRaf: true,
        stopInertiaOnNavigate: true,
        respectReducedMotion: true,
      }}
    >
      <LenisAnchorHandler />
      {children}
    </ReactLenis>
  );
}

export { useLenis };
export default SmoothScrollProvider;
