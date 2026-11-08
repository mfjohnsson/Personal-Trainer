// The stored meal week. Storage: meals = { [monday]: week }.
import { get, set } from "./store.js";
import * as plan from "./plan.js";
import * as meals from "./meals.js";
import * as checkin from "./checkin.js";
import * as clock from "./clock.js";

// Tells the planner what time it is: meals whose time has passed count as eaten as planned.
export function tick() {
  const n = clock.now();
  meals.setNow(clock.todayIso(), n.getHours() * 60 + n.getMinutes());
}

const KEEP_WEEKS = 12; // older weeks are dropped so storage stays small

const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);

export const currentTarget = checkin.currentTarget;

export const weekStart = (todayIso) => plan.mondayOf(plan.parseIso(todayIso));

export function prevWeekStart(start) {
  const d = plan.parseIso(start);
  d.setDate(d.getDate() - 7);
  return plan.isoDate(d);
}

export function nextWeekStart(start) {
  const d = plan.parseIso(start);
  d.setDate(d.getDate() + 7);
  return plan.isoDate(d);
}

const allWeeks = () => (isObject(get("meals")) ? get("meals") : {});

// Last week's result (meals.weekResult), or null when it was never planned or no longer resolves.
export function lastWeekResult(start) {
  const prev = allWeeks()[prevWeekStart(start)];
  if (!meals.isWeek(prev) || !meals.resolves(prev)) return null;
  return meals.weekResult(prev, 7);
}

// Stores one week; old weeks beyond KEEP_WEEKS are dropped. Returns false if storage refused.
export function saveWeek(week) {
  const next = { ...allWeeks(), [week.start]: week };
  const keep = Object.keys(next).sort().slice(-KEEP_WEEKS);
  return set("meals", Object.fromEntries(keep.map((k) => [k, next[k]])));
}

// The stored week is reused while every dish still resolves. A new target (weigh-in or profile) keeps the
// dishes and re-fits the amounts. A week stored by an older planner (four meals) keeps the days that are
// over and plans the rest again with three meals. A week that can't be read is planned from scratch.
export function weekMeals(start, target) {
  const cur = allWeeks()[start];
  const usable = meals.isWeek(cur) && meals.resolves(cur);
  if (usable && cur.v === meals.PLAN_VERSION && cur.target.kcal === target.kcal && cur.target.protein === target.protein) return cur;
  const week = !usable ? meals.generateWeek(start, target)
    : cur.v === meals.PLAN_VERSION ? meals.retarget(cur, target)
      : meals.migrateWeek(cur, target);
  // Without the food database (it failed to load) dishes are not split into protein and sides; such a plan
  // is shown but not stored, so it is made properly once the database is there.
  if (meals.hasAnalyzer()) saveWeek(week);
  return week;
}

// The week evens out: what you ate over the target on earlier days is spread over the days left
// (meals.balanceOf). Days you changed yourself and days already eaten are left alone. The views call it
// on every render, so it follows when you log something; it only saves when a value changes. Returns
// false if storage refused.
export function autoAdjust(todayIso, target) {
  const start = weekStart(todayIso);
  const idx = plan.dayIndex(start, todayIso);
  if (idx < 0 || idx > 6) return true;
  const week = weekMeals(start, target);
  const { take, days } = meals.balanceOf(week, idx);
  let next = week;
  for (const d of days) {
    const day = next.days[d];
    if (meals.adjustOf(day) === take && (take === 0 || day.adjustAuto)) continue;
    next = meals.setAdjust(next, d, take, { auto: true }) ?? next;
  }
  return next === week || saveWeek(next);
}

// The week's balance for the views (see meals.balanceOf), for the current week only.
export function balance(todayIso, target) {
  const start = weekStart(todayIso);
  const idx = plan.dayIndex(start, todayIso);
  return idx < 0 || idx > 6 ? null : meals.balanceOf(weekMeals(start, target), idx);
}
