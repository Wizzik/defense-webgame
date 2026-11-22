import type { Group, Mesh, Scene } from "three/webgpu";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { GameData } from "../../data/schema";
import type { Run } from "../../sim";
import type { RunView } from "../game/session";
import { createGround } from "./ground";
import type { Lighting } from "./lighting";
import { layoutProps } from "./prop-layout";
import { createProps } from "./props";
import { lookOf, PROP_SIZES } from "./world-look";

/** The forest looks the same in every run of a world. */
const PROP_SEED = 1;

/**
 * The world's ground, forest border and light (spec 2026-11-21 difficulties 4.8): built for the world of the run on
 * screen and rebuilt (the old ground and forest disposed) when a run of another world starts.
 */
export class ArenaView implements RunView {
  private world = 0;
  private ground: Mesh | null = null;
  private forest: Group | null = null;

  constructor(
    private readonly data: GameData,
    private readonly scene: Scene,
    private readonly lighting: Lighting,
    private readonly models: (id: string) => GLTF,
  ) {}

  update(run: Run): void {
    if (run.world === this.world) return;
    this.world = run.world;
    this.clear();
    const look = lookOf(this.data.worlds[run.world - 1]!.id);
    this.lighting.applyLook(this.scene, look);
    this.ground = createGround(this.data.rules, look);
    const forest = look.forest.map((id) => ({ gltf: this.models(id), ...PROP_SIZES[id]! }));
    this.forest = createProps(forest, layoutProps(this.data.rules, forest.length, PROP_SEED), look.propTint);
    this.scene.add(this.ground, this.forest);
  }

  dispose(): void {
    this.clear();
  }

  private clear(): void {
    if (this.ground) {
      this.ground.geometry.dispose();
      (this.ground.material as { dispose(): void }).dispose();
      this.ground.removeFromParent();
      this.ground = null;
    }
    if (this.forest) {
      this.forest.traverse((node) => {
        if ((node as { isInstancedMesh?: boolean }).isInstancedMesh) (node as unknown as { dispose(): void }).dispose();
      });
      this.forest.removeFromParent();
      this.forest = null;
    }
  }
}
