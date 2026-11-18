import assert from "node:assert/strict";
import fs from "node:fs";
import * as foods from "../js/foods.js";
import * as meals from "../js/meals.js";
import * as dishes from "../js/dishes.js";
import { get } from "../js/store.js";

const storage = new Map();
Object.defineProperty(globalThis, "localStorage", { value: {
  getItem: (key) => storage.get(key),
  setItem: (key, value) => storage.set(key, value),
} });
const db = JSON.parse(fs.readFileSync(new URL("../data/livsmedel.json", import.meta.url), "utf8"));
foods.setData(db);
assert.equal(foods.lookup("Kyckling file")[0].nummer, 1173);
assert.equal(foods.lookup("Kyklingfile")[0].suggested, true);
assert.ok(foods.lookup("kvarngryn original").some((food) => food.suggested));
const own = foods.saveOwnFood("Kvarngryn", { kcal: 340, protein: 12, fat: 3, carbs: 65 });
assert.ok(own);
foods.setData(db);
assert.equal(foods.lookup("kvarngryn")[0].nummer, own.nummer);

dishes.init();
const week = meals.generateWeek("2026-11-16", { kcal: 2200, protein: 160 });
const breakfast = (w, day) => w.days[day].meals.find((meal) => meal.slot === "frukost");
const changed = meals.replaceIngredient(week, 1, "frukost", 0, own, 80);
assert.ok(meals.isWeek(changed));
const before = meals.mealInfo(breakfast(changed, 1));
assert.equal(before.ingredients[0].amount, 0);
assert.equal(before.ingredients.at(-1).amount, 80);
const switched = meals.replaceIngredient(changed, 1, "frukost", 0, own, 60);
assert.equal(breakfast(switched, 1).add.length, 1);
const restored = meals.restoreIngredient(switched, 1, "frukost", 0);
assert.equal(breakfast(restored, 1).add.length, 0);
assert.ok(meals.mealInfo(breakfast(restored, 1)).ingredients[0].amount > 0);

const complete = { ...changed, days: changed.days.map((day, i) => i === 0 ? { ...day, done: true } : day) };
const historical = meals.mealInfo(breakfast(complete, 0));
const id = breakfast(complete, 1).dish;
const recipe = meals.dishOf(id);
const ingredients = [[own.name, 100, "g", meals.categoryOf(own.name), own.nummer]];
const { values, errors } = meals.validateDish({ ...recipe, ...foods.macrosOf(ingredients), ingredients }, recipe.slot);
assert.deepEqual(errors, {});
assert.ok(dishes.updateFromMeal(id, values, complete, 1, "frukost"));
const saved = get("meals")[week.start];
assert.deepEqual(meals.mealInfo(breakfast(saved, 0)), historical);
assert.deepEqual(meals.mealInfo(breakfast(saved, 1)), before);
assert.equal(meals.dishOf(id).ingredients[0][0], "Kvarngryn");
assert.equal(breakfast(saved, 2).dish, id);
assert.ok(dishes.saveDish(null, recipe.slot, { ...values, name: "Variant" }));
console.log("meal editing: all checks passed");
