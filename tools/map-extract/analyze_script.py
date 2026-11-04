#!/usr/bin/env python3
"""analyze_script.py - statistics and game-flow structure of war3map.j -> script_stats.json, waves.json

usage: python3 -I analyze_script.py <extract_dir> <out_dir>

script_stats.json
  * line / function / trigger counts, lines per function-name prefix (GUI 'Trig_' vs. the
    maintainer's systems AI_, LB_, Diff_ ...), trigger events by type, natives used
    (Blz* Reforged natives, UnitDamageTarget, timers ...), GUI trigger table (event -> action)
  * rawcode references per object id (which functions mention 'A0XY')

waves.json  (reconstructed from the script; every number below is read from the code)
  * spawn calls (CreateNUnitsAtLoc / CreateUnit for Player(11)) grouped by the function that
    issues them, with count expression, unit id, spawn region
  * the regular race-wave cycle, special 'Next Wave' table (udg_real12 counter), dragon
    waves, hero waves, arenas, final wave, Death Road, Keeper of the Door
  * timers: TriggerSleepAction / StartTimerBJ / TimerStart values per flow function
  * difficulty settings from Diff_Set and the scaling functions (Diff_Mult etc.)
"""
import json
import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import w3lib  # noqa: E402

FLOW_FUNCS = [  # (function, role) - functions that make up the game flow (read from the script)
    ('Trig_PickHero_Actions', 'hero pick: hero created at rect90, +5000 gold, starting items'),
    ('Trig_Door_choose_Actions', 'number of open enemy gates (2/4/6/8) = udg_integer05'),
    ('Trig_Mode_Choice_Actions', 'hero mode dialog (single / double / triple hero)'),
    ('Trig_Difficult_choose_Actions', 'difficulty dialog (Normal / Insane / Hell)'),
    ('Diff_Set', 'difficulty values (also -normal/-insane/-hell chat)'),
    ('Start_Countdown', '60 s preparation'),
    ('Start_Go', 'starts regular waves, hero waves, Next-Wave timer, Dragon-wave timer'),
    ('Trig_SetGame_Actions', 'initial timer values (real11 = 250 s, real13 = 480 s)'),
    ('Trig_Time_Actions', 'wave-step escalation every 600 s'),
    ('Wave_Delay', 'delay between regular race waves'),
    ('Trig_Human_attack_Actions', 'regular wave: Human'),
    ('Trig_Orc_attack_Actions', 'regular wave: Orc'),
    ('Trig_Undead_attack_Actions', 'regular wave: Undead'),
    ('Trig_Night_attack_Actions', 'regular wave: Night Elf'),
    ('Trig_Human_attack_Hero_Actions', 'hero wave 1a (Insane/Hell)'),
    ('Trig_Human_attack_Hero_2_Actions', 'hero wave 1b'),
    ('Trig_Orb_attack_Hero_Actions', 'hero wave 2a'),
    ('Trig_Orb_attack_Hero_2_Actions', 'hero wave 2b'),
    ('Trig_Night_attack_Hero_Actions', 'hero wave 3a'),
    ('Trig_Night_attack_Hero_2_Actions', 'hero wave 3b'),
    ('Trig_Undead_attack_Hero_Actions', 'hero wave 4a'),
    ('Trig_Undead_attack_Hero_2_Actions', 'hero wave 4b'),
    ('Trig_Time_Next_Wave_Actions', 'Next-Wave timer = real11 * 1.2'),
    ('Trig_TimeNW_Ex_Actions', 'special Next Wave (table indexed by udg_real12)'),
    ('Trig_Dragon_Wave_Time_Actions', 'Dragon-wave timer = real13 * 1.2'),
    ('Trig_Dragon_Wave_Time_Ex_Actions', 'dragon wave'),
    ('Trig_Bua_lun_Actions', 'Special Event 1 timer'),
    ('Trig_Bua_lun_Ex_Actions', 'Special Event 1 (survive the enemy hero)'),
    ('Trig_Bua_lun_2_Actions', 'Special Event 2 timer'),
    ('Trig_Bua_lun_Ex_2_Actions', 'Special Event 2'),
    ('Trig_Bua_lun_3_Actions', 'Special Event 3 timer'),
    ('Trig_Bua_lun_Ex_3_Actions', 'Special Event 3 (God of Blade O01C)'),
    ('Trig_ItemEventTime_Actions', 'Item Event timer'),
    ('Trig_ItemEventTime_Ex_Actions', 'Item Event (fight for a prize item)'),
    ('Trig_Arena_1_Actions', 'Arena 1'), ('Trig_Arena_2_Actions', 'Arena 2'),
    ('Trig_Arena_3_Actions', 'Arena 3'), ('Trig_Arena_4_Actions', 'Arena 4'),
    ('Trig_Tes_Final_Actions', 'final wave check: all enemy gates destroyed'),
    ('Trig_Final_Actions', 'final wave countdown (60 s)'),
    ('Trig_Final_Ex_Actions', 'final wave: golem bosses + Lord of Hell'),
    ('Trig_Hero_Final_Actions', 'final heroes: the four Ambassadors'),
    ('Trig_End_Actions', 'after the final wave -> Death Road'),
    ('Trig_Blood_Actions', 'Death Road countdown'),
    ('Trig_Blood_Ex_Actions', 'Death Road start'),
    ('Trig_Blood_1_Actions', 'Death Road stage 1'), ('Trig_Blood_1_End_Actions', 'Death Road stage 1 end'),
    ('Trig_Blood_2_Actions', 'Death Road stage 2'), ('Trig_Blood_2_End_Actions', 'Death Road stage 2 end'),
    ('Trig_Blood_3_Actions', 'Death Road stage 3'), ('Trig_Blood_3_End_Actions', 'Death Road stage 3 end'),
    ('Trig_Kepper_of_the_Door_Actions', 'last boss: Keeper of the Door N00L'),
    ('Trig_Victory_Actions', 'victory (2 min of free play)'),
    ('Trig_Gane_over_Actions', 'defeat: Castle (udg_unit80) died'),
    ('Trig_Lightning_Monter_choice_Actions', 'mission boss: Lightning Monter Slip'),
    ('Trig_Fire_Monter_choice_Actions', 'mission boss: Fire Monter Magma'),
    ('Trig_Fost_monter_choice_Actions', 'mission boss: Fost Ice Scream'),
    ('Trig_Osin_choice_Actions', 'mission boss: S0uLy'),
    ('Trig_ALL_100_choice_Actions', 'mission: +100 all stats for 5000 gold'),
    ('Trig_ALL_200_choice_Actions', 'mission: +200 all stats for 8000 gold'),
    ('Trig_HP_Actions', 'every 300 s: enemy upgrade Robs, kill bounty +100 gold'),
    ('Trig_Level_Ability_and_Atribute_Actions', 'every 600 s: enemy upgrade R00A'),
]

NATIVE_GROUPS = {
    'unit creation': r'\bCreateUnit\w*\b|\bCreateNUnitsAtLoc\b',
    'damage by script': r'\bUnitDamageTarget(BJ)?\b|\bUnitDamagePoint\w*\b',
    'damage event engine': r'\bTriggerRegisterUnitEvent\w*\b.*EVENT_UNIT_DAMAGED|udg_DamageEvent\w+',
    'special effects': r'\bAddSpecialEffect\w*\b',
    'lightning effects': r'\bAddLightning\w*\b',
    'text tags (floating text)': r'\bCreateTextTag\w*\b',
    'orders issued': r'\bIssue\w+Order\w*\b',
    'unit abilities add/remove/level': r'\bUnitAddAbility\w*\b|\bUnitRemoveAbility\w*\b|\bSetUnitAbilityLevel\w*\b|\bIncUnitAbilityLevel\w*\b',
    'hero stats': r'\bSetHero(Str|Agi|Int)\b|\bModifyHeroStat\b|\bGetHero(Str|Agi|Int)\b',
    'Blz* (Reforged 1.31+ natives)': r'\bBlz\w+\b',
    'hashtables': r'\b(Save|Load)(Integer|Real|Boolean|Str|UnitHandle)\w*\b',
    'groups / enumeration': r'\bGroupEnumUnits\w*\b|\bGetUnitsIn\w+\b|\bForGroup(BJ)?\b',
    'timers': r'\bTimerStart\b|\bStartTimerBJ\b|\bCreateTimer\b',
    'waits (TriggerSleepAction)': r'\bTriggerSleepAction\b|\bPolledWait\b',
    'dialogs': r'\bDialog\w+\b',
    'cinematics / camera': r'\bCinematic\w*\b|\bPanCamera\w*\b|\bCameraSetup\w*\b|\bTransmission\w*\b',
    'fog / visibility': r'\bFogModifier\w*\b|\bCreateFogModifier\w*\b',
    'items': r'\bUnitAddItem\w*\b|\bCreateItem\b|\bRemoveItem\b|\bUnitRemoveItem\w*\b',
    'player resources': r'PLAYER_STATE_RESOURCE_(GOLD|LUMBER)',
    'sounds / music': r'\bPlaySound\w*\b|\bStartSound\b|\bPlayMusic\w*\b|\bSetMapMusic\b',
    'leaderboard / multiboard': r'\bLeaderboard\w*\b|\bMultiboard\w*\b',
    'weather': r'\bAddWeatherEffect\b|\bEnableWeatherEffect\b',
}


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    xdir, odir = sys.argv[1], sys.argv[2]
    text = open(os.path.join(xdir, 'war3map.j'), encoding='latin1').read()
    lines = text.split('\n')
    funcs = w3lib.jass_functions(text)
    F = {f[0]: f for f in funcs}
    find = w3lib.function_at(funcs)
    trigs = w3lib.trigger_wiring(text)

    # ----------------------------------------------------------- statistics
    pref_lines, pref_funcs = Counter(), Counter()
    for n, s, e in funcs:
        p = w3lib.prefix_of(n)
        pref_funcs[p] += 1
        pref_lines[p] += (e - s + 1) if e else 0
    ev = Counter(e for t in trigs for e in set(t['events']))
    natives = {}
    for k, pat in NATIVE_GROUPS.items():
        natives[k] = len(re.findall(pat, text))
    blz = Counter(re.findall(r'\b(Blz\w+)\b', text))
    gui = [{'var': t['var'], 'actions': t['actions'], 'events': sorted(set(t['events'])),
            'disabled_at_start': t['disabled'], 'defined_in': t['function']} for t in trigs]
    custom_init = []
    s = text.find('function InitCustomTriggers takes')
    e = text.find('\nendfunction', s)
    for m in re.finditer(r'call\s+(\w+)\s*\(', text[s:e]):
        custom_init.append(m.group(1))
    stats = {
        'bytes': len(text.encode('latin1')), 'lines': len(lines), 'functions': len(funcs),
        'CreateTrigger_calls': len(re.findall(r'CreateTrigger\s*\(\s*\)', text)),
        'trigger_records': len(trigs),
        'triggers_disabled_at_start': sum(t['disabled'] for t in trigs),
        'gui_trigger_functions_Trig_': pref_funcs['Trig_'],
        'header': [l for l in lines[:12] if l.startswith('//')],
        'lines_per_prefix': dict(sorted(pref_lines.items(), key=lambda x: -x[1])),
        'functions_per_prefix': dict(sorted(pref_funcs.items(), key=lambda x: -x[1])),
        'trigger_events_by_type': dict(ev.most_common()),
        'native_usage_counts': natives, 'blz_natives': dict(blz.most_common()),
        'InitCustomTriggers_calls': custom_init,
        'gui_triggers': gui,
    }

    # ----------------------------------------------------------- spawns
    spawn_re = re.compile(r"CreateNUnitsAtLoc\(\s*([^,]+?)\s*,\s*'(\w{4})'\s*,\s*Player\((\d+)\)\s*,\s*"
                          r"(?:LR_RectCenter\(([^)]+)\)|LR_UnitLoc\(([^)]+\)?)\)|([^,]+))")
    cu_re = re.compile(r"CreateUnit\(\s*Player\((\d+)\)\s*,\s*'(\w{4})'\s*,\s*([^,]+),\s*([^,]+),")
    spawns = defaultdict(list)
    for i, l in enumerate(lines, 1):
        fn = find(i)
        if fn.startswith(('CreateUnitsForPlayer', 'CreateBuildingsForPlayer', 'CreateNeutral')):
            continue
        for m in spawn_re.finditer(l):
            if m.group(3) != '11':
                continue
            spawns[fn].append({'line': i, 'count': m.group(1), 'unit': m.group(2),
                               'at': (m.group(4) or m.group(5) or m.group(6) or '').strip()})
        for m in cu_re.finditer(l):
            if m.group(1) == '11':
                spawns[fn].append({'line': i, 'count': '1', 'unit': m.group(2),
                                   'at': '(%s, %s)' % (m.group(3).strip(), m.group(4).strip())})

    # ----------------------------------------------------------- Next-Wave table (udg_real12 index)
    nw = []
    n, s, e = F['Trig_TimeNW_Ex_Actions']
    conds = {}
    for cn, cs, ce in funcs:          # condition functions 'if(not(udg_real12==k))' / '>=10'
        if cn.startswith('Trig_TimeNW_Ex_Func') and cn.endswith('C'):
            body = '\n'.join(lines[cs - 1:ce])
            m = re.search(r'udg_real12\s*(==|>=)\s*([\d.]+)', body)
            if m:
                conds[cn] = (m.group(1), float(m.group(2)))
    stack = []
    for i in range(s, e + 1):
        l = lines[i - 1].strip()
        m = re.match(r'if\s*\((\w+)\(\)\)\s*then', l)
        if m:
            stack.append(conds.get(m.group(1)))
            continue
        if l.startswith('else'):
            if stack:
                stack[-1] = ('not', stack[-1])
            continue
        if l.startswith('endif'):
            if stack:
                stack.pop()
            continue
        m = spawn_re.search(l)
        if m and m.group(3) == '11':
            active = [c for c in stack if c and c[0] != 'not']
            key = active[-1] if active else None
            label = ('wave %d' % int(key[1])) if key and key[0] == '==' else (
                'wave >= %d' % int(key[1]) if key else '?')
            nw.append({'line': i, 'special_wave': label, 'count': m.group(1), 'unit': m.group(2),
                       'at': (m.group(4) or m.group(5) or m.group(6) or '').strip()})

    # ----------------------------------------------------------- timer values per flow function
    def timing(fn):
        if fn not in F:
            return None
        n, s, e = F[fn]
        body = '\n'.join(lines[s - 1:e])
        return {
            'sleeps': [x.strip() for x in re.findall(r'TriggerSleepAction\(([^)]*)\)', body)],
            'timers': [x.strip() for x in re.findall(r'(?:StartTimerBJ\(\w+,\s*\w+,|TimerStart\(\w+,)\s*([^,)]+)', body)],
            'texts': [w3lib.strip_codes(x, 140) for x in re.findall(r'Display\w*TextToForce\([^"]*"([^"]*)"', body)][:6],
            'spawns': [(sp['count'], sp['unit'], sp['at']) for sp in spawns.get(fn, [])],
            'lines': [s, e],
        }

    flow = [{'function': fn, 'role': role, **(timing(fn) or {'missing': True})} for fn, role in FLOW_FUNCS]

    # ----------------------------------------------------------- difficulty settings (Diff_Set)
    diff = {}
    n, s, e = F['Diff_Set']
    body = '\n'.join(lines[s - 1:e])
    for d, chunk in zip((1, 2, 3), re.split(r'\n\s*(?:if d == 1 then|elseif d == 2 then|else\n)', body)[1:4]):
        vals = dict(re.findall(r'set (udg_integer0[1-4]|udg_boolean02) = (\w+)', chunk))
        diff[{1: 'Normal', 2: 'Insane', 3: 'Hell'}[d]] = {
            'footman_slot_count_integer01': 3, 'slot2_count_integer02': vals.get('udg_integer02'),
            'slot3_count_integer03': vals.get('udg_integer03'), 'slot4_count_integer04': vals.get('udg_integer04'),
            'arena_monsters_integer12': 30,
            'techs': re.findall(r"Diff_Tech\('(\w{4})', (\d), (\w+)\)", chunk)}

    def src(fn):
        n, s, e = F[fn]
        return '\n'.join(l.rstrip() for l in lines[s - 1:e])

    waves = {
        'notes': [
            'Regular race waves: Human -> Orc -> Undead -> Night Elf -> Human ... (each trigger executes the next '
            'after Wave_Delay()). Per open gate (udg_rects01[1..udg_integer05], only while that gate building '
            'udg_units01[i] is alive) each wave spawns integer01/02/03/04 units of the 4 unit types of the race.',
            'Wave_Delay: Normal 30 - 2.5*k s, Insane/Hell 20 - 1.25*k s, k = udg_WaveStep (0..4, +1 at 600/1200/1800/2800 s).',
            'Hero waves (Insane/Hell only): 2 enemy heroes per open gate, then 15 s, 2 more, then 60 s, next race.',
            'Special "Next Wave": timer real11*1.2 (250*1.2 = 300 s; after special wave 9 real11 = 60 -> 72 s); '
            'composition indexed by udg_real12 (1, 2, 3 ...).',
            'Dragon waves (Hell only per Diff_Set comment / StartQ124): timer real13*1.2 = 576 s, spawn at udg_rects02.',
            'Regular-wave units, hero-wave heroes and the per-gate dragons of special waves are scaled once at spawn by Diff_ScaleUnit (Diff_Mult, via Diff_ScaleLast); the main groups of the special Next Waves are not (they carry upgrade R000, researched on Insane/Hell by Diff_Set).',
        ],
        'regular_wave_units': {
            'Human': ['hfoo', 'hrif', 'hkni', 'hmpr'], 'Orc': ['ogru', 'ohun', 'otau', 'oshm'],
            'Undead': ['ugho', 'ucry', 'uabo', 'unec'], 'Night Elf': ['esen', 'earc', 'emtg', 'edoc']},
        'difficulty_counts_per_gate': diff,
        'open_gates_choice_integer05': [2, 4, 6, 8],
        'spawn_regions': {
            'udg_rects01 (8 gates, regular + hero waves)': ['udg_rect01', 'udg_rect02', 'udg_rect03', 'udg_rect04',
                                                          'udg_rect05', 'udg_rect06', 'udg_rect07', 'udg_rect08'],
            'udg_rects02 (dragon waves)': ['udg_rect25', 'udg_rect26', 'udg_rect27', 'udg_rect28', 'udg_rect22',
                                           'udg_rect21', 'udg_rect23', 'udg_rect24'],
            'gate buildings udg_units01[1..8] (unp2)': ['udg_unit59', 'udg_unit57', 'udg_unit67', 'udg_unit62',
                                                        'udg_unit61', 'udg_unit60', 'udg_unit58', 'udg_unit63']},
        'special_next_wave_table': nw,
        'flow': flow,
        'spawns_by_function': spawns,
        'scaling_source': {fn: src(fn) for fn in ('Wave_Delay', 'Diff_Mult', 'Diff_ScaleUnit', 'Hell_ArmorCut',
                                                  'Hell_ArmorHalf', 'Amb_Mult', 'FB_Scale', 'Boss_Scale',
                                                  'Boss_Double', 'Boss_Harder', 'Keeper_Boost',
                                                  'LordOfHell_Nerf', 'FG_Scale', 'DR_Scale', 'DR_ScaleHero',
                                                  'Arena_TowerBuff', 'HeroPower_Total', 'XB_BaseXP',
                                                  'Diff_Set') if fn in F},
    }
    os.makedirs(odir, exist_ok=True)
    json.dump(stats, open(os.path.join(odir, 'script_stats.json'), 'w', encoding='utf-8'), indent=1)
    json.dump(waves, open(os.path.join(odir, 'waves.json'), 'w', encoding='utf-8'), indent=1)
    print('lines %d, functions %d, CreateTrigger %d, trigger records %d (disabled at start %d)'
          % (stats['lines'], stats['functions'], stats['CreateTrigger_calls'], len(trigs),
             stats['triggers_disabled_at_start']))
    print('spawning functions: %d, special Next-Wave spawn rows: %d, flow functions: %d (missing %d)'
          % (len(spawns), len(nw), len(flow), sum(1 for f in flow if f.get('missing'))))


if __name__ == '__main__':
    main()
