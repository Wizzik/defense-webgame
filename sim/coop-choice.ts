import { chooseCard, openOffer } from "./cards";
import { chooseChestCard, updateChests } from "./chests";
import { TICKS_PER_SECOND } from "./constants";
import { InputAction, type TickInput } from "./input";
import type { Run } from "./run";

/**
 * How long a co-op hero may choose a card or a chest item in peace (Petr, 2026-11-21): while the choice time runs he is
 * immune, does not attack or cast, and enemies ignore him. After it the offer stays open, but he fights and can be hurt.
 */
export const CHOICE_SECONDS = 10;
export const CHOICE_TICKS = CHOICE_SECONDS * TICKS_PER_SECOND;

/**
 * Co-op only (multiplayer migration step 5), at the start of a step for the current player: the choice time counts
 * down, then a card in his input takes a card of his open offer (a chained level-up opens the next offer in the same
 * choice time) or of his open chest (KeepWorn keeps the worn item of a Choice). The run never leaves "playing".
 */
export function coopChoose(run: Run, input: Readonly<TickInput>): void {
  const player = run.players[run.current]!;
  if (player.choosingTicks > 0) player.choosingTicks--;
  if (input.card >= 0) {
    if (player.offer) chooseCard(run, input.card);
    else if (player.chestOffer) chooseChestCard(run, input.card, (input.actions & InputAction.KeepWorn) !== 0);
    run.state = "playing";
  }
  if (!player.offer && !player.chestOffer) player.choosingTicks = 0;
}

/**
 * Co-op only, at the end of a step for the current player with nothing open: his next level-up opens an offer, else
 * a chest he stands on with the gold opens; either starts a new choice time. The run stays "playing".
 */
export function coopOpen(run: Run): void {
  const player = run.players[run.current]!;
  if (player.offer || player.chestOffer) return;
  if (player.hero.hp <= 0) return;
  if (player.hero.pendingLevelUps > 0) openOffer(run);
  else updateChests(run);
  run.state = "playing";
  if (player.offer || player.chestOffer) player.choosingTicks = CHOICE_TICKS;
}
