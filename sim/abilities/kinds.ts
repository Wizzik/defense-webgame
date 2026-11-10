import type { Ability } from "../../data/schema";
import type { Run } from "../run";
import { updateArea } from "./area";
import { updateLine } from "./line";
import { updateNova } from "./nova";
import { updateTickingArea } from "./ticking-area";
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
};
