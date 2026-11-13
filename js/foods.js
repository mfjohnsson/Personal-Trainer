// Food composition lookup. Data: Livsmedelsverket, Livsmedelsdatabasen (CC BY 4.0), values per 100 g,
// built into data/livsmedel.json by tools/build-foods.mjs. No DOM; the only I/O is load().
let db = null; // { list, byNr }
let loading = null;

// Not in the database (checked against all 2 606 foods). Rough values per 100 g, marked as estimates.
const EXTRA = [
  [9000001, "Proteinbröd (uppskattning)", 250, 22, 8, 16],
  [9000002, "Proteinpulver, vassle (uppskattning)", 390, 78, 6, 7],
  // Drinks the database lacks. kcal = alcohol (vol. % × 0,789 g/ml × 7 kcal/g) + carbs and protein × 4.
  [9000010, "Öl ljus lager vol. % 5 (uppskattning)", 43, 0.4, 0, 3.3],
  [9000011, "Öl IPA APA vol. % 6,5 (uppskattning)", 56, 0.5, 0, 4.5],
  [9000012, "Öl stout porter vol. % 5 (uppskattning)", 49, 0.4, 0, 5],
  [9000013, "Öl veteöl vol. % 5 (uppskattning)", 46, 0.5, 0, 4],
  [9000014, "Öl stark ale vol. % 8 (uppskattning)", 70, 0.5, 0, 6],
  [9000015, "Rödvin vol. % 13,5 (uppskattning)", 85, 0.1, 0, 2.6],
  [9000016, "Vitt vin torrt vol. % 12 (uppskattning)", 77, 0.1, 0, 2.6],
  [9000017, "Rosévin vol. % 12 (uppskattning)", 82, 0.1, 0, 4],
  [9000018, "Mousserande vin vol. % 11,5 (uppskattning)", 70, 0.2, 0, 1.5],
  [9000019, "Cider vol. % 4,5 (uppskattning)", 61, 0, 0, 9],
];

// Drinks are counted as glasses or bottles of a given size in cl. 1 ml is taken as 1 g.
const DRINK = /^(öl|cider|läsk|juice|glögg|brännvin|whisky|rödvin|vitt vin|rosévin|mousserande|vin|sprit|likör|cognac|rom|gin|sportdryck|energidryck)(?![\p{L}])/iu;
export const isDrink = (food) => DRINK.test(food.name);
export const DRINK_SIZES = [4, 15, 25, 33, 40, 50, 75];
export function drinkSize(food) {
  if (/^(brännvin|whisky|sprit|likör|cognac|rom|gin)(?![\p{L}])/iu.test(food.name)) return 4;
  if (/vin(?![\p{L}])|^glögg/iu.test(food.name)) return 15;
  return 33;
}

// Alcohol by volume in the name ("vol. % 5,4"), 0 when none.
export function abvOf(food) {
  const m = /vol\. % ([\d,]+)/.exec(food.name);
  return m ? Number(m[1].replace(",", ".")) : 0;
}
const ALCOHOL_KCAL = 0.789 * 7; // per vol. % and 100 ml

// Macros of `grams` of `food`. `abv` (optional) replaces the drink's own strength: only the alcohol changes.
export function itemMacros(food, grams, abv) {
  const k = grams / 100;
  const kcal = food.kcal + (abv === undefined ? 0 : (abv - abvOf(food)) * ALCOHOL_KCAL);
  return { kcal: Math.max(0, kcal) * k, protein: food.protein * k, fat: food.fat * k, carbs: food.carbs * k };
}

export function setData(json) {
  const list = [...json.foods, ...EXTRA].map(([nummer, name, kcal, protein, fat, carbs]) => ({ nummer, name, kcal, protein, fat, carbs, key: name.toLowerCase() }));
  db = { list, byNr: new Map(list.map((f) => [f.nummer, f])) };
  return db;
}

export function load(url = new URL("../data/livsmedel.json", import.meta.url)) {
  loading ??= fetch(url)
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(setData)
    .catch((e) => { loading = null; throw e; });
  return loading;
}

export const isLoaded = () => !!db;
export const foodByNumber = (n) => db?.byNr.get(n);

// The food to start from for the ingredient names the built-in dishes use (written as `norm` gives them).
// Raw weights for meat, fish and dry goods; cooked weights where the name says "tillagad".
const norm = (s) => s.toLowerCase().replace(/,/g, "").replace(/\s+/g, " ").trim();
export const PREFERRED = {
  "kycklingfilé": 1173, "laxfilé": 1255, "torskfilé": 1246, "kalkonfilé": 1162, "kalkonfärs": 1162,
  "nötfärs 10 %": 951, "fläskfilé": 970, "biff": 946, "tonfisk i vatten": 1278,
  "makrill i tomatsås": 1296, "makrillfilé": 1260,
  "quinoa tillagad": 3518, "matvete tillagat": 6145, "fullkornspasta tillagad": 3828, "fullkornsris tillagat": 2517,
  "fullkornspasta torr": 848, "fullkornsris torrt": 2478,
  "grönsaker": 6420, "ugnsgrönsaker": 2672, "wokgrönsaker": 425, "rotfrukter": 2672,
  "tomat": 364, "krossade tomater": 422, "ägg": 1225, "proteinbröd": 9000001, "proteinpulver": 9000002,
  "mjölk": 123, "vatten": 1953, "turkisk yoghurt": 6113, "jordnötssmör": 1559, "bär": 555, "keso": 70, "frukt": 588, "nötter": 3140,
  "potatis": 4457, "broccoli": 325, "zucchini": 362, "sötpotatis": 3765, "sallad": 340, "morötter": 289, "spenat": 4941,
  "kidneybönor kokta": 878, "vita bönor kokta": 880,
  // Short names people type; the data spells these differently ("Nöt färs") or lists dishes first.
  "nötfärs": 951, "nötfärs 10%": 951, "lax": 1255, "torsk": 1246, "tonfisk": 1278, "makrill": 1260, "kalkon": 1162,
  "kyckling": 1173, "kycklingbröst": 1173, "kycklingbröstfilé": 1173, "räkor": 1395, "yoghurt": 124, "naturell yoghurt": 124,
  "quinoa": 3518, "ris": 2517, "fullkornsris": 2517, "pasta": 3828, "fullkornspasta": 3828, "havregryn": 702,
  "olivolja": 35, "avokado": 320, "banan": 553,
  "kvarg": 3243, "knäckebröd": 166, "blåbär": 556, "hallon": 590,
  // Things people eat out.
  "hamburgare": 2511, "hamburgare med bröd": 2511, "pommes": 246, "pommes frites": 246, "coleslaw": 2075,
  "öl": 9000010, "lager": 9000010, "folköl": 1902, "starköl": 1906, "lättöl": 1901, "ipa": 9000011, "apa": 9000011,
  "stout": 9000012, "porter": 9000012, "veteöl": 9000013, "ale": 9000014, "vin": 9000015, "rödvin": 9000015,
  "vitt vin": 9000016, "vitvin": 9000016, "rosé": 9000017, "rosévin": 9000017, "bubbel": 9000018, "cava": 9000018,
  "prosecco": 9000018, "champagne": 9000018, "cider": 9000019, "äpple": 588, "gurka": 339, "morot": 289, "tomater": 364, "ägg kokt": 2205,
};

const tokens = (s) => s.toLowerCase().split(/[\s,.\-/()%]+/).filter(Boolean);

const SYNONYMS = { tillagad: "kokt", tillagat: "kokt", tillagade: "kokt", kokta: "kokt", torr: "okokt", torrt: "okokt" };

// Foods matching the words of `query`, best first. A compound word ("kycklingfilé") is not always
// written that way in the data, so each long word is shortened until something matches every word;
// failing that, foods matching at least one word are listed.
export function search(query, limit = 6) {
  const hits = searchText(query, limit);
  // A name the built-in dishes use ("kycklingfilé") goes first with the food chosen for it.
  const preferred = foodByNumber(PREFERRED[norm(query)]);
  return preferred ? [preferred, ...hits.filter((f) => f !== preferred)].slice(0, limit) : hits;
}

function searchText(query, limit) {
  const words = tokens(query).map((t) => SYNONYMS[t] ?? t);
  if (!db || !words.length) return [];
  // Words that start a word in the name rank above words found inside one ("kokt" in "okokt").
  const wordStarts = (f) => words.filter((t) => !f.key.split(/[\s,]+/).some((w) => w.startsWith(t))).length * 10;
  const score = (f, first) => (f.key.startsWith(first) ? 0 : 20) + wordStarts(f) + f.key.split(" ").length * 3 + f.key.length * 0.2 - (/ rå( |$)/.test(f.key) ? 2 : 0);
  const rank = (hits, first) => hits.sort((a, b) => score(a, first) - score(b, first) || a.name.localeCompare(b.name, "sv")).slice(0, limit);
  const shorten = (cut) => words.map((t) => (t.length > 5 ? t.slice(0, Math.max(5, t.length - cut)) : t));
  for (const cut of [0, 2, 4, 6]) {
    const ts = shorten(cut);
    const hits = db.list.filter((f) => ts.every((t) => f.key.includes(t)));
    if (hits.length) return rank(hits, ts[0]);
  }
  const ts = shorten(4);
  const some = db.list.map((f) => ({ f, n: ts.filter((t) => f.key.includes(t)).length })).filter((x) => x.n > 0);
  const best = Math.max(0, ...some.map((x) => x.n));
  return rank(some.filter((x) => x.n === best).map((x) => x.f), ts[0]);
}

// True when the food for `name` is a deliberate choice, false when it is the best text match.
export const isPreferred = (name) => PREFERRED[norm(name)] !== undefined;

export const match = (name) => foodByNumber(PREFERRED[norm(name)]) ?? search(name, 1)[0];

// Typical weights of what the recipes count in pieces, slices and decilitres. Estimates, shown as such.
const PIECE_G = [[/ägg/i, 60], [/tomat/i, 120], [/banan/i, 120], [/frukt|äpple|päron|apelsin/i, 150]];
const SLICE_G = [[/bröd/i, 30]];
// 1 dl vassleprotein väger ca 35 g, 1 dl mjöl ca 60 g, 1 dl havregryn ca 40 g; anything else is counted as water (100 g).
const DL_G = [[/proteinpulver/i, 35], [/mjölk|yoghurt|\bfil\b|kvarg/i, 103], [/mjöl|rågsikt/i, 60], [/gryn|müsli/i, 40]];
const firstMatch = (table, name, fallback) => table.find(([re]) => re.test(name))?.[1] ?? fallback;

// Foods you count rather than weigh, with the weight of one: whole eggs and whole fruit. The first word
// must be the food itself, so "Äggula", "Äggnudlar" and "Äpplemos" are weighed.
const COUNTED = [[/^ägg\b/i, 60], [/^banan\b/i, 120], [/^(äpple|päron|apelsin)\b/i, 150]];
export const pieceGrams = (name) => COUNTED.find(([re]) => re.test(String(name ?? "").trim()))?.[1] ?? null;

// Liquids you pour rather than weigh. Drinks (beer, wine, soda, juice) go by the centilitre, starting at a
// glass or bottle; milk, water, coffee and the like by the decilitre. The first word must be the liquid
// itself, so "Mjölkchoklad", "Kaffegrädde" and "Vattenmelon" are weighed.
const DL_LIQUID = /^(mjölk|lättmjölk|mellanmjölk|standardmjölk|mjölkdryck|filmjölk|fil|kefir|kärnmjölk|havredryck|sojadryck|mandeldryck|risdryck|vatten|kaffe|te|saft|buljong|smoothie|drickyoghurt|proteindryck|blåbärssoppa|nyponsoppa)(?![\p{L}])/iu;

// How a food added to a meal is measured: { unit, gpu (grams per unit), amount (to start from), step? (for
// + and −: one more glass or bottle) }, or null
// for grams. Eggs and whole fruit are counted.
export function measureOf(food) {
  const name = String(food?.name ?? "").trim();
  const per = pieceGrams(name);
  if (per) return { unit: "st", gpu: per, amount: 1 };
  if (isDrink({ name })) { const size = drinkSize({ name }); return { unit: "cl", gpu: 10, amount: size, step: size }; }
  if (DL_LIQUID.test(name)) return { unit: "dl", gpu: /^(mjölk|lätt|mellan|standard|fil|kefir|kärn|drickyoghurt)/i.test(name) ? 103 : 100, amount: 2 };
  return null;
}

export function gramsOf(amount, unit, name) {
  if (unit === "g") return { grams: amount, estimated: false };
  const per = unit === "dl" ? firstMatch(DL_G, name, 100) : unit === "skivor" ? firstMatch(SLICE_G, name, 35) : firstMatch(PIECE_G, name, 100);
  return { grams: amount * per, estimated: true };
}

const MACROS = ["kcal", "protein", "fat", "carbs"];

// ingredients: [[name, amount, unit, category, foodNumber?]]. `pick` (optional) maps a row index to a
// food number the user chose. Rows with no match count as zero and are listed in `unmatched`.
export function macrosOf(ingredients, pick = {}) {
  const total = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  const lines = ingredients.map(([name, amount, unit, , stored], i) => {
    const food = foodByNumber(pick[i] ?? stored) ?? match(name);
    const { grams, estimated } = gramsOf(amount, unit, name);
    const line = { name, grams: Math.round(grams), estimated, food };
    for (const k of MACROS) { line[k] = food ? (food[k] * grams) / 100 : 0; total[k] += line[k]; }
    return line;
  });
  return {
    kcal: Math.round(total.kcal), protein: Math.round(total.protein), fat: Math.round(total.fat), carbs: Math.round(total.carbs),
    lines, unmatched: lines.filter((l) => !l.food).map((l) => l.name),
  };
}
