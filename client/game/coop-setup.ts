// The co-op lobby's link logic (multiplayer migration step 7; up to 4 players since 2026-11-24): opening or joining a
// room, telling each other the heroes and gear, and starting the same run in every window. The host is player 0, the
// guests 1-3 in join order (coop-roster.ts); guests link only to the host.
import type { DifficultyId, GameData } from "../../data/schema";
import type { LoadoutEntry, PlayerOptions } from "../../sim";
import { joinRoom, openRoom, type PeerLink, type Room } from "../net/peer-link";
import { fromNet, toNet } from "../net/net-gear";
import { MAX_PLAYERS, type NetGear, type NetMessage, PROTOCOL_VERSION } from "../net/protocol";
import { isRoomCode, newRoomCode } from "../net/room-code";
import type { SignalServer } from "../net/signal";
import type { StartMessage } from "../net/coop-net";
import type { CoopLobby } from "../ui/coop-lobby";
import { type Lang, t } from "../ui/i18n";
import { restartGroup } from "./coop-restart";
import { Roster } from "./coop-roster";
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


/** Whether a link with `?join=` should open the lobby at once. */
export function joinCodeOf(search: string): string | null {
  const code = new URLSearchParams(search).get("join");
  return code === null ? null : code.trim().toLowerCase();
}

/** The group of the co-op run on screen, so it can start again (Petr's batch 3). */
interface LastRun {
  links: ReadonlyMap<number, PeerLink>;
  heroes: readonly string[];
  gear: readonly NetGear[][];
  world: number;
  difficulty: DifficultyId;
  local: number;
  onStop?: () => void;
}

export class CoopSetup {
  private last: LastRun | null = null;
  /** Host: the open room and who is in it. */
  private room: Room | null = null;
  private roster = new Roster();
  private code = "";
  /** Guest: the link to the host. */
  private peer: PeerLink | null = null;
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

  /** Closes a room or link that has not started a run (Back, or a failure). */
  drop(): void {
    this.attempt++;
    if (!this.deps.session.coop) {
      this.peer?.close();
      for (const link of this.roster.links().values()) link.close();
      this.room?.close();
    }
    this.room = null;
    this.roster = new Roster();
    this.peer = null;
    this.role = null;
  }

  /** The local player picked another hero in the lobby: tell the room. */
  heroChanged(): void {
    const { peer, deps } = this;
    if (deps.session.coop) return;
    const own = deps.heroId();
    if (this.role === "guest" && peer) peer.send({ t: "join", v: PROTOCOL_VERSION, hero: own, g: toNet(deps.loadout(own)) });
    else if (this.role === "host") this.roomChanged();
  }

  /** The link a guest opens: this page with `?join=<code>` (and the test signalling server, if any). */
  private linkFor(code: string): string {
    const url = new URL(location.href);
    url.searchParams.delete("join");
    for (const key of ["debug", "phase", "seed", "hero", "mate"]) url.searchParams.delete(key);
    url.searchParams.set("join", code);
    return url.href;
  }

  async host(): Promise<void> {
    const ticket = ++this.attempt;
    const { lobby, signal } = this.deps;
    lobby.set({ kind: "opening" });
    for (let attempt = 1; attempt <= HOST_TRIES; attempt++) {
      const code = newRoomCode(Math.random);
      try {
        const room = await openRoom(code, signal, (link) => this.guestArrived(ticket, link));
        if (ticket !== this.attempt) {
          room.close();
          return;
        }
        this.room = room;
        this.code = code;
        this.role = "host";
        this.roomChanged();
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

  /** Host: a guest's data channel opened; he is in the room once he sends `join`. */
  private guestArrived(ticket: number, link: PeerLink): void {
    if (ticket !== this.attempt || this.deps.session.coop) {
      link.close();
      return;
    }
    link.onMessage((m) => this.hostMessage(link, m));
    link.onClose(() => {
      if (this.deps.session.coop || this.roster.numberOf(link) < 0) return;
      this.roster.remove(link);
      this.roomChanged();
    });
  }

  private hostMessage(link: PeerLink, m: NetMessage): void {
    if (m.t !== "join" || this.deps.session.coop) return;
    const own = this.deps.heroId();
    if (m.v !== PROTOCOL_VERSION || !this.knownHero(m.hero)) {
      // the guest reads the version and shows the "reload both pages" line
      link.send({ t: "room", v: PROTOCOL_VERSION, you: -1, heroes: [own] });
      link.close();
      return;
    }
    if (this.roster.numberOf(link) >= 0) this.roster.setHero(link, m.hero, m.g);
    else if (this.roster.add(link, m.hero, m.g) === null) {
      link.send({ t: "room", v: PROTOCOL_VERSION, you: -1, heroes: this.roster.heroes(own) });
      link.close();
      return;
    }
    this.roomChanged();
  }

  /** Host: tells every guest who is in the room, and shows it in the own lobby. */
  private roomChanged(): void {
    const heroes = this.roster.heroes(this.deps.heroId());
    for (const [you, link] of this.roster.links()) link.send({ t: "room", v: PROTOCOL_VERSION, you, heroes });
    this.deps.lobby.set({
      kind: "room", role: "host", code: this.code, link: this.linkFor(this.code), players: heroes.map((h) => this.heroName(h)), you: 0,
    });
  }

  /** Host, once a teammate is in: opens the course choice. */
  chooseCourse(): void {
    if (this.role === "host" && this.roster.size > 0) this.deps.chooseCourse();
  }

  /** Host: the course is chosen; everyone starts the run (the host steps once every guest is ready). */
  async startCourse(world: number, difficulty: DifficultyId): Promise<void> {
    const { room, deps } = this;
    if (!room || this.roster.size === 0) return;
    const ticket = this.attempt;
    room.lock();
    deps.lobby.set({ kind: "loading" });
    // a guest who leaves while the models load renumbers the rest: load again until the room holds still
    let heroes: string[] = [];
    do {
      heroes = this.roster.heroes(deps.heroId());
      try {
        await deps.loadModels(heroes, 0, world);
      } catch (error) {
        deps.showError(error);
        return;
      }
      if (ticket !== this.attempt) return;
    } while (heroes.join() !== this.roster.heroes(deps.heroId()).join());
    if (this.roster.size === 0) {
      this.fail(t(deps.lang(), "coop.allLeft"));
      return;
    }
    const seed = Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
    const gear = this.roster.gear(toNet(deps.loadout(deps.heroId())));
    const links = this.roster.links();
    for (const [you, link] of links) link.send({ t: "start", v: PROTOCOL_VERSION, seed, world, d: difficulty, you, heroes, g: gear });
    const closeRoom = room;
    this.begin(links, seed, world, difficulty, heroes, gear, 0, () => closeRoom.close());
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
    if (m.t === "room") {
      if (m.v !== PROTOCOL_VERSION) this.fail(t(lang, "coop.version"));
      else if (m.you < 0) this.fail(t(lang, "coop.full"));
      else deps.lobby.set({ kind: "room", role: "guest", players: m.heroes.map((h) => this.heroName(h)), you: m.you });
      return;
    }
    if (m.t !== "start") return;
    if (!this.validStart(m)) {
      this.fail(t(lang, "coop.version"));
      return;
    }
    const ticket = this.attempt;
    deps.lobby.set({ kind: "loading" });
    try {
      await deps.loadModels(m.heroes, m.you, m.world);
    } catch (error) {
      deps.showError(error);
      return;
    }
    if (ticket !== this.attempt || this.peer !== peer) return;
    const net = this.begin(new Map([[0, peer]]), m.seed, m.world, m.d, m.heroes, m.g, m.you);
    peer.send({ t: "ready" });
    net.start();
  }

  private validStart(m: StartMessage): boolean {
    return m.v === PROTOCOL_VERSION && m.heroes.length >= 2 && m.heroes.length <= MAX_PLAYERS && m.you < m.heroes.length &&
      m.heroes.every((h) => this.knownHero(h)) && m.world <= this.deps.data.worlds.length;
  }

  /** "host" when this window can start the group's next run, "guest" when it waits for the host, else null. */
  restartRole(): "host" | "guest" | null {
    const { coop: net, run } = this.deps.session;
    const last = this.last;
    // only a run that ended: its windows step no more, so no input or hash of it is still on the way
    if (!net || !last || !run || (run.state !== "won" && run.state !== "lost")) return null;
    const gone = net.stats.gone;
    if (last.local === 0) return [...last.links.keys()].some((p) => !gone.includes(p)) ? "host" : null;
    return gone.includes(0) ? null : "guest";
  }

  /** Host, after a run ended: the same group (without the guests who left) plays the same course again. */
  async restart(): Promise<boolean> {
    const { deps } = this;
    const last = this.last;
    const old = deps.session.coop;
    if (!last || !old || this.restartRole() !== "host") return false;
    const hostHero = last.heroes[0] ?? deps.heroId();
    let group = restartGroup(last.heroes, last.gear, last.links, old.stats.gone, toNet(deps.loadout(hostHero)));
    if (!group) return false;
    try {
      await deps.loadModels(group.heroes, 0, last.world);
    } catch (error) {
      deps.showError(error);
      return false;
    }
    // a guest may have left while the models loaded
    const net = deps.session.coop;
    if (this.last !== last || !net) return false;
    group = restartGroup(last.heroes, last.gear, last.links, net.stats.gone, group.gear[0]!);
    if (!group) return false;
    net.detach();
    const seed = Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
    const { heroes, gear, links } = group;
    for (const [you, link] of links) {
      link.send({ t: "start", v: PROTOCOL_VERSION, seed, world: last.world, d: last.difficulty, you, heroes, g: gear });
    }
    this.begin(links, seed, last.world, last.difficulty, heroes, gear, 0, last.onStop);
    return true;
  }

  /** Guest: the host started the group's next run over the same link. */
  private async guestRestart(m: StartMessage): Promise<void> {
    const { deps } = this;
    const last = this.last;
    const peer = last?.links.get(0);
    if (!last || !peer || last.local === 0) return;
    if (!this.validStart(m)) {
      deps.onNote(t(deps.lang(), "coop.version"));
      return;
    }
    // the old loop sends nothing more from here; the link waits for the new one
    deps.session.coop?.detach();
    try {
      await deps.loadModels(m.heroes, m.you, m.world);
    } catch (error) {
      deps.showError(error);
      return;
    }
    if (this.last !== last || !deps.session.coop) return;
    const net = this.begin(new Map([[0, peer]]), m.seed, m.world, m.d, m.heroes, m.g, m.you);
    peer.send({ t: "ready" });
    net.start();
  }

  private begin(
    links: ReadonlyMap<number, PeerLink>, seed: number, world: number, difficulty: DifficultyId,
    heroes: readonly string[], gear: readonly NetGear[][], local: number, onStop?: () => void,
  ) {
    const { session } = this.deps;
    session.world = world;
    session.difficulty = difficulty;
    const players: PlayerOptions[] = heroes.map((hero, p) => ({ hero, loadout: fromNet(this.deps.data, gear[p] ?? []) }));
    this.deps.onNote("");
    const net = session.startCoop(seed, players, local, {
      links,
      onStop,
      onLeft: (p) => {
        const lang = this.deps.lang();
        this.deps.onNote(p === 0 ? t(lang, "coop.hostLeft") : t(lang, "coop.left", { name: this.heroName(heroes[p] ?? "") }));
      },
      onDesync: (step) => this.deps.onNote(t(this.deps.lang(), "coop.desync", { n: step })),
      onRestart: (m) => void this.guestRestart(m),
    });
    this.last = { links, heroes, gear, world, difficulty, local, onStop };
    this.room = null;
    this.roster = new Roster();
    this.peer = null;
    this.role = null;
    this.deps.onRunStarted();
    return net;
  }
}
