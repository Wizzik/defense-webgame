import { Mesh, MeshStandardNodeMaterial, PlaneGeometry } from "three/webgpu";
import { abs, color, float, max, min, mix, mx_noise_float, positionWorld, smoothstep, vec2 } from "three/tsl";
import type { Rules } from "../../data/schema";
import { SCENE_SCALE } from "./coords";
import { DIRT, GRASS_A, GRASS_B, GRASS_C } from "./palette";

/** The plane reaches this far (sim units) past the arena on every side. */
const MARGIN = 6000;
/** Noise periods in scene units. */
const COARSE_PERIOD = 9;
const FINE_PERIOD = 2.3;
/** Trodden earth: solid out to castle.radius * 1.3, gone at castle.radius * 2.4. */
const CASTLE_SOLID = 1.3;
const CASTLE_GONE = 2.4;
/** The spawn ring: an earth band of this width, fading over FADE on both sides, at this coverage. */
const RING_WIDTH = 160;
const RING_FADE = 120;
const RING_COVER = 0.55;

/** Procedural ground: noisy grass, earth around the castle and an earth band on the spawn ring. */
export function createGround(rules: Rules): Mesh {
  const { arena, castle } = rules;
  const size = (arena.width + 2 * MARGIN) * SCENE_SCALE;
  const depth = (arena.height + 2 * MARGIN) * SCENE_SCALE;

  const p = positionWorld.xz;
  // two octaves in [-1, 1], remapped to [0, 1]
  const coarse = mx_noise_float(p.div(COARSE_PERIOD)).mul(0.5).add(0.5);
  const fine = mx_noise_float(p.div(FINE_PERIOD).add(vec2(17.3, 5.9))).mul(0.5).add(0.5);
  const grassAB = mix(color(GRASS_A), color(GRASS_B), smoothstep(0.35, 0.65, coarse));
  const grass = mix(grassAB, color(GRASS_C), smoothstep(0.4, 0.8, fine).mul(0.8));

  // distance from the castle in scene units (the castle sits at the arena centre offset)
  const centre = vec2(arena.castle.x * SCENE_SCALE, -arena.castle.y * SCENE_SCALE);
  const dist = p.sub(centre).length();
  const radius = castle.radius * SCENE_SCALE;
  const castleDirt = float(1).sub(smoothstep(radius * CASTLE_SOLID, radius * CASTLE_GONE, dist));
  const ringDist = abs(dist.sub(arena.spawn.radius * SCENE_SCALE));
  const ringDirt = float(1)
    .sub(smoothstep((RING_WIDTH / 2) * SCENE_SCALE, (RING_WIDTH / 2 + RING_FADE) * SCENE_SCALE, ringDist))
    .mul(RING_COVER);
  const dirt = min(max(castleDirt, ringDirt), 1);

  const material = new MeshStandardNodeMaterial({ roughness: 0.95 });
  material.colorNode = mix(grass, color(DIRT), dirt);

  const ground = new Mesh(new PlaneGeometry(size, depth), material);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
}
