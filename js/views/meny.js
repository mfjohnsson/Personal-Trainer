import { get } from "../store.js";
import * as meals from "../meals.js";
import * as mealplan from "../mealplan.js";
import { todayIso } from "./training.js";
import { esc } from "../html.js";

export const title = "Veckans meny";

const SLOT_ORDER = ["frukost", "lunch", "mellanmal", "middag"];
const SAVE_ERROR = "Kunde inte spara. Lagringen är full eller blockerad.";

export function mount(el) {
  const start = mealplan.weekStart(todayIso());
  const target = mealplan.currentTarget();
  let off = mealplan.offOf(start);
  let msg = "";
  let confirming = false;

  const labelOf = (slot) => meals.SLOTS.find((s) => s.id === slot).label;
  // What is really on the menu: poolFor puts dishes back if fewer than two would remain.
  const onIds = (slot) => meals.poolFor(off)[slot].map((d) => d.id);
  const countOn = (slot) => onIds(slot).length;

  function render(focusSel) {
    // Breakfast only shows up once there is a choice to make.
    const sections = SLOT_ORDER.filter((slot) => meals.DISHES[slot].length > 1).map((slot) => {
      const list = meals.DISHES[slot];
      const ids = onIds(slot);
      const n = ids.length;
      const rows = list.map((d) => {
        const on = ids.includes(d.id);
        return `<label class="menu-row">
          <input type="checkbox" data-id="${esc(d.id)}"${on ? " checked" : ""}${on && n <= meals.minDishes(slot) ? " disabled" : ""}>
          <span><span class="ex-name">${esc(d.name)}</span>
            <span class="note">${d.kcal} kcal · ${d.protein} g protein · ${d.fat} g fett · ${d.carbs} g kolh.</span></span>
        </label>`;
      }).join("");
      return `<section class="card">
        <h2><span class="dot" style="background: var(--c-midja)"></span>${labelOf(slot)} <span class="count">${n} av ${list.length} valda</span></h2>${rows}
      </section>`;
    }).join("");

    const regen = !target
      ? `<p class="note">Fyll i profilen först, så kan appen skapa veckans måltider.</p>`
      : confirming
        ? `<p class="note">Det här ersätter alla dina rättbyten den här veckan. Fortsätta?</p>
           <div class="btn-row">
             <button class="btn-secondary" type="button" data-act="regen-no">Avbryt</button>
             <button class="btn-primary" type="button" data-act="regen-yes">Ja, skapa om</button>
           </div>`
        : `<button class="btn-primary" type="button" data-act="regen">Skapa om veckan med menyn</button>
           <p class="note">Dina val ovan sparas direkt. Veckan på Kost ändras först när du skapar om den.</p>`;

    el.innerHTML = `<div class="view">
      <nav class="subnav" aria-label="Relaterat">
        <a href="#/kost">&larr; Kost</a>
        <a href="#/ratter">Redigera rätter</a>
      </nav>
      <section class="card">
        <h2><span class="dot" style="background: var(--c-vikt)"></span>Veckans meny</h2>
        <p class="note">Bocka ur de rätter du inte vill äta den här veckan. Bara valda rätter visas i rullistorna och används när veckan skapas. Minst två per måltid (frukost: minst en).</p>
        <p class="note" id="menu-note" role="status" aria-live="polite">${msg}</p>
        <div class="btn-row">
          <button class="btn-secondary" type="button" data-act="all">Välj alla</button>
          <button class="btn-secondary" type="button" data-act="prev">Som förra veckan</button>
        </div>
        <div class="menu-apply">${regen}</div>
      </section>${sections}</div>`;
    if (focusSel) el.querySelector(focusSel)?.focus();
  }

  function save(next, focusSel) {
    if (!mealplan.setOff(start, next)) { msg = SAVE_ERROR; render(focusSel); return false; }
    off = next;
    return true;
  }

  // Assigned, not added: `el` is the same element for every view (app.js clears it between views).
  el.onchange = (e) => {
    const id = e.target.dataset?.id;
    if (id === undefined) return;
    const next = e.target.checked ? off.filter((x) => x !== id) : [...off, id];
    const slot = meals.dishOf(id)?.slot;
    if (!e.target.checked && slot && countOn(slot) <= meals.minDishes(slot)) { render(`input[data-id="${id}"]`); return; }
    msg = "";
    save(next, `input[data-id="${id}"]`);
    render(`input[data-id="${id}"]`);
  };

  el.onclick = (e) => {
    const act = e.target.closest?.("button[data-act]")?.dataset.act;
    if (!act) return;
    if (act === "all") { msg = save([], `[data-act="all"]`) ? "Alla rätter är valda." : msg; confirming = false; render(`[data-act="all"]`); }
    else if (act === "prev") {
      const before = mealplan.offOf(mealplan.prevWeekStart(start));
      const had = get("menu")?.[mealplan.prevWeekStart(start)] !== undefined;
      if (save(before, `[data-act="prev"]`)) msg = had ? "Menyn är kopierad från förra veckan." : "Förra veckan hade ingen egen meny, så alla rätter är valda.";
      confirming = false;
      render(`[data-act="prev"]`);
    } else if (act === "regen") { confirming = true; msg = ""; render(`[data-act="regen-yes"]`); }
    else if (act === "regen-no") { confirming = false; render(`[data-act="regen"]`); }
    else if (act === "regen-yes") {
      const week = mealplan.weekMeals(start, target, true);
      msg = get("meals")?.[start] === week ? "Veckan är skapad av menyn. Du hittar den under Kost." : SAVE_ERROR;
      confirming = false;
      render(`[data-act="regen"]`);
    }
  };

  render();
}
