// All persistence lives here. One localStorage key, versioned schema.
const KEY = "traningskost.v1";
export const SCHEMA_VERSION = 1;

const defaults = () => ({ schemaVersion: SCHEMA_VERSION });

// Upgrade data written by older schema versions. Add one `if` per version bump.
export function migrate(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return defaults();
  let v = Number.isInteger(data.schemaVersion) ? data.schemaVersion : 0;
  // if (v < 2) { ...transform data...; v = 2; }
  if (v < SCHEMA_VERSION) v = SCHEMA_VERSION;
  data.schemaVersion = v;
  return data;
}

let state = null;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    try {
      return migrate(JSON.parse(raw));
    } catch {
      // Corrupt JSON: keep the raw string so it is not lost when we overwrite KEY.
      try { localStorage.setItem(KEY + ".corrupt", raw); } catch {}
      return defaults();
    }
  } catch {
    return defaults();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function ensure() {
  if (!state) state = load();
  return state;
}

// get() returns the whole state; get("profile") a top-level field.
export function get(field, fallback = undefined) {
  const s = ensure();
  if (field === undefined) return s;
  return s[field] === undefined ? fallback : s[field];
}

// On a failed write the in-memory value is rolled back so the UI never shows unsaved data as saved.
export function set(field, value) {
  const s = ensure();
  const prev = s[field];
  s[field] = value;
  if (persist()) return true;
  if (prev === undefined) delete s[field]; else s[field] = prev;
  return false;
}

// update("profile", p => ({ ...p, age: 35 }))
export function update(field, fn, fallback = undefined) {
  const s = ensure();
  return set(field, fn(s[field] === undefined ? fallback : s[field]));
}

// Several fields in one write: either all are stored or none (the in-memory state is rolled back).
export function setMany(fields) {
  const s = ensure();
  const prev = Object.fromEntries(Object.keys(fields).map((k) => [k, s[k]]));
  Object.assign(s, fields);
  if (persist()) return true;
  for (const [k, v] of Object.entries(prev)) if (v === undefined) delete s[k]; else s[k] = v;
  return false;
}

// --- Backup: the whole state as JSON, and back ---

export const exportJson = () => JSON.stringify(ensure(), null, 1);

// Checks a file from exportJson before anything is replaced: { ok: true, data } or { ok: false, error }
// with a Swedish message.
export function readBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, error: "Filen är inte giltig JSON." }; }
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const shapeOk = isObj(data) && Number.isInteger(data.schemaVersion) && data.schemaVersion >= 0
    && ["profile", "weeks", "choices", "progress"].every((k) => data[k] === undefined || isObj(data[k]));
  if (!shapeOk) return { ok: false, error: "Filen ser inte ut som en säkerhetskopia från appen." };
  if (data.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: "Säkerhetskopian kommer från en nyare version av appen. Uppdatera appen först." };
  }
  return { ok: true, data };
}

// Replaces everything with checked backup data (run through migrate, so older backups still load).
// The data that was here is kept under KEY + ".fore-import" (the latest import only) as a safety net.
// Returns false if storage refused; then nothing has changed.
export function restoreBackup(data) {
  const prev = ensure();
  try {
    localStorage.setItem(KEY + ".fore-import", JSON.stringify(prev));
  } catch {
    return false; // no safety copy, no import: storage this full would likely refuse the import too
  }
  state = migrate(data);
  if (persist()) return true;
  state = prev;
  return false;
}
