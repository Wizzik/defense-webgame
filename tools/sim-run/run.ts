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
  heroHp: number;
  heroMaxHp: number;
  /** Lowest hero hp / max hp seen during the run, in whole percent. */
  minHeroHpPercent: number;
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
  data: GameData, seed: number, durationSeconds?: number, hero?: string, idle = false,
): RunSummary {
  const run = createRun(data, { seed, durationSeconds, hero });
  const input: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
  let lowest = 1;
  while (run.state !== "won" && run.state !== "lost") {
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
    heroHp: Math.max(0, Math.round(run.hero.hp)),
    heroMaxHp: Math.round(run.hero.stats.maxHp),
    minHeroHpPercent: Math.max(0, Math.round(lowest * 100)),
  };
}

export function formatSummary(s: RunSummary): string {
  const m = Math.floor(s.seconds / 60);
  const sec = String(s.seconds % 60).padStart(2, "0");
  const outcome = s.result === "won" ? "won" : `lost (${s.result})`;
  return (
    `${s.hero} seed ${s.seed}: ${outcome} at ${m}:${sec}, kills ${s.kills}, spawned ${s.spawned}, level ${s.level}, ` +
    `castle ${s.castleHp}/${s.castleMaxHp}, hero ${s.heroHp}/${s.heroMaxHp}, hero low ${s.minHeroHpPercent}%`
  );
}

/** Below this share of max hp the hero counts as in danger (tuning target). */
const DANGER_PERCENT = 70;

interface Args {
  hero: string;
  seed: number;
  runs: number;
  duration?: number;
  idle: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { hero: "all", seed: 1, runs: 1, idle: false };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (flag === "--idle") {
      // a switch with no value
      out.idle = true;
      i--;
      continue;
    }
    const raw = argv[i + 1];
    if (flag === "--hero") {
      if (!raw) throw new Error("sim:run: --hero needs a hero id or all");
      out.hero = raw;
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`sim:run: bad value for ${flag}`);
    if (flag === "--seed") out.seed = value;
    else if (flag === "--runs") out.runs = value;
    else if (flag === "--duration") out.duration = value;
    else throw new Error(`sim:run: unknown option ${flag}`);
  }
  return out;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const data = gameData();
  const ids = args.hero === "all" ? data.heroes.map((h) => h.id) : [args.hero];
  for (const hero of ids) {
    const summaries: RunSummary[] = [];
    for (let i = 0; i < args.runs; i++) {
      const s = playBot(data, args.seed + i, args.duration, hero, args.idle);
      summaries.push(s);
      console.log(formatSummary(s));
    }
    const won = summaries.filter((s) => s.result === "won").length;
    const avg = (f: (s: RunSummary) => number) =>
      summaries.reduce((a, s) => a + f(s), 0) / summaries.length;
    const inDanger = summaries.filter((s) => s.minHeroHpPercent < DANGER_PERCENT).length;
    console.log(
      `${hero}${args.idle ? " (idle)" : ""}: ${summaries.length} runs: ${won} won, ${summaries.length - won} lost; ` +
        `kills avg ${Math.round(avg((s) => s.kills))}, spawned avg ${Math.round(avg((s) => s.spawned))}; ` +
        `level avg ${avg((s) => s.level).toFixed(1)}; hero below ${DANGER_PERCENT}% in ${inDanger}`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
