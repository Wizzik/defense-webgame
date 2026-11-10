import type { Ability } from "../../data/schema";
import type { Run } from "../run";
import { updateLine } from "./line";
import type { AbilitySlot } from "./slots";

export type AbilityUpdate = (run: Run, slot: AbilitySlot, index: number) => void;

/** One update function per ability kind; each later task adds its kind here. */
export const UPDATERS: Partial<Record<Ability["kind"], AbilityUpdate>> = {
  line: updateLine,
};
