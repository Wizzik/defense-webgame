import { describe, expect, it } from "vitest";
import { OrbKind } from "./buffs";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { updateEnemies } from "./enemy-ai";
import { updatePickups } from "./crystals";
import { debugHazard } from "./hazard";
import { gainXp } from "./level-up";
import { updateOrbs } from "./orbs";
import { createRun, type Run } from "./run";
import { enemyTarget, nearestPlayer, TARGET_SWITCH_MARGIN } from "./targets";
import { gameData, openArena } from "./testing/game-data";
import { silenceSpawns } from "./testing/silence";

// Multiplayer migration steps 3 (enemy targeting) and 4 (shared XP, own gold, pickups to the collector).

function twoPlayers(world?: number): Run {
  const data = world === undefined ? openArena(gameData()) : gameData();
  silenceSpawns(data);
  return createRun(data, {
    seed: 4, durationSeconds: 100000, world, players: [{ hero: "stonehorn" }, { hero: "sparkshot" }],
  });
}

/** Puts player 1's hero `gap` east of player 0's. */
function spread(run: Run, gap: number): void {
  const [a, b] = run.players;
  b!.hero.x = a!.hero.x + gap;
  b!.hero.y = a!.hero.y;
}

function hunterAt(run: Run, x: number, y: number): number {
  return run.enemies.spawn(0, Role.Hunter, x, y, 1e6, 1, 0);
}

describe("enemy targeting with several heroes", () => {
  it("goes for the nearer hero and walks to him", () => {
    const run = twoPlayers();
    spread(run, 1200);
    const b = run.players[1]!.hero;
    const slot = hunterAt(run, b.x + 400, b.y);
    const before = run.enemies.x[slot];
    updateEnemies(run);
    expect(run.enemies.target[slot]).toBe(1);
    expect(run.enemies.x[slot]).toBeLessThan(before);
    expect(run.current).toBe(0);
  });

  it("keeps its target until another hero is nearer by more than the margin", () => {
    const run = twoPlayers();
    spread(run, 1000);
    const a = run.players[0]!.hero;
    const slot = hunterAt(run, a.x + 400, a.y);
    expect(enemyTarget(run, slot)).toBe(0);
    // player 1 is now a little nearer: the enemy stays on player 0
    run.enemies.x[slot] = a.x + 510;
    expect(enemyTarget(run, slot)).toBe(0);
    // nearer by more than the margin: it switches
    run.enemies.x[slot] = a.x + 500 + TARGET_SWITCH_MARGIN;
    expect(enemyTarget(run, slot)).toBe(1);
  });

  it("leaves a fallen hero for a living one", () => {
    const run = twoPlayers();
    spread(run, 1500);
    const b = run.players[1]!.hero;
    const slot = hunterAt(run, b.x + 100, b.y);
    expect(enemyTarget(run, slot)).toBe(1);
    b.hp = 0;
    expect(enemyTarget(run, slot)).toBe(0);
  });

  it("hits the hero it goes for, not the other one", () => {
    const run = twoPlayers();
    spread(run, 1500);
    const [a, b] = run.players;
    hunterAt(run, b!.hero.x + 60, b!.hero.y);
    const hpA = a!.hero.hp;
    const hpB = b!.hero.hp;
    let hitOne = false;
    for (let t = 0; t < 60; t++) {
      run.events.clear();
      updateEnemies(run);
      run.tick++;
      for (let i = 0; i < run.events.count; i++) {
        if (run.events.kind[i] === EventKind.HeroHit) {
          expect(run.events.v[i]).toBe(1);
          hitOne = true;
        }
      }
    }
    expect(hitOne).toBe(true);
    expect(b!.hero.hp).toBeLessThan(hpB);
    expect(a!.hero.hp).toBe(hpA);
  });

  it("keeps out of every hero", () => {
    const run = twoPlayers();
    // player 1 stands just behind player 0: the enemy keeps going for him (within the margin) and meets player 0
    spread(run, -60);
    const [a, b] = run.players;
    const slot = hunterAt(run, a!.hero.x + 150, a!.hero.y);
    run.enemies.target[slot] = 1;
    for (let t = 0; t < 30; t++) {
      updateEnemies(run);
      run.tick++;
      expect(run.enemies.target[slot]).toBe(1);
      const dx = run.enemies.x[slot] - a!.hero.x;
      const dy = run.enemies.y[slot] - a!.hero.y;
      const reach = a!.hero.stats.collision + run.data.enemies[0]!.collision;
      expect(dx * dx + dy * dy).toBeGreaterThanOrEqual(reach * reach - 1e-6);
    }
    expect(b!.hero.hp).toBeLessThan(b!.hero.stats.maxHp);
  });

  it("sends the storm's bolts around every living hero", () => {
    const run = twoPlayers(1);
    spread(run, 2000);
    const spreadR = (run.data.worlds[0]!.hazard as { spread: number }).spread;
    const near = [0, 0];
    debugHazard(run);
    for (let i = 0; i < run.events.count; i++) {
      if (run.events.kind[i] !== EventKind.Hazard || run.events.value[i] !== 0) continue;
      for (let p = 0; p < 2; p++) {
        const hero = run.players[p]!.hero;
        const dx = run.events.x[i] - hero.x;
        const dy = run.events.y[i] - hero.y;
        if (dx * dx + dy * dy <= spreadR * spreadR + 1e-6) near[p]!++;
      }
    }
    expect(near[0]).toBeGreaterThan(0);
    expect(near[1]).toBeGreaterThan(0);
  });
});

describe("shared XP, own gold and pickups with several heroes", () => {
  it("levels every hero together and counts the XP once", () => {
    const run = twoPlayers();
    gainXp(run, 2000, 1);
    const [a, b] = run.players;
    expect(a!.hero.level).toBeGreaterThan(1);
    expect(b!.hero.level).toBe(a!.hero.level);
    expect(b!.hero.xp).toBe(a!.hero.xp);
    expect(b!.hero.pendingLevelUps).toBe(a!.hero.pendingLevelUps);
    expect(run.stats.xpGained).toBe(2000);
    expect(run.current).toBe(0);
  });

  it("gives a coin's gold to the hero who collects it", () => {
    const run = twoPlayers();
    spread(run, 1500);
    const b = run.players[1]!.hero;
    run.coins.drop(b.x + 10, b.y, 5);
    updatePickups(run, run.coins, 1);
    expect(run.players[1]!.gold).toBeGreaterThan(0);
    expect(run.players[0]!.gold).toBe(0);
    let collector = -1;
    for (let i = 0; i < run.events.count; i++) if (run.events.kind[i] === EventKind.Pickup) collector = run.events.v[i];
    expect(collector).toBe(1);
    expect(run.current).toBe(0);
  });

  it("pulls a crystal to the nearest hero and its XP to everyone", () => {
    const run = twoPlayers();
    spread(run, 1500);
    const b = run.players[1]!.hero;
    run.crystals.drop(b.x + 10, b.y, 7);
    updatePickups(run, run.crystals, 0);
    // a kill's XP in co-op: x 1 / (1 + perPlayer.packSize) for two players (Petr's batch 3)
    expect(run.players[0]!.hero.xp).toBeCloseTo(7 * run.mods.xp, 9);
    expect(run.players[1]!.hero.xp).toBe(run.players[0]!.hero.xp);
  });

  it("heals the hero who takes a heart", () => {
    const run = twoPlayers();
    spread(run, 1500);
    const [a, b] = run.players;
    a!.hero.hp = a!.hero.stats.maxHp / 2;
    b!.hero.hp = b!.hero.stats.maxHp / 2;
    run.hearts.drop(b!.hero.x + 10, b!.hero.y, 1);
    updatePickups(run, run.hearts, 2);
    expect(b!.hero.hp).toBeGreaterThan(b!.hero.stats.maxHp / 2);
    expect(a!.hero.hp).toBe(a!.hero.stats.maxHp / 2);
  });

  it("starts an orb's effect for the hero who picks it up", () => {
    const run = twoPlayers();
    spread(run, 1500);
    const b = run.players[1]!.hero;
    const orbs = run.orbs;
    orbs.alive[0] = 1;
    orbs.kind[0] = OrbKind.Boots;
    orbs.x[0] = b.x;
    orbs.y[0] = b.y;
    updateOrbs(run);
    expect(run.players[1]!.buffs.bootsTicks).toBeGreaterThan(0);
    expect(run.players[0]!.buffs.bootsTicks).toBe(0);
    expect(orbs.alive[0]).toBe(0);
  });

  it("picks among the living heroes, and among all when every hero has fallen", () => {
    const run = twoPlayers();
    spread(run, 1500);
    const [a, b] = run.players;
    expect(nearestPlayer(run, b!.hero.x, b!.hero.y)).toBe(1);
    b!.hero.hp = 0;
    expect(nearestPlayer(run, b!.hero.x, b!.hero.y)).toBe(0);
    a!.hero.hp = 0;
    expect(nearestPlayer(run, b!.hero.x, b!.hero.y)).toBe(1);
  });
});
