/** One step of player input. `move*` is -1, 0 or 1; `card` is -1 for nothing, else 0..2. */
export interface TickInput {
  moveX: number;
  moveY: number;
  card: number;
}

export const NO_INPUT: Readonly<TickInput> = Object.freeze({ moveX: 0, moveY: 0, card: -1 });
