/**
 * Item icons: fetches the pinned game-icons.net SVGs into `assets-source/icons/` (untracked, untrusted data: only
 * read as text), writes them optimized to `assets/icons/<author>-<icon>.svg` and rewrites the icon rows of `assets/LICENSES.md`.
 * `npm run assets:icons`.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { targetPath } from "./fetch";
import { optimizeIcon } from "./icon-svg";
import { ICON_AUTHORS, ICON_DOWNLOADED, iconFile, iconRefs, pageUrl, rawUrl } from "./icons-manifest";
import { mergeRows } from "./license-rows";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "assets", "icons");
const LICENSES = join(ROOT, "assets", "LICENSES.md");

async function fetchIcon(ref: string): Promise<string> {
  const target = targetPath("icons", `${ref}.svg`);
  if (!existsSync(target)) {
    const res = await fetch(rawUrl(ref));
    if (!res.ok) throw new Error(`${res.status} for ${rawUrl(ref)}`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await res.arrayBuffer()));
  }
  return readFile(target, "utf8");
}

async function main(): Promise<void> {
  const refs = iconRefs();
  const names = new Map<string, string>();
  for (const ref of refs) {
    const author = ref.slice(0, ref.indexOf("/"));
    if (!ICON_AUTHORS[author]) throw new Error(`no author name for ${ref}`);
    const other = names.get(iconFile(ref));
    if (other) throw new Error(`${ref} and ${other} share a file name`);
    names.set(iconFile(ref), ref);
  }
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  const rows: string[] = [];
  let bytes = 0;
  for (const ref of refs) {
    const svg = optimizeIcon(await fetchIcon(ref));
    const file = `icons/${iconFile(ref)}.svg`;
    await writeFile(join(ROOT, "assets", file), svg);
    bytes += Buffer.byteLength(svg);
    const sha = createHash("sha256").update(svg).digest("hex");
    const author = ICON_AUTHORS[ref.slice(0, ref.indexOf("/"))]!;
    rows.push(
      `| icon ${iconFile(ref)} (\`${file}\`) | ${author} (game-icons.net); background removed, filled with currentColor | CC BY 3.0 | ${pageUrl(ref)} | ${ICON_DOWNLOADED} | \`${sha}\` |`,
    );
  }
  await writeFile(LICENSES, mergeRows(await readFile(LICENSES, "utf8"), ["icons/"], rows));
  console.log(`assets:icons: ${refs.length} icons, ${bytes} bytes, ${(await readdir(OUT)).length} files`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
