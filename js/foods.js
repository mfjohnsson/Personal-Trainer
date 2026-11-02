// Food composition lookup. Data: Livsmedelsverket, Livsmedelsdatabasen (CC BY 4.0), values per 100 g,
// built into data/livsmedel.json by tools/build-foods.mjs. No DOM; the only I/O is load().
let db = null; // { list, byNr }
let loading = null;

// Not in the database (checked against all 2 606 foods). Rough values per 100 g, marked as estimates.
const EXTRA = [
  [9000001, "Proteinbröd (uppskattning)", 250, 22, 8, 16],
  [9000002, "Proteinpulver, vassle (uppskattning)", 390, 78, 6, 7],
];

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
  "mjölk": 123, "turkisk yoghurt": 6113, "jordnötssmör": 1559, "bär": 555, "keso": 70, "frukt": 588, "nötter": 3140,
  "potatis": 4457, "broccoli": 325, "zucchini": 362, "sötpotatis": 3765, "sallad": 340, "morötter": 289, "spenat": 4941,
  "kidneybönor kokta": 878, "vita bönor kokta": 880,
  // Short names people type; the data spells these differently ("Nöt färs") or lists dishes first.
  "nötfärs": 951, "nötfärs 10%": 951, "lax": 1255, "torsk": 1246, "tonfisk": 1278, "makrill": 1260, "kalkon": 1162,
  "kyckling": 1173, "kycklingbröst": 1173, "kycklingbröstfilé": 1173, "räkor": 1395, "yoghurt": 124, "naturell yoghurt": 124,
  "quinoa": 3518, "ris": 2517, "fullkornsris": 2517, "pasta": 3828, "fullkornspasta": 3828, "havregryn": 702,
  "olivolja": 35, "avokado": 320, "banan": 553, "äpple": 588, "gurka": 339, "morot": 289, "tomater": 364, "ägg kokt": 2205,
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
const DL_G = [[/mjölk|yoghurt|\bfil\b|kvarg/i, 103]];
const firstMatch = (table, name, fallback) => table.find(([re]) => re.test(name))?.[1] ?? fallback;

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
