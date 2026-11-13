import { describe, expect, it } from "vitest";
import { killEnemy } from "./combat";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { stateHash } from "./hash";
import { NO_INPUT } from "./input";
import { createRun } from "./run";
import type { Run } from "./run";
import { gameData } from "./testing/game-data";
import { silenceSpawns } from "./testing/silence";

type Effect = { kind: string; params: Record<string, number> };

/** A quiet run whose hero wears (or only owns, with `worn: false`) a weapon with the effect. No spell is learned. */
function runWith(effect: Effect, worn = true, seed = 11): Run {
  const data = gameData();
  silenceSpawns(data);
  // the stunned dummies must stay where they are put
  data.rules.enemies.knockback = { attack: 0, ability: 0, seconds: 0.15 };
  data.items.push({
    id: "fx-item", name: { en: "Fx", cs: "Fx" }, slotType: "mainHand", rarity: "legendary",
    stats: [{ stat: "hp", value: 1 }, { stat: "hp", value: 1 }, { stat: "hp", value: 1 }, { stat: "hp", value: 1 }],
    effect: { ...effect, text: { en: "Effect.", cs: "Efekt." } } as never,
  });
  const run = createRun(data, {
    seed, durationSeconds: 100000, loadout: worn ? [{ slot: "mainHand", item: "fx-item", level: 1 }] : [],
  });
  for (const slot of run.abilities) slot.level = 0;
  return run;
}

/** A stunned enemy with a lot of hp at an offset from the hero. */
function dummy(run: Run, dx: number, dy = 0, type = 0): number {
  const slot = run.enemies.spawn(type, Role.Hunter, run.hero.x + dx, run.hero.y + dy, 1, 1, 0);
  run.enemies.hp[slot] = 1e7;
  run.enemies.maxHp[slot] = 1e7;
  run.enemies.stunTicks[slot] = 1e7;
  return slot;
}

function count(run: Run, kind: number): number {
  let n = 0;
  for (let k = 0; k < run.events.count; k++) if (run.events.kind[k] === kind) n++;
  return n;
}

/** Steps until the hero's next basic attack lands and returns the damage of that attack. */
function nextAttack(run: Run, target: number): number {
  for (let guard = 0; guard < 400; guard++) {
    run.step(NO_INPUT);
    for (let k = 0; k < run.events.count; k++) {
      if (run.events.kind[k] === EventKind.Hit && run.events.a[k] === target && run.events.u[k] === 0) return run.events.value[k]!;
    }
  }
  throw new Error("the hero did not attack");
}

describe("gear effects", () => {
  it("chain_on_attack: every fifth attack jumps to the nearest enemies in range", () => {
    const run = runWith({ kind: "chain_on_attack", params: { every: 5, damage: 40, jumps: 2, range: 300 } });
    const a = dummy(run, 80);
    const b = dummy(run, 80 + 250);
    const c = dummy(run, 80 + 250 + 250);
    const far = dummy(run, 80, 900);
    const e = run.enemies;
    for (let n = 1; n <= 4; n++) {
      nextAttack(run, a);
      expect(e.hp[b], `attack ${n}`).toBe(1e7);
      expect(count(run, EventKind.Blast)).toBe(0);
    }
    nextAttack(run, a);
    const bolt = 40 * run.hero.stats.spellPower;
    expect(e.hp[b]).toBeCloseTo(1e7 - bolt, 6);
    expect(e.hp[c]).toBeCloseTo(1e7 - bolt, 6);
    expect(e.hp[far]).toBe(1e7);
    expect(count(run, EventKind.Blast)).toBe(2);
    nextAttack(run, a);
    expect(e.hp[b]).toBeCloseTo(1e7 - bolt, 6);
  });

  it("splash_on_attack: a hit that procs deals a share of its damage to everyone around the target", () => {
    const run = runWith({ kind: "splash_on_attack", params: { chance: 1, radius: 200, fraction: 0.5 } });
    const a = dummy(run, 80);
    const near = dummy(run, 80 + 150);
    const far = dummy(run, 80 + 600);
    const dealt = nextAttack(run, a);
    expect(run.enemies.hp[near]).toBeCloseTo(1e7 - dealt * 0.5, 6);
    expect(run.enemies.hp[far]).toBe(1e7);
    expect(run.enemies.hp[a]).toBeCloseTo(1e7 - dealt, 6);
    expect(count(run, EventKind.Blast)).toBe(1);
  });

  it("splash_on_attack: the chance comes from the run's generator", () => {
    const procs = (seed: number) => {
      const run = runWith({ kind: "splash_on_attack", params: { chance: 0.5, radius: 200, fraction: 0.5 } }, true, seed);
      const a = dummy(run, 80);
      const near = dummy(run, 80 + 150);
      let n = 0;
      for (let i = 0; i < 20; i++) {
        const before = run.enemies.hp[near]!;
        nextAttack(run, a);
        if (run.enemies.hp[near]! < before) n++;
      }
      return n;
    };
    const n = procs(3);
    expect(n).toBeGreaterThan(2);
    expect(n).toBeLessThan(18);
    expect(procs(3)).toBe(n);
  });

  it("low_hp_shield: under the threshold the shield starts once, then waits out its cooldown", () => {
    const run = runWith({ kind: "low_hp_shield", params: { threshold: 0.3, seconds: 3, cooldown: 20 } });
    const low = () => {
      run.hero.hp = run.hero.stats.maxHp * 0.2;
    };
    run.step(NO_INPUT);
    expect(run.shieldTicks).toBe(0);
    low();
    run.step(NO_INPUT);
    expect(run.shieldTicks).toBe(90);
    let starts = 0;
    let previous = run.shieldTicks;
    for (let i = 0; i < 23 * 30 - 2; i++) {
      low();
      run.step(NO_INPUT);
      if (run.shieldTicks > previous) starts++;
      previous = run.shieldTicks;
    }
    expect(starts).toBe(0);
    expect(run.shieldTicks).toBe(0);
    for (let i = 0; i < 5; i++) {
      low();
      run.step(NO_INPUT);
    }
    expect(run.shieldTicks).toBeGreaterThan(80);
  });

  it("haste_on_elite_kill: after an elite or a boss falls the cooldowns run faster for a while", () => {
    const run = runWith({ kind: "haste_on_elite_kill", params: { cooldownSpeed: 2, seconds: 5 } });
    const slot = run.abilities[0]!;
    slot.level = 1;
    const drop = (ticks: number) => {
      slot.cooldown = 100000;
      for (let i = 0; i < ticks; i++) run.step(NO_INPUT);
      return 100000 - slot.cooldown;
    };
    expect(drop(30)).toBe(30);
    killEnemy(run, dummy(run, 2000, 0, 0));
    expect(drop(30)).toBe(30);
    killEnemy(run, dummy(run, 2000, 0, run.eliteType));
    expect(drop(30)).toBe(60);
    expect(drop(150)).toBe(120 * 2 + 30);
    killEnemy(run, dummy(run, 2000, 0, run.finalBossType));
    expect(drop(30)).toBe(60);
  });

  it("slow_aura: enemies inside the radius are slowed, the ones outside are not", () => {
    const run = runWith({ kind: "slow_aura", params: { radius: 300, slow: 0.3 } });
    const inside = dummy(run, 200);
    const outside = dummy(run, 600);
    for (let i = 0; i < 11; i++) run.step(NO_INPUT);
    expect(run.enemies.slowFactor[inside]).toBeGreaterThanOrEqual(0.3);
    expect(run.enemies.slowTicks[inside]).toBeGreaterThan(0);
    expect(run.enemies.slowTicks[outside]).toBe(0);
    for (let i = 0; i < 60; i++) run.step(NO_INPUT);
    expect(run.enemies.slowTicks[inside]).toBeGreaterThan(0);
  });

  it("gold_heals_castle: collected gold heals the castle, never above its maximum", () => {
    const run = runWith({ kind: "gold_heals_castle", params: { perGold: 5 } });
    run.castle.hp = run.castle.maxHp - 100;
    run.coins.drop(run.hero.x + 10, run.hero.y, 3);
    run.step(NO_INPUT);
    expect(run.gold).toBe(3);
    // the castle also regenerates a little in the step
    expect(run.castle.hp).toBeGreaterThanOrEqual(run.castle.maxHp - 100 + 15);
    expect(run.castle.hp).toBeLessThan(run.castle.maxHp - 100 + 16);
    run.coins.drop(run.hero.x + 10, run.hero.y, 100);
    run.step(NO_INPUT);
    expect(run.castle.hp).toBe(run.castle.maxHp);
  });

  it("an effect of an item that is not worn does nothing", () => {
    const aura = runWith({ kind: "slow_aura", params: { radius: 300, slow: 0.3 } }, false);
    const inside = dummy(aura, 200);
    for (let i = 0; i < 11; i++) aura.step(NO_INPUT);
    expect(aura.enemies.slowTicks[inside]).toBe(0);
    const shield = runWith({ kind: "low_hp_shield", params: { threshold: 0.3, seconds: 3, cooldown: 20 } }, false);
    shield.hero.hp = shield.hero.stats.maxHp * 0.2;
    shield.step(NO_INPUT);
    expect(shield.shieldTicks).toBe(0);
  });

  it("the same seed gives the same hash with effects, and the hash covers their state", () => {
    const play = () => {
      const run = runWith({ kind: "chain_on_attack", params: { every: 3, damage: 40, jumps: 2, range: 300 } });
      const a = dummy(run, 80);
      dummy(run, 300);
      for (let i = 0; i < 4; i++) nextAttack(run, a);
      return run;
    };
    const first = play();
    const second = play();
    expect(stateHash(second)).toBe(stateHash(first));
    second.gear.fx.chainCount++;
    expect(stateHash(second)).not.toBe(stateHash(first));
  });
});
