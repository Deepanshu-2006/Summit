/**
 * Jetway Construction Timeline & Milestones
 * Single, deterministic, reversible construction timeline for the modern bungalow.
 */

export interface ConstructionMilestone {
  step: number;
  name: string;
  stage: "SOURCE" | "BUILD" | "PRODUCTION";
  start: number; // Normalized timeline start [0 .. 1]
  end: number;   // Normalized timeline end [0 .. 1]
  componentIds: string[];
}

export const CONSTRUCTION_MILESTONES: ConstructionMilestone[] = [
  // -------------------------------------------------------------------
  // STAGE A — SOURCE: Preparing the site (0 - 20%)
  // -------------------------------------------------------------------
  {
    step: 1,
    name: "Empty Woodland Site",
    stage: "SOURCE",
    start: 0.00,
    end: 0.04,
    componentIds: [],
  },
  {
    step: 2,
    name: "Architectural Layout Blueprint",
    stage: "SOURCE",
    start: 0.00,
    end: 0.12,
    componentIds: [],
  },
  {
    step: 3,
    name: "Foundation Footings & Plinths",
    stage: "SOURCE",
    start: 0.04,
    end: 0.20,
    componentIds: [
      "foundation-living-slab",
      "foundation-bed-slab",
      "foundation-porch-slab",
      "foundation-terrace",
      "foundation-steps",
    ],
  },

  // -------------------------------------------------------------------
  // STAGE B — BUILD: Assembling the structure (20 - 60%)
  // -------------------------------------------------------------------
  {
    step: 4,
    name: "Structural Anchors & Columns",
    stage: "BUILD",
    start: 0.20,
    end: 0.32,
    componentIds: [
      "structural-anchors",
      "columns-living",
      "columns-bedroom",
    ],
  },
  {
    step: 5,
    name: "Primary Header Beams",
    stage: "BUILD",
    start: 0.30,
    end: 0.40,
    componentIds: [
      "primary-beams-living",
      "primary-beams-bedroom",
    ],
  },
  {
    step: 6,
    name: "Secondary Structural Roof Joists",
    stage: "BUILD",
    start: 0.38,
    end: 0.46,
    componentIds: [
      "secondary-roof-joists",
    ],
  },
  {
    step: 7,
    name: "Open Perimeter Roof Framing",
    stage: "BUILD",
    start: 0.44,
    end: 0.52,
    componentIds: [
      "roof-framing",
    ],
  },
  {
    step: 8,
    name: "Cantilevered Zinc Roof Surfaces",
    stage: "BUILD",
    start: 0.50,
    end: 0.58,
    componentIds: [
      "roof-surfaces-living",
      "roof-surfaces-bedroom",
    ],
  },
  {
    step: 9,
    name: "Exterior Cedar Walls & Fireplace Monolith",
    stage: "BUILD",
    start: 0.48,
    end: 0.60,
    componentIds: [
      "walls-bedroom",
      "walls-living-rear",
      "finishes-fireplace-monolith",
    ],
  },
  {
    step: 10,
    name: "Structurally Complete Bungalow",
    stage: "BUILD",
    start: 0.60,
    end: 0.62,
    componentIds: [],
  },

  // -------------------------------------------------------------------
  // STAGE C — PRODUCTION: Finishing the house (60 - 100%)
  // -------------------------------------------------------------------
  {
    step: 11,
    name: "Exposed Cedar Soffits & Exterior Finishes",
    stage: "PRODUCTION",
    start: 0.62,
    end: 0.72,
    componentIds: [
      "finishes-soffits",
    ],
  },
  {
    step: 12,
    name: "Window Frames & Glass Curtain Walls",
    stage: "PRODUCTION",
    start: 0.70,
    end: 0.82,
    componentIds: [
      "window-frames",
      "glass-panels",
    ],
  },
  {
    step: 13,
    name: "Main Entrance Solid Timber Pivot Door",
    stage: "PRODUCTION",
    start: 0.78,
    end: 0.86,
    componentIds: [
      "doors-entrance",
    ],
  },
  {
    step: 14,
    name: "Architectural Trim & Interior Travertine",
    stage: "PRODUCTION",
    start: 0.82,
    end: 0.90,
    componentIds: [
      "architectural-trim",
      "interior-flooring-hearth",
    ],
  },
  {
    step: 15,
    name: "Golden Twilight Lighting Illumination",
    stage: "PRODUCTION",
    start: 0.86,
    end: 1.00,
    componentIds: [
      "interior-lighting",
      "exterior-lighting",
    ],
  },
  {
    step: 16,
    name: "Completed Modern Bungalow",
    stage: "PRODUCTION",
    start: 1.00,
    end: 1.00,
    componentIds: [],
  },
];

export class ConstructionTimelineManager {
  private progress: number = 0;
  private isPlaying: boolean = false;
  private playSpeed: number = 0.08; // 12.5s for full cycle
  private animationId: number | null = null;
  private lastTime: number = 0;
  private onUpdateCallback: ((p: number) => void) | null = null;

  constructor(initialProgress = 0) {
    this.progress = Math.max(0, Math.min(1, initialProgress));
  }

  public setProgress(p: number): void {
    this.progress = Math.max(0, Math.min(1, p));
    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.progress);
    }
  }

  public getProgress(): number {
    return this.progress;
  }

  public onUpdate(callback: (p: number) => void): void {
    this.onUpdateCallback = callback;
  }

  public play(durationSeconds = 12): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.playSpeed = 1 / Math.max(1, durationSeconds);
    this.lastTime = performance.now();

    const tick = (now: number) => {
      if (!this.isPlaying) return;
      const delta = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;

      let nextP = this.progress + delta * this.playSpeed;
      if (nextP >= 1.0) {
        nextP = 1.0;
        this.pause();
      }
      this.setProgress(nextP);

      if (this.isPlaying) {
        this.animationId = requestAnimationFrame(tick);
      }
    };

    this.animationId = requestAnimationFrame(tick);
  }

  public pause(): void {
    this.isPlaying = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public togglePlay(durationSeconds = 12): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      if (this.progress >= 0.99) {
        this.setProgress(0);
      }
      this.play(durationSeconds);
    }
  }

  public jumpToStep(stepNumber: number): void {
    const milestone = CONSTRUCTION_MILESTONES.find((m) => m.step === stepNumber);
    if (milestone) {
      this.pause();
      this.setProgress(milestone.end);
    }
  }

  public stepForward(delta = 0.05): void {
    this.pause();
    this.setProgress(this.progress + delta);
  }

  public stepBackward(delta = 0.05): void {
    this.pause();
    this.setProgress(this.progress - delta);
  }

  public isTimelinePlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentStep(): number {
    const p = this.progress;
    for (let i = CONSTRUCTION_MILESTONES.length - 1; i >= 0; i--) {
      if (p >= CONSTRUCTION_MILESTONES[i].start) {
        return CONSTRUCTION_MILESTONES[i].step;
      }
    }
    return 1;
  }

  public nextStep(): void {
    const cur = this.getCurrentStep();
    if (cur < CONSTRUCTION_MILESTONES.length) {
      this.jumpToStep(cur + 1);
    }
  }

  public previousStep(): void {
    const cur = this.getCurrentStep();
    if (cur > 1) {
      this.jumpToStep(cur - 1);
    }
  }

  public getMilestones(): ConstructionMilestone[] {
    return CONSTRUCTION_MILESTONES;
  }
}
