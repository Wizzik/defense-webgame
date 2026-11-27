/** Turns a game-icons.net SVG (untrusted text) into our icon: no background square, one path, `currentColor` fill. */

const HEAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">';
const BACKGROUND = "M0 0h512v512H0z";
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/;
const ELEMENT = /<path((?:\s+[a-z-]+="[^"]*")*)\s*\/>/gy;
const ATTRIBUTE = /\s+([a-z-]+)="([^"]*)"/g;

/** Throws when the file is anything but an svg of plain paths (white on a black square). */
export function optimizeIcon(text: string): string {
  const body = text.trim();
  if (!body.startsWith(HEAD) || !body.endsWith("</svg>")) throw new Error("not a plain 512 x 512 game-icons svg");
  const inner = body.slice(HEAD.length, -"</svg>".length);
  const paths: string[] = [];
  ELEMENT.lastIndex = 0;
  let match: RegExpExecArray | null;
  while (ELEMENT.lastIndex < inner.length && (match = ELEMENT.exec(inner)) !== null) {
    const attrs = new Map<string, string>();
    for (const [, name, value] of match[1]!.matchAll(ATTRIBUTE)) attrs.set(name!, value!);
    const d = attrs.get("d");
    if (d === undefined || !PATH_DATA.test(d)) throw new Error("a path without plain path data");
    for (const name of attrs.keys()) if (name !== "d" && name !== "fill") throw new Error(`unexpected attribute ${name}`);
    const fill = attrs.get("fill");
    if (d === BACKGROUND && fill === undefined) continue;
    if (fill !== "#fff") throw new Error(`unexpected fill ${fill ?? "(none)"}`);
    paths.push(d.trim());
  }
  if (ELEMENT.lastIndex !== inner.length || paths.length === 0) throw new Error("an element other than a path");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="${paths.join("")}"/></svg>\n`;
}
