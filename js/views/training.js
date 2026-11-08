// Shared training UI for Idag and Träning: current week from storage, set checkboxes, exercise swaps,
// "pass done" and the daily minimum.
import { get, set, setMany } from "../store.js";
import * as plan from "../plan.js";

// Today's date; on localhost ?datum= overrides it (see clock.js).
export { todayIso } from "../clock.js";

const template = () => plan.normTemplate(get("template"));

export function currentWeek(today) {
  const start = plan.mondayOf(plan.parseIso(today));
  const weeks = get("weeks") ?? {};
  const choices = get("choices") ?? {};
  const progress = get("progress") ?? {};
  if (weeks[start]) return { week: plan.upgradeWeek(weeks[start], choices, progress), stored: weeks[start] };
  // New week: count last week toward progression, then build this week from the new levels.
  const next = plan.advance(weeks, progress, start);
  return { week: plan.createWeek(start, choices, next.progress, template()), next };
}

// Persists the week (creating it on first touch). A new week is written together with the progress
// that last week produced, in one write, so the two can never disagree. Returns false if storage refused.
function saveWeek(week, extra = {}) {
  const weeks = get("weeks") ?? {};
  if (weeks[week.start]) return setMany({ weeks: { ...weeks, [week.start]: week }, ...extra });
  const next = plan.advance(weeks, get("progress") ?? {}, week.start);
  return setMany({ weeks: { ...next.weeks, [week.start]: week }, progress: next.progress, ...extra });
}

export function toggleSet(week, key, checked, todayIdx) {
  const next = plan.applyToggle(week, key, checked, todayIdx);
  return saveWeek(next) ? next : null;
}

// Your pick is remembered per slot and used for all later weeks. Returns the new week or null.
export function changeChoice(week, day, exIdx, optionId) {
  const slot = plan.passType(week.plan[day]?.type)?.slots[exIdx];
  if (!slot) return null;
  const choices = { ...(get("choices") ?? {}), [slot.id]: optionId };
  const next = plan.applyChoice(week, day, exIdx, optionId, get("progress") ?? {});
  return saveWeek(next, { choices }) ? next : null;
}

// New pass types for this week's days; with `asDefault` they also become the template for new weeks.
export function changeTemplate(week, tpl, asDefault) {
  const next = plan.applyTemplate(week, tpl, get("choices") ?? {}, get("progress") ?? {});
  return saveWeek(next, asDefault ? { template: plan.normTemplate(tpl) } : {}) ? next : null;
}

export function setPassDone(week, day, isDone, shownOn) {
  const next = plan.applyPassDone(week, day, isDone, shownOn);
  return saveWeek(next) ? next : null;
}

export function ensureWeek(today) {
  const { week, stored } = currentWeek(today);
  if (stored !== week) saveWeek(week); // on failure the week still renders; the first toggle shows the error
  return week;
}

// --- Daily minimum, checked per date. Storage: minimum = { [iso date]: { pullups, pushups } } ---
const KEEP_DAYS = 60;
const minimumOf = (date) => get("minimum")?.[date] ?? {};

function toggleMinimum(date, what) {
  const all = get("minimum") ?? {};
  const next = { ...all, [date]: { ...all[date], [what]: !all[date]?.[what] } };
  const keep = Object.keys(next).sort().slice(-KEEP_DAYS);
  return set("minimum", Object.fromEntries(keep.map((k) => [k, next[k]])));
}

// `date` set: tappable buttons for that day; otherwise just the text.
export function minimumHtml(date) {
  if (!date) return `<p class="minimum"><strong>Dagligt minimum:</strong> ${plan.DAILY_MIN.pullups} pull-ups · ${plan.DAILY_MIN.pushups} armhävningar</p>`;
  const m = minimumOf(date);
  const btn = (what, label) => `<button type="button" class="min-btn${m[what] ? " on" : ""}" data-min="${what}" data-date="${date}"
    aria-pressed="${!!m[what]}">${m[what] ? "✓ " : ""}${label}</button>`;
  return `<div class="minimum-row">${btn("pullups", `${plan.DAILY_MIN.pullups} pull-ups`)}${btn("pushups", `${plan.DAILY_MIN.pushups} armhävningar`)}</div>`;
}

// --- One pass ---
const swapping = new Set(); // "day:exercise" whose picker is open

export function passHtml(week, day, shownOn) {
  const pass = week.plan[day];
  const slots = plan.passType(pass.type).slots;
  const prog = plan.passProgress(week, day);
  const exercises = pass.exercises.map((ex, e) => {
    const boxes = Array.from({ length: ex.sets }, (_, s) => {
      const key = plan.setKey(day, e, s);
      return `<label class="set"><input type="checkbox" data-key="${key}"${week.done[key] ? " checked" : ""}>
        <span>${ex.sets === 1 ? "Klar" : "Set " + (s + 1)}</span></label>`;
    }).join("");
    const slot = slots[e];
    const open = swapping.has(`${day}:${e}`);
    const canSwap = slot.options.length > 1;
    const picker = open
      ? `<select class="pick" data-pass="${day}" data-ex="${e}" aria-label="Byt övning: ${slot.label}">
          ${slot.options.map((o) => `<option value="${o.id}"${o.id === ex.id ? " selected" : ""}>${o.name}</option>`).join("")}
        </select>`
      : `<span class="ex-name">${ex.name}</span>`;
    return `<div class="exercise">
      <div class="ex-slot">${slot.label}</div>
      <div class="ex-head">${picker}<span class="ex-reps">${ex.sets > 1 ? ex.sets + " × " : ""}${ex.reps}</span>
        ${canSwap ? `<button type="button" class="link-btn" data-swap="${day}:${e}" aria-expanded="${open}">${open ? "Stäng" : "Byt"}</button>` : ""}</div>
      ${ex.note ? `<p class="note">${ex.note}</p>` : ""}
      <div class="sets">${boxes}</div>
    </div>`;
  }).join("");
  const footer = prog.complete
    ? `<button type="button" class="btn-secondary pass-btn" data-undone="${day}" data-shown="${shownOn}">Markera som ej klart</button>`
    : `<button type="button" class="btn-primary pass-btn" data-done="${day}" data-shown="${shownOn}">Markera passet klart</button>`;
  return exercises + footer;
}

// Wires sets, exercise pickers, pass buttons and the daily minimum inside `el`. `onPassDone(shownOn)`
// lets the view fold the pass away.
export function bindSets(el, { getWeek, setWeek, rerender, todayIdx, onPassDone }) {
  const failed = () => el.querySelector(".storage-error")?.removeAttribute("hidden");

  el.addEventListener("change", (e) => {
    const input = e.target;
    let next, focusSel;
    if (input instanceof HTMLSelectElement && input.dataset.pass) {
      next = changeChoice(getWeek(), +input.dataset.pass, +input.dataset.ex, input.value);
      swapping.delete(`${input.dataset.pass}:${input.dataset.ex}`);
      focusSel = `[data-swap="${input.dataset.pass}:${input.dataset.ex}"]`;
    } else if (input instanceof HTMLInputElement && input.dataset.key) {
      next = toggleSet(getWeek(), input.dataset.key, input.checked, todayIdx);
      focusSel = `input[data-key="${input.dataset.key}"]`;
    } else return;
    if (!next) {
      if (input instanceof HTMLInputElement) input.checked = !input.checked;
      else rerender();
      failed();
      return;
    }
    setWeek(next);
    rerender();
    el.querySelector(focusSel)?.focus();
  });

  el.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const d = btn.dataset;
    if (d.swap) {
      if (swapping.has(d.swap)) swapping.delete(d.swap); else swapping.add(d.swap);
      rerender();
      const [p, x] = d.swap.split(":");
      el.querySelector(swapping.has(d.swap) ? `select[data-pass="${p}"][data-ex="${x}"]` : `[data-swap="${d.swap}"]`)?.focus();
    } else if (d.done !== undefined || d.undone !== undefined) {
      const isDone = d.done !== undefined;
      const day = Number(isDone ? d.done : d.undone);
      const next = setPassDone(getWeek(), day, isDone, Number(d.shown));
      if (!next) { failed(); return; }
      setWeek(next);
      if (isDone) onPassDone?.(Number(d.shown), day);
      rerender();
    } else if (d.min) {
      if (!toggleMinimum(d.date, d.min)) { failed(); return; }
      rerender();
      el.querySelector(`[data-min="${d.min}"]`)?.focus();
    }
  });
}

export const storageErrorHtml =
  `<p class="field-error storage-error" role="alert" hidden>Kunde inte spara. Lagringen är full eller blockerad.</p>`;
