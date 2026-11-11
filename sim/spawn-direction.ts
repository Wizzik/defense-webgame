import type { Rng } from "./rng";

/** Out values of the functions below (no allocation). */
export let dirX = 1;
export let dirY = 0;

const MAX_TRIES = 8;
const MIN_LENGTH_SQUARED = 0.01;
/** cos 120° and sin 120°. */
const COS_120 = -0.5;
const SIN_120 = 0.8660254037844386;

/**
 * Writes a random unit vector into dirX/dirY, with no trigonometry: draws (a, b) from [-1, 1]²
 * until it lies in the unit disc and away from its centre (at most 8 tries, then (1, 0)), and normalizes.
 */
export function randomDirection(rng: Rng): void {
  for (let i = 0; i < MAX_TRIES; i++) {
    const a = rng.next() * 2 - 1;
    const b = rng.next() * 2 - 1;
    const d2 = a * a + b * b;
    if (d2 < MIN_LENGTH_SQUARED || d2 > 1) continue;
    const d = Math.sqrt(d2);
    dirX = a / d;
    dirY = b / d;
    return;
  }
  dirX = 1;
  dirY = 0;
}

/** Rotates (x, y) by k × 360° / count for count 1..3; writes dirX/dirY. */
export function rotatedDirection(x: number, y: number, k: number, count: number): void {
  if (k === 0 || count <= 1) {
    dirX = x;
    dirY = y;
  } else if (count === 2) {
    dirX = -x;
    dirY = -y;
  } else {
    const sin = k === 1 ? SIN_120 : -SIN_120;
    dirX = x * COS_120 - y * sin;
    dirY = x * sin + y * COS_120;
  }
}
