import type { PlayerState, Run } from "../../sim";

/**
 * The player whose system pushed event `i` (multiplayer migration step 7): a teammate's cast is drawn and heard
 * with his abilities and from his hero, not the local player's. For one player it is always player 0.
 */
export function eventOwner(run: Run, i: number): PlayerState {
  return run.players[run.events.player[i]!] ?? run.players[0]!;
}
