const CACHE = "traningskost-shell-v16";
const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "js/store.js",
  "js/calc.js",
  "js/plan.js",
  "js/views/training.js",
  "js/views/idag.js",
  "js/views/vecka.js",
  "js/views/kost.js",
  "js/views/profil.js",
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).catch(() =>
        req.mode === "navigate" ? caches.match("index.html") : Response.error()
      );
    })
  );
});
