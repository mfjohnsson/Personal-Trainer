import { get } from "../store.js";
import * as meals from "../meals.js";
import * as dishes from "../dishes.js";
import * as foods from "../foods.js";
import { esc } from "../html.js";

export const title = "Rätter";

const SLOT_ORDER = ["frukost", "lunch", "mellanmal", "middag"];
const labelOf = (slot) => meals.SLOTS.find((s) => s.id === slot).label;

const NUMBERS = [
  ["kcal", "Kalorier per portion (kcal)"],
  ["protein", "Protein per portion (g)"],
  ["fat", "Fett per portion (g)"],
  ["carbs", "Kolhydrater per portion (g)"],
];
const FIELD_KEYS = ["name", "ingredients", ...NUMBERS.map((n) => n[0])];

const isEdited = (id) => meals.isBuiltIn(id) && !!get("dishes")?.items?.[id];

function rowHtml(d) {
  const shown = meals.isVisible(d.id);
  const tags = [!meals.isBuiltIn(d.id) && "Egen", isEdited(d.id) && "Ändrad", !shown && "Dold"].filter(Boolean);
  const toggle = shown
    ? `<button class="btn-secondary" type="button" data-act="hide" data-id="${esc(d.id)}"${dishes.canHide(d.id) ? "" : " disabled"}
        aria-label="Dölj ${esc(d.name)}">Dölj</button>`
    : `<button class="btn-secondary" type="button" data-act="show" data-id="${esc(d.id)}" aria-label="Visa ${esc(d.name)}">Visa</button>`;
  return `<div class="dish-row${shown ? "" : " is-off"}">
    <div class="dish-main">
      <span class="ex-name">${esc(d.name)}</span>${tags.map((t) => `<span class="badge">${t}</span>`).join("")}
      <p class="note">${d.kcal} kcal · ${d.protein} g protein · ${d.fat} g fett · ${d.carbs} g kolh.</p>
    </div>
    <div class="dish-actions">
      <button class="btn-secondary" type="button" data-act="edit" data-id="${esc(d.id)}" aria-label="Ändra ${esc(d.name)}">Ändra</button>
      ${toggle}
    </div>
  </div>`;
}

function listHtml(msg) {
  const sections = SLOT_ORDER.map((slot) => `
    <section class="card">
      <h2><span class="dot" style="background: var(--c-midja)"></span>${labelOf(slot)}</h2>
      ${meals.allDishes(slot).map(rowHtml).join("")}
      <button class="btn-secondary add-dish" type="button" data-act="add" data-slot="${slot}">Lägg till rätt</button>
    </section>`).join("");
  return `<div class="view">
    <section class="card">
      <h2><span class="dot" style="background: var(--c-vikt)"></span>Rätter</h2>
      <p class="note">Ändra, dölj eller lägg till rätter. Dolda rätter väljs aldrig av veckoförslaget, men syns inte heller i rullistorna. Minst två rätter per måltid måste vara synliga (frukost: minst en).</p>
      <p class="note" id="list-note" role="status" aria-live="polite">${msg ?? ""}</p>
      <a class="btn-secondary" href="#/kost">Tillbaka till Kost</a>
    </section>${sections}</div>`;
}

function formHtml(editing) {
  const d = editing.id ? meals.dishOf(editing.id) : null;
  const val = (k) => {
    if (!d) return "";
    if (k === "ingredients") return esc(meals.formatIngredients(d.ingredients));
    return esc(k === "name" ? d.name : String(d[k] ?? "").replace(".", ","));
  };
  const numbers = NUMBERS.map(([key, label]) => `
    <div class="field">
      <label for="d-${key}">${label}</label>
      <input id="d-${key}" name="${key}" type="text" inputmode="decimal" autocomplete="off" value="${val(key)}"
        aria-describedby="err-${key}">
      <p class="field-error" id="err-${key}" hidden></p>
    </div>`).join("");
  return `<div class="view"><section class="card">
    <h2><span class="dot" style="background: var(--c-vikt)"></span>${d ? "Ändra rätt" : "Ny rätt"} · ${labelOf(editing.slot)}</h2>
    <form id="dish-form" class="form" novalidate>
      <div class="field">
        <label for="d-name">Namn</label>
        <input id="d-name" name="name" type="text" autocomplete="off" value="${val("name")}" aria-describedby="err-name">
        <p class="field-error" id="err-name" hidden></p>
      </div>
      <div class="field">
        <label for="d-ingredients">Ingredienser, en per rad</label>
        <textarea id="d-ingredients" name="ingredients" rows="6" autocomplete="off" spellcheck="false"
          aria-describedby="err-ingredients hint-ingredients">${val("ingredients")}</textarea>
        <p class="note" id="hint-ingredients">Så här: 200 g Kycklingfilé, 1,5 dl Mjölk, 2 st Ägg. Enheter: g, dl, st, skivor.</p>
        <p class="field-error" id="err-ingredients" hidden></p>
      </div>
      <button class="btn-secondary" type="button" data-act="calc">Räkna ut näringsvärden från ingredienserna</button>
      <div id="calc-panel" class="calc" aria-live="polite" hidden></div>
      ${numbers}
      <p class="note">Värdena gäller en portion, alltså mängderna i listan. Appen skalar portionen så att dagen når målet.</p>
      <button class="btn-primary" type="submit">Spara</button>
      <button class="btn-secondary" type="button" data-act="cancel">Avbryt</button>
      ${d && isEdited(d.id) ? `<button class="btn-secondary" type="button" data-act="reset">Återställ originalet</button>` : ""}
      <p class="field-error" id="form-note" role="alert" hidden></p>
    </form>
  </section></div>`;
}

export function mount(el) {
  let editing = null; // { id, slot } while the form is open
  let msg = "";
  let picks = {}; // lower-case ingredient name -> chosen food number, kept with the dish
  let calcIngs = null; // the ingredients the open calculation is for
  let calcMacros = null;
  let calcRun = 0; // bumped on every calculation and when it is cancelled, so a late answer is ignored

  function render(focusSel) {
    el.innerHTML = editing ? formHtml(editing) : listHtml(msg);
    const form = el.querySelector("#dish-form");
    calcIngs = null;
    calcRun++;
    if (editing) {
      picks = {};
      for (const [name, , , , nummer] of editing.id ? meals.dishOf(editing.id).ingredients : []) if (nummer) picks[name.toLowerCase()] = nummer;
    }
    if (form) form.onsubmit = (e) => { e.preventDefault(); submit(form); };
    window.scrollTo(0, 0);
    const sel = focusSel ?? (editing ? "#d-name" : null);
    if (sel) el.querySelector(sel)?.focus();
  }

  function submit(form) {
    const { values, errors } = meals.validateDish(Object.fromEntries(new FormData(form)));
    for (const key of FIELD_KEYS) {
      const err = el.querySelector(`#err-${key}`), input = el.querySelector(`#d-${key}`);
      err.hidden = !errors[key];
      err.textContent = errors[key] ?? "";
      input.toggleAttribute("aria-invalid", !!errors[key]);
    }
    const firstBad = FIELD_KEYS.find((k) => errors[k]);
    if (firstBad) { el.querySelector(`#d-${firstBad}`).focus(); return; }
    // Remember the foods the user picked, so the next calculation starts from the same ones.
    values.ingredients = values.ingredients.map((ing) => (picks[ing[0].toLowerCase()] ? [...ing, picks[ing[0].toLowerCase()]] : ing));
    const id = dishes.saveDish(editing.id, editing.slot, values);
    if (id === null) return fail("Kunde inte spara. Lagringen är full eller blockerad.");
    msg = `Sparat: ${esc(values.name)}.`;
    editing = null;
    render(`[data-act="edit"][data-id="${id}"]`);
  }

  function fail(text) {
    const note = el.querySelector("#form-note") ?? el.querySelector("#list-note");
    note.hidden = false;
    note.textContent = text;
  }

  const gramsNote = (l) => `${l.grams} g${l.estimated ? " (uppskattad vikt)" : ""}`;
  const foodOptions = (name, current, query) => {
    const list = [current, ...foods.search(query || name, 6).filter((f) => f.nummer !== current?.nummer)].filter(Boolean);
    return list.map((f) => `<option value="${f.nummer}"${f.nummer === current?.nummer ? " selected" : ""}>${esc(f.name)} · ${f.kcal} kcal/100 g</option>`).join("");
  };
  const storedPick = (name) => !!editing?.id && meals.dishOf(editing.id).ingredients.some((i) => i[0].toLowerCase() === name.toLowerCase() && i[4]);
  const pickByIndex = () => Object.fromEntries(calcIngs.map(([n], i) => [i, picks[n.toLowerCase()]]).filter(([, v]) => v !== undefined));

  function showTotals() {
    calcMacros = foods.macrosOf(calcIngs, pickByIndex());
    const m = calcMacros;
    m.lines.forEach((l, i) => { el.querySelector(`#calc-kcal-${i}`).textContent = `${gramsNote(l)} · ${Math.round(l.kcal)} kcal`; });
    el.querySelector("#calc-total").textContent = `Summa per portion: ${m.kcal} kcal · protein ${m.protein} g · fett ${m.fat} g · kolhydrater ${m.carbs} g.`
      + (m.unmatched.length ? ` Ingen träff för: ${m.unmatched.join(", ")}. Sök själv eller fyll i värdena för hand.` : "");
  }

  async function runCalc() {
    const form = el.querySelector("#dish-form"), panel = el.querySelector("#calc-panel"), err = el.querySelector("#err-ingredients");
    const parsed = meals.parseIngredients(form.elements.ingredients.value);
    const run = ++calcRun;
    err.hidden = !parsed.error;
    err.textContent = parsed.error ?? "";
    if (parsed.error) { el.querySelector("#d-ingredients").focus(); return; }
    panel.hidden = false;
    panel.textContent = "Hämtar livsmedelsdata…";
    try { await foods.load(); } catch { if (run === calcRun) panel.textContent = "Kunde inte läsa livsmedelsdata. Fyll i värdena för hand."; return; }
    if (run !== calcRun || !el.contains(panel)) return;
    calcIngs = parsed.ingredients;
    const first = foods.macrosOf(calcIngs, pickByIndex());
    first.lines.forEach((l) => { if (l.food) picks[l.name.toLowerCase()] = l.food.nummer; });
    panel.innerHTML = first.lines.map((l, i) => `
      <div class="calc-row">
        <div class="calc-top"><span class="ex-name">${esc(calcIngs[i][1] + " " + calcIngs[i][2] + " " + l.name)}</span>
          <span class="note" id="calc-kcal-${i}"></span></div>
        ${foods.isPreferred(l.name) || storedPick(l.name) ? "" : `<p class="note guess">Gissad träff, kontrollera att det stämmer.</p>`}
        <select class="pick" data-calc="${i}" aria-label="Livsmedel för ${esc(l.name)}">${foodOptions(l.name, l.food)}</select>
        <input class="calc-search" type="search" data-calc-search="${i}" placeholder="Sök annat livsmedel" autocomplete="off"
          aria-label="Sök livsmedel för ${esc(l.name)}">
      </div>`).join("")
      + `<p class="note" id="calc-total"></p>
      <button class="btn-primary" type="button" data-act="apply-calc">Använd värdena</button>
      <p class="note">Källa: Livsmedelsverkets livsmedelsdatabas (CC BY 4.0), värden per 100 g. Vikten för st, dl och skivor är uppskattad. Olja och kryddor räknas bara om de står i listan.</p>`;
    showTotals();
    panel.querySelector("select")?.focus();
  }

  function applyCalc() {
    const put = (id, v) => { el.querySelector(`#d-${id}`).value = String(v); };
    put("kcal", calcMacros.kcal); put("protein", calcMacros.protein); put("fat", calcMacros.fat); put("carbs", calcMacros.carbs);
    el.querySelector("#d-kcal").focus();
  }

  el.onchange = (e) => {
    const sel = e.target;
    if (!calcIngs || !(sel instanceof HTMLSelectElement) || sel.dataset.calc === undefined) return;
    picks[calcIngs[+sel.dataset.calc][0].toLowerCase()] = Number(sel.value);
    showTotals();
  };
  el.oninput = (e) => {
    const t = e.target;
    if (t.id === "d-ingredients") { calcRun++; calcIngs = null; el.querySelector("#calc-panel").hidden = true; return; }
    if (!calcIngs || t.dataset?.calcSearch === undefined) return;
    const i = +t.dataset.calcSearch, name = calcIngs[i][0];
    const results = foods.search(t.value, 6);
    if (!results.length) return;
    el.querySelector(`select[data-calc="${i}"]`).innerHTML = foodOptions(name, results[0], t.value);
    picks[name.toLowerCase()] = results[0].nummer;
    showTotals();
  };
  // Enter in the search box must not submit the dish form.
  el.onkeydown = (e) => { if (e.key === "Enter" && e.target.dataset?.calcSearch !== undefined) e.preventDefault(); };

  // Assigned, not added: `el` is the same element for every view (app.js clears it between views).
  el.onclick = (e) => {
    const btn = e.target.closest?.("button[data-act]");
    if (!btn) return;
    const { act, id, slot } = btn.dataset;
    if (act === "add") { editing = { id: null, slot }; msg = ""; render(); }
    else if (act === "edit") { editing = { id, slot: meals.dishOf(id).slot }; msg = ""; render(); }
    else if (act === "calc") runCalc();
    else if (act === "apply-calc") applyCalc();
    else if (act === "cancel") { const back = editing.id; editing = null; msg = ""; render(back && `[data-act="edit"][data-id="${back}"]`); }
    else if (act === "reset") {
      const back = editing.id;
      if (!dishes.resetDish(back)) return fail("Kunde inte spara. Lagringen är full eller blockerad.");
      msg = "Originalet är tillbaka.";
      editing = null;
      render(`[data-act="edit"][data-id="${back}"]`);
    } else if (act === "hide" || act === "show") {
      const name = meals.dishOf(id).name;
      if (!dishes.setVisible(id, act === "show")) { msg = "Kunde inte spara. Lagringen är full eller blockerad."; render(); return; }
      msg = `${esc(name)} är ${act === "show" ? "synlig" : "dold"}.`;
      render(`[data-act="${act === "show" ? "hide" : "show"}"][data-id="${id}"]`);
    }
  };

  render();
}
