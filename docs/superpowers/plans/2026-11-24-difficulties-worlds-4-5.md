# Obtížnosti 3b: Mrazivý sever a Spálená říše — implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Světy 4 (Mrazivý sever: ledový hřbet ve tvaru podkovy s jedním průsmykem, vánice s promrznutím) a 5 (Spálená říše: rozpadlá osmiboká zeď se čtyřmi trhlinami, zelené meteory s loužemi ohně) dostanou vlastní kostru, přírodní situaci a vzhled; oba jsou `ready: true` a žebříček je vyladěný až po svět 5.

**Architecture:** Navazuje na systém z plánu 3a beze změny tvaru. Simulace: `weather` dostane `effect: "snow"` a nepovinné `chill` (promrznutí hrdiny, který stojí, `sim/chill.ts`); nová situace `meteors` sdílí s letní bouří vlny a varovné kruhy (`stormOf` vrací `Storm | Meteors`) a po dopadu nechá louži ohně (`sim/fire-pools.ts`, pevná pole v `HazardState`). Klient: dva nové řádky `world-look.ts`, styly prvku `ridge` a `broken`, částice `snow` a `embers`, zelené kruhy meteorů a louže v `HazardFx`. Žádné nové modely (krystaly hřbetu jsou procedurální), rozpočet modelů se nemění.

**Tech Stack:** TypeScript, Three.js (WebGPU / WebGL2), Vite, Vitest, Playwright, zod.

**Spec:** `docs/superpowers/specs/2026-11-21-difficulties-worlds-design.md` (4.1, 4.2 cíl vyvážení, 4.5, 4.7 body 4 a 5, 4.8, 4.9, 4.10 bod 3). Navazuje na plán 3a (`docs/superpowers/plans/2026-11-22-difficulties-worlds-2-3.md`) a `docs/DECISIONS.md`, sekce Difficulties and worlds, plan 3a.

**Rozhodnutí Clauda (Petr může změnit):**
- **Hřbet světa 4 je podkova**, ne čára přes celou arénu: řeka světa 2 už arénu dělí. Oblouk o poloměru 1500 kryje sever a východ, jeden průsmyk (400) na severovýchodě, konce ramen (160° a −70°) uvnitř kruhu příchodu, takže nepřátelé jdou průsmykem, nebo ramena obejdou.
- **Zeď světa 5 je osmiúhelník** o poloměru 1600 se čtyřmi trhlinami 400 posunutými z půlky stěn (nepravidelně), aby se lišila od pravidelného kruhu stromů světa 3.
- **Promrznutí jen hrdina** (spec: „kdo stojí“): nepřátelé u hrdiny stojí pořád, promrznutí by je jen oslabilo a nedává to tah hráči. Promrznutí = rychlost útoku −20 % (doba mezi základními útoky × 1 / 0,8); kouzla ne. Trvá, dokud se hrdina nerozejde (i po konci vánice).
- **Louže ohně** pálí hrdinu, nepřátele i bossy (menším podílem), hrad ne; jednu jednotku v jednom pulzu pálí nejvýš jedna louže (překryv se nesčítá).
- **Cíl žebříčku:** spec chce svět 5 Normal se střední výbavou „zhruba polovinu“ výher (80 ze 160), ale svět 3 má dnes 78 a žebříček má klesat. Petr (2026-11-24): „udělej to klidně těžší“. Cíl tedy: svět 4 mid 56–68, svět 5 mid 40–54, svět 5 Hell full pod 60; bez výbavy svět 4 i 5 nad 0 u aspoň 3 hrdinů.

## Global Constraints

- `sim/` čistý a deterministický (AGENTS.md, Code rules): žádné `Math.random`, `Date`, `Math.sin|cos|atan2|hypot|pow`, žádné `**`; v `Run.step()` žádná alokace (louže a promrznutí jsou pole pevné velikosti nebo čísla).
- Clean room: žádné texty z mapy; jména a věty vlastní, EN i CS.
- Žádná oranžová (Petr): test `"no orange in any look"` platí i pro nové řádky (žádná barva s odstínem 15–45° a sytostí > 0,35); zelený oheň je odstín 90–130°.
- Tma nesmí zhoršit čitelnost: snímky `world-4` a `world-5` posoudí Claude i Petr (hrdina, nepřátelé, truhly, koule a varovné kruhy jsou vidět; sněhová zem nesmí slít bílé a světle modré nepřátele).
- Zelený kruh meteoru se musí lišit od zeleného kruhu kořenů (odstín aspoň o 25°, nebo jiná světlost aspoň o 0,2; test v Task 5).
- Hash a matice: světy 1–3 dávají stejný stav jako na `main` (případy `w1-storm`, `w2-sand`, `w3-thicket` beze změny; louže a promrznutí se do hashe míchají jen když jsou nenulové). Digest celé matice se změní kvůli dvěma novým případům.
- `sim:run` seedy 1–20 světa 1 dává stejný výstup jako `main`.
- Krok simulace světa 4 a 5 nejvýš 1,2× světa 1 (`sim:run --hero stonehorn --phase 16 --seeds 1-3`).
- Modely: žádný nový GLB; test rozpočtu (`tests/assets.test.ts`) projde beze změny.
- `data:build` potřebuje export mapy: soubor `X_Hero_Siege_F-Day_v20.83_AI.w3x` v claude.ai projektu (Projects `project_read` s `original: true`), pak `npm run map:extract -- <cesta> v20.83` a `npm run data:build -- --source data-source/v20.83/out --out data/generated` (výstup netrackovaný; nikdy necommitovat `*.w3x` ani `data-source/`). Pokud extrakce v20.83 změní jiná data než světy, použij label a verzi z posledního commitu `data/generated` (viz `git log -1 -- data/generated`) a napiš to do DECISIONS.
- Commity Conventional Commits jako `Claude <noreply@anthropic.com>` s trailery session; `npm run check` před každým commitem. Větev `worlds-4-5`, PR proti `main`.

## Review Focus

1. **Nikdo neuvízne za hřbetem ani v zákoutí zdi:** nepřítel ze severu světa 4 dojde k hradu průsmykem nebo kolem ramene; nepřítel zvenku osmiúhelníku světa 5 dojde trhlinou. Test v Task 1 (z (0, 2400) a z (2400, 0) do 90 s bez hrdiny, nikdy v překážce).
2. **Úskok přes hřbet a zeď nepropadne:** mezerník u hřbetu (tloušťka 180) i u zdi (110) hrdinu zastaví. Test v Task 1.
3. **Promrznutí a pauza / co-op:** počítadlo stání běží jen v krocích simulace (pauza level-upu ho nezvyšuje), každý hráč v co-op má své; hrdina, který si vybírá kartu (co-op), nebo leží, promrznout nemůže. Testy v Task 2.
4. **Louže a konec běhu / nový běh:** louže zmizí s během (nový běh má 0 louží), louže nepálí hrdinu ve volbě (co-op) ani padlého; meteor v překážce (louže uprostřed hřbetu/zdi) nevadí, louže nepřekáží chůzi. Testy v Task 3; klient při novém běhu nekreslí staré louže (Task 5).
5. **Autopilot ve světě 5 nestojí v louži a uhýbá meteorům:** jinak ladicí čísla lžou. Test v Task 3 (bot v louži vyjde ven do 1 s) a `sim:run` řádek `world` ukáže zásahy meteorů a sekundy v ohni (Task 3, Task 7).

---

### Task 1: Data: vánice, meteory, kostry světů 4 a 5, průchodnost

**Files:**
- Modify: `data/schema/world.ts`, `data/schema/schema.test.ts`
- Modify: `design/worlds.yaml` (světy 4 a 5 vlastní `map` a `hazard`, `ready` zatím `false`; hlavičkový komentář o `snow`, `chill`, `meteors`)
- Modify: `sim/hazard.ts`, `sim/bot.ts` (jen typ: `stormOf` teď vrací i meteory; chování meteorů přijde v Task 3, do té doby se meteory chovají jako bouře bez louží)
- Modify: `sim/world-map/worlds.test.ts`, `sim/world-map/collide.test.ts`
- Regenerate: `data/generated/worlds.json`

**Interfaces:**
- Produces (`data/schema/world.ts`):
  - `WeatherSchema.effect: z.enum(["sand", "snow"])`; nepovinné `chill: { stillSeconds: positive, attackSlow: share }` (strict).
  - `MeteorsSchema` = pole `StormSchema` (`fromPhase`, `everySeconds`, `bolts` = meteorů na vlnu kolem každého hrdiny, `spread`, `warnSeconds`, `radius`, `heroShare`, `enemyShare`, `bossShare`, `name`) s `kind: "meteors"` a `pool: { seconds: positive, radius: positive, heroSharePerSecond: share, enemySharePerSecond: share, bossSharePerSecond: share }` (strict). Vytvoř přes společný objekt polí, ne kopií.
  - `HazardSchema = z.discriminatedUnion("kind", [StormSchema, WeatherSchema, ThicketSchema, MeteorsSchema])`; typ `Meteors`; `stormOf(world): Storm | Meteors | null` (vrací situaci s vlnami úderů).

- [ ] **Step 1: Testy schématu** (`data/schema/schema.test.ts`): `"parses a snow weather with chill"` (`effect: "snow"`, `chill: { stillSeconds: 3, attackSlow: 0.2 }` projde; `attackSlow: 1.5` neprojde; `effect: "rain"` neprojde); `"parses a meteors hazard"` (objekt z Step 3 projde; bez `pool` neprojde; `pool.radius: 0` neprojde); `"stormOf narrows storms and meteors"` (vrací objekt pro `storm` i `meteors`, `null` pro `weather` a `thicket`).
- [ ] **Step 2: Testy map** v `sim/world-map/worlds.test.ts` (stejný styl jako testy světů 2 a 3):
  - `"world 4 and 5 keep every free cell reachable from the castle on 200 seeds"` (`reached === free`, počet ostrůvků v rozsahu z dat);
  - `"the ice ridge blocks its arc and leaves the pass open"`: (0, 1500), (1500, 0), (−1149, 964) blokované; průsmyk (1061, 1061) volný; (−1600, 300) a (700, −1600) za konci ramen volné;
  - `"the broken wall blocks its sides and leaves the four breaches open"`: (0, 1600), (−1600, 0), (1131, −1131) blokované; trhliny (679, 1319), (−1412, 452), (−679, −1319), (1412, −452) volné;
  - `"no island lands in the pass or a breach"` (200 seedů, nic blíž než `gap` k bodům výše);
  - `"enemies from outside reach the castle"`: svět 4 z (0, 2400) a (−2400, 600), svět 5 z (0, 2400) a (2400, 0), seed 1, nepřítel s cílem hrad jako v testu řeky z plánu 3a (`--idle` vstup): do 2700 kroků u hradu a v žádném kroku v překážce.
  - v `sim/world-map/collide.test.ts`: `"a dash at the ice ridge stops before it"` (svět 4, hrdina (0, 1200), úskok na sever → `hero.y < 1500 − 90 − kolize + 1`, `isFree`) a totéž `"a dash at the broken wall stops before it"` (svět 5, hrdina (0, 1300), na sever, osa 1600, polovina tloušťky 55).
- [ ] **Step 3: Kostry a situace v `design/worlds.yaml`** (sever = +y):
  - **Mrazivý sever** `map`: `feature.thickness: 180`, úsečky (podkova R 1500, průsmyk 400 kolem (1061, 1061)):
    `[-1410,513,-1149,964]`, `[-1149,964,-750,1299]`, `[-750,1299,-260,1477]`, `[-260,1477,260,1477]`, `[260,1477,750,1299]`, `[750,1299,910,1192]`, `[1192,910,1410,513]`, `[1410,513,1500,0]`, `[1500,0,1410,-513]`, `[1410,-513,1149,-964]`, `[1149,-964,750,-1299]`, `[750,-1299,513,-1410]`.
    `paths` (šířka 160, `speedBonus 0.15`): `[[150,150],[1061,1061],[2000,2000]]`, `[[0,-200],[0,-2850]]`, `[[-200,0],[-1700,200],[-2500,1300]]`.
    `islands`: `count {30, 38}`, `radius {40, 200}`, `gap 120`, `kinds {rock: 6, trees: 3, ruin: 1}`; `clear` jako svět 1, ale `featureMargin: 170`.
  - **Mrazivý sever** `hazard`: `kind: weather`, `effect: snow`, `fromPhase: 2`, `everySeconds {80, 100}`, `durationSeconds: 15`, `warnSeconds: 5`, `moveSlow: 0.25`, `chill {stillSeconds: 3, attackSlow: 0.2}`, `name {en: Blizzard, cs: Vánice}`.
  - **Spálená říše** `map`: `feature.thickness: 110`, osmiúhelník R 1600 se čtyřmi trhlinami 400:
    `[1600,0,1131,1131]`, `[1131,1131,863,1242]`, `[494,1395,0,1600]`, `[0,1600,-1131,1131]`, `[-1131,1131,-1336,637]`, `[-1489,268,-1600,0]`, `[-1600,0,-1131,-1131]`, `[-1131,-1131,-863,-1242]`, `[-494,-1395,0,-1600]`, `[0,-1600,1131,-1131]`, `[1131,-1131,1336,-637]`, `[1489,-268,1600,0]`.
    `paths`: `[[82,160],[679,1319],[1304,2534]]`, `[[-171,55],[-1412,452],[-2714,869]]`, `[[-82,-160],[-679,-1319],[-1304,-2534]]`, `[[171,-55],[1412,-452],[2714,-869]]`.
    `islands`: `count {30, 40}`, `radius {40, 200}`, `gap 120`, `kinds {rock: 3, trees: 3, ruin: 4}`; `clear` jako svět 1.
  - **Spálená říše** `hazard`: `kind: meteors`, `fromPhase: 1`, `everySeconds {18, 24}`, `bolts {3, 6}`, `spread: 400`, `warnSeconds: 1.5`, `radius: 150`, `heroShare: 0.12`, `enemyShare: 0.2`, `bossShare: 0.02`, `pool {seconds: 6, radius: 130, heroSharePerSecond: 0.04, enemySharePerSecond: 0.06, bossSharePerSecond: 0.004}`, `name {en: Green meteors, cs: Zelené meteory}`.
  - `silverMap` a `silverStorm` zůstávají jen u světa 1 (kotvy smaž, pokud je nic dalšího nepoužívá).
- [ ] **Step 4: Schéma a zúžení:** podle Interfaces; `sim/hazard.ts` a `sim/bot.ts` přijmou `Storm | Meteors` (pole jsou stejná). Vyexportuj `Meteors` ze `data/schema`.
- [ ] **Step 5:** data:build (Global Constraints), `npx vitest run data sim/world-map` → PASS. Pokud průchodnost, průsmyk nebo trhlina neprojde na mřížce 100, rozšiř mezeru na 450 (posuň konce úseček po přímce), ne logiku; zapiš do DECISIONS (Task 7).
- [ ] **Step 6:** `npm run check` → PASS; `npm run sim:run -- --hero all --seeds 1-20` (svět 1) stejné jako před Task 1. **Commit** `feat(worlds): skeletons and hazards of worlds 4 and 5, blizzard and meteors in the data`.

### Task 2: Vánice a promrznutí v simulaci

**Files:**
- Create: `sim/chill.ts`, `sim/chill.test.ts`
- Modify: `sim/player.ts` (`stillTicks`, `chilled`), `sim/hero.ts` (počítání stání, doba útoku), `sim/run.ts` (volání ve stálém pořadí), `sim/hash.ts`, `sim/index.ts`
- Modify: `client/determinism/matrix.ts` (případ `w4-blizzard`), `tools/sim-run/*` (řádek `world`)

**Interfaces:**
- Consumes: `Weather.chill` (Task 1); `updateWeather`, `weatherSpeedScale` (plán 3a) platí pro sníh beze změny (−25 % chůze, varování, události `HazardWave` s `WeatherPhase`).
- Produces:
  - `PlayerState.stillTicks: number` (kroky bez vstupu pohybu a bez úskoku; reset při chůzi) a `PlayerState.chilled: boolean`.
  - `updateChill(run: Run, moved: boolean): void` v `sim/chill.ts`, volané z pohybu hrdiny pro `run.current`: chůze → `stillTicks = 0`, `chilled = false`; jinak `stillTicks++` a když běží vánice s `chill` (`weatherTicks > 0`) a `stillTicks >= stillSeconds × 30` a hrdina žije a nevybírá si (`isChoosing`), `chilled = true` (+ událost `EventKind.HazardWave` s `u = WeatherPhase.Chill` (= 4), hodnota 0, jednou při začátku promrznutí).
  - `chillAttackScale(run: Run): number`: `1 / (1 − attackSlow)`, když je `run.current` promrzlý, jinak 1; `sim/hero.ts` jím násobí `attackIntervalSeconds` při nastavení `attackCooldown` (kouzla ne).
  - Hash: `stillTicks` a `chilled` každého hráče se míchají jen ve světě, jehož situace má `chill` (svět 1–3 beze změny).

- [ ] **Step 1: Testy** v `sim/chill.test.ts` (svět 4, seed 1, `debugWeather` spustí vánici):
  - `"a hero standing 3 s in a blizzard is chilled"`: idle vstup 89 kroků → `chilled === false`; 90. krok → `true` a právě jedna událost `Chill`.
  - `"walking ends the chill, even after the blizzard"`: promrzlý hrdina, vánice skončí → pořád `chilled`; jeden krok se vstupem na východ → `false`, `stillTicks === 0`.
  - `"no chill outside a blizzard or without chill"`: svět 4 bez vánice 200 kroků stání → `false`; svět 2 v písečné bouři 200 kroků → `false`.
  - `"chill slows base attacks by attackSlow"`: `attackCooldown` po útoku promrzlého = `round(attackIntervalSeconds × 30 / 0.8)`; nepromrzlého = `round(attackIntervalSeconds × 30)`.
  - `"a fallen or choosing hero does not freeze"` (co-op 2 hráči, `choosingTicks > 0` u hráče 1, hráč 0 padlý) a `"each player has his own chill"` (hráč 0 stojí, hráč 1 chodí → jen hráč 0 promrzlý).
  - `"pause does not count"`: běh v pauze level-upu (jeden hráč, otevřená nabídka) 200 kroků `step` → `stillTicks` beze změny.
  - `"the hash covers chill only in a chill world"`: změna `chilled` změní `hashRun` ve světě 4; ve světě 1 `hashRun` nezávisí na `stillTicks`.
  - `"step does not allocate"` (pomocník jako v `sim/hazard.test.ts`).
- [ ] **Step 2:** `npx vitest run sim/chill.test.ts` → FAIL.
- [ ] **Step 3: Implementace** podle Interfaces (`moved` = nenulový vstup pohybu nebo běžící úskok; odstrčení nepřítelem se nepočítá jako chůze).
- [ ] **Step 4:** `npx vitest run sim` → PASS.
- [ ] **Step 5: Matice:** `{ id: "w4-blizzard", hero: "tidecaller", seed: 15, startPhase: 3, gear: "mid", maxTicks: 6000, world: 4 }`; ověř, že běh obsahuje celou vánici (Start i End; uprav `startPhase`/`maxTicks`, kdyby ne). Node (`npx vitest run client/determinism`) a `sim-chromium` dají stejný digest; `w1-storm`, `w2-sand`, `w3-thicket` mají stejný stav jako na `main`. Nový digest zapiš do `client/determinism/digest.test.ts` (`npm run sim:digest`).
- [ ] **Step 6: `sim:run`:** řádek `world` dostane `snow <počet vánic> chill <% kroků promrzlý>`.
- [ ] **Step 7:** `npm run check` → PASS. **Commit** `feat(sim): blizzard with chill for a standing hero, matrix case world 4`.

### Task 3: Zelené meteory a louže ohně v simulaci

**Files:**
- Create: `sim/fire-pools.ts`, `sim/fire-pools.test.ts`
- Modify: `sim/hazard.ts` (dopad meteoru založí louži; `updateHazard` volá louže), `sim/combat.ts` (`HeroHitSource.Fire: 3`), `sim/bot.ts` (ven z louže), `sim/hash.ts`, `sim/index.ts`
- Modify: `client/determinism/matrix.ts` (případ `w5-meteors`), `tools/sim-run/*`

**Interfaces:**
- Consumes: `Meteors` (Task 1), vlny a varování bouře (`startWave`, `boltsAround`, `strike` v `sim/hazard.ts`).
- Produces:
  - `POOL_CAPACITY = 8` (na hráče); `HazardState.poolX`, `poolY: Float64Array`, `poolTicks: Int32Array` (kroky zbývající louži; 0 = volné místo), `HazardState.pools: number` (louží za běh).
  - `addPool(run: Run, x: number, y: number): void` (z `strike`, jen pro `meteors`; plno → nejstarší louže se přepíše) a `updatePools(run: Run): void` v `sim/fire-pools.ts`: odpočet; každých `POOL_PULSE = 10` kroků (3× za s) pálí: hrdinu (žijícího, ne ve volbě, štít ho chrání) `heroSharePerSecond / 3` max hp (bez brnění a bez škálování přijatého poškození, jako blesk; zdroj `Fire`), nepřítele `enemySharePerSecond / 3` (boss `bossSharePerSecond / 3`) max hp (zdroj 2, bez lifestealu a berserku); jednotku v jednom pulzu pálí nejvýš jedna louže; hrad ne.
  - `poolAt(run: Run, x: number, y: number, r: number): number` (index louže, která zasahuje kruh, nebo −1) pro bota a HUD.
  - Události: `EventKind.Hazard` dál 0 = varování, 1 = dopad (klient pozná meteor podle druhu situace světa); nové `EventKind.Hazard` s hodnotou 2 = louže vznikla (`a` = index louže, `u` = poloměr, `v` = kroky).
  - Bot: když `poolAt(hero.x, hero.y, heroRadius) >= 0`, jde ven ve směru od středu louže (stejné místo kódu jako uhýbání blesku; uhýbání čekajícího meteoru má přednost); cíle (truhly, koule) uvnitř louže dočasně ignoruje.
  - Hash: louže se míchají jen ve světě s `meteors`.

- [ ] **Step 1: Testy** v `sim/fire-pools.test.ts` (svět 5, seed 1):
  - `"a meteor strike leaves a pool for pool.seconds"`: `debugHazard` → po `warnSeconds × 30` krocích dopad, `poolTicks` dané louže = `6 × 30`, po dalších 180 krocích 0.
  - `"a pool burns the hero 4 % of max hp a second"`: hrdina uprostřed louže 30 kroků (vynuluj ostatní poškození: bez nepřátel, `openArena` světa 5 nebo prázdný běh) → ztráta = `0.04 × maxHp` (±1e-6); s běžícím štítem 0.
  - `"a pool burns enemies and bosses by their shares"` a `"one pool per pulse"` (dvě překryté louže → stejná ztráta jako jedna).
  - `"a choosing or fallen hero is not burned"` (co-op).
  - `"a new run has no pools"` (Review Focus 4) a `"pools do not block walking"` (`isFree` v louži platí, hrdina jí projde rychlostí chůze).
  - `"meteors fall from phase 1 around every living hero"`: první vlna mezi `18 × 30` a `24 × 30` kroky od startu, 3–6 varování na hrdinu.
  - `"the bot walks out of a pool within 1 s"` (bot hrdina postavený do středu louže, 30 kroků botího vstupu → `poolAt(...) === -1`).
  - `"the hash covers pools only in a meteors world"`, `"step does not allocate"`.
- [ ] **Step 2:** `npx vitest run sim/fire-pools.test.ts` → FAIL.
- [ ] **Step 3: Implementace** podle Interfaces. Pole louží má velikost `POOL_CAPACITY × players` (jako `HAZARD_CAPACITY`); `updatePools` běží v `updateHazard` před vlnami.
- [ ] **Step 4:** `npx vitest run sim` → PASS.
- [ ] **Step 5: Matice:** `{ id: "w5-meteors", hero: "gravecaller", seed: 17, startPhase: 1, gear: "mid", maxTicks: 3600, world: 5 }` (aspoň dvě vlny a louže, která někoho pálí; ověř). Stejný digest v Node a `sim-chromium`; staré případy beze změny; digest do `digest.test.ts`.
- [ ] **Step 6: `sim:run`:** řádek `world` dostane `meteors <dopadů> hits <dopadů na hrdinu> fire <s hrdiny v louži>`.
- [ ] **Step 7:** `npm run check` → PASS. **Commit** `feat(sim): green meteors leaving fire pools, matrix case world 5`.

### Task 4: Vzhled světů 4 a 5 (data) a zvuky situací

**Files:**
- Modify: `client/render/world-look.ts`, `client/render/world-look.test.ts`
- Modify: `design/audio.yaml` (nové cue), `data/generated/audio.json` (`npm run audio:build`)

**Interfaces:**
- Produces: `FeatureStyle = "wall" | "river" | "trees" | "ridge" | "broken"`; `Particles = "none" | "dust" | "fireflies" | "snow" | "embers"` (`snow`: slabý sníh vždy, hustý během vánice; `embers`: zelené jiskry vždy); `WorldLook.fire: { ring: number; pool: number } | null` (barvy kruhu meteoru a louže; `null` mimo svět 5).
- Řádky (barvy jsou návrh; snímky v Task 6 je potvrdí):
  - **frostreach:** zem `a 0x6f8297`, `b 0x7a8da2`, `c 0x66788c`, `dirt 0x8aa0b8`; obloha `0x1c2636`; mlha 50–96; hemi `0xdfe9ff` / `0x2a3444` / 1,15; měsíc `0xe8f0ff`, 2,3; cesta `0x4c5a6c`; kámen `0x9fb6cc` / `0xc8daea` / `0x7f90a4`; `feature: "ridge"`; ostrůvky `rock: [rock-a, rock-b, rock-c, mesa-c]`, `trees: [tree-a, tree-b, trees-c]`, `ruin: "blocks"`; les `[tree-a, tree-b, trees-c, rock-a, mesa-c]`; `propTint 0xd4e4f4`; bez houští; počasí `{ color: 0xb4c4d6, fogNear: 30, fogFar: 70 }`; `particles: "snow"`; `fire: null`.
  - **blightscar:** zem `a 0x1c1a20`, `b 0x221e26`, `c 0x18161c`, `dirt 0x2c3a24`; obloha `0x1e1030`; mlha 46–90; hemi `0xb49ad8` / `0x101014` / 0,95; měsíc `0xd6c8ff`, 2,2; cesta `0x2c2634`; kámen `0x4a4452` / `0x5a5262` / `0x3e3846`; `feature: "broken"`; ostrůvky `rock: [rock-d, rock-c, mesa-a]`, `trees: [stump-a, stumps]`, `ruin: "blocks"`; les `[stumps, stump-a, rock-d, mesa-a]`; `propTint 0x8c8498`; bez houští a počasí; `particles: "embers"`; `fire: { ring: 0x9cff6a, pool: 0x5ce03a }`.
- Zvuky (`design/audio.yaml`, jen existující soubory z `assets/audio/`, nové id): `blizzard.warn` (vítr, jako písečná bouře), `meteor.warn` (hučení / nádech), `meteor.strike` (výbuch ohně, např. soubory `shared-firebolt`), `chill` (krátké zacinkání ledu, např. `shared-frost`). Každý jako ostatní: jeden hlas.

- [ ] **Step 1: Testy** v `world-look.test.ts`: `"frostreach and blightscar have their own looks"` (`feature` `ridge` / `broken`, `particles` `snow` / `embers`, `fire` jen u blightscar); `"no orange in any look"` a `"every model id … has a size"` platí pro nové řádky (projdou bez nových modelů); `"the meteor ring differs from the roots ring"` (konstanta barvy kořenů z klientu proti `fire.ring`: odstín ≥ 25° nebo světlost ≥ 0,2). Test z 3a, že `lookOf("frostreach")` = silver-march, smaž.
- [ ] **Step 2:** `npx vitest run client/render/world-look.test.ts` → FAIL; řádky a typy → PASS.
- [ ] **Step 3:** cue v `design/audio.yaml`, `npm run audio:build` → PASS.
- [ ] **Step 4:** `npm run check` → PASS (klient ještě neumí `ridge`/`broken`: `featureInstances` je zatím kreslí jako `wall`; dodělá Task 5). **Commit** `feat(look): looks and sound cues of worlds 4 and 5`.

### Task 5: Klient: hřbet, rozpadlá zeď, sníh, jiskry, meteory, louže, HUD

**Files:**
- Modify: `client/render/feature-view.ts` (+ test), `client/render/world-view.ts` (krystaly a suť), `client/render/particles.ts`, `client/render/hazard-fx.ts` (barva kruhu podle světa, louže), `client/render/weather-fx.ts` (sníh = stejná mlha z `look.weather`; jen ověřit)
- Create: `client/render/fx/fire-pools.ts` (instanční ploché disky louží)
- Modify: `client/ui/buff-bar.ts` (+ test), `client/ui/hud.ts`, `client/ui/messages-en.ts`, `client/ui/messages-cs.ts`, `client/audio/event-cues.ts`, `client/game/debug.ts`, `AGENTS.md` (`__game.hazard`)

**Interfaces:**
- Consumes: Task 2 (`chilled`, `WeatherPhase.Chill`), Task 3 (louže, `poolAt`, události `Hazard` 2), Task 4 (řádky, `fire`).
- Produces:
  - `featureInstances(map, style, trees)` pro `ridge`: každých `RIDGE_STEP = 70` podél úsečky jeden `crystal` (měřítko 0,8–1,8 podle deterministického hashe indexu, natočení zlatým úhlem) a pod úsečkou val `ridge-base` (měřítko = délka / 100); pro `broken`: kusy zdi jako `wall`, ale každý třetí kus nižší (`model: "wall-low"`) a u každého volného konce úsečky 3 kusy `rubble` (rozsypané do 120 od konce, mimo osu trhliny). `world-view` kreslí `crystal` jako instanční oktaedr (výška 3× šířky) barvy `look.stone.top` s lehkou průsvitností, `ridge-base` jako box `look.stone.wall` výšky 40, `wall-low` jako `wall` s poloviční výškou a `rubble` jako bloky ruin.
  - `Particles`: `snow` (150 bodů vždy, 600 během vánice; padají 2–3 j/s, během vánice vítr na východ 10 j/s; barva `0xe8f0ff`, normální míchání), `embers` (200 bodů, `0x9cff6a`, aditivní, stoupají 1 j/s a mizí v 6 j výšky).
  - `HazardFx`: kruh varování v barvě `look.fire.ring`, je-li svět s meteory (jinak blesková modrobílá); dopad meteoru = sloup v té barvě bez záblesku scény; `FirePoolFx` kreslí každou louži `run.hazard` (`poolTicks > 0`) jako plochý disk `look.fire.pool` (aditivní, mihotání v klientu, poslední 1 s mizí); nový běh nekreslí nic staré (Review Focus 4).
  - `BuffKind` dostane `"snow"` (sekundy vánice), `"chill"` (glyf bez sekund, když je hrdina promrzlý), `"meteor"` (sekundy do nejbližšího meteoru; ve světě 5 místo `"storm"`), `"fire"` (glyf, když hrdina stojí v louži). `HazardCells` dostane `snowTicks`, `chilled`, `meteorTicks`, `inFire`. Glyfy: sněhová vločka, kostka ledu, padající kometa, plamen (vlastní SVG cesty).
  - Ohlášení: `u = Warn` ve světě 4 → `announce.blizzard` („A blizzard is coming! Keep moving.“ / „Blíží se vánice! Nezastavuj se.“); první vlna meteorů → `announce.meteors` („Green fire falls from the sky!“ / „Z nebe padá zelený oheň!“); začátek promrznutí → `announce.chill` („You are freezing: walk to warm up.“ / „Mrzneš: rozejdi se, ať se zahřeješ.“) nejvýš jednou za 20 s.
  - Snapshot `__game.hazard`: `kind` i `"meteors"`; nové `chilled: boolean`, `pools: number` (živých louží); `__game.render.pools` (disky na zemi).
- [ ] **Step 1: Testy:** `feature-view.test.ts`: `"the ice ridge has crystals along every segment and none in the pass"` (žádný `crystal` blíž než 150 k (1061, 1061), počet ≥ délka / 70), `"the broken wall has pieces, low pieces and rubble at every breach"` (8 volných konců → 24 `rubble`, žádný kus zdi blíž než 150 ke středům trhlin); `buff-bar.test.ts`: `"a blizzard shows its seconds and chill its glyph"`, `"world 5 shows the meteor countdown instead of the storm"`, `"fire shows while the hero stands in a pool"`.
- [ ] **Step 2:** `npx vitest run client` → FAIL; implementace → PASS.
- [ ] **Step 3:** `npm run check` → PASS; `npm run build`. **Commit** `feat(client): ice ridge, broken wall, snow and embers, meteors and fire pools, HUD`.

### Task 6: E2E a snímky `world-4`, `world-5`

**Files:** Modify: `e2e/game.spec.ts`, `e2e/shots.spec.ts`, `AGENTS.md` (shots)

- [ ] **Step 1: E2E** (`webgl2-fallback`):
  - `"world 4: the ridge, a blizzard and chill"`: `?debug=1&world=4`, `startRun`; `__game.hazard.kind === "weather"`; `__game.debug.hazard()` → do 2 s `hazard.weather > 0`, `render.particles >= 600`; hrdina stojí 3,5 s → `hazard.chilled === true`; drží D 0,5 s → `false`; `teleport(0, 1200)`, drží W 1 s → `heroY < 1500 − 90`.
  - `"world 5: meteors leave fire"`: `?debug=1&world=5`, `startRun`; `kind === "meteors"`; `debug.hazard()` → `render.hazardRings > 0`, do 3 s `hazard.pools > 0` a `render.pools > 0`.
  - rozšiř `"switching worlds rebuilds the arena"` o svět 4 → 5 (žádná chyba v konzoli, louže ani sníh nepřežijí přepnutí).
- [ ] **Step 2: Snímky:** `world-4` (hrdina u průsmyku (950, 950), běžící vánice po 1,5 s, CS) a `world-5` (hrdina u severní trhliny (679, 1250), vlna meteorů s kruhy a jednou louží, `spawnEach` pro čitelnost nepřátel na černé zemi, CS). Popis do AGENTS.md vedle `world-3`.
- [ ] **Step 3:** `npm run build && npx playwright test --project=webgl2-fallback` → PASS; `npm run shots` → prohlédni `world-1` až `world-5`: čitelnost, žádná oranžová, hřbet a zeď jako hranice, průsmyk a trhliny vidět, meteor jinak než kořeny. Co nesedí, oprav v `world-look.ts` a znovu.
- [ ] **Step 4: Commit** `test(e2e): worlds 4 and 5, shots world-4 and world-5`.

### Task 7: Ladění žebříčku, `ready`, výkon, dokumentace, PR

**Files:** `design/worlds.yaml`, případně `design/rules.yaml` (`difficulty.worldStep`), `data/generated/*`, `docs/DECISIONS.md`, `docs/STATUS.md`, `ARCHITECTURE.md` (`sim/chill.ts`, `sim/fire-pools.ts`, `client/render/fx/fire-pools.ts`), spec (stav: plán 3 hotový)

- [ ] **Step 1: Měření** (Normal, seedy 1–20): `npm run sim:run -- --hero all --seeds 1-20 --world 4-5 --gear none|mid|full --quiet` a `--world 5 --difficulty hell --gear full`.
- [ ] **Step 2: Ladění k cíli** (Rozhodnutí Clauda nahoře: svět 4 mid 56–68, svět 5 mid 40–54, svět 5 Hell full < 60, bez výbavy svět 4 i 5 > 0 u aspoň 3 hrdinů; světy 1–3 se nemění). Pořadí, každý krok s novým měřením: (1) čísla situací (`moveSlow`, `everySeconds` vánice, `chill.attackSlow`; `heroShare`, `bolts`, `everySeconds`, louže meteorů); (2) počty ostrůvků; (3) až pak `worldStep` (mění světy 2–3: přeměř je a zapiš).
- [ ] **Step 3: Výkon:** `sim:run --hero stonehorn --phase 16 --seeds 1-3 --world 4` a `5` proti `--world 1` (cíl ≤ 1,2×).
- [ ] **Step 4:** `ready: true` u světů 4 a 5, data:build, `npm run check`, `npm run build`, `npx playwright test --project=webgl2-fallback --project=sim-chromium` → PASS.
- [ ] **Step 5: DECISIONS** (sekce „Difficulties and worlds, plan 3b: Frostreach and Blightscar“): rozhodnutí Clauda výše, kostry, čísla vánice, promrznutí, meteorů a louží, vzhled, tabulka výher světů 1–5 × none / mid / full a Hell svět 5 full, krok simulace, digest. **STATUS**: nahoře co Petr kontroluje (vzhled a čitelnost obou světů, hřbet a průsmyk, zeď a trhliny, je vánice znát a nutí promrznutí k pohybu, nejsou meteory moc časté nebo louže moc silné, fps `?fps=1&debug=1&phase=16&world=5`), odkazy (`?debug=1&world=4`, `?debug=1&world=5`, `__game.debug.hazard()`, `__game.hazard`), a další krok z pořadí (zbylí hrdinové a lepší grafika kouzel). Krátká kopie do projektu (`claude/STATUS.md`).
- [ ] **Step 6: Commit** `feat(worlds): worlds 4 and 5 ready, ladder tuned; docs`, push, PR proti `main`; po zelené CI čekat na Petrovo slovo ke sloučení.
