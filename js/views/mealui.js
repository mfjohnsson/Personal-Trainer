// Shared meal UI for Idag and Kost: one day's meals as folded rows. Opening a meal shows the ingredients,
// a dish picker and "Åt något annat".
import * as meals from "../meals.js";
import * as mealplan from "../mealplan.js";
import { esc } from "../html.js";

const nf = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });
const amount = (i) => `${nf.format(i.amount)} ${i.unit}`;
const labelOf = (slot) => meals.SLOTS.find((s) => s.id === slot).label;

const openMeals = new Set(); // "day:slot" of opened meals, kept while the app runs
let customFor = null; // "day:slot" whose "Åt något annat" form is open

function customForm(d, slot) {
  return `<form class="custom-form form" data-day="${d}" data-slot="${slot}" novalidate>
    <div class="field"><label for="c-name">Vad åt du? (valfritt)</label>
      <input id="c-name" name="name" type="text" autocomplete="off" maxlength="40"></div>
    <div class="field-pair">
      <div class="field"><label for="c-kcal">Kalorier, ungefär</label>
        <input id="c-kcal" name="kcal" type="text" inputmode="decimal" autocomplete="off" aria-describedby="err-c-kcal">
        <p class="field-error" id="err-c-kcal" hidden></p></div>
      <div class="field"><label for="c-protein">Protein (g)</label>
        <input id="c-protein" name="protein" type="text" inputmode="decimal" autocomplete="off" aria-describedby="err-c-protein">
        <p class="field-error" id="err-c-protein" hidden></p></div>
    </div>
    <p class="note">Måltiderna efter den här räknas om så att dagen ändå hamnar nära målet.</p>
    <div class="btn-row">
      <button class="btn-secondary" type="button" data-act="custom-cancel">Avbryt</button>
      <button class="btn-primary" type="submit">Spara</button>
    </div>
  </form>`;
}

function mealHtml(m, d, day) {
  const key = `${d}:${m.slot}`;
  const info = meals.mealInfo(m);
  const label = labelOf(m.slot);
  let body;
  if (info.custom) {
    body = `<p class="note">Du åt något annat. Det planerade var ${esc(meals.dishOf(m.dish)?.name ?? "")}.</p>
      <button class="btn-secondary" type="button" data-act="custom-undo" data-day="${d}" data-slot="${m.slot}">Ångra, ät det planerade</button>`;
  } else {
    // Dishes on offer, plus the planned one if it has been hidden since, so the list never shows the wrong one.
    const other = meals.otherMain(day, m.slot); // not the same dish at lunch and dinner
    const offered = meals.DISHES[m.slot].filter((o) => o.id !== other);
    const options = offered.some((o) => o.id === m.dish) ? offered : [...offered, meals.dishOf(m.dish)];
    const picker = options.length > 1
      ? `<label class="pick-label" for="pick-${d}-${m.slot}">Byt rätt</label>
        <select class="pick" id="pick-${d}-${m.slot}" data-day="${d}" data-slot="${m.slot}">
          ${options.map((o) => `<option value="${esc(o.id)}"${o.id === m.dish ? " selected" : ""}>${esc(o.name)}</option>`).join("")}
        </select>`
      : "";
    body = `<p class="note">${info.ingredients.map((i) => esc(`${amount(i)} ${i.name.toLowerCase()}`)).join(" · ")}</p>
      <p class="note macros">Fett ${info.fat} g · Kolhydrater ${info.carbs} g</p>
      ${picker}
      ${customFor === key ? customForm(d, m.slot)
        : `<button class="btn-secondary" type="button" data-act="custom-open" data-day="${d}" data-slot="${m.slot}">Åt något annat</button>`}`;
  }
  return `<details class="meal" data-meal="${key}"${openMeals.has(key) || customFor === key ? " open" : ""}>
    <summary><span class="meal-slot">${label}</span>
      <span class="meal-name">${esc(info.name)}${info.custom ? ` <span class="badge">Eget</span>` : ""}</span>
      <span class="meal-kcal">${info.kcal} kcal · ${info.protein} g protein</span></summary>
    <div class="meal-body">${body}</div>
  </details>`;
}

export function dayHtml(day, d, target) {
  const t = meals.dayTotals(day);
  const ok = meals.withinTarget(t, target);
  const custom = day.meals.some((m) => m.custom);
  // Protein top-up: shown when planned, otherwise a button to add it (with a hint on a low day).
  const topup = meals.topupDish();
  const extra = meals.extraInfo(day);
  const low = t.protein < target.protein - meals.PROTEIN_TOLERANCE;
  const why = extra?.manual ? "Tillagd av dig." : "Tillagd så att måltiderna håller normal storlek och ändå når proteinmålet.";
  // What adding it would do, worked out for real: it never pushes protein past the target, the meals shrink instead.
  const preview = !extra && meals.canAddExtra(day) ? meals.dayTotals(meals.withExtra(day, target)) : null;
  const effect = !preview ? ""
    : low ? `<p class="note warn">Proteinet ligger lågt, ${t.protein} av ${target.protein} g. Med ${esc(topup.name.toLowerCase())} blir det ${preview.protein} g.</p>`
    : `<p class="note">Med ${esc(topup.name.toLowerCase())} blir måltiderna mindre. Proteinet ligger kvar runt målet (${preview.protein} g).</p>`;
  const extraHtml = extra
    ? `<div class="shake-row"><span class="meal-slot">Proteinpåfyllning</span><span class="meal-name">${esc(extra.name)}</span>
        <span class="meal-kcal">${extra.kcal} kcal · ${extra.protein} g protein</span></div>
      <div class="shake-add"><p class="note">${extra.ingredients.map((i) => esc(`${amount(i)} ${i.name.toLowerCase()}`)).join(" · ")}. ${why} Mängden anpassas efter dagen.</p>
      <button class="btn-secondary" type="button" data-act="extra-off" data-day="${d}">Ta bort påfyllning</button></div>`
    : !preview ? ""
    : `<div class="shake-add">${effect}
      <button class="btn-secondary" type="button" data-act="extra-on" data-day="${d}">Lägg till ${esc(topup.name.toLowerCase())}</button></div>`;
  return `<div class="meals">${day.meals.map((m) => mealHtml(m, d, day)).join("")}</div>
    ${extraHtml}
    <p class="note day-total">Summa ${t.kcal} av ${target.kcal} kcal · ${t.protein} av ${target.protein} g protein</p>
    ${!ok && custom ? `<p class="note warn">Resten av dagen räcker inte för att nå målet med rimliga portioner. Det gör inget, en enstaka dag jämnar ut sig.</p>` : ""}`;
}

// Wires the meal rows inside `el` for the week starting `start`. `rerender()` draws the view again.
export function bindMeals(el, { start, target, rerender, failed }) {
  customFor = null;
  const week = () => mealplan.weekMeals(start, target);
  const save = (next, focusSel) => {
    const ok = !!next && mealplan.saveWeek(next);
    rerender();
    if (next && !ok) failed();
    if (focusSel) el.querySelector(focusSel)?.focus();
    return ok;
  };

  el.addEventListener("toggle", (e) => {
    const det = e.target;
    if (!(det instanceof HTMLDetailsElement) || !det.dataset.meal) return;
    if (det.open) openMeals.add(det.dataset.meal); else openMeals.delete(det.dataset.meal);
  }, true);

  el.addEventListener("change", (e) => {
    const sel = e.target;
    if (!(sel instanceof HTMLSelectElement) || sel.dataset.slot === undefined || sel.dataset.day === undefined) return;
    save(meals.changeDish(week(), +sel.dataset.day, sel.dataset.slot, sel.value), `#pick-${sel.dataset.day}-${sel.dataset.slot}`);
  });

  el.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const { act } = btn.dataset;
    const form = btn.closest("form.custom-form");
    const day = btn.dataset.day ?? form?.dataset.day, slot = btn.dataset.slot ?? form?.dataset.slot;
    if (act === "custom-open") { customFor = `${day}:${slot}`; rerender(); el.querySelector("#c-name")?.focus(); }
    else if (act === "custom-cancel") { customFor = null; rerender(); el.querySelector(`[data-act="custom-open"][data-day="${day}"][data-slot="${slot}"]`)?.focus(); }
    else if (act === "extra-on" || act === "extra-off") {
      save(meals.setExtra(week(), +day, act === "extra-on"), `[data-act="${act === "extra-on" ? "extra-off" : "extra-on"}"][data-day="${day}"]`);
    }
    else if (act === "custom-undo") save(meals.setCustom(week(), +day, slot, null), `#pick-${day}-${slot}`);
  });

  el.addEventListener("submit", (e) => {
    const form = e.target;
    if (!form.classList?.contains("custom-form")) return;
    e.preventDefault();
    const { values, errors } = meals.validateCustom(Object.fromEntries(new FormData(form)));
    for (const k of ["kcal", "protein"]) {
      const err = form.querySelector(`#err-c-${k}`);
      err.hidden = !errors[k];
      err.textContent = errors[k] ?? "";
      form.querySelector(`#c-${k}`).toggleAttribute("aria-invalid", !!errors[k]);
    }
    const bad = ["kcal", "protein"].find((k) => errors[k]);
    if (bad) { form.querySelector(`#c-${bad}`).focus(); return; }
    const { day, slot } = form.dataset;
    customFor = null;
    openMeals.add(`${day}:${slot}`);
    save(meals.setCustom(week(), +day, slot, values), `[data-act="custom-undo"][data-day="${day}"][data-slot="${slot}"]`);
  });
}
