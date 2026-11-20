# Frakce nepřátel podle fází: prováděcí plán

> **Pro agenty:** POVINNÝ PODSKILL: superpowers:executing-plans (Petr volí nativní provedení) nebo superpowers:subagent-driven-development. Kroky mají zaškrtávací políčka (`- [ ]`).

**Cíl:** Čtyři frakce po pěti fázích (lidé, orkové, nemrtví, elfové), každá nová se 4 typy, elitou a jednou vlastní mechanikou (krvežíznivost, síť a jedovatý mrak a zvedání mrtvých, kořeny), s vlastním vzhledem, zvukem a ohlášením.

**Architektura:** Frakce jsou data: `rules.factions` (od které fáze, elita, těžký typ) a pole `faction` u typu. Simulace z nich odvodí elitu fáze a jednotky nájezdu. Každá mechanika je samostatný soubor v `sim/` volaný z `updateEnemies` nebo `Run.step`, se stavem v typovaných polích (bez alokace). Klient čte nové události a pole `window.__game`.

**Technologie:** TypeScript, Vitest, zod (`data/schema`), Three.js (WebGPU / WebGL2), Playwright, `tools/assets-build` (KayKit CC0).

**Spec:** `docs/superpowers/specs/2026-11-20-enemy-factions-design.md` (čti ho celý; čísla jsou tam).

## Globální omezení

- `AGENTS.md`: `sim/` a `meta/` čisté a deterministické; žádné `Math.random`, trigonometrie, `**`; `Run.step()` nealokuje; jména a kódy z mapy (`ogru`, `Grunt`, `Tauren`, …) jen v `design/` a `docs/`.
- Nové typy na **konec** `design/enemies.yaml`; štítonoš zůstává první.
- Jména a texty EN i CS, vlastní (tabulka spec 4.1, zprávy spec 4.7).
- Bez oranžové v paletách (Petr).
- `npm run check` před každým commitem; Conventional Commits; identita `Claude <noreply@anthropic.com>` a trailery sezení.
- Data: `design/*.yaml` → `npm run data:build -- --source data-source/v20.75/out --out data/generated`. Export mapy chybí v čerstvém klonu: stáhni mapu z projektu claude.ai (`Projects` `project_read` s `original: true` na `X_Hero_Siege_F-Day_v20.75_AI.w3x`) a spusť `npm run map:extract -- <cesta> v20.75` (viz `tools/map-extract/README.md`). Nikdy ji necommituj.
- Model nepřítele ≤ 3000 trojúhelníků a ≤ 700 kB; celkový strop modelů nejvýš 10 MB (spec 4.6).

## Na co se zaměřit při kontrole

1. **Start ve fázi frakce** (`?debug=1&phase=11`): elita, nájezd i zpráva musí být nemrtvé, ne lidské. Test v Úkolu 1.
2. **Kostivlád u stropu `maxAlive`**: zvedání nesmí vyhodit bossa ani vyrobit kostlivce, když není místo. Test v Úkolu 5.
3. **Spoutání během úskoku a s botami**: kořeny zastaví i probíhající úskok; síť a boty platí současně a po skončení se rychlost vrátí přesně. Testy v Úkolech 3 a 4.
4. **Zvednutý nepřítel nedává nic**: 0 XP, 0 zlata, žádné srdíčko, nepočítá se do míst smrti (žádná řetězová farma). Test v Úkolu 5.
5. **Štít Spirit Ward a mrak**: v mraku pod štítem hrdina neztrácí hp. Test v Úkolu 4.

---

### Úkol 1: Data frakcí, typy a elity a nájezdy podle frakce

Žádná nová mechanika; nové typy chodí na dnešních chováních.

**Soubory:**
- Upravit: `data/schema/enemy.ts`, `data/schema/rules.ts`, `data/schema/schema.test.ts`
- Upravit: `design/enemies.yaml` (14 nových typů, spec 4.1), `design/rules.yaml` (`factions`, fáze 6–20, nájezdy)
- Upravit: `tools/data-build/map-enemies.ts` (nová pole projdou do dat), `data/generated/*` (vygenerovat)
- Vytvořit: `sim/factions.ts`, `sim/factions.test.ts`
- Upravit: `sim/run.ts`, `sim/spawner.ts`, `sim/timeline.ts`, `sim/combat.ts` (srdíčko elity), `sim/enemy-aura.ts`, `sim/events.ts`, `sim/hash.ts`, `sim/spawner.test.ts`, `sim/timeline.test.ts`

**Rozhraní:**
- Schéma typu: `faction?: "human" | "orc" | "undead" | "elf"` (boss bez), `xp: int ≥ 0` (dnes kladné; `risen` má 0), `knockbackScale?: number ≥ 0` (výchozí 1).
- Schéma pravidel: `rules.factions: { id, name: LocalizedText, fromPhase: int (1-based), elite: Slug, heavy: Slug }[]` vzestupně podle `fromPhase`, první od fáze 1; `rules.enemies.elite` zmizí. Nájezd: `{ atSeconds, kind: "rush", elites: int, heavies: int }` (dnešní `units` zmizí; 3:00 = 2 + 3, 6:00 = 4 + 6, 9:00 = 5 + 8, 12:00 = 6 + 10, 15:00 = 8 + 12).
- `sim/factions.ts`: `factionIndexOfPhase(rules, phaseIndex: number): number` (0-based fáze; fáze 21 = finále má frakci fáze 20); `run.factionIndex: number` (frakce aktuální fáze), `run.eliteTypes: Int32Array` a `run.heavyTypes: Int32Array` (index typu podle frakce), `run.isElite: Uint8Array` (podle typu; nahradí `run.eliteType`).
- `run.auraType` nahradí `run.hasAura: Uint8Array` podle typu (aura kapitána, vůdce i Dread Regenta; nositelé aury se nebuffují navzájem jako dnes).
- `EventKind.Faction`: a = index frakce, value = fáze (1-based); vyšle se v kroku, kdy se `run.factionIndex` změní, a v prvním kroku běhu, který startuje ve fázi > 5 (`applyStartPhase`).
- Knockback v `combat.ts` násobí rychlost `knockbackScale` typu (0 = nepohne se).

- [ ] **Krok 1: Změř výchozí stav na `main`.** `npm run sim:run -- --hero all --seeds 1-20` a totéž s `--gear mid`; ulož si výhry na hrdinu a ztráty podle času (potřebuje je Úkol 8). Výstup dej do zprávy commitu Úkolu 8, ne do souboru.
- [ ] **Krok 2: Napiš padající testy** v `sim/factions.test.ts`:
  - `factionIndexOfPhase` vrátí 0 pro fáze 0–4, 1 pro 5–9, 2 pro 10–14, 3 pro 15–19 a 3 pro finále (index 20);
  - běh startující fází 11 (`applyStartPhase(run, 11)`) pošle v první smečce s elitami `bone-tyrant`, ne `captain`;
  - nájezd v 9:00 (`atSeconds 540`) zplodí 5× `bone-tyrant` a 8× `rotgut`; nájezd ve 3:00 2× `captain` a 3× `lancer`;
  - `EventKind.Faction` přijde přesně jednou v kroku přechodu z fáze 5 na 6 s a = 1;
  - typ s `knockbackScale: 0` se po zásahu nepohne.
  Uprav dnešní testy spawneru a timeline, které čtou `rules.enemies.elite` nebo `units`.
- [ ] **Krok 3: Spusť** `npx vitest run sim/factions.test.ts` – očekávej FAIL (chybí modul).
- [ ] **Krok 4: Schéma a design.** Přidej 14 typů ze spec 4.1 (`source` podle tabulky, `mapName` do komentáře jako dnes, `faction`, `behavior`, `xp`, `gold`, `multipliers` jako výchozí odhad podle protějšku role; `risen` `xp: 0`, `gold: 0`; elity `hunter: true`, `warlord` s `aura` a `charge` jako kapitán, `grove-warden` s `charge`; `stone-warden` a elity `knockbackScale` 0.3). Druid dostane `heal` jako kaplan. Dnešním lidským typům přidej `faction: human`. Fáze 6–20 v `rules.yaml` přepiš na typy frakce (váhy: pěšák 4, střelec 3, těžký 3, kouzelník 2, u orků a elfů navíc ten druhý rychlý typ podle tabulky; `risen` nikdy v `mix`). Ostatní hodnoty fází beze změny.
- [ ] **Krok 5: Vygeneruj data** (`npm run data:build …`), zkontroluj `npm run audio:build` (nové typy zatím bez zvuku: pokud validace žádá řádek v `enemyCues`, přidej jim dočasně `bone-rattle`; Úkol 7 je přepíše).
- [ ] **Krok 6: Implementuj `sim/factions.ts`** a napoj spawner (elita fáze = `run.eliteTypes[run.factionIndex]`), timeline (nájezd: frakce fáze v čase nájezdu), `combat.ts` (srdíčko elity přes `isElite`), auru (`hasAura`) a knockback. `run.factionIndex` se přepočítá tam, kde se dnes mění `phaseIndex`. Hash zahrne `factionIndex`.
- [ ] **Krok 7: Spusť** `npm run check` – očekávej PASS (všechny testy, i dnešní).
- [ ] **Krok 8: Commit** `feat(factions): faction data, elites and rushes by faction`.

### Úkol 2: Krvežíznivost (orkové)

**Soubory:**
- Vytvořit: `sim/enemy-bloodlust.ts`, `sim/enemy-bloodlust.test.ts`
- Upravit: `data/schema/enemy.ts`, `design/enemies.yaml` (`bloodcaller`), `sim/enemies.ts`, `sim/enemy-ai.ts`, `sim/events.ts`, `sim/hash.ts`, `data/generated/*`

**Rozhraní:**
- Schéma: `bloodlust?: { cooldownSeconds, targets: int, range, seconds, moveSpeed, damage, attackSpeed }` (výchozí 6, 3, 450, 8, 0.3, 0.3, 0.3).
- Úložiště: `bloodlustTicks: Int32Array`, `bloodlustCooldown: Int32Array` (nulují se při `spawn`).
- `updateBloodlust(run: Run): void` volaná v `updateEnemies` hned po `updateEnemyAuras`. Cíle: živí nepřátelé stejné frakce jako sesilatel, ne bossové, ne sesilatel, bez běžící krvežíznivosti, nejbližší napřed (přes `run.grid`, bez alokace). Bez cíle se cooldown nespustí.
- V `enemy-ai.ts`: pohyb × (1 + moveSpeed), poškození × (1 + damage), prodleva útoku ÷ (1 + attackSpeed) po dobu `bloodlustTicks > 0`; násobí se s aurou.
- `EventKind.Bloodlust`: a = slot sesilatele, value = počet posílených, x/y = sesilatel. Pro klienta: `run.enemies.bloodlustTicks` se čte přímo.

- [ ] **Krok 1: Padající testy:** šaman se 4 orky v dosahu posílí 3 nejbližší na 8 s (240 kroků) a za 6 s znovu ty, kterým účinek doběhl; člověk ani boss v dosahu posílen není; posílený grunt jde o 30 % rychleji a útočí po prodlevě ÷ 1.3 (zaokrouhleno jako dnešní prodleva); se šamanem bez cílů zůstane cooldown 0; dva běhy se stejným seedem mají stejný hash.
- [ ] **Krok 2: Spusť** `npx vitest run sim/enemy-bloodlust.test.ts` – FAIL.
- [ ] **Krok 3: Implementuj** schéma, data, úložiště a `updateBloodlust`.
- [ ] **Krok 4:** `npm run check` – PASS.
- [ ] **Krok 5: Commit** `feat(factions): the Bloodcaller's bloodlust`.

### Úkol 3: Síť pavučináře a kořeny druida (stavy hrdiny)

**Soubory:**
- Vytvořit: `sim/hero-snares.ts`, `sim/hero-snares.test.ts`
- Upravit: `data/schema/enemy.ts`, `design/enemies.yaml` (`webcrawler`, `grove-druid`, `grove-warden`), `sim/world.ts`, `sim/run.ts`, `sim/hero.ts`, `sim/enemy-ai.ts`, `sim/enemy-strike.ts`, `sim/spawner.ts`, `sim/events.ts`, `sim/hash.ts`, `data/generated/*`

**Rozhraní:**
- Schéma: `web?: { slow: number (0–1), seconds }` (0.3, 2); `strike` dostane `effect: "damage" | "root"` (výchozí `damage`), `damage` je povinné jen pro `damage`, `rootSeconds` povinné pro `root`. Druid: `strike { minRange 400, maxRange 900, radius 160, windupSeconds 1, cooldownSeconds 9, leap false, effect root, rootSeconds 1.2 }`; strážce háje totéž s `minRange 300`, `cooldownSeconds 6`.
- Hrdina (`HeroState`): `slowTicks`, `slowShare`, `rootTicks`.
- `sim/hero-snares.ts`: `slowHero(run, share, ticks)`, `rootHero(run, ticks)` (obnoví, nesčítá; delší čas vyhrává), `tickSnares(run)` (odečte, volá se v `Run.step` před `moveHero`), `snareSpeedScale(hero): number` (1 − slowShare, nebo 1).
- `moveHero`: při `rootTicks > 0` se hrdina nehýbe a probíhající úskok skončí (`dashTicks = 0`); `applyActions` úskok nezačne. Rychlost chůze × `snareSpeedScale`; úskok rychlost nemění. `speedScale` orbu zůstává zvlášť.
- Útok `enemy-ai.ts`: zásah hrdiny typem s `web` zavolá `slowHero`. Strike s `effect: root` po výstraze zavolá `rootHero` u hrdiny v kruhu, hrad nezasáhne, nezraňuje.
- Spawner nastaví `strikeCooldown` nově zplozeného typu se `strike` na jeho cooldown (dnes to dělá jen `spawnBoss`).
- `EventKind.HeroSnared`: value = 0 síť / 1 kořeny, u = sekundy; slam událost výstrahy zůstává (klient barvu odvodí z `effect` typu).

- [ ] **Krok 1: Padající testy:** zásah pavučináře zpomalí hrdinu na 70 % na 60 kroků, druhý zásah obnoví čas a nesčítá; s botami (orb) i sítí jde hrdina rychlostí × boty × 0.7 a po síti přesně × boty; kořeny v kruhu: 36 kroků bez pohybu i bez úskoku, probíhající úskok skončí; hrdina mimo kruh spoután není; kořeny nezraňují hrdinu ani hrad; čerstvě zplozený druid nesešle kořeny dřív než po 9 s.
- [ ] **Krok 2:** `npx vitest run sim/hero-snares.test.ts` – FAIL.
- [ ] **Krok 3: Implementuj.**
- [ ] **Krok 4:** `npm run check` – PASS.
- [ ] **Krok 5: Commit** `feat(factions): web slow and roots on the hero`.

### Úkol 4: Jedovatý mrak hniláka

**Soubory:**
- Vytvořit: `sim/enemy-cloud.ts`, `sim/enemy-cloud.test.ts`
- Upravit: `data/schema/enemy.ts`, `design/enemies.yaml` (`rotgut` 220, `bone-tyrant` 350), `sim/run.ts`, `sim/world.ts` (statistika), `data/generated/*`

**Rozhraní:**
- Schéma: `cloud?: { radius, hpSharePerSecond }` (`hpSharePerSecond` 0.01: `damageHero` ho násobí `heroDamageScale`, takže běžný hrdina ztrácí 2 % max hp za sekundu, jak chce spec).
- `updateClouds(run: Run): void` v `Run.step` hned po `updateEnemies`: hrdina, který je uvnitř aspoň jednoho mraku (víc mraků se nesčítá), dostane `damageHero(run, share × maxHp / TICKS_PER_SECOND, slot)`; brnění se nepoužije; štít Spirit Ward chrání (dělá to `damageHero`). Padlý hrdina nic.
- `run.stats.cloudDamage` sčítá ztrátu (pro `sim:run`).

- [ ] **Krok 1: Padající testy:** hrdina 100 od hniláka ztratí za 30 kroků přesně `0.01 × maxHp × heroDamageScale(run)`; ve dvou překrytých mracích ztratí stejně; ve 300 od hniláka nic; pod štítem nic; hrad nic.
- [ ] **Krok 2:** FAIL. **Krok 3:** implementuj. **Krok 4:** `npm run check` PASS.
- [ ] **Krok 5: Commit** `feat(factions): the Rotgut's poison cloud`.

### Úkol 5: Kostivlád zvedá padlé

**Soubory:**
- Vytvořit: `sim/corpses.ts`, `sim/enemy-raise.ts`, `sim/enemy-raise.test.ts`
- Upravit: `data/schema/enemy.ts`, `design/enemies.yaml` (`gravebinder`), `sim/combat.ts` (`killEnemy`, srdíčko), `sim/enemies.ts`, `sim/enemy-ai.ts`, `sim/run.ts`, `sim/events.ts`, `sim/hash.ts`, `data/generated/*`

**Rozhraní:**
- Schéma: `raise?: { type: Slug, cooldownSeconds, count: int, range, maxAgeSeconds }` (`risen`, 5, 2, 500, 10).
- `class CorpseRing` (kapacita 64, `x`, `y`, `tick` jako `Float64Array`/`Int32Array`, `record(x, y, tick)`, `take(cx, cy, range, minTick): number` vrátí index nejbližšího a smaže ho, −1 když nic). `run.corpses`.
- `killEnemy` zaznamená místo jen u typu, který není boss, elita ani má `xp: 0`. Typ s `xp: 0` nepouští srdíčko (ani krystal ani minci).
- Úložiště: `raiseCooldown: Int32Array`.
- `updateRaise(run)` z `updateEnemies`: kostivlád s nulovým cooldownem zvedne až `count` kostlivců z míst smrti mladších než `maxAgeSeconds` do `range`; každý přes `spawnAt(run, type, role, x, y): number` (nová funkce ve `sim/spawner.ts`, sdílí kód s `spawnBoss` pro škálování `timeScale`; vrací −1, když je úložiště plné; **nikdy nevyhazuje** jiného nepřítele). Cooldown se spustí jen, když vstal aspoň jeden.
- `EventKind.Raise`: a = nový slot, x/y = místo. `run.stats.raised`.

- [ ] **Krok 1: Padající testy:** 3 mrtví do 500 před 2 s → po kroku vstanou 2 `risen` na jejich místech a třetí místo zůstane; místo staré 11 s se nepoužije; smrt `risen` ani elity se nezaznamená; zabitý `risen` nedá XP, zlato ani srdíčko; při plném úložišti nevstane nikdo a nikdo nezmizí; deterministický hash.
- [ ] **Krok 2:** FAIL. **Krok 3:** implementuj. **Krok 4:** `npm run check` PASS.
- [ ] **Krok 5: Commit** `feat(factions): the Gravebinder raises the fallen`.

### Úkol 6: Modely a palety frakcí

**Soubory:**
- Upravit: `tools/assets-build/manifest.ts`, `tools/assets-build/build.ts`, `tests/assets.test.ts`, `assets/models/enemies/*.glb`, `assets/LICENSES.md`
- Upravit: `client/render/enemy-tints.ts`, `client/render/enemy-tints.test.ts`, `client/render/models.ts` (pokud vyjmenovává id), `client/render/models.test.ts`

**Rozhraní:**
- `EnemyRow` dostane zdroj těla (`adv` nebo `skel`), aby lidé, orkové a elfové mohli brát těla Adventurers (Knight, Barbarian, Rogue, Rogue_Hooded, Mage) a zbraně z jejich `Assets/gltf`; nemrtví zůstanou u Skeletons. Ke každému typu spec 4.6 řádek; `warlord` smí sdílet model se `brute` přes `model` jen při stejném těle a zbrani (spec 4.6).
- Animace: build převzorkuje nebo kvantizuje klipy nepřátel (`Idle`, `Punch`, `Walking`) tak, aby jeden model nepřítele klesl zřetelně pod dnešních ~280 kB; kontroluj, že pohyb zůstane plynulý (snímky). Strop v `tests/assets.test.ts` zvedni jen tolik, kolik je třeba, nejvýš na 10 MB.
- Palety (`ENEMY_TINTS`): lidé ocelově modrá a šedá, orkové tmavě zelená a hnědá, nemrtví kostní bílá a zelenavá, elfové modrofialová a tyrkysová; typy jedné frakce se liší odstínem. Žádná oranžová: test zkontroluje, že HSL odstín žádné barvy nového typu neleží v 20°–45°.

- [ ] **Krok 1: Padající testy:** `tests/assets.test.ts` vyžaduje model pro každý typ, který nemá `model` (14 nových); test palety (odstín mimo 20°–45° pro všechny typy kromě dnešních bossů).
- [ ] **Krok 2:** FAIL. **Krok 3:** `npm run assets:fetch`, úprava manifestu a buildu, `npm run assets:build`. Pokud zbraň nejde vyříznout, vezmi nejbližší a zapiš to do `docs/DECISIONS.md` (Úkol 8).
- [ ] **Krok 4:** `npm run check` PASS; `npm run shots` a prohlédni `types`, `fight` a hrdiny vedle nepřátel (nepřítel se od hrdiny liší barvou a je menší).
- [ ] **Krok 5: Commit** `feat(factions): faction models and palettes`.

### Úkol 7: Klient: ohlášení, efekty mechanik, zvuky, ladění

**Soubory:**
- Upravit: `client/ui/announcer.ts` (+ test), `client/ui/messages-cs.ts` a anglické zprávy, `client/ui/buff-bar.ts` (+ test), `client/render/enemy-crowd.ts`, `client/render/enemy-fx.ts`, `client/render/effects.ts` (nebo nové `client/render/fx/*` podle dnešního vzoru), `client/game/*` (napojení událostí, `window.__game`, debug), `design/audio.yaml`, `data/generated/audio.json`
- Upravit: `e2e/*` (nový test), skript snímků (`factions`), `AGENTS.md` (nové parametry a pole)

**Rozhraní a chování (spec 4.2–4.7, 4.11):**
- `EventKind.Faction` → zpráva v HUD (texty spec 4.7) a zvuk `war-horn`; když ve stejném kroku přijde boss, zpráva frakce čeká, až zpráva bosse doběhne.
- Krvežíznivost: posílený nepřítel žhne rudě po celou dobu (`bloodlustTicks > 0`, emise v `enemy-crowd`; nová atribut instance nebo stávající cesta záblesku zásahu, bez alokace za snímek); záblesk nad šamanem při `EventKind.Bloodlust`.
- Síť a kořeny: buňky `web` a `root` v řádce účinků (sekundy), síť pod hrdinou, kořeny kolem nohou; kruh výstrahy kořenů zelený (bossové dál rudý).
- Mrak: trvalý zelenošedý kruh na zemi kolem každého hniláka a tyrana (poloměr z dat).
- Zvednutí: zelený záblesk na místě `EventKind.Raise`.
- Zvuky (`design/audio.yaml`): smrt podle frakce z existujících souborů (`enemyCues`), cue pro `enemy.bloodlust`, `hero.web`, `enemy.root` (výstraha), `hero.root`, `enemy.raise`; když vhodný soubor chybí, vezmi nejbližší a zapiš to. `npm run audio:build` musí projít.
- `window.__game`: `faction` (id), `slowed`, `rooted` (sekundy). `debug.spawnEach()` zplodí typy **aktuální** frakce (bez `risen`); `debug.spawnFaction(id)` po jednom každého typu frakce, `Error` pro neznámé id.
- Snímek `factions`: hrdina a po jednom typu z každé frakce (paleta a velikost čitelné na 1280×720). e2e: `?debug=1&phase=6` → `__game.faction === "orc"`, zpráva frakce viditelná, `enemyTypes` obsahuje orky.

- [ ] **Krok 1: Padající testy:** announcer odloží zprávu frakce za zprávu bosse; buff-bar vypíše `web` a `root` se sekundami v EN i CS; e2e popsaný výše.
- [ ] **Krok 2:** FAIL. **Krok 3:** implementuj. **Krok 4:** `npm run check`, `npm run build`, `npx playwright test --project=webgl2-fallback` PASS; `npm run shots` a prohlédni `factions`.
- [ ] **Krok 5: Commit** `feat(factions): faction news, mechanic effects and sounds`.

### Úkol 8: Autopilot, balanc a dokumentace

**Soubory:**
- Upravit: `sim/bot.ts`, `sim/bot.test.ts`, `tools/sim-run/*` (výpis), `design/enemies.yaml`, `design/rules.yaml`, `data/generated/*`
- Upravit: `docs/DECISIONS.md` (nová sekce Enemy factions + co-op poznámka ze spec 7), `docs/STATUS.md`, `ARCHITECTURE.md`

**Chování:**
- Bot: kořeny opouští jako slam (ověř, že kruh kořenů je ve slam polích a bot ho vidí); v mraku nestojí (cíl hniláka napadá z okraje: zastaví se na `cloud.radius + 30` u melee, nebo zvolí jiný cíl); typy s `bloodlust` nebo `raise` jsou přednostní cíl v `CHASE_DISTANCE`.
- `sim:run` vypíše na hrdinu průměr spoutání za běh, hp ztracené v mraku a počet zvednutých.
- Balanc (spec 4.9): výhry na hrdinu ±3 proti měření z Úkolu 1 (seedy 1–20, bez výbavy i `--gear mid`), ztráty se neshlukují do 50 s po začátku frakce (5:00–6:00, 9:10–10:10, 13:20–14:20). Ladí se `multipliers` nových typů, hodnoty mechanik a počty nájezdu v 9:00. Kontrola na seedech 21–40.
- Fps: `?fps=1&debug=1&phase=16` s plnou smečkou – zapiš do STATUS jako bod, který Petr ověří na svém stroji.

- [ ] **Krok 1: Padající testy bota:** hrdina ve výstraze kořenů z ní vykročí; melee hrdina s cílem hnilákem zůstane mimo mrak; s kostivládem a štítonošem v dosahu jde po kostivládovi.
- [ ] **Krok 2:** FAIL. **Krok 3:** implementuj bota a výpis.
- [ ] **Krok 4: Balanc:** ladění podle čísel výše; tabulku výher `main` → `factions` zapiš do `docs/DECISIONS.md`.
- [ ] **Krok 5: Dokumentace:** DECISIONS (frakce, čísla mechanik, co bylo nahrazeno u modelů a zvuků, rozpočet modelů, co-op poznámka ze spec 7), STATUS (nahoře: co přináší, co Petr kontroluje, rychlé odkazy `?debug=1&phase=6|11|16`, `__game.debug.spawnFaction("undead")`; pořadí: multiplayer na konci začíná víc hrdiny v simulaci), ARCHITECTURE (nové soubory).
- [ ] **Krok 6:** `npm run check`, `npm run build`, e2e `webgl2-fallback` PASS.
- [ ] **Krok 7: Commit** `balance(factions): autopilot, tuning and docs`; PR proti `main`, zelené CI, sloučení až na Petrovo slovo.
