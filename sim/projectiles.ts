import { damageEnemy } from "./combat";
import { TICK_SECONDS } from "./constants";
import { nearestEnemy } from "./abilities/targeting";
import type { Run } from "./run";

export const PROJECTILE_CAPACITY = 64;
/** A bolt whose target is gone looks for a new one within this distance. */
export const RETARGET_RANGE = 600;

/** Homing bolts in typed arrays of fixed capacity; a slot is stable while the bolt flies. */
export class ProjectileStore {
  readonly capacity: number;
  count = 0;
  readonly alive: Uint8Array;
  /** Ability slot that fired the bolt. */
  readonly ability: Uint8Array;
  readonly target: Int32Array;
  /** The target's spawnTick when locked on; a refilled enemy slot has a different one. */
  readonly targetSpawnTick: Int32Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly prevX: Float64Array;
  readonly prevY: Float64Array;
  readonly speed: Float64Array;
  readonly damage: Float64Array;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.alive = new Uint8Array(capacity);
    this.ability = new Uint8Array(capacity);
    this.target = new Int32Array(capacity);
    this.targetSpawnTick = new Int32Array(capacity);
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.prevX = new Float64Array(capacity);
    this.prevY = new Float64Array(capacity);
    this.speed = new Float64Array(capacity);
    this.damage = new Float64Array(capacity);
  }

  /** Takes the lowest free slot; returns -1 when the store is full. */
  spawn(
    ability: number, target: number, targetSpawnTick: number, x: number, y: number, speed: number, damage: number,
  ): number {
    for (let i = 0; i < this.capacity; i++) {
      if (this.alive[i] !== 0) continue;
      this.alive[i] = 1;
      this.ability[i] = ability;
      this.target[i] = target;
      this.targetSpawnTick[i] = targetSpawnTick;
      this.x[i] = x;
      this.y[i] = y;
      this.prevX[i] = x;
      this.prevY[i] = y;
      this.speed[i] = speed;
      this.damage[i] = damage;
      this.count++;
      return i;
    }
    return -1;
  }

  remove(i: number): void {
    if (this.alive[i] === 0) return;
    this.alive[i] = 0;
    this.count--;
  }
}

/** Flies every bolt towards its target (retargeting when it is gone); a bolt in reach hits and disappears. */
export function updateProjectiles(run: Run): void {
  const p = run.projectiles;
  if (p.count === 0) return;
  const e = run.enemies;
  for (let i = 0; i < p.capacity; i++) {
    if (p.alive[i] === 0) continue;
    let t = p.target[i];
    if (t < 0 || e.alive[t] === 0 || e.spawnTick[t] !== p.targetSpawnTick[i]) {
      t = nearestEnemy(run, p.x[i], p.y[i], RETARGET_RANGE);
      if (t < 0) {
        p.remove(i);
        continue;
      }
      p.target[i] = t;
      p.targetSpawnTick[i] = e.spawnTick[t];
    }
    const dx = e.x[t] - p.x[i];
    const dy = e.y[t] - p.y[i];
    const d = Math.sqrt(dx * dx + dy * dy);
    const step = p.speed[i] * TICK_SECONDS;
    if (d <= step + run.data.enemies[e.type[t]].collision) {
      const damage = p.damage[i];
      const ability = p.ability[i];
      p.remove(i);
      damageEnemy(run, t, damage, 1, ability); // spells ignore armor
      continue;
    }
    p.x[i] += (dx / d) * step;
    p.y[i] += (dy / d) * step;
  }
}
