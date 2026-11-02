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
      assert.notEqual(day.meals[1].dish, day.meals[3].dish, "lunch and dinner differ on the same day");
      if (d > 0) {
        assert.notEqual(day.meals[1].dish, week.days[d - 1].meals[1].dish, "lunch not repeated");
        assert.notEqual(day.meals[3].dish, week.days[d - 1].meals[3].dish, "dinner not repeated");
      }
      for (const m of day.meals) {
        const info = meals.mealInfo(m);
        assert.ok(m.portion > 0 && info.kcal > 0, "no negative or empty portions");
        assert.ok(meals.isVisible(m.dish), "generator only uses shown dishes");
        assert.ok(meals.fits(meals.dishOf(m.dish), m.slot), "dish fits its meal");
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

// Lunch and dinner share their dishes.
assert.ok(meals.DISHES.middag.some((d) => d.id === "lunch-kyckling"), "a lunch dish can be dinner");
assert.ok(meals.DISHES.lunch.some((d) => d.id === "middag-lax"), "a dinner dish can be lunch");
assert.ok(!meals.DISHES.lunch.some((d) => d.slot === "mellanmal"), "snacks stay snacks");
assert.equal(meals.allDishes("huvudratt").length, meals.allDishes("lunch").length, "the editor shows lunch and dinner together");

// Swapping a dish keeps the other days untouched and re-fits the day's portions.
const snapshot = JSON.stringify(a);
const refit = meals.changeDish(a, 2, "lunch", a.days[2].meals[1].dish);
assert.ok(meals.withinTarget(meals.dayTotals(refit.days[2]), a.target), "re-picking the same dish stays on target");
for (const slot of ["lunch", "mellanmal", "middag"]) {
  const idx = meals.SLOTS.findIndex((s) => s.id === slot);
  for (const option of meals.DISHES[slot]) {
    if (option.id === meals.otherMain(a.days[2], slot)) continue; // checked separately below
    const swapped = meals.changeDish(a, 2, slot, option.id);
    assert.equal(swapped.days[2].meals[idx].dish, option.id);
    assert.deepEqual(swapped.days.filter((_, i) => i !== 2), a.days.filter((_, i) => i !== 2));
    const t = meals.dayTotals(swapped.days[2]);
    assert.ok(t.kcal > 0 && swapped.days[2].meals.every((m) => m.portion > 0), `${slot} ${option.id}`);
  }
}
assert.ok(meals.changeDish(a, 2, "middag", "lunch-torsk"), "lunch dish as dinner");
assert.equal(meals.changeDish(a, 2, "mellanmal", "lunch-torsk"), null, "a main dish is not a snack");
assert.equal(JSON.stringify(a), snapshot, "changeDish does not mutate its input");
assert.equal(meals.changeDish(a, 2, "lunch", "finns-inte"), null);
assert.equal(meals.changeDish(a, 9, "lunch", meals.DISHES.lunch[0].id), null);

// "Ate something else": earlier meals stay, later meals are scaled, nothing goes negative.
const ate = meals.setCustom(a, 3, "lunch", { name: "Pizza", kcal: 800, protein: 30 });
const before = a.days[3].meals, after = ate.days[3].meals;
assert.equal(meals.mealInfo(after[1]).kcal, 800);
assert.equal(after[0].portion, before[0].portion, "breakfast already eaten, unchanged");
assert.ok(meals.withinTarget(meals.dayTotals(ate.days[3]), a.target) || after.slice(2).some((m) => m.portion !== before[after.indexOf(m)].portion), "the rest of the day is re-fitted");
assert.ok(Math.abs(meals.dayTotals(ate.days[3]).kcal - a.target.kcal) <= a.target.kcal * 0.1, "within ±10 % after an 800 kcal lunch");
assert.deepEqual(ate.days.filter((_, i) => i !== 3), a.days.filter((_, i) => i !== 3), "other days untouched");
const huge = meals.setCustom(a, 3, "lunch", { name: "", kcal: 3000, protein: 50 });
assert.ok(huge.days[3].meals.every((m) => m.portion > 0), "never negative portions");
assert.ok(!meals.withinTarget(meals.dayTotals(huge.days[3]), a.target), "3000 kcal can not be reached; the view says so");
const undone = meals.setCustom(ate, 3, "lunch", null);
assert.equal(undone.days[3].meals[1].custom, undefined);
assert.equal(undone.days[3].meals[1].dish, a.days[3].meals[1].dish, "undo puts the planned dish back");
assert.ok(meals.isWeek(ate));
assert.deepEqual(meals.validateCustom({ kcal: "800", protein: "30,4" }).values, { name: "", kcal: 800, protein: 30 });
assert.ok(meals.validateCustom({ kcal: "", protein: "1" }).errors.kcal);

// A new suggestion for the rest of the week keeps the earlier days.
const again = meals.regenerateFrom(ate, 4, 1);
assert.deepEqual(again.days.slice(0, 4), ate.days.slice(0, 4));
assert.notDeepEqual(again.days.slice(4), ate.days.slice(4));
assert.ok(again.days.slice(4).every((d) => meals.withinTarget(meals.dayTotals(d), a.target)));
assert.notEqual(again.days[4].meals[1].dish, again.days[3].meals[1].dish, "no repeat across the seam");

// A new suggestion never throws away what you typed under "ate something else".
const keepAte = meals.regenerateFrom(ate, 2, 5);
assert.deepEqual(keepAte.days[3], ate.days[3], "the day with something else eaten is kept");
assert.notDeepEqual(keepAte.days.slice(4), ate.days.slice(4));
assert.notEqual(meals.regenerateFrom(a, 0, 2, a.days[0].meals[2].dish).days[0].meals[2].dish, a.days[0].meals[2].dish, "Monday respects last week's snack");

// Lunch and dinner can't be the same dish on the same day, also when picked by hand.
assert.equal(meals.changeDish(a, 0, "middag", a.days[0].meals[1].dish), null);
assert.equal(meals.otherMain(a.days[0], "middag"), a.days[0].meals[1].dish);
assert.equal(meals.otherMain(a.days[0], "mellanmal"), null);
assert.equal(meals.categoryOf("Jordnötter rostade"), "Skafferi");
assert.equal(meals.categoryOf("Nöt färs 10%"), "Kött och fisk");
assert.equal(meals.categoryOf("Kikärter kokta"), "Skafferi");
assert.equal(meals.categoryOf("Ärter gröna"), "Frukt och grönt");

// A new target re-fits the portions; days that can't reach it with their dishes get new ones.
const sameDishes = (x, y) => JSON.stringify(x.meals.map((m) => m.dish)) === JSON.stringify(y.meals.map((m) => m.dish));
for (const dk of [-300, -150, 150, 300]) {
  const re = meals.retarget(a, { kcal: a.target.kcal + dk, protein: 170 });
  assert.ok(re.days.every((d) => meals.withinTarget(meals.dayTotals(d), re.target)), `retarget ${dk}`);
  if (Math.abs(dk) === 150) assert.ok(re.days.filter((d, i) => sameDishes(d, a.days[i])).length >= 5, "a weekly ±150 keeps most dishes");
}
const reAte = meals.retarget(ate, { kcal: a.target.kcal - 150, protein: 170 });
assert.equal(reAte.days[3].meals[1].custom.kcal, 800, "a day with something else eaten is never re-planned");

// --- Catalog: own dishes, edits, hiding ---
const ing = [["Kycklingfilé", 200, "g"], ["Mjölk", 1.5, "dl"], ["Ägg", 2, "st"]];
const ok = (raw, slot = "lunch") => meals.validateDish({ name: "Test", kcal: 500, protein: 40, fat: 20, carbs: 50, ingredients: ing, ...raw }, slot);
let v = ok({});
assert.deepEqual(v.errors, {});
assert.deepEqual(v.values.ingredients, [["Kycklingfilé", 200, "g", "Kött och fisk"], ["Mjölk", 1.5, "dl", "Mejeri och ägg"], ["Ägg", 2, "st", "Mejeri och ägg"]]);
assert.deepEqual(v.values.meals, ["lunch", "middag"], "a new main dish fits both");
assert.deepEqual(ok({ meals: ["middag"] }).values.meals, ["middag"]);
assert.equal(ok({}, "mellanmal").values.meals, undefined);
assert.equal(ok({ kcal: 500.4 }).values.kcal, 500);
for (const bad of [{ name: " " }, { kcal: 10 }, { kcal: 9000 }, { ingredients: [] }, { ingredients: [["Ris", 0, "g"]] }, { ingredients: [["Ris", NaN, "g"]] }]) {
  assert.notDeepEqual(ok(bad).errors, {}, JSON.stringify(bad));
}
assert.equal(meals.categoryOf("Kyckling bröstfilé rå"), "Kött och fisk");
assert.equal(meals.categoryOf("Potatis kokt"), "Frukt och grönt");
assert.equal(meals.defaultGrams({ kcal: 110, protein: 23, fat: 1, carbs: 0 }), 150);
assert.equal(meals.defaultGrams({ kcal: 350, protein: 12, fat: 2, carbs: 70 }), 70);

const own = { slot: "lunch", name: "Egen <b>lunch</b>", kcal: 600, protein: 45, fat: 10, carbs: 40, ingredients: [["Torsk", 200, "g", "Kött och fisk"]] };
meals.applyDishes({ items: { "egen-1": own, "egen-2": { ...own, meals: ["lunch"] }, "lunch-lax": { ...own, name: "Ny lax", kcal: 800 } }, visible: { "lunch-kyckling": false, "lunch-kalkon": true } });
assert.ok(meals.isVisible("egen-1") && meals.dishOf("egen-1").slot === "lunch", "own dish is offered");
assert.ok(meals.DISHES.middag.some((d) => d.id === "egen-1"), "own lunch dish is offered for dinner too");
assert.ok(meals.DISHES.lunch.some((d) => d.id === "egen-2") && !meals.DISHES.middag.some((d) => d.id === "egen-2"), "limited to lunch");
assert.equal(meals.dishOf("lunch-lax").name, "Ny lax", "edit replaces the built-in");
assert.equal(meals.dishOf("lunch-lax").kcal, 800);
assert.ok(!meals.isVisible("lunch-kyckling") && meals.dishOf("lunch-kyckling"), "hidden dish still resolves");
assert.ok(meals.isVisible("lunch-kalkon"), "turkey can be turned on");
assert.ok(!meals.DISHES.lunch.some((d) => d.id === "lunch-kyckling"));
const edited = meals.generateWeek("2026-03-02", targets[3]);
assert.ok(edited.days.every((d) => meals.isVisible(d.meals[1].dish) && meals.withinTarget(meals.dayTotals(d), targets[3])), "week from edited catalog");
assert.ok(edited.days.every((d) => d.meals[3].dish !== "egen-2"), "lunch-only dish never at dinner");

// A planned dish that is hidden afterwards keeps resolving, refitWeek follows an edit, replaceHidden swaps it out.
meals.applyDishes();
const planned = meals.generateWeek("2026-03-02", targets[3]);
const usedId = planned.days[0].meals[1].dish;
meals.applyDishes({ visible: { [usedId]: false } });
assert.ok(meals.mealInfo(planned.days[0].meals[1]).kcal > 0);
const swappedOut = meals.replaceHidden(planned, 2);
assert.ok(swappedOut.days.slice(2).every((d) => d.meals.every((m) => m.dish !== usedId)), "hidden dish replaced from day 2");
assert.deepEqual(swappedOut.days.slice(0, 2), planned.days.slice(0, 2), "earlier days untouched");
assert.ok(swappedOut.days.slice(2).every((d) => meals.withinTarget(meals.dayTotals(d), targets[3])));
meals.applyDishes({ items: { [usedId]: { ...meals.dishOf(usedId), kcal: meals.dishOf(usedId).kcal + 150 } } });
const refitted = meals.refitWeek(planned, new Set([usedId]));
assert.notStrictEqual(refitted, planned);
assert.deepEqual(refitted.days.filter((d) => !d.meals.some((m) => m.dish === usedId)), planned.days.filter((d) => !d.meals.some((m) => m.dish === usedId)), "unaffected days untouched");

// Two main dishes is enough to plan a full week (lunch and dinner then alternate).
meals.applyDishes({ visible: Object.fromEntries(meals.allDishes("huvudratt").slice(2).map((d) => [d.id, false])) });
assert.equal(meals.DISHES.middag.length, 2);
const lean = meals.generateWeek("2026-03-09", targets[3]);
assert.equal(lean.days.length, 7);
assert.ok(lean.days.every((d) => d.meals[1].dish !== d.meals[3].dish));

// Even a single dish on offer for a meal still gives a week (the rules give way).
meals.applyDishes({ items: { "egen-l": { ...own, meals: ["lunch"] } }, visible: Object.fromEntries(meals.allDishes("huvudratt").filter((d) => d.id !== "egen-l").slice(1).map((d) => [d.id, false])) });
assert.equal(meals.generateWeek("2026-03-16", targets[3]).days.length, 7);

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
meals.applyDishes({ items: { "egen-m": { ...own, meals: "trasig" } } });
assert.deepEqual(meals.dishOf("egen-m").meals, ["lunch", "middag"], "damaged meals list means both");
meals.applyDishes();
const unknown = { start: "2026-03-02", target: targets[3], days: [{ meals: [{ slot: "frukost", dish: "frukost", portion: 1 }, { slot: "lunch", dish: "borta", portion: 1 }, { slot: "mellanmal", dish: "snack-shake", portion: 1 }, { slot: "middag", dish: "middag-lax", portion: 1 }] }] };
assert.doesNotThrow(() => meals.refitWeek(unknown, new Set(["snack-shake"])), "unknown dish in a planned day");

// A week can be planned from damaged visibility flags.
meals.applyDishes({ visible: Object.fromEntries(["frukost", "huvudratt", "mellanmal"].flatMap((g) => meals.allDishes(g).map((d) => d.id)).map((id) => [id, false])) });
for (const slot of ["lunch", "mellanmal", "middag"]) assert.ok(meals.DISHES[slot].length >= 2, `${slot} keeps two dishes when every flag says hidden`);
assert.ok(meals.DISHES.frukost.length >= 1, "damaged flags still leave a breakfast");
assert.equal(meals.generateWeek("2026-04-13", targets[3]).days.length, 7);
meals.applyDishes();
// Damaged stored weeks are recognised.
assert.ok(meals.isWeek(a));
for (const bad of [null, {}, { ...a, days: a.days.slice(1) }, { ...a, target: null }, { ...a, days: a.days.map((d) => ({ meals: [] })) }, "x",
  { ...a, days: a.days.map((d) => ({ meals: d.meals.map((m) => ({ ...m, custom: { kcal: "x" } })) })) }]) assert.equal(meals.isWeek(bad), false);

const mealplan = await import("../js/mealplan.js");
assert.equal(mealplan.prevWeekStart("2026-04-06"), "2026-03-30");
assert.equal(mealplan.weekStart("2026-04-09"), "2026-04-06");
assert.equal(mealplan.weekMeals("2026-04-06", targets[3]).days.length, 7, "a week is built even when it cannot be stored");
assert.equal(mealplan.saveWeek(a), false, "no storage in Node");

// Storage layer. There is no localStorage in Node, so every write fails: the catalog must roll back.
const dishes = await import("../js/dishes.js");
const shownLunch = meals.DISHES.lunch.length;
assert.equal(dishes.saveDish(null, "lunch", ok({}).values), null);
assert.equal(meals.DISHES.lunch.length, shownLunch);
assert.ok(!meals.allDishes("huvudratt").some((d) => d.id.startsWith("egen-")), "failed save leaves no own dish behind");
assert.equal(dishes.setVisible("lunch-torsk", false), false);
assert.ok(meals.isVisible("lunch-torsk"), "failed hide is rolled back");
assert.equal(dishes.canHide("frukost"), false, "the only breakfast cannot be hidden");
meals.applyDishes({ items: { "egen-f": { slot: "frukost", name: "Gröt", kcal: 400, protein: 20, fat: 8, carbs: 60, ingredients: [["Havregryn", 80, "g", "Bröd och spannmål"]] } } });
assert.equal(meals.DISHES.frukost.length, 2, "own breakfast is offered");
assert.equal(dishes.canHide("frukost"), true, "with two breakfasts one can go");
const twoBreakfasts = meals.generateWeek("2026-05-04", targets[3]);
assert.ok(twoBreakfasts.days.every((d) => d.meals[0].slot === "frukost" && meals.isVisible(d.meals[0].dish)));
const swapped = meals.changeDish(twoBreakfasts, 1, "frukost", "egen-f");
assert.equal(swapped.days[1].meals[0].dish, "egen-f");
meals.applyDishes();
assert.equal(dishes.canHide("lunch-torsk"), true);
meals.applyDishes({ visible: Object.fromEntries(meals.allDishes("huvudratt").slice(2).map((d) => [d.id, false])) });
assert.equal(dishes.canHide(meals.DISHES.lunch[0].id), false, "two shown dishes must stay");
meals.applyDishes();
console.log("ok");
