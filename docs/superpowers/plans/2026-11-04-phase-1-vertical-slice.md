# Fáze 1: vertikální řez – implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tříminutový běh v prohlížeči. Kamenorohý (`stonehorn`) brání hrad proti jednomu typu nepřítele, Skalní zlom (`rock-rupture`) se sesílá sám, z nepřátel padají XP krystaly a level-up nabízí karty. Simulace je deterministická a celý běh jde odehrát i bez grafiky.

**Architecture:**
- `sim/` je čistá deterministická simulace s pevným krokem 30 Hz. Vstupem je příkaz na krok (`TickInput`), výstupem stav v typovaných polích a události (`EventLog`).
- `client/` kreslí interpolovaný stav simulace: nepřátele přes instancing a VAT ze spiku, hrdinu jako skinned mesh. Rozhraní je HTML/CSS v EN a CS.
- Herní data v `data/generated/` nenesou kódy z mapy. Přibydou nepřátelé (`design/enemies.yaml`) a pravidla běhu (`design/rules.yaml`).
- `tools/sim-run/` odehraje běhy z příkazové řádky, aby šla čísla ladit bez prohlížeče.

**Tech Stack:** jako ve fázi 0 a bez nových závislostí: Node 22, TypeScript 7.0.2, Vite 8.3.5, Vitest 5.1.0, Three.js 0.187.0, zod 4.6.7, yaml 2.9.1, tsx 4.23.15, @playwright/test 1.63.0.

**Spec:** `docs/superpowers/specs/2026-11-04-defense-webgame-design.md`, fáze 1 v oddílu 8; dále oddíly 3.1–3.4, 4, 6 a 7.

## Global Constraints

**Clean room (AGENTS.md, spec 4):**
- Kódy a jména z mapy (rawcode, `mapName`, jména triggerů) smí být jen v `tools/`, `design/` a `docs/`. Nikdy v `client/`, `sim/`, `data/generated/` ani v textech pro hráče.
- Žádné texty z mapy. Jména a texty jsou vlastní, v EN i CS.
- Do gitu nesmí `data-source/`, `xhero/`, `*.w3x` ani `war3map.*`.

**Simulace (`sim/`):**
- Čistá: žádné `three`, nic z `client/`, žádné `window`, `document`, `navigator` ani `globalThis`.
- Deterministická: stejný seed a stejné vstupy dají stejný stav i v jiném prohlížeči. Na tom stojí testy, přehrávání i pozdější co-op.
  - Pevný krok `TICKS_PER_SECOND = 30`, čas se počítá v krocích.
  - Náhoda jen z `Rng` se seedem z `RunOptions`. Zakázané jsou `Math.random`, `Date`, `performance`, `setTimeout`, `setInterval` a `requestAnimationFrame`.
  - Zakázané jsou i funkce, jejichž výsledek se mezi JS enginy smí lišit: `Math.sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|exp|expm1|log|log1p|log2|log10|pow|cbrt|hypot` a operátor `**`. Směry se počítají vektorově přes `Math.sqrt`.
- `Run.step()` v běžném kroku nealokuje. Entity jsou v typovaných polích s pevnou kapacitou. Alokovat smí jen vzácná událost (nabídka karet).
- Jednotky jsou světové jednotky mapy: rychlost 270 znamená 270 jednotek za sekundu, dosah 128 je 128 jednotek. Osa `y` míří na sever. Klient převádí měřítkem `SCENE_SCALE = 1/64` a sever kreslí jako `-z`.
- Systémy běží v pevném pořadí `Run.step()` (Task 3).

**Klient:** WebGPU s automatickým fallbackem na WebGL2. Texty pro hráče jsou jen v `client/ui/messages-en.ts` a `client/ui/messages-cs.ts`, nikdy natvrdo v kódu.

**Kód:** kód, identifikátory a komentáře anglicky. Žádné nové závislosti. Malé soubory s jednou rolí.

**Assety:** žádné nové. Robot (CC0) slouží pro hrdinu i nepřátele. Každý soubor v `assets/` má řádek v `assets/LICENSES.md`, od Tasku 3 to hlídá test.

**Data:** `data/generated/*.json` se ručně neupravuje. Změna jde do `design/*.yaml` a pak `npm run data:build -- --source data-source/v20.75/out --out data/generated`. Export mapy je v kontejneru, jinak ho vytvoří `npm run map:extract -- <mapa.w3x> v20.75`.

**Git:**
- Větev `phase-1` z `main`, commity po úkolech ve stylu Conventional Commits. Před každým commitem musí projít `npm run check`.
- Controller po každém zkontrolovaném úkolu pushne. Po Tasku 1 otevře draft PR do `main` přes REST API (GraphQL v kontejneru nefunguje), aby CI běželo na každý push.
- Merge do `main` jen se souhlasem autora.

**Výkon:** hra drží zhruba 60 fps se 150 nepřáteli na notebooku s integrovanou grafikou (spec 1, bod 4). Měří se ve hře s `?fps=1`.

## Review Focus

1. **Dlouhý snímek** (přepnutá karta, pomalý stroj): smyčka nesmí doběhnout stovky kroků naráz ani teleportovat jednotky. Test: Task 9, `caps steps per frame`.
2. **Víc level-upů najednou** (velká dávka XP): nabídky jdou po sobě a během výběru se nehýbe čas ani hrdina. Test: Task 7, `chains pending level-ups`.
3. **Plný strop nepřátel** (150 živých): spawner nepřidává a po uvolnění místa nevypustí dávku. Test: Task 4, `respects maxAlive without a burst`.
4. **Víc konců v jednom kroku** (hrad i hrdina na 0 HP, nebo konec času během výběru karty): výsledek je jeden a pokaždé stejný. Testy: Task 5, `castle loss wins a tie`, a Task 7, `duration does not pass during level-up`.
5. **Klávesnice:** protichůdné klávesy (A+D) se zruší a ztráta fokusu pustí všechny klávesy, aby hrdina sám nejel dál. Test: Task 9, `blur releases keys`.

## Co plán rozhoduje (ke kontrole autorem)

| Téma | Rozhodnutí |
|---|---|
| Hrdina a kouzlo | Kamenorohý (útok na blízko) a Skalní zlom: linie ve směru pohybu, jinak na nejbližšího nepřítele, omráčení 2 s. Jiný druh kouzla by znamenal implementovat jiný druh. |
| Nepřítel | Štítonoš (`shieldbearer`) s čísly prvního vojáka lidské vlny mapy: 420 HP, brnění 3, útok 14–15 za 1,35 s, rychlost 270, 1 XP |
| Běh | 3 minuty, 4 fáze po 50 s, 2 brány. Tok 0,45 → 0,75 nepřítele za sekundu (mapa na Normal ≈ 0,47), lovci 20 → 35 %, nejvýš 150 živých |
| Hrad | 3000 HP a obnova 2 % za minutu. Mapa má 155 000 HP a 200 HP/s, ale v jiném měřítku. |
| Level-up | 4 XP na 2. úroveň, každá další o 2 víc (asi 8–9 level-upů za běh). 3 karty z: úroveň kouzla, +10 síly, obratnosti nebo inteligence |
| Atributy | Konstanty mapy: 15 HP za bod síly, za bod obratnosti 0,1 brnění a 0,2 % rychlosti útoku, primární atribut se přičítá k poškození. Vlastní: inteligence +1 % síly kouzel a +1 % rychlosti přebíjení za bod |
| Ovládání | Jen WASD nebo šipky, kouzla se sesílají sama. Úskok, ultimátka a přehazování karet přijdou ve fázi 2. |
| Vzhled | Robot (CC0) pro hrdinu (zlatý) i nepřátele (červení), hrad a brány z jednoduchých tvarů, žádné nové assety |
| Data pro klienta | Bez `source` a `review`; obojí zůstává v `design/*.yaml` |

Čísla jsou výchozí. Task 8 je doladí tak, aby autopilot většinou přežil a běh bez vstupu prohrál.

## Převzato z fáze 0

| Odložená připomínka | Kde se řeší |
|---|---|
| `review` a `source` v `data/generated` (I6) | Task 1 |
| překlep v klíči `params` projde (M2); prázdná cesta v chybě; chybí testy úrovní 0 a 6 a záporného cooldownu | Task 1 |
| shoda `design/` ↔ `data/generated` (M3); pořadí klíčů hrdinů; slug u chybné délky pole | Task 2 |
| guard nevidí `globalThis.window` ani `../client` bez lomítka (M1); `assets/LICENSES.md` nikdo nehlídá (M4) | Task 3 |
| poškození hrdiny bez primárního atributu (M9) | Task 3 (`heroStats`) |
| `MAX_NEIGHBOURS` tiše ořízne dotazy | Task 4 (buffer 64, komentář) |
| klient se typuje s typy Node (M5); chyby ve smyčce obejdou hlášku; skrytá karta zkreslí fps; modulový scratch ve `frameStats`; česká věta na anglické úvodní stránce | Task 9 |
| rozpočet vertex atributů ve WebGPU; šířka VAT nad 2048 (M10) | Task 10 |
| kontrola chyb v konzoli jen v prvním e2e testu (M8); timeouty, oprávnění a duplicitní běhy CI, cache Playwrightu, `cancel-in-progress` v Pages (M7); varování o velkém chunku | Task 12 |

---

## Mapa souborů

```
data/schema/{enemy.ts, rules.ts}                     nová schémata (Task 2)
design/{enemies.yaml, rules.yaml}                    nepřítel a pravidla běhu (Task 2)
tools/data-build/map-enemies.ts                      nepřítel z units.json (Task 2)
data/generated/{enemies.json, rules.json}            nové generované soubory (Task 2)
sim/{constants, rng, spatial-grid, input, events, world, enemies, hero, hash, run, index}.ts   (Task 3)
sim/testing/game-data.ts                             ověřená herní data pro testy a nástroje (Task 3)
sim/{combat, spawner, enemy-ai, castle}.ts           (Task 4, 5)
sim/abilities/{slots, line}.ts                       (Task 6)
sim/{crystals, level-up, cards}.ts                   (Task 7)
sim/bot.ts, tools/sim-run/run.ts                     (Task 8)
client/tsconfig.json
client/game/{data, params, loop, keyboard, session, debug}.ts            (Task 9, 11)
client/render/{gpu, coords, scene, camera, hero-view}.ts                 (Task 9)
client/render/{vat, enemy-crowd, crystal-view, effects}.ts               (Task 10)
client/perf/{frame-stats, overlay}.ts                přesunuté ze spiku (Task 9)
client/ui/{i18n, messages-en, messages-cs}.ts        (Task 9, rozšíří Task 11)
client/ui/{menu, hud, cards, card-lines, end-screen, castle-pointer}.ts, client/ui/style.css   (Task 11)
e2e/{fixtures.ts, game.spec.ts}                      (Task 9, 12)
```

---

### Task 1: Herní data bez kódů z mapy

Klient bude od Tasku 9 importovat `data/generated/*.json`. Dnes v nich jsou rawcody (`source`) a jména triggerů (`review`), a ty se k hráči dostat nesmí.

**Files:**
- Modify: `data/schema/{ability.ts, hero.ts, index.ts, schema.test.ts}`, `tools/data-build/{map-abilities.ts, map-heroes.ts, data-build.test.ts}`, `data/generated.test.ts`, `data/generated/*.json` (přegenerovat), `design/abilities.yaml` (jen hlavička), `AGENTS.md`, spec (oddíl 4, odstavec Data)

**Interfaces:**
- Produces:
  - Herní `Hero` a `Ability` nemají `source` ani `review`. Všechny objekty schémat jsou `.strict()`, takže neznámý klíč (i zapomenutý `source`) je chyba.
  - `params` mají u každého druhu pevný seznam klíčů podle tabulky. Neznámý klíč, třeba překlep `stunSecond`, je chyba s cestou.
  - `GameDataError` píše u položek pole i jejich id: `abilities.3 (soul-bolt).targeting: …`. Chyba bez cesty začíná `(root)`.
  - data-build dál vyžaduje `source` v položkách `design/*.yaml` (podle něj hledá v exportu) a dál odmítá `review` u kouzla, které není skriptové. `review` zůstává jen v `design/abilities.yaml`.

| Druh | Povinné (beze změny) | Volitelné |
|---|---|---|
| `line` | damage, length, width | stunSeconds, waveSpeed |
| `nova` | damage, radius | slow, slowSeconds |
| `aura` | aspoň jedno z damageBonus, moveSpeedBonus, attackSpeedBonus | zbylé dva z trojice |
| `summon` | count, duration | range, damageDealt, damageTaken |
| `on_hit` | aspoň jedno z chance, splashRadius, bonusDamage | splashPercent, stunSeconds a zbylé z trojice |
| `ticking_area` | tickDamage, ticksPerSecond, radius, duration | hitRadius |
| ostatní (`projectile`, `instant`, `chain`, `area`, `cone`, `heal`, `shield`) | jako dnes | žádné |

- [ ] **Step 1:** `git checkout -b phase-1`, pokud větev ještě nevytvořil controller.
- [ ] **Step 2: Napiš padající testy.**
  - `data/generated.test.ts`, test `carries no map identifiers`:
    - žádný řetězec neodpovídá `/\b(Init)?Trig_|war3map/`;
    - žádná hodnota se nerovná `source` ani `mapName` z `design/*.yaml` (YAML načti balíčkem `yaml`);
    - `FORBIDDEN_KEYS` navíc obsahuje `source`, `review` a `jassFunctions`.
  - `data/schema/schema.test.ts`:
    - `rejects unknown top-level key`: hrdina se `source` → chyba s cestou `heroes.0 (…)`;
    - `rejects unknown param key for the kind`: `line` s `stunSecond`;
    - `accepts optional params of the kind`: `line` se `stunSeconds` a `waveSpeed`;
    - `rejects levels 0 and 6` a `rejects negative cooldown`;
    - `renders root issues as (root)`: `validateGameData(42)`.
  - `tools/data-build/data-build.test.ts`: nový `writes no source or review`; test, že data-build odmítne `review` u neskriptového kouzla, zůstává.
  - Spusť `npm test`. Očekávané: nové testy FAIL.
- [ ] **Step 3: Implementuj.**
  - Schémata `.strict()` a klíče `params` podle tabulky: `z.object({ ...povinné, ...volitelné.optional() }).strict()`. U `aura` a `on_hit` zachovej kontrolu „aspoň jedno z“.
  - `mapHero` a `mapAbility` přestanou zapisovat `source` a `review`. Kontrola `review` zůstane.
  - Hlavička `design/abilities.yaml` bude říkat, že `review` jsou poznámky k převodu a do `data/generated` se nezapisují.
- [ ] **Step 4:** Přegeneruj data (Global Constraints → Data). `git diff data/generated` smí jen odebírat klíče `source` a `review`.
- [ ] **Step 5: Uprav pravidla.**
  - `AGENTS.md`: odrážku „Known exception…“ nahraď větou „`data/generated/*.json` carries no map codes: `source` and `review` live only in `design/*.yaml`.“
  - Spec, oddíl 4, odstavec Data: „každý objekt nese původní kód z mapy (`source`)“ změň na „každý záznam v `design/*.yaml` nese původní kód z mapy (`source`); herní data v `data/generated/` ho nenesou“.
- [ ] **Step 6:** Spusť `npm run check`, pak commit `refactor(data): keep map codes out of runtime game data`.

### Task 2: Data pro vertikální řez

**Files:**
- Create: `data/schema/enemy.ts`, `data/schema/rules.ts`, `design/enemies.yaml`, `design/rules.yaml`, `tools/data-build/map-enemies.ts`, `tools/data-build/fixtures/design/{enemies.yaml, rules.yaml}`, `tools/data-build/fixtures/export/units.json`, `data/generated/{enemies.json, rules.json}`
- Modify: `data/schema/{hero.ts, constants.ts, index.ts, schema.test.ts}`, `tools/data-build/{load.ts, build.ts, map-heroes.ts, data-build.test.ts}`, `design/abilities.yaml`, `data/generated.test.ts`, `data/generated/*.json`

**Interfaces:**
- Consumes: strict schémata z Tasku 1.
- Produces:
  - `Hero` má navíc `hp` (export `hp`) a `armor` (export `armor`).
  - `Constants` má navíc `agiDefenseBonus` (misc `AgiDefenseBonus`) a `primaryAttackBonus` (misc `StrAttackBonus`, tedy poškození za bod primárního atributu).
  - `Enemy` v `data/schema/enemy.ts`:
    ```ts
    { id: Slug; name: LocalizedText; level: number /* int >= 1 */; hp: number /* > 0 */;
      hpRegen: number /* >= 0 */; armor: number; moveSpeed: number /* > 0 */;
      collision: number /* > 0 */; acquireRange: number /* > 0 */;
      attack: { range: number; cooldown: number; damageMin: number; damageMax: number };
      xp: number /* int > 0 */ }
    ```
  - `Rules` v `data/schema/rules.ts` má klíče přesně podle `design/rules.yaml` níže. `Point = { x: number; y: number }`.
  - `GameData = { heroes, abilities, enemies, rules, constants }`. data-build zapisuje i `enemies.json` a `rules.json`.
  - `validateGameData` navíc hlídá:
    - duplicitní id nepřítele;
    - `rules.slice.hero` existuje a `rules.slice.ability` je mezi jeho `signatureAbilities`;
    - každý `phases[i].enemy` existuje;
    - `phases.length * phaseSeconds >= durationSeconds`, jinak chyba „phases cover 150 s, the run lasts 180 s“;
    - `castle`, `heroStart` a všechny `gates` leží v aréně (`|x| <= width / 2`, `|y| <= height / 2`);
    - `attack.damageMax >= attack.damageMin`.

`design/enemies.yaml`:
```yaml
- id: shieldbearer
  source: hfoo
  mapName: Footman
  name: { en: Shieldbearer, cs: Štítonoš }
  xp: 1
```

`design/rules.yaml` (výchozí hodnoty, ladí se hraním):
```yaml
slice: { hero: stonehorn, ability: rock-rupture }
run:
  durationSeconds: 180
  phaseSeconds: 50
  timeScaling: { seconds: 1200, cap: 2 }   # HP a poškození nepřátel × min(cap, 1 + t / seconds), spec 3.2
arena:
  width: 6000
  height: 5000
  castle: { x: 0, y: -2000 }
  heroStart: { x: 0, y: -1500 }
  gates: [{ x: -1800, y: 2200 }, { x: 1800, y: 2200 }]
  gateRadius: 150
castle: { hp: 3000, radius: 180, regenPercentPerMinute: 2 }
hero: { collision: 32, baseRegen: 0.25, regenPerStr: 0.05, spellPowerPerInt: 0.01, cooldownSpeedPerInt: 0.01 }
enemies: { maxAlive: 150, siegerAggroRange: 250, leashRange: 900 }
phases:
  - { enemy: shieldbearer, spawnPerSecond: 0.45, hunterShare: 0.2 }
  - { enemy: shieldbearer, spawnPerSecond: 0.55, hunterShare: 0.25 }
  - { enemy: shieldbearer, spawnPerSecond: 0.65, hunterShare: 0.3 }
  - { enemy: shieldbearer, spawnPerSecond: 0.75, hunterShare: 0.35 }
progression: { xpFirst: 4, xpStep: 2, magnetRadius: 300, crystalSpeed: 900, pickupRadius: 56, attributeCardAmount: 10, cardsPerOffer: 3 }
```
Komentáře v YAML smí uvést původ v mapě. Hrad `hcas` má v mapě 155 000 HP a regeneraci 200 HP/s. Tok vychází ze 7 jednotek na bránu za 30 s na Normal. Do `rules.json` se komentáře nedostanou.

`design/abilities.yaml`, u `rock-rupture` přidej `waveSpeed: { design: [1000, 1000, 1000, 1000, 1000] }`. Mapa má Wave Time 0, takže jde o vlastní hodnotu.

- [ ] **Step 1: Napiš padající testy.**
  - `data-build.test.ts`:
    - `maps enemy stats from the units export`: fixture podle exportu (`hp 420, hp_regen 0.25, armor 3, move_speed 270, collision 31, acquire_range 500, level 1, range 90, cooldown 1.35, damage_min 14, damage_max 15`) dá `Enemy` s těmito čísly a `xp: 1`;
    - `fails with readable error when enemy source is missing`: zpráva obsahuje `design/enemies.yaml`, `shieldbearer` a `units.json`;
    - `copies rules`, `maps hero hp and armor`, `maps new constants`;
    - `reports the slug when a design array has the wrong length`;
    - `keeps key order of heroes and enemies`, k dnešní kontrole pořadí klíčů u kouzel.
  - `schema.test.ts`: `rejects phase with unknown enemy`, `rejects slice ability the hero lacks`, `rejects phases shorter than the run`, `rejects gate outside the arena`, `rejects duplicate enemy id`, `rejects damageMax below damageMin`.
  - `data/generated.test.ts`:
    - `FILES` navíc obsahuje `enemies.json` a `rules.json`;
    - nový test `matches design ids and names`: hrdinové, kouzla a nepřátelé mají v `data/generated` stejná id ve stejném pořadí a stejná jména jako v `design/*.yaml`. data-build v CI neběží, takže tohle aspoň odhalí design změněný bez přegenerování.
- [ ] **Step 2: Implementuj.**
  - Schémata.
  - `load.ts` čte `design/enemies.yaml`, `design/rules.yaml` a export `units.json`.
  - `map-enemies.ts`: `mapEnemy(exp: ExportUnit, entry: EnemyEntry): Enemy`. Chybějící číslo dá chybu „design/enemies.yaml: shieldbearer: units.json hfoo has no hp“.
  - `build.ts` vypíše `data:build: 4 heroes, 16 abilities, 1 enemies (v20.75) -> data/generated`.
- [ ] **Step 3:** Přegeneruj data a zkontroluj, že `enemies.json` má čísla ze Step 1 a `rules.json` hodnoty z `design/rules.yaml`.
- [ ] **Step 4:** `npm run check`, commit `feat(data): add enemies and run rules for the vertical slice`.

### Task 3: Jádro simulace

**Files:**
- Create: `sim/{constants.ts, rng.ts, input.ts, events.ts, world.ts, enemies.ts, hero.ts, hash.ts, run.ts}`, `sim/testing/game-data.ts`, testy `sim/{rng.test.ts, hero.test.ts, run.test.ts, hash.test.ts}`
- Move: `client/spike/spatial-hash.ts` → `sim/spatial-grid.ts` a `client/spike/spatial-hash.test.ts` → `sim/spatial-grid.test.ts`; třída se dál jmenuje `SpatialHash`.
- Modify: `sim/index.ts`, `sim/tsconfig.json` (`resolveJsonModule: true`), `client/spike/crowd.ts` (importy ze `sim/`, vlastní RNG nahradí `Rng`), `tests/repo-guard.test.ts`, `AGENTS.md`

**Interfaces:**
- Consumes: typy `GameData`, `Hero`, `Ability`, `Enemy`, `Rules` a `Constants` z `data/schema`. V `sim/` jen přes `import type`.
- Produces:
```ts
// sim/constants.ts
export const TICKS_PER_SECOND = 30;
export const TICK_SECONDS = 1 / TICKS_PER_SECOND;

// sim/rng.ts: mulberry32 se stejnými konstantami jako createRandom ve spiku
export class Rng {
  constructor(seed: number);
  next(): number;          // [0, 1)
  int(n: number): number;  // celé číslo 0..n-1
  get state(): number;     // uint32 pro otisk stavu
}

// sim/input.ts
export interface TickInput { moveX: number; moveY: number; card: number } // move -1|0|1; card -1 = nic, jinak 0..2
export const NO_INPUT: Readonly<TickInput>; // { moveX: 0, moveY: 0, card: -1 }

// sim/events.ts
export const EventKind = { Hit: 1, Death: 2, Cast: 3, HeroHit: 4, CastleHit: 5, Pickup: 6, LevelUp: 7, RunEnd: 8 } as const;
export class EventLog {   // Run ho vytváří s kapacitou 1024; co se nevejde, jen přičte `dropped`
  constructor(capacity: number);
  readonly kind: Uint8Array; readonly a: Int32Array; readonly value: Float64Array;
  readonly x: Float64Array; readonly y: Float64Array; readonly u: Float64Array; readonly v: Float64Array;
  count: number; dropped: number;
  clear(): void;
  push(kind: number, a: number, value: number, x: number, y: number, u: number, v: number): void;
}
```

Význam polí událostí:

| Událost | `a` | `value` | `x, y` | `u, v` |
|---|---|---|---|---|
| Hit | slot nepřítele | poškození | pozice nepřítele | `u`: 0 základní útok, 1 kouzlo |
| Death | slot | – | pozice | – |
| Cast | index slotu kouzla | délka | počátek | směr |
| HeroHit | slot útočníka | poškození | pozice hrdiny | – |
| CastleHit | slot útočníka | poškození | pozice útočníka | – |
| Pickup | – | XP | pozice krystalu | – |
| LevelUp | nová úroveň | – | pozice hrdiny | – |
| RunEnd | 0 výhra, 1 hrad, 2 hrdina | – | – | – |

```ts
// sim/world.ts
export interface HeroStats {
  maxHp: number; regenPerSecond: number; armor: number; attackIntervalSeconds: number;
  damageMin: number; damageMax: number; spellPower: number; cooldownScale: number;
  moveSpeed: number; collision: number;
}
export interface HeroState {
  def: Hero; x: number; y: number; prevX: number; prevY: number;
  facingX: number; facingY: number;   // jednotkový vektor, na startu (0, 1)
  moving: boolean;                    // hrdina se v tomto kroku pohnul
  level: number; xp: number; str: number; agi: number; int: number;
  hp: number; stats: HeroStats;
  attackCooldown: number;             // kroky do dalšího základního útoku (Task 5)
  pendingLevelUps: number;            // (Task 7)
}
export interface CastleState { x: number; y: number; radius: number; hp: number; maxHp: number; lastHitTick: number }
export interface RunStats { kills: number; damageDealt: number }

// sim/enemies.ts
export const Role = { Sieger: 0, Hunter: 1 } as const;
export const Action = { Move: 0, Attack: 1, Stunned: 2 } as const;
export class EnemyStore {
  constructor(capacity: number);
  readonly capacity: number; aliveCount: number;
  readonly alive: Uint8Array; readonly type: Uint16Array; readonly role: Uint8Array;
  readonly gate: Uint8Array; readonly aggro: Uint8Array; readonly action: Uint8Array;
  readonly x: Float64Array; readonly y: Float64Array; readonly prevX: Float64Array; readonly prevY: Float64Array;
  readonly facingX: Float64Array; readonly facingY: Float64Array;
  readonly hp: Float64Array; readonly maxHp: Float64Array; readonly damageScale: Float64Array;
  readonly attackCooldown: Int32Array; readonly stunTicks: Int32Array;
  readonly spawnTick: Int32Array; readonly lastHitTick: Int32Array; readonly lastAttackTick: Int32Array;
  /** Takes the lowest free slot; returns -1 when the store is full. */
  spawn(type: number, role: number, gate: number, x: number, y: number, hp: number, damageScale: number, tick: number): number;
  kill(slot: number): void;
}

// sim/hero.ts
export function heroStats(data: GameData, hero: HeroState, out: HeroStats): HeroStats;
export function moveHero(run: Run, input: TickInput): void;

// sim/run.ts
export type RunState = "playing" | "levelUp" | "won" | "lost";
export type RunResult = "won" | "castle" | "hero";
export interface RunOptions { seed: number; durationSeconds?: number }
export class Run {
  readonly data: GameData; readonly rng: Rng; readonly events: EventLog;
  readonly hero: HeroState; readonly castle: CastleState; readonly enemies: EnemyStore;
  readonly stats: RunStats; readonly durationTicks: number;
  tick: number; state: RunState; result: RunResult | null;
  step(input: TickInput): void;
  get timeSeconds(): number;   // tick / 30
  get phaseIndex(): number;    // min(floor(tick / (phaseSeconds * 30)), phases.length - 1)
}
export function createRun(data: GameData, options: RunOptions): Run;

// sim/hash.ts: FNV-1a 32 bit; čísla s plovoucí čárkou přes sdílený Float64Array a Uint32Array
export function stateHash(run: Run): number;

// sim/testing/game-data.ts: jen pro testy a nástroje, klient ho nepoužívá
export function gameData(): GameData;  // data/generated/*.json (import JSON) přes validateGameData
```

`Run.step()` ve výsledném pořadí. Každý úkol doplní svůj řádek na jeho místo; Task 3 implementuje jen své řádky.
```
if (state === "won" || state === "lost") return;
events.clear();
if (state === "levelUp") { chooseCard(this, input.card); return; }   // Task 7; čas stojí
savePrevious(this);         // Task 3: prevX/prevY hrdiny a nepřátel (krystaly přidá Task 7)
moveHero(this, input);      // Task 3
spawnEnemies(this);         // Task 4
updateEnemies(this);        // Task 4
updateHeroCombat(this);     // Task 5
updateAbilities(this);      // Task 6
updateCrystals(this);       // Task 7
regenCastle(this);          // Task 4
this.tick++;
checkEnd(this);             // hrad (Task 4) → hrdina (Task 5) → čas (Task 3); prohra má přednost
if (state === "playing" && hero.pendingLevelUps > 0) openOffer(this);   // Task 7
```

**Pravidla:**
- `createRun`:
  - hrdina podle `rules.slice.hero` na úrovni 1 se základními atributy a plným HP, na `heroStart`, s pohledem na sever;
  - hrad z `rules.castle` a `rules.arena.castle`;
  - kapacita `EnemyStore` je `rules.enemies.maxAlive`;
  - `durationTicks = round((options.durationSeconds ?? rules.run.durationSeconds) * 30)`.
- `moveHero`:
  - směr je `sign(moveX), sign(moveY)`, šikmo normalizovaný na délku 1;
  - posun je `stats.moveSpeed * TICK_SECONDS`;
  - pozice zůstává v aréně, zmenšené o `collision`;
  - při pohybu se `facing` nastaví na směr a `moving = true`.
- `heroStats` podle vzorců mapy a pravidel:
  - `maxHp = def.hp + str * strHitPointBonus`;
  - `regenPerSecond = baseRegen + str * regenPerStr`;
  - `armor = def.armor + agi * agiDefenseBonus`;
  - `attackIntervalSeconds = baseAttack.cooldown / min(1 + agi * agiAttackSpeedBonus, 1 + attackSpeedCap)`;
  - `damageMin` a `damageMax` = hodnota z dat `+ primary * primaryAttackBonus`, kde `primary` je atribut podle `def.primary`;
  - `spellPower = 1 + int * spellPowerPerInt`;
  - `cooldownScale = 1 / (1 + int * cooldownSpeedPerInt)`;
  - `moveSpeed = def.moveSpeed`, `collision = rules.hero.collision`.
- `checkEnd` v Tasku 3: když `tick >= durationTicks`, pak `state = "won"`, `result = "won"` a událost `RunEnd` s `a = 0`.
- `stateHash` v Tasku 3 zahrne `tick`, `state`, `result`, `rng.state` a hrdinu (`x`, `y`, `facingX`, `facingY`, `level`, `xp`, `str`, `agi`, `int`). Další úkoly ho rozšíří o svůj stav.

- [ ] **Step 1: Napiš testy.**
  - `rng.test.ts`:
    - `same seed gives the same sequence`;
    - `int stays in range`: 10 000× `int(7)` dá jen 0..6;
    - `matches the spike generator`: první tři hodnoty pro seed 1 se rovnají původnímu `createRandom(1)` ze spiku. Zkopíruj ho do testu jako referenci.
  - `hero.test.ts`, `heroStats matches the map formulas` pro stonehorn na úrovni 1 (`toBeCloseTo` na 6 míst): `maxHp 1325`, `regenPerSecond 2`, `armor 7`, `attackIntervalSeconds 1.5/1.04`, `damageMin 37`, `damageMax 47`, `spellPower 1.24`, `cooldownScale 1/1.24`, `moveSpeed 300`, `collision 32`.
  - `run.test.ts`:
    - `hero moves north at move speed`: 30 kroků s `moveY: 1` posune `y` o 300;
    - `diagonal speed is normalized`: 30 kroků šikmo posune v každé ose o `300/√2`;
    - `hero stays inside the arena`;
    - `run is won when the duration ends`: s `durationSeconds: 2` je po 60 krocích `state === "won"` a přijde `RunEnd` s `a = 0`;
    - `step after the end does nothing`: otisk se nezmění.
  - `hash.test.ts`:
    - `same seed and inputs give the same hash`: dva běhy, 600 kroků se vstupy z `new Rng(99)`;
    - `different inputs give a different hash`.
  - `tests/repo-guard.test.ts`:
    - `keeps sim/ free of three, client/ and DOM`: import `client` chytí i bez lomítka na konci (`["'][^"']*client(\/[^"']*)?["']`) a DOM jako `\b(window|document|navigator|globalThis)\b`;
    - nový `keeps sim/ deterministic`: zakázané vzory z Global Constraints (`\bMath\.random\b`, `\bDate\b`, `\bperformance\b`, `\b(setTimeout|setInterval|requestAnimationFrame)\b`, `\bMath\.(sin|cos|…|hypot)\b`, `[\w)\]]\s*\*\*(?!\/)`). Chyba vypíše soubor a vzor;
    - nový `keeps map identifiers out of client/ and sim/`: žádná hodnota `source` ani `mapName` z `design/*.yaml` se jako celé slovo neobjeví v souborech `.ts`, `.html`, `.css` a `.json` pod `client/` a `sim/`;
    - nový `lists every asset in LICENSES.md`: každá cesta z `git ls-files assets` kromě `LICENSES.md` je zapsaná v `assets/LICENSES.md`.
- [ ] **Step 2:** Spusť `npm test`. Očekávané: nové testy FAIL (moduly chybí).
- [ ] **Step 3:** Implementuj moduly podle Interfaces a Pravidel. Přesuň spatial hash a jeho test, spike přepoj na `sim/`.
- [ ] **Step 4:** Ověř, že strážce hlídá: dočasně přidej `Math.sin(1)` do `sim/run.ts` a spusť `npm test`. Očekávané: FAIL se jménem souboru. Pak řádek odeber.
- [ ] **Step 5:** `AGENTS.md`, sekce Code rules: přidej pravidla determinismu z Global Constraints a větu „Systems run in the fixed order of `Run.step` in `sim/run.ts`.“
- [ ] **Step 6:** Spusť `npm run check` a `npm run e2e`. Očekávané: všechno projde, spike 6/6.
- [ ] **Step 7:** Commit `feat(sim): add the deterministic simulation core`.

### Task 4: Nepřátelé, spawner a hrad

**Files:**
- Create: `sim/{combat.ts, spawner.ts, enemy-ai.ts, castle.ts}`, testy `sim/{spawner.test.ts, enemy-ai.test.ts, castle.test.ts}`
- Modify: `sim/run.ts`, `sim/hash.ts`, `sim/hash.test.ts`

**Interfaces:**
- Consumes: `Run`, `EnemyStore`, `Role`, `Action`, `Rng` a `SpatialHash` z Tasku 3.
- Produces:
```ts
// sim/combat.ts
export function armorReduction(armor: number, k: number): number;  // armor <= 0 → 0, jinak armor*k / (1 + armor*k)
export function rollDamage(rng: Rng, min: number, max: number): number; // celé číslo v [round(min), round(max)]
export function damageHero(run: Run, amount: number, attacker: number): void;   // hp -= amount, HeroHit
export function damageCastle(run: Run, amount: number, attacker: number): void; // hp -= amount, lastHitTick, CastleHit
// sim/spawner.ts
export function timeScale(rules: Rules, tick: number): number;  // min(cap, 1 + t / seconds), t v sekundách
export function spawnEnemies(run: Run): void;
// sim/enemy-ai.ts
export function updateEnemies(run: Run): void;
// sim/castle.ts
export function regenCastle(run: Run): void;
// Run navíc: spawnCredit: number; nextGate: number; readonly grid: SpatialHash (cellSize 128, kapacita maxAlive)
```

**Pravidla:**
- **Spawn v každém kroku:**
  - Vezmi fázi `phases[phaseIndex]` a přičti `spawnCredit += spawnPerSecond * TICK_SECONDS`.
  - Dokud `spawnCredit >= 1` a `aliveCount < maxAlive`, odečti 1 a vytvoř nepřítele. Když je plno, `spawnCredit = min(spawnCredit, 1)`, aby po uvolnění místa nepřišla dávka.
  - Brány se střídají dokola (`nextGate`).
  - Pořadí volání RNG je pevné: nejdřív role (`rng.next() < hunterShare` dá lovce), pak posun `x`, pak `y`, oba `(rng.next() * 2 - 1) * gateRadius`.
  - `hp = enemy.hp * timeScale` a `damageScale = timeScale`.
- **Chování nepřátel** po slotech vzestupně, jen živí; `grid` se přestaví na začátku `updateEnemies`:
  1. `attackCooldown > 0` se v každém kroku sníží o 1.
  2. Omráčený (`stunTicks > 0`) sníží `stunTicks`, dostane `action = Stunned` a rychlost 0, pak rovnou separace.
  3. Obléhač dostane `aggro = 1`, když je hrdina blíž než `siegerAggroRange`. Když je dál než `leashRange`, `aggro = 0`.
  4. Cílem je hrdina pro lovce a pro obléhače s aggro, jinak hrad.
  5. Dosah je `enemy.collision + poloměr cíle + attack.range`; poloměr hrdiny je `stats.collision`, hradu `castle.radius`.
  6. **Útok:** když je cíl v dosahu, `action = Attack` a rychlost 0. Při `attackCooldown <= 0` dá `rollDamage(min, max) * damageScale * (1 - armorReduction(brnění cíle, defenseArmor))`. Brnění hradu je 0. Pak `attackCooldown = round(attack.cooldown * 30)` a `lastAttackTick = tick`.
  7. **Pohyb:** jinak `action = Move` a rychlost je jednotkový vektor k cíli krát `moveSpeed`.
  8. **Separace** jako ve spiku. Sousedé do `2 * collision`, buffer 64; co se do bufferu nevejde, se vynechá, napiš to do komentáře. Tlak při úplném překryvu je `moveSpeed`, dva nepřátelé na stejném bodě se rozjedou po ose `x` podle pořadí slotů.
  9. Posun `pozice += rychlost * TICK_SECONDS`. Pak vytlačení z kruhu hrdiny (`stats.collision + collision`) a hradu (`radius + collision`) a ořez na arénu.
  10. `facing` míří po směru rychlosti, a když stojí, k cíli.
- **Hrad:**
  - `regenCastle` přičte `maxHp * regenPercentPerMinute / 100 / 60 * TICK_SECONDS` až do `maxHp`, jen dokud `hp > 0`;
  - `checkEnd`: `castle.hp <= 0` nastaví `result = "castle"` a pošle `RunEnd` s `a = 1`.
- **Otisk:** `stateHash` přidá `spawnCredit`, `nextGate` a živé sloty (slot, type, role, x, y, hp, attackCooldown, stunTicks, aggro, action).

- [ ] **Step 1: Napiš testy.** Situace v testech se staví přímo: `run.enemies.spawn(...)`, úprava `run.hero.x` a podobně. Pravidla jdou upravit přes `structuredClone(gameData())`.
  - `spawner.test.ts`:
    - `spawns at the phase rate`: po 610 krocích fáze 1 je 9 nepřátel;
    - `alternates gates`: první dva jsou u brány 0 a 1;
    - `phase changes after phaseSeconds`: krok 1500 → `phaseIndex 1`;
    - `hunter share follows the phase`: s `spawnPerSecond: 30` a `hunterShare: 0.25` je po 150 spawnech podíl lovců 0,15–0,35;
    - `respects maxAlive without a burst`: s `maxAlive: 5` je plno 5; po `kill` jednoho jich je v dalším kroku zase 5 a víc nepřibude;
    - `scales hp with time`: spawn v kroku `600 * 30` má `hp 630` (420 × 1,5);
    - `same seed spawns at the same positions`.
  - `enemy-ai.test.ts`:
    - `siegers walk to the castle and attack it`: obléhač 400 jednotek od středu hradu dojde do dosahu a první `CastleHit` má poškození 14 nebo 15;
    - `sieger aggroes when the hero comes close`: hrdina 200 od obléhače → cílem je hrdina;
    - `sieger leashes back beyond leashRange`: hrdina 1000 daleko → `aggro 0`, obléhač míří k hradu;
    - `hunters chase the hero`: vzdálenost se za krok zmenší o 270/30;
    - `stunned enemies neither move nor attack`;
    - `enemies keep apart`: dva nepřátelé na stejném bodě jsou po 30 krocích dál od sebe než 40;
    - `enemies do not overlap the hero or the castle`;
    - `enemy damage to the hero uses the hero armor`: 14 až 15 × (1 − 0,14/1,14).
  - `castle.test.ts`:
    - `castle regenerates 2 % per minute`: z 1000 HP je po 1800 krocích 1060 ± 0,01;
    - `castle at 0 hp loses the run`: `result === "castle"` a `RunEnd` s `a = 1`.
  - `hash.test.ts`: `different seed gives a different hash` (dva seedy, 900 kroků).
- [ ] **Step 2:** `npm test`. Očekávané: nové testy FAIL.
- [ ] **Step 3:** Implementuj podle Pravidel a doplň volání do `Run.step()` na místa z Tasku 3.
- [ ] **Step 4:** `npm run check`, commit `feat(sim): spawn sieger and hunter enemies and defend the castle`.

### Task 5: Boj hrdiny

**Files:**
- Modify: `sim/hero.ts`, `sim/combat.ts`, `sim/run.ts`, `sim/hash.ts`
- Test: `sim/hero-combat.test.ts`

**Interfaces:**
- Consumes: `armorReduction`, `rollDamage`, `damageHero` a `damageCastle` z Tasku 4.
- Produces:
```ts
// sim/combat.ts
export function damageEnemy(run: Run, slot: number, amount: number, source: 0 | 1): void;
export function killEnemy(run: Run, slot: number): void;  // Task 7 sem přidá krystal
// sim/hero.ts
export function updateHeroCombat(run: Run): void;
```

**Pravidla:**
- `damageEnemy`:
  - `hp -= amount`, `lastHitTick = tick`;
  - obléhač dostane `aggro = 1`;
  - `stats.damageDealt += min(amount, hp před zásahem)`;
  - událost `Hit` s `value = amount` a `u = source`;
  - při `hp <= 0` zavolá `killEnemy`.
- `killEnemy`: pošle `Death`, zvýší `stats.kills` a uvolní slot.
- `updateHeroCombat`:
  - **Regenerace:** `hp = min(maxHp, hp + regenPerSecond * TICK_SECONDS)`, jen dokud `hp > 0`.
  - `attackCooldown > 0` se sníží o 1.
  - **Útok:** při `attackCooldown <= 0` najde nejbližšího živého nepřítele, jehož střed je nejvýš `stats.collision + enemy.collision + baseAttack.range` daleko; při shodě vyhrává nižší slot.
  - Poškození je `rollDamage(damageMin, damageMax) * (1 - armorReduction(enemy.armor, defenseArmor))` a jde přes `damageEnemy(…, 0)`.
  - Pak `attackCooldown = round(attackIntervalSeconds * 30)`. Když hrdina stojí, otočí se k cíli.
- `checkEnd`: po kontrole hradu `hero.hp <= 0` nastaví `result = "hero"` a pošle `RunEnd` s `a = 2`. Když padnou oba ve stejném kroku, výsledek je `"castle"`.
- `stateHash` přidá `hero.hp`, `attackCooldown` a `stats.kills`.

- [ ] **Step 1: Napiš testy** v `sim/hero-combat.test.ts`:
  - `hero attacks the nearest enemy in reach`;
  - `attack interval follows agility`: omráčený nepřítel v dosahu dostane za 300 kroků 7 zásahů (interval `round(1.4423 * 30) = 43` kroků);
  - `armorReduction matches the map formula`: brnění 3 a k = 0,02 dá 0,06/1,06;
  - `damage uses the primary attribute`: zásahy leží v [37, 47] × (1 − 0,06/1,06);
  - `kills count and emit Death`;
  - `hit siegers aggro on the hero`;
  - `hero regenerates up to max hp`;
  - `hero at 0 hp loses the run`;
  - `castle loss wins a tie`.
- [ ] **Step 2:** `npm test` → FAIL; implementuj; `npm run check` → PASS.
- [ ] **Step 3:** Commit `feat(sim): add the hero base attack, regeneration and death`.

### Task 6: Automatické kouzlo (linie)

**Files:**
- Create: `sim/abilities/slots.ts`, `sim/abilities/line.ts`, test `sim/abilities/line.test.ts`
- Modify: `sim/run.ts`, `sim/hash.ts`, `sim/index.ts`

**Interfaces:**
- Consumes: `damageEnemy` z Tasku 5, `HeroState.moving` a `facing` z Tasku 3.
- Produces:
```ts
// sim/abilities/slots.ts
export interface AbilitySlot {
  def: Ability; level: number; cooldown: number;   // cooldown v krocích
  active: boolean; originX: number; originY: number; dirX: number; dirY: number; front: number;
  readonly hit: Uint8Array;                         // podle slotu nepřítele, maže se při seslání
}
/** One slot: rules.slice.ability at level 1. Any kind other than line throws
 *  `sim: ability kind <kind> is not implemented`. */
export function createAbilitySlots(run: Run): AbilitySlot[];
export function abilityCooldownTicks(run: Run, slot: AbilitySlot): number; // round(cooldown[L] * cooldownScale * 30)
export function updateAbilities(run: Run): void;
// sim/abilities/line.ts
export function updateLine(run: Run, slot: AbilitySlot, index: number): void;
// Run navíc: readonly abilities: AbilitySlot[]
```

**Pravidla** (`L = level - 1`, parametry `damage`, `length`, `width`, `stunSeconds`, `waveSpeed`):
- `cooldown > 0` se v každém kroku sníží o 1, i během letu vlny.
- **Seslání:** když vlna neletí a `cooldown <= 0`, najdi nejbližšího živého nepřítele do `length[L]`.
  - Žádný není: kouzlo čeká připravené.
  - Jinak směr = `facing`, když se hrdina hýbe, jinak jednotkový vektor k nejbližšímu nepříteli.
  - Počátek je pozice hrdiny, `front = 0`, `active = true` a smaže se `hit`.
  - Pošle se `Cast` (`a = index`, `value = length`) a `cooldown = abilityCooldownTicks`.
- **Let vlny:** `next = min(length, front + waveSpeed[L] * TICK_SECONDS)`. Pro každého živého nepřítele s `hit = 0` platí `t = (p − o) · d`, `s = |(p − o) × d|` a `c = collision`.
  - Zásah, když `t + c > front`, `t − c <= next`, `t >= −c` a `s <= width[L] / 2 + c`.
  - Zasažený dostane `hit = 1` a `damageEnemy(damage[L] * spellPower, 1)`. Kouzla ignorují brnění.
  - Když přežije, `stunTicks = max(stunTicks, round(stunSeconds[L] * 30))`.
  - Pak `front = next`. Když `front >= length`, vlna končí.
- Slot nepřítele uvolněný a znovu obsazený během letu vlny může zdědit `hit = 1`. Je to vzácné, napiš to do komentáře.
- `stateHash` přidá u slotu `level`, `cooldown`, `active`, `front`, počátek a směr.

- [ ] **Step 1: Napiš testy** v `line.test.ts` (L1: `damage 500 × 1,24 = 620`, `cooldown round(12 / 1.24 * 30) = 290`). Kde test potřebuje nepřítele na místě, nastaví mu velké `stunTicks`. Testům z Tasků 4 a 5, jejichž výsledek by kouzlo změnilo, vypni slot přes `run.abilities[0].cooldown = 1_000_000`.
  - `casts when an enemy is within length`: nepřítel 1000 na sever → `Cast` a `cooldown 290`;
  - `waits when no enemy is in range`: nepřítel 1600 daleko → bez `Cast`, `cooldown 0`;
  - `fires along the move direction while moving`: nepřítel 500 na východ a hrdina jde na sever → `Cast` se směrem (0, 1), nepřítel bez zásahu;
  - `targets the nearest enemy when standing`;
  - `hits each enemy on the line once and stuns it`: tři nepřátelé s `hp 5000` ve vzdálenosti 300, 600 a 900 na sever → tři `Hit`, každý jednou, `stunTicks 60`;
  - `damage scales with spell power`: zásah 620;
  - `front travels at waveSpeed`: nepřítel 990 na sever dostane zásah v kroku 30 ± 1 po seslání;
  - `ignores enemies outside the width`;
  - `rejects an unsupported ability kind`: `rules.slice.ability = "enhanced-totem"` → `createRun` vyhodí `sim: ability kind on_hit is not implemented`.
- [ ] **Step 2:** `npm test` → FAIL; implementuj; `npm run check` → PASS.
- [ ] **Step 3:** Commit `feat(sim): auto-cast the line ability`.

### Task 7: XP krystaly, level-up a karty

**Files:**
- Create: `sim/{crystals.ts, level-up.ts, cards.ts}`, testy `sim/{crystals.test.ts, level-up.test.ts, cards.test.ts}`
- Modify: `sim/run.ts`, `sim/combat.ts` (`killEnemy` odhodí krystal), `sim/hash.ts`, `sim/index.ts`

**Interfaces:**
- Consumes: `killEnemy` z Tasku 5, `AbilitySlot` z Tasku 6, `heroStats` z Tasku 3.
- Produces:
```ts
// sim/crystals.ts
export const CRYSTAL_CAPACITY = 512;
export class CrystalStore {
  constructor(capacity: number);
  readonly alive: Uint8Array; readonly attracted: Uint8Array; readonly value: Int32Array;
  readonly x: Float64Array; readonly y: Float64Array; readonly prevX: Float64Array; readonly prevY: Float64Array;
  count: number;
  drop(x: number, y: number, value: number): number;  // nejnižší volný slot, -1 když je plno
  collect(slot: number): void;
}
export function updateCrystals(run: Run): void;
// sim/level-up.ts
export function xpToNext(rules: Rules, level: number): number;  // xpFirst + xpStep * (level - 1)
export function gainXp(run: Run, amount: number): void;
export function debugGrantXp(run: Run, amount: number): void;   // jako gainXp; jen pro e2e a ladění
// sim/cards.ts
export type Card =
  | { kind: "ability"; slot: number; fromLevel: number; toLevel: number }
  | { kind: "attribute"; attribute: "str" | "agi" | "int"; amount: number };
export interface CardOffer { cards: Card[] }
export function openOffer(run: Run): void;
export function chooseCard(run: Run, index: number): void;
// Run navíc: readonly crystals: CrystalStore; offer: CardOffer | null
```

**Pravidla:**
- `killEnemy` odhodí krystal s `enemy.xp`. Když je zásobník plný, XP jde rovnou přes `gainXp`.
- `updateCrystals` (prev pozice krystalů ukládá `savePrevious`):
  - krystal blíž než `magnetRadius` dostane `attracted = 1`;
  - přitahovaný letí k hrdinovi rychlostí `crystalSpeed` a nepřeletí ho;
  - do `pickupRadius` se sebere, pošle `Pickup` a zavolá `gainXp(value)`.
- `gainXp`: dokud `xp >= xpToNext(level)`:
  - odečte práh a zvýší `level`;
  - přičte `def.attributes.*.perLevel` ke `str`, `agi` a `int`;
  - přepočítá `stats`; o kolik vzrostlo `maxHp`, o tolik vzroste i `hp`;
  - pošle `LevelUp` a zvýší `pendingLevelUps`.
- `openOffer`:
  - kandidáti v pořadí: karta kouzla pro slot 0 (jen když `level < def.levels`), pak `str`, `agi`, `int` (`amount = attributeCardAmount`);
  - vybere `cardsPerOffer` různých přes částečný Fisher–Yates: pro `i = 0..k-1` je `j = i + rng.int(n - i)` a pak výměna;
  - `state = "levelUp"`.
- `chooseCard(index)`:
  - bez nabídky nebo s indexem mimo nabídku nic nedělá;
  - karta kouzla zvýší `level` slotu, karta atributu přičte `amount`; pak se přepočítají `stats` a `hp` jako u `gainXp`;
  - sníží `pendingLevelUps`; když zbývá další level-up, otevře novou nabídku, jinak `offer = null` a `state = "playing"`.
- Během `levelUp` se čas nehýbe (`Run.step()` končí hned po `chooseCard`).
- `stateHash` přidá živé krystaly, `xp`, `level`, atributy, `pendingLevelUps` a karty nabídky.

- [ ] **Step 1: Napiš testy:**
  - `xp curve follows the rules`: úroveň 1 → 4, 2 → 6, 3 → 8;
  - `killed enemies drop crystals`;
  - `magnet pulls crystals and pickup gives xp`;
  - `level-up adds the per-level growth`: na úrovni 2 je `str 38.2`, `agi 22.5`, `int 26.3`;
  - `level-up pauses the run with three distinct cards`;
  - `choosing a card applies it and resumes`;
  - `chains pending level-ups`: `gainXp(10)` dá 2 úrovně a dvě nabídky po sobě. Mezi nimi vstup s pohybem nepohne hrdinou a `tick` se nemění;
  - `invalid card index is ignored`;
  - `ability card disappears at max level`;
  - `full crystal store gives xp directly`;
  - `duration does not pass during level-up`: s `durationSeconds: 2` a level-upem v kroku 59 zůstane run i po 100 krocích ve stavu `levelUp`. Po výběru karty a jednom kroku je `won`.
- [ ] **Step 2:** `npm test` → FAIL; implementuj; `npm run check` → PASS.
- [ ] **Step 3:** Commit `feat(sim): add xp crystals, level-ups and upgrade cards`.

### Task 8: Autopilot a nástroj sim:run

**Files:**
- Create: `sim/bot.ts`, `sim/bot.test.ts`, `tools/sim-run/run.ts`, `tools/sim-run/run.test.ts`
- Modify: `sim/index.ts`, `package.json` (skript `"sim:run": "tsx tools/sim-run/run.ts"`), `README.md`, `AGENTS.md` (Commands)

**Interfaces:**
- Consumes: celé API simulace z Tasků 3–7.
- Produces:
```ts
// sim/bot.ts
export function botInput(run: Run, out: TickInput): TickInput;  // zapíše do out a vrátí ho
// tools/sim-run/run.ts
export interface RunSummary {
  seed: number; result: RunResult; seconds: number; kills: number; level: number;
  castleHp: number; castleMaxHp: number; heroHp: number; heroMaxHp: number;
}
export function playBot(data: GameData, seed: number, durationSeconds?: number): RunSummary;
export function formatSummary(s: RunSummary): string;
// "seed 1: lost (castle) at 2:14, kills 63, level 7, castle 0/3000, hero 812/1555"
```

**Pravidla autopilota** (pevná, aby byly testy stabilní):
- Ve stavu `levelUp` vybere kartu 0.
- Bez nepřítele jde k bodu `(castle.x, castle.y + 700)`, když je od něj dál než 100.
- Jinak podle vzdálenosti `d` k nejbližšímu nepříteli: `d > 450` → k němu, `d < 180` → od něj, jinak stojí.
- `moveX = sign(dx)`, když `|dx| > 30`, jinak 0. Totéž pro `y`.

CLI: `npm run sim:run -- [--seed 1] [--runs 1] [--duration 180]` vypíše řádek za každý seed a nakonec souhrn, třeba „5 runs: 3 won, 2 lost; kills avg 71; level avg 8.2“.

- [ ] **Step 1: Napiš testy.**
  - `sim/bot.test.ts`:
    - `bot run ends within the duration`: seed 1 doběhne do `won` nebo `lost` nejpozději v `durationTicks`. V každém kroku platí `aliveCount <= maxAlive` a `hero.hp <= maxHp` a žádná pozice není `NaN`;
    - `replaying recorded inputs gives the same hash`: kopie vstupů autopilota přehrané v novém běhu se stejným seedem dají stejný otisk i výsledek;
    - `three seeds give three different hashes`;
    - `full run stays fast`: 5400 kroků trvá pod 5 s.
  - `tools/sim-run/run.test.ts`: `formatSummary` dá přesně řetězec z Interfaces.
- [ ] **Step 2:** `npm test` → FAIL; implementuj; `npm run check` → PASS.
- [ ] **Step 3: Dolaď čísla.** Uprav `design/rules.yaml` (a přegeneruj data) tak, aby autopilot vyhrál aspoň 3 z 5 seedů a běh bez vstupu (`NO_INPUT`) prohrál. Přidej testy `idle run loses before the end` a `bot wins at least 3 of 5 seeds`. Výstup `npm run sim:run -- --runs 5` vlož do reportu.
- [ ] **Step 4:** Commit `feat(sim): add the autopilot and the sim:run tool`.

### Task 9: Klient – hratelný běh (scéna, hrdina, kamera, smyčka, klávesnice)

**Files:**
- Create:
  - `client/tsconfig.json`;
  - `client/game/{data.ts, params.ts, loop.ts, keyboard.ts, session.ts, debug.ts}`;
  - `client/render/{gpu.ts, coords.ts, scene.ts, camera.ts, hero-view.ts}`;
  - `client/ui/{i18n.ts, messages-en.ts, messages-cs.ts}` (zatím jen klíče `error.noGpu` a `error.generic`);
  - testy `client/game/{loop.test.ts, keyboard.test.ts, params.test.ts}`;
  - `e2e/game.spec.ts`.
- Move: `client/spike/{frame-stats.ts, frame-stats.test.ts, overlay.ts}` → `client/perf/`
- Modify: `client/index.html` (stránka hry místo rozcestníku), `client/main.ts`, `client/spike/main.ts`, `tsconfig.json` (vyřadit `client`), `package.json` (`typecheck`)

**Interfaces:**
- Consumes: `createRun`, `Run`, `TickInput`, `NO_INPUT`, `EventLog`, `TICK_SECONDS` ze `sim/`, `validateGameData` z `data/schema`.
- Produces:
```ts
// client/tsconfig.json: lib ES2022 + DOM + DOM.Iterable, types ["vite/client"], resolveJsonModule,
//   strict, noEmit, include ["./**/*.ts"]; bez typů Node
// package.json: "typecheck": "tsc -p sim/tsconfig.json && tsc -p client/tsconfig.json && tsc -p tsconfig.json"

// client/game/data.ts
export function loadGameData(): GameData;     // importuje data/generated/*.json a ověří je
// client/game/params.ts
export interface GameParams {
  seed: number; speed: number; debug: boolean; durationSeconds?: number;
  renderer: "webgpu" | "webgl2"; fps: boolean; lang?: "en" | "cs";
}
/** seed: ?seed nebo randomSeed(); speed 1..16 (výchozí 1); duration 5..600; debug a fps jen "1". */
export function readGameParams(search: string, randomSeed: () => number): GameParams;
// client/game/loop.ts
export class FixedStepLoop {
  constructor(stepSeconds: number, maxStepsPerFrame: number);   // hra: TICK_SECONDS a 4
  /** Adds min(frameSeconds, 0.25) * speed and returns how many steps to run now.
   *  Above maxStepsPerFrame * speed it returns that cap and drops the rest. */
  advance(frameSeconds: number, speed: number): number;
  get alpha(): number;                                          // zbytek / stepSeconds v [0, 1)
}
// client/game/keyboard.ts: KeyW/ArrowUp, KeyS/ArrowDown, KeyA/ArrowLeft, KeyD/ArrowRight (event.code); blur pustí vše
export class Keyboard {
  constructor(target: Pick<EventTarget, "addEventListener" | "removeEventListener">);
  read(out: TickInput): void;   // nastaví moveX a moveY, card nemění
  dispose(): void;
}
// client/render/coords.ts
export const SCENE_SCALE = 1 / 64;            // sceneX = x * S, sceneZ = -y * S
// client/render/gpu.ts: renderer a detekce backendu ze spiku; bez WebGPU i WebGL2 vyhodí chybu
export function createRenderer(kind: "webgpu" | "webgl2", parent: HTMLElement):
  Promise<{ renderer: WebGPURenderer; backend: "WebGPU" | "WebGL2" }>;
// client/render/scene.ts: podlaha, lajny (pásy šířky 400 od bran k hradu), brány (2 sloupy a překlad),
//   hrad (věž a 4 rohové věžičky s kuželovou střechou), světla jako ve spiku
export function createArena(rules: Rules): Group;
// client/render/camera.ts: sklon 55°, fov 35°, vzdálenost 38 jednotek scény, plynulé sledování
export class FollowCamera {
  constructor(aspect: number);
  readonly camera: PerspectiveCamera;
  follow(sceneX: number, sceneZ: number, dt: number): void;
  resize(aspect: number): void;
}
// client/render/hero-view.ts
export class HeroView implements RunView { constructor(gltf: GLTF); readonly object: Object3D; /* + RunView */ }
// client/game/session.ts
export interface RunView {
  update(run: Run, alpha: number, dt: number): void;  // každý snímek
  onEvents?(run: Run): void;                          // po každém kroku simulace, čte run.events
  dispose(): void;
}
export class Session {
  constructor(deps: { data: GameData; params: GameParams; scene: Scene; camera: FollowCamera; keyboard: Keyboard });
  readonly views: RunView[];
  run: Run | null;
  start(seed: number): void;
  setCard(index: number): void;    // příští krok dostane input.card = index, jen jednou
  frame(dtSeconds: number): void;  // vstup → kroky → onEvents po každém kroku → update(alpha) → kamera
}
// client/game/debug.ts: aktualizuje se každý snímek
export interface GameSnapshot {
  backend: "WebGPU" | "WebGL2"; frames: number;
  screen: "menu" | "playing" | "levelUp" | "won" | "lost";
  tick: number; level: number; kills: number; heroHp: number; castleHp: number; enemies: number;
}
// window.__game: GameSnapshot
```

**Pravidla:**
- `HeroView`:
  - kopie `SkeletonUtils.clone(gltf.scene)`, aby VAT v Tasku 10 mohl použít stejný glTF;
  - průměr postavy `2 * collision * 1.4` ve světových jednotkách;
  - zlatý nádech (`emissive` 0x553300 na klonovaných materiálech);
  - klipy `Idle` a `Running` s přechodem 0,15 s;
  - `Punch` jednou při `Hit` s `u = 0` a při `Cast`, `Death` při výsledku `"hero"`;
  - pozice `prev + (cur − prev) * alpha`.
- `main.ts`:
  - načte data, parametry, renderer, glTF (`BASE_URL + models/robot-expressive/RobotExpressive.glb`) a scénu; zavolá `session.start(seed)` (menu přidá Task 11);
  - glTF se při chybě načte ještě jednou (spec 7); když selže i podruhé, ukáže se `error.generic`;
  - smyčka běží v `try/catch`. Při chybě se zastaví, ukáže `#error` s textem `error.generic` a zapíše chybu do konzole. Bez GPU ukáže `error.noGpu`;
  - `?fps=1` zobrazí přesunutý overlay; jako `n` ukazuje počet živých nepřátel.
- Odložené drobnosti ze spiku:
  - overlay ignoruje snímky delší než 250 ms (skrytá karta);
  - `frameStats` dostane pomocné pole od overlaye místo modulové proměnné.

- [ ] **Step 1: Napiš testy.**
  - `loop.test.ts`:
    - `caps steps per frame`: `advance(2.0, 1)` vrátí 4 a `alpha` je 0;
    - `accumulates partial steps`: deset volání `advance(0.021, 1)` dá dohromady 6 kroků;
    - `speed multiplies steps`: `advance(0.11, 4)` vrátí 13.
  - `keyboard.test.ts` (události přes `Object.assign(new Event("keydown"), { code })`):
    - `opposite keys cancel`;
    - `blur releases keys`;
    - `arrows work like WASD`.
  - `params.test.ts`: `defaults`, `clamps speed and duration`, `uses the seed param`.
  - `e2e/game.spec.ts`, test `renders the arena and the hero` v obou projektech, jako spike:
    - `__game.frames > 30`;
    - backend odpovídá projektu;
    - scéna se skrytým overlayem není prázdná (směrodatná odchylka jasu > 2,5);
    - screenshot je v příloze reportu.
- [ ] **Step 2:** Implementuj podle Interfaces a Pravidel.
- [ ] **Step 3:** Spusť `npm run check`, `npm run build` a `npm run e2e`. Očekávané: všechno projde, spike i nový test.
- [ ] **Step 4:** Commit `feat(client): render the arena, the hero and the castle from the simulation`.

### Task 10: Klient – nepřátelé, krystaly a efekty

**Files:**
- Move: `client/spike/bake-vat.ts` → `client/render/vat.ts`, rozšířené o 2D dlaždice
- Create: `client/render/{enemy-crowd.ts, crystal-view.ts, effects.ts}`, test `client/render/vat-layout.test.ts`
- Modify: `client/spike/{crowd.ts, main.ts}`, `client/game/session.ts`, `client/main.ts`

**Interfaces:**
- Consumes: `RunView` a `Session` z Tasku 9, `EnemyStore`, `Action`, `CrystalStore`, `EventKind` a `AbilitySlot` ze `sim/`.
- Produces:
```ts
// client/render/vat.ts
export const VAT_MAX_WIDTH = 2048;                 // minimum, které WebGL2 zaručuje
export interface VatLayout { width: number; rowsPerFrame: number }
export function vatLayout(vertexCount: number, maxWidth?: number): VatLayout;
  // width = min(vertexCount, maxWidth), rowsPerFrame = ceil(vertexCount / width)
export function vatTexel(layout: VatLayout, vertex: number, frame: number): [number, number];
  // [vertex % width, frame * rowsPerFrame + floor(vertex / width)]
export interface VatClip { startFrame: number; frames: number }
export interface BakedVat { geometry: BufferGeometry; texture: DataTexture; clips: Record<string, VatClip>; layout: VatLayout }
export function bakeVat(gltf: GLTF, clipNames: string[], fps: number): BakedVat;
/** Shader position for the crowd. anim = (clip startFrame, clip frames, start time s, last hit time s).
 *  The texel follows vatTexel with the vertexIndex builtin (no vatIndex attribute). */
export function vatPositionNode(vat: BakedVat, anim: Node<"vec4">, time: UniformNode<"float">, fps: number): Node<"vec3">;
// client/render/enemy-crowd.ts
export class EnemyCrowd implements RunView { constructor(vat: BakedVat, capacity: number, tint: ColorRepresentation) }
// client/render/crystal-view.ts
export class CrystalView implements RunView { constructor(capacity: number) }
// client/render/effects.ts
export class Effects implements RunView { constructor(data: GameData) }
```

**Pravidla:**
- **Atributy na instanci:** jeden `vec4` atribut `anim` místo `phase` a `clip` (rezerva v rozpočtu vertex atributů WebGPU). Platí pro hru i spike.
- `EnemyCrowd`:
  - každý snímek zapíše živé sloty vzestupně do instancí `0..n-1` a nastaví `mesh.count = n`;
  - pozice je interpolovaná, natočení podle `facing`, průměr `2 * collision`, červený nádech;
  - klip podle `action`:
    - `Move` → `Walking` se začátkem `spawnTick / 30 − (slot * 0.37 % 1) * délka klipu`;
    - `Attack` → `Punch` od `lastAttackTick / 30`;
    - `Stunned` → `Idle`;
  - `anim.w = lastHitTick / 30` a shader do 0,12 s po zásahu přimíchá bílou do `emissive`;
  - uniform času je interpolovaný čas simulace `(tick + alpha) / 30`;
  - za snímek nic nealokuje.
- `CrystalView`: jeden `InstancedMesh` s osmistěnem (poloměr 0,18 jednotky scény), azurové `emissive`, kapacita `CRYSTAL_CAPACITY`, interpolovaná pozice a lehké pohupování.
- `Effects`, pooly přes `InstancedMesh` (nejstarší se přepíše):
  - `Cast`: kužely každých 75 jednotek po linii. Každý vyroste v čase `vzdálenost / waveSpeed` od seslání (rychlost podle úrovně slotu) a za 0,6 s zmizí; pool 160.
  - `Death`: rozšiřující se kroužek na 0,3 s; pool 64.
- Hra používá klipy `Walking`, `Punch` a `Idle`, spike dál `Walking` a `Running`.

- [ ] **Step 1: Napiš testy** ve `vat-layout.test.ts`:
  - `tiles a wide mesh into 2048 columns`: 7214 vrcholů → `width 2048`, `rowsPerFrame 4`;
  - `keeps a narrow mesh in one row`: 500 → `500, 1`;
  - `texel of a vertex`: `vatTexel(layout, 5000, 3)` → `[904, 14]`.
- [ ] **Step 2:** Implementuj, přepoj spike na nový `vat.ts` a přidej pohledy do `Session`.
- [ ] **Step 3:** `npm run check`, `npm run build` a `npm run e2e`. Očekávané: spike 6/6 s dlaždicovým VAT. V `game.spec.ts` přidej krok, který počká na `__game.enemies > 0` a přiloží screenshot.
- [ ] **Step 4:** Commit `feat(client): draw enemies, crystals and spell effects`.

### Task 11: Klient – menu, HUD, karty a konec běhu v EN a CS

**Files:**
- Create: `client/ui/{menu.ts, hud.ts, cards.ts, card-lines.ts, end-screen.ts, castle-pointer.ts, style.css}`, testy `client/ui/{i18n.test.ts, card-lines.test.ts}`
- Modify: `client/ui/{i18n.ts, messages-en.ts, messages-cs.ts}`, `client/index.html`, `client/main.ts`, `client/game/{session.ts, debug.ts}`

**Interfaces:**
- Consumes: `Session.setCard`, `Run.offer`, `Card`, `heroStats`, `debugGrantXp` a `xpToNext` ze `sim/`.
- Produces:
```ts
// client/ui/i18n.ts
export type Lang = "en" | "cs";
export type MessageKey = keyof typeof en;          // zdroj klíčů je messages-en.ts
// messages-cs.ts: `satisfies Record<MessageKey, string>`, takže chybějící klíč neprojde typecheckem
export function pickLang(param: Lang | undefined, stored: string | null, browser: string): Lang; // URL → úložiště → prohlížeč (cs*) → en
export function t(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string;  // {name} → hodnota
// client/ui/card-lines.ts
export interface CardLine { label: MessageKey; from: string; to: string }
export function cardLines(run: Run, card: Card): CardLine[];
// window.__game.debug = { grantXp(amount: number): void }, jen s ?debug=1
```

**Pravidla:**
- **Menu:** název hry, věta pod ním, hrdina (jméno z dat v jazyce hry), tlačítko Start, nápověda k ovládání a přepínač EN/CS. Jazyk se ukládá do `localStorage` (čtení i zápis v `try/catch`). Konec běhu vede zpět do menu.
- **HUD:**
  - vlevo nahoře HP hrdiny a XP s úrovní;
  - nahoře uprostřed čas „1:23 / 3:00“ a „Fáze 2/4“;
  - vpravo nahoře HP hradu a počet zabitých;
  - dole kouzlo se jménem, úrovní a zbývajícím přebitím, nebo textem „připraveno“.
- **Útok na hrad:** když hrad dostal zásah v posledních 2 s, HUD ukáže `hud.castleAttacked`. Když je hrad mimo obrazovku, `castle-pointer.ts` ukáže u okraje šipku směrem k němu.
- **Karty:**
  - tři karty vedle sebe; vybírá se kliknutím nebo klávesami 1–3 přes `Session.setCard`;
  - `cardLines` u karty kouzla vypíše parametry, které se mezi úrovněmi mění, v pořadí klíčů dat, a `cooldown`, když se mění. Poškození je včetně `spellPower` a zaokrouhlené na celé číslo, ostatní hodnoty na jedno desetinné místo, jen když nejsou celé;
  - u karty atributu porovná `heroStats` před a po:
    - STR: `stat.maxHp` (celé číslo), `stat.regen` (1 desetinné místo);
    - AGI: `stat.armor` (1 desetinné místo), `stat.attackSpeed` jako „+4 %“;
    - INT: `stat.spellPower` jako „+24 %“, `stat.cooldownScale` jako „−19 %“.
- **Konec:** výsledek, čas, zabití, úroveň, seed a tlačítko „Hrát znovu“.
- **Snímek stavu:** `screen` v `window.__game` nabývá `menu | playing | levelUp | won | lost`.

Texty (klíč, EN, CS):

| Klíč | EN | CS |
|---|---|---|
| `menu.title` | Defense Webgame | Defense Webgame |
| `menu.subtitle` | Hold the castle for three minutes. | Ubraň hrad tři minuty. |
| `menu.hero` | Hero: {name} | Hrdina: {name} |
| `menu.start` | Start | Hrát |
| `menu.controls` | WASD or arrows to move. Spells cast themselves. | Pohyb WASD nebo šipkami. Kouzla se sesílají sama. |
| `menu.language` | Language | Jazyk |
| `hud.level` | Level {n} | Úroveň {n} |
| `hud.phase` | Phase {n}/{total} | Fáze {n}/{total} |
| `hud.castle` | Castle | Hrad |
| `hud.kills` | Kills: {n} | Zabito: {n} |
| `hud.ready` | ready | připraveno |
| `hud.castleAttacked` | The castle is under attack! | Hrad je pod útokem! |
| `cards.title` | Choose an upgrade | Vyber vylepšení |
| `cards.ability` | {name}: level {n} | {name}: úroveň {n} |
| `cards.str` | Strength +{n} | Síla +{n} |
| `cards.agi` | Agility +{n} | Obratnost +{n} |
| `cards.int` | Intelligence +{n} | Inteligence +{n} |
| `cards.keys` | Press 1, 2 or 3 | Stiskni 1, 2 nebo 3 |
| `stat.damage` | Damage | Poškození |
| `stat.length` | Length | Délka |
| `stat.width` | Width | Šířka |
| `stat.stunSeconds` | Stun (s) | Omráčení (s) |
| `stat.waveSpeed` | Wave speed | Rychlost vlny |
| `stat.cooldown` | Cooldown (s) | Přebití (s) |
| `stat.maxHp` | Max HP | Max. životy |
| `stat.regen` | HP regen /s | Obnova životů /s |
| `stat.armor` | Armor | Brnění |
| `stat.attackSpeed` | Attack speed | Rychlost útoku |
| `stat.spellPower` | Spell power | Síla kouzel |
| `stat.cooldownScale` | Cooldowns | Přebití kouzel |
| `end.won` | You held the castle! | Hrad jsi ubránil! |
| `end.lostCastle` | The castle has fallen. | Hrad padl. |
| `end.lostHero` | Your hero has fallen. | Tvůj hrdina padl. |
| `end.time` | Time: {time} | Čas: {time} |
| `end.kills` | Kills: {n} | Zabito: {n} |
| `end.level` | Level: {n} | Úroveň: {n} |
| `end.seed` | Seed: {seed} | Seed: {seed} |
| `end.again` | Play again | Hrát znovu |
| `error.noGpu` | Your browser supports neither WebGPU nor WebGL2. | Prohlížeč nepodporuje WebGPU ani WebGL2. |
| `error.generic` | Something went wrong: {message} | Něco se pokazilo: {message} |

- [ ] **Step 1: Napiš testy.**
  - `i18n.test.ts`:
    - `cs has exactly the en keys` (i za běhu);
    - `pickLang prefers the URL, then storage, then the browser`;
    - `t fills placeholders`.
  - `card-lines.test.ts` (stonehorn na úrovni 1):
    - `ability card lists changed params with spell power`: rock-rupture 1 → 2 dá `stat.damage 620 → 1240` a `stat.width 350 → 400`, nic dalšího;
    - `strength card shows max hp and regen`: +10 STR dá `1325 → 1475` a `2 → 2.5`;
    - `intelligence card shows spell power and cooldowns`: +10 INT dá `+24 % → +34 %` a `−19 % → −25 %`.
- [ ] **Step 2:** Implementuj. Žádný text pro hráče mimo soubory zpráv; jména hrdiny a kouzla jdou z dat.
- [ ] **Step 3:** Test `renders the arena and the hero` v `e2e/game.spec.ts` nejdřív klikne na Start. Spusť `npm run check`, `npm run build` a `npm run e2e`; všechno musí projít. Ověř hru ručně (`npm run dev`): menu → běh → karta → konec, v EN i CS.
- [ ] **Step 4:** Commit `feat(client): add the menu, HUD, upgrade cards and end screen in English and Czech`.

### Task 12: E2E, CI a dokončení

**Files:**
- Create: `e2e/fixtures.ts`
- Modify: `e2e/game.spec.ts`, `e2e/spike.spec.ts`, `playwright.config.ts`, `.github/workflows/{ci.yml, pages.yml}`, `vite.config.ts`, `README.md`, `AGENTS.md`

**Interfaces:**
- Consumes: `window.__game` a `window.__game.debug` z Tasků 9 a 11, URL parametry z Tasku 9.
- Produces: `e2e/fixtures.ts` exportuje `test` a `expect`. Automatická fixture sbírá `console` chyby a `pageerror` a po každém testu ověří, že žádné nejsou. Používají ji oba spec soubory.

**E2E testy v `game.spec.ts`** (oba projekty, každý přiloží screenshot):
1. `menu starts a run on the available backend`:
   - `/?seed=1&lang=en` ukáže menu s tlačítkem „Start“;
   - po kliknutí je `screen === "playing"` a `frames > 30`;
   - backend odpovídá projektu a scéna není prázdná.
2. `level-up shows three cards and a pick resumes the run`:
   - `/?seed=1&debug=1&lang=cs`, Hrát, pak `__game.debug.grantXp(4)`;
   - `screen === "levelUp"`, tři karty a nadpis „Vyber vylepšení“;
   - po kliknutí na první kartu je `screen === "playing"` a `level === 2`.
3. `run ends with the end screen`:
   - `/?seed=1&duration=10&speed=8&lang=en`, Start;
   - do 90 s je `screen === "won"` a vidět je „You held the castle!“;
   - „Play again“ vrátí menu.

**CI a build:**
- `ci.yml`:
  - spouští se na `push` do `main` a na `pull_request`; nic se nespouští dvakrát;
  - `permissions: contents: read`;
  - `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`;
  - `timeout-minutes: 25`;
  - cache `~/.cache/ms-playwright` s klíčem `pw-${{ runner.os }}-${{ hashFiles('package-lock.json') }}`.
- `pages.yml`: `cancel-in-progress: false`.
- `playwright.config.ts`: `timeout: 180_000`.
- `vite.config.ts`: `build.chunkSizeWarningLimit: 1500`. Bundle three.js je velký záměrně, varování po buildu zmizí.

- [ ] **Step 1:** Fixture a tři testy; `spike.spec.ts` přepoj na fixture.
- [ ] **Step 2:** Uprav workflowy a konfigurace.
- [ ] **Step 3: Dokumentace.**
  - `README.md`: adresa hry, tabulka URL parametrů (`seed`, `speed`, `duration`, `debug`, `fps`, `lang`, `renderer`) a `npm run sim:run`.
  - `AGENTS.md`: příkaz `npm run sim:run` a URL parametry pro ladění.
  - `ARCHITECTURE.md`: části označené „planned in phase 1“ přepiš podle skutečného kódu. `docs/STATUS.md` označ fázi 1 jako hotovou.
- [ ] **Step 4:** Spusť `npm run check`, `npm run build` (bez varování o velikosti chunku), `npm run e2e` (oba projekty) a `npm run sim:run -- --runs 5`. Výstupy vlož do reportu.
- [ ] **Step 5:** Commit `test(e2e): cover the game flow; ci: tighten the workflows`.

---

## Hotovo, když (spec 8, fáze 1)

- Běh trvá 3 minuty, je deterministický a všechny testy procházejí: `npm run check`, `npm run e2e`, CI na PR.
- Autor odehraje běh v prohlížeči (po merge na GitHub Pages) a s `?fps=1` naměří zhruba 60 fps.

## Odloženo mimo fázi 1

- **MVP (fáze 2):**
  - skutečné mechaniky `enhanced-totem` (zesílený další útok každých 7 s, +300–1000 %) a `seismic-echo` (kouzla hrdiny omráčí na 1–3 s a dají 150–750);
  - léčení u `grave-grasp` (50–300 za úroveň);
  - tabulka typů útoku a brnění, záporné brnění, bonus rychlosti pohybu z obratnosti;
  - úskok a ultimátka, přehození karet, `design/scaling.md`;
  - další nepřátelé, elity a bossové; obchod, zlato a dřevo; věže a obtížnosti.
- **`tools/map-extract`:** `run.sh` počítá cesty od `$PWD`; test použití nehlídá exit kód 2 ani případ s jedním argumentem; `setup_tools.sh` klonuje StormLib bez pevného commitu.
- **data-build:** přetypování `as` místo parsování design souborů schématem.
- **GitHub:** ochrana větve `main` (nastavení autora).
- **Náhledy větví** (Cloudflare Pages, spec 4) potřebují účet autora. Do té doby se hraje z `main` po merge.
