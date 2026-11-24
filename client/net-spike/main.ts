// Net spike page (spec 2026-11-20 multiplayer spike, 5.4): two browsers run one game with two heroes in lockstep
// over PeerJS; each steers his own hero (the host the first, the guest the second). Steps run from a worker
// heartbeat and catch up to wall-clock time (client/net/ticker.ts, wall-clock.ts), so a hidden or covered window
// keeps pace; drawing stays on requestAnimationFrame.
import {
  botInput, CHOICE_TICKS, createRun, InputAction, stateHash, TICK_SECONDS, TICKS_PER_SECOND, type Run, type TickInput,
} from "../../sim";

/** The spike's autopilot picks a card or chest item this long after the offer opens. */
const BOT_PICK_DELAY_TICKS = 2 * TICKS_PER_SECOND;
import { loadGameData } from "../game/data";
import { Keyboard } from "../game/keyboard";
import { HASH_EVERY, Lockstep } from "../net/lockstep";
import { joinRoom, openRoom, type PeerLink, type Room } from "../net/peer-link";
import { startTicker } from "../net/ticker";
import { WallClock } from "../net/wall-clock";
import { inputMessage, PROTOCOL_VERSION, toInput, type NetMessage } from "../net/protocol";
import { isRoomCode, newRoomCode } from "../net/room-code";
import { parseSignal } from "../net/signal";
import { drawTopView } from "./top-view";

interface NetState {
  role: "host" | "guest" | null;
  connected: boolean;
  tick: number;
  rttMedian: number;
  rttP95: number;
  stalls: number;
  stallsPerMinute: number;
  lastMatchedHash: number;
  desyncAt: number | null;
  rejected: number;
}

declare global {
  interface Window {
    __net?: NetState;
  }
}

const HERO = "stonehorn";
/** The guest's hero; both sides know it, the host's travels in `hello`. */
const GUEST_HERO = "sparkshot";
/** How often the worker heartbeat asks for steps (two beats a step). */
const BEAT_MS = 1000 / 60;
const RTT_SAMPLES = 60;
const HOST_TRIES = 3;

const net: NetState = {
  role: null, connected: false, tick: 0, rttMedian: 0, rttP95: 0, stalls: 0, stallsPerMinute: 0,
  lastMatchedHash: -1, desyncAt: null, rejected: 0,
};
window.__net = net;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const hostButton = $<HTMLButtonElement>("host");
const joinButton = $<HTMLButtonElement>("join");
const codeInput = $<HTMLInputElement>("code");
const linkEl = $("link");
const bannerEl = $("banner");
const panelEl = $("panel");
const ctx = $<HTMLCanvasElement>("view").getContext("2d")!;

const params = new URLSearchParams(location.search);
/** `?signal=host:port`: a local PeerServer instead of the PeerJS cloud (tests). */
const signal = parseSignal(params.get("signal"));
const data = loadGameData();
const keyboard = new Keyboard(window);
const rtts: number[] = [];
let link: PeerLink | null = null;
let stopped = false;

function banner(kind: "desync" | "closed" | "", text: string): void {
  bannerEl.className = kind;
  bannerEl.textContent = text;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

function showPanel(): void {
  panelEl.textContent = [
    `role          ${net.role ?? "-"}`,
    `connected     ${net.connected}`,
    `step          ${net.tick}`,
    `rtt median    ${net.rttMedian.toFixed(1)} ms`,
    `rtt p95       ${net.rttP95.toFixed(1)} ms`,
    `stalls        ${net.stalls} (${net.stallsPerMinute.toFixed(1)} / min)`,
    `matched hash  ${net.lastMatchedHash}`,
    `desync at     ${net.desyncAt ?? "-"}`,
    `rejected      ${net.rejected}`,
  ].join("\n");
}

function setBusy(busy: boolean): void {
  hostButton.disabled = busy;
  joinButton.disabled = busy;
  codeInput.disabled = busy;
}

function play(peer: PeerLink, local: 0 | 1, seed: number, hero: string): void {
  const run: Run = createRun(data, { seed, players: [{ hero }, { hero: GUEST_HERO }] });
  const lock = new Lockstep(2, local);
  const clock = new WallClock(TICK_SECONDS * 1000);
  const scratch: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
  const remote: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
  const picked: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
  const inputs: TickInput[] = [
    { moveX: 0, moveY: 0, card: -1, actions: 0 },
    { moveX: 0, moveY: 0, card: -1, actions: 0 },
  ];
  const other = local === 0 ? 1 : 0;
  const started = performance.now();
  let pingN = 0;

  peer.onMessage((m: NetMessage) => {
    if (m.t === "in") {
      lock.receive(other, m.k, toInput(m, remote));
      pump(); // run what the input made ready at once, not at the next beat
    }
    else if (m.t === "hash") check(lock.recordHash(other, m.k, m.h));
    else if (m.t === "ping") peer.send({ t: "pong", n: m.n, at: m.at });
    else if (m.t === "pong") {
      rtts.push(performance.now() - m.at);
      if (rtts.length > RTT_SAMPLES) rtts.shift();
      const sorted = [...rtts].sort((a, b) => a - b);
      net.rttMedian = percentile(sorted, 0.5);
      net.rttP95 = percentile(sorted, 0.95);
    } else if (m.t === "bye") {
      stopped = true;
      net.connected = false;
      banner("closed", "disconnected: the other player left");
    }
  });
  peer.onClose((reason) => {
    stopped = true;
    net.connected = false;
    if (net.desyncAt === null) banner("closed", `disconnected: ${reason}`);
  });
  const pinger = setInterval(() => {
    if (stopped) clearInterval(pinger);
    else peer.send({ t: "ping", n: pingN++, at: performance.now() });
  }, 1000);

  function check(verdict: "ok" | "pending" | "desync"): void {
    if (verdict !== "desync") return;
    stopped = true;
    banner("desync", `desync after step ${lock.desyncAt}: the two simulations differ`);
  }

  function localInput(): TickInput {
    keyboard.read(scratch);
    scratch.card = -1;
    const own = run.players[local]!;
    if (own.offer || own.chestOffer) {
      // the page has no card panel yet (step 7): the autopilot picks for the local player, who keeps walking;
      // it waits 2 s so the choice window (immune, idle, ignored) can be seen
      if (own.choosingTicks > CHOICE_TICKS - BOT_PICK_DELAY_TICKS) return scratch;
      run.current = local;
      botInput(run, picked);
      run.current = 0;
      scratch.card = picked.card;
      scratch.actions |= picked.actions & InputAction.KeepWorn;
    }
    return scratch;
  }

  /** Runs the steps due by wall-clock time as far as both players' inputs are known. */
  function pump(): void {
    if (stopped) return;
    const now = performance.now();
    const steps = clock.pending(now, lock.tick);
    for (let s = 0; s < steps && !stopped; s++) {
      if (lock.canQueue()) {
        const input = localInput();
        peer.send(inputMessage(lock.queueLocal(input), local, input));
      }
      if (run.state === "won" || run.state === "lost" || !lock.ready()) break;
      const k = lock.take(inputs);
      run.step(inputs);
      if ((k + 1) % HASH_EVERY === 0) {
        const h = stateHash(run);
        peer.send({ t: "hash", k, p: local, h });
        check(lock.recordHash(local, k, h));
      }
    }
    report(now);
  }

  const ticker = startTicker(BEAT_MS, pump);

  /** Copies the lockstep's numbers into `window.__net` (from every pump, so a window that does not draw has them too). */
  function report(now: number): void {
    net.tick = lock.tick;
    net.stalls = lock.stalls;
    net.stallsPerMinute = lock.stalls / Math.max(1 / 60, (now - started) / 60_000);
    net.lastMatchedHash = lock.lastMatchedHash;
    net.desyncAt = lock.desyncAt;
    net.rejected = peer.rejected;
  }

  function frame(now: number): void {
    if (stopped) ticker.stop();
    report(now);
    drawTopView(ctx, run, local);
    showPanel();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function connected(peer: PeerLink, role: "host" | "guest"): void {
  link = peer;
  net.role = role;
  net.connected = true;
  banner("", "");
  showPanel();
}

/** Opens room `code` for one guest and resolves with his link (the spike page plays two). */
function firstGuest(code: string): Promise<PeerLink> {
  return new Promise((resolve, reject) => {
    let room: Room | null = null;
    openRoom(code, signal, (link) => {
      room?.lock();
      resolve(link);
    }).then((r) => { room = r; }, reject);
  });
}

async function host(): Promise<void> {
  setBusy(true);
  for (let attempt = 1; attempt <= HOST_TRIES; attempt++) {
    const code = newRoomCode(Math.random);
    const url = new URL(location.href);
    url.searchParams.delete("join");
    url.searchParams.set("join", code);
    linkEl.textContent = `Room ${code}. Send this link: ${url.href}`;
    try {
      const peer = await firstGuest(code);
      connected(peer, "host");
      const seed = Math.floor(Math.random() * 0x100000000) >>> 0;
      peer.send({ t: "hello", v: PROTOCOL_VERSION, seed, hero: HERO });
      play(peer, 0, seed, HERO);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt === HOST_TRIES || !message.includes("taken")) {
        banner("closed", message);
        setBusy(false);
        return;
      }
    }
  }
}

async function join(code: string): Promise<void> {
  if (!isRoomCode(code)) {
    banner("closed", "A room code looks like dwg-abc234.");
    return;
  }
  setBusy(true);
  try {
    const peer = await joinRoom(code, signal);
    connected(peer, "guest");
    peer.onMessage((m) => {
      if (m.t !== "hello") return;
      if (m.v !== PROTOCOL_VERSION) {
        banner("closed", `The host runs protocol ${m.v}, this page ${PROTOCOL_VERSION}.`);
        peer.close();
        return;
      }
      play(peer, 1, m.seed, m.hero);
    });
  } catch (err) {
    banner("closed", err instanceof Error ? err.message : String(err));
    setBusy(false);
  }
}

hostButton.addEventListener("click", () => void host());
joinButton.addEventListener("click", () => void join(codeInput.value.trim()));
window.addEventListener("beforeunload", () => link?.close());

const joinCode = params.get("join");
if (joinCode !== null) {
  codeInput.value = joinCode;
  void join(joinCode);
}
showPanel();
