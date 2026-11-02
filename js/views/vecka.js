import * as plan from "../plan.js";
import * as t from "./training.js";
import * as timer from "../timer.js";

export const title = "Träning";

export function mount(el) {
  const root = document.createElement("div");
  root.className = "view";
  el.append(root);
  const timerCard = timer.element();

  const today = t.todayIso();
  let week = t.ensureWeek(today);
  const todayIdx = plan.dayIndex(week.start, today);
  const open = new Set([todayIdx]);
  let draft = null; // pass type per day while the layout editor is open
  let msg = "";

  const short = (t) => (t.length > 8 ? t.slice(0, 6) + "." : t); // "Intervaller" does not fit a chip
  const typeOptions = (sel) => [`<option value=""${sel === null ? " selected" : ""}>Vila</option>`,
    ...plan.CATALOG.map((p) => `<option value="${p.id}"${p.id === sel ? " selected" : ""}>${p.title}</option>`)].join("");

  function layoutHtml() {
    if (!draft) {
      const chips = plan.templateOf(week).map((type, d) =>
        `<span class="chip${type ? "" : " rest"}"><span class="chip-day">${plan.SHORT_DAYS[d]}</span>${type ? short(plan.passType(type).title) : "Vila"}</span>`).join("");
      return `<section class="card">
        <h2><span class="dot" style="background: var(--c-vikt)"></span>Veckans upplägg</h2>
        <div class="chips">${chips}</div>
        <p class="note" role="status" aria-live="polite">${msg}</p>
        <button class="btn-secondary wide" type="button" data-act="edit-layout">Ändra upplägg</button>
      </section>`;
    }
    const rows = draft.map((type, d) => `<div class="layout-row">
        <label for="lay-${d}">${plan.DAYS[d]}</label>
        <select class="pick" id="lay-${d}" data-lay="${d}">${typeOptions(type)}</select>
      </div>`).join("");
    const changed = draft.some((type, d) => type !== (week.plan[d]?.type ?? null) && plan.passProgress(week, d).done > 0);
    return `<section class="card">
      <h2><span class="dot" style="background: var(--c-vikt)"></span>Ändra upplägg</h2>
      <p class="note">Välj pass för varje dag. Samma pass får ligga på flera dagar.</p>
      <div class="layout">${rows}</div>
      ${changed ? `<p class="note warn">Avbockade set på dagar du ändrar nollställs.</p>` : ""}
      <div class="stack">
        <button class="btn-primary" type="button" data-act="save-default">Spara för den här och kommande veckor</button>
        <button class="btn-secondary" type="button" data-act="save-week">Bara den här veckan</button>
        <button class="btn-secondary" type="button" data-act="cancel-layout">Avbryt</button>
      </div>
    </section>`;
  }

  function render() {
    const { byDay, movedTo } = plan.schedule(week, todayIdx);
    const cards = plan.DAYS.map((name, d) => {
      const items = byDay[d];
      const own = !!week.plan[d] && !items.includes(d) && movedTo[d] !== undefined;
      const heading = items.length ? items.map((p) => week.plan[p].title).join(" + ") : "Vila";
      const prog = items.map((p) => plan.passProgress(week, p));
      const allDone = prog.length > 0 && prog.every((p) => p.complete);
      const badge = items.length
        ? (allDone ? `<span class="badge ok">✓ Klart</span>` : `<span class="badge">${prog.reduce((a, p) => a + p.done, 0)}/${prog.reduce((a, p) => a + p.total, 0)}</span>`)
        : "";
      const body = items.map((p) => {
        const moved = p !== d ? `<p class="note">Flyttat från ${plan.DAYS[p].toLowerCase()}</p>` : "";
        return `${moved}${p !== d || items.length > 1 ? `<h3>${week.plan[p].title}</h3>` : ""}${t.passHtml(week, p, d)}`;
      }).join("") || `<p class="empty">${own ? "Passet har flyttats till " + plan.DAYS[movedTo[d]].toLowerCase() + "." : "Ingen träning planerad. Vila."}</p>`;
      const isToday = d === todayIdx;
      return `<details class="card day${allDone ? " is-done" : ""}" data-day="${d}"${open.has(d) ? " open" : ""}>
        <summary><span class="day-name">${name}${isToday ? ` <span class="today">idag</span>` : ""}</span>
          <span class="day-pass">${own ? "Flyttat" : heading}</span>${badge}</summary>
        ${body}
      </details>`;
    }).join("");
    root.innerHTML = layoutHtml() + t.minimumHtml() + cards + t.storageErrorHtml;
    root.prepend(timerCard); // outside the HTML string, so a running timer survives the redraw
    root.querySelectorAll("details.day").forEach((det) =>
      det.addEventListener("toggle", () => {
        const d = Number(det.dataset.day);
        if (det.open) open.add(d); else open.delete(d);
      }));
  }

  root.addEventListener("change", (e) => {
    const d = e.target.dataset?.lay;
    if (d === undefined || !draft) return;
    draft[+d] = e.target.value || null;
    render();
    root.querySelector(`#lay-${d}`)?.focus();
  });

  root.addEventListener("click", (e) => {
    const act = e.target.closest("button[data-act]")?.dataset.act;
    if (!act) return;
    if (act === "edit-layout") { draft = plan.templateOf(week); msg = ""; render(); root.querySelector("#lay-0")?.focus(); }
    else if (act === "cancel-layout") { draft = null; render(); root.querySelector(`[data-act="edit-layout"]`)?.focus(); }
    else if (act === "save-week" || act === "save-default") {
      const next = t.changeTemplate(week, draft, act === "save-default");
      if (!next) { root.querySelector(".storage-error")?.removeAttribute("hidden"); return; }
      week = next;
      draft = null;
      msg = act === "save-default" ? "Sparat. Gäller även kommande veckor." : "Sparat för den här veckan.";
      render();
      root.querySelector(`[data-act="edit-layout"]`)?.focus();
    }
  });

  t.bindSets(root, {
    getWeek: () => week, setWeek: (w) => { week = w; }, rerender: render, todayIdx,
    onPassDone: (shownOn) => open.delete(shownOn), // the finished day folds up
  });
  render();
}
