# Krocení škálování kouzel, multishot na všechny šípy a porovnání předmětu z truhly – implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kouzla rostou od úrovně 1 k maximu 3–5× místo 10–50× a Inteligence dává poloviční sílu kouzel, každý šíp multishotu dostane bonus Žhavých nábojů a u obsazeného slotu truhla ukáže nasazený a nabízený předmět vedle sebe a hráč si vybere.

**Architecture:**
- Zploštění křivek je jedno pravidlo v `data:build` (`tools/data-build/scaling.ts`, `Math.pow` je v `tools/` povolený): po násobení `abilities.damage` se každý řádek poškození a léčení přepočte exponentem růstu. `sim/` dostane hotová čísla, nic v simulaci se kvůli křivkám nemění.
- Měření „přebití“ je rozšíření `sim:run`: běh si na začátku fází 5, 10, 15 a 20 zapíše jedno seslání nejsilnějšího podpisového kouzla a průměrný zásah základního útoku; souhrn hrdiny k tomu vypíše poměr k hp Štítonoše a Kopiníka v té fázi.
- Truhla má místo akce `Replace` akci `Choice`. Volba „nechat / vzít“ je bit `InputAction.KeepWorn` ve vstupu kroku (karta zůstává v `input.card`), takže replay zůstává deterministický a `TickInput` nemění tvar. Klient má nový panel porovnání; jeho text skládá čistá funkce s testy.

**Tech Stack:** beze změny a bez nových závislostí (Node 22, TypeScript, Vite, Vitest, zod, yaml, tsx, Playwright podle `package-lock.json`). Žádné nové assety.

**Spec:** `docs/superpowers/specs/2026-11-19-spell-scaling-chest-compare-design.md`. Executor čte spec i plán.

**Větev:** `spell-scaling` (vychází z `main` po PR #17, `325af0f`; spec a status už na ní jsou). PR jde proti `main`.

## Global Constraints

- `sim/` a `meta/` jsou čisté a deterministické (`AGENTS.md`): žádné `Math.pow`, `**` ani další zakázané funkce v simulaci; přepočet křivek jen v `tools/data-build`.
- `Run.step()` v běžném kroku nealokuje; multishot s bonusem nesmí přidat alokaci.
- `data/generated/*.json` se needituje ručně. `data:build` potřebuje export mapy v `data-source/v20.75/out/`; když chybí, stáhni mapu ze souboru `X_Hero_Siege_F-Day_v20.75_AI.w3x` v claude.ai projektu (Projects `project_read` s `original: true`) a spusť `npm run map:extract -- <mapa.w3x> v20.75`. Pak `npm run data:build -- --source data-source/v20.75/out --out data/generated`.
- Texty pro hráče v EN a CS, vlastní, nic z mapy. Kód, identifikátory a komentáře anglicky. Žádná oranžová; barvy rarit beze změny. Čitelnost v 1280×720.
- Úroveň 1 každého kouzla se nemění. Počty, dosahy, trvání a cooldowny kouzel se nemění. Nepřátelé, bossové, hrad a `rules.threat` (2× poškození na hrdinu) se nemění.
- Knoflíky ladění jen `abilities.levelGrowthExponent` (0,4–0,7) a `rules.hero.spellPowerPerInt` (0,003–0,01). Kity hrdinů se nepřepisují.
- Conventional Commits, commit až po `npm run check`. Identita `Claude <noreply@anthropic.com>` a trailery relace.
- `npm run check`, `npm run build` a `npx playwright test --project=webgl2-fallback` projdou. PR proti `main`, merge až po Petrově slovu.

## Co plán rozhoduje navíc ke specu

| Téma | Rozhodnutí |
|---|---|
| Klíč v `design/scaling.yaml` | `abilities: { cooldown: 0.33, damage: 0.3, levelGrowthExponent: 0.5 }`. `parseScaling` ho vyžaduje; platí `0 < e ≤ 1` (jinak chyba s cestou `abilities.levelGrowthExponent`). |
| Pořadí přepočtu | V `scaleAbility` nejdřív dnešní `whole(v × damage)`, pak růst na zaokrouhlené řadě: `out[0] = r[0]`; `out[L] = whole(r[0] × (r[L] / r[0]) ^ e)`, když `r[0] > 0` a `r[L] > 0`, jinak `r[L]` beze změny. Platí pro `DAMAGE_PARAMS` (`damage`, `tickDamage`, `amount`, `bonusDamage`), tedy i pro hodnoty `design` a ultimátky. |
| Bonus vedlejšího šípu | Vedlejší šíp dostane přesně `bonus`, který `onHitBonus` vrátil pro hlavní šíp (žádný nový los šance, žádná další událost `Cast`): `(rollDamage + bonus) × (1 − armor cíle)`. Empower jen hlavní šíp, efekty výbavy (`onGearAttack`) jen hlavní šíp. Pozn.: `onHitBonus` dnes sílu kouzel nenásobí; spec 4.4 „včetně síly kouzel“ se tu čte jako „stejně jako hlavní šíp“ a násobení se nepřidává. |
| Akce karty | `ChestAction = { New: 0, Choice: 1, Level: 2 }`. `Choice`: obsazený slot a hozený předmět je jiný než nasazený (jakákoli rarita), karta nese hozený předmět. `Level`: hozený předmět = nasazený, karta nese nasazený. Los (spotřeba `chestRng`) je stejný jako dnes. |
| Volba ve vstupu | `InputAction.KeepWorn = 8`. V `chest` stavu `chooseChestCard(run, input.card, (input.actions & KeepWorn) !== 0)`. Bez bitu se karta `Choice` „vezme“. Bit u `New` a `Level` nic nemění. |
| Provedení | `Choice` + vzít = dnešní Replace (`temp ← base + temp + 1`, `base ← 0`, `item ← hozený`); `Choice` + nechat = dnešní Level (`temp + 1`). |
| Událost `ChestPick` | `v` = `New` (nový do prázdného slotu), `Choice` (vzal hozený), `Level` (+1 nasazenému, i u nechané volby). `chestLootLine` hlásí `New` a `Choice`. |
| Autopilot | `botChestChoice` vrací index: nejdřív `Choice` s vyšší raritou než nasazený (nejvyšší rarita), pak `New` (nejvyšší rarita), pak slot s nejnižší `base + temp` mezi `Level` a `Choice` bez vyšší rarity. `botChestKeep(run, card)` = `Choice` a hozená rarita ≤ nasazená. Výběr i výsledek jsou totožné s dneškem, takže truhly samy bilanci nemění. |
| `__game` | `chestCards[].action`: `"new" \| "choice" \| "level"`; `chestCompare: number \| null` (index porovnávané karty); `debug.chooseChest(index, side: "keep" \| "take")` jde přes vstup kroku; `debug.wear(slotId, itemId)` nasadí předmět do slotu běhu (chest level 1) kvůli testům. |
| Panel porovnání | `#chest-compare` uvnitř `#cards`; po otevření je řada karet a nápověda skrytá. Klávesy ve stavu porovnání: `1` nechat, `2` vzít, `Esc` zpět. Jeden posluchač kláves v `Cards` rozhoduje, kam klávesa jde, aby `1` v porovnání nevybralo kartu 1. |
| Měření | `sim:run` vždy tiskne řádek `burst` (formát v Tasku 2). Kouzlo „jednoho seslání“ = první z `damage`, `bonusDamage`, `tickDamage` na úrovni slotu × `spellPower`; léčení se nepočítá; podpisové sloty 0–2. HP nepřítele = `hp × timeScale(rules, (P − 1) × phaseSeconds × 30)`. Kouzla brnění ignorují, poměr je bez brnění. |

## Review Focus

1. **Řada s nulou na úrovni 1, plochá řada nebo kouzlo s jednou úrovní** (`[0, 50, 100]`, Hadí totem `18 × 5`, `[120]`): beze změny, žádné `NaN` ani `Infinity` v datech (test v Tasku 1).
2. **Klávesa `1` v otevřeném porovnání:** nechá nasazený předmět, nevybere první kartu pod panelem; `Esc` vrátí tři karty a truhla zůstane otevřená, čas stojí (e2e v Tasku 5).
3. **Bit „nechat“ u karty `New` nebo `Level` a špatný index:** karta se provede normálně, špatný index nic nezmění (test v Tasku 4).
4. **Volba u permanentního předmětu** (`base 3, temp 1`): nechat dá `base 3, temp 2`, vzít dá hozený s `base 0, temp 5`; loadout předaný do běhu se nezmění (test v Tasku 4).
5. **Stat, který má jen jeden z předmětů, a efekt legendary/mythic:** řádek u druhého sloupce prázdný, ne `+0`; efekt pod staty svého sloupce (test v Tasku 5).

---

### Task 1: Zploštit křivky kouzel a změkčit sílu kouzel z Inteligence

**Files:**
- Modify: `tools/data-build/scaling.ts`, `tools/data-build/scaling.test.ts`, `tools/data-build/fixtures/design/scaling.yaml`
- Modify: `design/scaling.yaml`, `design/rules.yaml`, `data/generated/*.json` (regenerace)
- Modify: testy, které pinují staré číslo kouzla na úrovni ≥ 2 nebo `spellPowerPerInt` z dat (ukáže `npm run check`)

**Interfaces:**
- Produces: `Scaling.abilities.levelGrowthExponent: number`; `scaleAbility(ability, s)` beze změny podpisu.

- [ ] **Step 1: Napiš padající testy v `tools/data-build/scaling.test.ts`** (`parseScaling` s `abilities: { cooldown: 1, damage: 1, levelGrowthExponent: 0.5 }`)

```ts
it("flattens the growth of damage and heal rows from level 1", () => {
  const ability = scaleAbility({ cooldown: [1], params: {
    damage: [90, 180, 360, 750, 1500], amount: [150, 300, 600, 1500, 3000], bonusDamage: [300, 600, 900, 1200, 1500],
    tickDamage: [18, 18, 18, 18, 18], radius: [350, 400, 450, 500, 550], extraTargets: [1, 1, 2, 2, 3],
  } } as never, s);
  expect(ability.params).toEqual({
    damage: [90, 127, 180, 260, 367], amount: [150, 212, 300, 474, 671], bonusDamage: [300, 424, 520, 600, 671],
    tickDamage: [18, 18, 18, 18, 18], radius: [350, 400, 450, 500, 550], extraTargets: [1, 1, 2, 2, 3],
  });
});
it("leaves a row with zero at level 1 and a one-level row alone", () => {
  // damage: [0, 50, 100] -> [0, 50, 100]; amount: [120] -> [120]; žádné NaN
});
it("growth applies after the damage multiplier", () => {
  // damage 0.5, exponent 0.5: damage [180, 3000] -> whole scale [90, 1500] -> [90, 367]
});
it("rejects a missing or out-of-range levelGrowthExponent", () => {
  // chybí, 0, 1.5 -> chyba obsahující "abilities.levelGrowthExponent"
});
```

Stávající testy v souboru dostanou ve `parseScaling({...})` `levelGrowthExponent: 1` (exponent 1 = dnešní chování). Fixture `tools/data-build/fixtures/design/scaling.yaml` dostane `levelGrowthExponent: 1`.

- [ ] **Step 2: Spusť testy, musí padat**

Run: `npx vitest run tools/data-build/scaling.test.ts`
Expected: FAIL (klíč je neznámý, řady beze změny)

- [ ] **Step 3: Implementuj růst v `scaleAbility`** podle tabulky „Pořadí přepočtu“; `SHAPE.abilities` dostane `levelGrowthExponent`, kontrola rozsahu `0 < e ≤ 1` v `parseScaling`. Komentář u `DAMAGE_PARAMS` doplň o růst.

- [ ] **Step 4: Testy projdou**

Run: `npx vitest run tools/data-build`
Expected: PASS

- [ ] **Step 5: Data**
- `design/scaling.yaml`: `abilities: { cooldown: 0.33, damage: 0.3, levelGrowthExponent: 0.5 }` s komentářem (spec 4.1: `value[L] = value[1] × (value[L]/value[1])^e`, úroveň 1 beze změny; Petr 2026-11-19, cesta A).
- `design/rules.yaml`: `spellPowerPerInt: 0.005` s komentářem (dříve 0.01, spec 4.2).
- `npm run data:build -- --source data-source/v20.75/out --out data/generated`.
- Kontrola tabulky spec 4.1: `node -e 'const a=require("./data/generated/abilities.json");for(const id of ["forked-bolt","mending-tide","rock-rupture","cleaver-toss","stunning-tide","searing-rounds","meteor","groundbreaker"]){const p=a.find(x=>x.id===id).params;console.log(id,JSON.stringify(p.damage??p.amount??p.bonusDamage))}'`
Expected: maxima 367, 671, 474, 300, 212, 671, 765, 1697; úrovně 1 jako dřív (90, 150, 150, 61, 30, 300, 300, 1200).

- [ ] **Step 6: Oprav testy s pinutými čísly**

Run: `npm run check`. Testy, které čtou poškození kouzla z dat, ale porovnávají s literálem úrovně ≥ 2, přepiš na čtení z `data` (`def.params.damage[L]`) nebo na nové číslo. Testy s vlastní fixturou pravidel (`spellPowerPerInt: 0.01` v `sim/hero.test.ts`, `sim/hero-combat.test.ts`) se nemění.
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add tools/data-build design data/generated sim
git commit -m "feat(data): flatten spell growth from level 1 and halve spell power per Int"
```

---

### Task 2: Měření přebití v `sim:run`

**Files:**
- Create: `tools/sim-run/burst.ts`, `tools/sim-run/burst.test.ts`
- Modify: `tools/sim-run/run.ts` (`RunSummary`, `playBot`, `formatHeroSummary`), `tools/sim-run/run.test.ts` (fixtury souhrnů dostanou nová pole)

**Interfaces:**
- Consumes: `timeScale(rules, tick)` ze `sim/spawner.ts`; `ULTIMATE_SLOT`, `isEmptySlot` ze `sim`.
- Produces: `BURST_PHASES = [5, 10, 15, 20] as const`; `spellBurst(run: Run): number`; `attackHit(run: Run): number` (= `(damageMin + damageMax) / 2`); `RunSummary.burst: (number | null)[]` a `RunSummary.attack: (number | null)[]` (index = pořadí v `BURST_PHASES`, `null` = fáze nedosažena); `burstLine(summaries: RunSummary[], data: GameData): string`.

- [ ] **Step 1: Napiš padající testy v `tools/sim-run/burst.test.ts`**

```ts
it("one cast of the strongest learned signature spell times spell power", () => {
  const run = abilityRun("stonehorn", { 0: 3 });   // rock-rupture úroveň 3
  expect(spellBurst(run)).toBeCloseTo(run.abilities[0]!.def.params.damage![2]! * run.hero.stats.spellPower, 9);
});
it("no learned signature spell gives 0; a heal-only spell is not counted", () => { /* serpent-shaman jen s mending-tide -> 0 */ });
it("burstLine prints the median and the ratios to shieldbearer and lancer hp at the phase start", () => {
  // data z generated, dvě souhrny s burst [100, 200, null, null] a [300, 400, null, null], attack [10, 20, null, null] a [30, 40, null, null]
  // sb = data hp shieldbearer × timeScale(rules, 4 × 50 × 30) atd.
  expect(burstLine(summaries, data)).toBe(
    `  burst p5 spell 200 (sb ${r(200 / sb5)} ln ${r(200 / ln5)}) attack 20 (ln ${r(20 / ln5)}) | ` +
    `p10 spell 300 (sb ${r(300 / sb10)} ln ${r(300 / ln10)}) attack 30 (ln ${r(30 / ln10)}) | p15 - | p20 -`);
}); // r = (x) => x.toFixed(2); medián dvou hodnot = průměr
```

- [ ] **Step 2: Spusť testy, musí padat**

Run: `npx vitest run tools/sim-run/burst.test.ts`
Expected: FAIL (modul neexistuje)

- [ ] **Step 3: Implementuj `burst.ts` a zapoj ho do `playBot`** – zápis při prvním kroku s `run.tick ≥ (P − 1) × phaseTicks` pro každé `P` z `BURST_PHASES` (stejná smyčka jako `phaseXp`); `formatHeroSummary` přidá `burstLine` jako poslední řádek. Medián zaokrouhli `Math.round`.

- [ ] **Step 4: Testy projdou a výstup sedí**

Run: `npx vitest run tools/sim-run && npm run sim:run -- --hero serpent-shaman --seeds 1-3`
Expected: PASS; souhrn končí řádkem `  burst p5 spell …`.

- [ ] **Step 5: Commit**

```bash
git add tools/sim-run
git commit -m "feat(tools): sim:run reports spell burst and base attack against shieldbearer and lancer hp"
```

---

### Task 3: Bonus Žhavých nábojů na každém šípu multishotu

**Files:**
- Modify: `sim/hero-multishot.ts`, `sim/hero.ts`, `sim/abilities/on-hit.test.ts`, `design/abilities.yaml` (komentář u `searing-rounds`)

**Interfaces:**
- Produces: `hitExtraTargets(run: Run, main: number, count: number, stunTicks: number, bonus: number): void`.

- [ ] **Step 1: Přepiš test „only the main shot gets the bonus“ v `sim/abilities/on-hit.test.ts`** na „every shot gets the bonus“: pro vedlejší zásahy platí `≥ (round(damageMin) + 300) × k − 1e-9` a `≤ (round(damageMax) + 300) × k + 1e-9`. Přidej test: s `chance` slotem (`chance: five(0)`, `bonusDamage: five(300)`, `extraTargets: five(2)`) nedostane bonus ani jeden šíp a počet událostí `Cast` je 0.

- [ ] **Step 2: Spusť testy, musí padat**

Run: `npx vitest run sim/abilities/on-hit.test.ts`
Expected: FAIL (vedlejší zásah je bez +300)

- [ ] **Step 3: Implementuj** – `updateHeroCombat` předá `bonus` do `hitExtraTargets`; vedlejší šíp: `(rollDamage(...) + bonus) × (1 − reduction)`. Komentář funkce a komentář v `design/abilities.yaml` přepiš (bonus na každém šípu, Petr 2026-11-19; empower a efekty výbavy jen hlavní šíp).

- [ ] **Step 4: Testy projdou**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add sim design/abilities.yaml
git commit -m "feat(sim): every multishot arrow carries the on-hit bonus"
```

(Změna komentáře v `design/abilities.yaml` mění jen yaml; `data:build` ji nepotřebuje, generovaná data komentáře nenesou.)

---

### Task 4: Truhla v simulaci: karta Volba, nechat nebo vzít

**Files:**
- Modify: `sim/chests.ts`, `sim/input.ts`, `sim/run.ts`, `sim/bot.ts`, `sim/gear.ts` (`debugWear`), `sim/index.ts`
- Modify: `sim/chests.test.ts`, `sim/bot.test.ts`
- Modify (jen aby šel typecheck, chování UI až v Tasku 5): `tools/sim-run/chest-power.ts`, `client/game/debug.ts` (`CHEST_ACTIONS`), `client/ui/chest-lines.ts`, `client/ui/drop-lines.ts`, a jejich testy

**Interfaces:**
- Produces: `ChestAction = { New: 0, Choice: 1, Level: 2 }`; `InputAction.KeepWorn = 8`; `applyChestCard(run: Run, card: ChestCard, keep = false): void`; `chooseChestCard(run: Run, index: number, keep: boolean): void`; `botChestKeep(run: Run, card: ChestCard): boolean`; `debugWear(run: Run, slot: number, item: number): void` (item do slotu, `base 0`, `temp 1`, `recomputeGear`).

- [ ] **Step 1: Napiš padající testy v `sim/chests.test.ts`**

```ts
it("a different item of a lower or equal rarity in a worn slot is a Choice with the rolled item", () => { /* nasazený epic, hozený rare -> action Choice, item = hozený */ });
it("the same item as the worn one is a Level card", () => { /* hozený = nasazený -> Level, item = nasazený */ });
it("keep adds a level to the worn item; take puts the rolled item in with the slot's level + 1", () => {
  // base 3, temp 1: keep -> item stejný, base 3, temp 2, ChestPick v = Level
  //                 take -> item hozený, base 0, temp 5, ChestPick v = Choice; loadout předaný createRun beze změny
});
it("the keep bit on a New or a Level card changes nothing; a bad index changes nothing", () => { /* … */ });
it("the run reads the keep bit from the input", () => {
  // stav chest, karta Choice na indexu i: step({ ...NO_INPUT, card: i, actions: InputAction.KeepWorn }) -> nechá
});
```

A v `sim/bot.test.ts`: testy přepsané z `Replace` na `Choice`; nový test „a Choice of a lower rarity counts as a level: the bot keeps the worn item“ (`botChestKeep` true, index podle nejnižší úrovně slotu) a `botInput` v chest stavu nastaví `actions = KeepWorn` právě tehdy.

- [ ] **Step 2: Spusť testy, musí padat**

Run: `npx vitest run sim/chests.test.ts sim/bot.test.ts; npm run sim:chests -- --seeds 1-50 | tail -3`
Expected: FAIL; výstup `sim:chests` si ulož jako srovnání pro Step 4.

- [ ] **Step 3: Implementuj** podle tabulky (Akce karty, Volba ve vstupu, Provedení, Událost, Autopilot). `rollChestOffer`: místo porovnání rarit `rolled === worn ? Level : Choice`. `Run.step` v chest stavu předá bit. `sim:chests` volá `applyChestCard(run, card, botChestKeep(run, card))` a počítá `new`, `replace` (vzatá volba), `level` (úroveň nebo nechaná volba), takže výstup má stejné sloupce. `idleInput` v `tools/sim-run/run.ts` zůstává (karta 0, bez bitu). Klient: `CHEST_ACTIONS = ["new", "choice", "level"]`, `chestLootLine` hlásí `New` a `Choice`; `chest-lines.ts` u `Choice` zatím ukazuje dnešní text výměny (Task 5 ho změní).

- [ ] **Step 4: Testy projdou a bilance truhel se nepohnula**

Run: `npm run check && npm run sim:chests -- --seeds 1-50`
Expected: PASS; výstup `sim:chests` (řádky hrdinů a `all`) stejný jako v Step 2.

- [ ] **Step 5: Commit**

```bash
git add sim tools/sim-run client
git commit -m "feat(sim): a chest card for a worn slot is a choice; the input says keep or take"
```

---

### Task 5: Panel porovnání v klientu

**Files:**
- Create: `client/ui/chest-compare-lines.ts`, `client/ui/chest-compare-lines.test.ts`, `client/ui/chest-compare.ts`
- Modify: `client/ui/cards.ts`, `client/ui/chest-lines.ts` (+ test), `client/ui/messages-en.ts`, `client/ui/messages-cs.ts`, `client/ui/style.css`
- Modify: `client/game/session.ts` (`setCard(index, keep = false)`), `client/game/debug.ts` (`chestCompare`, `chooseChest`, `wear`), `client/main.ts`
- Modify: `e2e/game.spec.ts` (`pickCard` + nový test), `e2e/shots.spec.ts` (shot `chest-compare`)

**Interfaces:**
- Consumes: `ChestAction.Choice`, `InputAction.KeepWorn`, `debugWear` z Tasku 4; `itemStatAt`, `statValue`, `statLabel`, `LineTone`.
- Produces:
  - `compareLines(lang: Lang, data: GameData, gear: GearState, card: ChestCard): CompareLines`, kde `CompareLines = { keep: CompareSide; take: CompareSide; rows: CompareRow[] }`, `CompareSide = { title: string; rarity: Rarity; rarityName: string; slotType: SlotType; level: string; effect: string | null }`, `CompareRow = { stat: StatId; keep: string; take: string; keepTone: LineTone; takeTone: LineTone; takeNew: boolean }`.
  - `class ChestCompare { readonly open: boolean; show(run, card, index, lang): void; hide(): void; key(code: string): boolean }` (vrací, zda klávesu použil); `Cards.comparing: number | null`; `Cards` konstruktor `onPick: (index: number, keep: boolean) => void`.
  - `addDebugHooks(..., pick: (index: number, keep: boolean) => void)`; `GameSnapshot.chestCompare: number | null`.

- [ ] **Step 1: Napiš padající testy v `client/ui/chest-compare-lines.test.ts`**

```ts
it("keep shows the worn item one level up, take the rolled item at the slot's level + 1", () => {
  // nasazený rare base 2 temp 1, hozený epic: keep.level = "level 3 → 4", take.level = "level 4 for this run"
});
it("rows line up by stat: the worn item's stats first, then the ones only the rolled item has", () => {
  // stat jen u nasazeného: take = "", takeTone "plain"; stat jen u hozeného: keep = "", takeNew true
  // vyšší hodnota "better", nižší (nenulová) "worse", stejné "plain"
});
it("a legendary or mythic effect goes under its own column", () => { /* effect = item.effect.text[lang], druhá strana null */ });
```

- [ ] **Step 2: Spusť testy, musí padat**

Run: `npx vitest run client/ui/chest-compare-lines.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementuj `compareLines`** – hodnoty přes `itemStatAt` (keep: `base`, `temp + 1`; take: `0`, `base + temp + 1`), text `${statValue} ${statLabel}`. Nové klíče EN/CS:

| klíč | EN | CS |
|---|---|---|
| `chest.choice` | `compare with {name}` | `porovnat s {name}` |
| `chest.keep` | `Keep` | `Nechat` |
| `chest.take` | `Take new` | `Vzít nový` |
| `chest.takeLevel` | `level {n} for this run` | `úroveň {n} do konce běhu` |
| `chest.statNew` | `new` | `nové` |
| `chest.back` | `Back` | `Zpět` |

`chest.replace` zmizí; `chest-lines.ts` u `Choice` použije `chest.choice` a řádky porovnání jako dnes u výměny (test v `chest-lines.test.ts` uprav).

- [ ] **Step 4: Testy projdou**

Run: `npx vitest run client/ui`
Expected: PASS

- [ ] **Step 5: Komponenta a zapojení**
- `ChestCompare` podle náčrtu spec 4.5: nadpis `chest.title`, dva sloupce (`compare-keep`, `compare-take`): ikona slotu, jméno v barvě rarity, slovo rarity, řádek úrovně, řádky statů (tón jako v tooltipu, `▲`/`▼` za hodnotou, `chest.statNew` u `takeNew`), efekt, tlačítko `[1] Nechat` / `[2] Vzít` (`button.compare-keep-button`, `button.compare-take-button`), tlačítko `chest.back`.
- `Cards`: klik nebo klávesa na kartě `Choice` otevře porovnání (karty `New` a `Level` se vyberou hned jako dnes); jeden posluchač kláves: při otevřeném porovnání jde klávesa do `compare.key` (`Digit1`/`Numpad1` nechat, `Digit2`/`Numpad2` vzít, `Escape` zpět) a karty ji nedostanou. Nová nabídka nebo konec stavu `chest` porovnání zavře. `PICK_DELAY_MS` platí i pro tlačítka panelu.
- `Session.setCard(index, keep = false)` uloží `pendingKeep`; ve `frame` po `keyboard.read`: `if (pendingKeep) input.actions |= InputAction.KeepWorn`, pak vynulovat.
- `main.ts`: `new Cards(root, (index, keep) => session.setCard(index, keep))`; snapshot dostává každý snímek `chestCompare = cards.comparing` (přes objekt `ui` vedle `updateSnapshot`); `addDebugHooks(..., (i, keep) => session.setCard(i, keep))`.
- `debug.ts`: `chestCompare` v typu a výchozím snapshotu; `debug.chooseChest(index, side)`; `debug.wear(slotId, itemId)` (neznámý slot nebo předmět: `Error`).
- CSS: dva sloupce vedle sebe, tmavé navy/šedomodré pozadí jako karty, žádná oranžová; v 1280×720 se panel vejde bez posunu.

- [ ] **Step 6: e2e**
- `pickCard`: po kliknutí na první kartu, když je `#chest-compare` vidět, klikne na `button.compare-take-button`.
- Nový test „a chest card for a worn slot opens the compare; Esc goes back, 1 keeps, the take button takes“ (`?seed=1&debug=1&lang=cs`): `debug.wear` nasadí první common předmět každého typu (z `ITEMS`) do všech 16 slotů, `grantGold(1000)`, teleport k truhle; v `chestCards` je karta `"choice"` (když na seedu 1 není, zvol seed, kde je, a napiš proč). Klik na ni → `#chest-compare` vidět, `chestCompare` = index, `tick` stojí; `Escape` → panel skrytý, `chestCompare` null, obrazovka `chest`, tři karty; znovu klik → `Digit1` → `playing`, slot nese stejný předmět s `temp 2`. Druhá truhla: karta `"choice"` → `button.compare-take-button` → slot nese hozený předmět.
- `e2e/shots.spec.ts`: shot `chest-compare` (stejná příprava, `lang=cs`, otevřené porovnání). `AGENTS.md` (seznam shotů) doplní Task 7.

- [ ] **Step 7: Kontrola**

Run: `npm run check && npm run build && npx playwright test --project=webgl2-fallback && npm run shots`
Expected: PASS; prohlédni `test-results/shots/chest-compare.png` (čitelnost, zarovnané řádky, barvy).

- [ ] **Step 8: Commit**

```bash
git add client e2e
git commit -m "feat(client): chest compare panel: keep the worn item or take the new one"
```

---

### Task 6: Vyvážení proti pásmu 6–12 z 20

**Files:**
- Modify (jen knoflíky): `design/scaling.yaml` (`levelGrowthExponent`), `design/rules.yaml` (`spellPowerPerInt`), `data/generated/*.json`

- [ ] **Step 1: Čísla „před“ z `main`**

```bash
git fetch --depth=1 origin main && git worktree add /tmp/dw-main FETCH_HEAD
ln -s "$PWD/node_modules" /tmp/dw-main/node_modules
cd /tmp/dw-main && for g in none mid full; do for s in 1-20 21-40; do npm run sim:run -- --hero all --seeds $s --gear $g; done; done
```

Expected: souhrny 8 hrdinů, 6 sad (řádek `burst` na `main` není; spusť `burst` z větve s dočasně vráceným `scaling.yaml` a `rules.yaml`, jen pro tabulku „před“, a vrať je).

- [ ] **Step 2: Čísla „po“** – stejné příkazy na větvi. Cíle (spec 4.3):
  - bez výbavy každý hrdina 6–12 výher z 20 na seedech 1–20 i 21–40; Gravecaller pod 20;
  - `mid`: víc než polovina z 320 běhů; `full`: všech 320;
  - `burst p20` bez výbavy: `ln` pod 1, `sb` aspoň 0,33.

- [ ] **Step 3: Dolaď knoflíky** – jen `levelGrowthExponent` v 0,4–0,7 a `spellPowerPerInt` v 0,003–0,01; po každé změně `data:build` a krok 2. Když hrdina pásmo nesplní ani na mezích (typicky slabý kit nebo smrt v 2–4 minutách pod dvojnásobným poškozením), neladit dál, zapsat jako otevřený bod. Sparkshot se ladí stejnými knoflíky.

- [ ] **Step 4: Základní útok** – z řádků `burst` zapiš `attack … (ln …)` ve fázích 5–20 pro Petra (spec 2: změřit, neladit).

- [ ] **Step 5: Commit**

Run: `npm run check`
Expected: PASS

```bash
git add design data/generated
git commit -m "balance: tune spell growth exponent and spell power per Int"
```

(Když výchozí 0,5 a 0,005 zůstanou, commit odpadne a krok 2 má jen zápis pro Task 7.)

---

### Task 7: Dokumentace a PR

**Files:**
- Modify: `docs/DECISIONS.md` (nový oddíl nahoře), `docs/STATUS.md`, `AGENTS.md`, `ARCHITECTURE.md` (jen pokud popisuje truhlu nebo scaling)

- [ ] **Step 1: Zápis**
- `docs/DECISIONS.md`, oddíl „Spell scaling, multishot on every arrow, chest compare (2026-11-19; Petr chose the direction, the numbers are Claude's)“: pravidlo růstu a konečný exponent, `spellPowerPerInt`, tabulka kouzel úr. 1 → max (před/po), tabulka `burst` (spell a attack vůči `sb`/`ln`) před/po, tabulka výher před/po (none, mid, full × obě sady), multishot (bonus na každém šípu, empower a výbava jen hlavní), karta Volba a autopilot, otevřené body pro Petra (hrdinové mimo pásmo, růst základního útoku, `onHitBonus` bez síly kouzel).
- `AGENTS.md`: `chestCards[].action` `new | choice | level`, `chestCompare`, `debug.chooseChest(index, "keep" | "take")`, `debug.wear(slotId, itemId)`, shot `chest-compare`, řádek `burst` v popisu `sim:run`, `levelGrowthExponent` v popisu datové pipeline.
- `docs/STATUS.md`: oddíl tohoto plánu nahoře (co přináší; co Petr testuje: je druhá půlka běhu výzva, šaman už není nesmrtelný, multishot, panel porovnání v 1280×720; quick links `?debug=1` s `__game.debug.grantGold(5000)`, `__game.debug.setAbilityLevel(0, 5)`), „Open for Petr“ z DECISIONS, další krok. Stejný obsah do `claude/STATUS.md` v projektu.

- [ ] **Step 2: Plná kontrola**

Run: `npm run check && npm run build && npx playwright test --project=webgl2-fallback`
Expected: PASS

- [ ] **Step 3: Commit, push, PR**

```bash
git add docs AGENTS.md ARCHITECTURE.md && git commit -m "docs: decisions and status for spell scaling, multishot and chest compare"
git -c push.negotiate=true push -u origin spell-scaling
gh api -X POST repos/Wizzik/defense-webgame/pulls -f title="Spell scaling, multishot on every arrow, chest compare" -f head=spell-scaling -f base=main -f body="..."
```

Tělo PR: co přináší, tabulka kouzel, tabulka výher, `burst`, otevřené body, co Petr testuje. PR se nemerguje bez Petra.
