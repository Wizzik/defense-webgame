# Multiplayer spike: prováděcí plán

> **Pro agenty:** POVINNÝ PODSKILL: superpowers:executing-plans (doporučeno nativní provedení) nebo superpowers:subagent-driven-development. Kroky mají zaškrtávací políčka (`- [ ]`).

**Cíl:** Ověřit bitový determinismus simulace mezi V8, SpiderMonkey a JavaScriptCore, sepsat všechna místa s jedním hrdinou s pořadím migrace a změřit první lockstep spojení přes PeerJS, bez změny hry.

**Architektura:** Širší `stateHash` je měřidlo. Čistý modul matice běhů (`client/determinism/matrix.ts`) běží v Node i v prohlížeči; Playwright porovná oba výsledky v Chromiu, Firefoxu a WebKitu. Síť je ve třech vrstvách: čistý protokol a lockstep (testované v paměti), tenký obal PeerJS a ladicí stránka `/net-spike/` s 2D canvasem.

**Technologie:** TypeScript, Vitest, Playwright (chromium, firefox, webkit), Vite (víc vstupních stránek), PeerJS 1.5.5.

**Spec:** `docs/superpowers/specs/2026-11-20-multiplayer-spike-design.md` (krátký, čti celý).

## Globální omezení

- `AGENTS.md`: `sim/` čisté a deterministické; `Run.step()` ani `stateHash` nealokují; kód a komentáře anglicky, texty stránek EN stačí (ladicí stránky, ne hra).
- `git diff main -- sim` smí obsahovat jen `sim/hash.ts` a `sim/hash.test.ts`. Balanc a chování hry se nemění.
- Síťový kód jen v `client/net/` a `client/net-spike/`; nic z nich neimportuje `sim/` kromě veřejného `sim/index.ts`.
- `peerjs` přesně `1.5.5` v `dependencies`, zamčené v `package-lock.json`.
- Ladicí stránky tmavé (pozadí `#141a24`, text `#c9d3e0`, akcent modrošedý `#7f9cc0`), žádná oranžová.
- `npm run check` před každým commitem; Conventional Commits; identita `Claude <noreply@anthropic.com>` a trailery sezení; po každém úkolu push větve `multiplayer-spike`.

## Na co se zaměřit při kontrole

1. **Hash nesmí alokovat ani číst neživé sloty jinak než dnes:** mrtvý projektil se starými souřadnicemi nesmí měnit hash. Test v Úkolu 1.
2. **Strop kroků vs. konec běhu v matici:** běh, který skončí před stropem, musí mít v Node i v prohlížeči stejný počet checkpointů (poslední checkpoint je vždy po posledním kroku). Test v Úkolu 2.
3. **Lockstep při přeházeném a zpožděném doručení:** vstupy, které dorazí v jiném pořadí nebo dvakrát, nesmí udělat krok dvakrát ani vynechat. Test v Úkolu 4.
4. **Vadná zpráva od peera:** neznámé `t`, chybějící pole, `NaN`, řetězec místo čísla, obří `k` se zahodí a započítají, nikdy nevyhodí výjimku do smyčky. Test v Úkolu 4.
5. **Base path na Pages:** `/defense-webgame/determinism/` a `/defense-webgame/net-spike/` musí po buildu s `BASE_PATH` existovat a načíst svůj skript. Kontrola v Úkolech 3 a 5 (`ls dist/determinism dist/net-spike`).

---

### Úkol 1: Širší hash stavu

**Soubory:**
- Upravit: `sim/hash.ts` (na konec `stateHash`, před `return`)
- Test: `sim/hash.test.ts`

**Rozhraní:**
- Produkuje: `stateHash(run: Run): number` se stejnou signaturou, nově citlivé na pole níže.

- [ ] **Krok 1: Napiš padající testy** do `describe("stateHash")`:

```ts
it.each([
  ["gold", (run: Run) => { run.gold++; }],
  ["chest price", (run: Run) => { run.chestPriceRaw += 1; }],
  ["chests opened", (run: Run) => { run.chestsOpened++; }],
  ["bosses killed", (run: Run) => { run.bossesKilled++; }],
  ["chest rng", (run: Run) => { run.chestRng.next(); }],
  ["chest place", (run: Run) => { run.chests.x[0] += 1; }],
  ["crystal", (run: Run) => { run.crystals.spawn(10, 0, 0); }],
  ["coin", (run: Run) => { run.coins.spawn(5, 0, 0); }],
  ["heart", (run: Run) => { run.hearts.spawn(1, 0, 0); }],
])("covers %s", (_name, change) => {
  const run = createRun(gameData(), { seed: 5 });
  const before = stateHash(run);
  change(run);
  expect(stateHash(run)).not.toBe(before);
});
```

Přidej ještě: `"covers a living projectile"` (po 300 krocích s `hero: "sparkshot"` a autopilotem najdi živý projektil, změň jeho `x`), `"covers a living ally"` (`hero: "serpent-shaman"`, ~600 kroků s autopilotem, živý ward, změň `x`), `"covers the card offer"` (krokuj s `NO_INPUT`, dokud `run.state === "levelUp"`, pak vyměň `run.offer.cards[0]` za `run.offer.cards[1]`), `"ignores a dead projectile slot"` (najdi `alive[i] === 0`, změň `x[i]`, hash se nezmění). Názvy metod úložišť (`spawn`, `next`) ověř v `sim/crystals.ts` a `sim/rng.ts` a použij skutečné.

- [ ] **Krok 2:** `npx vitest run sim/hash.test.ts` – nové testy padají.
- [ ] **Krok 3: Rozšiř `stateHash`.** Smíchej v pořadí: `gold` (float), `chestPriceRaw`, `chestsOpened`, `bossesKilled`, `openChest`, `chestRng.state`; všechny truhly (`chests.x/y`); pro `projectiles`, `allies`, `crystals`, `coins`, `hearts` každý živý slot: index a všechna pole úložiště kromě `prevX/prevY` (předchozí poloha je jen pro vykreslení); `offer` (0 když `null`, jinak počet karet a pro každou kartu `kind` jako číslo 0/1/2 a její číselná pole); `chestOffer` (0 když `null`, jinak `slot`, `item`, `action` každé karty). Smyčky přes pole, žádné `for…of` nad nově vytvořenými poli, žádná alokace.
- [ ] **Krok 4:** `npm run check` – vše zelené (stávající testy determinismu a replaye musí dál projít).
- [ ] **Krok 5: Commit** `feat(sim): hash covers projectiles, allies, pickups, chests and offers`.

### Úkol 2: Matice determinismu (čistý modul a Node reference)

**Soubory:**
- Vytvořit: `client/determinism/matrix.ts`, `client/determinism/matrix.test.ts`
- Upravit: `vitest.config.ts`, jen pokud nesbírá testy z `client/` (ověř)

**Rozhraní:**
- Konzumuje: `createRun`, `botInput`, `stateHash`, `NO_INPUT` ze `sim/index.ts`; `gearPreset(data, heroId, preset)` z `tools/sim-run/gear-presets.ts`.
- Produkuje:
  - `interface MatrixCase { id: string; hero: string; seed: number; startPhase?: number; durationSeconds?: number; gear: "none" | "full"; maxTicks: number }`
  - `function matrixCases(data: GameData): MatrixCase[]` (přesně tabulka spec 5.2: nejdřív `h-<heroId>` pro hrdiny v pořadí `data.heroes`, pak `p6, p11, p16, p21`; funkce, protože ids hrdinů jsou v datech)
  - `const CHECKPOINT_EVERY = 300`
  - `interface CaseResult { id: string; ticks: number; state: RunState; checkpoints: number[] }`
  - `function runCase(data: GameData, c: MatrixCase, every?: number): CaseResult`
  - `function matrixDigest(results: readonly CaseResult[]): string` (FNV-1a přes `checkpoints` všech případů v pořadí, 8 malých hex znaků, doplněno nulami)
  - `function firstDifference(a: readonly CaseResult[], b: readonly CaseResult[]): { id: string; index: number } | null`

- [ ] **Krok 1: Napiš testy** (`matrix.test.ts`, data z `sim/testing/game-data`):
  - `matrixCases` vrátí 12 případů, ids `h-stonehorn` … a `p6, p11, p16, p21`, ids unikátní;
  - `runCase` pro `{ id: "t", hero: "stonehorn", seed: 1, gear: "none", maxTicks: 650 }` vrátí `ticks === 650` a `checkpoints.length === 3` (kroky 300, 600 a poslední 650);
  - běh, který skončí dřív (případ s `durationSeconds: 5` a `startPhase: 21`, `maxTicks: 30000`, hrdina bez výbavy, **ověř, že opravdu skončí**; jinak použij idle vstup přes vlastní volbu `idle?: true` v `MatrixCase`), má poslední checkpoint po posledním kroku a `state` je `won` nebo `lost`;
  - dvě volání `runCase` se stejným případem dají stejné `checkpoints`;
  - `matrixDigest` vrátí `/^[0-9a-f]{8}$/` a liší se, když se změní jeden checkpoint;
  - `firstDifference` najde `{ id, index }` prvního rozdílu a `null` pro shodu.
- [ ] **Krok 2:** `npx vitest run client/determinism` – padá (modul chybí).
- [ ] **Krok 3: Implementuj `matrix.ts`.** Jeden `TickInput` na případ znovu použitý v každém kroku; checkpoint po každém `every`-tém kroku a po posledním (bez duplicity, když se kryjí). Žádný DOM, žádný `performance`.
- [ ] **Krok 4:** testy projdou; změř a zapiš do commitu dobu celé matice v Node (`npx tsx -e` se smyčkou přes `matrixCases`). Nad 90 s sniž `maxTicks` případů `h-*` na 9000 a uprav spec 5.2.
- [ ] **Krok 5: Commit** `test(determinism): run matrix with checkpoint hashes`.

### Úkol 3: Stránka `/determinism/` a Playwright napříč enginy

**Soubory:**
- Vytvořit: `client/determinism/index.html`, `client/determinism/main.ts`, `e2e/determinism.spec.ts`
- Upravit: `vite.config.ts` (vstup `determinism`), `playwright.config.ts`, `.github/workflows/ci.yml`, `AGENTS.md` (sekce Commands a Debugging: stránka a projekty)

**Rozhraní:**
- Konzumuje: Úkol 2 (`matrixCases`, `runCase`, `matrixDigest`, `firstDifference`), `loadGameData()` z `client/game/data.ts`.
- Produkuje: `window.__determinism: { done: boolean; results: CaseResult[]; digest: string; ms: number }`; URL `?case=<id>` (jen ten případ) a `?every=<n>` (checkpoint každých n kroků, výchozí 300).

- [ ] **Krok 1: Napiš spec `e2e/determinism.spec.ts`:** v Node spočítá referenci (`matrixCases(gameData())`, případně filtr), otevře `/determinism/`, čeká `window.__determinism?.done` (timeout 170 s), porovná `firstDifference(reference, page)`; při rozdílu `expect` hlásí `id`, `index` a počet kroků (`index × every`). Druhý test: `?case=p16&every=1` se shoduje s Node po prvních 600 krocích (případ s `maxTicks` zkráceným přes `?ticks=600`; přidej tento parametr).
- [ ] **Krok 2: Playwright projekty.** Dnešní `webgl2-fallback` a `webgpu-swiftshader` dostanou `testIgnore: ["**/determinism.spec.ts"]` (a dál ignorují shots, jen bez `SHOTS`). Nové: `sim-chromium` (`executablePath` jako dnes), `sim-firefox` (`browserName: "firefox"`), `sim-webkit` (`browserName: "webkit"`), všechny s `testMatch: "**/determinism.spec.ts"`.
- [ ] **Krok 3: Stránka.** `index.html` podle `client/spike/index.html` (tmavá, bez favicon requestu); `main.ts` počítá případy po jednom přes `setTimeout(…, 0)` mezi nimi, aby stránka žila; ukazuje průběh (`n / 12`), čas, otisk velkým písmem (monospace 48 px) a tabulku případů (id, kroky, stav, poslední hash). Přidej vstup do `vite.config.ts`.
- [ ] **Krok 4: Ověř lokálně:** `npx playwright test --project=sim-chromium` projde; `npx playwright test --project=webgl2-fallback` projde (nic se nerozbilo); `BASE_PATH=/defense-webgame/ npm run build && ls dist/determinism` ukáže `index.html`.
- [ ] **Krok 5: CI.** V `ci.yml` `npx playwright install --with-deps chromium firefox webkit`; klíč cache rozšiř o `-ffwk`. Projekty `sim-firefox` a `sim-webkit` běží jen v CI (kontejner nemá jejich prohlížeče; zapiš do `AGENTS.md`).
- [ ] **Krok 6: Commit** `test(e2e): cross-engine determinism page and projects`; push; zkontroluj CI (`gh api repos/Wizzik/defense-webgame/actions/runs?branch=multiplayer-spike`). Když Firefox nebo WebKit nesedí: `?case=<id>&every=1` najde krok; systematické ladění (`superpowers:systematic-debugging`), oprava v samostatném commitu `fix(sim): …` a pravidlo z ní do `docs/DECISIONS.md` (Engineering). Když oprava mění výsledky v Node, zastav a zapiš to do zprávy jako otevřený bod pro Petra.

### Úkol 4: Protokol a lockstep (čisté, testované v paměti)

**Soubory:**
- Vytvořit: `client/net/protocol.ts`, `client/net/protocol.test.ts`, `client/net/lockstep.ts`, `client/net/lockstep.test.ts`

**Rozhraní:**
- Produkuje (`protocol.ts`):
  - `const PROTOCOL_VERSION = 1`
  - `type NetMessage = { t: "hello"; v: number; seed: number; hero: string } | { t: "in"; k: number; mx: number; my: number; c: number; a: number } | { t: "hash"; k: number; h: number } | { t: "ping"; n: number; at: number } | { t: "pong"; n: number; at: number } | { t: "bye" }`
  - `function decodeMessage(raw: unknown): NetMessage | null` (validuje typy, celá čísla tam, kde jsou: `k`, `c`, `a`, `h` jako uint32; `mx`, `my` ∈ {-1, 0, 1}; `c` ∈ [-1, 2]; `a` ∈ [0, 15]; `k` ∈ [0, 1 000 000]; `hero` max 32 znaků)
  - `function inputMessage(k: number, input: TickInput): NetMessage`, `function toInput(m: Extract<NetMessage, { t: "in" }>, out: TickInput): TickInput`
- Produkuje (`lockstep.ts`):
  - `const INPUT_DELAY = 3`, `const HASH_EVERY = 30`
  - `class Lockstep` s `constructor(players: 2, local: 0 | 1)`:
    - `queueLocal(input: TickInput): number` – uloží kopii vstupu pro krok `nextLocal` (začíná na `INPUT_DELAY`; kroky `0 … INPUT_DELAY-1` mají `NO_INPUT` pro oba hráče) a vrátí jeho `k` (volající ho odešle);
    - `receive(player: 0 | 1, k: number, input: TickInput): void` – duplicitu ignoruje, budoucí i přeházené uloží;
    - `ready(): boolean` – jsou vstupy obou hráčů pro `tick`;
    - `take(out: TickInput[]): number` – naplní vstupy kroku `tick`, posune `tick`, vrátí provedený krok;
    - `recordHash(player: 0 | 1, k: number, h: number): "ok" | "pending" | "desync"`;
    - čítače `stalls` (volání `ready()` s výsledkem `false`) a `rejected`.
  - Vstupy drží kruhový buffer 256 kroků na hráče (bez alokace v kroku); vstup dál než 256 kroků dopředu = `rejected++`.

- [ ] **Krok 1: Testy protokolu:** kulatá cesta každé zprávy přes `JSON.parse(JSON.stringify(m))`; `decodeMessage` vrátí `null` pro `null`, `"x"`, `{}`, `{ t: "nope" }`, `{ t: "in", k: "1", … }`, `NaN`, `mx: 2`, `k: 2e6`, `hero` 100 znaků.
- [ ] **Krok 2: Testy lockstepu:**
  - `"two peers stay in sync over 3000 steps"`: dvě instance `Lockstep` a dva `Run` (`seed: 7`, `hero: "stonehorn"`), paměťová fronta s náhodným zpožděním 0–5 kroků z `Rng(1)` a náhodným pořadím doručení; hráč 0 posílá `botInput`, hráč 1 náhodné WASD; krok provádí vstup hráče 0 (jako stránka ve spiku); každých `HASH_EVERY` kroků výměna hashe; na konci `run0.tick === run1.tick === 3000`, `recordHash` nikdy `desync`, oba hashe stejné;
  - `"duplicate and reordered inputs do not double-step"`;
  - `"detects a desync"`: druhému `Run` po 100 krocích `run.gold += 1`, do `HASH_EVERY` kroků `recordHash` vrátí `desync`;
  - `"first INPUT_DELAY steps run with NO_INPUT"`; `"stalls count when the peer is late"`.
- [ ] **Krok 3:** testy padají; **Krok 4:** implementuj; **Krok 5:** `npm run check` zelené.
- [ ] **Krok 6: Commit** `feat(net): lockstep and message protocol`.

### Úkol 5: PeerJS spojení a stránka `/net-spike/`

**Soubory:**
- Upravit: `package.json`, `package-lock.json` (`npm install --save-exact peerjs@1.5.5`)
- Vytvořit: `client/net/peer-link.ts`, `client/net/room-code.ts`, `client/net/room-code.test.ts`, `client/net-spike/index.html`, `client/net-spike/main.ts`, `client/net-spike/top-view.ts`
- Upravit: `vite.config.ts` (vstup `net` → `client/net-spike/index.html`; Vite zachová cestu, stránka je na `/net-spike/`), `AGENTS.md` (stránka a `window.__net`)

**Rozhraní:**
- Konzumuje: Úkol 4 (`Lockstep`, `decodeMessage`, `inputMessage`, `toInput`, `INPUT_DELAY`, `HASH_EVERY`), `createRun`, `botInput`, `stateHash`, `TICK_SECONDS` ze `sim/index.ts`, `FixedStepLoop` z `client/game/loop.ts`, `Keyboard` z `client/game/keyboard.ts`.
- Produkuje:
  - `function newRoomCode(random: () => number): string` → `"dwg-" + 6 znaků z "abcdefghjkmnpqrstuvwxyz23456789"`; `function isRoomCode(s: string): boolean`
  - `interface PeerLink { send(m: NetMessage): void; onMessage(cb: (m: NetMessage) => void): void; onClose(cb: (reason: string) => void): void; close(): void }`
  - `function hostRoom(code: string): Promise<PeerLink>` (čeká na prvního hosta, další odmítne zavřením spojení), `function joinRoom(code: string): Promise<PeerLink>`; spojení `{ reliable: true, serialization: "json" }`; zprávy procházejí `decodeMessage`, `null` se počítá do `rejected` a zahodí.
  - `window.__net: { role: "host" | "guest" | null; connected: boolean; tick: number; rttMedian: number; rttP95: number; stalls: number; stallsPerMinute: number; lastMatchedHash: number; desyncAt: number | null; rejected: number }`

- [ ] **Krok 1: Test `room-code.test.ts`:** formát, abeceda, `isRoomCode` odmítne `dwg-ABC123`, `dwg-12345`, `xyz-abcdef`.
- [ ] **Krok 2: `peer-link.ts`:** `import Peer from "peerjs"`; host `new Peer(code)`, host-guest `new Peer()` a `peer.connect(code, …)`; chyby PeerJS (`unavailable-id`: kód obsazený → nový kód; `peer-unavailable`: místnost neexistuje) převeď na čitelné zprávy. Bez testu (síť), kontrola v Kroku 5.
- [ ] **Krok 3: Stránka.** Tmavá; *Host* vytvoří kód a ukáže odkaz `…/net-spike/?join=<kód>`; `?join=` nebo pole + *Join* připojí. Po spojení host pošle `hello { v: 1, seed: náhodný, hero: "stonehorn" }`, oba vytvoří `Run`. Smyčka `requestAnimationFrame` + `FixedStepLoop(TICK_SECONDS, 4)`: v každém kroku `queueLocal` (host: v `levelUp`/`chest` `botInput`, jinak WASD z `Keyboard`; host-guest: WASD) a odeslání `in`; dokud `ready()`, `take` a `run.step(inputs[0])`; po kroku dělitelném `HASH_EVERY` odeslat `hash` a porovnat; ping každou sekundu, RTT z posledních 60 pongů. `top-view.ts`: canvas 600×600, svět `rules.arena` přepočtený na canvas, hrad modrošedý kruh, hrdina světlý, nepřátelé tečky, boss větší. Panel s hodnotami `window.__net`. Desync: červený pruh s krokem, smyčka stojí. `bye` a ztráta spojení: pruh „disconnected“.
- [ ] **Krok 4:** `npm run check`, `npm run build`, `BASE_PATH=/defense-webgame/ npm run build && ls dist/net-spike`.
- [ ] **Krok 5: Ruční zkouška v kontejneru** (pokud síť propustí `0.peerjs.com`): dva taby headless Chromia přes Playwright skript v `/tmp` (ne v repu), host a host-guest, 60 s; zapiš `window.__net` obou. Když síť neprojde, zapiš to do zprávy; ověří Petr.
- [ ] **Krok 6: Commit** `feat(net): PeerJS room and lockstep spike page`.

### Úkol 6: Soupis míst s jedním hrdinou

**Soubory:**
- Vytvořit: `docs/multiplayer/single-hero-inventory.md`

- [ ] **Krok 1: Sesbírej výskyty skriptem v `/tmp`** (ne v repu): pro `run.hero`, `run.abilities`, `run.gear`, `run.buffs`, `run.gold`, `run.offer`, `run.chestOffer`, `run.openChest`, `run.ultimateAuto`, `run.ultimateRequested`, `run.shieldTicks`, `run.heroIndex`, `run.allies`, `run.projectiles`, `state === "levelUp"`, `state === "chest"`, `pendingLevelUps`, `TickInput` počty po souborech v `sim/`, `client/`, `meta/`, `tools/` (bez testů zvlášť, testy zvlášť).
- [ ] **Krok 2: Přečti každý soubor `sim/` s výskytem** a zařaď ho do kategorie spec 5.3 bod 2. Pro každou řádku: soubor a funkce, předpoklad, navržená změna, Petrovo pravidlo (spec kapitola 3), velikost S (< 30 řádků), M (< 150), L.
- [ ] **Krok 3: Napiš dokument** podle spec 5.3 (cílový tvar, tabulka, pořadí migrace s odhadem chatů, co mají obtížnosti a progrese navrhnout rovnou). V pořadí migrace ke každému kroku napiš, jaký test dokazuje, že hra jednoho hráče funguje beze změny (např. `sim:run --hero all --seeds 1-20` dá stejné výsledky jako `main`, nebo stejný otisk matice z Úkolu 2: matice je pro refaktor regresní test).
- [ ] **Krok 4: Commit** `docs(multiplayer): single-hero inventory and migration order`.

### Úkol 7: Zpráva, STATUS, DECISIONS, PR

**Soubory:**
- Vytvořit: `docs/multiplayer/spike-report.md`
- Upravit: `docs/STATUS.md` (nová sekce nahoře), `docs/DECISIONS.md` (Engineering: matice jako regresní test refaktoru, `INPUT_DELAY`, PeerJS verze)

- [ ] **Krok 1: Zpráva** podle spec 5.5: výsledky matice (CI odkaz na běh, otisk, časy v enginech), velikost a cena hashe, Úkol 5 krok 5, souhrn soupisu (počet řádek S/M/L, odhad chatů), otevřené body. Sekce „Co Petr udělá“: (a) otevřít `/determinism/` v Chrome a Firefoxu a porovnat otisk; (b) `/net-spike/` Chrome + Firefox na jednom počítači 10 minut; (c) dva počítače v různých sítích 10 minut; do chatu poslat hodnoty z panelu.
- [ ] **Krok 2: STATUS a DECISIONS**; zrcadli `docs/STATUS.md` do projektu claude.ai (`claude/STATUS.md`), spec a plán do `claude/specs/` a `claude/plans/`.
- [ ] **Krok 3: Závěrečná kontrola** celé větve proti specu (`git diff main -- sim` jen hash; brána spec kapitola 8); `npm run check`, `npm run build`, e2e `webgl2-fallback` a `sim-chromium`.
- [ ] **Krok 4: Commit, push, PR** proti `main` (REST: `gh api -X POST repos/Wizzik/defense-webgame/pulls`), počkat na CI včetně `sim-firefox` a `sim-webkit`. Slučuje se na Petrovo slovo.
