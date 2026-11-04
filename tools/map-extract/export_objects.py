#!/usr/bin/env python3
"""export_objects.py - object data of the map -> heroes.json, abilities.json, items.json, units.json

usage: python3 -I export_objects.py <extract_dir> <w3x2lni_units_dir> <out_dir> [<w3x2lni_ui_dir>]

  extract_dir        folder with the extracted map files (war3map.w3u/.w3a/.w3t/.w3h/.w3q/.wts/.j)
  w3x2lni_units_dir  base data, e.g. w3x2lni/data/enUS-1.27.1/mpq/Units (English names)
  out_dir            where the JSON files are written
  w3x2lni_ui_dir     optional, .../mpq/UI (WorldEditStrings.txt for readable field names)

What it does
  * parses the object files losslessly (w3lib.parse_objects) and resolves TRIGSTR_ texts
  * merges every modified field over the base value from the SLK/profile tables, so each
    unit / ability / item is exported with its effective values (base value where unmodified)
  * for abilities, collects the per-level fields (cooldown, mana, area, range, duration,
    DataA..DataI with readable names) and the JASS functions that reference the rawcode
  * heroes = units listed in the hero-pick table (the 44 tavern heroes, see HERO_IDS)
  * prints only a compact summary
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import w3lib  # noqa: E402

# The selectable heroes are pre-placed for the castle owner (Player 11 = index 10) and created in
# the editor-generated function CreateUnitsForPlayer10 (hero rawcodes start with a capital letter).
# hero_ids_from_script() reads that list, so a new map version with added or removed heroes is
# exported correctly. HERO_IDS (v20.75, 44 heroes, maintainer README order) is only the fallback
# and the reference that differences are reported against.
HERO_PLACEMENT_FUNCTION = 'CreateUnitsForPlayer10'
HERO_IDS = ['O006', 'O008', 'O009', 'O007', 'O00Q', 'O001', 'O00D', 'O017', 'O00P', 'O005', 'O00R',
            'O00B', 'O010', 'O004', 'O01D', 'O00M', 'O00Z', 'O00E', 'O019', 'O00A', 'O00N', 'O00S',
            'O00Y', 'O00J', 'O00W', 'O002', 'O00C', 'O018', 'O00U', 'O00O', 'O01A', 'O003', 'O00L',
            'O00K', 'O00F', 'O00I', 'O00H', 'O00G', 'O00X', 'O01G', 'O016', 'O00V', 'O00T', 'O01E']
SHARED_ABILITIES = {'A0ZF'}          # Hero Power stat skill (added to every hero)


def hero_ids_from_script(jass, units):
    """Hero rawcodes created in CreateUnitsForPlayer10, in script order; [] if not found."""
    start = jass.find('function %s takes' % HERO_PLACEMENT_FUNCTION)
    if start < 0:
        return []
    body = jass[start:jass.find('\nendfunction', start)]
    out = []
    for m in re.finditer(r"CreateUnit\(\s*(?:p|Player\(\d+\))\s*,\s*'([A-Z]\w{3})'", body):
        if m.group(1) in units and m.group(1) not in out:
            out.append(m.group(1))
    return out

UNIT_FIELDS = {   # field id -> export key (non-leveled unit fields)
    'unam': 'name', 'upro': 'proper_names', 'utip': 'tip', 'utub': 'ubertip', 'ides': 'description',
    'umdl': 'model', 'uico': 'icon', 'usca': 'scale', 'ulev': 'level', 'utyp': 'classification',
    'urac': 'race', 'uhpm': 'hp', 'uhpr': 'hp_regen', 'umpm': 'mana', 'umpi': 'mana_initial',
    'umpr': 'mana_regen', 'udef': 'armor', 'udty': 'defense_type', 'uarm': 'armor_sound',
    'umvs': 'move_speed', 'umvt': 'move_type', 'ucol': 'collision', 'usid': 'sight_day',
    'usin': 'sight_night', 'uacq': 'acquire_range', 'uaen': 'attacks_enabled',
    'ua1t': 'attack_type', 'ua1w': 'weapon_type', 'ua1c': 'cooldown', 'ua1b': 'damage_base',
    'ua1d': 'damage_dice', 'ua1s': 'damage_sides', 'ua1r': 'range', 'ua1m': 'missile_model',
    'ua1z': 'missile_speed', 'ua1f': 'splash_full_area', 'ua1h': 'splash_medium_area',
    'ua1q': 'splash_small_area', 'ua1p': 'splash_targets', 'udl1': 'damage_loss',
    'ustr': 'str', 'uagi': 'agi', 'uint': 'int', 'ustp': 'str_per_level', 'uagp': 'agi_per_level',
    'uinp': 'int_per_level', 'upra': 'primary', 'uabi': 'abilities', 'uhab': 'hero_abilities',
    'ugol': 'gold_cost', 'ulum': 'lumber_cost', 'ubba': 'bounty_base', 'ubdi': 'bounty_dice',
    'ubsi': 'bounty_sides', 'usei': 'sells_items', 'useu': 'sells_units', 'ubui': 'builds',
    'ufoo': 'food_cost', 'umxp': 'max_pitch', 'ushu': 'shadow', 'upoi': 'point_value',
    'ubdg': 'is_building', 'urq1': 'unused'}
ITEM_FIELDS = {'unam': 'name', 'utip': 'tip', 'utub': 'ubertip', 'ides': 'description',
               'icla': 'class', 'ilev': 'level', 'igol': 'gold_cost', 'ilum': 'lumber_cost',
               'iabi': 'abilities', 'iuse': 'charges', 'iusa': 'actively_used',
               'iper': 'perishable', 'ipow': 'powerup', 'isel': 'sellable', 'ipaw': 'pawnable',
               'idro': 'droppable', 'idrp': 'drop_on_death', 'isto': 'stock_max',
               'istr': 'stock_replenish', 'isst': 'stock_start', 'ifil': 'model',
               'iico': 'icon', 'icid': 'cooldown_group', 'ipri': 'priority',
               'ureq': 'requirements', 'ihtp': 'hp'}
ABIL_COMMON = {'acdn': 'cooldown', 'amcs': 'mana', 'aare': 'area', 'aran': 'range',
               'adur': 'duration', 'ahdu': 'duration_hero', 'acas': 'cast_time',
               'atar': 'targets', 'abuf': 'buffs', 'aeff': 'effects'}
ABIL_ART = {'aart': 'icon', 'acat': 'caster_art', 'atat': 'target_art', 'asat': 'special_art',
            'aeat': 'effect_art', 'aaea': 'area_effect_art', 'amat': 'missile_art',
            'alig': 'lightning'}

ATTACK_TYPES = {0: 'normal', 1: 'pierce', 2: 'siege', 3: 'spells', 4: 'chaos', 5: 'magic', 6: 'hero'}


def fval(mods, fid, level=None):
    """Value of field fid (non-leveled: level None; leveled: exact level, 0 = all-levels field)."""
    for m in mods:
        if m['id'] == fid and (level is None or m['level'] == level):
            return m['value']
    return None


def attack_type_name(v):
    if isinstance(v, int):
        return ATTACK_TYPES.get(v, v)
    return v


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    xdir, bdir, odir = sys.argv[1], sys.argv[2], sys.argv[3]
    uidir = sys.argv[4] if len(sys.argv) > 4 else None
    os.makedirs(odir, exist_ok=True)
    wts = w3lib.load_wts(os.path.join(xdir, 'war3map.wts'))
    res = w3lib.Resolver(wts)
    base = w3lib.BaseData(bdir, uidir)
    units = w3lib.load_object_file(os.path.join(xdir, 'war3map.w3u'), False, res)
    items = w3lib.load_object_file(os.path.join(xdir, 'war3map.w3t'), False, res)
    abils = w3lib.load_object_file(os.path.join(xdir, 'war3map.w3a'), True, res)
    buffs = w3lib.load_object_file(os.path.join(xdir, 'war3map.w3h'), False, res)
    upgrades = w3lib.load_object_file(os.path.join(xdir, 'war3map.w3q'), True, res)
    jass = open(os.path.join(xdir, 'war3map.j'), encoding='latin1').read()
    funcs = w3lib.jass_functions(jass)
    refs = w3lib.rawcode_refs(jass, funcs)
    U = {o['key']: o for o in units}
    A = {o['key']: o for o in abils}
    I = {o['key']: o for o in items}

    # ------------------------------------------------------------------ late-game bonus table
    lb = {}
    s = jass.find('function LB_Init takes')
    e = jass.find('\nendfunction', s)
    for a, k, v in re.findall(r"SaveInteger\(udg_AIHT,\s*'(\w{4})',\s*([567]),\s*(-?\d+)\)", jass[s:e]):
        lb.setdefault(a, {})[{'5': 'mode', '6': 'radius', '7': 'mult'}[k]] = int(v)
    lb_modes = {1: 'single target', 2: 'circle at target', 3: 'line', 4: 'circle around caster'}

    # ------------------------------------------------------------------ units
    def unit_value(o, fid):
        v = fval(o['mods'], fid)
        if v is None:
            v = base.unit_base(o['orig'], fid)
        return v

    def unit_record(o):
        rec = {'id': o['key'], 'base': o['orig'], 'custom': o['custom']}
        for fid, key in UNIT_FIELDS.items():
            v = unit_value(o, fid)
            if v is not None and v != '':
                rec[key] = v
        for k in ('name', 'tip', 'ubertip', 'description', 'proper_names'):
            if isinstance(rec.get(k), str):
                rec[k] = w3lib.strip_codes(rec[k], 400)
        if 'attack_type' in rec:
            rec['attack_type'] = attack_type_name(rec['attack_type'])
        for k in ('abilities', 'hero_abilities', 'sells_items', 'sells_units', 'builds'):
            if isinstance(rec.get(k), str):
                rec[k] = [x for x in rec[k].split(',') if x and x != '_']
        d, sd, b = rec.get('damage_dice'), rec.get('damage_sides'), rec.get('damage_base')
        if all(isinstance(x, (int, float)) for x in (d, sd, b)):
            rec['damage_min'] = b + d
            rec['damage_max'] = b + d * sd
        if isinstance(rec.get('model'), str) and not rec['model'].lower().endswith(('.mdl', '.mdx')):
            rec['model'] = rec['model'] + '.mdl'
        rec['modified_fields'] = sorted({m['id'] for m in o['mods']})
        rec['jass_refs'] = refs.get(o['key'], {})
        return rec

    unit_out = [unit_record(o) for o in units]
    UO = {u['id']: u for u in unit_out}

    # ------------------------------------------------------------------ abilities
    def abil_record(o):
        b = o['orig']
        mods = o['mods']
        levels = fval(mods, 'alev', 0)
        if levels is None:
            levels = base.abil_base(b, 'alev') or 1
        rec = {'id': o['key'], 'base': b, 'custom': o['custom'],
               'base_comment': base.abil.get(b, {}).get('comments'),
               'levels': levels}
        for fid, key in (('anam', 'name'), ('ansf', 'editor_suffix'), ('aher', 'hero'),
                         ('aite', 'item'), ('arlv', 'required_level'), ('alsk', 'level_skip'),
                         ('aord', 'order')):
            v = fval(mods, fid, 0)
            if v is None:
                v = base.abil_base(b, fid)
            if v is not None:
                rec[key] = w3lib.strip_codes(v) if isinstance(v, str) and key == 'name' else v
        for fid, key in ABIL_ART.items():
            v = fval(mods, fid, 0)
            src = 'map'
            if v is None:
                v, src = base.abil_base(b, fid), 'base'
            if v:
                rec[key] = v
                rec[key + '_source'] = src
        datas = base.abil_data_fields(b)
        per = []
        for lvl in range(1, int(levels) + 1):
            row = {'level': lvl}
            for fid, key in ABIL_COMMON.items():
                v = fval(mods, fid, lvl)
                if v is None:
                    v = base.abil_base(b, fid, lvl)
                if v is not None:
                    row[key] = v
            for idx, (fid, meta) in sorted(datas.items()):
                v = fval(mods, fid, lvl)
                if v is None:
                    v = base.abil_base(b, fid, lvl)
                if v is not None:
                    nm = base.field_name(meta) or fid
                    row['Data' + 'ABCDEFGHI'[idx - 1]] = {'field': fid, 'name': w3lib.strip_codes(nm), 'value': v}
            for fid, key in (('atp1', 'tip'), ('aub1', 'ubertip')):
                v = fval(mods, fid, lvl)
                if v is None:
                    v = base.abil_base(b, fid, lvl)
                if v:
                    row[key] = w3lib.strip_codes(v, 600)
            per.append(row)
        rec['per_level'] = per
        for fid, key in (('aret', 'learn_tip'), ('arut', 'learn_ubertip')):
            v = fval(mods, fid, 0)
            if v:
                rec[key] = w3lib.strip_codes(v, 600)
        r = refs.get(o['key'], {})
        rec['jass_refs'] = r
        rec['jass_functions'] = sorted(r)
        rec['late_bonus'] = dict(lb[o['key']], mode_name=lb_modes.get(lb[o['key']].get('mode'))) \
            if o['key'] in lb else None
        rec['modified_fields'] = sorted({m['id'] for m in mods})
        return rec

    abil_out = [abil_record(o) for o in abils]
    AO = {a['id']: a for a in abil_out}

    # ------------------------------------------------------------------ items
    shops = {}
    for u in unit_out:
        for it in u.get('sells_items', []):
            shops.setdefault(it, []).append(u['id'])

    def item_record(o):
        rec = {'id': o['key'], 'base': o['orig'], 'custom': o['custom']}
        for fid, key in ITEM_FIELDS.items():
            v = fval(o['mods'], fid)
            if v is None:
                v = base.unit_base(o['orig'], fid)
            if v is not None and v != '':
                rec[key] = v
        for k in ('name', 'tip', 'ubertip', 'description'):
            if isinstance(rec.get(k), str):
                rec[k] = w3lib.strip_codes(rec[k], 600)
        if isinstance(rec.get('abilities'), str):
            rec['abilities'] = [x for x in rec['abilities'].split(',') if x and x != '_']
        rec['ability_names'] = [AO[a].get('name', a) if a in AO else (base.profile.get(a, {}).get('name') or a)
                                for a in rec.get('abilities', [])]
        rec['sold_by'] = shops.get(o['key'], [])
        rec['jass_refs'] = refs.get(o['key'], {})
        rec['modified_fields'] = sorted({m['id'] for m in o['mods']})
        return rec

    item_out = [item_record(o) for o in items]
    # base items sold in shops but not modified in the map
    known = {i['id'] for i in item_out}
    for it, sellers in sorted(shops.items()):
        if it not in known:
            rec = {'id': it, 'base': it, 'custom': False, 'unmodified_base_item': True}
            for fid, key in ITEM_FIELDS.items():
                v = base.unit_base(it, fid)
                if v is not None and v != '':
                    rec[key] = v
            for k in ('name', 'tip', 'ubertip', 'description'):
                if isinstance(rec.get(k), str):
                    rec[k] = w3lib.strip_codes(rec[k], 600)
            if isinstance(rec.get('abilities'), str):
                rec['abilities'] = [x for x in rec['abilities'].split(',') if x and x != '_']
            rec['sold_by'] = sellers
            rec['jass_refs'] = refs.get(it, {})
            item_out.append(rec)

    # ------------------------------------------------------------------ heroes
    hero_ids = hero_ids_from_script(jass, UO)
    if not hero_ids:
        print('WARNING: no heroes found in %s - using the v20.75 HERO_IDS list' % HERO_PLACEMENT_FUNCTION)
        hero_ids = [h for h in HERO_IDS if h in UO]
    added = [h for h in hero_ids if h not in HERO_IDS]
    removed = [h for h in HERO_IDS if h not in hero_ids]
    if added or removed:
        print('NOTE: hero list differs from v20.75: added %s, removed %s' % (added or '-', removed or '-'))
    hero_out = []
    for hid in hero_ids:
        u = UO[hid]
        abl = []
        for a in u.get('hero_abilities', []):
            if a in SHARED_ABILITIES:
                continue
            ar = AO.get(a)
            lv1 = ar['per_level'][0] if ar and ar['per_level'] else {}
            abl.append({'id': a, 'name': ar.get('name') if ar else base.profile.get(a, {}).get('name'),
                        'base': ar['base'] if ar else a,
                        'base_comment': ar['base_comment'] if ar else base.abil.get(a, {}).get('comments'),
                        'levels': ar['levels'] if ar else None,
                        'jass_functions': ar['jass_functions'] if ar else sorted(refs.get(a, {})),
                        'late_bonus': ar['late_bonus'] if ar else None,
                        'level1': {k: v for k, v in lv1.items() if k not in ('ubertip',)},
                        'tooltip_level1': lv1.get('ubertip')})
        h = {k: u.get(k) for k in ('id', 'base', 'name', 'proper_names', 'primary', 'str', 'agi', 'int',
                                   'str_per_level', 'agi_per_level', 'int_per_level', 'hp', 'mana',
                                   'armor', 'defense_type', 'move_speed', 'attack_type', 'weapon_type',
                                   'cooldown', 'damage_base', 'damage_dice', 'damage_sides',
                                   'damage_min', 'damage_max', 'range', 'missile_model', 'model',
                                   'icon', 'scale', 'abilities', 'ubertip')}
        h['hero_abilities'] = abl
        h['shared_abilities'] = [a for a in u.get('hero_abilities', []) if a in SHARED_ABILITIES]
        h['jass_refs'] = u['jass_refs']
        hero_out.append(h)

    # ------------------------------------------------------------------ buffs / upgrades (small)
    def plain(objs, leveled):
        out = []
        for o in objs:
            rec = {'id': o['key'], 'base': o['orig'], 'custom': o['custom'], 'fields': {}}
            for m in o['mods']:
                k = m['id'] + (('@%d' % m['level']) if leveled and m['level'] else '')
                v = m['value']
                rec['fields'][k] = w3lib.strip_codes(v, 300) if isinstance(v, str) else v
            rec['jass_refs'] = refs.get(o['key'], {})
            out.append(rec)
        return out

    dump = lambda name, obj: json.dump(obj, open(os.path.join(odir, name), 'w', encoding='utf-8'),
                                       ensure_ascii=False, indent=1)
    dump('heroes.json', hero_out)
    dump('abilities.json', abil_out)
    dump('items.json', item_out)
    dump('units.json', unit_out)
    dump('buffs_upgrades.json', {'buffs': plain(buffs, False), 'upgrades': plain(upgrades, True)})
    print('wts strings:', len(wts))
    print('units: %d (%d custom), abilities: %d (%d custom), items: %d in map (+%d unmodified base items sold)'
          % (len(units), sum(u['custom'] for u in units), len(abils), sum(a['custom'] for a in abils),
             len(items), len(item_out) - len(items)))
    print('buffs: %d, upgrades: %d, heroes exported: %d, late-bonus entries: %d'
          % (len(buffs), len(upgrades), len(hero_out), len(lb)))


if __name__ == '__main__':
    main()
