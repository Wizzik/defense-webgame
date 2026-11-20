// Net spike page (spec 2026-11-20 multiplayer spike, 5.4): two browsers run one single-hero game in lockstep over
// PeerJS. The host's inputs steer the hero; the guest's inputs travel too, to exercise the lockstep.
import {
  botInput, createRun, stateHash, TICK_SECONDS, type Run, type TickInput,
} from "../../sim";
import { loadGameData } from "../game/data";
import { Keyboard } from "../game/keyboard";
import { FixedStepLoop } from "../game/loop";
import { HASH_EVERY, Lockstep } from "../net/lockstep";
import { hostRoom, joinRoom, type PeerLink } from "../net/peer-link";
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
  const run: Run = createRun(data, { seed, hero });
  const lock = new Lockstep(2, local);
  const loop = new FixedStepLoop(TICK_SECONDS, 4);
  const scratch: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
  const remote: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
  const inputs: TickInput[] = [
    { moveX: 0, moveY: 0, card: -1, actions: 0 },
    { moveX: 0, moveY: 0, card: -1, actions: 0 },
  ];
  const other = local === 0 ? 1 : 0;
  const started = performance.now();
  let last = started;
  let pingN = 0;

  peer.onMessage((m: NetMessage) => {
    if (m.t === "in") lock.receive(other, m.k, toInput(m, remote));
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
    if (local === 0 && (run.state === "levelUp" || run.state === "chest")) return botInput(run, scratch);
    keyboard.read(scratch);
    scratch.card = -1;
    return scratch;
  }

  function frame(now: number): void {
    const steps = stopped ? 0 : loop.advance((now - last) / 1000, 1);
    last = now;
    for (let s = 0; s < steps && !stopped; s++) {
      if (lock.canQueue()) {
        const input = localInput();
        peer.send(inputMessage(lock.queueLocal(input), input));
      }
      if (run.state === "won" || run.state === "lost" || !lock.ready()) continue;
      const k = lock.take(inputs);
      run.step(inputs[0]!);
      if ((k + 1) % HASH_EVERY === 0) {
        const h = stateHash(run);
        peer.send({ t: "hash", k, h });
        check(lock.recordHash(local, k, h));
      }
    }
    net.tick = lock.tick;
    net.stalls = lock.stalls;
    net.stallsPerMinute = lock.stalls / Math.max(1 / 60, (now - started) / 60_000);
    net.lastMatchedHash = lock.lastMatchedHash;
    net.desyncAt = lock.desyncAt;
    net.rejected = peer.rejected;
    drawTopView(ctx, run);
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

async function host(): Promise<void> {
  setBusy(true);
  for (let attempt = 1; attempt <= HOST_TRIES; attempt++) {
    const code = newRoomCode(Math.random);
    const url = new URL(location.href);
    url.searchParams.delete("join");
    url.searchParams.set("join", code);
    linkEl.textContent = `Room ${code}. Send this link: ${url.href}`;
    try {
      const peer = await hostRoom(code, signal);
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
