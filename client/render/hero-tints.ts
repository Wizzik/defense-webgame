const TINTS: Readonly<Record<string, number>> = {
  stonehorn: 0x553300,
  nightglaive: 0x3a1f66,
  gravecaller: 0x1f4d2a,
  "serpent-shaman": 0x0f4a4a,
  mistwarden: 0x2a3a4d,
  sparkshot: 0x4d4410,
  redcleaver: 0x551a1a,
  tidecaller: 0x10305a,
};

/** Emissive tint of the hero's model; an unknown hero gets the first hero's tint. */
export function heroTint(heroId: string): number {
  return TINTS[heroId] ?? 0x553300;
}

/** The hero's colour for effects: the tint, brightened so it shows up as a light on the floor. */
export function heroAccent(heroId: string): number {
  const tint = heroTint(heroId);
  const lift = (shift: number): number => Math.min(255, Math.round(((tint >> shift) & 0xff) * 2.5));
  return (lift(16) << 16) | (lift(8) << 8) | lift(0);
}

const BODY_COLORS: Readonly<Record<string, number>> = {
  stonehorn: 0xd9a441,
  nightglaive: 0x9a5cff,
  gravecaller: 0x7fdc3a,
  "serpent-shaman": 0x22c4e0,
  mistwarden: 0x8fb8d9,
  sparkshot: 0xe0d24a,
  redcleaver: 0xd94a4a,
  tidecaller: 0x3b8fe0,
};

/** Bright body colour of the hero's model, one per hero; unknown heroes get the first. */
export function heroBodyColor(heroId: string): number {
  return BODY_COLORS[heroId] ?? 0xd9a441;
}
