import { TICKS_PER_SECOND } from "../constants";
import { EventKind } from "../events";
import type { Run } from "../run";
import { hitEnemiesAround } from "./hits";
import { CastMode, castMode, startCast } from "./slots";
import type { AbilitySlot } from "./slots";
import { countEnemiesWithin } from "./targeting";

const DEFAULT_HIT_RADIUS = 150;
const MAX_ATTEMPTS = 8;

/** Bursts at random points around the hero for the spell's duration. */
export function updateTickingArea(run: Run, slot: AbilitySlot, index: number): void {
  const def = slot.def;
  if (def.kind !== "ticking_area") return;
  const L = slot.level - 1;
  const p = def.params;
  const hero = run.hero;
  const radius = p.radius[L];
  const total = Math.round(p.duration[L] * TICKS_PER_SECOND);

  if (!slot.active) {
    const mode = castMode(run, index);
    if (mode === CastMode.None) return;
    if (mode === CastMode.Auto && countEnemiesWithin(run, hero.x, hero.y, radius) < 1) return;
    slot.active = true;
    slot.ticksLeft = total;
    startCast(run, index, radius, hero.x, hero.y, 0, 0);
  }

  // Whole steps, not summed fractions: step k (the cast is k = 1) owns bursts floor(k*tps/30) - floor((k-1)*tps/30).
  const tps = p.ticksPerSecond[L];
  const k = total - slot.ticksLeft + 1;
  const bursts = Math.floor((k * tps) / TICKS_PER_SECOND + 1e-9)
    - Math.floor(((k - 1) * tps) / TICKS_PER_SECOND + 1e-9);
  const hitRadius = p.hitRadius?.[L] ?? DEFAULT_HIT_RADIUS;
  const damage = p.tickDamage[L] * hero.stats.spellPower;
  const arenaX = run.data.rules.arena.width / 2;
  const arenaY = run.data.rules.arena.height / 2;
  for (let b = 0; b < bursts; b++) {
    let px = 0;
    let py = 0;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const qx = (run.rng.next() * 2 - 1) * radius;
      const qy = (run.rng.next() * 2 - 1) * radius;
      if (qx * qx + qy * qy <= radius * radius) {
        px = qx;
        py = qy;
        break;
      }
    }
    const bx = Math.max(-arenaX, Math.min(arenaX, hero.x + px));
    const by = Math.max(-arenaY, Math.min(arenaY, hero.y + py));
    hitEnemiesAround(run, index, bx, by, hitRadius, damage, 0, 0, 0);
    run.events.push(EventKind.Blast, index, hitRadius, bx, by, 0, 0);
  }
  slot.ticksLeft--;
  if (slot.ticksLeft <= 0) slot.active = false;
}
