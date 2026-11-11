import { describe, expect, it } from "vitest";
import { loadGameData } from "../game/data";
import { layoutProps } from "./prop-layout";

const { rules } = loadGameData();
const MODELS = 8;
const centre = rules.arena.castle;

describe("layoutProps", () => {
  it("gives the same result for the same seed and another for another seed", () => {
    expect(layoutProps(rules, MODELS, 1)).toEqual(layoutProps(rules, MODELS, 1));
    expect(layoutProps(rules, MODELS, 1)).not.toEqual(layoutProps(rules, MODELS, 2));
  });

  it("keeps every prop outside the spawn ring (nothing the enemies would walk through)", () => {
    const inner = rules.arena.spawn.radius + 250 - 80;
    for (const p of layoutProps(rules, MODELS, 1)) {
      expect(Math.hypot(p.x - centre.x, p.y - centre.y)).toBeGreaterThan(inner);
    }
  });

  it("stays within 900 (plus the 80 jitter) past the arena edge", () => {
    const limitX = rules.arena.width / 2 + 900 + 80;
    const limitY = rules.arena.height / 2 + 900 + 80;
    for (const p of layoutProps(rules, MODELS, 1)) {
      expect(Math.abs(p.x - centre.x)).toBeLessThanOrEqual(limitX);
      expect(Math.abs(p.y - centre.y)).toBeLessThanOrEqual(limitY);
    }
  });

  it("keeps every prop outside the arena rectangle (the forest is only a border, the hero walks on open ground)", () => {
    const edgeX = rules.arena.width / 2 + 150 - 80;
    const edgeY = rules.arena.height / 2 + 150 - 80;
    for (const p of layoutProps(rules, MODELS, 1)) {
      expect(Math.abs(p.x - centre.x) > edgeX || Math.abs(p.y - centre.y) > edgeY).toBe(true);
    }
  });

  it("places between 150 and 900 props, uses every model and gives each a quarter turn and a scale", () => {
    const props = layoutProps(rules, MODELS, 1);
    expect(props.length).toBeGreaterThanOrEqual(150);
    expect(props.length).toBeLessThanOrEqual(900);
    expect(new Set(props.map((p) => p.model))).toEqual(new Set(Array.from({ length: MODELS }, (_, i) => i)));
    for (const p of props) {
      expect([0, 1, 2, 3]).toContain(p.turn);
      expect(p.scale).toBeGreaterThanOrEqual(0.9);
      expect(p.scale).toBeLessThanOrEqual(1.4);
    }
  });
});
