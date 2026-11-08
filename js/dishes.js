// The user's changes to the dish catalog: stored edits, own dishes and which dishes are used.
// Storage shape: { items: { [id]: { slot, name, kcal, protein, fat, carbs, ingredients, meals?, kind? } },
//   visible: { [id]: boolean }, deleted?: { [id]: item }, topup?: id, topup2?: id }.
// Older data has `removed: { [id]: true }`; such dishes are simply switched off (see init).
import { get, setMany } from "./store.js";
import * as meals from "./meals.js";
import * as foods from "./foods.js";

const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);

// Applies the stored catalog. With the food database loaded each ingredient is classed as protein or side.
export function init() {
  meals.setAnalyzer(foods.isLoaded() ? foods.macrosOf : null);
  const cur = get("dishes");
  // "Borttagna" and "avstängda" are one thing now: switched off. Moved once, in memory and storage.
  if (isObject(cur) && isObject(cur.removed) && Object.keys(cur.removed).length) {
    const visible = { ...(isObject(cur.visible) ? cur.visible : {}) };
    for (const [id, v] of Object.entries(cur.removed)) if (v === true) visible[id] = false;
    const { removed: _r, ...rest } = cur;
    setMany({ dishes: { ...rest, visible } }); // if refused, the overlay still reads `removed` as off
    meals.applyDishes(get("dishes"));
    return;
  }
  meals.applyDishes(cur);
}

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
    if (changed.size) all = Object.fromEntries(Object.entries(all).map(([start, w]) => [start, meals.isWeek(w) && meals.resolves(w) ? meals.refitWeek(w, changed) : w]));
    if (replace && meals.isWeek(all[replace.start])) all = { ...all, [replace.start]: meals.replaceHidden(all[replace.start], replace.from) };
    if (all !== planned) fields.meals = all;
  }
  const ok = setMany(fields);
  if (!ok) meals.applyDishes(prev);
  return ok;
}

// New dish when `id` is null. Returns the id, or null if it could not be stored.
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

// A dish can be switched off while every meal it is offered for keeps enough dishes, and it is not the
// first protein top-up (pick another first).
export const offBlock = (id) => {
  const d = meals.dishOf(id);
  if (!d) return "Rätten finns inte.";
  if (id === meals.topupId()) return "Det är den första proteinpåfyllningen. Välj en annan först.";
  if (meals.isVisible(id) && !d.meals.every((slot) => meals.DISHES[slot].length > meals.minDishes(slot))) {
    return `Minst ${meals.minDishes(d.slot)} rätter behövs här.`;
  }
  return null;
};
export const canHide = (id) => !offBlock(id);

// The protein top-ups (protein-rich ones); every planned day is re-fitted with them.
export function setTopup(id, which = "topup") {
  const none = which === "topup2" && id === "none";
  if (!none && !meals.isTopupCandidate(meals.dishOf(id))) return false;
  if (which === "topup2" && id === meals.topupId()) return false;
  const cur = get("dishes") ?? {};
  return commit({ ...cur, [which]: id }, new Set(none ? [] : [id]));
}

export function setVisible(id, show, replace) {
  if (!show && !canHide(id)) return false;
  const cur = get("dishes") ?? {};
  return commit({ ...cur, visible: { ...cur.visible, [id]: show } }, new Set(), replace);
}

// Deletes a dish of your own: gone from every list and never planned again. Its data is kept out of
// sight so days already planned with it still show it (and so Ångra can bring it back).
export function deleteDish(id, replace) {
  const cur = get("dishes") ?? {};
  const item = cur.items?.[id];
  if (meals.isBuiltIn(id) || !item || offBlock(id)) return false;
  const { [id]: _gone, ...items } = cur.items;
  return commit({ ...cur, items, deleted: { ...cur.deleted, [id]: item } }, new Set(), replace);
}

// Undoes deleteDish.
export function undeleteDish(id) {
  const cur = get("dishes") ?? {};
  const item = cur.deleted?.[id];
  if (!item) return false;
  const { [id]: _gone, ...deleted } = cur.deleted;
  return commit({ ...cur, deleted, items: { ...cur.items, [id]: item } }, new Set([id]));
}
