// The user's changes to the dish catalog: stored edits, own dishes and which dishes are shown.
// Storage shape: { items: { [id]: { slot, name, kcal, protein, fat, carbs, ingredients, meals? } }, visible: { [id]: boolean } }.
import { get, setMany } from "./store.js";
import * as meals from "./meals.js";


export const init = () => meals.applyDishes(get("dishes"));

const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);

// Applies the change, updates planned weeks and stores both in one write. If storing fails the catalog
// goes back to what it was. `changed` is a set of dish ids whose days are re-fitted; `replace`
// ({ start, from }) swaps dishes that are no longer on offer out of that week from day `from` on.
function commit(next, changed, replace) {
  const prev = get("dishes");
  meals.applyDishes(next);
  const planned = isObject(get("meals")) ? get("meals") : null;
  const fields = { dishes: next };
  if (planned) {
    let all = planned;
    if (changed.size) all = Object.fromEntries(Object.entries(all).map(([start, w]) => [start, meals.isWeek(w) ? meals.refitWeek(w, changed) : w]));
    if (replace && meals.isWeek(all[replace.start])) all = { ...all, [replace.start]: meals.replaceHidden(all[replace.start], replace.from) };
    if (all !== planned) fields.meals = all;
  }
  const ok = setMany(fields);
  if (!ok) meals.applyDishes(prev);
  return ok;
}

// New dish when `id` is null. Returns the id, or null if it could not be stored. `replace` as in commit:
// a main dish limited to lunch may leave a dinner that no longer fits.
export function saveDish(id, slot, values, replace) {
  const cur = get("dishes") ?? {};
  const dishId = id ?? `egen-${Date.now().toString(36)}`;
  const next = { ...cur, items: { ...cur.items, [dishId]: { slot, ...values } } };
  return commit(next, new Set([dishId]), replace) ? dishId : null;
}

// Puts a built-in dish back the way it shipped.
export function resetDish(id, replace) {
  const cur = get("dishes") ?? {};
  const { [id]: _gone, ...items } = cur.items ?? {};
  return commit({ ...cur, items }, new Set([id]), replace);
}

// A dish can be hidden while every meal it is offered for keeps enough dishes.
export const canHide = (id) => {
  const d = meals.dishOf(id);
  return !!d && meals.isVisible(id) && d.meals.every((slot) => meals.DISHES[slot].length > meals.minDishes(slot));
};

export function setVisible(id, show, replace) {
  if (!show && !canHide(id)) return false;
  const cur = get("dishes") ?? {};
  return commit({ ...cur, visible: { ...cur.visible, [id]: show } }, new Set(), replace);
}
