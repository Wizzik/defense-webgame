# Multiplayer spike: report

2026-11-20, branch `multiplayer-spike`, PR #27. Spec `docs/superpowers/specs/2026-11-20-multiplayer-spike-design.md`, plan `docs/superpowers/plans/2026-11-20-multiplayer-spike.md`. The game did not change: `git diff main -- sim` touches only `sim/hash.ts` and its test.

## 1. Short answer

- **Determinism: confirmed in all three browser engines.** The matrix of 12 autopilot runs (92 547 steps, a hash every 300 steps) gives digest **`73372c52`** in Node (V8) and in Chromium; CI shows the same digest in Chromium, Firefox (SpiderMonkey) and WebKit (JavaScriptCore), and the first 600 steps of `p16` match step by step in all three. No fix was needed.
- **Lockstep works.** Two Chromium tabs over WebRTC (a local PeerServer, because this container cannot reach the PeerJS cloud) ran 60 s: 1811 steps, hashes matched up to step 1799, **0 stalls, 0 desyncs, 0 bad messages**, RTT 0.7-2 ms. In memory, two peers with random 0-5 frame delays and reordered delivery stay equal over 3000 steps; a changed `gold` on one side is caught within 30 steps.
- **Several heroes is the big part:** 38 files in `sim/` read the one hero; the inventory gives an 8-step migration that keeps the one-player game unchanged after every step (proved by the same matrix digest), **8-10 chats**.
- **Recommendation:** keep deterministic lockstep with `INPUT_DELAY = 3` (100 ms) for 2-4 players; PeerJS cloud signalling for now; decide on TURN after Petr's two-network test.

## 2. Determinism

**The hash.** The spec's pre-scan said the hash missed projectiles, allies, pickups, chests, gold and offers; it already covered them. A field-by-field audit of `Run` and every store found the real gaps, now mixed in: enemy `maxHp`, `damageScale` (the finale enrage), `spawnTick` (projectiles check their target by it), `lastHitTick`, `lastAttackTick` and facing; heart values; `ultimateRequested`; and the offer shape (none vs. a count of cards). Fields left out on purpose: `prevX/prevY` (drawing only), derived tables built in the constructor, the event buffer (output) and the spatial grid (rebuilt every step). A hash is 32 bits; one costs about **49 µs** in Node (a phase-16 run with 44 enemies; one step there costs about 115 µs), so once per 30 steps is under 2 µs a step.

**The matrix** (`client/determinism/matrix.ts`): 8 heroes from phase 1 (seed 1, duration 300 s, up to 12 000 steps) and 4 late starts with full gear (`p6` nightglaive, `p11` gravecaller, `p16` tidecaller, `p21` sparkshot; up to 6000 steps). They cover all four factions and their mechanics, every ability kind, minibosses, the finale and the legendary and mythic effects.

| case | steps | end |
|---|---|---|
| h-stonehorn | 12 000 | cap |
| h-nightglaive | 12 000 | cap |
| h-gravecaller | 12 000 | cap |
| h-serpent-shaman | 4258 | lost |
| h-mistwarden | 7459 | lost |
| h-sparkshot | 12 000 | cap |
| h-redcleaver | 2554 | lost |
| h-tidecaller | 9474 | lost |
| p6, p11, p16 | 6000 each | cap |
| p21 | 2802 | won |

Time for the whole matrix: Node 2.9 s, Chromium 2.8 s (this container); CI (GitHub runner): Chromium 2.7 s, Firefox 2.8 s, WebKit 2.3 s.

**Checks:** `e2e/determinism.spec.ts` compares every checkpoint of every case with Node, and the first 600 steps of `p16` step by step (`?case=p16&every=1&ticks=600`). Projects `sim-chromium`, `sim-firefox`, `sim-webkit`; CI run: https://github.com/Wizzik/defense-webgame/actions/runs/44823538158 (78 of 78 e2e tests passed).

## 3. Lockstep and the connection

- `client/net/protocol.ts`: JSON messages `hello`, `in`, `hash`, `ping`, `pong`, `bye`, protocol version 1; `decodeMessage` rejects anything malformed (unknown type, a missing field, a string for a number, NaN, out-of-range moves, steps over 1 000 000, a hero id over 32 characters) without throwing.
- `client/net/lockstep.ts`: two players, `INPUT_DELAY = 3` steps (100 ms), inputs in a ring of 256 steps per player (no allocation per step), duplicates and steps already run are ignored, inputs more than 256 steps ahead are rejected, hashes compared every 30 steps. A local input is queued only while the local side is at most 3 steps ahead, so a stall never piles up inputs.
- `client/net/peer-link.ts`: PeerJS 1.5.5 (MIT), `reliable: true`, JSON serialization; one guest per room, a later one is turned away; PeerJS errors turned into readable lines.
- Page `/net-spike/` (2D top view, panel with `window.__net`); `?signal=host:port` points it at a local PeerServer.

**Measured here** (two headless Chromium tabs, one machine, local PeerServer, 60 s, the host walking with WASD): host step 1811, guest 1812, last matched hash 1799, RTT median 0.7 / 1.1 ms, p95 1.2 / 2.0 ms, stalls 0, desync none, rejected 0, no console errors. This says the code works; it says nothing about real networks, which is Petr's test.

## 4. Single-hero inventory (summary)

`docs/multiplayer/single-hero-inventory.md`. 38 `sim/` files read the hero (432 of the spec's 514 `run.hero` uses are in tests). Rows: 28 S, 18 M (one of them twelve S-sized ability files), 1 L (the client loop), 1 without change. The boss drop is already rolled in the client from each player's own save, so Petr's rule "every player gets his own drop" costs almost nothing. The hard parts: the level-up and chest pause (`Run.state`), enemy targeting, ownership of abilities, allies and projectiles, and the client loop.

Migration in 8 steps, 8-10 chats; steps 1-4 (player state, inputs as an array, enemy targeting, shared XP and own gold) do not change the one-player game and could go before the difficulties.

## 5. Open points for Petr

1. **What Petr does:**
   - (a) open https://wizzik.github.io/defense-webgame/determinism/ in Chrome and in Firefox (and Safari on a phone if at hand) after the merge; every one must show `73372c52`;
   - (b) https://wizzik.github.io/defense-webgame/net-spike/ in Chrome (Host) and Firefox (the link) on one computer, 10 minutes, walking with WASD in the host window;
   - (c) the same on two computers in different networks (e.g. one on a phone hotspot), 10 minutes;
   - after (b) and (c) send the panel values (RTT median and p95, stalls per minute, matched hash, desync) into the chat.
2. If (c) cannot connect at all, the networks need a TURN server (a free tier or our own); the code takes it through the PeerJS `config.iceServers`.
3. Single player and the level-up pause: R3 says a co-op level-up does not pause. Keep the pause for one player (simplest, the matrix digest stays) or drop it everywhere?
4. The time limit of a co-op card choice (Claude proposes 10 s, then the autopilot's card).
5. Order of the next phases: the spike changes nothing that forces multiplayer first. Claude suggests difficulties, progression and credits next as Petr ordered, each with a player-count knob (inventory chapter 5), then the migration.

## 6. Recommendation

- Lockstep: **yes**. The sim is deterministic across engines and cheap to hash; inputs are 6 numbers per step.
- `INPUT_DELAY = 3` (100 ms) to start; raise to 4-5 if Petr's two-network test shows stalls above 1 % at RTT under 100 ms. Rollback is not needed for a co-op survivors game.
- Signalling: the PeerJS cloud for testing; our own PeerServer (free tier hosting) before a public co-op release. TURN: only if (c) fails.
- Credits and FAQ: PeerJS (MIT); WebRTC shows a player's IP address to his teammates.
