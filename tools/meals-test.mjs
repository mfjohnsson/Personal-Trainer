// Checks the weekly meal plan against js/meals.js. Run: node tools/meals-test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import * as meals from "../js/meals.js";
import * as foods from "../js/foods.js";
import * as calc from "../js/calc.js";

foods.setData(JSON.parse(fs.readFileSync(new URL("../data/livsmedel.json", import.meta.url), "utf8")));
meals.setAnalyzer(foods.macrosOf);
meals.applyDishes();
meals.setNow(null);

const P = calc.PROTEIN_G;
const mart = Math.round(calc.calorieTarget({ age: 35, heightCm: 170, weightKg: 82 }));
const T = { kcal: mart, protein: P };
const slotsOf = (day) => day.meals.map((m) => m.slot);
const mainsOf = (w) => w.days.flatMap((day) => day.meals.filter((m) => meals.MAIN.includes(m.slot)).map((m) => m.dish));
const count = (list) => list.reduce((a, x) => ({ ...a, [x]: (a[x] ?? 0) + 1 }), {});

// --- Protein or side ---
{
  const f = (nr) => foods.foodByNumber(nr);
  assert.ok(meals.isProteinFood(f(1173)), "chicken");
  assert.ok(meals.isProteinFood(f(1225)), "egg");
  assert.ok(meals.isProteinFood(f(70)), "cottage cheese");
  assert.ok(meals.isProteinFood(f(1296)), "mackerel in tomato sauce");
  assert.ok(!meals.isProteinFood(f(9000001)), "protein bread is a side");
  assert.ok(!meals.isProteinFood(f(880)), "beans only stretch the protein: a side");
  assert.ok(!meals.isProteinFood(f(3140)), "nuts");
  assert.ok(!meals.isProteinFood(f(123)), "milk");
  const chicken = meals.dishOf("lunch-kyckling");
  assert.deepEqual(chicken.lines.map((l) => l.part), ["p", "s", "s"]);
}

// --- Weeks hit their targets: three meals, protein first ---
let worstK = 0, shortP = 0, topups = 0, lean = 0, mostP = 0;
for (const kcal of [1700, 1900, 2100, mart, 2400]) {
  const target = { kcal, protein: P };
  for (const start of ["2026-01-05", "2026-01-12", "2026-01-19", "2026-11-09"]) {
    const w = meals.generateWeek(start, target);
    assert.ok(meals.isWeek(w), "a valid week");
    assert.equal(w.v, meals.PLAN_VERSION);
    w.days.forEach((day, d) => {
      assert.deepEqual(slotsOf(day), ["frukost", "lunch", "middag"], "three meals");
      assert.notEqual(day.meals[1].dish, day.meals[2].dish, "lunch and dinner differ");
      const t = meals.dayTotals(day);
      worstK = Math.max(worstK, Math.abs(t.kcal - kcal) / kcal);
      shortP = Math.max(shortP, P - t.protein);
      mostP = Math.max(mostP, t.protein);
      // Lean dishes on a high target: the day may stay short of calories rather than go far over the protein.
      const short = t.kcal < kcal * (1 - meals.KCAL_TOLERANCE) && t.protein >= P + 20;
      if (short) lean++;
      assert.ok(t.kcal >= kcal * 0.8, `${kcal} ${start} day ${d}: never far short (${t.kcal} kcal)`);
      assert.ok(short || meals.withinTarget(t, target), `${kcal} ${start} day ${d}: ${t.kcal} kcal ${t.protein} g`);
      for (const m of day.meals) assert.ok(m.portion <= 2 + 1e-9 && m.side <= 2.5 + 1e-9, "within bounds");
      if (day.extra) topups++;
    });
  }
}
console.log(`targets ${mart}±: worst kcal error ${(worstK * 100).toFixed(1)} %, most protein short ${shortP} g, days with top-up ${topups} of 140, short lean days ${lean}, most protein ${mostP} g`);
assert.ok(mostP <= P + 35, "never far over the protein target");
assert.ok(lean <= 10, "short lean days are rare");
assert.ok(topups < 40, "a top-up is the exception, not the rule");

// --- Top-ups stay a sensible size: quark as the top-up never 750 g, the protein never far over ---
{
  meals.applyDishes({ topup: "snack-kvarg" });
  for (const kcal of [1500, 1600, 1800, mart]) {
    for (const start of ["2026-11-02", "2026-11-09", "2026-11-16"]) {
      const w = meals.generateWeek(start, { kcal, protein: P });
      for (const day of w.days) {
        for (const e of meals.extrasInfo(day)) {
          for (const i of e.ingredients) if (i.unit === "g") assert.ok(i.amount <= 400, `${e.name}: ${i.amount} g ${i.name}`);
        }
        assert.ok(meals.dayTotals(day).protein <= P + 35, `protein ${meals.dayTotals(day).protein}`);
      }
    }
  }
  meals.applyDishes();
}

// --- The rotation: four lunch/dinner dishes a week ---
{
  const w = meals.generateWeek("2026-11-09", T);
  const roles = meals.rolesOf("2026-11-09");
  assert.equal(new Set(Object.values(roles).map((d) => d.id)).size, 4, "four different dishes");
  assert.equal(roles.A.kind, "storkok");
  assert.equal(roles.B.kind, "storkok");
  assert.match(roles.A.name + roles.A.ingredients.map((i) => i[0]).join(), /nöt|färs|biff/i, "A is beef");
  assert.match(roles.B.name + roles.B.ingredients.map((i) => i[0]).join(), /kyckling/i, "B is chicken");
  assert.equal(roles.F.kind, "fisk");
  assert.equal(roles.Q.kind, "snabb");
  const c = count(mainsOf(w));
  assert.equal(Object.keys(c).length, 4, "only the four dishes");
  assert.equal(c[roles.A.id], 5);
  assert.equal(c[roles.B.id], 5);
  assert.equal(c[roles.F.id], 2);
  assert.equal(c[roles.Q.id], 2);
  assert.ok(w.days.every((d) => d.meals[0].dish === "frukost"), "the same breakfast every day");
  meals.applyDishes({ breakfast: "frukost-kvarg" });
  assert.ok(meals.generateWeek("2026-11-09", T).days.every((d) => d.meals[0].dish === "frukost-kvarg"), "your everyday breakfast");
  const picked = meals.changeDish(w, 2, "frukost", "frukost-oats");
  const re = meals.setBreakfastFrom(picked, 0);
  assert.equal(re.days[2].meals[0].dish, "frukost-oats", "a breakfast you picked stays");
  assert.ok(re.days.filter((_, d) => d !== 2).every((d) => d.meals[0].dish === "frukost-kvarg"));
  meals.applyDishes();
  // A built-in dish deleted: not listed, not planned, still shown on earlier days.
  meals.applyDishes({ gone: { "lunch-lax": true } });
  assert.ok(meals.dishOf("lunch-lax") && !meals.isListed("lunch-lax") && !meals.isVisible("lunch-lax"));
  meals.applyDishes();
  // Week to week: some dishes stay (cook what you know), some change.
  let starts = ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"];
  for (let i = 1; i < starts.length; i++) {
    const a = Object.values(meals.rolesOf(starts[i - 1])).map((d) => d.id);
    const b = Object.values(meals.rolesOf(starts[i])).map((d) => d.id);
    const same = a.filter((x) => b.includes(x)).length;
    assert.ok(same >= 1 && same <= 3, `${starts[i]}: ${same} of 4 kept`);
  }
  // A new suggestion picks other dishes.
  const other = meals.rolesOf("2026-11-09", 1);
  assert.notDeepEqual(Object.values(other).map((d) => d.id), Object.values(roles).map((d) => d.id));
  // Same inputs give the same week.
  assert.deepEqual(meals.generateWeek("2026-11-09", T), w);
}

// --- Protein before carbs: a lower target cuts the sides, not the protein ---
{
  const hi = meals.generateWeek("2026-11-09", { kcal: 2300, protein: P });
  const lo = meals.generateWeek("2026-11-09", { kcal: 1800, protein: P });
  for (let d = 0; d < 7; d++) {
    assert.ok(meals.dayTotals(lo.days[d]).protein >= P - meals.PROTEIN_TOLERANCE, "protein kept");
    const sideHi = hi.days[d].meals.reduce((a, m) => a + m.side, 0), sideLo = lo.days[d].meals.reduce((a, m) => a + m.side, 0);
    assert.ok(sideLo < sideHi, `day ${d}: sides smaller`);
  }
  const info = meals.mealInfo(lo.days[0].meals[1]);
  assert.ok(info.ingredients.some((i) => i.part === "p") && info.ingredients.some((i) => i.part === "s"));
}

const w = meals.generateWeek("2026-11-09", T);

// --- The clock pins, it never locks; a day is over when you mark it done (or it is before today) ---
{
  meals.setNow("2026-11-11", 15 * 60); // Wednesday 15:00: breakfast and lunch are past
  assert.ok(meals.isPinned(w, 2, 0) && meals.isPinned(w, 2, 1) && !meals.isPinned(w, 2, 2));
  assert.ok(meals.dayOver(w, 1), "Tuesday is over");
  assert.ok(!meals.dayOver(w, 2));
  const changed = meals.setAdjust(w, 2, -500);
  assert.deepEqual(changed.days[2].meals.slice(0, 2), w.days[2].meals.slice(0, 2), "past meals untouched by the app");
  assert.notDeepEqual(changed.days[2].meals[2], w.days[2].meals[2], "dinner takes the change");
  assert.equal(meals.moreProtein(w, 2, "lunch"), null, "no 'Mer protein' for a past meal");
  // A past breakfast can still be changed: 3 eggs became 2, and the meals left make up the protein.
  const bIdx = (wk) => meals.mealInfo(wk.days[2].meals[0]).ingredients;
  const egg = bIdx(w).findIndex((i) => i.unit === "st" && /ägg/i.test(i.name));
  if (egg >= 0) {
    const less = meals.setAmount(w, 2, "frukost", egg, Math.max(0, bIdx(w)[egg].amount - 1));
    assert.ok(less, "a past meal can be changed");
    assert.equal(bIdx(less)[egg].amount, bIdx(w)[egg].amount - 1);
    assert.deepEqual(less.days[2].meals[1], w.days[2].meals[1], "lunch (past) stays");
    assert.notDeepEqual(less.days[2].meals[2], w.days[2].meals[2], "dinner fits again");
    assert.ok(meals.dayTotals(less.days[2]).protein >= P - meals.PROTEIN_TOLERANCE, "the day still reaches its protein");
  }
  meals.setNow("2026-11-11", 21 * 60);
  assert.ok(!meals.dayOver(w, 2), "after 20 the day is not over until you say so");
  const done = meals.setDone(w, 2, true);
  assert.ok(meals.dayOver(done, 2) && meals.isDone(done.days[2]));
  assert.deepEqual(done.days[2].meals, w.days[2].meals, "marking done changes nothing");
  // On a done day a change touches only what you changed.
  const dIng = meals.mealInfo(done.days[2].meals[2]).ingredients;
  const d2 = meals.setAmount(done, 2, "middag", 0, dIng[0].amount + 50);
  assert.deepEqual(d2.days[2].meals.slice(0, 2), done.days[2].meals.slice(0, 2));
  assert.equal(meals.mealInfo(d2.days[2].meals[2]).ingredients[0].amount, dIng[0].amount + 50);
  const again = meals.setDone(done, 2, false);
  assert.ok(!again.days[2].done && !meals.dayOver(again, 2));
  assert.ok(meals.isWeek(d2));
  meals.setNow(null);
}

// --- Foods added to a meal, typed amounts, the top-up per day ---
{
  const banana = { nummer: 1, name: "Banan", kcal: 90, protein: 1, fat: 0, carbs: 20 };
  const quark = { nummer: 2, name: "Kvarg naturell", kcal: 60, protein: 11, fat: 0, carbs: 4 };
  const a1 = meals.addFood(w, 3, "frukost", banana, 120);
  const b = a1.days[3].meals[0];
  assert.equal(b.add.length, 1);
  assert.equal(b.add[0].unit, "st");
  const info = meals.mealInfo(b);
  assert.ok(info.ingredients.some((i) => i.added && i.name === "Banan" && i.amount === 1));
  assert.ok(info.kcal >= meals.mealInfo(w.days[3].meals[0]).kcal + 100, "the banana counts");
  assert.ok(meals.isTouched(b) && meals.isWeek(a1));
  assert.ok(meals.withinTarget(meals.dayTotals(a1.days[3]), T), "the day fits around it");
  const a2 = meals.addFood(a1, 3, "lunch", quark);
  const q = a2.days[3].meals[1].add[0];
  assert.equal(q.unit, "g");
  assert.ok(q.amount >= 10 && q.amount % 10 === 0);
  const up = meals.stepAdd(a2, 3, "lunch", 0, 1);
  assert.equal(up.days[3].meals[1].add[0].amount, q.amount + 10);
  const typed = meals.setAddAmount(up, 3, "lunch", 0, 250);
  assert.equal(typed.days[3].meals[1].add[0].amount, 250);
  const gone = meals.setAddAmount(typed, 3, "lunch", 0, 0);
  assert.equal(gone.days[3].meals[1].add, undefined, "0 takes it away");
  const reset = meals.resetMeal(a1, 3, "frukost");
  assert.equal(reset.days[3].meals[0].add.length, 1, "the app's amounts again, your banana stays");
  assert.ok(!reset.days[3].meals[0].fixed);
  const swapped = meals.changeDish(a1, 3, "frukost", meals.DISHES.frukost.find((x) => x.id !== b.dish).id);
  assert.equal(swapped.days[3].meals[0].add.length, 1, "another dish keeps the banana");
  // A typed amount that rounds to nothing takes the food away (never a stored 0).
  const tiny = meals.setAddAmount(a2, 3, "lunch", 0, 0.4);
  assert.equal(tiny.days[3].meals[1].add, undefined);
  assert.ok(meals.isWeek(tiny));
  // Typed amount: exactly what you typed (whole pieces and 5 g steps).
  const lunch = meals.mealInfo(w.days[3].meals[1]).ingredients;
  const t = meals.setAmount(w, 3, "lunch", 0, 140);
  assert.equal(meals.mealInfo(t.days[3].meals[1]).ingredients[0].amount, 140, `typed 140 (was ${lunch[0].amount})`);
  assert.equal(meals.setAmount(w, 3, "lunch", 0, -1), null);
  const zero = meals.setAmount(w, 3, "lunch", 0, 0);
  assert.equal(meals.mealInfo(zero.days[3].meals[1]).ingredients[0].amount, 0, "0 leaves it out");
  // The top-up per day, also on a day that is over, and its portions.
  meals.setNow("2026-11-12", 12 * 60);
  const other = meals.allDishes("mellanmal").find((x) => x.id !== meals.topupId());
  const past = meals.setExtraChoice(w, 1, other.id);
  assert.equal(past.days[1].extra.dish, other.id, "yesterday's top-up can be changed");
  assert.deepEqual(past.days[1].meals, w.days[1].meals, "without touching yesterday's meals");
  assert.equal(meals.setExtraChoice(w, 1, "auto"), null, "no 'auto' for a day that is over");
  const more = meals.stepExtra(past, 1, 1);
  assert.equal(more.days[1].extra.portion, 1.5);
  assert.equal(meals.stepExtra(meals.stepExtra(past, 1, -1), 1, -1), null, "not below half a portion");
  assert.ok(meals.isWeek(more));
  // On a day that is over a second top-up stays when the first is changed.
  const two = { ...w, days: w.days.map((x, i) => (i === 1 ? { ...x, extra: { dish: "snack-shake", portion: 1 }, extra2: { dish: "snack-kvarg", portion: 1 } } : x)) };
  assert.equal(meals.setExtraChoice(two, 1, other.id).days[1].extra2?.dish, "snack-kvarg");
  // Older weeks' shake shows its portions.
  assert.equal(meals.extraPortions({ meals: [], shake: 2 }), 2);
  meals.setNow(null);
}

// --- "Åt inte": the meals left make up the protein ---
{
  meals.setNow("2026-11-09", 9 * 60); // Monday 09:00
  const s = meals.setSkip(w, 0, "frukost", true);
  const day = s.days[0];
  assert.equal(day.meals[0].ate, 0);
  assert.equal(meals.mealInfo(day.meals[0]).kcal, 0);
  const t = meals.dayTotals(day);
  assert.ok(t.protein >= P - meals.PROTEIN_TOLERANCE, `protein made up: ${t.protein}`);
  assert.ok(day.meals.slice(1).every((m) => m.side <= 1.25 + 1e-9 || m.side <= w.days[0].meals.find((x) => x.slot === m.slot).side + 1e-9), "sides not stuffed");
  assert.ok(t.kcal <= T.kcal * 1.05, "calories not made up beyond the target");
  const back = meals.setSkip(s, 0, "frukost", false);
  assert.equal(back.days[0].meals[0].ate, undefined);
  assert.ok(meals.withinTarget(meals.dayTotals(back.days[0]), T));
  // A past meal skipped and put back is again what was planned (its amounts are not reset).
  meals.setNow("2026-11-09", 15 * 60);
  const pastBack = meals.setSkip(meals.setSkip(w, 0, "lunch", true), 0, "lunch", false);
  assert.deepEqual(pastBack.days[0].meals[1], w.days[0].meals[1]);
  meals.setNow(null);
}

// --- "Åt något annat" ---
{
  const c = meals.setCustom(w, 3, "lunch", { name: "Pizza", kcal: 1100, protein: 40 });
  assert.equal(meals.mealInfo(c.days[3].meals[1]).name, "Pizza");
  assert.ok(meals.isLogged(c.days[3].meals[1]));
  const undone = meals.setCustom(c, 3, "lunch", null);
  assert.equal(undone.days[3].meals[1].custom, undefined);
}

// --- "Mer protein" and per-ingredient amounts ---
{
  const before = meals.mealInfo(w.days[4].meals[2]);
  const more = meals.moreProtein(w, 4, "middag");
  const m = more.days[4].meals[2];
  assert.ok(m.fixP > w.days[4].meals[2].portion);
  assert.ok(meals.mealInfo(m).protein > before.protein, "more protein in the meal");
  assert.ok(meals.isTouched(m));
  assert.ok(Math.abs(meals.dayTotals(more.days[4]).kcal - T.kcal) <= T.kcal * 0.06, "the day still near its calories");
  const reset = meals.resetMeal(more, 4, "middag");
  assert.ok(!meals.isTouched(reset.days[4].meals[2]));

  const dish = meals.dishOf(w.days[4].meals[1].dish);
  const side = dish.lines.findIndex((l) => l.part === "s");
  const tw = meals.tweakIngredient(w, 4, "lunch", side, -1);
  const tm = tw.days[4].meals[1];
  assert.ok(tm.tweak[side] < 1);
  assert.ok(tm.fixed);
  const amt = (week) => meals.mealInfo(week.days[4].meals[1]).ingredients[side].amount;
  const unit = meals.mealInfo(w.days[4].meals[1]).ingredients[side].unit;
  assert.equal(unit, "g");
  assert.ok(amt(w) - amt(tw) > 0 && amt(w) - amt(tw) <= 10, `10 g less: ${amt(w)} → ${amt(tw)}`);
  assert.equal(amt(tw) % 10, 0, "on a whole 10 g");
  const up = meals.tweakIngredient(tw, 4, "lunch", side, 1);
  assert.equal(amt(up), amt(tw) + 10, "10 g more");
  assert.equal(meals.tweakIngredient(w, 4, "lunch", 99, 1), null);
}

// --- Swap a dish, top-up on and off, calorie change ---
{
  const lunch = w.days[1].meals[1].dish, dinner = w.days[1].meals[2].dish;
  assert.equal(meals.changeDish(w, 1, "lunch", dinner), null, "lunch can't be the dinner's dish");
  const other = meals.DISHES.lunch.find((d) => d.id !== lunch && d.id !== dinner);
  const sw = meals.changeDish(w, 1, "lunch", other.id);
  assert.equal(sw.days[1].meals[1].dish, other.id);
  assert.deepEqual(sw.days[0], w.days[0], "other days untouched");
  const on = meals.setExtra(w, 5, true);
  assert.ok(on.days[5].extra?.manual);
  assert.ok(meals.withinTarget(meals.dayTotals(on.days[5]), T), "the meals make room for it");
  const off = meals.setExtra(on, 5, false);
  assert.ok(off.days[5].extraOff && !off.days[5].extra);
  // Choosing the top-up per day.
  const quark = meals.allDishes("mellanmal").filter(meals.isTopupCandidate).find((d) => d.id !== meals.topupId());
  if (quark) {
    const ch = meals.setExtraChoice(w, 4, quark.id);
    assert.equal(ch.days[4].extra.dish, quark.id);
    assert.equal(meals.extraChoice(ch.days[4]), quark.id);
    assert.ok(!ch.days[4].extra2, "only the one you chose");
  }
  {
    const hi = meals.generateWeek("2026-11-09", { kcal: 1800, protein: 200 });
    for (let d = 0; d < 7; d++) {
      const ch = meals.setExtraChoice(hi, d, meals.topup2Id() ?? meals.topupId());
      assert.ok(!ch.days[d].extra2 || ch.days[d].extra2.dish !== ch.days[d].extra.dish, "never the same top-up twice");
    }
  }
  assert.equal(meals.extraChoice(meals.setExtraChoice(w, 4, "none").days[4]), "none");
  assert.equal(meals.extraChoice(meals.setExtraChoice(off, 5, "auto").days[5]), "auto");
  assert.equal(meals.setExtraChoice(w, 4, w.days[4].meals[1].dish), null, "a lunch is no top-up");
  const adj = meals.setAdjust(w, 6, -400);
  assert.ok(meals.withinTarget(meals.dayTotals(adj.days[6]), meals.dayTarget(adj.days[6], T)));
  assert.equal(meals.setAdjust(w, 6, -5000), null);
}

// --- The week evens out ---
{
  const over = meals.setCustom(w, 2, "middag", { name: "Pizza", kcal: 1600, protein: 45 });
  const overKcal = meals.dayTotals(over.days[2]).kcal - T.kcal;
  const bal = meals.balanceOf(over, 3);
  assert.equal(bal.over, overKcal);
  assert.deepEqual(bal.days, [3, 4, 5, 6]);
  assert.equal(bal.take, -Math.round(overKcal / 4 / 50) * 50);
  assert.deepEqual(meals.balanceOf(w, 3), { over: 0, take: 0, days: [3, 4, 5, 6], unpaid: 0 });
  const res = meals.weekResult(over, 3);
  assert.ok(!res.days[2].ok && res.days[2].done);
}

// --- What to cook: the four dishes first ---
{
  const prep = meals.prepList(w);
  assert.equal(prep[0].id, "lador");
  assert.equal(prep[0].dishes.length, 4);
  assert.deepEqual(prep[0].dishes.map((x) => x.count).sort(), [2, 2, 5, 5]);
}

// --- Older weeks: four meals, one scale ---
{
  // A made-up catalog and weeks in the shape the four-meal planner (v3) stored them, as in real use: an
  // own dish, a "removed" built-in, eaten shares, "Åt något annat", an amount set by hand, a top-up.
  const own = { slot: "lunch", name: "Nötfärs, ris och bönor", kcal: 552, protein: 43, fat: 17, carbs: 51, meals: ["lunch", "middag"],
    ingredients: [["Nöt färs rå fett 10%", 140, "g", "Kött och fisk", 951], ["Ris jasmin kokt m. salt", 140, "g", "Bröd och spannmål", 2514]] };
  const four = (lunch, snack, dinner, extra = {}) => ({ meals: [
    { slot: "frukost", dish: "frukost", portion: 1.1 }, { slot: "lunch", dish: lunch, portion: 1.2 },
    { slot: "mellanmal", dish: snack, portion: 1.3 }, { slot: "middag", dish: dinner, portion: 1 }], ...extra });
  const eaten = (day) => ({ ...day, meals: day.meals.map((m) => ({ ...m, ate: 1 })) });
  const oldWeek = (start, days) => ({ start, target: { kcal: 2203, protein: 170 }, v: 3, days });
  const real = {
    dishes: { items: { "egen-a": own }, removed: { "snack-yoghurt": true, "lunch-kalkon": true } },
    meals: {
      "2026-10-26": oldWeek("2026-10-26", Array.from({ length: 7 }, () => four("lunch-notfars", "snack-yoghurt", "middag-kyckling"))),
      "2026-11-02": oldWeek("2026-11-02", [
        eaten(four("lunch-notfars", "snack-yoghurt", "middag-kyckling")),
        four("egen-a", "snack-keso", "middag-lax"),
        { ...four("middag-kyckling", "snack-keso", "middag-farssas"), meals: four("middag-kyckling", "snack-keso", "middag-farssas").meals.map((m) => (m.slot === "middag" ? { ...m, custom: { name: "Något annat", kcal: 1777, protein: 36 } } : m)) },
        { ...eaten(four("middag-lax", "snack-shake", "egen-a")), extraOff: true, adjust: -500 },
        { ...eaten(four("middag-torsk", "snack-keso", "egen-a")), adjust: -500, extra: { dish: "snack-shake", portion: 1.5, manual: true } },
        { ...four("egen-a", "snack-shake", "lunch-kalkon"), meals: four("egen-a", "snack-shake", "lunch-kalkon").meals.map((m) => (m.slot === "middag" ? { ...m, portion: 1.5, manual: true } : m)) },
        four("egen-a", "snack-yoghurt", "lunch-bonchili", { extra: { dish: "snack-shake", portion: 0.5 } }),
      ]),
      "2026-11-09": oldWeek("2026-11-09", Array.from({ length: 7 }, (_, d) => four(d % 2 ? "egen-a" : "lunch-torsk", "snack-keso", "middag-biff"))),
    },
  };
  meals.applyDishes(real.dishes);
  for (const wk of Object.values(real.meals)) assert.ok(meals.isWeek(wk) && meals.resolves(wk), `old week ${wk.start} reads`);
  const old = real.meals["2026-11-02"];
  const oldTotals = old.days.map((d) => meals.dayTotals(d).kcal);
  // Sunday 8 November at 15:00: Monday to Saturday are over, Sunday's breakfast and lunch are past.
  meals.setNow("2026-11-08", 15 * 60);
  const m = meals.migrateWeek(old, old.target);
  assert.equal(m.v, meals.PLAN_VERSION);
  for (let d = 0; d < 6; d++) assert.deepEqual(m.days[d], old.days[d], `day ${d} kept as it was`);
  assert.deepEqual(m.days.slice(0, 6).map((d) => meals.dayTotals(d).kcal), oldTotals.slice(0, 6), "old days count the same");
  const sun = m.days[6];
  assert.deepEqual(sun.meals.slice(0, 2), old.days[6].meals.slice(0, 2), "past meals of today kept");
  assert.deepEqual(slotsOf(sun), ["frukost", "lunch", "middag"], "today's snack (not yet past) is gone");
  assert.ok(meals.isWeek(m));
  // The coming week is planned again entirely.
  const next = meals.migrateWeek(real.meals["2026-11-09"], old.target);
  assert.ok(next.days.every((d) => slotsOf(d).join() === "frukost,lunch,middag"));
  assert.equal(Object.keys(count(mainsOf(next))).length, 4);
  // A whole old week in the past stays as it was.
  const past = meals.migrateWeek(real.meals["2026-10-26"], old.target);
  assert.deepEqual(past.days, real.meals["2026-10-26"].days);
  meals.setNow(null);
  // Older "removed" dishes count as switched off, still resolved for the days that used them.
  assert.ok(!meals.isVisible("snack-yoghurt") && meals.dishOf("snack-yoghurt"));
  meals.applyDishes();
}

// --- Catalog ---
{
  assert.equal(meals.topupId(), "snack-shake");
  assert.equal(meals.topup2Id(), "snack-kvarg");
  for (const id of ["lunch-flask", "middag-wok", "lunch-kalkon", "middag-kalkon"]) assert.ok(!meals.isVisible(id), `${id} off`);
  assert.ok(meals.DISHES.frukost.length >= 4, "several breakfasts");
  assert.equal(meals.guessKind({ name: "Laxpasta", ingredients: [["Laxfilé", 150, "g"]] }), "fisk");
  assert.equal(meals.guessKind({ name: "Tonfisksallad", ingredients: [["Tonfisk i vatten", 150, "g"]] }), "snabb");
  assert.equal(meals.guessKind({ name: "Chili", ingredients: [["Nötfärs", 150, "g"]] }), "storkok");
  // A deleted own dish: not listed, not planned, still shown on days that used it.
  const item = { slot: "lunch", name: "Min gryta", kcal: 600, protein: 50, fat: 20, carbs: 50, ingredients: [["Nötfärs", 200, "g", "Kött och fisk"]] };
  meals.applyDishes({ deleted: { "egen-x": item } });
  assert.ok(meals.dishOf("egen-x") && !meals.isListed("egen-x") && !meals.isVisible("egen-x"));
  assert.ok(!meals.allDishes("huvudratt").some((d) => d.id === "egen-x"));
  meals.applyDishes({ items: { "egen-x": item } });
  assert.ok(meals.isVisible("egen-x") && meals.dishOf("egen-x").kind === "storkok");
  // A switched-off dish is swapped out of the rest of the week for one of the same kind.
  const fish = meals.rolesOf("2026-11-09").F.id;
  meals.applyDishes({ visible: { [fish]: false } });
  const rep = meals.replaceHidden(w, 0);
  assert.ok(!mainsOf(rep).includes(fish));
  assert.ok(rep.days.every((d) => d.meals.every((m) => meals.dishOf(m.dish).kind === meals.dishOf(w.days[0].meals.find((x) => x.slot === m.slot)?.dish)?.kind || true)));
  meals.applyDishes();
  // Damaged data.
  meals.applyDishes({ items: { bad: { slot: "lunch", name: "", kcal: "x" } }, visible: "nope" });
  assert.ok(!meals.dishOf("bad"));
  meals.applyDishes();
  assert.ok(!meals.isWeek({ ...w, days: w.days.slice(1) }));
  assert.ok(!meals.isWeek({ ...w, days: w.days.map((d, i) => (i ? d : { meals: [{ slot: "lunch", dish: 3, portion: 1 }] })) }));
}

// --- Without the food database a dish is one part and planning still works ---
{
  meals.setAnalyzer(null);
  meals.applyDishes();
  const plain = meals.generateWeek("2026-11-09", T);
  assert.ok(plain.days.every((d) => meals.dayTotals(d).protein >= P - 15));
  meals.setAnalyzer(foods.macrosOf);
  meals.applyDishes();
}

// --- Storage layer. There is no localStorage in Node, so every write fails: the catalog must roll back. ---
{
  const dishes = await import("../js/dishes.js");
  const ok = meals.validateDish({ name: "Gryta", ingredients: [["Nötfärs", 200, "g"]], kcal: 400, protein: 40, fat: 20, carbs: 0 }, "lunch");
  assert.equal(dishes.saveDish(null, "lunch", ok.values), null);
  assert.ok(!meals.allDishes("huvudratt").some((d) => d.id.startsWith("egen-")), "failed save leaves no own dish behind");
  assert.equal(dishes.setVisible("lunch-torsk", false), false);
  assert.ok(meals.isVisible("lunch-torsk"), "failed hide is rolled back");
  assert.ok(dishes.offBlock("snack-shake"), "the first top-up can't be switched off");
  assert.equal(ok.values.kind, "storkok");
}

console.log("ok");

// The app's amounts for a dish: typical per ingredient, then the whole dish an ordinary portion.
{
  const f = (name, kcal, protein, fat, carbs) => ({ name, kcal, protein, fat, carbs });
  const salad = [f("Tonfisk i vatten konserv. avrunnen", 116, 26, 1, 0), f("Gurka", 12, 1, 0, 2), f("Tomat", 20, 1, 0, 3),
    f("Spenat färsk", 23, 3, 0, 1), f("Ägg rått", 140, 12, 10, 0), f("Pumpafrö", 580, 30, 49, 5), f("Solrosfrö", 600, 21, 51, 12),
    f("Olivolja", 884, 0, 100, 0), f("Äppelcidervinäger ättiksyra 7%", 20, 0, 0, 1)];
  const grams = meals.suggestGrams(salad, "middag");
  const kcal = grams.reduce((a, gr, i) => a + (salad[i].kcal * gr) / 100, 0);
  assert.ok(kcal > 450 && kcal < 750, `salad ${Math.round(kcal)} kcal`);
  assert.ok(grams[5] <= 25 && grams[6] <= 25, "seeds a sprinkle, not a meat portion");
  assert.ok(grams[8] <= 25, "vinegar a splash");
  assert.ok(grams[0] >= 100, "the fish is the bulk");
  assert.equal(meals.defaultGrams(f("Proteinpulver", 380, 75, 5, 8)), 30);
  assert.equal(meals.validateDish({ name: "x", ingredients: [["Torsk", 200, "g"]], kcal: 160, protein: 36, fat: 1, carbs: 0, auto: true }, "lunch").values.auto, true);
}

// Condiments by name, without catching ordinary foods that mention salt or spice.
{
  const gr = (name, kcal, protein, carbs) => meals.defaultGrams({ name, kcal, protein, fat: 1, carbs });
  assert.equal(gr("Äppelcidervinäger ättiksyra 7%", 20, 0, 1), 15);
  assert.equal(gr("Svartpeppar", 250, 10, 40), 15);
  assert.equal(gr("Ris kokt m. salt", 130, 3, 28), 150);
  assert.equal(gr("Blandfärs stekt tacokryddad", 250, 20, 2), 150);
  assert.equal(gr("Honungsmelon", 36, 1, 8), 100);
  assert.equal(gr("Pepparrot", 70, 2, 12), 100);
  assert.equal(gr("Rättika", 15, 1, 2), 100);
  assert.equal(gr("Ättika 12%", 20, 0, 0), 15);
  assert.equal(meals.legacyGrams({ kcal: 580, protein: 30, fat: 49, carbs: 5 }), 150);
}
