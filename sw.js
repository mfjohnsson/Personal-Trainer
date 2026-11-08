const CACHE = "traningskost-shell-v49";
const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "js/store.js",
  "js/clock.js",
  "js/calc.js",
  "js/plan.js",
  "js/meals.js",
  "js/dishes.js",
  "js/mealplan.js",
  "js/checkin.js",
  "js/timer.js",
  "js/foods.js",
  "data/livsmedel.json",
  "js/html.js",
  "js/views/training.js",
  "js/views/idag.js",
  "js/views/vecka.js",
  "js/views/kost.js",
  "js/views/profil.js",
  "js/views/ratter.js",
  "js/views/handla.js",
  "js/views/mealui.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// On localhost (development) the network wins, so edited files show up on a plain reload without
// bumping CACHE. Fresh responses refresh the cache, which still serves when the server is down.
const DEV = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (DEV) {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => {
          if (!res.ok) return res;
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          // A plain dev server sends no Cache-Control, so the browser would keep scripts in its own memory
          // cache across reloads; marked no-store, every reload gets the file just fetched.
          const headers = new Headers(res.headers);
          headers.set("Cache-Control", "no-store");
          return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
        })
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then((hit) => hit ?? (req.mode === "navigate" ? caches.match("index.html") : Response.error())))
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).catch(() =>
        req.mode === "navigate" ? caches.match("index.html") : Response.error()
      );
    })
  );
});
