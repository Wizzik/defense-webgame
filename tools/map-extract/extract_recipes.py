#!/usr/bin/env python3
"""extract_recipes.py - item recipes / fusions found in war3map.j -> recipes section of items.json

usage: python3 -I extract_recipes.py <extract_dir> <out_dir>      (rewrites <out_dir>/items.json)

Recipe mechanisms recognised (all read from the script):
  1. GUI trigger "Items Fusion" (Trig_Items_Fusion_Actions): blocks of
        RemoveItem(GetItemOfTypeFromUnitBJ(unit,'AAAA')) ... UnitAddItemByIdSwapped('RRRR', unit)
     -> all removed items are the ingredients (one of them is usually the recipe scroll that
        was bought in the Fusion Vault), RRRR is the result.
  2. GUI trigger "Item Fusion" / "Recipe System Run" (InventorySystem_*): blocks of
        InventorySystem_Objects[i] = 'AAAA' ... InventorySystem_FinalObject = 'RRRR'
     -> upgrade chains (two identical items -> next tier).
  3. GUI triggers "Item 1".."Item 5" (Trig_Item_N_Actions): the condition lists the parts
     (UnitHasItemOfTypeBJ), sometimes a minimum hero level / a required hero ability.
  4. Any other function that removes >= 2 item types and then adds one item type in the same
     function (reported as 'other_candidates' for manual review, e.g. maintainer XC_/WBM_ code).
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import w3lib  # noqa: E402

RM = re.compile(r"RemoveItem\(\s*GetItemOfTypeFromUnitBJ\([^,]+,\s*'(\w{4})'\s*\)\s*\)")
ADD = re.compile(r"UnitAddItemByIdSwapped\(\s*'(\w{4})'")
ADD2 = re.compile(r"(?:UnitAddItemById|CreateItem)\s*\([^']*'(\w{4})'")


def blocks_remove_add(body):
    out, cur = [], []
    for line in body.split('\n'):
        for m in RM.finditer(line):
            cur.append(m.group(1))
        m = ADD.search(line)
        if m:
            if cur:
                out.append({'ingredients': cur, 'result': m.group(1)})
            cur = []
    return out


def blocks_inventory(body):
    out, objs = [], {}
    for line in body.split('\n'):
        m = re.search(r"InventorySystem_Objects\[(\d+)\]\s*=\s*'(\w{4})'", line)
        if m:
            objs[int(m.group(1))] = m.group(2)
            continue
        m = re.search(r"InventorySystem_FinalObject\s*=\s*'(\w{4})'", line)
        if m:
            out.append({'ingredients': [objs[k] for k in sorted(objs)], 'result': m.group(1)})
            objs = {}
    return out


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    xdir, odir = sys.argv[1], sys.argv[2]
    text = open(os.path.join(xdir, 'war3map.j'), encoding='latin1').read()
    lines = text.split('\n')
    funcs = w3lib.jass_functions(text)
    items_path = os.path.join(odir, 'items.json')
    items = json.load(open(items_path))
    I = {i['id']: i for i in items}
    name = lambda c: I.get(c, {}).get('name', c)

    recipes = []
    other = []
    for fn, s, e in funcs:
        if e is None:
            continue
        body = '\n'.join(lines[s - 1:e])
        if fn == 'Trig_Items_Fusion_Actions':
            for b in blocks_remove_add(body):
                recipes.append(dict(b, system='GUI trigger "Items Fusion" (pick-up event, recipe scroll + parts)',
                                    function=fn))
        elif fn == 'Trig_Item_Fusion_Actions':
            for b in blocks_inventory(body):
                recipes.append(dict(b, system='GUI trigger "Item Fusion" + "Recipe System Run" (2 equal items -> next tier)',
                                    function=fn))
        elif re.fullmatch(r'Trig_Item_\d+_Actions', fn):
            # Item Event recipes: condition function Trig_Item_N_Func*C lists the required items
            cond = ''
            for cf, cs, ce in funcs:
                if cf.startswith(fn.replace('_Actions', '_Func')) and cf.endswith('C') and ce:
                    cond += '\n'.join(lines[cs - 1:ce])
            req = re.findall(r"UnitHasItemOfTypeBJ\([^,]+,\s*'(\w{4})'\)", cond)
            extra = re.findall(r"GetHeroLevel\([^)]*\)\)?\s*>=\s*(\d+)", cond)
            need_ab = re.findall(r"GetUnitAbilityLevelSwapped\('(\w{4})'", cond)
            add = ADD.findall(body)
            if add:
                recipes.append({'ingredients': req or sorted(set(RM.findall(body))), 'result': add[0],
                                'system': 'GUI trigger "%s" (pick-up event)' % fn[5:-8],
                                'function': fn, 'min_hero_level': int(extra[0]) if extra else None,
                                'requires_ability': need_ab or None})
        else:
            rm = RM.findall(body)
            add = ADD.findall(body) + ADD2.findall(body)
            if len(set(rm)) >= 2 and add:
                other.append({'function': fn, 'removes': sorted(set(rm)), 'adds': sorted(set(add)),
                              'lines': [s, e]})
    for r in recipes:
        r['result_name'] = name(r['result'])
        r['ingredient_names'] = [name(c) for c in r['ingredients']]
        r['result_gold'] = I.get(r['result'], {}).get('gold_cost')
        r['ingredients_gold'] = sum((I.get(c, {}).get('gold_cost') or 0) for c in r['ingredients'])
    # write back: items.json becomes {items, recipes, other_recipe_candidates}
    by_result = {}
    for r in recipes:
        by_result.setdefault(r['result'], []).append(r)
    for it in items:
        it['recipe'] = by_result.get(it['id'])
        it['used_in_recipes'] = [r['result'] for r in recipes if it['id'] in r['ingredients']]
    json.dump(items, open(items_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump({'recipes': recipes, 'other_recipe_candidates': other},
              open(os.path.join(odir, 'recipes.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('recipes: %d (Items Fusion %d, Item Fusion %d, Item_N %d); other remove+add functions: %d'
          % (len(recipes), sum(r['function'] == 'Trig_Items_Fusion_Actions' for r in recipes),
             sum(r['function'] == 'Trig_Item_Fusion_Actions' for r in recipes),
             sum(r['function'].startswith('Trig_Item_') and r['function'] != 'Trig_Item_Fusion_Actions'
                 for r in recipes), len(other)))
    for r in recipes:
        print('  %s %-26s <- %s' % (r['result'], (r['result_name'] or '')[:26],
                                     ' + '.join('%s' % (n or '')[:18] for n in r['ingredient_names'])))
    for o in other[:12]:
        print('  other: %s removes %s adds %s' % (o['function'], o['removes'], o['adds']))


if __name__ == '__main__':
    main()
