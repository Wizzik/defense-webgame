# Obtížnosti 3a: Rudá pustina a Stínový hvozd — implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Světy 2 (Rudá pustina: řeka se dvěma mosty, písečná bouře) a 3 (Stínový hvozd: kruh pradávných stromů se čtyřmi průchody, trnité houští) dostanou vlastní kostru, přírodní situaci, vzhled a modely načítané jen pro zvolený svět; oba jsou `ready: true` a vyladěné na žebříčku.

**Architecture:** Simulace: unie přírodních situací dostane `weather` (časová situace se zpomalením chůze všech) a `thicket` (pevné zóny se zpomalením, uložené v mřížce `WorldMap` vedle cest); rychlost země (`groundSpeedScale`) nahradí `pathSpeedScale`. Klient: čistá tabulka vzhledu po světě (`client/render/world-look.ts`) řídí zem, světlo, mlhu, modely ostrůvků, okrajový les a styl prvku s průchodem (hradba, řeka, kruh stromů); `ArenaView` přestaví zem a les při změně světa, modely světa se načtou před startem běhu. Plán 3b (světy 4 a 5) jen přidá řádky do tabulek a dvě nové situace.

**Tech Stack:** TypeScript, Three.js (WebGPU / WebGL2, TSL), Vite, Vitest, Playwright, zod, KayKit Medieval Hexagon Pack (CC0, už pinovaný jako zdroj `hex`).

**Spec:** `docs/superpowers/specs/2026-11-21-difficulties-worlds-design.md` (4.1, 4.5, 4.7 body 2 a 3, 4.8, 4.9, 4.10 bod 3). Navazuje na plán 2 (`docs/superpowers/plans/2026-11-21-difficulties-obstacles.md`) a `docs/DECISIONS.md`, sekce Difficulties and worlds, plan 1 a plan 2.

**Rozdělení plánu 3 (Claudovo rozhodnutí, Petr může změnit):** spec 4.10 bod 3 je na jeden chat moc velký. **3a** (tento plán): systém vzhledu a načítání po světě, světy 2 a 3 celé. **3b** (další chat, po Petrově hraní 3a): Mrazivý sever (ledový hřbet s průsmykem, vánice s promrznutím), Spálená říše (rozpadlá zeď s trhlinami, zelené meteory s louží ohně), jejich vzhled, ladění žebříčku k cíli 4.2 pro svět 5, snímky `world-4`, `world-5`.

## Global Constraints

- `sim/` čistý a deterministický (AGENTS.md, Code rules): žádné `Math.random`, `Date`, `Math.sin|cos|atan2|hypot|pow`, žádné `**`; v `Run.step()` žádná alokace (nové stavy jsou pole pevné velikosti nebo čísla na `HazardState`).
- Clean room: žádné texty z mapy; jména a věty jsou vlastní, EN i CS.
- Žádná oranžová (Petr): rudá pustina je **vínově rudá a hnědočervená** (odstín 340–10°), ne cihlová ani oranžová; písek je šedorůžový. Test v Task 5 to hlídá (žádná barva vzhledu s odstínem 15–45° a sytostí > 0,35).
- Tma nesmí zhoršit čitelnost (spec 2, Nechceme): Stínový hvozd je noc v barvách, nepřátelé, hrdina, truhly a koule zůstávají vidět (snímek `world-3` posoudí Claude i Petr).
- fps: cíl nejvýš −10 % proti `main` s plným davem (Petrův stroj 144 fps); krok simulace v světě 2 a 3 nejvýš 1,2× světa 1 (dnes 0,076 ms, měří `sim:run` u stonehorn fáze 16, seedy 1–3 jako v plánu 2).
- Modely: každý svět (jeho modely prostředí) ≤ 1,5 MB; společné modely + modely jednoho světa ≤ 10 MB (spec 4.8, test v Task 5 nahradí dnešní „vše ≤ 10 MB“).
- Svět 1 na Normal se nemění: `sim:run` seedy 1–20 svět 1 dává stejný výstup jako `main` a případ `w1-storm` matice má stejný stav (mění se jen digest celé matice kvůli novým případům).
- `data:build` potřebuje export mapy: mapa je soubor `X_Hero_Siege_F-Day_v20.75_AI.w3x` v claude.ai projektu (Projects `project_read` s `original: true`), pak `npm run map:extract -- <cesta> v20.75` (výstup netrackovaný, nikdy necommitovat `*.w3x` ani `data-source/`).
- Commity Conventional Commits jako `Claude <noreply@anthropic.com>` s trailery session; `npm run check` před každým commitem. Větev `worlds-2-3`, PR proti `main` (REST API, viz STATUS, Environment notes).

## Review Focus

1. **Nepřátelé za řekou neuvíznou:** smečka, která se objeví severně od řeky (kruh příchodu řeku protíná), dojde k hradu přes mosty; nikdo nestojí ve vodě ani v kmeni stromu. Test v Task 2 (nepřítel z (0, 2400) ve světě 2 dojde k hradu do 90 s bez hrdiny).
2. **Úskok přes řeku a mezi stromy kruhu nepropadne:** mezerník u řeky hrdinu zastaví na břehu (kontrola pohybu po kouscích z plánu 2 musí platit i pro tlustou řeku 150). Test v Task 2.
3. **Přepínání světů v menu:** svět 2 → zpět → svět 3 → start: stará zem, les a ostrůvky zmizí, modely se stáhnou jednou, v konzoli žádná chyba, `__game.obstacles` sedí na nový svět. E2E v Task 7.
4. **Situace a pauza / konec běhu:** písečná bouře běží jen v krocích simulace (pauza level-upu, truhly a menu ji zastaví), po konci běhu mlha a částice zmizí a nový běh začne bez bouře. Test v Task 3 (běh vytvořený po bouři má `weatherTicks === 0`) a v Task 6 (`WeatherFx` při novém běhu vrátí mlhu světa).
5. **Autopilot a houští / řeka:** autopilot (a tím ladicí čísla) nesmí ve světě 2 a 3 padnout na 0 výher ani uvíznout u řeky na cestě k truhle; `sim:run` světa 2 a 3 bez výbavy ukáže výhry > 0 u aspoň 5 hrdinů (Task 8).

---

### Task 1: Unie přírodních situací a kostry světů 2 a 3 v datech

**Files:**
- Modify: `data/schema/world.ts` (WeatherSchema, ThicketSchema, HazardSchema)
- Modify: `data/schema/schema.test.ts`
- Modify: `design/worlds.yaml` (světy 2 a 3 vlastní `map` a `hazard`; `ready` zatím `false`, zapne Task 8)
- Modify: `sim/hazard.ts`, `sim/bot.ts` (zúžení na `kind === "storm"`, chování beze změny)
- Regenerate: `data/generated/worlds.json`

**Interfaces:**
- Produces (`data/schema/world.ts`):
  - `WeatherSchema = { kind: "weather", effect: "sand", fromPhase: int ≥ 1, everySeconds: range(positive), durationSeconds: positive, warnSeconds: positive, moveSlow: share, name: LocalizedText }` (`effect` je enum `["sand"]`; 3b přidá `"snow"` a nepovinné `chill`).
  - `ThicketSchema = { kind: "thicket", slow: share, zones: [x, y, r][] (min 1, r positive), name: LocalizedText }`.
  - `HazardSchema = z.discriminatedUnion("kind", [StormSchema, WeatherSchema, ThicketSchema])`; typy `Storm`, `Weather`, `Thicket` exportované vedle `Hazard`.
  - helper `export function stormOf(world: World): Storm | null` v `data/schema/world.ts` (vrátí situaci, je-li `kind === "storm"`).

- [ ] **Step 1: Testy schématu** v `data/schema/schema.test.ts`:
  - `"parses a weather hazard"`: objekt výše s `effect: "sand"` projde; `moveSlow: 1.2` neprojde; `effect: "fog"` neprojde.
  - `"parses a thicket hazard"`: `zones: [[0, 900, 200]]` projde; `zones: []` a `r = 0` neprojdou.
  - `"rejects an unknown hazard kind"`: `kind: "flood"` neprojde.
- [ ] **Step 2:** `npx vitest run data/schema` → FAIL (neznámé `kind`).
- [ ] **Step 3: Schéma** podle Interfaces; `stormOf` vrací zúžený typ.
- [ ] **Step 4: Zúžení v simulaci:** `updateHazard` zavolá dnešní logiku bouře (přejmenovat na `updateStorm`) jen pro `storm`; `debugHazard`, `strike`, `startWave`, `gapTicks` čtou bouři přes `stormOf`; `bot.ts` (dnes `hazard.radius` u řádku 209) přeskočí uhýbání, když `stormOf(...) === null`. `npm run check` → PASS (svět 1 beze změny).
- [ ] **Step 5: Kostry v `design/worlds.yaml`** (sever = +y; souřadnice jsou návrh, Task 2 je ověří průchodností):
  - **Rudá pustina** `map`:
    - `feature.thickness: 150`; řeka přes celou arénu jako lomená čára `(-3000,1500) (-1500,1150) (-400,1250) (600,1000) (1700,1200) (3000,900)`, rozdělená na úsečky s dvěma mosty (mezery v ose 300): most Z na úsečce `(-1500,1150)-(-400,1250)` mezi x = −1050 a −750, most V na úsečce `(600,1000)-(1700,1200)` mezi x = 1000 a 1300. Výsledné úsečky (y dopočítej na přímce, zaokrouhli na celé): `[-3000,1500,-1500,1150]`, `[-1500,1150,-1050,1191]`, `[-750,1218,-400,1250]`, `[-400,1250,600,1000]`, `[600,1000,1000,1073]`, `[1300,1127,1700,1200]`, `[1700,1200,3000,900]`.
    - `paths` (šířka 160, `speedBonus: 0.15`): `[[0,200],[-900,1205],[-1200,2800]]`, `[[0,200],[1150,1100],[1500,2800]]`, `[[0,-200],[0,-2850]]`, `[[200,0],[2850,-300]]`.
    - `islands`: `count {min: 28, max: 36}`, `radius {40, 200}`, `gap 120`, `kinds {rock: 6, trees: 1, ruin: 3}` (rock = skály a stolové hory, trees = suché pahýly, ruin = stany klanů; Task 5).
    - `clear` jako svět 1 (`castle 600, ringInner 2200, ringOuter 2600, pathMargin 60, featureMargin 150`).
  - **Rudá pustina** `hazard`: `kind: weather`, `effect: sand`, `fromPhase: 2`, `everySeconds {min: 100, max: 130}`, `durationSeconds: 15`, `warnSeconds: 5`, `moveSlow: 0.2`, `name {en: Sandstorm, cs: Písečná bouře}`.
  - **Stínový hvozd** `map`:
    - `feature.thickness: 110`; kruh pradávných stromů o poloměru 1300 kolem hradu se čtyřmi průchody (osa mezery 300) na úhlopříčkách 45°, 135°, 225°, 315°, šestnáct úseček:
      `[807,1019,427,1228]`, `[427,1228,0,1300]`, `[0,1300,-427,1228]`, `[-427,1228,-807,1019]`, `[-1019,807,-1228,427]`, `[-1228,427,-1300,0]`, `[-1300,0,-1228,-427]`, `[-1228,-427,-1019,-807]`, `[-807,-1019,-427,-1228]`, `[-427,-1228,0,-1300]`, `[0,-1300,427,-1228]`, `[427,-1228,807,-1019]`, `[1019,-807,1228,-427]`, `[1228,-427,1300,0]`, `[1300,0,1228,427]`, `[1228,427,1019,807]`.
    - `paths`: čtyři úhlopříčky `[[150,150],[2000,2000]]`, `[[-150,150],[-2000,2000]]`, `[[-150,-150],[-2000,-2000]]`, `[[150,-150],[2000,-2000]]`.
    - `islands`: `count {min: 34, max: 44}`, `radius {40, 200}`, `gap 120`, `kinds {rock: 2, trees: 7, ruin: 1}`; `clear` jako svět 1.
  - **Stínový hvozd** `hazard`: `kind: thicket`, `slow: 0.35`, `zones`: `[1850,0,300]`, `[650,1785,280]`, `[-1691,616,320]`, `[-1832,-667,260]`, `[0,-1850,300]`, `[1645,-950,280]`, `[0,900,200]`, `[-325,-893,200]`, `name {en: Thornbrake, cs: Trnité houští}`.
  - Světy 4 a 5 dál `map: *silverMap`, `hazard: *silverStorm`. Hlavičkový komentář souboru doplň o `weather` a `thicket`.
- [ ] **Step 6:** `npm run data:build -- --source data-source/v20.75/out --out data/generated` (mapu nejdřív stáhni a vyextrahuj, Global Constraints), pak `npm run check` → PASS.
- [ ] **Step 7: Commit** `feat(worlds): weather and thicket hazards, skeletons of worlds 2 and 3`.

### Task 2: Mapa světa 2 a 3: průchodnost, houští v mřížce, rychlost země

**Files:**
- Modify: `sim/world-map/map.ts` (mřížka houští), `sim/world-map/geometry.ts` (`groundSpeedScale` místo `pathSpeedScale`), `sim/hero.ts:109`, `sim/enemy-ai.ts:54`, `sim/index.ts:46`
- Modify: `sim/world-map/map.test.ts`, `sim/world-map/collide.test.ts`
- Create: `sim/world-map/worlds.test.ts` (průchodnost a kostra světů 2 a 3)

**Interfaces:**
- Consumes: `Thicket` z Task 1.
- Produces:
  - `WorldMap.thicket: Uint8Array` (PATH_SIZE², 1 = střed buňky v zóně houští), `WorldMap.thicketSlow: number` (0, když svět houští nemá).
  - `groundSpeedScale(map: WorldMap, x: number, y: number): number` v `sim/world-map/geometry.ts`: na cestě `1 + map.pathBonus` (cesta má přednost), jinak v houští `1 - map.thicketSlow`, jinak 1. `pathSpeedScale` zmizí (hero, enemy-ai a export v `sim/index.ts` přejdou na nový název).
  - `inThicket(map: WorldMap, x: number, y: number): boolean` (pro HUD a snapshot).

- [ ] **Step 1: Testy** v `sim/world-map/worlds.test.ts` (data z `data/generated`, `buildWorldMap` / `new WorldMap` jako v `map.test.ts`):
  - `"world 2 and 3 keep every free cell reachable from the castle on 200 seeds"`: pro svět 2 i 3 a seedy 1–200 `blockedReachable(map)` má `reached === free` a počet ostrůvků je v rozsahu z dat.
  - `"the river blocks its cells and leaves both bridges open"`: buňka na ose řeky u (−2200, 1324) a u (2300, 1038) je `blocked`, buňky mostů (−900, 1205) a (1150, 1100) nejsou.
  - `"the tree ring blocks the ring and leaves the four diagonal passages open"`: buňky (0, 1300), (−1300, 0) blokované; (919, 919), (−919, 919), (−919, −919), (919, −919) volné.
  - `"no island lands on a bridge, a passage or a path"`: na 200 seedech žádný ostrůvek neleží blíž než `gap` k bodům mostů a průchodů výše.
  - `"an enemy north of the river reaches the castle through a bridge"`: běh světa 2 (seed 1, `--idle` vstup), nepřítel typu z první fáze postavený na (0, 2400) s cílem hrad; do 90 s (2700 kroků) je u hradu (v dosahu útoku) a nikdy nestál v překážce (`isFree` s jeho kolizí v každém kroku).
- [ ] **Step 2: Testy rychlosti a houští** v `sim/world-map/map.test.ts`: `"thicket slows walking inside a zone, a path wins over the thicket"` (svět 3: `groundSpeedScale` ve (0, 900) = 0,65; na cestě (1000, 1000) = 1,15; ve volném poli (0, −600)… mimo zónu = 1; svět 1 kdekoli mimo cestu = 1); `"inThicket"` true v (1850, 0), false v (1400, 0).
- [ ] **Step 3: Test úskoku** v `sim/world-map/collide.test.ts`: `"a dash at the river stops on the bank"`: svět 2, hrdina v (−2200, 1000), úskok na sever (vstup jako u testu hradby z plánu 2) → po úskoku `hero.y` < osa řeky − 75 − kolize hrdiny + 1 a `isFree` platí.
- [ ] **Step 4:** `npx vitest run sim/world-map` → nové testy FAIL.
- [ ] **Step 5: Implementace:** v konstruktoru `WorldMap` pro `hazard.kind === "thicket"` označ buňky mřížky cest (`PATH_CELL`), jejichž střed leží v některé zóně (porovnání čtverců vzdáleností, žádné `hypot`), a nastav `thicketSlow`; `groundSpeedScale` a `inThicket` čtou mřížku. Pokud průchodnost nebo test mostů neprojde, uprav souřadnice v `design/worlds.yaml` (ne logiku) a přegeneruj data.
- [ ] **Step 6:** `npm run check` → PASS; `npm run sim:run -- --hero all --seeds 1-20` (svět 1) dává stejný výstup jako před Task 2 (ulož si ho před změnou do `/tmp`).
- [ ] **Step 7: Commit** `feat(worlds): maps of worlds 2 and 3, thicket ground speed`.

### Task 3: Písečná bouře v simulaci

**Files:**
- Create: `sim/weather.ts`, `sim/weather.test.ts`
- Modify: `sim/hazard.ts` (HazardState, dispatch, `debugHazard`), `sim/hero.ts` (chůze), `sim/enemy-ai.ts` (chůze), `sim/hash.ts`, `sim/events.ts` (komentář u `HazardWave`), `sim/index.ts`
- Modify: `client/determinism/matrix.ts` (případy `w2-sand`, `w3-thicket`), `tools/sim-run/*` (řádek `world`)

**Interfaces:**
- Consumes: `Weather` z Task 1, `groundSpeedScale` z Task 2.
- Produces:
  - `HazardState.weatherTicks: number` (kroky zbývající běžící bouři, 0 = neběží), `HazardState.warnTicks: number` (kroky do začátku ohlášené bouře, 0 = žádná); `waves` počítá i bouře.
  - `export const WeatherPhase = { Warn: 1, Start: 2, End: 3 } as const` v `sim/weather.ts`; událost `EventKind.HazardWave` s `u = WeatherPhase.*` a hodnotou = sekundy (varování: `warnSeconds`, start: `durationSeconds`, konec: 0). Bouře z plánu 2 posílá dál `u = 0`.
  - `updateWeather(run: Run): void` (volá `updateHazard` pro `kind === "weather"`), `weatherSpeedScale(run: Run): number` (1 − `moveSlow`, když `weatherTicks > 0`, jinak 1), `debugWeather(run: Run): void` (bouře hned: `warnTicks = 0`, `weatherTicks = duration`, událost Start).
  - `debugHazard(run)` volá podle druhu situace bouři blesků, `debugWeather`, nebo nic (houští).

- [ ] **Step 1: Testy** v `sim/weather.test.ts` (svět 2, seed 1):
  - `"announces the sandstorm warnSeconds ahead, then runs it durationSeconds"`: první varování nejdřív v kroku začátku fáze 2 + `everySeconds.min` − `warnSeconds`, nejpozději + `max` − `warnSeconds`; Start přesně `warnSeconds × 30` kroků po varování; End přesně `durationSeconds × 30` kroků po startu; pořadí událostí Warn → Start → End.
  - `"slows the walking of the hero and of enemies by moveSlow only while it runs"`: krok hrdiny se vstupem na východ ve volném poli je při běžící bouři 0,8× kroku bez ní; totéž u nepřítele; úskok (dash) má stejnou délku s bouří i bez ní.
  - `"the next storm follows its gap after the end"`: dvě bouře za sebou; mezera mezi koncem první a varováním druhé v rozsahu `everySeconds` − `warnSeconds`.
  - `"debug starts the storm at once"`: `debugHazard` → `weatherTicks === durationSeconds × 30` v tomtéž kroku, událost Start; ve světě 3 (houští) `debugHazard` nic nezmění a nespadne.
  - `"a new run starts without a storm"` (Review Focus 4): běh vytvořený po běhu s běžící bouří má `weatherTicks === 0` a `warnTicks === 0`.
  - `"the hash covers the storm"`: změna `weatherTicks` změní `hashRun`.
  - `"step does not allocate"` jako u dalších systémů (stejný pomocník, jaký používá `sim/hazard.test.ts`).
- [ ] **Step 2:** `npx vitest run sim/weather.test.ts` → FAIL.
- [ ] **Step 3: Implementace:** `updateWeather` (časování z `run.hazardRng`, první bouře od začátku `fromPhase` + mezera, jako `nextWaveTick` bouře blesků; varování při `nextWaveTick − warn`); `weatherSpeedScale` násobí chůzi hrdiny (ne úskok) v `sim/hero.ts` a chůzi nepřátel v `sim/enemy-ai.ts` vedle `groundSpeedScale`; hash míchá `weatherTicks`, `warnTicks`, `waves`.
- [ ] **Step 4:** `npx vitest run sim` → PASS.
- [ ] **Step 5: Matice determinismu** (`client/determinism/matrix.ts`): přidej `{ id: "w2-sand", hero: "mistwarden", seed: 11, startPhase: 4, gear: "none", maxTicks: 6000, world: 2 }` (musí obsahovat aspoň jednu celou bouři: ověř, že v běhu přišly Start i End) a `{ id: "w3-thicket", hero: "stonehorn", seed: 13, startPhase: 2, gear: "mid", maxTicks: 4500, world: 3 }`. Spusť matici v Node (test, který digest počítá; `npx vitest run client/determinism`) a v `sim-chromium` (`npx playwright test --project=sim-chromium`); oba ukážou stejný nový digest. Případ `w1-storm` má stejný stav jako na `main`.
- [ ] **Step 6: `sim:run`:** řádek `world` dostane `sand <počet bouří>` a `thicket <podíl kroků hrdiny v houští, %>` (z `inThicket` v nástroji, ne v simulaci).
- [ ] **Step 7:** `npm run check` → PASS. **Commit** `feat(sim): sandstorm weather, matrix cases for worlds 2 and 3`.

### Task 4: Modely prostředí po světech a rozpočet

**Files:**
- Modify: `tools/assets-build/manifest.ts` (nové řádky `ENV`)
- Create: `client/render/world-look.ts` (jen data, bez importu `three`), `client/render/world-look.test.ts`
- Modify: `tests/assets.test.ts` (rozpočet po světech), `assets/LICENSES.md` (přepíše `assets:build`)
- Add: `assets/models/env/*.glb` (nové)

**Interfaces:**
- Produces (`client/render/world-look.ts`):
  ```ts
  export type FeatureStyle = "wall" | "river" | "trees";
  export type Particles = "none" | "dust" | "fireflies";
  export interface WorldLook {
    ground: { a: number; b: number; c: number; dirt: number };
    sky: number;
    fog: { near: number; far: number };
    hemi: { sky: number; ground: number; intensity: number };
    moon: { color: number; intensity: number };
    path: number;
    stone: { wall: number; top: number; ruin: number };
    water: number;                       // the river (world 2); other worlds keep any value
    feature: FeatureStyle;
    islands: { rock: string[]; trees: string[]; ruin: string[] | "blocks" };
    forest: string[];                    // the border beyond the arrival ring
    propTint: number;                    // multiplies the colour of every island and forest prop (0xffffff = none)
    thicket: { ground: number; bush: string } | null;
    weather: { color: number; fogNear: number; fogFar: number } | null;
    particles: Particles;                // always on in the world (fireflies); "dust" runs only during the weather
  }
  export const PROP_SIZES: Record<string, { size: number; by: "height" | "extent" }>; // replaces PROP_MODELS sizes
  export const COMMON_ENV: readonly string[];   // castle, tower, flag
  export function lookOf(worldId: string): WorldLook;  // worlds without a row fall back to "silver-march"
  export function worldModelIds(look: WorldLook): string[]; // islands + forest + bush, unique, sorted
  ```
- Řádek `silver-march` přesně odpovídá dnešku (`palette.ts`, dnešní `ROCKS`, `TREES`, ruiny jako bloky, les z `PROP_MODELS`, `feature: "wall"`, `propTint 0xffffff`, bez houští a počasí, `particles: "none"`).

- [ ] **Step 1: Testy** v `client/render/world-look.test.ts`:
  - `"silver march keeps today's look"`: barvy shodné s konstantami v `palette.ts`, `worldModelIds` = dnešních 8 modelů stromů a skal.
  - `"every model id of every look is built by the asset manifest and has a size"`: každé id z `worldModelIds` všech řádků je v `ENV` manifestu i v `PROP_SIZES`.
  - `"no orange in any look"`: žádná barva řádků (všechna čísla) nemá odstín 15–45° při sytosti > 0,35 (HSL).
  - `"red waste and shadewood have their own feature style"`: `lookOf("red-waste").feature === "river"`, `lookOf("shadewood").feature === "trees"`, `lookOf("frostreach")` = řádek silver-march.
- [ ] **Step 2: Test rozpočtu** v `tests/assets.test.ts` nahradí `"keeps all models together within 10 MB"`:
  - `"each world's env models stay within 1.5 MB"` (součet `worldModelIds(lookOf(id))` pro každé id z `design/worlds.yaml`);
  - `"common models plus one world stay within 10 MB"` (hrdinové, nepřátelé, robot, `COMMON_ENV` + nejtěžší svět);
  - `"every env model belongs to a world or the common set"` (žádný sirotek v `assets/models/env/`).
- [ ] **Step 3:** `npx vitest run client/render/world-look.test.ts tests/assets.test.ts` → FAIL.
- [ ] **Step 4: Manifest** (zdroj `hex`, cesty pod `decoration/nature/` a `decoration/props/`): `mesa-a` ← `mountain_A`, `mesa-c` ← `mountain_C`, `rock-d` ← `rock_single_D`, `stump-a` ← `tree_single_A_cut`, `stumps` ← `trees_A_cut`, `tent` ← `decoration/props/tent`, `bush` ← `trees_A_small`, `trees-d` ← `trees_B_medium`. `npm run assets:fetch`, `npm run assets:build` (zapíše GLB a řádky `assets/LICENSES.md`).
- [ ] **Step 5: Řádky vzhledu** (barvy jsou návrh; snímky v Task 7 je potvrdí):
  - **red-waste:** zem `a 0x4a2a2e`, `b 0x553236`, `c 0x3e2a2a`, `dirt 0x5c4a46` (šedorůžová suchá tráva a hlína); obloha `0x24161e`; mlha 52–98; hemi `0xc9a6b8` / `0x24161c` / 1,0; měsíc `0xe6d6e6`, 2,0; cesta `0x3c2c30`; kámen `0x7a6670` / `0x665660` / `0x80707a`; voda `0x2e4a5c`; `feature: "river"`; ostrůvky `rock: [mesa-a, mesa-c, rock-d, rock-b]`, `trees: [stump-a, stumps]`, `ruin: [tent]`; les `[stumps, stump-a, rock-d, mesa-c]`; `propTint 0xd9b8c0`; bez houští; počasí `{ color: 0x6a5056, fogNear: 14, fogFar: 40 }`; `particles: "dust"`.
  - **shadewood:** zem `a 0x1e3236`, `b 0x22383a`, `c 0x1a2b30`, `dirt 0x2a3338`; obloha `0x0b1226`; mlha 48–92; hemi `0x8aa6e6` / `0x0e1424` / 0,9; měsíc `0xbcd2ff`, 2,4; cesta `0x2a3440`; kámen `0x5c6a80` / `0x4a5668` / `0x66748a`; `feature: "trees"`; ostrůvky `rock: [rock-a, rock-c]`, `trees: [trees-a, trees-b, trees-d, tree-b]`, `ruin: "blocks"`; les `[trees-a, trees-b, trees-d, trees-c]`; `propTint 0x9fb8c8`; houští `{ ground: 0x2a1e34, bush: "bush" }`; bez počasí; `particles: "fireflies"`.
- [ ] **Step 6:** `npx vitest run client/render/world-look.test.ts tests/assets.test.ts` → PASS (pokud svět přesáhne 1,5 MB, vyhoď z jeho řádku nejtěžší model a napiš proč do DECISIONS v Task 8).
- [ ] **Step 7: Commit** `feat(assets): env models and looks of worlds 2 and 3, budget per world`.

### Task 5: Vzhled světa v klientu: zem, světlo, les, ostrůvky, řeka, kruh stromů, houští

**Files:**
- Create: `client/render/arena-view.ts`, `client/render/world-models.ts`, `client/render/feature-view.ts` (+ `feature-view.test.ts`)
- Modify: `client/render/ground.ts` (`createGround(rules, look)`), `client/render/lighting.ts` (`applyLook`), `client/render/scene.ts` (`createArena` jen hrad; zem a les přejdou do `ArenaView`), `client/render/props.ts` (velikosti z `PROP_SIZES`, tint), `client/render/prop-layout.ts` (les z `look.forest`), `client/render/world-view.ts` (modely ostrůvků z `look`, prvek přes `feature-view`), `client/render/palette.ts` (jen co zbude), `client/main.ts` (načtení modelů světa před startem)

**Interfaces:**
- Consumes: `WorldLook`, `lookOf`, `worldModelIds`, `PROP_SIZES` (Task 4); `WorldMap.thicket`, hazard `zones` (Task 1–2).
- Produces:
  - `loadWorldModels(cache: ModelCache, look: WorldLook): Promise<Map<string, GLTF>>` v `client/render/world-models.ts` (jednou za id díky `ModelCache`).
  - `class ArenaView implements RunView` (`client/render/arena-view.ts`): `constructor(data, scene, lighting, models: (id: string) => GLTF)`; při `run.world` jiném než minule zahodí starou zem a les (`dispose` geometrií a instancí) a postaví nové podle `lookOf(data.worlds[world-1].id)`; zavolá `lighting.applyLook(scene, look)`.
  - `Lighting.applyLook(scene: Scene, look: WorldLook): void` (obloha, mlha, barvy a síly světel); `applyTo` zmizí.
  - `featureInstances(map: WorldMap, style: FeatureStyle): WorldInstance[]` v `client/render/feature-view.ts`: `wall` = dnešní kusy hradby a sloupky; `river` = pás vody na úsečku (`model: "water"`) a most (`model: "bridge"`) na každou dvojici volných konců úseček do 400 od sebe (most leží napříč mezerou, délka = vzdálenost konců + tloušťka); `trees` = strom (`model` z `look.islands.trees`, podle indexu) každých 90 podél úsečky a nízký val z kořenů (`model: "roots"`) pod úsečkou.
  - `WorldView` dostane `models: (id) => GLTF` a `look` místo `props: GLTF[]`; houští kreslí plochý disk barvy `look.thicket.ground` na zónu a keře `look.thicket.bush` (6–10 na zónu, rozmístěné zlatým úhlem, měřítko 0,5–0,8).
  - `client/main.ts`: před `session.start` (start menu i `WorldScreen.onStart`) `await loadWorldModels(...)` pro zvolený svět; `WorldScreen.onStart` je kvůli tomu `async`, tlačítko Start se do načtení zakáže (krátké „Načítám…“ / „Loading…“, nové klíče v `messages-*.ts`).

- [ ] **Step 1: Testy** v `client/render/feature-view.test.ts` (čisté funkce, mapy z dat):
  - `"the river of world 2 has water on every segment and exactly two bridges at the gaps"`: 7 úseček → kusy `water`, právě 2 kusy `bridge`, jejich středy do 60 od (−900, 1205) a (1150, 1100).
  - `"the tree ring of world 3 has trees along every segment and none in the passages"`: žádný strom blíž než 120 k bodům průchodů (919, 919) ×4 znaménka; počet stromů ≥ 16 × 4.
  - `"world 1 keeps today's wall pieces and posts"`: stejné instance jako dnešní `worldInstances` (snapshot počtů: kusy hradby, 4 sloupky u bran + 2 konce).
- [ ] **Step 2:** `npx vitest run client/render/feature-view.test.ts` → FAIL.
- [ ] **Step 3: Implementace** podle Interfaces. Voda: `MeshStandardMaterial` barvy `look.water`, `roughness 0.25`, `metalness 0.1`, výška 0,02 nad zemí, šířka = tloušťka prvku; břeh: druhý pás o 30 širší barvy `look.ground.dirt` pod ní. Most: instanční box barvy `look.stone.top`, výška 18. Val kořenů: instanční box `look.stone.ruin` výšky 30, šířky tloušťky. Tint: `propTint` násobí klon materiálu modelu (klon jednou na model a svět, ne na instanci). Zem: `createGround(rules, look)` čte `look.ground`; kruh příchodu a hlína u hradu zůstávají.
- [ ] **Step 4:** `npx vitest run client/render` → PASS; `npm run check` → PASS.
- [ ] **Step 5: Vizuální kontrola:** `npm run build`, `npm run shots` → `world-1` vypadá jako na `main` (porovnej s výstupem z `main`; drobné rozdíly ve stínech jsou v pořádku, jiná barva ne).
- [ ] **Step 6: Commit** `feat(render): per-world look, arena rebuilt on world change, river and tree ring`.

### Task 6: Písečná bouře a houští v klientu: mlha, prach, světlušky, HUD, snapshot

**Files:**
- Create: `client/render/weather-fx.ts` (+ `weather-fx.test.ts` pro čistou část), `client/render/particles.ts`
- Modify: `client/ui/hud.ts` (ohlášení podle `u`), `client/ui/buff-bar.ts` (+ test), `client/ui/messages-en.ts`, `client/ui/messages-cs.ts`, `client/game/debug.ts` (snapshot), `client/main.ts` (views), `client/audio/event-cues.ts` (nic nového: komentář)

**Interfaces:**
- Consumes: `WeatherPhase`, `HazardState.weatherTicks/warnTicks` (Task 3), `inThicket`, `groundSpeedScale` (Task 2), `WorldLook.weather/particles` (Task 4), `Lighting.applyLook` (Task 5).
- Produces:
  - `weatherFog(look: WorldLook, weatherTicks: number, fadeTicks: number): { color: number; near: number; far: number }` (čistá: mimo bouři mlha světa; během bouře plynule do `look.weather` za `fadeTicks` = 45 kroků od startu a zpět 45 kroků před koncem).
  - `class WeatherFx implements RunView`: každý snímek nastaví `scene.fog` podle `weatherFog`; nový běh (jiný `Run`) vrátí mlhu světa (Review Focus 4).
  - `class Particles` (`client/render/particles.ts`): jeden `Points` s 600 body v krabici 60 × 20 × 60 scénických jednotek kolem kamery; režim `dust` (barva `look.weather.color`, vítr na východ, viditelný jen při `weatherTicks > 0`) a `fireflies` (200 bodů, barva `0xbfe8a8`, pomalé bloudění, aditivní, vždy ve světě s `particles: "fireflies"`). Pohyb jen v klientu (`Math.random` je tu dovolené).
  - `BuffKind` dostane `"sand"` (sekundy `weatherTicks`) a `"thicket"` (bez sekund: buňka zobrazí jen glyf, když je hrdina v houští); `buffCells(buffs, snares, lang, hazard: { stormTicks: number; sandTicks: number; inThicket: boolean })` (poslední parametr nahradí dnešní `stormTicks`). Glyfy: písek = tři vlnky, houští = trnitá větev (vlastní SVG cesty jako ostatní).
  - Ohlášení: `HazardWave` s `u = 0` → `announce.storm` (dnes), `u = Warn` → `announce.sand` („A sandstorm is coming!“ / „Blíží se písečná bouře!“), `u = Start` a `End` → nic. Houští ohlásí jednou na začátku běhu ve světě 3 `announce.thicket` („Thorns slow everyone in the brakes.“ / „Trní v houštinách zpomalí každého.“).
  - Snapshot `__game.hazard`: `{ kind: "storm" | "weather" | "thicket"; pending; waves; weather: s zbývající bouře; warning: s do začátku; ground: groundSpeedScale pod hrdinou }`; `__game.render.particles` = počet viditelných částic.
- [ ] **Step 1: Testy:** `weather-fx.test.ts`: `"fog of the world outside the weather"`, `"fog reaches the weather fog after fadeTicks and returns before the end"`; `buff-bar.test.ts`: `"a running sandstorm shows its seconds"`, `"the thicket shows its glyph without seconds only while the hero stands in it"`; `i18n.test.ts` už hlídá, že EN a CS mají stejné klíče.
- [ ] **Step 2:** `npx vitest run client` → FAIL.
- [ ] **Step 3: Implementace** podle Interfaces; `HazardFx` (blesky) dál jen pro `storm`.
- [ ] **Step 4:** `npm run check` → PASS.
- [ ] **Step 5: Commit** `feat(client): sandstorm fog and dust, fireflies, thicket and sandstorm in the HUD`.

### Task 7: E2E, snímky `world-2` a `world-3`, přepínání světů

**Files:**
- Modify: `e2e/game.spec.ts`, `e2e/shots.spec.ts`, `AGENTS.md` (shots, `__game.hazard`, `__game.render.particles`)

- [ ] **Step 1: E2E** v `e2e/game.spec.ts` (projekt `webgl2-fallback`):
  - `"world 2: river, bridges and a sandstorm"`: `?debug=1&world=2`, `startRun`; `__game.hazard.kind === "weather"`, `__game.obstacles >= 7 + 28`; `__game.debug.hazard()` → do 2 s `__game.hazard.weather > 0` a `__game.render.particles > 0`; `__game.debug.teleport(-2200, 1000)`, držet W 1 s → `heroY` < 1250 − 75.
  - `"world 3: the thicket slows the hero"`: `?debug=1&world=3`, `startRun`, `teleport(0, 900)` → `__game.hazard.ground` ≈ 0,65 (±0,01); `teleport(0, -600)` → 1.
  - `"switching worlds rebuilds the arena"` (Review Focus 3): menu Start → volba světa 2 → Start → Esc / zpět do menu → svět 3 → Start; `__game.world === 3`, `__game.hazard.kind === "thicket"`, žádná zpráva `error` v konzoli, každý model prostředí stažen jednou (počet požadavků na `/models/env/*.glb` z `page.on("request")` = počet unikátních id).
- [ ] **Step 2: Snímky** v `e2e/shots.spec.ts`: `world-2` (hrdina u západního mostu (−900, 1050), běžící písečná bouře přes `debug.hazard()`, po 1,5 s, CS) a `world-3` (hrdina u severovýchodního průchodu (850, 850) s houštím (650, 1785) v záběru a světluškami, CS). Doplň popis do AGENTS.md vedle `world-1`.
- [ ] **Step 3:** `npm run build && npx playwright test --project=webgl2-fallback` → PASS; `npm run shots` → prohlédni `world-1`, `world-2`, `world-3`: čitelnost hrdiny, nepřátel, truhel a koulí, žádná oranžová, řeka a mosty čitelné, kruh stromů jako hranice. Co nesedí, oprav v `world-look.ts` a znovu.
- [ ] **Step 4: Commit** `test(e2e): worlds 2 and 3, world switching, shots world-2 and world-3`.

### Task 8: Ladění světů 2 a 3, `ready`, výkon, dokumentace

**Files:**
- Modify: `design/worlds.yaml` (`ready: true` u světů 2 a 3; případně čísla situací a ostrůvků), `design/rules.yaml` (`difficulty.worldStep` jen když nestačí čísla situací), `data/generated/*`, `docs/DECISIONS.md`, `docs/STATUS.md`, `ARCHITECTURE.md` (nové soubory `sim/weather.ts`, `client/render/world-look.ts`, `arena-view.ts`, `feature-view.ts`, `weather-fx.ts`, `particles.ts`), spec (stav: plán 3 rozdělen na 3a / 3b)

- [ ] **Step 1: Měření** (seedy 1–20, Normal): `npm run sim:run -- --hero all --seeds 1-20 --world 1-3 --gear none` a totéž s `--gear mid` a `--gear full`. Výchozí body (z DECISIONS, plán 2): svět 1 bez výbavy 74, mid 104, full 137 výher ze 160.
- [ ] **Step 2: Cíl** (Claudův návrh v duchu spec 4.2, Petr může změnit): výhry se střední výbavou klesají po žebříčku: svět 2 v 88–100, svět 3 v 74–90; bez výbavy svět 2 i 3 nad 0 u aspoň 5 hrdinů (Review Focus 5); svět 1 beze změny. Ladí se v tomto pořadí, každý krok s novým měřením: (1) `moveSlow` a `everySeconds` písečné bouře, `slow` a velikost zón houští; (2) počty ostrůvků; (3) až pak `worldStep` (mění i světy 4 a 5, zapiš nové hodnoty jejich výher).
- [ ] **Step 3: Výkon:** krok simulace `sim:run --hero stonehorn --phase 16 --seeds 1-3 --world 2` a `--world 3` proti světu 1 (cíl ≤ 1,2×); pokud řeka přes celou arénu přepíná nepřátele na mapu směrů příliš často, zúž test „přímá čára protíná prvek“ na úsečky, ne celý obdélník prvku, a změř znovu.
- [ ] **Step 4:** `ready: true` u světů 2 a 3, `npm run data:build`, `npm run check`, `npm run build`, `npx playwright test --project=webgl2-fallback --project=sim-chromium` → PASS.
- [ ] **Step 5: DECISIONS** (nová sekce „Difficulties and worlds, plan 3a: Red Waste and Shadewood“): rozdělení plánu 3, kostry (řeka, mosty, kruh stromů, zóny houští), čísla písečné bouře a houští, modely a rozpočet po světech, tabulka výher svět 1–3 × none / mid / full (a světy 4–5, změnil-li se `worldStep`), krok simulace, nový digest matice. **STATUS**: sekce nahoře, co Petr kontroluje (vzhled a čitelnost obou světů, řeka a mosty, kruh stromů, jestli houští chytá nepřátele, jestli je písečná bouře znát a není otravná, fps s davem ve světě 2 a 3: `?fps=1&debug=1&phase=16&world=2`), rychlé odkazy (`?debug=1&world=2`, `?debug=1&world=3`, `__game.debug.hazard()`, `__game.hazard`), a co přijde v 3b.
- [ ] **Step 6: Commit** `feat(worlds): worlds 2 and 3 ready, tuned; docs`, push větve, PR proti `main`; po zelené CI čekat na Petrovo slovo ke sloučení (jako u PR #28 a #29).
