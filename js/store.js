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
