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
        send(p, inputMessage(k, p, scratch), frame);
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
          send(p, { t: "hash", k, p, h }, frame);
        }
      }
    }
  }
  return { runs, locks, desyncs };
}

/** n peers of an n-player run; every message goes to every other peer, delayed 0-5 frames in random order. */
function playGroup(n: number, steps: number, opts: { leaver?: number; leaveAt?: number; tamper?: number } = {}): {
  runs: Run[]; locks: Lockstep[]; desyncs: number;
} {
  const data = gameData();
  const heroes = ["stonehorn", "sparkshot", "gravecaller", "tidecaller"].slice(0, n);
  const runs: Run[] = [];
  const locks: Lockstep[] = [];
  for (let p = 0; p < n; p++) {
    runs.push(createRun(data, { seed: 9, players: heroes.map((hero) => ({ hero })) }));
    locks.push(new Lockstep(n, p));
  }
  const net = new Rng(3);
  const wasd = new Rng(4);
  let queue: { at: number; from: number; to: number; raw: string }[] = [];
  let desyncs = 0;
  const left = (p: number, frame: number) => opts.leaver === p && frame >= (opts.leaveAt ?? Infinity);
  const send = (from: number, m: NetMessage, now: number) => {
    for (let to = 0; to < n; to++) if (to !== from) queue.push({ at: now + net.int(6), from, to, raw: JSON.stringify(m) });
  };
  const scratch = input();
  const inputs: TickInput[] = heroes.map(() => input());
  const active = (p: number) => opts.leaver !== p || runs[p]!.tick < (opts.leaveAt ?? Infinity);
  for (let frame = 0; frame < steps * 6 && runs.some((r, p) => r.tick < steps && (p !== opts.leaver)); frame++) {
    for (let p = 0; p < n; p++) {
      const lock = locks[p]!;
      if (left(p, frame) || !active(p) || !lock.canQueue()) continue;
      scratch.moveX = wasd.int(3) - 1; scratch.moveY = wasd.int(3) - 1; scratch.card = -1; scratch.actions = 0;
      const k = lock.queueLocal(scratch);
      send(p, inputMessage(k, p, scratch), frame);
    }
    if (opts.leaver !== undefined && frame === opts.leaveAt) {
      // as through the host: whatever the leaver sent reaches everyone (ordered relay) before "left"
      for (const q of queue) if (q.from === opts.leaver) q.at = frame;
    }
    const due = queue.filter((q) => q.at <= frame);
    queue = queue.filter((q) => q.at > frame);
    for (const q of due) {
      const m = decodeMessage(JSON.parse(q.raw));
      if (m?.t === "in") locks[q.to]!.receive(q.from, m.k, toInput(m, input()));
      if (m?.t === "hash" && locks[q.to]!.recordHash(q.from, m.k, m.h) === "desync") desyncs++;
    }
    if (opts.leaver !== undefined && frame === opts.leaveAt) {
      for (let p = 0; p < n; p++) if (p !== opts.leaver) locks[p]!.drop(opts.leaver);
    }
    for (let p = 0; p < n; p++) {
      if (p === opts.leaver && frame >= (opts.leaveAt ?? Infinity)) continue;
      const lock = locks[p]!;
      const run = runs[p]!;
      while (run.tick < steps && lock.ready()) {
        const k = lock.take(inputs);
        run.step(inputs);
        if (p === opts.tamper && k === 100) run.gold += 1;
        if ((k + 1) % HASH_EVERY === 0) {
          const h = stateHash(run);
          if (lock.recordHash(p, k, h) === "desync") desyncs++;
          send(p, { t: "hash", k, p, h }, frame);
        }
      }
    }
  }
  return { runs, locks, desyncs };
}

describe("Lockstep for 3-4 players", () => {
  it("three and four players stay in sync over 1500 steps", () => {
    for (const n of [3, 4]) {
      const { runs, locks, desyncs } = playGroup(n, 1500);
      expect(desyncs).toBe(0);
      for (const run of runs) {
        expect(run.tick).toBe(1500);
        expect(stateHash(run)).toBe(stateHash(runs[0]!));
      }
      expect(locks[0]!.lastMatchedHash).toBeGreaterThanOrEqual(1400);
    }
  });

  it("three players play on without one who left", () => {
    const { runs, desyncs } = playGroup(3, 600, { leaver: 2, leaveAt: 200 });
    expect(runs[0]!.tick).toBe(600);
    expect(runs[1]!.tick).toBe(600);
    expect(desyncs).toBe(0);
    expect(stateHash(runs[0]!)).toBe(stateHash(runs[1]!));
  });

  it("a hash differing in one of three players is a desync", () => {
    const { desyncs, locks } = playGroup(3, 300, { tamper: 2 });
    expect(desyncs).toBeGreaterThan(0);
    expect(locks[0]!.desyncAt).not.toBeNull();
  });

  it("compares the local hash with every other player's", () => {
    const lock = new Lockstep(3, 1);
    expect(lock.recordHash(1, 29, 5)).toBe("pending");
    expect(lock.recordHash(0, 29, 5)).toBe("ok");
    expect(lock.recordHash(2, 29, 5)).toBe("ok");
    expect(lock.recordHash(2, 59, 8)).toBe("pending");
    expect(lock.recordHash(1, 59, 7)).toBe("desync");
    expect(lock.desyncAt).toBe(59);
    lock.drop(0);
    expect(lock.recordHash(0, 89, 1)).toBe("pending");
  });
});

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

  it("plays on without a player who left", () => {
    const host = new Lockstep(2, 0);
    const out = [{ ...NO_INPUT }, { ...NO_INPUT }];
    host.receive(1, INPUT_DELAY, { moveX: 1, moveY: 0, card: -1, actions: 0 });
    while (host.canQueue()) host.queueLocal({ moveX: 0, moveY: 1, card: -1, actions: 0 });
    for (let k = 0; k <= INPUT_DELAY; k++) host.take(out);
    expect(out[1]!.moveX).toBe(1);
    host.queueLocal({ moveX: 0, moveY: 1, card: -1, actions: 0 });
    expect(host.ready()).toBe(false);
    host.drop(1);
    expect(host.ready()).toBe(true);
    host.take(out);
    expect(out[1]).toEqual({ moveX: 0, moveY: 0, card: -1, actions: 0 });
    expect(out[0]!.moveY).toBe(1);
  });
});
