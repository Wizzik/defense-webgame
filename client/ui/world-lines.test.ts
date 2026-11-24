import { describe, expect, it } from "vitest";
import { gameData } from "../../sim/testing/game-data";
import { difficultyName, worldCard, worldDetail } from "./world-lines";

/** The table of the plan, so tuning cannot break the texts. */
function data() {
  const d = gameData();
  d.rules.difficulty.worldStep = { hp: 0.25, damage: 0.25 };
  d.rules.difficulty.reward = { goldPerWorld: 0.1, magicFindPerWorld: 0.1 };
  d.rules.difficulty.levels.normal = { ...d.rules.difficulty.levels.normal, hp: 1, magicFind: 0 };
  d.rules.difficulty.levels.insane = { ...d.rules.difficulty.levels.insane, hp: 1.75, magicFind: 0.25 };
  d.rules.difficulty.levels.hell = { ...d.rules.difficulty.levels.hell, hp: 3, magicFind: 0.5 };
  return d;
}

describe("worldCard", () => {
  it("shows a win, a phase, the finale or nothing", () => {
    const d = data();
    expect(worldCard(d, 1, { won: true, phase: 21 }, true, "cs")).toEqual({ name: "Stříbrná marka", status: "★ výhra", locked: false, preparing: false });
    expect(worldCard(d, 1, { won: true, phase: 21 }, true, "en").status).toBe("★ win");
    expect(worldCard(d, 2, { won: false, phase: 14 }, true, "cs").status).toBe("fáze 14");
    expect(worldCard(d, 2, { won: false, phase: 14 }, true, "en").status).toBe("phase 14");
    expect(worldCard(d, 2, { won: false, phase: 21 }, true, "cs").status).toBe("finále");
    expect(worldCard(d, 2, { won: false, phase: 21 }, true, "en").status).toBe("finale");
    expect(worldCard(d, 2, undefined, true, "en").status).toBe("");
  });

  it("a locked card and a world that is not ready yet", () => {
    const d = data();
    d.worlds[3]!.ready = false;
    const locked = worldCard(d, 4, undefined, false, "en");
    expect(locked).toEqual({ name: "Frostreach", status: "", locked: true, preparing: true });
    expect(worldCard(d, 1, undefined, true, "en").preparing).toBe(false);
    expect(worldCard(d, 3, undefined, false, "en")).toEqual({ name: "Shadewood", status: "", locked: true, preparing: false });
  });
});

describe("worldDetail", () => {
  it("world 3 insane: blurb, enemy strength and reward in Czech", () => {
    const d = data();
    expect(worldDetail(d, 3, "insane", "cs")).toEqual([
      d.worlds[2]!.blurb.cs,
      "Síla nepřátel ×2,63",
      "Odměna: zlato ×1,2, Magic Find +45 %",
      "Přírodní situace: Trnité houští",
    ]);
  });

  it("world 2 normal in English", () => {
    const d = data();
    expect(worldDetail(d, 2, "normal", "en")).toEqual([
      d.worlds[1]!.blurb.en,
      "Enemy strength ×1.25",
      "Reward: gold ×1.1, Magic Find +10%",
      "Natural event: Sandstorm",
    ]);
  });

  it("world 1 normal has no extra reward; world 1 hell only magic find", () => {
    const d = data();
    expect(worldDetail(d, 1, "normal", "cs").slice(1, 3)).toEqual(["Síla nepřátel ×1", "Bez odměny navíc"]);
    expect(worldDetail(d, 1, "normal", "en").slice(1, 3)).toEqual(["Enemy strength ×1", "No extra reward"]);
    expect(worldDetail(d, 1, "hell", "en").slice(1, 3)).toEqual(["Enemy strength ×3", "Reward: Magic Find +50%"]);
  });

  it("names the world's natural event in both languages, for every world", () => {
    const d = data();
    for (let w = 1; w <= d.worlds.length; w++) {
      expect(worldDetail(d, w, "normal", "en").at(-1)).toBe(`Natural event: ${d.worlds[w - 1]!.hazard.name.en}`);
      expect(worldDetail(d, w, "normal", "cs").at(-1)).toBe(`Přírodní situace: ${d.worlds[w - 1]!.hazard.name.cs}`);
    }
  });
});

describe("difficultyName", () => {
  it("names the three difficulties", () => {
    expect(["normal", "insane", "hell"].map((id) => difficultyName(id as "normal", "en"))).toEqual(["Normal", "Insane", "Hell"]);
  });
});
