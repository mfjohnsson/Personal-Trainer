// Checks the weekly meal plan against js/meals.js. Run: node tools/meals-test.mjs
import assert from "node:assert/strict";
import * as meals from "../js/meals.js";
import * as calc from "../js/calc.js";

const mart = calc.calorieTarget({ age: 35, heightCm: 170, weightKg: 82.5 });
const targets = [1700, 1900, 2100, Math.round(mart), 2400].map((kcal) => ({ kcal, protein: calc.PROTEIN_G }));
const starts = ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26", "2026-02-02"];
let worstK = 0, worstP = 0, failed = 0;

for (const target of targets) {
  let prevSnack = null;
  for (const start of starts) {
    const week = meals.generateWeek(start, target, prevSnack);
    assert.equal(week.days.length, 7);
    let last = prevSnack;
    week.days.forEach((day, d) => {
      assert.deepEqual(day.meals.map((m) => m.slot), meals.SLOTS.map((s) => s.id), "locked structure");
      const t = meals.dayTotals(day);
      worstK = Math.max(worstK, Math.abs(t.kcal - target.kcal) / target.kcal);
      worstP = Math.max(worstP, Math.abs(t.protein - target.protein));
      if (!meals.withinTarget(t, target)) { failed++; console.log("OUT", target.kcal, start, d, t); }
      const snack = day.meals[2].dish;
      assert.notEqual(snack, last, `snack repeated ${start} day ${d}`);
      last = snack;
      for (const m of day.meals) {
        const info = meals.mealInfo(m);
        assert.ok(m.portion > 0 && info.kcal > 0, "no negative or empty portions");
        assert.ok(meals.isVisible(m.dish), "generator only uses shown dishes");
        assert.ok(info.ingredients.every((i) => i.amount > 0), "no empty amounts");
      }
    });
    prevSnack = last;
  }
}
console.log(`mart target ${Math.round(mart)} kcal; worst kcal error ${(worstK * 100).toFixed(1)} %, worst protein error ${worstP} g, days out of tolerance: ${failed}`);
assert.equal(failed, 0);

// Same inputs give the same week; another week differs.
const a = meals.generateWeek("2026-01-05", targets[3]), b = meals.generateWeek("2026-01-05", targets[3]), c = meals.generateWeek("2026-01-12", targets[3]);
assert.deepEqual(a, b);
assert.notDeepEqual(a.days, c.days);
const everyDish = Object.values(meals.DISHES).flat();
assert.ok(!everyDish.some((d) => /kalkon/i.test(d.name)), "turkey is off by default");
assert.ok(meals.dishOf("lunch-kalkon") && !meals.isVisible("lunch-kalkon"), "turkey still resolves for old plans");
for (const id of ["lunch-makrill", "middag-makrill", "lunch-bonchili", "middag-bonor"]) assert.ok(meals.isVisible(id), id);
// Swapping a dish keeps the other days untouched and re-fits the day's portions.
const snapshot = JSON.stringify(a);
const refit = meals.changeDish(a, 2, "lunch", a.days[2].meals[1].dish);
assert.ok(meals.withinTarget(meals.dayTotals(refit.days[2]), a.target), "re-picking the same dish stays on target");
for (const slot of ["lunch", "mellanmal", "middag"]) {
  const idx = meals.SLOTS.findIndex((s) => s.id === slot);
  for (const option of meals.DISHES[slot]) {
    const swapped = meals.changeDish(a, 2, slot, option.id);
    assert.equal(swapped.days[2].meals[idx].dish, option.id);
    assert.deepEqual(swapped.days.filter((_, i) => i !== 2), a.days.filter((_, i) => i !== 2));
    const t = meals.dayTotals(swapped.days[2]);
    assert.ok(t.kcal > 0 && swapped.days[2].meals.every((m) => m.portion > 0), `${slot} ${option.id}`);
  }
}
assert.equal(JSON.stringify(a), snapshot, "changeDish does not mutate its input");
assert.equal(meals.changeDish(a, 2, "lunch", "finns-inte"), null);
assert.equal(meals.changeDish(a, 9, "lunch", meals.DISHES.lunch[0].id), null);

// --- Catalog: own dishes, edits, hiding ---
const ok = (raw) => meals.validateDish({ name: "Test", kcal: "500", protein: "40", fat: "20", carbs: "50", ingredients: "200 g Kycklingfilé\n1,5 dl Mjölk\n2 st Ägg", ...raw });
let v = ok({});
assert.deepEqual(v.errors, {});
assert.deepEqual(v.values.ingredients, [["Kycklingfilé", 200, "g", "Kött och fisk"], ["Mjölk", 1.5, "dl", "Mejeri och ägg"], ["Ägg", 2, "st", "Mejeri och ägg"]]);
assert.equal(meals.formatIngredients(v.values.ingredients), "200 g Kycklingfilé\n1,5 dl Mjölk\n2 st Ägg");
assert.equal(ok({ kcal: "500,4" }).values.kcal, 500);
for (const bad of [{ name: " " }, { kcal: "" }, { kcal: "abc" }, { kcal: "10" }, { protein: "" }, { protein: "-1" }, { fat: "" }, { carbs: "-5" }, { ingredients: "" }, { ingredients: "kyckling" }, { ingredients: "0 g Ris" }, { ingredients: "200 liter Mjölk" }]) {
  assert.notDeepEqual(ok(bad).errors, {}, JSON.stringify(bad));
}

const own = { slot: "lunch", name: "Egen <b>lunch</b>", kcal: 600, protein: 45, fat: 10, carbs: 40, ingredients: [["Torsk", 200, "g", "Kött och fisk"]] };
meals.applyDishes({ items: { "egen-1": own, "lunch-lax": { ...own, name: "Ny lax", kcal: 800 } }, visible: { "lunch-kyckling": false, "lunch-kalkon": true } });
assert.ok(meals.isVisible("egen-1") && meals.dishOf("egen-1").slot === "lunch", "own dish is offered");
assert.equal(meals.dishOf("lunch-lax").name, "Ny lax", "edit replaces the built-in");
assert.equal(meals.dishOf("lunch-lax").kcal, 800);
assert.ok(!meals.isVisible("lunch-kyckling") && meals.dishOf("lunch-kyckling"), "hidden dish still resolves");
assert.ok(meals.isVisible("lunch-kalkon"), "turkey can be turned on");
assert.ok(!meals.DISHES.lunch.some((d) => d.id === "lunch-kyckling"));
const edited = meals.generateWeek("2026-03-02", targets[3]);
assert.ok(edited.days.every((d) => meals.isVisible(d.meals[1].dish) && meals.withinTarget(meals.dayTotals(d), targets[3])), "week from edited catalog");

// A planned dish that is hidden afterwards keeps resolving, and refitWeek follows an edit.
const planned = meals.generateWeek("2026-03-02", targets[3]);
const usedId = planned.days[0].meals[1].dish;
meals.applyDishes({ visible: { [usedId]: false } });
assert.ok(meals.mealInfo(planned.days[0].meals[1]).kcal > 0);
meals.applyDishes({ items: { [usedId]: { ...meals.dishOf(usedId), kcal: meals.dishOf(usedId).kcal + 150 } } });
const refitted = meals.refitWeek(planned, new Set([usedId]));
assert.notStrictEqual(refitted, planned);
assert.deepEqual(refitted.days.filter((d) => !d.meals.some((m) => m.dish === usedId)), planned.days.filter((d) => !d.meals.some((m) => m.dish === usedId)), "unaffected days untouched");

// Two dishes left in a slot is enough to plan a full week.
meals.applyDishes({ visible: Object.fromEntries(meals.allDishes("middag").slice(2).map((d) => [d.id, false])) });
assert.equal(meals.DISHES.middag.length, 2);
const lean = meals.generateWeek("2026-03-09", targets[3]);
assert.equal(lean.days.length, 7);
for (let i = 1; i < 7; i++) assert.notEqual(lean.days[i].meals[3].dish, lean.days[i - 1].meals[3].dish, "dinner not repeated");

meals.applyDishes();
assert.equal(meals.isVisible("egen-1"), false);

// Damaged stored data is ignored instead of breaking the catalog.
const builtInCount = meals.DISHES.lunch.length;
for (const bad of [null, "x", 5, [], { items: null }, { items: { "lunch-torsk": true, "egen-x": { name: "x" }, "egen-y": { slot: "nope", name: "y", kcal: 1, protein: 1, ingredients: [["a", 1, "g"]] }, "egen-z": { slot: "lunch", name: "z", kcal: NaN, protein: 1, ingredients: [["a", 1, "g"]] } }, visible: 3 }]) {
  meals.applyDishes(bad);
  assert.equal(meals.DISHES.lunch.length, builtInCount, JSON.stringify(bad));
  assert.ok(!meals.dishOf("egen-x") && !meals.dishOf("egen-y") && !meals.dishOf("egen-z"));
  assert.equal(meals.dishOf("lunch-torsk").kcal, meals.baseDish("lunch-torsk").kcal);
}
// Stored dishes from before fat and carbs existed are dropped, not shown with made-up zeros.
meals.applyDishes({ items: { "egen-old": { slot: "lunch", name: "Gammal", kcal: 500, protein: 40, ingredients: [["Torsk", 200, "g", "Kött och fisk"]] } } });
assert.ok(!meals.dishOf("egen-old"));
meals.applyDishes();
const unknown = { start: "2026-03-02", target: targets[3], days: [{ meals: [{ slot: "frukost", dish: "frukost", portion: 1 }, { slot: "lunch", dish: "borta", portion: 1 }, { slot: "mellanmal", dish: "snack-shake", portion: 1 }, { slot: "middag", dish: "middag-lax", portion: 1 }] }] };
assert.doesNotThrow(() => meals.refitWeek(unknown, new Set(["snack-shake"])), "unknown dish in a planned day");

// Week menu: dishes left out of a week are not planned, new dishes are on by default.
const lunches = meals.DISHES.lunch.map((d) => d.id);
const off = lunches.slice(2);
const pool = meals.poolFor(off);
assert.deepEqual(pool.lunch.map((d) => d.id), lunches.slice(0, 2));
assert.equal(pool.middag.length, meals.DISHES.middag.length, "other meals untouched");
const menuWeek = meals.generateWeek("2026-04-06", targets[3], null, pool);
assert.ok(menuWeek.days.every((d) => lunches.slice(0, 2).includes(d.meals[1].dish)), "only menu lunches planned");
for (let i = 1; i < 7; i++) assert.notEqual(menuWeek.days[i].meals[1].dish, menuWeek.days[i - 1].meals[1].dish, "lunch not repeated with two on the menu");
const topped = meals.poolFor(lunches.slice(1)).lunch.map((d) => d.id);
assert.deepEqual(topped, lunches.slice(0, 2), "fewer than two left: the first left-out dish is put back");
assert.deepEqual(meals.poolFor(lunches).lunch.map((d) => d.id), lunches.slice(0, 2), "everything left out still leaves two");
for (const slot of ["lunch", "mellanmal", "middag"]) assert.ok(meals.poolFor(meals.DISHES[slot].map((d) => d.id))[slot].length >= 2);
// A week can be planned from the smallest pool, and from damaged visibility flags.
const all = (slot) => meals.allDishes(slot).map((d) => d.id);
meals.applyDishes({ visible: Object.fromEntries(["lunch", "mellanmal", "middag"].flatMap(all).map((id) => [id, false])) });
for (const slot of ["lunch", "mellanmal", "middag"]) assert.ok(meals.DISHES[slot].length >= 2, `${slot} keeps two dishes when every flag says hidden`);
assert.equal(meals.generateWeek("2026-04-13", targets[3]).days.length, 7);
meals.applyDishes();
// Damaged stored weeks are recognised.
assert.ok(meals.isWeek(a));
for (const bad of [null, {}, { ...a, days: a.days.slice(1) }, { ...a, target: null }, { ...a, days: a.days.map((d) => ({ meals: [] })) }, "x"]) assert.equal(meals.isWeek(bad), false);
assert.deepEqual(meals.poolFor(["finns-inte", 5]).lunch.map((d) => d.id), lunches, "unknown ids ignored");
assert.deepEqual(meals.poolFor().frukost.map((d) => d.id), ["frukost"]);
const mealplan = await import("../js/mealplan.js");
assert.deepEqual(mealplan.offOf("2026-04-06"), []);
assert.equal(mealplan.prevWeekStart("2026-04-06"), "2026-03-30");
assert.equal(mealplan.weekStart("2026-04-09"), "2026-04-06");
assert.equal(mealplan.weekMeals("2026-04-06", targets[3]).days.length, 7, "a week is built even when it cannot be stored");
assert.equal(mealplan.setOff("2026-04-06", ["x"]), false, "no storage in Node");

// Storage layer. There is no localStorage in Node, so every write fails: the catalog must roll back.
const dishes = await import("../js/dishes.js");
assert.equal(dishes.saveDish(null, "lunch", ok({}).values), null);
assert.equal(meals.allDishes("lunch").length, builtInCount + 0 + meals.allDishes("lunch").filter((d) => !meals.isVisible(d.id)).length);
assert.ok(!meals.allDishes("lunch").some((d) => d.id.startsWith("egen-")), "failed save leaves no own dish behind");
assert.equal(dishes.setVisible("lunch-torsk", false), false);
assert.ok(meals.isVisible("lunch-torsk"), "failed hide is rolled back");
assert.equal(dishes.canHide("frukost"), false, "the only breakfast cannot be hidden");
meals.applyDishes({ items: { "egen-f": { slot: "frukost", name: "Gröt", kcal: 400, protein: 20, fat: 8, carbs: 60, ingredients: [["Havregryn", 80, "g", "Bröd och spannmål"]] } } });
assert.equal(meals.DISHES.frukost.length, 2, "own breakfast is offered");
assert.equal(dishes.canHide("frukost"), true, "with two breakfasts one can go");
assert.equal(dishes.canHide("egen-f"), true);
const twoBreakfasts = meals.generateWeek("2026-05-04", targets[3]);
assert.ok(twoBreakfasts.days.every((d) => d.meals[0].slot === "frukost" && meals.isVisible(d.meals[0].dish)));
assert.ok(new Set(twoBreakfasts.days.map((d) => d.meals[0].dish)).size >= 1);
const oneBreakfast = meals.generateWeek("2026-05-04", targets[3], null, meals.poolFor(["frukost"]));
assert.ok(oneBreakfast.days.every((d) => d.meals[0].dish === "egen-f"), "breakfast left out of the menu is not planned");
assert.deepEqual(meals.poolFor(["frukost", "egen-f"]).frukost.map((d) => d.id), ["frukost"], "never fewer than one breakfast");
const swapped = meals.changeDish(twoBreakfasts, 1, "frukost", "egen-f");
assert.equal(swapped.days[1].meals[0].dish, "egen-f");
meals.applyDishes({ visible: { frukost: false } });
assert.ok(meals.DISHES.frukost.length >= 1, "damaged flags still leave a breakfast");
meals.applyDishes();
assert.equal(dishes.canHide("lunch-torsk"), true);
meals.applyDishes({ visible: Object.fromEntries(meals.allDishes("lunch").slice(2).map((d) => [d.id, false])) });
assert.equal(dishes.canHide(meals.DISHES.lunch[0].id), false, "two shown dishes must stay");
meals.applyDishes();
console.log("ok");
