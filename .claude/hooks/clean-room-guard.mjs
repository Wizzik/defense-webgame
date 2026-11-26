// PreToolUse hook: refuses writes that would break the clean room (AGENTS.md) before they happen.
// Blocks: map files and extracted map data, and Math.random / Date / trig in sim/ and meta/ (determinism).
// The repo tests enforce the same rules; this only catches them earlier. Exit code 2 = block, stderr goes to Claude.
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const file = String(input.tool_input?.file_path ?? "").replaceAll("\\", "/");
const text = String(input.tool_input?.content ?? input.tool_input?.new_string ?? "");

const block = (why) => {
  process.stderr.write(`clean-room-guard: ${why} (${file}). See AGENTS.md.\n`);
  process.exit(2);
};

if (/\.w3x$/i.test(file) || /(^|\/)war3map\./i.test(file)) block("map files are never written into the repo");
if (/\/(data-source|xhero)\//.test(file) && !file.includes("/tmp/")) block("extracted map data stays outside the repo");

if (/\/(sim|meta)\/[^/]+\.ts$/.test(file) && !/\.test\.ts$/.test(file)) {
  const banned = /\bMath\.(random|sin|cos|tan|asin|acos|atan2?|sinh|cosh|tanh|exp|expm1|log1p|log2|log10|log|pow|cbrt|hypot)\b|\bDate\.now\b|\bnew Date\b|\bperformance\.now\b|\brequestAnimationFrame\b/;
  const hit = text.match(banned);
  if (hit) block(`'${hit[0]}' is not deterministic across engines; sim/ and meta/ must stay pure`);
}
process.exit(0);
