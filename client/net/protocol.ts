// Messages between two peers (spec 2026-11-20 multiplayer spike, 5.4). Only inputs, hashes and pings travel;
// the game state never does. Every received message passes `decodeMessage`, which never throws.
import type { TickInput } from "../../sim";

export const PROTOCOL_VERSION = 1;

export type NetMessage =
  | { t: "hello"; v: number; seed: number; hero: string }
  | { t: "in"; k: number; mx: number; my: number; c: number; a: number }
  | { t: "hash"; k: number; h: number }
  | { t: "ping"; n: number; at: number }
  | { t: "pong"; n: number; at: number }
  | { t: "bye" };

export type InputNetMessage = Extract<NetMessage, { t: "in" }>;

const MAX_STEP = 1_000_000;
const MAX_HERO_ID = 32;
const UINT32_MAX = 0xffffffff;

function intIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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
    case "in":
      if (!intIn(m.k, 0, MAX_STEP) || !intIn(m.mx, -1, 1) || !intIn(m.my, -1, 1)) return null;
      if (!intIn(m.c, -1, 2) || !intIn(m.a, 0, 15)) return null;
      return { t: "in", k: m.k, mx: m.mx, my: m.my, c: m.c, a: m.a };
    case "hash":
      if (!intIn(m.k, 0, MAX_STEP) || !intIn(m.h, 0, UINT32_MAX)) return null;
      return { t: "hash", k: m.k, h: m.h };
    case "ping":
    case "pong":
      if (!intIn(m.n, 0, UINT32_MAX) || !finite(m.at)) return null;
      return { t: m.t, n: m.n, at: m.at };
    case "bye":
      return { t: "bye" };
    default:
      return null;
  }
}

export function inputMessage(k: number, input: TickInput): InputNetMessage {
  return { t: "in", k, mx: input.moveX, my: input.moveY, c: input.card, a: input.actions };
}

export function toInput(m: InputNetMessage, out: TickInput): TickInput {
  out.moveX = m.mx;
  out.moveY = m.my;
  out.card = m.c;
  out.actions = m.a;
  return out;
}
