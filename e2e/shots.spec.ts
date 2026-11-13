import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import type { GameSnapshot } from "../client/game/debug";
import { test } from "./fixtures";

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
  await page.locator("#start").click();
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
    else if (tick >= 2700) break;
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => window.__game?.screen === "playing", undefined, { timeout: 10_000 });
  await page.evaluate(() => window.__game!.debug!.spawnEach());
  await page.waitForTimeout(1_000);
  await shot(page, "fight");
});

test("shot: types", async ({ page }) => {
  await startRun(page, "seed=7&hero=stonehorn&debug=1");
  await page.evaluate(() => window.__game!.debug!.spawnEach());
  await page.waitForTimeout(500);
  // the six common types stand in a row north of the hero, who is at the middle of the screen
  await page.screenshot({ path: join(shotsDir, "types.png"), clip: { x: 400, y: 90, width: 480, height: 270 } });
});

test("shot: castle", async ({ page }) => {
  await startRun(page, "seed=7&hero=gravecaller&debug=1");
  await page.evaluate(() => window.__game!.debug!.teleport(0, -420));
  await page.waitForTimeout(1_000);
  await shot(page, "castle");
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
