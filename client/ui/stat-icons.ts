import type { StatId } from "../../data/schema";

/**
 * Our own small glyph for every item stat (24 x 24 line drawings in the stat's own colour), shown on a dark tile at
 * the start of each stat row of the tooltip, the chest cards and the keep / take compare (Petr, 2026-11-28: "it
 * would need icons for the different stats"). Every stat has a glyph and a colour of its own; an unknown id gets a
 * plain diamond in the text colour.
 */
interface StatIcon {
  glyph: string;
  color: string;
}

const ICONS: Record<StatId, StatIcon> = {
  // attributes
  str: { color: "#ff6b6b", glyph: '<path d="M7 7v10M17 7v10M4 9.5v5M20 9.5v5M7 12h10"/>' },
  agi: { color: "#8fd694", glyph: '<path d="M20 4C11 4 5 10 5 19v1"/><path d="M5 19L18 6"/><path d="M9 15h5.5M12.5 11.5H17"/>' },
  int: {
    color: "#6fb7ff",
    glyph: '<path d="M12 6.5C10 5 7 4.5 4 4.5v13c3 0 6 .5 8 2 2-1.5 5-2 8-2v-13c-3 0-6 .5-8 2z"/><path d="M12 6.5v13"/>',
  },
  // defence
  hp: { color: "#ff8fb1", glyph: '<path d="M12 20s-7.5-4.6-7.5-10.2A4 4 0 0 1 12 7.4a4 4 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/>' },
  armor: { color: "#c3ccd6", glyph: '<path d="M12 3l7 3v5.5c0 4.6-3 7.7-7 9.5-4-1.8-7-4.9-7-9.5V6z"/>' },
  regen: {
    color: "#b5cf62",
    glyph: '<path d="M11 19.5s-6.5-4-6.5-9a3.6 3.6 0 0 1 6.5-2.2 3.6 3.6 0 0 1 5.6.4"/><path d="M17.5 12v8M13.5 16h8"/>',
  },
  dodge: { color: "#a8c8ff", glyph: '<circle cx="15" cy="12" r="5"/><path d="M3 8h6M2 12h5M3 16h6"/>' },
  damageTaken: { color: "#7fe0d0", glyph: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 20h16"/>' },
  thorns: {
    color: "#c9b48f",
    glyph: '<path d="M4 20L20 4"/><path d="M8 16l-3.5-1M8 16l1 3.5M12 12l-3.5-1M12 12l1 3.5M16 8l-3.5-1M16 8l1 3.5"/>',
  },
  lifesteal: {
    color: "#e2475a",
    glyph: '<path d="M12 3s6 6.8 6 11a6 6 0 0 1-12 0c0-4.2 6-11 6-11z"/><path d="M9.5 12.5l1.2 3 1.3-3 1.3 3 1.2-3"/>',
  },
  // attack
  damage: { color: "#ff9e7a", glyph: '<path d="M4 4l11 11"/><path d="M4 4h3.5L17 13.5"/><path d="M13 19l6-6M16.5 16.5L20 20"/>' },
  attackSpeed: { color: "#ffe36e", glyph: '<path d="M3 8h11M11 4.5L14.5 8 11 11.5"/><path d="M9 16h11M17 12.5l3.5 3.5-3.5 3.5"/>' },
  critChance: {
    color: "#ff7043",
    glyph: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  },
  critDamage: {
    color: "#ff4fa0",
    glyph: '<path d="M12 2.5l1.9 5.6 5.4-2.4-2.4 5.4 5.6 1.9-5.6 1.9 2.4 5.4-5.4-2.4L12 21.5l-1.9-5.6-5.4 2.4 2.4-5.4L1.5 13l5.6-1.9L4.7 5.7l5.4 2.4z"/>',
  },
  // spells
  spellPower: {
    color: "#c77dff",
    glyph: '<path d="M12 21c-3.6 0-6-2.6-6-6 0-4 4-6 4-11 2.8 1.8 4 4.4 4 7 .9-.8 1.8-2 2-3.6 1.8 2 2 4.6 2 7.6 0 3.4-2.4 6-6 6z"/>',
  },
  cooldownSpeed: { color: "#9fd0ff", glyph: '<path d="M6 3h12M6 21h12"/><path d="M7 3c0 4.5 5 6 5 9s-5 4.5-5 9M17 3c0 4.5-5 6-5 9s5 4.5 5 9"/>' },
  ultimateCooldown: { color: "#f5a3ff", glyph: '<circle cx="12" cy="13.5" r="7.5"/><path d="M10 2.5h4M12 2.5v3.5M12 9.5v4l2.8 2"/>' },
  areaSize: { color: "#c4f1ff", glyph: '<path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5"/><circle cx="12" cy="12" r="3.5"/>' },
  // utility
  moveSpeed: { color: "#7fd8ff", glyph: '<path d="M8 3h5v8l5.8 2.9a2 2 0 0 1 1.2 1.8V19H6V3z"/><path d="M6 15.5h4"/>' },
  magnet: { color: "#9fe0c4", glyph: '<path d="M6 3v9a6 6 0 0 0 12 0V3"/><path d="M6 7.5h3.5M14.5 7.5H18M9.5 3v9a2.5 2.5 0 0 0 5 0V3"/>' },
  goldFind: {
    color: "#f2c14e",
    glyph: '<ellipse cx="12" cy="6.5" rx="7" ry="3"/><path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
  },
  magicFind: { color: "#e0a0ff", glyph: '<path d="M6 4h12l3.5 5L12 20.5 2.5 9z"/><path d="M2.5 9h19M9 4l3 16.5L15 4"/>' },
};

const FALLBACK: StatIcon = { color: "#c3ccd6", glyph: '<path d="M12 4l8 8-8 8-8-8z"/>' };

/** Whether a stat has an icon of its own (for tests). */
export function hasStatIcon(stat: string): boolean {
  return Object.hasOwn(ICONS, stat);
}

/** The glyph markup of a stat (for tests: every glyph is different). */
export function statGlyph(stat: string): string | undefined {
  return hasStatIcon(stat) ? ICONS[stat as StatId].glyph : undefined;
}

/** The colour of a stat's icon. */
export function statColor(stat: string): string {
  return hasStatIcon(stat) ? ICONS[stat as StatId].color : FALLBACK.color;
}

/** A stat's icon as an inline SVG on a dark tile (`.stat-icon` in the CSS), in the stat's colour. */
export function statIconSvg(stat: string): string {
  const icon = hasStatIcon(stat) ? ICONS[stat as StatId] : FALLBACK;
  return (
    `<svg class="stat-icon" viewBox="0 0 24 24" style="color:${icon.color}" aria-hidden="true">` +
    `<g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round">` +
    `${icon.glyph}</g></svg>`
  );
}
