import type { Run } from "./run";

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);

let h = 0;

function mixInt(n: number): void {
  h = Math.imul(h ^ (n >>> 0), 16777619) >>> 0;
}

function mixFloat(n: number): void {
  f64[0] = n;
  mixInt(u32[0]);
  mixInt(u32[1]);
}

const STATES = { playing: 0, levelUp: 1, won: 2, lost: 3 } as const;
const RESULTS = { won: 1, castle: 2, hero: 3 } as const;

/** FNV-1a (32 bit) over the simulation state, for determinism and replay tests. */
export function stateHash(run: Run): number {
  h = 2166136261;
  mixInt(run.tick);
  mixInt(STATES[run.state]);
  mixInt(run.result === null ? 0 : RESULTS[run.result]);
  mixInt(run.rng.state);
  const hero = run.hero;
  mixFloat(hero.x);
  mixFloat(hero.y);
  mixFloat(hero.facingX);
  mixFloat(hero.facingY);
  mixInt(hero.level);
  mixFloat(hero.xp);
  mixFloat(hero.str);
  mixFloat(hero.agi);
  mixFloat(hero.int);
  mixFloat(run.castle.hp);
  mixFloat(run.spawnCredit);
  mixInt(run.nextGate);
  const e = run.enemies;
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0) continue;
    mixInt(i);
    mixInt(e.type[i]);
    mixInt(e.role[i]);
    mixFloat(e.x[i]);
    mixFloat(e.y[i]);
    mixFloat(e.hp[i]);
    mixInt(e.attackCooldown[i]);
    mixInt(e.stunTicks[i]);
    mixInt(e.aggro[i]);
    mixInt(e.action[i]);
  }
  return h;
}
