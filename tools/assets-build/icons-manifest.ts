/** The pinned game-icons.net source of the item icons (CC BY 3.0; the authors are its top-level folders). */
import { ICON_AUTHORS, ITEM_ICONS, iconFile } from "../../client/ui/item-icon-names";

export const ICON_REPO = "game-icons/icons";
export const ICON_COMMIT = "82d948812bfe3f269ef8f731dcdb07b08160edc4";
/** The day the pinned files were fetched (kept, so a rebuild does not change the license rows). */
export const ICON_DOWNLOADED = "2026-11-27";


/** Every icon reference the items use, once, sorted. */
export function iconRefs(): string[] {
  return [...new Set(Object.values(ITEM_ICONS))].sort();
}

export const rawUrl = (ref: string): string =>
  `https://raw.githubusercontent.com/${ICON_REPO}/${ICON_COMMIT}/${ref}.svg`;
export const pageUrl = (ref: string): string => `https://game-icons.net/1x1/${ref}.html`;
export { ICON_AUTHORS, iconFile };
