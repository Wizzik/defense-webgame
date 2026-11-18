import { afterEach, describe, expect, it } from "vitest";
import { Role } from "../enemies";
import { EventKind } from "../events";
import { NO_INPUT } from "../input";
import { createRun } from "../run";
import { gameData } from "../testing/game-data";
import { UPDATERS } from "./kinds";
import { stateHash } from "../hash";
import {
  CastMode, castMode, debugSetAbilityLevel, EMPTY_ABILITY, firstEmptySlot, hasAbility, isEmptySlot, learnAbility,
  passiveSlotRange, sharedSlotRange, startCast, ULTIMATE_SLOT,
} from "./slots";
import { silenceSpawns } from "../testing/silence";

function quietData() {
  const data = gameData();
  data.rules.arena = {
    width: 6000, height: 5000, castle: { x: 0, y: -2400 }, heroStart: { x: 0, y: 0 },
    spawn: { radius: 2000, spread: 150 },
  };
  silenceSpawns(data);
  return data;
}

function castSlots(run: ReturnType<typeof createRun>): number[] {
  const out: number[] = [];
  for (let k = 0; k < run.events.count; k++) if (run.events.kind[k] === EventKind.Cast) out.push(run.events.a[k]);
  return out;
}

/** Updaters replaced by a test, restored afterwards (undefined = there was none). */
const replaced = new Map<string, unknown>();
function stubUpdater(kind: string, fn: unknown): void {
  const updaters = UPDATERS as Record<string, unknown>;
  if (!replaced.has(kind)) replaced.set(kind, updaters[kind]);
  updaters[kind] = fn;
}
afterEach(() => {
  const updaters = UPDATERS as Record<string, unknown>;
  for (const [kind, fn] of replaced) {
    if (fn === undefined) delete updaters[kind];
    else updaters[kind] = fn;
  }
  replaced.clear();
});

describe("ability slots", () => {
  it("createRun picks the chosen hero", () => {
    const run = createRun(quietData(), { seed: 1, hero: "gravecaller" });
    expect(run.abilities.map((s) => s.def.id)).toEqual(
      ["grave-grasp", "skull-ring", "soul-bolt", "bone-stampede", "", "", "", "", "", ""],
    );
    expect(run.abilities.map((s) => s.level)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("the default hero comes from rules.start", () => {
    const data = quietData();
    data.rules.start.hero = "nightglaive";
    const run = createRun(data, { seed: 1 });
    expect(run.hero.def.id).toBe("nightglaive");
    expect(run.abilities[0].def.id).toBe(run.hero.def.signatureAbilities[0]);
    expect(run.abilities[ULTIMATE_SLOT].def.id).toBe(run.hero.def.ultimate);
  });

  it("unknown hero throws", () => {
    expect(() => createRun(quietData(), { seed: 1, hero: "nobody" })).toThrow('createRun: unknown hero "nobody"');
  });

  it("unlearned slots never cast", () => {
    const run = createRun(quietData(), { seed: 1, hero: "stonehorn" });
    run.enemies.spawn(0, Role.Hunter, 0, 300, 100000, 1, 0);
    const seen = new Set<number>();
    for (let n = 0; n < 60; n++) {
      run.step(NO_INPUT);
      for (const a of castSlots(run)) seen.add(a);
    }
    expect([...seen]).toEqual([0]);
  });

  it("unsupported kind throws", () => {
    const run = createRun(quietData(), { seed: 1, hero: "stonehorn" });
    const chain = run.data.abilities.find((a) => a.kind === "line")!;
    run.abilities[1].def = { ...chain, kind: "warp" } as unknown as typeof chain;
    run.abilities[1].level = 1;
    expect(() => run.step(NO_INPUT)).toThrow("sim: ability kind warp is not implemented");
  });

  it("the ultimate waits while auto is off", () => {
    const run = createRun(quietData(), { seed: 1, hero: "stonehorn" });
    stubUpdater("nova", (r: typeof run, _s: unknown, i: number) => {
      if (castMode(r, i) !== CastMode.None) startCast(r, i, 0, 0, 0, 0, 0);
    });
    debugSetAbilityLevel(run, ULTIMATE_SLOT, 1);
    run.ultimateAuto = false;
    run.step(NO_INPUT);
    expect(castMode(run, ULTIMATE_SLOT)).toBe(CastMode.None);
    expect(castSlots(run)).not.toContain(3);
    run.ultimateRequested = true;
    expect(castMode(run, ULTIMATE_SLOT)).toBe(CastMode.Forced);
    run.step(NO_INPUT);
    expect(castSlots(run)).toContain(3);
    expect(run.ultimateRequested).toBe(false);
  });
});

describe("shared spell and passive slots", () => {
  const index = (run: ReturnType<typeof createRun>, id: string) => run.data.abilities.findIndex((a) => a.id === id);

  it("a run starts with 10 slots; 4-5 are shared spells, 6-9 passives, all empty and silent", () => {
    const run = createRun(quietData(), { seed: 1 });
    expect(run.abilities).toHaveLength(10);
    expect(sharedSlotRange(run)).toEqual([4, 6]);
    expect(passiveSlotRange(run)).toEqual([6, 10]);
    for (let i = 4; i < 10; i++) {
      expect(isEmptySlot(run.abilities[i])).toBe(true);
      expect(run.abilities[i].def).toBe(EMPTY_ABILITY);
      expect(run.abilities[i].hit.length).toBe(run.enemies.capacity);
    }
    for (let t = 0; t < 60; t++) run.step(NO_INPUT);
    expect(castSlots(run).filter((s) => s >= 4)).toEqual([]);
  });

  it("learnAbility fills an empty slot at level 1 with a ready cooldown", () => {
    const run = createRun(quietData(), { seed: 1 });
    learnAbility(run, 4, index(run, "arc-lightning"));
    learnAbility(run, 6, index(run, "might"));
    expect(run.abilities[4].def.id).toBe("arc-lightning");
    expect([run.abilities[4].level, run.abilities[4].cooldown]).toEqual([1, 0]);
    expect(run.abilities[6].def.id).toBe("might");
    expect(hasAbility(run, run.abilities[6].def)).toBe(true);
    expect(firstEmptySlot(run, sharedSlotRange(run))).toBe(5);
    expect(firstEmptySlot(run, passiveSlotRange(run))).toBe(7);
  });

  it("learnAbility refuses a taken slot, a spell outside the pool, a second copy and the wrong slot range", () => {
    const run = createRun(quietData(), { seed: 1 });
    learnAbility(run, 4, index(run, "smite"));
    expect(() => learnAbility(run, 4, index(run, "meteor"))).toThrow("not an empty slot");
    expect(() => learnAbility(run, 0, index(run, "meteor"))).toThrow("not an empty slot");
    expect(() => learnAbility(run, 5, index(run, "rock-rupture"))).toThrow("not in the shared spell pool");
    expect(() => learnAbility(run, 5, index(run, "smite"))).toThrow("already has");
    expect(() => learnAbility(run, 6, index(run, "meteor"))).toThrow("cannot hold");
    expect(() => learnAbility(run, 5, index(run, "might"))).toThrow("cannot hold");
    expect(() => learnAbility(run, 5, 9999)).toThrow("unknown ability");
  });

  it("debugSetAbilityLevel leaves an empty slot empty", () => {
    const run = createRun(quietData(), { seed: 1 });
    debugSetAbilityLevel(run, 5, 3);
    expect(run.abilities[5].level).toBe(0);
    expect(isEmptySlot(run.abilities[5])).toBe(true);
  });

  it("the state hash changes when a slot is learned", () => {
    const a = createRun(quietData(), { seed: 1 });
    const b = createRun(quietData(), { seed: 1 });
    expect(stateHash(a)).toBe(stateHash(b));
    learnAbility(b, 6, index(b, "haste"));
    b.abilities[6].level = 0; // the ability alone, not its level, must change the hash
    expect(stateHash(a)).not.toBe(stateHash(b));
  });
});
