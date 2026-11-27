import { describe, expect, it } from "vitest";
import { botInput } from "./bot";
import { CHOICE_TICKS } from "./coop-choice";
import { damageHero } from "./combat";
import { Role } from "./enemies";
import { updateEnemies } from "./enemy-ai";
import { rootHero } from "./hero-snares";
import { NO_INPUT, type TickInput } from "./input";
import { gainXp } from "./level-up";
import { createRun, type Run } from "./run";
import { enemyTarget } from "./targets";
import { gameData, openArena } from "./testing/game-data";
import { silenceSpawns } from "./testing/silence";

// Multiplayer migration step 5: co-op offers and chests without a pause, with a choice time.

function twoPlayers(): Run {
  const data = openArena(gameData());
  silenceSpawns(data);
  return createRun(data, { seed: 6, durationSeconds: 100000, players: [{ hero: "stonehorn" }, { hero: "sparkshot" }] });
}

/** Levels both heroes once and steps, so each has an open offer with a fresh choice time. */
function openOffers(run: Run): void {
  gainXp(run, run.data.rules.progression.xpFirst, 1);
  run.step([NO_INPUT, NO_INPUT]);
}

const pick: TickInput = { ...NO_INPUT, card: 0 };

describe("co-op card choice without a pause", () => {
  it("keeps the run going and opens a choice time for every player", () => {
    const run = twoPlayers();
    openOffers(run);
    expect(run.state).toBe("playing");
    for (const p of run.players) {
      expect(p.offer).not.toBeNull();
      expect(p.choosingTicks).toBe(CHOICE_TICKS);
    }
    const tick = run.tick;
    run.step([NO_INPUT, NO_INPUT]);
    expect(run.tick).toBe(tick + 1);
    expect(run.players[0]!.choosingTicks).toBe(CHOICE_TICKS - 1);
  });

  it("makes a choosing hero immune, also to roots", () => {
    const run = twoPlayers();
    openOffers(run);
    run.current = 1;
    const hero = run.hero;
    const hp = hero.hp;
    expect(damageHero(run, 500, -1)).toBe(0);
    rootHero(run, 30);
    expect(hero.hp).toBe(hp);
    expect(hero.rootTicks).toBe(0);
    run.current = 0;
  });

  it("lets enemies ignore a choosing hero and go for the other, or for the castle", () => {
    const run = twoPlayers();
    const [a, b] = run.players;
    b!.hero.x = a!.hero.x + 1500;
    const slot = run.enemies.spawn(0, Role.Hunter, b!.hero.x + 100, b!.hero.y, 1e6, 1, 0);
    expect(enemyTarget(run, slot)).toBe(1);
    b!.choosingTicks = 50;
    expect(enemyTarget(run, slot)).toBe(0);
    a!.choosingTicks = 50;
    expect(enemyTarget(run, slot)).toBe(-1);
    updateEnemies(run);
    expect(run.current).toBe(0);
  });

  it("stops the hero's attacks and spells during the choice time and starts them after it", () => {
    const run = twoPlayers();
    openOffers(run);
    const shooter = run.players[1]!;
    // an enemy right next to the sparkshot that does not die
    run.enemies.spawn(0, Role.Sieger, shooter.hero.x + 80, shooter.hero.y, 1e9, 0, 0);
    let hitsInWindow = 0;
    for (let t = 0; t < CHOICE_TICKS - 2; t++) {
      run.step([NO_INPUT, NO_INPUT]);
      if (shooter.choosingTicks > 0 && shooter.hero.attackCooldown > 0) hitsInWindow++;
    }
    expect(hitsInWindow).toBe(0);
    let attacked = false;
    for (let t = 0; t < 120 && !attacked; t++) {
      run.step([NO_INPUT, NO_INPUT]);
      if (shooter.hero.attackCooldown > 0) attacked = true;
    }
    expect(shooter.choosingTicks).toBe(0);
    expect(shooter.offer).not.toBeNull(); // the offer waits; the autopilot does not pick for him
    expect(attacked).toBe(true);
  });

  it("keeps the choice time over a chained level-up and ends it with the last card", () => {
    const run = twoPlayers();
    let xp = 0;
    while (run.players[1]!.hero.pendingLevelUps < 2) {
      gainXp(run, 10);
      xp += 10;
    }
    expect(xp).toBeGreaterThan(0);
    run.step([NO_INPUT, NO_INPUT]);
    const p = run.players[1]!;
    run.step([NO_INPUT, pick]);
    expect(p.offer).not.toBeNull();
    expect(p.choosingTicks).toBe(CHOICE_TICKS - 1);
    while (p.offer) run.step([NO_INPUT, pick]);
    expect(p.choosingTicks).toBe(0);
  });

  it("opens a chest for the buyer only, without a pause", () => {
    const run = twoPlayers();
    const b = run.players[1]!;
    b.gold = 1e6;
    b.hero.x = run.chests.x[0]!;
    b.hero.y = run.chests.y[0]!;
    run.step([NO_INPUT, NO_INPUT]);
    expect(run.state).toBe("playing");
    expect(b.chestOffer).not.toBeNull();
    expect(run.players[0]!.chestOffer).toBeNull();
    expect(b.choosingTicks).toBe(CHOICE_TICKS);
    run.step([NO_INPUT, pick]);
    expect(b.chestOffer).toBeNull();
    expect(b.choosingTicks).toBe(0);
    expect(run.chestsOpened).toBe(1);
  });

  it("lets the autopilot pick and keep walking", () => {
    const run = twoPlayers();
    openOffers(run);
    const out: TickInput = { ...NO_INPUT };
    run.current = 1;
    botInput(run, out);
    run.current = 0;
    expect(out.card).toBeGreaterThanOrEqual(0);
  });

  it("leaves the one-player pause as it was", () => {
    const run = createRun(gameData(), { seed: 6 });
    gainXp(run, run.data.rules.progression.xpFirst, 1);
    run.step(NO_INPUT);
    expect(run.state).toBe("levelUp");
    expect(run.players[0]!.choosingTicks).toBe(0);
  });
});
