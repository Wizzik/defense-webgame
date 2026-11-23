// A 2D top view of a run for the net spike page: the castle, the heroes (the local one brighter), enemies as dots, bosses bigger.
import type { Run } from "../../sim";

const BG = "#141a24";
const GRID = "#1c2533";
const CASTLE = "#7f9cc0";
const HERO = "#e6edf5";
const TEAMMATE = "#7fb4d9";
const FALLEN = "#5d6b80";
const ENEMY = "#b5525c";
const BOSS = "#d77a86";

export function drawTopView(ctx: CanvasRenderingContext2D, run: Run, local = 0): void {
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
  for (let p = 0; p < run.players.length; p++) {
    const hero = run.players[p]!.hero;
    if (hero.hp <= 0) {
      // a fallen hero stays on the map as a grey cross (no revive yet: migration step 6)
      ctx.strokeStyle = FALLEN;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px(hero.x) - 5, py(hero.y) - 5);
      ctx.lineTo(px(hero.x) + 5, py(hero.y) + 5);
      ctx.moveTo(px(hero.x) + 5, py(hero.y) - 5);
      ctx.lineTo(px(hero.x) - 5, py(hero.y) + 5);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = p === local ? HERO : TEAMMATE;
    ctx.beginPath();
    ctx.arc(px(hero.x), py(hero.y), 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
