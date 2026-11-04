#!/usr/bin/env python3
"""diff_exports.py - what changed between two map versions (two export folders).

usage: python3 -I diff_exports.py <old_out_dir> <new_out_dir> [--json diff.json] [--limit N]

Compares records by id in heroes / abilities / items / units / buffs / upgrades, recipes by
(result, ingredients), and flat values of the misc constants, map header, script statistics and
wave tables. Prints added, removed and changed records with field-level differences
(old -> new), at most --limit fields per record (default 12); --json writes the complete diff.

Script cross-references (jass_refs, jass_functions, script_triggers) change whenever code moves,
so they are counted separately ("script refs changed") and do not make a record "changed".
"""
import json
import os
import sys

REF_KEYS = {'jass_refs', 'jass_functions', 'script_triggers', 'script_systems'}
RECORD_FILES = [('heroes.json', None), ('abilities.json', None), ('items.json', None),
                ('units.json', None), ('buffs_upgrades.json', 'buffs'),
                ('buffs_upgrades.json', 'upgrades')]
FLAT_SECTIONS = [('map_info.json', 'misc_constants'), ('map_info.json', 'w3i'),
                 ('waves.json', 'special_next_wave_table'), ('waves.json', 'difficulty_counts_per_gate'),
                 ('waves.json', 'regular_wave_units')]
STAT_KEYS = ['lines', 'functions', 'CreateTrigger_calls']


def load(d, f):
    p = os.path.join(d, f)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None


def flatten(obj, prefix='', out=None):
    """Leaf paths -> values; lists of dicts are indexed by 'level' when present."""
    out = {} if out is None else out
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in REF_KEYS:
                continue
            flatten(v, '%s.%s' % (prefix, k) if prefix else k, out)
    elif isinstance(obj, list) and obj and all(isinstance(x, dict) for x in obj):
        for i, x in enumerate(obj):
            tag = x.get('level', i) if isinstance(x, dict) else i
            flatten(x, '%s[%s]' % (prefix, tag), out)
    else:
        out[prefix] = obj
    return out


def short(v, n=60):
    s = json.dumps(v, ensure_ascii=False) if not isinstance(v, str) else v
    return s if len(s) <= n else s[:n - 1] + '…'


def diff_records(old, new):
    o = {r['id']: r for r in old or []}
    n = {r['id']: r for r in new or []}
    res = {'added': [], 'removed': [], 'changed': {}, 'script_refs_changed': []}
    for k in n:
        if k not in o:
            res['added'].append(k)
    for k in o:
        if k not in n:
            res['removed'].append(k)
    for k in sorted(set(o) & set(n)):
        fo, fn = flatten(o[k]), flatten(n[k])
        ch = {p: [fo.get(p), fn.get(p)] for p in sorted(set(fo) | set(fn)) if fo.get(p) != fn.get(p)}
        if ch:
            res['changed'][k] = ch
        if any(o[k].get(x) != n[k].get(x) for x in REF_KEYS):
            res['script_refs_changed'].append(k)
    return res, o, n


def name_of(rec):
    return (rec or {}).get('name') or ''


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        print(__doc__)
        sys.exit(2)
    old_dir, new_dir = args[0], args[1]
    json_out = args[args.index('--json') + 1] if '--json' in args else None
    limit = int(args[args.index('--limit') + 1]) if '--limit' in args else 12
    full = {}

    for fname, sub in RECORD_FILES:
        old, new = load(old_dir, fname), load(new_dir, fname)
        if sub:
            old, new = (old or {}).get(sub), (new or {}).get(sub)
        label = fname if not sub else '%s:%s' % (fname, sub)
        res, o, n = diff_records(old, new)
        full[label] = res
        print('%s: %d -> %d records | added %d | removed %d | changed %d | script refs changed %d'
              % (label, len(o), len(n), len(res['added']), len(res['removed']), len(res['changed']),
                 len(res['script_refs_changed'])))
        for k in res['added']:
            print('  + %s  %s' % (k, name_of(n[k])))
        for k in res['removed']:
            print('  - %s  %s' % (k, name_of(o[k])))
        for k, ch in res['changed'].items():
            items = list(ch.items())
            parts = ['%s: %s -> %s' % (p, short(a), short(b)) for p, (a, b) in items[:limit]]
            more = ' (+%d more)' % (len(items) - limit) if len(items) > limit else ''
            print('  ~ %s  %s: %s%s' % (k, name_of(n[k]), '; '.join(parts), more))

    old_r = (load(old_dir, 'recipes.json') or {}).get('recipes', [])
    new_r = (load(new_dir, 'recipes.json') or {}).get('recipes', [])
    key = lambda r: '%s <- %s' % (r.get('result'), '+'.join(sorted(r.get('ingredients') or [])))
    ko, kn = {key(r) for r in old_r}, {key(r) for r in new_r}
    full['recipes'] = {'added': sorted(kn - ko), 'removed': sorted(ko - kn)}
    print('recipes.json: %d -> %d | added %d | removed %d'
          % (len(old_r), len(new_r), len(kn - ko), len(ko - kn)))
    for r in sorted(kn - ko):
        print('  +', r)
    for r in sorted(ko - kn):
        print('  -', r)

    for fname, sec in FLAT_SECTIONS:
        fo = flatten((load(old_dir, fname) or {}).get(sec))
        fn = flatten((load(new_dir, fname) or {}).get(sec))
        ch = {p: [fo.get(p), fn.get(p)] for p in sorted(set(fo) | set(fn)) if fo.get(p) != fn.get(p)}
        full['%s:%s' % (fname, sec)] = ch
        print('%s:%s: %d values changed' % (fname, sec, len(ch)))
        for p, (a, b) in list(ch.items())[:limit]:
            print('  ~ %s: %s -> %s' % (p, short(a), short(b)))
        if len(ch) > limit:
            print('  … %d more' % (len(ch) - limit))

    so, sn = load(old_dir, 'script_stats.json') or {}, load(new_dir, 'script_stats.json') or {}
    full['script_stats'] = {k: [so.get(k), sn.get(k)] for k in STAT_KEYS}
    print('script: ' + ', '.join('%s %s -> %s' % (k, so.get(k), sn.get(k)) for k in STAT_KEYS))

    if json_out:
        json.dump(full, open(json_out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('full diff written to', json_out)


if __name__ == '__main__':
    main()
