# Frakce nepřátel podle fází: návrh

- **Stav:** návrh ke schválení (20. 11. 2026). Rozhodnutí v tomto dokumentu jsou Claudova (Petr řekl „nechám na tobě“ a schválil směr B); Petr může kterékoli změnit.
- **Vychází z:** původního specu (`2026-11-04-defense-webgame-design.md`, fáze: „1–5 lidé, 6–10 orkové, 11–15 nemrtví, 16–20 elfové, všichni pod vlastními jmény a s vlastním vzhledem“) a Petrova pořadí „hra kompletní před multiplayerem“ (bod 3).
- **Staví na:** `main` po PR #25 (`3de6a45`), větev `factions`.

## 1. Záměr a proč

Celý běh (20 fází, 16:40) dnes posílá jen lidskou vlnu: šest typů se pěti chováními. Od poloviny běhu se nepřátelé nemění, jen jich je víc a jsou silnější; hra působí jednotvárně. Petr chce hru kompletní před multiplayerem a frakce jsou jedna z chybějících částí MVP.

Cíl: každých pět fází přijde jiná frakce, kterou hráč **pozná na první pohled a na poslech** a proti které **se hraje jinak**: každá nová frakce má vlastní typy na stávajících chováních a jednu vlastní mechaniku, která je vidět a dá se jí vyhnout nebo ji potlačit (Petr chce útoky, kterým jde uhnout; `areas` paměť, 2026-11-12).

## 2. Cíle, mimo rozsah, nechceme

**Cíle**
- Čtyři frakce po pěti fázích: lidé 1–5, orkové 6–10, nemrtví 11–15, elfové 16–20.
- Každá nová frakce: 4 běžné typy podle mapy (pěšák, střelec, těžký, kouzelník), jeden elitní vůdce a jedna nová mechanika.
- Přechod frakce je ohlášený (roh, zpráva v HUD) a plynulý (nepřátelé minulé frakce dobojují).
- Elitní nájezdy a elity fáze posílají elitu a těžké jednotky **aktuální** frakce.
- Vzhled frakcí jen z balíků KayKit, které už jsou připnuté (Adventurers, Skeletons); každá frakce má vlastní paletu barev (bez oranžové: Petr ji nemá rád).
- Zvuky smrti a útoku podle frakce z už zakódovaných CC0 souborů (`assets/audio/sfx`).
- Autopilot frakce zvládá (uhýbá kořenům, opouští jedovatý mrak) a balanc zůstane blízko dnešku.

**Mimo rozsah**
- Nové modely (vizuální fáze B: Tripo nebo Blender na Petrově počítači) a nové stažené balíky.
- Nové bossy frakcí: Iron Marshal (4:10), Pale Abbot (8:20), Gunmaster (12:30) a Dread Regent zůstávají. Minibossové přicházejí v prvním kroku fází 6, 11 a 16, tedy ve stejném kroku jako nová frakce (každá frakce začíná bossem minulé části); s tím počítá zpráva (4.7) i balanc (4.9).
- Obtížnosti, prostředí, co-op, víc hrdinů v simulaci.
- Změna lidských typů kromě vzhledu a zvuku smrti.

**Nechceme**
- Frakce, které jsou jen přebarvení (stejná hra pod jinými jmény).
- Mechaniku, které nejde uhnout ani ji jinak ovlivnit (trvalé zpomalení, kořeny bez výstrahy).
- Jména a texty z Warcraftu: vlastní jména (čistá místnost, `AGENTS.md`). Kódy map (`ogru`, …) jen v `design/` a `docs/`.

## 3. Přístupy

| | Přístup | Co dává | Co stojí |
|---|---|---|---|
| A | Jen převlek: nové typy s jinými čísly a barvou na dnešních chováních | nejlevnější, jen data | proti orkům se hraje jako proti lidem; nesplní záměr |
| **B** | **Frakce s vlastními typy na stávajících chováních + jedna nová mechanika na frakci, modely z připnutých balíků** | **viditelná i hratelná odlišnost, žádné nové zdroje** | **4 nové mechaniky v simulaci; orkové a elfové vypadají jako přebarvené postavy KayKit** |
| C | B + nové modely (Tripo, Blender, cizí CC0 balíky) | nejlepší vzhled | čeká na Petrův počítač; volné balíky orků a elfů nesedí stylem ke KayKitu (Quaternius je „roztomilý“) |

**Vybráno B** (Claude, Petr schválil 20. 11. 2026). C přijde ve vizuální fázi B; data typů mají pole `model`, takže výměna modelu později nezmění simulaci.

## 4. Návrh

### 4.1 Frakce a typy

Jména jsou vlastní (EN / CS). Zdroj čísel je jednotka mapy (`source`), jako dnes; `multipliers` a `behavior` jsou výchozí návrh, který plán doladí podle balancu (4.9).

| Frakce (fáze) | Typ (id) | EN / CS | Zdroj | Chování | Role a zvláštnost |
|---|---|---|---|---|---|
| **Lidská legie** / Human Legion (1–5) | dnešních 6 typů | beze změny | — | beze změny | jen nový model a zvuk (4.6, 4.7) |
| **Krvavý klan** / Blood Clan (6–10) | `brute` | Brute / Surovec | `ogru` | `siege` | pěšák, víc hp než štítonoš |
| | `spearthrower` | Spearthrower / Oštěpař | `ohun` | `skirmish` | střelec, oštěp |
| | `hornback` | Hornback / Rohatec | `otau` | `charge` | těžký, nájezd jako kopiník, víc hp |
| | `bloodcaller` | Bloodcaller / Krvavý šaman | `oshm` | `support` | sesílá **krvežíznivost** (4.2) |
| | `warlord` (elita) | Warlord / Válečný vůdce | `ogru` | `charge`, `hunter` | elita jako kapitán, aura jako kapitán |
| **Neklidní mrtví** / Restless Dead (11–15) | `ghoul` | Ghoul / Ghúl | `ugho` | `flank` | rychlý, loví hrdinu |
| | `webcrawler` | Webcrawler / Pavučinář | `ucry` | `skirmish` | střelec, zásah **zpomalí** (4.3) |
| | `rotgut` | Rotgut / Hnilák | `uabo` | `siege` | těžký, kolem sebe **jedovatý mrak** (4.4) |
| | `gravebinder` | Gravebinder / Kostivlád | `unec` | `support` | **zvedá padlé** jako kostlivce (4.5) |
| | `risen` | Risen / Zvednutý | `ugho` | `siege` | slabý kostlivec, 0 XP, 0 zlata |
| | `bone-tyrant` (elita) | Bone Tyrant / Kostěný tyran | `uabo` | `siege`, `hunter` | elita s větším mrakem |
| **Měsíční háj** / Moon Grove (16–20) | `huntress` | Huntress / Lovkyně | `esen` | `flank` | rychlá, loví hrdinu |
| | `moon-archer` | Moon Archer / Měsíční lučištnice | `earc` | `skirmish` | nejdelší dostřel ze střelců |
| | `stone-warden` | Stone Warden / Kamenný strážce | `emtg` | `siege` | tank: nejvíc hp běžných typů, odolný vůči odhození |
| | `grove-druid` | Grove Druid / Hájový druid | `edoc` | `support` | léčí jako kaplan a sesílá **kořeny** (4.4b) |
| | `grove-warden` (elita) | Grove Warden / Strážce háje | `emtg` | `charge`, `hunter` | elita, sesílá kořeny častěji |

Pravidla:
- Nové typy se přidávají na konec `design/enemies.yaml` (index typu je pořadí; štítonoš zůstává první).
- Každý typ má nové pole `faction` (`human`, `orc`, `undead`, `elf`); bossové frakci nemají.
- `rules.enemies.elite` (dnes `captain`) se stane mapou frakce → elita. `elites` fáze posílají elitu frakce té fáze.
- Elitní nájezdy (`rules.events`, `kind: rush`) berou jednotky z **frakce fáze, ve které nájezd přijde** (Claudovo rozhodnutí po kontrole recenzenta): v datech zůstanou počty (elity, těžcí), typy dosadí simulace podle frakce, takže nájezd sleduje i parametr `duration`. Při `phaseSeconds: 50`: 3:00 fáze 4 lidé (kapitán + kopiníci, beze změny), 6:00 fáze 8 orkové (vůdce + rohatci), 9:00 fáze 11 nemrtví (tyran + hniláci), 12:00 fáze 15 nemrtví, 15:00 fáze 19 elfové (strážce háje + kamenní strážci). Počty zůstanou jako dnes; nájezd v 9:00 přijde 40 s po Pale Abbotovi a příchodu nemrtvých, takže ho plán hlídá v balanci (4.9) a smí snížit jeho počty.
- Odolnost vůči odhození (kamenný strážce, elity): nové volitelné pole typu, násobí knockback (0 = nepohne se). Jeho hodnotu volí plán.

### 4.2 Orkové: krvežíznivost

- Krvavý šaman se drží za spojenci jako kaplan (`support`). Každých 6 s (výchozí) vybere až 3 orky (frakce `orc`, ne bossy, ne sebe) do 450 bez krvežíznivosti a dá jim ji na 8 s.
- Krvežíznivost: +30 % rychlost pohybu, +30 % poškození a +30 % rychlost útoku (kratší prodleva útoku). Sčítá se s aurou vůdce stejně jako dnešní aura kapitána (plán ověří, že výsledek nepřekročí rozumný strop).
- Je to časovaný stav nepřítele (pole s počtem kroků v úložišti nepřátel, bez alokace).
- Vidět: posílený ork žhne rudě (emise, jako zásah, ale trvale po dobu účinku); při seslání krátký rudý záblesk nad šamanem. Zvuk seslání.
- Jak ji potlačit: zabít šamana (drží se vzadu, 330 hp mapy × škálování, tedy křehký).

### 4.3 Nemrtví: síť pavučináře

- Každý zásah pavučináře (střela) na hrdinu ho zpomalí o 30 % na 2 s. Nesčítá se, nový zásah obnoví čas. Hrad nezpomaluje.
- Zpomalení je samostatný násobič rychlosti hrdiny (nesmí se přepisovat s `speedScale` botového orbu; oba platí najednou). Úskok (Space) zpomalení neruší, ale jeho vzdálenost nemění.
- Vidět: šedobílá síť pod hrdinou a ikona účinku v řádce účinků nad lištou schopností (jako orby), sekundy do konce.

### 4.4 Nemrtví: jedovatý mrak hniláka

- Hnilák má kolem sebe stálý mrak o poloměru 220 (výchozí). Hrdina uvnitř dostává 2 % max hp za sekundu (výchozí; škálování 4.9), jako poškození od nepřítele (brnění neplatí, štít Spirit Ward ano).
- Hrad mrak nezraňuje (hniláci jsou `siege` a u hradu by ho zbytečně drtili; hrad už bije jejich útok).
- Vidět: zelenošedý kruh na zemi kolem hniláka (stejný druh kruhu jako výstraha slamu, jiná barva, trvale). Tyran má mrak 350.
- Jak se mu vyhnout: nestát u hniláka, zabíjet ho z dálky.

### 4.4b Elfové: kořeny druida

- Druid i strážce háje sesílají kořeny jako dnešní úder z dálky (`sim/enemy-strike.ts`): kruh výstrahy na místě hrdiny (poloměr 160, výstraha 1 s), druid stojí. Kdo zůstane v kruhu, je **spoután 1,2 s**: nemůže chodit ani použít úskok; útoky a kouzla běží dál. Hrad kořeny nezasáhnou.
- Druid: dosah 400–900, každých 9 s. Strážce háje: 300–900, každých 6 s.
- Kořeny nezraňují (poškození 0); úder z dálky dnes vždy zraňuje, takže dostane druh účinku (`damage` / `root`).
- Vidět: zelený kruh výstrahy (bossové mají rudý), po spoutání kořeny kolem nohou hrdiny a ikona v řádce účinků.
- Druid navíc léčí jako kaplan (`heal`).

### 4.5 Nemrtví: kostivlád zvedá padlé

- Simulace si pamatuje posledních 64 míst smrti běžných nepřátel (kruhový buffer: x, y, krok smrti, bez alokace). Bossové, elity a zvednutí se nepamatují.
- Kostivlád každých 5 s (výchozí) zvedne až 2 kostlivce `risen` z míst smrti do 500 od sebe, mladších než 10 s. Použité místo se smaže. Strop živých nepřátel (`maxAlive 150`) platí.
- Zvednutý: slabý (hp kolem poloviny ghúla), `siege`, **0 XP a 0 zlata**, nepouští srdíčka (žádné farmení).
- Vidět: zelený záblesk a krátký výstup ze země (stačí efekt spawnu s jinou barvou). Zvuk.
- Jak ho potlačit: zabít kostivláda; zabíjet tak, aby mrtví nebyli u něj.

### 4.6 Vzhled

Modely jen z připnutých balíků (Adventurers: Knight, Barbarian, Rogue, Rogue_Hooded, Mage; Skeletons: Minion, Warrior, Rogue, Mage), řezané nástrojem `tools/assets-build` jako dnes (limity: 3000 trojúhelníků, 700 kB na nepřítele).

**Rozpočet velikosti** (Claudovo rozhodnutí po kontrole recenzenta): modely mají dnes 5,6 MB ze 6 MB; jeden nepřítel má kolem 280 kB, téměř celé jsou to stopy animací (textura 17 kB). Každý nový typ dostane vlastní model (jinak by frakce byly jen přebarvení). Plán nejdřív zmenší stopy animací v `tools/assets-build` (převzorkování nebo kvantizace klipů, jen tři klipy `Idle`, `Punch`, `Walking`), pak podle výsledku zvedne celkový strop v `tests/assets.test.ts` nejvýš na 10 MB a zapíše to do `docs/DECISIONS.md`. Typy se stejným tělem i zbraní (např. surovec a vůdce) smějí sdílet soubor přes pole `model`.

- **Lidé** dostanou lidská těla místo kostlivců (kostlivci patří nemrtvým): štítonoš Knight se štítem, zvěd Rogue s nožem, mušketýr Rogue s kuší, kaplan Mage, kopiník Knight s kopím nebo mečem, kapitán Knight s pláštěm. Paleta: ocelově modrá a šedá.
- **Orkové:** Barbarian (surovec, rohatec větší), Rogue_Hooded (oštěpař), Mage (šaman), vůdce Barbarian velký. Paleta: tmavě zelená a hnědá.
- **Nemrtví:** kostlivci (ghúl Minion, pavučinář Rogue, hnilák Warrior velký, kostivlád Mage, zvednutý Minion malý, tyran Warrior velký). Paleta: kostní bílá, zelenavá.
- **Elfové:** Rogue_Hooded (lovkyně), Rogue s kuší (lučištnice), Knight velký (kamenný strážce), Mage (druid), strážce háje Knight velký. Paleta: modrofialová a tyrkysová.
- Velikost těžkých typů a elit: měřítko modelu (dnes ho určuje kolize; plán ověří, jestli stačí).
- Bossové dnes kreslí modely lidských typů (`model: lancer`, `chaplain`, `musketeer`, `captain`); po změně lidí budou lidští. To je v pořádku.
- Pokud se nějaká kombinace (zbraň na těle) nedá z balíku vyříznout, plán zvolí nejbližší a zapíše to do `docs/DECISIONS.md`.
- Hrdinové používají stejná těla. Nepřátelé se od nich musí na první pohled lišit: paletou frakce a tím, že jsou menší (kontrola na snímcích `npm run shots`).

### 4.7 Zvuk a zpráva o frakci

- Každý typ dostane v `design/audio.yaml` zvuk smrti podle frakce z už zakódovaných souborů (lidé: kov a výkřik, orkové: těžký úder, nemrtví: chřestění kostí jako dnes, elfové: lehký, vzdušný). Když vhodný soubor chybí, plán vybere nejbližší a zapíše to; nové nahrávky z Petrovy složky `Downloads\Zvuky` jsou volitelné.
- Nové zvuky událostí: krvežíznivost, síť, kořeny (výstraha a spoutání), zvednutí mrtvých, příchod frakce (roh; může být dnešní `war-horn`).
- Na začátku fáze 6, 11 a 16 zpráva v HUD: „Blíží se Krvavý klan!“ / „Neklidní mrtví povstávají!“ / „Měsíční háj vyráží!“ (EN: „The Blood Clan approaches!“, „The Restless Dead rise!“, „The Moon Grove marches!“). Sdílí místo se zprávou o bossovi; když přijde boss ve stejném kroku (4:10), boss má přednost a zpráva o frakci přijde po něm.

### 4.8 Fáze

- Tabulky fází (`rules.phases[].mix`) se přepíšou: fáze 1–5 lidé (beze změny), 6–10 orkové, 11–15 nemrtví, 16–20 elfové. Velikosti smeček, intervaly, `hunterShare` a počty elit zůstanou jako dnes; váhy typů volí plán (výchozí: pěšák nejčastější, kouzelník nejméně).
- První fáze frakce může ještě obsahovat menší díl minulé frakce (plynulý přechod) – rozhoduje plán podle toho, jak to působí; výchozí je čistý přechod.
- Finále (fáze 21) zůstává, jak je.

### 4.9 Čísla a balanc

- Hp, poškození, rychlost a dosah z mapy přes `multipliers` a `design/scaling.yaml` jako dnes. Typy jedné role mají mít podobný tlak jako lidský protějšek v téže fázi (pěšák ≈ štítonoš, střelec ≈ mušketýr, těžký ≈ kopiník, kouzelník ≈ kaplan); nové mechaniky tlak přidávají, takže se čísla typů mohou snížit.
- Cíl balancu (Claudův): výhry autopilota (`sim:run --hero all --seeds 1-20`, bez výbavy i `--gear mid`) na hrdinu v rozmezí ±3 proti `main` před změnou; ztráty se nesmí shlukovat na začátku nové frakce (např. všechny v 5:00–6:00). Plán nejdřív změří `main`.
- Poškození mraku a zpomalení se škálují s fází jako ostatní poškození nepřátel (mrak je podíl max hp hrdiny, takže neškáluje; plán ověří).

### 4.10 Autopilot

- Kořeny: kruh kořenů je výstraha jako slam; autopilot z něj vystoupí stejně (`SLAM_MARGIN`).
- Mrak: autopilot nestojí v mraku, pokud nejde po hrozbě u hradu (drží odstup od hniláka jako melee od cíle: útočí z okraje, nebo cíl změní).
- Kostivlád a šaman: autopilot je bere jako přednostní cíl v dosahu `CHASE_DISTANCE` (jako hráč, který ví, co dělá).
- `sim:run` vypíše na hrdinu, kolikrát byl spoután, kolik hp ztratil v mraku a kolik kostlivců vstalo.

### 4.11 Ladění a testy

- `?debug=1&phase=6|11|16` začne u frakce. `__game.debug.spawnEach()` zplodí jednoho lovce každého běžného typy **aktuální frakce**; nový `__game.debug.spawnFaction(id)` zplodí po jednom každého typu dané frakce.
- `window.__game` přidá `faction` (id frakce aktuální fáze), `rooted` (sekundy spoutání), `slowed` (sekundy zpomalení).
- `npm run shots` přidá snímek `factions`: jeden typ od každé frakce vedle hrdiny (čitelnost palet a velikostí).
- Unit testy pro každou mechaniku (krvežíznivost, síť, mrak, kořeny, zvednutí mrtvých, výběr elity podle frakce, nájezd podle frakce) a determinismus (`hash`).
- e2e: start ve fázi 6 ukáže orky a zprávu o frakci.

## 5. Omezení

- Pravidla `AGENTS.md`: čistá simulace, determinismus, žádná alokace v kroku, žádná jména z mapy v `client/`, `sim/` a vygenerovaných datech.
- `data:build` potřebuje export mapy (`data-source/`, neverzovaný). Mapa je soubor `X_Hero_Siege_F-Day_v20.75_AI.w3x` v projektu claude.ai; `npm run map:extract -- <map> v20.75`.
- Nové typy zvětší počet instancovaných sítí (jedna na typ, VAT). Plán ověří fps na `?fps=1` s plnou smečkou elfů.

## 6. Co zůstává na plánu

- Přesná čísla `multipliers`, váhy fází, hodnoty krvežíznivosti, mraku, kořenů a zvedání podle balancu (výchozí výše).
- Přesné části balíků KayKit pro každý model, měřítka a barvy palet.
- Výběr zvukových souborů.
- Hodnota odolnosti vůči odhození.
- Jestli je přechod frakcí čistý, nebo s malým překryvem.

## 7. Poznámka pro pozdější co-op (Petr, 20. 11. 2026)

Zapisuje se do `docs/DECISIONS.md`, v tomto projektu se nestaví:
- AI spojenec pro hráče nebude; spojenec byl jen pro simulace.
- Co-op hru násobně ztíží (podle počtu hráčů).
- Padlého spoluhráče oživí ten, kdo na něm stojí 5 s.
- Víc hrdinů v simulaci se staví až na začátku multiplayeru.
