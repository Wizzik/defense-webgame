# Fáze 0: základ projektu – implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Postavit repozitář Defense Webgame tak, aby šla data z mapy převést na ověřená herní data 4 MVP hrdinů a aby technický test ukázal dav 150–600 animovaných nepřátel na WebGPU i WebGL2.

**Architecture:**
- Jeden npm balíček (TypeScript) se složkami `sim/`, `client/`, `data/`, `design/`, `tools/`, `e2e/` a `assets/`.
- Data z mapy vytahuje Python toolkit v `tools/map-extract/` do `data-source/` (mimo git).
- `tools/data-build/` z nich a z `design/*.yaml` skládá `data/generated/*.json`, ověřené schématy zod v `data/schema/`.
- Technický test (spike) v `client/spike/` kreslí instancovaný dav s animací zapečenou do textury (VAT) přes Three.js WebGPURenderer s fallbackem na WebGL2.

**Tech Stack:** Node 22, TypeScript 7.0.2, Vite 8.3.5, Vitest 5.1.0, Three.js 0.187.0 (+ @types/three 0.187.0), zod 4.6.7, yaml 2.9.1, tsx 4.23.15, @playwright/test 1.63.0, Python 3 (jen standardní knihovna), GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-04-defense-webgame-design.md` (oddíly 4, 5, 6, 7 a fáze 0 v oddílu 8).

## Global Constraints

**Clean room (spec 1, 4, 5):**
- Do gitu nesmí `data-source/`, `xhero/`, `*.w3x` ani rozbalené soubory mapy (`war3map.*`).
- Žádné tooltipy ani texty z mapy. Do repozitáře jde jen kód z mapy (`source`), čísla a vlastní jména a texty.
- Pracovní jména hrdinů a kouzel jsou v `design/*.yaml` (EN + CS).

**Kód:**
- `sim/` nesmí importovat `three`, nic z `client/` ani používat DOM (`window`, `document`, `navigator`).
- Verze závislostí přesně podle Tech Stack, uzamčené v `package-lock.json`. `@playwright/test` musí zůstat 1.63.0, protože odpovídá prohlížeči předinstalovanému v kontejneru (`/opt/pw-browsers/chromium-1243`).
- Kód, identifikátory a komentáře anglicky. Texty pro hráče v EN i CS.

**Assety:** každý soubor v `assets/` má řádek v `assets/LICENSES.md` (asset, autor, licence, zdrojová URL, datum stažení, sha256).

**Grafika:** WebGPU s automatickým fallbackem na WebGL2. Cíl výkonu je 60 fps se 150 nepřáteli na notebooku s integrovanou grafikou (spec 1, bod 4).

**Práce v gitu:**
- Větev `phase-0` z `main`, commity po úkolech ve stylu Conventional Commits.
- Před každým commitem musí projít `npm run check`.

**Push:** zápis do GitHubu je zatím zablokovaný (chybí Claude GitHub App). Úkoly 1–6 se commitují lokálně, push a CI ověří úkol 7.

**Náhledy (odchylka od spec 4, domluvená s autorem):** náhledové URL pro každou větev přes Cloudflare Pages přijdou až po fázi 0. Zatím se nasazuje jen `main` na GitHub Pages a screenshoty z e2e testů jsou artefakty CI.

## Review Focus

1. **WebGPU není dostupné, i když `navigator.gpu` existuje.** `requestAdapter()` vrátí `null`, jak se ukázalo v kontejneru. Spike musí běžet na WebGL2 a overlay musí ukázat „WebGL2“. Test: úkol 6, projekt `webgl2-fallback`.
2. **Nová verze mapy přidá, odebere nebo přejmenuje kód hrdiny či kouzla.** data-build musí skončit čitelnou chybou se jménem souboru a kódem, ne pádem bez vysvětlení ani tichým vynecháním. Test: úkol 4, `fails with readable error when source id is missing`.
3. **Ručně upravený `design/*.yaml` s překlepem** v druhu kouzla, v klíči parametru nebo se špatnou délkou pole. Chyba musí obsahovat cestu k poli. Testy: úkol 3, `reports path of invalid kind`, a úkol 4, `rejects unknown param source`.
4. **Velký dav (n=600) v softwarovém renderingu.** Hra nesmí spadnout ani zamrznout, snímky musí přibývat a nesmí se alokovat paměť při každém snímku. Testy: úkol 5, `spatial hash keeps capacity`, a úkol 6, `n=600 frames advance`.
5. **Omylem commitnutá data mapy nebo převzaté texty.** Strážní test musí selhat. Test: úkol 1, `repo guard`, který úkol 4 rozšíří o kontrolu `data/generated`.

---

## Mapa souborů

```
package.json, package-lock.json, tsconfig.json, sim/tsconfig.json, vite.config.ts, vitest.config.ts,
playwright.config.ts, .gitignore, .editorconfig, README.md, AGENTS.md, CLAUDE.md
tests/repo-guard.test.ts                 strážní testy repozitáře (clean room, čistota sim/)
sim/index.ts                             zatím prázdný vstup simulace (obsah přijde ve fázi 1)
client/index.html, client/main.ts        rozcestník s odkazem na spike
client/spike/{index.html, main.ts, bake-vat.ts, crowd.ts, spatial-hash.ts, frame-stats.ts, overlay.ts}
client/spike/{spatial-hash.test.ts, frame-stats.test.ts}
tools/map-extract/                       toolkit (12 souborů) + run.sh + tests/
data/schema/{common.ts, ability.ts, hero.ts, constants.ts, index.ts, schema.test.ts}
design/{heroes.yaml, abilities.yaml}
tools/data-build/{load.ts, resolve.ts, map-abilities.ts, map-heroes.ts, build.ts, data-build.test.ts, fixtures/}
data/generated/{heroes.json, abilities.json, constants.json}, data/generated.test.ts
assets/models/robot-expressive/RobotExpressive.glb, assets/LICENSES.md
e2e/spike.spec.ts, .github/workflows/{ci.yml, pages.yml}
```

---

### Task 1: Základ repozitáře, pravidla a strážní testy

**Files:**
- Create: `package.json`, `tsconfig.json`, `sim/tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.gitignore`, `.editorconfig`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `sim/index.ts`, `client/index.html`, `client/main.ts`
- Test: `tests/repo-guard.test.ts`

**Interfaces:**
- Produces:
  - npm skripty `typecheck` (`tsc -p sim/tsconfig.json && tsc -p tsconfig.json`), `test` (`vitest run`), `check` (`npm run typecheck && npm test`), `build` (`vite build`), `dev` (`vite`).
  - `vite.config.ts` s `root: "client"`, `publicDir: "../assets"`, `base: process.env.BASE_PATH ?? "/"` a `build.outDir: "../dist"`. Vícestránkový build přes `build.rollupOptions.input`; vstup `client/spike/index.html` přidá úkol 5.
  - `vitest.config.ts` s prostředím `node` a `include: ["tests/**/*.test.ts", "data/**/*.test.ts", "tools/**/*.test.ts", "client/**/*.test.ts", "sim/**/*.test.ts"]`.
  - `sim/tsconfig.json` s `lib: ["ES2022"]` a `types: []`, tedy bez DOM.

- [ ] **Step 1:** Vytvoř větev `git checkout -b phase-0` a nainstaluj přesné verze:
  - `npm i -D -E typescript@7.0.2 vite@8.3.5 vitest@5.1.0 @types/three@0.187.0 tsx@4.23.15 @playwright/test@1.63.0 yaml@2.9.1`
  - `npm i -E three@0.187.0 zod@4.6.7`
  - `"type": "module"`, `"engines": {"node": ">=22"}`
- [ ] **Step 2: Napiš strážní test `tests/repo-guard.test.ts`.**

```ts
describe("repo guard", () => {
  it("tracks no map data", () => {
    const files = execSync("git ls-files", { encoding: "utf8" }).split("\n");
    expect(files.filter((f) => /^(data-source|xhero)\/|\.w3x$|(^|\/)war3map\./i.test(f))).toEqual([]);
  });
  it("keeps sim/ free of three, client/ and DOM", () => {
    // every .ts under sim/: no import of 'three' or a path containing 'client/', no \b(window|document|navigator)\./
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 3:** Spusť `npm test`. Očekávané: PASS (repo je čisté, `sim/index.ts` obsahuje jen `export {};`).
- [ ] **Step 4:** Ověř, že strážce opravdu hlídá. Dočasně přidej do `sim/index.ts` řádek `import "three";` a spusť `npm test`. Očekávané: FAIL s cestou `sim/index.ts`. Řádek pak odeber.
- [ ] **Step 5:** `.gitignore` obsahuje `node_modules/ dist/ data-source/ xhero/ *.w3x test-results/ playwright-report/`.
- [ ] **Step 6:** Rozcestník `client/index.html` má nadpis „Defense Webgame“ a odkaz `spike/` s textem „Technický test davu“. `npm run build` vytvoří `dist/index.html`.
- [ ] **Step 7: Napiš `AGENTS.md` (pravidla pro AI agenty).**
  - Obsah:
    - clean room podle Global Constraints;
    - příkazy `npm run check`, `npm run build`, `npm run e2e`, `npm run map:extract`, `npm run data:build`;
    - čistota `sim/`;
    - každý asset patří do `assets/LICENSES.md`;
    - texty EN + CS;
    - malé soubory s jednou rolí;
    - commit až po `npm run check`.
  - `CLAUDE.md` obsahuje jediný řádek `@AGENTS.md`.
  - `README.md`: co projekt je, odkaz na specifikaci a příkazy.
- [ ] **Step 8:** Spusť `npm run check && npm run build`. Očekávané: obojí projde.
- [ ] **Step 9: Commit:** `chore: bootstrap repository, rules and repo guard`

### Task 2: Toolkit pro vytažení dat z mapy v repozitáři

**Files:**
- Create: `tools/map-extract/` (12 souborů rozbalených z `/home/claude/skills/xhero-toolkit.zip`), `tools/map-extract/run.sh`
- Test: `tools/map-extract/tests/test_toolkit.py`, `tools/map-extract/tests/fixtures/{v1,v2}/`
- Modify: `package.json` (skripty `map:extract` = `bash tools/map-extract/run.sh` a `test:py` = `python3 -I -m unittest discover -s tools/map-extract/tests -v`; `check` doplň o `&& npm run test:py`)

**Interfaces:**
- Produces:
  - `npm run map:extract -- <map.w3x> <label>` vytvoří `data-source/<label>/{input,extract,out}/`. Uvnitř volá `setup_tools.sh "$PWD/xhero/tools"` a `extract_all.sh <map> "$PWD/data-source/<label>" "$PWD/xhero/tools"`.
  - Úkol 4 čte `data-source/<label>/out/heroes.json`, `abilities.json` a `map_info.json`.

- [ ] **Step 1:** Rozbal zip do `tools/map-extract/` a napiš `run.sh` podle Interfaces (`set -euo pipefail`, oba argumenty povinné, chybějící vypíše `usage`).
- [ ] **Step 2: Připrav syntetické fixtury** `tests/fixtures/v1` a `v2`.
  - Jsou to minimální soubory, které vyžaduje `validate_exports.py`: 10 JSON souborů + `file_list.txt`.
  - Obsah je vymyšlený, bez textů z mapy, například hrdina `H001` „Test Hero“ se schopností `A001` (`autocast_class: "nova"`).
  - `v2` se od `v1` liší dvěma věcmi: u `H001` je `str` 10 → 12 a přibyla schopnost `A002`.
- [ ] **Step 3: Napiš testy** (volají skripty přes `subprocess.run([sys.executable, "-I", script, ...])`):
  - `test_validate_ok`: na `v1` vrátí kód 0 a vypíše `OK`.
  - `test_validate_missing_file`: na kopii `v1` bez `heroes.json` vrátí kód 1 a vypíše `missing heroes.json`.
  - `test_diff_reports_change_and_addition`: výstup `diff_exports.py v1 v2` obsahuje `~ H001` se `str: 10 -> 12` a `+ A002`.
  - `test_run_sh_usage`: `run.sh` bez argumentů skončí s kódem ≠ 0 a vypíše `usage`.
- [ ] **Step 4:** Spusť `npm run test:py`. Očekávané: 4 testy projdou.
- [ ] **Step 5:** Ověř toolkit na skutečné mapě (soubor zůstává mimo git):
  - `npm run map:extract -- /home/claude/xhero-data/input/X_Hero_Siege_F-Day_v20.75_AI.w3x v20.75`
  - Očekávané: na konci `OK` a `counts: heroes 44 … abilities 537 … items 117 … recipes 28`.
  - `git status --short` nesmí ukázat nic z `data-source/` ani z `xhero/`.
- [ ] **Step 6:** Spusť `npm run check`. Strážce z úkolu 1 projde.
- [ ] **Step 7: Commit:** `feat(tools): add map extraction toolkit with tests`

### Task 3: Schémata herních dat

**Files:**
- Create: `data/schema/common.ts`, `data/schema/ability.ts`, `data/schema/hero.ts`, `data/schema/constants.ts`, `data/schema/index.ts`
- Test: `data/schema/schema.test.ts`

**Interfaces:**
- Produces (export z `data/schema/index.ts`):
  - `SourceId` = `z.string().regex(/^[A-Za-z0-9]{4}$/)`.
  - `LocalizedText` = `{ en: string(min 1), cs: string(min 1) }`.
  - `Slug` = `/^[a-z][a-z0-9-]*$/`.
  - `AbilityKind` = `z.enum(["projectile","instant","chain","area","line","nova","cone","ticking_area","aura","summon","on_hit","heal","shield"])`.
  - `Targeting` = `z.enum(["nearest","nearest_elite_first","densest_cluster","move_direction","around_self","self","on_attack","low_hp_ally"])`.
  - `AbilitySchema` je diskriminovaná unie podle `kind`. Společná pole:
    - `{ id: Slug, source: SourceId, name: LocalizedText, kind, targeting, levels: int 1–5, cooldown: number[] (každé ≥ 0) }`
    - `review?: { reason: "script" | "engine+script", jassFunctions: string[], notes?: string }`
    - `params`: povinné klíče podle druhu (pole čísel), ostatní klíče jsou volitelná pole čísel (`catchall`).
  - Kontrola `superRefine`: délka `cooldown` i každého pole v `params` musí být `levels`.
  - Povinné parametry podle druhu (aura a on_hit potřebují aspoň jeden z uvedených):

| Druh | Povinné parametry |
|---|---|
| projectile | damage, range |
| instant | damage, range |
| chain | damage, range, bounces |
| area | damage, radius, range |
| line | damage, length, width |
| nova | damage, radius |
| cone | damage, length, endWidth, maxTargets |
| ticking_area | tickDamage, ticksPerSecond, radius, duration |
| aura | aspoň jeden z damageBonus / moveSpeedBonus / attackSpeedBonus |
| summon | count, duration |
| on_hit | aspoň jeden z chance / splashRadius / bonusDamage |
| heal | amount, maxTargets, range |
| shield | duration, radius |

  - `HeroSchema`:
    - `{ id: Slug, source: SourceId, name: LocalizedText, primary: "str"|"agi"|"int", moveSpeed: number>0 }`
    - `attributes: { str|agi|int: { base: number, perLevel: number } }`
    - `baseAttack: { kind: "melee"|"ranged"|"bounce", range: number>0, cooldown: number>0, damageMin: number, damageMax: number }`
    - `signatureAbilities: [Slug, Slug, Slug]`, `ultimate: Slug`
  - `ConstantsSchema` = `{ strHitPointBonus: number, agiAttackSpeedBonus: number, defenseArmor: number, attackSpeedCap: number, mapVersion: string }`.
  - `GameData` = `{ heroes: Hero[], abilities: Ability[], constants: Constants }`.
  - `validateGameData(data: unknown): GameData` vyhodí `GameDataError`, jehož `message` obsahuje každou chybu na řádku `path: message`. Kontroluje schéma, unikátní `id` a to, že `signatureAbilities` i `ultimate` odkazují na existující `ability.id`.

- [ ] **Step 1: Napiš testy** (fixtura: 1 hrdina a 4 kouzla druhů nova, aura, on_hit a summon):
  - `accepts valid game data`
  - `reports path of invalid kind`: chyba obsahuje `abilities.0.kind`.
  - `rejects per-level length mismatch`: `levels: 5` a `cooldown` se 3 prvky dá chybu s `cooldown`.
  - `rejects missing required param`: `nova` bez `radius`.
  - `rejects dangling ability reference`: chyba obsahuje chybějící slug.
  - `rejects duplicate ability id`
- [ ] **Step 2:** Spusť `npx vitest run data/schema`. Očekávané: FAIL (moduly neexistují).
- [ ] **Step 3:** Implementuj schémata podle Interfaces. Unie přes `z.discriminatedUnion("kind", [...])`. Chyby převeď na řádky `issue.path.join(".") + ": " + issue.message`.
- [ ] **Step 4:** Spusť `npx vitest run data/schema` a `npm run check`. Očekávané: PASS.
- [ ] **Step 5: Commit:** `feat(data): add game data schemas`

### Task 4: Designové soubory a data-build pro 4 MVP hrdiny

**Files:**
- Create: `design/heroes.yaml`, `design/abilities.yaml`, `tools/data-build/load.ts`, `tools/data-build/resolve.ts`, `tools/data-build/map-abilities.ts`, `tools/data-build/map-heroes.ts`, `tools/data-build/build.ts`, `tools/data-build/fixtures/` (syntetické exporty)
- Create (vygeneruje se): `data/generated/heroes.json`, `data/generated/abilities.json`, `data/generated/constants.json`
- Test: `tools/data-build/data-build.test.ts`, `data/generated.test.ts`
- Modify: `package.json`, skript `data:build` = `tsx tools/data-build/build.ts`

**Interfaces:**
- Consumes: `validateGameData`, typy `Ability`, `Hero` a `Constants` z úkolu 3. Exporty `data-source/<label>/out/` z úkolu 2.
- Produces:
  - `resolveParam(exp: ExportAbility, spec: ParamSpec, levels: number): number[]` v `resolve.ts`.
    - `ParamSpec` je buď `"DataA"`…`"DataI"` (čte `per_level[i].DataX.value`), nebo `"cooldown" | "area" | "range" | "duration"` (čte `per_level[i].<pole>`), nebo `{ design: number[] }` (hodnoty přímo z designu).
    - Pravidlo pro `null`: na úrovni i > 1 se převezme hodnota úrovně i−1, `null` na úrovni 1 dá 0.
  - `mapAbility(exp, entry): Ability` a `mapHero(exp, entry): Hero`.
  - CLI `npm run data:build -- --source data-source/v20.75/out --out data/generated` zapíše 3 soubory (JSON, odsazení 2, klíče ve stálém pořadí) a skončí `validateGameData`.
- Mapování útoku `weapon_type → baseAttack.kind`: `normal` → melee, `missile`/`msplash`/`mline` → ranged, `mbounce` → bounce.
- Konstanty `map_info.json misc_constants`:
  - `StrHitPointBonus` → `strHitPointBonus`;
  - `AgiAttackSpeedBonus` → `agiAttackSpeedBonus`;
  - `DefenseArmor` → `defenseArmor`;
  - `attackSpeedCap: 6.0` (+600 %, systém ASP_ mapy);
  - `mapVersion: "<label>"`.
  - V exportu jsou hodnoty `misc_constants` řetězce (např. `"15.0"`). Převeď je přes `Number()` a odmítni `NaN` chybou se jménem konstanty.

**`design/heroes.yaml`** (pracovní jména, autor je může později změnit; `mapName` slouží jen k dohledání):

| id | source | mapName | en / cs | signatura (pořadí) | ultimátka |
|---|---|---|---|---|---|
| stonehorn | O00C | Tauren | Stonehorn / Kamenorohý | rock-rupture, cleaving-blows, concussion | earthquake |
| nightglaive | O008 | Daisho | Nightglaive / Noční čepel | hunters-focus, falling-stars, swift-pace | shadow-sisters |
| gravecaller | O00F | UnderTaker | Gravecaller / Hrobník | grave-grasp, skull-ring, soul-bolt | bone-stampede |
| serpent-shaman | O00X | Snaker | Serpent Shaman / Hadí šaman | serpent-totem, forked-bolt, mending-tide | spirit-ward |

**`design/abilities.yaml`** (16 kouzel; parametry podle `ParamSpec`):

| id | source | en / cs | kind | targeting | params |
|---|---|---|---|---|---|
| rock-rupture | A0A7 | Rock Rupture / Skalní zlom | line | move_direction | damage DataC, length DataA, width area, stunSeconds duration |
| cleaving-blows | A0A8 | Cleaving Blows / Drtivé údery | on_hit | on_attack | splashRadius, splashPercent: design z triggeru |
| concussion | A00M | Concussion / Otřes | on_hit | on_attack | chance, stunSeconds, bonusDamage: design z triggeru |
| earthquake | A0AA | Earthquake / Zemětřesení | nova | around_self | damage DataA, radius area |
| hunters-focus | A01A | Hunter's Focus / Soustředění lovce | aura | self | damageBonus DataA |
| falling-stars | A01B | Falling Stars / Padající hvězdy | nova | around_self | damage DataA, radius area, slow DataC, slowSeconds duration |
| swift-pace | A007 | Swift Pace / Rychlý krok | aura | self | moveSpeedBonus DataA, attackSpeedBonus DataB |
| shadow-sisters | A019 | Shadow Sisters / Stínové sestry | summon | self | count DataA, duration duration, damageDealt DataB, damageTaken DataC |
| grave-grasp | A02H | Grave Grasp / Hrobový stisk | area | densest_cluster | radius area, range range, damage: design z triggeru |
| skull-ring | A02K | Skull Ring / Kruh lebek | nova | around_self | damage DataA, radius area |
| soul-bolt | A036 | Soul Bolt / Střela duše | projectile | nearest_elite_first | damage DataA, range range |
| bone-stampede | A037 | Bone Stampede / Kostěné stádo | ticking_area | densest_cluster | tickDamage DataC, ticksPerSecond DataA, radius area, duration duration, hitRadius DataD |
| serpent-totem | A062 | Serpent Totem / Hadí totem | summon | densest_cluster | count DataA, duration duration, range range |
| forked-bolt | A064 | Forked Bolt / Rozvětvený blesk | cone | nearest | damage DataA, maxTargets DataB, length DataC, endWidth DataD |
| mending-tide | A063 | Mending Tide / Hojivý příliv | heal | low_hp_ally | amount DataA, maxTargets DataB, range range |
| spirit-ward | A065 | Spirit Ward / Duchovní ochrana | shield | self | duration duration, radius area |

- `cooldown` se u všech kouzel bere z exportu (`cooldown`).
- Kouzla s `implementation` `engine+script` nebo `script` dostanou `review` s `jassFunctions` z exportu.
- **Parametry „design z triggeru“** (cleaving-blows, concussion, grave-grasp): objektová data mapy jsou u nich nulová nebo zástupná (např. `DataB = 1.0`).
  - Hodnoty přečti z těl funkcí v `review.jassFunctions` v `data-source/v20.75/extract/war3map.j`.
  - Zapiš je jako `{ design: [...] }` a do `review.notes` uveď jména použitých funkcí a odkud hodnoty jsou.
  - Když trigger hodnotu přímo neobsahuje, napiš to do `review.notes` a dej `0`. Nic si nevymýšlej.

- [ ] **Step 1: Napiš testy `data-build.test.ts`** se syntetickými fixturami v podobě exportu (žádné texty z mapy):
  - `resolves DataX per level with null carry-forward`: `[100, null, 300]` dá `[100, 100, 300]`.
  - `maps a nova ability`: očekává se přesný objekt `Ability`.
  - `maps weapon_type mbounce to bounce`
  - `fails with readable error when source id is missing`: zpráva obsahuje `design/heroes.yaml`, slug a chybějící kód.
  - `rejects unknown param source`: `"DataZ"` dá chybu se slugem a klíčem parametru.
- [ ] **Step 2:** Spusť `npx vitest run tools/data-build`. Očekávané: FAIL.
- [ ] **Step 3:** Implementuj `load.ts` (JSON a YAML přes `yaml`), `resolve.ts`, `map-abilities.ts`, `map-heroes.ts` a `build.ts` podle Interfaces.
- [ ] **Step 4:** Spusť `npx vitest run tools/data-build`. Očekávané: PASS.
- [ ] **Step 5:** Napiš oba YAML podle tabulek a parametry „design z triggeru“ doplň podle pravidla výše.
- [ ] **Step 6:** Vygeneruj data: `npm run data:build -- --source data-source/v20.75/out --out data/generated`. Očekávané:
  - vzniknou 3 soubory se 4 hrdiny a 16 kouzly;
  - `rock-rupture.params.damage = [500, 1000, 2000, 3500, 5000]`;
  - `earthquake.cooldown = [40, 20]`;
  - `constants.strHitPointBonus = 15`.
- [ ] **Step 7: Napiš `data/generated.test.ts`.**
  - `validateGameData` projde na commitnutých souborech.
  - Strážce: žádný klíč `tooltip`, `ubertip`, `tip` ani `description` a žádný řetězec `TRIGSTR`.
  - Ověření strážce: dočasně přidej `"tip": "x"` do jednoho kouzla. Test musí selhat. Úpravu pak vrať.
- [ ] **Step 8:** Spusť `npm run check`. Očekávané: PASS.
- [ ] **Step 9: Commit:** `feat(data): add design files, data-build and generated MVP hero data`

### Task 5: Technický test davu (spike)

**Files:**
- Create: `assets/models/robot-expressive/RobotExpressive.glb`, `assets/LICENSES.md`, `client/spike/index.html`, `client/spike/main.ts`, `client/spike/bake-vat.ts`, `client/spike/crowd.ts`, `client/spike/spatial-hash.ts`, `client/spike/frame-stats.ts`, `client/spike/overlay.ts`
- Test: `client/spike/spatial-hash.test.ts`, `client/spike/frame-stats.test.ts`
- Modify: `vite.config.ts` (vstup `spike: client/spike/index.html`)

**Interfaces:**
- Produces:
  - `class SpatialHash`:
    - `constructor(cellSize: number, capacity: number)`
    - `clear(): void`
    - `insert(id: number, x: number, y: number): void`
    - `query(x: number, y: number, radius: number, out: Int32Array): number` vrátí počet nalezených id zapsaných do `out`.
    - Pole se alokují jen v konstruktoru.
  - `frameStats(durationsMs: Float32Array, count: number): { avgFps: number; low1Fps: number }`:
    - `avgFps = 1000 / průměr`;
    - `low1Fps = 1000 / 99. percentil`.
  - `bakeVat(gltf, clipNames: string[], fps: number): { geometry: BufferGeometry; texture: DataTexture; clips: Record<string, { startRow: number; rows: number }> }`
  - `window.__spike = { backend: "WebGPU" | "WebGL2", n: number, frames: number, avgFps: number, low1Fps: number }` se obnovuje každý snímek. Spoléhá na něj úkol 6.
- Parametry URL:
  - `n`: výchozí 150, oříznuté na 1–2000;
  - `renderer=webgpu|webgl2`: výchozí webgpu; webgl2 znamená `new WebGPURenderer({ forceWebGL: true })`;
  - `seed`: výchozí 1.
- Backend se čte z `renderer.backend.isWebGPUBackend`.

- [ ] **Step 1: Stáhni model a zapiš licenci.**
  - Odkud: `curl -fsSLo assets/models/robot-expressive/RobotExpressive.glb https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb`
  - Do `assets/LICENSES.md` zapiš řádek: RobotExpressive, Tomás Laulhé (Quaternius), úpravy Don McCurdy, CC0 1.0, zdrojová URL, datum a sha256.
- [ ] **Step 2: Napiš testy:**
  - `spatial hash returns exactly the brute-force neighbours`: 1000 bodů se seedovaným RNG, 50 dotazů porovnaných s hrubou silou.
  - `spatial hash keeps capacity`: 100× `clear()` a `insert` všech bodů; reference vnitřních polí se nezmění.
  - `frameStats of constant 16.667 ms is 60/60`: tolerance 0,1.
  - `frameStats low1 reflects spikes`: 99 × 10 ms + 1 × 100 ms dá `low1Fps ≈ 10`.
- [ ] **Step 3:** Spusť `npx vitest run client/spike`. Očekávané: FAIL.
- [ ] **Step 4:** Implementuj `spatial-hash.ts` (buňky v typovaných polích, řetězení přes `next: Int32Array`) a `frame-stats.ts` (kruhový buffer posledních 120 snímků v `overlay.ts`).
- [ ] **Step 5:** Spusť `npx vitest run client/spike`. Očekávané: PASS.
- [ ] **Step 6: Implementuj `bake-vat.ts`.**
  - Zapékání proběhne v prohlížeči po načtení modelu (GLTFLoader).
  - Skinned meshe modelu se sloučí do jedné geometrie s atributem indexu vrcholu.
  - Pro klipy `Walking` a `Running` se vzorkuje 30 snímků za sekundu. Pozice vrcholů z `SkinnedMesh.getVertexPosition` se zapíšou do `DataTexture` (RGBA, `FloatType`, šířka = počet vrcholů, řádek = snímek).
- [ ] **Step 7: Implementuj `crowd.ts`.**
  - Vykreslení:
    - `InstancedMesh` s `MeshStandardNodeMaterial`;
    - `positionNode` čte VAT přes `textureLoad` na souřadnicích (index vrcholu, řádek klipu + snímek z času a instančního atributu `phase`);
    - normály zůstávají z výchozí pózy.
  - Pohyb:
    - jednotky jdou ke středu arény a po dosažení cíle dostanou nový náhodný cíl (seedované RNG);
    - separaci řeší `SpatialHash` (poloměr 1,2 × velikost jednotky);
    - matice instancí se zapisují do předalokovaného bufferu;
    - během snímku se nic nealokuje.
- [ ] **Step 8: Implementuj `main.ts` a `overlay.ts`.**
  - Scéna:
    - podlaha 200 × 200;
    - kamera s náklonem 55° a perspektivou s FOV 35°;
    - směrové a ambientní světlo.
  - Overlay vpravo nahoře ukazuje `backend`, `n`, `avg fps` a `1% low` a `window.__spike` se obnovuje každý snímek.
  - Chyba inicializace se ukáže v overlayi textem „Chyba: …“ a vypíše se přes `console.error`.
- [ ] **Step 9: Ověř spike ručně** (headless Chrome z kontejneru přes `node` skript s `playwright`, mimo repozitář):
  - `npm run build && npx vite preview`;
  - otevři `/spike/?n=150` a pořiď screenshot;
  - ověř, že `__spike.frames` roste a že na obrázku jsou postavy.
- [ ] **Step 10:** Spusť `npm run check && npm run build`. Očekávané: PASS.
- [ ] **Step 11: Commit:** `feat(client): add instanced crowd spike with baked animation`

### Task 6: E2E testy, CI a GitHub Pages

**Files:**
- Create: `playwright.config.ts`, `e2e/spike.spec.ts`, `.github/workflows/ci.yml`, `.github/workflows/pages.yml`
- Modify: `package.json` (skript `e2e` = `playwright test`)

**Interfaces:**
- Consumes: `window.__spike` z úkolu 5.
- `playwright.config.ts`:
  - `webServer: { command: "npm run build && npx vite preview --port 4173 --strictPort", url: "http://localhost:4173" }`;
  - `executablePath` z proměnné `PW_CHROMIUM_PATH`, když je nastavená;
  - projekty:
    - `webgl2-fallback`: výchozí headless Chromium, bez adaptéru WebGPU;
    - `webgpu-swiftshader`: argumenty `--enable-unsafe-webgpu --enable-unsafe-swiftshader --enable-features=Vulkan --use-vulkan=swiftshader --use-angle=swiftshader`.
- `pages.yml`: při push do `main` spustí build s `BASE_PATH=/defense-webgame/`, pak `actions/upload-pages-artifact` a `actions/deploy-pages`.
- `ci.yml`: při push i pull requestu na ubuntu-latest s Node 22 spustí:
  - `npm ci`, `npm run typecheck`, `npm test`, `npm run test:py`;
  - `npx playwright install --with-deps chromium` a `npm run e2e`;
  - nakonec nahraje `playwright-report` jako artefakt.

- [ ] **Step 1: Napiš `e2e/spike.spec.ts`.** Čeká se, až `__spike.frames > 30`, s časovým limitem 90 s:
  - `renders crowd on available backend`:
    - v projektu `webgpu-swiftshader` je `backend` WebGPU, v `webgl2-fallback` WebGL2;
    - screenshot canvasu má směrodatnou odchylku jasu > 5 (scéna není prázdná);
    - během testu není žádný `console.error`.
  - `forced webgl2 uses WebGL2`: `/spike/?renderer=webgl2` dá `backend` WebGL2 v obou projektech.
  - `n=600 frames advance`: `/spike/?n=600`; `frames` po 10 s je větší než před nimi.
- [ ] **Step 2:** Spusť `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npm run e2e`. Očekávané: všechny testy projdou v obou projektech.
- [ ] **Step 3:** Napiš `ci.yml` a `pages.yml` podle Interfaces. Pak lokálně simuluj CI v pořadí z `ci.yml`, bez instalace Playwrightu: `npm ci && npm run typecheck && npm test && npm run test:py`. Očekávané: PASS.
- [ ] **Step 4:** Doplň `README.md` o příkaz `npm run e2e` a o proměnnou `PW_CHROMIUM_PATH`.
- [ ] **Step 5: Commit:** `ci: add e2e tests, CI and GitHub Pages deploy`

### Task 7: Push a převzetí fáze 0 (s Petrem)

Není to úkol pro agenta. Je to kontrolní bod s autorem.

- [ ] **Step 1:** Petr přidá přístup: nainstaluje Claude GitHub App na `Wizzik/defense-webgame`, nebo znovu propojí GitHub v claude.ai.
- [ ] **Step 2:** Petr zapne GitHub Pages: Settings → Pages → Source: GitHub Actions.
- [ ] **Step 3:** Push na GitHub: `git push -u origin main`, pak `git push -u origin phase-0` a otevření pull requestu `phase-0 → main`.
  - Když GitHub odmítne soubory v `.github/workflows/` kvůli chybějícímu oprávnění `workflows`, Petr ho přidá aplikaci nebo vloží oba soubory ručně přes web.
- [ ] **Step 4:** CI na pull requestu je zelené, včetně e2e v obou projektech.
- [ ] **Step 5:** Po sloučení do `main` je spike dostupný na `https://wizzik.github.io/defense-webgame/spike/`.
- [ ] **Step 6: Petr změří výkon na notebooku** a pošle hodnoty `avg fps` a `1% low` z overlaye:

| renderer | n=150 | n=300 | n=600 |
|---|---|---|---|
| webgpu | | | |
| webgl2 | | | |

  - **Fáze 0 je převzatá, když:** WebGPU i WebGL2 mají při `n=150` `avg fps` ≥ 60.
  - Když ne, otevře se úkol na optimalizaci (LOD, nižší frekvence animace, menší VAT) před fází 1.

Po převzetí: skill „pravidla vývoje hry“ zachytí skutečné příkazy a konvence z `AGENTS.md` a pak vznikne plán fáze 1 (vertikální řez).
