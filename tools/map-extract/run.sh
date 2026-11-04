#!/usr/bin/env bash
# run.sh <map.w3x> <label>
# Extracts a map version into data-source/<label>/{input,extract,out}/ (untracked).
set -euo pipefail
MAP="${1:-}"
LABEL="${2:-}"
if [ -z "$MAP" ] || [ -z "$LABEL" ]; then
  echo "usage: run.sh <map.w3x> <label>" >&2
  exit 2
fi
HERE="$(cd "$(dirname "$0")" && pwd)"
bash "$HERE/setup_tools.sh" "$PWD/xhero/tools"
bash "$HERE/extract_all.sh" "$MAP" "$PWD/data-source/$LABEL" "$PWD/xhero/tools"
