"use client";

import React, { useEffect, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";
import { useLenis } from "@/components/layout/smooth-scroll-provider";

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
 * Keyframe Pose Definition for the 5-Act Choreography
 * Progress p maps smoothly from 0.0 (Hero top) to 1.0 (Final CTA bottom)
 */
interface SculpturePose {
  p: number;
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
  opacity: number;
  signalProgress: number;
}

const CHOREOGRAPHY: SculpturePose[] = [
  // Act 1 — Hero: Poised on the right, atmospheric, leaves left headline pristine
  {
    p: 0.0,
    posX: 2.2,
    posY: -0.15,
    posZ: -0.6,
    rotX: 0.38,
    rotY: -0.32,
    rotZ: 0.08,
    scale: 0.92,
    opacity: 0.72,
    signalProgress: 0.0,
  },
  // Act 1 → 2: Transition out of Hero
  {
    p: 0.16,
    posX: 1.4,
    posY: 0.1,
    posZ: -0.4,
    rotX: 0.52,
    rotY: 0.12,
    rotZ: -0.04,
    scale: 0.98,
    opacity: 0.82,
    signalProgress: 0.12,
  },
  // Act 2 — Early Sections (Deployment & Product Experience):
  // Pitches forward and glides left, framing the interactive playgrounds
  {
    p: 0.36,
    posX: -1.8,
    posY: -0.3,
    posZ: -0.5,
    rotX: 0.68,
    rotY: 0.65,
    rotZ: -0.14,
    scale: 1.08,
    opacity: 0.86,
    signalProgress: 0.35,
  },
  // Act 3 — Developer Experience:
  // Rolls to the right flank, framing DeveX editorial layout
  {
    p: 0.58,
    posX: 2.0,
    posY: 0.25,
    posZ: -0.3,
    rotX: 0.44,
    rotY: 1.35,
    rotZ: 0.12,
    scale: 1.02,
    opacity: 0.82,
    signalProgress: 0.60,
  },
  // Act 4 — Production Visibility & Getting Started:
  // Technical architectural alignment, interconnected geometry
  {
    p: 0.80,
    posX: 0.0,
    posY: -0.1,
    posZ: 0.1,
    rotX: 0.88,
    rotY: 2.05,
    rotZ: 0.02,
    scale: 1.14,
    opacity: 0.88,
    signalProgress: 0.84,
  },
  // Act 5 — Final CTA:
  // Sinks gracefully into the low horizon, converging signal into destination accent
  {
    p: 1.0,
    posX: 0.0,
    posY: -1.6,
    posZ: -0.3,
    rotX: 0.28,
    rotY: 2.75,
    rotZ: 0.0,
    scale: 1.25,
    opacity: 0.92,
    signalProgress: 1.0,
  },
];

/**
 * Smooth Hermite Interpolation between Pose Keyframes
 */
function interpolatePose(p: number): SculpturePose {
  const clampedP = Math.max(0, Math.min(1, p));

  // Find surrounding keyframes
  let idx = 0;
  for (let i = 0; i < CHOREOGRAPHY.length - 1; i++) {
    if (clampedP >= CHOREOGRAPHY[i].p && clampedP <= CHOREOGRAPHY[i + 1].p) {
      idx = i;
      break;
    }
  }

  const k1 = CHOREOGRAPHY[idx];
  const k2 = CHOREOGRAPHY[idx + 1] || k1;
  const range = k2.p - k1.p;
  const t = range > 0 ? (clampedP - k1.p) / range : 0;

  // Smooth quintic smootherstep easing between keyframes
  const smoothT = t * t * t * (t * (t * 6 - 15) + 10);

  const lerpVal = (a: number, b: number) => a + (b - a) * smoothT;

  return {
    p: clampedP,
    posX: lerpVal(k1.posX, k2.posX),
    posY: lerpVal(k1.posY, k2.posY),
    posZ: lerpVal(k1.posZ, k2.posZ),
    rotX: lerpVal(k1.rotX, k2.rotX),
    rotY: lerpVal(k1.rotY, k2.rotY),
    rotZ: lerpVal(k1.rotZ, k2.rotZ),
    scale: lerpVal(k1.scale, k2.scale),
    opacity: lerpVal(k1.opacity, k2.opacity),
    signalProgress: lerpVal(k1.signalProgress, k2.signalProgress),
  };
}

/**
 * TopographicSculpture
 *
 * A continuous, scroll-driven 3D background experience inspired by lenis.dev.
 * Features:
 * - A single persistent Three.js WebGL canvas positioned at z-0 behind the entire site.
 * - Organic, non-generic 3D wireframe terrain composed of ~100 fine contour rings
 *   and longitudinal structural ribs in warm ivory with restrained burnt-orange fault highlights.
 * - An elegant 3D infrastructure signal spline with an active luminous pulse traveling along it.
 * - Seamless 5-Act choreographic journey tied directly to normalized scroll progress.
 * - Continuous responsive trackpad interpolation without resetting across sections.
 * - Zero pointer interception (pointer-events: none) preserving all native interactions.
 */
export function TopographicSculpture() {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetProgressRef = useRef<number>(0);
  const currentProgressRef = useRef<number>(0);

  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  // Hook into Lenis scroll updates for real-time synchronization
  useLenis((lenis) => {
    if (typeof window === "undefined") return;
    const scrollMax =
      document.documentElement.scrollHeight - window.innerHeight;
    if (scrollMax > 0) {
      targetProgressRef.current = Math.max(
        0,
        Math.min(1, lenis.scroll / scrollMax)
      );
    }
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;

    // Fallback native scroll listener (works even before Lenis binds)
    const handleNativeScroll = () => {
      const scrollMax =
        document.documentElement.scrollHeight - window.innerHeight;
      if (scrollMax > 0) {
        targetProgressRef.current = Math.max(
          0,
          Math.min(1, window.scrollY / scrollMax)
        );
      }
    };
    window.addEventListener("scroll", handleNativeScroll, { passive: true });
    handleNativeScroll();

    // =========================================================================
    // 1. THREE.JS SCENE, CAMERA, & RENDERER INITIALIZATION
    // =========================================================================
    let width = window.innerWidth;
    let height = window.innerHeight;

    const scene = new THREE.Scene();
    // Atmospheric depth fog dissolving distant contour lines into deep background
    scene.fog = new THREE.FogExp2(0x111111, 0.042);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 80);
    camera.position.set(0, 0, 7.8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x111111, 0.0); // Transparent canvas over site bg
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    // Root Group for all sculpture elements
    const sculptureGroup = new THREE.Group();
    scene.add(sculptureGroup);

    // =========================================================================
    // 2. PROCEDURAL TOPOGRAPHIC WIREFRAME GEOMETRY
    // An intricate geological landform sliced into 96 fine contour elevations
    // with longitudinal structural survey ribs and signature burnt-orange fault lines.
    // =========================================================================
    const NUM_LAYERS = 96;
    const POINTS_PER_LAYER = 160;

    const contourPositions: number[] = [];
    const contourColors: number[] = [];

    // Color definitions
    const colorIvoryMajor = new THREE.Color(0xf5f5f3); // Major 10-interval elevation contours
    const colorIvoryMinor = new THREE.Color(0xc2bcad); // Fine intermediate contours
    const colorAccentOrange = new THREE.Color(0xd88762); // Signature geological fault ridges

    // Generate concentric elevation contour loops
    for (let i = 0; i < NUM_LAYERS; i++) {
      const yNorm = i / (NUM_LAYERS - 1);
      const y = -2.8 + yNorm * 5.6;

      // Geological envelope curve (massif profile with sculpted saddle and plateau)
      const baseR =
        2.2 * Math.sqrt(Math.max(0.02, 1.0 - Math.pow(y / 3.2, 2))) +
        0.35 * Math.cos(y * 1.5);

      const isMajor = i % 10 === 0;
      const isOrangeFault = i === 36 || i === 64 || i === 76; // Selected signature fault thresholds

      const ringVertices: THREE.Vector3[] = [];

      for (let j = 0; j <= POINTS_PER_LAYER; j++) {
        const theta = (j / POINTS_PER_LAYER) * Math.PI * 2;

        // Multi-frequency harmonic topographic noise
        const n1 = 0.38 * Math.sin(2 * theta + 0.5 * y);
        const n2 = 0.22 * Math.cos(3 * theta - 0.4 * y);
        const n3 = 0.14 * Math.sin(5 * theta + 0.9 * y);
        const n4 = 0.08 * Math.cos(7 * theta);

        // Razor fault ridge along theta ≈ 1.1 rad
        const ridge =
          0.38 *
          Math.exp(-9.0 * Math.pow(Math.sin(theta - 1.1) - 0.25, 2)) *
          (1.0 + 0.35 * y);

        const r = Math.max(0.1, baseR * (1.0 + n1 + n2 + n3 + n4) + ridge);
        const x = r * Math.cos(theta);
        const z = r * Math.sin(theta);

        ringVertices.push(new THREE.Vector3(x, y, z));
      }

      // Add line segment pairs for this ring
      for (let j = 0; j < ringVertices.length - 1; j++) {
        const p1 = ringVertices[j];
        const p2 = ringVertices[j + 1];

        contourPositions.push(p1.x, p1.y, p1.z);
        contourPositions.push(p2.x, p2.y, p2.z);

        // Color & alpha modulation
        let c = isMajor ? colorIvoryMajor : colorIvoryMinor;
        if (isOrangeFault) c = colorAccentOrange;

        // Faint elevation edge attenuation
        const edgeFade = 0.2 + 0.8 * (1.0 - Math.abs(yNorm - 0.5) * 1.6);
        contourColors.push(c.r * edgeFade, c.g * edgeFade, c.b * edgeFade);
        contourColors.push(c.r * edgeFade, c.g * edgeFade, c.b * edgeFade);
      }
    }

    // Generate longitudinal structural ribs (survey lattice meridians)
    const NUM_RIBS = 32;
    for (let rIdx = 0; rIdx < NUM_RIBS; rIdx++) {
      const ribTheta = (rIdx / NUM_RIBS) * Math.PI * 2;
      let prevPt: THREE.Vector3 | null = null;

      for (let i = 0; i < NUM_LAYERS; i += 2) {
        const yNorm = i / (NUM_LAYERS - 1);
        const y = -2.8 + yNorm * 5.6;

        const baseR =
          2.2 * Math.sqrt(Math.max(0.02, 1.0 - Math.pow(y / 3.2, 2))) +
          0.35 * Math.cos(y * 1.5);
        const n1 = 0.38 * Math.sin(2 * ribTheta + 0.5 * y);
        const n2 = 0.22 * Math.cos(3 * ribTheta - 0.4 * y);
        const n3 = 0.14 * Math.sin(5 * ribTheta + 0.9 * y);
        const n4 = 0.08 * Math.cos(7 * ribTheta);
        const ridge =
          0.38 *
          Math.exp(-9.0 * Math.pow(Math.sin(ribTheta - 1.1) - 0.25, 2)) *
          (1.0 + 0.35 * y);

        const r = Math.max(0.1, baseR * (1.0 + n1 + n2 + n3 + n4) + ridge);
        const curPt = new THREE.Vector3(
          r * Math.cos(ribTheta),
          y,
          r * Math.sin(ribTheta)
        );

        if (prevPt) {
          contourPositions.push(prevPt.x, prevPt.y, prevPt.z);
          contourPositions.push(curPt.x, curPt.y, curPt.z);

          // Ribs have muted transparency to create subtle parallax
          const ribColor = colorIvoryMinor.clone().multiplyScalar(0.24);
          contourColors.push(ribColor.r, ribColor.g, ribColor.b);
          contourColors.push(ribColor.r, ribColor.g, ribColor.b);
        }
        prevPt = curPt;
      }
    }

    const contourGeometry = new THREE.BufferGeometry();
    contourGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(contourPositions, 3)
    );
    contourGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(contourColors, 3)
    );

    const contourMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });

    const contourMesh = new THREE.LineSegments(
      contourGeometry,
      contourMaterial
    );
    sculptureGroup.add(contourMesh);

    // =========================================================================
    // 3. THE INFRASTRUCTURE SIGNAL
    // A thin, elegant burnt-orange line threading through the terrain
    // with a traveling pulse point symbolizing code moving to production.
    // =========================================================================
    const signalSplineControlPoints = [
      new THREE.Vector3(1.6, 2.4, 0.6),
      new THREE.Vector3(1.1, 1.8, 0.4),
      new THREE.Vector3(0.5, 1.3, -0.2),
      new THREE.Vector3(-0.2, 0.9, -0.5),
      new THREE.Vector3(-0.9, 0.5, -0.2),
      new THREE.Vector3(-1.4, 0.1, 0.3),
      new THREE.Vector3(-1.0, -0.4, 0.8),
      new THREE.Vector3(-0.4, -0.8, 0.9),
      new THREE.Vector3(0.3, -1.2, 0.6),
      new THREE.Vector3(0.7, -1.7, 0.2),
      new THREE.Vector3(0.4, -2.1, -0.2),
      new THREE.Vector3(0.0, -2.6, 0.0),
    ];

    const signalSpline = new THREE.CatmullRomCurve3(
      signalSplineControlPoints,
      false,
      "catmullrom",
      0.35
    );

    const SIGNAL_SAMPLES = 420;
    const signalPoints = signalSpline.getPoints(SIGNAL_SAMPLES);

    const signalPositions = new Float32Array((SIGNAL_SAMPLES + 1) * 3);
    for (let i = 0; i <= SIGNAL_SAMPLES; i++) {
      signalPositions[i * 3] = signalPoints[i].x;
      signalPositions[i * 3 + 1] = signalPoints[i].y;
      signalPositions[i * 3 + 2] = signalPoints[i].z;
    }

    const signalGeometry = new THREE.BufferGeometry();
    signalGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(signalPositions, 3)
    );
    signalGeometry.setDrawRange(0, 0); // Initially drawn at 0 length

    const signalMaterial = new THREE.LineBasicMaterial({
      color: 0xd88762,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });

    const signalLine = new THREE.Line(signalGeometry, signalMaterial);
    sculptureGroup.add(signalLine);

    // Leading Pulse Particle (Luminous burnt-orange signal head)
    const pulseGeo = new THREE.SphereGeometry(0.052, 14, 14);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0xe39a76,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
    pulseMesh.visible = false;
    sculptureGroup.add(pulseMesh);

    // =========================================================================
    // 4. ANIMATION & SMOOTH INTERPOLATION LOOP
    // =========================================================================
    let rafId: number | null = null;
    const clock = new THREE.Clock();

    const animate = () => {
      const dt = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Smooth damping interpolation for progress
      const progressDiff =
        targetProgressRef.current - currentProgressRef.current;
      currentProgressRef.current += progressDiff * Math.min(1, 10.0 * dt);

      const p = currentProgressRef.current;
      const pose = interpolatePose(p);

      // Microscopic organic breathing idle drift
      const idleFloat = isReducedMotion
        ? 0
        : Math.sin(elapsedTime * 0.45) * 0.04;
      const idleRot = isReducedMotion
        ? 0
        : Math.sin(elapsedTime * 0.25) * 0.015;

      // Apply interpolated transforms to the sculpture group
      sculptureGroup.position.set(
        pose.posX,
        pose.posY + idleFloat,
        pose.posZ
      );
      sculptureGroup.rotation.set(
        pose.rotX + idleRot * 0.5,
        pose.rotY + idleRot,
        pose.rotZ
      );
      sculptureGroup.scale.setScalar(pose.scale);

      // Update contour opacity
      contourMaterial.opacity = pose.opacity;

      // Update signal line draw progress
      const activeSampleCount = Math.floor(
        pose.signalProgress * SIGNAL_SAMPLES
      );
      signalGeometry.setDrawRange(0, Math.max(0, activeSampleCount));

      // Update leading pulse position
      if (activeSampleCount > 1 && pose.signalProgress < 0.99) {
        pulseMesh.visible = true;
        const currentPt =
          signalPoints[Math.min(activeSampleCount, SIGNAL_SAMPLES)];
        pulseMesh.position.copy(currentPt);
        pulseMesh.scale.setScalar(1.0 + 0.25 * Math.sin(elapsedTime * 6.0));
      } else {
        pulseMesh.visible = false;
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    // Begin animation loop
    rafId = requestAnimationFrame(animate);

    // =========================================================================
    // 5. RESIZE & VISIBILITY HANDLING
    // =========================================================================
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener("resize", handleResize, { passive: true });

    // Pause rendering when tab is inactive to preserve GPU and battery
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      } else {
        clock.start();
        if (rafId === null) {
          rafId = requestAnimationFrame(animate);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // =========================================================================
    // 6. CLEANUP ON UNMOUNT
    // =========================================================================
    return () => {
      window.removeEventListener("scroll", handleNativeScroll);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      if (rafId !== null) cancelAnimationFrame(rafId);

      // Dispose geometries and materials
      contourGeometry.dispose();
      contourMaterial.dispose();
      signalGeometry.dispose();
      signalMaterial.dispose();
      pulseGeo.dispose();
      pulseMat.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isReducedMotion]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
    />
  );
}

export default TopographicSculpture;
