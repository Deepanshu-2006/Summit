import { ConstructionComponentDef } from "./types";

/**
 * The Jetway Modern Bungalow Construction Manifest.
 * Defines every architectural component in the scene, its exact start/end timeline interval,
 * assembly dependencies, initial offset, and final coordinates.
 */
export const BUNGALOW_CONSTRUCTION_MANIFEST: ConstructionComponentDef[] = [
  // ===================================================================
  // STAGE A — SOURCE: PREPARING THE SITE (0.00 - 0.20)
  // Step 3: Foundation construction (descending from above onto surveyed ground)
  // ===================================================================
  {
    id: "foundation-living-slab",
    name: "Living Pavilion Foundation Plinth",
    category: "foundation",
    constructionOrder: 1,
    startProgress: 0.04,
    endProgress: 0.13,
    dependencies: [],
    revealMethod: "assemble",
    initialTransform: {
      positionOffset: [0, 9.5, 0],
    },
    finalTransform: {
      position: [5.7, 0.21, 0.2],
    },
  },
  {
    id: "foundation-bed-slab",
    name: "Bedroom Wing Foundation Plinth",
    category: "foundation",
    constructionOrder: 2,
    startProgress: 0.06,
    endProgress: 0.15,
    dependencies: [],
    revealMethod: "assemble",
    initialTransform: {
      positionOffset: [0, 9.5, 0],
    },
    finalTransform: {
      position: [-5.8, 0.21, -0.7],
    },
  },
  {
    id: "foundation-porch-slab",
    name: "Entrance Porch Foundation Plinth",
    category: "foundation",
    constructionOrder: 3,
    startProgress: 0.09,
    endProgress: 0.17,
    dependencies: ["foundation-living-slab", "foundation-bed-slab"],
    revealMethod: "assemble",
    initialTransform: {
      positionOffset: [0, 8.5, 0],
    },
    finalTransform: {
      position: [-0.7, 0.18, 2.3],
    },
  },
  {
    id: "foundation-terrace",
    name: "Cantilevered Concrete Front Terrace",
    category: "foundation",
    constructionOrder: 4,
    startProgress: 0.12,
    endProgress: 0.18,
    dependencies: ["foundation-living-slab"],
    revealMethod: "assemble",
    initialTransform: {
      positionOffset: [0, 7.5, 0],
    },
    finalTransform: {
      position: [5.7, 0.11, 6.6],
    },
  },
  {
    id: "foundation-steps",
    name: "Floating Concrete Approach Steps",
    category: "foundation",
    constructionOrder: 5,
    startProgress: 0.14,
    endProgress: 0.20,
    dependencies: ["foundation-terrace"],
    revealMethod: "assemble",
    initialTransform: {
      positionOffset: [0, 6.5, 0],
    },
    finalTransform: {
      position: [5.7, 0.055, 8.3],
    },
  },

  // ===================================================================
  // STAGE B — BUILD: ASSEMBLING THE STRUCTURE (0.20 - 0.60)
  // Step 4: Structural anchors and columns
  // ===================================================================
  {
    id: "structural-anchors",
    name: "Structural Steel Anchor Baseplates",
    category: "structure",
    constructionOrder: 6,
    startProgress: 0.20,
    endProgress: 0.26,
    dependencies: ["foundation-living-slab", "foundation-bed-slab"],
    revealMethod: "assemble",
    initialTransform: {
      positionOffset: [0, -0.05, 0],
      opacity: 0,
    },
    finalTransform: {
      position: [0, 0, 0],
    },
  },
  {
    id: "columns-living",
    name: "Living Pavilion Structural Columns",
    category: "structure",
    constructionOrder: 7,
    startProgress: 0.24,
    endProgress: 0.32,
    dependencies: ["structural-anchors", "foundation-living-slab"],
    revealMethod: "expand",
    initialTransform: {
      positionOffset: [0, -2.0, 0],
      scale: [1, 0.02, 1],
    },
    finalTransform: {
      position: [0, 0, 0],
      scale: [1, 1, 1],
    },
  },
  {
    id: "columns-bedroom",
    name: "Bedroom Wing Structural Columns",
    category: "structure",
    constructionOrder: 8,
    startProgress: 0.27,
    endProgress: 0.34,
    dependencies: ["structural-anchors", "foundation-bed-slab"],
    revealMethod: "expand",
    initialTransform: {
      positionOffset: [0, -1.6, 0],
      scale: [1, 0.02, 1],
    },
    finalTransform: {
      position: [0, 0, 0],
      scale: [1, 1, 1],
    },
  },

  // ===================================================================
  // Step 5: Primary header beams connect
  // ===================================================================
  {
    id: "primary-beams-living",
    name: "Living Pavilion Primary Header Beams",
    category: "structure",
    constructionOrder: 9,
    startProgress: 0.30,
    endProgress: 0.38,
    dependencies: ["columns-living"],
    revealMethod: "assemble",
    initialTransform: {
      positionOffset: [0, 1.8, 0],
    },
    finalTransform: {
      position: [0, 0, 0],
    },
  },
  {
    id: "primary-beams-bedroom",
    name: "Bedroom Wing Primary Header Beams",
    category: "structure",
    constructionOrder: 10,
    startProgress: 0.34,
    endProgress: 0.42,
    dependencies: ["columns-bedroom"],
    revealMethod: "assemble",
    initialTransform: {
      positionOffset: [0, 1.6, 0],
    },
    finalTransform: {
      position: [0, 0, 0],
    },
  },

  // ===================================================================
  // Step 6: Secondary structural members & roof joists
  // ===================================================================
  {
    id: "secondary-roof-joists",
    name: "Transverse Structural Roof Joists",
    category: "structure",
    constructionOrder: 11,
    startProgress: 0.38,
    endProgress: 0.46,
    dependencies: ["primary-beams-living", "primary-beams-bedroom"],
    revealMethod: "assemble",
    initialTransform: {
      positionOffset: [0, 1.4, 0],
    },
    finalTransform: {
      position: [0, 0, 0],
    },
  },

  // ===================================================================
  // Step 7: Open perimeter roof framing
  // ===================================================================
  {
    id: "roof-framing",
    name: "Open Perimeter Roof Channel Framing",
    category: "roof",
    constructionOrder: 12,
    startProgress: 0.44,
    endProgress: 0.52,
    dependencies: ["secondary-roof-joists"],
    revealMethod: "assemble",
    initialTransform: {
      positionOffset: [0, 1.8, 0],
    },
    finalTransform: {
      position: [0, 0, 0],
    },
  },

  // ===================================================================
  // Step 8 & 9: Exterior walls & Fireplace monolith & Roof surfaces
  // ===================================================================
  {
    id: "walls-bedroom",
    name: "Bedroom Wing Exterior Cedar Walls",
    category: "walls",
    constructionOrder: 13,
    startProgress: 0.48,
    endProgress: 0.58,
    dependencies: ["columns-bedroom", "primary-beams-bedroom"],
    revealMethod: "rise",
    initialTransform: {
      positionOffset: [0, -1.8, 0],
    },
    finalTransform: {
      position: [0, 0, 0],
    },
  },
  {
    id: "walls-living-rear",
    name: "Living Pavilion Solid Rear Cedar Wall",
    category: "walls",
    constructionOrder: 14,
    startProgress: 0.50,
    endProgress: 0.60,
    dependencies: ["columns-living", "primary-beams-living"],
    revealMethod: "rise",
    initialTransform: {
      positionOffset: [0, -1.8, 0],
    },
    finalTransform: {
      position: [0, 0, 0],
    },
  },
  {
    id: "finishes-fireplace-monolith",
    name: "Basalt Concrete Fireplace Monolith",
    category: "finishes",
    constructionOrder: 15,
    startProgress: 0.48,
    endProgress: 0.60,
    dependencies: ["foundation-living-slab"],
    revealMethod: "rise",
    initialTransform: {
      positionOffset: [0, -3.2, 0],
    },
    finalTransform: {
      position: [3.0, 2.9, 0.2],
    },
  },
  {
    id: "roof-surfaces-living",
    name: "Living Pavilion Zinc Roof Plane",
    category: "roof",
    constructionOrder: 16,
    startProgress: 0.52,
    endProgress: 0.58,
    dependencies: ["roof-framing"],
    revealMethod: "assemble",
    initialTransform: {
      positionOffset: [0, 2.5, 0],
    },
    finalTransform: {
      position: [5.7, 4.82, 0.3],
    },
  },
  {
    id: "roof-surfaces-bedroom",
    name: "Bedroom Wing Zinc Roof Plane",
    category: "roof",
    constructionOrder: 17,
    startProgress: 0.54,
    endProgress: 0.60,
    dependencies: ["roof-framing"],
    revealMethod: "assemble",
    initialTransform: {
      positionOffset: [0, 2.3, 0],
    },
    finalTransform: {
      position: [-5.8, 3.96, -0.7],
    },
  },

  // ===================================================================
  // STAGE C — PRODUCTION: FINISHING THE HOUSE (0.60 - 1.00)
  // Step 11: Exterior finishes & cedar soffits
  // ===================================================================
  {
    id: "finishes-soffits",
    name: "Exposed Cedar Wood Underside Soffits",
    category: "finishes",
    constructionOrder: 18,
    startProgress: 0.62,
    endProgress: 0.72,
    dependencies: ["roof-surfaces-living", "roof-surfaces-bedroom"],
    revealMethod: "assemble",
    initialTransform: {
      positionOffset: [0, -0.3, 0],
      opacity: 0,
    },
    finalTransform: {
      position: [0, 0, 0],
      opacity: 1,
    },
  },

  // ===================================================================
  // Step 12: Window frames & glass installation
  // ===================================================================
  {
    id: "window-frames",
    name: "Dark Metal Mullions & Window Frames",
    category: "openings",
    constructionOrder: 19,
    startProgress: 0.70,
    endProgress: 0.78,
    dependencies: ["columns-living", "walls-bedroom"],
    revealMethod: "assemble",
    initialTransform: {
      positionOffset: [0, 0.7, 0],
    },
    finalTransform: {
      position: [0, 0, 0],
    },
  },
  {
    id: "glass-panels",
    name: "Panoramic Glass Curtain Walls & Ribbon Glazing",
    category: "openings",
    constructionOrder: 20,
    startProgress: 0.74,
    endProgress: 0.82,
    dependencies: ["window-frames"],
    revealMethod: "fade",
    initialTransform: {
      positionOffset: [0, 0.4, 0],
      opacity: 0,
    },
    finalTransform: {
      position: [0, 0, 0],
      opacity: 0.36,
    },
  },

  // ===================================================================
  // Step 13: Door installation
  // ===================================================================
  {
    id: "doors-entrance",
    name: "Covered Entrance Solid Timber Pivot Door",
    category: "openings",
    constructionOrder: 21,
    startProgress: 0.78,
    endProgress: 0.86,
    dependencies: ["foundation-porch-slab"],
    revealMethod: "assemble",
    initialTransform: {
      positionOffset: [0, 0.6, 0],
    },
    finalTransform: {
      position: [0, 0, 0],
    },
  },

  // ===================================================================
  // Step 14: Final roof & architectural trim & interior travertine
  // ===================================================================
  {
    id: "architectural-trim",
    name: "Knife-Edge Fascia Trim & Chimney Cap",
    category: "finishes",
    constructionOrder: 22,
    startProgress: 0.82,
    endProgress: 0.88,
    dependencies: ["roof-surfaces-living", "finishes-fireplace-monolith"],
    revealMethod: "assemble",
    initialTransform: {
      positionOffset: [0, 1.8, 0],
    },
    finalTransform: {
      position: [0, 0, 0],
    },
  },
  {
    id: "interior-flooring-hearth",
    name: "Interior Travertine Flooring & Hearth Bench",
    category: "finishes",
    constructionOrder: 23,
    startProgress: 0.82,
    endProgress: 0.90,
    dependencies: ["foundation-living-slab", "glass-panels"],
    revealMethod: "fade",
    initialTransform: {
      positionOffset: [0, -0.05, 0],
      opacity: 0,
    },
    finalTransform: {
      position: [0, 0, 0],
      opacity: 1,
    },
  },

  // ===================================================================
  // Step 15 & 16: Interior & exterior lighting illumination
  // ===================================================================
  {
    id: "interior-lighting",
    name: "Architectural Interior Golden Lighting",
    category: "lighting",
    constructionOrder: 24,
    startProgress: 0.86,
    endProgress: 1.00,
    dependencies: ["interior-flooring-hearth"],
    revealMethod: "glow",
    initialTransform: {
      positionOffset: [0, 0, 0],
    },
    finalTransform: {
      position: [0, 0, 0],
    },
  },
  {
    id: "exterior-lighting",
    name: "Porch Entry Sconce & Illuminated Terrace Steps",
    category: "lighting",
    constructionOrder: 25,
    startProgress: 0.86,
    endProgress: 1.00,
    dependencies: ["doors-entrance", "foundation-steps"],
    revealMethod: "glow",
    initialTransform: {
      positionOffset: [0, 0, 0],
    },
    finalTransform: {
      position: [0, 0, 0],
    },
  },
];
