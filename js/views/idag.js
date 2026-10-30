import * as plan from "../plan.js";
import * as t from "./training.js";

export const title = "Idag";

export function mount(el) {
  const root = document.createElement("div");
  root.className = "view";
  el.append(root);

  const today = t.todayIso();
  let week = t.ensureWeek(today);
  const todayIdx = plan.dayIndex(week.start, today);

  function render() {
    const { byDay, movedTo } = plan.schedule(week, todayIdx);
    const items = byDay[todayIdx];
    const body = items.length
      ? items.map((p) => {
          const prog = plan.passProgress(week, p);
          const moved = p !== todayIdx ? `<p class="note">Flyttat från ${plan.DAYS[p].toLowerCase()}</p>` : "";
          return `<section class="card">
            <h2><span class="dot" style="background: var(--c-vikt)"></span>${week.plan[p].title}
              <span class="badge${prog.complete ? " ok" : ""}">${prog.complete ? "Klart" : prog.done + "/" + prog.total}</span></h2>
            ${moved}${t.passHtml(week, p)}
          </section>`;
        }).join("")
      : `<section class="card"><h2><span class="dot" style="background: var(--c-vikt)"></span>Vilodag</h2>
          <p class="empty">${movedTo[todayIdx] !== undefined ? "Dagens pass ligger senare i veckan." : "Ingen träning planerad idag."}</p></section>`;
    root.innerHTML = `<section class="card">
        <h2><span class="dot" style="background: var(--c-midja)"></span>${plan.DAYS[todayIdx]}</h2>
        ${t.minimumHtml(todayIdx === 0 && items.includes(0))}
      </section>${body}${t.storageErrorHtml}`;
  }

  t.bindSets(root, () => week, (w) => { week = w; }, render, todayIdx);
  render();
}
