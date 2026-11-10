const TINTS: Readonly<Record<string, number>> = {
  stonehorn: 0x553300,
  nightglaive: 0x3a1f66,
  gravecaller: 0x1f4d2a,
  "serpent-shaman": 0x0f4a4a,
};

/** Emissive tint of the hero's model; an unknown hero gets the first hero's tint. */
export function heroTint(heroId: string): number {
  return TINTS[heroId] ?? 0x553300;
}
