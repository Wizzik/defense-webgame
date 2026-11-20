# Multiplayer spike: determinismus, soupis jednoho hrdiny, první spojení: návrh

- **Stav:** návrh ke schválení (20. 11. 2026). Rozhodnutí o co-op pravidlech jsou Petrova (`claude/multiplayer-decisions.md` v projektu claude.ai, shrnutí v kapitole 3); technická rozhodnutí spiku jsou Claudova a Petr může kterékoli změnit.
- **Staví na:** `main` po PR #26 (`b67c076`), větev `multiplayer-spike`.
- **Hra se nemění:** spike nepřidá hráči nic ve hře. Přidá dvě ladicí stránky (`/determinism/`, `/net-spike/`), širší hash stavu, testy a dva dokumenty. `git diff main -- sim` smí ukázat jen `sim/hash.ts` a jeho test.

## 1. Záměr a proč

Petr chce co-op přes WebRTC (peer-to-peer). Navržená architektura je **deterministický lockstep**: prohlížeče si posílají jen vstupy a každý počítá stejnou simulaci. To funguje jen tehdy, když:

1. simulace dá v Chrome, Firefoxu (a ideálně Safari) **bitově stejný** stav ze stejného seedu a vstupů;
2. simulace umí víc hrdinů (dnes všechno počítá s jedním);
3. spojení přes PeerJS a jeho bezplatný signalizační server je dost rychlé a spolehlivé.

Spike ověří body 1 a 3 měřením a k bodu 2 sepíše, co přesně se bude muset přepsat a v jakém pořadí. Je malý (jednotky dní práce, žádná změna hry) a odpoví na otázku, jestli se další fáze (obtížnosti, progrese) mají psát jinak kvůli multiplayeru.

## 2. Cíle, mimo rozsah, nechceme

**Cíle**
- Automatický test v CI: stejná matice běhů dá stejné hashe v Node (V8), Chromiu, Firefoxu a WebKitu.
- Ruční test pro Petra: stránka `/determinism/` ukáže 8místný otisk; Chrome a Firefox na jeho počítači musí ukázat stejný.
- Hash stavu pokryje všechno, co ovlivní budoucí kroky (dnes chybí projektily, spojenci, předměty na zemi, truhly, zlato, nabídky), aby detekce desynchronizace v co-opu nic nepřehlédla.
- Dokument `docs/multiplayer/single-hero-inventory.md`: každé místo, kde simulace a klient počítají s jedním hrdinou, s navrženým tvarem pro N hrdinů, odhadem a pořadím migrace.
- Stránka `/net-spike/`: hostitel vytvoří místnost (kód), host se připojí, oba běží lockstep stejné hry jednoho hrdiny, vidí RTT, zastavení lockstepu a shodu hashů.
- Zpráva `docs/multiplayer/spike-report.md` s naměřenými čísly a doporučením architektury.

**Mimo rozsah**
- Víc hrdinů v simulaci (přijde jako první krok multiplayer fáze podle soupisu).
- Lobby, výběr hrdiny pro druhého hráče, škálování obtížnosti podle počtu hráčů, oživování, sdílené XP.
- Vlastní PeerServer a TURN server.
- 3D vykreslení na stránce `/net-spike/` (stačí 2D pohled shora na canvasu).

**Nechceme**
- Měnit balanc nebo chování simulace. Pokud matice najde rozdíl mezi prohlížeči, oprava (deterministická náhrada funkce) je součástí spiku, ale musí dát v Node stejný výsledek jako dnes, nebo jde do zprávy jako otevřený bod pro Petra.
- Posílat přes síť stav hry. Posílají se jen vstupy, hashe a ping.

## 3. Co Petr rozhodl (vstup pro soupis, ne pro tento spike)

- WebRTC peer-to-peer; PeerJS s bezplatnou cloudovou signalizací, později případně vlastní PeerServer a TURN.
- Sdílené XP: všichni hrdinové levelují spolu. Zlato má každý hráč své.
- Level-up hru nepozastaví. Hrdina vybírající kartu je nesmrtelný, neútočí, nesesílá a nepřátelé ho ignorují (jdou na ostatní hrdiny nebo hrad). Časový limit volby nerozhodnut (Claude navrhl ~10 s).
- Drop bosse: každý hráč dostane svůj vlastní hozený předmět.
- Truhla: předmět dostane jen kupující (platí svým zlatem); truhla zmizí všem. Truhel musí být na mapě dost pro víc hráčů.
- Obtížnost se násobí s každým hráčem. Padlého spoluhráče oživí stání na něm 5 s.
- Žádný AI spojenec.

## 4. Co už víme (předběžný průzkum kódu, 20. 11. 2026)

- **Determinismus je hlídaný od začátku:** `tests/repo-guard.test.ts` zakazuje v `sim/` `Math.random`, trigonometrii, `exp`, `log`, `pow`, `cbrt`, `hypot` a `**`. V `sim/` se používají jen `Math.abs, ceil, floor, imul, max, min, round, sign, sqrt` (všechny jsou podle IEEE 754 / ECMAScriptu přesně definované), žádné `.sort()`, `Map`, `for…in` ani `Float32Array`. Riziko rozdílu mezi enginy je proto **nízké**; spike ho má potvrdit měřením, ne předpokladem.
- **Hash stavu** (`sim/hash.ts`) pokrývá hrdinu, výbavu, buffy, orby, mrtvoly, bosse, schopnosti a nepřátele, ale ne projektily, spojence (wardy, kopie), krystaly, mince, srdce, truhly, zlato, cenu truhly, nabídky karet a truhly. Desync v nich by se projevil až později přes nepřátele.
- **Simulace je celá postavená na jednom hrdinovi:** `Run` drží jednoho `hero` a k němu patří i `abilities`, `gear`, `buffs`, `gold`, `offer`, `chestOffer`, `openChest`, `ultimateAuto`, `ultimateRequested`, `shieldTicks`, `heroIndex`. Výskyty v `sim/`, `client/`, `meta/` a `tools/` (bez testů): `run.hero` 514×, `run.abilities` 124×, `run.gear` 55×, `run.allies` 37×, `run.gold` 35×, `run.offer` 34×, `run.shieldTicks` 33×, `run.chestOffer` 30×. `run.hero` čte 37 souborů v `sim/`, 17 souborů v `client/`.
- **Stavový automat pauzuje celou hru:** `levelUp` a `chest` jsou stavy celého `Run` (simulace stojí, `step` jen vybírá kartu). Petrovo pravidlo „level-up nepauzuje“ znamená přesunout volbu z `Run.state` na hráče.
- **`TickInput`** je jeden na krok; `checkEnd` končí běh smrtí jediného hrdiny; nepřátelé (`enemy-ai.ts`, `enemy-steer.ts`, `enemy-strike.ts`, `enemy-charge.ts`, `enemy-slam.ts`, `enemy-cloud.ts`) míří na `run.hero`.

Závěr průzkumu: determinismus je pravděpodobně v pořádku, víc hrdinů je **velký průřezový refaktor** (odhad v soupisu). Proto soupis musí dát pořadí kroků, ve kterém hra po každém kroku dál funguje a testy procházejí.

## 5. Návrh

### 5.1 Širší hash stavu

`stateHash(run)` navíc smíchá (v tomto pořadí, na konec funkce): `run.gold`, `run.chestPriceRaw`, `run.chestsOpened`, `run.bossesKilled`, `run.openChest`, `run.chestRng.state`; každou živou položku `projectiles`, `allies`, `crystals`, `coins`, `hearts` (index, druh/hodnota, x, y a jejich časovače); každou truhlu `chests`; kartu nabídky (`offer`: id a úroveň každé karty) a truhly (`chestOffer`: slot, předmět, akce každé karty). Přesná pole určí plán podle tříd úložišť. Hash dál nealokuje.

### 5.2 Matice determinismu

Modul `client/determinism/matrix.ts` (čistý: jen `sim/`, `data/schema` a `tools/sim-run/gear-presets.ts`, žádný DOM) spustí pevnou sadu běhů s autopilotem (`botInput`) a vrátí výsledky:

| Případ | Hrdina | Seed | Start | Výbava | Strop kroků |
|---|---|---|---|---|---|
| `h-<id>` (8×) | každý hrdina | 1 | fáze 1, `durationSeconds` 300 | `none` | 12 000 |
| `p6` | nightglaive | 2 | fáze 6 | `full` | 6 000 |
| `p11` | gravecaller | 3 | fáze 11 | `full` | 6 000 |
| `p16` | tidecaller | 4 | fáze 16 | `full` | 6 000 |
| `p21` | sparkshot | 5 | fáze 21 (finále) | `full` | 6 000 |

Každých 300 kroků se zapíše `stateHash`; běh končí výhrou, prohrou nebo stropem. Výsledek případu: `{ id, ticks, state, checkpoints: number[] }`; otisk celé matice je FNV-1a přes všechny checkpointy (8 hex znaků). Celkem ~120 000 kroků; v Node pod minutu.

Proč tyto případy: osm hrdinů pokryje všechny druhy schopností a jejich kódy; startovní fáze pokryjí všechny čtyři frakce a jejich mechaniky, minibosse a finále; plná výbava pokryje legendární a mýtické efekty a magic find.

**Automaticky (CI):** Playwright spec `e2e/determinism.spec.ts` spočítá matici v Node (reference), otevře `/determinism/` v prohlížeči projektu, počká na výsledek (`window.__determinism`) a porovná případ po případu; při rozdílu vypíše první případ a první checkpoint, kde se liší. Nové projekty Playwrightu `sim-chromium`, `sim-firefox`, `sim-webkit` spouštějí jen tento spec; dnešní dva projekty ho ignorují. CI instaluje `chromium firefox webkit`.

**Ručně (Petr):** po nasazení na Pages otevře https://wizzik.github.io/defense-webgame/determinism/ v Chrome a ve Firefoxu (případně na telefonu) a porovná otisk. Stránka ukazuje průběh, čas výpočtu a otisk velkým písmem; tmavé pozadí.

Když se prohlížeče liší: stránka umí `?case=<id>&every=1` (hash v každém kroku) a spec vypíše první rozdílný krok; příčina se hledá v systému toho kroku. Oprava podle kapitoly 2 (Nechceme).

### 5.3 Soupis míst s jedním hrdinou

`docs/multiplayer/single-hero-inventory.md`, sestavený z `grep` a čtení kódu, ne odhadem. Struktura:

1. **Cílový tvar** (návrh): `Run.players: PlayerState[]` (1–4), kde `PlayerState` drží `hero`, `abilities`, `gear`, `buffs`, `gold`, `offer`, `chestOffer`, `choosing` (vybírá kartu nebo truhlu), `ultimateAuto`, `ultimateRequested`, `shieldTicks`, `downTicks`/`reviveTicks`; `Run.step(inputs: readonly TickInput[])`; sdílené XP v `Run`; `Run.state` jen `playing | won | lost`.
2. **Tabulka po kategoriích** (stav na `Run`; cílení nepřátel; schopnosti a jejich počátek a cíle; spojenci a projektily (vlastník); sběr předmětů (magnet, XP sdílené, zlato vlastní, srdce); level-up a truhla bez pauzy; konec běhu a oživení; drop bosse na hráče; hash; autopilot; klient: kamera, HUD, karty, truhly, zvuk, efekty, `window.__game` a ladicí háčky; nástroje `sim:run`, `sim:chests`; testy). Pro každou řádku: soubor a funkce, co předpokládá, navržená změna, odkaz na Petrovo pravidlo z kapitoly 3, velikost S/M/L.
3. **Pořadí migrace** v krocích, z nichž každý nechá hru jednoho hráče hratelnou a testy zelené (např. 1. `PlayerState` s jedním hráčem a fasáda `run.hero`; 2. vstupy jako pole; 3. cílení nepřátel na nejbližšího živého; 4. level-up bez pauzy; 5. vlastnictví projektilů a spojenců; …), s odhadem chatů na krok.
4. **Co se to týká v dalších fázích:** co mají obtížnosti a progrese rovnou navrhnout s ohledem na N hráčů (např. násobič obtížnosti podle počtu hráčů jako jeden knoflík v `rules.yaml`, meta progrese na hráče).

### 5.4 První spojení přes PeerJS

- Závislost `peerjs` 1.5.5 (MIT), přesná verze; řádek do `assets/LICENSES.md` není potřeba (není to asset), ale do zprávy a pozdějších credits ano.
- `client/net/protocol.ts`: zprávy jako JSON objekty s polem `t`, kódování a dekódování s validací (neznámá nebo vadná zpráva se zahodí a počítá):
  - `hello { v, seed, hero }` (host → guest; `v` = verze protokolu 1),
  - `in { k, mx, my, c, a }` (vstup hráče pro krok `k`),
  - `hash { k, h }` (hash po kroku `k`, každých 30 kroků),
  - `ping { n, at }`, `pong { n, at }` (RTT; `at` jsou ms odesílatele, do simulace nevstupují),
  - `bye {}`.
- `client/net/lockstep.ts` (čistý, bez PeerJS): dva hráči, zpoždění vstupu `INPUT_DELAY = 3` kroky (100 ms): vstup pořízený v kroku `k` platí pro krok `k + 3`. Krok `k` se provede, až jsou vstupy obou hráčů pro `k`; jinak lockstep stojí a počítá zastavené snímky. Hashe obou stran se porovnají pro každý krok, kde je mají obě; první rozdíl = desync (zastaví hru, ukáže krok).
- Ve spiku je v simulaci jen jeden hrdina: **vstupy hostitele řídí hrdinu**; vstupy hosta se vyměňují stejně (testují lockstep), ale do kroku nevstupují. Ve stavech `levelUp` a `chest` hostitel posílá volbu autopilota (`botInput`), takže obě strany zvolí totéž.
- `client/net/peer-link.ts`: tenký obal PeerJS (`hostRoom`, `joinRoom`, `send`, `onMessage`, `onClose`), kód místnosti `dwg-` + 6 znaků z abecedy bez zaměnitelných znaků; přijme jen jednoho hosta; spojení `reliable: true` (pořadí zpráv zaručeno).
- Stránka `/net-spike/`: tmavá; tlačítka *Hostovat* a *Připojit* (pole pro kód), odkaz pro hosta (`/net-spike/?join=<kód>`), 2D canvas pohledu shora (hrad, hrdina, nepřátelé jako body), panel: stav spojení, RTT medián a p95, zastavení lockstepu za minutu, krok, poslední shodný hash, případný desync. WASD ovládá hrdinu u hostitele.
- Testy: lockstep a protokol ve Vitestu přes paměťový transport s náhodným zpožděním (dvě instance, 3000 kroků, stejné hashe, žádný desync); PeerJS sám jen ručně (cloudová signalizace v CI nemá být podmínkou).
- **Ruční měření (Petr):** (a) Chrome a Firefox na jednom počítači; (b) dva počítače v různých sítích (např. Petr doma a druhý přes hotspot telefonu). Každé 10 minut hry; zapsat RTT, zastavení a desynchronizace. Cíl: 0 desynchronizací, zastavení pod 1 % snímků při RTT do 100 ms.

### 5.5 Zpráva

`docs/multiplayer/spike-report.md`: výsledek matice (CI i Petrův ruční test), velikost hashe a doba výpočtu, výsledky obou měření spojení, problémy (např. NAT), odhad multiplayer fáze ze soupisu a doporučení: lockstep ano/ne, zpoždění vstupu, potřeba TURN, co změnit v plánu dalších fází.

## 6. Rizika

| Riziko | Dopad | Co s tím |
|---|---|---|
| Firefox nebo WebKit dá jiný hash | lockstep nepoužitelný bez opravy | spike najde krok a systém; oprava deterministickou náhradou |
| Matice v CI trvá dlouho (WebKit) | pomalé CI | strop kroků lze snížit; projekty `sim-*` mají vlastní timeout |
| PeerJS cloud nedostupný nebo přetížený | ruční test neproběhne | zpráva to zapíše; vlastní PeerServer je známá cesta |
| Symetrický NAT (spojení přes různé sítě selže) | co-op mimo LAN nefunguje | zapsat; TURN server je další krok |
| Lockstep se zasekává při výkyvech sítě | hra trhá | změřit; zvýšit `INPUT_DELAY`, nebo později rollback |
| WebRTC ukáže IP adresu spoluhráči | soukromí | vlastnost WebRTC P2P; zmínit v pozdějších credits / FAQ |

## 7. Výstup spiku a rozhodnutí po něm

Po spiku Petr rozhodne: (1) pořadí dalších fází (obtížnosti a progrese před multiplayerem, nebo naopak); (2) jestli lockstep, nebo jiná architektura; (3) časový limit volby karty v co-opu. Zpráva mu k tomu dá čísla.

## 8. Testy a brána

- `npm run check` (typecheck, Vitest, Python) a `npm run build` projdou.
- E2E `webgl2-fallback` projde lokálně; projekty `sim-chromium` (lokálně i v CI), `sim-firefox` a `sim-webkit` (v CI; kontejner nemá Firefox ani WebKit).
- `git diff main -- sim` obsahuje jen `sim/hash.ts` a `sim/hash.test.ts`.
