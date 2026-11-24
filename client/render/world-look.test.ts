import { describe, expect, it } from "vitest";
import { gameData } from "../../sim/testing/game-data";
import { MODELS } from "../../tools/assets-build/manifest";
import * as palette from "./palette";
import { COMMON_ENV, lookOf, PROP_SIZES, worldModelIds, type WorldLook } from "./world-look";

const worldIds = gameData().worlds.map((w) => w.id);

/** Every number of a look that is a colour (skips sizes, distances and intensities). */
function colours(look: WorldLook): number[] {
  const out = [
    look.ground.a, look.ground.b, look.ground.c, look.ground.dirt, look.sky, look.hemi.sky, look.hemi.ground,
    look.moon.color, look.path, look.stone.wall, look.stone.top, look.stone.ruin, look.water, look.propTint,
  ];
  if (look.thicket) out.push(look.thicket.ground);
  if (look.weather) out.push(look.weather.color);
  if (look.fire) out.push(look.fire.ring, look.fire.pool);
  return out;
}

function hsl(c: number): { h: number; s: number; l: number } {
  const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return { h: h < 0 ? h + 360 : h, s, l };
}

describe("world looks", () => {
  it("silver march keeps today's look", () => {
    const look = lookOf("silver-march");
    expect(look.ground).toEqual({ a: palette.GRASS_A, b: palette.GRASS_B, c: palette.GRASS_C, dirt: palette.DIRT });
    expect(look.sky).toBe(palette.SKY);
    expect(look.hemi.sky).toBe(palette.HEMI_SKY);
    expect(look.hemi.ground).toBe(palette.HEMI_GROUND);
    expect(look.moon.color).toBe(palette.MOON);
    expect(look.path).toBe(palette.PATH_COLOR);
    expect(look.stone).toEqual({ wall: palette.WALL_STONE, top: palette.WALL_TOP, ruin: palette.RUIN_STONE });
    expect(look.feature).toBe("wall");
    expect(look.propTint).toBe(0xffffff);
    expect(look.thicket).toBeNull();
    expect(look.weather).toBeNull();
    expect(look.particles).toBe("none");
    expect(worldModelIds(look)).toEqual(["rock-a", "rock-b", "rock-c", "tree-a", "tree-b", "trees-a", "trees-b", "trees-c"]);
  });

  it("every model id of every look is built by the asset manifest and has a size", () => {
    const built = new Set(MODELS.map((m) => m.out));
    for (const id of worldIds) {
      for (const model of worldModelIds(lookOf(id))) {
        expect(built.has(`env/${model}.glb`), `${id} ${model}`).toBe(true);
        expect(PROP_SIZES[model], `${id} ${model}`).toBeDefined();
      }
    }
    for (const model of COMMON_ENV) expect(built.has(`env/${model}.glb`), model).toBe(true);
  });

  it("no orange in any look", () => {
    for (const id of worldIds) {
      for (const c of colours(lookOf(id))) {
        const { h, s } = hsl(c);
        expect(h >= 15 && h <= 45 && s > 0.35, `${id} #${c.toString(16)} h ${h.toFixed(0)} s ${s.toFixed(2)}`).toBe(false);
      }
    }
  });

  it("red waste and shadewood have their own feature style", () => {
    expect(lookOf("red-waste").feature).toBe("river");
    expect(lookOf("shadewood").feature).toBe("trees");
  });

  it("frostreach and blightscar have their own looks", () => {
    const frost = lookOf("frostreach");
    const blight = lookOf("blightscar");
    expect(frost).not.toEqual(lookOf("silver-march"));
    expect([frost.feature, frost.particles, frost.fire]).toEqual(["ridge", "snow", null]);
    expect([blight.feature, blight.particles]).toEqual(["broken", "embers"]);
    expect(blight.fire).not.toBeNull();
    expect(frost.weather).not.toBeNull();
    for (const id of ["silver-march", "red-waste", "shadewood"]) expect(lookOf(id).fire, id).toBeNull();
  });

  it("the meteor ring differs from the roots ring", () => {
    const ring = hsl(lookOf("blightscar").fire!.ring);
    const roots = hsl(palette.ROOT_RING);
    const dh = Math.min(Math.abs(ring.h - roots.h), 360 - Math.abs(ring.h - roots.h));
    expect(dh >= 25 || Math.abs(ring.l - roots.l) >= 0.2, `hue ${dh.toFixed(0)}, light ${Math.abs(ring.l - roots.l).toFixed(2)}`).toBe(true);
  });
});
