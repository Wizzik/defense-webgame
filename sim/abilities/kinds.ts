import type { Ability } from "../../data/schema";
import type { Run } from "../run";
import { updateArea } from "./area";
import { updateHeal } from "./heal";
import { updateShield } from "./shield";
import { updateCone } from "./cone";
import { updateLine } from "./line";
import { updateNova } from "./nova";
import { updateProjectile } from "./projectile";
import { updateSummon } from "./summon";
import { updateTickingArea } from "./ticking-area";
import { CastMode, castMode } from "./slots";
import type { AbilitySlot } from "./slots";

export type AbilityUpdate = (run: Run, slot: AbilitySlot, index: number) => void;

/** One update function per ability kind; each later task adds its kind here. */
export const UPDATERS: Partial<Record<Ability["kind"], AbilityUpdate>> = {
  line: updateLine,
  nova: updateNova,
  // Reacts through onHeroCast (echo.ts); nothing to do per step.
  on_cast: () => {},
  area: updateArea,
  ticking_area: updateTickingArea,
  projectile: updateProjectile,
  cone: updateCone,
  // Bonuses come from auraBonuses (aura.ts) when the stats are recomputed; nothing to do per step.
  aura: () => {},
  // Charges up here; the charge is spent by consumeEmpower (on-hit.ts) on the hero's attack.
  on_hit: (run, slot, index) => {
    if (!slot.active && castMode(run, index) !== CastMode.None) slot.active = true;
  },
  heal: updateHeal,
  shield: updateShield,
  summon: updateSummon,
};
