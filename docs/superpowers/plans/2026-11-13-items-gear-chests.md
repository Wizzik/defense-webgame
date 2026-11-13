# Výbava, drop z bossů a truhly – implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Z nepřátel padá zlato, truhly na mapě za ně dočasně vylepšují výbavu v 16 pozicích; bossové shazují trvalé itemy pěti rarit, které se ukládají a nasazují v menu.

**Architecture:**
- Itemy jsou data: `design/items.yaml` → `data/generated/items.json`, pravidla v `design/rules.yaml` (`gear`, `chests`, `drops`), zlato u typů v `design/enemies.yaml`.
- Simulace dostává výbavu jako vstup (`RunOptions.loadout`), drží ji v `GearState` (pevná pole pro 16 slotů) a sčítá ji do `hero.gear`, které čte `heroStats`. Zlato je druhý `CrystalStore`, truhly malý pevný store a nový stav běhu `"chest"`.
- Sbírka, panenky, los dropu a migrace jsou čistá vrstva `meta/` (bez DOM, bez `three`). Klient ji napojuje na IndexedDB a na události simulace.
- UI: jedna komponenta panenky a tooltipu, použitá v menu (úpravy) i v běhu (jen ke čtení).

**Tech Stack:** beze změny a bez nových závislostí (Node 22, TypeScript, Vite, Vitest, Three.js, zod, yaml, tsx, Playwright; verze podle `package-lock.json`). Žádné nové assety: ikony jsou vlastní SVG, truhla a mince jsou procedurální geometrie.

**Spec:** `docs/superpowers/specs/2026-11-13-items-gear-chests-design.md`. Executor čte spec i plán.

**Větev:** `items-gear-chests`, vychází z `elite-boss-threat` (PR #11). Než se otevře PR, musí být PR #11 v `main`; potom `git fetch --depth=50 origin main` a rebase podle `docs/STATUS.md` (Environment notes).

## Global Constraints

- `sim/` a `meta/` jsou čisté: žádné `three`, žádný import z `client/`, žádné DOM globály. `sim/` je deterministická: jen `Rng`, žádné `Math.pow`, `**`, `Math.sin` a další zakázané funkce z `AGENTS.md`.
- `Run.step()` v běžném kroku nealokuje; alokovat smí jen vzácná událost (nabídka karet, nabídka truhly).
- `data/generated/*.json` se needituje ručně a nenese kódy z mapy; `source` a `review` zůstávají v `design/*.yaml`.
- Jména a texty itemů jsou původní, v EN a CS. Nic z mapy v `client/`, `sim/`, `meta/` ani v generovaných datech.
- Kód, identifikátory a komentáře anglicky. Conventional Commits, commit až po `npm run check`. Identita `Claude <noreply@anthropic.com>` a trailery relace.
- Barvy: žádná oranžová. Rarity `common #e8ecf2`, `rare #5aa0ff`, `epic #b07cff`, `legendary #e8c860`, `mythic #d8405c`. Panely v paletě hry (`client/render/palette.ts`, `client/ui/style.css`).
- `data:build` potřebuje export mapy v `data-source/v20.75/out/` (viz `docs/STATUS.md`, Environment notes; mapa je soubor v claude.ai projektu).

## Co plán rozhoduje navíc ke specu

| Téma | Rozhodnutí |
|---|---|
| Ikony | Vlastní SVG glyfy, jeden na typ pozice (14), v `client/ui/item-icons.ts`; raritu nese rámeček. Spec počítal s CC0 sadou; vlastní glyfy nepotřebují licenci ani stahování. |
| Truhla a mince | Procedurální geometrie (kvádr s víkem, plochý válec), barvy `0x6f7f9c` a `0xe8c860`. Žádný model. |
| Hrdina na panence | Barevná silueta v barvě hrdiny (`hero-tints.ts`), ne 3D náhled. |
| Tabulky dropu | Losují se po raritě (`rules.drops`), itemy nemají vlastního bosse. Tooltip „Padá:“ vypíše bosse, jejichž tabulka raritu obsahuje. |
| Cena truhly | `rules.chests.basePrice` × `priceGrowth` za každou otevřenou, drženo jako průběžný součin (`run.chestPriceRaw`), zobrazuje se zaokrouhlená. Mocnina se nepočítá. |
| Level-up a truhla zároveň | Truhla se neotevře, dokud čeká level-up (`pendingLevelUps > 0`); hrdina na ní stojí dál a otevře se v dalším kroku. |
| Úroveň slotu | `base` (trvalá, 0 = prázdný slot) + `temp` (z truhel). Čísla itemu × (1 + `levelStep` × (base + temp − 1)). |
| Události | `EventKind.ChestSpawn` 19, `ChestOpen` 20, `ChestPick` 21, `BossDeath` 22. `Pickup` dostane v poli `u` druh: 0 krystal, 1 mince. |
| Efekty | Šest druhů (Task 7), osm itemů. |
| Autopilot | Jde pro nejbližší truhlu, když má zlato, hrdina má aspoň 60 % HP a hrad aspoň 50 % HP. Volí nabídnutý slot s nejnižší úrovní, při shodě první. |
| Uložená data | `{ version: 1, items: Record<itemId, level>, loadouts: Record<heroId, Partial<Record<SlotId, itemId>>> }`, IndexedDB `defense-webgame` / store `save` / klíč `main`. |

**Výchozí čísla** (Task 11 je přeladí podle specu, oddíl 9):
- `rules.gear: { levelStep: 0.15, maxPermanentLevel: 5 }`
- `rules.chests: { count: 3, basePrice: 40, priceGrowth: 1.18, minCastleDistance: 700, maxCastleDistance: 2000, minSpacing: 600, pickupRadius: 80, slotsPerOffer: 3 }`
- `rules.drops`: `iron-marshal { common: 60, rare: 40 }`, `pale-abbot { rare: 60, epic: 40 }`, `gunmaster { epic: 75, legendary: 25 }`, `dread-regent { epic: 50, legendary: 40, mythic: 10 }`
- `gold` v `enemies.yaml`: shieldbearer 1, scout 1, musketeer 2, chaplain 2, lancer 3, captain 10, iron-marshal 100, pale-abbot 150, gunmaster 200, dread-regent 0.
- Rozpočet statů na item úrovně 1 (součet přes řádky, atribut = 1 bod, `hp` 12 = 1 bod, `armor` 0,25 = 1 bod, 1 % = 1 bod, `magnet` 10 = 1 bod, `regen` 0,1 = 1 bod): běžný 6, vzácný 12, epický 20, legendární 30, mytický 42.

## Review Focus

1. **Uložená data ze starší verze, poškozená nebo s neznámým id itemu:** hra se načte, neznámé položky zahodí a zbytek zachová (test v Tasku 8).
2. **IndexedDB není k dispozici** (soukromé okno, zákaz úložiště): hra jde hrát, výbava žije v paměti a menu to jednou řekne (test v Tasku 9).
3. **Truhla ve stejném kroku jako level-up, smrt hrdiny nebo pád hradu:** běh neuvízne ve stavu `"chest"` a prohra má přednost (test v Tasku 4).
4. **Vysbíraná sbírka** (všechno na úrovni 5): boss nic nedá, oznámení to řekne, nic nespadne (test v Tasku 8).
5. **Import cizího nebo neplatného souboru:** odmítne se se zprávou a stávající uložená data zůstanou (test v Tasku 9).

---

### Task 1: Data itemů, pravidla a zlato u nepřátel

**Files:**
- Create: `data/schema/item.ts`, `design/items.yaml`, `data/generated/items.json`
- Modify: `data/schema/index.ts`, `data/schema/rules.ts`, `data/schema/enemy.ts`, `data/schema/schema.test.ts`, `data/generated.test.ts`, `tools/data-build/load.ts`, `tools/data-build/build.ts`, `tools/data-build/data-build.test.ts`, `design/rules.yaml`, `design/enemies.yaml`, `data/generated/{rules,enemies}.json`

**Interfaces:**
- Produces:
  - `SlotType = "head"|"neck"|"shoulders"|"back"|"chest"|"wrist"|"hands"|"waist"|"legs"|"feet"|"ring"|"trinket"|"mainHand"|"offHand"`
  - `Rarity = "common"|"rare"|"epic"|"legendary"|"mythic"`
  - `StatId = "str"|"agi"|"int"|"hp"|"armor"|"regen"|"damage"|"attackSpeed"|"moveSpeed"|"spellPower"|"magnet"|"goldFind"` (procentní staty jsou zlomky: 0.05 = 5 %)
  - `Item = { id: Slug; name: LocalizedText; slotType: SlotType; rarity: Rarity; stats: { stat: StatId; value: number }[]; effect?: { kind: EffectKind; params: Record<string, number>; text: LocalizedText } }`
  - `GameData.items: Item[]`; `Rules.gear`, `Rules.chests`, `Rules.drops: { boss: Slug; weights: Partial<Record<Rarity, number>> }[]`; `Enemy.gold: number` (výchozí 0).
  - `EffectKind` je zatím prázdný výčet rozšířený v Tasku 7; schéma v tomto tasku `effect` nepřijímá.

- [ ] **Step 1: Testy schématu** v `data/schema/schema.test.ts`: item s počtem řádků, který neodpovídá raritě (běžný 1, vzácný 2, epický 3, legendární 4, mytický 5), se odmítne; dvě stejná id se odmítnou; `rules.drops` s neznámým bossem se odmítne; běžných itemů je právě jeden na každý `SlotType`.
- [ ] **Step 2: Spustit `npx vitest run data/schema` → FAIL.**
- [ ] **Step 3: Napsat schémata a `design/items.yaml` se 14 běžnými itemy** (jeden na typ pozice, jeden řádek, rozpočet 6 bodů; typický stat podle specu 5.4: boty `moveSpeed`, hruď a nohy `hp`, zbraň `damage`, prsten `goldFind`, krk `magnet`, ostatní atribut). Jména původní, EN a CS. Pole `source` volitelné, do JSON se nezapisuje.
- [ ] **Step 4: `data-build`** načte `design/items.yaml` (itemy nemají zdroj v exportu, jen se validují a zapíšou bez `source` a `review`), doplní `gold` a nová pravidla. Test v `data-build.test.ts`: výstup nemá `source`; pořadí itemů je pořadí v YAML.
- [ ] **Step 5: `npm run data:build -- --source data-source/v20.75/out --out data/generated`, `npm run check` → PASS, commit** `feat(data): items, gear rules and enemy gold`.

### Task 2: Výbava v simulaci

**Files:**
- Create: `sim/gear.ts`, `sim/gear.test.ts`
- Modify: `sim/world.ts`, `sim/hero.ts`, `sim/level-up.ts`, `sim/run.ts`, `sim/crystals.ts`, `sim/hash.ts`, `sim/index.ts`

**Interfaces:**
- Consumes: `Item`, `SlotType`, `Rules.gear` z Tasku 1.
- Produces:
  - `SLOT_IDS = ["head","neck","shoulders","back","chest","wrist","hands","waist","legs","feet","ring1","ring2","trinket1","trinket2","mainHand","offHand"] as const`, `SlotId`, `SLOT_COUNT = 16`, `slotTypeOf(slot: number): SlotType`
  - `LoadoutEntry = { slot: SlotId; item: string; level: number }`; `RunOptions.loadout?: LoadoutEntry[]`
  - `GearState { item: Int16Array(16) /* index do data.items, -1 prázdný */; base: Uint8Array(16); temp: Uint16Array(16) }` jako `run.gear`
  - `GearBonus` (pole pro všech 12 `StatId`) jako `hero.gear`
  - `itemStatAt(value: number, level: number, levelStep: number): number`
  - `recomputeGear(run: Run): void` (naplní `hero.gear` a zavolá `refreshHeroStats`)
  - `basicItemIndex(data: GameData, type: SlotType): number`

- [ ] **Step 1: Testy** `sim/gear.test.ts`:
  - `itemStatAt(10, 1, 0.15) === 10`, `itemStatAt(10, 3, 0.15)` je 13 (tolerance 1e-9);
  - běh s `loadout` jednoho itemu `+10 str` úrovně 2 má `hero.stats.maxHp` vyšší přesně o `11.5 × strHitPointBonus` než běh bez výbavy a `hero.hp === hero.stats.maxHp`;
  - `damage`, `attackSpeed`, `moveSpeed` se sčítají s aurami (aura +0.1 a item +0.05 dají násobek 1.15);
  - `spellPower` násobí: `(1 + int × spellPowerPerInt) × (1 + gear.spellPower)`;
  - `magnet` zvětší dosah sbírání krystalů o hodnotu statu;
  - položka `loadout` s neznámým id, se špatným typem pozice pro slot, s úrovní mimo 1–`maxPermanentLevel` nebo druhá položka pro stejný slot se ignoruje (běh nespadne);
  - dva běhy se stejným seedem a stejnou výbavou mají stejný hash; s jinou výbavou jiný.
- [ ] **Step 2: Spustit → FAIL.**
- [ ] **Step 3: Implementovat.** `heroStats` čte `hero.str + hero.gear.str` (obdobně `agi`, `int`), `hp` a `regen` a `armor` přičítá, procentní staty podle testů. `recomputeGear` se volá v konstruktoru `Run` po načtení výbavy a z Tasku 4 po volbě z truhly; nikdy v běžném kroku. `hash.ts` zahrne `gear.item`, `base`, `temp`.
- [ ] **Step 4: `npm run check` → PASS, commit** `feat(sim): gear loadout and stat bonuses`.

### Task 3: Zlato

**Files:**
- Create: `sim/gold.test.ts`
- Modify: `sim/crystals.ts`, `sim/combat.ts`, `sim/run.ts`, `sim/world.ts`, `sim/hash.ts`, `sim/index.ts`, `sim/crystals.test.ts`

**Interfaces:**
- Produces: `run.coins: CrystalStore` (`COIN_CAPACITY = 512`), `run.gold: number`, `RunStats.goldGained: number`, `updatePickups(run: Run, store: CrystalStore, kind: 0 | 1): void` (nahrazuje `updateCrystals`; `Run.step` ji volá dvakrát), `debugGrantGold(run: Run, amount: number): void`.

- [ ] **Step 1: Testy:** zabitý nepřítel s `gold: 2` shodí minci hodnoty 2 posunutou o 24 jednotek v ose x od krystalu; sebraná mince přidá `Math.round(2 × (1 + goldFind))` do `run.gold` a `stats.goldGained` a pošle `Pickup` s `u = 1`; při plném storu jde zlato rovnou hrdinovi; nepřítel s `gold: 0` nic neshodí; hash zahrne `gold` a mince.
- [ ] **Step 2: Spustit → FAIL. Step 3: Implementovat. Step 4: `npm run check` → PASS, commit** `feat(sim): gold coins from kills`.

### Task 4: Truhly a stav výběru

**Files:**
- Create: `sim/chests.ts`, `sim/chests.test.ts`
- Modify: `sim/run.ts`, `sim/events.ts`, `sim/hash.ts`, `sim/bot.ts`, `sim/bot.test.ts`, `sim/index.ts`, `tools/sim-run/run.ts`

**Interfaces:**
- Consumes: `run.gold`, `GearState`, `recomputeGear`, `basicItemIndex`.
- Produces:
  - `RunState` navíc `"chest"`; `run.chests: { x: Float64Array(3); y: Float64Array(3) }`, `run.chestsOpened: number`, `run.chestPriceRaw: number`, `chestPrice(run: Run): number` (zaokrouhlená), `run.chestOffer: { slots: number[] } | null`
  - `updateChests(run: Run): void` (v `Run.step` po obou `updatePickups`), `chooseChestSlot(run: Run, index: number): void` (ve stavu `"chest"` místo kroku, bere `input.card`)
  - `botChestChoice(run: Run): number`
  - `sim:run` vypisuje průměr otevřených truhel a zlata na běh.

- [ ] **Step 1: Testy** `sim/chests.test.ts`:
  - po startu leží 3 truhly, každá 700–2000 od hradu, uvnitř arény a aspoň 600 od ostatních; stejný seed dá stejná místa;
  - hrdina na truhle bez zlata: nic se nestane; se zlatem: `gold` klesne o `chestPrice`, stav je `"chest"`, nabídka má 3 různé sloty, přijde `ChestOpen`;
  - volba prázdného slotu vloží běžný item té pozice s `base 0, temp 1`; volba obsazeného zvedne `temp` o 1; v obou případech se přepočítají staty, stav je `"playing"`, truhla se objeví jinde (`ChestSpawn`) a cena je `Math.round(40 × 1.18)`;
  - neplatný index (−1, 3, 1.5) stav nemění;
  - **Review Focus 3:** s `pendingLevelUps > 0` se truhla neotevře a otevře se až po vyřízení karet; hrdina, který na truhle ve stejném kroku zemře, končí ve stavu `"lost"`, ne `"chest"`; pád hradu ve stejném kroku také.
  - `Run.step` ve stavu `"playing"` nealokuje ani s truhlami (stávající test alokací rozšířit).
- [ ] **Step 2: Spustit → FAIL.**
- [ ] **Step 3: Implementovat.** Místo truhly: body rovnoměrně ve čtverci ±`maxCastleDistance` kolem hradu z `run.rng`, přijmout první, který splní vzdálenosti a leží v aréně; po 40 pokusech vzít poslední, který splnil vzdálenost od hradu. Nabídka: částečný Fisher-Yates přes 16 slotů jako v `openOffer`.
- [ ] **Step 4: Autopilot** podle tabulky rozhodnutí; test v `bot.test.ts`: se zlatem a zdravým hrdinou míří k nejbližší truhle, s hrdinou pod 60 % HP ne; `botChestChoice` vrací slot s nejnižší `base + temp`.
- [ ] **Step 5: `npm run check` → PASS; `npm run sim:run -- --hero all --seeds 1-5`** doběhne a ukáže truhly; **commit** `feat(sim): chests upgrade gear for gold`.

### Task 5: Klient pro zlato a truhly

**Files:**
- Create: `client/render/chest-view.ts`, `client/ui/chest-pointer.ts`, `client/ui/chest-lines.ts`, `client/ui/chest-lines.test.ts`, `client/ui/item-lines.ts`, `client/ui/item-lines.test.ts`
- Modify: `client/render/crystal-view.ts`, `client/main.ts`, `client/game/session.ts`, `client/game/debug.ts`, `client/ui/hud.ts`, `client/ui/cards.ts`, `client/ui/messages-en.ts`, `client/ui/messages-cs.ts`, `client/ui/style.css`, `client/audio/sound-view.ts`, `e2e/game.spec.ts`, `AGENTS.md`

**Interfaces:**
- Produces:
  - `itemLines(lang, item: Item, level: number): string[]` (řádky statů; procenta jako „+5 %“, atributy jako „+14 síla“), `statLabel(lang, stat)`
  - `chestLines(lang, data, gear, slot): { title: string; from: number; to: number; lines: string[] }` (rozdíl statů mezi starou a novou úrovní)
  - `window.__game`: `gold`, `chestPrice`, `chests` (pole `{x, y}`), `chestsOpened`, `gear` (pole 16× `{item, base, temp}` nebo `null`); `debug.grantGold(n)`.

- [ ] **Step 1: Testy** `item-lines.test.ts` a `chest-lines.test.ts` s přesnými řetězci v EN a CS pro item `+14 str, +120 hp` na úrovni 1 a 2 a pro prázdný slot.
- [ ] **Step 2: Spustit → FAIL. Step 3: Implementovat `item-lines.ts`, `chest-lines.ts`.**
- [ ] **Step 4: Pohledy a HUD.** Mince kreslí druhá instance `CrystalView` se zlatou barvou. `chest-view.ts` kreslí 3 truhly, nad každou cenu (bílá, když na ni zlato je, šedá, když ne). HUD: zlato a cena příští truhly vedle úrovně. `chest-pointer.ts` jako `castle-pointer.ts`, míří na nejbližší truhlu a svítí, když je na ni zlato. Stav `"chest"` zobrazí `Cards` se třemi kartami z `chestLines` (klávesy 1–3 a klik jako u level-upu). Zvuky: sebrání mince, otevření truhly (syntetizované jako stávající).
- [ ] **Step 5: e2e** v `e2e/game.spec.ts`: `?debug=1`, `debug.grantGold(1000)`, `debug.teleport` na `__game.chests[0]`, čeká na karty, zvolí první, ověří `chestsOpened === 1`, nižší `gold` a neprázdný slot v `__game.gear`.
- [ ] **Step 6: `npm run check`, `npm run build`, `npm run e2e -- --project=webgl2-fallback` → PASS; doplnit `AGENTS.md` (nová pole `__game`, `debug.grantGold`); commit** `feat(client): gold, chests and the chest offer`.

### Task 6: Panenka a panel výbavy v běhu

**Files:**
- Create: `client/ui/item-icons.ts`, `client/ui/doll.ts`, `client/ui/item-tooltip.ts`, `client/ui/gear-panel.ts`, `client/ui/doll.test.ts`
- Modify: `client/main.ts`, `client/game/session.ts`, `client/game/keyboard.ts`, `client/ui/style.css`, `client/ui/messages-{en,cs}.ts`, `e2e/game.spec.ts`

**Interfaces:**
- Produces:
  - `iconSvg(type: SlotType): string`
  - `DollSlotView = { slot: SlotId; item: Item | null; level: number; temp: number }`
  - `class Doll { constructor(root: HTMLElement, opts: { lang: Lang; heroId: string; onSlotClick?: (slot: SlotId) => void }); render(slots: DollSlotView[], totals: HeroStats & { str: number; agi: number; int: number }): void }`
  - `tooltipLines(lang, data, item, level, temp, compare?: { item: Item; level: number }): { name: string; rarity: Rarity; sub: string; lines: { text: string; tone: "plain"|"better"|"worse"|"effect"|"temp" }[]; source: string }`
  - `GearPanel` (klávesa C otevře a zavře; otevřený panel nastaví `session.paused`).

- [ ] **Step 1: Testy** `doll.test.ts` pro `tooltipLines`: jméno a rarita; `sub` je „Vzácný · Hlava · úroveň 2“ / „Rare · Head · level 2“; dočasné úrovně mají tón `temp`; porovnání dává `better` a `worse`; `source` vyjmenuje bosse z `rules.drops`, jejichž váhy raritu obsahují.
- [ ] **Step 2: Spustit → FAIL. Step 3: Implementovat.** Rozložení panenky podle náčrtu ve specu 6.3: levý sloupec hlava, krk, ramena, záda, hruď, zápěstí; pravý ruce, pas, nohy, boty, prsten 1, prsten 2, trinket 1, trinket 2; dole zbraň a druhá ruka; uprostřed silueta v barvě hrdiny; pod ní STR, AGI, INT, HP, brnění. Rámeček slotu v barvě rarity, u dočasné úrovně číslo `+N` v rohu.
- [ ] **Step 4: e2e:** klávesa C otevře panel se 16 sloty a běh stojí (`__game.tick` se nemění), druhé C ho zavře a běh pokračuje; C při kartách nedělá nic.
- [ ] **Step 5: `npm run check`, build, e2e → PASS, commit** `feat(client): gear panel in the run`.

### Task 7: Katalog a zvláštní efekty

**Files:**
- Create: `sim/gear-effects.ts`, `sim/gear-effects.test.ts`
- Modify: `data/schema/item.ts`, `design/items.yaml`, `data/generated/items.json`, `data/generated.test.ts`, `sim/gear.ts`, `sim/run.ts`, `sim/hero.ts`, `sim/combat.ts`, `sim/crystals.ts`, `sim/hash.ts`, `client/ui/item-lines.ts`, `client/render/ability-fx.ts`

**Interfaces:**
- Produces: `EffectKind = "chain_on_attack"|"splash_on_attack"|"low_hp_shield"|"haste_on_elite_kill"|"slow_aura"|"gold_heals_castle"` a parametry:
  - `chain_on_attack { every, damage, jumps, range }`: každý `every`-tý základní útok zasáhne dalších `jumps` nejbližších nepřátel v `range` za `damage` × síla kouzel;
  - `splash_on_attack { chance, radius, fraction }`: zásah s pravděpodobností `chance` (z `run.rng`) dá `fraction` poškození všem v `radius`;
  - `low_hp_shield { threshold, seconds, cooldown }`: pod `threshold` HP nastaví `run.shieldTicks` na `seconds`, pak `cooldown` sekund pauza;
  - `haste_on_elite_kill { cooldownSpeed, seconds }`: po zabití elity nebo bosse násobí rychlost cooldownů;
  - `slow_aura { radius, slow }`: nepřátelé v `radius` mají `slowFactor` aspoň `slow` (obnovuje se každých 10 kroků přes mřížku);
  - `gold_heals_castle { perGold }`: sebrané zlato léčí hrad o `perGold` za minci hodnoty 1.
- `updateGearEffects(run: Run): void` v `Run.step` po `updateAbilities`; stav efektů (počitadla, časovače) v pevných polích na `run.gear`.

- [ ] **Step 1: Testy** `gear-effects.test.ts`, jeden na druh, s čísly z parametrů (například `every: 5` → pátý útok pošle `Blast` a zraní druhého nepřítele, čtvrtý ne; štít se pod prahem zapne jednou a během pauzy ne; efekt z itemu, který není nasazený, nedělá nic; stejný seed dá stejný hash).
- [ ] **Step 2: Spustit → FAIL. Step 3: Implementovat efekty** (bez alokace v kroku).
- [ ] **Step 4: Dopsat katalog** do `design/items.yaml`: 24 vzácných, 24 epických (každý typ pozice aspoň jednou v obou raritách, sklony STR, AGI a INT zastoupené rovnoměrně), 5 legendárních (zbraně, druhá ruka, trinkety) a 3 mytické, podle rozpočtů z hlavičky plánu. Legendární: po jednom `chain_on_attack`, `splash_on_attack`, `low_hp_shield`, `haste_on_elite_kill`, `slow_aura`. Mytické: `gold_heals_castle` a silnější `chain_on_attack` a `low_hp_shield`. Efekt se nepočítá do rozpočtu statů.
- [ ] **Step 5: Testy dat** v `data/generated.test.ts`: počty 14 / 24 / 24 / 5 / 3; každý legendární a mytický má `effect`, nižší rarity ne; rozpočet každého itemu je do ±10 % rozpočtu své rarity; každá rarita z `rules.drops` má aspoň jeden item.
- [ ] **Step 6: `data:build`, `npm run check` → PASS, commit** `feat: item catalogue and gear effects`.

### Task 8: Meta vrstva (sbírka, drop, migrace)

**Files:**
- Create: `meta/save.ts`, `meta/drop.ts`, `meta/equip.ts`, `meta/index.ts`, `meta/tsconfig.json`, `meta/save.test.ts`, `meta/drop.test.ts`, `meta/equip.test.ts`
- Modify: `package.json` (`typecheck` přidá `tsc -p meta/tsconfig.json`), `vitest.config.ts` (`meta/**/*.test.ts`), `tests/repo-guard.test.ts` (pravidla čistoty a identifikátorů mapy platí i pro `meta/`), `ARCHITECTURE.md`

**Interfaces:**
- Consumes: `GameData`, `Item`, `Rarity`, `SlotId`, `SLOT_IDS`, `slotTypeOf`, `LoadoutEntry`, `Rng` ze `sim/`.
- Produces:
  - `SaveData = { version: 1; items: Record<string, number>; loadouts: Record<string, Partial<Record<SlotId, string>>> }`, `emptySave(): SaveData`
  - `parseSave(raw: unknown, data: GameData): { save: SaveData; dropped: number }` (nikdy nevyhazuje; `dropped` je počet zahozených položek)
  - `rollDrop(data: GameData, save: SaveData, bossId: string, seed: number, order: number): { kind: "new" | "level"; item: Item; level: number } | { kind: "none" }` a `applyDrop(save, drop): SaveData`
  - `equip(save, data, heroId, itemId): SaveData`, `unequip(save, heroId, slot): SaveData`, `toLoadout(save, data, heroId): LoadoutEntry[]`

- [ ] **Step 1: Testy `drop.test.ts`:** se sbírkou bez běžných itemů dá `iron-marshal` vždy `kind: "new"`; když hráč má všechny itemy vylosované rarity, padne `"level"` u itemu pod úrovní 5; když jsou všechny na 5, zkusí se další rarita bosse; **Review Focus 4:** sbírka se vším na úrovni 5 dá `{ kind: "none" }`; stejný `seed` a `order` dají stejný výsledek, jiný `order` smí dát jiný; na 2 000 seedech se podíl mytických z `dread-regent` pro prázdnou sbírku liší od 10 % nejvýš o 3 procentní body.
- [ ] **Step 2: Testy `save.test.ts` (Review Focus 1):** `parseSave` z `null`, z řetězce, z objektu bez `version`, z `version: 99`, s neznámým id itemu, s úrovní 0, 6 a 2.5, s itemem ve slotu špatného typu a s itemem v panence, který není ve sbírce, vždy vrátí platná data, zachová platné položky a spočítá zahozené.
- [ ] **Step 3: Testy `equip.test.ts`:** prsten jde do `ring1`, druhý do `ring2`, třetí nahradí `ring1`; tentýž prsten podruhé nic nezmění; `toLoadout` nese trvalé úrovně ze sbírky; funkce nemění vstup.
- [ ] **Step 4: Spustit → FAIL. Step 5: Implementovat.** Generátor losu: `new Rng(seed ^ ((order + 1) × 0x9e3779b1))`.
- [ ] **Step 6: `npm run check` → PASS, commit** `feat(meta): collection, drops and save data`.

### Task 9: Ukládání a drop v klientu

**Files:**
- Create: `client/game/save-store.ts`, `client/game/save-store.test.ts`, `client/game/gear-session.ts`, `client/game/gear-session.test.ts`
- Modify: `sim/events.ts`, `sim/combat.ts`, `client/game/session.ts`, `client/game/debug.ts`, `client/main.ts`, `client/ui/announcer.ts`, `client/ui/end-screen.ts`, `client/ui/messages-{en,cs}.ts`, `e2e/game.spec.ts`, `AGENTS.md`

**Interfaces:**
- Consumes: vše z Tasku 8.
- Produces:
  - `EventKind.BossDeath` (22): `a` = index typu nepřítele, `value` = pořadí bosse v běhu (0 první), posílá `killEnemy`.
  - `interface SaveBackend { read(): Promise<unknown>; write(save: SaveData): Promise<void> }`; `indexedDbBackend(): SaveBackend | null` (null, když IndexedDB chybí nebo otevření selže); `memoryBackend(): SaveBackend`
  - `class GearSession { save: SaveData; persistent: boolean; drops: Drop[]; static load(data, backend): Promise<GearSession>; onBossDeath(bossId, seed, order): Drop; equip(...); unequip(...); exportText(): string; importText(text): { ok: true } | { ok: false; reason: "invalid" } }`
  - `window.__game.debug.grantItem(id, level)`, `debug.clearGear()`; `window.__game.collection`.

- [ ] **Step 1: Testy** `gear-session.test.ts` s `memoryBackend`: po `onBossDeath` je item ve `save` a zapsaný v backendu dřív, než test skončí; `drops` drží pořadí; ladicí relace (`persistent: false`) nezapisuje; **Review Focus 5:** `importText` s neplatným JSON, s JSON bez `version` a s prázdným řetězcem vrátí `{ ok: false }` a `save` i backend zůstanou beze změny; platný export projde a přepíše data. **Review Focus 2** v `save-store.test.ts`: `GearSession.load` s backendem, jehož `read` odmítne, vrátí prázdnou sbírku s `persistent: false`.
- [ ] **Step 2: Spustit → FAIL. Step 3: Implementovat.** `Session.start` předá `toLoadout(...)` do `createRun`; s `?debug=1` se používá `memoryBackend`. Oznámení dropu přes `announcer` (jméno v barvě rarity, „nový“ / „úroveň N“, nebo „sbírka tohoto bosse je úplná“). Obrazovka konce běhu vypíše `drops`. Když `indexedDbBackend()` vrátí null, menu jednou ukáže větu, že se výbava v tomto okně neukládá.
- [ ] **Step 4: e2e:** `?debug=1&phase=6`, `debug.killBoss()` → oznámení s itemem a `__game.collection` má jeden item; bez `debug` se po obnovení stránky sbírka načte (test zapíše data přes `page.evaluate` do IndexedDB a ověří je v menu po Tasku 10; do té doby přes `__game.collection`).
- [ ] **Step 5: `npm run check`, build, e2e → PASS; `AGENTS.md`; commit** `feat(client): boss drops are saved`.

### Task 10: Obrazovka výbavy v menu

**Files:**
- Create: `client/ui/gear-screen.ts`, `client/ui/collection-grid.ts`, `client/ui/collection-grid.test.ts`
- Modify: `client/ui/menu.ts`, `client/main.ts`, `client/ui/style.css`, `client/ui/messages-{en,cs}.ts`, `e2e/game.spec.ts`, `e2e/shots.spec.ts`, `AGENTS.md`

**Interfaces:**
- Consumes: `Doll`, `tooltipLines`, `GearSession`, `toLoadout`, `heroStats`.
- Produces: `gridEntries(data, save, filter: SlotType | "all"): { item: Item; owned: boolean; level: number; equipped: boolean }[]` (řazení: rarita od nejvyšší, potom pořadí v datech); `GearScreen` otevíraný tlačítkem „Výbava“ / „Gear“ u vybraného hrdiny.

- [ ] **Step 1: Testy** `collection-grid.test.ts`: filtr `ring` vrátí jen prsteny; nevlastněné itemy jsou v seznamu s `owned: false`; řazení podle rarity.
- [ ] **Step 2: Spustit → FAIL. Step 3: Implementovat** podle specu 6.3: vlevo panenka (klik na slot sundá), vpravo filtr a mřížka (klik na vlastněný item nasadí, nevlastněný je prázdný rámeček s tooltipem „Padá:“), tooltip s porovnáním proti nasazenému, součty statů se přepočítají po každé změně voláním `heroStats` na hrdinu úrovně 1 s výbavou. Dole tlačítka export a import souboru (`.json`); import s chybou ukáže zprávu.
- [ ] **Step 4: e2e:** s daty ve sbírce nasadit item, spustit běh a ověřit ho v `__game.gear`; přepnout hrdinu a ověřit, že má vlastní panenku. `npm run shots` dostane snímek `gear`.
- [ ] **Step 5: `npm run check`, build, e2e, `npm run shots` → PASS; prohlédnout snímek `gear` (čitelnost, žádná oranžová); commit** `feat(client): gear screen in the menu`.

### Task 11: Vyvážení a dokumentace

**Files:**
- Create: `tools/sim-run/gear-presets.ts`, `tools/sim-run/gear-presets.test.ts`
- Modify: `tools/sim-run/run.ts`, `tools/sim-run/run.test.ts`, `design/rules.yaml`, `design/enemies.yaml`, `design/items.yaml`, `data/generated/*.json`, `docs/DECISIONS.md`, `docs/STATUS.md`, `ARCHITECTURE.md`, `AGENTS.md`, `docs/superpowers/specs/2026-11-13-items-gear-chests-design.md`

**Interfaces:**
- Produces: `gearPreset(data, heroId, preset: "none" | "mid" | "full"): LoadoutEntry[]` (`mid`: v každém slotu vzácný item úrovně 1 se sklonem k hlavnímu atributu hrdiny, jinak první vzácný té pozice; `full`: nejvyšší rarita dostupná pro pozici na úrovni 5); `sim:run --gear none|mid|full` (výchozí `none`).

- [ ] **Step 1: Test** `gear-presets.test.ts`: `none` je prázdné; `mid` a `full` mají 16 položek platných pro `createRun`; `full` obsahuje všechny mytické itemy, které se do slotů vejdou.
- [ ] **Step 2: Změřit výchozí stav** na větvi před Taskem 1 (`git stash` není potřeba, čísla jsou v `docs/DECISIONS.md`, oddíl Elite and boss threat) a po plánu: `npm run sim:run -- --hero all --seeds 1-20` pro `--gear none`, `mid`, `full`.
- [ ] **Step 3: Ladit** `rules.chests`, `gold` a rozpočty statů, dokud neplatí cíle specu (oddíl 9):
  - `--gear none`: počet výher každého hrdiny do ±3 z 20 proti stavu před plánem; když truhly běh zlehčí víc, přitvrdit `rules.chests`, potom pozdní fáze;
  - autopilot otevře 12–20 truhel za vyhraný běh;
  - `--gear full`: každý hrdina kromě otevřených výjimek ze `STATUS.md` vyhraje aspoň 18 z 20;
  - kontrola na seedech 21–40, že se čísla neliší o víc než 4 výhry.
- [ ] **Step 4: Dokumentace.** `docs/DECISIONS.md`: oddíl „Gear, drops and chests“ s konečnými čísly a tabulkou výher. `ARCHITECTURE.md`: `meta/`, výbava, zlato, truhly, pořadí `Run.step`. `AGENTS.md`: `--gear`, nová pole `__game`, ladicí funkce. Spec: zapsat zpřesnění z tabulky „Co plán rozhoduje navíc“. `docs/STATUS.md`: hotovo, co má Petr zkusit (odkazy `?debug=1&phase=6`, kde je obrazovka výbavy, klávesa C), co zůstalo otevřené.
- [ ] **Step 5: `npm run check`, build, e2e → PASS; commit** `feat(design): balance for gear and chests; docs`; **push a PR** proti `main` (po sloučení PR #11 a rebase).

---

## Pořadí a závislosti

Tasky 1 → 2 → 3 → 4 → 5 → 6 dávají hratelné truhly s dočasnými itemy; teprve potom katalog (7) a trvalá výbava (8 → 9 → 10). Když se v Tascích 4–6 ukáže, že staty nebo úrovně nesedí, opraví se před Taskem 7. Task 8 nezávisí na 5–7 a smí se dělat souběžně.
