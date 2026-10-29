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
 * 10 3D Spline Control Points defining the Current across the 5 Acts of the Site
 * Each Act has an art-directed 3D curve flowing from left to right.
 */
interface ActCurveKeyframe {
  p: number; // Normalized scroll progress [0 .. 1]
  points: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number]
  ];
  flowSpeedFactor: number;
}

const ACT_KEYFRAMES: ActCurveKeyframe[] = [
  // Act 1 — Hero: Atmospheric, understated, sweeps below headline, rises to right
  {
    p: 0.0,
    points: [
      [-6.5, -2.0, -2.0],
      [-4.8, -1.3, -1.0],
      [-3.0, -0.5, -0.2],
      [-1.2, 0.4, 0.5],
      [0.6, -0.3, -0.3],
      [2.2, -0.9, -1.0],
      [3.6, 0.1, -0.4],
      [4.8, 1.1, 0.3],
      [6.0, 1.7, -0.6],
      [7.2, 2.1, -1.6],
    ],
    flowSpeedFactor: 0.85,
  },
  // Act 1 -> 2: Transition out of Hero
  {
    p: 0.18,
    points: [
      [-6.6, -1.4, -1.8],
      [-4.9, -0.4, -0.8],
      [-3.2, 0.6, 0.2],
      [-1.4, 1.2, 0.8],
      [0.5, 0.0, -0.2],
      [2.0, -1.1, -1.1],
      [3.4, -0.6, -0.6],
      [4.7, 0.4, 0.2],
      [5.9, 1.2, -0.5],
      [7.1, 1.8, -1.4],
    ],
    flowSpeedFactor: 1.0,
  },
  // Act 2 — Early Sections (Deployment & Product Experience):
  // Pitches forward, deep sculptural bend framing interactive playgrounds
  {
    p: 0.38,
    points: [
      [-6.8, -1.0, -1.6],
      [-5.0, 0.3, -0.5],
      [-3.3, 1.5, 0.6],
      [-1.4, 1.7, 1.0],
      [0.4, 0.3, -0.2],
      [1.8, -1.3, -1.2],
      [3.3, -1.5, -0.8],
      [4.7, -0.2, 0.2],
      [5.9, 0.8, -0.4],
      [7.1, 1.4, -1.2],
    ],
    flowSpeedFactor: 1.2,
  },
  // Act 3 — Developer Experience:
  // Weaves to the right flank, clearing center-left for editorial copy
  {
    p: 0.58,
    points: [
      [-6.2, -2.4, -1.2],
      [-4.4, -1.7, -0.4],
      [-2.5, -0.8, 0.4],
      [-0.7, 0.1, 0.3],
      [1.1, 1.0, 0.8],
      [2.7, 1.5, 0.4],
      [3.9, 0.7, -0.6],
      [4.9, -0.3, -1.0],
      [6.1, -0.9, -1.5],
      [7.1, -1.3, -1.9],
    ],
    flowSpeedFactor: 1.05,
  },
  // Act 4 — Production Visibility & Getting Started:
  // Tightens into technical laminar flow, telemetry pulses
  {
    p: 0.80,
    points: [
      [-6.5, 0.7, -1.5],
      [-4.7, 0.5, -0.6],
      [-2.9, 0.2, 0.2],
      [-1.0, -0.4, 0.6],
      [0.8, -0.6, 0.4],
      [2.4, -0.2, -0.4],
      [3.8, 0.5, -0.8],
      [5.0, 1.1, -0.2],
      [6.2, 1.5, 0.4],
      [7.4, 1.8, -0.8],
    ],
    flowSpeedFactor: 1.25,
  },
  // Act 5 — Final CTA:
  // Serene horizontal cradle beneath mountain silhouette & resolved CTA
  {
    p: 1.0,
    points: [
      [-6.6, -0.7, -1.8],
      [-4.9, -1.3, -1.0],
      [-3.1, -1.7, -0.4],
      [-1.3, -1.9, 0.2],
      [0.5, -1.8, 0.4],
      [2.2, -1.5, -0.2],
      [3.8, -0.9, -0.8],
      [5.0, -0.3, -1.2],
      [6.2, 0.3, -1.6],
      [7.2, 0.7, -2.0],
    ],
    flowSpeedFactor: 0.8,
  },
];

/**
 * Quintic smootherstep easing
 */
function smootherstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * c * (c * (c * 6 - 15) + 10);
}

/**
 * Interpolates the 10 3D Spline Control Points for a given scroll progress
 */
function interpolateCurvePoints(
  p: number,
  outPoints: THREE.Vector3[]
): number {
  const clampedP = Math.max(0, Math.min(1, p));

  let idx = 0;
  for (let i = 0; i < ACT_KEYFRAMES.length - 1; i++) {
    if (clampedP >= ACT_KEYFRAMES[i].p && clampedP <= ACT_KEYFRAMES[i + 1].p) {
      idx = i;
      break;
    }
  }

  const k1 = ACT_KEYFRAMES[idx];
  const k2 = ACT_KEYFRAMES[idx + 1] || k1;
  const range = k2.p - k1.p;
  const t = range > 0 ? (clampedP - k1.p) / range : 0;
  const smoothT = smootherstep(t);

  for (let ptIdx = 0; ptIdx < 10; ptIdx++) {
    const pA = k1.points[ptIdx];
    const pB = k2.points[ptIdx];
    outPoints[ptIdx].set(
      pA[0] + (pB[0] - pA[0]) * smoothT,
      pA[1] + (pB[1] - pA[1]) * smoothT,
      pA[2] + (pB[2] - pA[2]) * smoothT
    );
  }

  return k1.flowSpeedFactor + (k2.flowSpeedFactor - k1.flowSpeedFactor) * smoothT;
}

// =============================================================================
// GLSL SHADERS FOR GPU PARTICLE CURRENT
// =============================================================================

const vertexShader = `
  uniform float uTime;
  uniform float uScrollVelocity;
  uniform float uPixelRatio;
  uniform vec3 uControlPoints[10];

  attribute float aProgress;      // Base progress u in [0, 1] along current
  attribute vec3 aOffset;         // (normalX, binormalY, tangentZ)
  attribute float aSize;          // Base particle diameter
  attribute vec3 aColor;          // RGB particle color
  attribute float aAlpha;         // Base opacity
  attribute float aSpeed;         // Individual particle flow velocity multiplier
  attribute float aLayer;         // 0: Core, 1: Filament, 2: Dust, 3: Accent

  varying vec3 vColor;
  varying float vAlpha;

  // Evaluates Catmull-Rom spline segment
  vec3 catmullRom(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
    float t2 = t * t;
    float t3 = t2 * t;
    return 0.5 * (
      (2.0 * p1) +
      (-p0 + p2) * t +
      (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 +
      (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
    );
  }

  // Evaluates Catmull-Rom tangent vector
  vec3 catmullRomTangent(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
    float t2 = t * t;
    return 0.5 * (
      (-p0 + p2) +
      (4.0 * p0 - 10.0 * p1 + 8.0 * p2 - 2.0 * p3) * t +
      (-3.0 * p0 + 9.0 * p1 - 9.0 * p2 + 3.0 * p3) * t2
    );
  }

  // Evaluates full 10-point spline at normalized parameter u in [0, 1]
  void evalSpline(float u, out vec3 pos, out vec3 tangent) {
    float clampedU = clamp(u, 0.0, 1.0);
    float tGlobal = clampedU * 6.999;
    int seg = int(floor(tGlobal));
    float t = tGlobal - float(seg);

    vec3 p0, p1, p2, p3;

    // Unroll segment selection for robust GLSL ES compatibility
    if (seg == 0) {
      p0 = uControlPoints[0]; p1 = uControlPoints[1]; p2 = uControlPoints[2]; p3 = uControlPoints[3];
    } else if (seg == 1) {
      p0 = uControlPoints[1]; p1 = uControlPoints[2]; p2 = uControlPoints[3]; p3 = uControlPoints[4];
    } else if (seg == 2) {
      p0 = uControlPoints[2]; p1 = uControlPoints[3]; p2 = uControlPoints[4]; p3 = uControlPoints[5];
    } else if (seg == 3) {
      p0 = uControlPoints[3]; p1 = uControlPoints[4]; p2 = uControlPoints[5]; p3 = uControlPoints[6];
    } else if (seg == 4) {
      p0 = uControlPoints[4]; p1 = uControlPoints[5]; p2 = uControlPoints[6]; p3 = uControlPoints[7];
    } else if (seg == 5) {
      p0 = uControlPoints[5]; p1 = uControlPoints[6]; p2 = uControlPoints[7]; p3 = uControlPoints[8];
    } else {
      p0 = uControlPoints[6]; p1 = uControlPoints[7]; p2 = uControlPoints[8]; p3 = uControlPoints[9];
    }

    pos = catmullRom(p0, p1, p2, p3, t);
    tangent = normalize(catmullRomTangent(p0, p1, p2, p3, t));
  }

  void main() {
    // Continuous internal particle flow along the streamline
    // Velocity surge responds subtly to active scroll speed
    float flowU = fract(aProgress + uTime * aSpeed * 0.045 + uScrollVelocity * 0.06);

    vec3 spinePos, tangent;
    evalSpline(flowU, spinePos, tangent);

    // Compute robust Frenet reference frame (Normal & Binormal)
    vec3 refUp = vec3(0.0, 1.0, 0.0);
    if (abs(dot(tangent, refUp)) > 0.92) {
      refUp = vec3(0.0, 0.0, 1.0);
    }
    vec3 normal = normalize(cross(tangent, refUp));
    vec3 binormal = normalize(cross(tangent, normal));

    // Dynamic ribbon thickness & organic wave breathing
    float ribbonWidthMod = 1.0 + 0.35 * sin(flowU * 3.14159 * 2.0);
    float waveRipple = 0.06 * sin(flowU * 18.0 + uTime * 2.2);

    vec3 worldPos = spinePos
      + normal * (aOffset.x * ribbonWidthMod)
      + binormal * (aOffset.y + waveRipple)
      + tangent * aOffset.z;

    vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Perspective point size attenuation
    float distToCamera = max(0.1, -mvPosition.z);
    gl_PointSize = max(1.0, aSize * uPixelRatio * (280.0 / distToCamera));

    // Smooth entry and exit boundary fading so particles never pop abruptly
    float fadeEdge = smoothstep(0.0, 0.06, flowU) * (1.0 - smoothstep(0.94, 1.0, flowU));

    // Accent particle subtle luminance modulation
    float brightness = 1.0;
    if (aLayer > 2.5) {
      brightness = 1.0 + 0.35 * sin(uTime * 3.5 + flowU * 20.0);
    }

    vColor = aColor * brightness;
    vAlpha = aAlpha * fadeEdge;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    // Soft metallic anti-aliased edge falloff with dense physical core
    float core = smoothstep(0.5, 0.12, dist);
    float innerGlow = exp(-dist * dist * 10.0);
    float alpha = vAlpha * mix(core, innerGlow, 0.32);

    gl_FragColor = vec4(vColor, alpha);
  }
`;

/**
 * TopographicSculpture
 *
 * Living Topographic Particle Current for Jetway
 * A bespoke, cinematic 3D particle stream that curves from left to right,
 * evolving continuously across all 5 acts of the site.
 */
export function TopographicSculpture() {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetProgressRef = useRef<number>(0);
  const currentProgressRef = useRef<number>(0);
  const lastScrollYRef = useRef<number>(0);
  const scrollVelocityRef = useRef<number>(0);

  const isReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  // Synchronize with global Lenis instance
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

    // Native scroll fallback listener
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
    // 1. THREE.JS INITIALIZATION
    // =========================================================================
    let width = window.innerWidth;
    let height = window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 80);
    camera.position.set(0, 0, 7.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x111111, 0.0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    // =========================================================================
    // 2. PARTICLE SYSTEM DATA & STRATA GENERATION
    // =========================================================================
    const isMobile = width < 768;
    const PARTICLE_COUNT = isMobile ? 8400 : 16800;

    const aProgress = new Float32Array(PARTICLE_COUNT);
    const aOffset = new Float32Array(PARTICLE_COUNT * 3);
    const aSize = new Float32Array(PARTICLE_COUNT);
    const aColor = new Float32Array(PARTICLE_COUNT * 3);
    const aAlpha = new Float32Array(PARTICLE_COUNT);
    const aSpeed = new Float32Array(PARTICLE_COUNT);
    const aLayer = new Float32Array(PARTICLE_COUNT);

    // Jetway Curated Color Palette
    const cIvoryPrimary = new THREE.Color(0xf5f5f3); // Warm ivory (#F5F5F3)
    const cBoneWhite = new THREE.Color(0xe8e4dc);    // Soft bone-white (#E8E4DC)
    const cGraphite = new THREE.Color(0x8e8b84);     // Muted graphite (#8E8B84)
    const cCharcoal = new THREE.Color(0x42403c);     // Dim charcoal (#42403C)
    const cBurntOrange = new THREE.Color(0xd88762);  // Signature burnt orange (#D88762)
    const cOrangeLight = new THREE.Color(0xe39a76);  // Warm orange highlight (#E39A76)
    const cSageGreen = new THREE.Color(0x83b69a);    // Status sage green (#83B69A)

    // Pseudo-random deterministic distribution helper
    let seed = 42;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // Gaussian bell distribution helper
    const rndGaussian = () => {
      let u = 0;
      let v = 0;
      while (u === 0) u = rnd();
      while (v === 0) v = rnd();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Progress u uniformly distributed along the streamline
      aProgress[i] = (i + rnd() * 0.9) / PARTICLE_COUNT;

      const layerRoll = rnd();

      if (layerRoll < 0.42) {
        // -------------------------------------------------------------------
        // LAYER A: THE MAIN CURRENT (42% of particles)
        // High-density coherent central ribbon
        // -------------------------------------------------------------------
        aLayer[i] = 0.0;
        const normDist = rndGaussian() * 0.22; // Tight bell-curve across ribbon
        const binormDist = rndGaussian() * 0.12;

        aOffset[i * 3 + 0] = normDist;
        aOffset[i * 3 + 1] = binormDist;
        aOffset[i * 3 + 2] = (rnd() - 0.5) * 0.15;

        // Mostly warm ivory & bone white, with 6% signature burnt orange highlights
        let col = rnd() > 0.35 ? cIvoryPrimary : cBoneWhite;
        if (rnd() < 0.06) {
          col = cBurntOrange;
          aSize[i] = 2.2 + rnd() * 1.0;
          aAlpha[i] = 0.88;
        } else {
          aSize[i] = 1.3 + rnd() * 1.3;
          aAlpha[i] = 0.65 + rnd() * 0.3;
        }

        aColor[i * 3 + 0] = col.r;
        aColor[i * 3 + 1] = col.g;
        aColor[i * 3 + 2] = col.b;
        aSpeed[i] = 0.95 + rnd() * 0.25; // Fast core laminar flow
      } else if (layerRoll < 0.72) {
        // -------------------------------------------------------------------
        // LAYER B: TOPOGRAPHIC FILAMENTS (30% of particles)
        // 7 distinct contour strands echoing architectural terrain
        // -------------------------------------------------------------------
        aLayer[i] = 1.0;
        const strandIdx = Math.floor(rnd() * 7); // 7 contour strands
        const strandNorm = (-1.0 + strandIdx * 0.33) * 0.45;
        const strandBinorm = 0.08 * Math.sin(strandIdx * 1.4 + aProgress[i] * 6.28);

        aOffset[i * 3 + 0] = strandNorm + (rnd() - 0.5) * 0.04;
        aOffset[i * 3 + 1] = strandBinorm + (rnd() - 0.5) * 0.04;
        aOffset[i * 3 + 2] = (rnd() - 0.5) * 0.08;

        // Muted ivory and graphite
        const col = rnd() > 0.4 ? cIvoryPrimary : cGraphite;
        aColor[i * 3 + 0] = col.r;
        aColor[i * 3 + 1] = col.g;
        aColor[i * 3 + 2] = col.b;

        aSize[i] = 1.1 + rnd() * 0.9;
        aAlpha[i] = 0.4 + rnd() * 0.35;
        aSpeed[i] = 0.85 + rnd() * 0.15;
      } else if (layerRoll < 0.95) {
        // -------------------------------------------------------------------
        // LAYER C: TRAILING TOPOGRAPHIC DUST & DISPERSION (23% of particles)
        // Airy peripheral particles creating volumetric depth
        // -------------------------------------------------------------------
        aLayer[i] = 2.0;
        aOffset[i * 3 + 0] = rndGaussian() * 0.65;
        aOffset[i * 3 + 1] = rndGaussian() * 0.38;
        aOffset[i * 3 + 2] = (rnd() - 0.5) * 0.3;

        const col = rnd() > 0.5 ? cGraphite : cCharcoal;
        aColor[i * 3 + 0] = col.r;
        aColor[i * 3 + 1] = col.g;
        aColor[i * 3 + 2] = col.b;

        aSize[i] = 0.9 + rnd() * 1.1;
        aAlpha[i] = 0.15 + rnd() * 0.25;
        aSpeed[i] = 0.65 + rnd() * 0.3; // Slower peripheral drift
      } else {
        // -------------------------------------------------------------------
        // LAYER D: LUMINOUS ACCENT SPARKS (5% of particles)
        // Restrained burnt orange and subtle sage green status telemetry
        // -------------------------------------------------------------------
        aLayer[i] = 3.0;
        aOffset[i * 3 + 0] = (rnd() - 0.5) * 0.35;
        aOffset[i * 3 + 1] = (rnd() - 0.5) * 0.25;
        aOffset[i * 3 + 2] = (rnd() - 0.5) * 0.1;

        // 80% burnt orange, 20% status sage green
        const isSage = rnd() < 0.2;
        const col = isSage
          ? cSageGreen
          : rnd() > 0.5
          ? cBurntOrange
          : cOrangeLight;

        aColor[i * 3 + 0] = col.r;
        aColor[i * 3 + 1] = col.g;
        aColor[i * 3 + 2] = col.b;

        aSize[i] = 2.4 + rnd() * 1.2;
        aAlpha[i] = 0.9 + rnd() * 0.1;
        aSpeed[i] = 1.05 + rnd() * 0.2;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3)
    );
    geometry.setAttribute("aProgress", new THREE.BufferAttribute(aProgress, 1));
    geometry.setAttribute("aOffset", new THREE.BufferAttribute(aOffset, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(aSize, 1));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(aColor, 3));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(aAlpha, 1));
    geometry.setAttribute("aSpeed", new THREE.BufferAttribute(aSpeed, 1));
    geometry.setAttribute("aLayer", new THREE.BufferAttribute(aLayer, 1));

    // Dynamic 10 control points buffer
    const controlPointVectors = Array.from(
      { length: 10 },
      () => new THREE.Vector3()
    );
    interpolateCurvePoints(0.0, controlPointVectors);

    const shaderMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uScrollVelocity: { value: 0.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uControlPoints: { value: controlPointVectors },
      },
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, shaderMaterial);
    scene.add(particles);

    // =========================================================================
    // 3. ANIMATION & SMOOTH VELOCITY LOOP
    // =========================================================================
    let rafId: number | null = null;
    const clock = new THREE.Clock();

    const animate = () => {
      const dt = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Smooth progress interpolation
      const progressDiff =
        targetProgressRef.current - currentProgressRef.current;
      currentProgressRef.current += progressDiff * Math.min(1.0, 10.0 * dt);

      // Measure instantaneous scroll velocity for organic flow surges
      const currentScrollY = window.scrollY;
      const dScroll = Math.abs(currentScrollY - lastScrollYRef.current);
      lastScrollYRef.current = currentScrollY;

      const rawVel = Math.min(3.5, dScroll / (dt * 1000 + 0.001));
      scrollVelocityRef.current +=
        (rawVel - scrollVelocityRef.current) * Math.min(1.0, 8.0 * dt);

      const p = currentProgressRef.current;
      const speedFactor = interpolateCurvePoints(p, controlPointVectors);

      // Update uniforms without reallocations
      shaderMaterial.uniforms.uTime.value = isReducedMotion
        ? 0.0
        : elapsedTime * speedFactor;
      shaderMaterial.uniforms.uScrollVelocity.value = isReducedMotion
        ? 0.0
        : scrollVelocityRef.current;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    // =========================================================================
    // 4. RESIZE & VISIBILITY HANDLING
    // =========================================================================
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      shaderMaterial.uniforms.uPixelRatio.value = Math.min(
        window.devicePixelRatio,
        2
      );
    };
    window.addEventListener("resize", handleResize, { passive: true });

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
    // 5. CLEANUP ON UNMOUNT
    // =========================================================================
    return () => {
      window.removeEventListener("scroll", handleNativeScroll);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      if (rafId !== null) cancelAnimationFrame(rafId);

      geometry.dispose();
      shaderMaterial.dispose();
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
