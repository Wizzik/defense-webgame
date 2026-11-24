// The co-op lobby's link logic (multiplayer migration step 7): opening or joining a room, telling each other the
// heroes and gear, and starting the same run on both sides. The host is player 0, the guest player 1.
import type { DifficultyId, GameData } from "../../data/schema";
import type { LoadoutEntry, PlayerOptions, SlotId } from "../../sim";
import { hostRoom, joinRoom, type PeerLink } from "../net/peer-link";
import { type NetGear, type NetMessage, PROTOCOL_VERSION } from "../net/protocol";
import { isRoomCode, newRoomCode } from "../net/room-code";
import type { SignalServer } from "../net/signal";
import type { CoopLobby } from "../ui/coop-lobby";
import { type Lang, t } from "../ui/i18n";
import type { Session } from "./session";

const HOST_TRIES = 3;

export interface CoopSetupDeps {
  data: GameData;
  session: Session;
  lobby: CoopLobby;
  signal: SignalServer | null;
  lang(): Lang;
  /** The hero chosen in the menu. */
  heroId(): string;
  /** The local player's permanent items for a hero. */
  loadout(heroId: string): readonly LoadoutEntry[];
  /** Loads the heroes' models (player order) and the world's, and puts them on the hero views. */
  loadModels(heroes: readonly string[], local: number, world: number): Promise<void>;
  /** The host chooses the course: opens the world screen, which calls `startCourse`. */
  chooseCourse(): void;
  /** A co-op run is on screen: hide the lobby and the menu. */
  onRunStarted(): void;
  /** A line for the team banner: the teammate left, a desync. */
  onNote(text: string): void;
  showError(error: unknown): void;
}

function toNet(loadout: readonly LoadoutEntry[]): NetGear[] {
  return loadout.map((e) => [e.slot, e.item, e.level]);
}

function fromNet(gear: readonly NetGear[]): LoadoutEntry[] {
  return gear.map(([slot, item, level]) => ({ slot: slot as SlotId, item, level }));
}

/** Whether a link with `?join=` should open the lobby at once. */
export function joinCodeOf(search: string): string | null {
  const code = new URLSearchParams(search).get("join");
  return code === null ? null : code.trim().toLowerCase();
}

export class CoopSetup {
  private peer: PeerLink | null = null;
  /** Host: the guest's hero and gear once he joined. */
  private mate: { hero: string; gear: NetGear[] } | null = null;
  private role: "host" | "guest" | null = null;
  /** Bumped when the lobby is left, so a late answer of an old attempt is ignored. */
  private attempt = 0;

  constructor(private readonly deps: CoopSetupDeps) {}

  private knownHero(id: string): boolean {
    return this.deps.data.heroes.some((h) => h.id === id);
  }

  private heroName(id: string): string {
    return this.deps.data.heroes.find((h) => h.id === id)?.name[this.deps.lang()] ?? id;
  }

  private fail(message: string): void {
    this.drop();
    this.deps.lobby.set({ kind: "error", message });
  }

  /** Closes a link that has not started a run (Back, or a failure). */
  drop(): void {
    this.attempt++;
    if (this.peer && !this.deps.session.coop) this.peer.close();
    this.peer = null;
    this.mate = null;
    this.role = null;
  }

  /** The local player picked another hero in the lobby: tell the teammate (the guest joins again with it). */
  heroChanged(): void {
    const { peer, deps } = this;
    if (!peer || deps.session.coop) return;
    const own = deps.heroId();
    if (this.role === "guest") peer.send({ t: "join", v: PROTOCOL_VERSION, hero: own, g: toNet(deps.loadout(own)) });
    else if (this.role === "host" && this.mate) peer.send({ t: "hello", v: PROTOCOL_VERSION, seed: 0, hero: own });
  }

  /** The link the guest opens: this page with `?join=<code>` (and the test signalling server, if any). */
  private linkFor(code: string): string {
    const url = new URL(location.href);
    url.searchParams.delete("join");
    for (const key of ["debug", "phase", "seed", "hero"]) url.searchParams.delete(key);
    url.searchParams.set("join", code);
    return url.href;
  }

  async host(): Promise<void> {
    const ticket = ++this.attempt;
    const { lobby, signal } = this.deps;
    lobby.set({ kind: "opening" });
    for (let attempt = 1; attempt <= HOST_TRIES; attempt++) {
      const code = newRoomCode(Math.random);
      lobby.set({ kind: "waiting", code, link: this.linkFor(code) });
      try {
        const peer = await hostRoom(code, signal);
        if (ticket !== this.attempt) {
          peer.close();
          return;
        }
        this.peer = peer;
        this.role = "host";
        peer.onMessage((m) => this.hostMessage(peer, m));
        peer.onClose((reason) => {
          if (this.peer === peer && !this.deps.session.coop) this.fail(t(this.deps.lang(), "coop.closed", { reason }));
        });
        return;
      } catch (err) {
        if (ticket !== this.attempt) return;
        const message = err instanceof Error ? err.message : String(err);
        if (attempt === HOST_TRIES || !message.includes("taken")) {
          this.fail(message);
          return;
        }
      }
    }
  }

  private hostMessage(peer: PeerLink, m: NetMessage): void {
    if (m.t !== "join") return;
    const lang = this.deps.lang();
    if (m.v !== PROTOCOL_VERSION) {
      this.fail(t(lang, "coop.version"));
      return;
    }
    if (!this.knownHero(m.hero)) {
      this.fail(t(lang, "coop.version"));
      return;
    }
    this.mate = { hero: m.hero, gear: m.g };
    // the guest learns the host's hero for his lobby line
    peer.send({ t: "hello", v: PROTOCOL_VERSION, seed: 0, hero: this.deps.heroId() });
    this.deps.lobby.set({ kind: "ready", role: "host", mate: this.heroName(m.hero) });
  }

  /** Host, after a teammate joined: opens the course choice. */
  chooseCourse(): void {
    if (this.peer && this.mate) this.deps.chooseCourse();
  }

  /** Host: the course is chosen; both start the run (the host steps once the guest is ready). */
  async startCourse(world: number, difficulty: DifficultyId): Promise<void> {
    const { peer, mate, deps } = this;
    if (!peer || !mate) return;
    const ticket = this.attempt;
    const own = deps.heroId();
    const heroes = [own, mate.hero];
    const gear = [toNet(deps.loadout(own)), mate.gear];
    deps.lobby.set({ kind: "loading" });
    try {
      await deps.loadModels(heroes, 0, world);
    } catch (error) {
      deps.showError(error);
      return;
    }
    if (ticket !== this.attempt || this.peer !== peer) return;
    const seed = Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
    peer.send({ t: "start", v: PROTOCOL_VERSION, seed, world, d: difficulty, you: 1, heroes, g: gear });
    this.begin(peer, seed, world, difficulty, heroes, gear, 0);
  }

  async join(code: string): Promise<void> {
    const { lobby, signal } = this.deps;
    const lang = this.deps.lang();
    if (!isRoomCode(code)) {
      lobby.set({ kind: "error", message: t(lang, "coop.badCode") });
      return;
    }
    const ticket = ++this.attempt;
    lobby.set({ kind: "joining", code });
    try {
      const peer = await joinRoom(code, signal);
      if (ticket !== this.attempt) {
        peer.close();
        return;
      }
      this.peer = peer;
      this.role = "guest";
      peer.onMessage((m) => void this.guestMessage(peer, m));
      peer.onClose((reason) => {
        if (this.peer === peer && !this.deps.session.coop) this.fail(t(this.deps.lang(), "coop.closed", { reason }));
      });
      const own = this.deps.heroId();
      peer.send({ t: "join", v: PROTOCOL_VERSION, hero: own, g: toNet(this.deps.loadout(own)) });
    } catch (err) {
      if (ticket === this.attempt) this.fail(err instanceof Error ? err.message : String(err));
    }
  }

  private async guestMessage(peer: PeerLink, m: NetMessage): Promise<void> {
    const { deps } = this;
    const lang = deps.lang();
    if (m.t === "hello") {
      if (m.v !== PROTOCOL_VERSION) this.fail(t(lang, "coop.version"));
      else deps.lobby.set({ kind: "ready", role: "guest", mate: this.heroName(m.hero) });
      return;
    }
    if (m.t !== "start") return;
    if (m.v !== PROTOCOL_VERSION || m.heroes.length !== 2 || !m.heroes.every((h) => this.knownHero(h)) || m.world > deps.data.worlds.length) {
      this.fail(t(lang, "coop.version"));
      return;
    }
    const ticket = this.attempt;
    deps.lobby.set({ kind: "loading" });
    try {
      await deps.loadModels(m.heroes, 1, m.world);
    } catch (error) {
      deps.showError(error);
      return;
    }
    if (ticket !== this.attempt || this.peer !== peer) return;
    const net = this.begin(peer, m.seed, m.world, m.d, m.heroes, m.g, 1);
    peer.send({ t: "ready" });
    net.start();
  }

  private begin(
    peer: PeerLink, seed: number, world: number, difficulty: DifficultyId,
    heroes: readonly string[], gear: readonly NetGear[][], local: 0 | 1,
  ) {
    const { session } = this.deps;
    session.world = world;
    session.difficulty = difficulty;
    const players: PlayerOptions[] = heroes.map((hero, p) => ({ hero, loadout: fromNet(gear[p] ?? []) }));
    this.deps.onNote("");
    const net = session.startCoop(seed, players, local, {
      links: new Map([[local === 0 ? 1 : 0, peer]]),
      onLeft: () => this.deps.onNote(t(this.deps.lang(), "coop.left")),
      onDesync: (step) => this.deps.onNote(t(this.deps.lang(), "coop.desync", { n: step })),
    });
    this.peer = null;
    this.mate = null;
    this.role = null;
    this.deps.onRunStarted();
    return net;
  }
}
