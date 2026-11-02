// Checks the weekly check-in rules in js/checkin.js and js/calc.js. Run: node tools/checkin-test.mjs
import assert from "node:assert/strict";
import * as calc from "../js/calc.js";
import * as checkin from "../js/checkin.js";

// 0.5 %/week is on plan; under 0.25 lowers the target, over 1 raises it.
assert.equal(calc.weighInChange({ weightKg: 82 }, { weightKg: 81.6 }, 7).change, 0);
assert.equal(calc.weighInChange({ weightKg: 82 }, { weightKg: 81.9 }, 7).change, -150);
assert.equal(calc.weighInChange({ weightKg: 82 }, { weightKg: 82.5 }, 7).change, -150, "gaining weight lowers the target");
assert.equal(calc.weighInChange({ weightKg: 82 }, { weightKg: 81 }, 7).change, 150);
assert.equal(calc.weighInChange({ weightKg: 82 }, { weightKg: 81.2 }, 14).change, 0, "rate is per week");

const e = (date, weightKg, extra = {}) => ({ date, weightKg, waistCm: null, checked: false, change: 0, ...extra });
// The first weigh-in has nothing to compare with.
assert.equal(checkin.evaluate([], "2026-11-01", 82, 97).checked, false);
// Too soon after the last one: logged but not compared.
assert.equal(checkin.evaluate([e("2026-11-01", 82)], "2026-11-04", 81.9, null).checked, false);
// A week later: compared.
const week = checkin.evaluate([e("2026-11-01", 82)], "2026-11-08", 81.95, null);
assert.equal(week.checked, true);
assert.equal(week.change, -150);
assert.equal(week.refDate, "2026-11-01");
// At most one comparison per five days, even with daily weigh-ins.
assert.equal(checkin.evaluate([e("2026-11-01", 82), e("2026-11-08", 81.9, { checked: true, change: -150 })], "2026-11-09", 81.8, null).checked, false, "Sunday and Monday do not both count");
assert.equal(checkin.evaluate([e("2026-11-01", 82), e("2026-11-08", 81.9, { checked: true })], "2026-11-13", 81.5, null).checked, true, "five days later it counts again");
// Re-saving the same day re-evaluates it instead of counting it twice.
assert.equal(checkin.evaluate([e("2026-11-01", 82), e("2026-11-08", 81.95, { checked: true, change: -150 })], "2026-11-08", 81.6, null).change, 0);

// Without storage (Node) there is no profile and no log.
assert.deepEqual(checkin.logOf(), []);
assert.equal(checkin.currentTarget(), null);
assert.equal(checkin.due("2026-11-08"), true);
console.log("checkin: all checks passed");
