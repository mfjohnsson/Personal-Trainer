// Shared meal UI for Idag and Kost: one day's meals as folded rows. The plan is followed unless you say
// otherwise: a meal has "Åt inte", "Mer protein" and "Mer…" (amounts per ingredient, another dish,
// "Åt något annat"). Calorie changes and a new suggestion sit behind the day's ⋯ menu.
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
let moreFor = null; // "day:slot" whose "Mer…" panel is open
let menuFor = null; // day whose ⋯ menu is open
let adjustFor = null; // day whose calorie panel is open
let regenFor = null; // day asking "Nytt förslag?"
export function closePanels() { customFor = null; moreFor = null; menuFor = null; adjustFor = null; regenFor = null; }

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

// "Mer…": each ingredient with − and +, another dish, "Åt något annat", and handing the amounts back.
function moreHtml(week, d, m, i, planOnly) {
  const attrs = `data-day="${d}" data-slot="${m.slot}"`;
  const locked = meals.isLocked(week, d, i);
  const info = meals.mealInfo(m);
  const dish = meals.dishOf(m.dish);
  // Per ingredient only with the food database (it says what each ingredient gives).
  const rows = locked || !dish.lines ? "" : info.ingredients.map((it, j) => {
    const k = Array.isArray(m.tweak) ? m.tweak[j] ?? 1 : 1;
    return `<div class="ate-row ing-tweak"><span class="pick-label">${esc(it.name)}</span>
      <button class="icon-btn" type="button" data-act="tweak" data-ing="${j}" data-dir="-1" ${attrs} aria-label="Mindre ${esc(it.name.toLowerCase())}"${k <= 0 ? " disabled" : ""}>−</button>
      <span class="ate-val">${amount(it)}</span>
      <button class="icon-btn" type="button" data-act="tweak" data-ing="${j}" data-dir="1" ${attrs} aria-label="Mer ${esc(it.name.toLowerCase())}"${k >= meals.TWEAK_MAX ? " disabled" : ""}>+</button>
    </div>`;
  }).join("");
  const other = meals.otherMain(week.days[d], m.slot);
  const offered = meals.DISHES[m.slot] ? meals.DISHES[m.slot].filter((o) => o.id !== other) : [];
  const options = offered.some((o) => o.id === m.dish) ? offered : [...offered, dish];
  const picker = !locked && options.length > 1
    ? `<label class="pick-label" for="pick-${d}-${m.slot}">Byt rätt</label>
      <select class="pick" id="pick-${d}-${m.slot}" ${attrs}>
        ${options.map((o) => `<option value="${esc(o.id)}"${o.id === m.dish ? " selected" : ""}>${esc(o.name)}</option>`).join("")}
      </select>` : "";
  return `<div class="edit-box">
    ${rows}
    ${meals.isTouched(m) && !locked ? `<button class="link-btn" type="button" data-act="reset" ${attrs}>Låt appen sätta mängderna</button>` : ""}
    ${picker}
    ${planOnly ? "" : `<button class="btn-secondary" type="button" data-act="custom-open" ${attrs}>Åt något annat</button>`}
    <p class="note macros">Fett ${info.fat} g · Kolhydrater ${info.carbs} g</p>
  </div>`;
}

// `planOnly`: a week not started yet: nothing can be skipped or eaten otherwise.
function mealHtml(week, d, m, i, planOnly) {
  const key = `${d}:${m.slot}`;
  const info = meals.mealInfo(m);
  const attrs = `data-day="${d}" data-slot="${m.slot}"`;
  const past = meals.isLocked(week, d, i) && !meals.isLogged(m);
  let body;
  if (customFor === key) body = customForm(d, m.slot, m.custom ?? null);
  else if (info.custom) {
    body = `<p class="note">Du åt något annat i stället för ${esc(meals.dishOf(m.dish)?.name.toLowerCase() ?? "det planerade")}.</p>
      <div class="meal-actions">
        <button class="btn-secondary" type="button" data-act="custom-open" ${attrs}>Ändra</button>
        <button class="btn-secondary" type="button" data-act="custom-undo" ${attrs}>Tillbaka till planen</button>
      </div>`;
  } else if (meals.isSkipped(m)) {
    body = `<p class="note">Du åt inte ${esc(meals.dishOf(m.dish)?.name.toLowerCase() ?? "det här")}. Resten av dagen tar igen proteinet.</p>
      <button class="btn-secondary" type="button" data-act="skip-undo" ${attrs}>Ångra</button>`;
  } else {
    const more = moreFor === key;
    const canMore = !past && meals.canMoreProtein(m);
    body = `<p class="note">${ingredientsText(info)}</p>
      <div class="meal-actions">
        ${planOnly ? "" : `<button class="btn-secondary" type="button" data-act="skip" ${attrs}>Åt inte</button>`}
        ${past ? "" : `<button class="btn-secondary" type="button" data-act="more-protein" ${attrs}${canMore ? "" : " disabled"}>Mer protein</button>`}
        <button class="btn-secondary" type="button" data-act="more" ${attrs} aria-expanded="${more}">${more ? "Stäng" : "Mer…"}</button>
      </div>
      ${more ? moreHtml(week, d, m, i, planOnly) : ""}`;
  }
  const badge = info.custom ? ` <span class="badge">Eget</span>`
    : meals.isSkipped(m) ? ` <span class="badge">Åt inte</span>`
    : meals.isTouched(m) ? ` <span class="badge">Ändrad</span>` : "";
  return `<details class="meal${meals.isSkipped(m) ? " skipped" : ""}${past ? " is-past" : ""}" data-meal="${key}"${openMeals.has(key) || customFor === key || moreFor === key ? " open" : ""}>
    <summary><span class="meal-slot">${meals.slotLabel(m.slot)}</span>
      <span class="meal-name">${esc(info.name)}${badge}</span>
      <span class="meal-kcal">${info.kcal} kcal · ${info.protein} g</span></summary>
    <div class="meal-body">${body}</div>
  </details>`;
}

// A protein top-up as a row like the meals.
function extraHtml(e, d, over) {
  const key = `${d}:${e.key}`;
  return `<details class="meal" data-meal="${key}"${openMeals.has(key) ? " open" : ""}>
    <summary><span class="meal-slot">Påfyllning</span><span class="meal-name">${esc(e.name)}</span>
      <span class="meal-kcal">${e.kcal} kcal · ${e.protein} g</span></summary>
    <div class="meal-body"><p class="note">${ingredientsText(e)}</p>
      <p class="note">${e.manual ? "Tillagd av dig." : "Tillagd för att nå proteinmålet."}</p>
      ${over || e.key !== "extra" ? "" : `<button class="btn-secondary" type="button" data-act="extra-off" data-day="${d}">Ta bort</button>`}</div>
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

// The day's ⋯ menu: calories, the top-up, a new suggestion.
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
  const hasExtra = !!day.extra;
  const open = menuFor === d;
  return `<div class="day-menu">
    <button class="icon-btn menu-btn" type="button" data-act="menu" data-day="${d}" aria-expanded="${open}" aria-label="Fler val för dagen">⋯</button>
    ${open ? `<div class="menu-list" role="group" aria-label="Fler val för dagen">
      <button class="btn-secondary" type="button" data-act="adjust-open" data-day="${d}">Justera kalorierna${adj ? ` (${signed(adj)})` : ""}</button>
      ${hasExtra ? "" : `<button class="btn-secondary" type="button" data-act="extra-on" data-day="${d}">Lägg till ${esc(meals.topupDish()?.name.toLowerCase() ?? "påfyllning")}</button>`}
      ${regen ? `<button class="btn-secondary" type="button" data-act="regen" data-day="${d}">Nytt förslag</button>` : ""}
    </div>` : ""}
  </div>`;
}
const regenText = (d) => ["måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"][d];

// One day's meals. `bal` (optional) is the week's balance. `planOnly`: next week, planned but not started.
// `regen`: the ⋯ menu offers a new suggestion from this day.
export function dayHtml(week, d, target, bal = null, { planOnly = false, regen = true } = {}) {
  const day = week.days[d];
  const goal = meals.dayTarget(day, target);
  const t = meals.dayTotals(day);
  const over = meals.dayOver(week, d);
  const extras = meals.extrasInfo(day);
  const short = !over && t.protein < goal.protein - meals.PROTEIN_TOLERANCE;
  return `<div class="meals">${day.meals.map((m, i) => mealHtml(week, d, m, i, planOnly)).join("")}${extras.map((e) => extraHtml(e, d, over)).join("")}</div>
    <div class="day-foot">
      <p class="note day-total">${t.kcal} av ${goal.kcal} kcal · ${t.protein} av ${goal.protein} g protein</p>
      ${over ? "" : menuHtml(week, d, target, bal, { regen })}
    </div>
    ${short ? `<p class="note warn">Proteinet ligger lågt i dag.</p>` : ""}`;
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
    if (t.id === "c-search") {
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
      moreFor = null;
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
    else if (act === "custom-undo") { openMeals.add(key); save(meals.setCustom(week(), +day, slot, null), sel("more")); }
    else if (act === "skip") { openMeals.add(key); moreFor = null; save(meals.setSkip(week(), +day, slot, true), sel("skip-undo")); }
    else if (act === "skip-undo") { openMeals.add(key); save(meals.setSkip(week(), +day, slot, false), sel("skip")); }
    else if (act === "more-protein") { openMeals.add(key); save(meals.moreProtein(week(), +day, slot), `${sel("more-protein")}:not(:disabled), ${sel("more")}`); }
    else if (act === "more") {
      moreFor = moreFor === key ? null : key;
      openMeals.add(key);
      rerender();
      el.querySelector(sel("more"))?.focus();
    }
    else if (act === "tweak") {
      const ing = +btn.dataset.ing, dir = +btn.dataset.dir;
      save(meals.tweakIngredient(week(), +day, slot, ing, dir), `[data-act="tweak"][data-day="${day}"][data-slot="${slot}"][data-ing="${ing}"][data-dir="${dir}"]:not(:disabled)`);
    }
    else if (act === "reset") save(meals.resetMeal(week(), +day, slot), sel("more"));
    else if (act === "extra-on" || act === "extra-off") {
      menuFor = null;
      save(meals.setExtra(week(), +day, act === "extra-on"), `[data-act="menu"][data-day="${day}"]`);
    }
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
