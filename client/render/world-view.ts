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
import { PATH_COLOR, RUIN_STONE, WALL_STONE, WALL_TOP } from "./palette";
import type { PropPlacement } from "./prop-layout";
import { createProps, PROP_MODELS } from "./props";

/** One thing standing on the map: a model id, sim coordinates, a size and a turn (radians) around the vertical. */
export interface WorldInstance {
  model: string;
  x: number;
  y: number;
  /** Islands: radius / 100; wall pieces: piece length / WALL_PIECE; posts: 1. */
  scale: number;
  rotation: number;
}

/** The wall is drawn in pieces of at most this many sim units. */
export const WALL_PIECE = 100;
const ROCKS = ["rock-a", "rock-b", "rock-c"] as const;
const TREES = ["tree-a", "tree-b", "trees-a", "trees-b", "trees-c"] as const;
/** The golden angle: turns of consecutive islands look unrelated without a random draw. */
const GOLDEN = 2.399963229728653;

/**
 * What stands on the map (pure, deterministic): one model per island (rocks and trees by its index, ruins), the
 * wall in pieces along its segments and a post at every segment end that no other segment shares (the gates' sides
 * and the wall's ends).
 */
export function worldInstances(map: WorldMap): WorldInstance[] {
  const out: WorldInstance[] = [];
  for (let i = 0; i < map.islandCount; i++) {
    const kind = map.islandKind[i];
    const model = kind === IslandKind.Rock ? ROCKS[i % ROCKS.length]! : kind === IslandKind.Trees ? TREES[i % TREES.length]! : "ruin";
    out.push({ model, x: map.islandX[i]!, y: map.islandY[i]!, scale: map.islandR[i]! / 100, rotation: (i * GOLDEN) % (2 * Math.PI) });
  }
  for (let s = 0; s < map.segCount; s++) {
    const x1 = map.segX1[s]!, y1 = map.segY1[s]!, x2 = map.segX2[s]!, y2 = map.segY2[s]!;
    const length = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.ceil(length / WALL_PIECE);
    const rotation = Math.atan2(y2 - y1, x2 - x1);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      out.push({ model: "wall", x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, scale: length / n / WALL_PIECE, rotation });
    }
    for (const [x, y] of [[x1, y1], [x2, y2]] as const) {
      if (!sharedEnd(map, s, x, y)) out.push({ model: "gate-post", x, y, scale: 1, rotation });
    }
  }
  return out;
}

function sharedEnd(map: WorldMap, own: number, x: number, y: number): boolean {
  for (let s = 0; s < map.segCount; s++) {
    if (s === own) continue;
    if ((map.segX1[s] === x && map.segY1[s] === y) || (map.segX2[s] === x && map.segY2[s] === y)) return true;
  }
  return false;
}

/** Sizes in sim units. */
const WALL_HEIGHT = 120;
const POST_SIZE = 130;
const POST_HEIGHT = 175;
const RUIN_BLOCKS = 3;
/** Paths lie this far over the ground (scene units), under every figure. */
const PATH_LIFT = 0.012;

/**
 * The obstacles and paths of the run's map (spec 2026-11-21 difficulties 4.5): trees and rocks from the prop
 * models, ruins as broken stone blocks, the wall from stone boxes with posts at the gates, the paths as flat
 * strips of trodden earth. Rebuilt whenever a new run starts (its islands come from the seed).
 */
export class WorldView implements RunView {
  readonly object = new Group();
  private readonly box = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  private readonly wallMaterial = new MeshStandardMaterial({ color: WALL_STONE, roughness: 0.92 });
  private readonly postMaterial = new MeshStandardMaterial({ color: WALL_TOP, roughness: 0.9 });
  private readonly ruinMaterial = new MeshStandardMaterial({ color: RUIN_STONE, roughness: 0.95 });
  private readonly pathMaterial = new MeshStandardMaterial({
    color: PATH_COLOR, roughness: 1, transparent: true, opacity: 0.7, depthWrite: false,
  });
  private built: Group | null = null;
  private lastRun: Run | null = null;
  /** Obstacles drawn now (islands + wall segments), for `__game.obstacles`. */
  obstacles = 0;

  constructor(private readonly data: GameData, private readonly props: GLTF[]) {}

  update(run: Run): void {
    if (run === this.lastRun) return;
    this.lastRun = run;
    this.rebuild(run.map, run.world);
  }

  dispose(): void {
    this.clear();
    this.object.removeFromParent();
    this.box.dispose();
    this.wallMaterial.dispose();
    this.postMaterial.dispose();
    this.ruinMaterial.dispose();
    this.pathMaterial.dispose();
  }

  private clear(): void {
    if (!this.built) return;
    this.built.traverse((node) => {
      if ((node as InstancedMesh).isInstancedMesh) (node as InstancedMesh).dispose();
    });
    // the path strips are this view's own geometry; the props share the models' geometry
    for (const child of this.built.children) if (child.userData.ownGeometry) (child as Mesh).geometry.dispose();
    this.object.remove(this.built);
    this.built = null;
  }

  private rebuild(map: WorldMap, world: number): void {
    this.clear();
    const group = new Group();
    const list = worldInstances(map);
    const placements: PropPlacement[] = [];
    const walls: WorldInstance[] = [];
    const posts: WorldInstance[] = [];
    const ruins: WorldInstance[] = [];
    for (const item of list) {
      if (item.model === "wall") walls.push(item);
      else if (item.model === "gate-post") posts.push(item);
      else if (item.model === "ruin") ruins.push(item);
      else {
        const model = PROP_MODELS.findIndex((p) => p.id === item.model);
        const rock = item.model.startsWith("rock");
        // a rock covers its island; a tree cluster stays low enough not to hide the fight behind it
        const scale = rock ? item.scale * 1.45 : Math.min(1.1, Math.max(0.7, item.scale * 0.7));
        placements.push({ model, x: item.x, y: item.y, scale, turn: item.rotation / (Math.PI / 2) });
      }
    }
    group.add(createProps(this.props, placements));
    const thickness = map.segHalf * 2;
    group.add(this.boxes(walls, this.wallMaterial, (w) => [w.scale * WALL_PIECE + 2, WALL_HEIGHT, thickness]));
    group.add(this.boxes(posts, this.postMaterial, () => [POST_SIZE, POST_HEIGHT, POST_SIZE]));
    const blocks: WorldInstance[] = [];
    for (const ruin of ruins) {
      const r = ruin.scale * 100;
      for (let k = 0; k < RUIN_BLOCKS; k++) {
        const a = ruin.rotation + (k * 2 * Math.PI) / RUIN_BLOCKS;
        blocks.push({ model: "ruin", x: ruin.x + Math.cos(a) * r * 0.5, y: ruin.y + Math.sin(a) * r * 0.5, scale: r * (0.55 + 0.15 * k), rotation: a + Math.PI / 2 });
      }
    }
    group.add(this.boxes(blocks, this.ruinMaterial, (b) => [b.scale, 40 + b.scale * 0.35, b.scale * 0.45]));
    const paths = this.pathGeometry(world);
    if (paths) {
      const mesh = new Mesh(paths, this.pathMaterial);
      mesh.userData.ownGeometry = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = -1;
      group.add(mesh);
    }
    this.built = group;
    this.object.add(group);
    this.obstacles = map.islandCount + map.segCount;
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
