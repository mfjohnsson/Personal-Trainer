import * as plan from "../plan.js";
import * as meals from "../meals.js";
import * as mealplan from "../mealplan.js";
import { todayIso, storageErrorHtml } from "./training.js";
import * as mealui from "./mealui.js";

export const title = "Kost";

let salt = 0; // bumped per "Nytt förslag" so each press gives another suggestion

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
  const start = mealplan.weekStart(today);
  const todayIdx = plan.dayIndex(start, today);
  // Today is planned again unless you already entered something else eaten today.
  const fromDay = (week) => {
    const t = Math.min(Math.max(todayIdx, 0), 6);
    return week.days[t].meals.some(meals.isLogged) ? t + 1 : t;
  };
  const open = new Set([todayIdx]);
  let confirming = false, msg = "";

  function render() {
    // Today's calories follow what you logged yesterday (unless you changed today yourself).
    const autoOk = mealplan.autoAdjust(today, target);
    const week = mealplan.weekMeals(start, target);
    const days = week.days.map((day, d) => {
      const tot = meals.dayTotals(day);
      const ok = meals.withinTarget(tot, meals.dayTarget(day, target));
      const adj = meals.adjustOf(day);
      return `<details class="card day" data-day="${d}"${open.has(d) ? " open" : ""}>
        <summary><span class="day-name">${plan.DAYS[d]}${d === todayIdx ? ` <span class="today">idag</span>` : ""}</span>
          <span class="day-pass">${tot.kcal} kcal · ${tot.protein} g</span>
          ${adj ? `<span class="badge">${adj > 0 ? "+" : "−"}${Math.abs(adj)} kcal</span>` : ""}
          ${ok ? "" : `<span class="badge warn">Avviker</span>`}</summary>
        ${mealui.dayHtml(day, d, target, mealplan.dayBefore(start, d, week))}
      </details>`;
    }).join("");
    const from = fromDay(week);
    const regen = from > 6 ? ""
      : confirming
      ? `<p class="note">Ersätter måltiderna från ${plan.DAYS[from].toLowerCase()} till söndag, även dina byten. Det du har skrivit in under "Åt något annat" behålls. Fortsätta?</p>
         <div class="btn-row">
           <button class="btn-secondary" type="button" data-act="regen-no">Avbryt</button>
           <button class="btn-primary" type="button" data-act="regen-yes">Ja, nytt förslag</button>
         </div>`
      : `<button class="btn-secondary wide" type="button" data-act="regen">Nytt förslag för resten av veckan</button>`;
    root.innerHTML = `<section class="card">
        <h2><span class="dot" style="background: var(--c-midja)"></span>Veckans kost</h2>
        <div class="tiles">
          <div class="tile"><div class="label">Kalorimål</div><div class="value">${target.kcal}<span class="unit"> kcal</span></div></div>
          <div class="tile"><div class="label">Protein</div><div class="value">${target.protein}<span class="unit"> g</span></div></div>
        </div>
        <p class="note">Portionerna anpassas så att varje dag når målet. Tryck på en måltid för att byta den.</p>
        <div class="btn-row">
          <a class="btn-secondary" href="#/handla">Inköpslista</a>
          <a class="btn-secondary" href="#/ratter">Rätter</a>
        </div>
        <div class="regen">${regen}</div>
        <p class="note" role="status" aria-live="polite">${msg}</p>
        ${storageErrorHtml.replace(" hidden", autoOk ? " hidden" : "")}
      </section>${days}`;
  }

  root.addEventListener("toggle", (e) => {
    const det = e.target;
    if (!det.classList?.contains("day")) return;
    if (det.open) open.add(+det.dataset.day); else open.delete(+det.dataset.day);
  }, true);

  root.addEventListener("click", (e) => {
    const act = e.target.closest("button[data-act]")?.dataset.act;
    if (act === "regen") { confirming = true; msg = ""; render(); root.querySelector(`[data-act="regen-yes"]`)?.focus(); }
    else if (act === "regen-no") { confirming = false; render(); root.querySelector(`[data-act="regen"]`)?.focus(); }
    else if (act === "regen-yes") {
      const week = mealplan.weekMeals(start, target);
      const next = meals.regenerateFrom(week, fromDay(week), ++salt, mealplan.lastSnackBefore(start));
      confirming = false;
      msg = mealplan.saveWeek(next) ? "Klart, nytt förslag." : "Kunde inte spara. Lagringen är full eller blockerad.";
      render();
      root.querySelector(`[data-act="regen"]`)?.focus();
    }
  });

  mealui.bindMeals(root, { start, target, rerender: render, failed: () => root.querySelector(".storage-error")?.removeAttribute("hidden") });
  render();
}
