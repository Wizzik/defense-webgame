# The remaining heroes of the map (2026-11-28)

Petr (order of 2026-11-26, point 4): "the remaining heroes of the map". The map v20.83 has 44 heroes (17 STR,
14 AGI, 13 INT); the game has 8 (`design/heroes.yaml`). This plan ports the other 36 in batches of 4, one PR each.
Better spell graphics stay a separate task (not here).

The map is untrusted data: nothing from it runs; no text is copied (names, roles, descriptions are ours); map codes
and map names live only in `design/`, `tools/` and `docs/` (AGENTS.md, Clean room). The source of every row is the
export `data-source/v20.83/out/` (`heroes.json`, `abilities.json`) and, for script spells, `war3map.j`, named in
each ability's `review` notes like the existing heroes.

## How one hero is added (the checklist of every batch)

1. `design/heroes.yaml`: `id`, `source` (map hero code), `mapName`, our `name` and `role`, three
   `signatureAbilities` and the `ultimate`, `attack` (ranged heroes `rangeScale: 2`, as the others), melee heroes
   `damageTaken: 0.5`, and `power` from the balance pass.
2. `design/abilities.yaml`: one block per spell under a `# <Hero>` heading; `source` is the map ability; numbers from
   the export fields (`DataA`, `area`, `duration` ...) or `{ design: [...] }` with a `review` note that says where each
   value comes from (script functions, lines of `war3map.j` v20.83). Map abilities that are already a shared spell
   (A069, A03U, A0B0, A00P, A00W, A011, A0AD, A09Z, AUcb, A017) get an id of their own for the hero, so a hero never
   holds the same spell twice.
3. `npm run data:build -- --source data-source/v20.83/out --out data/generated` (works in the cloud since
   2026-11-28: the map is in the private repo `Wizzik/wizziks-assets`).
4. `design/audio.yaml`: a cast cue per spell (existing cues), an attack cue per hero; `npm run audio:build`.
5. `client/ui/ability-icons.ts`: a glyph per spell; `client/render/hero-tints.ts`: a tint and a body colour.
6. Model: a row in `HEROES` of `tools/assets-build/manifest.ts` (a KayKit adventurer body with its own parts and
   attack clip), `npm run assets:fetch`, `npm run assets:build`, the license row.
7. Lists: `data/generated.test.ts` (hero ids), `client/render/hero-tints.test.ts` (count), the `hero` parameter in
   `AGENTS.md` and `README.md`, the e2e loop of heroes that play a run (`e2e/game.spec.ts`).
8. Balance: first the damage meter of `sim:run` (each spell about 10-20 %, the ultimate about 25 %, the base attack a
   little more; Petr 2026-11-28), then `power` per hero until the autopilot with no gear wins 1-4 of 20 (skill
   `balance-check`, DECISIONS: Balance target); the old heroes must not move.

## Mapping of the map's spell classes to our kinds

| map class (export `autocast_class`) | our kind |
|---|---|
| `line_skillshot` (Impale, Shock Wave, Carrion Swarm) | `line` (or `cone` for a widening breath) |
| `aoe_around_caster` (War Stomp, Thunder Clap, Fan of Knives) | `nova`; long ones (Bladestorm, Immolation, Starfall, Locust Swarm) `ticking_area` around self |
| `aoe_at_target` (Blizzard, Frost Nova, Monsoon) | `area`; long ones `ticking_area` at the densest crowd |
| `targeted_nuke` (Storm Bolt, Shadow Strike, Chain Lightning) | `instant` / `projectile` / `chain` |
| `passive_on_hit` (Bash, Cleave, Critical Strike, multishot) | `on_hit` (`chance`, `stunSeconds`, `splashRadius`/`splashPercent`, `extraTargets`, new `multiplier`) |
| `buff_aura` (Endurance, Berserk, Bloodlust, Command) | `aura` (self, permanent); an enemy slow aura gets the new `slow` + `radius` |
| `summon` (Mirror Image, Spirit Wolf, Water Elemental) | `summon` (images: `damageDealt`; wards: `damage`, `attackRange`, ...) |
| `heal` | `heal` |
| `transformation` (Avatar, Grow Up), `movement_blink`, evasion, shields, drains, Doom, Hex | **new mechanics**, see the batches |

Timed self buffs of the map (Berserk 12 s every 30 s, Bloodlust 60 s) become permanent auras with smaller numbers
(as Swift Pace and Hunter's Focus did); the map's numbers stay in the review notes.

## New mechanics, by first use

- Batch 1: `on_hit.multiplier` (a critical strike: with `chance` the attack deals x multiplier), `aura.slow` +
  `aura.radius` (enemies near the hero are slowed, like the gear's slow aura).
- Batch 3: `aura.armorBonus` (Devotion); a timed self buff kind `transform` (Avatar, Grow Up: hp, armor, damage for
  some seconds) for the ultimates of Shorter, Icer, Moogul, Magma.
- Batch 5: `aura.lifesteal` (Vampiric), on_hit gold (Bash Gold).
- Batch 6: thorns from a spell (`aura.thorns`, the gear's thorns rule), roots on enemies (a stun with a root look).
- Batch 7: `evasion` (a share of enemy hits missed), a mana-shield like `shield` on the hero.
- Batch 8: wind walk (dash + invisibility), hex (a long stun on the strongest), drain (instant with heal), Doom
  (damage over time on the strongest), Black Arrow (a ward on a kill).
- Batch 9: the odd ones (Eat Time, Change Reality, Transmute, Attribute Bonus): own design, Petr decides.

## Batches (4 heroes per PR; first the ones that fit the kinds we have)

| batch | map code (map name) | id (ours) | attr | melee/ranged | signature 1-3 | ultimate | new |
|---|---|---|---|---|---|---|---|
| 1 | O00M (Tojara) | razorwind | AGI | melee | Kim Strike `aura`, Cleaving Attack `on_hit` splash, Critical Strike `on_hit` crit | X-Trike `area` | crit multiplier |
| 1 | O00Z (Marn Thunderhorn) | dawnhammer | STR | melee | Holy Nova `area` slow, Holy Judgement `ticking_area`, Fan of Light `nova` | Holy Domination `ticking_area` around self | - |
| 1 | O00T (Foster) | frostweaver | INT | ranged | Frost Slice `line` stun, Frost Slap `chain`, Frost Effect `aura` slow | Ice Fall `ticking_area` | aura slow |
| 1 | O00J (Cowboy) | deadeye | AGI | ranged | Bloodlust `aura`, Gunpowder `on_hit` bash, Multishot `on_hit` extraTargets | Mirror Image `summon` images | - |
| 2 | O004 (Kame) | ashsinger | INT | ranged | Shock Fire `line`, Immolation Fire `ticking_area`, Kamezoko `line` | Phoenix Angry `nova` | - |
| 2 | O003 (Buller) | thunderhoof | STR | melee | Shock Tauren `line`, War Stomp `nova` stun, Endurance `aura` | EarthWave `on_cast` | nova stun |
| 2 | O01A (Kazragore) | stormseer | INT | ranged | Monsoon `ticking_area`, Feral Spirit `summon`, All Stop `nova` | Life's Ended `nova` | - |
| 2 | O001 (Imager) | mirrorblade | AGI | melee | Critical Strike `on_hit`, Double Illusion `summon`, Mirror Image `summon` | Bladestorm `ticking_area` | - |
| 3 | O007 (Healer) | lightbinder | INT | ranged | Healing Wave `heal`, Fider Light `nova`, Inner Fire `aura` | Holy Fall `ticking_area` | - |
| 3 | O00O (Magicer) | skyweaver | INT | ranged | Storm Blast `instant`, Regen Aura `heal`, Phoenix `ticking_area` | Angel Cry `ticking_area` | - |
| 3 | O00D (Nikoro) | ironroar | STR | melee | Thunder Impale `line`, War Stomp `nova`, Devotion Aura `aura` | Battle Roar Axe `cone` | armor aura |
| 3 | O00A (Shorter) | stonebeard | STR | melee | Shock Hammer `line`, Thunder Clap `nova`, Bash `on_hit` | Avatar `transform` | transform |
| 4 | O00E (Icer) | | STR | melee | Shock Wave `line`, Cleaving Attack `on_hit`, Ice Stomp `nova` | Avatar `transform` | - |
| 4 | O00Y (Moogul the Sly) | | INT | ranged | Lightning Rain `nova`, Chain Lightning `chain`, Bash `on_hit` | Avatar `transform` | - |
| 4 | O00W (Magma) | | AGI | ranged | Fire Slice `line`, Breath of Fire `cone`, Fire Shield `ticking_area` | Grow Up `transform` | - |
| 4 | O00L (Walker) | | STR | melee | Foot Clap `nova`, Knock Out `instant`, Endurance `aura` | Tornado `line` | - |
| 5 | O00G (Kel Stonebull) | | STR | melee | Rock Down `area`, Carrion Swarm `cone`, Vampiric Fangs `aura` | Inferno `area` | lifesteal aura |
| 5 | O00S (Gold Machine) | | STR | melee | Cloud Poison `ticking_area`, Bash Gold `on_hit`, Immolation `ticking_area` | Cleaving Attack `on_hit` | gold on hit |
| 5 | O00V (DarkLord) | | STR | melee | Advanced `nova`, Dupe Wave `nova`, Endurance `aura` | Hawk `summon` | - |
| 5 | O01D (Overlord) | | STR | melee | Under Sand `line`, Shadow Strike `projectile`, Poison Sting `on_hit` | Irritation `nova` | - |
| 6 | O00P (Hunk Seet) | | AGI | melee | Impale `line`, Carrion Beetles `summon`, Spiked Carapace `aura` thorns | Locust Swarm `ticking_area` | thorns |
| 6 | O016 (Keeper) | | INT | ranged | Cover Root `area` root, Holaroot `instant`, Thorns Aura `aura` | Tranquility `heal` | roots |
| 6 | O005 (Soul Catcher) | | AGI | ranged | Roar `aura`, Catch Soul `summon`, Endurance `aura` | Crazy Soul `ticking_area` | - |
| 6 | O006 (Shamo) | | STR | melee | Wind Slice `line`, Bloodlust `aura`, Shaman Claw `on_hit` crit | Shaman Strike `aura` | - |
| 7 | O00I (Unknown Hunter) | | AGI | melee | Fury `instant`, Kim Strike `aura`, Cleaving Attack `on_hit` | Evasion | evasion |
| 7 | O00K (Slicer) | | AGI | ranged | Lightning Shield `ticking_area`, Electric Auto `on_hit`, Evasion | Thunder Slam `nova` | - |
| 7 | O00R (Speecher) | | STR | melee | Multi Strike `on_hit`, Chain Lightning `chain`, Summon Bear `summon` | Mana Shield | hero shield |
| 7 | O01G (Storm) | | AGI | ranged | Thunder / Storm / Lightning Attack `on_hit` | Rate `aura` | - |
| 8 | O018 (Blade Wizzard) | | AGI | melee | Light Strike `line`, Dragon Strike `area`, Finish Strike `instant` | Wind Walk | wind walk |
| 8 | O002 (Yozshura) | | STR | melee | Move Slice `line`, Aerial hex, Crosin Strike `on_hit` | Bladestorm `ticking_area` | hex |
| 8 | O00Q (Shakti-lar) | | AGI | ranged | Life Drain, Darkshot Aura `aura`, Black Arrow | Doom | drain, doom, black arrow |
| 8 | O009 (Arthas) | | STR | melee | Critical Strike, Cleaving Attack, Multi Strike `on_hit` | Convergence `summon` images | - |
| 9 | O00B (Arashicage) | | STR | melee | Endurance `aura`, Cleaving Attack `on_hit`, Command Aura `aura` | Eat Time | own design |
| 9 | O019 (Pause Man) | | AGI | melee | Crystal Ball `area`, Super Bash `on_hit`, Vampiric `aura` | Change Reality | own design |
| 9 | O01E (LaLa) | | INT | ranged | Summon Zergling, Frost Wyrm, Kodo Beast `summon` | Transmute | own design |
| 9 | O017 (Wizzard) | | INT | ranged | Past Ball `nova`, Fire Time `summon`, Barrage `on_hit` | Capsple Clap `nova` | - |

Batches 2-9 get their ids, names and exact numbers in their own PR (a short addendum here), after Petr played the
batch before. The order may change with his feedback.

## Batch 1 (branch `claude/new-heroes-1`)

| id | name | model (KayKit adventurers) | attack clip |
|---|---|---|---|
| razorwind | Razorwind | Knight, `1H_Sword` + `1H_Sword_Offhand`, `Knight_Helmet` | `Dualwield_Melee_Attack_Slice` |
| dawnhammer | Dawnhammer | Knight, `1H_Sword` + `Rectangle_Shield`, `Knight_Cape` | `1H_Melee_Attack_Chop` |
| frostweaver | Frostweaver | Mage, `1H_Wand` + `Spellbook`, `Mage_Cape` | `Spellcast_Shoot` |
| deadeye | Deadeye | Rogue_Hooded, `1H_Crossbow`, `Rogue_Cape` | `1H_Ranged_Shoot` |

Spells (map numbers in each block's review notes; level rows spread by data-build to 6 / ultimates 3):

- **Razorwind** (O00M): Blade Frenzy (A03I Berserk: +25-125 % attack speed for 12 s every 30 s -> a permanent aura
  of attack speed 0.1-0.5 and move speed 0.08), Sweeping Blades (A01G Cleave: 24-40 % of the hit to enemies within
  450 -> `on_hit` splash), Keen Edge (A03J Critical Strike: 10-35 % chance, x1.25-2.25 -> `on_hit` chance +
  `multiplier`), ultimate Crossing Strike (A03L, script `Trig_XTRIKE_Actions`: leaps to the point and after about
  2.4 s deals 5000 / 10000 within 1000 / 1500 -> `area` at the crowd).
- **Dawnhammer** (O00Z): Holy Burst (A06C Frost Nova: 250-4000 within 300-400 and a slow for 5 s -> `area`),
  Judgement (A06K: a light falls for 3-7 s -> `ticking_area` at the crowd, design numbers), Fan of Light (A06J Fan of
  Knives: 500-4000 within 350-550 -> `nova`), ultimate Dominion (A06B Starfall: 1000 / 2500 every 1.5 s within
  1000 / 1500 for 20 s -> `ticking_area` around the hero).
- **Frostweaver** (O00T): Frost Slice (A05A, script: a wave of 30 every 0.02 s for 0.5 s, hit radius 150-300, the
  hit enemies frozen 0.5 s and struck by a frost nova A059 of 250-5000 -> `line` with a stun), Frost Slap (A05B,
  script: an icy hand hits 500-5000 with splash 200-300 and jumps to a random enemy within 600 for 5-13 s ->
  `chain`), Chill Field (A05E: enemies within 300 lose 10-50 % speed -> `aura` slow), ultimate Ice Fall (A05C
  -> A05D Starfall at the point: 1000 / 3000 every 1.5 s within 600 / 800 for 15 s -> `ticking_area`).
- **Deadeye** (O00J): Hot Blood (A1E0 Bloodlust: +40-250 % attack speed, +25 % move speed for 60 s -> a permanent
  aura, smaller), Blasting Powder (A038 Bash: 10-30 %, +200-2000, stun 1 s on heroes / 2 s -> `on_hit` chance +
  bonus + stun), Fan Fire (A039, script `Trig_Mutip_Shot_Actions`: 1, 2, 3, 4, 5, 7, 9, 11, 15 ... extra shots ->
  `on_hit` `extraTargets`), ultimate Doubles (A004 Mirror Image: 1-6 images, 30 % damage dealt, x3 damage taken,
  15 s -> `summon` images).

Steps (one commit each, `npm run check` before each):
1. sim: `on_hit.multiplier`, `aura.slow` + `aura.radius` (schema, updaters, tests). The digest stays (no old ability
   uses them).
2. data: the four heroes and their 16 spells in `design/`, `data:build`, `audio:build`.
3. client: icons, tints, models (manifest, fetch, build, licenses), lists and docs.
4. balance: `power` per new hero, `sim:run` table in DECISIONS.
5. docs (STATUS, DECISIONS), e2e `webgl2-fallback`, shots of the new heroes, draft PR.

## Batch 2 (branch `claude/new-heroes-2`, stands on batch 1)

| id | name | model (KayKit adventurers) | attack clip |
|---|---|---|---|
| ashsinger | Ashsinger | Mage, `2H_Staff`, `Mage_Cape` | `Spellcast_Raise` |
| thunderhoof | Thunderhoof | Barbarian, `2H_Axe`, `Barbarian_Cape` | `2H_Melee_Attack_Chop` |
| stormseer | Stormseer | Mage, `Spellbook_open`, `Mage_Cape` | `Spellcasting` |
| mirrorblade | Mirrorblade | Rogue, `Knife` + `Knife_Offhand`, `Rogue_Cape` | `Dualwield_Melee_Attack_Slice` |

Spells (map numbers and script lines in each block's review notes):

- **Ashsinger** (O004): Cinder Wave (A00G Shock Wave: 200-2500 in a line 800-1000 long, 300 wide -> `line`), Pyre
  Mantle (A00H Immolation: 50-500 a second within 350, a toggle -> `ticking_area` around the hero, 6 s every 6 s),
  Ember Comet (A04R, script `Trig_KameMove_Actions`: a comet moves 600 a second for 3 s and burns 0.8-4.0 x Int
  every 0.01 s within 300-500 -> a slow wide `line` of design damage), ultimate Phoenix Wrath (A00J, script: 2000 /
  5000 within 600 / 800 and a 5 s slow -> `nova` with slow).
- **Thunderhoof** (O003): Ground Surge (A00K Shock Wave: 200-3200, 350-550 wide -> `line`), Hoofstomp (A04T War
  Stomp: 150-2000 within 250-550, stun 3-5 s -> `nova` with a shorter design stun), Long March (A007 Endurance on
  the hero: +10-30 % move, +10-50 % attack speed -> `aura`), ultimate Aftershock (A00L, scripts `EarthWave` and
  `Dupe_Shock`: more shock waves after War Stomp and Shock Tauren, 1000 / 2500 -> `on_cast`).
- **Stormseer** (O01A): Squall (A07I Monsoon: 100-1800 every 1.5 s within 600 for 12 s -> `ticking_area` around the
  hero), Spirit Pack (A083 Feral Spirit: 2-3 wolves of 100-500 for 60 s -> `summon` wards), Dread Call (A088, script
  `Trig_Death_Prevent_Actions`: no enemy attacks for 5-25 s -> `nova` with a short stun), ultimate Last Rites (A08D:
  2000 / 4000 within 1500 / 2500; the script's execute below that hp is left out -> `nova`).
- **Mirrorblade** (O001): Flash Cut (A006 Critical Strike: 20 / 25 %, x1.75 / x2.25 -> `on_hit` crit), Twin Shades
  (A04D, script `Trig_Double_Ilusion_Actions`: 1-5 copies, 25 % damage, normal damage taken, 30 s -> `summon`
  images), Mirror Dance (A1C3 Mirror Image: 1-6 images, 20 %, x3 taken, 15 s -> `summon` images), ultimate Steel
  Cyclone (A003 Bladestorm, 5 map levels, so design rows of its levels 1, 3, 5 without `source` -> `ticking_area`
  around the hero).
- The plan's "Double Illusion `aura`" was wrong: the export shows a script summon of copies, so it is a `summon`.
- New mechanics: `nova.stunSeconds` (optional; War Stomp, All Stop) and `baseAttack.bounce` (opt-in; the map's
  `mbounce` weapon). No older hero or ability uses them, so the older matrix cases stay.
- Balance by the damage meter (Petr, 2026-11-28, for this and every later batch): spells about 10-20 %, the ultimate
  about 25 %, the base attack a little more (ranged bounce, melee cleave as in the map), then power to 1-4 wins of 20.

## Batch 3 (branch `claude/new-heroes-3`)

| id | name | model (KayKit adventurers) | attack clip |
|---|---|---|---|
| lightbinder | Lightbinder | Mage, `1H_Wand` + `Spellbook_open`, `Mage_Cape` | `Spellcasting` |
| skyweaver | Skyweaver | Mage, `2H_Staff` + `Spellbook`, `Mage_Hat` | `Spellcast_Raise` |
| ironroar | Ironroar | Barbarian, `1H_Axe`, `Barbarian_Hat` + `Barbarian_Cape` | `1H_Melee_Attack_Chop` |
| stonebeard | Stonebeard | Barbarian, `1H_Axe` + `Barbarian_Round_Shield`, `Barbarian_Cape` | `1H_Melee_Attack_Chop` |

- **Lightbinder** (O007): Radiant Pulse (A06A, script `Trig_Fander_Light_Actions`: the whole map -> `nova` 1400),
  Mending Wave (A017 -> `heal`), Inner Flame (A015 Inner Fire -> `aura` damage + armor), ultimate Heaven's Rain (A018
  Starfall -> `ticking_area`).
- **Skyweaver** (O00O): Tempest Bolt (A03U + A03T, script `Trig_Stom_Blast_Actions` -> `area`), Seraph Hymn (A03V,
  script `Trig_Angel_Cry_damage_Actions` -> `ticking_area`), Soothing Aura (A03W, script `Trig_Regen_Aura_Actions` ->
  `heal`), ultimate Phoenix Flock (A03X Locust Swarm -> `ticking_area`).
- **Ironroar** (O00D): Thunder Spikes (A014 Impale -> `line` stun), Earthhurl (A013, script `Trig_StormLand_Actions`
  -> `nova` stun), Iron Ward (AHad Devotion -> `aura` armor), ultimate Roaring Axe (A04Q, scripts Axe / Move_down /
  Roar -> `cone`).
- **Stonebeard** (O00A): Hammer Wave (A00O -> `line`), Rolling Thunder (A00P Thunder Clap -> `nova` slow), Skull Crack
  (A00Q Bash -> `on_hit`), ultimate Titan Form (A00R Avatar, script `Trig_Demon_Actions` -> `transform`).
- New mechanics: `aura.armorBonus`, the kind `transform`. Numbers and balance: DECISIONS, New heroes, batch 3.
