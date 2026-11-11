# Vizuál A: prostředí, postavy a nepřátelé z CC0 kitů – implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hra přestane vypadat jako prototyp: robota nahradí hrdinové a kostlivci z kitů KayKit, každý typ nepřítele má vlastní model, aréna má povrch, světlo, mlhu, stíny, hrad a les kolem.

**Architecture:**
- Nástroj `tools/assets-build` stáhne zdrojové modely z GitHubu (připnuté na commit), vybere klipy, připojí zbraně, zjednoduší síť a zapíše malé GLB do `assets/models/`. Do repozitáře jdou jen výsledky; zdroje zůstávají v neverzovaném `assets-source/`.
- Klipy se při buildu přejmenují na názvy, které klient už zná (`Idle`, `Running`, `Walking`, `Punch`, `Death`), takže `Figure` a VAT se v logice animací nemění.
- `EnemyCrowd` drží jeden `InstancedMesh` s vlastním VAT na typ nepřítele (6 draw callů). VAT nově nese UV a texturu modelu.
- `scene.ts` se dělí na `ground.ts` (procedurální povrch v TSL), `lighting.ts` (světla, mlha, stíny), `castle.ts`, `props.ts` + čistý `prop-layout.ts`.
- Simulace, data a balanc se nemění.

**Tech Stack:** beze změny (Node 22, TypeScript 7.0.2, Vite 8.3.5, Vitest 5.1.0, Three.js 0.187.0, @playwright/test 1.63.0). Nové přesně připnuté devDependencies jen pro build assetů: `@gltf-transform/core` 4.5.1, `@gltf-transform/functions` 4.5.1, `meshoptimizer` 1.3.0.

**Spec:** `docs/superpowers/specs/2026-11-04-defense-webgame-design.md`, oddíl 6 (grafika a assety) a oddíl 7 (selhané načtení assetu). Pořadí schválil Petr 2026-11-10 (`docs/STATUS.md`, „Visual pass A“). Odchylky od specu, které tento plán rozhoduje a Task 7 zapíše do `docs/DECISIONS.md`: bez KTX2 a bez meshopt komprese (textury kitů mají ~15 kB, modely po ořezu stovky kB; dekodéry by přidaly víc, než ušetří).

## Global Constraints

- Větev `visual-a` z `main`. Commity jako `Claude <noreply@anthropic.com>`, Conventional Commits, před každým commitem `npm run check`.
- `sim/`, `design/`, `data/` se nemění. `npm run sim:run -- --hero all --runs 5` dává před plánem i po něm stejný výstup.
- Jen CC0 assety. Každý soubor v `assets/` má řádek v `assets/LICENSES.md` (autor, licence, URL připnutá na commit, datum, sha256 výsledného souboru).
- Do klienta se nedostane žádné jméno z mapy. Soubory modelů se jmenují podle našich id (`stonehorn.glb`, `shieldbearer.glb`).
- Rozpočty: hrdina ≤ 5000 trojúhelníků, nepřítel ≤ 2000, každý GLB hrdiny nebo nepřítele ≤ 700 kB, všechny modely dohromady ≤ 6 MB.
- Barvy: večerní, chladná paleta (tmavě modrá a modrošedá). Žádná oranžová.
- Cíl výkonu ze specu platí: 60 fps se 150 nepřáteli na notebooku s integrovanou grafikou. V kontejneru se fps měřit nedá (SwiftShader); hlídá se rozpočet trojúhelníků a Petr změří `?fps=1` po merge.
- Texty pro hráče EN i CS přes `client/ui/messages-*.ts`. Kód a komentáře anglicky.
- Po každém tasku, který mění obraz: `npm run shots`, přečíst PNG nástrojem Read a porovnat s kontrolním seznamem tasku. Obraz, který seznam nesplní, se nezavírá.
- Lokální brána: `npm run check`, `npm run build`, `npm run e2e -- --project=webgl2-fallback`.

## Co plán rozhoduje

**Zdroje** (vše CC0, Kay Lousberg, www.kaylousberg.com; `raw.githubusercontent.com` a `git clone` z kontejneru fungují, ověřeno 2026-11-11):

| klíč | repozitář `KayKit-Game-Assets/…` | commit | kořen |
|---|---|---|---|
| `adv` | `KayKit-Character-Pack-Adventures-1.0` | `672074b73ba276876a19e8816ecdc5241817ab47` | `addons/kaykit_character_pack_adventures` |
| `skel` | `KayKit-Character-Pack-Skeletons-1.0` | `15b62b9bad122f72926c10fb14d622c73819fa54` | `addons/kaykit_character_pack_skeletons` |
| `hex` | `KayKit-Medieval-Hexagon-Pack-1.0` | `84fa4e91af6a88989be7c99e0891cede11f2ca38` | `addons/kaykit_medieval_hexagon_pack` |

Postavy jsou v `Characters/gltf/<Name>.glb` (rig 41 kostí, 76–95 klipů, textura uvnitř), zbraně kostlivců v `Assets/gltf/<Name>.gltf` + `.bin` + `skeleton_texture.png`, budovy a příroda v `Assets/gltf/{buildings/blue,decoration/nature,decoration/props}/<name>.gltf` + `.bin` + `hexagons_medieval.png`. Ruce mají uzly `handslot.r` a `handslot.l`. Modely dobrodruhů mají všechny zbraně v sobě jako viditelné uzly; nechtěné se při buildu mažou.

**Hrdinové** (`assets/models/heroes/<id>.glb`; těla se opakují, liší se zbraní a barvou; vlastní modely přinese Vizuál B):

| id | zdroj | uzly, které zůstanou navíc k tělu | `Punch` ← |
|---|---|---|---|
| stonehorn | Knight | `2H_Sword`, `Knight_Helmet`, `Knight_Cape` | `2H_Melee_Attack_Chop` |
| redcleaver | Barbarian | `1H_Axe`, `1H_Axe_Offhand`, `Barbarian_Hat` | `Dualwield_Melee_Attack_Chop` |
| nightglaive | Rogue_Hooded | `Knife`, `Rogue_Cape` | `Throw` |
| sparkshot | Rogue | `2H_Crossbow` | `2H_Ranged_Shoot` |
| gravecaller | Mage | `2H_Staff`, `Mage_Hat`, `Mage_Cape` | `Spellcast_Shoot` |
| mistwarden | Mage | `Spellbook_open`, `1H_Wand`, `Mage_Hat` | `Spellcasting` |
| serpent-shaman | Mage | `2H_Staff` (bez klobouku a pláště) | `Spellcast_Raise` |
| tidecaller | Rogue_Hooded | `Rogue_Cape` + připojit `adv:Assets/gltf/staff.gltf` na `handslot.r` | `Spellcast_Shoot` |

„Tělo“ jsou uzly `<Name>_Body`, `_Head` (u Rogue_Hooded `Rogue_Head_Hooded`), `_ArmLeft`, `_ArmRight`, `_LegLeft`, `_LegRight`. Ostatní klipy hrdinů: `Idle` ← `Idle`, `Running` ← `Running_A`, `Death` ← `Death_A`.

**Nepřátelé** (`assets/models/enemies/<id>.glb`, zjednodušit na ≤ 2000 trojúhelníků):

| id | zdroj | připojit (`skel:Assets/gltf/…`) | `Walking` ← | `Punch` ← |
|---|---|---|---|---|
| shieldbearer | Skeleton_Warrior | `Skeleton_Blade` → r, `Skeleton_Shield_Large_A` → l | `Walking_A` | `1H_Melee_Attack_Chop` |
| scout | Skeleton_Minion | `Skeleton_Blade` → r | `Running_B` | `1H_Melee_Attack_Slice_Diagonal` |
| musketeer | Skeleton_Rogue | `Skeleton_Crossbow` → r | `Walking_A` | `2H_Ranged_Shoot` |
| chaplain | Skeleton_Mage | `Skeleton_Staff` → r | `Walking_A` | `Spellcast_Shoot` |
| lancer | Skeleton_Warrior (bez `Skeleton_Warrior_Helmet`) | `Skeleton_Axe` → r | `Running_A` | `2H_Melee_Attack_Chop` |
| captain | Skeleton_Warrior | `Skeleton_Blade` → r, `Skeleton_Shield_Large_B` → l | `Walking_A` | `1H_Melee_Attack_Slice_Horizontal` |

`Idle` ← `Idle` u všech. Barva typu z `enemy-tints.ts` zůstává, ale slabší (model má vlastní texturu): `BODY_TINT` 0,75 → 0,45, `GLOW` 0,35 → 0,12.

**Prostředí** (`assets/models/env/<name>.glb`, bez zjednodušení): `castle` ← `buildings/blue/building_castle_blue`, `tower` ← `buildings/blue/building_tower_A_blue`, `flag` ← `decoration/props/flag_blue`, `tree-a` ← `nature/tree_single_A`, `tree-b` ← `nature/tree_single_B`, `trees-a` ← `nature/trees_A_large`, `trees-b` ← `nature/trees_B_large`, `trees-c` ← `nature/trees_A_medium`, `rock-a` ← `nature/rock_single_A`, `rock-b` ← `nature/rock_single_C`, `rock-c` ← `nature/rock_single_E`.

| Téma | Rozhodnutí |
|---|---|
| Rekvizity a kolize | Simulace nemá překážky. Stromy a skály proto stojí jen za prstencem, kde se rodí roje: od `arena.spawn.radius + 250` ven až 900 za okraj arény. Uvnitř prstence nestojí nic, čím by nepřátelé procházeli; hrací plochu oživuje jen povrch. |
| Povrch | Rovina o 1800 větší než aréna na každou stranu. Barva z `mx_noise_float` nad `positionWorld.xz` (dvě oktávy, perioda 9 a 2,3 scénické jednotky): tráva `0x2f4a3a` ↔ `0x3d5c41` ↔ `0x27402f`. Udusaná hlína `0x4a4638`: plně do `castle.radius × 1,3`, plynule mizí do `castle.radius × 2,4`. Tmavý prstenec na `spawn.radius` mizí; nahrazuje ho pás hlíny šířky 160 se slábnutím 120 na obě strany a krytím 0,55. |
| Světlo | Pozadí a mlha `0x141c2b`. `HemisphereLight(0x9fb6e6, 0x1c2430, 1.1)`. Měsíc: `DirectionalLight(0xdbe6ff, 2.2)` ze směru (30, 60, 20). `renderer.toneMapping = NeutralToneMapping`, expozice 1,0. |
| Mlha | `Fog(0x141c2b, 58, 105)` (kamera je 46 od cíle), takže horní okraj obrazu a les za arénou se ztrácejí do tmy. |
| Stíny | Stínová mapa 2048 jen od měsíce, PCF soft, ortografický box ±34 kolem cíle kamery, posun po texelech (bez plavání). Vrhají: hrdina, kopie hrdiny, hrad, věže, rekvizity. Přijímá: povrch. Nepřátelé a spojenci-totemy mají levný kruhový stín (`BlobShadows`): černý kruh s průměrem 1,1 × kolize, krytí 0,35 ve středu, 0 na okraji. |
| Vypnutí stínů | `?shadows=0`, a automaticky při softwarovém vykreslování (`gpu.software`). Kruhové stíny zůstávají vždy. |
| Hrad | Model `castle` škálovaný tak, aby se jeho půdorys vešel do kruhu o průměru `2 × castle.radius × 1,1`; čtyři `tower` na úhlopříčkách ve vzdálenosti `castle.radius × 0,95` s výškou 0,8 výšky hradu; na každé `flag`. |
| Hrdina v davu | `Figure`: `TINT_MIX` 0,75 → 0,2, `TINT_GLOW` 0,25 → 0,08. Pod hrdinou prstenec v barvě hrdiny (vnitřní poloměr 0,9 × kolize, vnější 1,15 × kolize, krytí 0,7). |
| Načítání | Prostředí a 6 nepřátel se načtou před menu. Model hrdiny se načítá při výběru v menu (cache podle URL); dokud není, Start je neaktivní. Každé načtení se jednou zopakuje, pak se ukáže chyba (`error.generic`). |
| Robot | `robot-expressive` zůstává jen pro benchmark `client/spike/`. |

## Review Focus

1. **Model hrdiny se nenačte** (výpadek sítě, 404): hráč vidí chybovou hlášku, ne černou obrazovku ani běh bez hrdiny. Test v Tasku 4.
2. **Softwarové vykreslování nebo WebGL2**: stínová mapa se vypne sama a hra kreslí dál. Test v Tasku 6.
3. **Restart a změna hrdiny**: ve scéně je vždy právě jeden model hrdiny, starý je uvolněný; kopie hrdiny (spojenci) mají model nového hrdiny. Test v Tasku 4.
4. **Všech 150 nepřátel je jednoho typu**: žádná instance nechybí ani nepřeteče do sousedního typu. Test v Tasku 3.
5. **Hrdina v rohu arény**: stíny ho dál sledují, za okrajem je les a mlha, ne konec roviny. Snímek `corner` v Tasku 7.

---

### Task 1: Snímky pro vizuální kontrolu

**Files:**
- Create: `e2e/shots.spec.ts`
- Modify: `client/game/debug.ts` (přidat `debug.teleport`), `package.json` (skript `shots`), `AGENTS.md` (řádek o `npm run shots` a `debug.teleport`)

**Interfaces:**
- Produces: `npm run shots` = `playwright test e2e/shots.spec.ts --project=webgl2-fallback`; zapisuje `test-results/shots/{menu,start,fight,castle,corner}.png` (1280 × 720). `window.__game.debug.teleport(x: number, y: number): void` (jen s `?debug=1`) přesune hrdinu na souřadnice simulace, oříznuté do arény.

- [ ] **Step 1:** Napiš `e2e/shots.spec.ts`. Každý snímek je jeden test, který jen ukládá PNG a nic netvrdí o obrazu (kromě toho, že stránka nehlásí chybu, to dělá `e2e/fixtures.ts`):
  - `menu`: `?seed=7&lang=cs`, bez kliknutí;
  - `start`: `?seed=7&hero=stonehorn`, Start, 2 s;
  - `fight`: `?seed=7&hero=stonehorn&debug=1&speed=4`, Start, čekat na `__game.tick >= 2700`, pak `debug.spawnEach()` a 1 s;
  - `castle`: `?seed=7&hero=gravecaller&debug=1`, Start, `debug.teleport(0, -420)`, 1 s;
  - `corner`: `?seed=7&hero=nightglaive&debug=1`, Start, `debug.teleport(2900, 2900)`, 1 s.
- [ ] **Step 2:** Spusť `npm run shots`. Očekávání: `castle` a `corner` padají na `teleport is not a function`.
- [ ] **Step 3:** Přidej `teleport` do debug háčků vedle `grantXp`: nastaví `hero.x`, `hero.y`, `prevX`, `prevY` na hodnoty oříznuté do arény.
- [ ] **Step 4:** `npm run shots` projde; přečti všech 5 PNG (Read) a ověř, že ukazují dnešní hru. `npm run check`.
- [ ] **Step 5:** Commit `test: screenshot harness for visual review`.

### Task 2: Build assetů

**Files:**
- Create: `tools/assets-build/manifest.ts`, `tools/assets-build/fetch.ts`, `tools/assets-build/build.ts`, `tools/assets-build/glb-info.ts`, `tools/assets-build/glb-info.test.ts`, `assets/assets.test.ts`, `assets/models/{heroes,enemies,env}/*.glb`
- Modify: `package.json` (devDependencies, skripty `assets:fetch`, `assets:build`), `.gitignore` (`assets-source/`), `assets/LICENSES.md`, `AGENTS.md` (oddíl „Assets pipeline“), `ARCHITECTURE.md`, `vitest.config.ts` (zahrnout `assets/*.test.ts` a `tools/assets-build/*.test.ts`, pokud je vzor nezahrnuje)

**Interfaces:**
- Produces:
  - `manifest.ts`: `SOURCES: Record<"adv" | "skel" | "hex", { repo: string; commit: string; root: string }>` a `MODELS: ModelSpec[]`, kde
    `interface ModelSpec { out: string; source: string; removeNodes?: string[]; keepNodes?: string[]; attach?: { file: string; slot: "handslot.r" | "handslot.l" }[]; clips: Record<string, string>; maxTriangles?: number }`. `out` je cesta pod `assets/models/` (`heroes/stonehorn.glb`), `source` a `file` jsou `"<klíč>:<cesta pod kořenem>"`, `clips` mapuje nový název na zdrojový. `keepNodes` (hrdinové): ze všech uzlů se sítí zůstanou jen tělo a vyjmenované. Obsah přesně podle tabulek výše; `maxTriangles` 5000 hrdinové, 2000 nepřátelé, prostředí bez limitu a s `clips: {}`.
  - `glb-info.ts`: `readGlbInfo(path: string): { triangles: number; clips: string[]; meshNodes: string[]; bytes: number; hasTexture: boolean }` (čte JSON chunk GLB, bez three).
  - `npm run assets:fetch`: stáhne z `https://raw.githubusercontent.com/KayKit-Game-Assets/<repo>/<commit>/<root>/<cesta>` každý soubor, který manifest potřebuje (u `.gltf` i jeho `.bin` a texturu, na které odkazuje), do `assets-source/<klíč>/<cesta>`; existující soubory přeskočí.
  - `npm run assets:build`: pro každý `ModelSpec` zapíše GLB a nakonec přepíše tabulku v `assets/LICENSES.md` (řádek robota zachová).

- [ ] **Step 1:** Napiš `tools/assets-build/glb-info.test.ts`: `readGlbInfo` nad `assets/models/robot-expressive/RobotExpressive.glb` vrátí `triangles === 3237`, `clips` obsahuje `"Walking"`, `"Punch"`, `"Idle"`, `"Running"`, `"Death"`, `hasTexture === false`.
- [ ] **Step 2:** Napiš `assets/assets.test.ts`:
  - každý soubor pod `assets/` kromě `LICENSES.md` a testu má v `LICENSES.md` právě jeden řádek a jeho sha256 sedí; žádný řádek neukazuje na soubor, který neexistuje;
  - pro každé `id` z `data/generated/heroes.json` existuje `assets/models/heroes/<id>.glb` s klipy přesně `Death`, `Idle`, `Punch`, `Running`, `triangles <= 5000`, `bytes <= 700_000`, `hasTexture`;
  - pro každé `id` z `data/generated/enemies.json` existuje `assets/models/enemies/<id>.glb` s klipy přesně `Idle`, `Punch`, `Walking`, `triangles <= 2000`, `bytes <= 700_000`, `hasTexture`;
  - 11 souborů prostředí z tabulky existuje, každý `hasTexture`, `castle.glb` má `triangles <= 6000`;
  - součet `bytes` všech GLB pod `assets/models/` je `<= 6_000_000`;
  - žádný `meshNodes` hrdiny neobsahuje uzel, který tabulka hrdinů nevyjmenovává (např. `stonehorn` nemá `Round_Shield`).
- [ ] **Step 3:** `npm run check`: oba testy padají (chybí `glb-info.ts` a modely).
- [ ] **Step 4:** Přidej tři devDependencies v přesných verzích (`npm install -D -E`), `glb-info.ts`, `manifest.ts`, `fetch.ts`.
- [ ] **Step 5:** Napiš `build.ts` nad `@gltf-transform`. Pořadí kroků pro jeden model: načíst zdroj → smazat uzly (`removeNodes`, nebo vše se sítí mimo tělo a `keepNodes`) → pro každé `attach` načíst soubor, sloučit dokumenty (`mergeDocuments`) a jeho kořenový uzel dát jako dítě uzlu `slot` → smazat animace mimo `clips` a zbylé přejmenovat → `dedup()`, `prune()`, `weld()` → je-li `maxTriangles` a model je nad ním: `simplify({ simplifier: MeshoptSimplifier, ratio: maxTriangles / triangles, error: 0.02 })`, a když jeden průchod nestačí, opakovat s `error` × 2 nejvýš třikrát; když ani pak limit neplatí, build skončí chybou se jménem modelu → `resample()` na klipy → zapsat GLB s texturou uvnitř. Textury se nepřevádějí.
- [ ] **Step 6:** `npm run assets:fetch && npm run assets:build`, pak `npm run check`. Očekávání: projde. Když zjednodušení poškodí skinning některého modelu (zkontroluj v Tasku 3 a 4 na snímcích), smí se jeho `error` v manifestu snížit a limit nepřítele zvednout nejvýš na 3000 se zápisem do `docs/DECISIONS.md`; test se upraví stejným commitem.
- [ ] **Step 7:** Doplň `AGENTS.md` (jak přidat model: řádek v manifestu, `assets:fetch`, `assets:build`, commit výsledků; `assets-source/` se necommituje) a `ARCHITECTURE.md` (tok dat assetů). Commit `feat(assets): CC0 character and environment models with a build pipeline`.

### Task 3: Nepřátelé – model na typ, VAT s texturou

**Files:**
- Create: `client/render/models.ts`, `client/render/models.test.ts`, `client/render/crowd-buckets.ts`, `client/render/crowd-buckets.test.ts`
- Modify: `client/render/vat.ts`, `client/render/enemy-crowd.ts`, `client/main.ts`, `client/game/debug.ts`, `e2e/game.spec.ts`, `ARCHITECTURE.md`

**Interfaces:**
- Consumes: `assets/models/enemies/<id>.glb` s klipy `Walking`, `Punch`, `Idle` (Task 2).
- Produces:
  - `models.ts`: `modelUrl(kind: "heroes" | "enemies" | "env", id: string): string` (`${import.meta.env.BASE_URL}models/<kind>/<id>.glb`), `class ModelCache { get(url: string): Promise<GLTF>; }` (jedna rozpracovaná nebo hotová promise na URL; selhání se jednou zopakuje a z cache se odstraní, aby šlo zkusit znovu). Konstruktor bere `load: (url: string) => Promise<GLTF>` kvůli testu.
  - `vat.ts`: `BakedVat` navíc `map: Texture | null` (textura prvního materiálu, který ji má) a sloučená geometrie nese `uv` (nuly, když ji zdroj nemá).
  - `crowd-buckets.ts`: `class CrowdBuckets { constructor(types: number, capacity: number); reset(): void; push(type: number): number; count(type: number): number; }`. `push` vrací index instance v rámci typu a vyhodí chybu nad `capacity`.
  - `EnemyCrowd`: `constructor(vats: BakedVat[], capacity: number, tints: Float32Array)` (index = index typu v `data.enemies`), `readonly object: Group` místo `mesh`, `meshCount: number`.
  - `window.__game.render = { enemyMeshes: number, heroModels: number, shadows: boolean }` (`heroModels` a `shadows` plní Tasky 4 a 6; zatím 1 a `false`).

- [ ] **Step 1:** `crowd-buckets.test.ts`: po `push(2)` třikrát a `push(0)` jednou je `count(2) === 3`, `count(0) === 1`, `count(1) === 0` a vrácené indexy jsou 0, 1, 2 a 0; 150× `push(4)` při `capacity` 150 projde a `count(4) === 150`, 151. vyhodí; `reset()` vynuluje všechny počty.
- [ ] **Step 2:** `models.test.ts`: dvě souběžná `get` téže URL zavolají `load` jednou; `load`, který poprvé selže a podruhé uspěje, dá výsledek a volal se dvakrát; `load`, který selže dvakrát, odmítne a další `get` zkouší znovu.
- [ ] **Step 3:** Spusť oba testy: padají (moduly neexistují). Implementuj `crowd-buckets.ts` a `models.ts`; projdou.
- [ ] **Step 4:** `vat.ts`: `mergeDefaultPose` kopíruje `uv`, `bakeVat` vrací `map`. `enemy-crowd.ts`: jeden `InstancedMesh` na typ (kapacita každého = `capacity`), smyčka přes sloty plní pole typu podle `CrowdBuckets`, bez alokace v `update`. `colorNode` = `texture(map, uv())` (nebo barva vrcholu, když `map` chybí) × stávající míchání s barvou typu; `BODY_TINT = 0.45`, `GLOW = 0.12`. Výška nohou a šířka se berou z geometrie daného typu.
- [ ] **Step 5:** `main.ts`: načti 6 modelů nepřátel souběžně přes `ModelCache`, zapeč VAT každého (`Walking`, `Punch`, `Idle`), předej `EnemyCrowd`. Robot z `main.ts` mizí pro nepřátele (hrdina ho má do Tasku 4).
- [ ] **Step 6:** `e2e/game.spec.ts`: v testu, který hraje běh, přidej `expect(render.enemyMeshes).toBe(6)`.
- [ ] **Step 7:** `npm run check && npm run build && npm run e2e -- --project=webgl2-fallback && npm run shots`. Kontrola snímku `fight`: je vidět 6 různých postav se zbraněmi, mají texturu (ne jednolitou barvu), stojí na zemi, míří ke svému cíli čelem, žádná nemá roztrhanou síť ani díry; barva typu je znát, ale nepřebíjí model.
- [ ] **Step 8:** Commit `feat(client): a textured model per enemy type`.

### Task 4: Hrdinové – vlastní modely

**Files:**
- Modify: `client/render/figure.ts`, `client/render/hero-view.ts`, `client/render/ally-view.ts`, `client/main.ts`, `client/ui/menu.ts`, `client/ui/messages-en.ts`, `client/ui/messages-cs.ts`, `client/game/debug.ts`, `e2e/game.spec.ts`, `ARCHITECTURE.md`

**Interfaces:**
- Consumes: `ModelCache`, `modelUrl` (Task 3); `assets/models/heroes/<id>.glb` s klipy `Idle`, `Running`, `Punch`, `Death`.
- Produces:
  - `HeroView.setModel(gltf: GLTF): void` a `AllyView.setModel(gltf: GLTF): void`: uvolní starou figuru (geometrie patří cache, uvolňují se jen klonované materiály a mixer), vytvoří novou; `HeroView.object` je stálý `Group`, do kterého se figura vkládá.
  - `HeroView.modelCount: number` (počet figur pod `object`).
  - `Menu.setLoading(loading: boolean): void`: Start je neaktivní a nese text `menu.loading` („Loading…“ / „Načítám…“).
  - `main.ts`: `async function useHero(id: string): Promise<void>` načte model, zavolá oba `setModel` a teprve pak `session.start(...)`; při souběhu vyhrává poslední zvolený hrdina. Selhání jde do `showError`.

- [ ] **Step 1:** Přidej do `e2e/game.spec.ts`:
  - „every hero has its own model“: po výběru každého z 8 hrdinů v menu je `__game.render.heroModels === 1` a `__game.hero` je jeho id;
  - „a missing hero model shows an error“: `page.route("**/models/heroes/mistwarden.glb", r => r.abort())`, `?hero=mistwarden`; prvek `#error` je viditelný a neprázdný. Tento test si v `e2e/fixtures.ts` vyžádá výjimku z pravidla o chybách v konzoli jen pro hlášky o tomto souboru.
- [ ] **Step 2:** Spusť e2e: oba nové testy padají.
- [ ] **Step 3:** `figure.ts`: `TINT_MIX = 0.2`, `TINT_GLOW = 0.08`; `dispose()` nechává sdílenou geometrii a textury být. `hero-view.ts`: `setModel`, prstenec pod hrdinou podle tabulky (barva `heroBodyColor`), `modelCount`. `ally-view.ts`: `setModel`. `menu.ts`: `setLoading`. `main.ts`: `useHero`, napojit na výběr v menu, na start i na restart.
- [ ] **Step 4:** `npm run check && npm run build && npm run e2e -- --project=webgl2-fallback && npm run shots`. Kontrola `start`, `castle`, `corner`: hrdina je člověk se správnou zbraní podle tabulky, nemá v ruce cizí zbraně, stojí na zemi, dívá se směrem pohybu, prstenec je vidět a neproblikává se zemí. Spusť ještě jednou e2e test, který hraje běh s každým hrdinou (existuje), kvůli klipům `Punch` a `Death`.
- [ ] **Step 5:** Commit `feat(client): a model per hero, loaded on choice`.

### Task 5: Povrch, světlo a mlha

**Files:**
- Create: `client/render/ground.ts`, `client/render/lighting.ts`, `client/render/palette.ts`
- Modify: `client/render/scene.ts`, `client/main.ts`, `client/render/gpu.ts` (tone mapping), `ARCHITECTURE.md`

**Interfaces:**
- Produces:
  - `palette.ts`: pojmenované konstanty všech barev z tabulky „Prostředí“ (`SKY`, `GRASS_A`, `GRASS_B`, `GRASS_C`, `DIRT`, `HEMI_SKY`, `HEMI_GROUND`, `MOON`).
  - `ground.ts`: `createGround(rules: Rules): Mesh` (`receiveShadow = true`).
  - `lighting.ts`: `interface Lighting { readonly object: Group; readonly sun: DirectionalLight; applyTo(scene: Scene): void; }`, `createLighting(): Lighting`; `applyTo` nastaví `scene.background` a `scene.fog`.
  - `scene.ts`: `createArena(rules)` skládá povrch a hrad (zatím starý z primitiv); světla z něj mizí.

- [ ] **Step 1:** Implementuj tři moduly podle tabulky „Co plán rozhoduje“ (povrch, světlo, mlha) a napoj je v `main.ts`; `NeutralToneMapping` nastav tam, kde vzniká renderer.
- [ ] **Step 2:** `npm run check && npm run build && npm run e2e -- --project=webgl2-fallback && npm run shots`. Práh `luminance stddev > 2.5` musí dál platit; když ne, zesvětli `HemisphereLight` (nejvýš na 1,6), ne práh.
- [ ] **Step 3:** Kontrola snímků: povrch není jednolitý ani se viditelně neopakuje; kolem hradu je hlína; pás hlíny na prstenci je znát, ale neruší; horní okraj obrazu mizí do tmavě modré; hrdina, nepřátelé, krystaly, efekty kouzel a čísla poškození jsou na povrchu čitelné (porovnej `fight` se snímkem z Tasku 4); nikde není oranžová. Šipky rojů a ukazatel hradu jsou vidět.
- [ ] **Step 4:** Commit `feat(client): procedural ground, dusk lighting and fog`.

### Task 6: Stíny

**Files:**
- Create: `client/render/shadows.ts`, `client/render/shadows.test.ts`, `client/render/blob-shadows.ts`
- Modify: `client/render/lighting.ts`, `client/render/figure.ts`, `client/render/ally-view.ts`, `client/game/params.ts`, `client/game/params.test.ts`, `client/main.ts`, `client/game/debug.ts`, `AGENTS.md` (parametr `shadows`), `ARCHITECTURE.md`

**Interfaces:**
- Produces:
  - `params.ts`: `GameParams.shadows: boolean` (`?shadows=0` → `false`, jinak `true`).
  - `shadows.ts`: `shadowsEnabled(param: boolean, softwareGpu: boolean): boolean` (`param && !softwareGpu`); `snapToTexel(value: number, boxSize: number, mapSize: number): number`; `class SunShadow { constructor(sun: DirectionalLight, renderer: WebGPURenderer, enabled: boolean); follow(sceneX: number, sceneZ: number): void; }` (box ±34, mapa 2048, střed boxu se posouvá po texelech).
  - `blob-shadows.ts`: `class BlobShadows implements RunView` s `readonly mesh: InstancedMesh` (kapacita `maxAlive + ALLY_CAPACITY`), kreslí kruh pod každým živým nepřítelem a pod spojenci, kteří nejsou kopií hrdiny; `update` nealokuje.
  - `__game.render.shadows` = výsledek `shadowsEnabled`.

- [ ] **Step 1:** `shadows.test.ts`: `shadowsEnabled(true, false) === true`, `(true, true) === false`, `(false, false) === false`; `snapToTexel(10.013, 68, 2048)` je násobek `68 / 2048` nejbližší k 10,013 a dvě hodnoty lišící se o méně než půl texelu dají stejný výsledek. `params.test.ts`: `?shadows=0` → `false`, bez parametru `true`.
- [ ] **Step 2:** Testy padají; implementuj `shadows.ts` a parametr; projdou.
- [ ] **Step 3:** `SunShadow` napoj v `main.ts` (volat `follow` s cílem kamery každý snímek), `castShadow` zapni na sítích `Figure` (hrdina a kopie). `BlobShadows` přidej mezi pohledy relace. Do `e2e/game.spec.ts` přidej: bez parametru je `__game.render.shadows === !__game.gpu.software` a běh se kreslí; s `?shadows=0` je `false`.
- [ ] **Step 4:** `npm run check && npm run build && npm run e2e -- --project=webgl2-fallback && npm run shots`. Stínovou mapu kontejner neukáže (software); ověř na snímcích kruhové stíny: každý nepřítel má pod sebou měkký tmavý kruh, který neproblikává s povrchem a nezakrývá hlínu ostrou hranou.
- [ ] **Step 5:** Commit `feat(client): moon shadow map and blob shadows`.

### Task 7: Hrad, les a uzavření

**Files:**
- Create: `client/render/castle.ts`, `client/render/prop-layout.ts`, `client/render/prop-layout.test.ts`, `client/render/props.ts`
- Modify: `client/render/scene.ts`, `client/main.ts`, `e2e/shots.spec.ts` (nic nového, jen kontrola), `ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/STATUS.md`, `docs/superpowers/specs/2026-11-04-defense-webgame-design.md` (oddíl 6: poznámka o pipeline bez KTX2 a meshopt), `README.md` (credits: Kay Lousberg, KayKit, CC0)

**Interfaces:**
- Consumes: `ModelCache`, `modelUrl("env", …)`, `SunShadow` (stíny vrhá vše z tohoto tasku).
- Produces:
  - `prop-layout.ts`: `interface PropPlacement { model: number; x: number; y: number; scale: number; turn: number }` (souřadnice simulace, `turn` 0–3 = čtvrtotáčky) a `layoutProps(rules: Rules, models: number, seed: number): PropPlacement[]`. Používá `Rng` ze `sim`. Mřížka s krokem 230 přes čtverec arény zvětšený o 900 na každou stranu; buňka dostane rekvizitu, když její střed je dál než `spawn.radius + 250` od hradu a los `< 0,6`; poloha se v buňce posune o ±80, `scale` 0,9–1,4.
  - `castle.ts`: `createCastle(models: { castle: GLTF; tower: GLTF; flag: GLTF }, rules: Rules): Group`.
  - `props.ts`: `createProps(models: GLTF[], placements: PropPlacement[]): Group` (jeden `InstancedMesh` na model a jeho síť, statické matice, `castShadow`).

- [ ] **Step 1:** `prop-layout.test.ts` (pravidla z `data/generated/rules.json`): stejný seed dá stejný výsledek, jiný seed jiný; každá položka je od hradu dál než `spawn.radius + 250 − 80`; žádná není dál než polovina strany arény + 900 + 80 v ose x ani y; počet je mezi 250 a 900; každý index modelu 0 až `models − 1` se vyskytuje aspoň jednou; `turn` je celé číslo 0–3.
- [ ] **Step 2:** Test padá; implementuj `layoutProps`; projde.
- [ ] **Step 3:** Implementuj `castle.ts` a `props.ts`, načti 11 modelů prostředí v `main.ts` před menu, nahraď hrad z primitiv. Seed rozmístění je pevný (`1`), les je v každém běhu stejný.
- [ ] **Step 4:** `npm run check && npm run build && npm run e2e -- --project=webgl2-fallback && npm run shots`. Kontrola: `castle` – hrad s věžemi a vlajkami stojí uprostřed hlíny, nepřesahuje kruh, o který se nepřátelé zastaví; `corner` – za okrajem arény je les a mlha, není vidět konec roviny ani prázdné pozadí; `start` a `fight` – uvnitř prstence žádný strom ani skála; modely prostředí mají texturu.
- [ ] **Step 5:** Ověř, že balanc je nedotčený: `git diff main -- sim design data` je prázdný.
- [ ] **Step 6:** Dokumenty: `ARCHITECTURE.md` (klient: nové moduly; oddíl o assetech), `docs/DECISIONS.md` (rozhodnutí z tabulek tohoto plánu a odchylky od specu), oddíl 6 specu, credits v `README.md`, `docs/STATUS.md` (Vizuál A hotov na větvi, co má Petr zkontrolovat v playtestu: vzhled, čitelnost typů, `?fps=1` na jeho stroji se stíny i s `?shadows=0`; z pěti drobností po 2b-1 mizí „Lancer a Chaplain jsou oba bledí“).
- [ ] **Step 7:** Commit `feat(client): castle and forest from the CC0 kit; docs for visual pass A`. Push větve a otevři PR `Visual pass A: environment, heroes and enemy models` (přes `gh api`, viz `docs/STATUS.md`).
