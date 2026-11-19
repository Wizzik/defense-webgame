import { describe, expect, it } from "vitest";
import { OrbKind } from "./buffs";
import { EventKind } from "./events";
import { NO_INPUT } from "./input";
import { debugSpawnOrb, placeOrb, updateOrbs } from "./orbs";
import { createRun } from "./run";
import { abilityRun, eventsOf, quietData } from "./testing/ability-run";
import { gameData } from "./testing/game-data";

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function quiet() {
  return abilityRun("stonehorn", {});
}

function aliveCount(r: ReturnType<typeof quiet>): number {
  let n = 0;
  for (let i = 0; i < r.orbs.alive.length; i++) n += r.orbs.alive[i]!;
  return n;
}

describe("orbs", () => {
  it("orbs appear at 8, 20 and 32 s", () => {
    const r = quiet();
    let spawns = 0;
    const step = (n: number) => {
      for (let i = 0; i < n; i++) {
        r.step(NO_INPUT);
        spawns += eventsOf(r, EventKind.OrbSpawn).length;
      }
    };
    step(239);
    expect(aliveCount(r)).toBe(0);
    step(1);
    expect(aliveCount(r)).toBe(1);
    step(359);
    expect(aliveCount(r)).toBe(1);
    step(1);
    expect(aliveCount(r)).toBe(2);
    step(359);
    expect(aliveCount(r)).toBe(2);
    step(1);
    expect(aliveCount(r)).toBe(3);
    expect(spawns).toBe(3);
  });

  it("an orb lies in the band, inside the arena and apart", () => {
    for (let seed = 1; seed <= 70; seed++) {
      const r = createRun(gameData(), { seed });
      const { arena, sustain } = r.data.rules;
      const o = r.orbs;
      for (let i = 0; i < o.alive.length; i++) placeOrb(r, i);
      for (let i = 0; i < o.alive.length; i++) {
        expect(o.alive[i]).toBe(1);
        const d = dist(o.x[i]!, o.y[i]!, r.castle.x, r.castle.y);
        expect(d).toBeGreaterThanOrEqual(sustain.orbs.minCastleDistance);
        expect(d).toBeLessThanOrEqual(sustain.orbs.maxCastleDistance);
        expect(Math.abs(o.x[i]!)).toBeLessThanOrEqual(arena.width / 2 - sustain.orbs.pickupRadius);
        expect(Math.abs(o.y[i]!)).toBeLessThanOrEqual(arena.height / 2 - sustain.orbs.pickupRadius);
        for (let j = 0; j < i; j++) {
          expect(dist(o.x[i]!, o.y[i]!, o.x[j]!, o.y[j]!)).toBeGreaterThanOrEqual(sustain.orbs.minSpacing);
        }
        for (let c = 0; c < r.chests.x.length; c++) {
          const dc = dist(o.x[i]!, o.y[i]!, r.chests.x[c]!, r.chests.y[c]!);
          expect(dc).toBeGreaterThanOrEqual(sustain.orbs.chestSpacing);
        }
      }
    }
  });

  it("placement stays inside a shifted arena", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = createRun(quietData(), { seed });
      const { arena } = r.data.rules;
      for (let k = 0; k < 6; k++) {
        placeOrb(r, k % 3);
        expect(Math.abs(r.orbs.x[k % 3]!)).toBeLessThanOrEqual(arena.width / 2);
        expect(Math.abs(r.orbs.y[k % 3]!)).toBeLessThanOrEqual(arena.height / 2);
      }
    }
  });

  it("pickup needs the hero within 70, no magnet", () => {
    const r = quiet();
    r.hero.gear.magnet = 5000;
    const o = r.orbs;
    o.alive[0] = 1;
    o.kind[0] = OrbKind.Berserk;
    o.x[0] = r.hero.x + 100;
    o.y[0] = r.hero.y;
    o.timer[0] = 0;
    updateOrbs(r);
    expect(o.alive[0]).toBe(1);
    expect(o.x[0]).toBe(r.hero.x + 100);
    o.x[0] = r.hero.x + 60;
    r.events.clear();
    updateOrbs(r);
    expect(o.alive[0]).toBe(0);
    expect(r.buffs.berserkTicks).toBe(450);
    expect(r.stats.orbsBerserk).toBe(1);
    const picks = eventsOf(r, EventKind.OrbPickup);
    expect(picks.length).toBe(1);
    expect(r.events.value[picks[0]!]).toBe(OrbKind.Berserk);
  });

  it("respawn comes 30-45 s later at a new place", () => {
    const r = quiet();
    const o = r.orbs;
    placeOrb(r, 0);
    const oldX = o.x[0]!;
    const oldY = o.y[0]!;
    r.hero.x = oldX;
    r.hero.y = oldY;
    updateOrbs(r);
    expect(o.alive[0]).toBe(0);
    const wait = o.timer[0]!;
    expect(wait).toBeGreaterThanOrEqual(900);
    expect(wait).toBeLessThanOrEqual(1350);
    r.hero.x = 0;
    r.hero.y = 0;
    for (let i = 0; i < wait - 1; i++) updateOrbs(r);
    expect(o.alive[0]).toBe(0);
    updateOrbs(r);
    expect(o.alive[0]).toBe(1);
    expect(dist(o.x[0]!, o.y[0]!, oldX, oldY)).toBeGreaterThanOrEqual(r.data.rules.sustain.orbs.minSpacing);
  });

  it("kinds are drawn from sustainRng", () => {
    const r = createRun(gameData(), { seed: 3 });
    const rng = r.rng.state;
    const chestRng = r.chestRng.state;
    const seen = new Set<number>();
    for (let k = 0; k < 300; k++) {
      placeOrb(r, k % 3);
      seen.add(r.orbs.kind[k % 3]!);
    }
    expect([...seen].sort()).toEqual([0, 1, 2]);
    expect(r.rng.state).toBe(rng);
    expect(r.chestRng.state).toBe(chestRng);
  });

  it("debugSpawnOrb puts an orb of the kind 150 ahead of the hero", () => {
    const r = quiet();
    r.events.clear();
    debugSpawnOrb(r, OrbKind.Heal);
    expect(r.orbs.alive[0]).toBe(1);
    expect(r.orbs.kind[0]).toBe(OrbKind.Heal);
    expect(r.orbs.x[0]).toBeCloseTo(r.hero.x + r.hero.facingX * 150, 9);
    expect(r.orbs.y[0]).toBeCloseTo(r.hero.y + r.hero.facingY * 150, 9);
    expect(eventsOf(r, EventKind.OrbSpawn).length).toBe(1);
    debugSpawnOrb(r, OrbKind.Boots);
    expect(r.orbs.alive[1]).toBe(1);
  });
});
