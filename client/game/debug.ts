import { debugGrantXp, debugSetAbilityLevel, type Run } from "../../sim";
import type { Backend } from "../render/gpu";

/** Read by the e2e tests; refreshed every frame. */
export interface GameSnapshot {
  backend: Backend;
  frames: number;
  screen: "menu" | "playing" | "levelUp" | "won" | "lost";
  tick: number;
  level: number;
  kills: number;
  heroHp: number;
  castleHp: number;
  enemies: number;
  hero: string;
  heroX: number;
  heroY: number;
  abilityLevels: number[];
  /** Ticks left per slot. */
  abilityCooldowns: number[];
  ultimateAuto: boolean;
  allies: number;
  projectiles: number;
  /** Only with ?debug=1. */
  debug?: { grantXp(amount: number): void; setAbilityLevel(slot: number, level: number): void };
}

declare global {
  interface Window {
    __game?: GameSnapshot;
  }
}

/** Creates the snapshot and publishes it as `window.__game`. */
export function publishSnapshot(backend: Backend): GameSnapshot {
  const snapshot: GameSnapshot = {
    backend, frames: 0, screen: "menu", tick: 0, level: 0, kills: 0, heroHp: 0, castleHp: 0, enemies: 0,
    hero: "", heroX: 0, heroY: 0, abilityLevels: [], abilityCooldowns: [], ultimateAuto: true, allies: 0,
    projectiles: 0,
  };
  window.__game = snapshot;
  return snapshot;
}

/** Adds `window.__game.debug`; `getRun` is read at call time because the run is replaced on every start. */
export function addDebugHooks(snapshot: GameSnapshot, getRun: () => Run | null): void {
  snapshot.debug = {
    grantXp(amount: number): void {
      const run = getRun();
      if (run) debugGrantXp(run, amount);
    },
    setAbilityLevel(slot: number, level: number): void {
      const run = getRun();
      if (run) debugSetAbilityLevel(run, slot, level);
    },
  };
}

/** Counts a rendered frame and copies the run state; `menuOpen` shows "menu" in place of the run state. */
export function updateSnapshot(snapshot: GameSnapshot, run: Run | null, menuOpen: boolean): void {
  snapshot.frames++;
  if (!run) return;
  snapshot.screen = menuOpen ? "menu" : run.state;
  snapshot.tick = run.tick;
  snapshot.level = run.hero.level;
  snapshot.kills = run.stats.kills;
  snapshot.heroHp = run.hero.hp;
  snapshot.castleHp = run.castle.hp;
  snapshot.enemies = run.enemies.aliveCount;
  snapshot.hero = run.hero.def.id;
  snapshot.heroX = run.hero.x;
  snapshot.heroY = run.hero.y;
  // the slot count is fixed (4), so these arrays are filled in place after the first frame
  const { abilities } = run;
  snapshot.abilityLevels.length = abilities.length;
  snapshot.abilityCooldowns.length = abilities.length;
  for (let i = 0; i < abilities.length; i++) {
    snapshot.abilityLevels[i] = abilities[i]!.level;
    snapshot.abilityCooldowns[i] = abilities[i]!.cooldown;
  }
  snapshot.ultimateAuto = run.ultimateAuto;
  snapshot.allies = run.allies.count;
  snapshot.projectiles = run.projectiles.count;
}
