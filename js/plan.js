// Weekly training plan: template, week creation and the (derived) schedule. No DOM, no storage.
export const DAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];

export const DAILY_MIN = { pullups: 5, pushups: 50 };

// Index = weekday (0 = Monday). Weekend has no pass.
const TEMPLATE = [
  { title: "Push", exercises: [
    { name: "Incline hantelpress", sets: 4, reps: "8–10" },
    { name: "Militärpress med skivstång", sets: 3, reps: "8" },
    { name: "Sidolyft med hantlar", sets: 3, reps: "12" },
    { name: "Triceps french press", sets: 3, reps: "10" },
  ] },
  { title: "Distans", exercises: [
    { name: "Distanslöpning, lugnt tempo", sets: 1, reps: "40 min" },
  ] },
  { title: "Pull", exercises: [
    { name: "Skivstångsrodd", sets: 4, reps: "8" },
    { name: "Enarmsrodd med hantel", sets: 3, reps: "10" },
    { name: "Bakre axel med hantlar", sets: 3, reps: "12" },
    { name: "Bicepscurl", sets: 3, reps: "10" },
  ] },
  { title: "Intervaller", exercises: [
    { name: "Intervall: 1 min hårt, 2 min lugnt", sets: 6, reps: "1 min" },
  ] },
  { title: "Legs", exercises: [
    { name: "Knäböj med skivstång", sets: 4, reps: "8" },
    { name: "Raka marklyft", sets: 3, reps: "8" },
    { name: "Utfall med hantlar", sets: 3, reps: "10" },
    { name: "Vadlyft", sets: 3, reps: "15" },
  ] },
];

export const PASS_DAYS = TEMPLATE.length;

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

export function createWeek(start) {
  return { start, plan: structuredClone(TEMPLATE), done: {}, doneOn: {} };
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
