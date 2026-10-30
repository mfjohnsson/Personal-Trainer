// Shared training UI for Idag and Vecka: current week from storage, set checkboxes, daily minimum.
import { get, set } from "../store.js";
import * as plan from "../plan.js";

// ?today=YYYY-MM-DD overrides the date, so moved passes can be tested without changing the phone clock.
export function todayIso() {
  const override = new URLSearchParams(location.search).get("today");
  return plan.parseIso(override) ? override : plan.isoDate(new Date());
}

export function currentWeek(today) {
  const start = plan.mondayOf(plan.parseIso(today));
  const weeks = get("weeks") ?? {};
  return { week: weeks[start] ?? plan.createWeek(start), weeks, start };
}

// Persists the week (creating it on first touch). Returns false if storage refused.
function saveWeek(week) {
  const weeks = get("weeks") ?? {};
  return set("weeks", { ...weeks, [week.start]: week });
}

export function toggleSet(week, key, checked, todayIdx) {
  const next = plan.applyToggle(week, key, checked, todayIdx);
  return saveWeek(next) ? next : null;
}

export function ensureWeek(today) {
  const { week, weeks, start } = currentWeek(today);
  if (!weeks[start]) saveWeek(week); // on failure the week still renders; the first toggle shows the error
  return week;
}

export function minimumHtml(dayIdx) {
  const pushups = dayIdx === 0
    ? `${plan.DAILY_MIN.pushups} armhävningar ersätts idag av incline hantelpress`
    : `${plan.DAILY_MIN.pushups} armhävningar`;
  return `<p class="minimum"><strong>Dagligt minimum:</strong> ${plan.DAILY_MIN.pullups} pull-ups · ${pushups}</p>`;
}

export function passHtml(week, passDay) {
  const pass = week.plan[passDay];
  return pass.exercises.map((ex, e) => {
    const boxes = Array.from({ length: ex.sets }, (_, s) => {
      const key = plan.setKey(passDay, e, s);
      return `<label class="set"><input type="checkbox" data-key="${key}"${week.done[key] ? " checked" : ""}>
        <span>${ex.sets === 1 ? "Klar" : "Set " + (s + 1)}</span></label>`;
    }).join("");
    return `<div class="exercise">
      <div class="ex-head"><span class="ex-name">${ex.name}</span><span class="ex-reps">${ex.sets > 1 ? ex.sets + " × " : ""}${ex.reps}</span></div>
      <div class="sets">${boxes}</div>
    </div>`;
  }).join("");
}

// Wires set checkboxes inside `el`; calls `rerender()` after a successful save and restores focus.
export function bindSets(el, getWeek, setWeek, rerender, todayIdx) {
  el.addEventListener("change", (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.key) return;
    const next = toggleSet(getWeek(), input.dataset.key, input.checked, todayIdx);
    if (!next) {
      input.checked = !input.checked;
      el.querySelector(".storage-error")?.removeAttribute("hidden");
      return;
    }
    setWeek(next);
    rerender();
    el.querySelector(`input[data-key="${input.dataset.key}"]`)?.focus();
  });
}

export const storageErrorHtml =
  `<p class="field-error storage-error" role="alert" hidden>Kunde inte spara. Lagringen är full eller blockerad.</p>`;
