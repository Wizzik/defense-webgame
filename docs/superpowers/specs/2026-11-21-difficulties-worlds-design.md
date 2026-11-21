# Obtížnosti a světy: návrh

- **Stav:** návrh ke schválení (21. 11. 2026).
- **Petr rozhodl:** prostředí jinak vypadá i jinak hraje (překážky, cesty, přírodní situace), poslední svět je nejtemnější, inspirace příběhem Warcraftu; vztah obtížnosti a prostředí je **žebříček světů plus volič obtížnosti** (B); překážky jsou **ostrůvky plus jeden prvek s průchodem na svět**; mapa vzniká jako **pevná kostra plus rozmístění ze seedu** (C). Vše ostatní jsou Claudova rozhodnutí (označená *návrh*), Petr může kterékoli změnit.
- **Vychází z:** původního specu (`2026-11-04-defense-webgame-design.md`, 3.1 Obtížnost: Normal / Insane / Hell), Petrova přání z 2026-11-12 („obtížnosti jako kombinace jiného prostředí a zvolené obtížnosti, mají pohltit sílu výbavy“), inventury multiplayeru (`docs/multiplayer/single-hero-inventory.md`, kapitola 5: jedna tabulka násobků, kterou co-op vynásobí počtem hráčů).
- **Staví na:** `main` po PR #27 (`c86fb8b`).

## 1. Záměr a proč

Dnes je jedna mapa a jedna obtížnost. Hrdina s dobrou výbavou vyhraje skoro vždy a pak už hra nemá kam růst. Petr chce, aby síla z výbavy měla kam jít: **těžší světy, do kterých se hráč probojuje**, a každý svět byl jiný zážitek, ne jen větší čísla. Řada světů jde od světlých plání k nejtemnější, spálené zemi, volně podle příběhu Warcraftu (Lordaeron, Durotar, Ashenvale, Northrend, Plaguelands a příchod démonů), pod vlastními jmény.

Úspěch: hráč se po výhře těší na další svět; každý svět pozná na první pohled a hraje se v něm trochu jinak (kudy chodit, kde se schovat, čemu uhnout); dnešní hra zůstane jako svět 1 na Normal; s výbavou má smysl jít výš.

## 2. Cíle, mimo rozsah, nechceme

**Cíle**
- Pět světů v pevném pořadí, každý o stupeň těžší, každý s vlastním vzhledem, překážkami, cestami, jedním prvkem s úzkým průchodem a jednou přírodní situací.
- Volič obtížnosti Normal / Insane / Hell nezávisle na světě.
- Odemykání výhrou, uložené v prohlížeči.
- Všechny páky síly nepřátel v jedné tabulce násobků (`rules.yaml`), kterou co-op vynásobí za hráče.
- Simulace zůstane deterministická a bez alokací v kroku; mapa vzniká ze seedu, takže v co-opu nic dalšího po síti nejde.

**Mimo rozsah**
- Elity s modifikátory (původní spec pro Hell), prokletí a posuvníky jako v Azeroth Survivors.
- Nové frakce nebo bossové podle světa: frakce zůstávají podle fází, bossové stejní.
- Progrese mezi běhy kromě odemykání světů (fáze 5).
- Co-op násobek za hráče (jen připravená tabulka; hodnoty přijdou s migrací).
- Překážky, které blokují střely a kouzla (*návrh:* střely i kouzla létají přes překážky; čitelnější a levnější).
- Bořitelné překážky, výška terénu, kamera mimo dnešní pohled.

**Nechceme**
- Svět, kde hráč neví, kudy jít, nebo uvízne: z každého volného místa musí vést cesta k hradu i k okraji.
- Neférovou smrt: každý dopad přírodní situace má varování (kruh nebo ohlášení jako slam bosse).
- Tmu, ve které nejsou vidět nepřátelé, hrdina, truhly a koule; temné světy jsou temné v barvách a světle, ne v čitelnosti.
- Oranžovou (Petr ji nemá rád): oheň v posledním světě je zelený a fialový.
- Pokles fps: na Petrově stroji 144 fps dnes; cíl nejvýš −10 % s plným davem.

## 3. Přístupy, které padly ve hře

1. **Vztah světa a obtížnosti:** A nezávislé (libovolný svět × libovolná obtížnost, světy stejně těžké), B žebříček + volič, C obtížnost = svět. **Petr zvolil B**: nejlépe pohltí sílu výbavy, dává smysl „nejtemnější na konci“ a zapadá do progrese.
2. **Překážky:** A ostrůvky, které nepřátelé obcházejí, B terén s průchody (útesy, řeky s mosty) a hledáním cesty po celé mapě. **Petr zvolil A + jeden prvek B na svět**; víc průchodů až po hraní.
3. **Stavba mapy:** A ručně navržené pevné mapy, B celé generované ze seedu, C pevná kostra + rozmístění ze seedu. **Petr zvolil C**: svět má poznatelnou tvář, každý běh je trochu jiný, průchody se dají navrhnout férově.

## 4. Návrh

### 4.1 Světy (*návrh*, jména EN / CS)

| # | Svět | Inspirace | Vzhled | Prvek s průchodem | Přírodní situace |
|---|---|---|---|---|---|
| 1 | Silver March / Stříbrná marka | Lordaeron | zelené pláně, soumrak jako dnes, statky, ploty, kamenné zídky | stará hradba se dvěma branami na severu | letní bouře: občas blesk |
| 2 | Red Waste / Rudá pustina | Durotar, Barrens | rudá hlína, suché trávy, skály, kosti | řeka napříč mapou se dvěma mosty | písečná bouře |
| 3 | Shadewood / Stínový hvozd | Ashenvale | noc, měsíční modrá, husté stromy, mech | kruh pradávných stromů kolem hradu se čtyřmi průchody | trnité houští |
| 4 | Frostreach / Mrazivý sever | Northrend | sníh, led, modrošedé světlo, ledové krystaly | ledový hřbet s průsmykem | vánice |
| 5 | Blightscar / Spálená říše | Plaguelands, démoni | spálená černá země, nemocná zeleň, fialová obloha, zelený oheň | rozpadlá zeď s trhlinami | ohnivé meteory (zelené) |

Hrad, kruh příchodu nepřátel, velikost arény (6000 × 6000) a 20 fází s frakcemi zůstávají ve všech světech stejné.

### 4.2 Obtížnost a síla nepřátel (*návrh*)

Jedna tabulka v `rules.yaml` (`difficulty`), která násobí dnešní hodnoty:

- **Svět:** HP a poškození nepřátel × (1 + 0,25 · (svět − 1)), tedy 1,0 / 1,25 / 1,5 / 1,75 / 2,0.
- **Obtížnost:**

| | HP | Poškození | Velikost smeček | Elitní nápory |
|---|---|---|---|---|
| Normal | ×1,0 | ×1,0 | ×1,0 | jako dnes (5) |
| Insane | ×1,75 | ×1,75 | ×1,2 | navíc v 1:30, 4:30, 7:30, 10:30, 13:30 |
| Hell | ×3,0 | ×3,0 | ×1,4 | jako Insane, elity a bossové ×1,5 HP navíc |

- Násobky se násobí (svět × obtížnost × časová složka `timeScaling` × budoucí co-op). Hrad a hrdina se nemění.
- Velikost smeček naráží na strop 150 živých nepřátel; ten zůstává.
- Tabulka má tvar, který co-op rozšíří: `difficulty.levels.<id>.{hp, damage, packSize, eliteHp, extraRushes}`, `difficulty.worldStep.{hp, damage}`, později `coop.perPlayer.{hp, damage, packSize, eliteHp}`.

**Odměna za těžší běh (*návrh*):** zlato z nepřátel × (1 + 0,1 · (svět − 1)) a Magic Find +0,1 za každý svět nad prvním a +0,25 / +0,5 za Insane / Hell. Bez toho by těžší svět jen trestal.

**Cíl vyvážení (autopilot, seedy 1–20):** svět 1 Normal bez výbavy do ±10 % dnešních výher; svět 5 Normal se střední výbavou zhruba polovina výher; Hell svět 5 s plnou výbavou pod polovinou. Čísla výše se ladí k tomuto cíli a výsledná tabulka jde do `docs/DECISIONS.md`.

### 4.3 Odemykání (*návrh*)

- Na začátku je otevřený svět 1 na Normal.
- Výhra světa N na obtížnosti X odemkne svět N+1 na X.
- Výhra světa 5 na Normal odemkne Insane (svět 1), výhra světa 5 na Insane odemkne Hell (svět 1).
- Odemčení platí pro všechny hrdiny společně (jako sbírka výbavy).
- U každé kombinace se ukládá nejlepší výsledek (výhra, nebo nejdál dosažená fáze).
- Uloží se v prohlížeči (IndexedDB) jako výbava; čistá logika v `meta/` (bez úložiště), klient ukládá. S `?debug=1` je odemčeno vše a nic se neukládá.
- Simulace o odemykání neví; dostane jen `world` a `difficulty` v `RunOptions`.

### 4.4 Menu (*návrh*)

Po výběru hrdiny přijde obrazovka volby světa:

```
 Obtížnost:  [ Normal ]  [ Insane 🔒 ]  [ Hell 🔒 ]

 ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
 │ Stříbrná  │ │  Rudá     │ │  Stínový  │ │ Mrazivý   │ │ Spálená   │
 │  marka    │ │  pustina  │ │  hvozd    │ │  sever    │ │  říše     │
 │ ★ výhra   │ │ fáze 14   │ │    🔒     │ │    🔒     │ │    🔒     │
 └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘
  Pod vybraným: jedna věta o světě, jeho přírodní situace, síla nepřátel (×1,25) a odměna.
                                                        [ Start ]
```

Karty jsou v barvách svého světa (tmavé, modrošedé, bez oranžové). URL parametry `world` (1–5) a `difficulty` (`normal` | `insane` | `hell`) vyberou kombinaci; zamčenou kombinaci povolí jen s `debug=1`.

### 4.5 Mapa světa: kostra + rozmístění ze seedu

**Kostra** (ručně, `design/worlds.yaml`, na svět):
- **Cesty:** lomené čáry od hradu ven (typicky 3–4), šířka ~160. Na cestě se hrdina i nepřátelé pohybují o 15 % rychleji (*návrh*).
- **Prvek s průchodem:** souvislá překážka (zeď, řeka, kruh stromů, hřbet) z úseček s tloušťkou, s 2–4 průchody o šířce 200–300.
- **Zakázané zóny:** kolem hradu (poloměr ~600), kruh příchodu nepřátel (2400 ± 200), cesty, průchody a jejich okolí.
- **Zóny rozmístění:** kde a jak hustě mohou stát ostrůvky.
- **Terénní zóny** pro situace, které jsou na mapě pevně (trnité houští ve světě 3).

**Rozmístění ze seedu:** z vlastního `Rng` odvozeného ze seedu běhu (jako `chestRng`) se do zón rozhodí ostrůvky: kruhy o poloměru 40–220 (balvany, ruiny, skupiny stromů), s minimálními rozestupy, aby mezi nimi zbyl průchod ≥ 120. Po rozmístění **kontrola průchodnosti** na mřížce: každá volná buňka musí mít cestu k hradu; ostrůvek, který ji ruší, se vyhodí. Počet ostrůvků na svět ~25–45 (*návrh*).

Truhly, koule, srdce, krystaly a místa příchodu smeček se kladou jen na volná místa (dnešní hledání místa dostane kontrolu „není v překážce“).

### 4.6 Pohyb a navigace

- **Kolize:** hrdina i nepřátelé se nesmí dostat do překážky; kruhy a úsečky s tloušťkou se testují proti poloměru jednotky a pozice se vytlačí ven. Statická mřížka překážek (buňky ~100) zrychlí dotazy.
- **Nepřátelé, ostrůvky:** k dnešnímu řízení (`sim/enemy-steer.ts`) přibude vyhnutí: když je překážka v cestě v dosahu ~1,5 poloměru, směr se stočí podél jejího okraje.
- **Nepřátelé, průchody:** mapa směrů (flow field) na mřížce 60 × 60 (buňka 100) ke dvěma cílům: k hradu (spočítá se jednou na začátku) a k hrdinovi (přepočet každých 8 kroků, BFS přes ~3600 buněk). Nepřítel ji použije, když přímá čára k cíli protne pevnou překážku (prvek s průchodem); jinak jde rovně jako dnes, aby se nezměnilo chování na otevřené ploše.
- **Bossové a nárazy:** skoky bossů a výpady elit se nezastaví o překážku uprostřed letu, ale přistanou na nejbližším volném místě. Úskok hrdiny (mezerník) se o překážku zastaví.
- **Autopilot:** používá stejnou mapu směrů ke hrdinovi, aby neuvízl u zdi při cestě k truhle či kouli.
- Bez alokací v kroku: mřížky a fronty BFS mají pevnou velikost od začátku běhu.

### 4.7 Přírodní situace (*návrh*, čísla se ladí)

Všechny jsou v simulaci, deterministické a čitelné; ohlásí je zpráva v HUD a ikona v liště efektů se sekundami, jako dnešní kořeny.

1. **Letní bouře (svět 1):** od fáze 3 každých ~40 s dopadne 1–3 blesky u hrdiny po 1,2 s varovném kruhu (poloměr 120), poškození ~8 % max HP hrdiny, zraní i nepřátele. Mírné, aby svět 1 zůstal dnešní hrou.
2. **Písečná bouře (svět 2):** každé ~2 min na 15 s: pohyb všech −20 %, dohled kamery zkrácený mlhou; ohlášení 5 s předem.
3. **Trnité houští (svět 3):** pevné zóny na mapě (kostra), v nich pohyb −35 % pro hrdinu i nepřátele; nepřátelé je mapou směrů neobcházejí, takže se v nich dají chytit.
4. **Vánice (svět 4):** každé ~90 s na 15 s: pohyb −25 %, mlha; kdo stojí déle než 3 s, dostane **promrznutí** (útoky −20 %, dokud se nerozejde). Ohlášení 5 s předem.
5. **Ohnivé meteory (svět 5):** od fáze 1 každých ~20 s dopadne 3–6 meteorů kolem hrdiny po 1,5 s varovném kruhu (poloměr 150), poškození ~12 % max HP; v místě dopadu zůstane na 6 s louže zeleného ohně (poškození za sekundu, pálí i nepřátele).

### 4.8 Vzhled (klient)

- Na svět: barvy a textura země, cesty v zemi, světlo a mlha, barva oblohy, modely ostrůvků a prvku s průchodem, částice situace (déšť a blesky, písek, padající listí a světlušky, sníh, popel a zelené jiskry).
- Řada temní od světa 1 k 5 (méně a chladnější světlo, hustší mlha), ale nepřátelé, hrdina, truhly a koule mají dál čitelné odstíny a obrysy.
- Modely z dalších CC0 balíků (KayKit, Quaternius), přes `tools/assets-build/`, s řádkem v `assets/LICENSES.md`.
- **Rozpočet:** dnes 9,8 MB z 10 MB pro všechny modely. *Návrh:* modely prostředí se načítají jen pro zvolený svět; test rozpočtu se změní na „společné modely + jeden svět ≤ 10 MB“ a každý svět ≤ 1,5 MB.

### 4.9 Data, ladění, testy

- `design/worlds.yaml` (kostra, zóny, situace, vzhled, jména EN/CS) → `data/generated/worlds.json` (bez kódů mapy).
- `RunOptions.world` (1–5, výchozí 1) a `RunOptions.difficulty` (výchozí `normal`); oba do hashe stavu. Matice determinismu dostane případy pro světy 2–5 a Hell; její digest se změní a nový se zapíše.
- `sim:run` dostane `--world 1-5|all` a `--difficulty normal|insane|hell|all`.
- `?debug=1`: `__game.world`, `__game.difficulty`, `__game.obstacles` (počet), `__game.hazard` (běžící situace a sekundy), `__game.debug.hazard()` spustí situaci hned.
- `npm run shots` dostane snímek každého světa (`world-1`…`world-5`).
- Testy: průchodnost každého světa na 200 seedech, nikdo nestojí v překážce, mapa směrů vede z každé volné buňky k cíli, determinismus, odemykací logika.

### 4.10 Rozdělení do plánů (každý v samostatném chatu)

1. **Obtížnost, žebříček, menu, odemykání:** tabulka násobků, `RunOptions`, obrazovka volby, uložení, odměny, svět 1 jako dnešní mapa v novém systému `worlds.yaml` (zatím bez překážek), `sim:run` přepínače, ladění násobků.
2. **Překážky, cesty, průchody:** kostra a rozmístění, kolize, vyhýbání, mapa směrů, autopilot, kontrola průchodnosti; svět 1 dostane hradbu a ostrůvky a letní bouři; přeladění světa 1 k cíli ±10 %.
3. **Světy 2–5:** vzhled, modely, načítání po světě, čtyři přírodní situace, ladění světů ke cíli z 4.2, snímky.

Po každém plánu Petr hraje a může plán dalšího změnit.

## 5. Co nechávám na stavitelovi

- Přesná čísla situací, odměn a násobků (k cílům v 4.2, tabulky do DECISIONS).
- Tvar kostry každého světa (počet a průběh cest, tvar prvku s průchodem) v mezích 4.5.
- Výběr konkrétních modelů z CC0 balíků a paleta každého světa.
- Algoritmus vyhýbání a kdy přesně nepřítel přepne na mapu směrů, pokud splní 4.6 a výkon.
- Struktura souborů v `sim/` (jedna role na soubor), umístění kontroly průchodnosti (sim při startu běhu, nebo build dat s pevnými seedy ověřenými testem).
