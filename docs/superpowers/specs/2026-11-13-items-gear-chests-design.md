# Výbava, drop z bossů a truhly: návrh

- **Stav:** schváleno Petrem 13. 11. 2026 („ano, skvělé“). Rozhodnutí v části „Co rozhodl Petr“ padla v chatu 12.–13. 11. 2026.
- **Nahrazuje:** oddíl 3.5 první specifikace (obchod u hradu, 6 slotů, recepty) a oba body „Next“ ve `docs/STATUS.md` (itemy v běhu, trvalá výbava). Staví se jako jeden plán.
- **Staví na:** větvi `elite-boss-threat` (PR #11). Návrh počítá s elitami a bossy, kteří hrdinu loví.

## 1. Záměr a proč

Hrdina má dnes jedinou osu postupu: úrovně a karty v běhu. Po naplnění kitu (fáze 7–9) karty nabízejí už jen atributy a druhá půlka běhu je řídká. Mezi běhy se neukládá nic.

Petr chce výbavu jako v Azeroth Survivors (wow.aethus.pl):
- **Trvalé itemy padají z bossů**, jsou vidět v menu a jsou stálým vylepšením hrdiny.
- **V běhu se tyto itemy dočasně vylepšují** z truhel placených zlatem.
- Pozice jako ve World of Warcraft, vzhled jako Diablo II, kategorie itemů inspirované mapou a doplněné o to, co mapa nemá.

## 2. Cíle, mimo rozsah, nechceme

**Cíle**
- Každý běh má druhou osu postupu (zlato → truhly → silnější výbava) a rozhodnutí „jít pro truhlu, nebo bránit hrad“.
- Mezi běhy zůstává sbírka itemů a je důvod jít znovu na konkrétního bosse.
- I prohraný běh něco dá: item ze zabitého bosse zůstane.
- Systém je připravený na pozdější obtížnosti (jiné prostředí + zvolená obtížnost): itemy mají úroveň, bossové tabulky dropu.

**Mimo rozsah**
- Obtížnosti a další prostředí (Petr: přijdou později jako kombinace prostředí a obtížnosti).
- Omezení podle typu zbroje (plát, kůže, látka), sety, recepty, náhodné vlastnosti, dřevo, obchod u hradu.
- Talenty a perky účtu, odemykání hrdinů, AI spojenec, co-op.
- Vlastní 3D modely itemů na hrdinovi (výbava se na modelu hrdiny nezobrazuje).

**Nechceme**
- Výbavu, která udělá truhly zbytečnými, ani truhly, které udělají výbavu zbytečnou.
- Drop, který je k ničemu (proto pravidla pro duplikáty).
- Hnědozlatý vzhled a oranžovou: hra zůstává v tmavě modré a šedomodré.
- Cokoli zkopírovaného z mapy v datech pro hráče (jména, texty). Viz Clean room v `AGENTS.md`.

## 3. Co rozhodl Petr

1. Truhly leží na mapě, platí se zlatem, výběr 1 ze 3, každá další je dražší. Truhel může být hodně; brzdou je zlato z killů.
2. Pozice jako ve WoW, vzhled Diablo II.
3. Trvalé itemy padají z bossů a ukazují se v menu; v běhu se dočasně vylepšují.
4. Truhla do prázdného slotu dá dočasný základní item na tento běh; další truhly ho vylepšují.
5. Itemy jsou pevné (ručně navržené), každý boss má tabulku dropu.
6. Jedna společná sbírka; každý hrdina unese cokoli a má vlastní panenku.
7. Duplikáty: boss nejdřív shodí, co hráč nemá; potom duplikát trvale zvedne úroveň itemu.
8. Zvláštní efekt má 6–8 itemů, ne většina.
9. Pět rarit: běžný, vzácný, epický, legendární, mytický.
10. Rozdělení rarit, náčrt obrazovky výbavy a pravidla truhel z chatu (oddíly 5–8 níže) schválil slovem „ano“.
11. Postavit všechno v jednom plánu (cesta 3 níže).

## 4. Cesty

1. **Nejdřív truhly, potom trvalá výbava** (doporučení Clauda). Menší první krok, systém statů se ověří na 16 itemech před napsáním katalogu.
2. **Nejdřív trvalá výbava, potom truhly.** Dlouhodobý cíl dřív, ale velký první krok a v běhu se skoro nic nezmění.
3. **Všechno v jednom plánu** (vybral Petr, „obojí 3“). Hraje se až celek; vyvážení se ladí pro dvě nové věci naráz.

Důsledek volby 3 pro plán: úkoly seřadit tak, aby hra byla po každém úkolu hratelná a `npm run check` zelený, a truhly s dočasnými itemy dokončit dřív než katalog a menu. Když se systém statů ukáže špatný, opraví se před napsáním 70 itemů.

## 5. Itemy

### 5.1 Pozice (16)

`head`, `neck`, `shoulders`, `back`, `chest`, `wrist`, `hands`, `waist`, `legs`, `feet`, `ring1`, `ring2`, `trinket1`, `trinket2`, `mainHand`, `offHand`.

- Item má **typ pozice** (14 typů: prsten a trinket mají po dvou slotech). Prsten jde do `ring1` i `ring2`, trinket obdobně.
- Hráč vlastní od každého itemu jeden kus (s úrovní). Tentýž item smí mít nasazený víc hrdinů zároveň (sbírka je společná, panenky jsou nezávislé), ale u jednoho hrdiny je jen v jednom slotu.
- Obouruční zbraně nejsou: `mainHand` a `offHand` jsou vždy dva sloty.

### 5.2 Rarity

| Rarita | id | Barva jména | Řádků statů | Efekt | Padá z |
|---|---|---|---|---|---|
| Běžný | `common` | bílá | 1 | ne | truhly (dočasné), Iron Marshal |
| Vzácný | `rare` | modrá | 2 | ne | Iron Marshal, Pale Abbot |
| Epický | `epic` | fialová | 3 | ne | Pale Abbot, Gunmaster |
| Legendární | `legendary` | zlatá | 4 | ano | Gunmaster, Dread Regent |
| Mytický | `mythic` | karmínová | 5 | ano, silnější | jen Dread Regent, malá šance |

### 5.3 Katalog (zhruba 70 itemů)

| Rarita | Počet | Poznámka |
|---|---|---|
| běžný | 14 | jeden na typ pozice; tytéž itemy dávají truhly jako dočasné |
| vzácný | 24 | každý typ pozice aspoň jeden |
| epický | 24 | každý typ pozice aspoň jeden |
| legendární | 5 | zbraně, druhá ruka, trinkety; všechny s efektem |
| mytický | 3 | všechny s efektem |

- Itemy mají sklon k atributu (STR, AGI, INT), aby každý hrdina našel v každé raritě kusy pro sebe. Jména a ikony mohou naznačovat plát, kůži a látku; omezení z toho neplyne.
- **Inspirace mapou** (jen pro kategorie, sledovatelnost v `design/items.yaml` polem `source`): zbraně (meče, glaivy, kopí, hůl), štít, boty, prsteny, orby jako trinkety, amulety. Hlava, ramena, záda, hruď, zápěstí, ruce, pas a nohy jsou nové.
- Jména a popisy jsou původní, v EN a CS.

### 5.4 Staty

- **Atributy:** `str`, `agi`, `int` (přičítají se k atributům hrdiny, takže platí stávající vzorce v `heroStats`).
- **Vedlejší staty:** `hp`, `armor`, `regen`, `damage` (%), `attackSpeed` (%), `moveSpeed` (%), `spellPower` (%), `magnet` (dosah sbírání), `goldFind` (%).
- Každý typ pozice má typický vedlejší stat (boty `moveSpeed`, hruď a nohy `hp`, zbraň `damage`, prsteny a krk `magnet` nebo `goldFind`). Katalog se od toho smí odchýlit.
- **Úroveň itemu:** všechna čísla itemu × (1 + krok × (úroveň − 1)). Výchozí krok 0,15. Efekty se úrovní neškálují, pokud to item výslovně neříká.
- **Trvalá úroveň** (z duplikátů): 1 až 5. **Dočasná úroveň** (z truhel): přičítá se k trvalé, bez stropu; brzdou je cena truhel.

### 5.5 Zvláštní efekty (8 itemů)

Stavějí se na druzích kouzel, které simulace už má (`on_hit`, `aura`, `shield`, `heal`, `nova`, `projectile`), bez nového systému. Příklady pro katalog (builder smí zaměnit za jiné stejné váhy):
- zbraň: každý N-tý útok vyšle řetězový blesk;
- zbraň: zásahy mají šanci zasáhnout i okolí;
- druhá ruka: pod 30 % HP štít, s pauzou;
- trinket: po zabití elity nebo bosse krátké zrychlení kouzel;
- trinket: aura, která zpomaluje nepřátele kolem hrdiny;
- mytické: silnější verze nebo efekt, který mění hru (například zlato léčí hrad).

Efekt je v tooltipu jeden řádek v barvě rarity.

## 6. Trvalá výbava

### 6.1 Drop
- **Každý zabitý boss shodí jeden item** ze své tabulky, hned po smrti, s oznámením (jméno v barvě rarity, „nový“ nebo „úroveň +1“).
- **Item zůstává i po prohře.** Ukládá se v okamžiku dropu, ne na konci běhu.
- **Výběr:** nejdřív se losuje rarita podle vah bosse, potom item té rarity. Přednost mají itemy, které hráč nemá. Když má všechny v dané raritě, padne duplikát, který ještě není na úrovni 5; když jsou všechny na 5, zkusí se jiná rarita téhož bosse; když je vysbíráno všechno, boss nic nedá a oznámení to řekne.
- **Tabulky (váhy jsou Claudovo rozhodnutí):** Iron Marshal běžný 60 / vzácný 40. Pale Abbot vzácný 60 / epický 40. Gunmaster epický 75 / legendární 25. Dread Regent epický 50 / legendární 40 / mytický 10.
- Item z bosse **v probíhajícím běhu nic nemění**; nasazuje se v menu.
- Los používá vlastní generátor odvozený ze seedu běhu a pořadí bosse, mimo `sim/` (závisí na sbírce, která do simulace nepatří). Simulace jen hlásí událost „boss padl“.
- V běhu s `?debug=1` se nic neukládá. Pro testování přibude `window.__game.debug.grantItem(id, level)` a `debug.clearGear()`.

### 6.2 Ukládání
- IndexedDB, verzovaná data s migracemi, export a import do souboru (první specifikace, 3.6).
- Obsah: sbírka (`itemId → úroveň`) a panenka každého hrdiny (`slot → itemId`).
- Neznámé id itemu při načtení (item zmizel z katalogu) se tiše zahodí.

### 6.3 Obrazovka výbavy (menu, u vybraného hrdiny)

```
┌──────────────────────────────────────────────────────────────┐
│  STONEHORN                         SBÍRKA  [vše][zbraně][…]  │
│                                                              │
│  [Hlava]              [Ruce]       ▣ ▣ ▣ ▣ ▣ ▣               │
│  [Krk]                [Pas]        ▣ ▣ ▣ ▣ ▣ ▣               │
│  [Ramena]  (hrdina)   [Nohy]       ▣ ▣ ▢ ▢ ▢ ▢               │
│  [Záda]               [Boty]                                 │
│  [Hruď]               [Prsten 1]   ┌────────────────────┐    │
│  [Zápěstí]            [Prsten 2]   │ Maršálova přilba   │    │
│                       [Trinket 1]  │ Vzácný · Hlava · 2 │    │
│  [Zbraň] [Druhá ruka] [Trinket 2]  │ +14 síla           │    │
│                                    │ +120 HP            │    │
│  STR 48  AGI 31  INT 22            │ Padá: Iron Marshal │    │
│  HP 1 240  Brnění 6                └────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

- Vlevo panenka se 16 sloty kolem hrdiny, pod ní součet statů s výbavou.
- Vpravo sbírka s filtrem podle pozice. Klik na item ho nasadí (prsten a trinket do prvního volného slotu, jinak nahradí první), klik na slot ho sundá.
- Itemy, které hráč nemá, jsou ve sbírce jako prázdné rámečky; tooltip říká, z koho padají.
- Tooltip: jméno v barvě rarity, řádek „rarita · pozice · úroveň“, řádky statů, řádek efektu, „Padá: boss“. U itemu ve sbírce porovnání s nasazeným (zelená a červená čísla).
- Vzhled: rámovaný kamenný panel, čtvercové sloty, v paletě hry (tmavě modrá, šedomodrá). Bez oranžové.
- Texty v EN a CS.

## 7. Zlato a truhly v běhu

### 7.1 Zlato
- Každý typ nepřítele má v `design/enemies.yaml` hodnotu `gold`. Zlato padá jako mince a sbírá se stejným mechanismem jako XP krystaly (magnet, pevná kapacita, žádná alokace v kroku).
- `goldFind` z výbavy násobí hodnotu při sebrání.
- Zlato platí jen v běhu; po běhu propadá.
- Ověřeno v kódu: naživu smí být nejvýš 150 nepřátel a balík, který se nevejde, propadne. Kdo zabíjí rychleji, dostane za běh víc nepřátel a tím víc zlata. Nový systém to nepotřebuje, ladění cen s tím musí počítat.

### 7.2 Truhly
- Na mapě leží vždy **3 truhly** na náhodných místech (generátor běhu), dál od hradu a od sebe. Po otevření se jinde objeví nová.
- **Cena:** základ × růst^(počet otevřených). Výchozí základ a růst určí builder podle cíle v oddílu 9.
- Hrdina vejde na truhlu a má dost zlata: zlato se odečte, běh přejde do stavu výběru (jako `levelUp`) a nabídne **3 různé sloty**. Bez zlata se nestane nic; truhla ukazuje cenu.
- **Volba slotu:** je-li ve slotu item (trvalý nebo dočasný), jeho dočasná úroveň +1. Je-li prázdný, vznikne v něm dočasný běžný item té pozice na úrovni 1.
- Karta nabídky ukazuje item, starou a novou úroveň a rozdíl statů.
- Když level-up a truhla přijdou zároveň, vyřídí se po sobě (nejdřív level-up).

### 7.3 HUD a panel v běhu
- Počítadlo zlata a cena příští truhly.
- Ukazatel k nejbližší truhle na okraji obrazovky (jako ukazatel hradu), zvýrazněný, když je na ni zlato.
- Panel výbavy v běhu (klávesa C, běh se zastaví): stejná panenka jako v menu, jen ke čtení, s dočasnými úrovněmi odlišenými barvou.
- Na konci běhu obrazovka ukáže itemy, které v běhu padly.

## 8. Technický rámec

- **Data:** `design/items.yaml` → `data/generated/items.json` přes `data:build`, se schématem v `data/schema`. `source` a `review` zůstávají jen v YAML. Tabulky dropu jsou u bossů v `design/enemies.yaml` nebo v `design/rules.yaml`.
- **Simulace:** `RunOptions.loadout` (pole `slot, itemId, level`) je vstup běhu, takže běh zůstává deterministický a přehratelný. Bonusy výbavy se sčítají do atributů a `hero.bonus`; přepočet jen při změně (start, truhla). Zlato, truhly a stav výběru jsou nové systémy v pevném pořadí `Run.step`, s typovanými poli pevné kapacity. Hash stavu zahrne zlato, truhly a úrovně slotů.
- **Meta vrstva** (nový adresář mimo `sim/` a `client/`, čistý a testovatelný): sbírka, panenky, los dropu, migrace uložených dat. Klient ji napojuje na IndexedDB.
- **Autopilot:** bot chodí pro truhlu, když na ni má zlato a není v ohrožení, a volí slot jednoduchým pravidlem. `sim:run` dostane volbu výbavy (`--gear none|mid|full`), aby šlo ladit obtížnost s výbavou i bez ní.
- **Ikony:** CC0 sada zapsaná v `assets/LICENSES.md`. Stačí ikona na typ pozice a variantu, rozlišení rarity dělá rámeček; 70 jedinečných ikon není podmínka.
- **Hrdina na panence:** nejlevnější použitelné řešení (statický obrázek z `npm run shots` nebo malý náhled modelu); rozhodne builder.
- **Testy:** jednotkové pro staty, úrovně, los dropu, migrace a truhly; e2e pro otevření truhly, drop z bosse (`?debug=1&phase=6`) a nasazení itemu v menu. `window.__game` dostane `gold`, `chests`, `gear`.

## 9. Vyvážení (cíle pro builder)

- **Bez výbavy, s truhlami:** autopilot vyhrává zhruba jako dnes na větvi `elite-boss-threat` (20 seedů, kontrola na 21–40). Truhly nesmějí běh zlehčit tak, že hrdina bez výbavy vyhrává vždy; případně se přitvrdí pozdní fáze.
- **Truhly v jednom běhu:** dobrý hráč otevře 12–20 truhel; na konci běhu dávají zhruba +50 % síly.
- **Plná nejlepší výbava:** zhruba 2× síla hrdiny (poškození i výdrž). Základní běh se s ní vyhrává pohodlně; to je přijaté, sílu později pohltí obtížnosti.
- Otevřené body z `docs/STATUS.md` (Sparkshot, Tidecaller, Gravecaller, křivka XP) tento návrh neřeší a nesmí je zhoršit.

## 10. Claudova rozhodnutí (Petr je může změnit)

- 16 pozic včetně zad; prsten a trinket po dvou slotech; bez obouručních zbraní.
- Barvy rarit: legendární zlatá místo oranžové, mytická karmínová.
- Počty itemů podle rarit (14 / 24 / 24 / 5 / 3) a váhy tabulek dropu.
- Krok úrovně 0,15, trvalý strop 5, dočasná úroveň bez stropu.
- Item z bosse se v probíhajícím běhu neprojeví.
- Stejný item smí nosit víc hrdinů zároveň.
- Vždy 3 truhly na mapě; ukazatel k nejbližší; panel výbavy na klávese C.
- V ladicím běhu se neukládá.
- Všechna čísla zlata, cen a statů (vyjdou z ladění podle oddílu 9).

## 11. Co zůstává na builderovi

- Konkrétní katalog 70 itemů: jména, staty, efekty, přiřazení bossům.
- Čísla zlata, cen truhel a statů.
- Volba CC0 sady ikon a řešení hrdiny na panence.
- Pravidla autopilota pro truhly.
- Rozdělení plánu na úkoly (viz důsledek v oddílu 4).

## 12. Zpřesnění při stavbě (2026-11-13)

Co plán a stavba určily nad rámec oddílů 1–11. Čísla a tabulka výher jsou v `docs/DECISIONS.md`, oddíl Gear, drops and chests.

- **Ikony:** vlastní SVG glyfy, jeden na typ pozice; raritu nese barva rámečku. Žádná CC0 sada.
- **Truhla a mince:** procedurální geometrie, bez modelu.
- **Hrdina na panence:** jedna modrošedá silueta pro všechny hrdiny (barva Kamenorohého je oranžová).
- **Drop:** tabulka bosse losuje raritu; item se vybere z rarity (nejdřív nevlastněný, potom úroveň navíc, potom jiná rarita bosse, nakonec nic). Los závisí jen na seedu běhu, pořadí bosse a sbírce.
- **Cena truhly:** n-tá truhla stojí 200 × 1,12^(n − 1) zlata.
- **Level-up a truhla zároveň:** nejdřív karty; truhla se otevře v dalším kroku. Truhla se vyhodnocuje na konci kroku, takže prohra ve stejném kroku má přednost a zlato se nestrhne.
- **Úroveň slotu:** trvalá (`base`, 0 u itemu z truhly) + dočasná (`temp`).
- **Body rozpočtu:** 1 bod = 0,5 atributu = 0,5 % poškození, rychlosti útoku nebo síly kouzel = 12 HP = 0,25 brnění = 0,1 regenerace = 1 % rychlosti pohybu nebo zlata = 10 dosahu sbírání.
- **Efekty:** šest druhů na osmi itemech; s úrovní itemu nerostou; dva nasazené itemy se stejným druhem se nesčítají.
- **Stejný item** smí nosit víc hrdinů, ale jeden hrdina ho má jen v jednom slotu.
- **Autopilot:** jde pro truhlu se zlatem, aspoň 30 % HP hrdiny a 50 % HP hradu, ne během finále.
- **Uložená data:** IndexedDB `defense-webgame`, store `save`, klíč `gear`; export a import souboru `.json` na obrazovce výbavy.
- **Nesplněný cíl oddílu 9:** truhly dávají hrdinovi bez výbavy zhruba +10 % síly, ne +50 %; silnější truhly hned zlehčily běh bez výbavy. Rozhodne Petr po playtestu.

