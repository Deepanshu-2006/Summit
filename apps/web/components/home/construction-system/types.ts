import * as THREE from "three";

export type ConstructionCategory =
  | "foundation"
  | "structure"
  | "roof"
  | "walls"
  | "openings"
  | "finishes"
  | "lighting";

export type RevealMethod =
  | "rise"                 // Rises vertically from foundation / ground
  | "assemble"             // Lowers / connects into structural position
  | "slide"                // Slides horizontally into framing opening
  | "expand"               // Scales along structural axis
  | "fade"                 // Opacity fade / material transition
  | "glow";                // Light emission and intensity increase

export interface TransformDefinition {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  opacity?: number;
}

export interface ConstructionComponentDef {
  id: string;
  name: string;
  category: ConstructionCategory;
  constructionOrder: number;
  startProgress: number; // Normalized timeline interval start [0 .. 1]
  endProgress: number;   // Normalized timeline interval end [0 .. 1]
  dependencies: string[];
  revealMethod: RevealMethod;
  initialTransform: {
    positionOffset: [number, number, number];
    scale?: [number, number, number];
    opacity?: number;
  };
  finalTransform: TransformDefinition;
}

export type ConstructionStagePreset =
  | "foundation"           // 1. Completed foundation
  | "structural-frame"     // 2. Structural frame
  | "roof-framing"         // 3. Roof framing
  | "enclosed-house"       // 4. Enclosed house
  | "finished-exterior"    // 5. Finished exterior
  | "completed-bungalow";  // 6. Completed bungalow

export interface RegisteredComponent {
  def: ConstructionComponentDef;
  object: THREE.Object3D;
  initialPos: THREE.Vector3;
  initialScale: THREE.Vector3;
  finalPos: THREE.Vector3;
  finalScale: THREE.Vector3;
  materials: THREE.Material[];
}
