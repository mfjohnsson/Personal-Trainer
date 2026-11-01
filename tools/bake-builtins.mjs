// Computes kcal, protein, fat and carbs per portion for the built-in dishes from data/livsmedel.json
// and prints them next to the numbers currently in js/meals.js. With --write the new numbers are
// written into the dish(...) lines of js/meals.js. Run: node tools/bake-builtins.mjs [--write]
import fs from "node:fs";
import * as meals from "../js/meals.js";
import * as foods from "../js/foods.js";

const root = new URL("../", import.meta.url);
foods.setData(JSON.parse(fs.readFileSync(new URL("data/livsmedel.json", root), "utf8")));

const rows = [];
for (const { id } of meals.SLOTS) {
  for (const d of meals.allDishes(id)) {
    if (!meals.isBuiltIn(d.id)) continue;
    const base = meals.baseDish(d.id);
    const m = foods.macrosOf(base.ingredients);
    rows.push({ id: d.id, now: m });
    const miss = m.unmatched.length ? `  OMATCHAT: ${m.unmatched.join(", ")}` : "";
    console.log(`${d.id.padEnd(18)} ${String(base.kcal).padStart(4)} kcal ${String(base.protein).padStart(3)} g  ->  ${String(m.kcal).padStart(4)} kcal ${String(m.protein).padStart(3)} g protein ${String(m.fat).padStart(3)} g fett ${String(m.carbs).padStart(3)} g kolh${miss}`);
  }
}

if (process.argv.includes("--write")) {
  const file = new URL("js/meals.js", root);
  let src = fs.readFileSync(file, "utf8");
  for (const r of rows) {
    const re = new RegExp(`(dish\\("${r.id}", "[^"]*"), \\d+, \\d+(?:, \\d+, \\d+)?, \\[`);
    if (!re.test(src)) throw new Error(`dish line not found: ${r.id}`);
    src = src.replace(re, `$1, ${r.now.kcal}, ${r.now.protein}, ${r.now.fat}, ${r.now.carbs}, [`);
  }
  fs.writeFileSync(file, src);
  console.log(`wrote ${rows.length} dishes to js/meals.js`);
}
