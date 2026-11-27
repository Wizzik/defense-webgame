import { METER_ATTACK, METER_ITEM, METER_SOURCES, METER_THORNS, type PlayerState, TICKS_PER_SECOND } from "../../sim";
import { type Lang, t } from "./i18n";

/** One bar of the damage meter. */
export interface MeterRow {
  /** Meter source: ability slot 0-9, or METER_ATTACK, METER_ITEM, METER_THORNS. */
  source: number;
  /** Ability id of a slot source, "" for the others. */
  ability: string;
  name: string;
  damage: number;
  /** Share of the player's whole damage, 0-1. */
  share: number;
  /** Damage per second over the run so far. */
  dps: number;
  hits: number;
  top: number;
  kills: number;
}

export interface MeterLines {
  rows: MeterRow[];
  total: number;
  dps: number;
}

function sourceName(lang: Lang, player: PlayerState, source: number): string {
  if (source === METER_ATTACK) return t(lang, "meter.attack");
  if (source === METER_ITEM) return t(lang, "meter.item");
  if (source === METER_THORNS) return t(lang, "meter.thorns");
  return player.abilities[source]?.def.name[lang] ?? "?";
}

/**
 * The damage meter of one player (sim/damage-meter.ts) as bars, the biggest first (ties: the lower source), sources
 * without damage left out. `ticks`: how long the run has gone, for the damage per second.
 */
export function meterLines(lang: Lang, player: PlayerState, ticks: number): MeterLines {
  const { meter } = player;
  const total = meter.total();
  const seconds = Math.max(1, ticks / TICKS_PER_SECOND);
  const rows: MeterRow[] = [];
  for (let source = 0; source < METER_SOURCES; source++) {
    const damage = meter.damage[source]!;
    if (damage <= 0) continue;
    rows.push({
      source, ability: source < METER_ATTACK ? (player.abilities[source]?.def.id ?? "") : "",
      name: sourceName(lang, player, source), damage, share: total > 0 ? damage / total : 0, dps: damage / seconds,
      hits: meter.hits[source]!, top: meter.top[source]!, kills: meter.kills[source]!,
    });
  }
  rows.sort((a, b) => b.damage - a.damage || a.source - b.source);
  return { rows, total, dps: total / seconds };
}

/** "950", "12.3k", "1.25M": short numbers for the bars. */
export function shortNumber(value: number): string {
  if (value < 1000) return String(Math.round(value));
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 2 : 1)}k`;
  return `${(value / 1_000_000).toFixed(2)}M`;
}
