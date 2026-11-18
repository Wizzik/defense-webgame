/**
 * Our own glyphs for the shared spells and the passives (24 x 24, drawn with the text colour; the CSS gives
 * them deep blue and blue-grey tones). An ability without a glyph of its own gets a plain diamond.
 */
const GLYPHS: Record<string, string> = {
  // shared spells
  "arc-lightning": '<path d="M13 2L6 13h5l-2 9 8-12h-5z"/>',
  smite: '<path d="M12 2v13"/><path d="M8 11l4 4 4-4"/><path d="M5 20h14"/><path d="M8 17l-2 3M16 17l2 3"/>',
  "fire-bolt": '<path d="M4 20l9-9"/><path d="M13 11c0-4 3-6 7-7-1 4-3 7-7 7z"/><path d="M9 15l-2-1M11 17l-1-2"/>',
  "frost-ring": '<circle cx="12" cy="12" r="8"/><path d="M12 7v10M7.7 9.5l8.6 5M7.7 14.5l8.6-5"/>',
  meteor: '<circle cx="15" cy="15" r="4"/><path d="M12 12L4 4M13 9L7 3M9 13L3 7"/>',
  "holy-ground": '<path d="M3 18h18"/><path d="M6 18c0-3 3-5 6-5s6 2 6 5"/><path d="M12 3v6M9 6h6"/>',
  "blade-fan": '<path d="M12 20L5 6M12 20L12 4M12 20L19 6"/><path d="M4 9l2-3M20 9l-2-3M11 6l1-2 1 2"/>',
  "shock-wave": '<path d="M3 12h4"/><path d="M9 7c2 3 2 7 0 10"/><path d="M13 5c3 4 3 10 0 14"/><path d="M17 3c4 5 4 13 0 18"/>',
  "sentry-ward": '<path d="M12 3l4 4-4 4-4-4z"/><path d="M12 11v9M8 20h8"/><path d="M17 7h4M3 7h4"/>',
  "second-wind": '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/><path d="M12 10v6M9 13h6"/>',
  // passives
  might: '<path d="M6 18l9-9"/><path d="M13 5l6 6-2 2-6-6z"/><path d="M4 20l2-2"/>',
  "arcane-focus": '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  haste: '<circle cx="13" cy="13" r="7"/><path d="M13 9v4l3 2"/><path d="M2 8h4M1 12h3M2 16h4"/>',
  vigor: '<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11z"/>',
  "fleet-foot": '<path d="M9 4h5v9l5 3v4H7v-4l2-2z"/><path d="M2 12h4M3 16h3"/>',
  fortune: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5"/>',
};

const FALLBACK = '<path d="M12 4l8 8-8 8-8-8z"/>';

/** Whether an ability has a glyph of its own. */
export function hasAbilityIcon(id: string): boolean {
  return id in GLYPHS;
}

/** The icon of an ability as an inline SVG. */
export function abilityIconSvg(id: string): string {
  return (
    '<svg class="ability-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    `stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${GLYPHS[id] ?? FALLBACK}</svg>`
  );
}
