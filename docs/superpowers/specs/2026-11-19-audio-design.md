# Zvuk a hudba: návrh

- **Stav:** návrh ke schválení (19. 11. 2026). Co je označeno jako Claudovo, může Petr změnit.
- **Vychází z:** Petrova přání 19. 11. 2026: „vadí mi monotónní zvuky, nemá to cit, duši“; „každý hrdina má svoje téma, celé by to mělo být ve stylu fantasy“.
- **Staví na:** `main` po PR #22 (`8cfdbd9`), větev `audio`.
- **Místo v pořadí:** první z projektů „hra kompletní před multiplayerem“ (Petr, 19. 11. 2026): 1 zvuk a hudba + nastavení, 2 víc hrdinů v simulaci a AI spojenec, 3 frakce nepřátel, 4 obtížnosti s prostředím, 5 postup mezi běhy, 6 credits a právní kontrola. Obchod v hradu (a s ním dřevo, věže, oprava) vypadl.

## 1. Záměr a proč

Dnešní zvuk je 15 tónů syntetizovaných v kódu (`client/audio/sfx.ts`): každé kouzlo každého hrdiny zní stejně (`cast()`), zásah je pípnutí čtvercové vlny, hudba není, hlasitost nejde nastavit, rána do hrdiny je potichu. Po pár minutách běhu je to jednotvárné a hra nemá atmosféru.

Cíl: hra zní jako **fantasy** a **každý hrdina má svůj zvukový charakter** podle svého živlu, takže ho poznáš i se zavřenýma očima. K tomu hudba, která nese napětí běhu a bossů, a nastavení, které hra zatím nemá.

## 2. Cíle, mimo rozsah, nechceme

**Cíle**
- Nahrané zvuky a hudba s volnou licencí (CC0 přednostně) místo syntézy.
- Každý z 8 hrdinů má vlastní sadu: základní útok a čtyři kouzla kitu ve stejné zvukové rodině.
- Hudba v menu, v běhu, při bossovi a finálním bossovi, znělky výhry a prohry.
- Žádný zvuk nezní dvakrát stejně (varianty, rozptyl výšky a hlasitosti) a při 150 nepřátelích se nic nepřebuzí.
- Nastavení: hlasitost celková, hudba, efekty; třesení obrazu zap/vyp; čísla poškození zap/vyp.
- Zvuky jsou v datech: nový typ nepřítele nebo frakce (projekt 3) jen doplní řádky, kód se nemění.

**Mimo rozsah**
- Hlasy postav (namluvené hlášky).
- Prostorový 3D zvuk (HRTF); stačí stereo podle polohy na obrazovce.
- Nové vizuální efekty; zvuky se věší na dnešní události.
- Změny balancu a simulace (viz omezení v 5.4).

**Nechceme**
- Zvuky, které po 15 minutách unaví: ostré, hlasité a časté (zásahy, sběr XP) musí být měkké a krátké.
- Hudbu, která přehluší boj, ani boj, který přehluší důležité varování (bossův úder, elitní nápor).
- Cokoli z Warcraftu nebo Blizzardu, ani zvuky „podobné k nerozeznání“; zvuky bez jasné licence.
- Sci-fi a elektronický charakter (pípání, lasery) u fantasy kouzel.

## 3. Co rozhodl Petr (19. 11. 2026)

- Fantasy styl celé hry, každý hrdina s vlastním tématem.
- Cesta **A**: nahrané zvuky a hudba s volnou licencí. Syntéza z `sfx.ts` zůstane jen jako záloha, když se soubor nenačte.
- Nastavení (hlasitost, třesení, čísla) patří k tomuto projektu.

## 4. Přístupy

| | Popis | Pro | Proti |
|---|---|---|---|
| **A (zvoleno)** | nahrané CC0 zvuky (OpenGameArt, Kenney) a orchestrální hudba, varianty a mix v kódu | skutečné nástroje a údery: „duše“; fantasy orchestr | zdroje stahuje Petr (weby nejsou z kontejneru dostupné); hra naroste o jednotky MB |
| B | lepší syntéza v kódu: vrstvení, dozvuk, variace, procedurální hudba | nic se nestahuje, malá hra | zní elektronicky, fantasy orchestr nevznikne; jde proti důvodu změny |

## 5. Návrh

### 5.1 Zvukový charakter hrdinů (Claudův návrh, Petr může změnit)

Každý hrdina má **zvukovou rodinu**. Kouzla kitu a základní útok berou zvuky z ní; rodiny se mezi hrdiny nepřekrývají. Zásah kouzla a jeho seslání můžou mít každý svůj zvuk (např. výstřel a dopad); událost `Hit` už nese zdroj a slot schopnosti (`sim/combat.ts`), takže to jde bez změny simulace.

| Hrdina | Rodina | Základní útok | Kouzla kitu |
|---|---|---|---|
| Stonehorn | země a kámen: hluboké dunění, praskání skály | těžký tupý úder | Rock Rupture praskání země v linii; Enhanced Totem (on_hit) kamenné ťuknutí; Seismic Echo dunivá ozvěna; ult Groundbreaker mohutný otřes |
| Nightglaive | měsíc a noc: svist, jemné kovové cinkání, šípy | výstřel z luku, svist šípu | Hunter's Focus tichý třpyt; Falling Stars dopady hvězd se zvonivým dozvukem; Swift Pace (aura) bez zvuku při seslání; ult Shadow Sisters stínové zašeptání |
| Gravecaller | smrt a kosti: chrastění kostí, temná magie | temná střela | Grave Grasp hrobové sevření; Skull Ring chrastivý kruh lebek; Soul Bolt kvílivá duše; ult Bone Stampede dupot kostí |
| Serpent Shaman | příroda a bouře: syčení hadů, blesky, kmenový buben | šamanská střela | Serpent Totem syčení a dřevo; Forked Bolt praskání blesku; Mending Tide šumění a zvonky; ult Spirit Ward duchovní chorál |
| Mistwarden | mlha a duchové: vítr, šepot, nářek | studený závan | Soul Burst výbuch duší; Wisp Ward bludička; Mist Surge valící se mlha; ult Wailing Wave kvílení |
| Sparkshot | střelný prach a oheň: výstřely, prskání jisker | výstřel z pušky | Rocket Fan sykot raket a výbuchy; Searing Rounds sykot žhavé kule; Quickstep (aura) bez zvuku; ult Beam Swarm hučení žhnoucích paprsků |
| Redcleaver | krev a hniloba: těžká sekera, řev, mlaskání | těžký sek sekerou | Cleaver Toss vrhnutá sekera; Blood Fan krvavý vějíř; Swift Pace (aura, stejná jako u Nightglaive) bez zvuku; ult Rot Field bublání hniloby |
| Tidecaller | voda: vlny, šplouchání, hluboký proud | vodní střela | Crushing Wave valící se vlna; Stunning Tide (on_hit) šplouchnutí; Riptide proud; ult Drowned Lake hluboké jezero |

**Sdílená kouzla** (kdokoli je může naučit) dostanou vlastní, živlem jasné zvuky: Arc Lightning blesk, Smite úder shůry se zvonem, Fire Bolt ohnivá koule, Frost Ring praskání ledu, Meteor dopad a výbuch, Holy Ground svatý chorál, Blade Fan svist dýk, Shock Wave rázová vlna, Sentry Ward dřevěný totem, Second Wind nádech a léčení. Pasivky nemají zvuk.

**Nepřátelé a bossové:** smrt podle typu nepřítele (dnes kostlivci: chrastění kostí, u bossů těžký pád), rána nepřítele do hrdiny (dnes potichu), výstřel střelce, léčení kaplana, nájezd (charge) s nádechem a dupotem. Příchod bosse a elitního náporu válečný roh; bossův úder: nádech při varovném kruhu, rána při dopadu; enrage řev.

**Hra a rozhraní:** sběr XP (měkký, krátký, výška stoupá v rychlé řadě jako dnes), mince, srdíčko, orby podle druhu, truhla, level-up a karty, kliknutí v menu, výbava (nasazení předmětu, drop z bosse podle rarity: legendární a mýtický má vlastní slavnostní zvuk).

**Hrad:** rána do hradu (dnes `castleHit` s odstupem 0,5 s) dostane dunivý zvuk dřeva a kamene.

**Nízké hp hrdiny** (Claudův návrh): pod 25 % hp tichý tep srdce, dokud hp nevystoupá nad 30 %.

### 5.2 Hudba

Stopy s licencí CC0 (případně CC-BY s uvedením autora, spec §6), orchestrální fantasy:

| Kdy | Nálada |
|---|---|
| menu | tajemná, klidnější fantasy |
| běh (2–3 stopy, střídají se) | bojová, pohyblivá; plynou za sebou, aby 17 minut neznělo jako smyčka |
| miniboss | tvrdší, bubny |
| finální boss | nejepičtější stopa (sbor, žestě) |
| výhra / prohra | krátké znělky, pak ticho a konečná obrazovka |

- Přechody jsou prolínání (asi 1,5 s), nikdy střih.
- Při kartách level-upu, truhle a panelu výbavy (hra stojí) se hudba ztiší a ztlumí výšky; po návratu se vrátí.
- Při příchodu bosse a elitního náporu se hudba na chvíli ztiší, aby roh zazněl čistě.
- Výběr skladeb: Claude najde 2 kandidáty na každé místo (odkaz na poslech, licence), **Petr vybere poslechem.** Je to otázka vkusu, ne techniky.

### 5.3 Pocit ze zvuku (mix)

- **Varianty:** každý zvuk má 2–4 nahrávky, náhodný rozptyl výšky (výchozí ±6 %) a hlasitosti (±2 dB).
- **Limit hlasů:** každý zvuk má strop současných přehrání (zásahy a smrti nepřátel třeba 6), celkový strop 32; nové přehrání nad stropem se zahodí. Dnešní `Throttle` se rozšíří o kategorie.
- **Priorita:** zvuky hrdiny a varování před zvuky nepřátel.
- **Stereo podle polohy:** posun vlevo a vpravo podle polohy na obrazovce; mimo obrazovku tišší.
- **Sběrnice:** master → hudba a efekty; na efektech jemný kompresor/limiter, aby 30 smrtí v jednom kroku nepřebudilo výstup.
- **Hlasitost zdrojů** srovnaná při převodu (5.5), aby žádný zvuk nevyčníval.

### 5.4 Data a kód

- Nový soubor `design/audio.yaml`:
  - **cue** = pojmenovaný zvuk: soubory (varianty), hlasitost, rozptyl výšky, limit hlasů, kategorie (hudba / efekty / rozhraní), priorita;
  - mapování schopnost → cue (každá z 47 schopností; pasivky výslovně `none`), hrdina → cue základního útoku, typ nepřítele → cue smrti a útoku, událost hry → cue;
  - hudba: stopy a jejich místa (menu, běh, boss, finále, výhra, prohra), body smyčky.
- `data:build` z něj vyrobí `data/generated/audio.json` se schématem v zod; CI ověří, že každá schopnost, hrdina a typ nepřítele má cue, každý soubor existuje a má řádek v `assets/LICENSES.md`.
- Klient: `SoundView` mapuje události na cue přes data, ne přes `switch`. Nový přehrávač drží dekódované buffery efektů, sběrnice, limity a stereo; hudbu hraje přes `<audio>` napojené do Web Audio (streamuje, nedekóduje celé stopy do paměti).
- **Simulace se nemění.** Stav, hash a replay zůstanou bajt po bajtu stejné (stejné otisky v testech). Pokud zvuku chybí informace (např. kterou schopností padl zásah), smí přibýt pole do existující události, nic jiného.
- Syntéza ze `sfx.ts` zůstane jako záloha pro cue, jehož soubor se nenačetl (jedna hláška v konzoli, hra běží).

### 5.5 Soubory a převod

- Zdrojové soubory (zipy, wav) jdou do `audio-source/` v `.gitignore`; do repa jde jen převedený výstup v `assets/audio/` (servíruje ho Vite jako modely).
- Nový nástroj `tools/audio-build` (ffmpeg je v kontejneru): ořízne ticho, srovná hlasitost (efekty a hudba každé na svou cílovou úroveň), převede do Opus v `.ogg` (efekty mono kolem 64 kb/s, hudba stereo kolem 96 kb/s), spočítá sha256 a vypíše řádky pro `assets/LICENSES.md` (autor, licence, odkaz, datum, sha256 zdroje).
- **Rozpočet velikosti:** efekty do 3 MB (načtou se před startem běhu, menu ukáže načítání), hudba do 15 MB (streamuje se, menu stopa až po prvním kliknutí kvůli pravidlům prohlížeče).

### 5.6 Odkud zvuky vezmeme

1. Claude sestaví **seznam ke stažení**: konkrétní položky z OpenGameArt a Kenney (RPG Audio, Impact Sounds, Interface Sounds) s licencí CC0, u každé odkaz a k čemu poslouží. Kandidáti, které už známe: „Combat Sound Effects Pack“ (150 zvuků, z toho 78 kouzel, CC0), orchestrální bojové a bossové smyčky v kolekci „CC0 – Cinematic Music“. CC-BY jen tam, kde CC0 chybí, a s řádkem v credits.
2. **Petr** stáhne zipy do jedné složky v počítači (weby nejsou z kontejneru dostupné) a vybere hudbu poslechem.
3. Claude složku převezme přes desktopovou aplikaci, poslechově nemůže, takže vybírá podle názvů, délky, spektra a popisu; Petr na náhledu zkontroluje, co se nehodí, a řekne, co vyměnit.
4. Kenney sady jdou případně i z kopií na GitHubu (licence CC0), pokud Petr nebude chtít stahovat.

### 5.7 Nastavení

- Tlačítko **Nastavení** v hlavním menu. V běhu dnes žádné menu pauzy není (Esc zavírá jen panely), proto přibude klávesa **O**, která běh pozastaví a otevře stejný panel (Claudův návrh; Esc ho zavře).
- Posuvníky: celková hlasitost, hudba, efekty (0–100 %); přepínače: třesení obrazu, čísla poškození.
- Ukládá se do `localStorage` (jako dnešní ztlumení), klávesa M dál ztlumí vše.
- Texty EN a CS.

## 6. Testy a ověření

- Jednotkové: převod dat (každá schopnost má cue, chybějící cue shodí build), výběr varianty a rozptylu s pevným seedem, limity hlasů a priorita, ztišení hudby při pauze, ukládání nastavení.
- `npm run check`, build, e2e `webgl2-fallback`: menu → běh → karta → konec bez chyby v konzoli; nastavení se otevře a uloží; žádný 404 na zvukový soubor.
- Simulace: stejné otisky determinismu, `sim:run` beze změny.
- Petrův playtest: poznám hrdinu podle zvuku, nezní to jednotvárně ani po 15 minutách, hudba nese napětí a nepřehlušuje, varování bosse je slyšet.

## 7. Co je na staviteli

- Přesné cue a soubory pro každou schopnost a událost (podle 5.1 a dostupných zvuků).
- Body smyčky a délky prolínání, cílové úrovně hlasitosti, přesné limity hlasů.
- Přesné umístění tlačítka Nastavení v menu a vzhled panelu (tmavý, modrošedý jako zbytek UI).
- Jestli tep při nízkém hp a stereo podle polohy fungují dobře; jinak je vypne a zapíše do `docs/DECISIONS.md`.

## 8. Rizika

| Riziko | Opatření |
|---|---|
| CC0 zvuky nepokryjí všech 8 rodin stejně dobře | vrstvení dvou zvuků do jednoho cue, posun výšky; chybějící rodinu Petr doplní dalším stažením |
| Claude neslyší, co vybírá | Petr schvaluje poslechem na náhledu; každá výměna je jen změna řádku v `audio.yaml` |
| Hudba zvětší hru | streamování, rozpočet 15 MB, Opus |
| Safari a starší prohlížeče neumí Opus v Ogg | cílí se desktop Chrome, Edge, Firefox (spec §2); záloha syntézou |
| Prohlížeč nepustí zvuk před prvním kliknutím | jako dnes: kontext se zapne prvním kliknutím v menu |
