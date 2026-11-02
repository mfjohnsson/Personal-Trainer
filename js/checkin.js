// Weigh-ins and the calorie target that follows from them.
// Storage: log = [{ date, weightKg, waistCm, checked, change, pctPerWeek? }], sorted by date. `checked` marks
// a weigh-in that was compared with one at least five days earlier (at most one per five days); `change` is what it did to the
// calorie target (−150, 0 or +150). The target adjustment is the sum of all changes.
import { get, set } from "./store.js";
import * as calc from "./calc.js";
import * as plan from "./plan.js";

const finite = (v) => typeof v === "number" && Number.isFinite(v);

export function logOf() {
  const raw = get("log");
  if (!Array.isArray(raw)) return [];
  return raw.filter((e) => e && plan.parseIso(e.date) && finite(e.weightKg) && (e.waistCm === null || finite(e.waistCm)))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const daysBetween = (a, b) => plan.dayIndex(a, b);

// Works out the entry for `date` against the earlier log. Returns the entry to store.
export function evaluate(log, date, weightKg, waistCm) {
  const others = log.filter((e) => e.date !== date);
  const ref = others.filter((e) => daysBetween(e.date, date) >= calc.MIN_DAYS).at(-1);
  // At most one comparison per MIN_DAYS, so daily weigh-ins don't adjust the target every day.
  const recent = others.some((e) => e.checked && Math.abs(daysBetween(e.date, date)) < calc.MIN_DAYS);
  const entry = { date, weightKg, waistCm, checked: false, change: 0 };
  if (!ref || recent) return entry;
  const { pctPerWeek, change } = calc.weighInChange(ref, entry, daysBetween(ref.date, date));
  return { ...entry, checked: true, change, pctPerWeek: Math.round(pctPerWeek * 100) / 100, refDate: ref.date };
}

// Saves (or replaces) the weigh-in for `date`. Returns the stored entry, or null if storage refused.
export function saveWeighIn(date, weightKg, waistCm) {
  const log = logOf();
  const entry = evaluate(log, date, weightKg, waistCm);
  const next = [...log.filter((e) => e.date !== date), entry].sort((a, b) => a.date.localeCompare(b.date));
  return set("log", next) ? entry : null;
}

export function removeWeighIn(date) {
  return set("log", logOf().filter((e) => e.date !== date));
}

export const kcalAdjust = () => logOf().reduce((a, e) => a + (finite(e.change) ? e.change : 0), 0);

// The saved profile with the latest logged weight and waist. Null without a valid profile.
export function currentProfile() {
  const stored = get("profile");
  if (!stored) return null;
  const { values, errors } = calc.validate(stored);
  if (Object.keys(errors).length) return null;
  const last = logOf().at(-1);
  return last ? { ...values, weightKg: last.weightKg, waistCm: last.waistCm ?? values.waistCm } : values;
}

export function currentTarget() {
  const p = currentProfile();
  if (!p) return null;
  return { kcal: Math.max(calc.KCAL_FLOOR, Math.round(calc.calorieTarget(p)) + kcalAdjust()), protein: calc.PROTEIN_G };
}

// True when no weigh-in has been logged during the last six days (Idag shows the reminder on Sundays).
export function due(today) {
  const last = logOf().at(-1);
  return !last || daysBetween(last.date, today) >= 6;
}
