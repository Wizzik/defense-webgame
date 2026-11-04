# Defense Webgame: návrh hry

- **Stav:** návrh ke kontrole, 4. 11. 2026
- **Pracovní název:** Defense Webgame. Finální název nesmí obsahovat „Warcraft“ ani „Hero Siege“.
- **Podklady:** výzkumná zpráva `claude/Vyzkum_X_Hero_Siege_webova_survival_hra.md`, inventář mapy `claude/xhero-data/map_content.md` a JSON exporty mapy ze skillu `xhero-map-data`. Vše je v projektu Defense Webgame.

## 1. Cíl

Webová RPG survival hra podle Warcraft III mapy X Hero Siege F-Day (v20.75). Hráč jen pohybuje hrdinou, kouzla se sesílají sama. Styl je inspirovaný Azeroth Survivors (wow.aethus.pl).

Hra je **veřejná, zdarma a postavená jako čistý remake**:
- z mapy přebírá mechaniky, strukturu a čísla;
- nepřebírá kód, texty, jména Blizzardu ani grafiku.

**Pro koho:** hráči survivors her a fanoušci hero siege map, hraní v desktopovém prohlížeči.

**Hotovo, když:**
1. Běh na 15–20 minut jde dohrát od výběru hrdiny po finálního bosse.
2. Hrad v běhu má váhu: hráč se k němu vrací bránit i nakupovat.
3. Hrdinové se od sebe liší i při automatickém sesílání.
4. Hra drží zhruba 60 fps se 150 nepřáteli na běžném notebooku s integrovanou grafikou.
5. Další hrdinové se přidávají v dávkách z dat mapy bez přepisování enginu.

## 2. Rozhodnutí

| Téma | Rozhodnutí |
|---|---|
| Rozsah a právo | veřejná hra zdarma, čistý remake: mechaniky a čísla z mapy, vlastní nebo CC0 grafika, nová jména a texty |
| Identita | hybrid obrany hradu a survivors: obléhači jdou na hrad, lovci po hrdinovi, pád hradu znamená prohru |
| Délka běhu | 15–20 minut, plynulý tok nepřátel bez pauz mezi vlnami |
| RPG postup | itemy a recepty v běhu; mezi běhy se odemykají hrdinové, talenty a perky účtu |
| Hra více hráčů | první verze sólo s AI spojencem; online co-op později nad deterministickou simulací |
| Vzhled | 3D low-poly, kamera shora pod úhlem jako ve WC3 |
| Platforma | desktopový prohlížeč, WASD a myš; mobil později |
| Technologie | TypeScript, Three.js (WebGPURenderer s automatickým fallbackem na WebGL2) a Vite |
| Ovládání kouzel | všechna automaticky; ručně jen úskok (mezerník) a ultimátka (R) s volbou automatiky |

## 3. Herní design

### 3.1 Průběh běhu

- **Výběr:** hrdina a obtížnost (Normal / Insane / Hell).
- **Časová osa:** 20 fází po 50 s, celkem 16:40, a po nich finální boss.
  - Každá fáze mění složení nepřátel. Fáze 1–5 lidé, 6–10 orkové, 11–15 nemrtví, 16–20 elfové, všichni pod vlastními jmény a s vlastním vzhledem.
  - Intenzita roste plynule a mezi fázemi se nic nezastavuje. HUD ukazuje „Fáze 7/20“.
- **Elitní nápory:** ve 3:00, 6:00, 9:00, 12:00 a 15:00 přijde krátká vlna elit. Je to obdoba speciálních vln mapy, které chodily každých 300 s.
- **Bossové:**
  - minibossové na začátku fází 6, 11 a 16 (4:10, 8:20, 12:30);
  - finální boss v 16:40; běžný tok nepřátel mezitím pokračuje, jen slabší.
  - Ve 20:00 finální boss zesílí (enrage), aby běh nešel natahovat.
- **Výhra:** padne finální boss.
- **Prohra:** padne hrad, nebo zemře hrdina a nemá oživení (perk nebo item).
- **Pauza:** hra se zastaví jen při level-upu (výběr karty) a v menu.

### 3.2 Mapa, hrad a nepřátelé

**Mapa:**
- Jedna aréna: hrad na jihu a 2–3 brány na severu, z nich lajny k hradu.
- Hrdina se pohybuje volně.
- Počet bran jako nastavení hustoty (2/4/6/8 jako v mapě) až po MVP.

**Hrad:**
- Má HP, které se samo pomalu obnovuje (výchozí 2 % maxima za minutu).
- Oprava za dřevo: +25 % HP.
- 2 sloty pro věže, které se kupují za dřevo.
- Útok na hrad ukáže šipka u okraje obrazovky a upozornění v HUD.

**Nepřátelé:**
- **Obléhači** jdou po lajně na hrad. Na hrdinu reagují, až když na ně zaútočí, nebo když přijde do jejich malého dosahu.
- **Lovci** pronásledují hrdinu.
- Poměr obléhačů a lovců určuje tabulka fází. Je to hlavní ladicí knoflík a v MVP se ověřuje jako první.
- Na ploše je najednou nejvýš **150 živých nepřátel** (nastavitelné; cíl po MVP 300).

**Obtížnost:**

| Obtížnost | HP a poškození nepřátel | Počet nepřátel | Navíc |
|---|---|---|---|
| Normal | ×1,0 | ×1,0 | – |
| Insane | ×1,75 | ×1,2 | elitní nápor každé 2 minuty |
| Hell | ×3,0 | ×1,4 | elitní nápor každé 2 minuty, elity s modifikátory |

- K tomu se přidává časová složka `1 + t/1200` se stropem ×2,0.
- Vychází z mapového `Diff_Mult` (plná síla 1/3/15), ale je mírnější a má strop.
- Pozdní fáze škáluje poškození, ne počet entit.
- Všechny hodnoty jsou výchozí a ladí se v datech.

### 3.3 Hrdinové a kouzla

**Hrdina:**
- Je archetyp hrdiny z mapy s novým jménem a vzhledem.
- Z předlohy bere primární atribut a přírůstky STR/AGI/INT, základní útok (na blízko nebo na dálku) a 3 podpisová kouzla podle svých kouzel v mapě.
- Ultimátka vychází ze 4. kouzla mapy a je na R s volbou automatiky.
- Úskok nebo blink je na mezerníku.

**MVP hrdinové** (pracovně pod jmény předloh; všechna jejich kouzla jsou v mapě schopnosti enginu):

| Předloha | Role | Kouzla v mapě |
|---|---|---|
| Tauren (`O00C`) | STR, na blízko | ShockRock, SplashDmg, StunDmg, Echo Slam |
| Daisho (`O008`) | AGI, na dálku | HunStress Night, Star Fall, Endurance, HunTress Image |
| UnderTaker (`O00F`) | INT, kouzelník | Dead Catch, Fan of Skull, Death Coil, Stampede Coil |
| Snaker (`O00X`) | INT, vyvolávač a podpora | Snake, Forked Lightning, Healing All, Big Bad Voodoo |

**Druhy kouzel a jejich cílení:**

| Druh | Cílení |
|---|---|
| střela | nejbližší nepřítel, elity mají přednost |
| okamžitý zásah | nejbližší nepřítel |
| řetěz | nejbližší nepřítel, pak skáče na další |
| plocha | nejhustší shluk v dosahu |
| linie / vlna | směr pohybu, jinak nejbližší cíl |
| nova kolem hrdiny | na cooldown, nebo když je v dosahu aspoň N nepřátel |
| kužel | směr pohybu |
| tikající plocha | pod hrdinou, nebo na shluku |
| aura | trvale |
| vyvolání | na cooldown, vyvolané jednotky dědí síly hrdiny |
| efekt při zásahu | proc při útoku |
| léčení | když HP klesne pod práh |
| štít | když HP klesne pod práh |

Vlastní druhy se přidávají jen pro kouzla, která do této tabulky nezapadnou. Celkem jich má být 15–20.

**Sloty a pooly:**
- 6 aktivních kouzel a 4 pasivky, každé do úrovně 5.
- Sdílený pool zhruba 10 kouzel a 6 pasivek.
- Bonus z mapy „součet atributů × násobitel“ (systém LB_) dostanou jen evoluce kouzel a ultimátky.

### 3.4 Level-up a atributy

- Z nepřátel padají XP krystaly, které se v dosahu magnetu přitahují k hrdinovi.
- Level-up nabídne 3 karty: nové kouzlo, úroveň kouzla, pasivka nebo atribut.
  - Karta ukazuje přesnou změnu, např. „Poškození 20 → 26“.
  - Karty jde 2× za běh přehodit (perky přidají další).
- Cíl je 40–50 level-upů za běh. XP křivka se ladí na tento cíl, z mapy se nepřebírá.
- **Atributy (bez many, kouzla mají jen cooldown):**
  - STR: HP a regenerace;
  - AGI: rychlost útoku a brnění;
  - INT: síla kouzel a kratší cooldowny;
  - primární atribut navíc přidává poškození základního útoku.
- **Strop rychlosti útoku:** jako v mapě (rychlost útoku +600 %).

### 3.5 Itemy, obchod, recepty a měny

- **Zlato** padá z nepřátel. **Dřevo** je vzácné a padá z elit a bossů.
- **Obchod u hradu:**
  - Otevře se, když hrdina dojde do okruhu hradu. Hra se nezastaví.
  - Nabízí 4 položky, které se obnoví při změně fáze.
  - Přehození stojí zlato a cena roste. Položku jde zamknout.
- **Výbava:**
  - 6 slotů;
  - rarity common, rare, epic a legendary odpovídají úrovním z mapy;
  - truhly z elit a bossů nabízejí výběr 1 ze 3.
- **Recepty:**
  - dva stejné itemy dají vyšší úroveň (podle řetězce Warbringer v mapě);
  - **evoluce:** kouzlo na úrovni 5 a k němu katalyzátor dají silnější verzi z truhly bosse (podle svitků receptů a setů v mapě).
- **Za dřevo:** věže, oprava hradu a části receptů.

### 3.6 Mezi běhy

- Za běh se získávají body účtu. Odemykají:
  - další hrdiny (začíná se se 4, další přicházejí po dávkách);
  - strom talentů u každého hrdiny (zhruba 10 uzlů);
  - perky účtu (startovní zlato, přehození, dosah magnetu, oživení).
- Ukládá se v prohlížeči (IndexedDB) s exportem a importem do souboru. Data jsou verzovaná a mají migrace.

### 3.7 AI spojenec

- CPU hrdina na stejném systému automatických kouzel.
- Umí následovat hráče, bránit hrad a uhýbat.
- Karty volí podle logiky z AI_ mapy, tedy rovnoměrné rozdělování bodů.
- Přichází hned po MVP a je součástí první veřejné verze.

### 3.8 Co je v MVP a co později

| Oblast | MVP | Později |
|---|---|---|
| Hrdinové | 4 | další po dávkách 4–6, nejdřív s kouzly enginu |
| Kouzla | 3 podpisová na hrdinu, zhruba 10 sdílených, 6 pasivek, 4–6 evolucí | další druhy a evoluce |
| Itemy | zhruba 20 ve 3 raritách, kupují se za zlato (dřevo v MVP slouží jen na věže a opravu hradu) | 4. rarita, dřevo v receptech |
| Hrad | HP, regenerace, 2 věže | volitelné věže, nastavení počtu bran |
| Obtížnost | Normal / Insane / Hell | prokletí a posuvníky jako v Azeroth Survivors |
| Mezi běhy | odemykání hrdinů a 3–5 perků | talenty, úspěchy |
| AI spojenec | ne | první veřejná verze |
| Eventy | ne | arény jako volitelné portály, Item Event jako časovaná událost, Death Road jako delší režim |
| Hra více hráčů | ne | online co-op nad deterministickou simulací |

## 4. Architektura

Jeden veřejný repozitář na GitHubu (`Wizzik/defense-webgame`; veřejný podle rozhodnutí autora ze 4. 11. 2026, původně plánovaný jako soukromý do vydání):

```
sim/      herní logika v čistém TypeScriptu, bez závislosti na prohlížeči
client/   Three.js, vstup, kamera, efekty, zvuk, HTML/CSS rozhraní
data/     herní data v JSON se schématem
design/   vlastní jména, texty (EN/CZ) a úpravy balancu v YAML
tools/    map-extract (nástroj ze skillu xhero-map-data) a data-build
e2e/      testy v Playwrightu
assets/   modely a textury + LICENSES.md
```

**Simulace (`sim/`):**
- pevný krok 30× za sekundu, seedované RNG a entity v typovaných polích;
- vstupy jsou příkazy (směr pohybu, úskok, ultimátka, volba karty, nákup);
- výstupem je stav a události (zásah, smrt, seslání, level-up) pro efekty a zvuk;
- stejný seed a stejné příkazy dají vždy stejný výsledek. Na tom stojí testy, přehrávání záznamů i pozdější co-op.

**Klient (`client/`):**
- Three.js WebGPURenderer; bez WebGPU jede na WebGL2;
- vykresluje interpolovaný stav simulace;
- nepřátelé se kreslí přes instancing po typech (jedno volání na typ);
- animace nepřátel jsou zapečené do textur (vertex animation / bone textures);
- rozhraní je HTML/CSS nad canvasem.

**Výkon:**
- prostorová mřížka pro kolize, separaci a cílení;
- pooling objektů;
- žádné alokace v herní smyčce.

**Data (`data/`):**
- schémata v zod, která sdílí hra i nástroje;
- každý objekt nese původní kód z mapy (`source`).

**Ukládání:** IndexedDB, bez serveru.

**Nasazení:**
- GitHub Actions spustí testy a build, hra se vystaví na Cloudflare Pages;
- každá větev má náhledovou URL.

**Právní hranice:**
- `data-source/` (exporty mapy s texty a jmény Blizzardu) a surové soubory mapy jsou v `.gitignore`;
- do repozitáře jdou jen převedená čísla, vlastní texty a licencované assety;
- kódy a jména z mapy (hrdinové, kouzla, triggery) smí být jen v `tools/`, `design/` a `docs/` kvůli dohledatelnosti, nikdy v tom, co dostane hráč (`client/`, `sim/`, texty rozhraní, data, která klient zabalí).

## 5. Data a převod obsahu z mapy

**Tok dat:**
1. Mapa
2. Skill `xhero-map-data`, který exporty uloží do `data-source/<verze>/`
3. `tools/data-build` (TypeScript)
4. Herní data v `data/*.json`

`tools/data-build`:
- čte exporty a soubory `design/*.yaml`;
- přiřadí kouzla k druhům podle třídy ze skillu, základní schopnosti a ruční tabulky;
- přepočítá čísla na cílovou křivku běhu: doba zabití nepřítele a síla hrdiny v čase, s poměry mezi hrdiny, kouzly a itemy zachovanými z mapy. Přepočet je zdokumentovaný v `design/scaling.md`;
- výstup ověří schématy.

**Clean room:**
- jména a texty jsou nové (EN/CZ), tooltipy z mapy se nekopírují;
- převodní tabulka „jméno v mapě → jméno ve hře“ je jen v `design/`;
- designový dokument je psaný vlastními slovy.

**Skriptová kouzla:**
- 40 slotů s `implementation: script` jde na seznam k ručnímu převodu;
- každé se převádí až po přečtení svého triggeru ve `war3map.j`.

**Kontroly v CI:**
- schéma;
- referenční integrita (kouzla, itemy a ingredience existují);
- lint balancu (DPS a HP v rozsahu pro danou minutu).

**Nová verze mapy:**
- skill vytáhne data a ukáže diff;
- které změny se převezmou, rozhoduje autor a zapíše je do `design/`. Nic se nepřepisuje automaticky.

## 6. Grafika, animace, rozhraní a zvuk

**Styl:**
- stylizované low-poly 3D;
- kamera shora pod úhlem kolem 55° s lehkou perspektivou;
- čitelné siluety a barevné odlišení hrdinů, nepřátel a elit.

**Assety:**
- nejdřív CC0: KayKit (rigované a animované postavy), Quaternius (monstra, RPG postavy, rekvizity) a Kenney (UI, částice, zvuky);
- každý asset má záznam v `assets/LICENSES.md` (zdroj, licence, datum) a v credits;
- Mixamo jen bez syrových souborů v repozitáři;
- vlastní art direction je samostatná linka po MVP.

**Pipeline:**
- glTF → gltf-transform (meshopt, textury KTX2) → zapečení animací nepřátel;
- assety jdou do několika verzovaných balíčků, ne stovek souborů.

**Efekty a pocit ze hry:**
- shaderové částice (TSL) pro novy, linie a střely;
- záblesk a lehký odhoz při zásahu;
- XP krystaly s magnetem;
- minimapa s tečkami nepřátel a pingem hradu;
- šipky k hradu u okraje obrazovky;
- nastavení čitelnosti: průhlednost efektů, třesení zap/vyp, čísla poškození zap/vyp.

**Rozhraní:**
- HUD: HP, XP, čas a fáze, HP hradu, ikony kouzel s cooldowny, zlato a dřevo;
- karty level-upu;
- panel obchodu u hradu;
- inventář se 6 sloty;
- konec běhu se statistikami a rozpisem, co hrdinu zabilo;
- menu a nastavení.

**Zvuk:**
- CC0 zvuky (Kenney, OpenGameArt);
- hudba CC0, nebo CC-BY s uvedením autora;
- AI hudba jen s placenou licencí, která převádí práva;
- Web Audio s posuvníky hlasitosti.

**Jazyky:** angličtina a čeština přes i18n soubory.

## 7. Testování, chyby a postup práce

**Testy:**

| Úroveň | Co | Kde |
|---|---|---|
| jednotkové | vzorce poškození, cílení, cooldowny, plánovač fází, obchod, recepty | Vitest v Node |
| determinismus | stejný seed a příkazy dají stejný otisk stavu po N krocích | Vitest |
| data | schéma, integrita, lint balancu | CI |
| bot runs | autopilot odehraje desítky zrychlených běhů bez grafiky a hlídá dobu přežití, křivku DPS, level-upy, HP hradu a čas zabití bossů | Node, CI |
| E2E | menu → běh → karta → obchod → konec; screenshoty; chyba v konzoli test shodí | Playwright, headless Chrome (WebGL2 i WebGPU přes software) |
| výkon | overlay s fps a benchmarková scéna se 150, 300 a 600 nepřáteli | skutečná grafika (notebook autora) |

**Chyby:**
- bez WebGPU hra jede na WebGL2, bez obojího ukáže jasnou hlášku;
- selhané načtení assetu se zopakuje, jinak se použije náhrada;
- poškozené uložení se obnoví ze zálohy;
- chyby se zapisují do lokálního logu ve hře, bez telemetrie.

**Postup práce s AI:**
- `AGENTS.md` / `CLAUDE.md` s pravidly: clean room, datová pipeline, příkazy testů, malé soubory s jasnou rolí;
- každý krok projde cyklem plán → test → implementace → ověření → kontrola autora na náhledové URL;
- práce jde ve větvích přes pull requesty a do hlavní větve se dostane jen s procházejícím CI;
- pravidla po schválení specifikace zachytí skill „pravidla vývoje hry“.

## 8. Rozdělení na fáze

Každá fáze má vlastní implementační plán.

| Fáze | Cíl | Hotovo, když |
|---|---|---|
| 0 Příprava | repozitář, nástroje, CI, `tools/map-extract`, data-build se schématy, technický spike (instancovaný dav s animacemi, fallback na WebGL2) | data projdou validací, spike běží v kontejneru i na notebooku, CI je zelené |
| 1 Vertikální řez | aréna, 1 hrdina, 1 typ nepřítele, 1 automatické kouzlo, XP a level-up, hrad s HP | běh trvá 3 minuty, je deterministický a testy procházejí |
| 2 MVP | rozsah podle 3.8 | 15–20minutový běh jde dohrát a hrad v něm má váhu |
| 3 První veřejná verze | AI spojenec, talenty, úspěchy, další hrdinové, credits, právní kontrola | veřejné nasazení |
| 4 Rozšíření | eventy (arény, Item Event, Death Road), další hrdinové, co-op | podle priorit po vydání |

## 9. Rizika

| Riziko | Opatření |
|---|---|
| Poměr obléhačů a lovců nebude zábavný | ověřit ve vertikálním řezu a MVP; poměr je v datech fází |
| Hrdinové budou při automatice splývat | podpisová mechanika na hrdinu, vlastní pool vylepšení, ruční ultimátka |
| Škálování z mapy roste o řády | přepočet čísel, stropy a škálování poškození místo počtu entit |
| 40 skriptových kouzel | převádět po dávkách až s hotovým systémem druhů kouzel |
| CC0 assety nepokryjí 44 hrdinů | MVP jen se 4 hrdiny; art direction jako samostatná linka |
| Výkon na integrované grafice | strop 150, instancing, zapečené animace, benchmark na notebooku od fáze 0 |
| Práva | clean room, nová jména a texty, žádné assety Blizzardu, název bez „Warcraft“ a „Hero Siege“, žádná monetizace |

## 10. Mimo rozsah

Online co-op, mobilní ovládání, server, monetizace, assety Blizzardu i model „bring your own data“, Reforged HD styl a převod všech 44 hrdinů před vydáním.
