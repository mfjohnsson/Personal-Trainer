// The stored meal week. Storage: meals = { [monday]: week }.
import { get, set } from "./store.js";
import * as plan from "./plan.js";
import * as meals from "./meals.js";
import * as checkin from "./checkin.js";

const KEEP_WEEKS = 12; // older weeks are dropped so storage stays small

const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);

export const currentTarget = checkin.currentTarget;

export const weekStart = (todayIso) => plan.mondayOf(plan.parseIso(todayIso));

export function prevWeekStart(start) {
  const d = plan.parseIso(start);
  d.setDate(d.getDate() - 7);
  return plan.isoDate(d);
}

const allWeeks = () => (isObject(get("meals")) ? get("meals") : {});

// Stores one week; old weeks beyond KEEP_WEEKS are dropped. Returns false if storage refused.
export function saveWeek(week) {
  const next = { ...allWeeks(), [week.start]: week };
  const keep = Object.keys(next).sort().slice(-KEEP_WEEKS);
  return set("meals", Object.fromEntries(keep.map((k) => [k, next[k]])));
}

// Last week's final snack, so a new Monday doesn't repeat it. Null when last week is not stored.
export function lastSnackBefore(start) {
  const prev = allWeeks()[prevWeekStart(start)];
  return meals.isWeek(prev) ? prev.days.at(-1).meals[2].dish : null;
}

// The stored week is reused while every dish still resolves. A new target (weigh-in or profile) keeps
// the dishes and re-fits the portions; a new week is built from the dishes on offer.
export function weekMeals(start, target) {
  const all = allWeeks();
  const cur = all[start];
  const resolvable = meals.isWeek(cur) && cur.days.every((day) => day.meals.every((m) => m.custom || meals.dishOf(m.dish)));
  if (resolvable && cur.target.kcal === target.kcal && cur.target.protein === target.protein) return cur;
  let week;
  if (resolvable) week = meals.retarget(cur, target);
  else {
    // Last week may never have been opened; then the snack rule simply starts over.
    week = meals.generateWeek(start, target, lastSnackBefore(start));
  }
  saveWeek(week);
  return week;
}
