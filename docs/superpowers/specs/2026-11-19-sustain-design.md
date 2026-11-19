# Přežití: lifesteal, srdíčka a orby na mapě: návrh

- **Stav:** návrh ke schválení (19. 11. 2026). Co je v části 4 označeno jako Claudovo, může Petr změnit.
- **Vychází z:** Petrova playtestu PR #18 (zkrocená kouzla), 19. 11. 2026: „je to fakt hodně těžké“, umřel ve 3. minutě.
- **Staví na:** `main` po PR #18 (`4b50a8c`), větev `sustain`.

## 1. Záměr a proč

Po zkrocení kouzel (PR #18) je hra příliš těžká a hráč umírá už ve 2.–4. minutě. Autopilot umírá ve stejném okně ve všech nastaveních knoflíků kouzel (`docs/DECISIONS.md`, Spell scaling): příčinou je dvojnásobné poškození nepřátel (`rules.threat.heroDamageTaken: 2`) dřív, než kouzla vyrostou. Petr nechce jen otočit knoflíky; chce do hry dostat **zdroje přežití**, které hráče odmění za aktivní hraní:

1. **Lifesteal** jako nový stat předmětů: léčí malým podílem (1–3 %) z veškerého poškození, které hrdina udělí útoky i kouzly.
2. **Srdíčka**: zabitý nepřítel s malou šancí upustí srdíčko, které léčí.
3. **Orby na mapě**: náhodně rozmístěné koule, o něco větší než krystaly, pro které je nutné dojít: **boty** (+100 % rychlost pohybu na 15 s), **berserk** (+50 % poškození na 15 s), **léčení** (100 % hp během 15 s).

Lifesteal přichází jen z výbavy, takže smrt ve 3. minutě bez výbavy neřeší; začátek běhu nesou srdíčka a orby.

## 2. Cíle, mimo rozsah, nechceme

**Cíle**
- Srdíčka a orby pomáhají od první minuty běhu, i bez výbavy.
- Orby jsou běžná součást rytmu hry (Petrova volba B), ne vzácná událost.
- Lifesteal dává výbavě nový obranný směr; škáluje s poškozením, ale má strop.
- Autopilot umí srdíčka i orby sbírat, takže čísla balancu jejich přínos ukážou.
- Balanc (seedy 1–20, Claudovy cíle, Petr může změnit): úmrtí autopilota před 4:00 aspoň o polovinu méně než dnes; bez výbavy zpět kolem 131 výher z 320 (stav před zkrocením kouzel); se střední výbavou většina běhů; s plnou výbavou téměř všechny.

**Mimo rozsah**
- Knoflíky kouzel z PR #18 (`levelGrowthExponent 0.5`, `spellPowerPerInt 0.005`) a `heroDamageTaken 2` zůstávají.
- Úpravy kitů jednotlivých hrdinů (Gravecaller 20 z 20, Mistwarden, Redcleaver, Tidecaller).
- Nové předměty; lifesteal dostanou stávající předměty.
- Obtížnosti, nové typy nepřátel.

**Nechceme**
- Nesmrtelnost: lifesteal z plošného kouzla do velké smečky nesmí léčit bez omezení.
- Aby se srdíčky nebo lifestealem léčil hrad (léčí jen hrdinu).
- Aby summony (hadí totemy, stínové kopie: `source` 2) léčily hrdinu lifestealem.
- Aby přidaná náhoda posunula spawn nepřátel nebo obsah truhel pro stejný seed (vlastní proud náhody).
- Oranžovou v UI, texty z mapy.

## 3. Co rozhodl Petr (19. 11. 2026)

- Chce lifesteal na předmětech (podíl z celkového poškození, útoky i kouzla, nízké jednotky %), srdíčka z mobů a tři orby na mapě s efekty uvedenými v části 1.
- Orby: varianta **B** (běžný rytmus, víc orbů na mapě), respawn **30–45 s**, místo **náhodné**, pokaždé jinde (ne pevná místa).
- Lifesteal: **přepsat jeden řádek** zhruba u 10 stávajících předmětů (jako Magic Find), ne nové předměty; se stropem léčení.
- Stavba orbů: cesta **A** (vlastní modul `sim/orbs.ts` + časovače efektů `sim/buffs.ts`).

## 4. Návrh

Všechna čísla jsou v `design/rules.yaml` v novém bloku `sustain` (schéma v `data/schema/rules.ts`), aby šla ladit bez kódu.

### 4.1 Lifesteal (předměty a strop)

- Nový stat `lifesteal` v `STAT_IDS` (`data/schema/item.ts`), podíl (0,015 = 1,5 %), sčítaný ve `GearBonus` / `recomputeGear` jako ostatní; roste s úrovní předmětu stejně (`itemStatAt`).
- **Body rozpočtu (Claudovo):** 1 bod = 0,25 % lifestealu. Řádek za 6 bodů = 1,5 %, za 8 bodů = 2 %, za 12 bodů = 3 %. Hlavička `design/items.yaml` a DECISIONS se doplní.
- **Které předměty (Claudovo, rozhodne stavitel podle pravidel):** asi 10 předmětů rare a výš; lifesteal nahradí řádek **stejné hodnoty v bodech**, přednostně obranný (hp, armor, regen, síla) nebo rozptýlený; nikdy Magic Find ani efekt legendary/mythic. Rozložení: aspoň 2 zbraně do hlavní ruky (melee i caster), 2 rukavice, 1 off-hand, 2 prsteny, 2 trinkety, 1 další; aspoň 3 rare kusy, aby lifesteal měla i střední výbava. Žádný common (common má jen jeden řádek).
- **Výpočet:** v `damageEnemy` (`sim/combat.ts`) pro `source` 0 (útok) a 1 (kouzlo, včetně on-hit bonusů a efektů výbavy, které jdou přes tuto funkci) se léčí `lifesteal × skutečně udělené poškození` (`min(amount, hp před zásahem)`, bez overkillu). `source` 2 (summony: hadí totemy Serpent Shamana a stínové kopie, `sim/allies.ts`) neléčí; Petr řekl útoky a kouzla.
- **Strop:** léčení z lifestealu za sekundu nejvýš `sustain.lifesteal.capPerSecond` × max hp (výchozí 0,02 = 2 % max hp/s). Implementace (Claudovo): rozpočet, který se každý tick doplní o `cap × maxHp × TICK_SECONDS` a smí se nastřádat nejvýš na jednu sekundu; léčení z něj ubírá. Žádná alokace.
- Mrtvý hrdina se neléčí; léčení nepřesáhne max hp.
- UI: řádek „Lifesteal“ / „Vysávání života“ v tooltipech, v porovnání truhly a v součtech pod panáčkem (gear screen a panel C), formát jako ostatní podíly (%).

### 4.2 Srdíčka

- Třetí `CrystalStore` (`hearts`, kapacita 64) a `updatePickups(run, hearts, 2)`: magnet a sběr jako krystaly a mince (dosah magnetu včetně výbavy a pasivky).
- **Drop (Claudovo):** běžný nepřítel `sustain.hearts.chance` = 0,04; elita a boss vždy jedno srdíčko. Pozice: kousek západně od krystalu (mince je východně), aby se nepřekrývaly. Hod kostkou z nového proudu náhody `sustainRng` (vedle `chestRng`), takže spawn ani truhly se pro stejný seed nemění. Plný sklad: srdíčko propadne (neléčí okamžitě, na rozdíl od XP).
- **Léčení:** `sustain.hearts.healShare` = 0,08 × max hp okamžitě, do max hp. Sebrat jde i s plným hp (léčí 0); autopilot ani hráč ho nemusí šetřit, magnet ho stejně přitáhne.
- Event `Pickup` s `u = 2` a vyléčeným množstvím.

### 4.3 Orby na mapě (`sim/orbs.ts`)

- **Sklad:** `OrbStore` s pevnou kapacitou `sustain.orbs.maxOnMap` = 3 (Claudovo). Každé místo má stav: živý orb (typ, x, y) nebo odpočet do respawnu.
- **Respawn:** po sebrání se místo uvolní a za náhodných `respawnSeconds` 30–45 s (Petr) se objeví nový orb. **Začátek běhu (Claudovo):** místa mají první odpočty `firstSeconds: [8, 20, 32]`, takže první orb přijde do 10 s a pomáhá hned v kritických prvních minutách.
- **Místo (Petr: náhodné, pokaždé jinde):** náhodný bod mezi `minCastleDistance` 300 a `maxCastleDistance` 2000 od hradu (spawn ring je na 2400), uvnitř arény, aspoň `minSpacing` 500 od ostatních orbů a 200 od truhel. Stejný postup jako `placeChest` (40 pokusů, pak poslední vyhovující bod; fallback se vzdáleností od hradu). Proud náhody `sustainRng`.
- **Typ:** rovnoměrně náhodně z `boots`, `berserk`, `heal` (`sustainRng`).
- Orb na mapě **nezmizí**, dokud ho někdo nesebere; **magnet ho nepřitahuje**. Sebere se, když je hrdina do `pickupRadius` 70 od středu.
- Event `OrbPickup` (typ, x, y) a `OrbSpawn` (místo, typ, x, y) pro klienta.

### 4.4 Efekty (`sim/buffs.ts`)

- Na hrdinovi tři časovače v tikách (`bootsTicks`, `berserkTicks`, `healTicks`), délka `sustain.buffSeconds` 15 (Petr). **Stejný orb znovu (Claudovo):** efekt se nesčítá, časovač se nastaví zpět na plných 15 s.
- **Boty:** výsledná rychlost pohybu × `bootsMoveSpeed` 2 (Petr: +100 %). Samostatný násobitel na konci `heroStats`, ne součet s výbavou; začátek a konec efektu volá `refreshHeroStats`. Dash se nemění.
- **Berserk:** veškeré poškození hrdiny × `berserkDamage` 1,5 (Petr: +50 %): útoky, kouzla i summony (`damageEnemy`, všechny `source`, před odečtem hp; lifesteal počítá z navýšeného poškození). Summony zahrnuje Claudovo čtení: hráč čeká, že berserk posílí i totemy a kopie, jinak by orb pro Serpent Shamana skoro nic nedělal.
- **Léčení:** po 15 s léčí rovnoměrně `healShare` 1,0 × max hp (Petr), tedy každý tik `maxHp / (15 × 30)`; počítá se z aktuálního max hp v daném tiku. Bez stropu lifestealu (je to jiný zdroj).
- Pořadí v `Run.step` (Claudovo): `updateOrbs` (sběr a respawn) hned po `updatePickups` srdíček; `updateBuffs` (odpočty, léčení v čase) po `updateGearEffects`. Zapsat do komentáře s pořadím v `sim/run.ts`.

### 4.5 Autopilot (`sim/bot.ts`)

- Nové pravidlo za úhybem (slam, charge) a **před** truhlou (Claudovo):
  - jde pro nejbližší orb `boots` nebo `berserk` do vzdálenosti `ORB_DISTANCE` 900 od hrdiny;
  - orb `heal` bere jen pod 70 % hp, pak do vzdálenosti 1500;
  - ne během finále, když je cílem finální boss (stejně jako truhla).
- Srdíčka sbírá sám magnet, bez nového pravidla.
- `sim:run` vypíše za hrdinu průměr sebraných srdíček, orbů podle typu a hp vyléčeného lifestealem, srdíčky a orbem léčení (nové položky v `run.stats`).

### 4.6 Klient

- **Orb:** svítící koule o poloměru asi 1,5× krystalu, jemně se vznáší; barva podle typu: boty modrá (#4fa8ff), berserk karmínová (#e0444e), léčení zelená (#4fd18b). Nad ní malý glyf typu (bota, sekera, kříž), vlastní jednoduché tvary. Žádná oranžová. Při sebrání krátký záblesk a zvuk (syntetizovaný jako ostatní).
- **Srdíčko:** malé karmínové srdce (vlastní geometrie), o něco menší než krystal; sběr s krátkým zvukem.
- **HUD:** běžící efekty jako ikony s odpočtem (sekundy) nad lištou kouzel; tmavě modré pozadí, okraj v barvě typu. Žádný ukazatel na okraji obrazovky (orby leží blízko).
- Vyléčené hp ukáží zelená čísla jako dnešní čísla poškození (srdíčko a lifesteal v součtu za krátké okno, ať nebliká každý tik; Claudovo).
- Texty EN a CS: názvy orbů a statu (`Lifesteal` / `Vysávání života`, `Boots of Haste` / `Boty rychlosti`, `Berserk` / `Berserk`, `Renewal` / `Obnova`; Claudovo).
- `window.__game`: `orbs` (`type`, `x`, `y` živých orbů), `hearts` (počet srdíček na zemi), `buffs` (`boots`, `berserk`, `heal`: zbývající sekundy), `lifesteal` (podíl hrdiny). S `debug=1`: `__game.debug.spawnOrb(type)` (orb 150 před hrdinou), `__game.debug.dropHeart()`.
- `npm run shots`: nový snímek `orbs` (tři orby a srdíčko u hrdiny, HUD s jedním efektem).

### 4.7 Ladění

- Petrova čísla (efekty orbů, 15 s, respawn 30–45 s) se neladí. Ladí se: `hearts.chance`, `hearts.healShare`, `orbs.maxOnMap` (2–4), `firstSeconds` a `lifesteal.capPerSecond`.
- Měření: `npm run sim:run -- --hero all --seeds 1-20` s `--gear none|mid|full`, kontrola na seedech 21–40. Porovnat úmrtí po dvou minutách a výhry s `main` (`4b50a8c`). Tabulka do `docs/DECISIONS.md`, nová sekce Sustain.
- Pokud cíle z části 2 nejdou dosáhnout ladicími knoflíky bez Petrových čísel, zapsat to jako otevřený bod pro Petra s měřením (ne měnit jeho čísla).

## 5. Testy

- Jednotkové: lifesteal (léčí jen `source` 0 a 1, bez overkillu, strop za sekundu, mrtvý hrdina), srdíčka (šance, elita a boss vždy, léčení do max hp, plný sklad), orby (první odpočty, respawn v 30–45 s, místo v pásmu a s rozestupy, typ, sběr jen v dosahu, bez magnetu), efekty (obnovení na 15 s, boty ×2 a návrat, berserk ×1,5 na všechny `source`, léčení 100 % za 15 s), autopilot (jde pro orb v dosahu, heal jen pod 70 %, úhyb má přednost), determinismus (stejný seed = stejný stav; spawn a truhly beze změny proti `main` pro stejný seed a vstupy, dokud hrdina nic nesebere).
- Data: schéma přijme `lifesteal`, počty řádků podle rarity sedí, rozpočet bodů každého předmětu se nezměnil.
- e2e (`webgl2-fallback`): `debug.spawnOrb("berserk")`, dojít k němu, `__game.buffs.berserk` > 0 a ikona v HUD; `debug.dropHeart()` zvýší hp poraněného hrdiny.

## 6. Co zbývá na staviteli

- Výběr konkrétních ~10 předmětů pro lifesteal podle pravidel v 4.1.
- Přesné tvary glyfů, srdce a ikon, velikosti a animace v rámci 4.6.
- Kapacity polí, jména eventů a polí, rozdělení do souborů v rámci pravidel `AGENTS.md`.
- Výsledné hodnoty ladicích knoflíků (4.7).
- Aktualizace `docs/STATUS.md` (včetně opravy „PR open“ u PR #18), `docs/DECISIONS.md`, `AGENTS.md` (nová pole `__game` a debug funkce) a `ARCHITECTURE.md` (nové soubory).

## 7. Zvažované cesty

- **Orby, rozhodnutí o roli:** A) vzácná odměna (1 orb, respawn 60–90 s, ukazatel na okraji); B) běžný rytmus (víc orbů, častý respawn). Petr zvolil **B** s respawnem 30–45 s.
- **Lifesteal na předmětech:** 1) přepsat jeden řádek u ~10 stávajících předmětů, katalog zůstane 70 kusů a vlastněné předměty lifesteal rovnou mají; 2) 6–8 nových předmětů v drop tabulkách (víc obsahu, nové názvy, lifesteal až s novými dropy). Petr zvolil **1**.
- **Stavba orbů:** A) vlastní `sim/orbs.ts` + `sim/buffs.ts` (čisté role, truhly beze změny, časovače efektů znovu použitelné); B) orby jako čtvrtý sklad krystalů (méně kódu, ale výjimka z magnetu, typ v hodnotě a respawn stejně zvlášť); C) obecný systém objektů na mapě pro truhly i orby (přepis fungujících truhel bez zisku teď). Petr zvolil **A**.
- Srdíčka jako třetí `CrystalStore` a lifesteal v `damageEnemy` neměly rozumnou alternativu: obojí stojí na jediném místě, kterým už sbírání a poškození prochází.
