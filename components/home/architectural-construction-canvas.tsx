"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface ArchitecturalConstructionCanvasProps {
  progress: number; // Normalized construction progress [0 .. 1]
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
 * ArchitecturalConstructionCanvas: Sophisticated Modern Bungalow & Woodland Clearing
 *
 * Continuous, physically coherent architectural construction progression:
 * - 0.00 - 0.20: Forest clearing, site blueprint grid, glowing footprint lines & survey stakes
 * - 0.18 - 0.38: Substantial stepped concrete foundation plinths, terrace & floating entrance steps
 * - 0.34 - 0.54: Heavy architectural steel columns rising from anchors, header beams & roof joists
 * - 0.50 - 0.70: Exterior cedar slat wall panels & basalt concrete fireplace monolith rising into place
 * - 0.64 - 0.82: Multi-level cantilevered roof planes with zinc metal fascia and cedar soffit
 * - 0.76 - 0.90: Panoramic floor-to-ceiling glass curtain walls, dark mullions & timber pivot door
 * - 0.86 - 1.00: Twilight golden hour transition; radiant warm interior & terrace step lights illuminate
 */
export function ArchitecturalConstructionCanvas({
  progress,
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
    scene.fog = new THREE.FogExp2(0x0c0e10, 0.014);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Cinematic Three-Quarter Architectural Camera
    // Perfectly frames both the panoramic glass living pavilion and the cedar wing
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.5, 300);
    camera.position.set(23.5, 11.2, 27.5);
    camera.lookAt(1.2, 2.5, 0.2);

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Cinematic Natural Environmental Lighting
    // Warm late-afternoon sun filtering across the trees
    const sunLight = new THREE.DirectionalLight(0xffeed8, 3.5);
    sunLight.position.set(36, 32, 22);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.camera.left = -28;
    sunLight.shadow.camera.right = 28;
    sunLight.shadow.camera.top = 28;
    sunLight.shadow.camera.bottom = -28;
    sunLight.shadow.bias = -0.0003;
    scene.add(sunLight);

    // Soft woodland ambient fill
    const hemiLight = new THREE.HemisphereLight(0x38444e, 0x161819, 1.1);
    scene.add(hemiLight);

    // Subtle warm bounce light from forest floor
    const bounceLight = new THREE.DirectionalLight(0xd88762, 0.4);
    bounceLight.position.set(-25, 12, -20);
    scene.add(bounceLight);

    // 3. PBR Texture Loading (Poly Haven CC0 Photogrammetry)
    const textureLoader = new THREE.TextureLoader();

    // Forest floor
    const forestDiff = textureLoader.load("/textures/woodland/forest_floor_diff.jpg");
    forestDiff.wrapS = forestDiff.wrapT = THREE.RepeatWrapping;
    forestDiff.repeat.set(12, 12);

    const forestNor = textureLoader.load("/textures/woodland/forest_floor_nor.jpg");
    forestNor.wrapS = forestNor.wrapT = THREE.RepeatWrapping;
    forestNor.repeat.set(12, 12);

    const forestRough = textureLoader.load("/textures/woodland/forest_floor_rough.jpg");
    forestRough.wrapS = forestRough.wrapT = THREE.RepeatWrapping;
    forestRough.repeat.set(12, 12);

    // Tree Bark
    const barkDiff = textureLoader.load("/textures/woodland/bark_diff.jpg");
    barkDiff.wrapS = barkDiff.wrapT = THREE.RepeatWrapping;
    barkDiff.repeat.set(1, 4);

    const barkNor = textureLoader.load("/textures/woodland/bark_nor.jpg");
    barkNor.wrapS = barkNor.wrapT = THREE.RepeatWrapping;
    barkNor.repeat.set(1, 4);

    const barkRough = textureLoader.load("/textures/woodland/bark_rough.jpg");
    barkRough.wrapS = barkRough.wrapT = THREE.RepeatWrapping;
    barkRough.repeat.set(1, 4);

    // Architectural Concrete
    const concreteDiff = textureLoader.load("/textures/architecture/concrete_diff.jpg");
    concreteDiff.wrapS = concreteDiff.wrapT = THREE.RepeatWrapping;
    concreteDiff.repeat.set(4, 2);

    const concreteNor = textureLoader.load("/textures/architecture/concrete_nor.jpg");
    concreteNor.wrapS = concreteNor.wrapT = THREE.RepeatWrapping;
    concreteNor.repeat.set(4, 2);

    const concreteRough = textureLoader.load("/textures/architecture/concrete_rough.jpg");
    concreteRough.wrapS = concreteRough.wrapT = THREE.RepeatWrapping;
    concreteRough.repeat.set(4, 2);

    // Architectural Cedar / Timber Siding
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
      // Flat plateau in center for bungalow foundation, organic woodland rises at edges
      let h = (Math.sin(gx * 0.09) * 0.75 + Math.cos(gz * 0.11) * 0.65) *
        Math.min(1.0, Math.max(0, (distFromCenter - 12) / 14));
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

    // 5. Mature Natural Woodland Evergreens (Organic Layered Boughs & Pine Silhouettes)
    const treesGroup = new THREE.Group();
    const treeBarkMat = new THREE.MeshStandardMaterial({
      map: barkDiff,
      normalMap: barkNor,
      roughnessMap: barkRough,
      roughness: 0.88,
      metalness: 0.02,
    });

    const foliageColors = [
      new THREE.Color(0x132217), // Deep pine emerald
      new THREE.Color(0x1a2b1f), // Forest pine
      new THREE.Color(0x223627), // Alpine fir
      new THREE.Color(0x283e2e), // Highland spruce
    ];

    const foliageMaterials = foliageColors.map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.84, metalness: 0.05 })
    );

    /**
     * Create an organic alpine pine tree with layered drooping boughs and multi-faceted clusters.
     */
    function createOrganicPine(height = 12, radius = 3.2, seed = 0) {
      const tree = new THREE.Group();
      const foliageMat = foliageMaterials[seed % foliageMaterials.length];

      // Organic tapering trunk
      const trunkH = height * 0.45;
      const trunkGeo = new THREE.CylinderGeometry(0.14, 0.42, trunkH, 8);
      const trunk = new THREE.Mesh(trunkGeo, treeBarkMat);
      trunk.position.y = trunkH * 0.5;
      trunk.rotation.z = (Math.sin(seed * 2.3) * 0.04);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      tree.add(trunk);

      // 10 tiers of drooping layered branch clusters
      const tiers = 10;
      for (let t = 0; t < tiers; t++) {
        const tn = t / (tiers - 1); // 0 at bottom, 1 at crown
        const tierY = height * (0.28 + tn * 0.68);
        const tierRadius = radius * Math.pow(1.0 - tn * 0.85, 0.8) * (0.9 + (Math.sin(seed + t) * 0.15));
        const branchesInTier = 5 + (t % 3);

        const tierGroup = new THREE.Group();
        tierGroup.position.y = tierY;
        tierGroup.rotation.y = (t * 0.8) + (seed * 1.5);

        for (let b = 0; b < branchesInTier; b++) {
          const angle = (b / branchesInTier) * Math.PI * 2 + ((t % 2) * 0.3);
          const bLen = tierRadius * (0.85 + Math.sin(b * 1.7) * 0.2);

          // Flattened, drooping branch bough cluster
          const branchGeo = new THREE.ConeGeometry(bLen * 0.48, bLen, 5);
          branchGeo.rotateZ(Math.PI / 2);
          branchGeo.scale(1.0, 0.35, 0.9);

          const branchMesh = new THREE.Mesh(branchGeo, foliageMat);
          branchMesh.position.x = Math.cos(angle) * (bLen * 0.5);
          branchMesh.position.z = Math.sin(angle) * (bLen * 0.5);
          // Natural downward droop
          branchMesh.position.y = -0.15 * (1.0 - tn);
          branchMesh.rotation.y = -angle;
          branchMesh.rotation.z = -0.18 * (1.0 - tn); // Drooping bough angle
          branchMesh.castShadow = true;
          branchMesh.receiveShadow = true;
          tierGroup.add(branchMesh);
        }

        // Tier central filler cone
        const centerConeH = height * (0.22 - tn * 0.08);
        const centerCone = new THREE.Mesh(
          new THREE.ConeGeometry(tierRadius * 0.65, centerConeH, 6),
          foliageMat
        );
        centerCone.castShadow = true;
        tierGroup.add(centerCone);

        tree.add(tierGroup);
      }

      // Slender crown tip
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(0.35, height * 0.18, 5),
        foliageMat
      );
      crown.position.y = height * 0.94;
      crown.castShadow = true;
      tree.add(crown);

      return tree;
    }

    // Natural encircling distribution with dramatic depth
    const treeSpots = [
      // Deep background forest wall (dense pines 13m - 17m tall)
      { x: -22, z: -22, h: 14.5, r: 3.5, s: 1 },
      { x: -15, z: -26, h: 16.0, r: 3.8, s: 2 },
      { x: -7, z: -28, h: 15.5, r: 3.6, s: 3 },
      { x: 1, z: -30, h: 17.0, r: 4.0, s: 4 },
      { x: 9, z: -27, h: 15.0, r: 3.6, s: 5 },
      { x: 17, z: -24, h: 16.5, r: 3.9, s: 6 },
      { x: 25, z: -19, h: 14.0, r: 3.3, s: 7 },
      { x: -28, z: -16, h: 15.0, r: 3.5, s: 8 },

      // Midground flanks (framing the bungalow)
      { x: -24, z: -8, h: 13.0, r: 3.1, s: 9 },
      { x: -26, z: 3, h: 13.5, r: 3.2, s: 10 },
      { x: -21, z: 14, h: 11.5, r: 2.8, s: 11 },
      { x: 26, z: -6, h: 12.5, r: 3.0, s: 12 },
      { x: 28, z: 7, h: 14.0, r: 3.3, s: 13 },
      { x: 23, z: 16, h: 11.0, r: 2.7, s: 14 },

      // Foreground edge framing trees (giving cinematic perspective depth)
      { x: -18, z: 27, h: 10.5, r: 2.6, s: 15 },
      { x: 22, z: 28, h: 11.0, r: 2.7, s: 16 },
    ];

    treeSpots.forEach((ts) => {
      const tree = createOrganicPine(ts.h, ts.r, ts.s);
      tree.position.set(ts.x, 0, ts.z);
      treesGroup.add(tree);
    });
    scene.add(treesGroup);

    // 6. Photogrammetry Mossy Rocks along Woodland Perimeter
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
    // 7. THE CONTEMPORARY ARCHITECTURAL BUNGALOW RESIDENCE
    // =================================================================
    // Architectural Composition:
    // Volume A: High-ceiling Panoramic Glass Living Pavilion (Right) ~ 11m x 8m, 4.2m high
    // Volume B: Private Cedar Timber Bedroom Wing (Left) ~ 7.8m x 9m, 3.4m high
    // Volume C: Covered Entrance Breezeway Porch & Solid Timber Pivot Door (Center)
    // Volume D: Dark Basalt Fireplace Monolith (Ground through roof)
    // Volume E: Cantilevered Concrete Terrace & Illuminated Floating Steps
    const houseGroup = new THREE.Group();
    scene.add(houseGroup);

    // Materials
    const concreteMat = new THREE.MeshStandardMaterial({
      map: concreteDiff,
      normalMap: concreteNor,
      roughnessMap: concreteRough,
      roughness: 0.82,
      metalness: 0.04,
    });

    // Dark Basalt / Textured Charcoal Stone for Fireplace Column
    const basaltChimneyMat = new THREE.MeshStandardMaterial({
      map: concreteDiff,
      normalMap: concreteNor,
      roughnessMap: concreteRough,
      color: 0x484643,
      roughness: 0.85,
      metalness: 0.08,
    });

    const woodMat = new THREE.MeshStandardMaterial({
      map: woodDiff,
      normalMap: woodNor,
      roughnessMap: woodRough,
      roughness: 0.65,
      metalness: 0.04,
    });

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x181a1c,
      roughness: 0.32,
      metalness: 0.88,
    });

    const zincRoofMat = new THREE.MeshStandardMaterial({
      color: 0x1e2124,
      roughness: 0.38,
      metalness: 0.75,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xa4c6df,
      transparent: true,
      opacity: 0.36,
      roughness: 0.03,
      metalness: 0.28,
    });

    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x3d2b1f,
      roughness: 0.52,
      metalness: 0.08,
    });

    const travertineFloorMat = new THREE.MeshStandardMaterial({
      color: 0x332c26,
      roughness: 0.55,
      metalness: 0.12,
    });

    const blueprintMat = new THREE.LineBasicMaterial({
      color: 0xd88762,
      transparent: true,
      opacity: 0.85,
    });

    // -----------------------------------------------------------------
    // PHASE 1: Blueprint Footprint Lines & Site Survey Stakes (0.00 - 0.20)
    // -----------------------------------------------------------------
    const blueprintGroup = new THREE.Group();

    // Subtle ground construction grid
    const gridHelper = new THREE.GridHelper(28, 28, 0xd88762, 0x261f1a);
    gridHelper.position.y = 0.03;
    blueprintGroup.add(gridHelper);

    // Multi-volume L-shaped foundation perimeter footprint
    const footprintPoints = [
      // Bedroom wing (Left)
      new THREE.Vector3(-9.6, 0.06, 3.9),
      new THREE.Vector3(-2.0, 0.06, 3.9),
      // Recessed covered entrance porch (Center)
      new THREE.Vector3(-2.0, 0.06, 2.0),
      new THREE.Vector3(0.6, 0.06, 2.0),
      // Living pavilion (Right)
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

    // Corner survey stakes with orange surveyor ribbons
    const stakeGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.8, 6);
    const stakeMat = new THREE.MeshStandardMaterial({ color: 0xd88762, roughness: 0.45 });
    [
      [-9.6, 3.9],
      [-2.0, 2.0],
      [0.6, 2.0],
      [11.0, 5.0],
      [11.0, -4.6],
      [-9.6, -5.3],
    ].forEach(([sx, sz]) => {
      const stake = new THREE.Mesh(stakeGeo, stakeMat);
      stake.position.set(sx, 0.4, sz);
      blueprintGroup.add(stake);
    });

    houseGroup.add(blueprintGroup);

    // -----------------------------------------------------------------
    // PHASE 2: Substantial Concrete Foundation Plinths & Terrace (0.18 - 0.38)
    // -----------------------------------------------------------------
    const foundationGroup = new THREE.Group();

    // Main living pavilion foundation slab
    const slabLiving = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.42, 9.8), concreteMat);
    slabLiving.position.set(5.7, 0.21, 0.2);
    slabLiving.castShadow = true;
    slabLiving.receiveShadow = true;
    foundationGroup.add(slabLiving);

    // Bedroom wing foundation slab
    const slabBed = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.42, 9.4), concreteMat);
    slabBed.position.set(-5.8, 0.21, -0.7);
    slabBed.castShadow = true;
    slabBed.receiveShadow = true;
    foundationGroup.add(slabBed);

    // Connecting entrance porch slab
    const slabPorch = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.36, 3.2), concreteMat);
    slabPorch.position.set(-0.7, 0.18, 2.3);
    slabPorch.castShadow = true;
    slabPorch.receiveShadow = true;
    foundationGroup.add(slabPorch);

    // Cantilevered outdoor concrete terrace extending before panoramic glass
    const terraceGeo = new THREE.BoxGeometry(11.8, 0.22, 3.2);
    const terrace = new THREE.Mesh(terraceGeo, concreteMat);
    terrace.position.set(5.7, 0.11, 6.6);
    terrace.castShadow = true;
    terrace.receiveShadow = true;
    foundationGroup.add(terrace);

    // Floating entrance steps leading into the woodland clearing
    const stepGeo = new THREE.BoxGeometry(12.4, 0.11, 0.9);
    const step = new THREE.Mesh(stepGeo, concreteMat);
    step.position.set(5.7, 0.055, 8.3);
    step.receiveShadow = true;
    foundationGroup.add(step);

    // Structural steel anchor plates (bolted to foundation for column bases)
    const anchorGeo = new THREE.BoxGeometry(0.32, 0.03, 0.32);
    [
      [0.6, 4.8], [5.7, 4.8], [10.8, 4.8],
      [0.6, -4.4], [5.7, -4.4], [10.8, -4.4],
      [-9.4, 3.7], [-2.1, 3.7], [-9.4, -5.1], [-2.1, -5.1]
    ].forEach(([ax, az]) => {
      const anchor = new THREE.Mesh(anchorGeo, steelMat);
      anchor.position.set(ax, 0.43, az);
      foundationGroup.add(anchor);
    });

    houseGroup.add(foundationGroup);

    // -----------------------------------------------------------------
    // PHASE 3: Steel Columns, Beams & Roof Framing (0.34 - 0.54)
    // -----------------------------------------------------------------
    const structureGroup = new THREE.Group();

    // Architectural dark steel columns (10 structural columns aligned with anchors)
    const colGeoLiving = new THREE.BoxGeometry(0.22, 4.1, 0.22);
    const colGeoBed = new THREE.BoxGeometry(0.20, 3.3, 0.20);

    // Living pavilion columns (soaring 4.1m ceiling)
    const livingColCoords = [
      [0.6, 4.8], [5.7, 4.8], [10.8, 4.8],
      [0.6, -4.4], [5.7, -4.4], [10.8, -4.4],
    ];
    livingColCoords.forEach(([cx, cz]) => {
      const col = new THREE.Mesh(colGeoLiving, steelMat);
      col.position.set(cx, 0.42 + 2.05, cz);
      col.castShadow = true;
      structureGroup.add(col);
    });

    // Bedroom wing columns (3.3m ceiling)
    const bedColCoords = [
      [-9.4, 3.7], [-2.1, 3.7],
      [-9.4, -5.1], [-2.1, -5.1],
    ];
    bedColCoords.forEach(([cx, cz]) => {
      const col = new THREE.Mesh(colGeoBed, steelMat);
      col.position.set(cx, 0.42 + 1.65, cz);
      col.castShadow = true;
      structureGroup.add(col);
    });

    // Primary horizontal steel header beams
    // Living front header beam
    const beamLivingFront = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.34, 0.26), steelMat);
    beamLivingFront.position.set(5.7, 4.58, 4.8);
    beamLivingFront.castShadow = true;
    structureGroup.add(beamLivingFront);

    // Living rear header beam
    const beamLivingBack = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.34, 0.26), steelMat);
    beamLivingBack.position.set(5.7, 4.58, -4.4);
    beamLivingBack.castShadow = true;
    structureGroup.add(beamLivingBack);

    // Bedroom wing front beam
    const beamBedFront = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.28, 0.24), steelMat);
    beamBedFront.position.set(-5.8, 3.78, 3.7);
    beamBedFront.castShadow = true;
    structureGroup.add(beamBedFront);

    // Transverse structural roof joists
    for (let j = 1.2; j <= 10.2; j += 1.5) {
      const joist = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 9.6), steelMat);
      joist.position.set(j, 4.56, 0.2);
      joist.castShadow = true;
      structureGroup.add(joist);
    }
    for (let j = -8.8; j <= -2.6; j += 1.4) {
      const joist = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.20, 9.0), steelMat);
      joist.position.set(j, 3.76, -0.7);
      joist.castShadow = true;
      structureGroup.add(joist);
    }

    houseGroup.add(structureGroup);

    // -----------------------------------------------------------------
    // PHASE 4: Enclosure Cedar Walls & Basalt Fireplace Monolith (0.50 - 0.70)
    // -----------------------------------------------------------------
    const wallsGroup = new THREE.Group();

    // Bedroom wing exterior cedar slat walls
    // Front bedroom wall
    const wallBedFront = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.3, 0.22), woodMat);
    wallBedFront.position.set(-5.8, 2.07, 3.68);
    wallBedFront.castShadow = true;
    wallBedFront.receiveShadow = true;
    wallsGroup.add(wallBedFront);

    // Outer side wall
    const wallBedSide = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.3, 9.0), woodMat);
    wallBedSide.position.set(-9.4, 2.07, -0.7);
    wallBedSide.castShadow = true;
    wallBedSide.receiveShadow = true;
    wallsGroup.add(wallBedSide);

    // Rear wall
    const wallBedRear = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.3, 0.22), woodMat);
    wallBedRear.position.set(-5.8, 2.07, -5.08);
    wallBedRear.castShadow = true;
    wallsGroup.add(wallBedRear);

    // Living pavilion rear solid wall
    const wallLivingRear = new THREE.Mesh(new THREE.BoxGeometry(10.2, 4.0, 0.22), woodMat);
    wallLivingRear.position.set(5.7, 2.45, -4.35);
    wallLivingRear.castShadow = true;
    wallsGroup.add(wallLivingRear);

    // Dark Basalt concrete fireplace monolith (Ground through roof)
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.9, 5.8, 1.8), basaltChimneyMat);
    chimney.position.set(3.0, 2.9, 0.2);
    chimney.castShadow = true;
    chimney.receiveShadow = true;
    wallsGroup.add(chimney);

    // Dark architectural zinc chimney shroud & cap trim
    const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 2.0), zincRoofMat);
    chimneyCap.position.set(3.0, 5.88, 0.2);
    chimneyCap.castShadow = true;
    wallsGroup.add(chimneyCap);

    // Recessed dark steel firebox hearth niche
    const hearthBox = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.4), steelMat);
    hearthBox.position.set(3.0, 1.0, 1.0);
    wallsGroup.add(hearthBox);

    houseGroup.add(wallsGroup);

    // -----------------------------------------------------------------
    // PHASE 5: Cantilevered Multi-Level Roof Planes (0.64 - 0.82)
    // -----------------------------------------------------------------
    const roofGroup = new THREE.Group();

    // High living pavilion roof plane
    // Dark zinc metal standing-seam surface
    const roofLivingTop = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.22, 11.8), zincRoofMat);
    roofLivingTop.position.set(5.7, 4.82, 0.3);
    roofLivingTop.castShadow = true;
    roofGroup.add(roofLivingTop);

    // Exposed tongue-and-groove cedar soffit underside
    const soffitLiving = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.04, 11.6), woodMat);
    soffitLiving.position.set(5.7, 4.69, 0.3);
    roofGroup.add(soffitLiving);

    // Knife-edge dark metal fascia edge trim
    const fasciaLiving = new THREE.Mesh(new THREE.BoxGeometry(12.48, 0.24, 11.88), steelMat);
    fasciaLiving.position.set(5.7, 4.82, 0.3);
    roofGroup.add(fasciaLiving);

    // Lower bedroom wing roof plane
    const roofBedTop = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.20, 10.6), zincRoofMat);
    roofBedTop.position.set(-5.8, 3.96, -0.7);
    roofBedTop.castShadow = true;
    roofGroup.add(roofBedTop);

    const soffitBed = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.04, 10.4), woodMat);
    soffitBed.position.set(-5.8, 3.84, -0.7);
    roofGroup.add(soffitBed);

    houseGroup.add(roofGroup);

    // -----------------------------------------------------------------
    // PHASE 6: Panoramic Glass Curtain Walls & Entrance Door (0.76 - 0.90)
    // -----------------------------------------------------------------
    const finishGroup = new THREE.Group();

    // Living Pavilion Panoramic Front Glass Curtain Wall
    const glassFront = new THREE.Mesh(new THREE.BoxGeometry(10.2, 4.0, 0.05), glassMat);
    glassFront.position.set(5.7, 2.45, 4.8);
    finishGroup.add(glassFront);

    // Living Right Side Glass Wall
    const glassSide = new THREE.Mesh(new THREE.BoxGeometry(0.05, 4.0, 9.2), glassMat);
    glassSide.position.set(10.8, 2.45, 0.2);
    finishGroup.add(glassSide);

    // Slender dark architectural window mullions
    const mullionMat = new THREE.MeshStandardMaterial({ color: 0x121314, roughness: 0.35 });
    for (let mx = 1.0; mx <= 10.4; mx += 2.4) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.08, 4.0, 0.12), mullionMat);
      mullion.position.set(mx, 2.45, 4.8);
      finishGroup.add(mullion);
    }

    // Bedroom horizontal ribbon window
    const glassRibbon = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.1, 0.05), glassMat);
    glassRibbon.position.set(-5.8, 2.65, 3.75);
    finishGroup.add(glassRibbon);

    // Covered Entrance Porch Solid Timber Pivot Door
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.9, 0.1), doorMat);
    door.position.set(-0.7, 1.85, 1.4);
    door.castShadow = true;
    finishGroup.add(door);

    // Vertical bronze/steel pull bar
    const doorHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8), steelMat);
    doorHandle.position.set(-0.15, 1.85, 1.52);
    finishGroup.add(doorHandle);

    houseGroup.add(finishGroup);

    // -----------------------------------------------------------------
    // PHASE 7: Interior Travertine Floors, Hearth & Radiant Twilight Glow (0.86 - 1.00)
    // -----------------------------------------------------------------
    const interiorGroup = new THREE.Group();

    // Interior travertine flooring
    const intFloorLiving = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.03, 9.4), travertineFloorMat);
    intFloorLiving.position.set(5.7, 0.43, 0.2);
    intFloorLiving.receiveShadow = true;
    interiorGroup.add(intFloorLiving);

    const intFloorBed = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.03, 9.0), travertineFloorMat);
    intFloorBed.position.set(-5.8, 0.43, -0.7);
    intFloorBed.receiveShadow = true;
    interiorGroup.add(intFloorBed);

    // Modern floating hearth bench
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x1f1d1b, roughness: 0.5 });
    const bench = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.25, 0.7), benchMat);
    bench.position.set(4.0, 0.55, 1.2);
    interiorGroup.add(bench);

    // Radiant warm golden architectural interior lights
    // Central living pavilion warm glow
    const interiorMainLight = new THREE.PointLight(0xffa855, 0, 26);
    interiorMainLight.position.set(6.2, 3.4, 1.2);
    interiorMainLight.castShadow = true;
    interiorGroup.add(interiorMainLight);

    // Fireplace hearth warm amber accent
    const interiorHearthLight = new THREE.PointLight(0xff8a38, 0, 16);
    interiorHearthLight.position.set(3.0, 1.8, 1.8);
    interiorGroup.add(interiorHearthLight);

    // Bedroom soft golden illumination
    const interiorBedLight = new THREE.PointLight(0xffa55e, 0, 15);
    interiorBedLight.position.set(-5.0, 2.9, -0.5);
    interiorGroup.add(interiorBedLight);

    // Covered entry porch sconce light
    const porchLight = new THREE.PointLight(0xffc285, 0, 9);
    porchLight.position.set(-0.7, 3.1, 2.5);
    interiorGroup.add(porchLight);

    // Terrace floating step accent uplights (Luxury architectural ground wash)
    const stepLight1 = new THREE.PointLight(0xffb566, 0, 7);
    stepLight1.position.set(2.5, 0.35, 7.2);
    interiorGroup.add(stepLight1);

    const stepLight2 = new THREE.PointLight(0xffb566, 0, 7);
    stepLight2.position.set(8.5, 0.35, 7.2);
    interiorGroup.add(stepLight2);

    houseGroup.add(interiorGroup);

    // =================================================================
    // 8. Deliberate Construction Progression Loop
    // =================================================================
    let smoothedProgress = progressRef.current;
    let lastTime = performance.now();
    let isVisible = true;
    let animationFrameId: number;

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

      const targetP = Math.max(0, Math.min(1, progressRef.current));
      smoothedProgress += (targetP - smoothedProgress) * 0.14;
      const p = isReducedMotion ? 1.0 : smoothedProgress;

      // ---------------------------------------------------------------
      // GRANULAR ARCHITECTURAL MILESTONES ACROSS TIMELINE
      // ---------------------------------------------------------------

      // 1. Blueprint Guide Lines & Stakes (0.00 -> 0.24)
      if (p < 0.24) {
        blueprintGroup.visible = true;
        blueprintMat.opacity = Math.max(0.1, 1.0 - (p / 0.24));
      } else {
        blueprintGroup.visible = false;
      }

      // 2. Concrete Foundation Plinths & Terrace (0.18 -> 0.38)
      if (p < 0.18) {
        foundationGroup.visible = false;
      } else if (p < 0.38) {
        foundationGroup.visible = true;
        const fNorm = (p - 0.18) / 0.20;
        // Foundation rises solidly into place from the earth
        foundationGroup.position.y = (fNorm - 1.0) * 0.45;
      } else {
        foundationGroup.visible = true;
        foundationGroup.position.y = 0;
      }

      // 3. Steel Columns, Beams & Roof Framing (0.34 -> 0.54)
      if (p < 0.34) {
        structureGroup.visible = false;
      } else if (p < 0.54) {
        structureGroup.visible = true;
        const sNorm = (p - 0.34) / 0.20;
        // Columns rise vertically from their foundation anchor plates
        structureGroup.scale.set(1, Math.max(0.01, sNorm), 1);
        structureGroup.position.y = (sNorm - 1.0) * 2.2;
      } else {
        structureGroup.visible = true;
        structureGroup.scale.set(1, 1, 1);
        structureGroup.position.y = 0;
      }

      // 4. Exterior Walls & Basalt Fireplace Monolith (0.50 -> 0.70)
      if (p < 0.50) {
        wallsGroup.visible = false;
      } else if (p < 0.70) {
        wallsGroup.visible = true;
        const wNorm = (p - 0.50) / 0.20;
        wallsGroup.position.y = (wNorm - 1.0) * 2.6;
      } else {
        wallsGroup.visible = true;
        wallsGroup.position.y = 0;
      }

      // 5. Cantilevered Dual Roof Planes (0.64 -> 0.82)
      if (p < 0.64) {
        roofGroup.visible = false;
      } else if (p < 0.82) {
        roofGroup.visible = true;
        const rNorm = (p - 0.64) / 0.18;
        // Roof planes lower deliberately onto structural beams
        roofGroup.position.y = (1.0 - rNorm) * 2.8;
      } else {
        roofGroup.visible = true;
        roofGroup.position.y = 0;
      }

      // 6. Panoramic Glass Walls, Mullions & Doors (0.76 -> 0.90)
      if (p < 0.76) {
        finishGroup.visible = false;
      } else if (p < 0.90) {
        finishGroup.visible = true;
        const gNorm = (p - 0.76) / 0.14;
        finishGroup.position.y = (1.0 - gNorm) * 0.8;
      } else {
        finishGroup.visible = true;
        finishGroup.position.y = 0;
      }

      // 7. Interior Travertine, Hearth & Radiant Twilight Glow (0.86 -> 1.00)
      if (p < 0.86) {
        interiorGroup.visible = false;
        interiorMainLight.intensity = 0;
        interiorHearthLight.intensity = 0;
        interiorBedLight.intensity = 0;
        porchLight.intensity = 0;
        stepLight1.intensity = 0;
        stepLight2.intensity = 0;
      } else {
        interiorGroup.visible = true;
        const lightGlow = Math.min(1, (p - 0.86) / 0.14);
        interiorMainLight.intensity = lightGlow * 5.4;
        interiorHearthLight.intensity = lightGlow * 2.8;
        interiorBedLight.intensity = lightGlow * 2.2;
        porchLight.intensity = lightGlow * 2.0;
        stepLight1.intensity = lightGlow * 1.8;
        stepLight2.intensity = lightGlow * 1.8;

        // Subtle twilight shift: sunlight softens to dusk, interior shines through glass
        sunLight.intensity = 3.5 - lightGlow * 1.5;
        sunLight.color.setHex(0xffcb9e);
      }

      if (p < 0.86) {
        sunLight.intensity = 3.5;
        sunLight.color.setHex(0xffeed8);
      }

      // Smooth, deliberate architectural camera drift framing the bungalow
      const targetCamX = 23.5 - p * 3.8;
      const targetCamY = 11.2 - p * 1.4;
      const targetCamZ = 27.5 - p * 2.4;
      camera.position.set(targetCamX, targetCamY, targetCamZ);
      camera.lookAt(1.2, 2.5, 0.2);

      renderer.render(scene, camera);
    };

    render();

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    };

    window.addEventListener("resize", handleResize, { passive: true });

    // Resource cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
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
