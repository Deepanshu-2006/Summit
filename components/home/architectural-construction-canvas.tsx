"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ConstructionController } from "./construction-system/controller";
import { ConstructionStagePreset } from "./construction-system/types";
import { ConstructionTimelineManager, CONSTRUCTION_MILESTONES } from "./construction-system/timeline";

interface ArchitecturalConstructionCanvasProps {
  progress?: number; // Normalized construction progress [0 .. 1] (optional; defaults to auto-scroll measurement)
  isReducedMotion?: boolean;
}

/**
 * Check if WebGL context can be created in current environment.
 */
function checkWebGLSupport(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

/**
 * ArchitecturalConstructionCanvas: Jetway Modular Construction System (Phase 4: Connected to Scroll)
 *
 * Implements a decoupled, modular construction system synchronized with page scroll:
 * - Direct section scroll measurement at display refresh rate (zero React re-renders)
 * - Central construction manifest defining real building components and dependencies
 * - Independently controllable architectural components across 7 main categories
 * - Full fidelity reproduction of the contemporary bungalow at 100% completion
 * - Responsive camera framing across mobile, tablet, laptop, and ultrawide monitors
 * - Developer-only stage preview shortcuts (keys 1-6, Space for play/pause, [ / ] for milestones)
 */
export function ArchitecturalConstructionCanvas({
  progress = 0,
  isReducedMotion = false,
}: ArchitecturalConstructionCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<number>(progress);
  progressRef.current = progress;
  const [webGLError, setWebGLError] = useState<boolean>(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!checkWebGLSupport()) {
      setWebGLError(true);
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
      });
    } catch (e) {
      console.warn("WebGLRenderer initialization failed, switching to graceful fallback:", e);
      setWebGLError(true);
      return;
    }

    // 1. Scene, Camera & Atmospheric Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0e10);
    scene.fog = new THREE.FogExp2(0x0c0e10, 0.013);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Responsive FOV and distance calculation for mobile / tablet / desktop
    const calcCameraParams = (w: number, h: number) => {
      const a = w / Math.max(1, h);
      let fov = 34;
      let distFactor = 1.0;
      if (a < 1.4 && a >= 1.0) {
        fov = 34 + (1.4 - a) * 14;
        distFactor = 1.0 + (1.4 - a) * 0.12;
      } else if (a < 1.0) {
        fov = 39.6 + (1.0 - a) * 16;
        distFactor = 1.05 + (1.0 - a) * 0.20;
      }
      return { fov, distFactor, aspect: a };
    };

    const initialParams = calcCameraParams(width, height);

    // Cinematic Three-Quarter Architectural Camera
    const camera = new THREE.PerspectiveCamera(initialParams.fov, initialParams.aspect, 0.5, 300);
    camera.position.set(
      24.4 * initialParams.distFactor,
      11.8 * initialParams.distFactor,
      28.4 * initialParams.distFactor
    );
    camera.lookAt(1.0, 2.0, 0.2);

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Architectural Image-Based Lighting (IBL) Environment Map via PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const skyCanvas = document.createElement("canvas");
    skyCanvas.width = 512;
    skyCanvas.height = 512;
    const skyCtx = skyCanvas.getContext("2d");
    if (skyCtx) {
      const grad = skyCtx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0.0, "#222f3e"); // Zenith: deep slate-blue architectural sky
      grad.addColorStop(0.40, "#485b6b"); // Cool daylight horizon
      grad.addColorStop(0.52, "#73604f"); // Warm amber twilight horizon band
      grad.addColorStop(0.68, "#28231c"); // Warm soil ground bounce
      grad.addColorStop(1.0, "#0c0e10"); // Forest floor nadir
      skyCtx.fillStyle = grad;
      skyCtx.fillRect(0, 0, 512, 512);
    }
    const skyTexture = new THREE.CanvasTexture(skyCanvas);
    skyTexture.mapping = THREE.EquirectangularReflectionMapping;
    const skyScene = new THREE.Scene();
    skyScene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(120, 24, 16),
        new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide })
      )
    );
    const envMap = pmremGenerator.fromScene(skyScene).texture;
    scene.environment = envMap;

    // 2. Cinematic Natural Environmental Lighting
    const sunLight = new THREE.DirectionalLight(0xffedd4, 3.6);
    sunLight.position.set(38, 34, 24);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 8;
    sunLight.shadow.camera.far = 130;
    sunLight.shadow.camera.left = -28;
    sunLight.shadow.camera.right = 28;
    sunLight.shadow.camera.top = 28;
    sunLight.shadow.camera.bottom = -28;
    sunLight.shadow.bias = -0.00018;
    sunLight.shadow.normalBias = 0.025;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x4a5d6e, 0x1a1c1d, 1.15);
    scene.add(hemiLight);

    const bounceLight = new THREE.DirectionalLight(0xd88762, 0.45);
    bounceLight.position.set(-28, 14, -22);
    scene.add(bounceLight);

    const rimLight = new THREE.DirectionalLight(0x9bb5c9, 0.35);
    rimLight.position.set(-18, 22, 32);
    scene.add(rimLight);

    // 3. PBR Texture Loading
    const textureLoader = new THREE.TextureLoader();

    const forestDiff = textureLoader.load("/textures/woodland/forest_floor_diff.jpg");
    forestDiff.wrapS = forestDiff.wrapT = THREE.RepeatWrapping;
    forestDiff.repeat.set(12, 12);

    const forestNor = textureLoader.load("/textures/woodland/forest_floor_nor.jpg");
    forestNor.wrapS = forestNor.wrapT = THREE.RepeatWrapping;
    forestNor.repeat.set(12, 12);

    const forestRough = textureLoader.load("/textures/woodland/forest_floor_rough.jpg");
    forestRough.wrapS = forestRough.wrapT = THREE.RepeatWrapping;
    forestRough.repeat.set(12, 12);

    const barkDiff = textureLoader.load("/textures/woodland/bark_diff.jpg");
    barkDiff.wrapS = barkDiff.wrapT = THREE.RepeatWrapping;
    barkDiff.repeat.set(1, 4);

    const barkNor = textureLoader.load("/textures/woodland/bark_nor.jpg");
    barkNor.wrapS = barkNor.wrapT = THREE.RepeatWrapping;
    barkNor.repeat.set(1, 4);

    const barkRough = textureLoader.load("/textures/woodland/bark_rough.jpg");
    barkRough.wrapS = barkRough.wrapT = THREE.RepeatWrapping;
    barkRough.repeat.set(1, 4);

    const concreteDiff = textureLoader.load("/textures/architecture/concrete_diff.jpg");
    concreteDiff.wrapS = concreteDiff.wrapT = THREE.RepeatWrapping;
    concreteDiff.repeat.set(4, 2);

    const concreteNor = textureLoader.load("/textures/architecture/concrete_nor.jpg");
    concreteNor.wrapS = concreteNor.wrapT = THREE.RepeatWrapping;
    concreteNor.repeat.set(4, 2);

    const concreteRough = textureLoader.load("/textures/architecture/concrete_rough.jpg");
    concreteRough.wrapS = concreteRough.wrapT = THREE.RepeatWrapping;
    concreteRough.repeat.set(4, 2);

    const woodDiff = textureLoader.load("/textures/architecture/wood_diff.jpg");
    woodDiff.wrapS = woodDiff.wrapT = THREE.RepeatWrapping;
    woodDiff.repeat.set(3, 3);

    const woodNor = textureLoader.load("/textures/architecture/wood_nor.jpg");
    woodNor.wrapS = woodNor.wrapT = THREE.RepeatWrapping;
    woodNor.repeat.set(3, 3);

    const woodRough = textureLoader.load("/textures/architecture/wood_rough.jpg");
    woodRough.wrapS = woodRough.wrapT = THREE.RepeatWrapping;
    woodRough.repeat.set(3, 3);

    // 4. Woodland Clearing Terrain
    const groundGeo = new THREE.PlaneGeometry(95, 95, 80, 80);
    groundGeo.rotateX(-Math.PI / 2);
    const gPos = groundGeo.attributes.position;
    for (let i = 0; i < gPos.count; i++) {
      const gx = gPos.getX(i);
      const gz = gPos.getZ(i);
      const distFromCenter = Math.sqrt(gx * gx + gz * gz);
      let h = (Math.sin(gx * 0.09) * 0.75 + Math.cos(gz * 0.11) * 0.65) *
        Math.min(1.0, Math.max(0, (distFromCenter - 13) / 14));
      gPos.setY(i, h);
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      map: forestDiff,
      normalMap: forestNor,
      roughnessMap: forestRough,
      roughness: 0.94,
      metalness: 0.04,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 5. Mature Natural Woodland Evergreens
    const treesGroup = new THREE.Group();
    const treeBarkMat = new THREE.MeshStandardMaterial({
      map: barkDiff,
      normalMap: barkNor,
      roughnessMap: barkRough,
      roughness: 0.88,
      metalness: 0.02,
    });

    const foliageColors = [
      new THREE.Color(0x132217),
      new THREE.Color(0x1a2b1f),
      new THREE.Color(0x223627),
      new THREE.Color(0x283e2e),
    ];

    const foliageMaterials = foliageColors.map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.84, metalness: 0.05 })
    );

    function createOrganicPine(height = 12, radius = 3.2, seed = 0) {
      const tree = new THREE.Group();
      const foliageMat = foliageMaterials[seed % foliageMaterials.length];

      const trunkH = height * 0.45;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.42, trunkH, 8), treeBarkMat);
      trunk.position.y = trunkH * 0.5;
      trunk.rotation.z = Math.sin(seed * 2.3) * 0.04;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      tree.add(trunk);

      const tiers = 10;
      for (let t = 0; t < tiers; t++) {
        const tn = t / (tiers - 1);
        const tierY = height * (0.28 + tn * 0.68);
        const tierRadius = radius * Math.pow(1.0 - tn * 0.85, 0.8) * (0.9 + Math.sin(seed + t) * 0.15);
        const branchesInTier = 5 + (t % 3);

        const tierGroup = new THREE.Group();
        tierGroup.position.y = tierY;
        tierGroup.rotation.y = t * 0.8 + seed * 1.5;

        for (let b = 0; b < branchesInTier; b++) {
          const angle = (b / branchesInTier) * Math.PI * 2 + (t % 2) * 0.3;
          const bLen = tierRadius * (0.85 + Math.sin(b * 1.7) * 0.2);

          const branchGeo = new THREE.ConeGeometry(bLen * 0.48, bLen, 5);
          branchGeo.rotateZ(Math.PI / 2);
          branchGeo.scale(1.0, 0.35, 0.9);

          const branchMesh = new THREE.Mesh(branchGeo, foliageMat);
          branchMesh.position.x = Math.cos(angle) * (bLen * 0.5);
          branchMesh.position.z = Math.sin(angle) * (bLen * 0.5);
          branchMesh.position.y = -0.15 * (1.0 - tn);
          branchMesh.rotation.y = -angle;
          branchMesh.rotation.z = -0.18 * (1.0 - tn);
          branchMesh.castShadow = true;
          branchMesh.receiveShadow = true;
          tierGroup.add(branchMesh);
        }

        const centerConeH = height * (0.22 - tn * 0.08);
        const centerCone = new THREE.Mesh(
          new THREE.ConeGeometry(tierRadius * 0.65, centerConeH, 6),
          foliageMat
        );
        centerCone.castShadow = true;
        tierGroup.add(centerCone);

        tree.add(tierGroup);
      }

      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.35, height * 0.18, 5), foliageMat);
      crown.position.y = height * 0.94;
      crown.castShadow = true;
      tree.add(crown);

      return tree;
    }

    const treeSpots = [
      { x: -22, z: -22, h: 14.5, r: 3.5, s: 1 },
      { x: -15, z: -26, h: 16.0, r: 3.8, s: 2 },
      { x: -7, z: -28, h: 15.5, r: 3.6, s: 3 },
      { x: 1, z: -30, h: 17.0, r: 4.0, s: 4 },
      { x: 9, z: -27, h: 15.0, r: 3.6, s: 5 },
      { x: 17, z: -24, h: 16.5, r: 3.9, s: 6 },
      { x: 25, z: -19, h: 14.0, r: 3.3, s: 7 },
      { x: -28, z: -16, h: 15.0, r: 3.5, s: 8 },
      { x: -24, z: -8, h: 13.0, r: 3.1, s: 9 },
      { x: -26, z: 3, h: 13.5, r: 3.2, s: 10 },
      { x: -21, z: 14, h: 11.5, r: 2.8, s: 11 },
      { x: 26, z: -6, h: 12.5, r: 3.0, s: 12 },
      { x: 28, z: 7, h: 14.0, r: 3.3, s: 13 },
      { x: 23, z: 16, h: 11.0, r: 2.7, s: 14 },
      { x: -18, z: 27, h: 10.5, r: 2.6, s: 15 },
      { x: 22, z: 28, h: 11.0, r: 2.7, s: 16 },
      // Foreground & Deep Canopy Framing Trees
      { x: -35, z: -24, h: 19.0, r: 4.4, s: 17 },
      { x: 33, z: -20, h: 17.5, r: 4.1, s: 18 },
      { x: -25, z: 24, h: 12.0, r: 3.0, s: 19 },
      { x: 26, z: 24, h: 11.5, r: 2.9, s: 20 },
    ];

    treeSpots.forEach((ts) => {
      const tree = createOrganicPine(ts.h, ts.r, ts.s);
      tree.position.set(ts.x, 0, ts.z);
      treesGroup.add(tree);
    });
    scene.add(treesGroup);

    // 6. Photogrammetry Mossy Rocks
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      "/models/mossy_rock/mossy_rock_1k.gltf",
      (gltf) => {
        const rockModel = gltf.scene;
        const rockSpots = [
          { x: -14, z: 9, s: 1.8, r: 0.5 },
          { x: -16, z: 6, s: 1.4, r: 1.9 },
          { x: 15, z: 12, s: 1.7, r: 2.5 },
          { x: 13, z: 16, s: 1.3, r: 0.8 },
          { x: -10, z: -17, s: 2.0, r: 3.2 },
          { x: 11, z: -19, s: 1.6, r: 1.1 },
          { x: 18, z: -10, s: 1.4, r: 2.1 },
          { x: -18, z: 18, s: 1.5, r: 0.4 },
        ];
        rockSpots.forEach((rp) => {
          const clone = rockModel.clone();
          clone.position.set(rp.x, 0, rp.z);
          clone.scale.set(rp.s, rp.s, rp.s);
          clone.rotation.y = rp.r;
          clone.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
              c.castShadow = true;
              c.receiveShadow = true;
            }
          });
          scene.add(clone);
        });
      },
      undefined,
      (err) => console.warn("Rock model load note:", err)
    );

    // =================================================================
    // 7. MODULAR BUNGALOW MODEL & COMPONENT CONTROLLER
    // =================================================================
    const houseGroup = new THREE.Group();
    scene.add(houseGroup);

    // Instantiate Construction Controller
    const controller = new ConstructionController();

    // Architectural PBR Materials
    const concreteMat = new THREE.MeshStandardMaterial({
      map: concreteDiff,
      normalMap: concreteNor,
      roughnessMap: concreteRough,
      color: 0xded9d2,
      roughness: 0.74,
      metalness: 0.03,
      envMapIntensity: 0.65,
    });

    const basaltChimneyMat = new THREE.MeshStandardMaterial({
      map: concreteDiff,
      normalMap: concreteNor,
      roughnessMap: concreteRough,
      color: 0x3d3b38,
      roughness: 0.88,
      metalness: 0.08,
      envMapIntensity: 0.55,
    });

    const woodMat = new THREE.MeshStandardMaterial({
      map: woodDiff,
      normalMap: woodNor,
      roughnessMap: woodRough,
      color: 0x9b6b47,
      roughness: 0.60,
      metalness: 0.02,
      envMapIntensity: 0.75,
    });

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x141618,
      roughness: 0.28,
      metalness: 0.90,
      envMapIntensity: 1.25,
    });

    const zincRoofMat = new THREE.MeshStandardMaterial({
      color: 0x22262a,
      roughness: 0.32,
      metalness: 0.80,
      envMapIntensity: 1.15,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xd2e8f8,
      transparent: true,
      opacity: 0.38,
      roughness: 0.03,
      metalness: 0.22,
      envMapIntensity: 1.85,
    });

    const doorMat = new THREE.MeshStandardMaterial({
      map: woodDiff,
      color: 0x3e2819,
      roughness: 0.48,
      metalness: 0.05,
      envMapIntensity: 0.85,
    });

    const travertineFloorMat = new THREE.MeshStandardMaterial({
      color: 0x3e352b,
      roughness: 0.46,
      metalness: 0.10,
      envMapIntensity: 0.80,
    });

    const gravelMat = new THREE.MeshStandardMaterial({
      color: 0x242220,
      roughness: 0.94,
      metalness: 0.04,
      envMapIntensity: 0.40,
    });

    const blueprintMat = new THREE.LineBasicMaterial({
      color: 0xd88762,
      transparent: true,
      opacity: 0.85,
    });

    // -----------------------------------------------------------------
    // Blueprint Footprint & Survey Stakes (Site Setup)
    // -----------------------------------------------------------------
    const blueprintGroup = new THREE.Group();
    const gridHelper = new THREE.GridHelper(28, 28, 0xd88762, 0x261f1a);
    gridHelper.position.y = 0.03;
    blueprintGroup.add(gridHelper);

    const footprintPoints = [
      new THREE.Vector3(-9.6, 0.06, 3.9),
      new THREE.Vector3(-2.0, 0.06, 3.9),
      new THREE.Vector3(-2.0, 0.06, 2.0),
      new THREE.Vector3(0.6, 0.06, 2.0),
      new THREE.Vector3(0.6, 0.06, 5.0),
      new THREE.Vector3(11.0, 0.06, 5.0),
      new THREE.Vector3(11.0, 0.06, -4.6),
      new THREE.Vector3(-2.0, 0.06, -4.6),
      new THREE.Vector3(-2.0, 0.06, -5.3),
      new THREE.Vector3(-9.6, 0.06, -5.3),
      new THREE.Vector3(-9.6, 0.06, 3.9),
    ];
    const footprintGeo = new THREE.BufferGeometry().setFromPoints(footprintPoints);
    const footprintLine = new THREE.Line(footprintGeo, blueprintMat);
    blueprintGroup.add(footprintLine);

    const stakeGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.8, 6);
    const stakeMat = new THREE.MeshStandardMaterial({ color: 0xd88762, roughness: 0.45 });
    [
      [-9.6, 3.9], [-2.0, 2.0], [0.6, 2.0],
      [11.0, 5.0], [11.0, -4.6], [-9.6, -5.3],
    ].forEach(([sx, sz]) => {
      const stake = new THREE.Mesh(stakeGeo, stakeMat);
      stake.position.set(sx, 0.4, sz);
      blueprintGroup.add(stake);
    });
    houseGroup.add(blueprintGroup);

    // -----------------------------------------------------------------
    // Component 1: Living Pavilion Foundation Plinth
    // -----------------------------------------------------------------
    const slabLiving = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.42, 9.8), concreteMat);
    slabLiving.position.set(5.7, 0.21, 0.2);
    slabLiving.castShadow = true;
    slabLiving.receiveShadow = true;
    houseGroup.add(slabLiving);
    controller.registerComponent("foundation-living-slab", slabLiving);

    // -----------------------------------------------------------------
    // Component 2: Bedroom Wing Foundation Plinth
    // -----------------------------------------------------------------
    const slabBed = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.42, 9.4), concreteMat);
    slabBed.position.set(-5.8, 0.21, -0.7);
    slabBed.castShadow = true;
    slabBed.receiveShadow = true;
    houseGroup.add(slabBed);
    controller.registerComponent("foundation-bed-slab", slabBed);

    // -----------------------------------------------------------------
    // Component 3: Entrance Porch Foundation Plinth
    // -----------------------------------------------------------------
    const slabPorch = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.36, 3.2), concreteMat);
    slabPorch.position.set(-0.7, 0.18, 2.3);
    slabPorch.castShadow = true;
    slabPorch.receiveShadow = true;
    houseGroup.add(slabPorch);
    controller.registerComponent("foundation-porch-slab", slabPorch);

    // -----------------------------------------------------------------
    // Component 4: Cantilevered Concrete Front Terrace
    // -----------------------------------------------------------------
    const terrace = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.22, 3.2), concreteMat);
    terrace.position.set(5.7, 0.11, 6.6);
    terrace.castShadow = true;
    terrace.receiveShadow = true;
    houseGroup.add(terrace);
    controller.registerComponent("foundation-terrace", terrace);

    // -----------------------------------------------------------------
    // Component 5: Floating Concrete Approach Steps
    // -----------------------------------------------------------------
    const step = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.11, 0.9), concreteMat);
    step.position.set(5.7, 0.055, 8.3);
    step.receiveShadow = true;
    houseGroup.add(step);
    controller.registerComponent("foundation-steps", step);

    // -----------------------------------------------------------------
    // Component 6: Structural Steel Anchor Baseplates
    // -----------------------------------------------------------------
    const structuralAnchorsGroup = new THREE.Group();
    const anchorGeo = new THREE.BoxGeometry(0.32, 0.035, 0.32);
    const anchorCoords = [
      [0.6, 4.8], [5.7, 4.8], [10.8, 4.8],
      [0.6, -4.4], [5.7, -4.4], [10.8, -4.4],
      [-9.4, 3.7], [-2.1, 3.7], [-9.4, -5.1], [-2.1, -5.1],
      [-0.7, 3.7], [-0.7, 2.0]
    ];
    anchorCoords.forEach(([ax, az]) => {
      const anchor = new THREE.Mesh(anchorGeo, steelMat);
      anchor.position.set(ax, 0.435, az);
      structuralAnchorsGroup.add(anchor);
    });
    houseGroup.add(structuralAnchorsGroup);
    controller.registerComponent("structural-anchors", structuralAnchorsGroup);

    // -----------------------------------------------------------------
    // Component 7: Living Pavilion Structural Columns
    // -----------------------------------------------------------------
    const columnsLivingGroup = new THREE.Group();
    const colGeoLiving = new THREE.BoxGeometry(0.22, 4.1, 0.22);
    const livingColCoords = [
      [0.6, 4.8], [5.7, 4.8], [10.8, 4.8],
      [0.6, -4.4], [5.7, -4.4], [10.8, -4.4],
    ];
    livingColCoords.forEach(([cx, cz]) => {
      const col = new THREE.Mesh(colGeoLiving, steelMat);
      col.position.set(cx, 0.42 + 2.05, cz);
      col.castShadow = true;
      columnsLivingGroup.add(col);
    });
    houseGroup.add(columnsLivingGroup);
    controller.registerComponent("columns-living", columnsLivingGroup);

    // -----------------------------------------------------------------
    // Component 8: Bedroom Wing Structural Columns
    // -----------------------------------------------------------------
    const columnsBedGroup = new THREE.Group();
    const colGeoBed = new THREE.BoxGeometry(0.20, 3.3, 0.20);
    const bedColCoords = [
      [-9.4, 3.7], [-2.1, 3.7],
      [-9.4, -5.1], [-2.1, -5.1],
    ];
    bedColCoords.forEach(([cx, cz]) => {
      const col = new THREE.Mesh(colGeoBed, steelMat);
      col.position.set(cx, 0.42 + 1.65, cz);
      col.castShadow = true;
      columnsBedGroup.add(col);
    });
    houseGroup.add(columnsBedGroup);
    controller.registerComponent("columns-bedroom", columnsBedGroup);

    // -----------------------------------------------------------------
    // Component 9: Living Pavilion Primary Header Beams
    // -----------------------------------------------------------------
    const primaryBeamsLivingGroup = new THREE.Group();
    const beamLivingFront = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.34, 0.26), steelMat);
    beamLivingFront.position.set(5.7, 4.58, 4.8);
    beamLivingFront.castShadow = true;
    primaryBeamsLivingGroup.add(beamLivingFront);

    const beamLivingBack = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.34, 0.26), steelMat);
    beamLivingBack.position.set(5.7, 4.58, -4.4);
    beamLivingBack.castShadow = true;
    primaryBeamsLivingGroup.add(beamLivingBack);
    houseGroup.add(primaryBeamsLivingGroup);
    controller.registerComponent("primary-beams-living", primaryBeamsLivingGroup);

    // -----------------------------------------------------------------
    // Component 10: Bedroom Wing Primary Header Beams
    // -----------------------------------------------------------------
    const primaryBeamsBedGroup = new THREE.Group();
    const beamBedFront = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.28, 0.24), steelMat);
    beamBedFront.position.set(-5.8, 3.78, 3.7);
    beamBedFront.castShadow = true;
    primaryBeamsBedGroup.add(beamBedFront);

    const beamBedBack = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.28, 0.24), steelMat);
    beamBedBack.position.set(-5.8, 3.78, -5.1);
    beamBedBack.castShadow = true;
    primaryBeamsBedGroup.add(beamBedBack);
    houseGroup.add(primaryBeamsBedGroup);
    controller.registerComponent("primary-beams-bedroom", primaryBeamsBedGroup);

    // -----------------------------------------------------------------
    // Component 11: Transverse Structural Roof Joists
    // -----------------------------------------------------------------
    const secondaryJoistsGroup = new THREE.Group();
    for (let j = 1.2; j <= 10.2; j += 1.5) {
      const joist = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 9.6), steelMat);
      joist.position.set(j, 4.56, 0.2);
      joist.castShadow = true;
      secondaryJoistsGroup.add(joist);
    }
    for (let j = -8.8; j <= -2.6; j += 1.4) {
      const joist = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.20, 9.0), steelMat);
      joist.position.set(j, 3.76, -0.7);
      joist.castShadow = true;
      secondaryJoistsGroup.add(joist);
    }
    houseGroup.add(secondaryJoistsGroup);
    controller.registerComponent("secondary-roof-joists", secondaryJoistsGroup);

    // -----------------------------------------------------------------
    // Component 12: Open Perimeter Roof Deck Framing
    // -----------------------------------------------------------------
    const roofFramingGroup = new THREE.Group();

    // Living pavilion open perimeter channels & ridge purlin
    const chL1 = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.16, 0.14), steelMat);
    chL1.position.set(5.7, 4.70, 5.9);
    roofFramingGroup.add(chL1);

    const chL2 = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.16, 0.14), steelMat);
    chL2.position.set(5.7, 4.70, -5.3);
    roofFramingGroup.add(chL2);

    const chL3 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 11.2), steelMat);
    chL3.position.set(-0.4, 4.70, 0.3);
    roofFramingGroup.add(chL3);

    const chL4 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 11.2), steelMat);
    chL4.position.set(11.8, 4.70, 0.3);
    roofFramingGroup.add(chL4);

    const chLRidge = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.16, 0.14), steelMat);
    chLRidge.position.set(5.7, 4.70, 0.3);
    roofFramingGroup.add(chLRidge);

    // Bedroom wing open perimeter channels
    const chB1 = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.14, 0.12), steelMat);
    chB1.position.set(-5.8, 3.86, 4.5);
    roofFramingGroup.add(chB1);

    const chB2 = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.14, 0.12), steelMat);
    chB2.position.set(-5.8, 3.86, -5.9);
    roofFramingGroup.add(chB2);

    const chB3 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 10.4), steelMat);
    chB3.position.set(-10.2, 3.86, -0.7);
    roofFramingGroup.add(chB3);

    const chB4 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 10.4), steelMat);
    chB4.position.set(-1.4, 3.86, -0.7);
    roofFramingGroup.add(chB4);

    houseGroup.add(roofFramingGroup);
    controller.registerComponent("roof-framing", roofFramingGroup);

    // -----------------------------------------------------------------
    // Component 13: Bedroom Wing Exterior Cedar Walls
    // -----------------------------------------------------------------
    const wallsBedGroup = new THREE.Group();
    const wallBedLeft = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.3, 0.22), woodMat);
    wallBedLeft.position.set(-8.8, 2.07, 3.68);
    wallBedLeft.castShadow = true;
    wallBedLeft.receiveShadow = true;
    wallsBedGroup.add(wallBedLeft);

    const wallBedRight = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.3, 0.22), woodMat);
    wallBedRight.position.set(-2.8, 2.07, 3.68);
    wallBedRight.castShadow = true;
    wallBedRight.receiveShadow = true;
    wallsBedGroup.add(wallBedRight);

    const wallBedApron = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.6, 0.22), woodMat);
    wallBedApron.position.set(-5.8, 1.22, 3.68);
    wallBedApron.castShadow = true;
    wallBedApron.receiveShadow = true;
    wallsBedGroup.add(wallBedApron);

    const wallBedLintel = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.6, 0.22), woodMat);
    wallBedLintel.position.set(-5.8, 3.42, 3.68);
    wallBedLintel.castShadow = true;
    wallBedLintel.receiveShadow = true;
    wallsBedGroup.add(wallBedLintel);

    const wallBedSide = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.3, 9.0), woodMat);
    wallBedSide.position.set(-9.4, 2.07, -0.7);
    wallBedSide.castShadow = true;
    wallBedSide.receiveShadow = true;
    wallsBedGroup.add(wallBedSide);

    const wallBedRear = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.3, 0.22), woodMat);
    wallBedRear.position.set(-5.8, 2.07, -5.08);
    wallBedRear.castShadow = true;
    wallBedRear.receiveShadow = true;
    wallsBedGroup.add(wallBedRear);
    houseGroup.add(wallsBedGroup);
    controller.registerComponent("walls-bedroom", wallsBedGroup);

    // -----------------------------------------------------------------
    // Component 14: Living Pavilion Solid Rear Cedar Wall
    // -----------------------------------------------------------------
    const wallLivingRear = new THREE.Mesh(new THREE.BoxGeometry(10.2, 4.0, 0.22), woodMat);
    wallLivingRear.position.set(5.7, 2.45, -4.35);
    wallLivingRear.castShadow = true;
    wallLivingRear.receiveShadow = true;
    houseGroup.add(wallLivingRear);
    controller.registerComponent("walls-living-rear", wallLivingRear);

    // -----------------------------------------------------------------
    // Component 15: Basalt Concrete Fireplace Monolith
    // -----------------------------------------------------------------
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.9, 5.8, 1.8), basaltChimneyMat);
    chimney.position.set(3.0, 2.9, 0.2);
    chimney.castShadow = true;
    chimney.receiveShadow = true;
    houseGroup.add(chimney);
    controller.registerComponent("finishes-fireplace-monolith", chimney);

    // -----------------------------------------------------------------
    // Component 16: Living Pavilion Zinc Roof Plane
    // -----------------------------------------------------------------
    const roofLivingTop = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.22, 11.8), zincRoofMat);
    roofLivingTop.position.set(5.7, 4.82, 0.3);
    roofLivingTop.castShadow = true;
    houseGroup.add(roofLivingTop);
    controller.registerComponent("roof-surfaces-living", roofLivingTop);

    // -----------------------------------------------------------------
    // Component 17: Bedroom Wing Zinc Roof Plane
    // -----------------------------------------------------------------
    const roofBedTop = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.20, 10.6), zincRoofMat);
    roofBedTop.position.set(-5.8, 3.96, -0.7);
    roofBedTop.castShadow = true;
    houseGroup.add(roofBedTop);
    controller.registerComponent("roof-surfaces-bedroom", roofBedTop);

    // -----------------------------------------------------------------
    // Component 18: Exposed Cedar Wood Underside Soffits
    // -----------------------------------------------------------------
    const soffitsGroup = new THREE.Group();
    const soffitLiving = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.04, 11.6), woodMat);
    soffitLiving.position.set(5.7, 4.69, 0.3);
    soffitsGroup.add(soffitLiving);

    const soffitBed = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.04, 10.4), woodMat);
    soffitBed.position.set(-5.8, 3.84, -0.7);
    soffitsGroup.add(soffitBed);
    houseGroup.add(soffitsGroup);
    controller.registerComponent("finishes-soffits", soffitsGroup);

    // -----------------------------------------------------------------
    // Component 19: Dark Metal Mullions & Window Frames
    // -----------------------------------------------------------------
    const windowFramesGroup = new THREE.Group();
    const mullionMat = new THREE.MeshStandardMaterial({ color: 0x121314, roughness: 0.35 });

    const sillFront = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.08, 0.14), mullionMat);
    sillFront.position.set(5.7, 0.46, 4.8);
    windowFramesGroup.add(sillFront);

    const headFront = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.08, 0.14), mullionMat);
    headFront.position.set(5.7, 4.44, 4.8);
    windowFramesGroup.add(headFront);

    for (let mx = 0.6; mx <= 10.8; mx += 2.55) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.96, 0.12), mullionMat);
      mullion.position.set(mx, 2.45, 4.8);
      windowFramesGroup.add(mullion);
    }

    const ribbonFrame = new THREE.Mesh(new THREE.BoxGeometry(5.24, 1.14, 0.14), mullionMat);
    ribbonFrame.position.set(-5.8, 2.65, 3.72);
    windowFramesGroup.add(ribbonFrame);
    houseGroup.add(windowFramesGroup);
    controller.registerComponent("window-frames", windowFramesGroup);

    // -----------------------------------------------------------------
    // Component 20: Panoramic Glass Curtain Walls & Ribbon Glazing
    // -----------------------------------------------------------------
    const glassPanelsGroup = new THREE.Group();
    const glassFront = new THREE.Mesh(new THREE.BoxGeometry(10.2, 3.9, 0.05), glassMat);
    glassFront.position.set(5.7, 2.45, 4.8);
    glassPanelsGroup.add(glassFront);

    const glassSide = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.9, 9.0), glassMat);
    glassSide.position.set(10.8, 2.45, 0.2);
    glassPanelsGroup.add(glassSide);

    const glassRibbon = new THREE.Mesh(new THREE.BoxGeometry(5.15, 1.05, 0.05), glassMat);
    glassRibbon.position.set(-5.8, 2.65, 3.72);
    glassPanelsGroup.add(glassRibbon);
    houseGroup.add(glassPanelsGroup);
    controller.registerComponent("glass-panels", glassPanelsGroup);

    // -----------------------------------------------------------------
    // Component 21: Covered Entrance Solid Timber Pivot Door
    // -----------------------------------------------------------------
    const doorsEntranceGroup = new THREE.Group();
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.9, 0.1), doorMat);
    door.position.set(-0.7, 1.85, 1.4);
    door.castShadow = true;
    doorsEntranceGroup.add(door);

    const doorHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8), steelMat);
    doorHandle.position.set(-0.15, 1.85, 1.52);
    doorsEntranceGroup.add(doorHandle);
    houseGroup.add(doorsEntranceGroup);
    controller.registerComponent("doors-entrance", doorsEntranceGroup);

    // -----------------------------------------------------------------
    // Component 22: Knife-Edge Fascia Trim & Chimney Cap
    // -----------------------------------------------------------------
    const architecturalTrimGroup = new THREE.Group();
    const fasciaLiving = new THREE.Mesh(new THREE.BoxGeometry(12.48, 0.24, 11.88), steelMat);
    fasciaLiving.position.set(5.7, 4.82, 0.3);
    architecturalTrimGroup.add(fasciaLiving);

    const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 2.0), zincRoofMat);
    chimneyCap.position.set(3.0, 5.88, 0.2);
    chimneyCap.castShadow = true;
    architecturalTrimGroup.add(chimneyCap);

    const hearthBox = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.4), steelMat);
    hearthBox.position.set(3.0, 1.0, 1.0);
    architecturalTrimGroup.add(hearthBox);
    houseGroup.add(architecturalTrimGroup);
    controller.registerComponent("architectural-trim", architecturalTrimGroup);

    // -----------------------------------------------------------------
    // Component 23: Interior Travertine Flooring & Hearth Bench
    // -----------------------------------------------------------------
    const interiorFlooringGroup = new THREE.Group();
    const intFloorLiving = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.03, 9.4), travertineFloorMat);
    intFloorLiving.position.set(5.7, 0.43, 0.2);
    intFloorLiving.receiveShadow = true;
    interiorFlooringGroup.add(intFloorLiving);

    const intFloorBed = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.03, 9.0), travertineFloorMat);
    intFloorBed.position.set(-5.8, 0.43, -0.7);
    intFloorBed.receiveShadow = true;
    interiorFlooringGroup.add(intFloorBed);

    const benchMat = new THREE.MeshStandardMaterial({ color: 0x1f1d1b, roughness: 0.5 });
    const bench = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.25, 0.7), benchMat);
    bench.position.set(4.0, 0.55, 1.2);
    interiorFlooringGroup.add(bench);
    houseGroup.add(interiorFlooringGroup);
    controller.registerComponent("interior-flooring-hearth", interiorFlooringGroup);

    // -----------------------------------------------------------------
    // Components 24 & 25: Lighting Systems (Interior & Exterior)
    // -----------------------------------------------------------------
    const interiorMainLight = new THREE.PointLight(0xffa855, 0, 26);
    interiorMainLight.position.set(6.2, 3.4, 1.2);
    interiorMainLight.castShadow = true;
    interiorMainLight.userData = { maxIntensity: 5.4 };
    houseGroup.add(interiorMainLight);

    const interiorHearthLight = new THREE.PointLight(0xff8a38, 0, 16);
    interiorHearthLight.position.set(3.0, 1.8, 1.8);
    interiorHearthLight.userData = { maxIntensity: 2.8 };
    houseGroup.add(interiorHearthLight);

    const interiorBedLight = new THREE.PointLight(0xffa55e, 0, 15);
    interiorBedLight.position.set(-5.0, 2.9, -0.5);
    interiorBedLight.userData = { maxIntensity: 2.2 };
    houseGroup.add(interiorBedLight);

    controller.registerLights("interior-lighting", [interiorMainLight, interiorHearthLight, interiorBedLight]);

    const porchLight = new THREE.PointLight(0xffc285, 0, 9);
    porchLight.position.set(-0.7, 3.1, 2.5);
    porchLight.userData = { maxIntensity: 2.0 };
    houseGroup.add(porchLight);

    const stepLight1 = new THREE.PointLight(0xffb566, 0, 7);
    stepLight1.position.set(2.5, 0.35, 7.2);
    stepLight1.userData = { maxIntensity: 1.8 };
    houseGroup.add(stepLight1);

    const stepLight2 = new THREE.PointLight(0xffb566, 0, 7);
    stepLight2.position.set(8.5, 0.35, 7.2);
    stepLight2.userData = { maxIntensity: 1.8 };
    houseGroup.add(stepLight2);

    controller.registerLights("exterior-lighting", [porchLight, stepLight1, stepLight2]);

    // Expose developer preview controls in development
    const previewProgressRef = { current: null as number | null };
    const timelineManager = new ConstructionTimelineManager();
    timelineManager.onUpdate((p: number) => {
      previewProgressRef.current = p;
    });

    if (typeof window !== "undefined") {
      (window as unknown as { __jetwayConstructionController?: ConstructionController }).__jetwayConstructionController = controller;
      (window as unknown as { __jetwayTimeline?: ConstructionTimelineManager }).__jetwayTimeline = timelineManager;
      (window as unknown as { __jetwayPreviewStage?: (stageNum: number) => void }).__jetwayPreviewStage = (stageNum: number) => {
        const presets: ConstructionStagePreset[] = [
          "foundation",
          "structural-frame",
          "roof-framing",
          "enclosed-house",
          "finished-exterior",
          "completed-bungalow",
        ];
        if (stageNum >= 1 && stageNum <= 6) {
          const target = controller.getPresetProgress(presets[stageNum - 1]);
          previewProgressRef.current = target;
          timelineManager.setProgress(target);
          controller.setPresetStage(presets[stageNum - 1]);
        }
      };
    }

    // Optional keyboard dev shortcuts (1 - 6, Space for play/pause, [ / ] for step jump)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key >= "1" && e.key <= "6" && !e.metaKey && !e.ctrlKey) {
        const num = parseInt(e.key, 10);
        const presets: ConstructionStagePreset[] = [
          "foundation",
          "structural-frame",
          "roof-framing",
          "enclosed-house",
          "finished-exterior",
          "completed-bungalow",
        ];
        const target = controller.getPresetProgress(presets[num - 1]);
        previewProgressRef.current = target;
        timelineManager.setProgress(target);
        controller.setPresetStage(presets[num - 1]);
      } else if (e.code === "Space" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        timelineManager.togglePlay();
      } else if (e.key === "]" && !e.metaKey && !e.ctrlKey) {
        timelineManager.nextStep();
      } else if (e.key === "[" && !e.metaKey && !e.ctrlKey) {
        timelineManager.previousStep();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Reset preview override on user scroll
    const handleScroll = () => {
      if (!timelineManager.isTimelinePlaying()) {
        previewProgressRef.current = null;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    // =================================================================
    // 8. Deliberate Construction Progression Loop (Scroll-Connected)
    // =================================================================
    let smoothedProgress = progressRef.current;
    let lastTime = performance.now();
    let isVisible = true;
    let animationFrameId: number;

    const section = container.closest("#getting-started") || document.getElementById("getting-started");

    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.02 }
    );
    observer.observe(container);

    const render = () => {
      animationFrameId = requestAnimationFrame(render);
      if (!isVisible) return;

      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Single Source of Truth for Progress:
      // Priority 1: Interactive Dev Preview / Timeline Playback
      // Priority 2: Direct Page Scroll Progress through #getting-started
      // Priority 3: Fallback prop progressRef.current
      let scrollTarget = Math.max(0, Math.min(1, progressRef.current));
      if (previewProgressRef.current !== null) {
        scrollTarget = previewProgressRef.current;
      } else if (section) {
        const rect = section.getBoundingClientRect();
        const vh = window.innerHeight;
        const scrollDist = rect.height - vh;
        if (scrollDist > 0) {
          const raw = -rect.top / scrollDist;
          scrollTarget = Math.max(0, Math.min(1, raw));
        }
      }

      // Responsive Dynamic Lerp: Swift during rapid scrolling, silky smooth during micro-scrubs
      const diff = scrollTarget - smoothedProgress;
      if (Math.abs(diff) < 0.0002) {
        smoothedProgress = scrollTarget;
      } else {
        const speed = Math.min(0.28, 0.14 + Math.abs(diff) * 0.22);
        smoothedProgress += diff * speed;
      }

      const p = isReducedMotion ? 1.0 : smoothedProgress;

      // Blueprint visibility in Stage 1 Source (fades out as foundation sets)
      if (p < 0.24) {
        blueprintGroup.visible = true;
        blueprintMat.opacity = Math.max(0.08, 1.0 - (p / 0.24));
      } else {
        blueprintGroup.visible = false;
      }

      // Delegate all component transforms, assembly order & reveals to the Controller
      controller.setAssemblyProgress(p);

      // Environment sunlight twilight shift in Stage 3 (0.84 to 1.00)
      if (p >= 0.84) {
        const lightGlow = Math.min(1, (p - 0.84) / 0.16);
        sunLight.intensity = 3.5 - lightGlow * 1.6;
        sunLight.color.setHex(0xffcb9e);
        hemiLight.intensity = 1.1 - lightGlow * 0.3;
      } else {
        sunLight.intensity = 3.5;
        sunLight.color.setHex(0xffeed8);
        hemiLight.intensity = 1.1;
      }

      // Responsive Camera Progression:
      // Calculate current container dimensions and distance factor for mobile/tablet framing
      const curW = container.clientWidth || window.innerWidth;
      const curH = container.clientHeight || window.innerHeight;
      const { distFactor } = calcCameraParams(curW, curH);

      // Hermite smoothstep for natural architectural dolly movement
      // At 0.00: High 3/4 establishing viewpoint (clearing + footprint)
      // At 0.40 - 0.60: Eye-level structural framing (columns + beams + joists)
      // At 0.90 - 1.00: Exquisite architectural twilight composition (finished bungalow)
      const s = p * p * (3 - 2 * p);
      const targetCamX = (24.4 - s * 4.0) * distFactor;
      const targetCamY = (11.8 - s * 1.6) * distFactor;
      const targetCamZ = (28.4 - s * 3.0) * distFactor;
      const lookX = 1.0 + s * 0.2;
      const lookY = 2.0 + s * 0.4;
      const lookZ = 0.2 - s * 0.1;

      camera.position.set(targetCamX, targetCamY, targetCamZ);
      camera.lookAt(lookX, lookY, lookZ);

      renderer.render(scene, camera);
    };

    render();

    // Resize handler with responsive FOV updates
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const params = calcCameraParams(w, h);
      camera.fov = params.fov;
      camera.aspect = params.aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    };

    window.addEventListener("resize", handleResize, { passive: true });

    // Resource cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll);
      timelineManager.pause();
      observer.disconnect();

      groundGeo.dispose();
      groundMat.dispose();
      forestDiff.dispose();
      forestNor.dispose();
      forestRough.dispose();

      barkDiff.dispose();
      barkNor.dispose();
      barkRough.dispose();

      concreteDiff.dispose();
      concreteNor.dispose();
      concreteRough.dispose();

      woodDiff.dispose();
      woodNor.dispose();
      woodRough.dispose();

      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isReducedMotion]);

  if (webGLError) {
    return (
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none bg-[#0c0e10] flex items-center justify-center">
        <div className="text-center font-mono text-[12px] text-[#A8A49C]">
          [Modern Architectural Woodland Clearing — WebGL fallback]
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none bg-[#0c0e10]"
      aria-hidden="true"
    />
  );
}

export default ArchitecturalConstructionCanvas;
