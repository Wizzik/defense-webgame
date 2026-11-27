import { describe, expect, it } from "vitest";
import { EventKind, HeroHitSource, OrbKind, SlamEvent } from "../../sim";
import { abilityRun } from "../../sim/testing/ability-run";
import { loadAudioData } from "./data";
import { type CueRequest, type CueState, HANDLED_EVENTS, newCueRequests, resolveEventCues } from "./event-cues";

const data = loadAudioData();

function setup() {
  const run = abilityRun("stonehorn", { 0: 1, 3: 1 });
  run.events.clear();
  const enemyIds = run.data.enemies.map((e) => e.id);
  const out = newCueRequests(64);
  const state: CueState = { lastHeroHealTick: -1e9 };
  const resolve = (): CueRequest[] => out.slice(0, resolveEventCues(run, data, enemyIds, out, state));
  return { run, enemyIds, resolve };
}

describe("resolveEventCues", () => {
  it("maps a cast to the ability cue and skips none", () => {
    const { run, resolve } = setup();
    run.events.push(EventKind.Cast, 0, 0, 1, 2, 0, 0);
    const [req] = resolve();
    expect(req!.cue).toBe(data.abilities["rock-rupture"]!.cast);
    expect(req!.world).toBe(true);
    expect([req!.x, req!.y]).toEqual([1, 2]);

    const nightglaive = abilityRun("nightglaive", { 2: 1 });
    nightglaive.events.clear();
    expect(nightglaive.abilities[2]!.def.id).toBe("swift-pace");
    nightglaive.events.push(EventKind.Cast, 2, 0, 0, 0, 0, 0);
    expect(resolveEventCues(nightglaive, data, [], newCueRequests(4), { lastHeroHealTick: -1e9 })).toBe(0);
  });

  it("maps a base attack hit to the hero's attack cue", () => {
    const { run, resolve } = setup();
    run.events.push(EventKind.Hit, 0, 10, 0, 0, 0, -1);
    expect(resolve()[0]!.cue).toBe(data.heroes.stonehorn!.attack);
  });

  it("maps a spell hit through the slot in v", () => {
    const { run, resolve } = setup();
    const withHit = { ...data, abilities: { ...data.abilities, "rock-rupture": { cast: "stone-rupture", hit: "stone-tap" } } };
    run.events.push(EventKind.Hit, 0, 10, 0, 0, 1, 0);
    run.events.push(EventKind.Hit, 0, 10, 0, 0, 2, 0);
    const out = newCueRequests(8);
    const n = resolveEventCues(run, withHit, [], out, { lastHeroHealTick: -1e9 });
    expect(n).toBe(1);
    expect(out[0]!.cue).toBe("stone-tap");
    expect(resolve()).toHaveLength(0); // no hit cue in the data: silent
  });

  it("maps an enemy death through its type", () => {
    const { run, enemyIds, resolve } = setup();
    const slot = run.enemies.spawn(0, 0, 5, 5, 10, 1, 0);
    run.events.push(EventKind.Death, slot, 0, 5, 5, 0, 0);
    expect(resolve()[0]!.cue).toBe(data.enemies[enemyIds[run.enemies.type[slot]!]!]!.death);
  });

  it("plays the faction horn, bloodlust, web, roots and the raise; root circles creak instead of the slam", () => {
    const { run, resolve } = setup();
    const druid = run.enemies.spawn(run.data.enemies.findIndex((e) => e.id === "grove-druid"), 0, 5, 5, 10, 1, 0);
    run.events.push(EventKind.Faction, 1, 6, 0, 0, 0, 0);
    run.events.push(EventKind.Bloodlust, 0, 3, 0, 0, 0, 0);
    run.events.push(EventKind.HeroSnared, 0, 0, 0, 0, 2, 0);
    run.events.push(EventKind.HeroSnared, 0, 1, 0, 0, 1.2, 0);
    run.events.push(EventKind.Raise, 0, 0, 0, 0, 0, 0);
    run.events.push(EventKind.Slam, druid, SlamEvent.Warning, 0, 0, 160, 30);
    run.events.push(EventKind.Slam, druid, SlamEvent.Hit, 0, 0, 160, 0);
    expect(resolve().map((r) => r.cue)).toEqual([
      data.sounds.faction, data.sounds["enemy.bloodlust"], data.sounds["hero.web"], data.sounds["hero.root"],
      data.sounds["enemy.raise"], data.sounds["enemy.root"],
    ]);
  });

  it("a poison cloud step is silent, a hit is not", () => {
    const { run, resolve } = setup();
    run.events.push(EventKind.HeroHit, 3, 5, 0, 0, HeroHitSource.Cloud, 0);
    expect(resolve()).toEqual([]);
    run.events.push(EventKind.HeroHit, 3, 5, 0, 0, HeroHitSource.Hit, 0);
    expect(resolve().map((r) => r.cue)).toEqual([data.sounds.heroHit]);
  });

  it("a caster's spell bolt is heard where it hits the hero or the castle, other shots only as the hit", () => {
    const { run, resolve } = setup();
    const casters = ["battle-mage", "fire-caller", "bone-acolyte", "moon-priestess"];
    const cues = casters.map((id) => data.enemies[id]!.attack);
    expect(cues).toEqual(["enemy-bolt-arcane", "enemy-bolt-fire", "enemy-bolt-bone", "enemy-bolt-moon"]);
    const mage = run.enemies.spawn(run.data.enemies.findIndex((e) => e.id === "battle-mage"), 0, 5, 5, 10, 1, 0);
    run.events.push(EventKind.HeroHit, mage, 5, 0, 0, HeroHitSource.Hit, 0);
    run.events.push(EventKind.CastleHit, mage, 5, 0, 0, 0, 0);
    expect(resolve().map((r) => r.cue)).toEqual([data.sounds.heroHit, "enemy-bolt-arcane", data.sounds.castleHit, "enemy-bolt-arcane"]);
    run.events.clear();
    const musketeer = run.enemies.spawn(run.data.enemies.findIndex((e) => e.id === "musketeer"), 0, 5, 5, 10, 1, 0);
    run.events.push(EventKind.HeroHit, musketeer, 5, 0, 0, HeroHitSource.Hit, 0);
    expect(resolve().map((r) => r.cue)).toEqual([data.sounds.heroHit]);
  });

  it("every faction type dies with its faction's sound", () => {
    const deaths = (ids: string[]) => new Set(ids.map((id) => data.enemies[id]!.death));
    expect(deaths(["brute", "spearthrower", "hornback", "bloodcaller"]).size).toBe(1);
    expect(deaths(["shieldbearer", "brute", "ghoul", "huntress"]).size).toBe(4);
  });

  it("maps every game event to its sound", () => {
    const { run, resolve } = setup();
    const table: [number, number, number, string][] = [
      [EventKind.HeroHit, 0, 0, "heroHit"],
      [EventKind.CastleHit, 0, 0, "castleHit"],
      [EventKind.Pickup, 0, 0, "pickup.xp"],
      [EventKind.Pickup, 0, 1, "pickup.coin"],
      [EventKind.Pickup, 0, 2, "pickup.heart"],
      [EventKind.OrbPickup, OrbKind.Boots, 0, "orb.boots"],
      [EventKind.OrbPickup, OrbKind.Berserk, 0, "orb.berserk"],
      [EventKind.OrbPickup, OrbKind.Heal, 0, "orb.heal"],
      [EventKind.ChestOpen, 0, 0, "chest.open"],
      [EventKind.ChestPick, 0, 0, "chest.pick"],
      [EventKind.LevelUp, 0, 0, "levelUp"],
      [EventKind.Dash, 0, 0, "dash"],
      [EventKind.HeroHeal, 0, 1, "heroHeal"],
      [EventKind.EnemyHeal, 0, 0, "enemy.heal"],
      [EventKind.EnemyCharge, 0, 0, "enemy.charge"],
      [EventKind.BossSpawn, 0, 0, "bossArrive"],
      [EventKind.BossDeath, 0, 0, "bossDeath"],
      [EventKind.RushWarning, 7, 0, "rushWarning"],
      [EventKind.Slam, SlamEvent.Warning, 0, "slam.warn"],
      [EventKind.Slam, SlamEvent.Hit, 0, "slam.hit"],
      [EventKind.Enrage, 0, 0, "enrage"],
    ];
    for (const [kind, value, u, sound] of table) {
      run.events.clear();
      // OrbPickup and Slam carry their kind in value; the rest ignore it
      run.events.push(kind, 0, value, 3, 4, u, 0);
      const got = resolve();
      const cue = data.sounds[sound as keyof typeof data.sounds];
      expect(got.map((r) => r.cue), `${sound}`).toEqual(cue === "none" ? [] : [cue]);
    }
  });

  it("plays nothing for XP and gold pickups (silent since 2026-11-20)", () => {
    expect([data.sounds["pickup.xp"], data.sounds["pickup.coin"]]).toEqual(["none", "none"]);
  });

  it("skips the orb heal, a cancelled slam and the charge run", () => {
    const { run, resolve } = setup();
    run.events.push(EventKind.HeroHeal, 0, 5, 0, 0, 2, 0);
    run.events.push(EventKind.Slam, 0, SlamEvent.Cancelled, 0, 0, 0, 0);
    run.events.push(EventKind.EnemyCharge, 0, 1, 0, 0, 0, 0);
    expect(resolve()).toHaveLength(0);
  });

  it("plays the lifesteal heal at most once per 0.5 s", () => {
    const { run, resolve } = setup();
    run.events.push(EventKind.HeroHeal, 0, 5, 0, 0, 1, 0);
    expect(resolve()).toHaveLength(1);
    run.tick += 10;
    expect(resolve()).toHaveLength(0);
    run.tick += 6;
    expect(resolve()).toHaveLength(1);
  });

  it("covers every EventKind with a sound or an explicit skip", () => {
    expect(Object.keys(EventKind).sort()).toEqual(Object.keys(HANDLED_EVENTS).sort());
  });
});
