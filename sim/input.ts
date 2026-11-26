/** Bits of `TickInput.actions`. KeepWorn: with a chest Choice card in `card`, keep the worn item instead of taking the new one. */
export const InputAction = { Ultimate: 1, ToggleAuto: 2, Dash: 4, KeepWorn: 8, Blink: 16 } as const;

/**
 * One step of player input. `move*` is -1, 0 or 1; `card` is -1 for nothing, else 0..2;
 * `actions` is a bit mask of `InputAction`.
 */
export interface TickInput {
  moveX: number;
  moveY: number;
  card: number;
  actions: number;
  /**
   * Where the blink aims, as whole world units from the hero (the mouse); read only with the Blink bit. Missing:
   * straight ahead at the longest reach.
   */
  aimX?: number;
  aimY?: number;
}

export const NO_INPUT: Readonly<TickInput> = Object.freeze({ moveX: 0, moveY: 0, card: -1, actions: 0 });
