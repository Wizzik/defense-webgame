import { ROOT_RING } from "./palette";
import { Group } from "three/webgpu";
import type { GameData } from "../../data/schema";
import { EventKind, type Run, SlamEvent, TICKS_PER_SECOND } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";
import { AuraRings } from "./fx/aura-rings";
import { BlastFx } from "./fx/blasts";
import { BoltFx } from "./fx/bolts";
import { type Rgb, rgb } from "./fx/instances";
import { bossLook } from "./boss-looks";
import { SlamRings } from "./fx/slam-rings";

const SHOT_COLOR = rgb(0xfff2b0);
const SHOT_LIFE = 0.12;
const HEAL_COLOR = rgb(0x7dff9a);
/**
 * The spell bolt of a caster (Petr's batch 2): a thicker beam that lives longer, in its faction's colour, with a flash
 * where it lands. Human arcane blue, orc fire, undead grave green, elf moon violet.
 */
const SPELL_COLORS: Readonly<Record<string, number>> = { human: 0x7fb2ff, orc: 0xff7a2a, undead: 0x9cff6a, elf: 0xc9a2ff };
const SPELL_LIFE = 0.22;
const SPELL_THICKNESS = 0.14;
const SPELL_FLASH = 60;
const HEAL_LIFE = 0.18;
/** Charge telegraph: a line from the lancer along its charge, for the windup. */
const CHARGE_COLOR = rgb(0xff5a5a);
const CHARGE_THICKNESS = 0.18;
const AURA_COLOR = rgb(0xb84ad8);
const AURA_OPACITY = 0.25;
/** Rings under aura carriers and bosses drawn at most. */
const AURA_POOL = 16;
/** Radius of a boss's ring (without an aura of its own) in its collision radii, and its opacity. */
const BOSS_RING = 1.6;
const BOSS_RING_OPACITY = 0.45;
/** Warning circle of a boss slam. */
const SLAM_COLOR = rgb(0xd94a4a);
/** Warning circle of roots (grove druid, grove warden): green, not the bosses' red. */
const ROOT_COLOR = rgb(ROOT_RING);
const ROOT_POOL = 8;
/** The steady poison cloud on the floor around a rotgut and a bone tyrant. */
const CLOUD_COLOR = rgb(0x8fa27a);
const CLOUD_OPACITY = 0.35;
/** Floor rings: every cloud carrier, plus the web and the roots at the hero's feet. */
const FLOOR_POOL = 64;
/** The web under a slowed hero and the roots around a rooted hero's feet (world units). */
const WEB_COLOR = rgb(0xe4e8f0);
const WEB_RADIUS = 70;
const ROOT_RING_COLOR = rgb(ROOT_RING);
const ROOT_RADIUS = 45;
const SNARE_OPACITY = 0.8;
/** A red flash over a bloodcaller that casts, a green one where a gravebinder raises (world units across). */
const LUST_FLASH = 0xd9302a;
const LUST_SIZE = 90;
const RAISE_FLASH = 0x6fe08a;
const RAISE_SIZE = 110;

/**
 * Shots of ranged enemies (the hit is instant, the beam is only an effect) and the heal beams of
 * chaplains, the line that warns of a lancer's charge, the ring under a captain's aura and the warning circle of a
 * boss slam, the green circles of roots, the poison clouds, the web and the roots at the hero's feet, and the flashes of
 * bloodlust and of a raise. A shooter that died in the same step is drawn from its last position: its slot keeps
 * the values until the next spawn, which comes only in the next step.
 */
export class EnemyFx implements RunView {
  readonly object = new Group();
  private readonly bolts = new BoltFx();
  private readonly telegraphs: BoltFx;
  private readonly auraRings = new AuraRings(AURA_POOL);
  /** Ring colour under each boss type per world: `bossAura[(world - 1) * types + type]` (null for a common type). */
  private readonly bossAura: (Rgb | null)[];
  private readonly slamRings = new SlamRings(SLAM_COLOR);
  private readonly rootRings = new SlamRings(ROOT_COLOR, ROOT_POOL);
  private readonly floorRings = new AuraRings(FLOOR_POOL);
  private readonly lustFlashes = new BlastFx(LUST_FLASH);
  private readonly raiseFlashes = new BlastFx(RAISE_FLASH);
  private readonly spellBolts = new BoltFx(SPELL_LIFE, SPELL_THICKNESS);
  /** The spell bolt colour of each caster type, `null` for the other types. */
  private readonly spellColor: (Rgb | null)[];
  /** One flash pool per faction colour (index into `spellFlashes` per type, -1 for no caster). */
  private readonly spellFlashes: BlastFx[];
  private readonly spellFlashOf: Int8Array;
  /** 1 for enemy types whose strike roots. */
  private readonly roots: Uint8Array;
  private readonly data: GameData;
  /** 1 for enemy types that shoot. */
  private readonly ranged: Uint8Array;
  private lastRun: Run | null = null;

  constructor(data: GameData) {
    this.ranged = Uint8Array.from(data.enemies, (e) => (e.attack.kind === "ranged" ? 1 : 0));
    this.roots = Uint8Array.from(data.enemies, (e) => (e.strike?.effect === "root" ? 1 : 0));
    this.data = data;
    const factions = Object.keys(SPELL_COLORS);
    this.spellFlashes = factions.map((f) => new BlastFx(SPELL_COLORS[f]!));
    this.spellFlashOf = Int8Array.from(data.enemies, (e) => (e.caster ? factions.indexOf(e.faction ?? "") : -1));
    this.spellColor = data.enemies.map((e) => {
      const hex = e.caster && e.faction !== undefined ? SPELL_COLORS[e.faction] : undefined;
      return hex === undefined ? null : rgb(hex);
    });
    this.bossAura = data.worlds.flatMap((_, w) =>
      data.enemies.map((enemy, type) => (enemy.boss ? rgb(bossLook(data, w + 1, type).aura) : null)));
    const windup = Math.max(0.1, ...data.enemies.map((e) => e.charge?.windupSeconds ?? 0));
    this.telegraphs = new BoltFx(windup, CHARGE_THICKNESS);
    this.object.add(
      this.bolts.mesh, this.telegraphs.mesh, this.auraRings.mesh, this.slamRings.outlines, this.slamRings.fills,
      this.rootRings.outlines, this.rootRings.fills, this.floorRings.mesh, this.lustFlashes.mesh, this.raiseFlashes.mesh,
      this.spellBolts.mesh, ...this.spellFlashes.map((f) => f.mesh),
    );
  }

  /** Slam circles on the floor now (warning or flashing). */
  get slamRingCount(): number {
    return this.slamRings.visible + this.rootRings.visible;
  }

  onEvents(run: Run): void {
    this.sync(run);
    const { events, enemies: e, castle } = run;
    const now = run.tick / TICKS_PER_SECOND;
    for (let i = 0; i < events.count; i++) {
      const kind = events.kind[i];
      const a = events.a[i]!;
      if (kind === EventKind.HeroHit) {
        // the event carries the hero's position
        if (a < 0 || this.ranged[e.type[a]!] !== 1) continue;
        this.shot(now, e.type[a]!, e.x[a]!, e.y[a]!, events.x[i]!, events.y[i]!);
      } else if (kind === EventKind.CastleHit) {
        // the event carries the attacker's position
        if (a < 0 || this.ranged[e.type[a]!] !== 1) continue;
        this.shot(now, e.type[a]!, events.x[i]!, events.y[i]!, castle.x, castle.y);
      } else if (kind === EventKind.EnemyHeal) {
        const healer = events.u[i]!;
        // a chaplain healing itself has no beam (zero length)
        this.beam(now, e.x[healer]!, e.y[healer]!, events.x[i]!, events.y[i]!, false);
      } else if (kind === EventKind.EnemyCharge && events.value[i] === 0) {
        const charge = this.data.enemies[e.type[a]!]!.charge;
        if (charge === undefined) continue;
        const x = events.x[i]!;
        const y = events.y[i]!;
        this.telegraphs.add(
          now, x * SCENE_SCALE, -y * SCENE_SCALE,
          (x + events.u[i]! * charge.distance) * SCENE_SCALE, -(y + events.v[i]! * charge.distance) * SCENE_SCALE,
          CHARGE_COLOR, charge.windupSeconds,
        );
      } else if (kind === EventKind.Slam) {
        const value = events.value[i];
        const rings = this.roots[e.type[a]!] === 1 ? this.rootRings : this.slamRings;
        if (value === SlamEvent.Warning) {
          rings.warn(
            a, events.x[i]! * SCENE_SCALE, -events.y[i]! * SCENE_SCALE, events.u[i]! * SCENE_SCALE,
            now, events.v[i]! / TICKS_PER_SECOND,
          );
        } else if (value === SlamEvent.Hit) rings.hit(a, now);
        else rings.cancel(a);
      } else if (kind === EventKind.Bloodlust) {
        this.lustFlashes.add(now, events.x[i]! * SCENE_SCALE, -events.y[i]! * SCENE_SCALE, LUST_SIZE * SCENE_SCALE);
      } else if (kind === EventKind.Raise) {
        this.raiseFlashes.add(now, events.x[i]! * SCENE_SCALE, -events.y[i]! * SCENE_SCALE, RAISE_SIZE * SCENE_SCALE);
      }
    }
  }

  update(run: Run, alpha: number, _dt: number): void {
    this.sync(run);
    const now = (run.tick + alpha) / TICKS_PER_SECOND;
    this.bolts.write(now);
    this.telegraphs.write(now);
    this.slamRings.write(now);
    this.rootRings.write(now);
    this.lustFlashes.write(now);
    this.raiseFlashes.write(now);
    this.spellBolts.write(now);
    for (const f of this.spellFlashes) f.write(now);
    this.updateFloor(run, alpha);
    this.auraRings.begin();
    const e = run.enemies;
    const types = this.data.enemies.length;
    const world = Math.min(Math.max(run.world, 1), this.data.worlds.length) - 1;
    for (let i = 0; i < e.capacity; i++) {
      const type = e.type[i]!;
      if (e.alive[i] === 0 || (run.hasAura[type] === 0 && run.isBoss[type] === 0)) continue;
      const def = this.data.enemies[type]!;
      const x = (e.prevX[i]! + (e.x[i]! - e.prevX[i]!) * alpha) * SCENE_SCALE;
      const z = -(e.prevY[i]! + (e.y[i]! - e.prevY[i]!) * alpha) * SCENE_SCALE;
      // a boss's ring is in its world's aura colour: its aura's reach, else a ring just outside its body
      const boss = this.bossAura[world * types + type];
      const radius = (def.aura ? def.aura.radius : def.collision * BOSS_RING) * SCENE_SCALE;
      if (boss) this.auraRings.add(x, z, radius, boss, BOSS_RING_OPACITY);
      else this.auraRings.add(x, z, radius, AURA_COLOR, AURA_OPACITY);
    }
    this.auraRings.end();
  }

  /** Poison clouds around their carriers and the hero's web and roots, rewritten every frame. */
  private updateFloor(run: Run, alpha: number): void {
    const rings = this.floorRings;
    rings.begin();
    const { enemies: e, hero } = run;
    const hx = (hero.prevX + (hero.x - hero.prevX) * alpha) * SCENE_SCALE;
    const hz = -(hero.prevY + (hero.y - hero.prevY) * alpha) * SCENE_SCALE;
    if (hero.rootTicks > 0) rings.add(hx, hz, ROOT_RADIUS * SCENE_SCALE, ROOT_RING_COLOR, SNARE_OPACITY);
    if (hero.slowTicks > 0) rings.add(hx, hz, WEB_RADIUS * SCENE_SCALE, WEB_COLOR, SNARE_OPACITY);
    for (let i = 0; i < e.capacity; i++) {
      if (e.alive[i] === 0) continue;
      const cloud = this.data.enemies[e.type[i]!]!.cloud;
      if (cloud === undefined) continue;
      const x = e.prevX[i]! + (e.x[i]! - e.prevX[i]!) * alpha;
      const y = e.prevY[i]! + (e.y[i]! - e.prevY[i]!) * alpha;
      rings.add(x * SCENE_SCALE, -y * SCENE_SCALE, cloud.radius * SCENE_SCALE, CLOUD_COLOR, CLOUD_OPACITY);
    }
    rings.end();
  }

  dispose(): void {
    this.object.removeFromParent();
    this.bolts.dispose();
    this.telegraphs.dispose();
    this.auraRings.dispose();
    this.slamRings.dispose();
    this.rootRings.dispose();
    this.floorRings.dispose();
    this.lustFlashes.dispose();
    this.raiseFlashes.dispose();
    this.spellBolts.dispose();
    for (const f of this.spellFlashes) f.dispose();
  }

  /** A ranged hit from (ax, ay) to (bx, by): a caster's spell bolt with its flash, else the plain shot. */
  private shot(now: number, type: number, ax: number, ay: number, bx: number, by: number): void {
    const color = this.spellColor[type];
    if (!color) {
      this.beam(now, ax, ay, bx, by, true);
      return;
    }
    this.spellBolts.add(now, ax * SCENE_SCALE, -ay * SCENE_SCALE, bx * SCENE_SCALE, -by * SCENE_SCALE, color, SPELL_LIFE);
    this.spellFlashes[this.spellFlashOf[type]!]!.add(now, bx * SCENE_SCALE, -by * SCENE_SCALE, SPELL_FLASH * SCENE_SCALE);
  }

  private beam(now: number, ax: number, ay: number, bx: number, by: number, shot: boolean): void {
    this.bolts.add(
      now, ax * SCENE_SCALE, -ay * SCENE_SCALE, bx * SCENE_SCALE, -by * SCENE_SCALE,
      shot ? SHOT_COLOR : HEAL_COLOR, shot ? SHOT_LIFE : HEAL_LIFE,
    );
  }

  /** A new run starts with no effects. */
  private sync(run: Run): void {
    if (run === this.lastRun) return;
    this.lastRun = run;
    this.bolts.reset();
    this.telegraphs.reset();
    this.slamRings.reset();
    this.rootRings.reset();
    this.lustFlashes.reset();
    this.raiseFlashes.reset();
    this.spellBolts.reset();
    for (const f of this.spellFlashes) f.reset();
  }
}
