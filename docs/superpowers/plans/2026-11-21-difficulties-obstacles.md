# Obtížnosti 2: překážky, cesty, hradba světa 1, letní bouře: prováděcí plán

> **Pro agenty:** POVINNÝ PODSKILL: superpowers:executing-plans (nativní provedení) nebo superpowers:subagent-driven-development. Kroky mají zaškrtávací políčka (`- [ ]`).

**Cíl:** Svět 1 dostane pevnou kostru (stará hradba se dvěma branami na severu, čtyři cesty) a ostrůvky rozhozené ze seedu, kolize a obcházení pro hrdinu i nepřátele, mapu směrů skrz průchody, autopilota, který neuvízne, a letní bouři s blesky po varovném kruhu; svět 1 Normal se přeladí na ±10 % dnešních výher.

**Architektura:** Kostra a parametry bouře jsou v `design/worlds.yaml` (pole `map` a `hazard` u světa) a jdou přes `data:build` do `worlds.json`. Simulace při vzniku běhu postaví `WorldMap` (`sim/world-map/`): pevné překážky (úsečky s tloušťkou), ostrůvky (kruhy) z vlastního `mapRng`, statickou mřížku 60 × 60 (buňka 100) s maskou zablokování, seznamy překážek po buňkách, masku cest a tři mapy směrů (k hradu, k hrdinovi, pro autopilota). Kolize, vyhýbání a mapy směrů čtou jen tyto pevné struktury, takže `Run.step()` nealokuje. Bouře je samostatný systém `sim/hazard.ts` s vlastním `hazardRng`. Světy 2–5 v tomto plánu sdílejí kostru a bouři světa 1 (YAML kotva), vlastní dostanou v plánu 3.

**Technologie:** TypeScript, Vitest, zod (`data/schema`), Three.js (WebGPU / WebGL2), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-21-difficulties-worlds-design.md`, kapitoly 4.5, 4.6, 4.7 bod 1, 4.9 a 4.10 bod 2. Vzhled ostatních světů, trnité houští a čtyři další situace jsou plán 3.

## Globální omezení

- `AGENTS.md`: `sim/` a `meta/` čisté a deterministické; `Run.step()` nealokuje (mřížky, fronty BFS a seznamy mají pevnou velikost z konstruktoru běhu); žádné `**`, `Math.pow`, trigonometrie ani `Math.random`; směry vektory a `Math.sqrt`.
- Mapa vzniká jen ze seedu a světa: `mapRng = new Rng((seed ^ 0x68e31da4) >>> 0)`, bouře `hazardRng = new Rng((seed ^ 0x1b873593) >>> 0)`. Hlavní `rng` se kvůli mapě ani bouři nesmí losovat (pořadí losů nepřátel zůstane).
- Střely a kouzla létají přes překážky (spec 2, mimo rozsah); překážky se nedají zbořit.
- Z každé volné buňky vede cesta k hradu (spec 2, „nechceme“); kontrolu dělá simulace při stavbě mapy a test na 200 seedech.
- Každý dopad bouře má varování: kruh na zemi 1,2 s předem (spec 2).
- Texty EN i CS v `client/ui/messages-*.ts`; žádná jména ani texty z mapy Warcraftu.
- Barvy tmavé a modrošedé, **žádná oranžová** (Petr); blesk modrobílý.
- Rozpočet modelů: dnes ~9,8 MB z 10 MB; nové modely prostředí v tomto plánu dohromady ≤ 150 kB (test `tests/assets.test.ts` platí dál).
- Fps: s plným davem nejvýš −10 % proti `main` (spec 2).
- Data: `design/*.yaml` → `npm run data:build -- --source data-source/v20.75/out --out data/generated`. Export mapy v čerstvém klonu chybí: stáhni mapu z projektu claude.ai (`Projects` `project_read` s `original: true` na `X_Hero_Siege_F-Day_v20.75_AI.w3x`) a spusť `npm run map:extract -- <cesta> v20.75`. Mapu nikdy necommituj.
- `npm run check` před každým commitem; Conventional Commits; identita `Claude <noreply@anthropic.com>` a trailery sezení.
- Větev `difficulties-2` (tento plán už na ní je); PR proti `main`, sloučit až na Petrovo slovo.

## Na co se zaměřit při kontrole

1. **Náhradní místo truhly nebo koule v překážce:** dnešní záložní bod „přímo na sever od hradu ve střední vzdálenosti“ (truhly, koule) může ležet na hradbě. Každé umístění (i záložní) projde `nearestFree`; test v Úkolu 3 na 200 seedech: žádná truhla ani koule v překážce.
2. **Úskok skrz zeď:** úskok urazí 350 za 0,15 s (~78 za krok) a hradba má tloušťku 90. Pohyb hrdiny se dělí na kroky ≤ 24 a úskok se o překážku zastaví; test v Úkolu 3.
3. **Nepřítel uvězněný v kapse nebo za koncem hradby:** sieger ze severu musí dojít k hradu (branou nebo kolem konce) do 60 s; test v Úkolu 4 pro 8 směrů.
4. **Konec skoku bosse nebo výpadu elity uvnitř překážky:** během letu se kolize neřeší, po jeho konci ji vytlačí `pushOut` na nejbližší volné místo; test v Úkolu 3.
5. **Blesk při štítu ducha a při smrti hrdiny v témže kroku:** štít blesk zastaví jako jiný zásah (`damageHero`), blesk po konci běhu nic nespustí; test v Úkolu 5.

---

### Úkol 1: Data kostry a bouře

**Soubory:**
- Upravit: `data/schema/world.ts`, `data/schema/schema.test.ts`, `design/worlds.yaml`, `data/generated.test.ts`, `tools/data-build/data-build.test.ts` (fixture), `sim/testing/game-data.ts` (testovací svět s mapou)
- Vygenerovat: `data/generated/worlds.json`

**Rozhraní (produkuje):**
```ts
// data/schema/world.ts
Point = z.tuple([finite, finite])
WorldMapSchema = {
  paths: { width: >0, speedBonus: 0..1, lines: Point[][] },            // každá čára ≥ 2 body
  feature: { thickness: >0, segments: [x1, y1, x2, y2][] },             // min 1 úsečka
  islands: { count: { min: int ≥0, max: int ≥ min }, radius: { min: >0, max: ≥ min },
             gap: ≥0, kinds: { rock: ≥0, trees: ≥0, ruin: ≥0 } },       // váhy, součet > 0
  clear: { castle: >0, ringInner: >0, ringOuter: > ringInner, pathMargin: ≥0, featureMargin: ≥0 },
}
StormSchema = { kind: "storm", fromPhase: int ≥1, everySeconds: { min: >0, max: ≥ min },
                bolts: { min: int ≥1, max: int ≥ min }, spread: ≥0, warnSeconds: >0, radius: >0,
                heroShare: 0..1, enemyShare: 0..1, bossShare: 0..1, name: LocalizedText }
WorldSchema += { map: WorldMapSchema, hazard: StormSchema }   // hazard je union podle `kind`, zatím jen storm
export type WorldMap = ..., Hazard = ...
```
- Hodnoty světa 1 (sever = +y; Úkol 7 je smí doladit), v YAML kotvy `&silverMap` a `&silverStorm`, světy 2–5 je použijí:
  - `feature`: tloušťka 90, úsečky `[-1650,1050,-1400,1500]`, `[-1400,1500,-750,1500]`, `[-500,1500,500,1500]`, `[750,1500,1400,1500]`, `[1400,1500,1650,1050]` (dvě brány široké 250 u x = ±625, konce hradby ~1960 od hradu, mimo kruh příchodu);
  - `paths`: šířka 160, `speedBonus` 0.15; čáry SZ `[[0,200],[-625,1300],[-625,1700],[-1100,2800]]`, SV zrcadlově, J `[[0,-200],[0,-2850]]`, Z `[[-200,0],[-2850,-300]]`;
  - `islands`: počet 30–40, poloměr 40–220, mezera 120, váhy rock 5, trees 4, ruin 2;
  - `clear`: castle 600, ringInner 2200, ringOuter 2600, pathMargin 60, featureMargin 150;
  - bouře: fromPhase 3, everySeconds 35–45, bolts 1–3, spread 300, warnSeconds 1.2, radius 120, heroShare 0.08, enemyShare 0.2, bossShare 0.02, name EN „Summer storm“, CS „Letní bouře“.

- [ ] **Krok 1: Padající testy.** `schema.test.ts`: odmítne `paths.lines` s jedním bodem, `islands.count.max < min`, `clear.ringOuter ≤ ringInner`, bouři s `bolts.min 0`, neznámé `hazard.kind`; přijme svět 1. `generated.test.ts` (`describe("world maps")`):
  - každá úsečka `feature` je celá mimo kruh hradu (`clear.castle`) i mezikruží příchodu (vzdálenost bodů úsečky od hradu < `ringInner` − tloušťka/2);
  - mezery mezi sousedními úsečkami hradby, které nesdílí konec, jsou 200–300 (brány, spec 4.5);
  - každá cesta začíná do 250 od hradu a končí za `ringOuter`;
  - `heroStart` z `rules.arena` leží v kruhu `clear.castle`.
- [ ] **Krok 2:** `npx vitest run data` → FAIL.
- [ ] **Krok 3:** Schéma, YAML, fixture v `data-build.test.ts`, `npm run data:build`.
- [ ] **Krok 4:** `npm run check` → PASS.
- [ ] **Krok 5:** Commit `feat(data): world map skeleton and the summer storm`.

### Úkol 2: `WorldMap`: překážky, ostrůvky ze seedu, mřížka, průchodnost

**Soubory:**
- Vytvořit: `sim/world-map/map.ts` (struktura a stavba), `sim/world-map/islands.ts` (rozmístění), `sim/world-map/grid.ts` (mřížka, BFS průchodnosti), `sim/world-map/geometry.ts` (vzdálenost bodu od úsečky, `pushOut`), `sim/world-map/map.test.ts`, `sim/world-map/geometry.test.ts`
- Upravit: `sim/run.ts` (pole `map`, `mapRng`, stavba před `placeChest`), `sim/index.ts`, `sim/hash.ts`

**Rozhraní (produkuje):**
```ts
export const MAP_CELL = 100, MAP_SIZE = 60;                // mřížka pokrývá -3000..3000
export const IslandKind = { Rock: 0, Trees: 1, Ruin: 2 } as const;
export class WorldMap {
  // pevné úsečky (z dat) a ostrůvky (ze seedu) v typovaných polích
  readonly segX1/segY1/segX2/segY2: Float64Array; readonly segHalf: number; readonly segCount: number;
  readonly islandX/islandY/islandR: Float64Array; readonly islandKind: Uint8Array; islandCount: number;
  readonly blocked: Uint8Array;        // MAP_SIZE², 1 = střed buňky je v překážce zvětšené o PASS_MARGIN (36)
  readonly cellStart/cellItems: Int32Array;  // překážky dotýkající se buňky (CSR, index < segCount = úsečka, jinak ostrůvek)
  readonly onPath: Uint8Array;         // mřížka 120 × 120 (buňka 50): 1 = střed do width/2 od cesty
}
export function buildWorldMap(data: GameData, world: number, rng: Rng): WorldMap
export function isFree(map: WorldMap, x: number, y: number, radius: number): boolean
/** Posune kruh (x, y, r) ven ze všech překážek v okolních buňkách; výsledek v pushX/pushY (bez alokace). */
export function pushOut(map: WorldMap, x: number, y: number, r: number): void
export let pushX: number, pushY: number;
/** Nejbližší volné místo pro kruh r: pushOut, a pokud ani to nestačí, spirála po buňkách. */
export function nearestFree(map: WorldMap, x: number, y: number, r: number): void   // výsledek v pushX/pushY
export function cellOf(x: number, y: number): number
export function pathSpeedScale(map: WorldMap, x: number, y: number, bonus: number): number   // 1 + bonus na cestě, jinak 1
```
- Ostrůvky (`islands.ts`): počet `count.min + floor(rng · (max − min + 1))`; střed rovnoměrně v aréně, poloměr rovnoměrně v `radius`, druh podle vah; místo se zamítne v zakázaných zónách (kruh `clear.castle` + r, mezikruží `ringInner − r`…`ringOuter + r`, cesta do `width/2 + pathMargin + r`, hradba do `thickness/2 + featureMargin + r`, jiný ostrůvek blíž než `r1 + r2 + gap`, okraj arény); nejvýš 40 pokusů na ostrůvek, potom se ostrůvek vynechá.
- **Průchodnost** (`grid.ts`): po každém přijatém ostrůvku přepočítej `blocked` a BFS (8 sousedů, bez řezání rohů) z buňky hradu přes volné buňky; když počet dosažených ≠ počet volných, ostrůvek se vrátí a zahodí. Konstruktor smí alokovat.
- `Run`: `readonly mapRng: Rng`, `readonly map: WorldMap`; stavba hned po `castle` a před `chestRng`/truhlami.
- `stateHash` přimíchá `islandCount` a součet `islandX + islandY + islandR` (jednou, na začátku hashe).

- [ ] **Krok 1: Padající testy** `geometry.test.ts`: `pushOut` kruhu, který zasahuje do úsečky s tloušťkou, ho posune kolmo ven na vzdálenost `segHalf + r`; kruh ve středu ostrůvku vyjde ven ve směru +x (deterministicky); volný kruh se nehne. `map.test.ts`:
  - svět 1, seedy 1–200: počet ostrůvků 30–40 na aspoň 190 seedech; žádný ostrůvek nezasahuje do zakázané zóny; BFS z hradu dosáhne všech volných buněk (spec 4.9 „průchodnost na 200 seedech“); `isFree(heroStart, 32)`;
  - stejný seed a svět dají stejné ostrůvky; seed 1 a 2 se liší;
  - stavba mapy nesáhne do `run.rng` (stav `run.rng` po `createRun` je stejný jako s mapou o nula ostrůvcích: porovnej první `next()` s během, kde testovací data mají `islands.count 0–0`);
  - `pathSpeedScale` na ose jižní cesty je 1,15, 200 od ní 1.
- [ ] **Krok 2:** `npx vitest run sim/world-map` → FAIL.
- [ ] **Krok 3:** Implementace podle rozhraní.
- [ ] **Krok 4:** `npm run check` → PASS (pevné hashe v testech se smí změnit; v `hash.test.ts` zapiš nové).
- [ ] **Krok 5:** Commit `feat(sim): world map with the wall, seeded islands and a passability check`.

### Úkol 3: Kolize, vyhýbání ostrůvkům, cesty, volná místa

**Soubory:**
- Upravit: `sim/hero.ts` (`moveHero`), `sim/enemy-ai.ts`, `sim/enemy-steer.ts`, `sim/spawner.ts` (`scatterMember`, `spawnAt`), `sim/chests.ts` (`placeChest`), `sim/orbs.ts` (`placeOrb`), `sim/allies.ts` (místo totemu a stráží, pokud se kladou na zem)
- Vytvořit: `sim/world-map/collide.test.ts`

**Rozhraní:**
- Spotřebuje `pushOut`, `isFree`, `nearestFree`, `pathSpeedScale` z Úkolu 2.
- Hrdina: rychlost × `pathSpeedScale` (běh i úskok ne, úskok má pevnou délku); pohyb kroku se dělí na `ceil(délka / 24)` dílků, po každém `pushOut`; úskok, jehož dílek byl vytlačen o víc než polovinu dílku, skončí (`dashTicks = 0`).
- Nepřátelé: chůze × `pathSpeedScale`; po součtu rychlostí a odstrčení `pushOut` s poloměrem `def.collision`, kromě `charging` a `leaping` (ti letí přes; po konci je vytlačí první krok bez letu).
- Vyhýbání (`enemy-steer.ts`, nová `avoidIslands(run, i, r)` volaná po `steer` pro chodící nepřátele): mezi ostrůvky z buněk na cestě (nejvýš 2 buňky vpřed) vezmi nejbližší, jehož střed leží před nepřítelem (průmět na směr > 0, < `r + R + 1,5 · r`) a do strany méně než `R + r`; směr se stočí na tečnu kolem něj (strana podle znaménka bočního posunu, při nule podle parity slotu). Píše do `steerX/steerY`.
- Volná místa: `scatterMember` a `spawnAt` po výpočtu bodu zavolají `nearestFree` (bez losu navíc); `placeChest` a `placeOrb` zamítnou pokus, když `!isFree(x, y, pickupRadius)`, a záložní bod projde `nearestFree` (Na co se zaměřit 1).

- [ ] **Krok 1: Padající testy** v `collide.test.ts` (testovací data s hradbou světa 1 a bez ostrůvků, kde je to řečeno):
  - hrdina jdoucí 3 s na sever od (0, 1200) skončí pod hradbou (`y ≤ 1500 − 45 − 32`), branou u x = −625 projde nad `y > 1600`;
  - úskok z (0, 1380) na sever skončí pod hradbou (Na co se zaměřit 2);
  - nepřítel s nastaveným výpadem, který skončí v ostrůvku, je po dalším kroku mimo něj (Na co se zaměřit 4);
  - sieger jdoucí k hradu, s ostrůvkem R 150 přímo v cestě, ostrůvek obejde a dojde k hradu do 20 s, nikdy není v překážce;
  - na jižní cestě urazí hrdina za 1 s 1,15× víc než mimo ni;
  - svět 1, seedy 1–200: žádná truhla ani koule po stavbě a po 30 přemístěních není v překážce (Na co se zaměřit 1);
  - po 3000 krocích autopilota (seed 1, každý hrdina) žádný živý nepřítel ani hrdina nestojí v překážce hlouběji než 2 jednotky (spec 4.9 „nikdo nestojí v překážce“).
- [ ] **Krok 2:** FAIL → implementace → `npm run check` PASS.
- [ ] **Krok 3:** `npm run sim:run -- --hero all --seeds 1-5` doběhne bez chyby; zapiš si výhry (Úkol 7 ladí).
- [ ] **Krok 4:** Commit `feat(sim): obstacle collisions, island avoidance and paths`.

### Úkol 4: Mapy směrů, přepnutí přes hradbu, autopilot

**Soubory:**
- Vytvořit: `sim/world-map/flow.ts`, `sim/world-map/flow.test.ts`
- Upravit: `sim/world-map/map.ts` (tři pole), `sim/enemy-ai.ts`, `sim/run.ts` (přepočet k hrdinovi), `sim/bot.ts`, `sim/bot.test.ts`

**Rozhraní:**
```ts
export class FlowField {                    // pevná velikost MAP_SIZE²
  readonly dist: Int32Array; readonly next: Int32Array;   // next = index buňky, kam jít (-1 cíl nebo nedosažitelné)
  targetCell: number;
}
export function computeFlow(map: WorldMap, field: FlowField, targetX: number, targetY: number): void  // BFS, 8 sousedů, bez řezání rohů, fronta = sdílený Int32Array v mapě
/** Krok po mapě: jednotkový směr k středu buňky o dvě dál po `next`; výsledek ve flowX/flowY. */
export function flowDir(field: FlowField, x: number, y: number): void
export let flowX: number, flowY: number;
/** Protne úsečka (ax, ay)–(bx, by) rozšířená o r některou úsečku hradby? (ostrůvky se nepočítají) */
export function crossesFeature(map: WorldMap, ax: number, ay: number, bx: number, by: number, r: number): boolean
```
- `WorldMap` dostane `toCastle`, `toHero`, `forBot: FlowField`. `toCastle` se spočítá v konstruktoru, `toHero` na začátku `updateEnemies`, když `tick % 8 === 0` nebo hrdina změnil buňku a uplynuly aspoň 2 kroky od posledního přepočtu (spec 4.6).
- `updateEnemies`: když chodící nepřítel míří k cíli a `crossesFeature(map, x, y, tx, ty, def.collision)`, směr = `flowDir(toHero | toCastle)`; jinak dnešní `steer` + `avoidIslands`. Flankeři a skirmisheři mají flow přednost před svým úhlem.
- Autopilot: nová `routeTo(run, tx, ty)` v `bot.ts` (výsledek v modulových `routeX/routeY`): přímý směr, nebo při `crossesFeature` flow v `forBot` (přepočet, když se cílová buňka změnila, nejvýš každých 8 kroků). Všechny cíle chůze autopilota (koule, truhla, návrat k hradu, cíl útoku) jdou přes `routeTo`; útěky (slam, výpad) zůstávají přímé.

- [ ] **Krok 1: Padající testy** `flow.test.ts`:
  - z každé volné buňky světa 1 (seedy 1–20) vede `next` po konečném počtu kroků do buňky hradu (`toCastle`) i do buňky hrdiny na (0, 500) (spec 4.9);
  - `crossesFeature` je true pro úsečku (0, 1200)–(0, 1800), false pro (−625, 1200)–(−625, 1800) (brána);
  - sieger s rolí útoku na hrad spawnutý na kruhu ve směrech 0°, 45°, …, 315° dojde k hradu do 60 s na seedech 1–5 (Na co se zaměřit 3);
  - přepočet `toHero` v kroku nealokuje (počítadlo alokací jako v existujících testech, nebo kontrola, že pole jsou tatáž instance).
- [ ] **Krok 2:** `bot.test.ts`: autopilot s truhlou na (0, 2000) a dost zlata z (0, 1200) truhlu otevře do 25 s (cesta branou).
- [ ] **Krok 3:** FAIL → implementace → `npm run check` PASS.
- [ ] **Krok 4:** Výkon: `npm run sim:run -- --hero stonehorn --seeds 1-3 --phase 16`; průměrný čas kroku (pokud ho `sim:run` neukazuje, změř `performance.now()` kolem `step` v jednorázovém skriptu mimo repo) nejvýš 1,5× proti `main`; zapiš do DECISIONS v Úkolu 7.
- [ ] **Krok 5:** Commit `feat(sim): flow fields through the wall gates and autopilot routing`.

### Úkol 5: Letní bouře

**Soubory:**
- Vytvořit: `sim/hazard.ts`, `sim/hazard.test.ts`
- Upravit: `sim/run.ts` (pole, krok), `sim/events.ts`, `sim/hash.ts`, `sim/bot.ts` (blesk jako slam), `sim/index.ts`

**Rozhraní:**
```ts
export const HAZARD_CAPACITY = 8;
export class HazardState {                // pevná pole
  readonly x/y: Float64Array; readonly ticks: Int32Array;   // kroky do dopadu, 0 = volné místo
  nextWaveTick: number;                    // -1 před fromPhase
  waves: number; bolts: number;            // pro statistiky a sim:run
}
export function updateHazard(run: Run): void          // v Run.step hned za updateBuffs, před regenCastle
export function debugHazard(run: Run): void           // vlna hned (pro __game.debug.hazard)
export function hazardPending(run: Run): number       // kroky do nejbližšího dopadu, 0 = nic nečeká
```
- `EventKind.Hazard` (další volné číslo): `a` = místo, `value` 0 varování / 1 dopad, `x/y` střed, `u` poloměr, `v` kroky varování. `EventKind.HazardWave` při první vlně běhu (HUD ohlásí jméno bouře).
- Vlna: první v `fromPhase` (začátek fáze `fromPhase`, tj. tick `(fromPhase − 1) · phaseSeconds · 30`) + los `everySeconds`; potom každých `everySeconds` (los z `hazardRng`). Počet blesků z `bolts`, střed každého = hrdina + bod rovnoměrně v kruhu `spread` (dva losy, odmítnutí mimo kruh, nejvýš 8 pokusů), varování `warnSeconds`. Během fáze startu (`startPhase`) se plán vln odvodí z času startu (žádná vlna „v minulosti“).
- Dopad: hrdina v kruhu dostane `heroShare · maxHp` přes `damageHero(run, …, -1)` (bez brnění; štít ducha ho zastaví, Na co se zaměřit 5); každý nepřítel v kruhu `damageEnemy(run, slot, maxHp · (boss ? bossShare : enemyShare), 1)`; hrad se nezraní.
- Autopilot: čekající blesk v dosahu poloměr + `SLAM_MARGIN` řeší stejně jako slam (utéct od středu, úskok).
- `stateHash` přimíchá `nextWaveTick` a pole `x/y/ticks`.

- [ ] **Krok 1: Padající testy** `hazard.test.ts`:
  - svět 1, seed 1: v prvních 100 s žádná vlna; první vlna mezi 100 + 35 a 100 + 45 s; další vlny po 35–45 s; každá má 1–3 blesky do 300 od hrdiny;
  - varování trvá 36 kroků; hrdina, který stojí, dostane přesně `0,08 · maxHp`; hrdina, který z kruhu odejde, nic; nepřítel v kruhu ztratí 20 % max hp, boss 2 %;
  - štít ducha (`shieldTicks > 0`) dopad zastaví; běh, který skončil v kroku varování, už žádný `Hazard` dopad nevydá (Na co se zaměřit 5);
  - `startPhase: 11`: první vlna do 45 s od startu, ne dřív než 35 s;
  - bouře nemění `run.rng` (první smečka seedu 1 má stejné typy a místa s bouří i s `fromPhase: 99` v testovacích datech);
  - `debugHazard` spustí vlnu v tomtéž kroku.
- [ ] **Krok 2:** FAIL → implementace → `npm run check` PASS.
- [ ] **Krok 3:** Commit `feat(sim): the summer storm of world 1`.

### Úkol 6: Klient: překážky, cesty, bouře, volba světa, ladění v prohlížeči

**Soubory:**
- Vytvořit: `client/render/world-view.ts` (ostrůvky, hradba, cesty; přestaví se při každém startu běhu), `client/render/hazard-fx.ts` (kruhy varování, záblesk, krátké osvětlení scény), `client/render/world-view.test.ts` (rozpis instancí z `WorldMap`, čistá funkce)
- Upravit: `client/render/scene.ts`, `client/render/props.ts` / `tools/assets-build/manifest.ts` (nové modely), `client/main.ts`, `client/game/debug.ts`, `client/ui/hud.ts`, `client/ui/buff-bar.ts`, `client/ui/world-lines.ts`, `client/ui/world-lines.test.ts`, `client/ui/messages-en.ts`, `client/ui/messages-cs.ts`, `client/audio/*` + `design/audio.yaml` (cue `storm-warning`, `storm-strike` z už zakódovaných souborů), `assets/LICENSES.md`, `e2e/game.spec.ts`, `e2e/shots.spec.ts`

**Rozhraní:**
- `worldInstances(map: WorldMap): { model: string; x: number; y: number; scale: number; rotation: number }[]` (čistá): kameny `rock-a/b/c`, stromy `tree-a/b`, `trees-a/b/c`, ruiny a hradba z nových modelů; měřítko podle poloměru ostrůvku; natočení deterministicky z indexu (bez `Math.random`). Hradba = řada dílů podél úseček (díl každých ~délka modelu), na koncích bran sloupek nebo věžička.
- Nové modely: dílo hradby, sloupek brány a 1–2 ruiny z KayKit Medieval Hexagon (`hex`, už připnutý zdroj) nebo jiného CC0 KayKit balíku; dohromady ≤ 150 kB; řádek v `LICENSES.md` přes `npm run assets:build`. Když žádný díl nesedí, hradba z kvádrů s kamennou barvou (bez nového modelu) a ruiny z `rock-*`.
- Cesty: ploché pásy (šířka z dat) těsně nad zemí, tmavší udusaná hlína (modrošedá, ne oranžová), měkké okraje v materiálu.
- Bouře: kruh varování jako slam, ale modrobílý; při dopadu svislý záblesk a 0,15 s zesvětlení scény (respektuje „otřesy“ v Nastavení: s vypnutými otřesy bez záblesku scény); zvuky `storm-warning` a `storm-strike`; v liště efektů ikona `storm` (vlastní glyf blesku) se sekundami do nejbližšího dopadu (`hazardPending`); news line při `HazardWave` „Blíží se letní bouře“ / „A summer storm is coming“.
- Volba světa: `worldDetail` přidá řádek „Přírodní situace: Letní bouře“ / „Natural event: Summer storm“ (jméno z `hazard.name`), pro všechny světy (2–5 zatím sdílejí bouři světa 1).
- `window.__game`: `obstacles` (počet ostrůvků + úseček), `hazard` (`{ pending: sekundy do dopadu | 0, waves }`), `debug.hazard()`.
- `e2e/fixtures` beze změny; e2e test: `?debug=1&phase=3`, `__game.debug.hazard()`, do 1 s je na zemi aspoň jeden kruh (`render.slamRings` nebo nové `render.hazardRings`) a `__game.hazard.pending > 0`; `__game.obstacles` ≥ 35.
- Snímek `shots: world-1` (pohled na hradbu s branou a ostrůvky, `?debug=1`, hrdina teleportovaný k (−625, 1300)).

- [ ] **Krok 1:** Unit testy `world-view.test.ts` (počet instancí = ostrůvky + díly hradby; dva rozpisy téže mapy se rovnají) a `world-lines.test.ts` (řádek situace CS/EN).
- [ ] **Krok 2:** FAIL → implementace → PASS.
- [ ] **Krok 3:** `npm run shots`, prohlédni `world-1`, `start`, `fight`, `corner` na 1280 × 720: hradba a brány čitelné, ostrůvky neschovávají nepřátele, cesty viditelné a ne oranžové, kruh blesku odlišný od slamu bosse.
- [ ] **Krok 4:** `npm run check`, `npm run build`, `npx playwright test --project=webgl2-fallback` → PASS.
- [ ] **Krok 5:** Commit `feat(client): obstacles, paths and the summer storm`.

### Úkol 7: `sim:run`, matice, ladění světa 1, fps, dokumentace

**Soubory:**
- Upravit: `tools/sim-run/run.ts` (řádek `world` v souhrnu: průměr ostrůvků, vln a blesků, zásahů hrdiny bleskem), `client/determinism/matrix.ts` (nový případ `w1-storm`: sparkshot, seed 9, `startPhase: 3`, 4500 kroků), `design/worlds.yaml` (jen `map.islands` a `hazard` světa 1), `docs/DECISIONS.md` (sekce Difficulties and worlds, plan 2), `docs/STATUS.md`, `ARCHITECTURE.md`, `AGENTS.md`

- [ ] **Krok 1: Měření** (seedy 1–20, autopilot): svět 1 Normal × `--gear none|mid|full`. Výchozí body z DECISIONS (plán 1): bez výbavy 73, mid 94, full 127 ze 160.
- [ ] **Krok 2: Ladění** k cíli spec 4.2: svět 1 Normal bez výbavy **66–80 ze 160** (±10 % od 73). Páky v pořadí: `hazard.heroShare`, `hazard.everySeconds`, `islands.count`; kostra (hradba, cesty) a nepřátelé se nemění. Zkontroluj, že svět 5 Normal s mid výbavou nespadl pod polovinu dnešních 67 (jinak to zapiš jako otevřené pro Petra, plán 3 ladí světy 2–5).
- [ ] **Krok 3: Matice:** `npx playwright test --project=sim-chromium` → PASS; nový digest do STATUS a DECISIONS.
- [ ] **Krok 4: Fps:** `?fps=1&debug=1&phase=16` v `webgl2-fallback` jen orientačně; skutečné měření na Petrově stroji jde do STATUS jako úkol pro něj (cíl −10 % nejvýš, `main` dnes 144).
- [ ] **Krok 5: DECISIONS:** tvar kostry světa 1 (souřadnice, brány, cesty), pravidla rozmístění a průchodnosti, konstanty kolize (dílek 24, `PASS_MARGIN` 36, vyhýbání), mapy směrů a kdy se přepínají, bouře (konečná čísla), tabulka výher před a po, čas kroku, digest. `ARCHITECTURE.md`: `sim/world-map/`, `sim/hazard.ts`, `client/render/world-view.ts`, `hazard-fx.ts`. `AGENTS.md`: `__game.obstacles`, `__game.hazard`, `__game.debug.hazard()`, snímek `world-1`, řádek `world` v `sim:run`. `STATUS.md`: co Petr testuje (hradba a brány, jestli nepřátelé chodí branami rozumně, nic neuvízne, cesty zrychlují, blesk je čitelný a férový, fps s plným davem na jeho stroji); rychlé odkazy `?debug=1&phase=3` + `__game.debug.hazard()`, `?fps=1&debug=1&phase=16`.
- [ ] **Krok 6:** `npm run check`, `npm run build`, e2e `webgl2-fallback` a `sim-chromium` → PASS; commity `chore(balance): tune world 1 obstacles and storm`, `docs: difficulties plan 2`; PR proti `main`, počkej na zelené CI, sloučit až na Petrovo slovo.
