#!/usr/bin/env bash
# setup_tools.sh <tools_dir>
# Builds the StormLib-based `mpq` extractor and fetches the base Warcraft III data tables that the
# export scripts merge with the map's modifications. Safe to rerun: finished parts are skipped.
set -euo pipefail
T="${1:?usage: setup_tools.sh <tools_dir>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$T"
cd "$T"

if [ ! -f StormLib/build/libstorm.a ]; then
  [ -d StormLib ] || git clone -q --depth 1 https://github.com/ladislav-zezula/StormLib
  # libtommath is not installed in the container, so StormLib must build its bundled copies
  cmake -S StormLib -B StormLib/build -DBUILD_SHARED_LIBS=OFF -DCMAKE_BUILD_TYPE=Release \
        -DSTORM_USE_BUNDLED_LIBRARIES=ON > cmake.log 2>&1 || { tail -20 cmake.log; exit 1; }
  cmake --build StormLib/build -j2 > build.log 2>&1 || { tail -20 build.log; exit 1; }
fi
# (re)build the CLI when it is missing or older than mpq.cpp (older builds created folders via the shell)
if [ ! -x "$T/mpq" ] || [ "$HERE/mpq.cpp" -nt "$T/mpq" ]; then
  g++ -O2 -std=c++17 -o mpq "$HERE/mpq.cpp" -IStormLib/src StormLib/build/libstorm.a -lz -lbz2
fi

B="$T/w3x2lni/data/enUS-1.27.1/mpq"
if [ ! -f "$B/Units/unitdata.slk" ]; then
  [ -d w3x2lni ] || git clone -q --depth 1 --filter=blob:none --sparse https://github.com/sumneko/w3x2lni
  git -C w3x2lni sparse-checkout set data/enUS-1.27.1/mpq/Units data/enUS-1.27.1/mpq/UI
fi

echo "tools ready: $T/mpq"
echo "base data  : $B"
