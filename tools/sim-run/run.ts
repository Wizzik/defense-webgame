import { pathToFileURL } from "node:url";
import { botInput } from "../../sim/bot";
import { TICKS_PER_SECOND } from "../../sim/constants";
import { createRun } from "../../sim/index";
import type { Run, RunResult } from "../../sim/index";
import type { TickInput } from "../../sim/input";
import { gameData } from "../../sim/testing/game-data";
import type { GameData } from "../../data/schema";

export interface RunSummary {
  hero: string;
  seed: number;
  result: RunResult;
  seconds: number;
  kills: number;
  spawned: number;
  level: number;
  castleHp: number;
  castleMaxHp: number;
  /** Castle hp at the end, in whole percent of its maximum. */
  castleHpPercent: number;
  heroHp: number;
  heroMaxHp: number;
  /** Lowest hero hp / max hp seen during the run, in whole percent. */
  minHeroHpPercent: number;
  /** Every boss that came, in the order of arrival. */
  bosses: { id: string; spawnSeconds: number; killSeconds: number | null }[];
  /** The final boss enraged. */
  enraged: boolean;
  /** XP gained up to the start of each phase the run reached (index 0 is phase 1). */
  phaseXp: number[];
}

/** A player who does nothing: no movement, no action; at a level-up the attribute card, so the first ability stays alone. */
export function idleInput(run: Run, out: TickInput): TickInput {
  out.moveX = 0;
  out.moveY = 0;
  out.actions = 0;
  out.card = run.offer ? Math.max(0, run.offer.cards.findIndex((c) => c.kind === "attribute")) : -1;
  return out;
}

/** Plays one run with the autopilot, or with no input at all when `idle` is set. */
export function playBot(
  data: GameData, seed: number, durationSeconds?: number, hero?: string, idle = false, startPhase?: number,
): RunSummary {
  const run = createRun(data, { seed, durationSeconds, hero, startPhase });
  const input: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
  const phaseTicks = data.rules.run.phaseSeconds * TICKS_PER_SECOND;
  const phaseXp: number[] = [];
  let lowest = 1;
  while (run.state !== "won" && run.state !== "lost") {
    while (phaseXp.length < data.rules.phases.length && run.tick >= phaseXp.length * phaseTicks) {
      phaseXp.push(run.stats.xpGained);
    }
    if (idle) idleInput(run, input);
    else botInput(run, input);
    run.step(input);
    lowest = Math.min(lowest, run.hero.hp / run.hero.stats.maxHp);
  }
  return {
    hero: data.heroes[run.heroIndex].id,
    seed,
    result: run.result ?? "won",
    seconds: Math.floor(run.tick / TICKS_PER_SECOND),
    kills: run.stats.kills,
    spawned: run.stats.spawned,
    level: run.hero.level,
    castleHp: Math.max(0, Math.round(run.castle.hp)),
    castleMaxHp: Math.round(run.castle.maxHp),
    castleHpPercent: Math.max(0, Math.round((run.castle.hp / run.castle.maxHp) * 100)),
    heroHp: Math.max(0, Math.round(run.hero.hp)),
    heroMaxHp: Math.round(run.hero.stats.maxHp),
    minHeroHpPercent: Math.max(0, Math.round(lowest * 100)),
    bosses: run.bossLog.slice(0, run.bossLogCount).map((boss) => ({
      id: data.enemies[boss.type].id,
      spawnSeconds: Math.floor(boss.spawnTick / TICKS_PER_SECOND),
      killSeconds: boss.deathTick < 0 ? null : Math.floor(boss.deathTick / TICKS_PER_SECOND),
    })),
    enraged: run.enraged,
    phaseXp,
  };
}

export function formatSummary(s: RunSummary): string {
  const m = Math.floor(s.seconds / 60);
  const sec = String(s.seconds % 60).padStart(2, "0");
  const outcome = s.result === "won" ? "won" : `lost (${s.result})`;
  const bosses = s.bosses
    .map((b) => `${b.id} ${b.killSeconds === null ? "alive" : `${b.killSeconds - b.spawnSeconds} s`}`)
    .join(", ");
  return (
    `${s.hero} seed ${s.seed}: ${outcome} at ${m}:${sec}, kills ${s.kills}, spawned ${s.spawned}, level ${s.level}, ` +
    `castle ${s.castleHpPercent}%, hero ${s.heroHp}/${s.heroMaxHp}, hero low ${s.minHeroHpPercent}%` +
    (bosses ? `, bosses: ${bosses}` : "") +
    (s.enraged ? ", enraged" : "")
  );
}

const WINDOW_MINUTES = 2;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Losses per two-minute window, from the first window with a loss to the last: `4-6: 1, 6-8: 0`. */
export function lossWindows(summaries: RunSummary[]): string {
  const windows = summaries.filter((s) => s.result !== "won").map((s) => Math.floor(s.seconds / (WINDOW_MINUTES * 60)));
  if (windows.length === 0) return "none";
  const parts: string[] = [];
  for (let w = Math.min(...windows); w <= Math.max(...windows); w++) {
    parts.push(`${w * WINDOW_MINUTES}-${(w + 1) * WINDOW_MINUTES}: ${windows.filter((x) => x === w).length}`);
  }
  return parts.join(", ");
}

/**
 * Average XP at the start of each phase as a YAML list for `rules.debug.phaseXp`. A phase no run reached takes
 * the value of the phase before, so the list has `phases` values and never falls.
 */
export function phaseXpLine(summaries: RunSummary[], phases: number): string {
  const values: number[] = [];
  for (let p = 0; p < phases; p++) {
    const reached = summaries.filter((s) => s.phaseXp.length > p).map((s) => s.phaseXp[p]);
    const average = reached.length > 0 ? Math.round(reached.reduce((a, b) => a + b, 0) / reached.length) : 0;
    values.push(Math.max(average, values[p - 1] ?? 0));
  }
  return `[${values.join(", ")}]`;
}

/** The summary lines of one hero: results, then bosses and where the losses fall. */
export function formatHeroSummary(hero: string, summaries: RunSummary[], idle: boolean, finalBoss: string): string {
  const won = summaries.filter((s) => s.result === "won").length;
  const avg = (f: (s: RunSummary) => number) => summaries.reduce((a, s) => a + f(s), 0) / summaries.length;
  const inDanger = summaries.filter((s) => s.minHeroHpPercent < DANGER_PERCENT).length;
  const wonRuns = summaries.filter((s) => s.result === "won");
  const castleOfWon = wonRuns.length > 0 ? `${Math.round(wonRuns.reduce((a, s) => a + s.castleHpPercent, 0) / wonRuns.length)}%` : "-";
  const longest = Math.max(...summaries.map((s) => s.seconds));
  const head =
    `${hero}${idle ? " (idle)" : ""}: ${summaries.length} runs: ${won} won, ${summaries.length - won} lost; ` +
    `kills avg ${Math.round(avg((s) => s.kills))}, spawned avg ${Math.round(avg((s) => s.spawned))}; ` +
    `level avg ${avg((s) => s.level).toFixed(1)}; hero below ${DANGER_PERCENT}% in ${inDanger}; ` +
    `castle of won runs avg ${castleOfWon}; longest ${Math.floor(longest / 60)}:${String(longest % 60).padStart(2, "0")}`;

  const ids: string[] = [];
  for (const s of summaries) for (const b of s.bosses) if (b.id !== finalBoss && !ids.includes(b.id)) ids.push(b.id);
  const kills = ids.map((id) => {
    const met = summaries.flatMap((s) => s.bosses.filter((b) => b.id === id));
    const times = met.filter((b) => b.killSeconds !== null).map((b) => b.killSeconds! - b.spawnSeconds);
    return `${id} ${times.length > 0 ? `${median(times)} s` : "-"} (${times.length} of ${met.length})`;
  });
  const fights = wonRuns.flatMap((s) => s.bosses.filter((b) => b.id === finalBoss && b.killSeconds !== null))
    .map((b) => b.killSeconds! - b.spawnSeconds);
  const tail =
    `  boss kill median: ${kills.length > 0 ? kills.join(", ") : "-"}; ` +
    `final boss fight median ${fights.length > 0 ? `${median(fights)} s` : "-"}; ` +
    `enraged in ${summaries.filter((s) => s.enraged).length}; losses by minutes: ${lossWindows(summaries)}`;
  return `${head}\n${tail}`;
}

/** Below this share of max hp the hero counts as in danger (tuning target). */
const DANGER_PERCENT = 50;

interface Args {
  hero: string;
  seed: number;
  runs: number;
  duration?: number;
  idle: boolean;
  /** Start every run at this phase (`RunOptions.startPhase`). */
  phase?: number;
  /** Print the average XP at the start of each phase over all runs. */
  phaseXp: boolean;
}

const SWITCHES = new Set(["--idle", "--phase-xp"]);

export function parseArgs(argv: string[]): Args {
  const out: Args = { hero: "all", seed: 1, runs: 1, idle: false, phaseXp: false };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (SWITCHES.has(flag)) {
      // a switch with no value
      if (flag === "--idle") out.idle = true;
      else out.phaseXp = true;
      i--;
      continue;
    }
    const raw = argv[i + 1];
    if (flag === "--hero") {
      if (!raw) throw new Error("sim:run: --hero needs a hero id or all");
      out.hero = raw;
      continue;
    }
    if (flag === "--seeds") {
      const match = /^(\d+)-(\d+)$/.exec(raw ?? "");
      if (!match || Number(match[2]) < Number(match[1])) throw new Error("sim:run: --seeds needs a range like 1-20");
      out.seed = Number(match[1]);
      out.runs = Number(match[2]) - Number(match[1]) + 1;
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`sim:run: bad value for ${flag}`);
    if (flag === "--seed") out.seed = value;
    else if (flag === "--runs") out.runs = value;
    else if (flag === "--duration") out.duration = value;
    else if (flag === "--phase") out.phase = value;
    else throw new Error(`sim:run: unknown option ${flag}`);
  }
  return out;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const data = gameData();
  const ids = args.hero === "all" ? data.heroes.map((h) => h.id) : [args.hero];
  const all: RunSummary[] = [];
  for (const hero of ids) {
    const summaries: RunSummary[] = [];
    for (let i = 0; i < args.runs; i++) {
      const s = playBot(data, args.seed + i, args.duration, hero, args.idle, args.phase);
      summaries.push(s);
      console.log(formatSummary(s));
    }
    all.push(...summaries);
    console.log(formatHeroSummary(hero, summaries, args.idle, data.rules.run.finale.boss));
  }
  if (args.phaseXp) console.log(`phaseXp: ${phaseXpLine(all, data.rules.phases.length)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
