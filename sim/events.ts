export const EventKind = {
  Hit: 1,
  Death: 2,
  Cast: 3,
  /** The hero lost hp: a = the enemy slot (-1 none), value = hp, x/y = the hero, u = HeroHitSource (sim/combat.ts),
   *  v = the player. */
  HeroHit: 4,
  CastleHit: 5,
  /** A crystal, a coin or a heart was collected: value = XP, gold or hp gained, u = 0 crystal / 1 coin / 2 heart,
   *  v = the player who collected it (XP is shared by all). */
  Pickup: 6,
  /** A hero reached a level: a = the level, x/y = the hero, v = the player (the level is shared: one per player). */
  LevelUp: 7,
  RunEnd: 8,
  Blast: 9,
  Heal: 10,
  Dash: 11,
  /** An enemy healed an enemy: a = healed slot, value = hp healed, x/y = the healed one, u = the healer's slot. */
  EnemyHeal: 12,
  /** A pack arrived: a = its role, value = members spawned, x/y = the centre of the pack. */
  PackSpawn: 13,
  /** A charge: a = slot, value = 0 windup starts / 1 the run starts, x/y = the enemy, u/v = direction
   *  (to the hero at the windup, locked at the run). */
  EnemyCharge: 14,
  /** An elite rush is coming: value = seconds until it comes, x/y = the centre of its pack. */
  RushWarning: 15,
  /** A boss arrived: a = slot, value = type index, x/y = where. */
  BossSpawn: 16,
  /** A slam: a = slot, value = 0 the warning starts / 1 it hits / 2 it was cancelled, x/y = the centre of the
   *  circle, u = its radius, v = steps of the warning (0 for values 1 and 2). */
  Slam: 17,
  /** The final boss is enraged: a = slot, x/y = where. */
  Enrage: 18,
  /** A chest appeared at a new place: a = chest index, x/y = where. */
  ChestSpawn: 19,
  /** The hero opened a chest: a = chest index, value = gold paid, x/y = the chest. */
  ChestOpen: 20,
  /** A slot of the open chest was chosen: a = slot, value = its new level (permanent + temporary), x/y = the hero,
   *  u = index of the item in the slot. */
  ChestPick: 21,
  /** A boss fell: a = enemy type index, value = how many bosses fell in the run before it (0 for the first), x/y = where. */
  BossDeath: 22,
  /** The hero healed: value = hp, x/y = the hero, u = 1 lifesteal (the sum of a step) / 2 the heal orb (the sum of a
   *  second). A heart reports a Pickup with u = 2. */
  HeroHeal: 23,
  /** An orb appeared: a = its place, value = its kind (OrbKind), x/y = where. */
  OrbSpawn: 24,
  /** A hero picked an orb up: a = its place, value = its kind (OrbKind), x/y = the orb, u = the player. */
  OrbPickup: 25,
  /** A new enemy faction: a = its index in rules.factions, value = the phase (1-based), x/y = the hero. */
  Faction: 26,
  /** A bloodcaller cast bloodlust: a = its slot, value = enemies lusted, x/y = the caster. */
  Bloodlust: 27,
  /** A hero was snared: value = 0 web (slow) / 1 roots, x/y = the hero, u = seconds, v = the player. */
  HeroSnared: 28,
  /** A gravebinder raised an enemy: a = the new slot, value = the raiser's type index, x/y = where. */
  Raise: 29,
  /** A storm bolt or meteor (sim/hazard.ts): a = its place, value = 0 the warning starts / 1 it strikes, x/y = the
   *  centre, u = radius, v = steps of the warning; value = 2 a pool of fire starts (sim/fire-pools.ts): a = the pool's
   *  place, u = its radius, v = its steps. */
  Hazard: 30,
  /** The world's natural event: the first storm wave of a run (u = 0), or a weather phase (u = WeatherPhase of
   *  sim/weather.ts: 1 warning, 2 start, 3 end; value = seconds of the warning / of the weather / 0). x/y = the hero. */
  HazardWave: 31,
  /** Co-op: a fallen hero stood up (sim/revive.ts): a = the revived player, value = his hp, x/y = where he lies,
   *  u = the teammate who revived him. */
  Revive: 32,
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
  /** The player whose system pushed the event (`Run.current` at the push; an enemy's events name its target). */
  readonly player: Uint8Array;
  /** The player the next pushes are credited to; `Run` keeps it equal to `Run.current`. */
  who = 0;
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
    this.player = new Uint8Array(capacity);
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
    this.player[i] = this.who;
  }
}
