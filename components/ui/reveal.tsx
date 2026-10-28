"use client";

import React, { useSyncExternalStore } from "react";
import { motion } from "motion/react";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  yOffset?: number;
  once?: boolean;
  as?: "div" | "section" | "header" | "article" | "p";
}

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
 * Reusable Scroll-Triggered Reveal Component
 * Provides subtle opacity + vertical movement entrances with natural cubic-bezier easing.
 * Fully SSR-safe and honors prefers-reduced-motion.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  duration = 0.6,
  yOffset = 18,
  once = true,
}: RevealProps) {
  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  if (isReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-50px" }}
      transition={{
        duration,
        delay,
        ease: [0.16, 1, 0.3, 1], // Restrained, smooth cubic-bezier
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default Reveal;
