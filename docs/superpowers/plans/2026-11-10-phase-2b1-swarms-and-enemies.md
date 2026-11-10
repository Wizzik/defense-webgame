# Fáze 2b-1: roje a typy nepřátel – implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nepřátelé chodí v rojích (skupiny 6–20 z brány), je jich 6 typů s čísly z lidské vlny mapy a běh trvá 5 minut v 6 fázích, takže je hrdina v ohrožení. K tomu malá výkonová kontrola a varování, když prohlížeč kreslí bez grafické karty.

**Architecture:**
- Spawner místo stálého toku posílá skupiny: každá fáze má váhy typů (`mix`), velikost a interval skupiny, podíl lovců a počet elit. Skupina má jednu bránu a jednu roli.
- Typy jsou v `design/enemies.yaml`: zdroj z mapy plus volitelné násobitele (běžec a elita jsou varianty jednotek mapy). Útok má druh `melee` nebo `ranged`; na dálku se zasahuje okamžitě jako u hrdinů.
- Kaplan léčí zraněné nepřátele v dosahu. Je to nový systém `healEnemies` hned po `updateEnemies`.
- Klient barví každý typ jinak (atribut instance v jedné instancované síti), velikost dál určuje `collision`. Výstřely a léčení kreslí nový pohled `EnemyFx`.

**Tech Stack:** beze změny a bez nových závislostí ani assetů: Node 22, TypeScript 7.0.2, Vite 8.3.5, Vitest 5.1.0, Three.js 0.187.0, zod 4.6.7, yaml 2.9.1, tsx 4.23.15, @playwright/test 1.63.0.

**Spec:** `docs/superpowers/specs/2026-11-04-defense-webgame-design.md`, oddíly 3.1 (průběh běhu), 3.2 (nepřátelé, strop 150) a 6 (čitelné siluety a barvy). Navazuje na plán 2a (`2026-11-06-phase-2a-heroes-and-abilities.md`) a na `docs/STATUS.md` (playtest 2a a měření fps 2026-11-10).

## Fáze 2b po částech

| Část | Obsah | Hotovo, když |
|---|---|---|
| **2b-1 Roje a typy** (tento plán) | spawner ve skupinách, 6 typů nepřátel, léčení kaplana, 5minutový běh v 6 fázích, kontrola výkonu, varování před softwarovým vykreslováním | běh je nebezpečný a hrdinové se na něm vyrovnají |
| Vizuál A | zem, mlha, stíny, hrad a brány z CC0, CC0 postavy místo robota, modely typů do VAT | – |
| Vizuál B | vlastní modely hrdinů (Tripo nebo Blender) | – |
| 2b zbytek | 20 fází, 4 frakce, elitní nápory, bossové, obtížnosti | 16:40 běh s bossem jde dohrát |

## Co plán rozhoduje (Petr schválil 4 body 2026-11-10, zbytek ke kontrole)

| Téma | Rozhodnutí |
|---|---|
| Typy (Petr) | 4 lidé z mapy s jejich čísly + běžec + elita. Elita je zatím jen velikost a barva. |
| Útok na dálku (Petr) | Okamžitý zásah jako u hrdinů, střela je jen efekt. Uhnout jde jen tak, že hrdina odejde z dosahu. |
| Délka (Petr) | 5 minut, 6 fází po 50 s. |
| Kaplan (Petr) | Léčí zraněné nepřátele v dosahu, sebe taky. |
| Jména | Štítonoš (Footman), Zvěd (běžec, varianta Footmana), Mušketýr (Rifleman), Kaplan (Priest), Kopiník (Knight), Kapitán (elita, varianta Knighta). EN: Shieldbearer, Scout, Musketeer, Chaplain, Lancer, Captain. |
| Varianty | Zvěd: HP ×0,5, rychlost ×1,5, velikost ×0,8, poškození ×0,6. Kapitán: HP ×3, poškození ×1,5, velikost ×1,5, rychlost ×0,8. Násobí se čísla mapy, pak platí `scaling.yaml`. |
| Kopiník | Rychlost z mapy (300, tedy rychlejší než Štítonoš). Tank je díky HP (4,4× Štítonoš), ne pomalosti. |
| Léčení kaplana | 8 HP × síla nepřítele v čase, každou 1 s, dosah 450, cíl s největší ztrátou HP. Mapa používá výchozí Heal z WC3 (25 HP, mana); 8 ≈ 25 × 0,3 jako HP nepřátel. |
| Skupiny | Jedna skupina = jedna brána (brány se střídají) a jedna role (lovci s pravděpodobností `hunterShare`). Všichni se objeví naráz ve čtverci kolem brány, jehož poloviční strana je `gateRadius × max(1, √(velikost/8))`. První skupina ve 2 s. |
| Strop 150 | Skupina se vejde jen do volných slotů, zbytek propadne a nic se neodkládá na později (žádná dávka po uvolnění). |
| Elity | `elites` kusů Kapitána přijde s první skupinou každé fáze, před ostatními (při stropu mají přednost). Elitní nápory podle spec 3.1 (3:00, 6:00 …) přijdou se zbytkem 2b. |
| XP | Štítonoš 1, Zvěd 1, Mušketýr 2, Kaplan 2, Kopiník 4, Kapitán 12 |
| Barvy | Štítonoš červená `0xc23b3b`, Zvěd žlutá `0xd8c84a`, Mušketýr modrá `0x3b7bd9`, Kaplan bílá `0xe6e6f2`, Kopiník ocelová `0x7a8296`, Kapitán fialová `0xb84ad8`. Žádná oranžová. |
| Výkon | Efektové sítě se nenahrávají na GPU, když nic neukazují. Overlay `?fps=1` ukazuje název GPU. Menu varuje, když je GPU softwarové (SwiftShader, llvmpipe, Microsoft Basic Render Driver nebo `isFallbackAdapter`). Stínové kopie se už dnes skrývají a HUD píše do DOM jen při změně, takže se nemění. |

Čísla fází a typů jsou výchozí. Task 6 je doladí přes `sim:run`.

## Global Constraints

**Clean room (AGENTS.md):** kódy a jména z mapy (`hfoo`, `Footman` …) jen v `tools/`, `design/` a `docs/`. Nikdy v `client/`, `sim/`, `data/generated/` ani v textech pro hráče. Do gitu nesmí `data-source/`, `xhero/`, `*.w3x` ani `war3map.*`.

**Simulace (`sim/`):** čistá a deterministická. Pevný krok `TICKS_PER_SECOND = 30`, náhoda jen z `run.rng`, žádné transcendentní funkce `Math` ani `**` (směry přes `Math.sqrt`). `Run.step()` v běžném kroku nealokuje; tabulky fází se staví v konstruktoru `Run`. Hlídá to `tests/repo-guard.test.ts`.

**Klient:** WebGPU s fallbackem na WebGL2. Texty jen v `client/ui/messages-en.ts` a `messages-cs.ts`. Pohledy za snímek nealokují.

**Data:** `data/generated/*.json` se ručně neupravuje. Změna jde do `design/*.yaml`, pak `npm run data:build -- --source data-source/v20.75/out --out data/generated`. Export chybí? `npm run map:extract -- <mapa.w3x> v20.75` (mapa je soubor v projektu na claude.ai, `X_Hero_Siege_F-Day_v20.75_AI.w3x`).

**Testy:** testy simulace si samy nastavují pravidla, která ověřují. Testy, které nechtějí spawny, volají `silenceSpawns(data)` (Task 3). Očekávání se počítají ze vstupních dat, ne z opsaných čísel, aby ladění v Tasku 6 nic nerozbilo.

**Kód:** anglicky, malé soubory s jednou rolí, Conventional Commits, commit až po `npm run check`. Větev `phase-2b1`, push po každém tasku.

## Review Focus

1. **Skupina na stropu:** při 150 živých se skupina vejde jen do volných slotů a po uvolnění nepřijde žádná dávka navíc. Test: Task 3, `a pack at the cap fills only free slots and banks nothing`.
2. **Přechod fáze mezi skupinami:** další skupina bere váhy, interval a podíl lovců nové fáze a elity fáze přijdou právě jednou, i když první skupina fáze narazí na strop (elity mají přednost). Testy: Task 3, `elites come once per phase with its first pack` a `the next pack follows the new phase`.
3. **Léčení bez cíle a na hraně:** kaplan bez zraněného cíle v dosahu nic nevyšle a přebití nespálí; léčení nikdy nepřesáhne max HP; omráčený kaplan neléčí. Testy: Task 4.
4. **Střelec zemře ve stejném kroku, kdy vystřelil** (hrdina ho zabije v `updateHeroCombat` po `updateEnemies`): klient kreslí výstřel z poslední pozice slotu a nespadne. Kryje Task 5, e2e `every enemy type renders without errors` (střelci u hrdiny umírají rychle).
5. **Prohlížeč neprozradí GPU** (starší WebGPU bez `adapterInfo`, Firefox bez `WEBGL_debug_renderer_info`): název `unknown`, žádné varování, žádná chyba. Test: Task 1, `describeGpu without adapter info`.

---

## Mapa souborů

```
client/render/{gpu.ts, gpu.test.ts}, client/perf/overlay.ts, client/ui/{menu.ts, messages-*.ts}, client/game/debug.ts,
client/render/fx/{pool.ts, pool.test.ts, bolts.ts, rings.ts, blasts.ts, projectile-view.ts}, client/render/effects.ts   (Task 1)
data/schema/enemy.ts, design/enemies.yaml, tools/data-build/{load.ts, map-enemies.ts, data-build.test.ts},
data/generated/enemies.json, data/generated.test.ts                                                                   (Task 2)
data/schema/{rules.ts, index.ts, schema.test.ts}, design/rules.yaml, data/generated/rules.json, sim/{spawner.ts,
spawn-tables.ts, spawner.test.ts, run.ts, hash.ts}, sim/testing/silence.ts + testy, které dnes nulují spawnPerSecond     (Task 3)
sim/{enemies.ts, enemy-heal.ts, enemy-heal.test.ts, events.ts, run.ts, hash.ts}                                      (Task 4)
client/render/{enemy-tints.ts, enemy-tints.test.ts, enemy-crowd.ts, enemy-fx.ts}, client/main.ts, client/game/debug.ts,
sim/debug-spawn.ts, sim/index.ts, e2e/game.spec.ts                                                                    (Task 5)
tools/sim-run/{run.ts, run.test.ts}, sim/bot.test.ts, design/*.yaml, data/generated/*.json, README.md, AGENTS.md,
ARCHITECTURE.md, docs/{STATUS.md, DECISIONS.md}                                                                       (Task 6)
```

---

### Task 1: Výkon – GPU v overlay, varování a nenahrávání prázdných efektů

**Files:**
- Modify: `client/render/gpu.ts`, `client/perf/overlay.ts`, `client/ui/menu.ts`, `client/ui/messages-en.ts`, `client/ui/messages-cs.ts`, `client/game/debug.ts`, `client/main.ts`, `client/render/fx/{pool.ts, bolts.ts, rings.ts, blasts.ts, projectile-view.ts}`, `client/render/effects.ts`, `e2e/game.spec.ts`
- Test: `client/render/gpu.test.ts` (nový), `client/render/fx/pool.test.ts`

**Interfaces:**
```ts
// client/render/gpu.ts
export interface GpuInfo { name: string; software: boolean }
export function isSoftwareRenderer(name: string, fallbackAdapter: boolean): boolean;
/** `backend` is renderer.backend: WebGPU reads device.adapterInfo, WebGL2 reads UNMASKED_RENDERER_WEBGL (else RENDERER). */
export function describeGpu(backend: unknown, kind: Backend): GpuInfo;
// client/perf/overlay.ts: start(backend: Backend, n: number, gpu?: string) – extra line "gpu      <name>", cut to 40 chars
// client/ui/menu.ts: setGpuWarning(software: boolean) – element #gpu-warning, hidden unless software
// GameSnapshot.gpu: GpuInfo
// FxPool.liveCount(now: number): number – entries whose age is in [0, life]
```

Texty (`menu.gpuWarning`):
- EN: „Your browser is drawing the game without the graphics card (software rendering), so it will run slowly. Update the graphics driver, or turn on hardware acceleration in the browser settings.“
- CS: „Prohlížeč kreslí hru bez grafické karty (softwarové vykreslování), takže poběží pomalu. Aktualizuj ovladač grafiky, nebo v nastavení prohlížeče zapni hardwarovou akceleraci.“

- [ ] **Step 1: Testy**
  - `gpu.test.ts`, `isSoftwareRenderer`: `"Google SwiftShader"`, `"ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)"`, `"llvmpipe (LLVM 15.0.7, 256 bits)"` a `"Microsoft Basic Render Driver"` → `true`; `"ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 (0x00002F04) Direct3D11 vs_5_0 ps_5_0, D3D11)"` → `false`; `("NVIDIA", true)` → `true`.
  - `describeGpu with WebGPU adapter info`: `{ device: { adapterInfo: { description: "", vendor: "nvidia", architecture: "blackwell", isFallbackAdapter: false } } }` → `{ name: "nvidia blackwell", software: false }`; s `description: "SwiftShader Device"` → `software: true`.
  - `describeGpu without adapter info`: `{}` pro WebGPU a `{ gl: { getExtension: () => null, getParameter: () => undefined, RENDERER: 0x1f01 } }` pro WebGL2 → `{ name: "unknown", software: false }`.
  - `pool.test.ts`, `liveCount counts entries within their life`: life 1, přidej v časech 0 a 0,5 → `liveCount(0.8) === 2`, `liveCount(1.2) === 1`, `liveCount(2) === 0`.
- [ ] **Step 2:** Spusť `npx vitest run client/render/gpu.test.ts client/render/fx/pool.test.ts`, musí padat.
- [ ] **Step 3: Implementace.**
  - `describeGpu`: jméno WebGPU = `description`, jinak `vendor architecture` (prázdné vynech), jinak `unknown`; `software = isSoftwareRenderer(name, isFallbackAdapter === true)`. Pro `unknown` vždy `software: false`. Žádná výjimka ven (try/catch kolem čtení).
  - `main.ts`: po `createRenderer` zavolej `describeGpu(renderer.backend, backend)`, předej do overlay, `menu.setGpuWarning` a snapshotu.
  - Efekty (`BoltFx`, `RingFx`, `blasts`, `projectile-view`, `Effects`): `write` zjistí, jestli je něco živé (`liveCount` nebo počet zapsaných instancí). Když nic nežije teď ani při minulém zápisu, vrátí se bez zápisu a bez `needsUpdate`. Při přechodu na prázdno se jednou zapíše skrytí.
- [ ] **Step 4:** E2E v `game.spec.ts`: `menu warns about software rendering only on a software GPU` – po načtení `/?seed=1&lang=en` platí `#gpu-warning` viditelný ⇔ `__game.gpu.software` (v kontejneru i v CI je SwiftShader, takže viditelný). Start funguje i s varováním.
- [ ] **Step 5:** `npm run check`, `npm run build`, `npm run e2e -- --project=webgl2-fallback`. Commit `perf(client): skip idle effect uploads; show the GPU and warn on software rendering`.

---

### Task 2: Data šesti typů nepřátel

**Files:**
- Modify: `data/schema/enemy.ts`, `design/enemies.yaml`, `tools/data-build/{load.ts, map-enemies.ts}`, `data/generated/enemies.json` (vygenerovat), `data/generated.test.ts`
- Test: `tools/data-build/data-build.test.ts`, `data/schema/schema.test.ts`

**Interfaces:**
```ts
// data/schema/enemy.ts – změny
attack: z.object({ kind: z.enum(["melee", "ranged"]), range, cooldown, damageMin, damageMax }).strict(),
heal: z.object({ amount: positive, range: positive, cooldown: positive }).strict().optional(),   // za xp
// tools/data-build/load.ts
export interface EnemyEntry {
  id: string; source: string; mapName?: string; name: Hero["name"]; xp: number;
  multipliers?: { hp?: number; damage?: number; moveSpeed?: number; collision?: number };
  heal?: { amount: number; range: number; cooldown: number };
}
// ExportUnit dostane weapon_type?: string
// map-enemies.ts: weapon_type normal → melee; instant, missile, msplash, mline, mbounce → ranged; jiné → chyba
//   "design/enemies.yaml: <id>: unsupported weapon_type \"<x>\" of <source> in units.json; known: normal, instant, …"
// násobitele se použijí před scaleEnemy: hp a moveSpeed bez zaokrouhlení (zaokrouhlí scaling), damageMin/Max a collision na celé
```

`design/enemies.yaml` (pořadí je index typu, Štítonoš zůstává 0):

| id | source | mapName | EN / CS | multipliers | xp | heal |
|---|---|---|---|---|---|---|
| shieldbearer | hfoo | Footman | Shieldbearer / Štítonoš | – | 1 | – |
| scout | hfoo | Footman | Scout / Zvěd | hp 0.5, moveSpeed 1.5, collision 0.8, damage 0.6 | 1 | – |
| musketeer | hrif | Rifleman | Musketeer / Mušketýr | – | 2 | – |
| chaplain | hmpr | Priest | Chaplain / Kaplan | – | 2 | amount 8, range 450, cooldown 1 |
| lancer | hkni | Knight | Lancer / Kopiník | – | 4 | – |
| captain | hkni | Knight | Captain / Kapitán | hp 3, damage 1.5, collision 1.5, moveSpeed 0.8 | 12 | – |

Komentář v YAML: heal je design hodnota (výchozí Heal WC3 je 25 HP za manu, × 0,3 jako HP).

Očekávaný výstup (kontrola, ne test): Štítonoš 126 HP, rychlost 329; Zvěd 63 HP, 494, kolize 25, 8–9; Mušketýr 161 HP, dosah 400, `ranged`; Kaplan 111 HP, kolize 16, dosah 600, `ranged`; Kopiník 551 HP, 366, 42–50; Kapitán 1652 HP, 293, kolize 48, 63–75.

- [ ] **Step 1: Testy** (`data-build.test.ts`, fixture jednotky dostane `weapon_type`):
  - `maps enemy stats from the units export` – očekávání doplní `attack.kind: "melee"`;
  - `maps a ranged weapon to a ranged attack` (`instant` a `missile` → `ranged`);
  - `fails on an unknown weapon type` – přesná hláška výše;
  - `applies enemy multipliers before scaling` – hp 420 × 0,5 se scalingem hp 0,3 → 63; damage 14–15 × 0,6 → 8–9; collision 31 × 0,8 → 25;
  - `copies the heal of a design entry` a `keeps key order of heroes and enemies` (`heal` až za `xp`, chybí-li, klíč tam není);
  - `schema.test.ts`: nepřítel bez `attack.kind` neprojde.
- [ ] **Step 2:** Testy musí padat. Implementuj, uprav `enemies.yaml` a spusť `data:build`.
- [ ] **Step 3:** `data/generated.test.ts`: `enemies have six types with their attack kinds` – id v pořadí z tabulky, `attack.kind` (`musketeer`, `chaplain` ranged, ostatní melee), `heal` jen u `chaplain`. Repo guard: žádný kód mapy v `enemies.json`.
- [ ] **Step 4:** `npm run check`. Commit `feat(data): six enemy types with attack kinds, variants and the chaplain heal`.

---

### Task 3: Spawner ve skupinách a 5minutový běh

**Files:**
- Create: `sim/spawn-tables.ts`, `sim/testing/silence.ts`
- Modify: `data/schema/{rules.ts, index.ts}`, `design/rules.yaml`, `data/generated/rules.json` (vygenerovat), `sim/{spawner.ts, run.ts, hash.ts}`, testy, které dnes nastavují `spawnPerSecond = 0` (`sim/run.test.ts`, `sim/abilities/line.test.ts`, `sim/testing/ability-run.ts`, `sim/knockback.test.ts`, `sim/enemy-ai.test.ts`, `sim/hero-combat.test.ts`, `sim/abilities/slots.test.ts`, `sim/testing/progression-run.ts`)
- Test: `sim/spawner.test.ts` (přepsat), `data/schema/schema.test.ts`

**Interfaces:**
```ts
// data/schema/rules.ts
run: { durationSeconds, phaseSeconds, firstPackSeconds: nonNegative, timeScaling }
enemies: { maxAlive, siegerAggroRange, leashRange, knockback, elite: Slug }
phases: z.array(z.object({
  mix: z.record(Slug, positive),                       // id nepřítele → váha, aspoň 1 položka
  pack: z.object({ min: int ≥ 1, max: int ≥ 1, everySeconds: positive }).strict(),   // refine: min ≤ max
  hunterShare: 0..1,
  elites: int ≥ 0,
}).strict()).min(1)
// validateGameData navíc: "rules.phases.<i>.mix: unknown enemy \"<id>\"", "rules.enemies.elite: unknown enemy \"<id>\""
// sim/spawn-tables.ts
export interface PhaseTable { types: Int32Array; cumulative: Float64Array; total: number }
export function buildPhaseTables(data: GameData): PhaseTable[];          // pořadí položek mix = pořadí v JSON
export function pickType(table: PhaseTable, roll: number): number;       // roll v [0, 1)
// Run: readonly phaseTables: PhaseTable[]; readonly eliteType: number;
//      nextPackTick: number (= round(firstPackSeconds × 30)); elitePhase = -1; nextGate (zůstává); spawnCredit zmizí
// sim/testing/silence.ts
export function silenceSpawns(data: GameData): void;   // run.firstPackSeconds = 1e9
```

**Algoritmus `spawnEnemies(run)`** (pořadí čerpání z RNG je součást determinismu):
```
if (run.tick < run.nextPackTick) return
phase = rules.phases[run.phaseIndex]
run.nextPackTick = run.tick + max(1, round(phase.pack.everySeconds × 30))
size   = pack.min + floor(rng() × (pack.max − pack.min + 1))
elites = run.elitePhase !== run.phaseIndex ? phase.elites : 0;  run.elitePhase = run.phaseIndex
role   = rng() < phase.hunterShare ? Hunter : Sieger
gate   = run.nextGate; run.nextGate = (gate + 1) % gates.length
half   = gateRadius × max(1, sqrt((size + elites) / 8))
for k in 0 .. elites + size − 1:
  if store.aliveCount ≥ store.capacity: break               // zbytek propadne
  type = k < elites ? run.eliteType : pickType(table, rng())
  x = gate.x + (rng() × 2 − 1) × half;  y = gate.y + (rng() × 2 − 1) × half
  store.spawn(type, role, gate, x, y, def.hp × timeScale, timeScale, tick); stats.spawned++
```
`Run.step` volá `spawnEnemies` na stejném místě jako dnes. `stateHash` místo `spawnCredit` míchá `nextPackTick` a `elitePhase`.

**`design/rules.yaml`** (výchozí, Task 6 ladí): `run: { durationSeconds: 300, phaseSeconds: 50, firstPackSeconds: 2, … }`, `enemies.elite: captain` a fáze:

| fáze | mix | pack min–max / s | hunterShare | elites |
|---|---|---|---|---|
| 1 | shieldbearer 8, scout 3 | 6–10 / 6 | 0.3 | 0 |
| 2 | shieldbearer 6, scout 3, musketeer 2 | 8–12 / 6 | 0.35 | 0 |
| 3 | shieldbearer 5, scout 3, musketeer 2, chaplain 1, lancer 1 | 10–14 / 6 | 0.35 | 1 |
| 4 | shieldbearer 4, scout 3, musketeer 3, chaplain 2, lancer 2 | 12–16 / 5 | 0.4 | 1 |
| 5 | shieldbearer 4, scout 2, musketeer 3, chaplain 2, lancer 3 | 14–18 / 5 | 0.4 | 2 |
| 6 | shieldbearer 3, scout 3, musketeer 3, chaplain 2, lancer 3 | 16–20 / 4 | 0.45 | 2 |

- [ ] **Step 1: Testy** `spawner.test.ts` (data si nastavují samy: dvě brány, `gateRadius` 150, `maxAlive` 150, jedna nebo dvě fáze s vlastním `mix` a `pack`; `spawnOnly` jako dnes):
  - `first pack comes at firstPackSeconds` – 3 s: po 90 voláních `spawned === 0`, po 91. `> 0`;
  - `packs come every everySeconds` – first 0, every 5: přírůstky `spawned` jen v ticích 0, 150, 300;
  - `pack size stays within min and max` – 40 skupin, každý přírůstek v [min, max];
  - `a pack shares one gate and one role; gates alternate`;
  - `hunter share decides the role of whole packs` – 200 skupin, `hunterShare` 0,25 → podíl lovčích skupin 0,15–0,35;
  - `mix weights pick the types` – mix `{ shieldbearer: 3, musketeer: 1 }`, velké skupiny: podíl mušketýrů 0,15–0,35 a typ mimo mix se neobjeví;
  - `elites come once per phase with its first pack` – `elites: 2`: první skupina fáze začíná 2 kapitány (nejnižší sloty), další skupina téže fáze žádného, první skupina další fáze zase 2;
  - `the next pack follows the new phase` – fáze 0 a 1 s jiným `mix` a `everySeconds`: první skupina po hranici fáze má typy a interval fáze 1;
  - `a pack at the cap fills only free slots and banks nothing` – `maxAlive` 5, pack 8–8: živých 5; zabij 2, do příštího ticku skupiny nic, pak přesně 2;
  - `pack spread grows with its size` – pack 20–20: všichni do `150 × √(20/8)` od brány v obou osách a aspoň jeden dál než 150;
  - `scales hp with time`, `phase changes after phaseSeconds`, `same seed spawns at the same positions` – převzít;
  - `schema.test.ts`: neznámé id v `mix` a v `enemies.elite` (přesné hlášky), `pack.min > pack.max` neprojde.
- [ ] **Step 2:** Testy musí padat. Implementuj schéma, tabulky a spawner. `silenceSpawns` nahradí všech osm míst s `spawnPerSecond = 0`. `bot.test.ts` test `a run sees between 250 and 400 enemies` dočasně přepiš na rozsah 500–1100 (Task 6 ho zpřesní).
- [ ] **Step 3:** Uprav `design/rules.yaml`, `data:build`, `npm run check`. Spusť `npm run sim:run -- --hero all --runs 3` a výstup vlož do reportu (balanc se tu neladí).
- [ ] **Step 4:** Commit `feat(sim): enemies arrive in packs; five-minute run in six phases`.

---

### Task 4: Kaplan léčí

**Files:**
- Create: `sim/enemy-heal.ts`
- Modify: `sim/enemies.ts` (`healCooldown: Int32Array`, nula při `spawn`), `sim/events.ts` (`EnemyHeal: 12`), `sim/run.ts` (krok a komentář pořadí), `sim/hash.ts`
- Test: `sim/enemy-heal.test.ts`

**Interfaces:**
```ts
export function healEnemies(run: Run): void;   // Run.step: spawnEnemies → updateEnemies → healEnemies → updateHeroCombat …
// událost: EnemyHeal, a = léčený slot, value = vyléčeno, x/y = pozice léčeného, u = slot kaplana, v = 0
```
Pravidla: pro každého živého nepřítele s `def.heal`:
- omráčený nic nedělá;
- `healCooldown > 0` → sniž o 1 a pokračuj;
- jinak najdi živý slot (i sebe) do `heal.range` (přesná vzdálenost na aktuálních pozicích) s největší ztrátou `maxHp − hp > 0`, při shodě nejnižší slot. Kandidáty dá `run.grid` (postavený v `updateEnemies`) dotazem s poloměrem `heal.range + 64`; buffer kandidátů je modulové `Int32Array` zvětšené jen při větší kapacitě obchodu;
- vyléčí `min(heal.amount × damageScale[i], ztráta)`, vyšle `EnemyHeal`, nastaví `healCooldown = round(heal.cooldown × 30)`;
- bez cíle se přebití nenastaví.

- [ ] **Step 1: Testy** (tichý běh přes `silenceSpawns`, nepřátelé přes `run.enemies.spawn`, hodnoty z `data.enemies[chaplain].heal`):
  - `a chaplain heals the most wounded enemy in range` (ztráty 5 a 30 → léčí 30);
  - `heal never exceeds max hp` (ztráta 3 → +3);
  - `heal waits for its cooldown` (další léčení přesně po `round(cooldown × 30)` krocích);
  - `no wounded enemy in range: no event and no cooldown` (raněný v `range + 100`; po přesunu do dosahu léčí hned v dalším kroku);
  - `a stunned chaplain does not heal`;
  - `a chaplain heals itself`;
  - `heal scales with the healer's damage scale` (`damageScale` 1,5);
  - `EnemyHeal carries target, amount, position and healer`.
- [ ] **Step 2:** Testy musí padat. Implementuj.
- [ ] **Step 3:** `npm run check` (replay testy v `bot.test.ts` hlídají determinismus s léčením). Commit `feat(sim): chaplains heal wounded enemies`.

---

### Task 5: Klient – barvy typů, výstřely a léčení

**Files:**
- Create: `client/render/enemy-tints.ts`, `client/render/enemy-fx.ts`, `sim/debug-spawn.ts`
- Modify: `client/render/enemy-crowd.ts`, `client/main.ts`, `client/game/debug.ts`, `sim/index.ts`, `e2e/game.spec.ts`
- Test: `client/render/enemy-tints.test.ts`, `sim/debug-spawn.test.ts`

**Interfaces:**
```ts
// client/render/enemy-tints.ts
export const ENEMY_TINTS: Readonly<Record<string, number>>;   // barvy z tabulky „Co plán rozhoduje“
export function enemyTint(id: string): number;                 // neznámé id → 0xc23b3b
export function tintTable(enemies: readonly { id: string }[]): Float32Array;   // lineární rgb po typech, při startu
// EnemyCrowd: constructor(vat: BakedVat, capacity: number, tints: Float32Array)
//   instanční atribut "tint" (vec3, DynamicDrawUsage) se zapisuje s maticí; barva modelu × tint jako dnes × červená,
//   emisivní tint v síle dnešního ENEMY_TINT (0x771111 vůči červené), bílý záblesk po zásahu zůstává. ENEMY_TINT zmizí.
// client/render/enemy-fx.ts
export class EnemyFx implements RunView { readonly object: Group; }   // vlastní BoltFx
//   HeroHit/CastleHit s a ≥ 0 a útočníkem `attack.kind === "ranged"`: paprsek z pozice útočníka (HeroHit: e.x[a], e.y[a];
//   CastleHit: x, y události) k cíli (hrdina: x, y události; hrad: castle.x, castle.y), barva 0xfff2b0, život 0,12 s.
//   EnemyHeal: paprsek od kaplana (slot u) k léčenému (x, y), barva 0x7dff9a, život 0,18 s.
// sim/debug-spawn.ts
export function debugSpawnEach(run: Run): void;   // jeden lovec každého typu v řadě 300 od sebe, 600 severně od hrdiny; plný obchod přeskočí
// GameSnapshot: enemyTypes: number (počet různých živých typů; bez alokace, Uint8Array podle počtu typů)
// debug: spawnEach(): void
```

- [ ] **Step 1: Testy**
  - `enemy-tints.test.ts`: `every enemy type has its own tint` – každé id z `data/generated/enemies.json` je v `ENEMY_TINTS` a barvy jsou různé; `unknown id falls back to red`.
  - `debug-spawn.test.ts`: `spawns one hunter of every type north of the hero` (počet = počet typů, role Hunter, y = hero.y + 600).
- [ ] **Step 2:** Testy musí padat. Implementuj tinty, `EnemyCrowd`, `EnemyFx` (do `session.views` a scény v `main.ts`), `debugSpawnEach` a snapshot.
- [ ] **Step 3: E2E** `every enemy type renders without errors`: `/?seed=1&debug=1&speed=2&duration=60&lang=en`, Start, `__game.debug.spawnEach()`, do 3 s `__game.enemyTypes ≥ 6`, screenshot. Fixture hlídá chyby konzole.
- [ ] **Step 4:** `npm run check`, `npm run build`, `npm run e2e -- --project=webgl2-fallback`. Commit `feat(client): enemy colours per type, ranged shots and heal beams`.

---

### Task 6: Ladění, dokumentace a dokončení

**Files:**
- Modify: `tools/sim-run/{run.ts, run.test.ts}`, `sim/bot.test.ts`, `design/{rules.yaml, enemies.yaml}`, `data/generated/*.json`, `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `docs/{STATUS.md, DECISIONS.md}`

**Interfaces:**
```ts
export interface RunSummary { /* …dnešní pole */ minHeroHpPercent: number }   // nejnižší hp hrdiny / maxHp během běhu, celé %
export function playBot(data: GameData, seed: number, durationSeconds?: number, hero?: string, idle?: boolean): RunSummary;
// idle: žádný pohyb ani akce, při level-upu karta atributu (jako test idle v bot.test.ts)
// formatSummary: "... castle 8000/12000, hero 900/1500, hero low 42%"
// CLI: npm run sim:run -- [--hero <id>|all] [--seed 1] [--runs 5] [--duration 300] [--idle]
```

**Cíle ladění** (`npm run sim:run -- --hero all --runs 5` a totéž s `--idle`), pro každého hrdinu:
- autopilot vyhraje 3 až 5 z 5;
- běh bez vstupu prohraje (zavírá mezeru z 2a);
- hrdina je v ohrožení: `hero low` pod 70 % aspoň ve 3 z 5 běhů autopilota;
- průměrná úroveň 10–18 a nejnižší průměr hrdiny aspoň 70 % mediánu (zavírá Hrobníka s 7,2);
- za běh přijde 600–1000 nepřátel.

**Co smíš měnit:** fáze v `rules.yaml` (`mix`, `pack`, `hunterShare`, `elites`, `firstPackSeconds`), `castle`, `progression.xpFirst` a `xpStep`, `xp`, `multipliers` a `heal` v `enemies.yaml`. Hrdiny, kouzla a `scaling.yaml` jen tehdy, když se všichni hrdinové odchylují stejným směrem. Když cíle nejdou splnit, ohlas DONE_WITH_CONCERNS s tabulkou čísel.

- [ ] **Step 1: Testy**
  - `run.test.ts`: `formatSummary` s `hero low`.
  - `bot.test.ts`: `IDLE_LOSES` všude `true`, `MIN_BOT_WINS` 3; `a run sees between 600 and 1000 enemies`; `the bot is in danger with every hero` (min hp < 70 % aspoň ve 3 z 5 seedů); `a full run stays fast` pro 300 s do 8 s.
- [ ] **Step 2:** Implementuj `--idle` a `minHeroHpPercent`, dolaď čísla. Výstup obou příkazů před laděním a po něm vlož do reportu.
- [ ] **Step 3: Dokumentace.**
  - `ARCHITECTURE.md`: skupiny a tabulky fází, `healEnemies` v pořadí `Run.step`, druhy útoku nepřátel, `EnemyFx`, GPU v overlay.
  - `AGENTS.md` a `README.md`: `--idle`, `debug.spawnEach()`, `__game.gpu` a `__game.enemyTypes`.
  - `docs/DECISIONS.md`: řádky tabulky „Co plán rozhoduje“ ve schváleném znění a výsledky ladění.
  - `docs/STATUS.md`: 2b-1 hotová, další krok Vizuál A (plán v novém chatu).
- [ ] **Step 4:** `npm run check`, `npm run build`, `npm run e2e`, `npm run sim:run -- --hero all --runs 5`. Commit `feat(tools): sim:run idle and danger; phase 2b-1 balance; docs`.

---

## Hotovo, když

- `npm run check`, `npm run e2e` a CI na PR procházejí a `sim:run` splňuje cíle z Tasku 6.
- Petr odehraje 5minutový běh: nepřátelé chodí v rojích, typy jdou rozeznat a hrdina musí uhýbat. S `?fps=1` naměří zhruba 60 fps i v poslední fázi (150 živých) a overlay ukáže jeho NVIDIA, ne SwiftShader.

## Odloženo mimo 2b-1

- Modely typů, hradu a bran (Vizuál A), vlastní modely hrdinů (Vizuál B).
- Elitní nápory v 3:00, 6:00 … a elity s modifikátory, bossové, 20 fází a frakce, obtížnosti (zbytek 2b).
- Uhýbání střelám (střela s letem), tabulka typů útoku a brnění, schopnosti nepřátel kromě léčení.
- Zvuky výstřelů a léčení nepřátel.
