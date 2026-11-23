import { botInput } from "../../sim/bot";
import { TICKS_PER_SECOND } from "../../sim/constants";
import { createRun, EventKind } from "../../sim/index";
import type { LoadoutEntry, RunResult } from "../../sim/index";
import type { TickInput } from "../../sim/input";
import type { DifficultyId, GameData } from "../../data/schema";

// Multiplayer migration step 8: co-op balance. Every player is steered by the autopilot.

export interface CoopSummary {
  heroes: string[];
  seed: number;
  result: RunResult;
  seconds: number;
  /** The shared hero level at the end. */
  level: number;
  castleHpPercent: number;
  /** Times each hero fell, in player order. */
  downs: number[];
  /** Revives over all players. */
  revives: number;
  /** Seconds in which every hero but one (or more) lay down at once, summed. */
  aloneSeconds: number;
  kills: number;
  spawned: number;
  /** Chests opened by all players. */
  chests: number;
}

/** The hero groups of `--players n`: n heroes in a row from every hero of the list, wrapping around (8 groups for 8 heroes). */
export function heroGroups(ids: readonly string[], n: number): string[][] {
  if (n <= 1) return ids.map((id) => [id]);
  return ids.map((_, k) => Array.from({ length: n }, (_, j) => ids[(k + j) % ids.length]!));
}

/** Plays one co-op run with the autopilot steering every hero. */
export function playCoop(
  data: GameData, seed: number, heroes: readonly string[], loadouts: readonly (readonly LoadoutEntry[])[],
  world = 1, difficulty: DifficultyId = "normal", durationSeconds?: number,
): CoopSummary {
  const run = createRun(data, {
    seed, durationSeconds, world, difficulty,
    players: heroes.map((hero, p) => ({ hero, loadout: loadouts[p] ?? [] })),
  });
  const inputs: TickInput[] = heroes.map(() => ({ moveX: 0, moveY: 0, card: -1, actions: 0 }));
  const downs = heroes.map(() => 0);
  const wasUp = heroes.map(() => true);
  let revives = 0;
  let aloneTicks = 0;
  while (run.state !== "won" && run.state !== "lost") {
    for (let p = 0; p < inputs.length; p++) {
      run.current = p;
      botInput(run, inputs[p]!);
    }
    run.current = 0;
    run.step(inputs);
    let up = 0;
    for (let p = 0; p < heroes.length; p++) {
      const alive = run.players[p]!.hero.hp > 0;
      if (wasUp[p] && !alive) downs[p]++;
      wasUp[p] = alive;
      if (alive) up++;
    }
    if (heroes.length > 1 && up === 1) aloneTicks++;
    for (let i = 0; i < run.events.count; i++) if (run.events.kind[i] === EventKind.Revive) revives++;
  }
  return {
    heroes: [...heroes],
    seed,
    result: run.result ?? "won",
    seconds: Math.floor(run.tick / TICKS_PER_SECOND),
    level: run.players[0]!.hero.level,
    castleHpPercent: Math.max(0, Math.round((run.castle.hp / run.castle.maxHp) * 100)),
    downs,
    revives,
    aloneSeconds: Math.round(aloneTicks / TICKS_PER_SECOND),
    kills: run.stats.kills,
    spawned: run.stats.spawned,
    chests: run.chestsOpened,
  };
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function formatCoop(s: CoopSummary): string {
  const outcome = s.result === "won" ? "won" : `lost (${s.result === "hero" ? "all down" : s.result})`;
  return `${s.heroes.join(" + ")} seed ${s.seed}: ${outcome} at ${clock(s.seconds)}, level ${s.level}, ` +
    `castle ${s.castleHpPercent}%, downs ${s.downs.join("/")}, revives ${s.revives}, alone ${s.aloneSeconds} s, ` +
    `kills ${s.kills}, chests ${s.chests}`;
}

/** One line per group of heroes: wins, why runs were lost, level, downs and revives per run. */
export function formatCoopGroup(summaries: CoopSummary[]): string {
  const won = summaries.filter((s) => s.result === "won").length;
  const castle = summaries.filter((s) => s.result === "castle").length;
  const allDown = summaries.filter((s) => s.result === "hero").length;
  const avg = (f: (s: CoopSummary) => number) => summaries.reduce((a, s) => a + f(s), 0) / summaries.length;
  const lost = summaries.filter((s) => s.result !== "won").map((s) => s.seconds);
  const lostAt = lost.length > 0 ? ` (median ${clock([...lost].sort((a, b) => a - b)[Math.floor(lost.length / 2)]!)})` : "";
  return `${summaries[0]!.heroes.join(" + ")}: ${summaries.length} runs: ${won} won, ${castle} castle, ${allDown} all down${lostAt}; ` +
    `level avg ${avg((s) => s.level).toFixed(1)}; downs avg ${avg((s) => s.downs.reduce((a, b) => a + b, 0)).toFixed(1)}, ` +
    `revives avg ${avg((s) => s.revives).toFixed(1)}, alone avg ${Math.round(avg((s) => s.aloneSeconds))} s`;
}

/** The total over every group of one player count: `players 2: 160 runs: 70 won (44 %), 50 castle, 40 all down`. */
export function formatCoopTotal(n: number, summaries: CoopSummary[]): string {
  const won = summaries.filter((s) => s.result === "won").length;
  const castle = summaries.filter((s) => s.result === "castle").length;
  const allDown = summaries.filter((s) => s.result === "hero").length;
  return `players ${n}: ${summaries.length} runs: ${won} won (${Math.round((100 * won) / summaries.length)} %), ` +
    `${castle} castle, ${allDown} all down`;
}
