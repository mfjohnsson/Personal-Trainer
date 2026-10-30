import { get, set } from "../store.js";
import * as calc from "../calc.js";

export const title = "Profil";

const nf = (digits) => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: digits });
const FIELDS = [
  ["age", "Ålder (år)"],
  ["heightCm", "Längd (cm)"],
  ["weightKg", "Vikt (kg)"],
  ["waistCm", "Midja (cm)"],
  ["goalKg", "Målvikt (kg)"],
];

const fmtInput = (v) => (v === undefined ? "" : String(v).replace(".", ","));

function tile(label, value, unit) {
  return `<div class="tile"><div class="label">${label}</div>
    <div class="value">${value}<span class="unit"> ${unit}</span></div></div>`;
}

function summary(p) {
  const date = calc.goalDate(p).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
  return `
    <section class="card">
      <h2><span class="dot" style="background: var(--c-midja)"></span>Dina mål</h2>
      <div class="tiles">
        ${tile("BMR", nf(0).format(calc.bmr(p)), "kcal")}
        ${tile("TDEE", nf(0).format(calc.tdee(p)), "kcal")}
        ${tile("Kalorimål", nf(0).format(calc.calorieTarget(p)), "kcal/dag")}
        ${tile("Protein", nf(0).format(calc.PROTEIN_G), "g/dag")}
        ${tile("Underskott", nf(0).format(calc.dailyDeficit(p.weightKg)), "kcal/dag")}
        ${tile("Takt", nf(2).format(calc.weeklyLossKg(p.weightKg)), "kg/vecka")}
      </div>
      <p class="note">Målvikt ${nf(1).format(p.goalKg)} kg nås ca ${date} (om ${nf(0).format(calc.weeksToGoal(p))} veckor).</p>
    </section>`;
}

export function mount(el) {
  const stored = get("profile");
  const check = stored ? calc.validate(stored) : null;
  const saved = check && !Object.keys(check.errors).length ? check.values : null;
  const fields = FIELDS.map(([key, label]) => `
    <div class="field">
      <label for="f-${key}">${label}</label>
      <input id="f-${key}" name="${key}" type="text" inputmode="decimal" autocomplete="off"
        aria-describedby="err-${key}">
      <p class="field-error" id="err-${key}" hidden></p>
    </div>`).join("");

  el.innerHTML = `
    <section class="card">
      <h2><span class="dot" style="background: var(--c-vikt)"></span>Startprofil</h2>
      <form id="profile-form" class="form" novalidate>
        ${fields}
        <button class="btn-primary" type="submit">Spara</button>
        <p class="note" id="form-note" aria-live="polite">${saved ? "" : "Fyll i dina uppgifter för att räkna ut mål."}</p>
      </form>
    </section>
    <div id="summary">${saved ? summary(saved) : ""}</div>`;

  const form = el.querySelector("#profile-form");
  if (saved) for (const [key] of FIELDS) el.querySelector(`#f-${key}`).value = fmtInput(saved[key]);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(form));
    const { values, errors } = calc.validate(raw);
    for (const [key] of FIELDS) {
      const err = el.querySelector(`#err-${key}`);
      const input = el.querySelector(`#f-${key}`);
      err.hidden = !errors[key];
      err.textContent = errors[key] ?? "";
      input.toggleAttribute("aria-invalid", !!errors[key]);
    }
    const note = el.querySelector("#form-note");
    const firstBad = FIELDS.find(([key]) => errors[key]);
    if (firstBad) {
      note.textContent = "Rätta de markerade fälten.";
      el.querySelector(`#f-${firstBad[0]}`).focus();
      return;
    }
    if (!set("profile", values)) {
      note.textContent = "Kunde inte spara. Lagringen är full eller blockerad.";
      return;
    }
    note.textContent = "Sparat.";
    el.querySelector("#summary").innerHTML = summary(values);
  });
}
