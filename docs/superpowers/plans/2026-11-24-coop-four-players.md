# Co-op for 3-4 Players Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The co-op lobby, the net loop and the client play 2-4 players. Today they play exactly 2.

**Architecture:** A star through the host. Guests link only to the host. The host fills in the sender's player number on every input and hash, applies it, and relays it to the other guests. Every window runs the same `Lockstep` over n players. The sim, the team panel and `rules.coop` already handle 1-4 players.

**Tech Stack:** TypeScript, PeerJS 1.5.5 (WebRTC data channels), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-coop-four-players-design.md`

## Global Constraints

- At most 4 players (`MAX_PLAYERS` = 4 in `client/net/protocol.ts`). The host is player 0, and guests follow join order. Numbers are packed again at the start.
- `PROTOCOL_VERSION` 2 -> 3. A window with another version gets the existing "reload both pages" line (`coop.version`).
- Single player and the sim do not change: `git diff main -- sim` stays empty, and the matrix digest stays `4bc81413`.
- The host trusts the link, not the field: a guest's `p` is overwritten with that link's player number.
- Player-facing texts exist in EN and CS. Code and comments are in English.
- `npm run check` passes before every commit. Conventional Commits.

## Review Focus

- A guest leaves the lobby before the start: he drops from every lobby list, and the players are packed with no gap (Task 4 test `roster packs players after a guest leaves`).
- A 4th guest arrives (5 players): he is turned away, and the room stays as it was (Task 3 `openRoom` limit; Task 4 test `a fifth player is refused`).
- A guest sends an input claiming another player's `p`: the host applies it as the sender's (Task 2 test `host takes the player from the link`).
- The host leaves mid-run: each guest drops every other player and plays on alone (Task 2 test `guest drops everyone when the host leaves`).
- A guest leaves mid-run: the host tells the others with `left {p}`, and nobody's lockstep stalls on him (Task 1 test `three players play on without one who left`; Task 2 test `host relays a guest's departure`).

---

### Task 1: Lockstep for n players

**Files:**
- Modify: `client/net/lockstep.ts`
- Test: `client/net/lockstep.test.ts`
- Modify: `client/net-spike/main.ts` (still 2 players; it just compiles against the new types)

**Interfaces:**
- Produces: `new Lockstep(players: number, local: number)` (2-4). `drop(player: number)`. `receive(player: number, k, input)`. `recordHash(player: number, k, h): HashVerdict`. This compares the local hash for step k with every other player's known hash for k. It returns `"desync"` when one differs, `"ok"` when at least one is compared and all compared ones match (this updates `lastMatchedHash`), and `"pending"` otherwise. A dropped player's hashes are ignored.

- [ ] Step 1: tests. Add `playGroup(n, steps)`: n locks and n runs over the in-memory delayed link, every message delivered to every other peer. Add these cases:
  - `three and four players stay in sync over 1500 steps`: `desyncs === 0` and equal `stateHash` per run.
  - `three players play on without one who left`: player 2 stops sending at step 200, and the others call `drop(2)`. Both reach step 600.
  - `a hash differing in one of three players is a desync`.
  - Keep every existing 2-player test green.
- [ ] Step 2: run `npx vitest run client/net/lockstep.test.ts`. The new tests fail (the constructor takes `2`).
- [ ] Step 3: generalise `Lockstep` (players `number`, local `number`) and `recordHash` as above.
- [ ] Step 4: the tests pass and `npm run check` passes.
- [ ] Step 5: commit `feat(net): lockstep for 2-4 players`.

### Task 2: Protocol 3 and the host relay

**Files:**
- Modify: `client/net/protocol.ts`, `client/net/protocol.test.ts`
- Create: `client/net/relay.ts`, `client/net/relay.test.ts`
- Modify: `client/net/coop-net.ts`, `client/net-spike/main.ts`

**Interfaces:**
- Produces (protocol):
  - `in` and `hash` get `p` (0-3).
  - `inputMessage(k, p, input)`.
  - New `{ t: "room"; v; you: number; heroes: string[] }`: host to every guest whenever the lobby changes. `heroes[i]` is player i's hero, and `you` is the receiver's number.
  - New `{ t: "left"; p }`.
  - `start` gets `you: number` (1-3) and keeps `heroes` 2-4 long.
  - `hello` stays for `/net-spike/`.
- Produces (`relay.ts`, pure):
  - `inboundPlayer(local: number, from: number, p: number, players: number): number | null`. On the host (local 0) it returns `from`, which is the link's player. On a guest it returns `p`, or `null` when `p === local` or `p` is out of range.
  - `relayTargets(local: number, from: number, links: readonly number[]): number[]`. On the host it returns every guest link except `from`. On a guest it returns `[]`.
- Produces (`CoopNet`): the deps `peer: PeerLink; local: 0 | 1` become `links: ReadonlyMap<number, PeerLink>` (host: guest number -> link; guest: `0` -> the host link) and `local: number` and `players: number`. `onLeft(player: number, reason: string)`. `NetStats.left` becomes `gone: number[]` (players who left). A guest whose host link closes drops every other player and calls `onLeft(0, ...)`. The host relays `in` and `hash` (with `p` set) and sends `left {p}` to the rest when a guest link closes. `stop()` closes every link. Pings go on every link, and the RTT samples are shared.

- [ ] Step 1: protocol tests:
  - decode `room`, `left`, `in`/`hash` with `p`, `start` with `you`;
  - reject `p` = 4, `you` = 0 in `start`, and `room` with 5 heroes;
  - `PROTOCOL_VERSION` is 3.
- [ ] Step 2: relay tests:
  - `host takes the player from the link` (`inboundPlayer(0, 2, 1, 3) === 2`);
  - `guest ignores its own player` (`inboundPlayer(1, 0, 1, 3) === null`);
  - `relayTargets(0, 1, [1, 2, 3])` deep-equals `[2, 3]`;
  - `relayTargets(2, 0, [0])` deep-equals `[]`.
- [ ] Step 3: run both test files and see them fail.
- [ ] Step 4: implement the protocol, `relay.ts`, the `CoopNet` changes, and `/net-spike/` (sends `p` = local, stays 2 players).
- [ ] Step 5: `CoopNet` behaviour tests in `client/net/coop-net.test.ts`. Use fake `PeerLink`s (an array of sent messages plus `fire(m)` and `fireClose()` callbacks) and a 3-player `createRun`. Do not call `start()`: test only `receive` and `leave`.
  - `host relays a guest's input to the other guest with p`;
  - `host relays a guest's departure` (closing link 1 sends `left {p: 1}` on link 2 and puts 1 in `stats.gone`);
  - `guest drops everyone when the host leaves` (`stats.gone` deep-equals `[0, 2]` for local 1 of 3).
- [ ] Step 6: `npm run check` passes. Commit `feat(net): protocol 3 with player numbers, host relays inputs and hashes`.

### Task 3: A room for up to three guests

**Files:**
- Modify: `client/net/peer-link.ts`

**Interfaces:**
- Produces: `openRoom(code, signal, onGuest: (link: PeerLink) => void, maxGuests = 3): Promise<Room>`, where `interface Room { close(): void; lock(): void }`. It resolves once the room id is registered. `onGuest` gets one `PeerLink` per guest whose data channel opened. A connection beyond `maxGuests` (counting links still open) or after `lock()` is closed at once. A guest link's close does not destroy the shared `Peer`, but `Room.close()` does. `wrap(conn, onFinish)` no longer destroys the peer itself on the host side. `joinRoom` stays as it is. `hostRoom` is removed (the spike page moves to `openRoom` and uses the first guest).
- No unit test (PeerJS needs a signalling server). Task 6's net test covers it.

- [ ] Step 1: implement `openRoom` and move `/net-spike/` to it. Run `npm run check`.
- [ ] Step 2: commit `feat(net): a room that takes up to three guests`.

### Task 4: Lobby and setup for 2-4 players

**Files:**
- Create: `client/game/coop-roster.ts`, `client/game/coop-roster.test.ts` (pure: who is in the room)
- Modify: `client/game/coop-setup.ts`, `client/ui/coop-lobby.ts`, `client/ui/messages-en.ts`, `client/ui/messages-cs.ts`

**Interfaces:**
- Produces: `class Roster` holding the host's view of the room.
  - `add(link: PeerLink, hero: string, gear: NetGear[]): number | null`: the guest's player number, or `null` when 3 guests are in.
  - `setHero(link, hero, gear)`, `remove(link)`, `heroes(host: string): string[]`, `gear(host: NetGear[]): NetGear[][]`, `numberOf(link): number`, `links(): ReadonlyMap<number, PeerLink>`, `size`.
  - Player numbers are the position in join order + 1, packed after a `remove`.
- Produces: `LobbyState` `ready` becomes `{ kind: "ready"; role; players: string[] (hero names, player order); you: number }`. The lobby shows one line per player ("1. Stonehorn (host)", "2. Sparkshot (you)"). `CoopSetupDeps.loadModels(heroes, local, world)` is unchanged.
- Rules:
  - The host sends `room` to every guest on each join, hero change or leave.
  - At the start the host sends each guest a `start` with his own `you`, and calls `room.lock()`.
  - The guest checks `m.heroes.length` in 2-4 and `you < heroes.length`.
  - `begin(..., links, local)` passes the links map to `startCoop`.
  - Texts: `coop.waiting` reads "send the link to up to three friends"; new `coop.players` (lobby header "Players {n}/4"), `coop.you`, `coop.hostTag`, `coop.full` (shown to a refused guest: "The room is full (4 players)."). `coop.left` takes `{name}`.

- [ ] Step 1: roster tests:
  - `numbers guests by join order`;
  - `roster packs players after a guest leaves` (add a, b, c; remove b; `numberOf(c) === 2`; `heroes("x")` deep-equals `["x", heroA, heroC]`);
  - `a fifth player is refused` (`add` returns `null`).
- [ ] Step 2: run and see them fail. Implement `Roster`. The tests pass.
- [ ] Step 3: rewrite the host side of `CoopSetup` on `openRoom` + `Roster`, the guest side on `room`, and the lobby's player list. A refused guest gets `room` with `you` = -1 and then a close; the guest shows `coop.full`. Allow `you` -1 in the decoder.
- [ ] Step 4: `npm run check`. Commit `feat(coop): lobby for up to four players`.

### Task 5: Session, views and debug for up to four heroes

**Files:**
- Modify: `client/game/params.ts` and its test (`mate` -> `mates: string[]`, at most 3, comma-separated, only with `debug=1`)
- Modify: `client/game/session.ts`: `startCoop(seed, players, local: number, net)`; a local run with `mates` steers every player but 0 with `botInput`. `inputs` holds 4 slots, and `run.step(this.inputs.slice(0, n))` is built once per run, not per step.
- Modify: `client/main.ts`: `heroViews` for players 0-3; `heroLoader` loads every mate's model; the `left` note names the hero.
- Modify: `client/ui/team-panel.ts` only if it misbehaves with 3 rows (check the shot).
- Modify: `e2e/coop.spec.ts`: a new test `a local four-player run shows four heroes and three teammates` with `?debug=1&mate=gravecaller,tidecaller,stonehorn&hero=sparkshot&seed=4`. It checks that `players` maps to the 4 heroes, that `render.heroModels` is 4, and that `.team-name` has count 3.

- [ ] Step 1: write the params test (`mate=a,b,c,d` keeps 3; `mate=a,,b` gives `["a","b"]`) and the e2e test; see them fail.
- [ ] Step 2: implement. `npm run check` passes, and `npx playwright test e2e/coop.spec.ts --project=webgl2-fallback` passes.
- [ ] Step 3: commit `feat(coop): session and views for up to four heroes`.

### Task 6: Net test with three windows, docs, PR

**Files:**
- Modify: `docs/DECISIONS.md` (new section "Co-op for 3-4 players"), `docs/STATUS.md`, `AGENTS.md` (co-op for 2-4 players, `mate` takes a list), `ARCHITECTURE.md` if it names the two-player net.

- [ ] Step 1: start a local PeerServer outside the repo. In a scratch Playwright script outside `e2e/`, open three headless windows: the host, then two guests joining by link. Start world 1 Normal and play 30 s with all walking. Record each window's `__net` (tick, lastMatchedHash, desyncAt, gone). Close guest 2: the others play on, and `gone` contains 2. Close the host: the remaining guest plays on.
- [ ] Step 2: `npm run check`, `npm run build`, and e2e `webgl2-fallback` pass.
- [ ] Step 3: write the docs (what Petr checks: 3-4 windows or friends, the lobby list, the full room, a leaver, the host leaving). Commit `docs: co-op for 3-4 players`.
- [ ] Step 4: push the branch `coop-four`, open a PR against `main`, and wait for CI.
