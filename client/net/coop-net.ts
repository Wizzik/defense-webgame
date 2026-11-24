// The net loop of a co-op run (multiplayer migration step 7, from the spike page): both windows run the same
// simulation in lockstep. Steps run from a worker heartbeat up to wall-clock time (ticker.ts, wall-clock.ts), so a
// hidden or covered window keeps pace; the page draws on requestAnimationFrame and interpolates with `alpha`.
import { stateHash, TICK_SECONDS, type Run, type TickInput } from "../../sim";
import { HASH_EVERY, Lockstep } from "./lockstep";
import type { PeerLink } from "./peer-link";
import { inputMessage, type NetMessage, toInput } from "./protocol";
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
  /** The teammate left (or the link broke); his hero stands still from then on. */
  left: boolean;
}

export interface CoopNetDeps {
  peer: PeerLink;
  local: 0 | 1;
  run: Run;
  /** Fills the local input of the next queued step. */
  readInput(out: TickInput): void;
  /** After every step, before the next one. */
  afterStep(run: Run): void;
  /** The teammate left or the link broke; the run goes on with his hero idle. */
  onLeft(reason: string): void;
  /** The two simulations differ from `step` on; the run stops. */
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
  private readonly inputs: TickInput[] = [
    { moveX: 0, moveY: 0, card: -1, actions: 0 },
    { moveX: 0, moveY: 0, card: -1, actions: 0 },
  ];
  private readonly scratch: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
  private readonly remote: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
  private readonly rtts: number[] = [];
  private readonly other: 0 | 1;
  private ticker: Ticker | null = null;
  private pinger = 0;
  private pingN = 0;
  private started = 0;
  private lastStepAt = 0;
  private stopped = false;
  private desynced = false;

  constructor(private readonly deps: CoopNetDeps) {
    this.lock = new Lockstep(2, deps.local);
    this.other = deps.local === 0 ? 1 : 0;
    this.stats = {
      role: deps.local === 0 ? "host" : "guest", connected: true, tick: 0, rttMedian: 0, rttP95: 0, stalls: 0,
      stallsPerMinute: 0, lastMatchedHash: -1, desyncAt: null, rejected: 0, left: false,
    };
    deps.peer.onMessage((m) => this.receive(m));
    deps.peer.onClose((reason) => this.leave(reason));
  }

  /** Starts stepping (the host does this once the guest said `ready`). */
  start(): void {
    if (this.ticker || this.stopped) return;
    this.started = performance.now();
    this.lastStepAt = this.started;
    this.ticker = startTicker(BEAT_MS, () => this.pump());
    this.pinger = window.setInterval(() => {
      if (!this.stats.left) this.deps.peer.send({ t: "ping", n: this.pingN++, at: performance.now() });
    }, 1000);
  }

  get running(): boolean {
    return this.ticker !== null && !this.stopped;
  }

  /** Interpolation between the last two steps at `now` (ms). */
  alpha(now: number): number {
    if (!this.running) return 1;
    return Math.min(1, Math.max(0, (now - this.lastStepAt) / STEP_MS));
  }

  /** Stops stepping and closes the link (the player left the run). */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.ticker?.stop();
    clearInterval(this.pinger);
    this.deps.peer.close();
  }

  private receive(m: NetMessage): void {
    if (m.t === "in") {
      this.lock.receive(this.other, m.k, toInput(m, this.remote));
      this.pump(); // run what the input made ready at once, not at the next beat
    } else if (m.t === "hash") this.check(this.lock.recordHash(this.other, m.k, m.h));
    else if (m.t === "ping") this.deps.peer.send({ t: "pong", n: m.n, at: m.at });
    else if (m.t === "pong") {
      this.rtts.push(performance.now() - m.at);
      if (this.rtts.length > RTT_SAMPLES) this.rtts.shift();
      const sorted = [...this.rtts].sort((a, b) => a - b);
      this.stats.rttMedian = percentile(sorted, 0.5);
      this.stats.rttP95 = percentile(sorted, 0.95);
    } else if (m.t === "ready") this.start();
    else if (m.t === "bye") this.leave("the other player left");
  }

  private leave(reason: string): void {
    if (this.stats.left) return;
    this.stats.left = true;
    this.stats.connected = false;
    this.lock.drop(this.other);
    if (!this.stopped) this.deps.onLeft(reason);
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
    const { run, peer } = deps;
    const now = performance.now();
    const steps = this.clock.pending(now, lock.tick);
    for (let s = 0; s < steps && !this.desynced; s++) {
      if (lock.canQueue()) {
        deps.readInput(this.scratch);
        const k = lock.queueLocal(this.scratch);
        if (!this.stats.left) peer.send(inputMessage(k, deps.local, this.scratch));
      }
      if (run.state === "won" || run.state === "lost" || !lock.ready()) break;
      const k = lock.take(this.inputs);
      run.step(this.inputs);
      this.lastStepAt = now;
      deps.afterStep(run);
      if ((k + 1) % HASH_EVERY === 0 && !this.stats.left) {
        const h = stateHash(run);
        peer.send({ t: "hash", k, p: deps.local, h });
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
    stats.rejected = this.deps.peer.rejected;
  }
}
