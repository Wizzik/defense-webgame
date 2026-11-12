import { Box3, Group, type Object3D, Vector3 } from "three/webgpu";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { Rules } from "../../data/schema";
import { SCENE_SCALE } from "./coords";

/** The castle's footprint fits a circle of this many castle radii (diameter 2 x radius x 1.1). */
const FOOTPRINT = 1.1;
/** Towers stand on the diagonals, this many castle radii from the middle; their height is this share of the castle's. */
const TOWER_DISTANCE = 0.95;
const TOWER_HEIGHT = 0.8;
/** A flag is this share of the tower's height. */
const FLAG_HEIGHT = 0.3;

function castShadows(object: Object3D): Object3D {
  object.traverse((node) => {
    node.castShadow = true;
    node.receiveShadow = true;
  });
  return object;
}

/** A copy of the model scaled by `scale`, standing on y = 0, centred on x = z = 0, with the box of the result. */
function placed(gltf: GLTF, scale: number): { object: Group; box: Box3 } {
  const inner = castShadows(gltf.scene.clone(true));
  inner.scale.setScalar(scale);
  const outer = new Group();
  outer.add(inner);
  const box = new Box3().setFromObject(outer);
  const centre = box.getCenter(new Vector3());
  inner.position.set(-centre.x, -box.min.y, -centre.z);
  return { object: outer, box: new Box3().setFromObject(outer) };
}

function size(gltf: GLTF): Vector3 {
  return new Box3().setFromObject(gltf.scene).getSize(new Vector3());
}

/** The castle from the kit with four towers and a flag on each, centred on the arena's castle position. */
export function createCastle(models: { castle: GLTF; tower: GLTF; flag: GLTF }, rules: Rules): Group {
  const radius = rules.castle.radius * SCENE_SCALE;
  const group = new Group();
  group.position.set(rules.arena.castle.x * SCENE_SCALE, 0, -rules.arena.castle.y * SCENE_SCALE);

  // the whole footprint, corner to corner, fits the circle
  const castleSize = size(models.castle);
  const castleScale = (2 * radius * FOOTPRINT) / Math.hypot(castleSize.x, castleSize.z);
  const castle = placed(models.castle, castleScale);
  group.add(castle.object);
  const castleHeight = castle.box.max.y;

  const towerScale = (castleHeight * TOWER_HEIGHT) / size(models.tower).y;
  const flagScale = (castleHeight * TOWER_HEIGHT * FLAG_HEIGHT) / size(models.flag).y;
  const offset = (radius * TOWER_DISTANCE) / Math.SQRT2;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const tower = placed(models.tower, towerScale);
      tower.object.position.set(sx * offset, 0, sz * offset);
      const flag = placed(models.flag, flagScale);
      flag.object.position.set(sx * offset, tower.box.max.y, sz * offset);
      group.add(tower.object, flag.object);
    }
  }
  return group;
}
