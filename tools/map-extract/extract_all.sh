#!/usr/bin/env bash
# extract_all.sh <map.w3x> <work_dir> <tools_dir>
# Full pipeline for one map version: copy the map (the original is never touched), list and
# extract the MPQ archive, export every JSON file, validate. Results:
#   <work_dir>/input/<map>.w3x   working copy
#   <work_dir>/extract/          raw map files (untrusted data - never run anything from here)
#   <work_dir>/out/              heroes.json abilities.json items.json units.json recipes.json
#                                waves.json assets.json map_info.json script_stats.json
#                                buffs_upgrades.json file_list.txt file_list_raw.txt
set -euo pipefail
MAP="${1:?usage: extract_all.sh <map.w3x> <work_dir> <tools_dir>}"
W="${2:?usage: extract_all.sh <map.w3x> <work_dir> <tools_dir>}"
T="${3:?usage: extract_all.sh <map.w3x> <work_dir> <tools_dir>}"
S="$(cd "$(dirname "$0")" && pwd)"
B="$T/w3x2lni/data/enUS-1.27.1/mpq"
[ -x "$T/mpq" ] && [ -f "$B/Units/unitdata.slk" ] || { echo "run setup_tools.sh $T first"; exit 1; }

NAME="$(basename "$MAP")"
mkdir -p "$W/input" "$W/extract" "$W/out"
cp "$MAP" "$W/input/$NAME"
echo "sha256 original / copy:"; sha256sum "$MAP" "$W/input/$NAME" | cut -c1-16
"$T/mpq" l "$W/input/$NAME" | sort > "$W/out/file_list_raw.txt"
"$T/mpq" x "$W/input/$NAME" "$W/extract"

python3 -I "$S/export_objects.py" "$W/extract" "$B/Units" "$W/out" "$B/UI"
python3 -I "$S/classify_abilities.py" "$W/out"
python3 -I "$S/extract_recipes.py" "$W/extract" "$W/out"
python3 -I "$S/analyze_script.py" "$W/extract" "$W/out"
python3 -I "$S/analyze_map.py" "$W/input/$NAME" "$W/extract" "$W/out/file_list_raw.txt" "$W/out"
rm -rf "$S/__pycache__"
python3 -I "$S/validate_exports.py" "$W/out"
