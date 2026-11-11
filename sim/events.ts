export const EventKind = {
  Hit: 1,
  Death: 2,
  Cast: 3,
  HeroHit: 4,
  CastleHit: 5,
  Pickup: 6,
  LevelUp: 7,
  RunEnd: 8,
  Blast: 9,
  Heal: 10,
  Dash: 11,
  /** An enemy healed an enemy: a = healed slot, value = hp healed, x/y = the healed one, u = the healer's slot. */
  EnemyHeal: 12,
  /** A pack arrived: a = its role, value = members spawned, x/y = the centre of the pack. */
  PackSpawn: 13,
} as const;

/** Fixed-capacity event buffer, cleared every step. Events that do not fit only bump `dropped`. */
export class EventLog {
  readonly kind: Uint8Array;
  readonly a: Int32Array;
  readonly value: Float64Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly u: Float64Array;
  readonly v: Float64Array;
  count = 0;
  dropped = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.kind = new Uint8Array(capacity);
    this.a = new Int32Array(capacity);
    this.value = new Float64Array(capacity);
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.u = new Float64Array(capacity);
    this.v = new Float64Array(capacity);
  }

  clear(): void {
    this.count = 0;
    this.dropped = 0;
  }

  push(kind: number, a: number, value: number, x: number, y: number, u: number, v: number): void {
    if (this.count >= this.capacity) {
      this.dropped++;
      return;
    }
    const i = this.count++;
    this.kind[i] = kind;
    this.a[i] = a;
    this.value[i] = value;
    this.x[i] = x;
    this.y[i] = y;
    this.u[i] = u;
    this.v[i] = v;
  }
}
