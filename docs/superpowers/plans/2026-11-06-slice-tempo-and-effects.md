# Vertikální řez: tempo a efekty – implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Petr po prvním hraní řekl, že vertikální řez je pomalý a nudný. Přidáme tempo survivors her a efekty: rychlejší hrdina i nepřátelé, kratší přebíjení, hodně slabších nepřátel, odhození po zásahu, čísla poškození, „pop“ při smrti, otřes kamery a syntetizované zvuky.

**Architecture:**
- Nový `design/scaling.yaml` násobí čísla z mapy stejně pro všechny hrdiny, kouzla a nepřátele (spec 5: přepočet na cílové tempo se zachováním poměrů z mapy).
- Pravidla běhu se ladí v `design/rules.yaml` autopilotem.
- Odhození je v simulaci (deterministicky), efekty a zvuky jen v klientu.

**Tech Stack:** beze změny, bez nových závislostí. Zvuky přes Web Audio API, bez assetů.

**Spec:** `docs/superpowers/specs/2026-11-04-defense-webgame-design.md` (3.4, 5, 6). Navazuje na `docs/superpowers/plans/2026-11-04-phase-1-vertical-slice.md`; jeho Global Constraints platí beze změny.

## Global Constraints

Stejné jako ve fázi 1, hlavně:
- Clean room: kódy a jména z mapy jen v `tools/`, `design/` a `docs/`.
- `sim/` je čistá a deterministická: žádné transcendentní funkce `Math`, žádné `**`, žádný DOM ani hodiny, žádná alokace v `Run.step()`.
- Texty pro hráče jen v `client/ui/messages-en.ts` a `messages-cs.ts`, v EN i CS.
- Žádné nové assety ani závislosti.
- Výkon: zhruba 60 fps se 150 nepřáteli.
- Commity: `npm run check` musí projít, Conventional Commits, identita `Claude <noreply@anthropic.com>`.
- Testy simulace si samy nastavují čísla pravidel, která ověřují. Testy vzorců (třeba `heroStats`) počítají očekávání ze vstupních dat, ne z čísel opsaných z dat.

## Review Focus

1. **Odhození netlačí nepřítele ven z arény ani do hradu.** Test: Task 2, `knockback respects the arena and the castle`.
2. **Bouře zásahů** (150 nepřátel, vlna kouzla): čísla poškození ani zvuky nezahltí stránku. Pooly mají pevnou kapacitu a zvuky mají limit. Testy: Task 2, `damage numbers reuse the oldest slot`, a Task 3, `throttles bursts`.
3. **Prohlížeč zvuk nespustí bez gesta uživatele.** Kontext se vytvoří až po kliknutí na Start a chyba Web Audio nesmí shodit hru. Test: Task 3, `sfx is silent without a context`.

---

### Task 1: Tempo

**Files:**
- Create: `design/scaling.yaml`, `tools/data-build/scaling.ts` (schéma a aplikace násobků), `tools/data-build/fixtures/design/scaling.yaml`
- Modify: `tools/data-build/{load.ts, build.ts, data-build.test.ts}`, `design/abilities.yaml` (hlavička, `waveSpeed`), `design/rules.yaml`, `data/generated/*.json`, `client/render/camera.ts` (`DISTANCE`), `sim/world.ts` + spawner (`RunStats.spawned`), `tools/sim-run/run.ts` (souhrn), testy, jejichž očekávání plynou ze změněných dat (`sim/hero.test.ts`, `client/ui/card-lines.test.ts`, `e2e/game.spec.ts`, …), `ARCHITECTURE.md`

`design/scaling.yaml`:
```yaml
# Uniform multipliers from the map's numbers to the survivors pace (spec 5).
# data-build applies them to every hero, ability and enemy, so the map's ratios stay.
heroes: { moveSpeed: 1.4, attackCooldown: 0.5 }
abilities: { cooldown: 0.33 }
enemies: { hp: 0.3, moveSpeed: 1.22 }
```

**Pravidla:**
- data-build násobí:
  - hrdinu: `moveSpeed` a `baseAttack.cooldown`;
  - kouzlo: každou úroveň `cooldown`;
  - nepřítele: `hp` a `moveSpeed`.
- Zaokrouhlení: rychlosti a HP na celá čísla, cooldowny na 2 desetinná místa.
- Schéma souboru je strict a všechny násobky jsou > 0. Chybějící soubor nebo klíč dá čitelnou chybu se jménem souboru.
- Hlavička `design/abilities.yaml` řekne, že cooldown je z exportu krát `scaling.yaml`.
- `rock-rupture` dostane `waveSpeed: { design: [2000, 2000, 2000, 2000, 2000] }`.
- `design/rules.yaml`, výchozí hodnoty pro ladění:
  - `arena`: `height: 4400`, `castle: { x: 0, y: -1700 }`, `heroStart: { x: 0, y: -1200 }`, `gates: [{ x: -1600, y: 1500 }, { x: 1600, y: 1500 }]`;
  - `phases`: `spawnPerSecond` 1.2, 1.8, 2.4, 3.0 a `hunterShare` 0.25, 0.3, 0.35, 0.4;
  - `progression`: `xpFirst: 5`, `xpStep: 4`;
  - `castle` a `enemies` podle ladění.
- Kamera: `DISTANCE = 46`.
- `RunStats.spawned` počítá vytvořené nepřátele (přidej ho i do `stateHash`). `formatSummary` ho vypíše za `kills`: `kills 63, spawned 320`.
- **Ladění autopilotem** (`npm run sim:run -- --runs 5`). Měníš `castle`, `enemies`, `phases` a `progression.xpStep`, dokud neplatí:
  - autopilot vyhraje aspoň 3 z 5 běhů a běh bez vstupu prohraje;
  - za běh přijde 250–400 nepřátel;
  - autopilot dojde průměrně na úroveň 8–12;
  - aspoň v jednom vítězném běhu klesne hrad pod 60 % HP.
  Když se cíle nedají splnit, ohlas DONE_WITH_CONCERNS s čísly.
- Testy balancu (`idle run loses before the end`, `bot wins at least 3 of 5 seeds`) dál čtou skutečná data. Přidej test `a run sees between 250 and 400 enemies` (seed 1).

- [ ] **Step 1:** Testy pro `scaling.ts`: `applies uniform multipliers`, `rounds speeds and hp to integers and cooldowns to 2 decimals`, `fails with readable error when scaling.yaml is missing`. Spusť je → FAIL.
- [ ] **Step 2:** Implementuj data-build, přegeneruj data a uprav pravidla.
- [ ] **Step 3:** Oprav testy, které čekaly stará čísla. Kde test ověřuje vzorec, ať očekávání počítá ze vstupních dat.
- [ ] **Step 4:** Dolaď čísla autopilotem, výstup `sim:run` vlož do reportu. Pak `npm run check`, `npm run build` a `npm run e2e`.
- [ ] **Step 5:** Commit `feat(data): survivors pace via uniform scaling and retuned rules`.

### Task 2: Odhození, čísla poškození, pop a otřes kamery

**Files:**
- Modify: `sim/enemies.ts` (`knockVX`, `knockVY`, `knockTicks`), `sim/combat.ts` (`damageEnemy` nastaví odhození), `sim/enemy-ai.ts` (pohyb odhozením), `sim/hash.ts`, `data/schema/rules.ts`, `design/rules.yaml`, `data/generated/rules.json`, `client/render/{effects.ts, camera.ts}`, `client/game/session.ts`, `client/main.ts`, `client/ui/style.css`
- Create: `client/render/damage-numbers.ts`, `client/render/damage-number-pool.ts` (čistá logika bez DOM), testy `sim/knockback.test.ts`, `client/render/damage-number-pool.test.ts`

**Pravidla:**
- `rules.enemies.knockback: { attack: 40, ability: 90, seconds: 0.15 }`, tedy vzdálenost v jednotkách za `seconds`.
- `damageEnemy` u přeživšího nepřítele nastaví odhození směrem od hrdiny: `knockV = směr * (vzdálenost / seconds)` a `knockTicks = round(seconds * 30)`. Novější odhození přepíše starší.
- V `updateEnemies` se odhození přičte k pohybu v každém kroku a lineárně slábne k nule. Pak platí stávající vytlačení z hrdiny a hradu a ořez na arénu.
- Odhození se ukládá do `stateHash`.
- **Čísla poškození:** pool 64 prvků DOM nad canvasem.
  - Každý `Hit` vezme nejstarší volný prvek, a když volný není, přepíše nejstarší.
  - Číslo stoupá 0,6 s a mizí. Pozice je promítnutá ze světa kamerou.
  - Barva: bílá pro základní útok, oranžová pro kouzlo.
  - Za snímek se mění jen `transform` a `opacity`.
  - Logika poolu (slot, věk, kdy uvolnit) je v `damage-number-pool.ts` bez DOM.
- **Pop při smrti:** na `Death` se do 0,25 s zvětší koule z 0 na 1,4 průměru nepřítele a vybledne (instanced pool 64). Nahradí dnešní kroužek.
- **Otřes kamery:** `FollowCamera.shake(amount)`. Na `Cast` 0,25 jednotky scény, na `HeroHit` 0,1. Útlum za 0,2 s; během pauzy se kamera netřese.

- [ ] **Step 1:** Testy:
  - `sim/knockback.test.ts`: `hit pushes the enemy away from the hero`, `knockback fades to zero`, `knockback respects the arena and the castle`, `ability knocks harder than the base attack`;
  - `damage-number-pool.test.ts`: `damage numbers reuse the oldest slot`, `numbers expire after 0.6 s`.
  Spusť je → FAIL.
- [ ] **Step 2:** Implementuj.
- [ ] **Step 3:** `npm run check`, `npm run build`, `npm run e2e`. Prohlédni si screenshot hry s čísly poškození.
- [ ] **Step 4:** Commit `feat: knockback, damage numbers, death pop and camera shake`.

### Task 3: Zvuky

**Files:**
- Create: `client/audio/sfx.ts`, `client/audio/throttle.ts` (čistá logika), test `client/audio/throttle.test.ts`
- Modify: `client/main.ts`, `client/game/session.ts` (události → zvuky), `client/ui/menu.ts`, `client/ui/messages-{en,cs}.ts`

**Pravidla:**
- **Kontext:** `AudioContext` se vytvoří až po kliknutí na Start. Bez kontextu je každé volání tiché a chyba Web Audio jen zapíše `console.warn` a hra jede dál.
- **Zvuky** syntetizované oscilátory a šumem:
  - `hit`: krátké cvaknutí;
  - `cast`: hluboký „whoosh“ nebo dunění 0,3 s;
  - `death`: pop;
  - `pickup`: blip, výška stoupá s rychle po sobě sebranými krystaly a do 1 s se vrátí;
  - `levelUp`: krátké arpeggio;
  - `castleHit`: tlumený úder, nejvýš jednou za 0,5 s.
- **Hlasitost** master 0,4.
- **Limit:** stejný zvuk nejvýš 4× za 50 ms (`throttle.ts`).
- **Ztlumení:** přepínač v menu a klávesa M. Stav se ukládá do `localStorage` (čtení i zápis v `try/catch`).
- **Texty:**

| Klíč | EN | CS |
|---|---|---|
| `menu.soundOn` | Sound: on | Zvuk: zapnutý |
| `menu.soundOff` | Sound: off | Zvuk: vypnutý |
| `hud.muteKey` | M: mute | M: ztlumit |

- [ ] **Step 1:** Testy v `throttle.test.ts`: `throttles bursts` (5 požadavků během 50 ms → 4 projdou), `allows again after the window`, `sfx is silent without a context` (volání bez kontextu nevyhodí výjimku). Spusť je → FAIL.
- [ ] **Step 2:** Implementuj.
- [ ] **Step 3:** `npm run check`, `npm run build`, `npm run e2e` (konzole musí zůstat bez chyb).
- [ ] **Step 4:** Commit `feat(client): synthesized sound effects with mute`.

## Hotovo, když

Všechny testy procházejí, `sim:run` splňuje cíle z Tasku A a Petr řekne, že se to hraje lépe.
