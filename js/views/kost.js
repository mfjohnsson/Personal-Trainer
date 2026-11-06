import * as plan from "../plan.js";
import * as meals from "../meals.js";
import * as mealplan from "../mealplan.js";
import { todayIso, storageErrorHtml } from "./training.js";
import * as mealui from "./mealui.js";
import { esc } from "../html.js";
import { amountText } from "./handla.js";

export const title = "Kost";

const nf = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" });

let salt = 0; // bumped per "Nytt förslag" so each press gives another suggestion

// "9–15 nov." or "30 nov.–6 dec."
function rangeText(start) {
  const a = plan.parseIso(start), b = plan.parseIso(start);
  b.setDate(b.getDate() + 6);
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${dateFmt.format(b)}` : `${dateFmt.format(a)}–${dateFmt.format(b)}`;
}

// What went wrong on a day, short enough for a badge.
const missText = (r) => (!r.kcalOk && !r.proteinOk ? "För mycket, lite protein" : !r.kcalOk ? "För mycket" : "Lite protein");
const mark = (ok) => `<span class="${ok ? "res-ok" : "res-miss"}" aria-hidden="true">${ok ? "✓" : "✕"}</span>`;

// The week strip: one chip per day. Done days show how they went, today is outlined, later days are plain.
function chipsHtml(res, todayIdx) {
  return `<div class="chips day-chips">${res.days.map((r, d) => {
    const isToday = d === todayIdx;
    const state = r.done ? (r.ok ? "ok" : "miss") : isToday ? "today" : "later";
    const sym = r.done ? (r.ok ? "✓" : "✕") : isToday ? "Idag" : "·";
    const said = r.done ? (r.ok ? "klarad" : `inte klarad, ${missText(r).toLowerCase()}`) : isToday ? "idag" : "kommande";
    return `<button type="button" class="chip st-${state}${isToday ? " is-today" : ""}" data-act="goto" data-day="${d}"
      aria-label="${plan.DAYS[d]}, ${said}"><span class="chip-day">${plan.SHORT_DAYS[d]}</span><span class="chip-sym" aria-hidden="true">${sym}</span></button>`;
  }).join("")}</div>`;
}

// The week's verdict: calories against the weekly budget and the average protein. Before Sunday is done it
// is a forecast that assumes the rest of the plan is followed.
function resultHtml(res, target, last) {
  const head = res.over
    ? `<p class="verdict ${res.ok ? "ok" : "miss"}">${res.ok ? "✓ Veckan klarad" : "✕ Veckan inte klarad"}</p>`
    : `<p class="verdict-label">${res.ok ? "Följer du planen resten av veckan klarar du den" : "Veckan klaras inte ens om du följer planen resten av veckan"}</p>`;
  const lastHtml = last ? `<p class="note">Förra veckan: ${last.ok ? "klarad ✓" : `inte klarad (${[!last.kcalOk && "kalorierna", !last.proteinOk && "proteinet"].filter(Boolean).join(" och ")})`}</p>` : "";
  return `<div class="week-result${res.over ? (res.ok ? " is-ok" : " is-miss") : ""}">
    ${head}
    <div class="res-row">${mark(res.kcalOk)}<span>Kalorier</span><span class="res-val">${nf.format(res.kcal)} av ${nf.format(res.budget)} kcal</span></div>
    <div class="res-row">${mark(res.proteinOk)}<span>Protein, snitt per dag</span><span class="res-val">${res.protein} av ${target.protein} g</span></div>
    <p class="note">Proteinmålet nås ${res.proteinDays} av 7 dagar. ${res.over ? "" : "Dagar du inte har markerat räknas som planerat."}</p>
  </div>${lastHtml}`;
}

// What to cook for next week: each dish once with how often and when, the ingredients summed behind it.
function prepHtml(week) {
  const groups = meals.prepList(week, 0);
  if (!groups.length) return "";
  const days = (ds) => ds.map((d) => plan.SHORT_DAYS[d].toLowerCase()).join(", ");
  return `<section class="card">
    <h2><span class="dot" style="background: var(--c-midja)"></span>Att förbereda</h2>
    <p class="note">Rätterna för hela veckan. Tryck på en rätt för att se allt som går åt till den, samlat.</p>
    ${groups.map((g) => `<h3 class="prep-head">${g.label}</h3>
      ${g.dishes.map((x) => `<details class="prep">
        <summary><span class="prep-name">${esc(x.name)}</span><span class="prep-count">${x.count} st</span>
          <span class="prep-days">${days(x.days)}</span></summary>
        <p class="note">${x.ingredients.map((i) => esc(`${amountText(i)} ${i.name.toLowerCase()}`)).join(" · ")}</p>
      </details>`).join("")}`).join("")}
  </section>`;
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
  // Today is planned again unless you already entered something else eaten today. Next week: from Monday.
  const fromDay = (week) => {
    if (isNext()) return 0;
    const t = Math.min(Math.max(todayIdx, 0), 6);
    return week.days[t].meals.some(meals.isLogged) ? t + 1 : t;
  };
  const openThis = new Set([todayIdx]), openNext = new Set();
  const openOf = () => (isNext() ? openNext : openThis);
  let confirming = false, msg = "";

  function regenHtml(week) {
    const from = fromDay(week);
    if (from > 6) return "";
    if (!confirming) return `<button class="btn-secondary wide" type="button" data-act="regen">${isNext() ? "Nytt förslag för nästa vecka" : "Nytt förslag för resten av veckan"}</button>`;
    const what = isNext() ? "Ersätter nästa veckas måltider, även dina byten. Dagar där du har satt en egen mängd behålls."
      : `Ersätter måltiderna från ${plan.DAYS[from].toLowerCase()} till söndag, även dina byten. Det du har skrivit in under "Åt något annat" behålls.`;
    return `<p class="note">${what} Fortsätta?</p>
      <div class="btn-row">
        <button class="btn-secondary" type="button" data-act="regen-no">Avbryt</button>
        <button class="btn-primary" type="button" data-act="regen-yes">Ja, nytt förslag</button>
      </div>`;
  }

  const segHtml = () => `<div class="seg week-seg" role="group" aria-label="Vilken vecka">
      <button type="button" data-act="week" data-next="0" aria-pressed="${!isNext()}">Den här veckan</button>
      <button type="button" data-act="week" data-next="1" aria-pressed="${isNext()}">Nästa vecka</button>
    </div>`;

  const linksHtml = `<div class="btn-row">
      <a class="btn-secondary" href="#/handla">Inköpslista</a>
      <a class="btn-secondary" href="#/ratter">Rätter</a>
    </div>`;

  function thisWeekHtml(autoOk) {
    const week = mealplan.weekMeals(thisStart, target);
    const bal = meals.balanceOf(week, todayIdx);
    const res = meals.weekResult(week, todayIdx);
    const days = week.days.map((day, d) => {
      const r = res.days[d];
      const adj = meals.adjustOf(day);
      const isToday = d === todayIdx;
      // Done days say how they went; days ahead only flag a plan that misses its target.
      const status = r.done ? (r.ok ? `<span class="badge ok">✓ Klarad</span>` : `<span class="badge warn">✕ ${missText(r)}</span>`)
        : meals.withinTarget(meals.dayTotals(day), meals.dayTarget(day, target)) ? "" : `<span class="badge warn">Avviker</span>`;
      return `<details class="card day${isToday ? " is-today" : ""}${r.done && !isToday ? " is-past" : ""}" data-day="${d}"${openThis.has(d) ? " open" : ""}>
        <summary><span class="day-name">${plan.DAYS[d]}${isToday ? ` <span class="today">idag</span>` : ""}</span>
          <span class="day-pass">${r.kcal} kcal · ${r.protein} g</span>
          ${adj ? `<span class="badge">${adj > 0 ? "+" : "−"}${Math.abs(adj)} kcal</span>` : ""}
          ${status}</summary>
        ${mealui.dayHtml(day, d, target, bal)}
      </details>`;
    }).join("");
    const planHint = todayIdx >= 5 && todayIdx <= 6
      ? `<button class="link-btn" type="button" data-act="week" data-next="1">Planera nästa vecka och se vad du ska förbereda</button>` : "";
    return `<section class="card">
        <h2><span class="dot" style="background: var(--c-midja)"></span>Veckans kost</h2>
        ${segHtml()}
        ${chipsHtml(res, todayIdx)}
        ${resultHtml(res, target, mealplan.lastWeekResult(thisStart))}
        <div class="tiles">
          <div class="tile"><div class="label">Kalorimål per dag</div><div class="value">${target.kcal}<span class="unit"> kcal</span></div></div>
          <div class="tile"><div class="label">Protein per dag</div><div class="value">${target.protein}<span class="unit"> g</span></div></div>
        </div>
        <p class="note">${bal?.take || bal?.unpaid ? `Veckan ligger ${nf.format(bal.over)} kcal över. ${bal.take ? `Resten av veckan dras ner ${nf.format(-bal.take)} kcal per dag, proteinet ligger kvar.` : ""}${bal.unpaid ? ` ${nf.format(bal.unpaid)} kcal hinns inte ta igen den här veckan.` : ""}`
          : "Veckans kalorier jämnas ut: äter du mer en dag dras det av på resten av veckan. Tryck på en måltid för att markera den, ändra mängd eller byta."}</p>
        ${planHint}
        ${linksHtml}
        <div class="regen">${regenHtml(week)}</div>
        <p class="note" role="status" aria-live="polite">${msg}</p>
        ${storageErrorHtml.replace(" hidden", autoOk ? " hidden" : "")}
      </section>${days}`;
  }

  function nextWeekHtml(autoOk) {
    const week = mealplan.weekMeals(nextStart, target);
    const days = week.days.map((day, d) => {
      const tot = meals.dayTotals(day);
      const adj = meals.adjustOf(day);
      const ok = meals.withinTarget(tot, meals.dayTarget(day, target));
      return `<details class="card day" data-day="${d}"${openNext.has(d) ? " open" : ""}>
        <summary><span class="day-name">${plan.DAYS[d]}</span>
          <span class="day-pass">${tot.kcal} kcal · ${tot.protein} g</span>
          ${adj ? `<span class="badge">${adj > 0 ? "+" : "−"}${Math.abs(adj)} kcal</span>` : ""}
          ${ok ? "" : `<span class="badge warn">Avviker</span>`}</summary>
        ${mealui.dayHtml(day, d, target, null, { planOnly: true })}
      </details>`;
    }).join("");
    return `<section class="card">
        <h2><span class="dot" style="background: var(--c-midja)"></span>Nästa vecka <span class="count">${rangeText(nextStart)}</span></h2>
        ${segHtml()}
        <p class="note">Planera i förväg: byt rätter och ändra mängder här, så gäller det när veckan börjar. Vet du redan att en dag blir större eller mindre, justera den. Väger du dig innan dess räknas mängderna om men rätterna ligger kvar.</p>
        ${linksHtml}
        <div class="regen">${regenHtml(week)}</div>
        <p class="note" role="status" aria-live="polite">${msg}</p>
        ${storageErrorHtml.replace(" hidden", autoOk ? " hidden" : "")}
      </section>${prepHtml(week)}${days}`;
  }

  function render() {
    // The week evens out: what was eaten over the target is spread over the days left.
    const autoOk = mealplan.autoAdjust(today, target);
    root.innerHTML = isNext() ? nextWeekHtml(autoOk) : thisWeekHtml(autoOk);
  }

  root.addEventListener("toggle", (e) => {
    const det = e.target;
    if (!det.classList?.contains("day")) return;
    if (det.open) openOf().add(+det.dataset.day); else openOf().delete(+det.dataset.day);
  }, true);

  root.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    const act = btn?.dataset.act;
    if (act === "week") {
      const next = btn.dataset.next === "1";
      if (next === isNext() && !btn.classList.contains("link-btn")) return;
      mealui.weekView.next = next;
      mealui.closePanels();
      confirming = false; msg = "";
      render();
      root.querySelector(`.week-seg [data-next="${next ? 1 : 0}"]`)?.focus();
      window.scrollTo(0, 0);
    }
    else if (act === "goto") {
      const d = +btn.dataset.day;
      openOf().add(d);
      const det = root.querySelector(`details.day[data-day="${d}"]`);
      if (det) { det.open = true; det.scrollIntoView({ block: "start", behavior: "smooth" }); det.querySelector("summary")?.focus({ preventScroll: true }); }
    }
    else if (act === "regen") { confirming = true; msg = ""; render(); root.querySelector(`[data-act="regen-yes"]`)?.focus(); }
    else if (act === "regen-no") { confirming = false; render(); root.querySelector(`[data-act="regen"]`)?.focus(); }
    else if (act === "regen-yes") {
      const start = startOf();
      const week = mealplan.weekMeals(start, target);
      const next = meals.regenerateFrom(week, fromDay(week), ++salt, mealplan.lastSnackBefore(start));
      confirming = false;
      msg = mealplan.saveWeek(next) ? "Klart, nytt förslag." : "Kunde inte spara. Lagringen är full eller blockerad.";
      render();
      root.querySelector(`[data-act="regen"]`)?.focus();
    }
  });

  mealui.bindMeals(root, { start: startOf, target, rerender: render, failed: () => root.querySelector(".storage-error")?.removeAttribute("hidden") });
  render();
}
