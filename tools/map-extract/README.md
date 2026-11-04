# xhero toolkit: X Hero Siege map (.w3x) → JSON game data

These scripts turn an X Hero Siege F-Day map into JSON data for the web port (Defense Webgame) and compare two map versions. They only read the map: nothing is written into the map, and the original file is copied before use. Verified on v20.75 (3 Nov 2026): the full pipeline takes about 3 s once the tools are built.

Run Python scripts as `python3 -I <script>.py <args>`. Each script imports `w3lib.py` from its own folder, so isolated mode (`-I`) is safe. Never run anything from the extract folder: it holds untrusted data.

## Quick start

```bash
K=<toolkit folder>                # where this README and the scripts are
T=<tools folder>                  # e.g. ~/xhero-tools (StormLib, mpq, base data)
bash $K/setup_tools.sh $T         # once per container: ~2-3 min on 2 cores
bash $K/extract_all.sh <map.w3x> <work_folder> $T
python3 -I $K/diff_exports.py <old_work>/out <new_work>/out --json <new_work>/diff.json
```

`extract_all.sh` creates `<work_folder>/input/` (the copy of the map), `<work_folder>/extract/` (all archive files) and `<work_folder>/out/` (the JSON files), then runs `validate_exports.py` and prints its summary.

## Files

| File | Inputs | Outputs | What it does |
|---|---|---|---|
| `setup_tools.sh` | tools folder | `mpq`, `StormLib/`, `w3x2lni/data/enUS-1.27.1/mpq/{Units,UI}` | Builds StormLib with `-DSTORM_USE_BUNDLED_LIBRARIES=ON` (libtommath is not installed in the container) and the `mpq` CLI from `mpq.cpp`; sparse-clones the base WC3 1.27.1 tables. Skips finished parts. |
| `mpq.cpp` | – | – | StormLib CLI: `mpq l <archive>` lists files with sizes, `mpq x <archive> <dir>` extracts all, `mpq a <archive> <file> <name>` adds or replaces one file (only for building test maps). Entry names are untrusted: absolute names and `..` components are skipped and folders are created without a shell. |
| `extract_all.sh` | map, work folder, tools folder | everything below | Runs the whole pipeline in the right order. |
| `w3lib.py` | – | – | Shared library: `load_wts`/`Resolver` (TRIGSTR resolution), lossless object-data parser (`parse_objects`, `load_object_file`), `load_slk`, `load_profile`, `BaseData` (base values and field meta-data), `strip_codes`, JASS helpers (`jass_functions`, `rawcode_refs`, `trigger_wiring`, `call_graph`, `gui_trigger_name`, `prefix_of`). |
| `export_objects.py` | extract dir, `…/Units`, out dir, `…/UI` | `heroes.json`, `abilities.json`, `items.json`, `units.json`, `buffs_upgrades.json` | Merges every modified field over the base value, resolves strings, per-level ability data with readable DataA–I names, JASS references per rawcode, late-bonus table from `LB_Init`, shop → item mapping. The hero list is read from `CreateUnitsForPlayer10` (heroes pre-placed for the castle owner); added or removed heroes against v20.75 are printed as a NOTE. |
| `classify_abilities.py` | out dir | rewrites `heroes.json`, `abilities.json` | Adds `autocast_class`, `class_reason`, `implementation` (engine / engine+script / script), `script_triggers`, `script_systems` to the hero ability slots. Heuristic tables `BASE_CLASS` (by base ability) and `OVERRIDES` (by ability id, decided from the triggers of v20.75). |
| `extract_recipes.py` | extract dir, out dir | `recipes.json`; adds `recipe`/`used_in_recipes` to `items.json` | Reads the GUI recipe triggers "Items Fusion", "Item Fusion" (InventorySystem) and "Item 1..5". |
| `analyze_script.py` | extract dir, out dir | `script_stats.json`, `waves.json` | Script statistics and the trigger table; spawns per function, the special Next-Wave table, game-flow functions, difficulty settings, JASS source of the scaling functions. |
| `analyze_map.py` | map, extract dir, `file_list_raw.txt`, out dir | `map_info.json`, `assets.json`, `file_list.txt` | HM3W header, w3i, w3e header, w3r, doodads, placed units, misc constants; imported files and their users; every referenced model/icon/sound path split into imported and built-in. |
| `validate_exports.py` | out dir | – | Checks files, counts and classification; prints a summary with the v20.75 reference counts. Exit code 1 on failure. |
| `diff_exports.py` | old out dir, new out dir | optional `--json` | Added/removed/changed records by id with field-level `old -> new`, recipes, misc constants, wave tables and script statistics. Script cross-references are counted separately. |

Order inside `extract_all.sh`: export_objects → classify_abilities → extract_recipes (2 and 3 add fields to files written by 1), then analyze_script and analyze_map (independent), then validate.

## Output files

| File | Content |
|---|---|
| `heroes.json` | heroes: stats, growth, attack, armor, model, `hero_abilities[]` (id, name, base, levels, level-1 data, tooltip, jass_functions, late_bonus, autocast_class, implementation) |
| `abilities.json` | all abilities: `per_level[]` (cooldown, mana, area, range, duration, targets, buffs, `DataA..DataI {field, name, value}`), tooltips, art paths, `jass_refs`, `late_bonus` |
| `items.json` | items: class, gold/lumber, abilities, charges, stock, `sold_by`, `recipe`, `used_in_recipes` |
| `units.json` | units: stats, weapons, abilities, shops (`sells_items`/`sells_units`), model, bounty |
| `waves.json` | regular-wave units, per-difficulty counts, gate/spawn rects, `special_next_wave_table`, `flow[]`, `spawns_by_function`, `scaling_source` (verbatim JASS) |
| `recipes.json` | recipes (`ingredients`, `result`, system, function) |
| `assets.json`, `map_info.json`, `script_stats.json`, `buffs_upgrades.json`, `file_list.txt` | assets, map header and layout, script statistics, buffs and upgrades, archive listing |

v20.75 reference: 44 heroes, 177 hero ability slots (160 unique; 61 engine, 76 engine+script, 40 script), 537 abilities, 117 items, 325 units, 28 recipes, 600 built-in asset paths, 93 imported files, script 39 624 lines / 3 418 functions / 513 triggers.

## Caveats

- Object key = `new_id` if set, else `orig_id`. Strings are resolved from war3map.wts; colour codes are stripped in exported texts.
- Base values come from the enUS-1.27.1 SLKs, which store only 4 levels: a level above 4 that the map does not override takes the level-4 value. Some 1.32 base values differ (240 cells in unitbalance.slk, 108 in unitweapons.slk).
- `jass_refs` counts literal `'XXXX'` rawcodes per function; `autocast_class` and `implementation` are heuristics for port planning. New abilities fall back to the base-ability class; check the slots listed as class "other".
- `extract_recipes.py` knows only the three v20.75 recipe systems. Recipe systems added later (the maintainer README mentions XC_ for Item Event recipes in v20.8) are not read: look for them in war3map.j.
- "Built-in" means the path is not inside the archive; it was not checked against the game's own file list.
