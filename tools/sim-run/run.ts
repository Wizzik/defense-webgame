import { pathToFileURL } from "node:url";
import { botInput, idleCard } from "../../sim/bot";
import { TICKS_PER_SECOND } from "../../sim/constants";
import { createRun, EventKind, HeroHitSource, inThicket, isEmptySlot, passiveSlotRange, sharedSlotRange } from "../../sim/index";
import type { LoadoutEntry, Run, RunResult } from "../../sim/index";
import type { TickInput } from "../../sim/input";
import { gameData } from "../../sim/testing/game-data";
import { DIFFICULTY_IDS, type DifficultyId, type GameData } from "../../data/schema";
import { attackHit, BURST_PHASES, burstLine, spellBurst } from "./burst";
import { GEAR_PRESETS, type GearPresetName, gearPreset } from "./gear-presets";

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
  /** Shared spells (slots 4-5) the hero had at the end, in slot order. */
  sharedSpells: string[];
  /** Passives (slots 6-9) the hero had at the end, in slot order. */
  passives: string[];
  /** Phase (1-based; one past the last for the finale) in which every slot first stood at its top level, or null. */
  fullKitPhase: number | null;
  /** XP gained up to the start of each phase the run reached (index 0 is phase 1). */
  phaseXp: number[];
  /** Chests opened. */
  chests: number;
  /** Gold gained in the run. */
  gold: number;
  /** One cast of the strongest signature spell at the start of each of `BURST_PHASES` (null: not reached). */
  burst: (number | null)[];
  /** The average base attack hit at the start of each of `BURST_PHASES` (null: not reached). */
  attack: (number | null)[];
  /** Hearts and orbs picked up and hp healed by each source of sustain (spec 2026-11-19 sustain). */
  sustain: SustainStats;
  /** Enemy factions (spec 2026-11-20): seconds the hero was rooted, hp it lost in poison clouds, enemies raised. */
  factions: { rootedSeconds: number; cloudDamage: number; raised: number };
  /**
   * The world (difficulties plans 2 and 3a): islands of the map, storm waves and bolts, bolts that hit the hero; the
   * kind of the natural event, sandstorms started (weather worlds) and the share of the hero's steps in a thicket.
   */
  world: {
    islands: number; waves: number; bolts: number; boltHits: number;
    kind?: "storm" | "weather" | "thicket"; sand?: number; thicketShare?: number;
  };
}

export interface SustainStats {
  hearts: number;
  orbsBoots: number;
  orbsBerserk: number;
  orbsHeal: number;
  healedLifesteal: number;
  healedHearts: number;
  healedOrb: number;
}

/** A player who does nothing: no movement, no action; at a level-up the attribute card, else the weakest card (idleCard). */
export function idleInput(run: Run, out: TickInput): TickInput {
  out.moveX = 0;
  out.moveY = 0;
  out.actions = 0;
  out.card = run.offer ? idleCard(run, run.offer) : run.chestOffer ? 0 : -1;
  return out;
}

/** Plays one run with the autopilot, or with no input at all when `idle` is set. */
export function playBot(
  data: GameData, seed: number, durationSeconds?: number, hero?: string, idle = false, startPhase?: number,
  loadout: readonly LoadoutEntry[] = [], world = 1, difficulty: DifficultyId = "normal",
): RunSummary {
  const run = createRun(data, { seed, durationSeconds, hero, startPhase, loadout, world, difficulty });
  const input: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
  const phaseTicks = data.rules.run.phaseSeconds * TICKS_PER_SECOND;
  const phaseXp: number[] = [];
  const burst: (number | null)[] = BURST_PHASES.map(() => null);
  const attack: (number | null)[] = BURST_PHASES.map(() => null);
  let lowest = 1;
  let fullKitPhase: number | null = null;
  let boltHits = 0;
  let thicketSteps = 0;
  let steps = 0;
  while (run.state !== "won" && run.state !== "lost") {
    while (phaseXp.length < data.rules.phases.length && run.tick >= phaseXp.length * phaseTicks) {
      phaseXp.push(run.stats.xpGained);
    }
    for (let k = 0; k < BURST_PHASES.length; k++) {
      if (burst[k] === null && run.tick >= (BURST_PHASES[k] - 1) * phaseTicks) {
        burst[k] = spellBurst(run);
        attack[k] = attackHit(run);
      }
    }
    if (idle) idleInput(run, input);
    else botInput(run, input);
    run.step(input);
    steps++;
    if (inThicket(run.map, run.hero.x, run.hero.y)) thicketSteps++;
    for (let i = 0; i < run.events.count; i++) {
      if (run.events.kind[i] === EventKind.HeroHit && run.events.u[i] === HeroHitSource.Storm) boltHits++;
    }
    lowest = Math.min(lowest, run.hero.hp / run.hero.stats.maxHp);
    if (fullKitPhase === null && run.abilities.every((slot) => !isEmptySlot(slot) && slot.level >= slot.def.levels)) {
      fullKitPhase = Math.min(Math.floor(run.tick / phaseTicks) + 1, data.rules.phases.length + 1);
    }
  }
  const [sharedFirst, sharedEnd] = sharedSlotRange(run);
  const [passiveFirst, passiveEnd] = passiveSlotRange(run);
  const learned = (first: number, end: number) =>
    run.abilities.slice(first, end).filter((slot) => !isEmptySlot(slot)).map((slot) => slot.def.id);
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
    sharedSpells: learned(sharedFirst, sharedEnd),
    passives: learned(passiveFirst, passiveEnd),
    fullKitPhase,
    phaseXp,
    chests: run.chestsOpened,
    gold: run.stats.goldGained,
    burst,
    attack,
    sustain: {
      hearts: run.stats.hearts,
      orbsBoots: run.stats.orbsBoots,
      orbsBerserk: run.stats.orbsBerserk,
      orbsHeal: run.stats.orbsHeal,
      healedLifesteal: run.stats.healedLifesteal,
      healedHearts: run.stats.healedHearts,
      healedOrb: run.stats.healedOrb,
    },
    world: {
      islands: run.map.islandCount, waves: run.hazard.waves, bolts: run.hazard.bolts, boltHits,
      kind: data.worlds[world - 1]!.hazard.kind,
      sand: data.worlds[world - 1]!.hazard.kind === "weather" ? run.hazard.waves : 0,
      thicketShare: steps > 0 ? thicketSteps / steps : 0,
    },
    factions: {
      rootedSeconds: run.stats.rootedTicks / TICKS_PER_SECOND,
      cloudDamage: run.stats.cloudDamage,
      raised: run.stats.raised,
    },
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
    `castle ${s.castleHpPercent}%, hero ${s.heroHp}/${s.heroMaxHp}, hero low ${s.minHeroHpPercent}%, chests ${s.chests}, gold ${s.gold}` +
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
export function formatHeroSummary(
  hero: string, summaries: RunSummary[], idle: boolean, finalBoss: string, data: GameData = gameData(),
): string {
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
  const wonChests = wonRuns.length > 0 ? (wonRuns.reduce((a, s) => a + s.chests, 0) / wonRuns.length).toFixed(1) : "-";
  const gear = `  chests avg ${avg((s) => s.chests).toFixed(1)} (won runs ${wonChests}), gold avg ${Math.round(avg((s) => s.gold))}`;
  return `${head}\n${tail}\n${gear}\n${kitLine(summaries)}\n${burstLine(summaries, data)}\n${sustainLine(summaries)}\n${factionLine(summaries)}\n${worldLine(summaries)}`;
}

/** Hearts, orbs by kind and hp healed by lifesteal, hearts and the heal orb: averages per run. */
export function sustainLine(summaries: RunSummary[]): string {
  const avg = (f: (s: SustainStats) => number) => summaries.reduce((a, s) => a + f(s.sustain), 0) / summaries.length;
  const one = (f: (s: SustainStats) => number) => avg(f).toFixed(1);
  const whole = (f: (s: SustainStats) => number) => String(Math.round(avg(f)));
  return `  sustain: hearts ${one((s) => s.hearts)}, ` +
    `orbs boots ${one((s) => s.orbsBoots)} berserk ${one((s) => s.orbsBerserk)} heal ${one((s) => s.orbsHeal)}, ` +
    `healed lifesteal ${whole((s) => s.healedLifesteal)} hearts ${whole((s) => s.healedHearts)} orb ${whole((s) => s.healedOrb)}`;
}

/** Average per run of the faction mechanics on the hero: `  factions: rooted 3.6 s, cloud hp 900, raised 11.5`. */
export function factionLine(summaries: RunSummary[]): string {
  const avg = (f: (s: RunSummary["factions"]) => number) => summaries.reduce((a, s) => a + f(s.factions), 0) / summaries.length;
  return `  factions: rooted ${avg((f) => f.rootedSeconds).toFixed(1)} s, cloud hp ${Math.round(avg((f) => f.cloudDamage))}, ` +
    `raised ${avg((f) => f.raised).toFixed(1)}`;
}

/**
 * Averages per run of the world: `  world: islands 35.5, storm waves 21.0, bolts 42.5, bolts on the hero 3.5`, with
 * `, sand 2.0` in a weather world and `, thicket 4.2 %` (the hero's steps in a thicket) in a thicket world.
 */
export function worldLine(summaries: RunSummary[]): string {
  const avg = (f: (s: RunSummary["world"]) => number) => (summaries.reduce((a, s) => a + f(s.world), 0) / summaries.length).toFixed(1);
  let line = `  world: islands ${avg((w) => w.islands)}, storm waves ${avg((w) => w.waves)}, bolts ${avg((w) => w.bolts)}, ` +
    `bolts on the hero ${avg((w) => w.boltHits)}`;
  if (summaries.some((s) => s.world.kind === "weather")) line += `, sand ${avg((w) => w.sand ?? 0)}`;
  if (summaries.some((s) => s.world.kind === "thicket")) line += `, thicket ${avg((w) => 100 * (w.thicketShare ?? 0))} %`;
  return line;
}

/** How often each id appears, most first (ties by id): `meteor 7, smite 5`, or `-`. */
function counts(lists: string[][]): string {
  const n = new Map<string, number>();
  for (const list of lists) for (const id of list) n.set(id, (n.get(id) ?? 0) + 1);
  const rows = [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return rows.length > 0 ? rows.map(([id, k]) => `${id} ${k}`).join(", ") : "-";
}

/** What the autopilot took and when its whole kit stood at the top level. */
export function kitLine(summaries: RunSummary[]): string {
  const full = summaries.filter((s) => s.fullKitPhase !== null).map((s) => s.fullKitPhase!);
  return (
    `  shared spells: ${counts(summaries.map((s) => s.sharedSpells))}; passives: ${counts(summaries.map((s) => s.passives))}; ` +
    `full kit median phase ${full.length > 0 ? median(full) : "-"} (${full.length} of ${summaries.length})`
  );
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
  /** The loadout every hero wears (tools/sim-run/gear-presets.ts). */
  gear: GearPresetName;
  /** Worlds and difficulties to play; every combination is played (`--world`, `--difficulty`). */
  worlds: number[];
  difficulties: DifficultyId[];
}

const SWITCHES = new Set(["--idle", "--phase-xp"]);

export function parseArgs(argv: string[], worldCount = gameData().worlds.length): Args {
  const out: Args = {
    hero: "all", seed: 1, runs: 1, idle: false, phaseXp: false, gear: "none", worlds: [1], difficulties: ["normal"],
  };
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
    if (flag === "--gear") {
      if (!(GEAR_PRESETS as readonly string[]).includes(raw ?? "")) throw new Error("sim:run: --gear needs none, mid or full");
      out.gear = raw as GearPresetName;
      continue;
    }
    if (flag === "--world") {
      const n = Number(raw);
      if (raw === "all") out.worlds = Array.from({ length: worldCount }, (_, k) => k + 1);
      else if (Number.isInteger(n) && n >= 1 && n <= worldCount) out.worlds = [n];
      else throw new Error(`sim:run: --world needs a world from 1 to ${worldCount} or all`);
      continue;
    }
    if (flag === "--difficulty") {
      if (raw === "all") out.difficulties = [...DIFFICULTY_IDS];
      else if ((DIFFICULTY_IDS as readonly string[]).includes(raw ?? "")) out.difficulties = [raw as DifficultyId];
      else throw new Error("sim:run: --difficulty needs normal, insane, hell or all");
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
  const several = args.worlds.length * args.difficulties.length > 1;
  for (const world of args.worlds) {
    for (const difficulty of args.difficulties) {
      if (several) console.log(`== world ${world} ${data.worlds[world - 1]!.id} / ${difficulty} ==`);
      const all: RunSummary[] = [];
      for (const hero of ids) {
        const summaries: RunSummary[] = [];
        for (let i = 0; i < args.runs; i++) {
          const s = playBot(
            data, args.seed + i, args.duration, hero, args.idle, args.phase, gearPreset(data, hero, args.gear), world, difficulty,
          );
          summaries.push(s);
          console.log(formatSummary(s));
        }
        all.push(...summaries);
        console.log(formatHeroSummary(hero, summaries, args.idle, data.rules.run.finale.boss, data));
      }
      if (args.phaseXp) console.log(`phaseXp: ${phaseXpLine(all, data.rules.phases.length)}`);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
