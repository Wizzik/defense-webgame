import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import type { GameSnapshot } from "../client/game/debug";
import { expect, test } from "./fixtures";
import { luminanceStdDev } from "./luminance";

declare global {
  interface Window {
    __game?: GameSnapshot;
  }
}

/** XP of the first level-up, read from the generated rules so a retune does not break the test. */
const xpFirst = (
  JSON.parse(readFileSync(join(import.meta.dirname, "..", "data", "generated", "rules.json"), "utf8")) as {
    progression: { xpFirst: number };
  }
).progression.xpFirst;

const enemies = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "data", "generated", "enemies.json"), "utf8"),
) as { id: string; boss?: true }[];
/** Common enemy ids from the generated data, so adding a type extends the test. Bosses come by the timeline. */
const enemyIds = enemies.filter((e) => !e.boss).map((e) => e.id);

/** Hero ids from the generated data, so adding a hero extends the test. */
const heroIds = (
  JSON.parse(readFileSync(join(import.meta.dirname, "..", "data", "generated", "heroes.json"), "utf8")) as { id: string }[]
).map((h) => h.id);

type Screen = GameSnapshot["screen"];

async function waitForScreen(page: Page, screen: Screen, timeout = 90_000): Promise<void> {
  await page.waitForFunction((s) => window.__game?.screen === s, screen, { timeout, polling: 250 });
}

/**
 * Picks the first level-up card. `window.__game.screen` can lag a slow frame behind the DOM, so the
 * card may already be gone when the click starts: a bounded wait lets the caller's loop read again.
 */
async function pickCard(page: Page): Promise<void> {
  await page
    .locator("button.card")
    .first()
    .click({ timeout: 10_000 })
    .catch(() => undefined);
}

/**
 * Plays a debug run to its end: picks cards, and kills the final boss once it has come (the run is won only
 * when it falls). Needs `debug=1`. Returns the last screen it saw.
 */
async function playToEnd(page: Page, timeoutMs = 60_000, pollMs = 250): Promise<Screen | undefined> {
  const deadline = Date.now() + timeoutMs;
  let screen = await page.evaluate(() => window.__game?.screen);
  while (screen !== "won" && screen !== "lost" && Date.now() < deadline) {
    if (screen === "levelUp" || screen === "chest") await pickCard(page);
    else {
      await page.evaluate(() => {
        const g = window.__game!;
        if (g.phase === 21 && g.boss !== null) g.debug!.killBoss();
      });
    }
    await page.waitForTimeout(pollMs);
    screen = await page.evaluate(() => window.__game?.screen);
  }
  return screen;
}

test("menu starts a run on the available backend", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&lang=en");
  const start = page.locator("#start");
  await expect(start).toHaveText("Start", { timeout: 90_000 });
  await start.click();
  await page.waitForFunction(() => (window.__game?.frames ?? 0) > 30, undefined, {
    timeout: 90_000,
    polling: 250,
  });

  const expected = testInfo.project.name === "webgpu-swiftshader" ? "WebGPU" : "WebGL2";
  expect(await page.evaluate(() => window.__game?.backend)).toBe(expected);
  expect(await page.evaluate(() => window.__game?.screen)).toBe("playing");
  expect(await page.evaluate(() => window.__game?.render.enemyMeshes)).toBe(enemies.length);

  // enemies spawn a few seconds into the run
  await page.waitForFunction(() => (window.__game?.enemies ?? 0) > 0, undefined, {
    timeout: 90_000,
    polling: 250,
  });

  // Hide the UI and the overlay so only the rendered scene is measured.
  const hide = (visibility: string) =>
    page.evaluate((v) => {
      for (const id of ["overlay", "ui"]) document.querySelector<HTMLElement>(`#${id}`)!.style.visibility = v;
    }, visibility);
  await hide("hidden");
  const shot = await page.locator("canvas").first().screenshot({ type: "png" });
  await hide("");
  await testInfo.attach(`game-${testInfo.project.name}`, { body: shot, contentType: "image/png" });

  const stdDev = await luminanceStdDev(page, shot);
  console.log(`game luminance stddev (${testInfo.project.name}): ${stdDev.toFixed(2)}`);
  expect(stdDev, `luminance stddev ${stdDev.toFixed(2)}`).toBeGreaterThan(2.5);
});

test("the shadow map is on unless ?shadows=0 or the GPU is software, and the game draws either way", async ({ page }) => {
  await page.goto("/?seed=1&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  const { shadows, software } = await page.evaluate(() => ({
    shadows: window.__game!.render.shadows,
    software: window.__game!.gpu.software,
  }));
  expect(shadows).toBe(!software);
  await page.locator("#start").click();
  await waitForScreen(page, "playing");
  await page.waitForFunction(() => (window.__game?.frames ?? 0) > 30, undefined, { timeout: 90_000, polling: 250 });

  await page.goto("/?seed=1&lang=en&shadows=0");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  expect(await page.evaluate(() => window.__game!.render.shadows)).toBe(false);
  await page.locator("#start").click();
  await waitForScreen(page, "playing");
  await page.waitForFunction(() => (window.__game?.frames ?? 0) > 30, undefined, { timeout: 90_000, polling: 250 });
});

test("menu warns about software rendering only on a software GPU", async ({ page }) => {
  await page.goto("/?seed=1&lang=en");
  const start = page.locator("#start");
  await expect(start).toHaveText("Start", { timeout: 90_000 });
  const gpu = await page.evaluate(() => window.__game!.gpu);
  expect(gpu.name.length).toBeGreaterThan(0);
  const warning = page.locator("#gpu-warning");
  if (gpu.software) await expect(warning).toBeVisible();
  else await expect(warning).toBeHidden();
  // the warning never blocks the start
  await start.click();
  await waitForScreen(page, "playing");
});

test("level-up shows three cards and a pick resumes the run", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&debug=1&lang=cs");
  await page.locator("#start").click();
  await waitForScreen(page, "playing");
  await page.evaluate((n) => window.__game!.debug!.grantXp(n), xpFirst);
  await waitForScreen(page, "levelUp");

  await expect(page.locator("button.card")).toHaveCount(3);
  await expect(page.locator(".cards-title")).toHaveText("Vyber vylepšení");
  await testInfo.attach(`levelup-${testInfo.project.name}`, {
    body: await page.screenshot({ type: "png" }),
    contentType: "image/png",
  });

  await page.locator("button.card").first().click();
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => window.__game?.level)).toBe(2);
});

test("run ends with the end screen", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&duration=10&speed=8&debug=1&lang=en");
  await page.locator("#start").click();
  // the duration brings the final boss; the run is won when it falls
  await page.waitForFunction(() => window.__game?.boss?.id === "dread-regent", undefined, { timeout: 90_000, polling: 100 });
  expect(await page.evaluate(() => window.__game?.screen)).not.toBe("won");
  expect(await playToEnd(page)).toBe("won");

  await expect(page.getByText("You held the castle!")).toBeVisible();
  await expect(page.getByText(/^Final boss fell at \d+:\d\d$/)).toBeVisible();
  await testInfo.attach(`end-${testInfo.project.name}`, {
    body: await page.screenshot({ type: "png" }),
    contentType: "image/png",
  });

  await page.locator("#again").click();
  await expect(page.locator("#start")).toBeVisible();
  await waitForScreen(page, "menu", 10_000);
});

test("menu lets you pick a hero", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await expect(page.locator("button.hero-button")).toHaveCount(8);
  await page.locator("button.hero-button", { hasText: "Nightglaive" }).click();
  await testInfo.attach(`menu-hero-${testInfo.project.name}`, {
    body: await page.screenshot({ type: "png" }),
    contentType: "image/png",
  });
  await page.locator("#start").click();
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => window.__game?.hero)).toBe("nightglaive");
  expect(await page.evaluate(() => window.__game?.screen)).toBe("playing");
});

test("every hero has its own model", async ({ page }) => {
  await page.goto("/?seed=1&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  for (const hero of heroIds) {
    await page.locator(`button.hero-button[data-hero="${hero}"]`).click();
    // Start is disabled while the model loads, and the run behind the menu then has the new hero
    await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
    await expect(page.locator("#start")).toBeEnabled();
    await page.waitForFunction((id) => window.__game?.hero === id, hero, { timeout: 10_000 });
    // exactly one hero model stands in the scene: the old one is gone
    await page.waitForFunction(() => window.__game?.render.heroModels === 1, undefined, { timeout: 10_000 });
    expect(await page.evaluate(() => window.__game?.render.heroModels), `${hero} models`).toBe(1);
  }
  // a restart puts a fresh model in place of the old one
  await page.locator("#start").click();
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => window.__game?.render.heroModels)).toBe(1);
});

test.describe("a missing hero model", () => {
  test.use({ allowedConsoleErrors: [/mistwarden\.glb/] });

  test("shows an error", async ({ page }) => {
    await page.route("**/models/heroes/mistwarden.glb", (route) => route.abort());
    await page.goto("/?seed=1&hero=mistwarden&lang=en");
    const error = page.locator("#error");
    await expect(error).toBeVisible({ timeout: 90_000 });
    await expect(error).toContainText("Something went wrong");
    expect((await error.textContent())?.length ?? 0).toBeGreaterThan(0);
    // no run without a hero
    await expect(page.locator("#start")).toBeDisabled();
  });
});

test("the menu lists eight heroes and starts each of the new ones", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  for (const hero of ["mistwarden", "sparkshot", "redcleaver", "tidecaller"]) {
    await page.goto(`/?hero=${hero}&seed=1&speed=4&duration=20&debug=1&lang=en`);
    await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
    await expect(page.locator("button.hero-button")).toHaveCount(8);
    await expect(page.locator(`button.hero-button[data-hero="${hero}"]`)).toHaveAttribute("aria-pressed", "true");
    await page.locator("#start").click();
    await waitForScreen(page, "playing");
    expect(await page.evaluate(() => window.__game?.hero)).toBe(hero);
    const screen = await playToEnd(page, 60_000, 200);
    expect(["won", "lost"], `${hero} ended`).toContain(screen);
  }
});

test("every hero plays without errors", async ({ page }, testInfo) => {
  test.setTimeout(10 * 60_000);
  for (const hero of heroIds) {
    await page.goto(`/?seed=1&hero=${hero}&debug=1&speed=8&duration=20&lang=en`);
    await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
    await page.locator("#start").click();
    await waitForScreen(page, "playing");
    expect(await page.evaluate(() => window.__game?.hero)).toBe(hero);
    await page.evaluate(() => {
      for (let slot = 0; slot < 4; slot++) window.__game!.debug!.setAbilityLevel(slot, 1);
    });
    // mid-run: enemies are on screen and abilities have fired
    await page.waitForFunction(
      () => {
        const g = window.__game;
        return g !== undefined && (g.screen !== "playing" || (g.tick > 240 && g.enemies > 0));
      },
      undefined,
      { timeout: 60_000, polling: 100 },
    );
    // no screenshot of the level-up overlay: pick a card first
    while ((await page.evaluate(() => window.__game?.screen)) === "levelUp") {
      await pickCard(page);
      await page.waitForTimeout(100);
    }
    await testInfo.attach(`hero-${hero}-${testInfo.project.name}`, {
      body: await page.screenshot({ type: "png" }),
      contentType: "image/png",
    });
    // a level-up pauses the run and the final boss ends it: play until the run ends (within 60 s)
    const screen = await playToEnd(page);
    expect(["won", "lost"], `${hero} ended`).toContain(screen);
  }
});

test("every enemy type renders without errors", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&debug=1&speed=2&duration=60&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  // behind the menu the run is paused, so nobody dies before the count is read
  await page.evaluate(() => window.__game!.debug!.spawnEach());
  await page.waitForFunction((n) => (window.__game?.enemyTypes ?? 0) >= n, enemyIds.length, {
    timeout: 3_000,
    polling: 50,
  });
  await page.locator("#start").click();
  await waitForScreen(page, "playing");
  // the row walks to the hero: shooters fire and die next to it, the chaplain heals
  await page.waitForTimeout(1_500);
  while ((await page.evaluate(() => window.__game?.screen)) === "levelUp") {
    await pickCard(page);
    await page.waitForTimeout(100);
  }
  await testInfo.attach(`enemy-types-${testInfo.project.name}`, {
    body: await page.screenshot({ type: "png" }),
    contentType: "image/png",
  });
  await page.waitForTimeout(2_000);
  expect(["playing", "levelUp", "won", "lost"]).toContain(await page.evaluate(() => window.__game?.screen));
});

test("pack arrows point at a new pack", async ({ page }) => {
  await page.goto("/?seed=1&speed=2&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  expect(await page.evaluate(() => window.__game?.packArrows)).toBe(0);
  await page.locator("#start").click();
  await page.waitForFunction(() => (window.__game?.packArrows ?? 0) >= 1, undefined, { timeout: 5_000, polling: 50 });
  await expect(page.locator(".pack-arrow:not([hidden])").first()).toBeVisible();
});

test("a lancer charge renders without errors", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&debug=1&duration=60&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await page.evaluate(() => window.__game!.debug!.spawnEach());
  await page.locator("#start").click();
  await page.waitForFunction(() => (window.__game?.charging ?? 0) >= 1, undefined, { timeout: 6_000, polling: 30 });
  await testInfo.attach(`lancer-charge-${testInfo.project.name}`, {
    body: await page.screenshot({ type: "png" }),
    contentType: "image/png",
  });
  await page.waitForTimeout(1_500);
  expect(["playing", "levelUp", "won", "lost"]).toContain(await page.evaluate(() => window.__game?.screen));
});

test("R casts the ultimate and T switches auto", async ({ page }) => {
  await page.goto("/?seed=1&hero=stonehorn&debug=1&lang=en");
  await page.locator("#start").click();
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => window.__game?.ultimateAuto)).toBe(true);

  // auto off first, then learn the ultimate: nothing can cast it before R
  await page.keyboard.press("t");
  await page.waitForFunction(() => window.__game?.ultimateAuto === false, undefined, { timeout: 10_000 });
  await page.evaluate(() => window.__game!.debug!.setAbilityLevel(3, 1));
  expect(await page.evaluate(() => window.__game?.abilityCooldowns[3])).toBe(0);

  await page.keyboard.press("r");
  await page.waitForFunction(() => (window.__game?.abilityCooldowns[3] ?? 0) > 0, undefined, { timeout: 10_000 });
});

test("Space dashes", async ({ page }) => {
  await page.goto("/?seed=1&lang=en");
  await page.locator("#start").click(); // the Start button hides; keyboard focus then falls back to the page, so Space reaches the game
  await waitForScreen(page, "playing");
  await page.waitForFunction(() => (window.__game?.tick ?? 0) > 5, undefined, { timeout: 30_000 });
  const before = await page.evaluate(() => ({ x: window.__game!.heroX, y: window.__game!.heroY }));
  await page.keyboard.press("Space");
  await page.waitForFunction(
    (b) => Math.hypot(window.__game!.heroX - b.x, window.__game!.heroY - b.y) >= 300,
    before,
    { timeout: 10_000, polling: 50 },
  );
});

test("a miniboss shows its bar and name", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&debug=1&phase=6&speed=4&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  // the run behind the menu already stands at the start of the phase
  await page.waitForFunction(() => window.__game?.phase === 6, undefined, { timeout: 30_000 });
  await page.locator("#start").click();
  await page.waitForFunction(() => window.__game?.boss?.id === "iron-marshal", undefined, { timeout: 30_000, polling: 50 });
  const bar = page.locator("#boss-bar");
  await expect(bar).toBeVisible();
  await expect(bar.locator(".boss-name")).toHaveText("Iron Marshal");
  await expect(page.locator(".hud-phase")).toHaveText("Phase 6/20");
  const boss = await page.evaluate(() => window.__game!.boss!);
  expect(boss.hp).toBeGreaterThan(0);
  expect(boss.hp).toBeLessThanOrEqual(boss.maxHp);
  await testInfo.attach(`miniboss-${testInfo.project.name}`, { body: await page.screenshot({ type: "png" }), contentType: "image/png" });
});

test("an elite rush is announced", async ({ page }) => {
  // phase 4 starts at 2:30; the rush of 3:00 is announced 7 s ahead
  await page.goto("/?seed=1&debug=1&phase=4&duration=1200&speed=8&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await page.waitForFunction(() => window.__game?.phase === 4, undefined, { timeout: 30_000 });
  // a full kit, so the hero lives to see the rush whatever XP the phase start gives
  await page.evaluate(() => {
    for (let slot = 0; slot < 4; slot++) window.__game!.debug!.setAbilityLevel(slot, 5);
  });
  await page.locator("#start").click();
  const announce = page.locator("#announce");
  const deadline = Date.now() + 90_000;
  let seen = false;
  while (!seen && Date.now() < deadline) {
    const screen = await page.evaluate(() => window.__game?.screen);
    expect(screen, "the run ended before the rush was announced").not.toBe("lost");
    if (screen === "levelUp") await pickCard(page);
    seen = (await announce.textContent()) === "An elite rush is coming" && (await announce.isVisible());
    if (!seen) await page.waitForTimeout(50);
  }
  expect(seen).toBe(true);
  // within 30 s of game time from the start of the phase
  expect(await page.evaluate(() => window.__game!.tick)).toBeLessThanOrEqual((150 + 30) * 30);
});

test("the finale shows the final boss and ends with a win", async ({ page }) => {
  await page.goto("/?seed=1&debug=1&phase=21&lang=cs");
  await expect(page.locator("#start")).toHaveText("Hrát", { timeout: 90_000 });
  await page.waitForFunction(() => window.__game?.phase === 21, undefined, { timeout: 30_000 });
  await page.locator("#start").click();
  await page.waitForFunction(() => window.__game?.boss?.id === "dread-regent", undefined, { timeout: 30_000, polling: 50 });
  await expect(page.locator(".hud-phase")).toHaveText("Finále");
  await expect(page.locator("#boss-bar .boss-name")).toHaveText("Hrůzný regent");
  await page.evaluate(() => window.__game!.debug!.killBoss());
  await waitForScreen(page, "won", 30_000);
  await expect(page.getByText(/^Finální boss padl v 16:4\d$/)).toBeVisible();
});

test("phase without debug starts a normal run", async ({ page }) => {
  for (const query of ["phase=21", "debug=1&phase=22", "debug=1&phase=abc"]) {
    await page.goto(`/?seed=1&lang=en&${query}`);
    await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
    await page.waitForFunction(() => window.__game?.hero !== "", undefined, { timeout: 30_000 });
    expect(await page.evaluate(() => window.__game?.tick), query).toBe(0);
    expect(await page.evaluate(() => window.__game?.phase), query).toBe(1);
    await page.locator("#start").click();
    await waitForScreen(page, "playing");
    await page.waitForFunction(() => (window.__game?.tick ?? 0) > 10, undefined, { timeout: 30_000 });
    expect(await page.evaluate(() => window.__game?.boss), query).toBeNull();
    expect(await page.evaluate(() => window.__game?.tick), query).toBeLessThan(600);
  }
});

test("a restart clears the boss bar", async ({ page }) => {
  await page.goto("/?seed=1&debug=1&phase=21&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await page.locator("#start").click();
  await page.waitForFunction(() => window.__game?.boss !== null, undefined, { timeout: 30_000, polling: 50 });
  await expect(page.locator("#boss-bar")).toBeVisible();
  await expect(page.locator("#announce")).toHaveText("Dread Regent has arrived");
  await page.evaluate(() => window.__game!.debug!.killBoss());
  await waitForScreen(page, "won", 30_000);
  await page.locator("#again").click();
  await waitForScreen(page, "menu", 10_000);
  // the new run waits behind the menu: its boss has not come yet
  await page.waitForFunction(() => window.__game?.boss === null, undefined, { timeout: 30_000 });
  await expect(page.locator("#boss-bar")).toBeHidden();
  await expect(page.locator("#announce")).toBeHidden();
  // and the new run brings its own boss and news
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await page.locator("#start").click();
  await page.waitForFunction(() => window.__game?.boss !== null, undefined, { timeout: 30_000, polling: 50 });
  await expect(page.locator("#boss-bar")).toBeVisible();
});

test("a slam shows a ring and hides it after the hit", async ({ page }, testInfo) => {
  // the Mistwarden: Stonehorn, standing next to the boss, killed it in about 8 s, before or right at its first slam (7 s)
  await page.goto("/?seed=1&debug=1&phase=6&speed=4&lang=en&hero=mistwarden");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await page.waitForFunction(() => window.__game?.phase === 6, undefined, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__game!.render.slamRings)).toBe(0);
  await page.locator("#start").click();
  await page.waitForFunction(() => window.__game?.boss?.id === "iron-marshal", undefined, { timeout: 30_000, polling: 50 });
  // stay next to the boss until its slam is ready (7 s after it came) and it winds up
  const deadline = Date.now() + 60_000;
  let rings = 0;
  while (rings === 0 && Date.now() < deadline) {
    rings = await page.evaluate(() => {
      const g = window.__game!;
      if (g.screen === "playing" && g.boss && g.slams === 0) g.debug!.teleport(g.boss.x - 150, g.boss.y);
      return g.render.slamRings;
    });
    if ((await page.evaluate(() => window.__game?.screen)) === "levelUp") await pickCard(page);
    if (rings === 0) await page.waitForTimeout(30);
  }
  expect(rings).toBe(1);
  expect(await page.evaluate(() => window.__game!.slams)).toBeLessThanOrEqual(1);
  await testInfo.attach(`slam-${testInfo.project.name}`, { body: await page.screenshot({ type: "png" }), contentType: "image/png" });
  // the windup is 1 s and the flash 0.2 s of game time; a level-up card would freeze both
  const gone = Date.now() + 30_000;
  while ((await page.evaluate(() => window.__game!.render.slamRings)) !== 0 && Date.now() < gone) {
    if ((await page.evaluate(() => window.__game?.screen)) === "levelUp") await pickCard(page);
    await page.waitForTimeout(50);
  }
  expect(await page.evaluate(() => window.__game!.render.slamRings)).toBe(0);
});

test("a chest takes gold and offers three gear slots; the pick lands in the gear", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&debug=1&lang=cs");
  await page.locator("#start").click();
  await waitForScreen(page, "playing");
  const before = await page.evaluate(() => {
    const g = window.__game!;
    return { chests: g.chests.length, price: g.chestPrice, gold: g.gold, worn: g.gear.filter((slot) => slot !== null).length };
  });
  expect(before).toEqual({ chests: 3, price: 200, gold: 0, worn: 0 });
  await expect(page.locator(".chest-label")).toHaveCount(3);

  await page.evaluate(() => {
    const g = window.__game!;
    g.debug!.grantGold(1000);
    g.debug!.teleport(g.chests[0]!.x, g.chests[0]!.y);
  });
  await waitForScreen(page, "chest");
  await expect(page.locator("button.card")).toHaveCount(3);
  await expect(page.locator(".cards-title")).toHaveText("Truhla: vyber, co vylepšíš");
  await expect(page.locator("#hud-gold")).toContainText("800");
  await testInfo.attach(`chest-${testInfo.project.name}`, {
    body: await page.screenshot({ type: "png" }),
    contentType: "image/png",
  });

  await page.locator("button.card").first().click();
  await waitForScreen(page, "playing");
  const after = await page.evaluate(() => {
    const g = window.__game!;
    return { opened: g.chestsOpened, gold: g.gold, price: g.chestPrice, worn: g.gear.filter((slot) => slot !== null) };
  });
  expect(after.opened).toBe(1);
  expect(after.gold).toBeLessThan(1000);
  expect(after.price).toBe(224);
  expect(after.worn).toHaveLength(1);
  expect(after.worn[0]).toMatchObject({ base: 0, temp: 1 });
});

test("C opens the gear panel and pauses the run; C closes it; C does nothing under the cards", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&debug=1&lang=cs");
  await page.locator("#start").click();
  await waitForScreen(page, "playing");
  await expect(page.locator("#gear-panel")).toBeHidden();

  // a chest pick first, so the doll has something to show
  await page.evaluate(() => {
    const g = window.__game!;
    g.debug!.grantGold(1000);
    g.debug!.teleport(g.chests[0]!.x, g.chests[0]!.y);
  });
  await waitForScreen(page, "chest");
  await page.keyboard.press("KeyC");
  await expect(page.locator("#gear-panel")).toBeHidden();
  await page.locator("button.card").first().click();
  await waitForScreen(page, "playing");

  await page.keyboard.press("KeyC");
  await expect(page.locator("#gear-panel")).toBeVisible();
  await expect(page.locator("#gear-panel .doll-slot")).toHaveCount(16);
  await expect(page.locator("#gear-panel .doll-slot:not(.empty)")).toHaveCount(1);
  await expect(page.locator("#gear-panel .gear-title")).toHaveText("Výbava");
  const tick = await page.evaluate(() => window.__game!.tick);
  await page.locator("#gear-panel .doll-slot:not(.empty)").hover();
  await expect(page.locator("#gear-panel .item-tooltip")).toContainText("jen na tento běh");
  await testInfo.attach(`gear-panel-${testInfo.project.name}`, {
    body: await page.screenshot({ type: "png" }),
    contentType: "image/png",
  });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__game!.tick)).toBe(tick);

  await page.keyboard.press("KeyC");
  await expect(page.locator("#gear-panel")).toBeHidden();
  await page.waitForFunction((t) => window.__game!.tick > t, tick);
});

test("a boss that falls drops an item into the collection and the end screen lists it", async ({ page }) => {
  await page.goto("/?seed=1&debug=1&phase=6&lang=cs");
  await page.locator("#start").click();
  await waitForScreen(page, "playing");
  await expect(page.locator("#save-warning")).toBeHidden();
  expect(await page.evaluate(() => ({ collection: window.__game!.collection, saved: window.__game!.gearSaved })))
    .toEqual({ collection: {}, saved: false });
  await page.waitForFunction(() => window.__game!.boss !== null);
  await page.evaluate(() => window.__game!.debug!.killBoss());
  await expect(page.locator("#announce")).toContainText("Kořist:");
  await expect(page.locator("#announce")).toHaveClass(/loot rarity-(common|rare)/);
  // the snapshot follows the collection once a frame
  await page.waitForFunction(() => Object.keys(window.__game!.collection).length === 1);
  const collection = await page.evaluate(() => window.__game!.collection);
  expect(Object.values(collection)).toEqual([1]);

  // the item is kept when the run is lost, and the end screen names it
  await page.evaluate(() => window.__game!.debug!.grantItem("oaken-shield", 9));
  expect(await page.evaluate(() => window.__game!.collection["oaken-shield"])).toBe(5);
  await page.goto("/?seed=1&debug=1&phase=21&lang=cs");
  await page.locator("#start").click();
  await waitForScreen(page, "playing");
  await page.waitForFunction(() => window.__game!.boss !== null);
  await page.evaluate(() => window.__game!.debug!.killBoss());
  await waitForScreen(page, "won");
  await expect(page.locator("#end .end-drops-title")).toHaveText("Kořist z tohoto běhu");
  await expect(page.locator("#end .end-drop")).toHaveCount(1);
});

test("the collection is stored in the browser and read again after a reload", async ({ page }) => {
  await page.goto("/?seed=1");
  await page.waitForFunction(() => window.__game?.screen === "menu");
  expect(await page.evaluate(() => window.__game!.gearSaved)).toBe(true);
  await expect(page.locator("#save-warning")).toBeHidden();
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open("defense-webgame", 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const save = { version: 1, items: { "oaken-shield": 3, "no-such-item": 2 }, loadouts: { stonehorn: { offHand: "oaken-shield" } } };
      const put = open.result.transaction("save", "readwrite").objectStore("save").put(save, "gear");
      put.onerror = () => reject(put.error);
      put.onsuccess = () => resolve();
    };
  }));
  await page.reload();
  await page.waitForFunction(() => window.__game?.screen === "menu");
  expect(await page.evaluate(() => window.__game!.collection)).toEqual({ "oaken-shield": 3 });
  // the paused run behind the menu already wears the stored doll
  await page.waitForFunction(() => window.__game!.gear.some((slot) => slot?.item === "oaken-shield" && slot.base === 3));
});

test("the gear screen equips an item for one hero; the run starts with it", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&debug=1&lang=cs&hero=stonehorn");
  await page.waitForFunction(() => window.__game?.screen === "menu");
  await page.evaluate(() => {
    const debug = window.__game!.debug!;
    debug.grantItem("oaken-shield", 3);
    debug.grantItem("band-of-resolve", 1);
    debug.grantItem("moonlit-signet", 2);
  });
  await page.locator("#gear").click();
  await expect(page.locator("#gear-screen")).toBeVisible();
  await expect(page.locator("#gear-screen .gear-title")).toHaveText("Výbava");
  await expect(page.locator("#gear-screen .gear-grid .doll-slot")).toHaveCount(70);
  await expect(page.locator("#gear-screen .gear-grid .doll-slot:not(.missing)")).toHaveCount(3);
  await expect(page.locator("#gear-screen .gear-count")).toHaveText("Sbírka: 3 z 70");
  const hp = Number(await page.locator("#gear-screen .doll-total-value").nth(3).textContent());

  await page.locator('#gear-screen .gear-filter[data-filter="ring"]').click();
  await expect(page.locator("#gear-screen .gear-grid .doll-slot")).toHaveCount(5);
  await page.locator('#gear-screen .gear-filter[data-filter="all"]').click();

  await page.locator('#gear-screen .gear-grid [data-item="oaken-shield"]').click();
  await page.locator('#gear-screen .gear-grid [data-item="band-of-resolve"]').click();
  await page.locator('#gear-screen .gear-grid [data-item="moonlit-signet"]').click();
  await expect(page.locator("#gear-screen .gear-left .doll-slot:not(.empty)")).toHaveCount(3);
  await expect(page.locator("#gear-screen .gear-grid .doll-slot.equipped")).toHaveCount(3);
  // the shield and the ring carry strength, so the hero's hp grew
  expect(Number(await page.locator("#gear-screen .doll-total-value").nth(3).textContent())).toBeGreaterThan(hp);
  await page.locator('#gear-screen .gear-grid [data-item="helm-of-the-unbroken-line"]').hover();
  await expect(page.locator("#gear-screen .item-tooltip")).toContainText("nevlastníš");
  await expect(page.locator("#gear-screen .item-tooltip")).toContainText("Padá:");
  await testInfo.attach(`gear-screen-${testInfo.project.name}`, { body: await page.screenshot({ type: "png" }), contentType: "image/png" });

  // a click on a doll slot takes the item off
  await page.locator('#gear-screen .gear-left .doll-slot[data-slot="ring2"]').click();
  await expect(page.locator("#gear-screen .gear-left .doll-slot:not(.empty)")).toHaveCount(2);

  // a file that is not an export changes nothing; an export of this game comes back
  await page.locator("#gear-import-file").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{ not json") });
  await expect(page.locator("#gear-message")).toHaveText("Tento soubor není export výbavy. Nic se nezměnilo.");
  expect(Object.keys(await page.evaluate(() => window.__game!.collection))).toHaveLength(3);
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#gear-export").click()]);
  expect(download.suggestedFilename()).toBe("defense-webgame-gear.json");

  await page.locator("#gear-back").click();
  await expect(page.locator("#gear-screen")).toBeHidden();
  await page.locator("#start").click();
  await waitForScreen(page, "playing");
  const worn = await page.evaluate(() => window.__game!.gear.filter((slot) => slot !== null));
  expect(worn).toEqual([
    { item: "band-of-resolve", base: 1, temp: 0 },
    { item: "oaken-shield", base: 3, temp: 0 },
  ]);
});

test("every hero has its own doll", async ({ page }) => {
  await page.goto("/?seed=1&debug=1&lang=cs&hero=stonehorn");
  await page.waitForFunction(() => window.__game?.screen === "menu");
  await page.evaluate(() => window.__game!.debug!.grantItem("oaken-shield", 1));
  await page.locator("#gear").click();
  await page.locator('#gear-screen .gear-grid [data-item="oaken-shield"]').click();
  await page.locator("#gear-back").click();
  await page.locator('button[data-hero="sparkshot"]').click();
  await page.locator("#gear").click();
  await expect(page.locator("#gear-screen .doll-title")).toHaveText("Jiskrostřelec");
  await expect(page.locator("#gear-screen .gear-left .doll-slot:not(.empty)")).toHaveCount(0);
  await expect(page.locator("#gear-screen .gear-grid .doll-slot:not(.missing)")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("#gear-screen")).toBeHidden();
  await page.locator('button[data-hero="stonehorn"]').click();
  await page.locator("#gear").click();
  await expect(page.locator("#gear-screen .gear-left .doll-slot:not(.empty)")).toHaveCount(1);
});
