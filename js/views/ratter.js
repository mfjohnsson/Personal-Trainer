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
  const kind = meals.MAIN.includes(d.slot) ? meals.KINDS.find((k) => k.id === d.kind)?.label : null;
  const tags = [kind, !meals.isBuiltIn(d.id) && "Egen", isEdited(d.id) && "Ändrad", mealsTag(d)].filter(Boolean);
  const block = shown ? dishes.offBlock(d.id) : null;
  return `<div class="dish-row${shown ? "" : " is-off"}">
    <button class="switch" type="button" role="switch" aria-checked="${shown}" data-act="${shown ? "hide" : "show"}" data-id="${esc(d.id)}"
      aria-label="Använd ${esc(d.name)}"${block ? ` disabled title="${esc(block)}"` : ""}></button>
    <div class="dish-main">
      <span class="ex-name">${esc(d.name)}</span>${tags.map((t) => `<span class="badge">${t}</span>`).join("")}
      <p class="note">${d.kcal} kcal · ${d.protein} g protein per portion</p>
    </div>
    <button class="link-btn" type="button" data-act="edit" data-id="${esc(d.id)}" aria-label="Ändra ${esc(d.name)}">Ändra</button>
  </div>`;
}

// The two top-ups, in order. Only protein-rich dishes can be chosen.
function topupHtml() {
  const choices = meals.allDishes("mellanmal").filter(meals.isTopupCandidate);
  const opt = (d, id) => `<option value="${esc(d.id)}"${d.id === id ? " selected" : ""}>${esc(d.name)} (${d.protein} g protein)</option>`;
  const second = choices.filter((d) => d.id !== meals.topupId());
  return `<div class="topup">
    <div class="field"><label for="topup-pick">Först</label>
      <select class="pick" id="topup-pick" data-topup="topup">${choices.map((d) => opt(d, meals.topupId())).join("")}</select></div>
    ${second.length ? `<div class="field"><label for="topup2-pick">Sedan, om det behövs mer</label>
      <select class="pick" id="topup2-pick" data-topup="topup2"><option value="none"${meals.topup2Id() ? "" : " selected"}>Inget</option>${second.map((d) => opt(d, meals.topup2Id())).join("")}</select></div>` : ""}
    <p class="note">Läggs till de dagar måltiderna inte når proteinmålet i en rimlig storlek.</p>
  </div>`;
}

// The everyday breakfast: planned every day; change it on a day when you want something else.
function breakfastHtml() {
  const list = meals.allDishes("frukost").filter((d) => meals.isVisible(d.id));
  if (list.length < 2) return "";
  return `<div class="topup"><div class="field"><label for="breakfast-pick">Varje dag</label>
    <select class="pick" id="breakfast-pick">${list.map((d) => `<option value="${esc(d.id)}"${d.id === meals.breakfastId() ? " selected" : ""}>${esc(d.name)}</option>`).join("")}</select></div>
    <p class="note">Vill du ha något annat en dag, byt frukosten på den dagen.</p></div>`;
}

let tab = "huvudratt"; // the open tab, kept while the app runs

function listHtml(msg, undo) {
  const g = meals.GROUPS.find((x) => x.id === tab);
  const all = meals.allDishes(g.id);
  const on = all.filter((d) => meals.isVisible(d.id)), off = all.filter((d) => !meals.isVisible(d.id));
  return `<div class="view">
    <nav class="subnav" aria-label="Relaterat"><a href="#/kost">&larr; Kost</a></nav>
    <section class="card">
      <h2><span class="dot" style="background: var(--c-vikt)"></span>Rätter</h2>
      <div class="seg" role="group" aria-label="Måltid">${meals.GROUPS.map((x) => `<button type="button" data-act="tab" data-tab="${x.id}" aria-pressed="${x.id === tab}">${x.label}</button>`).join("")}</div>
      <p class="note" id="list-note" role="status" aria-live="polite">${msg ?? ""}${undo ? ` <button class="link-btn" type="button" data-act="undo-delete" data-id="${esc(undo)}">Ångra</button>` : ""}</p>
    </section>
    <section class="card">
      <h2><span class="dot" style="background: var(--c-midja)"></span>${g.id === "mellanmal" ? "Proteinpåfyllning" : "Gillar"}</h2>
      ${g.id === "mellanmal" ? topupHtml() : ""}
      ${g.id === "frukost" ? breakfastHtml() : ""}
      ${on.map(rowHtml).join("") || `<p class="empty">Inga rätter här.</p>`}
      <button class="btn-secondary add-dish" type="button" data-act="add" data-group="${g.id}">Lägg till rätt</button>
    </section>
    ${off.length ? `<details class="card more-card">
      <summary><h2><span class="dot" style="background: var(--ink-3)"></span>Fler rätter <span class="count">${off.length}</span></h2></summary>
      <p class="note">Används inte i förslagen. Slå på en rätt så kommer den med.</p>
      ${off.map(rowHtml).join("")}
    </details>` : ""}
  </div>`;
}

export function mount(el) {
  let editing = null; // { id, slot, name, meals, rows: [{ name, amount, unit, nummer }] } while the form is open
  let msg = "";
  let undo = null; // id of the own dish just deleted, while "Ångra" is offered
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
    // Eggs and whole fruit in pieces (the same weight per piece as the "st" unit counts with).
    editing.rows.forEach((r, i) => {
      const per = foods.pieceGrams(r.name);
      if (per) { r.amount = Math.max(1, Math.round(grams[i] / per)); r.unit = "st"; } else { r.amount = grams[i]; r.unit = "g"; }
    });
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
        </fieldset>
        <fieldset class="field radios"><legend>Sort</legend>
          ${meals.KINDS.map((k) => `<label><input type="radio" name="kind" value="${k.id}"${k.id === (editing.kind ?? meals.guessKind({ name: editing.name, ingredients: editing.rows.map((r) => [r.name]) })) ? " checked" : ""}> ${k.label}</label>`).join("")}
        </fieldset>
        <p class="note">Varje vecka planeras två storkok (nötkött och kyckling), en fiskrätt och en snabb rätt.</p>` : ""}
        ${body}
        <button class="btn-primary" type="submit"${loadState === "ready" ? "" : " disabled"}>Spara</button>
        <button class="btn-secondary" type="button" data-act="cancel">Avbryt</button>
        ${d && isEdited(d.id) ? `<button class="btn-secondary" type="button" data-act="reset">Återställ originalet</button>` : ""}
        ${d ? deleteHtml(d) : ""}
        <p class="field-error" id="form-note" role="alert" hidden></p>
      </form>
    </section></div>`;
  }

  // Deletes an own dish; the list then offers "Ångra". Blocked (with the reason) for the first top-up or a
  // meal that would be left with too few dishes.
  function deleteHtml(d) {
    const block = dishes.offBlock(d.id);
    if (block) return `<p class="note">Kan inte raderas: ${esc(block)}</p>`;
    return `<button class="btn-secondary" type="button" data-act="delete-dish">Radera rätten</button>`;
  }

  function render(focusSel) {
    el.innerHTML = editing ? formHtml() : listHtml(msg, undo);
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
      kind: d?.kind ?? null,
      rows: (d?.ingredients ?? []).map(([name, amount, unit, , nummer]) => ({ name, amount, unit, nummer })),
      auto: !d || d.auto === true || (d.auto === undefined && !meals.isBuiltIn(id) ? "legacy" : false),
    };
    refit();
    results = [];
    msg = "";
    undo = null;
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
    const kindChoice = el.querySelector('input[name="kind"]:checked')?.value;
    const m = totals();
    const raw = { auto: editing.auto === true, name: editing.name, ingredients: ingredientsOf(), kcal: m.kcal, protein: m.protein, fat: m.fat, carbs: m.carbs,
      meals: choice === "both" || !choice ? meals.MAIN : [choice], kind: kindChoice ?? editing.kind };
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
    if (t.id === "breakfast-pick") {
      msg = dishes.setBreakfast(t.value, replace) ? `Varje dag: ${esc(meals.dishOf(t.value).name)}.` : SAVE_ERROR;
      undo = null;
      render("#breakfast-pick");
      return;
    }
    if (t.dataset.topup) {
      const which = t.dataset.topup;
      msg = dishes.setTopup(t.value, which) ? `${which === "topup" ? "Först" : "Sedan"}: ${t.value === "none" ? "inget" : esc(meals.dishOf(t.value).name)}.` : SAVE_ERROR;
      undo = null;
      render(`#${which}-pick`);
      return;
    }
    if (!editing) return;
    if (t.dataset.unit !== undefined) { editing.rows[+t.dataset.unit].unit = t.value; editing.auto = false; updateTotals(); }
    else if (t.name === "meals") editing.meals = t.value === "both" ? meals.MAIN : [t.value];
    else if (t.name === "kind") editing.kind = t.value;
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
    } else if (act === "delete-dish") {
      const id = editing.id, name = meals.dishOf(id).name;
      if (!dishes.deleteDish(id, replace)) return fail(SAVE_ERROR);
      msg = `${esc(name)} är raderad.`;
      undo = id;
      editing = null;
      render('[data-act="undo-delete"]');
    } else if (act === "undo-delete") {
      const ok = dishes.undeleteDish(id);
      undo = null;
      msg = ok ? `${esc(meals.dishOf(id).name)} är tillbaka.` : SAVE_ERROR;
      render(ok ? `[data-act="edit"][data-id="${CSS.escape(id)}"]` : null);
    } else if (act === "tab") {
      tab = btn.dataset.tab;
      msg = ""; undo = null;
      render(`[data-act="tab"][data-tab="${tab}"]`);
    } else if (act === "hide" || act === "show") {
      const name = meals.dishOf(id).name;
      if (!dishes.setVisible(id, act === "show", replace)) { msg = SAVE_ERROR; render(); return; }
      msg = act === "show" ? `${esc(name)} används nu.` : `${esc(name)} flyttad till Fler rätter och utbytt i resten av veckan.`;
      undo = null;
      render(`[data-act][data-id="${CSS.escape(id)}"].switch`);
    }
  };

  render();
}
