/** Bits of `TickInput.actions`. */
export const InputAction = { Ultimate: 1, ToggleAuto: 2, Dash: 4 } as const;

/**
 * One step of player input. `move*` is -1, 0 or 1; `card` is -1 for nothing, else 0..2;
 * `actions` is a bit mask of `InputAction`.
 */
export interface TickInput {
  moveX: number;
  moveY: number;
  card: number;
  actions: number;
}

export const NO_INPUT: Readonly<TickInput> = Object.freeze({ moveX: 0, moveY: 0, card: -1, actions: 0 });
