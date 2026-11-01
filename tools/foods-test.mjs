// Checks the food database file and the macro calculation. Run: node tools/foods-test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import * as foods from "../js/foods.js";
import * as meals from "../js/meals.js";

const json = JSON.parse(fs.readFileSync(new URL("../data/livsmedel.json", import.meta.url), "utf8"));
assert.deepEqual(json.fields, ["nummer", "namn", "kcal", "protein", "fett", "kolh"]);
assert.ok(json.foods.length > 2500, "whole database present");
assert.ok(json.foods.every((f) => f.length === 6 && typeof f[1] === "string" && f.slice(2).every((v) => Number.isFinite(v) && v >= 0 && v <= 1000)), "rows are well formed");
assert.equal(new Set(json.foods.map((f) => f[0])).size, json.foods.length, "unique numbers");
assert.ok(/CC BY 4\.0/.test(json.source), "license credit kept in the file");
foods.setData(json);

// Every preferred food exists, and every built-in ingredient gets a match.
for (const [name, nr] of Object.entries(foods.PREFERRED)) assert.ok(foods.foodByNumber(nr), `${name} -> ${nr}`);
for (const { id } of meals.SLOTS) {
  for (const d of meals.allDishes(id)) {
    if (!meals.isBuiltIn(d.id)) continue;
    const m = foods.macrosOf(meals.baseDish(d.id).ingredients);
    assert.deepEqual(m.unmatched, [], `${d.id} has ingredients without a food`);
    // The numbers stored in meals.js were baked from this calculation; they must not drift apart.
    for (const [k, v] of [["kcal", d.kcal], ["protein", d.protein], ["fat", d.fat], ["carbs", d.carbs]]) {
      assert.equal(m[k], v, `${d.id} ${k}: run node tools/bake-builtins.mjs --write`);
    }
    assert.ok([d.kcal, d.protein, d.fat, d.carbs].every((v) => Number.isFinite(v) && v >= 0));
  }
}

// Weights and arithmetic.
assert.deepEqual(foods.gramsOf(200, "g", "Ris"), { grams: 200, estimated: false });
assert.deepEqual(foods.gramsOf(2, "st", "Ägg"), { grams: 120, estimated: true });
assert.equal(foods.gramsOf(3, "dl", "Mjölk").grams, 309);
assert.equal(foods.gramsOf(2, "skivor", "Proteinbröd").grams, 60);
const egg = foods.macrosOf([["Ägg", 2, "st", "Mejeri och ägg"]]); // 120 g of "Ägg rått" (136 kcal, 12,1 g protein per 100 g)
assert.equal(egg.kcal, Math.round(1.2 * 136));
assert.equal(egg.protein, Math.round(1.2 * 12.1));
const picked = foods.macrosOf([["Ägg", 100, "g", "x"]], { 0: 1226 }); // a chosen food overrides the automatic match
assert.equal(picked.kcal, 325);
assert.equal(foods.macrosOf([["Ägg", 100, "g", "x", 1227]]).kcal, 48, "a stored food number is used");
assert.deepEqual(foods.macrosOf([["Xyzzyq", 100, "g", "x"]]).unmatched, ["Xyzzyq"]);

// Search: compound words, synonyms, nothing found.
assert.ok(foods.search("Kycklingfilé").length > 0 && /kyckling/i.test(foods.search("Kycklingfilé")[0].name));
assert.ok(/kokt/i.test(foods.search("Quinoa tillagad")[0].name), "tillagad finds kokt");
assert.ok(foods.search("avokado")[0].name.toLowerCase().startsWith("avokado"));
assert.deepEqual(foods.search("qqqqqq"), []);
assert.deepEqual(foods.search(""), []);
// Short names go to a plain food, not to a ready dish that merely contains the word.
for (const [name, want] of [["Nötfärs", /^Nöt färs rå/], ["Lax", /^Lax odlad/], ["Kyckling", /^Kyckling bröstfilé rå u/], ["Quinoa", /quinoa.*kokt/i], ["Fullkornsris", /^Ris .*kokt/], ["Yoghurt", /^Yoghurt naturell/]]) {
  assert.ok(want.test(foods.match(name).name), `${name} -> ${foods.match(name).name}`);
  assert.ok(foods.isPreferred(name), name);
}
assert.equal(foods.isPreferred("Xyzzyq"), false);
// "fil" means filmjölk, not fillet: 1 dl of a fillet is not 103 g.
assert.equal(foods.gramsOf(1, "dl", "Laxfilé").grams, 100);
assert.equal(foods.gramsOf(1, "dl", "Filmjölk").grams, 103);
console.log(`ok: ${json.foods.length} foods, all built-in dishes match the database`);
