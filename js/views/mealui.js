// Shared meal UI for Idag and Kost: one day's meals as folded rows. The plan is followed unless you say
// otherwise. Open a meal and everything is right there: each ingredient's amount (− / type it / +), foods
// to add, another dish, "Åt inte", "Mer protein", "Åt något annat". The top-up is a row of its own with a
// picker per day. Nothing locks by itself: you mark the day done ("Klarmarkera dagen"). Calorie changes and
// a new suggestion sit behind the day's ⋯ menu.
import * as meals from "../meals.js";
import * as mealplan from "../mealplan.js";
import * as foods from "../foods.js";
import { esc } from "../html.js";

const nf = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });
const amount = (i) => `${nf.format(i.amount)} ${i.unit}`;
const signed = (v) => (v > 0 ? `+${nf.format(v)}` : v < 0 ? `−${nf.format(-v)}` : "0");

const openMeals = new Set(); // "day:slot" of opened meals, kept while the app runs

// Which week Kost and the shopping list show: this one, or next week.
export const weekView = { next: false };
let customFor = null; // "day:slot" whose "Åt något annat" form is open
let addFor = null; // "day:slot" whose "Lägg till livsmedel" search is open
let menuFor = null; // day whose ⋯ menu is open
let adjustFor = null; // day whose calorie panel is open
let regenFor = null; // day asking "Nytt förslag?"
export function closePanels() { customFor = null; addFor = null; menuFor = null; adjustFor = null; regenFor = null; }

// Foods picked in the "Åt något annat" form; they fill in kcal and protein. Each row is
// { nummer, amount, unit, abv? }: a drink is `amount` glasses of `unit` cl, food is `amount` portions or grams.
let customRows = [];
let foodsState = "idle"; // idle | loading | ready | failed

const num = (s) => { const v = Number(String(s).trim().replace(",", ".")); return Number.isFinite(v) && v > 0 ? v : NaN; };
const numText = (v) => (Number.isFinite(v) ? nf.format(v).replace(/\s/g, "") : "");
const portionGrams = (f) => (/m\. bröd/i.test(f.name) ? 200 : meals.defaultGrams(f));

function rowGrams(r) {
  const f = foods.foodByNumber(r.nummer);
  if (!Number.isFinite(r.amount)) return 0;
  if (foods.isDrink(f)) return r.amount * r.unit * 10;
  return r.unit === "portion" ? r.amount * portionGrams(f) : r.amount;
}

function customMacros() {
  const t = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  for (const r of customRows) {
    const m = foods.itemMacros(foods.foodByNumber(r.nummer), rowGrams(r), Number.isFinite(r.abv) ? r.abv : undefined);
    for (const k in t) t[k] += m[k];
  }
  for (const k in t) t[k] = Math.round(t[k]);
  return t;
}

// A stored row is only used again if it still makes sense.
const validRow = (r) => !!r && Number.isInteger(r.nummer) && Number.isFinite(r.amount) && r.amount > 0
  && (r.unit === "portion" || r.unit === "g" || Number.isFinite(r.unit)) && (r.abv === undefined || Number.isFinite(r.abv));

function newRow(f) {
  if (foods.isDrink(f)) return { nummer: f.nummer, amount: 1, unit: foods.drinkSize(f), abv: foods.abvOf(f) || undefined };
  return { nummer: f.nummer, amount: 1, unit: "portion" };
}

const drinkName = (f) => f.name.replace(/ vol\. % [\d,]+/, "").replace(" (uppskattning)", "");

function calcRowHtml(r, i) {
  const f = foods.foodByNumber(r.nummer);
  const remove = `<button type="button" class="icon-btn" data-act="calc-remove" data-i="${i}" aria-label="Ta bort ${esc(f.name)}">✕</button>`;
  if (foods.isDrink(f)) {
    const abv = r.abv === undefined ? "" : `<label class="abv">Alkoholhalt <input type="text" inputmode="decimal" autocomplete="off" data-abv="${i}" value="${numText(r.abv)}" aria-label="Alkoholhalt ${esc(drinkName(f))}, procent"> %</label>`;
    return `<div class="ing-row">
      <div class="ing-name"><span class="ex-name">${esc(drinkName(f))}</span>${abv}
        ${f.nummer >= 9000000 ? `<span class="note">Uppskattning</span>` : ""}</div>
      <div class="ing-amount">
        <input type="text" inputmode="decimal" autocomplete="off" data-amount="${i}" value="${numText(r.amount)}" aria-label="Antal ${esc(drinkName(f))}">
        <span class="note" aria-hidden="true">×</span>
        <select data-unit="${i}" aria-label="Storlek ${esc(drinkName(f))}">${foods.DRINK_SIZES.map((s) => `<option value="${s}"${s === r.unit ? " selected" : ""}>${s} cl</option>`).join("")}</select>
        ${remove}
      </div></div>`;
  }
  const units = [["portion", `portion (≈ ${portionGrams(f)} g)`], ["g", "g"]];
  return `<div class="ing-row">
    <div class="ing-name"><span class="ex-name">${esc(f.name)}</span></div>
    <div class="ing-amount">
      <input type="text" inputmode="decimal" autocomplete="off" data-amount="${i}" value="${numText(r.amount)}" aria-label="Mängd ${esc(f.name)}">
      <select data-unit="${i}" aria-label="Enhet ${esc(f.name)}">${units.map(([v, label]) => `<option value="${v}"${v === r.unit ? " selected" : ""}>${label}</option>`).join("")}</select>
      ${remove}
    </div></div>`;
}

const calcRowsHtml = () => customRows.map(calcRowHtml).join("");

function calcHtml() {
  if (foodsState !== "ready") {
    return `<p class="note">${foodsState === "failed" ? "Kunde inte läsa livsmedelsdata. Fyll i kalorierna själv." : "Hämtar livsmedelsdata…"}</p>`;
  }
  customRows = customRows.filter((r) => foods.foodByNumber(r.nummer));
  return `<div class="ing-list" id="c-rows">${calcRowsHtml()}</div>
    <div class="field"><label for="c-search">Räkna ut från mat (valfritt)</label>
      <input id="c-search" type="search" autocomplete="off" placeholder="Sök, t.ex. hamburgare, pommes, öl">
      <div class="results" id="c-results"></div></div>
    <p class="calc-total" id="c-total" aria-live="polite"></p>`;
}

// `prev`: what you entered before (editing it), or null.
function customForm(d, slot, prev) {
  const val = (v) => (prev && Number.isFinite(v) ? ` value="${v}"` : "");
  return `<form class="custom-form form" data-day="${d}" data-slot="${slot}" novalidate>
    <div class="field"><label for="c-name">Vad åt du? (valfritt)</label>
      <input id="c-name" name="name" type="text" autocomplete="off" maxlength="40"${prev?.name ? ` value="${esc(prev.name)}"` : ""}></div>
    <div id="c-calc">${calcHtml()}</div>
    <div class="field-pair">
      <div class="field"><label for="c-kcal">Kalorier, ungefär</label>
        <input id="c-kcal" name="kcal" type="text" inputmode="decimal" autocomplete="off" aria-describedby="err-c-kcal"${val(prev?.kcal)}>
        <p class="field-error" id="err-c-kcal" hidden></p></div>
      <div class="field"><label for="c-protein">Protein (g)</label>
        <input id="c-protein" name="protein" type="text" inputmode="decimal" autocomplete="off" aria-describedby="err-c-protein"${val(prev?.protein)}>
        <p class="field-error" id="err-c-protein" hidden></p></div>
    </div>
    <div class="btn-row">
      <button class="btn-secondary" type="button" data-act="custom-cancel">Avbryt</button>
      <button class="btn-primary" type="submit">Spara</button>
    </div>
  </form>`;
}

// The ingredients as one line: protein first, then the sides.
const ingredientsText = (info) => [...info.ingredients].sort((a, b) => (a.part === b.part ? 0 : a.part === "p" ? -1 : 1))
  .filter((i) => i.amount > 0).map((i) => esc(`${amount(i)} ${i.name.toLowerCase()}`)).join(" · ");

// One amount you can change: − / the number (type it) / +.
function amountRow(name, value, unit, { attrs, stepAct, inputAttr, i, canDown, canUp, remove = "" }) {
  const lower = esc(name.toLowerCase());
  return `<div class="ate-row ing-tweak"><span class="pick-label">${esc(name)}</span>
    <span class="amt-ctl">
      <button class="icon-btn" type="button" data-act="${stepAct}" data-ing="${i}" data-dir="-1" ${attrs} aria-label="Mindre ${lower}"${canDown ? "" : " disabled"}>−</button>
      <input class="amt" type="text" inputmode="decimal" autocomplete="off" ${inputAttr}="${i}" ${attrs} value="${numText(value) || "0"}" aria-label="${esc(name)}, ${esc(unit)}">
      <span class="amt-unit">${esc(unit)}</span>
      <button class="icon-btn" type="button" data-act="${stepAct}" data-ing="${i}" data-dir="1" ${attrs} aria-label="Mer ${lower}"${canUp ? "" : " disabled"}>+</button>
      ${remove}
    </span>
  </div>`;
}

// "Lägg till livsmedel": a search in the food database.
function addFormHtml(attrs) {
  return `<div class="add-food">
    <label class="pick-label" for="a-search">Lägg till livsmedel</label>
    <input id="a-search" type="search" autocomplete="off" placeholder="Sök, t.ex. banan, keso, ost" ${attrs}>
    <div class="results" id="a-results"></div>
    <button class="link-btn" type="button" data-act="add-close" ${attrs}>Avbryt</button>
  </div>`;
}

// An open meal: its ingredients to change right here, foods to add, another dish, and what happened.
function editHtml(week, d, m, i, planOnly) {
  const attrs = `data-day="${d}" data-slot="${m.slot}"`;
  const info = meals.mealInfo(m);
  const dish = meals.dishOf(m.dish);
  const nDish = dish.ingredients.length;
  const rows = !dish.lines ? `<p class="note">${ingredientsText(info)}</p>` : info.ingredients.map((it, j) => {
    if (it.added) {
      const k = j - nDish;
      return amountRow(it.name, it.amount, it.unit, {
        attrs, stepAct: "add-step", inputAttr: "data-add-amt", i: k, canDown: true, canUp: true,
        remove: `<button class="icon-btn" type="button" data-act="add-remove" data-ing="${k}" ${attrs} aria-label="Ta bort ${esc(it.name.toLowerCase())}">✕</button>`,
      });
    }
    const t = Array.isArray(m.tweak) ? m.tweak[j] ?? 1 : 1;
    return amountRow(it.name, it.amount, it.unit, { attrs, stepAct: "tweak", inputAttr: "data-amt", i: j, canDown: it.amount > 0, canUp: t < meals.TWEAK_MAX });
  }).join("");
  const key = `${d}:${m.slot}`;
  const canAdd = foods.isLoaded() && (m.add?.length ?? 0) < meals.ADD_MAX;
  const adder = addFor === key ? addFormHtml(attrs)
    : canAdd ? `<button class="link-btn add-btn" type="button" data-act="add-open" ${attrs}>+ Lägg till livsmedel</button>` : "";
  const other = meals.otherMain(week.days[d], m.slot);
  const offered = meals.DISHES[m.slot] ? meals.DISHES[m.slot].filter((o) => o.id !== other) : [];
  const options = offered.some((o) => o.id === m.dish) ? offered : [...offered, dish];
  const picker = options.length > 1
    ? `<div class="pick-row"><label class="pick-label" for="pick-${d}-${m.slot}">Byt rätt</label>
      <select class="pick" id="pick-${d}-${m.slot}" ${attrs}>
        ${options.map((o) => `<option value="${esc(o.id)}"${o.id === m.dish ? " selected" : ""}>${esc(o.name)}</option>`).join("")}
      </select></div>` : "";
  const canMore = !meals.isPinned(week, d, i) && meals.canMoreProtein(m);
  return `<div class="edit-box">
      ${rows}
      ${adder}
      <p class="note macros">Fett ${info.fat} g · Kolhydrater ${info.carbs} g</p>
    </div>
    ${picker}
    <div class="meal-actions">
      ${planOnly ? "" : `<button class="btn-secondary" type="button" data-act="skip" ${attrs}>Åt inte</button>`}
      ${canMore ? `<button class="btn-secondary" type="button" data-act="more-protein" ${attrs}>Mer protein</button>` : ""}
      ${planOnly ? "" : `<button class="btn-secondary" type="button" data-act="custom-open" ${attrs}>Åt något annat</button>`}
    </div>
    ${meals.isTouched(m) ? `<button class="link-btn" type="button" data-act="reset" ${attrs}>Låt appen sätta mängderna</button>` : ""}`;
}

// `planOnly`: a week not started yet: nothing can be skipped or eaten otherwise.
function mealHtml(week, d, m, i, planOnly) {
  const key = `${d}:${m.slot}`;
  const info = meals.mealInfo(m);
  const attrs = `data-day="${d}" data-slot="${m.slot}"`;
  let body;
  if (customFor === key) body = customForm(d, m.slot, m.custom ?? null);
  else if (info.custom) {
    body = `<p class="note">Du åt något annat i stället för ${esc(meals.dishOf(m.dish)?.name.toLowerCase() ?? "det planerade")}.</p>
      <div class="meal-actions">
        <button class="btn-secondary" type="button" data-act="custom-open" ${attrs}>Ändra</button>
        <button class="btn-secondary" type="button" data-act="custom-undo" ${attrs}>Tillbaka till planen</button>
      </div>`;
  } else if (meals.isSkipped(m)) {
    const rest = meals.dayOver(week, d) ? "" : " Resten av dagen tar igen proteinet.";
    body = `<p class="note">Du åt inte ${esc(meals.dishOf(m.dish)?.name.toLowerCase() ?? "det här")}.${rest}</p>
      <button class="btn-secondary" type="button" data-act="skip-undo" ${attrs}>Ångra</button>`;
  } else body = editHtml(week, d, m, i, planOnly);
  const badge = info.custom ? ` <span class="badge">Eget</span>`
    : meals.isSkipped(m) ? ` <span class="badge">Åt inte</span>`
    : meals.isTouched(m) ? ` <span class="badge">Ändrad</span>` : "";
  return `<details class="meal${meals.isSkipped(m) ? " skipped" : ""}" data-meal="${key}"${openMeals.has(key) || customFor === key || addFor === key ? " open" : ""}>
    <summary><span class="meal-slot">${meals.slotLabel(m.slot)}</span>
      <span class="meal-name">${esc(info.name)}${badge}</span>
      <span class="meal-kcal">${info.kcal} kcal · ${info.protein} g</span></summary>
    <div class="meal-body">${body}</div>
  </details>`;
}

// The day's top-up picker: the app picks when needed, none, or one you choose. On a day that is over
// there is nothing left for the app to pick: it shows what the day had.
export function extraSelectHtml(week, d, id = `extra-${d}`) {
  const day = week.days[d];
  const over = meals.dayOver(week, d);
  const info = meals.extrasInfo(day);
  let choice = meals.extraChoice(day);
  if (over && choice === "auto") choice = day.extra?.dish ?? "none";
  const list = [...meals.DISHES.mellanmal];
  if (choice !== "auto" && choice !== "none" && !list.some((o) => o.id === choice) && meals.dishOf(choice)) list.push(meals.dishOf(choice));
  const opt = (v, text) => `<option value="${esc(v)}"${v === choice ? " selected" : ""}>${esc(text)}</option>`;
  const auto = choice === "auto" && info.length ? `Appen väljer: ${info.map((e) => e.name).join(" + ")}` : "Appen väljer vid behov";
  return `<select class="pick" id="${id}" data-extra-day="${d}" aria-label="Påfyllning ${regenText(d)}">
    ${over ? "" : opt("auto", auto)}${opt("none", "Ingen")}${list.map((o) => opt(o.id, o.name)).join("")}
  </select>`;
}

// The day's top-up as a row like the meals: what it is, how much, and the picker.
function topupRowHtml(week, d) {
  const day = week.days[d];
  const key = `${d}:extra`;
  const extras = meals.extrasInfo(day);
  const first = extras.find((e) => e.key === "extra");
  const kcal = extras.reduce((a, e) => a + e.kcal, 0), protein = extras.reduce((a, e) => a + e.protein, 0);
  const portion = first ? meals.extraPortions(day) : 0;
  const portions = first ? `<div class="ate-row ing-tweak"><span class="pick-label">Portioner</span><span class="amt-ctl">
      <button class="icon-btn" type="button" data-act="extra-step" data-dir="-1" data-day="${d}" aria-label="Halv portion mindre"${portion > 0.5 ? "" : " disabled"}>−</button>
      <span class="ate-val">${nf.format(portion)}</span>
      <button class="icon-btn" type="button" data-act="extra-step" data-dir="1" data-day="${d}" aria-label="Halv portion mer"${portion < meals.EXTRA_PORTION_MAX ? "" : " disabled"}>+</button>
    </span></div>` : "";
  const why = !extras.length ? "" : first && !first.manual ? `<p class="note">Appen la till den för att nå proteinmålet.</p>` : "";
  return `<details class="meal topup-row" data-meal="${key}"${openMeals.has(key) ? " open" : ""}>
    <summary><span class="meal-slot">Påfyllning</span><span class="meal-name">${extras.length ? esc(extras.map((e) => e.name).join(" + ")) : "Ingen"}</span>
      <span class="meal-kcal">${extras.length ? `${kcal} kcal · ${protein} g` : ""}</span></summary>
    <div class="meal-body">
      ${extras.map((e) => `<p class="note">${extras.length > 1 ? `<strong>${esc(e.name)}:</strong> ` : ""}${ingredientsText(e)}</p>`).join("")}
      ${portions}
      ${why}
      <div class="pick-row"><label class="pick-label" for="extra-${d}">Byt påfyllning</label>${extraSelectHtml(week, d)}</div>
    </div>
  </details>`;
}

// The calorie panel ("Justera kalorierna"): more or fewer calories than the target for this day.
function adjustHtml(day, d, target, bal) {
  const adj = meals.adjustOf(day);
  const off = (v) => (meals.canAdjust(target, v) ? "" : " disabled");
  const btn = (v, text, key, more = "") => `<button class="${key.startsWith("v") ? "" : "icon-btn"}" type="button" data-act="adjust" data-day="${d}" data-kcal="${v}" data-key="${key}"${more}${off(v)}>${text}</button>`;
  const step = 100;
  const auto = day.adjustAuto && bal?.days.includes(d) && bal.over
    ? `<p class="note">Satt av appen: veckan ligger ${nf.format(bal.over)} kcal över.</p>`
    : meals.adjustByYou(day) ? `<button class="link-btn" type="button" data-act="adjust-auto" data-day="${d}" data-kcal="0">Låt appen jämna ut veckan</button>` : "";
  return `<div class="adjust-panel">
    <span class="pick-label">Kalorier jämfört med målet. Proteinet ligger kvar.</span>
    <div class="ate-row">
      ${btn(adj - step, "−", "down", ` aria-label="${step} kcal mindre"`)}
      <span class="ate-val" aria-live="polite">${signed(adj)} kcal</span>
      ${btn(adj + step, "+", "up", ` aria-label="${step} kcal mer"`)}
    </div>
    <div class="seg">${[0, -250, -500, -1000].map((v) => btn(v, v ? signed(v) : "Inget", `v${v}`, ` aria-pressed="${v === adj}"`)).join("")}</div>
    ${auto}
    <button class="btn-primary" type="button" data-act="adjust-close" data-day="${d}">Klar</button>
  </div>`;
}

// The day's ⋯ menu: calories, a new suggestion.
function menuHtml(week, d, target, bal, { regen }) {
  const day = week.days[d];
  if (adjustFor === d) return adjustHtml(day, d, target, bal);
  if (regenFor === d) {
    return `<div class="adjust-panel">
      <p class="note">Nya rätter från ${regenText(d)} och resten av veckan. Det du redan har ätit och det du har skrivit in ligger kvar.</p>
      <div class="btn-row">
        <button class="btn-secondary" type="button" data-act="regen-no" data-day="${d}">Avbryt</button>
        <button class="btn-primary" type="button" data-act="regen-yes" data-day="${d}">Nytt förslag</button>
      </div></div>`;
  }
  const adj = meals.adjustOf(day);
  const open = menuFor === d;
  return `<div class="day-menu">
    <button class="icon-btn menu-btn" type="button" data-act="menu" data-day="${d}" aria-expanded="${open}" aria-label="Fler val för dagen">⋯</button>
    ${open ? `<div class="menu-list" role="group" aria-label="Fler val för dagen">
      <button class="btn-secondary" type="button" data-act="adjust-open" data-day="${d}">Justera kalorierna${adj ? ` (${signed(adj)})` : ""}</button>
      ${regen ? `<button class="btn-secondary" type="button" data-act="regen" data-day="${d}">Nytt förslag</button>` : ""}
    </div>` : ""}
  </div>`;
}
const regenText = (d) => ["måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"][d];

// "Klarmarkera dagen" (today): after that the app changes nothing in the day by itself; you still can.
function doneHtml(day, d) {
  return meals.isDone(day)
    ? `<div class="day-done"><span class="done-mark">✓ Dagen är klar</span>
        <button class="link-btn" type="button" data-act="day-open" data-day="${d}">Öppna igen</button></div>`
    : `<button class="btn-secondary day-done-btn" type="button" data-act="day-done" data-day="${d}">Klarmarkera dagen</button>`;
}

// One day's meals. `bal` (optional) is the week's balance. `planOnly`: next week, planned but not started.
// `regen`: the ⋯ menu offers a new suggestion from this day. `canFinish`: the day can be marked done (today).
export function dayHtml(week, d, target, bal = null, { planOnly = false, regen = true, canFinish = false } = {}) {
  const day = week.days[d];
  const goal = meals.dayTarget(day, target);
  const t = meals.dayTotals(day);
  const over = meals.dayOver(week, d);
  const short = !over && t.protein < goal.protein - meals.PROTEIN_TOLERANCE;
  return `<div class="meals">${day.meals.map((m, i) => mealHtml(week, d, m, i, planOnly)).join("")}${topupRowHtml(week, d)}</div>
    <div class="day-foot">
      <p class="note day-total">${t.kcal} av ${goal.kcal} kcal · ${t.protein} av ${goal.protein} g protein</p>
      ${over ? "" : menuHtml(week, d, target, bal, { regen })}
    </div>
    ${short ? `<p class="note warn">Proteinet ligger lågt i dag.</p>` : ""}
    ${canFinish ? doneHtml(day, d) : ""}`;
}

// Wires the meal rows inside `el` for the week starting `start` (a date, or a function giving it when the
// view can switch weeks). `rerender()` draws the view again.
export function bindMeals(el, { start, target, rerender, failed }) {
  closePanels();
  let salt = 0;
  const startOf = typeof start === "function" ? start : () => start;
  const week = () => mealplan.weekMeals(startOf(), target);
  const save = (next, focusSel) => {
    const ok = !!next && mealplan.saveWeek(next);
    rerender();
    if (next && !ok) failed();
    if (focusSel) el.querySelector(focusSel)?.focus();
    return ok;
  };

  function recalc() {
    const total = el.querySelector("#c-total");
    if (!total) return;
    const form = el.querySelector("form.custom-form");
    if (!customRows.length) {
      total.textContent = "";
      form.querySelector("#c-kcal").value = "";
      form.querySelector("#c-protein").value = "";
      return;
    }
    const m = customMacros();
    form.querySelector("#c-kcal").value = m.kcal;
    form.querySelector("#c-protein").value = m.protein;
    for (const k of ["kcal", "protein"]) {
      form.querySelector(`#err-c-${k}`).hidden = true;
      form.querySelector(`#c-${k}`).removeAttribute("aria-invalid");
    }
    total.textContent = `Räknat: ${m.kcal} kcal · ${m.protein} g protein`;
  }

  el.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "a-search") {
      const hits = t.value.trim().length >= 2 ? foods.search(t.value, 8) : [];
      el.querySelector("#a-results").innerHTML = hits.map((f) => `<button type="button" class="result" data-act="add-pick" data-nr="${f.nummer}" data-day="${t.dataset.day}" data-slot="${t.dataset.slot}">
          <span>${esc(f.name)}</span><span class="note">${Math.round(f.kcal)} kcal · ${nf.format(f.protein)} g protein /100 g</span></button>`).join("");
    } else if (t.id === "c-search") {
      const hits = t.value.trim().length >= 2 ? foods.search(t.value, 8) : [];
      el.querySelector("#c-results").innerHTML = hits.map((f) => {
        const per = foods.isDrink(f) ? `${Math.round(f.kcal * foods.drinkSize(f) / 10)} kcal per ${foods.drinkSize(f)} cl` : `${Math.round(f.kcal)} kcal · ${nf.format(f.protein)} g protein /100 g`;
        return `<button type="button" class="result" data-act="calc-add" data-nr="${f.nummer}">
          <span>${esc(f.name)}</span><span class="note">${per}</span></button>`;
      }).join("");
    } else if (t.dataset.amount !== undefined) {
      customRows[+t.dataset.amount].amount = num(t.value);
      recalc();
    } else if (t.dataset.abv !== undefined) {
      const v = Number(t.value.trim().replace(",", "."));
      customRows[+t.dataset.abv].abv = t.value.trim() !== "" && v >= 0 && v <= 80 ? v : NaN;
      recalc();
    }
  });

  el.addEventListener("keydown", (e) => {
    const t = e.target;
    if (e.key !== "Enter") return;
    if (t.classList?.contains("amt")) { e.preventDefault(); t.blur(); return; } // the amount is saved on change
    if (t.id === "a-search") { e.preventDefault(); el.querySelector('[data-act="add-pick"]')?.click(); return; }
    if (t.id === "c-search") { e.preventDefault(); el.querySelector('[data-act="calc-add"]')?.click(); }
    else if (t.dataset?.amount !== undefined || t.dataset?.abv !== undefined) e.preventDefault();
  });

  el.addEventListener("toggle", (e) => {
    const det = e.target;
    if (!(det instanceof HTMLDetailsElement) || !det.dataset.meal) return;
    if (det.open) openMeals.add(det.dataset.meal); else openMeals.delete(det.dataset.meal);
  }, true);

  el.addEventListener("change", (e) => {
    const sel = e.target;
    // A typed amount: one of the dish's ingredients, or a food you added.
    if (sel instanceof HTMLInputElement && sel.classList.contains("amt")) {
      const v = Number(sel.value.trim().replace(",", "."));
      const { day, slot } = sel.dataset;
      if (!(sel.value.trim() !== "" && v >= 0 && Number.isFinite(v))) { rerender(); return; }
      mealplan.tick();
      openMeals.add(`${day}:${slot}`);
      const next = sel.dataset.amt !== undefined
        ? meals.setAmount(week(), +day, slot, +sel.dataset.amt, v)
        : meals.setAddAmount(week(), +day, slot, +sel.dataset.addAmt, v);
      if (next) save(next); else rerender();
      return;
    }
    if (sel instanceof HTMLSelectElement && sel.dataset.unit !== undefined) {
      const i = +sel.dataset.unit, r = customRows[i], f = foods.foodByNumber(r.nummer);
      if (foods.isDrink(f)) r.unit = Number(sel.value);
      else {
        const gr = portionGrams(f);
        if (Number.isFinite(r.amount)) r.amount = sel.value === "g" ? Math.round(r.amount * gr) : Math.round((r.amount / gr) * 10) / 10;
        r.unit = sel.value;
        const input = el.querySelector(`[data-amount="${i}"]`);
        if (input) input.value = numText(r.amount);
      }
      recalc();
      return;
    }
    if (sel instanceof HTMLSelectElement && sel.dataset.extraDay !== undefined) {
      mealplan.tick();
      openMeals.add(`${sel.dataset.extraDay}:extra`);
      save(meals.setExtraChoice(week(), +sel.dataset.extraDay, sel.value), `#${sel.id}`);
      return;
    }
    if (!(sel instanceof HTMLSelectElement) || sel.dataset.slot === undefined || sel.dataset.day === undefined) return;
    mealplan.tick();
    save(meals.changeDish(week(), +sel.dataset.day, sel.dataset.slot, sel.value), `#pick-${sel.dataset.day}-${sel.dataset.slot}`);
  });

  el.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    mealplan.tick(); // the app may have been open for hours: what is past is decided now
    const { act } = btn.dataset;
    const form = btn.closest("form.custom-form");
    const day = btn.dataset.day ?? form?.dataset.day, slot = btn.dataset.slot ?? form?.dataset.slot;
    const key = `${day}:${slot}`;
    const sel = (a) => `[data-act="${a}"][data-day="${day}"]${slot ? `[data-slot="${slot}"]` : ""}`;
    if (act === "custom-open") {
      customFor = key;
      addFor = null;
      // Editing what you entered: the foods you picked come back too.
      const cur = week().days[+day]?.meals.find((x) => x.slot === slot)?.custom;
      customRows = Array.isArray(cur?.rows) ? cur.rows.filter(validRow).map((r) => ({ ...r })) : [];
      foodsState = foods.isLoaded() ? "ready" : "loading";
      rerender();
      el.querySelector("#c-name")?.focus();
      if (foodsState === "loading") {
        const mine = customFor;
        foods.load().then(() => "ready", () => "failed").then((s) => {
          foodsState = s;
          const box = customFor === mine && el.querySelector("#c-calc");
          if (box) box.innerHTML = calcHtml();
        });
      }
    }
    else if (act === "calc-add") {
      const f = foods.foodByNumber(Number(btn.dataset.nr));
      if (!f) return;
      customRows.push(newRow(f));
      el.querySelector("#c-rows").innerHTML = calcRowsHtml();
      el.querySelector("#c-results").innerHTML = "";
      const s = el.querySelector("#c-search");
      s.value = "";
      recalc();
      s.focus();
    }
    else if (act === "calc-remove") {
      customRows.splice(+btn.dataset.i, 1);
      el.querySelector("#c-rows").innerHTML = calcRowsHtml();
      recalc();
      el.querySelector("#c-search")?.focus();
    }
    else if (act === "custom-cancel") { customFor = null; customRows = []; rerender(); el.querySelector(`[data-meal="${key}"] > summary`)?.focus(); }
    else if (act === "custom-undo") { openMeals.add(key); save(meals.setCustom(week(), +day, slot, null), sel("skip")); }
    else if (act === "skip") { openMeals.add(key); addFor = null; save(meals.setSkip(week(), +day, slot, true), sel("skip-undo")); }
    else if (act === "skip-undo") { openMeals.add(key); save(meals.setSkip(week(), +day, slot, false), sel("skip")); }
    else if (act === "more-protein") { openMeals.add(key); save(meals.moreProtein(week(), +day, slot), `${sel("more-protein")}, ${sel("skip")}`); }
    else if (act === "add-open") { addFor = key; openMeals.add(key); rerender(); el.querySelector("#a-search")?.focus(); }
    else if (act === "add-close") { addFor = null; rerender(); el.querySelector(sel("add-open"))?.focus(); }
    else if (act === "add-pick") {
      const f = foods.foodByNumber(Number(btn.dataset.nr));
      if (!f) return;
      addFor = null;
      openMeals.add(key);
      const n = week().days[+day]?.meals.find((x) => x.slot === slot)?.add?.length ?? 0;
      save(meals.addFood(week(), +day, slot, f, foods.pieceGrams(f.name)), `[data-add-amt="${n}"][data-day="${day}"][data-slot="${slot}"]`);
    }
    else if (act === "add-step") {
      const ing = +btn.dataset.ing, dir = +btn.dataset.dir;
      save(meals.stepAdd(week(), +day, slot, ing, dir), `[data-act="add-step"][data-day="${day}"][data-slot="${slot}"][data-ing="${ing}"][data-dir="${dir}"]:not(:disabled)`);
    }
    else if (act === "add-remove") save(meals.setAddAmount(week(), +day, slot, +btn.dataset.ing, 0), sel("add-open"));
    else if (act === "tweak") {
      const ing = +btn.dataset.ing, dir = +btn.dataset.dir;
      save(meals.tweakIngredient(week(), +day, slot, ing, dir), `[data-act="tweak"][data-day="${day}"][data-slot="${slot}"][data-ing="${ing}"][data-dir="${dir}"]:not(:disabled)`);
    }
    else if (act === "reset") save(meals.resetMeal(week(), +day, slot), sel("skip"));
    else if (act === "extra-step") {
      openMeals.add(`${day}:extra`);
      save(meals.stepExtra(week(), +day, +btn.dataset.dir), `[data-act="extra-step"][data-day="${day}"][data-dir="${btn.dataset.dir}"]:not(:disabled)`);
    }
    else if (act === "day-done") save(meals.setDone(week(), +day, true), `[data-act="day-open"][data-day="${day}"]`);
    else if (act === "day-open") save(meals.setDone(week(), +day, false), `[data-act="day-done"][data-day="${day}"]`);
    else if (act === "menu") { menuFor = menuFor === +day ? null : +day; rerender(); el.querySelector(`[data-act="menu"][data-day="${day}"]`)?.focus(); }
    else if (act === "adjust-open") { adjustFor = +day; menuFor = null; rerender(); el.querySelector(`[data-act="adjust"][data-day="${day}"]:not(:disabled)`)?.focus(); }
    else if (act === "adjust-close") { adjustFor = null; rerender(); el.querySelector(`[data-act="menu"][data-day="${day}"]`)?.focus(); }
    else if (act === "adjust-auto") save(meals.setAdjust(week(), +day, 0, { auto: true }), `[data-act="adjust-close"][data-day="${day}"]`);
    else if (act === "adjust") {
      const k = btn.dataset.key;
      save(meals.setAdjust(week(), +day, Number(btn.dataset.kcal)), `[data-act="adjust"][data-day="${day}"][data-key="${k}"]:not(:disabled)`);
      if (!el.contains(document.activeElement)) el.querySelector(`[data-act="adjust-close"][data-day="${day}"]`)?.focus();
    }
    else if (act === "regen") { regenFor = +day; menuFor = null; rerender(); el.querySelector(`[data-act="regen-yes"][data-day="${day}"]`)?.focus(); }
    else if (act === "regen-no") { regenFor = null; rerender(); el.querySelector(`[data-act="menu"][data-day="${day}"]`)?.focus(); }
    else if (act === "regen-yes") {
      regenFor = null;
      save(meals.regenerateFrom(week(), +day, ++salt + 1), `[data-act="menu"][data-day="${day}"]`);
    }
  });

  el.addEventListener("submit", (e) => {
    const form = e.target;
    if (!form.classList?.contains("custom-form")) return;
    e.preventDefault();
    const badRow = customRows.findIndex((r) => !Number.isFinite(r.amount));
    if (badRow >= 0) { form.querySelector(`[data-amount="${badRow}"]`)?.focus(); return; }
    const raw = Object.fromEntries(new FormData(form));
    if (!String(raw.name).trim() && customRows.length) {
      const names = customRows.map((r) => { const f = foods.foodByNumber(r.nummer); return foods.isDrink(f) ? drinkName(f) : f.name.split(" ")[0]; });
      raw.name = [...new Set(names)].join(", ");
    }
    const { values, errors } = meals.validateCustom(raw);
    for (const k of ["kcal", "protein"]) {
      const err = form.querySelector(`#err-c-${k}`);
      err.hidden = !errors[k];
      err.textContent = errors[k] ?? "";
      form.querySelector(`#c-${k}`).toggleAttribute("aria-invalid", !!errors[k]);
    }
    const bad = ["kcal", "protein"].find((k) => errors[k]);
    if (bad) { form.querySelector(`#c-${bad}`).focus(); return; }
    const { day, slot } = form.dataset;
    if (customRows.length) values.rows = customRows.map((r) => ({ nummer: r.nummer, amount: r.amount, unit: r.unit, ...(Number.isFinite(r.abv) ? { abv: r.abv } : {}) }));
    customRows = [];
    mealplan.tick();
    customFor = null;
    openMeals.add(`${day}:${slot}`);
    save(meals.setCustom(week(), +day, slot, values), `[data-act="custom-undo"][data-day="${day}"][data-slot="${slot}"]`);
  });
}
