// Checks the weekly meal plan against js/meals.js. Run: node tools/meals-test.mjs
import assert from "node:assert/strict";
import * as meals from "../js/meals.js";
import * as calc from "../js/calc.js";

const mart = calc.calorieTarget({ age: 35, heightCm: 170, weightKg: 82.5 });
const targets = [1700, 1900, 2100, Math.round(mart), 2400].map((kcal) => ({ kcal, protein: calc.PROTEIN_G }));
const starts = ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26", "2026-02-02"];
let worstK = 0, worstP = 0, failed = 0, biggest = 0;

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
      if (day.extra) assert.ok(day.extra.dish === meals.topupId() && day.extra.portion >= 0.5 && day.extra.portion <= 3, "top-up shape");
      biggest = Math.max(biggest, ...day.meals.map((m) => m.portion));
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
console.log(`mart target ${Math.round(mart)} kcal; worst kcal error ${(worstK * 100).toFixed(1)} %, worst protein error ${worstP} g, days out of tolerance: ${failed}, biggest portion ${biggest.toFixed(2)}`);
assert.equal(failed, 0);
assert.ok(biggest <= 1.35, `meals stay near a normal portion (biggest ${biggest})`);

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

// "Ate less": a share of the planned snack. It is locked, the meals before it too; the dinner after it grows.
const half = meals.setAte(a, 3, "mellanmal", 0.5);
const hm = half.days[3].meals, am = a.days[3].meals;
assert.equal(hm[2].ate, 0.5);
assert.equal(hm[2].portion, am[2].portion, "the planned portion is kept, the share is on top");
assert.equal(meals.mealInfo(hm[2]).kcal, Math.round(meals.dishOf(am[2].dish).kcal * am[2].portion * 0.5));
assert.equal(hm[0].portion, am[0].portion);
assert.equal(hm[1].portion, am[1].portion, "lunch is before the snack, already eaten");
assert.ok(hm[3].portion > am[3].portion, "dinner makes up for the smaller snack");
assert.ok(meals.isWeek(half));
assert.equal(meals.setAte(a, 3, "mellanmal", 0.3), null, "only steps of a quarter");
assert.equal(meals.setAte(a, 3, "mellanmal", 2.25), null, "at most twice the portion");
// "✓ Ätit": eaten as planned locks the meal (and the ones before it) at its portion.
const done = meals.setAte(a, 3, "lunch", 1);
assert.equal(meals.mealInfo(done.days[3].meals[1]).kcal, meals.mealInfo(a.days[3].meals[1]).kcal);
assert.ok(meals.isLogged(done.days[3].meals[1]) && meals.isWeek(done));
// After an off-plan dinner, the snack can still be corrected: the day just ends lower.
const night = meals.setCustom(a, 3, "middag", { name: "Burgare", kcal: 1500, protein: 35 });
const corrected = meals.setAte(night, 3, "mellanmal", 0.5);
assert.equal(corrected.days[3].meals[3].custom.kcal, 1500, "dinner kept");
assert.deepEqual(corrected.days[3].meals.map((m) => m.portion), night.days[3].meals.map((m) => m.portion), "everything is eaten, no portion moves");
assert.deepEqual(corrected.days[3].extra, night.days[3].extra, "the day is over: no top-up added or resized afterwards");
assert.equal(meals.dayTotals(corrected.days[3]).kcal, meals.dayTotals(night.days[3]).kcal - (meals.mealInfo(night.days[3].meals[2]).kcal - meals.mealInfo(corrected.days[3].meals[2]).kcal));
const none = meals.setAte(night, 3, "mellanmal", 0);
assert.equal(meals.mealInfo(none.days[3].meals[2]).kcal, 0);
assert.ok(meals.mealInfo(none.days[3].meals[2]).ingredients.every((i) => i.amount === 0), "nothing eaten, no pieces either");
assert.equal(meals.setAte(half, 3, "mellanmal", null).days[3].meals[2].ate, undefined, "back to as planned");
assert.equal(meals.setAte(night, 3, "middag", 0.5), null, "something else can not be halved");
assert.equal(meals.setCustom(half, 3, "mellanmal", { name: "", kcal: 100, protein: 5 }).days[3].meals[2].ate, undefined, "something else replaces a share");
assert.ok(meals.regenerateFrom(half, 3, 7).days[3] === half.days[3], "a day with a share is not re-planned");

// Calories down for one day, protein kept: dishes are picked again when nothing is eaten.
for (const kcal of [-250, -500, -1000]) {
  const less = meals.setAdjust(a, 4, kcal);
  const goal = meals.dayTarget(less.days[4], a.target);
  const got = meals.dayTotals(less.days[4]);
  assert.equal(goal.kcal, a.target.kcal + kcal);
  assert.equal(goal.protein, a.target.protein, "protein stays");
  // Far down (about 1 200 kcal) the full protein target can't be had from food; calories are hit and protein comes as close as it can.
  if (kcal > -1000) assert.ok(meals.withinTarget(got, goal), `${kcal}: ${JSON.stringify(got)}`);
  else assert.ok(Math.abs(got.kcal - goal.kcal) <= goal.kcal * meals.KCAL_TOLERANCE && got.protein >= goal.protein - 30, `${kcal}: ${JSON.stringify(got)}`);
  assert.ok(meals.isWeek(less));
  assert.deepEqual(less.days.filter((_, i) => i !== 4), a.days.filter((_, i) => i !== 4), "other days untouched");
}
assert.equal(meals.setAdjust(a, 4, -30), null, "steps of 50");
assert.equal(meals.setAdjust(a, 4, -5000), null);
assert.equal(meals.adjustOf(meals.setAdjust(meals.setAdjust(a, 4, -500), 4, 0).days[4]), 0, "0 by you: no change");
assert.equal(meals.setAdjust(meals.setAdjust(a, 4, -500), 4, 0).days[4].adjust, 0, "and the app leaves the day alone");
assert.equal(meals.setAdjust(meals.setAdjust(a, 4, -500, { auto: true }), 4, 0, { auto: true }).days[4].adjust, undefined, "auto 0 removes it");
// With breakfast eaten, fewer calories and the same protein still work: the meals left get leaner dishes.
for (let d = 0; d < 7; d++) {
  const n = meals.setAdjust(meals.setAte(a, d, "frukost", 1), d, -500);
  assert.ok(meals.withinTarget(meals.dayTotals(n.days[d]), meals.dayTarget(n.days[d], a.target)), `day ${d}: ${JSON.stringify(meals.dayTotals(n.days[d]))}`);
  assert.equal(n.days[d].meals[0].ate, 1, "breakfast kept");
  assert.notEqual(n.days[d].meals[1].dish, n.days[d].meals[3].dish, "lunch and dinner differ");
}
// The week evens out: what was eaten over on a day already done is spread over the days left.
const over = meals.setCustom(a, 2, "middag", { name: "Pizza", kcal: 1500, protein: 40 });
const overKcal = meals.dayTotals(over.days[2]).kcal - a.target.kcal;
{
  const bal = meals.balanceOf(over, 3); // Wednesday was too much, today is Thursday
  assert.equal(bal.over, overKcal);
  assert.deepEqual(bal.days, [3, 4, 5, 6], "Thursday to Sunday share it");
  assert.equal(bal.take, -Math.round(overKcal / 4 / 50) * 50);
  assert.equal(bal.unpaid, 0);
  assert.deepEqual(meals.balanceOf(a, 3), { over: 0, take: 0, days: [3, 4, 5, 6], unpaid: 0 }, "nothing logged: nothing to even out");
  assert.equal(meals.balanceOf(meals.setAte(a, 2, "middag", 0), 3).take, 0, "under target: nothing added back");
  assert.equal(meals.balanceOf(over, 6).take, -Math.floor(a.target.kcal * 0.25 / 50) * 50, "Sunday alone: at most a quarter");
  assert.ok(meals.balanceOf(over, 6).unpaid > 0, "the rest can't be had this week");
  // One budget for the week: a day under counts against a day over, but nothing is given back.
  const mixed = meals.setCustom(meals.setCustom(a, 0, "middag", { name: "", kcal: 1000, protein: 40 }), 1, "middag", { name: "", kcal: 100, protein: 10 });
  const net = meals.dayTotals(mixed.days[0]).kcal + meals.dayTotals(mixed.days[1]).kcal - 2 * a.target.kcal;
  assert.equal(meals.balanceOf(mixed, 2).over, net >= 100 ? net : 0);
  assert.ok(meals.balanceOf(mixed, 2).take <= 0);
  // Rounding to 50 kcal a day is not reported as unpaid; only the cap is.
  const small = meals.setCustom(a, 0, "middag", { name: "", kcal: meals.mealInfo(a.days[0].meals[3]).kcal + 300, protein: 40 });
  assert.equal(meals.balanceOf(small, 2).unpaid, 0);
  // An amount you set yourself on a day already done counts.
  assert.ok(meals.balanceOf(meals.setPortion(a, 0, "middag", 2.5), 1).over > 100);
  // A day you set to more yourself is paid back by the others.
  assert.ok(meals.balanceOf(meals.setAdjust(a, 4, 300), 2).take < 0);
  // A day you set yourself keeps your number and counts towards it.
  const mine = meals.setAdjust(over, 4, -500);
  const b2 = meals.balanceOf(mine, 3);
  assert.deepEqual(b2.days, [3, 5, 6]);
  assert.equal(b2.take, -Math.round((overKcal - 500) / 3 / 50) * 50);
  // A day paid back (with nothing logged) counts as eaten as planned, so the rest of the week stops.
  const paid = meals.setAdjust(over, 3, -overKcal + (overKcal % 50), { auto: true });
  assert.ok(meals.balanceOf(paid, 4).over < 100);
}
const autoDay = meals.setAdjust(over, 3, meals.balanceOf(over, 3).take, { auto: true });
assert.ok(autoDay.days[3].adjustAuto && meals.isWeek(autoDay));
assert.ok(meals.regenerateFrom(autoDay, 3, 5).days[3].adjustAuto, "kept by a new suggestion");
// Taking a change away again does not leave lean dishes at oversized portions.
for (let d = 0; d < 7; d++) {
  const back = meals.setAdjust(meals.setAdjust(a, d, -500), d, 0);
  assert.ok(back.days[d].meals.every((m) => m.portion <= meals.NORMAL_MAX + 0.11), `day ${d}: ${back.days[d].meals.map((m) => m.portion)}`);
  assert.ok(meals.withinTarget(meals.dayTotals(back.days[d]), a.target));
}
// Never below MIN_DAY_KCAL, also at a low weekly target.
const floorWeek = meals.generateWeek("2026-01-05", { kcal: 1500, protein: 170 });
assert.equal(meals.setAdjust(floorWeek, 2, -500), null, "1 000 kcal is too low");
assert.ok(meals.setAdjust(floorWeek, 2, -300));
assert.equal(meals.dayTarget({ meals: [], adjust: -1000 }, { kcal: 1500, protein: 170 }).kcal, meals.MIN_DAY_KCAL, "a stored change is held at the floor");
// An off-range stored change does not throw the week away.
assert.ok(meals.isWeek({ ...a, days: a.days.map((d, i) => (i ? d : { ...d, adjust: -99999 })) }));
// Eaten meals stay when the day is adjusted afterwards.
const eatenFirst = meals.setAte(a, 4, "lunch", 1);
const adjAfter = meals.setAdjust(eatenFirst, 4, -500);
assert.deepEqual(adjAfter.days[4].meals.slice(0, 2), eatenFirst.days[4].meals.slice(0, 2), "breakfast and lunch already eaten");
// The change survives a new suggestion and a new target.
assert.equal(meals.regenerateFrom(meals.setAdjust(a, 5, -500), 4, 3).days[5].adjust, -500);
const reAdj = meals.retarget(meals.setAdjust(a, 5, -500), { kcal: a.target.kcal - 100, protein: a.target.protein });
assert.equal(reAdj.days[5].adjust, -500);
assert.ok(meals.withinTarget(meals.dayTotals(reAdj.days[5]), meals.dayTarget(reAdj.days[5], reAdj.target)));

// Your own amount: kept, the other meals not yet eaten fit around it, "Auto" hands it back.
{
  const mine = meals.setPortion(a, 4, "middag", 0.6);
  const m = mine.days[4].meals[3];
  assert.equal(m.portion, 0.6);
  assert.ok(m.manual && meals.isWeek(mine));
  assert.ok(!meals.isLogged(m), "not eaten, just set");
  assert.ok(meals.withinTarget(meals.dayTotals(mine.days[4]), meals.dayTarget(mine.days[4], a.target)), `the rest fits around it: ${JSON.stringify(meals.dayTotals(mine.days[4]))}`);
  // Undoing "ate" or "something else" does not leave a stale "your amount" behind.
  assert.equal(meals.setAte(meals.setAte(mine, 4, "middag", 1), 4, "middag", null).days[4].meals[3].manual, undefined);
  assert.equal(meals.setCustom(meals.setCustom(mine, 4, "middag", { name: "", kcal: 500, protein: 30 }), 4, "middag", null).days[4].meals[3].manual, undefined);
  // A new suggestion and a new target keep the day you set an amount on.
  assert.equal(meals.regenerateFrom(mine, 3, 9).days[4].meals[3].portion, 0.6);
  assert.equal(meals.retarget(mine, { kcal: a.target.kcal - 400, protein: a.target.protein }).days[4].meals[3].portion, 0.6);
  // Kept when the day is changed afterwards.
  assert.equal(meals.setAdjust(mine, 4, -500).days[4].meals[3].portion, 0.6);
  assert.equal(meals.setAte(mine, 4, "frukost", 1).days[4].meals[3].portion, 0.6);
  const auto = meals.setPortion(mine, 4, "middag", null);
  assert.equal(auto.days[4].meals[3].manual, undefined);
  assert.equal(meals.setPortion(a, 4, "middag", 5), null, "at most PORTION_MAX");
  assert.equal(meals.setPortion(meals.setAte(a, 4, "middag", 1), 4, "middag", 1), null, "eaten: the share is used instead");
}

// Far down in calories the snack shake is made with water so protein stays near the target.
{
  const T = { kcal: 2203, protein: 170 };
  const w = meals.generateWeek("2026-11-02", T);
  for (const d of [1, 3, 5]) {
    const low = meals.setAdjust(w, d, -1000).days[d];
    const t = meals.dayTotals(low);
    assert.ok(t.protein >= T.protein - 10 && Math.abs(t.kcal - 1203) <= 1203 * meals.KCAL_TOLERANCE, `day ${d}: ${JSON.stringify(t)}`);
  }
}

// The shake is made with water on a day that is tight on calories, with milk on a day with room.
{
  const tight = meals.setCustom(a, 1, "frukost", { name: "Stor frukost", kcal: 1100, protein: 15 });
  const ex = tight.days[1].extra;
  assert.ok(ex && ex.water === true, "tight day: the shake is made with water");
  assert.ok(meals.isWeek(tight));
  const info = meals.extraInfo(tight.days[1]);
  assert.ok(info.water && /på vatten/.test(info.name), info.name);
  assert.ok(info.ingredients.some((i) => i.name === "Vatten") && !info.ingredients.some((i) => i.name === "Mjölk"));
  const water = meals.baseDish("snack-shake").water;
  assert.equal(info.kcal, Math.round(water.kcal * ex.portion), "counted with the water numbers");
  // Same protein per portion would take far more calories with milk.
  assert.ok(water.kcal < meals.baseDish("snack-shake").kcal * 0.6);
  const roomy = meals.setCustom(a, 1, "frukost", { name: "Liten frukost", kcal: 150, protein: 5 });
  assert.ok(roomy.days[1].extra && !roomy.days[1].extra.water, "day with room: milk");
  // Kept by a new suggestion on the following days, and by re-fitting.
  assert.equal(meals.regenerateFrom(tight, 3, 4).days[1].extra.water, true);
  const re = meals.retarget(tight, { kcal: tight.target.kcal - 100, protein: tight.target.protein });
  assert.ok(re.days[1].extra, "re-fitted day keeps a top-up");
  // A damaged flag is rejected rather than trusted.
  assert.ok(!meals.isWeek({ ...tight, days: tight.days.map((d, i) => (i === 1 ? { ...d, extra: { ...d.extra, water: "ja" } } : d)) }));
  // An edited shake loses the water version (its ingredients are no longer the ones the numbers are for).
  meals.applyDishes({ items: { "snack-shake": { slot: "mellanmal", name: "Proteinshake", kcal: 300, protein: 40, fat: 10, carbs: 14, ingredients: [["Proteinpulver", 1, "dl", "Skafferi"]] } } });
  assert.equal(meals.dishOf("snack-shake").water, undefined);
  meals.applyDishes({});
  assert.ok(meals.dishOf("snack-shake").water);
}

// Eating less is not made up for: halved breakfast and lunch must not push the later meals past a normal portion.
for (let d = 0; d < 7; d++) {
  const planned = a.days[d].meals.map((m) => m.portion);
  let w = meals.setAte(a, d, "frukost", 0.5);
  w = meals.setAte(w, d, "lunch", 0.5);
  w.days[d].meals.forEach((m, i) => {
    if (i > 1) assert.ok(m.portion <= Math.max(meals.NORMAL_MAX, planned[i]) + 1e-9, `day ${d} meal ${i} grew to ${m.portion}`);
  });
  // Not stuffed past the target either; low protein is made up by the shake top-up, not by bigger meals.
  assert.ok(meals.dayTotals(w.days[d]).kcal <= a.target.kcal * (1 + meals.KCAL_TOLERANCE), `day ${d} over target`);
  // Undoing puts the meal back to a normal portion.
  const undone = meals.setAte(w, d, "lunch", null);
  assert.equal(undone.days[d].meals[1].ate, undefined);
  assert.ok(undone.days[d].meals[1].portion <= meals.NORMAL_MAX + 1e-9);
}

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

// Protein top-up: added by itself when a meal would otherwise get too big, sized in half portions,
// removable and addable per day, kept through swaps, new targets and new suggestions.
{
  const T = a.target;
  const halves = (p) => p >= 0.5 && p <= 3 && p % 0.5 === 0;
  const mealKcal = (d) => d.meals.reduce((s, m) => s + meals.mealInfo(m).kcal, 0);
  const auto = a.days.filter((d) => d.extra);
  assert.ok(auto.length > 0, "some days get a top-up");
  assert.ok(auto.every((d) => d.extra.dish === meals.topupId() && halves(d.extra.portion) && !d.extra.manual), "auto top-ups");

  // Removed by you: stays removed.
  const di = a.days.findIndex((d) => d.extra);
  const off = meals.setExtra(a, di, false);
  assert.equal(off.days[di].extra, undefined);
  assert.equal(off.days[di].extraOff, true);
  assert.ok(meals.isWeek(off));
  assert.deepEqual(off.days.filter((_, i) => i !== di), a.days.filter((_, i) => i !== di), "other days untouched");
  const otherLunch = (d) => meals.DISHES.lunch.find((o) => o.id !== d.meals[1].dish && o.id !== d.meals[3].dish).id;
  assert.equal(meals.changeDish(off, di, "lunch", otherLunch(off.days[di])).days[di].extra, undefined, "removed stays removed after a swap");
  assert.equal(meals.retarget(off, { ...T, kcal: T.kcal + 150 }).days[di].extra, undefined, "removed stays removed after a new target");
  assert.equal(meals.regenerateFrom(off, 0, 2).days[di].extraOff, true, "removed stays removed after a new suggestion");

  // Added by you: always kept, the meals shrink to make room, on target.
  const ni = a.days.findIndex((d) => !d.extra);
  assert.ok(ni >= 0);
  const on = meals.setExtra(a, ni, true);
  const day = on.days[ni];
  assert.ok(day.extra.manual && halves(day.extra.portion));
  assert.ok(meals.withinTarget(meals.dayTotals(day), T), "day with a top-up stays on target");
  assert.ok(mealKcal(day) < mealKcal(a.days[ni]), "meals shrink to make room");
  assert.ok(meals.changeDish(on, ni, "lunch", otherLunch(day)).days[ni].extra.manual, "kept through a swap");
  assert.ok(meals.setCustom(on, ni, "lunch", { name: "x", kcal: 600, protein: 30 }).days[ni].extra.manual, "kept through ate-something-else");
  assert.ok(meals.regenerateFrom(on, 0, 2).days[ni].extra.manual, "kept through a new suggestion");
  for (const dk of [-300, -100, 150, 400]) assert.ok(meals.retarget(on, { ...T, kcal: T.kcal + dk }).days[ni].extra.manual, `kept through retarget ${dk}`);
  assert.equal(meals.dayItems(day).length, 5);
  assert.deepEqual(meals.dayItems(off.days[di]), off.days[di].meals, "no top-up, no extra item");

  // It follows the protein target: a low-protein breakfast gives a bigger top-up.
  const lowDay = meals.setExtra(meals.setCustom(a, ni, "frukost", { name: "bulle", kcal: 500, protein: 5 }), ni, true).days[ni];
  assert.ok(lowDay.extra.portion > day.extra.portion, `bigger top-up on a low-protein day (${lowDay.extra.portion} vs ${day.extra.portion})`);

  // The older stored form `shake` reads as a manual shake and is rewritten on the next fit.
  assert.equal(meals.dayItems({ ...a.days[ni], shake: true }).at(-1).portion, 1);
  const legacy = meals.setCustom({ ...a, days: a.days.map((d, i) => (i === ni ? { ...d, shake: 1.5 } : d)) }, ni, "lunch", null).days[ni];
  assert.equal(legacy.shake, undefined);
  assert.ok(legacy.extra.manual && legacy.extra.dish === meals.SHAKE_ID);

  // Another snack as top-up; only snacks qualify. Editing the top-up dish re-fits the days.
  // Only protein-rich snacks qualify: cottage cheese with fruit and nuts barely moves the day's protein.
  assert.ok(meals.isTopupCandidate(meals.dishOf(meals.SHAKE_ID)));
  assert.ok(!meals.isTopupCandidate(meals.dishOf("snack-keso")) && !meals.isTopupCandidate(meals.dishOf("snack-yoghurt")));
  meals.applyDishes({ topup: "snack-keso" });
  assert.equal(meals.topupId(), meals.SHAKE_ID, "a weak snack falls back to the shake");
  meals.applyDishes({ topup: "lunch-lax" });
  assert.equal(meals.topupId(), meals.SHAKE_ID, "a main dish is not a top-up");
  const kvarg = { slot: "mellanmal", name: "Kvarg", kcal: 180, protein: 30, fat: 1, carbs: 12, ingredients: [["Kvarg", 300, "g", "Mejeri och ägg"]] };
  meals.applyDishes({ items: { "egen-kvarg": kvarg }, visible: { "egen-kvarg": false }, topup: "egen-kvarg" });
  assert.equal(meals.topupId(), "egen-kvarg", "an own protein-rich snack, also hidden from the rotation");
  const other = meals.refitWeek(a, new Set(["egen-kvarg"]));
  assert.ok(other.days.some((d) => d.extra) && other.days.filter((d) => d.extra).every((d) => d.extra.dish === "egen-kvarg"), "auto top-ups switch dish");
  assert.ok(other.days.every((d) => meals.withinTarget(meals.dayTotals(d), T)));
  meals.applyDishes();

  // Adding it to a day short of protein brings the day to the target; on a day already on target
  // protein stays and the meals shrink. withExtra shows that before adding; setExtra gives the same day.
  for (const ids of [["frukost", "middag-farssas", "snack-yoghurt", "middag-lax"], ["frukost", "lunch-makrill", "snack-yoghurt", "middag-torsk"]]) {
    const week = { ...a, days: a.days.map((d) => ({ meals: ids.map((dish, i) => ({ slot: meals.SLOTS[i].id, dish, portion: 1 })), extraOff: true })) };
    const short = meals.changeDish(week, 0, "lunch", ids[1]).days[0];
    assert.ok(meals.dayTotals(short).protein < T.protein - meals.PROTEIN_TOLERANCE, `${ids} is short without a top-up`);
    const added = meals.setExtra({ ...week, days: [short, ...week.days.slice(1)] }, 0, true).days[0];
    assert.deepEqual(meals.withExtra(short, T), added);
    assert.ok(meals.withinTarget(meals.dayTotals(added), T), `${ids} reaches the target with a top-up: ${JSON.stringify(meals.dayTotals(added))}`);
  }
  // Not a second shake on a day whose snack already is the shake.
  const shakeWeek = meals.changeDish(a, ni, "mellanmal", meals.SHAKE_ID);
  assert.ok(!meals.canAddExtra(shakeWeek.days[ni]) && meals.withExtra(shakeWeek.days[ni], T) === null);
  assert.equal(meals.setExtra(shakeWeek, ni, true), null);
  // But once that shake is eaten it can't grow any more, so a second one can top up a day short of protein
  // (breakfast and lunch eaten small, dinner set to an own amount: nothing else can make up for it).
  {
    let w = shakeWeek;
    w = meals.setAte(w, ni, "frukost", 0.5);
    w = meals.setAte(w, ni, "lunch", 0.5);
    w = meals.setPortion(w, ni, "middag", 1);
    const before = meals.setExtra(w, ni, false); // without a top-up: stuck short of protein
    assert.ok(meals.dayTotals(before.days[ni]).protein < T.protein - meals.PROTEIN_TOLERANCE, "the day is short without a top-up");
    w = meals.setAte(w, ni, "mellanmal", 1);
    const eatenDay = w.days[ni];
    // Added by itself when the day falls short, and it brings protein up.
    assert.ok(eatenDay.extra, "auto top-up after an eaten shake");
    assert.ok(meals.dayTotals(eatenDay).protein > meals.dayTotals(meals.setExtra(w, ni, false).days[ni]).protein, "the top-up adds protein");
    const off = meals.setExtra(w, ni, false).days[ni];
    assert.ok(meals.canAddExtra(off) && meals.withExtra(off, T).extra, "an eaten shake snack allows adding a top-up by hand");
  }
  const full = a.days[ni];
  const shrunk = meals.withExtra(full, T);
  assert.ok(Math.abs(meals.dayTotals(shrunk).protein - meals.dayTotals(full).protein) <= meals.PROTEIN_TOLERANCE && mealKcal(shrunk) < mealKcal(full));
  const shake = meals.dishOf(meals.SHAKE_ID);
  meals.applyDishes({ items: { [meals.SHAKE_ID]: { ...shake, kcal: shake.kcal + 200 } } });
  const edited = meals.refitWeek(on, new Set([meals.SHAKE_ID]));
  assert.ok(meals.withinTarget(meals.dayTotals(edited.days[ni]), T), "editing the top-up dish re-fits its days");
  meals.applyDishes();

  assert.equal(meals.setExtra(a, 9, true), null);
  for (const bad of [{ shake: "yes" }, { shake: 40 }, { extra: { dish: 1, portion: 1 } }, { extra: { dish: "x", portion: 0 } },
    { extra: { dish: "snack-shake", portion: 40 } }, { extra: { dish: "snack-shake", portion: 0.7 } }, { extraOff: "ja" }]) {
    assert.equal(meals.isWeek({ ...a, days: a.days.map((d) => ({ ...d, ...bad })) }), false, JSON.stringify(bad));
  }
}

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
assert.equal(meals.defaultGrams({ kcal: 580, protein: 30, fat: 49, carbs: 5 }), 15); // pumpkin seeds: not a meat portion

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
assert.ok(dishes.removeBlock(meals.DISHES.lunch[0].id), "nor can they be removed");
meals.applyDishes();

// Removed dishes: out of the editor and never planned, but still resolved for days that used them.
{
  const used = a.days[0].meals[1].dish;
  meals.applyDishes({ removed: { [used]: true, "snack-yoghurt": true } });
  assert.ok(meals.isRemoved(used) && !meals.isVisible(used) && meals.dishOf(used), "a removed dish still resolves");
  assert.ok(!meals.allDishes("huvudratt").some((d) => d.id === used) && meals.allDishes("huvudratt", { removed: true }).some((d) => d.id === used));
  assert.ok(!meals.DISHES.lunch.some((d) => d.id === used) && !meals.DISHES.middag.some((d) => d.id === used));
  assert.ok(meals.isWeek(a), "weeks that used it stay valid");
  const fresh = meals.generateWeek("2026-06-01", targets[3]);
  assert.ok(fresh.days.every((d) => d.meals.every((m) => !meals.isRemoved(m.dish))), "removed dishes are never planned");
  assert.ok(meals.replaceHidden(structuredClone(a), 0).days.every((d) => d.meals.every((m) => !meals.isRemoved(m.dish))), "and replaced in the rest of the week");
  assert.equal(dishes.removeBlock(meals.SHAKE_ID) !== null, true, "the top-up snack can't be removed");
  // A removed shake is not the fallback top-up when a protein-rich snack of your own is left.
  const kvarg = { slot: "mellanmal", name: "Kvarg", kcal: 180, protein: 30, fat: 1, carbs: 12, ingredients: [["Kvarg", 300, "g", "Mejeri och ägg"]] };
  meals.applyDishes({ items: { "egen-kvarg": kvarg }, removed: { [meals.SHAKE_ID]: true }, topup: "saknas" });
  assert.equal(meals.topupId(), "egen-kvarg");
  assert.ok(!meals.DISHES.mellanmal.some((d) => d.id === meals.SHAKE_ID));
  // Removing every snack still leaves enough to plan with (removed ones as last resort).
  meals.applyDishes({ removed: Object.fromEntries(meals.allDishes("mellanmal").map((d) => [d.id, true])) });
  assert.ok(meals.DISHES.mellanmal.length >= meals.minDishes("mellanmal"));
  meals.applyDishes();
  assert.equal(dishes.removeDish("lunch-torsk"), false, "no storage in Node: rolled back");
  assert.ok(!meals.isRemoved("lunch-torsk") && meals.isVisible("lunch-torsk"));
  assert.equal(dishes.restoreDish("lunch-torsk"), false, "only a removed dish can be restored");
}
// How the week went: a planned week passes, a big day over makes the day and (unpaid) the week fail.
{
  const t = targets[3];
  const w = meals.generateWeek("2026-03-02", t);
  const planned = meals.weekResult(w, 0);
  assert.ok(planned.ok && !planned.over && planned.days.every((x) => !x.done), "a planned week is on track, nothing done yet");
  assert.equal(planned.budget, t.kcal * 7);
  assert.ok(meals.weekResult(w, 7).over, "after Sunday every day is done");
  // A day of 4 000 kcal more, on four days, can't be evened out: the days fail and so do the calories.
  let big = w;
  for (const d of [0, 1, 2, 3]) big = meals.setCustom(big, d, "middag", { name: "Fest", kcal: 4000, protein: 20 });
  const r = meals.weekResult(big, 7);
  assert.ok(!r.kcalOk && !r.ok && r.over, "way over budget fails the week");
  assert.ok(!r.days[0].kcalOk && r.days[0].done && r.days[6].ok, "the party day fails, a planned day passes");
  // Protein: a low-protein week fails on protein only.
  let low = w;
  for (let d = 0; d < 7; d++) for (const s of meals.SLOTS) low = meals.setCustom(low, d, s.id, { name: "Pasta", kcal: Math.round(t.kcal / 4), protein: 10 });
  for (let d = 0; d < 7; d++) low = meals.setExtra(low, d, false);
  const lr = meals.weekResult(low, 7);
  assert.ok(lr.kcalOk && !lr.proteinOk && lr.proteinDays < 7, "too little protein fails on protein");
  // Eating less is not a calorie fault.
  const less = meals.setAte(w, 2, "lunch", 0);
  assert.ok(meals.dayResult(less.days[2], t).kcalOk);
}

// What to cook: every planned meal counted once, by dish, with the days and the ingredients summed.
{
  const w = meals.generateWeek("2026-03-09", targets[3]);
  const prep = meals.prepList(w);
  const count = prep.reduce((a, g) => a + g.dishes.reduce((b, x) => b + x.count, 0), 0);
  const expect = w.days.reduce((a, day) => a + meals.dayItems(day).length, 0);
  assert.equal(count, expect, "every meal and top-up is in the prep list");
  const boxes = prep.find((g) => g.id === "lador");
  assert.equal(boxes.dishes.reduce((a, x) => a + x.count, 0), 14, "lunch and dinner every day");
  const one = boxes.dishes[0];
  const ing = one.ingredients[0];
  const sum = w.days.flatMap((day) => day.meals).filter((m) => meals.MAIN.includes(m.slot) && m.dish === one.key.split("|")[0])
    .reduce((a, m) => a + (meals.mealInfo(m).ingredients.find((i) => i.name === ing.name && i.unit === ing.unit)?.amount ?? 0), 0);
  assert.ok(Math.abs(sum - ing.amount) < 0.01, "ingredients summed over the days");
  // Eaten meals and later days only: from Thursday, nothing from Monday to Wednesday.
  const eaten = meals.setAte(w, 3, "frukost", 1);
  assert.ok(meals.prepList(eaten, 3).every((g) => g.dishes.every((x) => x.days.every((d) => d >= 3))));
  const before = meals.prepList(w, 3).find((g) => g.id === "frukost").dishes.reduce((a, x) => a + x.count, 0);
  const after = meals.prepList(eaten, 3).find((g) => g.id === "frukost").dishes.reduce((a, x) => a + x.count, 0);
  assert.equal(after, before - 1, "an eaten meal needs no cooking");
}
meals.applyDishes();
console.log("ok");

// The app's amounts for a dish: typical per ingredient, then the whole dish an ordinary portion.
{
  const f = (name, kcal, protein, fat, carbs) => ({ name, kcal, protein, fat, carbs });
  const salad = [f("Tonfisk i vatten konserv. avrunnen", 116, 26, 1, 0), f("Gurka", 12, 1, 0, 2), f("Tomat", 20, 1, 0, 3),
    f("Spenat färsk", 23, 3, 0, 1), f("Ägg rått", 140, 12, 10, 0), f("Pumpafrö", 580, 30, 49, 5), f("Solrosfrö", 600, 21, 51, 12),
    f("Olivolja", 884, 0, 100, 0), f("Äppelcidervinäger ättiksyra 7%", 20, 0, 0, 1)];
  const grams = meals.suggestGrams(salad, "middag");
  const kcal = grams.reduce((a, g, i) => a + (salad[i].kcal * g) / 100, 0);
  assert.ok(kcal > 450 && kcal < 650, `salad ${Math.round(kcal)} kcal`);
  assert.ok(grams[5] <= 20 && grams[6] <= 20, "seeds a sprinkle, not a meat portion");
  assert.ok(grams[8] <= 20, "vinegar a splash");
  assert.ok(grams[0] >= 100, "the fish is the bulk");
  assert.equal(meals.defaultGrams(f("Proteinpulver", 380, 75, 5, 8)), 30);
  assert.equal(meals.validateDish({ name: "x", ingredients: [["Torsk", 200, "g"]], kcal: 160, protein: 36, fat: 1, carbs: 0, auto: true }, "lunch").values.auto, true);
}

// Condiments by name, without catching ordinary foods that mention salt or spice.
{
  const g = (name, kcal, protein, carbs) => meals.defaultGrams({ name, kcal, protein, fat: 1, carbs });
  assert.equal(g("Äppelcidervinäger ättiksyra 7%", 20, 0, 1), 15);
  assert.equal(g("Svartpeppar", 250, 10, 40), 15);
  assert.equal(g("Ris kokt m. salt", 130, 3, 28), 150);
  assert.equal(g("Blandfärs stekt tacokryddad", 250, 20, 2), 150);
  assert.equal(g("Honungsmelon", 36, 1, 8), 100);
  assert.equal(g("Pepparrot", 70, 2, 12), 100);
  assert.equal(g("Rättika", 15, 1, 2), 100);
  assert.equal(g("Ättika 12%", 20, 0, 0), 15);
  assert.equal(meals.validateDish({ name: "x", ingredients: [["Torsk", 200, "g"]], kcal: 160, protein: 36, fat: 1, carbs: 0 }, "lunch").values.auto, false);
  assert.equal(meals.legacyGrams({ kcal: 580, protein: 30, fat: 49, carbs: 5 }), 150); // what the seeds got before
}
