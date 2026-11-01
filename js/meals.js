// Weekly meal plan: dish database and generator. No DOM, no storage.
// Structure is locked: breakfast, lunch, snack, dinner. Lunch protein, snack and dinner rotate over the
// week; every day's portions are scaled so the day lands on the calorie and protein target.
export const SLOTS = [
  { id: "frukost", label: "Frukost" },
  { id: "lunch", label: "Lunch" },
  { id: "mellanmal", label: "Mellanmål" },
  { id: "middag", label: "Middag" },
];

const KOTT = "Kött och fisk", MEJERI = "Mejeri och ägg", BROD = "Bröd och spannmål", GRONT = "Frukt och grönt", SKAFFERI = "Skafferi";
const g = (name, amount, cat) => [name, amount, "g", cat];
const dish = (id, name, kcal, protein, fat, carbs, ingredients) => ({ id, name, kcal, protein, fat, carbs, ingredients });

// A dish that is built in but not offered until the user turns it on (turkey: expensive, hard to find).
const off = (d) => ({ ...d, hidden: true });

// Built-in dishes; kcal, protein, fat and carbs are per one portion, worked out from the ingredients
// and Livsmedelsverket's food database by tools/bake-builtins.mjs (cooking oil is not counted unless listed). The visible,
// editable catalog is DISHES below.
const BASE = {
  frukost: [
    dish("frukost", "Proteinbröd, ägg och tomat", 335, 29, 17, 13, [
      ["Proteinbröd", 2, "skivor", BROD], ["Ägg", 2, "st", MEJERI], ["Tomat", 1, "st", GRONT]]),
  ],
  lunch: [
    dish("lunch-kyckling", "Kyckling, quinoa och grönsaker", 442, 54, 6, 36, [
      g("Kycklingfilé", 200, KOTT), g("Quinoa, tillagad", 150, BROD), g("Grönsaker", 100, GRONT)]),
    dish("lunch-lax", "Lax, matvete och grönsaker", 711, 48, 29, 55, [
      g("Laxfilé", 200, KOTT), g("Matvete, tillagat", 150, BROD), g("Grönsaker", 100, GRONT)]),
    dish("lunch-notfars", "Nötfärs, fullkornspasta och grönsaker", 630, 50, 24, 49, [
      g("Nötfärs 10 %", 200, KOTT), g("Fullkornspasta, tillagad", 150, BROD), g("Grönsaker", 100, GRONT)]),
    dish("lunch-torsk", "Torsk, fullkornsris och grönsaker", 387, 43, 3, 45, [
      g("Torskfilé", 200, KOTT), g("Fullkornsris, tillagat", 150, BROD), g("Grönsaker", 100, GRONT)]),
    off(dish("lunch-kalkon", "Kalkon, matvete och grönsaker", 503, 56, 3, 54, [
      g("Kalkonfilé", 200, KOTT), g("Matvete, tillagat", 150, BROD), g("Grönsaker", 100, GRONT)])),
    dish("lunch-makrill", "Makrill i tomatsås, fullkornsris och grönsaker", 603, 29, 30, 52, [
      g("Makrill i tomatsås", 200, KOTT), g("Fullkornsris, tillagat", 150, BROD), g("Grönsaker", 100, GRONT)]),
    dish("lunch-bonchili", "Bönchili med nötfärs och ris", 536, 39, 16, 54, [
      g("Nötfärs 10 %", 120, KOTT), g("Kidneybönor, kokta", 120, SKAFFERI), g("Krossade tomater", 100, SKAFFERI),
      g("Fullkornsris, tillagat", 120, BROD)]),
    dish("lunch-tonfisk", "Tonfisk, quinoa och grönsaker", 446, 56, 6, 36, [
      g("Tonfisk i vatten", 200, KOTT), g("Quinoa, tillagad", 150, BROD), g("Grönsaker", 100, GRONT)]),
    dish("lunch-flask", "Fläskfilé, fullkornsris och grönsaker", 445, 47, 7, 45, [
      g("Fläskfilé", 200, KOTT), g("Fullkornsris, tillagat", 150, BROD), g("Grönsaker", 100, GRONT)]),
  ],
  mellanmal: [
    dish("snack-shake", "Proteinshake", 302, 35, 11, 16, [
      g("Proteinpulver", 30, SKAFFERI), ["Mjölk", 3, "dl", MEJERI]]),
    dish("snack-yoghurt", "Turkisk yoghurt, jordnötssmör och bär", 407, 13, 29, 22, [
      g("Turkisk yoghurt", 250, MEJERI), g("Jordnötssmör", 15, SKAFFERI), g("Bär", 80, GRONT)]),
    dish("snack-keso", "Keso, frukt och nötter", 461, 32, 26, 22, [
      g("Keso", 200, MEJERI), ["Frukt", 1, "st", GRONT], g("Nötter", 30, SKAFFERI)]),
  ],
  middag: [
    dish("middag-kyckling", "Ugnskyckling med rotfrukter och sallad", 375, 50, 9, 19, [
      g("Kycklingfilé", 200, KOTT), g("Rotfrukter", 250, GRONT), g("Sallad", 100, GRONT)]),
    dish("middag-lax", "Lax i ugn med potatis och broccoli", 567, 39, 22, 47, [
      g("Laxfilé", 150, KOTT), g("Potatis", 250, GRONT), g("Broccoli", 150, GRONT)]),
    dish("middag-farssas", "Köttfärssås med zucchini och lite pasta", 566, 38, 19, 55, [
      g("Nötfärs 10 %", 150, KOTT), g("Krossade tomater", 200, SKAFFERI), g("Zucchini", 300, GRONT), g("Fullkornspasta, torr", 60, BROD)]),
    dish("middag-wok", "Wokad fläskfilé med grönsaker och ris", 493, 46, 10, 48, [
      g("Fläskfilé", 180, KOTT), g("Wokgrönsaker", 250, GRONT), g("Fullkornsris, torrt", 50, BROD)]),
    dish("middag-biff", "Biff med potatis och ugnsgrönsaker", 492, 45, 14, 41, [
      g("Biff", 180, KOTT), g("Potatis", 150, GRONT), g("Ugnsgrönsaker", 250, GRONT)]),
    off(dish("middag-kalkon", "Kalkonburgare med sötpotatis och sallad", 421, 59, 8, 23, [
      g("Kalkonfärs", 200, KOTT), ["Ägg", 1, "st", MEJERI], g("Sötpotatis", 150, GRONT), g("Sallad", 150, GRONT)])),
    dish("middag-makrill", "Ugnsbakad makrill med potatis och broccoli", 687, 34, 39, 46, [
      g("Makrillfilé", 150, KOTT), g("Potatis", 250, GRONT), g("Broccoli", 150, GRONT)]),
    dish("middag-bonor", "Kyckling med vita bönor i tomatsås", 406, 58, 4, 28, [
      g("Kycklingfilé", 180, KOTT), g("Vita bönor, kokta", 150, SKAFFERI), g("Krossade tomater", 150, SKAFFERI), g("Spenat", 100, GRONT)]),
    dish("middag-torsk", "Torsk i ugn med potatis och morötter", 408, 42, 2, 51, [
      g("Torskfilé", 200, KOTT), g("Potatis", 250, GRONT), g("Morötter", 150, GRONT)]),
  ],
};

// --- Catalog: the built-in dishes plus the user's own changes (stored by dishes.js) ---

const SLOT_IDS = SLOTS.map((s) => s.id);
// How many dishes a meal needs on offer: two keep a lunch, snack or dinner from landing two days in a
// row; breakfast may be the same every day, so one is enough.
export const minDishes = (slot) => (slot === "frukost" ? 1 : 2);
// Dishes offered in pickers and used by the generator. Filled by applyDishes; the arrays keep their identity.
export const DISHES = { frukost: [], lunch: [], mellanmal: [], middag: [] };
const dishById = new Map(); // every dish, hidden ones too, so weeks already planned keep resolving
const shown = new Set();
export const dishOf = (id) => dishById.get(id);
export const isVisible = (id) => shown.has(id);

function register(slot, d, show) {
  const full = { ...d, slot };
  dishById.set(full.id, full);
  if (show) { shown.add(full.id); DISHES[slot].push(full); }
}

// overlay = { items: { [id]: { slot, name, kcal, protein, ingredients } }, visible: { [id]: boolean } }.
// An item with a built-in id replaces that dish; any other id is a dish of the user's own.
const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v) => typeof v === "number" && Number.isFinite(v);
const validItem = (it) => isObject(it) && SLOT_IDS.includes(it.slot) && typeof it.name === "string" && it.name !== ""
  && finite(it.kcal) && finite(it.protein) && finite(it.fat) && finite(it.carbs) && Array.isArray(it.ingredients) && it.ingredients.length > 0
  && it.ingredients.every((i) => Array.isArray(i) && typeof i[0] === "string" && finite(i[1]) && i[1] > 0 && typeof i[2] === "string");

// Stored data may be damaged; anything malformed is ignored rather than allowed to break the app.
export function applyDishes(overlay = {}) {
  const raw = isObject(overlay) ? overlay : {};
  const items = Object.fromEntries(Object.entries(isObject(raw.items) ? raw.items : {}).filter(([, it]) => validItem(it)));
  const visible = isObject(raw.visible) ? raw.visible : {};
  dishById.clear(); shown.clear();
  for (const slot of SLOT_IDS) DISHES[slot].length = 0;
  const builtIn = new Set();
  for (const slot of SLOT_IDS) {
    for (const b of BASE[slot]) {
      builtIn.add(b.id);
      const { hidden, ...plain } = b;
      const d = items[b.id] ? { ...items[b.id], id: b.id } : plain;
      register(slot, d, visible[b.id] ?? !hidden);
    }
  }
  for (const [id, it] of Object.entries(items)) {
    if (!builtIn.has(id) && SLOT_IDS.includes(it.slot)) register(it.slot, { ...it, id }, visible[id] ?? true);
  }
  // Damaged or hand-edited flags must not leave a meal without enough dishes (nothing could be planned).
  for (const slot of SLOT_IDS) {
    for (const d of dishById.values()) {
      if (DISHES[slot].length >= minDishes(slot)) break;
      if (d.slot === slot && !shown.has(d.id)) { shown.add(d.id); DISHES[slot].push(d); }
    }
  }
}
applyDishes();

export const isBuiltIn = (id) => SLOT_IDS.some((s) => BASE[s].some((b) => b.id === id));
export const baseDish = (id) => SLOT_IDS.flatMap((s) => BASE[s]).find((b) => b.id === id);

// Every dish in a slot, hidden ones too, for the editor.
export const allDishes = (slot) => [...dishById.values()].filter((d) => d.slot === slot);

export const UNITS = ["g", "dl", "st", "skivor"];
const num = (v) => { const s = String(v ?? "").trim().replace(",", "."); return s === "" ? NaN : Number(s); };

// Typed ingredients get the category of a known ingredient with the same name, else Skafferi.
function categoryOf(name) {
  const key = name.toLowerCase();
  for (const d of dishById.values()) for (const [n, , , cat] of d.ingredients) if (n.toLowerCase() === key) return cat;
  return SKAFFERI;
}

// One ingredient per line: "200 g Kycklingfilé". Returns { ingredients } or { error }.
export function parseIngredients(text) {
  const lines = String(text ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  if (!lines.length) return { error: "Lägg till minst en ingrediens." };
  if (lines.length > 12) return { error: "Högst 12 ingredienser." };
  const ingredients = [];
  for (const [i, line] of lines.entries()) {
    const m = /^(\d+(?:[.,]\d+)?)\s*(g|dl|st|skivor)\s+(\S.*)$/i.exec(line);
    if (!m || !(num(m[1]) > 0 && num(m[1]) <= 5000) || m[3].length > 40) {
      return { error: `Rad ${i + 1}: skriv till exempel "200 g Kycklingfilé". Enheter: ${UNITS.join(", ")}.` };
    }
    ingredients.push([m[3], num(m[1]), m[2].toLowerCase(), categoryOf(m[3])]);
  }
  return { ingredients };
}

export const formatIngredients = (list) => list.map(([n, a, u]) => `${String(a).replace(".", ",")} ${u} ${n}`).join("\n");

// raw = { name, kcal, protein, fat, carbs, ingredients: text }. Returns { values, errors } like calc.validate.
export function validateDish(raw) {
  const errors = {};
  const name = String(raw.name ?? "").trim();
  if (!name) errors.name = "Ange ett namn.";
  else if (name.length > 60) errors.name = "Högst 60 tecken.";
  const kcal = num(raw.kcal), protein = num(raw.protein), fat = num(raw.fat), carbs = num(raw.carbs);
  if (!(kcal >= 50 && kcal <= 2500)) errors.kcal = "Ange kalorier mellan 50 och 2 500.";
  if (!(protein >= 0 && protein <= 250)) errors.protein = "Ange protein mellan 0 och 250 g.";
  if (!(fat >= 0 && fat <= 250)) errors.fat = "Ange fett mellan 0 och 250 g.";
  if (!(carbs >= 0 && carbs <= 400)) errors.carbs = "Ange kolhydrater mellan 0 och 400 g.";
  const parsed = parseIngredients(raw.ingredients);
  if (parsed.error) errors.ingredients = parsed.error;
  const round = Math.round;
  return { values: { name, kcal: round(kcal), protein: round(protein), fat: round(fat), carbs: round(carbs), ingredients: parsed.ingredients }, errors };
}

// Allowed portion factor per slot. Wide enough to reach the target, narrow enough to stay a real meal.
const BOUNDS = { frukost: [0.8, 1.5], lunch: [0.7, 1.5], mellanmal: [0.7, 1.6], middag: [0.7, 1.6] };
const STEP = 0.05;

export const KCAL_TOLERANCE = 0.05; // of the calorie target
export const PROTEIN_TOLERANCE = 10; // grams

// Scales (one per meal) that hit both totals exactly while staying as close to 1 as possible, within
// bounds. Minimum-norm solution of two linear equations; meals that hit a bound are pinned and the
// rest re-solved.
function solveScales(meals, bounds, kcal, protein) {
  const s = meals.map(() => 1);
  const pinned = new Set();
  for (let round = 0; round <= meals.length; round++) {
    const free = meals.map((_, i) => i).filter((i) => !pinned.has(i));
    if (!free.length) break;
    let rk = kcal, rp = protein;
    meals.forEach((m, i) => { if (pinned.has(i)) { rk -= s[i] * m.kcal; rp -= s[i] * m.protein; } });
    let a = 0, b = 0, c = 0, rhs1 = rk, rhs2 = rp;
    for (const i of free) { a += meals[i].kcal ** 2; b += meals[i].kcal * meals[i].protein; c += meals[i].protein ** 2; rhs1 -= meals[i].kcal; rhs2 -= meals[i].protein; }
    const det = a * c - b * b;
    if (Math.abs(det) < 1e-9) break;
    const l1 = (rhs1 * c - rhs2 * b) / det, l2 = (a * rhs2 - b * rhs1) / det;
    let clamped = false;
    for (const i of free) {
      const v = 1 + l1 * meals[i].kcal + l2 * meals[i].protein;
      const [lo, hi] = bounds[i];
      s[i] = Math.min(hi, Math.max(lo, v));
      if (s[i] !== v) { pinned.add(i); clamped = true; }
    }
    if (!clamped) break;
  }
  return s;
}

const roundStep = (v) => Math.round(v / STEP) * STEP;

// One day from one dish per slot: returns the rounded portions, the resulting totals and a cost
// (how far from the target and how far from a normal portion).
function fitDay(dishes, target) {
  const bounds = SLOTS.map((s) => BOUNDS[s.id]);
  const scales = solveScales(dishes, bounds, target.kcal, target.protein)
    .map((v, i) => Math.min(bounds[i][1], Math.max(bounds[i][0], roundStep(v))));
  const totals = totalsOf(dishes, scales);
  // Misses only count beyond a small band, well inside the tolerance, so many combinations qualify
  // and variety can decide between them.
  const missK = Math.max(0, Math.abs(totals.kcal - target.kcal) / target.kcal * 100 - 2);
  const missP = Math.max(0, Math.abs(totals.protein - target.protein) - 6);
  const cost = scales.reduce((a, v) => a + (v - 1) ** 2, 0) + 5 * missK ** 2 + missP ** 2;
  return { scales, totals, cost };
}

function totalsOf(dishes, scales) {
  return {
    kcal: Math.round(dishes.reduce((a, d, i) => a + d.kcal * scales[i], 0)),
    protein: Math.round(dishes.reduce((a, d, i) => a + d.protein * scales[i], 0)),
  };
}

// Small deterministic jitter so different weeks pick different combinations.
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const seedOf = (start) => Number(start.replaceAll("-", "")) || 1;

// The dishes on a week's menu: everything shown, except what the user left out of that week (a list
// of ids). A meal never gets fewer than minDishes: if fewer would remain, the first left-out ones in
// catalog order are put back, so a week can always be planned.
export function poolFor(off = []) {
  const skip = new Set(off);
  return Object.fromEntries(SLOT_IDS.map((slot) => {
    const on = DISHES[slot].filter((d) => !skip.has(d.id));
    const min = minDishes(slot);
    const back = on.length >= min ? [] : DISHES[slot].filter((d) => skip.has(d.id)).slice(0, min - on.length);
    return [slot, DISHES[slot].filter((d) => on.includes(d) || back.includes(d))];
  }));
}

// target = { kcal, protein }; prevSnack = id of last week's final snack (so the rule holds across weeks).
// Returns { start, target, days: [{ meals: [{ slot, dish, portion }] }] }.
// `pool` limits the dishes to plan from (see poolFor); it defaults to everything shown.
export function generateWeek(start, target, prevSnack = null, pool = DISHES) {
  const rand = rng(seedOf(start));
  const used = {};
  const days = [];
  let prev = { lunch: null, mellanmal: prevSnack, middag: null };
  for (let d = 0; d < 7; d++) {
    let best = null;
    for (const f of pool.frukost) for (const l of pool.lunch) for (const m of pool.mellanmal) for (const n of pool.middag) {
      if (m.id === prev.mellanmal || l.id === prev.lunch || n.id === prev.middag) continue;
      const dishes = [f, l, m, n];
      const fit = fitDay(dishes, target);
      const variety = 0.15 * ((used[f.id] ?? 0) + (used[l.id] ?? 0) + (used[m.id] ?? 0) + (used[n.id] ?? 0)) + 0.6 * rand();
      const cost = fit.cost + variety;
      if (!best || cost < best.cost) best = { ...fit, cost, dishes };
    }
    best.dishes.forEach((x) => { used[x.id] = (used[x.id] ?? 0) + 1; });
    prev = { lunch: best.dishes[1].id, mellanmal: best.dishes[2].id, middag: best.dishes[3].id };
    days.push({ meals: best.dishes.map((x, i) => ({ slot: SLOTS[i].id, dish: x.id, portion: best.scales[i] })) });
  }
  return { start, target, days };
}

// Scaled numbers for one planned meal: kcal, protein and ingredient amounts.
export function mealInfo(meal) {
  const d = dishOf(meal.dish);
  const q = meal.portion;
  return {
    name: d.name,
    kcal: Math.round(d.kcal * q),
    protein: Math.round(d.protein * q),
    fat: Math.round(d.fat * q),
    carbs: Math.round(d.carbs * q),
    ingredients: d.ingredients.map(([name, amount, unit, category]) => ({
      name, unit, category,
      amount: unit === "g" ? Math.round((amount * q) / 5) * 5
        : unit === "dl" ? Math.round(amount * q * 10) / 10
          : Math.max(1, Math.round(amount * q)), // whole pieces: eggs and fruit
    })),
  };
}

export function dayTotals(day) {
  return day.meals.reduce((a, m) => {
    const i = mealInfo(m);
    return { kcal: a.kcal + i.kcal, protein: a.protein + i.protein, fat: a.fat + i.fat, carbs: a.carbs + i.carbs };
  }, { kcal: 0, protein: 0, fat: 0, carbs: 0 });
}

const dayFrom = (dishes, target) => {
  const fit = fitDay(dishes, target);
  return { meals: dishes.map((d, k) => ({ slot: SLOTS[k].id, dish: d.id, portion: fit.scales[k] })) };
};

// Returns a copy of the week where one slot of one day uses another dish. The day's portions are
// re-fitted to the target. Some combinations can't reach it within normal portions; the view flags
// those. Null for an unknown day, slot or dish.
export function changeDish(week, dayIdx, slot, dishId) {
  const slotIdx = SLOTS.findIndex((s) => s.id === slot);
  const chosen = dishOf(dishId);
  const day = week.days[dayIdx];
  if (slotIdx < 0 || chosen?.slot !== slot || !day) return null;
  const dishes = day.meals.map((m, i) => (i === slotIdx ? chosen : dishOf(m.dish)));
  return { ...week, days: week.days.map((x, i) => (i === dayIdx ? dayFrom(dishes, week.target) : x)) };
}

// A stored week with the shape the views rely on (stored data can be damaged).
export const isWeek = (w) => isObject(w) && isObject(w.target) && Array.isArray(w.days) && w.days.length === 7
  && w.days.every((d) => isObject(d) && Array.isArray(d.meals) && d.meals.length === SLOTS.length
    && d.meals.every((m) => isObject(m) && typeof m.dish === "string" && finite(m.portion)));

// Re-fits every day that uses one of `ids` (a set of dish ids), after those dishes were edited.
export function refitWeek(week, ids) {
  const days = week.days.map((day) => (day.meals.some((m) => ids.has(m.dish)) && day.meals.every((m) => dishOf(m.dish))
    ? dayFrom(day.meals.map((m) => dishOf(m.dish)), week.target) : day));
  return { ...week, days };
}

export const withinTarget = (totals, target) =>
  Math.abs(totals.kcal - target.kcal) <= target.kcal * KCAL_TOLERANCE
  && Math.abs(totals.protein - target.protein) <= PROTEIN_TOLERANCE;
