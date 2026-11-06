export const Role = { Sieger: 0, Hunter: 1 } as const;
export const Action = { Move: 0, Attack: 1, Stunned: 2 } as const;

/** Enemies in typed arrays of fixed capacity; a slot is stable while the enemy lives. */
export class EnemyStore {
  readonly capacity: number;
  aliveCount = 0;
  readonly alive: Uint8Array;
  readonly type: Uint16Array;
  readonly role: Uint8Array;
  readonly gate: Uint8Array;
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
  readonly spawnTick: Int32Array;
  readonly lastHitTick: Int32Array;
  readonly lastAttackTick: Int32Array;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.alive = new Uint8Array(capacity);
    this.type = new Uint16Array(capacity);
    this.role = new Uint8Array(capacity);
    this.gate = new Uint8Array(capacity);
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
    this.spawnTick = new Int32Array(capacity);
    this.lastHitTick = new Int32Array(capacity);
    this.lastAttackTick = new Int32Array(capacity);
  }

  /** Takes the lowest free slot; returns -1 when the store is full. */
  spawn(
    type: number, role: number, gate: number, x: number, y: number,
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
    this.gate[slot] = gate;
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
    this.spawnTick[slot] = tick;
    this.lastHitTick[slot] = -1;
    this.lastAttackTick[slot] = -1;
    return slot;
  }

  kill(slot: number): void {
    if (this.alive[slot] === 0) return;
    this.alive[slot] = 0;
    this.aliveCount--;
  }
}
