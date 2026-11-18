# Sdílená kouzla a pasivky: návrh

- **Stav:** schváleno 18. 11. 2026 (Petr přenechal schválení Claudovi: „vše si schval“). Rozhodnutí v části 4 jsou Claudova a Petr je může změnit. Plán: `docs/superpowers/plans/2026-11-18-shared-spells-passives.md`.
- **Doplňuje:** oddíl 3.3 první specifikace („Sloty a pooly“: 6 aktivních kouzel a 4 pasivky, sdílený pool zhruba 10 kouzel a 6 pasivek) a oddíl 3.4 (karty). Je to fáze 2d bez evolucí.
- **Staví na:** `main` po PR #14 (multishot Sparkshota; `extraTargets` u `on_hit`). Plán musí počítat s tím, že #14 může být sloučen dřív nebo později; kód tohoto návrhu na něm nezávisí.

## 1. Záměr a proč

Hrdina má dnes 4 sloty: 3 podpisová kouzla a ultimátku. Plný kit má ve fázích 7–9 a dalších zhruba 30 level-upů dostává jen karty atributů (+10 STR, AGI nebo INT). Druhá půlka běhu je proto řídká: nic nového se neučí a karty nejsou rozhodnutí. Petr to v playtestu 2b-3 pojmenoval („second half feels thin“) a STATUS to vede jako otevřený bod.

Survivors žánr (Azeroth Survivors, Vampire Survivors) stojí na tom, že si hráč v každém běhu skládá build z nabídky karet. Sdílená kouzla a pasivky to přinesou: každý běh stejného hrdiny může vypadat jinak.

Vedlejší zisk: počet level-upů sedí. Vítězný běh dnes končí na úrovni 49–50. Podpisová kouzla a ultimátka potřebují asi 18 karet, nové sloty (2 sdílená kouzla a 4 pasivky po 5 úrovních) dalších 30. Kit by se tak plnil zhruba do konce běhu, ne ve fázi 9.

## 2. Cíle, mimo rozsah, nechceme

**Cíle**
- Každý level-up až do pozdní fáze nabízí skutečné rozhodnutí: nové kouzlo, vylepšení, nebo pasivku.
- Každý hrdina může mít jiný build: 2 sdílená kouzla z 10 a 4 pasivky z 6.
- Sdílená kouzla hrají jinak než atributy: viditelné efekty, nové druhy (řetěz, úder shůry).
- Vyvážení zůstane v pásmu: autopilot vyhraje zhruba 6–12 z 20 běhů na hrdinu (seedy 1–20, kontrola na 21–40).

**Mimo rozsah (pozdější plány)**
- Evoluce kouzel (kouzlo na 5 + katalyzátor), bonus „součet atributů × násobitel“.
- Přehazování karet (spec 3.4: 2× za běh), perky účtu, talenty.
- Ruční ovládání sdílených kouzel (sesílají se vždy samy; T dál přepíná jen ultimátku).
- Obtížnosti, dřevo, věže hradu.

**Nechceme**
- Aby sdílená kouzla přebila podpisová: hrdina má dál hrát jako on sám.
- Aby karty atributů zmizely úplně, dokud jde ještě něco učit, a aby se hráč pak zasekl na kartách, které nic nedělají.
- Texty nebo jména z mapy v datech pro hráče (Clean room v `AGENTS.md`).
- Oranžovou v ikonách a efektech.

## 3. Co rozhodl Petr

- 18. 11. 2026: „jeď“ na návrh začít sdílenými kouzly a pasivkami. Ke zbytku se nevyjádřil.
- Platí dřívější rozhodnutí: kouzla se sesílají sama (první spec), 6 aktivních a 4 pasivky, pool zhruba 10 a 6 (spec 3.3).

## 4. Rozhodnutí tohoto návrhu (Claudova)

### 4.1 Sloty

| Sloty | Obsah | Úrovně |
|---|---|---|
| 0–2 | podpisová kouzla (jako dnes) | 5 |
| 3 | ultimátka (jako dnes, `ULTIMATE_SLOT` zůstává 3) | jako dnes |
| 4–5 | sdílená kouzla, prázdná na začátku běhu | 5 |
| 6–9 | pasivky, prázdné na začátku běhu | 5 |

- Prázdný slot nemá kouzlo. Kouzlo dostane, když hráč vybere kartu „nové kouzlo“ nebo „nová pasivka“; potom se chová jako podpisové kouzlo stejného druhu.
- Jedno sdílené kouzlo nebo pasivka může být u hrdiny jen jednou.
- Sdílená kouzla se sesílají automaticky (režim auto); cílení a druhy jsou ty z `sim/abilities/`.

### 4.2 Sdílená kouzla (10)

Jména jsou naše (EN/CS), čísla se berou z kouzel hrdinů mapy, které naše 8 hrdinů nepoužívá, stejného druhu (zdroj jen v `design/`). Kde mapa číslo nemá, platí hodnota návrhu, jako u dosavadních kouzel. Výběr konkrétního zdroje a čísel je na plánu.

| # | Jméno (pracovní) | Druh | Co dělá |
|---|---|---|---|
| 1 | Arc Lightning / Jiskrový řetěz | `chain` (nový) | zasáhne nejbližšího nepřítele a skáče na další, počet skoků roste s úrovní |
| 2 | Smite / Úder shůry | `instant` (nový) | okamžitý zásah: boss nebo elita v dosahu má přednost, jinak nepřítel s nejvíce hp |
| 3 | Fire Bolt / Ohnivá střela | `projectile` | střela na nejbližšího, elity mají přednost |
| 4 | Frost Ring / Mrazivý kruh | `nova` se zpomalením | kruh kolem hrdiny, zpomalí zasažené |
| 5 | Meteor / Meteor | `area` | dopadne na nejhustší shluk |
| 6 | Holy Ground / Svatá půda | `ticking_area` | plocha pod hrdinou, tiká |
| 7 | Blade Fan / Vějíř dýk | `cone` | kužel ve směru pohybu |
| 8 | Shock Wave / Rázová vlna | `line` | vlna ve směru pohybu |
| 9 | Sentry Ward / Strážní totem | `summon` (totemy) | postaví totem, který střílí; strop živých totemů |
| 10 | Second Wind / Druhý dech | `heal` | uzdraví hrdinu, když hp klesne pod práh |

- `chain` a `instant` jsou ve schématu od fáze 2a a čekají na první kouzlo (`ARCHITECTURE.md`). Tento návrh je zavádí.
- Síla: sdílené kouzlo na úrovni 5 má být zhruba jako podpisové kouzlo téhož druhu na úrovni 3–4. Konečná čísla ladí poslední úkol plánu.

### 4.3 Pasivky (6)

Každá má 5 úrovní a přidává se k výpočtu statistik hrdiny stejnou cestou jako výbava (`GearBonus` / `heroStats`).

| Jméno (pracovní) | Na úrovni 1 → 5 |
|---|---|
| Might / Síla paže | poškození základního útoku +8 % → +40 % |
| Arcane Focus / Soustředění | síla kouzel +8 % → +40 % |
| Haste / Spěch | rychlost obnovy kouzel +5 % → +25 % (sčítá se s obnovou z INT) |
| Vigor / Houževnatost | max hp +8 % → +40 %, regenerace +1 → +5 za s |
| Fleet Foot / Lehký krok | rychlost pohybu +4 % → +20 %, rychlost útoku +6 % → +30 % |
| Fortune / Štěstěna | zlato +8 % → +40 %, dosah magnetu +40 → +200 |

Čísla jsou výchozí; poslední úkol plánu je přeladí.

- Pasivky se sčítají s výbavou do stejných polí (`GearBonus` dnes nemá obnovu kouzel ani procento hp, plán je přidá) a platí stávající stropy (rychlost útoku +600 %). Nový strop se nezavádí.
- Arcane Focus působí jako síla kouzel z výbavy: násobí sílu z INT, tedy poškození i léčení všech kouzel včetně ultimátky a totemů. Haste zrychluje obnovu všech kouzel včetně ultimátky.

### 4.4 Karty

- Karta má jeden ze čtyř druhů: **vylepšení** naučeného kouzla nebo pasivky (jako dnes), **nové kouzlo** (do volného slotu 4–5), **nová pasivka** (do volného slotu 6–9), **atribut** (jako dnes).
- Nabídka má dál 3 karty. Každá karta se táhne ze seedovaného `Rng` ve dvou krocích: nejdřív **skupina** podle váhy (jen z neprázdných skupin), pak rovnoměrně karta ve skupině; vytažená karta ze skupiny zmizí. Váhy patří skupině, ne kartě, takže 10 nových kouzel nepřehluší vylepšení:
  - A vylepšení podpisového kouzla nebo ultimátky: 4;
  - B vylepšení sdíleného kouzla nebo pasivky: 3;
  - C nové kouzlo (jen když je volný slot 4–5, z kouzel poolu, která hrdina nemá): 2;
  - D nová pasivka (jen když je volný slot 6–9, z pasivek, které hrdina nemá): 2.
- Když jsou všechny čtyři skupiny prázdné dřív, než má nabídka 3 karty, doplní se kartami atributů (STR, AGI, INT bez opakování), jako dnes.
- Pravidlo ultimátky (`ultimateFromLevel`, `ultimateLevelStep`) zůstává.
- Karta ukazuje přesnou změnu jako dnes; karta nového kouzla nebo pasivky má štítek „Nové“ a hodnoty úrovně 1.

### 4.5 Autopilot

Autopilot (`sim/bot.ts`) volí kartu podle pevného pořadí, aby se dalo měřit vyvážení:
1. ultimátka, 2. vylepšení podpisového kouzla, 3. nové sdílené kouzlo, 4. vylepšení sdíleného kouzla, 5. nová pasivka, 6. vylepšení pasivky, 7. atribut. Při shodě vyhrává karta dřív v nabídce.

Nemá preferovat konkrétní kouzla; jde o reprezentativního hráče, ne o optimum.

### 4.6 Rozhraní

- HUD kouzel: 6 ikon aktivních kouzel (podpisová, 2 sdílená, ultimátka) a pod nimi menší řada 4 pasivek. Prázdný slot je tlumený rámeček.
- Ikony: vlastní jednoduché SVG glyfy jako u výbavy, jedna na kouzlo nebo pasivku.
- Efekty: `chain` kreslí blesk mezi zásahy (stávající `bolts`), `instant` záblesk shora na cíli; ostatní druhy používají stávající efekty svého druhu. Zvuky ze stávajících syntetizovaných.
- Panel výbavy (C) se nemění.

### 4.7 Ladění a měření

- Nástroj `sim:run` vypíše u hrdiny i to, jaká sdílená kouzla a pasivky autopilot vzal a v jaké fázi měl plný kit.
- Cíl: autopilot vyhraje 6–12 z 20 běhů na hrdinu bez výbavy. Výchozí stav je tabulka vítězství v `docs/DECISIONS.md` (Gear, drops and chests a Sparkshot multishot). Hrdina, který dnes je v pásmu, v něm má zůstat; hrdina mimo pásmo (Gravecaller vyhrává 20) se k němu nemá vzdálit. Oprava starých výkyvů není úkolem tohoto plánu.
- Plný kit (všech 10 slotů na maximu) až ve fázi 16 a později je cíl, ne podmínka přijetí.
- Když hrdinové zesílí víc, než pásmo dovolí, ladí se nejdřív síla nových kouzel a pasivek, potom hp nepřátel v `design/scaling.yaml`. XP křivka se nemění (otevřený bod 2b-3 zůstává otevřený, jen se ukáže, zda ho tento návrh zmírnil).

### 4.8 Upřesnění po kontrole stavitelem

- **Jeden seznam slotů.** Všech 10 slotů je v `run.abilities`; index slotu je stálé id pro testy, `__game.abilityLevels` a debug. Pasivka je nový druh `passive` bez sesílání (updater nic nedělá) a do statistik se promítne při volbě karty (`refreshHeroStats`).
- **Jeden pool pro všechny hrdiny.** Bez filtrování podle hrdiny; sdílené kouzlo téhož druhu jako podpisové je v pořádku (jiná čísla, jiný efekt).
- **Směrová kouzla bez pohybu** (Blade Fan, Shock Wave) cílí jako stávající `cone` a `line`: směr pohybu, jinak nejbližší cíl (spec 3.3).

## 5. Přístupy

1. **Nové sloty a pool (zvoleno).** Hrdina dostane 6 nových slotů, které se plní z karet. Odpovídá první specifikaci, survivors žánru a sedí na počet level-upů.
2. **Sdílená kouzla místo karet atributů, bez slotů.** Karta by dala jednorázový bonus. Levnější, ale build se nevytváří a nic nového se na obrazovce neděje; řídkou druhou půlku nevyřeší.
3. **Větší podpisové kity (víc úrovní).** Prodloužit úrovně ze 5 na 8–10. Bez nových rozhodnutí; každý běh hrdiny by byl stejný.

## 6. Omezení

- Pravidla `AGENTS.md`: čistá a deterministická simulace, bez alokace v kroku (slot se plní při volbě karty, ne v kroku), bez transcendentních funkcí, texty EN a CS, žádná jména z mapy mimo `design/`, `tools/`, `docs/`.
- `data/generated` se generuje z `design/*.yaml`; `data:build` běží jen lokálně.
- `stateHash` musí pokrýt nové sloty (kouzlo, úroveň, cooldown).
- `?debug=1` `setAbilityLevel(slot, level)` musí jít i na sloty 4–9; pro prázdný slot nově `debug.learn(slot, abilityId)`.

## 7. Na stavitelovi

- Výběr zdrojových kouzel z mapy a jejich čísla.
- Rozhraní slotu pro „prázdný“ stav, struktura karet v kódu, pořadí kroků.
- Vzhled ikon a efektů v mezích 4.6.
- Konečná čísla pasivek a kouzel (úkol vyvážení).
