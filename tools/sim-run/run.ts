import { pathToFileURL } from "node:url";
import { botInput } from "../../sim/bot";
import { TICKS_PER_SECOND } from "../../sim/constants";
import { createRun } from "../../sim/index";
import type { RunResult } from "../../sim/index";
import type { TickInput } from "../../sim/input";
import { gameData } from "../../sim/testing/game-data";
import type { GameData } from "../../data/schema";

export interface RunSummary {
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
}

export function playBot(data: GameData, seed: number, durationSeconds?: number): RunSummary {
  const run = createRun(data, { seed, durationSeconds });
  const input: TickInput = { moveX: 0, moveY: 0, card: -1 };
  while (run.state !== "won" && run.state !== "lost") {
    botInput(run, input);
    run.step(input);
  }
  return {
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
  };
}

export function formatSummary(s: RunSummary): string {
  const m = Math.floor(s.seconds / 60);
  const sec = String(s.seconds % 60).padStart(2, "0");
  const outcome = s.result === "won" ? "won" : `lost (${s.result})`;
  return (
    `seed ${s.seed}: ${outcome} at ${m}:${sec}, kills ${s.kills}, spawned ${s.spawned}, level ${s.level}, ` +
    `castle ${s.castleHp}/${s.castleMaxHp}, hero ${s.heroHp}/${s.heroMaxHp}`
  );
}

function parseArgs(argv: string[]): { seed: number; runs: number; duration?: number } {
  const out: { seed: number; runs: number; duration?: number } = { seed: 1, runs: 1 };
  for (let i = 0; i < argv.length; i += 2) {
    const value = Number(argv[i + 1]);
    if (!Number.isFinite(value)) throw new Error(`sim:run: bad value for ${argv[i]}`);
    if (argv[i] === "--seed") out.seed = value;
    else if (argv[i] === "--runs") out.runs = value;
    else if (argv[i] === "--duration") out.duration = value;
    else throw new Error(`sim:run: unknown option ${argv[i]}`);
  }
  return out;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const summaries: RunSummary[] = [];
  for (let i = 0; i < args.runs; i++) {
    const s = playBot(gameData(), args.seed + i, args.duration);
    summaries.push(s);
    console.log(formatSummary(s));
  }
  const won = summaries.filter((s) => s.result === "won").length;
  const avg = (f: (s: RunSummary) => number) =>
    summaries.reduce((a, s) => a + f(s), 0) / summaries.length;
  console.log(
    `${summaries.length} runs: ${won} won, ${summaries.length - won} lost; ` +
      `kills avg ${Math.round(avg((s) => s.kills))}, spawned avg ${Math.round(avg((s) => s.spawned))}; level avg ${avg((s) => s.level).toFixed(1)}`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
