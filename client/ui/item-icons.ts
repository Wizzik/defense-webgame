import type { SlotType } from "../../data/schema";

/** Our own glyphs, one per slot type (24 x 24, drawn with the text colour). The frame of a slot carries the rarity. */
const GLYPHS: Record<SlotType, string> = {
  head: '<path d="M5 14a7 7 0 0 1 14 0v4h-4v-3H9v3H5z"/>',
  neck: '<path d="M6 4c0 6 3 9 6 9s6-3 6-9"/><path d="M12 13l3 4-3 4-3-4z"/>',
  shoulders: '<path d="M3 15c0-5 4-9 9-9s9 4 9 9"/><path d="M3 15h6v3M21 15h-6v3"/>',
  back: '<path d="M8 4h8l3 16H5z"/><path d="M12 4v16"/>',
  chest: '<path d="M6 5l3 2h6l3-2 1 6-2 8H7l-2-8z"/><path d="M12 7v12"/>',
  wrist: '<path d="M8 5h8l-1 14H9z"/><path d="M8.5 9h7M9 14h6"/>',
  hands: '<path d="M7 20v-7l-2-3 1.5-1L9 12V5h2v5V4h2v6V5h2v6V7h2v8l-2 5z"/>',
  waist: '<path d="M3 10h18v4H3z"/><path d="M10 9h4v6h-4z"/>',
  legs: '<path d="M7 4h10l1 16h-4l-2-10-2 10H6z"/>',
  feet: '<path d="M9 4h5v9l5 3v4H7v-4l2-2z"/>',
  ring: '<circle cx="12" cy="14" r="5"/><path d="M12 9L9.5 6h5z"/>',
  trinket: '<circle cx="12" cy="10" r="6"/><path d="M8 20h8M10 17h4"/>',
  mainHand: '<path d="M19 3h2v2L10 16l-2-2z"/><path d="M5 13l6 6M4 20l3-3"/>',
  offHand: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M12 7v10"/>',
};

/** The icon of a slot type as an inline SVG. */
export function iconSvg(type: SlotType): string {
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" ' +
    `stroke-linecap="round" aria-hidden="true">${GLYPHS[type]}</svg>`
  );
}
