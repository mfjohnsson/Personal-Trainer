// Checks the weekly meal plan against js/meals.js. Run: node tools/meals-test.mjs
import assert from "node:assert/strict";
import * as meals from "../js/meals.js";
import * as calc from "../js/calc.js";

const mart = calc.calorieTarget({ age: 35, heightCm: 170, weightKg: 82.5 });
const targets = [1700, 1900, 2100, Math.round(mart), 2400].map((kcal) => ({ kcal, protein: calc.PROTEIN_G }));
const starts = ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26", "2026-02-02"];
const LEGUME = /böna|bönor|linser|ärt|kikärt|hummus|soja/i;
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
        assert.ok(info.ingredients.every((i) => i.amount > 0 && !LEGUME.test(i.name)), "no legumes");
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
for (const d of Object.values(meals.DISHES).flat()) assert.ok(!LEGUME.test([d.name, ...d.ingredients.map((i) => i[0])].join(" | ")), d.id);
console.log("ok");
