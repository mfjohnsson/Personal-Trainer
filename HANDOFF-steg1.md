# Handoff – steg 1 (klistra in i Claude i VS Code)

Lägg SPEC.md, KRITERIER.md, DESIGN.md och viktkoll-referens.html i en ny tom projektmapp, öppna den i VS Code och klistra in prompten nedan.

---

Build step 1 ("Grund och design") of the app described in SPEC.md. Only step 1: do not build profile calculations, schedules or food logic yet.

Read first: SPEC.md (goal and scope), KRITERIER.md section 1 (acceptance criteria), DESIGN.md (visual system), viktkoll-referens.html (the existing app whose look we copy; use it as style reference only, do not copy its data logic).

STACK
- Installable PWA, mobile only (Android Chrome), Swedish UI.
- Vanilla HTML/CSS/JavaScript with ES modules, no framework, no build step. Must run by serving the folder statically.
- No backend, no accounts, no network calls at runtime (fonts are system fonts).

STRUCTURE
- index.html, styles.css, app.js (router + view mounting)
- js/store.js: all persistence in localStorage behind a small API (get/set/update), one key `traningskost.v1`, a `schemaVersion` field and a migrate() hook for future versions. Wrap every storage access in try/catch.
- js/views/idag.js, vecka.js, kost.js, profil.js: placeholder views with a header and an empty-state card each, written in Swedish.
- manifest.webmanifest (name "Träning & Kost", short_name "Träning", display standalone, theme/background colors from DESIGN.md, portrait), icons 192 and 512 px plus a maskable icon (simple generated SVG→PNG, no brand marks).
- sw.js: cache-first app shell so the app opens in airplane mode. Version the cache name and clean old caches on activate.
- README.md in Swedish: how to run locally, how to deploy for free on GitHub Pages (HTTPS is required for install), how to add to the Android home screen.

UI
- Follow DESIGN.md exactly: tokens, light/dark via prefers-color-scheme, cards, typography, buttons.
- Bottom navigation with Idag / Vecka / Kost / Profil, hash-based routing (#/idag etc.), Idag is the default. Any view reachable in one tap.
- Header like Viktkoll: app title left, current ISO week ("v. 44") right.
- Min 48px touch targets, safe-area insets, no horizontal scroll at 360px, visible focus, prefers-reduced-motion respected.

DONE WHEN
Go through every criterion in KRITERIER.md section 1 and report for each: met / not met / needs manual test on the phone (say exactly what Mart should do). Never claim a criterion is met without testing it. Test the 360px layout and offline behaviour in a headless browser if available.

GIT
Init a repo, commit in small steps. Commit messages in English; PR titles and descriptions in Swedish.
