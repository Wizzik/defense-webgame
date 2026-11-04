#!/usr/bin/env python3
"""classify_abilities.py - add an auto-cast design classification to heroes.json / abilities.json

usage: python3 -I classify_abilities.py <out_dir>          (reads and rewrites heroes.json, abilities.json)

For every hero ability it adds:
  autocast_class   one of: targeted_nuke, aoe_around_caster, aoe_at_target, line_skillshot, summon,
                   buff_aura, passive_on_hit, transformation, heal, movement_blink, other
  implementation   'engine'            - effect comes only from the base WC3 ability
                   'engine+script'     - base ability plus script code that modifies / adds to it
                   'script'            - a GUI trigger implements the effect (dummy base ability)
                   (AI_ references are ignored - they only make computer heroes cast the spell;
                    LB_ = late-game bonus damage added on cast, counted as 'engine+script')
  script_triggers  GUI trigger names referencing the rawcode
  script_systems   maintainer system prefixes (LB, HW, BAL, ...) referencing the rawcode

The class comes from the BASE ability (how the engine behaves) and is overridden for abilities
whose effect is clearly re-implemented by a trigger (OVERRIDES below, decided from the trigger
code: e.g. 'Kamezoko' is a Carrion Swarm dummy whose real effect is a moving projectile unit).
This is a heuristic for planning a port, not engine truth - see notes 'Uncertainties'.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import w3lib  # noqa: E402

BASE_CLASS = {
    # damage around the caster
    'AHtc': 'aoe_around_caster', 'AOws': 'aoe_around_caster', 'AEfk': 'aoe_around_caster',
    'AEim': 'aoe_around_caster', 'ANpi': 'aoe_around_caster', 'AOww': 'aoe_around_caster',
    'AUfn': 'aoe_at_target', 'AEsf': 'aoe_around_caster', 'AUls': 'aoe_around_caster',
    'ANst': 'line_skillshot', 'Aroa': 'buff_aura',
    # damage at a target point / area
    'AHbz': 'aoe_at_target', 'AUdd': 'aoe_at_target', 'ACbc': 'line_skillshot', 'ANmo': 'aoe_at_target',
    'ANcs': 'aoe_at_target', 'AUin': 'summon',
    # lines / waves
    'AUcs': 'line_skillshot', 'AOs2': 'line_skillshot', 'ANsh': 'line_skillshot', 'AUim': 'line_skillshot',
    # single target
    'AHtb': 'targeted_nuke', 'AOcl': 'targeted_nuke', 'ANfl': 'targeted_nuke', 'AUdc': 'targeted_nuke',
    'ANdr': 'targeted_nuke', 'AEsh': 'targeted_nuke', 'ANdo': 'targeted_nuke', 'AOhx': 'targeted_nuke',
    'ANba': 'passive_on_hit', 'AHfa': 'passive_on_hit', 'AOvd': 'buff_aura',
    # passives
    'AOcr': 'passive_on_hit', 'AHbh': 'passive_on_hit', 'ANca': 'passive_on_hit', 'AEev': 'passive_on_hit',
    'AUts': 'passive_on_hit', 'Aroc': 'passive_on_hit', 'Aamk': 'other',
    # auras / buffs
    'AEar': 'buff_aura', 'AOae': 'buff_aura', 'AHad': 'buff_aura', 'AUav': 'buff_aura', 'AEah': 'buff_aura',
    'ACac': 'buff_aura', 'Ablo': 'buff_aura', 'Absk': 'buff_aura', 'Ainf': 'buff_aura', 'ANms': 'buff_aura',
    'Alsh': 'buff_aura',
    # summons
    'AHwe': 'summon', 'AOsf': 'summon', 'ANsg': 'summon', 'AOsw': 'summon', 'AUcb': 'summon', 'AOmi': 'summon',
    # heals
    'AOhw': 'heal', 'AEtq': 'heal',
    # transformations
    'AHav': 'transformation',
    # movement
    'AOwk': 'movement_blink',
    # other
    'ANtm': 'other', 'AIct': 'other', 'ANcl': 'other',
}

# decided from the GUI trigger bodies (effect re-implemented by script)
OVERRIDES = {
    'A04R': ('line_skillshot', 'Kamezoko: projectile unit h015 moved by timer, damages in 300-350 radius'),
    'A0BD': ('line_skillshot', 'WaveForm: caster slides along a line, damage on the way'),
    'A01S': ('line_skillshot', 'FireSlice: moving fire units h01R'),
    'A05A': ('line_skillshot', 'Fost Slice: moving ice units'),
    'A05K': ('line_skillshot', 'Xich Merang: boomerang unit h01J out and back'),
    'A00D': ('line_skillshot', 'Move Slice: caster dashes, damage around'),
    'A06L': ('aoe_around_caster', 'Fan of Rocket: rockets + hero attack damage'),
    'A04F': ('targeted_nuke', 'Chain Lightning + extra lightning dummies'),
    'A08W': ('aoe_around_caster', 'FireTime: summon base used as trigger hook (HonorFire)'),
    'A008': ('summon', 'Catch Soul: souls caught from killed units'),
    'A05S': ('summon', 'Hawk: summoned by trigger (does not scale with stats)'),
    'A05X': ('summon', 'Summon Zergling: zerglings z000-z003'),
    'A0AL': ('summon', 'Frost Wyrm u005/u00N/u00O/u00P'),
    'A0AV': ('summon', 'Kodo Beast'),
    'A0B2': ('passive_on_hit', 'Storm: attack-proc spell via CoverAttack trigger'),
    'A0B3': ('passive_on_hit', 'Storm: attack-proc spell via CoverAttack trigger'),
    'A0B4': ('passive_on_hit', 'Storm: attack-proc spell via CoverAttack trigger'),
    'A06R': ('passive_on_hit', 'Super Bash: area bash by trigger'),
    'A06U': ('passive_on_hit', 'Vampiric Aura re-done as life steal by trigger'),
    'A0AZ': ('passive_on_hit', 'Poison String: on kill / on hit by trigger'),
    'A039': ('passive_on_hit', 'Mutip Shot: extra arrows by trigger (disabled at start, enabled on learn)'),
    'A04C': ('passive_on_hit', 'Mutip Strike: extra strikes by trigger'),
    'A03D': ('passive_on_hit', 'Electric Auto: attack proc by trigger'),
    'AUts': ('passive_on_hit', 'Spiked Carapace + Impale Return trigger'),
    'A000': ('passive_on_hit', 'Crosin Strike: attack proc by trigger'),
    'A00L': ('passive_on_hit', 'EarthWave: attack proc by trigger'),
    'AEar': ('passive_on_hit', 'Darkshot Aura: DarkAura trigger adds damage on attack'),
    'A03W': ('heal', 'Regen Aura: periodic heal by trigger'),
    'A073': ('passive_on_hit', 'Thorns Aura re-done by trigger'),
    'A074': ('heal', 'Tranquility: heals % HP (TQ_ system)'),
    'A070': ('targeted_nuke', 'Holaroot: chain root (HR_ system)'),
    'A06Y': ('aoe_at_target', 'CoverRoot: roots in an area by trigger'),
    'A00R': ('transformation', 'Avatar (Demon trigger adds effects)'),
    'A05Y': ('transformation', 'Grow Up: hero grows per level (trigger)'),
    'A03H': ('movement_blink', 'Wind Walk + trigger'),
    'A00S': ('line_skillshot', 'Wind Slice: wind-walk base, trigger adds slice damage'),
    'A0CO': ('other', 'Change Reality: trigger'),
    'A088': ('aoe_around_caster', 'All Stop: Thunder Clap base + Death Prevent trigger'),
    'A01F': ('other', 'Eat Time: trigger effect'),
}


def classify(a):
    fs = a.get('jass_functions', [])
    gui = sorted({w3lib.gui_trigger_name(f) for f in fs if w3lib.gui_trigger_name(f)})
    systems = sorted({w3lib.prefix_of(f).rstrip('_') for f in fs if not w3lib.gui_trigger_name(f)} - {'AI'})
    if a['id'] in OVERRIDES:
        cls, why = OVERRIDES[a['id']]
    else:
        cls, why = BASE_CLASS.get(a['base'], 'other'), 'from base ability %s' % a['base']
    if gui:
        impl = 'script' if a['id'] in OVERRIDES else 'engine+script'
    elif systems:
        impl = 'engine+script'
    else:
        impl = 'engine'
    return {'autocast_class': cls, 'class_reason': why, 'implementation': impl,
            'script_triggers': gui, 'script_systems': systems}


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    odir = sys.argv[1]
    hp, ap = os.path.join(odir, 'heroes.json'), os.path.join(odir, 'abilities.json')
    heroes, abils = json.load(open(hp)), json.load(open(ap))
    AO = {a['id']: a for a in abils}
    counts = {}
    for h in heroes:
        for a in h['hero_abilities']:
            c = classify(a)
            a.update(c)
            if a['id'] in AO:
                AO[a['id']].update(c)
            counts[(c['autocast_class'], c['implementation'])] = counts.get((c['autocast_class'], c['implementation']), 0) + 1
    json.dump(heroes, open(hp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(abils, open(ap, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    tot = sum(counts.values())
    print('hero ability slots classified:', tot)
    by_cls, by_impl = {}, {}
    for (c, i), n in counts.items():
        by_cls[c] = by_cls.get(c, 0) + n
        by_impl[i] = by_impl.get(i, 0) + n
    print('by class:', dict(sorted(by_cls.items(), key=lambda x: -x[1])))
    print('by implementation:', by_impl)


if __name__ == '__main__':
    main()
