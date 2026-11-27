// npm run sim:chests: how much stronger a hero without permanent gear gets from a fixed number of chests,
// picked by the autopilot, measured outside a run over many seeds (docs/DECISIONS.md, section Chest loot).
import { pathToFileURL } from "node:url";
import type { GameData, Rarity } from "../../data/schema";
import { RARITIES } from "../../data/schema";
import { botChestChoice, botChestKeep } from "../../sim/bot";
import { applyChestCard, rollChestOffer } from "../../sim/chests";
import { createRun, gainXp, wornRarity, xpToNext } from "../../sim/index";
import type { HeroStats } from "../../sim/index";
import { gameData } from "../../sim/testing/game-data";

export interface ChestPower {
  /** After / before: max hp, base attack damage per second, spell power over the cooldown scale. */
  hp: number;
  attack: number;
  spells: number;
  /** How many picks were of each kind: a new item, a taken Choice, a level (also a kept Choice). */
  picks: Record<"new" | "replace" | "level", number>;
  /** Rarities of the items the picks left in their slots. */
  rarities: Record<Rarity, number>;
}

/** Output columns by `ChestAction` (New, Choice, Level); a taken Choice counts as "replace", a kept one as "level". */
const ACTION_NAMES = ["new", "replace", "level"] as const;

function attackPerSecond(stats: HeroStats): number {
  return (stats.damageMin + stats.damageMax) / 2 / stats.attackIntervalSeconds;
}

function spellStrength(stats: HeroStats): number {
  return stats.spellPower / stats.cooldownScale;
}

/** A hero at `level` (XP only, no cards) opens `chests` chests and the autopilot picks a card of each. */
export function chestPower(data: GameData, heroId: string, seed: number, options: { chests: number; level: number }): ChestPower {
  const run = createRun(data, { seed, hero: heroId, durationSeconds: 100000 });
  let xp = 0;
  for (let level = 1; level < options.level; level++) xp += xpToNext(data.rules, level);
  gainXp(run, xp);
  const before = { ...run.hero.stats };
  const picks = { new: 0, replace: 0, level: 0 };
  const rarities = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
  for (let i = 0; i < options.chests; i++) {
    run.chestOffer = rollChestOffer(run);
    const card = run.chestOffer.cards[botChestChoice(run)]!;
    const keep = botChestKeep(run, card);
    picks[keep ? "level" : ACTION_NAMES[card.action]]++;
    applyChestCard(run, card, keep);
    rarities[RARITIES[wornRarity(data, run.gear, card.slot)]!]++;
    run.chestOffer = null;
  }
  const after = run.hero.stats;
  return {
    hp: after.maxHp / before.maxHp,
    attack: attackPerSecond(after) / attackPerSecond(before),
    spells: spellStrength(after) / spellStrength(before),
    picks,
    rarities,
  };
}

const mean = (values: number[]): number => values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length);
const x = (value: number): string => `x${value.toFixed(2)}`;

/** One line of averages for a hero (or "all"): the three ratios, their mean, the picks and the rarities. */
export function formatChestPower(heroId: string, rows: ChestPower[]): string {
  const hp = mean(rows.map((r) => r.hp));
  const attack = mean(rows.map((r) => r.attack));
  const spells = mean(rows.map((r) => r.spells));
  const n = Math.max(1, rows.length);
  const picks = ACTION_NAMES.map((a) => `${a} ${(rows.reduce((s, r) => s + r.picks[a], 0) / n).toFixed(1)}`).join(", ");
  const rarities = RARITIES.map((r) => `${r} ${(rows.reduce((s, row) => s + row.rarities[r], 0) / n).toFixed(1)}`).join(", ");
  return `${heroId}: hp ${x(hp)}, attack ${x(attack)}, spells ${x(spells)}, mean ${x((hp + attack + spells) / 3)}` +
    ` | picks ${picks} | rarities ${rarities}`;
}

export interface ChestArgs {
  from: number;
  to: number;
  chests: number;
  level: number;
  hero: string;
}

export function parseChestArgs(argv: string[]): ChestArgs {
  const out: ChestArgs = { from: 1, to: 200, chests: 15, level: 25, hero: "all" };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const raw = argv[i + 1] ?? "";
    if (flag === "--seeds") {
      const match = /^(\d+)-(\d+)$/.exec(raw);
      if (!match || Number(match[2]) < Number(match[1])) throw new Error("sim:chests: --seeds needs a range like 1-200");
      out.from = Number(match[1]);
      out.to = Number(match[2]);
    } else if (flag === "--hero") {
      if (!raw) throw new Error("sim:chests: --hero needs a hero id or all");
      out.hero = raw;
    } else if (flag === "--chests" || flag === "--level") {
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 0) throw new Error(`sim:chests: bad value for ${flag}`);
      if (flag === "--chests") out.chests = value;
      else out.level = Math.max(1, value);
    } else {
      throw new Error(`sim:chests: unknown option ${flag}`);
    }
  }
  return out;
}

function main(): void {
  const args = parseChestArgs(process.argv.slice(2));
  const data = gameData();
  const ids = args.hero === "all" ? data.heroes.map((h) => h.id) : [args.hero];
  const all: ChestPower[] = [];
  for (const hero of ids) {
    const rows: ChestPower[] = [];
    for (let seed = args.from; seed <= args.to; seed++) rows.push(chestPower(data, hero, seed, args));
    all.push(...rows);
    console.log(formatChestPower(hero, rows));
  }
  if (ids.length > 1) console.log(formatChestPower("all", all));
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) main();
