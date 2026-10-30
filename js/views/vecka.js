import * as plan from "../plan.js";
import * as t from "./training.js";

export const title = "Vecka";

export function mount(el) {
  const root = document.createElement("div");
  root.className = "view";
  el.append(root);

  const today = t.todayIso();
  let week = t.ensureWeek(today);
  const todayIdx = plan.dayIndex(week.start, today);
  const open = new Set([todayIdx]);

  function render() {
    const { byDay, movedTo } = plan.schedule(week, todayIdx);
    const cards = plan.DAYS.map((name, d) => {
      const items = byDay[d];
      const own = d < plan.PASS_DAYS && !items.includes(d) && movedTo[d] !== undefined;
      const heading = items.length ? items.map((p) => week.plan[p].title).join(" + ") : "Vila";
      const prog = items.map((p) => plan.passProgress(week, p));
      const allDone = prog.length > 0 && prog.every((p) => p.complete);
      const badge = items.length
        ? (allDone ? `<span class="badge ok">Klart</span>` : `<span class="badge">${prog.reduce((a, p) => a + p.done, 0)}/${prog.reduce((a, p) => a + p.total, 0)}</span>`)
        : "";
      const body = items.map((p) => {
        const moved = p !== d ? `<p class="note">Flyttat från ${plan.DAYS[p].toLowerCase()}</p>` : "";
        return `${moved}${p !== d || items.length > 1 ? `<h3>${week.plan[p].title}</h3>` : ""}${t.passHtml(week, p)}`;
      }).join("") || `<p class="empty">${own ? "Ingen träning idag, passet ligger senare i veckan." : "Ingen träning planerad. Vila."}</p>`;
      const movedNote = own ? `<p class="note">Passet har flyttats till ${plan.DAYS[movedTo[d]].toLowerCase()}.</p>` : "";
      const isToday = d === todayIdx;
      return `<details class="card day" data-day="${d}"${open.has(d) ? " open" : ""}>
        <summary><span class="day-name">${name}${isToday ? ` <span class="today">idag</span>` : ""}</span>
          <span class="day-pass">${own ? "Flyttat" : heading}</span>${badge}</summary>
        ${t.minimumHtml()}${movedNote}${body}
      </details>`;
    }).join("");
    root.innerHTML = cards + t.storageErrorHtml;
    root.querySelectorAll("details.day").forEach((det) =>
      det.addEventListener("toggle", () => {
        const d = Number(det.dataset.day);
        if (det.open) open.add(d); else open.delete(d);
      }));
  }

  t.bindSets(root, () => week, (w) => { week = w; }, render, todayIdx);
  render();
}
