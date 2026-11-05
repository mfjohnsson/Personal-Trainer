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

// The stored week is reused while every dish still resolves. A new target (weigh-in or profile), or a
// week stored by an older planner, keeps the dishes and re-fits the portions; a new week is built from
// the dishes on offer.
export function weekMeals(start, target) {
  const all = allWeeks();
  const cur = all[start];
  const resolvable = meals.isWeek(cur) && cur.days.every((day) => day.meals.every((m) => m.custom || meals.dishOf(m.dish)));
  if (resolvable && cur.v === meals.PLAN_VERSION && cur.target.kcal === target.kcal && cur.target.protein === target.protein) return cur;
  let week;
  if (resolvable) week = meals.retarget(cur, target);
  else {
    // Last week may never have been opened; then the snack rule simply starts over.
    week = meals.generateWeek(start, target, lastSnackBefore(start));
  }
  saveWeek(week);
  return week;
}

// The day before day `idx` of the week starting `start`, with its week's target: { day, target }, or
// null. Monday looks at last week's Sunday, when that week is stored.
export function dayBefore(start, idx, week) {
  if (idx > 0) return { day: week.days[idx - 1], target: week.target };
  const prev = allWeeks()[prevWeekStart(start)];
  return meals.isWeek(prev) ? { day: prev.days[6], target: prev.target } : null;
}

// Today's calories follow yesterday: what you ate over the target is taken off today (meals.carryOver).
// Left alone when you changed today yourself or today's last meal is eaten. The views call it on every
// render, so it follows when yesterday's log changes; it only saves when the value changes. Returns false
// if storage refused.
export function autoAdjust(todayIso, target) {
  const start = weekStart(todayIso);
  const idx = plan.dayIndex(start, todayIso);
  if (idx < 0 || idx > 6) return true;
  const week = weekMeals(start, target);
  const day = week.days[idx];
  if (meals.adjustByYou(day) || meals.dayOver(day)) return true;
  const prev = dayBefore(start, idx, week);
  const v = meals.carryOver(prev?.day, prev?.target, week.target);
  if (v === meals.adjustOf(day)) return true;
  const next = meals.setAdjust(week, idx, v, { auto: true });
  return !next || saveWeek(next);
}
