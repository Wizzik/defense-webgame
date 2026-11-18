# Sdílená kouzla a pasivky: implementační plán

- **Spec:** `docs/superpowers/specs/2026-11-18-shared-spells-passives-design.md` (schválený 18. 11. 2026; Petr přenechal schválení Claudovi: „vše si schval“).
- **Větev:** `shared-spells` (obsahuje `main` po PR #15). PR proti `main`, jeden.
- **Provedení:** inline v jednom chatu (9 úkolů), jedna závěrečná kontrola. Petr chce, aby Claude vše schválil, sloučil a nasadil sám, když projde `npm run check`, build, e2e `webgl2-fallback` a CI.
- **Brána každého úkolu:** test napřed (kde to jde), `npm run check` zelený, commit podle Conventional Commits s trailery relace. Pravidla `AGENTS.md` (čistá a deterministická sim, žádná alokace v kroku, žádné transcendentní funkce, texty EN+CS, žádná jména z mapy mimo `design/`, `tools/`, `docs/`).

## Přehled úkolů

| # | Úkol | Hlavní soubory |
|---|---|---|
| 1 | Schéma: druh `passive`, cílení `strongest`, `chain.bounceRange`, kouzla bez `source`, pool a váhy v pravidlech | `data/schema/*`, `tools/data-build/*` |
| 2 | Data: 10 sdílených kouzel a 6 pasivek v `design/`, export mapy, `data:build` | `design/abilities.yaml`, `design/rules.yaml`, `data/generated/*` |
| 3 | Sim: 10 slotů, prázdný slot, učení, pasivní bonusy ve statistikách | `sim/abilities/slots.ts`, `sim/abilities/passive.ts`, `sim/hero.ts`, `sim/crystals.ts`, `sim/hash.ts` |
| 4 | Sim: updatery `chain` a `instant` | `sim/abilities/chain.ts`, `sim/abilities/instant.ts`, `sim/abilities/targeting.ts`, `sim/gear-effects.ts` |
| 5 | Sim: karty se skupinami a vahami, karta `learn`, pořadí autopilota | `sim/cards.ts`, `sim/bot.ts`, `sim/hash.ts` |
| 6 | Klient: HUD (6 + 4), karty („Nové“), ikony, efekty, debug `learn`, e2e | `client/ui/*`, `client/render/ability-fx.ts`, `client/game/debug.ts`, `e2e/game.spec.ts` |
| 7 | Nástroj `sim:run`: co autopilot vzal a kdy měl plný kit | `tools/sim-run/run.ts` |
| 8 | Vyvážení do pásma 6–12 z 20, dokumentace | `design/*.yaml`, `docs/DECISIONS.md`, `ARCHITECTURE.md`, `docs/STATUS.md` |
| 9 | Závěrečná kontrola, PR, sloučení | |

---

## Úkol 1: Schéma a data-build

**Cíl:** data unesou pasivky, nové cílení, řetěz s dosahem skoku, kouzla a pasivky jen z návrhu (bez kódu mapy) a seznam poolu s vahami karet.

1. `data/schema/ability.ts`
   - `AbilityKind` += `"passive"`. Varianta `variant("passive", paramsAnyOf(PASSIVE_KEYS))`, kde
     `PASSIVE_KEYS = ["attackBonus", "spellPowerBonus", "cooldownBonus", "hpBonus", "regenBonus", "moveSpeedBonus", "attackSpeedBonus", "goldBonus", "magnetBonus"]` (exportuj konstantu, sim ji použije). Podíly jsou zlomky (0.08 = 8 %), `regenBonus` hp za s, `magnetBonus` jednotky světa. Klíče úmyslně nejsou `damage` atd.: `client/ui/card-lines.ts` násobí `damage` silou kouzel.
   - `Targeting` += `"strongest"` (boss nebo elita v dosahu má přednost, jinak nepřítel s nejvíce hp).
   - `chain`: `params(["damage", "range", "bounces", "bounceRange"])` (žádné kouzlo `chain` zatím neexistuje, změna nic nerozbije).
   - Pasivka má `cooldown` samé nuly (validace délky platí dál).
2. `data/schema/rules.ts`, `progression` (všechno povinné, `.strict()` zůstává):
   - `sharedSpells: z.array(Slug).min(1)`, `passives: z.array(Slug).min(1)`,
   - `sharedSpellSlots: z.number().int().min(0)` (2), `passiveSlots: z.number().int().min(0)` (4),
   - `cardWeights: z.object({ signature: positive, sharedUpgrade: positive, newSpell: positive, newPassive: positive }).strict()` (4, 3, 2, 2).
3. `validateGameData` (`data/schema/index.ts`): každé id z `sharedSpells` existuje, není `passive` a není podpisové ani ultimátka žádného hrdiny; každé id z `passives` existuje a je `passive`; žádné `passive` kouzlo není v kitu hrdiny. Testy v `data/schema/schema.test.ts` (dobrý případ, každá chyba zvlášť).
4. `tools/data-build/load.ts` + `map-abilities.ts`: `AbilityEntry.source` volitelné. Bez `source`: každý param a `cooldown` musí být `{ design: [...] }`, `levels` = délka polí (všechna stejně dlouhá, 1–5), jinak chyba s cestou `abilities.yaml: <id>: ...`; `review` je bez `source` zakázané. `build.ts` volá `findSource` jen se `source`. Škálování cooldownu (`scaling.ts`) platí stejně (design hodnota je v sekundách mapy). Testy v `tools/data-build/data-build.test.ts` (fixture bez exportu záznamu).
5. Nová pole `progression` jsou povinná, takže `data/generated.test.ts` projde až s daty Úkolu 2. Úkoly 1 a 2 proto končí jedním commitem (testy schématu a data-build napiš a spusť už v Úkolu 1 cíleně: `npx vitest run data/schema tools/data-build`).

**Commit (po Úkolu 2):** `feat(data): shared spell and passive pools`

## Úkol 2: Data sdílených kouzel a pasivek

1. Export mapy: soubor `X_Hero_Siege_F-Day_v20.75_AI.w3x` je v projektu na claude.ai (`Projects project_read`, `original` netřeba, vrátí cestu k souboru). Zkopíruj ho mimo repo (např. `/home/claude/map/`), pak `npm run map:extract -- /home/claude/map/X_Hero_Siege_F-Day_v20.75_AI.w3x v20.75` (výstup `data-source/v20.75/out/`, netrackovaný).
2. Výběr zdrojů: kouzla hrdinů mapy, která naše 8 hrdinů nepoužívá (`design/heroes.yaml` + `source` v `design/abilities.yaml`). Dotaz bez čtení celého souboru, např.
   `python3 -I -c "import json;d=json.load(open('data-source/v20.75/out/abilities.json'));used=set(...);[print(a['id'],a.get('name'),a.get('levels')) for a in d if ...]"`.
   Ke každému z 10 kouzel spec 4.2 vyber zdroj stejného druhu, kde mapa číslo má (`DataA`–`DataI`, `cooldown`, `area`, `range`, `duration`); kde ne, `{ design: [...] }`. Kde se nic nehodí, kouzlo je celé návrhové (bez `source`, Úkol 1). Do `review` nic nepiš (není skript). Zápis výběru do `docs/DECISIONS.md` (Úkol 8).
3. `design/abilities.yaml`, nová sekce `# Shared spells (pool)`: 10 kouzel spec 4.2 s našimi jmény EN/CS a vlastními popisy:

   | id | druh | cílení | params |
   |---|---|---|---|
   | `arc-lightning` | chain | nearest | damage, range, bounces (2, 3, 4, 5, 6), bounceRange |
   | `smite` | instant | strongest | damage, range |
   | `fire-bolt` | projectile | nearest_elite_first | damage, range, speed |
   | `frost-ring` | nova | around_self | damage, radius, slow, slowSeconds |
   | `meteor` | area | densest_cluster | damage, radius, range |
   | `holy-ground` | ticking_area | around_self | tickDamage, ticksPerSecond, radius, duration |
   | `blade-fan` | cone | move_direction | damage, length, endWidth, maxTargets |
   | `shock-wave` | line | move_direction | damage, length, width, waveSpeed |
   | `sentry-ward` | summon | around_self | count, duration, damage, attackRange, attackInterval, maxAlive |
   | `second-wind` | heal | self | amount, maxTargets, range |

   Cílení zkontroluj proti tomu, co updater daného druhu skutečně čte (např. `cone.ts`, `line.ts` berou směr pohybu, `summon.ts` místo kolem hrdiny). Výchozí síla: sdílené kouzlo na úrovni 5 ≈ podpisové kouzlo téhož druhu na úrovni 3–4 (porovnej s `data/generated/abilities.json` dotazem `node -e`).
4. Sekce `# Passives (pool)`: 6 pasivek spec 4.3 bez `source`, `kind: passive`, `targeting: self`, `cooldown: { design: [0, 0, 0, 0, 0] }`:
   - `might`: attackBonus 0.08 … 0.40;
   - `arcane-focus`: spellPowerBonus 0.08 … 0.40;
   - `haste`: cooldownBonus 0.05 … 0.25;
   - `vigor`: hpBonus 0.08 … 0.40, regenBonus 1 … 5;
   - `fleet-foot`: moveSpeedBonus 0.04 … 0.20, attackSpeedBonus 0.06 … 0.30;
   - `fortune`: goldBonus 0.08 … 0.40, magnetBonus 40 … 200.
5. `design/rules.yaml` `progression`: `sharedSpells` (10 id), `passives` (6 id), `sharedSpellSlots: 2`, `passiveSlots: 4`, `cardWeights: { signature: 4, sharedUpgrade: 3, newSpell: 2, newPassive: 2 }`.
6. `npm run data:build -- --source data-source/v20.75/out --out data/generated`. `data/generated.test.ts`: pool má 10 a 6 položek, všechny id existují, žádné jméno ani kód mapy v JSON (stávající strážci). Pak `npm run check` a společný commit Úkolů 1 a 2.

## Úkol 3: Sim: 10 slotů, prázdný slot, pasivky

1. `sim/abilities/slots.ts`
   - Konstanty `SHARED_FIRST = 4`, `PASSIVE_FIRST = 4 + rules.sharedSpellSlots` počítej z pravidel: `sharedSlotRange(run)` a `passiveSlotRange(run)` vrací `[first, end)`; nepiš 4–9 natvrdo mimo testy.
   - `EMPTY_ABILITY: Ability` (konstanta modulu: `id: ""`, `kind: "passive"`, `targeting: "self"`, `levels: 5`, `cooldown: [0,0,0,0,0]`, `params: {}`, prázdná jména). `isEmptySlot(slot)` = `slot.def === EMPTY_ABILITY`. `AbilitySlot.def` přestane být jen pro čtení.
   - `createAbilitySlots`: 4 jako dnes + `sharedSpellSlots + passiveSlots` prázdných slotů (`level 0`, `hit` pole má každý slot hned, alokace jen při vytvoření běhu).
   - `learnAbility(run, index, abilityIndex)`: slot musí být prázdný a ve správném rozsahu, kouzlo z poolu a hrdina ho ještě nemá; nastaví `def`, `level = 1`, `cooldown = 0`, vynuluje stav slotu (`active`, `front`, `ticksLeft`, `hit.fill(0)`), pak `refreshHeroStats`. Volá se jen z volby karty a z debugu (žádná alokace v kroku).
   - `updateAbilities`: `passive` má updater `() => {}` v `kinds.ts` (jako `aura`).
   - `debugSetAbilityLevel` na prázdném slotu nic nedělá (e2e smyčky přes sloty nesmí naučit zástupné kouzlo).
2. `sim/abilities/passive.ts`: `passiveBonuses(run, out: PassiveBonus)` po vzoru `auraBonuses`: vynuluje a sečte `params` naučených slotů druhu `passive` na jejich úrovni. `PassiveBonus = { attack, spellPower, cooldown, hp, regen, moveSpeed, attackSpeed, gold, magnet }` v `sim/world.ts` (`HeroState.passive`, vytvoří se s hrdinou).
3. `refreshHeroStats` (`sim/level-up.ts`) volá `passiveBonuses` hned po `auraBonuses`. `heroStats` (`sim/hero.ts`):
   - `damage = 1 + bonus.damage + gear.damage + passive.attack`;
   - `maxHp = (def.hp + str * … + gear.hp) * (1 + passive.hp)`; `regen += passive.regen`;
   - rychlost útoku: `+ passive.attackSpeed` uvnitř stávajícího `Math.min(…, 1 + attackSpeedCap)`;
   - `spellPower = (1 + int * k) * (1 + gear.spellPower + passive.spellPower)`;
   - `cooldownScale = 1 / (1 + int * cooldownSpeedPerInt + passive.cooldown)`;
   - `moveSpeed *= (1 + bonus.moveSpeed + gear.moveSpeed + passive.moveSpeed)`.
   `client/ui/card-lines.ts` `statsWith` kopíruje i `passive` (jinak náhled karty atributu lže).
4. `sim/crystals.ts`: zlato `× (1 + gear.goldFind + passive.gold)`, dosah magnetu `+ passive.magnet`.
5. `sim/hash.ts`: u každého slotu i `run.data.abilities.indexOf(slot.def)` (−1 pro prázdný; `indexOf` nealokuje).
6. Testy (`sim/abilities/slots.test.ts`, nový `passive.test.ts`, `hero.test.ts`): 10 slotů na startu a prázdné nic nedělají; `learnAbility` odmítne obsazený slot, kouzlo mimo pool, druhé stejné kouzlo, pasivku do slotu kouzla; každá pasivka mění právě svou statistiku o hodnotu své úrovně; pasivka + výbava se sčítají; hash se liší po naučení; determinismus (stávající replay test projde).

**Commit:** `feat(sim): shared spell and passive slots`

## Úkol 4: Sim: `chain` a `instant`

1. Vytáhni hledání skoků z `onGearAttack` (`sim/gear-effects.ts`) do `sim/abilities/chain-hits.ts`: `chainJumps(run, first, x, y, jumps, range, damage, hit: Int32Array, flash: number)` (skáče na nejbližšího ještě nezasaženého v `range` od posledního zásahu, `Blast` událost a `damageEnemy` na každém skoku). Výbava ji volá se svými čísly; její test (`gear-effects.test.ts`) musí projít beze změny.
2. `sim/abilities/chain.ts` `updateChain`: `castMode`, cíl `nearestEnemy(run, hero.x, hero.y, range)`; žádný cíl = nic. `startCast(run, index, damage, hero, cíl směr)`, zásah prvního (`damageEnemy`, druh poškození kouzla jako u ostatních), pak `chainJumps` s `bounces[L]`, `bounceRange[L]`. Scratch pole `Int32Array(MAX_BOUNCES + 1)` na slotu nebo v modulu (alokace jednou); schéma omez `bounces` na ≤ 8.
3. `sim/abilities/targeting.ts` `strongestEnemy(run, x, y, range)`: v dosahu boss (`data.enemies[type].boss`) nebo elita (`hunter`) s nejvíc hp, jinak kdokoli s nejvíc hp; shoda → nižší slot.
4. `sim/abilities/instant.ts` `updateInstant`: cíl `strongestEnemy`, `startCast`, `damageEnemy(damage[L] * spellPower)`, `Blast` událost na cíli (efekt „úder shůry“ v Úkolu 6 se pozná podle `Cast` a druhu slotu).
5. Registrace v `kinds.ts`. Testy `chain.test.ts`, `instant.test.ts`: počet zásahů = 1 + bounces (když je dost nepřátel), nikdo dvakrát, skok jen v `bounceRange`; instant dá přednost elitě před silnějším obyčejným, mimo dosah nic; cooldown a `Cast` událost.

**Commit:** `feat(sim): chain and instant ability kinds`

## Úkol 5: Sim: karty a autopilot

1. `sim/cards.ts`
   - `Card` += `{ kind: "learn"; slot: number; ability: number }` (`ability` = index v `data.abilities`; `slot` = první volný slot správného rozsahu).
   - `openOffer` staví čtyři skupiny (pole vytvořená v nabídce: je to vzácná událost, smí alokovat):
     A vylepšení slotů 0–3 (dnešní pravidla včetně učení podpisového z úrovně 0 a pravidla ultimátky), B vylepšení naučených slotů 4–9, C `learn` pro každé kouzlo z `sharedSpells`, které hrdina nemá, když je volný sdílený slot, D totéž pro `passives` a pasivní sloty. Kouzlo, jehož druh nemá updater, se přeskočí (jako dnes).
   - Tah karty: váha skupiny z `cardWeights`, jen neprázdné skupiny; `run.rng.int(součet)` vybere skupinu, `run.rng.int(délka)` kartu; karta ze skupiny zmizí. Opakuj do `cardsPerOffer`. Když skupiny dojdou, doplň atributy STR, AGI, INT bez opakování (zamíchané `rng` jako dnes).
   - `chooseCard` pro `learn` volá `learnAbility`.
2. `sim/bot.ts` `botCard(run, offer)` (nový podpis, uprav volání v `bot.ts`, `start-phase.ts`, `sim/index.ts`): pořadí spec 4.5: ultimátka (slot 3), vylepšení nebo učení podpisového (0–2), `learn` sdíleného kouzla, vylepšení sdíleného kouzla, `learn` pasivky, vylepšení pasivky, atribut; shoda → dřívější v nabídce.
3. `sim/hash.ts`: karta `learn` = `mixInt(5)`, `slot`, `ability`.
4. Testy (`cards.test.ts`, `bot.test.ts`, `level-up.test.ts`): nabídka nikdy nemá dvě stejné karty ani `learn` pro kouzlo, které hrdina má; bez volného slotu žádné `learn`; se zcela plným kitem jen atributy; váhy (statisticky na 2000 nabídek s pevným seedem: podíl skupin ± tolerance); determinismus nabídky; pořadí autopilota na ručně složené nabídce. Stávající testy, které počítaly s rovnoměrným mícháním, přepiš na nové pravidlo.

**Commit:** `feat(sim): weighted card groups for shared spells and passives`

## Úkol 6: Klient

1. **HUD** (`client/ui/hud.ts`, `style.css`): řada aktivních buněk v pořadí sloty 0, 1, 2, 4, 5, 3 (ultimátka poslední s R a přepínačem), pak úskok; pod ní menší řada 4 pasivek (ikona, úroveň, tlumený rámeček pro prázdný slot, `title` se jménem). Prázdný sdílený slot: tlumená buňka s textem „Volný slot“ / „Empty slot“. Šířka: ověř `npm run shots` (`fight`) v 1280×720, že se řada vejde; jinak zúž buňky aktivních kouzel.
2. **Ikony** (`client/ui/ability-icons.ts`): vlastní jednoduché SVG glyfy pro 10 sdílených kouzel a 6 pasivek (styl `item-icons.ts`, tmavě modré a šedomodré tóny, žádná oranžová). Použij v HUD pasivek a na kartách `learn`.
3. **Karty** (`client/ui/cards.ts`, `card-lines.ts`): karta `learn` má štítek „Nové“ / „New“, jméno, popis a hodnoty úrovně 1 (stejná cesta jako učení podpisového: `fromLevel 0`); pasivky ukazují svá procenta (`PERCENT_KEYS` += `attackBonus`, `spellPowerBonus`, `cooldownBonus`, `hpBonus`, `goldBonus`; `magnetBonus` a `regenBonus` jako čísla); popisky `stat.*` v `messages-en.ts` a `messages-cs.ts` (`i18n.test.ts` hlídá shodu klíčů). Testy v `card-lines.test.ts`.
4. **Efekty** (`client/render/ability-fx.ts`): `chain` blesky mezi zásahy přes `fx/bolts.ts` (pozice skoků nese `Blast` událost; `Cast` dá první úsek od hrdiny), `instant` krátký svislý záblesk na cíli; ostatní druhy už mají efekt svého druhu. Zvuk: `client/audio` mapuje `Cast` podle druhu; `chain` jako stávající blesk, `instant` jako úder.
5. **Debug** (`client/game/debug.ts`): `debug.learn(slot, abilityId)` (volá `learnAbility`, chybu hodí do konzole jako `Error`); `abilityLevels` a `abilityCooldowns` mají 10 položek; nový `abilityIds` (id kouzla ve slotu, `""` pro prázdný). `AGENTS.md`, odstavec Debugging, doplnit.
6. **e2e** (`e2e/game.spec.ts`): (a) nový běh má 10 slotů, sloty 4–9 prázdné; (b) `debug.learn(4, "arc-lightning")` a `debug.learn(6, "might")`, HUD ukazuje sdílené kouzlo a pasivku, kouzlo se sešle (cooldown > 0 během pár sekund); (c) existující testy se smyčkou `slot < 4` zůstanou. Brána: `npx playwright test --project=webgl2-fallback`.

**Commit:** `feat(client): HUD, cards, icons and effects for shared spells and passives`

## Úkol 7: `sim:run`

- `tools/sim-run/run.ts`: u každého hrdiny (souhrn přes seedy) nejčastější sdílená kouzla a pasivky, které autopilot vzal (počty), a medián fáze, ve které měl všech 10 slotů na maximu (`–`, když nikdy). Data z `run.abilities` na konci běhu a z fáze při každé volbě karty (sleduj v nástroji, ne v sim). Test v `tools/sim-run/run.test.ts` na tvar výstupu.

**Commit:** `feat(tools): sim:run reports shared spells, passives and the full-kit phase`

## Úkol 8: Vyvážení a dokumentace

1. Výchozí stav: tabulka vítězství bez výbavy v `docs/DECISIONS.md` (Chest loot, Magic Find and enemy threat). Změř `npm run sim:run -- --hero all --seeds 1-20` a `--seeds 21-40`.
2. Cíl (spec 4.7): 6–12 z 20 na hrdinu bez výbavy; kdo dnes v pásmu je, v něm zůstane; Gravecaller (20) se nesmí vzdálit. Ladí se v tomto pořadí: síla sdílených kouzel a pasivek (`design/abilities.yaml`), váhy karet, teprve pak hp nepřátel v `design/scaling.yaml`. XP křivka se nemění. Pět hrdinů, kteří dnes vyhrávají 0–1 (Stonehorn, Nightglaive, Mistwarden, Sparkshot, Tidecaller), se mají pásmu přiblížit; když to bez zásahu do jejich kitů nejde, zapiš to jako otevřený bod pro Petra (spec: oprava starých výkyvů není úkolem plánu).
3. Kontrola s výbavou: `--gear mid` a `--gear full` nesmí spadnout pod dnešní stav o víc než pár vítězství.
4. `npm run sim:chests -- --seeds 1-200` jen pro kontrolu (pasivky mění sílu truhel nepřímo); čísla do DECISIONS.
5. Dokumentace: `docs/DECISIONS.md` nová sekce Shared spells and passives (zdroje z mapy, čísla, váhy, tabulka vítězství před a po, fáze plného kitu); `ARCHITECTURE.md` (10 slotů, prázdný slot, `passive`, `chain`, `instant`, `strongest`, karty se skupinami; věta „instant a chain wait for a spell“ pryč); `docs/STATUS.md` (co přináší, co má Petr v playtestu zkontrolovat, odkazy s `debug=1`).

**Commit:** `feat(balance): tune shared spells and passives` a `docs: shared spells and passives`

## Úkol 9: Kontrola a vydání

1. Závěrečná kontrola celé větve (subagent, jinak vlastní pečlivá revize diffu proti spec 4.1–4.8 a `AGENTS.md`); opravit nálezy, drobnosti zapsat do STATUS.
2. `npm run check`, `npm run build`, `npx playwright test --project=webgl2-fallback`.
3. Push `shared-spells`, PR proti `main` přes `gh api` (REST). Po zelené CI sloučit (Petr to dovolil), ověřit nasazení Pages (`WebFetch` na živou stránku), STATUS v projektu na claude.ai i v repu.

## Rizika

- **Šířka HUD:** 7 buněk + řada pasivek; když se nevejde, buňky aktivních kouzel bez textu stavu (jen ikona + proužek).
- **Seismic Echo a podobné reakce na sesílání** se se sdílenými kouzly spouštějí častěji; v Úkolu 8 hlídat Stonehorna a případně omezit echo na sloty 0–3 (zapsat do DECISIONS).
- **Výkon:** `instant` a `chain` prochází nepřátele jen při seslání (O(n) / O(n·skoky)); `densestCluster` u Meteoru je O(n²) jako u stávajících `area`, jen při seslání.
- **Změna RNG nabídek** posune výsledky všech seedů; srovnávat proto jen souhrny, ne jednotlivé seedy.
