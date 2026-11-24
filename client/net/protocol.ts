// Messages between two peers (spec 2026-11-20 multiplayer spike, 5.4). Only inputs, hashes and pings travel;
// the game state never does. Every received message passes `decodeMessage`, which never throws.
import type { TickInput } from "../../sim";

/** 2: the game's co-op lobby (`join` and `start`, multiplayer migration step 7). */
export const PROTOCOL_VERSION = 2;

/** One worn permanent item as it travels: [slot id, item id, level]. */
export type NetGear = [string, string, number];

/** Difficulty ids that may travel; the game checks them against its data. */
const DIFFICULTIES = ["normal", "insane", "hell"] as const;
export type NetDifficulty = (typeof DIFFICULTIES)[number];

export type NetMessage =
  | { t: "hello"; v: number; seed: number; hero: string }
  /** Guest to host in the game's lobby: his protocol, hero and permanent gear. */
  | { t: "join"; v: number; hero: string; g: NetGear[] }
  /** Host to guest: the run both start; `heroes[p]` and `g[p]` are player p's (the host is player 0). */
  | { t: "start"; v: number; seed: number; world: number; d: NetDifficulty; heroes: string[]; g: NetGear[][] }
  /** An input or a hash of player `p` for step `k` (the host sets `p` from the link a guest sent it on). */
  | { t: "in"; k: number; p: number; mx: number; my: number; c: number; a: number }
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
const MAX_PLAYERS = 4;
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

function gearList(value: unknown): NetGear[] | null {
  if (!Array.isArray(value) || value.length > MAX_GEAR) return null;
  const out: NetGear[] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 3) return null;
    const [slot, item, level] = entry as unknown[];
    if (!id(slot, MAX_ID) || !id(item, MAX_ID) || !intIn(level, 1, 99)) return null;
    out.push([slot, item, level]);
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
      if (!Array.isArray(m.g) || m.g.length !== m.heroes.length) return null;
      const g: NetGear[][] = [];
      for (const list of m.g) {
        const one = gearList(list);
        if (!one) return null;
        g.push(one);
      }
      return { t: "start", v: m.v, seed: m.seed, world: m.world, d: m.d as NetDifficulty, heroes: m.heroes as string[], g };
    }
    case "in":
      if (!intIn(m.k, 0, MAX_STEP) || !intIn(m.p, 0, MAX_PLAYERS - 1) || !intIn(m.mx, -1, 1) || !intIn(m.my, -1, 1)) return null;
      if (!intIn(m.c, -1, 2) || !intIn(m.a, 0, 15)) return null;
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
  return { t: "in", k, p, mx: input.moveX, my: input.moveY, c: input.card, a: input.actions };
}

export function toInput(m: InputNetMessage, out: TickInput): TickInput {
  out.moveX = m.mx;
  out.moveY = m.my;
  out.card = m.c;
  out.actions = m.a;
  return out;
}
