import { EventKind } from "./events";
import type { Run } from "./run";
import type { HeroState } from "./world";
import { TICKS_PER_SECOND } from "./constants";

/** Value of EventKind.HeroSnared. */
export const Snare = { Web: 0, Root: 1 } as const;

/**
 * Slows the hero's walking by `share` for `ticks` steps (the webcrawler's web). A new slow renews the time and does
 * not stack: the longer time and the larger share stay. Dashes keep their distance.
 */
export function slowHero(run: Run, share: number, ticks: number): void {
  const hero = run.hero;
  if (ticks <= 0 || hero.hp <= 0) return;
  hero.slowShare = hero.slowTicks > 0 ? Math.max(hero.slowShare, share) : share;
  hero.slowTicks = Math.max(hero.slowTicks, ticks);
  run.events.push(EventKind.HeroSnared, 0, Snare.Web, hero.x, hero.y, ticks / TICKS_PER_SECOND, 0);
}

/** Roots the hero for `ticks` steps: no walking and no dash (a running dash ends). Renews, the longer time wins. */
export function rootHero(run: Run, ticks: number): void {
  const hero = run.hero;
  if (ticks <= 0 || hero.hp <= 0) return;
  hero.rootTicks = Math.max(hero.rootTicks, ticks);
  hero.dashTicks = 0;
  run.events.push(EventKind.HeroSnared, 0, Snare.Root, hero.x, hero.y, ticks / TICKS_PER_SECOND, 0);
}

/** Counts the snares down; Run.step calls it right after moveHero, so a snare of n ticks holds n moves. */
export function tickSnares(run: Run): void {
  const hero = run.hero;
  if (hero.slowTicks > 0 && --hero.slowTicks === 0) hero.slowShare = 0;
  if (hero.rootTicks > 0) hero.rootTicks--;
}

/** Multiplier on the hero's walking speed from snares: 1 - the web's share while it runs, else 1. */
export function snareSpeedScale(hero: HeroState): number {
  return hero.slowTicks > 0 ? 1 - hero.slowShare : 1;
}
