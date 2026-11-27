import type { GameData, Rarity, RoleTag, SlotType } from "../../data/schema";
import { RARITIES, ROLE_TAGS, SLOT_TYPES } from "../../data/schema";
import { recordByUid, recordItem } from "../../meta";
import { createRun, SLOT_IDS } from "../../sim";
import type { GearSession } from "../game/gear-session";
import { compareTarget, gridList } from "./collection-grid";
import { Doll, type DollSlotView, type DollTotals } from "./doll";
import { el, setText } from "./dom";
import { type Lang, type MessageKey, t } from "./i18n";
import { iconSvg } from "./item-icons";
import { ItemTooltip, tooltipLines } from "./item-tooltip";

/**
 * The gear screen of the menu: the chosen hero's doll on the left (a click on a slot takes the item off), the
 * collection on the right (a click on an owned item puts it on) with filters by slot, role and rarity, the sort by
 * power and the salvage mode (a click on a random item nobody wears turns it into bank gold), export and import of
 * the saved gear below.
 */
export class GearScreen {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly doll: Doll;
  private readonly tooltip: ItemTooltip;
  private readonly filters: HTMLElement;
  private readonly subFilters: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly count: HTMLElement;
  private readonly bank: HTMLElement;
  /** The sort and salvage buttons, beside the count under the grid. */
  private readonly tools: HTMLElement;
  private readonly message: HTMLElement;
  private readonly exportButton: HTMLButtonElement;
  private readonly importButton: HTMLButtonElement;
  private readonly back: HTMLButtonElement;
  private readonly data: GameData;
  private readonly gear: GearSession;
  private readonly onClose: (changed: boolean) => void;
  private heroId = "";
  private lang: Lang = "en";
  private filter: SlotType | "all" = "all";
  private role: RoleTag | "all" = "all";
  private rarity: Rarity | "all" = "all";
  private sort: "rarity" | "power" = "rarity";
  /** Salvage mode: a click on a random item salvages it instead of putting it on. */
  private salvaging = false;
  private changed = false;

  private readonly onEquip: () => void;

  constructor(parent: HTMLElement, deps: { data: GameData; gear: GearSession; onClose(changed: boolean): void; onEquip?(): void }) {
    this.data = deps.data;
    this.gear = deps.gear;
    this.onClose = deps.onClose;
    this.onEquip = deps.onEquip ?? (() => {});
    this.root = el("div", "screen gear-screen", parent);
    this.root.id = "gear-screen";
    this.root.hidden = true;
    const frame = el("div", "gear-frame wide", this.root);
    this.title = el("h2", "gear-title", frame);
    const columns = el("div", "gear-columns", frame);
    this.tooltip = new ItemTooltip(this.root);
    const left = el("div", "gear-left", columns);
    this.doll = new Doll(left, {
      lang: this.lang, heroName: "", data: deps.data, tooltip: this.tooltip,
      onSlotClick: (slot) => {
        this.gear.unequip(this.heroId, slot);
        this.changed = true;
        this.render();
      },
    });
    const right = el("div", "gear-right", columns);
    this.filters = el("div", "gear-filters", right);
    this.subFilters = el("div", "gear-filters gear-subfilters", right);
    this.grid = el("div", "gear-grid", right);
    const tools = el("div", "gear-tools", right);
    this.count = el("p", "gear-count", tools);
    this.count.id = "gear-count";
    this.tools = el("span", "gear-tool-buttons", tools);
    this.bank = el("p", "gear-bank", right);
    this.bank.id = "gear-bank";
    const bottom = el("div", "gear-bottom", frame);
    this.exportButton = el("button", "button small", bottom);
    this.exportButton.id = "gear-export";
    this.exportButton.addEventListener("click", () => this.exportFile());
    this.importButton = el("button", "button small", bottom);
    this.importButton.id = "gear-import";
    const input = el("input", "", bottom);
    input.type = "file";
    input.accept = ".json,application/json";
    input.id = "gear-import-file";
    input.hidden = true;
    this.importButton.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.value = "";
      if (file) void file.text().then((text) => this.importText(text), () => this.importText(""));
    });
    this.back = el("button", "button primary", bottom);
    this.back.id = "gear-back";
    this.back.addEventListener("click", () => this.close());
    this.message = el("p", "gear-message", frame);
    this.message.id = "gear-message";
    addEventListener("keydown", (event) => {
      if (event.code === "Escape" && this.isOpen) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(heroId: string, lang: Lang): void {
    this.heroId = heroId;
    this.lang = lang;
    this.changed = false;
    this.filter = "all";
    this.role = "all";
    this.rarity = "all";
    this.sort = "rarity";
    this.salvaging = false;
    setText(this.message, "");
    this.doll.setLang(lang);
    this.root.hidden = false;
    this.render();
    this.back.focus();
  }

  close(): void {
    if (!this.isOpen) return;
    this.tooltip.hide();
    this.root.hidden = true;
    this.onClose(this.changed);
  }

  /** Replaces the gear by the text of an exported file and says how it went. */
  importText(text: string): void {
    const result = this.gear.importText(text);
    if (result.ok) {
      this.changed = true;
      setText(this.message, result.dropped > 0 ? t(this.lang, "gear.importedPartly", { n: result.dropped }) : t(this.lang, "gear.imported"));
    } else {
      setText(this.message, t(this.lang, "gear.importFailed"));
    }
    this.message.dataset.ok = String(result.ok);
    this.render();
  }

  private exportFile(): void {
    const url = URL.createObjectURL(new Blob([this.gear.exportText()], { type: "application/json" }));
    const link = el("a", "", this.root);
    link.href = url;
    link.download = "defense-webgame-gear.json";
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  /** The hero at level 1 with the doll on: a scratch run gives exactly the numbers a run starts with. */
  private totals(): DollTotals {
    const { hero } = createRun(this.data, { seed: 0, hero: this.heroId, loadout: this.gear.loadout(this.heroId) });
    return {
      ...hero.stats, str: hero.str + hero.gear.str, agi: hero.agi + hero.gear.agi, int: hero.int + hero.gear.int,
      magicFind: hero.gear.magicFind,
      lifesteal: hero.gear.lifesteal,
    };
  }

  private render(): void {
    const { data, gear, lang, heroId } = this;
    const { save } = gear;
    const hero = data.heroes.find((candidate) => candidate.id === heroId);
    setText(this.title, t(lang, "gear.title"));
    setText(this.exportButton, t(lang, "gear.export"));
    setText(this.importButton, t(lang, "gear.import"));
    setText(this.back, t(lang, "gear.back"));
    this.doll.setHeroName(hero ? hero.name[lang] : heroId);
    const slots: DollSlotView[] = [];
    const loadout = save.loadouts[heroId] ?? {};
    for (const slot of SLOT_IDS) {
      const uid = loadout[slot];
      const record = uid === undefined ? undefined : recordByUid(save, uid);
      const item = record ? recordItem(data, record) : null;
      if (record && item) slots.push({ slot, item, level: record.level, temp: 0 });
    }
    this.doll.render(slots, this.totals());

    this.filters.replaceChildren();
    for (const type of ["all", ...SLOT_TYPES] as const) {
      const button = el("button", "gear-filter", this.filters);
      button.type = "button";
      button.dataset.filter = type;
      const label = type === "all" ? t(lang, "gear.filterAll") : t(lang, `slot.${type}` as MessageKey);
      if (type === "all") button.textContent = label;
      else button.innerHTML = iconSvg(type);
      button.title = label;
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-pressed", String(type === this.filter));
      button.addEventListener("click", () => {
        this.filter = type;
        this.render();
      });
    }

    this.renderSubFilters();

    this.grid.replaceChildren();
    this.grid.classList.toggle("salvaging", this.salvaging);
    const list = gridList(data, save, heroId, this.filter, { role: this.role, rarity: this.rarity, sort: this.sort });
    for (const entry of list.entries) {
      const { item } = entry;
      const cell = el("button", entry.owned ? `doll-slot rarity-${item.rarity}` : "doll-slot empty missing", this.grid);
      cell.type = "button";
      cell.dataset.item = item.id;
      if (entry.uid > 0) cell.dataset.uid = String(entry.uid);
      cell.dataset.role = entry.role;
      if (entry.salvageable) cell.dataset.salvage = "1";
      cell.setAttribute("aria-label", item.name[lang]);
      cell.innerHTML = iconSvg(item.slotType);
      if (entry.equipped) cell.classList.add("equipped");
      if (entry.owned && entry.level > 1) el("span", "slot-level", cell, String(entry.level));
      if (entry.owned) {
        cell.addEventListener("click", () => {
          if (this.salvaging) {
            this.salvageEntry(entry.uid, entry.salvageable);
            return;
          }
          this.gear.equip(heroId, entry.uid);
          this.onEquip();
          this.changed = true;
          this.render();
        });
      } else {
        cell.setAttribute("aria-disabled", "true");
      }
      const show = (): void => {
        const info = tooltipLines(lang, data, item, Math.max(1, entry.level), 0, entry.owned ? compareTarget(data, save, heroId, item, entry.uid) : undefined);
        if (!entry.owned) info.sub = info.sub.replace(/[^·]+$/, ` ${t(lang, "gear.notOwned")}`);
        if (this.salvaging) {
          info.source = entry.salvageable
            ? t(lang, "gear.salvageValue", { gold: data.rules.loot.salvageGold[item.rarity] })
            : t(lang, "gear.salvageRefused");
        }
        this.tooltip.show(cell, info);
      };
      cell.addEventListener("mouseenter", show);
      cell.addEventListener("focus", show);
      cell.addEventListener("mouseleave", () => this.tooltip.hide());
      cell.addEventListener("blur", () => this.tooltip.hide());
    }
    const limit = data.rules.loot.collectionLimit;
    const count = t(lang, "gear.count", { owned: save.items.length, all: limit });
    setText(this.count, list.total > list.entries.length ? `${count} · ${t(lang, "gear.shown", { n: list.entries.length, all: list.total })}` : count);
    this.count.classList.toggle("full", save.items.length >= limit);
    setText(this.bank, t(lang, "gear.bank", { gold: save.bankGold, max: data.rules.loot.bankLimit }));
  }

  /** Salvage mode: the click on a random item nobody wears salvages it; anything else only says why not. */
  private salvageEntry(uid: number, salvageable: boolean): void {
    const record = recordByUid(this.gear.save, uid);
    if (!salvageable || !record || !this.gear.salvage(uid)) {
      setText(this.message, t(this.lang, "gear.salvageRefused"));
      this.message.dataset.ok = "false";
      return;
    }
    this.tooltip.hide();
    this.changed = true;
    setText(this.message, t(this.lang, "gear.salvaged", { gold: this.data.rules.loot.salvageGold[record.rarity] }));
    this.message.dataset.ok = "true";
    this.render();
  }

  /** The second row of filters (role, rarity), and the sort and salvage buttons under the grid. */
  private renderSubFilters(): void {
    const { lang } = this;
    const row = this.subFilters;
    row.replaceChildren();
    this.tools.replaceChildren();
    const button = (label: string, pressed: boolean, onClick: () => void, cls = "", parent = row): HTMLButtonElement => {
      const b = el("button", `gear-filter ${cls}`.trim(), parent, label);
      b.type = "button";
      b.setAttribute("aria-pressed", String(pressed));
      b.addEventListener("click", onClick);
      return b;
    };
    for (const role of ["all", ...ROLE_TAGS] as const) {
      const b = button(t(lang, `gear.role.${role}` as MessageKey), role === this.role, () => {
        this.role = role;
        this.render();
      });
      b.dataset.role = role;
    }
    el("span", "gear-filter-gap", row);
    for (const rarity of ["all", ...RARITIES] as const) {
      const label = rarity === "all" ? t(lang, "gear.filterAll") : t(lang, `rarity.${rarity}` as MessageKey);
      const b = button(rarity === "all" ? label : label.charAt(0), rarity === this.rarity, () => {
        this.rarity = rarity;
        this.render();
      }, rarity === "all" ? "" : `rarity-${rarity}`);
      b.dataset.rarity = rarity;
      b.title = label;
      b.setAttribute("aria-label", label);
    }
    const sort = button(t(lang, this.sort === "power" ? "gear.sortPower" : "gear.sortRarity"), this.sort === "power", () => {
      this.sort = this.sort === "power" ? "rarity" : "power";
      this.render();
    }, "", this.tools);
    sort.id = "gear-sort";
    const salvage = button(t(lang, "gear.salvage"), this.salvaging, () => {
      this.salvaging = !this.salvaging;
      setText(this.message, this.salvaging ? t(lang, "gear.salvageHint") : "");
      this.render();
    }, "gear-salvage", this.tools);
    salvage.id = "gear-salvage";
  }
}
