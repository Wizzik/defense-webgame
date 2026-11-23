import { reviveShare, TICKS_PER_SECOND } from "../../sim";
import type { GameSnapshot } from "./debug";
import type { Session } from "./session";

/** One player of the run as `window.__game.players` shows him (co-op e2e and debugging). */
export interface PlayerSnapshot {
  hero: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  gold: number;
  down: boolean;
  /** Share of the revive done, 0 to 1. */
  revive: number;
  /** Seconds left of the co-op choice time. */
  choosing: number;
  /** "card", "chest" or "" for the offer he has open. */
  offer: "card" | "chest" | "";
}

/** Copies the players and the net loop into the snapshot; `window.__net` is the net loop's numbers too. */
export function updateNet(snapshot: GameSnapshot, session: Session): void {
  const run = session.run;
  snapshot.local = session.local;
  snapshot.net = session.coop?.stats ?? null;
  (window as { __net?: unknown }).__net = snapshot.net ?? undefined;
  if (!run) return;
  const players = snapshot.players;
  players.length = run.players.length;
  for (let p = 0; p < run.players.length; p++) {
    const player = run.players[p]!;
    const { hero } = player;
    const shot = (players[p] ??= { hero: "", hp: 0, maxHp: 0, x: 0, y: 0, gold: 0, down: false, revive: 0, choosing: 0, offer: "" });
    shot.hero = hero.def.id;
    shot.hp = hero.hp;
    shot.maxHp = hero.stats.maxHp;
    shot.x = hero.x;
    shot.y = hero.y;
    shot.gold = player.gold;
    shot.down = hero.hp <= 0;
    shot.revive = reviveShare(run, p);
    shot.choosing = player.choosingTicks / TICKS_PER_SECOND;
    shot.offer = player.offer ? "card" : player.chestOffer ? "chest" : "";
  }
}
