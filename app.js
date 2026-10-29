import { get } from "./js/store.js";
import * as idag from "./js/views/idag.js";
import * as vecka from "./js/views/vecka.js";
import * as kost from "./js/views/kost.js";
import * as profil from "./js/views/profil.js";

const routes = { idag, vecka, kost, profil };
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
  return name in routes ? name : DEFAULT_ROUTE;
}

function render() {
  const name = currentRoute();
  get(); // load persisted state early so storage problems surface here, not mid-view
  weekEl.textContent = "v. " + isoWeek(new Date());
  navLinks.forEach((a) => {
    if (a.dataset.route === name) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  viewEl.innerHTML = "";
  routes[name].mount(viewEl);
  document.title = routes[name].title + " – Träning & Kost";
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", render);
if (!location.hash) history.replaceState(null, "", "#/" + DEFAULT_ROUTE);
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
