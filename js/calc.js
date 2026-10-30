// Pure profile maths. No DOM, no storage.
export const KCAL_PER_KG = 7700;
export const ACTIVITY_FACTOR = 1.55; // måttligt aktiv
export const RATE_PCT_PER_WEEK = 0.5; // % av kroppsvikt per vecka
export const PROTEIN_G = 170;

// Mifflin-St Jeor, male (Mart's profile).
export function bmr({ age, heightCm, weightKg }) {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
}

export function tdee(p) {
  return bmr(p) * ACTIVITY_FACTOR;
}

export function weeklyLossKg(weightKg) {
  return (weightKg * RATE_PCT_PER_WEEK) / 100;
}

export function dailyDeficit(weightKg) {
  return (weeklyLossKg(weightKg) * KCAL_PER_KG) / 7;
}

export function calorieTarget(p) {
  return tdee(p) - dailyDeficit(p.weightKg);
}

export function weeksToGoal({ weightKg, goalKg }) {
  const loss = weeklyLossKg(weightKg);
  return loss > 0 ? Math.max(0, (weightKg - goalKg) / loss) : 0;
}

export function goalDate(p, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + Math.round(weeksToGoal(p) * 7));
  return d;
}

// Accepts "82,5" or "82.5". Returns NaN for empty/garbage.
export function parseNum(s) {
  const t = String(s ?? "").trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

const LIMITS = {
  age: [14, 100, "Ålder", "år"],
  heightCm: [120, 230, "Längd", "cm"],
  weightKg: [35, 300, "Vikt", "kg"],
  waistCm: [40, 200, "Midja", "cm"],
  goalKg: [35, 300, "Målvikt", "kg"],
};

// Returns { values, errors } where errors maps field -> Swedish message.
export function validate(raw) {
  const values = {};
  const errors = {};
  for (const [key, [min, max, label, unit]] of Object.entries(LIMITS)) {
    const n = parseNum(raw[key]);
    if (Number.isNaN(n)) errors[key] = `${label}: fyll i ett tal.`;
    else if (n < min || n > max) errors[key] = `${label}: ${min}–${max} ${unit}.`;
    else values[key] = n;
  }
  if (!errors.weightKg && !errors.goalKg && values.goalKg >= values.weightKg) {
    errors.goalKg = "Målvikt: måste vara lägre än vikten.";
  }
  return { values, errors };
}
