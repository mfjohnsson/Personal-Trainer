// Simulates weeks against js/plan.js. Run: node tools/progression-test.mjs
import assert from "node:assert/strict";
import * as plan from "../js/plan.js";

const starts = ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26", "2026-02-02", "2026-02-09"];
const find = (week, id) => week.plan.flatMap((p) => p.exercises).find((e) => e.id === id);

// Runs one week per start date; `full(weekIdx, exId)` says whether that exercise gets all sets checked.
function simulate(n, full) {
  let weeks = {}, progress = {};
  const out = [];
  for (let i = 0; i < n; i++) {
    const adv = plan.advance(weeks, progress, starts[i]);
    const week = plan.createWeek(starts[i], {}, adv.progress);
    weeks = { ...adv.weeks, [starts[i]]: week };
    progress = adv.progress;
    week.plan.forEach((pass, p) => pass.exercises.forEach((ex, e) => {
      if (full(i, ex.id)) for (let s = 0; s < ex.sets; s++) week.done[plan.setKey(p, e, s)] = true;
    }));
    out.push(week);
  }
  return out;
}
const reps = (weeks, id) => weeks.map((w) => find(w, id).reps);

// Two full weeks -> step up in week 3; reps climb inside the range before weight (8–10).
let w = simulate(6, () => true);
assert.deepEqual(reps(w, "incline-hantelpress"), ["8–10", "8–10", "9", "9", "10", "10"]);
// Third level-up passes the top: reps reset, weight note appears.
assert.match(plan.levelOf({ id: "incline-hantelpress", sets: 4, reps: "8–10" }, 3).note, /Höj vikten.*2,5 kg/);
assert.equal(plan.levelOf({ id: "incline-hantelpress", sets: 4, reps: "8–10" }, 3).reps, "8");
assert.equal(plan.levelOf({ id: "bänkpress-skivstång", sets: 4, reps: "8" }, 2).reps, "10");
assert.equal(plan.levelOf({ id: "bänkpress-skivstång", sets: 4, reps: "8" }, 3).reps, "8");

// One missed set keeps the level and breaks the streak.
w = simulate(5, (i, id) => !(id === "incline-hantelpress" && i === 1));
assert.deepEqual(reps(w, "incline-hantelpress"), ["8–10", "8–10", "8–10", "8–10", "9"]);

// Cardio: minutes and intervals grow after two full weeks.
w = simulate(3, () => true);
assert.equal(find(w[2], "distanslöpning").reps, "45 min");
assert.equal(find(w[2], "intervaller-löpning").sets, 7);
assert.equal(plan.levelOf({ id: "distanslöpning", sets: 1, reps: "40 min" }, 99).reps, "60 min");

// Gap in weeks resets the streak; re-running advance does not double count.
let weeks = {}, progress = {};
let a = plan.advance(weeks, progress, starts[0]);
const w0 = plan.createWeek(starts[0], {}, a.progress);
w0.plan.forEach((pass, p) => pass.exercises.forEach((ex, e) => { for (let s = 0; s < ex.sets; s++) w0.done[plan.setKey(p, e, s)] = true; }));
weeks = { [starts[0]]: w0 };
a = plan.advance(weeks, a.progress, starts[1]);
assert.equal(a.progress["incline-hantelpress"].streak, 1);
assert.equal(plan.advance(a.weeks, a.progress, starts[1]).progress["incline-hantelpress"].streak, 1);
a = plan.advance(a.weeks, a.progress, starts[3]); // weeks 1-2 missing
assert.equal(a.progress["incline-hantelpress"].streak, 0);

// Swapping an exercise uses that exercise's own level.
const wk = plan.createWeek(starts[0], {}, { "bänkpress-skivstång": { step: 1, streak: 0 } });
const sw = plan.applyChoice(wk, 0, 0, "bänkpress-skivstång", { "bänkpress-skivstång": { step: 1, streak: 0 } });
assert.equal(sw.plan[0].exercises[0].reps, "9");
console.log("progression: all checks passed");
