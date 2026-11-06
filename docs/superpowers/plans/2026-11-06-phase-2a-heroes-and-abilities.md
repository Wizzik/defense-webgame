# Fáze 2a: hrdinové a kouzla – implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hráč si v menu vybere jednoho ze 4 hrdinů. Každý hrdina má 3 podpisová kouzla a ultimátku s čísly z mapy, všechna se sesílají sama (ultimátka i na R) a mezerník dělá úskok. Simulace zůstává deterministická.

**Architecture:**
- Každý druh kouzla má v `sim/abilities/` vlastní soubor s funkcí `update<Druh>`. `sim/abilities/kinds.ts` je registr druh → funkce a `slots.ts` z něj volá naučená kouzla v pevném pořadí slotů.
- Hrdina má 4 sloty: 0–2 podpisová kouzla, 3 ultimátka. Úroveň 0 znamená nenaučené. Začíná se slotem 0 na úrovni 1, ostatní se učí z karet.
- Nové zásobníky s pevnou kapacitou: `ProjectileStore` (střely) a `AllyStore` (totemy a stínové kopie). Nepřátelé dostanou zpomalení.
- Klient kreslí každý druh vlastním efektem z událostí a stavu simulace. Hrdinové se liší barvou robota.

**Tech Stack:** beze změny a bez nových závislostí ani assetů: Node 22, TypeScript 7.0.2, Vite 8.3.5, Vitest 5.1.0, Three.js 0.187.0, zod 4.6.7, yaml 2.9.1, tsx 4.23.15, @playwright/test 1.63.0.

**Spec:** `docs/superpowers/specs/2026-11-04-defense-webgame-design.md`, oddíly 3.3 (hrdinové a kouzla), 3.4 (level-up), 3.8 (MVP), 5 (data) a 6 (efekty). Navazuje na plány fáze 1 a tempa (`2026-11-06-slice-tempo-and-effects.md`).

## Fáze 2 (MVP) po částech

Fáze 2 je na jeden plán moc velká. Každá část má vlastní plán, PR a hraní:

| Část | Obsah | Hotovo, když |
|---|---|---|
| **2a Hrdinové a kouzla** (tento plán) | 4 hrdinové, 16 kouzel v 11 druzích, výběr hrdiny, ultimátka na R, úskok | každý hrdina jde dohrát a hraje se jinak |
| 2b Průběh běhu | 20 fází po 50 s, 4 frakce nepřátel, elitní nápory, minibossové a finální boss, obtížnosti, XP křivka na 40–50 level-upů | 16:40 běh s bossem jde dohrát |
| 2c Ekonomika | zlato a dřevo, obchod u hradu, ~20 itemů ve 3 raritách, 6 slotů, truhly, 2 věže, oprava hradu | hrad a obchod mají v běhu váhu |
| 2d Sdílená kouzla | ~10 sdílených kouzel, 6 pasivek, 4–6 evolucí, sloty 6 + 4, přehazování karet | buildy se mezi běhy liší |
| 2e Mezi běhy | body účtu, odemykání hrdinů, 3–5 perků, ukládání (IndexedDB, export a import) | MVP podle spec 3.8 |

## Co plán rozhoduje (ke kontrole autorem)

| Téma | Rozhodnutí |
|---|---|
| Rozsah | Jen hrdinové a jejich kouzla. Běh zůstává 3 minuty s jedním typem nepřítele, obchod a další nepřátelé přijdou v 2b a 2c. |
| Start a karty | Hrdina začíná s 1. podpisovým kouzlem. Karty nabízejí nové kouzlo, úroveň kouzla, ultimátku a atributy. Ultimátka se dá naučit od úrovně hrdiny 6 a druhá úroveň od 12 (mapa: 10). Přehazování karet přijde v 2d. |
| Noční čepel | Pořadí kouzel je Padající hvězdy, Soustředění lovce, Rychlý krok. Aura jako první kouzlo by na začátku nic neudělala. |
| Ultimátka | R ji sešle, T přepíná automatiku. Automatika je na začátku zapnutá. Ruční seslání nečeká na podmínku cílení. |
| Úskok | Mezerník: 350 jednotek za 0,15 s ve směru pohybu (stojíš-li, ve směru pohledu), přebití 4 s, bez nezranitelnosti |
| Síla kouzel | Poškození kouzel, totemů i léčení se násobí silou kouzel (INT). Kouzla ignorují brnění, útoky totemů a kopií ne. |
| Vyvolané jednotky | Nepřátelé na ně neútočí a neblokují je, po vypršení zmizí. Hadích totemů je nejvýš 3/6/9/12/15 podle úrovně kouzla, nejstarší zmizí. Nové Stínové sestry nahradí staré. |
| Posílený totem | Každé 2,3 s je další základní útok silnější: × (1 + 3) až × (1 + 10), podle mapy +300 až +1000 % |
| Seizmická ozvěna | Každé seslání jiného kouzla hrdiny (i posílený úder) vyvolá otřes: 150–750 poškození, omráčení 1–3 s, poloměr 350. Čísla jsou z pomocného kouzla mapy. |
| Střela duše | Poškozuje polovinou čísla z mapy (500–10 000), protože původní kouzlo dává nepřátelům půlku. Samonaváděná, za letu přecílí. |
| Hrobový stisk | Míří na největší shluk do 800 a za každý zásah léčí hrdinu o 50–300 (z triggeru mapy) |
| Hojivý příliv | Léčí jen hrdinu, když má méně než 60 % HP. Hrad neléčí, jeho oprava patří do 2c. |
| Duchovní ochrana | Hrdina i hrad jsou 10/20 s nezranitelní. Automaticky se sešle, když hrdina nebo napadený hrad klesne pod 35 % HP. |
| Zemětřesení, Kostěné stádo | Kolem hrdiny: Zemětřesení jednou, Stádo 10 s posílá 20–30 výbuchů za sekundu na náhodná místa do 1000–1500 |
| Cílení | Nova: aspoň 1 nepřítel v poloměru. Plocha a totemy: nejhustší shluk v dosahu. Střela: nejbližší nepřítel. Kužel míří na nejbližšího nepřítele podle dat kouzla, ne ve směru pohybu jako v tabulce spec 3.3; šířka roste ze 120 jednotek na 300 z mapy. |
| Útok na dálku | Zásah je okamžitý jako na blízko, střela je jen efekt. Odrážení (bounce) přijde později. |
| Vzhled | Všichni hrdinové jsou robot v barvě hrdiny, žádné nové modely. Skutečné modely přijdou v samostatném grafickém plánu. |
| Druhy kouzel | 11 druhů včetně nového `on_cast`. `instant` a `chain` přijdou až s kouzlem, které je potřebuje (2d). |

Čísla jsou výchozí. Task 8 je doladí tak, aby autopilot vyhrál s každým hrdinou a běh bez vstupu prohrál.

## Global Constraints

**Clean room (AGENTS.md, spec 4):**
- Kódy a jména z mapy (rawcode, `mapName`, jména triggerů) smí být jen v `tools/`, `design/` a `docs/`. Nikdy v `client/`, `sim/`, `data/generated/` ani v textech pro hráče.
- Žádné texty z mapy. Popisy kouzel a rolí hrdinů jsou vlastní, v EN i CS, a plán je určuje přesně (Task 1).
- Do gitu nesmí `data-source/`, `xhero/`, `*.w3x` ani `war3map.*`.

**Simulace (`sim/`):**
- Čistá: žádné `three`, nic z `client/`, žádné `window`, `document`, `navigator` ani `globalThis`.
- Deterministická: pevný krok `TICKS_PER_SECOND = 30`, náhoda jen z `run.rng`. Zakázané jsou `Math.random`, `Date`, `performance`, časovače, transcendentní funkce `Math` a `**`. Směry se počítají vektorově přes `Math.sqrt`. Hlídá to `tests/repo-guard.test.ts`.
- `Run.step()` v běžném kroku nealokuje. Výběr cílů používá předem alokovaná pole. Alokovat smí jen nabídka karet.
- Systémy běží v pevném pořadí `Run.step()` (Task 2 a 7).
- Jednotky jsou světové jednotky mapy, osa `y` míří na sever.

**Klient:** WebGPU s fallbackem na WebGL2. Texty pro hráče jen v `client/ui/messages-en.ts` a `messages-cs.ts` (`messages-cs` je `satisfies Record<MessageKey, string>`). Za snímek se nealokuje v pohledech, které běží pro každou entitu.

**Data:** `data/generated/*.json` se ručně neupravuje. Změna jde do `design/*.yaml`, pak `npm run data:build -- --source data-source/v20.75/out --out data/generated`. Export mapy je v kontejneru v `data-source/v20.75/out/`, jinak `npm run map:extract -- <mapa.w3x> v20.75` (mapa je soubor v projektu na claude.ai).

**Testy:** testy simulace si samy nastavují pravidla, která ověřují (`structuredClone(gameData())`). Testy vzorců počítají očekávání ze vstupních dat (`def.params.damage[0] * hero.stats.spellPower`), ne z opsaných čísel, aby ladění v Tasku 8 nic nerozbilo.

**Kód:** kód, identifikátory a komentáře anglicky. Malé soubory s jednou rolí. Žádné nové závislosti ani assety.

**Git:**
- Větev `phase-2a` z větve `effects` (PR #4, obsahuje i tempo z PR #3). Až Petr sloučí #4, rebase na `main`.
- Commity po úkolech, Conventional Commits, identita `Claude <noreply@anthropic.com>` a trailery session. Před commitem `npm run check`.
- Controller po každém zkontrolovaném úkolu pushne. Po Tasku 1 otevře PR do `main` přes REST API (`gh api`), rovnou jako ready s titulkem začínajícím „WIP:“.
- Merge do `main` jen se souhlasem Petra.

**Výkon:** zhruba 60 fps se 150 nepřáteli na notebooku s integrovanou grafikou, i s plným počtem totemů a střel.

## Review Focus

1. **Cíl střely zmizí za letu:** střela nesmí zasáhnout nového nepřítele, který dostal stejný slot, ani létat donekonečna. Testy: Task 4, `bolt retargets when its target dies` a `bolt fizzles without a target nearby`.
2. **Vyvolaných jednotek a střel přibývá rychleji, než mizí** (přebití 1,6 s, trvání 60 s): strop platí, nejstarší zmizí a plný zásobník nic neshodí. Testy: Task 6, `ward cap removes the oldest` a `full ally store stops spawning`; Task 4, `full projectile store waits`.
3. **Řetězení reakcí:** ozvěna nespustí sama sebe ani další ozvěnu a posílený úder je jedno seslání. Testy: Task 3, `echo does not trigger itself`; Task 5, `an empowered strike triggers the echo once`.
4. **R ve špatnou chvíli** (nenaučená ultimátka, přebíjení, výběr karty): nic se nestane a požadavek se neuloží na později. Test: Task 7, `the request is not queued`.
5. **Léčení a štít na hraně smrti:** léčení neoživí hrdinu s 0 HP a štít nezvrátí prohru, když hrad padl ve stejném kroku. Testy: Task 5, `heal does not revive a dead hero` a `shield does not undo a loss`.

## Převzato z fáze 1

| Odložená věc | Kde se řeší |
|---|---|
| skutečné mechaniky `enhanced-totem` a `seismic-echo` | Task 1 (data), Task 3 a 5 (simulace) |
| léčení u `grave-grasp` | Task 1, Task 3 |
| úskok a ultimátka | Task 7, Task 9 |
| přehazování karet, tabulka typů útoku a brnění, záporné brnění, rychlost pohybu z obratnosti, nepřátelé, obchod, věže, obtížnosti | 2b–2d |

---

## Mapa souborů

```
data/schema/{ability.ts, hero.ts, rules.ts, index.ts}          popisy, role, nové parametry a pravidla (Task 1)
design/{abilities.yaml, heroes.yaml, rules.yaml}                (Task 1, ladění Task 8)
sim/abilities/{slots.ts, kinds.ts, targeting.ts}                sloty, registr druhů, výběr cílů (Task 2)
sim/abilities/{nova.ts, echo.ts, area.ts, ticking-area.ts}      (Task 3)
sim/abilities/{projectile.ts, cone.ts}, sim/projectiles.ts      (Task 4)
sim/abilities/{aura.ts, on-hit.ts, heal.ts, shield.ts}          (Task 5)
sim/abilities/summon.ts, sim/allies.ts                          (Task 6)
sim/{input.ts, hero.ts}                                         akce R, T, mezerník (Task 7)
tools/sim-run/run.ts                                            --hero (Task 8)
client/ui/{menu.ts, hud.ts}, client/game/{keyboard.ts, params.ts, session.ts, debug.ts}, client/render/hero-tints.ts  (Task 9)
client/render/fx/{pool.ts, rings.ts, blasts.ts, bolts.ts, bubbles.ts, projectile-view.ts}, client/render/ability-fx.ts  (Task 10)
client/render/{figure.ts, ally-view.ts}                         (Task 11)
client/ui/{cards.ts, card-lines.ts}                             (Task 12)
e2e/game.spec.ts, README.md, AGENTS.md, ARCHITECTURE.md, docs/{STATUS.md, DECISIONS.md}   (Task 13)
```

---

### Task 1: Data pro 4 hrdiny

**Files:**
- Modify: `data/schema/{ability.ts, hero.ts, rules.ts, index.ts, schema.test.ts}`, `design/{abilities.yaml, heroes.yaml, rules.yaml}`, `tools/data-build/{load.ts, map-abilities.ts, map-heroes.ts, data-build.test.ts}`, `tools/data-build/fixtures/design/*.yaml`, `data/generated/*.json` (přegenerovat), `data/generated.test.ts`
- Modify kvůli přejmenování `rules.slice` → `rules.start`: `sim/run.ts`, `sim/abilities/slots.ts`, `client/main.ts`, `sim/testing/*`, testy, které `slice` nastavují

**Interfaces:**
- Produces:
  - `Ability` má navíc `description: LocalizedText` (hned za `name`).
  - `AbilityKind` a `Targeting` mají navíc `"on_cast"`.
  - Parametry druhů (povinné | volitelné; ostatní druhy beze změny):

| Druh | Povinné | Volitelné |
|---|---|---|
| `on_cast` (nový) | damage, radius, stunSeconds | – |
| `on_hit` | aspoň jedno z chance, splashRadius, bonusDamage, **empower** | splashPercent, stunSeconds |
| `area` | damage, radius, range | **healPerHit** |
| `projectile` | damage, range | **speed** |
| `summon` | count, duration | range, damageDealt, damageTaken, **damage, attackRange, attackInterval, maxAlive** |

  - `summon` je buď kopie hrdiny (má `damageDealt`), nebo totem (má `damage`, `attackRange`, `attackInterval` a `maxAlive`). Obojí naráz nebo ani jedno je chyba: „summon needs damageDealt (images) or damage, attackRange, attackInterval and maxAlive (wards)“.
  - `Hero` má navíc `role: LocalizedText` (hned za `name`).
  - `Rules`:
    - `slice: { hero, ability }` se nahradí `start: { hero: Slug }`;
    - `hero.dash: { distance: >0, seconds: >0, cooldownSeconds: >0 }`;
    - nový `autocast: { novaMinEnemies: int >= 1, healBelow: 0..1, shieldBelow: 0..1 }`;
    - `progression` navíc `ultimateFromLevel: int >= 1` a `ultimateLevelStep: int >= 1`.
  - `validateGameData` hlídá `rules.start.hero` (chyba `rules.start.hero: unknown hero "x"`); kontrola `slice.ability` zmizí.
  - Do skončení Tasku 2 vytvoří `createAbilitySlots` jediný slot z `hero.def.signatureAbilities[0]`. Pro Kamenorohého je chování stejné jako dnes.

**`design/rules.yaml`** (změny proti dnešku):
```yaml
start: { hero: stonehorn }
hero: { collision: 32, baseRegen: 0.25, regenPerStr: 0.05, spellPowerPerInt: 0.01, cooldownSpeedPerInt: 0.01,
        dash: { distance: 350, seconds: 0.15, cooldownSeconds: 4 } }
autocast: { novaMinEnemies: 1, healBelow: 0.6, shieldBelow: 0.35 }
progression: { ...beze změny, ultimateFromLevel: 6, ultimateLevelStep: 6 }   # map: ultimates need hero level 10
```

**`design/heroes.yaml`:** `nightglaive.signatureAbilities: [falling-stars, hunters-focus, swift-pace]` a role:

| Hrdina | `role.en` | `role.cs` |
|---|---|---|
| stonehorn | Melee bruiser. Stuns with stone and quakes. | Rváč na blízko. Omračuje kamenem a otřesy. |
| nightglaive | Ranged hunter. Swift strikes and falling stars. | Lovkyně na dálku. Rychlé útoky a padající hvězdy. |
| gravecaller | Spellcaster. Drains souls and hurls skulls. | Kouzelník. Vysává duše a metá lebky. |
| serpent-shaman | Summoner. Totems, lightning and healing. | Vyvolávač. Totemy, blesky a léčení. |

**`design/abilities.yaml`**, změny parametrů. Původ čísel patří do `review.notes` u kouzel `engine+script`, u ostatních do komentáře YAML:
- `enhanced-totem`: `params: { empower: DataA }` místo nulového splashe (DataA = Damage Increase 3, 5, 7, 9, 10, tedy +300 až +1000 %). `review.notes` přepiš: buff vydrží jeden zásah, triggery ho po zásahu odeberou.
- `seismic-echo`: `kind: on_cast`, `targeting: on_cast`, `params: { damage: { design: [150, 300, 450, 600, 750] }, radius: { design: [350, 350, 350, 350, 350] }, stunSeconds: { design: [1, 1.5, 2, 2.5, 3] } }`. Dnešní `review.notes` už původ z pomocného kouzla popisují; doplň, že se teď používají.
- `grave-grasp`: navíc `healPerHit: { design: [50, 100, 150, 200, 300] }`; do `review.notes` doplň, že léčení je zapojené.
- `soul-bolt`: `damage: { design: [500, 1000, 2500, 5000, 10000] }` a `speed: { design: [1200, 1200, 1200, 1200, 1200] }`. Do `review.notes` napiš, že kouzlo enginu dává nepříteli polovinu DataA (1000–20 000).
- `serpent-totem`: navíc `damage: { design: [101, 101, 101, 101, 101] }`, `attackRange: { design: [600, 600, 600, 600, 600] }`, `attackInterval: { design: [0.5, 0.5, 0.5, 0.5, 0.5] }` a `maxAlive: { design: [3, 6, 9, 12, 15] }`. Komentář: totem z mapy má útok 101, dosah pro nalezení cíle 600 a interval 1,0 s, který je vynásobený `heroes.attackCooldown` 0,5. Strop je vlastní.

Popisy kouzel (`description`):

| Kouzlo | EN | CS |
|---|---|---|
| rock-rupture | A line of stone spikes that stuns. | Řada kamenných hrotů, která omráčí. |
| enhanced-totem | Every few seconds your next attack hits far harder. | Každých pár sekund udeří další útok mnohem silněji. |
| seismic-echo | Each of your spells sends a stunning shockwave around you. | Každé tvé kouzlo vyšle kolem tebe omračující otřes. |
| earthquake | A massive blow to everything around you. | Mohutný úder do všeho kolem tebe. |
| hunters-focus | Your attacks deal more damage. | Tvoje útoky dávají větší poškození. |
| falling-stars | Stars strike around you and slow enemies. | Kolem tebe dopadají hvězdy a zpomalují nepřátele. |
| swift-pace | You move and attack faster. | Pohybuješ se a útočíš rychleji. |
| shadow-sisters | Three shadow copies fight at your side. | Po tvém boku bojují tři stínové kopie. |
| grave-grasp | Strikes the thickest crowd and heals you for every hit. | Udeří do největšího shluku a za každý zásah tě vyléčí. |
| skull-ring | A ring of skulls bursts out around you. | Kolem tebe vyletí prstenec lebek. |
| soul-bolt | A seeking bolt that hits the nearest enemy hard. | Samonaváděná střela, která tvrdě zasáhne nejbližšího nepřítele. |
| bone-stampede | Bones rain down around you for a while. | Kolem tebe chvíli prší kosti. |
| serpent-totem | Raises snake totems that bite nearby enemies. | Postaví hadí totemy, které koušou nepřátele v okolí. |
| forked-bolt | Lightning forks through the enemies in front of you. | Blesk se rozvětví mezi nepřátele před tebou. |
| mending-tide | Heals you when you are hurt. | Vyléčí tě, když jsi zraněný. |
| spirit-ward | Neither you nor the castle can be harmed for a while. | Tobě ani hradu chvíli nic neublíží. |

- [ ] **Step 1: Napiš padající testy.**
  - `schema.test.ts`: `requires a description`, `accepts the on_cast kind`, `accepts empower, healPerHit and speed`, `summon needs images or wards params` (kopie OK, totem OK, jen `count`+`duration` chyba, obojí chyba), `rejects an unknown start hero`, `requires autocast, dash and ultimate levels`.
  - `data-build.test.ts`: `copies descriptions and roles`.
  - `data/generated.test.ts`:
    - `matches design ids and names` porovná i `description` a `role`;
    - nový `carries the phase 2a mechanics`: `enhanced-totem.params.empower` je `[3, 5, 7, 9, 10]`, `seismic-echo.kind` je `on_cast`, první podpisové kouzlo `nightglaive` je `falling-stars` a `serpent-totem` má `maxAlive`.
  - Spusť `npm test`. Očekávané: nové testy FAIL.
- [ ] **Step 2:** Implementuj schémata, data-build a design. Přejmenuj `slice` na `start` v kódu i testech.
- [ ] **Step 3:** Přegeneruj data. `git diff data/generated` smí obsahovat jen změny z tohoto úkolu.
- [ ] **Step 4:** `npm run check`, `npm run build`, `npm run e2e`. Commit `feat(data): describe four heroes and the phase 2a ability mechanics`.

### Task 2: Sloty hrdiny, registr druhů a karty

**Files:**
- Create: `sim/abilities/kinds.ts`, `sim/abilities/targeting.ts`, testy `sim/abilities/{slots.test.ts, targeting.test.ts}`
- Modify: `sim/abilities/{slots.ts, line.ts, line.test.ts}`, `sim/run.ts`, `sim/cards.ts`, `sim/cards.test.ts`, `sim/combat.ts`, `sim/events.ts`, `sim/hash.ts`, `sim/index.ts`, `client/render/effects.ts` a `client/ui/hud.ts` (jen aby fungovaly se slotem 0 jako dnes)

**Interfaces:**
- Consumes: `rules.start`, `rules.progression.ultimate*` a `rules.autocast` z Tasku 1.
- Produces:
```ts
// sim/run.ts
export interface RunOptions { seed: number; durationSeconds?: number; hero?: string } // výchozí rules.start.hero
// Run navíc: ultimateAuto = true; ultimateRequested = false  (R zapojí Task 7)
// chyba pro neznámého hrdinu: `createRun: unknown hero "<id>"`

// sim/abilities/slots.ts
export const ULTIMATE_SLOT = 3;
export const CastMode = { None: 0, Auto: 1, Forced: 2 } as const;
export interface AbilitySlot {
  def: Ability;
  level: number;          // 0 = nenaučené
  cooldown: number;       // kroky
  active: boolean;        // linie letí, tikající plocha běží, on_hit je nabitý
  originX: number; originY: number; dirX: number; dirY: number;
  front: number;          // linie: uražená vzdálenost
  ticksLeft: number;      // tikající plocha: zbývající kroky
  readonly hit: Uint8Array;   // podle slotu nepřítele
}
/** Sloty 0–2 = signatureAbilities (0 na úrovni 1, zbytek 0), slot 3 = ultimate na úrovni 0.
 *  Druh bez funkce v UPDATERS vyhodí `sim: ability kind <kind> is not implemented`. */
export function createAbilitySlots(run: Run): AbilitySlot[];
export function abilityCooldownTicks(run: Run, slot: AbilitySlot): number;   // beze změny
/** None: nenaučené, přebíjí se nebo hrdina nežije; u ultimátky i když je automatika vypnutá a R nepřišlo.
 *  Forced: ultimátka s požadavkem z R v tomto kroku. Jinak Auto. */
export function castMode(run: Run, index: number): number;
/** Seslání: událost Cast (a = index) a cooldown. Task 3 sem přidá reakci on_cast. */
export function startCast(run: Run, index: number, value: number, x: number, y: number, u: number, v: number): void;
/** Sníží cooldown naučených slotů o 1, pak volá jejich funkce ve vzestupném pořadí slotů. Nakonec ultimateRequested = false. */
export function updateAbilities(run: Run): void;
/** Jen pro ladění a e2e: nastaví úroveň slotu a přepočítá staty. */
export function debugSetAbilityLevel(run: Run, index: number, level: number): void;

// sim/abilities/kinds.ts
export type AbilityUpdate = (run: Run, slot: AbilitySlot, index: number) => void;
export const UPDATERS: Partial<Record<Ability["kind"], AbilityUpdate>>;   // Task 2: { line }, další úkoly přidají svůj druh

// sim/abilities/targeting.ts (bez alokace; při shodě vyhrává nižší slot nepřítele)
/** Nejbližší živý nepřítel, jehož střed je nejvýš `range` od (x, y); -1 když žádný. */
export function nearestEnemy(run: Run, x: number, y: number, range: number): number;
/** Kolik živých nepřátel má střed nejvýš `radius + collision` od (x, y). */
export function countEnemiesWithin(run: Run, x: number, y: number, radius: number): number;
/** Mezi nepřáteli do `range` od (x, y) ten, kolem kterého je v `radius` nejvíc nepřátel.
 *  Shoda: blíž k (x, y), pak nižší slot. -1 když žádný. Hrubou silou O(n²); běží jen při seslání. */
export function densestCluster(run: Run, x: number, y: number, range: number, radius: number): number;

// sim/combat.ts
/** source: 0 základní útok hrdiny, 1 kouzlo, 2 vyvolaná jednotka. ref: slot kouzla (1), index spojence (2), jinak -1.
 *  Odhození jen pro source 0 a 1. */
export function damageEnemy(run: Run, slot: number, amount: number, source: 0 | 1 | 2, ref?: number): void;

// sim/events.ts: navíc Blast: 9, Heal: 10, Dash: 11
```

Význam polí událostí (doplňuje tabulku z fáze 1, klient na ní stojí):

| Událost | `a` | `value` | `x, y` | `u, v` |
|---|---|---|---|---|
| Hit | slot nepřítele | poškození | pozice nepřítele | `u` zdroj 0/1/2, `v` = `ref` |
| Cast | slot kouzla | podle druhu, viz níže | podle druhu | směr nebo 0, 0 |
| Blast | slot kouzla | `hitRadius` | střed výbuchu | – |
| Heal | slot kouzla | vyléčeno | pozice hrdiny | – |
| Dash | 0 | vzdálenost | start | směr |

`Cast.value` a `x, y`: line délka a počátek; nova, on_cast a ticking_area poloměr a hrdina; area poloměr a bod dopadu; cone délka a hrdina; projectile 0 a hrdina; summon počet a bod (totemy) nebo hrdina (kopie); heal vyléčené HP a hrdina; shield trvání v s a hrdina; on_hit násobek a cíl útoku.

**Pravidla:**
- `Run.step()`: pořadí z fáze 1 platí. Task 4 přidá za `updateAbilities` volání `updateProjectiles`, Task 6 za něj `updateAllies` a Task 7 před `moveHero` volání `applyActions`.
- Linie přejde na `nearestEnemy`, `startCast` a centrální odečet cooldownu. Chování a stávající testy linie se nemění; zásahy posílá s `ref = index`.
- **Karty** (`openOffer`), kandidáti v pořadí:
  - pro sloty 0–3 karta kouzla `{ kind: "ability", slot, fromLevel: level, toLevel: level + 1 }`, když `level < def.levels`. U slotu 3 navíc jen při `hero.level >= ultimateFromLevel + level * ultimateLevelStep`;
  - pak `str`, `agi` a `int`;
  - výběr Fisher–Yates jako dnes. `fromLevel: 0` znamená naučení.
- `chooseCard` u karty kouzla nastaví úroveň a zavolá `refreshHeroStats`. Naučené kouzlo je hned připravené (cooldown 0).
- `stateHash` přidá index hrdiny v `data.heroes`, `ultimateAuto` a u každého slotu `level`, `cooldown`, `active`, `front`, `ticksLeft`, počátek a směr.

- [ ] **Step 1: Napiš testy.**
  - `slots.test.ts`:
    - `createRun picks the chosen hero`: `hero: "gravecaller"` dá id slotů `[grave-grasp, skull-ring, soul-bolt, bone-stampede]` a úrovně `[1, 0, 0, 0]`;
    - `the default hero comes from rules.start`;
    - `unknown hero throws`;
    - `unlearned slots never cast`: Kamenorohý s nepřítelem 300 na sever po 60 krocích pošle `Cast` jen s `a = 0`;
    - `unsupported kind throws`: slot 1 nahrazený kouzlem druhu `chain` → `sim: ability kind chain is not implemented`;
    - `the ultimate waits while auto is off`: `ultimateAuto = false` a ultimátka na úrovni 1 → žádný `Cast` s `a = 3`.
  - `targeting.test.ts`:
    - `nearestEnemy breaks ties by the lower slot`;
    - `densestCluster picks the bigger group`: tři nepřátelé kolem (500, 0) po 50 a dva kolem (−300, 0), `range 800`, `radius 300` → slot ze skupiny u 500;
    - `densestCluster ignores enemies beyond range`;
    - `countEnemiesWithin counts the collision`: nepřítel ve vzdálenosti `radius + collision` se počítá, o 1 dál ne.
  - `cards.test.ts`:
    - `offers learn cards for unlearned signatures`: Kamenorohý na úrovni 2 s `cardsPerOffer: 10` dostane přesně sloty 0 (1→2), 1 (0→1), 2 (0→1), `str`, `agi`, `int`;
    - `the ultimate appears from ultimateFromLevel`: na úrovni 5 chybí, na 6 je `slot 3, 0→1`. Úroveň 2 ultimátky se nabídne až od 12;
    - `learning an ability makes it ready`.
  - Existující testy, které nastavovaly `rules.slice`, převeď na `RunOptions.hero` a `rules.start`.
  - Spusť `npm test`. Očekávané: nové testy FAIL.
- [ ] **Step 2:** Implementuj.
- [ ] **Step 3:** `npm run check`, `npm run e2e` (hra se slotem 0 vypadá jako dnes). Commit `feat(sim): four ability slots per hero with learn and ultimate cards`.

### Task 3: Nova, ozvěna, plocha a tikající plocha

**Files:**
- Create: `sim/abilities/{nova.ts, echo.ts, area.ts, ticking-area.ts, hits.ts}`, testy `sim/abilities/{nova.test.ts, echo.test.ts, area.test.ts, ticking-area.test.ts}`
- Modify: `sim/abilities/{kinds.ts, slots.ts}`, `sim/enemies.ts`, `sim/enemy-ai.ts`, `sim/hash.ts`

**Interfaces:**
- Consumes: `castMode`, `startCast`, `UPDATERS`, `countEnemiesWithin` a `densestCluster` z Tasku 2.
- Produces:
```ts
// sim/abilities/hits.ts
/** Zasáhne každého živého nepřítele se středem do radius + collision od (x, y): damageEnemy(…, 1, index).
 *  Přeživším nastaví omráčení max(stávající, stunTicks) a zpomalení. Vrací počet zásahů. */
export function hitEnemiesAround(run: Run, index: number, x: number, y: number, radius: number,
  damage: number, stunTicks: number, slow: number, slowTicks: number): number;
// sim/enemies.ts: navíc slowTicks: Int32Array, slowFactor: Float64Array (0..1, podíl ubrané rychlosti)
export function applySlow(e: EnemyStore, slot: number, factor: number, ticks: number): void;  // obojí max(stávající aktivní, nové)
// sim/abilities/echo.ts
/** Volá startCast po každém seslání. Každý naučený slot druhu on_cast kromě `index` vyvolá otřes kolem hrdiny
 *  a pošle Cast se svým slotem. Cooldown ani startCast nevolá, takže se nemůže řetězit. */
export function onHeroCast(run: Run, index: number): void;
// UPDATERS navíc: nova, on_cast (nic nedělá, reaguje přes onHeroCast), area, ticking_area
```

**Pravidla** (`L = level − 1`, poškození vždy `× hero.stats.spellPower`):
- `startCast` nejdřív pošle `Cast` a nastaví cooldown, pak zavolá `onHeroCast`. Poškození kouzla přijde až potom.
- **Nova** (`around_self`):
  - Auto: sešle se, když `countEnemiesWithin(hrdina, radius[L]) >= autocast.novaMinEnemies`. Forced: vždy.
  - Účinek: `hitEnemiesAround` kolem hrdiny s `radius`, `damage` a zpomalením `slow[L]` na `round(slowSeconds[L] * 30)` kroků, když je kouzlo má.
- **Zpomalení** v `updateEnemies`: dokud `slowTicks > 0`, rychlost chůze je × `(1 − slowFactor)`. `slowTicks` klesá každý krok, i u omráčeného. Odhození se nezpomaluje.
- **Ozvěna** (`on_cast`): otřes je `hitEnemiesAround` kolem hrdiny s `radius[L]`, `damage[L]` a omráčením `round(stunSeconds[L] * 30)`. `Cast` má `value = radius`.
- **Plocha** (`densest_cluster`):
  - cíl je `densestCluster(hrdina, range[L], radius[L])`; když žádný není, Auto čeká a Forced sešle na pozici hrdiny;
  - zásah kolem bodu cíle;
  - `healPerHit`: když hrdina žije, `heal = min(maxHp − hp, healPerHit[L] * zásahy)`. Kladné `heal` přičte a pošle `Heal`.
- **Tikající plocha:**
  - Auto: aspoň 1 nepřítel do `radius[L]` od hrdiny. Forced: vždy.
  - Seslání: `active = true`, `ticksLeft = round(duration[L] * 30)`.
  - V kroku `k` od seslání (seslání je `k = 1`) proběhne `floor(k * tps / 30 + 1e-9) − floor((k − 1) * tps / 30 + 1e-9)` výbuchů, kde `tps = ticksPerSecond[L]`. Počítá se z celých kroků, ne sčítáním zlomků.
  - Bod výbuchu kolem aktuální pozice hrdiny: `px = (rng.next() * 2 − 1) * R`, `py` stejně, opakuj, dokud `px² + py² > R²`, nejvýš 8 pokusů, pak (0, 0). Výsledek se ořízne na arénu.
  - Výbuch: `hitEnemiesAround` s `hitRadius[L]` (bez něj 150) a `tickDamage[L]`, pak `Blast`.
  - Po `ticksLeft` krocích `active = false`.
- `stateHash` přidá `slowTicks` a `slowFactor` živých nepřátel.

- [ ] **Step 1: Napiš testy.** Kouzla nastavuj přes `debugSetAbilityLevel`. Kde vadí odhození, nastav `rules.enemies.knockback` na nuly. Nepřátelé, kteří mají stát, mají velké `stunTicks` a HP 10⁶.
  - `nova.test.ts`:
    - `casts when enemies are inside the radius`: Hrobník, `skull-ring` L1, nepřítel 300 od hrdiny → `Cast` s `value = radius[0]` a `Hit` s `damage[0] * spellPower`;
    - `waits for novaMinEnemies`: s `novaMinEnemies: 3` dva nepřátelé nestačí, tři ano;
    - `forced cast ignores targeting`: Kamenorohý, `earthquake` L1 ve slotu 3, žádný nepřítel, `ultimateRequested = true` → `Cast` s `a = 3`;
    - `slows for slowSeconds`: Noční čepel, `falling-stars` L1. Lovec 350 od hrdiny se po seslání posouvá o `(1 − slow[0]) * moveSpeed / 30` (±1e-9). Po `round(slowSeconds[0] * 30)` krocích jde zase plnou rychlostí.
  - `echo.test.ts`:
    - `echo follows each hero cast`: Kamenorohý s `rock-rupture` L1 a `seismic-echo` L1, nepřítel 200 na sever. V kroku seslání přijde `Cast` s `a = 0` i `a = 2` a nepřítel dostane `damage[0] * spellPower` ozvěny;
    - `echo does not trigger itself`: na jedno seslání přesně jeden `Cast` ozvěny;
    - `echo stays silent when not learned`.
  - `area.test.ts`:
    - `strikes the densest cluster in range`: skupina 3 nepřátel u (600, 0) a jeden u (−200, 0) → zásah všech 3 ve skupině, osamělý bez zásahu;
    - `heals per hit up to max hp`: hrdina na 100 HP a 3 zásahy → `100 + 3 * healPerHit[0]` a `Heal` s touto hodnotou. Těsně pod `maxHp` se léčení ořízne;
    - `waits when nothing is in range`.
  - `ticking-area.test.ts`:
    - `blasts tps times per second for its duration`: `bone-stampede` L1 dá za 400 kroků přesně `floor(duration * tps)` událostí `Blast`, všechny do `duration * 30` kroků od seslání;
    - `blasts stay within the radius around the hero`;
    - `blasts damage enemies within hitRadius`: s `radius [1]` padají výbuchy na hrdinu a nepřítel 200 od něj dostane `tickDamage[0] * spellPower` za výbuch;
    - `same seed gives the same blasts`: otisk dvou běhů se rovná.
- [ ] **Step 2:** `npm test` → FAIL; implementuj; `npm run check` → PASS.
- [ ] **Step 3:** Commit `feat(sim): nova, seismic echo, area and ticking area abilities`.

### Task 4: Střela a kužel

**Files:**
- Create: `sim/projectiles.ts`, `sim/abilities/{projectile.ts, cone.ts}`, testy `sim/abilities/{projectile.test.ts, cone.test.ts}`
- Modify: `sim/abilities/kinds.ts`, `sim/run.ts` (zásobník, `savePrevious`, pořadí), `sim/hash.ts`, `sim/index.ts`

**Interfaces:**
- Consumes: `nearestEnemy`, `startCast`, `castMode` a `damageEnemy(…, 1, index)` z Tasku 2.
- Produces:
```ts
// sim/projectiles.ts
export const PROJECTILE_CAPACITY = 64;
export const RETARGET_RANGE = 600;
export class ProjectileStore {
  constructor(capacity: number);
  readonly capacity: number; count: number;
  readonly alive: Uint8Array; readonly ability: Uint8Array;
  readonly target: Int32Array; readonly targetSpawnTick: Int32Array;
  readonly x: Float64Array; readonly y: Float64Array; readonly prevX: Float64Array; readonly prevY: Float64Array;
  readonly speed: Float64Array; readonly damage: Float64Array;
  /** Nejnižší volný slot; -1 když je plno. */
  spawn(ability: number, target: number, targetSpawnTick: number, x: number, y: number, speed: number, damage: number): number;
  remove(i: number): void;
}
export function updateProjectiles(run: Run): void;   // v Run.step hned za updateAbilities
// Run navíc: readonly projectiles: ProjectileStore
// sim/abilities/cone.ts
export const CONE_START_HALF_WIDTH = 60;
// UPDATERS navíc: projectile, cone
```

**Pravidla:**
- **Střela:**
  - cíl je `nearestEnemy(hrdina, range[L])`. Bez cíle nebo s plným zásobníkem kouzlo čeká a cooldown zůstává 0;
  - seslání: `startCast` (směr k cíli), pak střela z pozice hrdiny s `speed[L] ?? 1200` a `damage[L] * spellPower`, `targetSpawnTick = enemies.spawnTick[cíl]`.
- **`updateProjectiles`** po slotech vzestupně:
  - Cíl platí, když žije a `spawnTick` se rovná `targetSpawnTick`. Jinak střela přecílí na `nearestEnemy(střela, RETARGET_RANGE)`, a když nikoho nenajde, zmizí.
  - Krok `step = speed * TICK_SECONDS`. Když je vzdálenost k cíli nejvýš `step + collision`, zasáhne (`damageEnemy(…, 1, ability)`) a zmizí. Jinak se posune o `step` k cíli.
  - `savePrevious` ukládá i předchozí pozice střel.
- **Kužel:**
  - cíl je `nearestEnemy(hrdina, length[L])`; bez cíle čeká;
  - směr `d` je jednotkový vektor k cíli (při nulové vzdálenosti `facing`);
  - kandidát má `t = (p − h) · d` v `[−c, length]` a `s = |(p − h) × d| <= half(t) + c`, kde `half(t) = CONE_START_HALF_WIDTH + (endWidth[L] / 2 − CONE_START_HALF_WIDTH) * clamp(t / length, 0, 1)`;
  - zasáhne nejvýš `maxTargets[L]` kandidátů podle rostoucího `t` (shoda: nižší slot). Bez alokace: opakovaný výběr minima nad předem alokovaným polem;
  - `startCast` (`value = length`, směr `d`) a pak zásahy `damage[L] * spellPower`.
- `stateHash` přidá živé střely (slot, ability, target, x, y).

- [ ] **Step 1: Napiš testy** (Hrobník `soul-bolt` L1 a Hadí šaman `forked-bolt` L1, nepřátelé omráčení s HP 10⁶):
  - `projectile.test.ts`:
    - `bolt homes onto the nearest enemy`: nepřítel 1200 na sever → zásah v kroku `ceil((1200 − step − collision) / step) + 1 ± 1` od seslání (krok seslání se počítá) s poškozením `damage[0] * spellPower`;
    - `bolt retargets when its target dies`: cíl zabitý za letu (`killEnemy`) a druhý nepřítel 300 od střely → zásah druhého;
    - `bolt fizzles without a target nearby`: po smrti cíle nikdo do 600 → střela zmizí a nikdo nedostane zásah;
    - `full projectile store waits`: s plným zásobníkem nepřijde `Cast` a `cooldown` zůstane 0;
    - `prev positions follow the flight`: po kroku platí `prevY < y` u střely letící na sever.
  - `cone.test.ts`:
    - `hits up to maxTargets nearest first`: s `maxTargets [2]` a nepřáteli na (0, 200), (0, 400) a (0, 600) dostanou zásah první dva;
    - `misses enemies behind or outside the cone`: nepřítel na (0, 50) určí směr, nepřítel na (0, −200) a na (400, 500) bez zásahu;
    - `width grows with distance`: nepřítel na (0, 50) určí směr; (130, 800) zásah, (130, 100) bez zásahu.
- [ ] **Step 2:** `npm test` → FAIL; implementuj; `npm run check` → PASS.
- [ ] **Step 3:** Commit `feat(sim): homing projectiles and the forked cone`.

### Task 5: Aura, posílený úder, léčení a štít

**Files:**
- Create: `sim/abilities/{aura.ts, on-hit.ts, heal.ts, shield.ts}`, testy `sim/abilities/{aura.test.ts, on-hit.test.ts, heal.test.ts, shield.test.ts}`
- Modify: `sim/abilities/kinds.ts`, `sim/world.ts`, `sim/hero.ts`, `sim/level-up.ts` (`refreshHeroStats`), `sim/combat.ts`, `sim/run.ts`, `sim/hash.ts`, `client/ui/card-lines.ts` (kopie hrdiny nese bonusy)

**Interfaces:**
- Consumes: `startCast`, `castMode` a `onHeroCast` z Tasků 2 a 3.
- Produces:
```ts
// sim/world.ts: HeroState navíc
bonus: { damage: number; moveSpeed: number; attackSpeed: number };   // součet naučených aur
// sim/abilities/aura.ts
export function auraBonuses(run: Run, out: HeroState["bonus"]): void;
// sim/abilities/on-hit.ts
/** Volá updateHeroCombat při útoku hrdiny na (x, y). První nabitý slot on_hit vrátí 1 + empower[L],
 *  vybije se a zavolá startCast. Bez nabitého slotu vrátí 1. */
export function consumeEmpower(run: Run, x: number, y: number): number;
// Run navíc: shieldTicks = 0
// UPDATERS navíc: aura (nic nedělá), on_hit (nabije: active = true při cooldown <= 0), heal, shield
```

**Pravidla:**
- **Aura:** `refreshHeroStats` nejdřív zavolá `auraBonuses`, pak `heroStats`. Vzorce v `heroStats`:
  - `moveSpeed = def.moveSpeed * (1 + bonus.moveSpeed)`;
  - `attackIntervalSeconds = cooldown / min(1 + agi * agiAttackSpeedBonus + bonus.attackSpeed, 1 + attackSpeedCap)`;
  - `damageMin/Max = (základ + primární bonus) * (1 + bonus.damage)`.
- **Posílený úder:** v `updateHeroCombat` se rolované poškození násobí `consumeEmpower(run, x cíle, y cíle)`. `startCast` zavolá i `onHeroCast`, takže ozvěna zareaguje jednou. Platí jen pro základní útok hrdiny.
- **Léčení** (`low_hp_ally`):
  - Auto: hrdina žije a `hp < autocast.healBelow * maxHp`;
  - `heal = min(maxHp − hp, amount[L] * spellPower)`, přičte se, `startCast(value = heal)` a `Heal`;
  - `range` a `maxTargets` se ve 2a nepoužívají, protože spojenci nemají HP. Napiš to do komentáře.
- **Štít:**
  - Auto, když `shieldTicks === 0` a (`hero.hp < shieldBelow * maxHp` nebo hrad `hp < shieldBelow * maxHp` se zásahem v posledních 60 krocích). Forced: vždy;
  - seslání: `shieldTicks = round(duration[L] * 30)` a `startCast(value = duration[L])`;
  - `shieldTicks` klesá o 1 na začátku `updateAbilities`;
  - `damageHero` a `damageCastle` při `shieldTicks > 0` nic neodečtou a nepošlou událost.
- `stateHash` přidá `hero.bonus`, `shieldTicks` a `active` slotů (už tam je).

- [ ] **Step 1: Napiš testy:**
  - `aura.test.ts`:
    - `swift pace speeds up movement and attacks`: Noční čepel se `swift-pace` L1 → vzorce výše s `moveSpeedBonus[0]` a `attackSpeedBonus[0]`;
    - `hunters focus raises attack damage`;
    - `an aura card refreshes the stats`: výběr karty úrovně aury změní `stats` hned.
  - `on-hit.test.ts`:
    - `charged attack deals 1 + empower times the damage`: Kamenorohý s `enhanced-totem` L1. První zásah leží v `[damageMin, damageMax] * (1 + empower[0]) * (1 − redukce brněním)`, další je zase normální;
    - `charge returns after the cooldown`;
    - `an empowered strike triggers the echo once`: s ozvěnou L1 přijde při posíleném úderu přesně jeden `Cast` ozvěny.
  - `heal.test.ts`:
    - `heals below the threshold`: Hadí šaman s `mending-tide` L1 na `0.5 * maxHp` → `hp = min(maxHp, 0.5 * maxHp + amount[0] * spellPower)`;
    - `stays idle above the threshold`;
    - `heal does not revive a dead hero`: s `hp = 0` žádný `Cast`, výsledek běhu `"hero"`.
  - `shield.test.ts`:
    - `shield blocks hero and castle damage for its duration`: `spirit-ward` L1 seslaný při `0.3 * maxHp`. Během `duration[0] * 30` kroků `damageHero` ani `damageCastle` nic neodečtou, pak zase ano;
    - `an attacked castle raises the shield`;
    - `forced cast works at full hp`;
    - `shield does not undo a loss`: hrad s `hp 0` před `updateAbilities` → štít se sešle, ale běh končí `"castle"`.
- [ ] **Step 2:** `npm test` → FAIL; implementuj; `npm run check` → PASS.
- [ ] **Step 3:** Commit `feat(sim): auras, empowered strike, healing and the spirit shield`.

### Task 6: Vyvolané jednotky (totemy a stínové kopie)

**Files:**
- Create: `sim/allies.ts`, `sim/abilities/summon.ts`, test `sim/allies.test.ts`
- Modify: `sim/abilities/kinds.ts`, `sim/run.ts` (zásobník, `savePrevious`, pořadí), `sim/hash.ts`, `sim/index.ts`

**Interfaces:**
- Consumes: `densestCluster`, `nearestEnemy`, `startCast`, `castMode`, `damageEnemy(…, 2, allyIndex)`, `rollDamage` a `armorReduction`.
- Produces:
```ts
// sim/allies.ts
export const AllyKind = { Ward: 0, Image: 1 } as const;
export const ALLY_CAPACITY = 32;
export class AllyStore {
  constructor(capacity: number);
  readonly capacity: number; count: number;
  readonly alive: Uint8Array; readonly kind: Uint8Array; readonly ability: Uint8Array; readonly formation: Uint8Array;
  readonly moving: Uint8Array;
  readonly x: Float64Array; readonly y: Float64Array; readonly prevX: Float64Array; readonly prevY: Float64Array;
  readonly facingX: Float64Array; readonly facingY: Float64Array;
  readonly spawnTick: Int32Array; readonly expiresTick: Int32Array;
  readonly attackCooldown: Int32Array; readonly lastAttackTick: Int32Array;
  /** Nejnižší volný slot; -1 když je plno. */
  spawn(kind: number, ability: number, formation: number, x: number, y: number, tick: number, expiresTick: number): number;
  remove(i: number): void;
}
export function updateAllies(run: Run): void;   // v Run.step hned za updateProjectiles
// Run navíc: readonly allies: AllyStore
// sim/abilities/summon.ts
export const WARD_RING = 80;            // poloměr kruhu totemů kolem bodu
export const WARD_CLUSTER_RADIUS = 300;
export const IMAGE_SEEK_RANGE = 1500;
export const IMAGE_OFFSETS: readonly (readonly [number, number])[];
//   [[-120, -60], [120, -60], [0, -140], [-200, -120], [200, -120], [0, -220]]: světové osy, neotáčí se
// UPDATERS navíc: summon
```

**Pravidla:**
- **Totemy** (summon s `damage`):
  - cíl je `densestCluster(hrdina, range[L] ?? 500, WARD_CLUSTER_RADIUS)`; bez cíle čeká;
  - seslání: `startCast(value = count[L], bod cíle)`. Pak pro `k = 0..count−1`:
    - když má kouzlo `maxAlive[L]` živých totemů, nejstarší (nejnižší `spawnTick`, pak nižší slot) zmizí;
    - pozice je bod cíle, při `count > 1` posunutá o `WARD_RING` v jednom z 8 pevných směrů (tabulka jednotkových vektorů bez trigonometrie, `k % 8`) a oříznutá na arénu;
    - `expiresTick = tick + round(duration[L] * 30)`. Plný zásobník zbytek přeskočí bez chyby.
  - Útok: `attackCooldown` klesá. Při `<= 0` cíl `nearestEnemy(totem, attackRange[L])` dostane `damage[L] * spellPower * (1 − armorReduction(brnění, defenseArmor))` přes `damageEnemy(…, 2, i)`. Pak `attackCooldown = round(attackInterval[L] * 30)`, `lastAttackTick = tick` a natočení k cíli.
- **Kopie** (summon s `damageDealt`):
  - Auto: `nearestEnemy(hrdina, IMAGE_SEEK_RANGE) >= 0`. Forced: vždy;
  - seslání: všichni spojenci tohoto kouzla zmizí a vznikne `count[L]` kopií na `hrdina + IMAGE_OFFSETS[k]` s `formation = k`. Pak `startCast(value = count)`;
  - pohyb k `hrdina + IMAGE_OFFSETS[formation]` rychlostí `hero.stats.moveSpeed * 1.3`. Do 8 jednotek stojí, `moving` podle pohybu;
  - útok jako hrdina: cíl je nejbližší nepřítel do `stats.collision + collision nepřítele + baseAttack.range`. Poškození `rollDamage(damageMin, damageMax) * damageDealt[L] * (1 − redukce)`, interval `round(stats.attackIntervalSeconds * 30)`.
- Spojenec zmizí v kroku, kdy `tick >= expiresTick`. `L` je aktuální úroveň kouzla.
- Nepřátelé spojence nevidí a nejsou jimi blokováni (rozhodnutí 2a). `damageTaken` se nepoužívá, napiš to do komentáře.
- `stateHash` přidá živé spojence (slot, kind, ability, x, y, expiresTick, attackCooldown).

- [ ] **Step 1: Napiš testy** v `sim/allies.test.ts`:
  - `wards appear at the densest cluster in range`: Hadí šaman se `serpent-totem` L2 → 2 totemy do `WARD_RING + 1` od bodu shluku;
  - `wards bite the nearest enemy every attackInterval`: `Hit` s `u = 2`, `v` = index totemu a hodnotou dle vzorce, další po `round(attackInterval[1] * 30)` krocích;
  - `wards expire after duration`;
  - `ward cap removes the oldest`: L1 (`maxAlive 3`), 4 seslání → 3 totemy a první zmizel;
  - `full ally store stops spawning`: s 31 obsazenými sloty a `count 2` vznikne 1 totem a nic nespadne;
  - `images spawn around the hero and follow it`: Noční čepel, `shadow-sisters` L1 (Forced) → `count[0]` kopií; po 60 krocích chůze hrdiny na východ jsou do 30 jednotek od svých bodů formace;
  - `images attack with damageDealt of the hero damage`;
  - `recast replaces the images`;
  - `same seed gives the same allies`: otisk.
- [ ] **Step 2:** `npm test` → FAIL; implementuj; `npm run check` → PASS.
- [ ] **Step 3:** Commit `feat(sim): serpent wards and shadow copies`.

### Task 7: R, T a mezerník

**Files:**
- Create: test `sim/actions.test.ts`
- Modify: `sim/input.ts`, `sim/hero.ts`, `sim/world.ts`, `sim/run.ts`, `sim/bot.ts`, `sim/bot.test.ts`, `sim/hash.ts`, `sim/index.ts`, `tools/sim-run/run.ts` (vstup s `actions: 0`)

**Interfaces:**
- Consumes: `Run.ultimateRequested`, `Run.ultimateAuto` a `castMode` z Tasku 2, `rules.hero.dash` z Tasku 1.
- Produces:
```ts
// sim/input.ts
export const InputAction = { Ultimate: 1, ToggleAuto: 2, Dash: 4 } as const;
export interface TickInput { moveX: number; moveY: number; card: number; actions: number }  // actions: bitová maska
// NO_INPUT = { moveX: 0, moveY: 0, card: -1, actions: 0 }
// sim/world.ts: HeroState navíc dashTicks, dashCooldown, dashDirX, dashDirY
// sim/hero.ts
/** Mezi savePrevious a moveHero: R → ultimateRequested, T → přepne ultimateAuto, mezerník → začne úskok. */
export function applyActions(run: Run, input: TickInput): void;
```

**Pravidla:**
- R jen zapíná: `if (actions & Ultimate) ultimateRequested = true`. Testy z Tasků 3–6, které nastavují příznak přímo, tak dál fungují. `updateAbilities` ho na konci kroku vynuluje, takže nepřipravená ultimátka požadavek zahodí.
- Během `levelUp` `step()` končí dřív, takže akce se zahodí.
- **Úskok:**
  - začne, když `dashCooldown === 0`, `dashTicks === 0` a hrdina žije;
  - směr je normalizovaný pohyb ze vstupu, bez pohybu `facing`;
  - `dashTicks = round(seconds * 30)`, `dashCooldown = round(cooldownSeconds * 30)`, událost `Dash`;
  - `moveHero`: `dashCooldown` klesá každý krok. Při `dashTicks > 0` se hrdina posune o `distance / round(seconds * 30)` ve směru úskoku místo běžné chůze, s ořezem na arénu. `facing` je směr úskoku, `moving = true` a `dashTicks` klesne.
- Autopilot posílá `actions: 0` a spoléhá na automatiku ultimátky.
- `stateHash` přidá stav úskoku.

- [ ] **Step 1: Napiš testy** v `sim/actions.test.ts`:
  - `R casts a ready ultimate with auto off`: Kamenorohý, `earthquake` L1, bez nepřátel → `Cast` s `a = 3`;
  - `R does nothing while the ultimate cools down or is unlearned`;
  - `the request is not queued`: R během přebíjení, pak kroky bez R po jeho konci → žádný `Cast`. R během `levelUp` → po výběru karty žádný `Cast`;
  - `T toggles auto`;
  - `auto ultimate casts by itself`;
  - `dash covers its distance in the move direction`: s `moveX: 1` za 5 kroků `x + 350` (±1e-9);
  - `dash without input follows facing`;
  - `dash waits for its cooldown`;
  - `dash stays inside the arena`.
  - `bot.test.ts`: `replaying recorded inputs gives the same hash` projde pro všechny 4 hrdiny (1800 kroků každý).
- [ ] **Step 2:** `npm test` → FAIL; implementuj; `npm run check` → PASS.
- [ ] **Step 3:** Commit `feat(sim): ultimate key with auto toggle and dash`.

### Task 8: sim:run pro každého hrdinu a ladění

**Files:**
- Modify: `tools/sim-run/{run.ts, run.test.ts}`, `sim/bot.test.ts`, `design/*.yaml` a `data/generated/*.json` podle ladění, případně `tools/data-build/scaling.ts`, `README.md`, `AGENTS.md`

**Interfaces:**
```ts
export interface RunSummary { hero: string; seed: number; /* …dnešní pole */ }
export function playBot(data: GameData, seed: number, durationSeconds?: number, hero?: string): RunSummary;
// formatSummary: "stonehorn seed 1: won at 3:00, kills 300, spawned 360, level 11, castle 8000/12000, hero 900/1500"
// CLI: npm run sim:run -- [--hero <id>|all] [--seed 1] [--runs 5] [--duration 180]
//   s --hero all vypíše řádky a souhrn pro každého hrdinu zvlášť
```

**Ladění** (`npm run sim:run -- --hero all --runs 5`). Cíle pro každého hrdinu:
- autopilot vyhraje 3 až 5 z 5 běhů;
- běh bez vstupu (`NO_INPUT`) prohraje;
- průměrná úroveň je 8–12;
- průměr zabití každého hrdiny je do ±30 % od mediánu všech čtyř.

**Co smíš měnit:**
- design hodnoty kouzel (`{ design: […] }`), `rules.autocast` a `rules.progression.ultimate*`;
- `design/scaling.yaml` smí dostat `abilities.damage`, který data-build násobí parametry `damage`, `tickDamage` a `amount` (pak test v `scaling.test.ts`);
- `castle`, `enemies` a `phases` jen tehdy, když se všichni hrdinové odchylují stejným směrem.

Když cíle nejdou splnit, ohlas DONE_WITH_CONCERNS s tabulkou čísel.

- [ ] **Step 1:** Testy: `formatSummary` s hrdinou (`run.test.ts`). V `bot.test.ts` `bot wins at least 3 of 5 seeds with every hero`, `idle runs lose with every hero` a `a full run stays fast for every hero` (pod 5 s). Spusť je a zapiš výchozí stav; testy balancu smí teď padat, opraví je Step 2.
- [ ] **Step 2:** Implementuj `--hero` a dolaď čísla. Výstup `--hero all --runs 5` před laděním a po něm vlož do reportu.
- [ ] **Step 3:** `npm run check`. Commit `feat(tools): sim:run per hero and phase 2a balance`.

### Task 9: Klient – výběr hrdiny, ovládání a HUD

**Files:**
- Create: `client/render/hero-tints.ts`
- Modify: `client/ui/{menu.ts, hud.ts, style.css, messages-en.ts, messages-cs.ts}`, `client/game/{keyboard.ts, keyboard.test.ts, params.ts, params.test.ts, session.ts, debug.ts}`, `client/render/hero-view.ts`, `client/main.ts`

**Interfaces:**
- Consumes: `RunOptions.hero`, `InputAction`, `ULTIMATE_SLOT`, `debugSetAbilityLevel`, `run.ultimateAuto` a stav úskoku ze `sim/`.
- Produces:
```ts
// client/game/keyboard.ts
/** read() nastaví moveX, moveY a actions: stisky od minulého čtení. KeyR → Ultimate, KeyT → ToggleAuto, Space → Dash.
 *  event.repeat se ignoruje. Klávesy s cílem v <button> nebo <input> se ignorují a nedostanou preventDefault.
 *  Ztráta fokusu smaže i čekající stisky. */
read(out: TickInput): void;
// client/game/params.ts: GameParams navíc hero?: string (?hero=<id>; neznámé id hra ignoruje s console.warn)
// client/game/session.ts
start(seed: number, paused?: boolean, hero?: string): void;
// client/render/hero-tints.ts
export function heroTint(heroId: string): number;
//   stonehorn 0x553300, nightglaive 0x3a1f66, gravecaller 0x1f4d2a, serpent-shaman 0x0f4a4a, jinak 0x553300
// client/game/debug.ts: GameSnapshot navíc
//   hero: string; heroX: number; heroY: number; abilityLevels: number[]; abilityCooldowns: number[];
//   ultimateAuto: boolean; allies: number; projectiles: number;
//   debug navíc setAbilityLevel(slot: number, level: number): void
```

**Pravidla:**
- **Menu:**
  - čtyři tlačítka hrdinů (jméno z dat) a pod nimi role vybraného hrdiny a jeho primární atribut;
  - výběr se ukládá do `localStorage` pod `defense-webgame.hero` (čtení i zápis v `try/catch`);
  - pořadí volby: `?hero`, uložená volba, `rules.start.hero`;
  - změna hrdiny restartuje běh za menu (`session.start(seed, true, hero)`).
- **HeroView** vezme barvu z `heroTint(run.hero.def.id)` a při změně běhu ji přebarví.
- **HUD** dole uprostřed: 4 buňky kouzel a buňka úskoku.
  - Buňka kouzla ukazuje jméno, úroveň a pruh přebití. Nenaučená je ztlumená s `hud.notLearned`.
  - Buňka ultimátky má navíc „R“ a `hud.auto` nebo `hud.manual` s nápovědou `hud.toggleKey`.
  - Buňka úskoku ukazuje `hud.dash` a pruh přebití.
  - Nabitý posílený úder rozsvítí rámeček buňky.
- Texty (klíč, EN, CS):

| Klíč | EN | CS |
|---|---|---|
| `menu.chooseHero` | Choose your hero | Vyber hrdinu |
| `menu.controls` | WASD or arrows to move, Space to dash, R for the ultimate. Spells cast themselves. | Pohyb WASD nebo šipkami, mezerník úskok, R ultimátka. Kouzla se sesílají sama. |
| `menu.primary` | Main attribute: {attr} | Hlavní atribut: {attr} |
| `attr.str` | Strength | Síla |
| `attr.agi` | Agility | Obratnost |
| `attr.int` | Intelligence | Inteligence |
| `hud.notLearned` | not learned | nenaučeno |
| `hud.auto` | auto | auto |
| `hud.manual` | manual | ručně |
| `hud.toggleKey` | T: switch | T: přepnout |
| `hud.dash` | Dash (Space) | Úskok (mezerník) |

`menu.hero` zmizí, nahradí ho výběr.

- [ ] **Step 1: Napiš testy:**
  - `keyboard.test.ts`: `R, T and Space become actions once per press`, `a held key does not repeat its action`, `blur clears pending actions`, `ignores keys on buttons` (událost s `target` jako `<button>` nedá akci ani `preventDefault`);
  - `params.test.ts`: `reads the hero param`.
- [ ] **Step 2:** Implementuj.
- [ ] **Step 3:** `npm run check`, `npm run build` a `npm run e2e` (existující testy kliknou na Start s výchozím hrdinou). Prohlédni si menu a HUD na screenshotu. Commit `feat(client): hero select, ultimate and dash keys, ability HUD`.

### Task 10: Klient – efekty kouzel

**Files:**
- Create: `client/render/fx/{pool.ts, pool.test.ts, rings.ts, blasts.ts, bolts.ts, bubbles.ts, projectile-view.ts}`, `client/render/ability-fx.ts`
- Modify: `client/render/effects.ts` (linie a pop zůstávají), `client/game/session.ts` (otřes kamery), `client/audio/sound-view.ts`, `client/main.ts`

**Interfaces:**
- Consumes: události a jejich pole z Tasku 2, `run.projectiles`, `run.shieldTicks`, `run.abilities[i].def.kind` a `active`, `hero.def.baseAttack.kind`.
- Produces:
```ts
// client/render/fx/pool.ts: čistá logika bez three
export class FxPool {
  constructor(capacity: number, life: number);
  /** Nejstarší záznam se přepíše. Vrací index. */
  add(now: number): number;
  /** Věk záznamu v [0, life], nebo -1 když je prázdný nebo vypršel. */
  age(i: number, now: number): number;
  reset(): void;
}
// client/render/ability-fx.ts
export class AbilityFx implements RunView { constructor(data: GameData); readonly object: Group }
```

**Pravidla** (časy jsou sekundy simulace, všechno instanced pooly přes `FxPool`, za snímek bez alokace):
- **Kruh** (pool 64, život 0,4 s): plochý prstenec se během 0,25 s rozšíří na poloměr a posledních 0,15 s mizí:
  - nova: kolem hrdiny, barva `0xffd27a`;
  - on_cast: kolem hrdiny, `0xc8a165`;
  - area: v bodě dopadu, `0x7dff9a`, s plným diskem s krytím 0,3;
  - Heal: zelený kroužek kolem hrdiny, 0,5 s stoupá o 0,5 jednotky scény.
- **Výbuchy** (pool 128, 0,3 s): na `Blast` koule `0xff7a3d` o průměru `2 * hitRadius`, pop jako u smrti.
- **Paprsky** (pool 96), tenké protažené kvádry z A do B:
  - zásah kuželu (`Hit`, `u = 1`, slot druhu cone): od hrdiny k nepříteli, `0x9fd8ff`, 0,18 s;
  - základní útok hrdiny na dálku (`Hit`, `u = 0`, `baseAttack.kind !== "melee"`): `0xfff1b3`, 0,1 s;
  - útok spojence (`u = 2`): od spojence (`v` = jeho index) k cíli; totem `0x1fa38a`, kopie barvou hrdiny.
- **Střely:** `ProjectileView` kreslí živé střely jako zářící koule (poloměr 0,2 jednotky scény, `0xa6ff7a`) s interpolací.
- **Bubliny:** při `shieldTicks > 0` průhledná koule kolem hrdiny (1,6 × velikost postavy) a kopule nad hradem (1,3 × `castle.radius`) s krytím 0,25 a pulzem.
- **Pod hrdinou:** když je naučená aura, slabý prstenec v barvě hrdiny. Nabitý `on_hit` přidá oranžový.
- **Otřes kamery:** jen na `Cast` druhů line, nova, area, ticking_area a cone; 0,25 pro ultimátku, jinak 0,12. Úder hrdiny dál 0,1.
- **Zvuky:**
  - `Cast` hraje `cast`, kromě `on_hit`, který hraje `hit`;
  - `Blast` hraje `hit`;
  - `Heal` hraje `pickup`;
  - `Dash` hraje `cast`.
  - Limit z `throttle.ts` platí.

- [ ] **Step 1:** Testy v `pool.test.ts`: `reuses the oldest entry when full`, `entries expire after their life`, `reset empties the pool`. Spusť → FAIL.
- [ ] **Step 2:** Implementuj.
- [ ] **Step 3:** `npm run check`, `npm run build`, `npm run e2e`. Na screenshotech hry s `?debug=1` a naučenými kouzly zkontroluj každý druh. Commit `feat(client): visual effects for every ability kind`.

### Task 11: Klient – totemy a stínové kopie

**Files:**
- Create: `client/render/{figure.ts, ally-view.ts}`
- Modify: `client/render/hero-view.ts` (přejde na `Figure`), `client/main.ts`

**Interfaces:**
- Consumes: `run.allies`, `AllyKind`, `ALLY_CAPACITY` ze `sim/`, `heroTint` z Tasku 9.
- Produces:
```ts
// client/render/figure.ts: skinovaný klon robota (dnešní logika HeroView)
export class Figure {
  constructor(gltf: GLTF);
  readonly object: Object3D;
  setTint(hex: number): void;
  setOpacity(opacity: number): void;           // < 1 zapne průhlednost materiálů
  fit(diameterScene: number): void;
  setPose(sceneX: number, sceneZ: number, facingX: number, facingY: number): void;
  setMoving(moving: boolean): void;
  punch(): void;
  die(): void;
  update(dt: number): void;
}
// client/render/ally-view.ts
export const IMAGE_POOL = 6;
export class AllyView implements RunView { constructor(gltf: GLTF, capacity: number) }
```

**Pravidla:**
- `HeroView` používá `Figure` a chová se jako dnes.
- **Totem:** instanced válec (poloměr 0,12, výška 0,6) a kuželová hlava (poloměr 0,18, výška 0,25), `emissive 0x1fa38a`. Do 0,1 s po `lastAttackTick` se natáhne na 1,15 × výšku.
- **Kopie:** pool `IMAGE_POOL` figur v barvě hrdiny s krytím 0,55. Velikost jako hrdina. Běží při `moving`, jinak stojí. Při novém `lastAttackTick` udeří.
  - Prvních 0,2 s po vzniku se objevuje, poslední 1 s před `expiresTick` mizí.
- Pozice jsou interpolované a za snímek se nealokuje.

- [ ] **Step 1:** Implementuj (logika je vizuální; testy pokryje e2e v Tasku 13).
- [ ] **Step 2:** `npm run check`, `npm run build`, `npm run e2e`. Screenshot Hadího šamana s totemy a Noční čepele s kopiemi (`?debug=1`, `setAbilityLevel`). Commit `feat(client): draw serpent wards and shadow copies`.

### Task 12: Klient – karty nových kouzel

**Files:**
- Modify: `client/ui/{cards.ts, card-lines.ts, card-lines.test.ts, messages-en.ts, messages-cs.ts, style.css}`

**Interfaces:**
- Consumes: `Card` s `fromLevel: 0` z Tasku 2, `description` z dat.
- Produces: `cardLines(run, card)` vrací u karty naučení hodnoty úrovně 1 s `from: ""`. Karta s prázdným `from` ukáže jen hodnotu.

**Pravidla:**
- Karta naučení má titulek `cards.learn` a pod ním popis kouzla. Karta ultimátky má štítek `cards.ultimate`.
- Řádky jsou parametry, které mají štítek, v pořadí klíčů dat:
  - `damage`, `tickDamage`, `amount` a `healPerHit` jsou celá čísla násobená `spellPower`;
  - procentní klíče (`slow`, `damageBonus`, `moveSpeedBonus`, `attackSpeedBonus`, `damageDealt`, `empower`) se zobrazí jako „+50 %“, `empower` 3 jako „+300 %“;
  - ostatní hodnoty mají jedno desetinné místo, jen když nejsou celé;
  - `cooldown` se přidá, když se mění.
- Nové štítky:

| Klíč | EN | CS |
|---|---|---|
| `cards.learn` | New: {name} | Nové: {name} |
| `cards.ultimate` | Ultimate | Ultimátka |
| `stat.radius` | Radius | Poloměr |
| `stat.range` | Range | Dosah |
| `stat.slow` | Slow | Zpomalení |
| `stat.slowSeconds` | Slow (s) | Zpomalení (s) |
| `stat.damageBonus` | Attack damage | Poškození útoků |
| `stat.moveSpeedBonus` | Move speed | Rychlost pohybu |
| `stat.attackSpeedBonus` | Attack speed | Rychlost útoku |
| `stat.count` | Count | Počet |
| `stat.duration` | Duration (s) | Trvání (s) |
| `stat.damageDealt` | Copy damage | Poškození kopií |
| `stat.tickDamage` | Blast damage | Poškození výbuchu |
| `stat.ticksPerSecond` | Blasts per second | Výbuchů za sekundu |
| `stat.hitRadius` | Blast radius | Dosah výbuchu |
| `stat.amount` | Healing | Léčení |
| `stat.healPerHit` | Heal per hit | Léčení za zásah |
| `stat.empower` | Empowered hit | Posílený úder |
| `stat.maxAlive` | Max totems | Max. totemů |
| `stat.maxTargets` | Max targets | Max. cílů |

- [ ] **Step 1: Napiš testy** v `card-lines.test.ts` (očekávání ze vstupních dat):
  - `learn card lists level 1 values`: `falling-stars` 0→1 dá `stat.damage` s `damage[0] * spellPower`, `stat.radius`, `stat.slow` „+50 %“, vše s `from: ""`;
  - `percent params read as percent`: `swift-pace` 1→2 dá `stat.moveSpeedBonus` „+10 %“ → „+15 %“;
  - `empower reads as a percent`: `enhanced-totem` 0→1 dá „+300 %“;
  - stávající testy rock-rupture a atributů dál platí.
- [ ] **Step 2:** `npm test` → FAIL; implementuj; `npm run check` → PASS.
- [ ] **Step 3:** `npm run build`, `npm run e2e`. Commit `feat(client): learn and ultimate cards with ability descriptions`.

### Task 13: E2E, dokumentace a dokončení

**Files:**
- Modify: `e2e/game.spec.ts`, `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `docs/STATUS.md`, `docs/DECISIONS.md`

**E2E testy** (oba projekty, každý přiloží screenshot; fixture hlídá chyby v konzoli):
1. `menu lets you pick a hero`: `/?seed=1&lang=en` ukáže 4 tlačítka hrdinů. Klik na Nightglaive a Start → `__game.hero === "nightglaive"` a `screen === "playing"`.
2. `every hero plays without errors`: pro každého hrdinu `/?seed=1&hero=<id>&debug=1&speed=8&duration=20&lang=en`, Start, `debug.setAbilityLevel(s, 1)` pro sloty 0–3. Do 60 s `screen` je `won` nebo `lost`. Uprostřed běhu screenshot s efekty.
3. `R casts the ultimate and T switches auto`: Kamenorohý s `debug=1`, `setAbilityLevel(3, 1)`, klávesa T → `ultimateAuto === false`, klávesa R → `abilityCooldowns[3] > 0`.
4. `Space dashes`: po mezerníku se `__game.heroX` nebo `heroY` změní aspoň o 300.
5. Stávající testy (Start, level-up, konec běhu) dál procházejí.

**Dokumentace:**
- `README.md`: ovládání (WASD, mezerník, R, T) a parametr `hero`.
- `AGENTS.md`: URL parametr `hero`, `debug.setAbilityLevel` a `npm run sim:run -- --hero all`.
- `ARCHITECTURE.md`: registr druhů kouzel, sloty, `ProjectileStore`, `AllyStore` a pořadí `Run.step`.
- `docs/STATUS.md`: 2a hotová, další je plán 2b.
- `docs/DECISIONS.md`: řádky z tabulky „Co plán rozhoduje“ ve znění, které Petr schválil, a výsledky ladění z Tasku 8.

- [ ] **Step 1:** E2E testy.
- [ ] **Step 2:** Dokumentace.
- [ ] **Step 3:** `npm run check`, `npm run build`, `npm run e2e` a `npm run sim:run -- --hero all --runs 5`. Výstupy vlož do reportu.
- [ ] **Step 4:** Commit `test(e2e): cover hero choice, ultimate and dash; docs: phase 2a`.

---

## Hotovo, když

- Všechny testy procházejí (`npm run check`, `npm run e2e`, CI na PR) a `sim:run --hero all` splňuje cíle z Tasku 8.
- Petr odehraje běh s každým hrdinou a s `?fps=1` naměří zhruba 60 fps i s plnými totemy (Hadí šaman) a Kostěným stádem (Hrobník).

## Odloženo mimo 2a

- Nepřátelé útočí na vyvolané jednotky a `damageTaken` kopií; léčení spojenců a hradu.
- Odrážení útoku na dálku (bounce), druhy `instant` a `chain`.
- Bonus z mapy „součet atributů × násobitel“ pro ultimátky a evoluce (spec 3.3, 2d).
- Vlastní modely hrdinů (samostatný grafický plán).
