import { TICK_SECONDS } from "./constants";
import type { Run } from "./run";

/** Passive castle regeneration, up to maxHp, only while the castle stands. */
export function regenCastle(run: Run): void {
  const c = run.castle;
  if (c.hp <= 0) return;
  const gain = (c.maxHp * run.data.rules.castle.regenPercentPerMinute) / 100 / 60 * TICK_SECONDS;
  c.hp = Math.min(c.maxHp, c.hp + gain);
}
