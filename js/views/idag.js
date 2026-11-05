import * as plan from "../plan.js";
import * as mealplan from "../mealplan.js";
import * as checkin from "../checkin.js";
import * as t from "./training.js";
import * as mealui from "./mealui.js";

export const title = "Idag";

const openDone = new Set(); // finished passes the user opened again ("start:day")

export function mount(el) {
  const root = document.createElement("div");
  root.className = "view";
  el.append(root);

  const today = t.todayIso();
  let week = t.ensureWeek(today);
  const todayIdx = plan.dayIndex(week.start, today);
  const target = mealplan.currentTarget();
  const start = mealplan.weekStart(today);

  function passCard(p) {
    const prog = plan.passProgress(week, p);
    const key = `${week.start}:${p}`;
    const moved = p !== todayIdx ? `<p class="note">Flyttat från ${plan.DAYS[p].toLowerCase()}</p>` : "";
    const badge = `<span class="badge${prog.complete ? " ok" : ""}">${prog.complete ? "✓ Klart" : prog.done + "/" + prog.total}</span>`;
    return `<details class="card pass${prog.complete ? " is-done" : ""}" data-pass-card="${key}"${!prog.complete || openDone.has(key) ? " open" : ""}>
      <summary><span class="dot" style="background: var(--c-vikt)"></span><span class="pass-title">${week.plan[p].title}</span>${badge}</summary>
      <div class="pass-body">${moved}${t.passHtml(week, p, todayIdx)}</div>
    </details>`;
  }

  function dayFood() {
    // The week evens out: what was eaten over the target is spread over the days left.
    const autoOk = mealplan.autoAdjust(today, target);
    if (!autoOk) requestAnimationFrame(() => root.querySelector(".storage-error")?.removeAttribute("hidden"));
    const w = mealplan.weekMeals(start, target);
    return mealui.dayHtml(w.days[todayIdx], todayIdx, target, mealplan.balance(today, target));
  }

  function render() {
    const { byDay, movedTo } = plan.schedule(week, todayIdx);
    const items = byDay[todayIdx];
    const training = items.length
      ? items.map(passCard).join("")
      : `<section class="card"><h2><span class="dot" style="background: var(--c-vikt)"></span>Vilodag</h2>
          <p class="empty">${movedTo[todayIdx] !== undefined ? "Dagens pass ligger senare i veckan." : "Ingen träning planerad idag."}</p></section>`;
    const food = target
      ? `<section class="card"><h2><span class="dot" style="background: var(--c-midja)"></span>Dagens mat</h2>
          ${dayFood()}</section>`
      : `<section class="card"><h2><span class="dot" style="background: var(--c-midja)"></span>Dagens mat</h2>
          <p class="empty">Fyll i din profil så räknar appen ut dina måltider.</p>
          <a class="btn-secondary" href="#/profil">Till profilen</a></section>`;
    const reminder = target && checkin.due(today) && todayIdx === 6
      ? `<section class="card notice"><p class="empty"><strong>Söndag, dags för veckoavstämning.</strong> Väg dig och mät midjan så justeras kalorimålet.</p>
          <a class="btn-secondary" href="#/profil">Logga vikt</a></section>`
      : "";
    root.innerHTML = `${reminder}<section class="card">
        <h2><span class="dot" style="background: var(--c-midja)"></span>${plan.DAYS[todayIdx]} · dagligt minimum</h2>
        ${t.minimumHtml(today)}
      </section>${training}${food}${t.storageErrorHtml}`;
    root.querySelectorAll("details[data-pass-card]").forEach((det) => det.addEventListener("toggle", () => {
      if (!det.classList.contains("is-done")) return;
      if (det.open) openDone.add(det.dataset.passCard); else openDone.delete(det.dataset.passCard);
    }));
  }

  t.bindSets(root, {
    getWeek: () => week, setWeek: (w) => { week = w; }, rerender: render, todayIdx,
    onPassDone: (_, p) => {
      openDone.delete(`${week.start}:${p}`);
      requestAnimationFrame(() => root.querySelector(`[data-pass-card="${week.start}:${p}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    },
  });
  if (target) mealui.bindMeals(root, { start, target, rerender: render, failed: () => root.querySelector(".storage-error")?.removeAttribute("hidden") });
  render();
}
