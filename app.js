import { get } from "./js/store.js";
import * as idag from "./js/views/idag.js";
import * as vecka from "./js/views/vecka.js";
import * as kost from "./js/views/kost.js";
import * as profil from "./js/views/profil.js";
import * as ratter from "./js/views/ratter.js";
import * as handla from "./js/views/handla.js";
import { init as initDishes } from "./js/dishes.js";
import * as foods from "./js/foods.js";
import { tick } from "./js/mealplan.js";
import * as clock from "./js/clock.js";

const routes = { idag, traning: vecka, kost, profil, ratter, handla };
// Old addresses still lead somewhere sensible.
const ALIASES = { vecka: "traning", meny: "ratter" };
// Sub-pages light up their parent in the bottom nav.
const PARENT = { ratter: "kost", handla: "kost" };
const DEFAULT_ROUTE = "idag";

const viewEl = document.getElementById("view");
const weekEl = document.getElementById("week");
const navLinks = document.querySelectorAll(".bottom-nav a");

function isoWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const fDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fDay + 3);
  return 1 + Math.round((date - firstThursday) / (7 * 24 * 3600 * 1000));
}

function currentRoute() {
  const raw = location.hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  const name = ALIASES[raw] ?? raw;
  return Object.hasOwn(routes, name) ? name : DEFAULT_ROUTE;
}

function render() {
  const name = currentRoute();
  if (location.hash !== "#/" + name) history.replaceState(null, "", "#/" + name);
  get(); // load persisted state early so storage problems surface here, not mid-view
  initDishes();
  tick(); // meals whose time has passed count as eaten
  shownDay = clock.todayIso();
  weekEl.textContent = "v. " + isoWeek(clock.now());
  const testText = clock.overrideText();
  weekEl.classList.toggle("test-mode", !!testText);
  if (testText) weekEl.textContent += " · " + testText;
  navLinks.forEach((a) => {
    if (a.dataset.route === (PARENT[name] ?? name)) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  viewEl.innerHTML = "";
  viewEl.onclick = viewEl.onchange = viewEl.oninput = viewEl.onkeydown = viewEl.onsubmit = null; // handlers a previous view assigned
  routes[name].mount(viewEl);
  document.title = routes[name].title + " – Träning & Kost";
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", render);
// Back in the app after a while: the time is checked again, and a new day draws the view again.
let shownDay = null;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  tick();
  if (shownDay && shownDay !== clock.todayIso()) render();
});
if (!location.hash) history.replaceState(null, "", "#/" + DEFAULT_ROUTE);
// The food database says which ingredients are protein and which are sides; plans are made with it, so
// the first view waits for it (it is cached and small). Without it the app still works, less precisely.
foods.load().catch(() => {}).finally(render);

if ("serviceWorker" in navigator) {
  // A new service worker skips waiting and claims the page. Reload once so the new files are used;
  // skip when there was no controller before (first install, nothing stale to replace).
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      // Installed apps stay open for days: look for a new version whenever the app comes back.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    }).catch(() => {});
  });
}
