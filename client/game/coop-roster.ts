// Who is in the host's co-op room (co-op for 3-4 players, 2026-11-24): the guests in join order with their heroes and
// permanent gear. Player numbers are the position + 1 (the host is 0), packed again when a guest leaves the lobby.
import { MAX_PLAYERS, type NetGear } from "../net/protocol";
import type { PeerLink } from "../net/peer-link";

interface Guest {
  link: PeerLink;
  hero: string;
  gear: NetGear[];
}

export class Roster {
  private readonly guests: Guest[] = [];

  get size(): number {
    return this.guests.length;
  }

  /** Adds a guest; his player number, or null when the room is full. */
  add(link: PeerLink, hero: string, gear: NetGear[]): number | null {
    if (this.guests.length >= MAX_PLAYERS - 1) return null;
    this.guests.push({ link, hero, gear });
    return this.guests.length;
  }

  setHero(link: PeerLink, hero: string, gear: NetGear[]): void {
    const guest = this.guests.find((g) => g.link === link);
    if (guest) {
      guest.hero = hero;
      guest.gear = gear;
    }
  }

  remove(link: PeerLink): void {
    const i = this.guests.findIndex((g) => g.link === link);
    if (i >= 0) this.guests.splice(i, 1);
  }

  /** The guest's player number, or -1 when he is not in the room. */
  numberOf(link: PeerLink): number {
    const i = this.guests.findIndex((g) => g.link === link);
    return i < 0 ? -1 : i + 1;
  }

  /** Every player's hero in player order, the host's first. */
  heroes(host: string): string[] {
    return [host, ...this.guests.map((g) => g.hero)];
  }

  /** Every player's permanent gear in player order, the host's first. */
  gear(host: NetGear[]): NetGear[][] {
    return [host, ...this.guests.map((g) => g.gear)];
  }

  /** Player number -> link of every guest. */
  links(): ReadonlyMap<number, PeerLink> {
    return new Map(this.guests.map((g, i) => [i + 1, g.link]));
  }
}
