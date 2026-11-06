import { get } from "../store.js";
import * as plan from "../plan.js";
import * as meals from "../meals.js";
import * as dishes from "../dishes.js";
import * as foods from "../foods.js";
import * as mealplan from "../mealplan.js";
import { todayIso } from "./training.js";
import { esc } from "../html.js";

export const title = "Rätter";

const SAVE_ERROR = "Kunde inte spara. Lagringen är full eller blockerad.";
const MEAL_CHOICES = [["both", "Lunch och middag"], ["lunch", "Bara lunch"], ["middag", "Bara middag"]];
const nf = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });

const isEdited = (id) => meals.isBuiltIn(id) && !!get("dishes")?.items?.[id];
const mealsTag = (d) => (meals.MAIN.includes(d.slot) && d.meals.length === 1 ? (d.meals[0] === "lunch" ? "Bara lunch" : "Bara middag") : null);

function rowHtml(d) {
  const shown = meals.isVisible(d.id);
  const tags = [!meals.isBuiltIn(d.id) && "Egen", isEdited(d.id) && "Ändrad", mealsTag(d)].filter(Boolean);
  const canToggle = !shown || dishes.canHide(d.id);
  return `<div class="dish-row${shown ? "" : " is-off"}">
    <button class="switch" type="button" role="switch" aria-checked="${shown}" data-act="${shown ? "hide" : "show"}" data-id="${esc(d.id)}"
      aria-label="Använd ${esc(d.name)}"${canToggle ? "" : ` disabled title="Minst två rätter per måltid behövs"`}></button>
    <div class="dish-main">
      <span class="ex-name">${esc(d.name)}</span>${tags.map((t) => `<span class="badge">${t}</span>`).join("")}
      <p class="note">${d.kcal} kcal · ${d.protein} g protein per portion</p>
    </div>
    <button class="link-btn" type="button" data-act="edit" data-id="${esc(d.id)}" aria-label="Ändra ${esc(d.name)}">Ändra</button>
  </div>`;
}

// Which snack fills up protein when the meals alone would get too big. Hidden snacks may be chosen too.
// Only protein-rich snacks can be chosen: a less rich one barely moves the day's protein.
function topupHtml() {
  const choices = meals.allDishes("mellanmal").filter(meals.isTopupCandidate);
  const pick = choices.length > 1
    ? `<label for="topup-pick">Proteinpåfyllning</label>
      <select class="pick" id="topup-pick">${choices.map((d) => `<option value="${esc(d.id)}"${d.id === meals.topupId() ? " selected" : ""}>${esc(d.name)} (${d.protein} g protein)</option>`).join("")}</select>`
    : `<p class="pick-label">Proteinpåfyllning</p><p class="ex-name">${esc(meals.topupDish()?.name ?? "")}</p>`;
  return `<div class="field topup">
    ${pick}
    <p class="note">Läggs till de dagar då måltiderna annars inte når proteinmålet, eller bara når det med portioner mer än ${Math.round((meals.NORMAL_MAX - 1) * 100)} % större än normalt. Måltiderna blir då mindre i stället.</p>
    <p class="note">Bara mellanmål med minst ${meals.TOPUP_MIN_DENSITY} g protein per 100 kcal kan väljas, till exempel shake eller kvarg. Keso med frukt och nötter har för lite för att hjälpa. Lägg till ett eget mellanmål om du vill ha något annat.</p>
  </div>`;
}

function listHtml(msg) {
  const sections = meals.GROUPS.map((g) => `
    <section class="card">
      <h2><span class="dot" style="background: var(--c-midja)"></span>${g.label}</h2>
      ${g.id === "mellanmal" ? topupHtml() : ""}
      ${meals.allDishes(g.id).map(rowHtml).join("")}
      <button class="btn-secondary add-dish" type="button" data-act="add" data-group="${g.id}">Lägg till rätt</button>
    </section>`).join("");
  const gone = meals.GROUPS.flatMap((g) => meals.allDishes(g.id, { removed: true }));
  const removedHtml = gone.length ? `
    <section class="card">
      <h2><span class="dot" style="background: var(--c-midja)"></span>Borttagna rätter</h2>
      ${gone.map((d) => `<div class="dish-row is-off">
        <div class="dish-main"><span class="ex-name">${esc(d.name)}</span>
          <p class="note">${esc(meals.groupOf(d.slot).label)} · ${d.kcal} kcal · ${d.protein} g protein per portion</p></div>
        <button class="link-btn" type="button" data-act="restore" data-id="${esc(d.id)}" aria-label="Ta tillbaka ${esc(d.name)}">Ta tillbaka</button>
      </div>`).join("")}
    </section>` : "";
  return `<div class="view">
    <nav class="subnav" aria-label="Relaterat"><a href="#/kost">&larr; Kost</a></nav>
    <section class="card">
      <h2><span class="dot" style="background: var(--c-vikt)"></span>Rätter</h2>
      <p class="note">Rätter som är påslagna används i veckans förslag och kan väljas när du byter. Stänger du av en rätt byts den ut i resten av veckan.</p>
      <p class="note" id="list-note" role="status" aria-live="polite">${msg ?? ""}</p>
    </section>${sections}${removedHtml}</div>`;
}

export function mount(el) {
  let editing = null; // { id, slot, name, meals, rows: [{ name, amount, unit, nummer }] } while the form is open
  let msg = "";
  let results = [];
  let loadState = "idle"; // idle | loading | ready | failed

  const today = todayIso();
  const start = mealplan.weekStart(today);
  const replace = { start, from: Math.min(Math.max(plan.dayIndex(start, today), 0), 6) };

  const foodOf = (row) => foods.foodByNumber(row.nummer) ?? foods.match(row.name);
  const ingredientsOf = () => editing.rows.map((r) => [r.name, Number.isFinite(r.amount) ? r.amount : 0, r.unit, meals.categoryOf(r.name), foodOf(r)?.nummer]);
  const totals = () => foods.macrosOf(ingredientsOf());

  // editing.auto: true = the app picks the amounts (meals.suggestGrams) and picks them again when an
  // ingredient is added or removed; false = you set them. "legacy" = an own dish saved before this was
  // stored: it counts as the app's when every amount is still what the app put in back then.
  function refit() {
    if (editing.auto === "legacy" && foods.isLoaded()) {
      editing.auto = editing.rows.every((r) => r.unit === "g" && r.amount === meals.legacyGrams(foodOf(r)));
    }
    if (editing.auto !== true || !foods.isLoaded()) return;
    const grams = meals.suggestGrams(editing.rows.map(foodOf), editing.slot);
    editing.rows.forEach((r, i) => { r.amount = grams[i]; r.unit = "g"; });
  }

  function totalsText() {
    if (!editing.rows.length) return "Lägg till ingredienser så räknas näringsvärdet ut.";
    const m = totals();
    return `Per portion: ${m.kcal} kcal · ${m.protein} g protein · ${m.fat} g fett · ${m.carbs} g kolhydrater`
      + (m.unmatched.length ? `. Hittar inte: ${m.unmatched.join(", ")}, räknas som 0.` : "");
  }

  function rowsHtml() {
    return editing.rows.map((r, i) => {
      const food = foodOf(r);
      return `<div class="ing-row">
        <div class="ing-name"><span class="ex-name">${esc(r.name)}</span>
          ${food && food.name.toLowerCase() !== r.name.toLowerCase() ? `<span class="note">Räknas som ${esc(food.name)}</span>` : ""}
          ${!food ? `<span class="note warn">Finns inte i livsmedelsdatabasen</span>` : ""}</div>
        <div class="ing-amount">
          ${editing.showAmounts ? `<input type="text" inputmode="decimal" autocomplete="off" data-amount="${i}" value="${Number.isFinite(r.amount) ? nf.format(r.amount).replace(/\s/g, "") : ""}" aria-label="Mängd ${esc(r.name)}">
          <select data-unit="${i}" aria-label="Enhet ${esc(r.name)}">${meals.UNITS.map((u) => `<option${u === r.unit ? " selected" : ""}>${u}</option>`).join("")}</select>` : ""}
          <button type="button" class="icon-btn" data-act="remove" data-i="${i}" aria-label="Ta bort ${esc(r.name)}">✕</button>
        </div>
      </div>`;
    }).join("");
  }

  function resultsHtml() {
    return results.map((f) => `<button type="button" class="result" data-act="add-food" data-nr="${f.nummer}">
      <span>${esc(f.name)}</span><span class="note">${Math.round(f.kcal)} kcal · ${nf.format(f.protein)} g protein /100 g</span></button>`).join("");
  }

  function formHtml() {
    const d = editing.id ? meals.dishOf(editing.id) : null;
    const group = meals.groupOf(editing.slot);
    const isMain = group.id === "huvudratt";
    const mealsChoice = editing.meals.length === 2 ? "both" : editing.meals[0];
    const body = loadState === "ready" ? `
      <div class="ing-list" id="ing-list">${rowsHtml()}</div>
      <div class="field">
        <label for="food-search">Lägg till ingrediens</label>
        <input id="food-search" type="search" autocomplete="off" placeholder="Sök, t.ex. kyckling" aria-describedby="err-ingredients">
        <div class="results" id="results">${resultsHtml()}</div>
        <p class="field-error" id="err-ingredients" hidden></p>
      </div>
      <p class="calc-total" id="totals" aria-live="polite">${totalsText()}</p>
      ${editing.showAmounts
        ? `<p class="note">Mängderna styr bara hur mycket det är av varje ingrediens jämfört med de andra. Portionen skalas ändå efter dagens mål. Ändrar du en mängd räknar appen inte om mängderna längre.</p>
          <button class="link-btn" type="button" data-act="amounts-hide">Dölj mängder</button>`
        : `<p class="note">Lägg bara till ingredienserna. Appen föreslår mängder och skalar portionen efter dagens mål. Justera bara om rätten ska ha mer eller mindre av något.</p>
          ${editing.rows.length ? `<button class="link-btn" type="button" data-act="amounts-show">Justera mängder</button>` : ""}`}`
      : `<p class="note">${loadState === "failed" ? "Kunde inte läsa livsmedelsdata. Försök igen." : "Hämtar livsmedelsdata…"}</p>`;
    return `<div class="view"><section class="card">
      <h2><span class="dot" style="background: var(--c-vikt)"></span>${d ? "Ändra rätt" : "Ny rätt"} · ${group.label}</h2>
      <form id="dish-form" class="form" novalidate>
        <div class="field">
          <label for="d-name">Namn</label>
          <input id="d-name" name="name" type="text" autocomplete="off" value="${esc(editing.name)}" aria-describedby="err-name">
          <p class="field-error" id="err-name" hidden></p>
        </div>
        ${isMain ? `<fieldset class="field radios"><legend>Passar till</legend>
          ${MEAL_CHOICES.map(([v, label]) => `<label><input type="radio" name="meals" value="${v}"${v === mealsChoice ? " checked" : ""}> ${label}</label>`).join("")}
        </fieldset>` : ""}
        ${body}
        <button class="btn-primary" type="submit"${loadState === "ready" ? "" : " disabled"}>Spara</button>
        <button class="btn-secondary" type="button" data-act="cancel">Avbryt</button>
        ${d && isEdited(d.id) ? `<button class="btn-secondary" type="button" data-act="reset">Återställ originalet</button>` : ""}
        ${d ? removeHtml(d) : ""}
        <p class="field-error" id="form-note" role="alert" hidden></p>
      </form>
    </section></div>`;
  }

  // "Ta bort rätten", asked twice. Blocked (with the reason) for the top-up snack or a meal with too few dishes.
  function removeHtml(d) {
    const block = dishes.removeBlock(d.id);
    if (block) return `<p class="note">Kan inte tas bort: ${esc(block)}</p>`;
    if (!editing.confirmRemove) return `<button class="btn-secondary" type="button" data-act="remove-dish">Ta bort rätten</button>`;
    return `<div class="remove-confirm" role="group" aria-label="Bekräfta borttagning">
      <p class="note warn">Ta bort ${esc(d.name)}? Den används inte längre och byts ut i resten av veckan. Du kan ta tillbaka den längst ner på sidan Rätter.</p>
      <button class="btn-primary" type="button" data-act="remove-yes">Ja, ta bort</button>
      <button class="btn-secondary" type="button" data-act="remove-no">Behåll</button>
    </div>`;
  }

  function render(focusSel) {
    el.innerHTML = editing ? formHtml() : listHtml(msg);
    const form = el.querySelector("#dish-form");
    if (form) form.onsubmit = (e) => { e.preventDefault(); submit(); };
    if (!focusSel) window.scrollTo(0, 0);
    const sel = focusSel ?? (editing ? "#d-name" : null);
    if (sel) el.querySelector(sel)?.focus();
  }

  function open(id, slot) {
    const d = id ? meals.dishOf(id) : null;
    editing = {
      id, slot,
      name: d?.name ?? "",
      meals: d?.meals ?? (meals.MAIN.includes(slot) ? meals.MAIN : [slot]),
      rows: (d?.ingredients ?? []).map(([name, amount, unit, , nummer]) => ({ name, amount, unit, nummer })),
      auto: !d || d.auto === true || (d.auto === undefined && !meals.isBuiltIn(id) ? "legacy" : false),
    };
    refit();
    results = [];
    msg = "";
    loadState = foods.isLoaded() ? "ready" : "loading";
    render();
    if (loadState === "loading") {
      const mine = editing;
      foods.load().then(() => { loadState = "ready"; }, () => { loadState = "failed"; })
        .then(() => { if (editing === mine) { refit(); render("#d-name"); } });
    }
  }

  function syncName() {
    const input = el.querySelector("#d-name");
    if (input && editing) editing.name = input.value;
  }

  function submit() {
    syncName();
    const choice = el.querySelector('input[name="meals"]:checked')?.value;
    const m = totals();
    const raw = { auto: editing.auto === true, name: editing.name, ingredients: ingredientsOf(), kcal: m.kcal, protein: m.protein, fat: m.fat, carbs: m.carbs,
      meals: choice === "both" || !choice ? meals.MAIN : [choice] };
    const { values, errors } = meals.validateDish(raw, editing.slot);
    // An error about the amounts (too small, too big, missing) can only be fixed with them in view.
    const amountError = !!errors.ingredients && editing.rows.length > 0 && !errors.name;
    if (amountError && !editing.showAmounts) { editing.showAmounts = true; render("#d-name"); }
    for (const key of ["name", "ingredients"]) {
      const err = el.querySelector(`#err-${key}`);
      err.hidden = !errors[key];
      err.textContent = errors[key] ?? "";
    }
    el.querySelector("#d-name").toggleAttribute("aria-invalid", !!errors.name);
    if (errors.name) { el.querySelector("#d-name").focus(); return; }
    if (errors.ingredients) { el.querySelector(amountError ? "[data-amount]" : "#food-search").focus(); return; }
    const id = dishes.saveDish(editing.id, editing.slot, values, replace);
    if (id === null) return fail(SAVE_ERROR);
    msg = `Sparat: ${esc(values.name)}.`;
    editing = null;
    render(`[data-act="edit"][data-id="${id}"]`);
  }

  function fail(text) {
    const note = el.querySelector("#form-note") ?? el.querySelector("#list-note");
    note.hidden = false;
    note.textContent = text;
  }

  const updateTotals = () => { const t = el.querySelector("#totals"); if (t) t.textContent = totalsText(); };

  el.oninput = (e) => {
    const t = e.target;
    if (!editing) return;
    if (t.id === "d-name") { editing.name = t.value; return; }
    if (t.id === "food-search") {
      results = t.value.trim().length >= 2 ? foods.search(t.value, 6) : [];
      el.querySelector("#results").innerHTML = resultsHtml();
      return;
    }
    if (t.dataset.amount !== undefined) {
      const v = Number(t.value.trim().replace(",", "."));
      editing.rows[+t.dataset.amount].amount = Number.isFinite(v) && v > 0 ? v : NaN;
      editing.auto = false;
      updateTotals();
    }
  };
  el.onchange = (e) => {
    const t = e.target;
    if (t.id === "topup-pick") {
      msg = dishes.setTopup(t.value) ? `Proteinpåfyllning: ${esc(meals.dishOf(t.value).name)}.` : SAVE_ERROR;
      render("#topup-pick");
      return;
    }
    if (!editing) return;
    if (t.dataset.unit !== undefined) { editing.rows[+t.dataset.unit].unit = t.value; editing.auto = false; updateTotals(); }
    else if (t.name === "meals") editing.meals = t.value === "both" ? meals.MAIN : [t.value];
  };
  // Enter in the search box adds the first hit instead of submitting the form.
  el.onkeydown = (e) => {
    if (e.key !== "Enter" || e.target.id !== "food-search") return;
    e.preventDefault();
    el.querySelector('[data-act="add-food"]')?.click();
  };

  // Assigned, not added: `el` is the same element for every view (app.js clears it between views).
  el.onclick = (e) => {
    const btn = e.target.closest?.("button[data-act]");
    if (!btn) return;
    const { act, id } = btn.dataset;
    if (act === "add") open(null, meals.GROUPS.find((g) => g.id === btn.dataset.group).slots[0]);
    else if (act === "edit") open(id, meals.dishOf(id).slot);
    else if (act === "add-food") {
      syncName();
      const food = foods.foodByNumber(Number(btn.dataset.nr));
      editing.rows.push({ name: food.name, amount: meals.defaultGrams(food), unit: "g", nummer: food.nummer });
      refit();
      results = [];
      render("#food-search");
    } else if (act === "remove") {
      syncName();
      editing.rows.splice(+btn.dataset.i, 1);
      refit();
      render("#food-search");
    } else if (act === "cancel") { const back = editing.id; editing = null; msg = ""; render(back && `[data-act="edit"][data-id="${back}"]`); }
    else if (act === "reset") {
      const back = editing.id;
      if (!dishes.resetDish(back, replace)) return fail(SAVE_ERROR);
      msg = "Originalet är tillbaka.";
      editing = null;
      render(`[data-act="edit"][data-id="${back}"]`);
    } else if (act === "amounts-show" || act === "amounts-hide") {
      syncName();
      editing.showAmounts = act === "amounts-show";
      render(editing.showAmounts ? "[data-amount]" : '[data-act="amounts-show"]');
    } else if (act === "remove-dish" || act === "remove-no") {
      syncName();
      editing.confirmRemove = act === "remove-dish";
      render(act === "remove-dish" ? '[data-act="remove-no"]' : '[data-act="remove-dish"]');
    } else if (act === "remove-yes") {
      const name = meals.dishOf(editing.id).name;
      if (!dishes.removeDish(editing.id, replace)) return fail(SAVE_ERROR);
      msg = `${esc(name)} är borttagen.`;
      editing = null;
      render(); // back to the top, where the note says what happened
    } else if (act === "restore") {
      const name = meals.dishOf(id).name;
      if (!dishes.restoreDish(id)) { msg = SAVE_ERROR; render(); return; }
      msg = `${esc(name)} är tillbaka och används igen.`;
      render(`[data-act="edit"][data-id="${CSS.escape(id)}"]`);
    } else if (act === "hide" || act === "show") {
      const name = meals.dishOf(id).name;
      if (!dishes.setVisible(id, act === "show", replace)) { msg = SAVE_ERROR; render(); return; }
      msg = act === "show" ? `${esc(name)} används igen.` : `${esc(name)} används inte längre och är utbytt i resten av veckan.`;
      render(`[data-act][data-id="${CSS.escape(id)}"].switch`);
    }
  };

  render();
}
