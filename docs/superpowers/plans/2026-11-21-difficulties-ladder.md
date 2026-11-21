# Obtížnosti 1: žebříček světů, volič obtížnosti, menu, odemykání: prováděcí plán

> **Pro agenty:** POVINNÝ PODSKILL: superpowers:executing-plans (nativní provedení) nebo superpowers:subagent-driven-development. Kroky mají zaškrtávací políčka (`- [ ]`).

**Cíl:** Pět světů v pevném pořadí a volič Normal / Insane / Hell jako jedna tabulka násobků síly nepřátel, obrazovka volby světa po výběru hrdiny, odemykání výhrou uložené v prohlížeči a odměna za těžší běh; svět 1 na Normal je přesně dnešní hra.

**Architektura:** `rules.difficulty` (násobky) a `design/worlds.yaml` (jména, popisy, barva karty) jdou přes `data:build` do dat. Simulace dostane `RunOptions.world` a `RunOptions.difficulty`, při vzniku běhu z nich spočítá jednu strukturu `run.mods` a všechna místa, kde vzniká nepřítel, zlato nebo los vzácnosti, ji čtou. Odemykání je čistá logika v `meta/progress.ts`, klient ji ukládá do IndexedDB pod vlastním klíčem. Světy 2–5 mají v tomto plánu vzhled světa 1 a štítek „připravujeme“.

**Technologie:** TypeScript, Vitest, zod (`data/schema`), IndexedDB, Playwright.

**Spec:** projekt claude.ai `claude/specs/2026-11-21-difficulties-worlds-design.md` (čti přes `Projects` `project_read`; v repu zatím není, Úkol 7 ho tam zkopíruje), kapitoly 4.1–4.4, 4.9 a 4.10 bod 1 (překážky, situace a vzhled světů jsou plány 2 a 3).

## Globální omezení

- `AGENTS.md`: `sim/` a `meta/` čisté a deterministické, `Run.step()` nealokuje (násobky se počítají jednou v konstruktoru běhu), žádné `**` ani trigonometrie.
- Svět 1 + Normal = dnešní hra beze změny: všechny násobky 1, žádné nájezdy navíc, žádný los navíc z `rng`. Ověřuje Úkol 3.
- Texty EN i CS přes `client/ui/messages-*.ts`; jména světů vlastní (spec 4.1), žádná jména z mapy ani z Warcraftu.
- Barvy tmavé, modrošedé, **bez oranžové** (Petr).
- Data: `design/*.yaml` → `npm run data:build -- --source data-source/v20.75/out --out data/generated`. Export mapy v čerstvém klonu chybí: stáhni mapu z projektu claude.ai (`Projects` `project_read` s `original: true` na `X_Hero_Siege_F-Day_v20.75_AI.w3x`) a spusť `npm run map:extract -- <cesta> v20.75`. Mapu nikdy necommituj.
- `npm run check` před každým commitem; Conventional Commits; identita `Claude <noreply@anthropic.com>` a trailery sezení.
- Větev `difficulties` (tento plán už na ní je); PR proti `main`.

## Na co se zaměřit při kontrole

1. **Zamčená kombinace z URL** (`?world=4&difficulty=hell` bez `debug=1`): předvybere se svět 1 Normal, běh se zamčenou kombinací nesmí vzniknout. Test v Úkolu 6.
2. **Poškozená nebo cizí uložená data postupu** (`null`, jiná verze, svět 9, fáze „abc“): načte se prázdný postup, nic nespadne, svět 1 Normal zůstane otevřený. Test v Úkolu 4.
3. **Horší výsledek nepřepíše lepší:** prohra ve fázi 8 po výhře, nebo fáze 5 po fázi 14, nechá uložené to lepší. Test v Úkolu 4.
4. **Nájezd navíc ve stejném čase jako jiná událost a start ve fázi** (`?debug=1&phase=11&difficulty=insane`): nájezdy před startem se přeskočí, varování přijde jen pro další nájezd. Test v Úkolu 2.
5. **Velikost smečky u stropu 150 živých:** Hell ×1,4 nesmí přetéct úložiště ani vyhodit bosse. Test v Úkolu 2.

---

### Úkol 1: Data obtížnosti a světů

**Soubory:**
- Upravit: `data/schema/rules.ts`, `data/schema/index.ts`, `data/schema/schema.test.ts`
- Vytvořit: `data/schema/world.ts`, `design/worlds.yaml`
- Upravit: `design/rules.yaml`, `tools/data-build/load.ts`, `tools/data-build/build.ts`, `tools/data-build/data-build.test.ts`, `data/generated.test.ts`, `client/game/data.ts`, `sim/testing/game-data.ts`, `tools/sim-run/run.ts` (načtení dat, pokud má vlastní)
- Vygenerovat: `data/generated/rules.json`, `data/generated/worlds.json`

**Rozhraní:**
- `data/schema/rules.ts`: `export const DIFFICULTY_IDS = ["normal", "insane", "hell"] as const; export type DifficultyId = (typeof DIFFICULTY_IDS)[number];` a v `RulesSchema`:
  ```
  difficulty: {
    worldStep: { hp: ≥0, damage: ≥0 },                 // násobek = 1 + krok · (svět − 1)
    reward: { goldPerWorld: ≥0, magicFindPerWorld: ≥0 },
    levels: { normal: Level, insane: Level, hell: Level },
  }
  Level = { hp: >0, damage: >0, packSize: >0, eliteHp: >0, magicFind: ≥0,
            extraRushes: { atSeconds: >0, elites: int ≥0, heavies: int ≥0 }[] }
  ```
- `data/schema/world.ts`: `WorldSchema = { id: Slug, name: LocalizedText, blurb: LocalizedText, color: /^#[0-9a-f]{6}$/, ready: boolean }`; `GameData.worlds: World[]` (min 1, id unikátní).
- Hodnoty (spec 4.2; Úkol 7 je smí doladit):
  - `worldStep: { hp: 0.25, damage: 0.25 }`, `reward: { goldPerWorld: 0.1, magicFindPerWorld: 0.1 }`;
  - normal `{ hp: 1, damage: 1, packSize: 1, eliteHp: 1, magicFind: 0, extraRushes: [] }`;
  - insane `{ hp: 1.75, damage: 1.75, packSize: 1.2, eliteHp: 1, magicFind: 0.25, extraRushes: R }`;
  - hell `{ hp: 3, damage: 3, packSize: 1.4, eliteHp: 1.5, magicFind: 0.5, extraRushes: R }`;
  - R (návrh plánu, spec čísla neurčuje: zhruba o stupeň slabší než předchozí běžný nájezd): 90 s 1 + 2, 270 s 2 + 3, 450 s 3 + 4, 630 s 4 + 6, 810 s 5 + 8 (elity + těžcí). V YAML kotva `&extraRushes`, Hell ji použije.
- `design/worlds.yaml` (pořadí = číslo světa 1–5; `ready: true` jen svět 1). Id `silver-march`, `red-waste`, `shadewood`, `frostreach`, `blightscar`; jména EN / CS ze spec 4.1; `blurb` jedna vlastní věta EN i CS (Úkol 6 ji ukazuje pod vybranou kartou); `color` tmavý odstín karty (zelenomodrá, rudohnědá, noční modrá, ledová modrošedá, fialovočerná; ne oranžová).
- `data:build` zapíše `worlds.json` (bez `source`, worlds nemají kódy mapy); `loadGameData()` a testovací data přidají `worlds`.

- [ ] **Krok 1: Padající testy** v `data/schema/schema.test.ts`: schéma odmítne `difficulty.levels` bez `hell`, `packSize: 0`, `extraRushes` se zápornými elitami a svět s barvou `orange`/neplatným hex; přijme platnou tabulku. V `data/generated.test.ts`: 5 světů, první `ready: true`, ostatní `false`; `levels.normal` má všechny násobky 1 a prázdné `extraRushes`; `extraRushes` Insane jsou vzestupně a všechny před `rules.run.durationSeconds`.
- [ ] **Krok 2:** `npx vitest run data` → FAIL.
- [ ] **Krok 3:** Schémata, YAML, načtení v `load.ts`, zápis v `build.ts` (test v `data-build.test.ts`: fixture `worlds.yaml` projde do výstupu), `npm run data:build`.
- [ ] **Krok 4:** `npm run check` → PASS.
- [ ] **Krok 5:** Commit `feat(data): difficulty table and the five worlds`.

### Úkol 2: Simulace: svět a obtížnost v běhu

**Soubory:**
- Vytvořit: `sim/difficulty.ts`, `sim/difficulty.test.ts`
- Upravit: `sim/run.ts`, `sim/spawner.ts`, `sim/timeline.ts`, `sim/debug-spawn.ts`, `sim/crystals.ts` (`gainGold`), `sim/chests.ts:134`, `sim/hash.ts`, `sim/index.ts`, `sim/timeline.test.ts`, `sim/spawner.test.ts`

**Rozhraní:**
- `RunOptions.world?: number` (1 až `data.worlds.length`, výchozí 1), `RunOptions.difficulty?: DifficultyId` (výchozí `"normal"`); jiná hodnota → `createRun` hodí `Error` se jménem pole.
- `sim/difficulty.ts`:
  ```ts
  export interface DifficultyMods { hp: number; damage: number; packSize: number; eliteHp: number; gold: number; magicFind: number }
  export function difficultyMods(rules: Rules, world: number, difficulty: DifficultyId): DifficultyMods
  export function enemyHp(run: Run, type: number, timeScale: number): number   // def.hp · timeScale · mods.hp · (isElite|isBoss ? eliteHp : 1)
  export function enemyDamageScale(run: Run, timeScale: number): number        // timeScale · mods.damage
  export function runMagicFind(run: Run): number                               // hero.gear.magicFind + mods.magicFind
  ```
  `hp = level.hp · (1 + worldStep.hp · (world − 1))`, totéž `damage`; `gold = 1 + reward.goldPerWorld · (world − 1)`; `magicFind = reward.magicFindPerWorld · (world − 1) + level.magicFind`.
- `Run`: `readonly world: number`, `readonly difficulty: DifficultyId`, `readonly mods: DifficultyMods`.
- Všech pět míst vzniku nepřítele (`scatterMember`, `spawnAt`, `spawnBoss`, `debug-spawn.ts`) volá `enemyHp` a `enemyDamageScale` místo `def.hp * scale` a `scale`.
- Smečka: `rolled` → `Math.max(1, Math.round(rolled · mods.packSize))` před násobkem finále; počet losů z `rng` se nemění.
- `buildTimeline(data, difficulty)` přidá `levels[difficulty].extraRushes` k `rules.events` a seřadí stabilně podle `tick` (běžná událost před nájezdem navíc ve stejném čase).
- `gainGold`: `Math.round(value · mods.gold · (1 + goldFind + passive.gold))`. Truhly losují s `runMagicFind(run)`.
- `stateHash` přimíchá `run.world` a index obtížnosti (spec 4.9); digest matice se tím změní (Úkol 3 ho zapíše).

- [ ] **Krok 0: Výchozí stav** (ještě před změnou `sim/`): `npm run sim:run -- --hero all --seeds 1-20 > /tmp/before.txt` a totéž s `--gear mid > /tmp/before-mid.txt` (Úkol 3 je porovná).
- [ ] **Krok 1: Padající testy** v `sim/difficulty.test.ts`:
  - `difficultyMods(rules, 1, "normal")` je samé 1 a `magicFind 0`; `(3, "insane")` má `hp 1.75 · 1.5 = 2.625`, `gold 1.2`, `magicFind 0.45`; `(5, "hell")` `hp 6`, `eliteHp 1.5`;
  - `createRun` s `world: 6`, `world: 0` a `difficulty: "nightmare"` hodí;
  - běh svět 2 Hell: první smečka má každý člen `maxHp = def.hp · timeScale · 3.75` a elita navíc `· 1.5`; `damageScale = timeScale · 3.75`; boss `spawnBoss` totéž s `· 1.5`;
  - Insane: nájezd navíc v 90 s (1 elita + 2 těžcí) přijde s varováním 7 s předem; Normal v 90 s nic;
  - start ve fázi 11 s Insane (`startPhase: 11`): žádný nájezd s `atSeconds` < 600 nepřijde, další varování patří nájezdu v 630 s (Na co se zaměřit 4);
  - Hell u stropu: 150 živých, smečka ×1,4 doplní jen volné sloty a živý boss zůstane (Na co se zaměřit 5);
  - mince za 10 zlata ve světě 3 dá 12;
  - dva běhy se stejným seedem lišící se jen světem mají různý `stateHash` v kroku 0.
- [ ] **Krok 2:** `npx vitest run sim/difficulty.test.ts` → FAIL.
- [ ] **Krok 3:** Implementace podle rozhraní; v `timeline.test.ts` a `spawner.test.ts` uprav volání `buildTimeline`.
- [ ] **Krok 4:** `npm run check` → PASS (stávající testy beze změny očekávaných hodnot kromě hashe, pokud nějaký pevný existuje).
- [ ] **Krok 5:** Commit `feat(sim): world and difficulty multipliers, extra rushes and rewards`.

### Úkol 3: `sim:run`, matice determinismu, kontrola „svět 1 = dnes“

**Soubory:**
- Upravit: `tools/sim-run/run.ts`, `tools/sim-run/run.test.ts`, `client/determinism/matrix.ts`, `client/determinism/matrix.test.ts`

**Rozhraní:**
- `sim:run` přepínače `--world 1-5|all` (výchozí 1) a `--difficulty normal|insane|hell|all` (výchozí `normal`); při `all` projde všechny kombinace a před souhrnem každé vypíše řádek `== world N <id> / <difficulty> ==`. `parseArgs` neplatnou hodnotu odmítne chybou.
- `MatrixCase.world?: number`, `MatrixCase.difficulty?: DifficultyId`; nové případy `w3-insane` (stonehorn, seed 6, svět 3 Insane, 300 s, bez výbavy, 9000 kroků) a `w5-hell` (redcleaver, seed 7, `startPhase: 6`, plná výbava, 6000 kroků).

- [ ] **Krok 0:** `/tmp/before.txt` a `/tmp/before-mid.txt` z Kroku 0 Úkolu 2 musí existovat (jinak je vyrob v `git worktree` na `main`).
- [ ] **Krok 1:** Test `parseArgs(["--world", "all", "--difficulty", "hell"])` dá všechny světy a `["hell"]`; `--world 7` hodí. Test matice: `w3-insane` a `w5-hell` doběhnou a jejich `checkpoints` se v Node shodují mezi dvěma běhy.
- [ ] **Krok 2:** FAIL → implementace → PASS.
- [ ] **Krok 3: Svět 1 = dnes.** `npm run sim:run -- --hero all --seeds 1-20 --world 1 --difficulty normal` a s `--gear mid`; `diff` proti `/tmp/before*.txt` musí být prázdný. Jinak hledej, kde násobek 1 nebo řazení timeline změnily los.
- [ ] **Krok 4:** `npx playwright test --project=sim-chromium` → PASS; nový digest z `/determinism/` (nebo z testu) zapiš do zprávy commitu a do STATUS v Úkolu 7.
- [ ] **Krok 5:** Commit `feat(tools): sim:run worlds and difficulties, matrix cases`.

### Úkol 4: Postup mezi běhy v `meta/`

**Soubory:**
- Vytvořit: `meta/progress.ts`, `meta/progress.test.ts`
- Upravit: `meta/index.ts`

**Rozhraní:**
```ts
export interface CourseResult { won: boolean; phase: number }   // phase 1–20, 21 = finále
export interface ProgressData { version: 1; best: Record<string, CourseResult> } // klíč courseKey
export function courseKey(world: number, difficulty: DifficultyId): string      // "3-insane"
export function emptyProgress(): ProgressData
export function parseProgress(raw: unknown, data: GameData): { progress: ProgressData; dropped: number }
export function isUnlocked(progress: ProgressData, world: number, difficulty: DifficultyId): boolean
export function recordResult(progress: ProgressData, world: number, difficulty: DifficultyId, result: CourseResult): ProgressData
export function firstUnlocked(progress: ProgressData, world: number, difficulty: DifficultyId): { world: number; difficulty: DifficultyId }
```
- Odemčení se neukládá, odvozuje se z `best` (spec 4.3): `1-normal` vždy; `N-X` když `best[(N−1)-X].won`; `1-insane` když `5-normal` vyhrán; `1-hell` když `5-insane` vyhrán.
- `recordResult` vrací nový objekt; lepší = výhra nad prohrou, jinak vyšší fáze; horší výsledek nic nemění (Na co se zaměřit 3).
- `parseProgress` nikdy nehází; vynechá neznámé klíče, svět mimo 1…`data.worlds.length`, neznámou obtížnost, `phase` mimo celé 1–21, `won` mimo boolean (každé +1 v `dropped`); jiná verze → prázdný a `dropped 1`; `null`/`undefined` → prázdný, `dropped 0` (Na co se zaměřit 2).
- `firstUnlocked(p, w, d)`: vrátí `(w, d)`, je-li odemčená, jinak `(1, "normal")` (pro URL parametry).

- [ ] **Krok 1:** Testy na každé pravidlo výše, včetně řetězu: výhra 1–5 Normal odemkne `1-insane`, ne `1-hell`; výhra `2-hell` bez `1-hell` neodemkne nic navíc mimo `3-hell` (odvozuje se jen z předchozího světa).
- [ ] **Krok 2–4:** FAIL → implementace → `npm run check` PASS.
- [ ] **Krok 5:** Commit `feat(meta): world progress and unlocks`.

### Úkol 5: Klient: parametry, uložení postupu, kurz běhu, ladění

**Soubory:**
- Upravit: `client/game/params.ts`, `client/game/params.test.ts`, `client/game/save-store.ts`, `client/game/save-store.test.ts`, `client/game/session.ts`, `client/game/debug.ts`, `client/main.ts`
- Vytvořit: `client/game/progress-session.ts`, `client/game/progress-session.test.ts`

**Rozhraní:**
- `GameParams.world?: number` (celé 1–5, jinak `undefined`), `GameParams.difficulty?: DifficultyId`.
- `save-store.ts`: `SaveBackend<T = SaveData>` a `indexedDbBackend<T>(factory?, key = "gear")`; postup používá klíč `"progress"` ve stejné databázi a úložišti (verze DB zůstává 1). `memoryBackend` generický.
- `ProgressSession` (vzor `GearSession`): `static load(data, backend: SaveBackend<ProgressData> | null, opts: { persistent: boolean; unlockAll: boolean }): Promise<ProgressSession>`; `progress`, `persistent`, `isUnlocked(world, difficulty)` (s `unlockAll` vždy `true`), `record(world, difficulty, result): void` (s `persistent: false` jen v paměti; selhaný zápis vypne ukládání jako u výbavy).
- `Session.world = 1`, `Session.difficulty: DifficultyId = "normal"`; `start()` je předá do `createRun`.
- `main.ts`: s `debug=1` paměťový backend a `unlockAll: true`; bez něj `firstUnlocked(progress, params.world ?? 1, params.difficulty ?? "normal")` nastaví předvolbu session (Na co se zaměřit 1); s `debug` se parametry berou, jak jsou.
- Konec běhu (blok `ended` v `createUi`): `progress.record(run.world, run.difficulty, { won: run.state === "won", phase: run.inFinale ? 21 : run.phaseIndex + 1 })`.
- `window.__game`: `world`, `difficulty`, `unlocked` (pole `courseKey` všech odemčených kombinací), `progressSaved` (boolean).

- [ ] **Krok 1:** Testy: `readGameParams("?world=3&difficulty=hell")`, `?world=9` a `?difficulty=x` → `undefined`; `ProgressSession` s `memoryBackend` zapíše výhru a po novém `load` je `2-normal` odemčený; s `unlockAll` je odemčený `5-hell`; backend s klíčem `"progress"` nepřepíše výbavu pod `"gear"` (fake IndexedDB, jak ho používá dnešní test).
- [ ] **Krok 2–4:** FAIL → implementace → `npm run check` PASS.
- [ ] **Krok 5:** Commit `feat(client): world progress storage and the run's course`.

### Úkol 6: Obrazovka volby světa

**Soubory:**
- Vytvořit: `client/ui/world-screen.ts`, `client/ui/world-lines.ts`, `client/ui/world-lines.test.ts`
- Upravit: `client/ui/menu.ts` (Start otevře volbu světa), `client/main.ts`, `client/ui/messages-en.ts`, `client/ui/messages-cs.ts`, `client/ui/style.css`, `e2e/fixtures.ts`, `e2e/game.spec.ts`, `e2e/shots.spec.ts`

**Rozhraní:**
- Tok: menu Start (hrdina načtený) → `WorldScreen` (id `#world-screen`) → její Start (`#world-start`) nastaví `session.world`/`difficulty`, spustí `session.start(session.seed, false, heroId)` a udělá totéž, co dnes `onStart` menu (zvuk, `menuOpen = false`). Tlačítko Zpět (`#world-back`) a Esc vrátí do menu.
- Rozložení dle spec 4.4: řádek obtížností (`button[data-difficulty]`), pět karet (`button[data-world="1".."5"]`) v barvě `world.color`, pod vybranou kartou `blurb`, síla nepřátel a odměna, vpravo dole Start. Zamčená karta i obtížnost jsou `disabled` se zámkem; při změně obtížnosti, která zamkne vybranou kartu, se výběr posune na nejvyšší odemčený svět.
- `world-lines.ts` (čistá, testovaná): `worldCard(data: GameData, world: number, best: CourseResult | undefined, unlocked: boolean, lang: Lang): { name: string; status: string; locked: boolean; preparing: boolean }` a `worldDetail(data: GameData, world: number, difficulty: DifficultyId, lang: Lang): string[]`:
  - `status`: „★ výhra“ / „★ win“, „fáze N“ / „phase N“, „finále“ / „finale“, nebo prázdné;
  - `preparing`: `!world.ready` → štítek „připravujeme“ / „coming soon“ (svět hratelný, vzhled zatím světa 1);
  - detail: `blurb`; „Síla nepřátel ×2,63“ (hp násobek světa × obtížnosti, 2 desetinná místa, CS s čárkou, bez koncových nul: ×1, ×1,25); „Odměna: zlato ×1,2, Magic Find +45 %“ (svět 1 Normal: „bez odměny navíc“ / „no extra reward“). Přírodní situace se v tomto plánu neukazuje (přijde s plány 2–3).
- `fixtures.ts`: `startRun(page)` klikne `#start`, počká na `#world-screen` a klikne `#world-start`; všech 33 dnešních `page.locator("#start").click()` v e2e přejde na `startRun(page)` (kde test čeká na `toHaveText("Start")`, zůstane čekání na `#start`).

- [ ] **Krok 1:** Unit testy `world-lines.test.ts` na všechny větve výše (CS i EN, ×2,63 / ×1,25 / ×1, svět 1 Normal bez odměny, zamčená karta, „připravujeme“).
- [ ] **Krok 2:** e2e v `game.spec.ts`:
  - bez `debug`: jen karta 1 a Normal jsou povolené, Insane a karty 2–5 `disabled`; Start spustí běh s `__game.world === 1`, `difficulty === "normal"`;
  - `?world=4&difficulty=hell` bez `debug`: předvybraný svět 1 Normal (Na co se zaměřit 1);
  - `?debug=1`: vše odemčené; volba Hell + karta 3 → `__game.world === 3`, `difficulty === "hell"`, první smečka má vyšší `maxHp` než v Normal (přes `__game`, nebo jen `world/difficulty`, pokud by test byl křehký);
  - `?debug=1&duration=5`, `__game.debug.killBoss()` po příchodu finálního bosse: po výhře zpět v menu a na volbě světa ukazuje karta 1 „★“ (s `debug` se neukládá, ale `ProgressSession` v paměti ano).
- [ ] **Krok 3:** Snímek `shots: worlds` (obrazovka volby, CS, `?debug=1`, Insane vybrané) do `npm run shots`; prohlédni ho na 1280×720 (nic nepřetéká, čitelnost karet, žádná oranžová).
- [ ] **Krok 4:** `npm run check`, `npm run build`, `npx playwright test --project=webgl2-fallback` → PASS.
- [ ] **Krok 5:** Commit `feat(ui): world and difficulty choice`.

### Úkol 7: Ladění k cílům spec 4.2, dokumentace

**Soubory:**
- Upravit: `design/rules.yaml` (jen `difficulty`), `data/generated/rules.json`, `docs/DECISIONS.md` (nová sekce Difficulties and worlds), `docs/STATUS.md`, `ARCHITECTURE.md`, `AGENTS.md`

- [ ] **Krok 1: Měření** (autopilot, seedy 1–10 pro ladění, 1–20 pro konečnou tabulku): svět 1–5 Normal × `--gear none|mid|full`; Insane a Hell svět 1 a 5 × `mid|full`.
- [ ] **Krok 2: Ladění** jen `difficulty.*` k cílům: svět 1 Normal bez výbavy = dnešek (Úkol 3); svět 5 Normal se střední výbavou 70–90 výher ze 160; Hell svět 5 s plnou výbavou pod 80 ze 160; Insane leží mezi. Když `worldStep` nestačí bez porušení monotonie (každý další svět nesmí mít víc výher), uprav `worldStep` a úrovně, ne fáze ani nepřátele.
- [ ] **Krok 3: DECISIONS:** konečná tabulka násobků, nájezdů navíc a odměn, tabulka výher (kombinace × výbava), proč hash obsahuje svět a obtížnost, že přírodní situace v menu chybí do plánu 2, nový digest matice.
- [ ] **Krok 4: Docs:** spec z projektu claude.ai do `docs/superpowers/specs/2026-11-21-difficulties-worlds-design.md` (stav „schváleno“); `ARCHITECTURE.md` (`sim/difficulty.ts`, `meta/progress.ts`, `worlds.yaml`, tok menu), `AGENTS.md` (URL `world`, `difficulty`, nová pole `window.__game`, přepínače `sim:run`, snímek `worlds`), `STATUS.md` (co Petr testuje: obrazovku volby, odemčení po výhře, pocit z Insane a Hell, čitelnost karet; rychlé odkazy `?debug=1&world=5&difficulty=hell`, `?debug=1&phase=16&difficulty=insane`).
- [ ] **Krok 5:** `npm run check`, `npm run build`, e2e `webgl2-fallback` a `sim-chromium` → PASS; commit `chore(balance): tune difficulty multipliers` a `docs: difficulties plan 1`, PR proti `main`, počkej na zelené CI, sloučit až na Petrovo slovo.
