# Hrozba elit a bossů: krátký návrh

- **Stav:** schváleno Petrem v chatu 12. 11. 2026 („vezmi A“, „udělej to“) a postaveno ve stejném chatu. Plán zvlášť nevznikl, změna je malá.
- **Proč:** Petrův playtest 2b-3. Elity nejsou dost silné, kdo utíká, zabije všechno snadno, a bossové u hradu nemají dosah ani rychlost, aby hrdinovi ublížili nebo ho dohnali.
- **Co bylo v datech:** elita i finální boss měli rychlost 317, hrdinové 420-448. Minibossové a nápory chodily jako obléhači (jdou na hrad, hrdiny si všimnou na 250). Bossové uměli jen útok zblízka, úder kolem sebe a výpad do 700.

## Cíl
Útěk před elitou nebo bossem přestane být bezpečný, ale každému jejich útoku se dá uhnout.

**Mimo rozsah:** zlato, truhly, itemy (další návrh), vyvážení jednotlivých hrdinů, nové modely a animace.
**Nechceme:** nepřítele rychlejšího než hrdina, který bije zblízka (nedá se uhrát), a arénu, která hrdinu odřízne od hradu.

## Cesty
1. **Jen čísla** (lovci rychlejší než hrdina, víc HP). Levné, ale nefér: uhnout jde jen úskokem jednou za 4 s.
2. **Lovci s útokem, kterému se dá uhnout** (vybráno Petrem). Elity loví a dělají výpad, bossové loví a útočí na dálku do kruhu s varováním.
3. **Boss zavře hrdinu v aréně.** Nejvíc nového kódu a odřízne hrdinu od hradu.

## Návrh
- **Elita (captain):** `hunter: true` (jde po hrdinovi, ať přišla s jakoukoli smečkou), chování `charge` s výpadem kopiníka, HP 3× -> 5×, rychlost 0,8 -> 1,0 (396, o něco pomalejší než hrdina, mezeru zavírá výpad). Poškození a aura zůstávají.
- **Minibossové** přicházejí jako lovci (dřív obléhači).
- **Úder na dálku (`strike`, `sim/enemy-strike.ts`):** boss, který cílí hrdinu ve vzdálenosti 450 až `maxRange`, položí varovný kruh tam, kde hrdina stojí. Kruh se nehýbe. Po 1 s zasáhne hrdinu v kruhu a hrad, na který kruh dosáhne. S `leap` boss během varování do kruhu doskočí, bez něj stojí (výstřel). Omráčení nebo smrt bosse varování ruší. Po dopadu čeká úder kolem sebe aspoň 2 s.
- **Hodnoty:** Iron Marshal poloměr 260, poškození 150, pauza 6 s, skok. Pale Abbot 280 / 220 / 6 s, skok. Gunmaster 240 / 260 / 4 s, dosah 1500, bez skoku. Dread Regent 300 / 400 / 5 s, skok.
- **Kopiníci v náporech** zůstávají obléhači, aby hrad pořád něco tlačilo.
- Klient se nemění: kruh, zvuk a otřes kamery jdou přes stávající události `Slam`.

## Claudova rozhodnutí (Petr je může změnit)
- Všechna čísla výše. Tvrdší elita (HP 6×, poškození 1×, rychlost 1,1×) nechala autopilotu 1-3 výhry z 20, proto mírnější.
- Gunmaster nedoskakuje: je to střelec, který si drží odstup.
- HP minibossů zůstalo. S 1,5× HP autopilot padal ještě víc; rozhodne Petrův playtest.
