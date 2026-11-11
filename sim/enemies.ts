export const Role = { Sieger: 0, Hunter: 1 } as const;
export const Action = { Move: 0, Attack: 1, Stunned: 2 } as const;

/** Enemies in typed arrays of fixed capacity; a slot is stable while the enemy lives. */
export class EnemyStore {
  readonly capacity: number;
  aliveCount = 0;
  readonly alive: Uint8Array;
  readonly type: Uint16Array;
  readonly role: Uint8Array;
  readonly aggro: Uint8Array;
  readonly action: Uint8Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly prevX: Float64Array;
  readonly prevY: Float64Array;
  readonly facingX: Float64Array;
  readonly facingY: Float64Array;
  readonly hp: Float64Array;
  readonly maxHp: Float64Array;
  readonly damageScale: Float64Array;
  readonly attackCooldown: Int32Array;
  readonly stunTicks: Int32Array;
  /** Steps until an enemy with a heal may heal again. */
  readonly healCooldown: Int32Array;
  readonly spawnTick: Int32Array;
  readonly lastHitTick: Int32Array;
  readonly lastAttackTick: Int32Array;
  /** Knockback velocity (world units per second) at its start, and the ticks left; it fades linearly. */
  readonly knockVX: Float64Array;
  readonly knockVY: Float64Array;
  readonly knockTicks: Int32Array;
  /** Slow: ticks left and the share of walking speed removed (0..1). */
  readonly slowTicks: Int32Array;
  readonly slowFactor: Float64Array;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.alive = new Uint8Array(capacity);
    this.type = new Uint16Array(capacity);
    this.role = new Uint8Array(capacity);
    this.aggro = new Uint8Array(capacity);
    this.action = new Uint8Array(capacity);
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.prevX = new Float64Array(capacity);
    this.prevY = new Float64Array(capacity);
    this.facingX = new Float64Array(capacity);
    this.facingY = new Float64Array(capacity);
    this.hp = new Float64Array(capacity);
    this.maxHp = new Float64Array(capacity);
    this.damageScale = new Float64Array(capacity);
    this.attackCooldown = new Int32Array(capacity);
    this.stunTicks = new Int32Array(capacity);
    this.healCooldown = new Int32Array(capacity);
    this.spawnTick = new Int32Array(capacity);
    this.lastHitTick = new Int32Array(capacity);
    this.lastAttackTick = new Int32Array(capacity);
    this.knockVX = new Float64Array(capacity);
    this.knockVY = new Float64Array(capacity);
    this.knockTicks = new Int32Array(capacity);
    this.slowTicks = new Int32Array(capacity);
    this.slowFactor = new Float64Array(capacity);
  }

  /** Takes the lowest free slot; returns -1 when the store is full. */
  spawn(
    type: number, role: number, x: number, y: number,
    hp: number, damageScale: number, tick: number,
  ): number {
    let slot = -1;
    for (let i = 0; i < this.capacity; i++) {
      if (this.alive[i] === 0) {
        slot = i;
        break;
      }
    }
    if (slot < 0) return -1;
    this.alive[slot] = 1;
    this.aliveCount++;
    this.type[slot] = type;
    this.role[slot] = role;
    this.aggro[slot] = 0;
    this.action[slot] = Action.Move;
    this.x[slot] = x;
    this.y[slot] = y;
    this.prevX[slot] = x;
    this.prevY[slot] = y;
    this.facingX[slot] = 0;
    this.facingY[slot] = -1;
    this.hp[slot] = hp;
    this.maxHp[slot] = hp;
    this.damageScale[slot] = damageScale;
    this.attackCooldown[slot] = 0;
    this.stunTicks[slot] = 0;
    this.healCooldown[slot] = 0;
    this.spawnTick[slot] = tick;
    this.lastHitTick[slot] = -1;
    this.lastAttackTick[slot] = -1;
    this.knockVX[slot] = 0;
    this.knockVY[slot] = 0;
    this.knockTicks[slot] = 0;
    this.slowTicks[slot] = 0;
    this.slowFactor[slot] = 0;
    return slot;
  }

  kill(slot: number): void {
    if (this.alive[slot] === 0) return;
    this.alive[slot] = 0;
    this.aliveCount--;
  }
}

/** Slows an enemy; with a slow already active, both the factor and the ticks keep the larger value. */
export function applySlow(e: EnemyStore, slot: number, factor: number, ticks: number): void {
  if (ticks <= 0) return;
  e.slowFactor[slot] = e.slowTicks[slot] > 0 ? Math.max(e.slowFactor[slot], factor) : factor;
  e.slowTicks[slot] = Math.max(e.slowTicks[slot], ticks);
}
