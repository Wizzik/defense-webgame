// Petr's batch 3 (2026-11-27): a lost (or won) co-op run starts again with the same group. The host sends a new
// `start` over the links he already has; a guest who left is not in the new run and the rest are numbered again.
import type { NetGear } from "../net/protocol";

export interface RestartGroup<L> {
  /** Player p's hero, the host first. */
  heroes: string[];
  gear: NetGear[][];
  /** New guest number (1..n) -> his link. */
  links: Map<number, L>;
}

/**
 * The group of the next run: the host (player 0, with `hostGear` read again) and every guest of the last run who has
 * not left, in their old order. Null when no guest is left.
 */
export function restartGroup<L>(
  heroes: readonly string[], gear: readonly NetGear[][], links: ReadonlyMap<number, L>, gone: readonly number[],
  hostGear: NetGear[],
): RestartGroup<L> | null {
  const kept = [...links].filter(([p]) => p > 0 && !gone.includes(p) && heroes[p] !== undefined).sort((a, b) => a[0] - b[0]);
  if (kept.length === 0) return null;
  return {
    heroes: [heroes[0]!, ...kept.map(([p]) => heroes[p]!)],
    gear: [hostGear, ...kept.map(([p]) => gear[p] ?? [])],
    links: new Map(kept.map(([, link], i) => [i + 1, link])),
  };
}
