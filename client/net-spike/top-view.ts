// A 2D top view of a run for the net spike page: the castle, the hero, enemies as dots, bosses bigger.
import type { Run } from "../../sim";

const BG = "#141a24";
const GRID = "#1c2533";
const CASTLE = "#7f9cc0";
const HERO = "#e6edf5";
const ENEMY = "#b5525c";
const BOSS = "#d77a86";

export function drawTopView(ctx: CanvasRenderingContext2D, run: Run): void {
  const { width, height } = ctx.canvas;
  const arena = run.data.rules.arena;
  const sx = width / arena.width;
  const sy = height / arena.height;
  // world +y is north, the canvas grows downwards
  const px = (x: number) => (x + arena.width / 2) * sx;
  const py = (y: number) => (arena.height / 2 - y) * sy;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = GRID;
  ctx.beginPath();
  ctx.arc(px(arena.castle.x), py(arena.castle.y), arena.spawn.radius * sx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = CASTLE;
  ctx.beginPath();
  ctx.arc(px(run.castle.x), py(run.castle.y), Math.max(4, run.castle.radius * sx), 0, Math.PI * 2);
  ctx.fill();
  const e = run.enemies;
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0) continue;
    const boss = run.isBoss[e.type[i]!] === 1;
    ctx.fillStyle = boss ? BOSS : ENEMY;
    const r = boss ? 6 : 2;
    ctx.fillRect(px(e.x[i]!) - r, py(e.y[i]!) - r, r * 2, r * 2);
  }
  ctx.fillStyle = HERO;
  ctx.beginPath();
  ctx.arc(px(run.hero.x), py(run.hero.y), 5, 0, Math.PI * 2);
  ctx.fill();
}
