import { describe, expect, it } from "vitest";
import { stateHash } from "./hash";
import { NO_INPUT, type TickInput } from "./input";
import { gainXp } from "./level-up";
import { createRun, PLAYER_START_SPACING } from "./run";
import { gameData } from "./testing/game-data";

const east: TickInput = { moveX: 1, moveY: 0, card: -1, actions: 0 };
const north: TickInput = { moveX: 0, moveY: 1, card: -1, actions: 0 };

function twoPlayers(seed = 3, startPhase?: number) {
  return createRun(gameData(), {
    seed, startPhase, players: [{ hero: "stonehorn" }, { hero: "serpent-shaman" }],
  });
}

describe("a run with several players", () => {
  it("gives every player his own hero, slots, gear and buffs", () => {
    const run = twoPlayers();
    const [a, b] = run.players;
    expect(run.players).toHaveLength(2);
    expect(a!.hero.def.id).toBe("stonehorn");
    expect(b!.hero.def.id).toBe("serpent-shaman");
    expect(b!.hero.x - a!.hero.x).toBe(PLAYER_START_SPACING);
    expect(b!.abilities).not.toBe(a!.abilities);
    expect(b!.abilities[0]!.def.id).not.toBe(a!.abilities[0]!.def.id);
    expect(b!.gear).not.toBe(a!.gear);
    expect(b!.hero.hp).toBe(b!.hero.stats.maxHp);
    expect(run.current).toBe(0);
    expect(run.hero).toBe(a!.hero);
  });

  it("refuses no players and more than four", () => {
    expect(() => createRun(gameData(), { seed: 1, players: [] })).toThrow(/1 to 4 players/);
    expect(() => createRun(gameData(), { seed: 1, players: [{}, {}, {}, {}, {}] })).toThrow(/1 to 4 players/);
  });

  it("moves each hero by his own input; a single input steers player 0 only", () => {
    const run = twoPlayers();
    const [a, b] = run.players;
    const ax = a!.hero.x;
    const by = b!.hero.y;
    run.step([east, north]);
    expect(a!.hero.x).toBeGreaterThan(ax);
    expect(b!.hero.y).toBeGreaterThan(by);
    const bx = b!.hero.x;
    run.step(east);
    expect(b!.hero.x).toBe(bx);
    expect(run.current).toBe(0);
  });

  it("casts the second player's spells and gives his wards to him", () => {
    const run = twoPlayers(5, 6);
    const shaman = run.players[1]!;
    let cast = false;
    let owned = 0;
    for (let t = 0; t < 900 && run.state !== "lost"; t++) {
      run.step([NO_INPUT, NO_INPUT]);
      if (shaman.abilities.some((s) => s.level > 0 && s.cooldown > 0)) cast = true;
      let n = 0;
      for (let i = 0; i < run.allies.capacity; i++) if (run.allies.alive[i] && run.allies.owner[i] === 1) n++;
      owned = Math.max(owned, n);
    }
    expect(cast).toBe(true);
    expect(owned).toBeGreaterThan(0);
    for (let i = 0; i < run.allies.capacity; i++) if (run.allies.alive[i]) expect(run.allies.owner[i]).toBe(1);
  });

  it("is lost only when every hero has fallen", () => {
    const run = twoPlayers();
    run.players[1]!.hero.hp = 0;
    run.step([NO_INPUT, NO_INPUT]);
    expect(run.state).toBe("playing");
    run.players[0]!.hero.hp = 0;
    run.step([NO_INPUT, NO_INPUT]);
    expect(run.state).toBe("lost");
    expect(run.result).toBe("hero");
  });

  it("opens the card offer of the player who leveled and takes his card", () => {
    const run = twoPlayers();
    run.current = 1;
    gainXp(run, 1);
    while (run.players[1]!.hero.pendingLevelUps === 0) gainXp(run, 50);
    run.current = 0;
    run.step([NO_INPUT, NO_INPUT]);
    expect(run.state).toBe("levelUp");
    expect(run.choosing).toBe(1);
    expect(run.players[1]!.offer).not.toBeNull();
    expect(run.players[0]!.offer).toBeNull();
    while (run.state === "levelUp") run.step([NO_INPUT, { ...NO_INPUT, card: 0 }]);
    expect(run.players[1]!.hero.pendingLevelUps).toBe(0);
    expect(run.players[1]!.offer).toBeNull();
  });

  it("is deterministic and hashes the second player", () => {
    const a = twoPlayers(9, 11);
    const b = twoPlayers(9, 11);
    for (let t = 0; t < 600; t++) {
      a.step([north, east]);
      b.step([north, east]);
    }
    expect(stateHash(a)).toBe(stateHash(b));
    const solo = createRun(gameData(), { seed: 9, startPhase: 11, hero: "stonehorn" });
    for (let t = 0; t < 600; t++) solo.step(north);
    expect(stateHash(solo)).not.toBe(stateHash(a));
  });
});
