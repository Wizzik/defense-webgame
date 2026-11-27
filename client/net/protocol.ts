// Messages between two peers (spec 2026-11-20 multiplayer spike, 5.4). Only inputs, hashes and pings travel;
// the game state never does. Every received message passes `decodeMessage`, which never throws.
import { InputAction, type TickInput } from "../../sim";

/**
 * 2: the game's co-op lobby (`join` and `start`, multiplayer migration step 7); 3: up to 4 players (`room`, `left`,
 * `p`); 5: a worn random item travels with its rows (NetRolled).
 */
export const PROTOCOL_VERSION = 5;
/** The longest blink aim an input may carry (world units from the hero). */
const MAX_AIM = 4000;

/**
 * A worn random item's roll as it travels: [base, rarity, effect, name first, name noun, stats, values, tiers]
 * (indices of the game data, as `RolledItem` of sim/item-roll.ts; client/net/net-gear.ts checks them against it).
 */
export type NetRolled = [number, number, number, number, number, number[], number[], number[]];
/** One worn permanent item as it travels: [slot id, item id, level], and its roll for a random item. */
export type NetGear = [string, string, number] | [string, string, number, NetRolled];
/** The most rows a random item has (sim MAX_ROWS). */
const MAX_NET_ROWS = 5;

/** Difficulty ids that may travel; the game checks them against its data. */
const DIFFICULTIES = ["normal", "insane", "hell"] as const;
export type NetDifficulty = (typeof DIFFICULTIES)[number];

export type NetMessage =
  | { t: "hello"; v: number; seed: number; hero: string }
  /** Guest to host in the game's lobby: his protocol, hero and permanent gear. */
  | { t: "join"; v: number; hero: string; g: NetGear[] }
  /** Host to a guest: the run all start; `heroes[p]` and `g[p]` are player p's (the host is 0), `you` the guest's. */
  | { t: "start"; v: number; seed: number; world: number; d: NetDifficulty; you: number; heroes: string[]; g: NetGear[][] }
  /** Host to every guest when the lobby changes: the heroes in player order and the receiver's number (-1: the room is full). */
  | { t: "room"; v: number; you: number; heroes: string[] }
  /** Host to the other guests: guest `p` left the run. */
  | { t: "left"; p: number }
  /** An input or a hash of player `p` for step `k` (the host sets `p` from the link a guest sent it on). */
  | { t: "in"; k: number; p: number; mx: number; my: number; c: number; a: number; ax?: number; ay?: number }
  | { t: "hash"; k: number; p: number; h: number }
  | { t: "ping"; n: number; at: number }
  | { t: "pong"; n: number; at: number }
  /** Guest to host: his models are loaded and he steps; the host starts stepping too. */
  | { t: "ready" }
  | { t: "bye" };

export type InputNetMessage = Extract<NetMessage, { t: "in" }>;

const MAX_STEP = 1_000_000;
const MAX_HERO_ID = 32;
const MAX_ID = 48;
const MAX_GEAR = 16;
/** The most players of a co-op run (the host and three guests). */
export const MAX_PLAYERS = 4;
const UINT32_MAX = 0xffffffff;

function intIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function id(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

/** A random item's roll of the right shape (whole indices, positive finite values), or null. */
function rolledOf(value: unknown): NetRolled | null {
  if (!Array.isArray(value) || value.length !== 8) return null;
  const [base, rarity, effect, first, noun, stats, values, tiers] = value as unknown[];
  if (!intIn(base, 0, 9999) || !intIn(rarity, 0, 9) || !intIn(effect, -1, 999) || !intIn(first, -1, 9999) || !intIn(noun, -1, 9999)) {
    return null;
  }
  if (!Array.isArray(stats) || !Array.isArray(values) || !Array.isArray(tiers)) return null;
  const rows = stats.length;
  if (rows < 1 || rows > MAX_NET_ROWS || values.length !== rows || tiers.length !== rows) return null;
  if (!stats.every((v) => intIn(v, 0, 255)) || !tiers.every((v) => intIn(v, -1, 3))) return null;
  if (!values.every((v) => finite(v) && v > 0)) return null;
  return [base, rarity, effect, first, noun, stats as number[], values as number[], tiers as number[]];
}

function gearList(value: unknown): NetGear[] | null {
  if (!Array.isArray(value) || value.length > MAX_GEAR) return null;
  const out: NetGear[] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || (entry.length !== 3 && entry.length !== 4)) return null;
    const [slot, item, level, roll] = entry as unknown[];
    if (!id(slot, MAX_ID) || !id(item, MAX_ID) || !intIn(level, 1, 99)) return null;
    if (entry.length === 3) {
      out.push([slot, item, level]);
      continue;
    }
    const rolled = rolledOf(roll);
    if (!rolled) return null;
    out.push([slot, item, level, rolled]);
  }
  return out;
}

/** The message in `raw` (already parsed JSON), or null when it is unknown or malformed. */
export function decodeMessage(raw: unknown): NetMessage | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  switch (m.t) {
    case "hello":
      if (!intIn(m.v, 0, UINT32_MAX) || !intIn(m.seed, 0, UINT32_MAX)) return null;
      if (typeof m.hero !== "string" || m.hero.length === 0 || m.hero.length > MAX_HERO_ID) return null;
      return { t: "hello", v: m.v, seed: m.seed, hero: m.hero };
    case "join": {
      if (!intIn(m.v, 0, UINT32_MAX) || !id(m.hero, MAX_HERO_ID)) return null;
      const g = gearList(m.g);
      return g ? { t: "join", v: m.v, hero: m.hero, g } : null;
    }
    case "start": {
      if (!intIn(m.v, 0, UINT32_MAX) || !intIn(m.seed, 0, UINT32_MAX) || !intIn(m.world, 1, 99)) return null;
      if (!DIFFICULTIES.includes(m.d as NetDifficulty)) return null;
      if (!Array.isArray(m.heroes) || m.heroes.length < 2 || m.heroes.length > MAX_PLAYERS) return null;
      if (!m.heroes.every((h) => id(h, MAX_HERO_ID))) return null;
      if (!intIn(m.you, 1, m.heroes.length - 1)) return null;
      if (!Array.isArray(m.g) || m.g.length !== m.heroes.length) return null;
      const g: NetGear[][] = [];
      for (const list of m.g) {
        const one = gearList(list);
        if (!one) return null;
        g.push(one);
      }
      return { t: "start", v: m.v, seed: m.seed, world: m.world, d: m.d as NetDifficulty, you: m.you, heroes: m.heroes as string[], g };
    }
    case "room":
      if (!intIn(m.v, 0, UINT32_MAX) || !Array.isArray(m.heroes) || m.heroes.length < 1 || m.heroes.length > MAX_PLAYERS) return null;
      if (!m.heroes.every((h) => id(h, MAX_HERO_ID)) || !intIn(m.you, -1, m.heroes.length - 1)) return null;
      return { t: "room", v: m.v, you: m.you, heroes: m.heroes as string[] };
    case "left":
      return intIn(m.p, 1, MAX_PLAYERS - 1) ? { t: "left", p: m.p } : null;
    case "in":
      if (!intIn(m.k, 0, MAX_STEP) || !intIn(m.p, 0, MAX_PLAYERS - 1) || !intIn(m.mx, -1, 1) || !intIn(m.my, -1, 1)) return null;
      if (!intIn(m.c, -1, 2) || !intIn(m.a, 0, 31)) return null;
      // the blink's aim (whole world units from the hero), sent only with the Blink bit
      if (m.ax !== undefined || m.ay !== undefined) {
        if (!intIn(m.ax, -MAX_AIM, MAX_AIM) || !intIn(m.ay, -MAX_AIM, MAX_AIM)) return null;
        return { t: "in", k: m.k, p: m.p, mx: m.mx, my: m.my, c: m.c, a: m.a, ax: m.ax, ay: m.ay };
      }
      return { t: "in", k: m.k, p: m.p, mx: m.mx, my: m.my, c: m.c, a: m.a };
    case "hash":
      if (!intIn(m.k, 0, MAX_STEP) || !intIn(m.p, 0, MAX_PLAYERS - 1) || !intIn(m.h, 0, UINT32_MAX)) return null;
      return { t: "hash", k: m.k, p: m.p, h: m.h };
    case "ping":
    case "pong":
      if (!intIn(m.n, 0, UINT32_MAX) || !finite(m.at)) return null;
      return { t: m.t, n: m.n, at: m.at };
    case "bye":
      return { t: "bye" };
    case "ready":
      return { t: "ready" };
    default:
      return null;
  }
}

export function inputMessage(k: number, p: number, input: TickInput): InputNetMessage {
  const aimed = (input.actions & InputAction.Blink) !== 0 && input.aimX !== undefined && input.aimY !== undefined;
  return aimed
    ? { t: "in", k, p, mx: input.moveX, my: input.moveY, c: input.card, a: input.actions, ax: input.aimX, ay: input.aimY }
    : { t: "in", k, p, mx: input.moveX, my: input.moveY, c: input.card, a: input.actions };
}

export function toInput(m: InputNetMessage, out: TickInput): TickInput {
  out.moveX = m.mx;
  out.moveY = m.my;
  out.card = m.c;
  out.actions = m.a;
  out.aimX = m.ax;
  out.aimY = m.ay;
  return out;
}
