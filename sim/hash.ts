import { meteorsOf } from "./fire-pools";
import { chillOf } from "./chill";
import { DIFFICULTY_IDS } from "../data/schema";
import { MAX_ROWS, ROLLED_ITEM } from "./gear";
import type { PlayerState } from "./player";
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

const STATES = { playing: 0, levelUp: 1, won: 2, lost: 3, chest: 4 } as const;
const RESULTS = { won: 1, castle: 2, hero: 3 } as const;

/** FNV-1a (32 bit) over the simulation state, for determinism and replay tests. */
export function stateHash(run: Run): number {
  h = 2166136261;
  const map = run.map;
  mixInt(map.islandCount);
  let islands = 0;
  for (let i = 0; i < map.islandCount; i++) islands += map.islandX[i]! + map.islandY[i]! + map.islandR[i]!;
  mixFloat(islands);
  const hz = run.hazard;
  mixInt(hz.nextWaveTick);
  if (hz.weatherTicks !== 0 || hz.warnTicks !== 0) {
    // mixed only while a weather is announced or runs, so the hash of a storm world stays as before plan 3a
    mixInt(hz.weatherTicks);
    mixInt(hz.warnTicks);
    mixInt(hz.waves);
  }
  mixInt(run.hazardRng.state);
  for (let i = 0; i < hz.ticks.length; i++) {
    mixInt(hz.ticks[i]!);
    mixFloat(hz.x[i]!);
    mixFloat(hz.y[i]!);
  }
  mixInt(run.tick);
  mixInt(STATES[run.state]);
  mixInt(run.result === null ? 0 : RESULTS[run.result]);
  mixInt(run.rng.state);
  for (let i = 0; i < run.players.length; i++) mixInt(run.players[i]!.heroIndex);
  mixInt(run.world);
  mixInt(DIFFICULTY_IDS.indexOf(run.difficulty));
  // every player block mixes the values of a one-hero run in the same order, so one player hashes as before
  for (let i = 0; i < run.players.length; i++) mixPlayer(run.players[i]!);
  mixInt(run.sustainRng.state);
  const orbs = run.orbs;
  for (let i = 0; i < orbs.alive.length; i++) {
    mixInt(orbs.alive[i]!);
    mixInt(orbs.kind[i]!);
    mixInt(orbs.timer[i]!);
    mixFloat(orbs.x[i]!);
    mixFloat(orbs.y[i]!);
  }
  mixInt(run.stats.kills);
  mixInt(run.stats.spawned);
  mixFloat(run.castle.hp);
  mixInt(run.nextPackTick);
  mixInt(run.elitePhase);
  mixInt(run.factionIndex);
  const corpses = run.corpses;
  mixInt(corpses.head);
  for (let i = 0; i < corpses.capacity; i++) {
    mixInt(corpses.alive[i]!);
    mixInt(corpses.tick[i]!);
    mixFloat(corpses.x[i]!);
    mixFloat(corpses.y[i]!);
  }
  mixInt(run.stats.raised);
  mixInt(run.nextEvent);
  mixInt(run.rushWarned ? 1 : 0);
  mixFloat(run.rushDirX);
  mixFloat(run.rushDirY);
  mixInt(run.bossCount);
  mixFloat(run.slamCooldownScale);
  mixInt(run.finalBossSlot);
  mixInt(run.finalBossDead ? 1 : 0);
  mixInt(run.enraged ? 1 : 0);
  mixFloat(run.stats.xpGained);
  mixInt(run.bossLogCount);
  for (let b = 0; b < run.bossLogCount; b++) {
    mixInt(run.bossLog[b].type);
    mixInt(run.bossLog[b].spawnTick);
    mixInt(run.bossLog[b].deathTick);
  }
  for (let i = 0; i < run.players.length; i++) mixAbilities(run, run.players[i]!);
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
    // mixed only with several players, so a one-player run hashes as before
    if (run.players.length > 1) mixInt(e.target[i]);
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
    mixInt(e.bloodlustTicks[i]);
    mixInt(e.bloodlustType[i]);
    mixInt(e.bloodlustCooldown[i]);
    mixInt(e.raiseCooldown[i]);
    mixInt(e.slamState[i]);
    mixInt(e.slamTicks[i]);
    mixInt(e.slamCooldown[i]);
    mixFloat(e.slamX[i]);
    mixFloat(e.slamY[i]);
    mixInt(e.strikeCooldown[i]);
    mixFloat(e.maxHp[i]);
    mixFloat(e.damageScale[i]);
    mixInt(e.spawnTick[i]);
    mixInt(e.lastHitTick[i]);
    mixInt(e.lastAttackTick[i]);
    mixFloat(e.facingX[i]);
    mixFloat(e.facingY[i]);
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
  mixInt(run.chestRng.state);
  mixInt(run.chestsOpened);
  mixInt(run.bossesKilled);
  // each player's chest price; one player mixes the one price in the same place as before
  for (let i = 0; i < run.players.length; i++) mixFloat(run.players[i]!.chestPriceRaw);
  for (let i = 0; i < run.players.length; i++) mixInt(run.players[i]!.openChest + 1);
  // the co-op choice time, only with several players, so a one-player run hashes as before
  if (run.players.length > 1) for (let i = 0; i < run.players.length; i++) mixInt(run.players[i]!.choosingTicks);
  // revive progress (step 6), likewise only with several players
  if (run.players.length > 1) for (let i = 0; i < run.players.length; i++) mixInt(run.players[i]!.reviveTicks);
  // the meteors' pools of fire only in a meteors world, so the other worlds keep their hashes
  if (meteorsOf(run) !== null) {
    const hz = run.hazard;
    mixInt(hz.pools);
    for (let i = 0; i < hz.poolTicks.length; i++) {
      mixInt(hz.poolTicks[i]!);
      if (hz.poolTicks[i]! > 0) {
        mixFloat(hz.poolX[i]!);
        mixFloat(hz.poolY[i]!);
      }
    }
  }
  // the blizzard's chill only in a world whose weather has one, so the other worlds keep their hashes
  if (chillOf(run) !== null) {
    for (let i = 0; i < run.players.length; i++) {
      mixInt(run.players[i]!.stillTicks);
      mixInt(run.players[i]!.chilled ? 1 : 0);
    }
  }
  for (let i = 0; i < run.chests.x.length; i++) {
    mixFloat(run.chests.x[i]!);
    mixFloat(run.chests.y[i]!);
  }
  for (const p of run.players) {
    if (p.chestOffer === null) mixInt(0);
    else {
      const cards = p.chestOffer.cards;
      mixInt(cards.length);
      for (let k = 0; k < cards.length; k++) {
        const card = cards[k]!;
        mixInt(card.slot + 1);
        mixInt(card.item + 1);
        mixInt(card.action);
      }
    }
    mixFloat(p.gold);
  }
  mixFloat(run.stats.goldGained);
  const coins = run.coins;
  for (let i = 0; i < coins.capacity; i++) {
    if (coins.alive[i] === 0) continue;
    mixInt(i);
    mixInt(coins.attracted[i]);
    mixInt(coins.value[i]);
    mixFloat(coins.x[i]);
    mixFloat(coins.y[i]);
  }
  const hearts = run.hearts;
  for (let i = 0; i < hearts.capacity; i++) {
    if (hearts.alive[i] === 0) continue;
    mixInt(i);
    mixInt(hearts.attracted[i]);
    mixInt(hearts.value[i]);
    mixFloat(hearts.x[i]);
    mixFloat(hearts.y[i]);
  }
  // owners are mixed only with several players, so a one-player run hashes as before
  const owners = run.players.length > 1;
  const pr = run.projectiles;
  for (let i = 0; i < pr.capacity; i++) {
    if (pr.alive[i] === 0) continue;
    mixInt(i);
    if (owners) mixInt(pr.owner[i]!);
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
    if (owners) mixInt(al.owner[i]!);
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
  for (let i = 0; i < run.players.length; i++) mixOffer(run.players[i]!);
  return h;
}

function mixPlayer(p: PlayerState): void {
  mixInt(p.ultimateAuto ? 1 : 0);
  mixInt(p.ultimateRequested ? 1 : 0);
  const hero = p.hero;
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
  mixInt(hero.dashCharges);
  mixInt(hero.blinkCooldown);
  mixInt(hero.slowTicks);
  mixFloat(hero.slowShare);
  mixInt(hero.rootTicks);
  mixFloat(hero.dashDirX);
  mixFloat(hero.dashDirY);
  mixFloat(hero.bonus.damage);
  mixFloat(hero.bonus.moveSpeed);
  mixFloat(hero.bonus.attackSpeed);
  const gear = p.gear;
  for (let i = 0; i < gear.item.length; i++) {
    mixInt(gear.item[i]! + 1);
    mixInt(gear.base[i]!);
    mixInt(gear.temp[i]!);
    // a rolled item (random items): its base, rarity, effect, name and rows; named items keep the old hash
    if (gear.item[i] !== ROLLED_ITEM) continue;
    mixInt(gear.rolledBase[i]!);
    mixInt(gear.rolledRarity[i]!);
    mixInt(gear.rolledEffect[i]! + 1);
    mixInt(gear.nameFirst[i]! + 1);
    mixInt(gear.nameNoun[i]! + 1);
    mixInt(gear.rowCount[i]!);
    for (let r = 0; r < gear.rowCount[i]!; r++) {
      mixInt(gear.rowStat[i * MAX_ROWS + r]!);
      mixFloat(gear.rowValue[i * MAX_ROWS + r]!);
      mixInt(gear.rowTier[i * MAX_ROWS + r]! + 1);
    }
  }
  const fx = p.gear.fx;
  mixInt(fx.chainCount);
  mixInt(fx.shieldWait);
  mixInt(fx.hasteLeft);
  mixFloat(fx.hasteCarry);
  mixInt(p.shieldTicks);
  mixFloat(hero.speedScale);
  const buffs = p.buffs;
  mixInt(buffs.bootsTicks);
  mixInt(buffs.berserkTicks);
  mixInt(buffs.healTicks);
  mixFloat(buffs.lifestealBudget);
  mixFloat(buffs.healCarry);
}

function mixAbilities(run: Run, p: PlayerState): void {
  for (const slot of p.abilities) {
    mixInt(run.data.abilities.indexOf(slot.def)); // -1 for an empty slot
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
}

function mixOffer(p: PlayerState): void {
  if (p.offer === null) mixInt(0);
  else {
    const cards = p.offer.cards;
    mixInt(cards.length);
    for (let k = 0; k < cards.length; k++) {
      const card = cards[k]!;
      if (card.kind === "ability") {
        mixInt(1);
        mixInt(card.slot);
        mixInt(card.fromLevel);
        mixInt(card.toLevel);
      } else if (card.kind === "learn") {
        mixInt(5);
        mixInt(card.slot);
        mixInt(card.ability);
      } else {
        mixInt(card.attribute === "str" ? 2 : card.attribute === "agi" ? 3 : 4);
        mixFloat(card.amount);
      }
    }
  }
}
