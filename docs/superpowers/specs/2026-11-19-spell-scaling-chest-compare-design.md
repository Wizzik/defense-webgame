# Krocení škálování kouzel, multishot na všechny šípy a porovnání předmětu z truhly: návrh

- **Stav:** návrh ke schválení (19. 11. 2026). Petr zvolil cestu A (zploštit křivky, nepřátele nechat) a počet šípů multishotu; co je v části 4 označeno jako Claudovo, může změnit.
- **Vychází z:** Petrova playtestu PR #15 (truhly, Magic Find, tvrdší nepřátelé) a PR #16 (sdílená kouzla a pasivky), 18.–19. 11. 2026.
- **Staví na:** `main` po PR #17 (`325af0f`), větev `spell-scaling`.

## 1. Záměr a proč

Petr v playtestu (19. 11. 2026) hlásí tři věci:

1. **Škálování všech kouzel je moc silné**, minimálně u Hadího šamana, ale podle něj globálně. Hra má být výzva i ve druhé půlce běhu.
2. **Multishot Sparkshota** dává bonusové poškození Žhavých nábojů jen jednomu šípu. Má ho dostat každý šíp.
3. **Výměna předmětu z truhly je nečitelná.** Karta jen napíše „nahradí X“ a vyšší rarita nasazený předmět vymění sama. Petr chce staty obou předmětů vedle sebe a sám rozhodnout: nechat stávající, nebo vzít nový.

Příčina bodu 1 je v datech. Kouzla mají křivky převzaté z mapy, kde se poškození mezi úrovní 1 a 5 zdesetinásobí až zpadesátinásobí (Rozeklaný blesk 90 → 1500, Léčivý příliv 150 → 3000, Omračující příliv 30 → 1500). Ve WC3 tomu odpovídá prudký růst vln. Tady nepřátelé za celý běh zesílí jen ×1,83 (`run.timeScaling`). Navíc se kouzla násobí silou kouzel z Inteligence (+1 % za bod, u šamana na úrovni 50 zhruba ×2,8) a výbavou a Arcane Focus. Rozeklaný blesk na úrovni 5 tak dá kolem 4000 na zásah, zatímco běžný nepřítel má pozdě v běhu 135 až 1175 hp. Léčení ve stejném řádu dělá šamana prakticky nesmrtelným.

## 2. Cíle, mimo rozsah, nechceme

**Cíle**
- Kouzla na úrovni 1 zůstanou, jak jsou. Začátek běhu se nemění.
- Růst kouzla od úrovně 1 k maximu se zkrotí jedním pravidlem pro všechna kouzla (podpisová, ultimátky i sdílená): typicky na 3–5× místo 10–50×.
- Inteligence přidává méně síly kouzel.
- Druhá půlka běhu bez výbavy je výzva: maximální podpisové kouzlo bez výbavy už nezabíjí nejtužšího běžného nepřítele (Kopiník) jednou ranou několikanásobně.
- Pásmo výher autopilota bez výbavy 6–12 z 20 pro všechny hrdiny (stejné jako u sdílených kouzel). Gravecaller už nevyhrává 20 z 20. Se střední výbavou vyhrává většina, s plnou výbavou všichni.
- Multishot: každý šíp dává bonus Žhavých nábojů.
- Truhla: u obsazeného slotu vidí hráč nasazený a nabízený předmět vedle sebe a vybere jeden z nich.

**Mimo rozsah**
- Škálování základního útoku z hlavního atributu (také roste prudce, ale Petr hlásil kouzla). Změří se a zapíše jako otevřený bod.
- Úpravy kitů jednotlivých hrdinů (nová mechanika, jiná kouzla). Ladí se jen globální knoflíky v části 4.3.
- Růst nepřátel během běhu, bossové, hrad (Petr zvolil cestu A).
- Jiné parametry kouzel než poškození a léčení: počty (totemy, šípy, skoky), dosah, trvání, cooldowny.

**Nechceme**
- Aby se změnil začátek běhu (úroveň 1 kouzel, první minuty).
- Aby hráč musel volit, i když jde o stejný předmět (to zůstává karta Úroveň).
- Aby volba „nechat stávající“ znamenala promarněnou truhlu.
- Oranžovou v UI, texty z mapy.

## 3. Co rozhodl Petr

- 19. 11. 2026: škálování kouzel je moc silné, globálně; zvolil cestu **A**: zploštit křivky kouzel a změkčit sílu kouzel z Inteligence, nepřátele nechat.
- 19. 11. 2026: multishot má dávat bonus každému šípu. Počet vedlejších šípů podle úrovně **1, 1, 2, 2, 3** (tedy dnešní; Claudovo čtení jeho „11 22 3“, celkem s hlavním šípem 2, 2, 3, 3, 4).
- 19. 11. 2026: u výměny předmětu staty obou vedle sebe, hráč dá jeden nebo druhý (nechá stávající, nebo nahradí novým).

## 4. Návrh

### 4.1 Křivka kouzel (Claudovo)

Pravidlo v `design/scaling.yaml`: `abilities.levelGrowthExponent: 0.5`. `data:build` přepočítá každý parametr poškození a léčení (`damage`, `tickDamage`, `amount`, `bonusDamage`, tedy stejný seznam jako dnešní `abilities.damage`) takhle:

`hodnota[L] = hodnota[1] × (hodnota[L] / hodnota[1]) ^ exponent`

Úroveň 1 se nemění. Kouzlo, které neroste (Hadí totem 18 na všech úrovních), dál neroste. S exponentem 0,5 (odmocnina) vychází například:

| Kouzlo | Dnes (úr. 1 → max) | Nově |
|---|---|---|
| Rozeklaný blesk (šaman) | 90 → 1500 (×16,7) | 90 → 367 (×4,1) |
| Léčivý příliv (šaman) | 150 → 3000 (×20) | 150 → 671 (×4,5) |
| Skalní trhlina (Kamenorohý) | 150 → 1500 (×10) | 150 → 474 (×3,2) |
| Hod sekáčkem (Rudý sekáč) | 61 → 1475 (×24) | 61 → 300 (×4,9) |
| Omračující příliv (Tidecaller) | 30 → 1500 (×50) | 30 → 212 (×7,1) |
| Žhavé náboje (bonus) | 300 → 1500 (×5) | 300 → 671 (×2,2) |
| Meteor (sdílené) | 300 → 1950 (×6,5) | 300 → 765 (×2,5) |
| Ultimátka Rozdrcení země | 1200 → 2400 (×2) | 1200 → 1697 (×1,4) |

Proč takhle: jedno číslo, platí pro všechna kouzla stejně, zachová pořadí a tvar křivek z mapy (kouzlo, které v mapě roste víc, roste víc i tady) a úroveň 1 nechá na pokoji. Odmítnuto: jedna pevná křivka pro všechna kouzla (1; 1,75; 2,5; 3,25; 4) by srovnala kouzla, která dnes rostou pomalu, a ztratila by charakter z mapy. Odmítnuto: strop růstu (třeba max 4×) by tvrdě srazil kouzla se slabou úrovní 1 (Omračující příliv) a nechal na pokoji ta pod stropem.

Ultimátky se dvěma úrovněmi se přepočítají stejným vzorcem. Duchovní ochrana (šamanova ultimátka) je nezranitelnost na čas, nemá poškození ani léčení, takže se nemění.

Hodnoty v `abilities.yaml` označené `design` (ruční čísla) přepočet podstoupí také, protože problém je globální. Úprava se počítá v `tools/` (tam `Math.pow` smí být), `sim/` dostane hotová čísla jako dnes.

### 4.2 Síla kouzel z Inteligence (Claudovo)

`rules.hero.spellPowerPerInt` 0,01 → **0,005** jako výchozí hodnota. Šaman na úrovni 50 tak má z Inteligence zhruba ×1,9 místo ×2,8. Výbava a Arcane Focus se nemění (jsou to zdroje síly, které si hráč vybírá).

Příklad šamana bez výbavy na úrovni 5 Rozeklaného blesku a úrovni hrdiny 50: dnes asi 4260 na zásah, nově asi 700. Kopiník má ve fázi 20 asi 1175 hp, Štítonoš asi 270.

### 4.3 Ladění a cíl (Claudovo)

Knoflíky, kterými se smí ladit: `levelGrowthExponent` (rozumně 0,4–0,7) a `spellPowerPerInt` (0,003–0,01). Dvojnásobné poškození nepřátel na hrdinu je Petrovo rozhodnutí z 18. 11. a nemění se; když autopilot po zkrocení kouzel umírá výrazně dřív, zapíše se to jako otevřený bod pro Petra. Ladí se proti:
- pásmu 6–12 výher z 20 bez výbavy (seedy 1–20 a kontrolně 21–40);
- střední výbavě (většina výher) a plné výbavě (všechno);
- měření „přebití“: nový výstup (rozšíření `sim:run` nebo malý nástroj, volba stavitele), který pro každého hrdinu vypíše poškození jednoho seslání nejsilnějšího podpisového kouzla v mediánu úrovní ve fázích 5, 10, 15 a 20 a poměr k hp Štítonoše a Kopiníka v té fázi. Cíl ve fázi 20 bez výbavy: Kopiník nepadne na jednu ránu (poměr pod 1), Štítonoš zhruba na 1–3 rány.

Když pásmo nejde splnit jen globálními knoflíky (typicky jednotliví hrdinové se slabým kitem), zapíše se to jako otevřený bod pro Petra, stejně jako u předchozích plánů. Kity se v tomto plánu nepřepisují.

### 4.4 Multishot (Petr: bonus všem, počet; Claudovo: zbytek)

- Každý vedlejší šíp dostane bonus Žhavých nábojů podle úrovně (po přepočtu 4.1), stejně jako hlavní šíp, a dál omráčení jako dnes.
- Efekty výbavy na útok (řetězový blesk, splash) dál jen u hlavního šípu, aby se nenásobily čtyřikrát.
- Počet vedlejších šípů zůstává `extraTargets: [1, 1, 2, 2, 3]`.
- Vedlejší šíp počítá bonus stejně jako hlavní (`onHitBonus`, včetně síly kouzel), jen bez spotřeby „empower“, pokud ji kouzlo má (Žhavé náboje ji nemají).
- Čísla Sparkshota se ladí v rámci 4.3; pásmo 6–12 platí i pro něj.

### 4.5 Truhla: porovnání a volba (Petr: princip; Claudovo: provedení)

**Pravidlo karet.** Pro obsazený slot karta vždy ukazuje hozený předmět:
- hozený předmět je stejný jako nasazený → karta **Úroveň** jako dnes (+1 úroveň);
- jiný předmět (vyšší, stejná i nižší rarita) → karta **Volba**. Dnes se předmět nižší nebo stejné rarity vůbec neukázal a karta dala jen úroveň; nově ho hráč uvidí a může si ho vzít.
- prázdný slot → karta **Nový** jako dnes.

**Volba.** Klik na kartu Volba (nebo její klávesa) otevře panel porovnání místo okamžitého použití (názvy a čísla v náčrtu jsou jen pro ilustraci):

```
            Truhla: vyber si kořist                    [Esc zpět]
 ┌──────────────────────────┐   ┌──────────────────────────┐
 │ NECHAT                   │   │ VZÍT NOVÝ                │
 │ ◇ Prsten úsvitu   (rare) │   │ ◆ Pečeť archiváře  (epic)│
 │ úroveň 3 → 4             │   │ úroveň 4 (do konce běhu) │
 │ +24 Inteligence          │   │ +18 Inteligence    ▼     │
 │ +6 % síly kouzel         │   │ +9 % síly kouzel   ▲     │
 │                          │   │ +12 % Magic Find   ▲ nové│
 │      [1] Nechat          │   │      [2] Vzít            │
 └──────────────────────────┘   └──────────────────────────┘
```

- Oba sloupce ukazují předmět ve stavu po volbě: nechat = nasazený předmět s úrovní +1, vzít = nový předmět s úrovní slotu +1 (dnešní pravidlo Replace).
- Řádky statů jsou zarovnané podle statu; stat, který jeden předmět nemá, má u druhého prázdný řádek. Barva a šipka ukazují, co je lepší (stejně jako dnes tooltip). Efekt legendary a mythic pod staty.
- Rarita barvou jména a slovem, ikona slotu jako na kartách.
- Esc nebo „Zpět“ vrátí k nabídce tří karet; truhla se nezavře, dokud hráč nevybere.
- Myš i klávesy 1/2; běh stojí jako dnes.

**Autopilot:** u Volby vezme nový předmět, když má vyšší raritu, jinak nechá stávající (+1). Pořadí karet jako dnes (výměna, nový, úroveň).

**Rozhraní pro testy:** `__game.chestCards[].action` nabývá `new`, `choice`, `level`; nové `__game.chestCompare` (karta, kterou hráč porovnává, nebo `null`) a v debug API volba stranou (`keep`/`take`). Simulace dostane volbu jako vstup, ne jako dvě různé karty, aby replay zůstal deterministický.

## 5. Omezení

- `sim/` čistý a deterministický (`AGENTS.md`): žádné `Math.pow` v simulaci, přepočet křivek jen v `tools/data-build`.
- `data:build` potřebuje export mapy (`npm run map:extract`, mapa `.w3x` je v projektu na claude.ai).
- Texty EN a CS, žádné texty z mapy, žádná oranžová, čitelnost v 1280×720.
- `npm run check`, build a e2e projekt `webgl2-fallback` musí projít.
- PR proti `main`. Merge až po Petrově slovu (pokud v chatu provedení neřekne jinak).

## 6. Co nechávám staviteli

- Kde přesně žije měření „přebití“ (4.3) a jak vypadá jeho výstup.
- Rozvržení panelu porovnání v detailu (rozměry, písmo), pokud splní náčrt a čitelnost; screenshot do `npm run shots` (`chest-compare`).
- Pořadí úkolů; doporučení: data a křivky, měření, multishot, truhla (sim, pak UI), vyvážení, dokumentace a PR.
- Zápis čísel a tabulky výher do `docs/DECISIONS.md` (nová sekce) a aktualizace `docs/STATUS.md`.
