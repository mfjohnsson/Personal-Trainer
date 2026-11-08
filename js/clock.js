// The app's idea of "now". On localhost the URL can override it for testing, without touching the
// computer clock: ?datum=YYYY-MM-DD and/or ?tid=HH:MM (?today= is an older alias for ?datum).
// The overridden time stands still; the real clock ticks as usual everywhere else.
import * as plan from "./plan.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export const isLocalhost = () => LOCAL_HOSTS.has(location.hostname);

function overrides() {
  if (!isLocalhost()) return {};
  const q = new URLSearchParams(location.search);
  const date = q.get("datum") ?? q.get("today");
  const m = /^(\d{1,2}):(\d{2})$/.exec(q.get("tid") ?? "");
  const time = m && +m[1] < 24 && +m[2] < 60 ? [+m[1], +m[2]] : null;
  return { date: plan.parseIso(date) ? date : null, time };
}

// Current moment as a Date, with any override applied.
export function now() {
  const real = new Date();
  const { date, time } = overrides();
  if (!date && !time) return real;
  const d = date ? plan.parseIso(date) : real;
  const [h, min] = time ?? [real.getHours(), real.getMinutes()];
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, min, time ? 0 : real.getSeconds());
}

export const todayIso = () => plan.isoDate(now());

// Short label for the header ("test 10 nov 09:00"), or "" when nothing is overridden.
export function overrideText() {
  const { date, time } = overrides();
  if (!date && !time) return "";
  const n = now();
  const day = date ? n.toLocaleDateString("sv-SE", { day: "numeric", month: "short" }).replace(".", "") : "";
  const clock = time ? n.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }) : "";
  return ["test", day, clock].filter(Boolean).join(" ");
}
