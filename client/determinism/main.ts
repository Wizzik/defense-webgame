// Determinism page (spec 2026-11-20 multiplayer spike, 5.2): runs the matrix and shows its digest.
// URL: ?case=<id> runs one case, ?every=<n> checkpoints every n steps, ?ticks=<n> caps the steps of each case.
import { loadGameData } from "../game/data";
import { CHECKPOINT_EVERY, matrixCases, matrixDigest, runCase, type CaseResult } from "./matrix";

interface DeterminismState {
  done: boolean;
  results: CaseResult[];
  digest: string;
  ms: number;
}

declare global {
  interface Window {
    __determinism?: DeterminismState;
  }
}

function positiveInt(value: string | null, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

const params = new URLSearchParams(location.search);
const data = loadGameData();
const only = params.get("case");
const every = positiveInt(params.get("every"), CHECKPOINT_EVERY);
const ticks = positiveInt(params.get("ticks"), 0);
const cases = matrixCases(data)
  .filter((c) => only === null || c.id === only)
  .map((c) => (ticks > 0 ? { ...c, maxTicks: Math.min(c.maxTicks, ticks) } : c));

const state: DeterminismState = { done: false, results: [], digest: "", ms: 0 };
window.__determinism = state;

const digestEl = document.getElementById("digest")!;
const progressEl = document.getElementById("progress")!;
const rowsEl = document.getElementById("rows")!;

function hex(n: number): string {
  return (n >>> 0).toString(16).padStart(8, "0");
}

function addRow(r: CaseResult): void {
  const tr = document.createElement("tr");
  for (const text of [r.id, String(r.ticks), r.state, hex(r.checkpoints[r.checkpoints.length - 1] ?? 0)]) {
    const td = document.createElement("td");
    td.textContent = text;
    tr.appendChild(td);
  }
  rowsEl.appendChild(tr);
}

const start = performance.now();
let next = 0;

function step(): void {
  if (next >= cases.length) {
    state.ms = performance.now() - start;
    state.digest = matrixDigest(state.results);
    digestEl.textContent = state.digest;
    progressEl.textContent = `${cases.length} / ${cases.length} cases in ${(state.ms / 1000).toFixed(1)} s`;
    state.done = true;
    return;
  }
  const result = runCase(data, cases[next]!, every);
  state.results.push(result);
  addRow(result);
  next++;
  progressEl.textContent = `${next} / ${cases.length} cases, ${((performance.now() - start) / 1000).toFixed(1)} s`;
  setTimeout(step, 0);
}

if (cases.length === 0) progressEl.textContent = `unknown case ${only}`;
else setTimeout(step, 0);
