import { describe, expect, it } from "vitest";
import { botInput, createRun, NO_INPUT, Rng, stateHash, type Run, type TickInput } from "../../sim";
import { gameData } from "../../sim/testing/game-data";
import { HASH_EVERY, INPUT_DELAY, Lockstep } from "./lockstep";
import { decodeMessage, inputMessage, toInput, type NetMessage } from "./protocol";

const input = (moveX = 0, moveY = 0): TickInput => ({ moveX, moveY, card: -1, actions: 0 });
const outs = (): TickInput[] => [input(), input()];

interface Packet { at: number; to: 0 | 1; raw: string }

/** Two peers over an in-memory link that delays every message 0-5 frames and delivers in random order. */
function playPair(steps: number, tamper?: (peer: 1, run: Run) => void): {
  runs: Run[]; locks: Lockstep[]; desyncs: number;
} {
  const data = gameData();
  const runs = [createRun(data, { seed: 7, hero: "stonehorn" }), createRun(data, { seed: 7, hero: "stonehorn" })];
  const locks = [new Lockstep(2, 0), new Lockstep(2, 1)];
  const net = new Rng(1);
  const wasd = new Rng(2);
  let queue: Packet[] = [];
  let desyncs = 0;
  const send = (from: 0 | 1, m: NetMessage, now: number) => {
    queue.push({ at: now + net.int(6), to: from === 0 ? 1 : 0, raw: JSON.stringify(m) });
  };
  const scratch = input();
  const inputs = outs();
  for (let frame = 0; frame < steps * 4 && (runs[0]!.tick < steps || runs[1]!.tick < steps); frame++) {
    for (const p of [0, 1] as const) {
      const lock = locks[p]!;
      const run = runs[p]!;
      if (lock.canQueue()) {
        if (p === 0) botInput(run, scratch);
        else { scratch.moveX = wasd.int(3) - 1; scratch.moveY = wasd.int(3) - 1; scratch.card = -1; scratch.actions = 0; }
        const k = lock.queueLocal(scratch);
        send(p, inputMessage(k, scratch), frame);
      }
    }
    const due = queue.filter((q) => q.at <= frame);
    queue = queue.filter((q) => q.at > frame);
    for (let i = due.length - 1; i > 0; i--) {
      const j = net.int(i + 1);
      [due[i], due[j]] = [due[j]!, due[i]!];
    }
    for (const q of due) {
      const m = decodeMessage(JSON.parse(q.raw));
      const other = q.to === 0 ? 1 : 0;
      if (m?.t === "in") locks[q.to]!.receive(other, m.k, toInput(m, input()));
      if (m?.t === "hash" && locks[q.to]!.recordHash(other, m.k, m.h) === "desync") desyncs++;
    }
    for (const p of [0, 1] as const) {
      const lock = locks[p]!;
      const run = runs[p]!;
      while (run.tick < steps && lock.ready()) {
        const k = lock.take(inputs);
        run.step(inputs[0]!);
        if (p === 1 && tamper && k === 100) tamper(1, run);
        if ((k + 1) % HASH_EVERY === 0) {
          const h = stateHash(run);
          if (lock.recordHash(p, k, h) === "desync") desyncs++;
          send(p, { t: "hash", k, h }, frame);
        }
      }
    }
  }
  return { runs, locks, desyncs };
}

describe("Lockstep", () => {
  it("two peers stay in sync over 3000 steps", () => {
    const { runs, locks, desyncs } = playPair(3000);
    expect(runs[0]!.tick).toBe(3000);
    expect(runs[1]!.tick).toBe(3000);
    expect(desyncs).toBe(0);
    expect(stateHash(runs[0]!)).toBe(stateHash(runs[1]!));
    expect(locks[0]!.lastMatchedHash).toBeGreaterThanOrEqual(2900);
    expect(locks[0]!.rejected + locks[1]!.rejected).toBe(0);
  });

  it("detects a desync", () => {
    const { desyncs, locks } = playPair(400, (_p, run) => { run.gold += 1; });
    expect(desyncs).toBeGreaterThan(0);
    const at = locks[0]!.desyncAt ?? locks[1]!.desyncAt;
    expect(at).not.toBeNull();
    expect(at!).toBeGreaterThanOrEqual(100);
    expect(at!).toBeLessThan(100 + HASH_EVERY);
  });

  it("first INPUT_DELAY steps run with NO_INPUT", () => {
    const lock = new Lockstep(2, 0);
    const out = outs();
    for (let k = 0; k < INPUT_DELAY; k++) {
      expect(lock.ready()).toBe(true);
      out[0] = input(1, 1);
      out[1] = input(1, 1);
      expect(lock.take(out)).toBe(k);
      expect(out[0]).toEqual(NO_INPUT);
      expect(out[1]).toEqual(NO_INPUT);
    }
    expect(lock.ready()).toBe(false);
  });

  it("the first local input goes to step INPUT_DELAY", () => {
    const lock = new Lockstep(2, 1);
    expect(lock.queueLocal(input(1, 0))).toBe(INPUT_DELAY);
    expect(lock.canQueue()).toBe(false);
  });

  it("duplicate and reordered inputs do not double-step", () => {
    const lock = new Lockstep(2, 0);
    const out = outs();
    for (let k = 0; k < INPUT_DELAY; k++) lock.take(out);
    // the peer's inputs for steps 3..6 arrive backwards and twice
    for (const k of [6, 5, 4, 3]) lock.receive(1, k, input(0, 1));
    lock.receive(1, 5, input(-1, -1)); // a duplicate keeps the first input
    lock.receive(1, 3, input(-1, -1));
    const steps: number[] = [];
    for (let k = INPUT_DELAY; k < INPUT_DELAY + 4; k++) {
      expect(lock.queueLocal(input(1, 0))).toBe(k);
      expect(lock.ready()).toBe(true);
      steps.push(lock.take(out));
      expect(out[0]).toEqual(input(1, 0));
      expect(out[1]).toEqual(input(0, 1));
    }
    expect(steps).toEqual([3, 4, 5, 6]);
    expect(lock.ready()).toBe(false);
    lock.receive(1, 4, input(1, 1)); // stale: already taken
    expect(lock.tick).toBe(7);
    expect(lock.rejected).toBe(0);
  });

  it("stalls count when the peer is late", () => {
    const lock = new Lockstep(2, 0);
    const out = outs();
    for (let k = 0; k < INPUT_DELAY; k++) lock.take(out);
    lock.queueLocal(input());
    expect(lock.ready()).toBe(false);
    expect(lock.ready()).toBe(false);
    expect(lock.stalls).toBe(2);
    lock.receive(1, INPUT_DELAY, input());
    expect(lock.ready()).toBe(true);
    expect(lock.stalls).toBe(2);
  });

  it("rejects an input more than 256 steps ahead", () => {
    const lock = new Lockstep(2, 0);
    lock.receive(1, 256, input());
    lock.receive(1, 1_000_000, input());
    expect(lock.rejected).toBe(2);
    lock.receive(1, 255, input());
    expect(lock.rejected).toBe(2);
  });

  it("compares hashes once both sides have them", () => {
    const lock = new Lockstep(2, 0);
    expect(lock.recordHash(0, 29, 5)).toBe("pending");
    expect(lock.recordHash(1, 29, 5)).toBe("ok");
    expect(lock.lastMatchedHash).toBe(29);
    expect(lock.recordHash(1, 59, 6)).toBe("pending");
    expect(lock.recordHash(0, 59, 7)).toBe("desync");
    expect(lock.desyncAt).toBe(59);
  });
});
