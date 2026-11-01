// The user's changes to the dish catalog: stored edits, own dishes and which dishes are shown.
// Storage shape: { items: { [id]: { slot, name, kcal, protein, ingredients } }, visible: { [id]: boolean } }.
import { get, setMany } from "./store.js";
import * as meals from "./meals.js";


export const init = () => meals.applyDishes(get("dishes"));

// Applies the change, re-fits planned days that use the changed dishes and stores both in one write.
// If storing fails the catalog goes back to what it was. `changed` is a set of dish ids.
function commit(next, changed) {
  const prev = get("dishes");
  meals.applyDishes(next);
  const planned = get("meals");
  const fields = { dishes: next };
  if (planned && changed.size) {
    fields.meals = Object.fromEntries(Object.entries(planned).map(([start, w]) => [start, meals.isWeek(w) ? meals.refitWeek(w, changed) : w]));
  }
  const ok = setMany(fields);
  if (!ok) meals.applyDishes(prev);
  return ok;
}

// New dish when `id` is null. Returns the id, or null if it could not be stored.
export function saveDish(id, slot, values) {
  const cur = get("dishes") ?? {};
  const dishId = id ?? `egen-${Date.now().toString(36)}`;
  const next = { ...cur, items: { ...cur.items, [dishId]: { slot, ...values } } };
  return commit(next, new Set([dishId])) ? dishId : null;
}

// Puts a built-in dish back the way it shipped.
export function resetDish(id) {
  const cur = get("dishes") ?? {};
  const { [id]: _gone, ...items } = cur.items ?? {};
  return commit({ ...cur, items }, new Set([id]));
}

export const canHide = (id) => {
  const d = meals.dishOf(id);
  return !!d && meals.isVisible(id) && meals.DISHES[d.slot].length > meals.minDishes(d.slot);
};

export function setVisible(id, show) {
  if (!show && !canHide(id)) return false;
  const cur = get("dishes") ?? {};
  return commit({ ...cur, visible: { ...cur.visible, [id]: show } }, new Set());
}
