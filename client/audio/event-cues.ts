import type { AudioData, GameSound } from "../../data/schema/audio";
import { EventKind, OrbKind, type Run, SlamEvent } from "../../sim";

/** A cue to play: `world` sounds are panned by their place on the screen. */
export interface CueRequest {
  cue: string;
  x: number;
  y: number;
  world: boolean;
}

export interface CueState {
  lastHeroHealTick: number;
}

/** Steps between two lifesteal heal sounds (0.5 s at 30 steps a second). */
const HERO_HEAL_GAP_TICKS = 15;

/** What each event plays: "sound" (a game sound or a data lookup) or "skip" with the reason. */
export const HANDLED_EVENTS: Record<keyof typeof EventKind, "sound" | "skip"> = {
  Hit: "sound",
  Death: "sound",
  Cast: "sound",
  HeroHit: "sound",
  CastleHit: "sound",
  Pickup: "sound",
  LevelUp: "sound",
  RunEnd: "skip", // the music plays the end jingle
  Blast: "sound", // a gear splash: the hero's attack cue
  Heal: "skip", // not emitted by the simulation
  Dash: "sound",
  EnemyHeal: "sound",
  PackSpawn: "skip", // packs arrive all the time; only rushes and bosses are announced
  EnemyCharge: "sound",
  RushWarning: "sound",
  BossSpawn: "sound",
  Slam: "sound",
  Enrage: "sound",
  ChestSpawn: "skip",
  ChestOpen: "sound",
  ChestPick: "sound",
  BossDeath: "sound",
  HeroHeal: "sound",
  OrbSpawn: "skip",
  OrbPickup: "sound",
};

const ORB_SOUNDS: Record<number, GameSound> = {
  [OrbKind.Boots]: "orb.boots",
  [OrbKind.Berserk]: "orb.berserk",
  [OrbKind.Heal]: "orb.heal",
};
const PICKUP_SOUNDS: GameSound[] = ["pickup.xp", "pickup.coin", "pickup.heart"];

export function newCueRequests(capacity: number): CueRequest[] {
  return Array.from({ length: capacity }, () => ({ cue: "", x: 0, y: 0, world: true }));
}

/** Writes the cues of this step's events into `out` (preallocated) and returns how many it wrote. Does not allocate. */
export function resolveEventCues(run: Run, data: AudioData, enemyIds: readonly string[], out: CueRequest[], state: CueState): number {
  const { events } = run;
  let n = 0;
  const add = (cue: string | undefined, i: number, world = true): void => {
    if (cue === undefined || cue === "none" || n >= out.length) return;
    const r = out[n++]!;
    r.cue = cue;
    r.x = events.x[i]!;
    r.y = events.y[i]!;
    r.world = world;
  };
  const sound = (name: GameSound, i: number, world = true): void => add(data.sounds[name], i, world);
  const heroAttack = (): string | undefined => {
    const hero = data.heroes[run.hero.def.id];
    return hero ? hero.attackHit ?? hero.attack : undefined;
  };
  for (let i = 0; i < events.count; i++) {
    switch (events.kind[i]) {
      case EventKind.Cast:
        add(data.abilities[run.abilities[events.a[i]!]!.def.id]?.cast, i);
        break;
      case EventKind.Hit: {
        const source = events.u[i];
        if (source === 0) add(heroAttack(), i);
        else if (source === 1) {
          const slot = run.abilities[events.v[i]!];
          if (slot) add(data.abilities[slot.def.id]?.hit, i);
        }
        break;
      }
      case EventKind.Blast:
        add(heroAttack(), i);
        break;
      case EventKind.Death:
        add(data.enemies[enemyIds[run.enemies.type[events.a[i]!]!]!]?.death, i);
        break;
      case EventKind.BossDeath:
        sound("bossDeath", i);
        break;
      case EventKind.HeroHit:
        sound("heroHit", i, false);
        break;
      case EventKind.CastleHit:
        sound("castleHit", i);
        break;
      case EventKind.Pickup:
        sound(PICKUP_SOUNDS[events.u[i]!] ?? "pickup.xp", i);
        break;
      case EventKind.OrbPickup: {
        const name = ORB_SOUNDS[events.value[i]!];
        if (name) sound(name, i);
        break;
      }
      case EventKind.ChestOpen:
        sound("chest.open", i);
        break;
      case EventKind.ChestPick:
        sound("chest.pick", i, false);
        break;
      case EventKind.LevelUp:
        sound("levelUp", i, false);
        break;
      case EventKind.Dash:
        sound("dash", i, false);
        break;
      case EventKind.HeroHeal:
        if (events.u[i] === 2 || run.tick - state.lastHeroHealTick < HERO_HEAL_GAP_TICKS) break;
        state.lastHeroHealTick = run.tick;
        sound("heroHeal", i, false);
        break;
      case EventKind.EnemyHeal:
        sound("enemy.heal", i);
        break;
      case EventKind.EnemyCharge:
        if (events.value[i] === 0) sound("enemy.charge", i);
        break;
      case EventKind.BossSpawn:
        sound("bossArrive", i, false);
        break;
      case EventKind.RushWarning:
        sound("rushWarning", i, false);
        break;
      case EventKind.Slam:
        if (events.value[i] === SlamEvent.Warning) sound("slam.warn", i);
        else if (events.value[i] === SlamEvent.Hit) sound("slam.hit", i);
        break;
      case EventKind.Enrage:
        sound("enrage", i, false);
        break;
    }
  }
  return n;
}
