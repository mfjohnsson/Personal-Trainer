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
// Lunch and dinner share their dishes ("huvudrätter"); a dish can be limited to one of them.
export const MAIN = ["lunch", "middag"];
const isMain = (slot) => MAIN.includes(slot);
// The meals a dish can be planned for. Breakfasts and snacks stay in their own meal.
const mealsOf = (slot, meals) => {
  if (!isMain(slot)) return [slot];
  const ok = Array.isArray(meals) ? MAIN.filter((m) => meals.includes(m)) : [];
  return ok.length ? ok : MAIN;
};
export const fits = (d, slot) => !!d && d.meals.includes(slot);

// How many dishes a meal needs on offer: two keep a lunch, snack or dinner from landing two days in a
// row; breakfast may be the same every day, so one is enough.
export const minDishes = (slot) => (slot === "frukost" ? 1 : 2);
// Dishes offered in pickers and used by the generator, per meal. A main dish is in both lunch and
// dinner unless limited. Filled by applyDishes; the arrays keep their identity.
export const DISHES = { frukost: [], lunch: [], mellanmal: [], middag: [] };
const dishById = new Map(); // every dish, hidden ones too, so weeks already planned keep resolving
const shown = new Set();
export const dishOf = (id) => dishById.get(id);
export const isVisible = (id) => shown.has(id);

function register(slot, d, show) {
  const full = { ...d, slot, meals: mealsOf(slot, d.meals) };
  dishById.set(full.id, full);
  if (show) { shown.add(full.id); for (const m of full.meals) DISHES[m].push(full); }
}

// overlay = { items: { [id]: { slot, name, kcal, protein, fat, carbs, ingredients, meals? } }, visible: { [id]: boolean } }.
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
    if (!builtIn.has(id)) register(it.slot, { ...it, id }, visible[id] ?? true);
  }
  // Damaged or hand-edited flags must not leave a meal without enough dishes (nothing could be planned).
  for (const slot of SLOT_IDS) {
    for (const d of dishById.values()) {
      if (DISHES[slot].length >= minDishes(slot)) break;
      if (fits(d, slot) && !DISHES[slot].includes(d)) { shown.add(d.id); DISHES[slot].push(d); }
    }
  }
}
applyDishes();

export const isBuiltIn = (id) => SLOT_IDS.some((s) => BASE[s].some((b) => b.id === id));
export const baseDish = (id) => SLOT_IDS.flatMap((s) => BASE[s]).find((b) => b.id === id);

// Groups in the dish editor: lunch and dinner are one list.
export const GROUPS = [
  { id: "frukost", label: "Frukost", slots: ["frukost"] },
  { id: "huvudratt", label: "Lunch och middag", slots: MAIN },
  { id: "mellanmal", label: "Mellanmål", slots: ["mellanmal"] },
];
export const groupOf = (slot) => GROUPS.find((g) => g.slots.includes(slot));

// Every dish in a group, hidden ones too, for the editor.
export const allDishes = (group) => {
  const g = GROUPS.find((x) => x.id === group) ?? groupOf(group);
  return [...dishById.values()].filter((d) => g.slots.includes(d.slot));
};

export const UNITS = ["g", "dl", "st", "skivor"];

// Shopping-list category of an ingredient: a known ingredient with the same name, else by keyword.
const CATEGORY_WORDS = [
  [KOTT, /kyckling|kalkon|(^|\s)nöt(\s|$|färs|kött|fil)|fläsk|biff|färs|lax|torsk|fisk|tonfisk|makrill|räk|sej|kött|skinka|bacon|korv|lamm|vilt|filé/],
  [MEJERI, /mjölk|yoghurt|keso|kvarg|(^|\s)ost|ost(\s|$)|(^|\s)ägg(?!planta)|grädde|fil\b|smör(?!.*jordnöt)|crème|kesella/],
  [BROD, /bröd|ris|pasta|quinoa|matvete|havre|gryn|couscous|bulgur|nudlar|tortilla|knäcke|mjöl/],
  [GRONT, /potatis|tomat|gurka|sallad|broccoli|morot|lök|paprika|spenat|zucchini|frukt|äpple|banan|bär|grönsak|kål|svamp|avokado|citron|(^|\s)ärt|majs|rotfrukt|sötpotatis|purjo|vitlök|selleri|aubergine|päron|apelsin|druv|melon/],
];
export function categoryOf(name) {
  const key = name.toLowerCase();
  for (const d of dishById.values()) for (const [n, , , cat] of d.ingredients) if (n.toLowerCase() === key) return cat;
  return CATEGORY_WORDS.find(([, re]) => re.test(key))?.[0] ?? SKAFFERI;
}

// A typical amount for a new ingredient, from its nutrients per 100 g. Only the proportions between
// the ingredients matter (portions are scaled to the day's target), so this just needs to be sensible.
export function defaultGrams(food) {
  if (!food) return 100;
  if (food.protein >= 15) return 150; // meat, fish, cheese
  if (food.kcal >= 500) return 15; // oil, butter, nuts, nut butter
  if (food.carbs >= 50) return 70; // dry pasta, rice, oats
  if (food.carbs >= 15) return 150; // cooked grains, potatoes
  return 100; // vegetables, fruit, dairy
}

const round = Math.round;
// raw = { name, meals?, ingredients: [[name, amount, unit, category, foodNumber?]], kcal, protein, fat, carbs }
// (the numbers are worked out from the ingredients by the view). Returns { values, errors }.
export function validateDish(raw, slot) {
  const errors = {};
  const name = String(raw.name ?? "").trim();
  if (!name) errors.name = "Ange ett namn.";
  else if (name.length > 60) errors.name = "Högst 60 tecken.";
  const ingredients = Array.isArray(raw.ingredients) ? raw.ingredients : [];
  if (!ingredients.length) errors.ingredients = "Lägg till minst en ingrediens.";
  else if (ingredients.length > 12) errors.ingredients = "Högst 12 ingredienser.";
  else if (ingredients.some((i) => !(finite(i[1]) && i[1] > 0 && i[1] <= 5000))) errors.ingredients = "Ange en mängd för varje ingrediens.";
  else if (!(raw.kcal >= 50)) errors.ingredients = "Rätten blir för liten, under 50 kcal. Öka mängderna.";
  else if (raw.kcal > 2500) errors.ingredients = "Rätten blir för stor, över 2 500 kcal. Minska mängderna.";
  const values = {
    name, kcal: round(raw.kcal ?? 0), protein: round(raw.protein ?? 0), fat: round(raw.fat ?? 0), carbs: round(raw.carbs ?? 0),
    ingredients: ingredients.map(([n, a, u, cat, nr]) => [n, a, u, cat ?? categoryOf(n), ...(nr ? [nr] : [])]),
  };
  if (isMain(slot)) values.meals = mealsOf(slot, raw.meals);
  return { values, errors };
}

// Allowed portion factor per slot. Wide enough to reach the target, narrow enough to stay a real meal.
const BOUNDS = { frukost: [0.8, 1.5], lunch: [0.7, 1.5], mellanmal: [0.7, 1.6], middag: [0.7, 1.6] };
const STEP = 0.05;

export const KCAL_TOLERANCE = 0.05; // of the calorie target
export const PROTEIN_TOLERANCE = 10; // grams

// Scales (one per meal) that hit both totals exactly while staying as close to 1 as possible, within
// bounds. Minimum-norm solution of two linear equations; meals that hit a bound are pinned and the
// rest re-solved. A meal with equal bounds is fixed.
function solveScales(meals, bounds, kcal, protein) {
  const s = meals.map((_, i) => (bounds[i][0] === bounds[i][1] ? bounds[i][0] : 1));
  const pinned = new Set(meals.map((_, i) => i).filter((i) => bounds[i][0] === bounds[i][1]));
  for (let round = 0; round <= meals.length; round++) {
    const free = meals.map((_, i) => i).filter((i) => !pinned.has(i));
    if (!free.length) break;
    let rk = kcal, rp = protein;
    meals.forEach((m, i) => { if (pinned.has(i)) { rk -= s[i] * m.kcal; rp -= s[i] * m.protein; } });
    let a = 0, b = 0, c = 0, rhs1 = rk, rhs2 = rp;
    for (const i of free) { a += meals[i].kcal ** 2; b += meals[i].kcal * meals[i].protein; c += meals[i].protein ** 2; rhs1 -= meals[i].kcal; rhs2 -= meals[i].protein; }
    const det = a * c - b * b;
    let l1, l2;
    if (Math.abs(det) < 1e-9) { l1 = a > 0 ? rhs1 / a : 0; l2 = 0; } // one free meal: only calories can be steered
    else { l1 = (rhs1 * c - rhs2 * b) / det; l2 = (a * rhs2 - b * rhs1) / det; }
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

// One day from one item per slot ({ kcal, protein }), with bounds per item: returns the rounded
// portions, the totals and a cost (how far from the target and how far from a normal portion).
function fitDay(items, target, bounds = SLOTS.map((s) => BOUNDS[s.id])) {
  const scales = solveScales(items, bounds, target.kcal, target.protein)
    .map((v, i) => (bounds[i][0] === bounds[i][1] ? v : Math.min(bounds[i][1], Math.max(bounds[i][0], roundStep(v)))));
  const totals = totalsOf(items, scales);
  // Misses only count beyond a small band, well inside the tolerance, so many combinations qualify
  // and variety can decide between them.
  const missK = Math.max(0, Math.abs(totals.kcal - target.kcal) / target.kcal * 100 - 2);
  const missP = Math.max(0, Math.abs(totals.protein - target.protein) - 6);
  const cost = scales.reduce((a, v, i) => a + (bounds[i][0] === bounds[i][1] ? 0 : (v - 1) ** 2), 0) + 5 * missK ** 2 + missP ** 2;
  return { scales, totals, cost };
}

function totalsOf(items, scales) {
  return {
    kcal: Math.round(items.reduce((a, d, i) => a + d.kcal * scales[i], 0)),
    protein: Math.round(items.reduce((a, d, i) => a + d.protein * scales[i], 0)),
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

const seedOf = (start, salt = 0) => (Number(start.replaceAll("-", "")) || 1) + salt * 7919;

// The best day of one dish per meal. `prev` and `next` are the neighbouring days' dishes (lunch,
// snack, dinner) so nothing repeats on two days in a row; lunch and dinner on the same day differ too.
// If the dishes on offer are too few for those rules, the rules give way.
function bestDay(target, prev, next, used, rand, pool = DISHES) {
  const clash = (l, m, n, o) => o && (m.id === o.mellanmal || l.id === o.lunch || n.id === o.middag);
  let best = null;
  for (const strict of [true, false]) {
    for (const f of pool.frukost) for (const l of pool.lunch) for (const m of pool.mellanmal) for (const n of pool.middag) {
      if (strict && (clash(l, m, n, prev) || clash(l, m, n, next) || l.id === n.id)) continue;
      const dishes = [f, l, m, n];
      const fit = fitDay(dishes, target);
      const variety = 0.15 * ((used[f.id] ?? 0) + (used[l.id] ?? 0) + (used[m.id] ?? 0) + (used[n.id] ?? 0)) + 0.6 * rand();
      const cost = fit.cost + variety;
      if (!best || cost < best.cost) best = { ...fit, cost, dishes };
    }
    if (best) break;
  }
  best.dishes.forEach((x) => { used[x.id] = (used[x.id] ?? 0) + 1; });
  return { meals: best.dishes.map((x, i) => ({ slot: SLOTS[i].id, dish: x.id, portion: best.scales[i] })) };
}

const usedIn = (days) => {
  const used = {};
  for (const day of days) for (const m of day.meals) used[m.dish] = (used[m.dish] ?? 0) + 1;
  return used;
};

// Plans days `from`..6 of `days` (earlier days are kept). `prev` = the dishes of the day before.
function planDays(days, from, target, prev, rand, pool = DISHES) {
  const used = usedIn(days.slice(0, from));
  const out = days.slice(0, from);
  for (let d = from; d < 7; d++) {
    out.push(bestDay(target, prev, null, used, rand, pool));
    prev = prevOf(out[d]);
  }
  return out;
}

const prevOf = (day) => ({ lunch: day?.meals[1].dish ?? null, mellanmal: day?.meals[2].dish ?? null, middag: day?.meals[3].dish ?? null });

// target = { kcal, protein }; prevSnack = id of last week's final snack (so the rule holds across weeks).
// Returns { start, target, days: [{ meals: [{ slot, dish, portion, custom? }] }] }.
export function generateWeek(start, target, prevSnack = null, pool = DISHES) {
  const days = planDays([], 0, target, { lunch: null, mellanmal: prevSnack, middag: null }, rng(seedOf(start)), pool);
  return { start, target, days };
}

// A new suggestion for days `from`..6; earlier days stay as they are. A day where something else was
// eaten is kept too (what you typed is not thrown away). `prevSnack` = last week's final snack, used
// when starting on Monday. `salt` gives another suggestion.
export function regenerateFrom(week, from, salt = 1, prevSnack = null) {
  const f = Math.max(0, Math.min(7, from));
  const rand = rng(seedOf(week.start, salt));
  const days = week.days.slice(0, f);
  const used = usedIn(days);
  for (let d = f; d < 7; d++) {
    const keep = week.days[d].meals.some((m) => m.custom);
    const prev = d > 0 ? prevOf(days[d - 1]) : { lunch: null, mellanmal: prevSnack, middag: null };
    const next = keep || d === 6 || !week.days[d + 1].meals.some((m) => m.custom) ? null : prevOf(week.days[d + 1]);
    days.push(keep ? week.days[d] : bestDay(week.target, prev, next, used, rand));
  }
  return { ...week, days };
}

// What a planned meal counts as: the dish, or what you ate instead ({ name, kcal, protein }).
const itemOf = (m) => (m.custom ? { kcal: m.custom.kcal, protein: m.custom.protein } : dishOf(m.dish));

// Scaled numbers for one planned meal: kcal, protein and ingredient amounts.
export function mealInfo(meal) {
  if (meal.custom) {
    const c = meal.custom;
    return { name: c.name || "Något annat", kcal: Math.round(c.kcal), protein: Math.round(c.protein), fat: 0, carbs: 0, ingredients: [], custom: true };
  }
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

// Re-fits one day's portions to the target. Meals up to and including the last "ate something else"
// are already eaten and stay as they are; only the meals after it are scaled.
function refitDay(day, target) {
  const lastCustom = day.meals.reduce((a, m, i) => (m.custom ? i : a), -1);
  const items = day.meals.map(itemOf);
  const bounds = day.meals.map((m, i) => (i <= lastCustom ? [m.custom ? 1 : m.portion, m.custom ? 1 : m.portion] : BOUNDS[m.slot]));
  const fit = fitDay(items, target, bounds);
  return { meals: day.meals.map((m, i) => (m.custom ? m : { slot: m.slot, dish: m.dish, portion: fit.scales[i] })) };
}

const resolves = (day) => day.meals.every((m) => m.custom || dishOf(m.dish));

// The dish at the day's other main meal (lunch for dinner and the other way round), or null.
export function otherMain(day, slot) {
  if (!isMain(slot)) return null;
  const m = day.meals.find((x) => isMain(x.slot) && x.slot !== slot);
  return m && !m.custom ? m.dish : null;
}

// Returns a copy of the week where one slot of one day uses another dish. The day's portions are
// re-fitted to the target. Some combinations can't reach it within normal portions; the view flags
// those. Null for an unknown day, slot or dish.
export function changeDish(week, dayIdx, slot, dishId) {
  const slotIdx = SLOTS.findIndex((s) => s.id === slot);
  const chosen = dishOf(dishId);
  const day = week.days[dayIdx];
  if (slotIdx < 0 || !fits(chosen, slot) || !day) return null;
  if (otherMain(day, slot) === dishId) return null;
  const meals = day.meals.map((m, i) => (i === slotIdx ? { slot, dish: dishId, portion: 1 } : m));
  return { ...week, days: week.days.map((x, i) => (i === dayIdx ? refitDay({ meals }, week.target) : x)) };
}

// "Ate something else": the meal counts as { name, kcal, protein } and the meals after it are re-fitted.
// `custom` null puts the planned dish back. Null for an unknown day or slot.
export function setCustom(week, dayIdx, slot, custom) {
  const slotIdx = SLOTS.findIndex((s) => s.id === slot);
  const day = week.days[dayIdx];
  if (slotIdx < 0 || !day) return null;
  const meals = day.meals.map((m, i) => {
    if (i !== slotIdx) return m;
    const { custom: _old, ...plain } = m;
    return custom ? { ...plain, portion: 1, custom } : { ...plain, portion: 1 };
  });
  return { ...week, days: week.days.map((x, i) => (i === dayIdx ? refitDay({ meals }, week.target) : x)) };
}

export function validateCustom(raw) {
  const errors = {};
  const num = (v) => { const s = String(v ?? "").trim().replace(",", "."); return s === "" ? NaN : Number(s); };
  const name = String(raw.name ?? "").trim().slice(0, 40);
  const kcal = num(raw.kcal), protein = num(raw.protein);
  if (!(kcal >= 0 && kcal <= 4000)) errors.kcal = "Ange kalorier mellan 0 och 4 000.";
  if (!(protein >= 0 && protein <= 300)) errors.protein = "Ange protein mellan 0 och 300 g.";
  return { values: { name, kcal: Math.round(kcal), protein: Math.round(protein) }, errors };
}

// A stored week with the shape the views rely on (stored data can be damaged).
const validMeal = (m) => isObject(m) && typeof m.dish === "string" && finite(m.portion)
  && (m.custom === undefined || (isObject(m.custom) && finite(m.custom.kcal) && finite(m.custom.protein)));
export const isWeek = (w) => isObject(w) && isObject(w.target) && Array.isArray(w.days) && w.days.length === 7
  && w.days.every((d) => isObject(d) && Array.isArray(d.meals) && d.meals.length === SLOTS.length && d.meals.every(validMeal));

// Re-fits every day that uses one of `ids` (a set of dish ids), after those dishes were edited.
export function refitWeek(week, ids) {
  const days = week.days.map((day) => (day.meals.some((m) => !m.custom && ids.has(m.dish)) && resolves(day) ? refitDay(day, week.target) : day));
  return { ...week, days };
}

// Same dishes, portions fitted to a new target (after a weigh-in or a new profile).
// A day that can't reach the new target with its dishes (and has nothing eaten off-plan) is planned
// again; the other days keep their dishes.
export function retarget(week, target) {
  const days = week.days.map((day) => (resolves(day) ? refitDay(day, target) : day));
  const rand = rng(seedOf(week.start, 3));
  days.forEach((day, d) => {
    if (!resolves(day) || day.meals.some((m) => m.custom) || withinTarget(dayTotals(day), target)) return;
    days[d] = bestDay(target, d > 0 ? prevOf(days[d - 1]) : null, d < 6 ? prevOf(days[d + 1]) : null, usedIn(days), rand);
  });
  return { ...week, target, days };
}

// Days `from`..6 that use a dish no longer on offer for that meal (hidden, or limited to the other
// main meal) get the best fitting dish on offer in its place,
// keeping the rules: not the same as the day before or after, lunch and dinner differ.
export function replaceHidden(week, from) {
  const days = [...week.days];
  for (let d = Math.max(0, from); d < 7; d++) {
    days[d].meals.forEach((m, i) => {
      if (m.custom || (isVisible(m.dish) && fits(dishOf(m.dish), m.slot)) || !resolves(days[d])) return;
      const avoid = new Set([days[d - 1]?.meals[i].dish, days[d + 1]?.meals[i].dish,
        ...(isMain(m.slot) ? days[d].meals.filter((x, j) => j !== i && isMain(x.slot)).map((x) => x.dish) : [])]);
      let best = null;
      for (const strict of [true, false]) {
        for (const cand of DISHES[m.slot]) {
          if (strict && avoid.has(cand.id)) continue;
          const meals = days[d].meals.map((x, j) => (j === i ? { slot: x.slot, dish: cand.id, portion: 1 } : x));
          const day = refitDay({ meals }, week.target);
          const t = dayTotals(day);
          const cost = Math.abs(t.kcal - week.target.kcal) / week.target.kcal * 100 + Math.abs(t.protein - week.target.protein) / 5;
          if (!best || cost < best.cost) best = { cost, day };
        }
        if (best) break;
      }
      if (best) days[d] = best.day;
    });
  }
  return { ...week, days };
}

export const withinTarget = (totals, target) =>
  Math.abs(totals.kcal - target.kcal) <= target.kcal * KCAL_TOLERANCE
  && Math.abs(totals.protein - target.protein) <= PROTEIN_TOLERANCE;
