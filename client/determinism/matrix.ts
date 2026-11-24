// Determinism matrix (spec 2026-11-20 multiplayer spike, 5.2): a fixed set of autopilot runs whose state hashes
// must match in Node and in every browser engine. Pure: no DOM and no timers, so Node and the page share it.
import type { DifficultyId, GameData } from "../../data/schema";
import { botInput, createRun, idleCard, stateHash, type Run, type RunState, type TickInput } from "../../sim";
import { gearPreset } from "../../tools/sim-run/gear-presets";

export interface MatrixCase {
  id: string;
  hero: string;
  seed: number;
  startPhase?: number;
  durationSeconds?: number;
  gear: "none" | "mid" | "full";
  maxTicks: number;
  /** No movement and the idle card pick instead of the autopilot (tests only). */
  idle?: boolean;
  /** Defaults: world 1, normal. */
  world?: number;
  difficulty?: DifficultyId;
}

export interface CaseResult {
  id: string;
  ticks: number;
  state: RunState;
  checkpoints: number[];
}

export const CHECKPOINT_EVERY = 300;

/**
 * The cases of spec 5.2: every hero from phase 1, then four late starts with full gear; then a world 3 insane run
 * and a world 5 hell start at phase 6 (difficulties spec 2026-11-21 4.9), a world 1 run through the storm, a world 2
 * run through a sandstorm and a world 3 run in the thicket.
 */
export function matrixCases(data: GameData): MatrixCase[] {
  const cases: MatrixCase[] = data.heroes.map((h) => ({
    id: `h-${h.id}`, hero: h.id, seed: 1, durationSeconds: 300, gear: "none", maxTicks: 12_000,
  }));
  cases.push(
    { id: "p6", hero: "nightglaive", seed: 2, startPhase: 6, gear: "full", maxTicks: 6000 },
    { id: "p11", hero: "gravecaller", seed: 3, startPhase: 11, gear: "full", maxTicks: 6000 },
    { id: "p16", hero: "tidecaller", seed: 4, startPhase: 16, gear: "full", maxTicks: 6000 },
    { id: "p21", hero: "sparkshot", seed: 5, startPhase: 21, gear: "full", maxTicks: 6000 },
    { id: "w3-insane", hero: "stonehorn", seed: 6, durationSeconds: 300, gear: "none", maxTicks: 9000, world: 3, difficulty: "insane" },
    { id: "w5-hell", hero: "redcleaver", seed: 7, startPhase: 6, gear: "full", maxTicks: 6000, world: 5, difficulty: "hell" },
    // obstacles and the summer storm from its first wave (difficulties plan 2)
    { id: "w1-storm", hero: "sparkshot", seed: 9, startPhase: 3, gear: "none", maxTicks: 4500 },
    // the sandstorm through a whole storm, and the thicket (difficulties plan 3a)
    { id: "w2-sand", hero: "mistwarden", seed: 11, startPhase: 4, gear: "none", maxTicks: 6000, world: 2 },
    { id: "w3-thicket", hero: "stonehorn", seed: 13, startPhase: 2, gear: "mid", maxTicks: 4500, world: 3 },
    // the blizzard through a whole storm, with chill (difficulties plan 3b)
    { id: "w4-blizzard", hero: "tidecaller", seed: 15, startPhase: 3, gear: "mid", maxTicks: 6000, world: 4 },
    // green meteors and their pools of fire from phase 1 (difficulties plan 3b)
    { id: "w5-meteors", hero: "gravecaller", seed: 17, startPhase: 1, gear: "mid", maxTicks: 3600, world: 5 },
  );
  return cases;
}

function idleInput(run: Run, out: TickInput): TickInput {
  out.moveX = 0;
  out.moveY = 0;
  out.actions = 0;
  out.card = run.offer ? idleCard(run, run.offer) : run.chestOffer ? 0 : -1;
  return out;
}

/**
 * Plays one case; a checkpoint is the state hash after every `every`-th step and after the last step. `onStep`
 * (tests) sees the run after each step.
 */
export function runCase(
  data: GameData, c: MatrixCase, every = CHECKPOINT_EVERY, onStep?: (run: Run) => void,
): CaseResult {
  const loadout = c.gear === "none" ? [] : gearPreset(data, c.hero, c.gear);
  const run = createRun(data, {
    seed: c.seed, hero: c.hero, startPhase: c.startPhase, durationSeconds: c.durationSeconds, loadout,
    world: c.world, difficulty: c.difficulty,
  });
  const input: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
  const checkpoints: number[] = [];
  let ticks = 0;
  while (ticks < c.maxTicks && run.state !== "won" && run.state !== "lost") {
    if (c.idle) idleInput(run, input);
    else botInput(run, input);
    run.step(input);
    onStep?.(run);
    ticks++;
    if (ticks % every === 0) checkpoints.push(stateHash(run));
  }
  if (ticks % every !== 0) checkpoints.push(stateHash(run));
  return { id: c.id, ticks, state: run.state, checkpoints };
}

/** FNV-1a (32 bit) over every checkpoint of every case in order, as 8 lowercase hex digits. */
export function matrixDigest(results: readonly CaseResult[]): string {
  let h = 2166136261;
  for (const r of results) {
    for (const cp of r.checkpoints) h = Math.imul(h ^ (cp >>> 0), 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** The first case and checkpoint index where `b` differs from the reference `a`, or null when they match. */
export function firstDifference(
  a: readonly CaseResult[], b: readonly CaseResult[],
): { id: string; index: number } | null {
  for (let i = 0; i < a.length; i++) {
    const ra = a[i]!;
    const rb = b[i];
    if (rb === undefined || rb.id !== ra.id) return { id: ra.id, index: 0 };
    const n = Math.max(ra.checkpoints.length, rb.checkpoints.length);
    for (let k = 0; k < n; k++) {
      if (ra.checkpoints[k] !== rb.checkpoints[k]) return { id: ra.id, index: k };
    }
  }
  return null;
}
