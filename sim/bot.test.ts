import { describe, expect, it } from "vitest";
import { debugSetAbilityLevel } from "./abilities/slots";
import { EventKind } from "./events";
import { botCard, botChestChoice, botInput, CHASE_DISTANCE, DEFEND_RADIUS, HOME_OFFSET, LEASH_DISTANCE } from "./bot";
import { chestPrice } from "./chests";
import { silenceSpawns } from "./testing/silence";
import { Charge } from "./enemy-charge";
import { stateHash } from "./hash";
import { InputAction, NO_INPUT } from "./input";
import type { TickInput } from "./input";
import { Role } from "./enemies";
import { createRun } from "./run";
import { spawnBoss } from "./timeline";
import type { Run } from "./run";
import { gameData } from "./testing/game-data";

function play(seed: number, onStep?: (run: Run) => void, record?: TickInput[], hero?: string): Run {
  const run = createRun(gameData(), { seed, hero });
  const input: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
  let guard = 0;
  while (run.state !== "won" && run.state !== "lost") {
    botInput(run, input);
    if (record) record.push({ ...input });
    run.step(input);
    onStep?.(run);
    if (++guard > run.durationTicks + 400 * 30) throw new Error("run did not end");
  }
  return run;
}

const rangedHero = gameData().heroes.find((h) => h.baseAttack.kind !== "melee")!;
const meleeHero = gameData().heroes.find((h) => h.baseAttack.kind === "melee")!;

describe("autopilot", () => {
  it("a bot run ends by a loss or by the fall of the final boss", () => {
    const run = play(1, (r) => {
      expect(r.enemies.aliveCount).toBeLessThanOrEqual(r.data.rules.enemies.maxAlive);
      expect(r.hero.hp).toBeLessThanOrEqual(r.hero.stats.maxHp);
      expect(Number.isNaN(r.hero.x) || Number.isNaN(r.hero.y)).toBe(false);
      for (let i = 0; i < r.enemies.capacity; i++) {
        if (r.enemies.alive[i] === 0) continue;
        expect(Number.isNaN(r.enemies.x[i]) || Number.isNaN(r.enemies.y[i])).toBe(false);
      }
    });
    expect(["won", "lost"]).toContain(run.state);
    expect(run.tick).toBeLessThanOrEqual(run.durationTicks + 400 * 30);
    if (run.state === "won") expect(run.finalBossDead).toBe(true);
  });

  it("replaying recorded inputs gives the same hash", () => {
    const inputs: TickInput[] = [];
    const first = play(2, undefined, inputs);
    const replay = createRun(gameData(), { seed: 2 });
    for (const input of inputs) replay.step(input);
    expect(stateHash(replay)).toBe(stateHash(first));
    expect(replay.result).toBe(first.result);
    expect(replay.tick).toBe(first.tick);
  });

  for (const hero of gameData().heroes.map((h) => h.id)) {
    it(`replaying recorded inputs gives the same hash (${hero})`, () => {
      const inputs: TickInput[] = [];
      const first = play(3, undefined, inputs, hero);
      expect(inputs.length).toBeGreaterThan(0);
      const replay = createRun(gameData(), { seed: 3, hero });
      for (const input of inputs) replay.step(input);
      expect(stateHash(replay)).toBe(stateHash(first));
      expect(replay.tick).toBe(first.tick);
    });
  }

  it("three seeds give three different hashes", () => {
    const hashes = new Set([1, 2, 3].map((seed) => stateHash(play(seed))));
    expect(hashes.size).toBe(3);
  });

  /** A run with the hero on the bot's home spot, no enemies and no spell ready. */
  const postRun = (hero?: string) => {
    const run = createRun(gameData(), { seed: 1, hero });
    run.hero.x = run.castle.x;
    run.hero.y = run.castle.y + HOME_OFFSET;
    // spells cool down, so the bot does not stand still to aim a line
    for (const slot of run.abilities) slot.cooldown = 30;
    return run;
  };
  const put = (run: Run, slot: number, x: number, y: number) => {
    run.enemies.alive[slot] = 1;
    run.enemies.aliveCount++;
    run.enemies.x[slot] = x;
    run.enemies.y[slot] = y;
  };
  const move = (run: Run) => botInput(run, { moveX: 0, moveY: 0, card: -1, actions: 0 });

  it("the bot goes home when nothing threatens the castle", () => {
    const run = postRun();
    expect(move(run)).toEqual({ moveX: 0, moveY: 0, card: -1, actions: 0 });
    run.hero.x = run.castle.x + 800;
    run.hero.y = run.castle.y;
    expect(move(run)).toMatchObject({ moveX: -1, moveY: 1 });
    // an enemy far from the castle and far from the hero changes nothing
    put(run, 0, run.castle.x + DEFEND_RADIUS + 600, run.castle.y);
    expect(move(run)).toMatchObject({ moveX: -1, moveY: 1 });
  });

  it("the bot walks to the enemy nearest to the castle", () => {
    const run = postRun(meleeHero.id);
    const { castle } = run;
    // nearer to the hero, but outside the defended circle
    put(run, 0, castle.x + 400, castle.y + DEFEND_RADIUS + 100);
    // farther from the hero, inside the circle: the threat
    put(run, 1, castle.x - DEFEND_RADIUS + 100, castle.y);
    expect(move(run)).toMatchObject({ moveX: -1, moveY: -1 });
    // of two threats the one nearer to the castle wins
    put(run, 2, castle.x + 600, castle.y + HOME_OFFSET);
    expect(move(run)).toMatchObject({ moveX: 1, moveY: 0 });
  });

  it("without a threat the bot fights the enemy near the hero", () => {
    const run = postRun(meleeHero.id);
    run.hero.y = run.castle.y + DEFEND_RADIUS + 200;
    put(run, 0, run.hero.x + CHASE_DISTANCE - 50, run.hero.y);
    expect(move(run)).toMatchObject({ moveX: 1, moveY: 0 });
    // farther than the chase distance it goes home instead
    run.enemies.x[0] = run.hero.x + CHASE_DISTANCE + 100;
    expect(move(run)).toMatchObject({ moveX: 0, moveY: -1 });
  });

  it("the bot walks back when it is too far from the castle", () => {
    const run = postRun(rangedHero.id);
    run.hero.x = run.castle.x + LEASH_DISTANCE + 200;
    // an enemy at its heels would make it back off farther; the leash wins
    put(run, 0, run.hero.x - 100, run.hero.y);
    expect(move(run)).toMatchObject({ moveX: -1 });
    run.hero.x = run.castle.x + LEASH_DISTANCE - 300;
    run.enemies.x[0] = run.hero.x - 100;
    expect(move(run)).toMatchObject({ moveX: 1 });
  });

  it("the bot stands still to aim a line spell that is ready", () => {
    const lineHero = gameData().heroes.find((h) => gameData().abilities.find((a) => a.id === h.signatureAbilities[0])!.kind === "line")!;
    const run = postRun(lineHero.id);
    // a threat to walk to, inside the length of the line
    put(run, 0, run.hero.x + 700, run.hero.y);
    run.abilities[0].cooldown = 0;
    expect(move(run)).toMatchObject({ moveX: 0, moveY: 0 });
    // while the spell cools down the bot walks
    run.abilities[0].cooldown = 30;
    expect(move(run)).toMatchObject({ moveX: 1, moveY: 0 });
  });

  it("a ranged hero stops in reach of its target and backs off from a close enemy", () => {
    const reach = rangedHero.baseAttack.range;
    const run = postRun(rangedHero.id);
    put(run, 0, run.hero.x + reach + 300, run.hero.y);
    expect(move(run).moveX).toBe(1);
    run.enemies.x[0] = run.hero.x + reach - 100;
    expect(move(run).moveX).toBe(0);
    run.enemies.x[0] = run.hero.x + 100;
    expect(move(run).moveX).toBe(-1);
  });

  it("the bot sidesteps a charge", () => {
    const run = postRun();
    put(run, 0, run.hero.x + 500, run.hero.y);
    run.enemies.chargeState[0] = Charge.Windup;
    const dodge = move(run);
    expect(dodge.moveX).toBe(0);
    expect(Math.abs(dodge.moveY)).toBe(1);
    expect(dodge.actions & InputAction.Dash).toBe(InputAction.Dash);
    // with the dash on cooldown it still walks out of the line
    run.hero.dashCooldown = 50;
    const walk = move(run);
    expect(Math.abs(walk.moveY)).toBe(1);
    expect(walk.actions & InputAction.Dash).toBe(0);
    // a windup far away is ignored
    run.enemies.x[0] = run.hero.x + 900;
    expect(move(run).actions & InputAction.Dash).toBe(0);
  });

  it("the bot walks out of a slam circle", () => {
    const run = postRun();
    const boss = spawnBoss(run, run.data.enemies.findIndex((e) => e.id === "iron-marshal"), Role.Hunter);
    const radius = run.data.enemies[run.enemies.type[boss]!]!.slam!.radius;
    run.enemies.x[boss] = run.hero.x + 120;
    run.enemies.y[boss] = run.hero.y;
    run.enemies.slamCooldown[boss] = 0;
    run.enemies.attackCooldown[boss] = 1_000_000;
    run.enemies.chargeCooldown[boss] = 1_000_000;
    const input: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
    let landed = false;
    for (let i = 0; i < 40 && !landed; i++) {
      botInput(run, input);
      if (i === 1) expect(input.moveX).toBe(-1); // straight away from the centre of the circle
      run.step(input);
      for (let k = 0; k < run.events.count; k++) {
        if (run.events.kind[k] === EventKind.Slam && run.events.value[k] === 1) landed = true;
        expect(run.events.kind[k]).not.toBe(EventKind.HeroHit);
      }
    }
    expect(landed).toBe(true);
    const dx = run.hero.x - run.enemies.slamX[boss]!;
    const dy = run.hero.y - run.enemies.slamY[boss]!;
    expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThan(radius);
  });

  it("a slam circle the hero is not in changes nothing", () => {
    const run = postRun();
    const boss = spawnBoss(run, run.data.enemies.findIndex((e) => e.id === "iron-marshal"), Role.Sieger);
    run.enemies.x[boss] = run.hero.x + 2500;
    run.enemies.y[boss] = run.hero.y;
    const calm = { ...move(run) };
    run.enemies.slamState[boss] = 1;
    run.enemies.slamX[boss] = run.hero.x + 350 + 61;
    run.enemies.slamY[boss] = run.hero.y;
    expect(move(run)).toEqual(calm);
    run.enemies.slamX[boss] = run.hero.x + 350 + 59;
    expect(move(run).moveX).toBe(-1);
  });

  it("the bot fights the final boss in the finale", () => {
    const run = postRun();
    // a threat west of the castle, the final boss far to the east
    put(run, 0, run.castle.x - 600, run.castle.y + HOME_OFFSET);
    expect(move(run).moveX).toBe(-1);
    const boss = spawnBoss(run, run.finalBossType, Role.Hunter);
    run.enemies.x[boss] = run.castle.x + 1800;
    run.enemies.y[boss] = run.castle.y + HOME_OFFSET;
    expect(move(run).moveX).toBe(-1); // not the final boss of this run yet
    run.finalBossSlot = boss;
    expect(move(run)).toMatchObject({ moveX: 1, moveY: 0 });
  });

  it("picks card 0 in the level-up state when no offer is open", () => {
    const run = createRun(gameData(), { seed: 1 });
    run.state = "levelUp";
    expect(botInput(run, { moveX: 1, moveY: 1, card: -1, actions: 0 })).toEqual({ moveX: 0, moveY: 0, card: 0, actions: 0 });
  });

  it("botCard picks the first spell card, else the first card", () => {
    const attribute = { kind: "attribute", attribute: "str", amount: 10 } as const;
    const ability = { kind: "ability", slot: 1, fromLevel: 0, toLevel: 1 } as const;
    expect(botCard({ cards: [attribute, ability, ability] })).toBe(1);
    expect(botCard({ cards: [attribute, attribute] })).toBe(0);
  });

  it("takes a spell card before an attribute card", () => {
    const run = createRun(gameData(), { seed: 1 });
    run.state = "levelUp";
    run.offer = { cards: [
      { kind: "attribute", attribute: "str", amount: 10 },
      { kind: "ability", slot: 1, fromLevel: 0, toLevel: 1 },
      { kind: "ability", slot: 0, fromLevel: 1, toLevel: 2 },
    ] };
    expect(botInput(run, { moveX: 0, moveY: 0, card: -1, actions: 0 }).card).toBe(1);
    run.offer = { cards: [
      { kind: "attribute", attribute: "str", amount: 10 },
      { kind: "attribute", attribute: "agi", amount: 10 },
    ] };
    expect(botInput(run, { moveX: 0, moveY: 0, card: -1, actions: 0 }).card).toBe(0);
  });
});

const HEROES = gameData().heroes.map((h) => h.id);

describe("abilities of every hero", () => {
  for (const hero of HEROES) {
    it(`every hero casts all its abilities in a run (${hero})`, () => {
      const run = createRun(gameData(), { seed: 1, hero, durationSeconds: 120 });
      for (let i = 0; i < run.abilities.length; i++) debugSetAbilityLevel(run, i, 1);
      const casts = run.abilities.map(() => 0);
      const input: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
      while (run.state !== "won" && run.state !== "lost") {
        botInput(run, input);
        // a wounded hero: heals and shields cast only below their hp threshold
        run.hero.hp = Math.min(run.hero.hp, run.hero.stats.maxHp * 0.3);
        run.step(input);
        for (let k = 0; k < run.events.count; k++) {
          if (run.events.kind[k] === EventKind.Cast) casts[run.events.a[k]!]!++;
        }
      }
      run.abilities.forEach((slot, i) => {
        const def = slot.def;
        // auras and on_hit bonuses work on every attack without a cast
        const passive = def.kind === "aura" || (def.kind === "on_hit" && def.params.empower === undefined);
        if (!passive) expect(casts[i], `${hero}: ${def.id}`).toBeGreaterThan(0);
      });
    });
  }
});

// Balance of the full run (phase 2b-3): the targets are measured on seeds 1 to 20 with `npm run sim:run` and
// written down in docs/DECISIONS.md with the heroes that miss them. CI only guards the shape of a run, on three
// seeds a hero: it ends, and a player who does nothing loses early.
const SEEDS = [1, 2, 3];
const RUN_ENDS_BY_SECONDS = 1400;
const IDLE_LOSES_BY_SECONDS = 240;
/** The Gravecaller is outside the bands (its kit waits for a redesign): its idle runs last longer. */
const IDLE_GAPS: Record<string, number> = { gravecaller: 300 };

describe("balance", () => {
  for (const hero of HEROES) {
    it(`every hero's run ends by a loss or by killing the final boss within ${RUN_ENDS_BY_SECONDS} s (${hero})`, () => {
      for (const seed of SEEDS) {
        const run = play(seed, undefined, undefined, hero);
        expect(run.tick, `seed ${seed}`).toBeLessThanOrEqual(RUN_ENDS_BY_SECONDS * 30);
        if (run.state === "won") {
          expect(run.finalBossDead, `seed ${seed}`).toBe(true);
          expect(run.tick, `seed ${seed}`).toBeGreaterThan(run.durationTicks);
        } else {
          expect(["castle", "hero"], `seed ${seed}`).toContain(run.result);
        }
      }
    });

    const idleSeconds = IDLE_GAPS[hero] ?? IDLE_LOSES_BY_SECONDS;
    it(`the idle player loses within ${idleSeconds} s (${hero})`, () => {
      for (const seed of SEEDS) {
        const run = createRun(gameData(), { seed, hero });
        const input: TickInput = { ...NO_INPUT };
        while (run.state !== "won" && run.state !== "lost") {
          // no movement and no action; at a level-up the attribute card, so the first spell stays alone
          input.card = run.offer ? Math.max(0, run.offer.cards.findIndex((c) => c.kind === "attribute")) : -1;
          run.step(input);
          if (run.tick > idleSeconds * 30) break;
        }
        expect(run.state, `seed ${seed}`).toBe("lost");
        expect(run.tick, `seed ${seed}`).toBeLessThanOrEqual(idleSeconds * 30);
      }
    });
  }

  describe("chests", () => {
    const quiet = (hero?: string) => {
      const data = gameData();
      silenceSpawns(data);
      return createRun(data, { seed: 3, durationSeconds: 100000, hero });
    };
    const nearestChest = (run: Run) => {
      let best = 0;
      let bestSq = Infinity;
      for (let i = 0; i < run.chests.x.length; i++) {
        const dx = run.chests.x[i]! - run.hero.x;
        const dy = run.chests.y[i]! - run.hero.y;
        if (dx * dx + dy * dy < bestSq) {
          bestSq = dx * dx + dy * dy;
          best = i;
        }
      }
      return best;
    };

    it("with the gold and a healthy hero the bot walks to the nearest chest", () => {
      const run = quiet();
      run.gold = chestPrice(run);
      const input = botInput(run, { moveX: 0, moveY: 0, card: -1, actions: 0 });
      const chest = nearestChest(run);
      const dx = run.chests.x[chest]! - run.hero.x;
      const dy = run.chests.y[chest]! - run.hero.y;
      expect(input.moveX !== 0 || input.moveY !== 0).toBe(true);
      expect(input.moveX * dx + input.moveY * dy).toBeGreaterThan(0);
      let guard = 0;
      while (run.state !== "chest" && guard++ < 3000) run.step(botInput(run, input));
      expect(run.state).toBe("chest");
    });

    it("without the gold, with a hurt hero or a hurt castle the bot stays at its post", () => {
      const poor = quiet();
      poor.gold = chestPrice(poor) - 1;
      const hurt = quiet();
      hurt.gold = 1000;
      hurt.hero.hp = hurt.hero.stats.maxHp * 0.29;
      const siege = quiet();
      siege.gold = 1000;
      siege.castle.hp = siege.castle.maxHp * 0.49;
      for (const run of [poor, hurt, siege]) {
        const input = botInput(run, { moveX: 0, moveY: 0, card: -1, actions: 0 });
        // The hero starts next to its post: with no chest to go for it does not walk away from the castle.
        const before = Math.abs(run.hero.x - run.castle.x) + Math.abs(run.hero.y - run.castle.y);
        for (let i = 0; i < 90; i++) run.step(botInput(run, input));
        const after = Math.abs(run.hero.x - run.castle.x) + Math.abs(run.hero.y - run.castle.y);
        expect(after).toBeLessThanOrEqual(before + 1);
      }
    });

    it("picks the offered slot with the lowest level, the first one on a tie", () => {
      const run = quiet();
      run.chestOffer = { slots: [4, 7, 2] };
      run.state = "chest";
      expect(botChestChoice(run)).toBe(0);
      run.gear.item[4] = 0;
      run.gear.temp[4] = 2;
      run.gear.item[7] = 0;
      run.gear.base[7] = 1;
      expect(botChestChoice(run)).toBe(2);
      run.gear.item[2] = 0;
      run.gear.temp[2] = 3;
      expect(botChestChoice(run)).toBe(1);
      expect(botInput(run, { moveX: 1, moveY: 1, card: -1, actions: 0 })).toEqual({ moveX: 0, moveY: 0, card: 1, actions: 0 });
    });
  });
});
