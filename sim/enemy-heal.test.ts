import { describe, expect, it } from "vitest";
import { TICKS_PER_SECOND } from "./constants";
import { Role } from "./enemies";
import { updateEnemies } from "./enemy-ai";
import { healEnemies } from "./enemy-heal";
import { EventKind } from "./events";
import { createRun } from "./run";
import { gameData } from "./testing/game-data";
import { silenceSpawns } from "./testing/silence";

function newRun() {
  const data = gameData();
  data.rules.arena = {
    width: 6000, height: 5000, castle: { x: 0, y: -2400 }, heroStart: { x: 0, y: 2400 },
    gates: [{ x: -1800, y: 2200 }, { x: 1800, y: 2200 }], gateRadius: 150,
  };
  silenceSpawns(data);
  // nobody walks, so distances stay as the test sets them
  for (const e of data.enemies) e.moveSpeed = 0.0001;
  return createRun(data, { seed: 3, durationSeconds: 100000 });
}

type TestRun = ReturnType<typeof newRun>;

const chaplainType = (run: TestRun): number => run.data.enemies.findIndex((e) => e.id === "chaplain");
const healOf = (run: TestRun) => run.data.enemies[chaplainType(run)]!.heal!;
const MAX_HP = 100;

/** A sieger far from the hero and the castle, with `lost` hp missing. */
function add(run: TestRun, type: number, x: number, y: number, lost = 0, damageScale = 1): number {
  const i = run.enemies.spawn(type, Role.Sieger, 0, x, y, MAX_HP, damageScale, 0);
  run.enemies.hp[i] = MAX_HP - lost;
  return i;
}

/** One step of enemy AI and healing; returns the indices of the EnemyHeal events of the step. */
function tick(run: TestRun): number[] {
  run.events.clear();
  updateEnemies(run);
  healEnemies(run);
  run.tick++;
  const heals: number[] = [];
  for (let k = 0; k < run.events.count; k++) if (run.events.kind[k] === EventKind.EnemyHeal) heals.push(k);
  return heals;
}

describe("chaplain heal", () => {
  it("a chaplain heals the most wounded enemy in range", () => {
    const run = newRun();
    const { amount } = healOf(run);
    add(run, chaplainType(run), 0, 0);
    const light = add(run, 0, 100, 0, 5);
    const heavy = add(run, 0, -100, 0, 30);
    expect(tick(run)).toHaveLength(1);
    expect(run.enemies.hp[heavy]).toBeCloseTo(MAX_HP - 30 + Math.min(amount, 30), 9);
    expect(run.enemies.hp[light]).toBe(MAX_HP - 5);
  });

  it("the lowest slot wins a tie", () => {
    const run = newRun();
    add(run, chaplainType(run), 0, 0);
    const first = add(run, 0, 100, 0, 30);
    const second = add(run, 0, -100, 0, 30);
    tick(run);
    expect(run.enemies.hp[first]).toBeGreaterThan(MAX_HP - 30);
    expect(run.enemies.hp[second]).toBe(MAX_HP - 30);
  });

  it("heal never exceeds max hp", () => {
    const run = newRun();
    const { amount } = healOf(run);
    expect(amount).toBeGreaterThan(3);
    add(run, chaplainType(run), 0, 0);
    const wounded = add(run, 0, 100, 0, 3);
    const [k] = tick(run);
    expect(run.enemies.hp[wounded]).toBe(MAX_HP);
    expect(run.events.value[k!]).toBeCloseTo(3, 9);
  });

  it("heal waits for its cooldown", () => {
    const run = newRun();
    const cooldownTicks = Math.round(healOf(run).cooldown * TICKS_PER_SECOND);
    add(run, chaplainType(run), 0, 0);
    add(run, 0, 100, 0, 90);
    expect(tick(run)).toHaveLength(1);
    for (let i = 0; i < cooldownTicks; i++) expect(tick(run), `step ${i + 1} after the heal`).toHaveLength(0);
    expect(tick(run)).toHaveLength(1);
  });

  it("no wounded enemy in range: no event and no cooldown", () => {
    const run = newRun();
    const { range } = healOf(run);
    const chaplain = add(run, chaplainType(run), 0, 0);
    const wounded = add(run, 0, range + 100, 0, 30);
    add(run, 0, 100, 0, 0); // healthy and near
    for (let i = 0; i < 5; i++) expect(tick(run)).toHaveLength(0);
    expect(run.enemies.healCooldown[chaplain]).toBe(0);
    expect(run.enemies.hp[wounded]).toBe(MAX_HP - 30);
    run.enemies.x[wounded] = range - 50;
    expect(tick(run)).toHaveLength(1);
  });

  it("the range is measured between centres", () => {
    const run = newRun();
    const { range } = healOf(run);
    add(run, chaplainType(run), 0, 0);
    const wounded = add(run, 0, range + 5, 0, 30);
    expect(tick(run)).toHaveLength(0);
    run.enemies.x[wounded] = range - 5;
    expect(tick(run)).toHaveLength(1);
  });

  it("a stunned chaplain does not heal", () => {
    const run = newRun();
    const chaplain = add(run, chaplainType(run), 0, 0);
    add(run, 0, 100, 0, 30);
    run.enemies.stunTicks[chaplain] = 3;
    for (let i = 0; i < 3; i++) expect(tick(run), `stunned step ${i}`).toHaveLength(0);
    expect(tick(run)).toHaveLength(1);
  });

  it("a chaplain heals itself", () => {
    const run = newRun();
    const { amount } = healOf(run);
    const chaplain = add(run, chaplainType(run), 0, 0, 40);
    const [k] = tick(run);
    expect(run.enemies.hp[chaplain]).toBeCloseTo(MAX_HP - 40 + amount, 9);
    expect(run.events.a[k!]).toBe(chaplain);
    expect(run.events.u[k!]).toBe(chaplain);
  });

  it("heal scales with the healer's damage scale", () => {
    const run = newRun();
    const { amount } = healOf(run);
    add(run, chaplainType(run), 0, 0, 0, 1.5);
    const wounded = add(run, 0, 100, 0, 90);
    tick(run);
    expect(run.enemies.hp[wounded]).toBeCloseTo(MAX_HP - 90 + amount * 1.5, 9);
  });

  it("only enemies with a heal do it", () => {
    const run = newRun();
    add(run, 0, 0, 0);
    add(run, 0, 100, 0, 30);
    for (let i = 0; i < 40; i++) expect(tick(run)).toHaveLength(0);
  });

  it("EnemyHeal carries target, amount, position and healer", () => {
    const run = newRun();
    const { amount } = healOf(run);
    const chaplain = add(run, chaplainType(run), 0, 0);
    const wounded = add(run, 0, 120, 60, 50);
    const [k] = tick(run);
    const ev = run.events;
    expect(ev.a[k!]).toBe(wounded);
    expect(ev.value[k!]).toBeCloseTo(amount, 9);
    expect(ev.x[k!]).toBe(run.enemies.x[wounded]);
    expect(ev.y[k!]).toBe(run.enemies.y[wounded]);
    expect(ev.u[k!]).toBe(chaplain);
    expect(ev.v[k!]).toBe(0);
  });

  it("a spawned enemy starts with no heal cooldown", () => {
    const run = newRun();
    const chaplain = add(run, chaplainType(run), 0, 0, 40);
    tick(run);
    expect(run.enemies.healCooldown[chaplain]).toBeGreaterThan(0);
    run.enemies.kill(chaplain);
    expect(add(run, chaplainType(run), 0, 0)).toBe(chaplain);
    expect(run.enemies.healCooldown[chaplain]).toBe(0);
  });
});
