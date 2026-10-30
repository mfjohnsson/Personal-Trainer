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
const dish = (id, name, kcal, protein, ingredients) => ({ id, name, kcal, protein, ingredients });

// kcal and protein are per one portion. No dish contains legumes (beans, lentils, peas, chickpeas).
export const DISHES = {
  frukost: [
    dish("frukost", "Proteinbröd, ägg och tomat", 350, 30, [
      ["Proteinbröd", 2, "skivor", BROD], ["Ägg", 2, "st", MEJERI], ["Tomat", 1, "st", GRONT]]),
  ],
  lunch: [
    dish("lunch-kyckling", "Kyckling, quinoa och grönsaker", 570, 70, [
      g("Kycklingfilé", 200, KOTT), g("Quinoa, tillagad", 150, BROD), g("Grönsaker", 100, GRONT)]),
    dish("lunch-lax", "Lax, matvete och grönsaker", 680, 50, [
      g("Laxfilé", 200, KOTT), g("Matvete, tillagat", 150, BROD), g("Grönsaker", 100, GRONT)]),
    dish("lunch-notfars", "Nötfärs, fullkornspasta och grönsaker", 590, 46, [
      g("Nötfärs 10 %", 200, KOTT), g("Fullkornspasta, tillagad", 150, BROD), g("Grönsaker", 100, GRONT)]),
    dish("lunch-torsk", "Torsk, fullkornsris och grönsaker", 410, 43, [
      g("Torskfilé", 200, KOTT), g("Fullkornsris, tillagat", 150, BROD), g("Grönsaker", 100, GRONT)]),
    dish("lunch-kalkon", "Kalkon, matvete och grönsaker", 500, 55, [
      g("Kalkonfilé", 200, KOTT), g("Matvete, tillagat", 150, BROD), g("Grönsaker", 100, GRONT)]),
    dish("lunch-tonfisk", "Tonfisk, quinoa och grönsaker", 460, 60, [
      g("Tonfisk i vatten", 200, KOTT), g("Quinoa, tillagad", 150, BROD), g("Grönsaker", 100, GRONT)]),
    dish("lunch-flask", "Fläskfilé, fullkornsris och grönsaker", 490, 51, [
      g("Fläskfilé", 200, KOTT), g("Fullkornsris, tillagat", 150, BROD), g("Grönsaker", 100, GRONT)]),
  ],
  mellanmal: [
    dish("snack-shake", "Proteinshake", 255, 35, [
      g("Proteinpulver", 30, SKAFFERI), ["Mjölk", 3, "dl", MEJERI]]),
    dish("snack-yoghurt", "Turkisk yoghurt, jordnötssmör och bär", 330, 18, [
      g("Turkisk yoghurt", 250, MEJERI), g("Jordnötssmör", 15, SKAFFERI), g("Bär", 80, GRONT)]),
    dish("snack-keso", "Keso, frukt och nötter", 430, 29, [
      g("Keso", 200, MEJERI), ["Frukt", 1, "st", GRONT], g("Nötter", 30, SKAFFERI)]),
  ],
  middag: [
    dish("middag-kyckling", "Ugnskyckling med rotfrukter och sallad", 620, 55, [
      g("Kycklingfilé", 200, KOTT), g("Rotfrukter", 250, GRONT), g("Sallad", 100, GRONT)]),
    dish("middag-lax", "Lax i ugn med potatis och broccoli", 700, 45, [
      g("Laxfilé", 150, KOTT), g("Potatis", 250, GRONT), g("Broccoli", 150, GRONT)]),
    dish("middag-farssas", "Köttfärssås med zucchini och lite pasta", 560, 42, [
      g("Nötfärs 10 %", 150, KOTT), g("Krossade tomater", 200, SKAFFERI), g("Zucchini", 300, GRONT), g("Fullkornspasta, torr", 60, BROD)]),
    dish("middag-wok", "Wokad fläskfilé med grönsaker och ris", 650, 48, [
      g("Fläskfilé", 180, KOTT), g("Wokgrönsaker", 250, GRONT), g("Fullkornsris, torrt", 50, BROD)]),
    dish("middag-biff", "Biff med potatis och ugnsgrönsaker", 640, 50, [
      g("Biff", 180, KOTT), g("Potatis", 150, GRONT), g("Ugnsgrönsaker", 250, GRONT)]),
    dish("middag-kalkon", "Kalkonburgare med sötpotatis och sallad", 600, 48, [
      g("Kalkonfärs", 200, KOTT), ["Ägg", 1, "st", MEJERI], g("Sötpotatis", 150, GRONT), g("Sallad", 150, GRONT)]),
    dish("middag-torsk", "Torsk i ugn med potatis och morötter", 520, 42, [
      g("Torskfilé", 200, KOTT), g("Potatis", 250, GRONT), g("Morötter", 150, GRONT)]),
  ],
};

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

// target = { kcal, protein }; prevSnack = id of last week's final snack (so the rule holds across weeks).
// Returns { start, target, days: [{ meals: [{ slot, dish, portion }] }] }.
export function generateWeek(start, target, prevSnack = null) {
  const rand = rng(seedOf(start));
  const used = {};
  const days = [];
  let prev = { lunch: null, mellanmal: prevSnack, middag: null };
  for (let d = 0; d < 7; d++) {
    let best = null;
    for (const l of DISHES.lunch) for (const m of DISHES.mellanmal) for (const n of DISHES.middag) {
      if (m.id === prev.mellanmal || l.id === prev.lunch || n.id === prev.middag) continue;
      const dishes = [DISHES.frukost[0], l, m, n];
      const fit = fitDay(dishes, target);
      const variety = 0.15 * ((used[l.id] ?? 0) + (used[m.id] ?? 0) + (used[n.id] ?? 0)) + 0.6 * rand();
      const cost = fit.cost + variety;
      if (!best || cost < best.cost) best = { ...fit, cost, dishes };
    }
    best.dishes.forEach((x) => { used[x.id] = (used[x.id] ?? 0) + 1; });
    prev = { lunch: best.dishes[1].id, mellanmal: best.dishes[2].id, middag: best.dishes[3].id };
    days.push({ meals: best.dishes.map((x, i) => ({ slot: SLOTS[i].id, dish: x.id, portion: best.scales[i] })) });
  }
  return { start, target, days };
}

const dishById = new Map(Object.values(DISHES).flat().map((x) => [x.id, x]));
export const dishOf = (id) => dishById.get(id);

// Scaled numbers for one planned meal: kcal, protein and ingredient amounts.
export function mealInfo(meal) {
  const d = dishOf(meal.dish);
  const q = meal.portion;
  return {
    name: d.name,
    kcal: Math.round(d.kcal * q),
    protein: Math.round(d.protein * q),
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
    return { kcal: a.kcal + i.kcal, protein: a.protein + i.protein };
  }, { kcal: 0, protein: 0 });
}

export const withinTarget = (totals, target) =>
  Math.abs(totals.kcal - target.kcal) <= target.kcal * KCAL_TOLERANCE
  && Math.abs(totals.protein - target.protein) <= PROTEIN_TOLERANCE;
