"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface ArchitecturalConstructionCanvasProps {
  progress: number; // Normalized scroll or scrub progress [0 .. 1]
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
 * ArchitecturalConstructionCanvas
 * A cinematic 3D architectural experience set in a natural woodland clearing:
 * - Stage 1 (0.00 - 0.35): The Clearing & Architectural Blueprint Lines
 * - Stage 2 (0.35 - 0.70): Believable Construction Sequence (Foundation -> Columns/Beams -> Framing)
 * - Stage 3 (0.70 - 1.00): Completed Modern Residence with Timber Siding, Glass Walls, & Warm Interior Light
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

    // 1. Scene, Camera & Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1011);
    scene.fog = new THREE.FogExp2(0x0e1011, 0.016);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    // Perspective camera framing the woodland clearing and modern pavilion
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.5, 300);
    camera.position.set(16, 8.5, 22);
    camera.lookAt(0, 2.2, 0);

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Cinematic Natural Lighting
    // Warm late-afternoon sun filtering through the trees
    const sunLight = new THREE.DirectionalLight(0xffeed6, 3.2);
    sunLight.position.set(32, 28, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left = -25;
    sunLight.shadow.camera.right = 25;
    sunLight.shadow.camera.top = 25;
    sunLight.shadow.camera.bottom = -25;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);

    // Cool woodland sky bounce
    const hemiLight = new THREE.HemisphereLight(0x2f373d, 0x141618, 0.95);
    scene.add(hemiLight);

    // Subtle amber rim bounce
    const rimLight = new THREE.DirectionalLight(0xd88762, 0.4);
    rimLight.position.set(-25, 12, -20);
    scene.add(rimLight);

    // 3. Texture Loading (Poly Haven CC0 photogrammetry)
    const textureLoader = new THREE.TextureLoader();

    // Forest floor
    const forestDiff = textureLoader.load("/textures/woodland/forest_floor_diff.jpg");
    forestDiff.wrapS = forestDiff.wrapT = THREE.RepeatWrapping;
    forestDiff.repeat.set(10, 10);

    const forestNor = textureLoader.load("/textures/woodland/forest_floor_nor.jpg");
    forestNor.wrapS = forestNor.wrapT = THREE.RepeatWrapping;
    forestNor.repeat.set(10, 10);

    const forestRough = textureLoader.load("/textures/woodland/forest_floor_rough.jpg");
    forestRough.wrapS = forestRough.wrapT = THREE.RepeatWrapping;
    forestRough.repeat.set(10, 10);

    // Concrete
    const concreteDiff = textureLoader.load("/textures/architecture/concrete_diff.jpg");
    concreteDiff.wrapS = concreteDiff.wrapT = THREE.RepeatWrapping;
    concreteDiff.repeat.set(4, 2);

    const concreteNor = textureLoader.load("/textures/architecture/concrete_nor.jpg");
    concreteNor.wrapS = concreteNor.wrapT = THREE.RepeatWrapping;
    concreteNor.repeat.set(4, 2);

    const concreteRough = textureLoader.load("/textures/architecture/concrete_rough.jpg");
    concreteRough.wrapS = concreteRough.wrapT = THREE.RepeatWrapping;
    concreteRough.repeat.set(4, 2);

    // Cedar / Timber
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
    const groundGeo = new THREE.PlaneGeometry(80, 80, 60, 60);
    groundGeo.rotateX(-Math.PI / 2);
    const gPos = groundGeo.attributes.position;
    for (let i = 0; i < gPos.count; i++) {
      const gx = gPos.getX(i);
      const gz = gPos.getZ(i);
      const distFromCenter = Math.sqrt(gx * gx + gz * gz);
      // Keep building clearing flat in center, undulating forest mound around edges
      let h = (Math.sin(gx * 0.12) * 0.6 + Math.cos(gz * 0.14) * 0.5) * Math.min(1.0, Math.max(0, (distFromCenter - 9) / 12));
      gPos.setY(i, h);
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      map: forestDiff,
      normalMap: forestNor,
      roughnessMap: forestRough,
      roughness: 0.95,
      metalness: 0.05,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 5. Surrounding Natural Woodland Trees (Varied Evergreens Encircling Clearing)
    const treesGroup = new THREE.Group();
    const treeBarkMat = new THREE.MeshStandardMaterial({ color: 0x221d18, roughness: 0.9 });
    const treeFoliageMat1 = new THREE.MeshStandardMaterial({ color: 0x1b281f, roughness: 0.85 });
    const treeFoliageMat2 = new THREE.MeshStandardMaterial({ color: 0x243329, roughness: 0.85 });

    function createEvergreen(height = 9, radius = 2.4, isDark = false) {
      const tree = new THREE.Group();
      // Trunk
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, height * 0.45, 7), treeBarkMat);
      trunk.position.y = height * 0.225;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      tree.add(trunk);

      // Tiered needle canopies
      const tiers = 5;
      const fMat = isDark ? treeFoliageMat1 : treeFoliageMat2;
      for (let t = 0; t < tiers; t++) {
        const tierNorm = t / (tiers - 1);
        const coneH = height * (0.32 - tierNorm * 0.08);
        const coneR = radius * (1.0 - tierNorm * 0.65);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(coneR, coneH, 7), fMat);
        cone.position.y = height * (0.35 + tierNorm * 0.5);
        cone.castShadow = true;
        cone.receiveShadow = true;
        tree.add(cone);
      }
      return tree;
    }

    // Place trees in a natural arc enclosing the clearing
    const treePositions = [
      // Deep background arc
      { x: -16, z: -18, h: 11, r: 2.8, dark: true },
      { x: -11, z: -22, h: 13, r: 3.2, dark: false },
      { x: -4, z: -24, h: 12, r: 2.9, dark: true },
      { x: 3, z: -25, h: 14, r: 3.4, dark: false },
      { x: 10, z: -22, h: 12, r: 3.0, dark: true },
      { x: 16, z: -18, h: 13, r: 3.1, dark: false },
      { x: 22, z: -14, h: 11, r: 2.7, dark: true },

      // Midground flanks (framing the house)
      { x: -21, z: -8, h: 10.5, r: 2.6, dark: false },
      { x: -24, z: 2, h: 11.5, r: 2.8, dark: true },
      { x: -19, z: 12, h: 9.5, r: 2.4, dark: false },
      { x: 23, z: -6, h: 10.5, r: 2.7, dark: true },
      { x: 25, z: 4, h: 12, r: 3.0, dark: false },
      { x: 21, z: 14, h: 9.8, r: 2.5, dark: true },

      // Foreground framing trees (edges of view)
      { x: -15, z: 22, h: 8.5, r: 2.2, dark: false },
      { x: 18, z: 24, h: 9.0, r: 2.3, dark: true },
    ];

    treePositions.forEach((tp) => {
      const tree = createEvergreen(tp.h, tp.r, tp.dark);
      tree.position.set(tp.x, 0, tp.z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      treesGroup.add(tree);
    });
    scene.add(treesGroup);

    // 6. Photogrammetry Mossy Rocks Around Clearing Edge
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      "/models/mossy_rock/mossy_rock_1k.gltf",
      (gltf) => {
        const rockModel = gltf.scene;
        const rockPositions = [
          { x: -12, z: 8, s: 1.6, r: 0.4 },
          { x: -14, z: 5, s: 1.2, r: 1.8 },
          { x: 13, z: 10, s: 1.5, r: 2.4 },
          { x: 11, z: 14, s: 1.1, r: 0.9 },
          { x: -8, z: -14, s: 1.8, r: 3.1 },
          { x: 9, z: -16, s: 1.4, r: 1.2 },
        ];
        rockPositions.forEach((rp) => {
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
      (err) => console.warn("Using procedural rocks fallback:", err)
    );

    // =================================================================
    // 7. THE MODERN ARCHITECTURAL HOUSE (Modular Controllable States)
    // =================================================================
    const houseGroup = new THREE.Group();
    houseGroup.position.set(0, 0, 0);
    scene.add(houseGroup);

    // Materials
    const concreteMat = new THREE.MeshStandardMaterial({
      map: concreteDiff,
      normalMap: concreteNor,
      roughnessMap: concreteRough,
      roughness: 0.85,
      metalness: 0.05,
    });

    const woodMat = new THREE.MeshStandardMaterial({
      map: woodDiff,
      normalMap: woodNor,
      roughnessMap: woodRough,
      roughness: 0.7,
      metalness: 0.05,
    });

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x1f2022,
      roughness: 0.4,
      metalness: 0.85,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x9fbcd4,
      transparent: true,
      opacity: 0.42,
      roughness: 0.08,
      metalness: 0.3,
    });

    const blueprintMat = new THREE.LineBasicMaterial({
      color: 0xd88762,
      transparent: true,
      opacity: 0.85,
    });

    // -----------------------------------------------------------------
    // Component A: Blueprint Grid & Footprint Outlines (Stage 1)
    // -----------------------------------------------------------------
    const blueprintGroup = new THREE.Group();

    // Site boundary survey grid on ground
    const gridHelper = new THREE.GridHelper(22, 22, 0xd88762, 0x33261f);
    gridHelper.position.y = 0.04;
    blueprintGroup.add(gridHelper);

    // Perimeter foundation outline
    const footprintPoints = [
      new THREE.Vector3(-8, 0.06, -5),
      new THREE.Vector3(8, 0.06, -5),
      new THREE.Vector3(8, 0.06, 5),
      new THREE.Vector3(-8, 0.06, 5),
      new THREE.Vector3(-8, 0.06, -5),
    ];
    const footprintGeo = new THREE.BufferGeometry().setFromPoints(footprintPoints);
    const footprintLine = new THREE.Line(footprintGeo, blueprintMat);
    blueprintGroup.add(footprintLine);

    // Site surveying corner stakes
    const stakeGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6);
    const stakeMat = new THREE.MeshStandardMaterial({ color: 0xd88762, roughness: 0.5 });
    [
      [-8, -5],
      [8, -5],
      [8, 5],
      [-8, 5],
    ].forEach(([sx, sz]) => {
      const stake = new THREE.Mesh(stakeGeo, stakeMat);
      stake.position.set(sx, 0.4, sz);
      blueprintGroup.add(stake);
    });

    houseGroup.add(blueprintGroup);

    // -----------------------------------------------------------------
    // Component B: Concrete Foundation Slab & Terrace (Stage 2 & 3)
    // -----------------------------------------------------------------
    const foundationGroup = new THREE.Group();

    // Main plinth slab
    const slabGeo = new THREE.BoxGeometry(16.4, 0.45, 10.4);
    const slabMesh = new THREE.Mesh(slabGeo, concreteMat);
    slabMesh.position.y = 0.225;
    slabMesh.castShadow = true;
    slabMesh.receiveShadow = true;
    foundationGroup.add(slabMesh);

    // Outdoor cantilevered terrace steps
    const stepGeo = new THREE.BoxGeometry(18.0, 0.22, 2.8);
    const stepMesh = new THREE.Mesh(stepGeo, concreteMat);
    stepMesh.position.set(0, 0.11, 6.2);
    stepMesh.receiveShadow = true;
    foundationGroup.add(stepMesh);

    houseGroup.add(foundationGroup);

    // -----------------------------------------------------------------
    // Component C: Steel Columns & Structural Framing (Stage 2 & 3)
    // -----------------------------------------------------------------
    const structureGroup = new THREE.Group();

    // 8 architectural steel columns
    const colGeo = new THREE.BoxGeometry(0.24, 3.8, 0.24);
    const colPositions = [
      [-7.8, -4.8],
      [-2.6, -4.8],
      [2.6, -4.8],
      [7.8, -4.8],
      [-7.8, 4.8],
      [-2.6, 4.8],
      [2.6, 4.8],
      [7.8, 4.8],
    ];
    colPositions.forEach(([cx, cz]) => {
      const col = new THREE.Mesh(colGeo, steelMat);
      col.position.set(cx, 0.45 + 1.9, cz);
      col.castShadow = true;
      structureGroup.add(col);
    });

    // Horizontal perimeter steel header beams
    const beamGeoX = new THREE.BoxGeometry(16.6, 0.3, 0.28);
    const beamFront = new THREE.Mesh(beamGeoX, steelMat);
    beamFront.position.set(0, 4.15, 4.8);
    beamFront.castShadow = true;
    structureGroup.add(beamFront);

    const beamBack = new THREE.Mesh(beamGeoX, steelMat);
    beamBack.position.set(0, 4.15, -4.8);
    beamBack.castShadow = true;
    structureGroup.add(beamBack);

    // Transverse structural roof joists
    for (let j = -7; j <= 7; j += 1.8) {
      const joistGeo = new THREE.BoxGeometry(0.14, 0.22, 10.2);
      const joist = new THREE.Mesh(joistGeo, steelMat);
      joist.position.set(j, 4.12, 0);
      joist.castShadow = true;
      structureGroup.add(joist);
    }

    houseGroup.add(structureGroup);

    // -----------------------------------------------------------------
    // Component D: Timber Walls & Architectural Cladding (Stage 2 & 3)
    // -----------------------------------------------------------------
    const wallsGroup = new THREE.Group();

    // Private master wing solid timber slat wall (Left wing)
    const timberWallGeoL = new THREE.BoxGeometry(5.2, 3.6, 0.25);
    const timberWallL = new THREE.Mesh(timberWallGeoL, woodMat);
    timberWallL.position.set(-5.3, 2.25, 4.75);
    timberWallL.castShadow = true;
    timberWallL.receiveShadow = true;
    wallsGroup.add(timberWallL);

    // Rear solid timber wall
    const rearWallGeo = new THREE.BoxGeometry(10.5, 3.6, 0.25);
    const rearWall = new THREE.Mesh(rearWallGeo, woodMat);
    rearWall.position.set(-2.5, 2.25, -4.75);
    rearWall.castShadow = true;
    wallsGroup.add(rearWall);

    // Feature stone/concrete fireplace column
    const chimneyGeo = new THREE.BoxGeometry(1.6, 5.2, 1.8);
    const chimney = new THREE.Mesh(chimneyGeo, concreteMat);
    chimney.position.set(1.5, 2.6, 0.5);
    chimney.castShadow = true;
    wallsGroup.add(chimney);

    houseGroup.add(wallsGroup);

    // -----------------------------------------------------------------
    // Component E: Floor-to-Ceiling Glass Walls & Cantilevered Roof (Stage 3)
    // -----------------------------------------------------------------
    const enclosureGroup = new THREE.Group();

    // Large glass curtain wall for main living pavilion
    const glassGeoFront = new THREE.BoxGeometry(10.2, 3.6, 0.08);
    const glassFront = new THREE.Mesh(glassGeoFront, glassMat);
    glassFront.position.set(2.6, 2.25, 4.8);
    enclosureGroup.add(glassFront);

    const glassGeoSide = new THREE.BoxGeometry(0.08, 3.6, 9.4);
    const glassSide = new THREE.Mesh(glassGeoSide, glassMat);
    glassSide.position.set(7.8, 2.25, 0);
    enclosureGroup.add(glassSide);

    // Slender window mullions (frames)
    const mullionMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
    for (let m = -2; m <= 7.2; m += 2.5) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.6, 0.12), mullionMat);
      mullion.position.set(m, 2.25, 4.8);
      enclosureGroup.add(mullion);
    }

    // Modern floating overhanging cantilevered roof plane
    const roofGeo = new THREE.BoxGeometry(17.8, 0.28, 11.8);
    const roofMesh = new THREE.Mesh(roofGeo, steelMat);
    roofMesh.position.set(0, 4.38, 0.3);
    roofMesh.castShadow = true;
    enclosureGroup.add(roofMesh);

    // Warm timber soffit ceiling underside
    const soffitGeo = new THREE.BoxGeometry(17.6, 0.05, 11.6);
    const soffitMesh = new THREE.Mesh(soffitGeo, woodMat);
    soffitMesh.position.set(0, 4.22, 0.3);
    enclosureGroup.add(soffitMesh);

    houseGroup.add(enclosureGroup);

    // -----------------------------------------------------------------
    // Component F: Warm Interior Lighting & Travertine Floor (Stage 3)
    // -----------------------------------------------------------------
    const interiorGroup = new THREE.Group();

    // Warm interior timber floor
    const interiorFloorGeo = new THREE.BoxGeometry(15.8, 0.04, 9.8);
    const interiorFloor = new THREE.Mesh(interiorFloorGeo, woodMat);
    interiorFloor.position.y = 0.46;
    interiorFloor.receiveShadow = true;
    interiorGroup.add(interiorFloor);

    // Warm golden architectural interior light (casts warmth through the glass at night)
    const interiorLight1 = new THREE.PointLight(0xffb366, 3.2, 16);
    interiorLight1.position.set(3.5, 3.0, 1.5);
    interiorLight1.castShadow = true;
    interiorGroup.add(interiorLight1);

    const interiorLight2 = new THREE.PointLight(0xffb366, 2.0, 12);
    interiorLight2.position.set(-4.0, 2.8, 0);
    interiorGroup.add(interiorLight2);

    houseGroup.add(interiorGroup);

    // =================================================================
    // 8. Render & State Transition Logic
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
      // ARCHITECTURAL STAGE BLENDING (Single continuous construction world)
      // ---------------------------------------------------------------
      // Stage 1 (Source: 0.00 - 0.35): Blueprint footprint & stakes visible
      if (p < 0.35) {
        blueprintGroup.visible = true;
        blueprintMat.opacity = Math.max(0.2, 1.0 - p * 1.5);

        // Foundation emerging from ground
        const fProg = Math.max(0, (p - 0.1) / 0.25);
        foundationGroup.visible = fProg > 0;
        foundationGroup.position.y = (fProg - 1.0) * 0.45;

        structureGroup.visible = false;
        wallsGroup.visible = false;
        enclosureGroup.visible = false;
        interiorGroup.visible = false;
        interiorLight1.intensity = 0;
        interiorLight2.intensity = 0;
      }
      // Stage 2 (Build: 0.35 - 0.70): Columns, beams, timber framing rising
      else if (p < 0.70) {
        blueprintGroup.visible = p < 0.45;
        if (blueprintGroup.visible) {
          blueprintMat.opacity = Math.max(0, (0.45 - p) / 0.1);
        }

        foundationGroup.visible = true;
        foundationGroup.position.y = 0;

        // Structural columns and beams rise into place
        const sProg = Math.min(1, (p - 0.35) / 0.2);
        structureGroup.visible = true;
        structureGroup.scale.set(1, sProg, 1);
        structureGroup.position.y = (sProg - 1.0) * 1.5;

        // Timber walls framing
        const wProg = Math.max(0, Math.min(1, (p - 0.48) / 0.2));
        wallsGroup.visible = wProg > 0;
        wallsGroup.position.y = (wProg - 1.0) * 2.0;

        enclosureGroup.visible = false;
        interiorGroup.visible = false;
        interiorLight1.intensity = 0;
        interiorLight2.intensity = 0;
      }
      // Stage 3 (Production: 0.70 - 1.00): Complete modern house, glass, warm interior lights
      else {
        blueprintGroup.visible = false;
        foundationGroup.visible = true;
        foundationGroup.position.y = 0;

        structureGroup.visible = true;
        structureGroup.scale.set(1, 1, 1);
        structureGroup.position.y = 0;

        wallsGroup.visible = true;
        wallsGroup.position.y = 0;

        const eProg = Math.min(1, (p - 0.7) / 0.2);
        enclosureGroup.visible = true;
        enclosureGroup.position.y = (1.0 - eProg) * 0.5;

        interiorGroup.visible = true;
        const lightGlow = Math.min(1, (p - 0.78) / 0.22);
        interiorLight1.intensity = lightGlow * 3.4;
        interiorLight2.intensity = lightGlow * 2.2;
      }

      // Gentle cinematic camera drift framing the house
      const targetCamX = 16.0 - p * 3.5;
      const targetCamY = 8.5 - p * 1.5;
      const targetCamZ = 22.0 - p * 2.0;
      camera.position.set(targetCamX, targetCamY, targetCamZ);
      camera.lookAt(0, 2.2, 0);

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

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      observer.disconnect();

      groundGeo.dispose();
      groundMat.dispose();
      forestDiff.dispose();
      forestNor.dispose();
      forestRough.dispose();

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
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none bg-[#0e1011] flex items-center justify-center">
        <div className="text-center font-mono text-[12px] text-[#A8A49C]">
          [Modern Architectural Woodland Clearing — WebGL fallback]
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none bg-[#0e1011]"
      aria-hidden="true"
    />
  );
}

export default ArchitecturalConstructionCanvas;

