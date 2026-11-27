const GENERATED_DIRS = ["models/heroes/", "models/enemies/", "models/env/"];

/** Replaces the generated model rows of the license table; the robot, audio and icon rows stay. */
export function mergeModelRows(table: string, rows: string[]): string {
  return mergeRows(table, GENERATED_DIRS, rows);
}

/** Replaces the rows of files under `dirs` (paths relative to `assets/`) with `rows`; every other row stays. */
export function mergeRows(table: string, dirs: readonly string[], rows: string[]): string {
  const kept = table.split("\n").filter((l) => !dirs.some((d) => l.includes(`\`${d}`)));
  while (kept.length > 0 && kept[kept.length - 1] === "") kept.pop();
  return `${[...kept, ...rows].join("\n")}\n`;
}
