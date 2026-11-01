// The stored meal week and the week's menu (the dishes the user ticked off for that week).
// Storage: meals = { [monday]: week }, menu = { [monday]: [ids of dishes left out that week] }.
import { get, set } from "./store.js";
import * as calc from "./calc.js";
import * as plan from "./plan.js";
import * as meals from "./meals.js";

const KEEP_MENUS = 12; // older weeks are dropped so the stored menu stays small

const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);

export function currentTarget() {
  const stored = get("profile");
  if (!stored) return null;
  const { values, errors } = calc.validate(stored);
  if (Object.keys(errors).length) return null;
  return { kcal: Math.round(calc.calorieTarget(values)), protein: calc.PROTEIN_G };
}

export const weekStart = (todayIso) => plan.mondayOf(plan.parseIso(todayIso));

export function prevWeekStart(start) {
  const d = plan.parseIso(start);
  d.setDate(d.getDate() - 7);
  return plan.isoDate(d);
}

// Ids of dishes left out of the week's menu. A week nobody touched has everything on its menu,
// so a dish added later is on the menu too.
export function offOf(start) {
  const menu = get("menu");
  const v = isObject(menu) ? menu[start] : undefined;
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

export const poolOf = (start) => meals.poolFor(offOf(start));

export function setOff(start, off) {
  const menu = isObject(get("menu")) ? get("menu") : {};
  const next = { ...menu, [start]: off };
  const keep = Object.keys(next).sort().slice(-KEEP_MENUS);
  return set("menu", Object.fromEntries(keep.map((k) => [k, next[k]])));
}

// The stored week is reused while the target is unchanged and every dish still resolves; a new
// profile, a new week or `force` builds it again from the week's menu.
export function weekMeals(start, target, force = false) {
  const all = isObject(get("meals")) ? get("meals") : {};
  const cur = all[start];
  const resolvable = meals.isWeek(cur) && cur.days.every((day) => day.meals.every((m) => meals.dishOf(m.dish)));
  if (!force && resolvable && cur.target.kcal === target.kcal && cur.target.protein === target.protein) return cur;
  const prevStart = prevWeekStart(start);
  // Last week may never have been opened; rebuild it so the snack rule still holds across the boundary.
  const prev = meals.isWeek(all[prevStart]) ? all[prevStart] : meals.generateWeek(prevStart, target, null, poolOf(prevStart));
  const week = meals.generateWeek(start, target, prev.days.at(-1).meals[2].dish, poolOf(start));
  set("meals", { ...all, [start]: week });
  return week;
}
