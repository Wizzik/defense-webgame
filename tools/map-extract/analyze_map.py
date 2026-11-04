#!/usr/bin/env python3
"""analyze_map.py - map info, geography and asset inventory -> map_info.json, assets.json, file_list.txt

usage: python3 -I analyze_map.py <map.w3x> <extract_dir> <listing.txt> <out_dir> [<w3x2lni_units_dir>]

  map.w3x       the original map (only read: 512-byte HM3W header)
  extract_dir   folder with all extracted files (mpq x)
  listing.txt   output of 'mpq l <map>' (name size per line)
  out_dir       output folder

map_info.json  HM3W header, war3map.w3i (name, author, description, players, forces, bounds,
               tileset, editor/game version), war3map.w3e header (size, tilesets), region counts
               (w3r + Rect() in the script), placed objects (war3map.doo / war3mapUnits.doo),
               war3mapMisc.txt gameplay constants, named key rects (castle, gates, arenas ...)
assets.json    files imported into the map (war3map.imp + archive listing, with sizes and which
               objects use them) and every model/icon/sound path referenced by object data or the
               script, split into 'imported' vs 'built-in' (not present in the archive)
file_list.txt  every archive file with size and category (standard map file / imported asset)
"""
import json
import os
import re
import struct
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import w3lib  # noqa: E402

STANDARD = {
    'war3map.j': 'JASS script', 'war3map.w3a': 'abilities', 'war3map.w3u': 'units', 'war3map.w3t': 'items',
    'war3map.w3q': 'upgrades', 'war3map.w3h': 'buffs', 'war3map.w3b': 'destructables',
    'war3map.w3d': 'doodads', 'war3map.wts': 'string table', 'war3map.w3i': 'map info',
    'war3map.w3e': 'terrain', 'war3map.doo': 'doodads/destructables placement',
    'war3mapUnits.doo': 'placed units/items', 'war3map.w3r': 'regions', 'war3map.w3c': 'cameras',
    'war3map.w3s': 'sounds', 'war3map.imp': 'import list', 'war3map.mmp': 'minimap icons',
    'war3map.shd': 'shadow map', 'war3map.wpm': 'pathing map', 'war3mapMisc.txt': 'gameplay constants',
    'war3mapSkin.txt': 'skin / UI overrides', 'war3map.wct': 'custom trigger text (editor)',
    'war3map.wtg': 'trigger GUI data (editor)', 'war3mapMap.blp': 'minimap image',
    '(listfile)': 'MPQ listfile', '(attributes)': 'MPQ attributes', '(signature)': 'MPQ signature',
    'war3mapPreview.tga': 'preview image', 'war3mapExtra.txt': 'extra settings',
}

PATH_FIELDS_UNIT = ('umdl', 'uico', 'ua1m', 'ua2m', 'uspa', 'udea', 'ucua', 'uscb', 'ussi', 'ushu')
PATH_FIELDS_ABIL = ('aart', 'arar', 'auar', 'acat', 'atat', 'asat', 'aeat', 'aaea', 'amat')
PATH_FIELDS_ITEM = ('ifil', 'iico')
PATH_FIELDS_BUFF = ('fart', 'ftat', 'fsat', 'feat', 'fmat')
PATH_FIELDS_UPG = ('gar1',)


def norm(p):
    p = p.strip().strip('"').replace('/', '\\')
    low = p.lower()
    if low.endswith('.mdl'):
        low = low[:-4] + '.mdx'
    return low


class Reader:
    def __init__(self, d, p=0):
        self.d, self.p = d, p

    def i32(self):
        v = struct.unpack_from('<i', self.d, self.p)[0]
        self.p += 4
        return v

    def f32(self):
        v = struct.unpack_from('<f', self.d, self.p)[0]
        self.p += 4
        return v

    def u8(self):
        v = self.d[self.p]
        self.p += 1
        return v

    def raw(self, n):
        v = self.d[self.p:self.p + n]
        self.p += n
        return v

    def cstr(self):
        e = self.d.index(b'\0', self.p)
        v = self.d[self.p:e].decode('utf-8', 'replace')
        self.p = e + 1
        return v


def parse_w3i(d, res):
    """war3map.w3i format 25 (Reforged 1.31+) - fields up to the forces table."""
    r = Reader(d)
    out = {'format_version': r.i32(), 'map_version': r.i32(), 'editor_version': r.i32()}
    if out['format_version'] >= 28:
        out['game_version'] = [r.i32() for _ in range(4)]
    out['name'] = res(r.cstr())
    out['author'] = res(r.cstr())
    out['description'] = res(r.cstr())
    out['players_recommended'] = res(r.cstr())
    out['camera_bounds'] = [round(r.f32(), 1) for _ in range(8)]
    out['camera_complements'] = [r.i32() for _ in range(4)]
    out['playable_width'], out['playable_height'] = r.i32(), r.i32()
    out['flags'] = r.i32()
    out['main_tileset'] = chr(r.u8())
    out['loading_screen_number'] = r.i32()
    out['loading_screen_model'] = r.cstr()
    out['loading_screen_text'] = res(r.cstr())
    out['loading_screen_title'] = res(r.cstr())
    out['loading_screen_subtitle'] = res(r.cstr())
    out['game_data_set'] = r.i32()
    out['prologue_path'] = r.cstr()
    out['prologue_text'] = res(r.cstr())
    out['prologue_title'] = res(r.cstr())
    out['prologue_subtitle'] = res(r.cstr())
    out['terrain_fog'] = r.i32()
    out['fog_start_z'], out['fog_end_z'], out['fog_density'] = r.f32(), r.f32(), r.f32()
    out['fog_color'] = list(r.raw(4))
    out['global_weather'] = r.raw(4).decode('latin1')
    out['custom_sound_environment'] = r.cstr()
    out['custom_light_tileset'] = chr(r.u8())
    out['water_tint'] = list(r.raw(4))
    if out['format_version'] >= 28:
        out['script_language'] = r.i32()          # 0 = JASS, 1 = Lua (format 28 = 1.31+)
    if out['format_version'] >= 31:
        out['supported_modes'] = r.i32()
        out['game_data_version'] = r.i32()        # 0 = classic (RoC/TFT) data, 1 = Reforged data
    players = []
    for _ in range(r.i32()):
        p = {'id': r.i32(), 'type': {1: 'human', 2: 'computer', 3: 'neutral', 4: 'rescuable'}.get(r.i32()),
             'race': r.i32(), 'fixed_start': r.i32(), 'name': res(r.cstr()),
             'start': [round(r.f32(), 1), round(r.f32(), 1)], 'ally_low': r.i32(), 'ally_high': r.i32()}
        if out['format_version'] >= 31:
            r.i32(); r.i32()
        players.append(p)
    out['players'] = players
    forces = []
    for _ in range(r.i32()):
        f = {'flags': r.i32(), 'player_mask': r.i32(), 'name': res(r.cstr())}
        f['players'] = [i for i in range(24) if f['player_mask'] >> i & 1]
        forces.append(f)
    out['forces'] = forces
    out['parsed_bytes'] = r.p
    out['total_bytes'] = len(d)
    return out


def parse_w3e(d):
    r = Reader(d, 4)
    out = {'version': r.i32(), 'main_tileset': chr(r.u8()), 'custom_tilesets': r.i32()}
    out['ground_tiles'] = [r.raw(4).decode() for _ in range(r.i32())]
    out['cliff_tiles'] = [r.raw(4).decode() for _ in range(r.i32())]
    out['width_points'], out['height_points'] = r.i32(), r.i32()
    out['origin'] = [r.f32(), r.f32()]
    out['size_world_units'] = [(out['width_points'] - 1) * 128, (out['height_points'] - 1) * 128]
    return out


def parse_w3r(d):
    r = Reader(d)
    ver, n = r.i32(), r.i32()
    regs = []
    for _ in range(n):
        lbrt = [r.f32() for _ in range(4)]
        name = r.cstr()
        idx = r.i32()
        r.raw(4)
        r.cstr()
        r.raw(4)
        regs.append({'name': name, 'index': idx, 'rect': lbrt})
    return {'version': ver, 'regions': regs}


def parse_doo(d, units, skins=False):
    """Placed doodads / units. skins=True for maps saved by the 1.32+ editor (w3i format >= 28),
    which store a 4-byte skin id per object."""
    r = Reader(d, 4)
    ver, sub = r.i32(), r.i32()
    n = r.i32()
    types = Counter()
    if not units:
        for _ in range(n):
            t = r.raw(4).decode('latin1')
            r.i32()                                  # variation
            r.raw(12); r.f32(); r.raw(12)            # pos, angle, scale
            if skins:
                r.raw(4)                             # skin id
            r.u8(); r.u8()                           # flags, life
            r.i32()                                  # item table pointer
            for _ in range(r.i32()):                 # dropped item sets
                for _ in range(r.i32()):
                    r.raw(8)
            r.i32()                                  # editor id
            types[t] += 1
        return {'version': ver, 'subversion': sub, 'count': n, 'types': dict(types.most_common())}
    placed = []
    for _ in range(n):
        t = r.raw(4).decode('latin1')
        r.i32()
        x, y, z = r.f32(), r.f32(), r.f32()
        r.f32(); r.raw(12)
        if skins:
            r.raw(4)
        r.u8()
        owner = r.i32()
        r.u8(); r.u8()
        hp, mp = r.i32(), r.i32()
        if sub >= 11:
            r.i32()                                  # item table pointer
        for _ in range(r.i32()):
            for _ in range(r.i32()):
                r.raw(8)
        r.i32(); r.f32()                             # gold, target acquisition
        lvl = r.i32()
        if sub >= 11:
            r.i32(); r.i32(); r.i32()                # str agi int
        for _ in range(r.i32()):                     # inventory
            r.i32(); r.raw(4)
        for _ in range(r.i32()):                     # modified abilities
            r.raw(4); r.i32(); r.i32()
        rnd = r.i32()
        if rnd == 0:
            r.raw(4)
        elif rnd == 1:
            r.i32(); r.i32()
        elif rnd == 2:
            for _ in range(r.i32()):
                r.raw(4); r.i32()
        r.i32()                                      # custom color
        r.i32()                                      # waygate
        r.i32()                                      # creation number
        placed.append({'type': t, 'owner': owner, 'x': round(x), 'y': round(y)})
        types[t] += 1
    return {'version': ver, 'subversion': sub, 'count': n, 'types': dict(types.most_common()),
            'placed': placed}


def parse_imp(d):
    r = Reader(d)
    ver, n = r.i32(), r.i32()
    out = []
    for _ in range(n):
        flag = r.u8()
        out.append({'path': r.cstr(), 'flag': flag})
    return {'version': ver, 'entries': out}


def main():
    if len(sys.argv) < 5:
        print(__doc__)
        sys.exit(1)
    mapf, xdir, listing, odir = sys.argv[1:5]
    os.makedirs(odir, exist_ok=True)
    wts = w3lib.load_wts(os.path.join(xdir, 'war3map.wts'))
    res = w3lib.Resolver(wts)
    hdr = open(mapf, 'rb').read(512)
    e = hdr.index(b'\0', 8)
    header = {'magic': hdr[:4].decode('latin1'), 'name': hdr[8:e].decode('utf-8', 'replace'),
              'flags': struct.unpack_from('<i', hdr, e + 1)[0],
              'max_players': struct.unpack_from('<i', hdr, e + 5)[0]}

    # ------------------------------------------------------------- files
    files = []
    for line in open(listing, encoding='utf-8', errors='replace'):
        line = line.rstrip('\n')
        if not line:
            continue
        name, size = line.rsplit(' ', 1)
        files.append((name, int(size)))
    imp = parse_imp(open(os.path.join(xdir, 'war3map.imp'), 'rb').read())
    imported = {norm(x['path']): x['path'] for x in imp['entries']}
    archive = {norm(n): (n, s) for n, s in files}
    flist, imp_total, cats = [], 0, Counter()
    for n, s in sorted(files, key=lambda x: x[0].lower()):
        if n in STANDARD:
            cat = 'standard: ' + STANDARD[n]
        else:
            ext = n.rsplit('.', 1)[-1].lower()
            kind = {'mdx': 'model', 'mdl': 'model', 'blp': 'texture/icon', 'dds': 'texture', 'tga': 'texture',
                    'mp3': 'sound', 'wav': 'sound', 'flac': 'sound'}.get(ext, 'other')
            cat = 'imported %s%s' % (kind, '' if norm(n) in imported else ' (not in war3map.imp)')
            imp_total += s
            cats[kind] += 1
        flist.append('%-80s %9d  %s' % (n, s, cat))
    open(os.path.join(odir, 'file_list.txt'), 'w', encoding='utf-8').write(
        '# %d files, total %d bytes; imported assets: %d files, %d bytes\n' % (
            len(files), sum(s for _, s in files), sum(cats.values()), imp_total) + '\n'.join(flist) + '\n')

    # ------------------------------------------------------------- map info
    w3i = parse_w3i(open(os.path.join(xdir, 'war3map.w3i'), 'rb').read(), res)
    w3e = parse_w3e(open(os.path.join(xdir, 'war3map.w3e'), 'rb').read())
    w3r = parse_w3r(open(os.path.join(xdir, 'war3map.w3r'), 'rb').read())
    skins = w3i['format_version'] >= 28
    doo = parse_doo(open(os.path.join(xdir, 'war3map.doo'), 'rb').read(), False, skins)
    udoo = parse_doo(open(os.path.join(xdir, 'war3mapUnits.doo'), 'rb').read(), True, skins)
    misc = {}
    for line in open(os.path.join(xdir, 'war3mapMisc.txt'), encoding='utf-8', errors='replace'):
        if '=' in line:
            k, v = line.strip().split('=', 1)
            misc[k] = v
    jass = open(os.path.join(xdir, 'war3map.j'), encoding='latin1').read()
    rects = {m.group(1): [float(x) for x in m.group(2).split(',')]
             for m in re.finditer(r'set (udg_rect\d+|gg_rct_\w+)\s*=\s*Rect\(([^)]*)\)', jass)}
    placed_script = Counter()
    s = jass.find('function CreateUnitsForPlayer11')
    for fn in re.finditer(r'function (Create(?:Units|Buildings)ForPlayer(\d+)|CreateNeutralPassiveBuildings2)\b', jass):
        st = fn.end()
        en = jass.find('\nendfunction', st)
        owner = fn.group(2) or 'neutral passive'
        for m in re.finditer(r"CreateUnit\(\s*(?:p|Player\(\d+\))\s*,\s*'(\w{4})'", jass[st:en]):
            placed_script[(owner, m.group(1))] += 1
    m = re.search(r'call SetCameraBounds\(\s*(-?\d+\.?\d*)[^,]*,\s*(-?\d+\.?\d*)[^,]*,\s*(-?\d+\.?\d*)[^,]*,'
                  r'\s*(-?\d+\.?\d*)', jass[jass.find('function main2'):])
    info = {'hm3w_header': header, 'w3i': w3i, 'terrain': w3e, 'regions_w3r': w3r,
            'script_rects': {'count': len(rects), 'rects': rects},
            'doodads': doo, 'units_doo': udoo,
            'units_placed_by_script': [{'owner': o, 'type': t, 'count': c}
                                       for (o, t), c in sorted(placed_script.items())],
            'misc_constants': misc,
            'camera_bounds_main2': [float(x) for x in m.groups()] if m else None}
    json.dump(info, open(os.path.join(odir, 'map_info.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    # ------------------------------------------------------------- referenced paths
    uses = defaultdict(set)

    def add(path, who):
        for p in re.split(r'[,;]', path or ''):
            p = p.strip().strip('"')
            if re.search(r'\.(mdl|mdx|blp|tga|dds|wav|mp3|flac)$', p, re.I) or (
                    who.startswith('unit') and '\\' in p and '.' not in p.rsplit('\\', 1)[-1]):
                if '.' not in p.rsplit('\\', 1)[-1]:
                    p += '.mdl'
                uses[norm(p)].add(who)

    for fn, lev, fields, kind in (('war3map.w3u', False, PATH_FIELDS_UNIT, 'unit'),
                                  ('war3map.w3a', True, PATH_FIELDS_ABIL, 'ability'),
                                  ('war3map.w3t', False, PATH_FIELDS_ITEM, 'item'),
                                  ('war3map.w3h', False, PATH_FIELDS_BUFF, 'buff'),
                                  ('war3map.w3q', True, PATH_FIELDS_UPG, 'upgrade')):
        for o in w3lib.load_object_file(os.path.join(xdir, fn), lev, res):
            for mm in o['mods']:
                if mm['id'] in fields and isinstance(mm['value'], str):
                    add(mm['value'], '%s %s.%s' % (kind, o['key'], mm['id']))
    for mm in re.finditer(r'"([^"\n]+\.(?:mdl|mdx|blp|wav|mp3|flac|tga))"', jass, re.I):
        add(mm.group(1).replace('\\\\', '\\'), 'script')
    skin = open(os.path.join(xdir, 'war3mapSkin.txt'), encoding='utf-8', errors='replace').read()
    for mm in re.finditer(r'=(\S+\.(?:blp|mdx|mdl))', skin, re.I):
        add(mm.group(1), 'war3mapSkin.txt')

    # textures referenced from inside imported MDX models (TEXS chunk)
    mdx_textures = {}
    for n, sz in files:
        if n.lower().endswith('.mdx'):
            d = open(os.path.join(xdir, n.replace('\\', '/')), 'rb').read()
            i = d.find(b'TEXS')
            if i >= 0:
                ln = int.from_bytes(d[i + 4:i + 8], 'little')
                tex = sorted({t.decode('latin1') for t in re.findall(rb'[\x20-\x7e]{3,}\.(?:blp|tga|dds)',
                                                                     d[i + 8:i + 8 + ln], re.I)})
                mdx_textures[n] = tex
                for t in tex:
                    add(t, 'model ' + n)
    # any other mention of an imported file name in the script or strings (e.g. models created by
    # AddSpecialEffect with a path built from parts)
    blob = jass.lower() + '\n'.join(wts.values()).lower()
    for n, sz in files:
        if n in STANDARD:
            continue
        base = n.replace('\\', '/').rsplit('/', 1)[-1].lower()
        stem = base.rsplit('.', 1)[0]
        if norm(n) not in uses and (base in blob or stem.replace(' ', '') in blob.replace(' ', '')):
            uses[norm(n)].add('script/strings (name match)')

    ref_imported, ref_builtin = {}, {}
    for p, who in sorted(uses.items()):
        rec = {'used_by_count': len(who), 'used_by': sorted(who)[:25]}
        alt = p[:-4] + '.mdl' if p.endswith('.mdx') else p
        if p in archive or alt in archive:
            ref_imported[archive.get(p, archive.get(alt))[0]] = rec
        else:
            ref_builtin[p] = rec
    imp_list = []
    for n, s in files:
        if n in STANDARD:
            continue
        k = norm(n)
        imp_list.append({'path': n, 'bytes': s, 'in_import_list': k in imported,
                         'referenced_by': sorted(uses.get(k, set()))[:25],
                         'referenced': k in uses})
    btype = Counter(p.rsplit('.', 1)[-1] for p in ref_builtin)
    assets = {
        'imported_files': imp_list,
        'imported_summary': {'files': len(imp_list), 'bytes': sum(x['bytes'] for x in imp_list),
                             'by_kind': dict(cats), 'unreferenced': [x['path'] for x in imp_list if not x['referenced']]},
        'import_list_war3map_imp': imp,
        'referenced_builtin_paths': ref_builtin,
        'referenced_builtin_summary': {'paths': len(ref_builtin), 'by_extension': dict(btype)},
        'referenced_imported_paths': ref_imported,
        'imported_mdx_textures': mdx_textures,
    }
    json.dump(assets, open(os.path.join(odir, 'assets.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('map: %s | author %s | w3i format %d editor %d | players %d forces %d | playable %dx%d tiles | tileset %s'
          % (w3lib.strip_codes(w3i['name']), w3i['author'], w3i['format_version'], w3i['editor_version'],
             len(w3i['players']), len(w3i['forces']), w3i['playable_width'], w3i['playable_height'],
             w3i['main_tileset']))
    print('terrain %dx%d points, ground tiles %s' % (w3e['width_points'], w3e['height_points'], w3e['ground_tiles']))
    print('w3r regions %d, script rects %d, doodads %d, placed units (doo) %d, script-placed unit types %d'
          % (len(w3r['regions']), len(rects), doo['count'], udoo['count'], len(placed_script)))
    print('archive files %d, imported %d (%d bytes), unreferenced imported %d; built-in paths referenced %d %s'
          % (len(files), len(imp_list), assets['imported_summary']['bytes'],
             len(assets['imported_summary']['unreferenced']), len(ref_builtin), dict(btype)))


if __name__ == '__main__':
    main()
