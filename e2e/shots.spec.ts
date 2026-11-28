import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import type { GameSnapshot } from "../client/game/debug";
import { startRun as clickStart, expect, test } from "./fixtures";

declare global {
  interface Window {
    __game?: GameSnapshot;
  }
}

/** Screenshots for visual review (`npm run shots`). They assert nothing about the image; the fixtures fail a page error. */
const shotsDir = join(import.meta.dirname, "..", "test-results", "shots");

test.use({ viewport: { width: 1280, height: 720 } });
test.beforeAll(() => mkdirSync(shotsDir, { recursive: true }));

async function startRun(page: Page, query: string): Promise<void> {
  await page.goto(`/?${query}`);
  await clickStart(page);
  await page.waitForFunction(() => window.__game?.screen === "playing", undefined, { timeout: 90_000, polling: 250 });
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(shotsDir, `${name}.png`) });
}

test("shot: menu", async ({ page }) => {
  await page.goto("/?seed=7&lang=cs");
  await page.locator("#start").waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1_000);
  await shot(page, "menu");
});

test("shot: start", async ({ page }) => {
  await startRun(page, "seed=7&hero=stonehorn");
  await page.waitForTimeout(2_000);
  await shot(page, "start");
});

test("shot: fight", async ({ page }) => {
  await startRun(page, "seed=7&hero=stonehorn&debug=1&speed=4");
  // a level-up card pauses the run, so pick the first card until the tick is reached
  for (let i = 0; i < 600; i++) {
    const { tick, screen } = await page.evaluate(() => ({ tick: window.__game!.tick, screen: window.__game!.screen }));
    if (screen === "levelUp") await page.keyboard.press("1");
    // 10 s: an idle hero with no gear falls in about 15-20 s since the batch 3 balance
    else if (tick >= 300) break;
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => window.__game?.screen === "playing", undefined, { timeout: 10_000 });
  await page.evaluate(() => window.__game!.debug!.spawnEach());
  await page.waitForTimeout(1_000);
  // a kill of the spawned hunters may level the hero: pick a card so the shot shows the fight
  for (let i = 0; i < 5 && (await page.evaluate(() => window.__game!.screen)) === "levelUp"; i++) {
    await page.keyboard.press("1");
    await page.waitForTimeout(300);
  }
  await shot(page, "fight");
});

test("shot: types", async ({ page }) => {
  await startRun(page, "seed=7&hero=stonehorn&debug=1");
  await page.evaluate(() => window.__game!.debug!.spawnEach());
  await page.waitForTimeout(500);
  // the six common types stand in a row north of the hero, who is at the middle of the screen
  await page.screenshot({ path: join(shotsDir, "types.png"), clip: { x: 400, y: 90, width: 480, height: 270 } });
});

test("shot: factions", async ({ page }) => {
  // one row per faction (human at the bottom, elves at the top), spawned behind the paused menu, and the hero below them
  await page.goto("/?seed=7&hero=stonehorn&debug=1&lang=cs");
  await page.waitForFunction(() => document.querySelector("#start")?.textContent === "Start" || document.querySelector("#start")?.textContent === "Hrát", undefined, { timeout: 90_000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const debug = window.__game!.debug!;
    ["human", "orc", "undead", "elf"].forEach((id, row) => {
      debug.teleport(1600, -1000 + row * 450);
      debug.spawnFaction(id);
    });
    debug.teleport(1600, -350);
  });
  await page.waitForFunction(() => (window.__game?.enemyTypes ?? 0) >= 21, undefined, { timeout: 10_000, polling: 50 });
  await clickStart(page);
  await page.waitForFunction(() => window.__game?.screen === "playing", undefined, { timeout: 90_000, polling: 50 });
  await page.waitForTimeout(250);
  await shot(page, "factions");
});

test("shot: castle", async ({ page }) => {
  await startRun(page, "seed=7&hero=gravecaller&debug=1");
  await page.evaluate(() => window.__game!.debug!.teleport(0, -420));
  await page.waitForTimeout(1_000);
  await shot(page, "castle");
});

test("shot: world-1", async ({ page }) => {
  // the old wall with its western gate, islands around, and a storm wave winding up
  await startRun(page, "seed=7&hero=stonehorn&debug=1&lang=cs");
  await page.evaluate(() => window.__game!.debug!.teleport(-625, 1300));
  await page.waitForTimeout(1_000);
  await page.evaluate(() => window.__game!.debug!.hazard());
  await page.waitForTimeout(400);
  await shot(page, "world-1");
});

test("shot: world-2", async ({ page }) => {
  // the river with its western bridge, mesas and tents, and a sandstorm blowing
  await startRun(page, "seed=7&hero=stonehorn&debug=1&lang=cs&world=2");
  await page.evaluate(() => window.__game!.debug!.teleport(-900, 1050));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__game!.debug!.hazard());
  await page.waitForTimeout(1_500);
  await shot(page, "world-2");
});

test("shot: world-3", async ({ page }) => {
  // the ring of ancient trees at its north-eastern passage, a thicket and fireflies
  await startRun(page, "seed=7&hero=stonehorn&debug=1&lang=cs&world=3");
  await page.evaluate(() => window.__game!.debug!.teleport(850, 850));
  await page.waitForTimeout(1_000);
  await shot(page, "world-3");
});

test("shot: world-4", async ({ page }) => {
  // the ice ridge at its pass, ice shards, snow and a blizzard blowing
  await startRun(page, "seed=7&hero=stonehorn&debug=1&lang=cs&world=4");
  await page.evaluate(() => window.__game!.debug!.teleport(950, 950));
  await page.evaluate(() => window.__game!.debug!.hazard());
  await page.waitForTimeout(1_500);
  await shot(page, "world-4");
});

test("shot: world-5", async ({ page }) => {
  // the broken wall at its northern breach, enemies on the black earth, meteor circles and a pool of fire
  await startRun(page, "seed=7&hero=stonehorn&debug=1&lang=cs&world=5");
  await page.evaluate(() => window.__game!.debug!.teleport(679, 1180));
  await page.evaluate(() => window.__game!.debug!.spawnEach());
  await page.evaluate(() => window.__game!.debug!.hazard());
  await page.waitForTimeout(1_000);
  await page.evaluate(() => window.__game!.debug!.hazard());
  await page.waitForTimeout(700);
  await shot(page, "world-5");
});

test("shot: corner", async ({ page }) => {
  await startRun(page, "seed=7&hero=nightglaive&debug=1");
  await page.evaluate(() => window.__game!.debug!.teleport(2900, 2900));
  await page.waitForTimeout(1_000);
  await shot(page, "corner");
});

test("shot: boss", async ({ page }) => {
  await startRun(page, "seed=7&hero=stonehorn&debug=1&phase=6");
  await page.waitForFunction(() => window.__game?.boss !== null && window.__game?.boss !== undefined, undefined, { timeout: 30_000, polling: 50 });
  // stand next to the boss until its slam winds up (7 s after it came), then shoot half-way through the warning
  for (let i = 0; i < 600; i++) {
    const slams = await page.evaluate(() => {
      const g = window.__game!;
      if (g.screen === "levelUp") return -1;
      if (g.boss && g.slams === 0) g.debug!.teleport(g.boss.x - 200, g.boss.y - 60);
      return g.slams;
    });
    if (slams === -1) await page.keyboard.press("1");
    else if (slams > 0) break;
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(500);
  await shot(page, "boss");
});

/** Hero ids from the generated data, so adding a hero adds a shot. */
const heroIds = (
  JSON.parse(readFileSync(join(import.meta.dirname, "..", "data", "generated", "heroes.json"), "utf8")) as { id: string }[]
).map((h) => h.id);

test("shot: heroes", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  for (const hero of heroIds) {
    await startRun(page, `seed=7&hero=${hero}`);
    await page.waitForTimeout(1_000);
    // the hero stands at the middle of the screen
    await page.screenshot({ path: join(shotsDir, `hero-${hero}.png`), clip: { x: 520, y: 240, width: 240, height: 200 } });
  }
});

test("shot: worlds", async ({ page }) => {
  await page.goto("/?seed=7&lang=cs&debug=1&hero=stonehorn");
  await page.locator("#start").waitFor({ timeout: 90_000 });
  await page.waitForFunction(() => window.__game?.hero !== "", undefined, { timeout: 90_000 });
  await page.locator("#start").click();
  await page.locator('#world-screen [data-difficulty="insane"]').click();
  await page.locator('#world-screen [data-world="2"]').click();
  await page.waitForTimeout(300);
  await shot(page, "worlds");
});

test("shot: gear", async ({ page }) => {
  await page.goto("/?seed=7&lang=cs&debug=1&hero=stonehorn");
  await page.locator("#start").waitFor({ timeout: 90_000 });
  await page.evaluate(() => {
    const debug = window.__game!.debug!;
    const own: [string, number][] = [
      ["travelers-hood", 1], ["tin-ring", 2], ["walking-boots", 1], ["wardens-helm", 2], ["bastion-pauldrons", 1],
      ["guardsmans-cuirass", 3], ["masons-grip", 1], ["band-of-resolve", 1], ["moonlit-signet", 1], ["soldiers-longsword", 2],
      ["oaken-shield", 1], ["bulwark-plate", 1], ["girdle-of-the-mountain", 2], ["treads-of-the-vanguard", 1],
      ["astrolabe-shard", 1], ["greatblade-of-the-keep", 1], ["quakemaul", 1], ["last-rampart", 2], ["frostbound-lantern", 1],
      ["seal-of-the-royal-treasury", 1],
    ];
    for (const [id, level] of own) debug.grantItem(id, level);
  });
  await page.locator("#gear").click();
  for (const id of ["wardens-helm", "bastion-pauldrons", "bulwark-plate", "masons-grip", "girdle-of-the-mountain",
    "treads-of-the-vanguard", "band-of-resolve", "tin-ring", "frostbound-lantern", "seal-of-the-royal-treasury", "quakemaul", "last-rampart"]) {
    await page.locator(`#gear-screen .gear-grid [data-item="${id}"]`).click();
  }
  await page.locator('#gear-screen .gear-grid [data-item="greatblade-of-the-keep"]').hover();
  await page.waitForTimeout(300);
  await shot(page, "gear");
});

test("shot: chest-compare", async ({ page }) => {
  const items = JSON.parse(readFileSync(join(import.meta.dirname, "..", "data", "generated", "items.json"), "utf8")) as {
    id: string; rarity: string; slotType: string;
  }[];
  const slots: [string, string][] = [
    ["head", "head"], ["neck", "neck"], ["shoulders", "shoulders"], ["back", "back"], ["chest", "chest"], ["wrist", "wrist"],
    ["hands", "hands"], ["waist", "waist"], ["legs", "legs"], ["feet", "feet"], ["ring1", "ring"], ["ring2", "ring"],
    ["trinket1", "trinket"], ["trinket2", "trinket"], ["mainHand", "mainHand"], ["offHand", "offHand"],
  ];
  // named items are legendary or mythic since 2026-11-28: wear legendary ones, and open chests until one offers a
  // Choice (a mythic card)
  const pairs = slots.map(([slot, type]) => [slot, items.find((item) => item.slotType === type && item.rarity === "legendary")!.id]);
  await startRun(page, "seed=1&debug=1&lang=cs");
  await page.evaluate((list) => {
    const g = window.__game!;
    for (const [slot, item] of list) g.debug!.wear(slot!, item!);
  }, pairs);
  let index = -1;
  for (let attempt = 0; attempt < 12 && index < 0; attempt++) {
    await page.evaluate(() => {
      const g = window.__game!;
      g.debug!.grantGold(5000);
      g.debug!.teleport(g.chests[0]!.x, g.chests[0]!.y);
    });
    await page.waitForFunction(() => window.__game?.screen === "chest", undefined, { timeout: 90_000, polling: 250 });
    index = await page.evaluate(() => window.__game!.chestCards!.findIndex((card) => card.action === "choice"));
    if (index < 0) {
      await page.evaluate(() => window.__game!.debug!.chooseChest(0, "keep"));
      await page.waitForFunction(() => window.__game?.screen === "playing", undefined, { timeout: 30_000, polling: 100 });
    }
  }
  expect(index).toBeGreaterThanOrEqual(0);
  await page.waitForTimeout(350);
  await page.locator("button.card").nth(Math.max(0, index)).click();
  await page.locator("#chest-compare").waitFor();
  await page.waitForTimeout(200);
  await shot(page, "chest-compare");
});

test("shot: orbs", async ({ page }) => {
  await startRun(page, "seed=7&hero=stonehorn&debug=1&lang=cs");
  // the hero faces north at the start, so each orb comes 150 north of where the hero stands (the first natural
  // orb comes at 8 s, after the shot)
  await page.evaluate(() => {
    const g = window.__game!;
    g.debug!.spawnOrb("boots");
    g.debug!.teleport(g.heroX, g.heroY + 150); // onto the orb: picked up, so the HUD shows its effect
  });
  await page.waitForFunction(() => window.__game!.buffs.boots > 0, undefined, { timeout: 10_000, polling: 50 });
  await page.evaluate(() => {
    const g = window.__game!;
    const d = g.debug!;
    const hx = g.heroX;
    const hy = g.heroY;
    d.teleport(hx + 260, hy - 130);
    d.spawnOrb("heal");
    d.teleport(hx - 260, hy - 130);
    d.spawnOrb("berserk");
    d.teleport(hx, hy + 110);
    d.spawnOrb("boots");
    // a heart beyond the magnet (300), east of the hero
    d.teleport(hx + 330, hy - 220);
    d.dropHeart();
    d.teleport(hx, hy);
  });
  await page.waitForTimeout(400);
  await shot(page, "orbs");
});
