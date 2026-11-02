// Simulates weeks against js/plan.js. Run: node tools/progression-test.mjs
import assert from "node:assert/strict";
import * as plan from "../js/plan.js";

const starts = ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26", "2026-02-02", "2026-02-09"];
const find = (week, id) => week.plan.flatMap((p) => p?.exercises ?? []).find((e) => e.id === id);

// Runs one week per start date; `full(weekIdx, exId)` says whether that exercise gets all sets checked.
function simulate(n, full) {
  let weeks = {}, progress = {};
  const out = [];
  for (let i = 0; i < n; i++) {
    const adv = plan.advance(weeks, progress, starts[i]);
    const week = plan.createWeek(starts[i], {}, adv.progress);
    weeks = { ...adv.weeks, [starts[i]]: week };
    progress = adv.progress;
    week.plan.forEach((pass, p) => pass?.exercises.forEach((ex, e) => {
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
w0.plan.forEach((pass, p) => pass?.exercises.forEach((ex, e) => { for (let s = 0; s < ex.sets; s++) w0.done[plan.setKey(p, e, s)] = true; }));
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
// Default layout: Push mån, distans tis, Pull ons, intervaller tor, Legs fre, weekend rest.
assert.deepEqual(plan.templateOf(plan.createWeek(starts[0])), plan.DEFAULT_TEMPLATE);
assert.deepEqual(plan.normTemplate(["x"]), plan.DEFAULT_TEMPLATE, "damaged template falls back");

// Changing the layout: a changed day starts over, untouched days keep their checked sets.
let lw = plan.createWeek(starts[0]);
lw = plan.applyToggle(lw, plan.setKey(0, 0, 0), true, 0);
lw = plan.applyToggle(lw, plan.setKey(2, 0, 0), true, 2);
const moved = plan.applyTemplate(lw, ["legs", "distans", "pull", null, "push", "intervaller", "push"]);
assert.equal(moved.plan[0].type, "legs");
assert.equal(moved.plan[3], null, "Thursday is now a rest day");
assert.equal(moved.plan[6].title, "Push", "a pass can be on Sunday, and twice a week");
assert.ok(!moved.done[plan.setKey(0, 0, 0)], "changed day cleared");
assert.ok(moved.done[plan.setKey(2, 0, 0)], "unchanged day kept");
assert.deepEqual(plan.schedule(moved, 0).byDay[3], [], "rest day has nothing");

// An exercise on two days only steps up when both are done.
let twice = plan.createWeek(starts[0], {}, {}, ["push", null, null, null, "push", null, null]);
twice = plan.applyPassDone(twice, 0, true, 0);
assert.equal(plan.evaluateWeek(twice, {})["incline-hantelpress"].streak, 0);
twice = plan.applyPassDone(twice, 4, true, 4);
assert.equal(plan.evaluateWeek(twice, {})["incline-hantelpress"].streak, 1);

// "Pass done" checks every set and stays on the day it was marked on; undoing clears it.
let pd = plan.applyPassDone(plan.createWeek(starts[0]), 0, true, 2);
assert.ok(plan.passProgress(pd, 0).complete);
assert.deepEqual(plan.schedule(pd, 2).byDay[2], [2, 0], "Monday's pass sits on Wednesday where it was marked");
pd = plan.applyPassDone(pd, 0, false, 2);
assert.equal(plan.passProgress(pd, 0).done, 0);
assert.equal(pd.doneOn[0], undefined);

// A missed pass still moves to the next free day, which may now be the weekend.
const missed = plan.createWeek(starts[0]);
assert.equal(plan.schedule(missed, 5).movedTo[0], 5, "Monday's pass moves to Saturday");

// Weeks stored before pass types (five passes) and before slots are upgraded; checked sets survive.
const old5 = plan.createWeek(starts[0]);
const legacy = { start: starts[0], plan: old5.plan.slice(0, 5).map(({ type, ...p }) => p), done: { "4:0:0": true }, doneOn: {} };
const up = plan.upgradeWeek(legacy);
assert.equal(up.plan.length, 7);
assert.equal(up.plan[4].type, "legs");
assert.equal(up.plan[5], null);
assert.ok(up.done["4:0:0"]);
const ancient = { start: starts[0], plan: legacy.plan.map((p) => ({ ...p, exercises: p.exercises.map(({ slot, ...e }) => e) })), done: { "0:1:0": true } };
assert.equal(plan.upgradeWeek(ancient).plan.length, 7);
assert.equal(plan.advance({ [starts[0]]: legacy }, {}, starts[1]).progress["knäböj-skivstång"]?.streak ?? 0, 0, "old weeks can be evaluated");

console.log("progression: all checks passed");
