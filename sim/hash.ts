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
  mixInt(hero.dashTicks);
  mixInt(hero.dashCooldown);
  mixFloat(hero.dashDirX);
  mixFloat(hero.dashDirY);
  mixFloat(hero.bonus.damage);
  mixFloat(hero.bonus.moveSpeed);
  mixFloat(hero.bonus.attackSpeed);
  mixInt(run.shieldTicks);
  mixInt(run.stats.kills);
  mixInt(run.stats.spawned);
  mixFloat(run.castle.hp);
  mixInt(run.nextPackTick);
  mixInt(run.elitePhase);
  mixInt(run.nextEvent);
  mixInt(run.rushWarned ? 1 : 0);
  mixFloat(run.rushDirX);
  mixFloat(run.rushDirY);
  mixInt(run.bossCount);
  mixFloat(run.slamCooldownScale);
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
    for (let i = 0; i < slot.hit.length; i++) mixInt(slot.hit[i]);
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
    mixInt(e.healCooldown[i]);
    mixInt(e.aggro[i]);
    mixInt(e.action[i]);
    mixFloat(e.knockVX[i]);
    mixFloat(e.knockVY[i]);
    mixInt(e.knockTicks[i]);
    mixInt(e.slowTicks[i]);
    mixFloat(e.slowFactor[i]);
    mixInt(e.chargeState[i]);
    mixInt(e.chargeTicks[i]);
    mixInt(e.chargeCooldown[i]);
    mixFloat(e.chargeDirX[i]);
    mixFloat(e.chargeDirY[i]);
    mixInt(e.buffed[i]);
    mixInt(e.slamState[i]);
    mixInt(e.slamTicks[i]);
    mixInt(e.slamCooldown[i]);
    mixFloat(e.slamX[i]);
    mixFloat(e.slamY[i]);
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
    mixInt(pr.targetSpawnTick[i]);
    mixFloat(pr.damage[i]);
    mixFloat(pr.speed[i]);
    mixFloat(pr.x[i]);
    mixFloat(pr.y[i]);
  }
  const al = run.allies;
  for (let i = 0; i < al.capacity; i++) {
    if (al.alive[i] === 0) continue;
    mixInt(i);
    mixInt(al.kind[i]);
    mixInt(al.ability[i]);
    mixFloat(al.x[i]);
    mixFloat(al.y[i]);
    mixInt(al.expiresTick[i]);
    mixInt(al.attackCooldown[i]);
    mixInt(al.spawnTick[i]);
    mixInt(al.lastAttackTick[i]);
    mixInt(al.formation[i]);
    mixInt(al.moving[i]);
    mixFloat(al.facingX[i]);
    mixFloat(al.facingY[i]);
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
