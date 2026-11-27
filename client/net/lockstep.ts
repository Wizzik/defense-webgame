// Deterministic lockstep for 2-4 peers (spec 2026-11-20 multiplayer spike, 5.4; co-op for 3-4 players 2026-11-24):
// a step runs only when the inputs of every player still in the run are known. An input taken while step k is next applies to step k + INPUT_DELAY.
// Pure: no network and no timers; the page feeds it messages. No allocation per step.
import type { TickInput } from "../../sim";

export const INPUT_DELAY = 3;
export const HASH_EVERY = 30;

const RING = 256;

class InputRing {
  /** k + 1 of the input stored in a slot, 0 for none. */
  readonly key = new Int32Array(RING);
  readonly mx = new Int8Array(RING);
  readonly my = new Int8Array(RING);
  readonly card = new Int8Array(RING);
  readonly actions = new Int8Array(RING);
  /** The blink's aim; `aimed` 1 when the input carried one. */
  readonly ax = new Int16Array(RING);
  readonly ay = new Int16Array(RING);
  readonly aimed = new Uint8Array(RING);

  has(k: number): boolean {
    return this.key[k % RING] === k + 1;
  }

  put(k: number, input: TickInput): void {
    const i = k % RING;
    this.key[i] = k + 1;
    this.mx[i] = input.moveX;
    this.my[i] = input.moveY;
    this.card[i] = input.card;
    this.actions[i] = input.actions;
    const aimed = input.aimX !== undefined && input.aimY !== undefined;
    this.aimed[i] = aimed ? 1 : 0;
    this.ax[i] = aimed ? input.aimX! : 0;
    this.ay[i] = aimed ? input.aimY! : 0;
  }

  read(k: number, out: TickInput): void {
    const i = k % RING;
    out.moveX = this.mx[i]!;
    out.moveY = this.my[i]!;
    out.card = this.card[i]!;
    out.actions = this.actions[i]!;
    out.aimX = this.aimed[i] === 1 ? this.ax[i]! : undefined;
    out.aimY = this.aimed[i] === 1 ? this.ay[i]! : undefined;
  }
}

class HashRing {
  /** k + 1 of the hash stored in a slot, 0 for none. */
  readonly key = new Int32Array(RING);
  readonly hash = new Uint32Array(RING);
}

export type HashVerdict = "ok" | "pending" | "desync";

export class Lockstep {
  /** The next step to run. */
  tick = 0;
  /** The step the next local input goes to. */
  nextLocal = INPUT_DELAY;
  /** Calls of `ready()` that found an input missing. */
  stalls = 0;
  /** Inputs dropped because they were too far ahead. */
  rejected = 0;
  /** The last step whose hashes both sides had and matched, -1 before the first. */
  lastMatchedHash = -1;
  /** The first step whose hashes differed, or null. */
  desyncAt: number | null = null;

  private readonly inputs: InputRing[];
  private readonly hashes: HashRing[];
  /** Players who left: their missing inputs count as no input, so the rest play on. */
  private readonly gone: boolean[] = [];

  constructor(players: number, readonly local: number) {
    this.inputs = [];
    this.hashes = [];
    for (let p = 0; p < players; p++) {
      this.inputs.push(new InputRing());
      this.hashes.push(new HashRing());
      this.gone.push(false);
    }
  }

  /** The player left: from now on a step he sent no input for gets none (his hero stands still). */
  drop(player: number): void {
    this.gone[player] = true;
  }

  /** Whether a local input may be queued now (at most INPUT_DELAY steps ahead of the next step). */
  canQueue(): boolean {
    return this.nextLocal <= this.tick + INPUT_DELAY;
  }

  /** Stores a copy of the local input for step `nextLocal` and returns that step (the caller sends it); -1 when `canQueue()` is false. */
  queueLocal(input: TickInput): number {
    if (!this.canQueue()) return -1;
    const k = this.nextLocal++;
    this.inputs[this.local]!.put(k, input);
    return k;
  }

  /** Stores a peer's input; a duplicate or an already run step is ignored, one too far ahead is rejected. */
  receive(player: number, k: number, input: TickInput): void {
    if (k < this.tick || k < INPUT_DELAY) return;
    if (k >= this.tick + RING) {
      this.rejected++;
      return;
    }
    const ring = this.inputs[player]!;
    if (!ring.has(k)) ring.put(k, input);
  }

  /** Whether the inputs of every player for `tick` are known; counts a stall when not. */
  ready(): boolean {
    if (this.tick < INPUT_DELAY) return true;
    for (let p = 0; p < this.inputs.length; p++) {
      if (!this.gone[p] && !this.inputs[p]!.has(this.tick)) {
        this.stalls++;
        return false;
      }
    }
    return true;
  }

  /** Fills `out` with every player's input for `tick`, moves on and returns the step taken. Call only after `ready()`. */
  take(out: TickInput[]): number {
    const k = this.tick;
    for (let p = 0; p < this.inputs.length; p++) {
      const o = out[p]!;
      if (k < INPUT_DELAY || !this.inputs[p]!.has(k)) {
        o.moveX = 0;
        o.moveY = 0;
        o.card = -1;
        o.actions = 0;
        o.aimX = undefined;
        o.aimY = undefined;
      } else this.inputs[p]!.read(k, o);
    }
    this.tick++;
    return k;
  }

  /**
   * Records a player's state hash after step `k` and compares the local hash with every other player's known one:
   * "desync" when one differs, "ok" when at least one was compared and all matched, else "pending". A player who
   * left is not compared.
   */
  recordHash(player: number, k: number, h: number): HashVerdict {
    const slot = Math.floor(k / HASH_EVERY) % RING;
    const own = this.hashes[player]!;
    own.key[slot] = k + 1;
    own.hash[slot] = h >>> 0;
    const mine = this.hashes[this.local]!;
    if (mine.key[slot] !== k + 1) return "pending";
    let compared = false;
    for (let p = 0; p < this.hashes.length; p++) {
      if (p === this.local || this.gone[p] || (player !== this.local && p !== player)) continue;
      const other = this.hashes[p]!;
      if (other.key[slot] !== k + 1) continue;
      compared = true;
      if (other.hash[slot] !== mine.hash[slot]) {
        if (this.desyncAt === null || k < this.desyncAt) this.desyncAt = k;
        return "desync";
      }
    }
    if (!compared) return "pending";
    if (k > this.lastMatchedHash) this.lastMatchedHash = k;
    return "ok";
  }
}
