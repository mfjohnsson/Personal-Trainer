import { get, set } from "../store.js";
import * as calc from "../calc.js";
import * as plan from "../plan.js";
import * as meals from "../meals.js";
import { todayIso, storageErrorHtml } from "./training.js";

export const title = "Kost";

const nf = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });
const fmt = (n) => nf.format(n);

function currentTarget() {
  const stored = get("profile");
  if (!stored) return null;
  const { values, errors } = calc.validate(stored);
  if (Object.keys(errors).length) return null;
  return { kcal: Math.round(calc.calorieTarget(values)), protein: calc.PROTEIN_G };
}

// The stored week is reused while the target is unchanged; a new profile or a new week regenerates it.
function ensureMeals(start, target) {
  const all = get("meals") ?? {};
  const cur = all[start];
  if (cur && cur.target.kcal === target.kcal && cur.target.protein === target.protein) return cur;
  const d = plan.parseIso(start);
  d.setDate(d.getDate() - 7);
  const prevStart = plan.isoDate(d);
  // Last week may never have been opened; rebuild it so the snack rule still holds across the boundary.
  const prev = all[prevStart] ?? meals.generateWeek(prevStart, target);
  const week = meals.generateWeek(start, target, prev.days.at(-1).meals[2].dish);
  set("meals", { ...all, [start]: week });
  return week;
}

const amount = (i) => `${fmt(i.amount)} ${i.unit}`;

function mealHtml(m, d) {
  const label = meals.SLOTS.find((s) => s.id === m.slot).label;
  const info = meals.mealInfo(m);
  const options = meals.DISHES[m.slot];
  const picker = options.length > 1
    ? `<select class="pick" data-day="${d}" data-slot="${m.slot}" aria-label="Byt rätt: ${label}">
        ${options.map((o) => `<option value="${o.id}"${o.id === m.dish ? " selected" : ""}>${o.name}</option>`).join("")}
      </select>`
    : `<span class="ex-name">${info.name}</span>`;
  return `<div class="meal">
    <div class="ex-slot">${label}</div>
    <div class="ex-head">${picker}
      <span class="ex-reps">${info.kcal} kcal · ${info.protein} g</span></div>
    <p class="note">${info.ingredients.map((i) => `${amount(i)} ${i.name.toLowerCase()}`).join(" · ")}</p>
  </div>`;
}

export function mount(el) {
  const target = currentTarget();
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

  const today = todayIso();
  const start = plan.mondayOf(plan.parseIso(today));
  const todayIdx = plan.dayIndex(start, today);
  const open = new Set([todayIdx]);

  function render() {
    const week = ensureMeals(start, target);
    draw(week);
    el.querySelectorAll("details.day").forEach((det) => {
      det.addEventListener("toggle", () => {
        if (det.open) open.add(+det.dataset.day); else open.delete(+det.dataset.day);
      });
    });
  }

  // `el` is the same element for every view, so assign (not add) the handler to avoid stacking one per visit.
  el.onchange = (e) => {
    const sel = e.target;
    if (!(sel instanceof HTMLSelectElement) || !sel.dataset.slot) return;
    const week = ensureMeals(start, target);
    const next = meals.changeDish(week, +sel.dataset.day, sel.dataset.slot, sel.value);
    const saved = next && set("meals", { ...get("meals"), [start]: next });
    render();
    if (!saved) el.querySelector(".storage-error")?.removeAttribute("hidden");
    el.querySelector(`select[data-day="${sel.dataset.day}"][data-slot="${sel.dataset.slot}"]`)?.focus();
  };

  render();

  function draw(week) {
    const allOk = week.days.every((day) => meals.withinTarget(meals.dayTotals(day), target));
    const days = week.days.map((day, d) => {
      const t = meals.dayTotals(day);
      const ok = meals.withinTarget(t, target);
      return `<details class="card day" data-day="${d}"${open.has(d) ? " open" : ""}>
        <summary><span class="day-name">${plan.DAYS[d]}${d === todayIdx ? ` <span class="today">idag</span>` : ""}</span>
          <span class="day-pass">${t.kcal} kcal · ${t.protein} g protein</span>
          <span class="badge${ok ? " ok" : ""}">${ok ? "Rätt" : "Avviker"}</span></summary>
        ${day.meals.map((m) => mealHtml(m, d)).join("")}
        <p class="note day-total">Summa ${t.kcal} av ${target.kcal} kcal · ${t.protein} av ${target.protein} g protein</p>
      </details>`;
    }).join("");

    el.innerHTML = `<div class="view">
      <section class="card">
        <h2><span class="dot" style="background: var(--c-midja)"></span>Veckans kost</h2>
        <div class="tiles">
          <div class="tile"><div class="label">Kalorimål</div><div class="value">${target.kcal}<span class="unit"> kcal</span></div></div>
          <div class="tile"><div class="label">Protein</div><div class="value">${target.protein}<span class="unit"> g</span></div></div>
        </div>
        <p class="note">${allOk
          ? "Portionerna är skalade så att varje dag landar inom ±5 % av kalorimålet och ±10 g av proteinmålet."
          : "Några dagar når inte målet inom marginalen med rimliga portioner. De är markerade \"Avviker\"."}</p>
        <p class="note">Byt rätt på en måltid under respektive dag, till exempel för att laga samma matlåda flera dagar. Portionerna räknas om så att dagen fortfarande når målet.</p>
        ${storageErrorHtml}
      </section>${days}</div>`;
  }
}
