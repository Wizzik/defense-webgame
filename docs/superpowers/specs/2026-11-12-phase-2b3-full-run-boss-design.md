# Fáze 2b-3: celý běh s bossem (návrh)

Datum: 2026-11-12. Schválil Petr v chatu 2026-11-12 (rozsah, složitost bossů, celý návrh). Navazuje na spec `2026-11-04-defense-webgame-design.md`, oddíly 3.1 a 3.2.

## 1. Cíl a rozsah

**Cíl:** běh trvá 16:40 ve 20 fázích a končí soubojem s finálním bossem. Hráč vyhraje, až když finální boss padne.

**Hotovo, když:**
- běh jde dohrát od výběru hrdiny po pád finálního bosse na https://wizzik.github.io/defense-webgame/;
- přijde 5 elitních náporů, 3 minibossové a finální boss v časech podle oddílu 3;
- autopilot plní cíle z oddílu 8 a `npm run check` i e2e procházejí.

**V rozsahu:** 20 fází, HUD fáze, elitní nápory, 3 minibossové, finální boss s enrage, nová mechanika úder, nová podmínka výhry, přeladění XP, `?phase=N`, rozšíření `sim:run`, balanc na 20 seedech.

**Mimo rozsah (další plány):** frakce (orkové, nemrtví, elfové), výběr obtížnosti, minimapa, ekonomika a truhly (2c), nové modely, redesign Gravecallera.

## 2. Časová osa

- `run.phaseSeconds` zůstává 50, fází je 20, `run.durationSeconds` se mění na 1000 (16:40) a znamená čas příchodu finálního bosse, ne konec běhu.
- Tabulka `phases` v `design/rules.yaml` má 20 ručně psaných řádků ve stejném tvaru jako dnes (`mix`, `pack`, `packs`, `hunterShare`, `elites`). Vzorec místo tabulky jsme zamítli: ladění hraním potřebuje kontrolu nad jednotlivými fázemi.
- Fáze 1–5 představují typy postupně jako dnešních 6 fází. Fáze 6–20 zvětšují smečky a jejich počet až ke stropu `enemies.maxAlive` 150.
- Pozdní fáze škálují HP a poškození přes `run.timeScaling` (`1 + t/1200`, strop 2; v 16:40 je to ×1,83), ne počet entit.
- HUD ukazuje „Fáze 7/20“ (EN „Phase 7/20“) vedle času. Po 16:40 ukazuje „Finále“ („Finale“).

## 3. Události podle času

Nový seznam `events` v `design/rules.yaml`, každá položka má `atSeconds` a druh:

| Čas | Druh | Obsah (výchozí čísla, ladí se) |
|---|---|---|
| 3:00 | elitní nápor | 3 kapitáni + 4 kopiníci |
| 4:10 | miniboss | Železný maršál |
| 6:00 | elitní nápor | 4 kapitáni + 6 kopiníků |
| 8:20 | miniboss | Bledý opat |
| 9:00 | elitní nápor | 5 kapitánů + 8 kopiníků |
| 12:00 | elitní nápor | 6 kapitánů + 10 kopiníků |
| 12:30 | miniboss | Mistr střelby |
| 15:00 | elitní nápor | 8 kapitánů + 12 kopiníků |
| 16:40 | finální boss | Hrůzný regent |

**Elitní nápor:**
- 7 s před příchodem vznikne událost varování: text v HUD („Blíží se elitní nápor“ / „An elite rush is coming“) a šipka směru na okraji obrazovky. Mapa varuje také 7 s předem.
- Přijde jako jedna smečka z jednoho náhodného směru na spawnovacím kruhu, role obléhači (jde na hrad).
- Nápor obchází strop 150 jen potud, že má přednost: když není místo, zabere volné sloty jako každá smečka a zbytek propadne.
- Dnešní `elites` u první smečky fáze zůstávají.

## 4. Bossové

**Společná pravidla:**
- Boss je typ nepřítele v `design/enemies.yaml` s příznakem `boss`. Je to varianta existujícího mapového zdroje a modelu (násobiče jako u zvěda a kapitána), žádný nový model.
- Vzhled: měřítko 2,5 (minibossové) a 3 (finální), vlastní barva, žádná oranžová.
- HP bar se jménem nahoře na obrazovce, dokud boss žije. Žije-li víc bossů, ukazuje se ten, který přišel poslední.
- Nejde odhodit (knockback 0). Omráčení na něj trvá čtvrtinu času.
- Přichází sám z náhodného směru na spawnovacím kruhu, se šipkou a zvukem. Místo má vždy: když je plno, nahradí nejstaršího běžného nepřítele.
- HP a poškození bosse násobí časová složka jako u ostatních.
- Smrt minibosse dá XP v hodnotě zhruba jedné úrovně v daném čase (výchozí 150, 300, 450).

**Nová mechanika úder (`slam`):**
- Boss se zastaví a na zemi je `windupSeconds` (výchozí 1,0 s) červený kruh o poloměru `radius`.
- Po uplynutí dostane zásah `damage` hrdina, pokud v kruhu stojí, a hrad, pokud do kruhu zasahuje. Spojenecké wardy a kopie zásah nedostanou.
- Spouští se, když je hrdina nebo hrad v dosahu `radius × 0,8`. Cooldown je náhodný v rozsahu `cooldownSeconds: [7, 15]` ze seedovaného `Rng` (mapa: Thunder Clap finálních golemů, 7–15 s).
- Omráčení úder přeruší (cooldown běží od začátku).

**Jednotliví bossové (výchozí čísla před časovou složkou, ladí se):**

| Id | Jméno EN / CS | Zdroj a chování | HP | Úder (poloměr / poškození) | Cíl |
|---|---|---|---|---|---|
| `iron-marshal` | Iron Marshal / Železný maršál | kopiník, `charge` + úder | 12 000 | 350 / 120 | hrad |
| `pale-abbot` | Pale Abbot / Bledý opat | kaplan, léčí okolí (`heal` ×5 v dosahu 600) + úder; jde na cíl jako `siege` | 20 000 | 400 / 180 | hrad |
| `gunmaster` | Gunmaster / Mistr střelby | mušketýr, `skirmish` s dosahem 700 + úder | 30 000 | 400 / 240 | hrad |
| `dread-regent` | Dread Regent / Hrůzný regent | kapitán, `charge` + `aura` + úder | 60 000 | 500 / 350 | hrdina |

- Minibossové mají roli obléhač: na hrdinu reagují podle dnešních pravidel (když na ně zaútočí nebo přijde blízko).
- Finální boss má roli lovec.

**Finále:**
- Od 16:40 platí tabulka fáze 20 s velikostí smeček × 0,5 (`run.finale.packScale`).
- Ve 20:00 (`run.finale.enrageAtSeconds` 1200) finální boss zesílí: poškození ×2, rychlost ×1,3, cooldown úderu ×0,5. HUD to oznámí.
- Výhra: finální boss padne. Živí minibossové ani ostatní nepřátelé výhře nebrání.
- Prohra: jako dnes (padne hrad nebo hrdina).

## 5. Postup hrdiny

- `progression.xpFirst` a `xpStep` se přeladí tak, aby měl autopilot plný kit (4 kouzla × 5 úrovní) kolem fáze 12–14. Očekávaná konečná úroveň je 35–45.
- Po naplnění kitu nabízejí karty jen atributy. To je dočasný stav do 2c (itemy, obchod, truhly); nic dalšího se sem nepřidává.

## 6. Klient

- HUD: ukazatel fáze, varování před náporem, oznámení bosse a enrage, HP bar bosse. Texty v EN a CS přes `client/ui/messages-*.ts`.
- Kruh úderu: plochý kruh na zemi, který se během `windupSeconds` plní; po zásahu krátký záblesk a otřes kamery.
- Boss: instance existujícího modelu ve větším měřítku s vlastní barvou; blob stín podle měřítka.
- Výsledková obrazovka: při výhře čas pádu finálního bosse.
- `window.__game` nově vystaví `phase`, `boss` (`id`, `hp`, `maxHp` nebo `null`) a `slams` (počet aktivních kruhů) pro e2e.

## 7. Ladicí nástroje

- `?phase=N` (jen s `debug=1`, N 1–21; 21 je finále): běh začne na začátku fáze N. Hrdina dostane XP, které autopilot v tom čase průměrně má (tabulka `debugPhaseXp` generovaná z měření), a level-upy se rozdají kartami podle pravidla autopilota (první karta kouzla před atributem). Události s časem před začátkem fáze se přeskočí.
- `?duration` zůstává pro testy: přepíše čas příchodu finálního bosse (5–1200 s) a fáze se zkrátí poměrně.
- `npm run sim:run` nově vypíše čas zabití každého bosse, čas a důvod konce běhu a přijímá `--seeds A-B`.

## 8. Cíle balancu

Měří se autopilotem na seedech 1–20 pro každého hrdinu (dosud 1–5; řeší otevřený bod 2 ze STATUS):

- autopilot vyhraje 6–12 běhů z 20 (30–60 %);
- nečinný běh (`--idle`) prohraje do 4:00;
- prohry nejsou nahromaděné: nejvýš polovina proher v jednom dvouminutovém okně;
- miniboss padne do 45 s od příchodu (medián);
- finální boss padne za 40–90 s (medián vyhraných běhů) a enrage nastane nejvýš v 1 běhu z 20;
- hrad vyhraných běhů končí v průměru pod 60 %.

Gravecaller je mimo pásma (známá otevřená díra, redesign je samostatný úkol). Výsledky a odchylky se zapíší do `docs/DECISIONS.md`.

## 9. Dopad na kód

- `data/schema` a `tools/data-build`: `rules.events`, `rules.run.finale`, `enemy.boss`, `enemy.slam`; testy v `data/generated.test.ts`.
- `sim/`: plánovač událostí (nový soubor, jedna role), úder (nový soubor vedle `enemy-charge.ts`), boss pravidla pro knockback a omráčení, podmínka výhry v `run.ts`, finále ve `spawner.ts`. Vše deterministické, bez alokací v běžném kroku, události do `EventLog`.
- `sim/bot.ts`: autopilot vyjde z kruhu úderu a v finále jde po bossovi.
- `client/`: HUD, kruh úderu, boss v `enemy-crowd`, zvuky.
- Testy: jednotkové pro plánovač, úder, výhru a finále; determinismus a replay přes celý běh; e2e s `?phase=` pro nápor, minibosse a výhru nad finálním bossem.

## 10. Rizika

| Riziko | Opatření |
|---|---|
| Druhá půlka běhu je chudá na volby (jen atributy) | vědomě dočasné do 2c; ověří Petrův playtest |
| 17minutový běh se špatně testuje ručně | `?phase=N`, `speed` až 16 |
| Balanc na 20 seedech × 8 hrdinů × 17 minut trvá déle | simulace odehraje 5 minut pod 0,5 s; celé měření vyjde na jednotky minut |
| Boss bez nového modelu vypadá jako velký běžný nepřítel | vlastní barva, HP bar, jméno; vlastní modely patří do vizuálního průchodu B |
