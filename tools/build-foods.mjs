// Builds data/livsmedel.json from Livsmedelsverket's open API (CC BY 4.0).
// Usage: node tools/build-foods.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://dataportal.livsmedelsverket.se/livsmedel/api/v1';
const CONCURRENCY = 8;
const RETRIES = 3;
const PROGRESS_EVERY = 200;
const LIST_LIMIT = 2700;

const NUTRIENTS = {
  'Energi (kcal)': 'kcal',
  'Protein': 'protein',
  'Fett, totalt': 'fett',
  'Kolhydrater, tillgängliga': 'kolh',
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(root, 'data', 'livsmedel.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < RETRIES) await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr;
}

function toNumber(value) {
  const n = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

async function fetchFood(food) {
  const list = await getJson(`${BASE}/livsmedel/${food.nummer}/naringsvarden?sprak=1`);
  const values = { kcal: undefined, protein: 0, fett: 0, kolh: 0 };
  for (const n of Array.isArray(list) ? list : []) {
    const key = NUTRIENTS[n?.namn];
    if (key) values[key] = toNumber(n.varde);
  }
  if (values.kcal === undefined) throw new Error('Energi (kcal) saknas');
  return [food.nummer, food.namn, values.kcal, values.protein, values.fett, values.kolh];
}

async function fetchAllFoods() {
  // Try one request for all records; fall back to paging if the server caps the limit.
  const first = await getJson(`${BASE}/livsmedel?offset=0&limit=${LIST_LIMIT}&sprak=1`);
  const total = first._meta?.totalRecords ?? first.livsmedel.length;
  const all = [...first.livsmedel];
  let offset = all.length;
  while (offset < total) {
    const page = await getJson(`${BASE}/livsmedel?offset=${offset}&limit=${LIST_LIMIT}&sprak=1`);
    if (!page.livsmedel?.length) break;
    all.push(...page.livsmedel);
    offset += page.livsmedel.length;
  }
  return all;
}

async function main() {
  const foods = await fetchAllFoods();
  console.log(`Listed ${foods.length} foods`);

  const rows = new Array(foods.length);
  let done = 0;
  let skipped = 0;
  let next = 0;

  async function worker() {
    while (next < foods.length) {
      const i = next++;
      const food = foods[i];
      try {
        rows[i] = await fetchFood(food);
      } catch (err) {
        skipped++;
        console.error(`Skipped ${food.nummer} (${food.namn}): ${err.message}`);
      }
      done++;
      if (done % PROGRESS_EVERY === 0) console.log(`Progress: ${done}/${foods.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const written = rows.filter(Boolean).sort((a, b) => a[0] - b[0]);
  const output = {
    source: 'Livsmedelsverket, Livsmedelsdatabasen (CC BY 4.0)',
    fetched: new Date().toISOString().slice(0, 10),
    fields: ['nummer', 'namn', 'kcal', 'protein', 'fett', 'kolh'],
    foods: written,
  };

  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, JSON.stringify(output));
  console.log(`Foods written: ${written.length}`);
  console.log(`Foods skipped: ${skipped}`);
  console.log(`Wrote ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
