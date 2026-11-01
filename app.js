import { get } from "./js/store.js";
import * as idag from "./js/views/idag.js";
import * as vecka from "./js/views/vecka.js";
import * as kost from "./js/views/kost.js";
import * as profil from "./js/views/profil.js";
import * as ratter from "./js/views/ratter.js";
import * as meny from "./js/views/meny.js";
import { init as initDishes } from "./js/dishes.js";

const routes = { idag, vecka, kost, profil, ratter, meny };
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
  const name = location.hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  return Object.hasOwn(routes, name) ? name : DEFAULT_ROUTE;
}

function render() {
  const name = currentRoute();
  if (location.hash !== "#/" + name) history.replaceState(null, "", "#/" + name);
  get(); // load persisted state early so storage problems surface here, not mid-view
  initDishes();
  weekEl.textContent = "v. " + isoWeek(new Date());
  navLinks.forEach((a) => {
    if (a.dataset.route === (name === "ratter" || name === "meny" ? "kost" : name)) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  viewEl.innerHTML = "";
  viewEl.onclick = viewEl.onchange = viewEl.oninput = viewEl.onkeydown = null; // handlers a previous view assigned
  routes[name].mount(viewEl);
  document.title = routes[name].title + " – Träning & Kost";
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", render);
if (!location.hash) history.replaceState(null, "", "#/" + DEFAULT_ROUTE);
render();

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
