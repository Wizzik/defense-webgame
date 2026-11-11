import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardNodeMaterial,
} from "three/webgpu";
import type { Rules } from "../../data/schema";
import { SCENE_SCALE } from "./coords";
import { createGround } from "./ground";

function material(color: number): MeshStandardNodeMaterial {
  return new MeshStandardNodeMaterial({ color, roughness: 0.95 });
}

function createCastle(x: number, z: number, radius: number): Group {
  const castle = new Group();
  const wall = material(0xb5b0a3);
  const roof = material(0x8b3a32);
  const tower = new Mesh(new CylinderGeometry(radius * 0.55, radius * 0.6, radius * 2.2, 24), wall);
  tower.position.y = radius * 1.1;
  const towerRoof = new Mesh(new ConeGeometry(radius * 0.7, radius * 1.1, 24), roof);
  towerRoof.position.y = radius * 2.2 + radius * 0.55;
  castle.add(tower, towerRoof);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const turret = new Mesh(new CylinderGeometry(radius * 0.22, radius * 0.24, radius * 1.3, 16), wall);
      turret.position.set(sx * radius * 0.85, radius * 0.65, sz * radius * 0.85);
      const cap = new Mesh(new ConeGeometry(radius * 0.32, radius * 0.6, 16), roof);
      cap.position.set(sx * radius * 0.85, radius * 1.3 + radius * 0.3, sz * radius * 0.85);
      castle.add(turret, cap);
    }
  }
  castle.position.set(x, 0, z);
  return castle;
}

/** Ground and castle in the middle. Static: built once per run. */
export function createArena(rules: Rules): Group {
  const { arena, castle } = rules;
  const group = new Group();

  group.add(createGround(rules));

  const castleX = arena.castle.x * SCENE_SCALE;
  const castleZ = -arena.castle.y * SCENE_SCALE;
  group.add(createCastle(castleX, castleZ, castle.radius * SCENE_SCALE));

  return group;
}
