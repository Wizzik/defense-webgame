import { describe, expect, it } from "vitest";
import { damageCastle, damageHero } from "../combat";
import { EventKind } from "../events";
import { NO_INPUT } from "../input";
import { abilityCooldownTicks, debugSetAbilityLevel } from "./slots";
import { refreshHeroStats } from "../level-up";
import { abilityRun, eventsOf, quietData } from "../testing/ability-run";

function setup() {
  const data = quietData();
  data.rules.hero.baseRegen = 0;
  data.rules.hero.regenPerStr = 0;
  const ab = data.abilities.find((a) => a.id === "spirit-ward");
  if (!ab || ab.kind !== "shield") throw new Error("test setup");
  return { data, p: ab.params, run: abilityRun("serpent-shaman", { 3: 1 }, data) };
}

describe("shield", () => {
  it("shield blocks hero and castle damage for its duration", () => {
    const { p, run } = setup();
    const max = run.hero.stats.maxHp;
    run.hero.hp = 0.3 * max;
    run.step(NO_INPUT);
    const casts = eventsOf(run, EventKind.Cast);
    expect(casts.length).toBe(1);
    expect(run.events.a[casts[0]]).toBe(3);
    expect(run.events.value[casts[0]]).toBe(p.duration[0]);
    expect(run.events.x[casts[0]]).toBe(run.hero.x);
    expect(run.shieldTicks).toBe(Math.round(p.duration[0] * 30));
    const castleHp = run.castle.hp;
    for (let i = 0; i < Math.round(p.duration[0] * 30); i++) {
      expect(run.shieldTicks).toBeGreaterThan(0);
      run.events.clear();
      damageHero(run, 50, -1);
      damageCastle(run, 50, -1);
      expect(run.hero.hp).toBe(0.3 * max);
      expect(run.castle.hp).toBe(castleHp);
      expect(run.events.count).toBe(0);
      run.step(NO_INPUT);
    }
    expect(run.shieldTicks).toBe(0);
    damageHero(run, 50, -1);
    damageCastle(run, 50, -1);
    expect(run.hero.hp).toBe(0.3 * max - 50);
    expect(run.castle.hp).toBe(castleHp - 50);
  });

  it("an attacked castle raises the shield", () => {
    const { data, run } = setup();
    run.castle.hp = (data.rules.autocast.shieldBelow - 0.05) * run.castle.maxHp;
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast).length).toBe(0); // not attacked yet
    damageCastle(run, 1, -1);
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast).length).toBe(1);
    expect(run.shieldTicks).toBeGreaterThan(0);
  });

  it("stays idle at full hp", () => {
    const { run } = setup();
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast).length).toBe(0);
    expect(run.shieldTicks).toBe(0);
  });

  it("forced cast works at full hp", () => {
    const { p, run } = setup();
    run.ultimateAuto = false;
    run.ultimateRequested = true;
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast).length).toBe(1);
    expect(run.shieldTicks).toBe(Math.round(p.duration[0] * 30));
  });

  it("shield does not undo a loss", () => {
    const { run } = setup();
    run.castle.hp = 0;
    run.castle.lastHitTick = run.tick;
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast).length).toBe(1);
    expect(run.result).toBe("castle");
  });

  it("forced cast is refused while a shield runs", () => {
    const { p, run } = setup();
    run.ultimateAuto = false;
    run.ultimateRequested = true;
    run.step(NO_INPUT);
    const ticks = run.shieldTicks;
    expect(ticks).toBe(Math.round(p.duration[0] * 30));
    run.abilities[3].cooldown = 0;
    run.ultimateRequested = true;
    run.events.clear();
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast).length).toBe(0);
    expect(run.shieldTicks).toBe(ticks - 1);
  });

  it("the cooldown starts when the shield ends", () => {
    const { p, run } = setup();
    run.ultimateAuto = false;
    run.ultimateRequested = true;
    run.step(NO_INPUT);
    const slot = run.abilities[3];
    expect(slot.cooldown).toBe(Math.round(p.duration[0] * 30) + abilityCooldownTicks(run, slot));
  });

  it("the shield cannot be kept up permanently", () => {
    const { p, run } = setup();
    run.hero.int = 5000; // the scaled cooldown is far below the duration
    refreshHeroStats(run);
    debugSetAbilityLevel(run, 3, 2);
    run.ultimateAuto = false;
    const cooldown = abilityCooldownTicks(run, run.abilities[3]);
    expect(cooldown).toBeLessThan(Math.round(p.duration[1] * 30));
    let unshieldedRun = 0;
    let minGap = Infinity;
    let seenShield = false;
    for (let i = 0; i < 4000; i++) {
      run.ultimateRequested = true;
      run.step(NO_INPUT);
      if (run.shieldTicks > 0) {
        if (seenShield && unshieldedRun > 0) minGap = Math.min(minGap, unshieldedRun);
        unshieldedRun = 0;
        seenShield = true;
      } else {
        unshieldedRun++;
      }
    }
    expect(Number.isFinite(minGap)).toBe(true); // there are gaps between shields
    expect(minGap).toBeGreaterThanOrEqual(cooldown);
  });
});
