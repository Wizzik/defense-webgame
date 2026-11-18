# Silnější truhly, Magic Find a tvrdší nepřátelé – implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nepřátelé bijí hrdinu 2× (melee hrdinové 1,5×), truhla nabízí 3 předměty s náhodně hozenou raritou, nový stat Magic Find zvedá šance na lepší raritu u truhel i boss dropů, a 15 truhel dá hrdinovi bez gearu zhruba +50 % síly.

**Architecture:**
- Hrozba je jeden násobitel v `damageHero` (`sim/combat.ts`): `rules.threat.heroDamageTaken` × volitelné `hero.damageTaken` z `design/heroes.yaml`. Hrad se nemění.
- Matematika Magic Findu (klesající výnosy, úprava vah, los rarity) je jeden čistý modul `sim/magic-find.ts`; používá ho nabídka truhly v `sim/` i boss drop v `meta/drop.ts`.
- `ChestOffer` nese místo slotů karty `{ slot, item, action }`; akce (nový, výměna, +1 úroveň) se rozhodne při losu a provede se v `applyChestCard`. Klient kartu jen vykreslí.
- Síla truhel se měří mimo běh novým nástrojem `npm run sim:chests` (pevných 15 nabídek přes mnoho seedů).

**Tech Stack:** beze změny a bez nových závislostí (Node 22, TypeScript, Vite, Vitest, zod, yaml, tsx, Playwright podle `package-lock.json`). Žádné nové assety.

**Spec:** `docs/superpowers/specs/2026-11-18-chest-loot-threat-design.md`. Executor čte spec i plán.

**Větev:** `chest-loot` (vychází z `main` po PR #14, `cd54f2e`). PR jde proti `main`.

## Global Constraints

- `sim/` a `meta/` jsou čisté a deterministické (pravidla v `AGENTS.md`): jen `Rng`, žádné `Math.pow`, `**` ani další zakázané funkce. Magic Find se počítá jen dělením.
- `Run.step()` v běžném kroku nealokuje; alokovat smí jen otevření truhly (los nabídky).
- Nabídky truhel berou náhodu jen z `run.chestRng`, aby se nepřátelé seedu nepohnuli.
- `data/generated/*.json` se needituje ručně. `data:build` potřebuje export mapy v `data-source/v20.75/out/`; když chybí, stáhni mapu ze souboru `X_Hero_Siege_F-Day_v20.75_AI.w3x` v claude.ai projektu (Projects `project_read` s `original: true`) a spusť `npm run map:extract -- <mapa.w3x> v20.75`.
- Texty pro hráče v EN a CS, vlastní, nic z mapy. Kód, identifikátory a komentáře anglicky.
- Barvy rarit beze změny (`common #e8ecf2`, `rare #5aa0ff`, `epic #b07cff`, `legendary #e8c860`, `mythic #d8405c`), žádná oranžová.
- Conventional Commits, commit až po `npm run check`. Identita `Claude <noreply@anthropic.com>` a trailery relace.
- Hrad (`damageCastle`) se nemění. `rules.gear.levelStep` (0.15) se nemění.

## Co plán rozhoduje navíc ke specu

| Téma | Rozhodnutí |
|---|---|
| Kde se násobí poškození | `heroDamageScale(run)` v `sim/combat.ts`; `damageHero` násobí `amount` před odečtem i v události `HeroHit`. Volající (`enemy-ai`, `enemy-strike`, `enemy-slam`, `enemy-charge`) se nemění. |
| Pole hrdiny | `damageTaken?: number` (0 < x ≤ 1), v datech jen u stonehorn a redcleaver (`0.75`); jinde klíč chybí a platí 1. |
| Pravidla MF | `rules.magicFind: { limit: 1.5, rarityFactor: { rare: 1, epic: 1.5, legendary: 2, mythic: 2.5 } }`. Efektivní MF = MF × limit / (MF + limit). |
| Předměty s MF (10) | Řádek se vymění, rozpočet zůstane: `tin-ring` goldFind 0.06 → magicFind 0.12; `band-of-resolve` goldFind 0.05 → 0.10; `falcon-charm` magnet 50 → 0.10; `hunters-whistle` magnet 60 → 0.12; `pendant-of-the-deep-well` magnet 50 → 0.10; `ring-of-the-keen-eye` goldFind 0.06 → 0.12; `seal-of-the-archivist` goldFind 0.06 → 0.12; `belt-of-many-knives` goldFind 0.05 → 0.10; `compass-of-the-lost-scout` magnet 60 → 0.12; `hourglass-of-the-hunt` magnet 50 → 0.10. Epic+ MF build (náhrdelník, 2 prsteny, opasek, 2 trinkety) na úrovni 1 dá 0.66, na úrovni 5 (× 1.6) 1.056 ≈ 100 %. Gold find zůstává na `moonlit-signet` a `seal-of-the-royal-treasury`. |
| Akce karty | `ChestAction = { New: 0, Replace: 1, Level: 2 }`. U `Level` nese karta nasazený předmět, u `New` a `Replace` hozený. |
| Výměna | `item ← hozený`, `base ← 0`, `temp ← base + temp + 1` (spec 4.2). Permanentní předmět se vrátí, protože běh loadout neukládá. |
| Slot karty | Rarita se hodí (`drawRarity` na vahách upravených MF hrdiny), pak se vybere náhodně ze slotů, které ještě nejsou v nabídce a jejichž typ má předmět té rarity; když žádný není, rarita klesne o stupeň (common má všech 14 typů). Předmět: náhodně z předmětů té rarity a typu, které nenosí druhý slot stejného typu; když jiné nejsou, z nich všech. Předmět se losuje i u akce `Level` (stejná spotřeba RNG). |
| Událost `ChestPick` | `a` slot, `value` úroveň slotu po výběru, `x`, `y` hrdina, `u` index předmětu ve slotu po výběru, `v` akce. |
| Zpráva o kořisti | Výběr legendary nebo mythic (akce `New` nebo `Replace`) dá řádek novinek „Truhla: {name}“ / „Chest: {name}“ v tónu `rarity-<rarity>`. |
| Autopilot | `Replace` s nejvyšší raritou; jinak `New` s nejvyšší raritou; jinak `Level` slotu s nejnižší `base + temp`. Při shodě první karta. |
| Měření síly | `npm run sim:chests -- --seeds 1-200`: hrdina na úrovni 25 (XP bez karet), 15× `rollChestOffer` + `botChestChoice` + `applyChestCard`. Poměry: hp = `maxHp`, útok = průměr `damageMin/Max` / `attackIntervalSeconds`, kouzla = `spellPower / cooldownScale`. Cíl: průměr tří poměrů přes 8 hrdinů v pásmu 1.45–1.55. |
| `__game` | nové `chestCards`: `null` mimo stav `"chest"`, jinak `{ slot: SlotId, item: string, rarity: Rarity, action: "new" \| "replace" \| "level" }[]`. |

**Výchozí čísla:** `rules.threat: { heroDamageTaken: 2 }`; `rules.chests.rarityWeights: { common: 55, rare: 30, epic: 12, legendary: 2.5, mythic: 0.5 }` (Task 6 je doladí).

## Review Focus

1. **Výměna permanentního předmětu za hozený:** loadout předaný do `createRun` zůstane po výběru beze změny, takže v menu je po běhu původní předmět (test v Tasku 4).
2. **Jediný mythic trinket nosí trinket1 a hozený mythic padne na trinket2:** dva stejné předměty jsou povolené, ale efekt se nesčítá (`fx.goldHeal` jako u jednoho kusu) (test v Tasku 4).
3. **Obrovský Magic Find** (např. 1000 %): váhy zůstanou konečné a faktor mythicu nepřesáhne 1 + 1.5 × 2.5 (test v Tasku 2).
4. **Hrdina se štítem pod dvojnásobným zásahem:** štít dál blokuje všechno, žádná událost `HeroHit` (test v Tasku 1).
5. **Boss padne ve chvíli, kdy hrdina nemá žádný MF předmět, nebo je MF 0:** drop je přesně ten jako před plánem (stávající testy `meta/drop.test.ts` beze změny výsledků, test v Tasku 3).

---

### Task 1: Hrdina bere 2× poškození, melee hrdinové 25 % méně

**Files:**
- Modify: `data/schema/rules.ts`, `data/schema/hero.ts`, `data/schema/schema.test.ts` (fixture pravidel)
- Modify: `tools/data-build/load.ts` (`HeroEntry`), `tools/data-build/map-heroes.ts`, `data/generated.test.ts`
- Modify: `design/rules.yaml`, `design/heroes.yaml`, `data/generated/*.json` (regenerace)
- Modify: `sim/combat.ts`
- Create: `sim/hero-damage.test.ts`
- Modify: testy s přesným poškozením hrdiny (`sim/enemy-charge.test.ts`, `sim/enemy-strike.test.ts`, `sim/enemy-slam.test.ts`, `sim/enemy-ai.test.ts` a další, které `npm run check` ukáže)

**Interfaces:**
- Produces: `rules.threat.heroDamageTaken: number`; `Hero.damageTaken?: number`; `heroDamageScale(run: Run): number` exportovaná z `sim/combat.ts`.

- [ ] **Step 1: Napiš padající testy v `sim/hero-damage.test.ts`** (běh přes `abilityRun` ze `sim/testing/ability-run.ts`, události přes `eventsOf`)

```ts
it("an enemy hit on a ranged hero counts twice", () => {
  const run = abilityRun("nightglaive", {});
  const hp = run.hero.hp;
  damageHero(run, 100, -1);
  expect(hp - run.hero.hp).toBeCloseTo(200, 9);
  expect(run.events.value[eventsOf(run, EventKind.HeroHit)[0]!]).toBeCloseTo(200, 9);
});
it("stonehorn and redcleaver take a quarter less", () => {
  for (const id of ["stonehorn", "redcleaver"]) {
    const run = abilityRun(id, {});
    const hp = run.hero.hp;
    damageHero(run, 100, -1);
    expect(hp - run.hero.hp).toBeCloseTo(150, 9);
    expect(heroDamageScale(run)).toBe(1.5);
  }
});
it("the shield still blocks the doubled hit", () => { /* shieldTicks = 5: hp beze změny, žádná HeroHit */ });
it("the castle takes a hit as before", () => { /* damageCastle(run, 100, -1): castle.hp klesne o 100 */ });
```

A v `data/generated.test.ts`: `damageTaken` je 0.75 u stonehorn a redcleaver a chybí u ostatních šesti; `rules.threat.heroDamageTaken` je 2.

- [ ] **Step 2: Spusť testy, musí padat**

Run: `npx vitest run sim/hero-damage.test.ts`
Expected: FAIL (`heroDamageScale` neexistuje, rozdíl hp je 100)

- [ ] **Step 3: Schéma, data a `damageHero`**

- `RulesSchema`: `threat: z.object({ heroDamageTaken: positive }).strict()`; `HeroSchema`: `damageTaken: z.number().positive().max(1).optional()`. Doplň `threat` do fixture v `data/schema/schema.test.ts`.
- `HeroEntry.damageTaken?: number`; `map-heroes.ts` ho zapíše jen tehdy, když je v yaml.
- `design/rules.yaml`: `threat: { heroDamageTaken: 2 }` s komentářem (všechno, co jde do hrdiny přes `damageHero`; hrad ne). `design/heroes.yaml`: `damageTaken: 0.75` u stonehorn a redcleaver s komentářem „melee: stands in the crowd“.
- `heroDamageScale(run)` = `rules.threat.heroDamageTaken × (hero.def.damageTaken ?? 1)`; `damageHero` odečte a do `HeroHit` zapíše `amount × heroDamageScale(run)`.
- `npm run data:build -- --source data-source/v20.75/out --out data/generated`.

- [ ] **Step 4: Testy nového chování projdou**

Run: `npx vitest run sim/hero-damage.test.ts tools/data-build data/generated.test.ts`
Expected: PASS

- [ ] **Step 5: Oprav stávající testy s přesným poškozením hrdiny**

Run: `npm run check`. Testy, které porovnávají úbytek hp nebo hodnotu `HeroHit` s přesným číslem, dostanou v očekávání násobek `heroDamageScale(run)` (např. `DAMAGE * CHARGE.damageMultiplier * k * heroDamageScale(run)`). Testy, které jen počítají události, se nemění. Žádné snižování `threat` ve fixturách.
Expected: `npm run check` PASS

- [ ] **Step 6: Commit**

```bash
git add data/schema tools/data-build design/rules.yaml design/heroes.yaml data/generated sim
git commit -m "feat(sim): enemies hit the hero twice as hard, melee heroes take a quarter less"
```

---

### Task 2: Stat Magic Find, jeho matematika a předměty

**Files:**
- Modify: `data/schema/item.ts` (`STAT_IDS` + `magicFind`, komentář „shares“), `data/schema/rules.ts` (`magicFind`, export `RarityWeightsSchema` a typu `RarityWeights`, `drops[].weights` přes něj), `data/schema/index.ts` (export typu), `data/schema/schema.test.ts` (fixture)
- Create: `sim/magic-find.ts`, `sim/magic-find.test.ts`
- Modify: `sim/gear.ts` (`emptyGearBonus`, nulování v `recomputeGear`), `sim/index.ts`
- Modify: `design/rules.yaml`, `design/items.yaml` (10 předmětů z tabulky výše, hlavička: „1 point = … = 2 % magic find“), `data/generated/*.json`
- Modify: `data/generated.test.ts` (`magicFind: 0.02` v tabulce bodů; nové testy)
- Modify: `client/ui/item-lines.ts` (`magicFind` mezi procentní staty), `client/ui/messages-en.ts`, `client/ui/messages-cs.ts`, `client/ui/item-lines.test.ts` (seznam statů)

**Interfaces:**
- Produces (`sim/magic-find.ts`, exportované i ze `sim/index.ts`):
  - `effectiveMagicFind(magicFind: number, limit: number): number` – `magicFind × limit / (magicFind + limit)`, 0 pro `magicFind ≤ 0`.
  - `magicFindWeights(weights: RarityWeights, magicFind: number, rules: Rules["magicFind"]): RarityWeights` – nový objekt; nejnižší rarita z `weights` (v pořadí `RARITIES`) má váhu beze změny, každá vyšší `w × (1 + eff × rarityFactor[rarity])`.
  - `drawRarity(weights: RarityWeights, rng: Rng): Rarity` – přesně dnešní los z `rollDrop`: rarity v pořadí `RARITIES`, jeden `rng.next() × součet`, odečítání, poslední vypsaná rarita jako záloha.
  - `GearBonus.magicFind: number` (součet podílů, 0.12 = 12 %).
- `type RarityWeights = Partial<Record<Rarity, number>>` z `data/schema`.

- [ ] **Step 1: Napiš padající testy v `sim/magic-find.test.ts`**

```ts
it("magic find has diminishing returns", () => {
  expect(effectiveMagicFind(0, 1.5)).toBe(0);
  expect(effectiveMagicFind(0.5, 1.5)).toBeCloseTo(0.375, 9);
  expect(effectiveMagicFind(1, 1.5)).toBeCloseTo(0.6, 9);
  expect(effectiveMagicFind(3, 1.5)).toBeCloseTo(1, 9);
});
it("higher rarities grow faster, the lowest keeps its weight", () => {
  const w = magicFindWeights({ common: 55, rare: 30, epic: 12, legendary: 2.5, mythic: 0.5 }, 1, RULES);
  expect(w).toEqual({ common: 55, rare: 48, epic: 22.8, legendary: 5.5, mythic: 1.25 }); // toBeCloseTo po klíčích
});
it("the lowest rarity of a boss table keeps its weight", () => {
  expect(magicFindWeights({ epic: 75, legendary: 25 }, 1, RULES)).toEqual({ epic: 75, legendary: 55 });
});
it("a huge magic find stays bounded", () => {
  const w = magicFindWeights({ common: 1, mythic: 1 }, 1e6, RULES);
  expect(w.mythic!).toBeLessThanOrEqual(1 + 1.5 * 2.5);
  expect(Number.isFinite(w.mythic!)).toBe(true);
});
it("drawRarity takes exactly one value from the generator and is deterministic", () => { /* stav Rng po losu = po jednom next() */ });
```

`RULES = { limit: 1.5, rarityFactor: { rare: 1, epic: 1.5, legendary: 2, mythic: 2.5 } }`.

V `data/generated.test.ts`: přesně 10 předmětů nese `magicFind` (ids z tabulky výše); součet `magicFind` nejlepšího epic+ MF buildu (pendant, oba epické prsteny, belt, compass, hourglass) × (1 + 0.15 × 4) je mezi 0.95 a 1.15; rozpočty všech předmětů dál v ±10 %.

- [ ] **Step 2: Spusť testy, musí padat**

Run: `npx vitest run sim/magic-find.test.ts data/generated.test.ts`
Expected: FAIL (modul neexistuje, žádný předmět s `magicFind`)

- [ ] **Step 3: Implementuj schéma, `sim/magic-find.ts`, `GearBonus.magicFind`, data a texty**

`design/rules.yaml`: `magicFind: { limit: 1.5, rarityFactor: { rare: 1, epic: 1.5, legendary: 2, mythic: 2.5 } }` s komentářem vzorce. Texty: `gear.stat.magicFind` EN „magic find“, CS „magický nález“. Pak `npm run data:build -- --source data-source/v20.75/out --out data/generated`.

- [ ] **Step 4: Testy projdou**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add data sim design client/ui
git commit -m "feat(gear): magic find stat with diminishing returns on ten items"
```

---

### Task 3: Magic Find zvedá rarity boss dropů

**Files:**
- Modify: `meta/drop.ts`, `meta/drop.test.ts`
- Modify: `client/game/gear-session.ts`, `client/game/gear-session.test.ts`, `client/ui/hud.ts`, `client/main.ts`

**Interfaces:**
- Consumes: `magicFindWeights`, `drawRarity` (Task 2).
- Produces: `rollDrop(data, save, bossId, seed, order, magicFind = 0): Drop`; `GearSession.onBossDeath(bossId: string, seed: number, order: number, magicFind: number): Drop`; `Hud.dropFor: ((bossId: string, order: number, magicFind: number) => Drop) | null`, volané s `run.hero.gear.magicFind`.

- [ ] **Step 1: Napiš padající testy v `meta/drop.test.ts`**

```ts
it("magic find makes the higher rarities of a boss more likely", () => {
  const share = (mf: number) => { /* dread-regent, prázdná sbírka, seedy 1..2000, order 0: podíl legendary + mythic */ };
  expect(share(0)).toBeGreaterThan(0.45); expect(share(0)).toBeLessThan(0.55);   // 50 / 100
  expect(share(1)).toBeGreaterThan(0.64); expect(share(1)).toBeLessThan(0.74);   // 113 / 163
});
it("the lowest rarity of the table keeps its weight", () => {
  // iron-marshal s MF 1: podíl common kolem 60 / (60 + 64) = 0.484 (pásmo 0.44–0.53 na 2000 seedech)
});
```

Stávající testy `rollDrop` se nemění a musí projít (MF 0 = stejný los). V `gear-session.test.ts`: `onBossDeath` předá MF dál (stejné seedy, MF 0 vs 3 dají u dread-regent jiný počet legendary+mythic přes 200 seedů).

- [ ] **Step 2: Spusť testy, musí padat**

Run: `npx vitest run meta/drop.test.ts client/game/gear-session.test.ts`
Expected: FAIL (MF nemá vliv)

- [ ] **Step 3: Implementuj** – `rollDrop` losuje `drawRarity(magicFindWeights(table.weights, magicFind, data.rules.magicFind), rng)`; zbytek (pořadí pokusů o raritu) beze změny. Klient předá MF hrdiny v okamžiku `BossDeath`.

- [ ] **Step 4: Testy projdou**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add meta client
git commit -m "feat(meta): magic find raises the rarity of boss drops"
```

---

### Task 4: Nabídka truhly s hozenou raritou (simulace a autopilot)

**Files:**
- Modify: `data/schema/rules.ts` (`chests.rarityWeights: RarityWeightsSchema`), `data/schema/schema.test.ts`, `design/rules.yaml`, `data/generated/*.json`
- Modify: `sim/chests.ts`, `sim/chests.test.ts`, `sim/run.ts` (volání a komentář pořadí), `sim/hash.ts`, `sim/bot.ts`, `sim/bot.test.ts`, `sim/index.ts`
- Modify: `tools/sim-run/run.test.ts` (fixture `chestOffer`)
- Modify: `client/ui/cards.ts`, `client/ui/chest-lines.ts` jen tak, aby se přeložily (vzhled je Task 5)

**Interfaces:**
- Consumes: `drawRarity`, `magicFindWeights` (Task 2).
- Produces (`sim/chests.ts`, exportované i ze `sim/index.ts`):
  - `const ChestAction = { New: 0, Replace: 1, Level: 2 } as const; type ChestAction = 0 | 1 | 2`
  - `interface ChestCard { slot: number; item: number; action: ChestAction }` – `item` je index do `data.items`.
  - `interface ChestOffer { cards: ChestCard[] }`
  - `rollChestOffer(run: Run): ChestOffer` – los karet podle tabulky výše (neukládá, nemění stav kromě `chestRng`).
  - `applyChestCard(run: Run, card: ChestCard): void` – změna gearu, `recomputeGear`, událost `ChestPick`.
  - `chooseChestCard(run: Run, index: number): void` – nahrazuje `chooseChestSlot`: `applyChestCard`, nové místo truhly, `ChestSpawn`, stav `"playing"`.
  - `botChestChoice(run: Run): number` s pravidlem z tabulky výše.

- [ ] **Step 1: Napiš padající testy v `sim/chests.test.ts`** (stávající testy přepiš z `slots` na `cards`)

```ts
it("an offer has three cards in different slots, each with an item of its slot type", () => { /* item.slotType === slotTypeOf(card.slot) */ });
it("a rolled rarity with no free slot falls one step", () => {
  // rarityWeights = { mythic: 1 }, slotsPerOffer = 16, prázdný gear:
  // 4 karty mythic (trinket1, trinket2, mainHand, offHand), 12 karet epic
});
it("the item of a ring or trinket card is one the other slot does not wear", () => {
  // ring1 nosí ring-of-the-keen-eye, rarityWeights = { epic: 1 }, slotsPerOffer = 16 → karta ring2 nese seal-of-the-archivist
});
it("an empty slot gets the rolled item at a chest level of 1", () => { /* action New, base 0, temp 1 */ });
it("a higher rarity replaces the worn item and keeps the whole slot level plus one", () => {
  // slot nosí rare s base 2, temp 1; karta epic Replace → item = hozený, base 0, temp 4
});
it("the same or a lower rarity adds a level to the worn item", () => { /* action Level, card.item = nasazený, temp + 1 */ });
it("a legendary from a chest brings its effect at once", () => { /* skysplitter do mainHand → fx.chainEvery > 0 */ });
it("ChestPick names the slot, the level, the item and the action", () => { /* a, value, u, v */ });
it("magic find shifts the rarities of chest cards", () => {
  // běhy se seedy 1–300, v každém jedno rollChestOffer s hero.gear.magicFind 0, pak znovu s 1: s MF 1 víc epic+ karet
});
it("a replaced permanent item stays in the loadout given to the run", () => {
  // loadout s wardens-helm úrovně 3 v head; Replace epic přilbou; loadout objekt deep-equals svou kopii před během
});
it("the only mythic trinket in both trinket slots does not double its effect", () => {
  // trinket1 nosí seal-of-the-royal-treasury; New stejného do trinket2 → fx.goldHeal jako s jedním kusem
});
it("the state hash sees the cards of an open chest", () => { /* změna card.item mění stateHash */ });
```

V `sim/bot.test.ts`: `Replace` epic vyhrává nad `Replace` rare i `New` legendary; `New` legendary nad `New` common; bez `Replace` a `New` vyhrává `Level` slotu s nejnižší úrovní.

- [ ] **Step 2: Spusť testy, musí padat**

Run: `npx vitest run sim/chests.test.ts sim/bot.test.ts`
Expected: FAIL (`rollChestOffer`, `cards` neexistují)

- [ ] **Step 3: Implementuj** – `rarityWeights: { common: 55, rare: 30, epic: 12, legendary: 2.5, mythic: 0.5 }` do `design/rules.yaml` s komentářem (spec 4.3), regenerace dat. `updateChests` volá `run.chestOffer = rollChestOffer(run)`; `run.chestOrder` a `run.basicItems` smaž, pokud je už nic nepoužívá (common předmět dnes `basicItems` dával; teď ho dá los rarity common). `stateHash` mixuje `slot + 1`, `item + 1`, `action` každé karty. `Run.step` volá `chooseChestCard`.

- [ ] **Step 4: Testy projdou**

Run: `npm run check`
Expected: PASS (klient se přeloží; `tools/sim-run/run.test.ts` s `cards` fixture)

- [ ] **Step 5: Commit**

```bash
git add data design sim tools client
git commit -m "feat(sim): chest cards roll an item rarity, a higher rarity replaces the worn item"
```

---

### Task 5: Karty truhly, Magic Find v UI a zpráva o kořisti (klient)

**Files:**
- Modify: `client/ui/chest-lines.ts`, `client/ui/chest-lines.test.ts`, `client/ui/cards.ts`, `client/ui/style.css`
- Modify: `client/ui/doll.ts`, `client/ui/doll.test.ts`, `client/ui/gear-screen.ts`, `client/ui/gear-panel.ts` (součet MF)
- Modify: `client/ui/hud.ts` (zpráva z `ChestPick`), `client/ui/messages-en.ts`, `client/ui/messages-cs.ts`
- Modify: `client/game/debug.ts` (`chestCards`), `e2e/game.spec.ts`, `AGENTS.md` (pole `chestCards`)

**Interfaces:**
- Consumes: `ChestCard`, `ChestAction` (Task 4); `tooltipLines` z `client/ui/item-tooltip.ts`; `iconSvg` z `client/ui/item-icons.ts`.
- Produces: `chestLines(lang: Lang, data: GameData, gear: GearState, card: ChestCard): ChestLines`, kde `ChestLines = { title: string; slot: string; slotType: SlotType; rarity: Rarity; rarityName: string; action: string; lines: { text: string; tone: LineTone }[] }`. `DollTotals` dostane `magicFind: number`.

Texty (EN / CS):
- `chest.title`: „Chest: choose your loot“ / „Truhla: vyber si kořist“
- `chest.new` (beze změny): „new for this run“ / „nové na tento běh“
- `chest.replace`: „replaces {name} for this run“ / „nahradí {name} do konce běhu“
- `chest.level` (beze změny): „level {from} → {to}“ / „úroveň {from} → {to}“
- `chest.loot`: „Chest: {name}“ / „Truhla: {name}“
- `gear.total.magicFind`: „Magic Find“ / „Mag. nález“

- [ ] **Step 1: Napiš padající testy v `client/ui/chest-lines.test.ts`**

```ts
it("a new item shows its stats at level 1 and 'new for this run'", () => { /* action New: lines = itemLines(lvl 1), tone plain */ });
it("a replacement compares with the worn item and names it", () => {
  // nasazený rare úrovně 3, karta epic Replace: action = "nahradí <jméno> do konce běhu",
  // řádky z tooltipLines(lang, data, epic, 0, 4, { item: rare, level: 3 }) s tóny better/worse
});
it("a level card shows the worn item from → to", () => { /* title = nasazený, action "úroveň 3 → 4" */ });
it("the rarity name and the slot type travel with the card", () => { /* rarityName "Epický", slotType */ });
```

V `doll.test.ts`: součty ukazují Magic Find v procentech („12 %“ pro 0.12). V `e2e/game.spec.ts` (test truhly): titulek „Truhla: vyber si kořist“; `__game.chestCards` má 3 položky a jméno předmětu první karty (`data.items` přes id) je v textu první karty; po výběru první karty platí `__game.gear` pro její slot (`New`: `base 0, temp 1`).

- [ ] **Step 2: Spusť testy, musí padat**

Run: `npx vitest run client/ui/chest-lines.test.ts client/ui/doll.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementuj** – karta: glyf slotu (`iconSvg`), jméno v barvě rarity (třída `rarity-<rarity>` jako dnes), řádek rarity, řádek akce, stat řádky s třídou tónu jako v tooltipu (`tooltip-line <tone>` styly přenes nebo sdílej). HUD: `ChestPick` s akcí `New`/`Replace` a předmětem legendary nebo mythic → `announcer.push(t(lang, "chest.loot", { name }), ANNOUNCE_TICKS, "rarity-<rarity>")`. Součty panenky: buňka Magic Find z `hero.gear.magicFind` (gear screen i panel C).

- [ ] **Step 4: Testy projdou**

Run: `npm run check && npm run build && npx playwright test --project=webgl2-fallback`
Expected: PASS

- [ ] **Step 5: Vizuální kontrola**

Run: `npm run shots` a otevři screenshot karet truhly z e2e přílohy (`chest-webgl2-fallback`). Karta: čitelná rarita, žádné přetečení textu ve CS.

- [ ] **Step 6: Commit**

```bash
git add client e2e AGENTS.md
git commit -m "feat(ui): chest cards show the rolled item, its rarity and what it replaces"
```

---

### Task 6: Měření síly truhel a ladění vah

**Files:**
- Create: `tools/sim-run/chest-power.ts`, `tools/sim-run/chest-power.test.ts`
- Modify: `package.json` (`"sim:chests": "tsx tools/sim-run/chest-power.ts"`), `AGENTS.md` (Commands)
- Modify: `design/rules.yaml` (`rarityWeights`), `data/generated/*.json`

**Interfaces:**
- Consumes: `rollChestOffer`, `applyChestCard`, `botChestChoice` (Task 4); `gainXp`, `xpToNext`.
- Produces: `chestPower(data: GameData, heroId: string, seed: number, options: { chests: number; level: number }): ChestPower`, kde `ChestPower = { hp: number; attack: number; spells: number; picks: Record<"new" | "replace" | "level", number>; rarities: Record<Rarity, number> }` (poměry po/před, počty výběrů a rarit vybraných předmětů); `formatChestPower(heroId: string, rows: ChestPower[]): string` (průměry). CLI: `--seeds a-b` (výchozí 1-200), `--chests` (15), `--level` (25), `--hero` (`all`).

- [ ] **Step 1: Napiš padající testy v `tools/sim-run/chest-power.test.ts`**

```ts
it("fifteen chests make a bare hero stronger and the measure is deterministic", () => {
  const a = chestPower(gameData(), "stonehorn", 3, { chests: 15, level: 25 });
  expect(a).toEqual(chestPower(gameData(), "stonehorn", 3, { chests: 15, level: 25 }));
  expect(a.hp).toBeGreaterThan(1); expect(a.attack).toBeGreaterThan(1); expect(a.spells).toBeGreaterThan(1);
  expect(a.picks.new + a.picks.replace + a.picks.level).toBe(15);
});
it("the summary line gives the averages", () => {
  expect(formatChestPower("stonehorn", [row(1.4, 1.6, 1.5), row(1.6, 1.4, 1.5)]))
    .toContain("stonehorn: hp x1.50, attack x1.50, spells x1.50, mean x1.50");
});
```

- [ ] **Step 2: Spusť testy, musí padat**

Run: `npx vitest run tools/sim-run/chest-power.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementuj nástroj** – běh `createRun(data, { seed, hero, durationSeconds: 100000 })`, XP do úrovně 25 jedním `gainXp` (součet `xpToNext` pro úrovně 1–24, karty se nevybírají), poměry podle tabulky „Měření síly“, pak 15× los + volba autopilota + `applyChestCard`. Výstup: řádek na hrdinu a řádek `all` s průměrem tří poměrů.

- [ ] **Step 4: Testy projdou**

Run: `npx vitest run tools/sim-run/chest-power.test.ts`
Expected: PASS

- [ ] **Step 5: Změř a dolaď váhy**

Run: `npm run sim:chests -- --seeds 1-200`
- `all … mean` v 1.45–1.55: hotovo.
- Pod 1.45: posuň váhy k vyšším raritám (common nejméně 25, legendary nejvýš 6, mythic nejvýš 2), `data:build`, měř znovu.
- Když ani na těchto mezích průměr nedosáhne 1.45: přidej `rules.gear.chestLevelStep` (volitelné, výchozí = `levelStep`) a změň `itemStatAt(value, level, levelStep)` na `itemStatAt(value, base, temp, gear: Rules["gear"])` = `value × (1 + levelStep × max(base − 1, 0) + chestLevelStep × (base > 0 ? temp : max(temp − 1, 0)))` ve všech voláních (TypeScript je ukáže: `sim/gear.ts`, `client/ui/chest-lines.ts`, `item-tooltip.ts`, `item-lines.ts`). Test v `sim/gear.test.ts`: s `chestLevelStep = levelStep` dává stejná čísla jako dřív; s `chestLevelStep = 0.4` dá `base 0, temp 3` násobek 1.8. Zvol nejmenší `chestLevelStep`, který dá 1.45–1.55, při vahách z mezí výše.
- Nad 1.55: posuň váhy k commonu.

Zapiš si výsledek (řádky na hrdinu a `all`) pro Task 7.

- [ ] **Step 6: Commit**

```bash
git add tools/sim-run package.json AGENTS.md design data sim client
git commit -m "feat(tools): sim:chests measures chest power; tune chest rarity weights"
```

---

### Task 7: Bilance, dokumentace a PR

**Files:**
- Modify: `docs/DECISIONS.md` (nový oddíl nahoře), `docs/STATUS.md`

- [ ] **Step 1: Čísla „před“ z `main`**

```bash
git fetch --depth=1 origin main && git worktree add /tmp/dw-main FETCH_HEAD
ln -s "$PWD/node_modules" /tmp/dw-main/node_modules
cd /tmp/dw-main && for g in none mid full; do for s in 1-20 21-40; do npm run sim:run -- --hero all --seeds $s --gear $g; done; done
```

Expected: souhrny pro 8 hrdinů, 6 sad.

- [ ] **Step 2: Čísla „po“ na `chest-loot`** – stejné příkazy v repu. Hlídej: podíl proher pádem hradu (spec 5.2) a hrdiny s 0–1 výhrou z 20 na obou sadách bez gearu (neladit, jen označit pro Petra).

- [ ] **Step 3: Zápis**
- `docs/DECISIONS.md`, oddíl „Chest loot, Magic Find and enemy threat (2026-11-18; Petr chose the direction, the numbers are Claude's)“: násobitel 2 a 0.75, vzorec MF a jeho čísla, 10 předmětů s MF, pravidlo nabídky a výměny, autopilot, konečné váhy (a `chestLevelStep`, pokud vznikl), výstup `sim:chests`, tabulka výher před/po (none, mid, full × obě sady), podíl proher hradem, hrdinové označení pro Petra.
- `docs/STATUS.md`: oddíl tohoto plánu nahoře (co přináší, co Petr testuje: jsou truhly cítit, bolí chyba, čtou se karty a rarity, zpráva o legendary; quick links `?debug=1` s `__game.debug.grantGold(5000)`), „Open for Petr“ pro výhry, další krok: plán sdílených kouzel (jejich pásmo 6–12 proti novému stavu). Stejný obsah do `claude/STATUS.md` v projektu.

- [ ] **Step 4: Plná kontrola**

Run: `npm run check && npm run build && npx playwright test --project=webgl2-fallback`
Expected: PASS

- [ ] **Step 5: Commit, push, PR**

```bash
git add docs && git commit -m "docs: decisions and status for chest loot, magic find and enemy threat"
git -c push.negotiate=true push -u origin chest-loot
gh api -X POST repos/Wizzik/defense-webgame/pulls -f title="Chest loot, magic find and enemy threat" -f head=chest-loot -f base=main -f body="..."
```

Tělo PR: co přináší, tabulka výher, výstup `sim:chests`, co Petr testuje. PR se nemerguje bez Petra.
