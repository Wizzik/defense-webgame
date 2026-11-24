// The net loop of a co-op run (multiplayer migration step 7, from the spike page; 2-4 players since 2026-11-24): every
// window runs the same simulation in lockstep. Guests link only to the host, who relays inputs and hashes (relay.ts). Steps run from a worker heartbeat up to wall-clock time (ticker.ts, wall-clock.ts), so a
// hidden or covered window keeps pace; the page draws on requestAnimationFrame and interpolates with `alpha`.
import { stateHash, TICK_SECONDS, type Run, type TickInput } from "../../sim";
import { HASH_EVERY, Lockstep } from "./lockstep";
import type { PeerLink } from "./peer-link";
import { inputMessage, type NetMessage, toInput } from "./protocol";
import { inboundPlayer, relayTargets } from "./relay";
import { startTicker, type Ticker } from "./ticker";
import { WallClock } from "./wall-clock";

/** How often the worker heartbeat asks for steps (two beats a step). */
const BEAT_MS = 1000 / 60;
const RTT_SAMPLES = 60;
const STEP_MS = TICK_SECONDS * 1000;

/** What `window.__net` shows of a co-op run (the panel numbers of the spike). */
export interface NetStats {
  role: "host" | "guest";
  connected: boolean;
  tick: number;
  rttMedian: number;
  rttP95: number;
  stalls: number;
  stallsPerMinute: number;
  lastMatchedHash: number;
  desyncAt: number | null;
  rejected: number;
  /** Players who left (or whose link broke); their heroes stand still from then on. A guest whose host left lists everyone. */
  gone: number[];
}

export interface CoopNetDeps {
  /** The host: guest player number -> his link; a guest: 0 -> the host's link. */
  links: ReadonlyMap<number, PeerLink>;
  local: number;
  /** Players in the run (2-4). */
  players: number;
  run: Run;
  /** Fills the local input of the next queued step. */
  readInput(out: TickInput): void;
  /** After every step, before the next one. */
  afterStep(run: Run): void;
  /** Player `player` left or his link broke; the run goes on with his hero idle (a guest gets 0 when the host left). */
  onLeft(player: number, reason: string): void;
  /** The simulations differ from `step` on; the run stops. */
  onDesync(step: number): void;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

export class CoopNet {
  readonly stats: NetStats;
  private readonly lock: Lockstep;
  private readonly clock = new WallClock(STEP_MS);
  private readonly inputs: TickInput[];
  private readonly scratch: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
  private readonly remote: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
  private readonly rtts: number[] = [];
  private readonly linkIds: number[];
  private ticker: Ticker | null = null;
  private pinger = 0;
  private pingN = 0;
  private started = 0;
  private readonly readyGuests = new Set<number>();
  private lastStepAt = 0;
  private stopped = false;
  private desynced = false;

  constructor(private readonly deps: CoopNetDeps) {
    this.lock = new Lockstep(deps.players, deps.local);
    this.inputs = [];
    for (let p = 0; p < deps.players; p++) this.inputs.push({ moveX: 0, moveY: 0, card: -1, actions: 0 });
    this.linkIds = [...deps.links.keys()];
    this.stats = {
      role: deps.local === 0 ? "host" : "guest", connected: true, tick: 0, rttMedian: 0, rttP95: 0, stalls: 0,
      stallsPerMinute: 0, lastMatchedHash: -1, desyncAt: null, rejected: 0, gone: [],
    };
    for (const [from, link] of deps.links) {
      link.onMessage((m) => this.receive(from, m));
      link.onClose((reason) => this.linkClosed(from, reason));
    }
  }

  /** Sends `m` on every link still open. */
  private broadcast(m: NetMessage): void {
    for (const [p, link] of this.deps.links) if (!this.isGone(p)) link.send(m);
  }

  private isGone(player: number): boolean {
    return this.stats.gone.includes(player);
  }

  /** Starts stepping (the host does this once the guest said `ready`). */
  start(): void {
    if (this.ticker || this.stopped) return;
    this.started = performance.now();
    this.lastStepAt = this.started;
    this.ticker = startTicker(BEAT_MS, () => this.pump());
    this.pinger = window.setInterval(() => this.broadcast({ t: "ping", n: this.pingN++, at: performance.now() }), 1000);
  }

  get running(): boolean {
    return this.ticker !== null && !this.stopped;
  }

  /** Interpolation between the last two steps at `now` (ms). */
  alpha(now: number): number {
    if (!this.running) return 1;
    return Math.min(1, Math.max(0, (now - this.lastStepAt) / STEP_MS));
  }

  /** Stops stepping and closes every link (the player left the run). */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.ticker?.stop();
    clearInterval(this.pinger);
    for (const link of this.deps.links.values()) link.close();
  }

  private receive(from: number, m: NetMessage): void {
    const { deps } = this;
    if (m.t === "in" || m.t === "hash") {
      const player = inboundPlayer(deps.local, from, m.p, deps.players);
      if (player === null || this.isGone(player)) return;
      // the host passes it on before anything else, so the guests get a leaver's last inputs before his "left"
      for (const to of relayTargets(deps.local, from, this.linkIds)) {
        if (!this.isGone(to)) deps.links.get(to)!.send({ ...m, p: player });
      }
      if (m.t === "in") {
        this.lock.receive(player, m.k, toInput(m, this.remote));
        this.pump(); // run what the input made ready at once, not at the next beat
      } else this.check(this.lock.recordHash(player, m.k, m.h));
    } else if (m.t === "ping") deps.links.get(from)?.send({ t: "pong", n: m.n, at: m.at });
    else if (m.t === "pong") {
      this.rtts.push(performance.now() - m.at);
      if (this.rtts.length > RTT_SAMPLES) this.rtts.shift();
      const sorted = [...this.rtts].sort((a, b) => a - b);
      this.stats.rttMedian = percentile(sorted, 0.5);
      this.stats.rttP95 = percentile(sorted, 0.95);
    } else if (m.t === "ready") {
      // the host steps once every guest is ready
      this.readyGuests.add(from);
      if (this.readyGuests.size + this.stats.gone.length >= this.linkIds.length) this.start();
    } else if (m.t === "left" && deps.local !== 0 && from === 0) this.leave(m.p, "left");
    else if (m.t === "bye") this.linkClosed(from, "the other player left");
  }

  /** A link closed: on the host one guest left; on a guest the host left, and with him every other player. */
  private linkClosed(from: number, reason: string): void {
    const { deps } = this;
    if (this.isGone(from)) return;
    if (deps.local === 0) {
      this.leave(from, reason);
      this.broadcast({ t: "left", p: from });
    } else {
      for (let p = 0; p < deps.players; p++) if (p !== deps.local && p !== from) this.drop(p);
      this.leave(from, reason);
    }
    this.stats.connected = this.linkIds.some((p) => !this.isGone(p));
    // a guest who left before every guest was ready no longer holds the start back
    if (deps.local === 0 && !this.ticker && this.readyGuests.size > 0 && this.readyGuests.size + this.stats.gone.length >= this.linkIds.length) this.start();
  }

  private drop(player: number): void {
    if (this.isGone(player)) return;
    this.stats.gone.push(player);
    this.stats.gone.sort((a, b) => a - b);
    this.lock.drop(player);
  }

  private leave(player: number, reason: string): void {
    if (this.isGone(player) || player === this.deps.local) return;
    this.drop(player);
    if (!this.stopped) this.deps.onLeft(player, reason);
    this.pump();
  }

  private check(verdict: "ok" | "pending" | "desync"): void {
    if (verdict !== "desync" || this.desynced) return;
    this.desynced = true;
    this.ticker?.stop();
    this.stats.desyncAt = this.lock.desyncAt;
    this.deps.onDesync(this.lock.desyncAt ?? 0);
  }

  /** Runs the steps due by wall-clock time as far as both players' inputs are known. */
  private pump(): void {
    if (this.stopped || this.desynced || !this.ticker) return;
    const { lock, deps } = this;
    const { run } = deps;
    const now = performance.now();
    const steps = this.clock.pending(now, lock.tick);
    for (let s = 0; s < steps && !this.desynced; s++) {
      if (lock.canQueue()) {
        deps.readInput(this.scratch);
        const k = lock.queueLocal(this.scratch);
        this.broadcast(inputMessage(k, deps.local, this.scratch));
      }
      if (run.state === "won" || run.state === "lost" || !lock.ready()) break;
      const k = lock.take(this.inputs);
      run.step(this.inputs);
      this.lastStepAt = now;
      deps.afterStep(run);
      if ((k + 1) % HASH_EVERY === 0 && this.stats.connected) {
        const h = stateHash(run);
        this.broadcast({ t: "hash", k, p: deps.local, h });
        this.check(lock.recordHash(deps.local, k, h));
      }
    }
    this.report(now);
  }

  private report(now: number): void {
    const { stats, lock } = this;
    stats.tick = lock.tick;
    stats.stalls = lock.stalls;
    stats.stallsPerMinute = lock.stalls / Math.max(1 / 60, (now - this.started) / 60_000);
    stats.lastMatchedHash = lock.lastMatchedHash;
    stats.desyncAt = lock.desyncAt;
    let rejected = 0;
    for (const link of this.deps.links.values()) rejected += link.rejected;
    stats.rejected = rejected;
  }
}
