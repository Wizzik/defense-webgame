// Who an input or hash belongs to, and where the host passes it on (co-op for 3-4 players, 2026-11-24). Guests link
// only to the host (player 0); the host relays every guest's inputs and hashes to the other guests.

/**
 * The player a received input or hash belongs to, or null to ignore it. The host trusts the link, not the field: a
 * guest cannot send for another player. A guest trusts the host's `p`, except his own number or one outside the run.
 */
export function inboundPlayer(local: number, from: number, p: number, players: number): number | null {
  if (local === 0) return from;
  return p === local || p < 0 || p >= players ? null : p;
}

/** The links a message received from `from` goes on to: on the host every other guest's, on a guest none. */
export function relayTargets(local: number, from: number, links: readonly number[]): number[] {
  return local === 0 ? links.filter((p) => p !== from) : [];
}
