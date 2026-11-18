// Kost: today first, tomorrow folded, the week as a strip with one status line. Next week: the plan and
// what to cook.
import * as plan from "../plan.js";
import * as meals from "../meals.js";
import * as dishes from "../dishes.js";
import * as mealplan from "../mealplan.js";
import { todayIso, storageErrorHtml } from "./training.js";
import * as mealui from "./mealui.js";
import { esc } from "../html.js";
import { amountText } from "./handla.js";

export const title = "Kost";

const nf = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" });


// "9–15 nov." or "30 nov.–6 dec."
function rangeText(start) {
  const a = plan.parseIso(start), b = plan.parseIso(start);
  b.setDate(b.getDate() + 6);
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${dateFmt.format(b)}` : `${dateFmt.format(a)}–${dateFmt.format(b)}`;
}

const missText = (r) => (!r.kcalOk && !r.proteinOk ? "för mycket, lite protein" : !r.kcalOk ? "för mycket" : "lite protein");

// The week strip: one chip per day. Done days show how they went, today is outlined.
function chipsHtml(res, todayIdx, shown) {
  return `<div class="chips day-chips">${res.days.map((r, d) => {
    const isToday = d === todayIdx;
    const state = r?.done ? (r.ok ? "ok" : "miss") : isToday ? "today" : "later";
    const sym = r?.done ? (r.ok ? "✓" : "✕") : isToday ? "Idag" : "·";
    const said = r?.done ? (r.ok ? "klarad" : `inte klarad, ${missText(r)}`) : isToday ? "idag" : "kommande";
    return `<button type="button" class="chip st-${state}${isToday ? " is-today" : ""}" data-act="goto" data-day="${d}" aria-pressed="${d === shown}"
      aria-label="${plan.DAYS[d]}, ${said}"><span class="chip-day">${plan.SHORT_DAYS[d]}</span><span class="chip-sym" aria-hidden="true">${sym}</span></button>`;
  }).join("")}</div>`;
}

// One line on how the week is going, the numbers behind it folded.
function statusHtml(res, bal, target, last) {
  const line = bal?.take
    ? `Veckan ligger ${nf.format(bal.over)} kcal över. Resten av veckan dras ner ${nf.format(-bal.take)} kcal per dag.`
    : res.over ? (res.ok ? "✓ Veckan klarad." : "✕ Veckan inte klarad.")
      : res.ok ? "Följer du planen klarar du veckan." : "Veckan klaras inte ens om du följer planen resten av veckan.";
  const mark = (ok) => `<span class="${ok ? "res-ok" : "res-miss"}" aria-hidden="true">${ok ? "✓" : "✕"}</span>`;
  return `<p class="status-line">${line}</p>
    <details class="more"><summary>Veckans siffror</summary>
      <div class="week-result">
        <div class="res-row">${mark(res.kcalOk)}<span>Kalorier</span><span class="res-val">${nf.format(res.kcal)} av ${nf.format(res.budget)} kcal</span></div>
        <div class="res-row">${mark(res.proteinOk)}<span>Protein, snitt per dag</span><span class="res-val">${res.protein} av ${target.protein} g</span></div>
        <p class="note">Mål per dag ${target.kcal} kcal och ${target.protein} g protein. Proteinmålet nås ${res.proteinDays} av 7 dagar.${bal?.unpaid ? ` ${nf.format(bal.unpaid)} kcal hinns inte ta igen den här veckan.` : ""}</p>
      </div>
      ${last ? `<p class="note">Förra veckan: ${last.ok ? "klarad ✓" : `inte klarad (${[!last.kcalOk && "kalorierna", !last.proteinOk && "proteinet"].filter(Boolean).join(" och ")})`}</p>` : ""}
    </details>`;
}

// What to cook: the week's lunch and dinner dishes one row each, breakfast and top-ups in one row.
function prepHtml(week, from) {
  const groups = meals.prepList(week, from);
  if (!groups.length) return "";
  const days = (ds) => ds.map((d) => plan.SHORT_DAYS[d].toLowerCase()).join(", ");
  const ing = (x) => x.ingredients.map((i) => esc(`${amountText(i)} ${i.name.toLowerCase()}`)).join(" · ");
  const row = (x) => `<details class="prep">
      <summary><span class="prep-name">${esc(x.name)}</span><span class="prep-count">${x.count} st</span>
        <span class="prep-days">${days(x.days)}</span></summary>
      <p class="note">${ing(x)}</p>
    </details>`;
  const mains = groups.find((g) => g.id === "lador");
  const rest = groups.filter((g) => g.id !== "lador").flatMap((g) => g.dishes);
  return `<section class="card">
    <h2><span class="dot" style="background: var(--c-midja)"></span>Att förbereda</h2>
    ${mains ? mains.dishes.map(row).join("") : ""}
    ${rest.length ? `<details class="prep">
      <summary><span class="prep-name">Frukost och påfyllning</span><span class="prep-count">${rest.reduce((a, x) => a + x.count, 0)} st</span>
        <span class="prep-days">${rest.length} sorter</span></summary>
      ${rest.map((x) => `<p class="note"><strong>${esc(x.name)}</strong> (${x.count} st): ${ing(x)}</p>`).join("")}
    </details>` : ""}
  </section>`;
}

const dishNameOrder = new Intl.Collator("sv");

const isMainSlot = (slot) => slot === "lunch" || slot === "middag";

function dishGroups(options) {
  const groups = new Map();
  for (const dish of options) {
    const [category] = dishes.categoriesOf(dish);
    const subtype = category.id === "kott" && !dishes.categoryChoice(dish.id)
      ? meals.meatSubtype(dish.name) ?? dish.ingredients.map(([name]) => meals.meatSubtype(name)).find(Boolean)
      : null;
    const label = subtype ?? category.label;
    const group = groups.get(label) ?? [];
    group.push(dish);
    groups.set(label, group);
  }

  return [...groups].sort(([a], [b]) => dishNameOrder.compare(a, b)).map(([label, group]) =>
    [label, group.sort((a, b) => dishNameOrder.compare(a.name, b.name))]
  );
}

function offeredDishes(day, meal) {
  const other = meals.otherMain(day, meal.slot);
  const offered = meals.DISHES[meal.slot].filter((dish) => dish.id !== other);
  const current = meals.dishOf(meal.dish);
  return current && !offered.some((dish) => dish.id === current.id) ? [...offered, current] : offered;
}

function openDishPicker(day, meal, dayLabel, save) {
  const groups = dishGroups(offeredDishes(day, meal));
  const slot = meals.slotLabel(meal.slot);
  const dialog = document.createElement("dialog");
  dialog.className = "food-dialog dish-picker";
  dialog.setAttribute("aria-label", `Välj rätt för ${slot.toLowerCase()} på ${dayLabel.toLowerCase()}`);
  dialog.innerHTML = `<header class="dish-picker-header">
    <div><p class="note">${dayLabel} · ${slot}</p><h2>Välj rätt</h2></div>
    <button type="button" class="btn-secondary" data-close>Stäng</button>
  </header>
  <label class="field">Sök rätt<input type="search" placeholder="Sök på namn"></label>
  <div class="dish-filters" role="group" aria-label="Kategorier">
    <button type="button" data-group="-1" aria-pressed="true">Alla</button>
    ${groups.map(([label], i) => `<button type="button" data-group="${i}" aria-pressed="false">${esc(label)}</button>`).join("")}
  </div>
  <p class="field-error" role="alert" hidden></p>
  <div class="dish-picker-results"></div>`;

  const search = dialog.querySelector("input");
  const results = dialog.querySelector(".dish-picker-results");
  const error = dialog.querySelector("[role=alert]");
  let active = -1;
  let afterClose;
  function renderResults() {
    const query = search.value.trim().toLocaleLowerCase("sv");
    results.innerHTML = groups.map(([label, group], i) => {
      if (active !== -1 && active !== i) return "";
      const matches = group.filter((dish) => dish.name.toLocaleLowerCase("sv").includes(query));
      if (!matches.length) return "";
      return `<section><h3>${esc(label)}</h3>${matches.map((dish) => `
        <button type="button" class="dish-choice" data-dish="${esc(dish.id)}"${dish.id === meal.dish ? ' aria-current="true"' : ""}>
          <span>${esc(dish.name)}</span>${dish.id === meal.dish ? '<span class="dish-choice-state">✓ Vald</span>' : ""}
        </button>`).join("")}</section>`;
    }).join("") || '<p class="note">Inga rätter matchar sökningen.</p>';
    results.scrollTop = 0;
  }

  search.addEventListener("input", renderResults);
  dialog.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-close")) return dialog.close();
    if (button.dataset.group !== undefined) {
      dialog.querySelector('[aria-pressed="true"]').setAttribute("aria-pressed", "false");
      button.setAttribute("aria-pressed", "true");
      active = Number(button.dataset.group);
      renderResults();
    }
    if (button.dataset.dish === undefined) return;
    if (button.dataset.dish === meal.dish) return dialog.close();
    afterClose = save(button.dataset.dish);
    if (afterClose) return dialog.close();
    error.textContent = "Kunde inte byta rätt. Försök igen.";
    error.hidden = false;
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    afterClose?.();
  }, { once: true });
  renderResults();
  document.body.append(dialog);
  dialog.showModal();
}

// "Planera veckan": every day of the week with its meals and its top-up as pickers. Meals you skipped or
// ate otherwise, and days that are over, as text.
function planWeekHtml(week, from) {
  return week.days.map((day, d) => {
    if (d < from) return "";
    const t = meals.dayTotals(day);
    const rows = day.meals.map((m) => {
      const info = meals.mealInfo(m);
      const label = `<span class="pick-label">${meals.slotLabel(m.slot)}</span>`;
      if (meals.dayOver(week, d) || info.custom || meals.isSkipped(m) || !meals.DISHES[m.slot]) {
        return `<div class="plan-row">${label}<span class="plan-fixed">${esc(info.name)}${meals.isSkipped(m) ? " (åt inte)" : ""}</span></div>`;
      }
      if (isMainSlot(m.slot)) {
        return `<div class="plan-row">${label}
          <button type="button" class="plan-dish-button" id="pick-${d}-${m.slot}" data-act="pick-dish" data-day="${d}" data-slot="${m.slot}"
            aria-label="${meals.slotLabel(m.slot)} ${plan.DAYS[d].toLowerCase()}: ${esc(info.name)}. Byt rätt" aria-haspopup="dialog">
            <span>${esc(info.name)}</span><span class="plan-dish-action" aria-hidden="true">Byt ›</span>
          </button></div>`;
      }
      const options = offeredDishes(day, m);
      return `<div class="plan-row"><label class="pick-label" for="pick-${d}-${m.slot}">${meals.slotLabel(m.slot)}</label>
        <select class="pick" id="pick-${d}-${m.slot}" data-day="${d}" data-slot="${m.slot}">
          ${options.map((dish) => `<option value="${esc(dish.id)}"${dish.id === m.dish ? " selected" : ""}>${esc(dish.name)}</option>`).join("")}
        </select></div>`;
    }).join("");
    const info = meals.extrasInfo(day);
    // The second one as a picker once it is yours; the app's own second suggestion shows in the first picker.
    const second = !info[1] ? ""
      : `<div class="plan-row"><label class="pick-label" for="extra-${d}-1">Påfyllning 2</label>${mealui.extraSelectHtml(week, d, `extra-${d}-1`, 1)}</div>`;
    const extras = `<div class="plan-row"><label class="pick-label" for="extra-${d}">Påfyllning</label>
        ${mealui.extraSelectHtml(week, d)}</div>${second}`;
    return `<section class="card plan-day">
      <h3>${plan.DAYS[d]}<span class="day-pass">${t.kcal} kcal · ${t.protein} g</span></h3>
      ${rows}${extras}
    </section>`;
  }).join("");
}

export function mount(el) {
  const target = mealplan.currentTarget();
  if (!target) {
    el.innerHTML = `
      <section class="card">
        <h2><span class="dot" style="background: var(--c-midja)"></span>Kost</h2>
        <p class="empty">Inget kostschema än.</p>
        <p class="empty">Fyll i din profil så räknar appen ut veckans måltider.</p>
        <a class="btn-secondary" href="#/profil">Till profilen</a>
      </section>`;
    return;
  }

  const root = document.createElement("div");
  root.className = "view";
  el.append(root);

  const today = todayIso();
  const thisStart = mealplan.weekStart(today);
  const nextStart = mealplan.nextWeekStart(thisStart);
  const todayIdx = plan.dayIndex(thisStart, today);
  const isNext = () => mealui.weekView.next;
  const startOf = () => (isNext() ? nextStart : thisStart);
  const focus = { this: null, next: 0 }; // the day shown first, per week (null = today)
  const tomorrowOpen = new Set(); // which "tomorrow" cards are unfolded, kept while the view lives
  let planning = false; // "Planera veckan": all days with dish pickers

  const segHtml = () => `<div class="seg week-seg" role="group" aria-label="Vilken vecka">
      <button type="button" data-act="week" data-next="0" aria-pressed="${!isNext()}">Den här veckan</button>
      <button type="button" data-act="week" data-next="1" aria-pressed="${isNext()}">Nästa vecka</button>
    </div>`;
  const linksHtml = `<button class="btn-secondary plan-btn" type="button" data-act="plan">Planera veckan</button>
    <div class="btn-row">
      <a class="btn-secondary" href="#/handla">Inköpslista</a>
      <a class="btn-secondary" href="#/ratter">Rätter</a>
    </div>`;

  function planHtml() {
    const week = mealplan.weekMeals(startOf(), target);
    const from = isNext() ? 0 : todayIdx;
    return `<section class="card">
        <h2><span class="dot" style="background: var(--c-midja)"></span>Planera ${isNext() ? "nästa vecka" : "veckan"} <span class="count">${rangeText(startOf())}</span></h2>
        <button class="btn-primary" type="button" data-act="plan-done">Klar</button>
      </section>${planWeekHtml(week, from)}
      <button class="btn-primary plan-done-end" type="button" data-act="plan-done">Klar</button>`;
  }

  // A day card. `open`: shown unfolded (the day in focus); otherwise folded with its totals in the summary.
  function dayCard(week, d, { open, isToday = false, label = "", planOnly = false, bal = null, regen = true }) {
    const t = meals.dayTotals(week.days[d]);
    const adj = meals.adjustOf(week.days[d]);
    const body = mealui.dayHtml(week, d, target, bal, { planOnly, regen, canFinish: isToday });
    return `<details class="card day${isToday ? " is-today" : ""}" data-day="${d}"${open || tomorrowOpen.has(d) ? " open" : ""}>
      <summary><span class="day-name">${plan.DAYS[d]}${label ? ` <span class="today">${label}</span>` : ""}</span>
        <span class="day-pass">${t.kcal} kcal · ${t.protein} g</span>
        ${adj ? `<span class="badge">${adj > 0 ? "+" : "−"}${Math.abs(adj)} kcal</span>` : ""}
        ${meals.isDone(week.days[d]) ? `<span class="badge ok">✓ Klar</span>` : ""}</summary>
      ${body}
    </details>`;
  }

  function thisWeekHtml(autoOk) {
    const week = mealplan.weekMeals(thisStart, target);
    const bal = meals.balanceOf(week, todayIdx);
    const res = meals.weekResult(week, todayIdx);
    const shown = focus.this ?? todayIdx;
    const cards = [dayCard(week, shown, { open: true, isToday: shown === todayIdx, label: shown === todayIdx ? "idag" : "", bal, regen: shown >= todayIdx })];
    if (shown === todayIdx && todayIdx < 6) cards.push(dayCard(week, todayIdx + 1, { open: false, label: "imorgon", bal }));
    const planHint = todayIdx >= 5
      ? `<button class="link-btn" type="button" data-act="week" data-next="1">Planera nästa vecka och se vad du ska förbereda</button>` : "";
    return `<section class="card">
        <h2><span class="dot" style="background: var(--c-midja)"></span>Veckans kost</h2>
        ${segHtml()}
        ${chipsHtml(res, todayIdx, shown)}
        ${statusHtml(res, bal, target, mealplan.lastWeekResult(thisStart))}
        ${planHint}
        ${linksHtml}
        ${storageErrorHtml.replace(" hidden", autoOk ? " hidden" : "")}
      </section>${cards.join("")}`;
  }

  function nextWeekHtml(autoOk) {
    const week = mealplan.weekMeals(nextStart, target);
    const shown = focus.next;
    const res = { days: week.days.map(() => null) };
    return `<section class="card">
        <h2><span class="dot" style="background: var(--c-midja)"></span>Nästa vecka <span class="count">${rangeText(nextStart)}</span></h2>
        ${segHtml()}
        ${chipsHtml(res, -1, shown)}
        <p class="status-line">Byt rätter och ändra mängder här, så gäller det när veckan börjar.</p>
        ${linksHtml}
        ${storageErrorHtml.replace(" hidden", autoOk ? " hidden" : "")}
      </section>${dayCard(week, shown, { open: true, planOnly: true })}${prepHtml(week, 0)}`;
  }

  function render() {
    const autoOk = mealplan.autoAdjust(today, target);
    root.innerHTML = planning ? planHtml() : isNext() ? nextWeekHtml(autoOk) : thisWeekHtml(autoOk);
  }

  root.addEventListener("toggle", (e) => {
    const det = e.target;
    if (!det.classList?.contains("day")) return;
    const d = +det.dataset.day;
    const isFocus = d === (isNext() ? focus.next : focus.this ?? todayIdx);
    if (isFocus) return;
    if (det.open) tomorrowOpen.add(d); else tomorrowOpen.delete(d);
  }, true);

  root.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    const act = btn?.dataset.act;
    if (act === "week") {
      const next = btn.dataset.next === "1";
      if (next === isNext() && !btn.classList.contains("link-btn")) return;
      mealui.weekView.next = next;
      mealui.closePanels();
      render();
      root.querySelector(`.week-seg [data-next="${next ? 1 : 0}"]`)?.focus();
      window.scrollTo(0, 0);
    } else if (act === "goto") {
      const d = +btn.dataset.day;
      if (isNext()) focus.next = d; else focus.this = d === todayIdx ? null : d;
      mealui.closePanels();
      render();
      root.querySelector(`[data-act="goto"][data-day="${d}"]`)?.focus({ preventScroll: true });
    } else if (act === "pick-dish") {
      const d = Number(btn.dataset.day), slot = btn.dataset.slot;
      const start = startOf();
      const day = mealplan.weekMeals(start, target).days[d];
      const meal = day.meals.find((item) => item.slot === slot);
      openDishPicker(day, meal, plan.DAYS[d], (id) => {
        mealplan.tick();
        const changed = meals.changeDish(mealplan.weekMeals(start, target), d, slot, id);
        if (!changed || !mealplan.saveWeek(changed)) return null;
        return () => {
          render();
          root.querySelector(`#pick-${d}-${slot}`)?.focus({ preventScroll: true });
        };
      });
    } else if (act === "plan" || act === "plan-done") {
      planning = act === "plan";
      mealui.closePanels();
      render();
      window.scrollTo(0, 0);
      root.querySelector(planning ? '[data-act="plan-done"]' : '[data-act="plan"]')?.focus({ preventScroll: true });
    }
  });

  mealui.bindMeals(root, { start: startOf, target, rerender: render, failed: () => root.querySelector(".storage-error")?.removeAttribute("hidden") });
  render();
}
