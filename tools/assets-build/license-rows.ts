const GENERATED_DIRS = ["models/heroes/", "models/enemies/", "models/env/"];

/** Replaces the generated model rows of the license table; the robot and the audio rows stay. */
export function mergeModelRows(table: string, rows: string[]): string {
  const kept = table.split("\n").filter((l) => !GENERATED_DIRS.some((d) => l.includes(`\`${d}`)));
  while (kept.length > 0 && kept[kept.length - 1] === "") kept.pop();
  return `${[...kept, ...rows].join("\n")}\n`;
}
