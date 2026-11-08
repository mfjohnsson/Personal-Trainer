import { get, set, exportJson, readBackup, restoreBackup } from "../store.js";
import * as calc from "../calc.js";
import * as checkin from "../checkin.js";
import { todayIso } from "./training.js";
import { now } from "../clock.js";

export const title = "Profil";

const nf = (digits) => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: digits });
const FIELDS = [
  ["age", "Ålder (år)"],
  ["heightCm", "Längd (cm)"],
  ["weightKg", "Startvikt (kg)"],
  ["waistCm", "Midja vid start (cm)"],
  ["goalKg", "Målvikt (kg)"],
];
const IMPORT_NOTE = "traningskost.importNote";
const SAVE_ERROR = "Kunde inte spara. Lagringen är full eller blockerad.";

const fmtInput = (v) => (v === undefined || v === null ? "" : String(v).replace(".", ","));
const dateText = (iso) => new Date(iso + "T12:00").toLocaleDateString("sv-SE", { day: "numeric", month: "short" });

function tile(label, value, unit) {
  return `<div class="tile"><div class="label">${label}</div>
    <div class="value">${value}<span class="unit"> ${unit}</span></div></div>`;
}

function summary(p, target) {
  const date = calc.goalDate(p, now()).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
  const adjust = checkin.kcalAdjust();
  const left = p.weightKg - p.goalKg;
  return `
    <section class="card">
      <h2><span class="dot" style="background: var(--c-midja)"></span>Dina mål</h2>
      <div class="tiles">
        ${tile("Kalorimål", nf(0).format(target.kcal), "kcal/dag")}
        ${tile("Protein", nf(0).format(target.protein), "g/dag")}
        ${tile("Vikt nu", nf(1).format(p.weightKg), "kg")}
        ${tile("Kvar till mål", nf(1).format(Math.max(0, left)), "kg")}
      </div>
      <p class="note">${left > 0 ? `Målvikt ${nf(1).format(p.goalKg)} kg nås ca ${date} (om ${nf(0).format(calc.weeksToGoal(p))} veckor) i takten ${nf(2).format(calc.weeklyLossKg(p.weightKg))} kg/vecka.` : "Du har nått målvikten. Snyggt!"}</p>
      ${adjust ? `<p class="note">Veckoavstämningarna har ${adjust < 0 ? "sänkt" : "höjt"} kalorimålet med ${Math.abs(adjust)} kcal.</p>` : ""}
      <details class="more"><summary>Så räknas det</summary>
        <p class="note">BMR ${nf(0).format(calc.bmr(p))} kcal × ${nf(2).format(calc.ACTIVITY_FACTOR)} (måttligt aktiv) = TDEE ${nf(0).format(calc.tdee(p))} kcal.
        Underskott ${nf(0).format(calc.dailyDeficit(p.weightKg))} kcal/dag för 0,5 % av kroppsvikten per vecka${adjust ? `, justerat ${adjust > 0 ? "+" : "−"}${Math.abs(adjust)} kcal` : ""}.</p>
      </details>
    </section>`;
}

// Weight over time: one series, so no legend; the list below the chart is its table.
function chartHtml(log, goalKg) {
  if (log.length < 2) return `<p class="note">Kurvan visas när du har loggat två gånger.</p>`;
  const W = 340, H = 180, L = 30, R = 34, T = 14, B = 24; // about a phone width, so text keeps its size
  const t0 = new Date(log[0].date).getTime(), t1 = new Date(log.at(-1).date).getTime();
  const ws = log.map((e) => e.weightKg);
  // Scaled to the weights (the goal is usually far below and would flatten the curve).
  let lo = Math.min(...ws), hi = Math.max(...ws);
  lo = Math.floor(lo - 0.5); hi = Math.ceil(hi + 0.5);
  const x = (e) => L + ((new Date(e.date).getTime() - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = (w) => T + ((hi - w) / (hi - lo)) * (H - T - B);
  const step = Math.max(1, Math.ceil((hi - lo) / 4));
  const ticks = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  const grid = ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/>
    <text x="${L - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${v}</text>`).join("");
  const pts = log.map((e) => `${x(e).toFixed(1)},${y(e.weightKg).toFixed(1)}`);
  const area = `M${pts[0]} L${pts.join(" L")} L${x(log.at(-1)).toFixed(1)},${H - B} L${x(log[0]).toFixed(1)},${H - B} Z`;
  const goal = goalKg !== undefined && goalKg >= lo && goalKg <= hi
    ? `<line x1="${L}" x2="${W - R}" y1="${y(goalKg)}" y2="${y(goalKg)}" class="goal"/><text x="${W - R + 6}" y="${y(goalKg) + 4}" class="axis">Mål</text>` : "";
  const last = log.at(-1);
  const dots = log.slice(0, -1).map((e) => `<circle cx="${x(e)}" cy="${y(e.weightKg)}" r="3" class="pt"/>`).join("");
  return `<div class="chart" id="chart">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Vikt från ${dateText(log[0].date)} till ${dateText(last.date)}: ${nf(1).format(log[0].weightKg)} till ${nf(1).format(last.weightKg)} kg">
      ${grid}${goal}
      <text x="${L}" y="${H - 6}" class="axis">${dateText(log[0].date)}</text>
      <text x="${W - R}" y="${H - 6}" class="axis" text-anchor="end">${dateText(last.date)}</text>
      <path d="${area}" class="area"/>
      <polyline points="${pts.join(" ")}" class="line"/>
      ${dots}
      <circle cx="${x(last)}" cy="${y(last.weightKg)}" r="4.5" class="pt-last"/>
      <text x="${x(last) + 8}" y="${y(last.weightKg) - 8}" class="label">${nf(1).format(last.weightKg)}</text>
      <line class="cross" y1="${T}" y2="${H - B}" x1="0" x2="0" visibility="hidden"/>
    </svg>
    <div class="tip" hidden></div>
  </div>`;
}

function bindChart(el, log) {
  const box = el.querySelector("#chart");
  if (!box) return;
  const svg = box.querySelector("svg"), tip = box.querySelector(".tip"), cross = box.querySelector(".cross");
  const xs = [...svg.querySelectorAll("circle")].map((c) => +c.getAttribute("cx"));
  const move = (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 340;
    let i = 0;
    xs.forEach((v, j) => { if (Math.abs(v - px) < Math.abs(xs[i] - px)) i = j; });
    const entry = log[i];
    cross.setAttribute("x1", xs[i]); cross.setAttribute("x2", xs[i]); cross.setAttribute("visibility", "visible");
    tip.hidden = false;
    tip.textContent = `${dateText(entry.date)}: ${nf(1).format(entry.weightKg)} kg${entry.waistCm ? ` · midja ${nf(1).format(entry.waistCm)} cm` : ""}`;
    tip.style.left = `${Math.min(Math.max((xs[i] / 340) * r.width, 70), r.width - 70)}px`;
  };
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerdown", move);
  svg.addEventListener("pointerleave", () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); });
}

function changeText(entry) {
  if (!entry.checked) return "";
  const rate = `${nf(2).format(entry.pctPerWeek)} %/vecka`;
  if (entry.change < 0) return `Takt ${rate}, långsammare än planerat. Kalorimålet sänks 150 kcal.`;
  if (entry.change > 0) return `Takt ${rate}, snabbare än planerat. Kalorimålet höjs 150 kcal så att du behåller musklerna.`;
  return `Takt ${rate}, helt enligt plan. Kalorimålet är oförändrat.`;
}

export function mount(el) {
  const today = todayIso();
  let note = "", formNote = "";
  // A finished import reloads the page; the message survives that in sessionStorage.
  let backupNote = "";
  try { backupNote = sessionStorage.getItem(IMPORT_NOTE) ?? ""; sessionStorage.removeItem(IMPORT_NOTE); } catch {}

  function render(focusSel) {
    const stored = get("profile");
    const check = stored ? calc.validate(stored) : null;
    const saved = check && !Object.keys(check.errors).length ? check.values : null;
    const p = checkin.currentProfile();
    const target = checkin.currentTarget();
    const log = checkin.logOf();
    const todays = log.find((e) => e.date === today);

    const checkinCard = saved ? `
      <section class="card">
        <h2><span class="dot" style="background: var(--c-vikt)"></span>Veckoavstämning</h2>
        <p class="note">Väg dig en gång i veckan, helst söndag morgon. Kalorimålet justeras efter hur fort det går.</p>
        <form id="checkin-form" class="form" novalidate>
          <div class="field-pair">
            <div class="field"><label for="w-weight">Vikt (kg)</label>
              <input id="w-weight" name="weightKg" type="text" inputmode="decimal" autocomplete="off" value="${fmtInput(todays?.weightKg)}" aria-describedby="err-w-weight">
              <p class="field-error" id="err-w-weight" hidden></p></div>
            <div class="field"><label for="w-waist">Midja (cm)</label>
              <input id="w-waist" name="waistCm" type="text" inputmode="decimal" autocomplete="off" value="${fmtInput(todays?.waistCm)}" aria-describedby="err-w-waist">
              <p class="field-error" id="err-w-waist" hidden></p></div>
          </div>
          <button class="btn-primary" type="submit">${todays ? "Uppdatera dagens vägning" : "Spara vägning"}</button>
          <p class="note" role="status" aria-live="polite">${note}</p>
        </form>
        ${chartHtml(log, p?.goalKg)}
        ${log.length ? `<div class="log">${[...log].reverse().slice(0, 12).map((e) => `<div class="log-row">
            <span>${dateText(e.date)}</span><span>${nf(1).format(e.weightKg)} kg${e.waistCm ? ` · ${nf(1).format(e.waistCm)} cm` : ""}</span>
            <span class="note">${e.change ? (e.change > 0 ? "+" : "−") + Math.abs(e.change) + " kcal" : ""}</span>
            <button type="button" class="link-btn" data-remove="${e.date}" aria-label="Ta bort vägningen ${dateText(e.date)}">Ta bort</button>
          </div>`).join("")}</div>` : ""}
      </section>` : "";

    el.innerHTML = `<div class="view">
      ${saved ? summary(p, target) : ""}
      ${checkinCard}
      <details class="card more-card"${saved ? "" : " open"}>
        <summary><h2><span class="dot" style="background: var(--c-vikt)"></span>Startprofil</h2></summary>
        <form id="profile-form" class="form" novalidate>
          ${FIELDS.map(([key, label]) => `
            <div class="field">
              <label for="f-${key}">${label}</label>
              <input id="f-${key}" name="${key}" type="text" inputmode="decimal" autocomplete="off" value="${fmtInput(saved?.[key])}" aria-describedby="err-${key}">
              <p class="field-error" id="err-${key}" hidden></p>
            </div>`).join("")}
          <button class="btn-primary" type="submit">Spara</button>
          <p class="note" id="form-note" aria-live="polite">${formNote || (saved ? "" : "Fyll i dina uppgifter för att räkna ut mål.")}</p>
        </form>
      </details>
      <details class="card more-card"${backupNote ? " open" : ""}>
        <summary><h2><span class="dot" style="background: var(--ink-3)"></span>Säkerhetskopia</h2></summary>
        <p class="note">Spara all data (profil, vägningar, veckor, rätter) som en fil, eller läs in en fil från en annan enhet. Inläsning ersätter allt som finns här.</p>
        <div class="btn-row">
          <button type="button" class="btn-secondary" id="export-btn">Exportera</button>
          <button type="button" class="btn-secondary" id="import-btn">Importera…</button>
        </div>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
        <p class="note backup-note" role="status" aria-live="polite">${backupNote}</p>
      </details></div>`;
    bindChart(el, log);
    if (focusSel) el.querySelector(focusSel)?.focus();
  }

  el.onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    if (form.id === "profile-form") {
      const { values, errors } = calc.validate(Object.fromEntries(new FormData(form)));
      for (const [key] of FIELDS) {
        const err = el.querySelector(`#err-${key}`);
        err.hidden = !errors[key];
        err.textContent = errors[key] ?? "";
        el.querySelector(`#f-${key}`).toggleAttribute("aria-invalid", !!errors[key]);
      }
      const firstBad = FIELDS.find(([key]) => errors[key]);
      if (firstBad) {
        el.querySelector("#form-note").textContent = "Rätta de markerade fälten.";
        el.querySelector(`#f-${firstBad[0]}`).focus();
        return;
      }
      formNote = set("profile", values) ? "Sparat." : SAVE_ERROR;
      render("#form-note");
    } else if (form.id === "checkin-form") {
      const raw = Object.fromEntries(new FormData(form));
      const w = calc.parseNum(raw.weightKg), waist = raw.waistCm.trim() === "" ? null : calc.parseNum(raw.waistCm);
      const errW = !(w >= 35 && w <= 300) ? "Vikt: 35–300 kg." : "";
      const errM = waist !== null && !(waist >= 40 && waist <= 200) ? "Midja: 40–200 cm, eller lämna tomt." : "";
      for (const [id, msg] of [["w-weight", errW], ["w-waist", errM]]) {
        const err = el.querySelector(`#err-${id}`);
        err.hidden = !msg;
        err.textContent = msg;
        el.querySelector(`#${id}`).toggleAttribute("aria-invalid", !!msg);
      }
      if (errW || errM) { el.querySelector(errW ? "#w-weight" : "#w-waist").focus(); return; }
      const entry = checkin.saveWeighIn(today, w, waist);
      note = entry ? `Sparat. ${changeText(entry)}` : SAVE_ERROR;
      render("#w-weight");
    }
  };

  el.onclick = (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.id === "export-btn") {
      const url = URL.createObjectURL(new Blob([exportJson()], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `traningskost-${today}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      backupNote = `Filen laddas ner som traningskost-${today}.json.`;
      render("#export-btn");
    } else if (btn.id === "import-btn") {
      el.querySelector("#import-file").click();
    } else if (btn.dataset.remove) {
      note = checkin.removeWeighIn(btn.dataset.remove) ? "Vägningen är borttagen." : SAVE_ERROR;
      render("#w-weight");
    }
  };

  el.onchange = async (e) => {
    if (e.target.id !== "import-file") return;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let text;
    try { text = await file.text(); } catch {
      backupNote = "Kunde inte läsa filen.";
      render("#import-btn");
      return;
    }
    const backup = readBackup(text);
    if (!backup.ok) {
      backupNote = backup.error;
      render("#import-btn");
      return;
    }
    if (!confirm(`Ersätta all data i appen med ${file.name}? Det som finns här nu går förlorat.`)) return;
    if (!restoreBackup(backup.data)) {
      backupNote = SAVE_ERROR;
      render("#import-btn");
      return;
    }
    try { sessionStorage.setItem(IMPORT_NOTE, `Inläst från ${file.name}.`); } catch {}
    location.reload(); // every view and cache starts over from the new data
  };

  render();
}
