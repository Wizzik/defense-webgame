import type { AbilitySlot } from "./abilities/slots";
import { BuffState } from "./buffs";
import type { CardOffer } from "./cards";
import type { ChestOffer } from "./chests";
import { DamageMeter } from "./damage-meter";
import { GearState } from "./gear";
import type { Run } from "./run";
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
  /** The damage his sources dealt in this run (a readout: not in the state hash). */
  readonly meter = new DamageMeter();
  /** Gold the player holds; it pays for chests and is gone after the run. */
  gold = 0;
  offer: CardOffer | null = null;
  /** The cards of the chest that is open; null outside the "chest" state. */
  chestOffer: ChestOffer | null = null;
  /** Price of his next chest before rounding: basePrice x priceGrowth for every chest he opened (set by the run). */
  chestPriceRaw = 0;
  /** Index of the chest that is open; -1 outside the "chest" state. */
  openChest = -1;
  /** The ultimate casts by itself; the player can switch this off. */
  ultimateAuto = true;
  /** R was pressed in this step; cleared by updateAbilities. */
  ultimateRequested = false;
  /** Steps left of the spirit shield: hero and castle take no damage while > 0. */
  shieldTicks = 0;
  /**
   * Co-op: steps left of the choice time of an open card or chest offer (sim/coop-choice.ts); while > 0 the hero is
   * immune, does not attack or cast, and enemies ignore him. Always 0 for one player (his offers pause the run).
   */
  choosingTicks = 0;
  /**
   * Co-op: steps a living teammate has stood by this fallen hero without a break (sim/revive.ts); at
   * rules.coop.revive.seconds he stands up. 0 while he lives or nobody is near.
   */
  reviveTicks = 0;
  /** Steps the hero stood without walking or dashing (sim/chill.ts); 0 after a step he walked. */
  stillTicks = 0;
  /** The blizzard froze him (base attacks slower) until he walks again (sim/chill.ts). */
  chilled = false;

  constructor(hero: HeroState, heroIndex: number, maxEnemies: number) {
    this.hero = hero;
    this.heroIndex = heroIndex;
    this.gear = new GearState(maxEnemies);
  }
}

/** The current player is in his co-op choice time (sim/coop-choice.ts): immune, not attacking or casting, ignored by enemies. */
export function isChoosing(run: Run): boolean {
  return run.players[run.current]!.choosingTicks > 0;
}
