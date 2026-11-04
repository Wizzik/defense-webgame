#!/usr/bin/env python3
"""validate_exports.py - sanity check and compact summary of one export folder.

usage: python3 -I validate_exports.py <out_dir>

Checks that every expected file exists and parses, that the main lists are not empty, that each
record has an id and that every hero ability slot was classified. Prints one summary block with
the reference counts of v20.75 next to the current ones (a new map version may legitimately
differ). Exit code 1 if a check fails.
"""
import json
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import w3lib  # noqa: E402

FILES = ['heroes.json', 'abilities.json', 'items.json', 'units.json', 'recipes.json', 'waves.json',
         'assets.json', 'map_info.json', 'script_stats.json', 'buffs_upgrades.json']
REF_V2075 = {'heroes': 44, 'hero_slots': 177, 'abilities': 537, 'items': 117, 'units': 325,
             'recipes': 28}


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    out = sys.argv[1]
    bad, data = [], {}
    for f in FILES:
        p = os.path.join(out, f)
        if not os.path.exists(p):
            bad.append('missing ' + f)
            continue
        try:
            data[f] = json.load(open(p, encoding='utf-8'))
        except ValueError as e:
            bad.append('%s does not parse: %s' % (f, e))
    if not os.path.exists(os.path.join(out, 'file_list.txt')):
        bad.append('missing file_list.txt')

    heroes = data.get('heroes.json', [])
    abilities = data.get('abilities.json', [])
    items = data.get('items.json', [])
    units = data.get('units.json', [])
    recipes = data.get('recipes.json', {}).get('recipes', [])
    for name, lst in (('heroes', heroes), ('abilities', abilities), ('items', items), ('units', units)):
        if not lst:
            bad.append(name + ' is empty')
        elif any('id' not in r for r in lst):
            bad.append(name + ': a record has no id')
    slots = [s for h in heroes for s in h.get('hero_abilities', [])]
    if heroes and not slots:
        bad.append('heroes have no hero_abilities')
    unclassified = [s['id'] for s in slots if not s.get('autocast_class')]
    if unclassified:
        bad.append('%d hero ability slots without autocast_class (run classify_abilities.py)'
                   % len(unclassified))

    w3i = data.get('map_info.json', {}).get('w3i', {})
    stats = data.get('script_stats.json', {})
    assets = data.get('assets.json', {})
    counts = {'heroes': len(heroes), 'hero_slots': len(slots), 'abilities': len(abilities),
              'items': len(items), 'units': len(units), 'recipes': len(recipes)}
    print('map      :', w3lib.strip_codes(w3i.get('name')), '| author:', w3i.get('author'),
          '| w3i format', w3i.get('format_version'))
    print('counts   :', ', '.join('%s %d (v20.75: %d)' % (k, v, REF_V2075[k]) for k, v in counts.items()))
    print('heroes   : primary', dict(Counter(h.get('primary') for h in heroes)))
    print('slots    : implementation', dict(Counter(s.get('implementation') for s in slots)))
    print('           autocast', dict(Counter(s.get('autocast_class') for s in slots).most_common()))
    other = sorted({s['id'] for s in slots if s.get('autocast_class') == 'other'})
    print('           class "other" (check by hand):', ', '.join(other) or '-')
    print('items    : custom %d, sold in shops %d' % (sum(1 for i in items if i.get('custom')),
                                                     sum(1 for i in items if i.get('sold_by'))))
    print('script   : %s lines, %s functions, %s CreateTrigger calls'
          % (stats.get('lines'), stats.get('functions'), stats.get('CreateTrigger_calls')))
    print('assets   : built-in paths %s, imported files %s'
          % (assets.get('referenced_builtin_summary', {}).get('paths'),
             assets.get('imported_summary', {}).get('files')))
    if bad:
        print('FAILED   :')
        for b in bad:
            print('  -', b)
        sys.exit(1)
    print('OK')


if __name__ == '__main__':
    main()
