import { describe, expect, it } from "vitest";
import { createRun } from "../../sim";
import { gameData } from "../../sim/testing/game-data";
import { CoopNet } from "./coop-net";
import type { PeerLink } from "./peer-link";
import type { NetGear, NetMessage } from "./protocol";

/** A link whose sent messages are recorded and whose callbacks a test fires. */
class FakeLink implements PeerLink {
  readonly sent: NetMessage[] = [];
  readonly rejected = 0;
  closed = false;
  private message: (m: NetMessage) => void = () => {};
  private close_: (reason: string) => void = () => {};
  send(m: NetMessage): void {
    this.sent.push(m);
  }
  onMessage(cb: (m: NetMessage) => void): void {
    this.message = cb;
  }
  onClose(cb: (reason: string) => void): void {
    this.close_ = cb;
  }
  close(): void {
    this.closed = true;
  }
  fire(m: NetMessage): void {
    this.message(m);
  }
  fireClose(): void {
    this.close_("gone");
  }
}

function net(
  local: number, links: Map<number, FakeLink>, left: number[] = [], gear: [number, NetGear[]][] = [],
): CoopNet {
  const heroes = ["stonehorn", "sparkshot", "tidecaller"];
  const run = createRun(gameData(), { seed: 1, players: heroes.map((hero) => ({ hero })) });
  return new CoopNet({
    links, local, players: 3, run,
    readInput: () => {}, afterStep: () => {},
    onLeft: (p) => left.push(p), onDesync: () => {},
    onGear: (p, g) => gear.push([p, g]),
  });
}

describe("CoopNet with three players", () => {
  it("host relays a guest's input and hash to the other guest with his player", () => {
    const a = new FakeLink();
    const b = new FakeLink();
    net(0, new Map([[1, a], [2, b]]));
    a.fire({ t: "in", k: 5, p: 2, mx: 1, my: 0, c: -1, a: 0 });
    a.fire({ t: "hash", k: 29, p: 0, h: 7 });
    expect(b.sent).toContainEqual({ t: "in", k: 5, p: 1, mx: 1, my: 0, c: -1, a: 0 });
    expect(b.sent).toContainEqual({ t: "hash", k: 29, p: 1, h: 7 });
    expect(a.sent.filter((m) => m.t === "in" || m.t === "hash")).toEqual([]);
  });

  it("host relays a guest's departure", () => {
    const a = new FakeLink();
    const b = new FakeLink();
    const left: number[] = [];
    const coop = net(0, new Map([[1, a], [2, b]]), left);
    a.fireClose();
    expect(b.sent).toContainEqual({ t: "left", p: 1 });
    expect(coop.stats.gone).toEqual([1]);
    expect(left).toEqual([1]);
    expect(coop.stats.connected).toBe(true);
  });

  it("guest drops everyone when the host leaves", () => {
    const host = new FakeLink();
    const left: number[] = [];
    const coop = net(1, new Map([[0, host]]), left);
    host.fireClose();
    expect(coop.stats.gone).toEqual([0, 2]);
    expect(coop.stats.connected).toBe(false);
    expect(left).toEqual([0]);
  });

  it("guest learns from the host that another guest left", () => {
    const host = new FakeLink();
    const left: number[] = [];
    const coop = net(1, new Map([[0, host]]), left);
    host.fire({ t: "left", p: 2 });
    expect(coop.stats.gone).toEqual([2]);
    expect(left).toEqual([2]);
  });

  it("host takes a guest's new gear for the next run; a guest ignores gear", () => {
    const a = new FakeLink();
    const b = new FakeLink();
    const gear: [number, NetGear[]][] = [];
    net(0, new Map([[1, a], [2, b]]), [], gear);
    b.fire({ t: "gear", g: [["head", "travelers-hood", 2]] });
    expect(gear).toEqual([[2, [["head", "travelers-hood", 2]]]]);
    expect(a.sent.some((m) => m.t === "gear")).toBe(false);
    const host = new FakeLink();
    const seen: [number, NetGear[]][] = [];
    net(1, new Map([[0, host]]), [], seen);
    host.fire({ t: "gear", g: [] });
    expect(seen).toEqual([]);
  });

  it("stop closes every link", () => {
    const a = new FakeLink();
    const b = new FakeLink();
    net(0, new Map([[1, a], [2, b]])).stop();
    expect(a.closed && b.closed).toBe(true);
  });
});
