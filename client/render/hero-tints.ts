const TINTS: Readonly<Record<string, number>> = {
  stonehorn: 0x553300,
  nightglaive: 0x3a1f66,
  gravecaller: 0x1f4d2a,
  "serpent-shaman": 0x0f4a4a,
  mistwarden: 0x2a3a4d,
  sparkshot: 0x4d4410,
  redcleaver: 0x551a1a,
  tidecaller: 0x10305a,
  razorwind: 0x4d1030,
  dawnhammer: 0x5a4a10,
  frostweaver: 0x104a5a,
  deadeye: 0x3d2a14,
  ashsinger: 0x5a2008,
  thunderhoof: 0x3a2a10,
  stormseer: 0x1a2a5a,
  mirrorblade: 0x2a3a3a,
  lightbinder: 0x5a5020,
  skyweaver: 0x302060,
  ironroar: 0x40281a,
  stonebeard: 0x3a3a40,
  rimebreaker: 0x1e3a50,
  arcfang: 0x2a2050,
  emberclaw: 0x501a10,
  galestrider: 0x2a4030,
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
  razorwind: 0xe05a9a,
  dawnhammer: 0xfff0b0,
  frostweaver: 0xa8ecff,
  deadeye: 0xc08a50,
  ashsinger: 0xff8a3a,
  thunderhoof: 0x9a7a4a,
  stormseer: 0x6a8aff,
  mirrorblade: 0xd0f0e8,
  lightbinder: 0xfff6c8,
  skyweaver: 0x9a7aff,
  ironroar: 0xb06a3a,
  stonebeard: 0xb8c0cc,
  rimebreaker: 0xa8e0ff,
  arcfang: 0xb0a0ff,
  emberclaw: 0xff8a40,
  galestrider: 0x9ad8b0,
};

/** Bright body colour of the hero's model, one per hero; unknown heroes get the first. */
export function heroBodyColor(heroId: string): number {
  return BODY_COLORS[heroId] ?? 0xd9a441;
}
