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
  mixInt(run.heroIndex);
  mixInt(run.ultimateAuto ? 1 : 0);
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
  mixFloat(hero.hp);
  mixInt(hero.attackCooldown);
  mixInt(hero.pendingLevelUps);
  mixInt(run.stats.kills);
  mixInt(run.stats.spawned);
  mixFloat(run.castle.hp);
  mixFloat(run.spawnCredit);
  mixInt(run.nextGate);
  for (const slot of run.abilities) {
    mixInt(slot.level);
    mixInt(slot.cooldown);
    mixInt(slot.active ? 1 : 0);
    mixFloat(slot.front);
    mixInt(slot.ticksLeft);
    mixFloat(slot.originX);
    mixFloat(slot.originY);
    mixFloat(slot.dirX);
    mixFloat(slot.dirY);
  }
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
    mixFloat(e.knockVX[i]);
    mixFloat(e.knockVY[i]);
    mixInt(e.knockTicks[i]);
    mixInt(e.slowTicks[i]);
    mixFloat(e.slowFactor[i]);
  }
  const c = run.crystals;
  for (let i = 0; i < c.capacity; i++) {
    if (c.alive[i] === 0) continue;
    mixInt(i);
    mixInt(c.attracted[i]);
    mixInt(c.value[i]);
    mixFloat(c.x[i]);
    mixFloat(c.y[i]);
  }
  const pr = run.projectiles;
  for (let i = 0; i < pr.capacity; i++) {
    if (pr.alive[i] === 0) continue;
    mixInt(i);
    mixInt(pr.ability[i]);
    mixInt(pr.target[i]);
    mixFloat(pr.x[i]);
    mixFloat(pr.y[i]);
  }
  if (run.offer) {
    for (const card of run.offer.cards) {
      if (card.kind === "ability") {
        mixInt(1);
        mixInt(card.slot);
        mixInt(card.toLevel);
      } else {
        mixInt(card.attribute === "str" ? 2 : card.attribute === "agi" ? 3 : 4);
        mixFloat(card.amount);
      }
    }
  }
  return h;
}
