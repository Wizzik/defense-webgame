# Silnější chesty, Magic Find a tvrdší nepřátelé: návrh

- **Stav:** návrh ke schválení (18. 11. 2026). Petr schválil přehled v chatu („je to ok“); co je v části 4 označeno jako Claudovo, může změnit.
- **Doplňuje:** spec gearu `2026-11-13-items-gear-chests-design.md` (chesty, rarity, boss dropy) a otevřený bod „Open for Petr 2 (chest power)“ ve `docs/STATUS.md`.
- **Staví na:** `main` po PR #14 (`cd54f2e`). Nezávisí na větvi `shared-spells`; ta se po tomto plánu ladí proti novému stavu (viz 7).

## 1. Záměr a proč

Petr v playtestu: nepřátelům se dá utéct a zabíjet je bez rizika, hra „není vůbec challenging“. A chesty jsou tak slabé, že nedává smysl je sbírat (dnes 16 chest dá hrdinovi bez gearu asi +10 % síly, spec gearu chtěla +50 %).

Obě věci spolu souvisí. Silnější chesty se v plánu gearu nepřijaly, protože hned zlehčily běh bez gearu. Když nepřátelé udeří dvakrát silněji, běh ztvrdne a silné chesty se stanou protiváhou: hráč pro ně musí chodit, aby přežil. Chesty mají přinášet loot, ne jen „o kousek větší číslo“: náhodná rarita a nový atribut Magic Find, který šanci na lepší raritu zvyšuje (Diablo).

Melee hrdinové musí stát u nepřátel, takže dvojnásobné poškození by je trestalo víc než střelce. Proto dostanou 25 % redukci.

## 2. Cíle, mimo rozsah, nechceme

**Cíle**
- Každý zásah nepřítele do hrdiny dává 2× víc než dnes. Chyba (nechat se chytit) bolí.
- Kamenorohý a Rudý sekáč berou o 25 % méně poškození od nepřátel.
- Chesta nabízí 3 konkrétní předměty s náhodnou raritou ve všech pěti raritách. Hráč vidí barvy a je mezi nimi rozhodnutí.
- Chesty jsou cítit: zhruba +50 % síly na konci vítězného běhu u hrdiny bez permanentního gearu (průměr).
- Magic Find je nový atribut na části předmětů. Zvyšuje šanci na vyšší raritu u chest i u boss dropů, s klesajícími výnosy.

**Mimo rozsah**
- Typy poškození (fyzické a magické). Nepřátelé dnes nemají kouzla; redukce melee platí na všechno, co je zasáhne.
- Obtížnosti (Petr je chce později jako kombinaci prostředí a zvolené obtížnosti).
- Přeladění kitů jednotlivých hrdinů na pásmo výher. To udělá plán sdílených kouzel (viz 7).
- Ruční přehazování nabídky chesty, prodej předmětů, nové předměty kromě úprav kvůli Magic Find.

**Nechceme**
- Aby se zrychlil pád hradu. Hrad dostává poškození jako dnes.
- Aby chesty nahradily permanentní gear: předmět z chesty platí jen pro běh a permanentní předmět se po běhu vrátí.
- Aby se dal Magic Find vyfarmit na jisté legendary.
- Oranžovou v UI, texty z mapy.

## 3. Co rozhodl Petr

- 18. 11. 2026: chesty musí být mnohem silnější, aby dávalo smysl je sbírat.
- 18. 11. 2026: poškození nepřátel +100 %, protože se jim dá utéct a zabíjet je bez rizika.
- 18. 11. 2026: melee hrdinové 25 % redukce fyzického poškození, aby to bylo vyvážené.
- 18. 11. 2026: rarita z chest padá **náhodně** (ne podle fáze běhu). Nový atribut **Magic Find**, různě na předmětech, zvyšuje šanci na rare, epic, legendary u chest a předmětů.
- 18. 11. 2026: schválil přehled v chatu: výběr 1 ze 3 předmětů s hozenou raritou, všech pět rarit z chest, výměna při vyšší raritě, +1 úroveň jinak, Magic Find i pro boss dropy, ×2 jen na hrdinu, ne na hrad, pořadí před sdílenými kouzly.

## 4. Rozhodnutí tohoto návrhu

### 4.1 Poškození hrdiny (Claudova volba, Petr schválil v přehledu)

- `rules.threat.heroDamageTaken: 2` násobí každé poškození, které jde do hrdiny přes `damageHero` (`sim/combat.ts`). Všechny cesty (útok na blízko, střely, výpad, úder bosse, dopad slamu) tudy už vedou, takže změna je na jednom místě.
- Hrad (`damageCastle`) se nemění.
- `heroes.yaml` dostane volitelné pole `damageTaken` (násobitel, výchozí 1). Kamenorohý a Rudý sekáč mají `0.75`. Násobí se s armorem a s `heroDamageTaken`. Noční čepel je podle popisu „na dálku“, redukci nemá.
- Štít (`shieldTicks`) dál blokuje všechno.

### 4.2 Nabídka chesty (Petr: náhodná rarita; podoba nabídky je Claudova, schválená v přehledu)

Chesta dál stojí zlato podle křivky 200 × 1.12^(n−1) a nabízí 3 karty. Každá karta je teď **slot + předmět s hozenou raritou**:

1. Pro každou kartu se hodí rarita podle vah `rules.chests.rarityWeights` upravených Magic Findem (4.4).
2. Vybere se slot, jehož typ má předmět té rarity a který ještě není v nabídce. Legendary je dnes jen pro mainHand, offHand a trinket, mythic také; když hozená rarita nemá volný slot, rarita klesne o stupeň.
3. Z předmětů té rarity a typu se vybere náhodně jeden. Přednost má předmět, který hrdina nenosí v druhém slotu stejného typu (prsten, trinket).

Co karta udělá po výběru (stejné pravidlo pro všechny sloty):
- **Prázdný slot:** nasadí se hozený předmět na úroveň 1 pro tento běh (`base 0, temp 1`).
- **Hozená rarita je vyšší než u nasazeného:** hozený předmět nahradí nasazený do konce běhu a převezme **celou úroveň slotu + 1** (permanentní i z chest), takže výměna je vždy zlepšení. Bez toho by např. mythic na úrovni 1 (42 bodů) nahradil legendary na úrovni 5 (48 bodů) a hrdina by zeslábl. Permanentní předmět se po běhu vrátí, protože běh neukládá loadout. *(Claudova volba po kontrole stavitele.)*
- **Stejná nebo nižší rarita:** nasazený předmět dostane +1 úroveň (`temp + 1`), jako dnes. Karta pak ukazuje nasazený předmět s „+1 úroveň“, ne hozený.

Karta ukazuje ikonu slotu, jméno předmětu v barvě rarity, raritu a co se stane („Nové na tento běh“, „Nahradí X do konce běhu“, „+1 úroveň: X“). Tooltip porovná s nasazeným předmětem jako na obrazovce gearu.

Speciální efekty legendary a mythic předmětů platí i z chesty, od chvíle výběru (`recomputeGear` musí přepočítat i efekty).

Když hráč vybere legendary nebo mythic, zpráva v řádku novinek ho jmenuje v barvě rarity, stejně jako boss drop. *(Claudova volba.)*

### 4.3 Výchozí váhy rarit chest (Claudova volba, doladí stavitel)

Startovní návrh, který stavitel doladí simulací na cíl z 5.2: common 55, rare 30, epic 12, legendary 2.5, mythic 0.5.

### 4.4 Magic Find (Petr: atribut; vzorec je Claudův)

- Nový stat předmětů `magicFind` (podíl, 0.10 = 10 %). Rozpočet: **1 bod = 2 % Magic Find**. Common prsten se 6 body tak dá 12 %.
- Hrdina sčítá Magic Find všech nasazených předmětů, včetně předmětů z chest (zvedá šance už ve stejném běhu).
- **Klesající výnosy:** efektivní MF = MF × K / (MF + K), K = 1.5 (tedy 150 %). 50 % MF dá 37,5 %, 100 % dá 60 %, 300 % dá 100 %. Jen dělení, žádné `Math.pow` (pravidla `sim/`).
- Váha každé rarity nad nejnižší raritou tabulky se násobí (1 + efektivní MF × stupeň), kde stupeň je 1 pro rare, 1.5 pro epic, 2 pro legendary a 2.5 pro mythic. Vyšší rarity tak rostou rychleji. Váha nejnižší rarity se nemění.
- Stejný vzorec platí pro **boss dropy** (`meta/drop.ts`, `rollDrop` dostane MF hrdiny v okamžiku zabití bosse). Nejnižší rarita tabulky bosse (např. common u Iron Marshala) se nemění.
- **Kde je Magic Find:** na 8 až 10 předmětech, hlavně prsteny, náhrdelníky, trinkety a opasky. U části předmětů s `goldFind` se jeho řádek vymění za `magicFind`, u jiných se přidá v rámci rozpočtu rarity. Commonu zůstane jeden řádek, takže jeden z common předmětů (např. `tin-ring` nebo `lucky-pebble`) dostane Magic Find místo svého statu. Rozpočty kontroluje `data/generated.test.ts` (±10 %). Výběr předmětů je na staviteli.
- Plně MF build (všechny MF předměty, epic a výš, úroveň 5) má mít zhruba 100 % MF, tedy efektivně 60 %. *(Cíl; stavitel ověří.)*
- **Jméno:** EN „Magic Find“, CS „Magický nález“. *(Claudova volba.)* Ukáže se v tooltipu, ve srovnání a v součtech na obrazovce gearu a v panelu C.

### 4.5 Autopilot

- Chodí k chestám jako dnes (zlato, hrdina ≥ 30 % hp, hrad ≥ 50 %, finální boss nežije).
- Vybírá kartu takto: nejdřív výměnu za vyšší raritu (nejvyšší rarita vyhrává), pak nový předmět do prázdného slotu, nakonec +1 úroveň u slotu s nejnižší úrovní.

## 5. Vyvážení

### 5.1 Co se měří

`npm run sim:run -- --hero all --seeds 1-20` a kontrola na 21–40, s `--gear none`, `mid` a `full`. Tabulka před a po do `docs/DECISIONS.md`.

### 5.2 Cíle

- **Síla chest:** 15 chest s volbami autopilota dá hrdinovi bez permanentního gearu na úrovni 25 v průměru asi +50 % hp, útoku a kouzel. Měří se mimo běh (stejně jako dnešních „+10 %“): pevných 15 nabídek přes mnoho seedů, protože rarita je náhodná a s ×2 poškozením nemusí být dost vítězných běhů. *(Claudova volba po kontrole stavitele.)*
- **Čím se ladí:** hlavně `rarityWeights`. Sdílený `rules.gear.levelStep` se nemění, protože by přeladil i permanentní gear a boss dropy. Když váhy nestačí, přibude zvláštní krok jen pro úrovně z chest (`rules.gear.chestLevelStep`). *(Claudova volba po kontrole stavitele.)*
- **Výhry:** v tomto plánu se nehoní pásmo. Autopilot nekituje, takže ×2 poškození ho zasáhne víc než hráče. Hlásí se před a po. Když hrdina bez gearu spadne na 0–1 z 20 na obou sadách seedů, plán to označí pro Petra a neladí ho; ladění kitů na pásmo 6–12 udělá plán sdílených kouzel.
- **Hrad:** podíl proher pádem hradu by se neměl zvednout (hrad se nemění; když se zvedne, je to vedlejší účinek slabšího hrdiny a hlásí se).

## 6. Přístupy

| | Přístup | Výhody | Nevýhody |
|---|---|---|---|
| A | Jen čísla: úroveň z chesty +40 % místo +15 % | nejlevnější, jedno číslo | dál „common prsten“, žádný pocit lootu |
| B | Rarita roste s fází běhu | viditelné, předvídatelné | bez náhody, bez napětí |
| C | Víc úrovní najednou podle fáze | jednoduché | jen větší číslo |
| **D** | **Náhodná rarita (1 ze 3 hozených předmětů) + Magic Find** | loot jako v Diablu, rozhodnutí v nabídce, nový build kolem MF | víc práce (nabídka, UI karet, stat, váhy) |

**Petr zvolil D** (18. 11. 2026): „Mělo by to padat náhodně“ a přidal Magic Find. Claude původně doporučil B; D má stejnou viditelnost a k tomu náhodu.

## 7. Pořadí a vztah k jiným plánům

1. Tento plán (malý až střední, zhruba 6 až 8 úkolů).
2. Sdílená kouzla a pasivky (`shared-spells`, spec čeká na schválení). Jeho pásmo 6–12 výher z 20 se ladí až proti stavu po tomto plánu.

## 8. Co zbývá staviteli

- Data: `data:build` potřebuje export mapy (`npm run map:extract`); mapa je soubor v projektu na claude.ai.
- Přesné váhy rarit, výběr 8 až 10 předmětů s Magic Find a jejich hodnoty v rozpočtu.
- Jak rozšířit `ChestOffer` (dnes `{ slots }`) o předmět a druh akce; nový tvar událostí `ChestPick` pro klienta.
- Klientská nabídka chesty (`client/`): karty s raritou podle stávajícího vzhledu gearu (barvy rarit, glyfy slotů).
- Testy: nabídka respektuje rarity a typy slotů, pravidlo výměny a +1 úrovně, klesající výnosy MF, `rollDrop` s MF, `damageTaken` a `heroDamageTaken` v `damageHero`, deterministický replay. E2e a idle testy, které počítají s dnešním poškozením, se upraví.
- Zápis do `docs/DECISIONS.md` (nový oddíl) a `docs/STATUS.md`.
