import { Color } from "three/webgpu";

const FALLBACK_TINT = 0xc23b3b;

/** One colour per enemy type, so the types read apart in a crowd (spec 6). */
export const ENEMY_TINTS: Readonly<Record<string, number>> = {
  shieldbearer: 0xc23b3b,
  scout: 0xd8c84a,
  musketeer: 0x3b7bd9,
  chaplain: 0xe6e6f2,
  lancer: 0x7a8296,
  captain: 0xb84ad8,
};

/** Colour of an enemy type; an unknown type is red. */
export function enemyTint(id: string): number {
  return ENEMY_TINTS[id] ?? FALLBACK_TINT;
}

/** Linear rgb per type index (3 floats each). Allocates: call it once at start. */
export function tintTable(enemies: readonly { id: string }[]): Float32Array {
  const table = new Float32Array(enemies.length * 3);
  const color = new Color();
  enemies.forEach((enemy, i) => {
    color.set(enemyTint(enemy.id));
    table[i * 3] = color.r;
    table[i * 3 + 1] = color.g;
    table[i * 3 + 2] = color.b;
  });
  return table;
}
