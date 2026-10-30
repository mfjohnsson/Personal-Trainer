// Weekly training plan: template, week creation and the (derived) schedule. No DOM, no storage.
export const DAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];

export const DAILY_MIN = { pullups: 10, pushups: 50 };

// Each pass has fixed slots (one per muscle group / movement). You pick which exercise fills a slot,
// but a slot can never be empty or doubled, so the pass stays balanced. First option is the default.
// Index = weekday (0 = Monday). Weekend has no pass. Slot order = exercise order in the stored week.
const ex = (id, name, sets, reps) => ({ id, name, sets, reps });
export const CATALOG = [
  { title: "Push", slots: [
    { id: "push-bröst", label: "Bröst", options: [
      ex("incline-hantelpress", "Incline hantelpress", 4, "8–10"),
      ex("bänkpress-skivstång", "Bänkpress med skivstång", 4, "8"),
      ex("golvpress-hantlar", "Golvpress med hantlar", 4, "10"),
    ] },
    { id: "push-axlar", label: "Axlar", options: [
      ex("militärpress-skivstång", "Militärpress med skivstång", 3, "8"),
      ex("axelpress-hantlar", "Axelpress med hantlar", 3, "10"),
      ex("pike-armhävningar", "Pike-armhävningar", 3, "10"),
    ] },
    { id: "push-sidoaxlar", label: "Sidoaxlar", options: [
      ex("sidolyft-hantlar", "Sidolyft med hantlar", 3, "12"),
      ex("upprätt-rodd", "Upprätt rodd med skivstång", 3, "10"),
    ] },
    { id: "push-triceps", label: "Triceps", options: [
      ex("french-press", "Triceps french press", 3, "10"),
      ex("triceps-över-huvudet", "Triceps över huvudet med hantel", 3, "10"),
      ex("smal-bänkpress", "Smal bänkpress", 3, "8"),
      ex("dips-stolar", "Dips mellan stolar", 3, "12"),
    ] },
  ] },
  { title: "Distans", slots: [
    { id: "distans", label: "Kondition", options: [
      ex("distanslöpning", "Distanslöpning, lugnt tempo", 1, "40 min"),
      ex("cykling", "Cykling, lugnt tempo", 1, "50 min"),
    ] },
  ] },
  { title: "Pull", slots: [
    { id: "pull-rodd", label: "Rygg, tung rodd", options: [
      ex("skivstångsrodd", "Skivstångsrodd", 4, "8"),
      ex("hantelrodd-böjd", "Hantelrodd, böjd framåt", 4, "10"),
    ] },
    { id: "pull-rygg2", label: "Rygg, komplettering", options: [
      ex("enarmsrodd", "Enarmsrodd med hantel", 3, "10"),
      ex("pullups", "Pull-ups", 3, "5–8"),
      ex("chinups", "Chins", 3, "5–8"),
    ] },
    { id: "pull-bakaxel", label: "Bakre axel", options: [
      ex("bakre-axel-hantlar", "Bakre axel med hantlar", 3, "12"),
      ex("band-pull-apart", "Band pull-aparts", 3, "15"),
    ] },
    { id: "pull-biceps", label: "Biceps", options: [
      ex("bicepscurl", "Bicepscurl", 3, "10"),
      ex("hammarcurl", "Hammarcurl", 3, "10"),
      ex("skivstångscurl", "Curl med skivstång", 3, "10"),
    ] },
  ] },
  { title: "Intervaller", slots: [
    { id: "intervaller", label: "Kondition", options: [
      ex("intervaller-löpning", "Intervall: 1 min hårt, 2 min lugnt", 6, "1 min"),
    ] },
  ] },
  { title: "Legs", slots: [
    { id: "legs-knäböj", label: "Knäböj", options: [
      ex("knäböj-skivstång", "Knäböj med skivstång", 4, "8"),
      ex("goblet-squat", "Goblet squat med hantel", 4, "10"),
      ex("knäböj-hantlar", "Knäböj med hantlar", 4, "10"),
    ] },
    { id: "legs-höft", label: "Höft och bakre lår", options: [
      ex("rdl-skivstång", "Romanian deadlift med skivstång", 3, "8"),
      ex("rdl-hantlar", "Romanian deadlift med hantlar", 3, "10"),
      ex("rdl-enben", "Enbens Romanian deadlift", 3, "8"),
      ex("hip-thrust", "Hip thrust", 3, "10"),
    ] },
    { id: "legs-enben", label: "Enbensövning", options: [
      ex("utfall-hantlar", "Utfall med hantlar", 3, "10"),
      ex("split-squat", "Bulgarian split squat", 3, "8"),
      ex("enbens-knäböj", "Enbens-knäböj med hantel", 3, "6"),
      ex("gångutfall", "Gångutfall", 3, "12"),
    ] },
    { id: "legs-vader", label: "Vader", options: [
      ex("vadlyft", "Vadlyft", 3, "15"),
      ex("vadlyft-enben", "Enbens vadlyft", 3, "12"),
    ] },
  ] },
];

// Progression. Every exercise has a `step` (0 = catalog start). Two full weeks in a row raise it by one.
// Strength: reps climb through the range first (a lone number n counts as n..n+2); passing the top
// resets reps to the bottom and asks for more weight. Weights are not logged, so the note only says
// how much more than the starting weight. Cardio: more minutes, or one more interval, up to a cap.
const CARDIO = {
  "distanslöpning": { kind: "minutes", base: 40, by: 5, max: 60 },
  "cykling": { kind: "minutes", base: 50, by: 5, max: 75 },
  "intervaller-löpning": { kind: "sets", by: 1, max: 10 },
};
const BODYWEIGHT = new Set(["pike-armhävningar", "dips-stolar", "pullups", "chinups", "band-pull-apart"]);
const KG_PER_TIER = 2.5;
export const WEEKS_FOR_STEP = 2;

const repRange = (reps) => {
  const m = /^(\d+)(?:–(\d+))?$/.exec(reps);
  return m ? [+m[1], m[2] ? +m[2] : +m[1] + 2] : null;
};
const kg = (n) => String(n).replace(".", ",");

export function levelOf(option, step = 0) {
  const c = CARDIO[option.id];
  if (c?.kind === "minutes") return { sets: option.sets, reps: `${Math.min(c.base + c.by * step, c.max)} min` };
  if (c?.kind === "sets") return { sets: Math.min(option.sets + c.by * step, c.max), reps: option.reps };
  const range = repRange(option.reps);
  if (!range || step <= 0) return { sets: option.sets, reps: option.reps };
  const [lo, hi] = range;
  const width = hi - lo + 1, tier = Math.floor(step / width), off = step % width;
  const total = kg(tier * KG_PER_TIER);
  let note;
  if (tier > 0) {
    const how = BODYWEIGHT.has(option.id) ? "extra vikt eller långsammare tempo" : `+${total} kg mot startvikten`;
    note = off === 0 ? `Höj vikten: ${how}` : `Behåll vikten: ${how}`;
  }
  return { sets: option.sets, reps: String(lo + off), ...(note && { note }) };
}

const pick = (slot, id) => slot.options.find((o) => o.id === id) ?? slot.options[0];
const fill = (slot, o, progress = {}) => {
  const { sets, reps, note } = levelOf(o, progress[o.id]?.step ?? 0);
  return { slot: slot.id, id: o.id, name: o.name, sets, reps, ...(note && { note }) };
};

// choices = { slotId: optionId }, your latest pick per slot; unknown ids fall back to the default.
// progress = { exerciseId: { step, streak } }.
function buildPlan(choices, progress) {
  return CATALOG.map((p) => ({
    title: p.title,
    exercises: p.slots.map((slot) => fill(slot, pick(slot, choices[slot.id]), progress)),
  }));
}

export const PASS_DAYS = CATALOG.length;

const pad = (n) => String(n).padStart(2, "0");
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseIso(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return isoDate(d) === s ? d : null;
}

export function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoDate(d);
}

// Day index (0 = Monday) of `today` inside the week starting at `start`; may fall outside 0..6.
export function dayIndex(start, today) {
  const a = parseIso(start), b = parseIso(today);
  return Math.round((b - a) / 86400000);
}

export function createWeek(start, choices = {}, progress = {}) {
  return { start, plan: buildPlan(choices, progress), done: {}, doneOn: {} };
}

const exerciseDone = (week, p, e) => {
  const sets = week.plan[p].exercises[e].sets;
  for (let s = 0; s < sets; s++) if (!week.done[setKey(p, e, s)]) return false;
  return sets > 0;
};

// Folds one finished week into the progress: a fully checked exercise extends its streak (and steps up
// at WEEKS_FOR_STEP), anything else resets it, and so does an exercise that was not in the week.
export function evaluateWeek(week, progress) {
  const next = {};
  for (const [id, v] of Object.entries(progress)) next[id] = { ...v, streak: 0 };
  week.plan.forEach((pass, p) => pass.exercises.forEach((ex, e) => {
    const cur = progress[ex.id] ?? { step: 0, streak: 0 };
    if (!exerciseDone(week, p, e)) next[ex.id] = { step: cur.step, streak: 0 };
    else if (cur.streak + 1 >= WEEKS_FOR_STEP) next[ex.id] = { step: cur.step + 1, streak: 0 };
    else next[ex.id] = { step: cur.step, streak: cur.streak + 1 };
  }));
  return next;
}

// Called once when a new week is about to be created. Evaluates last week (if it exists and has not
// been counted yet); with no last week the streaks reset, since a gap breaks "two weeks in a row".
export function advance(weeks, progress, start) {
  const d = parseIso(start);
  d.setDate(d.getDate() - 7);
  const prevStart = isoDate(d), prev = weeks[prevStart];
  if (!prev) return { weeks, progress: evaluateWeek({ plan: [], done: {} }, progress) };
  if (prev.evaluated) return { weeks, progress };
  return { weeks: { ...weeks, [prevStart]: { ...prev, evaluated: true } }, progress: evaluateWeek(prev, progress) };
}

// Weeks saved before slots existed lack `slot` on their exercises. Rebuild the plan with defaults;
// exercise order and set counts match, so checked sets stay valid.
export function upgradeWeek(week, choices = {}, progress = {}) {
  if (week.plan?.[0]?.exercises?.[0]?.slot) return week;
  return { ...week, plan: buildPlan(choices, progress), doneOn: week.doneOn ?? {} };
}

// Swap the exercise in one slot. Checked sets of that exercise are cleared (the sets differ).
export function applyChoice(week, passDay, exIdx, optionId, progress = {}) {
  const slot = CATALOG[passDay].slots[exIdx];
  const option = slot.options.find((o) => o.id === optionId);
  if (!option) return week;
  const plan = week.plan.map((p, i) => i !== passDay ? p : {
    ...p, exercises: p.exercises.map((e, j) => (j === exIdx ? fill(slot, option, progress) : e)),
  });
  const done = { ...week.done };
  for (const k of Object.keys(done)) if (k.startsWith(`${passDay}:${exIdx}:`)) delete done[k];
  const doneOn = { ...week.doneOn };
  const next = { ...week, plan, done, doneOn };
  if (!passProgress(next, passDay).complete) delete doneOn[passDay];
  return next;
}

export const setKey = (passDay, ex, set) => `${passDay}:${ex}:${set}`;

export function passProgress(week, passDay) {
  const pass = week.plan[passDay];
  let total = 0, done = 0;
  pass.exercises.forEach((ex, e) => {
    for (let s = 0; s < ex.sets; s++) {
      total++;
      if (week.done[setKey(passDay, e, s)]) done++;
    }
  });
  return { total, done, complete: total > 0 && done === total };
}

// Check/uncheck one set. A pass that becomes complete remembers the day it was finished on, so it
// stays there instead of jumping back to its original day.
export function applyToggle(week, key, checked, todayIdx) {
  const done = { ...week.done };
  if (checked) done[key] = true; else delete done[key];
  const doneOn = { ...week.doneOn };
  const passDay = Number(key.split(":")[0]);
  const next = { ...week, done, doneOn };
  if (passProgress(next, passDay).complete) doneOn[passDay] = Math.min(Math.max(todayIdx, 0), 6);
  else delete doneOn[passDay];
  return next;
}

// Which passes sit on which day. A pass finished on another day stays where it was finished. A pass
// from an earlier day that is not complete moves to the next day this week that has no pass of its
// own (and no moved pass yet). If there is none it stays put.
// Returns { byDay: [[passDay, ...] x7], movedTo: { passDay: day } }.
export function schedule(week, todayIdx) {
  const byDay = Array.from({ length: 7 }, (_, d) => (d < PASS_DAYS ? [d] : []));
  const movedTo = {};
  const move = (p, d) => {
    byDay[p] = byDay[p].filter((x) => x !== p);
    byDay[d].push(p);
    movedTo[p] = d;
  };
  for (let p = 0; p < PASS_DAYS; p++) {
    const d = week.doneOn?.[p];
    if (d !== undefined && d !== p && passProgress(week, p).complete) move(p, d);
  }
  for (let p = 0; p < PASS_DAYS && p < todayIdx; p++) {
    if (movedTo[p] !== undefined || passProgress(week, p).complete) continue;
    for (let d = Math.max(todayIdx, 0); d < 7; d++) {
      if (byDay[d].length) continue;
      move(p, d);
      break;
    }
  }
  return { byDay, movedTo };
}
