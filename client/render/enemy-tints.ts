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
  "iron-marshal": 0x9aa3b8,
  "pale-abbot": 0xd9f0e8,
  gunmaster: 0x2f5fb0,
  "dread-regent": 0x8a1f3c,
  // provisional faction tints (enemy factions plan, Task 6 sets the palettes)
  brute: 0x3f6b3a,
  spearthrower: 0x5a7d4a,
  hornback: 0x6b5236,
  bloodcaller: 0x8a3030,
  warlord: 0x2e4f2a,
  ghoul: 0xcfd6bf,
  webcrawler: 0xa9b89a,
  rotgut: 0x7f9a6a,
  gravebinder: 0x9ec7a0,
  risen: 0xe0e4d8,
  "bone-tyrant": 0xb7c4a6,
  huntress: 0x7a6ad0,
  "moon-archer": 0x4bb8c4,
  "stone-warden": 0x5e5f9a,
  "grove-druid": 0x3fa7a0,
  "grove-warden": 0x6a4fb8,
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
