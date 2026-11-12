# Fáze 2b-3: celý běh s bossem – implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Běh trvá 16:40 ve 20 fázích, chodí v něm elitní nápory a tři minibossové a končí soubojem s finálním bossem; vyhraje se až jeho pádem.

**Architecture:**
- Časová osa jsou data: `rules.phases` má 20 řádků, `rules.events` nese nápory a minibosse podle času, `rules.run.finale` finálního bosse. Nový systém `sim/timeline.ts` je spouští; `spawner.ts` zůstává u běžných smeček.
- Boss je typ nepřítele v `design/enemies.yaml` s `boss: true`, volitelným `slam` a `model` (id typu, jehož model používá). Žije v `EnemyStore` jako každý jiný, takže ho kouzla, mřížka i klient vidí bez výjimek. Úder počítá `sim/enemy-slam.ts` vedle `enemy-charge.ts`.
- `run.durationTicks` nově znamená příchod finálního bosse. Výhru hlásí `checkEnd`, až finální boss padne.
- Klient přidá HP bar bosse, oznámení, kruh úderu a `?phase=N`.

**Tech Stack:** beze změny a bez nových závislostí ani assetů (Node 22, TypeScript, Vite, Vitest, Three.js, zod, yaml, tsx, Playwright; verze podle `package-lock.json`).

**Spec:** `docs/superpowers/specs/2026-11-12-phase-2b3-full-run-boss-design.md`. Executor čte spec i plán. Plán spec zpřesňuje ve čtyřech bodech (tabulka níže); Task 8 je do specu zapíše.

## Co plán rozhoduje navíc ke specu

| Téma | Rozhodnutí |
|---|---|
| Velikost bosse | Měřítko modelu se v klientu počítá z `collision`. Bossové proto mají `collision` 80 (minibossové) a 96 (finální) místo „měřítka 2,5 a 3“; kaplan má malou kolizi a násobek by z něj udělal malého bosse. |
| `?duration` a `RunOptions.durationSeconds` | Posouvá jen příchod finálního bosse. Fáze ani události se nezkracují (spec říkal „poměrně“); testy, které chtějí rychlý konec, použijí `debug.killBoss()`. Rozsah `?duration` 5–1200. |
| Enrage | `finale.enrageAfterSeconds: 200` od příchodu finálního bosse (při 16:40 vychází 20:00), ne absolutní čas. |
| `?phase=N` | XP bere z ruční tabulky `rules.debug.phaseXp` (20 čísel), kterou Task 8 naplní z měření `sim:run --phase-xp`. |
| Události | `EventKind.RushWarning` 15, `BossSpawn` 16, `Slam` 17, `Enrage` 18 (pole viz Task 2–4). |
| Omráčení bosse | `rules.enemies.bossStunScale: 0.25`, jedno místo `stunEnemy` v `sim/combat.ts`. |
| Barvy bossů | iron-marshal `0x9aa3b8`, pale-abbot `0xd9f0e8`, gunmaster `0x2f5fb0`, dread-regent `0x8a1f3c`. Kruh úderu `0xd94a4a`. Žádná oranžová. |
| Texty | Tabulka v Tasku 6. |

**Výchozí tabulka fází** (`mix` v pořadí shieldbearer, scout, musketeer, chaplain, lancer; 0 = typ v `mix` chybí):

| fáze | mix | pack min–max / s | packs | hunterShare | elites |
|---|---|---|---|---|---|
| 1 | 8,3,0,0,0 | 6–10 / 6 | 1 | 0.25 | 0 |
| 2 | 6,3,2,0,0 | 8–11 / 6 | 1 | 0.3 | 0 |
| 3 | 5,3,2,1,1 | 8–12 / 6 | 1 | 0.3 | 1 |
| 4 | 4,3,3,2,2 | 8–12 / 6 | 2 | 0.3 | 1 |
| 5 | 4,2,3,2,3 | 9–13 / 6 | 2 | 0.35 | 1 |
| 6–8 | 4,3,3,2,3 | 10–14 / 6 | 2 | 0.35 | 1 |
| 9–10 | 3,3,3,2,3 | 9–13 / 5 | 2 | 0.35 | 2 |
| 11–13 | 3,3,3,2,3 | 11–15 / 5 | 2 | 0.4 | 2 |
| 14–15 | 3,3,4,2,3 | 10–14 / 5 | 3 | 0.4 | 2 |
| 16–18 | 3,3,4,2,4 | 11–15 / 5 | 3 | 0.4 | 2 |
| 19–20 | 2,3,4,2,4 | 12–16 / 5 | 3 | 0.4 | 3 |

**Bossové v `design/enemies.yaml`** (přidat na konec, pořadí je index typu; `hp` násobič je cílové HP dělené dnešním vygenerovaným HP zdroje):

| id | source / model | behavior | multipliers | xp | navíc |
|---|---|---|---|---|---|
| iron-marshal | hkni / lancer | charge | hp 18.7, collision 2.5, damage 1.0 | 150 | `charge` jako lancer, `slam: { radius: 350, damage: 120, windupSeconds: 1, cooldownSeconds: [7, 15] }` |
| pale-abbot | hmpr / chaplain | siege | hp 153.8, collision 5, damage 0.65 | 300 | `heal: { amount: 40, range: 600, cooldown: 1 }`, `slam` 400 / 180 |
| gunmaster | hrif / musketeer | skirmish | hp 160.4, collision 2.5, damage 0.6, range 1.75 | 450 | `slam` 400 / 240 |
| dread-regent | hkni / captain | charge | hp 93.5, collision 3, damage 1.5, moveSpeed 0.8 | 1 | `charge` jako lancer, `aura` jako captain, `slam` 500 / 350 |

Jména EN / CS: Iron Marshal / Železný maršál, Pale Abbot / Bledý opat, Gunmaster / Mistr střelby, Dread Regent / Hrůzný regent. `mapName` jako u zdroje.

## Global Constraints

- `sim/` je čisté a deterministické (AGENTS.md): žádné `Math.random`, `Date`, trigonometrie ani `**`; náhoda jen ze seedovaného `Rng`; pořadí losů je součást determinismu.
- `Run.step()` v běžném kroku nealokuje; nové stavy jsou typed arrays v `EnemyStore` nebo čísla na `Run`.
- Každé nové pole stavu jde do `sim/hash.ts`.
- `data/generated/*.json` se needituje ručně: `npm run map:extract -- <map.w3x> v20.75` (mapa je soubor `X_Hero_Siege_F-Day_v20.75_AI.w3x` v claude.ai projektu, výstup v `data-source/` se necommituje), pak `npm run data:build -- --source data-source/v20.75/out --out data/generated`.
- Mapové názvy a kódy jen v `design/`, `tools/`, `docs/`. Texty pro hráče v EN i CS přes `client/ui/messages-*.ts`, původní, nic z mapy.
- Žádná oranžová barva. Žádné nové assety.
- Kód, identifikátory a komentáře anglicky. Conventional Commits; commit až po zeleném `npm run check`. Commity pod identitou `Claude <noreply@anthropic.com>` s trailery session.
- Lokální e2e brána je `npm run e2e -- --project=webgl2-fallback`.
- Větev `phase-2b3-full-run` (už existuje, nese spec a tento plán).

## Review Focus

1. Finální boss padne ve stejném kroku, ve kterém hrdina získá úroveň: běh je `won` a nabídka karet se neotevře (Task 4).
2. Hrdina nebo hrad padne ve stejném kroku jako finální boss: platí prohra (Task 4).
3. Boss zemře nebo je omráčen během výstrahy úderu: kruh zmizí a nikdo zásah nedostane; úder při aktivním štítu (`shieldTicks > 0`) neublíží (Task 3).
4. `?phase=` s hodnotou mimo 1–21, s textem nebo bez `debug=1`: ignoruje se a běh začne normálně (Task 6).
5. Nápor nebo boss přijde při plném stropu 150: nápor zabere jen volná místa, boss místo dostane vždy, nic nespadne (Task 2).

---

### Task 1: Data časové osy a bossů

**Files:**
- Modify: `data/schema/rules.ts`, `data/schema/enemy.ts`, `data/schema/schema.test.ts`
- Modify: `tools/data-build/load.ts`, `tools/data-build/map-enemies.ts`, `tools/data-build/data-build.test.ts` (+ fixtures)
- Modify: `design/rules.yaml`, `design/enemies.yaml`, `data/generated/rules.json`, `data/generated/enemies.json`, `data/generated.test.ts`
- Modify: `client/render/models.ts` (+ test), `client/render/enemy-tints.ts` (+ test), `tests/assets.test.ts`
- Modify: testy v `sim/` a `tools/sim-run/`, které počítají s 6 fázemi nebo 300 s

**Interfaces:**
- Produces (`Rules`):
  - `run.durationSeconds: 1000`, `run.rushWarningSeconds: 7`
  - `run.finale: { boss: Slug; packScale: number (0–1]; enrageAfterSeconds: number; enrage: { damage: number; moveSpeed: number; slamCooldown: number } }`, výchozí `{ boss: dread-regent, packScale: 0.5, enrageAfterSeconds: 200, enrage: { damage: 2, moveSpeed: 1.3, slamCooldown: 0.5 } }`
  - `enemies.bossStunScale: 0.25`
  - `events: Array<{ atSeconds: number; kind: "rush"; units: Record<Slug, int ≥ 1> } | { atSeconds: number; kind: "boss"; enemy: Slug }>`, vzestupně podle `atSeconds`; obsah podle tabulky ve specu, oddíl 3 (180, 250, 360, 500, 540, 720, 750, 900 s)
  - `debug: { phaseXp: number[] }` (délka = počet fází, neklesající; výchozí samé 0)
  - `phases`: 20 řádků podle tabulky výše; `progression.xpStep: 14`
- Produces (`Enemy`): `boss?: true`, `model?: Slug`, `slam?: { radius: number; damage: number; windupSeconds: number; cooldownSeconds: [number, number] }` (min ≤ max); `multipliers.range` v `EnemyEntry`.
- Produces (klient): `enemyModelId(enemy: { id: string; model?: string }): string` v `client/render/models.ts`; VAT se načítá jednou na model a sdílí se mezi typy.

- [ ] **Step 1: Testy schématu** v `data/schema/schema.test.ts`: `rules accept events and a finale`; `events must ascend by atSeconds` (odmítne 250 před 180); `a rush needs at least one unit`; `slam cooldown min must not exceed max`; `debug.phaseXp has one value per phase`.
- [ ] **Step 2: Ověř, že selžou:** `npx vitest run data/schema` → FAIL (neznámé klíče).
- [ ] **Step 3: Rozšiř schémata** podle Interfaces. Křížová kontrola ve `validateGameData`: `finale.boss`, `events[].enemy` a klíče `units` jsou id nepřátel; `finale.boss` a `events[].enemy` mají `boss: true`; `model` je id jiného nepřítele bez `model`.
- [ ] **Step 4: Data-build:** `multipliers.range` násobí `attack.range`; `boss`, `model`, `slam` se kopírují z designu. Test v `data-build.test.ts`: `a boss entry carries boss, model, slam and a scaled range`.
- [ ] **Step 5: Zapiš `design/rules.yaml` a `design/enemies.yaml`** podle tabulek a spusť `map:extract` a `data:build`.
- [ ] **Step 6: Testy vygenerovaných dat** v `data/generated.test.ts`: `there are 20 phases and the final boss comes at 1000 s`; `boss hp matches the design targets` (12000, 20000, 30000, 60000, každé ±1 %); `bosses have collision 80, 80, 80, 96`.
- [ ] **Step 7: Klient a assety:** `enemyModelId`; `ENEMY_TINTS` dostane čtyři barvy bossů; `tests/assets.test.ts` prochází `new Set(enemies.map(enemyModelId))`. Test: `a boss uses the model of its source type`.
- [ ] **Step 8: Oprav testy, které připínají starou osu** (hledej `phases`, `300`, `durationSeconds` v `sim/*.test.ts`, `tools/sim-run/run.test.ts`). Chování výhry se v tomto tasku nemění.
- [ ] **Step 9:** `npm run check && npm run build` → zelené. Commit `feat(data): 20 phases, timed events and boss types`.

### Task 2: Plánovač událostí (nápory a příchod minibossů)

**Files:**
- Create: `sim/timeline.ts`, `sim/timeline.test.ts`
- Modify: `sim/events.ts`, `sim/run.ts`, `sim/enemies.ts`, `sim/spawner.ts`, `sim/hash.ts`, `sim/index.ts`

**Interfaces:**
- Consumes: `rules.events`, `rules.run.rushWarningSeconds`, `Enemy.boss` (Task 1).
- Produces:
  - `updateTimeline(run: Run): void`, voláno v `Run.step` těsně před `spawnEnemies`.
  - `spawnBoss(run: Run, type: number, role: number): number` (slot; exportováno z `sim/timeline.ts`).
  - `Run`: `nextEvent: number` (index do `rules.events`), `rushWarned: boolean`, `rushDirX`, `rushDirY: number`, `readonly isBoss: Uint8Array` (podle typu), `bossCount: number`.
  - `EnemyStore.oldestWhere(skip: Uint8Array): number` – slot živého nepřítele s nejmenším `spawnTick`, jehož typ není ve `skip`; při shodě nižší slot; −1 když není.
  - `EventKind.RushWarning = 15` (`value` = sekundy do příchodu, `x/y` = střed smečky), `EventKind.BossSpawn = 16` (`a` = slot, `value` = index typu, `x/y`).

**Pravidla:**
- Varování: v kroku `at − rushWarningSeconds` se vylosuje směr (`randomDirection`), uloží a pošle `RushWarning`. Je-li běh spuštěn až po tomto kroku, varování odpadne a směr se losuje při příchodu.
- Nápor: jedna smečka se středem na spawnovacím kruhu, role `Sieger`, členové v pořadí klíčů `units`, rozptyl jako u smečky ve `spawner.ts` (vytáhni společnou funkci `scatterPack`, ať se vzorec neopisuje). Zabere jen volná místa. Pošle `PackSpawn`.
- Miniboss: `spawnBoss` s rolí `Sieger`, sám, střed kruhu bez rozptylu. Je-li `aliveCount === capacity`, nejdřív `enemies.kill(oldestWhere(isBoss))` bez události a bez XP. HP a `damageScale` × `timeScale`.
- Běžný spawner bossy nikdy nelosuje (v `mix` nejsou; validace to nehlídá, test ano).
- Více událostí ve stejném kroku proběhne v pořadí seznamu.

- [ ] **Step 1: Testy** v `sim/timeline.test.ts` (běh s `durationSeconds: 100000`, čas posouvej `run.step` s prázdným vstupem):
  - `a rush warns 7 s ahead and comes from the warned side` (RushWarning v kroku 173 × 30, PackSpawn ve 180 × 30, stejný střed ±1e-6, 3 kapitáni + 4 kopiníci, všichni `Role.Sieger`);
  - `a rush at the cap fills only free slots`;
  - `a miniboss comes alone at its time` (BossSpawn ve 250 × 30, typ iron-marshal, `hp === def.hp × timeScale`);
  - `a boss replaces the oldest common enemy when the store is full` (aliveCount zůstane na kapacitě, žádná Death událost, žádný krystal);
  - `phase mixes never contain a boss`;
  - `same seed gives the same timeline` (`stateHash` po 300 s).
- [ ] **Step 2:** `npx vitest run sim/timeline` → FAIL.
- [ ] **Step 3: Implementuj** podle Interfaces a pravidel; nová pole do `hash.ts`.
- [ ] **Step 4:** `npx vitest run sim` → PASS. Commit `feat(sim): timed elite rushes and miniboss arrivals`.

### Task 3: Pravidla bosse a úder

**Files:**
- Create: `sim/enemy-slam.ts`, `sim/enemy-slam.test.ts`
- Modify: `sim/combat.ts`, `sim/hero.ts:136`, `sim/abilities/line.ts:60`, `sim/abilities/hits.ts:24`, `sim/enemy-ai.ts`, `sim/enemies.ts`, `sim/hash.ts`, `sim/knockback.test.ts`

**Interfaces:**
- Consumes: `Enemy.slam`, `Enemy.boss`, `rules.enemies.bossStunScale`, `run.isBoss`.
- Produces:
  - `stunEnemy(run: Run, slot: number, ticks: number): void` v `sim/combat.ts`: pro bosse `ceil(ticks × bossStunScale)`, delší omráčení vyhrává; tři dnešní místa ho volají.
  - `knockBack` bosse nepohne.
  - `EnemyStore`: `slamState: Uint8Array` (0 nic, 1 výstraha), `slamTicks`, `slamCooldown: Int32Array`, `slamX`, `slamY: Float64Array`; nulují se ve `spawn`, `slamCooldown` začíná na `round(cooldownSeconds[0] × 30)`.
  - `updateSlam(run: Run, i: number, heroDist: number): boolean` – true, když úder vlastní tento krok (boss stojí, `Action.Attack`); `cancelSlam(run: Run, i: number): void`.
  - `run.slamCooldownScale: number` (1; Task 4 ho při enrage mění).
  - `EventKind.Slam = 17`: `a` = slot, `value` = 0 výstraha / 1 zásah / 2 zrušeno, `x/y` = střed, `u` = poloměr, `v` = kroky výstrahy.

**Pravidla:**
- V `updateEnemies`: `slamCooldown` se snižuje každý krok; omráčení volá `cancelSlam`; `updateSlam` se volá před `updateCharge` a jen když `chargeState === Charge.None`.
- Start: cooldown 0 a (vzdálenost k hrdinovi ≤ 0,8 × radius, nebo vzdálenost ke středu hradu − `castle.radius` ≤ 0,8 × radius). Střed kruhu je poloha bosse v tom kroku.
- Zásah po `round(windupSeconds × 30)` krocích: hrdina, je-li jeho střed do `radius` od středu kruhu, dostane `slam.damage × damageScale[i] × (1 − armorReduction)` přes `damageHero`; hrad, je-li vzdálenost středu − `castle.radius` ≤ `radius`, dostane `slam.damage × damageScale[i]` přes `damageCastle`. Spojenci nic.
- Po zásahu i po zrušení: `slamCooldown = round((min + rng.next() × (max − min)) × 30 × run.slamCooldownScale)`. Los proběhne vždy právě jednou na konec úderu.
- Smrt bosse během výstrahy: `killEnemy` pošle `Slam` s `value` 2, je-li `slamState === 1`.

- [ ] **Step 1: Testy** v `sim/enemy-slam.test.ts` (boss vložený přes `spawnBoss`, hrdina posunutý přímo ve stavu):
  - `a slam warns for the windup, then hits a hero inside the circle` (30 kroků, HeroHit s hodnotou 120 × damageScale × redukce);
  - `a hero who leaves the circle is not hit`;
  - `a slam next to the castle hits the castle`;
  - `allies are not hit`;
  - `a stun cancels the slam and starts the cooldown` (Slam value 2, žádný HeroHit);
  - `a boss that dies in the windup hits nobody`;
  - `the shield blocks a slam`;
  - `the cooldown is between 7 and 15 s and deterministic for a seed`;
  - `a boss is stunned for a quarter of the time` (60 kroků → 15) a `a boss is not knocked back` (v `knockback.test.ts`).
- [ ] **Step 2:** `npx vitest run sim/enemy-slam sim/knockback` → FAIL.
- [ ] **Step 3: Implementuj.** Hash doplň o pole úderu.
- [ ] **Step 4:** `npx vitest run sim` → PASS. Commit `feat(sim): boss rules and the slam attack`.

### Task 4: Finále, výhra, enrage a start od fáze

**Files:**
- Modify: `sim/run.ts`, `sim/run.test.ts`, `sim/timeline.ts`, `sim/timeline.test.ts`, `sim/spawner.ts`, `sim/spawner.test.ts`, `sim/combat.ts`, `sim/enemy-ai.ts`, `sim/level-up.ts`, `sim/world.ts`, `sim/bot.ts`, `sim/hash.ts`, `sim/events.ts`
- Create: `sim/start-phase.ts`, `sim/start-phase.test.ts`

**Interfaces:**
- Consumes: `spawnBoss`, `run.slamCooldownScale`, `rules.run.finale`, `rules.debug.phaseXp`.
- Produces:
  - `Run`: `finalBossSlot: number` (−1), `finalBossDead: boolean`, `enraged: boolean`, `readonly finalBossType: number`, `get inFinale(): boolean` (`tick >= durationTicks`), `readonly bossLog: { type: number; spawnTick: number; deathTick: number }[]` (předalokováno: počet boss událostí + 1; `deathTick` −1 dokud žije), `bossLogCount: number`.
  - `RunStats.xpGained: number` (přičítá `gainXp`).
  - `RunOptions.startPhase?: number` (1 až `phases.length + 1`); `applyStartPhase(run: Run, phase: number): void` v `sim/start-phase.ts`, voláno na konci konstruktoru.
  - `botCard(offer: CardOffer): number` exportované ze `sim/bot.ts` (dnešní pravidlo: první karta kouzla, jinak 0); `botInput` ho používá.
  - `EventKind.Enrage = 18` (`a` = slot bosse).

**Pravidla:**
- V kroku `tick === durationTicks`: `spawnBoss(run, finalBossType, Role.Hunter)`, slot do `finalBossSlot`, `BossSpawn`.
- `killEnemy`: zapíše `deathTick` do `bossLog`; je-li slot `finalBossSlot`, nastaví `finalBossDead`.
- `checkEnd`: hrad → hrdina → `finalBossDead` (výhra). Čas už běh nekončí.
- Finále ve spawneru: tabulka poslední fáze, velikost smečky `max(1, round(size × packScale))`; los velikosti se nemění.
- Enrage: v kroku `durationTicks + round(enrageAfterSeconds × 30)`, žije-li finální boss: `enraged = true`, `damageScale[slot] *= enrage.damage`, `slamCooldownScale = enrage.slamCooldown`, událost `Enrage`. V `updateEnemies` má enraged finální boss `walk × enrage.moveSpeed`.
- `applyStartPhase(run, N)`: `tick = (N − 1) × phaseSeconds × 30` (pro `N = phases.length + 1` je to `durationTicks`); `nextEvent` přeskočí události s `atSeconds` < čas startu; `nextPackTick = tick + firstPackSeconds × 30`; `gainXp(run, phaseXp[min(N, phases.length) − 1])` a dokud `pendingLevelUps > 0`: `openOffer`, `chooseCard(run, botCard(run.offer))`. Stav po návratu je `playing`.

- [ ] **Step 1: Testy:**
  - `sim/run.test.ts`: přepiš `run is won when the duration ends` na `the run goes on after the duration until the final boss falls`; `killing the final boss wins the run`; `a level-up in the step the final boss dies does not open an offer` (state `won`, `offer === null`); `a castle that falls in the step the final boss dies loses the run`; `a living miniboss does not block the win`.
  - `sim/timeline.test.ts`: `the final boss comes at the duration as a hunter`; `the final boss enrages 200 s after it came` (damageScale × 2, Enrage jednou, `slamCooldownScale` 0.5); `a dead final boss never enrages`; `bossLog records spawn and death ticks`.
  - `sim/spawner.test.ts`: `packs in the finale are half the size of the last phase`.
  - `sim/start-phase.test.ts`: `startPhase 6 starts at 250 s and skips the rush of 180 s` (miniboss ve 250 s přijde); `startPhase 21 brings the final boss in the first step`; `the hero gets the phase xp and spends every level-up` (`pendingLevelUps === 0`, `state === "playing"`); `startPhase is deterministic`.
- [ ] **Step 2:** `npx vitest run sim` → FAIL na nových testech.
- [ ] **Step 3: Implementuj.** Hash doplň o nová pole `Run`.
- [ ] **Step 4:** `npm run check` → PASS (oprav `sim/bot.test.ts`, kde čeká konec v `durationTicks`: bot test smí běžet nejdéle `durationTicks + 400 × 30` kroků). Commit `feat(sim): finale, win by killing the final boss, enrage, start phase`.

### Task 5: Autopilot a `sim:run`

**Files:**
- Modify: `sim/bot.ts`, `sim/bot.test.ts`, `tools/sim-run/run.ts`, `tools/sim-run/run.test.ts`, `AGENTS.md` (řádek o `sim:run`)

**Interfaces:**
- Consumes: `run.bossLog`, `run.enraged`, `run.stats.xpGained`, pole úderu v `EnemyStore`.
- Produces:
  - Bot: stojí-li hrdina do `radius + 60` od středu aktivního kruhu úderu, jde přímo od středu (přednost před vším kromě karet). Ve finále s živým finálním bossem je jeho cílem boss.
  - `RunSummary` navíc: `bosses: { id: string; spawnSeconds: number; killSeconds: number | null }[]`, `enraged: boolean`, `phaseXp: number[]` (`xpGained` na začátku každé fáze, kam běh došel).
  - CLI: `--seeds A-B` (místo `--seed` + `--runs`, obojí dál funguje), `--phase-xp` (vypíše průměr `phaseXp` přes běhy jako YAML pole), `--phase N` (start od fáze).
  - Souhrn za hrdinu navíc: medián doby zabití každého minibosse, medián souboje s finálním bossem ve vyhraných bězích, počet běhů s enrage, prohry po dvouminutových oknech (`0-2: 1, 2-4: 0, …`).

- [ ] **Step 1: Testy:** `sim/bot.test.ts`: `the bot walks out of a slam circle` (po výstraze je hrdina dál než `radius` od středu); `the bot fights the final boss in the finale`. `tools/sim-run/run.test.ts`: `parses --seeds 3-7`; `a summary lists boss kill times`; `loss windows count losses per two minutes`; `--phase-xp prints one value per phase`.
- [ ] **Step 2:** `npx vitest run sim/bot tools/sim-run` → FAIL.
- [ ] **Step 3: Implementuj.**
- [ ] **Step 4:** `npm run check` → PASS; `npm run sim:run -- --hero stonehorn --seeds 1-3` doběhne a vypíše bosse. Commit `feat(sim-run): boss times, loss windows, seed ranges; the bot dodges slams`.

### Task 6: HUD, oznámení, `?phase` a e2e

**Files:**
- Modify: `client/ui/hud.ts`, `client/ui/messages-en.ts`, `client/ui/messages-cs.ts`, `client/ui/end-screen.ts`, `client/ui/style.css`, `client/game/params.ts` (+ test), `client/game/session.ts`, `client/game/debug.ts`, `e2e/game.spec.ts`, `AGENTS.md` (URL parametry a `window.__game`)
- Create: `client/ui/boss-bar.ts`, `client/ui/announcer.ts`, `client/ui/announcer.test.ts`

**Interfaces:**
- Consumes: `EventKind.RushWarning | BossSpawn | Enrage`, `run.inFinale`, `run.finalBossSlot`, `run.isBoss`, `RunOptions.startPhase`.
- Produces:
  - `GameParams.startPhase?: number` – jen s `debug=1`, celé číslo 1 až 21, jinak `undefined`; `durationSeconds` rozsah 5–1200.
  - `window.__game`: `phase` (1–20, ve finále 21), `boss: { id, hp, maxHp } | null` (naposledy příchozí živý boss), `slams` (počet nepřátel se `slamState === 1`); `debug.killBoss()` zabije všechny živé bosse přes `killEnemy`.
  - `Announcer.push(text: string, ticks: number)`: jedna řádka pod časem, novější nahradí starší, zmizí po `ticks`.
  - `BossBar.update(run, lang)`: jméno a HP naposledy příchozího živého bosse; skrytý bez bosse.

**Texty:**

| klíč | EN | CS |
|---|---|---|
| `hud.finale` | Finale | Finále |
| `announce.rush` | An elite rush is coming | Blíží se elitní nápor |
| `announce.boss` | {name} has arrived | Přichází {name} |
| `announce.enrage` | {name} is enraged | {name} zuří |
| `end.bossTime` | Final boss fell at {time} | Finální boss padl v {time} |

Oznámení trvá 4 s (nápor 7 s). Barva pruhu bosse `0x8a1f3c`, texty v dnešním stylu HUD.

- [ ] **Step 1: Jednotkové testy:** `params.test.ts`: `phase needs debug`, `phase outside 1..21 or not a number is ignored`, `duration clamps to 1200`. `announcer.test.ts`: `a newer line replaces an older one`, `a line disappears after its ticks`.
- [ ] **Step 2:** `npx vitest run client` → FAIL.
- [ ] **Step 3: Implementuj** HUD (`hud.finale` ve finále), `BossBar`, `Announcer`, řádek `end.bossTime` na obrazovce výhry, `startPhase` v `session.ts`, `window.__game` a `debug.killBoss`. Restart běhu vynuluje pruh i oznámení.
- [ ] **Step 4: e2e** v `e2e/game.spec.ts`:
  - uprav testy, které čekají výhru po `duration` (řádky kolem 139 a 206): po `duration` přijde boss, test zavolá `debug.killBoss()` (přidej `debug=1`) a čeká obrazovku výhry s `end.bossTime`;
  - `a miniboss shows its bar and name` (`?debug=1&phase=6&speed=4`: `__game.boss.id === "iron-marshal"`, pruh viditelný);
  - `an elite rush is announced` (`?debug=1&phase=4&duration=1200&speed=8`: text oznámení se objeví do 30 s herního času);
  - `the finale shows the final boss and ends with a win` (`?debug=1&phase=21`: `__game.phase === 21`, po `killBoss()` výhra);
  - `phase without debug starts a normal run` (`?phase=21`: `__game.tick` začíná u 0, `__game.boss === null`);
  - `a restart clears the boss bar`.
- [ ] **Step 5:** `npm run check && npm run build && npm run e2e -- --project=webgl2-fallback` → PASS. Commit `feat(client): phase and boss HUD, announcements, ?phase`.

### Task 7: Kruh úderu, vzhled bosse a zvuky

**Files:**
- Create: `client/render/fx/slam-rings.ts` (+ test rozložení, je-li v něm čistá funkce)
- Modify: `client/render/effects.ts` nebo `enemy-fx.ts` (kde se čtou události), `client/render/blob-shadows.ts`, `client/ui/pack-arrows.ts` (+ test), `client/audio/sfx.ts`, `client/audio/sound-view.ts`, `e2e/shots.spec.ts`, `e2e/game.spec.ts`, `AGENTS.md` (řádek o `npm run shots`)

**Interfaces:**
- Consumes: `EventKind.Slam` (`value` 0 / 1 / 2, `u` poloměr, `v` kroky), `RushWarning`, `BossSpawn`, `Enrage`.
- Produces: `SlamRings` – pool 4 plochých kruhů na zemi; `ringFill(elapsedTicks: number, windupTicks: number): number` (0–1, čistá funkce); `window.__game.render.slamRings` (počet viditelných).

**Pravidla:**
- Výstraha: obrys kruhu `0xd94a4a` v plném poloměru a výplň, která roste podle `ringFill`. `value` 1: krátký záblesk (0,2 s) a otřes kamery jako u dnešního silného zásahu. `value` 2: kruh hned zmizí.
- Blob stín bosse podle `collision` (dnes pevný poloměr, je-li tomu tak).
- Šipka náporu: při `RushWarning` na `rushWarningSeconds` barvou kapitána `0xb84ad8`; při `BossSpawn` šipka 4 s barvou bosse.
- Zvuky (syntetizované jako dnešní): příchod bosse (hluboký tón 0,6 s), zásah úderu (rána), enrage (dva tóny). Ztlumení klávesou M platí.
- Snímky: `npm run shots` přidá `boss` (1280×720, `?debug=1&phase=6`, po příchodu bosse a s kruhem úderu, je-li aktivní).

- [ ] **Step 1: Testy:** `ringFill is 0 at the start, 1 at the end and clamped`; `pack-arrows.test.ts`: `a rush warning shows an arrow for the warning time`. e2e: `a slam shows a ring and hides it after the hit` (`?debug=1&phase=6&speed=4`, `debug.teleport` k bossovi; `render.slamRings` jde 0 → 1 → 0).
- [ ] **Step 2:** testy → FAIL.
- [ ] **Step 3: Implementuj.**
- [ ] **Step 4:** `npm run check && npm run build && npm run e2e -- --project=webgl2-fallback && npm run shots` → PASS; prohlédni `test-results/shots/boss.png` (boss je zřetelně větší než dav, kruh je čitelný na trávě i na tmavé zemi u hradu, žádná oranžová). Commit `feat(client): slam rings, boss look and sounds`.

### Task 8: Balanc na 20 seedech a dokumentace

**Files:**
- Modify: `design/rules.yaml`, `design/enemies.yaml`, `design/scaling.yaml` (jen je-li třeba), `data/generated/*`, `sim/bot.test.ts` (pásma `GAPS`), `docs/DECISIONS.md`, `docs/STATUS.md`, `ARCHITECTURE.md`, `AGENTS.md`, `docs/superpowers/specs/2026-11-12-phase-2b3-full-run-boss-design.md`, `docs/superpowers/specs/2026-11-04-defense-webgame-design.md` (oddíl 3.1: enrage relativně, `?duration`)

**Cíle** (autopilot, seedy 1–20, každý hrdina kromě Gravecallera; spec, oddíl 8):
- 6–12 výher z 20;
- `--idle` prohraje do 4:00 ve všech bězích;
- nejvýš polovina proher v jednom dvouminutovém okně;
- medián zabití každého minibosse do 45 s;
- medián souboje s finálním bossem 40–90 s, enrage nejvýš v 1 běhu z 20;
- hrad vyhraných běhů v průměru pod 60 %;
- plný kit (4 kouzla × 5 úrovní) mezi fázemi 12 a 14, konečná úroveň 35–45.

**Knoflíky v tomto pořadí:** `progression.xpFirst` / `xpStep` → tabulka fází (velikost a počet smeček, `hunterShare`) → HP a poškození bossů, `slam` → složení náporů → `finale.packScale` → `castle.hp` → `scaling.yaml` `enemies.hp`. Kouzla hrdinů a `run.timeScaling` se nemění.

- [ ] **Step 1: Změř výchozí stav:** `npm run sim:run -- --hero all --seeds 1-20` a totéž s `--idle`; výstup ulož do poznámky v `docs/DECISIONS.md` (jen souhrnné řádky).
- [ ] **Step 2: Laď** po jednom knoflíku; po každé změně `data:build` a měření. Skonči, když cíle platí, nebo po 12 kolech; nesplněné cíle zapiš jako otevřené body s čísly.
- [ ] **Step 3: Kontrola mimo vzorek:** seedy 21–40; výsledek zapiš vedle (bez dalšího ladění, jen jako údaj o šumu).
- [ ] **Step 4: Naplň `rules.debug.phaseXp`** z `npm run sim:run -- --hero all --seeds 1-20 --phase-xp` (průměr přes hrdiny, zaokrouhleno na celá čísla) a spusť `data:build`.
- [ ] **Step 5: Test pásem** v `sim/bot.test.ts`: uprav dnešní test balancu na menší vzorek, který CI unese (seedy 1–3 pro každého hrdinu, `speed` neexistuje, běh jede naplno): `every hero's run ends by a loss or by killing the final boss within 1400 s` a `the idle player loses within 240 s`. Širší pásma hlídá jen měření v `DECISIONS.md`.
- [ ] **Step 6: Dokumentace:** `DECISIONS.md` (čtyři zpřesnění z úvodu plánu, výsledná čísla, otevřené body); `ARCHITECTURE.md` (timeline, slam, bossové, finále); `AGENTS.md` (`?phase`, `duration` 5–1200, `__game.phase/boss/slams`, `debug.killBoss`, nové přepínače `sim:run`); oba specy; `STATUS.md` (fáze hotová, co má Petr zkontrolovat: délka a tempo běhu, čitelnost kruhu úderu, obtížnost bossů, chudší druhá půlka běhu, odkazy `?debug=1&phase=6`, `&phase=21`).
- [ ] **Step 7:** `npm run check && npm run build && npm run e2e -- --project=webgl2-fallback` → PASS. Commit `feat(design): balance of the full run on 20 seeds`, pak PR do `main` (přes `gh api`, viz STATUS, Environment notes) a zkopíruj `docs/STATUS.md` do projektu jako `claude/STATUS.md`.
