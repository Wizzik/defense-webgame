# Fáze 1: vertikální řez – implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tříminutový běh v prohlížeči od menu po konec. Hrdina Kamenorohý brání hrad proti jednomu typu nepřítele, Skalní zlom se sesílá sám, z nepřátel padají XP krystaly a na level-upu se volí karty. Běh je deterministický a pokrytý testy.

**Architecture:**
- `sim/` je čistá deterministická simulace: pevný krok 30× za sekundu, seedované proudy RNG, entity v typovaných polích, vstupy jako příkazy, výstupem stav a události.
- `client/` simulaci krokuje, vykresluje interpolovaný stav (Three.js, instancovaný dav s VAT ze spiku) a nad canvasem kreslí HTML/CSS rozhraní v EN a CS.
- Herní data jdou dál cestou `design/*.yaml` → `data:build` → `data/generated/*.json`. Přibude nepřítel a konfigurace běhu. Z dat, která klient zabalí, zmizí kódy a poznámky z mapy.

**Tech Stack:** beze změny proti fázi 0: Node 22, TypeScript 7.0.2, Vite 8.3.5, Vitest 5.1.0, Three.js 0.187.0 (+ @types/three 0.187.0), zod 4.6.7, yaml 2.9.1, tsx 4.23.15, @playwright/test 1.63.0. Žádné nové závislosti.

**Spec:** `docs/superpowers/specs/2026-11-04-defense-webgame-design.md` (oddíly 3.1–3.4, 4, 5, 6, 7 a fáze 1 v oddílu 8).

## Global Constraints

**Clean room (spec 1, 4, 5; AGENTS.md):**
- Do gitu nesmí `data-source/`, `xhero/`, `*.w3x` ani `war3map.*`.
- Kódy a jména z mapy (rawcodes, jména hrdinů, kouzel, jednotek a triggerů) smí být jen v `tools/`, `design/` a `docs/`. Nikdy v `client/`, `sim/`, `data/generated/` ani v textech rozhraní. Od úkolu 1 to hlídají testy.
- Žádné texty z mapy. Jména a texty jsou vlastní, v EN i CS.

**Data:**
- `data/generated/*.json` se needituje ručně.
- Změna dat znamená upravit `design/*.yaml`, spustit `npm run data:build -- --source data-source/v20.75/out --out data/generated` a commitnout vygenerované soubory. Export mapy je v tomto kontejneru v `data-source/v20.75/out`.

**Simulace (`sim/`):**
- bez `three`, bez importů z `client/`, bez DOM;
- pevný krok `TICK_RATE = 30`, `TICK_SECONDS = 1 / 30`. Systémy počítají s časem `tick × TICK_SECONDS` právě simulovaného kroku a `tick` se zvýší na konci kroku;
- náhoda jen ze seedovaných proudů `rng.spawn`, `rng.combat` a `rng.cards`;
- z `Math` jen `sqrt`, `floor`, `ceil`, `round`, `trunc`, `min`, `max`, `abs`, `sign`, `imul` a `fround`. Zakázané jsou `Math.random`, goniometrické funkce, `exp`, `log`, `pow`, `hypot`, `cbrt`, operátor `**`, `Date` a `performance`. Jejich výsledky se mezi prohlížeči liší, a to by rozbilo replaye i pozdější co-op;
- vzdálenosti v jednotkách mapy, rychlosti v jednotkách za sekundu, osa y míří na sever;
- v kroku simulace se nealokuje, pole vznikají při vytvoření běhu;
- stejný seed a stejné příkazy dají stejný otisk (`hash()`).

**Testy simulace:** situace se staví přes `sliceData` a přímý zápis do `World`. Test, který nezkoumá kouzla, nastaví `run.hero.startAbilities: []`. Test, který nezkoumá hrdinu, ho postaví dál než 1600 od nepřátel. Pozdější úkoly (útok hrdiny, kouzla) tak nerozbijí dřívější testy.

**Klient:**
- WebGPU s automatickým fallbackem na WebGL2.
- 1 jednotka světa Three.js odpovídá 64 jednotkám mapy (`MAP_UNITS_PER_WORLD_UNIT`). Bod mapy (x, y) leží ve světě na (x/64, 0, −y/64).
- Kamera shora pod úhlem 55°.

**Kód:** angličtina v kódu, identifikátorech a komentářích. Texty pro hráče jsou v `client/i18n/en.json` a `client/i18n/cs.json` se stejnými klíči. Malé soubory s jednou rolí. Přesné verze závislostí, žádné nové.

**Assety:** žádné nové soubory v `assets/`. Hrdina i nepřátelé používají model RobotExpressive (CC0). Hrad, brány, krystaly a efekty jsou z primitiv Three.js.

**Výkon:** 60 fps se 150 nepřáteli na notebooku autora (spec 1, bod 4). Strop živých nepřátel je `maxAliveEnemies: 150`.

**Git:**
- větev `phase-1` z `main`, commity po úkolech ve stylu Conventional Commits, před každým commitem projde `npm run check`;
- po každém zkontrolovaném úkolu push větve, na konci pull request; do `main` až se souhlasem autora.

**Náhledy:** platí odchylka z fáze 0: GitHub Pages jen z `main`, screenshoty z e2e jako artefakty CI. Cloudflare Pages s náhledy větví se zapojí, až autor založí účet.

## Co plán rozhoduje (ke kontrole autorem)

| Téma | Rozhodnutí | Proč |
|---|---|---|
| Hrdina | Kamenorohý (`stonehorn`), STR, útok na blízko | útok na blízko je nejjednodušší základ |
| Kouzlo | Skalní zlom (`rock-rupture`, druh `line`): letí ve směru pohybu, jinak na nejbližšího nepřítele; poškození a omráčení na 2 s | první podpisové kouzlo hrdiny; ukáže cílení podle pohybu |
| Nepřítel | Branec (`conscript`, EN Conscript) s čísly prvního vojáka lidské vlny mapy: 420 HP, brnění 3, útok 14–15 každých 1,35 s, rychlost 270 | podle spec jsou v prvních fázích lidé |
| Běh | 3 minuty, 4 fáze po 50 s, 2 brány; tok roste z 0,25 na 0,55 nepřítele za sekundu, podíl lovců z 25 na 40 % | zkrácená časová osa ze spec 3.1 a 3.2 |
| Hrad | 6000 HP, brnění 5, obnova 2 % maxima za minutu; pád znamená prohru | spec 3.2 |
| Level-up | XP krystaly s magnetem; 20 XP na 2. úroveň, každá další o 15 víc; 3 karty z nabídky: úroveň kouzla, +3 síla, +3 obratnost, +3 inteligence | spec 3.4; vychází 5–6 level-upů za 3 minuty |
| Atributy | STR dává HP a regeneraci, AGI rychlost útoku a brnění, INT sílu kouzel (+1 % za bod) a kratší cooldowny (−0,4 % za bod, nejvýš −40 %) | spec 3.4 a konstanty z mapy |
| Mimo fázi 1 | obchod, itemy, zlato, dřevo, věže, úskok, ultimátka, přehazování karet, obtížnosti, pauza přes Esc, ukládání | patří do MVP (fáze 2) |
| Data pro klienta | bez `source` a `review`; obojí zůstává v `design/*.yaml` | pravidlo ze 4. 11.: kódy z mapy se nedostanou k hráči |

Čísla běhu jsou výchozí. Úkol 8 je doladí tak, aby referenční bot přežil a nečinný bot prohrál.

## Review Focus

1. **Dlouhý snímek nebo návrat na skrytou kartu.** Smyčka nesmí dohánět stovky kroků najednou ani zamrznout. Přebytek se zahodí. Test: úkol 9, `ticksForFrame caps ticks and drops the backlog`.
2. **Level-up ve stejném kroku jako konec běhu.** Konec má přednost a běh nesmí uvíznout v čekání na kartu. Test: úkol 7, `level-up on the final tick ends the run as won`.
3. **Plný strop 150 živých nepřátel.** Spawn se zastaví bez chyby a po uvolnění místa nevychrlí nahromaděnou dávku. Test: úkol 4, `spawning pauses at maxAliveEnemies without a backlog`.
4. **Upravený `design/*.yaml` bez nového `data:build`.** CI musí neshodu odhalit, i když v něm `data:build` neběží. Test: úkol 1, `generated data matches the design files`, který úkol 2 rozšíří na nepřátele a běh.
5. **Nepřátelé na stejném místě jako hrdina nebo jeden na druhém.** Nulový vektor nesmí dát NaN, které se rozlije do pozic. Test: úkol 4, `no NaN when enemies overlap the hero and each other`.

---

## Mapa souborů po fázi 1

```
data/schema/{ability,hero,enemy,run,constants,common,index}.ts   schémata (enemy, run jsou nové)
design/{heroes,abilities,enemies,run}.yaml                        vstupy designu (enemies, run jsou nové)
data/generated/{heroes,abilities,enemies,run,constants}.json      generovaná data bez kódů mapy
tools/data-build/{build,load,resolve,map-abilities,map-heroes,map-enemies}.ts
sim/{constants,rng,hash,events,commands,world,run}.ts             jádro běhu
sim/{spatial-hash,enemy-pool,spawn,enemy-ai,hero-move}.ts         prostor, spawn a pohyb
sim/{combat,hero-stats,attacks,castle}.ts                         boj a hrad
sim/abilities/{params,registry,line}.ts                           kouzla
sim/{crystals,progression,cards}.ts                               XP, level-up, karty
sim/bots.ts, sim/testing/data.ts                                  boti a testovací data
client/game/{params,loop,input,game-data,session,probe}.ts        běh ve stránce
client/render/{units,renderer,model,stage,camera-rig,hero-view,enemies-view,crystals-view}.ts
client/render/vat/{bake-vat,vat-layout,crowd-renderer}.ts         dav (sdílí ho hra i spike)
client/render/effects/{rupture-effect,death-burst}.ts
client/ui/{i18n,menu,hud,cards,card-text,end-screen,format,fps-overlay,frame-stats}.ts, client/ui/styles.css
client/i18n/{en,cs}.json
client/spike/{index.html,main.ts,crowd.ts}                        benchmark davu nad sdíleným rendererem
e2e/{fixtures,game.spec,spike.spec}.ts
```

## Převzato z fáze 0

| Odložená připomínka | Kde se řeší |
|---|---|
| `review` s jmény triggerů v `data/generated/abilities.json` (I6) | úkol 1 |
| kódy mapy (`source`) v datech, která klient zabalí | úkol 1 |
| strážní test `sim/` nevidí `globalThis.window`, `window[...]` a `../client` bez lomítka | úkol 1 |
| prázdná cesta v chybě schématu se vypíše jako „: zpráva“ | úkol 1 |
| chybí kontrola shody `design/` ↔ `data/generated` (M3) | úkoly 1 a 2 |
| `assets/LICENSES.md` nikdo nehlídá (M4) | úkol 1 |
| `catchall` v parametrech propustí překlep v klíči (M2) | úkol 6 (známé klíče pro implementované druhy) |
| `damageMin/Max` hrdiny bez bonusu z primárního atributu (M9) | úkol 5 |
| klient se typuje s typy Node (M5) | úkol 9 |
| chyby uvnitř smyčky obejdou chybovou hlášku | úkol 9 |
| česká odkazová věta na anglické úvodní stránce | úkol 9 (stránku nahradí hra) |
| rozpočet atributů vrcholu ve WebGPU (14/16) | úkol 10 (sbalené atributy, `vertexIndex`) |
| šířka VAT textury přes limit WebGL2 2048 (M10) | úkol 10 (VAT ve 2D dlaždicích) |
| `MAX_NEIGHBOURS` tiše ořízne dotazy | úkol 4: ořez platí jen pro separaci, zásahy a cílení procházejí celý pool |
| skrytá karta zkreslí statistiky fps | úkol 11 |
| kontrola chyb v konzoli jen v prvním e2e testu (M8) | úkol 12 |
| e2e timeout 120 s bez rezervy, CI bez `timeout-minutes` | úkol 12 |

**Odloženo na později:**
- repo guard vidí jen sledované soubory (záměr);
- `run.sh` a jeho testy (nástroj se ve fázi 1 nemění);
- mezery v testech schémat: úrovně 0 a 6, záporný cooldown, zpráva u duplicitního id, křížové chyby skryté za chybami schématu, `fixture(): any`;
- přetypování `as Ability` v data-build, pořadí klíčů u hrdinů, komentář ke zdroji `ATTACK_SPEED_CAP`;
- scratch buffer na úrovni modulu, šev ve smyčce VAT animace;
- `cancel-in-progress` v Pages, poznámka k IPv4/IPv6, cache prohlížečů Playwrightu, oprávnění a duplicitní běhy CI, ochrana větví (nastavení GitHubu);
- kotvy regexů v guardu (M1), nepřipnutá verze v `setup_tools.sh` (M6), varování o chunku nad 500 kB;
- náhradní modely při selhání načtení assetu (spec 7). Fáze 1 zkusí načtení dvakrát a pak ukáže chybovou hlášku;
- šipka k hradu u okraje obrazovky (spec 3.2). Fáze 1 má upozornění v HUD;
- lokální log chyb ve hře (spec 7). Fáze 1 píše chyby do konzole a ukáže chybovou hlášku.

---

### Task 1: Data pro klienta bez kódů mapy

**Files:**
- Modify: `data/schema/ability.ts`, `data/schema/hero.ts`, `data/schema/index.ts`, `data/schema/schema.test.ts`
- Modify: `tools/data-build/map-abilities.ts`, `tools/data-build/map-heroes.ts`, `tools/data-build/data-build.test.ts`
- Modify: `data/generated.test.ts`, `tests/repo-guard.test.ts`
- Regenerate: `data/generated/heroes.json`, `data/generated/abilities.json`
- Modify: `AGENTS.md` (oddíl Clean room), `docs/superpowers/specs/2026-11-04-defense-webgame-design.md` (oddíl 4, Data)

**Interfaces:**
- Produces: runtime `Hero` = `{ id, name, primary, moveSpeed, attributes, baseAttack, signatureAbilities, ultimate }` a runtime `Ability` = `{ id, name, kind, targeting, levels, cooldown, params }`. Objekty hrdiny a kouzla jsou ve schématu striktní: neznámý klíč (například `source`) shodí `validateGameData`.
- Produces: `GameDataError` píše u prázdné cesty `(root)`, například `(root): Invalid input`.
- Consumes: `review` a `mapName` v `design/*.yaml` zůstávají. data-build dál odmítne `review` u kouzla, které nemá skriptovou implementaci, jen ho nezapíše do výstupu.

- [ ] **Step 1: Napiš padající testy**
  - `data/schema/schema.test.ts`:
    - `rejects map keys in runtime data`: platný hrdina s `source: "O00C"` vyhodí `GameDataError` se zprávou obsahující `heroes.0` a `source`; platné kouzlo s `review` vyhodí chybu obsahující `abilities.0` a `review`.
    - `reports (root) for non-object input`: `validateGameData(null)` vyhodí chybu, jejíž zpráva začíná `(root): `.
  - `data/generated.test.ts`:
    - `carries no map identifiers`: `FORBIDDEN_KEYS` navíc obsahuje `source` a `review`. Text žádného vygenerovaného souboru neobsahuje `TRIGSTR`, `Trig_`, `InitTrig_` ani `war3map`. Žádná řetězcová hodnota se nerovná hodnotě `source` nebo `mapName` z `design/*.yaml` (soubory čte přes `yaml`).
    - `generated data matches the design files`: pro `heroes.yaml` a `abilities.yaml` mají vygenerované seznamy stejná id ve stejném pořadí a stejné `name`; kouzla mají stejné `kind` a `targeting`, hrdinové stejné `signatureAbilities` a `ultimate`.
  - `tests/repo-guard.test.ts`:
    - `lists every asset in LICENSES.md`: každý sledovaný soubor pod `assets/` kromě `assets/LICENSES.md` je v `LICENSES.md` uvedený cestou relativní k `assets/`.
    - Detekce ve stávajícím testu `keeps sim/ free of three, client/ and DOM` se přesune do funkce `simViolations(source: string): string[]` v témže souboru. Tabulkový test `simViolations flags imports and DOM access`:

      | Musí najít | Nesmí najít |
      |---|---|
      | `import { Mesh } from "three"` | `const windowSize = 1;` |
      | `await import("three/webgpu")` | `import { x } from "./clientless";` |
      | `import { a } from "../client"` | `const documented = true;` |
      | `import { b } from "../../client/render/x"` | |
      | `window.innerWidth`, `window["x"]`, `globalThis.window`, `document.body`, `navigator.gpu` | |
    - `client/ and sim/ never name map content`: žádný soubor `.ts`, `.html`, `.json` ani `.css` pod `client/` a `sim/` neobsahuje hodnotu `source` ani `mapName` z `design/*.yaml` jako celé slovo.

- [ ] **Step 2: Spusť testy a ověř, že padají**

  Run: `npx vitest run data tests tools`
  Expected: FAIL v nových testech (generovaná data obsahují `source` a `review`).

- [ ] **Step 3: Uprav schémata a data-build**
  - Z runtime schémat zmizí `source` i `review`, objekty hrdiny a kouzla jsou striktní a prázdná cesta v `GameDataError` se vypíše jako `(root)`.
  - `mapHero` a `mapAbility` už `source` ani `review` nevrací. Kontrola, že `review` je jen u kouzel se skriptovou implementací, zůstane v `map-abilities.ts`.
  - `data-build.test.ts` se upraví na nový výstup.

- [ ] **Step 4: Přegeneruj data a spusť kontrolu**

  Run: `npm run data:build -- --source data-source/v20.75/out --out data/generated && npm run check`
  Expected: PASS. `git diff --stat data/generated` ukazuje jen ubrané řádky `source` a `review`.

- [ ] **Step 5: Uprav pravidla a spec**
  - `AGENTS.md`: odrážku „Known exception…“ nahradí „`data/generated/` holds no map identifiers: `source`, `mapName` and porting notes (`review`) stay in `design/*.yaml`.“
  - Spec, oddíl 4, Data: „každý objekt nese původní kód z mapy (`source`)“ → „každý objekt v `design/*.yaml` nese původní kód z mapy (`source`); `data/generated/` ho nemá, protože ta data zabalí klient“.

- [ ] **Step 6: Commit**

  ```bash
  git add data tools tests AGENTS.md docs/superpowers/specs
  git commit -m "feat(data): keep map codes and porting notes out of runtime data"
  ```

### Task 2: Nepřítel a konfigurace běhu v datech

**Files:**
- Create: `data/schema/enemy.ts`, `data/schema/run.ts`
- Modify: `data/schema/hero.ts`, `data/schema/constants.ts`, `data/schema/index.ts`, `data/schema/schema.test.ts`
- Create: `design/enemies.yaml`, `design/run.yaml`
- Create: `tools/data-build/map-enemies.ts`, `tools/data-build/fixtures/export/units.json`, `tools/data-build/fixtures/design/enemies.yaml`, `tools/data-build/fixtures/design/run.yaml`
- Modify: `tools/data-build/load.ts`, `tools/data-build/build.ts`, `tools/data-build/map-heroes.ts`, `tools/data-build/data-build.test.ts`
- Modify: `data/generated.test.ts`
- Regenerate: `data/generated/*.json` a nové `data/generated/enemies.json`, `data/generated/run.json`

**Interfaces:**
- Produces (`data/schema`):
  - `EnemySchema` (striktní): `{ id: Slug, name: LocalizedText, hp, armor, damageMin, damageMax, attackCooldown, attackRange, moveSpeed, radius, xp }`. Čísla jsou kladná, `armor` ≥ 0, `xp` je kladné celé číslo a `damageMax` ≥ `damageMin`. Typ `Enemy`.
  - `RunConfigSchema` (striktní, tvar přesně podle `design/run.yaml` níže). Typ `RunConfig`. Kontroly: součet `phases[].seconds` ≥ `lengthSeconds`; `hero.start`, `castle` a `gates` leží v aréně (|x| ≤ `halfWidth`, |y| ≤ `halfHeight`); `hunterShare` je v ⟨0, 1⟩. `hero.startAbilities` smí být prázdné, testy tak vypnou kouzla.
  - `Hero` navíc má `hp` (kladné) a `armor`.
  - `Constants` = `{ strHitPointBonus, strAttackBonus, agiAttackSpeedBonus, agiDefenseBonus, defenseArmor, attackSpeedCap, mapVersion }`. `defenseArmor` dostane komentář: násobitel brnění ve vzorci snížení poškození.
  - `GameData` = `{ heroes, abilities, enemies, run, constants }`.
  - `validateGameData` navíc hlásí duplicitní id nepřítele, `run.hero.id: unknown hero "<id>"`, `run.enemy: unknown enemy "<id>"` a `run.hero.startAbilities.<i>: unknown ability "<id>"`.
- Produces (data-build): `mapEnemy(exp: ExportUnit, entry: EnemyEntry): Enemy`. Čte pole `hp`, `armor`, `damage_min`, `damage_max`, `cooldown`, `range`, `move_speed` a `collision` z `units.json` a `id`, `name` a `xp` z designu. `mapHero` navíc čte `hp` a `armor`. Konstanty `StrAttackBonus` a `AgiDefenseBonus` se berou z `misc_constants`. `run.yaml` projde beze změny a ověří ho schéma. `writeGameData` zapíše pět souborů.

`design/enemies.yaml`:

```yaml
# Enemy types. source: unit code in the map export (units.json). mapName: only for looking the unit up.
# xp is a design value: the XP curve is tuned, not taken from the map (spec 3.4).
- id: conscript
  source: hfoo
  mapName: Footman
  name: { en: Conscript, cs: Branec }
  xp: 5
```

`design/run.yaml`:

```yaml
# The phase-1 vertical slice run. Distances are map units, times seconds, speeds map units per second.
# All values are design defaults; the bot runs of phase 1 (Task 8) tune them.
lengthSeconds: 180
arena: { halfWidth: 2048, halfHeight: 2048 }
hero:
  id: stonehorn
  startAbilities: [rock-rupture]
  start: { x: 0, y: -1350 }
  radius: 32
  baseRegen: 0.25
castle: { x: 0, y: -1700, radius: 160, hp: 6000, armor: 5, regenPerMinute: 0.02 }
gates:
  - { x: -1100, y: 1800 }
  - { x: 1100, y: 1800 }
enemy: conscript
maxAliveEnemies: 150
spawnJitter: 96
phases:
  - { seconds: 50, spawnsPerSecond: 0.25, hunterShare: 0.25 }
  - { seconds: 50, spawnsPerSecond: 0.35, hunterShare: 0.3 }
  - { seconds: 50, spawnsPerSecond: 0.45, hunterShare: 0.35 }
  - { seconds: 50, spawnsPerSecond: 0.55, hunterShare: 0.4 }
enemyScaling: { perMinute: 0.05, max: 2 }
siege: { aggroRadius: 250, leashRadius: 900 }
xp: { first: 20, step: 15 }
magnet: { radius: 300, speed: 700, pickupRadius: 48 }
cards: { attributeAmount: 3 }
attributes: { strRegenBonus: 0.05, spellPowerPerInt: 0.01, cooldownReductionPerInt: 0.004, cooldownReductionCap: 0.4 }
```

- [ ] **Step 1: Napiš padající testy**
  - `schema.test.ts`: `rejects a run whose phases end before lengthSeconds`, `rejects an unknown run.enemy` (zpráva `run.enemy: unknown enemy "ghost"`), `rejects an enemy with damageMax below damageMin`, `rejects a gate outside the arena`.
  - `data-build.test.ts` nad fixturami: `maps an enemy from units.json` (celý očekávaný objekt), `fails with readable error when an enemy source is missing` (zpráva `design/enemies.yaml: conscript: source u999 not found in units.json`), `copies run.yaml unchanged`.
  - `data/generated.test.ts`:
    - `conscript matches the map's first-wave soldier`: `{ hp: 420, armor: 3, damageMin: 14, damageMax: 15, attackCooldown: 1.35, attackRange: 90, moveSpeed: 270, radius: 31, xp: 5 }`;
    - `stonehorn has the map's base stats`: `hp: 800`, `armor: 5`;
    - `constants carry the attribute bonuses`: `strAttackBonus: 1`, `agiDefenseBonus: 0.1`;
    - `generated data matches the design files` navíc pokrývá `enemies.yaml` (id, `name`, `xp`) a kontroluje, že `run.json` se hluboce rovná rozparsovanému `design/run.yaml`.

- [ ] **Step 2: Spusť testy a ověř, že padají**

  Run: `npx vitest run data tools`
  Expected: FAIL (schémata, data-build a soubory zatím neexistují).

- [ ] **Step 3: Implementuj schémata, data-build a designové soubory podle Interfaces**

- [ ] **Step 4: Přegeneruj data a spusť kontrolu**

  Run: `npm run data:build -- --source data-source/v20.75/out --out data/generated && npm run check`
  Expected: výpis `data:build: 4 heroes, 16 abilities, 1 enemies (v20.75) -> data/generated` a PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add data tools design
  git commit -m "feat(data): add the conscript enemy and the slice run config"
  ```

### Task 3: Jádro simulace

**Files:**
- Create: `sim/constants.ts`, `sim/rng.ts`, `sim/rng.test.ts`, `sim/hash.ts`, `sim/hash.test.ts`, `sim/events.ts`, `sim/commands.ts`, `sim/world.ts`, `sim/hero-move.ts`, `sim/run.ts`, `sim/run.test.ts`, `sim/determinism.test.ts`, `sim/testing/data.ts`
- Move: `client/spike/spatial-hash.ts` a jeho test do `sim/spatial-hash.ts` a `sim/spatial-hash.test.ts`; `client/spike/crowd.ts` ho importuje z `../../sim/spatial-hash`
- Modify: `sim/index.ts`, `sim/tsconfig.json` (`"resolveJsonModule": true`), `tests/repo-guard.test.ts`, `AGENTS.md` (oddíl Code rules)

**Interfaces:**
- Produces:

  ```ts
  // sim/constants.ts
  export const TICK_RATE = 30;
  export const TICK_SECONDS = 1 / TICK_RATE;
  // sim/rng.ts (mulberry32 ze spiku)
  export interface Rng { next(): number /* [0, 1) */; state(): number /* uint32, pro hash */ }
  export function createRng(seed: number): Rng;
  export function deriveSeed(seed: number, stream: number): number; // uint32, míchá přes Math.imul
  // sim/hash.ts (FNV-1a, 32 bitů)
  export class Hasher { reset(): void; number(value: number): void /* bity float64 */; value(): number }
  // sim/events.ts
  export const EventType = {
    EnemySpawned: 1,  // a: slot
    EnemyHit: 2,      // a: slot, b: poškození, c: zdroj (0 útok, 1 kouzlo)
    EnemyDied: 3,     // a: slot, b: x, c: y
    HeroAttacked: 4,  // a: slot cíle
    HeroHit: 5,       // a: poškození
    CastleHit: 6,     // a: poškození
    AbilityCast: 7,   // a: slot kouzla, b: x, c: y, d: dirX, e: dirY, f: délka, g: šířka
    CrystalPicked: 8, // a: xp
    LevelUp: 9,       // a: nová úroveň
    PhaseChanged: 10, // a: index fáze
    RunEnded: 11,     // a: 0 přežil, 1 hrad, 2 hrdina
  } as const;
  export class EventBuffer {
    static readonly CAPACITY = 2048;
    count: number; dropped: number;
    readonly type: Uint8Array; readonly a: Float64Array; /* … */ readonly g: Float64Array;
    clear(): void;
    push(type: number, a?: number, b?: number, c?: number, d?: number, e?: number, f?: number, g?: number): void; // při plném bufferu jen dropped++
  }
  // sim/commands.ts
  export type Command = { type: "move"; x: number; y: number } | { type: "card"; index: number };
  // sim/world.ts
  export type RunStatus = "running" | "level_up" | "won" | "lost";
  export type EndReason = "survived" | "castle" | "hero";
  export interface HeroState { x: number; y: number; moveX: number; moveY: number; velocityX: number; velocityY: number; hp: number; level: number; xp: number; str: number; agi: number; int: number }
  export interface CastleState { x: number; y: number; radius: number; hp: number; maxHp: number; armor: number }
  export interface RunStats { kills: number; damageDealt: number; damageTaken: number }
  export interface World {
    readonly data: GameData; readonly heroData: Hero;
    tick: number; status: RunStatus; endReason: EndReason | null;
    hero: HeroState; castle: CastleState;
    rng: { spawn: Rng; combat: Rng; cards: Rng }; // seedy deriveSeed(seed, 0/1/2)
    events: EventBuffer; stats: RunStats;
  }
  export function createWorld(data: GameData, seed: number): World;
  // sim/run.ts
  export interface Run { readonly world: World; step(commands?: readonly Command[]): void; hash(): number }
  export function createRun(data: GameData, options: { seed: number }): Run;
  // sim/testing/data.ts (jen pro testy)
  export function sliceData(patch?: (data: GameData) => void): GameData; // hluboká kopie data/generated, úprava, validateGameData
  ```
- Pořadí v `step` (doplňují ho další úkoly): `events.clear()`, aplikace příkazů, při stavu jiném než `running` konec, systémy, `tick++` a kontrola konce. Ve fázi 1 se běh vyhraje, když `tick` dosáhne `lengthSeconds × TICK_RATE`; pak `status = "won"`, `endReason = "survived"` a vznikne `RunEnded`.
- Příkaz `move` nastaví směr hrdiny. Vektor delší než 1 se normalizuje, vektor kratší než 1e-9 znamená stát. Hrdina se pohybuje rychlostí `heroData.moveSpeed` a zůstává v aréně zmenšené o svůj poloměr.
- Hrdina začíná na `run.hero.start`, má úroveň 1 a atributy podle `heroData.attributes.*.base`. Prozatím má `hp = heroData.hp`; úkol 5 to nahradí hodnotou `stats.maxHp`.
- `hash()` pokryje všechno, na čem závisí další krok: `tick`, stav, hrdinu, hrad a stavy RNG. Další úkoly do něj přidají svůj stav.

- [ ] **Step 1: Napiš padající testy**
  - `rng.test.ts`: `same seed repeats the sequence` (2× seed 42, prvních 5 hodnot je stejných); `values stay in [0, 1)` (10 000 tahů); `derived streams differ` (`deriveSeed(1, 0) !== deriveSeed(1, 1)` a liší se i první tahy).
  - `hash.test.ts`: `same inputs give the same hash`; `a one-ulp change changes the hash` (`1` proti `1 + Number.EPSILON`).
  - `run.test.ts`, data ze `sliceData` s nulovým spawnem (`spawnsPerSecond: 0` ve všech fázích):
    - `starts at tick 0 with the hero at run.hero.start`: (0, −1350), stav `running`;
    - `moves the hero moveSpeed/30 per tick`: `move (1, 0)` a 3 kroky dají x = 30;
    - `normalizes diagonal input`: `move (1, 1)` a 1 krok dá posun 7,0710678 v obou osách;
    - `keeps the hero inside the arena`: `move (−1, 0)` a 1000 kroků dá x = −2016;
    - `ends as won after lengthSeconds`: po 5400 krocích je stav `won` a `endReason` `survived`; poslední krok vydá `RunEnded` s `a = 0`;
    - `ignores steps after the end`: `tick` zůstane 5400.
  - `determinism.test.ts`: `same seed and commands give the same hash`. Dva běhy se seedem 9 dostanou stejné příkazy `move` se směrem měněným po 50 krocích; během 600 kroků mají po každém kroku stejný hash.
  - `tests/repo-guard.test.ts`: `keeps sim/ deterministic`. Funkce `simNondeterminism(source: string): string[]` s tabulkovým testem. Najít musí `Math.random()`, `Math.sin(a)`, `Math.atan2(y, x)`, `Math.pow(x, 2)`, `x ** 2`, `Date.now()` a `performance.now()`. Nesmí najít `Math.sqrt(x)`, `Math.floor(x)` ani `Math.imul(a, b)`. Test pak projde všechny soubory `sim/**/*.ts` kromě `*.test.ts` a nesmí najít nic.

- [ ] **Step 2: Spusť testy a ověř, že padají**

  Run: `npx vitest run sim tests`
  Expected: FAIL (moduly chybí).

- [ ] **Step 3: Implementuj moduly podle Interfaces a přesuň SpatialHash**

- [ ] **Step 4: Spusť kontrolu**

  Run: `npm run check && npm run e2e`
  Expected: PASS. Spike běží dál s `SpatialHash` ze `sim/`.

- [ ] **Step 5: Doplň pravidla do AGENTS.md** (oddíl Code rules): pevný krok 30 Hz, náhoda jen ze seedovaných proudů, povolené funkce `Math`, žádné alokace v kroku, jednotky mapy, osa y na sever.

- [ ] **Step 6: Commit**

  ```bash
  git add sim client/spike tests AGENTS.md
  git commit -m "feat(sim): add the deterministic run core"
  ```

### Task 4: Spawn a pohyb nepřátel

**Files:**
- Create: `sim/enemy-pool.ts`, `sim/spawn.ts`, `sim/spawn.test.ts`, `sim/enemy-ai.ts`, `sim/enemy-ai.test.ts`
- Modify: `sim/world.ts`, `sim/run.ts`, `sim/determinism.test.ts`

**Interfaces:**
- Consumes: `World`, `Rng`, `SpatialHash`, `EventBuffer` a `sliceData` z úkolu 3.
- Produces:

  ```ts
  // sim/enemy-pool.ts
  export const EnemyRole = { Sieger: 0, Hunter: 1 } as const;
  export const EnemyAction = { Move: 0, Attack: 1, Stunned: 2 } as const;
  export class EnemyPool {
    constructor(capacity: number);
    readonly capacity: number; alive: number;
    readonly active: Uint8Array; readonly generation: Uint32Array; // generation++ při každém spawnu do slotu
    readonly x: Float64Array; readonly y: Float64Array; readonly vx: Float64Array; readonly vy: Float64Array;
    readonly hp: Float64Array; readonly maxHp: Float64Array; readonly damageMul: Float64Array;
    readonly attackTimer: Float64Array; readonly stunTimer: Float64Array;
    readonly role: Uint8Array; readonly aggro: Uint8Array; readonly action: Uint8Array;
    spawn(x: number, y: number, role: number, maxHp: number, damageMul: number): number; // nejnižší volný slot, při plném poolu −1
    remove(slot: number): void;
  }
  // sim/spawn.ts
  export interface SpawnState { accumulator: number; spawned: number; phase: number }
  export function phaseAt(run: RunConfig, seconds: number): number;     // po konci časové osy poslední fáze
  export function spawnRateAt(run: RunConfig, seconds: number): number; // lineárně k sazbě další fáze, v poslední fázi konstantní
  export function enemyScaleAt(run: RunConfig, seconds: number): number; // min(max, 1 + perMinute × seconds / 60)
  export function updateSpawns(world: World): void;
  // sim/enemy-ai.ts
  export function updateEnemies(world: World): void;
  ```
- `World` navíc má `enemyData: Enemy`, `enemies: EnemyPool` s kapacitou `maxAliveEnemies`, `spawn: SpawnState` a `grid: SpatialHash`.
- **Spawn v každém kroku:**
  - Změna `phaseAt` vydá `PhaseChanged`.
  - `accumulator += spawnRateAt × TICK_SECONDS`. Dokud je `accumulator ≥ 1` a živých je méně než strop, vznikne jeden nepřítel a `accumulator −= 1`. Potom `accumulator = min(accumulator, 1)`, takže se nic nenahromadí.
  - Nepřítel stojí u brány `gates[spawned % gates.length]` posunutý o `(next() × 2 − 1) × spawnJitter` v x a potom v y. Roli `Hunter` dostane, když `next() < hunterShare` aktuální fáze. Všechny tři tahy jdou z `rng.spawn` v tomto pořadí.
  - `maxHp = enemyData.hp × enemyScaleAt` a `damageMul = enemyScaleAt`. Spawn vydá `EnemySpawned`.
- **Pohyb v každém kroku (sloty od nejnižšího):**
  - `grid` se postaví znovu.
  - Omráčený nepřítel (`stunTimer > 0`) jen odečte `TICK_SECONDS`, má akci `Stunned` a nehne se.
  - Obléhač dostane `aggro = 1`, když je hrdina blíž než `siege.aggroRadius`; o `aggro` přijde, když se hrdina vzdálí za `siege.leashRadius`. Úkol 5 přidá aggro po zásahu od hrdiny.
  - Lovec nebo obléhač s aggro jde na hrdinu. Ostatní jdou na hrad.
  - Na dosah je nepřítel, když je od středu cíle nejvýš `poloměr cíle + enemyData.radius + enemyData.attackRange` (u hrdiny `run.hero.radius`, u hradu `castle.radius`). Pak má akci `Attack` a stojí. Jinak má akci `Move` a jde k cíli rychlostí `moveSpeed`.
  - Separace bere sousedy do `2 × radius` (nejvýš 32 z mřížky). Tlak lineárně roste až k `moveSpeed` při úplném překryvu. Při vzdálenosti pod 1e-9 se dvojice rozejde po ose x (nižší slot doprava).
  - Po pohybu se nepřítel vytlačí z kruhu hrdiny (`run.hero.radius + radius`) a z kruhu hradu (`castle.radius + radius`). Kdo stojí přesně ve středu, jde po (0, 1).
  - Žádná normalizace nedělí nulou.

- [ ] **Step 1: Napiš padající testy**
  - `spawn.test.ts`:
    - `phaseAt follows the phase table`: 0 → 0, 49,99 → 0, 50 → 1, 199 → 3, 500 → 3;
    - `spawnRateAt ramps between phases`: 0 → 0,25, 25 → 0,30, 50 → 0,35, 175 → 0,55, 300 → 0,55;
    - `enemyScaleAt grows and caps`: 0 → 1, 120 → 1,1, 3600 → 2;
    - `spawns about the integral of the rate`: hrdina a hrad dostanou přes `sliceData` HP 1e9; po 5400 krocích je spawnutých 75 až 77;
    - `alternates gates`: první 4 spawny leží v okruhu 96 kolem bran 0, 1, 0, 1;
    - `hunter share follows the phase`: jedna fáze na 200 s se sazbou 20/s a `hunterShare: 0.3`; test po každém kroku odebere všechny nepřátele; z 3000 spawnů je lovců 27 až 33 %;
    - `spawning pauses at maxAliveEnemies without a backlog`: `maxAliveEnemies: 10` a sazba 5/s; po 300 krocích žije 10; test odebere 5; po dalším kroku žije nejvýš 6.
  - `enemy-ai.test.ts` (nulový spawn, nepřátele staví test přes `enemies.spawn`):
    - `siegers walk to the castle`: obléhač v (0, 0) je po 30 krocích o 270 ± 1e-6 blíž hradu;
    - `siegers stop at attack reach of the castle`: po 600 krocích je od středu hradu 281 ± 9 a má akci `Attack`;
    - `a sieger aggroes the hero within aggroRadius`: hrdina 200 od obléhače, ten jde na hrdinu;
    - `a sieger drops aggro beyond leashRadius`: hrdina odejde přes 900, `aggro` je 0 a nepřítel jde zase na hrad;
    - `hunters chase the hero`;
    - `stunned enemies do not move`: se `stunTimer = 1` drží nepřítel pozici 29 kroků a nejpozději ve 32. kroku se pohne;
    - `no NaN when enemies overlap the hero and each other`: 20 nepřátel přesně na pozici hrdiny; po 60 krocích jsou všechny souřadnice konečné a každý nepřítel je od hrdiny aspoň `32 + 31 − 1e-6`.
  - `determinism.test.ts`: `different seeds give different hashes` (seedy 1 a 2, po 300 krocích).

- [ ] **Step 2: Spusť testy a ověř, že padají**

  Run: `npx vitest run sim`
  Expected: FAIL.

- [ ] **Step 3: Implementuj pool, spawn a pohyb podle Interfaces**

- [ ] **Step 4: Spusť kontrolu**

  Run: `npm run check`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add sim
  git commit -m "feat(sim): spawn enemies by phase and move siegers and hunters"
  ```

### Task 5: Boj, hrad a konec běhu

**Files:**
- Create: `sim/combat.ts`, `sim/combat.test.ts`, `sim/hero-stats.ts`, `sim/hero-stats.test.ts`, `sim/attacks.ts`, `sim/attacks.test.ts`, `sim/castle.ts`
- Modify: `sim/world.ts`, `sim/run.ts`, `sim/run.test.ts`, `sim/enemy-ai.ts` (aggro po zásahu)

**Interfaces:**
- Consumes: `World`, `EnemyPool`, `EnemyAction`, `EventType` z úkolů 3 a 4.
- Produces:

  ```ts
  // sim/combat.ts
  export function armorReduction(armor: number, k: number): number;                  // armor ≤ 0 → 0, jinak a·k / (1 + a·k)
  export function physicalDamage(amount: number, armor: number, k: number): number;  // amount × (1 − armorReduction)
  export function damageEnemy(world: World, slot: number, amount: number, source: 0 | 1): void;
  // ubere HP, vydá EnemyHit, stats.damageDealt += min(amount, HP před zásahem), obléhač dostane aggro = 1
  // sim/hero-stats.ts
  export interface HeroStats { maxHp: number; regen: number; armor: number; attackCooldown: number; damageMin: number; damageMax: number; spellPower: number; cooldownMultiplier: number }
  export function computeHeroStats(hero: HeroState, data: GameData): HeroStats;
  // sim/attacks.ts
  export function updateHeroAttack(world: World): void;
  export function updateEnemyAttacks(world: World): void;
  export function removeDeadEnemies(world: World): void; // HP ≤ 0: EnemyDied, stats.kills++, enemies.remove
  // sim/castle.ts
  export function updateRegen(world: World): void;
  ```
- `HeroState` navíc má `attackTimer` a `stats: HeroStats`. Statistiky se přepočítají při každé změně atributů a `hp` začíná na `stats.maxHp`.
- **Vzorce** (`h` = data hrdiny, `c` = `constants`, `a` = `run.attributes`, `p` = hodnota primárního atributu):
  - `maxHp = h.hp + str × c.strHitPointBonus`;
  - `regen = run.hero.baseRegen + str × a.strRegenBonus`;
  - `armor = h.armor + agi × c.agiDefenseBonus`;
  - `attackCooldown = h.baseAttack.cooldown / (1 + min(c.attackSpeedCap, agi × c.agiAttackSpeedBonus))`;
  - `damageMin = h.baseAttack.damageMin + p × c.strAttackBonus`, `damageMax` stejně;
  - `spellPower = 1 + int × a.spellPowerPerInt`;
  - `cooldownMultiplier = 1 − min(a.cooldownReductionCap, int × a.cooldownReductionPerInt)`.
- **Útok hrdiny:**
  - `attackTimer` klesá o `TICK_SECONDS` až na 0.
  - Při 0 hrdina zaútočí na nejbližšího živého nepřítele ve vzdálenosti nejvýš `baseAttack.range + run.hero.radius + enemyData.radius`; při shodě vyhraje nižší slot.
  - Hod je `damageMin + rng.combat.next() × (damageMax − damageMin)`. Poškození počítá `physicalDamage` s brněním nepřítele a `c.defenseArmor`, zdroj 0.
  - Útok vydá `HeroAttacked` a nastaví `attackTimer = attackCooldown`.
- **Útok nepřítele:**
  - `attackTimer` klesá vždy. Útočí nepřítel s akcí `Attack`, kladným HP a `attackTimer ≤ 0`.
  - Hod je `(damageMin + rng.combat.next() × (damageMax − damageMin)) × damageMul`. Na hrdinu jde `physicalDamage(hod, stats.armor)` s událostí `HeroHit` a přičte se do `stats.damageTaken`. Na hrad jde `physicalDamage(hod, castle.armor)` s událostí `CastleHit`.
  - Po útoku `attackTimer = attackCooldown`.
- **Regenerace:** hrdina dostane `regen × TICK_SECONDS`, hrad `maxHp × regenPerMinute / 60 × TICK_SECONDS`. Oboje nejvýš do maxima.
- **Pořadí v `step`:** spawn, pohyb nepřátel, pohyb hrdiny, útok hrdiny, útoky nepřátel, odebrání mrtvých, regenerace, `tick++`, kontrola konce.
- **Kontrola konce:** nejdřív pád hradu (`castle`, `RunEnded` s `a = 1`), pak smrt hrdiny (`hero`, `a = 2`) a nakonec čas (`survived`, `a = 0`).

- [ ] **Step 1: Napiš padající testy**
  - `combat.test.ts`: `armorReduction(3, 0.02)` ≈ 0,0566037736; `armorReduction(0, 0.02)` = 0; `armorReduction(−2, 0.02)` = 0; `physicalDamage(15, 3, 0.02)` ≈ 14,1509434.
  - `hero-stats.test.ts`:
    - `stonehorn at level 1`: `{ maxHp: 1325, regen: 2, armor: 7, attackCooldown: 1.4423076923, damageMin: 37, damageMax: 47, spellPower: 1.24, cooldownMultiplier: 0.904 }` (`toBeCloseTo` na 9 míst);
    - `attack speed bonus is capped`: `agi = 10 000` dá cooldown 1,5 / 7.
  - `attacks.test.ts`:
    - `the hero hits the nearest enemy in reach`: nepřátelé ve vzdálenosti 150 a 180, zásah dostane ten bližší a poškození leží v ⟨37, 47⟩ × (1 − 0,0566037736);
    - `a hero attack makes a sieger aggro`;
    - `an enemy hits the hero once per attackCooldown`: lovec na dosah, 90 kroků, 3× `HeroHit`;
    - `enemy damage grows with spawn time`: `perMinute: 0.5` a spawn v 60. sekundě dají `damageMul` 1,5;
    - `the castle regenerates 2 % of max HP per minute`: hrad na 3000 HP má po 1800 krocích bez nepřátel 3120 ± 1e-6;
    - `the castle falling ends the run as lost`: hrad s 1 HP a obléhač na dosah dají stav `lost`, `endReason` `castle` a `RunEnded`;
    - `hero death ends the run as lost`;
    - `dead enemies leave and count as kills`: nepřítel s 1 HP po zásahu vydá `EnemyDied`, `stats.kills` je 1 a `enemies.alive` 0.
  - `run.test.ts`: `ends as won after lengthSeconds` dál prochází s nulovým spawnem.

- [ ] **Step 2: Spusť testy a ověř, že padají**

  Run: `npx vitest run sim`
  Expected: FAIL.

- [ ] **Step 3: Implementuj boj, statistiky, hrad a konec podle Interfaces**

- [ ] **Step 4: Spusť kontrolu**

  Run: `npm run check`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add sim
  git commit -m "feat(sim): add combat, castle damage and the end of a run"
  ```

### Task 6: Kouzla a Skalní zlom

**Files:**
- Create: `sim/abilities/params.ts`, `sim/abilities/registry.ts`, `sim/abilities/registry.test.ts`, `sim/abilities/line.ts`, `sim/abilities/line.test.ts`
- Modify: `sim/world.ts`, `sim/run.ts`

**Interfaces:**
- Consumes: `damageEnemy` a `HeroStats` z úkolu 5, `EnemyPool.stunTimer` z úkolu 4.
- Produces:

  ```ts
  // sim/abilities/params.ts
  export const KIND_PARAMS: Partial<Record<Ability["kind"], { required: readonly string[]; optional: readonly string[] }>> = {
    line: { required: ["damage", "length", "width"], optional: ["stunSeconds"] },
  };
  // sim/abilities/registry.ts
  export interface AbilitySlot { ability: Ability; level: number; cooldownTimer: number }
  export interface AbilityKindImpl { tryCast(world: World, slot: AbilitySlot, index: number): boolean }
  export function createAbilitySlots(data: GameData): AbilitySlot[];
  // z run.hero.startAbilities, úroveň 1, cooldownTimer 0; vyhodí
  // `ability "<id>": kind "<kind>" is not implemented` nebo `ability "<id>": unknown param "<key>"` či `missing param "<key>"`
  export function updateAbilities(world: World): void;
  // cooldownTimer −= TICK_SECONDS; při ≤ 0 tryCast; po seslání cooldownTimer = cooldown[level − 1] × stats.cooldownMultiplier
  // sim/abilities/line.ts
  export function lineHits(ox: number, oy: number, dirX: number, dirY: number, length: number, width: number, px: number, py: number, radius: number): boolean;
  // zásah, když průmět na směr leží v ⟨−radius, length + radius⟩ a kolmá vzdálenost je nejvýš width / 2 + radius
  export const lineKind: AbilityKindImpl;
  ```
- `World` navíc má `abilities: AbilitySlot[]`. Volá ho `createRun`, takže neznámý druh nebo překlep v parametru shodí vytvoření běhu.
- **Seslání druhu `line`** (parametry z úrovně `level`, chybějící `stunSeconds` = 0):
  1. Když se hrdina hýbe a čára ve směru pohybu zasáhne aspoň jednoho živého nepřítele, sešle se tam.
  2. Jinak se sešle na nejbližšího živého nepřítele, který je nejvýš `length + radius` od hrdiny. Kdo stojí přesně na hrdinovi, dostane směr (0, 1).
  3. Jinak se kouzlo nesešle a čeká na další krok.
  - Každý zasažený nepřítel dostane `damageEnemy(damage × stats.spellPower, 1)` a `stunTimer = max(stunTimer, stunSeconds)`. Seslání vydá `AbilityCast`.
- Pořadí v `step`: kouzla jdou hned po útoku hrdiny.

- [ ] **Step 1: Napiš padající testy**
  - `line.test.ts`:
    - `lineHits measures along and across the line`: směr (1, 0), délka 1500, šířka 350, poloměr 31. Zásah dají body (100, 0), (1520, 0), (−30, 0) a (500, 206). Mimo jsou (1532, 0), (−32, 0) a (500, 207);
    - `casts in the move direction when the line holds an enemy`: pohyb na východ a nepřítel 600 východně dají `AbilityCast` s d = 1, e = 0;
    - `casts at the nearest enemy when the move line is empty`: pohyb na sever a nepřítel 600 východně dají d = 1, e = 0;
    - `holds the cast while no enemy is in range`: nepřítel ve 2000 nevyvolá seslání po 30 kroků; po přesunu na 600 přijde seslání v dalším kroku;
    - `deals damage times spell power and kills`: branec s 420 HP padne po jednom seslání na úrovni 1 (620 poškození);
    - `stuns survivors for stunSeconds`: nepřítel se 100 000 HP má po zásahu `stunTimer` 2 a 59 kroků se nehne;
    - `recasts after cooldown times cooldownMultiplier`: nesmrtelný nepřítel na dosah, seslání v krocích T a T + 326.
  - `registry.test.ts`:
    - `rejects a start ability of an unimplemented kind`: `startAbilities: ["earthquake"]` shodí `createRun` chybou, která obsahuje `earthquake` a `nova`;
    - `rejects unknown params`: `stunSeconds` přejmenované na `stunSecond` shodí `createRun` chybou s `stunSecond`;
    - `generated abilities of implemented kinds use known params`: u každého kouzla z `data/generated`, jehož druh je v `KIND_PARAMS`, jsou klíče podmnožinou `required ∪ optional` a obsahují celé `required`.

- [ ] **Step 2: Spusť testy a ověř, že padají**

  Run: `npx vitest run sim`
  Expected: FAIL.

- [ ] **Step 3: Implementuj registr, druh `line` a pořadí v kroku podle Interfaces**

- [ ] **Step 4: Spusť kontrolu**

  Run: `npm run check`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add sim
  git commit -m "feat(sim): auto-cast abilities and the line kind"
  ```

### Task 7: XP, level-up a karty

**Files:**
- Create: `sim/crystals.ts`, `sim/crystals.test.ts`, `sim/progression.ts`, `sim/progression.test.ts`, `sim/cards.ts`, `sim/cards.test.ts`
- Modify: `sim/attacks.ts` (krystal při smrti), `sim/world.ts`, `sim/run.ts`, `sim/run.test.ts`

**Interfaces:**
- Consumes: `removeDeadEnemies` a `computeHeroStats` z úkolu 5, `AbilitySlot` z úkolu 6.
- Produces:

  ```ts
  // sim/crystals.ts
  export class CrystalPool {
    constructor(capacity: number); // 512
    count: number;
    readonly active: Uint8Array; readonly generation: Uint32Array; readonly homing: Uint8Array;
    readonly x: Float64Array; readonly y: Float64Array; readonly value: Float64Array;
    add(x: number, y: number, value: number): number; // −1, když je pool plný
    remove(slot: number): void;
  }
  export function dropCrystal(world: World, x: number, y: number, value: number): void; // při plném poolu rovnou gainXp
  export function updateCrystals(world: World): void;
  // v okruhu magnet.radius se krystal trvale rozletí k hrdinovi rychlostí magnet.speed;
  // do vzdálenosti magnet.pickupRadius se sebere: gainXp a CrystalPicked
  // sim/progression.ts
  export interface ProgressionState { xpToNext: number; pendingLevelUps: number; offer: Card[] }
  export function xpToNext(run: RunConfig, level: number): number; // xp.first + xp.step × (level − 1)
  export function gainXp(world: World, amount: number): void;
  // každý level-up: level++, atributy += *.perLevel, přepočet statistik, hp += přírůstek maxHp, LevelUp, pendingLevelUps++
  // sim/cards.ts
  export type Card =
    | { kind: "ability"; slot: number; abilityId: string; level: number; from: number; to: number }
    | { kind: "attribute"; attribute: "str" | "agi" | "int"; amount: number; from: number; to: number };
  export function createOffer(world: World): Card[];
  export function applyCard(world: World, card: Card): void;
  ```
- `World` navíc má `crystals: CrystalPool` a `progression: ProgressionState`. Smrt nepřítele zavolá `dropCrystal(x, y, enemyData.xp)`.
- **Nabídka karet:**
  - V nabídce je jedna karta kouzla za každý slot pod maximem úrovní (`level` = současná + 1) a pak karty `str`, `agi` a `int` s `amount = run.cards.attributeAmount`.
  - Tři různé karty se vyberou částečným Fisher–Yatesem s indexem `floor(rng.cards.next() × zbývající)`.
  - Karta kouzla má `from = damage[level − 2] × spellPower` a `to = damage[level − 1] × spellPower`. Karta atributu má `from` = současnou hodnotu a `to = from + amount`.
- **Pauza:**
  - Na konci kroku, po kontrole konce: když běh pořád běží a `pendingLevelUps > 0`, přejde do `level_up` a vznikne nabídka.
  - Během `level_up` zpracuje `step` jen příkaz `card` s indexem 0–2 a `tick` se nezvýší. Volba zavolá `applyCard` a `pendingLevelUps−−`. Zbývá-li další level-up, vznikne nová nabídka, jinak se běh vrátí do `running` s prázdnou nabídkou. Neplatný index se ignoruje.

- [ ] **Step 1: Napiš padající testy**
  - `progression.test.ts`:
    - `xpToNext follows the curve`: 1 → 20, 2 → 35, 3 → 50;
    - `level-up grows attributes by perLevel`: `gainXp(20)` dá úroveň 2 se str 38,2, agi 22,5 a int 26,3; `maxHp` vzroste o 48 a `hp` o stejný přírůstek;
    - `two level-ups queue two offers`: `gainXp(55)` dá `pendingLevelUps` 2; po kroku je stav `level_up`, po první volbě zůstane `level_up` s novou nabídkou a po druhé je běh zase `running`.
  - `crystals.test.ts`:
    - `an enemy death drops a crystal worth enemy.xp`: hodnota 5;
    - `a crystal inside the magnet radius flies to the hero`: krystal ve vzdálenosti 290 je sebraný nejpozději ve 12. kroku, přidá 5 XP a vydá `CrystalPicked`;
    - `a crystal outside the magnet radius stays`: krystal ve vzdálenosti 310 je po 60 krocích na místě;
    - `a full pool adds XP directly`.
  - `cards.test.ts`:
    - `an offer has 3 distinct cards`;
    - `pausing stops the clock`: ve stavu `level_up` krok bez karty nezmění `tick`;
    - `an attribute card adds attributeAmount`: +3 str dá `maxHp` i `hp` o 45 výš;
    - `an ability card raises the level`: Skalní zlom má úroveň 2 a `to / from` = 2;
    - `an ability card leaves the pool at the last level`: na úrovni 5 nabídka obsahuje jen karty atributů;
    - `an invalid card index is ignored`;
    - `the same seed gives the same offers`.
  - `run.test.ts`: `level-up on the final tick ends the run as won`. Nulový spawn, `lengthSeconds: 1`. Test zavolá `gainXp(world, 20)` před 30. krokem; po něm je stav `won` a nabídka prázdná.

- [ ] **Step 2: Spusť testy a ověř, že padají**

  Run: `npx vitest run sim`
  Expected: FAIL.

- [ ] **Step 3: Implementuj krystaly, postup a karty podle Interfaces**

- [ ] **Step 4: Spusť kontrolu**

  Run: `npm run check`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add sim
  git commit -m "feat(sim): add XP crystals, level-ups and cards"
  ```

### Task 8: Boti a ladění běhu

**Files:**
- Create: `sim/bots.ts`, `sim/bot-runs.test.ts`
- Modify jen při ladění: `design/run.yaml`, `design/enemies.yaml` (`xp`); Regenerate: `data/generated/run.json`, `data/generated/enemies.json`

**Interfaces:**
- Consumes: celý `Run` z úkolů 3–7.
- Produces:

  ```ts
  // sim/bots.ts
  export type Bot = (world: World) => Command[];
  export function referenceBot(): Bot;
  export function afkBot(): Bot;
  export interface PlayResult {
    endReason: EndReason | null; ticks: number; level: number; stats: RunStats;
    hashes: number[];      // každých 300 ticků a na konci
    log: Command[][];      // příkazy každého volání step v pořadí volání
  }
  export function playRun(data: GameData, seed: number, bot: Bot, maxSteps?: number /* výchozí 100 000 */): PlayResult;
  export function replay(data: GameData, seed: number, log: Command[][]): number; // výsledný hash
  ```
- **Referenční bot:**
  - V `level_up` volí kartu 0.
  - Cílem je živý nepřítel nejblíž hradu do vzdálenosti 1100 od hradu. Bot k němu jde, dokud je dál než `run.hero.radius + enemyData.radius + 100`, pak stojí.
  - Bez cíle se vrací na `run.hero.start` a 40 od něj zastaví.
- **Nečinný bot:** volí kartu 0, dojde na (1900, −1900) a tam stojí.

- [ ] **Step 1: Napiš testy**
  - `reference bot survives three minutes`: seedy 1, 2 a 3 dají `endReason` `survived` a 5400 ticků.
  - `afk bot loses before three minutes`: seed 1 dá `endReason` `castle` nebo `hero` a méně než 5400 ticků.
  - `the reference bot levels up 4 to 8 times`: výsledná úroveň je 5 až 9.
  - `a full run is deterministic`: seed 7 s referenčním botem dvakrát dá shodné pole `hashes`; `replay(log)` vrátí poslední hash.
  - `a full run takes under 10 seconds`: 5400 ticků s referenčním botem měřené v testu.

- [ ] **Step 2: Spusť testy**

  Run: `npx vitest run sim/bot-runs.test.ts`
  Expected: testy determinismu a času projdou. Výsledky botů ukážou, jestli výchozí čísla drží okno.

- [ ] **Step 3: Dolaď běh, pokud okno nedrží**
  - Ladí se jen `design/run.yaml` (`castle.hp` v rozmezí 3000–12 000, `phases[].spawnsPerSecond` v rozmezí 0,15–0,9 a neklesající mezi fázemi, `phases[].hunterShare` v rozmezí 0,1–0,5) a `xp` v `design/enemies.yaml`. `lengthSeconds` a počet fází zůstávají.
  - Referenční bot prohrává na hrad: přidej hradu HP, nebo uber tok. Prohrává na smrt hrdiny: uber podíl lovců. Nečinný bot vyhrává: přidej tok, nebo uber hradu HP.
  - Po každé změně spusť `npm run data:build -- --source data-source/v20.75/out --out data/generated`.

- [ ] **Step 4: Spusť kontrolu**

  Run: `npm run check`
  Expected: PASS. Report uvede konečné hodnoty `design/run.yaml` a pro každý seed konec, úroveň, počet zabití a zbývající HP hradu.

- [ ] **Step 5: Commit**

  ```bash
  git add sim design data/generated
  git commit -m "test(sim): bot runs for the three-minute slice"
  ```

### Task 9: Klient hry: smyčka, vstup, menu, scéna a hrdina

**Files:**
- Create: `client/tsconfig.json`; Modify: `tsconfig.json` (`exclude` navíc `client`), `package.json` (`typecheck` = `tsc -p sim/tsconfig.json && tsc -p client/tsconfig.json && tsc -p tsconfig.json`)
- Modify: `client/index.html` (stránka hry), `client/main.ts` (start)
- Create: `client/game/params.ts`, `client/game/params.test.ts`, `client/game/loop.ts`, `client/game/loop.test.ts`, `client/game/input.ts`, `client/game/input.test.ts`, `client/game/game-data.ts`, `client/game/session.ts`, `client/game/probe.ts`
- Create: `client/render/units.ts`, `client/render/units.test.ts`, `client/render/renderer.ts`, `client/render/model.ts`, `client/render/stage.ts`, `client/render/camera-rig.ts`, `client/render/hero-view.ts`
- Create: `client/ui/i18n.ts`, `client/ui/i18n.test.ts`, `client/ui/menu.ts`, `client/i18n/en.json`, `client/i18n/cs.json`
- Create: `e2e/game.spec.ts`
- Modify: `AGENTS.md` (klient má vlastní tsconfig bez typů Node), `README.md` (parametry URL hry)

**Interfaces:**
- Consumes: `createRun`, `Run`, `World`, `Command`, `TICK_SECONDS` a `EventType` ze `sim/`, `validateGameData` z `data/schema`.
- Produces:

  ```ts
  // client/game/params.ts
  export interface GameParams { seed: number | null; speed: number; renderer: "webgpu" | "webgl2"; fps: boolean; lang: "en" | "cs" | null }
  export function readGameParams(search: string): GameParams; // speed: celé číslo 1–32, výchozí 1; neplatné hodnoty dají výchozí
  // client/game/loop.ts
  export const MAX_FRAME_SECONDS = 0.25;
  export const MAX_TICKS_PER_FRAME = 64;
  export interface LoopClock { accumulator: number }
  export function ticksForFrame(clock: LoopClock, frameSeconds: number, speed: number): number;
  // accumulator += min(frameSeconds, MAX_FRAME_SECONDS) × speed; ticks = floor(accumulator / TICK_SECONDS + 1e-9);
  // nad MAX_TICKS_PER_FRAME vrátí MAX_TICKS_PER_FRAME a accumulator = 0, jinak accumulator −= ticks × TICK_SECONDS (nejméně 0)
  // client/game/input.ts
  export function directionFromKeys(keys: ReadonlySet<string>): { x: number; y: number };
  // KeyW/ArrowUp +y, KeyS/ArrowDown −y, KeyA/ArrowLeft −x, KeyD/ArrowRight +x; normalizovaný; protilehlé klávesy se ruší
  export class KeyboardInput { constructor(target: Window); readonly keys: ReadonlySet<string>; takeCardChoice(): number | null /* Digit1–3 → 0–2 */; dispose(): void }
  // client/game/game-data.ts
  export function loadGameData(): GameData; // validateGameData nad pěti importovanými JSON z data/generated
  // client/game/session.ts
  export class Session {
    constructor(data: GameData, seed: number, speed: number);
    readonly run: Run;
    readonly heroPrevX: number; readonly heroPrevY: number; // pozice před posledním krokem
    frame(frameSeconds: number, move: { x: number; y: number }, card: number | null): { ticks: number; alpha: number };
    // příkaz move posílá jen při změně směru, příkaz card jen ve stavu level_up
  }
  // client/render/units.ts
  export const MAP_UNITS_PER_WORLD_UNIT = 64;
  export function toWorldX(x: number): number; // x / 64
  export function toWorldZ(y: number): number; // −y / 64
  // client/game/probe.ts (čtou ho e2e testy)
  export interface GameProbe { backend: "WebGPU" | "WebGL2" | null; status: "loading" | "menu" | "running" | "level_up" | "won" | "lost" | "error"; tick: number; frames: number; level: number; enemies: number; heroX: number; heroY: number }
  declare global { interface Window { __game?: GameProbe } }
  // client/ui/i18n.ts
  export type Lang = "en" | "cs";
  export interface I18n { lang: Lang; t(key: string, params?: Record<string, string | number>): string } // {name} v textu nahradí parametr; chybějící klíč vrátí klíč
  export function pickLang(param: Lang | null, stored: string | null, browserLanguage: string): Lang; // param, pak uložený, pak "cs*" → cs, jinak en
  export function createI18n(lang: Lang): I18n;
  ```
- `client/tsconfig.json`: `lib` ES2022, DOM a DOM.Iterable; `types: ["vite/client"]`; `strict`, `noEmit`, `skipLibCheck`, `isolatedModules`, `resolveJsonModule`; `include: ["./**/*.ts"]`.
- **Stránka:**
  - V `client/index.html` jsou kontejner canvasu a prvky `#menu`, `#hud`, `#cards`, `#end` a `#error`. `#hud`, `#cards` a `#end` naplní úkol 11.
  - Menu ukazuje název, podtitul, jméno hrdiny z dat, tlačítko `#start` a přepínač jazyka. Jazyk se ukládá do `localStorage`, čtení i zápis jsou v `try/catch`.
- **Klíče i18n v tomto úkolu:** `menu.title`, `menu.subtitle`, `menu.start`, `menu.language`, `loading`, `error.graphics`, `error.assets`, `error.crash`. EN: „Defense Webgame“, „Survive three minutes. Keep the castle standing.“, „Start“, „Language“, „Loading…“, „This browser supports neither WebGPU nor WebGL2.“, „The game files failed to load.“, „The game stopped because of an error.“ CS: „Defense Webgame“, „Přežij tři minuty a udrž hrad.“, „Start“, „Jazyk“, „Načítám…“, „Tento prohlížeč neumí WebGPU ani WebGL2.“, „Soubory hry se nepodařilo načíst.“, „Hra se zastavila kvůli chybě.“
- **Vykreslení:**
  - `renderer.ts` vytvoří `WebGPURenderer` s `forceWebGL` pro `renderer=webgl2`. Selhání `init()` ukáže `error.graphics`.
  - `model.ts` načte GLB a při chybě to zkusí ještě jednou po 500 ms. Druhé selhání ukáže `error.assets`.
  - `stage.ts` postaví podlahu velikosti arény s okrajem, dvě brány a nízkopolygonový hrad (kvádr se čtyřmi věžemi). Světla jsou stejná jako ve spiku.
  - `camera-rig.ts` sleduje interpolovanou pozici hrdiny: náklon 55°, FOV 35°, vzdálenost 45.
  - `hero-view.ts` použije klon RobotExpressive přes `SkeletonUtils.clone`. Velikost je 1,3 × (2 × poloměr hrdiny / 64), barva výrazně zlatá. Klipy: `Idle` při stání, `Running` v pohybu, `Punch` na `HeroAttacked` a `Death` při prohře se smrtí hrdiny. Natočení plynule sleduje rychlost.
- **Chyby:** výjimka uvnitř snímku zastaví smyčku, zapíše se do `console.error`, ukáže `error.crash` a `__game.status` přejde na `error`.

- [ ] **Step 1: Napiš padající testy**
  - `loop.test.ts`:
    - `60 frames of 1/60 s give 30 ticks`;
    - `one frame of 1/30 s gives 1 tick`;
    - `speed multiplies ticks`: snímek 1/30 s při rychlosti 8 dá 8 ticků;
    - `ticksForFrame caps ticks and drops the backlog`: snímek 5 s při rychlosti 32 dá 64 ticků a `accumulator` 0; další snímek 1/60 s při rychlosti 1 dá 0 ticků.
  - `input.test.ts`: W dá (0, 1); W+D dá (0,7071068, 0,7071068); W+S dá (0, 0); šipka vlevo dá (−1, 0).
  - `params.test.ts`: `?seed=5&speed=16&renderer=webgl2&fps=1&lang=cs` se přečte celé; `speed=0` i `speed=99` dají výchozí 1; bez parametrů je `seed` null.
  - `units.test.ts`: `toWorldX(128)` = 2, `toWorldZ(128)` = −2.
  - `i18n.test.ts`:
    - `en.json and cs.json have the same keys`;
    - `t fills parameters`;
    - `pickLang prefers param, then stored, then browser`: `(null, null, "cs-CZ")` → cs, `(null, null, "de")` → en, `("en", "cs", "cs")` → en.
  - `e2e/game.spec.ts`: `boots to the menu and starts a run`. Stránka `/?seed=1` čeká na `__game.status === "menu"`, klikne na `#start`, čeká na `running` a `frames > 30` a po 1 s držení D ověří, že `heroX` vzrostlo. Konzole nesmí mít chyby.

- [ ] **Step 2: Spusť testy a ověř, že padají**

  Run: `npx vitest run client`
  Expected: FAIL.

- [ ] **Step 3: Implementuj moduly, stránku a vykreslení podle Interfaces**

- [ ] **Step 4: Spusť kontrolu**

  Run: `npm run check && npm run e2e`
  Expected: PASS v obou projektech (WebGL2 i WebGPU přes SwiftShader), včetně testů spiku.

- [ ] **Step 5: Commit**

  ```bash
  git add client e2e tsconfig.json package.json AGENTS.md README.md
  git commit -m "feat(client): run the simulation in the game page"
  ```

### Task 10: Dav nepřátel, krystaly a efekty

**Files:**
- Move: `client/spike/bake-vat.ts` do `client/render/vat/bake-vat.ts`
- Create: `client/render/vat/vat-layout.ts`, `client/render/vat/vat-layout.test.ts`, `client/render/vat/crowd-renderer.ts`
- Modify: `client/spike/crowd.ts` (kreslí přes `CrowdRenderer`, řízení pohybu zůstává), `client/spike/main.ts`
- Create: `client/render/enemies-view.ts`, `client/render/crystals-view.ts`, `client/render/effects/rupture-effect.ts`, `client/render/effects/death-burst.ts`, `client/render/effects/timing.ts`, `client/render/effects/timing.test.ts`
- Modify: `client/game/session.ts` (předchozí pozice nepřátel a krystalů podle `generation`), `client/main.ts`, `client/game/probe.ts`, `e2e/game.spec.ts`

**Interfaces:**
- Consumes: `EnemyPool`, `EnemyAction`, `CrystalPool` a `EventType` ze `sim/`, `Session` z úkolu 9.
- Produces:

  ```ts
  // client/render/vat/vat-layout.ts
  export const VAT_MAX_WIDTH = 2048;
  export interface VatLayout { width: number; rowsPerFrame: number }
  export function vatLayout(vertexCount: number): VatLayout; // width = min(vertexCount, VAT_MAX_WIDTH), rowsPerFrame = ceil(vertexCount / width)
  export function vatTexel(layout: VatLayout, vertex: number, frameRow: number): { x: number; y: number };
  // x = vertex % width, y = frameRow × rowsPerFrame + floor(vertex / width)
  // client/render/vat/bake-vat.ts
  export interface BakedVat { geometry: BufferGeometry; texture: DataTexture; clips: Record<string, VatClip>; layout: VatLayout } // geometrie bez atributu vatIndex
  // client/render/vat/crowd-renderer.ts
  export class CrowdRenderer {
    constructor(vat: BakedVat, options: { capacity: number; fps: number; footprint: number /* jednotky světa */; tint: Color });
    readonly mesh: InstancedMesh;
    begin(): void;
    add(x: number, z: number, headingX: number, headingZ: number, clip: VatClip, phase: number, flash: number): void; // nad kapacitou se ignoruje
    end(timeSeconds: number): void; // mesh.count, needsUpdate atributů, uniform času
  }
  // client/render/effects/timing.ts
  export function spikeHeight(ageSeconds: number): number; // 0–0,1 s roste z 0 na 1, do 0,35 s drží 1, do 0,5 s klesá na 0, pak 0
  export function burstScale(ageSeconds: number): number;  // 0–0,35 s lineárně z 0 na 1, pak 0
  ```
- **Renderer davu:**
  - Na instanci připadá jen `instanceMatrix` a jeden atribut `anim` (vec4: startRow, rows, phase, flash).
  - Index vrcholu dává vestavěný `vertexIndex` z TSL. Texel se počítá podle `vatTexel`.
  - Barva je `mix(barva vrcholu × tint, bílá, flash)`.
  - Živé instance se každý snímek skládají od začátku.
- **Nepřátelé:**
  - Pozice se interpolují mezi předchozím a současným krokem; po změně `generation` se předchozí pozice resetuje.
  - Natočení sleduje rychlost s rychlostí otáčení 8/s.
  - Klip podle akce: `Move` → `Walking`, `Attack` → `Punch`, `Stunned` → `Idle`.
  - `phase` = zlomková část `slot × 0,618`. `flash` = 1 po `EnemyHit` a klesá rychlostí 8/s.
  - `footprint` = 2 × poloměr / 64, tint 0xd06050.
- **Krystaly:** instancovaný osmistěn o poloměru 0,18, azurová emisivní barva, houpání ±0,08 s frekvencí 2 Hz, interpolované pozice.
- **Efekty:**
  - `AbilityCast` vytvoří trny po 100 jednotkách mapy podél čáry. Trn i se objeví v čase 0,3 × i / n s a jeho výšku řídí `spikeHeight`; pool 256 kuželů.
  - `EnemyDied` vytvoří plochý prstenec do průměru 1,2 jednotky světa podle `burstScale`, který se vytrácí; pool 64.
- Spike používá stejný `CrowdRenderer`, takže benchmark měří renderer hry.

- [ ] **Step 1: Napiš padající testy**
  - `vat-layout.test.ts`:
    - `vatLayout(7214)` = `{ width: 2048, rowsPerFrame: 4 }` a `vatLayout(500)` = `{ width: 500, rowsPerFrame: 1 }`;
    - `vatTexel(vatLayout(7214), 7213, 2)` = `{ x: 1069, y: 11 }`.
  - `timing.test.ts`: `spikeHeight` v 0, 0,05, 0,2, 0,425 a 0,6 s dá 0, 0,5, 1, 0,5 a 0; `burstScale` v 0,175 s dá 0,5 a v 0,4 s 0.
  - `e2e/game.spec.ts`: `draws enemies after they spawn`. Stránka `/?seed=1&speed=8` po startu čeká na `__game.enemies > 0` (sonda čte `enemies.alive`), bez chyb v konzoli.

- [ ] **Step 2: Spusť testy a ověř, že padají**

  Run: `npx vitest run client`
  Expected: FAIL.

- [ ] **Step 3: Implementuj sdílený renderer, pohledy a efekty a předělej spike**

- [ ] **Step 4: Spusť kontrolu**

  Run: `npm run check && npm run e2e`
  Expected: PASS, včetně všech testů spiku (n=600 v obou projektech).

- [ ] **Step 5: Commit**

  ```bash
  git add client e2e
  git commit -m "feat(client): draw enemies, crystals and ability effects"
  ```

### Task 11: Rozhraní: HUD, karty, konec běhu a fps

**Files:**
- Modify: `client/i18n/en.json`, `client/i18n/cs.json`
- Create: `client/ui/hud.ts`, `client/ui/cards.ts`, `client/ui/card-text.ts`, `client/ui/card-text.test.ts`, `client/ui/end-screen.ts`, `client/ui/format.ts`, `client/ui/format.test.ts`, `client/ui/styles.css`
- Move: `client/spike/overlay.ts` do `client/ui/fps-overlay.ts`; `client/spike/frame-stats.ts` a jeho test do `client/ui/`. Spike je importuje odtud.
- Modify: `client/main.ts`, `client/index.html`, `client/game/probe.ts`, `e2e/game.spec.ts`

**Interfaces:**
- Consumes: `Card`, `World.progression`, `World.stats`, `RunStatus` a `EndReason` ze `sim/`, `createI18n` z úkolu 9.
- Produces:

  ```ts
  // client/ui/card-text.ts
  export function cardText(card: Card, i18n: I18n, data: GameData): { title: string; change: string };
  // client/ui/format.ts
  export function formatTime(seconds: number): string;              // 65 → "1:05", 180 → "3:00"
  export function formatNumber(value: number, lang: Lang): string;  // zaokrouhlí; Intl.NumberFormat jazyka
  ```
- **HUD:**
  - HP hrdiny jako pruh s čísly, úroveň a pruh XP;
  - čas `m:ss / 3:00` a fáze „Fáze {n}/{total}“;
  - pruh HP hradu;
  - ikona Skalního zlomu s úrovní a výsečí cooldownu (jen CSS);
  - upozornění `hud.castleAttacked` ještě 2 s po posledním `CastleHit`.
- **Karty:** `#cards` ukáže tři tlačítka `.card` s titulkem a řádkem změny. Volí se kliknutím nebo klávesami 1–3.
- **Konec:** `#end` ukáže výsledek, důvod, statistiky (čas, zabití, úroveň, způsobené poškození) a tlačítko `#again`. To spustí nový běh: s `?seed` stejný seed, jinak nový ze `crypto.getRandomValues`.
- **Fps:** overlay se ukáže s `?fps=1` nebo po stisku F3. Při `visibilitychange` vynuluje okno statistik.
- **Nové klíče i18n (EN / CS):**

  | Klíč | EN | CS |
  |---|---|---|
  | `menu.hero` | Hero | Hrdina |
  | `hud.level` | Level {level} | Úroveň {level} |
  | `hud.castle` | Castle | Hrad |
  | `hud.phase` | Phase {n}/{total} | Fáze {n}/{total} |
  | `hud.castleAttacked` | The castle is under attack! | Hrad je napadený! |
  | `cards.title` | Level up! Choose one | Nová úroveň! Vyber si |
  | `cards.abilityLevel` | {name} level {level} | {name}, úroveň {level} |
  | `cards.damage` | Damage {from} → {to} | Poškození {from} → {to} |
  | `cards.attribute` | {name} +{amount} | {name} +{amount} |
  | `cards.attributeChange` | {name} {from} → {to} | {name} {from} → {to} |
  | `attribute.str` | Strength | Síla |
  | `attribute.agi` | Agility | Obratnost |
  | `attribute.int` | Intelligence | Inteligence |
  | `end.won` | Victory | Vítězství |
  | `end.lost` | Defeat | Prohra |
  | `end.reason.survived` | You held out for three minutes. | Vydržel jsi tři minuty. |
  | `end.reason.castle` | The castle has fallen. | Hrad padl. |
  | `end.reason.hero` | Your hero has fallen. | Tvůj hrdina padl. |
  | `end.time` | Time | Čas |
  | `end.kills` | Kills | Zabití |
  | `end.level` | Level | Úroveň |
  | `end.damage` | Damage dealt | Způsobené poškození |
  | `end.again` | Play again | Hrát znovu |
- **`cardText`:**
  - kouzlo: titulek `cards.abilityLevel` se jménem z dat v jazyce i18n, změna `cards.damage` se zaokrouhlenými `from` a `to`;
  - atribut: titulek `cards.attribute`, změna `cards.attributeChange` s hodnotami zaokrouhlenými dolů.

- [ ] **Step 1: Napiš padající testy**
  - `card-text.test.ts`:
    - EN karta kouzla `{ from: 620, to: 1240, level: 2 }` dá „Rock Rupture level 2“ a „Damage 620 → 1240“;
    - CS karta atributu `{ attribute: "str", amount: 3, from: 35, to: 38 }` dá „Síla +3“ a „Síla 35 → 38“.
  - `format.test.ts`: `formatTime(65)` = „1:05“, `formatTime(180)` = „3:00“; `formatNumber(1234.6, "en")` = „1,235“; `formatNumber(1234.6, "cs")` = „1 235“ s nezlomitelnou mezerou podle `Intl`.
  - `e2e/game.spec.ts`: `offers cards on level-up and resumes`. Stránka `/?seed=1&speed=16` po startu čeká na `level_up`; `#cards .card` jsou tři; po kliknutí na první je stav zase `running`.

- [ ] **Step 2: Spusť testy a ověř, že padají**

  Run: `npx vitest run client`
  Expected: FAIL.

- [ ] **Step 3: Implementuj HUD, karty, konec, fps a texty**

- [ ] **Step 4: Spusť kontrolu**

  Run: `npm run check && npm run e2e`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add client e2e
  git commit -m "feat(client): add the HUD, level-up cards and end screen"
  ```

### Task 12: E2E celého běhu, CI a dokumentace

**Files:**
- Create: `e2e/fixtures.ts`
- Modify: `e2e/game.spec.ts`, `e2e/spike.spec.ts`, `playwright.config.ts` (`timeout: 180_000`), `.github/workflows/ci.yml` (`timeout-minutes: 30` u jobu `check`), `README.md`, `AGENTS.md`

**Interfaces:**
- Produces: `e2e/fixtures.ts` exportuje `test` a `expect`. `test` sbírá chyby z `console` a `pageerror` a na konci každého testu selže, pokud nějaká přišla. Používají ho všechny testy v `e2e/`.

- [ ] **Step 1: Napiš testy** (`e2e/game.spec.ts`, oba projekty, všechny přes fixture)
  - `plays from the menu to the end screen`: stránka `/?seed=1&speed=16`; menu, start, `level_up`, klik na první kartu, čekání na `won` nebo `lost` (timeout 150 s) a viditelný `#end` s důvodem. K reportu přiloží `menu.png`, `run.png`, `cards.png` a `end.png`.
  - `renders the arena`: během běhu se skryje UI. Směrodatná odchylka jasu canvasu musí být větší než 2,5, stejně jako u spiku.
  - `shows Czech texts with lang=cs`: text `#start` se rovná `menu.start` z `cs.json`.
  - `the bundle carries no map identifiers`: soubory `dist/**/*.js` a `dist/**/*.html` neobsahují žádnou hodnotu `source` ani `mapName` z `design/*.yaml` a ani `Trig_`.
  - Stávající testy v `spike.spec.ts` přejdou na fixture.

- [ ] **Step 2: Spusť e2e**

  Run: `npm run e2e`
  Expected: PASS v obou projektech.

- [ ] **Step 3: Uprav CI a dokumentaci**
  - `README.md`: adresa hry `https://wizzik.github.io/defense-webgame/`, parametry `seed`, `speed`, `renderer`, `fps` a `lang`, a měření fps autorem: hra s `?fps=1` a spike s `?n=150/300/600`.
  - `AGENTS.md`: ověř, že pravidla simulace a klienta odpovídají kódu.

- [ ] **Step 4: Spusť kontrolu**

  Run: `npm run check && npm run build`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add e2e playwright.config.ts .github README.md AGENTS.md
  git commit -m "test(e2e): play the slice end to end"
  ```

---

## Hotovo, když

- všech 12 úkolů prošlo kontrolou a `npm run check` i `npm run e2e` jsou zelené lokálně i v CI;
- boti v úkolu 8 drží okno: referenční bot přežije 3 minuty na seedech 1–3, nečinný bot prohraje a stejný seed dá stejný otisk;
- pull request `phase-1` → `main` čeká na souhlas autora;
- po sloučení autor zahraje `https://wizzik.github.io/defense-webgame/?fps=1` v obou rendererech a potvrdí, že běh trvá 3 minuty a drží se kolem 60 fps.
