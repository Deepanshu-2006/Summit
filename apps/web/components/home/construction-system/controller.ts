import * as THREE from "three";
import {
  ConstructionStagePreset,
  RegisteredComponent,
} from "./types";
import { BUNGALOW_CONSTRUCTION_MANIFEST } from "./manifest";

export class ConstructionController {
  private components: Map<string, RegisteredComponent> = new Map();
  private lights: Map<string, THREE.PointLight[]> = new Map();

  /**
   * Register a Three.js Object3D with its corresponding manifest component definition.
   */
  public registerComponent(id: string, object: THREE.Object3D): void {
    const def = BUNGALOW_CONSTRUCTION_MANIFEST.find((c) => c.id === id);
    if (!def) {
      console.warn(`[ConstructionController] Component ID "${id}" not found in manifest.`);
      return;
    }

    // Save final transform
    const finalPos = object.position.clone();
    const finalScale = object.scale.clone();

    // Collect materials for opacity/reveal handling
    const materials: THREE.Material[] = [];
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          materials.push(...mesh.material);
        } else if (mesh.material) {
          materials.push(mesh.material);
        }
      }
    });

    // Compute initial position and scale from definition
    const initialPos = finalPos.clone().add(
      new THREE.Vector3(
        def.initialTransform.positionOffset[0],
        def.initialTransform.positionOffset[1],
        def.initialTransform.positionOffset[2]
      )
    );

    const initialScale = def.initialTransform.scale
      ? new THREE.Vector3(
          def.initialTransform.scale[0],
          def.initialTransform.scale[1],
          def.initialTransform.scale[2]
        )
      : finalScale.clone();

    this.components.set(id, {
      def,
      object,
      initialPos,
      initialScale,
      finalPos,
      finalScale,
      materials,
    });
  }

  /**
   * Register lights for lighting group control.
   */
  public registerLights(groupKey: "interior-lighting" | "exterior-lighting", lights: THREE.PointLight[]): void {
    this.lights.set(groupKey, lights);
  }

  /**
   * Set construction progress (0.0 to 1.0) for an individual component.
   * Deterministic and 100% reversible.
   */
  public setComponentProgress(id: string, progress: number): void {
    const comp = this.components.get(id);
    if (!comp) return;

    const clamped = Math.max(0, Math.min(1, progress));

    if (clamped <= 0) {
      comp.object.visible = false;
      comp.object.position.copy(comp.initialPos);
      comp.object.scale.copy(comp.initialScale);
      return;
    }

    comp.object.visible = true;

    // Component-specific physically plausible animation
    if (comp.def.revealMethod === "expand") {
      // Structural columns grow vertically from foundation anchors
      const sY = 0.02 + clamped * 0.98;
      comp.object.scale.set(comp.finalScale.x, sY, comp.finalScale.z);
      comp.object.position.lerpVectors(comp.initialPos, comp.finalPos, clamped);
    } else {
      comp.object.position.lerpVectors(comp.initialPos, comp.finalPos, clamped);
      comp.object.scale.lerpVectors(comp.initialScale, comp.finalScale, clamped);
    }

    // Material transitions / opacity reveals
    if (comp.def.revealMethod === "fade") {
      const targetOpacity = comp.def.finalTransform.opacity ?? 1.0;
      comp.materials.forEach((m) => {
        m.opacity = clamped * targetOpacity;
      });
    }
  }

  /**
   * Set overall building assembly progress [0.0 .. 1.0].
   * Derives all component states directly from their manifest intervals.
   */
  public setAssemblyProgress(progress: number): void {
    const p = Math.max(0, Math.min(1, progress));

    BUNGALOW_CONSTRUCTION_MANIFEST.forEach((def) => {
      let compP = 0;
      if (p <= def.startProgress) {
        compP = 0;
      } else if (p >= def.endProgress) {
        compP = 1.0;
      } else {
        // Smoothstep easing for natural, non-linear architectural movement
        const linearT = (p - def.startProgress) / (def.endProgress - def.startProgress);
        compP = linearT * linearT * (3 - 2 * linearT);
      }

      this.setComponentProgress(def.id, compP);
    });

    // Control lighting groups in final stage (p > 0.86)
    const lightGlow = Math.max(0, Math.min(1, (p - 0.86) / 0.14));
    this.setLightingIntensity(lightGlow);
  }

  /**
   * Set lighting intensities based on normalized glow factor [0..1].
   */
  public setLightingIntensity(glow: number): void {
    const interior = this.lights.get("interior-lighting") || [];
    interior.forEach((light) => {
      const maxInt = (light.userData?.maxIntensity as number) ?? 3.5;
      light.intensity = glow * maxInt;
    });

    const exterior = this.lights.get("exterior-lighting") || [];
    exterior.forEach((light) => {
      const maxInt = (light.userData?.maxIntensity as number) ?? 2.0;
      light.intensity = glow * maxInt;
    });
  }

  /**
   * Get progress value for a preset stage.
   */
  public getPresetProgress(stage: ConstructionStagePreset): number {
    switch (stage) {
      case "foundation":
        return 0.20; // Step 3
      case "structural-frame":
        return 0.46; // Step 6
      case "roof-framing":
        return 0.52; // Step 7
      case "enclosed-house":
        return 0.82; // Step 12
      case "finished-exterior":
        return 0.88; // Step 14
      case "completed-bungalow":
      default:
        return 1.0;  // Step 16
    }
  }

  /**
   * Development Preview Presets.
   */
  public setPresetStage(stage: ConstructionStagePreset): void {
    this.setAssemblyProgress(this.getPresetProgress(stage));
  }

  /**
   * Reset all components to initial unconstructed state.
   */
  public resetToInitial(): void {
    this.setAssemblyProgress(0);
  }

  /**
   * Complete all components to final architectural state.
   */
  public completeAll(): void {
    this.setAssemblyProgress(1.0);
  }

  /**
   * Retrieve registered component definition and object.
   */
  public getComponent(id: string): RegisteredComponent | undefined {
    return this.components.get(id);
  }

  /**
   * Get total number of registered components.
   */
  public get registeredCount(): number {
    return this.components.size;
  }

  public getRegisteredCount(): number {
    return this.components.size;
  }
}
