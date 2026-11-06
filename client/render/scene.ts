import {
  AmbientLight,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardNodeMaterial,
  PlaneGeometry,
} from "three/webgpu";
import type { Rules } from "../../data/schema";
import { SCENE_SCALE } from "./coords";

/** Width of a lane from a gate to the castle, in world units. */
const LANE_WIDTH = 400;
const LANE_LIFT = 0.02;

function material(color: number): MeshStandardNodeMaterial {
  return new MeshStandardNodeMaterial({ color, roughness: 0.95 });
}

/** Adds a lane strip and returns its rotation about y. */
function addLane(group: Group, fromX: number, fromZ: number, toX: number, toZ: number): number {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const lane = new Mesh(new BoxGeometry(Math.hypot(dx, dz), LANE_LIFT, LANE_WIDTH * SCENE_SCALE), material(0x7a6a4f));
  lane.position.set((fromX + toX) / 2, LANE_LIFT / 2, (fromZ + toZ) / 2);
  lane.rotation.y = Math.atan2(-dz, dx);
  group.add(lane);
  return lane.rotation.y;
}

/** `angle` is the lane's rotation about y; the gate opens along the lane. */
function createGate(x: number, z: number, radius: number, angle: number): Group {
  const gate = new Group();
  const post = new BoxGeometry(0.5, 3, 0.5);
  const stone = material(0x8a8d93);
  const left = new Mesh(post, stone);
  left.position.set(-radius, 1.5, 0);
  const right = new Mesh(post, stone);
  right.position.set(radius, 1.5, 0);
  const lintel = new Mesh(new BoxGeometry(radius * 2 + 0.9, 0.5, 0.6), stone);
  lintel.position.set(0, 3.15, 0);
  gate.add(left, right, lintel);
  gate.position.set(x, 0, z);
  gate.rotation.y = angle + Math.PI / 2;
  return gate;
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

/** Floor, lanes from the gates to the castle, gates, castle and lights. Static: built once per run. */
export function createArena(rules: Rules): Group {
  const { arena, castle } = rules;
  const group = new Group();

  const floor = new Mesh(
    new PlaneGeometry(arena.width * SCENE_SCALE, arena.height * SCENE_SCALE),
    material(0x56614c),
  );
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  const castleX = arena.castle.x * SCENE_SCALE;
  const castleZ = -arena.castle.y * SCENE_SCALE;
  for (const gate of arena.gates) {
    const gateX = gate.x * SCENE_SCALE;
    const gateZ = -gate.y * SCENE_SCALE;
    const angle = addLane(group, gateX, gateZ, castleX, castleZ);
    group.add(createGate(gateX, gateZ, arena.gateRadius * SCENE_SCALE, angle));
  }
  group.add(createCastle(castleX, castleZ, castle.radius * SCENE_SCALE));

  const sun = new DirectionalLight(0xffffff, 2.5);
  sun.position.set(30, 60, 20);
  group.add(sun, new AmbientLight(0xffffff, 0.7));
  return group;
}
