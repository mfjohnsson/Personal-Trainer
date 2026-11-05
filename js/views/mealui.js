// Shared meal UI for Idag and Kost: one day's meals as folded rows. Opening a meal shows the ingredients,
// a dish picker and "Åt något annat".
import * as meals from "../meals.js";
import * as mealplan from "../mealplan.js";
import * as foods from "../foods.js";
import { esc } from "../html.js";

const nf = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });
const amount = (i) => `${nf.format(i.amount)} ${i.unit}`;
const labelOf = (slot) => meals.SLOTS.find((s) => s.id === slot).label;

const openMeals = new Set(); // "day:slot" of opened meals, kept while the app runs
let customFor = null; // "day:slot" whose "Åt något annat" form is open

// Foods picked in the "Åt något annat" form; they fill in kcal and protein. Each row is
// { nummer, amount, unit, abv? }: a drink is `amount` glasses of `unit` cl, food is `amount` portions or grams.
let customRows = [];
let foodsState = "idle"; // idle | loading | ready | failed

const num = (s) => { const v = Number(String(s).trim().replace(",", ".")); return Number.isFinite(v) && v > 0 ? v : NaN; };
const numText = (v) => (Number.isFinite(v) ? nf.format(v).replace(/\s/g, "") : "");

// A typical portion in grams: a burger with bun is bigger than a meat portion in a dish.
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
  return `<div class="ing-list" id="c-rows">${calcRowsHtml()}</div>
    <div class="field"><label for="c-search">Räkna ut från mat (valfritt)</label>
      <input id="c-search" type="search" autocomplete="off" placeholder="Sök, t.ex. hamburgare, pommes, öl, ipa, vin">
      <div class="results" id="c-results"></div></div>
    <p class="note">Dryck anges som antal och storlek. Står det en annan alkoholhalt på din öl, ändra den så räknas kalorierna om.</p>
    <p class="calc-total" id="c-total" aria-live="polite"></p>`;
}

function customForm(d, slot) {
  return `<form class="custom-form form" data-day="${d}" data-slot="${slot}" novalidate>
    <div class="field"><label for="c-name">Vad åt du? (valfritt)</label>
      <input id="c-name" name="name" type="text" autocomplete="off" maxlength="40"></div>
    <div id="c-calc">${calcHtml()}</div>
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
    // How much of it you ate; a share locks the meal and the meals after it are re-fitted.
    const ateId = `ate-${d}-${m.slot}`;
    const ate = `<label class="pick-label" for="${ateId}">Hur mycket åt du?</label>
      <select class="pick" id="${ateId}" data-ate-day="${d}" data-ate-slot="${m.slot}">
        <option value=""${m.ate === undefined ? " selected" : ""}>Som planerat</option>
        ${meals.ATE_CHOICES.map(([v, l]) => `<option value="${v}"${m.ate === v ? " selected" : ""}>${l}</option>`).join("")}
      </select>`;
    body = `${m.ate === 0 ? `<p class="note">Du åt inget av det här.</p>`
        : `<p class="note">${info.ingredients.map((i) => esc(`${amount(i)} ${i.name.toLowerCase()}`)).join(" · ")}</p>
      <p class="note macros">Fett ${info.fat} g · Kolhydrater ${info.carbs} g</p>`}
      ${ate}
      ${picker}
      ${customFor === key ? customForm(d, m.slot)
        : `<button class="btn-secondary" type="button" data-act="custom-open" data-day="${d}" data-slot="${m.slot}">Åt något annat</button>`}`;
  }
  return `<details class="meal" data-meal="${key}"${openMeals.has(key) || customFor === key ? " open" : ""}>
    <summary><span class="meal-slot">${label}</span>
      <span class="meal-name">${esc(info.name)}${info.custom ? ` <span class="badge">Eget</span>` : ""}${m.ate !== undefined ? ` <span class="badge">${esc(meals.ATE_CHOICES.find(([v]) => v === m.ate)?.[1] ?? "Ändrad")}</span>` : ""}</span>
      <span class="meal-kcal">${info.kcal} kcal · ${info.protein} g protein</span></summary>
    <div class="meal-body">${body}</div>
  </details>`;
}

export function dayHtml(day, d, target) {
  const t = meals.dayTotals(day);
  const ok = meals.withinTarget(t, target);
  const custom = day.meals.some(meals.isLogged);
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

  // The picked foods decide kcal and protein; both fields stay editable afterwards.
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
    total.textContent = `Räknat: ${m.kcal} kcal · ${m.protein} g protein · ${m.fat} g fett · ${m.carbs} g kolhydrater`;
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

  // Enter in the search box adds the first hit; in an amount it does nothing, the form is saved with the button.
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
        // Keep the same amount of food when switching between portions and grams.
        const g = portionGrams(f);
        if (Number.isFinite(r.amount)) r.amount = sel.value === "g" ? Math.round(r.amount * g) : Math.round((r.amount / g) * 10) / 10;
        r.unit = sel.value;
        const input = el.querySelector(`[data-amount="${i}"]`);
        if (input) input.value = numText(r.amount);
      }
      recalc();
      return;
    }
    if (sel instanceof HTMLSelectElement && sel.dataset.ateSlot !== undefined) {
      const { ateDay, ateSlot } = sel.dataset;
      save(meals.setAte(week(), +ateDay, ateSlot, sel.value === "" ? null : Number(sel.value)), `#ate-${ateDay}-${ateSlot}`);
      return;
    }
    if (!(sel instanceof HTMLSelectElement) || sel.dataset.slot === undefined || sel.dataset.day === undefined) return;
    save(meals.changeDish(week(), +sel.dataset.day, sel.dataset.slot, sel.value), `#pick-${sel.dataset.day}-${sel.dataset.slot}`);
  });

  el.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const { act } = btn.dataset;
    const form = btn.closest("form.custom-form");
    const day = btn.dataset.day ?? form?.dataset.day, slot = btn.dataset.slot ?? form?.dataset.slot;
    if (act === "custom-open") {
      customFor = `${day}:${slot}`;
      customRows = [];
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
    // A picked food with no valid amount would silently count as 0 kcal.
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
    customFor = null;
    openMeals.add(`${day}:${slot}`);
    save(meals.setCustom(week(), +day, slot, values), `[data-act="custom-undo"][data-day="${day}"][data-slot="${slot}"]`);
  });
}
