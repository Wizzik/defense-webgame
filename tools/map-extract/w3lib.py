"""w3lib - shared readers for Warcraft III map data (used by all export scripts).

Everything here is read-only: nothing writes back into a map.

Contents
  * load_wts(path)                 -> {int: str}   war3map.wts string table
  * Resolver(wts)                   resolves "TRIGSTR_nnn" references (also inside longer strings)
  * parse_objects(data, leveled)    lossless parser for object-data files (.w3u/.w3t/.w3b/.w3h are
                                    not leveled; .w3a/.w3d/.w3q are leveled)
  * decode_value(type, raw)         0 = int32, 1 = real, 2 = unreal (both float32), 3 = string
  * load_slk(path)                  SLK table -> list of dicts (header row = column names)
  * load_profile(paths)             *func.txt / *strings.txt / *skin.txt ini-style profiles
  * split_list(value)               split a profile value on commas outside quotes
  * BaseData(data_dir)              base (unmodified) game data from a w3x2lni data folder,
                                    with meta-data lookups for unit/item and ability fields
  * strip_codes(text)               remove |cAARRGGBB, |r, |n colour/new-line codes
  * jass_functions(text)            [(name, first_line, last_line)] for a JASS script
  * rawcode_refs(text, funcs)       {'A0XY': {function: count}} for every 'XXXX' literal

Object key convention: new_id if new_id != b'\\0\\0\\0\\0' else orig_id (custom objects have a
new_id, edited originals do not).

Base data: the w3x2lni repository (https://github.com/sumneko/w3x2lni) ships extracted SLK
tables; data/enUS-1.27.1/mpq/Units is used because its names are English.  Field meta-data
(which SLK column / profile key a 4-letter field id maps to) comes from UnitMetaData.slk and
AbilityMetaData.slk of the same folder.
"""
import os
import re
import struct

NULL_ID = b'\0\0\0\0'


# --------------------------------------------------------------------------- strings
def load_wts(path):
    """Parse war3map.wts: blocks 'STRING n' [// comment] '{' ... '}' -> {n: text}."""
    text = open(path, 'rb').read().decode('utf-8', 'replace').lstrip('﻿')
    lines = text.replace('\r\n', '\n').split('\n')
    out, i = {}, 0
    while i < len(lines):
        m = re.match(r'STRING (\d+)\s*$', lines[i])
        if not m:
            i += 1
            continue
        num = int(m.group(1))
        i += 1
        while i < len(lines) and lines[i].strip() != '{':   # skip '// comment' lines
            i += 1
        i += 1
        body = []
        while i < len(lines) and lines[i] != '}':
            body.append(lines[i])
            i += 1
        out[num] = '\n'.join(body)
        i += 1
    return out


class Resolver:
    """Resolve TRIGSTR_nnn references against a loaded wts table."""

    def __init__(self, wts):
        self.wts = wts

    def __call__(self, s):
        if s is None:
            return None
        if isinstance(s, bytes):
            s = s.decode('utf-8', 'replace')
        return re.sub(r'TRIGSTR_(\d+)', lambda m: self.wts.get(int(m.group(1)), m.group(0)), s)


def strip_codes(text, limit=None):
    """Remove WC3 colour/newline codes and collapse whitespace."""
    if text is None:
        return None
    t = re.sub(r'\|c[0-9a-fA-F]{8}', '', text)
    t = re.sub(r'\|[rR]', '', t)
    t = re.sub(r'\|n', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    if limit and len(t) > limit:
        t = t[:limit - 1].rstrip() + '…'
    return t


# --------------------------------------------------------------------------- object data
def parse_objects(data, leveled):
    """Parse an object-data file (format version 1/2).

    Returns (version, [original_table, custom_table]); each table is a list of
    (orig_id, new_id, mods); a mod is a dict {id, type, level, data, value(raw bytes|str)}.
    """
    p = 0

    def u32():
        nonlocal p
        v = struct.unpack_from('<I', data, p)[0]
        p += 4
        return v

    def raw(n):
        nonlocal p
        v = data[p:p + n]
        p += n
        return v

    ver = u32()
    if ver > 2:
        raise ValueError('object-data version %d not supported (only 1/2)' % ver)
    tables = []
    for _ in range(2):
        objs = []
        for _ in range(u32()):
            orig, new = raw(4), raw(4)
            mods = []
            for _ in range(u32()):
                fid, typ = raw(4), u32()
                lvl = dptr = 0
                if leveled:
                    lvl, dptr = u32(), u32()
                if typ == 3:
                    e = data.index(b'\0', p)
                    val = data[p:e]
                    p = e + 1
                else:
                    val = raw(4)
                raw(4)                                     # end marker (object id or 0)
                mods.append({'id': fid.decode('latin1'), 'type': typ, 'level': lvl,
                             'data': dptr, 'raw': val})
            objs.append((orig.decode('latin1'), new.decode('latin1') if new != NULL_ID else None, mods))
        tables.append(objs)
    if p != len(data):
        raise ValueError('trailing bytes in object data: %d' % (len(data) - p))
    return ver, tables


def decode_value(typ, raw, resolve=None):
    if typ == 0:
        return struct.unpack('<i', raw)[0]
    if typ in (1, 2):
        return round(struct.unpack('<f', raw)[0], 4)
    s = raw.decode('utf-8', 'replace')
    return resolve(s) if resolve else s


def load_object_file(path, leveled, resolve=None):
    """-> list of dicts {key, orig, new, custom(bool), mods:[{id,level,data,type,value}]}"""
    ver, tables = parse_objects(open(path, 'rb').read(), leveled)
    out = []
    for ti, objs in enumerate(tables):
        for orig, new, mods in objs:
            out.append({'key': new or orig, 'orig': orig, 'new': new, 'custom': ti == 1,
                        'mods': [dict(m, value=decode_value(m['type'], m['raw'], resolve)) for m in mods]})
    return out


# --------------------------------------------------------------------------- SLK / profiles
def load_slk(path):
    """Minimal SLK reader (C;X..;Y..;K.. records)."""
    rows, cur_y = {}, None
    for line in open(path, encoding='utf-8', errors='replace'):
        line = line.rstrip('\r\n')
        if not line.startswith('C;'):
            continue
        x = k = None
        for part in line.split(';')[1:]:
            if part.startswith('X'):
                x = int(part[1:])
            elif part.startswith('Y'):
                cur_y = int(part[1:])
            elif part.startswith('K'):
                k = part[1:]
        if k is None:
            continue
        if len(k) >= 2 and k[0] == '"' and k[-1] == '"':
            k = k[1:-1]
        rows.setdefault(cur_y, {})[x] = k
    hdr = rows[1]
    first = hdr.get(1)
    out = []
    for y in sorted(rows):
        if y == 1:
            continue
        rec = {hdr[x]: v for x, v in rows[y].items() if x in hdr}
        if first is None or first in rec:          # skip rows without an id cell
            out.append(rec)
    return out


def load_profile(paths, into=None):
    """Read ini-like profile files; later files add keys to earlier sections."""
    out = into if into is not None else {}
    for path in paths:
        sec = None
        for line in open(path, encoding='utf-8', errors='replace'):
            line = line.rstrip('\r\n')
            if line.startswith('//') or not line.strip():
                continue
            m = re.match(r'\[([^\]]+)\]', line)
            if m:
                sec = out.setdefault(m.group(1), {})
                continue
            if sec is not None and '=' in line:
                k, v = line.split('=', 1)
                sec.setdefault(k.strip().lower(), v.strip())
    return out


def split_list(v):
    """Split 'a,"b,c",d' on commas outside double quotes; strip quotes."""
    if v is None:
        return []
    out, cur, q = [], '', False
    for ch in v:
        if ch == '"':
            q = not q
        elif ch == ',' and not q:
            out.append(cur)
            cur = ''
        else:
            cur += ch
    out.append(cur)
    return out


def num(v):
    """SLK cell -> int/float/str/None ('-', '_', '' mean empty)."""
    if v is None:
        return None
    v = v.strip()
    if v in ('', '-', '_', ' - '):
        return None
    try:
        return int(v)
    except ValueError:
        try:
            return round(float(v), 4)
        except ValueError:
            return v


class BaseData:
    """Base (default) values of units, items and abilities from w3x2lni data."""

    UNIT_SLKS = {'UnitBalance': ('unitbalance.slk', 'unitBalanceID'),
                 'UnitWeapons': ('unitweapons.slk', 'unitWeapID'),
                 'UnitData': ('unitdata.slk', 'unitID'),
                 'UnitAbilities': ('unitabilities.slk', 'unitAbilID'),
                 'UnitUI': ('unitui.slk', 'unitUIID'),
                 'ItemData': ('itemdata.slk', 'itemID')}

    def __init__(self, units_dir, ui_dir=None):
        d = units_dir
        self.tables = {}
        for key, (fn, idcol) in self.UNIT_SLKS.items():
            self.tables[key] = {r[idcol]: r for r in load_slk(os.path.join(d, fn))}
        self.abil = {r['alias']: r for r in load_slk(os.path.join(d, 'abilitydata.slk'))}
        self.buff = {r['alias']: r for r in load_slk(os.path.join(d, 'abilitybuffdata.slk'))}
        self.upgr = {r['upgradeid']: r for r in load_slk(os.path.join(d, 'upgradedata.slk'))}
        prof = [os.path.join(d, f) for f in sorted(os.listdir(d)) if f.endswith('.txt')
                and not f.startswith('Misc')]
        self.profile = load_profile(prof)
        self.unit_meta = {r['ID']: r for r in load_slk(os.path.join(d, 'UnitMetaData.slk'))}
        self.abil_meta = {r['ID']: r for r in load_slk(os.path.join(d, 'AbilityMetaData.slk'))}
        self.buff_meta = {r['ID']: r for r in load_slk(os.path.join(d, 'AbilitybuffMetaData.slk'))}
        self.upgr_meta = {r['ID']: r for r in load_slk(os.path.join(d, 'UpgradeMetaData.slk'))}
        self.wes = {}
        if ui_dir:
            for fn in ('WorldEditStrings.txt', 'WorldEditGameStrings.txt'):
                p = os.path.join(ui_dir, fn)
                if os.path.exists(p):
                    for line in open(p, encoding='utf-8', errors='replace'):
                        if '=' in line:
                            k, v = line.rstrip('\r\n').split('=', 1)
                            self.wes.setdefault(k, v.strip('"'))
        self.misc = load_profile([os.path.join(d, 'MiscGame.txt')]) if os.path.exists(
            os.path.join(d, 'MiscGame.txt')) else {}

    def field_name(self, meta):
        return self.wes.get(meta.get('displayName'), meta.get('displayName')) if meta else None

    # ---- units / items (non-leveled)
    def unit_base(self, base_id, fid):
        """Default value of unit/item field `fid` for base object `base_id`."""
        meta = self.unit_meta.get(fid)
        if not meta:
            return None
        slk, field, idx = meta['slk'], meta['field'], int(meta.get('index') or -1)
        if slk == 'Profile':
            v = self.profile.get(base_id, {}).get(field.lower())
            if v is not None and idx >= 0:
                parts = split_list(v)
                v = parts[idx] if idx < len(parts) else None
            elif v is not None:
                v = v.strip('"')
            return v
        if slk == 'UnitUI' and field == 'file':
            row = self.tables['UnitUI'].get(base_id)
            return row.get('file') if row else None
        row = self.tables.get(slk, {}).get(base_id)
        if not row:
            return None
        return num(row.get(field))

    # ---- abilities (leveled)
    def abil_column(self, meta, level):
        field = meta['field']
        rep = int(meta.get('repeat') or 0)
        dat = int(meta.get('data') or 0)
        if dat > 0:
            field += 'ABCDEFGHI'[dat - 1]
        if rep > 0:
            field += str(min(max(level, 1), 4))        # SLK only stores 4 levels
        return field

    def abil_base(self, base_id, fid, level=1):
        meta = self.abil_meta.get(fid)
        if not meta:
            return None
        if meta['slk'] == 'Profile':
            v = self.profile.get(base_id, {}).get(meta['field'].lower())
            if v is None:
                return None
            rep = int(meta.get('repeat') or 0)
            idx = int(meta.get('index') or -1)
            if rep > 0:
                parts = split_list(v)
                return parts[min(level, len(parts)) - 1] if parts else None
            if idx >= 0:
                parts = split_list(v)
                return parts[idx] if idx < len(parts) else None
            return v.strip('"')
        row = self.abil.get(base_id)
        if not row:
            return None
        return num(row.get(self.abil_column(meta, level)))

    def abil_data_fields(self, base_id):
        """Meta rows of the DataA..DataI fields that apply to base ability `base_id`."""
        row = self.abil.get(base_id, {})
        codes = {base_id, row.get('code')}
        out = {}
        for fid, m in self.abil_meta.items():
            spec = m.get('useSpecific')
            if not spec or int(m.get('data') or 0) == 0:
                continue
            if codes & set(spec.split(',')):
                out[int(m['data'])] = (fid, m)
        return out


# --------------------------------------------------------------------------- JASS helpers
FUNC_RE = re.compile(r'^\s*function\s+(\w+)\s+takes', re.M)


def jass_functions(text):
    """[(name, first_line, last_line)] with 1-based line numbers."""
    out, cur = [], None
    for i, line in enumerate(text.split('\n'), 1):
        m = re.match(r'\s*function\s+(\w+)\s+takes', line)
        if m:
            cur = [m.group(1), i, None]
            out.append(cur)
        elif cur and re.match(r'\s*endfunction\b', line):
            cur[2] = i
            cur = None
    return [tuple(f) for f in out]


def function_at(funcs):
    """Return a lookup line -> function name (binary search over sorted starts)."""
    import bisect
    starts = [f[1] for f in funcs]

    def find(line):
        i = bisect.bisect_right(starts, line) - 1
        if i >= 0 and (funcs[i][2] is None or line <= funcs[i][2]):
            return funcs[i][0]
        return '<global>'
    return find


def rawcode_refs(text, funcs):
    """{'XXXX': {function_name: count}} for every 4-char rawcode literal in the script."""
    find = function_at(funcs)
    refs = {}
    for i, line in enumerate(text.split('\n'), 1):
        if "'" not in line:
            continue
        for m in re.finditer(r"'([A-Za-z0-9]{4})'", line):
            d = refs.setdefault(m.group(1), {})
            fn = find(i)
            d[fn] = d.get(fn, 0) + 1
    return refs


def prefix_of(fn):
    """System prefix of a function name ('Trig_' for GUI triggers, 'AI_' ...)."""
    if fn.startswith('InitTrig_'):
        return 'InitTrig_'
    if '_' in fn:
        return fn.split('_')[0] + '_'
    return fn


# --------------------------------------------------------------------------- trigger wiring
EVENT_RE = re.compile(r'call\s+(TriggerRegister\w+)\s*\(\s*(\w+)\s*,(.*)\)\s*$')
ACTION_RE = re.compile(r'call\s+TriggerAddAction\s*\(\s*(\w+)\s*,\s*function\s+(\w+)\s*\)')
COND_RE = re.compile(r'call\s+TriggerAddCondition\s*\(\s*(\w+)\s*,\s*(?:Condition|Filter)\s*\(\s*function\s+(\w+)\s*\)')
NEWTRIG_RE = re.compile(r'(?:local\s+trigger\s+|set\s+)(\w+)\s*=\s*CreateTrigger\s*\(\s*\)')


def short_event(reg, args):
    """'TriggerRegisterAnyUnitEventBJ', 'x,EVENT_PLAYER_UNIT_SPELL_EFFECT' -> 'SPELL_EFFECT'."""
    m = re.search(r'EVENT_(?:PLAYER_UNIT_|PLAYER_HERO_|UNIT_|PLAYER_|GAME_)?(\w+)', args)
    if m and 'Event' in reg and 'Timer' not in reg:
        return m.group(1)
    r = reg.replace('TriggerRegister', '')
    if r.startswith('Timer'):
        return 'TIMER'
    if r.startswith('PlayerChat'):
        m = re.search(r'"([^"]*)"', args)
        return 'CHAT ' + (m.group(1) if m else '')
    if r.startswith('EnterRect') or r.startswith('EnterRegion'):
        return 'ENTER_REGION'
    if r.startswith('LeaveRect') or r.startswith('LeaveRegion'):
        return 'LEAVE_REGION'
    if r.startswith('Dialog'):
        return 'DIALOG'
    if r.startswith('PlayerSelection'):
        return 'SELECTION'
    return r


def trigger_wiring(text):
    """Sequentially pair CreateTrigger() variables with their events/actions/conditions.

    Returns list of dicts {var, function, line, events[], actions[], conditions[], disabled}.
    A variable that receives a new CreateTrigger() starts a new trigger record.
    """
    trigs, cur, cur_fn = [], {}, None
    for i, line in enumerate(text.split('\n'), 1):
        s = line.strip()
        m = re.match(r'function\s+(\w+)\s+takes', s)
        if m:
            cur_fn, cur = m.group(1), {}
            continue
        m = NEWTRIG_RE.search(s)
        if m:
            rec = {'var': m.group(1), 'function': cur_fn, 'line': i, 'events': [], 'actions': [],
                   'conditions': [], 'disabled': False}
            trigs.append(rec)
            cur[m.group(1)] = rec
            continue
        m = EVENT_RE.match(s)
        if m and m.group(2) in cur:
            cur[m.group(2)]['events'].append(short_event(m.group(1), m.group(3)))
            continue
        m = ACTION_RE.search(s)
        if m and m.group(1) in cur:
            cur[m.group(1)]['actions'].append(m.group(2))
            continue
        m = COND_RE.search(s)
        if m and m.group(1) in cur:
            cur[m.group(1)]['conditions'].append(m.group(2))
            continue
        m = re.match(r'call\s+DisableTrigger\s*\(\s*(\w+)\s*\)', s)
        if m and m.group(1) in cur and cur_fn in ('main2',):
            cur[m.group(1)]['disabled'] = True
    return trigs


def call_graph(text, funcs):
    """callers[name] = set of functions whose body mentions name( or 'function name'."""
    names = {f[0] for f in funcs}
    lines = text.split('\n')
    callers = {}
    for fn, s, e in funcs:
        if e is None:
            continue
        body = '\n'.join(lines[s:e - 1])
        for m in re.finditer(r'\b([A-Za-z_]\w*)\s*\(|function\s+(\w+)|ExecuteFunc\s*\(\s*"(\w+)"', body):
            callee = m.group(1) or m.group(2) or m.group(3)
            if callee in names and callee != fn:
                callers.setdefault(callee, set()).add(fn)
    return callers


def gui_trigger_name(fn):
    """'Trig_Fan_of_Rocket_Func003C' -> 'Fan_of_Rocket' (None for non-GUI functions)."""
    m = re.match(r'^(?:Init)?Trig_(.*?)(?:_Conditions|_Actions|_Func\d{3}\w*)?$', fn)
    return m.group(1) if m else None
