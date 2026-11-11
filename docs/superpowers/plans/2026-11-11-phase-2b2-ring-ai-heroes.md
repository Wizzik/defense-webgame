# Fáze 2b-2: aréna dokola, AI nepřátel, 4 noví hrdinové – implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Roje chodí z náhodných směrů kolem hradu uprostřed mapy, každý typ nepřítele se chová po svém, hra je těžká a na výběr je 8 hrdinů.

**Architecture:**
- Brány mizí. Spawner pošle v každém intervalu `packs` rojů; každý má vlastní směr na kružnici `arena.spawn.radius` kolem hradu, vlastní roli a velikost.
- Typ nepřítele dostane v datech `behavior` (`siege`, `flank`, `skirmish`, `support`, `charge`) a volitelně `charge` a `aura`. `updateEnemies` zůstává jedna smyčka (cíl, útok, integrace); směr chůze počítá `sim/enemy-steer.ts`, nájezd `sim/enemy-charge.ts`, auru `sim/enemy-aura.ts`.
- Noví hrdinové jsou jen data: jejich kouzla používají druhy, které simulace už umí (`area`, `nova`, `line`, `projectile`, `ticking_area`, `aura`, `summon`, `on_hit`).
- Klient kreslí kruhovou arénu, šipky na okraji obrazovky ke směru nového roje, výstrahu před nájezdem a kruh aury kapitána.

**Tech Stack:** beze změny a bez nových závislostí ani assetů: Node 22, TypeScript 7.0.2, Vite 8.3.5, Vitest 5.1.0, Three.js 0.187.0, zod 4.6.7, yaml 2.9.1, tsx 4.23.15, @playwright/test 1.63.0.

**Spec:** `docs/superpowers/specs/2026-11-04-defense-webgame-design.md`, oddíly 3.1, 3.2, 3.3. Tento plán spec mění v jednom bodě: místo bran a cest je hrad uprostřed a nepřátelé chodí dokola (Petr, 2026-11-11). Task 6 to do spec zapíše. Navazuje na plán 2b-1.

## Co plán rozhoduje

Petr 2026-11-11: po playtestu 2b-1 je hra moc lehká (nepřátelé se k němu většinou nedostanou) a hrdinů je málo. Schválil: +4 hrdiny (celkem 8), hrad uprostřed a roje z 360°, obtížnost „těžká“, AI nepřátel nechal na nás. Vizuál A se posouvá za tuto fázi.

| Téma | Rozhodnutí |
|---|---|
| Aréna | 6000 × 6000, hrad (0, 0), hrdina začíná (0, 500). `arena.gates` a `arena.gateRadius` mizí, přibude `arena.spawn: { radius: 2400, spread: 150 }`. |
| Směr roje | Náhodný jednotkový vektor bez trigonometrie: losuj (a, b) z [−1, 1]², dokud 0,01 ≤ a² + b² ≤ 1 (nejvýš 8 pokusů, pak (1, 0)), a normalizuj. Druhý roj téhož intervalu jde z opačné strany, při třech rojích jsou směry po 120° (konstanty −0,5 a 0,8660254037844386). |
| Roje naráz | Fáze má `packs` 1–3. Každý roj losuje vlastní velikost a roli. Elity fáze jdou s prvním rojem prvního intervalu fáze. |
| Chování | Štítonoš a Kapitán `siege`, Zvěd `flank`, Mušketýr `skirmish`, Kaplan `support`, Kopiník `charge`. Role roje (lovec, obléhatel) dál určuje cíl; `flank` cílí na hrdinu vždy. |
| `flank` | Dál než 300 od hrdiny jde směrem k němu otočeným o 45° (sudý slot vlevo, lichý vpravo), takže přichází z boku; do 300 jde přímo. |
| `skirmish` | Cílí-li na hrdinu, je blíž než 0,6 × dosah a útok se mu přebíjí, couvá od hrdiny. Jinak jako `siege`. Na hrad necouvá. |
| `support` | Hledá nejbližšího živého spojence jiného chování do 600. Je-li dál než 250, jde k němu; jinak stojí. Hrdina do 350: utíká od něj. Bez spojence se chová jako `siege`. Útočí a léčí jako dnes. |
| `charge` | Cílí-li na hrdinu ve vzdálenosti 300–700 a nemá přebití: 0,5 s stojí (výstraha), pak běží po přímce ve směru zamčeném na konci výstrahy rychlostí ×2,5 nejdál 900. Dotkne-li se hrdiny, dá útok ×2 a nájezd končí. Přebití 6 s. Omráčení nájezd ruší. Úskok hrdiny z přímky znamená, že mine. |
| Aura kapitána | Nepřátelé do 400 od živého kapitána (kromě kapitánů) mají rychlost ×1,25 a poškození ×1,25. Více kapitánů se nesčítá. |
| Šipky | Při příchodu roje se na 4 s ukáže na okraji obrazovky šipka jeho směrem: červená `0xd94a4a` obléhatelé, fialová `0xb84ad8` lovci. Žádná oranžová. |
| Hrobník | `grave-grasp.healPerHit` klesá z 50–300 na 10, 20, 30, 40, 60. |
| Obtížnost | Cíle v Tasku 6. Smí se měnit i `scaling.yaml` `enemies.hp` (0,3 až 0,6), protože všichni hrdinové jsou silní stejným směrem. |

**Noví hrdinové** (zdroj a `mapName` jen v `design/`):

| id | zdroj | EN / CS | role EN / CS | tint / tělo |
|---|---|---|---|---|
| mistwarden | O00H Ghost | Mistwarden / Strážce mlh | „Caster. Wards and zones that grind crowds down.“ / „Kouzelník. Strážci a zóny, které drtí davy.“ | `0x2a3a4d` / `0x8fb8d9` |
| sparkshot | O010 Kigami | Sparkshot / Jiskrostřelec | „Gunner. Fast shots and rocket bursts.“ / „Střelec. Rychlé výstřely a raketové salvy.“ | `0x4d4410` / `0xe0d24a` |
| redcleaver | O00U Meater | Redcleaver / Rudý sekáč | „Melee butcher. Wide blows at close range.“ / „Řezník na blízko. Široké rány zblízka.“ | `0x551a1a` / `0xd94a4a` |
| tidecaller | O00N SeaSea | Tidecaller / Přílivová vědma | „Tide mage. Waves that stun and push through.“ / „Mág přílivu. Vlny, které omračují a prorážejí.“ | `0x10305a` / `0x3b8fe0` |

**Jejich kouzla** (první tři podpisová, čtvrté ultimátka; „skript“ = hodnoty jsou v triggeru, viz Task 5):

| hrdina | id | zdroj | EN / CS | druh / cílení | parametry |
|---|---|---|---|---|---|
| mistwarden | soul-burst | A010 | Soul Burst / Výbuch duší | area / densest_cluster | damage DataA, radius area, range range |
| | wisp-ward | A00X | Wisp Ward / Bludný strážce | summon / densest_cluster | count DataA, duration, range; design: damage 101, attackRange 600, attackInterval 0.5, maxAlive 2, 4, 4, 6, 6 |
| | mist-surge | A00Y | Mist Surge / Příval mlhy | ticking_area / densest_cluster | tickDamage DataB, radius area; design: ticksPerSecond 1, duration 4 |
| | wailing-wave | A00Z | Wailing Wave / Kvílivá vlna | nova / around_self | radius area, slow DataC, slowSeconds duration; damage skript `Trig_Ghost_Angry_*` (náhradní 3000, 8000) |
| sparkshot | rocket-fan | A06L | Rocket Fan / Raketový vějíř | nova / around_self | skript `Trig_Fan_of_Rocket_*` (náhradní damage 200, 400, 800, 1600, 3200; radius 600) |
| | searing-rounds | A06M | Searing Rounds / Žhavé náboje | on_hit / on_attack | bonusDamage DataA |
| | quickstep | A06N | Quickstep / Hbitý krok | aura / self | moveSpeedBonus DataA, attackSpeedBonus DataB |
| | beam-swarm | A06P | Beam Swarm / Roj paprsků | ticking_area / around_self | radius area; design: tickDamage 150, 400; ticksPerSecond 4; duration 8 |
| redcleaver | cleaver-toss | A05K | Cleaver Toss / Hod sekáčkem | line / move_direction | skript `Trig_Xich_Continue_1_*` (náhradní damage 300, 600, 900, 1800, 2700; length 1200; width 250); design waveSpeed 1600 |
| | blood-fan | A05L | Blood Fan / Krvavý vějíř | nova / around_self | damage DataA, radius area |
| | swift-pace | A007 | (existuje, sdílí ho s Noční čepelí) | | |
| | rot-field | A05M | Rot Field / Pole hniloby | ticking_area / densest_cluster | radius area, duration duration; design: tickDamage 150, 500 (mapa bere % života, hra % neumí); ticksPerSecond 1 |
| tidecaller | crushing-wave | A03M | Crushing Wave / Drtivá vlna | line / move_direction | damage DataA, length DataC, width area; design waveSpeed 1600 |
| | stunning-tide | A00Q | Stunning Tide / Omračující příliv | on_hit / on_attack | chance DataA (17,5 %; zapiš ve tvaru, který `on_hit` čeká), bonusDamage DataC, stunSeconds duration |
| | riptide | A0BD | Riptide / Zpětný proud | projectile / nearest_elite_first | range range; damage skript `Trig_Wave_Form_Move_*` (náhradní 400, 800, 1600, 3200, 6400); design speed 1400 |
| | drowned-lake | A04P | Drowned Lake / Utopené jezero | ticking_area / densest_cluster | radius area; skript `Trig_Dead_Lake_Cast_*`, `Trig_Special_Func018C` (náhradní tickDamage 300, 900; ticksPerSecond 2; duration 8) |

Popisy kouzel pro hráče (EN / CS) napiš vlastní, jednou větou, ve stylu stávajících v `design/abilities.yaml`.

## Global Constraints

**Clean room (AGENTS.md):** kódy a jména z mapy (`O00H`, `Ghost` …) jen v `tools/`, `design/` a `docs/`. Nikdy v `client/`, `sim/`, `data/generated/` ani v textech pro hráče. Do gitu nesmí `data-source/`, `*.w3x` ani `war3map.*`.

**Simulace (`sim/`):** čistá a deterministická. 30 kroků za sekundu, náhoda jen z `run.rng`, žádné transcendentní funkce `Math` ani `**`; směry přes vektory a `Math.sqrt`. `Run.step()` v běžném kroku nealokuje. Každé nové pole `EnemyStore` a `Run` se míchá do `stateHash`. Hlídá to `tests/repo-guard.test.ts`.

**Klient:** WebGPU s fallbackem na WebGL2. Texty jen v `client/ui/messages-en.ts` a `messages-cs.ts`. Pohledy za snímek nealokují. Žádná oranžová.

**Data:** `data/generated/*.json` se ručně neupravuje. Změna jde do `design/*.yaml`, pak `npm run data:build -- --source data-source/v20.75/out --out data/generated`. Export chybí? `npm run map:extract -- <mapa.w3x> v20.75` (mapa je soubor v projektu na claude.ai, `X_Hero_Siege_F-Day_v20.75_AI.w3x`).

**Testy:** testy simulace si samy nastavují pravidla, která ověřují, a očekávání počítají ze vstupních dat. Testy bez spawnů volají `silenceSpawns(data)`.

**Kód:** anglicky, malé soubory s jednou rolí, Conventional Commits, commit až po `npm run check`. Větev `phase-2b2`, push po každém tasku.

## Review Focus

1. **Roj u okraje a u hradu:** každý člen roje se objeví uvnitř arény a mimo kruh hradu, i při `spread` větším než vzdálenost k okraji. Test: Task 1, `pack members stay inside the arena`.
2. **Nájezd, který ztratí cíl:** hrdina uskočí, kopiník je omráčen nebo dojede na okraj arény: nájezd skončí, přebití se nastaví a kopiník se vrátí k běžné chůzi. Testy: Task 3, `a charge that misses ends after its distance` a `a stun cancels the charge`.
3. **Zvěd a stojící hrdina:** obíhání nesmí být nekonečné; zvěd dojde ke stojícímu hrdinovi a zaútočí do 12 s z 2400. Test: Task 2, `a flanker reaches a standing hero`.
4. **Kaplan, kterému zemřel roj:** bez spojence do 600 jde dál na svůj cíl jako `siege`, nestojí. Test: Task 2, `a support without allies walks to its target`.
5. **Kapitán zemře:** posílení zmizí v dalším kroku a dva kapitáni se nesčítají. Testy: Task 3, `the aura ends with the captain` a `two captains do not stack`.

---

### Task 1: Aréna dokola a více rojů naráz

**Files:**
- Modify: `data/schema/rules.ts`, `data/schema/schema.test.ts`, `design/rules.yaml`, `data/generated/rules.json` (vygenerovat), `sim/{spawner.ts, spawner.test.ts, enemies.ts, run.ts, hash.ts, events.ts}`, `sim/debug-spawn.ts`, `client/render/scene.ts`, testy a pomocníci s `gates` nebo `gateRadius` (`sim/abilities/{line,slots}.test.ts`, `sim/{enemy-ai,enemy-heal,hero-combat,knockback}.test.ts`, `sim/testing/{ability-run,progression-run}.ts`, `tools/data-build/data-build.test.ts`)
- Create: `sim/spawn-direction.ts`, `sim/spawn-direction.test.ts`

**Interfaces:**
```ts
// data/schema/rules.ts
arena: { width, height, castle: Point, heroStart: Point, spawn: { radius: positive, spread: positive } }   // gates, gateRadius pryč
phases[i]: { mix, pack, packs: int 1..3, hunterShare, elites }
// refine: spawn.radius + spread ≤ min(width, height) / 2, jinak "arena.spawn: the ring does not fit the arena"
// sim/spawn-direction.ts
/** Writes a random unit vector into dirX/dirY (module-level out values). */
export function randomDirection(rng: Rng): void;  export let dirX: number;  export let dirY: number;
/** Rotates (x, y) by k × 360° / count for count 1..3; writes dirX/dirY. */
export function rotatedDirection(x: number, y: number, k: number, count: number): void;
// EnemyStore.spawn(type, role, x, y, hp, damageScale, tick) – pole `gate` mizí;  Run.nextGate mizí
// sim/events.ts: PackSpawn: 13 – a = role, value = počet členů, x/y = střed roje
```

**Algoritmus `spawnEnemies(run)`** (pořadí čerpání z RNG je součást determinismu):
```
if (tick < nextPackTick) return;  nextPackTick = tick + max(1, round(everySeconds × 30))
elites = elitePhase !== phaseIndex ? phase.elites : 0;  elitePhase = phaseIndex
randomDirection(rng) → (bx, by)
for p in 0 .. phase.packs − 1:
  rotatedDirection(bx, by, p, phase.packs) → (ux, uy)
  size = pack.min + floor(rng() × (pack.max − pack.min + 1))
  role = rng() < hunterShare ? Hunter : Sieger
  cx = castle.x + ux × spawn.radius;  cy = castle.y + uy × spawn.radius
  n = size + (p === 0 ? elites : 0);  half = spawn.spread × max(1, sqrt(n / 8));  spawned = 0
  for k in 0 .. n − 1:
    if (store.aliveCount ≥ store.capacity) break
    type = (p === 0 && k < elites) ? eliteType : pickType(table, rng())
    x = clamp(cx + (rng() × 2 − 1) × half, ±(width / 2 − collision));  y stejně
    store.spawn(...);  stats.spawned++;  spawned++
  if (spawned > 0) events.push(PackSpawn, role, spawned, cx, cy)
```

**`design/rules.yaml`** (výchozí, Task 6 ladí): `arena: { width: 6000, height: 6000, castle: { x: 0, y: 0 }, heroStart: { x: 0, y: 500 }, spawn: { radius: 2400, spread: 150 } }` a fáze:

| fáze | mix | pack min–max / s | packs | hunterShare | elites |
|---|---|---|---|---|---|
| 1 | shieldbearer 8, scout 3 | 6–10 / 6 | 1 | 0.25 | 0 |
| 2 | shieldbearer 6, scout 3, musketeer 2 | 8–12 / 6 | 1 | 0.3 | 0 |
| 3 | shieldbearer 5, scout 3, musketeer 2, chaplain 1, lancer 1 | 8–12 / 6 | 2 | 0.3 | 1 |
| 4 | shieldbearer 4, scout 3, musketeer 3, chaplain 2, lancer 2 | 10–14 / 6 | 2 | 0.35 | 1 |
| 5 | shieldbearer 4, scout 2, musketeer 3, chaplain 2, lancer 3 | 10–14 / 5 | 2 | 0.35 | 2 |
| 6 | shieldbearer 3, scout 3, musketeer 3, chaplain 2, lancer 3 | 10–14 / 5 | 3 | 0.4 | 2 |

- [ ] **Step 1: Testy**
  - `spawn-direction.test.ts`: `randomDirection gives unit vectors` (1000 losů, délka 1 ± 1e-9); `directions cover all four quadrants`; `rotatedDirection for two packs is the opposite`; `for three packs the directions are 120° apart` (skalární součin sousedů −0,5 ± 1e-9); `count 1 keeps the direction`.
  - `spawner.test.ts` (přepiš testy bran, ostatní zachovej): `a pack appears on the ring around the castle` (střed z `PackSpawn` je `spawn.radius` od hradu ± 1e-6 a členové do `half` od středu); `packs of one interval come from different sides` (`packs: 2` → dva `PackSpawn` se středy naproti sobě; `packs: 3` → tři); `each pack has its own role and size`; `elites come once per phase with the first pack of its first interval`; `pack members stay inside the arena` (`spawn.radius` 2900, `spread` 400, aréna 6000: všechna |x|, |y| ≤ 3000 − collision); `a volley at the cap fills only free slots and banks nothing`; `same seed spawns at the same positions`.
  - `schema.test.ts`: `packs` 0 a 4 neprojdou; kruh mimo arénu neprojde s hláškou výše; `arena.gates` je neznámý klíč.
- [ ] **Step 2:** Spusť `npx vitest run sim/spawner.test.ts sim/spawn-direction.test.ts data/schema/schema.test.ts`, musí padat.
- [ ] **Step 3: Implementace** schématu, směrů, spawneru, `EnemyStore.spawn` bez `gate` a všech volajících. `debugSpawnEach` dál staví řadu 600 severně od hrdiny. `scene.ts`: bez cest a bran; podlaha podle arény, hrad uprostřed a tenký tmavý prstenec (`RingGeometry`, barva `0x2a3140`) na `spawn.radius`.
- [ ] **Step 4:** Uprav `design/rules.yaml`, `data:build`, `npm run check`, `npm run build`, `npm run e2e -- --project=webgl2-fallback`. Testy balance v `sim/bot.test.ts`, které po změně arény neprojdou, označ `it.skip` s komentářem `re-enabled in Task 6`.
- [ ] **Step 5:** Commit `feat(sim): castle in the middle; packs arrive from every side`.

---

### Task 2: Chování podle typu – flank, skirmish, support

**Files:**
- Create: `sim/enemy-steer.ts`, `sim/enemy-steer.test.ts`
- Modify: `data/schema/enemy.ts`, `design/enemies.yaml`, `tools/data-build/{load.ts, map-enemies.ts, data-build.test.ts}`, `data/generated/enemies.json` (vygenerovat), `data/generated.test.ts`, `sim/enemy-ai.ts`, `sim/enemy-ai.test.ts`

**Interfaces:**
```ts
// data/schema/enemy.ts
behavior: z.enum(["siege", "flank", "skirmish", "support", "charge"])     // povinné, za attack
// design/enemies.yaml: behavior u každého typu podle tabulky „Co plán rozhoduje“
// sim/enemy-steer.ts
export const Behavior = { Siege: 0, Flank: 1, Skirmish: 2, Support: 3, Charge: 4 } as const;
export const FLANK_STRAIGHT_RANGE = 300, SKIRMISH_KEEP = 0.6, SUPPORT_SEEK = 600, SUPPORT_HOLD = 250, SUPPORT_FLEE = 350;
/** Walking direction of enemy i towards its target at unit vector (ux, uy), distance dist, attack reach `reach`.
 *  Writes steerX/steerY (unit vector or zero) and steerHold (true: the enemy may not attack this step). */
export function steer(run: Run, i: number, targetsHero: boolean, ux: number, uy: number, dist: number, reach: number): void;
export let steerX: number;  export let steerY: number;  export let steerHold: boolean;
// Run: readonly enemyBehavior: Uint8Array (index typu → Behavior), postavené v konstruktoru
```
`updateEnemies`: `flank` cílí na hrdinu bez ohledu na roli. Po výpočtu cíle zavolá `steer`; útočí, když je cíl v dosahu a `steerHold` je false, jinak jde rychlostí `walk` ve směru `steer`. Couvající mušketýr má `steerHold` true. Kaplan, který stojí u spojence, má nulový směr a útočit smí. Spojence pro `support` hledá `run.grid` dotazem s poloměrem 600 (modulový buffer, bez alokace), při shodě vzdálenosti vyhrává nižší slot.

- [ ] **Step 1: Testy** `enemy-steer.test.ts` (tichý běh, nepřátelé přes `run.enemies.spawn`, hrdina stojí):
  - `a flanker approaches at an angle` (zvěd 1500 od hrdiny: po 30 krocích je blíž a zároveň se odchýlil od spojnice o víc než 100; sudý a lichý slot na opačné strany);
  - `a flanker reaches a standing hero` (z 2400 zaútočí do 360 kroků);
  - `a flanker hunts the hero even in a sieger pack`;
  - `a skirmisher backs off while it reloads` (mušketýr 0,3 × dosah od hrdiny po výstřelu: vzdálenost roste, dokud se přebíjí, a v tom čase nevystřelí);
  - `a skirmisher does not back off from the castle`;
  - `a support follows its nearest ally and holds behind it` (kaplan 500 od štítonoše: přiblíží se na ≤ 250 a zastaví);
  - `a support flees a hero that comes close` (hrdina 200 od kaplana: vzdálenost roste);
  - `a support without allies walks to its target`;
  - `siege walks straight to its target` (stejná dráha jako před změnou).
  - `data-build.test.ts`: `copies the behavior of a design entry`, chybějící `behavior` je chyba `design/enemies.yaml: <id>: missing behavior`. `generated.test.ts`: chování šesti typů podle tabulky.
- [ ] **Step 2:** Testy musí padat. Implementuj, `data:build`.
- [ ] **Step 3:** `npm run check` (replay testy hlídají determinismus). Commit `feat(sim): enemy behaviours: flankers, skirmishers and supports`.

---

### Task 3: Nájezd kopiníka a aura kapitána

**Files:**
- Create: `sim/enemy-charge.ts`, `sim/enemy-charge.test.ts`, `sim/enemy-aura.ts`, `sim/enemy-aura.test.ts`
- Modify: `data/schema/enemy.ts`, `design/enemies.yaml`, `tools/data-build/{load.ts, map-enemies.ts}`, `data/generated/enemies.json`, `sim/{enemies.ts, enemy-ai.ts, events.ts, hash.ts, run.ts}`

**Interfaces:**
```ts
// data/schema/enemy.ts (volitelné, za heal)
charge: { minRange, maxRange, windupSeconds, speedMultiplier, damageMultiplier, distance, cooldownSeconds }  // vše positive, minRange < maxRange
aura:   { radius: positive, moveSpeed: nonNegative, damage: nonNegative }
// design/enemies.yaml: lancer.charge  { minRange: 300, maxRange: 700, windupSeconds: 0.5, speedMultiplier: 2.5, damageMultiplier: 2, distance: 900, cooldownSeconds: 6 }
//                      captain.aura   { radius: 400, moveSpeed: 0.25, damage: 0.25 }
// EnemyStore: chargeState: Uint8Array (0 none, 1 windup, 2 run), chargeTicks: Int32Array, chargeCooldown: Int32Array,
//             chargeDirX/chargeDirY: Float64Array, buffed: Uint8Array – vše nulováno ve spawn
export const Charge = { None: 0, Windup: 1, Run: 2 } as const;
/** Runs the charge of enemy i if it has one. Returns true when the charge owns this step
 *  (the caller skips targeting, steering and separation); writes chargeVX/chargeVY. */
export function updateCharge(run: Run, i: number, targetsHero: boolean, heroDist: number): boolean;
/** Marks e.buffed for every enemy near a living enemy with an aura. Called first in updateEnemies, after the grid is built. */
export function updateEnemyAuras(run: Run): void;
// sim/events.ts: EnemyCharge: 14 – a = slot, value = 0 výstraha / 1 rozběh, x/y = pozice, u/v = směr (při výstraze směr k hrdinovi)
```
Pravidla:
- Start: `behavior === charge`, cílí na hrdinu, `minRange ≤ heroDist ≤ maxRange`, `chargeCooldown === 0`, není omráčen → `Windup`, `chargeTicks = round(windupSeconds × 30)`, událost s `value 0`.
- Konec výstrahy: zamkni směr k hrdinovi, `Run`, `chargeTicks = ceil(distance / (moveSpeed × speedMultiplier × TICK_SECONDS))`, událost s `value 1`.
- Běh: rychlost = směr × `moveSpeed × speedMultiplier` (zpomalení se násobí jako u chůze). Dotyk (`vzdálenost ≤ collision + hero.collision + 20`): `damageHero` s hodem × `damageScale × damageMultiplier × (buffed ? 1 + aura.damage : 1)` po brnění, `lastAttackTick`, `attackCooldown` jako po útoku, konec. Konec i po vypršení kroků. Každý konec nastaví `chargeCooldown = round(cooldownSeconds × 30)`.
- Omráčení v jakémkoli stavu: `None` a přebití. Odhození se k pohybu přičítá jako jinde. Hranice arény a kruh hradu platí.
- Aura: `buffed` násobí `walk` (1 + `moveSpeed`) a hod poškození (1 + `damage`) v `updateEnemies`. Hodnoty jsou z prvního typu s `aura` v datech (dnes jen kapitán): `Run.auraType: number`, −1 když žádný není. Typ s aurou se neposiluje.

- [ ] **Step 1: Testy**
  - `enemy-charge.test.ts`: `a lancer winds up, then charges in a straight line` (v rozsahu: po dobu výstrahy stojí, pak se za krok posouvá o `moveSpeed × 2.5 / 30`); `a charge hit deals multiplied damage and ends` (hrdina stojí; HP klesne o hod × 2 po brnění, stav `None`, přebití nastaveno); `a charge that misses ends after its distance` (hrdina se po výstraze přesune o 600 kolmo: žádný zásah, ujetá dráha ≤ `distance` + 1 krok, pak běžná chůze); `a stun cancels the charge`; `no charge outside the range or on cooldown`; `a lancer in a sieger pack walks to the castle` (bez agra žádný nájezd); `EnemyCharge carries slot, phase, position and direction`; `a charge stops at the arena edge`.
  - `enemy-aura.test.ts`: `enemies near a captain walk and hit harder` (posun za krok × 1,25; poškození hradu při pevném `damageMin === damageMax` × 1,25); `the aura ends with the captain` (krok po `kill` už bez posílení); `two captains do not stack`; `a captain does not buff itself or another captain`; `out of range: no buff`.
  - `schema.test.ts`: `charge.minRange ≥ maxRange` neprojde.
- [ ] **Step 2:** Testy musí padat. Implementuj, `data:build`.
- [ ] **Step 3:** `npm run check`. Commit `feat(sim): lancers charge and captains lead`.

---

### Task 4: Klient – šipky rojů, výstraha nájezdu, kruh aury

**Files:**
- Create: `client/ui/pack-arrows.ts`, `client/ui/pack-arrows.test.ts`
- Modify: `client/render/enemy-fx.ts`, `client/main.ts`, `client/game/debug.ts`, styl HUD (soubor, kde je dnes CSS HUD), `e2e/game.spec.ts`

**Interfaces:**
```ts
// client/ui/pack-arrows.ts – 6 předem vytvořených prvků .pack-arrow v #hud, žádná alokace za snímek
export const ARROW_SECONDS = 4;
/** Screen position of an arrow for a pack at world offset (dx, dy) from the hero: on an ellipse
 *  0.42 × width by 0.42 × height around the screen centre; `angle` in radians for CSS rotate. */
export function arrowPlacement(dx: number, dy: number, width: number, height: number): { x: number; y: number; angle: number };
export class PackArrows implements RunView { /* PackSpawn → arrow for ARROW_SECONDS; hidden when the pack centre is on screen (|dx|, |dy| under half the view) */ }
// EnemyFx: EnemyCharge value 0 → čára (BoltFx) od kopiníka ve směru (u, v) dlouhá charge.distance, barva 0xff5a5a, život = windupSeconds
//          kruh (RingFx) pod každým živým nositelem aury, poloměr aura.radius, barva 0xb84ad8, průhlednost 0.25
// GameSnapshot: packArrows: number (viditelné šipky), charging: number (nepřátelé s chargeState !== 0)
```
Šipka je CSS trojúhelník, 18 px, červená `#d94a4a` pro obléhatele a fialová `#b84ad8` pro lovce, s `aria-hidden`.

- [ ] **Step 1: Testy** `pack-arrows.test.ts`: `arrowPlacement points east for a pack to the east` (dx > 0, dy = 0 → x = střed + 0,42 × šířka, y = střed, angle 0); `north is up on the screen` (dy > 0 → y nad středem); `a zero offset does not divide by zero` (vrací střed, angle 0).
- [ ] **Step 2:** Test musí padat. Implementuj `PackArrows`, rozšíření `EnemyFx`, snapshot a zapojení v `main.ts`.
- [ ] **Step 3: E2E:** `pack arrows point at a new pack` (`/?seed=1&speed=2&lang=en`, Start, do 5 s `__game.packArrows ≥ 1`); `every enemy type renders without errors` dál prochází; nový `a lancer charge renders without errors` (`debug=1`, `spawnEach()`, do 6 s `__game.charging ≥ 1`, screenshot, žádná chyba konzole).
- [ ] **Step 4:** `npm run check`, `npm run build`, `npm run e2e -- --project=webgl2-fallback`. Commit `feat(client): pack arrows, charge telegraph and the captain's aura ring`.

---

### Task 5: Čtyři noví hrdinové

**Files:**
- Modify: `design/{heroes.yaml, abilities.yaml}`, `data/generated/{heroes,abilities}.json` (vygenerovat), `data/generated.test.ts`, `client/render/hero-tints.ts`, `client/ui/menu.ts` a jeho styl (mřížka pro 8 karet), `sim/abilities/ticking-area.ts` (+ test), `sim/bot.test.ts`, `e2e/game.spec.ts`, `AGENTS.md`, `README.md`

**Interfaces:**
- Hrdinové a kouzla přesně podle tabulek v oddílu „Co plán rozhoduje“ (id, zdroj, jména, druh, cílení, parametry, barvy).
- `ticking_area` s cílením `around_self`: střed je pozice hrdiny při seslání. Když to `sim/abilities/ticking-area.ts` neumí, přidej větev a test `a ticking area around the hero is centred on the hero`.
- URL parametr `hero` a `sim:run --hero` přijímají 8 id.

**Skriptová kouzla** (`wailing-wave`, `rocket-fan`, `cleaver-toss`, `riptide`, `drowned-lake`): přečti celý trigger ve `data-source/v20.75/extract/war3map.j` (jména funkcí jsou v tabulce; hledej i `Trig_<jméno>_Actions`). Hodnoty po úrovních zapiš jako `{ design: [...] }` a do `review.notes` napiš, z kterých funkcí a řádků jsou, stejně jako u `grave-grasp`. Když trigger číslo pro parametr nedává, použij náhradní hodnotu z tabulky a do `review.notes` to napiš. `wisp-ward`: zkus najít jednotku strážce v `units.json` (útok, dosah, interval × 0,5); když nejde určit, platí design hodnoty z tabulky.

- [ ] **Step 1: Testy**
  - `generated.test.ts`: `there are eight heroes` (id v pořadí: 4 stávající, pak mistwarden, sparkshot, redcleaver, tidecaller); každý má 3 podpisová kouzla a ultimátku, které existují; žádný kód mapy v datech (stávající guard).
  - `hero-tints.test.ts` (nový): každý hrdina z `heroes.json` má vlastní tint i barvu těla a žádné dvě barvy těla nejsou stejné.
  - `sim/bot.test.ts`: test `every hero casts all its abilities in a run` (60 s, seed 1, `debug` úroveň kouzel 1: každý slot aspoň jednou sešle nebo je pasivní) pro všech 8.
  - E2E: `the menu lists eight heroes and starts each of them` (pro 4 nové: `/?hero=<id>&seed=1&speed=4&duration=20`, Start, běh doběhne bez chyby konzole).
- [ ] **Step 2:** Testy musí padat. Zapiš data, `data:build`, barvy, menu.
- [ ] **Step 3:** `npm run check`, `npm run build`, `npm run e2e -- --project=webgl2-fallback`, `npm run sim:run -- --hero all --runs 3` (výstup do reportu; balanc se ladí v Tasku 6).
- [ ] **Step 4:** Commit `feat(data): four new heroes: Mistwarden, Sparkshot, Redcleaver and Tidecaller`.

---

### Task 6: Autopilot, ladění obtížnosti, dokumentace

**Files:**
- Modify: `sim/{bot.ts, bot.test.ts}`, `tools/sim-run/{run.ts, run.test.ts}`, `design/{rules.yaml, enemies.yaml, abilities.yaml, scaling.yaml}`, `data/generated/*.json`, `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `docs/{STATUS.md, DECISIONS.md}`, `docs/superpowers/specs/2026-11-04-defense-webgame-design.md` (oddíl 3.1: aréna dokola)

**Interfaces:**
```ts
// sim/bot.ts – stanoviště je hrad, ne bod před bránami
export const DEFEND_RADIUS = 1400;   // nepřítel blíž hradu než toto je hrozba
export const HOME_OFFSET = 400;      // bez hrozby stojí (castle.x, castle.y + 400)
// cíl bota: živý nepřítel nejblíž hradu do DEFEND_RADIUS; jinak nejbližší nepřítel hrdiny do CHASE_DISTANCE; jinak domů.
// Ústup (RETREAT_DISTANCE) a pravidla pro střelce beze změny. Při chargeState === Windup do 700 uhne kolmo ke směru nájezdu (Action dash, když není přebití).
// RunSummary: + castleHpPercent: number;  formatSummary: "... castle 62%, hero low 31%"
```

**Cíle** (`npm run sim:run -- --hero all --runs 5` a totéž s `--idle`), pro každého z 8 hrdinů:
- autopilot vyhraje 2 až 4 z 5;
- běh bez vstupu prohraje do 2:30;
- `hero low` pod 50 % aspoň ve 4 z 5 běhů;
- hrad na konci vyhraných běhů v průměru pod 60 %;
- průměrná úroveň 10–18;
- za běh přijde 700–1200 nepřátel.

**Co smíš měnit:** fáze, `castle`, `progression` a `arena.spawn` v `rules.yaml`; `multipliers`, `xp`, `heal`, `charge` a `aura` v `enemies.yaml`; `enemies.hp` (0,3–0,6) a `enemies.moveSpeed` ve `scaling.yaml`; design hodnoty nových kouzel z Tasku 5; `grave-grasp.healPerHit` nastav na 10, 20, 30, 40, 60. Ostatní kouzla a hrdiny jen tehdy, když jeden hrdina cíle nesplní a zbylých sedm ano. Když cíle nejdou splnit, ohlas DONE_WITH_CONCERNS s tabulkou čísel.

- [ ] **Step 1: Testy** `bot.test.ts`: `the bot walks to the enemy nearest to the castle`; `the bot goes home when nothing threatens the castle`; `the bot sidesteps a charge`; balanc pro 8 hrdinů: `MIN_BOT_WINS = 2`, `MAX_BOT_WINS = 4`, `IDLE_LOSES` všude `true` s časem do 150 s, `hero low < 50 %` ve ≥ 4 seedech, `a run sees between 700 and 1200 enemies`, `a full run stays fast` (300 s do 8 s). Zruš `it.skip` z Tasku 1. `run.test.ts`: `formatSummary` s `castle %`.
- [ ] **Step 2:** Implementuj bota a souhrn, dolaď čísla. Výstup obou příkazů před laděním a po něm vlož do reportu.
- [ ] **Step 3: Dokumentace.** `ARCHITECTURE.md`: kruhový spawn, chování, nájezd, aura, pořadí v `updateEnemies`, `PackArrows`. `AGENTS.md` a `README.md`: 8 hrdinů v `hero`, `__game.packArrows`, `__game.charging`. `docs/DECISIONS.md`: tabulka „Co plán rozhoduje“ a výsledky ladění. Spec 3.1: hrad uprostřed, roje dokola. `docs/STATUS.md`: 2b-2 hotová, další krok Vizuál A.
- [ ] **Step 4:** `npm run check`, `npm run build`, `npm run e2e -- --project=webgl2-fallback`, `npm run sim:run -- --hero all --runs 5`. Commit `feat: bot defends the castle; phase 2b-2 balance; docs`. Otevři PR `Phase 2b-2: ring arena, enemy AI and four heroes` (přes `gh api`, viz STATUS).

---

## Hotovo, když

- `npm run check`, e2e a CI na PR procházejí a `sim:run` splňuje cíle z Tasku 6.
- Petr odehraje běh: roje chodí ze všech stran a dostanou se k němu i k hradu, typy se chovají rozdílně (zvědi z boku, mušketýři couvají, kopiníci najíždějí), první pokusy často prohraje a v menu je 8 hrdinů.

## Odloženo

- Vizuál A a B (modely, zem, hrad), zvuky nových efektů.
- Minimapa, obtížnosti na výběr, 20 fází, frakce, bossové (zbytek 2b).
- Nové druhy kouzel (řetěz, okamžitý zásah, časovaná proměna), a tedy hrdinové, kteří je potřebují.
