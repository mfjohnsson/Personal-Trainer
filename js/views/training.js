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
  const choices = get("choices") ?? {};
  const week = weeks[start] ? plan.upgradeWeek(weeks[start], choices) : plan.createWeek(start, choices);
  return { week, weeks, start, stored: weeks[start] };
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

// Your pick is remembered per slot and used for all later weeks. Returns the new week or null.
export function changeChoice(week, passDay, exIdx, optionId) {
  const slot = plan.CATALOG[passDay].slots[exIdx];
  const choices = { ...(get("choices") ?? {}), [slot.id]: optionId };
  if (!set("choices", choices)) return null;
  const next = plan.applyChoice(week, passDay, exIdx, optionId);
  return saveWeek(next) ? next : null;
}

export function ensureWeek(today) {
  const { week, stored } = currentWeek(today);
  if (stored !== week) saveWeek(week); // on failure the week still renders; the first toggle shows the error
  return week;
}

// pressToday: Push (pass 0) sits on this day, so the press replaces the push-ups.
export function minimumHtml(pressToday) {
  const pushups = pressToday
    ? `${plan.DAILY_MIN.pushups} armhävningar ersätts idag av pressövningen i Push-passet`
    : `${plan.DAILY_MIN.pushups} armhävningar`;
  return `<p class="minimum"><strong>Dagligt minimum:</strong> ${plan.DAILY_MIN.pullups} pull-ups · ${pushups}</p>`;
}

export function passHtml(week, passDay) {
  const pass = week.plan[passDay];
  const slots = plan.CATALOG[passDay].slots;
  return pass.exercises.map((ex, e) => {
    const boxes = Array.from({ length: ex.sets }, (_, s) => {
      const key = plan.setKey(passDay, e, s);
      return `<label class="set"><input type="checkbox" data-key="${key}"${week.done[key] ? " checked" : ""}>
        <span>${ex.sets === 1 ? "Klar" : "Set " + (s + 1)}</span></label>`;
    }).join("");
    const slot = slots[e];
    const picker = slot.options.length > 1
      ? `<select class="pick" data-pass="${passDay}" data-ex="${e}" aria-label="Byt övning: ${slot.label}">
          ${slot.options.map((o) => `<option value="${o.id}"${o.id === ex.id ? " selected" : ""}>${o.name}</option>`).join("")}
        </select>`
      : `<span class="ex-name">${ex.name}</span>`;
    return `<div class="exercise">
      <div class="ex-slot">${slot.label}</div>
      <div class="ex-head">${picker}<span class="ex-reps">${ex.sets > 1 ? ex.sets + " × " : ""}${ex.reps}</span></div>
      <div class="sets">${boxes}</div>
    </div>`;
  }).join("");
}

// Wires set checkboxes and exercise pickers inside `el`; calls `rerender()` after a successful
// save and restores focus.
export function bindSets(el, getWeek, setWeek, rerender, todayIdx) {
  el.addEventListener("change", (e) => {
    const input = e.target;
    let next, focusSel;
    if (input instanceof HTMLSelectElement && input.dataset.pass) {
      next = changeChoice(getWeek(), +input.dataset.pass, +input.dataset.ex, input.value);
      focusSel = `select[data-pass="${input.dataset.pass}"][data-ex="${input.dataset.ex}"]`;
    } else if (input instanceof HTMLInputElement && input.dataset.key) {
      next = toggleSet(getWeek(), input.dataset.key, input.checked, todayIdx);
      focusSel = `input[data-key="${input.dataset.key}"]`;
    } else return;
    if (!next) {
      if (input instanceof HTMLInputElement) input.checked = !input.checked;
      else rerender();
      el.querySelector(".storage-error")?.removeAttribute("hidden");
      return;
    }
    setWeek(next);
    rerender();
    el.querySelector(focusSel)?.focus();
  });
}

export const storageErrorHtml =
  `<p class="field-error storage-error" role="alert" hidden>Kunde inte spara. Lagringen är full eller blockerad.</p>`;
