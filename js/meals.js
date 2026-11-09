// Weekly meal plan: dish catalog and planner. No DOM, no storage.
// A day is three meals: breakfast, lunch, dinner. Protein comes first: every ingredient is either part of
// the dish's protein (meat, fish, eggs, cottage cheese...) or a side (rice, potatoes, vegetables...). The
// protein part is scaled until the day reaches its protein target, then the sides are scaled until it
// reaches its calories. When the meals can't reach the protein at a sensible size, a top-up is added:
// the protein shake first, cottage cheese or quark second.
// Lunch and dinner follow a weekly rotation of four dishes: two batch-cooked (beef and chicken), one fish
// and one quick dish.
export const SLOTS = [
  { id: "frukost", label: "Frukost" },
  { id: "lunch", label: "Lunch" },
  { id: "middag", label: "Middag" },
];
// Meals a dish can belong to. "mellanmal" holds the top-ups (and the snacks of weeks planned before the
// three-meal days, which still show as "Mellanmål").
const DISH_SLOTS = ["frukost", "lunch", "mellanmal", "middag"];
const SLOT_LABELS = { frukost: "Frukost", lunch: "Lunch", middag: "Middag", mellanmal: "Mellanmål" };
export const slotLabel = (slot) => SLOT_LABELS[slot] ?? slot;

const KOTT = "Kött och fisk", MEJERI = "Mejeri och ägg", BROD = "Bröd och spannmål", GRONT = "Frukt och grönt", SKAFFERI = "Skafferi";
const g = (name, amount, cat) => [name, amount, "g", cat];
const dish = (id, name, kcal, protein, fat, carbs, ingredients) => ({ id, name, kcal, protein, fat, carbs, ingredients });
// A dish that can also be made with water instead of milk: same protein powder, fewer calories. Numbers
// from Livsmedelsverket's database, checked by tools/foods-test.mjs.
const withWater = (d, kcal, protein, fat, carbs, ingredients) => ({ ...d, water: { kcal, protein, fat, carbs, ingredients } });
// Built in but not offered until the user turns it on.
const off = (d) => ({ ...d, hidden: true });

// What kind of lunch or dinner a dish is, for the weekly rotation.
export const KINDS = [
  { id: "storkok", label: "Storkok" },
  { id: "fisk", label: "Fisk" },
  { id: "snabb", label: "Snabb" },
];
const kind = (k, d) => ({ ...d, kind: k });

// Built-in dishes; kcal, protein, fat and carbs are per one portion, worked out from the ingredients and
// Livsmedelsverket's food database by tools/bake-builtins.mjs (cooking oil is not counted unless listed).
// Dishes keep their recipe once planned weeks use them: days already eaten are counted from it. A dish
// that should change gets a new id and the old one is switched off.
const BASE = {
  frukost: [
    dish("frukost", "Proteinbröd, ägg och tomat", 335, 29, 17, 13, [
      ["Proteinbröd", 2, "skivor", BROD], ["Ägg", 2, "st", MEJERI], ["Tomat", 1, "st", GRONT]]),
    dish("frukost-kvarg", "Kvarg med bär och havregryn", 417, 39, 4, 51, [
      g("Kvarg", 350, MEJERI), g("Havregryn", 40, BROD), g("Blåbär", 100, GRONT)]),
    dish("frukost-aggrora", "Äggröra med keso och knäckebröd", 471, 39, 23, 24, [
      ["Ägg", 3, "st", MEJERI], g("Keso", 100, MEJERI), g("Knäckebröd", 30, BROD), ["Tomat", 1, "st", GRONT]]),
    dish("frukost-oats", "Overnight oats med proteinpulver", 431, 39, 9, 46, [
      ["Havregryn", 1, "dl", BROD], ["Proteinpulver", 0.5, "dl", SKAFFERI], ["Mjölk", 1.5, "dl", MEJERI],
      g("Kvarg", 150, MEJERI), g("Hallon", 50, GRONT)]),
  ],
  lunch: [
    kind("storkok", dish("lunch-kyckling", "Kyckling, quinoa och grönsaker", 442, 54, 6, 36, [
      g("Kycklingfilé", 200, KOTT), g("Quinoa, tillagad", 150, BROD), g("Grönsaker", 100, GRONT)])),
    kind("fisk", dish("lunch-lax", "Lax, matvete och grönsaker", 711, 48, 29, 55, [
      g("Laxfilé", 200, KOTT), g("Matvete, tillagat", 150, BROD), g("Grönsaker", 100, GRONT)])),
    kind("storkok", dish("lunch-notfars", "Nötfärs, fullkornspasta och grönsaker", 630, 50, 24, 49, [
      g("Nötfärs 10 %", 200, KOTT), g("Fullkornspasta, tillagad", 150, BROD), g("Grönsaker", 100, GRONT)])),
    kind("fisk", dish("lunch-torsk", "Torsk, fullkornsris och grönsaker", 387, 43, 3, 45, [
      g("Torskfilé", 200, KOTT), g("Fullkornsris, tillagat", 150, BROD), g("Grönsaker", 100, GRONT)])),
    off(kind("storkok", dish("lunch-kalkon", "Kalkon, matvete och grönsaker", 503, 56, 3, 54, [
      g("Kalkonfilé", 200, KOTT), g("Matvete, tillagat", 150, BROD), g("Grönsaker", 100, GRONT)]))),
    off(kind("snabb", dish("lunch-makrill", "Makrill i tomatsås, fullkornsris och grönsaker", 603, 29, 30, 52, [
      g("Makrill i tomatsås", 200, KOTT), g("Fullkornsris, tillagat", 150, BROD), g("Grönsaker", 100, GRONT)]))),
    kind("storkok", dish("lunch-bonchili", "Bönchili med nötfärs och ris", 536, 39, 16, 54, [
      g("Nötfärs 10 %", 120, KOTT), g("Kidneybönor, kokta", 120, SKAFFERI), g("Krossade tomater", 100, SKAFFERI),
      g("Fullkornsris, tillagat", 120, BROD)])),
    off(kind("snabb", dish("lunch-tonfisk", "Tonfisk, quinoa och grönsaker", 446, 56, 6, 36, [
      g("Tonfisk i vatten", 200, KOTT), g("Quinoa, tillagad", 150, BROD), g("Grönsaker", 100, GRONT)]))),
    off(kind("storkok", dish("lunch-flask", "Fläskfilé, fullkornsris och grönsaker", 445, 47, 7, 45, [
      g("Fläskfilé", 200, KOTT), g("Fullkornsris, tillagat", 150, BROD), g("Grönsaker", 100, GRONT)]))),
    kind("snabb", dish("snabb-tonfisk", "Tonfisksallad med ägg och knäckebröd", 522, 68, 15, 26, [
      g("Tonfisk i vatten", 200, KOTT), ["Ägg", 2, "st", MEJERI], g("Sallad", 150, GRONT), ["Tomat", 1, "st", GRONT],
      g("Knäckebröd", 30, BROD)])),
    kind("snabb", dish("snabb-makrill", "Makrill i tomatsås med ägg, knäckebröd och sallad", 747, 48, 47, 31, [
      g("Makrill i tomatsås", 250, KOTT), ["Ägg", 2, "st", MEJERI], g("Knäckebröd", 30, BROD), g("Sallad", 100, GRONT)])),
    kind("snabb", dish("snabb-keso", "Keso, ägg och knäckebröd med grönsaker", 554, 52, 23, 29, [
      g("Keso", 250, MEJERI), ["Ägg", 2, "st", MEJERI], g("Knäckebröd", 30, BROD), g("Grönsaker", 150, GRONT)])),
  ],
  mellanmal: [
    withWater(dish("snack-shake", "Proteinshake", 291, 37, 10, 14, [
      ["Proteinpulver", 1, "dl", SKAFFERI], ["Mjölk", 2.5, "dl", MEJERI]]),
    137, 27, 2, 2, [["Proteinpulver", 1, "dl", SKAFFERI], ["Vatten", 2.5, "dl", SKAFFERI]]),
    dish("snack-kvarg", "Kvarg med bär", 202, 26, 1, 20, [
      g("Kvarg", 250, MEJERI), g("Bär", 80, GRONT)]),
    dish("snack-kesofrukt", "Keso med frukt", 322, 34, 11, 21, [
      g("Keso", 250, MEJERI), ["Frukt", 1, "st", GRONT]]),
    off(dish("snack-keso", "Keso, frukt och nötter", 461, 32, 26, 22, [
      g("Keso", 200, MEJERI), ["Frukt", 1, "st", GRONT], g("Nötter", 30, SKAFFERI)])),
    off(dish("snack-yoghurt", "Turkisk yoghurt, jordnötssmör och bär", 407, 13, 29, 22, [
      g("Turkisk yoghurt", 250, MEJERI), g("Jordnötssmör", 15, SKAFFERI), g("Bär", 80, GRONT)])),
  ],
  middag: [
    kind("storkok", dish("middag-kyckling", "Ugnskyckling med rotfrukter och sallad", 375, 50, 9, 19, [
      g("Kycklingfilé", 200, KOTT), g("Rotfrukter", 250, GRONT), g("Sallad", 100, GRONT)])),
    kind("fisk", dish("middag-lax", "Lax i ugn med potatis och broccoli", 567, 39, 22, 47, [
      g("Laxfilé", 150, KOTT), g("Potatis", 250, GRONT), g("Broccoli", 150, GRONT)])),
    kind("storkok", dish("middag-farssas", "Köttfärssås med zucchini och lite pasta", 566, 38, 19, 55, [
      g("Nötfärs 10 %", 150, KOTT), g("Krossade tomater", 200, SKAFFERI), g("Zucchini", 300, GRONT), g("Fullkornspasta, torr", 60, BROD)])),
    off(kind("storkok", dish("middag-wok", "Wokad fläskfilé med grönsaker och ris", 493, 46, 10, 48, [
      g("Fläskfilé", 180, KOTT), g("Wokgrönsaker", 250, GRONT), g("Fullkornsris, torrt", 50, BROD)]))),
    kind("storkok", dish("middag-biff", "Biff med potatis och ugnsgrönsaker", 492, 45, 14, 41, [
      g("Biff", 180, KOTT), g("Potatis", 150, GRONT), g("Ugnsgrönsaker", 250, GRONT)])),
    off(kind("storkok", dish("middag-kalkon", "Kalkonburgare med sötpotatis och sallad", 421, 59, 8, 23, [
      g("Kalkonfärs", 200, KOTT), ["Ägg", 1, "st", MEJERI], g("Sötpotatis", 150, GRONT), g("Sallad", 150, GRONT)]))),
    kind("fisk", dish("middag-makrill", "Ugnsbakad makrill med potatis och broccoli", 687, 34, 39, 46, [
      g("Makrillfilé", 150, KOTT), g("Potatis", 250, GRONT), g("Broccoli", 150, GRONT)])),
    kind("storkok", dish("middag-bonor", "Kyckling med vita bönor i tomatsås", 406, 58, 4, 28, [
      g("Kycklingfilé", 180, KOTT), g("Vita bönor, kokta", 150, SKAFFERI), g("Krossade tomater", 150, SKAFFERI), g("Spenat", 100, GRONT)])),
    kind("fisk", dish("middag-torsk", "Torsk i ugn med potatis och morötter", 408, 42, 2, 51, [
      g("Torskfilé", 200, KOTT), g("Potatis", 250, GRONT), g("Morötter", 150, GRONT)])),
  ],
};

// --- Protein or side, per ingredient ---
// Worked out from the food database (setAnalyzer, given foods.macrosOf). A food is protein when it is
// protein-rich both per gram and per calorie, so nuts and cheese-heavy sauces stay sides; breads and grains
// are always sides, also protein bread. Without the database (it failed to load) a dish is one part.
let analyze = null;
export const setAnalyzer = (fn) => { analyze = typeof fn === "function" ? fn : null; };
export const hasAnalyzer = () => !!analyze;
const SIDE_FOOD = /bröd|knäcke|pasta|(^|\s)ris(\s|$)|gryn|quinoa|matvete|potatis|müsli|flingor|nudlar/i;
export const isProteinFood = (f) => !!f && f.kcal > 0 && f.protein >= 10 && (f.protein * 4) / f.kcal >= 0.24 && !SIDE_FOOD.test(f.name);

const ZERO = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
const MACROS = ["kcal", "protein", "fat", "carbs"];
const add = (a, b, k = 1) => Object.fromEntries(MACROS.map((m) => [m, a[m] + b[m] * k]));

// Per-ingredient numbers of a recipe ({ kcal, protein, fat, carbs, part: "p" | "s" }), or null.
function linesOf(ingredients) {
  if (!analyze) return null;
  try {
    const r = analyze(ingredients);
    if (!r?.lines || r.lines.length !== ingredients.length) return null;
    const lines = r.lines.map((l) => ({ kcal: l.kcal, protein: l.protein, fat: l.fat, carbs: l.carbs, part: isProteinFood(l.food) ? "p" : "s" }));
    // A dish without any protein food can't be steered by its protein: it is one part.
    return lines.some((l) => l.part === "p") ? lines : lines.map((l) => ({ ...l, part: "p" }));
  } catch { return null; }
}

// --- Catalog: the built-in dishes plus the user's own changes (stored by dishes.js) ---

// Lunch and dinner share their dishes ("huvudrätter"); a dish can be limited to one of them.
export const MAIN = ["lunch", "middag"];
const isMain = (slot) => MAIN.includes(slot);
const mealsOf = (slot, meals) => {
  if (!isMain(slot)) return [slot];
  const ok = Array.isArray(meals) ? MAIN.filter((m) => meals.includes(m)) : [];
  return ok.length ? ok : MAIN;
};
export const fits = (d, slot) => !!d && d.meals.includes(slot);

// Own dishes get a kind guessed from their name and ingredients (changeable in the editor).
const FISH = /lax|torsk|sej|fisk|räk|kolja|sik|rödspätta|pangasius|makrillfilé|abborre|gös/i;
const QUICK = /tonfisk|makrill i tomat|keso|kvarg|konserv|sallad med|ägg kokt/i;
export function guessKind(d) {
  const text = [d.name, ...(d.ingredients ?? []).map((i) => i[0])].join(" ");
  if (QUICK.test(text) && !/(nöt|kyckling|fläsk)/i.test(text)) return "snabb";
  if (FISH.test(text)) return "fisk";
  return "storkok";
}
const kindOf = (d) => (KINDS.some((k) => k.id === d.kind) ? d.kind : guessKind(d));

// How many dishes a meal needs on offer before one can be switched off.
export const minDishes = (slot) => (slot === "frukost" || slot === "mellanmal" ? 1 : 2);
// Dishes offered in pickers and used by the planner, per meal. Filled by applyDishes; arrays keep identity.
export const DISHES = { frukost: [], lunch: [], mellanmal: [], middag: [] };
const dishById = new Map(); // every dish, switched-off and deleted ones too, so planned weeks keep resolving
const shown = new Set();
const listed = new Set(); // dishes in the editor (deleted own dishes are not)
export const SHAKE_ID = "snack-shake";
let topup = SHAKE_ID; // first protein top-up
let topup2 = null; // second, used when the first is not enough
let breakfast = "frukost"; // the everyday breakfast
export const breakfastId = () => (isVisible(breakfast) ? breakfast : DISHES.frukost[0]?.id);
export const topupId = () => topup;
export const topup2Id = () => topup2;
// A top-up only helps if it brings more protein per kcal than the meals it makes room for.
export const TOPUP_MIN_DENSITY = 10; // g protein per 100 kcal
export const isTopupCandidate = (d) => !!d && d.slot === "mellanmal" && d.kcal > 0 && (d.protein * 100) / d.kcal >= TOPUP_MIN_DENSITY;
export const dishOf = (id) => dishById.get(id);
export const isVisible = (id) => shown.has(id);
export const isListed = (id) => listed.has(id);
// Older stored data had "removed" dishes; they are now simply switched off.
export const isRemoved = () => false;

function register(slot, d, show, list = true) {
  const full = { ...d, slot, meals: mealsOf(slot, d.meals) };
  if (isMain(slot)) full.kind = kindOf(full);
  full.lines = linesOf(full.ingredients);
  if (full.water) full.water = { ...full.water, lines: linesOf(full.water.ingredients) };
  dishById.set(full.id, full);
  if (list) listed.add(full.id);
  if (show) { shown.add(full.id); for (const m of full.meals) DISHES[m].push(full); }
}

// overlay = { items: { [id]: { slot, name, kcal, protein, fat, carbs, ingredients, meals?, kind? } },
//   visible: { [id]: boolean }, removed?: { [id]: true } (older data: switched off),
//   deleted?: { [id]: item } (own dishes you deleted, kept so earlier days still show), gone?: { [id]: true }
//   (built-in dishes you deleted), topup?, topup2?, breakfast? (the everyday breakfast) }.
// An item with a built-in id replaces that dish; any other id is a dish of the user's own.
const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v) => typeof v === "number" && Number.isFinite(v);
const validItem = (it) => isObject(it) && DISH_SLOTS.includes(it.slot) && typeof it.name === "string" && it.name !== ""
  && finite(it.kcal) && finite(it.protein) && finite(it.fat) && finite(it.carbs) && Array.isArray(it.ingredients) && it.ingredients.length > 0
  && it.ingredients.every((i) => Array.isArray(i) && typeof i[0] === "string" && finite(i[1]) && i[1] > 0 && typeof i[2] === "string");

// Stored data may be damaged; anything malformed is ignored rather than allowed to break the app.
export function applyDishes(overlay = {}) {
  const raw = isObject(overlay) ? overlay : {};
  const pick = (o) => Object.fromEntries(Object.entries(isObject(o) ? o : {}).filter(([, it]) => validItem(it)));
  const items = pick(raw.items);
  const deleted = pick(raw.deleted);
  const visible = isObject(raw.visible) ? raw.visible : {};
  const removed = new Set(Object.entries(isObject(raw.removed) ? raw.removed : {}).filter(([, v]) => v === true).map(([id]) => id));
  const on = (id, fallback) => !removed.has(id) && (typeof visible[id] === "boolean" ? visible[id] : fallback);
  // Built-in dishes you deleted: kept out of sight so earlier days still show them.
  const gone = new Set(Object.entries(isObject(raw.gone) ? raw.gone : {}).filter(([, v]) => v === true).map(([id]) => id));
  dishById.clear(); shown.clear(); listed.clear();
  for (const slot of DISH_SLOTS) DISHES[slot].length = 0;
  const builtIn = new Set();
  for (const slot of DISH_SLOTS) {
    for (const b of BASE[slot]) {
      builtIn.add(b.id);
      const { hidden, ...plain } = b;
      // An edited built-in keeps the shipped kind unless you changed it.
      const d = items[b.id] ? { kind: b.kind, ...items[b.id], id: b.id } : plain;
      register(slot, d, !gone.has(b.id) && on(b.id, !hidden), !gone.has(b.id));
    }
  }
  for (const [id, it] of Object.entries(items)) {
    if (!builtIn.has(id)) register(it.slot, { ...it, id }, on(id, true));
  }
  for (const [id, it] of Object.entries(deleted)) {
    if (!dishById.has(id)) register(it.slot, { ...it, id }, false, false);
  }
  breakfast = typeof raw.breakfast === "string" ? raw.breakfast : "frukost";
  // Top-ups: any protein-rich top-up dish, also a switched-off one, but not a deleted one. Otherwise the
  // shake (or the first protein-rich one); the second is quark or cottage cheese when there is one.
  const usable = (id) => typeof id === "string" && listed.has(id) && isTopupCandidate(dishById.get(id));
  const candidates = [...dishById.keys()].filter(usable);
  topup = usable(raw.topup) ? raw.topup : usable(SHAKE_ID) ? SHAKE_ID : candidates[0] ?? SHAKE_ID;
  const second = (id) => usable(id) && id !== topup;
  topup2 = raw.topup2 === "none" ? null : second(raw.topup2) ? raw.topup2
    : ["snack-kvarg", "snack-kesofrukt"].find((id) => second(id) && shown.has(id))
    ?? candidates.find((id) => second(id) && shown.has(id)) ?? null;
  // Damaged or hand-edited flags must not leave a planned meal without dishes.
  for (const slot of ["frukost", "lunch", "middag"]) {
    for (const d of dishById.values()) {
      if (DISHES[slot].length >= minDishes(slot)) break;
      if (listed.has(d.id) && fits(d, slot) && !DISHES[slot].includes(d)) { shown.add(d.id); DISHES[slot].push(d); }
    }
  }
}
applyDishes();

export const isBuiltIn = (id) => DISH_SLOTS.some((s) => BASE[s].some((b) => b.id === id));
export const baseDish = (id) => DISH_SLOTS.flatMap((s) => BASE[s]).find((b) => b.id === id);

// Groups in the dish editor: lunch and dinner are one list.
export const GROUPS = [
  { id: "frukost", label: "Frukost", slots: ["frukost"] },
  { id: "huvudratt", label: "Lunch/middag", slots: MAIN },
  { id: "mellanmal", label: "Påfyllning", slots: ["mellanmal"] },
];
export const groupOf = (slot) => GROUPS.find((g) => g.slots.includes(slot));

// Every dish in a group that is in the editor (not deleted own dishes).
export const allDishes = (group) => {
  const g = GROUPS.find((x) => x.id === group) ?? groupOf(group);
  return [...dishById.values()].filter((d) => g.slots.includes(d.slot) && listed.has(d.id));
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
const CONDIMENT = /^(ättika|ättiksyra)$|(vinäger|soja|sojasås|senap|ketchup|dressing|majonnäs|kryddor|krydda|salt|peppar|buljong|fond|honung|sirap|citronsaft|limesaft|pesto)$/i;
const isCondiment = (name) => CONDIMENT.test(String(name ?? "").trim().split(/[\s,]+/)[0]);
export function defaultGrams(food) {
  if (!food) return 100;
  if (isCondiment(food.name)) return 15;
  if (food.kcal >= 500) return 15; // oil, butter, nuts, seeds, nut butter
  if (food.protein >= 15 && food.kcal >= 300) return 30; // hard cheese, protein powder
  if (food.protein >= 15) return 150; // meat, fish
  if (food.carbs >= 50) return 70; // dry pasta, rice, oats
  if (food.carbs >= 15) return 150; // cooked grains, potatoes
  return 100; // vegetables, fruit, dairy
}

// The calories a new dish starts at, per meal: an ordinary portion, which the planner then scales.
export const PORTION_KCAL = { frukost: 400, lunch: 650, middag: 650, mellanmal: 250 };

// Gram amounts the app picks for a dish's ingredients (`list` = food per row, null if unknown).
export function suggestGrams(list, slot) {
  const base = list.map(defaultGrams);
  const kcal = base.reduce((a, gr, i) => a + ((list[i]?.kcal ?? 0) * gr) / 100, 0);
  const k = kcal > 0 ? Math.min(2, Math.max(0.5, (PORTION_KCAL[slot] ?? 500) / kcal)) : 1;
  return base.map((gr) => Math.max(5, Math.round((gr * k) / 5) * 5));
}

// The amounts the app put in before defaultGrams knew about nuts, seeds and condiments.
export const legacyGrams = (f) => (!f ? 100 : f.protein >= 15 ? 150 : f.kcal >= 500 ? 15 : f.carbs >= 50 ? 70 : f.carbs >= 15 ? 150 : 100);

const round = Math.round;
// raw = { name, meals?, kind?, ingredients: [[name, amount, unit, category, foodNumber?]], kcal, protein, fat, carbs }.
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
  if (isMain(slot)) {
    values.meals = mealsOf(slot, raw.meals);
    values.kind = KINDS.some((k) => k.id === raw.kind) ? raw.kind : guessKind(values);
  }
  values.auto = raw.auto === true;
  return { values, errors };
}

// --- The clock and the day's "Klar" ---
// Nothing is locked: you can change any meal's amounts, dish or top-up, also afterwards (only "Mer
// protein", which lets the app scale, is for meals still ahead). But a meal whose time has passed
// (breakfast at 10, lunch at 14, dinner at 20) is "pinned": the app no longer changes it by itself when
// something else in the day changes. A day you marked done (day.done) and a day before today are over:
// nothing in them is re-fitted any more, a change touches only what you changed. Set by the app on every
// render (setNow); in tests by hand. Without it nothing has passed.
const SLOT_END = { frukost: 600, lunch: 840, mellanmal: 960, middag: 1200 };
let now = null; // { iso, minutes }
export function setNow(iso, minutes) { now = typeof iso === "string" ? { iso, minutes: finite(minutes) ? minutes : 0 } : null; }
export const slotPassed = (slot, minutes) => minutes >= (SLOT_END[slot] ?? 1440);

function isoOf(start, d) {
  const [y, m, dd] = start.split("-").map(Number);
  const x = new Date(y, m - 1, dd + d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

const isPastDay = (start, d) => !!now && !!start && isoOf(start, d) < now.iso;

// The meals of day `d` the app leaves as they are (indices): all of them on a day that is over, else
// those whose time has passed.
function passedOf(start, d, day) {
  if (day.done === true || isPastDay(start, d)) return new Set(day.meals.map((_, i) => i));
  if (!now || !start) return new Set();
  const iso = isoOf(start, d);
  if (iso > now.iso) return new Set();
  return new Set(day.meals.map((m, i) => (slotPassed(m.slot, now.minutes) ? i : -1)).filter((i) => i >= 0));
}

// A meal you said something about: "Åt inte" (`ate` 0) or "Åt något annat" (`custom`). Older weeks also
// have shares of the planned portion in `ate`.
export const isLogged = (m) => !!m.custom || m.ate !== undefined;
export const isSkipped = (m) => m.ate === 0 && !m.custom;
// Logged, past or on a day that is over: the app keeps it as it is (you can still change it yourself).
export const isPinned = (week, d, i) => isLogged(week.days[d].meals[i]) || passedOf(week.start, d, week.days[d]).has(i);
// Marked done by you, or a day before today: nothing is re-fitted any more.
export const dayOver = (week, d) => week.days[d].done === true || isPastDay(week.start, d);
export const isDone = (day) => day?.done === true;

// --- Your own calorie change for one day (day.adjust, kcal) ---
export const ADJUST_MIN = -1500;
export const ADJUST_MAX = 1000;
export const ADJUST_STEP = 50;
export const MIN_DAY_KCAL = 1200;
export const canAdjust = (target, v) => validAdjust(v) && target.kcal + v >= Math.min(MIN_DAY_KCAL, target.kcal);
const validAdjust = (v) => Number.isInteger(v) && v >= ADJUST_MIN && v <= ADJUST_MAX && v % ADJUST_STEP === 0;
export const adjustByYou = (day) => validAdjust(day?.adjust) && !day.adjustAuto;
export const adjustOf = (day) => (validAdjust(day?.adjust) ? day.adjust : 0);
export const dayTarget = (day, target) => ({ kcal: Math.max(Math.min(MIN_DAY_KCAL, target.kcal), target.kcal + adjustOf(day)), protein: target.protein });

// --- Amounts ---
// A planned meal has two scales: `portion` for the protein part and `side` for the sides (older weeks
// have one, `portion`, for both). `fixP` = the protein part set by you ("Mer protein"); `tweak` = one
// factor per ingredient set by you (then the meal keeps its scales, `fixed`).
export const KCAL_TOLERANCE = 0.05;
export const PROTEIN_TOLERANCE = 10;
const STEP = 0.05;
const A_BOUNDS = { frukost: [0.75, 1.6], lunch: [0.7, 2], middag: [0.7, 2], mellanmal: [0.5, 1.6] };
const B_BOUNDS = { frukost: [0.5, 1.5], lunch: [0.3, 2], middag: [0.3, 2], mellanmal: [0.5, 1.6] };
// Beyond this the protein part is bigger than a sensible portion; a top-up is then preferred.
export const NORMAL_MAX = 1.35;
const SIDE_NORMAL_MAX = 1.25; // sides never grow past this to make up for a meal not eaten
const BIG_COST = 20;
const PART_MAX = 2.5; // "Mer protein" stops here
export const MORE_STEP = 0.25;
export const TWEAK_STEP = 0.25;
export const TWEAK_MAX = 5;
const TWEAK_UNIT_STEP = { g: 10, st: 1, skivor: 1, dl: 0.5 };

const variantOf = (m) => { const d = dishOf(m.dish); return m.water && d?.water ? { ...d, ...d.water, lines: d.water.lines } : d; };
const sideOf = (m) => (finite(m.side) ? m.side : m.portion);
const tweakOf = (m, i) => (Array.isArray(m.tweak) && finite(m.tweak[i]) ? m.tweak[i] : 1);
// The meal's lines with your per-ingredient factors applied; a dish without lines is one protein part.
const linesFor = (m, d) => (d.lines ?? [{ kcal: d.kcal, protein: d.protein, fat: d.fat, carbs: d.carbs, part: "p", whole: true }])
  .map((l, i) => (l.whole ? l : { ...l, k: tweakOf(m, i) }));
function partsOf(m, d) {
  let p = { ...ZERO }, s = { ...ZERO };
  for (const l of linesFor(m, d)) { if (l.part === "p") p = add(p, l, l.k ?? 1); else s = add(s, l, l.k ?? 1); }
  return { p, s };
}

// Foods you added to one meal in the day view: meal.add = [{ name, nummer, amount, unit: "g" | "st", gpu
// (grams per unit), kcal, protein, fat, carbs (per 100 g) }]. They are not scaled: you set the amount.
export const ADD_MAX = 8;
const addsOf = (m) => (Array.isArray(m.add) ? m.add : []);
const addMacros = (a) => { const k = (a.amount * a.gpu) / 100; return { kcal: a.kcal * k, protein: a.protein * k, fat: a.fat * k, carbs: a.carbs * k }; };
const addsTotal = (m) => addsOf(m).reduce((t, a) => add(t, addMacros(a)), { ...ZERO });

// Scaled numbers for one planned meal: kcal, protein and ingredient amounts.
export function mealInfo(meal) {
  if (meal.custom) {
    const c = meal.custom;
    return { name: c.name || "Något annat", kcal: Math.round(c.kcal), protein: Math.round(c.protein), fat: 0, carbs: 0, ingredients: [], custom: true };
  }
  const base = dishOf(meal.dish);
  const water = !!(meal.water && base.water);
  const d = water ? { ...base, ...base.water, lines: base.water.lines, name: `${base.name} på vatten` } : base;
  const q = meal.ate ?? 1;
  const a = meal.portion * q, b = sideOf(meal) * q;
  const lines = d.lines;
  let tot = { ...ZERO };
  if (lines) lines.forEach((l, i) => { tot = add(tot, l, (l.part === "p" ? a : b) * tweakOf(meal, i)); });
  else tot = add(tot, d, a);
  tot = add(tot, addsTotal(meal), q);
  const added = addsOf(meal).map((x) => ({
    name: x.name, unit: x.unit, category: categoryOf(x.name), added: true,
    part: isProteinFood({ name: x.name, kcal: x.kcal, protein: x.protein }) ? "p" : "s",
    amount: x.unit === "g" ? Math.round(x.amount * q) : Math.round(x.amount * q * 10) / 10,
  }));
  return {
    name: d.name,
    ...(water ? { water: true } : {}),
    kcal: Math.round(tot.kcal), protein: Math.round(tot.protein), fat: Math.round(tot.fat), carbs: Math.round(tot.carbs),
    ingredients: d.ingredients.map(([name, amount, unit, category], i) => {
      const k = (lines ? (lines[i].part === "p" ? a : b) : a) * tweakOf(meal, i);
      return {
        name, unit, category, part: lines ? lines[i].part : "p",
        amount: unit === "g" ? Math.round((amount * k) / 5) * 5
          : unit === "dl" ? Math.round(amount * k * 10) / 10
            : Math.max(k > 0 ? 1 : 0, Math.round(amount * k)), // whole pieces: eggs and fruit
      };
    }).concat(added),
  };
}

// --- Top-ups ---
// day.extra (first top-up) and day.extra2 (second): { dish, portion, water?, manual? }. Added by the app
// when the meals can't reach the protein target at a sensible size; `manual` = added by you and always
// kept; day.extraOff = you removed it. Older weeks: `day.shake` (true or portions) reads as a manual shake.
const EXTRA_STEP = 0.5;
const EXTRA_MAX = 3; // stored weeks may hold up to this
// The most the planner gives of a top-up: two shakes, or one and a half portions of food (375 g quark).
const extraMax = (d) => (d.id === SHAKE_ID ? 2 : 1.5);
const EXTRA_COST = 0.05; // a small price, so a top-up is only used when it clearly helps
const WATER_COST = 0.05;
export const topupDish = () => dishOf(topup);
export const topup2Dish = () => (topup2 ? dishOf(topup2) : null);

// The top-ups the app suggests for day `d`: from your list (Rätter → Påfyllning), the protein-rich ones,
// starting with a different one each day so the week varies (the planner prefers the first, but takes a
// later one when only that one makes the day work).
export function suggestedTopups(d) {
  const list = DISHES.mellanmal.filter(isTopupCandidate);
  const i = list.length ? (((d ?? 0) % list.length) + list.length) % list.length : 0;
  return [...list.slice(i), ...list.slice(0, i)];
}
const ROTATION_COST = 0.5; // per place after the day's own top-up in the rotation
// kcal and protein of a stored top-up ({ dish, portion, water? }).
function extraFixed(e) {
  const d = dishOf(e.dish);
  if (!d) return { kcal: 0, protein: 0 };
  const v = e.water && d.water ? d.water : d;
  return { kcal: v.kcal * e.portion, protein: v.protein * e.portion };
}

function extraOf(day, key = "extra") {
  const e = day[key];
  if (isObject(e) && typeof e.dish === "string" && finite(e.portion) && e.portion > 0) return e;
  if (key !== "extra") return null;
  const s = day.shake === true ? 1 : finite(day.shake) && day.shake > 0 ? day.shake : 0;
  return s ? { dish: SHAKE_ID, portion: s, manual: true } : null;
}
const extraMeal = (day, key) => {
  const e = extraOf(day, key);
  return e && dishOf(e.dish) ? { slot: "mellanmal", dish: e.dish, portion: e.portion, side: e.portion, ...(e.water ? { water: true } : {}) } : null;
};
const extrasOf = (day) => ["extra", "extra2"].map((k) => extraMeal(day, k)).filter(Boolean);

// The meals of a day as eaten, the top-ups last. For totals and the shopping list.
export const dayItems = (day) => [...day.meals, ...extrasOf(day)];

// The scaled numbers of the day's top-ups, with whether you added them yourself.
export const extrasInfo = (day) => ["extra", "extra2"].map((k) => (extraMeal(day, k) ? { key: k, dish: extraOf(day, k).dish, ...mealInfo(extraMeal(day, k)), manual: !!extraOf(day, k).manual } : null)).filter(Boolean);

export function dayTotals(day) {
  return dayItems(day).reduce((a, m) => {
    const i = mealInfo(m);
    return { kcal: a.kcal + i.kcal, protein: a.protein + i.protein, fat: a.fat + i.fat, carbs: a.carbs + i.carbs };
  }, { kcal: 0, protein: 0, fat: 0, carbs: 0 });
}

// --- Solver ---
// items: one per meal: { p: {kcal, protein}, s: {kcal, protein}, a: [lo, hi], b: [lo, hi] } (lo == hi: fixed).
// Protein first: the protein parts are scaled (as evenly as possible, bigger parts more) until the day hits
// its protein; then the sides until it hits its calories. The sides carry a little protein too, so this is
// repeated a few times. Returns the scales rounded to 5 %, the totals and a cost.
function solve1(x, idx, vals, rest, bounds) {
  const fixedIdx = new Set(idx.filter((i) => bounds[i][0] === bounds[i][1]));
  for (const i of fixedIdx) x[i] = bounds[i][0];
  const pinned = new Set(fixedIdx);
  for (let round = 0; round <= idx.length; round++) {
    const free = idx.filter((i) => !pinned.has(i));
    if (!free.length) break;
    let r = rest, S = 0, Q = 0;
    for (const i of idx) if (pinned.has(i)) r -= x[i] * vals[i];
    for (const i of free) { S += vals[i]; Q += vals[i] ** 2; }
    const lambda = Q > 1e-9 ? (r - S) / Q : 0;
    let worst = -1, worstBy = 0;
    for (const i of free) {
      const v = 1 + lambda * vals[i];
      const [lo, hi] = bounds[i];
      x[i] = Math.min(hi, Math.max(lo, v));
      const by = Math.abs(x[i] - v);
      if (by > worstBy + 1e-12) { worst = i; worstBy = by; }
    }
    if (worst < 0) break;
    pinned.add(worst);
  }
}

const roundStep = (v) => Math.round(v / STEP) * STEP;

// Like solve1, with a weight per scale: minimum of Σ w (x − 1)² with Σ x v = rest, within bounds. A lower
// weight lets that scale move more.
const SIDE_WEIGHT = 0.5;
const PROTEIN_FILL = 0.15; // how much a protein part may grow past the protein's need to make up calories
const SIDE_FILL = 1.25; // sides may grow this much past their usual most to make up calories
const PROTEIN_OVER_MAX = 30; // g over the protein target the planner goes at most to make up calories
function solveW(x, vals, w, rest, bounds) {
  const idx = x.map((_, i) => i);
  const pinned = new Set(idx.filter((i) => bounds[i][0] === bounds[i][1]));
  for (const i of pinned) x[i] = bounds[i][0];
  for (let round = 0; round <= idx.length; round++) {
    const free = idx.filter((i) => !pinned.has(i));
    if (!free.length) break;
    let r = rest, S = 0, Q = 0;
    for (const i of idx) if (pinned.has(i)) r -= x[i] * vals[i];
    for (const i of free) { S += vals[i]; Q += vals[i] ** 2 / w[i]; }
    const lambda = Q > 1e-9 ? (r - S) / Q : 0;
    let worst = -1, worstBy = 0;
    for (const i of free) {
      const v = 1 + (lambda * vals[i]) / w[i];
      const [lo, hi] = bounds[i];
      x[i] = Math.min(hi, Math.max(lo, v));
      const by = Math.abs(x[i] - v);
      if (by > worstBy + 1e-12) { worst = i; worstBy = by; }
    }
    if (worst < 0) break;
    pinned.add(worst);
  }
}

// The sides' bounds when making up calories: a little past the usual most, unless the meal says not to.
const bFill = (it) => (it.b[0] === it.b[1] || it.noFill ? it.b : [it.b[0], it.b[1] * SIDE_FILL]);

function fitDay(items, target, fixed = { kcal: 0, protein: 0 }) {
  const n = items.length, idx = items.map((_, i) => i);
  const a = items.map((it) => (it.a[0] === it.a[1] ? it.a[0] : 1));
  const b = items.map((it) => (it.b[0] === it.b[1] ? it.b[0] : 1));
  for (let k = 0; k < 6; k++) {
    const restP = target.protein - fixed.protein - items.reduce((acc, it, i) => acc + b[i] * it.s.protein, 0);
    solve1(a, idx, items.map((it) => it.p.protein), restP, items.map((it) => it.a));
    const restK = target.kcal - fixed.kcal - items.reduce((acc, it, i) => acc + a[i] * it.p.kcal, 0);
    solve1(b, idx, items.map((it) => it.s.kcal), restK, items.map((it) => it.b));
  }
  // Still short of calories (lean dishes, a high target): the sides grow, the protein parts only a little
  // past what the protein needs (much more protein than the target is not wanted either), and never below
  // it. What is still missing then stays missing; the cost says so.
  const kcalNow = () => items.reduce((acc, it, i) => acc + a[i] * it.p.kcal + b[i] * it.s.kcal, 0) + fixed.kcal;
  if (kcalNow() < target.kcal * 0.98) {
    const x = [...a, ...b];
    const vals = [...items.map((it) => it.p.kcal), ...items.map((it) => it.s.kcal)];
    const weights = [...items.map(() => 1), ...items.map(() => SIDE_WEIGHT)];
    const pFill = (it, i) => [a[i], Math.max(a[i], Math.min(it.a[1], a[i] + PROTEIN_FILL))];
    const bounds = [...items.map((it, i) => (it.a[0] === it.a[1] ? it.a : pFill(it, i))), ...items.map(bFill)];
    solveW(x, vals, weights, target.kcal - fixed.kcal, bounds);
    for (let i = 0; i < n; i++) { a[i] = x[i]; b[i] = x[n + i]; }
    // The sides are as big as they go and the day is still well short: the protein parts grow, but only
    // to just within the calorie tolerance.
    const least = target.kcal * (1 - KCAL_TOLERANCE * 0.7);
    if (kcalNow() < least) {
      const y = [...a];
      const restK = least - fixed.kcal - items.reduce((acc, it, i) => acc + b[i] * it.s.kcal, 0);
      solveW(y, items.map((it) => it.p.kcal), items.map(() => 1), restK, items.map((it, i) => (it.a[0] === it.a[1] ? it.a : [a[i], Math.max(a[i], it.a[1])])));
      // Never past PROTEIN_OVER_MAX over the protein target: then the day stays a little short instead.
      const prot = (s) => fixed.protein + items.reduce((acc, it, i) => acc + s[i] * it.p.protein + b[i] * it.s.protein, 0);
      const cap = target.protein + PROTEIN_OVER_MAX, from = prot(a), to = prot(y);
      const t = to > cap && to > from ? Math.max(0, (cap - from) / (to - from)) : 1;
      for (let i = 0; i < n; i++) a[i] += t * (y[i] - a[i]);
    }
  }
  const clampRound = (v, [lo, hi]) => (lo === hi ? lo : Math.min(hi, Math.max(lo, roundStep(v))));
  for (let i = 0; i < n; i++) { a[i] = clampRound(a[i], items[i].a); b[i] = clampRound(b[i], bFill(items[i])); }
  const own = items.reduce((acc, it, i) => ({ kcal: acc.kcal + a[i] * it.p.kcal + b[i] * it.s.kcal, protein: acc.protein + a[i] * it.p.protein + b[i] * it.s.protein }), { kcal: 0, protein: 0 });
  const totals = { kcal: Math.round(own.kcal + fixed.kcal), protein: Math.round(own.protein + fixed.protein) };
  const missK = Math.max(0, Math.abs(totals.kcal - target.kcal) / target.kcal * 100 - 2);
  // Short of protein costs a lot; over it only a little, and only well over.
  const missP = Math.max(0, target.protein - totals.protein - 4) + 0.2 * Math.max(0, totals.protein - target.protein - 30);
  const free = (it, key) => it[key][0] !== it[key][1];
  const size = items.reduce((acc, it, i) => acc
    + (free(it, "a") ? (a[i] - 1) ** 2 + (totals.protein <= target.protein + 5 ? BIG_COST * Math.max(0, a[i] - NORMAL_MAX) ** 2 : 0) : 0)
    + (free(it, "b") ? 0.3 * (b[i] - 1) ** 2 : 0), 0);
  return { a, b, totals, cost: size + 5 * missK ** 2 + missP ** 2 };
}

// Fits the meals with or without top-ups. mode "off": none; "on": the ones you chose (`keep`), as you
// chose them, the meals fit around them; "auto": the app's suggestion for day `d` when it gives a clearly
// better day. The second top-up is only tried on top of the first.
function fitPlan(items, target, mode, keep = [], d = 0) {
  const plain = { ...fitDay(items, target), extra: null, extra2: null };
  if (mode === "off") return plain;
  if (mode === "on") {
    const fixed = keep.reduce((t, e) => { const x = extraFixed(e); return { kcal: t.kcal + x.kcal, protein: t.protein + x.protein }; }, { kcal: 0, protein: 0 });
    return { ...fitDay(items, target, fixed), extra: keep[0] ?? null, extra2: keep[1] ?? null };
  }
  const order = suggestedTopups(d);
  if (!order.length) return plain;
  // Only for protein: when the meals fall short of it, or reach it only with a protein part too big.
  const short = plain.totals.protein < target.protein - 4;
  const atNormal = items.reduce((acc, it, i) => acc + (it.a[0] === it.a[1] ? it.a[0] : Math.min(NORMAL_MAX, it.a[1])) * it.p.protein + plain.b[i] * it.s.protein, 0);
  const need = target.protein - atNormal;
  // A protein part beyond a normal size only counts when the protein needed it, not the calories.
  const big = need > 4;
  // Or when the protein can't be had within the calories: a shake gives it with fewer than meat does.
  const overK = plain.totals.kcal > target.kcal * (1 + KCAL_TOLERANCE / 2);
  if (mode === "auto" && !short && !big && !overK) return plain;
  // A top-up covers the protein the meals can't give at a sensible size, not calories.
  const tooMuch = (protein) => mode === "auto" && !overK && protein > Math.max(0, need) + 20;
  let best = null;
  const consider = (fit, extra, extra2, extraCost) => {
    const cost = fit.cost + extraCost;
    if (!best || cost < best.cost) best = { ...fit, cost, extra, extra2 };
  };
  // The protein never ends up far over the target because of a top-up.
  const overP = (fit) => fit.totals.protein > target.protein + PROTEIN_OVER_MAX;
  order.forEach((ex, rank) => {
  const ex2 = order[(rank + 1) % order.length];
  const variants = [{ d: ex, water: false }, ...(ex.water ? [{ d: { ...ex, ...ex.water }, water: true }] : [])];
  const portions = Array.from({ length: Math.round(extraMax(ex) / EXTRA_STEP) }, (_, k) => (k + 1) * EXTRA_STEP);
  const rot = rank * ROTATION_COST;
  for (const v of variants) {
    for (const p of portions) {
      const fixed = { kcal: v.d.kcal * p, protein: v.d.protein * p };
      const extra = { dish: ex.id, portion: p, ...(v.water ? { water: true } : {}) };
      // More than one portion a day is a lot: from 1.5 on it costs a little more.
      const many = Math.max(0, p - 1) * 0.3;
      if (tooMuch(fixed.protein)) continue;
      const fit = fitDay(items, target, fixed);
      if (overP(fit)) continue;
      consider(fit, extra, null, rot + EXTRA_COST + many + (v.water ? WATER_COST : 0));
      if (ex2 && ex2.id !== ex.id && p <= 1.5) {
        for (let p2 = EXTRA_STEP; p2 <= extraMax(ex2); p2 += EXTRA_STEP) {
          const f2 = { kcal: fixed.kcal + ex2.kcal * p2, protein: fixed.protein + ex2.protein * p2 };
          if (tooMuch(f2.protein)) continue;
          const fit2 = fitDay(items, target, f2);
          if (overP(fit2)) continue;
          consider(fit2, extra, { dish: ex2.id, portion: p2 }, rot + 2 * EXTRA_COST + 0.2 + (v.water ? WATER_COST : 0));
        }
      }
    }
  }
  });
  return best && best.cost < plain.cost ? best : plain;
}

// Re-fits day `d` of `week` (given as `day`, which may differ from the stored one). Eaten and past meals
// stay as they are. A meal whose amounts you set keeps them; the others fit around them.
function refit(week, d, day) {
  const target = dayTarget(day, week.target);
  const passed = passedOf(week.start, d, day);
  const locked = day.meals.map((m, i) => isLogged(m) || passed.has(i));
  // Something skipped or eaten less of: the meals left make up the protein, but their sides never grow past
  // a normal portion (or what was planned) to make up the calories; the week's balance takes the rest.
  const under = day.meals.some((m) => m.ate !== undefined && m.ate < 1 && !m.custom);
  const items = day.meals.map((m, i) => {
    if (m.custom) return { p: { kcal: m.custom.kcal, protein: m.custom.protein }, s: ZERO, a: [1, 1], b: [0, 0] };
    const dd = variantOf(m);
    const { p, s } = partsOf(m, dd);
    if (locked[i]) { const q = m.ate ?? 1; return { p, s, a: [m.portion * q, m.portion * q], b: [sideOf(m) * q, sideOf(m) * q] }; }
    if (m.fixed || m.manual) return { p, s, a: [m.portion, m.portion], b: [sideOf(m), sideOf(m)] };
    const [blo, bhi] = B_BOUNDS[m.slot] ?? B_BOUNDS.lunch;
    const b = under ? [blo, Math.min(bhi, Math.max(SIDE_NORMAL_MAX, sideOf(m)))] : [blo, bhi];
    const a = finite(m.fixP) ? [m.fixP, m.fixP] : A_BOUNDS[m.slot] ?? A_BOUNDS.lunch;
    return { p, s, a, b, ...(under ? { noFill: true } : {}) };
  });
  const { shake: _s, extra: _e, extra2: _e2, ...plain } = day;
  const old = extraOf(day), old2 = extraOf(day, "extra2");
  // Day over: the top-ups stay as they were.
  if (locked.every(Boolean)) {
    return { ...plain, ...(old ? { extra: old } : {}), ...(old2 ? { extra2: old2 } : {}), meals: day.meals };
  }
  const mode = day.extraOff ? "off" : old?.manual ? "on" : "auto";
  // Foods you added are what you said: the rest of the day fits around them.
  const added = day.meals.reduce((t, m) => (m.custom ? t : add(t, addsTotal(m), m.ate ?? 1)), { ...ZERO });
  const keep = mode === "on" ? [old, ...(old2?.manual ? [old2] : [])].filter((e) => dishOf(e.dish)) : [];
  const fit = fitPlan(items, { kcal: target.kcal - added.kcal, protein: target.protein - added.protein }, mode, keep, d);
  const manual = mode === "on" ? { manual: true } : {};
  return {
    ...plain,
    ...(fit.extra ? { extra: { ...fit.extra, ...manual } } : {}),
    ...(fit.extra2 ? { extra2: { ...fit.extra2, ...manual } } : {}),
    meals: day.meals.map((m, i) => {
      if (locked[i] || m.custom) return m;
      const { manual: _m, ...rest } = m;
      return m.manual ? { ...rest, portion: fit.a[i], side: fit.b[i], fixed: true } : { ...rest, portion: fit.a[i], side: fit.b[i] };
    }),
  };
}

const replaceDay = (week, d, day) => ({ ...week, days: week.days.map((x, i) => (i === d ? day : x)) });
const slotIndex = (day, slot) => day.meals.findIndex((m) => m.slot === slot);

// --- The week's dishes ---
// Four lunch/dinner dishes a week: A (batch-cooked, beef), B (batch-cooked, chicken), F (fish), Q (quick).
// Each day's lunch and dinner from the rotation below: A and B five times each (cook once, eat many
// times), the fish and the quick dish twice. Lunch and dinner always differ.
export const ROTATION = [["A", "B"], ["A", "F"], ["A", "B"], ["B", "Q"], ["B", "A"], ["Q", "F"], ["B", "A"]];
const BEEF = /nöt|färs|biff|högrev|grytbit|hamburgare/i;
const CHICKEN = /kyckling/i;
const textOf = (d) => [d.name, ...d.ingredients.map((i) => i[0])].join(" ");

const weekNo = (start) => {
  const [y, m, d] = start.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2024, 0, 1)) / (7 * 864e5));
};

// The four dishes of a week. Half of them change from one week to the next (A and the fish on one week,
// B and the quick dish on the next), so there is variety without starting over. `salt` gives another pick.
export function rolesOf(start, salt = 0) {
  const mains = [...new Map([...DISHES.lunch, ...DISHES.middag].map((d) => [d.id, d])).values()].sort((x, y) => x.id.localeCompare(y.id));
  const ofKind = (k) => mains.filter((d) => d.kind === k);
  const storkok = ofKind("storkok");
  const beef = storkok.filter((d) => BEEF.test(textOf(d)) && !CHICKEN.test(textOf(d)));
  const chicken = storkok.filter((d) => CHICKEN.test(textOf(d)));
  const otherStorkok = storkok.filter((d) => !beef.includes(d) && !chicken.includes(d));
  const w = weekNo(start);
  const mod = (x, n) => ((x % n) + n) % n;
  const at = (list, phase) => (list.length ? list[mod(Math.floor((w + phase) / 2) + salt, list.length)] : null);
  const used = new Set();
  const take = (lists, phase) => {
    for (const list of lists) {
      const free = list.filter((d) => !used.has(d.id));
      const d = at(free, phase);
      if (d) { used.add(d.id); return d; }
    }
    return null;
  };
  const A = take([beef, otherStorkok, chicken, storkok], 0);
  const B = take([chicken, otherStorkok, beef, storkok], 1);
  const F = take([ofKind("fisk")], 0);
  const Q = take([ofKind("snabb")], 1);
  // A missing kind is filled from whatever is on offer.
  const fill = (d, phase) => d ?? take([storkok, mains], phase) ?? at(mains, phase);
  return { A: fill(A, 0), B: fill(B, 1), F: fill(F, 0), Q: fill(Q, 1) };
}

// The dish for one meal of day `d`: from the rotation, or the best other one on offer when that dish
// can't be eaten at this meal (limited to lunch or dinner) or would repeat the day's other main.
function mainFor(roles, d, slot, other) {
  const want = roles[ROTATION[d][slot === "lunch" ? 0 : 1]];
  if (want && fits(want, slot) && want.id !== other) return want;
  const inWeek = Object.values(roles).filter((x) => x && fits(x, slot) && x.id !== other);
  return inWeek[0] ?? DISHES[slot].find((x) => x.id !== other) ?? DISHES[slot][0];
}

// Breakfast is the same every day: your everyday breakfast (set in Rätter), changed by you on the days
// you want something else.
const breakfastFor = () => dishOf(breakfast) && isVisible(breakfast) ? dishOf(breakfast) : DISHES.frukost[0];

// A planned day for day `d` from the week's dishes. Meals of `old` that are eaten or past are kept (an
// older day's snack too, when it is past), and so are your calorie change and top-up choices.
function planDay(week, d, roles, salt, old = null) {
  const fresh = {
    frukost: breakfastFor(),
    lunch: mainFor(roles, d, "lunch", null),
  };
  fresh.middag = mainFor(roles, d, "middag", fresh.lunch.id);
  const passed = old ? passedOf(week.start, d, old) : new Set();
  const keptOld = (slot) => {
    const i = old ? slotIndex(old, slot) : -1;
    return i >= 0 && (isLogged(old.meals[i]) || passed.has(i)) ? old.meals[i] : null;
  };
  const meals = [];
  for (const slot of ["frukost", "lunch", "mellanmal", "middag"]) {
    const kept = keptOld(slot);
    if (kept) meals.push(kept);
    else if (slot !== "mellanmal") meals.push({ slot, dish: fresh[slot].id, portion: 1, side: 1 });
  }
  // The day's other main must not be the same dish as a kept one.
  const li = slotIndex({ meals }, "lunch"), mi = slotIndex({ meals }, "middag");
  if (li >= 0 && mi >= 0 && !meals[mi].custom && !isLogged(meals[mi]) && meals[mi].dish === meals[li].dish && !keptOld("middag")) {
    meals[mi] = { slot: "middag", dish: mainFor(roles, d, "middag", meals[li].dish).id, portion: 1, side: 1 };
  }
  const day = { meals };
  if (old) {
    if (old.adjust !== undefined && validAdjust(old.adjust)) { day.adjust = old.adjust; if (old.adjustAuto) day.adjustAuto = true; }
    if (old.extraOff) day.extraOff = true;
    const e = extraOf(old);
    if (e?.manual) day.extra = e;
  }
  return refit(week, d, day);
}

// Bumped when the planner changes in a way stored weeks should pick up (4: three meals, protein first).
export const PLAN_VERSION = 4;

// target = { kcal, protein }. Returns { start, target, v, days: [{ meals: [...] }] }.
export function generateWeek(start, target, salt = 0) {
  const week = { start, target, v: PLAN_VERSION, days: Array.from({ length: 7 }, () => ({ meals: [] })) };
  const roles = rolesOf(start, salt);
  for (let d = 0; d < 7; d++) week.days[d] = planDay(week, d, roles, salt);
  return week;
}

// A new suggestion for days `from`..6 with other dishes (`salt`); earlier days stay. Eaten and past meals
// are kept, and so is what you typed under "Åt något annat".
export function regenerateFrom(week, from, salt = 1) {
  const f = Math.max(0, Math.min(7, from));
  const roles = rolesOf(week.start, salt);
  let next = { ...week, days: [...week.days] };
  for (let d = f; d < 7; d++) next = replaceDay(next, d, planDay(next, d, roles, salt, week.days[d]));
  return next;
}

// A week stored by an older planner (four meals, one scale): days that are over stay as they were; the
// rest are planned again with three meals, keeping what was eaten or is past.
export function migrateWeek(week, target) {
  let next = { ...week, target, v: PLAN_VERSION, days: [...week.days] };
  const roles = rolesOf(week.start, 0);
  for (let d = 0; d < 7; d++) {
    if (dayOver(next, d)) continue;
    next = replaceDay(next, d, planDay(next, d, roles, 0, week.days[d]));
  }
  return next;
}

// --- Changes from the day view ---
const editable = (week, d, slot) => {
  const day = week.days[d];
  if (!day) return -1;
  const i = slotIndex(day, slot);
  return i >= 0 ? i : -1;
};
const withMeal = (week, d, i, meal) => {
  const day = week.days[d];
  return replaceDay(week, d, refit(week, d, { ...day, meals: day.meals.map((m, j) => (j === i ? meal : m)) }));
};

// "Åt inte": the meal counts as nothing eaten and the meals left make up the protein (calories up to a
// normal portion; the rest goes to the week's balance). `on` false puts it back.
export function setSkip(week, d, slot, on) {
  const i = editable(week, d, slot);
  if (i < 0) return null;
  const { ate: _a, custom: _c, ...plain } = week.days[d].meals[i];
  // The scales stay: a past meal put back is what was planned, a coming one is fitted again anyway.
  return withMeal(week, d, i, on ? { ...plain, ate: 0 } : plain);
}

// "Åt något annat": the meal counts as { name, kcal, protein }; `custom` null puts the planned dish back.
export function setCustom(week, d, slot, custom) {
  const i = editable(week, d, slot);
  if (i < 0) return null;
  const { custom: _old, ate: _ate, manual: _m, fixed: _f, fixP: _p, tweak: _t, add: _ad, ...plain } = week.days[d].meals[i];
  return withMeal(week, d, i, custom ? { ...plain, portion: 1, side: 1, custom } : { ...plain, portion: 1, side: 1 });
}

// "Mer protein": the meal's protein part one step bigger than now; the sides of the day make room.
export function moreProtein(week, d, slot) {
  const i = editable(week, d, slot);
  const m = i >= 0 ? week.days[d].meals[i] : null;
  if (!m || isPinned(week, d, i) || m.custom || m.fixed) return null;
  const fixP = Math.min(PART_MAX, roundStep((finite(m.fixP) ? m.fixP : m.portion) + MORE_STEP));
  return withMeal(week, d, i, { ...m, fixP });
}
export const canMoreProtein = (m) => !m.custom && !m.fixed && (finite(m.fixP) ? m.fixP : m.portion) + MORE_STEP <= PART_MAX + 1e-9;

// The meal at `slot` of day `d` with its dish, when its amounts can be changed (not "Åt något annat").
function dishMeal(week, d, slot) {
  const i = editable(week, d, slot);
  const m = i >= 0 ? week.days[d].meals[i] : null;
  const dd = m && !m.custom && !isSkipped(m) ? dishOf(m.dish) : null;
  return dd ? { i, m, dd } : null;
}
// The amount of ingredient `ing` at your factor 1.
function amountAtOne(m, dd, ing) {
  const scale = dd.lines ? (dd.lines[ing].part === "p" ? m.portion : sideOf(m)) : m.portion;
  return dd.ingredients[ing][1] * scale * (m.ate ?? 1);
}

// One ingredient set to `amount` (in its own unit; 0 = left out). Works on any meal, also one already
// eaten: the meal then keeps its amounts, and the other meals of the day not yet eaten fit around it.
export function setAmount(week, d, slot, ing, amount) {
  const x = dishMeal(week, d, slot);
  if (!x || !(ing >= 0 && ing < x.dd.ingredients.length) || !(finite(amount) && amount >= 0)) return null;
  const { i, m, dd } = x;
  const per = amountAtOne(m, dd, ing);
  if (!(per > 0)) return null;
  const tweak = dd.ingredients.map((_, j) => tweakOf(m, j));
  const v = Math.min(TWEAK_MAX, Math.round((amount / per) * 1e4) / 1e4);
  if (Math.abs(v - tweak[ing]) < 1e-9) return null;
  tweak[ing] = v;
  const { fixP: _p, ...rest } = m;
  return withMeal(week, d, i, { ...rest, tweak, fixed: true });
}

// One ingredient more or less: to the next whole step (10 g, one piece, half a dl; 25 % for other units).
export function tweakIngredient(week, d, slot, ing, dir) {
  const x = dishMeal(week, d, slot);
  if (!x || !(ing >= 0 && ing < x.dd.ingredients.length)) return null;
  const { m, dd } = x;
  const unit = dd.ingredients[ing][2];
  const step = TWEAK_UNIT_STEP[unit];
  const now = mealInfo(m).ingredients[ing].amount; // as shown
  let next;
  if (step) next = dir > 0 ? Math.floor(now / step + 1e-6) * step + step : Math.ceil(now / step - 1e-6) * step - step;
  else next = amountAtOne(m, dd, ing) * (tweakOf(m, ing) + dir * TWEAK_STEP);
  return setAmount(week, d, slot, ing, Math.max(0, next));
}

// --- Foods you add to a meal ---
// `food` = { nummer, name, kcal, protein, fat, carbs } per 100 g; `gpu` grams per piece for foods you count
// (eggs, bananas), else weighed in grams.
export const ADD_STEP = { g: 10, st: 1 };
export function addFood(week, d, slot, food, gpu = null) {
  const x = dishMeal(week, d, slot);
  if (!x || !food || addsOf(x.m).length >= ADD_MAX || ![food.kcal, food.protein, food.fat, food.carbs].every(finite)) return null;
  const counted = finite(gpu) && gpu > 0;
  const item = {
    name: food.name, nummer: food.nummer, unit: counted ? "st" : "g", gpu: counted ? gpu : 1,
    amount: counted ? 1 : Math.max(10, Math.round(defaultGrams(food) / 10) * 10),
    kcal: food.kcal, protein: food.protein, fat: food.fat, carbs: food.carbs,
  };
  return withMeal(week, d, x.i, { ...x.m, add: [...addsOf(x.m), item], fixed: true });
}
// An added food's amount; 0 takes it away.
export function setAddAmount(week, d, slot, j, amount) {
  const x = dishMeal(week, d, slot);
  const list = x ? addsOf(x.m) : [];
  if (!x || !(j >= 0 && j < list.length) || !(finite(amount) && amount >= 0 && amount <= 5000)) return null;
  const rounded = list[j].unit === "st" ? Math.round(amount * 2) / 2 : Math.round(amount);
  const next = rounded > 0 ? list.map((a, k) => (k === j ? { ...a, amount: rounded } : a)) : list.filter((_, k) => k !== j);
  const { add: _a, ...rest } = x.m;
  return withMeal(week, d, x.i, { ...rest, ...(next.length ? { add: next } : {}), fixed: true });
}
export function stepAdd(week, d, slot, j, dir) {
  const x = dishMeal(week, d, slot);
  const a = x ? addsOf(x.m)[j] : null;
  if (!a) return null;
  const step = ADD_STEP[a.unit] ?? 10;
  const next = dir > 0 ? Math.floor(a.amount / step + 1e-6) * step + step : Math.ceil(a.amount / step - 1e-6) * step - step;
  return setAddAmount(week, d, slot, j, Math.max(0, next));
}

// Hands the meal's amounts back to the app.
export function resetMeal(week, d, slot) {
  const i = editable(week, d, slot);
  if (i < 0) return null;
  const { fixP: _p, tweak: _t, fixed: _f, manual: _m, ...plain } = week.days[d].meals[i];
  return withMeal(week, d, i, plain);
}
export const isTouched = (m) => !m.custom && (finite(m.fixP) || m.fixed || m.manual || Array.isArray(m.tweak) || addsOf(m).length > 0);

// The dish at the day's other main meal (lunch for dinner and the other way round), or null.
export function otherMain(day, slot) {
  if (!isMain(slot)) return null;
  const m = day.meals.find((x) => isMain(x.slot) && x.slot !== slot);
  return m && !m.custom ? m.dish : null;
}

// Another dish for one meal; the day is re-fitted. Null for an unknown day, slot or dish.
export function changeDish(week, d, slot, dishId) {
  const i = editable(week, d, slot);
  const chosen = dishOf(dishId);
  if (i < 0 || !fits(chosen, slot) || otherMain(week.days[d], slot) === dishId) return null;
  const kept = addsOf(week.days[d].meals[i]);
  return withMeal(week, d, i, { slot, dish: dishId, portion: 1, side: 1, chosen: true, ...(kept.length ? { add: kept, fixed: true } : {}) });
}

// The top-up added (on) or removed (off) by you; the day is re-fitted.
export function setExtra(week, d, on) {
  const day = week.days[d];
  const first = suggestedTopups(d)[0];
  if (!day || (on && !first)) return null;
  const { shake: _s, extra: _e, extra2: _e2, extraOff: _o, ...plain } = day;
  const next = on ? { ...plain, extra: { dish: first.id, portion: 1, manual: true } } : { ...plain, extraOff: true };
  return replaceDay(week, d, refit(week, d, next));
}

// --- The day's top-ups: up to two rows, `k` 0 or 1 ---
// Row 0: "auto" (the app suggests one from your list when the meals fall short of the protein), "none", or
// a top-up you chose. Row 1 (only with a first one): a top-up you chose, or "none" to take it away. What
// you choose is kept as you chose it and the meals fit around it; choosing makes both rows yours. On a day
// that is over only the top-ups change and "auto" is not offered.
export const TOPUP_ROWS = 2;
const KEYS = ["extra", "extra2"];
function withTopups(week, d, list, off = false) {
  const day = week.days[d];
  const { shake: _s, extra: _e, extra2: _e2, extraOff: _o, ...plain } = day;
  const next = { ...plain, ...(off ? { extraOff: true } : {}) };
  list.slice(0, TOPUP_ROWS).forEach((e, k) => { next[KEYS[k]] = { ...e, manual: true }; });
  return replaceDay(week, d, dayOver(week, d) ? next : refit(week, d, next));
}
const topupsOf = (day) => KEYS.map((k) => extraOf(day, k)).filter(Boolean);
const choosable = (id) => dishOf(id)?.slot === "mellanmal" && isListed(id);

export function setTopup(week, d, k, choice) {
  const day = week.days[d];
  if (!day || !(k === 0 || k === 1)) return null;
  const over = dayOver(week, d);
  const cur = topupsOf(day);
  if (k === 0 && choice === "auto") {
    if (over) return null;
    const { shake: _s, extra: _e, extra2: _e2, extraOff: _o, ...plain } = day;
    return replaceDay(week, d, refit(week, d, plain));
  }
  if (choice === "none") return k === 0 ? withTopups(week, d, [], true) : cur.length ? withTopups(week, d, cur.slice(0, 1)) : null;
  // The same top-up in both rows is one row with more portions.
  if (!choosable(choice) || (k === 1 && !cur.length) || cur.some((e, j) => j !== k && e.dish === choice)) return null;
  const portion = cur[k]?.dish === choice ? cur[k].portion : 1;
  const water = cur[k]?.dish === choice && cur[k].water ? { water: true } : {};
  const list = [...cur];
  list[k] = { dish: choice, portion, ...water };
  return withTopups(week, d, list);
}
// Backwards compatible: the first row.
export const setExtraChoice = (week, d, choice) => setTopup(week, d, 0, choice);

// "+ Lägg till påfyllning": one more row, the app's suggestion that is not already there.
export const canAddTopup = (day, d) => topupsOf(day).length < TOPUP_ROWS && suggestedTopups(d).some((x) => !topupsOf(day).some((e) => e.dish === x.id));
export function addTopup(week, d) {
  const day = week.days[d];
  const cur = day ? topupsOf(day) : [];
  if (!day || cur.length >= TOPUP_ROWS) return null;
  const pick = suggestedTopups(d).find((x) => !cur.some((e) => e.dish === x.id));
  if (!pick) return null;
  return withTopups(week, d, [...cur, { dish: pick.id, portion: 1 }]);
}

// Half a portion more or less of row `k`.
export function stepTopup(week, d, k, dir) {
  const day = week.days[d];
  const cur = day ? topupsOf(day) : [];
  if (!cur[k]) return null;
  const portion = Math.round((cur[k].portion + dir * EXTRA_STEP) / EXTRA_STEP) * EXTRA_STEP;
  if (portion <= 0 || portion > EXTRA_MAX) return null;
  const list = [...cur];
  list[k] = { ...cur[k], portion };
  return withTopups(week, d, list);
}
export const stepExtra = (week, d, dir) => stepTopup(week, d, 0, dir);
export const EXTRA_PORTION_MAX = EXTRA_MAX;

// The protein still missing for the day's target (0 when reached).
export function proteinShort(day, target) {
  const goal = dayTarget(day, target);
  return Math.max(0, Math.round(goal.protein - dayTotals(day).protein));
}

// The day marked done ("Klar") or opened again. Done: nothing in it is re-fitted any more, and the week's
// balance counts it. Opened again: the meals not yet past fit the day again.
export function setDone(week, d, on) {
  const day = week.days[d];
  if (!day) return null;
  const { done: _d, ...plain } = day;
  if (on) return replaceDay(week, d, { ...plain, done: true });
  return replaceDay(week, d, refit(week, d, plain));
}

// The day's top-up choice, as setExtraChoice takes it.
export const extraPortions = (day, k = 0) => extraOf(day, KEYS[k])?.portion ?? 0;
export const extraChoice = (day) => (day.extraOff ? "none" : extraOf(day)?.manual ? extraOf(day).dish : "auto");

// Calories up (or down) for one day; protein stays. `auto` = set by the app to even out the week.
export function setAdjust(week, d, kcal, { auto = false } = {}) {
  const day = week.days[d];
  const v = kcal ?? 0;
  if (!day || !canAdjust(week.target, v)) return null;
  const { adjust: _a, adjustAuto: _b, ...plain } = day;
  const changed = auto ? (v ? { ...plain, adjust: v, adjustAuto: true } : plain) : { ...plain, adjust: v };
  return replaceDay(week, d, dayOver(week, d) ? changed : refit(week, d, changed));
}

// --- The week's balance ---
// The week's calorie budget is the daily target times seven. What was eaten over it on the days already
// done is taken off the days left, spread evenly. A day under the target counts against a day over it, but
// no day is given more than its target. Days you changed yourself keep your number. At most a quarter of
// the target per day and never below MIN_DAY_KCAL; what that keeps from being paid back is `unpaid`.
export function balanceOf(week, todayIdx) {
  const done = (d) => d < todayIdx || dayOver(week, d);
  const counted = (day) => day.meals.some((m) => isLogged(m) || isTouched(m)) || !!extraOf(day)?.manual;
  const overOn = (day) => (counted(day) ? dayTotals(day).kcal - week.target.kcal : adjustOf(day));
  const doneOver = week.days.reduce((a, day, d) => (done(d) ? a + overOn(day) : a), 0);
  const open = week.days.map((_, d) => d).filter((d) => d >= todayIdx && !done(d));
  const days = open.filter((d) => !adjustByYou(week.days[d]));
  const byYou = open.reduce((a, d) => (adjustByYou(week.days[d]) ? a + adjustOf(week.days[d]) : a), 0);
  const sum = doneOver + byYou;
  const left = sum >= 100 ? sum : 0;
  const most = Math.floor((week.target.kcal * 0.25) / ADJUST_STEP) * ADJUST_STEP;
  const wanted = days.length ? Math.round(left / days.length / ADJUST_STEP) * ADJUST_STEP : 0;
  let take = -Math.min(most, wanted);
  while (take < 0 && !canAdjust(week.target, take)) take += ADJUST_STEP;
  take = take || 0;
  const limited = !days.length || -take < wanted;
  const unpaid = limited ? Math.max(0, left + take * days.length) : 0;
  return { over: Math.max(0, Math.round(left)), take, days, unpaid: unpaid >= ADJUST_STEP ? Math.round(unpaid) : 0 };
}

// --- How the week went ---
export function dayResult(day, weekTarget) {
  const t = dayTotals(day), goal = dayTarget(day, weekTarget);
  const kcalOk = t.kcal <= goal.kcal * (1 + KCAL_TOLERANCE);
  const proteinOk = t.protein >= goal.protein - PROTEIN_TOLERANCE;
  return { kcal: t.kcal, protein: t.protein, goal, kcalOk, proteinOk, ok: kcalOk && proteinOk };
}

export const WEEK_KCAL_TOLERANCE = 0.03;
export function weekResult(week, todayIdx) {
  const done = (d) => d < todayIdx || dayOver(week, d);
  const days = week.days.map((day, d) => ({ ...dayResult(day, week.target), done: done(d) }));
  const kcal = days.reduce((a, x) => a + x.kcal, 0);
  const budget = week.target.kcal * 7;
  const protein = Math.round(days.reduce((a, x) => a + x.protein, 0) / 7);
  const kcalOk = kcal <= budget * (1 + WEEK_KCAL_TOLERANCE);
  const proteinOk = protein >= week.target.protein - PROTEIN_TOLERANCE;
  return {
    kcal, budget, protein, kcalOk, proteinOk, ok: kcalOk && proteinOk, days,
    proteinDays: days.filter((x) => x.proteinOk).length, over: days.every((x) => x.done),
  };
}

// What to cook for days `from`..6: each dish once, with how many times it is eaten, on which days and the
// ingredients summed. Lunch and dinner first (the batch cooking), then breakfast and top-ups. Meals eaten
// otherwise or skipped are left out.
export const PREP_GROUPS = [
  { id: "lador", label: "Lunch och middag", slots: MAIN },
  { id: "frukost", label: "Frukost", slots: ["frukost"] },
  { id: "mellanmal", label: "Påfyllning", slots: ["mellanmal"] },
];
export function prepList(week, from = 0) {
  const groups = PREP_GROUPS.map((gr) => ({ ...gr, map: new Map() }));
  week.days.forEach((day, d) => {
    if (d < from) return;
    for (const m of dayItems(day)) {
      if (m.custom || m.ate === 0 || !dishOf(m.dish)) continue;
      const info = mealInfo(m);
      const gr = groups.find((x) => x.slots.includes(m.slot));
      const key = `${m.dish}|${info.water ? "w" : ""}`;
      const cur = gr.map.get(key) ?? { key, name: info.name, count: 0, days: [], ing: new Map() };
      cur.count++;
      if (!cur.days.includes(d)) cur.days.push(d);
      for (const it of info.ingredients) {
        if (/^vatten$/i.test(it.name) || !it.amount) continue;
        const k = `${it.name.toLowerCase()}|${it.unit}`;
        const x = cur.ing.get(k) ?? { name: it.name, unit: it.unit, amount: 0 };
        x.amount = Math.round((x.amount + it.amount) * 10) / 10;
        cur.ing.set(k, x);
      }
      gr.map.set(key, cur);
    }
  });
  return groups.map(({ id, label, map }) => ({
    id, label,
    dishes: [...map.values()]
      .sort((a, b) => b.count - a.count || a.days[0] - b.days[0])
      .map(({ ing, ...x }) => ({ ...x, ingredients: [...ing.values()] })),
  })).filter((gr) => gr.dishes.length);
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

// --- Stored weeks ---
const validShare = (v) => finite(v) && v >= 0 && v <= 2 && Math.abs(v * 4 - Math.round(v * 4)) < 1e-9;
const validAdd = (a) => isObject(a) && typeof a.name === "string" && a.name !== "" && (a.unit === "g" || a.unit === "st")
  && [a.amount, a.gpu, a.kcal, a.protein, a.fat, a.carbs].every(finite) && a.amount > 0 && a.gpu > 0;
const validMeal = (m) => isObject(m) && DISH_SLOTS.includes(m.slot) && typeof m.dish === "string" && finite(m.portion)
  && (m.side === undefined || finite(m.side))
  && (m.custom === undefined || (isObject(m.custom) && finite(m.custom.kcal) && finite(m.custom.protein)))
  && (m.ate === undefined || validShare(m.ate))
  && (m.fixP === undefined || finite(m.fixP))
  && (m.tweak === undefined || (Array.isArray(m.tweak) && m.tweak.every(finite)))
  && (m.add === undefined || (Array.isArray(m.add) && m.add.length <= ADD_MAX && m.add.every(validAdd)))
  && ["water", "manual", "fixed", "chosen"].every((k) => m[k] === undefined || typeof m[k] === "boolean");
const extraPortion = (p) => finite(p) && p > 0 && p <= EXTRA_MAX && Math.abs(p / EXTRA_STEP - Math.round(p / EXTRA_STEP)) < 1e-9;
const validExtraObj = (e) => e === undefined || (isObject(e) && typeof e.dish === "string" && extraPortion(e.portion)
  && (e.water === undefined || typeof e.water === "boolean"));
const validExtra = (d) => (d.shake === undefined || d.shake === true || extraPortion(d.shake))
  && validExtraObj(d.extra) && validExtraObj(d.extra2)
  && (d.extraOff === undefined || typeof d.extraOff === "boolean")
  && (d.done === undefined || typeof d.done === "boolean");
export const isWeek = (w) => isObject(w) && isObject(w.target) && typeof w.start === "string" && Array.isArray(w.days) && w.days.length === 7
  && w.days.every((d) => isObject(d) && validExtra(d) && Array.isArray(d.meals) && d.meals.length >= 1 && d.meals.length <= 5 && d.meals.every(validMeal));
export const resolves = (week) => week.days.every((day) => day.meals.every((m) => m.custom || dishOf(m.dish))
  && ["extra", "extra2"].every((k) => !extraOf(day, k) || dishOf(extraOf(day, k).dish)));

// Re-fits every day not over that uses one of `ids` (a set of dish ids), after those dishes were edited.
export function refitWeek(week, ids) {
  let next = week;
  week.days.forEach((day, d) => {
    if (dayOver(week, d)) return;
    const uses = dayItems(day).some((m) => !m.custom && ids.has(m.dish)) || ids.has(topup) || (topup2 && ids.has(topup2));
    if (!uses) return;
    // Your per-ingredient amounts follow the ingredient list, which may have changed: they are let go.
    const cur = next.days[d];
    const meals = cur.meals.map((m, i) => {
      if (!ids.has(m.dish) || !Array.isArray(m.tweak) || isPinned(next, d, i)) return m;
      const { tweak: _t, fixed: _f, ...rest } = m;
      return rest;
    });
    next = replaceDay(next, d, refit(next, d, { ...cur, meals }));
  });
  return next;
}

// Same dishes, amounts fitted to a new target (after a weigh-in or a new profile).
export function retarget(week, target) {
  let next = { ...week, target, v: PLAN_VERSION };
  week.days.forEach((_, d) => { if (!dayOver(next, d)) next = replaceDay(next, d, refit(next, d, next.days[d])); });
  return next;
}

// Meals from day `from` on that use a dish no longer on offer for that meal get another: the one the
// rotation has there, or the best other dish of the same kind.
export function replaceHidden(week, from) {
  let next = week;
  const roles = rolesOf(week.start, 0);
  for (let d = Math.max(0, from); d < 7; d++) {
    const day = next.days[d];
    let changed = false;
    const meals = day.meals.map((m, i) => {
      if (m.custom || isPinned(next, d, i) || m.slot === "mellanmal" || (isVisible(m.dish) && fits(dishOf(m.dish), m.slot))) return m;
      const other = otherMain(day, m.slot);
      const old = dishOf(m.dish);
      const sameKind = isMain(m.slot) ? DISHES[m.slot].find((x) => x.kind === old?.kind && x.id !== other) : null;
      const pick = m.slot === "frukost" ? breakfastFor() : sameKind ?? mainFor(roles, d, m.slot, other);
      changed = true;
      return { slot: m.slot, dish: pick.id, portion: 1, side: 1 };
    });
    if (changed) next = replaceDay(next, d, refit(next, d, { ...day, meals }));
  }
  return next;
}

// Calories near the target and protein at least near it (more protein is fine).
// The everyday breakfast on days `from`..6, except breakfasts you changed, ate or are past.
export function setBreakfastFrom(week, from) {
  let next = week;
  const b = breakfastFor();
  for (let d = Math.max(0, from); d < 7 && b; d++) {
    const i = slotIndex(next.days[d], "frukost");
    const m = next.days[d].meals[i];
    if (i < 0 || m.chosen || m.custom || isPinned(next, d, i) || m.dish === b.id) continue;
    next = withMeal(next, d, i, { slot: "frukost", dish: b.id, portion: 1, side: 1 });
  }
  return next;
}

export const withinTarget = (totals, target) =>
  Math.abs(totals.kcal - target.kcal) <= target.kcal * KCAL_TOLERANCE
  && totals.protein >= target.protein - PROTEIN_TOLERANCE;
