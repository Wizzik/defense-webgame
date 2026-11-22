import type { AbilitySlot } from "./abilities/slots";
import { BuffState } from "./buffs";
import type { CardOffer } from "./cards";
import type { ChestOffer } from "./chests";
import { GearState } from "./gear";
import type { HeroState } from "./world";

/**
 * Everything that belongs to one player of a run (multiplayer migration, step 1;
 * docs/multiplayer/single-hero-inventory.md, chapter 2). The run holds them in `Run.players`;
 * `players[0]` is the single player, and the fields `run.hero`, `run.gold`, ... read and write it.
 */
export class PlayerState {
  readonly hero: HeroState;
  /** Index of the hero into `data.heroes`. */
  readonly heroIndex: number;
  /** Filled by the run once the player exists (createAbilitySlots reads the hero). */
  abilities: AbilitySlot[] = [];
  /** What the hero wears: the loadout plus what chests gave in this run. */
  readonly gear: GearState;
  /** Orb effects and the lifesteal budget (sim/buffs.ts). */
  readonly buffs = new BuffState();
  /** Gold the player holds; it pays for chests and is gone after the run. */
  gold = 0;
  offer: CardOffer | null = null;
  /** The cards of the chest that is open; null outside the "chest" state. */
  chestOffer: ChestOffer | null = null;
  /** Index of the chest that is open; -1 outside the "chest" state. */
  openChest = -1;
  /** The ultimate casts by itself; the player can switch this off. */
  ultimateAuto = true;
  /** R was pressed in this step; cleared by updateAbilities. */
  ultimateRequested = false;
  /** Steps left of the spirit shield: hero and castle take no damage while > 0. */
  shieldTicks = 0;

  constructor(hero: HeroState, heroIndex: number, maxEnemies: number) {
    this.hero = hero;
    this.heroIndex = heroIndex;
    this.gear = new GearState(maxEnemies);
  }
}
