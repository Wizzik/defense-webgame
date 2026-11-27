import { RARITIES, stormOf } from "../data/schema";
import { poolAt } from "./fire-pools";
import { sharedSlotRange, ULTIMATE_SLOT } from "./abilities/slots";
import { OrbKind } from "./buffs";
import type { CardOffer } from "./cards";
import { ChestAction, type ChestCard, chestPrice } from "./chests";
import { Charge } from "./enemy-charge";
import { wornRarity } from "./gear";
import { Slam, windupRadius } from "./enemy-slam";
import { InputAction } from "./input";
import type { TickInput } from "./input";
import type { Run } from "./run";
import { computeFlow, crossesFeature, crossesIsland, flowDir, flowX, flowY } from "./world-map/flow";
import { cellOf } from "./world-map/grid";

/** An enemy nearer to the castle than this is a threat: the bot goes for the threat nearest to the castle. */
export const DEFEND_RADIUS = 1400;
/** With no threat and nobody near, the bot stands at (castle.x, castle.y + HOME_OFFSET). */
export const HOME_OFFSET = 400;
/** The autopilot stands this share of the revive radius from a fallen teammate (co-op, step 6). */
const REVIVE_STAND_SHARE = 0.5;
const HOME_TOLERANCE = 100;
/** The bot keeps this far inside the castle's defence circle when it walks to a target beyond the circle. */
const DEFEND_EDGE_MARGIN = 150;
/** With no threat the bot fights the enemy nearest to the hero within this distance. */
export const CHASE_DISTANCE = 400;
/** Farther than this from its post the bot walks back, whatever the enemies do (a retreat must not end in the spawn ring). */
export const LEASH_DISTANCE = 2150;
/**
 * A ranged hero kites like a player (Petr, batch 2): it keeps the nearest enemy at least KITE_KEEP_SHARE of its attack
 * range away (at most KITE_KEEP_MAX), walking away from the weight of every enemy within KITE_REACH and a
 * little sideways (KITE_SIDE, the side towards the castle), so it circles instead of backing into a corner. With
 * KITE_CROWD enemies within KITE_CROWD_RADIUS it dashes out. Below LOW_HP it keeps LOW_HP_DISTANCE more.
 */
const KITE_KEEP_SHARE = 0.6;
const KITE_KEEP_MAX = 450;
/** Every enemy within this distance pushes the kite, by 1 / distance squared: the hero runs to the emptiest side. */
const KITE_REACH = 1000;
const KITE_SIDE = 0.6;
const KITE_CROWD = 4;
const KITE_CROWD_RADIUS = 220;
/** Near the edge of the castle's defence circle the kite loses its outward part within this margin. */
const KITE_EDGE = 250;
/** A melee hero walks up to this distance from its target; a ranged hero up to its attack range minus this. */
const MELEE_STOP = 150;
const RANGED_MARGIN = 50;
/** A charge winding up nearer than this makes the bot step out of its line. */
const DODGE_DISTANCE = 700;
/** Below this share of its hp a ranged hero kites this much farther (melee heroes fight on, Petr, batch 2). */
const LOW_HP = 0.3;
const LOW_HP_DISTANCE = 150;
/** A target with a poison cloud is fought from its edge: the bot keeps between radius + CLOUD_INSIDE and radius + CLOUD_MARGIN. */
const CLOUD_MARGIN = 60;
const CLOUD_INSIDE = 10;
/** The bot leaves a slam circle (a strike's or a root circle too) when it stands nearer than the radius plus this to its centre. */
const SLAM_MARGIN = 60;
/**
 * The bot goes for a chest only with at least this share of the hero's and of the castle's hp. The hero's share is
 * low on purpose: the autopilot fights below half of its hp most of the run (docs/DECISIONS.md, Gear, drops and chests).
 */
const CHEST_HERO_HP = 0.3;
const CHEST_CASTLE_HP = 0.5;
/** The bot walks to a boots or berserk orb within ORB_DISTANCE, to a heal orb within HEAL_ORB_DISTANCE below HEAL_ORB_HP. */
export const ORB_DISTANCE = 900;
export const HEAL_ORB_DISTANCE = 1500;
export const HEAL_ORB_HP = 0.7;
const AXIS_DEADZONE = 30;
/** Share of a unit vector under which an axis is not pressed (between sin 22.5° and cos 67.5°). */
const AXIS_SHARE = 0.38;

/**
 * The card a representative player takes (spec 4.5): the ultimate, an upgrade or the learning of a signature
 * spell, a new shared spell, an upgrade of a shared spell, a new passive, an upgrade of a passive, an attribute.
 * The earlier card of the offer wins a tie.
 */
export function botCard(run: Run, offer: CardOffer): number {
  let best = 0;
  for (let c = 1; c < offer.cards.length; c++) {
    if (cardRank(run, offer.cards[c]) < cardRank(run, offer.cards[best])) best = c;
  }
  return best;
}

/**
 * The card of a player who does nothing (balance tests, `sim:run --idle`): an attribute card when one is
 * offered, else the card the autopilot wants least, so the kit grows as little as the offers allow.
 * The earlier card wins a tie.
 */
export function idleCard(run: Run, offer: CardOffer): number {
  let best = 0;
  for (let c = 1; c < offer.cards.length; c++) {
    if (cardRank(run, offer.cards[c]) > cardRank(run, offer.cards[best])) best = c;
  }
  return best;
}

/** The autopilot's order of spec 4.5: 1 the ultimate ... 7 an attribute. */
function cardRank(run: Run, card: CardOffer["cards"][number]): number {
  if (card.kind === "attribute") return 7;
  const [sharedFirst, sharedEnd] = sharedSlotRange(run);
  const shared = card.slot >= sharedFirst && card.slot < sharedEnd;
  if (card.kind === "learn") return shared ? 3 : 5;
  if (card.slot === ULTIMATE_SLOT) return 1;
  if (card.slot < ULTIMATE_SLOT) return 2;
  return shared ? 4 : 6;
}

/** Rarity rank (common 0 .. mythic 4) of the item a chest card offers (rolled or named). */
function rarityRank(run: Run, card: ChestCard): number {
  return card.rolled ? card.rolled.rarity : RARITIES.indexOf(run.data.items[card.item]!.rarity);
}

/** Whether `card` is a Choice whose offered item has a higher rarity than the worn item. */
function isUpgrade(run: Run, card: ChestCard): boolean {
  return card.action === ChestAction.Choice && rarityRank(run, card) > wornRarity(run.data, run.gear, card.slot);
}

/**
 * The chest card a player who wants loot would take: a Choice with a higher rarity than the worn item (the highest
 * rarity first), else a new item with the highest rarity, else the offered slot with the lowest level (permanent +
 * temporary) among Level cards and Choices without a higher rarity. The first card wins a tie.
 */
export function botChestChoice(run: Run): number {
  const offer = run.chestOffer;
  if (!offer) return 0;
  for (const upgrade of [true, false]) {
    let best = -1;
    let bestRank = -1;
    for (let i = 0; i < offer.cards.length; i++) {
      const card = offer.cards[i]!;
      if (upgrade ? !isUpgrade(run, card) : card.action !== ChestAction.New) continue;
      const rank = rarityRank(run, card);
      if (rank > bestRank) {
        bestRank = rank;
        best = i;
      }
    }
    if (best >= 0) return best;
  }
  let best = 0;
  let bestLevel = Infinity;
  for (let i = 0; i < offer.cards.length; i++) {
    const slot = offer.cards[i]!.slot;
    const level = run.gear.base[slot]! + run.gear.temp[slot]!;
    if (level < bestLevel) {
      bestLevel = level;
      best = i;
    }
  }
  return best;
}

/** The autopilot keeps the worn item of a Choice unless the rolled item has a higher rarity. */
export function botChestKeep(run: Run, card: ChestCard): boolean {
  return card.action === ChestAction.Choice && !isUpgrade(run, card);
}

/** The fixed autopilot rules. Writes the input into `out` and returns it; allocates nothing. */
export function botInput(run: Run, out: TickInput): TickInput {
  out.moveX = 0;
  out.moveY = 0;
  out.card = -1;
  out.actions = 0;
  if (run.state === "levelUp") {
    out.card = run.offer ? botCard(run, run.offer) : 0;
    return out;
  }
  if (run.state === "chest") {
    out.card = botChestChoice(run);
    const card = run.chestOffer?.cards[out.card];
    if (card && botChestKeep(run, card)) out.actions = InputAction.KeepWorn;
    return out;
  }
  // co-op (step 5): an open offer or chest does not pause the run; the autopilot picks and goes on moving
  if (run.offer) out.card = botCard(run, run.offer);
  else if (run.chestOffer) {
    out.card = botChestChoice(run);
    const card = run.chestOffer.cards[out.card];
    if (card && botChestKeep(run, card)) out.actions = InputAction.KeepWorn;
  }
  const { hero, castle, enemies } = run;

  // One pass: the threat nearest to the castle, the enemy nearest to the hero, the nearest charge winding up
  // and a slam circle the hero stands in (or within SLAM_MARGIN of).
  let threat = -1;
  let threatSq = DEFEND_RADIUS * DEFEND_RADIUS;
  let near = -1;
  let nearSq = Infinity;
  let charger = -1;
  let chargerSq = DODGE_DISTANCE * DODGE_DISTANCE;
  let slammer = -1;
  // a bloodcaller or a gravebinder near the hero goes first (spec 2026-11-20, 4.10)
  let priority = -1;
  let prioritySq = CHASE_DISTANCE * CHASE_DISTANCE;
  const defs = run.data.enemies;
  for (let i = 0; i < enemies.capacity; i++) {
    if (enemies.alive[i] === 0) continue;
    const cx = enemies.x[i] - castle.x;
    const cy = enemies.y[i] - castle.y;
    const castleSq = cx * cx + cy * cy;
    if (castleSq < threatSq) {
      threatSq = castleSq;
      threat = i;
    }
    const hx = enemies.x[i] - hero.x;
    const hy = enemies.y[i] - hero.y;
    const heroSq = hx * hx + hy * hy;
    if (heroSq < nearSq) {
      nearSq = heroSq;
      near = i;
    }
    const kind = defs[enemies.type[i]];
    if ((kind.bloodlust !== undefined || kind.raise !== undefined) && heroSq <= prioritySq) {
      prioritySq = heroSq;
      priority = i;
    }
    if (enemies.chargeState[i] === Charge.Windup && heroSq < chargerSq) {
      chargerSq = heroSq;
      charger = i;
    }
    if (slammer < 0 && enemies.slamState[i] !== Slam.None) {
      const reach = windupRadius(run, i) + SLAM_MARGIN;
      const sx = hero.x - enemies.slamX[i];
      const sy = hero.y - enemies.slamY[i];
      if (sx * sx + sy * sy < reach * reach) slammer = i;
    }
  }

  // a storm bolt waiting over the hero is dodged like a slam (spec 2026-11-21 difficulties 4.7)
  let boltX = 0;
  let boltY = 0;
  let bolt = false;
  const storm = stormOf(run.data.worlds[run.world - 1]!);
  if (slammer < 0 && storm !== null) {
    const { hazard } = run;
    const reach = storm.radius + SLAM_MARGIN;
    for (let i = 0; i < hazard.ticks.length && !bolt; i++) {
      if (hazard.ticks[i] === 0) continue;
      const sx = hero.x - hazard.x[i]!;
      const sy = hero.y - hazard.y[i]!;
      if (sx * sx + sy * sy >= reach * reach) continue;
      bolt = true;
      boltX = hazard.x[i]!;
      boltY = hazard.y[i]!;
    }
  }

  // a pool of fire under the hero: walk out of it, away from its centre (no dash)
  if (slammer < 0 && !bolt) {
    const pool = poolAt(run, hero.x, hero.y, hero.stats.collision);
    if (pool >= 0) {
      const sx = hero.x - run.hazard.poolX[pool]!;
      const sy = hero.y - run.hazard.poolY[pool]!;
      const d = Math.sqrt(sx * sx + sy * sy);
      out.moveX = axis(d > 1e-6 ? sx / d : 1);
      out.moveY = axis(d > 1e-6 ? sy / d : 0);
      return out;
    }
  }

  if (slammer >= 0 || bolt) {
    // Straight out of the circle, away from its centre; the dash helps when it is ready.
    const sx = hero.x - (bolt ? boltX : enemies.slamX[slammer]);
    const sy = hero.y - (bolt ? boltY : enemies.slamY[slammer]);
    const d = Math.sqrt(sx * sx + sy * sy);
    out.moveX = axis(d > 1e-6 ? sx / d : 1);
    out.moveY = axis(d > 1e-6 ? sy / d : 0);
    if (hero.dashCooldown === 0 && hero.dashTicks === 0) out.actions |= InputAction.Dash;
    return out;
  }

  if (charger >= 0) {
    // Step out of the line of the charge: perpendicular to the direction from the charger to the hero.
    const d = Math.sqrt(chargerSq);
    const ux = d > 1e-6 ? (hero.x - enemies.x[charger]) / d : 1;
    const uy = d > 1e-6 ? (hero.y - enemies.y[charger]) / d : 0;
    out.moveX = axis(-uy);
    out.moveY = axis(ux);
    if (hero.dashCooldown === 0 && hero.dashTicks === 0) out.actions |= InputAction.Dash;
    return out;
  }

  // co-op (step 6): walk to the nearest fallen teammate and stand by him until he is up again
  if (run.players.length > 1) {
    let fx = 0;
    let fy = 0;
    let fallenSq = Infinity;
    for (let q = 0; q < run.players.length; q++) {
      if (q === run.current) continue;
      const mate = run.players[q]!.hero;
      if (mate.hp > 0) continue;
      const tx = mate.x - hero.x;
      const ty = mate.y - hero.y;
      const sq = tx * tx + ty * ty;
      if (sq < fallenSq) {
        fallenSq = sq;
        fx = mate.x;
        fy = mate.y;
      }
    }
    if (fallenSq < Infinity) {
      const stand = run.data.rules.coop.revive.radius * REVIVE_STAND_SHARE;
      if (fallenSq <= stand * stand) return out;
      return walkTo(run, out, fx, fy);
    }
  }

  if (run.finalBossSlot < 0) {
    // The nearest orb worth the walk (spec 2026-11-19 sustain, 4.5): boots and berserk near, heal when hurt.
    const { orbs } = run;
    const hurt = hero.hp < hero.stats.maxHp * HEAL_ORB_HP;
    let ox = 0;
    let oy = 0;
    let orbSq = Infinity;
    for (let i = 0; i < orbs.alive.length; i++) {
      if (orbs.alive[i] === 0) continue;
      const heal = orbs.kind[i] === OrbKind.Heal;
      if (heal && !hurt) continue;
      const reach = heal ? HEAL_ORB_DISTANCE : ORB_DISTANCE;
      const tx = orbs.x[i]! - hero.x;
      const ty = orbs.y[i]! - hero.y;
      const sq = tx * tx + ty * ty;
      if (sq <= reach * reach && sq < orbSq) {
        orbSq = sq;
        ox = tx;
        oy = ty;
      }
    }
    if (orbSq < Infinity) return walkTo(run, out, hero.x + ox, hero.y + oy);
  }

  if (
    run.finalBossSlot < 0 && run.gold >= chestPrice(run)
    && hero.hp >= hero.stats.maxHp * CHEST_HERO_HP && castle.hp >= castle.maxHp * CHEST_CASTLE_HP
  ) {
    // Gold for a chest, a healthy hero and a safe castle: walk to the nearest chest (it may lie beyond the leash).
    const { chests } = run;
    let cx = 0;
    let cy = 0;
    let chestSq = Infinity;
    for (let i = 0; i < chests.x.length; i++) {
      const tx = chests.x[i]! - hero.x;
      const ty = chests.y[i]! - hero.y;
      const sq = tx * tx + ty * ty;
      if (sq < chestSq) {
        chestSq = sq;
        cx = tx;
        cy = ty;
      }
    }
    return walkTo(run, out, hero.x + cx, hero.y + cy);
  }

  const def = run.data.heroes[run.heroIndex];
  const melee = def.baseAttack.kind === "melee";
  let dx = 0;
  let dy = 0;
  let routed = false;
  const postX = castle.x - hero.x;
  const postY = castle.y + HOME_OFFSET - hero.y;
  if (postX * postX + postY * postY > LEASH_DISTANCE * LEASH_DISTANCE) {
    // Too far from the castle (a long retreat): walk back, whatever the enemies do.
    return walkTo(run, out, castle.x, castle.y + HOME_OFFSET);
  }
  // Outside the castle's defence circle the castle's attackers leave the hero: step back inside it first (a ranged
  // hero in reach of a target beyond the circle would otherwise stand and shoot from out there).
  const ox = hero.x - castle.x;
  const oy = hero.y - castle.y;
  const edge = run.data.rules.enemies.heroDefendRange - DEFEND_EDGE_MARGIN;
  const outside = Math.sqrt(ox * ox + oy * oy);
  if (outside > edge + HOME_TOLERANCE) {
    return walkTo(run, out, castle.x + (ox / outside) * edge, castle.y + (oy / outside) * edge);
  }
  const nearDist = Math.sqrt(nearSq);
  const keep = melee ? 0
    : Math.min(KITE_KEEP_MAX, def.baseAttack.range * KITE_KEEP_SHARE) + (hero.hp < hero.stats.maxHp * LOW_HP ? LOW_HP_DISTANCE : 0);
  if (near >= 0 && nearDist < keep) {
    kite(run, out, keep, ox, oy, outside, edge);
    return out;
  } else {
    // In the finale the final boss is the target: the run is won when it falls.
    const target = run.finalBossSlot >= 0 ? run.finalBossSlot
      : priority >= 0 ? priority
      : threat >= 0 ? threat : near >= 0 && nearDist <= CHASE_DISTANCE ? near : -1;
    if (target >= 0) {
      const tx = enemies.x[target] - hero.x;
      const ty = enemies.y[target] - hero.y;
      const d = Math.sqrt(tx * tx + ty * ty);
      let stop = melee ? MELEE_STOP : def.baseAttack.range - RANGED_MARGIN;
      const cloud = defs[enemies.type[target]].cloud;
      if (cloud !== undefined && stop < cloud.radius + CLOUD_MARGIN) {
        // fight it from the edge of its cloud: spells reach it, the cloud does not reach the hero
        stop = cloud.radius + CLOUD_MARGIN;
        if (d < cloud.radius + CLOUD_INSIDE) {
          dx = d > 1e-6 ? -tx : 1;
          dy = d > 1e-6 ? -ty : 0;
        }
      }
      if (d > stop) {
        // Stay inside the castle's defence circle (rules.enemies.heroDefendRange): out of it the castle's attackers
        // turn back to the castle, so the bot walks only to the circle's edge towards a target beyond it.
        let gx = enemies.x[target];
        let gy = enemies.y[target];
        const ex = gx - castle.x;
        const ey = gy - castle.y;
        const edge = run.data.rules.enemies.heroDefendRange - DEFEND_EDGE_MARGIN;
        const far = Math.sqrt(ex * ex + ey * ey);
        if (far > edge) {
          gx = castle.x + (ex / far) * edge;
          gy = castle.y + (ey / far) * edge;
        }
        const gdx = gx - hero.x;
        const gdy = gy - hero.y;
        if (gdx * gdx + gdy * gdy > HOME_TOLERANCE * HOME_TOLERANCE || far <= edge) {
          routeTo(run, gx, gy);
          dx = routeX;
          dy = routeY;
          routed = routeFlow;
        }
      }
    } else {
      const homeX = castle.x - hero.x;
      const homeY = castle.y + HOME_OFFSET - hero.y;
      if (Math.sqrt(homeX * homeX + homeY * homeY) > HOME_TOLERANCE) {
        routeTo(run, castle.x, castle.y + HOME_OFFSET);
        dx = routeX;
        dy = routeY;
        routed = routeFlow;
      }
    }
  }
  if (routed) {
    out.moveX = axis(dx);
    out.moveY = axis(dy);
    return out;
  }
  out.moveX = Math.abs(dx) > AXIS_DEADZONE ? Math.sign(dx) : 0;
  out.moveY = Math.abs(dy) > AXIS_DEADZONE ? Math.sign(dy) : 0;
  return out;
}

/**
 * The kite of a ranged hero: away from the weight of the enemies within KITE_REACH (1 / distance squared), plus a
 * sideways part towards the castle; near the edge of the defence circle the outward part goes. `ox`, `oy` is the
 * hero's offset from the castle, `outside` its length, `edge` the circle the bot keeps inside. Does not allocate.
 */
function kite(run: Run, out: TickInput, keep: number, ox: number, oy: number, outside: number, edge: number): void {
  const { hero, enemies } = run;
  const reach = KITE_REACH;
  let px = 0;
  let py = 0;
  let crowd = 0;
  for (let i = 0; i < enemies.capacity; i++) {
    if (enemies.alive[i] === 0) continue;
    const ex = hero.x - enemies.x[i];
    const ey = hero.y - enemies.y[i];
    const sq = ex * ex + ey * ey;
    if (sq >= reach * reach) continue;
    const d = Math.sqrt(sq);
    if (d < KITE_CROWD_RADIUS) crowd++;
    if (d < 1e-6) continue;
    const w = 1 / (sq * d);
    px += ex * w;
    py += ey * w;
  }
  let len = Math.sqrt(px * px + py * py);
  if (len < 1e-9) {
    px = 1;
    py = 0;
    len = 1;
  }
  px /= len;
  py /= len;
  // sideways: of the two perpendiculars the one that points more towards the castle
  let sx = -py;
  let sy = px;
  if (sx * ox + sy * oy > 0) {
    sx = -sx;
    sy = -sy;
  }
  let mx = px + sx * KITE_SIDE;
  let my = py + sy * KITE_SIDE;
  if (outside > edge - KITE_EDGE && outside > 1e-6) {
    const rx = ox / outside;
    const ry = oy / outside;
    const radial = mx * rx + my * ry;
    if (radial > 0) {
      mx -= rx * radial;
      my -= ry * radial;
    }
  }
  const m = Math.sqrt(mx * mx + my * my);
  out.moveX = axis(m > 1e-6 ? mx / m : px);
  out.moveY = axis(m > 1e-6 ? my / m : py);
  if (crowd >= KITE_CROWD && hero.dashCooldown === 0 && hero.dashTicks === 0) out.actions |= InputAction.Dash;
}

/** Result of routeTo: the walking direction (a unit vector when routeFlow, else the straight offset to the target). */
export let routeX = 0;
export let routeY = 0;
export let routeFlow = false;
/** The autopilot's flow field is recomputed at most every BOT_FLOW_EVERY steps, when its target cell changed. */
const BOT_FLOW_EVERY = 8;

/**
 * The way to (tx, ty) (spec 2026-11-21 difficulties 4.6): straight, or along the map's forBot flow field when the
 * straight line touches the wall or an island (the hero would stick to it).
 */
export function routeTo(run: Run, tx: number, ty: number): void {
  const { hero, map } = run;
  routeX = tx - hero.x;
  routeY = ty - hero.y;
  routeFlow = false;
  const r = hero.stats.collision;
  if (!crossesFeature(map, hero.x, hero.y, tx, ty, r) && !crossesIsland(map, hero.x, hero.y, tx, ty, r)) return;
  const field = map.forBot;
  if (cellOf(tx, ty) !== field.targetCell && run.tick - field.tick >= BOT_FLOW_EVERY) {
    computeFlow(map, field, tx, ty);
    field.tick = run.tick;
  }
  flowDir(field, hero.x, hero.y);
  if (flowX === 0 && flowY === 0) return;
  routeX = flowX;
  routeY = flowY;
  routeFlow = true;
}

/** Walks towards (tx, ty) along routeTo. */
function walkTo(run: Run, out: TickInput, tx: number, ty: number): TickInput {
  routeTo(run, tx, ty);
  if (routeFlow) {
    out.moveX = axis(routeX);
    out.moveY = axis(routeY);
  } else {
    out.moveX = Math.abs(routeX) > AXIS_DEADZONE ? Math.sign(routeX) : 0;
    out.moveY = Math.abs(routeY) > AXIS_DEADZONE ? Math.sign(routeY) : 0;
  }
  return out;
}

/** -1, 0 or 1 for a component of a unit vector. */
function axis(share: number): number {
  return share > AXIS_SHARE ? 1 : share < -AXIS_SHARE ? -1 : 0;
}
