import {
  BoxGeometry, BufferGeometry, CircleGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh,
  MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3,
} from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { GameData } from "../../data/schema";
import { IslandKind, type Run, type WorldMap } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";
import { featureInstances, WALL_PIECE } from "./feature-view";
import type { PropPlacement } from "./prop-layout";
import { createProps, type PropModel } from "./props";
import { lookOf, PROP_SIZES, type WorldLook } from "./world-look";

/** One thing standing on the map: a model id, sim coordinates, a size and a turn (radians) around the vertical. */
export interface WorldInstance {
  model: string;
  x: number;
  y: number;
  /** Islands: radius / 100; wall pieces: piece length / WALL_PIECE; posts: 1. */
  scale: number;
  rotation: number;
}

export { WALL_PIECE } from "./feature-view";
/** The golden angle: turns of consecutive islands look unrelated without a random draw. */
const GOLDEN = 2.399963229728653;

/** One model per island: rocks and trees from the look's lists by the island's index, ruins (`ruin` = stone blocks). */
export function islandInstances(map: WorldMap, look: WorldLook): WorldInstance[] {
  const out: WorldInstance[] = [];
  const { rock, trees, ruin } = look.islands;
  for (let i = 0; i < map.islandCount; i++) {
    const kind = map.islandKind[i];
    const model = kind === IslandKind.Rock ? rock[i % rock.length]!
      : kind === IslandKind.Trees ? trees[i % trees.length]!
      : ruin === "blocks" ? "ruin" : ruin[i % ruin.length]!;
    out.push({ model, x: map.islandX[i]!, y: map.islandY[i]!, scale: map.islandR[i]! / 100, rotation: (i * GOLDEN) % (2 * Math.PI) });
  }
  return out;
}

/** What stands on the map (pure, deterministic): the islands and the chokepoint feature in the look's style. */
export function worldInstances(map: WorldMap, look: WorldLook = lookOf("silver-march")): WorldInstance[] {
  return [...islandInstances(map, look), ...featureInstances(map, look.feature, look.islands.trees)];
}

/** Sizes in sim units. */
const WALL_HEIGHT = 120;
const POST_SIZE = 130;
const POST_HEIGHT = 175;
const RUIN_BLOCKS = 3;
/** Paths lie this far over the ground (scene units), under every figure. */
const PATH_LIFT = 0.012;

/** The river's water lies this far over the ground (scene units), the bank under it a bit lower. */
const WATER_LIFT = 0.02;
const BANK_LIFT = 0.015;
/** The bank strip is this much wider than the river (sim units). */
const BANK_EXTRA = 30;
const BRIDGE_HEIGHT = 18;
const ROOTS_HEIGHT = 30;
/** Bushes per thicket zone, and their placement scale. */
const BUSHES_MIN = 6;
const BUSHES_MAX = 10;
const THICKET_LIFT = 0.008;

/**
 * The obstacles and paths of the run's map (spec 2026-11-21 difficulties 4.5, 4.8): islands from the world's prop
 * models (ruins as stone blocks or models), the chokepoint feature in the world's style (the wall with posts, the
 * river with its bridges, the ring of ancient trees on a bank of roots), the thicket's zones with bushes and the
 * paths as flat strips of trodden earth. Rebuilt whenever a new run starts (its islands come from the seed).
 * `models(id)` returns a loaded env model (client/render/world-models.ts loads a world's models before its run).
 */
export class WorldView implements RunView {
  readonly object = new Group();
  private readonly box = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  private readonly materials: MeshStandardMaterial[] = [];
  private built: Group | null = null;
  private lastRun: Run | null = null;
  /** Obstacles drawn now (islands + feature segments), for `__game.obstacles`. */
  obstacles = 0;

  constructor(private readonly data: GameData, private readonly models: (id: string) => GLTF) {}

  update(run: Run): void {
    if (run === this.lastRun) return;
    this.lastRun = run;
    this.rebuild(run.map, run.world);
  }

  dispose(): void {
    this.clear();
    this.object.removeFromParent();
    this.box.dispose();
  }

  private material(color: number, roughness: number, extra: Partial<{ transparent: boolean; opacity: number; depthWrite: boolean; metalness: number }> = {}): MeshStandardMaterial {
    const m = new MeshStandardMaterial({ color, roughness, ...extra });
    this.materials.push(m);
    return m;
  }

  private clear(): void {
    if (!this.built) return;
    this.built.traverse((node) => {
      if ((node as InstancedMesh).isInstancedMesh) (node as InstancedMesh).dispose();
    });
    // the path strips and flat discs are this view's own geometry; the props share the models' geometry
    this.built.traverse((node) => {
      if (node.userData.ownGeometry) (node as Mesh).geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
    this.materials.length = 0;
    this.object.remove(this.built);
    this.built = null;
  }

  private rebuild(map: WorldMap, world: number): void {
    this.clear();
    const def = this.data.worlds[world - 1]!;
    const look = lookOf(def.id);
    const group = new Group();
    const props = new Map<string, number>();
    const propModels: PropModel[] = [];
    const propIndex = (id: string): number => {
      let i = props.get(id);
      if (i === undefined) {
        const size = PROP_SIZES[id] ?? { size: 4.5, by: "height" as const };
        i = propModels.length;
        propModels.push({ gltf: this.models(id), ...size });
        props.set(id, i);
      }
      return i;
    };
    const placements: PropPlacement[] = [];
    const ruins: WorldInstance[] = [];
    for (const item of islandInstances(map, look)) {
      if (item.model === "ruin") {
        ruins.push(item);
        continue;
      }
      const flat = PROP_SIZES[item.model]?.by === "extent";
      // a rock covers its island; a tree cluster, stump or tent stays low enough not to hide the fight behind it
      const scale = flat ? item.scale * 1.45 : Math.min(1.1, Math.max(0.7, item.scale * 0.7));
      placements.push({ model: propIndex(item.model), x: item.x, y: item.y, scale, turn: item.rotation / (Math.PI / 2) });
    }
    const feature = featureInstances(map, look.feature, look.islands.trees);
    const thickness = map.segHalf * 2;
    const byModel = (id: string): WorldInstance[] => feature.filter((f) => f.model === id);
    if (look.feature === "wall") {
      group.add(this.boxes(byModel("wall"), this.material(look.stone.wall, 0.92), (w) => [w.scale * WALL_PIECE + 2, WALL_HEIGHT, thickness]));
      group.add(this.boxes(byModel("gate-post"), this.material(look.stone.top, 0.9), () => [POST_SIZE, POST_HEIGHT, POST_SIZE]));
    } else if (look.feature === "river") {
      const water = byModel("water");
      group.add(this.flatStrips(water, thickness + BANK_EXTRA, BANK_LIFT, this.material(look.ground.dirt, 1)));
      group.add(this.flatStrips(water, thickness, WATER_LIFT, this.material(look.water, 0.25, { metalness: 0.1 })));
      group.add(this.boxes(byModel("bridge"), this.material(look.stone.top, 0.9), (b) => [b.scale, BRIDGE_HEIGHT, thickness + BANK_EXTRA * 2]));
    } else {
      group.add(this.boxes(byModel("roots"), this.material(look.stone.ruin, 0.95), (r) => [r.scale * 100 + thickness * 0.5, ROOTS_HEIGHT, thickness]));
      for (const tree of feature) {
        if (tree.model === "roots") continue;
        placements.push({ model: propIndex(tree.model), x: tree.x, y: tree.y, scale: 1.05, turn: tree.rotation / (Math.PI / 2) });
      }
    }
    const blocks: WorldInstance[] = [];
    for (const ruin of ruins) {
      const r = ruin.scale * 100;
      for (let k = 0; k < RUIN_BLOCKS; k++) {
        const a = ruin.rotation + (k * 2 * Math.PI) / RUIN_BLOCKS;
        blocks.push({ model: "ruin", x: ruin.x + Math.cos(a) * r * 0.5, y: ruin.y + Math.sin(a) * r * 0.5, scale: r * (0.55 + 0.15 * k), rotation: a + Math.PI / 2 });
      }
    }
    group.add(this.boxes(blocks, this.material(look.stone.ruin, 0.95), (b) => [b.scale, 40 + b.scale * 0.35, b.scale * 0.45]));
    if (def.hazard.kind === "thicket" && look.thicket) {
      const ground = this.material(look.thicket.ground, 1, { transparent: true, opacity: 0.85, depthWrite: false });
      def.hazard.zones.forEach(([zx, zy, zr], z) => {
        const disc = new Mesh(new CircleGeometry(zr * SCENE_SCALE, 40).rotateX(-Math.PI / 2), ground);
        disc.position.set(zx * SCENE_SCALE, THICKET_LIFT, -zy * SCENE_SCALE);
        disc.userData.ownGeometry = true;
        disc.receiveShadow = true;
        disc.renderOrder = -1;
        group.add(disc);
        const bushes = BUSHES_MIN + (z % (BUSHES_MAX - BUSHES_MIN + 1));
        for (let k = 0; k < bushes; k++) {
          const a = k * GOLDEN;
          const d = zr * 0.8 * Math.sqrt((k + 0.5) / bushes);
          placements.push({
            model: propIndex(look.thicket!.bush), x: zx + Math.cos(a) * d, y: zy + Math.sin(a) * d,
            scale: 0.5 + 0.3 * (((k * 7) % 10) / 9), turn: k % 4,
          });
        }
      });
    }
    group.add(createProps(propModels, placements, look.propTint));
    const paths = this.pathGeometry(world);
    if (paths) {
      const mesh = new Mesh(paths, this.material(look.path, 1, { transparent: true, opacity: 0.7, depthWrite: false }));
      mesh.userData.ownGeometry = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = -1;
      group.add(mesh);
    }
    this.built = group;
    this.object.add(group);
    this.obstacles = map.islandCount + map.segCount;
  }

  /** Flat strips along each item (scale = length / 100), `width` sim units wide, `lift` scene units over the ground. */
  private flatStrips(items: WorldInstance[], width: number, lift: number, material: MeshStandardMaterial): Group {
    const group = new Group();
    for (const item of items) {
      const length = item.scale * 100 + width;
      const strip = new Mesh(new PlaneGeometry(length * SCENE_SCALE, width * SCENE_SCALE).rotateX(-Math.PI / 2), material);
      strip.rotation.y = item.rotation;
      strip.position.set(item.x * SCENE_SCALE, lift, -item.y * SCENE_SCALE);
      strip.userData.ownGeometry = true;
      strip.receiveShadow = true;
      strip.renderOrder = -1;
      group.add(strip);
    }
    return group;
  }

  /** One instanced box per item: size (sim units: length along the turn, height, depth) from `size`. */
  private boxes(items: WorldInstance[], material: MeshStandardMaterial, size: (w: WorldInstance) => [number, number, number]): Group {
    const group = new Group();
    if (items.length === 0) return group;
    const mesh = new InstancedMesh(this.box, material, items.length);
    const m = new Matrix4();
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    items.forEach((item, i) => {
      const [l, h, d] = size(item);
      // sim (x, y) -> scene (x, -y): a turn of a in the sim plane is a turn of a around the scene's up axis
      q.setFromAxisAngle(up, item.rotation);
      m.compose(new Vector3(item.x * SCENE_SCALE, 0, -item.y * SCENE_SCALE), q, new Vector3(l * SCENE_SCALE, h * SCENE_SCALE, d * SCENE_SCALE));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    return group;
  }

  /** The world's paths as one geometry: a strip per segment and a disc at every joint, flat on the ground. */
  private pathGeometry(world: number): BufferGeometry | null {
    const { lines, width } = this.data.worlds[world - 1]!.map.paths;
    const parts: BufferGeometry[] = [];
    for (const line of lines) {
      for (let k = 0; k + 1 < line.length; k++) {
        const [ax, ay] = line[k]!;
        const [bx, by] = line[k + 1]!;
        const length = Math.hypot(bx - ax, by - ay);
        const strip = new PlaneGeometry(length * SCENE_SCALE, width * SCENE_SCALE).rotateX(-Math.PI / 2);
        strip.rotateY(Math.atan2(by - ay, bx - ax));
        strip.translate(((ax + bx) / 2) * SCENE_SCALE, PATH_LIFT, (-(ay + by) / 2) * SCENE_SCALE);
        parts.push(strip);
      }
      for (const [x, y] of line) {
        parts.push(new CircleGeometry((width / 2) * SCENE_SCALE, 20).rotateX(-Math.PI / 2).translate(x * SCENE_SCALE, PATH_LIFT, -y * SCENE_SCALE));
      }
    }
    if (parts.length === 0) return null;
    // the strips have uvs and normals; the discs too: merge by position only to keep the attribute sets equal
    const merged = mergeGeometries(parts.map((p) => {
      const g = new BufferGeometry();
      g.setAttribute("position", p.getAttribute("position"));
      g.setAttribute("normal", p.getAttribute("normal"));
      g.setIndex(p.getIndex());
      return g;
    }));
    for (const p of parts) p.dispose();
    if (merged) merged.setAttribute("uv", new Float32BufferAttribute(new Float32Array((merged.getAttribute("position").count) * 2), 2));
    return merged;
  }
}
