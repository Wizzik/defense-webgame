# Single-hero inventory and migration order

Multiplayer spike, 2026-11-20 (spec `docs/superpowers/specs/2026-11-20-multiplayer-spike-design.md`, 5.3). Built from `grep` over `sim/`, `client/`, `meta/` and `tools/` at `3d48341` and from reading the systems that `Run.step` calls; not an estimate from memory. Petr's co-op rules are in the spec, chapter 3 (marked **R1-R7** below).

- **R1** WebRTC peer-to-peer (PeerJS).
- **R2** Shared XP (all heroes level together); gold per player.
- **R3** A level-up does not pause the game; a hero choosing a card is invulnerable, does not attack or cast, enemies ignore him.
- **R4** Every player gets his own boss drop.
- **R5** A chest's item goes only to the buyer (his gold); the chest vanishes for everyone; enough chests for several players.
- **R6** Difficulty multiplies with every player; a fallen teammate is revived by standing on him for 5 s.
- **R7** No AI ally.

## 1. Counts

Occurrences in production code (tests apart). `run.hero` misses the many systems that destructure `const { hero } = run`: counting those too, **38 files in `sim/`** read the hero (the spec's pre-scan said 37 files and 514 `run.hero`, but 432 of those are in tests).

| pattern | sim | client | meta | tools | tests (all) | sim files |
|---|---|---|---|---|---|---|
| `run.hero` | 51 | 23 | 0 | 10 | 432 | 27 |
| `run.abilities` | 29 | 15 | 0 | 3 | 77 | 10 |
| `run.gear` | 16 | 2 | 0 | 1 | 36 | 4 |
| `run.buffs` | 6 | 1 | 0 | 0 | 0 | 2 |
| `run.gold` | 6 | 4 | 0 | 0 | 27 | 4 |
| `run.offer` | 9 | 5 | 0 | 2 | 21 | 4 |
| `run.chestOffer` | 7 | 4 | 0 | 4 | 16 | 3 |
| `run.openChest` | 4 | 0 | 0 | 0 | 1 | 2 |
| `run.ultimateAuto` | 4 | 2 | 0 | 0 | 11 | 3 |
| `run.ultimateRequested` | 4 | 0 | 0 | 0 | 13 | 3 |
| `run.shieldTicks` | 11 | 1 | 0 | 0 | 21 | 6 |
| `run.heroIndex` | 2 | 0 | 0 | 1 | 1 | 2 |
| `run.allies` | 7 | 4 | 0 | 0 | 28 | 3 |
| `run.projectiles` | 3 | 1 | 0 | 0 | 18 | 3 |
| `state "levelUp"` | 3 | 4 | 0 | 0 | 3 | 2 |
| `state "chest"` | 2 | 5 | 0 | 0 | 1 | 2 |
| `pendingLevelUps` | 9 | 0 | 0 | 0 | 18 | 6 |
| `TickInput` | 12 | 23 | 0 | 4 | 33 | 5 |

Files in `sim/` by how much they use the hero (`hero.` reads): `hero.ts` 50, `bot.ts` 26, `hash.ts` 23, `level-up.ts` 15, `buffs.ts` 13, `hero-snares.ts` 12, `crystals.ts` 10, `abilities/line.ts` 10, `abilities/cone.ts` 9, `abilities/projectile.ts` 8, `abilities/area.ts` 8, `run.ts` 7, `enemy-ai.ts` 7, `abilities/heal.ts` 7, `abilities/chain.ts` 7, `enemy-strike.ts` 6, then 22 files with 1-5.

The good news from reading the code: the sim already passes `run` everywhere and the hero is one object (`HeroState`), so most changes are "loop over players" or "use the player this thing belongs to", not new mechanics. The cross-cutting part is ownership (whose ability, whose projectile, whose gold) and the pause-free level-up.

## 2. Target shape (proposal)

```ts
interface PlayerState {
  hero: HeroState;              // today run.hero
  heroIndex: number;
  abilities: AbilitySlot[];     // today run.abilities
  gear: GearState;              // run.gear (with fx)
  buffs: BuffState;             // run.buffs (orb effects, lifesteal budget)
  gold: number;                 // R2: per player
  offer: CardOffer | null;      // R3: per player, the game goes on
  chestOffer: ChestOffer | null;
  openChest: number;            // R5
  choosingTicks: number;        // R3: > 0 while a card or chest is open (invulnerable, ignored, no attacks)
  ultimateAuto: boolean;
  ultimateRequested: boolean;
  shieldTicks: number;
  downTicks: number;            // R6: > 0 while fallen
  reviveTicks: number;          // R6: progress of a teammate standing on him (5 s = 150 steps)
  magicFind: number;            // R4: the client rolls his drop with it
}
class Run {
  players: PlayerState[];       // 1-4; players[0] is the single player today
  xp, level, pendingLevelUps;   // R2: shared, moved off HeroState
  state: "playing" | "won" | "lost";
  step(inputs: readonly TickInput[]): void;
}
```

Allies and projectiles get an `owner: Uint8Array` column (player index). Enemies get a `target: Int8Array` (player index, -1 castle). The event buffer gets a player field where it matters (damage numbers, pickups, sounds).

## 3. Table by category

Size: **S** under 30 changed lines, **M** under 150, **L** above. "Rule" names Petr's rule that forces the change; "-" means only plumbing.

### 3.1 State on `Run`

| File / function | Assumes | Change | Rule | Size |
|---|---|---|---|---|
| `sim/run.ts` `Run` fields `hero`, `heroIndex`, `abilities`, `gear`, `buffs`, `gold`, `offer`, `chestOffer`, `openChest`, `ultimateAuto`, `ultimateRequested`, `shieldTicks` | one hero per run | move into `PlayerState`; keep getters `run.hero` etc. for `players[0]` during the migration | - | M |
| `sim/run.ts` constructor, `RunOptions.hero`, `loadout` | one hero, one loadout | `players: { hero, loadout }[]`; `hero`/`loadout` stay as a one-player shortcut | - | S |
| `sim/world.ts` `HeroState.xp`, `level`, `pendingLevelUps` | XP per hero | move to `Run` (shared) | R2 | S |
| `sim/input.ts` `TickInput`; `Run.step(input)` | one input | `step(inputs: readonly TickInput[])`; `step(input)` wraps one | - | S |
| `sim/start-phase.ts` | grants the start XP to one hero | shared XP, every hero gets the level | R2 | S |

### 3.2 Enemy targeting

| File / function | Assumes | Change | Rule | Size |
|---|---|---|---|---|
| `sim/enemy-ai.ts` `updateEnemies` | hunters walk to `hero`, melee hits `hero`, push-out from `hero` | pick a target per enemy: nearest living, not choosing, not down player (or the castle); store it in `enemies.target`; push out of every hero | R3, R6 | M |
| `sim/enemy-steer.ts` | flankers, skirmishers, supports steer by `run.hero` | steer by the enemy's target | - | S |
| `sim/enemy-strike.ts` `updateStrike` | bosses strike the hero | the target player | - | S |
| `sim/enemy-slam.ts` `updateSlam` | slam circle on the hero, distance to the hero | the target player; the slam hits every hero inside | - | S |
| `sim/enemy-charge.ts` | elites charge the hero | the target player | - | S |
| `sim/enemy-cloud.ts` `updateClouds` | the rotgut cloud damages the hero | every hero inside | - | S |
| `sim/hero-snares.ts` (web, roots) | snares on the one hero | per player | - | S |
| `sim/enemy-raise.ts`, `enemy-bloodlust.ts`, `enemy-heal.ts`, `enemy-aura.ts` | enemy-to-enemy; no hero | none | - | - |
| `sim/combat.ts` `damageHero`, `heroDamageScale` | one hero | `damageHero(run, player, ...)`; a choosing or down player takes nothing | R3, R6 | S |
| `rules.yaml` difficulty | one hero | `rules.coop.perPlayer` multipliers on enemy hp, damage and pack size; one knob (see 5) | R6 | S |

### 3.3 Abilities: origin, targets, ownership

| File / function | Assumes | Change | Rule | Size |
|---|---|---|---|---|
| `sim/abilities/slots.ts` `updateAbilities` | one slot list | loop over players; a choosing or down player does not cast | R3, R6 | S |
| `sim/abilities/{area,chain,cone,echo,heal,instant,line,nova,shield,ticking-area,projectile}.ts` | cast from `run.hero` with its spell power | take the owner player as a parameter (one line each, the origin and `stats.spellPower`) | - | M (12 files, S each) |
| `sim/abilities/heal.ts`, `shield.ts` | heal or shield the caster | the caster (team heals later, not now) | - | S |
| `sim/abilities/aura.ts`, `passive.ts` | bonuses on the one hero | per player | - | S |
| `sim/abilities/on-hit.ts`, `sim/hero-multishot.ts` | the hero's basic attack | the attacking player | - | S |
| `sim/abilities/summon.ts`, `sim/allies.ts` `updateAllies` | wards and copies follow `run.hero`, use its spell power | `allies.owner`; follow and scale by the owner; a fallen owner's allies stay until they expire | - | M |
| `sim/projectiles.ts` `updateProjectiles` | damage scaled by `run.hero.stats.spellPower` at impact | `projectiles.owner`; lifesteal and kill credit to the owner | - | S |
| `sim/hero.ts` `applyActions`, `moveHero`, `updateHeroCombat` | one input, one hero | loop over players with their own input; choosing players do not attack | R3 | M |
| `sim/gear-effects.ts` `updateGearEffects`, `onGearAttack`, `onGearEliteKill`, `onGearGold` | one `gear.fx` | per player (`players[p].gear.fx`); elite kill credit to the killer | - | M |
| `sim/buffs.ts` `healHero`, `lifestealOnHit`, `updateBuffs` | one hero | per player | - | S |

### 3.4 Pickups

| File / function | Assumes | Change | Rule | Size |
|---|---|---|---|---|
| `sim/crystals.ts` `updatePickups` (crystals) | magnet of the hero pulls, the hero collects | nearest player's magnet pulls; XP goes to the shared pool | R2 | S |
| `sim/crystals.ts` `updatePickups` (coins), `gainGold` | gold to `run.gold` | gold to the collecting player | R2 | S |
| `sim/crystals.ts` (hearts), `sim/orbs.ts` `updateOrbs` | heal / buff the hero | the collecting player | - | S |
| `sim/orbs.ts` `placeOrb` | places away from the hero | away from every hero | - | S |
| `sim/level-up.ts` `gainXp`, `refreshHeroStats` | one hero levels | the shared level raises every hero; stats per player | R2 | M |

### 3.5 Level-up and chests without pause

| File / function | Assumes | Change | Rule | Size |
|---|---|---|---|---|
| `sim/run.ts` `step` (`levelUp`, `chest` states) | the whole run waits for one choice | remove both states; `chooseCard` / `chooseChestCard` run per player inside `step` when his input carries a card; the world goes on | R3 | M |
| `sim/cards.ts` `openOffer`, `chooseCard` | one offer at a time, pending level-ups of the hero | per player; each player gets an offer per shared level; `choosingTicks` set while it is open; time limit (Petr's open question; Claude proposes 10 s, then the autopilot card) | R2, R3 | M |
| `sim/chests.ts` `updateChests`, `rollChestOffer`, `applyChestCard`, `chooseChestCard` | the hero opens with `run.gold`; one open chest | the player standing on it pays with his gold; the offer is his; the chest is gone for all; `rules.chests.count` scaled by players | R5 | M |
| `sim/chests.ts` `placeChest` | spacing from one hero | from every hero | R5 | S |

### 3.6 End of run and revive

| File / function | Assumes | Change | Rule | Size |
|---|---|---|---|---|
| `sim/run.ts` `checkEnd` | lost when the hero dies | a dying hero goes down (`downTicks`); lost when every hero is down or the castle falls | R6 | S |
| new `sim/revive.ts` | - | a living teammate within reach for 150 steps revives at a share of hp; progress resets when he leaves | R6 | M |
| `sim/events.ts` `RunEnd` | result `hero` | keep `hero` for "all heroes down" | - | S |

### 3.7 Boss drop

| File / function | Assumes | Change | Rule | Size |
|---|---|---|---|---|
| `client/game/gear-session.ts` `onBossDeath` → `meta/drop.ts` `rollDrop(data, save, bossId, seed, order, magicFind)` | one collection | **already outside the sim**: each client rolls from its own save; only `magicFind` must be the local player's | R4 | S |

### 3.8 Hash, autopilot, tools

| File / function | Assumes | Change | Rule | Size |
|---|---|---|---|---|
| `sim/hash.ts` `stateHash` | one hero block | loop over players; **for one player mix the same values in the same order**, so the matrix digest stays `73372c52` | - | M |
| `sim/bot.ts` `botInput`, `botCard`, `botChestChoice` | reads `run.hero`, `run.gold`, `run.offer` | `botInput(run, player, out)` | - | M |
| `tools/sim-run/*` | one hero per run | `--players N` (all autopilot) for balance of R6 | R6 | M |
| `sim/debug-spawn.ts`, debug grants | the hero | player 0 | - | S |

### 3.9 Client

| File | Assumes | Change | Size |
|---|---|---|---|
| `client/game/session.ts`, `client/main.ts` | one run, one keyboard input, pause on `levelUp`/`chest` | local player index; the net loop of `client/net-spike/main.ts` (lockstep) replaces the local `step`; no pause screens | L |
| camera, `client/render/*` hero view, `ally-view.ts`, `ability-fx.ts`, `damage-numbers.ts` | one hero model, fx from the hero | one model per player (tint per player), fx from the owner; damage numbers only of the local player or dimmed | M |
| `client/ui/hud.ts`, `card-lines.ts`, `gear-panel.ts` | one hero's hp, gold, abilities; cards as a modal | local player's; cards as a non-modal panel (R3); teammates' hp bars and a down marker (R6) | M |
| `client/audio/event-cues.ts`, `sound-view.ts` | every event is "mine" | own sounds full, teammates' quieter | S |
| `client/game/debug.ts` (`window.__game`) | one hero | `players` array; current fields stay for player 0 (the e2e tests read them) | M |
| lobby (new) | - | host/join from `client/net/`, hero choice per player, start with `hello { seed, heroes }` | M |

### 3.10 Tests

432 `run.hero` uses in tests stay valid as long as `run.hero` is the getter of player 0. Every migration step adds its own N-player tests; the existing ones prove the one-player game did not change.

## 4. Migration order

Every step leaves the one-player game unchanged. **The regression test is the determinism matrix**: `npx vitest run client/determinism` plus the matrix digest (`73372c52` at `3d48341`) must stay the same after steps 1-3 and 5 (pure refactors); `npm run sim:run -- --hero all --seeds 1-20` must print the same results as `main`. Steps 4, 6 and 7 change behaviour only with more than one player (or, for 4, also for one player: then the digest changes on purpose and the PR says so).

| # | Step | Changes for one player? | Proof | Size | Chats |
|---|---|---|---|---|---|
| 1 | `PlayerState` with one player; getters `run.hero`, `run.abilities`, ... on `players[0]`; hash mixes the same values in the same order | no | matrix digest equal, `npm run check` | M-L | 1 |
| 2 | `step(inputs[])`, `RunOptions.players`; heroes loop in `hero.ts`, abilities, gear effects, buffs; ally and projectile `owner` | no | digest equal; new test: two players, the second idle at the castle, the first plays the same as alone until enemies notice the second | L | 1-2 |
| 3 | enemy targeting per enemy (`enemies.target`), damage to the target player, snares and clouds per player | no (one candidate) | digest equal; tests: an enemy picks the nearer of two heroes | M | 1 |
| 4 | shared XP and level, gold per player, pickups to the collector | no for gold; XP the same with one player | digest equal | M | 1 |
| 5 | level-up and chests without pause (`choosingTicks`, offers per player, time limit) | **yes**: one player also stops pausing (Petr decides whether single player keeps the pause; the rules allow both) | if the pause stays for one player: digest equal; otherwise a new digest and the sim:run table in the PR | L | 1-2 |
| 6 | down, revive, end of run when all are down; chests count and price per player; `rules.coop.perPlayer` | no | digest equal; tests for revive and the end | M | 1 |
| 7 | client: lobby, net loop from the spike, several hero models, HUD for teammates, cards as a panel | no | e2e `webgl2-fallback` green; two-tab test like the spike | L | 2 |
| 8 | balance of co-op (`sim:run --players 2..4`), Petr's playtests | - | tables in DECISIONS | M | 1 |

Done: steps 1-2 (PR #31, 2026-11-22), steps 3-4 (PR #33, 2026-11-23), step 5 (PR #34, 2026-11-23), step 6 (2026-11-23; how they were built, and where they left this table: `docs/DECISIONS.md`, Multiplayer migration, steps 3-4, step 5 and step 6).

Total: **8-10 chats** (the spike counted). Steps 1-4 could run before the difficulties and progression without blocking them.

## 5. What the next phases should design for now

- **Difficulties (phase 4):** keep every enemy-strength knob in `rules.yaml` as a multiplier that a player count can multiply too (`rules.coop.perPlayer.{hp, damage, packSize, eliteHp}`), so R6 is one table, not a second system. Environments do not depend on the player count.
- **Progression (phase 5):** store unlocks per profile in the browser (already how gear works); a co-op run only needs each player's own unlocks at the start (they travel in `hello`), and the sim must not read meta state during the run.
- **Credits (phase 6):** list PeerJS (MIT) and its free cloud signalling; the FAQ notes that WebRTC shows a player's IP address to his teammates.
- **Single player keeps working** through the getters of step 1; nothing in phases 4-6 should add a new `run.hero` read where a `player` parameter is just as easy.
