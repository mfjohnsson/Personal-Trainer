// Shopping list: the week's ingredients summed per item, grouped by category, checkable.
// Storage: shopping = { [monday]: { from: day, checked: [keys] } }.
import { get, set } from "../store.js";
import * as plan from "../plan.js";
import * as meals from "../meals.js";
import * as mealplan from "../mealplan.js";
import { todayIso, storageErrorHtml } from "./training.js";
import { esc } from "../html.js";
import { weekView } from "./mealui.js";

export const title = "Inköpslista";

const CATEGORY_ORDER = ["Kött och fisk", "Mejeri och ägg", "Frukt och grönt", "Bröd och spannmål", "Skafferi"];
const KEEP_WEEKS = 8;
const nf = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });

// Sums the ingredients of days `from`..6. Grams over a kilo are shown in kg.
export function listOf(week, from) {
  const items = new Map();
  for (const day of week.days.slice(from)) {
    for (const m of meals.dayItems(day)) {
      if (m.custom) continue;
      for (const i of meals.mealInfo(m).ingredients) {
        if (/^vatten$/i.test(i.name)) continue; // nothing to buy
        const key = `${i.name.toLowerCase()}|${i.unit}`;
        const cur = items.get(key) ?? { key, name: i.name, unit: i.unit, category: i.category, amount: 0 };
        cur.amount += i.amount;
        items.set(key, cur);
      }
    }
  }
  const groups = new Map(CATEGORY_ORDER.map((c) => [c, []]));
  for (const it of items.values()) (groups.get(it.category) ?? groups.get("Skafferi")).push(it);
  for (const list of groups.values()) list.sort((a, b) => a.name.localeCompare(b.name, "sv"));
  return [...groups].filter(([, list]) => list.length);
}

export const amountText = (it) => (it.unit === "g" && it.amount >= 1000 ? `${nf.format(Math.round(it.amount / 100) / 10)} kg` : `${nf.format(it.amount)} ${it.unit}`);

export function mount(el) {
  const target = mealplan.currentTarget();
  if (!target) {
    el.innerHTML = `<section class="card"><h2><span class="dot" style="background: var(--c-midja)"></span>Inköpslista</h2>
      <p class="empty">Fyll i din profil först, så planeras veckans mat.</p><a class="btn-secondary" href="#/profil">Till profilen</a></section>`;
    return;
  }
  const today = todayIso();
  const thisStart = mealplan.weekStart(today);
  const todayIdx = Math.min(Math.max(plan.dayIndex(thisStart, today), 0), 6);
  // This week or next (chosen here or in Kost); each week keeps its own ticks.
  let start = weekView.next ? mealplan.nextWeekStart(thisStart) : thisStart;

  const stored = () => get("shopping")?.[start] ?? {};
  const fromOf = () => (!weekView.next && Number.isInteger(stored().from) ? stored().from : 0);
  const checkedOf = () => new Set(Array.isArray(stored().checked) ? stored().checked : []);

  function save(entry) {
    const all = get("shopping") ?? {};
    const next = { ...all, [start]: { ...stored(), ...entry } };
    const keep = Object.keys(next).sort().slice(-KEEP_WEEKS);
    return set("shopping", Object.fromEntries(keep.map((k) => [k, next[k]])));
  }

  function render(focusSel) {
    const from = fromOf();
    const checked = checkedOf();
    const groups = listOf(mealplan.weekMeals(start, target), from);
    const total = groups.reduce((a, [, l]) => a + l.length, 0);
    const done = groups.reduce((a, [, l]) => a + l.filter((it) => checked.has(it.key)).length, 0);
    const sections = groups.map(([cat, list]) => `<section class="card">
        <h2><span class="dot" style="background: var(--c-midja)"></span>${cat}</h2>
        ${list.map((it) => `<label class="menu-row${checked.has(it.key) ? " is-checked" : ""}">
          <input type="checkbox" data-item="${esc(it.key)}"${checked.has(it.key) ? " checked" : ""}>
          <span class="shop-name">${esc(it.name)}</span><span class="shop-amount">${amountText(it)}</span>
        </label>`).join("")}
      </section>`).join("");
    el.innerHTML = `<div class="view">
      <nav class="subnav" aria-label="Relaterat"><a href="#/kost">&larr; Kost</a></nav>
      <section class="card">
        <h2><span class="dot" style="background: var(--c-midja)"></span>Inköpslista <span class="count">${done} av ${total}</span></h2>
        <div class="seg week-seg" role="group" aria-label="Vilken vecka">
          <button type="button" data-next="0" aria-pressed="${!weekView.next}">Den här veckan</button>
          <button type="button" data-next="1" aria-pressed="${weekView.next}">Nästa vecka</button>
        </div>
        ${weekView.next ? "" : `<div class="seg" role="group" aria-label="Vilka dagar">
          <button type="button" data-from="0" aria-pressed="${from === 0}">Hela veckan</button>
          <button type="button" data-from="${todayIdx}" aria-pressed="${from === todayIdx && todayIdx !== 0}"${todayIdx === 0 ? " disabled" : ""}>Från idag</button>
        </div>`}
        <p class="note">Ändrar du en måltid uppdateras listan. Mängderna är avrundade.</p>
        ${done ? `<button class="btn-secondary wide" type="button" data-act="clear">Avmarkera alla</button>` : ""}
        ${storageErrorHtml}
      </section>${sections || `<section class="card"><p class="empty">Inget att handla.</p></section>`}</div>`;
    if (focusSel) el.querySelector(focusSel)?.focus();
  }

  const failed = () => el.querySelector(".storage-error")?.removeAttribute("hidden");

  el.onchange = (e) => {
    const key = e.target.dataset?.item;
    if (key === undefined) return;
    const checked = checkedOf();
    if (e.target.checked) checked.add(key); else checked.delete(key);
    if (!save({ checked: [...checked] })) { e.target.checked = !e.target.checked; failed(); return; }
    render(`input[data-item="${CSS.escape(key)}"]`);
  };
  el.onclick = (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.next !== undefined) {
      weekView.next = btn.dataset.next === "1";
      start = weekView.next ? mealplan.nextWeekStart(thisStart) : thisStart;
      render(`[data-next="${btn.dataset.next}"]`);
    }
    else if (btn.dataset.from !== undefined) { if (!save({ from: +btn.dataset.from })) failed(); else render(`[data-from="${btn.dataset.from}"]`); }
    else if (btn.dataset.act === "clear") { if (!save({ checked: [] })) failed(); else render(); }
  };
  render();
}
